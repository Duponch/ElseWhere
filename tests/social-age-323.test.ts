import {expect,test} from 'vitest';
import {pairCompatibility323,ageFightFactor323,socialFightChance} from '../src/sim/social.ts';
import {socialCompatibility} from '../src/sim/social-state.ts';
import {HUMAN_YEAR_TICKS} from '../src/sim/human-age.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {equipmentCamp} from './scenarios/equipment.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const years=(n:number)=>({biologicalTicks:n*HUMAN_YEAR_TICKS,chronologicalTicks:n*HUMAN_YEAR_TICKS});

test('compatibility gains +0.45 at the same age and loses 0.45 twenty years apart',()=>{
  const w=equipmentCamp(2),[a,b]=w.pawns as [World['pawns'][number],World['pawns'][number]];
  const base=socialCompatibility(w.seed,a.id,b.id);
  a.age=years(30);b.age=years(30);expect(pairCompatibility323(w,a,b)).toBeCloseTo(base+.45,12);
  b.age=years(40);expect(pairCompatibility323(w,a,b)).toBeCloseTo(base,12);
  b.age=years(60);expect(pairCompatibility323(w,a,b)).toBeCloseTo(base-.45,12);
  setVersion(w,322);expect(pairCompatibility323(w,a,b)).toBe(base);
});

test('pawns more than ten years apart fight less, down to a quarter fifty years apart',()=>{
  const w=equipmentCamp(2),[a,b]=w.pawns as [World['pawns'][number],World['pawns'][number]];
  a.age=years(25);b.age=years(35);expect(ageFightFactor323(w,a,b)).toBe(1);
  b.age=years(45);expect(ageFightFactor323(w,a,b)).toBeCloseTo(1-.75*10/40,12);
  b.age=years(80);expect(ageFightFactor323(w,a,b)).toBeCloseTo(.25,12);
  const old=socialFightChance(w,b,a,'insult');setVersion(w,322);
  expect(old).toBeCloseTo(socialFightChance(w,b,a,'insult')*.25,12);
});

test('a schema 322 save migrates to 323 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,322)))).toBe(current);
});
