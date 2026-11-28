import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {validateWorld,serializeCampaignUnchecked,deserializeCampaign} from '../src/sim/serialization.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {animalCore256} from '../src/sim/animal-core-v256.ts';
import {animalDietFlags256,animalPlantDiet256,animalItemDiet256} from '../src/sim/animal-diet-v256.ts';
import {animalSpecies,isAnimalSpeciesInVersion} from '../src/sim/animal-species.ts';
import {animalBodySize,animalNutritionMax,gestationTicks} from '../src/sim/animal-life.ts';
import {animalProductDefinition,productFullness} from '../src/sim/animal-products.ts';
import {naturalArmor321} from '../src/sim/natural-armor-321.ts';
import {validAutoSlaughterConfig} from '../src/sim/auto-slaughter-save.ts';
import {defaultAutoSlaughterConfig} from '../src/sim/auto-slaughter-state.ts';
import {autoSlaughterTargets} from '../src/sim/auto-slaughter.ts';
import {animalMarketValue261} from '../src/sim/caravan-animal-value-261.ts';
import {newCookingBill} from '../src/sim/cooking-bills.ts';
import {unavailableEcologyItem} from '../src/sim/cave-products-256.ts';
import {thrumboHornFromCorpse382,type CorpseState} from '../src/sim/corpses.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {animalToolParts256} from '../src/sim/animal-anatomy-v256.ts';
import {resolveSelectedThrumboPasses382,eligibleThrumboPasses382} from '../src/sim/thrumbo-passes-382.ts';
import {weaponMaxHitPoints} from '../src/sim/equipment-rules.ts';
import {validWeaponShape} from '../src/sim/equipment-save.ts';
import {pileMarketValue} from '../src/sim/trade-prices.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {initialFoodPolicies,validAllowedFood} from '../src/sim/food-policy.ts';

const base=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const actor=(species:string,id:number,x:number,z:number,extra='',female=false)=>`<thing Class="Pawn"><def>${species}</def><id>${species}${id}</id><map>0</map><pos>(${x},0,${z})</pos><faction>Faction_1</faction>${female?'<gender>Female</gender>':''}<ageTracker><ageBiologicalTicks>8000009</ageBiologicalTicks><growth>1</growth><nextGrowthCheckTick>9223372036854775807</nextGrowthCheckTick></ageTracker>${extra}</thing>`;

it('admits actual Core goat, pig and thrumbo instead of substituted races, with production and original body facts',()=>{
 const source=base.replace('</things>',`${actor('Goat',300,17,8,'<milkFullness>0.6</milkFullness>',true)}${actor('Pig',301,18,8)}${actor('Thrumbo',302,18,9)}</things>`),conversion=convertRwsSave(readRwsSave(source),{planet:false}),w=conversion.world;
 const get=(sourceId:string)=>w.wildlife!.animals.find(a=>a.id===conversion.thingIds.get(sourceId))!;
 const goat=get('Goat300'),pig=get('Pig301'),thrumbo=get('Thrumbo302');
 expect([goat.species,pig.species,thrumbo.species]).toEqual(['goat','pig','thrumbo']);
 expect(animalBodySize(goat)).toBe(.75);expect(animalNutritionMax(pig)).toBeCloseTo(1.7,6);expect(animalCore256('thrumbo').race.baseHealthScale).toBe(8);
 expect(animalSpecies('goat').corpseItem).toBe('goat-corpse');expect(animalSpecies('pig').meatItem).toBe('pig-meat');expect(animalSpecies('thrumbo').leatherItem).toBe('thrumbofur');
 expect(naturalArmor321(thrumbo)).toEqual({sharp:.6,blunt:.4,heat:.3});expect(animalMarketValue261(pig)).toEqual({ok:true,value:200});
 expect(animalProductDefinition(goat)).toMatchObject({item:'milk',quantity:12,days:3,femaleOnly:true});expect(productFullness(goat)).toBe(.6);
 expect(gestationTicks('goat')).toBe(33660);expect(gestationTicks('pig')).toBe(33966);expect(gestationTicks('thrumbo')).toBe(120000);
 expect(animalDietFlags256('goat')).toBe(0x1f51);expect(animalItemDiet256(pig,'pig-meat')).toBe(true);expect(animalPlantDiet256(goat,true)).toBe(false);expect(animalPlantDiet256(thrumbo,true)).toBe(true);
 expect(validateWorld(w)).toEqual([]);
 for(let i=0;i<40;i++)stepWorld(w);
 expect(productFullness(goat)).toBeGreaterThan(.6);expect(validateWorld(w)).toEqual([]);
 const text=serializeCampaignUnchecked(w),restored=deserializeCampaign(text);expect(serializeCampaignUnchecked(restored)).toBe(text);
});

it('adult horn is an actual present anatomical part; imports the separate physical melee weapon',()=>{
 const source=base.replace('</things>','<thing Class="ThingWithComps"><def>ThrumboHorn</def><id>ThrumboHorn302</id><map>0</map><pos>(18,0,9)</pos><health>132</health></thing></things>'),{world:w}=convertRwsSave(readRwsSave(source),{planet:false});
 const horn=w.piles.find(p=>p.item==='thrumbo-horn')!;
 expect(horn.weapon).toMatchObject({hitPoints:132,quality:'normal'});expect(weaponMaxHitPoints('thrumbo-horn')).toBe(150);expect(validWeaponShape(horn as unknown as Record<string,unknown>,382)).toBe(true);
 expect(pileMarketValue({...horn,weapon:{hitPoints:150,quality:'normal'}})).toBe(800);
 const c:CorpseState={species:'thrumbo',animalId:1,ageTicks:1000000,sex:'male',health:{...createMedicalRecord(w.tick),body:'thrumbo',animalBirthTick:w.tick-1000000}};
 expect(thrumboHornFromCorpse382(c)).toBe(1);expect(thrumboHornFromCorpse382({...c,ageTicks:1})).toBe(0);
 const part=animalToolParts256('QuadrupedAnimalWithHoovesAndHorn','HornAttackTool')[0]!;c.health.missing=[{part,bornAt:0} as typeof c.health.missing[number]];expect(thrumboHornFromCorpse382(c)).toBe(0);
 expect(validateWorld(w)).toEqual([]);
});

it('rare thrumbos arrive wild, receive a common deadline and leave independently of hunger',()=>{
 const w=createScenarioWorld(42,32,'crashlanded');
 expect(resolveSelectedThrumboPasses382(w,12345)).toBe(true);
 const visiting=w.wildlife!.animals.filter(a=>a.exitAtCore382!==undefined),ids=new Set(visiting.map(a=>a.id));expect(visiting.length).toBeGreaterThanOrEqual(2);expect(visiting.length).toBeLessThanOrEqual(6);
 expect(new Set(visiting.map(a=>a.exitAtCore382)).size).toBe(1);expect(visiting.every(a=>!a.domestic&&a.exitAtCore382!>=w.tick*10+90000&&a.exitAtCore382!<=w.tick*10+150000)).toBe(true);
 expect(eligibleThrumboPasses382(w)).toBe(false);
 expect(validateWorld(w)).toEqual([]);
 for(const animal of visiting){animal.exitAtCore382=w.tick*10+10;animal.food=animalNutritionMax(animal);animal.rest=1;}
 for(let i=0;i<300&&w.wildlife!.animals.some(a=>ids.has(a.id));i++)stepWorld(w);
 expect(w.wildlife!.animals.some(a=>ids.has(a.id))).toBe(false);expect(validateWorld(w)).toEqual([]);
});

it('retains sparse quotas of newly admitted species, protects bonded animals by default and gates predecessor data',()=>{
 const source=base.replace('</things>',`${actor('Pig',301,18,8)}${actor('Pig',302,17,8)}</things><autoSlaughterManager><configs><li><animal>Pig</animal><maxMales>1</maxMales><allowSlaughterBonded>True</allowSlaughterBonded></li></configs></autoSlaughterManager>`),{world:w,thingIds}=convertRwsSave(readRwsSave(source),{planet:false});
 const target=w.wildlife!.animals.find(a=>a.id===thingIds.get('Pig301'))!;
 expect(w.autoSlaughter).toEqual([{...defaultAutoSlaughterConfig('pig'),maxMales:1,allowBonded382:true}]);
 expect(autoSlaughterTargets(w).size).toBe(1);
 target.startingPet={name:'Cochon',bondedPawnId:w.pawns[0]!.id} as typeof target.startingPet;
 delete w.autoSlaughter![0]!.allowBonded382;
 expect(autoSlaughterTargets(w).size).toBe(0);
 for(const species of ['goat','pig','thrumbo'] as const){expect(isAnimalSpeciesInVersion(species,381)).toBe(false);expect(isAnimalSpeciesInVersion(species,382)).toBe(true);}
 expect(validAutoSlaughterConfig(defaultAutoSlaughterConfig('pig'),381)).toBe(false);expect(validAutoSlaughterConfig(defaultAutoSlaughterConfig('pig'),382)).toBe(true);
 for(const item of ['goat-corpse','pig-corpse','thrumbo-corpse','goat-meat','thrumbo-meat','thrumbofur']){expect(unavailableEcologyItem(item,381)).toBe(true);expect(unavailableEcologyItem(item,382)).toBe(false);}
 expect(newCookingBill(1,'simple-meal',381).filters['goat-meat']).toBeUndefined();expect(newCookingBill(1,'simple-meal',382).filters['goat-meat']).toBe(true);
 const policies=(version:number)=>initialFoodPolicies(true,true,true,true,true,true,true,true,true,true,version)[0]!.allowed;
 expect(policies(381)).not.toContain('goat-meat');expect(policies(381)).not.toContain('ambrosia');expect(policies(382)).toContain('goat-meat');expect(policies(382)).toContain('thrumbo-meat');
 expect(validAllowedFood(['goat-meat'],381)).toBe(false);expect(validAllowedFood(['goat-meat'],382)).toBe(true);
});
