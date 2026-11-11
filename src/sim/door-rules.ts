import type { Cell, Structure, World } from './types.ts';
import { isBlockMaterial } from './building-materials.ts';
import { structureAnchors } from './structure-navigation.ts';
import { schemaAtLeast } from './schema-range.ts';

/** Timed leaf segment, distinct from permission and logical opening. */
export interface DoorState {
  explorationApproacherId?:number;
  open:boolean;
  holdOpen:boolean;
  forbidden:boolean;
  changedAt:number;
  from:number;
  closeAt:number|null;
  lastTouch:number;
  /** Frozen duration of the current powered-door segment. Manual doors keep
   * their V34 shape; a supply change rebases this segment in updateDoors. */
  duration?:number;
}
export const DOOR_CLOSE_DELAY=11;
export const isRoomDoor=(kind:unknown):boolean=>kind==='door'||kind==='autodoor';
export const isPassageDoor=(kind:unknown):boolean=>isRoomDoor(kind)||kind==='fence-gate';
type DoorSubject=Pick<Structure,'material'>&{kind?:unknown;power?:Structure['power'];door?:DoorState};
/** Stuff factor of Core's DoorOpenSpeed stat (stone blocks .45, wood 1.2). */
const doorStuffSpeed=(material:unknown):number=>isBlockMaterial(material)? .45:material==='wood'?1.2:1;
export const manualDoorOpenTicks=(s:Pick<Structure,'material'>):number=>
  Math.round(45/doorStuffSpeed(s.material))/10;
/* Fence gates (schema 303), RimWorld 1.6. `FenceGate` sets its DoorOpenSpeed
 * base to 1.15 (Buildings_Structure.xml), so `Building_Door.TicksToOpenNow`,
 * RoundToInt(45 / (1.15 x stuff factor)), is shorter than a door of the same
 * material: wood 33 Core ticks instead of 38, steel and jade 39 instead of 45,
 * stone blocks 87 instead of 100. A gate records this duration in its door
 * state: built from schema 303, or, for a gate of an older save, from its next
 * opening (its pose is rebased then, so it never jumps). */
export const isFenceGateSpeedSchema303=schemaAtLeast(303);
export const FENCE_GATE_OPEN_SPEED_303=1.15;
export const fenceGateOpenTicks303=(s:Pick<Structure,'material'>):number=>
  Math.round(45/(FENCE_GATE_OPEN_SPEED_303*doorStuffSpeed(s.material)))/10;
/** Core's powered opening speed multiplier; never return zero because the
 * resident animation and save validator divide by this duration. */
export const doorOpenTicks=(s:DoorSubject):number=>{
  if(s.kind==='fence-gate')return s.door?.duration??manualDoorOpenTicks(s);
  const manual=manualDoorOpenTicks(s);
  return s.kind==='autodoor'&&s.power?.on===true&&!('breakdown' in s&&s.breakdown)?manual/4:manual;
};
export const doorMotionTicks=(s:DoorSubject):number=>s.kind==='autodoor'||s.kind==='fence-gate'?(s.door?.duration??doorOpenTicks(s)):manualDoorOpenTicks(s);
export const newDoorState=(tick:number):DoorState=>({open:false,holdOpen:false,forbidden:false,changedAt:tick,from:0,closeAt:null,lastTouch:-12});
export function builtDoorState(world:World,s:Cell&DoorSubject):DoorState {
  const state:DoorState={...newDoorState(world.tick),...(s.kind==='autodoor'?{duration:doorOpenTicks(s)}:s.kind==='fence-gate'&&isFenceGateSpeedSchema303(world.schemaVersion)?{duration:fenceGateOpenTicks303(s)}:{})};
  if(world.piles.some(p=>p.owner.type==='ground'&&p.owner.x===s.x&&p.owner.z===s.z)||world.packed.some(p=>p.owner.type==='ground'&&p.owner.x===s.x&&p.owner.z===s.z)) {
    state.open=true;state.closeAt=world.tick+(state.duration??doorOpenTicks(s))+DOOR_CLOSE_DELAY;
  }
  return state;
}
export function doorOpenness(s:Structure,tick:number):number {
  const d=s.door!;
  return Math.max(0,Math.min(1,d.from+(d.open?1:-1)*(tick-d.changedAt)/doorMotionTicks(s)));
}
// Same first-in-array-order match as scanning world.structures, via the shared
// anchor index (O(1) instead of O(structures) per pawn step).
export const doorAt=(world:World,c:Cell):Structure|undefined=>{for(const s of structureAnchors(world).anchoredAt(c.x,c.z))if(isPassageDoor(s.kind))return s;return undefined;};
export const doorWait=(s:Structure,tick:number):number=>s.door!.open?Math.max(0,(1-doorOpenness(s,tick))*doorMotionTicks(s)):doorOpenTicks(s);
/** Doors retain a solid frame at diagonal side cells, including while open. */
export const doorCorners=(world:World):ReadonlySet<number>=>new Set(world.structures.filter(s=>isPassageDoor(s.kind)).map(s=>s.z*world.width+s.x));

/** Visual axis follows adjacent solids/plans; rotation never changes footprint. */
export function doorOrientation(world:World,c:Cell):0|1 {
  return doorOrientations(world).get(c.z*world.width+c.x)??0;
}
export function doorOrientations(world:World):ReadonlyMap<number,0|1> {
  const scores=new Map<number,number>(),result=new Map<number,0|1>();
  for(const s of [...world.structures,...world.jobs])if(s.kind==='wall'||s.kind==='vent'||isRoomDoor(s.kind))scores.set(s.z*world.width+s.x,s.kind==='wall'||s.kind==='vent'?9:1);
  const score=(x:number,z:number)=>{
    if(x<0||z<0||x>=world.width||z>=world.height)return 0;
    if(['rock','water'].includes(world.tiles[z*world.width+x]!.terrain))return 9;
    return scores.get(z*world.width+x)??0;
  };
  for(const c of world.structures)if(isRoomDoor(c.kind))result.set(c.z*world.width+c.x,score(c.x-1,c.z)+score(c.x+1,c.z)>=score(c.x,c.z-1)+score(c.x,c.z+1)?0:1);
  return result;
}
