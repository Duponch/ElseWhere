import {isPemmicanRecipe} from './pemmican-content.ts';
import {isMechSalvageRecipe} from './mechanoid-salvage.ts';
import { isKibbleRecipe } from './fodder-recipes.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { isSmeltingRecipe } from './smelting-rules.ts';
import { isBiofuelRecipe,recipeHasProducts,taskRecipe } from './production-recipes.ts';
import { createGroundCapacityReader,groundCapacity, nearbyGround, storageCapacity } from './ground-placement.ts';
import { furnitureAsideAllowed, furnitureSlot } from './furniture-haul-rules.ts';
import { storageOccupancyAllows } from './occupancy.ts';
import { storageConditionAccepts } from './storage-condition.ts';
import { depositMaterialPart } from './materials.ts';
import { storageCells,storageCellById,storageCellAccepts } from './shelf-storage.ts';
import { routeToJob, type Reachability } from './pathfinding.ts';
import type { NeedContext } from './needs.ts';
import type { Cell, MaterialPile, Pawn, Structure, World } from './types.ts';
import { isArtRecipe } from './art-rules.ts';

const near=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
export interface ProductionContext extends NeedContext { candidates?():Reachability|null; workRate(station:Structure,worker:Pawn):number }
function finish(pawn:Pawn):void {pawn.cooking=null;if(pawn.orders.active==='cook')pawn.orders.active=null;pawn.path=[];pawn.state='idle';pawn.planCooldown=0;}
/** A partial output keeps the held ID; only its deposited fraction can merge. */
function deposit(world:World,pawn:Pawn,product:MaterialPile,cell:Cell,quantity:number):boolean {
  return depositMaterialPart(world,product,cell,quantity,pawn.id);
}
function depositAndContinue(world:World,pawn:Pawn,product:MaterialPile,cell:Cell,quantity:number):void {
  const complete=quantity===product.quantity;
  if(!deposit(world,pawn,product,cell,quantity)){pawn.planCooldown=20;return;}
  if(complete)finish(pawn);
  else {pawn.cooking!.storageId=null;delete pawn.cooking!.storageQuantity;pawn.path=[];pawn.planCooldown=0;pawn.state='working';}
}
/** A sculpture remains a whole building through output and stockpile delivery. */
function processArtOutput(world:World,pawn:Pawn,context:ProductionContext,destination:'stockpile'|'drop'):void {
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  const task=pawn.cooking!,pack=world.packed.find(p=>p.building.id===task.productId);
  if(!pack||pack.owner.type!=='pawn'||pack.owner.pawnId!==pawn.id){context.release();return;}
  if(destination==='stockpile'){
    const target=world.stockpiles.find(s=>s.id===task.storageId);
    if(target?.filters.furniture&&allows(target)&&storageConditionAccepts(target,pack.building)&&storageOccupancyAllows(world,target)&&furnitureSlot(world,target,pawn.id)){
      task.actionCell={x:target.x,z:target.z};
      if(!near(pawn,target)){context.move(target,false);return;}
      pack.owner={type:'ground',x:target.x,z:target.z};finish(pawn);return;
    }
    task.storageId=null;delete task.storageQuantity;
    if(pawn.planCooldown>0)return;
    const targets=world.stockpiles.filter(s=>allows(s)&&s.filters.furniture&&storageConditionAccepts(s,pack.building)&&storageOccupancyAllows(world,s)&&furnitureSlot(world,s,pawn.id))
      .sort((a,b)=>b.priority-a.priority||(pawn.x-a.x)**2+(pawn.z-a.z)**2-((pawn.x-b.x)**2+(pawn.z-b.z)**2)||a.id-b.id);
    if(targets.length){
      const reach=context.candidates?context.candidates():context.search();if(!reach)return;
      for(const zone of targets){
        const path=routeToJob(world,zone,reach,true);if(!path)continue;
        task.storageId=zone.id;pawn.path=path;pawn.state='moving';pawn.planCooldown=0;return;
      }
    }
  }
  if(pawn.path.length&&allows(task.actionCell)&&furnitureAsideAllowed(world,task.actionCell,pawn.id,pack.building)){
    context.move(task.actionCell,false);return;
  }
  if(pawn.planCooldown>0)return;
  const targets=nearbyGround(world,pawn).filter(c=>allows(c)&&furnitureAsideAllowed(world,c,pawn.id,pack.building));
  const close=targets.find(c=>near(pawn,c));
  if(close){task.actionCell={...close};pack.owner={type:'ground',...close};finish(pawn);return;}
  if(targets.length){
    const reach=context.candidates?context.candidates():context.search();if(!reach)return;
    for(const target of targets){
      const path=routeToJob(world,target,reach,true);if(path){task.actionCell={...target};pawn.path=path;pawn.state='moving';return;}
    }
  }
  pawn.state='working';pawn.planCooldown=20;
}
export function processProductionOutput(world:World,pawn:Pawn,context:ProductionContext,destination:'stockpile'|'drop'):void {
  if(pawn.cooking&&!recipeHasProducts(taskRecipe(pawn.cooking))){context.release();return;}
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  if(isArtRecipe(pawn.cooking?.recipe)){processArtOutput(world,pawn,context,destination);return;}
  const task=pawn.cooking!,product=world.piles.find(p=>p.id===task.productId);
  if(!product){context.release();return;}
  const facts=world.structures.some(s=>s.shelf)?createGroundCapacityReader(world):undefined;
  if(destination==='stockpile') {
    const target=storageCellById(world,task.storageId!),quantity=task.storageQuantity??product.quantity;
    if(target&&allows(target)&&storageCapacity(world,target,product,pawn.id,undefined,facts)>=quantity) {
      task.actionCell={x:target.x,z:target.z};
      if(!near(pawn,target)){context.move(target,false);return;}
      depositAndContinue(world,pawn,product,target,quantity);return;
    }
    task.storageId=null;delete task.storageQuantity;
    if(pawn.planCooldown>0)return;
    const targets=storageCells(world).filter(s=>allows(s)&&storageCellAccepts(world,s,product))
      .sort((a,b)=>b.priority-a.priority||(pawn.x-a.x)**2+(pawn.z-a.z)**2-((pawn.x-b.x)**2+(pawn.z-b.z)**2)||a.id-b.id);
    if(targets.length) {
      const reach=context.candidates?context.candidates():context.search();if(!reach)return;
      for(const zone of targets) {
        const capacity=storageCapacity(world,zone,product,pawn.id,undefined,facts);if(capacity<=0)continue;
        const path=routeToJob(world,zone,reach,true);if(!path)continue;
        task.storageId=zone.id;
        // A bulk meal may fill a partly free stack; its remainder stays with
        // the worker until another physical delivery succeeds.
        if(task.recipe==='brew-wort'||isPemmicanRecipe(task.recipe)||isKibbleRecipe(task.recipe)||isSmeltingRecipe(task.recipe)||isBiofuelRecipe(task.recipe)||isMechSalvageRecipe(task.recipe)||task.recipe==='stone-blocks'||task.recipe==='butcher-creature'||task.recipe==='cook-simple-meal-bulk'||task.recipe==='cook-fine-meal-bulk'||task.recipe==='cook-lavish-meal-bulk'||task.recipe==='cook-vegetarian-lavish-meal-bulk'||task.recipe==='cook-carnivore-lavish-meal-bulk'||task.recipe==='cook-vegetarian-fine-meal-bulk'||task.recipe==='cook-carnivore-fine-meal-bulk')task.storageQuantity=Math.min(product.quantity,capacity);
        pawn.path=path;pawn.state='moving';pawn.planCooldown=0;return;
      }
    }
  }
  if(pawn.path.length&&allows(task.actionCell)&&groundCapacity(world,task.actionCell,product,pawn.id,undefined,facts)>0){
    context.move(task.actionCell,false);return;
  }
  if(pawn.planCooldown>0)return;
  // Re-evaluate at an action boundary; no remote deposit across the map.
  const targets=nearbyGround(world,pawn).filter(c=>allows(c)&&groundCapacity(world,c,product,pawn.id,undefined,facts)>0);
  const close=targets.find(c=>near(pawn,c));
  if(close){task.actionCell={...close};depositAndContinue(world,pawn,product,close,Math.min(product.quantity,groundCapacity(world,close,product,pawn.id,undefined,facts)));return;}
  if(targets.length) {
    const reach=context.candidates?context.candidates():context.search();if(!reach)return;
    for(const target of targets){const path=routeToJob(world,target,reach,true);if(path){task.actionCell={...target};pawn.path=path;pawn.state='moving';return;}}
  }
  pawn.state='working';pawn.planCooldown=20;
}
