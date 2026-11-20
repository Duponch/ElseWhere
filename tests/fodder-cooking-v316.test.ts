import {expect,test} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {ANIMAL_MEAT_ITEMS} from '../src/sim/biome-items.ts';
import {KIBBLE_INPUTS,KIBBLE_GROUP_UNITS,kibbleIngredientGroup,kibbleOutputUnits,validKibbleIngredients} from '../src/sim/fodder-recipes.ts';
import {cookingDefaultAllowed353} from '../src/sim/cooking-ingredients-353.ts';
import {PRODUCTION_RECIPES,PRODUCTION_WORK_SCALE,fineMealIngredientGroup,isRecipeProduct,recipeProduct,stationAccepts} from '../src/sim/production-recipes.ts';
import {billWanted,countedProducts,newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {queryCookingBillStatus} from '../src/sim/cooking-diagnostics.ts';
import {validCookingOrder} from '../src/sim/player-cooking-save.ts';
import {planCookingOrder,queuedCookingReason} from '../src/sim/player-cooking.ts';
import {validKibbleProductionTransport} from '../src/sim/cooking-save.ts';
import {processCooking} from '../src/sim/cooking.ts';
import {cookingSpeed} from '../src/sim/cooking-statistics.ts';
import {productionResearchUnlocked,productionWorkerQualified} from '../src/sim/machining.ts';
import {addGroundMaterial,refreshStock,reservedSource} from '../src/sim/materials.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {ticksUntilRot} from '../src/sim/food-preservation.ts';
import {foodCanCarryPoison} from '../src/sim/food-poisoning.ts';
import type {CookingOrder} from '../src/sim/order-types.ts';
import type {ProductionIngredient} from '../src/sim/production-recipes.ts';
import type {Structure,World} from '../src/sim/types.ts';
import {foodWorkstationCamp,fixtureFoodStation} from './scenarios/food-workstations.ts';

const RECIPE='make-kibble' as const;
const count=(w:World,item:string)=>w.piles.reduce((n,p)=>n+(p.item===item?p.quantity:0),0);
function scene(kind:'butcher-table'|'butcher-spot'='butcher-table'):{w:World;s:Structure}{
  const w=foodWorkstationCamp(),p=w.pawns[0]!;
  p.priorities.cook=1;delete p.background;delete p.traits;
  const s=kind==='butcher-table'?fixtureFoodStation(w,kind):{id:w.nextId++,kind,x:10,z:10,orientation:0 as const,footprint:'standard' as const,bills:[]};
  if(kind==='butcher-spot')w.structures.push(s);
  expect(applyCommand(w,{type:'bill-add',structureId:s.id,recipe:RECIPE})).toMatchObject({ok:true});
  s.bills![0]!.destination='drop';return {w,s};
}
function inputs(w:World,protein:ProductionIngredient='milk',vegetable:ProductionIngredient='hay',proteinUnits=20,vegetableUnits=20):void {
  addGroundMaterial(w,'food',proteinUnits,{x:6,z:6},protein);
  addGroundMaterial(w,'food',vegetableUnits,{x:7,z:6},vegetable);refreshStock(w);
}
function until(w:World,done:()=>boolean,max=2500):void {
  for(let i=0;i<max&&!done();i++)stepWorld(w);
  expect(done(),`Expected kibble transition by tick ${w.tick}`).toBe(true);
  expect(validateWorld(w)).toEqual([]);
}
function staged(w:World):void {
  const p=w.pawns[0]!;
  until(w,()=>p.cooking?.phase==='gather'&&p.cooking.ingredients.every(i=>i.stage==='placed')&&p.x===p.cooking.spot.x&&p.z===p.cooking.spot.z);
}
function context(w:World){
  const p=w.pawns[0]!;
  return {search:()=>null,move:()=>{throw Error('Neutral work must remain at the reached workstation');},release:()=>releaseWork(w,p),event:()=>{},workRate:()=>1};
}

test('the prospective kibble guard preserves historical worlds without packed items or pawn orders',()=>{
  const old=structuredClone(foodWorkstationCamp()) as unknown as Record<string,unknown>;old.schemaVersion=12;delete old.packed;
  for(const pawn of old.pawns as Record<string,unknown>[])delete pawn.orders;
  expect(validKibbleProductionTransport(old as unknown as World,12)).toBe(true);
  old.packed=[];expect(validKibbleProductionTransport(old as unknown as World,12)).toBe(true);
  const futureBill=structuredClone(old);futureBill.structures=[{bills:[{recipe:RECIPE}]}];
  expect(validKibbleProductionTransport(futureBill as unknown as World,12)).toBe(false);
  const futurePack=structuredClone(old);futurePack.packed=[{building:{bills:[{recipe:RECIPE}]}}];
  expect(validKibbleProductionTransport(futurePack as unknown as World,12)).toBe(false);
  const futureTask=structuredClone(old);(futureTask.pawns as Record<string,unknown>[])[0]!.cooking={recipe:RECIPE};
  expect(validKibbleProductionTransport(futureTask as unknown as World,12)).toBe(false);
});

test('kibble is a prospective cook recipe on both butcher stations with two exact quotas and no human-meal widening',()=>{
  expect(PRODUCTION_RECIPES[RECIPE]).toMatchObject({units:40,workTicks:45,outputUnits:50,work:'cook'});
  expect(KIBBLE_GROUP_UNITS).toBe(20);expect(new Set(KIBBLE_INPUTS).size).toBe(KIBBLE_INPUTS.length);
  expect(stationAccepts({kind:'butcher-table'},RECIPE)).toBe(true);expect(stationAccepts({kind:'butcher-spot'},RECIPE)).toBe(true);
  for(const kind of ['campfire','fueled-stove','electric-stove','crafting-spot','biofuel-refinery'] as const)expect(stationAccepts({kind},RECIPE)).toBe(false);
  expect(recipeProduct(RECIPE,[])).toBe('kibble');expect(isRecipeProduct(RECIPE,'kibble')).toBe(true);expect(isRecipeProduct(RECIPE,'hay')).toBe(false);
  expect(fineMealIngredientGroup('hay')).toBeNull();expect(PRODUCTION_RECIPES['fine-meal'].inputs).not.toContain('hay');
  expect(PRODUCTION_RECIPES['simple-meal'].inputs).not.toContain('hay');expect(PRODUCTION_RECIPES['chemfuel-from-organics'].inputs).not.toContain('hay');
  expect(kibbleOutputUnits({kind:'butcher-table'})).toBe(50);expect(kibbleOutputUnits({kind:'butcher-spot'})).toBe(35);
});

test.each(['milk',...ANIMAL_MEAT_ITEMS] as const)('real protein %s satisfies its own quota with hay and raw vegetables',protein=>{
  expect(kibbleIngredientGroup(protein)).toBe('protein');
  for(const vegetable of ['rice','berries','potato','corn','agave-fruit','hay']){
    expect(kibbleIngredientGroup(vegetable)).toBe('vegetable');
    expect(validKibbleIngredients([{item:protein,quantity:20},{item:vegetable,quantity:20}])).toBe(true);
  }
});

test('same-category substitutions, over/under quotas, invalid units and prepared or non-food items fail',()=>{
  for(const parts of [[],[{item:'rice',quantity:40}],[{item:'milk',quantity:40}],[{item:'milk',quantity:19},{item:'hay',quantity:21}],
    [{item:'milk',quantity:21},{item:'hay',quantity:19}],[{item:'milk',quantity:20},{item:'hay',quantity:19}],
    [{item:'milk',quantity:20},{item:'hay',quantity:21}],[{item:'milk',quantity:19.5},{item:'hay',quantity:20.5}],
    [{item:'milk',quantity:20},{item:'hay',quantity:20},{item:'rice',quantity:0}]])expect(validKibbleIngredients(parts)).toBe(false);
  for(const item of ['simple-meal','fine-meal','survival-meal','nutrient-paste-meal','kibble','wood','cloth','human-corpse','hare-corpse','human-meat']){
    expect(kibbleIngredientGroup(item)).toBeNull();expect(validKibbleIngredients([{item:'milk',quantity:20},{item,quantity:20}])).toBe(false);
  }
  expect(validKibbleIngredients([{item:'milk',quantity:10},{item:'hare-meat',quantity:10},{item:'hay',quantity:12},{item:'rice',quantity:8}])).toBe(true);
});

test('creation has schema227 and no research, power, or skill prerequisite; all new inputs are explicit bill filters',()=>{
  const {w,s}=scene(),p=w.pawns[0]!,bill=s.bills![0]!;p.skills.cooking!.level=0;
  expect(productionResearchUnlocked(w,RECIPE)).toBe(true);expect(productionWorkerQualified(p,RECIPE)).toBe(true);
  // Schema 353 adds eggs and insect jelly: the historical checks use a 352 bill's filters.
  const historical={...bill,filters:newCookingBill(bill.id,RECIPE,352).filters};
  expect(validBillSettings(historical,RECIPE,227)).toBe(true);expect(validBillSettings(historical,RECIPE,226)).toBe(false);
  // Core defaultIngredientFilter: fertilized eggs and insect jelly start refused.
  expect(KIBBLE_INPUTS.every(i=>bill.filters[i]===cookingDefaultAllowed353(i))).toBe(true);
  const old={...w,schemaVersion:226 as World['schemaVersion']},before=JSON.stringify(old);
  expect(productionResearchUnlocked(old,RECIPE)).toBe(false);
  expect(applyCommand(old,{type:'bill-add',structureId:s.id,recipe:RECIPE}).ok).toBe(false);expect(JSON.stringify(old)).toBe(before);
  expect(validKibbleProductionTransport(old,226)).toBe(false);
});

test('proposal leaves stock unchanged, reserves four physical ten-unit trips, and rejects competing source claims',()=>{
  const {w,s}=scene(),p=w.pawns[0]!;inputs(w);const before=serializeWorld(w),proposal=planCookingOrder(w,p,s.id),order=proposal.order as CookingOrder;
  expect(proposal.label).toBe('Fabriquer des croquettes');expect(order.cooking.ingredients).toHaveLength(4);
  expect(order.cooking.ingredients.every(i=>i.quantity===10&&i.stage==='source')).toBe(true);
  expect(validKibbleIngredients(order.cooking.ingredients)).toBe(true);expect(validCookingOrder(order,w)).toBe(true);
  expect(serializeWorld(w)).toBe(before);p.orders.queue.push(order);
  expect(reservedSource(w,order.cooking.ingredients[0]!.pileId)).toBe(20);expect(validKibbleProductionTransport(w,227)).toBe(true);
  expect(queuedCookingReason(w,order,p)).toBeUndefined();expect(planCookingOrder(w,p,s.id).order).toBeUndefined();
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

test('availability explains the two categories and respects filters even when forty wrong units exist',()=>{
  const {w,s}=scene(),p=w.pawns[0]!,bill=s.bills![0]!;
  addGroundMaterial(w,'food',40,{x:6,z:6},'rice');refreshStock(w);
  expect(queryCookingBillStatus(w,s,bill)).toMatchObject({code:'missing-ingredients'});expect(planCookingOrder(w,p,s.id).order).toBeUndefined();
  addGroundMaterial(w,'food',20,{x:7,z:6},'milk');refreshStock(w);bill.filters.milk=false;
  expect(planCookingOrder(w,p,s.id).order).toBeUndefined();bill.filters.milk=true;
  expect(planCookingOrder(w,p,s.id).order).toBeDefined();
});

test.each(['butcher-table','butcher-spot'] as const)('%s consumes two placed quotas once after 45 CookSpeed ticks, with no poison draw or butchery yield factor',kind=>{
  const {w,s}=scene(kind),p=w.pawns[0]!;inputs(w);staged(w);
  expect(cookingSpeed(p)).toBe(1);const rng=w.rng,xp=p.skills.cooking!.xp,ctx=context(w);
  for(let i=0;i<44;i++)processCooking(w,p,ctx);
  expect(p.cooking!.progress).toBe(44*PRODUCTION_WORK_SCALE);expect(count(w,'kibble')).toBe(0);expect(count(w,'milk')+count(w,'hay')).toBe(40);
  processCooking(w,p,ctx);refreshStock(w);
  expect(p.cooking!.phase).toBe('output');expect(count(w,'kibble')).toBe(kind==='butcher-table'?50:35);
  expect(count(w,'milk')+count(w,'hay')).toBe(0);expect(s.bills![0]!.target).toBe(0);expect(w.rng).toBe(rng);expect(p.skills.cooking!.xp).toBeGreaterThan(xp);
  const product=w.piles.find(i=>i.item==='kibble')!;
  expect(product.owner).toEqual({type:'pawn',pawnId:p.id});expect(product.foodPoison).toBeUndefined();expect(product.rot).toBeUndefined();
  expect(ticksUntilRot(product,w.tick)).toBe(Infinity);expect(foodCanCarryPoison('kibble')).toBe(false);
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

test('partial storage delivery preserves held product ID, counts actual cargo, and reloads each remaining fraction',()=>{
  const {w,s}=scene(),p=w.pawns[0]!,bill=s.bills![0]!;inputs(w);bill.destination='stockpile';
  for(const [x,capacity] of [[14,10],[15,15],[16,25]])w.stockpiles.push({id:w.nextId++,x:x!,z:10,filters:{wood:false,food:true},items:{kibble:true},priority:2,capacity:capacity!});
  until(w,()=>p.cooking?.phase==='output');const productId=p.cooking!.productId;bill.mode='until';bill.target=50;
  expect(countedProducts(w,bill)).toBe(50);expect(billWanted(w,bill)).toBe(false);
  let reloads=0;const quantities=new Set<number>();
  for(let i=0;i<2500&&p.cooking;i++){
    stepWorld(w);
    if(p.cooking?.storageQuantity!==undefined&&!quantities.has(w.piles.find(i=>i.id===productId)!.quantity)){
      quantities.add(w.piles.find(i=>i.id===productId)!.quantity);
      const data=serializeWorld(w);expect(serializeWorld(deserializeWorld(data))).toBe(data);reloads++;
    }
    if(p.cooking)expect(p.cooking.productId).toBe(productId);
  }
  expect(p.cooking).toBeNull();expect(reloads).toBeGreaterThanOrEqual(2);expect(count(w,'kibble')).toBe(50);expect(countedProducts(w,bill)).toBe(50);
  expect(w.piles.filter(i=>i.item==='kibble').every(i=>i.owner.type==='ground')).toBe(true);expect(validateWorld(w)).toEqual([]);
});

test('held ingredients reload without duplication, and changing a filter conserves the carried item on cancellation',()=>{
  const {w,s}=scene();inputs(w);until(w,()=>w.pawns[0]!.cooking?.ingredients.some(i=>i.stage==='held')===true);
  const p=w.pawns[0]!,held=p.cooking!.ingredients.find(i=>i.stage==='held')!;
  const data=serializeWorld(w);expect(serializeWorld(deserializeWorld(data))).toBe(data);
  s.bills![0]!.filters[held.item]=false;processCooking(w,p,{...context(w),move:()=>{}});refreshStock(w);
  expect(p.cooking).toBeNull();expect(count(w,'milk')+count(w,'hay')).toBe(40);expect(count(w,'kibble')).toBe(0);
});

test('runtime rejects forged same-category quotas before consuming or advancing work',()=>{
  const {w}=scene();inputs(w);staged(w);const p=w.pawns[0]!,t=p.cooking!;
  for(const i of t.ingredients)if(i.item==='milk')i.item='hay';
  const before=count(w,'milk')+count(w,'hay'),rng=w.rng;processCooking(w,p,{...context(w),move:()=>{}});
  expect(p.cooking).toBeNull();expect(count(w,'milk')+count(w,'hay')).toBe(before);expect(count(w,'kibble')).toBe(0);expect(w.rng).toBe(rng);
});

test('queued/save transport rejects wrong quotas, source radius, stale ingredients, oversized trips and wrong station',()=>{
  const {w,s}=scene(),p=w.pawns[0]!;inputs(w);const order=planCookingOrder(w,p,s.id).order as CookingOrder;p.orders.queue.push(order);
  expect(validKibbleProductionTransport(w,227)).toBe(true);
  const changed=structuredClone(w),bad=changed.pawns[0]!.orders.queue[0] as CookingOrder;bad.cooking.ingredients[0]!.quantity=9;
  expect(validCookingOrder(bad,changed)).toBe(false);expect(validKibbleProductionTransport(changed,227)).toBe(false);
  const radius=structuredClone(w);radius.structures[0]!.bills![0]!.radius=1;expect(validKibbleProductionTransport(radius,227)).toBe(false);
  const stale=structuredClone(w),milk=stale.piles.find(i=>i.item==='milk')!;milk.rot={progress:14*6000,atTick:stale.tick};expect(validKibbleProductionTransport(stale,227)).toBe(false);
  const oversize=structuredClone(w),big=oversize.pawns[0]!.orders.queue[0] as CookingOrder;
  big.cooking.ingredients[0]!.quantity=20;big.cooking.ingredients.splice(1,1);expect(validCookingOrder(big,oversize)).toBe(false);
  const station=structuredClone(w);station.structures[0]!.kind='campfire';expect(validKibbleProductionTransport(station,227)).toBe(false);
});

test('queued freshness is rechecked at acceptance, so an expired pile releases the proposal without making croquettes',()=>{
  const {w,s}=scene(),p=w.pawns[0]!;inputs(w);const order=planCookingOrder(w,p,s.id).order as CookingOrder;p.orders.queue.push(order);
  const milk=w.piles.find(i=>i.item==='milk')!;milk.rot={progress:14*6000,atTick:w.tick};
  expect(queuedCookingReason(w,order,p)).toContain('périmé');expect(count(w,'kibble')).toBe(0);
});
