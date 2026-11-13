import {expect,test} from 'vitest';
import {stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {opinionOf,addSocialMemory,memoryOffset,RECRUITED_ME_DURATION,socialSeed} from '../src/sim/social-state.ts';
import {socialFightChance} from '../src/sim/social.ts';
import {validateSocial} from '../src/sim/social-save.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {MALNUTRITION_UNIT} from '../src/sim/malnutrition.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {recruitmentUiFixture} from './scenarios/prison-camp.ts';
import {equipmentCamp} from './scenarios/equipment.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {TICKS_PER_DAY,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
function until(w:World,done:()=>boolean,limit:number){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}

test('a recruited prisoner remembers the warden: +20 opinion for 120 days, fading at the end',()=>{
  const q=recruitmentUiFixture(),w=q.world,warden=w.pawns.find(p=>p.id===q.actorId)!,recruit=w.pawns.find(p=>p.id===q.patientId)!;
  recruit.prisoner!.resistance=0;recruit.prisoner!.mode='recruit';warden.priorities.warden=1;
  until(w,()=>!!recruit.recruitment,260);
  const memory=recruit.social!.memories.find(m=>m.kind==='recruited-me')!;
  expect(memory).toMatchObject({otherId:warden.id,offset:20});
  expect(opinionOf(recruit,warden.id,w.tick,w)).toBeGreaterThanOrEqual(20);
  expect(validateWorld(w)).toEqual([]);
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
  // Full for 70 % of 120 days, then fading to zero.
  expect(memoryOffset(memory,memory.at+80*TICKS_PER_DAY)).toBe(20);
  expect(memoryOffset(memory,memory.at+RECRUITED_ME_DURATION-6*TICKS_PER_DAY)).toBeCloseTo(20*6/36,9);
  expect(memoryOffset(memory,memory.at+RECRUITED_ME_DURATION)).toBe(0);
  // Only one such memory per recruiter.
  addSocialMemory(recruit.social!,warden.id,'recruited-me',w.tick,1);
  expect(recruit.social!.memories.filter(m=>m.kind==='recruited-me')).toHaveLength(1);
});

test('before schema 319 a recruitment leaves no memory and the memory is refused',()=>{
  const q=recruitmentUiFixture(),w=q.world,warden=w.pawns.find(p=>p.id===q.actorId)!,recruit=w.pawns.find(p=>p.id===q.patientId)!;
  setVersion(w,318);recruit.prisoner!.resistance=0;recruit.prisoner!.mode='recruit';warden.priorities.warden=1;
  until(w,()=>!!recruit.recruitment,260);
  expect(recruit.social?.memories.some(m=>m.kind==='recruited-me')??false).toBe(false);
  recruit.social??={rng:socialSeed(w.seed,recruit.id),memories:[]};
  addSocialMemory(recruit.social,warden.id,'recruited-me',w.tick,1);
  expect(validateSocial(w,318).length).toBeGreaterThan(0);expect(validateSocial(w,319)).toEqual([]);
});

test('a pawn incapable of violence is never drawn into a fight; malnutrition makes fights likelier',()=>{
  const w=equipmentCamp(2),[a,b]=w.pawns as [World['pawns'][number],World['pawns'][number]];
  const base=socialFightChance(w,b,a,'insult');expect(base).toBeGreaterThan(0);
  b.health=createMedicalRecord(w.tick);b.health.malnutrition=.5*MALNUTRITION_UNIT;
  // Moderate malnutrition (stage factor 2.5) on top of its capacity effects.
  const hungry=socialFightChance(w,b,a,'insult');setVersion(w,318);
  expect(hungry).toBeCloseTo(socialFightChance(w,b,a,'insult')*2.5,12);
  setVersion(w,319);delete b.health.malnutrition;
  // A pacifist medic refuses violence: no fight, even insulted.
  b.background={childhood:'quiet-child',adulthood:'medic'};
  expect(socialFightChance(w,b,a,'insult')).toBe(0);
  setVersion(w,318);expect(socialFightChance(w,b,a,'insult')).toBeCloseTo(base,12);
});

test('a schema 318 save migrates to 319 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,318)))).toBe(current);
});
