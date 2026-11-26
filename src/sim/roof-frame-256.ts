import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
/** Roof-only physical Frame boundary. No recipe ingredients are manufactured:
 * leavings are fractions of the original delivered piles in container order. */
import {STRUCTURE_DEFINITIONS,footprintCells} from './definitions.ts';
import {structureMaxHp} from './thing-damage-rules.ts';
import {healthRandom} from './health.ts';
import {groundCapacity,planGroundPlacement} from './ground-placement.ts';
import {transferPile,refreshStock} from './materials.ts';
import {appendPileEntries,filterPileEntries} from './pile-identity-directory.ts';
import {copyPileCondition} from './pile-condition.ts';
import {neutralLossPlan} from './destruction-losses.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {isHaulOrder} from './order-types.ts';
import {constructionHaulId,isConstruction} from './construction-rules.ts';
import type {Job,MaterialPile,StructureKind,World} from './types.ts';
export type DamagedFrame256=Job&{frameDamage?:number};
function nearestEven(n:number):number {const floor=Math.floor(n);return n-floor===.5?floor+floor%2:Math.round(n);}
export function frameMaxHp256(job:Job):number {
 if(job.construction!=='frame'||!(job.kind in STRUCTURE_DEFINITIONS)||job.kind==='install')return 0;
 return Math.max(1,nearestEven(Math.fround(structureMaxHp({kind:job.kind as StructureKind,material:job.material})*.25)));
}
export function validFrameDamage256(job:object,version:number):boolean {
 const d=Object.getOwnPropertyDescriptor(job,'frameDamage');if(!d)return true;
 if(version<256||!Object.hasOwn(d,'value'))return false;
 const shape=Object.getOwnPropertyDescriptors(job),construction=shape.construction,kind=shape.kind,material=shape.material;
 if(!construction||!Object.hasOwn(construction,'value')||construction.value!=='frame'||!kind||!Object.hasOwn(kind,'value')||typeof kind.value!=='string'||!Object.hasOwn(STRUCTURE_DEFINITIONS,kind.value)
  ||material&&(!Object.hasOwn(material,'value')||material.value!==undefined&&typeof material.value!=='string'))return false;
 const max=frameMaxHp256({construction:construction.value,kind:kind.value,material:material?.value} as Job);
 return max>0&&Number.isSafeInteger(d.value)&&d.value>0&&d.value<max;
}
export const frameDamage256=(job:Job):number=>(job as DamagedFrame256).frameDamage??0;
function splitActual(world:World,source:MaterialPile,quantity:number):MaterialPile {
 if(quantity===source.quantity)return source;
 if(!Number.isSafeInteger(world.nextId+1)||world.piles.length>=32768)throw RangeError('Roof Frame fragment capacity exhausted');
 const fragment:MaterialPile={...source,...copyPileCondition(source),id:world.nextId++,quantity,owner:{...source.owner}};
 markPileContentWrite379(source).quantity-=quantity;appendPileEntries(world.piles,fragment);return fragment;
}
/** Run on the isolated roof projection; caller adopts only after every death,
 * release, drop and late capacity check succeeds. */
export function damageFrameFromRoof256(world:World,job:Job,amount:number,thick:boolean):boolean {
 if(world.schemaVersion<256||!world.jobs.includes(job)||!isConstruction(job)||!Number.isSafeInteger(amount)||amount<=0)return false;
 const max=frameMaxHp256(job);if(!thick&&!max)return true;
 const damage=frameDamage256(job)+amount;if(!thick&&damage<max){(job as DamagedFrame256).frameDamage=damage;return true;}
 const sources=world.piles.filter(p=>p.owner.type==='job'&&p.owner.jobId===job.id).reverse();
 const items:NonNullable<NonNullable<World['destroyed']>['items']>={};
 for(const source of sources){
  const raw=Math.fround(source.quantity*.25),lower=Math.floor(raw),returned=lower+(healthRandom(world)<raw-lower?1:0),lost=source.quantity-returned;
  if(lost)items[source.item]=(items[source.item]??0)+lost;
  if(returned){
   const fragment=splitActual(world,source,returned),placements=groundCapacity(world,job,fragment)>=returned?[{cell:{x:job.x,z:job.z},quantity:returned}]:planGroundPlacement(world,returned,job,fragment.item);
   if(!placements)throw RangeError('Roof Frame leavings have no physical place');
   for(const placement of placements){const part=splitActual(world,fragment,placement.quantity);if(!transferPile(world,part,{type:'ground',...placement.cell}))throw RangeError('Roof Frame leavings deposit refused');}
  }
  if(lost)world.piles=filterPileEntries(world.piles,p=>p!==source);
 }
 const plan=Object.keys(items).length?neutralLossPlan(world,{items}):undefined;if(plan===null)throw RangeError('Roof Frame loss ledger exhausted');if(plan)world.destroyed=plan;
 // Retire the intention before release, so interruption cannot return a
 // delivered ingredient to the destroyed Frame. An engaged carrier keeps it.
 world.jobs=world.jobs.filter(j=>j!==job);delete (job as DamagedFrame256).frameDamage;
 for(const pawn of world.pawns){if(pawn.jobId===job.id||pawn.haul&&constructionHaulId(pawn.haul.destination)===job.id)interruptWork(world,pawn,true);
  pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'?o!==job.id:!isHaulOrder(o)||constructionHaulId(o.destination)!==job.id);}
 refreshStock(world);return true;
}
export const frameCovers256=(job:Job,index:number,width:number):boolean=>isConstruction(job)&&footprintCells(job).some(c=>c.z*width+c.x===index);
