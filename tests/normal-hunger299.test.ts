import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health.ts';
import {processNeeds,type NeedContext} from '../src/sim/needs.ts';
import {processRecreation} from '../src/sim/recreation.ts';
import {planWork} from '../src/sim/work-planner.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import type {Job,MaterialPile,Pawn,World} from '../src/sim/types.ts';

// Isolated component contracts. Isolated component inputs based on the existing fixture
// helper, not admitted campaign saves, physical replays or human World data.
function setup(version:298|299=299){const w=medicalCamp(),p=w.pawns[0]!;
 (w as {schemaVersion:number}).schemaVersion=version;w.phaseCore297=0;p.hunger=19;p.rest=100;p.need=null;p.needCooldown=0;p.planCooldown=0;p.jobId=null;p.haul=null;p.cooking=null;p.path=[];p.state='idle';
 delete p.mental;delete p.health;delete p.background;p.foodPolicyId=1;
 return {w,p};
}
function context(w:World,p:Pawn,pending=false){const calls={searched:0,released:0,moved:0,events:[] as string[]};
 const c:NeedContext={search:goals=>{calls.searched++;return pending?null:reachableCells(w,p,blockedCells(w),new Set(),goals);},
 move:()=>{calls.moved++;},release:()=>{calls.released++;return releaseWork(w,p);},event:m=>calls.events.push(m)};
 return {c,calls};
}
function food(w:World,p:Pawn,forbidden=true){const q:MaterialPile={id:w.nextId++,kind:'food',item:'survival-meal',quantity:3,owner:{type:'ground',x:p.x,z:p.z},...(forbidden?{forbidden:true as const}:{})};w.piles.push(q);return q;}
function sow(w:World,p:Pawn){const j:Job={id:w.nextId++,kind:'sow',orientation:0,footprint:'standard',x:p.x+3,z:p.z,status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};w.jobs.push(j);p.priorities.grow=2;return j;}
function wood(w:World,p:Pawn,held=false){const q:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity:8,owner:held?{type:'pawn',pawnId:p.id}:{type:'ground',x:p.x+1,z:p.z}};w.piles.push(q);return q;}
function storage(w:World,p:Pawn){const z={id:w.nextId++,x:p.x+5,z:p.z,filters:{wood:true,food:false},priority:3,capacity:75};w.stockpiles.push(z);return z;}

test('299 unavailable forbidden food falls through to both ordinary job paths and general logistics;298 retains its veto',()=>{
 for(const version of [298,299] as const)for(const mode of ['fast-job','full-job','logistics'] as const){
  const {w,p}=setup(version),q=food(w,p),before=JSON.stringify(q),{c,calls}=context(w,p);
  let job:Job|undefined;
  if(mode==='logistics'){p.priorities.haul=1;wood(w,p);storage(w,p);}else{job=sow(w,p);if(mode==='full-job')p.priorities.haul=1;}
  expect(processNeeds(w,p,c)).toBe(false);expect(calls.searched).toBe(0);expect(calls.released).toBe(0);expect(p.need).toBeNull();
  planWork(w,p,()=>blockedCells(w),new Set(),{remaining:8,pairs:128});
  if(mode==='logistics'){if(version===299)expect(p.haul?.destination.type).toBe('stockpile');else expect(p.haul).toBeNull();}
  else expect(p.jobId).toBe(version===299?job!.id:null);
  expect(JSON.stringify(q)).toBe(before);expect(p.hunger).toBe(19);
 }
});

test('299 keeps the actual active job or held haul when food is unavailable;298 still releases with the existing drop',()=>{
 for(const version of [298,299] as const)for(const activity of ['job','haul'] as const){
  const {w,p}=setup(version),{c,calls}=context(w,p);food(w,p);let job:Job|undefined,held:MaterialPile|undefined;
  if(activity==='job'){job=sow(w,p);job.status='active';job.reservedBy=p.id;job.progress=12;p.jobId=job.id;p.state='working';}
  else{held=wood(w,p,true);const zone=storage(w,p);p.haul={sourcePileId:held.id,carryPileId:held.id,quantity:held.quantity,phase:'deliver',destination:{type:'stockpile',stockpileId:zone.id}};p.state='moving';}
  const task=p.haul,path=p.path;expect(processNeeds(w,p,c)).toBe(false);expect(calls.released).toBe(version===299?0:1);
  if(activity==='job'){expect(p.jobId).toBe(version===299?job!.id:null);expect(job!.reservedBy).toBe(version===299?p.id:null);if(version===299){expect(job!.progress).toBe(12);expect(p.state).toBe('working');}}
  else{expect(p.haul).toBe(version===299?task:null);expect(held!.owner.type).toBe(version===299?'pawn':'ground');if(version===299){expect(p.path).toBe(path);expect(p.state).toBe('moving');}}
 }
});

test('299 permitted ordinary food still preempts active work and consumes one real portion; reservation grants no nutrition',()=>{
 const {w,p}=setup(),q=food(w,p,false),job=sow(w,p),{c,calls}=context(w,p);job.status='active';job.reservedBy=p.id;p.jobId=job.id;p.state='working';
 expect(processNeeds(w,p,c)).toBe(true);expect(calls.released).toBe(1);expect(p.jobId).toBeNull();expect(job.reservedBy).toBeNull();expect(p.need?.kind).toBe('eat');expect(p.hunger).toBe(19);
 // Contact is already the fixture's occupied cell; no injected movement or
 // Engine time is used. Repeated component calls finish the actual ingestion.
 for(let i=0;i<200&&p.need;i++)processNeeds(w,p,c);
 expect(p.need).toBeNull();expect(w.piles.filter(a=>a.item==='survival-meal').reduce((n,a)=>n+a.quantity,0)).toBe(2);expect(p.hunger).toBeGreaterThan(19);
 expect(p.lastIngestAtCore299).toBe(w.tick*10);expect(calls.events.filter(a=>a.includes('a mangé une portion'))).toHaveLength(1);expect(q.forbidden).toBeUndefined();
});

test('299 pending food search keeps current work and returns ownership of the turn; no unavailable fallthrough',()=>{
 const {w,p}=setup(),q=food(w,p,false),job=sow(w,p),{c,calls}=context(w,p,true);job.reservedBy=p.id;job.status='active';p.jobId=job.id;p.state='working';
 const before=JSON.stringify({job,piles:w.piles,rng:w.rng,nextId:w.nextId});
 expect(processNeeds(w,p,c)).toBe(true);expect(calls.searched).toBe(1);expect(calls.released).toBe(0);expect(calls.moved).toBe(0);expect(p.jobId).toBe(job.id);expect(p.need).toBeNull();expect(q.owner.type).toBe('ground');
 expect(JSON.stringify({job,piles:w.piles,rng:w.rng,nextId:w.nextId})).toBe(before);
});

test('299 absent food permits ordinary joy and preserves the earlier sleep provider;298 keeps its joy veto',()=>{
 for(const version of [298,299] as const){
  const {w,p}=setup(version),{c}=context(w,p);p.schedule.fill('recreation');p.recreation.level=0;food(w,p);
  expect(processNeeds(w,p,c)).toBe(false);p.needCooldown=0; // ordinary retry cadence is independent of the old hunger veto
  const started=processRecreation(w,p,c);if(version===299){expect(started).toBe(true);expect(p.recreation.task).not.toBeNull();}else{expect(started).toBe(false);expect(p.recreation.task).toBeNull();}
 }
 const {w,p}=setup(),{c}=context(w,p);p.schedule.fill('sleep');p.rest=10;food(w,p);
 expect(processNeeds(w,p,c)).toBe(true);expect(p.need?.kind).toBe('sleep');expect(p.hunger).toBe(19);
});
