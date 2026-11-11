import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {builtDoorState,doorMotionTicks,doorOpenness,fenceGateOpenTicks303,manualDoorOpenTicks,newDoorState} from '../src/sim/door-rules.ts';
import {readyDoorEntry} from '../src/sim/doors.ts';
import {validateDoors} from '../src/sim/door-save.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SCHEMA_VERSION,type Structure,type World} from '../src/sim/types.ts';

// RimWorld 1.6: FenceGate has DoorOpenSpeed 1.15, so TicksToOpenNow is
// RoundToInt(45 / (1.15 x stuff factor)) Core ticks (10 Core ticks = 1 here).
function gate(w:World,material:Structure['material'],x=16,z=16):Structure {
  const s={id:w.nextId++,kind:'fence-gate',material,x,z,orientation:0,footprint:'standard'} as Structure;
  w.structures.push(s);s.door=builtDoorState(w,s);return s;
}

test('a fence gate opens 1.15 times as fast as a door of the same material',()=>{
  expect(SCHEMA_VERSION).toBe(303);
  const values=(['wood','steel','jade','granite-blocks'] as const).map(material=>[fenceGateOpenTicks303({material}),manualDoorOpenTicks({material})]);
  expect(values).toEqual([[3.3,3.8],[3.9,4.5],[3.9,4.5],[8.7,10]]);
  const w=deconstructionCamp(1),s=gate(w,'wood');
  expect(s.door!.duration).toBe(3.3);expect(doorMotionTicks(s)).toBe(3.3);
  expect(validateDoors(w,303)).toEqual([]);expect(validateWorld(w)).toEqual([]);
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('before schema 303 a gate keeps the door speed, and a recorded gate speed is refused',()=>{
  const w=deconstructionCamp(1);(w as {schemaVersion:number}).schemaVersion=302;
  const s=gate(w,'wood');expect(s.door!.duration).toBeUndefined();expect(doorMotionTicks(s)).toBe(3.8);
  expect(validateDoors(w,302)).toEqual([]);
  s.door!.duration=3.3;expect(validateDoors(w,302)).toContain('Invalid door state.');
  const now=deconstructionCamp(1),wrong=gate(now,'steel');wrong.door!.duration=4.5;
  expect(validateDoors(now,303)).toContain('Invalid door state.');
});

test('a gate of an older save takes the gate speed at its next opening, without a jump',()=>{
  const w=deconstructionCamp(1),p=w.pawns[0]!;
  const s={id:w.nextId++,kind:'fence-gate',material:'wood',x:16,z:16,orientation:0,footprint:'standard',door:newDoorState(w.tick)} as Structure;
  w.structures.push(s);expect(validateDoors(w,303)).toEqual([]);
  p.x=15;p.z=16;delete p.motion;p.path=[{x:16,z:16}];
  const before=doorOpenness(s,w.tick);
  expect(readyDoorEntry(w,p,{x:16,z:16})).toBe(false);
  expect(s.door!.duration).toBe(3.3);expect(doorOpenness(s,w.tick)).toBe(before);
  expect(validateDoors(w,303)).toEqual([]);
  // The migrated number alone does not convert a gate that is not opened.
  const old=deconstructionCamp(1),idle={id:old.nextId++,kind:'fence-gate',material:'steel',x:20,z:20,orientation:0,footprint:'standard',door:newDoorState(old.tick)} as Structure;
  old.structures.push(idle);const json=JSON.parse(serializeWorld(old));json.schemaVersion=302;
  const migrated=deserializeWorld(JSON.stringify(json));
  expect(migrated.schemaVersion).toBe(303);expect(migrated).toEqual(old);
  expect(migrated.structures.find(s=>s.id===idle.id)!.door!.duration).toBeUndefined();
});
