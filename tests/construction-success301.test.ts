import {expect,test} from 'vitest';
import {constructionSuccessChance301,type ConstructionSuccessPawn301} from '../src/sim/construction-success-301.ts';
import {initialSkills} from '../src/sim/skills.ts';
import {assessBody,HEALTHY_BODY,HEALTHY_BODY_INPUT} from '../src/sim/body-capacities.ts';

test('primary skill0..20 curve, final clamp, live effective level and passion independence',()=>{
 // These21 data oracles are the primary XML curve, not a module table import.
 const primary=[.75,.8,.85,.875,.9,.925,.95,.975,1,1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.1,1.12,1.13];
 const reduced=assessBody({...HEALTHY_BODY_INPUT,manipulationOffset:-1});
 expect(reduced.capacities.manipulation).toBe(0);expect(reduced.capacities.sight).toBe(1);
 for(const [level,raw]of primary.entries()){
  const p:ConstructionSuccessPawn301={skills:initialSkills(level)},before=JSON.stringify(p);
  expect(constructionSuccessChance301(p,HEALTHY_BODY)).toBe(Math.fround(Math.min(1,raw)));
  // Mathematical primary oracle; tolerance allows the prescribed Single Lerp.
  // Detects premature lookup clamp, including levels9..20 hidden by healthy1.
  expect(constructionSuccessChance301(p,reduced)).toBeCloseTo(raw*.7,6);
  expect(JSON.stringify(p)).toBe(before);
 }
 const p:ConstructionSuccessPawn301={skills:initialSkills(3)};
 for(const passion of [0,1,2] as const){p.skills.construction.passion=passion;expect(constructionSuccessChance301(p,HEALTHY_BODY)).toBe(.875);}
 p.skills.construction.level=8;expect(constructionSuccessChance301(p,HEALTHY_BODY)).toBe(1);
 p.background={childhood:'workshop-child',adulthood:'merchant'};
 expect(constructionSuccessChance301(p,HEALTHY_BODY)).toBe(.75);expect(p.skills.construction.level).toBe(8);
});

test('actual body assessment uses ordered Single Lerps, Sight cap and boosted Manipulation before final clamp',()=>{
 const half=assessBody({...HEALTHY_BODY_INPUT,manipulationOffset:-.5,sightOffset:-.5}),before=JSON.stringify(half);
 expect(half.capacities.manipulation).toBe(.5);expect(half.capacities.sight).toBe(.5);
 const p:ConstructionSuccessPawn301={skills:initialSkills(3)};
 // Single results of the primary Lerp sequence; factorized decimal.765 is
 // a different Single. These literals do not reimplement the function.
 expect(constructionSuccessChance301(p,half)).toBe(0.6693750023841858);
 p.skills.construction.level=8;expect(constructionSuccessChance301(p,half)).toBe(0.76500004529953);
 expect(JSON.stringify(half)).toBe(before);
 const boosted=assessBody({...HEALTHY_BODY_INPUT,manipulationOffset:.5,sightOffset:2});
 const boostedNormalSight=assessBody({...HEALTHY_BODY_INPUT,manipulationOffset:.5});
 p.skills.construction.level=0;
 expect(constructionSuccessChance301(p,boosted)).toBe(0.862500011920929);
 expect(constructionSuccessChance301(p,boosted)).toBe(constructionSuccessChance301(p,boostedNormalSight));
 p.skills.construction.level=20;
 const zero=assessBody({...HEALTHY_BODY_INPUT,manipulationOffset:-1,sightOffset:-1});
 expect(constructionSuccessChance301(p,zero)).toBeCloseTo(.6328,6);
 expect(constructionSuccessChance301(p,HEALTHY_BODY)).toBe(1);
});

