import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {targetDoorCanOpen263,targetBuildingPlayerUse263} from './world-target-building-263.ts';
import { isColonist } from './affiliation.ts';
import {rememberExplorationApproacher256,consumeExplorationApproacher256} from './exploration-door-256.ts';
import {resolveActualExplorationApproacher256} from './exploration-actors-256.ts';
import {captureActualFogPhysical256} from './exploration-physical-256.ts';
import {finishExplorationReveal256} from './exploration-runtime-256.ts';
import { prisonDoorPassable } from './prison-space.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { DOOR_CLOSE_DELAY, doorAt, doorOpenness, doorOpenTicks, doorMotionTicks, isPassageDoor } from './door-rules.ts';
import { invalidateAnimalPens } from './animal-pens.ts';
import { isBlockMaterial } from './building-materials.ts';
import {animalHaulDoorCanOpen282,animalHaulDoorPassable282} from './animal-haul-door-282.ts';
import {isSchema282OrLater} from './schema-compatibility-257.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type { Cell, CommandResult, Pawn, Structure, World } from './types.ts';
export type DoorCommand={type:'door-policy';structureId:number;setting:'holdOpen'|'forbidden';value:boolean};

function openDoor(world:World,s:Structure):void {
  const now=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick;
  const d=s.door!;
  const opening=!d.open;
  if(!d.open){d.from=doorOpenness(s,now);d.changedAt=now;d.open=true;if(d.holdOpen)invalidateAnimalPens(world);}
  // `changed` also marks a re-entry into an already open door (simulation
  // invalidation); only an actual opening changes what the door looks like.
  if(isCorePhysicalSchema297(Number(world.schemaVersion))){const state=physicalDoorState297(world);state.open.add(s);state.changed=true;if(opening)state.moved297.add(s);}
  d.closeAt=now+(1-doorOpenness(s,now))*doorMotionTicks(s)+DOOR_CLOSE_DELAY;
}
/** Called before committing an edge. Waiting consumes no path or travel distance. */
export function readyDoorEntry(world:World,pawn:Pawn,next:Cell):boolean {
  const now=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick;
  const s=doorAt(world,next);if(!s)return true;
  const d=s.door!,breaking=prisonBreakActive(pawn),permission=targetDoorCanOpen263(world,pawn,s);
  if(permission!==undefined&&!(pawn.prisoner&&pawn.prisoner.releasedAt===undefined&&!breaking)){if(!permission)return d.open&&doorOpenness(s,now)>=1-1e-9;if(d.forbidden&&isColonist(pawn)&&!breaking)return false;rememberExplorationApproacher256(world,d,pawn.id,isColonist(pawn));d.lastTouch=now;if(!d.open)openDoor(world,s);if(doorOpenness(s,now)<1-1e-9)return false;d.closeAt=now+DOOR_CLOSE_DELAY;return true;}
  if(pawn.prisoner&&pawn.prisoner.releasedAt===undefined&&!breaking){rememberExplorationApproacher256(world,d,pawn.id,false);return prisonDoorPassable(world,s);}
  if(!isColonist(pawn)&&!pawn.visitor&&pawn.prisoner?.releasedAt===undefined&&!breaking){rememberExplorationApproacher256(world,d,pawn.id,false);return d.open&&doorOpenness(s,now)>=1-1e-9;}
  if(d.forbidden&&!breaking)return false;
  rememberExplorationApproacher256(world,d,pawn.id,true);
  d.lastTouch=now;
  if(!d.open)openDoor(world,s);
  if(doorOpenness(s,now)<1-1e-9)return false;
  d.closeAt=now+DOOR_CLOSE_DELAY;return true;
}
/** Real domestic hauler at the threshold. Opening uses the existing timed
 * door transaction; a false result consumes neither path nor physical edge. */
export function readyAnimalHaulDoorEntry282(world:World,a:WildAnimal,next:Cell):boolean {
  const now=isCorePhysicalSchema297(world.schemaVersion)?effectiveLocal297(world):world.tick;
  if(!isSchema282OrLater(world.schemaVersion)||!a.domestic||a.state==='dead'||a.shipCryptosleepHeldAt277!==undefined)return false;
  const s=doorAt(world,next);if(!s)return true;
  if(world.wildlife?.animals.find(value=>value.id===a.id)!==a||Math.max(Math.abs(next.x-a.x),Math.abs(next.z-a.z))!==1||(a.motion?.end??0)>now)return false;
  const permission=animalHaulDoorCanOpen282(world,a,s);
  if(!permission){const passable=animalHaulDoorPassable282(world,a,s,false,now);if(passable)rememberExplorationApproacher256(world,s.door!,a.id,false);return passable;}
  rememberExplorationApproacher256(world,s.door!,a.id,true);
  const d=s.door!;d.lastTouch=now;
  if(!d.open)openDoor(world,s);
  if(doorOpenness(s,now)<1-1e-9)return false;
  d.closeAt=now+DOOR_CLOSE_DELAY;return true;
}
/** Notify a powered, quick autodoor when a friendly pawn commits the preceding
 * edge. The normal threshold check remains authoritative if the path or power
 * changes before arrival. Stone autodoors still open at the threshold. */
export function approachAutodoor(world:World,pawn:Pawn,next:Cell):void {
  const now=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick;
  if(!isColonist(pawn)&&!pawn.visitor&&pawn.prisoner?.releasedAt===undefined&&!prisonBreakActive(pawn)||pawn.path[0]?.x!==next.x||pawn.path[0]?.z!==next.z)return;
  const upcoming=pawn.path[1];if(!upcoming||Math.max(Math.abs(upcoming.x-next.x),Math.abs(upcoming.z-next.z))!==1)return;
  const s=doorAt(world,upcoming);if(s&&targetDoorCanOpen263(world,pawn,s)===false)return;
  if(s?.kind!=='autodoor'||!s.power?.on||s.breakdown||isBlockMaterial(s.material)||s.door?.forbidden&&!prisonBreakActive(pawn))return;
  rememberExplorationApproacher256(world,s.door!,pawn.id,true);
  s.door!.lastTouch=now;openDoor(world,s);
}
/** Index bodies/edges/items once, rather than scanning every actor for each door.
 * Edge endpoints protect the physical passage until the GPU-visible body clears. */
export function updateDoors(world:World):void {
  const doors=world.structures.filter(s=>isPassageDoor(s.kind));if(!doors.length)return;
  const bodies=new Set<number>(),friendly=new Set<number>(),objects=new Set<number>();
  const add=(c:Cell)=>bodies.add(c.z*world.width+c.x);
  for(const p of world.pawns){if(p.state==='dead'&&(p.body?.pileId!==undefined||p.body?.lostAt!==undefined))continue;add(p);if(p.motion&&p.motion.end>world.tick)add(p.motion.from);if(isColonist(p)||p.visitor||p.prisoner?.releasedAt!==undefined){friendly.add(p.z*world.width+p.x);if(p.motion&&p.motion.end>world.tick)friendly.add(p.motion.from.z*world.width+p.motion.from.x);}}
  for(const a of world.wildlife?.animals??[]){add(a);if(a.motion&&a.motion.end>world.tick)add(a.motion.from);}
  for(const p of world.piles)if(p.owner.type==='ground')objects.add(p.owner.z*world.width+p.owner.x);
  for(const p of world.packed)if(p.owner.type==='ground')objects.add(p.owner.z*world.width+p.owner.x);
  for(const s of doors) {
    const d=s.door!,i=s.z*world.width+s.x;
    if(s.kind==='autodoor'){
      const desired=doorOpenTicks(s);
      if(d.duration!==desired){
        const fraction=doorOpenness(s,world.tick);
        d.from=fraction;d.changedAt=world.tick;d.duration=desired;
        if(d.open&&d.closeAt!==null&&fraction<1)d.closeAt=world.tick+(1-fraction)*desired+DOOR_CLOSE_DELAY;
      }
    }
    if(!d.open)continue;
    finishExplorationReveal256(world,consumeExplorationApproacher256(world,i,d,doorOpenness(s,world.tick),
      id=>resolveActualExplorationApproacher256(world,id),()=>captureActualFogPhysical256(world)));
    if(bodies.has(i)){if(!d.forbidden&&friendly.has(i))d.lastTouch=world.tick;d.closeAt=world.tick+DOOR_CLOSE_DELAY;}
    if(d.closeAt!==null&&world.tick>=d.closeAt) {
      if(d.holdOpen)d.closeAt=null;
      else if(bodies.has(i)||objects.has(i))d.closeAt=world.tick+1;
      else {d.from=doorOpenness(s,world.tick);d.changedAt=world.tick;d.open=false;d.closeAt=null;}
    } else if(d.closeAt===null&&!d.holdOpen&&world.tick<d.lastTouch+12)d.closeAt=world.tick+DOOR_CLOSE_DELAY;
  }
}
export function applyDoorCommand(world:World,c:DoorCommand):CommandResult {
  if(!Number.isSafeInteger(c.structureId)||typeof c.value!=='boolean'||!['holdOpen','forbidden'].includes(c.setting))return {ok:false,code:'invalid-command',reason:'Réglage de porte invalide.'};
  const s=world.structures.find(s=>s.id===c.structureId&&isPassageDoor(s.kind));
  if(s&&!targetBuildingPlayerUse263(world,s))return {ok:false,code:'invalid-command',reason:'Cette porte appartient à une autre faction.'};
  if(!s)return {ok:false,code:'missing-target',reason:'Cette porte n’existe plus.'};
  s.door![c.setting]=c.value;
  invalidateAnimalPens(world);
  // An accepted edge remains physical. Future edges revalidate this permission.
  for(const p of world.pawns)p.planCooldown=0;
  return {ok:true};
}


interface PhysicalDoors297 {open:Set<Structure>;changed:boolean;visibleChanged297:boolean;moved297:Set<Structure>}
const physicalDoors297=new WeakMap<World,PhysicalDoors297>();
function physicalDoorState297(w:World):PhysicalDoors297 {
 let state=physicalDoors297.get(w);if(!state){state={open:new Set(w.structures.filter(s=>isPassageDoor(s.kind)&&s.door?.open)),changed:false,visibleChanged297:false,moved297:new Set()};physicalDoors297.set(w,state);}return state;
}
export function invalidatePhysicalDoors297(w:World):void {physicalDoors297.delete(w);}
/** Only open doors are inspected at physical cadence. Occupants/items are read
 * once, lazily, only when an actual close deadline becomes due. */
/** `moved297`: doors that actually opened or closed (presentation: their
 * open/from/changedAt changed); `exploration297`: a door revealed fog. */
export function advancePhysicalDoors297(w:World):{changed:boolean;topologyChanged:boolean;moved297:readonly Structure[];exploration297:boolean} {
 const now=effectiveLocal297(w),state=physicalDoorState297(w);let changed=state.changed,topologyChanged=state.changed,exploration297=false;state.changed=false;
 let bodies:Set<number>|undefined,friendly:Set<number>|undefined,objects:Set<number>|undefined;
 const capture=()=>{if(bodies)return;bodies=new Set();friendly=new Set();objects=new Set();
  const add=(a:{x:number;z:number})=>bodies!.add(a.z*w.width+a.x);
  for(const p of w.pawns){if(p.state==='dead'&&(p.body?.pileId!==undefined||p.body?.lostAt!==undefined))continue;add(p);if(p.motion&&p.motion.end>now)add(p.motion.from);
   if(isColonist(p)||p.visitor||p.prisoner?.releasedAt!==undefined){friendly!.add(p.z*w.width+p.x);if(p.motion&&p.motion.end>now)friendly!.add(p.motion.from.z*w.width+p.motion.from.x);}}
  for(const a of w.wildlife?.animals??[]){add(a);if(a.motion&&a.motion.end>now)add(a.motion.from);}
  for(const p of w.piles)if(p.owner.type==='ground')objects!.add(p.owner.z*w.width+p.owner.x);
  for(const p of w.packed)if(p.owner.type==='ground')objects!.add(p.owner.z*w.width+p.owner.x);
 };
 for(const s of state.open){const d=s.door!,i=s.z*w.width+s.x;if(!d.open){state.open.delete(s);continue;}
  if(d.explorationApproacherId!==undefined&&doorOpenness(s,now)>=1-1e-9){
   const reveal=consumeExplorationApproacher256(w,i,d,doorOpenness(s,now),id=>resolveActualExplorationApproacher256(w,id),()=>captureActualFogPhysical256(w));
   finishExplorationReveal256(w,reveal);changed=true;topologyChanged=true;
   // Presentation: only fog that actually lifted is a hard barrier.
   if(reveal.changedCells.length||reveal.interiorCells.length)exploration297=true;
  }
  if(d.closeAt===null||d.closeAt>now)continue;
  capture();changed=true;
  if(bodies!.has(i)){if(!d.forbidden&&friendly!.has(i))d.lastTouch=now;d.closeAt=now+DOOR_CLOSE_DELAY;}
  if(d.holdOpen)d.closeAt=null;
  else if(bodies!.has(i)||objects!.has(i))d.closeAt=now+DOOR_CLOSE_DELAY;
  else {d.from=doorOpenness(s,now);d.changedAt=now;d.open=false;d.closeAt=null;state.open.delete(s);topologyChanged=true;state.moved297.add(s);}
 }
 const moved297=[...state.moved297];state.moved297.clear();
 return {changed,topologyChanged,moved297,exploration297};
}
