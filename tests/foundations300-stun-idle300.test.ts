import {expect,test} from 'vitest';
import {createWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {advanceWorldCore297} from '../src/sim/engine.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {applyMeleeStun,isStunned} from '../src/sim/stun.ts';
import {offerIdleWander300,idleWanderTask300,idleWaitExpiry300} from '../src/sim/idle-wander-300.ts';
import {validIdleWanderPawn300} from '../src/sim/idle-wander-save-300.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import type {IdleWanderContext300} from '../src/sim/idle-wander-300.ts';
import type {Pawn} from '../src/sim/types.ts';

test('a real mid-edge stun preserves the wander owner and its exact save until movement can resume',()=>{
 // Explicitly configured, unplayed factory scenario; no human save or forged edge.
 const w=createWorld(42,32,32),p=w.pawns[0]!;
 for(const q of w.pawns){q.hunger=100;q.rest=100;q.recreation.level=100;q.schedule.fill('work');for(const k of Object.keys(q.priorities) as (keyof Pawn['priorities'])[])q.priorities[k]=0;}
 w.rng=0x12345678;p.mental!.wander!.nextMoveOrderIsWait=false;
 const field=(goals?:ReadonlySet<number>)=>reachableCells(w,p,blockedCells(w),new Set<number>(),goals);
 const c:IdleWanderContext300={blocked:()=>blockedCells(w),candidates:()=>field(),search:goals=>field(goals),release:()=>releaseWork(w,p),move:()=>{},event:()=>{}};
 expect(offerIdleWander300(w,p,c)).toBe('admitted');
 const task=idleWanderTask300(p);expect(task?.kind).toBe('move');
 let entry=0;while(!p.motion&&entry++<20)advanceWorldCore297(w);
 expect(p.motion).toBeDefined();expect(p.moveCooldown).toBeGreaterThan(0);expect(validateWorld(w)).toEqual([]);
 const bit=p.mental!.wander!.nextMoveOrderIsWait;
 applyMeleeStun(w,p,effectiveCore297(w));advanceWorldCore297(w);
 expect(isStunned(p,effectiveCore297(w))).toBe(true);
 expect(validateWorld(w)).toEqual([]);
 expect(idleWanderTask300(p)).toBe(task);expect(p.mental!.wander!.nextMoveOrderIsWait).toBe(bit);
 const raw=serializeWorld(w),loaded=deserializeWorld(raw);expect(serializeWorld(loaded)).toBe(raw);
 expect(idleWanderTask300(loaded.pawns.find(q=>q.id===p.id)!)).toEqual(task);
 const packet=new SnapshotEncoder({structureDelta:true,minimumStructures:0}).encode(w,0,0,true);
 const strict=new SnapshotDecoder().adopt(structuredClone(packet)),resident=new ResidentPresentationAssembler().adopt(structuredClone(packet));
 expect(strict.status).toBe('applied');expect(resident.status).toBe('applied');
 if(strict.status!=='applied'||resident.status!=='applied')throw Error('Suspended owner refused');
 expect(resident.world).toStrictEqual(strict.world);expect(resident.world.pawns.find(q=>q.id===p.id)?.idleWander300).toEqual(task);
 let held=0;while(isStunned(p,effectiveCore297(w))&&held++<46){advanceWorldCore297(w);expect(idleWanderTask300(p)).toBe(task);}
 expect(held).toBeGreaterThan(0);expect(held).toBeLessThan(46);
 let finished=0;while(idleWanderTask300(p)===task&&finished++<600)advanceWorldCore297(w);
 expect(finished).toBeLessThan(600);expect(idleWanderTask300(p)).not.toBe(task);
 expect(validateWorld(w)).toEqual([]);
});

test('a stunned Wait_Wander retains its original deadline and can expire in its real hash window',()=>{
 const w=createWorld(42,32,32),p=w.pawns[0]!;
 for(const q of w.pawns){q.hunger=100;q.rest=100;q.recreation.level=100;q.schedule.fill('work');for(const k of Object.keys(q.priorities) as (keyof Pawn['priorities'])[])q.priorities[k]=0;}
 w.rng=0x12345678;
 const c:IdleWanderContext300={blocked:()=>blockedCells(w),candidates:()=>null,search:()=>null,release:()=>releaseWork(w,p),move:()=>{},event:()=>{}};
 expect(offerIdleWander300(w,p,c)).toBe('admitted');const task=idleWanderTask300(p);
 if(task?.kind!=='wait')throw Error('Initial wait not acquired');
 let end=effectiveCore297(w);while(!idleWaitExpiry300(task,p.id,end)&&end<500)end++;
 expect(end).toBeLessThan(500);while(effectiveCore297(w)<end-4)advanceWorldCore297(w);
 expect(idleWanderTask300(p)).toBe(task);applyMeleeStun(w,p,effectiveCore297(w));advanceWorldCore297(w);
 expect(idleWanderTask300(p)).toBe(task);expect(validateWorld(w)).toEqual([]);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 while(effectiveCore297(w)<end)advanceWorldCore297(w);
 expect(isStunned(p,effectiveCore297(w))).toBe(true);expect(idleWanderTask300(p)).not.toBe(task);
 expect(validateWorld(w)).toEqual([]);
});

test('accepting a suspended owner still refuses accessor, future-start and excessive-duration stun records',()=>{
 // Isolated shape inputs, not an imported or continued campaign.
 const w=createWorld(42,32,32),p=w.pawns[0]!;
 p.hunger=100;p.rest=100;p.recreation.level=100;
 const c:IdleWanderContext300={blocked:()=>blockedCells(w),candidates:()=>null,search:()=>null,release:()=>releaseWork(w,p),move:()=>{},event:()=>{}};
 expect(offerIdleWander300(w,p,c)).toBe('admitted');applyMeleeStun(w,p,effectiveCore297(w));
 const owner={core:effectiveCore297(w),width:w.width,height:w.height};
 expect(validIdleWanderPawn300(p,300,owner)).toBe(true);
 expect(validIdleWanderPawn300({...p,stun:{sinceCore:owner.core+1,untilCore:owner.core+45}},300,owner)).toBe(false);
 expect(validIdleWanderPawn300({...p,stun:{sinceCore:0,untilCore:owner.core+46}},300,owner)).toBe(false);
 let reads=0;const accessor={...p.stun};Object.defineProperty(accessor,'untilCore',{enumerable:true,get(){reads++;return owner.core+45;}});
 expect(validIdleWanderPawn300({...p,stun:accessor},300,owner)).toBe(false);expect(reads).toBe(0);
});
