import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {advanceGroupCare} from './group-care.ts';
import type {World} from './types.ts';
import type {AwayGroup} from './group-capture.ts';
import type {WildAnimal} from './wildlife-state.ts';
import {planetTile} from './planet-geography-256.ts';
import {LOCAL_BIOME_DATA_256} from './local-biome-data-v256.ts';
import {groupAmbientTemperature256,groupProvisionClimateRate} from './group-provision-age.ts';
import {advanceCaravanAnimalBiology256,advanceCaravanAnimalNeed150256} from './group-animal-biological-256.ts';
import {satisfyCaravanAnimalFood256,recordCaravanInventoryEffect256} from './group-animal-food-256.ts';
import {retireCaravanAnimal256} from './group-animal-terminal-256.ts';
import {groupPhysicalPawns256} from './group-mixed-pawns-256.ts';
import {healthRandom} from './health.ts';
import {rotAge,ticksUntilRot,isPerishable,type PerishableItem} from './food-preservation.ts';
import {GROUP_FORAGED_ITEMS_256} from './group-forage-state-256.ts';
import {GroupRestMarks256} from './group-need-meters-256.ts';
export function groupAnimalEnvironment256(w:World,g:AwayGroup,atCore=w.tick*10):{temperature:number;hasVirtualPlants:boolean} {
 const key=w.planet&&planetTile(w.planet,g.tile)?.biome;if(!key||!Object.hasOwn(LOCAL_BIOME_DATA_256,key))throw Error('Actual animal caravan biome unavailable');return {temperature:groupAmbientTemperature256(w,g,atCore),hasVirtualPlants:LOCAL_BIOME_DATA_256[key as keyof typeof LOCAL_BIOME_DATA_256].scalars.hasVirtualPlants};
}
/** Current perishable possessions, never terminal inventories or old contacts.
 * Fruits/pemmican keep their original counters in the existing owner pass. */
export function advanceCaravanOtherFoodAges256(w:World,g:AwayGroup):void {
 const rate=groupProvisionClimateRate(w,g),live=new Set(groupPhysicalPawns256(g).filter(p=>p.state!=='dead'&&!p.health?.death).map(p=>p.id));
 const other=g.items.filter(p=>p.owner.type==='inventory'&&live.has(p.owner.pawnId)&&isPerishable(p.item)&&p.item!=='pemmican'&&!GROUP_FORAGED_ITEMS_256.includes(p.item as typeof GROUP_FORAGED_ITEMS_256[number]));
 const expired=other.filter(p=>ticksUntilRot(p,w.tick)<=0),units=new Map<PerishableItem,number>();for(const p of expired){if(!isPerishable(p.item))throw Error('Nonperishable food in expired selection');units.set(p.item,(units.get(p.item)??0)+p.quantity);}
 for(const [item,n] of units){if(!Number.isSafeInteger(n)||!Number.isSafeInteger((w.spoiled[item]??0)+n))throw Error('Actual food spoilage overflow');}
 // Preflight the complete signed effect vector before the first pile changes.
 const r=g.reorganization;if(!r)throw Error('Missing actual animal food opening');const clone={...g,reorganization:{...r,inventoryEffects:{...r.inventoryEffects}}};for(const [item,n]of units)recordCaravanInventoryEffect256(clone,item,-n);
 for(const p of other)if(!expired.includes(p)&&rate!==(p.rot?.rate??1))p.rot={progress:rotAge(p,w.tick),atTick:w.tick,...rate!==1?{rate}:{}};
 if(expired.length){g.reorganization=clone.reorganization;const remove=new Set(expired);g.items=g.items.filter(p=>!remove.has(p));for(const [item,n]of units)w.spoiled[item]=(w.spoiled[item]??0)+n;}
}
export function advanceGroupAnimalPersonal256(w:World,g:AwayGroup,clinicalRest:(a:WildAnimal)=>{resting:boolean;carried:boolean}):void {
 if(!g.travel&&!g.animalOwners)return;
 // Admission2 already settled this same interval before human clinical death.
 // Historical owners retain their previous ordering and pay this pass here.
 if((Number(w.schemaVersion)!==259&&Number(w.schemaVersion)!==260&&(Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion)))))||g.admission?.revision!==2)advanceCaravanOtherFoodAges256(w,g);
 const env=groupAnimalEnvironment256(w,g);advanceCaravanAnimalBiology256(w,g,{...env,random:()=>healthRandom(w),clinicalRest,originForInventory:id=>g.animalOwners?.origins.find(o=>o.pawnId===id)??g.reorganization?.memberOrigins.find(o=>o.pawnId===id),retire:(a,o)=>retireCaravanAnimal256(w,g,a,o)});
}
export function advanceGroupAnimalMeters256(g:AwayGroup,coreTick:number,marks:GroupRestMarks256):void {for(const a of g.animalOwners?.members??[])if(a.ageTicks>0)advanceCaravanAnimalNeed150256(a,coreTick,marks.effectiveness(a.id,coreTick,a));}
/** Legacy humans keep their old cadence even after a real animal transfer. */
export function advanceLegacyAnimalInterval256(w:World,g:AwayGroup,coreTick:number,deltaCore:number,carried:ReadonlySet<number>,marks:GroupRestMarks256):void {
 const moving=g.phase==='travelling'&&!g.paused&&g.stop===null,env=groupAnimalEnvironment256(w,g,coreTick);for(const p of groupPhysicalPawns256(g))if('species'in p){if(p.ageTicks===0)continue;if(!moving||carried.has(p.id))marks.mark(p,coreTick,.8);satisfyCaravanAnimalFood256(w,g,p,{...env,random:()=>healthRandom(w)});}
 advanceGroupCare(g,{tick:w.tick,core256:{tick:coreTick,delta:deltaCore},onlyAnimals256:true,random:()=>healthRandom(w),schemaVersion:w.schemaVersion});
}

export function adoptCaravanOtherFoodClimate256(w:World,g:AwayGroup):void {
 const rate=groupProvisionClimateRate(w,g);for(const p of g.items)if(p.owner.type==='inventory'&&isPerishable(p.item)&&p.item!=='pemmican'&&!GROUP_FORAGED_ITEMS_256.includes(p.item as typeof GROUP_FORAGED_ITEMS_256[number]))p.rot={progress:rotAge(p,w.tick),atTick:w.tick,...rate!==1?{rate}:{}};
}
