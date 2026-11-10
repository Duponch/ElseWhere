import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import type {World,Pawn} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import type {PawnTrack} from './motion-tracks';
import type {PresentationSegment} from '../sim/travel-timing';
import {effectiveCore297} from '../sim/core-phase-297';
import {frozenDataCopy297,frozenDataInPlace297} from './core-frozen-copy-297';
import {coreAnchor297,coreInteger297,coreOwnRecord297,copyCoreData297,readCorePhaseData297,validCoreTrace297} from './core-phase-data-297';
import {CORE_HUMAN_OPTIONAL297,CORE_ANIMAL_OPTIONAL297,CORE_MECH_OPTIONAL297,type CoreActorMode297,type CoreActorScene297,type CoreHumanPose297,type CoreActorSceneRecord297,type CorePhaseAnchor297,type CoreFullPhaseMetadata297,type CorePhaseTypedProjection297,type CoreActorProjection297,type CoreProjectileTrace297,type CorePathKeep297} from './core-phase-projection-297';

type State={anchor:CorePhaseAnchor297;world:World;actorScene:CoreActorScene297;actorMode:CoreActorMode297;core:number;nextId:number;seq:number;tracks:PawnTrack[];trace:Map<number,CoreProjectileTrace297>};
export interface PreparedCoreFull297 {readonly previous:object|undefined;readonly projection:CorePhaseTypedProjection297;readonly owner:object}
export interface PreparedCorePhase297 {readonly previous:object;readonly projection:CorePhaseTypedProjection297;readonly owner:object}
/** Representation staging only. This class alone grants NO Native/renderer
 * authority. The fixed trusted-event lane is the sole caller allowed to mint
 * a private renderer token after its successful commit. */
export class CorePhaseFrameOwner297 {
 private state:State|undefined;
 private readonly identity={};
 private prepared=new WeakMap<object,State>();
 clear():void {this.state=undefined;this.prepared=new WeakMap<object,State>();}
 get currentCore():number|undefined{return this.state?.core;}
 get currentNextId():number|undefined{return this.state?.nextId;}
 get currentAnchor():CorePhaseAnchor297|undefined{return this.state?.anchor;}
 get currentSequence():number|undefined{return this.state?.seq;}
 prepareFull(world:World,epoch:number,revision:number,motion:PawnTrack[]|undefined,metadata:unknown,speed:0|1|3|6,reset=false):PreparedCoreFull297 {
  if(!isCorePhysicalSchema297(Number(world.schemaVersion)))throw Error('Phase anchor requires current schema297');
  const core=effectiveCore297(world),m=copyCoreData297(metadata);
  const frontier=coreOwnRecord297(m)&&Object.hasOwn(m,'actorMode297');
  if(!coreOwnRecord297(m)||Reflect.ownKeys(m).length!==(frontier?4:3)||frontier&&m.actorMode297!=='frontier'||!Object.hasOwn(m,'mapId')||!Object.hasOwn(m,'core')||!Object.hasOwn(m,'projectilesRetained')||m.core!==core||!coreInteger297(m.mapId)||!Array.isArray(m.projectilesRetained))throw Error('Invalid full Core phase metadata');
  const anchor=coreAnchor297(world,epoch,revision,core,m.mapId),old=this.state,same=!reset&&old?.anchor.epoch===epoch&&old.anchor.mapId===m.mapId;
  if(same&&(core<old!.core||world.nextId<old!.nextId))throw Error('Full World predates its committed actor phase');
  if(!Array.isArray(motion))throw Error('Full Core anchor lost confirmed tracks');
  const tracks=frozenDataInPlace297(motion),trace=same?new Map(old!.trace):new Map<number,CoreProjectileTrace297>(),seen=new Set<number>();
  for(const value of m.projectilesRetained){if(!validCoreTrace297(value,anchor,core)||seen.has(value.id))throw Error('Invalid retained Core projectile');seen.add(value.id);trace.set(value.id,value);}
  for(const[id,value]of trace)if(value.endCore<core-640)trace.delete(id);
  const actorMode:CoreActorMode297=frontier?'frontier':'same-civil',actorScene=this.scene(core,frozenDataInPlace297(world.pawns),frozenDataInPlace297(world.wildlife?.animals??[]),frozenDataInPlace297(world.mechanoids??[]));
  const next:State={anchor,world,actorScene,actorMode,core,nextId:world.nextId,seq:0,tracks,trace};
  const projection:CorePhaseTypedProjection297=Object.freeze({kind:'full',audioCues:Object.freeze([]),anchor,phaseSeq:0,nextId:world.nextId,fromCore:core,core,speed,world,actorScene,actors:Object.freeze([]),tracks,projectiles:Object.freeze({upserted:Object.freeze([...trace.values()]),removed:Object.freeze([])})});
  const result=Object.freeze({previous:old,projection,owner:this.identity});this.prepared.set(result,next);return result;
 }
 commitFull(prepared:PreparedCoreFull297):CorePhaseTypedProjection297 {
  const next=this.prepared.get(prepared);if(!next||prepared.owner!==this.identity||prepared.previous!==this.state)throw Error('Stale Core full staging');
  this.prepared.delete(prepared);this.state=next;return prepared.projection;
 }
 adoptFull(world:World,epoch:number,revision:number,motion:PawnTrack[]|undefined,metadata:unknown,speed:0|1|3|6,reset=false):CorePhaseTypedProjection297 {
  return this.commitFull(this.prepareFull(world,epoch,revision,motion,metadata,speed,reset));
 }
 prepare(raw:unknown):PreparedCorePhase297 {
  const before=this.state;if(!before)throw Error('Actor phase before Native full anchor');
  const input=readCorePhaseData297(raw,before.anchor,before.core,before.seq+1,before.nextId,new Set(before.trace.keys()),before.actorMode);
  const rows=this.expandPaths297(before.actorScene,input.actors,input.paths297);
  const actorScene=this.adoptPoses297(this.patchActors(before.actorScene,rows,input.toCore),input.poses297),trackMap=new Map(before.tracks.map(t=>[t.id,t]));
  for(const patch of input.tracks){if(!trackMap.has(patch.id)&&![...before.anchor.layout.human,...before.anchor.layout.animal,...before.anchor.layout.mechanical].includes(patch.id))throw Error('Unknown actor track outside the anchored layout');const previous=trackMap.get(patch.id)?.segments??[];
   if(patch.drop+patch.keep>previous.length||!trackMap.has(patch.id)&&(patch.drop!==0||patch.keep!==0))throw Error('Core motion predecessor mismatch');
   const segments=Object.freeze([...previous.slice(patch.drop,patch.drop+patch.keep),...patch.append]) as unknown as PresentationSegment[];
   trackMap.set(patch.id,Object.freeze({id:patch.id,segments}));
  }
  const tracks=Object.freeze([...trackMap.values()]) as unknown as PawnTrack[],trace=new Map(before.trace);
  for(const value of input.projectiles.upserted)trace.set(value.id,value);
  // removed means physical SIM cleanup, never erasure of playable history.
  for(const[id,value]of trace)if(value.endCore<input.toCore-640)trace.delete(id);
  const next:State={anchor:before.anchor,world:before.world,actorScene,actorMode:before.actorMode,core:input.toCore,nextId:input.nextId,seq:input.phaseSeq,tracks,trace};
  const projection:CorePhaseTypedProjection297=Object.freeze({kind:'phase',audioCues:input.audioCues,anchor:before.anchor,phaseSeq:input.phaseSeq,nextId:input.nextId,fromCore:input.fromCore,core:input.toCore,speed:input.speed,world:before.world,actorScene,actors:rows,tracks,projectiles:input.projectiles,...input.poses297?{poses297:input.poses297}:{},...input.doors297?{doors297:input.doors297}:{},...input.piles297?{piles297:input.piles297}:{}});
  const result=Object.freeze({previous:before,projection,owner:this.identity});this.prepared.set(result,next);return result;
 }
 commit(prepared:PreparedCorePhase297):CorePhaseTypedProjection297 {
  const next=this.prepared.get(prepared);if(!next||prepared.owner!==this.identity||prepared.previous!==this.state)throw Error('Stale Core phase staging');
  this.prepared.delete(prepared);this.state=next;return prepared.projection;
 }
 private scene(core:number,humans:readonly Readonly<Pawn>[],animals:readonly Readonly<WildAnimal>[],mechanical:readonly Readonly<Mechanoid>[]):CoreActorScene297 {
  const byId:Record<number,CoreActorSceneRecord297>={};
  const put=(id:number,value:CoreActorSceneRecord297)=>{if(Object.hasOwn(byId,id))throw Error('Duplicate actor scene ID');Object.defineProperty(byId,id,{value:Object.freeze(value),enumerable:true,writable:false,configurable:false});};
  humans.forEach((actor,index)=>put(actor.id,{kind:'human',index,actor}));
  animals.forEach((actor,index)=>put(actor.id,{kind:'animal',index,actor}));
  mechanical.forEach((actor,index)=>put(actor.id,{kind:'mechanical',index,actor}));
  return Object.freeze({core,humans:Object.freeze(humans),animals:Object.freeze(animals),mechanical:Object.freeze(mechanical),byId:Object.freeze(byId)});
 }
 /** A frontier pose patch replaces the human record by its complete current
  * own-data record (validated and frozen by the strict reader); later physical
  * phases overlay their fields on it as on any anchored record. */
 private adoptPoses297(scene:CoreActorScene297,poses:readonly CoreHumanPose297[]|undefined):CoreActorScene297 {
  if(!poses?.length)return scene;
  const humans=scene.humans.slice();
  for(const row of poses){const source=humans[row.index];if(!source||source.id!==row.id||row.actor.id!==row.id)throw Error('Pose patch escaped its anchored slot');humans[row.index]=row.actor;}
  return this.scene(scene.core,humans,scene.animals,scene.mechanical);
 }
 /** A frontier path patch: the listed rows carry no cells; each real path is
  * the tail of the path this scene already holds for that actor. The rebuilt
  * rows are complete, like the rows of a packet without path patches. */
 private expandPaths297(scene:CoreActorScene297,rows:readonly CoreActorProjection297[],paths:readonly CorePathKeep297[]|undefined):readonly CoreActorProjection297[] {
  if(!paths?.length)return rows;
  const keeps=new Map(paths.map(row=>[row.id,row.keep] as const));
  return Object.freeze(rows.map(row=>{
   const keep=keeps.get(row.id);if(keep===undefined)return row;
   const source=row.kind==='human'?scene.humans[row.index]:row.kind==='animal'?scene.animals[row.index]:scene.mechanical[row.index];
   if(!source||source.id!==row.id)throw Error('Changed Core actor escaped its anchored slot');
   const held=source.path;if(!Array.isArray(held)||keep>held.length||row.fields.path.length!==0)throw Error('Core path predecessor mismatch');
   return Object.freeze({...row,fields:Object.freeze({...row.fields,path:Object.freeze(held.slice(held.length-keep))})}) as CoreActorProjection297;
  }));
 }
 private patchActors(base:CoreActorScene297,changes:readonly CoreActorProjection297[],core:number):CoreActorScene297 {
  if(changes.length===0)return Object.freeze({...base,core});
  let humans:Readonly<Pawn>[]|undefined,animals:Readonly<WildAnimal>[]|undefined,mechanical:Readonly<Mechanoid>[]|undefined;
  for(const row of changes){const source=row.kind==='human'?(humans??base.humans)[row.index]:row.kind==='animal'?(animals??base.animals)[row.index]:(mechanical??base.mechanical)[row.index];
   if(!source||source.id!==row.id)throw Error('Changed Core actor escaped its anchored slot');
   const clone={...source} as unknown as Record<string,unknown>,optionals=row.kind==='human'?CORE_HUMAN_OPTIONAL297:row.kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
   for(const key of optionals)if(!Object.hasOwn(row.fields,key))delete clone[key];
   // An already-own key is assigned (no inherited setter can run); a new one is
   // defined. Freezing then gives the same frozen own-data record as before.
   const values=row.fields as unknown as Record<string,unknown>;
   for(const key of Object.keys(values)){if(Object.hasOwn(clone,key))clone[key]=values[key];else Object.defineProperty(clone,key,{value:values[key],enumerable:true,writable:true,configurable:true});}Object.freeze(clone);
   if(row.kind==='human')(humans??=base.humans.slice())[row.index]=clone as unknown as Readonly<Pawn>;
   else if(row.kind==='animal')(animals??=base.animals.slice())[row.index]=clone as unknown as Readonly<WildAnimal>;
   else (mechanical??=base.mechanical.slice())[row.index]=clone as unknown as Readonly<Mechanoid>;
  }
  return this.scene(core,humans??base.humans,animals??base.animals,mechanical??base.mechanical);
 }
}

export {frozenDataCopy297} from './core-frozen-copy-297';
