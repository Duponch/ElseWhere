import { footprintCells } from './definitions.ts';
import { isPassageDoor,isRoomDoor } from './door-rules.ts';
import type { Cell,Structure,World } from './types.ts';

export interface StructureNavigationFootprint {
  readonly structure:Structure;
  readonly cells:readonly number[];
}
/** Geometry membership only. Door, trap and other mutable facts remain on the
 * original objects and are read by each decision, never frozen into this index.
 * The owner discards this capture after a footprint or membership commit,
 * before a later decision can read the changed geometry. */
export interface StructureNavigationGeometry {
  readonly entries:readonly StructureNavigationFootprint[];
  readonly corners:ReadonlySet<number>;
  readonly roomDoors:readonly Structure[];
  at(cell:Cell):readonly Structure[];
}
const EMPTY_STRUCTURES:readonly Structure[]=Object.freeze([]);

/** Structures whose ANCHOR (x,z) is a given cell, in source array order. */
export interface StructureAnchorIndex {
  anchoredAt(x:number,z:number):readonly Structure[];
}
interface SharedStructureIndex {
  readonly count:number;
  readonly first:Structure|undefined;
  readonly last:Structure|undefined;
  readonly width:number;
  readonly height:number;
  readonly geometry:StructureNavigationGeometry;
  readonly anchors:StructureAnchorIndex;
  /** Lazily built: structures per kind (source order). */
  byKind?:Map<Structure['kind'],Structure[]>;
}
/* Shared, cross-tick membership index keyed by the structures ARRAY itself.
 *
 * Validity contract (verified against every mutation site in src/sim):
 *  - structure kind/x/z/orientation/footprint are never mutated in place;
 *  - array elements are never replaced by index assignment;
 *  - in-place membership changes only use push/splice (length and/or the
 *    first/last element change), every other change replaces the array.
 * Any push+splice sequence that keeps the length leaves a NEW object as the
 * last element (or reorders it), so (identity,length,first,last) detects every
 * membership/order change. Mutable facts (doors, traps, power…) are still read
 * live from the original objects, exactly like the per-decision capture. */
const sharedIndexes=new WeakMap<readonly Structure[],SharedStructureIndex>();

function buildIndex(world:World):SharedStructureIndex {
  const width=world.width,height=world.height,source=world.structures,byCell=new Map<number,Structure[]>(),corners=new Set<number>(),roomDoors:Structure[]=[];
  const entries:StructureNavigationFootprint[]=[],anchors=new Map<number,Structure[]>();
  for(const structure of source){
    const cells=footprintCells(structure).map(cell=>cell.z*width+cell.x);
    entries.push({structure,cells});
    // Preserve source order: physical travel selects the last non-conduit
    // object on the destination, while repeat suppression sees every source.
    for(const index of cells){const list=byCell.get(index);if(list)list.push(structure);else byCell.set(index,[structure]);}
    if(isPassageDoor(structure.kind))corners.add(structure.z*width+structure.x);
    if(isRoomDoor(structure.kind))roomDoors.push(structure);
    if(Number.isInteger(structure.x)&&Number.isInteger(structure.z)){
      const key=structure.z*width+structure.x,list=anchors.get(key);if(list)list.push(structure);else anchors.set(key,[structure]);
    }
  }
  const geometry:StructureNavigationGeometry={entries,corners,roomDoors,at:cell=>Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<width&&cell.z<height
    ?byCell.get(cell.z*width+cell.x)??EMPTY_STRUCTURES:EMPTY_STRUCTURES};
  const anchorIndex:StructureAnchorIndex={anchoredAt:(x,z)=>x>=0&&z>=0&&x<width&&z<height&&Number.isInteger(x)&&Number.isInteger(z)?anchors.get(z*width+x)??EMPTY_STRUCTURES:EMPTY_STRUCTURES};
  return {count:source.length,first:source[0],last:source[source.length-1],width,height,geometry,anchors:anchorIndex};
}
function sharedIndex(world:World):SharedStructureIndex {
  const source=world.structures;let index=sharedIndexes.get(source);
  if(!index||index.count!==source.length||index.first!==source[0]||index.last!==source[source.length-1]||index.width!==world.width||index.height!==world.height){
    index=buildIndex(world);sharedIndexes.set(source,index);
  }
  return index;
}

export function captureStructureNavigation(world:World):StructureNavigationGeometry {
  return sharedIndex(world).geometry;
}
/** Identity token of the current shared index: unchanged token means the
 * structures array has exactly the same members, order and (immutable)
 * kind/position/orientation as when the token was last observed. */
export function structureMembershipToken(world:World):object {
  return sharedIndex(world);
}
/** Same result as `world.structures.find(s=>s.id===id)` (ids are immutable;
 * the first structure wins if an invalid world repeats an id). */
const idIndexes=new WeakMap<readonly Structure[],{count:number;first:Structure|undefined;last:Structure|undefined;map:Map<unknown,Structure>}>();
export function structureById(world:{readonly structures:readonly Structure[]},id:unknown):Structure|undefined {
  const source=world.structures;let index=idIndexes.get(source);
  if(!index||index.count!==source.length||index.first!==source[0]||index.last!==source[source.length-1]){
    const map=new Map<unknown,Structure>();for(const s of source)if(!map.has(s.id))map.set(s.id,s);
    index={count:source.length,first:source[0],last:source[source.length-1],map};idIndexes.set(source,index);
  }
  return index.map.get(id);
}
const NO_STRUCTURES:readonly Structure[]=Object.freeze([]);
/** Same members and order as `world.structures.filter(s=>s.kind===kind)`. */
export function structuresOfKind(world:World,kind:Structure['kind']):readonly Structure[] {
  const index=sharedIndex(world);
  if(!index.byKind){const map=new Map<Structure['kind'],Structure[]>();for(const s of world.structures){const list=map.get(s.kind);if(list)list.push(s);else map.set(s.kind,[s]);}index.byKind=map;}
  return index.byKind.get(kind)??NO_STRUCTURES;
}
/** O(1) anchor lookup with exactly the same membership/order as scanning
 * world.structures for `s.x===x&&s.z===z`. */
export function structureAnchors(world:World):StructureAnchorIndex {
  return sharedIndex(world).anchors;
}

/** Engine-owned lifetime, reset at the existing structural commit boundaries.
 * Append/replacement checks are additional guards, not a general mutable-World
 * cache contract. No reader survives this decision phase or escapes to a save. */
export function structureNavigationReader(world:World):{read:()=>StructureNavigationGeometry;invalidate:()=>void} {
  return {
    read:()=>captureStructureNavigation(world),
    invalidate(){},
  };
}
