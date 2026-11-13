import {describe,expect,test} from 'vitest';
import {stripFutureContent} from './scenarios/old-schema.ts';
import {createWorld,serializeWorld,deserializeWorld} from '../src/sim/index.ts';
import {validFramePawn301,validFrameProjection301,validFrameWorkJob301} from '../src/sim/finish-frame-save-301.ts';
import type {Job} from '../src/sim/types.ts';

// Unplayed canonical32 factory plus DECLARED guard inputs. These two phase
// cases do not claim an Engine transition, valid Whole, Native receipt or save
// produced by gameplay. Only the final case exercises real neutral migration.
function setup(){
 const w=createWorld(42,32,32),p=w.pawns[0]!;
 expect(Number(w.schemaVersion)).toBe(308);
 p.jobId=null;p.haul=null;p.need=null;p.cooking=null;p.recreation.task=null;
 p.orders.active=null;p.orders.queue=[];p.path=[];p.moveCooldown=0;delete p.motion;
 return {w,p};
}
function wall(id:number,x:number,z:number):Job {
 return {id,kind:'wall',material:'wood',construction:'frame',x,z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},frameWork301:{required:94.5,done:0}};
}

describe('FinishFrame301 persisted Driver phases',()=>{
 test('work keeps signed Ready/busy countdown and requires the exact live Frame owner',()=>{
  const {w,p}=setup(),job=wall(w.nextId++,p.x,p.z);job.status='active';job.reservedBy=p.id;w.jobs.push(job);
  p.jobId=job.id;p.state='working';
  for(const ticksLeft of [5000,0,-1,-2147483648]){
   p.frameToil301={kind:'work',jobId:job.id,ticksLeft};
   expect(validFrameProjection301(w,301)).toBe(true);
  }
  for(const ticksLeft of [5001,-2147483649,.5]){
   p.frameToil301={kind:'work',jobId:job.id,ticksLeft};
   expect(validFramePawn301(p,301,true,0)).toBe(false);
  }
  p.frameToil301={kind:'work',jobId:job.id,ticksLeft:0};
  expect(validFramePawn301(p,300,true,0)).toBe(false);
  const work=job.frameWork301!;delete job.frameWork301;
  expect(validFrameProjection301(w,301)).toBe(false);job.frameWork301=work;
  (job as unknown as Record<string,unknown>).wallDoor296={};
  expect(validFrameWorkJob301(job,301)).toBe(false);
 });

 test('retired target is a reference only; future queue survives retired and Wait1 unchanged',()=>{
  const {w,p}=setup(),oldId=w.nextId++,future=wall(w.nextId++,p.x,p.z);
  delete future.frameWork301;future.construction='blueprint';w.jobs.push(future);
  p.state='working';p.orders.queue=[future.id];
  p.frameToil301={kind:'retired',jobId:oldId,atCore:0};
  expect(validFrameProjection301(w,301)).toBe(true);
  expect(p.orders.queue).toEqual([future.id]);
  p.frameToil301={kind:'retired',jobId:oldId,atCore:1};
  expect(validFramePawn301(p,301,true,0)).toBe(false);
  p.frameToil301={kind:'retired',jobId:oldId,atCore:0};
  w.jobs.push({...future,id:oldId});
  expect(validFrameProjection301(w,301)).toBe(false);w.jobs.pop();
  p.orders.active=future.id;
  expect(validFramePawn301(p,301,true,0)).toBe(false);p.orders.active=null;
  expect(validFramePawn301(p,301,false,0)).toBe(false);
  delete p.frameToil301;p.state='idle';p.postureUntilCore301=1;
  expect(validFrameProjection301(w,301)).toBe(true);
  expect(p.orders.queue).toEqual([future.id]);
  p.postureUntilCore301=0;
  expect(validFramePawn301(p,301,true,10)).toBe(true);
  p.postureUntilCore301=2;
  expect(validFramePawn301(p,301,true,0)).toBe(false);
 });

 test('300 migration changes only the number and never invents Driver history',()=>{
  const w=createWorld(42,32,32);
  const legacy=JSON.parse(JSON.stringify(w));
  legacy.schemaVersion=300;stripFutureContent(legacy,300);
  // The 308 migration gives the stripped policies back their new garments.
  const expected={...JSON.parse(JSON.stringify(w)),schemaVersion:308};
  const loaded=deserializeWorld(JSON.stringify(legacy));
  expect(JSON.parse(serializeWorld(loaded))).toEqual(expected);
  for(const p of loaded.pawns)for(const key of ['jobTickDelta301','frameToil301','postureUntilCore301'])
   expect(Object.hasOwn(p,key)).toBe(false);
  legacy.pawns[0].jobTickDelta301=0;
  expect(()=>deserializeWorld(JSON.stringify(legacy))).toThrow();
 });
});

