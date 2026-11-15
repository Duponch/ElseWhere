import {bedInteractionCells336} from './care-access.ts';
import { isCarePatient,isColonist } from './affiliation.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { lyingPatient,patientClaimed,bedsideAccess } from './care-access.ts';
import { treatmentTarget,type TendTask } from './care-rules.ts';
import { currentMedicalBed } from './hospital-medical-stats.ts';
import { carrierOf } from './rescue-state.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { canStandAt } from './furniture-travel.ts';
import { serviceCell } from './service-reservations.ts';
import { blockedCells,reachableCells,type Reachability } from './pathfinding.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { cancelShooting } from './shooting-state.ts';
import { cancelMelee } from './melee-state.ts';
import type { Cell,Command,CommandResult,Pawn,World } from './types.ts';

export type DraftedTendingCommand=Extract<Command,{type:'order-drafted-tend'}>;
/** No passive provider: this marker belongs to one accepted, dry order. */
export const isDraftedTending=(pawn:Pick<Pawn,'tend'>):boolean=>pawn.tend?.drafted===true;

/** Local human care only. InBed remains mandatory for ordinary tending;
 * this explicit service preserves existing care permissions and incapabilities. */
export function draftedTendingReason(world:World,doctor:Pawn,patient:Pawn|undefined,accepted=false):string|undefined {
  if(world.schemaVersion<233)return 'Les soins mobilisés ne sont pas disponibles dans cette sauvegarde.';
  if(!world.pawns.includes(doctor)||!isColonist(doctor)||doctor.prisoner||!doctor.draft)
    return 'Mobilisez un colon libre pour donner des soins sans médicament.';
  const refusal=backgroundWorkRefusal(doctor,'doctor')??medicalWorkRefusal(doctor);
  if(refusal)return refusal;
  if(doctor.mental?.crisis||doctor.state==='sleeping'||doctor.need)return 'Ce colon doit être éveillé et disponible pour soigner.';
  if(doctor.health?.death)return 'Ce colon est décédé.';
  if(doctor.burning||doctor.bombRefuge||doctor.heatRefuge||doctor.tactics)return 'Ce colon doit terminer sa réaction immédiate avant les soins mobilisés.';
  if((doctor.stun?.untilCore??0)>world.tick*10||doctor.melee?.strike||doctor.shooting?.stance?.phase==='cooldown')
    return 'Attendez la fin de l’étourdissement ou de la récupération de combat.';
  if(doctor.collapsePending||world.restRules==='legacy'&&doctor.rest===0)return 'Ce colon doit récupérer de son épuisement.';
  if(carrierOf(world,doctor.id))return 'Ce colon est transporté.';
  if(doctor.interruptedCargo)return 'La cargaison doit être déposée avant les soins.';
  if(!patient||!world.pawns.includes(patient)||!isCarePatient(patient)&&!(world.schemaVersion>=237&&patient.state==='downed'))return 'Patient humain pris en charge introuvable.';
  if(patient.id===doctor.id)return 'Les auto-soins utilisent leur commande et leur politique habituelles.';
  if(patient.state==='dead'||patient.health?.death)return 'Ce patient est décédé.';
  if(patient.mental?.crisis||prisonBreakActive(patient))return 'Ce patient est en crise et ne peut pas recevoir ces soins mobilisés.';
  if(carrierOf(world,patient.id))return 'Le patient est transporté : posez-le avant les soins.';
  if(patient.state!=='downed'&&!(lyingPatient(patient)&&currentMedicalBed(world,patient)))
    return 'Ces soins mobilisés demandent un patient à terre ou déjà couché dans un lit.';
  if(patient.moveCooldown>0||(patient.motion?.end??0)>world.tick)return 'Attendez la fin du déplacement du patient.';
  if(!treatmentTarget(patient))return 'Aucune blessure ou maladie autorisée ne nécessite actuellement un traitement.';
  if(patientClaimed(world,patient.id,doctor))return 'Ce patient est déjà réservé par un soignant ou un sauveteur.';
  if(accepted){
    const task=doctor.tend;
    if(!task?.drafted||task.patientId!==patient.id||!['approach','tend'].includes(task.phase)
      ||task.urgent!==undefined||task.useMedicine!==undefined||task.medicine!==undefined
      ||doctor.orders.active!=='tend'||doctor.orders.queue.length||doctor.draft.target!==null||doctor.draft.queue.length
      ||doctor.jobId!==null||doctor.haul||doctor.cooking||doctor.feed||doctor.ward||doctor.rescue||doctor.surgery
      ||doctor.research||doctor.orbitalTrade||doctor.deepWork||doctor.animalHandling||doctor.animalCare||doctor.animalFeed||doctor.animalRescue
      ||doctor.hunting||doctor.burial||doctor.cleaning||doctor.firefighting||doctor.trade||doctor.equipmentTask||doctor.recreation.task
      ||doctor.priorityWork||doctor.flee||doctor.melee||doctor.shooting||doctor.transitExit)
      return 'Mandat de soins mobilisés invalide.';
  }
}
export function draftedTendingPlaceValid(world:World,_doctor:Pawn,patient:Pawn,task:TendTask):boolean {
  if(world.schemaVersion>=336){const cells=bedInteractionCells336(world,patient);if(cells)return canStandAt(world,task.spot)&&cells.some(c=>c.x===task.spot.x&&c.z===task.spot.z);}
  return canStandAt(world,task.spot)&&Math.abs(task.spot.x-patient.x)+Math.abs(task.spot.z-patient.z)===1;
}
export function draftedTendingProposal(world:World,doctor:Pawn,patient:Pawn,reach:Reachability):{task:TendTask;path:Cell[]}|undefined {
  if(draftedTendingReason(world,doctor,patient))return;
  // An urgent leisure visit yields during its ordinary processor, but its
  // durable claim still exists before that happens. Do not create two owners
  // in an immediate command checkpoint; another free bedside cell may be used.
  const additionalReserved=new Set<number>();
  for(const actor of world.pawns)if(actor.id!==doctor.id){
    const cell=serviceCell(actor,world);if(cell)additionalReserved.add(cell.z*world.width+cell.x);
  }
  const best=bedsideAccess(world,doctor,patient,reach,additionalReserved,true);
  return best?{task:{drafted:true,patientId:patient.id,spot:best.spot,phase:'approach',progress:0},path:best.path}:undefined;
}
export function applyDraftedTending(world:World,command:DraftedTendingCommand):CommandResult {
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!Number.isSafeInteger(command.pawnId)||!Number.isSafeInteger(command.patientId)||command.queue!==false)
    return fail('Ordre direct de soins mobilisés invalide : aucune file.');
  const doctor=world.pawns.find(p=>p.id===command.pawnId),patient=world.pawns.find(p=>p.id===command.patientId);
  if(!doctor||!patient)return fail('Colon ou patient introuvable.');
  const reason=draftedTendingReason(world,doctor,patient);if(reason)return fail(reason);
  const proposal=draftedTendingProposal(world,doctor,patient,reachableCells(world,doctor,blockedCells(world),new Set()));
  if(!proposal)return fail('Aucune place accessible au contact du patient.');
  const drops=planCommandDrops(world,command);
  if(!drops||!releaseWork(world,doctor,drops))return fail('Pas de place pour déposer la cargaison avant les soins.');
  clearQueuedOrders(world,doctor);delete doctor.priorityWork;delete doctor.flee;
  cancelShooting(doctor);cancelMelee(doctor);
  doctor.draft!.target=null;doctor.draft!.queue=[];doctor.draft!.lastActiveTick=world.tick;
  doctor.tend=proposal.task;doctor.orders.active='tend';doctor.path=proposal.path;doctor.state='moving';doctor.planCooldown=0;
  return {ok:true};
}
