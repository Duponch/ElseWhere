import {spikeTrapKnowsOf} from './spike-trap-state.ts';
import { verifyTerrainWriteCaches } from './terrain-mutation-journal.ts';
import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {animalMoveCostCore297} from './animal-move-cost-297.ts';
import {actualAnimalProfile256,actualAnimalMoveSpeedFactor256} from './actual-animal-profile-256.ts';
import {naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import {duckTerrainWalkable256,duckTerrainOverride256} from './duck-water-256.ts';
import {duckFlightMoveFactor256} from './duck-flight-runtime-256.ts';
import {duckFlying256} from './duck-flight-state-256.ts';
import {animalCore256,animalLifeStageData256,isAnimalSpecies256} from './animal-core-v256.ts';
import {finishSnowStep} from './snow-surface.ts';
import {animalBodySize} from './animal-life.ts';
import { mergeSlowIntervals,travelEnd } from './travel-timing.ts';
import { weatherMoveFactor } from './weather-exposure.ts';
import { routeToCell,hasReachableCell,inBounds,terrainBlockedMask,terrainBlockedLastState } from './pathfinding.ts';
import { jobBlocksTransit } from './construction-rules.ts';
import { footprintCells } from './definitions.ts';
import { animalNavigationCosts,captureStandability,navigationCosts,furnitureDelay,knownSpikeTrapCosts,lazyAnimalNavigationCosts } from './furniture-travel.ts';
import { addFireNavigationCosts } from './fire-navigation.ts';
import { doorOpenness,isPassageDoor } from './door-rules.ts';
import { WeightedSearch,WeightedSearchScratch } from './weighted-search.ts';
import { scaleNavigationCosts,type NavigationCostLookup } from './navigation-costs.ts';
import {captureAnimalAreaPolicy287,type AnimalAreaPolicy287} from './animal-area-policy-287.ts';
import { meleeContact } from './melee-space.ts';
import {START_STRUCTURE_PHYSICS_256} from './player-start-physics-256.ts';
import {animalHaulDoorPassable282} from './animal-haul-door-282.ts';
import {isSchema282OrLater} from './schema-compatibility-257.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { animalSpecies } from './animal-species.ts';
import {captureStructureNavigation,type StructureNavigationGeometry,filteredStructures} from './structure-navigation.ts';
import type { Cell,World } from './types.ts';
import type {DistanceField} from './navigation-types.ts';
/** Ranked food candidates resume a single frontier. Group once rather than
 * rescanning thousands of plant contacts for every distinct food score. */
function rankedFood(world:World,cells:Cell[],search:WeightedSearch,rank:(c:Cell)=>number):Cell|undefined {
  const groups=new Map<number,Cell[]>();
  for(const cell of cells){const priority=rank(cell),group=groups.get(priority);if(group)group.push(cell);else groups.set(priority,[cell]);}
  for(const [,group] of [...groups].sort(([a],[b])=>a-b)){
    const reach=search.advance(new Set(group.map(c=>c.z*world.width+c.x)));
    const target=group.filter(c=>hasReachableCell(reach,c.z*world.width+c.x)).sort((a,b)=>reach.costs[a.z*world.width+a.x]!-reach.costs[b.z*world.width+b.x]!)[0];
    if(target)return target;
  }
}

/** Same species/flight geometry for the decision loop and cold validators.
 * The reader lives for one synchronous pass; geometry remains lazy/shared. */
/* Navigation costs of the schema 304 idle wander, computed once per local
 * tick and shared by every wandering animal of that tick: they depend on the
 * animal only through its spike-trap knowledge and, for ducks, its water
 * terrain (the key); the same geometry is required. */
const idleCostsByWorld=new WeakMap<World,{tick:number;geometry:StructureNavigationGeometry;costs:Map<string,ReturnType<typeof navigationCosts>>;scaled:Map<string,NavigationCostLookup|undefined>}>();
function idleWanderEntry(world:World,geometry:StructureNavigationGeometry) {
  let entry=idleCostsByWorld.get(world);
  if(!entry||entry.tick!==world.tick||entry.geometry!==geometry){entry={tick:world.tick,geometry,costs:new Map(),scaled:new Map()};idleCostsByWorld.set(world,entry);}
  return entry;
}
function idleWanderCosts(world:World,key:string,geometry:StructureNavigationGeometry,compute:()=>ReturnType<typeof navigationCosts>):ReturnType<typeof navigationCosts> {
  const entry=idleWanderEntry(world,geometry);
  let costs=entry.costs.get(key);if(!costs){costs=compute();entry.costs.set(key,costs);}
  return costs;
}
/* The x3 search costs of one key of the tick, each cell's value kept once
 * read: the lookup is a function of snapshots taken when the costs were built
 * (lazyAnimalNavigationCosts), so a kept value is the value read again. The
 * arrays are reused from tick to tick (a new stamp per costs object). */
interface CostMemo {stamp:Uint32Array;defined:Uint8Array;value:Float64Array;epoch:number}
const costMemos=new WeakMap<World,Map<string,CostMemo>>();
function idleScaledCosts(world:World,key:string,geometry:StructureNavigationGeometry,costs:NavigationCostLookup|undefined):NavigationCostLookup|undefined {
  const entry=idleWanderEntry(world,geometry);
  if(entry.scaled.has(key))return entry.scaled.get(key);
  const inner=scaleNavigationCosts(costs,3);let result=inner;
  if(inner){
    const size=world.width*world.height;let memos=costMemos.get(world);if(!memos){memos=new Map();costMemos.set(world,memos);}
    let memo=memos.get(key);if(!memo||memo.stamp.length!==size){memo={stamp:new Uint32Array(size),defined:new Uint8Array(size),value:new Float64Array(size),epoch:0};memos.set(key,memo);}
    if(memo.epoch>=0xfffffffe){memo.stamp.fill(0);memo.epoch=0;}
    const epoch=++memo.epoch,{stamp,defined,value}=memo;
    result={get(i){
      if(!(i>=0&&i<size))return inner.get(i);
      if(stamp[i]===epoch)return defined[i]?value[i]:undefined;
      const v=inner.get(i);stamp[i]=epoch;if(v===undefined)defined[i]=0;else{defined[i]=1;value[i]=v;}return v;
    },has:i=>inner.has(i),maximum:inner.maximum};
  }
  entry.scaled.set(key,result);return result;
}
/* One reusable search scratch per world for the idle wander searches, which
 * end with their decision (release). A search started while it is held gets
 * fresh arrays. */
const idleScratches=new WeakMap<World,WeightedSearchScratch>();
function idleScratch(world:World):WeightedSearchScratch {
  const size=world.width*world.height;let scratch=idleScratches.get(world);
  if(!scratch||scratch.size!==size){scratch=new WeightedSearchScratch(size);idleScratches.set(world,scratch);}
  return scratch;
}
/** Whether an animal walks through fences (no roamer, or a legacy hare or
 * predator): the reader kind used for its ordinary navigation. */
export function animalPassesFences(animal:WildAnimal):boolean {
  return isAnimalSpecies256(animal.species)?animalCore256(animal.species).race.roamMtbDays===null:
    animal.species==='hare'||animal.species==='snow-hare'||!!animalSpecies(animal.species).predator;
}
/** A reader for which closed doors are passable (TraverseMode.PassDoors), for
 * the path a manhunter imagines through a door it cannot open (schema 304). */
export function animalDoorPassingNavigation(world:World,animal:WildAnimal,geometry?:StructureNavigationGeometry):ReturnType<typeof animalNavigation> {
  const duck=world.schemaVersion>=256&&animal.species==='duck'?animal:undefined;
  return animalNavigation(world,true,animalPassesFences(animal),duck,false,geometry);
}
export type AnimalNavigationReader=((a:WildAnimal)=>ReturnType<typeof animalNavigation>)&{invalidate():void};
export function createAnimalNavigationReader(world:World,getGeometry?:()=>StructureNavigationGeometry,readArea:(a:WildAnimal)=>AnimalAreaPolicy287|undefined=a=>captureAnimalAreaPolicy287(world,a),physicalNow?:()=>number):AnimalNavigationReader {
  let geometry:StructureNavigationGeometry|undefined,ordinary:ReturnType<typeof animalNavigation>|undefined,unfenced:ReturnType<typeof animalNavigation>|undefined;
  const ducks=new Map<boolean,ReturnType<typeof animalNavigation>>();
  const captured=()=>geometry??=getGeometry?.()??captureStructureNavigation(world);
  // One terrain scan for all the readers of this synchronous pass (no tile is
  // replaced during it; checked against a fresh scan in verification mode).
  let terrain:Uint8Array|undefined,terrainCopy:Uint8Array|undefined;
  const terrainMask=():Uint8Array=>{
    if(!terrain){terrain=terrainBlockedMask(world.tiles);if(verifyTerrainWriteCaches)terrainCopy=terrain.slice();return terrain;}
    if(verifyTerrainWriteCaches){const fresh=terrainBlockedMask(world.tiles);if(fresh.length!==terrainCopy!.length||fresh.some((v,i)=>v!==terrainCopy![i]))throw Error('Terrain changed inside one wildlife navigation pass');}
    return terrain;
  };
  const read=(animal:WildAnimal)=>{
    if(world.schemaVersion>=256&&animal.species==='duck'){
      const flying=duckFlying256(animal.flight);let nav=ducks.get(flying);
      if(!nav){nav=animalNavigation(world,false,true,animal,false,captured(),readArea,physicalNow,terrainMask);ducks.set(flying,nav);}return nav;
    }
    const passFence=animalPassesFences(animal);
    return passFence?unfenced??=animalNavigation(world,false,true,undefined,false,captured(),readArea,physicalNow,terrainMask):ordinary??=animalNavigation(world,false,false,undefined,false,captured(),readArea,physicalNow,terrainMask);
  };
  return Object.assign(read,{invalidate(){geometry=undefined;ordinary=undefined;unfenced=undefined;ducks.clear();terrain=undefined;terrainCopy=undefined;}});
}
/** Short-lived capture: no world mutation may interleave its searches/steps. */
/** `allowClosedGate` is for planning a handler-led route only. Physical steps
 * must use the default navigation after the handler opens each passage. */
const isPassageDoorStructure=(s:World['structures'][number]):boolean=>isPassageDoor(s.kind);
/* Cells of the solid structure kinds for animals (vent, wall, cooler, fence
 * unless passable or flying, legacy tables): kinds never change, so the set is
 * fixed for a shared geometry. `mask` holds the in-map cells, `cells` every
 * index exactly as the former per-reader Set received them. */
interface AnimalStaticSolids {width:number;size:number;fence:boolean;legacy:boolean;mask:Uint8Array;cells:Int32Array;base?:{terrain:Uint8Array;revision:number;data:Uint8Array}}
/* The non-flying route grid before live doors and transit jobs: the shared
 * terrain mask (copied as the former per-reader grid received it) with the
 * in-map solid kind cells, kept while that mask's content revision holds.
 * `terrain` was just read for this pass, in which no tile is replaced. */
function animalRouteBase(world:World,solids:AnimalStaticSolids,terrain:Uint8Array):Uint8Array {
  const size=world.width*world.height,state=terrainBlockedLastState(world.tiles);
  if(!state||state.mask!==terrain){const data=new Uint8Array(size);data.set(terrain.length<=size?terrain:terrain.subarray(0,size));for(let i=0;i<size;i++)if(solids.mask[i])data[i]=1;return data;}
  let base=solids.base;
  if(!base||base.terrain!==terrain||base.revision!==state.revision){
    const data=new Uint8Array(size);data.set(terrain.length<=size?terrain:terrain.subarray(0,size));
    for(let i=0;i<size;i++)if(solids.mask[i])data[i]=1;
    base=solids.base={terrain,revision:state.revision,data};
  }
  return base.data;
}
const animalSolidsByGeometry=new WeakMap<StructureNavigationGeometry,AnimalStaticSolids[]>();
function animalStaticSolids(world:World,geometry:StructureNavigationGeometry,fence:boolean,legacy:boolean):AnimalStaticSolids {
  const size=world.width*world.height;let list=animalSolidsByGeometry.get(geometry);if(!list){list=[];animalSolidsByGeometry.set(geometry,list);}
  let entry=list.find(e=>e.width===world.width&&e.size===size&&e.fence===fence&&e.legacy===legacy);
  if(!entry){const mask=new Uint8Array(size),cells:number[]=[];
    for(const {structure:s,cells:at} of geometry.entries)if(s.kind==='vent'||s.kind==='wall'||s.kind==='cooler'||s.kind==='fence'&&fence||legacy&&s.kind==='table')for(const i of at){cells.push(i);if(i>=0&&i<size)mask[i]=1;}
    entry={width:world.width,size,fence,legacy,mask,cells:Int32Array.from(cells)};list.push(entry);}
  return entry;
}
export function animalNavigation(world:World,allowClosedGate=false,fencePassable=false,actor?:WildAnimal,capturedFlight=false,providedGeometry?:StructureNavigationGeometry,readArea:(a:WildAnimal)=>AnimalAreaPolicy287|undefined=a=>captureAnimalAreaPolicy287(world,a),physicalNow?:()=>number,terrainMask:()=>Uint8Array=()=>terrainBlockedMask(world.tiles)) {
  let failedRoute:{actor:Cell;x:number;z:number;tick:number;field:DistanceField}|undefined;
  const area=(start:Cell)=>{if(!isSchema287OrLater(Number(world.schemaVersion)))return;const original=world.wildlife?.animals.find(a=>a===start);return original?readArea(original):undefined;};
  const duck=world.schemaVersion>=256&&actor?.species==='duck'?actor:undefined,override=duck&&duckTerrainOverride256(world,duck),flying=!!duck&&(capturedFlight||duckFlying256(duck.flight));
  const terrainFree=(terrain:unknown)=>naturalTerrainWalkable256(terrain)||flying&&terrain==='water-deep';
  const geometry=providedGeometry??captureStructureNavigation(world);
  // Solid kinds come from a mask shared per (immutable) geometry; closed doors
  // and transit jobs are live and stay in a per-reader set. Same union.
  const solidKinds=animalStaticSolids(world,geometry,!fencePassable&&!flying,world.schemaVersion<22),solids=new Set<number>(),corners=geometry.corners,width=world.width;
  const solidAt=(index:number):boolean=>solidKinds.mask[index]===1||solids.has(index);
  // Fine continuation reads step/haulStep only. Preserve immediate legacy
  // capture; the physical reader pays for standability only if free is used.
  let stand=physicalNow?undefined:captureStandability(world,geometry);
  const liveDoors=physicalNow?new Map<number,World['structures']>():undefined;
  const add=(s:Parameters<typeof footprintCells>[0])=>{for(const c of footprintCells(s))solids.add(c.z*width+c.x);};
  // Only passage doors contribute below (solid kinds come from the mask); when
  // the geometry is the shared index of this world, read its cached door list
  // (same structures, same order as filtering its entries).
  const door=(s:World['structures'][number])=>{
    if(liveDoors){const index=s.z*width+s.x,row=liveDoors.get(index)??[];row.push(s);liveDoors.set(index,row);}
    else if(s.door?.forbidden||!allowClosedGate&&(!s.door?.open||doorOpenness(s,world.tick)<1-1e-9))solids.add(s.z*width+s.x);
  };
  if(geometry===captureStructureNavigation(world))for(const s of filteredStructures(world,'passage-doors',isPassageDoorStructure))door(s);
  else for(const {structure:s} of geometry.entries)if(isPassageDoor(s.kind))door(s);
  for(const j of world.jobs)if(jobBlocksTransit(world,j))add(j);
  const liveDoorBlocked=(index:number):boolean=>{
    const doors=liveDoors?.get(index);if(!doors)return false;
    const now=physicalNow!();
    return doors.some(s=>s.door?.forbidden||!allowClosedGate&&(!s.door?.open||doorOpenness(s,now)<1-1e-9));
  };
  const blockedAt=liveDoors
    ?(index:number)=>solidAt(index)||!terrainFree(world.tiles[index]?.terrain)||liveDoorBlocked(index)
    :(index:number)=>solidAt(index)||!terrainFree(world.tiles[index]?.terrain);
  const free=(c:Cell)=>inBounds(world,c.x,c.z)&&((stand??=captureStandability(world,geometry))(c)||flying&&world.tiles[c.z*width+c.x]?.terrain==='water-deep')&&!blockedAt(c.z*width+c.x);
  // Animal origins deliberately have no Pawn identity in canStep. The same
  // solid/door corner rule can use point queries without a map-sized mask.
  const step=(a:Cell,b:Cell)=>{
    const dx=b.x-a.x,dz=b.z-a.z;
    if(!inBounds(world,b.x,b.z)||Math.max(Math.abs(dx),Math.abs(dz))!==1)return false;
    const xSide=a.z*width+b.x,zSide=b.z*width+a.x;
    return !blockedAt(b.z*width+b.x)&&(!dx||!dz||!blockedAt(xSide)&&!blockedAt(zSide)&&!corners.has(xSide)&&!corners.has(zSide));
  };
  let blocked:Uint8Array|undefined;
  const routeGrid=()=>{
    if(!blocked){blocked=new Uint8Array(width*world.height);
      // Non-flying terrainFree is exactly naturalTerrainWalkable256: reuse the shared mask.
      // With the in-map solid kind cells already in the shared base.
      if(!flying)blocked.set(animalRouteBase(world,solidKinds,terrainMask()));
      else{for(let i=0;i<world.tiles.length;i++){const t=world.tiles[i]!.terrain;if(!terrainFree(t))blocked[i]=1;}
        for(const i of solidKinds.cells)blocked[i]=1;}
      for(const i of solids)blocked[i]=1;}
    // A physical reader retains geometry, never a frozen door phase. Route
    // queries refresh only the sparse door entries; point steps scan no map.
    if(liveDoors)for(const index of liveDoors.keys())blocked[index]=Number(solidAt(index)||!terrainFree(world.tiles[index]?.terrain)||liveDoorBlocked(index));
    return blocked;
  };
  // Haul uses OnCell, not Standability: a partial shelf or a chunk can be the
  // actual pickup/deposit cell. This separate sparse capture leaves all old
  // food/free/step/route behavior untouched, including their existing masks.
  let haulSolids:ReadonlySet<number>|undefined;
  const haulStaticSolids=()=>{
    if(!haulSolids){const captured=new Set<number>();
      for(const {structure:s,cells} of geometry.entries)if(START_STRUCTURE_PHYSICS_256[s.kind].passability===2)for(const i of cells)captured.add(i);
      for(const j of world.jobs)if(jobBlocksTransit(world,j))for(const c of footprintCells(j))captured.add(c.z*width+c.x);
      haulSolids=captured;
    }
    return haulSolids;
  };
  const haulActor=(a:WildAnimal)=>isSchema282OrLater(world.schemaVersion)&&!!a.domestic&&a.state!=='dead'&&a.shipCryptosleepHeldAt277===undefined;
  // The shared base navigation's caller option is not actor provenance.
  // Read this animal's real race; all admitted Advanced haulers pass fences.
  const haulFenceBlocked=(a:WildAnimal)=>isAnimalSpecies256(a.species)?animalCore256(a.species).race.roamMtbDays!==null:
    a.species==='deer'||a.species==='gazelle'||a.species==='muffalo'||a.species==='dromedary';
  const haulPoint=(a:WildAnimal,c:Cell,planning:boolean)=>{
    if(!haulActor(a)||!inBounds(world,c.x,c.z)||!naturalTerrainWalkable256(world.tiles[c.z*width+c.x]?.terrain)||haulStaticSolids().has(c.z*width+c.x))return false;
    for(const s of geometry.at(c)){
      if(START_STRUCTURE_PHYSICS_256[s.kind].fence&&haulFenceBlocked(a))return false;
      if(isPassageDoor(s.kind)&&!animalHaulDoorPassable282(world,a,s,planning,physicalNow?.()))return false;
    }
    return true;
  };
  const haulStep=(a:WildAnimal,to:Cell)=>{
    const dx=to.x-a.x,dz=to.z-a.z;
    if(Math.max(Math.abs(dx),Math.abs(dz))!==1||!haulPoint(a,to,false))return false;
    if(!dx||!dz)return true;
    const xSide={x:to.x,z:a.z},zSide={x:a.x,z:to.z};
    return haulPoint(a,xSide,false)&&haulPoint(a,zSide,false)&&!corners.has(xSide.z*width+xSide.x)&&!corners.has(zSide.z*width+zSide.x);
  };
  function findRoute(a:Cell,goals:Cell[],exitFallback=false,rank?:(c:Cell)=>number):{kind:'food'|'exit';path:Cell[]}|undefined {
    failedRoute=undefined;
    const policy=area(a),cells=goals.filter(c=>free(c)&&(!policy||policy.has(c.z*world.width+c.x))),indices=new Set(cells.map(c=>c.z*world.width+c.x));
    if(!indices.size&&!exitFallback)return;
    const edges:Cell[]=[];
    if(exitFallback){
      for(let x=0;x<world.width;x++)edges.push({x,z:0},{x,z:world.height-1});
      for(let z=1;z<world.height-1;z++)edges.push({x:0,z},{x:world.width-1,z});
    }
    const exits=edges.filter(free);
    if(!indices.size&&!exits.length)return;
    const n=animalNavigationCosts(world,a,override,geometry);
    // Food travel uses the species' pace. Convert common furniture costs from
    // human base-3 units into hare base-1 units; no human movement capacity.
    const search=new WeightedSearch(world.width,world.height,a.z*world.width+a.x,routeGrid(),scaleNavigationCosts(n.costs,3),n.repeaters,scaleNavigationCosts(n.floors,3),corners,policy?.costs);
    if(rank){
      // Stop at a reachable preferred group, not the closest lower-priority
      // goal. An unreachable group exhausts this same frontier; fallbacks then
      // reuse its settled field without launching another search.
      const target=rankedFood(world,cells,search,rank);
      if(target){const path=routeToCell(world,target,search.finish(new Set([target.z*width+target.x])));return path?{kind:'food',path}:undefined;}
      if(!exitFallback){if(isSchema287OrLater(Number(world.schemaVersion)))failedRoute={actor:a,x:a.x,z:a.z,tick:world.tick,field:search.finish()};return;}
    }
    const reach=search.finish(indices.size?indices:new Set(exits.map(c=>c.z*world.width+c.x)));
    const target=cells.filter(c=>hasReachableCell(reach,c.z*world.width+c.x)).sort((a,b)=>reach.costs[a.z*world.width+a.x]!-reach.costs[b.z*world.width+b.x]!)[0];
    if(target){const path=routeToCell(world,target,reach);return path?{kind:'food',path}:undefined;}
    if(!exitFallback&&isSchema287OrLater(Number(world.schemaVersion)))failedRoute={actor:a,x:a.x,z:a.z,tick:world.tick,field:reach};
    // An unsuccessful food flood exhausted its frontier. Its complete field
    // already contains reachable edge cells: do not launch a second flood.
    const exit=exits.filter(c=>hasReachableCell(reach,c.z*world.width+c.x)).sort((a,b)=>reach.costs[a.z*world.width+a.x]!-reach.costs[b.z*world.width+b.x]!)[0];
    const path=exit&&routeToCell(world,exit,reach);
    return path?{kind:'exit',path}:undefined;
  }
  const thermalGoal=(index:number,isGoal:(index:number)=>boolean,policy?:AnimalAreaPolicy287)=>{
    const cell={x:index%width,z:Math.floor(index/width)};
    return free(cell)&&(!policy||policy.has(index))&&!geometry.at(cell).some(s=>isPassageDoor(s.kind))&&isGoal(index);
  };
  return {free,geometry,
    /** The route grid of this reader (1 = blocked), for readers that work on
     * the whole map; read only. */
    blockedGrid:()=>routeGrid(),
    /** Which obstacle rules this reader applies (its grids compare with the
     * grids of the same key). */
    regionKey:`${flying?'f':'w'}${fencePassable?'u':'o'}${allowClosedGate?'g':''}`,
    /** An unreachable higher-priority medical bed already spent the quota.
     * Reuse its exhausted field once, without starving a useful refuge. */
    failedThermalRefugeRoute(a:Cell,isGoal:(index:number)=>boolean):Cell[]|null|undefined {
      const previous=failedRoute;if(!previous||previous.actor!==a||previous.x!==a.x||previous.z!==a.z||previous.tick!==world.tick)return;
      failedRoute=undefined;const reach=previous.field,policy=area(a);let target:number|undefined,cost=Infinity;
      for(let i=0;i<reach.costs.length;i++)if(hasReachableCell(reach,i)&&reach.costs[i]!<cost&&thermalGoal(i,isGoal,policy)){target=i;cost=reach.costs[i]!;}
      return target===undefined?null:routeToCell(world,{x:target%width,z:Math.floor(target/width)},reach)??null;
    },
    /** One quota-granted frontier; no collection or sort of map candidates.
     * Native region/random selection is adapted to path cost and index ties. */
    thermalRefugeRoute(a:Cell,isGoal:(index:number)=>boolean):Cell[]|undefined {
      const policy=area(a),n=animalNavigationCosts(world,a,override,geometry);
      const search=new WeightedSearch(width,world.height,a.z*width+a.x,routeGrid(),scaleNavigationCosts(n.costs,3),n.repeaters,scaleNavigationCosts(n.floors,3),corners,policy?.costs);
      const reach=search.finish(undefined,undefined,index=>thermalGoal(index,isGoal,policy));
      const target=reach.goalIndex;if(target===undefined)return;
      return routeToCell(world,{x:target%width,z:Math.floor(target/width)},reach)??undefined;
    },
    /** A failed ranked search already exhausted THIS actor's full frontier.
     * Reuse it once for a lower-priority destination without another quota. */
    failedRouteTo(a:Cell,goals:Cell[]):Cell[]|null|undefined {
      const previous=failedRoute;if(!previous||previous.actor!==a||previous.x!==a.x||previous.z!==a.z||previous.tick!==world.tick)return;
      failedRoute=undefined;const policy=area(a),reach=previous.field;
      const target=goals.filter(c=>free(c)&&(!policy||policy.has(c.z*width+c.x))&&hasReachableCell(reach,c.z*width+c.x))
        .sort((x,y)=>reach.costs[x.z*width+x.x]!-reach.costs[y.z*width+y.x]!)[0];
      return target?routeToCell(world,target,reach)??null:null;
    },
    haulStep,
    /** ROOT grants one search quota. All source and destination questions
     * resume THIS frontier from this original animal, never flood per pile. */
    haulSearch(a:WildAnimal):{canReach(c:Cell):boolean;pathTo(c:Cell):Cell[]|undefined}{
      if(!haulActor(a)||!inBounds(world,a.x,a.z))return {canReach:()=>false,pathTo:()=>undefined};
      const unavailable=new Uint8Array(width*world.height);
      for(let i=0;i<world.tiles.length;i++)if(!naturalTerrainWalkable256(world.tiles[i]?.terrain))unavailable[i]=1;
      for(const i of haulStaticSolids())unavailable[i]=1;
      for(const {structure:s,cells} of geometry.entries){
        if(START_STRUCTURE_PHYSICS_256[s.kind].fence&&haulFenceBlocked(a)||isPassageDoor(s.kind)&&!animalHaulDoorPassable282(world,a,s,true,physicalNow?.()))for(const i of cells)unavailable[i]=1;
      }
      const policy=area(a),n=animalNavigationCosts(world,a,undefined,geometry),search=new WeightedSearch(width,world.height,a.z*width+a.x,unavailable,scaleNavigationCosts(n.costs,3),n.repeaters,scaleNavigationCosts(n.floors,3),corners,policy?.costs);
      return {
        canReach(c:Cell){if(!haulPoint(a,c,true)||policy&&!policy.has(c.z*width+c.x))return false;const i=c.z*width+c.x;return hasReachableCell(search.advance(new Set([i])),i);},
        pathTo(c:Cell){if(!haulPoint(a,c,true)||policy&&!policy.has(c.z*width+c.x))return;const i=c.z*width+c.x,reach=search.advance(new Set([i]));return hasReachableCell(reach,i)?routeToCell(world,c,reach)??undefined:undefined;},
      };
    },
    /** Schema 304 idle wander (animal-idle-wander-304): the same frontier as
     * wanderSearch, with the navigation costs of the tick (idleWanderCosts). */
    idleWanderSearch(a:WildAnimal){
      // Computed once per tick without trap knowledge (no actor: nothing else
      // of navigationCosts depends on an animal); an animal knowing the traps
      // reads the same costs with the known traps' additive layer on top.
      const variant=duck?(flying?'flying':'duck'):'land',plain=()=>idleWanderCosts(world,`${variant}:false`,geometry,()=>lazyAnimalNavigationCosts(world,override,geometry));
      const knows=spikeTrapKnowsOf(world,a),key=`${variant}:${knows}`;
      const n=knows?idleWanderCosts(world,key,geometry,()=>{const base=plain(),traps=knownSpikeTrapCosts(world,geometry);
        return {...base,costs:addFireNavigationCosts(base.costs,traps),floors:addFireNavigationCosts(base.floors,traps)!};}):plain();
      const policy=area(a),scratch=idleScratch(world),pooled=scratch.acquire();
      const search=new WeightedSearch(width,world.height,a.z*width+a.x,routeGrid(),idleScaledCosts(world,key,geometry,n.costs),n.repeaters,scaleNavigationCosts(n.floors,3),corners,policy?.costs,undefined,pooled?scratch:undefined);
      let released=false;
      const live=()=>{if(released)throw Error('Idle wander search read after its release');};
      return {release(){if(!released){released=true;if(pooled)scratch.release();}},perceivedCostUnits(c:Cell){return inBounds(world,c.x,c.z)?n.costs?.get(c.z*width+c.x)??0:0;},canReach(c:Cell){live();if(!inBounds(world,c.x,c.z)||!free(c)||policy&&!policy.has(c.z*width+c.x))return false;const i=c.z*width+c.x;return hasReachableCell(search.advance(new Set([i])),i);},pathTo(c:Cell){live();if(!inBounds(world,c.x,c.z)||!free(c)||policy&&!policy.has(c.z*width+c.x))return;const i=c.z*width+c.x,reach=search.advance(new Set([i]));return hasReachableCell(reach,i)?routeToCell(world,c,reach)??undefined:undefined;}};
    },
    /** One quota-granted frontier shared by all confusion destination tickets. */
    wanderSearch(a:Cell){
      const policy=area(a),n=animalNavigationCosts(world,a,override,geometry),search=new WeightedSearch(width,world.height,a.z*width+a.x,routeGrid(),scaleNavigationCosts(n.costs,3),n.repeaters,scaleNavigationCosts(n.floors,3),corners,policy?.costs);
      return {canReach(c:Cell){if(!inBounds(world,c.x,c.z)||!free(c)||policy&&!policy.has(c.z*width+c.x))return false;const i=c.z*width+c.x;return hasReachableCell(search.advance(new Set([i])),i);},pathTo(c:Cell){if(!inBounds(world,c.x,c.z)||!free(c)||policy&&!policy.has(c.z*width+c.x))return;const i=c.z*width+c.x,reach=search.advance(new Set([i]));return hasReachableCell(reach,i)?routeToCell(world,c,reach)??undefined:undefined;}};
    },occupy:(c:Cell)=>inBounds(world,c.x,c.z)&&!blockedAt(c.z*width+c.x),step,route:(a:Cell,goals:Cell[],rank?:(c:Cell)=>number)=>findRoute(a,goals,false,rank)?.path,
    humanPursuitRoute(a:Cell,targets:readonly (Cell&{id:number})[],physical:Uint8Array,retainFirst=false):{path:Cell[];targetId:number}|undefined {
      const groups=targets.map(target=>{
        const contacts:Cell[]=[];
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(dx||dz){
          const c={x:target.x+dx,z:target.z+dz};if(free(c)&&meleeContact(world,c,target,physical))contacts.push(c);
        }
        return {target,contacts};
      });
      if(!groups.some(g=>g.contacts.length))return;
      const n=animalNavigationCosts(world,a,override,geometry),search=new WeightedSearch(width,world.height,a.z*width+a.x,routeGrid(),scaleNavigationCosts(n.costs,3),n.repeaters,scaleNavigationCosts(n.floors,3),corners,area(a)?.costs);
      const pick=(list:typeof groups)=>{
        const goals=new Set(list.flatMap(g=>g.contacts.map(c=>c.z*width+c.x))),reach=search.advance(goals);
        const found=list.flatMap(g=>g.contacts.filter(c=>hasReachableCell(reach,c.z*width+c.x)).map(c=>({target:g.target,cell:c,cost:reach.costs[c.z*width+c.x]!})))
          .sort((a,b)=>a.cost-b.cost||a.target.id-b.target.id||a.cell.z*width+a.cell.x-(b.cell.z*width+b.cell.x))[0];
        if(!found)return;
        const path=routeToCell(world,found.cell,search.finish(goals));
        return path?{path,targetId:found.target.id}:undefined;
      };
      if(retainFirst&&groups[0]!.contacts.length){const first=pick(groups.slice(0,1));if(first)return first;}
      return pick(groups);
    },
    foodOrExitRoute:(a:Cell,goals:Cell[],rank?:(c:Cell)=>number)=>findRoute(a,goals,true,rank),
    foodPreyOrExitRoute(a:Cell,goals:Cell[],prey:readonly (Cell&{id:number})[],exitFallback=false,rank?:(c:Cell)=>number):{kind:'food'|'prey'|'exit';path:Cell[];targetId?:number}|undefined {
      const policy=area(a),cells=goals.filter(c=>free(c)&&(!policy||policy.has(c.z*width+c.x))),indices=new Set(cells.map(c=>c.z*width+c.x));
      if(!indices.size&&!prey.length&&!exitFallback)return;
      const n=animalNavigationCosts(world,a,override,geometry),search=new WeightedSearch(width,world.height,a.z*width+a.x,routeGrid(),scaleNavigationCosts(n.costs,3),n.repeaters,scaleNavigationCosts(n.floors,3),corners,policy?.costs);
      if(indices.size){
        const reach=rank?undefined:search.advance(indices),food=rank?rankedFood(world,cells,search,rank):cells.filter(c=>hasReachableCell(reach!,c.z*width+c.x)).sort((a,b)=>reach!.costs[a.z*width+a.x]!-reach!.costs[b.z*width+b.x]!)[0];
        if(food){const path=routeToCell(world,food,search.finish(indices));return path?{kind:'food',path}:undefined;}
      }
      // Biological rank comes before travel distance. Resume the same field
      // for each candidate; settled equal-cost layers retain full-flood parents.
      for(const target of prey){
        const contacts=[target,{x:target.x-1,z:target.z},{x:target.x+1,z:target.z},{x:target.x,z:target.z-1},{x:target.x,z:target.z+1}]
          .filter(free);
        if(!contacts.length)continue;
        const reach=search.advance(new Set(contacts.map(c=>c.z*width+c.x)));
        const contact=contacts.filter(c=>hasReachableCell(reach,c.z*width+c.x)).sort((a,b)=>reach.costs[a.z*width+a.x]!-reach.costs[b.z*width+b.x]!)[0];
        const path=contact&&routeToCell(world,contact,reach);if(path)return {kind:'prey',path,targetId:target.id};
      }
      if(!exitFallback)return;
      const reach=search.finish();
      const edges:Cell[]=[];
      for(let x=0;x<width;x++)edges.push({x,z:0},{x,z:world.height-1});
      for(let z=1;z<world.height-1;z++)edges.push({x:0,z},{x:width-1,z});
      const edge=edges.filter(c=>free(c)&&hasReachableCell(reach,c.z*width+c.x)).sort((a,b)=>reach.costs[a.z*width+a.x]!-reach.costs[b.z*width+b.x]!)[0];
      const path=edge&&routeToCell(world,edge,reach);return path?{kind:'exit',path}:undefined;
    }};
}
export function moveAnimal(world:World,a:WildAnimal,step:(a:Cell,b:Cell)=>boolean,moving=1,geometry?:StructureNavigationGeometry):boolean {
  const physical=isCorePhysicalSchema297(world.schemaVersion),now=physical?effectiveLocal297(world):world.tick;
  const next=a.path[0];if(!next||a.motion&&a.motion.end>now)return false;
  if(!step(a,next)){a.path=[];delete a.meal;a.state='idle';a.nextDecision=world.tick+10;return false;}
  const flight=duckFlightMoveFactor256(world,a),species=actualAnimalProfile256(a);
  const jog=!!(a.meal||a.flee||a.retaliation||a.predation||a.manhunter||a.burning||a.haul&&a.haul.phase!=='holding'||a.animalThermalRefuge288?.phase==='travel'||a.eggLay||a.mating||a.animalAreaReturn287||a.hiveJob?.kind==='maintain'||a.hiveJob?.kind==='attack');
  const weather=weatherMoveFactor(world,a),stage=actualAnimalMoveSpeedFactor256(a);
  const terrain=furnitureDelay(world,a,next,duckTerrainOverride256(world,a),geometry);
  // Continue only the same immediately completed physical interval. A later
  // newly chosen job does not acquire unplayed movement before its own start.
  const start=a.motion&&a.motion.end>=now-(physical?.1:1)?a.motion.end:now;
  if(next.x!==a.x||next.z!==a.z)delete a.arrivalRotation;
  const from={x:a.x,z:a.z},to={...next},distance=Math.hypot(next.x-a.x,next.z-a.z);
  if(physical){
    const cost=animalMoveCostCore297({speed:6/species.moveTicks,moving,stage,weather,diagonal:next.x!==a.x&&next.z!==a.z,walk:!jog,terrainCore:terrain*10,flight});
    // Existing numeric segment equation captures the complete definitive cost.
    // Old edges are never reinterpreted; no human Core token or4.6 is borrowed.
    a.motion={...(flight>1?{animalFlight:true as const}:{}),from,to,start,end:start+cost/10,speedFactor:30*distance/cost,terrainDelay:0};
  }else{
    const pace=(jog?species.moveTicks:species.walkTicks)/(moving*weather*stage)/flight,delay=terrain/flight;
    a.motion={...(flight>1?{animalFlight:true as const}:{}),from,to,start,end:start+distance*pace+delay,speedFactor:3/pace,terrainDelay:delay};
  }
  if(a.stagger&&a.stagger.untilCore/10>start){a.motion.stagger=mergeSlowIntervals([{start:Math.max(start,a.stagger.sinceCore/10),end:a.stagger.untilCore/10}]);a.motion.end=travelEnd(a.motion);}
  if(world.snow&&animalBodySize(a)>.9)a.motion.snowEntryPending=true;
  a.x=next.x;a.z=next.z;a.path.shift();a.state='moving';finishSnowStep(world,a,animalBodySize(a));return true;
}
