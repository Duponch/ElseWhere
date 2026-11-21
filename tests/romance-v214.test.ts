import { describe,expect,test } from 'vitest';
import { medicalCamp } from './scenarios/health.ts';
import { fixtureBuilding } from './scenarios/deconstruction.ts';
import { stepWorld } from '../src/sim/engine.ts';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { exchangeSocial,passiveSocialWeights } from '../src/sim/social.ts';
import { opinionCauses,opinionOf,socialImpact } from '../src/sim/social-state.ts';
import { romanceSelectionWeight,romanceSuccessChance } from '../src/sim/romance.ts';
import { expireRomanceMemories,ROMANCE_MEMORY_DEFINITIONS,romanceMoodThoughts } from '../src/sim/romance-memories.ts';
import { relationshipIndex,tryAddRelationship } from '../src/sim/relationship-runtime.ts';
import { HUMAN_YEAR_TICKS } from '../src/sim/human-age.ts';
import { backgroundSkillRefusal } from '../src/sim/colonist-backgrounds.ts';
import type { Pawn,World } from '../src/sim/types.ts';

function camp(count=3):World {
  const w=medicalCamp(count);delete w.relationships;
  for(const [n,p] of w.pawns.entries()){
    p.x=12+n;p.z=12;delete p.background;p.age={biologicalTicks:30*HUMAN_YEAR_TICKS,chronologicalTicks:1000*HUMAN_YEAR_TICKS};
    p.social={rng:1,memories:[]};delete p.romanceMemories;
    p.priorities.basic=0;
    // From schema 361 romance follows Core sexuality: bisexual people keep the
    // encounters of this fixture independent of their drawn sexes.
    p.traits=[...(p.traits??[]),'bisexual'];
  }
  return w;
}
function fond(w:World,a:Pawn,b:Pawn,ab=15,ba=15):void {
  const memories=(otherId:number,value:number)=>{
    const count=value<=20.55?1:5,total=Array.from({length:count},(_,n)=>.9**n).reduce((sum,n)=>sum+n,0);
    return Array.from({length:count},()=>({otherId,kind:'deep-talk' as const,at:w.tick,offset:value/total}));
  };
  a.social={rng:1,memories:memories(b.id,ab)};
  b.social={rng:1,memories:memories(a.id,ba)};
}
function bond(w:World,kind:'parent'|'sibling'|'lover'|'spouse',a:Pawn,b:Pawn):void {
  const aId=kind==='parent'?a.id:Math.min(a.id,b.id),bId=kind==='parent'?b.id:Math.max(a.id,b.id);
  expect(tryAddRelationship(w,{kind,aId,bId,recordedAt:w.tick})).toBe(true);
}

describe('V214 — adult encounters, directed memories and continuation',()=>{
  test('real encounter forms a couple without XP or work cancellation and saves/replays the resulting world',()=>{
    const w=camp(),[a,b]=w.pawns as [Pawn,Pawn,Pawn];fond(w,a,b);
    expect(validateWorld(w)).toEqual([]);
    const worldRng=w.rng,skills=structuredClone([a.skills,b.skills]),before=structuredClone([a.path,a.orders,a.need,a.moveCooldown,a.motion,a.jobId]);
    expect(exchangeSocial(w,a,b,'romance-attempt')).toBe(true);
    expect(relationshipIndex(w).kinds(a.id,b.id)).toEqual(['lover']);
    expect([a.skills,b.skills]).toEqual(skills);expect(w.rng).toBe(worldRng);
    expect([a.path,a.orders,a.need,a.moveCooldown,a.motion,a.jobId]).toEqual(before);
    expect(opinionOf(a,b.id,w.tick,w)).toBe(50);expect(opinionOf(b,a.id,w.tick,w)).toBe(50);
    expect(opinionCauses(a,b.id,w.tick,w).find(c=>c.kind==='relation-lover')).toMatchObject({count:1,value:35,label:'Partenaire'});
    const resumed=deserializeWorld(serializeWorld(w));stepWorld(w,80);stepWorld(resumed,80);
    expect(resumed).toEqual(w);expect(validateWorld(w)).toEqual([]);
  });

  test('a rebuff uses distinct opinion and mood clocks, then a later success clears only the Core-selected memories',()=>{
    const w=camp(),[a,b]=w.pawns as [Pawn,Pawn,Pawn];fond(w,a,b,15,6);a.social!.rng=123456789;
    expect(exchangeSocial(w,a,b,'romance-attempt')).toBe(true);
    expect(w.relationships).toBeUndefined();expect(a.romanceMemories?.map(m=>m.kind)).toEqual(['rebuffed-opinion','rebuffed-mood']);
    expect(b.romanceMemories?.map(m=>m.kind)).toEqual(['failed-opinion','failed-low-opinion-mood']);
    expect(opinionOf(a,b.id,w.tick,w)).toBe(5);expect(opinionOf(b,a.id,w.tick,w)).toBe(-9);
    expect(romanceMoodThoughts(w,a).map(t=>t.offset)).toEqual([-5]);expect(romanceMoodThoughts(w,b).map(t=>t.offset)).toEqual([-3]);
    const expiring=structuredClone(a);expireRomanceMemories(expiring,w.tick+3*6000);
    expect(expiring.romanceMemories?.map(m=>m.kind)).toEqual(['rebuffed-opinion']);
    expect(ROMANCE_MEMORY_DEFINITIONS['rebuffed-opinion'].days).toBe(10);
    stepWorld(w,12);fond(w,a,b,30,30);a.social!.rng=1;
    expect(exchangeSocial(w,a,b,'romance-attempt')).toBe(true);
    expect(relationshipIndex(w).kinds(a.id,b.id)).toEqual(['lover']);
    expect(a.romanceMemories?.map(m=>m.kind)).toEqual(['rebuffed-opinion','rebuffed-mood']);
    expect(b.romanceMemories).toBeUndefined();expect(validateWorld(w)).toEqual([]);
  });

  test('lover separation is directed; spouse separation follows its distinct branch and reuniting retains breakup mood',()=>{
    const w=camp(),[a,b]=w.pawns as [Pawn,Pawn,Pawn];fond(w,a,b);bond(w,'lover',a,b);
    expect(exchangeSocial(w,a,b,'breakup')).toBe(true);
    expect(relationshipIndex(w).kinds(a.id,b.id)).toEqual(['ex-lover']);expect(a.romanceMemories).toBeUndefined();
    expect(b.romanceMemories?.map(m=>m.kind)).toEqual(['breakup-opinion','breakup-mood']);
    expect(opinionOf(b,a.id,w.tick,w)).toBe(-50);
    stepWorld(w,12);fond(w,a,b,80,80);
    expect(exchangeSocial(w,a,b,'romance-attempt')).toBe(true);
    expect(relationshipIndex(w).kinds(a.id,b.id)).toEqual(['lover']);
    expect(b.romanceMemories?.map(m=>m.kind)).toEqual(['breakup-mood']);expect(validateWorld(w)).toEqual([]);
    const spouse=camp(),[c,d]=spouse.pawns as [Pawn,Pawn,Pawn];bond(spouse,'spouse',c,d);
    expect(exchangeSocial(spouse,c,d,'breakup')).toBe(true);
    expect(relationshipIndex(spouse).kinds(c.id,d.id)).toEqual(['ex-spouse']);expect(d.romanceMemories).toBeUndefined();
    expect(validateWorld(spouse)).toEqual([]);
  });

  test('physical absence, closed sight, existing partner and juvenile age refuse without a social draw',()=>{
    for(const reason of ['wall','partner','underage','absent'] as const){
      const w=camp(),[a,b,c]=w.pawns as [Pawn,Pawn,Pawn];fond(w,a,b);b.x=14;
      if(reason==='wall')fixtureBuilding(w,'wall',13,12);
      if(reason==='partner')bond(w,'lover',a,c);
      if(reason==='underage')b.age!.biologicalTicks=17*HUMAN_YEAR_TICKS;
      if(reason==='absent')w.pawns=w.pawns.filter(p=>p!==b);
      const capture=reason==='underage'||reason==='absent'?()=>JSON.stringify(w):()=>serializeWorld(w),before=capture(),rng=a.social!.rng;
      expect(exchangeSocial(w,a,b,'romance-attempt')).toBe(false);
      expect(a.social!.rng).toBe(rng);expect(capture()).toBe(before);
    }
  });

  test('known close and half siblings cannot evade the threshold, while cousins retain the primary .25 factor',()=>{
    const close=camp(),[a,b]=close.pawns as [Pawn,Pawn,Pawn];fond(close,a,b);bond(close,'sibling',a,b);
    expect(romanceSelectionWeight(close,a,b)).toBe(0);expect(exchangeSocial(close,a,b,'romance-attempt')).toBe(false);
    const half=camp(),[ha,hb,parent]=half.pawns as [Pawn,Pawn,Pawn];fond(half,ha,hb);bond(half,'parent',ha,parent);bond(half,'parent',hb,parent);
    expect(passiveSocialWeights(half,ha,hb)['romance-attempt']).toBe(0);
    const cousins=camp(4),[ca,cb,pa,pb]=cousins.pawns as [Pawn,Pawn,Pawn,Pawn];fond(cousins,ca,cb);
    bond(cousins,'sibling',pa,pb);bond(cousins,'parent',ca,pa);bond(cousins,'parent',cb,pb);
    expect(romanceSuccessChance(cousins,ca,cb)).toBeCloseTo(.6*.25*(15-5)/95);
    expect(romanceSelectionWeight(cousins,ca,cb)).toBeGreaterThan(0);
    expect(exchangeSocial(cousins,ca,cb,'romance-attempt')).toBe(true);expect(validateWorld(cousins)).toEqual([]);
  });

  test('Social incapacity permits the existing encounter with effective level zero and does not learn',()=>{
    const w=camp(),[a,b]=w.pawns as [Pawn,Pawn,Pawn];fond(w,a,b);
    // This background is prepared exposure, not a biography generated by the encounter.
    a.background={childhood:'sheltered-child',adulthood:'hermit'};
    expect(backgroundSkillRefusal(a,'social')).toBeDefined();a.skills.social={level:18,xp:0,dailyXp:0,passion:0};
    const neutral=structuredClone(a);neutral.skills.social!.level=0;
    expect(socialImpact(a)).toBe(socialImpact(neutral));
    expect(exchangeSocial(w,a,b,'romance-attempt')).toBe(true);expect(a.skills.social).toEqual({level:18,xp:0,dailyXp:0,passion:0});
    expect(validateWorld(w)).toEqual([]);
  });
});
