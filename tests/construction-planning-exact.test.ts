import {expect,test} from 'vitest';
import {applyCommand} from '../src/sim/index.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {constructionSupplied} from '../src/sim/construction-materials.ts';
import {constructionCandidates} from '../src/sim/construction-planner.ts';
import {ConstructionOccupancy,constructionObstructions,constructionSiteFree} from '../src/sim/construction-rules.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {planWork} from '../src/sim/work-planner.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';
import {medicalCamp} from './scenarios/health.ts';

test('construction proposal scans retain exact supplied-frame order and reread direct quantity and owner edits',()=>{
  const w=medicalCamp(2),worker=w.pawns[0]!,other=w.pawns[1]!;
  worker.priorities.build=1;worker.skills.construction.level=20;
  Object.assign(worker,{x:8,z:10});Object.assign(other,{x:25,z:25});
  for(const x of [12,14,16]){
    expect(applyCommand(w,{type:'designate',kind:'wall',x,z:10}).ok).toBe(true);
    const job=w.jobs.at(-1)!;job.construction='frame';
    addMaterial(w,'wood',2,{type:'job',jobId:job.id});
    w.piles.push({...w.piles.at(-1)!,id:w.nextId++,quantity:3});
  }
  const blocked=blockedCells(w),reach=reachableCells(w,worker,blocked,new Set());
  const proposals=()=>constructionCandidates(w,worker,blocked,reach,{remaining:32768,pairs:32768},constructionObstructions(w));
  const expected=()=>w.jobs.filter(job=>constructionSupplied(w,job)&&constructionSiteFree(w,job,worker.id)).map(j=>j.id);
  expect(proposals().map(c=>c.id)).toEqual(expected());
  expect(proposals().map(c=>c.id)).toEqual(w.jobs.map(j=>j.id));
  const pile=w.piles.find(p=>p.owner.type==='job'&&p.owner.jobId===w.jobs[1]!.id)!;
  pile.quantity--;expect(proposals().map(c=>c.id)).toEqual(expected());
  pile.quantity++;pile.owner={type:'pawn',pawnId:other.id};
  expect(proposals().map(c=>c.id)).toEqual(expected());
  pile.owner={type:'job',jobId:w.jobs[1]!.id};
  Object.assign(other,{x:14,z:10});expect(proposals().map(c=>c.id)).toEqual(expected());
  Object.assign(other,{x:25,z:25});expect(proposals().map(c=>c.id)).toEqual(w.jobs.map(j=>j.id));
});

test('repeated delivery source sets retain pair budgets, storage admission and fresh decisions',()=>{
  const initial=medicalCamp(),worker=initial.pawns[0]!;
  Object.assign(worker,{x:8,z:10});worker.priorities.build=1;worker.skills.construction.level=20;
  for(const [x,item] of [[9,'wood'],[10,'wood'],[11,'steel']] as const){
    addMaterial(initial,item,5,{type:'ground',x,z:10},item);
    expect(applyCommand(initial,{type:'stockpile',x,z:10,enabled:true,filters:{wood:true,steel:true,food:false},capacity:75,priority:5}).ok).toBe(true);
  }
  for(const [x,material] of [[12,'wood'],[14,'wood'],[16,'steel']] as const)expect(applyCommand(initial,{type:'designate',kind:'wall',material,x,z:10}).ok).toBe(true);
  // Two wood sources are scanned for each of two wood jobs, and one steel
  // source for its job. No delivery improves a source already at priority 5.
  for(const pairs of [1,2,3,4,5,9]){
    const w=structuredClone(initial),p=w.pawns[0]!,before=structuredClone(w.piles),budget={remaining:8,pairs};
    planWork(w,p,()=>blockedCells(w),new Set(),budget);
    expect(p.haul).toBeNull();expect(p.jobId).toBeNull();expect(budget.pairs).toBe(Math.max(0,pairs-5));
    expect(w.piles).toEqual(before);
    w.stockpiles[0]!.priority=4;
    const next={remaining:8,pairs:20};planWork(w,p,()=>blockedCells(w),new Set(),next);
    expect(p.haul?.sourcePileId).toBe(w.piles[0]!.id);
    expect(p.haul?.destination).toMatchObject({type:'job',jobId:w.jobs[0]!.id});
    expect(w.piles).toEqual(before);
  }
});

test('one construction occupancy capture matches direct scans for live edges, services, bodies and unusual coordinates',()=>{
  const w=medicalCamp(3),[worker,other,body]=w.pawns;
  Object.assign(worker!,{x:8,z:10});Object.assign(other!,{x:20,z:20});Object.assign(body!,{x:22,z:22,state:'dead',body:{pileId:900001}});
  for(const x of [12,14,16])expect(applyCommand(w,{type:'designate',kind:'wall',x,z:10}).ok).toBe(true);
  const compare=()=>{
    const occupancy=new ConstructionOccupancy(w),obstacles=constructionObstructions(w);
    for(const job of w.jobs)for(const except of [undefined,worker!.id,other!.id]){
      expect(constructionSiteFree(w,job,except,obstacles.get(job.id),occupancy)).toBe(constructionSiteFree(w,job,except,obstacles.get(job.id)));
    }
  };
  compare();
  other!.motion={from:{x:11,z:9},to:{x:15,z:11},start:w.tick-1,end:w.tick+1};compare();
  other!.motion={from:{x:-100,z:-100},to:{x:100,z:100},start:w.tick-1,end:w.tick+1};compare();
  other!.motion=null;
  other!.research={stationId:900002,spot:{x:12,z:10},worked:0};compare();
  delete other!.research;
  Object.assign(body!,{x:14,z:10});compare();
  delete body!.body;compare();
  const animal:WildAnimal={id:w.nextId++,species:'hare',sex:'female',ageTicks:10000,x:16,z:10,food:1,rest:1,state:'idle',path:[],nextDecision:w.tick+1};
  w.wildlife={profile:'temperate-hares-v1',rng:1,animals:[animal],eatenPlants:0,eatenNutrition:0,eatenItems:0};compare();
  Object.assign(animal,{x:20,z:20,motion:{from:{x:11,z:9},to:{x:17,z:11},start:w.tick-1,end:w.tick+1}});compare();
  animal.motion!.end=w.tick;compare();
  Object.assign(other!,{x:12.5,z:10});compare();
  w.jobs[0]!.x=-1;Object.assign(other!,{x:-1,z:10});compare();
});
