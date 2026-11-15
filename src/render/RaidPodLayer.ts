import * as THREE from 'three/webgpu';
import { Fn,attribute,cos,float,mat4,normalLocal,positionLocal,sin,smoothstep,texture,transformNormal,uniform,uv,vec3 } from 'three/tsl';
import type { World } from '../sim/types';
import type { RaidPod333 } from '../sim/raid-arrival-333';
import { BoxMesh } from './BoxMesh';
import { material } from './primitives';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { instancedBoxPatternUv } from './texture-variation';
import {currentGraphicsStyle} from './graphics-style';
import {OwnedStrokeModel} from './surfaces/OwnedStrokeModel';
import {naturalStroke} from './surfaces/NaturalSurfaceModels';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';

/** At most one pod a raider: 10 000 points of the cheapest Core fighter. */
export const RAID_POD_CAPACITY=300;
export const RAID_POD_PARTS=6;
export const RAID_POD_HEIGHT=24;
export const RAID_POD_OPENING_TICKS=3;
// Hostile capsule: dark rust shell, banded ends, hinged lids. Every pod uses
// these six resident pieces; the raider inside is never drawn.
const PARTS=[
  [0,.38,0,1.04,.68,1.82,0x7d5a4c,0],
  [0,.40,-.66,1.10,.72,.13,0x4f4440,0],
  [0,.40,.66,1.10,.72,.13,0x4f4440,0],
  [0,.055,0,1.12,.11,1.90,0x3d4649,0],
  [-.27,.79,0,.54,.16,1.90,0xb39a80,-1],
  [.27,.79,0,.54,.16,1.90,0xb39a80,1],
] as const;

/** Read-only projection of the active raid's schema 333 drop pods. Rows
 * change only when a pod is launched, opens or retires; the fall and the
 * lids follow the shared confirmed tick on the GPU. */
export class RaidPodLayer {
  readonly group=new THREE.Group();
  readonly mesh:BoxMesh;
  readonly tick=uniform(0);
  private readonly surfaceModel=new OwnedStrokeModel(new THREE.BoxGeometry(1,1,1));
  private readonly paint=createStylizedSurfaceTexture();
  private readonly plain=material(0xffffff,{transparent:true,depthWrite:false,forceSinglePass:true});
  private readonly painted=material(0xffffff,{transparent:true,depthWrite:false,forceSinglePass:true});
  private readonly place:THREE.InstancedBufferAttribute;
  private readonly clock:THREE.InstancedBufferAttribute;
  private key='';
  private revision=0;
  private confirmedTick=0;
  private retireAt:number|undefined;
  private texturesEnabled=true;

  constructor(configure?:(surface:THREE.MeshStandardNodeMaterial)=>void){
    // place: cell x, cell z, yaw, launch tick; clock: landing tick, actual
    // opening tick or -1 while closed (local ticks, fractional).
    const place=attribute('raidPodPlace','vec4'),clock=attribute('raidPodClock','vec2');
    const opened=clock.y.greaterThanEqual(0).select(1,0);
    const open=smoothstep(clock.y,clock.y.add(RAID_POD_OPENING_TICKS),this.tick).mul(opened);
    const fall=float(1).sub(smoothstep(place.w,clock.x.max(place.w.add(.001)),this.tick)).mul(RAID_POD_HEIGHT);
    const shown=this.tick.greaterThanEqual(place.w).select(1,0);
    const angle=open.mul(-Math.PI*.56),cosA=cos(angle),sinA=sin(angle),cy=cos(place.z),sy=sin(place.z);
    const position=Fn(()=>{
      const transform=mat4(attribute('boxMatrix0','vec4'),attribute('boxMatrix1','vec4'),attribute('boxMatrix2','vec4'),attribute('boxMatrix3','vec4')).toVar();
      const side=attribute('raidPodLidSide','float'),c=float(1).add(cosA.sub(1).mul(side.mul(side))),s=sinA.mul(side);
      const hinge=vec3(side.mul(.54),.79,0),local=transform.mul(positionLocal).xyz.sub(hinge);
      const point=vec3(local.x.mul(c).sub(local.y.mul(s)),local.x.mul(s).add(local.y.mul(c)),local.z).add(hinge);
      const normal=transformNormal(normalLocal,transform),hinged=vec3(normal.x.mul(c).sub(normal.y.mul(s)),normal.x.mul(s).add(normal.y.mul(c)),normal.z);
      normalLocal.assign(vec3(hinged.x.mul(cy).add(hinged.z.mul(sy)),hinged.y,hinged.z.mul(cy).sub(hinged.x.mul(sy))));
      return vec3(point.x.mul(cy).add(point.z.mul(sy)).add(place.x),point.y.add(fall),point.z.mul(cy).sub(point.x.mul(sy)).add(place.y));
    })();
    for(const surface of [this.plain,this.painted]){
      configure?.(surface);surface.userData.rendererOwned=true;surface.positionNode=position;
      surface.colorNode=attribute('boxColor','vec3');surface.opacityNode=float(1).sub(open).mul(shown);
    }
    this.painted.colorNode=attribute('boxColor','vec3').mul(texture(this.paint,instancedBoxPatternUv()).rgb);
    const capacity=RAID_POD_CAPACITY*RAID_POD_PARTS;
    this.mesh=new BoxMesh(this.surfaceModel.geometry,this.painted,capacity);this.mesh.name='raid-drop-pods';
    this.mesh.castShadow=true;this.mesh.receiveShadow=true;
    this.place=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4);
    this.clock=new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2);
    const sides=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);
    this.mesh.geometry.setAttribute('raidPodPlace',this.place);this.mesh.geometry.setAttribute('raidPodClock',this.clock);this.mesh.geometry.setAttribute('raidPodLidSide',sides);
    const object=new THREE.Object3D(),color=new THREE.Color();
    for(let pod=0;pod<RAID_POD_CAPACITY;pod++)PARTS.forEach(([x,y,z,sx,sy,sz,tint,side],part)=>{
      const index=pod*RAID_POD_PARTS+part;
      object.position.set(x,y,z);object.scale.set(sx,sy,sz);object.updateMatrix();
      this.mesh.setMatrixAt(index,object.matrix);this.mesh.setColorAt(index,color.setHex(tint));sides.setX(index,side);
    });
    this.mesh.instanceMatrix.needsUpdate=this.mesh.colorBuffer.needsUpdate=sides.needsUpdate=true;
    this.mesh.activeCount=0;this.group.add(this.mesh);
    const context=currentGraphicsStyle();
    this.painted.roughness=.88;this.painted.metalness=.02;
    applySharedPaintSurface(this.painted,{context,base:attribute('boxColor','vec3'),pastel:this.painted.colorNode as THREE.Node<'vec3'>,faceUv:uv(),stroke:naturalStroke(context,this.surfaceModel.stroke)});
  }

  /** Renderer-only preview callers must synchronize after writing instance streams. */
  syncContours():void {}

  get visiblePods():number {return this.mesh.activeCount/RAID_POD_PARTS;}

  /** True when the drawn rows changed. */
  adopt(world:World):boolean {
    try{return this.adoptBody(world);}finally{this.syncContours();}
  }
  private adoptBody(world:World):boolean {
    this.confirmedTick=world.tick;
    // Every home raid group (schema 341: several may fall at once) with its own arrival clock.
    const groups=[...world.raids?.active?[world.raids.active]:[],...(world.raids?.extraActive261??[]).filter(g=>g.concurrent341===true)];
    // A pod is drawn while falling, closed, or during its opening receipt.
    const rows:RaidPod333[]=[],arrivedAt:number[]=[];
    for(const group of groups){const arrival=group.arrival333;
      for(const pod of arrival?.pods??[])if(pod.openedAtCore===undefined||world.tick<pod.openedAtCore/10+RAID_POD_OPENING_TICKS)if(rows.length<RAID_POD_CAPACITY){rows.push(pod);arrivedAt.push(arrival!.atCore);}}
    const key=rows.length?rows.map((p,i)=>`${arrivedAt[i]}:${p.pawnId}:${p.cell.x}:${p.cell.z}:${p.landAtCore}:${p.openedAtCore??-1}`).join('|'):'';
    if(key===this.key)return false;
    this.key=key;
    if(!rows.length){this.retireAt=undefined;if(!this.mesh.activeCount)return false;this.mesh.activeCount=0;this.revision++;return true;}
    this.revision++;
    this.retireAt=rows.length&&rows.every(p=>p.openedAtCore!==undefined)?Math.max(...rows.map(p=>p.openedAtCore!/10+RAID_POD_OPENING_TICKS)):undefined;
    this.mesh.boundingSphere.makeEmpty();
    rows.forEach((pod,row)=>{
      const yaw=((pod.pawnId*2654435761)>>>0)/0x100000000*Math.PI*2;
      for(let part=0;part<RAID_POD_PARTS;part++){const i=row*RAID_POD_PARTS+part;
        this.place.setXYZW(i,pod.cell.x,pod.cell.z,yaw,arrivedAt[row]!/10);this.clock.setXY(i,pod.landAtCore/10,pod.openedAtCore===undefined?-1:pod.openedAtCore/10);}
      this.mesh.boundingSphere.union(new THREE.Sphere(new THREE.Vector3(pod.cell.x,12.5,pod.cell.z),13.5));
    });
    this.place.needsUpdate=this.clock.needsUpdate=true;
    this.mesh.activeCount=rows.length*RAID_POD_PARTS;
    return true;
  }

  /** True when the last opening receipt retired. */
  present(tick:number,confirmedTick=this.confirmedTick):boolean {
    try{return this.presentBody(tick,confirmedTick);}finally{this.syncContours();}
  }
  private presentBody(tick:number,confirmedTick:number):boolean {
    if(!this.mesh.activeCount)return false;
    this.tick.value=Math.min(tick,confirmedTick);
    if(this.retireAt!==undefined&&this.tick.value>=this.retireAt){this.mesh.activeCount=0;this.retireAt=undefined;this.revision++;return true;}
    return false;
  }

  setTexturesEnabled(enabled:boolean):void {if(enabled!==this.texturesEnabled){this.texturesEnabled=enabled;this.mesh.material=enabled?this.painted:this.plain;this.syncContours();}}

  prepareForCompile():()=>void {
    const mesh=this.mesh,visible=mesh.visible,culled=mesh.frustumCulled,count=mesh.activeCount,revision=this.revision;
    const buffer=mesh.instanceMatrix,first=count===0?buffer.array.slice(0,16):undefined;
    if(first){buffer.array.fill(0,0,16);buffer.array[15]=1;buffer.needsUpdate=true;mesh.activeCount=1;}
    const version=buffer.version;mesh.visible=true;mesh.frustumCulled=false;this.syncContours();
    return()=>{
      mesh.frustumCulled=culled;if(mesh.instanceMatrix!==buffer||buffer.version!==version)return;
      if(first){buffer.array.set(first,0);buffer.needsUpdate=true;}
      if(this.revision===revision){mesh.activeCount=count;mesh.visible=visible;}
      this.syncContours();
    };
  }

  dispose():void {this.mesh.removeFromParent();this.mesh.dispose();this.surfaceModel.dispose();this.plain.dispose();this.painted.dispose();this.paint.dispose();this.group.clear();}
}
