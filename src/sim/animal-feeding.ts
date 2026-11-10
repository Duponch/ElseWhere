import {assignPileOwner} from './pile-index.ts';
import {releaseAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { ANIMAL_FEED_TICKS,animalFeedingDoctorReady,animalFeedingReason,animalFeedPlaceValid,animalFeedQuantity,type AnimalFeedTask } from './animal-feeding-rules.ts';
import { animalPileFood } from './wildlife-food.ts';
import { animalNutritionMax } from './animal-life.ts';
import { animalSpecies } from './animal-species.ts';
import { advanceAnimalHealth } from './wildlife-health.ts';
import { copyPileCondition } from './pile-condition.ts';
import { ingestFoodRisk } from './food-hygiene.ts';
import { reservedSource } from './materials.ts';
import { adjacent,routeCost,routeToCell,routeToJob,workNeighbours,type Reachability } from './pathfinding.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { canStandAt } from './furniture-travel.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { WildAnimal } from './wildlife-state.ts';
import type { Cell,Pawn,World } from './types.ts';

export interface AnimalFeedingProposal {task:AnimalFeedTask;path:Cell[];target:WildAnimal}
export function animalFeedingWanted(w:World,doctor:Pawn):boolean {
  return animalFeedingDoctorReady(w,doctor)&&!!w.wildlife?.animals.some(a=>!animalFeedingReason(w,doctor,a));
}
/** Patient/spot and quantitative source reservations are proposals only. No
 * animal is frozen by a distant approach, and stock stays physical. */
export function animalFeedingProposal(w:World,doctor:Pawn,reach:Reachability):AnimalFeedingProposal|undefined {
  if(!animalFeedingWanted(w,doctor))return;
  const reserved=reservedServiceCells(w,doctor.id);
  const patients=w.wildlife!.animals.filter(a=>!animalFeedingReason(w,doctor,a))
    .sort((a,b)=>(a.x-doctor.x)**2+(a.z-doctor.z)**2-(b.x-doctor.x)**2-(b.z-doctor.z)**2||a.id-b.id);
  for(const target of patients){
    let bedside:{spot:Cell;cost:number}|undefined;
    for(const spot of workNeighbours(target))if(canStandAt(w,spot)&&!reserved.has(spot.z*w.width+spot.x)){
      const path=routeToCell(w,spot,reach);if(!path)continue;
      const cost=routeCost(w,path,reach);if(!bedside||cost<bedside.cost)bedside={spot,cost};
    }
    if(!bedside)continue;
    let food:{id:number;quantity:number;path:Cell[];cost:number}|undefined;
    for(const pile of w.piles)if(pile.kind==='food'&&eggAllowedForPlayer256(pile)&&pile.owner.type==='ground'&&allowedAreaAllows(w,doctor,pile.owner)&&animalPileFood(w,target,pile)){
      const available=pile.quantity-reservedSource(w,pile.id),quantity=animalFeedQuantity(target,pile,available);if(!quantity)continue;
      const path=routeToJob(w,pile.owner,reach,true);if(!path)continue;
      const cost=routeCost(w,path,reach);
      if(!food||cost<food.cost||cost===food.cost&&pile.id<food.id)food={id:pile.id,quantity,path,cost};
    }
    if(food)return {task:{animalId:target.id,spot:bedside.spot,sourcePileId:food.id,carryPileId:null,quantity:food.quantity,phase:'pickup',progress:0},path:food.path,target};
  }
}
export function startAnimalFeeding(doctor:Pawn,proposal:AnimalFeedingProposal):void {
  doctor.animalFeed=proposal.task;doctor.path=proposal.path;doctor.state='moving';doctor.planCooldown=0;
}
function taskValid(w:World,doctor:Pawn,a:WildAnimal,t:AnimalFeedTask):boolean {
  if(!allowedAreaServicesAllowed(w,doctor))return false;
  if(animalFeedingReason(w,doctor,a,true)||!animalFeedPlaceValid(w,t,a))return false;
  const food=w.piles.find(p=>p.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
  return !!food&&food.kind==='food'&&animalPileFood(w,a,food)&&(t.phase==='pickup'
    ?t.carryPileId===null&&food.owner.type==='ground'&&reservedSource(w,food.id)<=food.quantity&&food.quantity>=t.quantity
    :food.owner.type==='pawn'&&food.owner.pawnId===doctor.id&&food.quantity===t.quantity);
}
function releaseFeeding(w:World,doctor:Pawn):void {if(!releaseWork(w,doctor))interruptWork(w,doctor);}
export function reconcileAnimalFeeding(w:World):void {
  for(const doctor of w.pawns)if(doctor.animalFeed){
    const t=doctor.animalFeed,a=w.wildlife?.animals.find(a=>a.id===t.animalId);
    if(!a||!taskValid(w,doctor,a,t))releaseFeeding(w,doctor);
  }
}
export function animalFeedingInProgress(w:World,a:WildAnimal):boolean {
  return w.pawns.some(doctor=>doctor.animalFeed?.animalId===a.id&&doctor.animalFeed.phase==='feed'
    &&taskValid(w,doctor,a,doctor.animalFeed)&&doctor.state==='working'&&doctor.moveCooldown===0
    &&(!doctor.motion||doctor.motion.end<=w.tick)&&!doctor.path.length
    &&doctor.x===doctor.animalFeed.spot.x&&doctor.z===doctor.animalFeed.spot.z);
}
export function processAnimalFeeding(w:World,doctor:Pawn,ctx:NeedContext):void {
  const t=doctor.animalFeed;if(!t)return;
  const a=w.wildlife?.animals.find(a=>a.id===t.animalId);
  if(a?.health&&!a.health.death&&a.health.tick<w.tick)advanceAnimalHealth(w,a);
  if(!a||!taskValid(w,doctor,a,t)){releaseFeeding(w,doctor);return;}
  if(doctor.moveCooldown>0||(doctor.motion?.end??0)>w.tick||(doctor.stun?.untilCore??0)>w.tick*10)return;
  const food=w.piles.find(p=>p.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId))!;
  if(t.phase==='pickup'){
    if(food.owner.type!=='ground'||!eggAllowedForPlayer256(food)){releaseFeeding(w,doctor);return;}
    if(!adjacent(doctor,food.owner)&&(doctor.x!==food.owner.x||doctor.z!==food.owner.z)){ctx.move(food.owner,false);return;}
    if(food.quantity===t.quantity){assignPileOwner(food,{type:'pawn',pawnId:doctor.id});t.carryPileId=food.id;}
    else{
      if(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1)){releaseFeeding(w,doctor);return;}
      food.quantity-=t.quantity;t.carryPileId=w.nextId++;
      w.piles.push({id:t.carryPileId,kind:'food',item:food.item,quantity:t.quantity,owner:{type:'pawn',pawnId:doctor.id},...copyPileCondition(food)});
    }
    t.phase='deliver';doctor.path=[];doctor.state='moving';return;
  }
  if(doctor.x!==t.spot.x||doctor.z!==t.spot.z){ctx.move(t.spot,true);return;}
  releaseAnimalThermalRefuge288(w,a);t.phase='feed';doctor.state='working';doctor.path=[];
  if(t.progress+1<ANIMAL_FEED_TICKS){t.progress++;return;}
  const wildlife=w.wildlife!,nutrition=ITEM_DEFINITIONS[food.item].nutrition*t.quantity/100;
  if(!Number.isSafeInteger(wildlife.eatenItems+t.quantity)||!Number.isFinite(wildlife.eatenNutrition+nutrition)
    ||wildlife.eatenNutrition+nutrition>Number.MAX_SAFE_INTEGER)return;
  // Physiology was settled above under the old hunger. Only the actual held
  // ration is consumed; there is no Medicine XP, medicine or human thought.
  w.piles.splice(w.piles.indexOf(food),1);a.food=Math.min(animalNutritionMax(a),a.food+nutrition);
  wildlife.eatenItems+=t.quantity;wildlife.eatenNutrition+=nutrition;
  ctx.event(`${doctor.name} a nourri ${animalSpecies(a.species).label} ${a.id} avec ${t.quantity} × ${ITEM_DEFINITIONS[food.item].label}.`);
  releaseFeeding(w,doctor);ingestFoodRisk(w,a,food,false);
}
