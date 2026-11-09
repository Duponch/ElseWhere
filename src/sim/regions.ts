import type { World } from './types.ts';
import { isPassageDoor } from './door-rules.ts';
import { filteredStructures } from './structure-navigation.ts';

/**
 * Regions, after RimWorld's RegionMaker (Core 1.6): the passable cells of a
 * navigation grid are cut into 12 × 12 blocks aligned on multiples of 12;
 * inside a block, a region is a 4-connected set of passable cells, and every
 * door is a region of its own (a portal) so that its passability can depend on
 * the actor. Regions touching across a block edge or a door are linked.
 *
 * Connectivity over regions is exactly the 4-neighbour connectivity of the
 * grid's cells: two passable cells are 4-adjacent either inside one region or
 * across a link. A reachability question therefore becomes a lookup in a
 * labelling of the region graph, instead of a flood over the cells.
 *
 * Ids are assigned block by block (rows of blocks, then rows of cells), and a
 * region's links are sorted by id: the graph only depends on the grid, never
 * on the order of earlier rebuilds, so a reloaded game sees the same regions.
 */
export const REGION_SIZE=12;

export interface RegionMap {
  readonly width:number;
  readonly height:number;
  /** Region of each cell, -1 for an impassable cell. */
  readonly regionOf:Int32Array;
  readonly count:number;
  /** Door cell of a portal region, -1 for an ordinary region. */
  readonly doorCell:Int32Array;
  /** Portal regions, ascending. */
  readonly portals:Int32Array;
  /** Links of region r: links[linkStart[r] .. linkStart[r+1]), ascending. */
  readonly linkStart:Int32Array;
  readonly links:Int32Array;
  /** The grid the regions were built from (a private copy). */
  readonly grid:Uint8Array;
}

/** Builds the regions of a grid (1 = impassable). Door cells are always
 * regions; whether an actor may enter them is decided per query. */
export function buildRegionMap(width:number,height:number,grid:Uint8Array,doorCells:Iterable<number>):RegionMap {
  const size=width*height,regionOf=new Int32Array(size).fill(-1),isDoor=new Uint8Array(size);
  for(const cell of doorCells)if(cell>=0&&cell<size)isDoor[cell]=1;
  const doorCell:number[]=[],portals:number[]=[],stack=new Int32Array(REGION_SIZE*REGION_SIZE);
  for(let tz=0;tz<height;tz+=REGION_SIZE)for(let tx=0;tx<width;tx+=REGION_SIZE){
    const maxX=Math.min(tx+REGION_SIZE,width)-1,maxZ=Math.min(tz+REGION_SIZE,height)-1;
    for(let z=tz;z<=maxZ;z++)for(let x=tx;x<=maxX;x++){
      const root=z*width+x;if(regionOf[root]!==-1)continue;
      if(isDoor[root]){const r=doorCell.length;regionOf[root]=r;doorCell.push(root);portals.push(r);continue;}
      if(grid[root])continue;
      const r=doorCell.length;doorCell.push(-1);
      let top=0;stack[top++]=root;regionOf[root]=r;
      while(top){
        const i=stack[--top]!,cx=i%width,cz=(i-cx)/width;
        if(cz>tz){const n=i-width;if(regionOf[n]===-1&&!isDoor[n]&&!grid[n]){regionOf[n]=r;stack[top++]=n;}}
        if(cx<maxX){const n=i+1;if(regionOf[n]===-1&&!isDoor[n]&&!grid[n]){regionOf[n]=r;stack[top++]=n;}}
        if(cz<maxZ){const n=i+width;if(regionOf[n]===-1&&!isDoor[n]&&!grid[n]){regionOf[n]=r;stack[top++]=n;}}
        if(cx>tx){const n=i-1;if(regionOf[n]===-1&&!isDoor[n]&&!grid[n]){regionOf[n]=r;stack[top++]=n;}}
      }
    }
  }
  const count=doorCell.length,adjacent:number[][]=Array.from({length:count},()=>[]);
  for(let i=0;i<size;i++){
    const r=regionOf[i]!;if(r<0)continue;
    if((i+1)%width!==0){const s=regionOf[i+1]!;if(s>=0&&s!==r){adjacent[r]!.push(s);adjacent[s]!.push(r);}}
    if(i+width<size){const s=regionOf[i+width]!;if(s>=0&&s!==r){adjacent[r]!.push(s);adjacent[s]!.push(r);}}
  }
  const linkStart=new Int32Array(count+1),flat:number[]=[];
  for(let r=0;r<count;r++){
    linkStart[r]=flat.length;
    const list=adjacent[r]!.sort((a,b)=>a-b);
    for(let k=0;k<list.length;k++)if(k===0||list[k]!==list[k-1])flat.push(list[k]!);
  }
  linkStart[count]=flat.length;
  return {width,height,regionOf,count,doorCell:Int32Array.from(doorCell),portals:Int32Array.from(portals),linkStart,links:Int32Array.from(flat),grid:grid.slice()};
}

const sameGrid=(a:Uint8Array,b:Uint8Array):boolean=>{
  if(a.length!==b.length)return false;
  if(a.byteOffset%4===0&&b.byteOffset%4===0){
    const words=a.length>>2,wa=new Uint32Array(a.buffer,a.byteOffset,words),wb=new Uint32Array(b.buffer,b.byteOffset,words);
    for(let i=0;i<words;i++)if(wa[i]!==wb[i])return false;
    for(let i=words<<2;i<a.length;i++)if(a[i]!==b[i])return false;
    return true;
  }
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
};
const sameCells=(a:Int32Array,b:readonly number[]):boolean=>{
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
};

interface CachedRegions {map:RegionMap;doors:Int32Array}
/** One region map per map (keyed by its tile array), rebuilt only when the
 * grid or the door cells actually change. */
const cache=new WeakMap<object,CachedRegions>();
/** Passage door cells in structure order. */
export function passageDoorCells(world:World):number[] {
  return filteredStructures(world,'passage-doors',s=>isPassageDoor(s.kind)).map(s=>s.z*world.width+s.x);
}
/** The regions of `grid` for this map. The grid is copied: later writes to
 * the caller's array do not change the regions. */
export function regionMapFor(world:World,grid:Uint8Array):RegionMap {
  const key=world.tiles as object,doors=passageDoorCells(world),cached=cache.get(key);
  if(cached&&cached.map.width===world.width&&cached.map.height===world.height&&sameCells(cached.doors,doors)&&sameGrid(cached.map.grid,grid))return cached.map;
  const map=buildRegionMap(world.width,world.height,grid,doors);
  cache.set(key,{map,doors:Int32Array.from(doors)});
  return map;
}

/** Labels of the connected components of the region graph, where a portal
 * is part of the graph only if `doorOpen(cell)` (its door cell). Regions
 * outside the graph are labelled -1. Cached per map and door verdicts. */
const labelCache=new WeakMap<RegionMap,Map<string,Int32Array>>();
export function regionComponents(map:RegionMap,doorOpen:(cell:number)=>boolean):Int32Array {
  let key='';for(let k=0;k<map.portals.length;k++)key+=doorOpen(map.doorCell[map.portals[k]!]!)?'1':'0';
  let byKey=labelCache.get(map);if(!byKey){byKey=new Map();labelCache.set(map,byKey);}
  let labels=byKey.get(key);if(labels)return labels;
  const count=map.count,open=new Uint8Array(count).fill(1);
  for(let k=0;k<map.portals.length;k++)if(key.charCodeAt(k)===48)open[map.portals[k]!]=0;
  labels=new Int32Array(count).fill(-1);
  const queue=new Int32Array(count);let next=0;
  for(let r=0;r<count;r++){
    if(labels[r]!==-1||!open[r])continue;
    let head=0,tail=0;queue[tail++]=r;labels[r]=next;
    while(head<tail){
      const q=queue[head++]!;
      for(let k=map.linkStart[q]!,end=map.linkStart[q+1]!;k<end;k++){const s=map.links[k]!;if(labels[s]===-1&&open[s]){labels[s]=next;queue[tail++]=s;}}
    }
    next++;
  }
  if(byKey.size>=16)byKey.clear();
  byKey.set(key,labels);
  return labels;
}

/** RimWorld's breadth-first region traversal (RegionTraverser) from the
 * region of `origin` (or, when that cell has no open region, from the open
 * regions of its four neighbours), through open regions only, links in
 * ascending order. `position` is each region's place in the processing order
 * (-1: never reached); `countedBefore` the number of non-door regions
 * processed before it, so that a search limited to N regions processes a
 * region exactly when its countedBefore is below N. */
export interface RegionTraversal {readonly position:Int32Array;readonly countedBefore:Int32Array}
export function regionTraversal(map:RegionMap,origin:number,open:(region:number)=>boolean):RegionTraversal {
  const count=map.count,position=new Int32Array(count).fill(-1),countedBefore=new Int32Array(count),queue=new Int32Array(count);
  let head=0,tail=0;
  const enqueue=(r:number)=>{if(r>=0&&position[r]===-1&&open(r)){position[r]=tail;queue[tail++]=r;}};
  const size=map.regionOf.length,own=origin>=0&&origin<size?map.regionOf[origin]!:-1;
  if(own>=0&&open(own))enqueue(own);
  else if(origin>=0&&origin<size){
    const width=map.width,x=origin%width;
    if(origin>=width)enqueue(map.regionOf[origin-width]!);if(x+1<width)enqueue(map.regionOf[origin+1]!);
    if(origin+width<size)enqueue(map.regionOf[origin+width]!);if(x>0)enqueue(map.regionOf[origin-1]!);
  }
  let counted=0;
  while(head<tail){
    const r=queue[head++]!;countedBefore[r]=counted;
    if(map.doorCell[r]!<0)counted++;
    for(let k=map.linkStart[r]!,end=map.linkStart[r+1]!;k<end;k++)enqueue(map.links[k]!);
  }
  return {position,countedBefore};
}
/** The traversal position of the first region, among those of `cells`, that
 * a search limited to `maxRegions` processes; Infinity when none is (the
 * search then falls back to the globally closest thing). */
export function regionSearchKey(map:RegionMap,traversal:RegionTraversal,cells:Iterable<number>,maxRegions:number):number {
  let best=Infinity;
  for(const cell of cells){
    if(cell<0||cell>=map.regionOf.length)continue;
    const r=map.regionOf[cell]!;if(r<0)continue;
    const at=traversal.position[r]!;if(at>=0&&at<best&&traversal.countedBefore[r]!<maxRegions)best=at;
  }
  return best;
}
