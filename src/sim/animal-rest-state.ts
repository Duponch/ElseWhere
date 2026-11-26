import {syncShipCasketPassenger277} from './ship-casket-carry-277.ts';
import {groupAnimalClaimed256,groupAnimalCarrier256,syncGroupCarriedAnimals256,syncAllGroupCarriedAnimals256} from './group-animal-formation-256.ts';
import {orderedTargetClaimed378} from './order-types.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import {animalById379} from './animal-identity-directory-379.ts';
import {animalServiceDecisionCandidates379} from './source-reservation-candidates-379.ts';
import type { Pawn,World } from './types.ts';

export interface AnimalRescueTask {animalId:number;spotId:number;phase:'approach'|'carry';forced?:true}
export interface AnimalRestTask {spotId:number;phase:'travel'|'sleep'}

/** Pure ownership queries shared by runtime and transport guards. */
export function animalServiceIds(p:Pawn):readonly number[] {
  const h=p.animalHandling;
  return [...(h?h.kind==='lead'?[h.animalId,...(h.ropees??[]),...(h.gatherId===undefined?[]:[h.gatherId])]:[h.animalId]:[]),
    ...(p.animalCare?[p.animalCare.animalId]:[]),...(p.animalFeed?[p.animalFeed.animalId]:[]),...(p.animalRescue?[p.animalRescue.animalId]:[]),...(p.shipCasketTask277?.action==='carry'&&p.shipCasketTask277.patient?.kind==='animal'?[p.shipCasketTask277.patient.id]:[])];
}
/** Same as `animalServiceIds(p).includes(id)` (SameValueZero), without
 * building the list: animalClaimed runs for every domestic animal and pawn. */
const sameServiceId=(value:number|undefined,id:number)=>value===id||value!==value&&id!==id;
export function pawnServesAnimal(p:Pawn,id:number):boolean {
  const h=p.animalHandling;
  if(h){
    if(sameServiceId(h.animalId,id))return true;
    if(h.kind==='lead'&&(!!h.ropees?.includes(id)||h.gatherId!==undefined&&sameServiceId(h.gatherId,id)))return true;
  }
  if(p.animalCare&&sameServiceId(p.animalCare.animalId,id)||p.animalFeed&&sameServiceId(p.animalFeed.animalId,id)||p.animalRescue&&sameServiceId(p.animalRescue.animalId,id))return true;
  const casket=p.shipCasketTask277;
  return casket?.action==='carry'&&casket.patient?.kind==='animal'&&sameServiceId(casket.patient.id,id);
}
function animalClaimedFrom(w:World,id:number,exceptPawn?:number,pawns:readonly Pawn[]=w.pawns):boolean {
  for(const p of pawns)if(p.id!==exceptPawn&&(pawnServesAnimal(p,id)||Number(w.schemaVersion)>=378&&p.hunting?.animalId===id))return true;
  if(Number(w.schemaVersion)>=378&&orderedTargetClaimed378(w,'animal',id,exceptPawn))return true;
  return w.schemaVersion>=256&&groupAnimalClaimed256(w,id,exceptPawn);
}
export function animalClaimed(w:World,id:number,exceptPawn?:number):boolean {
  const candidates=animalServiceDecisionCandidates379(w);
  const result=animalClaimedFrom(w,id,exceptPawn,candidates);
  if(candidates&&verifyTerrainWriteCaches&&result!==animalClaimedFrom(w,id,exceptPawn))throw Error('Animal claim differs from live decision roster');
  return result;
}
/** By precedence: a ship casket carrier, then an animal rescuer carrying it,
 * then a caravan group handler; the first in pawn order within each. One pass
 * over the pawns for the first two (the same result as one search per kind). */
export function animalCarrier(w:World,id:number):Pawn|undefined {
  const candidates=animalServiceDecisionCandidates379(w),result=animalCarrierFrom(w,id,candidates);
  if(candidates&&verifyTerrainWriteCaches&&result!==animalCarrierFrom(w,id))throw Error('Animal carrier differs from live decision roster');return result;
}
function animalCarrierFrom(w:World,id:number,pawns:readonly Pawn[]=w.pawns):Pawn|undefined {
  let rescuer:Pawn|undefined;
  for(const p of pawns){
    const c=p.shipCasketTask277;
    if(c&&c.action==='carry'&&(c.phase==='carry'||c.phase==='closing')&&c.patient?.kind==='animal'&&c.patient.id===id)return p;
    const r=p.animalRescue;
    if(!rescuer&&r&&r.animalId===id&&r.phase==='carry')rescuer=p;
    // Schema 364: a handler carrying an animal out to release it.
    const h=p.animalHandling;
    if(!rescuer&&h&&h.kind==='release'&&h.phase==='carry'&&h.animalId===id)rescuer=p;
  }
  return rescuer??(w.schemaVersion>=256?groupAnimalCarrier256(w,id):undefined);
}
/** Only for one synchronous wildlife decision pass: it may interrupt human
 * services, but cannot start a human rescue, release or casket task. Keep the
 * possible owners in pawn order, and read their actual tasks on every call so
 * a carrier falling, dying or releasing its patient is visible immediately.
 * Caravan gathering/cancellation stays live through groupAnimalCarrier256.
 * Never retain this reader across a command or a human decision pass. */
export function createWildlifeAnimalCarrierReader(w:World):(id:number)=>Pawn|undefined {
  const candidates=w.pawns.filter(p=>p.shipCasketTask277||p.animalRescue||p.animalHandling);
  return id=>animalCarrierFrom(w,id,candidates);
}
/** Human services can be cancelled during autonomous animal decisions, but
 * only a human decision/command can add one. Capture possible owners, never
 * their task, phase, target or position. Group claims remain live. */
export function createWildlifeAnimalServicesReader(w:World) {
  const candidates=w.pawns.filter(p=>p.animalHandling||p.animalCare||p.animalFeed||p.animalRescue||p.shipCasketTask277);
  return {
    carrier:(id:number)=>animalCarrierFrom(w,id,candidates),
    humanService:(id:number)=>candidates.some(p=>pawnServesAnimal(p,id)),
    carriedOrClaimed:(id:number)=>animalCarriedOrClaimedFrom(w,id,candidates),
  };
}
/** Only a wildlife or animal-rest reconciliation pass may use this reader:
 * these phases can release human services, but never create or retarget one.
 * Candidate identities are indexed once; task/phase/position and all caravan
 * conditions stay live. Public calls keep the original candidate scans. */
export function createAnimalServiceReadPass379(w:World) {
  const owned=terrainJournalReadOwner()!==undefined;
  const allClaims=Number(w.schemaVersion)>=378,services:Pawn[]=[],carriers:Pawn[]=[],claims:Pawn[]=[];
  let byAnimal:Map<number,Pawn[]>|undefined;
  // One pass over the human principals, then a single per-animal directory.
  // Carrier/claim/service answers read live roots with their own predicates;
  // three separately allocated maps carried no additional authority.
  for(const p of w.pawns){const service=!!(p.animalHandling||p.animalCare||p.animalFeed||p.animalRescue||p.shipCasketTask277);
   if(service){services.push(p);if(p.shipCasketTask277||p.animalRescue||p.animalHandling?.kind==='release')carriers.push(p);}
   if(!service&&!(allClaims&&p.hunting))continue;claims.push(p);
   if(owned){const ids=new Set(animalServiceIds(p));if(allClaims&&p.hunting)ids.add(p.hunting.animalId);
    for(const id of ids){byAnimal??=new Map();const list=byAnimal.get(id);if(list)list.push(p);else byAnimal.set(id,[p]);}}
  }
  const empty:readonly Pawn[]=[],candidates=(id:number,fallback:readonly Pawn[])=>owned?byAnimal?.get(id)??empty:fallback;
  const carrier=(id:number)=>{
    const result=animalCarrierFrom(w,id,candidates(id,carriers));
    if(owned&&verifyTerrainWriteCaches&&result!==animalCarrierFrom(w,id))throw Error('Animal carrier changed outside its closed decision phase');return result;
  };
  const humanService=(id:number)=>{
    const result=candidates(id,services).some(p=>pawnServesAnimal(p,id));
    if(owned&&verifyTerrainWriteCaches&&result!==w.pawns.some(p=>pawnServesAnimal(p,id)))throw Error('Animal service changed outside its closed decision phase');return result;
  };
  const carriedOrClaimed=(id:number)=>{
    const result=animalCarriedOrClaimedFrom(w,id,candidates(id,services));
    if(owned&&verifyTerrainWriteCaches&&result!==animalCarriedOrClaimedFrom(w,id,w.pawns))throw Error('Animal service claim changed outside its closed decision phase');return result;
  };
  const claimed=(id:number,exceptPawn?:number)=>{
    const result=animalClaimedFrom(w,id,exceptPawn,candidates(id,claims));
    if(owned&&verifyTerrainWriteCaches&&result!==animalClaimedFrom(w,id,exceptPawn))throw Error('Animal reservation changed outside its closed reconciliation phase');return result;
  };
  return {carrier,humanService,carriedOrClaimed,claimed};
}
/** `!!animalCarrier(w,id)||animalClaimed(w,id)` with one pass over the pawns:
 * a pawn that carries the animal (ship casket carry, rescue carry) also serves
 * it, so the pawn part of animalCarrier adds nothing to the claim test. */
export function animalCarriedOrClaimed(w:World,id:number):boolean {
  const candidates=animalServiceDecisionCandidates379(w),result=animalCarriedOrClaimedFrom(w,id,candidates??w.pawns);
  if(candidates&&verifyTerrainWriteCaches&&result!==animalCarriedOrClaimedFrom(w,id,w.pawns))throw Error('Animal service differs from live decision roster');return result;
}
function animalCarriedOrClaimedFrom(w:World,id:number,pawns:readonly Pawn[]):boolean {
  for(const p of pawns)if(pawnServesAnimal(p,id))return true;
  return w.schemaVersion>=256&&(!!groupAnimalCarrier256(w,id)||groupAnimalClaimed256(w,id));
}
export function animalSpotClaimed(w:World,id:number,exceptAnimal?:number,exceptPawn?:number):boolean {
  return w.pawns.some(p=>p.id!==exceptPawn&&p.animalRescue?.spotId===id&&p.animalRescue.animalId!==exceptAnimal)
    ||!!w.wildlife?.animals.some(a=>a.id!==exceptAnimal&&a.animalRest?.spotId===id);
}
export function syncCarriedAnimals(w:World,carrier?:Pawn):void {
  if(w.schemaVersion>=256){if(carrier)syncGroupCarriedAnimals256(w,carrier);else syncAllGroupCarriedAnimals256(w);}
  for(const p of carrier?[carrier]:w.pawns){
    syncShipCasketPassenger277(w,p);
    const carried=p.animalRescue?.phase==='carry'?p.animalRescue.animalId:p.animalHandling?.kind==='release'&&p.animalHandling.phase==='carry'?p.animalHandling.animalId:undefined;
    if(carried===undefined)continue;
    const a=animalById379(w,carried);if(!a)continue;
    a.x=p.x;a.z=p.z;a.path=[];
    if(p.motion)a.motion={...p.motion,from:{...p.motion.from},to:{...p.motion.to},
      ...(p.motion.stagger?{stagger:p.motion.stagger.map(s=>({...s}))}:{}),...(p.motion.stuns?{stuns:p.motion.stuns.map(s=>({...s}))}:{})};
    else delete a.motion;
    if(a.motion)delete a.motion.snowEntryPending;
  }
}
/** The patient keeps the captured edge, even when its carrier falls or dies. */
export function releaseAnimalRescue(w:World,p:Pawn):void {
  const t=p.animalRescue;if(!t)return;
  syncCarriedAnimals(w,p);delete p.animalRescue;p.path=[];p.planCooldown=0;
  if(p.state!=='dead'&&p.state!=='downed')p.state='idle';
  const a=animalById379(w,t.animalId);if(a&&t.phase==='carry'){a.path=[];a.nextDecision=w.tick;}
}
