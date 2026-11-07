import type {AudioCue} from './audio-cues';
import {peekTerrainJournalCursor,type TerrainJournalCursor} from '../sim/terrain-mutation-journal';
import {captureActorPhaseDependencies297,patchableDependencyChanges297,samePilePresentation297,humanWorkContact297,type ActorPhaseDependencies297} from './actor-phase-dependencies-297';
import type {World,Pawn,MaterialPile} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import type {PresentationSegment} from '../sim/travel-timing';
import type {PawnTrack} from './motion-tracks';
import {effectiveCore297} from '../sim/core-phase-297';
import {captureCoreActor297,coreAnchor297,coreMapId297,validCoreAudioCues297} from './core-phase-data-297';
import type {CoreActorProjection297,CorePhaseAnchor297,CorePhaseEnvelope297,CoreFullPhaseMetadata297,CoreProjectileEvents297,CoreProjectileTrace297,CoreMotionPatch297,CoreHumanPose297,CoreDoorPatch297,CorePilePatch297} from './core-phase-projection-297';
import {structureById} from '../sim/structure-navigation';
import {frozenDataCopy297} from './core-frozen-copy-297';

type PriorTrack={sources:readonly PresentationSegment[];values:readonly PresentationSegment[]};
const own=Object.hasOwn;
function sameCoreValue297(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a))return Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameCoreValue297(v,b[i]));
 if(Array.isArray(b))return false;const x=Object.keys(a),y=Object.keys(b);return x.length===y.length&&x.every((k,i)=>k===y[i]&&sameCoreValue297((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
interface SourceCommit {anchor:CorePhaseAnchor297;core:number;seq:number;nextId:number;tracks:Map<number,PriorTrack>;actorMode297?:'frontier';dependencies?:ActorPhaseDependencies297;terrainCursor?:TerrainJournalCursor}
export interface CorePhaseStepObservation297 {readonly core:number;readonly actorsChanged:readonly number[];readonly projectileEvents:CoreProjectileEvents297;readonly requiresFull:boolean;
 /** World changed in a way a calm Full may publish (ground presentation,
  * unexplained allocations): like a completed macro, never a hard barrier. */
 readonly deferredFull297?:boolean}
/** The caller owns the actual committed Engine World and Recorder. This class
 * never samples wall time to invent physical progress. Its wall budget limits
 * publication only, not simulation or command/fault barriers. */
export class CorePhasePublisher297 {
 private state:SourceCommit|undefined;
 private readonly dirtyActors=new Set<number>();
 private readonly retained=new Map<number,CoreProjectileTrace297>();
 private readonly fxUpserted=new Map<number,CoreProjectileTrace297>();
 private readonly fxRemoved=new Set<number>();
 private pendingCore:number|undefined;
 private fullPending=false;
 private quietFullPending=false;
 private macroActorProofPending297=false;
 private quietObservedAt:number|undefined;
 private lastSentAt=-Infinity;
 private sourceGeneration=0;
 private readonly slots=new Map<number,{kind:CoreActorProjection297['kind'];index:number}>();
 /** Frontier humans whose only dependency change since the committed baseline
  * is their contact/animation pose, and the dependencies that include those
  * changes. The next actor packet carries a pose patch for each of them and
  * then adopts these dependencies as the new baseline; a Full clears both. */
 private readonly poseDirty297=new Set<number>();
 private pendingDependencies297:ActorPhaseDependencies297|undefined;
 /** Frontier doors that opened or closed since the last publication. */
 private readonly doorDirty297=new Set<number>();
 /** Frontier pile records as the renderer holds them: copied when the Full is
  * prepared, then updated by every committed pile patch. */
 private pileBaseline297:Map<number,Readonly<MaterialPile>>|undefined;
 /** A carried pile changed: the next actor packet carries a pile patch (every
  * pile whose presented record differs from the baseline, and the gone ones). */
 private pileDirty297=false;
 /** Last physical row sent per actor since the anchoring Full. A macro marks
  * every actor as a capture candidate; an actor whose captured fields equal
  * the ones the renderer already holds is not sent again. */
 private readonly sentRows297=new Map<number,CoreActorProjection297>();
 reset():void{this.pileBaseline297=undefined;this.pileDirty297=false;this.sentRows297.clear();this.doorDirty297.clear();this.poseDirty297.clear();this.pendingDependencies297=undefined;this.state=undefined;this.dirtyActors.clear();this.retained.clear();this.fxUpserted.clear();this.fxRemoved.clear();this.pendingCore=undefined;this.fullPending=false;this.quietFullPending=false;this.macroActorProofPending297=false;this.quietObservedAt=undefined;this.lastSentAt=-Infinity;this.sourceGeneration++;this.slots.clear();}
 get needsFull():boolean{return this.fullPending||this.quietFullPending||!this.state;}
 /** Quiet needs a new complete anchor at the logical tail. Only an explicitly
  * committed frontier anchor permits confirmed actors to cross a calm macro. */
 get canDeferFull():boolean{return !!this.state&&this.quietFullPending&&!this.fullPending;}
 get frontierMode297():boolean{return this.state?.actorMode297==='frontier';}
 get canPublishActors297():boolean{return !!this.state&&!this.fullPending&&!this.macroActorProofPending297&&(!this.quietFullPending||this.frontierMode297);}
 /** Read-only O(1) proof against the last committed genuine Full codec.
  * Unknown ownership, any mark/invalidation, replacement or overflow remains
  * UNKNOWN/changed: no enroll, ring scan, sort or speculative terrain reuse. */
 terrainNeedsFull297(world:World):boolean {
  const before=this.state;if(!before||before.actorMode297!=='frontier')return false;
  const current=peekTerrainJournalCursor(world.tiles),prior=before.terrainCursor;
  return !prior||!current||prior.journal!==current.journal||prior.version!==current.version;
 }
 /** A failed eligibility check requests the existing genuine Full path; it
  * never consumes the recorder prefix or relaxes the representation reader. */
 audioFitsPhase297(world:World,cues:readonly AudioCue[]):boolean {
  return !!this.state&&validCoreAudioCues297(cues,this.state.core,effectiveCore297(world));
 }
 /** Called only after the WHOLE macro suffix committed. Membership and every
  * anchored slot are checked before all actors become capture candidates.
  * Dependencies are owned snapshots seeded only by a successful Full commit. */
 observeMacroActors297(world:World):void {
  const before=this.state;if(!before||before.actorMode297!=='frontier'||!before.dependencies){this.requestFull();return;}
  if(!this.macroActorProofPending297||this.pendingCore!==effectiveCore297(world)||this.pendingCore%10!==0)throw Error('Macro actor proof escaped its committed suffix');
  if(this.fullPending)return;
  if(this.terrainNeedsFull297(world)){this.requestFull();return;}
  const populations={human:world.pawns,animal:world.wildlife?.animals??[],mechanical:world.mechanoids??[]};
  for(const kind of ['human','animal','mechanical'] as const){const actors=populations[kind],layout=before.anchor.layout[kind];
   if(actors.length!==layout.length||layout.some((id,index)=>actors[index]?.id!==id)){this.requestFull();return;}
  }
  const dependencies=captureActorPhaseDependencies297(world);
  // Compared with the latest baseline, including patches not yet sent. Only
  // contact/animation pose and carried-pile changes of existing humans can
  // travel as frontier patches; anything else still requires a genuine Full.
  const changes=patchableDependencyChanges297(this.pendingDependencies297??before.dependencies,dependencies);
  if(!changes||changes.cargo&&!this.pileBaseline297){this.requestFull();return;}
  if(changes.humans.length){for(const id of changes.humans)this.poseDirty297.add(id);this.pendingDependencies297=dependencies;}
  if(changes.cargo)this.pileDirty297=true;
  for(const id of this.slots.keys())this.dirtyActors.add(id);
  this.macroActorProofPending297=false;this.sourceGeneration++;
 }
 /** Real monotone wall age bounds quiet deferral, never physical progress. */
 quietBudgetExpired(now:number):boolean {
  if(!Number.isFinite(now)||this.quietObservedAt!==undefined&&now<this.quietObservedAt)throw Error('Nonmonotone quiet publication time');
  return this.quietObservedAt!==undefined&&now-this.quietObservedAt>=20;
 }
 get hasPending():boolean{return this.pendingCore!==undefined||this.fullPending||this.quietFullPending;}
 /** Unsent actual events only; retained playback history is not a barrier. */
 get hasPendingProjectileEvents():boolean{return this.fxUpserted.size>0||this.fxRemoved.size>0;}
 allocatorNeedsFull(world:World):boolean {
  const old=this.state;if(!old)return true;if(world.nextId<old.nextId)throw Error('Core allocator moved backward');
  const born=[...this.fxUpserted.keys()].filter(id=>id>=old.nextId).sort((a,b)=>a-b);
  return born.length!==world.nextId-old.nextId||born.some((id,i)=>id!==old.nextId+i);
 }
 requestFull():void{this.fullPending=true;this.sourceGeneration++;}
 /** A calm (coalesced) Full, as after a completed macro; frontier actors keep
  * streaming until it is published. */
 /** Frontier only: the next actor packet carries these doors' presentation
  * state instead of a hard Full. */
 markDoors297(ids:readonly number[]):void{if(!this.frontierMode297)throw Error('Door patches require a frontier anchor');for(const id of ids)this.doorDirty297.add(id);if(ids.length)this.sourceGeneration++;}
 deferFull297(now:number):void{if(this.quietObservedAt===undefined)this.quietObservedAt=now;this.quietFullPending=true;this.sourceGeneration++;}
 observe(value:CorePhaseStepObservation297,macro:boolean,observedAt=performance.now()):void {
  if(macro&&(!Number.isFinite(observedAt)||observedAt<0||this.quietObservedAt!==undefined&&observedAt<this.quietObservedAt))throw Error('Nonmonotone quiet observation time');
  if(!Number.isSafeInteger(value.core)||value.core<0||this.pendingCore!==undefined&&value.core<this.pendingCore)throw Error('Nonmonotone committed Core observation');
  for(const id of value.actorsChanged)this.dirtyActors.add(id);
  for(const trace of value.projectileEvents.upserted){const owned=frozenDataCopy297(trace);this.retained.set(trace.id,owned);this.fxUpserted.set(trace.id,owned);}
  for(const id of value.projectileEvents.removed)this.fxRemoved.add(id);
  // Retention is history, not the World projectile collection lifetime.
  for(const[id,trace]of this.retained)if(trace.endCore<value.core-640)this.retained.delete(id);
  const quiet=macro||!!value.deferredFull297;
  if(quiet&&this.quietObservedAt===undefined)this.quietObservedAt=observedAt;
  this.pendingCore=value.core;this.quietFullPending||=quiet;this.fullPending||=value.requiresFull;
  if(macro&&this.frontierMode297)this.macroActorProofPending297=true;
  this.sourceGeneration++;
 }
 due(now:number):boolean {if(!Number.isFinite(now))throw Error('Invalid publication time');return now-this.lastSentAt>=20;}
 private captureTracks(tracks:readonly PawnTrack[]){
  const previous=this.state?.tracks??new Map<number,PriorTrack>(),next=new Map<number,PriorTrack>(),patches:CoreMotionPatch297[]=[];
  for(const track of tracks){const prior=previous.get(track.id),current=track.segments;let drop=0,keep=0;
   if(prior){drop=current.length?prior.sources.indexOf(current[0]!):prior.sources.length;if(drop<0)drop=0;while(keep<current.length&&drop+keep<prior.sources.length&&current[keep]===prior.sources[drop+keep]){const piece=current[keep]!;if((own(piece,'stagger')||own(piece,'stuns'))&&!sameCoreValue297(prior.values[drop+keep],piece))break;keep++;}}
   // Recorder owns segment identities. All newly appended pieces are copied at
   // this synchronous publication boundary, including corrections/stationary STOP.
   const appended=current.slice(keep).map(value=>frozenDataCopy297(value));
   const values=prior?prior.values.slice(drop,drop+keep).concat(appended):appended;
   if(!prior||drop||keep!==prior.sources.length||appended.length)patches.push(Object.freeze({id:track.id,drop,keep,append:Object.freeze(appended)}));
   next.set(track.id,{sources:current.slice(),values});
  }
  for(const id of previous.keys())if(!next.has(id))throw Error('Recorder membership change requires a full anchor');
  return{next,patches};
 }
 preparePhase(world:World,tracks:readonly PawnTrack[],speed:0|1|3|6,audioCues:readonly AudioCue[]=[]){
  if(audioCues.length>128)throw Error('Core phase audio exceeds the existing pending bound');
  if(this.terrainNeedsFull297(world))this.requestFull();
  const before=this.state,generation=this.sourceGeneration;if(!before||!this.canPublishActors297)throw Error('Full publication must precede actor watermark');
  const core=effectiveCore297(world);if(this.pendingCore!==core||coreMapId297(world)!==before.anchor.mapId||before.actorMode297!=='frontier'&&Math.floor(core/10)!==Math.floor(before.anchor.core/10))throw Error('Actor watermark escaped its actual World anchor');
  const rows:CoreActorProjection297[]=[];
  for(const id of this.dirtyActors){const slot=this.slots.get(id);if(!slot)throw Error('New actor requires a full membership anchor');const source=slot.kind==='human'?world.pawns[slot.index]:slot.kind==='animal'?world.wildlife?.animals[slot.index]:world.mechanoids?.[slot.index];if(!source||source.id!==id)throw Error('Changed actor escaped its full layout');
   const row=slot.kind==='human'?captureCoreActor297('human',slot.index,source as Pawn):slot.kind==='animal'?captureCoreActor297('animal',slot.index,source as WildAnimal):captureCoreActor297('mechanical',slot.index,source as Mechanoid);
   const sent=this.sentRows297.get(id);if(sent&&sent.kind===row.kind&&sent.index===row.index&&sameCoreValue297(sent.fields,row.fields)&&!this.poseDirty297.has(id))continue;
   rows.push(row);}
  rows.sort((a,b)=>a.id-b.id);
  const poses=before.actorMode297==='frontier'&&this.poseDirty297.size?this.capturePoses297(world):[];
  const doors:CoreDoorPatch297[]=[];
  if(before.actorMode297==='frontier')for(const id of [...this.doorDirty297].sort((a,b)=>a-b)){const s=structureById(world,id);if(s?.door)doors.push(frozenDataCopy297({id,door:s.door}) as CoreDoorPatch297);}
  const piles=before.actorMode297==='frontier'&&this.pileDirty297?this.capturePiles297(world):[];
  const motion=this.captureTracks(tracks),packet:CorePhaseEnvelope297=Object.freeze({type:before.actorMode297==='frontier'?'actor-frontier-297':'actor-phase-297',audioCues:frozenDataCopy297(audioCues),epoch:before.anchor.epoch,mapId:before.anchor.mapId,baseRevision:before.anchor.revision,phaseSeq:before.seq+1,nextId:world.nextId,fromCore:before.core,toCore:core,speed,actors:Object.freeze(rows),tracks:Object.freeze(motion.patches),projectiles:Object.freeze({upserted:Object.freeze([...this.fxUpserted.values()]),removed:Object.freeze([...this.fxRemoved])}),...poses.length?{poses297:Object.freeze(poses)}:{},...doors.length?{doors297:Object.freeze(doors)}:{},...piles.length?{piles297:Object.freeze(piles)}:{}});
  return{packet,before,generation,next:{anchor:before.anchor,core,seq:packet.phaseSeq,nextId:world.nextId,tracks:motion.next,...before.actorMode297?{actorMode297:before.actorMode297,dependencies:this.pendingDependencies297??before.dependencies,terrainCursor:before.terrainCursor}:{}}};
 }
 commitPhase(prepared:ReturnType<CorePhasePublisher297['preparePhase']>,sentAt:number):void {
  if(prepared.before!==this.state||prepared.generation!==this.sourceGeneration||!Number.isFinite(sentAt))throw Error('Stale actor publication');
  this.state=prepared.next;this.lastSentAt=sentAt;this.dirtyActors.clear();this.fxUpserted.clear();this.fxRemoved.clear();this.pendingCore=undefined;
  for(const row of prepared.packet.actors)this.sentRows297.set(row.id,row);
  this.poseDirty297.clear();this.pendingDependencies297=undefined;this.doorDirty297.clear();
  const piles=prepared.packet.piles297;
  if(piles){const base=this.pileBaseline297!;for(const row of piles){if(row.pile)base.set(row.id,row.pile);else base.delete(row.id);}}
  this.pileDirty297=false;
 }
 /** Every pile whose presented record differs from the baseline (complete
  * current record), and every baseline pile that is gone (null), by id. */
 private capturePiles297(world:World):CorePilePatch297[] {
  const base=this.pileBaseline297;if(!base)throw Error('Pile patch requires a Full pile baseline');
  const rows:CorePilePatch297[]=[],seen=new Set<number>();
  for(const pile of world.piles){seen.add(pile.id);const prior=base.get(pile.id);if(!prior||!samePilePresentation297(pile,prior))rows.push(frozenDataCopy297({id:pile.id,pile}) as CorePilePatch297);}
  if(seen.size!==base.size||rows.length)for(const id of base.keys())if(!seen.has(id))rows.push(Object.freeze({id,pile:null}));
  return rows.sort((a,b)=>a.id-b.id);
 }
 /** Complete current records of the pose-dirty humans with the contact the
  * Full renderer would derive from the live World: work pose, reach, and the
  * facing toward the work target (null when no target sets it). */
 private capturePoses297(world:World):CoreHumanPose297[] {
  const pawnsById=new Map(world.pawns.map(p=>[p.id,p] as const));let jobs:Map<number,World['jobs'][number]>|undefined;const poses:CoreHumanPose297[]=[];
  for(const id of [...this.poseDirty297].sort((a,b)=>a-b)){
   const slot=this.slots.get(id);if(!slot||slot.kind!=='human')throw Error('Pose patch escaped its full layout');
   const pawn=world.pawns[slot.index];if(!pawn||pawn.id!==id)throw Error('Pose patch escaped its full layout');
   const contact=humanWorkContact297(world,pawn,pawnsById,jobs,Number.NaN);jobs=contact.jobsById;
   const job=pawn.jobId===null?undefined:(jobs??=new Map(world.jobs.map(j=>[j.id,j]))).get(pawn.jobId);
   poses.push(frozenDataCopy297({id,index:slot.index,actor:pawn,job:job??null,workPose:contact.workPose,reach:{x:contact.reach.x,z:contact.reach.z},yaw:Number.isNaN(contact.yaw)?null:contact.yaw}) as CoreHumanPose297);
  }
  return poses;
 }
 /** Called immediately before real full encoding; no live alias survives yield.
  * Actual send must finish synchronously before commitFull. */
 prepareFull(world:World,epoch:number,revision:number,tracks:readonly PawnTrack[],mapId=coreMapId297(world),actorMode297?:'frontier'){
  const core=effectiveCore297(world),anchor=coreAnchor297(world,epoch,revision,core,mapId),generation=this.sourceGeneration;
  // Seed traces from actual current projectiles as well as prior phase events,
  // e.g. initial load or an immediate paused command publication.
  const retained=new Map(this.retained);
  for(const p of world.projectiles??[]){const f=p.flight,durationCore=Math.max(.001,Math.hypot(f.destination.x-f.origin.x,f.destination.z-f.origin.z)/f.speedPerCoreTick),total=Math.ceil(durationCore);
   retained.set(p.id,frozenDataCopy297({id:p.id,emittedAtCore:p.emittedAtCore,endCore:p.arrival?p.advancedAtCore:p.emittedAtCore+total,durationCore,delayCore:total-durationCore,from:{x:f.origin.x,z:f.origin.z},to:{x:f.destination.x,z:f.destination.z},emp:p.weaponItem==='emp-launcher'}));}
  for(const[id,t]of retained)if(t.endCore<core-640)retained.delete(id);
  const dependencies=actorMode297==='frontier'?captureActorPhaseDependencies297(world):undefined;
  const piles=actorMode297==='frontier'?new Map(world.piles.map(p=>[p.id,frozenDataCopy297(p) as Readonly<MaterialPile>])):undefined;
  // Runtime invokes this AFTER its actual snapshots.encode completed. The
  // closed codec alone enrolls tiles. A read-only peek can never repair them.
  const capturedTerrain=actorMode297==='frontier'?peekTerrainJournalCursor(world.tiles):undefined,terrainCursor=capturedTerrain&&Object.freeze(capturedTerrain);
  const metadata:CoreFullPhaseMetadata297=frozenDataCopy297({mapId:anchor.mapId,core,projectilesRetained:[...retained.values()],...actorMode297?{actorMode297}:{}}),nextTracks=new Map<number,PriorTrack>();
  for(const track of tracks)nextTracks.set(track.id,{sources:track.segments.slice(),values:track.segments.map(value=>frozenDataCopy297(value))});
  return{metadata,anchor,core,generation,tracks:nextTracks,retained,actorMode297,dependencies,terrainCursor,piles};
 }
 commitFull(prepared:ReturnType<CorePhasePublisher297['prepareFull']>,sentAt:number):void {
  if(prepared.generation!==this.sourceGeneration||!Number.isFinite(sentAt))throw Error('Full Core publication raced a new phase');
  this.state={anchor:prepared.anchor,core:prepared.core,seq:0,nextId:prepared.anchor.nextId,tracks:prepared.tracks,...prepared.actorMode297?{actorMode297:prepared.actorMode297,dependencies:prepared.dependencies,terrainCursor:prepared.terrainCursor}:{}};this.lastSentAt=sentAt;
  this.retained.clear();for(const[id,t]of prepared.retained)this.retained.set(id,t);
  this.slots.clear();for(const kind of ['human','animal','mechanical'] as const)prepared.anchor.layout[kind].forEach((id,index)=>this.slots.set(id,{kind,index}));
  this.dirtyActors.clear();this.fxUpserted.clear();this.fxRemoved.clear();this.pendingCore=undefined;this.fullPending=false;this.quietFullPending=false;this.macroActorProofPending297=false;this.quietObservedAt=undefined;this.sourceGeneration++;
  this.poseDirty297.clear();this.pendingDependencies297=undefined;this.doorDirty297.clear();this.sentRows297.clear();
  this.pileBaseline297=prepared.piles;this.pileDirty297=false;
 }
}
