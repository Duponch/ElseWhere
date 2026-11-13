import {expect,test} from 'vitest';
import {adjustedPopulation320,curve320,deathOnDownedChance320,deathOnDownedEligible320,populationAdaptDays320,populationIntent320,validPopulationGain320} from '../src/sim/population-intent-320.ts';
import {damageUnarmoredPawnWithBullet} from '../src/sim/bullet-damage.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {firingCamp} from './scenarios/shooting.ts';
import type {World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};

test('population intent follows Cassandra: few colonists want more, adaptation after a gain',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');
  expect(adjustedPopulation320(w)).toBe(3);
  // Three colonists: popCurve(3) = 2 - (1/3)... interpolated between (1,2) and (4,1).
  expect(curve320(3,[[0,8],[1,2],[4,1],[7,.35],[11,0],[20,-1]])).toBeCloseTo(4/3,12);
  // At the game start the adaptation is zero: the intent is zero.
  expect(populationAdaptDays320(w)).toBe(0);expect(populationIntent320(w)).toBe(0);
  expect(deathOnDownedChance320(w)).toBeCloseTo(.8,12);
  // Eight and a half days later (half-day steps at Core tick 171 mod 30000)
  // the full intent applies.
  w.tick+=8*6000+30;
  expect(populationAdaptDays320(w)).toBe(8.5);
  expect(populationIntent320(w)).toBeCloseTo(4/3,12);
  expect(deathOnDownedChance320(w)).toBeCloseTo(.5657+(.5-.5657)*(1/3),9);
  // A new colonist resets the adaptation.
  w.populationGainCore320=w.tick*10;expect(populationAdaptDays320(w)).toBe(0);
});

test('a raider downed by a bullet sometimes dies; a colonist never does',()=>{
  const deadRaiders=new Set<string>();let colonistDeaths=0;
  for(let seed=1;seed<=40;seed++){
    const w=firingCamp(),target=w.pawns[1]!;w.rng=seed*7919;
    target.faction='outlaws' as never;
    damageUnarmoredPawnWithBullet(w,target,{damage:30,part:'spine'});
    deadRaiders.add(target.state);
    const v=firingCamp(),colonist=v.pawns[1]!;v.rng=seed*7919;
    damageUnarmoredPawnWithBullet(v,colonist,{damage:30,part:'spine'});
    if(colonist.state==='dead')colonistDeaths++;
  }
  expect(deadRaiders.has('dead')).toBe(true);
  expect(colonistDeaths).toBe(0);
});

test('before schema 320 the adaptation field is refused and no raider dies when downed',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');w.populationGainCore320=0;
  expect(validateWorld(w)).toEqual([]);
  expect(validPopulationGain320(0,319,w.tick)).toBe(false);expect(validPopulationGain320(0,320,w.tick)).toBe(true);
  expect(validPopulationGain320(w.tick*10+1,320,w.tick)).toBe(false);
  const raider={...w.pawns[0]!,faction:'outlaws'} as never;
  expect(deathOnDownedEligible320(w,raider)).toBe(true);setVersion(w,319);expect(deathOnDownedEligible320(w,raider)).toBe(false);
});

test('a schema 319 save migrates to 320 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,319)))).toBe(current);
});
