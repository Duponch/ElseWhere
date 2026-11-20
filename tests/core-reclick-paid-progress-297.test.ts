import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {applyCommand,advanceWorldCore297} from '../src/sim/engine.ts';
import {effectiveCore297,effectiveLocal297} from '../src/sim/core-phase-297.ts';
import {applyMeleeStun,meleeStunCore318} from '../src/sim/stun.ts';
import {serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import type {Pawn,World} from '../src/sim/types.ts';

function scene(){
 const w=deconstructionCamp(1,32),p=w.pawns[0]!;expect(w.phaseCore297).toBe(0);
 Object.assign(p,{x:3,z:5,hunger:70,rest:80,needCooldown:20});p.schedule.fill('anything');p.recreation.level=100;
 for(const k of Object.keys(p.priorities)as(keyof Pawn['priorities'])[])p.priorities[k]=0;
 expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
 expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x:12,z:5},queue:false}).ok).toBe(true);
 expect(p.motion?.from).toEqual({x:3,z:5});expect(p.motion?.start).toBe(0);
 return {w,p};
}
function step(w:World){const before=effectiveCore297(w);expect(advanceWorldCore297(w).core).toBe(before+1);}
function through(w:World,core:number){for(let n=0;n<160&&effectiveCore297(w)<core;n++)step(w);expect(effectiveCore297(w)).toBe(core);}
const turn=(w:World,p:Pawn)=>expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x:3,z:9},queue:false})).toMatchObject({ok:true});

/** Replaces only the earlier proposed case which expected first arming atCore1.
 * New primary-aligned command arming commits no future paid Core or RNG. */
test('a new command owns a zero-progress edge at the already played Core; sixty later physical steps still pay six macro intervals',()=>{
 const w=deconstructionCamp(1,32),p=w.pawns[0]!;
 Object.assign(p,{x:3,z:5,hunger:70,rest:80,needCooldown:20});for(const k of Object.keys(p.priorities)as(keyof Pawn['priorities'])[])p.priorities[k]=0;
 expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
 const before={core:effectiveCore297(w),tick:w.tick,rng:w.rng};
 expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x:16,z:5},queue:false}).ok).toBe(true);
 expect(effectiveCore297(w)).toBe(before.core);expect(w.tick).toBe(before.tick);expect(w.rng).toBe(before.rng);
 expect(p.motion).toMatchObject({from:{x:3,z:5},to:{x:4,z:5},start:effectiveLocal297(w)});
 expect(p.motion!.end).toBeGreaterThan(effectiveLocal297(w));
 through(w,before.core+60);expect(w.tick).toBe(before.tick+6);expect(w.phaseCore297).toBe(0);
});

test('a stun before any paid progress still permits the native no-progress reset after wall-free Core time has elapsed',()=>{
 const {w,p}=scene(),origin={x:3,z:5};
 // Schema 318: the Core Blunt stun lasts 120 Core ticks (45 before).
 const stunCore=meleeStunCore318(w.schemaVersion);
 applyMeleeStun(w,p,0);expect(p.motion?.stuns).toMatchObject([{start:0,end:stunCore/10}]);
 step(w);expect(effectiveCore297(w)).toBe(1);expect(p.motion!.start).toBeLessThan(effectiveLocal297(w));
 const stun=structuredClone(p.stun),rng=w.rng;turn(w,p);
 // The real first Core was entirely inside the halt interval. Source remains A;
 // a clock difference alone cannot manufacture paid locomotion A→B.
 expect({x:p.x,z:p.z}).toEqual(origin);expect(p.motion).toBeUndefined();expect(p.moveCooldown).toBe(0);
 expect(p.path[0]).toEqual({x:3,z:6});expect(p.draft?.target).toEqual({x:3,z:9});expect(p.stun).toEqual(stun);expect(w.rng).toBe(rng);
 expect(validateWorld(w)).toEqual([]);expect(()=>serializeWorld(w)).not.toThrow();
 through(w,stunCore);expect(p.motion?.from).toEqual(origin);expect(p.motion?.to).toEqual({x:3,z:6});
});

test('a stun after one genuinely paid Core does not turn an ordinary reclick into StopDead',()=>{
 const {w,p}=scene();step(w);
 expect(p.motion!.end).toBeGreaterThan(effectiveLocal297(w)); // controlled healthy edge remains active
 applyMeleeStun(w,p,effectiveCore297(w));step(w);
 const captured=structuredClone(p.motion)!,rng=w.rng;
 expect(captured.stuns?.[0]?.start).toBe(.1);expect(captured.start).toBe(0);turn(w,p);
 expect(p.motion).toEqual(captured);expect({x:p.x,z:p.z}).toEqual(captured.to);expect(p.draft?.target).toEqual({x:3,z:9});expect(w.rng).toBe(rng);
 const arrival=Math.ceil(captured.end*10);through(w,arrival);
 expect(p.motion?.from).toEqual(captured.to);expect(p.motion!.end).toBeGreaterThan(captured.end);
 expect(validateWorld(w)).toEqual([]);
});