import {appendStructureEntries} from './structure-navigation.ts';
import {hasTravellingCargo,interruptWork} from './interrupted-cargo.ts';
import { removeZonesForPlan } from './construction-zones.ts';
import { releaseWork,type DropPlan } from './work-release.ts';
import { isCookingOrder } from './order-types.ts';
import {isConstructionLightPlant} from './construction-plants.ts';
import type { CommandResult,DesignateCommand,Structure,World } from './types.ts';

/** A floor marking is placed/removed instantly, never a construction job. */
export function placeCraftingSpot(world:World,c:DesignateCommand,drops?:DropPlan):CommandResult {
  if(world.resources.some(r=>r.x===c.x&&r.z===c.z&&!isConstructionLightPlant(r)))return {ok:false,code:'occupied',reason:'Dégager la plante avant de placer cet emplacement.'};
  if(!Number.isSafeInteger(world.nextId+1)||world.structures.length>=world.width*world.height)return {ok:false,code:'invalid-command',reason:'Limite des emplacements atteinte.'};
  removeZonesForPlan(world,c,drops??new Map());
  appendStructureEntries(world,{id:world.nextId++,kind:c.kind==='butcher-spot'?'butcher-spot':'crafting-spot',x:c.x,z:c.z,orientation:c.orientation??0,footprint:'standard',bills:[]});return {ok:true};
}
export function removeCraftingSpot(world:World,spot:Structure,drops:DropPlan):void {
  // All affected cargo was preflighted by planCommandDrops.
  for(const p of world.pawns){if(p.cooking?.stationId===spot.id){if(hasTravellingCargo(world,p))interruptWork(world,p,true);else releaseWork(world,p,drops);}p.orders.queue=p.orders.queue.filter(o=>!isCookingOrder(o)||o.cooking.stationId!==spot.id);}
  world.structures=world.structures.filter(s=>s!==spot);
}
