import {CARRY_CAPACITY} from './definitions.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {pawnBody} from './health-rules.ts';
import {animalBody} from './wildlife-health.ts';
import {animalBodySize} from './animal-life.ts';
import {nativeHumanBiologicalCore256} from './native-human-identity-256.ts';
import type {Pawn,World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';

/** Core 1.6.4871 Pawn_CarryTracker: local quantity/volume, independent of
 * caravan Mass. Core smallVolume is present only on Silver and Gold. */
export const itemVolume379=(item:ItemId):number=>item==='silver'||item==='gold'?Math.fround(.1):1;
const even=(value:number):number=>{const n=Math.floor(value),r=value-n;return r<.5?n:r>.5?n+1:n%2===0?n:n+1;};
const f=Math.fround;
export function carryingCapacity379(actor:Pawn|WildAnimal):number {
 const animal='species' in actor,body=animal?animalBody(actor):pawnBody(actor);
 // Core-only native Human admits the teenager(.8) and adult(1) stages.
 // Historical adult owners have no native biological header and remain1.
 const size=animal?animalBodySize(actor):actor.nativeHuman&&nativeHumanBiologicalCore256(actor)<18*3600000?f(.8):1;
 return Math.max(1,f(f(f(75)*f(body.capacities.manipulation))*f(size)));
}
export function carryStackLimit379(w:{schemaVersion:number},actor:Pawn|WildAnimal,item:ItemId):number {
 if(!Object.hasOwn(ITEM_DEFINITIONS,item))return 0;
 if(Number(w.schemaVersion)<379&& !('species' in actor))return CARRY_CAPACITY;
 if(actor.state==='dead'||actor.state==='downed')return 0;
 // Preserve the literal historical animal floating-point order before379.
 const capacity=Number(w.schemaVersion)<379&&'species' in actor?Math.max(1,f(f(f(75)*f(animalBodySize(actor)))*f(animalBody(actor).capacities.manipulation))):carryingCapacity379(actor);
 return Math.min(ITEM_DEFINITIONS[item].stackLimit,Math.max(0,even(f(capacity/itemVolume379(item)))));
}
/** Accepted/held quantities do not become invalid after a capacity loss.
 * The actual pickup clamps against the actor's then-current capacity. */
export const carryQuantityBound379=(w:{schemaVersion:number},item:ItemId|undefined):number=>Number(w.schemaVersion)<379?CARRY_CAPACITY:item&&Object.hasOwn(ITEM_DEFINITIONS,item)?ITEM_DEFINITIONS[item].stackLimit:0;
/** Isolated Pawn shapes have no map piles. The cross-owner pass below binds
 * this upper ceiling to the exact item's own stack limit. */
export const carryShapeBound379=(version:number):number=>version>=379?500:CARRY_CAPACITY;
export function validateCarryQuantities379(w:World,version:number):string[] {
 if(version<379)return [];
 const errors:string[]=[],bound=(item:ItemId|undefined,n:number)=>Number.isSafeInteger(n)&&n>0&&n<=carryQuantityBound379(w,item);
 for(const p of w.pawns){
  const tasks=[...(p.haul?[p.haul]:[]),...(Array.isArray(p.orders?.queue)?p.orders.queue.filter(o=>typeof o==='object'&&o!==null&&'sourcePileId' in o):[])];
  for(const h of tasks){const pile=w.piles.find(i=>i.id===(h.phase==='pickup'?h.sourcePileId:h.carryPileId));if(pile&&!bound(pile.item,h.quantity))errors.push('Carried or reserved quantity exceeds its actual item stack.');}
  for(const i of Array.isArray(p.cooking?.ingredients)?p.cooking!.ingredients:[])if(i.stage!=='placed'&&!bound(i.item,i.quantity))errors.push('Production cargo exceeds its actual item stack.');
 }
 return errors;
}
