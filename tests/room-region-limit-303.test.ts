import {expect,test} from 'vitest';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {captureCleanliness,roomCleanliness} from '../src/sim/filth-room.ts';
import {captureRoomQuality} from '../src/sim/room-quality.ts';
import {WorkEnvironmentCache} from '../src/sim/work-environment.ts';
import {ROOM_REGION_LIMIT} from '../src/sim/room-region-limit-303.ts';
import type {Structure,World} from '../src/sim/types.ts';

// RimWorld 1.6: a room keeps its stats and role only up to 60 regions; a
// region is a connected part of a 12 x 12 block aligned on the map grid.
function wall(w:World,x:number,z:number):void {(fixtureBuilding(w,'wall',x,z) as Structure).material='wood';}
function walled(w:World,x0:number,z0:number,x1:number,z1:number):void {
  for(let x=x0-1;x<=x1+1;x++){wall(w,x,z0-1);wall(w,x,z1+1);}
  for(let z=z0;z<=z1;z++){wall(w,x0-1,z);wall(w,x1+1,z);}
}
/** Two closed rooms: interior x 1..96 (9 grid blocks wide), z 1..60 (6 blocks)
 * for 54 regions, and z 63..134 (7 blocks: 63..71, ..., 132..134) for 63. */
function rooms() {
  const w=deconstructionCamp(1,140);w.pawns[0]!.x=120;w.pawns[0]!.z=120;
  walled(w,1,1,96,60);walled(w,1,63,96,134);
  const small={x:40,z:30},large={x:40,z:100};
  return {w,small,large};
}

test('regions are counted per 12 x 12 grid block, and rooms over 60 regions lose their stats from schema 303',()=>{
  const {w,small,large}=rooms(),topology=captureRoomQuality(w).topology;
  const id=(c:{x:number;z:number})=>{const s=topology.at(c.x,c.z);if(s?.kind!=='space')throw Error('not a room');return s.id;};
  expect(topology.regionCount(id(small))).toBe(54);expect(topology.regionCount(id(large))).toBe(63);
  expect(54).toBeLessThanOrEqual(ROOM_REGION_LIMIT);expect(63).toBeGreaterThan(ROOM_REGION_LIMIT);
  // Cleanliness stat (research, surgery, infection, food): roomless beyond 60.
  expect(roomCleanliness(w,small)).not.toBeNull();expect(roomCleanliness(w,large)).toBeNull();
  // The room itself is still known (filth grouping, cleaning).
  expect(captureCleanliness(w).room(large)).not.toBeNull();
  // Room quality (room thoughts): none beyond 60.
  expect(captureRoomQuality(w).room(small)).not.toBeNull();expect(captureRoomQuality(w).room(large)).toBeNull();
});

test('a research bench in a room over 60 regions works in a room without role',()=>{
  const {w,small,large}=rooms();
  fixtureBuilding(w,'research-bench',small.x,small.z);fixtureBuilding(w,'research-bench',large.x,large.z);
  const environment=new WorkEnvironmentCache().read(w);
  expect(environment.room(small)?.role).toBe('laboratory');expect(environment.room(large)?.role).toBe('none');
});

test('before schema 303 every proper room keeps its stats',()=>{
  const {w,large}=rooms();(w as {schemaVersion:number}).schemaVersion=302;
  expect(roomCleanliness(w,large)).not.toBeNull();expect(captureRoomQuality(w).room(large)).not.toBeNull();
});
