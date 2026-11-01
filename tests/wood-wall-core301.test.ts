import {expect,test} from 'vitest';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {advanceWorldCore297} from '../src/sim/engine.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {setActualView301} from '../src/sim/actual-view-301.ts';
import {initialSkills} from '../src/sim/skills.ts';
import {applyMeleeStun} from '../src/sim/stun.ts';
import {fixture,play} from './wall-fixture301.ts';
import {frameWorkProjectionUnits301} from '../src/sim/frame-work-projection-301.ts';
import {setWorkUnits} from '../src/sim/work-progress.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {interactionGoals} from '../src/sim/pathfinding.ts';
import {transferPile} from '../src/sim/materials.ts';
test('real Core creates the toil at contact, pays the variable interval once and never requests Full for each scalar increment',()=>{
 // Initial scenario light has the real dark-work factor0.8; the old1.7 oracle incorrectly assumed full light.
 const {w,p,j}=fixture();const r=advanceWorldCore297(w);
 expect(p.frameToil301).toEqual({kind:'work',jobId:j.id,ticksLeft:4999});
 expect(j.frameWork301).toEqual({required:94.5,done:Math.fround(1.36)});
 expect(r.maps[0]!.requiresHardFull297).toBe(false);
 play(w,6);expect(p.frameToil301).toMatchObject({ticksLeft:4993});
 expect(j.frameWork301!.done).toBeCloseTo(9.52,4);
 expect(validateWorld(w)).toEqual([]);
});
test('the real persisted counter, work and toil roundtrip exactly and continue under the same explicit view',()=>{
 const {w,p}=fixture();play(w,12);expect(validateWorld(w)).toEqual([]);
 const raw=serializeWorld(w),copy=deserializeWorld(raw);
 expect(serializeWorld(copy)).toBe(raw);
 expect(setActualView301(copy,{mapId:0,minX:0,minZ:0,maxX:31,maxZ:31,zoomBand:0})).toBe(true);
 play(w,18);play(copy,18);
 expect(serializeWorld(copy)).toBe(serializeWorld(w));
 expect(p.frameToil301?.kind).toBe('work');
});
test('an already active toil can fail during real stun, then the retired target ends on the next fixed step rather than fabricating Wait1',()=>{
 const {w,p,j}=fixture();play(w,1);
 p.skills=initialSkills(3);w.rng=1;applyMeleeStun(w,p,effectiveCore297(w));
 play(w,1);
 expect(w.jobs.includes(j)).toBe(false);expect(p.frameToil301).toEqual({kind:'retired',jobId:j.id,atCore:2});
 expect(p.jobId).toBe(null);expect(p.postureUntilCore301).toBeUndefined();
 expect(validateWorld(w)).toEqual([]);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 play(w,1);
 expect(p.frameToil301).toBeUndefined();expect(p.postureUntilCore301).toBeUndefined();
 expect(p.stun!.untilCore).toBeGreaterThan(effectiveCore297(w));
 expect(validateWorld(w)).toEqual([]);
});
test('the last rounded UI unit cannot complete physical work or make a real unfinished Frame unsaveable',()=>{
 const {w,p,j}=fixture();play(w,1);
 // Explicit adversarial near-completion state, not a claimed played history.
 j.frameWork301!.done=Math.fround(94.4999);
 const units=frameWorkProjectionUnits301(j.frameWork301!.done,94.5,10);
 expect(units).toBe(99999);setWorkUnits(j,units);
 expect(validateWorld(w)).toEqual([]);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 play(w,1);
 expect(w.jobs.includes(j)).toBe(false);expect(w.structures.some(s=>s.kind==='wall'&&s.x===j.x&&s.z===j.z)).toBe(true);
 expect(p.postureUntilCore301).toBe(effectiveCore297(w)+1);expect(p.frameToil301).toBeUndefined();
 expect(validateWorld(w)).toEqual([]);
});
test('ordinary Main admission starts the actual toil without paying one old macro of work or XP first',()=>{
 const {w,p,j}=fixture();expect(releaseWork(w,p)).toBe(true);p.planCooldown=0;
 const xp=p.skills.construction.xp;play(w,10);
 expect(p.jobId).toBe(j.id);expect(p.frameToil301).toEqual({kind:'work',jobId:j.id,ticksLeft:5000});
 expect(j.frameWork301).toEqual({required:94.5,done:0});expect(p.skills.construction.xp).toBe(xp);
 play(w,1);expect(j.frameWork301!.done).toBeGreaterThan(0);
 expect(p.frameToil301).toMatchObject({ticksLeft:4999});expect(validateWorld(w)).toEqual([]);
});
test('a roof-holding Wall admits diagonal Touch through blocked side cells without broadening other recipes',()=>{
 const {w,p,j}=fixture(true);p.z--;
 w.structures.push(
  {id:w.nextId++,kind:'wall',material:'wood',x:p.x,z:j.z,orientation:0,footprint:'standard'},
  {id:w.nextId++,kind:'wall',material:'wood',x:j.x,z:p.z,orientation:0,footprint:'standard'},
 );
 const index=p.z*w.width+p.x;
 expect(interactionGoals(w,[j],'wall',undefined,j).has(index)).toBe(true);
 expect(interactionGoals(w,[j],'wall',undefined,{...j,material:'steel'}).has(index)).toBe(false);
 expect(validateWorld(w)).toEqual([]);play(w,1);
 expect(p.frameToil301).toMatchObject({kind:'work',jobId:j.id});expect(j.frameWork301!.done).toBeGreaterThan(0);
 expect(p.path).toEqual([]);expect(validateWorld(w)).toEqual([]);
});
test('loss of real supplies before the work toil releases the moving visit instead of claiming endless movement',()=>{
 const {w,p,j}=fixture();
 const pile=w.piles.find(pile=>pile.owner.type==='job'&&pile.owner.jobId===j.id)!;
 expect(transferPile(w,pile,{type:'ground',x:p.x,z:p.z})).toBe(true);
 const goods=w.piles.filter(pile=>pile.item==='wood').reduce((n,pile)=>n+pile.quantity,0);
 play(w,1);
 expect(p.jobId).toBe(null);expect(j.reservedBy).toBe(null);expect(j.status).toBe('pending');
 expect(p.frameToil301).toBeUndefined();expect(p.postureUntilCore301).toBeUndefined();
 expect(j.frameWork301).toBeUndefined();
 expect(w.piles.filter(pile=>pile.item==='wood').reduce((n,pile)=>n+pile.quantity,0)).toBe(goods);
 expect(validateWorld(w)).toEqual([]);
});
test('Ready keeps its real signed countdown during busy and ends the unchanged Frame visit when the stun actually expires',()=>{
 const {w,p,j}=fixture();play(w,1);
 // Explicit near-timeout adversary, not a claim of 4999 played Core.
 p.frameToil301={kind:'work',jobId:j.id,ticksLeft:1};
 const paid=j.frameWork301!.done;applyMeleeStun(w,p,effectiveCore297(w));
 play(w,2);expect(p.frameToil301).toMatchObject({kind:'work',ticksLeft:-1});
 expect(j.frameWork301!.done).toBe(paid);expect(validateWorld(w)).toEqual([]);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 const expiry=p.stun!.untilCore;play(w,expiry-effectiveCore297(w));
 expect(p.frameToil301).toBeUndefined();expect(p.postureUntilCore301).toBe(expiry+1);
 expect(p.jobId).toBe(null);expect(j.status).toBe('pending');expect(j.frameWork301!.done).toBe(paid);
 expect(validateWorld(w)).toEqual([]);
});
test('a headless Wait1 is persisted and expires on its real eligible interval, without completing the pending Frame',()=>{
 const {w,p,j}=fixture();play(w,1);p.frameToil301={kind:'work',jobId:j.id,ticksLeft:1};
 const paid=j.frameWork301!.done;expect(setActualView301(w,null)).toBe(true);play(w,1);
 expect(p.postureUntilCore301).toBe(3);expect(p.jobId).toBe(null);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 let waited=0;while(p.postureUntilCore301!==undefined&&waited<15){play(w,1);waited++;expect(validateWorld(w)).toEqual([]);}
 expect(p.postureUntilCore301).toBeUndefined();expect(waited).toBeGreaterThan(0);
 expect(j.frameWork301!.done).toBe(paid);expect(w.jobs.includes(j)).toBe(true);
});
