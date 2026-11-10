import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/index';
import {captureActorPhaseDependencies297,equalActorPhaseDependencies297,patchableDependencyChanges297} from '../src/bridge/actor-phase-dependencies-297';

// A capture given an earlier capture keeps the owned copy of every row that is
// exactly equal: same values as a capture from scratch, unchanged rows by identity.
const frozenDeep=(value:unknown):boolean=>value===null||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value as object).every(frozenDeep);
type Data={human:unknown[];animalGroups:unknown[];map:unknown};

test('an unchanged World keeps every owned row and section of the held capture',()=>{
 const world=createWorld(11,48,48),first=captureActorPhaseDependencies297(world),again=captureActorPhaseDependencies297(world,first);
 const a=first.data as Data,b=again.data as Data;
 expect(again).not.toBe(first);expect(b).toEqual(a);expect(Object.keys(b)).toEqual(Object.keys(a));
 expect(b.human).toBe(a.human);expect(b.animalGroups).toBe(a.animalGroups);expect(b.map).toBe(a.map);
 expect(equalActorPhaseDependencies297(first,again)).toBe(true);expect(patchableDependencyChanges297(first,again)).toEqual({humans:[],cargo:false});
 expect(frozenDeep(again.data)).toBe(true);
});

test('a changed human gets a new owned row; every other row is the held one, and the values are those of a capture from scratch',()=>{
 const world=createWorld(11,48,48),held=captureActorPhaseDependencies297(world),pawn=world.pawns[0]!;
 pawn.state='sleeping';
 const reused=captureActorPhaseDependencies297(world,held),scratch=captureActorPhaseDependencies297(world);
 const before=held.data as Data,after=reused.data as Data;
 expect(after).toEqual(scratch.data);expect(equalActorPhaseDependencies297(reused,scratch)).toBe(true);
 expect(after.human).not.toBe(before.human);expect(after.human[0]).not.toBe(before.human[0]);
 for(let i=1;i<after.human.length;i++)expect(after.human[i]).toBe(before.human[i]);
 expect(after.animalGroups).toBe(before.animalGroups);
 // The publisher's decision is the same with either capture.
 expect(patchableDependencyChanges297(held,reused)).toEqual(patchableDependencyChanges297(held,scratch));
 expect(patchableDependencyChanges297(held,reused)).toEqual({humans:[pawn.id],cargo:false});
 expect(frozenDeep(reused.data)).toBe(true);
 // The live record is never retained.
 pawn.state='idle';expect(after).toEqual(scratch.data);
});

test('a capture that is not one of this module is ignored, never trusted',()=>{
 const world=createWorld(11,48,48),real=captureActorPhaseDependencies297(world),forged={format:real.format,data:structuredClone(real.data)} as typeof real;
 const result=captureActorPhaseDependencies297(world,forged);
 expect(result.data).toEqual(real.data);expect((result.data as Data).human).not.toBe((forged.data as Data).human);
});
