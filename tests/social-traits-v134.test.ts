import { expect,test } from 'vitest';
import { medicalCamp } from './scenarios/health.ts';
import { advanceArrivals,enableArrivals } from '../src/sim/arrivals.ts';
import { moodThoughts } from '../src/sim/mood.ts';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { exchangeSocial,negativeInteractionFactor,passiveSocialWeights,socialFightChance } from '../src/sim/social.ts';
import { addSocialMemory,kindWordsMoodMemories,opinionCauses,opinionOf,socialImpact } from '../src/sim/social-state.ts';
import { validateSocial } from '../src/sim/social-save.ts';
import { arrivalTraits,validTraits } from '../src/sim/traits.ts';
import { SCHEMA_VERSION,TICKS_PER_DAY } from '../src/sim/types.ts';
import { withoutFutureHelmetPolicy } from './scenarios/legacy-skills.ts';

test('Core social dispositions change only the eligible content and victim fight roll',()=>{
  const world=medicalCamp(2),[speaker,victim]=world.pawns;
  const base=passiveSocialWeights(world,speaker!,victim!);
  const fight=socialFightChance(world,victim!,speaker!,'insult');
  speaker!.traits=['kind'];
  expect(negativeInteractionFactor(world,speaker!,victim!)).toBe(0);
  expect(passiveSocialWeights(world,speaker!,victim!)).toMatchObject({'kind-words':.01,slight:0,insult:0,chitchat:1});
  expect(exchangeSocial(world,speaker!,victim!,'slight')).toBe(false);
  expect(exchangeSocial(world,speaker!,victim!,'insult')).toBe(false);
  speaker!.traits=['abrasive'];
  expect(passiveSocialWeights(world,speaker!,victim!).slight).toBeCloseTo(base.slight*2.3);
  expect(passiveSocialWeights(world,speaker!,victim!).insult).toBeCloseTo(base.insult*2.3);
  expect(exchangeSocial(world,speaker!,victim!,'kind-words')).toBe(false);
  victim!.traits=['bloodlust'];
  expect(socialFightChance(world,victim!,speaker!,'insult')).toBeCloseTo(fight*4);
  expect(validTraits(['kind','abrasive'],134)).toBe(false);
  expect(validTraits(['kind','bloodlust'],134)).toBe(true);
  expect(validTraits(['kind'],127)).toBe(false);
});

test('kind words are physical conversations with directed opinion and a separate two-day mood memory',()=>{
  const world=medicalCamp(2),[speaker,victim]=world.pawns;
  speaker!.traits=['kind'];
  const rng=world.rng,impact=socialImpact(speaker!);
  expect(exchangeSocial(world,speaker!,victim!,'kind-words')).toBe(true);
  expect(victim!.social!.memories).toMatchObject([{kind:'kind-words',otherId:speaker!.id,offset:15*impact}]);
  expect(opinionOf(victim!,speaker!.id,world.tick)).toBeGreaterThan(0);
  expect(kindWordsMoodMemories(victim!,world.tick)).toEqual([{otherId:speaker!.id,count:1,offset:5,expiresAt:world.tick+2*TICKS_PER_DAY}]);
  expect(moodThoughts(world,victim!).find(t=>t.id===`kind-words-${speaker!.id}`)?.offset).toBe(5);
  expect(speaker!.social!.last?.kind).toBe('kind-words');
  expect(speaker!.skills.social?.xp??0).toBe(0);
  expect(world.rng).toBe(rng);
  expect(validateSocial(world,127)).toContain('Invalid last interaction.');
  expect(validateWorld(world)).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  world.tick+=12;
  expect(exchangeSocial(world,speaker!,victim!,'kind-words')).toBe(true);
  expect(kindWordsMoodMemories(victim!,world.tick)[0]?.offset).toBeCloseTo(9.5);
  world.tick+=2*TICKS_PER_DAY;
  expect(kindWordsMoodMemories(victim!,world.tick)).toEqual([]);
  expect(opinionOf(victim!,speaker!.id,world.tick)).toBeGreaterThan(0);
});

test('kind words keep ten memories per speaker, decay, and reject forged old-schema data',()=>{
  const world=medicalCamp(2),[speaker,victim]=world.pawns;
  victim!.social={rng:1,memories:[]};
  for(let i=0;i<11;i++)addSocialMemory(victim!.social,speaker!.id,'kind-words',world.tick+i,1);
  world.tick+=10;
  expect(victim!.social.memories).toHaveLength(10);
  expect(opinionCauses(victim!,speaker!.id,world.tick).find(c=>c.kind==='kind-words')?.count).toBe(10);
  expect(kindWordsMoodMemories(victim!,world.tick)[0]?.offset).toBeCloseTo(5*(1-.9**10)/.1);
  expect(validateSocial(world,134)).toEqual([]);
  const forged=structuredClone(world) as any;forged.schemaVersion=127;
  delete forged.breakdown;
  withoutFutureHelmetPolicy(forged);
  for(const policy of forged.apparelPolicies??[])policy.allowedItems=policy.allowedItems.filter((item:string)=>item!=='recon-helmet');
  for(const pawn of forged.pawns)delete pawn.age;
  for(const departure of forged.visitors?.departed??[])delete departure.pawn.age;
  expect(()=>deserializeWorld(JSON.stringify(forged))).toThrow(/Invalid version 127 save/);
  forged.pawns[1].social.memories=[];forged.pawns[0].traits=['kind'];
  expect(()=>deserializeWorld(JSON.stringify(forged))).toThrow(/Invalid version 127 save/);
  delete forged.pawns[0].traits;
  const migrated=deserializeWorld(JSON.stringify(forged));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  expect(migrated.pawns.every(p=>p.traits===undefined)).toBe(true);
  expect(migrated.pawns.every(p=>!p.social?.memories.some(m=>m.kind==='kind-words'))).toBe(true);
});

test('future arrival offers expose one authored social trait without changing existing offers or the world RNG',()=>{
  const world=medicalCamp(2),before=world.rng;enableArrivals(world);
  // The authored calendar is the rule below schema 361 (Core traits from 361).
  world.tick=world.arrivals!.nextCheck;Object.assign(world,{schemaVersion:360});advanceArrivals(world);Object.assign(world,{schemaVersion:SCHEMA_VERSION});
  const offer=world.arrivals!.pending!;
  expect(offer.traits).toEqual(arrivalTraits(offer.profile,offer.id));
  expect(offer.traits).toHaveLength(3);
  expect(['kind','abrasive','bloodlust']).toContain(offer.traits![2]);
  expect(world.rng).toBe(before);
  expect(validateWorld(world)).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
});
