import {expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {billWorkerWorkshop461} from './scenarios/bill-workers-v461.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import {queryCookingBillStatus} from '../src/sim/cooking-diagnostics.ts';
import {planCookingOrder} from '../src/sim/player-cooking.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {writeTestFileSync,testOutputPath} from './test-output.ts';
import type {World,Command} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const result=applyCommand(w,c);expect(result,JSON.stringify({command:c,result})).toMatchObject({ok:true});};
const exact=(w:World)=>{expect(validateWorld(w)).toEqual([]);const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);return raw;};
const balance=(w:World)=>w.piles.reduce((n,p)=>n+(p.item==='cloth'?p.quantity:p.unfinished?.recipe==='shirt'?p.unfinished.parts.reduce((a,b)=>a+b,0):0),0)+(w.tailoring?.completed??0)*45+(w.tailoring?.lostCloth??0);
function until(w:World,done:()=>boolean,limit=2200){for(let n=0;n<limit&&!done();n++)stepWorld(w);expect(done(),JSON.stringify({tick:w.tick,pawns:w.pawns.map(p=>({id:p.id,state:p.state,cooking:p.cooking,orders:p.orders})),piles:w.piles})).toBe(true);}

test('real gather, author work and output keep admission through policy changes, then the next shirt goes to the new worker',()=>{
 const f=billWorkerWorkshop461(),{w,author,other,station,bill}=f,folder='artifacts/bill-workers-v461';
 const checkpoints:Record<string,{path:string;tick:number;sha256:string}>={};let stage='before';
 const save=(name:string)=>{writeTestFileSync(`${folder}/${name}-diagnostic.json`,JSON.stringify(w));const raw=exact(w);writeTestFileSync(`${folder}/${name}.json`,raw);checkpoints[name]={path:testOutputPath(`${folder}/${name}.json`),tick:w.tick,sha256:createHash('sha256').update(raw).digest('hex')};return raw;};
 const policy=(pawnId:number|null,skillMin=0,skillMax=20)=>accept(w,{type:'bill-worker-policy',structureId:station.id,billId:bill.id,policy:{pawnId,skillMin,skillMax}});
 try{
  expect(w.schemaVersion).toBe(283);save('before');policy(null,8,8);
  const otherBefore=JSON.stringify(other),rng=w.rng;expect(planCookingOrder(w,other,station.id).reason).toContain('minimum choisi');expect(JSON.stringify(other)).toBe(otherBefore);expect(w.rng).toBe(rng);
  stage='gather';until(w,()=>author.cooking?.phase==='gather'&&author.cooking.ingredients.some(i=>i.stage==='held'));
  const gathering=JSON.stringify({task:author.cooking,cargo:w.piles.filter(p=>p.owner.type==='pawn'),orders:author.orders});
  policy(other.id,8,8);expect(JSON.stringify({task:author.cooking,cargo:w.piles.filter(p=>p.owner.type==='pawn'),orders:author.orders})).toBe(gathering);expect(other.cooking).toBeNull();save('gather-other-named');
  stage='work';until(w,()=>author.cooking?.phase==='work'&&(w.piles.find(p=>p.unfinished?.recipe==='shirt')?.unfinished?.progress??0)>50_000);
  const work=w.piles.find(p=>p.unfinished?.recipe==='shirt')!,workId=work.id,progress=work.unfinished!.progress;
  expect(work.unfinished!.authorId).toBe(author.id);policy(null,0,0);expect(work.unfinished!.progress).toBe(progress);expect(author.cooking?.phase).toBe('work');expect(balance(w)).toBe(90);
  const actualWork=save('actual-work-outside-range');
  const encoder=new SnapshotEncoder({structureDelta:true}),decoder=new SnapshotDecoder(),resident=new ResidentPresentationAssembler();
  const packet=encoder.encode(w,0,0),a=decoder.adopt(structuredClone(packet)),b=resident.adopt(structuredClone(packet));expect(a.status).toBe('applied');expect(b.status).toBe('applied');if(a.status==='applied'&&b.status==='applied')expect(a.world).toEqual(b.world);
  const replay=deserializeWorld(actualWork);until(w,()=>author.cooking?.phase==='output');stepWorld(replay,w.tick-replay.tick);expect(serializeWorld(replay)).toBe(serializeWorld(w));
  stage='output';const output=author.cooking!,productId=output.productId;expect(productId).not.toBeNull();expect(w.tailoring?.completed).toBe(1);const taskBefore=JSON.stringify(output);
  policy(other.id,8,8);expect(JSON.stringify(author.cooking)).toBe(taskBefore);save('output-other-named');
  stage='first-deposit';until(w,()=>!author.cooking&&w.piles.some(p=>p.id===productId&&p.owner.type==='ground'));expect(w.piles.filter(p=>p.id===productId)).toHaveLength(1);expect(w.piles.some(p=>p.id===workId)).toBe(false);expect(balance(w)).toBe(90);save('first-deposited');
  stage='second-author';until(w,()=>other.cooking?.phase==='work'&&!!w.piles.find(p=>p.unfinished?.authorId===other.id));expect(author.cooking).toBeNull();save('next-worker-work');
  stage='finished';until(w,()=>w.tailoring?.completed===2&&!other.cooking);expect(w.piles.filter(p=>p.item==='cloth-shirt')).toHaveLength(2);expect(bill.target).toBe(0);expect(balance(w)).toBe(90);save('finished');
  writeTestFileSync(`${folder}/manifest.json`,JSON.stringify({version:461,schemaVersion:w.schemaVersion,preparation:f.preparation,authorId:author.id,otherId:other.id,stationId:station.id,billId:bill.id,workId,productId,checkpoints},null,2)+'\n');
 }finally{writeTestFileSync(`${folder}/diagnostic.json`,JSON.stringify(w));writeTestFileSync(`${folder}/stage.json`,JSON.stringify({stage,tick:w.tick,checkpoints})+'\n');}
},30000);

test('after a real interruption the new worker cannot steal the original author work, and restoring its author resumes the same item',()=>{
 const {w,author,other,station,bill}=billWorkerWorkshop461();
 accept(w,{type:'bill-worker-policy',structureId:station.id,billId:bill.id,policy:{pawnId:author.id,skillMin:0,skillMax:0}});
 until(w,()=>author.cooking?.phase==='work'&&(w.piles.find(p=>p.unfinished)?.unfinished?.progress??0)>50_000);
 const item=w.piles.find(p=>p.unfinished)!,id=item.id,progress=item.unfinished!.progress;
 // Tailoring has its own priority since schema 302 (Core's Tailoring work type).
 accept(w,{type:'priority',pawnId:author.id,work:'tailor',value:0});accept(w,{type:'bill-worker-policy',structureId:station.id,billId:bill.id,policy:{pawnId:other.id,skillMin:0,skillMax:0}});
 const interrupted=exact(w);stepWorld(w,80);expect(w.piles.find(p=>p.id===id)?.unfinished).toMatchObject({authorId:author.id,progress});expect(other.cooking).toBeNull();expect(queryCookingBillStatus(w,station,bill).code).toBe('unfinished');expect(balance(w)).toBe(90);
 const reload=deserializeWorld(interrupted);stepWorld(reload,80);expect(serializeWorld(reload)).toBe(serializeWorld(w));
 accept(w,{type:'bill-worker-policy',structureId:station.id,billId:bill.id,policy:{pawnId:author.id,skillMin:0,skillMax:0}});accept(w,{type:'priority',pawnId:author.id,work:'tailor',value:1});
 until(w,()=>(w.piles.find(p=>p.id===id)?.unfinished?.progress??0)>progress);expect(w.piles.find(p=>p.id===id)?.unfinished?.authorId).toBe(author.id);expect(balance(w)).toBe(90);exact(w);
},30000);

test('an already accepted queued manual bill keeps its admission at promotion while later manual requests are refused',()=>{
 const {w,author,other,station,bill}=billWorkerWorkshop461();other.priorities.craft=0;author.priorities.haul=1;
 // Initial finite wood is declared before any tick. This real haul order keeps
 // the actor busy when the recipe job is constructed, reserved and enqueued.
 addGroundMaterial(w,'wood',10,{x:6,z:5});refreshStock(w);
 accept(w,{type:'stockpile',enabled:true,x:15,z:13,filters:{wood:true,food:false}});const wood=w.piles.find(p=>p.item==='wood')!;
 accept(w,{type:'order-haul',pawnId:author.id,target:{type:'pile',pileId:wood.id},queue:false});accept(w,{type:'order-cook',pawnId:author.id,structureId:station.id,queue:true});expect(author.orders.queue).toHaveLength(1);
 const queued=JSON.stringify(author.orders.queue);accept(w,{type:'bill-worker-policy',structureId:station.id,billId:bill.id,policy:{pawnId:other.id,skillMin:20,skillMax:20}});expect(JSON.stringify(author.orders.queue)).toBe(queued);
 expect(planCookingOrder(w,author,station.id).reason).toContain('autre personne');const raw=exact(w),copy=deserializeWorld(raw);
 until(w,()=>author.cooking?.phase==='work');stepWorld(copy,w.tick-copy.tick);expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(author.orders.active).toBe('cook');expect(author.orders.queue).toHaveLength(0);
 until(w,()=>w.tailoring?.completed===1&&!author.cooking);expect(w.piles.filter(p=>p.item==='cloth-shirt')).toHaveLength(1);expect(bill.target).toBe(1);expect(balance(w)).toBe(90);exact(w);
},30000);
