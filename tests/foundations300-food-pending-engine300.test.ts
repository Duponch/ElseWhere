import {expect,test,vi} from 'vitest';
import {createWorld,applyCommand,stepWorld,validateWorld} from '../src/sim/index.ts';
import * as workPlanner from '../src/sim/work-planner.ts';
import {blockedCells,adjacent} from '../src/sim/pathfinding.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {requiredMaterial,constructionSupplied} from '../src/sim/construction-materials.ts';
import {workProgress} from '../src/sim/work-progress.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import type {Pawn} from '../src/sim/types.ts';

test('food reach pending lets the actual Engine advance its admitted supplied current job without admitting a lower offer',()=>{
 // Declared unplayed scenario, not a campaign save or a fabricated played
 // edge. A real planner admits the initial frame; every measured processor
 // remains real except the explicit pending result of Engine's food search.
 const w=createWorld(42,32,32);expect(Number(w.schemaVersion)).toBe(300);
 const pawn=w.pawns[0]!;
 for(const p of w.pawns){
  p.hunger=100;p.rest=100;p.recreation.level=100;p.schedule.fill('work');
  for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
 }
 for(const other of w.pawns.slice(1))expect(applyCommand(w,{type:'draft',pawnIds:[other.id],enabled:true}).ok).toBe(true);
 pawn.priorities.build=1;pawn.planCooldown=0;pawn.needCooldown=0;
 const target={x:pawn.x,z:pawn.z-1};
 expect(applyCommand(w,{type:'designate',kind:'wall',material:'wood',...target}).ok).toBe(true);
 const job=w.jobs.find(j=>j.kind==='wall'&&j.x===target.x&&j.z===target.z)!;
 expect(job).toBeDefined();
 // Canonical configured initial frame and owned material, using the same
 // original material allocator as existing construction scenario fixtures.
 job.construction='frame';addMaterial(w,'wood',requiredMaterial(job,'wood'),{type:'job',jobId:job.id},'wood');refreshStock(w);
 expect(constructionSupplied(w,job)).toBe(true);expect(adjacent(pawn,job)).toBe(true);
 workPlanner.planWork(w,pawn,()=>blockedCells(w),new Set<number>(),{remaining:8,pairs:32768});
 expect(pawn.jobId).toBe(job.id);expect(job.reservedBy).toBe(pawn.id);expect(job.status).toBe('active');
 expect(pawn.path).toEqual([]);expect(pawn.moveCooldown).toBe(0);expect(pawn.state).toBe('working');
 expect(pawn.need).toBeNull();expect(pawn.orders.active).toBeNull();expect(pawn.orders.queue).toEqual([]);
 expect(validateWorld(w)).toEqual([]);
 pawn.hunger=29.9;pawn.needCooldown=0;
 const before={core:effectiveCore297(w),progress:workProgress(job),ingest:pawn.lastIngestAtCore299,
  food:w.piles.filter(p=>p.kind==='food').reduce((sum,p)=>sum+p.quantity,0),
  frame:JSON.stringify(w.piles.filter(p=>p.owner.type==='job'&&p.owner.jobId===job.id))};
 expect(before.food).toBeGreaterThan(0);

 // The namespace import and Engine's relative import must resolve the
 // work-planner import to the same module. The call assertion below makes an
 // unobserved/ineffective spy a harness failure, never a false product RED.
 const search=vi.spyOn(workPlanner,'search').mockReturnValue(null);
 try{
  stepWorld(w,1); // Exactly one real macro / ten physical Core.
  const foodCalls=search.mock.calls.filter(args=>args[1].id===pawn.id);
  expect(foodCalls).toHaveLength(1);expect(foodCalls[0]![5]?.size).toBeGreaterThan(0);
  expect(effectiveCore297(w)).toBe(before.core+10);
  expect(w.jobs.find(j=>j.id===job.id)).toBe(job);expect(pawn.jobId).toBe(job.id);
  expect(job.reservedBy).toBe(pawn.id);expect(job.status).toBe('active');expect(constructionSupplied(w,job)).toBe(true);
  expect(pawn.need).toBeNull();expect(pawn.haul).toBeNull();expect(pawn.cooking).toBeNull();
  expect(pawn.orders.active).toBeNull();expect(pawn.recreation.task).toBeNull();
  expect(Object.hasOwn(pawn,'idleWander300')).toBe(false);
  expect(pawn.lastIngestAtCore299).toBe(before.ingest);
  expect(w.piles.filter(p=>p.kind==='food').reduce((sum,p)=>sum+p.quantity,0)).toBe(before.food);
  expect(JSON.stringify(w.piles.filter(p=>p.owner.type==='job'&&p.owner.jobId===job.id))).toBe(before.frame);
  expect(validateWorld(w)).toEqual([]);
  // Expected sole rule RED on the old Engine: admitted job progress stays
  // constant because processNeeds returns true for this pending search.
  expect(workProgress(job),'already admitted current work must advance while food search is still unknown').toBeGreaterThan(before.progress);
 }finally{search.mockRestore();}
});
