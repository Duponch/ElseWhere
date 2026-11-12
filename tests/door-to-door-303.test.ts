import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {startTravel} from '../src/sim/movement.ts';
import {furnitureDelay} from '../src/sim/furniture-travel.ts';
import {validCapturedTravelDelay} from '../src/sim/captured-travel-delay.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {isDoorToDoorSchema303,withDoorToDoorDelay303} from '../src/sim/door-to-door-303.ts';
import {isCorePhysicalSchema297} from '../src/sim/physical-schema-297.ts';
import {SCHEMA_VERSION,type Structure,type World} from '../src/sim/types.ts';

// RimWorld 1.6: entering a door from a door costs 45 more ticks when neither
// door is in free passage (open and held open, for the stepping pawn).
function openDoor(w:World,x:number,z:number,holdOpen=false):Structure {
  const s:Structure={id:w.nextId++,kind:'door',material:'wood',x,z,orientation:0,footprint:'standard',door:{...newDoorState(w.tick),open:true,from:1,holdOpen}};
  w.structures.push(s);return s;
}
function airlock(hold:'none'|'first'|'second'='none') {
  const w=deconstructionCamp(1),p=w.pawns[0]!;
  openDoor(w,16,16,hold==='first');openDoor(w,17,16,hold==='second');
  p.x=16;p.z=16;delete p.motion;p.moveCooldown=0;p.path=[];
  return {w,p};
}
const length=(w:World)=>w.pawns[0]!.motion!.end-w.pawns[0]!.motion!.start;

test('a Core step from one door into another pays 45 Core ticks unless one door is held open',()=>{
  expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(303);
  const paid=airlock();expect(isCorePhysicalSchema297(paid.w.schemaVersion)).toBe(true);
  expect(startTravel(paid.w,paid.p,{x:17,z:16})).toBe(true);
  for(const hold of ['first','second'] as const){
    const free=airlock(hold);expect(startTravel(free.w,free.p,{x:17,z:16})).toBe(true);
    // The door's own entry cost is kept; the surcharge adds 45 Core ticks to it.
    expect(paid.p.motion!.terrainDelay).toBe(withDoorToDoorDelay303(free.p.motion!.terrainDelay??0));
    expect(length(paid.w)-length(free.w)).toBeCloseTo(4.5,9);
  }
  // A door entered from bare ground, or bare ground left from a door, pays nothing more.
  const reference=airlock('second');expect(startTravel(reference.w,reference.p,{x:17,z:16})).toBe(true);
  const ground=airlock();ground.p.x=15;
  expect(startTravel(ground.w,ground.p,{x:16,z:16})).toBe(true);expect(ground.p.motion!.terrainDelay).toBe(reference.p.motion!.terrainDelay);
  const leaving=airlock(),plain=furnitureDelay(leaving.w,{x:16,z:16},{x:16,z:17});expect(plain).toBeLessThan(4.5);
  expect(startTravel(leaving.w,leaving.p,{x:16,z:17})).toBe(true);expect(leaving.p.motion!.terrainDelay??0).toBe(plain);
});

test('the captured surcharge is saved, reloaded exactly and refused before schema 303',()=>{
  const {w,p}=airlock();expect(startTravel(w,p,{x:17,z:16})).toBe(true);
  expect(validateWorld(w)).toEqual([]);
  const copy=deserializeWorld(serializeWorld(w));expect(copy).toEqual(w);
  expect(isDoorToDoorSchema303(302)).toBe(false);expect(isDoorToDoorSchema303(303)).toBe(true);
  expect(validCapturedTravelDelay(4.5,303)).toBe(true);expect(validCapturedTravelDelay(4.5,302)).toBe(false);
  // Any valid delay plus the surcharge, once: snow .4, fence 2, known trap 4.
  for(const base of [.4,2,4])expect(validCapturedTravelDelay(withDoorToDoorDelay303(base),303)).toBe(true);
  expect(withDoorToDoorDelay303(.4)).toBe(4.9);expect(withDoorToDoorDelay303(2)).toBe(6.5);
  expect(validCapturedTravelDelay(4.55,303)).toBe(false);expect(validCapturedTravelDelay(4.7+4.5,303)).toBe(false);
});

test('a schema 302 save migrates by number only; its captured steps keep their cost',()=>{
  const {w,p}=airlock('second');expect(startTravel(w,p,{x:17,z:16})).toBe(true);
  const old=JSON.parse(serializeWorld(w));old.schemaVersion=302;
  const migrated=deserializeWorld(JSON.stringify(old));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(migrated).toEqual(w);
});
