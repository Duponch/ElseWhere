import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Job} from '../src/sim/types';
import type {CoreHumanPose297} from '../src/bridge/core-phase-projection-297';
import {PhaseJobRows297} from '../src/render/PhaseJobRows297';

test('pose-owned jobs preserve Full and first-appearance order, last-writer overrides and old endpoint arrays',()=>{
 const world=createWorld(297,32,32);
 const job=(id:number,progress:number):Job=>({id,kind:'chop',x:10,z:8,orientation:0,footprint:'standard',status:'active',reservedBy:null,progress,escrow:{wood:0,food:0}});
 const a=job(101,1),b=job(202,2),extra=job(303,3),extra2=job(404,4);
 world.jobs=[a,b];const owner=new PhaseJobRows297(),poses=new Map<number,CoreHumanPose297>();
 const pose=(id:number,j:Job|null):CoreHumanPose297=>({id,index:0,actor:world.pawns[0]!,job:j,workPose:0,reach:{x:0,z:0},yaw:null});
 const literal=()=>{const overrides=new Map<number,Job>();for(const p of poses.values())if(p.job)overrides.set(p.job.id,p.job as Job);
  return [...world.jobs.map(j=>{const replacement=overrides.get(j.id);overrides.delete(j.id);return replacement??j;}),...overrides.values()];};
 const apply=(...rows:CoreHumanPose297[])=>{const changes=new Map<number,CoreHumanPose297>();for(const row of rows){poses.set(row.id,row);changes.set(row.id,row);}const got=owner.read(world,poses,changes)!;expect(got.rows).toEqual(literal());expect([...got.byId.values()].sort((x,y)=>x.id-y.id)).toEqual(literal().sort((x,y)=>x.id-y.id));return got.rows;};
 const original=apply();expect(original).toBe(world.jobs);
 const p1=pose(11,extra),p2=pose(12,{...b,progress:5}),p3=pose(13,extra2),p4=pose(14,{...extra,progress:9});
 const first=apply(p1,p2,p3,p4);expect(first.map(j=>j.id)).toEqual([101,202,303,404]);expect(first[2]!.progress).toBe(9);
 expect(apply(pose(11,extra))).toBe(first); // same effective patch, even with a fresh pose packet
 const next=apply(pose(11,null));expect(next.map(j=>j.id)).toEqual([101,202,404,303]);expect(first.map(j=>j.id)).toEqual([101,202,303,404]);
 const sparse=apply(pose(14,{...extra,progress:12}));expect(sparse[3]!.progress).toBe(12);expect(next[3]!.progress).toBe(9);
 const removed=apply(pose(14,null),pose(12,null),pose(13,null));expect(removed).toEqual([a,b]);
 expect(owner.metrics()).toMatchObject({reused:2,clones:1});
});
