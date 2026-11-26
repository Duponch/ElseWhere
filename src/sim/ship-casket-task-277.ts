import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {markHumanCarrierCandidatesDirty} from './rescue-state.ts';
import {isShipCasket277,SHIP_CASKET_ENTER_CORE_277,type ShipCasket277,type ShipCasketCommand277,type ShipCasketTask277,type ShipCasketOccupant277} from './ship-casket-state-277.ts';
import {shipCasketInteraction277} from './ship-casket-geometry-277.ts';
import {shipCasketIntent277,validShipCasketCommand277,shipCasketActorCapable277,shipCasketLiving277,shipCasketClaim277,shipCasketPatientReason277} from './ship-casket-intent-277.ts';
import {shipCasketSubject277,syncShipCasketPassenger277,releaseShipCasketCarry277} from './ship-casket-carry-277.ts';
import {planShipCasketEntry277,planShipCasketRelease277} from './ship-casket-transfer-277.ts';
import {cryptosleepTravelRefusal271} from './cryptosleep-intent-271.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {deconstructionReserved} from './deconstruction-rules.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {updatePawnHealth} from './health.ts';
import {advanceAnimalHealth} from './wildlife-health.ts';
import {planPawnDrops,releaseWork} from './work-release.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {cancelShooting} from './shooting-state.ts';
import {cancelMelee} from './melee-state.ts';
import {animalSpecies} from './animal-species.ts';
import type {NeedContext} from './needs.ts';
import type {Pawn,World,CommandResult} from './types.ts';

const get=(w:World,id:number)=>w.structures.find((s):s is ShipCasket277=>s.id===id&&isShipCasket277(s));
const actor=(o:ShipCasketOccupant277)=>o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech;
export const shipCasketOccupantLabel277=(o:ShipCasketOccupant277):string=>o.kind==='human'?o.pawn.name:o.kind==='animal'?`${animalSpecies(o.animal.species).label} ${o.animal.id}`:`Mécanoïde ${o.mech.id}`;
export function releaseShipCasketTask277(w:World,p:Pawn):void {
 releaseShipCasketCarry277(w,p);p.path=[];p.planCooldown=0;
 if(p.moveCooldown===0&&(p.motion?.end??0)<=w.tick&&['working','moving'].includes(p.state))p.state='idle';
}
export function shipCasketContinuationReason277(w:World,p:Pawn):string|undefined {
 const t=p.shipCasketTask277;if(!t)return;
 if(!isSchema277OrLater(w.schemaVersion)||!shipCasketActorCapable277(w,p,t.action==='carry')||cryptosleepTravelRefusal271(w,p))return 'Le colon ne peut plus poursuivre ce service.';
 const box=get(w,t.casketId);if(!box?.shipCryptosleep277||box.shipCryptosleep277.occupant||shipCasketClaim277(w,box.id,p.id)||deconstructionReserved(w,box.id,p.id))return 'Le caisson ou sa réservation ne permet plus ce service.';
 const cell=shipCasketInteraction277(box,box.orientation);
 if(allowedAreaReason(w,p,cell)||reservedServiceCells(w,p.id).has(cell.z*w.width+cell.x))return 'La case du caisson n’est plus disponible.';
 if(t.action==='carry'){
  if(!t.patient)return 'Le patient de ce portage est absent.';
  const carrying=t.phase==='carry'||t.phase==='closing',reason=shipCasketPatientReason277(w,t.patient,p,carrying);if(reason)return reason;
  const o=shipCasketSubject277(w,t.patient)!;if(!carrying&&allowedAreaReason(w,p,actor(o)))return 'Le patient est hors de la zone autorisée.';
 }
}
export function reconcileShipCasketTask277(w:World,p:Pawn):void {if(p.shipCasketTask277&&shipCasketContinuationReason277(w,p))releaseShipCasketTask277(w,p);}
export function advanceShipCasketContact277(t:ShipCasketTask277,tick:number,contact:boolean):'wait'|'cancel'|'ready' {
 if(!Number.isSafeInteger(tick)||tick<t.lastWorkedAt||!contact)return 'cancel';
 if(t.phase!=='closing'){t.phase='closing';t.progressCore=0;t.lastWorkedAt=tick;return 'wait';}
 if(tick===t.lastWorkedAt)return 'wait';if(tick!==t.lastWorkedAt+1)return 'cancel';
 t.lastWorkedAt=tick;t.progressCore+=10;return t.progressCore>=SHIP_CASKET_ENTER_CORE_277?'ready':'wait';
}
export function applyShipCasket277(w:World,c:ShipCasketCommand277):CommandResult {
 if(!validShipCasketCommand277(c,w.schemaVersion,w.nextId))return {ok:false,code:'invalid-command',reason:'Ordre de caisson spatial invalide.'};
 if(c.type==='eject-ship-casket'){
  const box=get(w,c.casketId);if(!box)return {ok:false,code:'invalid-command',reason:'Caisson spatial introuvable.'};
  const plan=planShipCasketRelease277(w,box);if(!plan.ok)return {ok:false,code:'invalid-command',reason:plan.reason};
  return plan.commit()?{ok:true}:{ok:false,code:'invalid-command',reason:'Le véritable contenu du caisson a changé.'};
 }
 const intent=shipCasketIntent277(w,c);if(!intent.ok)return {ok:false,code:'invalid-command',reason:intent.reason};
 const p=intent.pawn,patient=intent.patient,drops=planPawnDrops(w,new Set([p.id,...patient?.kind==='human'?[patient.pawn.id]:[]]));
 if(!drops||!releaseWork(w,p,drops))return {ok:false,code:'invalid-command',reason:'La cargaison doit pouvoir être déposée avant cet ordre.'};
 clearQueuedOrders(w,p);delete p.priorityWork;cancelShooting(p);cancelMelee(p);
 if(p.draft){p.draft.target=null;p.draft.queue=[];p.draft.lastActiveTick=w.tick;}
 p.shipCasketTask277={casketId:intent.casket.id,action:c.type==='order-enter-ship-casket'?'enter':'carry',phase:'approach',...c.type==='order-carry-ship-casket'?{patient:{...c.patient}}:{},progressCore:0,lastWorkedAt:w.tick};
 markHumanCarrierCandidatesDirty();
 p.path=intent.path;p.state=p.path.length?'moving':'working';p.planCooldown=0;return {ok:true};
}
/** Before drafting, on a real settled tick. Physiology continues until the
 * final transfer; the actual claim also suppresses recovered patient movement. */
export function processShipCasketTask277(w:World,p:Pawn,context:NeedContext):boolean {
 const t=p.shipCasketTask277;if(!t)return false;
 const cancel=(reason?:string)=>{releaseShipCasketTask277(w,p);if(reason)context.event(reason);};
 if(shipCasketContinuationReason277(w,p)){cancel();return false;}
 const box=get(w,t.casketId)!,o=t.action==='carry'?shipCasketSubject277(w,t.patient!):{kind:'human' as const,pawn:p};
 if(!o){cancel();return false;}const a=actor(o);
 const finishMedicine=()=>{if(o.kind==='human'&&o.pawn.health&&!o.pawn.health.death&&medicalCivilTick271(o.pawn.health)<w.tick)updatePawnHealth(w,o.pawn);else if(o.kind==='animal'&&o.animal.health&&!o.animal.health.death&&medicalCivilTick271(o.animal.health)<w.tick)advanceAnimalHealth(w,o.animal);};
 if(t.action==='carry'&&t.phase==='approach'){
  p.state='moving';if(p.x!==a.x||p.z!==a.z){context.move(a,true);return true;}
  if(p.moveCooldown>0||(p.motion?.end??0)>w.tick||(a.motion?.end??0)>w.tick)return true;
  finishMedicine();if(a.state!=='downed'||!shipCasketLiving277(o)){cancel();return false;}
  if(o.kind==='human'){
   const q=o.pawn,drops=planPawnDrops(w,new Set([q.id]));if(!drops||!releaseWork(w,q,drops)){cancel('Le patient ne peut pas déposer sa cargaison avant le portage.');return false;}
   clearQueuedOrders(w,q);delete q.priorityWork;delete q.medicalSleep;q.need=null;
  }
  a.path=[];t.phase='carry';p.path=[];p.planCooldown=0;syncShipCasketPassenger277(w,p);
  context.event(`${p.name} prend ${shipCasketOccupantLabel277(o)} pour le porter vers le caisson spatial.`);
 }
 const cell=shipCasketInteraction277(box,box.orientation),contact=p.x===cell.x&&p.z===cell.z&&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick;
 if(!contact){if(t.phase==='closing'){cancel();return false;}p.state='moving';context.move(cell,true);syncShipCasketPassenger277(w,p);return true;}
 if(t.action==='carry'){syncShipCasketPassenger277(w,p);finishMedicine();if(!shipCasketLiving277(o)){cancel();return false;}}
 p.path=[];p.state='working';const step=advanceShipCasketContact277(t,w.tick,true);
 if(step==='cancel'){cancel();return false;}if(step==='wait')return true;
 const plan=planShipCasketEntry277(w,box,o);if(!plan.ok){cancel(plan.reason);return false;}if(!plan.commit()){cancel();return false;}
 if(w.pawns.includes(p))releaseShipCasketTask277(w,p);
 context.event(`${shipCasketOccupantLabel277(o)} entre en cryptosommeil spatial.`);return true;
}
