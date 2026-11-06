import {preparePartyRelease292} from './party-release-292.ts';
import {commitMedicalGuest259} from './world-affiliation-259.ts';
import {cancelToxicVomit256} from './toxic-buildup-256.ts';
import {claimLocalActorBed256,captureActorBeds256,localBedClaimAvailable256} from './actor-bed-local-256.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows,allowedAreaReason } from './allowed-area-state.ts';
import { bedSlotCell } from './bed-slots.ts';
import { isCarePatient,isRescuableVisitor,isAdmittedVisitorGuest,isColonist } from './affiliation.ts';
import { medicalCare } from './medicine-rules.ts';
import { cancelShooting } from './shooting-state.ts';
import { cancelMelee } from './melee-state.ts';
import { captureReason,completeCapture } from './capture.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { updatePawnHealth } from './health.ts';
import { rescueBedAvailable,rescueBedPlaces,medicalBedPreference } from './medical-beds.ts';
import { carrierOf,rescueClaim,syncPatient } from './rescue-state.ts';
import { blockedCells,reachableCells,routeToCell,type Reachability } from './pathfinding.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { processPrisonerRelease,reconcileRelease } from './prisoner-release.ts';
import { processArrest,reconcileArrest } from './arrest.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { BedSlot,Cell,CommandResult,Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface RescueProposal {patientId:number;bedId:number;path:Cell[];bedSlot?:BedSlot}

/** The existing explicit mandate owns this mobilized service; no additional
 * saved flag, capture/arrest/release authority or automatic work is introduced. */
export const isDraftedRescue=(world:World,actor:Pawn):boolean=>world.schemaVersion>=237&&isColonist(actor)&&!actor.prisoner&&!!actor.draft&&actor.orders.active==='rescue'&&!!actor.rescue&&!actor.rescue.capture&&!actor.rescue.arrest&&!actor.rescue.release;

/** Read-only admission is shared by the menu, proposal and command. Cancelling
 * an accepted attack must never erase a strike or post-shot recovery. */
function draftedRescueOrderRefusal(world:World,actor:Pawn,acquiredStun=false):string|undefined {
  if(world.schemaVersion<237||!actor.draft)return;
  if(!isColonist(actor)||actor.prisoner)return 'Mobilisez un colon libre pour donner cet ordre de secours.';
  if(actor.mental?.crisis||actor.burning||actor.bombRefuge||actor.heatRefuge||actor.tactics)return 'Ce colon doit terminer sa réaction immédiate avant le secours mobilisé.';
  if(!acquiredStun&&(actor.stun?.untilCore??0)>world.tick*10||actor.melee?.strike||actor.shooting?.stance?.phase==='cooldown')return 'Attendez la fin de l’étourdissement ou de la récupération de combat.';
}

export const wantsRescue=(p:Pawn,forced=false):boolean=>((!p.visitor&&isCarePatient(p))||forced&&(isRescuableVisitor(p)||p.faction==='outlanders'&&!!p.podRescue))&&p.state==='downed'&&!(p.need?.kind==='sleep'&&p.need.bedId!==null&&p.need.phase==='sleep');
/** Only the explicit neutral-visitor branch is new. Automatic work keeps its
 * historical colony/prisoner/pod domain, including after visitor admission. */
function visitorRescueRefusal(world:World,patient:Pawn,forced:boolean):string|undefined {
  if(!patient.visitor)return;
  if(!forced||world.schemaVersion<237||!isRescuableVisitor(patient))return 'Ce visiteur ne peut pas recevoir ce secours.';
  const group=world.visitors?.groups.find(g=>g.id===patient.visitor!.group);
  if(!group||!group.members.includes(patient.id)||group.hostile||patient.mental?.crisis||patient.health?.death)return 'Ce visiteur ne peut pas être admis comme patient neutre.';
  if(medicalCare(patient)==='none')return 'Les soins sont désactivés pour ce visiteur.';
}
export function rescueReason(world:World,actor:Pawn,patient:Pawn|undefined,forced=false):string|undefined {
  return rescueReasonFor(world,actor,patient,forced,false);
}
/** A stun acquired during this exact mobilized mandate pauses its physical
 * service. It does not authorize a new order, another patient or recovery from
 * any of the other immediate reactions rejected by the ordinary menu. */
export function rescueContinuationReason(world:World,actor:Pawn,patient:Pawn|undefined):string|undefined {
  return rescueReasonFor(world,actor,patient,true,isDraftedRescue(world,actor)&&actor.rescue!.patientId===patient?.id);
}
function rescueReasonFor(world:World,actor:Pawn,patient:Pawn|undefined,forced:boolean,acquiredStun:boolean):string|undefined {
  if(!forced&&patient){const reason=allowedAreaReason(world,actor,patient);if(reason)return reason;}
  // Forced Rescue/Capture are Core menu services, not admitted work providers.
  if(!forced){const refusal=backgroundWorkRefusal(actor,patient?.prisoner?'warden':'doctor');if(refusal)return refusal;}
  const visitorRefusal=patient?visitorRescueRefusal(world,patient,forced):undefined;
  return medicalWorkRefusal(actor)??(forced?draftedRescueOrderRefusal(world,actor,acquiredStun):undefined)??(!forced&&(patient?.prisoner?actor.priorities.warden:actor.priorities.doctor)===0?`${patient?.prisoner?'Geôlier':'Médecin'} est désactivé dans le tableau Travail.`
    :actor.collapsePending||world.restRules==='legacy'&&actor.rest===0?'Ce colon doit récupérer de son épuisement.'
    :carrierOf(world,actor.id)?'Ce colon est transporté.'
    :actor.interruptedCargo?'La cargaison doit être déposée avant le secours.'
    :!patient||patient===actor||!wantsRescue(patient,forced)?'Cette personne ne nécessite pas de secours vers un lit.'
    :visitorRefusal?visitorRefusal
    :rescueClaim(world,patient.id,actor.id)?'Une autre personne a réservé ce secours.'
    :world.pawns.some(p=>p.id!==actor.id&&p.tend?.drafted&&p.tend.patientId===patient.id)?'Cette personne est réservée pour des soins mobilisés.':undefined);
}
export function rescueProposal(world:World,actor:Pawn,patient:Pawn,reach:Reachability,forced=false):RescueProposal|undefined {
  if(rescueReason(world,actor,patient,forced))return;
  const path=routeToCell(world,patient,reach);if(!path)return;
  const bedOwners=world.schemaVersion>=256?captureActorBeds256(world):undefined;
  const rank=(bed:import('./types.ts').Structure)=>bed.medical?medicalBedPreference(bed):patient.bedId===bed.id?2:3;
  const beds=world.structures.flatMap(b=>rescueBedPlaces(world,b,patient,actor.id).filter(place=>allowedAreaAllows(world,actor,place.cell)&&localBedClaimAvailable256(world,b,patient,place.bedSlot,bedOwners)).map(place=>({bed:b,cell:place.cell,slot:place.bedSlot})))
    .sort((a,b)=>rank(a.bed)-rank(b.bed)||(a.cell.x-patient.x)**2+(a.cell.z-patient.z)**2-(b.cell.x-patient.x)**2-(b.cell.z-patient.z)**2||a.bed.id-b.bed.id||(a.slot??0)-(b.slot??0));
  for(const {bed,cell,slot} of beds)if(routeToCell(world,cell,reach))return {patientId:patient.id,bedId:bed.id,path,...(slot!==undefined?{bedSlot:slot}:{})};
}
export function startRescue(world:World,actor:Pawn,proposal:RescueProposal,forced=false,capture=false):void {
  const bed=structureById(world,proposal.bedId)!,patient=world.pawns.find(p=>p.id===proposal.patientId)!;
  if(bed.kind==='double-bed'&&(capture||proposal.bedSlot===undefined||!rescueBedAvailable(world,bed,patient,actor.id,false,proposal.bedSlot)))return;
  // The accepted rescue itself reserves a new visitor's destination. Do not
  // leave an ordinary bed owner behind if the order is cancelled before pickup.
  if(!bed.medical&&!capture&&(!isRescuableVisitor(patient)||isAdmittedVisitorGuest(patient)))claimLocalActorBed256(world,patient,bed,bed.kind==='double-bed'?proposal.bedSlot:undefined);
  actor.rescue={patientId:proposal.patientId,bedId:proposal.bedId,phase:'approach',...(bed.kind==='double-bed'?{bedSlot:proposal.bedSlot}:{}),...(capture?{capture:true as const}:{})};
  actor.path=proposal.path;actor.state='moving';actor.planCooldown=0;
  if(forced)actor.orders.active='rescue';
}
export function applyRescue(world:World,command:{pawnId:number;patientId:number;queue:boolean}):CommandResult {
  const actor=world.pawns.find(p=>p.id===command.pawnId),patient=world.pawns.find(p=>p.id===command.patientId);
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!actor||!patient||typeof command.queue!=='boolean')return fail('Colon ou patient introuvable.');
  if(command.queue)return fail('Le secours direct ne peut pas encore être ajouté à une file.');
  const reason=rescueReason(world,actor,patient,true);if(reason)return fail(reason);
  const proposal=rescueProposal(world,actor,patient,reachableCells(world,actor,blockedCells(world),new Set()),true);
  if(!proposal)return fail('Aucun patient et couchage admissible reliés par un accès praticable.');
  const drops=planCommandDrops(world,{type:'order-rescue',...command});
  if(!drops)return fail('Pas de place pour déposer la cargaison avant le secours.');
  if(!releaseWork(world,actor,drops))return fail('Impossible de libérer le travail précédent.');
  if(world.schemaVersion>=237&&actor.draft){
    cancelShooting(actor);cancelMelee(actor);
    actor.draft.target=null;actor.draft.queue=[];actor.draft.lastActiveTick=world.tick;
  }
  clearQueuedOrders(world,actor);delete actor.priorityWork;startRescue(world,actor,proposal,true);
  return {ok:true};
}
/** Cheap relationship checks; navigation is revalidated by the ordinary mover. */
export function reconcileRescues(world:World):void {
  for(const actor of world.pawns)if(actor.rescue){
    if(!allowedAreaServicesAllowed(world,actor)){if(!releaseWork(world,actor))interruptWork(world,actor);continue;}
    if(actor.rescue.release){reconcileRelease(world,actor);continue;}
    if(actor.rescue.arrest){reconcileArrest(world,actor);continue;}
    const task=actor.rescue,patient=world.pawns.find(p=>p.id===task.patientId),bed=structureById(world,task.bedId);
    if(!patient||!task.capture&&actor.orders.active!=='rescue'&&backgroundWorkRefusal(actor,patient.prisoner?'warden':'doctor')||(task.capture?!!captureReason(world,actor,patient,true):!wantsRescue(patient,actor.orders.active==='rescue')||!!visitorRescueRefusal(world,patient,actor.orders.active==='rescue'))||!bed
      ||bed.kind==='double-bed'&&(task.bedSlot===undefined||patient.bedId!==bed.id||patient.bedSlot!==task.bedSlot)
      ||!rescueBedAvailable(world,bed,patient,actor.id,!!task.capture,task.bedSlot)||medicalWorkRefusal(actor))releaseWork(world,actor);
  }
}
export function processRescue(world:World,actor:Pawn,context:NeedContext):void {
  if(!allowedAreaServicesAllowed(world,actor)){if(!context.release())interruptWork(world,actor);return;}
  const task=actor.rescue;if(!task)return;
  if(task.release){processPrisonerRelease(world,actor,context);return;}
  if(task.arrest){processArrest(world,actor,context);return;}
  const patient=world.pawns.find(p=>p.id===task.patientId),bed=structureById(world,task.bedId);
  // Finish the previous physiological interval under its previous posture,
  // regardless of which actor was processed first in this tick.
  if(patient&&patient.health&&!patient.health.death&&patient.health.tick<world.tick)updatePawnHealth(world,patient);
  if(!patient||!task.capture&&actor.orders.active!=='rescue'&&backgroundWorkRefusal(actor,patient.prisoner?'warden':'doctor')||(task.capture?!!captureReason(world,actor,patient,true):!wantsRescue(patient,actor.orders.active==='rescue')||!!visitorRescueRefusal(world,patient,actor.orders.active==='rescue'))||!bed
    ||bed.kind==='double-bed'&&(task.bedSlot===undefined||patient.bedId!==bed.id||patient.bedSlot!==task.bedSlot)
    ||!rescueBedAvailable(world,bed,patient,actor.id,!!task.capture,task.bedSlot)){releaseWork(world,actor);return;}
  const target=bed.kind==='double-bed'&&task.bedSlot!==undefined?bedSlotCell(bed,task.bedSlot):bed;
  if(!target){releaseWork(world,actor);return;}
  if(bed.kind==='double-bed'&&(actor.moveCooldown>0||(actor.motion?.end??0)>world.tick))return;
  actor.state='moving';
  if(task.phase==='approach'){
    if(actor.x!==patient.x||actor.z!==patient.z){context.move(patient,true);return;}
    if(patient.moveCooldown>0||bed.kind==='double-bed'&&(patient.motion?.end??0)>world.tick)return;
    // Membership must leave before actual pickup changes this person's holder.
    preparePartyRelease292(world,new Set([patient.id]),{finish:world.party292?.active?.organizerId===patient.id}).commit();
    patient.need=null;delete patient.medicalSleep;patient.path=[];
    // Core's invitation precedes the real carry, without changing faction,
    // inventory, visit group or phase. A later interruption retains admission.
    if(!task.capture&&actor.orders.active==='rescue'&&isRescuableVisitor(patient)){
      patient.visitor!.medicalGuestAt??=world.tick;patient.visitor!.goal=null;commitMedicalGuest259(world,patient);
      if(!bed.medical)claimLocalActorBed256(world,patient,bed);
    }
    if(patient.health)cancelToxicVomit256(patient.health);
    task.phase='carry';actor.path=[];actor.planCooldown=0;syncPatient(world,actor);
    context.event(`${actor.name} prend ${patient.name} pour le porter vers un lit.`);
  }
  if(actor.x!==target.x||actor.z!==target.z){context.move(target,true);syncPatient(world,actor);return;}
  if(bed.kind==='double-bed')syncPatient(world,actor);
  if(task.capture&&!completeCapture(world,patient))return;
  // Historical capsule admission remains at deposit; visitor admission above
  // follows its separate pickup timing and never fabricates a capsule record.
  if(!task.capture&&patient.faction==='outlanders'&&patient.podRescue){patient.podRescue.admittedAt??=world.tick;commitMedicalGuest259(world,patient);}
  // The mover has completed the captured edge before entering this processor.
  delete actor.rescue;actor.orders.active=null;actor.path=[];actor.state='idle';actor.planCooldown=0;
  patient.motion=null;patient.moveCooldown=0;
  if(!bed.medical)claimLocalActorBed256(world,patient,bed,bed.kind==='double-bed'?task.bedSlot:undefined);
  // Admission may finish after a captive recovers during transport. Only a
  // still-downed patient is installed in the lying service immediately; a
  // mobile captive chooses medical rest, sleep or food on its next turn.
  if(patient.state==='downed')patient.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:target.x,z:target.z}};
  else {patient.need=null;patient.state='idle';patient.planCooldown=0;patient.needCooldown=0;}
  context.event(task.capture?`${actor.name} a capturé ${patient.name} et l’a installé dans un lit de prison${bed.medical?' médical':''}.`:`${actor.name} a installé ${patient.name} dans un lit${bed.medical?' médical':''}.`);
}
