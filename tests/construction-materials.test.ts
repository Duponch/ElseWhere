import { withoutResearch,withMigratedResearch } from './scenarios/legacy-skills';
import { SCHEMA_VERSION } from '../src/sim/types';
import { withoutPawnSkills, withMigratedSkills } from './scenarios/legacy-skills';
import { expect, test } from 'vitest';
import { applyCommand, stepWorld, serializeWorld, deserializeWorld, validateWorld, addGroundMaterial, refreshStock } from '../src/sim/index';
import { addMaterial,reservedDestination } from '../src/sim/materials';
import { constructionRecipe, deliveredMaterial, requiredMaterial } from '../src/sim/construction-materials';
import { finishDeconstruction } from '../src/sim/deconstruction';
import { planHaulOrder } from '../src/sim/player-hauling';
import { deconstructionCamp } from './scenarios/deconstruction';
import type { World } from '../src/sim/types';
import { footprintCells, footprintContains, STRUCTURE_DEFINITIONS } from '../src/sim/definitions';
import { furnitureDelay, canStandAt } from '../src/sim/furniture-travel';
import { constructionSupplied } from '../src/sim/construction-materials';
import { canDesignate } from '../src/sim/engine';

function until(w:World, done:()=>boolean, limit=1600) {
  for(let i=0;i<limit&&!done();i++) { stepWorld(w); expect(validateWorld(w),JSON.stringify({tick:w.tick,jobs:w.jobs,pawns:w.pawns})).toEqual([]); }
  expect(done(),JSON.stringify({tick:w.tick,jobs:w.jobs,pawns:w.pawns})).toBe(true);
}
const steelAccount = (w:World) => w.piles.filter(p=>p.item==='steel').reduce((n,p)=>n+p.quantity,0)
  + w.structures.reduce((n,s)=>n+requiredMaterial(s,'steel'),0)
  + w.packed.reduce((n,p)=>n+requiredMaterial(p.building,'steel'),0) + (w.deconstructed.lostSteel??0);

test('typed deliveries reserve only requested ingredients, survive cancellation/replay and never substitute wood for steel',()=>{
  const w=deconstructionCamp(2);
  for(const p of w.pawns) {p.priorities.build=0;p.priorities.haul=1;}
  addGroundMaterial(w,'wood',45,{x:10,z:16},'wood');
  applyCommand(w,{type:'designate',kind:'bed',material:'steel',x:17,z:16});
  const steel=w.jobs[0]!;
  expect(planHaulOrder(w,w.pawns[0]!,{type:'job',jobId:steel.id}).task).toBeUndefined();
  stepWorld(w,15);expect(steel.construction).toBe('blueprint');expect(w.stock.wood).toBe(45);
  addGroundMaterial(w,'steel',45,{x:11,z:17},'steel');
  applyCommand(w,{type:'designate',kind:'bed',material:'wood',x:17,z:19});
  const wooden=w.jobs[1]!;
  expect(applyCommand(w,{type:'order-haul',pawnId:w.pawns[0]!.id,target:{type:'job',jobId:steel.id},queue:false}).ok).toBe(true);
  expect(w.pawns[0]!.haul?.quantity).toBe(45);
  expect(reservedDestination(w,{type:'job',jobId:steel.id},undefined,'steel')).toBe(45);
  expect(reservedDestination(w,{type:'job',jobId:steel.id},undefined,'wood')).toBe(0);
  const reserved=serializeWorld(w);
  expect(applyCommand(w,{type:'order-haul',pawnId:w.pawns[1]!.id,target:{type:'job',jobId:steel.id},queue:false}).ok).toBe(false);
  expect(serializeWorld(w)).toBe(reserved);
  expect(applyCommand(w,{type:'order-haul',pawnId:w.pawns[1]!.id,target:{type:'job',jobId:wooden.id},queue:false}).ok).toBe(true);
  expect(w.pawns[1]!.haul?.quantity).toBe(45);
  expect(reservedDestination(w,{type:'job',jobId:wooden.id},undefined,'wood')).toBe(45);
  expect(reservedDestination(w,{type:'job',jobId:wooden.id},undefined,'steel')).toBe(0);
  until(w,()=>w.pawns.some(p=>p.haul?.phase==='deliver'));
  const cancelled=deserializeWorld(serializeWorld(w));
  expect(applyCommand(cancelled,{type:'cancel',x:steel.x,z:steel.z}).ok).toBe(true);
  expect(steelAccount(cancelled)).toBe(45);expect(validateWorld(cancelled)).toEqual([]);
  until(w,()=>deliveredMaterial(w,steel,'steel')===45&&deliveredMaterial(w,w.jobs[1]!,'wood')===45);
  expect(steel.progress).toBe(0);expect(steel.escrow).toEqual({wood:0,food:0});
  const saved=serializeWorld(w);
  for(const corrupt of ['wrong-item','excess','blueprint'] as const) {
    const bad=JSON.parse(saved),pile=bad.piles.find((p:any)=>p.owner.type==='job'&&p.owner.jobId===steel.id);
    if(corrupt==='wrong-item'){pile.item='wood';pile.kind='wood';bad.jobs[0].escrow.wood=pile.quantity;}
    else if(corrupt==='excess')pile.quantity++;
    else bad.jobs[0].construction='blueprint';
    expect(()=>deserializeWorld(JSON.stringify(bad)),corrupt).toThrow();
  }
  for(const p of w.pawns) applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:1});
  const copy=deserializeWorld(serializeWorld(w));until(w,()=>w.structures.length===2);
  stepWorld(copy,w.tick-copy.tick);expect(copy).toEqual(w);
  expect(w.structures.map(s=>s.material).sort()).toEqual(['steel','wood']);expect(steelAccount(w)).toBe(45);expect(w.stock.wood).toBe(0);
});

test('steel furniture retains its material and owner through packing/reinstallation; blocked odd refunds are atomic',()=>{
  const w=deconstructionCamp(),p=w.pawns[0]!;
  addGroundMaterial(w,'steel',45,{x:12,z:16},'steel');
  applyCommand(w,{type:'designate',kind:'bed',material:'steel',x:17,z:16});
  until(w,()=>w.structures.length===1);const bed=w.structures[0]!;p.bedId=bed.id;
  applyCommand(w,{type:'install',structureId:bed.id,x:20,z:20,orientation:1});
  until(w,()=>w.packed[0]?.owner.type==='pawn');expect(w.packed[0]!.building.material).toBe('steel');expect(steelAccount(w)).toBe(45);
  const copy=deserializeWorld(serializeWorld(w));until(w,()=>!w.jobs.length);stepWorld(copy,w.tick-copy.tick);expect(copy).toEqual(w);
  expect(w.structures[0]).toBe(bed);expect(p.bedId).toBe(bed.id);
  applyCommand(w,{type:'designate',kind:'deconstruct',x:21,z:20});const job=w.jobs[0]!;
  expect(job.deconstruction?.material).toBe('steel');
  const allocator=w.nextId;w.nextId=Number.MAX_SAFE_INTEGER;
  const full=serializeWorld(w);expect(finishDeconstruction(w,p,job)).toBe(false);expect(serializeWorld(w)).toBe(full);
  w.nextId=allocator;refreshStock(w);
  expect(finishDeconstruction(w,p,job)).toBe(true);expect(steelAccount(w)).toBe(45);expect(w.stock.wood).toBe(0);expect(p.bedId).toBeNull();
  expect([22,23]).toContain(w.piles.filter(p=>p.item==='steel').reduce((n,p)=>n+p.quantity,0));
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('V29 keeps its eight-wood bed and existing work while V30 new beds require 45; future material and incompatible recipes are rejected',()=>{
  const w=deconstructionCamp();applyCommand(w,{type:'designate',kind:'bed',x:17,z:16});
  const job=w.jobs[0]!;delete job.material;job.construction='frame';addMaterial(w,'wood',8,{type:'job',jobId:job.id},'wood');
  const raw=JSON.parse(serializeWorld(w));((raw.schemaVersion=29,withoutResearch(raw)),withoutPawnSkills(raw));for(const a of raw.pawns)delete a.priorities.craft;
  const loaded=deserializeWorld(JSON.stringify(raw));expect(loaded.jobs[0]!.material).toBeUndefined();
  expect(constructionRecipe(loaded.jobs[0]!)).toMatchObject({work:120,ingredients:[{item:'wood',quantity:8}]});
  until(loaded,()=>loaded.structures.length===1);expect(loaded.structures[0]!.material).toBeUndefined();
  applyCommand(loaded,{type:'designate',kind:'bed',x:20,z:20});expect(requiredMaterial(loaded.jobs[0]!,'wood')).toBe(45);
  for(const material of ['steel','wood']) {raw.jobs[0].material=material;expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/version 29/);}
  const before=serializeWorld(loaded);
  expect(applyCommand(loaded,{type:'designate',kind:'campfire',material:'steel',x:22,z:22}).ok).toBe(false);
  expect(serializeWorld(loaded)).toBe(before);
  expect(constructionRecipe({kind:'bed',material:'wood'}).work).toBe(56);
  expect(constructionRecipe({kind:'bed',material:'steel'}).work).toBe(80);
});

test('three-cell workshops require every mixed ingredient; all-steel cost is aggregated, progress beyond 119 and in-flight orders resume exactly',()=>{
  for(const material of ['wood','steel'] as const) {
    const w=deconstructionCamp(2);w.tick=2000;
    for(const p of w.pawns){p.priorities.build=0;p.priorities.haul=1;}
    addGroundMaterial(w,material,75,{x:10,z:16},material);
    addGroundMaterial(w,'steel',29,{x:11,z:17},'steel');
    addGroundMaterial(w,'food',5,{x:18,z:16},'legacy-portion');
    const preserved=w.piles.find(p=>p.kind==='food')!;
    expect(applyCommand(w,{type:'stockpile',x:18,z:16,enabled:true,filters:{wood:false,food:true}}).ok).toBe(true);
    expect(applyCommand(w,{type:'designate',kind:'stonecutter',material,x:17,z:16}).ok).toBe(true);
    const job=w.jobs[0]!;
    expect(w.stockpiles).toEqual([]);expect(w.piles.find(p=>p.id===preserved.id)).toBe(preserved);
    expect(constructionRecipe(job).ingredients).toEqual(material==='wood'?[{item:'wood',quantity:75},{item:'steel',quantity:30}]:[{item:'steel',quantity:105}]);
    expect(footprintCells(job)).toHaveLength(3);
    for(const p of w.pawns)expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'job',jobId:job.id},queue:false}).ok).toBe(true);
    until(w,()=>w.pawns.some(p=>p.haul?.phase==='deliver'));
    const interrupted=deserializeWorld(serializeWorld(w));
    expect(applyCommand(interrupted,{type:'cancel',x:16,z:16}).ok).toBe(true);
    expect(validateWorld(interrupted)).toEqual([]);expect(steelAccount(interrupted)).toBe(material==='wood'?29:104);
    until(w,()=>w.piles.filter(p=>p.owner.type==='job').reduce((n,p)=>n+p.quantity,0)===104);
    expect(job.progress).toBe(0);expect(constructionSupplied(w,job)).toBe(false);
    for(const p of w.pawns)applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:1});
    stepWorld(w,20);expect(job.progress).toBe(0);
    addGroundMaterial(w,'steel',1,{x:11,z:17},'steel');
    until(w,()=>job.progress>=125);
    if(material==='steel')expect(w.piles.filter(p=>p.owner.type==='job').map(p=>p.quantity).sort((a,b)=>a-b)).toEqual([30,75]);
    const raw=serializeWorld(w),copy=deserializeWorld(raw);
    for(const change of ['legacy','material','excess'] as const){const bad=JSON.parse(raw);if(change==='legacy')(bad.schemaVersion=30,withoutPawnSkills(bad));else if(change==='material')delete bad.jobs[0].material;else bad.jobs[0].progress=constructionRecipe(job).work;expect(()=>deserializeWorld(JSON.stringify(bad)),change).toThrow();}
    until(w,()=>w.structures.length===1);stepWorld(copy,w.tick-copy.tick);expect(copy).toEqual(w);
    expect(steelAccount(w)).toBe(material==='wood'?30:105);expect(w.piles.find(p=>p.id===preserved.id)?.owner).toEqual(preserved.owner);
    const bench=w.structures[0]!;
    for(const c of footprintCells(bench))expect(canStandAt(w,c)).toBe(false);
    expect(furnitureDelay(w,{x:17,z:15},bench)).toBe(5);expect(furnitureDelay(w,{x:16,z:16},bench)).toBe(0);
    expect(applyCommand(w,{type:'install',structureId:bench.id,x:23,z:20,orientation:1}).ok).toBe(true);
    until(w,()=>w.packed[0]?.owner.type==='pawn');
    const moving=deserializeWorld(serializeWorld(w));
    const old=JSON.parse(serializeWorld(w));((old.schemaVersion=30,withoutResearch(old)),withoutPawnSkills(old));for(const a of old.pawns)delete a.priorities.craft;expect(()=>deserializeWorld(JSON.stringify(old))).toThrow(/version 30/);
    until(w,()=>!w.jobs.length);stepWorld(moving,w.tick-moving.tick);expect(moving).toEqual(w);
    expect(w.structures[0]).toBe(bench);expect(bench.material).toBe(material);
    expect(footprintCells(bench).map(c=>c.z).sort((a,b)=>a-b)).toEqual([19,20,21]);
    expect(applyCommand(w,{type:'designate',kind:'deconstruct',x:23,z:19}).ok).toBe(true);
    until(w,()=>!w.structures.length);expect(steelAccount(w)).toBe(material==='wood'?30:105);
    expect(w.piles.filter(p=>p.item==='steel').reduce((n,p)=>n+p.quantity,0)).toBeOneOf(material==='wood'?[15]:[52,53]);
  }
});

test('workshop rotations reject clipped sides and legacy shapes; mixed refunds preflight both types without mutation or RNG loss',()=>{
  const w=deconstructionCamp();
  // The point-query fast path must keep every catalogue footprint, including
  // wrapped removal/installation targets. The array query is unchanged.
  for(const kind of Object.keys(STRUCTURE_DEFINITIONS) as (keyof typeof STRUCTURE_DEFINITIONS)[])for(const orientation of [0,1,2,3] as const) {
    const s={kind,x:8,z:8,orientation,footprint:'standard' as const};
    const occupied=footprintCells(s);
    for(const shape of [s,{...s,kind:'deconstruct' as const,deconstruction:{kind}},{...s,kind:'install' as const,furniture:{kind}}])
      for(let z=4;z<=12;z++)for(let x=4;x<=12;x++)expect(footprintContains(shape,{x,z})).toBe(occupied.some(c=>c.x===x&&c.z===z));
  }
  for(const orientation of [0,1,2,3] as const){
    const s={type:'designate',kind:'stonecutter',material:'wood',x:16,z:16,orientation} as const;
    expect(canDesignate(w,s).ok).toBe(true);
    const expected=orientation%2===0?[[15,16],[16,16],[17,16]]:[[16,15],[16,16],[16,17]];
    for(let z=14;z<=18;z++)for(let x=14;x<=18;x++)expect(footprintContains(s,{x,z})).toBe(expected.some(c=>c[0]===x&&c[1]===z));
    expect(canDesignate(w,{...s,x:orientation%2===0?0:16,z:orientation%2===1?0:16}).ok).toBe(false);
  }
  const b={id:w.nextId++,kind:'stonecutter',material:'wood',bills:[] as import('../src/sim/cooking-types').CookingBill[],x:17,z:16,orientation:0,footprint:'standard'} as const;w.structures.push(b);
  for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++)if(x!==17||z!==16)w.piles.push({id:w.nextId++,kind:'food',item:'legacy-portion',quantity:75,owner:{type:'ground',x,z}});
  refreshStock(w);expect(validateWorld(w)).toEqual([]);
  expect(applyCommand(w,{type:'designate',kind:'deconstruct',x:17,z:16}).ok).toBe(true);
  const job=w.jobs[0]!,before=serializeWorld(w);
  expect(finishDeconstruction(w,w.pawns[0]!,job)).toBe(false);expect(serializeWorld(w)).toBe(before);
  w.piles=w.piles.filter(p=>p.owner.type!=='ground'||p.owner.x!==17||p.owner.z!==15);refreshStock(w);
  expect(finishDeconstruction(w,w.pawns[0]!,job)).toBe(true);expect(validateWorld(w)).toEqual([]);
  expect(steelAccount(w)).toBe(30);expect(w.piles.filter(p=>p.kind==='wood').reduce((n,p)=>n+p.quantity,0)+w.deconstructed.lostWood).toBe(75);
  const legacy=JSON.parse(serializeWorld(deconstructionCamp()));((legacy.schemaVersion=30,withoutResearch(legacy)),withoutPawnSkills(legacy));for(const a of legacy.pawns)delete a.priorities.craft;
  expect(deserializeWorld(JSON.stringify(legacy))).toEqual(withMigratedSkills({...legacy,schemaVersion:SCHEMA_VERSION,pawns:legacy.pawns.map((p:any)=>({...p,priorities:{...p.priorities,craft:2}}))}));
});
