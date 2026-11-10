import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {targetDoorCanOpen263} from './world-target-building-263.ts';
import { hostileTo,isColonist } from './affiliation.ts';
import { isRoomDoor,isPassageDoor } from './door-rules.ts';
import { filteredStructures,structureAnchors } from './structure-navigation.ts';
import { prisonDoorPassable } from './prison-space.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import type { Cell,Pawn,World } from './types.ts';
import type { Mechanoid } from './mechanoid-state.ts';
import { isMechanoidTarget } from './combat-target.ts';

const actor=(world:World,origin:Cell):Pawn|Mechanoid|undefined=>'id' in origin?world.pawns.find(p=>p.id===origin.id)??world.mechanoids?.find(m=>m.id===origin.id):undefined;
const opensDoors=(pawn:Pawn|Mechanoid)=>!isMechanoidTarget(pawn)&&(isColonist(pawn)||!!pawn.visitor||pawn.prisoner?.releasedAt!==undefined||prisonBreakActive(pawn));
/** Capture only within one synchronous decision. Both endpoints protect 3D travel. */
export function hostileCells(world:World,pawn:Pawn|Mechanoid):Set<number> {
  const local=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick;
  const cells=new Set<number>();
  for(const p of world.pawns)if(p!==pawn&&(isMechanoidTarget(pawn)?!p.prisoner:hostileTo(pawn,p)||!!pawn.melee?.order&&!!p.melee?.order&&!(pawn.prisoner&&p.prisoner&&(prisonBreakActive(pawn)||prisonBreakActive(p))))&&p.state!=='dead'&&p.state!=='downed') {
    cells.add(p.z*world.width+p.x);
    if(p.motion&&p.motion.end>local)cells.add(p.motion.from.z*world.width+p.motion.from.x);
  }
  for(const m of world.mechanoids??[])if(m!==pawn&&m.state!=='dead'&&m.state!=='downed'){
    cells.add(m.z*world.width+m.x);if(m.motion&&m.motion.end>local)cells.add(m.motion.from.z*world.width+m.motion.from.x);
  }
  return cells;
}
/** The cells among `probes` that hostileCells(world,pawn) contains, without
 * building the whole set: an actor's cells are compared with the probes first,
 * and the (pure) hostility predicate is evaluated only for an actor standing
 * on, or leaving, a probed cell. */
function hostileProbeCells(world:World,pawn:Pawn|Mechanoid,probes:readonly number[]):Set<number> {
  const local=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick;
  const hit=new Set<number>(),width=world.width;
  for(const p of world.pawns){
    if(p===pawn)continue;
    const at=p.z*width+p.x,leaving=!!p.motion&&p.motion.end>local,from=leaving?p.motion!.from.z*width+p.motion!.from.x:0;
    const atHit=probes.includes(at),fromHit=leaving&&probes.includes(from);
    if(!atHit&&!fromHit)continue;
    if((isMechanoidTarget(pawn)?!p.prisoner:hostileTo(pawn,p)||!!pawn.melee?.order&&!!p.melee?.order&&!(pawn.prisoner&&p.prisoner&&(prisonBreakActive(pawn)||prisonBreakActive(p))))&&p.state!=='dead'&&p.state!=='downed'){
      if(atHit)hit.add(at);if(fromHit)hit.add(from);
    }
  }
  for(const m of world.mechanoids??[]){
    if(m===pawn||m.state==='dead'||m.state==='downed')continue;
    const at=m.z*width+m.x;if(probes.includes(at))hit.add(at);
    if(m.motion&&m.motion.end>local){const from=m.motion.from.z*width+m.motion.from.x;if(probes.includes(from))hit.add(from);}
  }
  return hit;
}
/** The actor's own obstacles, as ordered writes to a grid cell (a later write
 * wins): door verdicts, then hostile actors' cells. Only door structures are
 * read: every door predicate below is false for any other kind. */
export function actorObstacleWrites(world:World,origin:Cell,write:(index:number,value:0|1)=>void):void {
  const pawn=actor(world,origin);if(!pawn)return;
  const doors=filteredStructures(world,'passage-doors',s=>isPassageDoor(s.kind));
  if(!isMechanoidTarget(pawn)&&prisonBreakActive(pawn))for(const s of doors)write(s.z*world.width+s.x,0);
  if(!opensDoors(pawn))for(const s of doors)if(isRoomDoor(s.kind))write(s.z*world.width+s.x,(!isMechanoidTarget(pawn)&&pawn.prisoner?prisonDoorPassable(world,s):s.door?.open)?0:1);
  if(!isMechanoidTarget(pawn))for(const s of doors){const may=targetDoorCanOpen263(world,pawn,s);if(may!==undefined&&(!pawn.prisoner||pawn.prisoner.releasedAt!==undefined||prisonBreakActive(pawn)))write(s.z*world.width+s.x,s.door?.open||may&&!s.door?.forbidden?0:1);}
  for(const i of hostileCells(world,pawn))write(i,1);
}
/** Apply to the query's private grid, never to the caller's shared terrain mask. */
export function addActorObstacles(world:World,origin:Cell,grid:Uint8Array):void {
  actorObstacleWrites(world,origin,(index,value)=>{grid[index]=value;});
}
export function actorStepAllowed(world:World,origin:Cell,next:Cell):boolean {
  const pawn=actor(world,origin);if(!pawn)return true;
  const dx=next.x-origin.x,dz=next.z-origin.z,width=world.width;
  const occupied=hostileProbeCells(world,pawn,dx&&dz?[next.z*width+next.x,origin.z*width+next.x,next.z*width+origin.x]:[next.z*width+next.x]);
  // Anchor-indexed lookups: same pure predicates over exactly the structures
  // anchored on the probed cells, instead of scanning every structure per step.
  const anchors=structureAnchors(world);
  const free=(c:Cell)=>!occupied.has(c.z*world.width+c.x)&&(!opensDoors(pawn)?!anchors.anchoredAt(c.x,c.z).some(s=>(isMechanoidTarget(pawn)||targetDoorCanOpen263(world,pawn,s)!==true)&&isRoomDoor(s.kind)&&!(!isMechanoidTarget(pawn)&&pawn.prisoner?prisonDoorPassable(world,s):s.door?.open)):true);
  if(!isMechanoidTarget(pawn)){
    const closedTarget=(x:number,z:number)=>anchors.anchoredAt(x,z).some(s=>targetDoorCanOpen263(world,pawn,s)===false&&!s.door?.open);
    if(closedTarget(next.x,next.z)||dx&&dz&&(closedTarget(next.x,origin.z)||closedTarget(origin.x,next.z)))return false;
  }
  return free(next)&&(!dx||!dz||free({x:next.x,z:origin.z})&&free({x:origin.x,z:next.z}));
}

export function openHostileDoor(world:World,origin:Cell,x:number,z:number):boolean {
  const p=actor(world,origin);if(p&&!isMechanoidTarget(p)&&world.structures.some(s=>s.x===x&&s.z===z&&targetDoorCanOpen263(world,p,s)===true&&(!s.door?.forbidden||!isColonist(p))))return true;return !!p&&world.structures.some(s=>(!isMechanoidTarget(p)&&prisonBreakActive(p)?isPassageDoor(s.kind):isRoomDoor(s.kind))&&s.x===x&&s.z===z&&(!isMechanoidTarget(p)&&prisonBreakActive(p)||!opensDoors(p)&&(!isMechanoidTarget(p)&&p.prisoner?prisonDoorPassable(world,s):s.door?.open)));
}
