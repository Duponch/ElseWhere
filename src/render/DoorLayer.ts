import * as THREE from 'three/webgpu';
import { Fn, attribute, mat4, normalLocal, positionLocal, transformNormal, uniform, clamp, select, texture, uv, instanceIndex, uint } from 'three/tsl';
import { BoxMesh } from './BoxMesh';
import { material } from './primitives';
import { doorOrientations, doorMotionTicks, isRoomDoor, type DoorState } from '../sim/door-rules';
import type { World } from '../sim/types';
import { doorLeafColor, doorLeafPartsForStructure } from './door-parts';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { penBoundaryAxes } from './pen-parts';
import { InstanceTargetTint } from './instance-target-tint';
import type { AnimationDetail } from './AnimationDetail';
import { RetainedAnimation } from './RetainedAnimation';
import {currentGraphicsStyle} from './graphics-style';
import {OwnedStrokeModel} from './surfaces/OwnedStrokeModel';
import {naturalStroke} from './surfaces/NaturalSurfaceModels';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';
import {PreparedSurfaceOwner,PREPARED_SURFACE_VARIANT} from './origami/baked/surfaces/PreparedSurfaceOwner';
import {preparedNaturalModel,preparedDiagonalVariant} from './origami/baked/surfaces/PreparedSurfaceVariants';
import {canonicalPreparedSurfaceSource} from './origami/baked/surfaces/PreparedSurfaceSource';
import {SURFACE_STROKE_FACE,SURFACE_STROKE_UV} from './surfaces/NaturalSurfaceModels';
import type {PreparedSurfaceModel} from './origami/baked/surfaces/PreparedSurfaceTypes';
import {assertUnitBoxPaintGeometry,rigidBoxPaintInputs} from './surfaces/RigidBoxPaintUv';

const EMPTY_AXES:ReadonlyMap<number,0|1>=new Map();
const AUTODOOR_TINT=new THREE.Color(0xa6b7b4);

/** One retained leaf batch. TSL shares the pawn timeline; state uploads happen
 * on transitions, never as per-frame CPU transforms. Two segments preserve a
 * reversal while presentation is still behind the latest worker snapshot. */
export class DoorLayer {
  readonly group=new THREE.Group();
  readonly tick=uniform(0);
  private readonly surfaceModel=new OwnedStrokeModel(new THREE.BoxGeometry(1,1,1));
  private readonly base=this.surfaceModel.geometry;
  private readonly material=material(0xffffff);
  private readonly textured=material(0xffffff);
  private readonly paint=createStylizedSurfaceTexture();
  private texturesEnabled=true;
  readonly mesh:BoxMesh;
  private key='';
  private history=new Map<number,{current:DoorState;previous:DoorState}>();
  private readonly targetTint=new InstanceTargetTint();
  private readonly preparedSurfaces:PreparedSurfaceOwner|undefined;
  private readonly preparedModel:PreparedSurfaceModel|undefined;
  private readonly preparedSourceMaterial:THREE.MeshStandardNodeMaterial|undefined;
  preparedSurfaceStatus(){return this.preparedSurfaces?.status();}
  requestPreparedSurfaceQualityRoute(route:'source'|'prepared'|undefined):void{this.preparedSurfaces?.requestQualityRoute(route);}
  private readonly animation:RetainedAnimation;
  setTargetPreview(ids:ReadonlySet<number>):void {this.targetTint.setTargets(ids);}
  clearTargetPreview():void {this.targetTint.clear();}
  constructor(configure?: (material: THREE.MeshStandardNodeMaterial) => void,detail?:AnimationDetail) {
    this.animation=new RetainedAnimation(detail);
    configure?.(this.material);configure?.(this.textured);
    this.material.positionNode=Fn(()=>{
      const transform=mat4(attribute('boxMatrix0','vec4'),attribute('boxMatrix1','vec4'),attribute('boxMatrix2','vec4'),attribute('boxMatrix3','vec4')).toVar();
      normalLocal.assign(transformNormal(normalLocal,transform));
      const current=attribute('doorCurrent','vec4'),previous=attribute('doorPrevious','vec4');
      const amount=this.animation.scalar(()=>{
        const segment=select(this.tick.lessThan(current.x),previous,current);
        return clamp(segment.y.add(this.tick.sub(segment.x).mul(segment.z)),0,1);
      },uint(instanceIndex.div(2)));
      return transform.mul(positionLocal).xyz.add(attribute('doorShift','vec3').mul(amount));
    })();
    // Two carried leaves still use one draw. A narrow shaded centre joint on
    // each leaf suggests four wooden panels without extra geometry or uploads.
    const baseColor=attribute('boxColor','vec3').mul(select(positionLocal.x.abs().lessThan(.022),.77,1));
    this.material.colorNode=baseColor;
    this.textured.positionNode=this.material.positionNode;
    this.textured.colorNode=this.material.colorNode.mul(texture(this.paint,uv()).rgb);
    this.material.userData.rendererOwned=true;
    this.textured.userData.rendererOwned=true;
    this.mesh=new BoxMesh(this.base,this.textured,256);this.allocateAttributes(256);
    this.mesh.name='door-leaves';this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.group.add(this.mesh);
    const context=currentGraphicsStyle();
    this.textured.roughness=.88;this.textured.metalness=.02;
    assertUnitBoxPaintGeometry(this.base);const rigidPaint=context?rigidBoxPaintInputs(context,'rigidDoor'):undefined;
    const sourceOptions={context,base:baseColor,pastel:this.textured.colorNode as THREE.Node<'vec3'>,faceUv:rigidPaint?.faceUv??uv(),get pigmentUv(){return context&&!context.reliefEnabled&&!context.wearEnabled?rigidPaint?.pigmentUv:undefined;},stroke:naturalStroke(context,this.surfaceModel.stroke,undefined,undefined,true)};applySharedPaintSurface(this.textured,sourceOptions);
    if(context){this.preparedModel=preparedNaturalModel('door-unit-box-v1',this.base,this.surfaceModel.stroke);const source=canonicalPreparedSurfaceSource({key:'door-unit-box-v1',context,stroke:this.surfaceModel.stroke,bodyOptions:()=>sourceOptions,unitBodyProven:true,assertCurrent:()=>this.preparedModel!.assertCurrent()});this.preparedSurfaces=new PreparedSurfaceOwner({key:'door:'+this.group.uuid,context,source:()=>source,changed:()=>{}});this.preparedSourceMaterial=this.textured;this.textured=this.preparedSurfaces.addTarget({sourceMaterial:this.textured,pastelTexture:this.paint,pastelUv:uv(),pastelFromSample:sample=>baseColor.mul(sample.rgb),tint:baseColor,faceId:attribute(SURFACE_STROKE_FACE,'float'),chartUv:attribute(SURFACE_STROKE_UV,'vec2'),configure:m=>configure?.(m as THREE.MeshStandardNodeMaterial)}) as THREE.MeshStandardNodeMaterial;this.mesh.material=this.texturesEnabled?this.textured:this.material;}
  }
  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;
    this.mesh.material=enabled?this.textured:this.material;

  }
  private allocateAttributes(capacity:number):void {
    for(const [name,size] of [['doorCurrent',4],['doorPrevious',4],['doorShift',3],[PREPARED_SURFACE_VARIANT,1]] as const)this.mesh.geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.StaticDrawUsage));
  }
  // V299_NATIVE_DOOR_BEGIN
  // Central native admission owns these preparations; arguments do not grant it.
  updateNative(world:World,cutaway:boolean,reset:boolean,doors:ReadonlyArray<World['structures'][number]>,axes:ReadonlyMap<number,0|1>,gateAxes:ReadonlyMap<number,0|1>):void {
    if(reset){this.history.clear();this.key='';this.animation.reset();}
    const key=String(cutaway)+doors.map(s=>`${s.id}:${s.kind}:${s.material}:${s.x}:${s.z}:${(s.kind==='fence-gate'?gateAxes:axes).get(s.z*world.width+s.x)??0}:${s.door!.changedAt}:${s.door!.from}:${s.door!.open}:${doorMotionTicks(s)}`).join('|');
    if(key===this.key)return;this.key=key;this.targetTint.restore();
    const live=new Set(doors.map(s=>s.id));for(const id of this.history.keys())if(!live.has(id))this.history.delete(id);
    const count=doors.length*2;
    if(count>this.mesh.instanceMatrix.count){const capacity=2**Math.ceil(Math.log2(count));this.mesh.allocate(this.base,capacity);this.allocateAttributes(capacity);}
    const current=this.mesh.geometry.getAttribute('doorCurrent'),previous=this.mesh.geometry.getAttribute('doorPrevious'),shift=this.mesh.geometry.getAttribute('doorShift');
    const object=new THREE.Object3D(),color=new THREE.Color();
    let index=0;const targetIds:number[]=[],preparedIds=new Set<number>();
    for(const s of doors) {
      const d=s.door!,old=this.history.get(s.id),changed=!old||old.current.changedAt!==d.changedAt||old.current.from!==d.from||old.current.open!==d.open||doorMotionTicks({...s,door:old.current})!==doorMotionTicks(s);
      const pair=changed?{current:{...d},previous:old?.current??{...d}}:old!;this.history.set(s.id,pair);
      const gate=s.kind==='fence-gate',axis=(gate?gateAxes:axes).get(s.z*world.width+s.x)??0;
      const angle=axis*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle),leaves=doorLeafPartsForStructure(s,cutaway,axis);
      for(let sideIndex=0;sideIndex<2;sideIndex++) {
        const side=sideIndex===0?-1:1,leaf=leaves[sideIndex]!;
        object.position.set(leaf.x,leaf.y,leaf.z);object.rotation.set(0,angle,0);object.scale.set(leaf.sx!,leaf.sy!,leaf.sz!);object.updateMatrix();
        this.mesh.setMatrixAt(index,object.matrix);
        color.setHex(doorLeafColor(s.material));
        if(s.kind==='autodoor')color.lerp(AUTODOOR_TINT,.24);
        this.mesh.setColorAt(index,color);targetIds.push(s.id);if(this.preparedSurfaces&&this.preparedModel){const id=this.preparedSurfaces.registerVariant(preparedDiagonalVariant(this.preparedModel,leaf.sx!,leaf.sy!,leaf.sz!));this.mesh.geometry.getAttribute(PREPARED_SURFACE_VARIANT).setX(index,id);preparedIds.add(id);}
        for(const [attribute,state] of [[current,pair.current],[previous,pair.previous]] as const)attribute.setXYZW(index,state.changedAt,state.from,(state.open?1:-1)/doorMotionTicks({...s,door:state}),0);
        shift.setXYZ(index,side*.45*cos,0,-side*.45*sin);index++;
      }
    }
    this.preparedSurfaces?.setContribution(this.mesh,preparedIds);this.mesh.geometry.getAttribute(PREPARED_SURFACE_VARIANT).needsUpdate=true;
    this.mesh.activeCount=count;this.mesh.instanceMatrix.needsUpdate=this.mesh.colorBuffer.needsUpdate=true;
    for(const attribute of [current,previous,shift])attribute.needsUpdate=true;
    this.mesh.computeBoundingSphere();this.mesh.boundingSphere.radius+=.5;
    this.targetTint.setInstances(this.mesh.colorBuffer,targetIds);
    this.animation.reconcile(doors.map(s=>({id:s.id,x:s.x,y:1,z:s.z})));

  }
  // V299_NATIVE_DOOR_END

  update(world:World,cutaway:boolean,reset=false):void {
    if(reset){this.history.clear();this.key='';this.animation.reset();}
    const doors=world.structures.filter(s=>isRoomDoor(s.kind)||s.kind==='fence-gate');
    const axes=doors.some(s=>isRoomDoor(s.kind))?doorOrientations(world):EMPTY_AXES;
    const gateAxes=doors.some(s=>s.kind==='fence-gate')?penBoundaryAxes(world):EMPTY_AXES;
    const key=String(cutaway)+doors.map(s=>`${s.id}:${s.kind}:${s.material}:${s.x}:${s.z}:${(s.kind==='fence-gate'?gateAxes:axes).get(s.z*world.width+s.x)??0}:${s.door!.changedAt}:${s.door!.from}:${s.door!.open}:${doorMotionTicks(s)}`).join('|');
    if(key===this.key)return;this.key=key;this.targetTint.restore();
    const live=new Set(doors.map(s=>s.id));for(const id of this.history.keys())if(!live.has(id))this.history.delete(id);
    const count=doors.length*2;
    if(count>this.mesh.instanceMatrix.count){const capacity=2**Math.ceil(Math.log2(count));this.mesh.allocate(this.base,capacity);this.allocateAttributes(capacity);}
    const current=this.mesh.geometry.getAttribute('doorCurrent'),previous=this.mesh.geometry.getAttribute('doorPrevious'),shift=this.mesh.geometry.getAttribute('doorShift');
    const object=new THREE.Object3D(),color=new THREE.Color();
    let index=0;const targetIds:number[]=[],preparedIds=new Set<number>();
    for(const s of doors) {
      const d=s.door!,old=this.history.get(s.id),changed=!old||old.current.changedAt!==d.changedAt||old.current.from!==d.from||old.current.open!==d.open||doorMotionTicks({...s,door:old.current})!==doorMotionTicks(s);
      const pair=changed?{current:{...d},previous:old?.current??{...d}}:old!;this.history.set(s.id,pair);
      const gate=s.kind==='fence-gate',axis=(gate?gateAxes:axes).get(s.z*world.width+s.x)??0;
      const angle=axis*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle),leaves=doorLeafPartsForStructure(s,cutaway,axis);
      for(let sideIndex=0;sideIndex<2;sideIndex++) {
        const side=sideIndex===0?-1:1,leaf=leaves[sideIndex]!;
        object.position.set(leaf.x,leaf.y,leaf.z);object.rotation.set(0,angle,0);object.scale.set(leaf.sx!,leaf.sy!,leaf.sz!);object.updateMatrix();
        this.mesh.setMatrixAt(index,object.matrix);
        color.setHex(doorLeafColor(s.material));
        if(s.kind==='autodoor')color.lerp(AUTODOOR_TINT,.24);
        this.mesh.setColorAt(index,color);targetIds.push(s.id);if(this.preparedSurfaces&&this.preparedModel){const id=this.preparedSurfaces.registerVariant(preparedDiagonalVariant(this.preparedModel,leaf.sx!,leaf.sy!,leaf.sz!));this.mesh.geometry.getAttribute(PREPARED_SURFACE_VARIANT).setX(index,id);preparedIds.add(id);}
        for(const [attribute,state] of [[current,pair.current],[previous,pair.previous]] as const)attribute.setXYZW(index,state.changedAt,state.from,(state.open?1:-1)/doorMotionTicks({...s,door:state}),0);
        shift.setXYZ(index,side*.45*cos,0,-side*.45*sin);index++;
      }
    }
    this.preparedSurfaces?.setContribution(this.mesh,preparedIds);this.mesh.geometry.getAttribute(PREPARED_SURFACE_VARIANT).needsUpdate=true;
    this.mesh.activeCount=count;this.mesh.instanceMatrix.needsUpdate=this.mesh.colorBuffer.needsUpdate=true;
    for(const attribute of [current,previous,shift])attribute.needsUpdate=true;
    this.mesh.computeBoundingSphere();this.mesh.boundingSphere.radius+=.5;
    this.targetTint.setInstances(this.mesh.colorBuffer,targetIds);
    this.animation.reconcile(doors.map(s=>({id:s.id,x:s.x,y:1,z:s.z})));

  }
  present(tick:number):void {
    this.tick.value=tick;
    if(!this.mesh.activeCount)return;
    const current=this.mesh.geometry.getAttribute('doorCurrent'),previous=this.mesh.geometry.getAttribute('doorPrevious');
    this.animation.present((owner,row)=>{
      const slot=row*2,segment=tick<current.getX(slot)?previous:current;
      owner.values[0]=Math.max(0,Math.min(1,segment.getY(slot)+(tick-segment.getX(slot))*segment.getZ(slot)));
    });
  }
  prepareForCompile():()=>void {
    if(this.mesh.activeCount)return ()=>{};
    const version=this.mesh.instanceMatrix.version;this.mesh.activeCount=1;
    return ()=>{if(this.mesh.instanceMatrix.version===version)this.mesh.activeCount=0;};
  }
  dispose():void {this.preparedSurfaces?.attachGpuRetirement([this.mesh.geometry]);this.preparedSurfaces?.dispose();this.animation.dispose();this.targetTint.dispose();this.mesh.dispose();this.surfaceModel.dispose();this.material.dispose();if(this.preparedSourceMaterial)this.preparedSourceMaterial.dispose();else this.textured.dispose();this.paint.dispose();}
}
