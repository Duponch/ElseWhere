import {isDoubleBedKind} from './bed-kinds.ts';
import { isBedKind } from './bed-kinds.ts';
import { footprintCells } from './definitions.ts';
import { isColonist } from './affiliation.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { doorOpenness,isRoomDoor } from './door-rules.ts';
import { routeCost,routeToCell,type Reachability } from './pathfinding.ts';
import { RoomTopologyCache,type RoomSpace,type RoomTopology } from './room-topology.ts';
import type { Cell,Pawn,Structure,World } from './types.ts';

interface PrisonTopology {
  rooms:RoomTopologyCache;
  topology?:RoomTopology;
  doors?:string;
  graph:Map<number,Set<number>>;
  edgeCells:Map<number,number[]>;
  exits:Map<number,ReadonlySet<number>>;
}
const caches=new WeakMap<World,PrisonTopology>();
function cacheFor(world:World):PrisonTopology {
  let cache=caches.get(world);
  if(!cache){cache={rooms:new RoomTopologyCache(),graph:new Map(),edgeCells:new Map(),exits:new Map()};caches.set(world,cache);}
  return cache;
}
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const inside=(w:World,c:Cell)=>Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;

/** One immutable enclosure snapshot for a synchronous decision. Callers may
 * share it through pure queries, never retain it across a barrier mutation,
 * another actor decision or a tick. The default query path always revalidates. */
export function capturePrisonTopology(world:World):RoomTopology {
  return cacheFor(world).rooms.read(world);
}

/** Core FreePassage distinguishes a held/blocked door from an ordinary short
 * opening. The local physical leaf must also be fully open before entry. */
export function prisonDoorPassable(world:World,door:Structure):boolean {
  if(!isRoomDoor(door.kind)||!door.door?.open||doorOpenness(door,world.tick)<1-1e-9)return false;
  if(door.door.holdOpen)return true;
  const blocks=(actor:Cell&{motion?:Pawn['motion']})=>same(actor,door)||!!actor.motion&&actor.motion.end>world.tick&&same(actor.motion.from,door);
  // Core WillCloseSoon separately checks friendly pawns able to open the
  // door, even when BlockedOpenMomentary is true. Normal warden passage must
  // not authorize a following captive; both active edge ends represent the
  // same physical body here. Only the immediate cardinal approach counts.
  if(!door.door.forbidden&&world.pawns.some(p=>(isColonist(p)&&!p.prisoner||p.prisoner?.releasedAt!==undefined)&&p.state!=='dead'&&p.state!=='downed'
    &&(blocks(p)||p.state==='moving'&&Math.abs(p.x-door.x)+Math.abs(p.z-door.z)===1&&!!p.path[0]&&same(p.path[0],door))))return false;
  return world.pawns.some(blocks)||(world.wildlife?.animals.some(blocks)??false)
    ||world.piles.some(p=>p.owner.type==='ground'&&same(p.owner,door))
    ||world.packed.some(p=>p.owner.type==='ground'&&same(p.owner,door));
}
function markedRoom(world:World,cell:Cell,topology:RoomTopology):RoomSpace|undefined {
  const room=topology.at(cell.x,cell.z);
  if(room?.kind!=='space'||room.touchesMapEdge)return;
  return world.structures.some(s=>isBedKind(s.kind)&&s.prisoner&&topology.at(s.x,s.z)===room)?room:undefined;
}
/** No roof requirement. Core's huge-region classification is not replaced by
 * an invented cell-count limit in our different room representation. */
export function prisonRoom(world:World,cell:Cell,topology?:RoomTopology):RoomSpace|undefined {
  return markedRoom(world,cell,topology??capturePrisonTopology(world));
}
export function prisonBedValid(world:World,bed:Structure,topology?:RoomTopology):boolean {
  if(isDoubleBedKind(bed.kind))return false;
  const present=world.structures.find(s=>s.id===bed.id&&isBedKind(s.kind)&&s.prisoner);
  if(!present)return false;
  const map=topology??capturePrisonTopology(world),room=markedRoom(world,present,map);
  return !!room&&footprintCells(present).every(c=>map.at(c.x,c.z)===room);
}
/** A need/wander target stays in the current air space. An explicit escape
 * intention may cross other spaces; the physical route still enforces solids,
 * corners, terrain, furniture and each door before committing an edge. */
export function prisonerAllowedCell(world:World,pawn:Pawn,cell:Cell,topology?:RoomTopology):boolean {
  if(!pawn.prisoner)return true;
  if(!inside(world,cell)||['rock','water'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain))return false;
  const map=topology??capturePrisonTopology(world),target=map.at(cell.x,cell.z);
  if(prisonBreakActive(pawn))return target?.kind==='space'||target?.kind==='doorway';
  if(pawn.prisoner.releasedAt!==undefined)return target?.kind==='space'||target?.kind==='doorway'&&world.structures.some(s=>isRoomDoor(s.kind)&&same(s,cell)&&!s.door?.forbidden);
  if(pawn.prisoner.escape){
    if(target?.kind==='doorway')return world.structures.some(s=>isRoomDoor(s.kind)&&same(s,cell)&&prisonDoorPassable(world,s));
    return target?.kind==='space';
  }
  const current=map.at(pawn.x,pawn.z);
  return current?.kind==='space'&&target===current;
}

function escapeGoals(world:World,pawn:Pawn,topology:RoomTopology):ReadonlySet<number>|undefined {
  const cache=cacheFor(world);
  const doors=world.structures.filter(s=>isRoomDoor(s.kind)&&(prisonBreakActive(pawn)|| (pawn.prisoner?.releasedAt!==undefined?!s.door?.forbidden:prisonDoorPassable(world,s)))).map(s=>s.z*world.width+s.x).sort((a,b)=>a-b),doorKey=doors.join(',');
  const passable=new Set(doors);
  const nodeAt=(x:number,z:number):number|undefined=>{
    const cell=topology.at(x,z);return cell?.kind==='space'?cell.id:cell?.kind==='doorway'&&passable.has(z*world.width+x)?-(z*world.width+x)-1:undefined;
  };
  if(cache.topology!==topology||cache.doors!==doorKey){
    cache.topology=topology;cache.doors=doorKey;cache.graph=new Map();cache.edgeCells=new Map();cache.exits=new Map();
    const connect=(a:number,b:number)=>{let peers=cache.graph.get(a);if(!peers){peers=new Set();cache.graph.set(a,peers);}peers.add(b);};
    for(const i of doors){
      const x=i%world.width,z=Math.floor(i/world.width),a=-i-1;
      for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){const b=nodeAt(x+dx!,z+dz!);if(b!==undefined){connect(a,b);connect(b,a);}}
    }
    for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)if(x===0||z===0||x===world.width-1||z===world.height-1){
      const node=nodeAt(x,z);if(node===undefined)continue;
      let cells=cache.edgeCells.get(node);if(!cells){cells=[];cache.edgeCells.set(node,cells);}cells.push(z*world.width+x);
    }
  }
  const start=nodeAt(pawn.x,pawn.z);if(start===undefined)return;
  let goals=cache.exits.get(start);
  if(!goals){
    const visited=new Set([start]),queue=[start],edges:number[]=[];
    for(let i=0;i<queue.length;i++){const node=queue[i]!;edges.push(...cache.edgeCells.get(node)??[]);for(const next of cache.graph.get(node)??[])if(!visited.has(next)){visited.add(next);queue.push(next);}}
    goals=new Set(edges.sort((a,b)=>a-b));cache.exits.set(start,goals);
  }
  return goals.size?goals:undefined;
}

/** The room graph is only an existence prefilter: water, actors and actual
 * routes remain the shared navigation system's responsibility. Null preserves
 * a budget wait; undefined means no route. No search runs without an opening. */
export function prisonerEscapeRoute(world:World,pawn:Pawn,search:(goals:ReadonlySet<number>)=>Reachability|null,topology?:RoomTopology):Cell[]|null|undefined {
  if(!pawn.prisoner||!inside(world,pawn))return;
  const goals=escapeGoals(world,pawn,topology??capturePrisonTopology(world));if(!goals)return;
  if(goals.has(pawn.z*world.width+pawn.x))return [];
  const reach=search(goals);if(!reach)return null;
  let best:Cell[]|undefined,bestCost=Infinity;
  for(const index of goals){
    const path=routeToCell(world,{x:index%world.width,z:Math.floor(index/world.width)},reach);if(!path)continue;
    const cost=routeCost(world,path,reach);if(cost<bestCost){best=path;bestCost=cost;}
  }
  return best;
}
