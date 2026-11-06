import { storageCells,storageCellAccepts,shelfFixedAccepts,type StorageCell } from './shelf-storage.ts';
import { prisonFoodChecker } from './prison-food.ts';
import { hopperAccepts,hopperCapacity,hopperFillWanted } from './nutrient-paste.ts';
import { automaticallyHaulable } from './mining-rules.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { storageAccepts } from './storage-filters.ts';
import { storageConditionKey } from './storage-condition.ts';
import type { World } from './types.ts';
import { structuresOfKind } from './structure-navigation.ts';

/** Linear conservative rejection before an expensive navigation flood.
 * False means no hauling can improve storage. True still requires all reservations/access checks. */
export function mayImproveStorage(world:World):boolean {
  const cells=storageCells(world),zones=new Map(cells.map(z=>[z.z*world.width+z.x,z]));
  const piles=world.piles.filter(p=>p.owner.type==='ground'),byCell=new Map<number,typeof piles>();
  for(const p of piles)if(p.owner.type==='ground'){const k=p.owner.z*world.width+p.owner.x,list=byCell.get(k);if(list)list.push(p);else byCell.set(k,[p]);}
  const hoppers=new Map([...structuresOfKind(world,'hopper')].map(s=>[s.z*world.width+s.x,s]));
  const wanted=[...hoppers.values()].filter(h=>hopperFillWanted(world,h.id));
  const best=new Map<ItemId,number>();
  // Keep the historical fast path when no range is active. Geometry/category
  // candidates are shared by item; state admission is cached separately per
  // immutable equivalence class, for this decision only.
  const freshnessConditional=cells.some(z=>z.allowFresh===false||z.allowRotten===false);
  const conditional=freshnessConditional||cells.some(z=>z.quality!==undefined||z.hitPoints!==undefined);
  const candidates=conditional?new Map<ItemId,Map<string,StorageCell>>():undefined;
  const items=conditional?[...new Set(piles.map(p=>p.item))]:Object.keys(ITEM_DEFINITIONS) as ItemId[];
  for(const zone of cells) {
    const occupants=byCell.get(zone.z*world.width+zone.x)??[],pile=occupants[0];
    const policy=candidates?`${zone.quality?.min??'-'}:${zone.quality?.max??'-'}:${zone.hitPoints?.min??'-'}:${zone.hitPoints?.max??'-'}:${zone.allowFresh??true}:${zone.allowRotten??true}:${zone.shelfId===undefined?'ground':'shelf'}`:'';
    for(const item of items) {
      const definition=ITEM_DEFINITIONS[item];
      if(storageAccepts(zone,item)&&(zone.shelfId!==undefined?occupants.length<3||occupants.some(p=>p.item===item&&p.quantity<Math.min(zone.capacity,definition.stackLimit)):(!pile||pile.item===item)&&Math.min(zone.capacity,definition.stackLimit)>(pile?.quantity??0))){
        best.set(item,Math.max(best.get(item)??0,zone.priority));
        // Once geometry/item admission is known, identical range policies
        // differ only by priority for this conservative gate. Keep the best.
        if(candidates){let list=candidates.get(item);if(!list)candidates.set(item,list=new Map());const previous=list.get(policy);if(!previous||previous.priority<zone.priority)list.set(policy,zone);}
      }
    }
  }
  const isPrisonFood=prisonFoodChecker(world);
  const stateBest=new Map<string,number>();
  for(const pile of piles.values())if(automaticallyHaulable(pile)&&!isPrisonFood(pile)&&pile.owner.type==='ground') {
    const zone=zones.get(pile.owner.z*world.width+pile.owner.x);
    const current=Math.max(zone&&storageCellAccepts(world,zone,pile)&&pile.quantity<=zone.capacity?zone.priority:0,hoppers.has(pile.owner.z*world.width+pile.owner.x)&&hopperAccepts(pile.item)?3:0);
    if(current<3&&hopperAccepts(pile.item)&&wanted.some(h=>hopperCapacity(world,h.id,pile.item)>0))return true;
    const coarse=best.get(pile.item)??0;
    if(coarse<=current)continue;
    if(!candidates)return true;
    const key=`${storageConditionKey(pile,world.tick,freshnessConditional)}:${pile.kind==='corpse'?shelfFixedAccepts(pile):''}`;
    let admitted=stateBest.get(key);
    if(admitted===undefined){
      admitted=0;
      for(const destination of candidates.get(pile.item)?.values()??[])if(destination.priority>admitted&&storageCellAccepts(world,destination,pile)){
        admitted=destination.priority;if(admitted===coarse)break;
      }
      stateBest.set(key,admitted);
    }
    if(admitted>current)return true;
  }
  return false;
}
