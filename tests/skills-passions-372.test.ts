import {describe,expect,test,vi} from 'vitest';
import {deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {asOldSchema,numberOnlyWorld} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn} from '../src/sim/types.ts';
import {AGE_SKILL_FACTOR_CURVE_372,AGE_SKILL_MAX_FACTOR_CURVE_372,LEVEL_FINAL_ADJUSTMENT_CURVE_372,LEVEL_RANDOM_CURVE_372,byCurve372,evaluateCurve372,generateCoreSkills372,isSkills372,roundToInt372,skillStream372,type CoreSkillBirth372} from '../src/sim/skill-generation-372.ts';
import {BACKGROUND_SKILL_IDS,backgroundSkillRefusal,violentWorkRefusal,type BackgroundSkillId,type ColonistBackground} from '../src/sim/colonist-backgrounds.ts';
import {CORE_BACKSTORIES_370} from '../src/sim/core-backstories-370.ts';
import {generateBornBackground} from '../src/sim/background-generation.ts';
import {giveBornTraits361} from '../src/sim/trait-generation-361.ts';
import {createStartingCandidateRoster,materializeStartingCandidate,previewStartingCandidate,type StartingParty} from '../src/sim/starting-candidates.ts';
import {startingPawn} from '../src/sim/starting-pawns.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {makeRaider} from '../src/sim/raid-spawn.ts';
import {applyArrival,arrivalOfferSkills372} from '../src/sim/arrivals.ts';
import {effectiveSkillLevel} from '../src/sim/work-types.ts';
import type {TraitId} from '../src/sim/traits.ts';
import {backgroundArrivalWorld} from './helpers/backgrounds-v210.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const POLICE:ColonistBackground={childhood:'SewerKid57',adulthood:'Policeman45'};
const record=(p:Pawn,s:BackgroundSkillId)=>(p.skills as unknown as Record<BackgroundSkillId,{level:number;xp:number;dailyXp:number;passion:0|1|2}|undefined>)[s];
const summary=(p:Pawn)=>BACKGROUND_SKILL_IDS.map(s=>{const r=record(p,s);return r?`${r.level}/${r.passion}`:'-';}).join(' ');
/** A scripted stream that counts its draws. */
function scripted(values:readonly number[],rest=.5):{draw:()=>number;used:()=>number} {
  let i=0;return {draw:()=>i<values.length?values[i++]!:(i++,rest),used:()=>i};
}
const birth=(over:Partial<CoreSkillBirth372>):CoreSkillBirth372=>({draw:skillStream372(1,1),ageYears:30,background:POLICE,traits:[],...over});

// Independent reference of FinalLevelOfSkill for a skill with no or one
// backstory gain (double precision; grid integration of the uniforms).
const lerpCurve=(points:readonly (readonly [number,number])[],x:number)=>{
  if(x<=points[0]![0])return points[0]![1];if(x>=points.at(-1)![0])return points.at(-1)![1];
  const i=points.findIndex(p=>x<=p[0]),a=points[i-1]!,b=points[i]!;return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
};
const LFA=[[0,0],[10,10],[20,16],[27,20]] as const,MAXF=[[0,0],[10,.7],[35,1],[60,1.6]] as const;
const halfEven=(x:number)=>{const r=Math.round(x);return Math.abs(x%1)===.5&&r%2!==0?r-1:r;};
function reference(gain:number,age:number,steps=160):{mean:number;min:number;max:number} {
  const maxf=lerpCurve(MAXF,age),ages=maxf>1?Array.from({length:steps},(_,i)=>1+(maxf-1)*(i+.5)/steps):[1];
  const us=gain?Array.from({length:steps},(_,i)=>1+.4*(i+.5)/steps):[1];
  const level=(b:number,u:number,v:number)=>Math.min(20,Math.max(0,halfEven(lerpCurve(LFA,(b+gain*u)*v))));
  let sum=0,n=0;
  for(let b=0;b<=4;b++)for(const u of us)for(const v of ages){sum+=level(b,u,v);n++;}
  // Every factor is non-negative here: the bounds are the end points.
  return {mean:sum/n,min:level(0,1,1),max:level(4,1.4,Math.max(1,maxf))};
}

describe('FinalLevelOfSkill (PawnGenerator)',()=>{
  test('curves, Rand.ByCurve average and banker\'s rounding as in Core',()=>{
    expect([10,22.5,35,47.5,60,80].map(x=>evaluateCurve372(AGE_SKILL_MAX_FACTOR_CURVE_372,x))).toEqual([.7,.85,1,1.3,1.6,1.6].map(Math.fround));
    expect([0,3,10.5,18,70].map(x=>evaluateCurve372(AGE_SKILL_FACTOR_CURVE_372,x))).toEqual([.2,.2,.6,1,1].map(Math.fround));
    expect([-3,7,15,23.5,27,40].map(x=>evaluateCurve372(LEVEL_FINAL_ADJUSTMENT_CURVE_372,x))).toEqual([0,7,13,18,20,20]);
    expect([.5,1.5,2.5,3.5,2.4999,7.5000001].map(roundToInt372)).toEqual([0,2,2,4,2,8]);
    // Rand.ByCurveAverage of LevelRandomCurve (the Animals base): 3.0424.
    const N=40000;let sum=0,below=0,mid=0,tail=0;
    const draw=skillStream372(9,9);
    for(let i=0;i<N;i++){const x=byCurve372(LEVEL_RANDOM_CURVE_372,draw);sum+=x;expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThanOrEqual(15);if(x<.5)below++;else if(x<4)mid++;else if(x>=10)tail++;}
    expect(Math.abs(sum/N-13462.5/1475/3)).toBeLessThan(.04);
    // Areas: 75, 1050 and 25 of 1475.
    expect(Math.abs(below/N-75/1475)).toBeLessThan(.006);expect(Math.abs(mid/N-1050/1475)).toBeLessThan(.012);expect(Math.abs(tail/N-25/1475)).toBeLessThan(.004);
  });
  test('a scripted stream: hand-computed levels and passions, in Core\'s draw order',()=>{
    // SewerKid57 (Cooking +2) and Policeman45 (Social +3, Shooting +4, Melee +3), 30 years.
    expect([CORE_BACKSTORIES_370.SewerKid57.gains,CORE_BACKSTORIES_370.Policeman45.gains]).toEqual([{cooking:2},{social:3,shooting:4,melee:3}]);
    const g=1.2,s=scripted([
      .9,.25, .0,.75, .5, .3, .7,.5, .1, .5,.9, .99, .2, .4, .6,.0, .8, // levels
      Math.exp(-g*g/2),.25, .1,.9,.2,.3, // Gaussian 1.2: 6.2 points; major, minor, major, major
    ]);
    const r=generateCoreSkills372(birth({draw:s.draw}));
    // Shooting 4+4×1.1=8.4; Melee 0+3×1.3=3.9; Cooking 3+2×1.2=5.4; Animals ByCurve 2.708; Social 3+3×1=6.
    expect(BACKGROUND_SKILL_IDS.map(k=>r[k].level)).toEqual([8,4,2,1,5,0,3,4,1,2,6,4]);
    // Majors to Shooting, Social, Cooking, then the minor to Melee (4, before Crafting and Intellectual).
    expect(BACKGROUND_SKILL_IDS.map(k=>r[k].passion)).toEqual([2,1,0,0,2,0,0,0,0,0,2,0]);
    expect(s.used()).toBe(17+2+4);
  });
  test('age above 35 draws a factor; a kind\'s skill range redraws inside it',()=>{
    // 60 years: 8.4 × Rand.Range(1,1.6)=1.3 → 10.92 → LevelFinalAdjustmentCurve 10.552 → 11.
    expect(generateCoreSkills372(birth({draw:scripted([.9,.25,.5]).draw,ageYears:60})).shooting.level).toBe(11);
    // Mercenary_Sniper Shooting 8~16: 0+4×1=4 is outside, Rand.RangeInclusive(8,16) at .5 gives 12.
    const s=scripted([0,0,.5]),sniper=generateCoreSkills372(birth({draw:s.draw,kind:'Mercenary_Sniper'}));
    expect(sniper.shooting.level).toBe(12);
    const plain=scripted([0,0,.5]);generateCoreSkills372(birth({draw:plain.draw}));
    expect(s.used()).toBe(plain.used()+1);
    for(let i=0;i<600;i++){
      expect(generateCoreSkills372(birth({draw:skillStream372(3,i),kind:'Mercenary_Gunner'})).shooting.level).toBeGreaterThanOrEqual(4);
      const soldier=generateCoreSkills372(birth({draw:skillStream372(4,i),ageYears:70,kind:'AncientSoldier'})).shooting.level;
      expect(soldier).toBeGreaterThanOrEqual(4);expect(soldier).toBeLessThanOrEqual(18);
    }
  });
  test('level distribution: mean and limits against the formula, by age and backstory gain',()=>{
    const N=8000;
    for(const age of [25,50,75]){
      const levels:Record<BackgroundSkillId,number[]>=Object.fromEntries(BACKGROUND_SKILL_IDS.map(k=>[k,[]])) as never;
      for(let i=0;i<N;i++){const r=generateCoreSkills372(birth({draw:skillStream372(age,i),ageYears:age}));for(const k of BACKGROUND_SKILL_IDS)levels[k].push(r[k].level);}
      for(const [skill,gain] of [['construction',0],['cooking',2],['social',3],['shooting',4]] as const){
        const ref=reference(gain,age),got=levels[skill];
        expect(Math.abs(got.reduce((a,b)=>a+b,0)/N-ref.mean),`${skill} ${age}`).toBeLessThan(.1);
        expect(Math.min(...got)).toBeGreaterThanOrEqual(ref.min);expect(Math.max(...got)).toBeLessThanOrEqual(ref.max);
      }
      for(const k of BACKGROUND_SKILL_IDS)for(const v of levels[k]){expect(Number.isInteger(v)).toBe(true);expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(20);}
    }
    // Up to 35 years the age changes nothing (no draw, factor 1).
    expect(generateCoreSkills372(birth({draw:skillStream372(5,5),ageYears:20}))).toEqual(generateCoreSkills372(birth({draw:skillStream372(5,5),ageYears:35})));
  });
});

describe('passions (GenerateSkills)',()=>{
  // Expected count: 5 + Clamp(Gaussian,−4,4) points; while ≥1: major (1.5)
  // on a coin when ≥1.5, else minor (1).
  const expectedCount=():{count:number;major:number}=>{
    const memo=new Map<number,[number,number]>();
    const f=(p:number):[number,number]=>{const key=Math.round(p*1e4);if(memo.has(key))return memo.get(key)!;
      let r:[number,number];if(p<1)r=[0,0];else if(p>=1.5){const a=f(p-1.5),b=f(p-1);r=[1+.5*a[0]+.5*b[0],.5*(1+a[1])+.5*b[1]];}else{const b=f(p-1);r=[1+b[0],b[1]];}
      memo.set(key,r);return r;};
    let count=0,major=0,mass=0;
    for(let z=-8;z<=8;z+=.002){const w=Math.exp(-z*z/2);const [c,m]=f(5+Math.max(-4,Math.min(4,z)));count+=w*c;major+=w*m;mass+=w;}
    return {count:count/mass,major:major/mass};
  };
  test('count of passions and majors follow the Gaussian budget',()=>{
    const N=12000;let count=0,major=0;
    for(let i=0;i<N;i++){
      const r=generateCoreSkills372(birth({draw:skillStream372(77,i)}));
      const c=BACKGROUND_SKILL_IDS.filter(k=>r[k].passion>0).length,m=BACKGROUND_SKILL_IDS.filter(k=>r[k].passion===2).length;
      expect(c).toBeGreaterThanOrEqual(1);expect(c+.5*m).toBeLessThanOrEqual(9);count+=c;major+=m;
    }
    const e=expectedCount();
    expect(Math.abs(count/N-e.count)).toBeLessThan(.05);expect(Math.abs(major/N-e.major)).toBeLessThan(.05);
  });
  test('eligibility: highest levels first, majors first, never a disabled skill; Brawler and Tortured artist',()=>{
    let brawlers=0,artists=0,disabledSeen=0;
    for(let seed=1;seed<=500;seed++)for(let serial=1;serial<=8;serial++){
      const p=previewStartingCandidate(seed,{serial,generation:0}),traits=p.traits??[];
      const enabled=BACKGROUND_SKILL_IDS.filter(k=>backgroundSkillRefusal(p,k)===undefined);
      for(const k of BACKGROUND_SKILL_IDS.filter(k=>!enabled.includes(k))){disabledSeen++;expect(record(p,k)!.passion).toBe(0);expect(effectiveSkillLevel(p,k,record(p,k)!.level)).toBe(0);}
      if(traits.includes('brawler')){brawlers++;expect(record(p,'shooting')!.passion).toBe(0);}
      if(traits.includes('tortured-artist')&&enabled.includes('artistic')){artists++;expect(record(p,'artistic')!.passion).toBeGreaterThan(0);}
      if(traits.includes('tortured-artist'))continue;
      const ranked=enabled.filter(k=>!(k==='shooting'&&traits.includes('brawler')));
      const level=(k:BackgroundSkillId)=>record(p,k)!.level,passion=(k:BackgroundSkillId)=>record(p,k)!.passion;
      const with_=ranked.filter(k=>passion(k)>0),without=ranked.filter(k=>passion(k)===0);
      if(with_.length&&without.length)expect(Math.min(...with_.map(level))).toBeGreaterThanOrEqual(Math.max(...without.map(level)));
      const majors=ranked.filter(k=>passion(k)===2),minors=ranked.filter(k=>passion(k)===1);
      if(majors.length&&minors.length)expect(Math.min(...majors.map(level))).toBeGreaterThanOrEqual(Math.max(...minors.map(level)));
    }
    expect(brawlers).toBeGreaterThan(20);expect(artists).toBeGreaterThan(5);expect(disabledSeen).toBeGreaterThan(200);
    // Forced first: a Gaussian of −3.4 leaves 1.6 points, one major passion
    // (coin .1); the forced Art passion takes it before any higher skill.
    const forced=generateCoreSkills372(birth({draw:scripted([...Array(17).fill(.5),Math.exp(-3.4*3.4/2),.75,.1]).draw,traits:['tortured-artist' as TraitId]}));
    expect(BACKGROUND_SKILL_IDS.map(k=>forced[k].passion)).toEqual(BACKGROUND_SKILL_IDS.map(k=>k==='artistic'?2:0));
    // Brawler: its −10 Shooting enters the formula before the final curve.
    const brawler=generateCoreSkills372(birth({draw:scripted([.9,.25]).draw,traits:['brawler' as TraitId]}));
    expect(brawler.shooting.level).toBe(0);expect(brawler.shooting.passion).toBe(0);
  });
  test('a disabled skill keeps its computed level and gets no passion',()=>{
    // Assassin20 disables Intellectual, Social, caring, manual work: Core still sets their levels.
    const b:ColonistBackground={childhood:'ChildSpy47',adulthood:'Assassin20'};
    let positive=0;
    for(let i=0;i<300;i++){
      const r=generateCoreSkills372(birth({draw:skillStream372(8,i),background:b}));
      for(const k of ['intellectual','social','medicine','construction'] as const){expect(r[k].passion).toBe(0);if(r[k].level>0)positive++;}
    }
    expect(positive).toBeGreaterThan(300);
  });
});

describe('births at schema 372',()=>{
  test('a starting candidate end to end: same background and traits as 371, Core skills, materialized as shown',()=>{
    expect(isSkills372(SCHEMA_VERSION)).toBe(true);
    const pins:Record<string,string>={'42:1':'1/0 2/0 3/1 10/2 3/0 4/1 6/2 3/0 2/0 1/0 1/0 1/0','9001:5':'9/2 1/0 2/2 1/0 0/0 1/0 2/0 0/0 3/0 3/2 1/0 2/0'};
    for(const [seed,serial] of [[42,1],[9001,5]] as const){
      const d={serial,generation:0},now=previewStartingCandidate(seed,d,372),before=previewStartingCandidate(seed,d,371);
      expect([now.background,now.traits,now.age,now.appearance]).toEqual([before.background,before.traits,before.age,before.appearance]);
      expect(summary(now)).toBe(pins[`${seed}:${serial}`]);
      for(const k of BACKGROUND_SKILL_IDS)expect([record(now,k)!.xp,record(now,k)!.dailyXp]).toEqual([0,0]);
      const made=materializeStartingCandidate(seed,d,500,3,4,372);
      expect([made.skills,made.background,made.traits]).toEqual([now.skills,now.background,now.traits]);
      // A reroll is a new person with its own skill stream.
      expect(summary(previewStartingCandidate(seed,{serial,generation:1},372))).not.toBe(summary(now));
    }
  });
  test('the tutorial rule still holds',()=>{
    for(const seed of [1,42,9001])for(const d of createStartingCandidateRoster(seed,{capableOfViolence:true}))expect(violentWorkRefusal(previewStartingCandidate(seed,d))).toBeUndefined();
  });
  test('NPC births: the real producers, a raider\'s kind range, an arrival as its letter',()=>{
    const p=startingPawn(21,'X',0,0,0,55,777,0,372);generateBornBackground({schemaVersion:372},p,777,true,false,{fallbackFaction:'Pirate',violent:true});giveBornTraits361({schemaVersion:372,seed:777},p,true);
    expect([p.background,p.traits,summary(p)]).toEqual([{childhood:'Pyromaniac18',adulthood:'Bartender62'},['pyromaniac','jogger'],'0/0 4/1 1/0 2/0 2/0 1/0 4/1 1/0 7/2 4/0 6/1 1/0']);
    const w=createScenarioWorld(42,32,'crashlanded');
    for(let i=0;i<60;i++){
      const made=makeRaider(w,{groupId:1,index:i,pawnId:w.nextId+2*i,nextId:w.nextId+2*i+1,cell:{x:1,z:1},factionId:undefined,tribe:false,weapon:undefined,exiting:false,kind:'mercenary-gunner'})!;
      expect(made.pawn.skills.shooting.level).toBeGreaterThanOrEqual(4);expect(made.pawn.skills.shooting.level).toBeLessThanOrEqual(14);
      expect(BACKGROUND_SKILL_IDS.every(k=>record(made.pawn,k)!==undefined)).toBe(true);
    }
    const arrivals=backgroundArrivalWorld(),offer=structuredClone(arrivals.arrivals!.pending!),shown=arrivalOfferSkills372(arrivals,offer)!;
    expect(shown).toBeDefined();
    addGroundMaterial(arrivals,'wood',1,{x:2,z:2});const admittedId=arrivals.nextId;
    expect(applyArrival(arrivals,{type:'answer-arrival',offerId:offer.id,accept:true}).ok).toBe(true);
    const newcomer=arrivals.pawns.find(q=>q.id===admittedId)!;
    expect(newcomer.background).toEqual(offer.background);expect(newcomer.traits).toEqual(offer.traits);
    expect({...newcomer.skills,lastResetTick:-1}).toEqual(shown);
  });
});

describe('saves',()=>{
  const game=()=>{const seed=42,selected=[1,2,3].map(serial=>({serial,generation:0})) as StartingParty['selected'];return createScenarioWorld(seed,32,'crashlanded',undefined,{version:1,seed,selected});};
  test('the colonists are born with Core skills; save, reload and continuation keep them',()=>{
    const w=game();expect(validateWorld(w)).toEqual([]);
    const colonists=w.pawns.filter(p=>p.background?.adulthood);expect(colonists).toHaveLength(3);
    for(const [i,p] of colonists.entries())expect(summary(p)).toBe(summary(previewStartingCandidate(42,{serial:i+1,generation:0})));
    const json=serializeWorld(w),again=deserializeWorld(json);expect(serializeWorld(again)).toBe(json);
    for(let i=0;i<120;i++){stepWorld(w);stepWorld(again);}
    expect(serializeWorld(again)).toBe(serializeWorld(w));
  });
  test('371 migrates by its number only; nothing is regenerated',()=>{
    const old=JSON.parse(asOldSchema(serializeWorld(game()),371)) as Record<string,unknown>,migrated=deserializeWorld(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(serializeWorld(migrated)).toBe(serializeWorld(numberOnlyWorld(old)));
    expect((migrated.pawns.map(summary))).toEqual((old.pawns as Pawn[]).map(summary));
  });
  test('below 372 every birth is unchanged (values of schema 371)',()=>{
    const a=previewStartingCandidate(42,{serial:1,generation:0},371),b=previewStartingCandidate(9001,{serial:5,generation:0},371);
    expect([a.background,a.traits,summary(a)]).toEqual([{childhood:'CaveworldTunneler48',adulthood:'AnimalFarmer21'},['undergrounder','jealous','teetotaler'],'3/0 4/0 5/0 9/2 0/0 2/0 9/1 2/0 1/0 0/0 0/0 1/0']);
    expect([b.background,b.traits,summary(b)]).toEqual([{childhood:'ShopKid36',adulthood:'Defector78'},['lazy','optimist'],'8/2 0/0 4/2 1/0 4/0 0/0 3/2 1/0 4/0 4/0 0/0 2/0']);
    const p=startingPawn(21,'X',0,0,0,55,777,0,371);generateBornBackground({schemaVersion:371},p,777,true,false,{fallbackFaction:'Pirate',violent:true});giveBornTraits361({schemaVersion:371,seed:777},p,true);
    expect([p.background,p.traits,summary(p)]).toEqual([{childhood:'Pyromaniac18',adulthood:'Bartender62'},['pyromaniac','jogger'],'8/1 10/0 8/1 8/1 8/1 8/1 8/0 - 3/0 6/1 1/0 8/1']);
    const w=createScenarioWorld(42,32,'crashlanded');(w as {schemaVersion:number}).schemaVersion=371;
    const made=makeRaider(w,{groupId:1,index:0,pawnId:w.nextId,nextId:w.nextId+1,cell:{x:1,z:1},factionId:undefined,tribe:false,weapon:undefined,exiting:false,kind:'mercenary-gunner'})!;
    expect([made.pawn.background,made.pawn.traits,summary(made.pawn)]).toEqual([{childhood:'VatgrownSoldier8',adulthood:'ContractMiner86'},['kind','jogger','teetotaler'],'8/1 8/0 8/1 16/1 8/1 8/1 8/0 - - 6/1 - 8/1']);
  });
});
