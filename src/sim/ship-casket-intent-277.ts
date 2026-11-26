import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {orderedTargetClaimed378} from './order-types.ts';
import {isShipCasket277,type ShipCasket277,type ShipCasketCommand277,type ShipCasketPatient277,type ShipCasketOccupant277} from './ship-casket-state-277.ts';
import {shipCasketInteraction277} from './ship-casket-geometry-277.ts';
import {shipCasketSubject277,shipCasketPatientClaimed277,shipCasketCarrierOf277} from './ship-casket-carry-277.ts';
import {isColonist} from './affiliation.ts';
import {medicalWorkRefusal,pawnBody} from './health-rules.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
import {carrierOf,rescueClaim} from './rescue-state.ts';
import {patientClaimed} from './care-access.ts';
import {animalCarrier,animalClaimed} from './animal-rest-state.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {deconstructionReserved} from './deconstruction-rules.ts';
import {cryptosleepTravelRefusal271} from './cryptosleep-intent-271.ts';
import {blockedCells,reachableCells,routeToCell,canStopAt} from './pathfinding.ts';
import type {Cell,Pawn,World} from './types.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const own=(o:Record<string,unknown>,keys:readonly string[])=>Reflect.ownKeys(o).length===keys.length&&Reflect.ownKeys(o).every(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return typeof k==='string'&&keys.includes(k)&&d?.enumerable===true&&Object.hasOwn(d,'value');});
const id=(v:unknown,next:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<next;
export function validShipCasketPatient277(v:unknown,next:number):v is ShipCasketPatient277 {return plain(v)&&own(v,['kind','id'])&&['human','animal','mechanical'].includes(String(v.kind))&&id(v.id,next);}
export function validShipCasketCommand277(v:unknown,version:number,next:number):v is ShipCasketCommand277 {
 if(!isSchema277OrLater(version)||!plain(v))return false;
 if(v.type==='eject-ship-casket')return own(v,['type','casketId'])&&id(v.casketId,next);
 if(v.type==='order-enter-ship-casket')return own(v,['type','pawnId','casketId'])&&id(v.pawnId,next)&&id(v.casketId,next);
 return v.type==='order-carry-ship-casket'&&own(v,['type','pawnId','patient','casketId'])&&id(v.pawnId,next)&&id(v.casketId,next)&&validShipCasketPatient277(v.patient,next);
}
export const shipCasketActorCapable277=(w:World,p:Pawn,carrying=false):boolean=>isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&!p.mental?.crisis&&!p.burning&&!p.flee&&!p.bombRefuge&&!p.heatRefuge&&!p.collapsePending
 &&!(p.stun&&p.stun.untilCore>w.tick*10)&&pawnBody(p).canBeAwake&&(!carrying||!medicalWorkRefusal(p))&&!(w.restRules==='legacy'&&p.rest===0)&&!carrierOf(w,p.id);
export const shipCasketClaim277=(w:World,id:number,except?:number):boolean=>w.pawns.some(p=>p.id!==except&&p.shipCasketTask277?.casketId===id);
export const shipCasketLiving277=(o:ShipCasketOccupant277):boolean=>{const a=o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech;return a.state!=='dead'&&!a.health?.death&&a.shipCryptosleepHeldAt277===undefined;};
export function shipCasketPatientReason277(w:World,ref:ShipCasketPatient277,actor:Pawn,carrying=false):string|undefined {
 const o=shipCasketSubject277(w,ref);if(!o||!shipCasketLiving277(o))return 'Le véritable patient vivant est introuvable.';
 const a=o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech;
 if(a===actor||!carrying&&a.state!=='downed')return 'Le patient doit être à terre au début du portage.';
 if(shipCasketPatientClaimed277(w,ref,actor.id))return 'Un autre caisson possède déjà ce patient.';
 const actual=shipCasketCarrierOf277(w,ref);if(actual&&(!carrying||actual!==actor))return 'Un autre porteur possède ce patient.';
 if(o.kind==='human'){
  if(o.pawn.mental?.crisis?.kind==='berserk'||o.pawn.social?.fight)return 'Le patient est dans un état mental agressif.';
  const travel=cryptosleepTravelRefusal271(w,o.pawn);if(travel)return travel;
  const carrier=carrierOf(w,o.pawn.id);if(carrier&&(carrier!==actor||!carrying)||rescueClaim(w,o.pawn.id,actor.id)||patientClaimed(w,o.pawn.id,actor))return 'Un autre service possède ce patient.';
 }else if(o.kind==='animal'){
  if(o.animal.manhunter)return 'Cet animal est dans un état mental agressif.';
  const carrier=animalCarrier(w,o.animal.id);if(carrier&&(carrier!==actor||!carrying)||animalClaimed(w,o.animal.id,actor.id))return 'Un autre service possède cet animal.';
 }
 return;
}
export type ShipCasketIntent277={ok:false;reason:string}|{ok:true;pawn:Pawn;casket:ShipCasket277;patient?:ShipCasketOccupant277;path:Cell[]};
export function shipCasketIntent277(w:World,c:Exclude<ShipCasketCommand277,{type:'eject-ship-casket'}>):ShipCasketIntent277 {
 const fail=(reason:string):ShipCasketIntent277=>({ok:false,reason});
 if(!validShipCasketCommand277(c,w.schemaVersion,w.nextId))return fail('Ordre de caisson spatial invalide ; il ne se met pas en file.');
 const p=w.pawns.find(q=>q.id===c.pawnId),box=w.structures.find((s):s is ShipCasket277=>s.id===c.casketId&&isShipCasket277(s));
 if(!p||!shipCasketActorCapable277(w,p,c.type==='order-carry-ship-casket'))return fail('Un colon contrôlable et capable est requis.');
 if(!box?.shipCryptosleep277||box.shipCryptosleep277.occupant)return fail('Un véritable caisson spatial vide est requis.');
 const trip=cryptosleepTravelRefusal271(w,p);if(trip)return fail(trip);
 if(shipCasketClaim277(w,box.id,p.id)||deconstructionReserved(w,box.id,p.id)||orderedTargetClaimed378(w,'structure',box.id,p.id))return fail('Ce caisson est déjà réservé.');
 const cell=shipCasketInteraction277(box,box.orientation),area=allowedAreaReason(w,p,cell);if(area)return fail(area);
 const reserved=reservedServiceCells(w,p.id);if(reserved.has(cell.z*w.width+cell.x))return fail('La case du caisson est déjà réservée.');
 const reach=reachableCells(w,p,blockedCells(w),reserved),path=canStopAt(w,cell,reach)?routeToCell(w,cell,reach):null;
 if(path===null)return fail('La vraie cellule d’interaction est inaccessible.');
 if(c.type==='order-carry-ship-casket'){
  const reason=shipCasketPatientReason277(w,c.patient,p);if(reason)return fail(reason);
  const patient=shipCasketSubject277(w,c.patient)!,a=patient.kind==='human'?patient.pawn:patient.kind==='animal'?patient.animal:patient.mech;
  const area=allowedAreaReason(w,p,a);if(area)return fail(area);
  const pickup=canStopAt(w,a,reach)?routeToCell(w,a,reach):null;if(pickup===null)return fail('Le patient est inaccessible.');
  return {ok:true,pawn:p,casket:box,patient,path:pickup};
 }
 if(patientClaimed(w,p.id,p))return fail('Ce colon est réservé par un autre service.');
 return {ok:true,pawn:p,casket:box,path};
}
