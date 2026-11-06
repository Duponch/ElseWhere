import type { Cell, Structure, World } from './types.ts';
import { isBlockMaterial } from './building-materials.ts';
import { structureAnchors } from './structure-navigation.ts';

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
export const manualDoorOpenTicks=(s:Pick<Structure,'material'>):number=>
  Math.round(45/(isBlockMaterial(s.material)? .45:s.material==='wood'?1.2:1))/10;
/** Core's powered opening speed multiplier; never return zero because the
 * resident animation and save validator divide by this duration. */
export const doorOpenTicks=(s:DoorSubject):number=>{
  const manual=manualDoorOpenTicks(s);
  return s.kind==='autodoor'&&s.power?.on===true&&!('breakdown' in s&&s.breakdown)?manual/4:manual;
};
export const doorMotionTicks=(s:DoorSubject):number=>s.kind==='autodoor'?(s.door?.duration??doorOpenTicks(s)):manualDoorOpenTicks(s);
export const newDoorState=(tick:number):DoorState=>({open:false,holdOpen:false,forbidden:false,changedAt:tick,from:0,closeAt:null,lastTouch:-12});
export function builtDoorState(world:World,s:Cell&DoorSubject):DoorState {
  const state:DoorState={...newDoorState(world.tick),...(s.kind==='autodoor'?{duration:doorOpenTicks(s)}:{})};
  if(world.piles.some(p=>p.owner.type==='ground'&&p.owner.x===s.x&&p.owner.z===s.z)||world.packed.some(p=>p.owner.type==='ground'&&p.owner.x===s.x&&p.owner.z===s.z)) {
    state.open=true;state.closeAt=world.tick+doorOpenTicks(s)+DOOR_CLOSE_DELAY;
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
