import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization';
import {addMaterial} from '../src/sim/materials';
import {queryOrderOptions,clearQueuedOrders} from '../src/sim/player-orders';
import {isOrderedCommand378,validOrderedQueuePawn378,validateOrderedQueues378,orderedQueueBusy378,advanceGeneralQueue378} from '../src/sim/ordered-queue-378';
import {orderedTargetClaimant378,orderedTargetClaimed378,type OrderedCommand378} from '../src/sim/order-types';
import {medicalCamp} from './scenarios/health';
import {huntingCamp} from './scenarios/hunting';
import {designateSlaughter} from '../src/sim/animal-slaughter';
import {visitorTradeFixture} from './scenarios/visitors';
import {orbitalCamp} from './helpers/orbital-v281';
import {hiddenExplorationCommandTarget256} from '../src/sim/exploration-command-targets-256';
import type {Command,World} from '../src/sim/types';

function camp(count=2){
 const w=medicalCamp(count),p=w.pawns[0]!;
 for(const [i,a] of w.pawns.entries()){a.x=4+i;a.z=5;a.hunger=55;a.rest=100;a.priorities.gather=1;}
 for(const x of [8,15,21]){w.resources.push({id:w.nextId++,kind:'tree',x,z:5,amount:12});expect(applyCommand(w,{type:'designate',kind:'chop',x,z:5}).ok).toBe(true);}
 addMaterial(w,'food',4,{type:'ground',x:10,z:5},'survival-meal');
 addMaterial(w,'weapon',1,{type:'ground',x:12,z:5},'revolver');
 return {w,p,jobs:[...w.jobs],food:w.piles.find(i=>i.kind==='food')!,gun:w.piles.find(i=>i.kind==='weapon')!};
}
const ok=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
const wrapped=(order:OrderedCommand378):Command=>({type:'queue-order-378',order});

test('a nested future transport cannot reveal or reserve a pile on an unknown cell',()=>{
 const {w,p,jobs,food}=camp();
 w.site={revision:3,tileId:0,mapSeed:w.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};w.exploration={revision:1};
 ok(w,{type:'order-job',pawnId:p.id,jobId:jobs[0]!.id,queue:false});
 if(food.owner.type!=='ground')throw Error('Prepared pile must be physical ground stock.');
 const cell=food.owner.z*w.width+food.owner.x;w.tiles[cell]!.fogged=true;
 const order={type:'order-haul' as const,pawnId:p.id,target:{type:'pile' as const,pileId:food.id},queue:false as const};
 const before=JSON.stringify(w);
 for(const command of [wrapped(order),{...order,queue:true},order])expect(applyCommand(w,command)).toMatchObject({ok:false,code:'missing-target'});
 expect(JSON.stringify(w)).toBe(before);expect(p.orderedQueue378).toBeUndefined();
 delete w.tiles[cell]!.fogged;
 expect(hiddenExplorationCommandTarget256(w,order)).toBe(false);
});

test('mixed reserved prefix and general tail execute food, equipment and later work in FIFO order and reload exactly',()=>{
 const {w,p,jobs,food,gun}=camp();const [first,second,last]=jobs;
 ok(w,{type:'order-job',pawnId:p.id,jobId:first!.id,queue:false});
 ok(w,{type:'order-job',pawnId:p.id,jobId:second!.id,queue:true});
 const active=p.jobId;
 ok(w,wrapped({type:'order-consume',pawnId:p.id,pileId:food.id,queue:false}));
 ok(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:true});
 ok(w,{type:'order-job',pawnId:p.id,jobId:last!.id,queue:true});
 expect(p.jobId).toBe(active);expect(p.orders.queue).toEqual([second!.id]);
 expect(p.orderedQueue378?.map(c=>c.type)).toEqual(['order-consume','order-equipment','order-job']);
 expect(validateWorld(w)).toEqual([]);
 const copy=deserializeWorld(serializeWorld(w)),seen:string[]=[];
 for(let i=0;i<650&&(w.jobs.length||p.orderedQueue378?.length||p.equipmentTask);i++){
  const state=p.jobId===first!.id?'first':p.jobId===second!.id?'second':p.orders.active==='consume'?'food':p.equipmentTask?'equipment':p.jobId===last!.id?'last':undefined;
  if(state&&!seen.includes(state))seen.push(state);
  stepWorld(w);stepWorld(copy);
 }
 expect(seen,JSON.stringify({jobs:w.jobs,pawns:w.pawns.map(a=>({id:a.id,jobId:a.jobId,queue:a.orderedQueue378})),events:w.events.slice(-8)})).toEqual(['first','second','food','equipment','last']);
 expect(w.jobs).toHaveLength(0);expect(p.orderedQueue378).toBeUndefined();
 expect(w.piles.find(i=>i.id===gun.id)?.owner).toEqual({type:'equipment',pawnId:p.id});
 expect(validateWorld(w)).toEqual([]);expect(copy).toEqual(w);
});

test('Shift menus use real direct eligibility and future targets exclude another pawn',()=>{
 const {w,p,jobs,food,gun}=camp(),other=w.pawns[1]!;
 ok(w,{type:'order-job',pawnId:p.id,jobId:jobs[0]!.id,queue:false});
 const before=JSON.stringify(w);
 expect(queryOrderOptions(w,p.id,{x:10,z:5},true).find(o=>o.consumePileId===food.id)?.enabled).toBe(true);
 expect(queryOrderOptions(w,p.id,{x:12,z:5},true).find(o=>o.equipmentItemId===gun.id)?.enabled).toBe(true);
 expect(JSON.stringify(w)).toBe(before);
 ok(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:true});
 expect(orderedTargetClaimed378(w,'pile',gun.id,other.id)).toBe(true);
 expect(orderedTargetClaimant378(w,'pile',gun.id,other.id)).toBe(p);
 const reserved=JSON.stringify(w);
 expect(applyCommand(w,{type:'order-equipment',pawnId:other.id,itemId:gun.id,action:'equip',queue:false}).ok).toBe(false);
 expect(JSON.stringify(w)).toBe(reserved);
 expect(queryOrderOptions(w,other.id,{x:12,z:5},false).find(o=>o.equipmentItemId===gun.id)?.enabled).toBe(false);
});

test('repeated future consumption commands remain distinct FIFO entries',()=>{
 const {w,p,jobs,food}=camp(1),c:OrderedCommand378={type:'order-consume',pawnId:p.id,pileId:food.id,queue:false};
 ok(w,{type:'order-job',pawnId:p.id,jobId:jobs[0]!.id,queue:false});
 ok(w,wrapped(c));ok(w,wrapped(c));
 expect(p.orderedQueue378).toEqual([c,c]);expect(p.orderedQueue378![0]).not.toBe(p.orderedQueue378![1]);
 expect(validateWorld(w)).toEqual([]);
});

test('clear and direct interruption discard every tail entry',()=>{
 const {w,p,jobs,food,gun}=camp();
 ok(w,{type:'order-job',pawnId:p.id,jobId:jobs[0]!.id,queue:false});
 ok(w,wrapped({type:'order-consume',pawnId:p.id,pileId:food.id,queue:false}));
 ok(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:true});
 ok(w,{type:'clear-orders',pawnId:p.id});expect(p.orderedQueue378).toBeUndefined();expect(p.jobId).toBeNull();
 ok(w,{type:'order-job',pawnId:p.id,jobId:jobs[0]!.id,queue:false});
 ok(w,wrapped({type:'order-consume',pawnId:p.id,pileId:food.id,queue:false}));
 ok(w,{type:'order-job',pawnId:p.id,jobId:jobs[1]!.id,queue:false});
 expect(p.orderedQueue378).toBeUndefined();expect(p.jobId).toBe(jobs[1]!.id);
 expect(validateWorld(w)).toEqual([]);
});

test('lost targets are discarded one per activation without erasing following intent',()=>{
 const {w,p,food,gun}=camp(1);
 p.orderedQueue378=[{type:'order-consume',pawnId:p.id,pileId:food.id,queue:false},{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:false}];
 w.piles=w.piles.filter(i=>i.id!==food.id);
 expect(advanceGeneralQueue378(w,p,c=>applyCommand(w,c))).toBe(true);
 expect(p.orderedQueue378?.map(c=>c.type)).toEqual(['order-equipment']);expect(p.equipmentTask).toBeUndefined();
 expect(advanceGeneralQueue378(w,p,c=>applyCommand(w,c))).toBe(true);
 expect(p.orderedQueue378).toBeUndefined();expect(p.equipmentTask?.itemId).toBe(gun.id);
 expect(w.events.some(e=>e.message.includes('ordre abandonné'))).toBe(true);
});

test('schema, actor, descriptors, bounds and combined capacity guard future intent shape',()=>{
 const {w,p,jobs,gun}=camp(1),c:OrderedCommand378={type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:false};
 expect(isOrderedCommand378(c)).toBe(true);
 for(const bad of [{...c,queue:true},{...c,extra:0},{...c,pawnId:NaN},{...c,action:'invent'},{...c,get itemId(){throw Error('must not read');}}])expect(isOrderedCommand378(bad)).toBe(false);
 expect(validOrderedQueuePawn378({...p,orderedQueue378:[c]},377)).toBe(false);
 expect(validOrderedQueuePawn378({...p,orderedQueue378:[]},378)).toBe(false);
 expect(validOrderedQueuePawn378({...p,orderedQueue378:Array(1)},378)).toBe(false);
 expect(validOrderedQueuePawn378({...p,orderedQueue378:[{...c,pawnId:p.id+1}]},378)).toBe(false);
 expect(validOrderedQueuePawn378(Object.assign(Object.create({orderedQueue378:[c]}),p),378)).toBe(false);
 expect(validOrderedQueuePawn378({...p,state:'dead',orderedQueue378:[c]},378)).toBe(false);
 p.orderedQueue378=Array.from({length:32},()=>({...c}));
 expect(applyCommand(w,{type:'order-job',pawnId:p.id,jobId:jobs[0]!.id,queue:true}).ok).toBe(false);
 expect(p.orderedQueue378).toHaveLength(32);clearQueuedOrders(w,p);
 p.orderedQueue378=[{type:'draft-move',pawnIds:[p.id],target:{x:w.width,z:1},queue:false}];
 expect(validateOrderedQueues378(w,378)).toContain('Queued destination outside map.');
});

test('group draft movement cannot bypass a personal order and failed group admission is atomic',()=>{
 const {w,p,gun}=camp(),other=w.pawns[1]!;
 ok(w,{type:'draft',pawnIds:[p.id,other.id],enabled:true});
 ok(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:false});
 const before=JSON.stringify(w);
 expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id,999999],target:{x:17,z:8},queue:true}).ok).toBe(false);
 expect(JSON.stringify(w)).toBe(before);
 ok(w,{type:'draft-move',pawnIds:[p.id,other.id],target:{x:17,z:8},queue:true});
 expect(p.equipmentTask?.itemId).toBe(gun.id);expect(p.draft?.target).toBeNull();
 expect(p.orderedQueue378?.[0]?.type).toBe('draft-move');expect(other.orderedQueue378?.[0]?.type).toBe('draft-move');
 expect(validateWorld(w)).toEqual([]);
 for(let i=0;i<100&&p.equipmentTask;i++)stepWorld(w);
 for(let i=0;i<100&&p.orderedQueue378;i++)stepWorld(w);
 expect(p.orderedQueue378).toBeUndefined();expect(p.draft?.target).not.toBeNull();
});

test('ordinary single draft moves keep their physical prefix and share its capacity with later personal intents',()=>{
 const {w,p,gun}=camp(1);
 ok(w,{type:'draft',pawnIds:[p.id],enabled:true});
 ok(w,{type:'draft-move',pawnIds:[p.id],target:{x:17,z:8},queue:false});
 for(let i=0;i<31;i++)ok(w,{type:'draft-move',pawnIds:[p.id],target:{x:19,z:8},queue:true});
 expect(p.draft!.queue).toHaveLength(31);expect(p.orderedQueue378).toBeUndefined();
 ok(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:true});
 expect(p.orderedQueue378).toHaveLength(1);expect(validateWorld(w)).toEqual([]);
 const before=JSON.stringify(w);
 expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x:21,z:8},queue:true}).ok).toBe(false);
 expect(JSON.stringify(w)).toBe(before);
 expect(queryOrderOptions(w,p.id,{x:12,z:5},true).find(o=>o.equipmentItemId===gun.id)?.enabled).toBe(false);
 const invalid={...p,orderedQueue378:[...p.orderedQueue378!,p.orderedQueue378![0]!]};
 expect(validOrderedQueuePawn378(invalid,378)).toBe(false);
});

test('auto attacks cannot hold an explicit tail forever and committed travel still does',()=>{
 const {w,p}=camp(1);p.draft={target:null,queue:[],lastActiveTick:w.tick};
 p.shooting={order:{targetId:999,weaponId:999,startedDowned:false,auto:{kind:'draft'}},stance:null};
 expect(orderedQueueBusy378(w,p)).toBe(false);
 p.moveCooldown=1;expect(orderedQueueBusy378(w,p)).toBe(true);p.moveCooldown=0;
 p.draft.target={x:p.x+1,z:p.z};expect(orderedQueueBusy378(w,p)).toBe(true);
 p.draft.target={x:p.x,z:p.z};expect(orderedQueueBusy378(w,p)).toBe(false);
});

test('a queued personal animal order waits for work and keeps the later food order through activation',()=>{
 const w=huntingCamp(),p=w.pawns[0]!,a=w.wildlife!.animals[0]!;
 w.deterioration!.lastTick=w.tick;w.pawns=[p];w.resources=[];w.events=[];
 delete p.background;delete p.traits;p.priorities.gather=1;p.priorities.hunt=0;p.priorities.handle=1;p.hunger=50;
 p.skills.animals={level:8,xp:0,dailyXp:0,passion:0};
 Object.assign(a,{x:p.x+2,z:p.z,path:[],state:'idle',nextDecision:w.tick+100});delete a.motion;
 a.domestic={since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+45000,lastTraining:w.tick};
 expect(designateSlaughter(w,{type:'slaughter',animalId:a.id,enabled:true}).ok).toBe(true);
 const tree={id:w.nextId++,kind:'tree' as const,x:p.x+1,z:p.z+1,amount:12};w.resources.push(tree);
 ok(w,{type:'designate',kind:'chop',x:tree.x,z:tree.z});const job=w.jobs[0]!;
 addMaterial(w,'food',2,{type:'ground',x:p.x,z:p.z},'survival-meal');const food=w.piles.find(i=>i.item==='survival-meal')!;
 ok(w,{type:'order-job',pawnId:p.id,jobId:job.id,queue:false});
 ok(w,{type:'order-animal-378',pawnId:p.id,animalId:a.id,action:'slaughter',queue:true});
 ok(w,wrapped({type:'order-consume',pawnId:p.id,pileId:food.id,queue:false}));
 expect(p.animalHandling).toBeUndefined();expect(p.orderedQueue378?.map(c=>c.type)).toEqual(['order-animal-378','order-consume']);
 expect(validateWorld(w)).toEqual([]);const copy=deserializeWorld(serializeWorld(w));
 let sawAnimal=false,sawFood=false;
 for(let i=0;i<400&&(!a.health?.death||p.orderedQueue378||p.orders.active==='consume');i++){
  if(p.animalHandling?.forced378)sawAnimal=true;
  if(p.orders.active==='consume'){expect(sawAnimal).toBe(true);sawFood=true;}
  stepWorld(w);stepWorld(copy);
 }
 expect(sawAnimal).toBe(true);expect(sawFood).toBe(true);expect(a.health?.death).toBeDefined();
 expect(p.orderedQueue378).toBeUndefined();expect(validateWorld(w)).toEqual([]);expect(copy).toEqual(w);
});

test('Shift legacy work after forced consumption uses the general tail and preserves the ingesting owner',()=>{
 const {w,p,jobs,food}=camp(1),job=jobs[0]!;
 ok(w,{type:'order-consume',pawnId:p.id,pileId:food.id,queue:false});
 const current=structuredClone(p.need);
 ok(w,{type:'order-job',pawnId:p.id,jobId:job.id,queue:true});
 expect(p.need).toEqual(current);expect(p.orders.queue).toEqual([]);
 expect(p.orderedQueue378).toEqual([{type:'order-job',pawnId:p.id,jobId:job.id,queue:false}]);
 expect(validateWorld(w)).toEqual([]);const copy=deserializeWorld(serializeWorld(w));
 let observed=false;
 for(let i=0;i<200&&!observed;i++){
  if(p.orders.active==='consume')expect(p.jobId).toBeNull();
  stepWorld(w);stepWorld(copy);if(p.jobId===job.id)observed=true;
 }
 expect(observed).toBe(true);expect(validateWorld(w)).toEqual([]);expect(copy).toEqual(w);
});

test.each(['visitor','orbital'] as const)('%s trade queued behind ingestion walks to real contact and keeps its following equipment order until the dialog ends',channel=>{
 let w:World,pawnId:number,order:OrderedCommand378;
 if(channel==='visitor'){
  const f=visitorTradeFixture();w=f.world;pawnId=f.pawnId;order={type:'order-trade',pawnId,traderId:f.traderId};
 }else{
  const f=orbitalCamp();w=f.world;pawnId=f.negotiatorId;order={type:'order-orbital-trade',pawnId,shipId:f.shipId,consoleId:f.consoleId};
 }
 const p=w.pawns.find(p=>p.id===pawnId)!;delete p.background;delete p.traits;p.hunger=50;
 addMaterial(w,'food',1,{type:'ground',x:p.x,z:p.z},'survival-meal');const food=w.piles.find(i=>i.item==='survival-meal'&&i.owner.type==='ground'&&i.owner.x===p.x&&i.owner.z===p.z)!;
 addMaterial(w,'weapon',1,{type:'ground',x:p.x+1,z:p.z},'revolver');const gun=w.piles.find(i=>i.item==='revolver'&&i.owner.type==='ground'&&i.owner.x===p.x+1&&i.owner.z===p.z)!;
 ok(w,{type:'order-consume',pawnId,pileId:food.id,queue:false});
 const before=JSON.stringify(w);expect(orderedQueueBusy378(w,p)).toBe(true);
 ok(w,wrapped(order));expect(p.trade).toBeUndefined();expect(p.orbitalTrade).toBeUndefined();
 expect(JSON.stringify(w)).not.toBe(before);
 ok(w,{type:'order-equipment',pawnId,itemId:gun.id,action:'equip',queue:true});
 expect(validateWorld(w)).toEqual([]);const copy=deserializeWorld(serializeWorld(w));
 const ready=()=>channel==='visitor'?p.trade?.phase==='ready':p.orbitalTrade?.phase==='ready';
 for(let i=0;i<300&&!ready();i++){stepWorld(w);stepWorld(copy);}
 expect(ready()).toBe(true);expect(p.orderedQueue378?.[0]?.type).toBe('order-equipment');expect(p.equipmentTask).toBeUndefined();
 expect(copy).toEqual(w);expect(validateWorld(w)).toEqual([]);
 ok(w,channel==='visitor'?{type:'cancel-trade',pawnId}:{type:'cancel-orbital-trade',pawnId});
 for(let i=0;i<20&&!p.equipmentTask;i++)stepWorld(w);
 expect(p.equipmentTask?.itemId).toBe(gun.id);expect(p.orderedQueue378).toBeUndefined();
});
