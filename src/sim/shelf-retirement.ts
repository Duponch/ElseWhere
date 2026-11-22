import {dropEggBoxContent374} from './egg-box-374.ts';
import {assignPileOwner} from './pile-index.ts';
import {hasTravellingCargo,interruptWork} from './interrupted-cargo.ts';
import {interruptAnimalStorage282} from './animal-hauling-282.ts';
import {footprintCells} from './definitions.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {reservedSource} from './materials.ts';
import {planPawnDrops,releaseWork,type DropPlan} from './work-release.ts';
import type {Structure,World} from './types.ts';

export interface ShelfRemovalPlan {view:World;drops:DropPlan;carriers:Set<number>;cells:Set<number>}
/** Retiring the storage surface leaves every original item on the map. One
 * stack remains per floor cell; surplus stacks need real free ground before
 * the transaction can retire the shelf or advance any salvage RNG. */
export function planShelfRemoval(world:World,s:Structure):ShelfRemovalPlan|null {
  const view:World={...world,structures:world.structures.filter(b=>b.id!==s.id),
    piles:world.piles.map(p=>({...p,owner:{...p.owner}})),packed:world.packed.map(p=>({...p,owner:{...p.owner}}))};
  const drops:DropPlan=new Map(),cells=new Set(s.shelf?.cells??[]),carriers=new Set<number>();
  // Schema 374: a removed egg box drops its eggs near its cell (CompThingContainer.PostDeSpawn).
  if(s.kind==='egg-box'&&world.structures.includes(s)){
    const dropped=dropEggBoxContent374(view,s);if(dropped===null)return null;
    if(dropped!==undefined){const pile=view.piles.find(p=>p.id===dropped)!;if(pile.owner.type==='ground')drops.set(dropped,{x:pile.owner.x,z:pile.owner.z});
      // The extraction job fails with its box; nothing is carried yet.
      for(const p of world.pawns)if(p.haul?.phase==='pickup'&&p.haul.sourcePileId===dropped)carriers.add(p.id);}
    return {view,drops,cells,carriers};
  }
  if(!s.shelf||!world.structures.includes(s))return {view,drops,cells,carriers};
  const footprint=new Set(footprintCells(s).map(c=>c.z*world.width+c.x)),kept=new Set<number>();
  for(const p of view.piles.filter(p=>p.owner.type==='ground'&&footprint.has(p.owner.z*world.width+p.owner.x)).sort((a,b)=>a.id-b.id)){
    if(p.owner.type!=='ground')continue;
    const key=p.owner.z*world.width+p.owner.x;
    if(!kept.has(key)){kept.add(key);continue;}
    // Active source claims bind a physical cell. Waiting preserves that edge,
    // rather than relocating an ingredient beneath a pending source task.
    if(reservedSource(world,p.id)>0)return null;
    const origin={...p.owner};
    if(!dropRetainingIdentity(view,p,origin)||p.owner.type!=='ground')return null;
    drops.set(p.id,{x:p.owner.x,z:p.owner.z});
  }
  for(const p of world.pawns)if(p.haul?.destination.type==='stockpile'&&cells.has(p.haul.destination.stockpileId))carriers.add(p.id);
  const cargo=planPawnDrops(view,new Set([...carriers].filter(id=>!hasTravellingCargo(world,world.pawns.find(p=>p.id===id)!))));if(!cargo)return null;
  for(const [id,cell] of cargo){drops.set(id,cell);const pile=view.piles.find(p=>p.id===id);if(pile)assignPileOwner(pile,{type:'ground',...cell});}
  return {view,drops,carriers,cells};
}
/** Apply only the already placeable plan. Settings/cell IDs stay on a packed
 * building; content stays ground and cannot follow its furniture carrier. */
export function commitShelfRemoval(world:World,plan:ShelfRemovalPlan):void {
  for(const [id,cell] of plan.drops){const pile=world.piles.find(p=>p.id===id);if(pile)assignPileOwner(pile,{type:'ground',...cell});}
  interruptAnimalStorage282(world,plan.cells);
  for(const p of world.pawns){
    if(plan.carriers.has(p.id)){if(hasTravellingCargo(world,p))interruptWork(world,p,true);else releaseWork(world,p,plan.drops);}
    if(p.cooking?.storageId!==null&&p.cooking?.storageId!==undefined&&plan.cells.has(p.cooking.storageId)){
      p.cooking.storageId=null;delete p.cooking.storageQuantity;p.path=[];p.planCooldown=0;
    }
    p.orders.queue=p.orders.queue.filter(o=>typeof o==='number'||!('destination' in o)||o.destination.type!=='stockpile'||!plan.cells.has(o.destination.stockpileId));
  }
}
