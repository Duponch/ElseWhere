import * as THREE from 'three/webgpu';
import { Fn,attribute,float,mat4,normalLocal,positionLocal,smoothstep,texture,transformNormal,uniform,uv,vec3,vec4,instanceIndex,uint } from 'three/tsl';
import { ORBITAL_DELIVERY_LIMIT } from '../sim/orbital-state';
import type { World } from '../sim/types';
import { BoxMesh } from './BoxMesh';
import { material } from './primitives';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { instancedBoxPatternUv } from './texture-variation';
import type { AnimationDetail } from './AnimationDetail';
import { RetainedAnimation } from './RetainedAnimation';
import {currentGraphicsStyle} from './graphics-style';
import {OwnedStrokeModel} from './surfaces/OwnedStrokeModel';
import {naturalStroke} from './surfaces/NaturalSurfaceModels';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';

export const ORBITAL_CAPSULE_PARTS=6;
export const ORBITAL_CAPSULE_HEIGHT=24;
const PARTS=[
  [0,.37,0,1.04,.64,1.72,0x657f84,0],
  [0,.40,-.65,1.10,.72,.13,0xc0b48d,0],
  [0,.40,.65,1.10,.72,.13,0xc0b48d,0],
  [0,.055,0,1.12,.11,1.82,0x425c62,0],
  [-.27,.76,0,.54,.16,1.82,0xd0dcc4,-1],
  [.27,.76,0,.54,.16,1.82,0xd0dcc4,1],
] as const;

/** One resident batch for persisted cargo. Presentation never deposits items;
 * an obstructed opening keeps the capsule visible until simulation removes it. */
export class OrbitalDeliveryLayer {
  readonly group=new THREE.Group();
  readonly mesh:BoxMesh;
  readonly tick=uniform(0);
  private readonly surfaceModel=new OwnedStrokeModel(new THREE.BoxGeometry(1,1,1));
  private readonly base=this.surfaceModel.geometry;
  private readonly paint=createStylizedSurfaceTexture();
  private readonly plain=material(0xffffff);
  private readonly painted=material(0xffffff);
  private key='';
  private revision=0;
  private texturesEnabled=true;
  private readonly animation:RetainedAnimation;
  constructor(configure?:(material:THREE.MeshStandardNodeMaterial)=>void,detail?:AnimationDetail){
    this.animation=new RetainedAnimation(detail);
    const times=attribute('orbitalTimes','vec3');
    const falling=float(1).sub(smoothstep(times.x,times.y,this.tick)).mul(ORBITAL_CAPSULE_HEIGHT);
    const opening=smoothstep(times.y,times.z,this.tick);
    const sampled=this.animation.choose(()=>vec4(opening,falling,0,0),uint(instanceIndex.div(ORBITAL_CAPSULE_PARTS)));
    const position=Fn(()=>{
      const transform=mat4(attribute('boxMatrix0','vec4'),attribute('boxMatrix1','vec4'),attribute('boxMatrix2','vec4'),attribute('boxMatrix3','vec4')).toVar();
      normalLocal.assign(transformNormal(normalLocal,transform));
      return transform.mul(positionLocal).xyz.add(vec3(attribute('orbitalLid','float').mul(sampled.x).mul(.62),sampled.y,0));
    })();
    for(const surface of [this.plain,this.painted]){
      configure?.(surface);surface.userData.rendererOwned=true;surface.positionNode=position;
      surface.colorNode=attribute('boxColor','vec3');
    }
    this.painted.colorNode=attribute('boxColor','vec3').mul(texture(this.paint,instancedBoxPatternUv()).rgb);
    this.mesh=new BoxMesh(this.base,this.painted,ORBITAL_DELIVERY_LIMIT*ORBITAL_CAPSULE_PARTS);
    this.mesh.name='orbital-trade-capsules';this.mesh.castShadow=true;this.mesh.receiveShadow=true;
    const timingBuffer=new THREE.InstancedBufferAttribute(new Float32Array(ORBITAL_DELIVERY_LIMIT*ORBITAL_CAPSULE_PARTS*3),3);
    for(let i=0;i<timingBuffer.count;i++)timingBuffer.setXYZ(i,0,6,10);
    this.mesh.geometry.setAttribute('orbitalTimes',timingBuffer);
    this.mesh.geometry.setAttribute('orbitalLid',new THREE.InstancedBufferAttribute(new Float32Array(ORBITAL_DELIVERY_LIMIT*ORBITAL_CAPSULE_PARTS),1));
    this.mesh.activeCount=0;this.group.add(this.mesh);
    const context=currentGraphicsStyle();
    this.painted.roughness=.88;this.painted.metalness=.02;
    applySharedPaintSurface(this.painted,{context,base:attribute('boxColor','vec3'),pastel:this.painted.colorNode as THREE.Node<'vec3'>,faceUv:uv(),stroke:naturalStroke(context,this.surfaceModel.stroke)});
  }
  /** Renderer-only preview callers must synchronize after writing instance streams. */
  syncContours():void {}
  adopt(world:World):void {
    try{this.adoptBody(world);}finally{this.syncContours();}
  }
  private adoptBody(world:World):void {
    const deliveries=world.orbital?.pending??[];
    const key=deliveries.map(d=>`${d.id}:${d.cell.x}:${d.cell.z}:${d.createdAt}:${d.landAt}:${d.openAt}`).join('|');
    if(key===this.key)return;
    this.key=key;this.revision++;
    this.animation.reconcile(deliveries.map(d=>({id:d.id,x:d.cell.x,y:1,z:d.cell.z})));
    const object=new THREE.Object3D(),color=new THREE.Color();
    const times=this.mesh.geometry.getAttribute('orbitalTimes') as THREE.InstancedBufferAttribute;
    const lid=this.mesh.geometry.getAttribute('orbitalLid') as THREE.InstancedBufferAttribute;
    this.mesh.boundingSphere.makeEmpty();let index=0;
    for(const d of deliveries){
      for(const [x,y,z,sx,sy,sz,tint,side] of PARTS){
        object.position.set(d.cell.x+x,y,d.cell.z+z);object.scale.set(sx,sy,sz);object.updateMatrix();
        this.mesh.setMatrixAt(index,object.matrix);this.mesh.setColorAt(index,color.setHex(tint));
        times.setXYZ(index,d.createdAt,d.landAt,d.openAt);lid.setX(index,side);index++;
      }
      this.mesh.boundingSphere.union(new THREE.Sphere(new THREE.Vector3(d.cell.x,12.5,d.cell.z),13.5));
    }
    this.mesh.activeCount=index;this.mesh.instanceMatrix.needsUpdate=this.mesh.colorBuffer.needsUpdate=times.needsUpdate=lid.needsUpdate=true;
  }
  present(tick:number):void {
    this.tick.value=tick;if(!this.mesh.activeCount)return;
    const times=this.mesh.geometry.getAttribute('orbitalTimes');
    const smooth=(a:number,b:number,t:number)=>{const f=Math.max(0,Math.min(1,(t-a)/(b-a)));return f*f*(3-2*f);};
    this.animation.present((owner,row)=>{
      const slot=row*ORBITAL_CAPSULE_PARTS;
      owner.values[0]=smooth(times.getY(slot),times.getZ(slot),tick);
      owner.values[1]=(1-smooth(times.getX(slot),times.getY(slot),tick))*ORBITAL_CAPSULE_HEIGHT;
    });
  }
  setTexturesEnabled(enabled:boolean):void {
    if(enabled===this.texturesEnabled)return;this.texturesEnabled=enabled;this.mesh.material=enabled?this.painted:this.plain;this.syncContours();
  }
  prepareForCompile():()=>void {
    const mesh=this.mesh,visible=mesh.visible,culled=mesh.frustumCulled,count=mesh.activeCount,revision=this.revision;
    const buffer=mesh.instanceMatrix,first=count===0?buffer.array.slice(0,16):undefined;
    if(first){buffer.array.fill(0,0,16);buffer.array[0]=buffer.array[5]=buffer.array[10]=buffer.array[15]=1;buffer.needsUpdate=true;mesh.activeCount=1;}
    const version=buffer.version;mesh.visible=true;mesh.frustumCulled=false;this.syncContours();
    return()=>{
      mesh.frustumCulled=culled;
      if(mesh.instanceMatrix!==buffer||buffer.version!==version)return;
      if(first){buffer.array.set(first,0);buffer.needsUpdate=true;}
      if(this.revision===revision){mesh.activeCount=count;mesh.visible=visible;}
      this.syncContours();
    };
  }
  dispose():void {this.animation.dispose();this.mesh.removeFromParent();this.mesh.dispose();this.surfaceModel.dispose();this.plain.dispose();this.painted.dispose();this.paint.dispose();this.group.clear();}
}
