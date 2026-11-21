import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import type {ItemId} from './items.ts';
import type {PackedFurniture} from './furniture-rules.ts';
/** Verified Core4871 numeric facts for existing playable goods only. Historical
 * caravan and commercial contracts do not acquire these admissions implicitly. */
const GOODS:Readonly<Partial<Record<ItemId,number>>>=Object.freeze({
 'advanced-component':600,gold:8,plasteel:250,'light-leather':30,plainleather:30,bluefur:30,camelhide:30,foxfur:30,
 'granite-blocks':1250,'limestone-blocks':1100,'marble-blocks':1250,'sandstone-blocks':1000,'slate-blocks':900,
 'granite-chunk':25000,'limestone-chunk':22000,'marble-chunk':25000,'sandstone-chunk':20000,'slate-chunk':18000,
});
export const additionalGroupFreightMass258=(item:ItemId,version:number):number|undefined=>version>=258?GOODS[item]:undefined;
const PACKS:Readonly<Partial<Record<PackedFurniture['building']['kind'],number>>>=Object.freeze({
 'glow-pod':4000,urn:5000,shelf:8000,'small-shelf':4000,'spike-trap':2500,'electric-smelter':20000,
 'orbital-beacon':5000,'deep-drill':35000,'vitals-monitor':20000,'drug-lab':20000,'tube-television':14000,
 'art-bench':20000,'hi-tech-research-bench':20000,'multi-analyzer':60000,'fabrication-bench':20000,
 'small-sculpture':3000,'large-sculpture':7000,'machining-table':20000,heater:6000,battery:20000,
 'fueled-stove':20000,'electric-stove':20000,'butcher-table':20000,'research-bench':20000,
 'tailor-bench':20000,'electric-tailor-bench':20000,bedroll:2500,bed:30000,'double-bed':50000,
 'hospital-bed':35000,table:5000,'table-square':10000,'table-long':20000,stool:3000,'dining-chair':5000,
 armchair:35000,'end-table':5000,dresser:15000,'flower-pot':2000,horseshoes:3000,'chess-table':5000,
 'hoopstone-ring':4000,'billiards-table':60000,'game-of-ur-board':2000,'poker-table':30000,
 stonecutter:20000,'standing-lamp':4000,'sun-lamp':4500,
});
/** The original inner building supplies mass. No wrapper/quality/HP multiplier. */
export function groupPackedMassGrams258(pack:PackedFurniture,version:number):number|undefined {
 if(pack.building.kind==='firefoam-popper')return (version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))?10000:undefined;
 if(pack.building.kind==='fueled-smithy'||pack.building.kind==='electric-smithy')return version>=267?20000:undefined;
 if(pack.building.kind==='tool-cabinet')return version>=355?20000:undefined;
 // Schema 357 TrapIEDBase Mass 2.
 if(pack.building.kind==='ied-high-explosive'||pack.building.kind==='ied-incendiary')return version>=357?2000:undefined;
 if(pack.building.kind==='brewery'||pack.building.kind==='fermenting-barrel')return version>=265?(pack.building.kind==='brewery'?20000:10000):undefined;
 return version>=258?PACKS[pack.building.kind]:version>=256&&pack.building.kind==='bedroll'?2500:undefined;
}
