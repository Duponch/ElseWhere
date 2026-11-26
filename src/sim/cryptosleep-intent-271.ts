import {isShipCasket277} from './ship-casket-state-277.ts';
import {isSchema271OrLater,isSchema277OrLater} from './schema-compatibility-257.ts';
import {isPlayerCasket271,cryptosleepInteraction271,type PlayerCasket271,type CryptosleepCommand271} from './cryptosleep-state-271.ts';
import {isColonist} from './affiliation.ts';
import {biologicalYears} from './human-age.ts';
import {medicalWorkRefusal} from './health-rules.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
import {carrierOf,rescueClaim} from './rescue-state.ts';
import {patientClaimed} from './care-access.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {orderedTargetClaimed378} from './order-types.ts';
import {deconstructionReserved} from './deconstruction-rules.ts';
import {groupOnMapMember} from './group-state.ts';
import {scoutOnMapId} from './caravan-trip.ts';
import {commercialOnMapId} from './commercial-trip.ts';
import {blockedCells,reachableCells,routeToCell,canStopAt} from './pathfinding.ts';
import type {Cell,Pawn,World} from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export function validCryptosleepCommand271(value:unknown,version:number,nextId:number):value is CryptosleepCommand271 {
 if(!isSchema271OrLater(version)||!record(value))return false;
 if(!Reflect.ownKeys(value).every(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return typeof k==='string'&&d?.enumerable===true&&Object.hasOwn(d,'value');}))return false;
 const carry=value.type==='order-carry-cryptosleep',enter=value.type==='order-enter-cryptosleep',keys=carry?['type','pawnId','patientId','casketId']:['type','pawnId','casketId',...(enter&&Object.hasOwn(value,'confirmLastColonist')?['confirmLastColonist']:[])];
 if(!['order-enter-cryptosleep','order-carry-cryptosleep','order-open-cryptosleep'].includes(String(value.type))||Reflect.ownKeys(value).length!==keys.length)return false;
 return Reflect.ownKeys(value).every(k=>typeof k==='string'&&keys.includes(k)&&Object.getOwnPropertyDescriptor(value,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,k)!,'value'))
  &&(!Object.hasOwn(value,'confirmLastColonist')||enter&&value.confirmLastColonist===true)&&['pawnId','casketId',...carry?['patientId']:[]].every(k=>Number.isSafeInteger(value[k])&&Number(value[k])>0&&Number(value[k])<nextId);
}
/** Explicit initial scope; other native owners remain named refusals. */
export const cryptosleepHuman271=(p:Pawn):boolean=>isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&(!p.age||biologicalYears(p.age)>=18)&&p.state!=='dead'&&!p.health?.death;
export const cryptosleepActorCapable271=(w:World,p:Pawn):boolean=>cryptosleepHuman271(p)&&!p.draft&&!p.mental?.crisis&&!p.burning&&!p.flee&&!p.bombRefuge&&!p.heatRefuge&&!p.collapsePending
 &&!(p.stun&&p.stun.untilCore>w.tick*10)&&!medicalWorkRefusal(p)&&!(w.restRules==='legacy'&&p.rest===0)&&!carrierOf(w,p.id);
// Core's spawned free-colonist counter includes a living downed person.
export const cryptosleepLastColonist271=(w:World,pawnId:number):boolean=>!w.pawns.some(q=>q.id!==pawnId&&isColonist(q)&&!q.prisoner&&!q.visitor&&!q.raid&&!q.podRescue&&q.state!=='dead'&&!q.health?.death)&&!(isSchema277OrLater(w.schemaVersion)&&w.structures.some(s=>isShipCasket277(s)&&s.shipCryptosleep277.occupant?.kind==='human'&&s.shipCryptosleep277.occupant.pawn.id!==pawnId&&isColonist(s.shipCryptosleep277.occupant.pawn)&&!s.shipCryptosleep277.occupant.pawn.prisoner&&!s.shipCryptosleep277.occupant.pawn.visitor&&!s.shipCryptosleep277.occupant.pawn.raid&&!s.shipCryptosleep277.occupant.pawn.podRescue&&s.shipCryptosleep277.occupant.pawn.state!=='dead'&&!s.shipCryptosleep277.occupant.pawn.health?.death));
export const cryptosleepClaim271=(w:World,id:number,except?:number):boolean=>w.pawns.some(p=>p.id!==except&&p.cryptosleepTask?.casketId===id);
export function cryptosleepTravelRefusal271(w:World,p:Pawn):string|undefined {
 if(groupOnMapMember(w,p.id))return 'Terminez ou annulez la préparation de caravane avant cet ordre.';
 if(p.id===scoutOnMapId(w)||p.id===commercialOnMapId(w))return 'Terminez ou annulez le voyage et son déchargement avant cet ordre.';
}
export type CryptosleepIntent271={ok:false;reason:string}|{ok:true;pawn:Pawn;casket:PlayerCasket271;patient?:Pawn;path:Cell[]};
/** Read-only menu/command admission. No task, resource, clinical change or draw. */
export function cryptosleepIntent271(w:World,c:CryptosleepCommand271):CryptosleepIntent271 {
 const fail=(reason:string):CryptosleepIntent271=>({ok:false,reason});
 if(!validCryptosleepCommand271(c,w.schemaVersion,w.nextId))return fail('Ordre de cryptosommeil invalide ; cet ordre ne se met pas en file.');
 const pawn=w.pawns.find(p=>p.id===c.pawnId),casket=w.structures.find((s):s is PlayerCasket271=>s.id===c.casketId&&isPlayerCasket271(s));
 if(!pawn||!cryptosleepActorCapable271(w,pawn))return fail('Un colon adulte libre, capable et non mobilisé est requis.');
 if(!casket||!casket.cryptosleep)return fail('Caisson de cryptosommeil de colonie introuvable.');
 const travel=cryptosleepTravelRefusal271(w,pawn);if(travel)return fail(travel);
 if(cryptosleepClaim271(w,casket.id,pawn.id)||deconstructionReserved(w,casket.id,pawn.id)||orderedTargetClaimed378(w,'structure',casket.id,pawn.id))return fail('Ce caisson est déjà réservé.');
 if(c.type==='order-enter-cryptosleep'&&cryptosleepLastColonist271(w,pawn.id)&&c.confirmLastColonist!==true)return fail('Confirmez l’entrée du dernier colon libre : ce caisson exige une autre personne pour être ouvert.');
 const opening=c.type==='order-open-cryptosleep';
 if(opening?!casket.cryptosleep.human:!!casket.cryptosleep.human)return fail(opening?'Ce caisson est vide.':'Ce caisson est occupé.');
 const cell=cryptosleepInteraction271(casket),reason=allowedAreaReason(w,pawn,cell);if(reason)return fail(reason);
 const reserved=reservedServiceCells(w,pawn.id);if(reserved.has(cell.z*w.width+cell.x))return fail('La case d’interaction est déjà réservée.');
 const reach=reachableCells(w,pawn,blockedCells(w),reserved);
 if(!canStopAt(w,cell,reach)||routeToCell(w,cell,reach)===null)return fail('La vraie case d’interaction est inaccessible.');
 if(c.type==='order-carry-cryptosleep'){
  const patient=w.pawns.find(p=>p.id===c.patientId);
  if(!patient||patient===pawn||!cryptosleepHuman271(patient)||patient.state!=='downed')return fail('Choisissez un colon adulte libre, vivant et à terre.');
  const trip=cryptosleepTravelRefusal271(w,patient);if(trip)return fail(trip);
  const area=allowedAreaReason(w,pawn,patient);if(area)return fail(area);
  if(carrierOf(w,patient.id)||rescueClaim(w,patient.id,pawn.id)||patientClaimed(w,patient.id,pawn))return fail('Ce patient est déjà porté ou réservé par un autre service.');
  const path=canStopAt(w,patient,reach)?routeToCell(w,patient,reach):null;if(path===null)return fail('Le patient est inaccessible.');
  return {ok:true,pawn,casket,patient,path};
 }
 if(c.type==='order-enter-cryptosleep'&&patientClaimed(w,pawn.id,pawn))return fail('Ce colon est réservé par un autre service.');
 return {ok:true,pawn,casket,path:routeToCell(w,cell,reach)!};
}
