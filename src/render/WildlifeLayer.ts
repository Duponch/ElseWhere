import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import type {CoreActorScene297} from '../bridge/core-phase-projection-297';
import {ActorPlayback435} from './ActorPlayback435';
import {arrivalRotationYaw256} from '../sim/arrival-rotation-256';
import {actorExplorationMaterial256} from './ExplorationMask256';
import {isAnimalSpecies256} from '../sim/animal-core-v256';
import { attachedFireMesh,presentAttachedFire, setFireTexturesEnabled } from './FireLayer';
import { AnimationDetail } from './AnimationDetail';
import {ActorAnimationCache,sampleActorRoot} from './ActorAnimationCache';
import {PawnTweener297} from './PawnTweener297';
import {sampleAnimalRig} from './actor-animation-sampling';
import * as THREE from 'three/webgpu';
import {currentGraphicsStyle,withGraphicsStyle,GraphicsStyleContext} from './graphics-style';
import {AnimalModels,ANIMAL_SURFACE_PROFILE_STRIDE,type AnimalModel} from './models/AnimalModels';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';
import {faceStrokeVertexHeaders,attachFaceStrokeGpuRetirement,createFaceStrokeNode} from './surfaces/FaceStrokeTable';
import {commonAnimalPresentationGeometry} from './origami/animal-geometry';
import {ActorPartUnionIndex,readAnimalPartUnion} from './origami/actor-part-union';
import { coreTimeSeconds,localTimeSeconds } from '../bridge/clock-rate';
import { Fn,If,attribute,cos,sin,float,instanceIndex,normalLocal,positionLocal,uv,vec3,vec4,varying,uniform,renderGroup,mix,texture } from 'three/tsl';
import { animalParts } from './animal-shape';
import { material } from './primitives';
import { pawnPresentationPose } from './pawn-presentation';
import { headingAt,turnToward,TURN_TICKS,type TurnHeading } from './turn-presentation';
import { TICKS_PER_SECOND,type World } from '../sim/types';
import { MAX_WILDLIFE } from '../sim/wildlife-state';
import type { MotionTimeline } from './MotionTimeline';
import { furnitureSurfaces } from './furniture-motion';
import { travelHeight } from './furniture-motion';
import { pawnSelectionMesh } from './PawnSelectionLayer';
import { animalCoat,createAnimalCoatTexture } from './animal-surface-paint';
import { ANIMAL_SPECIES_IDS } from '../sim/animal-species';
import { GaitPhaseTracker,animalGaitRadiansPerUnit } from './gait-presentation';
import { bodyBloodPigment,bodyBloodWord } from './body-blood';
import { corpseVisualMask } from './corpse-presentation';
import { corpsePartAbsent } from '../sim/corpse-anatomy';
import { autoSlaughterTargets } from '../sim/auto-slaughter';
import {wildlifePresentationGroups,type VisualAnimal} from './wildlife-presentation-groups';
import type { PawnLayer } from './PawnLayer';
import {animalSlaughterMarker,AnimalSlaughterMarkerStyle} from './AnimalSlaughterMarker';
import type {SceneTextureLoader} from './scene-render-ports';
import { growPawnBuffers } from './pawn-buffers';
import {WildlifeBodyScale,WildlifeFrameState} from './wildlife-frame-state';
import { pileSurfaces,pileIdentitySurfaces,type PileSurface } from './pile-surfaces';
import { PAWN_MODEL_SCALE,WORLD_SCALE } from '../world/scale';

export type AnimalGraphicsComparisonState=readonly[species:string,geometry:string,material:string,flags:number];
/** Measurement identity only. Layouts/byte counts remain in bakedStatus, outside
 * the per-submission comparator. UUIDs distinguish an equally shaped new owner. */
export function animalGraphicsComparisonState(species:string,mesh:Pick<THREE.Mesh,'geometry'|'material'>,active:boolean,textures:boolean,blood:boolean,sourceMaterial:THREE.Material,ribbonsVisible:boolean,binding?:{geometry:THREE.BufferGeometry;material:THREE.Material}):AnimalGraphicsComparisonState {
  const material=Array.isArray(mesh.material)?mesh.material.map(value=>value.uuid).join(','):mesh.material.uuid;
  const flags=(active?1:0)|(textures?2:0)|(binding?4:0)|(blood?8:0)
    |(binding&&mesh.geometry===binding.geometry?16:0)|(binding&&mesh.material===binding.material?32:0)
    |(mesh.material===sourceMaterial?64:0)|(ribbonsVisible?128:0)|(binding?.material.userData.origamiBakedBloodFree===true?256:0);
  return[species,mesh.geometry.uuid,material,flags];
}
/** Resident capacity and node graph. CPU supplies edges/phases at snapshots
 * and segment boundaries; continuous translation and the rig run on the GPU. */
class SpeciesRig {
  readonly mesh:THREE.Mesh;
  readonly flames:THREE.Mesh;
  readonly selection:THREE.Mesh;
  readonly slaughter:THREE.Mesh;
  readonly plainMaterial:THREE.MeshStandardNodeMaterial;
  readonly texturedMaterial:THREE.MeshStandardNodeMaterial;
  origamiWear?:THREE.Mesh;
  private origamiGraphics?:GraphicsStyleContext;
  private texturesEnabled=true;
  private readonly sharedModel:AnimalModel;
  /** A capacity replacement might never be drawn before closure. Retain the
   * old, potentially initialized body so final storage retirement can use its
   * real geometry listener; a never-rendered replacement cannot provide it. */
  private readonly retiredSurfaceGeometries:THREE.BufferGeometry[]=[];
  private wearCleanup:(()=>void)|undefined;
  private releaseFeatureRefresh:(()=>void)|undefined;
  private readonly origamiPartUnions:ActorPartUnionIndex[]=[];
  readonly animationCache:ActorAnimationCache;
  private readonly sampledBones:readonly number[];
  private readonly carrierSlots=new Map<number,number>();
  private readonly actorSlots=new Map<number,number>();
  private readonly animationRoot={x:0,y:0,z:0,yaw:0};
  private readonly linkedRoot={x:0,y:0,z:0,yaw:0};
  private selected:ReadonlySet<number>=new Set();
  readonly blend=uniform(1).setGroup(renderGroup);private time=uniform(0).setGroup(renderGroup);
  private readonly keys=new WildlifeFrameState();private readonly bodyScale=new WildlifeBodyScale();private source:World|undefined;
  private readonly phaseIndices297=new Map<number,number>();
  private readonly rootTweener297=new PawnTweener297();
  private springCapacity297=0;
  private rawFrom297=new THREE.BufferAttribute(new Float32Array(0),4);
  private rawTo297=new THREE.BufferAttribute(new Float32Array(0),4);
  private rawTravel297=new THREE.BufferAttribute(new Float32Array(0),4);
  private springValid297=new Uint8Array(0);
  private springReset297=new Uint8Array(0);
  private springActive297=new Uint8Array(0);
  private springGait297=new Float32Array(0);
  private springSeed297=new Float32Array(0);
  private readonly springTarget297={x:0,y:0,z:0,yaw:0};
  private readonly playback435=new ActorPlayback435<VisualAnimal>(animal=>animal.carrierId!==undefined||!!animal.corpsePile&&animal.corpsePile.owner.type!=='ground');
  playbackMetrics435(){return this.playback435.snapshot();}
  clearPlayback435():void{this.playback435.clear();}
  private headings=new Map<number,TurnHeading>();
  private readonly gait=new GaitPhaseTracker();
  private readonly gaitRate:number;
  private readonly restingHeight:number;
  private readonly restingRadius:number;
  private animals:VisualAnimal[]=[];
  private revision=0;
  private hasFireActors=false;
  private surfaces:ReadonlyMap<number,number>=new Map();
  constructor(readonly travelTime:WildlifeLayer['travelTime'],readonly species:string,surfaceTexture:THREE.Texture,style:AnimalSlaughterMarkerStyle,private readonly animationDetail:AnimationDetail,configure:((m:THREE.MeshStandardNodeMaterial)=>void)|undefined,models:AnimalModels) {
    this.animationCache=new ActorAnimationCache(animationDetail);
    this.gaitRate=animalGaitRadiansPerUnit(species);
    const graphics=currentGraphicsStyle();if(!graphics)throw Error('Animal surfaces require their actual scene texture context');this.origamiGraphics=graphics;
    const model=models.get(species);this.sharedModel=model;const geometry=model.instantiate(isAnimalSpecies256(species)?16:MAX_WILDLIFE);
    geometry.userData.animationCache=this.animationCache;
    const part=geometry.getAttribute('animalPart');this.sampledBones=[...new Set(Array.from({length:part.count},(_,i)=>part.getX(i)))].sort((a,b)=>a-b);
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox!;
    // A live sleeper or downed animal rolls onto its side around the trunk.
    // The full bind-space width sets its floor and height; no axis is crushed.
    const restFloor=.025-bounds.min.x,bodyCenter=geometry.userData.origamiBodyCenter??animalParts(species)[0]!.center[1];
    this.restingHeight=bounds.max.x+restFloor;
    this.restingRadius=Math.max(Math.abs(bodyCenter-bounds.min.y),Math.abs(bodyCenter-bounds.max.y),Math.abs(bounds.min.z),Math.abs(bounds.max.z))+.1;
    const mat=material(0xffffff);configure?.(actorExplorationMaterial256(mat));
    // The packed paint word replaces the original RGB input in this pipeline;
    // the CPU color alias must never consume a second vertex attribute slot.
    const paint=attribute('animalPaint','vec4'),baseColor=paint.rgb;
    // Both texture encodings share ONE named clinical bind stream. Anonymous
    // varyings constructed inside each lazy pigment Fn multiply when its
    // branch is expanded by the pinned builder (as already handled for humans).
    const bloodBind=varying(vec4(attribute('position','vec3'),attribute('animalPart','vec4').z),'v_animalBloodBind');
    const withBlood=(base:THREE.Node<'vec3'>)=>bodyBloodPigment(base,bloodBind.w,species==='hare'||species==='snow-hare'?2:1,attribute('animalPart','vec4').w.lessThan(0).select(float(1),float(0)),attribute('aBiology','vec3').y,bloodBind);
    mat.vertexColors=false;mat.colorNode=withBlood(baseColor);
    mat.roughness=.88;mat.metalness=.02;
    mat.positionNode=Fn(()=>{
      const cached=this.animationCache.cached().toVar();
      const pose=pawnPresentationPose(this,instanceIndex,cached),state=attribute('aAnimal','vec4'),part=attribute('animalPart','vec4'),biology=attribute('aBiology','vec3'),bone=part.x,pivot=attribute('bindPivot','vec3');
      // The fallback is the complete original rig. Retained phases are CPU
      // coefficients, so no second threshold or phase preparation runs here.
      const time=this.time,decorativeSin=(phase:THREE.Node<'float'>)=>sin(phase);
      const angle=float(0).toVar();
      const phase=float(0).toVar();
      If(cached.not(),()=>{
      phase.assign(state.w.add(pose.xz.sub(attribute('aFrom','vec4').xz).length().mul(this.gaitRate)));
      If(bone.equal(1),()=>{ angle.assign(decorativeSin(phase).mul(.5).mul(state.x)); });
      If(bone.equal(2),()=>{ angle.assign(decorativeSin(phase.add(Math.PI)).mul(.6).mul(state.x)); });
      If(bone.greaterThanEqual(3),()=>{
        const attack=sin(this.travelTime.sub(state.w).mul(10).clamp(0,Math.PI)).mul(.9);
        angle.assign(state.x.greaterThan(.5).select(decorativeSin(phase).mul(.06),
          state.y.greaterThan(1).select(attack,state.y.mul(decorativeSin(time.mul(5)).mul(.12).add(.48)))));
        If(state.x.lessThan(.5).and(state.y.lessThan(.5)).and(state.z.lessThan(.5)),()=>{
          angle.assign(decorativeSin(time.add(state.w)).mul(.03));
        });
        // The outer shell bends continuously into the head. Existing detail
        // pieces use bone 3 (full angle); shell vertices encode 4 + weight.
        If(bone.greaterThanEqual(4),()=>{ angle.mulAssign(bone.sub(4)); });
      });
      });
      const c=float(0).toVar(),s=float(0).toVar();
      If(cached,()=>{const cachedIndex=float(0).toVar();this.sampledBones.forEach((value,index)=>{If(bone.equal(value),()=>{cachedIndex.assign(index);});});const rotation=this.animationCache.cellAt(cachedIndex.add(8));c.assign(rotation.x);s.assign(rotation.y);}).Else(()=>{c.assign(cos(angle));s.assign(sin(angle));});
      const p=positionLocal.sub(pivot);
      const q=vec3(p.x,p.y.mul(c).sub(p.z.mul(s)),p.z.mul(c).add(p.y.mul(s))).add(pivot).toVar();
      const n=normalLocal.toVar();
      const normal=vec3(n.x,n.y.mul(c).sub(n.z.mul(s)),n.z.mul(c).add(n.y.mul(s))).toVar();
      If(state.z.greaterThan(.5),()=>{
        const x=q.x.toVar(),y=q.y.toVar(),nx=normal.x.toVar();
        q.x.assign(float(bodyCenter).sub(y));q.y.assign(x.add(restFloor));
        normal.x.assign(normal.y.negate());normal.y.assign(nx);
      });
      If(cached,()=>{q.y.addAssign(this.animationCache.cell(3).x);}).Else(()=>{q.y.addAssign(decorativeSin(phase).abs().mul(.08).mul(state.x));});
      If(state.x.lessThan(.5).and(state.y.lessThan(.5)).and(state.z.lessThan(.5)).and(bone.equal(0).or(bone.greaterThanEqual(3))),()=>{
        If(cached,()=>{q.y.addAssign(this.animationCache.cell(3).y);}).Else(()=>{q.y.addAssign(decorativeSin(time.add(state.w)).mul(.006));});
      });
      const bit=part.y,absent=biology.z;
      If(bit.greaterThan(0).and(absent.div(bit.max(1)).floor().mod(2).greaterThan(.5)),()=>{ q.assign(vec3(0)); });
      const eye=part.w;
      If(eye.greaterThanEqual(0).and(eye.notEqual(state.z.greaterThan(1.5).select(float(1),float(0)))),()=>{ q.assign(vec3(0)); });
      // Cargo uses the same confirmed carrier edge, pose and handoff as the
      // former proxy. Every owner still draws in this species' existing batch.
      const carrier=attribute('aCarrier','vec4'),transfer=attribute('aCorpseHandoff','vec2');
      const from=attribute('aCorpseFrom','vec4'),to=attribute('aCorpseTo','vec4');
      const held=vec3(q.x,q.y.sub(.16),q.z).mul(biology.x).add(vec3(0,0,WORLD_SCALE.carriedForward)).toVar();
      If(carrier.x.greaterThan(.5),()=>{
        const height=float(WORLD_SCALE.carriedHeight).toVar();
        If(cached,()=>{height.assign(this.animationCache.cell(3).z);}).Else(()=>{
        If(carrier.y.equal(1).or(carrier.y.equal(18)).or(carrier.y.equal(19)),()=>{ height.assign(.28); });
        // Match the carrier's exempt interaction pose and cargo exactly.
        If(carrier.y.greaterThan(1.5).and(carrier.y.lessThan(3.5)),()=>{ height.assign(sin(this.time.mul(4).add(carrier.z)).mul(.08).add(1.32)); });
        If(carrier.y.equal(3),()=>{ height.addAssign(WORLD_SCALE.stoolHeight-.605*PAWN_MODEL_SCALE); });
        If(carrier.y.equal(6),()=>{ height.assign(1.3); });
        });
        held.y.addAssign(height);
      });
      const cy=this.animationCache.yawNode(pose.w,'cos',instanceIndex,cached),sy=this.animationCache.yawNode(pose.w,'sin',instanceIndex,cached);
      normalLocal.assign(vec3(normal.x.mul(cy).add(normal.z.mul(sy)),normal.y,normal.z.mul(cy).sub(normal.x.mul(sy))).normalize());
      const grounded=vec3(q.x.mul(cy).add(q.z.mul(sy)),q.y,q.z.mul(cy).sub(q.x.mul(sy))).mul(biology.x).add(pose.xyz);
      const result=grounded.toVar();
      If(carrier.x.greaterThan(.5),()=>{ result.assign(vec3(held.x.mul(cy).add(held.z.mul(sy)),held.y,held.z.mul(cy).sub(held.x.mul(sy))).add(pose.xyz)); });
      If(transfer.y.abs().greaterThan(.0001),()=>{
        const progress=this.animationCache.clockNode(this.travelTime,'travelTime',instanceIndex,cached).sub(transfer.x).div(transfer.y.abs().sub(transfer.x).max(.001)).clamp(0,1);
        const smooth=progress.mul(progress).mul(float(3).sub(progress.mul(2)));
        const dc=cos(from.w),ds=sin(from.w);
        const start=vec3(q.x.mul(dc).add(q.z.mul(ds)),q.y,q.z.mul(dc).sub(q.x.mul(ds))).mul(biology.x).add(from.xyz);
        const ec=cos(to.w),es=sin(to.w);
        const end=vec3(q.x.mul(ec).add(q.z.mul(es)),q.y,q.z.mul(ec).sub(q.x.mul(es))).mul(biology.x).add(to.xyz);
        If(transfer.y.greaterThan(0),()=>{ result.assign(mix(start,result,smooth)); }).Else(()=>{ result.assign(mix(start,end,smooth)); });
        const startNormal=vec3(normal.x.mul(dc).add(normal.z.mul(ds)),normal.y,normal.z.mul(dc).sub(normal.x.mul(ds)));
        const endNormal=transfer.y.greaterThan(0).select(vec3(normal.x.mul(cy).add(normal.z.mul(sy)),normal.y,normal.z.mul(cy).sub(normal.x.mul(sy))),vec3(normal.x.mul(ec).add(normal.z.mul(es)),normal.y,normal.z.mul(ec).sub(normal.x.mul(es))));
        normalLocal.assign(mix(startNormal,endNormal,smooth).normalize());
      });
      return result;
    })();
    const textured=material(0xffffff);configure?.(actorExplorationMaterial256(textured));
    textured.positionNode=mat.positionNode;
    textured.roughness=.88;textured.metalness=.02;
    const surfaceUv=attribute('animalSurfaceUv','vec4'),word=paint.w,profile=word.mod(ANIMAL_SURFACE_PROFILE_STRIDE),faceId=word.div(ANIMAL_SURFACE_PROFILE_STRIDE).floor(),headers=faceStrokeVertexHeaders({table:model.strokes,faceId,enabled:graphics.surfaceEncoding.mul(graphics.lineOpacity),opacity:graphics.lineOpacity},'v_animalStrokeHeader');
    applySharedPaintSurface(textured,{context:graphics,base:baseColor,pastel:withBlood(baseColor).mul(texture(surfaceTexture,surfaceUv.zw).r.mul(.8).add(.28)),faceUv:surfaceUv.xy,profile,pigmentDomain:'game-static78',includeGeneric:true,gouacheTransform:withBlood,
      stroke:body=>createFaceStrokeNode(body,{table:model.strokes,faceId,headers,faceUv:surfaceUv.xy,enabled:graphics.surfaceEncoding.mul(graphics.lineOpacity),width:graphics.edgeWidth,irregularity:graphics.strokeImperfection,opacity:graphics.lineOpacity,brushColor:graphics.brushColor.rgb,samplePigment:(coordinates,dx,dy)=>graphics.sampleStrokePigment(coordinates,dx,dy),sampleDry:(coordinates,dx,dy)=>graphics.sampleStrokeDry(coordinates,dx,dy)})});
    this.plainMaterial=mat;this.texturedMaterial=textured;
    this.mesh=new THREE.Mesh(geometry,textured);this.mesh.name=`Wild ${this.species} — GPU rig`;this.mesh.frustumCulled=false;this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.flames=attachedFireMesh(this.mesh.geometry,this,.6,this.animationDetail);
    this.selection=pawnSelectionMesh(this.mesh.geometry as THREE.InstancedBufferGeometry,this);this.selection.visible=false;
    (this.selection.geometry as THREE.InstancedBufferGeometry).instanceCount=0;
    this.slaughter=animalSlaughterMarker(this.mesh.geometry as THREE.InstancedBufferGeometry,this,style,geometry.boundingBox!.max.y);
    this.mesh.visible=false;this.flames.visible=false;this.installOrigamiPartUnions();this.refreshWearEffect();this.releaseFeatureRefresh=graphics.trackSharedSurfaceRefresh(()=>this.refreshWearEffect());
  }
  private refreshWearEffect():void{
    const graphics=this.origamiGraphics!;
    if(!graphics.wearEnabled){
      if(this.origamiWear){
        const effect=this.origamiWear,release=this.wearCleanup,errors:unknown[]=[];this.origamiWear=undefined;this.wearCleanup=undefined;
        for(const close of [()=>this.clearOrigamiPartUnions(),()=>release?.(),()=>effect.removeFromParent(),()=>effect.geometry.dispose(),()=>(effect.material as THREE.Material).dispose()])try{close();}catch(e){errors.push(e);}
        // The canonical compiler drops its optional cached wear arrays when
        // asked for the bare model. Existing immutable body arrays stay live.
        let bare:THREE.InstancedBufferGeometry|undefined;
        try{bare=commonAnimalPresentationGeometry(1,this.species,false);}catch(e){errors.push(e);}
        if(bare)for(const resource of [bare,...['origamiLines','origamiWear'].map(key=>bare!.userData[key]).filter((g):g is THREE.BufferGeometry=>g instanceof THREE.BufferGeometry)])try{resource.dispose();}catch(e){errors.push(e);}
        this.installOrigamiPartUnions();this.refreshOrigamiPartUnion();if(errors.length)throw new AggregateError(errors,'Animal physical-wear retirement failed');
      }
      return;
    }
    if(this.origamiWear){
      const effect=this.origamiWear,material=effect.material as THREE.MeshStandardNodeMaterial,fresh=graphics.createWearMaterial(this.plainMaterial.positionNode,attribute('animalPaintUv','vec2'));
      try{material.colorNode=fresh.colorNode;material.opacityNode=fresh.opacityNode;material.normalNode=fresh.normalNode;material.positionNode=fresh.positionNode;}finally{fresh.dispose();}material.needsUpdate=true;graphics.refreshEdgeObject(effect,'wear');return;
    }
    const capacity=this.mesh.geometry.getAttribute('aFrom').count,temporary=commonAnimalPresentationGeometry(capacity,this.species,true);if(!temporary)throw Error('Actual animal wear model is absent');
    let geometry:THREE.InstancedBufferGeometry|undefined,material:THREE.MeshStandardNodeMaterial|undefined,releaseGeometry:(()=>void)|undefined,releaseObject:(()=>void)|undefined,effect:THREE.Mesh|undefined,attached=false;
    try{
      const wear=temporary.userData.origamiWear;if(!(wear instanceof THREE.InstancedBufferGeometry))throw Error('Actual animal physical-wear geometry missing');geometry=wear;
      for(const[name,a]of Object.entries(this.mesh.geometry.attributes))if(a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer)geometry.setAttribute(name,a);geometry.instanceCount=(this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount;geometry.userData.animationCache=this.animationCache;
      material=graphics.createWearMaterial(this.plainMaterial.positionNode,attribute('animalPaintUv','vec2'));actorExplorationMaterial256(material);material.maskNode=this.plainMaterial.maskNode;material.maskShadowNode=this.plainMaterial.maskShadowNode;
      effect=new THREE.Mesh(geometry,material);effect.name=`Wild ${this.species} — optional physical paint wear`;effect.frustumCulled=false;effect.castShadow=false;effect.receiveShadow=true;effect.userData.origamiTexturesEnabled=this.texturesEnabled;
      releaseGeometry=graphics.trackWearGeometry(geometry);releaseObject=graphics.trackEdgeObject(effect,'wear');this.origamiWear=effect;this.mesh.add(effect);this.installOrigamiPartUnions();this.refreshOrigamiPartUnion();
      const freeGeometry=releaseGeometry,freeObject=releaseObject;this.wearCleanup=()=>{try{freeObject();}finally{freeGeometry();}};attached=true;
    }finally{
      const errors:unknown[]=[];
      const cleanup=[()=>temporary.dispose(),()=>{const lines=temporary.userData.origamiLines;if(lines instanceof THREE.BufferGeometry)lines.dispose();}];
      if(!attached){this.origamiWear=undefined;cleanup.push(()=>releaseObject?.(),()=>releaseGeometry?.(),()=>effect?.removeFromParent(),()=>geometry?.dispose(),()=>material?.dispose(),()=>this.installOrigamiPartUnions(),()=>this.refreshOrigamiPartUnion());}
      for(const close of cleanup)try{close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Animal physical-wear preparation cleanup failed');
    }
  }
  get usesSharedSurface():boolean{return !!this.sharedModel;}
  sharedSurfaceStatus(){const model=this.sharedModel;return model?{species:this.species,modelKey:model.key,triangles:model.triangleCount,faces:model.strokes.faceCount,strokeEdges:model.strokes.edgeCount,tableBytes:model.strokes.cpuBytes,geometry:this.mesh.geometry.uuid,material:this.texturedMaterial.uuid,pipeline:'shared-paint',sourceRibbons:false}:undefined;}
  setTexturesEnabled(enabled:boolean):void {
    this.texturesEnabled=enabled;this.mesh.material=enabled?this.texturedMaterial:this.plainMaterial;setFireTexturesEnabled(this.flames,enabled);
    if(this.origamiWear){this.origamiWear.userData.origamiTexturesEnabled=enabled;this.origamiGraphics!.refreshEdgeObject(this.origamiWear,'wear');}
  }
  graphicsComparisonState(active:boolean):AnimalGraphicsComparisonState|undefined {
    if(!active)return undefined;const material=Array.isArray(this.mesh.material)?this.mesh.material.map(m=>m.uuid).join(','):this.mesh.material.uuid;
    return[this.species,this.mesh.geometry.uuid,material,(active?1:0)|(this.texturesEnabled?2:0)|4];
  }
  /** Static reference streams survive capacity growth; only the common actor
   * buffers are relinked to the newly grown resident allocation. */
  private syncOrigamiInstances():void {
    this.mesh.geometry.userData.animationCache=this.animationCache;
    for(const companion of [this.origamiWear])if(companion){
      companion.geometry.userData.animationCache=this.animationCache;
      for(const [name,attr] of Object.entries(this.mesh.geometry.attributes)){
        if(attr instanceof THREE.InstancedBufferAttribute||attr instanceof THREE.InterleavedBufferAttribute&&attr.data instanceof THREE.InstancedInterleavedBuffer)companion.geometry.setAttribute(name,attr);
      }
    }
    this.refreshOrigamiPartUnion();
  }
  private clearOrigamiPartUnions():void {const unions=this.origamiPartUnions.splice(0),errors:unknown[]=[];for(const union of unions)try{union.dispose();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Animal part-union retirement failed');}
  private installOrigamiPartUnions():void {
    this.clearOrigamiPartUnions();if(!this.mesh.geometry.userData.origamiReference)return;
    for(const geometry of [this.mesh.geometry,this.origamiWear?.geometry])if(geometry)this.origamiPartUnions.push(new ActorPartUnionIndex(geometry as THREE.InstancedBufferGeometry,'animal'));
  }
  private refreshOrigamiPartUnion():void {
    if(!this.origamiPartUnions.length)return;const body=this.mesh.geometry as THREE.InstancedBufferGeometry,state=readAnimalPartUnion(body,body.instanceCount);for(const union of this.origamiPartUnions)union.reconcile(state);
  }
  private setOrigamiCount(count:number):void {
    if(this.origamiWear)(this.origamiWear.geometry as THREE.InstancedBufferGeometry).instanceCount=count;
  }
  disposeOrigamiCompanions():void {
    this.clearOrigamiPartUnions();
    this.releaseFeatureRefresh?.();this.releaseFeatureRefresh=undefined;this.wearCleanup?.();this.wearCleanup=undefined;
    if(this.origamiWear){this.origamiWear.geometry.dispose();(this.origamiWear.material as THREE.Material).dispose();this.origamiWear.removeFromParent();this.origamiWear=undefined;}
  }
  retireSurfaceGeometryStorage():void {
    attachFaceStrokeGpuRetirement(this.sharedModel.strokes,[this.mesh.geometry,...this.retiredSurfaceGeometries]);
    for(const geometry of this.retiredSurfaceGeometries)geometry.dispose();
    this.retiredSurfaceGeometries.length=0;
  }
  setSelected(ids:ReadonlySet<number>):void {
    this.selected=ids;const geometry=this.selection.geometry as THREE.InstancedBufferGeometry,flags=geometry.getAttribute('aSelected') as THREE.InstancedBufferAttribute;
    geometry.instanceCount=this.animals.length;
    if(!ids.size&&!this.selection.visible)return;
    let any=false,changed=false;this.animals.forEach((a,i)=>{const enabled=ids.has(a.id),value=enabled?1:0;if(flags.getX(i)!==value){flags.setX(i,value);changed=true;}any||=enabled;});
    if(changed)flags.needsUpdate=true;this.selection.visible=any;
  }
  /** Read the same resident edges as the GPU, only on pointer gestures. */
  forEachPose(visit:(id:number,species:string,x:number,y:number,z:number,height:number,radius:number)=>void):void {
    const g=this.mesh.geometry,from=g.getAttribute('aFrom'),to=g.getAttribute('aTo'),times=g.getAttribute('aTravel'),state=g.getAttribute('aAnimal'),scale=g.getAttribute('aScale'),box=g.boundingBox!;
    const radius=Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2+.1;
    this.animals.forEach((a,i)=>{
      if(a.corpsePile)return;
      const start=times.getX(i),end=times.getY(i),alpha=end>start?THREE.MathUtils.clamp((this.travelTime.value-start)/(end-start),0,1):1;
      const growth=scale.getX(i),posture=state.getZ(i);
      const height=(posture>=1?this.restingHeight:box.max.y)*growth;
      const cached=this.animationCache.presentedRoot(i,from,to,times,this.travelTime.value,this.blend.value);
      visit(a.id,this.species,cached?.x??THREE.MathUtils.lerp(from.getX(i),to.getX(i),alpha),cached?.y??travelHeight(from.getY(i),to.getY(i),THREE.MathUtils.lerp(times.getZ(i),times.getW(i),alpha)),cached?.z??THREE.MathUtils.lerp(from.getZ(i),to.getZ(i),alpha),height,(posture>=1?this.restingRadius:radius)*growth);
    });
  }
  prepare():()=>void {
    const g=this.mesh.geometry as THREE.InstancedBufferGeometry,fire=this.flames.geometry as THREE.InstancedBufferGeometry;
    const marker=this.slaughter.geometry as THREE.InstancedBufferGeometry;
    const n=g.instanceCount,f=fire.instanceCount,s=marker.instanceCount,visible=this.slaughter.visible,bodyVisible=this.mesh.visible,fireVisible=this.flames.visible,revision=this.revision;
    const restoreUnions=this.origamiPartUnions.map(union=>union.prepareForCompile());
    g.instanceCount=Math.max(1,n);fire.instanceCount=Math.max(1,f);
    this.setOrigamiCount(g.instanceCount);
    marker.instanceCount=Math.max(1,s);this.slaughter.visible=true;this.mesh.visible=true;this.flames.visible=true;
    return ()=>{for(const restore of restoreUnions)restore();if(this.revision!==revision)return;g.instanceCount=n;this.setOrigamiCount(n);fire.instanceCount=f;marker.instanceCount=s;this.slaughter.visible=visible;this.mesh.visible=bodyVisible;this.flames.visible=fireVisible;};
  }
  deactivate():void {
    this.revision++;this.source=undefined;this.animals=[];this.hasFireActors=false;this.playback435.clear();
    this.keys.clear();this.headings.clear();this.gait.clear();this.carrierSlots.clear();this.actorSlots.clear();this.animationCache.reset();this.resetSpring297();
    for(const mesh of [this.mesh,this.flames,this.selection,this.slaughter]){(mesh.geometry as THREE.InstancedBufferGeometry).instanceCount=0;mesh.visible=false;}
    this.setOrigamiCount(0);
    this.refreshOrigamiPartUnion();
    const fire=this.mesh.geometry.getAttribute('aFire') as THREE.InstancedBufferAttribute;
    if(fire.getX(0)!==0){fire.setX(0,0);fire.needsUpdate=true;}
  }
  adoptPhase297(world:World,animals:readonly NonNullable<World['wildlife']>['animals'][number][]):void {
    const indices:number[]=[];
    for(const animal of animals){const i=this.phaseIndices297.get(animal.id);if(i===undefined)continue;this.animals[i]=animal;this.keys.invalidate(animal.id);indices.push(i);}
    this.source=world;this.playback435.adoptPhase297(world,this.animals,indices);
  }
  private ensureSpring297(count:number):void {
    if(count<=this.springCapacity297)return;const capacity=2**Math.ceil(Math.log2(Math.max(1,count)));
    const copy=(old:THREE.BufferAttribute)=>{const values=new Float32Array(capacity*4);values.set(old.array);return new THREE.BufferAttribute(values,4);};
    this.rawFrom297=copy(this.rawFrom297);this.rawTo297=copy(this.rawTo297);this.rawTravel297=copy(this.rawTravel297);
    const valid=new Uint8Array(capacity),reset=new Uint8Array(capacity),active=new Uint8Array(capacity),gait=new Float32Array(capacity),seed=new Float32Array(capacity);
    valid.set(this.springValid297);reset.set(this.springReset297);active.set(this.springActive297);gait.set(this.springGait297);seed.set(this.springSeed297);
    this.springValid297=valid;this.springReset297=reset;this.springActive297=active;this.springGait297=gait;this.springSeed297=seed;this.springCapacity297=capacity;this.rootTweener297.ensure(count);
  }
  private resetSpring297():void {this.rootTweener297.reset();this.springValid297.fill(0);this.springReset297.fill(1);this.springActive297.fill(0);this.springGait297.fill(0);}
  private captureSpring297(slot:number,from:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,to:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,travel:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,state:THREE.BufferAttribute|THREE.InterleavedBufferAttribute):void {
    this.rawFrom297.setXYZW(slot,from.getX(slot),from.getY(slot),from.getZ(slot),from.getW(slot));
    this.rawTo297.setXYZW(slot,to.getX(slot),to.getY(slot),to.getZ(slot),to.getW(slot));
    this.rawTravel297.setXYZW(slot,travel.getX(slot),travel.getY(slot),travel.getZ(slot),travel.getW(slot));
    this.springSeed297[slot]=state.getW(slot);this.springValid297[slot]=1;this.springActive297[slot]=1;
  }
  /** The same confirmed-root recurrence as humans. Original edge primitives
   * remain resident; only the displayed streams change. Idle settled roots
   * skip this path, and carrier/corpse streams never enter it. */
  private springPose297(slot:number,animal:VisualAnimal,dt:number,speed:number,from:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,to:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,travel:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,state:THREE.BufferAttribute|THREE.InterleavedBufferAttribute):boolean {
    if(!this.springValid297[slot]||!this.springActive297[slot])return false;
    const target=sampleActorRoot(this.rawFrom297,this.rawTo297,this.rawTravel297,slot,this.travelTime.value,this.blend.value,this.springTarget297);
    const pose=this.rootTweener297.advance(slot,animal.id,target.x,target.y,target.z,dt,speed,this.springReset297[slot]===1);this.springReset297[slot]=0;
    const stepping=state.getX(slot)>.5;let phase=this.rootTweener297.fresh?0:this.springGait297[slot]!;
    if(stepping&&speed>0){phase+=Math.hypot(this.rootTweener297.deltaX,this.rootTweener297.deltaZ)*this.gaitRate;if(phase>=Math.PI*2)phase%=Math.PI*2;}
    this.springGait297[slot]=phase;if(this.springGait297[slot]!>=Math.PI*2)this.springGait297[slot]=0;
    const shownPhase=stepping?this.springGait297[slot]!:this.springSeed297[slot]!,yaw=Math.fround(target.yaw);
    const changed=from.getX(slot)!==pose.x||from.getY(slot)!==pose.y||from.getZ(slot)!==pose.z||to.getX(slot)!==pose.x||to.getY(slot)!==pose.y||to.getZ(slot)!==pose.z||from.getW(slot)!==yaw||to.getW(slot)!==yaw||travel.getX(slot)!==0||travel.getY(slot)!==0||travel.getZ(slot)!==0||travel.getW(slot)!==2||state.getW(slot)!==shownPhase;
    from.setXYZW(slot,pose.x,pose.y,pose.z,yaw);to.setXYZW(slot,pose.x,pose.y,pose.z,yaw);travel.setXYZW(slot,0,0,0,2);state.setW(slot,shownPhase);
    const timed=this.rawTravel297.getY(slot)>this.rawTravel297.getX(slot)&&this.travelTime.value<this.rawTravel297.getY(slot);
    // No epsilon snap: retain the recurrence's actual Float32 terminal pose.
    if(!stepping&&speed>0&&dt>0&&!timed&&!changed)this.springActive297[slot]=0;
    return changed;
  }
  updateClock(tick:number,pawns?:PawnLayer):void {
    this.time.value=pawns?.time.value??localTimeSeconds(tick)%(2*Math.PI);this.blend.value=pawns?.blend.value??1;
  }
  update(world:World,group:VisualAnimal[],burning:ReadonlyMap<number,number>,timeline:MotionTimeline|undefined,surfaces:ReadonlyMap<number,number>,pileSurface:ReadonlyMap<number,PileSurface>,reset=false,pawns?:PawnLayer,quotaTargets:ReadonlySet<number>=new Set(),pileIdentities?:ReadonlyMap<number,PileSurface>,actorScene?:CoreActorScene297,dt297=0,speed297=0):boolean {
    const changed=this.source!==world;
    if(changed||reset)this.revision++;
    if(reset){this.headings.clear();this.keys.clear();this.gait.clear();this.resetSpring297();}
    if(changed){this.source=world;this.keys.clear();this.animals=group;this.phaseIndices297.clear();for(let i=0;i<group.length;i++)this.phaseIndices297.set(group[i]!.id,i);this.surfaces=surfaces;this.mesh.visible=group.length>0;
      if(this.animals.length>this.mesh.geometry.getAttribute('aFrom').count){this.clearOrigamiPartUnions();growPawnBuffers([this.mesh,this.flames,this.selection,this.slaughter],this.animals.length,(geometry,mesh)=>{if(mesh===this.mesh)this.retiredSurfaceGeometries.push(geometry);else geometry.dispose();});this.installOrigamiPartUnions();this.syncOrigamiInstances();}
      this.setSelected(this.selected);
      const markers=this.slaughter.geometry as THREE.InstancedBufferGeometry,flags=markers.getAttribute('aSlaughter') as THREE.InstancedBufferAttribute;
      let any=false,dirty=false;
      this.animals.forEach((animal,index)=>{const enabled=animal.state!=='dead'&&(animal.domestic?.slaughter===true||quotaTargets.has(animal.id)),value=enabled?1:0;
        if(flags.getX(index)!==value){flags.setX(index,value);dirty=true;}any||=enabled;});
      if(dirty)flags.needsUpdate=true;markers.instanceCount=this.animals.length;this.slaughter.visible=any;
      const present=new Set(this.animals.map(a=>a.id));for(const id of this.headings.keys())if(!present.has(id)){this.headings.delete(id);this.gait.delete(id);}
    }
    const tick=timeline?.tick??world.tick,origin=Math.floor(tick/1024)*1024;
    this.animationCache.setOrigins(origin);
    const g=this.mesh.geometry as THREE.InstancedBufferGeometry,from=g.getAttribute('aFrom') as THREE.InstancedBufferAttribute,to=g.getAttribute('aTo') as THREE.InstancedBufferAttribute,times=g.getAttribute('aTravel') as THREE.InstancedBufferAttribute,state=g.getAttribute('aAnimal') as THREE.InstancedBufferAttribute,scale=g.getAttribute('aScale') as THREE.InstancedBufferAttribute;
    if(changed){
    const fireSize=this.mesh.geometry.getAttribute('aFire') as THREE.InstancedBufferAttribute;
    const animals=this.animals;
    let fireCount=0;
    animals.forEach((a,i)=>{
      const size=burning.get(a.id);fireSize.setX(i,size===undefined?0:Math.max(.5,size));
      if(size!==undefined)fireCount=i+1;
    });if(!animals.length)fireSize.setX(0,0);fireSize.needsUpdate=true;
    // Keep actor indices intact while omitting every trailing inactive slot.
    (this.flames.geometry as THREE.InstancedBufferGeometry).instanceCount=fireCount;
    this.hasFireActors=fireCount>0;this.flames.visible=this.hasFireActors;
    }
    const animals=this.animals;g.instanceCount=animals.length;this.setOrigamiCount(animals.length);let dirty=false,springDirty=false;
    const spring=isCorePhysicalSchema297(Number(world.schemaVersion));if(spring)this.ensureSpring297(animals.length);
    this.playback435.prepare(world,animals,reset);const playback=this.playback435.beginFrame(timeline);if(this.playback435.retrying)this.keys.clear();
    if(changed||reset){this.carrierSlots.clear();if(reset)this.animationCache.reset();}
    animals.forEach((a,i)=>{
      // These bodies have equal endpoints and no local clocks or handoff.
      // New snapshots (even at the same tick), resets and transferred bodies
      // still refresh their complete primitives through the ordinary path.
      if(!changed&&!reset&&a.corpsePile?.owner.type==='ground'&&a.carrierId===undefined)return;
      const springActor=spring&&!a.corpsePile&&a.carrierId===undefined&&a.state!=='dead'&&a.state!=='downed';
      if(!springActor){this.springValid297[i]=0;this.springActive297[i]=0;this.springReset297[i]=1;}
      const prepared=playback?this.playback435.select(i,timeline,tick,origin):undefined;
      if(playback&&!prepared){if(springActor)springDirty=this.springPose297(i,a,dt297,speed297,from,to,times,state)||springDirty;return;}
      const blood=g.getAttribute('aBodyBlood'),absent=g.getAttribute('aAbsent'),carrierState=g.getAttribute('aCarrier'),transfer=g.getAttribute('aCorpseHandoff'),transferFrom=g.getAttribute('aCorpseFrom'),transferTo=g.getAttribute('aCorpseTo');
      const corpse=a.corpsePile?.corpse;
      if(corpse&&a.corpsePile){
        const pile=a.corpsePile,carrier=a.carrierId===undefined?undefined:pawns?.animalCorpseCarrier(a.carrierId);
        const held=pile.owner.type==='pawn',handoff=carrier?.handoff?.pile.corpse?.animalId===corpse.animalId?carrier.handoff:undefined;
        const source=carrier?.geometry,index=carrier?.index??0;
        if(held&&carrier)this.carrierSlots.set(i,index);else this.carrierSlots.delete(i);
        const sourceFrom=source?.getAttribute('aFrom'),sourceTo=source?.getAttribute('aTo'),sourceTravel=source?.getAttribute('aTravel'),motion=source?.getAttribute('aMotion');
        const same=this.keys.begin(a.id,1).value(origin).value(held).value(handoff?.start).value(handoff?.end)
          .stream(sourceFrom,index).stream(sourceTo,index).stream(sourceTravel,index).stream(motion,index).unchanged();
        if(same)return;dirty=true;
        const size=this.bodyScale.read(corpse);
        scale.setX(i,size);state.setXYZW(i,0,0,2,0);
        blood.setX(i,bodyBloodWord(corpse.health,part=>corpsePartAbsent(corpse,part)));absent.setX(i,corpseVisualMask(corpse));
        carrierState.setXYZW(i,held&&carrier?1:0,motion?.getZ(index)??0,motion?.getW(index)??0,0);
        if(held&&sourceFrom&&sourceTo&&sourceTravel){
          from.setXYZW(i,sourceFrom.getX(index),sourceFrom.getY(index),sourceFrom.getZ(index),sourceFrom.getW(index));
          to.setXYZW(i,sourceTo.getX(index),sourceTo.getY(index),sourceTo.getZ(index),sourceTo.getW(index));
          times.setXYZW(i,sourceTravel.getX(index),sourceTravel.getY(index),sourceTravel.getZ(index),sourceTravel.getW(index));
        }else{
          const surface=pile.owner.type==='ground'?pileIdentities?.get(pile.id)??pileSurface.get(pile.owner.z*world.width+pile.owner.x):undefined,yaw=corpse.facing??0;
          from.setXYZW(i,a.x+(surface?.x??0),surface?.y??0,a.z+(surface?.z??0),yaw);to.setXYZW(i,from.getX(i),from.getY(i),from.getZ(i),yaw);times.setXYZW(i,0,0,0,1);
          // A corpse keeps its biological proportions even on furniture.
        }
        if(handoff){
          transfer.setXY(i,localTimeSeconds(handoff.start,origin),(handoff.direction==='pickup'?1:-1)*localTimeSeconds(handoff.end,origin));
          const start=handoff.from,end=handoff.to;
          // Cargo anchors include the old proxy's +.15 ground origin and the
          // held proxy's -.16 bind offset; recover the full rig's floor.
          transferFrom.setXYZW(i,start.x,start.y-(handoff.direction==='pickup'?.15:.16*size),start.z,handoff.direction==='pickup'?corpse.facing??0:start.yaw);
          transferTo.setXYZW(i,end.x,end.y-.15,end.z,corpse.facing??0);
        }else transfer.setXY(i,0,0);
        return;
      }
      if(a.carrierId!==undefined){
        const carrier=pawns?.animalCorpseCarrier(a.carrierId),source=carrier?.geometry,index=carrier?.index??0;
        if(carrier)this.carrierSlots.set(i,index);else this.carrierSlots.delete(i);
        const f=source?.getAttribute('aFrom'),t=source?.getAttribute('aTo'),travel=source?.getAttribute('aTravel'),motion=source?.getAttribute('aMotion');
        const same=this.keys.begin(a.id,2).value(i).value(origin).value(a.carrierId).value(a.state).value(a.growthTracker?.value)
          .stream(f,index).stream(t,index).stream(travel,index).stream(motion,index).unchanged();
        if(same)return;dirty=true;
        const growth=this.bodyScale.read(a);
        scale.setX(i,growth);state.setXYZW(i,0,0,1,0);blood.setX(i,bodyBloodWord(a.health));
        absent.setX(i,a.health?corpseVisualMask({animalId:a.id,species:a.species,sex:a.sex,ageTicks:a.ageTicks,health:a.health}):0);
        transfer.setXY(i,0,0);carrierState.setXYZW(i,carrier?1:0,motion?.getZ(index)??0,motion?.getW(index)??0,0);
        if(f&&t&&travel){for(const [destination,attribute] of [[from,f],[to,t],[times,travel]] as const)destination.setXYZW(i,attribute.getX(index),attribute.getY(index),attribute.getZ(index),attribute.getW(index));}
        else {from.setXYZW(i,a.x,0,a.z,0);to.setXYZW(i,a.x,0,a.z,0);times.setXYZW(i,0,0,0,1);}
        return;
      }
      const edge=playback?prepared!.edge:(timeline?.segment(a.id)??a.motion),active=!!edge&&tick>=edge.start&&tick<edge.end;
      const growth=this.bodyScale.read(a);
      const fromFraction=edge&&'fromFraction' in edge?edge.fromFraction as number|undefined:undefined,toFraction=edge&&'toFraction' in edge?edge.toFraction as number|undefined:undefined;
      const same=this.keys.begin(a.id,0).value(i).value(origin).value(edge?.start).value(edge?.end).value(fromFraction).value(toFraction).value(active)
        .value(a.state).value(a.meal?.id).value(a.strike?.atCore).value(a.stun?.untilCore).value(a.threat?.targetId).value(a.predation?.targetId)
        .value(a.manhunter?.targetId).value(a.manhunter?.door?.targetId).value(growth).unchanged();
      if(same){if(springActor)springDirty=this.springPose297(i,a,dt297,speed297,from,to,times,state)||springDirty;return;}dirty=true;
      carrierState.setXYZW(i,0,0,0,0);transfer.setXY(i,0,0);
      blood.setX(i,bodyBloodWord(a.health));
      absent.setX(i,a.health?corpseVisualMask({animalId:a.id,species:a.species,sex:a.sex,ageTicks:a.ageTicks,health:a.health}):0);
      const fallen=a.state==='dead'||a.state==='downed';
      const traveling=!!edge&&(active||a.state==='moving'&&(actorScene?actorScene.core/10:world.tick)<edge.end);
      const f=traveling?edge.from:a,t=traveling?edge.to:a;
      let yaw=edge?Math.atan2(edge.to.x-edge.from.x,edge.to.z-edge.from.z):arrivalRotationYaw256(a)??0;
      if(!traveling&&a.meal){const m=a.meal,target=m.kind==='plant'?world.resources.find(r=>r.id===m.id):world.piles.find(p=>p.id===m.id)?.owner;if(target&&'x' in target&&(target.x!==a.x||target.z!==a.z))yaw=Math.atan2(target.x-a.x,target.z-a.z);}
      if(!traveling&&(a.strike||a.threat||a.predation||a.manhunter?.targetId)){const targetId=a.strike?.targetId??a.threat?.targetId??a.predation?.targetId??a.manhunter?.door?.targetId??a.manhunter?.targetId;
        const target=a.strike?.structure??(actorScene&&targetId!==undefined?actorScene.byId[targetId]?.actor:undefined)??world.pawns.find(p=>p.id===targetId)??world.wildlife?.animals.find(p=>p.id===targetId)??world.structures.find(s=>s.id===a.manhunter?.door?.targetId);
        if(target&&(target.x!==a.x||target.z!==a.z))yaw=Math.atan2(target.x-a.x,target.z-a.z);}
      const previous=this.headings.get(a.id);
      let heading=turnToward(previous,yaw,traveling?edge.start:tick);
      if(traveling&&previous&&heading===previous&&previous.startTick!==edge.start)heading={from:headingAt(previous,edge.start),to:previous.to,startTick:edge.start};
      this.headings.set(a.id,heading);
      const fa=traveling&&'fromFraction' in edge?Number(edge.fromFraction??0):0,fb=traveling&&'toFraction' in edge?Number(edge.toFraction??1):1,lerp=THREE.MathUtils.lerp;
      const turning=!traveling&&tick-heading.startTick<TURN_TICKS;
      from.setXYZW(i,lerp(f.x,t.x,fa),this.surfaces.get(f.z*world.width+f.x)??0,lerp(f.z,t.z,fa),traveling||turning?heading.from:heading.to);
      to.setXYZW(i,lerp(f.x,t.x,fb),this.surfaces.get(t.z*world.width+t.x)??0,lerp(f.z,t.z,fb),heading.to);
      const turnStart=localTimeSeconds(heading.startTick,origin);
      times.setXYZW(i,traveling?localTimeSeconds(edge.start,origin):turning?turnStart:0,traveling?localTimeSeconds(edge.end,origin):turning?turnStart+TURN_TICKS/TICKS_PER_SECOND:0,fa,fb);
      const stepping=active&&!fallen&&!a.stun&&(!edge||!('fromFraction' in edge)||!('toFraction' in edge)||edge.fromFraction!==edge.toFraction);
      const gaitPhase=stepping&&edge?this.gait.begin(a.id,{
        start:edge.start,end:edge.end,
        fromX:from.getX(i),fromZ:from.getZ(i),toX:to.getX(i),toZ:to.getZ(i),
      },tick,this.gaitRate):undefined;
      if(!stepping)this.gait.halt(a.id,tick,this.gaitRate);
      const resting=a.state==='downed'||!traveling&&a.state==='sleeping';
      state.setXYZW(i,stepping?1:0,!fallen&&!resting&&!traveling&&a.strike&&!a.stun?2:!traveling&&a.state==='eating'?1:0,
        a.state==='dead'?2:resting?1:0,
        gaitPhase??(a.strike?coreTimeSeconds(a.strike.atCore,origin):a.id%30));
      scale.setX(i,growth);
      if(springActor){this.captureSpring297(i,from,to,times,state);springDirty=this.springPose297(i,a,dt297,speed297,from,to,times,state)||springDirty;}
    });
    if(dirty)for(const a of [from,to,times,state,scale,g.getAttribute('aBodyBlood'),g.getAttribute('aAbsent'),g.getAttribute('aCarrier'),g.getAttribute('aCorpseHandoff'),g.getAttribute('aCorpseFrom'),g.getAttribute('aCorpseTo')])a.needsUpdate=true;
    else if(springDirty)for(const a of [from,to,times,state])a.needsUpdate=true;
    if(changed||reset||dirty){
      this.actorSlots.clear();let minScale=1;
      animals.forEach((a,i)=>{this.actorSlots.set(a.id,i);minScale=Math.min(minScale,scale.getX(i));const carrier=g.getAttribute('aCarrier');this.animationCache.reconcile(i,a.id,[state.getZ(i),scale.getX(i),g.getAttribute('aAbsent').getX(i),carrier.getX(i),carrier.getY(i),this.carrierSlots.get(i),a.carrierId,a.corpsePile?.owner.type].join(':'));});
      this.animationCache.setMinimumScale(minScale);this.refreshOrigamiPartUnion();
    }
    if(playback)this.playback435.commit();
    return false;
  }
  cpuPoseForId(id:number){
    const slot=this.actorSlots.get(id);if(slot===undefined)return;
    // Near actors use the original GPU path, which deliberately has no cached
    // CPU pose. Attached presentation samples those same streams and clocks.
    const g=this.mesh.geometry;
    return this.animationCache.presentedRoot(slot,g.getAttribute('aFrom'),g.getAttribute('aTo'),g.getAttribute('aTravel'),this.travelTime.value,this.blend.value)??sampleActorRoot(g.getAttribute('aFrom'),g.getAttribute('aTo'),g.getAttribute('aTravel'),slot,this.travelTime.value,this.blend.value);
  }
  presentAnimations(pawns?:PawnLayer):void {
    const g=this.mesh.geometry,from=g.getAttribute('aFrom'),to=g.getAttribute('aTo'),travel=g.getAttribute('aTravel');
    if(!this.animationCache.prepareOriginalOnly())for(let i=0;i<this.animals.length;i++){
      const live=sampleActorRoot(from,to,travel,i,this.travelTime.value,this.blend.value,this.animationRoot),owner=this.carrierSlots.get(i);
      const state=g.getAttribute('aAnimal'),carrier=g.getAttribute('aCarrier'),handoff=g.getAttribute('aCorpseHandoff');
      // Standing idle animals breathe; eating and attacks have their own
      // confirmed analytic cycle. Rest/death without cargo is static.
      const continuousMiddle=state.getZ(i)<.5||state.getX(i)>.5||state.getY(i)>.5||carrier.getX(i)>.5||Math.abs(handoff.getY(i))>.0001;
      const due=owner!==undefined&&pawns?this.animationCache.shouldCaptureLinked(i,pawns.animationCache,owner):this.animationCache.shouldCapture(i,live.x,live.y,live.z,g.getAttribute('aScale').getX(i),continuousMiddle);
      if(!due)continue;
      const root=owner!==undefined&&pawns?.animationCache.readRoot(owner,this.linkedRoot)?this.linkedRoot:live;
      const time=owner===undefined?this.time.value:pawns?.animationCache.cpuClock(owner,'time')??this.time.value;
      const travelTime=owner===undefined?this.travelTime.value:pawns?.animationCache.cpuClock(owner,'travelTime')??this.travelTime.value;
      this.animationCache.setRoot(i,root,time,travelTime,travelTime,this.blend.value);sampleAnimalRig(this.animationCache,i,g,root,time,travelTime,this.gaitRate,this.sampledBones);this.animationCache.publish(i);
    }this.animationCache.flush();if(this.hasFireActors)presentAttachedFire(this.flames,g,this,this.animationDetail);
  }
}

/** Resident species batches; prospective species start at16, grow together,
 * and participate in the existing initial shadow preparation. */
export class WildlifeLayer {
  readonly mesh=new THREE.Group();readonly flames=new THREE.Group();readonly travelTime=uniform(0).setGroup(renderGroup);
  private readonly surfaceTextures={soft:createAnimalCoatTexture('soft'),short:createAnimalCoatTexture('short'),shaggy:createAnimalCoatTexture('shaggy')};
  private texturesEnabled=true;
  private readonly models=new AnimalModels();
  private readonly graphicsContext:GraphicsStyleContext;
  private readonly ownsGraphicsContext:boolean;
  private readonly markerStyle:AnimalSlaughterMarkerStyle;
  private rigs:SpeciesRig[];private source?:World;private surfaces:ReadonlyMap<number,number>=new Map();private pileSurface:ReadonlyMap<number,PileSurface>=new Map();private pileIdentities:ReadonlyMap<number,PileSurface>=new Map();private quotaTargets:ReadonlySet<number>=new Set();
  private activeRigs:SpeciesRig[]=[];
  private surfaceRevision=0;
  private surfaceClosed=false;
  private groups=new Map<string,VisualAnimal[]>();
  private burning:ReadonlyMap<number,number>=new Map();
  private selected:ReadonlySet<number>=new Set();
  constructor(configure?:(m:THREE.MeshStandardNodeMaterial)=>void,loadTexture?:SceneTextureLoader,animationDetail=new AnimationDetail()){
    const graphics=currentGraphicsStyle();this.graphicsContext=graphics??new GraphicsStyleContext();this.ownsGraphicsContext=!graphics;
    this.markerStyle=new AnimalSlaughterMarkerStyle(loadTexture);
    this.rigs=withGraphicsStyle(this.graphicsContext,()=>ANIMAL_SPECIES_IDS.map(species=>new SpeciesRig(this.travelTime,species,this.surfaceTextures[animalCoat(species)],this.markerStyle,animationDetail,configure,this.models)));
    for(const rig of this.rigs){this.mesh.add(rig.mesh,rig.selection,rig.slaughter);this.flames.add(rig.flames);}
  }
  /** Read-only compatibility for historical evidence pages. This is an honest
   * diagnostic of the shared surface, never a species-atlas preparation API. */
  bakedStatus(){return{pipeline:'shared-paint',eligible:false,activeSpecies:this.activeRigs.map(rig=>rig.species),bloodBlockedSpecies:[],published:[],pending:false,preparing:false,generation:this.surfaceRevision,cpuBytes:0,gpuBytes:0,fallback:[]};}
  sharedSurfaceStatus(){return{pipeline:'shared-paint',models:this.models.snapshot(),species:this.rigs.flatMap(rig=>{const state=rig.sharedSurfaceStatus();return state?[state]:[];}),positiveEffectsTransitional:this.rigs.some(rig=>!rig.usesSharedSurface)};}
  graphicsComparisonMetadata(){const active=new Set(this.activeRigs),rigs:AnimalGraphicsComparisonState[]=[];for(const rig of this.rigs){const state=rig.graphicsComparisonState(active.has(rig));if(state)rigs.push(state);}return{generation:this.surfaceRevision,eligible:false,pending:false,preparing:false,closed:this.surfaceClosed,rigs};}
  setDesignationMinCellPixels(value:number):void {this.markerStyle.setMinCellPixels(value);}
  presentDesignations(camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,height:number,cellPixels:number):void {this.markerStyle.present(camera,height,cellPixels);}
  setTexturesEnabled(enabled:boolean):void {if(this.texturesEnabled===enabled)return;this.texturesEnabled=enabled;for(const rig of this.rigs)rig.setTexturesEnabled(enabled);}
  setSelected(ids:ReadonlySet<number>):void {this.selected=ids;for(const rig of this.activeRigs)rig.setSelected(ids);}
  forEachPose(visit:(id:number,species:string,x:number,y:number,z:number,height:number,radius:number)=>void):void {for(const rig of this.activeRigs)rig.forEachPose(visit);}
  cpuPoseForId(id:number){for(const rig of this.activeRigs){const pose=rig.cpuPoseForId(id);if(pose)return pose;}}
  presentedPose(id:number){return this.cpuPoseForId(id);}
  update(world:World,timeline:MotionTimeline|undefined,reset=false,pawns?:PawnLayer,actorScene?:CoreActorScene297,dt297=0,speed297=0):void {
    if(this.source!==world){
      this.source=world;this.groups=wildlifePresentationGroups(world,pawns?pileId=>pawns.animalCorpseTransferCarrier(pileId):undefined);
      // Retain canonical species order for pointer iteration and submission.
      const active=this.rigs.filter(rig=>this.groups.has(rig.species));
      if(active.length!==this.activeRigs.length||active.some((rig,i)=>rig!==this.activeRigs[i])){
        this.surfaceRevision++;
      }
      for(const rig of active)rig.setSelected(this.selected);
      const present=new Set(active);for(const rig of this.activeRigs)if(!present.has(rig))rig.deactivate();
      this.activeRigs=active;
      this.surfaces=furnitureSurfaces(world);this.pileSurface=pileSurfaces(world);this.pileIdentities=pileIdentitySurfaces(world);this.quotaTargets=autoSlaughterTargets(world);
      this.burning=new Map((world.fires?.items??[]).filter(f=>f.attachedAnimalId!==undefined).map(f=>[f.attachedAnimalId!,f.size]));
    }
    const tick=timeline?.tick??world.tick,origin=Math.floor(tick/1024)*1024;
    this.travelTime.value=localTimeSeconds(tick,origin);
    // These scalar writes preserve each resident graph's independent clocks,
    // including during compile preparation; only active rigs prepare actors.
    for(const rig of this.rigs)rig.updateClock(tick,pawns);
    for(const rig of this.activeRigs)rig.update(world,this.groups.get(rig.species)!,this.burning,timeline,this.surfaces,this.pileSurface,reset,pawns,this.quotaTargets,this.pileIdentities,actorScene,dt297,speed297);
  }
  adoptPhase297(world:World,indices:readonly number[],actorScene?:CoreActorScene297,changedActorIds?:ReadonlySet<number>):void {
    const population=actorScene?.animals??world.wildlife?.animals??[],dirty=new Set(indices);
    if(actorScene){const targets=changedActorIds??new Set(indices.map(i=>population[i]!.id));
      population.forEach((a,i)=>{const target=a.strike?.targetId??a.threat?.targetId??a.predation?.targetId??a.manhunter?.door?.targetId??a.manhunter?.targetId;if(target!==undefined&&targets.has(target))dirty.add(i);});}
    const animals=[...dirty].map(i=>{const a=population[i];if(!a)throw Error('Missing resident animal');return a;});
    this.source=world;for(const rig of this.activeRigs)rig.adoptPhase297(world,animals);
  }
  actorPlaybackMetrics435(){return this.activeRigs.map(rig=>({species:rig.species,...rig.playbackMetrics435()}));}
  presentAnimations(pawns?:PawnLayer):void {for(const rig of this.activeRigs)rig.presentAnimations(pawns);}
  prepare():()=>void{const restores=this.rigs.map(r=>r.prepare());return()=>{for(const restore of restores)restore();};}
  dispose():void{
    if(this.surfaceClosed)return;this.surfaceClosed=true;this.surfaceRevision++;
    for(const r of this.rigs){
      r.retireSurfaceGeometryStorage();
      r.clearPlayback435();r.animationCache.dispose();
      r.disposeOrigamiCompanions();
      for(const m of [r.mesh,r.flames,r.selection,r.slaughter])m.geometry.dispose();
      r.plainMaterial.dispose();r.texturedMaterial.dispose();
      (r.flames.material as THREE.Material).dispose();
      (r.selection.material as THREE.Material).dispose();
      (r.slaughter.material as THREE.Material).dispose();
    }
    for(const texture of Object.values(this.surfaceTextures))texture.dispose();
    this.markerStyle.dispose();this.models.dispose();if(this.ownsGraphicsContext)this.graphicsContext.dispose();
  }
}
