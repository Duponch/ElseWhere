import {structureDamageChanged379} from './structure-family-379.ts';
import {BARRICADE_382,barricadeStuff382} from './barricade-382.ts';
import {filterPileEntries} from './pile-identity-directory.ts';
import { coolerSalvage } from './cooler-salvage.ts';
import { releaseStructureMelee } from './melee-state.ts';
import { addMaterial } from './materials.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { constructionRecipe } from './construction-materials.ts';
import type { ConstructionMaterial } from './construction-materials.ts';
import { releaseAssignments } from './work-release.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { reconcileRoofSupport } from './roofing.ts';
import { invalidateAnimalPens } from './animal-pens.ts';
import { isRoomDoor } from './door-rules.ts';
import type { Structure, World } from './types.ts';
import type { ResourceKind } from './types.ts';
import type { ItemId } from './items.ts';

/** Damageable defense structures; low cover is traversable, unlike a breach. */
export const isBarrier=(s:Pick<Structure,'kind'>):boolean=>s.kind==='wall'||isRoomDoor(s.kind)||(s.kind==='cooler'||s.kind==='vent')||s.kind==='sandbags'||s.kind==='barricade';
export const isBreachableBarrier=(s:Pick<Structure,'kind'>):boolean=>s.kind==='wall'||isRoomDoor(s.kind)||(s.kind==='cooler'||s.kind==='vent');
const FACTORS:Readonly<Partial<Record<ConstructionMaterial,number>>>={wood:.65,steel:1,'granite-blocks':1.7,'limestone-blocks':1.55,'marble-blocks':1.2,'sandstone-blocks':1.4,'slate-blocks':1.3,cloth:1,'light-leather':1};
export const barrierMaxHp=(s:Pick<Structure,'kind'|'material'>):number=>s.kind==='barricade'?Math.round(BARRICADE_382.maxHp*(barricadeStuff382(s.material)?.hp??NaN)):(s.kind==='cooler'||s.kind==='vent')?100:Math.round((isRoomDoor(s.kind)?160:300)*(FACTORS[s.material??'wood']??NaN));
export const barrierHp=(s:Structure):number=>barrierMaxHp(s)-(s.damage??0);
export interface DestructionLedger { natural?:import('./cave-hive-loss-256.ts').HiveNaturalLoss256; count:number; lost:Partial<Record<ConstructionMaterial|'gold'|'ai-core'|'plasteel'|'component'|'advanced-component'|'uranium'|'wort'|'beer',number>>;fuelTicksLost?:number;fuelTicksBurned?:number;batteryEnergyLost?:number;items?:Partial<Record<ItemId,number>>;resources?:Partial<Record<ResourceKind,number>>;woodPotentialLost?:number }

/** Walls/doors drop nothing; cooler, vent and sandbags salvage a recipe quarter.
 * Record only destroyed material, independently of deconstruction losses. */
export function damageBarrier(world:World,s:Structure,amount:number,rng=world.rng):boolean {
  if(!isBarrier(s)||!world.structures.includes(s)||!Number.isSafeInteger(amount)||amount<1)return false;
  const damage=(s.damage??0)+amount;
  if(damage<barrierMaxHp(s)){s.damage=damage;structureDamageChanged379(world,s);world.rng=rng;return true;}
  const salvage=(s.kind==='cooler'||s.kind==='vent')||s.kind==='sandbags'||s.kind==='barricade'?coolerSalvage(world,s,rng):undefined;if(salvage===null)return false;
  const ledger=world.destroyed??{count:0,lost:{}};
  const lost={...ledger.lost};
  for(const c of constructionRecipe(s).ingredients){const id=c.item as ConstructionMaterial;lost[id]=(lost[id]??0)+c.quantity-(salvage?.returned.get(c.item)??0);}
  if(!Number.isSafeInteger(ledger.count+1)||Object.values(lost).some(n=>!Number.isSafeInteger(n)))return false;
  const removed=new Set(world.jobs.filter(j=>j.repair?.structureId===s.id||j.fixBreakdown?.structureId===s.id||j.deconstruction?.structureId===s.id).map(j=>j.id));
  const delivered=world.piles.filter(p=>p.owner.type==='job'&&removed.has(p.owner.jobId));
  const serviceLoss=delivered.reduce((sum,p)=>sum+(p.item==='component'?p.quantity:0),0);
  if(!Number.isSafeInteger((lost.component??0)+serviceLoss))return false;
  if(serviceLoss)lost.component=(lost.component??0)+serviceLoss;
  for(const p of world.pawns){
    if(p.haul?.destination.type==='job'&&removed.has(p.haul.destination.jobId))interruptWork(world,p);
    if(p.jobId!==null&&removed.has(p.jobId))releaseAssignments(world,p);
    p.orders.queue=p.orders.queue.filter(o=>typeof o!=='number'||!removed.has(o));
  }
  world.jobs=world.jobs.filter(j=>!removed.has(j.id));
  if(delivered.length)world.piles=filterPileEntries(world.piles,p=>!delivered.includes(p));
  world.structures=world.structures.filter(b=>b!==s);
  releaseStructureMelee(world,s.id);
  // A door job loses ownership immediately; its committed strike keeps the
  // contact cell until recovery ends even when another actor destroys it.
  for(const a of world.wildlife?.animals??[])if(a.manhunter?.door?.targetId===s.id)delete a.manhunter.door;
  invalidateAnimalPens(world);
  world.destroyed={...ledger,count:ledger.count+1,lost};
  if(salvage)for(const d of salvage.drops)addMaterial(world,ITEM_DEFINITIONS[d.item].kind,d.quantity,{type:'ground',...d.cell},d.item);
  world.rng=salvage?.rng??rng;reconcileRoofSupport(world,false,s);
  return true;
}
