import {expect,test} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {deserializeWorld,serializeWorld,validateWorld,validateCampaignSchema378} from '../src/sim/serialization.ts';
import {constructionForbidTarget379} from '../src/sim/construction-forbid-379.ts';
import {validConstructionMarkers379} from '../src/sim/construction-state-379.ts';
import {validConstructionTransport379} from '../src/sim/construction-forbid-save-379.ts';
import {queryOrderOptions} from '../src/sim/player-orders.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import {SnapshotEncoder,SnapshotDecoder,type SnapshotMessage} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import {createNativeCloneResidentLane} from '../src/bridge/native-clone-resident.ts';
import {WorkerNaturalAppearance} from '../src/bridge/worker-natural-appearance.ts';
import {readResidentWorkerMessage,residentPublication} from '../src/bridge/resident-protocol.ts';
import {planConstructionBatch379,startConstructionBatch379} from '../src/sim/construction-batch-379.ts';
import {blockedCells,reachableCells,routeToJob} from '../src/sim/pathfinding.ts';
import type {HaulTask} from '../src/sim/types.ts';

function camp(){
 const w=createWorld(379,32,32);w.tiles=w.tiles.map(()=>({terrain:'soil'}));w.resources=[];w.structures=[];w.jobs=[];w.piles=[];w.stockpiles=[];w.growingZones=[];w.pawns=w.pawns.slice(0,1);
 const p=w.pawns[0]!;delete p.background;delete p.traits;p.x=5;p.z=8;p.hunger=100;p.rest=100;p.recreation.level=100;p.schedule.fill('anything');p.skills.construction.level=10;
 for(const key of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[key]=0;p.priorities.build=1;p.priorities.haul=1;
 addMaterial(w,'wood',75,{type:'ground',x:6,z:8},'wood');addMaterial(w,'wood',25,{type:'ground',x:6,z:9},'wood');refreshStock(w);return {w,p};
}
function until(w:World,condition:()=>boolean,max=1200){for(let i=0;i<max&&!condition();i++)stepWorld(w);expect(condition(),JSON.stringify({tick:w.tick,jobs:w.jobs,pawns:w.pawns.map(p=>({id:p.id,jobId:p.jobId,haul:p.haul,state:p.state}))})).toBe(true);expect(validateWorld(w)).toEqual([]);}
const forbid=(w:World,jobId:number,forbidden=true)=>expect(applyCommand(w,{type:'construction-forbid-379',jobId,forbidden})).toEqual({ok:true});

test('forbidden ghosts keep their identity and materials; builders and direct work wait for Allow',()=>{
 const {w,p}=camp();expect(applyCommand(w,{type:'designate',kind:'bed',material:'wood',x:10,z:8})).toEqual({ok:true});const job=w.jobs[0]!,rng=w.rng,nextId=w.nextId;
 forbid(w,job.id);expect(job.forbidden379).toBe(true);expect(w.jobs[0]).toBe(job);expect(w.rng).toBe(rng);expect(w.nextId).toBe(nextId);
 const before=JSON.stringify(w),options=queryOrderOptions(w,p.id,job);expect(options.some(o=>!o.enabled&&o.reason?.includes('interdit'))).toBe(true);expect(JSON.stringify(w)).toBe(before);
 expect(applyCommand(w,{type:'order-job',pawnId:p.id,jobId:job.id,queue:false}).ok).toBe(false);stepWorld(w,25);
 expect(w.jobs[0]).toBe(job);expect(job.escrow.wood).toBe(0);expect(p.haul).toBeNull();expect(p.jobId).toBeNull();
 forbid(w,job.id,false);expect(Object.hasOwn(job,'forbidden379')).toBe(false);until(w,()=>w.structures.some(s=>s.kind==='bed'&&s.x===job.x&&s.z===job.z));expect(w.stock.wood).toBe(55);
});
test('forbidding a real frame stops its builder and preserves paid work and the same delivered Things through reload',()=>{
 const {w,p}=camp();expect(applyCommand(w,{type:'designate',kind:'bed',material:'wood',x:10,z:8}).ok).toBe(true);const job=w.jobs[0]!;
 until(w,()=>job.construction==='frame'&&p.jobId===job.id&&job.progress>0);const progress=job.progress,remainder=job.workRemainder,delivered=w.piles.filter(i=>i.owner.type==='job'&&i.owner.jobId===job.id),queue=[{type:'read-book-295' as const,pawnId:p.id,bookId:w.nextId+10}];p.orderedQueue378=queue;
 forbid(w,job.id);expect(p.jobId).toBeNull();expect(job.status).toBe('pending');expect(job.reservedBy).toBeNull();expect(job.progress).toBe(progress);expect(job.workRemainder).toBe(remainder);expect(p.orderedQueue378).toBe(queue);expect(job.escrow.wood).toBe(45);
 for(const item of delivered)expect(w.piles).toContain(item);expect(validateWorld(w)).toEqual([]);delete p.orderedQueue378;
 const saved=serializeWorld(w),copy=deserializeWorld(saved);expect(serializeWorld(copy)).toBe(saved);stepWorld(w,10);expect(job.progress).toBe(progress);
 forbid(w,job.id,false);until(w,()=>w.structures.some(s=>s.kind==='bed'&&s.x===job.x&&s.z===job.z));expect(w.stock.wood).toBe(55);
});
test('forbidding an actual in-flight delivery retains its real cargo and no delivered resources are refunded',()=>{
 const {w,p}=camp();expect(applyCommand(w,{type:'designate',kind:'bed',material:'wood',x:17,z:8}).ok).toBe(true);const job=w.jobs[0]!;
 until(w,()=>!!p.haul?.carryPileId&&(p.motion?.end??0)>w.tick);const cargo=w.piles.find(i=>i.id===p.haul!.carryPileId)!,quantity=cargo.quantity,total=w.piles.filter(i=>i.item==='wood').reduce((n,i)=>n+i.quantity,0);
 forbid(w,job.id);expect(p.haul).toBeNull();expect(w.piles).toContain(cargo);expect(cargo.quantity).toBe(quantity);expect(cargo.owner).toEqual({type:'pawn',pawnId:p.id});expect(p.interruptedCargo).toBe(true);expect(w.piles.filter(i=>i.item==='wood').reduce((n,i)=>n+i.quantity,0)).toBe(total);
 expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));stepWorld(w,25);expect(job.escrow.wood).toBe(0);expect(w.piles.filter(i=>i.item==='wood').reduce((n,i)=>n+i.quantity,0)).toBe(total);
});
test('a door ghost permission targets its own future ID and independent manual wall removal remains allowed',()=>{
 const {w}=camp();expect(applyCommand(w,{type:'designate',kind:'wall',material:'wood',x:10,z:8}).ok).toBe(true);until(w,()=>w.structures.some(s=>s.kind==='wall'));
 expect(applyCommand(w,{type:'designate',kind:'door',material:'wood',x:10,z:8}).ok).toBe(true);const parent=w.jobs.find(j=>j.wallDoor296?.plan)!,planId=parent.wallDoor296!.plan!.id;
 expect(constructionForbidTarget379(w,parent.id)).toBeUndefined();expect(constructionForbidTarget379(w,planId)?.id).toBe(planId);forbid(w,planId);expect(parent.forbidden379).toBeUndefined();expect(parent.wallDoor296!.plan!.forbidden379).toBe(true);
 stepWorld(w,15);expect(w.structures.some(s=>s.kind==='wall')).toBe(true);
 expect(applyCommand(w,{type:'designate',kind:'deconstruct',x:10,z:8}).ok).toBe(true);expect(parent.wallDoor296!.manual).toBe(true);until(w,()=>!w.structures.some(s=>s.kind==='wall'));
 const ghost=w.jobs.find(j=>j.id===planId)!;expect(ghost.forbidden379).toBe(true);expect(ghost.construction).toBe('blueprint');stepWorld(w,15);expect(ghost.escrow.wood).toBe(0);forbid(w,planId,false);until(w,()=>w.structures.some(s=>s.kind==='door'&&s.x===ghost.x&&s.z===ghost.z));
});
test('an already-cutting physical blocker may finish, then the forbidden ghost receives no construction work',()=>{
 const {w,p}=camp(),tree={id:w.nextId++,kind:'tree' as const,x:10,z:8,amount:20};w.resources.push(tree);
 expect(applyCommand(w,{type:'designate',kind:'bed',material:'wood',x:10,z:8}).ok).toBe(true);const job=w.jobs[0]!;
 until(w,()=>!!job.clearance&&job.clearance.progress>0);forbid(w,job.id);expect(job.clearance).toBeDefined();expect(p.jobId).toBe(job.id);
 until(w,()=>!w.resources.some(r=>r.id===tree.id));expect(job.forbidden379).toBe(true);expect(job.progress).toBe(0);expect(job.escrow.wood).toBe(0);expect(p.jobId).toBeNull();stepWorld(w,15);expect(w.structures).toHaveLength(0);expect(w.jobs).toContain(job);
});
test('378 is strict before a neutral379 migration; permission, batch and tailor history cannot be smuggled backwards',()=>{
 const {w}=camp(),old=JSON.parse(serializeWorld(w));old.schemaVersion=378;expect(validateCampaignSchema378(old)).toEqual([]);expect(JSON.parse(serializeWorld(deserializeWorld(JSON.stringify(old))))).toEqual({...old,schemaVersion:SCHEMA_VERSION});
 for(const field of ['forbidden379','tailorSteel379','constructionBatch379']){const raw=structuredClone(old);if(field==='constructionBatch379')raw.pawns[0].haul={constructionBatch379:undefined};else raw.jobs=[{id:raw.nextId++,kind:'electric-tailor-bench',material:'steel',construction:'blueprint',[field]:true}];expect(validateCampaignSchema378(raw).length).toBeGreaterThan(0);}
 const job={kind:'bed',construction:'blueprint',forbidden379:true};expect(validConstructionMarkers379(job,378)).toBe(false);expect(validConstructionMarkers379(job,379)).toBe(true);
 for(const value of [undefined,false,1])expect(validConstructionMarkers379({...job,forbidden379:value},379)).toBe(false);
 expect(validConstructionTransport379({structures:[{...job,id:1}]},379)).toBe(false);
 for(const kind of ['bed','electric-tailor-bench'])for(const material of ['wood','steel'])expect(validConstructionMarkers379({kind,material,tailorSteel379:true},379)).toBe(kind==='electric-tailor-bench'&&material==='steel');
});
test.each(['public','resident','native clone'] as const)('%s preserves same-tick construction permission and refuses future378 or malformed markers',kind=>{
 const {w}=camp();expect(applyCommand(w,{type:'designate',kind:'bed',material:'wood',x:10,z:8}).ok).toBe(true);const job=w.jobs[0]!,encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),producer=new WorkerNaturalAppearance(),lane=kind==='native clone'?createNativeCloneResidentLane():undefined,reader=lane?.reader??(kind==='public'?new SnapshotDecoder():new ResidentPresentationAssembler());
 const packet=(checkpoint=false)=>{const publication=encoder.encode(w,0,1,checkpoint);return readResidentWorkerMessage(structuredClone(residentPublication(publication,producer.capture(w,publication)))) as SnapshotMessage<true>;};
 try{expect(reader.adopt(packet()).status).toBe('applied');forbid(w,job.id);const current=reader.adopt(packet());expect(current.status,JSON.stringify(current)).toBe('applied');if(current.status!=='applied')return;expect(current.world.jobs[0]!.forbidden379).toBe(true);
  const malformed=packet();(malformed.world.jobs[0] as unknown as {forbidden379:boolean}).forbidden379=false;expect(reader.adopt(malformed).status).toBe('resync');const future=packet(true);(future.world as unknown as {schemaVersion:number}).schemaVersion=378;expect(reader.adopt(future).status).toBe('resync');
 }finally{lane?.close();}
});

test.each(['public','resident','native clone'] as const)('%s admits real partial pickups and refuses duplicated cargo claims and old378 payloads',kind=>{
 for(const scenario of ['batch','opportunity'] as const){
  const {w,p}=camp();w.piles=[];addMaterial(w,'wood',scenario==='batch'?3:20,{type:'ground',x:6,z:8},'wood');addMaterial(w,'wood',scenario==='batch'?7:30,{type:'ground',x:9,z:8},'wood');refreshStock(w);
  if(scenario==='batch'){
   for(const x of [14,18])expect(applyCommand(w,{type:'designate',kind:'wall',material:'wood',x,z:10}).ok).toBe(true);
   const source=w.piles[0]!,job=w.jobs[0]!,reach=reachableCells(w,p,blockedCells(w),new Set()),initial:HaulTask={sourcePileId:source.id,quantity:3,phase:'pickup',destination:{type:'job',jobId:job.id,forConstruction:true},carryPileId:null};
   const task=planConstructionBatch379(w,p,initial,reach);expect(task.constructionBatch379).toBeDefined();startConstructionBatch379(p,task,routeToJob(w,source.owner as {x:number;z:number},reach,true)!);
  }else{
   expect(applyCommand(w,{type:'stockpile',x:20,z:8,enabled:true,filters:{wood:true,food:false}}).ok).toBe(true);
   expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:w.piles[0]!.id},queue:false}).ok).toBe(true);
  }
  until(w,()=>p.haul?.phase==='pickup'&&p.haul.carryPileId!==null&&(scenario==='batch'?!!p.haul.constructionBatch379:!!p.haul.haulOpportunity379));
  const encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),producer=new WorkerNaturalAppearance(),lane=kind==='native clone'?createNativeCloneResidentLane():undefined,reader=lane?.reader??(kind==='public'?new SnapshotDecoder():new ResidentPresentationAssembler());
  const packet=(checkpoint=false)=>{const publication=encoder.encode(w,0,1,checkpoint);return readResidentWorkerMessage(structuredClone(residentPublication(publication,producer.capture(w,publication)))) as SnapshotMessage<true>;};
  try{
   const first=reader.adopt(packet());expect(first.status,scenario).toBe('applied');if(first.status!=='applied')continue;
   expect(first.world.pawns[0]!.haul).toEqual(p.haul);
   const mismatch=packet();mismatch.world.pawns[0]!.haul!.quantity++;expect(reader.adopt(mismatch).status).toBe('resync');
   const duplicate=packet(true);duplicate.world.pawns[0]!.haul!.carryPileId=p.haul!.sourcePileId;expect(reader.adopt(duplicate).status).toBe('resync');
   const future=packet(true);(future.world as unknown as {schemaVersion:number}).schemaVersion=378;expect(reader.adopt(future).status).toBe('resync');
   expect(reader.adopt(packet(true)).status).toBe('applied');
  }finally{lane?.close();}
 }
});
