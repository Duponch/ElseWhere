import { isBreachableBarrier } from './barriers.ts';
import { candidateAccess } from './candidate-access.ts';
import { captureStandability } from './furniture-travel.ts';
import { captureMeleePlaces } from './melee-space.ts';
import { blockedCells,routeToCell } from './pathfinding.ts';
import { isColonist,distanceSquared } from './affiliation.ts';
import type { Cell,Structure,World } from './types.ts';
import type { CandidateAccess } from './navigation-types.ts';

const EMPTY:ReadonlySet<number>=new Set();
const edge=(w:World,c:Cell)=>c.x===0||c.z===0||c.x===w.width-1||c.z===w.height-1;
export const atMapEdge=edge;
/** Cardinal strategic connectivity only. A removable wall/door may be crossed
 * in this hypothetical graph; the resulting cells are NEVER movement orders. */
function strategic(world:World,start:Cell,goals:ReadonlySet<number>):Cell[]|null {
  const hypothetical={...world,structures:world.structures.filter(s=>!isBreachableBarrier(s))},blocked=blockedCells(hypothetical),w=world.width,n=blocked.length;
  const parents=new Int32Array(n);parents.fill(-2);const queue=new Int32Array(n),origin=start.z*w+start.x;let head=0,tail=1;queue[0]=origin;parents[origin]=-1;
  while(head<tail){const i=queue[head++]!;
    if(goals.has(i)){const path:Cell[]=[];for(let j=i;j!==origin;j=parents[j]!)path.push({x:j%w,z:Math.floor(j/w)});return path.reverse();}
    const visit=(j:number)=>{if(!blocked[j]&&parents[j]===-2){parents[j]=i;queue[tail++]=j;}};
    if(i>=w)visit(i-w);if(i%w+1<w)visit(i+1);if(i+w<n)visit(i+w);if(i%w)visit(i-1);
  }return null;
}
/** Multi-source connectivity from every standing colonist, with breachable
 * barriers removed: an isolated first settler must not hide another
 * reachable colony component. This is connectivity only, never a route. */
export function raidColonyReach(world:World):Uint8Array|null {
  const centers=world.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&p.state!=='downed');if(!centers.length)return null;
  const hypothetical={...world,structures:world.structures.filter(s=>!isBreachableBarrier(s))},blocked=blockedCells(hypothetical);
  const reached=new Uint8Array(blocked.length),queue=new Int32Array(blocked.length);let head=0,tail=0;
  for(const c of centers){const i=c.z*world.width+c.x;if(!reached[i]){reached[i]=1;queue[tail++]=i;}}
  const visit=(i:number)=>{if(!blocked[i]&&!reached[i]){reached[i]=1;queue[tail++]=i;}};
  while(head<tail){const i=queue[head++]!,x=i%world.width;if(i>=world.width)visit(i-world.width);if(x+1<world.width)visit(i+1);if(i+world.width<blocked.length)visit(i+world.width);if(x)visit(i-1);}
  return reached;
}
/** Free, standable, non-barrier edge cells connected to the colony, in map
 * order (z, then x); `border` may keep only some of them. */
export function raidEdgeCandidates(world:World,border?:(x:number,z:number)=>boolean):Cell[]|null {
  const reached=raidColonyReach(world);if(!reached)return null;
  const stands=captureStandability(world);
  const occupied=new Set(world.pawns.flatMap(p=>[p.z*world.width+p.x,...(p.motion&&p.motion.end>world.tick?[p.motion.from.z*world.width+p.motion.from.x]:[])]));
  const barriers=new Set(world.structures.filter(isBreachableBarrier).map(s=>s.z*world.width+s.x));
  const edges:Cell[]=[];
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)if(edge(world,{x,z})&&(!border||border(x,z))){const c={x,z},i=z*world.width+x;if(!occupied.has(i)&&stands(c)&&!barriers.has(i)&&reached[i])edges.push(c);}
  return edges;
}
export function raidEntries(world:World,salt:number,count:number,preferred?:Cell):Cell[]|null {
  const sameBorder=(x:number,z:number)=>!preferred||preferred.x===0&&x===0||preferred.x===world.width-1&&x===world.width-1||preferred.z===0&&z===0||preferred.z===world.height-1&&z===world.height-1;
  const edges=raidEdgeCandidates(world,sameBorder);if(!edges)return null;
  if(edges.length<count)return null;
  const first=preferred??edges[salt%edges.length]!;edges.sort((a,b)=>distanceSquared(a,first)-distanceSquared(b,first)||a.z-b.z||a.x-b.x);
  return edges.slice(0,count);
}
export interface RaidRoute { path:Cell[]; goal:Cell; barrier?:Structure }
/** Prefer an actually accessible target before considering any destruction. */
export function raidRoute(world:World,pawn:Cell&{id:number},exiting:boolean,blocked:Uint8Array,preparedAccess?:CandidateAccess):RaidRoute|null {
  const targets=world.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&p.state!=='downed').sort((a,b)=>distanceSquared(pawn,a)-distanceSquared(pawn,b)||a.id-b.id);
  const stands=captureStandability(world),goals:Cell[]=[],exitGoals:Cell[]=[];
  if(exiting){const afterBreach=captureStandability({...world,structures:world.structures.filter(s=>!isBreachableBarrier(s))});for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)if(edge(world,{x,z})){if(stands({x,z}))goals.push({x,z});if(afterBreach({x,z}))exitGoals.push({x,z});}goals.sort((a,b)=>distanceSquared(pawn,a)-distanceSquared(pawn,b)||a.z-b.z||a.x-b.x);}
  const places=captureMeleePlaces(world,pawn);
  const access=preparedAccess??candidateAccess(world,pawn,blocked,EMPTY);
  function reachable(candidates:Cell[]):RaidRoute|null {for(const c of candidates)if(access.has(c.z*world.width+c.x)){const path=routeToCell(world,c,access);if(path)return {path,goal:c};}return null;}
  if(exiting){const route=reachable(goals);if(route)return route;}
  else for(const target of targets){const route=reachable(places(target));if(route)return route;}
  const strategicGoals=new Set((exiting?exitGoals:targets).map(c=>c.z*world.width+c.x));
  const plan=strategic(world,pawn,strategicGoals);if(!plan)return null;
  for(const c of plan){const barrier=world.structures.find(s=>isBreachableBarrier(s)&&s.x===c.x&&s.z===c.z&&(s.kind==='wall'||!s.door?.open));if(!barrier)continue;
    for(const place of places(barrier))if(access.has(place.z*world.width+place.x)){const path=routeToCell(world,place,access);if(path)return {path,goal:place,barrier};}
    return null;
  }return null;
}
