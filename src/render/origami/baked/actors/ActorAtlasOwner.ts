/** PRIVATE renderer-local texture owner. ONE Core registry is the only queue. */
import * as THREE from 'three/webgpu';
import {attribute,uint} from 'three/tsl';
import type {GraphicsStyleContext} from '../../../graphics-style';
import type {SharedSurfacePreparationOwner,SharedSurfacePreparationSnapshot,SharedSurfacePreparationStage} from '../../../surfaces/SharedSurfacePreparation';
import type {SharedPaintSurfaceOptions} from '../../../surfaces/SharedPaintSurface';
import type {FaceStrokeData} from '../../../surfaces/FaceStrokeTable';
import {WORK_POSE} from '../../../work-presentation';
import {ANIMAL_SURFACE_PROFILE_STRIDE} from '../../../models/AnimalModels';
import {ActorAtlasAdmissionRefusal,type ActorAtlasLimits} from './ActorAtlasSchema';
import {ActorTextureSurface,type ActorTextureAssets} from './ActorTextureSurface';
import {captureActorModel,planActorCohorts,type ActorBakeSource} from './ActorAtlasModel';
import {prepareActorAtlasGpu,type ActorAtlasGpuResult} from './ActorAtlasGpu';
const MiB=1024*1024,SCREEN_MAX=128,SCREEN_RETURN=112;
export interface ActorBodyBakePort {
 readonly model:{readonly key:string;readonly strokes:FaceStrokeData;assertCurrent():void};
 createGeometry():THREE.InstancedBufferGeometry;
 readonly geometry:THREE.InstancedBufferGeometry;readonly sourceMaterial:THREE.MeshStandardNodeMaterial;
 readonly nativeMaterial?:THREE.MeshStandardNodeMaterial|null;
 readonly buildOptions:(position:THREE.Node<'vec3'>)=>SharedPaintSurfaceOptions;
 readonly morphPosition:()=>THREE.Node<'vec3'>;readonly pastelTexture:THREE.DataTexture;
 readonly pastelUv:THREE.Node<'vec2'>;readonly pastelFromSample:(sample:THREE.Node<'vec4'>)=>THREE.Node<'vec3'>;
}
export interface ActorAtlasOwnerOptions {
 readonly key:string;readonly kind:'human'|'animal';readonly context:GraphicsStyleContext;
 readonly readPort:()=>ActorBodyBakePort|undefined;readonly ownerCount:()=>number;
 readonly changed:()=>void;readonly configure?:(material:THREE.MeshStandardNodeMaterial)=>void;
 readonly maxCpuBytes?:number;readonly maxPeakGpuBytes?:number;readonly maxRetainedGpuBytes?:number;
}
type Asset={readonly key:string;readonly value:ActorAtlasGpuResult;readonly assets:ActorTextureAssets;readonly cpuBytes:number;readonly gpuBytes:number};
type Density={mode:'orthographic'|'perspective';physicalCellPixels:number};
type State={owners:Set<ActorAtlasOwner>;admitted:Set<ActorAtlasOwner>;tier:'source'|'screen';density?:Density;revision:number;held:Set<Asset>};
const states=new WeakMap<GraphicsStyleContext,State>();
const state=(c:GraphicsStyleContext)=>{let s=states.get(c);if(!s){s={owners:new Set(),admitted:new Set(),tier:'source',revision:0,held:new Set()};states.set(c,s);}return s;};
export function hasActorAtlasDensityGate(context:GraphicsStyleContext):boolean{return(states.get(context)?.admitted.size??0)>0;}
function densityTier(s:State,mode:'orthographic'|'perspective'|undefined,pixels:number|undefined,initial=false){if(mode!=='orthographic'||!Number.isFinite(pixels)||!(pixels!>0))return'source'as const;return initial||!s.density?(pixels!<=SCREEN_MAX?'screen':'source'):s.tier==='screen'?(pixels!>SCREEN_MAX?'source':'screen'):(pixels!<=SCREEN_RETURN?'screen':'source');}
/** O(1) stable frame. Only a real tier transition dirties the existing registry;
 * no owner iteration, geometry inspection, allocation or GPU operation here. */
export function updateActorAtlasDensity(context:GraphicsStyleContext,mode:'orthographic'|'perspective',physicalCellPixels:number):boolean{const s=states.get(context);if(!context.origami||!s?.admitted.size)return false;const next=densityTier(s,mode,physicalCellPixels);if(next===s.tier)return false;s.density={mode,physicalCellPixels};s.tier=next;s.revision++;context.surfacePreparation.invalidate();return true;}
/** Shared predicate for producer dirty writers. Pose class changes admission,
 * never the persistent paint key; animation phase/position do not trigger bake. */
export function actorPoseIsRigid(kind:'human'|'animal',g:THREE.BufferGeometry,slot:number):boolean{
 if(kind==='human'){const m=g.getAttribute('aMotion');return!!m&&m.getX(slot)>=-.5&&![WORK_POSE.ground,WORK_POSE.groundMelee,10].includes(m.getZ(slot));}
 const t=g.getAttribute('aCorpseHandoff');return!t||Math.abs(t.getY(slot))<=.0001;
}
function parameters(c:GraphicsStyleContext){const p=c.preferences;return JSON.stringify([p.impasto,p.wear,p.edges,p.blackEdges,p.edgeWidth,p.strokeImperfection,p.contourImperfection,c.paintReplayState().refreshed]);}
const numberKey=(p:ActorBodyBakePort,slot:number)=>{const g=p.geometry,s=g.getAttribute('aShape'),e=g.getAttribute('aEquipment'),row=Math.floor(s.getW(slot)/32),body=s.getX(slot)%10,head=s.getY(slot),outfit=e.getY(slot),wood=Math.round((e.getX(slot)-Math.floor(e.getX(slot)))*8);return(row|(body<<12)|(head<<15)|(outfit<<19)|(wood<<22))>>>0;};
const keyNode=()=>{const s=attribute('aShape','vec4'),e=attribute('aEquipment','vec4');return s.w.div(32).floor().toUint().bitOr(s.x.mod(10).toUint().shiftLeft(uint(12))).bitOr(s.y.toUint().shiftLeft(uint(15))).bitOr(e.y.toUint().shiftLeft(uint(19))).bitOr(e.x.fract().mul(8).round().toUint().shiftLeft(uint(22)));};
export function createActorBakeSource(options:ActorAtlasOwnerOptions,port:ActorBodyBakePort,completeIndex:Uint16Array|Uint32Array):ActorBakeSource{
 const g=port.geometry,human=options.kind==='human',shape=g.getAttribute('aShape'),traits=g.getAttribute(human?'pawnRigTraits':'animalPaint'),kind=options.kind;
 return{key:port.model.key,kind,context:options.context,geometry:g,completeIndex,sourceMaterial:port.sourceMaterial,stroke:port.model.strokes,uvAttribute:human?'origamiPaintUv':'animalSurfaceUv',faceCount:port.model.strokes.faceCount,
  ownerCount:options.ownerCount,appearanceKey:human?slot=>numberKey(port,slot):()=>0,
  appearanceSignature:slot=>{if(!human)return port.model.key;const equipment=g.getAttribute('aEquipment'),gear=Array.from({length:4},(_,i)=>equipment.getComponent(slot,i));gear[0]=Math.floor(gear[0]!)+Math.round((gear[0]!-Math.floor(gear[0]!))*8)/8;return JSON.stringify([shape.getX(slot)%10,shape.getY(slot),Math.floor(shape.getW(slot)/32),gear,...['aTint','aSkin','aHairBlood'].map(name=>Array.from({length:3},(_,i)=>g.getAttribute(name).getComponent(slot,i)))]);},
  canBake:slot=>{if(!actorPoseIsRigid(kind,g,slot))return false;if(human){const blood=g.getAttribute('aHairBlood'),e=g.getAttribute('aEquipment');return!!blood&&blood.getW(slot)===0&&Math.floor(shape.getX(slot)/10)%10===0&&Math.round(e.getX(slot)%1*8)<8;}const biology=g.getAttribute('aBiology'),blood=g.getAttribute('aBodyBlood');return!!biology&&biology.getX(slot)>0&&biology.getX(slot)<=1&&biology.getZ(slot)===0&&g.getAttribute('aAnimal').getZ(slot)<.5&&(blood?.getX(slot)??biology.getY(slot))===0;},
  faceId:v=>human?traits.getW(v):Math.floor(traits.getW(v)/ANIMAL_SURFACE_PROFILE_STRIDE),buildMorphPosition:port.morphPosition,buildOptions:port.buildOptions,
  surfaceOptions:{pastelTexture:port.pastelTexture,pastelUv:port.pastelUv,pastelFromSample:port.pastelFromSample,faceId:human?attribute('pawnRigTraits','vec4').w:attribute('animalPaint','vec4').w.div(ANIMAL_SURFACE_PROFILE_STRIDE).floor(),faceUv:human?attribute('origamiPaintUv','vec2'):attribute('animalSurfaceUv','vec4').xy,appearanceKey:human?keyNode():uint(0),configure:options.configure},
  assertCurrent:()=>{port.model.assertCurrent();const current=options.readPort();if(!current||current.geometry!==g||current.model.key!==port.model.key||current.sourceMaterial!==port.sourceMaterial)throw Error('Actual actor source/model changed');},
 };
}
/** Canonical bone/pivot domain is checked once at model admission. Visibility
 * clipping is NOT baked; complete hidden hair/gear remain valid chart surfaces. */
function assertRigidTriangles(source:ActorBakeSource){const g=source.geometry,t=g.getAttribute(source.kind==='human'?'pawnRigTraits':'animalPart'),pivot=g.getAttribute('bindPivot');if(!t||!pivot)throw new ActorAtlasAdmissionRefusal('Source rig provenance absent');for(let i=0;i<source.completeIndex.length;i+=3){const a=source.completeIndex[i]!;for(let c=1;c<3;c++){const b=source.completeIndex[i+c]!;if(t.getX(a)!==t.getX(b)||[0,1,2].some(k=>pivot.getComponent(a,k)!==pivot.getComponent(b,k)))throw new ActorAtlasAdmissionRefusal('Non-affine weighted bone triangle retains whole Source actor');}}}
export class ActorAtlasOwner implements SharedSurfacePreparationOwner {
 readonly key:string;private readonly shared:State;private readonly unregister:()=>void;
 private readonly surfaces=new Map<THREE.MeshStandardNodeMaterial,ActorTextureSurface>();
 private readonly owned=new Set<Asset>();
 private complete:{model:ActorBodyBakePort['model'];index:Uint16Array|Uint32Array}|undefined;
 private current:Asset|undefined;private dirty=true;private closed=false;private semantic='';private fallback:string|undefined;
 private cacheReady=false;
 private publishedStyle:string|undefined;private publishedDensityRevision=-1;private publishedTier:'source'|'screen'='source';
 private actors=0;private cohorts=0;private staged=false;private qualityRequested:'source'|'prepared'|undefined;private qualityActive:'source'|'prepared'|undefined;
 constructor(readonly options:ActorAtlasOwnerOptions){this.key='actor-atlas:'+options.key;this.shared=state(options.context);try{const port=options.readPort();if(port)this.ensureSurfaces(port);this.unregister=options.context.surfacePreparation.register(this);this.shared.owners.add(this);}catch(error){const errors=[error];for(const surface of this.surfaces.values())try{surface.dispose();}catch(cleanup){errors.push(cleanup);}throw errors.length>1?new AggregateError(errors,'Actor surface constructor quarantine'):error;}}
 get materials(){return[...this.surfaces.values()].map(s=>s.material);}
 invalidate():void{if(this.closed)return;this.dirty=true;this.options.context.surfacePreparation.invalidate();}
 /** Developer harness diagnostic only: actual same-material representation,
  * applied by the normal public Core prepare/compile transaction, never RAF. */
 requestQualityRoute(route:'source'|'prepared'|undefined):void{if(this.closed)throw Error('Actor atlas owner closed');this.qualityRequested=route;this.invalidate();}
 needsPreparation(snapshot:SharedSurfacePreparationSnapshot):boolean{return!this.closed&&(this.dirty||this.semantic!==parameters(this.options.context)||this.publishedStyle!==snapshot.preferences.style||snapshot.preferences.style==='origami'&&this.publishedDensityRevision!==this.shared.revision||this.qualityRequested!==this.qualityActive);}
 selectedMaterial(source:THREE.NodeMaterial):THREE.NodeMaterial{return this.surfaces.get(source as THREE.MeshStandardNodeMaterial)?.material??source;}
 private ensureSurfaces(port:ActorBodyBakePort){for(const material of[port.sourceMaterial,port.nativeMaterial])if(material){const old=this.surfaces.get(material);if(old){old.setModelDomain(port.model.strokes.faceCount);continue;}const human=this.options.kind==='human',s=new ActorTextureSurface({context:this.options.context,sourceMaterial:material,pastelTexture:port.pastelTexture,pastelUv:port.pastelUv,pastelFromSample:port.pastelFromSample,faceId:human?attribute('pawnRigTraits','vec4').w:attribute('animalPaint','vec4').w.div(ANIMAL_SURFACE_PROFILE_STRIDE).floor(),faceUv:human?attribute('origamiPaintUv','vec2'):attribute('animalSurfaceUv','vec4').xy,appearanceKey:human?keyNode():uint(0),faceCount:port.model.strokes.faceCount,configure:this.options.configure});s.selectRepresentation('source');this.surfaces.set(material,s);}}
 async stage(snapshot:SharedSurfacePreparationSnapshot,assertCurrent:()=>void):Promise<SharedSurfacePreparationStage>{
  if(this.closed||this.staged)throw Error('Actor atlas owner unavailable');assertCurrent();const port=this.options.readPort(),semantic=parameters(this.options.context),old=this.current,previousFallback=this.fallback,previousActors=this.actors,previousCohorts=this.cohorts,previousQuality=this.qualityActive,previousDensity=this.shared.density,previousTier=this.shared.tier,previousStyle=this.publishedStyle,previousDensityRevision=this.publishedDensityRevision,previousPublishedTier=this.publishedTier,previousCacheReady=this.cacheReady,wasAdmitted=this.shared.admitted.has(this),previous=[...this.surfaces.values()].map(surface=>({surface,assets:surface.assets,representation:surface.snapshot().representation,faceCount:surface.snapshot().faceCount}));this.staged=true;
  let candidate:Asset|undefined,next=old,reason:string|undefined,actors=0,cohorts=0,admitted=false,eligibleForDensity=false,settled=false,published=false,rolledBack=false,disposed=false;
  const density=(snapshot as SharedSurfacePreparationSnapshot&{density?:Density}).density,requestedTier=densityTier(this.shared,density?.mode,density?.physicalCellPixels,this.publishedStyle!==snapshot.preferences.style),context=this.options.context,gouache=snapshot.preferences.style==='origami',positive=snapshot.preferences.impasto>0||snapshot.preferences.wear>0;
  try{
   if(port){this.ensureSurfaces(port);actors=this.options.ownerCount();}
   if(!port||actors===0){reason='no-actual-published-actors';next=undefined;}
   else if(!gouache){reason=positive?'positive-effects-Source':'Pastel-original64';}
   else if(positive)reason='positive-effects-Source';
   else if(!snapshot.world||!density)reason='catalog-or-unknown-density-Source-no-bake';
   else{
    const renderer=(snapshot as SharedSurfacePreparationSnapshot&{renderer:THREE.WebGPURenderer}).renderer,paint=(snapshot as SharedSurfacePreparationSnapshot&{paintSource?:ReturnType<GraphicsStyleContext['prepareAtlasPaint']>}).paintSource;if(!renderer||!paint)throw Error('One Core renderer and shared actual Source paint lease required');
    if(!this.complete||this.complete.model!==port.model){const full=port.createGeometry();try{if(!full.index||full.getAttribute('position').count!==port.geometry.getAttribute('position').count)throw new ActorAtlasAdmissionRefusal('Actual complete model/index mismatch');this.complete={model:port.model,index:full.index.array.slice()as Uint16Array|Uint32Array};}finally{full.dispose();}}
    const source=createActorBakeSource(this.options,port,this.complete.index);assertRigidTriangles(source);const capture=captureActorModel(source),cacheKey=JSON.stringify([capture.key,semantic]);cohorts=capture.cohorts.length;eligibleForDensity=true;
    if(old?.key===cacheKey){old.value.assertCurrent();next=old;admitted=true;}
    else if(requestedTier==='source')reason='projection-or-near-Source-no-unused-bake';
    else{
     const held=[...this.shared.held].reduce((n,a)=>n+a.gpuBytes,0),metadata=[...this.shared.owners].reduce((sum,o)=>sum+[...o.surfaces.values()].reduce((sum,s)=>sum+s.snapshot().allocatedGpuUpperBoundBytes+s.snapshot().pastelGpuBytes,0),0),cpuHeld=[...this.shared.held].reduce((n,a)=>n+a.cpuBytes,0),maxPeak=this.options.maxPeakGpuBytes??1024*MiB,maxCpu=this.options.maxCpuBytes??256*MiB,maxRetained=this.options.maxRetainedGpuBytes??512*MiB;
     const limits:ActorAtlasLimits={maxFaces:Math.floor(128*MiB/32),maxPages:256,maxCpuBytes:maxCpu,maxRetainedGpuBytes:maxRetained-held,maxPeakGpuBytes:maxPeak,oldLiveGpuBytes:held,externalGpuBytes:metadata,oldLiveCpuBytes:cpuHeld,externalCpuBytes:metadata,compilerScratchGpuBytes:1,compilerScratchCpuBytes:1},plan=planActorCohorts(capture,{tier:'screen',maxCellPixels:SCREEN_MAX,oversampling:4,paintKey:semantic},limits);assertCurrent();paint.assertCurrent();
     const value=await prepareActorAtlasGpu(renderer,plan,paint,{maxPeakGpuBytes:maxPeak,maxCpuBytes:maxCpu,oldLiveGpuBytes:held,otherLiveGpuBytes:metadata},()=>{assertCurrent();capture.assertCurrent();paint.assertCurrent();if(semantic!==parameters(context))throw Error('Actual actor paint settings changed');});
     candidate={key:cacheKey,value,assets:{texture:value.texture,plan:plan.plan,cohorts:plan.addresses,assertCurrent:()=>value.assertCurrent()},cpuBytes:plan.plan.retainedCpuBytes+value.cpuBytes,gpuBytes:value.gpuBytes};this.owned.add(candidate);this.shared.held.add(candidate);next=candidate;admitted=true;
    }
   }
  }catch(error){if(!(error instanceof ActorAtlasAdmissionRefusal)){const errors=[error];try{if(candidate)this.retire(candidate);}catch(cleanup){errors.push(cleanup);}finally{this.staged=false;}throw errors.length>1?new AggregateError(errors,'Actor atlas preparation quarantine'):error;}reason=error.message;admitted=false;next=old;}
  const choose=()=>{if(this.qualityRequested==='prepared'&&(!admitted||requestedTier!=='screen'||!gouache))throw Error('Prepared quality witness requires a genuinely admitted current pixel domain');for(const surface of this.surfaces.values()){if(!gouache&&!positive){surface.setAssets(undefined);surface.selectRepresentation('pure');}else if(admitted&&next&&requestedTier==='screen'&&this.qualityRequested!=='source'){surface.setAssets(next.assets);surface.assertReady(next.assets.cohorts.map(c=>c.key));surface.selectRepresentation('pure');}else surface.selectRepresentation('source');}this.options.changed();};
  const rollback=()=>{if(settled)throw Error('Committed actor atlas stage cannot roll back');if(rolledBack)return;if(published){for(const row of previous){row.surface.setModelDomain(row.faceCount);row.surface.setAssets(row.assets);row.surface.selectRepresentation(row.representation);}for(const surface of this.surfaces.values())if(!previous.some(p=>p.surface===surface)){surface.setAssets(undefined);surface.selectRepresentation('source');}this.current=old;this.fallback=previousFallback;this.actors=previousActors;this.cohorts=previousCohorts;this.cacheReady=previousCacheReady;this.qualityActive=previousQuality;this.shared.density=previousDensity;this.shared.tier=previousTier;this.publishedStyle=previousStyle;this.publishedDensityRevision=previousDensityRevision;this.publishedTier=previousPublishedTier;if(wasAdmitted)this.shared.admitted.add(this);else this.shared.admitted.delete(this);this.options.changed();}rolledBack=true;};
  return{publish:()=>{if(disposed||published||rolledBack)throw Error('Actor atlas stage superseded');assertCurrent();if(semantic!==parameters(context))throw Error('Actor atlas settings changed before publication');this.shared.density=density;this.shared.tier=requestedTier;this.current=next;this.fallback=reason??(requestedTier==='source'?'Source-near-or-perspective':undefined);this.actors=actors;this.cohorts=cohorts;this.cacheReady=admitted;this.qualityActive=this.qualityRequested;this.publishedStyle=snapshot.preferences.style;this.publishedDensityRevision=this.shared.revision;this.publishedTier=requestedTier;if(eligibleForDensity)this.shared.admitted.add(this);else this.shared.admitted.delete(this);published=true;choose();},commit:()=>{if(settled)return;if(!published||rolledBack)throw Error('Only a published actor stage can commit');assertCurrent();settled=true;this.semantic=semantic;this.dirty=false;if(old&&old!==next)this.retire(old);},rollback,dispose:()=>{if(disposed)return;try{if(!settled&&!rolledBack)rollback();if(!settled&&candidate)this.retire(candidate);disposed=true;}finally{this.staged=false;}},stats:{kind:'actor-one-read',actors,cohorts,admitted,pages:next?.assets.plan.pages??0,reason}};
 }
 status(){const pure=[...this.surfaces.values()].some(s=>s.snapshot().representation==='pure'),p=this.current?.assets.plan,ready=pure&&this.options.context.origami&&this.cacheReady;return{pipeline:'actor-one-read',actors:this.actors,cohorts:this.cohorts,ready,readyActors:ready?this.actors:0,cachedAdmission:this.cacheReady,eligibleForDensity:this.shared.admitted.has(this),representation:pure?'pure':'source',pages:p?.pages??0,pageSize:p?.size??0,retainedCpuBytes:this.current?.cpuBytes??0,retainedGpuBytes:this.current?.gpuBytes??0,sourcePaintAndCanonicalGpuNominal:this.current?.value.stats.borrowedSourceGpuBytes??0,metadataGpuUpperBytes:[...this.surfaces.values()].reduce((n,s)=>n+s.snapshot().allocatedGpuUpperBoundBytes,0),fallback:this.qualityActive==='source'?'diagnostic-Source':this.fallback??null,densityTier:this.publishedTier,desiredTier:this.shared.tier,maxCellPixels:SCREEN_MAX,qualityRoute:this.qualityActive??null,pending:this.staged,closed:this.closed};}
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{const all=[...geometries];for(const surface of this.surfaces.values())surface.attachGpuRetirement(all);}
 private retire(asset:Asset):void{if(!this.owned.has(asset))return;asset.value.dispose();this.owned.delete(asset);this.shared.held.delete(asset);}
 dispose():void{if(this.closed)return;if(this.staged)throw Error('Settle actor atlas stage before owner disposal');const failures:unknown[]=[];for(const asset of this.owned)try{this.retire(asset);}catch(e){failures.push(e);}for(const[material,surface]of this.surfaces)try{surface.dispose();this.surfaces.delete(material);}catch(e){failures.push(e);}if(failures.length)throw new AggregateError(failures,'Actor atlas owner close quarantine');this.unregister();this.shared.owners.delete(this);this.shared.admitted.delete(this);this.current=undefined;this.closed=true;}
}
