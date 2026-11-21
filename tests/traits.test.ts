import { withoutResearch,withMigratedResearch } from './scenarios/legacy-skills';
import { SCHEMA_VERSION } from '../src/sim/types';
import { expect,test } from 'vitest';
import { createWorld,applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld } from '../src/sim/index';
import { TRAITS,validTraits,startingTraits,arrivalTraits,initializeCampTraits,breakThresholds,globalLearningFactor } from '../src/sim/traits';
import { initialSkills,learnSkill,learningFactor,tickSkills } from '../src/sim/skills';
import { offeredTraits361 } from '../src/sim/trait-generation-361';
import { moodTarget,moodThoughts,updateMood } from '../src/sim/mood';
import { updateMentalBreak } from '../src/sim/mental-break';
import { enableArrivals,advanceArrivals } from '../src/sim/arrivals';
import { SnapshotEncoder,SnapshotDecoder } from '../src/bridge/snapshots';
import { addMaterial,refreshStock } from '../src/sim/materials';
import { medicalCamp } from './scenarios/health';
import { careCamp } from './scenarios/care';
import { firingCamp } from './scenarios/shooting';
import { meleeCamp } from './scenarios/melee';
import { fixtureBuilding } from './scenarios/deconstruction';
import type { World,Structure,Pawn } from '../src/sim/types';

const mental=(p:Pawn)=>p.mental;
function until(w:World,f:()=>boolean,limit=1000){for(let i=0;i<limit&&!f();i++)stepWorld(w);expect(f()).toBe(true);expect(validateWorld(w)).toEqual([]);}
function replay(w:World,ticks=30){const copy=deserializeWorld(serializeWorld(w));stepWorld(w,ticks);stepWorld(copy,ticks);expect(copy).toEqual(w);expect(validateWorld(w)).toEqual([]);}

test('mood and nerves are independent: exact thresholds, no instant happiness, sleep freeze and real crisis above neutral threshold',()=>{
  const w=medicalCamp(),p=w.pawns[0]!;p.mood=50;
  const base=moodTarget(moodThoughts(w,p));
  for(const [trait,offset] of [['optimist',6],['pessimist',-6],['steadfast',0],['nervous',0]] as const){p.traits=[trait];expect(moodTarget(moodThoughts(w,p))).toBe(base+offset);expect(p.mood).toBe(50);}
  p.traits=['optimist'];updateMood(w,p);expect(p.mood).toBeCloseTo(50+.048);p.state='sleeping';updateMood(w,p);expect(p.mood).toBeCloseTo(50+.048);p.state='idle';
  for(const [trait,minor] of [['steadfast',26],['nervous',43]] as const){p.traits=[trait];const thresholds=breakThresholds(p);expect(thresholds).toEqual([minor,minor*4/7,minor/7]);
    // Check strict inequality at every boundary without triggering randomness.
    for(let level=0;level<3;level++)for(const delta of [0,-.00001]){delete p.mental;p.mood=thresholds[level]!+delta;w.tick+=15-(w.tick+p.id)%15;updateMentalBreak(w,p);expect(mental(p)?.below[level]??0).toBe(delta===0?0:150);}
  }
  delete p.mental;p.traits=['nervous'];p.mood=40;const neutral=structuredClone(w);delete neutral.pawns[0]!.traits;
  for(let i=0;i<30000&&!mental(p)?.crisis;i++){w.tick++;neutral.tick++;updateMentalBreak(w,p);updateMentalBreak(neutral,neutral.pawns[0]!);}
  expect(mental(p)?.crisis?.kind).toBe('sad-wander');expect(neutral.pawns[0]!.mental).toBeUndefined();expect(validateWorld(w)).toEqual([]);replay(w);
});

test('learning combines global factor with passion and strict daily saturation, while debt/decay/mastery stay unchanged',()=>{
  const w=medicalCamp(),p=w.pawns[0]!;
  for(const [trait,factor] of [['fast-learner',1.75],['slow-learner',.25]] as const)for(const passion of [0,1,2] as const){
    p.traits=[trait];p.skills=initialSkills(8,passion,w.tick);const s=p.skills.construction;
    expect(globalLearningFactor(p)).toBe(factor);expect(learningFactor(s,p)).toBeCloseTo(factor*[.35,1,1.5][passion]!);
    const xp=Math.round(2500*factor*[.35,1,1.5][passion]!);learnSkill(s,2500,p);expect(s.xp).toBe(xp);
    s.dailyXp=4000000;learnSkill(s,2500,p);expect(s.xp).toBe(xp*2);learnSkill(s,2500,p);expect(s.xp).toBe(xp*2+Math.round(2500*factor*[.35,1,1.5][passion]!*.2));
    const before=s.xp;learnSkill(s,-100,p);expect(s.xp).toBe(before-100);
    s.level=20;s.xp=29999000;learnSkill(s,5000,p);expect(s.xp).toBe(29999000);
    s.level=10;s.xp=-999900;learnSkill(s,-100,p);expect(s.level).toBe(9);expect(s.xp).toBe(9000000);
    s.level=20;s.xp=1000000;s.dailyXp=9000000;p.skills.lastResetTick=3000;w.tick=6000-(p.id%20);if(w.tick<6000)w.tick+=20;tickSkills(w,p);expect(s.dailyXp).toBe(-12000);expect(s.xp).toBe(988000);
  }
});

test('traits reach every active skill through real construction, repairs, treatment, shooting and melee; no XP on travel',()=>{
  const earned:Record<string,number[]>={};
  for(const kind of ['build','repair','care','shoot','melee'] as const){earned[kind]=[];
    for(const trait of [undefined,'fast-learner','slow-learner'] as const){
      const w=kind==='care'?careCamp():kind==='shoot'?firingCamp():kind==='melee'?meleeCamp():medicalCamp();const p=w.pawns[0]!;
      if(trait)p.traits=[trait];const skill=kind==='care'?p.skills.medicine:kind==='shoot'?p.skills.shooting:kind==='melee'?p.skills.melee:p.skills.construction;
      skill.level=8;skill.passion=1;skill.xp=0;skill.dailyXp=0;
      if(kind==='build'){
        p.priorities.build=1;expect(applyCommand(w,{type:'designate',kind:'bed',material:'wood',x:p.x+4,z:p.z}).ok).toBe(true);
        const j=w.jobs[0]!;j.construction='frame';addMaterial(w,'wood',45,{type:'job',jobId:j.id});refreshStock(w);
        expect(applyCommand(w,{type:'order-job',pawnId:p.id,jobId:j.id,queue:false}).ok).toBe(true);
        stepWorld(w);expect(skill.xp).toBe(0);
      }else if(kind==='repair'){
        p.priorities.build=1;const wall:Structure=fixtureBuilding(w,'wall',p.x+1,p.z);wall.damage=100;
        expect(applyCommand(w,{type:'area',action:'home',from:wall,to:wall}).ok).toBe(true);
      }else if(kind==='shoot'||kind==='melee'){
        const target=w.pawns[kind==='shoot'?1:3]!;
        expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
        expect(applyCommand(w,{type:kind==='shoot'?'shoot':'melee',pawnIds:[p.id],targetId:target.id}).ok).toBe(true);
      }
      until(w,()=>skill.xp>0);earned[kind]!.push(skill.xp);replay(w,4);
    }
    const [base,fast,slow]=earned[kind]!;expect(fast).toBeCloseTo(base!*1.75,0);expect(slow).toBeCloseTo(base!*.25,0);
  }
});

test('strict neutral migration, conflicts/duplicates/unknowns, mutable copies and snapshots retain the exact personality',()=>{
  const w=createWorld(42);initializeCampTraits(w);expect(w.pawns.map(p=>p.traits)).toEqual([['optimist','fast-learner'],['steadfast','slow-learner'],['pessimist','nervous']]);
  expect(w.pawns[0]!.traits).not.toBe(startingTraits(0));expect(Object.isFrozen(TRAITS.optimist)).toBe(true);
  for(const traits of [null,[],['optimist','pessimist'],['steadfast','nervous'],['fast-learner','slow-learner'],['optimist','optimist'],['__proto__'],['constructor'],['pyromaniac'],['optimist',42]]){const bad=structuredClone(w) as any;bad.pawns[0].traits=traits;expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow(/traits/);}
  expect(validTraits(['optimist','steadfast','fast-learner'],69)).toBe(true);
  const old=structuredClone(w) as any;(old.schemaVersion=68,withoutResearch(old));for(const p of old.pawns){delete p.traits;delete p.background;}
  const migrated=deserializeWorld(JSON.stringify(old));expect(migrated).toEqual(withMigratedResearch({...old,schemaVersion:SCHEMA_VERSION}));expect(migrated.pawns.every(p=>p.traits===undefined)).toBe(true);
  old.pawns[0].traits=['optimist'];expect(()=>deserializeWorld(JSON.stringify(old))).toThrow(/version 68/);delete old.pawns[0].traits;old.pawns[0].skills.construction.dailyXp=23000000;expect(()=>deserializeWorld(JSON.stringify(old))).toThrow(/version 68/);
  const enc=new SnapshotEncoder(),dec=new SnapshotDecoder();dec.adopt(structuredClone(enc.encode(w,0,1)));stepWorld(w,10);const result=dec.adopt(structuredClone(enc.encode(w,0,6)));expect(result.status).toBe('applied');if(result.status==='applied')expect(result.world.pawns).toEqual(w.pawns);replay(w,50);
});

test('arrival traits are announced, persist in the letter, transfer once and leave old pending offers neutral',()=>{
  const w=createWorld(42);enableArrivals(w);w.tick=w.arrivals!.nextCheck;advanceArrivals(w);const offer=w.arrivals!.pending!;
  // Schema 361: the offer announces Core traits drawn for the offered identity.
  expect(offer.traits).toEqual(offeredTraits361(w.seed,offer.id,offer.age,offer.background));const saved=serializeWorld(w),copy=deserializeWorld(saved);
  for(const world of [w,copy])expect(applyCommand(world,{type:'answer-arrival',offerId:offer.id,accept:true}).ok).toBe(true);
  expect(copy).toEqual(w);expect(w.pawns.at(-1)!.traits).toEqual(offer.traits);expect(w.pawns.at(-1)!.traits).not.toBe(offer.traits);replay(w);
  const old=JSON.parse(saved);(old.schemaVersion=68,withoutResearch(old));
  for(const p of old.pawns)delete p.background;
  delete old.arrivals.pending.background;delete old.arrivals.pending.age;
  expect(()=>deserializeWorld(JSON.stringify(old))).toThrow(/version 68/);delete old.arrivals.pending.traits;
  const migrated=deserializeWorld(JSON.stringify(old));expect(applyCommand(migrated,{type:'answer-arrival',offerId:offer.id,accept:true}).ok).toBe(true);expect(migrated.pawns.at(-1)!.traits).toBeUndefined();
  for(const traits of [['fast-learner','slow-learner'],['nope']]){const bad=JSON.parse(saved);bad.arrivals.pending.traits=traits;expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow(/offer/);}
});
