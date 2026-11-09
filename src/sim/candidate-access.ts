import { actorObstacleWrites } from './combat-navigation.ts';
import { regionComponents,type RegionMap } from './regions.ts';
import { doorCorners } from './door-rules.ts';
import type { Cell, World } from './types.ts';
import type { CandidateAccess } from './navigation-types.ts';
import { WeightedSearch } from './weighted-search.ts';
import { navigationAllowedArea,OUTSIDE_ALLOWED_AREA_SEARCH_COST } from './allowed-area-state.ts';
import { navigationCosts,coreNavigationUnits297 } from './furniture-travel.ts';
import type { StructureNavigationGeometry } from './structure-navigation.ts';

/** With solid diagonal corners, a legal diagonal always has a cardinal detour.
 * Four-neighbour connectivity therefore answers existence exactly, without
 * assigning any unweighted route or distance to the simulation. */
export function candidateAccess(world:World,start:Cell,blocked:Uint8Array,occupied:ReadonlySet<number>,deferNavigation=false,originCell:Cell=start,geometry?:StructureNavigationGeometry,regions?:RegionMap):CandidateAccess {
  // Retain the original actor for policy/doors/hostility while an admitted
  // StopDead query starts at its actual occupied cell, not its future endpoint.
  const width=world.width,height=world.height,size=width*height,origin=originCell.z*width+originCell.x;
  const policy=navigationAllowedArea(world,start),additive=policy?{maximum:OUTSIDE_ALLOWED_AREA_SEARCH_COST,has:(index:number)=>!policy.has(index),get:(index:number)=>policy.has(index)?0:OUTSIDE_ALLOWED_AREA_SEARCH_COST}:undefined;
  const unavailable=blocked.slice();for(const index of occupied)unavailable[index]=1;
  // The actor's door verdicts and hostile cells, in their write order.
  const writes=new Map<number,0|1>();actorObstacleWrites(world,start,(index,value)=>{writes.set(index,value);unavailable[index]=value;});
  const regionAccess=regions&&!occupied.size&&regions.width===width&&regions.height===height?regionConnectivity(regions,origin,writes):undefined;
  // Public callers retain the full construction-time snapshot. The ordinary
  // work planner may defer navigation inside its synchronous read-only scan.
  let navigation=deferNavigation?undefined:navigationCosts(world,start,undefined,geometry),corners=deferNavigation?undefined:geometry?.corners??doorCorners(world);
  const getNavigation=()=>navigation??=navigationCosts(world,start,undefined,geometry),getCorners=()=>corners??=geometry?.corners??doorCorners(world);
  let connected:Uint8Array|undefined,queue:Int32Array|undefined,head=0,tail=0;
  const connectivity=()=>{if(!connected){connected=new Uint8Array(size);queue=new Int32Array(size);queue[0]=origin;connected[origin]=1;tail=1;}};
  const visit=(i:number)=>{if(!unavailable[i]&&!connected![i]){connected![i]=1;queue![tail++]=i;}};
  const has=(target:number)=>{
    if(target<0||target>=size||!Number.isInteger(target))return false;
    if(regionAccess)return target===origin||regionAccess(target);
    connectivity();
    if(connected![target])return true;
    if(unavailable[target])return false;
    while(head<tail&&!connected![target]) {
      const index=queue![head++]!,x=index%width;
      if(index>=width)visit(index-width);if(x+1<width)visit(index+1);
      if(index+width<size)visit(index+width);if(x>0)visit(index-1);
    }
    return connected![target]===1;
  };
  let weighted:WeightedSearch|undefined;
  return {
    kind:'candidate-access',start:origin,...policy?{allowedAreaPolicy:policy}:{},get stops(){return getNavigation().stops;},
    has,
    resolve:goals=>{const {costs,repeaters,stops,floors,coreMoveCosts297}=getNavigation();weighted??=new WeightedSearch(width,height,origin,unavailable,costs,repeaters,floors,getCorners(),coreMoveCosts297?coreNavigationUnits297(additive):additive,coreMoveCosts297);weighted.field.stops=stops;return weighted.advance(goals);},
    costTo:index=>index===origin?0:weighted?.field.settled?.[index]?weighted.field.costs[index]!:Infinity,
    get visited(){return weighted?.field.visited??0;},
    get connectivityVisited(){return head;},unreachedGroups:0,
  };
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
