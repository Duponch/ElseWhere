import {expect,test} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {PRODUCTION_RECIPES,stationRecipes,fineMealIngredientGroup,validFineMealIngredients,validVegetarianFineMealIngredients,validLavishMealIngredients} from '../src/sim/production-recipes.ts';
import {KIBBLE_INPUTS,kibbleIngredientGroup,validKibbleIngredients} from '../src/sim/fodder-recipes.ts';
import {COOKING_ANIMAL_PRODUCTS_353,COOKING_FERTILIZED_EGGS_353,COOKING_UNFERTILIZED_EGGS_353,cookingDefaultAllowed353,cookingUnitValue353,nutritionTotalMatches353} from '../src/sim/cooking-ingredients-353.ts';
import {planCookingOrder} from '../src/sim/player-cooking.ts';
import {APPAREL,HAT_ITEMS353,apparelInsulation,conflictsWith,newApparelState} from '../src/sim/apparel-rules.ts';
import {validApparelShape} from '../src/sim/apparel-save.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {CLOTHING_RESEARCH_COST} from '../src/sim/research.ts';
import {productionResearchUnlocked} from '../src/sim/machining.ts';
import {APPAREL_TRADE_279} from '../src/sim/apparel-trade-279.ts';
import {commercialItemMassGrams} from '../src/sim/commercial-mass.ts';
import {createDefaultApparelPolicyRegistry,validApparelPolicy} from '../src/sim/apparel-policy.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {generateVisitorStock,visitorClothingFamily} from '../src/sim/trade-stock.ts';
import {socialImpact,wornSocialImpactOffset353} from '../src/sim/social-state.ts';
import {fixtureFoodStation} from './scenarios/food-workstations.ts';
import {pawnGeometry} from '../src/render/pawn-geometry.ts';
import {COWBOY_HAT_DYE353,BOWLER_HAT_DYE353} from '../src/render/origami/human-geometry.ts';
import {apparelAppearance} from '../src/render/character-apparel.ts';
import {itemGeometry,itemCargoKind} from '../src/render/item-presentation.ts';
import {portraitDataUrl} from '../src/ui/pawn-portrait.ts';
import {appearanceOf} from '../src/sim/pawn-appearance.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type MaterialPile,type Structure,type World} from '../src/sim/types.ts';
import type {ItemId} from '../src/sim/items.ts';

const count=(w:World,item:string)=>w.piles.reduce((n,p)=>n+(p.item===item?p.quantity:0),0);
function until(w:World,done:()=>boolean,limit=2500){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);expect(validateWorld(w)).toEqual([]);}
/** deconstructionCamp keeps its creation tick (the food fixture's moved clock
 * no longer matches the physical path budget), with a real cook. */
function kitchen(recipe:'simple-meal'|'fine-meal'|'make-kibble'){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!,station=fixtureFoodStation(w,recipe==='make-kibble'?'butcher-table':'fueled-stove');
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.cook=1;pawn.schedule.fill('work');pawn.skills.cooking={level:10,xp:0,dailyXp:0,passion:1};if(station.fuel)station.fuel.ticks=6000;
  expect(applyCommand(w,{type:'bill-add',structureId:station.id,recipe})).toMatchObject({ok:true});
  station.bills![0]!.destination='drop';return {w,pawn,station,bill:station.bills![0]!};
}
const fertilized=(w:World)=>({egg:{progress:0,temperatureDamage:0,faction:'player' as const,atTick:w.tick}});
function allow(w:World,station:Structure,item:ItemId){
  const bill=station.bills![0]!;
  expect(applyCommand(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:{mode:bill.mode,target:bill.target,suspended:bill.suspended,radius:bill.radius,destination:bill.destination,filters:{...bill.filters,[item]:true}}})).toMatchObject({ok:true});
}
function tailor(){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.craft=1;pawn.priorities.tailor=1;pawn.schedule.fill('work');pawn.apparelAutomation=false;
  pawn.skills.crafting={level:8,xp:0,dailyXp:0,passion:1};
  w.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0};
  const bench:Structure={id:w.nextId++,kind:'tailor-bench',x:10,z:10,orientation:0,footprint:'standard',material:'wood',bills:[]};
  w.structures.push(bench);return {w,pawn,bench};
}

test('Core cooks eggs and insect jelly as animal products: recipe filters, default bill filters and nutrition units',()=>{
  expect(COOKING_UNFERTILIZED_EGGS_353).toHaveLength(8);expect(COOKING_FERTILIZED_EGGS_353).toHaveLength(8);
  // FoodRaw (simple), MeatRaw+AnimalProductRaw (fine, lavish, survival, kibble), PlantFoodRaw+AnimalProductRaw (vegetarian).
  for(const recipe of ['simple-meal','cook-simple-meal-bulk','fine-meal','cook-fine-meal-bulk','lavish-meal','cook-lavish-meal-bulk','cook-survival-meal','vegetarian-fine-meal','cook-vegetarian-fine-meal-bulk','vegetarian-lavish-meal','cook-vegetarian-lavish-meal-bulk','make-kibble'] as const)
    for(const item of COOKING_ANIMAL_PRODUCTS_353)expect(PRODUCTION_RECIPES[recipe].inputs).toContain(item);
  // Carnivore meals and pemmican disallow AnimalProductRaw.
  for(const recipe of ['carnivore-fine-meal','cook-carnivore-fine-meal-bulk','cook-carnivore-lavish-meal','cook-carnivore-lavish-meal-bulk','make-pemmican'] as const)
    for(const item of COOKING_ANIMAL_PRODUCTS_353)expect(PRODUCTION_RECIPES[recipe].inputs).not.toContain(item);
  expect(fineMealIngredientGroup('duck-egg-unfertilized')).toBe('protein');expect(fineMealIngredientGroup('insect-jelly')).toBe('protein');
  expect(kibbleIngredientGroup('emu-egg-fertilized')).toBe('protein');expect(kibbleIngredientGroup('insect-jelly')).toBe('protein');
  // Core nutrition: 0.25 or 0.5 an egg, the fertilized ostrich 0.6; jelly 0.05 like the older one-unit ingredients.
  expect(cookingUnitValue353('duck-egg-unfertilized')).toBe(5);expect(cookingUnitValue353('emu-egg-unfertilized')).toBe(10);
  expect(cookingUnitValue353('ostrich-egg-fertilized')).toBe(12);expect(cookingUnitValue353('insect-jelly')).toBe(1);expect(cookingUnitValue353('rice')).toBe(1);
  // defaultIngredientFilter: unfertilized eggs allowed, fertilized eggs and insect jelly refused until allowed.
  for(const recipe of ['simple-meal','fine-meal','make-kibble'] as const){
    const bill=newCookingBill(1,recipe);
    for(const egg of COOKING_UNFERTILIZED_EGGS_353)expect(bill.filters[egg]).toBe(true);
    for(const egg of COOKING_FERTILIZED_EGGS_353)expect(bill.filters[egg]).toBe(false);
    expect(bill.filters['insect-jelly']).toBe(false);expect(validBillSettings(bill,recipe,SCHEMA_VERSION)).toBe(true);
    // Before 353 a bill neither has nor accepts them.
    const old=newCookingBill(1,recipe,352);
    expect(Object.keys(old.filters).some(i=>(COOKING_ANIMAL_PRODUCTS_353 as readonly string[]).includes(i))).toBe(false);
    expect(validBillSettings(old,recipe,352)).toBe(true);expect(validBillSettings(bill,recipe,352)).toBe(false);
    expect(validBillSettings(old,recipe,SCHEMA_VERSION)).toBe(true);
  }
  expect(KIBBLE_INPUTS.every(i=>newCookingBill(1,'make-kibble').filters[i]===cookingDefaultAllowed353(i))).toBe(true);
  // AllowMix: ceil(missing / value), so only the largest thing may overshoot.
  expect(validFineMealIngredients([{item:'emu-egg-unfertilized',quantity:1},{item:'rice',quantity:5}])).toBe(true);
  expect(validFineMealIngredients([{item:'duck-egg-unfertilized',quantity:1},{item:'rice',quantity:5}])).toBe(true);
  expect(validFineMealIngredients([{item:'milk',quantity:4},{item:'duck-egg-unfertilized',quantity:1},{item:'rice',quantity:5}])).toBe(true);
  expect(validFineMealIngredients([{item:'duck-egg-unfertilized',quantity:2},{item:'rice',quantity:5}])).toBe(false);
  expect(validFineMealIngredients([{item:'emu-egg-unfertilized',quantity:1},{item:'rice',quantity:10}])).toBe(false);
  expect(validVegetarianFineMealIngredients([{item:'duck-egg-unfertilized',quantity:2},{item:'rice',quantity:5}])).toBe(true);
  expect(validLavishMealIngredients([{item:'insect-jelly',quantity:10},{item:'rice',quantity:10}])).toBe(true);
  expect(validKibbleIngredients([{item:'emu-egg-unfertilized',quantity:2},{item:'hay',quantity:20}])).toBe(true);
  expect(validKibbleIngredients([{item:'emu-egg-unfertilized',quantity:3},{item:'hay',quantity:20}])).toBe(false);
  expect(nutritionTotalMatches353([{item:'duck-egg-unfertilized',quantity:2}],10)).toBe(true);
  // One-unit ingredients keep their exact older quotas.
  expect(validFineMealIngredients([{item:'milk',quantity:5},{item:'rice',quantity:5}])).toBe(true);
  expect(validFineMealIngredients([{item:'milk',quantity:6},{item:'rice',quantity:5}])).toBe(false);
  expect(nutritionTotalMatches353([{item:'rice',quantity:11}],10)).toBe(false);
});

test('a cook makes a simple meal from two duck eggs, then a fine meal from an emu egg and rice',()=>{
  const {w,pawn}=kitchen('simple-meal');
  addGroundMaterial(w,'food',3,{x:6,z:6},'duck-egg-unfertilized');refreshStock(w);
  until(w,()=>count(w,'simple-meal')===1&&!pawn.cooking);
  // 0.5 nutrition = two 0.25 eggs; the third egg stays.
  expect(count(w,'duck-egg-unfertilized')).toBe(1);
  expect(w.events.some(e=>e.message.includes('1 repas simple (2 œufs)'))).toBe(true);
  const fine=kitchen('fine-meal');
  addGroundMaterial(fine.w,'food',2,{x:6,z:6},'emu-egg-unfertilized');addGroundMaterial(fine.w,'food',5,{x:7,z:6},'rice');refreshStock(fine.w);
  until(fine.w,()=>fine.pawn.cooking?.phase==='work'&&fine.pawn.cooking.progress>0);
  expect(fine.pawn.cooking!.ingredients.map(i=>[i.item,i.quantity])).toEqual(expect.arrayContaining([['emu-egg-unfertilized',1],['rice',5]]));
  const resumed=deserializeWorld(serializeWorld(fine.w));
  stepWorld(fine.w,30);stepWorld(resumed,30);expect(serializeWorld(resumed)).toBe(serializeWorld(fine.w));
  until(fine.w,()=>count(fine.w,'fine-meal')===1&&!fine.pawn.cooking);
  // One 0.5 egg fills the 0.25 protein quota, as Core's ceil; the other egg stays.
  expect(count(fine.w,'emu-egg-unfertilized')).toBe(1);expect(count(fine.w,'rice')).toBe(0);
});

test('kibble from eggs; insect jelly and fertilized eggs only once the bill allows them',()=>{
  const eggs=kitchen('make-kibble');
  addGroundMaterial(eggs.w,'food',2,{x:6,z:6},'emu-egg-unfertilized');addGroundMaterial(eggs.w,'food',20,{x:7,z:6},'hay');refreshStock(eggs.w);
  until(eggs.w,()=>count(eggs.w,'kibble')===50&&!eggs.pawn.cooking);
  expect(count(eggs.w,'emu-egg-unfertilized')).toBe(0);expect(count(eggs.w,'hay')).toBe(0);
  const jelly=kitchen('make-kibble');
  addGroundMaterial(jelly.w,'food',20,{x:6,z:6},'insect-jelly');addGroundMaterial(jelly.w,'food',20,{x:7,z:6},'hay');refreshStock(jelly.w);
  expect(planCookingOrder(jelly.w,jelly.pawn,jelly.station.id).order).toBeUndefined();
  stepWorld(jelly.w,200);expect(count(jelly.w,'kibble')).toBe(0);expect(count(jelly.w,'insect-jelly')).toBe(20);
  allow(jelly.w,jelly.station,'insect-jelly');
  until(jelly.w,()=>count(jelly.w,'kibble')===50&&!jelly.pawn.cooking);expect(count(jelly.w,'insect-jelly')).toBe(0);
  const fert=kitchen('make-kibble');
  addGroundMaterial(fert.w,'food',2,{x:6,z:6},'emu-egg-fertilized',fertilized(fert.w));addGroundMaterial(fert.w,'food',20,{x:7,z:6},'hay');refreshStock(fert.w);
  expect(planCookingOrder(fert.w,fert.pawn,fert.station.id).order).toBeUndefined();
  allow(fert.w,fert.station,'emu-egg-fertilized');
  until(fert.w,()=>count(fert.w,'kibble')===50&&!fert.pawn.cooking);expect(count(fert.w,'emu-egg-fertilized')).toBe(0);
});

test('the cowboy and bowler hats have their Core stats, recipes, values and layer in every material',()=>{
  // Every tailoring material, devilstrand (schema 358) included.
  expect(HAT_ITEMS353).toHaveLength(23*2);
  for(const item of HAT_ITEMS353){expect(ITEM_DEFINITIONS[item].kind).toBe('apparel');expect(APPAREL[item].coverage).toEqual(APPAREL['cloth-tuque'].coverage);}
  expect(PRODUCTION_RECIPES['cowboy-hat']).toMatchObject({units:25,workTicks:180,station:'tailor-bench'});
  expect(PRODUCTION_RECIPES['bowler-hat']).toMatchObject({units:20,workTicks:180,station:'tailor-bench'});
  expect(PRODUCTION_RECIPES['cowboy-hat'].inputs).toEqual(PRODUCTION_RECIPES.jacket.inputs);
  expect(stationRecipes({kind:'tailor-bench'})).toEqual(expect.arrayContaining(['cowboy-hat','bowler-hat']));
  expect(stationRecipes({kind:'electric-tailor-bench'})).toEqual(expect.arrayContaining(['cowboy-hat','bowler-hat']));
  expect(stationRecipes({kind:'crafting-spot'})).not.toContain('cowboy-hat');
  expect(APPAREL['cloth-cowboy-hat']).toMatchObject({hitPoints:80,family:'cowboy-hat',material:'cloth',label:'Chapeau de cowboy en tissu'});
  expect(APPAREL['bear-leather-bowler-hat'].hitPoints).toBe(104);
  const hat=(item:keyof typeof APPAREL,id=1):MaterialPile=>({id,kind:'apparel',item,quantity:1,owner:{type:'ground',x:1,z:1},apparel:newApparelState(item)});
  // Cloth 18/18: cowboy cold x0.10 heat x0.50, bowler heat x0.40; armor x0.2.
  expect(apparelInsulation(hat('cloth-cowboy-hat')).cold).toBeCloseTo(1.8,9);expect(apparelInsulation(hat('cloth-cowboy-hat')).heat).toBeCloseTo(9,9);
  expect(apparelInsulation(hat('cloth-bowler-hat')).heat).toBeCloseTo(7.2,9);
  expect(APPAREL['cloth-cowboy-hat'].ratings.sharp).toBeCloseTo(.36*.2,9);
  // Overhead on the upper head: one hat at a time, with any shirt.
  expect(conflictsWith(hat('cloth-cowboy-hat'),hat('cloth-tuque',2))).toBe(true);
  expect(conflictsWith(hat('cloth-cowboy-hat'),hat('cloth-bowler-hat',2))).toBe(true);
  expect(conflictsWith(hat('cloth-cowboy-hat'),hat('cloth-shirt',2))).toBe(false);
  // Value: stuff count x stuff value + work x 0.0036; mass 0.14 kg.
  expect(APPAREL_TRADE_279['cloth-cowboy-hat'].baseMarketValue).toBeCloseTo(25*1.5+1800*.0036,9);
  expect(APPAREL_TRADE_279['cloth-bowler-hat'].baseMarketValue).toBeCloseTo(20*1.5+1800*.0036,9);
  expect(commercialItemMassGrams('cloth-cowboy-hat')).toBe(140);
  // Visitors sell them: Core clothing pool entries 0 and 1, from 353 only.
  expect(visitorClothingFamily(0,SCHEMA_VERSION)).toBe('cowboy-hat');expect(visitorClothingFamily(1,SCHEMA_VERSION)).toBe('bowler-hat');
  expect(visitorClothingFamily(0,352)).toBeUndefined();expect(visitorClothingFamily(3,352)).toBe('tuque');
  let sold=0;for(let seed=1;seed<400&&!sold;seed++)sold=generateVisitorStock(seed,1,10,0).piles.filter(p=>(HAT_ITEMS353 as readonly string[]).includes(p.item)).length;
  expect(sold).toBeGreaterThan(0);
  for(let seed=1;seed<400;seed++)expect(generateVisitorStock(seed,1,10,0,352).piles.some(p=>(HAT_ITEMS353 as readonly string[]).includes(p.item))).toBe(false);
  // A new game's policies allow them.
  const policy=createDefaultApparelPolicyRegistry().apparelPolicies[0]!;
  expect(policy.allowedItems).toContain('cloth-cowboy-hat');expect(validApparelPolicy(policy,352)).toBe(false);
});

test('a real tailor makes a cowboy hat that a colonist wears; the save resumes exactly',()=>{
  const {w,pawn,bench}=tailor();addGroundMaterial(w,'textile',60,{x:12,z:12},'cloth');
  expect(productionResearchUnlocked(w,'cowboy-hat')).toBe(true);
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'cowboy-hat'});
  until(w,()=>!!w.piles.find(p=>p.unfinished?.recipe==='cowboy-hat')?.unfinished?.progress,6000);
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>w.piles.some(p=>p.item==='cloth-cowboy-hat'&&p.owner.type==='ground')&&!pawn.cooking,6000);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  expect(count(w,'cloth')).toBe(35);
  const before=socialImpact(pawn,wornSocialImpactOffset353(w,pawn.id)),made=w.piles.find(p=>p.item==='cloth-cowboy-hat')!;
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:made.id,action:'wear',queue:false});
  until(w,()=>made.owner.type==='apparel',600);
  // Core SocialImpact: (1 + 0.10) x the skill and capacity factors.
  expect(wornSocialImpactOffset353(w,pawn.id)).toBeCloseTo(.1,9);
  expect(socialImpact(pawn,wornSocialImpactOffset353(w,pawn.id))).toBeCloseTo(before*1.1,9);
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});
const accept=(w:World,c:Parameters<typeof applyCommand>[1])=>{const result=applyCommand(w,c);expect(result,JSON.stringify([c,result])).toMatchObject({ok:true});};

test('before schema 353 eggs, insect jelly and hats are refused; migration 352 -> 353 gives nothing',()=>{
  // An old bill cannot take an egg: the planner has nothing to cook.
  const {w,station}=kitchen('simple-meal');
  addGroundMaterial(w,'food',3,{x:6,z:6},'duck-egg-unfertilized');refreshStock(w);
  const bill=station.bills![0]!;bill.filters=newCookingBill(bill.id,'simple-meal',352).filters;
  expect(planCookingOrder(w,w.pawns[0]!,station.id).order).toBeUndefined();
  // A 352 save holding an egg reservation, a hat, a hat bill or a hat policy entry is refused.
  const {w:cooking,pawn}=kitchen('simple-meal');
  addGroundMaterial(cooking,'food',3,{x:6,z:6},'duck-egg-unfertilized');refreshStock(cooking);
  until(cooking,()=>pawn.cooking?.ingredients.some(i=>i.item==='duck-egg-unfertilized')===true);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(cooking),352))).toThrow();
  const p=({id:1,kind:'apparel',item:'cloth-cowboy-hat',quantity:1,owner:{type:'ground',x:1,z:1},apparel:newApparelState('cloth-cowboy-hat')}) as unknown as Record<string,unknown>;
  expect(validApparelShape(p,SCHEMA_VERSION)).toBe(true);expect(validApparelShape(p,352)).toBe(false);
  expect(validBillSettings(newCookingBill(1,'cowboy-hat'),'cowboy-hat',SCHEMA_VERSION)).toBe(true);
  expect(validBillSettings(newCookingBill(1,'cowboy-hat'),'cowboy-hat',352)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'cloth-bowler-hat'}]},352)).toBe(false);
  expect(validTuqueCatalogueTransport({bills:[{recipe:'cowboy-hat'}]},352)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'cloth-bowler-hat'}]},SCHEMA_VERSION)).toBe(true);
  expect(productionResearchUnlocked({schemaVersion:352 as World['schemaVersion'],research:{project:null,points:CLOTHING_RESEARCH_COST,completedAt:0}},'cowboy-hat')).toBe(false);
  // Migration by number only: an old meal bill keeps refusing eggs until the player allows them.
  const fresh=kitchen('simple-meal'),current=serializeWorld(fresh.w);
  const migrated=deserializeWorld(asOldSchema(current,352));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(validateWorld(migrated)).toEqual([]);
  const migratedBill=migrated.structures.find(s=>s.id===fresh.station.id)!.bills![0]!;
  expect(Object.keys(migratedBill.filters).some(i=>(COOKING_ANIMAL_PRODUCTS_353 as readonly string[]).includes(i))).toBe(false);
  addGroundMaterial(migrated,'food',3,{x:6,z:6},'duck-egg-unfertilized');refreshStock(migrated);
  expect(planCookingOrder(migrated,migrated.pawns[0]!,fresh.station.id).order).toBeUndefined();
  const hats=tailor(),plain=serializeWorld(hats.w);
  expect(serializeWorld(deserializeWorld(asOldSchema(plain,352)))).toBe(serializeWorld(deserializeWorld(asOldSchema(plain,352))));
  const reloaded=deserializeWorld(asOldSchema(plain,352));
  expect(reloaded.apparelPolicies!.some(policy=>policy.allowedItems.some(i=>(HAT_ITEMS353 as readonly string[]).includes(i)))).toBe(false);
});

test('the worn hats join the human rig only once worn, with their own worn codes, colour and ground model',()=>{
  const plain=pawnGeometry(),rig=pawnGeometry(false,false,false,false,true);
  try{
    // An ordinary rig keeps its exact count; the hat parts sit on the head bone.
    const dye=rig.getAttribute('dye'),bone=rig.getAttribute('boneId'),y=rig.getAttribute('position');let cowboy=0,bowler=0,low=Infinity;
    for(let i=0;i<dye.count;i++){const d=dye.getX(i);if(d!==COWBOY_HAT_DYE353&&d!==BOWLER_HAT_DYE353)continue;if(d===COWBOY_HAT_DYE353)cowboy++;else bowler++;expect(bone.getX(i)).toBe(1);low=Math.min(low,y.getY(i));}
    expect(cowboy).toBeGreaterThan(0);expect(bowler).toBeGreaterThan(0);expect(rig.getAttribute('position').count).toBe(plain.getAttribute('position').count+cowboy+bowler);
    expect(low).toBeGreaterThan(1.3);
  }finally{plain.dispose();rig.dispose();}
  const worn=(item:keyof typeof APPAREL):MaterialPile=>({id:9,kind:'apparel',item,quantity:1,owner:{type:'apparel',pawnId:1},apparel:newApparelState(item)});
  const cowboy=apparelAppearance([worn('bluefur-cowboy-hat')]),bowler=apparelAppearance([worn('bluefur-bowler-hat')]),bare=apparelAppearance([]);
  expect(cowboy).toMatchObject({hat353:1,hatColor353:APPAREL['bluefur-cowboy-hat'].color,helmet:false,tuque:0});
  expect(bowler).toMatchObject({hat353:2,hatColor353:APPAREL['bluefur-bowler-hat'].color});expect(bare.hat353).toBe(0);
  const w=deconstructionCamp(1,32),face=appearanceOf(w.pawns[0]!,w.seed),svg=(look:typeof bare)=>decodeURIComponent(portraitDataUrl(face,look).split(',')[1]!);
  expect(new Set([svg(bare),svg(cowboy),svg(bowler)]).size).toBe(3);
  // On the ground: crown and brim in the material colour; carried: the cloth tuque's cargo model.
  expect(itemGeometry('bluefur-cowboy-hat').map(p=>[p.shape,p.color])).toEqual([['item-helmet',APPAREL['bluefur-cowboy-hat'].color],['item-disc',APPAREL['bluefur-cowboy-hat'].color]]);
  expect(itemCargoKind('bluefur-cowboy-hat')).toBe(itemCargoKind('cloth-tuque'));expect(itemCargoKind('unfinished-bowler-hat')).toBe(itemCargoKind('cloth-tuque'));
});
