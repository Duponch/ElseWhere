/* PRIVATE adoption destination: tests/shooting-lean.test.ts.
 * ROOT only controls. No file in this directory has been executed by author. */
import {expect,test} from 'vitest';
import {leanScene,shoot,firstFlight,roundtrip,stationary,type LeanWeapon} from './scenarios/shooting-lean';
import {fixtureBuilding} from './scenarios/deconstruction';
import {controlledInjury} from './scenarios/health';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {serializeWorld,validateWorld} from '../src/sim/serialization';
import {shotPlan,shootingQueries,advanceShooter} from '../src/sim/shooting';
import {emitRevolverBullet,type BulletEmissionInput} from '../src/sim/bullet-emission';
import {emitEmpProjectile} from '../src/sim/emp-emission';
import {advanceBulletFlight} from '../src/sim/bullet-flight';
import {captureWorldShotGrid} from '../src/sim/combat-world';
import {captureWorldProjectileTargets} from '../src/sim/projectile-world';
import {rangedWeaponProfile} from '../src/sim/ranged-statistics';

test.each<LeanWeapon>(['revolver','bolt-action-rifle','emp-launcher'])('%s: real command captures cardinal source and physically emits from half-offset',item=>{
 const s=leanScene(item),before={x:s.p.x,z:s.p.z},rng=s.w.rng,xp=s.p.skills.shooting.xp;
 expect(shoot(s).ok).toBe(true);expect(s.p.shooting?.stance).toMatchObject({phase:'aim',lean:{x:0,z:-1}});expect(s.w.rng).toBe(rng);expect(s.p.skills.shooting.xp).toBe(xp);roundtrip(s.w);
 const emitted=firstFlight(s);expect(emitted.flight.origin).toEqual({x:4.5,z:10});expect({x:s.p.x,z:s.p.z}).toEqual(before);expect(emitted.flight.equipmentKey).toBe(`pile:${s.weapon!.id}`);
 expect(s.p.shooting?.stance?.phase).toBe('cooldown');expect(Object.hasOwn(s.p.shooting!.stance!,'lean')).toBe(false);roundtrip(s.w);
});

test.each<LeanWeapon>(['revolver','bolt-action-rifle','emp-launcher'])('%s: an ordinary direct line has no invented capture or offset',item=>{
 const s=leanScene(item,'direct');expect(shoot(s).ok).toBe(true);expect(Object.hasOwn(s.p.shooting!.stance!,'lean')).toBe(false);expect(firstFlight(s).flight.origin).toEqual({x:4.5,z:10.5});roundtrip(s.w);
});

test('target movement changes the latest line, not the source already captured by this warmup',()=>{
 const s=leanScene('emp-launcher');s.target.x=8;roundtrip(s.w);expect(shoot(s).ok).toBe(true);expect(s.p.shooting?.stance).toMatchObject({lean:{x:0,z:-1}});
 expect(applyCommand(s.w,{type:'draft-move',pawnIds:[s.target.id],target:{x:4,z:7},queue:false}).ok).toBe(true);
 for(let n=0;n<20&&!(s.target.x===4&&s.target.z===7&&stationary(s.w,s.target));n++)stepWorld(s.w);
 expect({x:s.target.x,z:s.target.z}).toEqual({x:4,z:7});expect(stationary(s.w,s.target)).toBe(true);expect(s.p.shooting?.stance?.phase).toBe('aim');
 const latest=shotPlan(s.w,s.p,s.target.id,shootingQueries(s.w));expect(latest).not.toHaveProperty('reason');if('reason' in latest)throw Error(latest.reason);expect(latest.line.from).toEqual({x:4,z:10});expect(s.p.shooting?.stance).toMatchObject({lean:{x:0,z:-1}});
 expect(firstFlight(s).flight.origin).toEqual({x:4.5,z:10});roundtrip(s.w);
});

test('range admission remains measured from the logical pawn before leaning',()=>{
 const s=leanScene('revolver');s.target.x=30;roundtrip(s.w);const before=serializeWorld(s.w);expect(shoot(s)).toMatchObject({ok:false,reason:expect.stringContaining('portée')});expect(serializeWorld(s.w)).toBe(before);
});

test('real Blunt stun pauses paid warmup, preserving source and exact save/replay without extra work',()=>{
 const s=leanScene('revolver','lean',12);s.third.x=4;s.third.z=11;roundtrip(s.w);expect(shoot(s).ok).toBe(true);stepWorld(s.w);
 expect(applyCommand(s.w,{type:'melee',pawnIds:[s.third.id],targetId:s.p.id}).ok).toBe(true);stepWorld(s.w);expect(s.p.stun).toEqual({sinceCore:30011,untilCore:30131});expect(s.p.shooting?.stance).toMatchObject({phase:'aim',lean:{x:0,z:-1}});
 expect(applyCommand(s.w,{type:'draft-stop',pawnIds:[s.third.id]}).ok).toBe(true);const copy=roundtrip(s.w),xp=s.p.skills.shooting.xp;
 for(let n=0;n<3;n++){const before=serializeWorld(s.w);advanceShooter(s.w,s.p,s.w.tick*10,shootingQueries(s.w));expect(serializeWorld(s.w)).toBe(before);}
 while(s.w.tick<3013){stepWorld(s.w);stepWorld(copy);expect(copy).toEqual(s.w);expect(s.p.skills.shooting.xp).toBe(xp);expect(s.w.projectiles).toBeUndefined();roundtrip(s.w);}
 stepWorld(s.w);stepWorld(copy);expect(copy).toEqual(s.w);const projectile=s.w.projectiles?.find(p=>p.flight.launcherKey===`pawn:${s.p.id}`);expect(projectile?.emittedAtCore).toBe(30137);expect(projectile?.flight.origin).toEqual({x:4.5,z:10});
});

test('cooldown, movement cancellation and an already launched flight remain independently physical',()=>{
 const s=leanScene('revolver');expect(shoot(s).ok).toBe(true);const flight=firstFlight(s),frozen=structuredClone(flight),until=s.p.shooting!.stance!.endsAtCore;
 expect(applyCommand(s.w,{type:'draft-move',pawnIds:[s.p.id],target:{x:4,z:12},queue:false}).ok).toBe(true);expect(s.p.shooting?.order).toBeNull();expect(s.p.shooting?.stance?.endsAtCore).toBe(until);expect(s.w.projectiles?.find(p=>p.id===flight.id)).toEqual(frozen);roundtrip(s.w);
 const original={x:s.p.x,z:s.p.z};while((s.w.tick+1)*10<until){stepWorld(s.w);expect({x:s.p.x,z:s.p.z}).toEqual(original);expect(validateWorld(s.w)).toEqual([]);}stepWorld(s.w);expect(s.p.motion).toBeDefined();expect(s.p.shooting?.stance?.phase).not.toBe('aim');roundtrip(s.w);
});

test('a real target collapse before emission cancels the paid aim without a projectile or captured-source residue',()=>{
 const s=leanScene('bolt-action-rifle');expect(shoot(s).ok).toBe(true);stepWorld(s.w);controlledInjury(s.w,s.target,'left-leg',30000,'cut');controlledInjury(s.w,s.target,'right-leg',30000,'cut');expect(s.target.state).toBe('downed');stepWorld(s.w);expect(s.p.shooting).toBeUndefined();expect(s.w.projectiles).toBeUndefined();roundtrip(s.w);
});

test('intended and wild branches share physical origin, while a wild miss can still strike an allied wall',()=>{
 const s=leanScene('revolver');fixtureBuilding(s.w,'wall',12,9);roundtrip(s.w);const grid=captureWorldShotGrid(s.w),profile=rangedWeaponProfile('revolver','normal')!;
 const input:BulletEmissionInput={grid,line:{from:{x:4,z:9},to:{x:14,z:10}},origin:{x:4.5,z:10},launcherKey:`pawn:${s.p.id}`,equipmentKey:`pile:${s.weapon!.id}`,target:{key:`pawn:${s.target.id}`,cell:s.target,full:false,canBenefitFromCover:true},aim:{shooter:1,weapon:1,size:1,weather:1,smoke:1,execution:1,posture:1,standardAim:1,aimIgnoringPosture:1,aim:1,passCover:1,estimatedHit:1},cover:{blockChance:0,passChance:1,contributions:[]},profile,canHitOtherPawns:true,preventFriendlyFire:false,coverAnchor:()=>undefined};
 const draws=(values:number[])=>()=>{const n=values.shift();if(n===undefined)throw Error('Unexpected isolated-kernel random draw');return n;};
 const intended=emitRevolverBullet(input,draws([.5,.5])),wild=emitRevolverBullet({...input,aim:{...input.aim,aimIgnoringPosture:0}},draws([.5,.75,.9,.5,.5]));
 expect(intended.branch).toBe('target');expect(intended.flight.flags).toBe(3);expect(wild.branch).toBe('wild');expect(wild.flight.flags).toBe(4);expect(intended.flight.origin).toEqual(wild.flight.origin);
 const scene=captureWorldProjectileTargets(s.w).scene(new Set(s.w.pawns.map(p=>p.id)),.4),before=serializeWorld(s.w);
 const hit=advanceBulletFlight(intended.flight,scene,draws([]),100),miss=advanceBulletFlight(wild.flight,scene,draws([]),100);expect(hit.arrival?.targetKey).toBe(`pawn:${s.target.id}`);expect(miss.arrival?.targetKey).toMatch(/^structure:/);expect(serializeWorld(s.w)).toBe(before);
});

test('EMP forced radius uses logical caster position despite positive half-lean; legacy API fallback stays unchanged',()=>{
 // Declared initial seed, no search/reroll: first xorshift draw is in[.5,.51),
 // hence index4 of the nine logical-radius cells, the east cardinal offset.
 const s=leanScene('emp-launcher','positive',0x80000000),q=shootingQueries(s.w),plan=shotPlan(s.w,s.p,s.target.id,q);expect(plan).not.toHaveProperty('reason');if('reason' in plan)throw Error(plan.reason);expect(plan.line.from).toEqual({x:5,z:10});expect(shoot(s).ok).toBe(true);expect(s.p.shooting?.stance).toMatchObject({lean:{x:1,z:0}});const actual=firstFlight(s);expect(actual.flight.origin).toEqual({x:5,z:10.5});expect(Math.floor(actual.flight.destination.x)).toBe(8);expect(Math.floor(actual.flight.destination.z)).toBe(14);
 const profile=rangedWeaponProfile('emp-launcher','normal')!,input:BulletEmissionInput={grid:q.grid(),line:plan.line,origin:{x:5,z:10.5},launcherKey:`pawn:${s.p.id}`,equipmentKey:`pile:${s.weapon!.id}`,target:{key:`pawn:${s.target.id}`,cell:s.target,full:false,canBenefitFromCover:true},aim:{shooter:1,weapon:1,size:1,weather:1,smoke:1,execution:1,posture:1,standardAim:1,aimIgnoringPosture:1,aim:1,passCover:1,estimatedHit:1},cover:{blockChance:0,passChance:1,contributions:[]},profile,canHitOtherPawns:true,preventFriendlyFire:false,coverAnchor:()=>undefined};
 // Calls and exact optional source signature are finalized with coreowner.
 // Quantile.6 chooses radius1.52 diagonal(-1,-1), but radius.95 chooses(0,0).
 const values=[.6,.9,.5,.5],random=()=>{const v=values.shift();if(v===undefined)throw Error('Unexpected EMP draw');return v;};
 const emitted=emitEmpProjectile(input,random,{x:4,z:10});expect(emitted.branch).toBe('forced');expect(emitted.flight.destination).toEqual({x:6.5,z:13.5});
 const legacyInput={...input,origin:{x:4.5,z:10.5}},a=[.6,.9,.5,.5],b=[.6,.9,.5,.5];expect(emitEmpProjectile(legacyInput,()=>a.shift()!)).toEqual(emitEmpProjectile(legacyInput,()=>b.shift()!,{x:4,z:10}));
});
