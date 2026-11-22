import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { penRegion, type PenRegion } from './animal-pens.ts';
import { readyDoorEntry } from './doors.ts';
import { doorAt } from './door-rules.ts';
import { effectiveCore297, effectiveLocal297 } from './core-phase-297.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { canStep, inBounds, routeToCell, type Reachability } from './pathfinding.ts';
import { releaseWork } from './work-release.ts';
import { structuresOfKind } from './structure-navigation.ts';
import { animalNavigation, animalJogEdgeCore377 } from './wildlife-navigation.ts';
import { animalBody } from './wildlife-health.ts';
import { CIVIL_TRANSIT_BLOCKERS } from './travel.ts';
import { CORE_MOVE_DIAGONAL297, HUMAN_MOVE_SPEED297, coreMoveDuration297 } from './human-move-core-297.ts';
import type { AnimalHandlingTask } from './domestic-state.ts';
import type { NeedContext } from './needs.ts';
import type { Cell, Pawn, World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';

/** Schema 377: leading animals to a pen follows Core 1.6.4871
 * JobDriver_RopeToDestination / JobDriver_RopeToPen, JobDriver_FollowRoper,
 * Toils_Rope and Pawn_PathFollower, rewritten for Elsewhere's macro/Core
 * ticks. The handler walks its own route; the attached animals follow that
 * route a few cells behind instead of finding their own way to the pen. */
export const isLeadSchema377=(version:unknown):boolean=>typeof version==='number'&&version>=377;
/** Toils_Rope.RopeWorkDuration. */
export const ROPE_WORK_TICKS377=30;
/** Pawn_PathFollower.WaitForRopeeTicks. */
export const ROPE_STRETCH_WAIT377=60;
/** Pawn_PathFollower.RopeLength (= Pawn_RopeTracker.RopeLength). */
export const ROPE_LENGTH377=8;
/** JobDriver_FollowRoper: marching order only when the handler is this close. */
export const MARCHING_RANGE377=7.2;
/** Deepest marching position read behind the handler (-2 - 3). */
export const TRAIL_CELLS377=5;

export type LeadTask377=AnimalHandlingTask & {kind:'lead';markerId:number};
type LeadContext377=NeedContext & {blocked():Uint8Array;searchWith?(grid:Uint8Array,goals:ReadonlySet<number>):Reachability|null};

const key=(world:World,c:Cell)=>c.z*world.width+c.x;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const ropeesOf=(task:Pick<AnimalHandlingTask,'ropees'>):readonly number[]=>task.ropees??[];
const animalById=(world:World,id:number)=>world.wildlife?.animals.find(a=>a.id===id);

/** Verse.Gen.HashOffset of an id (Gen.HashCombineInt(id, 169495093)), in
 * 32-bit integer arithmetic like the C# cast. */
export function hashOffset377(id:number):number {
  const seed=id|0;
  return (seed^((169495093+2654435769+((seed<<6)|0)+(seed>>2))|0))|0;
}

/** Arrived (JobDriver_RopeToPen.HasRopeeArrived, enclosed pen): the animal
 * stands in the pen's connected area. It is no longer followed or drawn. */
export const ropeeArrived377=(world:World,region:PenRegion|undefined,a:Cell):boolean=>!!region?.cells.has(key(world,a));

/** The handler's route avoids fences while it holds fence-blocked animals
 * (Pawn.ShouldAvoidFences): every penned roamer is fence-blocked. */
function roperGrid(world:World,base:Uint8Array,withRopees:boolean):Uint8Array {
  if(!withRopees)return base;
  const fences=structuresOfKind(world,'fence');if(!fences.length)return base;
  const grid=base.slice();for(const s of fences)grid[key(world,s)]=1;return grid;
}

/** Core AnimalPenUtility.RopeAttachmentInteractionCell: the handler's own
 * cell when it is a cardinal neighbour walkable by both, else the cardinal
 * neighbours in GenAdj.CardinalDirections order (north, east, south, west). */
const CARDINALS:readonly Cell[]=[{x:0,z:1},{x:1,z:0},{x:0,z:-1},{x:-1,z:0}];
function goodAttachment(world:World,pawnGrid:Uint8Array,free:(c:Cell)=>boolean,a:Cell,c:Cell):boolean {
  return Math.abs(c.x-a.x)+Math.abs(c.z-a.z)===1&&inBounds(world,c.x,c.z)&&!pawnGrid[key(world,c)]&&free(c);
}
function attachmentCells(world:World,pawnGrid:Uint8Array,free:(c:Cell)=>boolean,a:Cell):Cell[] {
  return CARDINALS.map(d=>({x:a.x+d.x,z:a.z+d.z})).filter(c=>goodAttachment(world,pawnGrid,free,a,c));
}

/** Core AnimalPenUtility.FindPlaceInPenToStand picks a random standable cell
 * of the marker's region. Adapted deterministically: the marker cell when
 * standable, else the nearest standable pen cell (index order on ties). */
export function penStandCell377(world:World,markerId:number,pawnGrid:Uint8Array,free:(c:Cell)=>boolean):Cell|undefined {
  const marker=world.structures.find(s=>s.id===markerId&&s.kind==='pen-marker'),region=penRegion(world,markerId);
  if(!marker||!region)return;
  const ok=(c:Cell)=>region.cells.has(key(world,c))&&!pawnGrid[key(world,c)]&&free(c)&&!doorAt(world,c);
  if(ok(marker))return {x:marker.x,z:marker.z};
  let best:Cell|undefined,bestDistance=Infinity;
  for(const i of [...region.cells].sort((a,b)=>a-b)){
    const c={x:i%world.width,z:Math.floor(i/world.width)},d=(c.x-marker.x)**2+(c.z-marker.z)**2;
    if(d<bestDistance&&ok(c)){best=c;bestDistance=d;}
  }
  return best;
}

function search(world:World,pawn:Pawn,ctx:LeadContext377,grid:Uint8Array,goals:ReadonlySet<number>):Reachability|null {
  return ctx.searchWith?ctx.searchWith(grid,goals):ctx.search(goals);
}
function assignPath(task:LeadTask377,pawn:Pawn,path:Cell[]):void {
  pawn.path=path;pawn.state=path.length?'moving':'working';task.trail377=[];
}

/** One roping (Toils_Rope.RopePawn): the animal's own activity ends, it is
 * attached at once and both wait the 30 ticks of the roping work. */
function rope(world:World,pawn:Pawn,task:LeadTask377,target:WildAnimal):void {
  delete target.animalThermalRefuge288;target.path=[];delete target.meal;target.nextDecision=world.tick;
  if(!target.motion||target.motion.end<=effectiveLocal297(world))target.state='idle';
  target.domestic!.penMarkerId=task.markerId;
  task.ropees=[...ropeesOf(task),target.id];delete task.gatherId;
  task.phase='lead';task.ropeUntil377=effectiveCore297(world)+ROPE_WORK_TICKS377;
  pawn.path=[];pawn.state='working';task.trail377=[];
}

/** JobDriver_RopeToDestination.FindAnotherAnimalToRope: the closest animal
 * within 10 cells of the handler (GenClosest radius), reachable by touch with
 * the handler's fence-avoiding route, going to this same pen. */
function nextGather(world:World,pawn:Pawn,task:LeadTask377,ctx:LeadContext377,region:PenRegion,usable:(a:WildAnimal)=>boolean,claimed:ReadonlySet<number>,free:(c:Cell)=>boolean):number|undefined {
  if(ropeesOf(task).length>=10)return;
  const candidates=(world.wildlife?.animals??[]).filter(a=>!ropeesOf(task).includes(a.id)&&!claimed.has(a.id)&&allowedAreaAllows(world,pawn,a)
    &&!region.cells.has(key(world,a))&&usable(a)&&(a.x-pawn.x)**2+(a.z-pawn.z)**2<=100)
    .sort((a,b)=>(a.x-pawn.x)**2+(a.z-pawn.z)**2-((b.x-pawn.x)**2+(b.z-pawn.z)**2)||a.id-b.id);
  if(!candidates.length)return;
  const grid=roperGrid(world,ctx.blocked(),true),cells=new Map<number,number>();
  for(const a of candidates)for(const c of attachmentCells(world,grid,free,a))if(!cells.has(key(world,c)))cells.set(key(world,c),a.id);
  if(!cells.size)return;
  const reach=search(world,pawn,ctx,grid,new Set(cells.keys()));if(!reach)return;
  return candidates.find(a=>attachmentCells(world,grid,free,a).some(c=>same(c,pawn)||!!routeToCell(world,c,reach)))?.id;
}

export interface Lead377Services {
  ropeable(a:WildAnimal):boolean;
  usable(world:World,a:WildAnimal,markerId:number):PenRegion|undefined;
  handler(p:Pawn):boolean;
  claimedIds(world:World):Set<number>;
}

/** The handler's own turn (between two edges, at a macro tick). */
export function processLeading377(world:World,pawn:Pawn,task:LeadTask377,ctx:LeadContext377,s:Lead377Services):void {
  if(!allowedAreaServicesAllowed(world,pawn)||!s.handler(pawn)){interruptWork(world,pawn);return;}
  const first=animalById(world,task.animalId);
  const members=ropeesOf(task).map(id=>animalById(world,id));
  if(!first||!s.ropeable(first)||members.some(a=>!a||!s.ropeable(a))){interruptWork(world,pawn);return;}
  const region=s.usable(world,first,task.markerId);
  if(!region){interruptWork(world,pawn);return;}
  const nav=animalNavigation(world,true),free=(c:Cell)=>nav.free(c);
  const ropees=members as WildAnimal[];
  if(ropees.length&&ropees.every(a=>ropeeArrived377(world,region,a))){if(!releaseWork(world,pawn))interruptWork(world,pawn);return;}
  const core=effectiveCore297(world);
  // Approach: walk to a rope attachment cell of the first or next animal.
  if(task.phase==='approach'||task.phase==='gather'){
    const target=animalById(world,task.phase==='approach'?task.animalId:task.gatherId!);
    if(task.phase==='gather'&&(!target||!s.ropeable(target)||!s.usable(world,target,task.markerId)||region.cells.has(key(world,target)))){
      delete task.gatherId;task.phase='lead';pawn.path=[];pawn.state='working';return;
    }
    if(!target)return interruptWork(world,pawn);
    const grid=roperGrid(world,ctx.blocked(),ropees.length>0);
    if(goodAttachment(world,grid,free,target,pawn)){rope(world,pawn,task,target);return;}
    const end=pawn.path.at(-1);
    if(end&&goodAttachment(world,grid,free,target,end)&&canStep(world,pawn,pawn.path[0]!,ctx.blocked(),CIVIL_TRANSIT_BLOCKERS)){pawn.state='moving';return;}
    const goals=attachmentCells(world,grid,free,target);
    if(!goals.length){interruptWork(world,pawn);return;}
    const reach=search(world,pawn,ctx,grid,new Set(goals.map(c=>key(world,c))));if(!reach){pawn.path=[];return;}
    const path=goals.map(c=>routeToCell(world,c,reach)).filter((p):p is Cell[]=>!!p).sort((a,b)=>a.length-b.length)[0];
    if(!path){interruptWork(world,pawn);return;}
    assignPath(task,pawn,path);return;
  }
  // Roping work, then one search for another animal to rope.
  if(task.ropeUntil377!==undefined){
    if(core<task.ropeUntil377){pawn.path=[];pawn.state='working';return;}
    delete task.ropeUntil377;
    const gather=nextGather(world,pawn,task,ctx,region,a=>s.ropeable(a)&&!!s.usable(world,a,task.markerId),s.claimedIds(world),free);
    if(gather!==undefined){task.gatherId=gather;task.phase='gather';pawn.path=[];pawn.state='working';return;}
  }
  // Goto the stand cell in the pen at the slowest animal's pace.
  const grid=roperGrid(world,ctx.blocked(),true);
  const stand=penStandCell377(world,task.markerId,grid,free);
  if(!stand){interruptWork(world,pawn);return;}
  if(same(pawn,stand)){pawn.path=[];pawn.state='working';return;}
  const end=pawn.path.at(-1);
  if(end&&same(end,stand)&&canStep(world,pawn,pawn.path[0]!,ctx.blocked(),CIVIL_TRANSIT_BLOCKERS)){pawn.state='moving';return;}
  const reach=search(world,pawn,ctx,grid,new Set([key(world,stand)]));if(!reach){pawn.path=[];return;}
  const path=routeToCell(world,stand,reach);
  if(!path){interruptWork(world,pawn);return;}
  assignPath(task,pawn,path);
}

/** Marching cell of JobDriver_FollowRoper.MarchingOrder: 2 to 5 cells behind
 * the handler on its route, shifted aside for two animals out of three. */
function marchingCell(world:World,pawn:Pawn,task:LeadTask377,a:WildAnimal,index:number,free:(c:Cell)=>boolean,step:(a:Cell,b:Cell)=>boolean):Cell {
  const trail=task.trail377??[],back=Math.min(2+index%4,trail.length);
  const at=(k:number):Cell|undefined=>k>0?trail[trail.length-k]:k===0?{x:pawn.x,z:pawn.z}:pawn.path[-k-1];
  let cell=at(back)!;
  const side=Math.abs(hashOffset377(a.id))%3;
  // value + 1 < NodesLeftCount, with value = -back and NodesLeftCount = path + 1.
  if(side!==0&&1-back<pawn.path.length+1){
    const ahead=at(back-1)!,dx=ahead.x-cell.x,dz=ahead.z-cell.z;
    const shifted=side===1?{x:cell.x+dz,z:cell.z-dx}:{x:cell.x-dz,z:cell.z+dx};
    if(inBounds(world,shifted.x,shifted.z)&&free(shifted)&&!doorAt(world,shifted)&&!doorAt(world,cell)&&step(cell,shifted))cell=shifted;
  }
  return cell;
}

/** Every macro tick, whatever the handler's own turn: arrivals, the
 * followers' destinations (JobDriver_FollowRoper) and the doors they open.
 * Routes are computed only when a follower's destination changed. */
export function advanceRopes377(world:World):void {
  if(!isLeadSchema377(world.schemaVersion))return;
  const leaders=world.pawns.filter(p=>p.animalHandling?.kind==='lead'&&p.animalHandling.markerId!==undefined);
  if(!leaders.length)return;
  let nav:ReturnType<typeof animalNavigation>|undefined;
  const reader=()=>nav??=animalNavigation(world,true);
  const now=effectiveLocal297(world),core=effectiveCore297(world);
  for(const pawn of leaders){
    const task=pawn.animalHandling as LeadTask377,region=penRegion(world,task.markerId);
    if(!region)continue;
    const ropees=ropeesOf(task).map(id=>animalById(world,id)).filter((a):a is WildAnimal=>!!a);
    if(ropees.length!==ropeesOf(task).length)continue;
    // Arrivals: the rope is dropped as soon as the animal stands in the pen.
    for(const a of ropees)if(ropeeArrived377(world,region,a)&&a.path.length)a.path=[];
    if(ropees.length&&ropees.every(a=>ropeeArrived377(world,region,a))){
      for(const a of ropees)if(!a.motion||a.motion.end<=now)a.state='idle';
      if(!releaseWork(world,pawn))interruptWork(world,pawn);continue;
    }
    // A moving target makes the planned attachment cell useless: stop after
    // the current edge and let the handler's next turn find a new one.
    if((task.phase==='approach'||task.phase==='gather')&&pawn.path.length){
      const target=animalById(world,task.phase==='approach'?task.animalId:task.gatherId??-1),end=pawn.path.at(-1)!;
      if(!target||Math.abs(end.x-target.x)+Math.abs(end.z-target.z)!==1)pawn.path=[];
    }
    if(!ropees.length)continue;
    const moving=pawn.path.length>0||!!pawn.motion&&pawn.motion.end>now;
    // GotoStandCell: the handler stopped at its stand cell inside the pen.
    const stand=task.phase==='lead'&&task.ropeUntil377===undefined&&!moving&&region.cells.has(key(world,pawn))?{x:pawn.x,z:pawn.z}:undefined;
    const navigation=reader(),free=(c:Cell)=>navigation.free(c);
    let index=-1;
    for(const a of ropees){
      index++;
      if(ropeeArrived377(world,region,a))continue;
      // Toils_Rope ForceWait: the animal just roped stands during the work.
      if(task.ropeUntil377!==undefined&&task.ropeUntil377>core&&a.id===ropeesOf(task).at(-1)){a.path=[];continue;}
      const touching=(c:Cell)=>same(c,pawn)||Math.max(Math.abs(c.x-pawn.x),Math.abs(c.z-pawn.z))===1&&navigation.step(c,pawn);
      let goals:Cell[],reached:boolean;
      const marching=!stand&&moving&&(pawn.x-a.x)**2+(pawn.z-a.z)**2<=MARCHING_RANGE377**2;
      if(stand){goals=[stand];reached=same(a,stand)||touching(a);}
      else if(marching){const m=marchingCell(world,pawn,task,a,index,free,navigation.step);goals=[m];reached=same(a,m);}
      else {
        goals=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(dx||dz){const c={x:pawn.x+dx,z:pawn.z+dz};if(inBounds(world,c.x,c.z)&&free(c)&&navigation.step(c,pawn))goals.push(c);}
        reached=touching(a);
      }
      if(reached){a.path=[];if(!a.motion||a.motion.end<=now)a.state='idle';continue;}
      const end=a.path.at(-1);
      if(!end||!goals.some(g=>same(g,end))){
        // Allowed-area limits never hold a roped animal: route from its cell.
        const path=navigation.route({x:a.x,z:a.z},goals);
        if(!path?.length){
          // FollowRoper ends and the rope breaks when the handler cannot be
          // reached; marching and stand cells fall back to touching the handler.
          if(marching){a.path=[];continue;}
          interruptWork(world,pawn);break;
        }
        a.path=path;
      }
      if(a.path.length&&(!a.motion||a.motion.end<=now))a.state='moving';
      // A roped animal opens the doors its handler may open (Building_Door.PawnCanOpen).
      const next=a.path[0];
      if(next&&doorAt(world,next)&&Math.max(Math.abs(next.x-a.x),Math.abs(next.z-a.z))===1){
        if(doorAt(world,next)!.door?.forbidden){interruptWork(world,pawn);break;}
        readyDoorEntry(world,pawn,next);
      }
    }
  }
}

/** Pawn_PathFollower: after entering a cell, a handler whose rope is
 * stretched beyond its length waits 60 ticks before trying again. */
export function roperHeld377(world:World,pawn:Pawn,core:number):boolean {
  const task=pawn.animalHandling;
  if(task?.kind!=='lead'||!task.ropees?.length||task.markerId===undefined||!isLeadSchema377(world.schemaVersion))return false;
  if(task.ropeWait377!==undefined){if(task.ropeWait377>core)return true;delete task.ropeWait377;}
  const region=penRegion(world,task.markerId);
  for(const id of task.ropees){
    const a=animalById(world,id);
    if(!a||ropeeArrived377(world,region,a))continue;
    if((a.x-pawn.x)**2+(a.z-pawn.z)**2>ROPE_LENGTH377**2){task.ropeWait377=core+ROPE_STRETCH_WAIT377;return true;}
  }
  return false;
}

/** startTravel hook for a handler: remember the left cell (marching order)
 * and, on the way to the pen, move no faster than the slowest animal
 * (JobDriver.locomotionUrgencySameAs: the animal's cost into the same cell,
 * diagonal from the animal's own cell as in Pawn_PathFollower). The slower
 * pace is kept as the edge's captured speed factor, so a saved edge replays
 * the same duration. */
export function roperSpeedFactor377(world:World,pawn:Pawn,next:Cell,speedFactor:number,terrainDelay:number,walk:boolean):number {
  const task=pawn.animalHandling;
  if(task?.kind!=='lead'||task.markerId===undefined||!isLeadSchema377(world.schemaVersion))return speedFactor;
  if(next.x!==pawn.x||next.z!==pawn.z){const trail=task.trail377??=[];trail.push({x:pawn.x,z:pawn.z});if(trail.length>TRAIL_CELLS377)trail.shift();}
  if(task.phase!=='lead'||task.ropeUntil377!==undefined||!task.ropees?.length)return speedFactor;
  const region=penRegion(world,task.markerId);
  let slowest=0;
  for(const id of task.ropees){
    const a=animalById(world,id);
    if(a&&!ropeeArrived377(world,region,a))slowest=Math.max(slowest,animalJogEdgeCore377(world,a,next,animalBody(a).capacities.moving));
  }
  if(slowest<=coreMoveDuration297(pawn,next,speedFactor,terrainDelay,walk)*10)return speedFactor;
  const base=Math.min(450,slowest-terrainDelay*10);
  if(base<=1)return speedFactor;
  return 60/(HUMAN_MOVE_SPEED297*base)*(next.x!==pawn.x&&next.z!==pawn.z?CORE_MOVE_DIAGONAL297:1);
}
