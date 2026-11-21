import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {DEVILSTRAND_APPAREL_ITEMS_358,DEVILSTRAND_FABRIC_358,DEVILSTRAND_PLANT_358,DEVILSTRAND_RESEARCH_358,devilstrandUnlocked358,validDevilstrandTransport358} from '../src/sim/devilstrand-358.ts';
import {RESEARCH_SCALE,CLOTHING_RESEARCH_COST,needsHighTechBench,researchCost,researchPrerequisite,researchUnlocked,selectResearch} from '../src/sim/research.ts';
import {validDevilstrandResearchTransport358} from '../src/sim/research-save.ts';
import {PLANT_DEFINITIONS,plantGrowth} from '../src/sim/plants.ts';
import {CROP_KINDS,isCropKindInVersion} from '../src/sim/crops.ts';
import {growingPlantSowSkill291,growingPlantSowTicks291,isGrowingPlantInVersion291} from '../src/sim/forestry-content-291.ts';
import {jobDuration} from '../src/sim/farming.ts';
import {cropBlightable,infectCrop} from '../src/sim/plant-blight.ts';
import {hydroponicCropAllowed} from '../src/sim/hydroponics.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {APPAREL,APPAREL_MATERIALS,apparelItemFor,apparelInsulation,newApparelState} from '../src/sim/apparel-rules.ts';
import {validApparelShape} from '../src/sim/apparel-save.ts';
import {PRODUCTION_RECIPES,tailoringMaterialAllowed} from '../src/sim/production-recipes.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {createDefaultApparelPolicyRegistry,validApparelPolicy} from '../src/sim/apparel-policy.ts';
import {APPAREL_TRADE_279} from '../src/sim/apparel-trade-279.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {generateVisitorStock} from '../src/sim/trade-stock.ts';
import {orbitalWillTrade338} from '../src/sim/orbital-trade-338.ts';
import {pileFlammability,pileMaxHp} from '../src/sim/thing-damage-rules.ts';
import {commercialItemMassGrams} from '../src/sim/commercial-mass.ts';
import {DETERIORATION_RATES} from '../src/sim/deterioration-content.ts';
import {validConstructionMaterial} from '../src/sim/construction-materials.ts';
import {FURNITURE_MATERIALS,furnitureMaxHitPoints} from '../src/sim/furniture-stats.ts';
import {growingCultureChoices} from '../src/ui/growing-controls.ts';
import {SCHEMA_VERSION,TICKS_PER_DAY,type Command,type MaterialPile,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
function until(w:World,done:()=>boolean,limit=4000){
  for(let i=0;i<limit&&!done();i++)stepWorld(w);
  expect(done(),JSON.stringify({tick:w.tick,jobs:w.jobs.map(j=>({kind:j.kind,progress:j.progress,status:j.status})),pawn:w.pawns[0]!.state})).toBe(true);
  expect(validateWorld(w)).toEqual([]);
}
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
const researched=():World['research']=>({project:null,points:0,devilstrand:{points:DEVILSTRAND_RESEARCH_358.scaledCost,completedAt:0}});

test('Core facts: Devilstrand research, Plant_Devilstrand and DevilstrandCloth',()=>{
  expect(DEVILSTRAND_RESEARCH_358).toMatchObject({points:800,techLevel:'Neolithic'});
  expect(researchCost('devilstrand')).toBe(800*RESEARCH_SCALE);expect(needsHighTechBench('devilstrand')).toBe(false);
  // The crop: listed last, only from 358.
  expect(CROP_KINDS.at(-1)).toBe('devilstrand');
  expect(isCropKindInVersion('devilstrand',358)).toBe(true);expect(isCropKindInVersion('devilstrand',357)).toBe(false);
  expect(isGrowingPlantInVersion291('devilstrand',357)).toBe(false);
  expect(PLANT_DEFINITIONS.devilstrand).toMatchObject({growDays:22.5,minFertility:.5,sensitivity:1,afterHarvest:0,yield:6});
  expect(DEVILSTRAND_PLANT_358).toMatchObject({sowWorkCore:400,harvestWorkCore:200,sowMinSkill:10,maxHitPoints:85,nutrition:.2});
  expect(growingPlantSowSkill291('devilstrand')).toBe(10);expect(growingPlantSowTicks291('devilstrand')).toBe(40);
  // Ground only (sowTags Ground), never blighted.
  expect(hydroponicCropAllowed('devilstrand')).toBe(false);
  // The fabric: Textiles, stack 75, Core stuff powers.
  expect(ITEM_DEFINITIONS.devilstrand).toMatchObject({kind:'textile',stackLimit:75,color:0xb43c3c});
  expect(DEVILSTRAND_FABRIC_358).toMatchObject({marketValue:5.5,mass:.032,maxHitPoints:100,flammability:.4,deteriorationRate:3,coldInsulation:20,heatInsulation:24});
  expect(DEVILSTRAND_FABRIC_358.armor).toEqual({sharp:1.4,blunt:.36,heat:3});
  expect(DEVILSTRAND_FABRIC_358.stuffFactors).toEqual({flammability:.4,maxHitPoints:1.3,beauty:3.2});
  expect(tradeCatalogueEntry('devilstrand')).toMatchObject({baseMarketValue:5.5,playerCanBuy:true,playerCanSell:true});
  expect(commercialItemMassGrams('devilstrand')).toBe(32);expect(DETERIORATION_RATES.devilstrand).toBe(3);
  const bolt:Pick<MaterialPile,'kind'|'item'>={kind:'textile',item:'devilstrand'};
  expect(pileMaxHp(bolt)).toBe(100);expect(pileMaxHp(bolt,357)).toBe(0);expect(pileFlammability(bolt)).toBe(.4);
  // Orbital bulk goods handle the Textiles category; visitors and caravans have no Textiles stock here.
  expect(orbitalWillTrade338('bulk','devilstrand','buy')).toBe(true);expect(orbitalWillTrade338('exotic','devilstrand','buy')).toBe(false);
});

test('Fabric stuff: every textile garment family, the tuque included, with the Core factors applied',()=>{
  expect(APPAREL_MATERIALS.at(-1)).toBe('devilstrand');expect(APPAREL_MATERIALS).toHaveLength(23);
  expect(DEVILSTRAND_APPAREL_ITEMS_358).toHaveLength(10);
  for(const item of DEVILSTRAND_APPAREL_ITEMS_358){
    expect(APPAREL[item]).toMatchObject({material:'devilstrand'});expect(ITEM_DEFINITIONS[item]).toMatchObject({kind:'apparel',stackLimit:1,color:0xb43c3c});
    const family=APPAREL[item].family!;expect(apparelItemFor(family,'devilstrand')).toBe(item);
    expect(tailoringMaterialAllowed(family,'devilstrand')).toBe(true);
  }
  expect(PRODUCTION_RECIPES.tuque.inputs.at(-1)).toBe('devilstrand');expect(tailoringMaterialAllowed('tuque','devilstrand')).toBe(true);
  // Parka: 180 HP x 1.3, cold 20 x 2, armour 1.40/0.36/3.00 x 0.2.
  expect(APPAREL['devilstrand-parka']).toMatchObject({label:'Parka en soie du diable',hitPoints:234,coldInsulation:40,heatInsulation:0});
  expect(APPAREL['devilstrand-parka'].ratings.sharp).toBeCloseTo(.28,9);expect(APPAREL['devilstrand-parka'].ratings.blunt).toBeCloseTo(.072,9);
  expect(APPAREL['devilstrand-parka'].ratings.heat).toBeCloseTo(.6,9);
  // Duster: 200 HP x 1.3, heat 24 x 0.85, armour x 0.3.
  expect(APPAREL['devilstrand-duster']).toMatchObject({hitPoints:260});expect(APPAREL['devilstrand-duster'].heatInsulation).toBeCloseTo(20.4,9);
  expect(APPAREL['devilstrand-duster'].ratings.heat).toBeCloseTo(.9,9);
  expect(apparelInsulation({id:1,kind:'apparel',item:'devilstrand-tuque',quantity:1,owner:{type:'ground',x:0,z:0},apparel:newApparelState('devilstrand-tuque')})).toEqual({cold:10,heat:0});
  expect(APPAREL['devilstrand-tuque'].hitPoints).toBe(104);
  // Garment flammability: apparel 1.0 x devilstrand 0.4 (cloth garments stay 1.2).
  expect(pileFlammability({kind:'apparel',item:'devilstrand-shirt'})).toBe(.4);expect(pileFlammability({kind:'apparel',item:'cloth-shirt'})).toBe(1.2);
  // Core market value: stuff count x 5.5 + WorkToMake x 0.0036.
  expect(APPAREL_TRADE_279['devilstrand-duster'].baseMarketValue).toBeCloseTo(80*5.5+10000*.0036,9);
  expect(APPAREL_TRADE_279['devilstrand-tuque'].baseMarketValue).toBeCloseTo(20*5.5+1200*.0036,9);
  // Bedrolls take Fabric: HP x 1.3, beauty x 3.2, flammability x 0.4, from 358.
  expect(FURNITURE_MATERIALS.devilstrand).toMatchObject({category:'fabric',hitPointsFactor:1.3,beautyFactor:3.2,flammabilityFactor:.4,restFactor:1});
  expect(furnitureMaxHitPoints('bedroll','devilstrand')).toBeCloseTo(97.5,9);
  expect(validConstructionMaterial('bedroll','devilstrand',358)).toBe(true);expect(validConstructionMaterial('bedroll','devilstrand',357)).toBe(false);
  // Armchairs keep their two historical upholstery materials here.
  expect(validConstructionMaterial('armchair','devilstrand',358)).toBe(false);
});

test('Devilstrand is researched at a simple desk, then sown by a Plants 10 grower, grows through real days, saves mid-growth and is harvested into six devilstrand',()=>{
  const w=deconstructionCamp(1,32),p=w.pawns[0]!;
  delete p.background;delete p.traits;p.recreation.level=100;p.schedule.fill('work');
  for(const work of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[work]=0;
  p.priorities.research=1;p.priorities.grow=2;
  p.skills.intellectual={level:12,xp:0,dailyXp:0,passion:0};p.skills.plants={level:9,xp:0,dailyXp:0,passion:0};
  w.research={project:null,points:0};
  w.structures.push({id:w.nextId++,kind:'research-bench',x:12,z:4,orientation:0,footprint:'standard',material:'wood'} as Structure);
  // Declared upkeep for the weeks of the test: packaged meals and a bed spot.
  w.structures.push({id:w.nextId++,kind:'sleeping-spot',x:20,z:20,orientation:0,footprint:'standard'} as Structure);
  for(const x of [24,25,26,27,28,29])addGroundMaterial(w,'food',10,{x,z:24},'survival-meal');refreshStock(w);
  expect(validateWorld(w)).toEqual([]);
  const cell={x:7,z:4};
  accept(w,{type:'area',action:'growing',from:cell,to:cell});const zoneId=w.growingZones.at(-1)!.id;
  // Before the research the crop is neither listed nor accepted.
  expect(growingCultureChoices(w.growingZones.at(-1)!,w)).not.toContain('devilstrand');
  expect(applyCommand(w,{type:'growing-policy',zoneId,plant:'devilstrand',allowSow:true,allowCut:true}).ok).toBe(false);
  expect(researchPrerequisite(w,'devilstrand')).toBeUndefined();
  accept(w,{type:'research-project',project:'devilstrand'});expect(w.research!.devilstrand).toEqual({points:0});
  until(w,()=>(w.research!.devilstrand!.points)>0,600);
  // Declared prepared: the first 790 points stand for days of the same desk work.
  w.research!.devilstrand!.points=790*RESEARCH_SCALE;expect(validateWorld(w)).toEqual([]);
  until(w,()=>researchUnlocked(w,'devilstrand'),6000);
  expect(devilstrandUnlocked358(w)).toBe(true);expect(w.events.some(e=>e.message.includes('Soie du diable'))).toBe(true);
  expect(growingCultureChoices(w.growingZones.at(-1)!,w)).toContain('devilstrand');
  accept(w,{type:'growing-policy',zoneId,plant:'devilstrand',allowSow:true,allowCut:true});
  // Plants 9 is not enough to start sowing (Core sowMinSkill 10).
  for(let i=0;i<400;i++)stepWorld(w);
  expect(w.jobs.some(j=>j.kind==='sow'&&j.reservedBy===p.id)).toBe(false);expect(w.resources.some(r=>r.kind==='devilstrand')).toBe(false);
  p.skills.plants={level:10,xp:0,dailyXp:0,passion:0};
  until(w,()=>w.jobs.some(j=>j.kind==='sow'&&j.growingZoneId===zoneId&&j.progress>0),1200);
  const sow=w.jobs.find(j=>j.kind==='sow'&&j.growingZoneId===zoneId)!;expect(jobDuration(w,sow)).toBe(40);
  until(w,()=>w.resources.some(r=>r.kind==='devilstrand'),1200);
  const plant=w.resources.find(r=>r.kind==='devilstrand')!,plantId=plant.id;
  expect(plant).toMatchObject({...cell,kind:'devilstrand',amount:6});expect(plant.growth).toBeLessThan(.01);
  expect(cropBlightable(w,plant)).toBe(false);expect(infectCrop(w,plant,358)).toBe(false);
  // Two real days of growth; then a save resumes exactly.
  accept(w,{type:'growing-policy',zoneId,allowSow:false,allowCut:true});p.priorities.grow=0;
  const start=plantGrowth(w,plant);stepWorld(w,2*TICKS_PER_DAY);expect(validateWorld(w)).toEqual([]);
  const grown=plantGrowth(w,plant);expect(grown).toBeGreaterThan(start);
  // At most 2 x 3301 growing ticks of a 22.5-day crop at full fertility.
  expect(grown-start).toBeLessThanOrEqual(2*3301/(22.5*TICKS_PER_DAY)+1e-9);
  const saved=serializeWorld(w),resumed=deserializeWorld(saved);expect(serializeWorld(resumed)).toBe(saved);
  stepWorld(w,TICKS_PER_DAY/2);stepWorld(resumed,TICKS_PER_DAY/2);expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  expect(plantGrowth(w,w.resources.find(r=>r.id===plantId)!)).toBeLessThan(1);
  // Declared prepared maturity checkpoint (the remaining weeks of growth), then
  // a real harvest; Plants 8 keeps the Core harvest yield factor at 1.
  const live=w.resources.find(r=>r.id===plantId)!;live.growth=1;live.growthTick=w.tick;p.skills.plants={level:8,xp:0,dailyXp:0,passion:0};p.priorities.grow=2;
  until(w,()=>!w.resources.some(r=>r.id===plantId)&&quantity(w,'devilstrand')===6,2000);
  expect(w.piles.find(q=>q.item==='devilstrand')).toMatchObject({kind:'textile',quantity:6,owner:{type:'ground'}});
  const final=serializeWorld(w);expect(serializeWorld(deserializeWorld(final))).toBe(final);
},180_000);

test('a real tailor makes a devilstrand parka from 80 devilstrand and wears it; the save resumes exactly',()=>{
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.craft=1;pawn.priorities.tailor=1;pawn.schedule.fill('work');pawn.apparelAutomation=false;
  pawn.skills.crafting={level:8,xp:0,dailyXp:0,passion:1};
  w.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0};
  const bench:Structure={id:w.nextId++,kind:'tailor-bench',x:10,z:10,orientation:0,footprint:'standard',material:'wood',bills:[]};
  w.structures.push(bench);addGroundMaterial(w,'textile',75,{x:12,z:12},'devilstrand');addGroundMaterial(w,'textile',5,{x:13,z:12},'devilstrand');refreshStock(w);
  expect(validateWorld(w)).toEqual([]);
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'parka'});
  expect(bench.bills!.at(-1)!.filters.devilstrand).toBe(true);
  until(w,()=>!!w.piles.find(p=>p.unfinished?.recipe==='parka')?.unfinished?.progress);
  const work=w.piles.find(p=>p.unfinished?.recipe==='parka')!;expect(work.unfinished).toMatchObject({authorId:pawn.id,material:'devilstrand',units:80});
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>w.piles.some(p=>p.item==='devilstrand-parka'&&p.owner.type==='ground'));stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  const product=w.piles.find(p=>p.item==='devilstrand-parka')!;expect(product.apparel).toMatchObject({material:'devilstrand',hitPoints:234});
  expect(quantity(w,'devilstrand')).toBe(0);
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:product.id,action:'wear',queue:false});until(w,()=>product.owner.type==='apparel');
  // Cold 20 x 2 against cloth 18 x 2, at the same crafted quality.
  const cloth={...product,item:'cloth-parka',apparel:{...product.apparel!,material:'cloth' as const}} as MaterialPile;
  expect(apparelInsulation(product).cold/apparelInsulation(cloth).cold).toBeCloseTo(40/36,9);
  expect(validateWorld(w)).toEqual([]);
});

test('visitors, caravans and orbital ships draw Core DevilstrandCloth garments from 358 with the same random draws',()=>{
  let found=0;
  for(let seed=1;seed<4000&&found<2;seed++){
    const now=generateVisitorStock(seed,1,100,0,358),before=generateVisitorStock(seed,1,100,0,357);
    expect(now.rng).toBe(before.rng);
    const garment=now.piles.find(p=>p.item.startsWith('devilstrand-'));
    if(!garment)continue;found++;
    expect(garment.apparel).toMatchObject({material:'devilstrand'});
    // The same roll gave no garment before 358 (Core's third Fabric row had no item).
    expect(before.piles.length).toBe(now.piles.length-1);
  }
  expect(found).toBe(2);
});

test('new games allow devilstrand garments; before 358 every devilstrand thing is refused, and a 357 save migrates by its number only',()=>{
  const policy=createDefaultApparelPolicyRegistry().apparelPolicies[0]!;
  expect(policy.allowedItems).toEqual(expect.arrayContaining([...DEVILSTRAND_APPAREL_ITEMS_358]));expect(policy.allowedMaterials.at(-1)).toBe('devilstrand');
  expect(validApparelPolicy(policy,SCHEMA_VERSION)).toBe(true);expect(validApparelPolicy(policy,357)).toBe(false);
  const legacy=createDefaultApparelPolicyRegistry(true,true,true,true,false,true,true,true,true,false).apparelPolicies[0]!;
  expect(legacy.allowedItems.some(i=>i.startsWith('devilstrand'))).toBe(false);expect(legacy.allowedMaterials).not.toContain('devilstrand');expect(validApparelPolicy(legacy,357)).toBe(true);
  const garment={id:1,kind:'apparel',item:'devilstrand-shirt',quantity:1,owner:{type:'ground',x:1,z:1},apparel:newApparelState('devilstrand-shirt')} as unknown as Record<string,unknown>;
  expect(validApparelShape(garment,SCHEMA_VERSION)).toBe(true);expect(validApparelShape(garment,357)).toBe(false);
  const bill=newCookingBill(1,'tuque'),old=newCookingBill(2,'tuque',357);
  expect(bill.filters.devilstrand).toBe(true);expect(Object.hasOwn(old.filters,'devilstrand')).toBe(false);
  expect(validBillSettings(old,'tuque',SCHEMA_VERSION)).toBe(true);expect(validBillSettings(bill,'tuque',357)).toBe(false);
  // Research: refused below 358, and a zone set to devilstrand needs it.
  const w=deconstructionCamp(1,32);w.research={project:null,points:0};
  const old357=deconstructionCamp(1,32);old357.schemaVersion=357 as World['schemaVersion'];old357.research={project:null,points:0};
  expect(selectResearch(old357,'devilstrand').ok).toBe(false);expect(old357.research.devilstrand).toBeUndefined();
  w.growingZones.push({id:w.nextId++,cells:[4*w.width+7],plant:'devilstrand',allowSow:true,allowCut:true});
  expect(validDevilstrandResearchTransport358(w,358)).toBe(false);w.research=researched();
  expect(validDevilstrandResearchTransport358(w,358)).toBe(true);expect(validDevilstrandResearchTransport358(w,357)).toBe(false);
  expect(validateWorld(w)).toEqual([]);
  // A 357 (or 356) save holding a zone, a plant, the fabric or a garment is refused.
  w.resources.push({id:w.nextId++,kind:'devilstrand',x:7,z:4,amount:6,growth:.5,growthTick:w.tick});
  addGroundMaterial(w,'textile',10,{x:2,z:2},'devilstrand');refreshStock(w);expect(validateWorld(w)).toEqual([]);
  const current=serializeWorld(w);
  for(const version of [356,357]){
    expect(validDevilstrandTransport358(JSON.parse(current),version)).toBe(false);
    expect(()=>deserializeWorld(asOldSchema(current,version))).toThrow();
  }
  for(const strip of [(x:World)=>{x.growingZones=x.growingZones.filter(z=>z.plant!=='devilstrand');},(x:World)=>{x.resources=x.resources.filter(r=>r.kind!=='devilstrand');},(x:World)=>{x.piles=x.piles.filter(q=>q.item!=='devilstrand');}]){
    const one=deserializeWorld(current);strip(one);delete one.research!.devilstrand;
    expect(()=>deserializeWorld(asOldSchema(serializeWorld(one),357))).toThrow();
  }
  // A 357 save without devilstrand migrates by its number only: no research,
  // no plant, no item, no garment in its policies (unlike a new game).
  const plain=deconstructionCamp(1,32);plain.research={project:null,points:0};
  const migrated=deserializeWorld(asOldSchema(serializeWorld(plain),357));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(migrated.research!.devilstrand).toBeUndefined();
  expect(migrated.apparelPolicies!.some(p=>p.allowedItems.some(i=>i.startsWith('devilstrand'))||p.allowedMaterials.some(m=>m==='devilstrand'))).toBe(false);
  expect(validateWorld(migrated)).toEqual([]);
  expect(serializeWorld(deserializeWorld(serializeWorld(migrated)))).toBe(serializeWorld(migrated));
  const relabelled=serializeWorld(plain).replace(`{"schemaVersion":${SCHEMA_VERSION},`,'{"schemaVersion":357,');
  expect(()=>deserializeWorld(relabelled)).toThrow();
});
