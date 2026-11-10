import {syncShipCasketPassenger277} from './ship-casket-carry-277.ts';
import {groupAnimalClaimed256,groupAnimalCarrier256,syncGroupCarriedAnimals256,syncAllGroupCarriedAnimals256} from './group-animal-formation-256.ts';
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
export const animalClaimed=(w:World,id:number,exceptPawn?:number):boolean=>{
  for(const p of w.pawns)if(p.id!==exceptPawn&&pawnServesAnimal(p,id))return true;
  return w.schemaVersion>=256&&groupAnimalClaimed256(w,id,exceptPawn);
};
/** By precedence: a ship casket carrier, then an animal rescuer carrying it,
 * then a caravan group handler; the first in pawn order within each. One pass
 * over the pawns for the first two (the same result as one search per kind). */
export const animalCarrier=(w:World,id:number):Pawn|undefined=>{
  let rescuer:Pawn|undefined;
  for(const p of w.pawns){
    const c=p.shipCasketTask277;
    if(c&&c.action==='carry'&&(c.phase==='carry'||c.phase==='closing')&&c.patient?.kind==='animal'&&c.patient.id===id)return p;
    const r=p.animalRescue;
    if(!rescuer&&r&&r.animalId===id&&r.phase==='carry')rescuer=p;
  }
  return rescuer??(w.schemaVersion>=256?groupAnimalCarrier256(w,id):undefined);
};
/** `!!animalCarrier(w,id)||animalClaimed(w,id)` with one pass over the pawns:
 * a pawn that carries the animal (ship casket carry, rescue carry) also serves
 * it, so the pawn part of animalCarrier adds nothing to the claim test. */
export function animalCarriedOrClaimed(w:World,id:number):boolean {
  for(const p of w.pawns)if(pawnServesAnimal(p,id))return true;
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
    if(p.animalRescue?.phase!=='carry')continue;
    const a=w.wildlife?.animals.find(a=>a.id===p.animalRescue!.animalId);if(!a)continue;
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
  const a=w.wildlife?.animals.find(a=>a.id===t.animalId);if(a&&t.phase==='carry'){a.path=[];a.nextDecision=w.tick;}
}
