import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import type {World,Pawn} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import type {PawnTrack} from './motion-tracks';
import type {PresentationSegment} from '../sim/travel-timing';
import {effectiveCore297} from '../sim/core-phase-297';
import {frozenDataCopy297,frozenDataInPlace297} from './core-frozen-copy-297';
import {isOwnedResidentActorListInternal} from './resident-actors-section';
import {hasOwnedResidentMotionCoreLimits297} from './resident-motion';
import {isCapturedCoreData297} from './native-message-capture';
import {coreAnchor297,coreInteger297,coreOwnRecord297,copyCoreData297,readCorePhaseData297,validCoreTrace297} from './core-phase-data-297';
import {CORE_HUMAN_OPTIONAL297,CORE_ANIMAL_OPTIONAL297,CORE_MECH_OPTIONAL297,type CoreActorMode297,type CoreActorScene297,type CoreHumanPose297,type CoreActorSceneRecord297,type CorePhaseAnchor297,type CoreFullPhaseMetadata297,type CorePhaseTypedProjection297,type CoreActorProjection297,type CoreProjectileTrace297,type CorePathKeep297} from './core-phase-projection-297';

type State={anchor:CorePhaseAnchor297;world:World;actorScene:CoreActorScene297;actorMode:CoreActorMode297;core:number;nextId:number;seq:number;tracks:PawnTrack[];trackSlots?:ReadonlyMap<number,number>;trace:Map<number,CoreProjectileTrace297>};
export interface PreparedCoreFull297 {readonly previous:object|undefined;readonly projection:CorePhaseTypedProjection297;readonly owner:object}
export interface PreparedCorePhase297 {readonly previous:object;readonly projection:CorePhaseTypedProjection297;readonly owner:object}
// The resident decoder and the phase parser have already checked the
// complete own-data segment tree. The renderer needs only the immutability
// of the history, not another descriptor walk over every retained segment.
// This is a representation fact, never a Native receipt or renderer token.
const ownedPlaybackHistories297=new WeakSet<readonly PresentationSegment[]>();
export function hasOwnedCorePlaybackHistory297(value:readonly PresentationSegment[]):boolean {
 return ownedPlaybackHistories297.has(value);
}
const ownedTrackLists297=new WeakSet<readonly PawnTrack[]>();
const trackEdits297=new WeakMap<readonly PawnTrack[],{previous:WeakRef<readonly PawnTrack[]>;rows:readonly PawnTrack[]}>();
const noTrackEdits297:readonly PawnTrack[]=Object.freeze([]);
/** Representation-only, exact predecessor. Public/literal or skipped Fulls
 * still go through the ordinary complete list adoption in MotionTimeline. */
export function readOwnedCoreTrackEdits297(previous:readonly PawnTrack[]|undefined,next:readonly PawnTrack[]):readonly PawnTrack[]|undefined {
 if(previous===undefined)return;
 if(previous===next&&ownedTrackLists297.has(next))return noTrackEdits297;
 const held=trackEdits297.get(next);return held&&held.previous.deref()===previous?held.rows:undefined;
}
const trackArray=Array,trackArrayProto=Array.prototype,trackSlice=Array.prototype.slice,trackSpecies=Object.getOwnPropertyDescriptor(Array,Symbol.species)?.get;
function copyOwnedTrackRows297(previous:PawnTrack[]):PawnTrack[]|undefined {
 if(!ownedTrackLists297.has(previous)||Object.getPrototypeOf(previous)!==trackArrayProto||Object.hasOwn(previous,'slice')||Object.hasOwn(previous,'constructor')||Object.getOwnPropertyDescriptor(trackArrayProto,'slice')?.value!==trackSlice||Object.getOwnPropertyDescriptor(trackArrayProto,'constructor')?.value!==trackArray||!trackSpecies||Object.getOwnPropertyDescriptor(trackArray,Symbol.species)?.get!==trackSpecies)return;
 return Reflect.apply(trackSlice,previous,[]) as PawnTrack[];
}
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
  // The native resident decoder can prove the exact finite/occurrence/depth
  // contract while constructing immutable motion, including retained slices.
  // Literal/public/unproved and over-budget values keep the full strict walk.
  const ownedMotion=hasOwnedResidentMotionCoreLimits297(motion),tracks=ownedMotion?motion:frozenDataInPlace297(motion),trace=same?new Map(old!.trace):new Map<number,CoreProjectileTrace297>(),seen=new Set<number>();
  const trackSlots=ownedMotion?new Map<number,number>():undefined;
  if(trackSlots){for(let i=0;i<tracks.length;i++){const track=tracks[i]!;ownedPlaybackHistories297.add(track.segments);trackSlots.set(track.id,i);}ownedTrackLists297.add(tracks);}
  for(const value of m.projectilesRetained){if(!validCoreTrace297(value,anchor,core)||seen.has(value.id))throw Error('Invalid retained Core projectile');seen.add(value.id);trace.set(value.id,value);}
  for(const[id,value]of trace)if(value.endCore<core-640)trace.delete(id);
  const humans=world.pawns,animals=world.wildlife?.animals??[],mechanical=world.mechanoids??[];
  // The closed resident decoder already checked the complete own-data tree
  // with the same depth/node bounds and froze it. Public/fabricated lists
  // still pass through the full in-place validator.
  const actorMode:CoreActorMode297=frontier?'frontier':'same-civil',actorScene=this.scene(core,
   isOwnedResidentActorListInternal(humans)?humans:frozenDataInPlace297(humans),
   isOwnedResidentActorListInternal(animals)?animals:frozenDataInPlace297(animals),
   isOwnedResidentActorListInternal(mechanical)?mechanical:frozenDataInPlace297(mechanical));
  const next:State={anchor,world,actorScene,actorMode,core,nextId:world.nextId,seq:0,tracks,trackSlots,trace};
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
  const ownedInput=isCapturedCoreData297(input);
  const rows=this.expandPaths297(before.actorScene,input.actors,input.paths297);
  const actorScene=this.patchActors(before.actorScene,rows,input.toCore,input.poses297);
  let trackSlots=ownedInput?before.trackSlots:undefined;
  const direct=trackSlots?(input.tracks.length?copyOwnedTrackRows297(before.tracks):before.tracks):undefined;
  if(!direct)trackSlots=undefined;
  const trackMap=direct?undefined:new Map(before.tracks.map(t=>[t.id,t])),edited:number[]=[];
  for(let at=0;at<input.tracks.length;at++){const patch=input.tracks[at]!,slot=trackSlots?.get(patch.id),prior=direct?(slot===undefined?undefined:direct[slot]):trackMap!.get(patch.id);
   if(prior&&prior.id!==patch.id)throw Error('Core motion slot predecessor mismatch');
   if(!prior&&![...before.anchor.layout.human,...before.anchor.layout.animal,...before.anchor.layout.mechanical].includes(patch.id))throw Error('Unknown actor track outside the anchored layout');const previous=prior?.segments??[];
   if(patch.drop+patch.keep>previous.length||!prior&&(patch.drop!==0||patch.keep!==0))throw Error('Core motion predecessor mismatch');
   const segments=Object.freeze([...previous.slice(patch.drop,patch.drop+patch.keep),...patch.append]) as unknown as PresentationSegment[];
   // The incoming append is the parser's detached validated frozen graph.
   // The retained prefix is covered only by an actual predecessor proof. A
   // literal Full is deliberately not upgraded just because it is frozen.
   // Check exact element identities in the newly constructed array as well:
   // custom slice/species/iterator behavior cannot create a false proof.
   if(ownedInput&&(patch.keep===0||ownedPlaybackHistories297.has(previous))&&segments.length===patch.keep+patch.append.length){
    let exact=true;for(let i=0;i<patch.keep;i++)if(segments[i]!==previous[patch.drop+i]){exact=false;break;}
    for(let i=0;exact&&i<patch.append.length;i++)if(segments[patch.keep+i]!==patch.append[i])exact=false;
    if(exact)ownedPlaybackHistories297.add(segments);
   }
   const nextTrack=Object.freeze({id:patch.id,segments});
   if(direct){if(slot!==undefined){direct[slot]=nextTrack;edited.push(slot);}else{
    if(trackSlots===before.trackSlots)trackSlots=new Map(trackSlots);
    const index=direct.length;Object.defineProperty(direct,index,{value:nextTrack,writable:true,enumerable:true,configurable:true});(trackSlots as Map<number,number>).set(patch.id,index);edited.push(index);
   }}else trackMap!.set(patch.id,nextTrack);
  }
  const tracks=(direct?Object.freeze(direct):Object.freeze([...trackMap!.values()])) as unknown as PawnTrack[],trace=new Map(before.trace);
  if(direct&&tracks!==before.tracks){ownedTrackLists297.add(tracks);trackEdits297.set(tracks,{previous:new WeakRef(before.tracks),rows:Object.freeze(edited.sort((a,b)=>a-b).map(index=>tracks[index]!))});}
  for(const value of input.projectiles.upserted)trace.set(value.id,value);
  // removed means physical SIM cleanup, never erasure of playable history.
  for(const[id,value]of trace)if(value.endCore<input.toCore-640)trace.delete(id);
  const next:State={anchor:before.anchor,world:before.world,actorScene,actorMode:before.actorMode,core:input.toCore,nextId:input.nextId,seq:input.phaseSeq,tracks,trackSlots,trace};
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
 /** The anchored scene is already frozen and has unique IDs. Copy its index
  * once and replace only changed entries; unchanged actor wrappers remain
  * owned by both scenes. Pose records supersede physical rows in this packet,
  * exactly as the former second scene-building pass did. */
 private patchActors(base:CoreActorScene297,changes:readonly CoreActorProjection297[],core:number,poses:readonly CoreHumanPose297[]|undefined):CoreActorScene297 {
  if(changes.length===0&&!poses?.length)return Object.freeze({...base,core});
  let humans:Readonly<Pawn>[]|undefined,animals:Readonly<WildAnimal>[]|undefined,mechanical:Readonly<Mechanoid>[]|undefined;
  const byId:Record<number,CoreActorSceneRecord297>={...base.byId};
  for(const row of changes){const source=row.kind==='human'?(humans??base.humans)[row.index]:row.kind==='animal'?(animals??base.animals)[row.index]:(mechanical??base.mechanical)[row.index];
   if(!source||source.id!==row.id)throw Error('Changed Core actor escaped its anchored slot');
   const clone={...source} as unknown as Record<string,unknown>,optionals=row.kind==='human'?CORE_HUMAN_OPTIONAL297:row.kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
   for(const key of optionals)if(!Object.hasOwn(row.fields,key))delete clone[key];
   // An already-own key is assigned (no inherited setter can run); a new one is
   // defined. Freezing then gives the same frozen own-data record as before.
   const values=row.fields as unknown as Record<string,unknown>;
   for(const key of Object.keys(values)){if(Object.hasOwn(clone,key))clone[key]=values[key];else Object.defineProperty(clone,key,{value:values[key],enumerable:true,writable:true,configurable:true});}Object.freeze(clone);
   if(row.kind==='human'){const actor=clone as unknown as Readonly<Pawn>;(humans??=base.humans.slice())[row.index]=actor;byId[row.id]=Object.freeze({kind:row.kind,index:row.index,actor});}
   else if(row.kind==='animal'){const actor=clone as unknown as Readonly<WildAnimal>;(animals??=base.animals.slice())[row.index]=actor;byId[row.id]=Object.freeze({kind:row.kind,index:row.index,actor});}
   else {const actor=clone as unknown as Readonly<Mechanoid>;(mechanical??=base.mechanical.slice())[row.index]=actor;byId[row.id]=Object.freeze({kind:row.kind,index:row.index,actor});}
  }
  for(const row of poses??[]){
   const source=(humans??base.humans)[row.index];if(!source||source.id!==row.id||row.actor.id!==row.id)throw Error('Pose patch escaped its anchored slot');
   (humans??=base.humans.slice())[row.index]=row.actor;byId[row.id]=Object.freeze({kind:'human',index:row.index,actor:row.actor});
  }
  return Object.freeze({core,humans:Object.freeze(humans??base.humans),animals:Object.freeze(animals??base.animals),mechanical:Object.freeze(mechanical??base.mechanical),byId:Object.freeze(byId)});
 }
}

export {frozenDataCopy297} from './core-frozen-copy-297';
