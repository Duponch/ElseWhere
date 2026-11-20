import { clearShotSegment,type ShotGrid } from './combat-space.ts';
import { STRUCTURE_SHOT_FILL } from './combat-content.ts';
import { footprintCells } from './definitions.ts';
import { captureStructureNavigation,structureMembershipToken,structuresOfKind } from './structure-navigation.ts';
import { terrainWriteCount } from './terrain-mutation-journal.ts';
import type { Cell,Structure,Tile,World } from './types.ts';

/** Schema 355: Core RimWorld 1.6 ToolCabinet (ThingDefs_Buildings/Buildings_Misc.xml).
 *
 * Building: 200 Steel (no stuff), WorkToBuild 1800, MaxHitPoints 100, Mass 20,
 * Flammability 0.5, size 2 x 1 rotatable, PassThroughOnly, pathCost 42,
 * fillPercent 0.5, constructionSkillPrerequisite 4, research ComplexFurniture,
 * minifiable, Architect category Misc, no Beauty stat.
 *
 * CompProperties_Facility: statOffsets WorkTableWorkSpeedFactor +0.06,
 * maxSimultaneous 2 (a bench links at most two cabinets; a cabinet serves any
 * number of benches), default maxDistance 8 between the TrueCenters (3D, so the
 * altitude layer counts), minDistance 0, requiresLOS true (GenSight between any
 * cell of the two footprints, blocked by Fillage.Full edifices that are not
 * open doors), not adjacency-bound. CompAffectedByFacilities keeps the nearest
 * ones (distance, then Position.x, then Position.z): a closer cabinet supplants
 * the farthest, a despawn or a changed line-of-sight blocker relinks everything.
 *
 * Benches listing ToolCabinet in CompProperties_AffectedByFacilities
 * (Buildings_Production.xml): CraftingSpot, ButcherSpot, TableSculpting,
 * TableButcher, HandTailoringBench, ElectricTailoringBench, FueledSmithy,
 * ElectricSmithy, TableMachining, TableStonecutter, DrugLab, FabricationBench.
 * Stoves, brewery, smelter, refinery, crematorium and research benches do not.
 *
 * StatWorker: base, + comp offsets (facilities), then the StatParts (unpowered,
 * room role, temperature, outdoors) multiply. */
export const TOOL_CABINET_SCHEMA_355=355 as const;
export const isToolCabinetSchema355=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=TOOL_CABINET_SCHEMA_355;
export const TOOL_CABINET_FACTS_355=Object.freeze({
  defId:'ToolCabinet',label:'Armoire à outils',steel:200,coreWork:1800,work:180,constructionSkill:4,
  maxHitPoints:100,massGrams:20000,flammability:.5,fillPercent:.5,pathCost:42,beauty:0,marketValue:200*1.9+1800*.0036,
  workSpeedOffset:.06,maxSimultaneous:2,maxDistance:8,
} as const);
export const TOOL_CABINET_BENCHES_355=Object.freeze(['crafting-spot','butcher-spot','art-bench','butcher-table','tailor-bench','electric-tailor-bench','fueled-smithy','electric-smithy','machining-table','stonecutter','drug-lab','fabrication-bench'] as const);
export type ToolCabinetBench355=typeof TOOL_CABINET_BENCHES_355[number];
const BENCHES=new Set<string>(TOOL_CABINET_BENCHES_355);
export const isToolCabinetBench355=(kind:unknown):kind is ToolCabinetBench355=>typeof kind==='string'&&BENCHES.has(kind);

/* Core Altitudes: AltitudeLayer index x LayerSpacing 0.36585367. The two spots
 * are FloorEmplacement (7); the benches and the cabinet are Building (15). */
const LAYER_SPACING=0.36585367;
const altitude=(kind:string):number=>(kind==='crafting-spot'||kind==='butcher-spot'?7:15)*LAYER_SPACING;
const center=(cells:readonly Cell[]):Cell=>({x:cells.reduce((n,c)=>n+c.x,0)/cells.length,z:cells.reduce((n,c)=>n+c.z,0)/cells.length});
/** Distance between the TrueCenters of a bench and a cabinet, with altitude. */
export function toolCabinetDistance355(bench:Structure,cabinet:Structure):number {
  const a=center(footprintCells(bench)),b=center(footprintCells(cabinet)),dy=altitude(bench.kind)-altitude(cabinet.kind);
  return Math.sqrt((a.x-b.x)**2+(a.z-b.z)**2+dy*dy);
}

const NONE:readonly Structure[]=Object.freeze([]);
interface LinkCache {readonly tiles:readonly Tile[];readonly writes:number;readonly width:number;readonly height:number;readonly links:Map<number,readonly Structure[]>}
/* Derived, never saved. Keyed by the shared structure membership token (same
 * members, order, kinds and footprints) and checked against the exact terrain
 * write count of the same Tile[] (rock mined or collapsed): links follow every
 * building or blocker change and are not recomputed per tick otherwise. Doors
 * always count as closed: Core only relinks when a blocker spawns or despawns. */
const caches=new WeakMap<object,LinkCache>();
function cacheFor(world:World):LinkCache {
  const token=structureMembershipToken(world),writes=terrainWriteCount(world.tiles);
  let cache=caches.get(token);
  if(!cache||cache.tiles!==world.tiles||cache.writes!==writes||cache.width!==world.width||cache.height!==world.height){
    cache={tiles:world.tiles,writes,width:world.width,height:world.height,links:new Map()};caches.set(token,cache);
  }
  return cache;
}
function inSight(world:World,from:readonly Cell[],to:readonly Cell[]):boolean {
  const width=world.width,excluded=new Set([...from,...to].map(c=>c.z*width+c.x)),geometry=captureStructureNavigation(world);
  const grid:ShotGrid={width,height:world.height,coverAt:()=>undefined,blocksSight:(x,z)=>{
    const i=z*width+x;if(excluded.has(i))return false;
    const tile=world.tiles[i];if(tile?.terrain==='rock'||tile?.collapsedRock)return true;
    return geometry.at({x,z}).some(s=>STRUCTURE_SHOT_FILL[s.kind]>.99);
  }};
  return from.some(a=>to.some(b=>clearShotSegment(grid,a,b)));
}
function computeLinks(world:World,bench:Structure,cabinets:readonly Structure[]):readonly Structure[] {
  const benchCells=footprintCells(bench),candidates:{cabinet:Structure;distance:number}[]=[];
  for(const cabinet of cabinets){
    const distance=toolCabinetDistance355(bench,cabinet);
    if(distance>TOOL_CABINET_FACTS_355.maxDistance||!inSight(world,benchCells,footprintCells(cabinet)))continue;
    candidates.push({cabinet,distance});
  }
  if(!candidates.length)return NONE;
  candidates.sort((a,b)=>a.distance-b.distance||a.cabinet.x-b.cabinet.x||a.cabinet.z-b.cabinet.z||a.cabinet.id-b.cabinet.id);
  return Object.freeze(candidates.slice(0,TOOL_CABINET_FACTS_355.maxSimultaneous).map(c=>c.cabinet));
}
/** The tool cabinets a bench links (at most two), nearest first. Empty below
 * schema 355, for other structures and when the map has no cabinet. */
export function linkedToolCabinets355(world:World,bench:Structure):readonly Structure[] {
  if(!isToolCabinetSchema355(world.schemaVersion)||!isToolCabinetBench355(bench.kind))return NONE;
  const cabinets=structuresOfKind(world,'tool-cabinet');if(!cabinets.length)return NONE;
  const cache=cacheFor(world);let links=cache.links.get(bench.id);
  if(!links){links=computeLinks(world,bench,cabinets);cache.links.set(bench.id,links);}
  return links;
}
/** WorkTableWorkSpeedFactor offset of a bench: +0.06 per linked cabinet. */
export function toolCabinetWorkSpeedOffset355(world:World,bench:Structure):number {
  const count=linkedToolCabinets355(world,bench).length;
  return count?count*TOOL_CABINET_FACTS_355.workSpeedOffset:0;
}
/** The benches a cabinet serves, in structure order (inspection only). */
export function toolCabinetLinkedBenches355(world:World,cabinet:Structure):readonly Structure[] {
  if(cabinet.kind!=='tool-cabinet'||!isToolCabinetSchema355(world.schemaVersion))return NONE;
  return world.structures.filter(s=>isToolCabinetBench355(s.kind)&&linkedToolCabinets355(world,s).includes(cabinet));
}
/** Footprint centers of every link to draw for a selected cabinet or bench. */
export function toolCabinetLinkSegments355(world:World,selected:Structure):readonly (readonly [Cell,Cell])[] {
  const pairs=selected.kind==='tool-cabinet'?toolCabinetLinkedBenches355(world,selected).map(bench=>[bench,selected] as const)
    :linkedToolCabinets355(world,selected).map(cabinet=>[selected,cabinet] as const);
  return pairs.map(([a,b])=>[center(footprintCells(a)),center(footprintCells(b))] as const);
}
