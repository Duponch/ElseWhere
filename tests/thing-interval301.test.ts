import {expect,test} from 'vitest';
import {dueThingIntervalDelta301,thingHashOffset301} from '../src/sim/thing-interval-301.ts';

test('native persisted counter and signed Thing hash yield an initial12 then15, rather than a new job age',()=>{
 // Independent primary example id17 -> -1471035357; multiples of15 occur at
 // Core12 and27. This is a scalar scheduler contract, not a played World.
 expect(thingHashOffset301(17)).toBe(-1471035357);
 let counter=0;const calls:{core:number;delta:number}[]=[];
 for(let core=1;core<=30;core++){
  const delta=dueThingIntervalDelta301(counter,core,17,15);
  counter=delta?0:counter+1;if(delta)calls.push({core,delta});
 }
 expect(calls).toEqual([{core:12,delta:12},{core:27,delta:15}]);expect(counter).toBe(3);
 // A contact at11 must not erase a counter already accumulated by its pawn.
 expect(dueThingIntervalDelta301(11,12,17,15)).toBe(12);
});

test('a changed camera rate keeps the accumulated delta and the primary1..15 clamp',()=>{
 expect(dueThingIntervalDelta301(14,11,17,5)).toBe(15);
 expect(dueThingIntervalDelta301(3,11,17,1)).toBe(4);
 expect(dueThingIntervalDelta301(0,11,17,-10)).toBe(1);
 expect(dueThingIntervalDelta301(0,11,17,99)).toBe(0);
 expect(()=>dueThingIntervalDelta301(15,11,17,15)).toThrow('actual Thing');
 expect(()=>dueThingIntervalDelta301(0,11,17,Number.NaN)).toThrow('actual Thing');
});
