import {isActualViewRequest301} from './actual-view-wire-301.ts';
import {setActualView301} from '../sim/actual-view-301.ts';
import {isSchema298OrLater} from '../sim/schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {createShipCountdownRuntime298} from './ship-countdown-runtime-298.ts';
import type {ShipRuntimeRequest298,ShipRuntimeResponse298,ShipOwnerReplyMetadata298} from './ship-countdown-wire-298.ts';
import {advanceWorldCore297} from '../sim/engine';
import {effectiveCore297} from '../sim/core-phase-297';
import {FixedCoreClock297} from './fixed-core-clock-297';
import {CorePhasePublisher297} from './core-phase-publisher-297';
import {coreMapId297,physicalVisibleCoreMap297} from './core-phase-data-297';
import type {CorePhaseEnvelope297} from './core-phase-projection-297';
/// <reference lib="webworker" />
import {pendingWorldEntry263} from '../sim/world-target-access-263';
import {prepareWorldTargetEntry263} from '../sim/world-target-entry-263';
import {validCaravanArrivalCommand261,takeCaravanTradeArrivals261} from '../sim/caravan-arrival-261';
import {validGeographicCreationSize262,validGeographicCreationSeason262} from '../sim/geographic-creation-options-262';
import {configuredGeographicStartClock256} from '../sim/geographic-start-clock-256';
import {geographicSurfaceTileClimateDefinition256} from '../sim/site-climate';
import {pendingCaravan261} from '../sim/caravan-incidents-261';
import {validCaravanCommand261} from '../sim/caravan-commands-261';
import {prepareActualBattlefieldEntry261} from '../sim/caravan-battlefield-entry-261';
import {isSchema256Or257} from '../sim/schema-compatibility-257.ts';
import {generateGeographicWorldDraft256,type GeographicWorldDraft256} from '../sim/world-geographic-draft';
import {captureGeneratedGeography256,type CampaignGeography256} from '../sim/world-geography-owner-256';
import {planetGeography256} from '../sim/planet-geography-256';
import {worldGenerationKey,validWorldGenerationSettings} from '../sim/world-generation-settings';
import {canPlaceWorldSettlement} from '../sim/world-settlement-placement';
import {createGeographicNewGame256} from '../sim/geographic-new-game-256';
import type {WorldCreationRequest256,WorldCreationTicket256} from '../ui/world-creation-contract';
import {validateWorld} from '../sim/serialization';
import {validStartingOriginalRequest256} from '../sim/starting-original-request-256';
import {ACTUAL_SHRINES_750_256} from '../sim/ancient-temple-orchestration-256';

import {prepareActualCampEntry256,prepareActualSettlementEntry257} from '../sim/group-camp-entry-256';
import {registeredCampaign} from '../sim/world-map-context';
import {groupEntryActions,validWorldMapCommand} from '../sim/world-map-authority';
import {GroupCampaignRuntime256} from '../sim/group-campaign-runtime-256';
import {GroupCaravanPhysical256} from '../sim/group-caravan-physical-256';
import {createGroupCampaignGeometry256} from '../sim/group-campaign-geometry-256';
import {preparePlanetNavigation256} from '../sim/planet-route-256';
import {configureSettlementLimit,validSettlementLimit} from '../sim/world-map-options';
import type {SettlementLimit,CampaignState} from '../sim/world-map-state';
import {selectedRegisteredMap} from '../sim/world-map-context';
import {campaignOnlySummary} from '../sim/world-map-presentation';
import {deserializeCampaign,serializeCampaign,serializeCampaignUnchecked} from '../sim/serialization';
import { UrgentThreatObserver, validThreatPauseMode, type ThreatPauseMode } from './urgent-threats';
import {selectedMap} from '../sim/secondary-site-context';
import {campaignPresentation,campaignPresentationView} from '../sim/secondary-site-presentation';
import { createScenarioWorld } from '../sim/new-game';
import { MotionRecorder } from './motion-tracks';
import { FixedClock } from './fixed-clock';
import {WorkerTaskScheduler} from './worker-task-scheduler';
import { PresentationChanges } from './presentation-changes';
import { queryOrderOptions } from '../sim/player-orders';
import {queryBillWorkerOptions283} from '../sim/bill-worker-owners-283';
import { applyCommand, deserializeWorld, serializeWorld, stepWorld } from '../sim/index';
import type { World } from '../sim/types';
import type { Request, Response, SimulationFault } from './protocol';
import { MAP_SIZE_PRESETS } from '../sim/map-config';
import { SnapshotEncoder,type SnapshotMessage } from './snapshots';
import { AudioCueRecorder } from './audio-cues';

/** Both fixed entrypoints execute this identical authoritative engine. The
 * closed entry supplies its concrete transport encoder; public default stays
 * complete. Request ordering, clocks, ACK and SAVE never select that boundary. */
export function startSimulationWorker(scope:DedicatedWorkerGlobalScope,send:(message:(Response&ShipOwnerReplyMetadata298)|ShipRuntimeResponse298)=>void,snapshots:SnapshotEncoder<true>=new SnapshotEncoder({structureDelta:true,minimumStructures:1000}),publishLocal?:(world:World,publication:SnapshotMessage<true>,originalPacket:SnapshotMessage<true>)=>void,createMotionRecorder:()=>MotionRecorder=()=>new MotionRecorder(),publishPhaseLocal?:(world:World,phase:CorePhaseEnvelope297)=>void):void {
let world: CampaignState | undefined;
let actualViewEpoch301=0;
const shipCountdown298=createShipCountdownRuntime298();
let caravans:GroupCampaignRuntime256|undefined;
/** Build on the validated replacement BEFORE changing the active owner. The
 * immutable geometry scan belongs to this cold boundary, never a tick/RAF. */
function prepareCaravans(root:CampaignState):GroupCampaignRuntime256|undefined {
 if(root.schemaVersion<256||!root.worldMaps||!root.worldGroups||!root.planet)return;
 if(root.planet.revision===3)preparePlanetNavigation256(root.planet);
 const runtime=new GroupCampaignRuntime256(createGroupCampaignGeometry256(root),new GroupCaravanPhysical256());runtime.bootstrap(root);return runtime;
}
let maxSettlements:SettlementLimit=1;
let speed = 1;
let threatPauseMode: ThreatPauseMode = 'major';
const urgentThreats = new UrgentThreatObserver();
const clock=new FixedClock();clock.reset(performance.now());
const coreClock297=new FixedCoreClock297();coreClock297.reset(performance.now());
const phasePublisher297=new CorePhasePublisher297();
type CoreBatch297={owner:CampaignState;remaining:number;completed:number;simulationMs:number};
let coreBatch297:CoreBatch297|undefined;
type LogicalTickBatch={owner:CampaignState;remaining:number;completed:number;simulationMs:number};
let logicalBatch:LogicalTickBatch|undefined,wakeDue=false;
const regularTasks=new WorkerTaskScheduler(runRegularTask);
function resetSimulationClock(now:number):void {
 logicalBatch=undefined;coreBatch297=undefined;wakeDue=false;regularTasks.invalidate();clock.reset(now);coreClock297.reset(now);
}
function cancelUnplayedSimulation(now:number):void {
 logicalBatch=undefined;coreBatch297=undefined;wakeDue=false;regularTasks.invalidate();clock.cancelUnplayed(now);coreClock297.cancelUnplayed(now);
}
// Core forcePause is a modal overlay, not an explicit player Pause. This
// bridge-only intent is never a saved World field or a permission to advance.
let neutralResume261:{root:CampaignState;pending:object;speed:number}|undefined;
/** WindowStack forcePause adaptation, distinct from a player speed request.
 * Created only at accepted owner/final boundaries; current uses one scalar ID. */
let shipCreditsHold298:{root:CampaignState;departureId:number}|undefined;
function shipCreditsHeld298():boolean {
  const held=shipCreditsHold298;return !!held&&held.root===world&&world?.escapedShips298?.credits===held.departureId;
}
function syncShipCreditsHold298(now:number):void {
  const root=world,id=isSchema298OrLater(root?.schemaVersion)?root.escapedShips298?.credits:undefined;
  shipCreditsHold298=root&&typeof id==='number'?{root,departureId:id}:undefined;
  if(shipCreditsHold298){speed=0;resetSimulationClock(now);}
}
function resumeAfterShipCredits298(now:number):void {
  shipCreditsHold298=undefined;
  // Native credits close chooses Normal, never the pre-credits speed. A neutral
  // encounter may still own forcePause and must later resume that same Normal.
  if(neutralResume261&&neutralResume261.root===world)neutralResume261.speed=1;
  const blocked=!world||!!fault||urgentThreats.snapshot().urgentHeld||!!pendingCaravan261(world)||!!pendingWorldEntry263(world)
    ||!!activeEncounter261||!!activeWorldEntry263||!!activeCamp256||!!creatingDraftColony||!!preparingWorldDraft;
  speed=blocked?0:1;resetSimulationClock(now);
}
function holdEncounterPause261(now:number):void {
 const root=world,pending=root&&pendingCaravan261(root)?.pending261;if(!root||!pending)return;
 if((pending.kind==='meeting'||pending.kind==='demand')&&pending.decision==='open'){
  if(!neutralResume261||neutralResume261.root!==root||neutralResume261.pending!==pending)neutralResume261={root,pending,speed};
 }else neutralResume261=undefined; // Fight/Attack/forced map keeps an actual pause.
 speed=0;resetSimulationClock(now);
}
function resumeNeutralEncounter261(previous:object|undefined):void {
 const held=neutralResume261;if(!held||!world||held.root!==world||held.pending!==previous||pendingCaravan261(world))return;
  neutralResume261=undefined;speed=shipCreditsHeld298()||urgentThreats.snapshot().urgentHeld?0:held.speed;resetSimulationClock(performance.now());
}
let lastPublishedTick=-1;
/** Wall time of the last complete publication; see publishDuePhysical297. */
let lastFullPublishedAt=-Infinity;
const CALM_FULL_INTERVAL_MS=250;
/** Frontier: oldest age of the published World when changes are pending. A
 * saturated Worker (large colony at high speed) may run long batches whose
 * tail comes rarely; the World is then refreshed within a batch at this age. */
const CALM_FULL_MAX_AGE_MS=500;
/** A calm Full costs a complete encode and send here, then a complete adoption
 * and world application on the main thread, both growing with the colony. Its
 * measured cost spaces calm Fulls: they stay near 1/CALM_FULL_COST_RATIO of the
 * time. A small colony keeps CALM_FULL_INTERVAL_MS; a large one refreshes its
 * slowly changing world state (jobs, items, plants, needs…) at most every
 * CALM_FULL_INTERVAL_MAX_MS. Actors, doors and carried piles keep streaming in
 * phase packets; commands, pauses and hard changes still publish at once.
 * The ratio was 8 until a Full became about a fifth cheaper here (10 November):
 * it follows that cost so the main thread keeps the same rhythm of adoptions
 * (about one per second on a large colony) instead of a faster one. */
const CALM_FULL_COST_RATIO=10,CALM_FULL_INTERVAL_MAX_MS=1000;
/** Smoothed wall cost of an ordinary (non-checkpoint) Full publication. */
let fullPublicationCostMs=0;
const calmFullIntervalMs=():number=>Math.min(CALM_FULL_INTERVAL_MAX_MS,Math.max(CALM_FULL_INTERVAL_MS,fullPublicationCostMs*CALM_FULL_COST_RATIO));
let stepMs = 0;
let fault: SimulationFault | undefined;
const motion = createMotionRecorder();
let presentationChanges=new PresentationChanges();
let observedWorld:World|undefined;
/* Within one committed Core observation nothing mutates the World between
 * the several visibleWorld() reads (observers, Full encode, publication), so
 * the campaign projection — rebuilt with whole-campaign people/bed captures —
 * is computed once per scope and reused (same object, same content). */
let presentationScope297=false,presentationMemo297:{owner:CampaignState;value:World}|undefined;
function visibleWorld():World|undefined {
  if(world?.worldMaps&&!selectedRegisteredMap(world)){observedWorld=undefined;return;}
  let current:World;
  if(presentationScope297&&presentationMemo297?.owner===world)current=presentationMemo297!.value;
  else{current=campaignPresentation(world! as World);if(presentationScope297)presentationMemo297={owner:world!,value:current};}
  if(current!==observedWorld){motion.reset();phasePublisher297.reset();audioCues.reset();presentationChanges=new PresentationChanges();observedWorld=current;}
  return current;
}
/* The owner check of visibleWorld() without rebuilding the projection's
 * campaign fields (people, bed references, map and group choices): a calm
 * frontier macro reads none of them, and the next complete publication rebuilds
 * them before encoding. An unknown or changed projection takes the complete
 * visibleWorld() path, with the same resets. */
function visibleOwner297():World|undefined {
  if(world?.worldMaps&&!selectedRegisteredMap(world)){observedWorld=undefined;return;}
  if(!(presentationScope297&&presentationMemo297?.owner===world)){const view=campaignPresentationView(world! as World);if(view!==undefined&&view===observedWorld)return view;}
  return visibleWorld();
}
const audioCues=new AudioCueRecorder();
// Tick publications use this only after the presentation observers captured that tick.
const publishCapturedTick = (checkpoint = false) => {
  let published: { epoch: number; revision: number } | undefined;
  if (world) {
    const publicationStarted=performance.now();
    const visible=visibleWorld();if(!visible){const header=snapshots.campaignHeader(checkpoint);actualViewEpoch301=header.epoch;setActualView301(world,null);send({type:'campaign-only',...header,stepMs,speed,...(()=>{const transport=snapshots.encodeCampaignSummary(campaignOnlySummary(world),checkpoint);return {summary:transport.state,...transport.geography?{geography:transport.geography}:{}};})(),urgentThreats:urgentThreats.snapshot()});audioCues.reset();lastPublishedTick=world.tick;for(const notice of takeCaravanTradeArrivals261(world))send({type:'caravan-trade-arrival',...notice,checkpoint:header});return header;}
    const audioPublication297=audioCues.preparePublication297(),cues=audioPublication297.cues;
    const packet = snapshots.encode(visible, stepMs, speed, checkpoint);
    if(actualViewEpoch301!==packet.epoch)setActualView301(world,null);
    actualViewEpoch301=packet.epoch;
    const recordedMotion=motion.snapshot();
    const physicalFull297=isCorePhysicalSchema297(Number(visible.schemaVersion))?phasePublisher297.prepareFull(visible,packet.epoch,packet.revision,recordedMotion,coreMapId297(physicalVisibleWorld297()!),'frontier'):undefined;
    const publication={...packet,urgentThreats:urgentThreats.snapshot(),motion:recordedMotion,...physicalFull297?{corePhase297:physicalFull297.metadata}:{},...cues.length?{audioCues:cues}:{}};
    // The fixed resident entry observes this exact confirmed World synchronously.
    // Commands, ACK, public snapshots and SAVE retain their existing path.
    if(publishLocal)publishLocal(visible,publication,packet);else send(publication);
    if(physicalFull297)phasePublisher297.commitFull(physicalFull297,performance.now());
    audioCues.commitPublication297(audioPublication297);
    published = { epoch: packet.epoch, revision: packet.revision };
    lastFullPublishedAt=performance.now();
    if(!checkpoint){const cost=lastFullPublishedAt-publicationStarted;fullPublicationCostMs=fullPublicationCostMs>0?fullPublicationCostMs*.7+cost*.3:cost;}
  }
  lastPublishedTick=world?.tick??-1;
  if(world&&published)for(const notice of takeCaravanTradeArrivals261(world))send({type:'caravan-trade-arrival',...notice,checkpoint:published});
  return published;
};
const publish = (checkpoint = false) => {
  if (world) {urgentThreats.prepareMaps(world);const visible=visibleWorld();if(visible){presentationChanges.capture(visible);motion.capture(visible);audioCues.capture(visible);}}
  return publishCapturedTick(checkpoint);
};

function stopFatal(error: unknown): void {
  if (fault) return;
  shipCountdown298.cleanup();
  shipCreditsHold298=undefined;
  neutralResume261=undefined;
  speed = 0;
  resetSimulationClock(performance.now());
  fault = { type: 'fault', speed: 0, ...(world ? { tick: world.tick } : {}),
    reason: `La simulation est arrêtée après une erreur. Le dernier tick peut être incomplet ; rechargez une colonie validée pour reprendre. ${error instanceof Error ? error.message : String(error)}` };
  send(fault);
}

interface ActiveCamp256 {id:number;groupId:number;root:CampaignState;cancelled:boolean}
let activeCamp256:ActiveCamp256|undefined;
function cancelCamp256(request:Extract<Request,{type:'camp-entry-cancel'}>):void {
 const active=activeCamp256;
 if(!Number.isSafeInteger(request.operationId)||request.operationId<1||!Number.isSafeInteger(request.groupId)||request.groupId<1||!active||active.id!==request.operationId||active.groupId!==request.groupId){send({type:'reply',id:request.id,ok:false,outcome:'refused',reason:'Cette préparation est absente ou déjà terminée ; aucune annulation n’est garantie.'});return;}
 active.cancelled=true;
 send({type:'reply',id:request.id,ok:true,data:JSON.stringify({cancelRequested:true})});
}
function newCampCommand256(request:Request):boolean {
 if(request.type!=='command'||!validWorldMapCommand(request.command)||request.command.type!=='group-enter'||!['camp','settle'].includes(request.command.mode)||!isSchema256Or257(world?.schemaVersion)||world.planet?.revision!==3||!world.worldMaps)return false;
 const id=request.command.groupId,g=world.worldGroups?.groups.find(r=>r.state.id===id)?.state;
 return !world.worldMaps.sites.some(s=>s.tile===(g&&'tile'in g?g.tile:undefined));
}
async function handleCamp256(request:Extract<Request,{type:'command'}>):Promise<void> {
 let committing=false,owned:ActiveCamp256|undefined;
 try {
  if(fault)throw Error(fault.reason);
  if(activeCamp256)throw Error('Une préparation attend encore sa décision.');
  if(!world||!validWorldMapCommand(request.command)||request.command.type!=='group-enter'||!['camp','settle'].includes(request.command.mode))throw Error('Commande de création locale invalide.');
  const root=registeredCampaign(world),groupId=request.command.groupId,mode=request.command.mode==='settle'?'settle':'camp',permission=groupEntryActions(root,groupId)[mode];
  owned={id:request.id,groupId,root,cancelled:false};activeCamp256=owned;
  speed=0;resetSimulationClock(performance.now());try{publish();}catch(error){stopFatal(error);throw error;}
  if(!permission.ok)throw Error(permission.reason??'Cette entrée est refusée.');
  send({type:'camp-entry-progress',id:request.id,groupId,progress:{phase:'preparing'}});
  const iterator=mode==='settle'?prepareActualSettlementEntry257(root,groupId):prepareActualCampEntry256(root,groupId);let completed=false;
  try {
   for(;;){
    const currentFault=readSimulationFault256();if(currentFault)throw Error(currentFault.reason);
    if(activeCamp256!==owned||owned.cancelled||world!==root)throw Error('La préparation de la carte locale a été annulée.');
    const step=iterator.next();
    if(step.done){
     completed=true;if(step.value.status==='blocked')throw Error(step.value.reason);
     if(activeCamp256!==owned||owned.cancelled||world!==root)throw Error('La préparation de la carte locale a été annulée.');
     committing=true;const result=step.value.commit(true);
     if(!result.ok){committing=false;throw Error(result.reason??'Entrée de la carte locale refusée.');}
     const checkpoint=publish(true);if(!checkpoint)throw Error('La carte confirmée n’a pas été publiée.');
     send({type:'reply',id:request.id,ok:true,checkpoint});return;
    }
    send({type:'camp-entry-progress',id:request.id,groupId,progress:step.value});await nextCampTurn256();
   }
  }finally{if(!completed)iterator.return({status:'blocked',phase:'cancelled',reason:'Unpublished Camp discarded'});}
 }catch(error){
  if(committing)stopFatal(error);
  send({type:'reply',id:request.id,ok:false,outcome:committing||fault?'unknown':'refused',...(owned?.cancelled?{data:JSON.stringify({campEntry:'cancelled'})}:{}),reason:error instanceof Error?error.message:String(error)});
 }finally{if(owned&&activeCamp256===owned){activeCamp256=undefined;resetSimulationClock(performance.now());}}
}

const nextCampTurn256=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
// A message/publication callback can establish the fatal state between yields.
function readSimulationFault256():SimulationFault|undefined{return fault;}

/** One attempt per actual persisted pending owner. Explicit retry discards no
 * history/actors/RNG; a cold load prepares that SAME owner again. */
const attemptedEncounter261=new WeakSet<object>();
let activeEncounter261:{root:CampaignState;pending:object;groupId:number}|undefined;
function startEncounter261():void {
 const root=world,row=root&&pendingCaravan261(root),pending=row?.pending261;
 if(!root||!row||!pending)return;
 holdEncounterPause261(performance.now());
 if(pending.decision==='open'||activeEncounter261||activeCamp256||attemptedEncounter261.has(pending))return;
 attemptedEncounter261.add(pending);const owner={root,pending,groupId:row.state.id};activeEncounter261=owner;
 void (async()=>{
  let committed=false,finished=false;const iterator=prepareActualBattlefieldEntry261(root,owner.groupId);
  try {
   send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:'preparing'});
   for(;;){
    if(fault)throw Error(fault.reason);
    if(world!==root||activeEncounter261!==owner||row.pending261!==pending)throw Error('La vraie préparation a été remplacée.');
    const step=iterator.next();
    if(step.done){finished=true;if(step.value.status==='blocked')throw Error(step.value.reason);
     const result=step.value.commit();if(!result.ok)throw Error(result.reason??'Entrée refusée.');committed=true;
     caravans?.encounterChanged261(root,owner.groupId);publish(true);
     send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:'complete'});return;
    }
    send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:step.value.phase});await nextCampTurn256();
   }
  }catch(error){if(committed)stopFatal(error);if(world===root)send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:'refused',reason:error instanceof Error?error.message:String(error)});
  }finally{if(!finished)iterator.return({status:'blocked',phase:'cancelled',reason:'Unpublished battlefield discarded'});if(activeEncounter261===owner)activeEncounter261=undefined;resetSimulationClock(performance.now());}
 })();
}

/** Same progress channel and one-attempt rule as actual Battlefield entry. */
const attemptedWorldEntry263=new WeakSet<object>();
let activeWorldEntry263:{root:CampaignState;pending:object;groupId:number}|undefined;
function worldTargetOrder263(request:Request):boolean {
 if(!world||request.type!=='command'||!validCaravanArrivalCommand261(request.command,world.schemaVersion))return false;
 const held=pendingWorldEntry263(world),c=request.command,g=held&&world.worldGroups?.groups.find(r=>r.state.id===held.groupId)?.state;
 return !!held&&!!g&&'members'in g&&c.groupId===held.groupId&&c.destination===g.tile&&(c.action===null||JSON.stringify(c.action)===JSON.stringify(held.pending.target));
}
function holdWorldEntry263(now:number):void {neutralResume261=undefined;speed=0;resetSimulationClock(now);}
function startWorldEntry263():void {
 const root=world,held=root&&pendingWorldEntry263(root);if(!root||!held)return;
 holdWorldEntry263(performance.now());if(activeWorldEntry263||activeEncounter261||activeCamp256||attemptedWorldEntry263.has(held.pending))return;
 attemptedWorldEntry263.add(held.pending);const owner={root,pending:held.pending,groupId:held.groupId};activeWorldEntry263=owner;
 void(async()=>{
  let committed=false,finished=false;const iterator=prepareWorldTargetEntry263(root,owner.groupId);
  try{
   send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:'preparing'});
   for(;;){
    if(fault)throw Error(fault.reason);
    if(world!==root||activeWorldEntry263!==owner||pendingWorldEntry263(root)?.pending!==owner.pending)throw Error('La préparation de cette entrée a été remplacée ou annulée.');
    const step=iterator.next();if(step.done){finished=true;if(step.value.status==='blocked')throw Error(step.value.reason);
     const result=step.value.commit();if(!result.ok)throw Error(result.reason??'Entrée refusée.');committed=true;
     caravans?.encounterChanged261(root,owner.groupId);publish(true);send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:'complete'});return;
    }
    send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:step.value.phase});await nextCampTurn256();
   }
  }catch(error){if(committed)stopFatal(error);if(world===root&&pendingWorldEntry263(root)?.pending===owner.pending)send({type:'caravan-encounter-progress',groupId:owner.groupId,phase:'refused',reason:error instanceof Error?error.message:String(error)});
  }finally{if(!finished)iterator.return({status:'blocked',phase:'cancelled',reason:'Unpublished world target discarded'});if(activeWorldEntry263===owner)activeWorldEntry263=undefined;resetSimulationClock(performance.now());if(!fault)startWorldEntry263();}
 })();
}

type DraftRequest256=Extract<Request,{type:'world-draft-generate'|'world-draft-cancel'|'world-draft-confirm'|'world-draft-start'}>;
interface HeldWorldDraft256 {
 generation:number;request:WorldCreationRequest256;key:string;creationId?:number;cancelled?:boolean;
 draft?:GeographicWorldDraft256;owner?:CampaignGeography256;geographyId?:number;ticket?:WorldCreationTicket256;
}
let heldWorldDraft:HeldWorldDraft256|undefined,creatingDraftColony:HeldWorldDraft256|undefined,preparingWorldDraft:HeldWorldDraft256|undefined,lastDraftGeneration=0,ticketSerial=0;
const nextDraftTurn=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function discardWorldDraft256():void {heldWorldDraft=undefined;snapshots.discardDraftPreview();}
function validDraftRequest256(v:WorldCreationRequest256):boolean {
 return !!v&&typeof v.seed==='string'&&validWorldGenerationSettings(v.settings)&&!!v.player&&v.player.scenario==='crashlanded'&&v.player.playerDef==='PlayerColony'&&typeof v.player.playerName==='string'&&v.player.playerName.trim().length>0&&v.player.playerName.length<=80&&!/[\u0000-\u001f\u007f-\u009f]/.test(v.player.playerName);
}
function sameTicket256(a:WorldCreationTicket256|undefined,b:WorldCreationTicket256):boolean {
 return !!a&&!!b&&a.generation===b.generation&&a.key===b.key&&a.tile===b.tile&&a.size===b.size&&a.season===b.season&&a.ticket===b.ticket&&!!b.player&&a.player.scenario===b.player.scenario&&a.player.playerDef===b.player.playerDef&&a.player.playerName===b.player.playerName;
}
function requireDraftSite256(d:HeldWorldDraft256,tile:number):void {
 if(!d.draft||!d.owner||!Number.isSafeInteger(tile)||tile<0||!canPlaceWorldSettlement(d.owner.surface.tiles,tile,{settlementTiles:new Set(d.draft.factions.settlements.map(s=>s.tile))}))throw Error('Le lieu de départ n’est plus disponible.');
}
/** This work never steps or replaces the old colony. Yielding is connection
 * scheduling only; it neither advances game clocks nor draws game RNG. */
async function handleWorldDraft256(request:DraftRequest256):Promise<void> {
 let committed=false,ownedCreation:HeldWorldDraft256|undefined;
 try{
  if(request.type==='world-draft-cancel'){
   if(!Number.isSafeInteger(request.generation)||request.generation<1)throw Error('Identité de préparation invalide.');
   const d=heldWorldDraft;
   if(!d||d.generation!==request.generation||request.operationId!==undefined&&(!Number.isSafeInteger(request.operationId)||request.operationId<1||d.creationId!==request.operationId)||creatingDraftColony===d&&request.operationId!==d.creationId)throw Error('Cette préparation est absente ou déjà terminée ; aucune annulation n’est garantie.');
   d.cancelled=true;discardWorldDraft256();
   send({type:'reply',id:request.id,ok:true,data:JSON.stringify({cancelRequested:true})});return;
  }
  {const actualFault=readSimulationFault256();if(actualFault)throw Error(actualFault.reason);}
  if(activeCamp256)throw Error('La préparation de la carte locale attend encore sa décision.');
  if(request.type==='world-draft-generate'){
   if(creatingDraftColony)throw Error('La création d’une colonie attend encore sa décision.');
   if(world&&speed!==0)throw Error('Mettez la partie en pause avant de préparer un monde.');
   if(!Number.isSafeInteger(request.generation)||request.generation<=lastDraftGeneration||!validDraftRequest256(request.request))throw Error('Paramètres de création invalides.');
   discardWorldDraft256();lastDraftGeneration=request.generation;
   const input:WorldCreationRequest256={seed:request.request.seed,settings:{...request.request.settings,factions:[...request.request.settings.factions]},player:{...request.request.player}},d:HeldWorldDraft256={generation:request.generation,key:worldGenerationKey(input.seed,input.settings),request:input};heldWorldDraft=d;preparingWorldDraft=d;
   const iterator=generateGeographicWorldDraft256({seed:input.seed,settings:input.settings,tick:0,nextThingId:1,playerDef:input.player.playerDef,playerName:input.player.playerName});
   let completed=false;
   try{
    for(;;){{const actualFault=readSimulationFault256();if(actualFault)throw Error(actualFault.reason);}if(heldWorldDraft!==d)throw Error('La préparation du monde a été annulée.');const result=iterator.next();if(result.done){d.draft=result.value;completed=true;break;}send({type:'world-draft-progress',id:request.id,generation:d.generation,progress:result.value});await nextDraftTurn();}
   }finally{if(!completed)iterator.return(undefined as never);}
   if(heldWorldDraft!==d)throw Error('La préparation du monde a été annulée.');
   if(!d.draft)throw Error('Le générateur n’a pas produit de monde.');
   if(d.draft.key!==d.key)throw Error('La clé du monde préparé a changé.');
   d.owner=captureGeneratedGeography256(d.draft);const geography=snapshots.reserveDraftPreview(d.owner);d.geographyId=geography.id;
   send({type:'world-draft-preview',id:request.id,generation:d.generation,key:d.key,request:input,geography,factions:d.draft.factions.factions.map(({id,name,def,hidden})=>({id,name,def,hidden})),settlements:d.draft.factions.settlements.map(({id,factionId,tile,name})=>({id,factionId,tile,name}))});
   send({type:'reply',id:request.id,ok:true});return;
  }
  const d=heldWorldDraft;
  if(!d||!d.draft||!d.owner||d.geographyId===undefined)throw Error('La préparation est perdue. Générez le monde à nouveau.');
  if(request.type==='world-draft-confirm'){
   const site=request.request;if(creatingDraftColony||!site||site.generation!==d.generation||site.key!==d.key||!validGeographicCreationSize262(site.size)||!validGeographicCreationSeason262(site.season)||request.geographyId!==d.geographyId)throw Error('Cette préparation ne correspond pas au lieu confirmé.');
   requireDraftSite256(d,site.tile);if(!Number.isSafeInteger(ticketSerial+1))throw Error('Identité de confirmation épuisée.');
   d.ticket={...site,ticket:`${d.generation}:${++ticketSerial}`,player:{...d.request.player}};
   send({type:'reply',id:request.id,ok:true,data:JSON.stringify(d.ticket)});return;
  }
  if(creatingDraftColony||!sameTicket256(d.ticket,request.ticket)||!validStartingOriginalRequest256(request.startingParty)||!validSettlementLimit(request.maxSettlements)||!validThreatPauseMode(request.threatPauseMode))throw Error('Le départ confirmé n’est plus disponible. Générez le monde à nouveau.');
  if(speed!==0&&world)throw Error('Mettez la partie en pause avant de créer une colonie.');
  requireDraftSite256(d,request.ticket.tile);d.ticket=undefined;d.creationId=request.id;creatingDraftColony=d;ownedCreation=d;
  const owner=d.owner,draft=d.draft,nextThingId=draft.nextThingId,playerFactionId=draft.factions.playerFactionId,iterator=createGeographicNewGame256({draft,geography:owner,tile:request.ticket.tile,size:request.ticket.size,season:request.ticket.season,scenario:'crashlanded',startingParty:request.startingParty},{shrines750:ACTUAL_SHRINES_750_256});
  let created:World|undefined,completed=false;
  try{
   for(;;){{const actualFault=readSimulationFault256();if(actualFault)throw Error(actualFault.reason);}if(heldWorldDraft!==d)throw Error('La création de la colonie a été annulée.');const result=iterator.next();if(result.done){created=result.value;completed=true;break;}send({type:'world-draft-progress',id:request.id,generation:d.generation,progress:result.value});await nextDraftTurn();}
  }finally{if(!completed)iterator.return(undefined as never);}
  if(heldWorldDraft!==d||!created)throw Error('La préparation est perdue. Générez le monde à nouveau.');
  const confirmedClock=configuredGeographicStartClock256(geographicSurfaceTileClimateDefinition256(owner.surface.tiles[request.ticket.tile]!),request.ticket.season);
  if(!isSchema256Or257(created.schemaVersion)||created.width!==request.ticket.size||created.height!==request.ticket.size||created.worldMaps?.mapSize.width!==request.ticket.size||created.worldMaps.mapSize.height!==request.ticket.size||created.worldMaps.calendarOrigin!==confirmedClock.calendarOrigin||created.climate?.revision!==4||created.climate.calendarOrigin!==confirmedClock.calendarOrigin||created.planet?.revision!==3||planetGeography256(created.planet)!==owner||created.site?.revision!==3||created.site.tileId!==request.ticket.tile||created.scenario?.id!==d.request.player.scenario||created.worldFactions!==draft.factions||created.nextId<nextThingId||created.worldFactions.playerFactionId!==playerFactionId||!created.worldFactions.factions.some(f=>f.id===playerFactionId&&f.def===d.request.player.playerDef&&f.name===d.request.player.playerName))throw Error('L’usine locale n’a pas conservé les propriétaires, dimensions ou calendrier du monde confirmé.');
  send({type:'operation-progress',id:request.id,stage:'validate',completed:0,total:1});
  configureSettlementLimit(created,request.maxSettlements);const errors=validateWorld(created);if(errors.length)throw Error(`La colonie produite est invalide : ${errors[0]}`);
  // Sole authoritative replacement boundary. No old colony, clock or RNG was
  // touched before the complete local World and every owner passed validation.
  const createdCaravans=prepareCaravans(created),shipBinding298=shipCountdown298.prepareAcceptedOwner(created);
  snapshots.authorizeDraftPreview(owner,d.geographyId);world=created;caravans=createdCaravans;committed=true;shipBinding298.commit();neutralResume261=undefined;maxSettlements=request.maxSettlements;threatPauseMode=request.threatPauseMode;speed=0;urgentThreats.bootstrap(world);motion.reset();phasePublisher297.reset();audioCues.reset();fault=undefined;resetSimulationClock(performance.now());syncShipCreditsHold298(performance.now());
  send({type:'operation-progress',id:request.id,stage:'publish',completed:0,total:1});
  const checkpoint=publish(true);if(!checkpoint)throw Error('Le checkpoint initial n’a pas été publié.');heldWorldDraft=undefined;
  send({type:'reply',id:request.id,ok:true,checkpoint,...shipCountdown298.replyMetadata(world)});
 }catch(error){
  if(request.type==='world-draft-generate'&&heldWorldDraft?.generation===request.generation)discardWorldDraft256();
  if(committed)stopFatal(error);
  send({type:'reply',id:request.id,ok:false,outcome:committed||fault?'unknown':'refused',...shipCountdown298.replyMetadata(world),...(ownedCreation?.cancelled?{data:JSON.stringify({worldCreation:'cancelled'})}:{}),reason:error instanceof Error?error.message:String(error)});
 }finally{
  if(request.type==='world-draft-generate'&&preparingWorldDraft?.generation===request.generation){preparingWorldDraft=undefined;resetSimulationClock(performance.now());}
  if(ownedCreation&&creatingDraftColony===ownedCreation){if(heldWorldDraft===ownedCreation)discardWorldDraft256();creatingDraftColony=undefined;resetSimulationClock(performance.now());}
 }
}

scope.onmessage = ({ data: request }: MessageEvent<Request|ShipRuntimeRequest298>) => {
  // Read the discriminant as own data before any ordinary request handling.
  if(!request||typeof request!=='object')return;
  const type301=Object.getOwnPropertyDescriptor(request,'type');
  if(!type301||!Object.hasOwn(type301,'value'))return;
  // Small own-data control message, outside command/clock/publication/ACK paths.
  if(request.type==='actual-view-301'){
    if(isActualViewRequest301(request)&&world&&request.epoch===actualViewEpoch301)setActualView301(world,request.view);
    return;
  }
  // This active-only channel has no Request id, pending Promise, SIM clock or
  // periodic publication. Cancellation must survive cooperative preparations.
  if(request.type==='ship-cancel-298'){
    try{send(shipCountdown298.cancel(world,request));}
    catch(error){stopFatal(error);send({type:'ship-countdown-state-298',ownerEpoch:request.ownerEpoch,generation:request.generation,active:false,outcome:'unknown',reason:shipCountdown298.failureReason(error)});}
    return;
  }
  if(request.type==='ship-frame-298'){
    try{
      const blocked=fault?.reason??(activeCamp256||activeEncounter261||activeWorldEntry263||creatingDraftColony||preparingWorldDraft?'Une préparation réelle rend ces frames inéligibles ; aucun delta du lot n’a été consommé.':undefined);
      const result=shipCountdown298.frame(world,request,blocked);
      if(result.unknown)stopFatal(result.unknown);
      if(result.departed){
        // The physical departure opens a real forcePause before any next Core,
        // snapshot or Main ACK. No already committed Core is rolled back.
        syncShipCreditsHold298(performance.now());
        // Only a true physical commit publishes, after clearing old actor tracks.
        try{motion.reset();phasePublisher297.reset();publish(true);}
        catch(error){stopFatal(error);send({...result.reply,outcome:'unknown',reason:shipCountdown298.failureReason(error)});return;}
      }
      send(result.reply);
    }catch(error){stopFatal(error);send({type:'ship-frame-ack-298',ownerEpoch:request.ownerEpoch,generation:request.generation,sequence:request.sequence,accepted:false,active:false,outcome:'unknown',reason:shipCountdown298.failureReason(error)});}
    return;
  }
  const shipLaunch298=request.type==='ship-launch-298';
  const ordinaryRequest298=request.type==='ship-launch-298'||request.type==='ship-credits-continue-298'?undefined:request;
  const targetOrder=ordinaryRequest298?worldTargetOrder263(ordinaryRequest298):false;
  const cancelTarget=targetOrder&&request.type==='command'&&validCaravanArrivalCommand261(request.command,world!.schemaVersion)&&request.command.action===null;
  if(activeWorldEntry263&&!['save','resync','init','load'].includes(request.type)&&!cancelTarget){send({type:'reply',id:request.id,ok:false,outcome:'refused',reason:'La préparation de ce site doit se terminer ou être annulée.'});return;}
  if(world&&pendingWorldEntry263(world)&&(request.type==='command'||shipLaunch298)&&!targetOrder){send({type:'reply',id:request.id,ok:false,outcome:'refused',reason:'Terminez ou annulez l’entrée réelle avant un autre ordre.'});return;}
  if(activeEncounter261&&!['save','resync','init','load'].includes(request.type)){send({type:'reply',id:request.id,ok:false,outcome:'refused',reason:'La préparation du champ de bataille doit se terminer.'});return;}
  if(world&&pendingCaravan261(world)&&(shipLaunch298||request.type==='command'&&!validCaravanCommand261(request.command))){send({type:'reply',id:request.id,ok:false,outcome:'refused',reason:'Résolvez la rencontre réelle avant de donner un autre ordre.'});return;}
  if(request.type==='camp-entry-cancel'){cancelCamp256(request);return;}
  if(activeCamp256&&request.type!=='resync'){send({type:'reply',id:request.id,ok:false,outcome:'refused',reason:'La préparation de la carte locale doit se terminer ou être annulée.'});return;}
  if(request.type==='world-draft-cancel'){void handleWorldDraft256(request);return;}
  if((creatingDraftColony||preparingWorldDraft)&&request.type!=='resync'&&!(request.type==='world-draft-generate'&&!creatingDraftColony)){send({type:'reply',id:request.id,ok:false,outcome:'refused',reason:'La préparation de la nouvelle colonie attend encore sa décision.'});return;}
  if(request.type==='world-draft-generate'||request.type==='world-draft-confirm'||request.type==='world-draft-start'){void handleWorldDraft256(request);return;}
  if(ordinaryRequest298?.type==='command'&&newCampCommand256(ordinaryRequest298)){void handleCamp256(ordinaryRequest298);return;}
  let mutating = false;
  let adoptedReplacement = false;
  try {
    if(request.type==='init'||request.type==='load')discardWorldDraft256();
    let data: string | undefined;
    if (fault && request.type !== 'init' && request.type !== 'load') throw new Error(fault.reason);
    if(request.type==='ship-launch-298'){
      if(!world)throw Error('La simulation ne répond pas encore.');
      const local=world.worldMaps?selectedRegisteredMap(world):selectedMap(world as World);if(!local)throw Error('Sélectionnez une vraie carte pour lancer le vaisseau.');
      const result=shipCountdown298.launch(world,local,request);if(!result.ok)throw Error(result.reason);data=JSON.stringify(result);
    }else if(request.type==='ship-credits-continue-298'){
      // This request declares the END of the UI's native three-second closing
      // transition, not its beginning. There is no Worker timer/deadline.
      mutating=true;const result=shipCountdown298.continueCredits(world,request);if(!result.ok){mutating=false;throw Error(result.reason);}resumeAfterShipCredits298(performance.now());data=JSON.stringify(result);
    }else if(request.type==='settlement-limit'){if(!validSettlementLimit(request.maxSettlements))throw Error('Plafond de colonies invalide.');maxSettlements=request.maxSettlements;if(world?.worldMaps)configureSettlementLimit(world,maxSettlements);
    }else if (request.type === 'threat-pause-mode') {
      if (!validThreatPauseMode(request.mode)) throw new Error('Mode de pause invalide.');
      threatPauseMode = request.mode;
    } else if (request.type === 'init') {
      if (request.threatPauseMode !== undefined && !validThreatPauseMode(request.threatPauseMode)) throw new Error('Mode de pause invalide.');
      if(request.maxSettlements!==undefined&&!validSettlementLimit(request.maxSettlements))throw Error('Plafond de colonies invalide.');
      if (request.size !== 32 && !(MAP_SIZE_PRESETS as readonly number[]).includes(request.size)) throw new Error('Taille de carte invalide.');
      const created=createScenarioWorld(request.seed, request.size, request.scenario,request.site,request.startingParty,request.startingWorld,request.surface);
      const createdCaravans=prepareCaravans(created);maxSettlements=request.maxSettlements??maxSettlements;configureSettlementLimit(created,maxSettlements);const shipBinding298=shipCountdown298.prepareAcceptedOwner(created);world=created;caravans=createdCaravans;
      adoptedReplacement = true;shipBinding298.commit();neutralResume261=undefined;
      threatPauseMode = request.threatPauseMode ?? threatPauseMode;
      urgentThreats.bootstrap(world);
      fault = undefined;
      speed=request.paused?0:1;
      motion.reset();phasePublisher297.reset();
      audioCues.reset();
      resetSimulationClock(performance.now());
      syncShipCreditsHold298(performance.now());
    } else if (request.type === 'load') {
      if (request.threatPauseMode !== undefined && !validThreatPauseMode(request.threatPauseMode)) throw new Error('Mode de pause invalide.');
      // A cold load needs no temporary colony. Validate completely before the
      // publication, preserving an existing world and clock on refusal.
      if(request.maxSettlements!==undefined&&!validSettlementLimit(request.maxSettlements))throw Error('Plafond de colonies invalide.');
      let restored: CampaignState;
      try { restored = deserializeCampaign(request.data,step=>send({type:'operation-progress',id:request.id,...step})); }
      catch { throw new Error('Cette sauvegarde est illisible ou incompatible avec cette version. La colonie actuelle et vos sauvegardes sont conservées.'); }
      const restoredCaravans=prepareCaravans(restored);maxSettlements=request.maxSettlements??maxSettlements;configureSettlementLimit(restored,maxSettlements);const shipBinding298=shipCountdown298.prepareAcceptedOwner(restored);world = restored;caravans=restoredCaravans; adoptedReplacement = true;shipBinding298.commit();neutralResume261=undefined; speed = 0; motion.reset();phasePublisher297.reset();
      threatPauseMode = request.threatPauseMode ?? threatPauseMode;
      urgentThreats.bootstrap(world);
      fault = undefined;
      audioCues.reset();
      resetSimulationClock(performance.now());
      syncShipCreditsHold298(performance.now());
    } else if (request.type === 'speed') {
      if (![0, 1, 3, 6].includes(request.speed)) throw new Error('Vitesse invalide.');
      // Even explicit speed0 cannot release the credits Window's forcePause.
      if(shipCreditsHeld298()&&request.speed!==0)throw Error('Les crédits maintiennent la simulation en pause jusqu’à la fin de leur fermeture.');
      const beforeAdvance = urgentThreats.token();
      const now=performance.now();
      if(request.speed===0){
        const stamp=Object.getOwnPropertyDescriptor(request,'pauseIntent');
        if(stamp){
          if(!Object.hasOwn(stamp,'value'))throw Error('L’horodatage de pause est invalide.');
          const intent:unknown=stamp.value;
          if(!intent||typeof intent!=='object'||Array.isArray(intent))throw Error('L’horodatage de pause est invalide.');
          const prototype=Object.getPrototypeOf(intent),keys=Reflect.ownKeys(intent);
          if((prototype!==Object.prototype&&prototype!==null)||keys.length!==2||!keys.includes('origin')||!keys.includes('at'))throw Error('L’horodatage de pause est invalide.');
          const origin=Object.getOwnPropertyDescriptor(intent,'origin'),at=Object.getOwnPropertyDescriptor(intent,'at');
          if(!origin||!at||!Object.hasOwn(origin,'value')||!Object.hasOwn(at,'value')||typeof origin.value!=='number'||!Number.isFinite(origin.value)||typeof at.value!=='number'||!Number.isFinite(at.value))throw Error('L’horodatage de pause est invalide.');
          const local=at.value+(origin.value-performance.timeOrigin);
          if(!Number.isFinite(local))throw Error('L’horodatage de pause est invalide.');
          // Compatibility validation only. Human speed changes no longer
          // acquire old-speed wall time through this invocation timestamp.
        }
      }
      if(world&&(pendingCaravan261(world)||pendingWorldEntry263(world))&&request.speed!==0)throw Error('La rencontre réelle conserve la simulation en pause jusqu’à sa décision.');
      const requestedSpeed=urgentThreats.requestedSpeed(request.speed,request.options,beforeAdvance);
      cancelUnplayedSimulation(now);
      speed=requestedSpeed;
      if(request.speed===0&&neutralResume261&&neutralResume261.root===world)neutralResume261.speed=0;
    } else {
      if (!world) throw new Error('La simulation ne répond pas encore.');
      if(request.type==='order-options') {
        data=JSON.stringify(queryOrderOptions(selectedMap(world as World),request.pawnId,request,request.queue));
      } else if(request.type==='bill-worker-options') {
        if(!Number.isSafeInteger(request.structureId)||request.structureId<1||!Number.isSafeInteger(request.billId)||request.billId<1)throw Error('Poste ou facture invalide.');
        const options=queryBillWorkerOptions283(selectedMap(world as World),request.structureId,request.billId);
        if(!options)throw Error('Cette facture ou son poste n’est plus disponible.');
        // Metadata replies never publish/capture a snapshot, change revision,
        // advance the clock or start a deferred map preparation.
        send({type:'reply',id:request.id,ok:true,data:JSON.stringify(options)});return;
      } else if (request.type === 'command') {
        mutating = true;
        const retry=validCaravanCommand261(request.command)&&request.command.type==='caravan-encounter-choice'&&request.command.choice==='retry'?pendingCaravan261(world)?.pending261:undefined;
        const previousEncounter=pendingCaravan261(world)?.pending261;
        const previousTarget=targetOrder?pendingWorldEntry263(world)?.pending:undefined;
        const result = applyCommand(world as World, request.command,caravans);
        if(result.ok&&retry)attemptedEncounter261.delete(retry);
        if(result.ok&&previousTarget&&pendingWorldEntry263(world)?.pending===previousTarget)attemptedWorldEntry263.delete(previousTarget);
        if (!result.ok) { mutating = false; throw new Error(result.reason ?? 'Ordre refusé.'); }
        resumeNeutralEncounter261(previousEncounter);
        if (result.affected !== undefined) data = JSON.stringify({ affected: result.affected, skipped: result.skipped });
      } else if (request.type === 'save') {
        // A deferred check keeps the complete validation off the simulation thread.
        data = request.check==='deferred'?serializeCampaignUnchecked(world):serializeCampaign(world);
      }
    }
    const checkpoint = request.type === 'init' || request.type === 'load' || request.type === 'resync';
    if(request.type==='load')send({type:'operation-progress',id:request.id,stage:'publish',completed:0,total:1});
    // An observer/encoder/publication failure must stop further mutation too.
    let publication: { epoch: number; revision: number } | undefined;
    try { if(world&&pendingCaravan261(world))holdEncounterPause261(performance.now());if(world&&pendingWorldEntry263(world))holdWorldEntry263(performance.now());if(request.type!=='order-options')publication = publish(checkpoint); }
    catch (error) { stopFatal(error); throw error; }
    if (adoptedReplacement) fault = undefined;
    send({ type: 'reply', id: request.id, ok: true, data, ...shipCountdown298.replyMetadata(world), ...(checkpoint && publication ? { checkpoint: publication } : {}) });
    startEncounter261();startWorldEntry263();
  } catch (error) {
    if (mutating || adoptedReplacement) stopFatal(error);
    const unknown = adoptedReplacement || mutating || (fault && request.type !== 'init' && request.type !== 'load');
    send({ type: 'reply', id: request.id, ok: false, outcome: unknown ? 'unknown' : 'refused', ...shipCountdown298.replyMetadata(world), reason: error instanceof Error ? error.message : String(error) });
  }
};

// Wall time funds a logical batch once. Each task commits at most one real
// tick, keeping observers/publication atomic without monopolizing the port.
/* Like the campaign projection, the selected physical map cannot change
 * within one committed Core observation: it is looked up once per scope. */
let physicalMemo297:{owner:CampaignState;value:World|undefined}|undefined;
function physicalVisibleWorld297():World|undefined {
 if(!world)return undefined;
 if(presentationScope297&&physicalMemo297?.owner===world)return physicalMemo297.value;
 const value=physicalVisibleCoreMap297(world as World);if(presentationScope297)physicalMemo297={owner:world,value};return value;
}
function publishActualFull297():void {
 // Observers were already captured at the actual Core boundary. Calling
 // publish() here would scan Audio again even for silent terrain changes.
 const previous=observedWorld,current=visibleWorld();
 if(current&&current!==previous){presentationChanges.capture(current);motion.capture(current);audioCues.capture(current);}
 publishCapturedTick();
}
function publishDuePhysical297(force=false,batchTail=false):void {
 if(!world)return;const visible=physicalVisibleWorld297();if(!visible)return;
 if(!force&&!phasePublisher297.hasPending)return;
 const now=performance.now();if(!force&&!phasePublisher297.due(now))return;
 if(phasePublisher297.terrainNeedsFull297(visible))phasePublisher297.requestFull();
 // Unexplained (non-projectile) allocations: a frontier anchor publishes them
 // with the next calm Full; a same-civil anchor keeps the hard barrier.
 if(phasePublisher297.allocatorNeedsFull(visible)){if(phasePublisher297.frontierMode297)phasePublisher297.deferFull297(now);else phasePublisher297.requestFull();}
 if(force||phasePublisher297.needsFull){
  const quiet=phasePublisher297.canDeferFull;
  // Explicit frontier policy: calm Full coalesces to the TRUE logical tail
  // (or zero-credit wake). The same 20ms TOTAL budget still governs all sends.
  // A default/legacy anchor retains its old same-civil/20ms hold policy.
  // A calm Full only refreshes slowly changing world state (jobs, items,
  // plants, needs…); actors keep streaming through phase packets. In frontier
  // mode, cap calm Fulls at one per calmFullIntervalMs() of wall time instead
  // of one per batch tail (up to one per macro tick at speed 6), because each
  // costs a full encode in this Worker and a full adoption on the main thread.
  // Forced, hard (requiresFull), paused and non-frontier publications are unchanged.
  const interval=calmFullIntervalMs();
  const tail=batchTail&&(!phasePublisher297.frontierMode297||now-lastFullPublishedAt>=interval);
  const stale=phasePublisher297.frontierMode297&&now-lastFullPublishedAt>=Math.max(CALM_FULL_MAX_AGE_MS,interval);
  if(force||!quiet||tail||stale||!phasePublisher297.frontierMode297&&phasePublisher297.quietBudgetExpired(now)){publishActualFull297();return;}
  if(!phasePublisher297.frontierMode297)return;
 }
 if(!phasePublisher297.canPublishActors297)return;
 const audioPublication297=audioCues.preparePublication297();
 if(!phasePublisher297.audioFitsPhase297(visible,audioPublication297.cues)){
  phasePublisher297.requestFull();publishActualFull297();return;
 }
 const prepared=phasePublisher297.preparePhase(visible,motion.snapshot(),speed as 0|1|3|6,audioPublication297.cues);
 if(publishPhaseLocal)publishPhaseLocal(visible,prepared.packet);else send(prepared.packet);
 phasePublisher297.commitPhase(prepared,performance.now());
 audioCues.commitPublication297(audioPublication297);
}
function runCoreTask297(now:number):void {
 if(!world||!isCorePhysicalSchema297(Number(world.schemaVersion)))throw Error('Core driver lost its current schema owner');
 if(coreBatch297&&coreBatch297.owner!==world){resetSimulationClock(now);return;}
 if(!coreBatch297){wakeDue=false;const budget=coreClock297.reserve(now,speed);if(budget===0){publishDuePhysical297(false,true);return;}coreBatch297={owner:world,remaining:budget,completed:0,simulationMs:0};}
 const batch=coreBatch297;if((effectiveCore297(world)+1)%10===0)urgentThreats.prepareMaps(world);
 if(!coreClock297.consume())throw Error('Missing reserved Core transaction');
 const started=performance.now(),result=advanceWorldCore297(world,undefined,caravans);
 if(result.core!==effectiveCore297(world))throw Error('Engine returned an uncommitted Core watermark');
 batch.simulationMs+=performance.now()-started;batch.completed++;batch.remaining--;stepMs=batch.simulationMs/batch.completed*10;
 for(const row of result.maps){const effects=row.observerEffects297;if(!effects||typeof effects.threatsChanged!=='boolean'||typeof effects.audioChanged!=='boolean'||typeof row.requiresHardFull297!=='boolean'||!Array.isArray(row.strikeAudio297)||!Array.isArray(row.shotAudio297))throw Error('Missing causal Core observer receipt');}
 const threatsChanged=result.localTickCompleted||result.maps.some(row=>row.observerEffects297.threatsChanged);
 const encounter=pendingCaravan261(world),entry=pendingWorldEntry263(world),threatPaused=threatsChanged&&urgentThreats.capture(world,threatPauseMode),paused=!!encounter||!!entry||threatPaused;
 if(threatPaused){speed=0;resetSimulationClock(now);}if(encounter)holdEncounterPause261(now);if(entry)holdWorldEntry263(now);
 presentationScope297=true;presentationMemo297=undefined;physicalMemo297=undefined;
 try{
 const visible=physicalVisibleWorld297();
 if(visible){
  const mapId=coreMapId297(visible),row=result.maps.find(item=>item.mapId===mapId);
  if(!row)throw Error('Committed Core result lost the selected actual map');
  const hard=result.maps.some(item=>item.requiresHardFull297);
  // Observe the SAME selected projection as the legacy discrete observer,
  // including cross-map incidents. No Natural/geography encoder runs here.
  if(result.localTickCompleted||hard||paused){
   // A calm macro candidate first checks the projection's owner only; the
   // projection itself is rebuilt when something below reads it.
   const calmCandidate=result.localTickCompleted&&!hard&&!paused;
   if(!(calmCandidate?visibleOwner297():visibleWorld()))throw Error('Selected publication owner disappeared during committed Core observation');
   // In frontier mode a completed calm macro already schedules a calm Full
   // (rate-limited in publishDuePhysical297) while actors keep streaming, so
   // the whole-world presentation signature is neither needed nor computed.
   const calmMacro=calmCandidate&&phasePublisher297.frontierMode297;
   if(!calmMacro){const current=visibleWorld();if(!current)throw Error('Selected publication owner disappeared during committed Core observation');if(presentationChanges.capture(current))phasePublisher297.requestFull();}
  }
  // visibleWorld may revoke an old map's Recorder/Audio/Publisher ownership.
  // Capture this Core only after that synchronous owner check.
  motion.capture(visible);
  phasePublisher297.observe({core:result.core,actorsChanged:row.actorsChanged,projectileEvents:row.projectileEvents,requiresFull:hard,deferredFull297:result.maps.some(item=>item.deferredFull297)},result.localTickCompleted,performance.now());
  // Doors that opened or closed on the visible map: a frontier anchor ships
  // their state in the next actor packet; any other anchor needs a Full.
  if(row.doorsMoved297.length){if(phasePublisher297.frontierMode297)phasePublisher297.markDoors297(row.doorsMoved297);else phasePublisher297.requestFull();}
  if(result.localTickCompleted)phasePublisher297.observeMacroActors297(visible);
  // Preserve causal FX/strike/shot barriers. Audio-only work cues can use the
  // exact guarded actor envelope without forcing a complete World capture.
  const event=result.maps.some(item=>item.strikeAudio297.length>0||item.shotAudio297.length>0||item.projectileEvents.upserted.length>0||item.projectileEvents.removed.length>0);
  if(phasePublisher297.canDeferFull&&(event||phasePublisher297.hasPendingProjectileEvents))phasePublisher297.requestFull();
  const captureAudio=result.localTickCompleted||row.observerEffects297.audioChanged||row.strikeAudio297.length>0||row.shotAudio297.length>0||paused;
  if(captureAudio){
   audioCues.capturePhysical297(visible,result.core,row.strikeAudio297,row.shotAudio297);
   // Only prepare/commit around an actual send consumes the owned cue prefix.
   // publishDuePhysical297 checks the shared strict phase audio validator and
   // falls back to a genuine Full for a cue outside that guarded domain.
  }
  publishDuePhysical297(paused,batch.remaining===0);
 }else if(result.localTickCompleted||paused)publishCapturedTick();
 }finally{presentationScope297=false;presentationMemo297=undefined;physicalMemo297=undefined;}
 if(paused){if(encounter)startEncounter261();if(entry)startWorldEntry263();return;}
 if(batch.remaining===0){coreBatch297=undefined;if(wakeDue)regularTasks.request();}else regularTasks.request();
}
function runRegularTask():void {
  const now=performance.now();
  if(fault){resetSimulationClock(now);return;}
  if(shipCreditsHeld298()){speed=0;resetSimulationClock(now);return;}
  if(world&&pendingCaravan261(world)){holdEncounterPause261(now);startEncounter261();return;}
  if(world&&pendingWorldEntry263(world)){holdWorldEntry263(now);startWorldEntry263();return;}
  if(!world||activeEncounter261||activeWorldEntry263||activeCamp256||creatingDraftColony||preparingWorldDraft){resetSimulationClock(now);return;}
  try {
    if(isCorePhysicalSchema297(Number(world.schemaVersion))){runCoreTask297(now);return;}
    if(logicalBatch&&logicalBatch.owner!==world){resetSimulationClock(now);return;}
    if(!logicalBatch){
      wakeDue=false;
      const budget=clock.reserve(now,speed);if(budget===0)return;
      logicalBatch={owner:world,remaining:budget,completed:0,simulationMs:0};
    }
    const active=logicalBatch;
    urgentThreats.prepareMaps(world);
    if(!clock.consume())throw Error('Missing reserved simulation tick.');
    const started=performance.now();stepWorld(world,1,undefined,caravans);
    active.simulationMs+=performance.now()-started;active.completed++;active.remaining--;stepMs=active.simulationMs/active.completed;
    const encounter=pendingCaravan261(world),entry=pendingWorldEntry263(world),threatPaused=urgentThreats.capture(world,threatPauseMode),paused=!!encounter||!!entry||threatPaused;
    if(threatPaused){speed=0;resetSimulationClock(now);}
    if(encounter)holdEncounterPause261(now);if(entry)holdWorldEntry263(now);
    const visible=visibleWorld();if(visible){motion.capture(visible);audioCues.capture(visible);}
    const changed=visible?presentationChanges.capture(visible):false;
    if(changed||paused)publishCapturedTick();
    if(paused){if(encounter)startEncounter261();if(entry)startWorldEntry263();return;}
    if(active.remaining===0){
      // A quiet task is not a quiet BATCH tail. Intermediate command/save
      // publications already update lastPublishedTick and drain actual cues.
      if(lastPublishedTick!==world.tick)publishCapturedTick();
      logicalBatch=undefined;
      if(wakeDue)regularTasks.request();
    }else regularTasks.request();
  } catch(error){
    // A partly mutated tick remains fatal; no rollback or speculative ACK.
    stopFatal(error);
  }
}
function regularWake():void {
  if(logicalBatch||coreBatch297||regularTasks.scheduled){wakeDue=true;return;}
  runRegularTask();
}
setInterval(regularWake,20);

}
