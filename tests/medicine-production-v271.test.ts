import {expect,test} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {processCooking} from '../src/sim/cooking.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {completedMedicineSkill,medicineProductionSpeed,productionResearchUnlocked,productionWorkerQualified} from '../src/sim/machining.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {planCookingOrder,queuedCookingReason} from '../src/sim/player-cooking.ts';
import {validCookingOrder} from '../src/sim/player-cooking-save.ts';
import {MEDICINE_REQUIREMENTS,PRODUCTION_RECIPES,PRODUCTION_WORK_SCALE,productionStationUsable,stationAccepts,stationRecipes,validMedicineIngredients} from '../src/sim/production-recipes.ts';
import {DRUG_PRODUCTION_RESEARCH_COST,MEDICINE_PRODUCTION_RESEARCH_COST,MICROELECTRONICS_RESEARCH_COST} from '../src/sim/research.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import type {World} from '../src/sim/types.ts';
import {healrootCamp} from './helpers/healroot-domestic-v195.ts';

/** Prepared physical inputs only: the tests perform collection and synthesis. */
function medicineProductionCamp(unlocked=true):World {
  const w=healrootCamp(32),p=w.pawns[0]!;
  for(const key of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[key]=0;
  p.priorities.craft=1;delete p.traits;
  p.skills.crafting={level:8,xp:0,dailyXp:0,passion:1};p.skills.intellectual={level:8,xp:0,dailyXp:0,passion:1};
  w.research={points:0,project:null,microelectronics:{points:MICROELECTRONICS_RESEARCH_COST,completedAt:1000},drugProduction:{points:DRUG_PRODUCTION_RESEARCH_COST,completedAt:1500},...(unlocked?{medicineProduction:{points:MEDICINE_PRODUCTION_RESEARCH_COST,completedAt:2000}}:{})};
  w.structures.push({id:w.nextId++,kind:'drug-lab',x:8,z:8,orientation:0,footprint:'standard',material:'steel',bills:[]});
  for(const [item,quantity,x] of [['herbal-medicine',1,4],['neutroamine',1,5],['cloth',3,6]] as const)addGroundMaterial(w,ITEM_DEFINITIONS[item].kind,quantity,{x,z:6},item);
  refreshStock(w);return w;
}
function bill(w:World):void {
  expect(applyCommand(w,{type:'bill-add',structureId:w.structures[0]!.id,recipe:'make-medicine'}).ok).toBe(true);
  w.structures[0]!.bills![0]!.destination='drop';
}
function until(w:World,done:()=>boolean):void {
  for(let i=0;i<1800&&!done();i++)stepWorld(w);
  expect(done(),`Medicine transition at ${w.tick}`).toBe(true);expect(validateWorld(w)).toEqual([]);
}
const count=(w:World,item:string)=>w.piles.reduce((n,p)=>n+(p.item===item?p.quantity:0),0);

test('one non-electric laboratory recipe has exact medical, chemical and textile quotas',()=>{
  expect(PRODUCTION_RECIPES['make-medicine']).toMatchObject({station:'drug-lab',work:'craft',units:5,workTicks:70,outputUnits:1});
  const w=medicineProductionCamp(),lab=w.structures[0]!;
  // Schema 337: the drug lab also makes penoxycyline (single and bulk), as in Core.
  expect(stationRecipes(lab)).toEqual(['make-medicine','make-penoxycyline','make-penoxycyline-bulk']);expect(productionStationUsable(lab)).toBe(true);
  expect(stationAccepts({kind:'machining-table'},'make-medicine')).toBe(false);
  expect(validMedicineIngredients('make-medicine',[{item:'herbal-medicine',quantity:1},{item:'neutroamine',quantity:1},{item:'cloth',quantity:1},{item:'cloth',quantity:2}])).toBe(true);
  for(const parts of [[{item:'cloth',quantity:5}],[{item:'medicine',quantity:1},{item:'neutroamine',quantity:1},{item:'cloth',quantity:3}],[{item:'herbal-medicine',quantity:1},{item:'neutroamine',quantity:2},{item:'cloth',quantity:2}],[{item:'herbal-medicine',quantity:1},{item:'neutroamine',quantity:1},{item:'cloth',quantity:2.5}]])expect(validMedicineIngredients('make-medicine',parts)).toBe(false);
  expect(MEDICINE_REQUIREMENTS).toEqual({'herbal-medicine':1,neutroamine:1,cloth:3});
});

test('research and schema gate bill creation without changing the prepared colony',()=>{
  const w=medicineProductionCamp(false),before=serializeWorld(w);
  expect(productionResearchUnlocked(w,'make-medicine')).toBe(false);
  expect(applyCommand(w,{type:'bill-add',structureId:w.structures[0]!.id,recipe:'make-medicine'}).ok).toBe(false);
  expect(serializeWorld(w)).toBe(before);
  const ready=medicineProductionCamp();expect(productionResearchUnlocked(ready,'make-medicine')).toBe(true);
  expect(productionResearchUnlocked({...ready,schemaVersion:205 as World['schemaVersion']},'make-medicine')).toBe(false);
  expect(validBillSettings(newCookingBill(1,'make-medicine'),'make-medicine',205)).toBe(false);
});

test('Crafting and Intellectual both require four while doctor priority cannot replace craft',()=>{
  const w=medicineProductionCamp(),p=w.pawns[0]!;bill(w);
  p.skills.crafting!.level=3;expect(productionWorkerQualified(p,'make-medicine')).toBe(false);
  p.skills.crafting!.level=4;p.skills.intellectual!.level=3;expect(productionWorkerQualified(p,'make-medicine')).toBe(false);
  expect(planCookingOrder(w,p,w.structures[0]!.id).reason).toContain('Intellectuel 4');
  p.skills.intellectual!.level=4;expect(productionWorkerQualified(p,'make-medicine')).toBe(true);
  p.priorities.craft=0;p.priorities.doctor=1;expect(planCookingOrder(w,p,w.structures[0]!.id).order).toBeUndefined();
  p.priorities.craft=1;expect(planCookingOrder(w,p,w.structures[0]!.id).order).toBeDefined();
});

test('planner reserves exact distinct physical ingredients and leaves food outside the recipe',()=>{
  const w=medicineProductionCamp(),p=w.pawns[0]!;bill(w);addGroundMaterial(w,'food',10,{x:7,z:6},'rice');refreshStock(w);
  const before=serializeWorld(w),proposal=planCookingOrder(w,p,w.structures[0]!.id);
  expect(proposal.label).toBe('Fabriquer un médicament');expect(proposal.order&&'cooking' in proposal.order).toBe(true);
  const task=(proposal.order as {cooking:NonNullable<typeof p.cooking>}).cooking;
  expect(validMedicineIngredients('make-medicine',task.ingredients)).toBe(true);expect(task.ingredients).toHaveLength(3);
  expect(task.ingredients.some(i=>i.item==='rice')).toBe(false);expect(serializeWorld(w)).toBe(before);
  w.piles=w.piles.filter(pile=>pile.item!=='neutroamine');refreshStock(w);
  expect(planCookingOrder(w,p,w.structures[0]!.id).order).toBeUndefined();expect(count(w,'rice')).toBe(10);
});

test('drug synthesis follows Intellectual speed independently of Crafting level',()=>{
  const p=medicineProductionCamp().pawns[0]!;
  p.skills.intellectual!.level=4;expect(medicineProductionSpeed(p)).toBeCloseTo(.65);
  p.skills.intellectual!.level=8;expect(medicineProductionSpeed(p)).toBeCloseTo(1);
  p.skills.intellectual!.level=20;expect(medicineProductionSpeed(p)).toBeCloseTo(2.05);
  p.skills.crafting!.level=4;expect(medicineProductionSpeed(p)).toBeCloseTo(2.05);
});

test('seventy neutral work calls consume only at completion and award Intellectual then',()=>{
  const w=medicineProductionCamp(),p=w.pawns[0]!;bill(w);
  until(w,()=>p.cooking?.phase==='gather'&&p.cooking.ingredients.every(i=>i.stage==='placed')&&p.x===p.cooking.spot.x&&p.z===p.cooking.spot.z);
  const context={search:()=>null,move:()=>{throw new Error('All materials are staged');},release:()=>releaseWork(w,p),event:()=>{},workRate:()=>1};
  const rng=w.rng,otherSkills=structuredClone({crafting:p.skills.crafting,medicine:p.skills.medicine,cooking:p.skills.cooking});
  for(let i=0;i<69;i++)processCooking(w,p,context);
  expect(p.cooking!.progress).toBe(69*PRODUCTION_WORK_SCALE);expect(p.cooking!.workTicks).toBe(69);
  expect(p.skills.intellectual!.xp).toBe(0);expect(count(w,'cloth')).toBe(3);expect(count(w,'medicine')).toBe(0);
  processCooking(w,p,context);refreshStock(w);
  expect(p.cooking!.phase).toBe('output');expect(p.cooking!.workTicks).toBeUndefined();expect(count(w,'medicine')).toBe(1);
  expect(count(w,'herbal-medicine')+count(w,'neutroamine')+count(w,'cloth')).toBe(0);
  expect(p.skills.intellectual!.xp).toBe(70000);expect({crafting:p.skills.crafting,medicine:p.skills.medicine,cooking:p.skills.cooking}).toEqual(otherSkills);
  expect(w.rng).toBe(rng);expect(w.structures[0]!.bills![0]!.target).toBe(0);
  expect(w.piles.find(pile=>pile.item==='medicine')).toMatchObject({quantity:1,owner:{type:'pawn',pawnId:p.id}});
  expect(w.piles.find(pile=>pile.item==='medicine')!.foodPoison).toBeUndefined();expect(validateWorld(w)).toEqual([]);
});

test('completion learning uses the shared passion rule and leaves the source record unchanged',()=>{
  const p=medicineProductionCamp().pawns[0]!;p.skills.intellectual!.passion=0;
  expect(completedMedicineSkill(p,70).xp).toBe(24500);expect(p.skills.intellectual!.xp).toBe(0);
  p.skills.intellectual!.passion=2;expect(completedMedicineSkill(p,70).xp).toBe(105000);
});

test('queued medicine guards reject quota substitutions, work history and older schemas',()=>{
  const w=medicineProductionCamp(),p=w.pawns[0]!;bill(w);
  const order=planCookingOrder(w,p,w.structures[0]!.id).order!;
  expect(validCookingOrder(order,w)).toBe(true);expect(validCookingOrder(order,{...w,schemaVersion:205 as World['schemaVersion']})).toBe(false);
  const counterfeit=structuredClone(order) as {cooking:NonNullable<typeof p.cooking>};counterfeit.cooking.ingredients[0]!.item='rice';
  expect(validCookingOrder(counterfeit,w)).toBe(false);
  const progressed=structuredClone(order) as {cooking:NonNullable<typeof p.cooking>};progressed.cooking.workTicks=1;
  expect(validCookingOrder(progressed,w)).toBe(false);
  const typed=order as {cooking:NonNullable<typeof p.cooking>};p.orders.queue.push(typed);p.skills.intellectual!.level=3;
  expect(queuedCookingReason(w,typed)).toContain('Intellectuel 4');
});

test('active medicine saves require work duration and exact ingredients',()=>{
  const w=medicineProductionCamp(),p=w.pawns[0]!;bill(w);until(w,()=>p.cooking?.phase==='work');
  const original=serializeWorld(w);expect(deserializeWorld(original)).toEqual(w);
  const missing=JSON.parse(original);delete missing.pawns[0].cooking.workTicks;expect(()=>deserializeWorld(JSON.stringify(missing))).toThrow();
  const swapped=JSON.parse(original);swapped.pawns[0].cooking.ingredients[0].quantity=2;expect(()=>deserializeWorld(JSON.stringify(swapped))).toThrow();
  const future=JSON.parse(original);future.schemaVersion=205;expect(()=>deserializeWorld(JSON.stringify(future))).toThrow();
});
