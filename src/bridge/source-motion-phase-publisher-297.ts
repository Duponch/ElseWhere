import {CorePhasePublisher297} from './core-phase-publisher-297.ts';
import {captureOwnedCoreSourceData297,captureCoreActorSharedSource297,sameCapturedActor297,verifyOwnedCoreSourceData297,sliceOwnedCoreSourceData297,type OwnedCoreSourceData297} from './core-frozen-copy-297.ts';
import {actorMotionSourceStamp297} from '../sim/actor-motion-source-297.ts';
import {actorPathSourcePosition297,type ActorPathSourcePosition297} from '../sim/actor-path-source-297.ts';
import {actorRecordSourceShape297,verifyActorRecordSource297,revokeActorRecordSource297,type ActorRecordSourceShape297} from '../sim/actor-record-source-297.ts';
import {verifyTerrainWriteCaches} from '../sim/terrain-mutation-journal.ts';
import {verifyResourceJournal,closedResourceIdentityLookup} from '../sim/resource-mutation-journal.ts';
import {captureActorPhaseDependenciesWithResourceJoin297,type ActorPhaseDependencies297} from './actor-phase-dependencies-297.ts';
import {OrdinaryPilePublication379} from './ordinary-pile-publication-379.ts';
import {PhasePilePublication379} from './phase-pile-publication-379';
import {ActorPileJoinOwner379} from './actor-pile-join-379';
import type {CoreActorProjection297,CorePilePatch297} from './core-phase-projection-297.ts';
import type {Pawn,World,MaterialPile} from '../sim/types.ts';
import type {WildAnimal} from '../sim/wildlife-state.ts';
import type {Mechanoid} from '../sim/mechanoid-state.ts';
import type {TravelSegment} from '../sim/travel-timing.ts';
import type {PawnTrack} from './motion-tracks.ts';
import type {AudioCue} from './audio-cues.ts';
type Actor297=Pawn|WildAnimal|Mechanoid;
interface PathCache297 {identity:object;cells:readonly unknown[];baseDrop:number;owned?:OwnedCoreSourceData297;ownedDrop:number}
interface HeldPath297 {position:ActorPathSourcePosition297;cache:PathCache297}
export interface ActorPhaseSourceWork297 {readonly core:number;readonly rows:number;readonly retainedActors:number;readonly discoveredActors:number;readonly motionCopies:number;readonly motionRetentions:number;readonly pathCopies:number;readonly pathSlices:number;readonly pathTailProofs:number;readonly pathTailWalks:number;readonly pileProofs:number;readonly pileComparisons:number;readonly pileCopies:number}
type Work297={-readonly [K in Exclude<keyof ActorPhaseSourceWork297,'core'|'rows'>]:ActorPhaseSourceWork297[K]}&{seen:Set<object>};

/** Fixed deserialized Worker only. A motion is copied/validated once after
 * its actual producer writes it, then every actor row keeps that fully owned
 * frozen tree. Unknown sources retain the public complete capture. */
export class SourceMotionPhasePublisher297 extends CorePhasePublisher297 {
 private readonly motions=new WeakMap<TravelSegment,{stamp:object;data:OwnedCoreSourceData297}>();
 private readonly paths=new WeakMap<readonly unknown[],PathCache297>();
 private readonly pathReferences=new WeakMap<object,HeldPath297>();
 private readonly ordinaryPiles:OrdinaryPilePublication379;
 private readonly pileDirectory:PhasePilePublication379;
 private readonly actorPiles:ActorPileJoinOwner379;
 private work:Work297|undefined;
 constructor(private readonly sourceOwner:object,private readonly observeSourceWork?:((work:ActorPhaseSourceWork297)=>void)){super();this.ordinaryPiles=new OrdinaryPilePublication379(sourceOwner);this.pileDirectory=new PhasePilePublication379(sourceOwner,{full:(p,prior)=>this.captureFullPileBaseline297(p,prior),same:(p,prior)=>this.samePilePresentation297(p,prior),patch:p=>this.capturePilePatch297(p)});this.actorPiles=new ActorPileJoinOwner379(sourceOwner);}
 override reset():void{super.reset();this.pileDirectory.reset();this.actorPiles.reset();}
 override preparePhase(world:World,tracks:readonly PawnTrack[],speed:0|1|3|6,audioCues:readonly AudioCue[]=[]):ReturnType<CorePhasePublisher297['preparePhase']> {
  if(!this.observeSourceWork)return super.preparePhase(world,tracks,speed,audioCues);
  const work:Work297={seen:new Set(),retainedActors:0,discoveredActors:0,motionCopies:0,motionRetentions:0,pathCopies:0,pathSlices:0,pathTailProofs:0,pathTailWalks:0,pileProofs:0,pileComparisons:0,pileCopies:0};this.work=work;
  try{const prepared=super.preparePhase(world,tracks,speed,audioCues),{seen:_seen,...counts}=work;this.observeSourceWork(Object.freeze({core:prepared.packet.toCore,rows:prepared.packet.actors.length,...counts}));return prepared;}finally{this.work=undefined;}
 }
 private shape(kind:CoreActorProjection297['kind'],actor:Actor297):ActorRecordSourceShape297|undefined {
  let shape=actorRecordSourceShape297(kind,actor,this.sourceOwner);
  if(shape&&(verifyTerrainWriteCaches||verifyResourceJournal)&&!verifyActorRecordSource297(shape)){revokeActorRecordSource297(actor);shape=undefined;}
  const work=this.work;if(work&&!work.seen.has(actor)){work.seen.add(actor);if(shape)work.retainedActors++;else work.discoveredActors++;}
  return shape;
 }
 private motion(actor:Pawn|WildAnimal|Mechanoid,shape?:ActorRecordSourceShape297):OwnedCoreSourceData297|undefined {
  let motion:TravelSegment|null|undefined;
  if(shape)motion=Object.hasOwn(actor,'motion')?actor.motion:undefined;
  else {const descriptor=Object.getOwnPropertyDescriptor(actor,'motion');if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))return;motion=descriptor.value as TravelSegment|null|undefined;}
  if(!motion||typeof motion!=='object')return;
  const stamp=actorMotionSourceStamp297(motion,this.sourceOwner);if(!stamp)return;
  let held=this.motions.get(motion);
  if(!held||held.stamp!==stamp){held={stamp,data:captureOwnedCoreSourceData297(motion)};this.motions.set(motion,held);if(this.work)this.work.motionCopies++;}
  else {if(this.work)this.work.motionRetentions++;if(verifyTerrainWriteCaches||verifyResourceJournal)verifyOwnedCoreSourceData297(held.data);}
  return held.data;
 }
 protected override captureActor297(kind:CoreActorProjection297['kind'],index:number,actor:Pawn|WildAnimal|Mechanoid,heldPath:boolean):CoreActorProjection297 {
  const shape=this.shape(kind,actor),motion=this.motion(actor,shape),path=heldPath?undefined:this.pathData(actor,shape);
  return motion||path||shape?captureCoreActorSharedSource297(kind,index,actor,heldPath,motion,path,shape):super.captureActor297(kind,index,actor,heldPath);
 }
 protected override sameActor297(kind:CoreActorProjection297['kind'],actor:Pawn|WildAnimal|Mechanoid,fields:Readonly<Record<string,unknown>>,heldPath:boolean):boolean {
  const shape=this.shape(kind,actor);
  // A known scalar difference already proves that a new row is needed. Do
  // not capture/extend owned motion and path suffixes merely to fail this
  // preliminary comparison, then capture the same subtrees a second time.
  if(shape&&!verifyTerrainWriteCaches&&!verifyResourceJournal){
   if(!Object.is(actor.x,fields.x)||!Object.is(actor.z,fields.z)||!Object.is(actor.state,fields.state))return false;
   if(kind==='animal'){if(!Object.is((actor as WildAnimal).nextDecision,fields.nextDecision))return false;}
   else {const moving=actor as Pawn|Mechanoid;if(!Object.is(moving.moveCooldown,fields.moveCooldown)||!Object.is(moving.planCooldown,fields.planCooldown)||kind==='mechanical'&&!Object.is((moving as Mechanoid).heading,fields.heading))return false;}
  }
  return sameCapturedActor297(kind,actor,fields,heldPath,this.motion(actor,shape),heldPath?undefined:this.pathData(actor,shape),shape);
 }
 protected override captureDependencies297(world:World,held?:ActorPhaseDependencies297):ActorPhaseDependencies297 {
  return captureActorPhaseDependenciesWithResourceJoin297(world,held,closedResourceIdentityLookup(world.resources,this.sourceOwner),this.actorPiles.capture(world));
 }
 protected override samePilePresentation297(pile:MaterialPile,previous:Readonly<MaterialPile>):boolean {
  if(this.ordinaryPiles.unchanged(pile,previous,()=>super.samePilePresentation297(pile,previous))){if(this.work)this.work.pileProofs++;return true;}
  if(this.work)this.work.pileComparisons++;
  const same=super.samePilePresentation297(pile,previous);if(same)this.ordinaryPiles.remember(pile,previous);return same;
 }
 protected override capturePilePatch297(pile:MaterialPile):CorePilePatch297 {
  const patch=super.capturePilePatch297(pile);if(patch.pile)this.ordinaryPiles.remember(pile,patch.pile);if(this.work)this.work.pileCopies++;return patch;
 }
 protected override captureFullPileBaseline297(pile:MaterialPile,previous:Readonly<MaterialPile>|undefined):Readonly<MaterialPile> {
  // This private baseline is used only by the rot-ignoring phase comparator.
  // A non-rot writer always creates a fresh patch with its current rot record.
  if(previous&&this.ordinaryPiles.unchanged(pile,previous,()=>super.samePilePresentation297(pile,previous)))return previous;
  const copy=super.captureFullPileBaseline297(pile,previous);this.ordinaryPiles.remember(pile,copy);return copy;
 }
 protected override prepareFullPileBaseline297(world:World,prior:Map<number,Readonly<MaterialPile>>|undefined){
  const draft=this.pileDirectory.prepare(world,prior,true);
  return {baseline:draft.baseline,updates:draft.rows,commit:draft.commit};
 }
 protected override preparePhasePiles297(world:World,baseline:Map<number,Readonly<MaterialPile>>){
  const draft=this.pileDirectory.prepare(world,baseline,false);
  return {rows:draft.rows,commit:draft.commit};
 }
 private sourcePath(live:unknown,copy:boolean):HeldPath297|undefined {
  const position=actorPathSourcePosition297(live,this.sourceOwner);if(!position||!Array.isArray(live))return;
  let cache=this.paths.get(live);
  if(!cache||cache.identity!==position.identity){cache={identity:position.identity,cells:live.slice(),baseDrop:position.dropped,ownedDrop:position.dropped};this.paths.set(live,cache);}
  if(copy){
   if(!cache.owned){cache.owned=captureOwnedCoreSourceData297(live);if(this.work)this.work.pathCopies++;}
   else if(cache.ownedDrop!==position.dropped){cache.owned=sliceOwnedCoreSourceData297(cache.owned,live,position.dropped-cache.ownedDrop);if(this.work)this.work.pathSlices++;}
   cache.ownedDrop=position.dropped;
   if(verifyTerrainWriteCaches||verifyResourceJournal)verifyOwnedCoreSourceData297(cache.owned);
  }
  return {position,cache};
 }
 private pathData(actor:Actor297,shape?:ActorRecordSourceShape297):OwnedCoreSourceData297|undefined {
  if(shape)return Object.hasOwn(actor,'path')?this.sourcePath(actor.path,true)?.cache.owned:undefined;
  const descriptor=Object.getOwnPropertyDescriptor(actor,'path');
  if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))return;
  return this.sourcePath(descriptor.value,true)?.cache.owned;
 }
 protected override captureActorPathReference297(live:unknown):unknown {
  const data=this.sourcePath(live,false);if(!data)return super.captureActorPathReference297(live);
  const reference={};this.pathReferences.set(reference,data);return reference;
 }
 protected override retainActorPathReference297(reference:unknown,from:number):unknown {
  const data=reference&&typeof reference==='object'?this.pathReferences.get(reference):undefined;
  if(!data)return super.retainActorPathReference297(reference,from);
  const next={};this.pathReferences.set(next,{cache:data.cache,position:{identity:data.position.identity,dropped:data.position.dropped+from,length:data.position.length-from}});return next;
 }
 private exhaustivePathTail(path:readonly {readonly x:number;readonly z:number}[],held:HeldPath297,live:unknown):number {
  if(!Array.isArray(live)||Object.getPrototypeOf(live)!==Array.prototype||held.position.length!==path.length)return -1;
  const count=live.length,from=path.length-count,offset=held.position.dropped-held.cache.baseDrop;if(from<0)return -1;
  for(let i=0;i<count;i++){
   const source=live[i] as {x?:unknown;z?:unknown}|null|undefined,copy=path[from+i]!;
   if(source===null||source===undefined||source!==held.cache.cells[offset+from+i]||source.x!==copy.x||source.z!==copy.z)return -1;
  }
  return count;
 }
 protected override heldActorPathTail297(path:readonly {readonly x:number;readonly z:number}[],reference:unknown,live:unknown):number {
  const held=reference&&typeof reference==='object'?this.pathReferences.get(reference):undefined;
  if(!held){if(this.work)this.work.pathTailWalks++;return super.heldActorPathTail297(path,reference,live);}
  const current=actorPathSourcePosition297(live,this.sourceOwner),before=held.position;
  if(!current||current.identity!==before.identity||path.length!==before.length||current.dropped-before.dropped!==before.length-current.length){if(this.work)this.work.pathTailWalks++;return this.exhaustivePathTail(path,held,live);}
  if((verifyTerrainWriteCaches||verifyResourceJournal)&&this.exhaustivePathTail(path,held,live)!==current.length)throw Error('Unmarked actor path source write');
  if(this.work)this.work.pathTailProofs++;return current.length;
 }
}
