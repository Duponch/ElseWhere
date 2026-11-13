import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {moodThoughts,personalMoodThoughts} from '../src/sim/mood.ts';
import {colonyExpectation,adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {colonistMoodOffset,crashlandedProfile} from '../src/sim/game-profile.ts';
import {VERY_LOW_EXPECTATION313} from '../src/sim/expectations.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {World} from '../src/sim/types.ts';

const ids=(w:World,p:World['pawns'][number])=>moodThoughts(w,p).map(t=>t.id);

test('beauty bounds are strict as in Core: an exact 35 is still ugly, an exact 65 still neutral',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;
  p.beauty=35;expect(ids(w,p)).toContain('ugly-environment');
  p.beauty=65;expect(ids(w,p).some(id=>id.endsWith('-environment'))).toBe(false);
  p.beauty=35.5;expect(ids(w,p).some(id=>id.endsWith('-environment'))).toBe(false);
  // Schema 312 kept the old bounds.
  (w as {schemaVersion:number}).schemaVersion=312;p.beauty=35;expect(ids(w,p)).not.toContain('ugly-environment');
});

test('a wound infection makes the pawn feel sick (Core WoundInfection makesSickThought)',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.health=createMedicalRecord(w.tick);
  expect(ids(w,p)).not.toContain('sick');
  p.health.infections={nextId:2,immunity:0,cases:[{id:1,part:'right-arm',bornAt:w.tick,severity:100_000_000,luck:1_000_000}]};
  expect(ids(w,p)).toContain('sick');
  (w as {schemaVersion:number}).schemaVersion=312;expect(ids(w,p)).not.toContain('sick');
});

test('in a caravan (off the map) there is no tired thought, and expectations are very low',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.rest=10;
  const base={tick:w.tick,people:new Map(),items:[],difficultyMood:0};
  expect(personalMoodThoughts(p,{...base,schemaVersion:313}).map(t=>t.id)).toContain('tired');
  expect(personalMoodThoughts(p,{...base,schemaVersion:313,despawned313:true}).map(t=>t.id)).not.toContain('tired');
  // Schema 312 kept the thought.
  expect(personalMoodThoughts(p,{...base,schemaVersion:312,despawned313:true}).map(t=>t.id)).toContain('tired');
  expect(VERY_LOW_EXPECTATION313).toMatchObject({id:'very-low',moodOffset:24,joyToleranceDropPerDay:.13});
  expect(personalMoodThoughts(p,{...base,schemaVersion:313,despawned313:true,expectation:VERY_LOW_EXPECTATION313}).find(t=>t.id==='expectations-very-low')?.offset).toBe(24);
});

test('a prisoner of the colony has the map expectations and the difficulty mood bonus',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');adoptColonyEconomy(w);
  // A captured outsider (not of the colony faction) held as a prisoner.
  const prisoner={...w.pawns[0]!,prisoner:{} as never,faction:'outlanders'} as unknown as World['pawns'][number];
  expect(colonyExpectation(w,prisoner)).toBeDefined();
  expect(colonistMoodOffset({gameProfile:crashlandedProfile(),schemaVersion:313 as never},prisoner)).toBe(5);
  expect(colonistMoodOffset({gameProfile:crashlandedProfile(),schemaVersion:312 as never},prisoner)).toBe(0);
  (w as {schemaVersion:number}).schemaVersion=312;expect(colonyExpectation(w,prisoner)).toBeUndefined();
});

test('a schema 312 save migrates to 313 by its number only',()=>{
  const w=createScenarioWorld(42,32,'crashlanded'),current=serializeWorld(w);
  expect(serializeWorld(deserializeWorld(asOldSchema(current,312)))).toBe(current);
});
