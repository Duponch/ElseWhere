import { actorObstacleWrites } from './combat-navigation.ts';
import { regionComponents,type RegionMap } from './regions.ts';
import { doorCorners } from './door-rules.ts';
import type { Cell, World } from './types.ts';
import type { CandidateAccess } from './navigation-types.ts';
import { WeightedSearch,WeightedSearchScratch } from './weighted-search.ts';
import { navigationAllowedArea,OUTSIDE_ALLOWED_AREA_SEARCH_COST } from './allowed-area-state.ts';
import { navigationSearchCosts379,coreNavigationUnits297 } from './furniture-travel.ts';
import type { StructureNavigationGeometry } from './structure-navigation.ts';
import {deriveNavigationGrid379,navigationGridCorners379} from './owned-navigation-grid-379.ts';
import {candidatePageConnectivity379,type CandidatePageConnectivity379} from './candidate-page-connectivity-379.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';

interface CandidateDecisionScratch {busy:boolean;connected:Uint8Array;queue:Int32Array;grid:Uint8Array;weighted?:WeightedSearchScratch}
const candidateScratchPools379=new WeakMap<object,Map<number,CandidateDecisionScratch[]>>();
const scratchWork379={allocations:0,reuses:0,weightedAllocations:0};
export const candidateScratchWork379=()=>({...scratchWork379});
/** Only a real planner that owns its end-of-decision dispose borrows this
 * memory. Public, escaping and unproved candidates keep independent arrays.
 * A nested decision can never take a still-live frontier/field. */
function borrowCandidateScratch379(size:number):CandidateDecisionScratch|undefined {
 const owner=terrainJournalReadOwner();if(!owner)return;
 let sizes=candidateScratchPools379.get(owner);if(!sizes){sizes=new Map();candidateScratchPools379.set(owner,sizes);}
 let pool=sizes.get(size);if(!pool){if(sizes.size>=4)sizes.delete(sizes.keys().next().value!);pool=[];sizes.set(size,pool);}
 let scratch=pool.find(row=>!row.busy);if(scratch)scratchWork379.reuses++;else{scratch={busy:false,connected:new Uint8Array(size),queue:new Int32Array(size),grid:new Uint8Array(size)};if(pool.length<2)pool.push(scratch);scratchWork379.allocations++;}
 scratch.busy=true;return scratch;
}

/** With solid diagonal corners, a legal diagonal always has a cardinal detour.
 * Four-neighbour connectivity therefore answers existence exactly, without
 * assigning any unweighted route or distance to the simulation. */
export function candidateAccess(world:World,start:Cell,blocked:Uint8Array,occupied:ReadonlySet<number>,deferNavigation=false,originCell:Cell=start,geometry?:StructureNavigationGeometry,regions?:RegionMap,ownedPageConnectivity=false,ownsDecisionScratch=false):CandidateAccess {
  // Retain the original actor for policy/doors/hostility while an admitted
  // StopDead query starts at its actual occupied cell, not its future endpoint.
  const width=world.width,height=world.height,size=width*height,origin=originCell.z*width+originCell.x;
  const policy=navigationAllowedArea(world,start),additive=policy?{maximum:OUTSIDE_ALLOWED_AREA_SEARCH_COST,has:(index:number)=>!policy.has(index),get:(index:number)=>policy.has(index)?0:OUTSIDE_ALLOWED_AREA_SEARCH_COST}:undefined;
  const scratch=ownsDecisionScratch&&blocked.length===size?borrowCandidateScratch379(size):undefined,unavailable=scratch?.grid??blocked.slice();if(scratch)unavailable.set(blocked);
  try{
  for(const index of occupied)unavailable[index]=1;
  // The actor's door verdicts and hostile cells, in their write order.
  const writes=new Map<number,0|1>();actorObstacleWrites(world,start,(index,value)=>{writes.set(index,value);unavailable[index]=value;});
  deriveNavigationGrid379(unavailable,blocked,new Set([...occupied,...writes.keys()]));
  const regionAccess=regions&&!occupied.size&&regions.width===width&&regions.height===height?regionConnectivity(regions,origin,writes):undefined;
  // Public callers retain the full construction-time snapshot. The ordinary
  // work planner may defer navigation inside its synchronous read-only scan.
  let navigation=deferNavigation?undefined:navigationSearchCosts379(world,start,geometry),corners=deferNavigation?undefined:geometry?.corners??navigationGridCorners379(blocked)??doorCorners(world);
  const getNavigation=()=>navigation??=navigationSearchCosts379(world,start,geometry),getCorners=()=>corners??=geometry?.corners??navigationGridCorners379(blocked)??doorCorners(world);
  let connected:Uint8Array|undefined,queue:Int32Array|undefined,head=0,tail=0;
  let pageAccess:CandidatePageConnectivity379|undefined,pageAttempted=false;
  const connectivity=()=>{if(!connected){connected=scratch?.connected??new Uint8Array(size);queue=scratch?.queue??new Int32Array(size);queue[0]=origin;connected[origin]=1;tail=1;}};
  const visit=(i:number)=>{if(!unavailable[i]&&!connected![i]){connected![i]=1;queue![tail++]=i;}};
  const has=(target:number)=>{
    if(disposed&&scratch)throw Error('Owned candidate connectivity after its decision ended');
    if(target<0||target>=size||!Number.isInteger(target))return false;
    if(regionAccess)return target===origin||regionAccess(target);
    connectivity();
    if(connected![target])return true;
    if(unavailable[target])return false;
    if(pageAccess)return pageAccess.has(target);
    while(head<tail&&!connected![target]) {
      // Keep near queries on the existing flood. Only the work planner opts
      // in: other callers debit exact cell visits against simulation quotas.
      if(ownedPageConnectivity&&!pageAttempted&&head>=512){pageAttempted=true;pageAccess=candidatePageConnectivity379(unavailable,width,height,origin,queue!);if(pageAccess)return pageAccess.has(target);}
      const index=queue![head++]!,x=index%width;
      if(index>=width)visit(index-width);if(x+1<width)visit(index+1);
      if(index+width<size)visit(index+width);if(x>0)visit(index-1);
    }
    return connected![target]===1;
  };
  let weighted:WeightedSearch|undefined,weightedScratch:WeightedSearchScratch|undefined,disposed=false;
  return {
    kind:'candidate-access',start:origin,...policy?{allowedAreaPolicy:policy}:{},get stops(){return getNavigation().stops;},
    has,
    resolve:goals=>{if(disposed)throw Error('Candidate frontier read after its owner ended');const {costs,repeaters,stops,floors,coreMoveCosts297}=getNavigation();if(!weighted){if(scratch){if(!scratch.weighted){scratch.weighted=new WeightedSearchScratch(size);scratchWork379.weightedAllocations++;}if(scratch.weighted.acquire())weightedScratch=scratch.weighted;}try{weighted=new WeightedSearch(width,height,origin,unavailable,costs,repeaters,floors,getCorners(),coreMoveCosts297?coreNavigationUnits297(additive):additive,coreMoveCosts297,weightedScratch);}catch(error){weightedScratch?.release();weightedScratch=undefined;throw error;}}weighted.field.stops=stops;return weighted.advance(goals);},
    dispose(){if(disposed)return;disposed=true;try{weighted?.dispose();}finally{weightedScratch?.release();if(scratch){if(connected)scratch.connected.fill(0);scratch.busy=false;}}},
    costTo:index=>{if(disposed&&scratch)throw Error('Owned candidate cost after its decision ended');return index===origin?0:weighted?.field.settled?.[index]?weighted.field.costs[index]!:Infinity;},
    get visited(){return weighted?.field.visited??0;},
    get connectivityVisited(){return head;},unreachedGroups:0,
  };
  }catch(error){if(scratch){scratch.connected.fill(0);scratch.busy=false;}throw error;}
}

/** Exactly the 4-neighbour connectivity of the cell flood above, answered on
 * the region graph of the same grid: the actor's door verdicts decide which
 * portals are open. A hostile actor standing on an ordinary passable cell can
 * cut a region, so such a query keeps the cell flood (undefined). */
function regionConnectivity(map:RegionMap,origin:number,writes:ReadonlyMap<number,0|1>):((target:number)=>boolean)|undefined {
  const {regionOf,doorCell,grid}=map;
  for(const [index,value] of writes){
    if(index<0||index>=regionOf.length)continue;
    const r=regionOf[index]!;if(r>=0&&doorCell[r]!>=0)continue;
    if(value!==grid[index])return undefined;
  }
  const labels=regionComponents(map,cell=>(writes.get(cell)??grid[cell])===0);
  const width=map.width,size=regionOf.length,starts:number[]=[];
  const add=(cell:number)=>{const r=regionOf[cell]!;if(r>=0&&labels[r]!>=0&&!starts.includes(labels[r]!))starts.push(labels[r]!);};
  const own=origin>=0&&origin<size?regionOf[origin]!:-1;
  if(own>=0&&labels[own]!>=0)starts.push(labels[own]!);
  else if(origin>=0&&origin<size){
    const x=origin%width;
    if(origin>=width)add(origin-width);if(x+1<width)add(origin+1);if(origin+width<size)add(origin+width);if(x>0)add(origin-1);
  }
  return target=>{const r=regionOf[target]!;if(r<0)return false;const label=labels[r]!;return label>=0&&starts.includes(label);};
}
