import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {CRYPTOSLEEP_ENTER_CORE_271,CRYPTOSLEEP_OPEN_CORE_271,isPlayerCasket271,cryptosleepInteraction271,type CryptosleepTask271,type CryptosleepCommand271,type PlayerCasket271} from './cryptosleep-state-271.ts';
import {cryptosleepIntent271,cryptosleepActorCapable271,cryptosleepHuman271,cryptosleepTravelRefusal271,cryptosleepClaim271} from './cryptosleep-intent-271.ts';
import {planCryptosleepEntry271,planCryptosleepRelease271} from './cryptosleep-transfer-271.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {patientClaimed} from './care-access.ts';
import {carrierOf,syncPatient,releaseCryptosleepCarry271,markHumanCarrierCandidatesDirty} from './rescue-state.ts';
import {deconstructionReserved} from './deconstruction-rules.ts';
import {updatePawnHealth} from './health.ts';
import {planPawnDrops,releaseWork} from './work-release.ts';
import {clearQueuedOrders} from './player-orders.ts';
import type {NeedContext} from './needs.ts';
import type {CommandResult,Pawn,World} from './types.ts';

const get=(w:World,id:number)=>w.structures.find((s):s is PlayerCasket271=>s.id===id&&isPlayerCasket271(s));
export function releaseCryptosleepTask271(w:World,p:Pawn):void {
 releaseCryptosleepCarry271(w,p);p.path=[];p.planCooldown=0;
 if(p.moveCooldown===0&&(p.motion?.end??0)<=w.tick&&['working','moving'].includes(p.state))p.state='idle';
}
/** Relationship/capability checks only; no flood, copy or clinical advancement. */
export function cryptosleepContinuationReason271(w:World,p:Pawn):string|undefined {
 const t=p.cryptosleepTask;if(!t)return;
 const target=get(w,t.casketId);if(!isSchema271OrLater(w.schemaVersion)||!cryptosleepActorCapable271(w,p)||cryptosleepTravelRefusal271(w,p))return 'Le colon ne peut plus poursuivre ce service.';
 if(!target?.cryptosleep||cryptosleepClaim271(w,target.id,p.id)||deconstructionReserved(w,target.id,p.id))return 'Le caisson ou sa réservation ne permet plus ce service.';
 if(t.action==='open'?!target.cryptosleep.human:!!target.cryptosleep.human)return 'Le contenu du caisson a changé.';
 const cell=cryptosleepInteraction271(target);if(allowedAreaReason(w,p,cell)||reservedServiceCells(w,p.id).has(cell.z*w.width+cell.x))return 'La case du caisson n’est plus disponible.';
 if(t.action==='carry'){
  const patient=w.pawns.find(q=>q.id===t.patientId),carrying=t.phase==='carry'||t.phase==='closing';
  if(!patient||patient===p||!cryptosleepHuman271(patient)||cryptosleepTravelRefusal271(w,patient)||!carrying&&patient.state!=='downed')return 'Le patient ne permet plus cette admission.';
  const carrier=carrierOf(w,patient.id);if(carrier&&(carrier!==p||!carrying)||patientClaimed(w,patient.id,p))return 'Un autre service possède ce patient.';
  if(!carrying&&allowedAreaReason(w,p,patient))return 'Le patient est hors de la zone autorisée.';
 }
 return;
}
export function reconcileCryptosleepTask271(w:World,p:Pawn):void {if(p.cryptosleepTask&&cryptosleepContinuationReason271(w,p))releaseCryptosleepTask271(w,p);}
/** Settled contact begins the interval. Duplicate, paused or skipped ticks do
 * not grant work, and the final ready state is committed or cancelled now. */
export function advanceCryptosleepContact271(t:CryptosleepTask271,tick:number,contact:boolean):'wait'|'cancel'|'ready' {
 if(!Number.isSafeInteger(tick)||tick<t.lastWorkedAt||!contact)return 'cancel';
 if(t.phase!=='closing'&&t.phase!=='opening'){t.phase=t.action==='open'?'opening':'closing';t.progressCore=0;t.lastWorkedAt=tick;return 'wait';}
 if(tick===t.lastWorkedAt)return 'wait';if(tick!==t.lastWorkedAt+1)return 'cancel';
 t.lastWorkedAt=tick;t.progressCore+=10;return t.progressCore>=(t.action==='open'?CRYPTOSLEEP_OPEN_CORE_271:CRYPTOSLEEP_ENTER_CORE_271)?'ready':'wait';
}
export function applyCryptosleep271(w:World,c:CryptosleepCommand271):CommandResult {
 const intent=cryptosleepIntent271(w,c);if(!intent.ok)return {ok:false,code:'invalid-command',reason:intent.reason};
 const {pawn:p,casket,patient,path}=intent,drops=planPawnDrops(w,new Set([p.id,...patient?[patient.id]:[]]));
 if(!drops||!releaseWork(w,p,drops))return {ok:false,code:'invalid-command',reason:'La cargaison doit pouvoir être déposée avant cet ordre.'};
 clearQueuedOrders(w,p);delete p.priorityWork;
 p.cryptosleepTask={casketId:casket.id,action:c.type==='order-enter-cryptosleep'?'enter':c.type==='order-carry-cryptosleep'?'carry':'open',phase:'approach',...patient?{patientId:patient.id}:{},progressCore:0,lastWorkedAt:w.tick};
 markHumanCarrierCandidatesDirty();
 p.path=path;p.state=path.length?'moving':'working';p.planCooldown=0;return {ok:true};
}
/** Runs after ordinary physiology and immediate danger, before civilian work. */
export function processCryptosleepTask271(w:World,p:Pawn,context:NeedContext):boolean {
 const task=p.cryptosleepTask;if(!task)return false;
 const cancel=(reason?:string)=>{releaseCryptosleepTask271(w,p);if(reason)context.event(reason);};
 const refusal=cryptosleepContinuationReason271(w,p);if(refusal){cancel();return false;}
 const target=get(w,task.casketId)!;
 let patient=task.action==='carry'?w.pawns.find(q=>q.id===task.patientId):p;
 if(!patient){cancel();return false;}
 if(task.action==='carry'&&task.phase==='approach'){
  p.state='moving';if(p.x!==patient.x||p.z!==patient.z){context.move(patient,true);return true;}
  if(p.moveCooldown>0||(p.motion?.end??0)>w.tick||patient.moveCooldown>0||(patient.motion?.end??0)>w.tick)return true;
  // Finish the patient's real previous physiological interval before changing
  // posture. A recovery before pickup still refuses this downed-only order.
  if(patient.health&&!patient.health.death&&medicalCivilTick271(patient.health)<w.tick)updatePawnHealth(w,patient);
  if(patient.state!=='downed'||patient.health?.death){cancel();return false;}
  const drops=planPawnDrops(w,new Set([patient.id]));if(!drops||!releaseWork(w,patient,drops)){cancel('Le patient ne peut pas déposer sa cargaison avant le portage.');return false;}
  clearQueuedOrders(w,patient);delete patient.priorityWork;patient.path=[];patient.need=null;delete patient.medicalSleep;
  task.phase='carry';p.path=[];p.planCooldown=0;syncPatient(w,p);context.event(`${p.name} prend ${patient.name} pour le porter vers le caisson.`);
 }
 const cell=cryptosleepInteraction271(target),contact=p.x===cell.x&&p.z===cell.z&&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick;
 if(!contact){if(task.phase==='closing'||task.phase==='opening'){cancel();return false;}p.state='moving';context.move(cell,true);if(task.action==='carry')syncPatient(w,p);return true;}
 if(task.action==='carry'){
  syncPatient(w,p);
  if(patient.health&&!patient.health.death&&medicalCivilTick271(patient.health)<w.tick)updatePawnHealth(w,patient);
  // Once carried, recovering the ability to stand does not by itself cancel
  // the native500-Core closing service. The same original remains claimed.
  if(!cryptosleepHuman271(patient)){cancel();return false;}
 }
 p.path=[];p.state='working';const result=advanceCryptosleepContact271(task,w.tick,true);
 if(result==='cancel'){cancel();return false;}if(result==='wait')return true;
 const plan=task.action==='open'?planCryptosleepRelease271(w,target,'open'):planCryptosleepEntry271(w,target,patient);
 if(!plan.ok){cancel(plan.reason);return false;}
 if(!plan.commit()){cancel();return false;}
 // Entry owns clinical/activity cleanup on the transferred original. A
 // separate carrier/opener remains local and releases only its own mandate.
 if(w.pawns.includes(p))releaseCryptosleepTask271(w,p);
 context.event(task.action==='open'?`${p.name} ouvre le caisson de cryptosommeil.`:`${patient.name} entre en cryptosommeil.`);return true;
}
