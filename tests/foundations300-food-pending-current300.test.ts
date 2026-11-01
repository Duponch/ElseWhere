import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health.ts';
import * as needs from '../src/sim/needs.ts';
import type {NeedContext} from '../src/sim/needs.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import type {Job,MaterialPile} from '../src/sim/types.ts';

// A declared, isolated component fixture, not a played/admitted Whole or human
// campaign. No Engine step or World time is advanced by this test.
function fixture(version:299|300=300){
 const w=medicalCamp(),p=w.pawns[0]!;(w as {schemaVersion:number}).schemaVersion=version;
 p.hunger=29.9;p.rest=80;p.needCooldown=0;p.planCooldown=20;p.need=null;p.haul=null;p.cooking=null;p.path=[];p.moveCooldown=0;p.state='working';
 delete p.motion;delete p.mental;delete p.health;delete p.background;p.foodPolicyId=1;
 const job:Job={id:w.nextId++,kind:'sow',orientation:0,footprint:'standard',x:p.x+3,z:p.z,status:'pending',reservedBy:p.id,progress:1,escrow:{wood:0,food:0}};
 w.jobs.push(job);p.jobId=job.id;
 const meal:MaterialPile={id:w.nextId++,kind:'food',item:'survival-meal',quantity:3,owner:{type:'ground',x:p.x+3,z:p.z}};w.piles.push(meal);
 let pending=true,searched=0,released=0,moved=0;
 const context:NeedContext={search:goals=>{searched++;return pending?null:reachableCells(w,p,blockedCells(w),new Set(),goals);},release:()=>{released++;return releaseWork(w,p);},move:()=>{moved++;},event:()=>{}};
 return {w,p,job,meal,context,resolve(){pending=false;},calls:()=>({searched,released,moved})};
}
/** Compatibility adapter for a functional RED on the real preimage: old
 * boolean handled is observable as handled, never fabricated as pending. */
function decide(...args:Parameters<typeof needs.processNeeds>):string {
 const fn=Reflect.get(needs,'processNeedsDecision300');return typeof fn==='function'?fn(...args):needs.processNeeds(...args)?'handled':'unavailable';
}

test('300 pending food keeps its current reserved work until a real meal is admitted;299 and boolean callers keep ownership',()=>{
 const f=fixture(),{w,p,job,meal,context}=f,owner=JSON.stringify(meal.owner),quantity=meal.quantity,rng=w.rng,id=w.nextId,hunger=p.hunger;
 expect(decide(w,p,context)).toBe('pending-current');
 expect(p.need).toBeNull();expect(p.jobId).toBe(job.id);expect(job.reservedBy).toBe(p.id);expect(job.progress).toBe(1);
 expect(f.calls()).toEqual({searched:1,released:0,moved:0});
 expect(JSON.stringify(meal.owner)).toBe(owner);expect(meal.quantity).toBe(quantity);expect(w.rng).toBe(rng);expect(w.nextId).toBe(id);expect(p.hunger).toBe(hunger);
 // Other/clinical callers of processNeeds still own a pending turn. This call
 // cannot consume or reserve a meal merely to make the new interface succeed.
 expect(needs.processNeeds(w,p,context)).toBe(true);expect(p.jobId).toBe(job.id);expect(p.need).toBeNull();expect(f.calls().released).toBe(0);
 f.resolve();expect(decide(w,p,context)).toBe('handled');
 expect(f.calls().released).toBe(1);expect(p.jobId).toBeNull();expect(job.reservedBy).toBeNull();
 expect(p.need).toMatchObject({kind:'eat',phase:'pickup',sourcePileId:meal.id,carryPileId:null});
 expect(JSON.stringify(meal.owner)).toBe(owner);expect(meal.quantity).toBe(quantity);expect(p.hunger).toBe(hunger);expect(w.rng).toBe(rng);expect(w.nextId).toBe(id);
 const old=fixture(299);expect(decide(old.w,old.p,old.context)).toBe('handled');expect(old.p.jobId).toBe(old.job.id);expect(old.calls().released).toBe(0);expect(old.p.need).toBeNull();
 const idle=fixture();idle.job.reservedBy=null;idle.p.jobId=null;idle.p.state='idle';
 expect(decide(idle.w,idle.p,idle.context)).toBe('handled');expect(idle.p.need).toBeNull();expect(idle.calls().released).toBe(0);
});
