import {claimLocalActorBed256,captureActorBeds256,localBedClaimAvailable256} from './actor-bed-local-256.ts';
import { allowedAreaAllows,allowedAreaReason } from './allowed-area-state.ts';
import { hostileTo,isColonist } from './affiliation.ts';
import { arrestAcceptedAutomatically,arrestSuccessChance } from './arrest-rules.ts';
import { planCaptureDrops,completeCapture } from './capture.ts';
import { patientClaimed } from './care-access.ts';
import { scoutOnMapId } from './caravan-trip.ts';
import { commercialOnMapId } from './commercial-trip.ts';
import { groupOnMapMember } from './group-authority.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { healthRandom,updatePawnHealth } from './health.ts';
import { biologicalYears,legacyHumanAge } from './human-age.ts';
import { rescueBedAvailable,medicalBedPreference } from './medical-beds.ts';
import { startBerserk } from './mental-break.ts';
import { resetMentalBreakForArrest } from './mental-state.ts';
import { moodFrozen } from './mood.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { blockedCells,reachableCells,routeToCell,type Reachability } from './pathfinding.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { carrierOf,rescueClaim,syncPatient } from './rescue-state.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,CommandResult,Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface ArrestProposal {patientId:number;bedId:number;path:Cell[]}
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const travelling=(world:World,p:Pawn)=>scoutOnMapId(world)===p.id||commercialOnMapId(world)===p.id||groupOnMapMember(world,p.id);
const settled=(world:World,p:Pawn)=>p.moveCooldown===0&&(p.motion?.end??0)<=world.tick
  &&(p.stun?.untilCore??0)<=world.tick*10&&(p.melee?.strike?.untilCore??0)<=world.tick*10
  &&!(p.shooting?.stance?.phase==='cooldown'&&p.shooting.stance.endsAtCore>world.tick*10);

/** A forced local service, separate from the historical outlaw Capture. The
 * marker and an actual prisoner during carry are the saved one-shot outcome. */
export function arrestReason(world:World,actor:Pawn,patient:Pawn|undefined,accepted=false):string|undefined {
  if(world.schemaVersion<213)return 'L’arrestation n’est pas disponible dans cette version.';
  if(!world.pawns.includes(actor)||!isColonist(actor)||actor.prisoner)return 'Seul un colon libre peut arrêter.';
  if(actor.draft)return 'Démobilisez ce colon avant l’arrestation.';
  const medical=medicalWorkRefusal(actor);if(medical)return medical;
  if(actor.mental?.crisis||actor.burning||actor.flee||actor.collapsePending||world.restRules==='legacy'&&actor.rest===0)return 'Ce colon ne peut pas assurer ce transport.';
  if(actor.visitor||actor.podRescue||actor.raid||actor.tactics||travelling(world,actor)||carrierOf(world,actor.id))return 'Ce colon est déjà engagé dans un autre déplacement.';
  if(actor.interruptedCargo)return 'La cargaison doit être déposée avant l’arrestation.';
  if(!patient||patient===actor||!world.pawns.includes(patient)||!isColonist(patient)||patient.state==='dead'||patient.health?.death
    ||biologicalYears(patient.age??legacyHumanAge())<18)return 'Choisissez un colon adulte vivant.';
  if(patient.visitor||patient.podRescue||patient.raid||patient.tactics||patient.surgeryRequest||travelling(world,patient))return 'Cette personne est engagée dans un autre service ou voyage.';
  const carrying=accepted&&actor.rescue?.arrest===true&&actor.rescue.phase==='carry'&&actor.rescue.patientId===patient.id;
  if(carrying){if(!patient.prisoner||patient.mental?.crisis)return 'Le transport ne possède plus son détenu.';}
  else if(patient.prisoner||!patient.mental?.crisis)return 'Choisissez un colon libre en crise mentale.';
  if(hostileTo(patient,actor)||hostileTo(patient,{faction:'colony'}))return 'Une personne hostile ne peut pas être arrêtée de cette façon.';
  const areaReason=!carrying?allowedAreaReason(world,actor,patient):undefined;if(areaReason)return areaReason;
  const carrier=carrierOf(world,patient.id);
  if(carrier&&carrier!==actor||rescueClaim(world,patient.id,actor.id)||patientClaimed(world,patient.id,actor))return 'Une autre personne a réservé ce patient.';
  return undefined;
}

export function arrestProposal(world:World,actor:Pawn,patient:Pawn,reach:Reachability):ArrestProposal|undefined {
  if(arrestReason(world,actor,patient))return;
  const path=routeToCell(world,patient,reach);if(!path)return;
  const bedOwners=world.schemaVersion>=256?captureActorBeds256(world):undefined;
  const beds=world.structures.filter(b=>allowedAreaAllows(world,actor,b)&&rescueBedAvailable(world,b,patient,actor.id,true)&&localBedClaimAvailable256(world,b,patient,undefined,bedOwners)).sort((a,b)=>
    medicalBedPreference(a)-medicalBedPreference(b)||(a.x-patient.x)**2+(a.z-patient.z)**2-(b.x-patient.x)**2-(b.z-patient.z)**2||a.id-b.id);
  for(const bed of beds)if(routeToCell(world,bed,reach))return {patientId:patient.id,bedId:bed.id,path};
}

export function applyArrest(world:World,command:{pawnId:number;patientId:number;queue:boolean}):CommandResult {
  const actor=world.pawns.find(p=>p.id===command.pawnId),patient=world.pawns.find(p=>p.id===command.patientId);
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!actor||!patient||typeof command.queue!=='boolean')return fail('Colon ou cible introuvable.');
  if(command.queue)return fail('L’arrestation directe ne peut pas encore être ajoutée à une file.');
  const reason=arrestReason(world,actor,patient);if(reason)return fail(reason);
  const proposal=arrestProposal(world,actor,patient,reachableCells(world,actor,blockedCells(world),new Set()));
  if(!proposal)return fail('Il faut un lit de prison libre dans une pièce fermée et un trajet praticable.');
  const drops=planCommandDrops(world,{type:'clear-orders',pawnId:actor.id});
  if(!drops||!releaseWork(world,actor,drops))return fail('Pas de place pour déposer la cargaison avant l’arrestation.');
  clearQueuedOrders(world,actor);delete actor.priorityWork;cancelMelee(actor);cancelShooting(actor);
  actor.rescue={patientId:patient.id,bedId:proposal.bedId,phase:'approach',arrest:true};
  actor.path=proposal.path;actor.state='moving';actor.planCooldown=0;actor.orders.active='rescue';
  return {ok:true};
}

export function reconcileArrest(world:World,actor:Pawn):boolean {
  const task=actor.rescue;if(!task?.arrest)return false;
  const patient=world.pawns.find(p=>p.id===task.patientId),bed=structureById(world,task.bedId);
  if(!task.capture&&!task.release&&actor.orders.active==='rescue'&&!arrestReason(world,actor,patient,true)
    &&patient&&bed&&allowedAreaAllows(world,actor,bed)&&rescueBedAvailable(world,bed,patient,actor.id,true))return true;
  releaseWork(world,actor);return false;
}

function cancelFutureCombat(world:World,patient:Pawn):void {
  cancelMelee(patient);cancelShooting(patient);
  for(const actor of world.pawns)if(actor!==patient){
    const melee=actor.melee?.order;
    if(melee&&!melee.structure&&melee.targetId===patient.id&&(melee.auto==='draft'||melee.auto==='response')){cancelMelee(actor);actor.path=[];}
    const shot=actor.shooting?.order;
    if(shot?.targetId===patient.id&&(shot.auto?.kind==='draft'||shot.auto?.kind==='response'))cancelShooting(actor);
  }
  for(const s of world.structures)if(s.turret?.targetKey===`pawn:${patient.id}`){s.turret.targetKey=null;s.turret.warmup=null;}
}

export function processArrest(world:World,actor:Pawn,context:NeedContext):void {
  const task=actor.rescue;if(!task?.arrest)return;
  const patient=world.pawns.find(p=>p.id===task.patientId);
  if(patient?.health&&!patient.health.death&&patient.health.tick<world.tick)updatePawnHealth(world,patient);
  if(!reconcileArrest(world,actor)||!patient)return;
  const bed=structureById(world,task.bedId)!;
  if(!settled(world,actor)){syncPatient(world,actor);return;}
  actor.state='moving';
  if(task.phase==='approach'){
    if(!same(actor,patient)){context.move(patient,true);return;}
    if(!settled(world,patient))return;
    // Every temporary/equipped possession is admitted before randomness. A
    // saturated floor postpones the contact without a roll or status change.
    const drops=planCaptureDrops(world,patient);if(!drops)return;
    if(!arrestAcceptedAutomatically(patient)&&healthRandom(world)>=arrestSuccessChance(actor)){
      releaseWork(world,actor);
      context.event(`${patient.name} refuse l’arrestation par ${actor.name}.`);
      // Core can replace a non-aggressive crisis by Berserk after refusal. Our
      // starter requires an empty state, so reset only once admission is sure.
      if(patient.state!=='downed'&&patient.state!=='sleeping'&&!moodFrozen(patient)&&!carrierOf(world,patient.id)){
        resetMentalBreakForArrest(patient);startBerserk(world,patient);
      }
      return;
    }
    if(!completeCapture(world,patient,drops))return;
    resetMentalBreakForArrest(patient);cancelFutureCombat(world,patient);delete patient.hostilityResponse;
    task.phase='carry';actor.path=[];actor.planCooldown=0;syncPatient(world,actor);
    context.event(`${actor.name} arrête ${patient.name} et le porte vers la prison.`);
  }
  if(!same(actor,bed)){context.move(bed,true);syncPatient(world,actor);return;}
  delete actor.rescue;actor.orders.active=null;actor.path=[];actor.state='idle';actor.planCooldown=0;
  patient.motion=null;patient.moveCooldown=0;if(!bed.medical)claimLocalActorBed256(world,patient,bed);
  if(patient.state==='downed')patient.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:bed.x,z:bed.z}};
  else {patient.need=null;patient.state='idle';patient.planCooldown=0;patient.needCooldown=0;}
  context.event(`${actor.name} a installé ${patient.name} dans un lit de prison${bed.medical?' médical':''}.`);
}
