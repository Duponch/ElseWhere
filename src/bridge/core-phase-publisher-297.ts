import type {AudioCue} from './audio-cues';
import {peekTerrainJournalCursor,type TerrainJournalCursor} from '../sim/terrain-mutation-journal';
import {captureActorPhaseDependencies297,equalActorPhaseDependencies297,type ActorPhaseDependencies297} from './actor-phase-dependencies-297';
import type {World,Pawn} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import type {PresentationSegment} from '../sim/travel-timing';
import type {PawnTrack} from './motion-tracks';
import {effectiveCore297} from '../sim/core-phase-297';
import {captureCoreActor297,coreAnchor297,coreMapId297,validCoreAudioCues297} from './core-phase-data-297';
import type {CoreActorProjection297,CorePhaseAnchor297,CorePhaseEnvelope297,CoreFullPhaseMetadata297,CoreProjectileEvents297,CoreProjectileTrace297,CoreMotionPatch297} from './core-phase-projection-297';
import {frozenDataCopy297} from './core-frozen-copy-297';

type PriorTrack={sources:readonly PresentationSegment[];values:readonly PresentationSegment[]};
const own=Object.hasOwn;
function sameCoreValue297(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a))return Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameCoreValue297(v,b[i]));
 if(Array.isArray(b))return false;const x=Object.keys(a),y=Object.keys(b);return x.length===y.length&&x.every((k,i)=>k===y[i]&&sameCoreValue297((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
interface SourceCommit {anchor:CorePhaseAnchor297;core:number;seq:number;nextId:number;tracks:Map<number,PriorTrack>;actorMode297?:'frontier';dependencies?:ActorPhaseDependencies297;terrainCursor?:TerrainJournalCursor}
export interface CorePhaseStepObservation297 {readonly core:number;readonly actorsChanged:readonly number[];readonly projectileEvents:CoreProjectileEvents297;readonly requiresFull:boolean}
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
 reset():void{this.state=undefined;this.dirtyActors.clear();this.retained.clear();this.fxUpserted.clear();this.fxRemoved.clear();this.pendingCore=undefined;this.fullPending=false;this.quietFullPending=false;this.macroActorProofPending297=false;this.quietObservedAt=undefined;this.lastSentAt=-Infinity;this.sourceGeneration++;this.slots.clear();}
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
  if(!equalActorPhaseDependencies297(before.dependencies,dependencies)){this.requestFull();return;}
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
 observe(value:CorePhaseStepObservation297,macro:boolean,observedAt=performance.now()):void {
  if(macro&&(!Number.isFinite(observedAt)||observedAt<0||this.quietObservedAt!==undefined&&observedAt<this.quietObservedAt))throw Error('Nonmonotone quiet observation time');
  if(!Number.isSafeInteger(value.core)||value.core<0||this.pendingCore!==undefined&&value.core<this.pendingCore)throw Error('Nonmonotone committed Core observation');
  for(const id of value.actorsChanged)this.dirtyActors.add(id);
  for(const trace of value.projectileEvents.upserted){const owned=frozenDataCopy297(trace);this.retained.set(trace.id,owned);this.fxUpserted.set(trace.id,owned);}
  for(const id of value.projectileEvents.removed)this.fxRemoved.add(id);
  // Retention is history, not the World projectile collection lifetime.
  for(const[id,trace]of this.retained)if(trace.endCore<value.core-640)this.retained.delete(id);
  if(macro&&this.quietObservedAt===undefined)this.quietObservedAt=observedAt;
  this.pendingCore=value.core;this.quietFullPending||=macro;this.fullPending||=value.requiresFull;
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
   rows.push(slot.kind==='human'?captureCoreActor297('human',slot.index,source as Pawn):slot.kind==='animal'?captureCoreActor297('animal',slot.index,source as WildAnimal):captureCoreActor297('mechanical',slot.index,source as Mechanoid));}
  rows.sort((a,b)=>a.id-b.id);
  const motion=this.captureTracks(tracks),packet:CorePhaseEnvelope297=Object.freeze({type:before.actorMode297==='frontier'?'actor-frontier-297':'actor-phase-297',audioCues:frozenDataCopy297(audioCues),epoch:before.anchor.epoch,mapId:before.anchor.mapId,baseRevision:before.anchor.revision,phaseSeq:before.seq+1,nextId:world.nextId,fromCore:before.core,toCore:core,speed,actors:Object.freeze(rows),tracks:Object.freeze(motion.patches),projectiles:Object.freeze({upserted:Object.freeze([...this.fxUpserted.values()]),removed:Object.freeze([...this.fxRemoved])})});
  return{packet,before,generation,next:{anchor:before.anchor,core,seq:packet.phaseSeq,nextId:world.nextId,tracks:motion.next,...before.actorMode297?{actorMode297:before.actorMode297,dependencies:before.dependencies,terrainCursor:before.terrainCursor}:{}}};
 }
 commitPhase(prepared:ReturnType<CorePhasePublisher297['preparePhase']>,sentAt:number):void {
  if(prepared.before!==this.state||prepared.generation!==this.sourceGeneration||!Number.isFinite(sentAt))throw Error('Stale actor publication');
  this.state=prepared.next;this.lastSentAt=sentAt;this.dirtyActors.clear();this.fxUpserted.clear();this.fxRemoved.clear();this.pendingCore=undefined;
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
  // Runtime invokes this AFTER its actual snapshots.encode completed. The
  // closed codec alone enrolls tiles. A read-only peek can never repair them.
  const capturedTerrain=actorMode297==='frontier'?peekTerrainJournalCursor(world.tiles):undefined,terrainCursor=capturedTerrain&&Object.freeze(capturedTerrain);
  const metadata:CoreFullPhaseMetadata297=frozenDataCopy297({mapId:anchor.mapId,core,projectilesRetained:[...retained.values()],...actorMode297?{actorMode297}:{}}),nextTracks=new Map<number,PriorTrack>();
  for(const track of tracks)nextTracks.set(track.id,{sources:track.segments.slice(),values:track.segments.map(value=>frozenDataCopy297(value))});
  return{metadata,anchor,core,generation,tracks:nextTracks,retained,actorMode297,dependencies,terrainCursor};
 }
 commitFull(prepared:ReturnType<CorePhasePublisher297['prepareFull']>,sentAt:number):void {
  if(prepared.generation!==this.sourceGeneration||!Number.isFinite(sentAt))throw Error('Full Core publication raced a new phase');
  this.state={anchor:prepared.anchor,core:prepared.core,seq:0,nextId:prepared.anchor.nextId,tracks:prepared.tracks,...prepared.actorMode297?{actorMode297:prepared.actorMode297,dependencies:prepared.dependencies,terrainCursor:prepared.terrainCursor}:{}};this.lastSentAt=sentAt;
  this.retained.clear();for(const[id,t]of prepared.retained)this.retained.set(id,t);
  this.slots.clear();for(const kind of ['human','animal','mechanical'] as const)prepared.anchor.layout[kind].forEach((id,index)=>this.slots.set(id,{kind,index}));
  this.dirtyActors.clear();this.fxUpserted.clear();this.fxRemoved.clear();this.pendingCore=undefined;this.fullPending=false;this.quietFullPending=false;this.macroActorProofPending297=false;this.quietObservedAt=undefined;this.sourceGeneration++;
 }
}
