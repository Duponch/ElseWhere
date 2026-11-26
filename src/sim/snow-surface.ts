import {markActorMotionSource297} from './actor-motion-source-297.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {terrainHoldsSnow256} from './natural-terrain-runtime-256.ts';
import {animalBodySize} from './animal-life.ts';
import {footprintCells} from './definitions.ts';
import {STRUCTURE_SHOT_FILL} from './combat-content.ts';
import {isRoofed} from './roof-rules.ts';
import {outdoorTemperature} from './temperature.ts';
import type {ThermalLayout} from './thermal-topology.ts';
import {weatherSnowRate} from './weather.ts';
import {SnowSweepRuntime} from './snow-sweep.ts';
import {compactedSnowDepth,type SnowState} from './snow-rules.ts';
import type {World,Structure} from './types.ts';
import type {TravelSegment} from './travel-timing.ts';
interface Runtime {active:Set<number>;sweep:SnowSweepRuntime;full:Set<number>;structures:Structure[];structureCount:number;outside:number;layout?:ThermalLayout}
const runtimes=new WeakMap<World,Runtime>();
export const snowDepthAt=(w:Pick<World,'tiles'>,index:number):number=>w.tiles[index]?.snowDepth??0;
export const terrainRetainsSnow=(terrain:string,bridge=false):boolean=>terrainHoldsSnow256(terrain,bridge);
export function snowFullCells(w:Pick<World,'structures'|'width'>):Set<number>{const full=new Set<number>();for(const s of w.structures)if(STRUCTURE_SHOT_FILL[s.kind]>=1)for(const c of footprintCells(s))full.add(c.z*w.width+c.x);return full;}
/** Explicit creation path only. Historical migration never calls this. */
export type FreshSnowLandscape256=Pick<World,'tick'|'seed'|'snow'|'tiles'|'width'|'height'>&{schemaVersion:number;site?:{revision:number};climate?:{revision:number;adoptedAt:number}};
function initializeSnowAt(w:Pick<World,'tick'|'seed'|'snow'|'tiles'|'width'|'height'>,at:number):void {
 if(w.tick!==at||w.snow!==undefined||w.tiles.length!==w.width*w.height||w.tiles.some(t=>'snowDepth' in t))throw new Error('Snow requires a fresh complete landscape');
 const seed=((w.seed^0x7b74ad19)>>>0)||0x6d2b79f5;
 w.snow={revision:1,adoptedAt:at,lastTick:at,cursor:0,seed};
}
export function initializeSnowSurface(w:World):void {initializeSnowAt(w,0);}
/** Fresh prospective map only, including a camp created at its real tick.
 * No historical migration/load/catch-up enters this explicit creation path. */
export function initializeGeographicSnowSurface256(w:FreshSnowLandscape256):void {
 if(!isSchema256Or257(w.schemaVersion)||w.site?.revision!==3||w.climate?.revision!==4||w.climate.adoptedAt!==w.tick||!Number.isSafeInteger(w.tick)||w.tick<0)throw Error('Fresh geographic snow adoption requires its actual climate/tick');
 initializeSnowAt(w,w.tick);
}
function runtime(w:World):Runtime {
 let r=runtimes.get(w);if(r)return r;
 const state=w.snow;if(!state)throw new Error('Snow surface absent');
 r={structures:w.structures,structureCount:w.structures.length,outside:0,full:snowFullCells(w),active:new Set(w.tiles.flatMap((t,i)=>t.snowDepth?[i]:[]))} as Runtime;const owner=r;
 r.sweep=new SnowSweepRuntime(state,{width:w.width,height:w.height,depth:i=>snowDepthAt(w,i),writeDepth(i,v){if(v>0){w.tiles[i]!.snowDepth=v;owner.active.add(i);}else{delete w.tiles[i]!.snowDepth;owner.active.delete(i);}markTerrainCellChanged(w.tiles,i);},retains:i=>terrainRetainsSnow(w.tiles[i]!.terrain,!!w.tiles[i]!.bridge)&&!owner.full.has(i),roofed:i=>isRoofed(w,i),usesIndoorAir:i=>(owner.layout?.indices[i]??-1)>=0,temperature:i=>w.thermal?.regions[owner.layout?.indices[i]??-1]?.temperature??owner.outside,snowRate:()=>weatherSnowRate(w),changed:()=>{}});
 runtimes.set(w,r);return r;
}
export function setSnowDepth(w:World,index:number,value:number):void {if(!w.snow)return;runtime(w).sweep.set(index,value);}
/** A finished Full building removes depth at its real successful commit only. */
export function clearSnowForStructure(w:World,s:Structure):void {if(!w.snow||STRUCTURE_SHOT_FILL[s.kind]<1)return;for(const c of footprintCells(s))setSnowDepth(w,c.z*w.width+c.x,0);}
export function stepSnowSurface(w:World,layout:ThermalLayout):void {
 if(!w.snow)return;
 const r=runtime(w);
 // A dry empty surface advances only its persisted phase: no footprint or heat work.
 if(!r.active.size&&weatherSnowRate(w)<=.001){r.sweep.advance(w.snow,w.tick);return;}
 // Full footprints are stable while installed structure authority and count are.
 // Installation pushes; removal replaces the array. Coordinates of installed
 // structures never move in place in the simulation.
 if(r.structures!==w.structures||r.structureCount!==w.structures.length){r.full=snowFullCells(w);r.structures=w.structures;r.structureCount=w.structures.length;}
 r.layout=layout;r.outside=outdoorTemperature(w);r.sweep.advance(w.snow,w.tick);
}
/** The right belongs to a real autonomous edge, never to its carried mirror. */
export function finishSnowStep(w:World,a:{x:number;z:number;motion?:TravelSegment|null},bodySize=1):void {
 const m=a.motion;if(!m?.snowEntryPending||m.end>(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveLocal297(w):w.tick))return;
 delete m.snowEntryPending;markActorMotionSource297(m);if(w.snow)setSnowDepth(w,m.to.z*w.width+m.to.x,compactedSnowDepth(snowDepthAt(w,m.to.z*w.width+m.to.x),bodySize));
}
export function finishSnowSteps(w:World):void {if(!w.snow)return;for(const p of w.pawns)finishSnowStep(w,p);for(const a of w.wildlife?.animals??[])finishSnowStep(w,a,animalBodySize(a));}

export function snowyCells(w:World):ReadonlySet<number>{return w.snow?runtime(w).active:EMPTY_SNOW_CELLS;}
const EMPTY_SNOW_CELLS:ReadonlySet<number>=new Set();
