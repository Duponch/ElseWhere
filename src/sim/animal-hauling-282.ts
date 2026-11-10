import {assignPileOwner} from './pile-index.ts';
import {isSchema282OrLater} from './schema-compatibility-257.ts';
import {animalCarryLimit282,canAnimalHaul282} from './animal-training-282.ts';
import {animalBody} from './wildlife-health.ts';
import {animalNutritionMax,animalFoodWantEat256} from './animal-life.ts';
import {animalClaimed} from './animal-rest-state.ts';
import {groupAnimalPreparation} from './group-animal-formation-256.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {eggAllowedForPlayer256,canMergeEggPile256} from './animal-egg-permission-v256.ts';
import {copyPileCondition} from './pile-condition.ts';
import {createGroundCapacityReader,storageCapacity,dropRetainingIdentity,type GroundCapacityReader} from './ground-placement.ts';
import {createStagingValidation,type StagingGeometryReader} from './staging-validation.ts';
import {storageCells,storageCellAccepts,type StorageCell} from './shelf-storage.ts';
import {reservedSourcesByPile,refreshStock,transferPile} from './materials.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {storageOccupancyAllows} from './occupancy.ts';
import type {Cell,MaterialPile,World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {animalNavigation} from './wildlife-navigation.ts';
import type {AnimalStorageHaul282} from './animal-hauling-state-282.ts';
import {captureAnimalAreaPolicy287,type AnimalAreaPolicy287} from './animal-area-policy-287.ts';

export const ANIMAL_HAUL_INTERVAL_CORE_282=2500;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const physical=(w:World,a:WildAnimal)=>a.motion&&a.motion.end>w.tick?a.motion.from:a;
/** Current local inventory families, not a new universal freight permission.
 * Corpses, unfinished workpieces and packed furniture retain their old owners. */
export function animalHaulPileAllowed282(w:World,p:MaterialPile):boolean {
 return isSchema282OrLater(w.schemaVersion)&&!p.forbidden&&eggAllowedForPlayer256(p)
  &&p.kind!=='corpse'&&p.kind!=='mech-corpse'&&p.kind!=='unfinished'
  &&groupCaravanPileMass256(p,true,w.schemaVersion)!==undefined;
}
/** Cleanup revokes future steps, never an edge already committed. A failed
 * physical Near drop remains explicitly recoverable in the original holder. */
export function interruptAnimalHaul282(w:World,a:WildAnimal):void {
 const task=a.haul;if(!task)return;const id=task.carryPileId;
 delete a.haul;a.path=[];
 if(!a.motion||a.motion.end<=w.tick){if(a.state==='moving')a.state='idle';a.nextDecision=w.tick;}
 if(id!==null){const pile=w.piles.find(p=>p.id===id&&p.owner.type==='inventory'&&p.owner.pawnId===a.id);
  if(pile&&!dropRetainingIdentity(w,pile,physical(w,a)))a.haul={phase:'holding',carryPileId:pile.id,sinceCore:w.tick*10};
 }
 refreshStock(w);
}
/** A storage command/removal retires its future reservations synchronously.
 * Its cargo uses the same Near/holding cleanup as an ordinary interruption. */
export function interruptAnimalStorage282(w:World,ids:ReadonlySet<number>):void {
 for(const a of w.wildlife?.animals??[])if(a.haul&&a.haul.phase!=='holding'&&ids.has(a.haul.destination.stockpileId))interruptAnimalHaul282(w,a);
}
/** Other systems may consume/destroy a Thing after wildlife's turn. Retire
 * those stale references before publishing this confirmed tick. Ordinary
 * worlds allocate no pile/storage indices; active haulers share one capture. */
export function reconcileAnimalHauls282(w:World):void {
 let piles:Map<number,MaterialPile>|undefined,zones:Set<number>|undefined;
 for(const a of w.wildlife?.animals??[]){
  const t=a.haul;if(!t)continue;
  piles??=new Map(w.piles.map(p=>[p.id,p]));
  if(t.phase==='holding'){
   const p=piles.get(t.carryPileId);if(!p||p.owner.type!=='inventory'||p.owner.pawnId!==a.id)delete a.haul;
   continue;
  }
  zones??=new Set(storageCells(w).map(c=>c.id));
  const p=piles.get(t.phase==='pickup'?t.sourcePileId:t.carryPileId!);
  if(!animalHaulAvailable282(w,a)||!zones.has(t.destination.stockpileId)||!p
   ||t.phase==='pickup'&&(p.owner.type!=='ground'||p.quantity<t.quantity)
   ||t.phase==='deliver'&&(p.owner.type!=='inventory'||p.owner.pawnId!==a.id||p.quantity!==t.quantity)){
   interruptAnimalHaul282(w,a);piles=undefined;
  }
 }
}
export function animalHaulAvailable282(w:World,a:WildAnimal,night=false):boolean {
 if(!canAnimalHaul282(w,a)||a.state==='dead'||a.state==='downed'||a.state==='sleeping'||a.meal||a.animalRest||a.animalThermalRefuge288||a.eggLay||a.mating
  ||a.manhunter||a.confusion||a.stun||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.predation||a.exiting
  ||animalClaimed(w,a.id)||groupAnimalPreparation(w,a.id))return false;
 const c=animalBody(a).capacities;
 return c.moving>0&&c.manipulation>0&&a.food>=animalNutritionMax(a)*animalFoodWantEat256(a)
  &&a.rest>=.3&&(!night||a.rest>=.75);
}
/** An isolated, saved-opportunity stream. This preserves the native2/3 chance
 * and interval; the clone's node salt/PRNG is an explicitly different sequence. */
export function animalHaulOpportunity282(w:World,a:WildAnimal):boolean {
 const t=a.training;if(!t)return false;const now=w.tick*10;
 if(t.lastHaulCheckCore!==undefined&&now-t.lastHaulCheckCore<ANIMAL_HAUL_INTERVAL_CORE_282)return false;
 t.lastHaulCheckCore=now;
 let h=(w.seed^Math.imul(a.id,0x9e3779b1)^Math.imul(Math.floor(now/2500),0x85ebca6b)^0x282a11)>>>0;
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
 return (h>>>0)/0x100000000<2/3;
}
interface Decision282 {facts:GroundCapacityReader;geometry:StagingGeometryReader;byId:Map<number,MaterialPile>;zones:StorageCell[];reserved:ReadonlyMap<number,number>}
/** One read-only transaction view per wildlife pass, discarded after writes. */
function capture(w:World):Decision282 {const facts=createGroundCapacityReader(w);return {facts,geometry:createStagingValidation(w),byId:new Map(w.piles.map(p=>[p.id,p])),zones:[...facts.storage.values()],reserved:reservedSourcesByPile(w)};}
function capacity(w:World,d:Decision282,c:StorageCell,p:MaterialPile,except:number):number {
 if(!storageCellAccepts(w,c,p))return 0;
 if(c.shelfId!==undefined)return storageCapacity(w,c,p,except,d.geometry,d.facts);
 const i=c.z*w.width+c.x;if(d.facts.packed.has(i)||!d.geometry.groundAllows(c)||!(d.geometry.storageAllows?.(c)??storageOccupancyAllows(w,c)))return 0;
 const piles=d.facts.piles.get(i)??[];if(piles.length>1)return 0;
 const old=piles[0];if(old&&(old.item!==p.item||!canMergeEggPile256(old,p)))return 0;
 let n=Math.min(c.capacity,ITEM_DEFINITIONS[p.item].stackLimit)-(old?.quantity??0);
 for(const r of d.facts.reservations.get(i)??[]){
  if(r.pawnId===except&&!r.queued)continue;
  if(r.exclusive||r.item!==p.item)return 0;n-=r.quantity;
 }
 return Math.max(0,n);
}
const safeCell=(w:World,c:Cell)=>!foggedCell256(w,c.z*w.width+c.x)&&!w.fires?.items.some(f=>f.x===c.x&&f.z===c.z);
/** The caller grants at most the same one global navigation frontier used by
 * other animals. No candidate search runs for an unlearned or busy actor. */
export function createAnimalHaulingPass282(w:World,readArea:(a:WildAnimal)=>AnimalAreaPolicy287|undefined=a=>captureAnimalAreaPolicy287(w,a)) {
 let view:Decision282|undefined;
 const read=()=>view??=capture(w),invalidate=()=>{view=undefined;};
 function recover(a:WildAnimal):void {
  const t=a.haul;if(t?.phase!=='holding'||a.state==='dead'||animalClaimed(w,a.id)||groupAnimalPreparation(w,a.id)||(a.motion?.end??0)>w.tick||w.tick%25!==a.id%25)return;
  const pile=w.piles.find(p=>p.id===t.carryPileId&&p.owner.type==='inventory'&&p.owner.pawnId===a.id);
  if(!pile){delete a.haul;return;}
  if(dropRetainingIdentity(w,pile,a)){delete a.haul;refreshStock(w);invalidate();}
 }
 function start(a:WildAnimal,nav:ReturnType<typeof animalNavigation>,takeSearch:()=>boolean):boolean {
  if(a.haul||!a.training||a.training.lastHaulCheckCore!==undefined&&w.tick*10-a.training.lastHaulCheckCore<2500||!takeSearch())return false;
  if(!animalHaulOpportunity282(w,a))return false;
  const d=read(),policy=readArea(a),inside=(c:Cell)=>!policy||policy.has(c.z*w.width+c.x),search=nav.haulSearch(a);
  const sources=[...d.byId.values()].filter(p=>p.owner.type==='ground'&&inside(p.owner)&&animalHaulPileAllowed282(w,p)&&safeCell(w,p.owner)
   &&p.quantity>(d.reserved.get(p.id)??0)).sort((x,y)=>{
    const a1=x.owner as Cell,b1=y.owner as Cell;return (a1.x-a.x)**2+(a1.z-a.z)**2-((b1.x-a.x)**2+(b1.z-a.z)**2)||x.id-y.id;
   });
  for(const pile of sources){
   if(pile.owner.type!=='ground'||!search.canReach(pile.owner))continue;
   const sourceCell=pile.owner;
   const current=d.facts.storage.get(sourceCell.z*w.width+sourceCell.x),priority=current&&storageCellAccepts(w,current,pile)?current.priority:-1;
   const zones=d.zones.filter(c=>inside(c)&&c.priority>priority&&safeCell(w,c)&&storageCellAccepts(w,c,pile))
    .sort((x,y)=>y.priority-x.priority||(x.x-sourceCell.x)**2+(x.z-sourceCell.z)**2-((y.x-sourceCell.x)**2+(y.z-sourceCell.z)**2)||x.id-y.id);
   for(const zone of zones){
    const quantity=Math.min(pile.quantity-(d.reserved.get(pile.id)??0),animalCarryLimit282(a,pile.item),capacity(w,d,zone,pile,a.id));
    if(quantity<1||!search.canReach(zone))continue;
    const path=search.pathTo(pile.owner);if(!path)continue;
    a.haul={sourcePileId:pile.id,quantity,phase:'pickup',destination:{type:'stockpile',stockpileId:zone.id},carryPileId:null,startedAtCore:w.tick*10};
    if(a.wander?.job)delete a.wander.job;
    a.path=path;a.state=path.length?'moving':'idle';a.nextDecision=w.tick;invalidate();return true;
   }
  }
  return false;
 }
 function process(a:WildAnimal,nav:ReturnType<typeof animalNavigation>,takeSearch:()=>boolean,move:()=>void):boolean {
  const t=a.haul;if(!t||t.phase==='holding')return false;
  const d=read(),pile=d.byId.get(t.phase==='pickup'?t.sourcePileId:t.carryPileId!);
  const zone=d.zones.find(c=>c.id===t.destination.stockpileId);
  const policy=readArea(a),inside=(c:Cell)=>!policy||policy.has(c.z*w.width+c.x);
  if(!pile||!zone||!inside(zone)||!animalHaulPileAllowed282(w,pile)||!safeCell(w,zone)||capacity(w,d,zone,pile,a.id)<t.quantity
   ||t.phase==='pickup'&&(pile.owner.type!=='ground'||!inside(pile.owner)||!safeCell(w,pile.owner)||pile.quantity<(d.reserved.get(pile.id)??0)||t.quantity>animalCarryLimit282(a,pile.item))
   ||t.phase==='deliver'&&(pile.owner.type!=='inventory'||pile.owner.pawnId!==a.id||pile.quantity!==t.quantity)){
   interruptAnimalHaul282(w,a);invalidate();return false;
  }
  const target=t.phase==='pickup'?pile.owner as Cell:zone;
  if(!same(a,target)){
   if(!a.path.length){if(!takeSearch())return true;const search=nav.haulSearch(a),path=search.pathTo(target);if(!path){interruptAnimalHaul282(w,a);invalidate();return false;}a.path=path;}
   if(a.path.length)move();return true;
  }
  a.path=[];a.state='idle';
  if(t.phase==='pickup'){
   if(pile.quantity<t.quantity||!Number.isSafeInteger(w.nextId+1)||pile.quantity>t.quantity&&w.piles.length>=32768){interruptAnimalHaul282(w,a);invalidate();return false;}
   t.pickupCell={x:pile.owner.type==='ground'?pile.owner.x:a.x,z:pile.owner.type==='ground'?pile.owner.z:a.z};
   if(pile.quantity===t.quantity){assignPileOwner(pile,{type:'inventory',pawnId:a.id});t.carryPileId=pile.id;}
   else{pile.quantity-=t.quantity;const carry={...pile,...copyPileCondition(pile),id:w.nextId++,quantity:t.quantity,owner:{type:'inventory' as const,pawnId:a.id}};w.piles.push(carry);t.carryPileId=carry.id;}
   t.phase='deliver';refreshStock(w);invalidate();return true;
  }
  if(w.tick*10-t.startedAtCore<30)return true;
  if(!transferPile(w,pile,{type:'ground',x:zone.x,z:zone.z})){interruptAnimalHaul282(w,a);invalidate();return false;}
  delete a.haul;a.nextDecision=w.tick;refreshStock(w);invalidate();return true;
 }
 return {invalidate,recover,start,process};
}
