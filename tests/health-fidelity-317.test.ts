import {expect,test} from 'vitest';
import {tendQuality,tendXp} from '../src/sim/medicine-rules.ts';
import {acquireFlu,fluNextTendCore,tendFlu} from '../src/sim/flu-state.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {validateMedicalRecord} from '../src/sim/injury-validation.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {MedicalRecord} from '../src/sim/injury-types.ts';

const valid=(r:MedicalRecord,version:number)=>validateMedicalRecord(r,true,true,true,true,false,false,true,true,true,true,true,version,true);

test('in a hospital bed the tend base is capped before the random band, as in Core',()=>{
  // Stat 1.1, industrial medicine, hospital bed 0.1: base min(1, 1.2) = 1,
  // then the band: random 0 gives 0.75, random 1 gives 1 (capped).
  expect(tendQuality(1.1,0,false,'medicine',.1)).toBe(750);
  expect(tendQuality(1.1,.5,false,'medicine',.1)).toBe(1000);
  expect(tendQuality(1.1,1,false,'medicine',.1)).toBe(1000);
  // Schema 316 added the band to the uncapped base: 1.2 - 0.25 = 0.95.
  expect(tendQuality(1.1,0,false,'medicine',.1,316)).toBe(950);
  // Self-tend: the band is not reduced by the 0.7 factor.
  expect(tendQuality(.5,0,true,'medicine',.1)).toBe(Math.round((Math.min(1,(.5+.1)*.7)-.25)*1000));
  expect(tendQuality(.5,1,true,'medicine',.1)).toBe(Math.round((Math.min(1,(.5+.1)*.7)+.25)*1000));
  // Without a hospital bed nothing changes.
  expect(tendQuality(1,.5,false,'medicine')).toBe(tendQuality(1,.5,false,'medicine',0,316));
});

test('a flu tend lasts 12 + 3 hours and can be renewed during its last 3 hours',()=>{
  const record=createMedicalRecord(1000);acquireFlu(record,1_000_000);
  const old=structuredClone(record);
  expect(tendFlu(record,800,317)).toBe(true);
  expect(record.flu!.tend).toEqual({quality:800,expiresAtCore:1000*10+37_500,core317:true});
  expect(fluNextTendCore(record.flu!)).toBe(1000*10+37_500-7_500+1);
  expect(valid(record,317)).toBeNull();
  // A schema 316 world keeps the old duration and overlap.
  expect(tendFlu(old,800,316)).toBe(true);
  expect(old.flu!.tend).toEqual({quality:800,expiresAtCore:1000*10+30_000});
  expect(fluNextTendCore(old.flu!)).toBe(1000*10+30_000-6_000+1);
  // A 317 tend is refused in an older save.
  expect(valid(record,316)).not.toBeNull();
});

test('tending an animal gives 175 medicine XP instead of 500',()=>{
  expect(tendXp('medicine',true)).toBe(122_500);
  expect(tendXp('medicine')).toBe(350_000);
  expect(tendXp(undefined,true)).toBe(87_500);
});

test('a schema 316 save migrates to 317 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,316)))).toBe(current);
});
