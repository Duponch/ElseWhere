import {expect,test} from 'vitest';
import {createWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {offerIdleWander300,releaseIdleWander300} from '../src/sim/idle-wander-300.ts';
import {processRecreation} from '../src/sim/recreation.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import {advanceWorldCore297} from '../src/sim/engine.ts';
import type {World,Pawn} from '../src/sim/types.ts';
import type {IdleWanderContext300} from '../src/sim/idle-wander-300.ts';
function setup(){const w=createWorld(42,32,32),p=w.pawns[0]!;for(const q of w.pawns){q.hunger=100;q.rest=100;q.recreation.level=100;q.schedule.fill('work');for(const key of Object.keys(q.priorities)as(keyof Pawn['priorities'])[])q.priorities[key]=0;}w.rng=0x12345678;return{w,p};}
function context(w:World,p:Pawn,pending=false){let searches=0;const field=(g?:ReadonlySet<number>)=>reachableCells(w,p,blockedCells(w),new Set(),g);const c:IdleWanderContext300={candidates:()=>pending?null:field(),blocked:()=>blockedCells(w),search:g=>{searches++;return pending?null:field(g);},move:()=>{},release:()=>releaseWork(w,p),event:()=>{}};return{c,searches:()=>searches};}

test('Whole and Full strict/resident preserve actual wait then paid movement; malformed task adoption is atomic',()=>{
 const {w,p}=setup(),{c}=context(w,p);expect(offerIdleWander300(w,p,c)).toBe('admitted');expect(validateWorld(w)).toEqual([]);
 const encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),strict=new SnapshotDecoder(),resident=new ResidentPresentationAssembler(),badResident=new ResidentPresentationAssembler();
 const a=structuredClone(encoder.encode(w,0,0,true));const sa=strict.adopt(structuredClone(a)),ra=resident.adopt(structuredClone(a));
 expect(sa.status).toBe('applied');expect(ra.status).toBe('applied');const badInitial=badResident.adopt(structuredClone(a));expect(badInitial.status).toBe('applied');if(badInitial.status!=='applied')throw Error('Bad-case predecessor refused');
 if(sa.status!=='applied'||ra.status!=='applied')throw Error('Initial wait refused');expect(ra.world).toStrictEqual(sa.world);const frozenFirst=structuredClone(ra.world);
 releaseIdleWander300(p);expect(offerIdleWander300(w,p,c)).toBe('admitted');expect(p.idleWander300?.kind).toBe('move');advanceWorldCore297(w);expect(p.moveCooldown).toBeGreaterThan(0);expect(validateWorld(w)).toEqual([]);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 const b=structuredClone(encoder.encode(w,0,0));const sb=strict.adopt(structuredClone(b)),rb=resident.adopt(structuredClone(b));expect(sb.status).toBe('applied');expect(rb.status).toBe('applied');if(sb.status!=='applied'||rb.status!=='applied')throw Error('Paid move refused');
 expect(rb.world).toStrictEqual(sb.world);expect(rb.world.pawns[0]?.idleWander300?.kind).toBe('move');expect(ra.world).toStrictEqual(frozenFirst);
 const bad=structuredClone(b);bad.world.pawns[0]!.idleWander300={kind:'wait',at:{x:-1,z:0},startedAtCore:0,expiryIntervalCore:125};expect(badResident.adopt(bad).status).toBe('resync');
 expect(badInitial.world).toStrictEqual(frozenFirst);expect(badResident.adopt(structuredClone(b)).status).toBe('applied');
});

test('IdleJoy uses its real final-provider guards and retains ordinary timetable priority thresholds',()=>{
 // Explicit component clock/schedule inputs, not a played or saved campaign.
 const {w,p}=setup();p.needCooldown=0;p.recreation.level=98;p.schedule.fill('anything');const {c,searches}=context(w,p,true);
 w.tick=5999;w.phaseCore297=9;expect(processRecreation(w,p,c,true,'idle300')).toBe(false);expect(searches()).toBe(0);
 w.tick=6000;w.phaseCore297=0;expect(processRecreation(w,p,c,true,'ordinary')).toBe(false);expect(searches()).toBe(0);
 expect(processRecreation(w,p,c,true,'idle300')).toBe(true);expect(searches()).toBe(1);expect(p.recreation.task).toBeNull();
 p.schedule.fill('sleep');expect(processRecreation(w,p,c,true,'ordinary')).toBe(false);expect(searches()).toBe(1);
 expect(processRecreation(w,p,c,true,'idle300')).toBe(true);expect(searches()).toBe(2);
 p.schedule.fill('work');expect(processRecreation(w,p,c,true,'idle300')).toBe(false);expect(searches()).toBe(2);
 p.schedule.fill('anything');p.recreation.level=99;expect(processRecreation(w,p,c,true,'idle300')).toBe(false);expect(searches()).toBe(2);
});
