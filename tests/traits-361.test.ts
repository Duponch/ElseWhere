import {describe,expect,test,vi} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';
import {CORE_TRAIT_DEFS,CORE_TRAIT_DEF_NAMES,LEGACY_TRAIT_IDS,TRAITS,breakThresholds,toughDamage361,traitDefCommonality,traitDefsConflict,validTraits,type CoreTraitDefName,type TraitId} from '../src/sim/traits.ts';
import {drawCoreTraits361,giveBornTraits361,offeredTraits361,traitBirthDraw361} from '../src/sim/trait-generation-361.ts';
import {drugBingeWeight361,onlyAllowedMinorBreaks361} from '../src/sim/trait-mental-361.ts';
import {createStartingCandidateRoster,previewStartingCandidate,previewStartingParty} from '../src/sim/starting-candidates.ts';
import {startingPawn} from '../src/sim/starting-pawns.ts';
import {violentWorkRefusal} from '../src/sim/colonist-backgrounds.ts';
import {moodThoughts,moodTarget} from '../src/sim/mood.ts';
import {opinionCauses,opinionOf} from '../src/sim/social-state.ts';
import {calendarTick} from '../src/sim/calendar.ts';
import {hourOfDay} from '../src/sim/schedule.ts';
import {HUMAN_YEAR_TICKS} from '../src/sim/human-age.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const regular=(t:readonly TraitId[])=>t.filter(id=>!CORE_TRAIT_DEFS[TRAITS[id].def].sexuality);
const DRAWABLE=CORE_TRAIT_DEF_NAMES.filter(d=>CORE_TRAIT_DEFS[d].degrees.length>0);

describe('generation (Core PawnGenerator.GenerateTraits)',()=>{
  test('count 1 to 3, the sexuality draw, and first-draw frequencies by commonality',()=>{
    const N=12000,first:Record<string,number>={},len=[0,0,0,0];let sexual=0;
    for(let i=0;i<N;i++){
      const traits=drawCoreTraits361({draw:traitBirthDraw361(424242,i+1),sex:'male',ageYears:30});
      expect(validTraits(traits,361)).toBe(true);
      len[regular(traits).length]!++;if(regular(traits).length<traits.length)sexual++;
      const def=TRAITS[traits[0]!].def;first[def]=(first[def]??0)+1;
    }
    // TraitsCountRange IntRange(1,3): a third each, a little shifted because
    // Core (without Biotech) may draw a sexuality trait in the main loop.
    for(const n of [1,2,3])expect(Math.abs(len[n]!/N-1/3)).toBeLessThan(.03);
    expect(sexual/N).toBeGreaterThan(.02);expect(sexual/N).toBeLessThan(.08);
    const total=DRAWABLE.reduce((s,d)=>s+traitDefCommonality(d,'male'),0);
    for(const def of DRAWABLE){
      const expected=traitDefCommonality(def,'male')/total,observed=(first[def]??0)/N;
      expect(Math.abs(observed-expected)).toBeLessThan(4*Math.sqrt(expected*(1-expected)/N)+.002);
    }
  });
  test('gendered commonality: misogyny 1.7 for men, 0.3 for women',()=>{
    const count=(sex:'male'|'female')=>{let n=0;for(let i=0;i<8000;i++)if(drawCoreTraits361({draw:traitBirthDraw361(77,i+1),sex,ageYears:40}).includes('misogynist'))n++;return n;};
    const men=count('male'),women=count('female');
    expect(men).toBeGreaterThan(women*3.5);expect(women).toBeGreaterThan(0);
  });
  test('no conflict, one degree per def, work tags and growth birthdays respected',()=>{
    for(let i=0;i<4000;i++){
      const traits=drawCoreTraits361({draw:traitBirthDraw361(9,i+1),sex:i%2?'female':'male',ageYears:30,background:{childhood:'quiet-child',adulthood:'hermit'}});
      const defs=traits.map(id=>TRAITS[id].def);
      expect(new Set(defs).size).toBe(defs.length);
      for(const a of defs)for(const b of defs)if(a!==b)expect(traitDefsConflict(a,b)).toBe(false);
      // Violent (Bloodlust, Brawler, ShootingAccuracy) and Social (Abrasive) are refused.
      expect(defs.some(d=>(['Bloodlust','Brawler','ShootingAccuracy','Abrasive'] as CoreTraitDefName[]).includes(d))).toBe(false);
    }
    // Growth birthdays 7, 10 and 13: a 8-year-old draws at most one trait.
    for(let i=0;i<500;i++)expect(regular(drawCoreTraits361({draw:traitBirthDraw361(5,i+1),sex:'male',ageYears:8})).length).toBeLessThanOrEqual(1);
    for(let i=0;i<200;i++)expect(regular(drawCoreTraits361({draw:traitBirthDraw361(5,i+1),sex:'male',ageYears:5}))).toEqual([]);
  });
  test('starting candidates: Core traits at 361, tutorial candidates still able to fight',()=>{
    for(const seed of [1,42,9001]){
      for(const d of createStartingCandidateRoster(seed,{capableOfViolence:true})){
        const p=previewStartingCandidate(seed,d);
        expect(violentWorkRefusal(p)).toBeUndefined();expect(validTraits(p.traits,SCHEMA_VERSION)).toBe(true);
        if(p.traits?.includes('brawler'))expect(p.skills.shooting.passion).toBe(0);
      }
    }
    const all=Array.from({length:400},(_,i)=>previewStartingCandidate(i+1,{serial:1+i%8,generation:0}));
    expect(all.some(p=>p.traits?.some(id=>TRAITS[id].since===361))).toBe(true);
    expect(all.every(p=>validTraits(p.traits,361))).toBe(true);
  });
  test('below 361 every candidate draw is the historical one',()=>{
    // Values computed with the code of schema 358 (identical draws).
    expect(previewStartingCandidate(42,{serial:1,generation:0},360).traits).toEqual(['optimist','nervous']);
    expect(previewStartingCandidate(42,{serial:2,generation:0},360).traits).toEqual(['slow-learner','steadfast']);
    expect(previewStartingCandidate(7,{serial:5,generation:0},360).traits).toEqual(['steadfast','kind','pessimist']);
    expect(previewStartingCandidate(123456,{serial:8,generation:0},360).traits).toEqual(['pessimist','abrasive']);
    for(let i=1;i<=200;i++){const t=previewStartingCandidate(i,{serial:1+i%8,generation:i%3},360).traits!;expect(t.every(id=>LEGACY_TRAIT_IDS.includes(id))).toBe(true);expect(validTraits(t,360)).toBe(true);}
  });
  test('starting lovers follow Core orientation: same sex only with a gay elder',()=>{
    for(let seed=1;seed<=300;seed++){
      const party=previewStartingParty(seed,[{serial:1,generation:0},{serial:2,generation:0},{serial:3,generation:0}]);
      for(const link of party.relationships.links){
        const [a,b]=[party.pawns.find(p=>p.id===Math.min(link.aId,link.bId))!,party.pawns.find(p=>p.id===Math.max(link.aId,link.bId))!];
        expect(a.appearance!.sex===b.appearance!.sex).toBe(!!a.traits?.includes('gay'));
      }
    }
  });
  test('people born into a 361 world get traits; a 360 world gives none',()=>{
    const born=(version:number)=>{const p=startingPawn(77,'Visiteur',0,0,0,55,1234,0,version);giveBornTraits361({schemaVersion:version,seed:1234},p);return p;};
    expect(born(360).traits).toBeUndefined();
    const p=born(361);expect(p.traits?.length).toBeGreaterThan(0);expect(validTraits(p.traits,361)).toBe(true);
    expect(born(361).traits).toEqual(p.traits);
    // An arrival offer is drawn before the person, privately and repeatably.
    const offer=offeredTraits361(42,3,{biologicalTicks:30*HUMAN_YEAR_TICKS,chronologicalTicks:30*HUMAN_YEAR_TICKS} as Pawn['age'],undefined);
    expect(offer).toEqual(offeredTraits361(42,3,{biologicalTicks:30*HUMAN_YEAR_TICKS,chronologicalTicks:30*HUMAN_YEAR_TICKS} as Pawn['age'],undefined));
  });
});

function camp(count=1):World{const w=deconstructionCamp(count,32);for(const p of w.pawns)delete p.traits;return w;}
describe('effects through real ticks',()=>{
  test('work speed: industrious works 35 % faster, slothful 35 % slower',()=>{
    const rate=(traits?:TraitId[])=>{
      const w=camp(),p=w.pawns[0]!;if(traits)p.traits=traits;
      const wall=fixtureBuilding(w,'wall',p.x+2,p.z);
      expect(applyCommand(w,{type:'designate',kind:'deconstruct',x:wall.x,z:wall.z,targetId:wall.id}).ok).toBe(true);
      const job=()=>w.jobs.find(j=>j.deconstruction?.structureId===wall.id);
      for(let i=0;i<600&&!(job()?.progress);i++)stepWorld(w);
      const start=job()!.progress;for(let i=0;i<20;i++)stepWorld(w);
      return (job()?.progress??Infinity)-start;
    };
    const base=rate();expect(base).toBeGreaterThan(0);
    expect(rate(['industrious'])/base).toBeCloseTo(1.35,1);
    expect(rate(['slothful'])/base).toBeCloseTo(.65,1);
  });
  test('move speed: a jogger walks at 5 cells per second instead of 4.6',()=>{
    const step=(traits?:TraitId[])=>{
      const w=camp(),p=w.pawns[0]!;if(traits)p.traits=traits;
      expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
      expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x:p.x+6,z:p.z},queue:false}).ok).toBe(true);
      for(let i=0;i<5&&!p.motion;i++)stepWorld(w);
      return p.motion!.end-p.motion!.start;
    };
    expect(step(['jogger'])/step()).toBeCloseTo(4.6/5,1);
    expect(step(['slowpoke'])/step()).toBeCloseTo(4.6/4.4,1);
  });
  test('nerves: a volatile person counts time below 50, an iron-willed one only below 17',()=>{
    const below=(traits?:TraitId[])=>{const w=camp(),p=w.pawns[0]!;if(traits)p.traits=traits;for(let i=0;i<30;i++){p.mood=40;stepWorld(w);}return p.mental?.below[0]??0;};
    expect(below(['volatile'])).toBeGreaterThan(0);expect(below()).toBe(0);expect(below(['iron-willed'])).toBe(0);
    expect(breakThresholds({traits:['volatile','very-neurotic']})[0]).toBe(50);
    expect(breakThresholds({traits:['iron-willed']})[0]).toBe(17);
  });
  test('mood: sanguine +12; a night owl is happy at night and unhappy by day; psychopath and masochist',()=>{
    const w=camp(2),[a,b]=w.pawns as [Pawn,Pawn];a.traits=['night-owl','sanguine'];b.traits=['psychopath','masochist'];
    const ids=(p:Pawn)=>moodThoughts(w,p).map(t=>t.id+':'+t.offset);
    expect(ids(a)).toContain('trait-sanguine:12');
    for(let i=0;i<6000&&!(hourOfDay(calendarTick(w))>=23||hourOfDay(calendarTick(w))<=5);i++)stepWorld(w);
    expect(ids(a)).toContain('night-owl-night:16');
    for(let i=0;i<6000&&!(hourOfDay(calendarTick(w))>=11&&hourOfDay(calendarTick(w))<=17);i++)stepWorld(w);
    expect(ids(a)).toContain('night-owl-day:-10');expect(ids(a).some(id=>id.startsWith('night-owl-night'))).toBe(false);
    // Psychopath (Core nullifyingTraits): no DeniedJoining thought.
    a.deniedJoining=[w.tick+6000];b.deniedJoining=[w.tick+6000];
    expect(ids(a).some(id=>id.startsWith('denied-joining'))).toBe(true);
    expect(ids(b).some(id=>id.startsWith('denied-joining'))).toBe(false);
    expect(moodTarget(moodThoughts(w,a))).toBeLessThan(moodTarget(moodThoughts(w,{...a,traits:['sanguine']} as Pawn))+1);
  });
  test('opinion: pretty +20 seen by others, none for a kind observer; misandrist -25 of men',()=>{
    const w=camp(3),[a,b,c]=w.pawns as [Pawn,Pawn,Pawn];
    a.traits=['pretty'];c.traits=['kind'];
    expect(opinionCauses(b,a.id,w.tick,w).find(x=>x.kind==='trait-pretty')?.value).toBe(20);
    expect(opinionCauses(c,a.id,w.tick,w).some(x=>x.kind==='trait-pretty')).toBe(false);
    b.traits=['misandrist'];a.appearance={...a.appearance!,sex:'male'};c.appearance={...c.appearance!,sex:'female'};
    expect(opinionCauses(b,a.id,w.tick,w).find(x=>x.kind==='trait-man')?.value).toBe(-25);
    expect(opinionCauses(b,c.id,w.tick,w).some(x=>x.kind==='trait-man')).toBe(false);
    for(let i=0;i<20;i++)stepWorld(w);
    expect(opinionOf(b,a.id,w.tick,w)).toBeLessThanOrEqual(-5);
  });
  test('mental pool rules: gourmand minor breaks, teetotaler and chemical interest',()=>{
    const p={traits:['gourmand']} as unknown as Pawn,opts=[{kind:'food-binge',weight:.8},{kind:'sad-wander',weight:.5}];
    expect(onlyAllowedMinorBreaks361(p,opts).map(o=>o.kind)).toEqual(['food-binge']);
    expect(onlyAllowedMinorBreaks361({traits:['gourmand']} as unknown as Pawn,[opts[1]!]).map(o=>o.kind)).toEqual(['sad-wander']);
    expect(drugBingeWeight361({traits:['chemical-fascination']} as unknown as Pawn)).toBe(5);
    expect(drugBingeWeight361({traits:['chemical-interest']} as unknown as Pawn)).toBe(2.5);
    expect(toughDamage361({traits:['tough']},11)).toBe(5.5);expect(toughDamage361({traits:[]},11)).toBe(11);
  });
});

describe('saves',()=>{
  const traited=():World=>{
    const w=camp(3),[a,b,c]=w.pawns as [Pawn,Pawn,Pawn];
    a.traits=['industrious','nimble','careful-shooter','gay'];b.traits=['gourmand','night-owl','teetotaler'];c.traits=['optimist','fast-learner'];
    return w;
  };
  test('save and reload keep the traits and the continuation',()=>{
    const w=traited();expect(validateWorld(w)).toEqual([]);
    const json=serializeWorld(w),again=deserializeWorld(json);
    expect(serializeWorld(again)).toBe(json);
    for(let i=0;i<120;i++){stepWorld(w);stepWorld(again);}
    expect(serializeWorld(again)).toBe(serializeWorld(w));
  });
  test('a 361 trait is refused below 361; 360 migrates by its number only',()=>{
    expect(validTraits(['sanguine'],360)).toBe(false);expect(validTraits(['optimist','gay','industrious','nimble'],360)).toBe(false);
    expect(validTraits(['optimist','gay','industrious','nimble'],361)).toBe(true);
    expect(validTraits(['optimist','pessimist'],361)).toBe(false);expect(validTraits(['kind','psychopath'],361)).toBe(false);
    expect(validTraits(['industrious','nimble','tough','quick-sleeper'],361)).toBe(false);
    const current=serializeWorld(traited());
    expect(()=>deserializeWorld(current.replace(`{"schemaVersion":${SCHEMA_VERSION},`,'{"schemaVersion":360,'))).toThrow();
    // An older save holds only the nine older ids (the test helper drops the others).
    expect(deserializeWorld(asOldSchema(current,360)).pawns.map(p=>p.traits)).toEqual([undefined,undefined,['optimist','fast-learner']]);
    // Number-only migration of an older colony: nothing is given retroactively.
    const plain=camp(2);plain.pawns[0]!.traits=['steadfast','kind'];const old=serializeWorld(plain);
    const migrated=deserializeWorld(asOldSchema(old,360));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(serializeWorld(migrated)).toBe(asNumberOnly(old,360));
    expect(migrated.pawns.map(p=>p.traits)).toEqual([['steadfast','kind'],undefined]);
  });
});
