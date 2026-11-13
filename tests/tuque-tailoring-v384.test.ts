import {expect,test} from 'vitest';
import {validateCooking} from '../src/sim/cooking-save.ts';
import {validCookingOrder} from '../src/sim/player-cooking-save.ts';
import {applyCommand,serializeWorld,deserializeWorld,validateWorld,stepWorld} from '../src/sim/index.ts';
import {APPAREL,APPAREL_FAMILIES,APPAREL_MATERIALS,apparelItemFor,newApparelState,conflictsWith,apparelInsulation} from '../src/sim/apparel-rules.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {PRODUCTION_RECIPES,productionWorkTotal,recipeProduct,isRecipeProduct,stationRecipes} from '../src/sim/production-recipes.ts';
import {validUnfinishedShape} from '../src/sim/unfinished.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';
import {newPowerState} from '../src/sim/power-rules.ts';
import {CLOTHING_RESEARCH_COST} from '../src/sim/research.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import type {Command,MaterialPile,Structure,World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
function until(w:World,done:()=>boolean,limit=2200){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}
/** Prepared bench, research and finite textile; no acquisition history claimed. */
function workshop(kind:'tailor-bench'|'electric-tailor-bench'='tailor-bench'){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.craft=1;pawn.schedule.fill('work');pawn.apparelAutomation=false;
  pawn.skills.crafting={level:8,xp:0,dailyXp:0,passion:1};
  w.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0};
  const bench:Structure={id:w.nextId++,kind,x:10,z:10,orientation:0,footprint:'standard',material:'wood',bills:[],...(kind==='electric-tailor-bench'?{power:newPowerState(kind)}:{})};
  w.structures.push(bench);return {w,pawn,bench};
}
const unfinished=(w:World)=>w.piles.find(p=>p.unfinished?.recipe==='tuque');
const textile=(w:World,item:'cloth'|'muffalo-wool'|'light-leather')=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);

test('tuques add only two products and preserve the historical family/material catalogue',()=>{
  // Schema 312 adds the T-shirt and the jacket after the five historical families.
  expect(APPAREL_FAMILIES).toEqual(['tribalwear','shirt','pants','duster','parka','tshirt','jacket']);
  for(const family of APPAREL_FAMILIES)for(const material of APPAREL_MATERIALS)expect(APPAREL[apparelItemFor(family,material)]).toBeDefined();
  // Schema 308 adds the three new wools' tuques after these two.
  expect(Object.keys(APPAREL).filter(item=>item.endsWith('-tuque')).sort()).toEqual(['alpaca-wool-tuque','bison-wool-tuque','cloth-tuque','megasloth-wool-tuque','muffalo-wool-tuque']);
  expect(PRODUCTION_RECIPES.tuque).toMatchObject({inputs:['cloth','muffalo-wool','alpaca-wool','bison-wool','megasloth-wool'],units:20,workTicks:120,outputUnits:1});
  expect(productionWorkTotal('tuque')).toBe(1200000);expect(PRODUCTION_RECIPES.parka.workTicks).toBe(800);
  expect(stationRecipes({kind:'tailor-bench'})).toContain('tuque');expect(stationRecipes({kind:'electric-tailor-bench'})).toContain('tuque');expect(stationRecipes({kind:'crafting-spot'})).not.toContain('tuque');
  expect(()=>apparelItemFor('tuque','light-leather')).toThrow(RangeError);
  expect(()=>recipeProduct('tuque',[{item:'cloth'},{item:'muffalo-wool'}])).toThrow(RangeError);
  expect(()=>recipeProduct('tuque',[{item:'light-leather'}])).toThrow(RangeError);
  for(const [item,cold] of [['cloth-tuque',9],['muffalo-wool-tuque',14]] as const){
    expect(ITEM_DEFINITIONS[item].kind).toBe('apparel');expect(APPAREL[item]).toMatchObject({hitPoints:80,equipTicks:5,coldInsulation:cold,heatInsulation:0});
    const pile:MaterialPile={id:1,kind:'apparel',item,quantity:1,owner:{type:'ground',x:1,z:1},apparel:newApparelState(item)};
    expect(apparelInsulation(pile)).toEqual({cold,heat:0});expect(conflictsWith(pile,{...pile,item:'flak-helmet',apparel:newApparelState('flak-helmet')})).toBe(true);
    expect(conflictsWith(pile,{...pile,item:'cloth-shirt',apparel:newApparelState('cloth-shirt')})).toBe(false);expect(isRecipeProduct('tuque',item)).toBe(true);
  }
  expect(ITEM_DEFINITIONS['unfinished-tuque'].kind).toBe('unfinished');
});

for(const [material,kind] of [['cloth','tailor-bench'],['muffalo-wool','electric-tailor-bench']] as const)test(`real ${material} tuque gathering, author work, interruption, exact continuation and wearing at ${kind}`,()=>{
  const {w,pawn,bench}=workshop(kind);addGroundMaterial(w,'textile',20,{x:12,z:12},material);
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'tuque'});until(w,()=>!!unfinished(w)?.unfinished?.progress);
  const work=unfinished(w)!,workId=work.id;expect(work.unfinished).toMatchObject({authorId:pawn.id,material,units:20});expect(textile(w,material)).toBe(0);
  expect(validUnfinishedShape(work as unknown as Record<string,unknown>,244)).toBe(false);expect(validUnfinishedShape(work as unknown as Record<string,unknown>,245)).toBe(true);
  // Tailoring has its own priority since schema 302 (Core's Tailoring work type).
  accept(w,{type:'priority',pawnId:pawn.id,work:'tailor',value:0});const prior=work.unfinished!.progress;stepWorld(w,5);expect(unfinished(w)?.id).toBe(workId);expect(work.unfinished!.progress).toBe(prior);
  const resumed=deserializeWorld(serializeWorld(w));for(const state of [w,resumed])accept(state,{type:'priority',pawnId:pawn.id,work:'tailor',value:1});
  const start=w.tick,item=apparelItemFor('tuque',material);until(w,()=>w.piles.some(p=>p.item===item&&p.owner.type==='ground'));stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));expect(unfinished(w)).toBeUndefined();expect(w.tailoring?.completed).toBe(1);expect(pawn.skills.crafting!.xp).toBeGreaterThan(0);
  const product=w.piles.find(p=>p.item===item)!;expect(product.apparel).toMatchObject({hitPoints:80,material});expect(product.apparel!.quality).not.toBe('legendary');expect(textile(w,material)).toBe(0);
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:product.id,action:'wear',queue:false});until(w,()=>product.owner.type==='apparel');expect(validateWorld(w)).toEqual([]);
});

test('insufficient mixed textiles and twenty leather cannot become a tuque or consume inputs',()=>{
  for(const mixed of [true,false]){
    const {w,bench}=workshop();if(mixed){addGroundMaterial(w,'textile',10,{x:12,z:12},'cloth');addGroundMaterial(w,'textile',10,{x:13,z:12},'muffalo-wool');}else addGroundMaterial(w,'textile',20,{x:12,z:12},'light-leather');
    accept(w,{type:'bill-add',structureId:bench.id,recipe:'tuque'});stepWorld(w,80);expect(unfinished(w)).toBeUndefined();expect(w.tailoring?.completed??0).toBe(0);
    expect(textile(w,'cloth')+textile(w,'muffalo-wool')+textile(w,'light-leather')).toBe(20);
  }
});

test('a wool-only replacement bill reuses its author work and cancellation physically refunds the same material',()=>{
  const {w,pawn,bench}=workshop();addGroundMaterial(w,'textile',20,{x:12,z:12},'muffalo-wool');
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'tuque'});until(w,()=>!!unfinished(w)?.unfinished?.progress);
  const work=unfinished(w)!,id=work.id,progress=work.unfinished!.progress;accept(w,{type:'priority',pawnId:pawn.id,work:'tailor',value:0});
  accept(w,{type:'bill-remove',structureId:bench.id,billId:bench.bills![0]!.id});expect(work.unfinished!.billId).toBeUndefined();
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'tuque'});const bill=bench.bills![0]!;
  accept(w,{type:'bill-update',structureId:bench.id,billId:bill.id,settings:{...bill,filters:{cloth:false,'muffalo-wool':true}}});
  accept(w,{type:'priority',pawnId:pawn.id,work:'tailor',value:1});until(w,()=>work.unfinished!.progress>progress);expect(unfinished(w)?.id).toBe(id);
  accept(w,{type:'priority',pawnId:pawn.id,work:'tailor',value:0});const rng=w.rng;accept(w,{type:'cancel-unfinished',itemId:id});
  expect(unfinished(w)).toBeUndefined();expect(textile(w,'muffalo-wool')).toBe(15);expect(textile(w,'cloth')).toBe(0);expect(w.rng).toBe(rng);
  expect(w.tailoring).toMatchObject({cancelled:1,lostLeather:5});expect(textile(w,'muffalo-wool')+(w.tailoring?.lostLeather??0)).toBe(20);expect(validateWorld(w)).toEqual([]);
});
test('a small nearer cloth lot does not starve an available homogeneous wool tuque',()=>{
  const {w,bench}=workshop();addGroundMaterial(w,'textile',10,{x:10,z:8},'cloth');addGroundMaterial(w,'textile',20,{x:14,z:13},'muffalo-wool');
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'tuque'});until(w,()=>!!unfinished(w)?.unfinished?.progress);
  expect(unfinished(w)!.unfinished).toMatchObject({material:'muffalo-wool',units:20});expect(textile(w,'cloth')).toBe(10);expect(textile(w,'muffalo-wool')).toBe(0);
});

test('neither active nor queued tuque reservations accept ten cloth plus ten wool',()=>{
  const {w,pawn,bench}=workshop();addGroundMaterial(w,'textile',20,{x:14,z:13},'muffalo-wool');
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'tuque'});until(w,()=>pawn.cooking?.recipe==='tuque'&&pawn.cooking.phase==='gather');
  const task=pawn.cooking!;expect(validateWorld(w)).toEqual([]);expect(validCookingOrder({cooking:structuredClone(task)},w)).toBe(true);
  const original=task.ingredients[0]!,source=w.piles.find(p=>p.id===original.pileId)!;source.quantity=10;
  addGroundMaterial(w,'textile',10,{x:13,z:13},'cloth');const cloth=w.piles.at(-1)!;
  task.ingredients=[{...original,quantity:10},{...original,pileId:cloth.id,item:'cloth',quantity:10,cell:{x:11,z:9}}];
  expect(validCookingOrder({cooking:structuredClone(task)},w)).toBe(false);
  expect(validateCooking(w,w.schemaVersion,new Set())).toContain('Tuque requires homogeneous material.');
  expect(()=>deserializeWorld(serializeWorld(w))).toThrow(/homogeneous/);
});
