import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {addMaterial,refreshStock,reservedDestination,reservedSource} from '../src/sim/materials.ts';
import {constructionRecipe,deliveredMaterial} from '../src/sim/construction-materials.ts';
import {planConstructionBatch379,processConstructionBatch379,reconcileConstructionBatches379,startConstructionBatch379,
 validConstructionBatchShape379,validConstructionBatchTask379} from '../src/sim/construction-batch-379.ts';
import {blockedCells,reachableCells,routeToJob} from '../src/sim/pathfinding.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {reconcilePawnHealth} from '../src/sim/health.ts';
import {medicalCamp} from './scenarios/health.ts';
import type {HaulTask,World} from '../src/sim/types.ts';

function scene(kind:'wall'|'bed'='wall'){
 const w=medicalCamp(),p=w.pawns[0]!;delete p.background;
 Object.assign(p,{x:7,z:10,hunger:100,rest:100});p.priorities.build=1;p.skills.construction.level=20;
 const quantities=kind==='wall'?[3,7]:[50,25];
 addMaterial(w,'wood',quantities[0]!,{type:'ground',x:8,z:10},'wood');
 addMaterial(w,'wood',quantities[1]!,{type:'ground',x:11,z:10},'wood');
 for(const x of [14,18])expect(applyCommand(w,{type:'designate',kind,material:'wood',x,z:12}).ok).toBe(true);
 refreshStock(w);
 const [first,second]=w.piles.filter(s=>s.item==='wood'),[a,b]=w.jobs;
 const reach=reachableCells(w,p,blockedCells(w),new Set());
 const initial:HaulTask={sourcePileId:first!.id,quantity:Math.min(first!.quantity,constructionRecipe(a!).ingredients[0]!.quantity),phase:'pickup',carryPileId:null,destination:{type:'job',jobId:a!.id,forConstruction:true}};
 return {w,p,first:first!,second:second!,a:a!,b:b!,initial,reach};
}
function begin(f:ReturnType<typeof scene>){
 const task=planConstructionBatch379(f.w,f.p,f.initial,f.reach);
 expect(task.constructionBatch379).toBeDefined();
 const path=routeToJob(f.w,f.first.owner as {x:number;z:number},f.reach,true);expect(path).not.toBeNull();
 startConstructionBatch379(f.p,task,path!);return task;
}
function until(w:World,done:()=>boolean,limit=700):void {
 for(let i=0;i<limit&&!done();i++){stepWorld(w);expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);}
 expect(done(),JSON.stringify({tick:w.tick,jobs:w.jobs,pawns:w.pawns.map(p=>({x:p.x,z:p.z,haul:p.haul,state:p.state}))})).toBe(true);
}
const wood=(w:World)=>w.piles.filter(s=>s.item==='wood').reduce((n,s)=>n+s.quantity,0);

test('a pure local plan keeps the chosen source and target and reserves exact quantities across both lists',()=>{
 const f=scene(),before=serializeWorld(f.w),initial=structuredClone(f.initial),task=planConstructionBatch379(f.w,f.p,f.initial,f.reach);
 expect(serializeWorld(f.w)).toBe(before);expect(f.initial).toEqual(initial);
 expect(task).toMatchObject({sourcePileId:f.first.id,quantity:10,destination:{jobId:f.a.id},carryPileId:null,
  constructionBatch379:{item:'wood',sources:[{pileId:f.first.id,quantity:3},{pileId:f.second.id,quantity:7}],destinations:[{jobId:f.a.id,quantity:5},{jobId:f.b.id,quantity:5}]}});
 startConstructionBatch379(f.p,task,[]);
 expect(reservedSource(f.w,f.first.id)).toBe(3);expect(reservedSource(f.w,f.second.id)).toBe(7);
 expect(reservedDestination(f.w,{type:'job',jobId:f.a.id},undefined,'wood')).toBe(5);
 expect(reservedDestination(f.w,{type:'job',jobId:f.b.id},undefined,'wood')).toBe(5);
 expect(validConstructionBatchTask379(f.w,f.p,task,379)).toBe(true);
});

test('a queued batch competes with its own pawn active claims and excludes only itself',()=>{
 const f=scene(),task=begin(f),queued=structuredClone(task);
 f.p.orders.queue.push(queued);
 expect(validConstructionBatchTask379(f.w,f.p,queued,379,true)).toBe(false);
 f.p.haul=null;f.p.orders.active=null;
 expect(validConstructionBatchTask379(f.w,f.p,queued,379,true)).toBe(true);
 f.p.orders.queue.push(structuredClone(queued));
 expect(validConstructionBatchTask379(f.w,f.p,queued,379,true)).toBe(false);
});

test('Shift delivery admission cannot extend into its own active sources or destinations',()=>{
 const f=scene('bed'),active=begin(f);
 addMaterial(f.w,'wood',30,{type:'ground',x:10,z:11},'wood');refreshStock(f.w);
 const free=f.w.piles.find(s=>s.item==='wood'&&s!==f.first&&s!==f.second)!;
 expect(applyCommand(f.w,{type:'order-haul',pawnId:f.p.id,target:{type:'job',jobId:f.b.id},queue:true})).toEqual({ok:true});
 expect(f.p.haul).toBe(active);expect(f.p.orders.queue).toHaveLength(1);
 expect(f.p.orders.queue[0]).toMatchObject({sourcePileId:free.id,quantity:15,destination:{jobId:f.b.id}});
 expect(reservedSource(f.w,f.first.id)).toBe(50);expect(reservedSource(f.w,f.second.id)).toBe(25);expect(reservedSource(f.w,free.id)).toBe(15);
 expect(reservedDestination(f.w,{type:'job',jobId:f.a.id},undefined,'wood')).toBe(45);
 expect(reservedDestination(f.w,{type:'job',jobId:f.b.id},undefined,'wood')).toBe(45);
 expect(validateWorld(f.w)).toEqual([]);
});

test('two real pickups and two paid deliveries retain one cargo and resume identically halfway through collection',()=>{
 const f=scene(),task=begin(f);
 until(f.w,()=>f.p.haul?.phase==='pickup'&&f.p.haul.carryPileId!==null);
 const held=f.w.piles.filter(s=>s.owner.type==='pawn'&&s.owner.pawnId===f.p.id);
 expect(held).toHaveLength(1);expect(held[0]!.quantity).toBe(3);expect(wood(f.w)).toBe(10);
 expect(task.constructionBatch379!.sources).toEqual([{pileId:f.second.id,quantity:7}]);
 expect(task.constructionBatch379!.destinations).toHaveLength(2);expect(f.second.quantity).toBe(7);
 const copy=deserializeWorld(serializeWorld(f.w));expect(copy).toEqual(f.w);
 until(f.w,()=>f.p.haul===null);
 expect(deliveredMaterial(f.w,f.a,'wood')).toBe(5);expect(deliveredMaterial(f.w,f.b,'wood')).toBe(5);
 expect(f.w.piles.filter(s=>s.owner.type==='pawn'&&s.owner.pawnId===f.p.id)).toEqual([]);
 expect(wood(f.w)).toBe(10);
 stepWorld(copy,f.w.tick-copy.tick);expect(copy).toEqual(f.w);
 until(f.w,()=>f.w.structures.filter(s=>s.kind==='wall').length===2);
 expect(wood(f.w)).toBe(0);expect(f.w.structures.filter(s=>s.kind==='wall')).toHaveLength(2);
});

test('a captured arrival edge cannot perform the next pickup from its logical future cell',()=>{
 const f=scene();begin(f);
 until(f.w,()=>f.p.haul?.phase==='pickup'&&f.p.haul.carryPileId!==null&&f.p.x===10&&(f.p.motion?.end??0)>f.w.tick);
 const before=serializeWorld(f.w),edge=structuredClone(f.p.motion);
 processConstructionBatch379(f.w,f.p,()=>{throw Error('Already next to the logical destination');},()=>{});
 expect(serializeWorld(f.w)).toBe(before);expect(f.p.motion).toEqual(edge);expect(f.second.quantity).toBe(7);
});

test.each(['source-loss','forbidden-tail'] as const)('%s releases remaining claims and preserves only the actually acquired cargo',reason=>{
 const f=scene();begin(f);until(f.w,()=>f.p.haul?.phase==='pickup'&&f.p.haul.carryPileId!==null);
 const acquired=f.w.piles.find(s=>s.id===f.p.haul!.carryPileId)!,id=acquired.id;
 if(reason==='source-loss'){f.w.piles.splice(f.w.piles.indexOf(f.second),1);refreshStock(f.w);}
 else expect(applyCommand(f.w,{type:'construction-forbid-379',jobId:f.b.id,forbidden:true}).ok).toBe(true);
 reconcileConstructionBatches379(f.w);
 expect(f.p.haul).toBeNull();expect(f.w.piles.find(s=>s.id===id)?.owner.type).toBe('ground');
 expect(wood(f.w)).toBe(reason==='source-loss'?3:10);
 expect(reservedDestination(f.w,{type:'job',jobId:f.a.id},undefined,'wood')).toBe(0);
 expect(reservedDestination(f.w,{type:'job',jobId:f.b.id},undefined,'wood')).toBe(0);
 expect(deliveredMaterial(f.w,f.a,'wood')+deliveredMaterial(f.w,f.b,'wood')).toBe(0);
 expect(validateWorld(f.w)).toEqual([]);expect(deserializeWorld(serializeWorld(f.w))).toEqual(f.w);
});

test('a lower live carry capacity retains acquired goods and releases only the uncollected allocations',()=>{
 const f=scene('bed'),task=begin(f);
 until(f.w,()=>f.p.haul?.phase==='pickup'&&f.p.haul.carryPileId!==null);
 const carry=f.w.piles.find(s=>s.id===task.carryPileId)!;expect(carry.quantity).toBe(50);
 f.p.health=createMedicalRecord(f.w.tick);f.p.health.missing.push({part:'left-arm',bornAt:f.w.tick,tended:true});reconcilePawnHealth(f.w,f.p);
 processConstructionBatch379(f.w,f.p,()=>{throw Error('A full carrier must head to delivery');},()=>{});
 expect(f.p.haul).toBe(task);expect(carry.quantity).toBe(50);expect(f.second.quantity).toBe(25);
 expect(task).toMatchObject({phase:'deliver',quantity:50,constructionBatch379:{sources:[],destinations:[{jobId:f.a.id,quantity:45},{jobId:f.b.id,quantity:5}]}});
 expect(reservedSource(f.w,f.second.id)).toBe(0);expect(wood(f.w)).toBe(75);expect(validateWorld(f.w)).toEqual([]);
});

test('nested batch data rejects future, duplicate, undefined and accessor fields before ownership admission',()=>{
 const f=scene(),task=begin(f);expect(validConstructionBatchShape379(task,379)).toBe(true);expect(validConstructionBatchShape379(task,378)).toBe(false);
 const duplicate=structuredClone(task);duplicate.constructionBatch379!.sources.push({...duplicate.constructionBatch379!.sources[0]!});
 expect(validConstructionBatchShape379(duplicate,379)).toBe(false);
 const wrong=structuredClone(task);wrong.constructionBatch379!.destinations[0]!.quantity++;
 expect(validConstructionBatchShape379(wrong,379)).toBe(false);
 expect(validConstructionBatchShape379({...f.initial,constructionBatch379:undefined},379)).toBe(false);
 const accessor={...task};Object.defineProperty(accessor,'constructionBatch379',{enumerable:true,get:()=>{throw Error('Untrusted getter');}});
 expect(validConstructionBatchShape379(accessor,379)).toBe(false);
 const blocked=structuredClone(task);blocked.constructionBatch379!.sources[1]!.pileId=f.w.nextId+1;
 expect(validConstructionBatchTask379(f.w,f.p,blocked,379)).toBe(false);
});

test.each(['damage','forbidden','outside-radius'] as const)('additional %s sources cannot silently join the chosen stack',reason=>{
 const f=scene();
 if(reason==='damage')f.second.damage=1;
 else if(reason==='forbidden')f.second.forbidden=true;
 else f.second.owner={type:'ground',x:14,z:10};
 const before=serializeWorld(f.w),task=planConstructionBatch379(f.w,f.p,f.initial,f.reach);
 expect(task.constructionBatch379).toBeUndefined();expect(task.quantity).toBe(3);expect(serializeWorld(f.w)).toBe(before);
});
