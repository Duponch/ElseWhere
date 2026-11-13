import { daylilyBeauty } from './flower-pot.ts';
import { BeautyMapCache,RoomBeautyCapture,type BeautyInput } from './room-beauty.ts';
import type { RoomTopology } from './room-topology.ts';
import { TICKS_PER_DAY,type World } from './types.ts';
import { isShelfKind,shelfStorageCells } from './shelf-storage.ts';

export const BEAUTY_NEED_INTERVAL=20;
const RISE_PER_HOUR=32,FALL_PER_HOUR=8;
const caches=new WeakMap<World,BeautyMapCache>();

/** Build the beauty input from physical world entities. Keeping this adapter
 * shared prevents the inspector from drifting away from the need simulation. */
export function worldBeautyInput(world:World):BeautyInput {
  const protectedCells=new Set(world.structures.filter(s=>isShelfKind(s.kind)).flatMap(s=>shelfStorageCells(s).map(c=>c.z*world.width+c.x)));
  const objects=[...world.piles.flatMap(p=>p.owner.type==='ground'?[{id:p.id,x:p.owner.x,z:p.owner.z,kind:p.kind,beauty:p.kind==='corpse'?-20:-4,visible:!protectedCells.has(p.owner.z*world.width+p.owner.x)}]:[]),
    ...world.packed.flatMap(p=>p.owner.type==='ground'?[{id:p.building.id,x:p.owner.x,z:p.owner.z,kind:'packed-furniture',beauty:-4}]:[]),
    ...world.structures.flatMap(s=>s.kind==='flower-pot'?[{id:s.id,x:s.x,z:s.z,kind:'flower',beauty:daylilyBeauty(s.flower?.plant)}]:[])];
  // The pot keeps its material/quality contribution; the plant is additional.
  // A baseBeauty override on a furniture kind is ignored by structureBeauty.
  return {width:world.width,height:world.height,tiles:world.tiles,structures:world.structures,filth:world.filth?.items,objects,version:Number(world.schemaVersion)};
}
export function captureWorldBeauty(world:World,topology:RoomTopology,cache=new BeautyMapCache()):RoomBeautyCapture {
  return new RoomBeautyCapture(cache.read(worldBeautyInput(world)),topology);
}

/** Samples the physical surroundings on a fixed simulation cadence. One map is
 * rebuilt for the colony and reused by every colonist in this pulse. */
export function advanceBeautyNeeds(world:World,topology:RoomTopology):void {
  if(world.schemaVersion<90||world.tick%BEAUTY_NEED_INTERVAL)return;
  let cache=caches.get(world);if(!cache){cache=new BeautyMapCache();caches.set(world,cache);}cache.invalidateAll();
  const view=captureWorldBeauty(world,topology,cache),step=BEAUTY_NEED_INTERVAL*24/TICKS_PER_DAY;
  for(const pawn of world.pawns){if(pawn.state==='dead'||pawn.state==='sleeping'||pawn.medicalSleep)continue;
    const perceived=view.perceived(pawn),target=Math.max(0,Math.min(100,40+perceived*10));
    pawn.beauty=target>pawn.beauty?Math.min(target,pawn.beauty+RISE_PER_HOUR*step):Math.max(target,pawn.beauty-FALL_PER_HOUR*step);
  }
}
