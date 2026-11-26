import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder} from '../src/bridge/snapshots.ts';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {billWanted,countedProducts,newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {queryCookingBillStatus} from '../src/sim/cooking-diagnostics.ts';
import {validBiofuelProductionTransport} from '../src/sim/cooking-save.ts';
import {processCooking} from '../src/sim/cooking.ts';
import {groundCapacity,groundPile,nearbyGround} from '../src/sim/ground-placement.ts';
import {pawnBody} from '../src/sim/health-rules.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {biofuelProductionSpeed,productionResearchUnlocked,productionWorkerQualified} from '../src/sim/machining.ts';
import {addGroundMaterial,addMaterial,refreshStock,reservedSource} from '../src/sim/materials.ts';
import {planCookingOrder} from '../src/sim/player-cooking.ts';
import {validCookingOrder} from '../src/sim/player-cooking-save.ts';
import {BIOFUEL_INITIAL_ORGANICS,BIOFUEL_ORGANIC_INPUTS,BIOFUEL_ORGANIC_NUTRITION,biofuelNutrition,isBiofuelRecipe,isRecipeProduct,PRODUCTION_RECIPES,PRODUCTION_WORK_SCALE,productionStationUsable,recipeProduct,stationAccepts,stationRecipes,validBiofuelIngredients,type BiofuelRecipe} from '../src/sim/production-recipes.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import type {CookingOrder} from '../src/sim/order-types.ts';
import type {World} from '../src/sim/types.ts';
import {biofuelCamp} from './helpers/biofuel-v283.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {validateCampaignSchema378} from '../src/sim/serialization.ts';
import {controlledInjury} from './scenarios/health.ts';

const count=(w:World,item:string)=>w.piles.reduce((sum,p)=>sum+(p.item===item?p.quantity:0),0);
function camp(recipe:BiofuelRecipe='chemfuel-from-wood',inputs=true){
  const scene=biofuelCamp(),w=scene.world,p=w.pawns[0]!;
  for(const pawn of w.pawns)pawn.priorities.haul=0;
  p.priorities.craft=1;p.skills.crafting={level:0,xp:0,dailyXp:0,passion:0};
  if(inputs){
    if(recipe==='chemfuel-from-wood')addGroundMaterial(w,'wood',70,{x:8,z:11},'wood');
    else {addGroundMaterial(w,'food',35,{x:8,z:11},'rice');addGroundMaterial(w,'food',35,{x:9,z:11},'berries');}
  }
  expect(applyCommand(w,{type:'bill-add',structureId:scene.refineryId,recipe}).ok).toBe(true);
  const refinery=w.structures.find(s=>s.id===scene.refineryId)!;refinery.bills![0]!.destination='drop';
  return {...scene,refinery};
}
function until(w:World,done:()=>boolean,max=2400):void {
  for(let i=0;i<max&&!done();i++)stepWorld(w);
  expect(done(),`Refining transition at ${w.tick}`).toBe(true);expect(validateWorld(w)).toEqual([]);
}
function suspend(w:World,stationId:number,value:boolean){
  const b=w.structures.find(s=>s.id===stationId)!.bills![0]!;
  return applyCommand(w,{type:'bill-update',structureId:stationId,billId:b.id,settings:{mode:b.mode,target:b.target,suspended:value,filters:{...b.filters},radius:b.radius,destination:b.destination}});
}

test('two electric refinery bills convert exact raw quotas to the same physical material',()=>{
  expect(PRODUCTION_RECIPES['chemfuel-from-wood']).toMatchObject({station:'biofuel-refinery',work:'craft',units:70,workTicks:200,outputUnits:35});
  expect(PRODUCTION_RECIPES['chemfuel-from-organics']).toMatchObject({station:'biofuel-refinery',work:'craft',units:70,workTicks:250,outputUnits:35});
  expect(stationRecipes({kind:'biofuel-refinery'})).toEqual(['chemfuel-from-wood','chemfuel-from-organics']);
  expect(stationAccepts({kind:'stonecutter'},'chemfuel-from-wood')).toBe(false);
  expect(stationAccepts({kind:'electric-stove'},'chemfuel-from-organics')).toBe(false);
  const {refinery}=camp();expect(productionStationUsable(refinery)).toBe(true);
  refinery.power!.on=false;expect(productionStationUsable(refinery)).toBe(false);
  for(const recipe of ['chemfuel-from-wood','chemfuel-from-organics'] as const){
    expect(isBiofuelRecipe(recipe)).toBe(true);expect(recipeProduct(recipe,[])).toBe('chemfuel');
    expect(isRecipeProduct(recipe,'chemfuel')).toBe(true);expect(isRecipeProduct(recipe,'rice')).toBe(false);
  }
});

test('organic nutrition reads all thirteen item definitions and defaults to the five plants',()=>{
  expect(BIOFUEL_ORGANIC_INPUTS).toHaveLength(13);expect(BIOFUEL_ORGANIC_NUTRITION).toBe(350);
  const b=newCookingBill(1,'chemfuel-from-organics');
  for(const item of BIOFUEL_ORGANIC_INPUTS){
    expect(ITEM_DEFINITIONS[item].nutrition).toBe(5);
    expect(b.filters[item]).toBe((BIOFUEL_INITIAL_ORGANICS as readonly string[]).includes(item));
    expect(validBiofuelIngredients(b.recipe,[{item,quantity:70}])).toBe(true);
  }
  expect(biofuelNutrition([{item:'rice',quantity:40},{item:'milk',quantity:30}])).toBe(350);
  expect(validBillSettings(b,b.recipe,218)).toBe(true);expect(validBillSettings(b,b.recipe,217)).toBe(false);
  for(const item of ['hay','simple-meal','nutrient-paste-meal','survival-meal','legacy-portion','herbal-medicine','wood']){
    expect(validBiofuelIngredients(b.recipe,[{item,quantity:70}])).toBe(false);
    expect(validBillSettings({...b,filters:{...b.filters,[item]:true}},b.recipe,218)).toBe(false);
  }
  for(const parts of [[{item:'rice',quantity:69}],[{item:'rice',quantity:71}],[{item:'rice',quantity:69.5},{item:'milk',quantity:.5}],[{item:'rice',quantity:70},{item:'milk',quantity:0}]])expect(validBiofuelIngredients(b.recipe,parts)).toBe(false);
  expect(validBiofuelIngredients('chemfuel-from-wood',[{item:'wood',quantity:70}])).toBe(true);
  expect(validBiofuelIngredients('chemfuel-from-wood',[{item:'rice',quantity:70}])).toBe(false);
});

test('research and schema gate creation atomically without a crafting skill requirement',()=>{
  const {world:w,refineryId}=biofuelCamp();w.pawns[0]!.priorities.craft=1;
  expect(productionResearchUnlocked(w,'chemfuel-from-wood')).toBe(true);
  expect(productionWorkerQualified(w.pawns[0]!,'chemfuel-from-wood')).toBe(true);
  expect(productionResearchUnlocked({...w,schemaVersion:217 as World['schemaVersion']},'chemfuel-from-organics')).toBe(false);
  delete w.research!.biofuelRefining;const before=JSON.stringify(w);
  expect(applyCommand(w,{type:'bill-add',structureId:refineryId,recipe:'chemfuel-from-wood'}).ok).toBe(false);
  expect(JSON.stringify(w)).toBe(before);
  const station=w.structures.find(s=>s.id===refineryId)!;
  expect(queryCookingBillStatus(w,station,newCookingBill(1,'chemfuel-from-wood')).code).toBe('research-required');
});

test.each([[378,7,10],[379,1,70]])('schema %i proposal reserves %i physical trips of %i units without mutation or shared stock credit',(version,trips,units)=>{
  const scene=camp(),w=version===378?JSON.parse(asOldSchema(serializeWorld(scene.world),version)) as World:scene.world,{refineryId}=scene,p=w.pawns[0]!,before=JSON.stringify(w);
  const proposal=planCookingOrder(w,p,refineryId),order=proposal.order as CookingOrder;
  expect(proposal.label).toBe('Raffiner du biocarburant');expect(order.cooking.ingredients).toHaveLength(trips);
  expect(new Set(order.cooking.ingredients.map(i=>i.pileId)).size).toBe(1);
  expect(order.cooking.ingredients.every(i=>i.stage==='source'&&i.quantity===units)).toBe(true);
  expect(validCookingOrder(order,w)).toBe(true);expect(JSON.stringify(w)).toBe(before);
  p.orders.queue.push(order);expect(reservedSource(w,order.cooking.ingredients[0]!.pileId)).toBe(70);
  w.pawns[1]!.priorities.craft=1;expect(planCookingOrder(w,w.pawns[1]!,refineryId).order).toBeUndefined();
  expect(validBiofuelProductionTransport(w,version)).toBe(true);expect(version===378?validateCampaignSchema378(w):validateWorld(w)).toEqual([]);
});

test('foreign ownership is not a refinery source and animal products require explicit filters',()=>{
  const a=camp('chemfuel-from-wood'),p=a.world.pawns[0]!;
  a.world.piles.find(q=>q.item==='wood')!.owner={type:'inventory',pawnId:p.id};
  expect(planCookingOrder(a.world,p,a.refineryId).order).toBeUndefined();expect(count(a.world,'wood')).toBe(70);
  const b=camp('chemfuel-from-organics',false),w=b.world;
  addGroundMaterial(w,'food',35,{x:8,z:11},'rice');addGroundMaterial(w,'food',35,{x:9,z:11},'milk');
  expect(planCookingOrder(w,w.pawns[0]!,b.refineryId).order).toBeUndefined();
  b.refinery.bills![0]!.filters.milk=true;
  const order=planCookingOrder(w,w.pawns[0]!,b.refineryId).order as CookingOrder;
  expect(biofuelNutrition(order.cooking.ingredients)).toBe(350);expect(order.cooking.ingredients.some(i=>i.item==='milk')).toBe(true);
});

test('general labor depends on capacities and leaves every skill and RNG untouched',()=>{
  const {world:w}=camp(),p=w.pawns[0]!;
  expect(biofuelProductionSpeed(p)).toBe(1);p.skills.crafting!.level=20;expect(biofuelProductionSpeed(p)).toBe(1);
  controlledInjury(w,p,'left-arm',2000);
  const c=pawnBody(p).capacities;
  expect(biofuelProductionSpeed(p)).toBeCloseTo(Math.max(.1,c.manipulation*(.5+.5*Math.min(1,c.sight))));
  expect(biofuelProductionSpeed(p)).toBeLessThan(1);
});

for(const recipe of ['chemfuel-from-wood','chemfuel-from-organics'] as const)test(`${recipe} consumes once after its exact neutral work and produces no skill or food metadata`,()=>{
  const {world:w,refinery}=camp(recipe),p=w.pawns[0]!;
  until(w,()=>p.cooking?.phase==='gather'&&p.cooking.ingredients.every(i=>i.stage==='placed')&&p.x===p.cooking.spot.x&&p.z===p.cooking.spot.z);
  const context={search:()=>null,move:()=>{throw Error('Ingredients already delivered');},release:()=>releaseWork(w,p),event:()=>{},workRate:()=>1};
  const ticks=PRODUCTION_RECIPES[recipe].workTicks,skills=structuredClone(p.skills),rng=w.rng;
  for(let i=0;i<ticks-1;i++)processCooking(w,p,context);
  expect(p.cooking!.progress).toBe((ticks-1)*PRODUCTION_WORK_SCALE);expect(p.cooking!.workTicks).toBeUndefined();
  expect(count(w,'chemfuel')).toBe(0);expect(count(w,'wood')+count(w,'rice')+count(w,'berries')).toBe(70);
  processCooking(w,p,context);refreshStock(w);
  expect(count(w,'chemfuel')).toBe(35);expect(count(w,'wood')+count(w,'rice')+count(w,'berries')).toBe(0);
  const product=w.piles.find(q=>q.item==='chemfuel')!;
  expect(product).toMatchObject({kind:'chemfuel',quantity:35,owner:{type:'pawn',pawnId:p.id}});
  for(const key of ['rot','foodPoison','apparel','weapon','unfinished'])expect(Object.hasOwn(product,key)).toBe(false);
  expect(p.skills).toEqual(skills);expect(w.rng).toBe(rng);expect(refinery.bills![0]!.target).toBe(0);expect(validateWorld(w)).toEqual([]);
});

test.each([[378,7],[379,1]])('schema %i real collection and drop loop conserves unrelated food and counts %i trips',(version,trips)=>{
  const scene=camp(),w=version===378?JSON.parse(asOldSchema(serializeWorld(scene.world),version)) as World:scene.world,p=w.pawns[0]!,carried=new Set<number>();
  addGroundMaterial(w,'food',10,{x:9,z:11},'rice');const skills=structuredClone(p.skills);
  for(let i=0;i<2400&&!(count(w,'chemfuel')===35&&p.cooking===null);i++){
    stepWorld(w);for(const entry of p.cooking?.ingredients??[])if(entry.stage==='held')carried.add(entry.pileId);
  }
  expect(carried.size).toBe(trips);expect(count(w,'wood')).toBe(0);expect(count(w,'chemfuel')).toBe(35);
  expect(count(w,'rice')).toBe(10);expect(p.cooking).toBeNull();expect(p.skills).toEqual(skills);expect(version===378?validateCampaignSchema378(w):validateWorld(w)).toEqual([]);
});

test('held, working and output recipes resume with identical physical continuation',()=>{
  const {world:w}=camp('chemfuel-from-organics'),p=w.pawns[0]!;
  for(const reached of [()=>p.cooking?.ingredients.some(i=>i.stage==='held')===true,()=>p.cooking?.phase==='work',()=>p.cooking?.phase==='output']){
    until(w,reached);const restored=deserializeWorld(serializeWorld(w));
    stepWorld(w,3);stepWorld(restored,3);expect(restored).toEqual(w);
  }
  until(w,()=>p.cooking===null);expect(count(w,'chemfuel')).toBe(35);expect(count(w,'rice')+count(w,'berries')).toBe(0);
});

test('cancelling work preserves feedstock and restarts work without an unfinished item',()=>{
  const {world:w,refineryId}=camp(),p=w.pawns[0]!;
  until(w,()=>p.cooking?.phase==='work'&&p.cooking.progress>PRODUCTION_WORK_SCALE);
  const oldProgress=p.cooking!.progress;expect(suspend(w,refineryId,true).ok).toBe(true);
  expect(p.cooking).toBeNull();expect(count(w,'wood')).toBe(70);expect(count(w,'chemfuel')).toBe(0);
  expect(w.piles.some(q=>q.unfinished||q.componentWork)).toBe(false);
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  expect(suspend(w,refineryId,false).ok).toBe(true);until(w,()=>p.cooking?.phase==='work');
  expect(p.cooking!.progress).toBeLessThan(oldProgress);until(w,()=>p.cooking===null&&count(w,'chemfuel')===35);
});

test('power loss during carried feedstock returns its real cargo before new work',()=>{
  const {world:w,refinery}=camp(),p=w.pawns[0]!;
  until(w,()=>p.cooking?.ingredients.some(i=>i.stage==='held')===true);
  const skills=structuredClone(p.skills);refinery.power!.on=false;
  processCooking(w,p,{search:()=>null,move:()=>{},release:()=>releaseWork(w,p),event:()=>{},workRate:()=>1});
  expect(p.cooking).toBeNull();expect(count(w,'wood')).toBe(70);expect(count(w,'chemfuel')).toBe(0);
  expect(w.piles.some(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id)).toBe(false);expect(p.skills).toEqual(skills);
  refinery.power!.on=true;until(w,()=>p.cooking===null&&count(w,'chemfuel')===35);
});

test('partial stock delivery keeps the remainder owned and resumes exactly',()=>{
  const {world:w,refinery}=camp(),p=w.pawns[0]!;
  refinery.bills![0]!.destination='stockpile';
  for(const [x,priority] of [[16,3],[18,2]] as const)w.stockpiles.push({id:w.nextId++,x,z:10,priority,capacity:150,filters:{wood:false,food:false,chemfuel:true}});
  addMaterial(w,'chemfuel',140,{type:'ground',x:16,z:10},'chemfuel');
  until(w,()=>p.cooking?.phase==='output'&&p.cooking.storageQuantity===10);
  const restored=deserializeWorld(serializeWorld(w));stepWorld(w,3);stepWorld(restored,3);expect(restored).toEqual(w);
  until(w,()=>p.cooking===null);expect(groundPile(w,{x:16,z:10})!.quantity).toBe(150);expect(groundPile(w,{x:18,z:10})!.quantity).toBe(25);
  expect(count(w,'chemfuel')).toBe(175);expect(count(w,'wood')).toBe(0);
});

test('a full drop floor preserves completed fuel once, then completes without new work',()=>{
  const {world:w}=camp(),p=w.pawns[0]!;until(w,()=>p.cooking?.phase==='output');
  const id=p.cooking!.productId,fillers=new Set<number>();
  for(const cell of nearbyGround(w,p))if(!groundPile(w,cell)){
    const quantity=groundCapacity(w,cell,'steel');
    if(quantity>0){addGroundMaterial(w,'steel',quantity,cell,'steel');fillers.add(groundPile(w,cell)!.id);}
  }
  stepWorld(w,25);expect(p.cooking?.phase).toBe('output');expect(p.cooking!.productId).toBe(id);expect(count(w,'chemfuel')).toBe(35);
  const restored=deserializeWorld(serializeWorld(w));stepWorld(w,3);stepWorld(restored,3);expect(restored).toEqual(w);
  w.piles=w.piles.filter(q=>!fillers.has(q.id));refreshStock(w);until(w,()=>p.cooking===null);expect(count(w,'chemfuel')).toBe(35);
});

test('both bills share an until count from physical stored or held fuel',()=>{
  const {world:w,refinery}=camp(),bill=refinery.bills![0]!;bill.mode='until';bill.target=35;
  addMaterial(w,'chemfuel',35,{type:'ground',x:16,z:10},'chemfuel');expect(countedProducts(w,bill)).toBe(0);
  w.stockpiles.push({id:w.nextId++,x:16,z:10,priority:2,capacity:150,filters:{wood:false,food:false,chemfuel:true}});
  expect(countedProducts(w,bill)).toBe(35);expect(billWanted(w,bill)).toBe(false);
  const other=newCookingBill(w.nextId++,'chemfuel-from-organics');other.mode='until';other.target=35;
  expect(countedProducts(w,other)).toBe(35);expect(billWanted(w,other)).toBe(false);
});

test('queue and active guards reject counterfeit quotas, oversized cargo and future work history',()=>{
  const {world:w,refineryId}=camp(),p=w.pawns[0]!,order=planCookingOrder(w,p,refineryId).order as CookingOrder;
  for(const corrupt of [
    (o:CookingOrder)=>{o.cooking.ingredients[0]!.quantity=11;},
    (o:CookingOrder)=>{o.cooking.ingredients[0]!.item='rice';},
    (o:CookingOrder)=>{o.cooking.workTicks=1;},
    (o:CookingOrder)=>{o.cooking.progress=1;},
  ]){const bad=structuredClone(order);corrupt(bad);expect(validCookingOrder(bad,w)).toBe(false);}
  expect(validCookingOrder(order,{...w,schemaVersion:217 as World['schemaVersion']})).toBe(false);
  until(w,()=>p.cooking?.phase==='work');
  for(const corrupt of [
    (v:World)=>{v.pawns[0]!.cooking!.ingredients[0]!.quantity++;},
    (v:World)=>{v.pawns[0]!.cooking!.workTicks=1;},
    (v:World)=>{v.pawns[0]!.cooking!.ingredients[0]!.item='rice';},
    (v:World)=>{v.schemaVersion=217 as World['schemaVersion'];},
  ]){const bad=structuredClone(w);corrupt(bad);expect(validBiofuelProductionTransport(bad,bad.schemaVersion)).toBe(false);expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow();}
});

test('Decoder refusal preserves its adopted state and a valid refining checkpoint resyncs',()=>{
  const {world:w}=camp('chemfuel-from-organics'),p=w.pawns[0]!;until(w,()=>p.cooking?.phase==='work');
  const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  const first=decoder.adopt(structuredClone(encoder.encode(w,0,6)));expect(first.status).toBe('applied');
  if(first.status!=='applied')throw Error('Initial refining checkpoint');const before=structuredClone(first.world);
  p.cooking!.ingredients[0]!.quantity++;expect(decoder.adopt(structuredClone(encoder.encode(w,0,6))).status).toBe('resync');expect(first.world).toEqual(before);
  p.cooking!.ingredients[0]!.quantity--;expect(decoder.adopt(structuredClone(encoder.encode(w,0,6,true))).status).toBe('applied');expect(first.world).toEqual(before);
});
