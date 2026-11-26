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
  readonly byCell:StructurePages;
  readonly anchorPages:StructurePages;
  /** Lazily built: structures per kind (source order). */
  byKind?:Map<Structure['kind'],Structure[]>;
  /** Lazily built filtered views, keyed by caller-chosen names. */
  filtered?:Map<string,readonly Structure[]>;
  filteredEntries?:Map<string,readonly StructureNavigationFootprint[]>;
  filterPredicates?:Map<string,(s:Structure)=>boolean>;
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
type StructurePages=((Structure[]|undefined)[]|undefined)[];

function assembleIndex(source:readonly Structure[],width:number,height:number,entries:readonly StructureNavigationFootprint[],byCell:StructurePages,anchorPages:StructurePages,corners:ReadonlySet<number>,roomDoors:readonly Structure[]):SharedStructureIndex {
  const geometry:StructureNavigationGeometry={entries,corners,roomDoors,at:cell=>Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<width&&cell.z<height
    ?byCell[(cell.z*width+cell.x)>>>8]?.[(cell.z*width+cell.x)&255]??EMPTY_STRUCTURES:EMPTY_STRUCTURES};
  const anchors:StructureAnchorIndex={anchoredAt:(x,z)=>x>=0&&z>=0&&x<width&&z<height&&Number.isInteger(x)&&Number.isInteger(z)?anchorPages[(z*width+x)>>>8]?.[(z*width+x)&255]??EMPTY_STRUCTURES:EMPTY_STRUCTURES};
  return {count:source.length,first:source[0],last:source[source.length-1],width,height,geometry,anchors,byCell,anchorPages};
}

function buildIndex(world:World):SharedStructureIndex {
  const width=world.width,height=world.height,size=width*height,source=world.structures,byCell:((Structure[]|undefined)[]|undefined)[]=new Array(Math.ceil(size/256)),corners=new Set<number>(),roomDoors:Structure[]=[];
  const entries:StructureNavigationFootprint[]=[],anchors:((Structure[]|undefined)[]|undefined)[]=new Array(Math.ceil(size/256));
  const add=(pages:typeof byCell,index:number,structure:Structure)=>{
    if(!Number.isInteger(index)||index<0||index>=size)return;
    const page=pages[index>>>8]??=new Array(256),offset=index&255,list=page[offset];
    if(list)list.push(structure);else page[offset]=[structure];
  };
  for(const structure of source){
    const cells=footprintCells(structure).map(cell=>cell.z*width+cell.x);
    entries.push({structure,cells});
    // Preserve source order: physical travel selects the last non-conduit
    // object on the destination, while repeat suppression sees every source.
    for(const index of cells)add(byCell,index,structure);
    if(isPassageDoor(structure.kind))corners.add(structure.z*width+structure.x);
    if(isRoomDoor(structure.kind))roomDoors.push(structure);
    if(Number.isInteger(structure.x)&&Number.isInteger(structure.z)){
      add(anchors,structure.z*width+structure.x,structure);
    }
  }
  return assembleIndex(source,width,height,entries,byCell,anchors,corners,roomDoors);
}
const nativeStructurePush=Array.prototype.push;
/** Actual construction/spawn append. Advance the existing immutable geometry
 * by copying only touched pages/cell lists and appending its new footprints.
 * Earlier captures remain valid snapshots; mutable door/component objects
 * remain live originals. An unknown array/membership always takes a cold read. */
export function appendStructureEntries(world:World,...items:Structure[]):number {
  const source=world.structures,index=peekStructureMembershipToken(world) as SharedStructureIndex|undefined;
  if(!index||source.push!==nativeStructurePush||Object.getPrototypeOf(source)!==Array.prototype)return source.push(...items);
  // Invalidate before native push: a failed/partially completed exotic write
  // cannot leave a certified old geometry attached to a changed collection.
  sharedIndexes.delete(source);
  const count=source.push(...items);if(!items.length){sharedIndexes.set(source,index);return count;}
  const byCell=index.byCell.slice(),anchors=index.anchorPages.slice(),entries=index.geometry.entries.slice();
  let corners=index.geometry.corners,roomDoors=index.geometry.roomDoors;
  const changedCells=new Set<number>(),changedAnchors=new Set<number>();
  const add=(pages:StructurePages,touched:Set<number>,i:number,s:Structure)=>{
    if(!Number.isInteger(i)||i<0||i>=world.width*world.height)return;
    const p=i>>>8,o=i&255;
    if(!touched.has(p)){pages[p]=pages[p]?.slice()??new Array(256);touched.add(p);}
    const page=pages[p]!,previous=page[o];page[o]=previous?[...previous,s]:[s];
  };
  for(const structure of items){
    const cells=footprintCells(structure).map(cell=>cell.z*world.width+cell.x);entries.push({structure,cells});
    for(const i of cells)add(byCell,changedCells,i,structure);
    if(Number.isInteger(structure.x)&&Number.isInteger(structure.z))add(anchors,changedAnchors,structure.z*world.width+structure.x,structure);
    if(isPassageDoor(structure.kind)){if(corners===index.geometry.corners)corners=new Set(corners);(corners as Set<number>).add(structure.z*world.width+structure.x);}
    if(isRoomDoor(structure.kind))roomDoors=[...roomDoors,structure];
  }
  const next=assembleIndex(source,world.width,world.height,entries,byCell,anchors,corners,roomDoors);
  // The filtered families have immutable predicates and retain source order.
  // Extend the families that already exist; later readers still build unused
  // families lazily. Never mutate a list held by an older capture.
  if(index.byKind){
    next.byKind=new Map(index.byKind);
    for(const s of items)next.byKind.set(s.kind,[...(next.byKind.get(s.kind)??[]),s]);
  }
  if(index.filterPredicates){
    next.filterPredicates=index.filterPredicates;
    if(index.filtered){next.filtered=new Map(index.filtered);for(const [name,list] of index.filtered){const added=items.filter(index.filterPredicates.get(name)!);next.filtered.set(name,added.length?[...list,...added]:list);}}
    if(index.filteredEntries){const addedEntries=entries.slice(index.count);next.filteredEntries=new Map(index.filteredEntries);for(const [name,list] of index.filteredEntries){const keep=index.filterPredicates.get(name)!,added=addedEntries.filter(e=>keep(e.structure));next.filteredEntries.set(name,added.length?[...list,...added]:list);}}
  }
  sharedIndexes.set(source,next);
  return count;
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
/** The same token when the shared index already exists for this exact array
 * (same validation), without building it. A caller that only needs the token
 * to skip a cheaper scan uses this: a structures array seen once (a published
 * World on the main thread) then costs that scan, not a full index build. */
export function peekStructureMembershipToken(world:World):object|undefined {
  const source=world.structures,index=sharedIndexes.get(source);
  return index&&index.count===source.length&&index.first===source[0]&&index.last===source[source.length-1]&&index.width===world.width&&index.height===world.height?index:undefined;
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
/** `world.structures.filter(keep)` in source order, cached per membership.
 * `keep` must only read immutable structure facts (kind, position…) and must
 * be the same predicate for a given `name`. */
export function filteredStructures(world:World,name:string,keep:(s:Structure)=>boolean):readonly Structure[] {
  const index=sharedIndex(world);const map=index.filtered??=new Map();
  let list=map.get(name);if(!list){list=world.structures.filter(keep);map.set(name,list);(index.filterPredicates??=new Map()).set(name,keep);}
  return list;
}
/** Footprint entries (structure + cells) of `filteredStructures`, source order. */
export function filteredStructureEntries(world:World,name:string,keep:(s:Structure)=>boolean):readonly StructureNavigationFootprint[] {
  const index=sharedIndex(world);const map=index.filteredEntries??=new Map();
  let list=map.get(name);if(!list){list=index.geometry.entries.filter(entry=>keep(entry.structure));map.set(name,list);(index.filterPredicates??=new Map()).set(name,keep);}
  return list;
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
