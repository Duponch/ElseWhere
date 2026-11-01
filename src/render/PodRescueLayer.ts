import * as THREE from 'three/webgpu';
import { Fn, attribute, cos, float, mat4, normalLocal, positionLocal, sin, smoothstep, texture, transformNormal, uniform, uv, vec3, vec4, instanceIndex } from 'three/tsl';
import type { World } from '../sim/types';
import { BoxMesh } from './BoxMesh';
import { material } from './primitives';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { instancedBoxPatternUv } from './texture-variation';
import type { AnimationDetail } from './AnimationDetail';
import { RetainedAnimation } from './RetainedAnimation';
import {currentGraphicsStyle,applyOrigamiSurface} from './graphics-style';
import {createOrigamiContour,type OrigamiContourBinding} from './origami/contours';

export const POD_RESCUE_PARTS = 6;
export const POD_RESCUE_FALL_HEIGHT = 24;
// Local model, shared by every incident. Hinged halves remain in this draw.
const PARTS = [
  [0,.38,0, 1.04,.68,1.82, 0xb7c5be,0],
  [0,.40,-.66, 1.10,.72,.13, 0xd8b189,0],
  [0,.40,.66, 1.10,.72,.13, 0xd8b189,0],
  [0,.055,0, 1.12,.11,1.90, 0x687d82,0],
  [-.27,.79,0, .54,.16,1.90, 0xe9ddc2,-1],
  [.27,.79,0, .54,.16,1.90, 0xe9ddc2,1],
] as const;

/** One resident capsule batch. Only confirmed incident changes upload data;
 * the shared presentation tick drives all movement on the GPU. */
export class PodRescueLayer {
  readonly group = new THREE.Group();
  readonly mesh: BoxMesh;
  private readonly contour?:OrigamiContourBinding;
  readonly tick = uniform(0);
  /** Actual opening tick and confirmation flag, never the scheduled deadline. */
  readonly opening = uniform(new THREE.Vector2());
  private readonly center = uniform(new THREE.Vector3());
  private readonly times = uniform(new THREE.Vector3());
  private readonly yaw = uniform(0);
  private readonly base = new THREE.BoxGeometry(1,1,1);
  private readonly paint = createStylizedSurfaceTexture();
  private readonly plain = material(0xffffff,{transparent:true,depthWrite:false,forceSinglePass:true});
  private readonly painted = material(0xffffff,{transparent:true,depthWrite:false,forceSinglePass:true});
  private key = '';
  private pendingId: number | undefined;
  private fadeUntil: number | undefined;
  private revision = 0;
  private texturesEnabled = true;
  private readonly animation:RetainedAnimation;

  constructor(configure?: (material: THREE.MeshStandardNodeMaterial) => void,detail?:AnimationDetail) {
    this.animation=new RetainedAnimation(detail);
    const opening = smoothstep(this.opening.x,this.opening.x.add(2),this.tick).mul(this.opening.y);
    const falling = float(1).sub(smoothstep(this.times.x,this.times.y,this.tick)).mul(POD_RESCUE_FALL_HEIGHT);
    const basis=this.animation.choose(()=>{
      const angle=opening.mul(attribute('podLidSide','float')).mul(-Math.PI*.56);
      return vec4(opening,falling,cos(angle),sin(angle));
    },instanceIndex);
    const opacity = float(1).sub(basis.x).mul(this.tick.greaterThanEqual(this.times.x).select(1,0));
    const position = Fn(() => {
      const transform = mat4(attribute('boxMatrix0','vec4'),attribute('boxMatrix1','vec4'),
        attribute('boxMatrix2','vec4'),attribute('boxMatrix3','vec4')).toVar();
      const side = attribute('podLidSide','float');
      const c=basis.z,s=basis.w;
      const hinge = vec3(side.mul(.54),.79,0);
      const local = transform.mul(positionLocal).xyz.sub(hinge);
      const opened = vec3(local.x.mul(c).sub(local.y.mul(s)),local.x.mul(s).add(local.y.mul(c)),local.z).add(hinge);
      const normal = transformNormal(normalLocal,transform);
      const hingedNormal = vec3(normal.x.mul(c).sub(normal.y.mul(s)),normal.x.mul(s).add(normal.y.mul(c)),normal.z);
      const cy=cos(this.yaw),sy=sin(this.yaw);
      normalLocal.assign(vec3(hingedNormal.x.mul(cy).add(hingedNormal.z.mul(sy)),hingedNormal.y,
        hingedNormal.z.mul(cy).sub(hingedNormal.x.mul(sy))));
      return vec3(opened.x.mul(cy).add(opened.z.mul(sy)),opened.y.add(basis.y),
        opened.z.mul(cy).sub(opened.x.mul(sy))).add(this.center);
    })();
    for(const surface of [this.plain,this.painted]) {
      configure?.(surface);surface.userData.rendererOwned=true;
      surface.positionNode=position;surface.opacityNode=opacity;
      surface.colorNode=attribute('boxColor','vec3');
    }
    // A distinct resident plain graph contains no pigment texture lookup.
    this.painted.colorNode=attribute('boxColor','vec3').mul(texture(this.paint,instancedBoxPatternUv()).rgb);
    this.mesh=new BoxMesh(this.base,this.painted,POD_RESCUE_PARTS);
    this.mesh.name='civilian-rescue-pod';this.mesh.castShadow=true;this.mesh.receiveShadow=true;
    const sides=new THREE.InstancedBufferAttribute(new Float32Array(POD_RESCUE_PARTS),1);
    this.mesh.geometry.setAttribute('podLidSide',sides);
    const object=new THREE.Object3D(),color=new THREE.Color();
    PARTS.forEach(([x,y,z,sx,sy,sz,tint,side],index)=>{
      object.position.set(x,y,z);object.scale.set(sx,sy,sz);object.updateMatrix();
      this.mesh.setMatrixAt(index,object.matrix);this.mesh.setColorAt(index,color.setHex(tint));sides.setX(index,side);
    });
    this.mesh.instanceMatrix.needsUpdate=this.mesh.colorBuffer.needsUpdate=sides.needsUpdate=true;
    this.mesh.activeCount=0;this.group.add(this.mesh);
    const context=currentGraphicsStyle();
    applyOrigamiSurface(this.painted,attribute('boxColor','vec3'),uv(),context);
    if(context?.origami){this.contour=createOrigamiContour(this.mesh,context);this.group.add(this.contour.line);}
  }

  /** Renderer-only preview callers must synchronize after writing instance streams. */
  syncContours():void {this.contour?.sync();}

  adopt(world:World):void {
    try{this.adoptBody(world);}finally{this.syncContours();}
  }
  private adoptBody(world:World):void {
    const pending=world.podRescues?.pending;
    if(!pending){
      if(this.pendingId!==undefined){
        // A blocked cell leaves pending intact beyond openAt. Only the actual
        // incident record authorizes opening; cancellation/reload just hides.
        const opened=world.podRescues?.incidents.find(incident=>incident.id===this.pendingId);
        this.pendingId=undefined;this.key='';this.revision++;
        if(opened){this.opening.value.set(opened.openedAt,1);this.fadeUntil=opened.openedAt+2;}
        else {this.fadeUntil=undefined;this.mesh.activeCount=0;}
      }
      if(this.fadeUntil!==undefined&&world.tick>=this.fadeUntil&&this.tick.value>=this.fadeUntil){
        this.fadeUntil=undefined;this.revision++;this.mesh.activeCount=0;
      }
      return;
    }
    const key=`${pending.id}:${pending.start}:${pending.landAt}:${pending.openAt}:${pending.cell.x}:${pending.cell.z}:${pending.seed}`;
    if(key===this.key)return;
    this.key=key;this.revision++;
    this.pendingId=pending.id;this.fadeUntil=undefined;this.opening.value.set(0,0);
    this.mesh.activeCount=POD_RESCUE_PARTS;
    this.center.value.set(pending.cell.x,0,pending.cell.z);
    this.times.value.set(pending.start,pending.landAt,pending.openAt);
    this.yaw.value=(pending.seed>>>0)/0x100000000*Math.PI*2;
    this.animation.reconcile(PARTS.map((_,part)=>({id:pending.id*POD_RESCUE_PARTS+part,x:pending.cell.x,y:1,z:pending.cell.z})));
    // The CPU box model stays local. Bounds include the full shader trajectory,
    // opening lids and every yaw, rather than only the closed ground capsule.
    this.mesh.boundingSphere.set(new THREE.Vector3(pending.cell.x,12.5,pending.cell.z),13.5);
  }

  present(tick:number):void {
    try{this.presentBody(tick);}finally{this.syncContours();}
  }
  private presentBody(tick:number):void {
    this.tick.value=tick;if(!this.mesh.activeCount)return;
    // Retirement follows the confirmed clock, including when the pose is held.
    if(this.fadeUntil!==undefined&&tick>=this.fadeUntil){this.mesh.activeCount=0;this.fadeUntil=undefined;this.revision++;return;}
    const smooth=(a:number,b:number,t:number)=>{const f=Math.max(0,Math.min(1,(t-a)/(b-a)));return f*f*(3-2*f);};
    this.animation.present((owner,row)=>{
      const open=smooth(this.opening.value.x,this.opening.value.x+2,tick)*this.opening.value.y;
      const angle=open*PARTS[row]![7]*(-Math.PI*.56);
      owner.values[0]=open;owner.values[1]=(1-smooth(this.times.value.x,this.times.value.y,tick))*POD_RESCUE_FALL_HEIGHT;
      owner.values[2]=Math.cos(angle);owner.values[3]=Math.sin(angle);
    });
  }

  setTexturesEnabled(enabled:boolean):void {
    if(enabled===this.texturesEnabled)return;
    this.texturesEnabled=enabled;
    this.mesh.material=enabled?this.painted:this.plain;this.syncContours();
  }

  prepareForCompile():()=>void {
    const mesh=this.mesh,visible=mesh.visible,culled=mesh.frustumCulled,count=mesh.activeCount;
    const revision=this.revision,buffer=mesh.instanceMatrix;
    const first=count===0?buffer.array.slice(0,16):undefined;
    if(first){buffer.array.fill(0,0,16);buffer.array[15]=1;buffer.needsUpdate=true;mesh.activeCount=1;}
    const version=buffer.version;
    mesh.visible=true;mesh.frustumCulled=false;this.syncContours();
    return()=>{
      mesh.frustumCulled=culled;
      if(mesh.instanceMatrix!==buffer||buffer.version!==version)return;
      // Restoring the temporary matrix is safe after a uniform-only adoption;
      // its latest visibility/count must still win over the preparation state.
      if(first){buffer.array.set(first,0);buffer.needsUpdate=true;}
      if(this.revision===revision){mesh.activeCount=count;mesh.visible=visible;}
      this.syncContours();
    };
  }

  dispose():void {
    this.contour?.dispose();
    this.animation.dispose();
    this.mesh.removeFromParent();this.mesh.dispose();this.base.dispose();
    this.plain.dispose();this.painted.dispose();this.paint.dispose();this.group.clear();
  }
}
