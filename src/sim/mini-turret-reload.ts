import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import { allowedAreaAllows,allowedAreaReason,captureAllowedArea } from './allowed-area-state.ts';
import { deconstructionReserved } from './deconstruction-rules.ts';
import { haulReservations } from './haul-reservations.ts';
import { pawnBody,medicalWorkRefusal } from './health-rules.ts';
import { footprintContains } from './definitions.ts';
import {carryStackLimit379} from './carry-quantity-379.ts';
import { reservedSource } from './materials.ts';
import { candidateAccess } from './candidate-access.ts';
import { blockedCells,routeToJob } from './pathfinding.ts';
import { canReach } from './work-planner.ts';
import { workPriority } from './work-types.ts';
import type { Reachability } from './pathfinding.ts';
import type { HaulProposal } from './player-hauling.ts';
import type { Pawn,Structure,World } from './types.ts';

export const TURRET_RELOAD_WORK_TICKS=24;
export const reloadableTurret=(w:World,id:number):Structure|undefined=>w.structures.find(s=>s.id===id&&s.kind==='mini-turret'&&s.turret&&targetBuildingPlayerUse263(w,s));
/** The sole civil provider currently permitted while mobilized. */
export function draftTurretService(w:World,p:Pawn):boolean {
  return w.schemaVersion>=193&&(p.haul?.destination.type==='turret'
    ||p.orders.queue.some(o=>typeof o!=='number'&&'destination' in o&&o.destination.type==='turret')
    ||p.priorityWork?.work==='haul'&&w.structures.some(s=>s.kind==='mini-turret'&&s.x===p.priorityWork!.cell.x&&s.z===p.priorityWork!.cell.z));
}
export const turretReloadPawnReason=(p:Pawn):string|undefined=>backgroundWorkRefusal(p,'haul')??medicalWorkRefusal(p)??(pawnBody(p).capacities.manipulation<=0?'La manipulation est impossible.':undefined);
export function turretReloadReserved(w:World,id:number,exceptPawn?:number):boolean {
  return deconstructionReserved(w,id,exceptPawn)||haulReservations(w,exceptPawn).some(t=>t.destination.type==='turret'&&t.destination.structureId===id);
}
/** Whole steel units; a circuit outage or breakdown alone does not forbid carrying. */
export function turretReloadCapacity(w:World,id:number,exceptPawn?:number,forced=false):number {
  const s=reloadableTurret(w,id),gun=s?.turret;
  if(w.schemaVersion<193||!s||!gun||turretReloadReserved(w,id,exceptPawn))return 0;
  if(!forced&&(!gun.autoReload||s.power?.switchOn===false||w.jobs.some(j=>j.flick?.structureId===id&&j.flick.on===false)
    ||w.fires?.items.some(f=>f.attachedAnimalId===undefined&&f.attachedPawnId===undefined&&footprintContains(s,f))))return 0;
  const gap=240-gun.ammoQ;
  return gap<3?0:Math.ceil(gap/3);
}
export const wantsTurretReload=(w:World,s:Structure):boolean=>s.kind==='mini-turret'&&!!s.turret?.autoReload&&s.turret.ammoQ<=120&&turretReloadCapacity(w,s.id)>0;

/** One physical trip. Read-only planning shares the ordinary access search. */
export function planTurretReload(w:World,p:Pawn,id:number,access?:Reachability,budget={pairs:32768}):HaulProposal {
  const policy=captureAllowedArea(w,p);
  const label='Réarmer la mini-tourelle',no=(reason:string):HaulProposal=>({label,reason});
  const reason=turretReloadPawnReason(p);if(reason)return no(reason);
  if(!workPriority(p,'haul'))return no('Le transport est désactivé dans le tableau Travail.');
  const s=reloadableTurret(w,id);if(!s)return no('Mini-tourelle introuvable.');
  const areaReason=allowedAreaReason(w,p,s);if(areaReason)return no(areaReason);
  if(turretReloadReserved(w,id))return no('La mini-tourelle est déjà réservée ou marquée pour déconstruction.');
  const capacity=turretReloadCapacity(w,id,undefined,true);if(!capacity)return no('Le canon est déjà suffisamment plein.');
  const reach=access??candidateAccess(w,p,blockedCells(w),new Set());
  if(!canReach(w,s,reach,true))return no('Aucun contact praticable avec la mini-tourelle.');
  let best:{pileId:number;quantity:number;distance:number;path:NonNullable<ReturnType<typeof routeToJob>>}|undefined;
  for(const pile of w.piles){
    if(pile.item!=='steel'||pile.owner.type!=='ground'||policy&&!allowedAreaAllows(w,p,pile.owner,policy))continue;
    if(budget.pairs--<=0){budget.pairs=0;return no('Décision reportée : budget de recherche atteint.');}
    const quantity=Math.min(carryStackLimit379(w,p,pile.item),capacity,pile.quantity-reservedSource(w,pile.id));if(quantity<=0||!canReach(w,pile.owner,reach,true))continue;
    const distance=Math.abs(p.x-pile.owner.x)+Math.abs(p.z-pile.owner.z)+Math.abs(s.x-pile.owner.x)+Math.abs(s.z-pile.owner.z);
    if(best&&(distance>best.distance||distance===best.distance&&pile.id>=best.pileId))continue;
    const path=routeToJob(w,pile.owner,reach,true);if(path)best={pileId:pile.id,quantity,distance,path};
  }
  if(!best)return no('Aucun acier disponible et accessible.');
  return {label:`${label} (${best.quantity} aciers)`,path:best.path,task:{sourcePileId:best.pileId,quantity:best.quantity,phase:'pickup',carryPileId:null,destination:{type:'turret',structureId:id,forced:true}}};
}
