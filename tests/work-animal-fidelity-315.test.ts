import {expect,test} from 'vitest';
import {plantHarvestYield} from '../src/sim/plant-skills.ts';
import {berryYield} from '../src/sim/plants.ts';
import {cookSpeedCurve315} from '../src/sim/cooking-statistics.ts';
import {coreCapacityFactor315,tameChance,trainChance} from '../src/sim/animal-handling.ts';
import {animalTrainingChance282} from '../src/sim/animal-training-service-282.ts';
import {tameWildnessFactor315,trainWildnessFactor315,tameWildnessFactor256} from '../src/sim/animal-domestic-v256.ts';
import {hareSecondBabyChance315} from '../src/sim/animal-life.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {Resource,World} from '../src/sim/types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

const world=()=>createScenarioWorld(42,32,'crashlanded');
const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};

test('plant harvest yield follows the Core table at levels 17 to 20',()=>{
  const p=world().pawns[0]!;
  const at=(level:number,v?:number)=>{p.skills.plants={level,xp:0,dailyXp:0,passion:0};return plantHarvestYield(p,undefined,v);};
  expect([17,18,19,20].map(l=>at(l))).toEqual([1.09,1.10,1.12,1.13]);
  // Schema 314 kept the old shifted values.
  expect([17,18,19,20].map(l=>at(l,314))).toEqual([1.10,1.12,1.13,1.13]);
  expect(at(16)).toBe(1.08);expect(at(16,314)).toBe(1.08);
});

test('a damaged crop yields less, as every Core plant does (Lerp(0.5, 1, HP))',()=>{
  const w=world();
  const rice:Resource={id:w.nextId++,kind:'rice',x:5,z:5,amount:6,growth:1,growthTick:w.tick,damage:42.5};
  w.resources=[...w.resources,rice];
  // Rice has 85 hit points: half of them left gives three quarters of the yield.
  expect(berryYield(w,rice)).toBeCloseTo(4.5,12);
  setVersion(w,314);expect(berryYield(w,rice)).toBeCloseTo(6,12);
  setVersion(w,315);delete rice.damage;expect(berryYield(w,rice)).toBeCloseTo(6,12);
  // Haygrass keeps its previous behaviour (it was already sensitive).
  const hay:Resource={id:w.nextId++,kind:'haygrass',x:6,z:5,amount:18,growth:1,growthTick:w.tick,damage:17};
  w.resources=[...w.resources,hay];
  expect(berryYield(w,hay)).toBeCloseTo(16.2,12);setVersion(w,314);expect(berryYield(w,hay)).toBeCloseTo(16.2,12);
});

test('a clumsy cook follows the Core speed curve below zero, never under 10 %',()=>{
  expect(cookSpeedCurve315(0)).toBeCloseTo(.4,12);expect(cookSpeedCurve315(10)).toBeCloseTo(1,12);
  expect(cookSpeedCurve315(-8)).toBeCloseTo(.4-.0195*8,12);expect(cookSpeedCurve315(-8,314)).toBeCloseTo(.4-.015*8,12);
  // Core reaches 0.01 at -20, then its minimum value 0.1 applies.
  expect(cookSpeedCurve315(-20)).toBe(.1);expect(cookSpeedCurve315(-20,314)).toBeCloseTo(.1,12);
  expect(cookSpeedCurve315(-17)).toBeCloseTo(.1,12);expect(cookSpeedCurve315(-15)).toBeCloseTo(.4-.0195*15,12);
});

test('the allowed capacity defect rescales below 100 % as in Core',()=>{
  // Talking at 80 % with a 20 % allowed defect counts as a full capacity.
  expect(coreCapacityFactor315(.8,.9,.2)).toBe(1);
  // At 40 %: InverseLerp(0, 0.8, 0.4) = 0.5, weighted 0.9.
  expect(coreCapacityFactor315(.4,.9,.2)).toBeCloseTo(.55,12);
  expect(coreCapacityFactor315(0,.9,.2)).toBeCloseTo(.1,12);
  expect(coreCapacityFactor315(1.4,.9,.2)).toBe(1);
});

test('taming and training: the stat carries no extra factor, the wildness of each species applies',()=>{
  const w=world(),p=w.pawns[0]!;p.skills.animals={level:10,xp:0,dailyXp:0,passion:0};
  // Healthy: the TameAnimalChance stat is 0.04 + 0.03 x 10.
  expect(tameChance(p)).toBeCloseTo(.34,12);expect(tameChance(p,314)).toBeCloseTo(.17,12);
  expect(trainChance(p)).toBeCloseTo(.6,12);expect(trainChance(p,314)).toBeCloseTo(.45,12);
  const species=(id:string)=>id as WildAnimal['species'];
  // Core wildness of the original species: hare 0.75, muffalo 0.6, dromedary 0.25.
  expect(tameWildnessFactor315(species('hare'))).toBeCloseTo(.5,12);
  expect(tameWildnessFactor315(species('muffalo'))).toBeCloseTo(.8,12);
  expect(tameWildnessFactor315(species('dromedary'))).toBeCloseTo(1.5,12);
  expect(trainWildnessFactor315(species('hare'))).toBeCloseTo(.75,12);
  expect(trainWildnessFactor315(species('dromedary'))).toBeCloseTo(1.25,12);
  // The hare keeps exactly its old chances; the muffalo and the dromedary differ.
  expect(tameChance(p)*tameWildnessFactor315(species('hare'))).toBeCloseTo(tameChance(p,314)*tameWildnessFactor256(species('hare')),12);
  expect(trainChance(p)*trainWildnessFactor315(species('hare'))).toBeCloseTo(trainChance(p,314),12);
});

test('trainable lessons use the Core capacity rescaling from schema 315',()=>{
  const w=world(),p=w.pawns[0]!;p.skills.animals={level:10,xp:0,dailyXp:0,passion:0};
  const a={species:'cat'} as unknown as WildAnimal;
  // Healthy trainer: no difference between the two schemas.
  expect(animalTrainingChance282(p,a)).toBe(animalTrainingChance282(p,a,314));
  expect(animalTrainingChance282(p,a)).toBeGreaterThan(0);
});

test('a hare gives birth to two babies three times out of four',()=>{
  expect(hareSecondBabyChance315(315)).toBe(.75);expect(hareSecondBabyChance315(314)).toBe(.5);
});

test('a schema 314 save migrates to 315 by its number only',()=>{
  const current=serializeWorld(world());
  expect(serializeWorld(deserializeWorld(asOldSchema(current,314)))).toBe(current);
});
