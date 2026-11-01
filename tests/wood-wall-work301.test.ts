import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {initialSkills} from '../src/sim/skills.ts';
import {healthRandom} from '../src/sim/health.ts';
import {workWoodWallInterval301,contactWoodWallWork301} from '../src/sim/wood-wall-work-301.ts';
import {workProgress} from '../src/sim/work-progress.ts';
import {jobDuration} from '../src/sim/farming.ts';
import type {Job} from '../src/sim/types.ts';
function fixture(level:number){
 const w=createWorld(1981,32,32);w.resources=[];w.structures=[];w.packed=[];w.piles=[];w.jobs=[];w.stockpiles=[];
 for(const t of w.tiles)t.terrain='soil';
 const p=w.pawns[0]!;p.skills=initialSkills(level);delete p.background;delete p.traits;delete p.health;delete p.idleWander300;
 p.haul=null;p.need=null;p.cooking=null;p.recreation.task=null;p.state='working';p.faction='colony';
 const j:Job={id:w.nextId++,kind:'wall',material:'wood',construction:'frame',x:15,z:15,orientation:0,footprint:'standard',status:'active',reservedBy:p.id,progress:0,escrow:{wood:5,food:0}};
 p.jobId=j.id;w.jobs=[j];w.piles=[{id:w.nextId++,item:'wood',kind:'wood',quantity:5,owner:{type:'job',jobId:j.id}}];
 w.rng=12345;return {w,p,j};
}
test('actual work contact preserves the old paid fraction and does not fabricate XP or consume RNG',()=>{
 const {w,p,j}=fixture(3);j.progress=2;j.workRemainder=5000;
 const before=JSON.stringify({skills:p.skills,rng:w.rng}),paid=contactWoodWallWork301(w,p,j);
 expect(paid).toEqual({required:94.5,done:Math.fround(94.5*2.5/jobDuration(w,j))});
 expect(JSON.stringify({skills:p.skills,rng:w.rng})).toBe(before);
 expect(contactWoodWallWork301(w,p,j)).toBe(paid);
});
test('a real delta15 learns before the stat, pays Single work and consumes a failure draw even at success1',()=>{
 const {w,p,j}=fixture(8),stream={rng:w.rng};healthRandom(stream);
 const result=workWoodWallInterval301(w,p,j,15,1);
 expect(result).toEqual({kind:'working',increment:25.5,delta:15});
 expect(w.rng).toBe(stream.rng);expect(p.skills.construction.xp).toBe(1313);
 expect(workProgress(j)/jobDuration(w,j)).toBeCloseTo(25.5/94.5,4);
});
test('a source-real low draw fails before paid work while keeping learned XP and the material consequences',()=>{
 const {w,p,j}=fixture(3);w.rng=1;
 const result=workWoodWallInterval301(w,p,j,1,1);
 expect(result.kind).toBe('failed');expect(p.skills.construction.xp).toBe(88);
 expect((j as Job&{frameWork301:{done:number}}).frameWork301.done).toBe(0);
 expect(w.jobs.includes(j)).toBe(false);expect(w.jobs[0]!.construction).toBe('blueprint');
 expect(w.piles.reduce((n,s)=>n+s.quantity,0)).toBeGreaterThanOrEqual(2);
 expect(w.piles.reduce((n,s)=>n+s.quantity,0)).toBeLessThanOrEqual(3);
});
