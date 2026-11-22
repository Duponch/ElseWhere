/** World road links and path searches. Ordinary and ancient generation share
 * actual reciprocal edges; hidden links remain saved without granting travel
 * discounts in biomes where roads are not exposed. */
import {worldBiomeAllowsRoads,worldBiomeAllowsRivers} from './world-biome-properties.ts';
import {worldSurfaceApproxDistance,worldSurfaceAverageTileSize} from './world-surface-distances.ts';
import {evaluateClimateCurve} from './world-climate-settings.ts';
import {roundWorldInteger,type WorldRiverLink} from './world-rivers.ts';
import type {WorldSurfaceTile} from './world-surface-geography.ts';
export type WorldRoadId='dirt-path'|'dirt-road'|'stone-road'|'ancient-asphalt-road'|'ancient-asphalt-highway';
export interface WorldRoadLink {neighbour:number;road:WorldRoadId}
export const WORLD_ROADS:Readonly<Record<WorldRoadId,{priority:number;movement:number;ancient:boolean}>>={
 'dirt-path':{priority:10,movement:.5,ancient:false},'dirt-road':{priority:20,movement:.5,ancient:false},'stone-road':{priority:30,movement:.5,ancient:false},
 'ancient-asphalt-road':{priority:40,movement:.5,ancient:true},'ancient-asphalt-highway':{priority:50,movement:.5,ancient:true},
};
const NO_ROADS:readonly WorldRoadLink[]=Object.freeze([]),NO_RIVERS:readonly WorldRiverLink[]=Object.freeze([]);
export function visibleWorldRoads(tile:Pick<WorldSurfaceTile,'biome'>,links:readonly WorldRoadLink[]):readonly WorldRoadLink[]{return worldBiomeAllowsRoads(tile.biome)?links:NO_ROADS;}
export function visibleWorldRivers(tile:Pick<WorldSurfaceTile,'biome'|'rivers'>):readonly WorldRiverLink[]{return worldBiomeAllowsRivers(tile.biome)?tile.rivers:NO_RIVERS;}
export function overlayWorldRoad(tiles:readonly Pick<WorldSurfaceTile,'neighbours'>[],links:WorldRoadLink[][],from:number,to:number,road:WorldRoadId):void {
 if(!tiles[from]?.neighbours.includes(to)||!tiles[to]?.neighbours.includes(from)||!Object.hasOwn(WORLD_ROADS,road))throw Error('Invalid world road overlay');
 const left=links[from]!,right=links[to]!,old=left.findIndex(edge=>edge.neighbour===to),reverse=right.findIndex(edge=>edge.neighbour===from);
 if((old<0)!==(reverse<0)||old>=0&&left[old]!.road!==right[reverse]!.road)throw Error('Non-reciprocal stored road');
 if(old>=0){if(WORLD_ROADS[left[old]!.road].priority>=WORLD_ROADS[road].priority)return;left.splice(old,1);right.splice(reverse,1);}
 left.push({neighbour:to,road});right.push({neighbour:from,road});
}
/** Four-ary integer heap. Equal priorities keep the existing parent or first
 * minimum child; no invented tile-ID or FIFO tie breaker. This is the game's
 * `NativePriorityQueue` (arity 4) with `IntMinComparer`. */
export class RoadQueue {
 ids:number[]=[];costs:number[]=[];
 get size(){return this.ids.length;}
 push(id:number,priority:number):void {let at=this.size;this.ids.push(id);this.costs.push(priority);while(at){const parent=Math.floor((at-1)/4);if(this.costs[parent]!<=priority)break;this.ids[at]=this.ids[parent]!;this.costs[at]=this.costs[parent]!;at=parent;}this.ids[at]=id;this.costs[at]=priority;}
 pop():readonly [number,number]{if(!this.size)throw Error('Empty road frontier');const result=[this.ids[0]!,this.costs[0]!] as const,id=this.ids.pop()!,cost=this.costs.pop()!;if(!this.size)return result;let at=0;while(at*4+1<this.size){let best=at*4+1;for(let i=best+1;i<Math.min(at*4+5,this.size);i++)if(this.costs[i]!<this.costs[best]!)best=i;if(cost<=this.costs[best]!)break;this.ids[at]=this.ids[best]!;this.costs[at]=this.costs[best]!;at=best;}this.ids[at]=id;this.costs[at]=cost;return result;}
}
export interface WorldRoadPath {nodesReversed:number[];knownCost:number;processed:number}
export interface WorldRoadProspect {from:number;to:number;cost:number}
/** A generation-owned workspace, not a persisted index or a global cache.
 * No World or PRNG is retained or advanced by path searches. */
export function createWorldRoadPathing(tiles:readonly WorldSurfaceTile[],difficulty:Float32Array,roads:WorldRoadLink[][]){
 const count=tiles.length;if(difficulty.length!==count||roads.length!==count)throw Error('Invalid world road workspace');
 const averageSize=worldSurfaceAverageTileSize(tiles),known=new Int32Array(count),priority=new Int32Array(count),heuristic=new Int32Array(count),parent=new Int32Array(count),status=new Uint8Array(count);
 const f=Math.fround,valid=(id:number)=>Number.isSafeInteger(id)&&id>=0&&id<count;
 const passable=(id:number)=>valid(id)&&difficulty[id]!<1000;
 const distance=(a:number,b:number)=>worldSurfaceApproxDistance(tiles[a]!.center,tiles[b]!.center,averageSize);
 const edge=(from:number,to:number,ticks:number,clamp:boolean)=>{
  const road=visibleWorldRoads(tiles[from]!,roads[from]!).find(link=>link.neighbour===to);
  const value=Math.trunc(f(f(ticks*difficulty[to]!)*(road?WORLD_ROADS[road.road].movement:1)));
  return clamp?Math.max(1,Math.min(30000,value)):value;
 };
 const clear=()=>{known.fill(0);priority.fill(0);heuristic.fill(0);parent.fill(-1);status.fill(0);};
 const path=(from:number,to:number,stopPriority=Infinity,ticksPerMove=3300):WorldRoadPath|null=>{
  if(!passable(from)||!passable(to))return null;
  if(!Number.isSafeInteger(ticksPerMove)||ticksPerMove<1)throw Error('Invalid world path speed');
  clear();const frontier=new RoadQueue(),strength=roundWorldInteger(evaluateClimateCurve([[30,1],[40,1.3],[130,2]],distance(from,to)));let processed=0;
  parent[from]=from;status[from]=1;frontier.push(from,0);
  while(frontier.size){
   const [id,popped]=frontier.pop();if(status[id]===2||popped!==priority[id])continue;
   if(id===to){const nodesReversed=[to];let cursor=to;while(cursor!==from){cursor=parent[cursor]!;if(cursor<0||nodesReversed.length>count)throw Error('Invalid world path parent');nodesReversed.push(cursor);}return {nodesReversed,knownCost:known[id]!,processed};}
   if(processed>500000)return null;
   for(const next of tiles[id]!.neighbours){
    if(status[next]===2||!passable(next))continue;
    const cost=(known[id]!+edge(id,next,ticksPerMove,false))|0;
    if(status[next]===1&&cost>=known[next]!)continue;
    // The observed primary stores a new node's heuristic after using the old
    // slot in this priority. Preserve that ordering rather than fixing it.
    const oldHeuristic=heuristic[next]!;
    if(status[next]===0)heuristic[next]=roundWorldInteger(f(f(f(ticksPerMove*distance(next,to))*strength)*.5));
    parent[next]=id;known[next]=cost;status[next]=1;priority[next]=(cost+oldHeuristic)|0;frontier.push(next,priority[next]!);
   }
   processed++;status[id]=2;if(f(priority[id]!)>stopPriority)return null;
  }
  return null;
 };
 const prospects=(from:number,endpoints:ReadonlySet<number>,maximum=8):WorldRoadProspect[]=>{
  if(!passable(from))return [];
  clear();const result:WorldRoadProspect[]=[],frontier=new RoadQueue();status[from]=1;frontier.push(from,0);
  while(frontier.size){const [id,cost]=frontier.pop();if(status[id]===2||known[id]!==cost)continue;status[id]=2;
   if(id!==from&&endpoints.has(id)){result.push({from,to:id,cost});if(result.length>=maximum)break;}
   for(const next of tiles[id]!.neighbours){if(status[next]===2||!passable(next))continue;const candidate=(cost+edge(id,next,3300,true))|0;if(status[next]===1&&candidate>=known[next]!)continue;known[next]=candidate;status[next]=1;frontier.push(next,candidate);}
  }
  return result;
 };
 const components=()=>{const labels=new Int32Array(count).fill(-1);let label=0;for(let id=0;id<count;id++){if(!passable(id)||labels[id]!==-1)continue;const queue=[id];labels[id]=label;for(let at=0;at<queue.length;at++)for(const next of tiles[queue[at]!]!.neighbours)if(passable(next)&&labels[next]===-1){labels[next]=label;queue.push(next);}label++;}return labels;};
 return {path,prospects,components,distance,averageSize,passable};
}
