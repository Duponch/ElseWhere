import {shipCasketCarrierOf277,syncShipCasketPassenger277} from './ship-casket-carry-277.ts';
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
export const animalClaimed=(w:World,id:number,exceptPawn?:number):boolean=>w.pawns.some(p=>p.id!==exceptPawn&&animalServiceIds(p).includes(id))||w.schemaVersion>=256&&groupAnimalClaimed256(w,id,exceptPawn);
export const animalCarrier=(w:World,id:number):Pawn|undefined=>shipCasketCarrierOf277(w,{kind:'animal',id})??w.pawns.find(p=>p.animalRescue?.animalId===id&&p.animalRescue.phase==='carry')??(w.schemaVersion>=256?groupAnimalCarrier256(w,id):undefined);
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
