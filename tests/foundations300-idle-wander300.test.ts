import {describe,expect,test} from 'vitest';
import {createWorld,applyCommand,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {advanceWorldCore297} from '../src/sim/engine.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {processNeeds} from '../src/sim/needs.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {offerIdleWander300,processIdleWander300,idleWanderTask300,releaseIdleWander300,
 idleHashOffset300,idleWaitExpiry300,createIdleWanderCore300,idleDestinationReserved300} from '../src/sim/idle-wander-300.ts';
import {validIdleWanderPawn300} from '../src/sim/idle-wander-save-300.ts';
import type {IdleWanderContext300,IdleWander300} from '../src/sim/idle-wander-300.ts';
import type {Pawn,World,Cell} from '../src/sim/types.ts';

// Configured, unplayed 32x32 scenarios from the actual candidate factory.
// No human campaign, recorded RAW, forced physical edge or fabricated save.
function setup(){
 const w=createWorld(42,32,32);expect(Number(w.schemaVersion)).toBe(300);
 for(const p of w.pawns){
  p.hunger=100;p.rest=100;p.recreation.level=100;p.schedule.fill('work');
  for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
 }
 const p=w.pawns[0]!;expect(p.mental?.wander?.revision).toBe(1);
 expect(p.mental!.wander!.nextMoveOrderIsWait).toBe(true);
 // This declared initial random stream is not selected from a played outcome.
 w.rng=0x12345678;
 return {w,p};
}
function context(w:World,p:Pawn,pending=false){
 const calls={candidates:0,searched:0,released:0,moves:[] as Cell[]};
 const field=(goals?:ReadonlySet<number>)=>reachableCells(w,p,blockedCells(w),new Set<number>(),goals);
 const c:IdleWanderContext300={
  blocked:()=>blockedCells(w),
  candidates:()=>{calls.candidates++;return pending?null:field();},
  search:goals=>{calls.searched++;return pending?null:field(goals);},
  release:()=>{calls.released++;return releaseWork(w,p);},
  // Declared scheduling observer only. The trajectory case below uses the
  // real Engine to acquire/pay/finish movement; this callback never moves it.
  move:target=>{calls.moves.push({...target});},event:()=>{},
 };
 return {c,calls};
}
function waitTask(p:Pawn){
 const task=idleWanderTask300(p);expect(task?.kind).toBe('wait');
 if(task?.kind!=='wait')throw Error('Fixture did not admit its first wait');
 return task;
}
function wholeRoundTrip(w:World){
 expect(validateWorld(w)).toEqual([]);
 const raw=serializeWorld(w),copy=deserializeWorld(raw);
 expect(serializeWorld(copy)).toBe(raw);
 return copy;
}

describe('idle300 actual optional job, primary Core1.6 contracts',()=>{
 test('an admitted ordinary food job retains priority and ownership over the final idle offer',()=>{
  const {w,p}=setup();p.hunger=20;p.needCooldown=0;
  const {c}=context(w,p);expect(processNeeds(w,p,c)).toBe(true);
  const meal=p.need as Pawn['need'];expect(meal?.kind).toBe('eat');
  const rng=w.rng,bit=p.mental!.wander!.nextMoveOrderIsWait;
  expect(offerIdleWander300(w,p,c)).toBe('unavailable');
  expect(p.need).toBe(meal);expect(idleWanderTask300(p)).toBeUndefined();
  expect(p.mental!.wander!.nextMoveOrderIsWait).toBe(bit);expect(w.rng).toBe(rng);
 });

 test('pending reachability is neither a resolved absence nor an admitted idle task',()=>{
  const {w,p}=setup();p.mental!.wander!.nextMoveOrderIsWait=false;
  const {c,calls}=context(w,p,true),before=JSON.stringify(p),rng=w.rng;
  expect(offerIdleWander300(w,p,c)).toBe('pending');
  expect(JSON.stringify(p)).toBe(before);expect(w.rng).toBe(rng);
  expect(calls.candidates).toBe(1);expect(calls.moves).toEqual([]);
  expect(calls.released).toBe(0);expect(idleWanderTask300(p)).toBeUndefined();
 });

 test('the first wait shares the real mental alternation bit and owns presence without claiming material',()=>{
  const {w,p}=setup(),{c,calls}=context(w,p),rng=w.rng;
  expect(offerIdleWander300(w,p,c)).toBe('admitted');const task=waitTask(p);
  expect(task.at).toEqual({x:p.x,z:p.z});expect(task.startedAtCore).toBe(effectiveCore297(w));
  expect(task.expiryIntervalCore).toBeGreaterThanOrEqual(125);expect(task.expiryIntervalCore).toBeLessThanOrEqual(200);
  expect(p.mental!.wander!.nextMoveOrderIsWait).toBe(false);expect(w.rng).not.toBe(rng);
  expect(calls.candidates).toBe(0);expect(calls.moves).toEqual([]);
  const other=w.pawns.find(q=>q!==p)!;
  expect(idleDestinationReserved300(w,p,task.at)).toBe(false);
  expect(idleDestinationReserved300(w,other,task.at)).toBe(true);
  expect(p.jobId).toBeNull();expect(p.haul).toBeFalsy();expect(p.need).toBeNull();
  const afterAdmission=w.rng;expect(processIdleWander300(w,p,c)).toBe(true);expect(w.rng).toBe(afterAdmission);
  releaseIdleWander300(p);expect(idleWanderTask300(p)).toBeUndefined();
  expect(p.mental!.wander!.nextMoveOrderIsWait).toBe(false);
  expect(idleDestinationReserved300(w,other,task.at)).toBe(false);expect(w.rng).toBe(afterAdmission);
 });

 test('wait expiration uses both its deadline and the signed32 pawn hash, rather than hash30 or deadline alone',()=>{
  // Independent fixed primary example: id17 -> offset -1471035357.
  // A125Core wait from0 first reaches its own hash window at232, not125.
  const task:Extract<IdleWander300,{kind:'wait'}>={kind:'wait',at:{x:3,z:3},startedAtCore:0,expiryIntervalCore:125};
  expect(idleHashOffset300(17)).toBe(-1471035357);
  expect(idleWaitExpiry300(task,17,107)).toBe(false); // hash match, deadline not reached
  expect(idleWaitExpiry300(task,17,125)).toBe(false); // deadline reached, wrong hash
  expect(idleWaitExpiry300(task,17,231)).toBe(false);
  expect(idleWaitExpiry300(task,17,232)).toBe(true);
  // The real physical owner must apply that contract before publishing. This
  // is an actual configured Engine scenario, not a forged clock/edge update.
  const {w,p}=setup(),{c}=context(w,p);expect(offerIdleWander300(w,p,c)).toBe('admitted');
  const owned=waitTask(p);let stepped=0;
  while(idleWanderTask300(p)===owned&&stepped<410){advanceWorldCore297(w);stepped++;}
  expect(stepped).toBeLessThan(410);expect(idleWanderTask300(p)).not.toBe(owned);
  expect(idleWaitExpiry300(owned,p.id,effectiveCore297(w))).toBe(true);
 });

 test('a real admitted move uses paid Engine travel and closes only at physical arrival, without a wait deadline',()=>{
  const {w,p}=setup();p.mental!.wander!.nextMoveOrderIsWait=false;
  const {c}=context(w,p);expect(offerIdleWander300(w,p,c)).toBe('admitted');
  const task=idleWanderTask300(p);expect(task?.kind).toBe('move');
  if(task?.kind!=='move')throw Error('Declared moving scenario did not offer a move');
  expect(Object.hasOwn(task,'expiryIntervalCore')).toBe(false);
  const target={...task.target},origin={x:p.x,z:p.z};expect(target).not.toEqual(origin);
  expect(p.path.length).toBeGreaterThan(0);let paid=false,stepped=0;
  while(idleWanderTask300(p)===task&&stepped<600){
   advanceWorldCore297(w);stepped++;
   paid||=p.moveCooldown>0;
   if(idleWanderTask300(p)!==task)expect({x:p.x,z:p.z}).toEqual(target);
  }
  expect(paid).toBe(true);expect(stepped).toBeLessThan(600);
  expect(idleWanderTask300(p)).not.toBe(task);expect({x:p.x,z:p.z}).toEqual(target);
  expect(p.moveCooldown).toBe(0);
  // Main may already propose its next job at this macro. No assumption that
  // every optional completion immediately re-enters Main at60Hz is made.
 });

 test('a real draft command interrupts the optional job and releases presence without resetting its shared history',()=>{
  const {w,p}=setup(),{c}=context(w,p);expect(offerIdleWander300(w,p,c)).toBe('admitted');
  const at={...waitTask(p).at},bit=p.mental!.wander!.nextMoveOrderIsWait,rng=w.rng;
  const goods=JSON.stringify(w.piles);
  expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
  expect(idleWanderTask300(p)).toBeUndefined();
  expect(idleDestinationReserved300(w,w.pawns.find(q=>q!==p)!,at)).toBe(false);
  expect({x:p.x,z:p.z}).toEqual(at);expect(p.mental!.wander!.nextMoveOrderIsWait).toBe(bit);
  expect(w.rng).toBe(rng);expect(JSON.stringify(w.piles)).toBe(goods);
 });

 test('whole save and own reload retain wait, shared bit, presence and RNG without a new admission',()=>{
  const {w,p}=setup(),{c}=context(w,p);expect(offerIdleWander300(w,p,c)).toBe('admitted');
  const task=structuredClone(waitTask(p)),rng=w.rng;
  const loaded=wholeRoundTrip(w),q=loaded.pawns.find(x=>x.id===p.id)!;
  expect(idleWanderTask300(q)).toEqual(task);expect(q.mental!.wander!.nextMoveOrderIsWait).toBe(false);
  expect(loaded.rng).toBe(rng);
  expect(idleDestinationReserved300(loaded,loaded.pawns.find(x=>x.id!==p.id)!,task.at)).toBe(true);
  const owned=createIdleWanderCore300(loaded),before=serializeWorld(loaded);
  expect(owned.advance(effectiveCore297(loaded))).toEqual({actorsChanged:[],requiresFull:false});
  expect(serializeWorld(loaded)).toBe(before);
  expect(()=>owned.advance(effectiveCore297(loaded)+1)).toThrow('actual committed Core');
  expect(serializeWorld(loaded)).toBe(before);
 });

 test('a live wait requires its local300 owner and never becomes an archived, legacy or getter-granted task',()=>{
  const {w,p}=setup(),{c}=context(w,p);expect(offerIdleWander300(w,p,c)).toBe('admitted');
  const task=waitTask(p),owner={core:effectiveCore297(w),width:w.width,height:w.height};
  const before=JSON.stringify(p),rng=w.rng;
  expect(validIdleWanderPawn300(p,300,owner)).toBe(true);
  expect(validIdleWanderPawn300(p,300)).toBe(false); // away/archive/container: no local owner
  expect(validIdleWanderPawn300(p,299,owner)).toBe(false);
  const getter={...p};let reads=0;
  Object.defineProperty(getter,'idleWander300',{enumerable:true,configurable:true,get(){reads++;return task;}});
  expect(validIdleWanderPawn300(getter,300,owner)).toBe(false);expect(reads).toBe(0);
  expect(JSON.stringify(p)).toBe(before);expect(w.rng).toBe(rng);
 });
});
