import {woodWallTouch301} from './wall-frame-kind-301.ts';
import {markActorPathCreated297} from './actor-path-source-297.ts';
import {canTouchSmoothFloor281} from './smooth-floor-281.ts';
import {isShipPartKind276} from './ship-part-content-276.ts';
import {naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import { actorObstacleWrites,actorStepAllowed,openHostileDoor } from './combat-navigation.ts';
import {registerNavigationGrid379,deriveNavigationGrid379,navigationGridCorners379,inheritNavigationBase379} from './owned-navigation-grid-379.ts';
import { doorCorners,isPassageDoor } from './door-rules.ts';
import { WeightedSearch } from './weighted-search.ts';
import { navigationAllowedArea,OUTSIDE_ALLOWED_AREA_SEARCH_COST,type AllowedAreaPolicy } from './allowed-area-state.ts';
import { canStandAt, navigationSearchCosts379,coreNavigationUnits297 } from './furniture-travel.ts';
import { jobBlocksTransit } from './construction-rules.ts';
import type { DistanceField, Reachability } from './navigation-types.ts';
export type { DistanceField, Reachability } from './navigation-types.ts';
import type { Cell, Job, World } from './types.ts';
import { footprintCells } from './definitions.ts';
import { captureStructureNavigation,type StructureNavigationGeometry } from './structure-navigation.ts';
import {captureTerrainReadCursor,readTerrainJournal,terrainWriteCount,verifyTerrainWriteCaches,type TerrainJournalCursor} from './terrain-mutation-journal.ts';
import {terrainReadScope,terrainJournalReadOwner} from './terrain-read-scope.ts';
export {withTerrainBlockedReadScope} from './terrain-read-scope.ts';

export const cellIndex = (world: World, x: number, z: number): number => z * world.width + x;
export const inBounds = (world: World, x: number, z: number): boolean =>
  Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < world.width && z < world.height;
export function workNeighbours(cell:Cell,kind?:string,diagonal=false):Cell[] {
  const {x,z}=cell,neighbours=[{x:x+0,z:z-1},{x:x+1,z:z+0},{x:x+0,z:z+1},{x:x-1,z:z+0}];
  if(diagonal||kind==='mine'||kind==='smooth-floor'||kind==='smooth-wall')neighbours.push({x:x-1,z:z-1},{x:x+1,z:z-1},{x:x+1,z:z+1},{x:x-1,z:z+1});
  return neighbours;
}
export const adjacent = (a: Cell, b: Cell): boolean => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1;

/** Only finished solids block V16 transit. Completion checks active actors/edges. */
/* Terrain walkability per tiles array. Tile objects never change `terrain` in
 * place (every terrain edit replaces the Tile object), so revalidating by
 * object identity is exact and far cheaper than reclassifying every cell. */
interface TerrainBlockedEntry {refs:(World['tiles'][number]|undefined)[];mask:Uint8Array;revision:number;scope:number;owner?:object;writes:number;cursor?:TerrainJournalCursor}
const terrainMasks=new WeakMap<readonly World['tiles'][number][],TerrainBlockedEntry>();
/** Walkability per cell, validated by Tile identity (terrain is never mutated
 * in place). `revision` counts content changes of the returned mask. */
function terrainBlockedEntry(tiles:readonly World['tiles'][number][]):{mask:Uint8Array;revision:number} {
  const n=tiles.length,scope=terrainReadScope()??-1,owner=terrainJournalReadOwner(),writes=terrainWriteCount(tiles);let cached=terrainMasks.get(tiles);
  if(!cached||cached.refs.length!==n){cached={refs:new Array(n),mask:new Uint8Array(n),revision:0,scope,owner,writes};terrainMasks.set(tiles,cached);
    for(let i=0;i<n;i++){const tile=tiles[i]!;cached.refs[i]=tile;cached.mask[i]=naturalTerrainWalkable256(tile.terrain)?0:1;}
    if(scope!==-1)cached.cursor=captureTerrainReadCursor(tiles);
    return cached;}
  const sameObservation=scope!==-1&&(cached.scope===scope||owner!==undefined&&cached.owner===owner);
  const canReuse=sameObservation&&cached.writes===writes;
  if(canReuse&&!verifyTerrainWriteCaches)return cached;
  // The first read of a call always validates every identity. Later marked
  // writes name precisely the cells that the old full scan would refresh.
  // Repeated marks are deduplicated by the journal; gaps/bulk changes fall
  // through to that scan. Verification still checks every unmarked identity.
  if(sameObservation&&cached.cursor){
    const delta=readTerrainJournal(tiles,cached.cursor);
    if(delta){
      for(const i of delta.indices)refreshTerrainCell(cached,tiles,i);
      cached.cursor=delta.cursor;cached.writes=writes;cached.scope=scope;cached.owner=owner;
      if(!verifyTerrainWriteCaches)return cached;
      // Only the marked identities were admitted: any other replacement is
      // an invalid writer, even when another cell was marked in this call.
      for(let i=0;i<n;i++)if(cached.refs[i]!==tiles[i])throw Error('Unmarked terrain replacement within the blocked-grid simulation scope');
      return cached;
    }
  }
  const refs=cached.refs,mask=cached.mask;
  // Identity comparison of every cell, eight at a time (a memory-bound loop:
  // fewer branches); a block with a difference is redone cell by cell, in
  // index order, exactly as the plain loop.
  let i=0;
  for(;i+7<n;i+=8){
    if(refs[i]===tiles[i]&&refs[i+1]===tiles[i+1]&&refs[i+2]===tiles[i+2]&&refs[i+3]===tiles[i+3]&&refs[i+4]===tiles[i+4]&&refs[i+5]===tiles[i+5]&&refs[i+6]===tiles[i+6]&&refs[i+7]===tiles[i+7])continue;
    if(canReuse)throw Error('Unmarked terrain replacement within the blocked-grid simulation scope');
    for(let k=i;k<i+8;k++)refreshTerrainCell(cached,tiles,k);
  }
  for(;i<n;i++){
    if(canReuse&&refs[i]!==tiles[i])throw Error('Unmarked terrain replacement within the blocked-grid simulation scope');
    refreshTerrainCell(cached,tiles,i);
  }
  cached.scope=scope;cached.owner=owner;cached.writes=writes;
  cached.cursor=scope===-1?undefined:captureTerrainReadCursor(tiles);
  return cached;
}
function refreshTerrainCell(cached:{refs:(World['tiles'][number]|undefined)[];mask:Uint8Array;revision:number},tiles:readonly World['tiles'][number][],i:number):void {
  const tile=tiles[i]!;if(cached.refs[i]===tile)return;
  cached.refs[i]=tile;const value=naturalTerrainWalkable256(tile.terrain)?0:1;if(cached.mask[i]!==value){cached.mask[i]=value;cached.revision++;}
}
export function terrainBlockedMask(tiles:readonly World['tiles'][number][]):Uint8Array {return terrainBlockedEntry(tiles).mask;}
/** The shared walkability mask with its content revision as of its last
 * validation (terrainBlockedMask), without validating it again: for a caller
 * that has just read the mask and replaces no tile meanwhile. */
export function terrainBlockedLastState(tiles:readonly World['tiles'][number][]):{readonly mask:Uint8Array;readonly revision:number}|undefined {return terrainMasks.get(tiles);}
const isSolidBlocker=(kind:World['structures'][number]['kind'],legacy:boolean):boolean=>kind==='wall'||kind==='cooler'||kind==='vent'||kind==='electric-crematorium'||isShipPartKind276(kind)||kind==='geothermal-generator'||kind==='nutrient-paste-dispenser'||legacy&&kind==='table';
/* Per (immutable) shared geometry: the solid structure cells (kind only) and
 * the passage doors, plus the union of the terrain mask and those cells for
 * the terrain mask revision it was built from. All writes of blockedCells set
 * 1, so the union is order independent; forbidden doors and transit jobs are
 * live facts and are still added on every call. */
interface StaticBlockingBase {mask:Uint8Array;revision:number;data:Uint8Array;corners:ReadonlySet<number>}
interface StaticBlocking {width:number;size:number;legacy:boolean;solid:Int32Array;doors:readonly World['structures'][number][];base?:StaticBlockingBase;parentBase?:StaticBlockingBase}
const staticBlocking=new WeakMap<StructureNavigationGeometry,StaticBlocking[]>();
const lastStaticBlocking=new WeakMap<World['tiles'],({owner:object;geometry:StructureNavigationGeometry;entry:StaticBlocking}|undefined)[]>();
function staticBlockingFor(world:World,geometry:StructureNavigationGeometry,legacy:boolean):StaticBlocking {
  const size=world.width*world.height;let list=staticBlocking.get(geometry);if(!list){list=[];staticBlocking.set(geometry,list);}
  const owner=terrainJournalReadOwner(),slot=legacy?1:0;let prior=owner?lastStaticBlocking.get(world.tiles)?.[slot]:undefined;if(!prior||prior.owner!==owner||prior.entry.width!==world.width||prior.entry.size!==size)prior=undefined;
  let entry=list.find(e=>e.width===world.width&&e.size===size&&e.legacy===legacy);
  if(!entry){const solid:number[]=[],doors:World['structures'][number][]=[];
    const previous=prior?.geometry.entries,count=previous?.length??0,source=geometry.entries;
    // The actual append producer retains its whole immutable geometry prefix
    // by identity. A sandbag, piece of furniture or new conduit does not
    // change the union of terrain and solid blockers at all.
    const append=!!prior&&count<=source.length&&(count===0||source[0]===previous![0]&&source[count-1]===previous![count-1]);
    for(let k=append?count:0;k<source.length;k++){const {structure,cells}=source[k]!;if(isPassageDoor(structure.kind))doors.push(structure);if(isSolidBlocker(structure.kind,legacy))for(const i of cells)solid.push(i);}
    let allSolid:Int32Array,allDoors:readonly World['structures'][number][];
    if(append){const old=prior!.entry;allSolid=solid.length?(()=>{const rows=new Int32Array(old.solid.length+solid.length);rows.set(old.solid);rows.set(solid,old.solid.length);return rows;})():old.solid;allDoors=doors.length?[...old.doors,...doors]:old.doors;}
    else{allSolid=Int32Array.from(solid);allDoors=doors;}
    entry={width:world.width,size,legacy,solid:allSolid,doors:allDoors,...append&&allSolid===prior!.entry.solid?{base:prior!.entry.base}:{parentBase:prior?.entry.base}};list.push(entry);
  }
  if(owner){const rows=lastStaticBlocking.get(world.tiles)??[];rows[slot]={owner,geometry,entry};lastStaticBlocking.set(world.tiles,rows);}else lastStaticBlocking.delete(world.tiles);
  return entry;
}
export function blockedCells(world: World, physical=false,geometry?:StructureNavigationGeometry): Uint8Array {
  const version=world.schemaVersion;
  const terrain=terrainBlockedEntry(world.tiles),terrainMask=terrain.mask;
  geometry??=captureStructureNavigation(world);
  let blocked:Uint8Array,baseGrid:Uint8Array|undefined;const edited=new Set<number>();
  if(geometry){
    const fixed=staticBlockingFor(world,geometry,version<22);let base=fixed.base;
    if(!base||base.mask!==terrainMask||base.revision!==terrain.revision){
      let data:Uint8Array=new Uint8Array(fixed.size);data.set(terrainMask.length<=data.length?terrainMask:terrainMask.subarray(0,data.length));
      for(const i of fixed.solid)data[i]=1;
      const previous=base??fixed.parentBase;if(previous)data=inheritNavigationBase379(data,previous.data,world.width,world.height,geometry.corners,previous.corners);
      base=fixed.base={mask:terrainMask,revision:terrain.revision,data,corners:geometry.corners};fixed.parentBase=undefined;
    }else if(base.corners!==geometry.corners){const data=inheritNavigationBase379(base.data,base.data,world.width,world.height,geometry.corners,base.corners);base=fixed.base={...base,data,corners:geometry.corners};
    }
    baseGrid=base.data;blocked=base.data.slice();
    if(!physical)for(const structure of fixed.doors)if(structure.door?.forbidden){const i=cellIndex(world,structure.x,structure.z);blocked[i]=1;edited.add(i);}
  }else{
    blocked=new Uint8Array(world.width * world.height);
    blocked.set(terrainMask.length<=blocked.length?terrainMask:terrainMask.subarray(0,blocked.length));
    for(const structure of world.structures){
      if (!physical&&isPassageDoor(structure.kind)&&structure.door?.forbidden)blocked[cellIndex(world,structure.x,structure.z)]=1;
      if (isSolidBlocker(structure.kind,version<22))for (const cell of footprintCells(structure)) blocked[cellIndex(world, cell.x, cell.z)] = 1;
    }
  }
  // From schema 16, plans/frames never block transit. Do not scan the entire
  // current job board to answer a condition that is false for every entry.
  if(version<16)for (const job of world.jobs) {
    if (jobBlocksTransit(world,job)) for (const cell of footprintCells(job)){const i=cellIndex(world,cell.x,cell.z);blocked[i]=1;edited.add(i);}
  }
  if(baseGrid)registerNavigationGrid379(blocked,world.width,world.height,geometry!.corners,baseGrid,edited);
  return blocked;
}

export function hasReachableCell(reach:Reachability,index:number):boolean {
  return 'kind' in reach ? reach.has(index) : index>=0&&index<reach.parents.length&&reach.parents[index]!==-2&&(!reach.settled||reach.settled[index]===1);
}
export const routeCost = (world: World, path: Cell[], reach: Reachability): number => {
  const last=path.at(-1);if(!last)return 0;const index=cellIndex(world,last.x,last.z);
  return 'kind' in reach?reach.costTo(index):reach.costs[index]!;
};
const resolveField=(reach:Reachability,goals:ReadonlySet<number>):DistanceField=>'kind' in reach?reach.resolve(goals):reach;
/** Solid 3D corners require both side cells clear, including temporary traffic. */
export function canStep(world:World,from:Cell,to:Cell,blocked:Uint8Array,occupied:ReadonlySet<number>,geometry?:StructureNavigationGeometry):boolean {
  const dx=to.x-from.x,dz=to.z-from.z;
  if(!inBounds(world,to.x,to.z)||Math.max(Math.abs(dx),Math.abs(dz))!==1) return false;
  const free=(x:number,z:number)=>(!blocked[cellIndex(world,x,z)]||openHostileDoor(world,from,x,z))&&!occupied.has(cellIndex(world,x,z));
  // A caller's old route grid is not proof of current door corners. Borrow
  // the live immutable geometry, not that grid's previous capture.
  if(dx&&dz&&!geometry&&terrainJournalReadOwner())geometry=captureStructureNavigation(world);
  return actorStepAllowed(world,from,to) && free(to.x,to.z) && (!dx||!dz||(free(from.x+dx,from.z)&&free(from.x,from.z+dz)&&!(geometry
    ?geometry.corners.has(cellIndex(world,from.x+dx,from.z))||geometry.corners.has(cellIndex(world,from.x,from.z+dz))
    :world.structures.some(s=>isPassageDoor(s.kind)&&(s.x===from.x+dx&&s.z===from.z||s.x===from.x&&s.z===from.z+dz)))));
}

/** Occupy a destination cell (beds), unlike interaction from a neighbouring cell. */
export function routeToCell(world: World, target: Cell, reachable: Reachability): Cell[] | null {
  if (!inBounds(world, target.x, target.z)) return null;
  let cursor = cellIndex(world, target.x, target.z);
  if(!hasReachableCell(reachable,cursor))return null;
  if(cursor===reachable.start)return [];
  const field=resolveField(reachable,new Set([cursor]));
  const path:Cell[]=[];
  while(cursor!==field.start){path.push({x:cursor%world.width,z:Math.floor(cursor/world.width)});cursor=field.parents[cursor]!;}
  return markActorPathCreated297(path.reverse());
}

/** The cheapest of several exact stopping cells, then the shortest parent
 * chain, then the caller's candidate order. Resolve each candidate in the
 * same order as separate routeToCell calls (the weighted frontier is shared),
 * but count parent links and materialize only the selected route. */
export function routeToBestCellByCostAndLength(world:World,candidates:readonly Cell[],reachable:Reachability):Cell[]|null {
  const resolved:{index:number;field:DistanceField|null;length:number}[]=[];
  for(const cell of candidates){
    if(!inBounds(world,cell.x,cell.z))continue;
    const index=cellIndex(world,cell.x,cell.z);if(!hasReachableCell(reachable,index))continue;
    if(index===reachable.start){resolved.push({index,field:null,length:0});continue;}
    const field=resolveField(reachable,new Set([index]));let length=0;
    for(let cursor=index;cursor!==field.start;cursor=field.parents[cursor]!)length++;
    resolved.push({index,field,length});
  }
  let best:typeof resolved[number]|undefined,bestCost=Infinity;
  for(const candidate of resolved){
    const cost=candidate.length===0?0:'kind' in reachable?reachable.costTo(candidate.index):reachable.costs[candidate.index]!;
    if(!best||(cost-bestCost||candidate.length-best.length)<0){best=candidate;bestCost=cost;}
  }
  if(!best)return null;if(!best.field)return [];
  const path:Cell[]=[];
  for(let cursor=best.index;cursor!==best.field.start;cursor=best.field.parents[cursor]!)path.push({x:cursor%world.width,z:Math.floor(cursor/world.width)});
  return markActorPathCreated297(path.reverse());
}

/** Full flood by default. With goals, the map is partial beyond the first goal
 * layer and may only be used for nearest-goal selection (or that single target).
 * No reached goal means a complete flood, so remaining candidates are knowable.
 * With allGroups, finish the cheapest layer of the LAST reached group. Every
 * group must have one reachable alternative; an unreachable nonempty group
 * exhausts the component. This supports ranking all work targets exactly. */
export function reachableCells(world: World, start: Cell, blocked: Uint8Array, occupied: ReadonlySet<number>, goals?: ReadonlySet<number>, allGroups?:readonly ReadonlySet<number>[],isGoal?:(index:number)=>boolean,policy:AllowedAreaPolicy|undefined=navigationAllowedArea(world,start),geometry?:StructureNavigationGeometry): DistanceField {
  const unavailable=blocked.slice(),edited=new Set(occupied);for(const index of occupied)unavailable[index]=1;actorObstacleWrites(world,start,(index,value)=>{unavailable[index]=value;edited.add(index);});deriveNavigationGrid379(unavailable,blocked,edited);
  const {costs,repeaters,stops,floors,coreMoveCosts297}=navigationSearchCosts379(world,start,geometry);
  const additive=policy?{maximum:OUTSIDE_ALLOWED_AREA_SEARCH_COST,has:(index:number)=>!policy.has(index),get:(index:number)=>policy.has(index)?0:OUTSIDE_ALLOWED_AREA_SEARCH_COST}:undefined;
  const goal=isGoal?(index:number)=>!stops.has(index)&&isGoal(index):undefined;
  const result=new WeightedSearch(world.width,world.height,cellIndex(world,start.x,start.z),unavailable,costs,repeaters,floors,geometry?.corners??navigationGridCorners379(blocked)??doorCorners(world),coreMoveCosts297?coreNavigationUnits297(additive):additive,coreMoveCosts297).finish(goals,allGroups,goal);result.stops=stops;if(policy)result.allowedAreaPolicy=policy;return result;
}

export function routeToJob(world: World, target: Cell & { kind?: string; orientation?: 0 | 1 | 2 | 3; footprint?: 'standard' | 'legacy-single' }, reachable: Reachability, allowTarget = false,geometry?:StructureNavigationGeometry): Cell[] | null {
  const cells = target.kind ? footprintCells(target as Job) : [target];
  const candidates: Cell[] = cells.flatMap(cell => workNeighbours(cell,target.kind,woodWallTouch301(world,target))).filter(cell => (allowTarget || !cells.some(occupied => occupied.x === cell.x && occupied.z === cell.z))&&canStopAt(world,cell,reachable)&&(target.kind!=='smooth-floor'&&target.kind!=='smooth-wall'||canTouchSmoothFloor281(world,cell,target,geometry)));
  if ((allowTarget||target.kind==='smooth-floor')&&canStopAt(world,target,reachable)) candidates.unshift({ x: target.x, z: target.z });
  const goals=new Set(candidates.filter(c=>inBounds(world,c.x,c.z)).map(c=>cellIndex(world,c.x,c.z)).filter(i=>hasReachableCell(reachable,i)));
  if(!goals.size)return null;
  if(goals.has(reachable.start))return [];
  const field=resolveField(reachable,goals);
  // Every candidate's route ends at its cell, so its field cost is already
  // the value routeCost would read after reconstructing it. Keep the first
  // candidate on a tie and materialize only the winning parent chain.
  let best=-1,bestCost=Infinity;
  for (const cell of candidates) {
    if (!inBounds(world, cell.x, cell.z)) continue;
    const index=cellIndex(world,cell.x,cell.z);
    if(!hasReachableCell(field,index))continue;
    const cost=field.costs[index]!;
    if(best===-1||cost<bestCost){best=index;bestCost=cost;}
  }
  if(best===-1)return null;
  const path:Cell[]=[];
  for(let cursor=best;cursor!==field.start;cursor=field.parents[cursor]!)path.push({x:cursor%world.width,z:Math.floor(cursor/world.width)});
  return markActorPathCreated297(path.reverse());
}

export function canStopAt(world:World,cell:Cell,reach?:Reachability):boolean {
  return inBounds(world,cell.x,cell.z)&&(reach?.stops?!reach.stops.has(cellIndex(world,cell.x,cell.z)):canStandAt(world,cell));
}

/** Same interaction cells as routeToJob(..., true) for single-cell food piles. */
export function interactionGoals(world: World, cells: Cell[], kind?:string,geometry?:StructureNavigationGeometry,touchTarget?:object): Set<number> {
  const goals = new Set<number>();
  for (const cell of cells) {
    const index = cellIndex(world, cell.x, cell.z); goals.add(index);
    if (cell.z > 0) goals.add(index - world.width);
    if (cell.x + 1 < world.width) goals.add(index + 1);
    if (cell.z + 1 < world.height) goals.add(index + world.width);
    if (cell.x > 0) goals.add(index - 1);
  }
  const wallTouch=!!touchTarget&&woodWallTouch301(world,touchTarget);
  if(kind==='mine'||kind==='smooth-floor'||kind==='smooth-wall'||wallTouch)for(const c of cells)for(const n of workNeighbours(c,kind,wallTouch))if(inBounds(world,n.x,n.z))goals.add(cellIndex(world,n.x,n.z));
  for(const i of goals)if(!canStandAt(world,{x:i%world.width,z:Math.floor(i/world.width)},geometry)||(kind==='smooth-floor'||kind==='smooth-wall')&&!cells.some(c=>canTouchSmoothFloor281(world,{x:i%world.width,z:Math.floor(i/world.width)},c,geometry)))goals.delete(i);
  return goals;
}
