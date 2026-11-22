/** RimWorld 1.6's world path search (`WorldPathing.FindPath`, surface layer,
 * no caravan: 3 300 ticks per move), rewritten from the decompiled algorithm
 * with the game's runtime precision (see `verse-rand.ts`):
 *
 * - the frontier is the game's 4-ary heap (`RoadQueue`), ties kept as it
 *   keeps them;
 * - a step costs `(int)(3300 × difficulty × road multiplier)`, the product
 *   evaluated in double and truncated, plus the known cost;
 * - a node opened for the first time enters the frontier at its known cost
 *   only: its heuristic is computed then but read from the node's previous
 *   (cleared, zero) value, exactly as the game does; a reopened node uses the
 *   heuristic stored the first time;
 * - the heuristic is `RoundToInt(3300 × distance × strength × 0.5)`, the
 *   distance in tiles from the node's normalized centre to the destination's,
 *   the strength `RoundToInt` of the curve 30→1, 40→1.3, 130→2 on the
 *   start–destination distance;
 * - after a node is closed, the terminator sees its priority (as a float);
 * - 500 000 closed nodes at most;
 * - an impassable end, or an end in another connected field, is not found
 *   (`WorldReachability.CanReach`).
 *
 * A workspace owned by one generation step: no World, no random draw. */
import {RoadQueue,visibleWorldRoads,WORLD_ROADS,type WorldRoadLink} from './world-roads.ts';
import {worldSurfaceAverageTileSize} from './world-surface-distances.ts';
import {coreApproxDistanceInTiles,coreApproxDistanceFromSpherical,coreSphericalDistance} from './world-core-geometry.ts';
import {vector3Normalized,type Vector3} from './verse-vector.ts';
import {roundToInt,simpleCurveEvaluate} from './verse-rand.ts';
import {WORLD_SURFACE_RADIUS} from './world-surface-mesh.ts';
import type {WorldSurfaceTile} from './world-surface-geography.ts';
const f=Math.fround;
const HEURISTIC_STRENGTH=[[30,1],[40,1.3],[130,2]] as const;
const TICKS_PER_MOVE=3300;
export interface CoreWorldPath {nodesReversed:number[];cost:number}
export interface CoreWorldPathing {
 readonly averageTileSize:number;
 /** `PlanetLayer.ApproxDistanceInTiles(a, b)`. */
 distance(a:number,b:number):number;
 /** `WorldPathing.FindPath(start, dest, null, terminator)`; null for
  * `WorldPath.NotFound`. */
 findPath(start:number,dest:number,terminator?:(cost:number)=>boolean):CoreWorldPath|null;
}
export function createCoreWorldPathing(tiles:readonly Pick<WorldSurfaceTile,'center'|'neighbours'|'biome'>[],difficulty:Float32Array,roads:readonly (readonly WorldRoadLink[])[]):CoreWorldPathing {
 const count=tiles.length;if(difficulty.length!==count||roads.length!==count)throw Error('Invalid core world path workspace');
 const averageTileSize=worldSurfaceAverageTileSize(tiles),radius=WORLD_SURFACE_RADIUS;
 const normalized=new Float32Array(count*3);
 for(let id=0;id<count;id++){const n=vector3Normalized(tiles[id]!.center);normalized[id*3]=n[0];normalized[id*3+1]=n[1];normalized[id*3+2]=n[2];}
 const unit=(id:number):Vector3=>[normalized[id*3]!,normalized[id*3+1]!,normalized[id*3+2]!];
 const known=new Int32Array(count),heuristic=new Int32Array(count),priority=new Int32Array(count),parent=new Int32Array(count),status=new Uint8Array(count);
 const distance=(a:number,b:number)=>coreApproxDistanceInTiles(tiles[a]!.center,tiles[b]!.center,radius,averageTileSize);
 /** `WorldGrid.GetRoadMovementDifficultyMultiplier`: first visible road
  * from `from` to `to`, else 1. */
 const roadMultiplier=(from:number,to:number)=>{const road=visibleWorldRoads(tiles[from]!,roads[from]!).find(link=>link.neighbour===to);return road?f(WORLD_ROADS[road.road].movement):1;};
 const fields=new Int32Array(count).fill(-1);let nextField=0;
 const field=(id:number)=>{
  if(fields[id]!<0){const label=nextField++,queue=[id];fields[id]=label;
   for(let at=0;at<queue.length;at++)for(const next of tiles[queue[at]!]!.neighbours)if(fields[next]!<0&&difficulty[next]!<1000){fields[next]=label;queue.push(next);}}
  return fields[id]!;
 };
 const findPath=(start:number,dest:number,terminator?:(cost:number)=>boolean):CoreWorldPath|null=>{
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(dest)||start<0||dest<0||start>=count||dest>=count)throw Error('Invalid core world path tiles');
  // `WorldReachability.CanReach`: an impassable end or another connected
  // field is not found, before any search.
  if(!(difficulty[start]!<1000)||!(difficulty[dest]!<1000)||field(start)!==field(dest))return null;
  const destination=unit(dest),strength=roundToInt(simpleCurveEvaluate(HEURISTIC_STRENGTH,distance(start,dest)));
  known.fill(0);heuristic.fill(0);priority.fill(0);parent.fill(0);status.fill(0);
  const frontier=new RoadQueue();parent[start]=start;status[start]=1;frontier.push(start,0);
  let closed=0;
  for(;;){
   if(!frontier.size)return null;
   const [id,popped]=frontier.pop();
   if(popped!==priority[id]||status[id]===2)continue;
   if(id===dest){
    const nodesReversed:number[]=[];let at=id;
    for(;;){nodesReversed.push(at);const up=parent[at]!;if(up===at)break;if(nodesReversed.length>count)throw Error('Invalid core world path parent');at=up;}
    return {nodesReversed,cost:known[id]!};
   }
   if(closed>500000)return null;
   const base=known[id]!;
   for(const next of tiles[id]!.neighbours){
    if(status[next]===2||!(difficulty[next]!<1000))continue;
    const cost=(Math.trunc(TICKS_PER_MOVE*difficulty[next]!*roadMultiplier(id,next))+base)|0;
    const state=status[next]!;
    if(state===0||known[next]!>cost){
     const previous=heuristic[next]!;
     if(state===0)heuristic[next]=roundToInt(f(TICKS_PER_MOVE*coreApproxDistanceFromSpherical(coreSphericalDistance(unit(next),destination),radius,averageTileSize)*strength*.5));
     const total=(cost+previous)|0;
     parent[next]=id;known[next]=cost;status[next]=1;priority[next]=total;frontier.push(next,total);
    }
   }
   closed++;status[id]=2;
   if(terminator&&terminator(f(priority[id]!)))return null;
  }
 };
 return {averageTileSize,distance,findPath};
}
