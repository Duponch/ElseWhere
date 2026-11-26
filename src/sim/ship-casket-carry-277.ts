import type {ShipCasketPatient277,ShipCasketOccupant277} from './ship-casket-state-277.ts';
import {humanCarrierCandidates} from './rescue-state.ts';
import type {Pawn,World} from './types.ts';

export function shipCasketSubject277(w:World,p:ShipCasketPatient277):ShipCasketOccupant277|undefined {
 if(p.kind==='human'){const pawn=w.pawns.find(q=>q.id===p.id);return pawn?{kind:'human',pawn}:undefined;}
 if(p.kind==='animal'){const animal=w.wildlife?.animals.find(q=>q.id===p.id);return animal?{kind:'animal',animal}:undefined;}
 const mech=w.mechanoids?.find(q=>q.id===p.id);return mech?{kind:'mechanical',mech}:undefined;
}
export const shipCasketCarrying277=(p:Pawn):boolean=>p.shipCasketTask277?.action==='carry'&&(p.shipCasketTask277.phase==='carry'||p.shipCasketTask277.phase==='closing');
export const shipCasketPatientClaimed277=(w:World,patient:ShipCasketPatient277,except?:number):boolean=>humanCarrierCandidates(w.pawns).some(p=>p.id!==except&&(p.shipCasketTask277?.action==='carry'&&p.shipCasketTask277.patient?.kind===patient.kind&&p.shipCasketTask277.patient.id===patient.id||patient.kind==='human'&&p.id===patient.id&&p.shipCasketTask277?.action==='enter'));
export const shipCasketCarrierOf277=(w:World,patient:ShipCasketPatient277):Pawn|undefined=>humanCarrierCandidates(w.pawns).find(p=>shipCasketCarrying277(p)&&p.shipCasketTask277!.patient?.kind===patient.kind&&p.shipCasketTask277!.patient!.id===patient.id);
/** All three species retain their original physical edge. A recovered patient
 * stays claimed until commit or release; no position-only visual substitute. */
export function syncShipCasketPassenger277(w:World,carrier:Pawn):void {
 if(!shipCasketCarrying277(carrier))return;
 const ref=carrier.shipCasketTask277!.patient;if(!ref)return;
 const o=shipCasketSubject277(w,ref);if(!o)return;
 const actor=o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech;
 actor.x=carrier.x;actor.z=carrier.z;actor.path=[];
 if(carrier.motion){actor.motion=structuredClone(carrier.motion);delete actor.motion.snowEntryPending;}
 else if(o.kind==='human')o.pawn.motion=null;else delete actor.motion;
 if(o.kind==='human')o.pawn.moveCooldown=carrier.moveCooldown;
 else if(o.kind==='mechanical')o.mech.moveCooldown=carrier.moveCooldown;
}
export function releaseShipCasketCarry277(w:World,p:Pawn):void {
 if(!p.shipCasketTask277)return;
 const ref=p.shipCasketTask277.patient,carrying=shipCasketCarrying277(p);
 if(carrying)syncShipCasketPassenger277(w,p);
 delete p.shipCasketTask277;
 if(carrying&&ref){const o=shipCasketSubject277(w,ref);if(o?.kind==='human'){o.pawn.planCooldown=0;o.pawn.needCooldown=0;}else if(o?.kind==='animal')o.animal.nextDecision=w.tick;else if(o)o.mech.planCooldown=0;}
}
