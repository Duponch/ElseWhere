import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {foodBingeDue299,selfFoodPermission299} from './human-ingestion-clock299.ts';
import { isBedKind } from './bed-kinds.ts';
import { bedAssignmentReason,bedSlotCell,bedSlotClaimed,pawnBedSlot } from './bed-slots.ts';
import { colonyExpectation } from './colony-economy.ts';
import { depletedHumanHunger } from './human-need-rates.ts';
import { advanceRoomRest } from './room-experience.ts';
import { resetTactics } from './tactics-state.ts';
import type { Reachability } from './pathfinding.ts';
import { interruptWork,retryInterruptedCargo } from './interrupted-cargo.ts';
import { urgentMedicalTask } from './urgent-care.ts';
import { reservedSource } from './materials.ts';
import { mealQuantity } from './items.ts';
import { TICKS_PER_DAY } from './types.ts';
import { processEating } from './eating.ts';
import { pileFoodScore, foodSourceSearchGoals, selectFoodSource } from './food-selection.ts';
import { planPasteRequest,pasteRequestValid } from './nutrient-paste.ts';
import { updateWellbeing,type FurnitureSight } from './wellbeing.ts';
import { processSleeping } from './sleeping.ts';
import { updateRecreation } from './recreation-rules.ts';
import { updateRest } from './rest.ts';
import { type FoodItemId } from './food-policy.ts';
import { selfAllowedFood,selfFoodAccessible } from './prison-food.ts';
import { capturePrisonTopology } from './prison-space.ts';
import type { Cell, Pawn, World } from './types.ts';

// Baseline adult: 1.6 nutrition/day; 100 meter points = one nutrition.
export { HUNGER_PER_TICK } from './human-need-rates.ts';
export { REST_PER_TICK, BED_REST_PER_TICK, GROUND_REST_PER_TICK } from './rest.ts';
export { PORTION_NUTRITION } from './eating.ts';
export { INGEST_TICKS } from './eating.ts';
const NEED_INTERVAL = 20;

export interface NeedContext {
  /** Tick-local topology owned and invalidated by the engine; optional for isolated callers. */
  recreationTopology?():import('./room-topology.ts').RoomTopology;
  search(goals?: ReadonlySet<number>): Reachability | null;
  move(target: Cell, exact: boolean): void;
  release(): boolean;
  event(message: string): void;
}

/** Same physical selection for both providers. Pending navigation/release is
 * not evidence that ordinary food is unavailable, so it cannot fall through. */
function tryFoodNeed(world:World,pawn:Pawn,context:NeedContext,foodBinge299=false):'admitted'|'unavailable'|'pending' {
 const allowed=selfAllowedFood(world,pawn);
 const topology=pawn.prisoner||world.structures.some(s=>s.prisoner)?capturePrisonTopology(world):undefined;
 const sources=world.piles.filter(pile=>pile.kind==='food'&&selfFoodPermission299(pile,foodBinge299)&&allowed.includes(pile.item as FoodItemId)&&selfFoodAccessible(world,pawn,pile,topology,foodBinge299)&&pile.quantity>reservedSource(world,pile.id,pawn.id));
 const held=world.piles.find(pile=>pile.owner.type==='pawn'&&pile.owner.pawnId===pawn.id&&pile.kind==='food'&&selfFoodPermission299(pile,foodBinge299)&&allowed.includes(pile.item as FoodItemId));
 const pasteAvailable=world.structures.some(s=>s.kind==='nutrient-paste-dispenser'&&planPasteRequest(world,pawn,s,pawn,topology));
 if(!sources.length&&!held&&!pasteAvailable)return 'unavailable';
 const reach=context.search(foodSourceSearchGoals(world,pawn,sources,topology,foodBinge299));
 if(!reach)return 'pending';
 const best=selectFoodSource(world,pawn,sources,reach,pawn,topology,foodBinge299);
 if(!held&&!best)return 'unavailable';
 const useHeld=!!held&&(!best||world.foodRules==='legacy'||pileFoodScore(world,held,0)>=best.score);
 if(!useHeld&&best?.kind==='paste'){
  if(!context.release())return 'pending';
  if(!pasteRequestValid(world,pawn,best.request))return 'unavailable';
  pawn.need={kind:'eat',phase:'pickup',sourcePileId:null,carryPileId:null,quantity:1,progress:0,dining:null,paste:best.request,...(foodBinge299?{foodBinge299:true as const}:{})};
  pawn.path=best.path;pawn.state='moving';pawn.planCooldown=0;
 }else{
  const selected=useHeld?held!:sources.find(pile=>best?.kind==='pile'&&pile.id===best.id)!;
  const quantity=mealQuantity(pawn,selected,selected.quantity-reservedSource(world,selected.id,pawn.id));
  if(!context.release())return 'pending';
  pawn.need={kind:'eat',phase:'pickup',sourcePileId:selected.id,carryPileId:null,quantity,progress:0,dining:null,...(foodBinge299?{foodBinge299:true as const}:{})};
  pawn.path=useHeld?[]:best!.path;pawn.state='moving';pawn.planCooldown=0;
 }
 return 'admitted';
}

/** Needs never grant nutrition for a reservation or rest for a nearby bed.
 * All phases use the same movement/search budget and material owners as work.
 */
export type NeedDecision300='handled'|'unavailable'|'pending-current';
/** Only tasks already owned before the food offer can resume. This does not
 * select work or confer a reservation on a candidate job. */
function ownsCurrentCivilWork300(world:World,pawn:Pawn):boolean {
 return pawn.jobId!==null&&world.jobs.some(job=>job.id===pawn.jobId&&job.reservedBy===pawn.id)
  ||!!(pawn.haul||pawn.cooking||pawn.animalRescue||pawn.animalHandling||pawn.animalFeed||pawn.animalCare||pawn.hunting||pawn.burial||pawn.cleaning||pawn.brewing||pawn.deepWork||pawn.research||pawn.ward||pawn.feed||pawn.surgery||pawn.tend||pawn.rescue||pawn.firefighting);
}
/** The civil Engine alone consumes the richer decision. Historical/clinical
 * callers keep the boolean wrapper and its original pending ownership. */
export function processNeedsDecision300(world:World,pawn:Pawn,context:NeedContext):NeedDecision300 {
 const result=processNeedsResult300(world,pawn,context,true);
 return result===true?'handled':result===false?'unavailable':result;
}
export function processNeeds(world:World,pawn:Pawn,context:NeedContext):boolean {
 return processNeedsResult300(world,pawn,context,false)!==false;
}
function processNeedsResult300(world:World,pawn:Pawn,context:NeedContext,allowPendingCurrent300:boolean):boolean|'pending-current' {
  const canPlan = pawn.needCooldown === 0;
  if (pawn.bedId !== null && !world.structures.some(bed => bed.id === pawn.bedId && isBedKind(bed.kind))&&!world.packed?.some(pack=>pack.building.id===pawn.bedId&&isBedKind(pack.building.kind))) pawn.bedId = null;
  if(pawn.bedId===null)delete pawn.bedSlot;

  collapseFromExhaustion(world,pawn,context);

  if(pawn.interruptedCargo) {
    retryInterruptedCargo(world,pawn);
    if(pawn.interruptedCargo) {
      if(pawn.need?.kind==='sleep')processSleeping(world,pawn,context,canPlan);
      else pawn.state='idle';
      return true;
    }
  }

  // A direct player job postpones ordinary needs and schedules; depletion and
  // emergency collapse still run. Queuing behind a need does not interrupt it.
  if(pawn.orders.active!==null)return false;
  // Urgent medical work precedes ordinary hunger/schedule choices. Fatigue
  // collapse above still interrupts; the patient's physical bed keeps running.
  if(world.schemaVersion>=50&&urgentMedicalTask(pawn)){
    if(pawn.need?.kind==='sleep')return processSleeping(world,pawn,context,canPlan);
    return false;
  }

  // Core's ordinary provider precedes compulsive eating. A resolved false
  // source permits fallback; an exhausted search budget is still pending.
  const binge299=isSchema299OrLater(Number(world.schemaVersion))&&pawn.mental?.crisis?.kind==='food-binge';
  const ordinaryFood=binge299?pawn.hunger<30:pawn.mental?.crisis?.kind==='food-binge'||pawn.hunger<=(pawn.mental?.crisis?5:pawn.need?.kind==='sleep'?12.5:30);
  if(pawn.need?.kind!=='eat'&&(binge299||ordinaryFood)&&canPlan&&(world.restRules==='adult'||pawn.rest>(pawn.need?.kind==='sleep'?5:0))){
   let attempted=false,result:'admitted'|'unavailable'|'pending'='unavailable';
   if(ordinaryFood){attempted=true;result=tryFoodNeed(world,pawn,context);if(result==='pending')return allowPendingCurrent300&&Number(world.schemaVersion)===300&&ownsCurrentCivilWork300(world,pawn)?'pending-current':true;}
   if(binge299&&result==='unavailable'&&foodBingeDue299(world,pawn)){attempted=true;result=tryFoodNeed(world,pawn,context,true);if(result==='pending')return allowPendingCurrent300&&Number(world.schemaVersion)===300&&ownsCurrentCivilWork300(world,pawn)?'pending-current':true;}
   if(attempted)pawn.needCooldown=NEED_INTERVAL;
  }

  if (pawn.need?.kind === 'eat') { processEating(world, pawn, context); return true; }

  // The food-binge tree has no voluntary rest provider. Collapse still creates
  // a real sleep task and is handled here, allowing recovery on the next tick.
  if ((pawn.need?.kind === 'sleep' || pawn.mental?.crisis?.kind !== 'food-binge') && processSleeping(world, pawn, context, canPlan)) return true;
  if (pawn.hunger <= 20) {
    const job = world.jobs.find(candidate => candidate.id === pawn.jobId);
    // Fuel carried for a cooking bill is part of food preparation. Cancelling it
    // here lets the planner select it again forever ahead of harvesting.
    const cookingFuel = pawn.haul?.destination.type === 'fuel' && pawn.haul.destination.forCooking;
    // In299, an unavailable food provider falls through to ordinary work.
    // Historical worlds retain their critical-hunger interruption rule.
    if (!isSchema299OrLater(Number(world.schemaVersion)) && ((job && job.kind !== 'harvest') || pawn.haul && !cookingFuel)) if (!context.release()) return true;
    // Cooking may still provide food for others even under a restrictive diet.
    // Its processor can wait for a navigation budget while keeping its product;
    // do not overwrite the active task's state during that wait.
    if (pawn.jobId === null && pawn.haul === null && !pawn.hunting && !pawn.orbitalTrade && !pawn.deepWork && !pawn.research && !pawn.cooking && !pawn.ward&&!pawn.feed&&!pawn.tend&&!pawn.surgery && !pawn.rescue && !pawn.animalRescue) pawn.state = 'hungry';
  } else if (pawn.state === 'hungry') pawn.state = 'idle';
  return false;
}

export function updateNeeds(world: World, pawn: Pawn,body?:import('./body-capacities.ts').BodyAssessment,readFurnitureSight?:FurnitureSight,topology?:import('./room-topology.ts').RoomTopology|(()=>import('./room-topology.ts').RoomTopology),readTemperature?:()=>number): void {
  pawn.hunger=depletedHumanHunger(pawn,world.foodRules==='legacy');
  updateRest(world, pawn);
  advanceRoomRest(world,pawn);
  if(!pawn.prisoner)updateRecreation(pawn,body,(colonyExpectation(world,pawn)?.joyToleranceDropPerDay??.18)*100/TICKS_PER_DAY);
  if (pawn.needCooldown > 0) pawn.needCooldown--;
  updateWellbeing(world, pawn,body,readFurnitureSight,topology,readTemperature);
}

export function collapseFromExhaustion(world:World,pawn:Pawn,context:Pick<NeedContext,'event'>):void {
  // A completed attack still owns its recovery. Exhaustion starts its real
  // sleep task when that recovery expires, without discarding the strike.
  if(world.schemaVersion>=192&&pawn.melee?.strike)return;
  // Collapse is an emergency interruption, including travel with a meal in hand.
  if ((world.restRules === 'legacy' ? pawn.rest === 0 : pawn.collapsePending) && pawn.need?.kind !== 'sleep') {
    // Involuntary collapse is a hard interruption, unlike a player cancelling
    // an order. A fired bullet keeps its independent world lifetime.
    delete pawn.shooting;delete pawn.flee;delete pawn.melee;resetTactics(pawn);
    interruptWork(world,pawn);
    if(pawn.draft){pawn.draft.target=null;pawn.draft.queue=[];}
    // An actor woken on its own bed can collapse there before leaving it.
    // The physical bed is real; declaring this cell a floor is an invalid save.
    const bed=world.structures.find(b=>{
      if(b.id!==pawn.bedId||!isBedKind(b.kind))return false;
      if(b.kind==='double-bed'){
        const slot=pawnBedSlot(pawn,b),head=slot!==undefined?bedSlotCell(b,slot):undefined;
        return !!head&&head.x===pawn.x&&head.z===pawn.z&&bedAssignmentReason(world,b,pawn,slot!)===undefined&&!bedSlotClaimed(world,b,slot!,pawn.id);
      }
      return b.x===pawn.x&&b.z===pawn.z&&!!b.prisoner===!!pawn.prisoner&&!world.pawns.some(p=>p!==pawn&&(p.need?.kind==='sleep'&&p.need.bedId===b.id||p.rescue?.bedId===b.id));
    });
    pawn.need = { kind: 'sleep', phase: 'sleep', bedId: bed?.id??null, target: { x: pawn.x, z: pawn.z } };
    pawn.state = 'sleeping'; pawn.collapsePending = false; pawn.restZeroTicks = 0;
    context.event(`${pawn.name} s’effondre de fatigue au sol.`);
  }

}

export function processDraftSleep(world:World,pawn:Pawn,context:NeedContext):boolean {
  collapseFromExhaustion(world,pawn,context);
  if(pawn.need?.kind!=='sleep')return false;
  if(pawn.draft)pawn.draft.lastActiveTick=world.tick;
  retryInterruptedCargo(world,pawn);
  return processSleeping(world,pawn,context,false);
}
