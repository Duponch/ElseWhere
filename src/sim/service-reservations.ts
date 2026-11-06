import {factionCommsTask298} from './faction-comms-state-298.ts';
import {firefoamManualServiceCell290} from './firefoam-manual-290.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import {shipCasketInteraction277} from './ship-casket-geometry-277.ts';
import {isPlayerCasket271,cryptosleepInteraction271} from './cryptosleep-state-271.ts';
import {isAncientCasket256,ancientCasketInteraction256} from './ancient-casket-state-256.ts';
import { isCookingOrder } from './order-types.ts';
import { urgentTreatment } from './care-rules.ts';
import { bedSlotCell } from './bed-slots.ts';
import type { Cell, Pawn, World } from './types.ts';
import { structureById } from './structure-navigation.ts';

/** Exclusive use of a workstation, dining place or bed. This is not physical
 * occupancy: a passer-by can cross any of these cells without claiming its use.
 * Sleeping/collapsing on the floor does not acquire furniture or a work spot. */
export function serviceCell(pawn: Pawn,world?:Pick<World,'structures'>): Cell | null {
  if(pawn.coupleTask285&&world){const bed=world.structures.find(s=>s.id===pawn.coupleTask285!.bedId&&s.kind==='double-bed');if(bed)return bedSlotCell(bed,pawn.coupleTask285.slot)??null;}
  if(pawn.shipCasketTask277&&world){const c=structureById(world,pawn.shipCasketTask277!.casketId);if(c&&isShipCasket277(c))return shipCasketInteraction277(c,c.orientation);}
  if(pawn.cryptosleepTask&&world){const c=structureById(world,pawn.cryptosleepTask!.casketId);if(c&&isPlayerCasket271(c))return cryptosleepInteraction271(c);}
  if(pawn.firefoamTask290&&world)return firefoamManualServiceCell290(pawn,world);
  if(pawn.openCasket&&world){const c=structureById(world,pawn.openCasket!.casketId);if(c&&isAncientCasket256(c))return ancientCasketInteraction256(c);}
  if(pawn.need?.kind==='eat'&&pawn.need.paste&&(pawn.need.phase==='pickup'||pawn.need.phase==='collect'))return pawn.need.paste.spot;
  if(pawn.feed?.paste&&(pawn.feed.phase==='pickup'||pawn.feed.phase==='collect'))return pawn.feed.paste.spot;
  const comms298=factionCommsTask298(pawn);if(comms298)return comms298.spot;
  if(pawn.orbitalTrade)return pawn.orbitalTrade.spot;
  if(pawn.brewing)return pawn.brewing.spot;
  if(pawn.deepWork)return pawn.deepWork.spot;
  if(pawn.surgery)return pawn.surgery.spot;
  if(pawn.animalCare)return pawn.animalCare.spot;
  if(pawn.animalFeed)return pawn.animalFeed.spot;
  if(pawn.ward)return pawn.ward.spot;
  if(pawn.research)return pawn.research.spot;
  if(pawn.feed)return pawn.feed.spot;
  if(pawn.tend)return pawn.tend.spot;
  if(pawn.recreation?.task?.activity==='read'&&pawn.recreation.task.phase==='active'&&pawn.recreation.task.stage!=='read')return null;
  if (pawn.recreation?.task && pawn.recreation.task.activity !== 'skygaze') return pawn.recreation.task.target;
  if (pawn.cooking) return pawn.cooking.spot;
  if (pawn.need?.kind === 'eat') return pawn.need.dining?.target ?? null;
  if (pawn.need?.kind === 'sleep' && pawn.need.bedId !== null) return pawn.need.target;
  return null;
}
export function reservedServiceCells(world: World, exceptPawn?: number): Set<number> {
  const reserved = new Set<number>();
  for (const pawn of world.pawns) if (pawn.id !== exceptPawn) {
    // A leisure visitor must never monopolize the sole bedside place when
    // emergency treatment becomes due later in the same confirmed tick.
    const visit=pawn.recreation?.task;
    if(visit?.activity==='visit-sick'&&world.pawns.some(p=>p.id===visit.patientId&&urgentTreatment(p)))continue;
    const cell = serviceCell(pawn,world); if (cell) reserved.add(cell.z*world.width+cell.x);
    if(pawn.feed?.paste&&(pawn.feed.phase==='pickup'||pawn.feed.phase==='collect'))reserved.add(pawn.feed.spot.z*world.width+pawn.feed.spot.x);
  }
  for(const pawn of world.pawns)if(pawn.id!==exceptPawn&&pawn.animalRescue){const spot=structureById(world,pawn.animalRescue!.spotId);if(spot)reserved.add(spot.z*world.width+spot.x);}
  for(const pawn of world.pawns)if(pawn.id!==exceptPawn&&pawn.rescue){const bed=structureById(world,pawn.rescue!.bedId);const target=bed?.kind==='double-bed'&&pawn.rescue.bedSlot!==undefined?bedSlotCell(bed,pawn.rescue.bedSlot):bed;if(target)reserved.add(target.z*world.width+target.x);}
  for(const pawn of world.pawns)for(const order of pawn.orders?.queue??[])if(isCookingOrder(order))reserved.add(order.cooking.spot.z*world.width+order.cooking.spot.x);
  return reserved;
}
