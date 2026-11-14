import { expect,test } from 'vitest';
import { footprintCells,footprintContains } from '../src/sim/definitions.ts';
import { constructionRecipe,constructionSkillRequired,validConstructionMaterial } from '../src/sim/construction-materials.ts';
import { ITEM_DEFINITIONS,legacyItem } from '../src/sim/items.ts';
import { commercialItemMassGrams } from '../src/sim/commercial-mass.ts';
import { tradeCatalogueEntry } from '../src/sim/trade-catalogue.ts';
import { tradeRefusal,pileMarketValue } from '../src/sim/trade-prices.ts';
import { newBuildingFuel,fuelItem,fuelLimit } from '../src/sim/fuel.ts';
import { isElectrical,isFlickable,isPowerActive,powerDemand,powerWatts } from '../src/sim/power-rules.ts';
import { isPowerConnector,isPowerTransmitter } from '../src/sim/power-grid.ts';
import { breakdownEligible,canBreakdownNow } from '../src/sim/breakdowns.ts';
import { isRainElectricalKind } from '../src/sim/rain-electric.ts';
import { empStructureSupported } from '../src/sim/emp-state.ts';
import { pileMaxHp,pileFlammability,structureMaxHp,structureFlammability } from '../src/sim/thing-damage-rules.ts';
import { STRUCTURE_SHOT_FILL } from '../src/sim/combat-content.ts';
import { storageAccepts,validStorageItems } from '../src/sim/storage-filters.ts';
import { biofuelRefiningUnlocked,BIOFUEL_RESEARCH_COST,selectResearch,researchCost } from '../src/sim/research.ts';
import { structureRoomMarketValue,structureRoomStandable } from '../src/sim/room-market-value.ts';
import { structureBeauty } from '../src/sim/room-beauty.ts';
import { WIND_BLOCKERS } from '../src/sim/wind-rules.ts';
import { minifiable } from '../src/sim/furniture-rules.ts';
import { biofuelCamp } from './helpers/biofuel-v283.ts';
import type { MaterialPile,Structure } from '../src/sim/types.ts';

test('refinery footprint occupies six rotated cells and the generator stays at four',()=>{
  const {world,refineryId,generatorId}=biofuelCamp();
  const refinery=world.structures.find(s=>s.id===refineryId)!,generator=world.structures.find(s=>s.id===generatorId)!;
  for(const orientation of [0,1,2,3] as const){
    const rotated={...refinery,orientation},cells=footprintCells(rotated);
    expect(cells).toHaveLength(6);expect(new Set(cells.map(c=>`${c.x}:${c.z}`)).size).toBe(6);
    for(let z=refinery.z-2;z<=refinery.z+2;z++)for(let x=refinery.x-2;x<=refinery.x+2;x++)expect(footprintContains(rotated,{x,z})).toBe(cells.some(c=>c.x===x&&c.z===z));
  }
  expect(footprintCells(generator)).toEqual([{x:19,z:13},{x:20,z:13},{x:19,z:14},{x:20,z:14}]);
});
test('construction consumes fixed steel and three components with the Core work conversion',()=>{
  expect(constructionRecipe({kind:'biofuel-refinery',material:'steel'})).toEqual({ingredients:[{item:'steel',quantity:150},{item:'component',quantity:3}],work:200,coreWork:2000});
  expect(constructionRecipe({kind:'chemfuel-generator',material:'steel'})).toEqual({ingredients:[{item:'steel',quantity:100},{item:'component',quantity:3}],work:250,coreWork:2500});
  expect(constructionSkillRequired('biofuel-refinery')).toBe(4);expect(constructionSkillRequired('chemfuel-generator',310)).toBe(0);expect(constructionSkillRequired('chemfuel-generator')).toBe(6);
  for(const kind of ['biofuel-refinery','chemfuel-generator']){expect(validConstructionMaterial(kind,'steel',217)).toBe(false);expect(validConstructionMaterial(kind,'wood',218)).toBe(false);expect(minifiable(kind)).toBe(false);}
});
test('chemfuel has physical nonfood quantity, mass, damage and market value without merchant acquisition',()=>{
  const pile:MaterialPile={id:1,item:'chemfuel',kind:'chemfuel',quantity:150,owner:{type:'ground',x:1,z:1}};
  expect(ITEM_DEFINITIONS.chemfuel).toMatchObject({kind:'chemfuel',stackLimit:150,nutrition:0,maxIngest:0});
  expect(legacyItem('chemfuel')).toBe('chemfuel');expect(commercialItemMassGrams('chemfuel')).toBe(50);
  expect(pileMaxHp(pile)).toBe(50);expect(pileFlammability(pile)).toBe(2);expect(pileMarketValue(pile)).toBe(2.3);
  expect(tradeCatalogueEntry('chemfuel')).toMatchObject({baseMarketValue:2.3,playerCanBuy:false,playerCanSell:false,visitorHandles:false});
  expect(tradeRefusal(pile,'buy',3000)).toBeTruthy();expect(tradeRefusal(pile,'sell',3000)).toBeTruthy();
});
test('old category-only storage refuses chemfuel and explicit item rules still narrow its new category',()=>{
  const old={filters:{wood:true,food:true}};
  expect(storageAccepts(old,'chemfuel')).toBe(false);expect(storageAccepts({...old,filters:{...old.filters,chemfuel:true}},'chemfuel')).toBe(true);
  expect(storageAccepts({...old,filters:{...old.filters,chemfuel:true},items:{wood:true}},'chemfuel')).toBe(false);
  expect(validStorageItems({chemfuel:true},217)).toBe(false);expect(validStorageItems({chemfuel:false},218)).toBe(true);
});
test('fuel types are selected by building and new generator reserve starts empty',()=>{
  expect(fuelItem('chemfuel-generator')).toBe('chemfuel');expect(fuelItem('wood-generator')).toBe('wood');expect(fuelItem('fueled-stove')).toBe('wood');
  expect(fuelLimit('chemfuel-generator')).toBe(18000);expect(newBuildingFuel('chemfuel-generator')).toEqual({ticks:0,burned:0,autoRefuel:true,burnRemainder:0});
  expect(newBuildingFuel('wood-generator')).toEqual({ticks:0,burned:0,autoRefuel:true,burnRemainder:0});
});
test('refinery uses 170 watts and filled generator supplies 1000 through the common physical switch',()=>{
  const {world,refineryId,generatorId}=biofuelCamp(),refinery=world.structures.find(s=>s.id===refineryId)!,generator=world.structures.find(s=>s.id===generatorId)!;
  expect(powerDemand(refinery)).toBe(170);expect(isPowerConnector(refinery.kind)).toBe(true);expect(isPowerTransmitter(generator.kind)).toBe(true);
  for(const s of [refinery,generator]){expect(isElectrical(s.kind)).toBe(true);expect(isFlickable(s.kind)).toBe(true);}
  generator.power!.on=true;expect(isPowerActive(generator)).toBe(false);expect(powerWatts(generator,world)).toBe(0);
  generator.fuel!.ticks=600;expect(powerWatts(generator,world)).toBe(1000);generator.power!.switchOn=false;expect(powerWatts(generator,world)).toBe(0);
});
test('new devices inherit their distinct panne, rain and EMP eligibility',()=>{
  const {world,refineryId,generatorId}=biofuelCamp(),refinery=world.structures.find(s=>s.id===refineryId)!,generator=world.structures.find(s=>s.id===generatorId)!;
  expect(breakdownEligible(refinery)).toBe(true);expect(breakdownEligible(generator)).toBe(true);
  refinery.power!.on=false;expect(canBreakdownNow(refinery)).toBe(false);expect(canBreakdownNow(generator)).toBe(true);
  expect(isRainElectricalKind(refinery.kind)).toBe(true);expect(isRainElectricalKind(generator.kind)).toBe(false);
  expect(empStructureSupported(generator.kind)).toBe(true);expect(empStructureSupported(refinery.kind)).toBe(false);
});
test('research gates only the refinery and never grants fuel or a new tank',()=>{
  const {world,generatorId}=biofuelCamp(),generator=world.structures.find(s=>s.id===generatorId)!,before=structuredClone(generator);
  expect(biofuelRefiningUnlocked(world)).toBe(true);expect(researchCost('biofuel-refining')).toBe(BIOFUEL_RESEARCH_COST);
  delete world.research!.biofuelRefining;expect(selectResearch(world,'biofuel-refining')).toEqual({ok:true});
  expect(world.research!.biofuelRefining).toEqual({points:0});expect(generator).toEqual(before);
});
test('fixed machine physical and room catalogues preserve provenance instead of applying steel stuff multipliers',()=>{
  const refinery:Structure={id:1,kind:'biofuel-refinery',x:1,z:1,orientation:0,footprint:'standard',material:'steel'};
  const generator:Structure={...refinery,kind:'chemfuel-generator'};
  expect(structureMaxHp(refinery)).toBe(200);expect(structureMaxHp(generator)).toBe(300);
  expect(structureFlammability(refinery)).toBe(1);expect(structureFlammability(generator)).toBe(1);
  expect(STRUCTURE_SHOT_FILL[refinery.kind]).toBe(.5);expect(STRUCTURE_SHOT_FILL[generator.kind]).toBe(.9);
  expect(structureRoomMarketValue(refinery)).toBe(390);expect(structureRoomMarketValue(generator)).toBe(295);
  expect(structureRoomStandable(refinery.kind)).toBe(false);expect(structureBeauty(generator)).toBe(-20);
  expect(WIND_BLOCKERS.has(generator.kind)).toBe(true);expect(WIND_BLOCKERS.has(refinery.kind)).toBe(false);
});
