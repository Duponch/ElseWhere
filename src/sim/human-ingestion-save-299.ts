import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297,heldCore297} from './core-phase-297.ts';
import {worldPawnPhysicalCore297} from './world-pawn-physical-clock-297.ts';
import type {HumanOwnershipCapture,HumanOwnerSlot} from './human-owners.ts';
import type {World} from './types.ts';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
/** New fields are never read through accessors or inferred from historical absence. */
export function validHumanIngestionPawn299(value:unknown,version:number,ownerCore?:number):boolean {
 try{
  if(!record(value)||!Number.isSafeInteger(version)||version<1||version>300)return false;
  if('lastIngestAtCore299'in value){const d=Object.getOwnPropertyDescriptor(value,'lastIngestAtCore299');
   if(!isSchema299OrLater(version)||!d?.enumerable||!Object.hasOwn(d,'value')||!integer(ownerCore)||!integer(d.value,ownerCore))return false;
  }
  const need=Object.getOwnPropertyDescriptor(value,'need');
  if(need&&!Object.hasOwn(need,'value'))return false;
  if(need&&record(need.value)&&'foodBinge299'in need.value){const task=need.value,d=Object.getOwnPropertyDescriptor(task,'foodBinge299'),kind=Object.getOwnPropertyDescriptor(task,'kind');
   if(!isSchema299OrLater(version)||!d?.enumerable||!Object.hasOwn(d,'value')||d.value!==true||!kind?.enumerable||!Object.hasOwn(kind,'value')||kind.value!=='eat'||'forced'in task||'alcoholReason'in task)return false;
  }
  return true;
 }catch{return false;}
}
/** Already validated human owners retain their own frontiers. No root phase is
 * borrowed by an archive, away group, holder or registry row. This grants no
 * identity/owner/Native capability and never mutates the supplied state. */
export function validHumanIngestionOwners299(w:World,version:number,readOwners:()=>HumanOwnershipCapture):boolean {
 try{
  const slotCore=(slot:HumanOwnerSlot):number=>{
   if(slot.kind==='map')return effectiveCore297(w);
   if(slot.kind==='player-casket'||slot.kind==='ship-casket'){
    const id=slot.place.kind==='player-casket'||slot.place.kind==='ship-casket'?slot.place.casketId:NaN;
    const s=w.structures.find(s=>s.id===id);
    const h=slot.kind==='player-casket'?s?.cryptosleep:s?.shipCryptosleep277;
    return h?heldCore297(h,version,slot.validationTick):NaN;
   }
   return slot.validationTick*10;
  };
  for(const slot of readOwners().pawnOwners)if(!validHumanIngestionPawn299(slot.pawn,version,slotCore(slot)))return false;
  // Other projected groups are actual owners, not the selected map's Pawns.
  for(const row of (w.campaignMap?.revision===2?w.campaignMap.groups:[])){const g=row.state;if('members'in g)for(const p of g.members)if(!validHumanIngestionPawn299(p,version,g.lastPersonalTick*10))return false;}
  for(const loss of (w.campaignMap?.revision===2?w.campaignMap.groupLosses:[]))if(!validHumanIngestionPawn299(loss.pawn,version,loss.tick*10))return false;
  for(const row of w.worldPawns?.owners??[])if(row.kind==='human'&&!validHumanIngestionPawn299(row.actor,version,worldPawnPhysicalCore297(row,version)))return false;
  for(const row of w.worldFactions?.leaders??[])if(!validHumanIngestionPawn299(row.pawn,version,row.clock*10))return false;
  return true;
 }catch{return false;}
}
/** The resident path uses its original already-validated owner containers.
 * This narrow field pass never adds a full Pawn/clinical admission or owner
 * capture to MAIN. Every nonlocal frontier comes from that holder's metadata. */
export function validHumanIngestionProjection299(w:World,version:number):boolean {
 try{
  const check=(p:unknown,core:number)=>validHumanIngestionPawn299(p,version,core);
  const building=(s:Pick<World['structures'][number],'cryptosleep'|'shipCryptosleep277'|'casket'>):boolean=>{
   if(s.cryptosleep?.human&&!check(s.cryptosleep.human,heldCore297(s.cryptosleep,version,s.cryptosleep.heldAt)))return false;
   if(s.shipCryptosleep277?.occupant?.kind==='human'&&!check(s.shipCryptosleep277.occupant.pawn,heldCore297(s.shipCryptosleep277,version,s.shipCryptosleep277.heldAt)))return false;
   if(s.casket)for(const p of s.casket.humans)if(!check(p,s.casket.heldAt*10))return false;
   return true;
  };
  const group=(g:NonNullable<World['group']>):boolean=>!('members'in g)||g.members.every(p=>check(p,g.lastPersonalTick*10));
  for(const p of w.pawns)if(!check(p,effectiveCore297(w)))return false;
  for(const s of w.structures)if(!building(s))return false;
  for(const p of w.packed)if(!building(p.building))return false;
  if(w.startingArrival&&w.startingArrival.phase!=='opened')for(const p of w.startingArrival.pods)if(!check(p.pawn,0))return false;
  if(w.scout&&'pawn'in w.scout&&!check(w.scout.pawn,w.tick*10))return false;
  if(w.commercialTrip&&'pawn'in w.commercialTrip&&!check(w.commercialTrip.pawn,w.tick*10))return false;
  if(w.group&&!group(w.group))return false;
  for(const l of w.groupLosses??[])if(!check(l.pawn,l.tick*10))return false;
  for(const d of w.visitors?.departed??[])if(!check(d.pawn,d.tick*10))return false;
  for(const d of w.podRescues?.departed??[])if(!check(d.pawn,d.tick*10))return false;
  for(const row of (w.campaignMap?.revision===2?w.campaignMap.groups:[]))if(!group(row.state))return false;
  for(const l of (w.campaignMap?.revision===2?w.campaignMap.groupLosses:[]))if(!check(l.pawn,l.tick*10))return false;
  for(const row of w.worldPawns?.owners??[])if(row.kind==='human'&&!check(row.actor,worldPawnPhysicalCore297(row,version)))return false;
  for(const h of w.worldPawns?.heldCaskets259??[])if(!building(h.casket))return false;
  for(const h of w.worldPawns?.heldPlayerCaskets271??[])if(!building(h.casket))return false;
  for(const h of w.worldPawns?.heldShipCaskets277??[])if(!building(h.casket))return false;
  for(const l of w.worldFactions?.leaders??[])if(!check(l.pawn,l.clock*10))return false;
  return true;
 }catch{return false;}
}
