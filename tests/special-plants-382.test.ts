import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health.ts';
import {prepareConstructionFlora} from './scenarios/construction-flora-v348.ts';
import {createWildPlantResource256} from '../src/sim/wild-plant-acquisition-v256.ts';
import {createPlantLife,applyPlantFrost} from '../src/sim/plant-life.ts';
import {gatherResource} from '../src/sim/gathering.ts';
import {damageResource} from '../src/sim/thing-damage.ts';
import {choppable,harvestable,plantGrowth,createPlantGrowthReader} from '../src/sim/plants.ts';
import {isPlantSpeciesInVersion,FLORA_DEFINITIONS} from '../src/sim/biome-flora.ts';
import {isCropKindInVersion,cropProduct} from '../src/sim/crops.ts';
import {ITEM_DEFINITIONS,mealQuantity} from '../src/sim/items.ts';
import {growingPlantSowTicks291} from '../src/sim/forestry-content-291.ts';
import {hydroponicCropAllowed} from '../src/sim/hydroponics.ts';
import {runtimePlantDef256,runtimePlantNonStump382} from '../src/sim/wild-plant-runtime-256.ts';
import {validPlantLife} from '../src/sim/plant-life-save.ts';
import {resourceMaxHp,resourceFlammability,pileMaxHp,pileFlammability} from '../src/sim/thing-damage-rules.ts';
import {freshRot,ROT_DAYS} from '../src/sim/food-preservation.ts';
import {DETERIORATION_RATES} from '../src/sim/deterioration-content.ts';
import {commercialItemMassGrams} from '../src/sim/commercial-mass.ts';
import {validatePileRecordShape} from '../src/sim/material-record-save.ts';
import {validStorageItems} from '../src/sim/storage-filters.ts';
import {DEAD_STUMP_FACTS_382} from '../src/sim/native-special-plants-382.ts';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization.ts';
import {refreshStock} from '../src/sim/materials.ts';
import type {Resource} from '../src/sim/types.ts';
import {DEAD_PLANT_MAP,PLANT_MAP,zonePlant} from '../src/import/rimworld/map-plants.ts';
import {ITEM_MAP} from '../src/import/rimworld/map-items.ts';

function camp(){const w=medicalCamp();prepareConstructionFlora(w);if(w.flora?.revision!==1)throw Error('Test requires historical flora owner');w.flora.capacity=12;return w;}
test('Core special plants and their actual products do not exist in pre382 saves',()=>{
 expect(isCropKindInVersion('tinctoria',381)).toBe(false);expect(isCropKindInVersion('tinctoria',382)).toBe(true);
 for(const species of ['ambrosia','burned-stump','chopped-stump','smashed-stump']){expect(isPlantSpeciesInVersion(species,381)).toBe(false);expect(isPlantSpeciesInVersion(species,382)).toBe(true);}
 expect(cropProduct('tinctoria')).toBe('dye');expect(growingPlantSowTicks291('tinctoria')).toBe(54);expect(hydroponicCropAllowed('tinctoria')).toBe(true);
 expect(FLORA_DEFINITIONS.ambrosia).toMatchObject({growDays:6,sensitivity:.15,minFertility:.7,harvestMinGrowth:.65,hitPoints:100,yield:4,persistent:true});
 expect(ITEM_DEFINITIONS.ambrosia).toMatchObject({stackLimit:150,nutrition:20,kind:'drug'});expect(ITEM_DEFINITIONS.dye).toMatchObject({stackLimit:75,nutrition:0,kind:'dye'});
 expect(ROT_DAYS.ambrosia).toBe(30);expect(DETERIORATION_RATES.ambrosia).toBe(4);expect(DETERIORATION_RATES.dye).toBe(1);
 expect(commercialItemMassGrams('ambrosia',382)).toBe(100);expect(commercialItemMassGrams('dye',382)).toBe(300);
 expect(commercialItemMassGrams('ambrosia',381)).toBeUndefined();
 expect(pileMaxHp({kind:'dye',item:'dye'},382)).toBe(50);expect(pileFlammability({kind:'dye',item:'dye'})).toBe(1);
 expect(validStorageItems({dye:true,ambrosia:true},381)).toBe(false);expect(validStorageItems({dye:true,ambrosia:true},382)).toBe(true);
 expect(PLANT_MAP.Plant_Ambrosia).toMatchObject({to:{wild:'ambrosia'}});expect(PLANT_MAP.Plant_Tinctoria).toMatchObject({to:{crop:'tinctoria'}});
 expect(zonePlant('Plant_Tinctoria')).toMatchObject({to:'tinctoria'});expect(DEAD_PLANT_MAP.SmashedStump).toMatchObject({to:{wild:'smashed-stump'}});
 expect(ITEM_MAP.Dye).toMatchObject({to:'dye'});
});

test('ambrosia is an actual persistent harvest, tinctoria produces dye then disappears',()=>{
 const w=camp(),a=createWildPlantResource256(w,w.nextId++,7,8,'ambrosia',1,true)!;
 const t:Resource={id:w.nextId++,x:10,z:8,kind:'tinctoria',amount:1,growth:1,growthTick:w.tick};t.plantLife=createPlantLife(w,t,true);
 w.resources=[a,t];
 // Fixture lacks colonist crop difficulty. Ratios are checked literally under its profile.
 expect(harvestable(w,a)).toBe(true);expect(harvestable(w,t)).toBe(true);
 expect(gatherResource(w,a,'harvest')).toBe(4);expect(a.growth).toBe(.3);expect(w.resources).toContain(a);
 expect(gatherResource(w,t,'harvest')).toBe(1);expect(w.resources).not.toContain(t);
 const fruit=w.piles.find(p=>p.item==='ambrosia')!,dye=w.piles.find(p=>p.item==='dye')!;
 expect(fruit).toMatchObject({kind:'drug',quantity:4,rot:freshRot('ambrosia',w.tick).rot});expect(dye).toMatchObject({kind:'dye',quantity:1});
 expect(mealQuantity(w.pawns[0]!,fruit,4)).toBe(0);expect(validPlantLife(a,382,w)).toBe(true);
 expect(validatePileRecordShape(fruit as never,w,382)).toEqual([]);expect(validatePileRecordShape(fruit as never,w,381).length).toBeGreaterThan(0);
 refreshStock(w);expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

test('a cultivated tinctoria uses the same cached/uncached 30% glow integral',()=>{
 const w=camp(),t:Resource={id:w.nextId++,x:7,z:8,kind:'tinctoria',amount:1,growth:.2,growthTick:w.tick-1000};
 const rice:Resource={...t,id:w.nextId++,kind:'rice',amount:6};
 expect(createPlantGrowthReader(w)(t)).toBe(plantGrowth(w,t));expect(plantGrowth(w,t)).toBeGreaterThan(plantGrowth(w,rice));
});

test('actual DeadPlant retains growth, cover identity, frosty health and yields wood instead of new foliage',()=>{
 const w=camp();for(const species of Object.keys(DEAD_STUMP_FACTS_382) as (keyof typeof DEAD_STUMP_FACTS_382)[]){
  const stump=createWildPlantResource256(w,w.nextId++,6,7,species,.8,false)!;w.resources=[stump];
  expect(resourceMaxHp(stump)).toBe(100);expect(resourceFlammability(stump)).toBe(0);expect(runtimePlantDef256(stump)).toBe(DEAD_STUMP_FACTS_382[species].defId);expect(runtimePlantNonStump382(stump)).toBe(false);
  expect(choppable(w,stump)).toBe(true);expect(harvestable(w,stump)).toBe(false);expect(plantGrowth(w,stump)).toBe(.8);expect(createPlantGrowthReader(w)(stump)).toBe(.8);
  expect(applyPlantFrost(w,stump,true,-70)).toBe(false);expect(stump.plantLife?.leaflessAt).toBeUndefined();
  const count=gatherResource(w,stump,'chop');expect(count).toBeGreaterThan(0);expect(w.resources).toEqual([]);
 }
});

test('mature native trees create exactly one stump on real chop or destruction; young trees do not',()=>{
 const w=camp();const oak=()=>createWildPlantResource256(w,w.nextId++,7,8,'oak',1,true)!;
 const adult=oak();w.resources=[adult];expect(gatherResource(w,adult,'chop')).toBe(46);
 const chopped=w.resources[0]!;expect(chopped).toMatchObject({kind:'wild-plant',species:'chopped-stump',growth:1,amount:4});expect(chopped.id).not.toBe(adult.id);expect((chopped.damage??0)).toBeLessThanOrEqual(50);
 expect(validPlantLife(chopped,382,w)).toBe(true);expect(gatherResource(w,chopped,'chop')).toBeGreaterThan(0);expect(w.resources).toEqual([]);
 const burned=oak();w.resources=[burned];expect(damageResource(w,burned,200,'fire')).toBe(true);expect(w.resources).toHaveLength(1);expect(w.resources[0]?.species).toBe('burned-stump');
 const young=oak();young.growth=.01;w.resources=[young];expect(damageResource(w,young,200,'fire')).toBe(true);expect(w.resources).toEqual([]);
});
