import { expect,test } from 'vitest';
import { BACKGROUND_ADULT_MIN_TICKS,BACKGROUND_SKILL_IDS,backgroundGains,backgroundSkillRefusal,backgroundWorkRefusal,validBackground } from '../src/sim/colonist-backgrounds.ts';
import { validHumanAge } from '../src/sim/human-age.ts';
import { createScenarioWorld } from '../src/sim/new-game.ts';
import { validatePawnAppearance } from '../src/sim/pawn-appearance.ts';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { validSkills } from '../src/sim/skills-save.ts';
import { createStartingCandidateRoster,materializeStartingCandidate,previewStartingCandidate,previewStartingParty,rerollStartingCandidate,rerollStartingCandidateForRoster,startingPartyFromRoster,startingPartyMissingWork,STARTING_REQUIRED_WORK,
  validStartingCandidateDescriptor,validStartingCandidateName,validStartingParty,type StartingCandidateDescriptor,type StartingParty } from '../src/sim/starting-candidates.ts';
import { startingTraits } from '../src/sim/traits.ts';
import { TRAITS,validTraits } from '../src/sim/traits.ts';
import { SCHEMA_VERSION,type Pawn } from '../src/sim/types.ts';

const personal=(pawn:Pawn)=>{const {id:_id,x:_x,z:_z,...profile}=pawn;return profile;};
const party=(seed=333)=>startingPartyFromRoster(seed,createStartingCandidateRoster(seed));

test('the ordered eight-person roster chooses its first three; moving a reserve preserves the actual person',()=>{
  const seed=333,roster=createStartingCandidateRoster(seed),before=structuredClone(roster),reserve=roster[7]!;
  const shown=previewStartingCandidate(seed,reserve);
  const reordered=roster.slice();reordered.splice(1,0,reordered.splice(7,1)[0]!);
  const selected=startingPartyFromRoster(seed,reordered);
  expect(selected.selected.map(d=>d.serial)).toEqual([1,8,2]);
  expect(previewStartingParty(seed,selected.selected).pawns[1]).toEqual(shown);
  expect(roster).toEqual(before);expect(validStartingParty(selected)).toBe(true);
  selected.selected[0].generation=9;expect(roster[0]!.generation).toBe(before[0]!.generation);
});

test('individual reroll owns a new generation and removes the old label without modifying other candidates',()=>{
  const seed=912,roster=createStartingCandidateRoster(seed),before=roster.map(d=>previewStartingCandidate(seed,d));
  roster[3]={...roster[3]!,nameOverride:'Étiquette ancienne'};
  const descriptor=structuredClone(roster[3]!);
  const changed=rerollStartingCandidate(roster[3]!);
  expect(roster[3]).toEqual(descriptor);expect(changed).toEqual({serial:4,generation:1});
  expect(previewStartingCandidate(seed,changed)).not.toEqual(before[3]);
  for(const index of [0,1,2,4,5,6,7])expect(previewStartingCandidate(seed,roster[index]!)).toEqual(before[index]);
  expect(()=>rerollStartingCandidate({serial:1,generation:0xffffffff})).toThrow();
});

test('a name edit changes only the name, and every preview owns its nested skill, health and story data',()=>{
  const seed=81337,descriptor={serial:6,generation:12},first=previewStartingCandidate(seed,descriptor);
  const renamed=previewStartingCandidate(seed,{...descriptor,nameOverride:'Camille des Aulnes'});
  expect(renamed).toEqual({...first,name:'Camille des Aulnes'});
  renamed.skills.medicine.level=20;renamed.traits!.push('bloodlust');renamed.age!.biologicalTicks++;
  renamed.background!.childhood='quiet-child';
  if(renamed.health?.ageAilments)renamed.health.ageAilments.length=0;
  expect(previewStartingCandidate(seed,descriptor)).toEqual(first);
  expect(validStartingCandidateName('A'.repeat(80))).toBe(true);
  for(const name of ['', ' A', 'A ', 'A\nB', 'A\u0000B', 'A'.repeat(81)])expect(validStartingCandidateName(name)).toBe(false);
});

test('prospective profiles have all twelve skills, compatible biographies and passions only on available skills',()=>{
  const stories=new Set<string>(),traits=new Set<string>(),ages=new Set<number>();
  for(let index=0;index<64;index++){
    const seed=Math.imul(index+1,0x9e3779b1)>>>0,pawn=previewStartingCandidate(seed,{serial:index%8+1,generation:Math.floor(index/8)});
    expect(validHumanAge(pawn.age,229)).toBe(true);expect(validBackground(pawn.background,SCHEMA_VERSION,pawn.age)).toBe(true);
    expect(validSkills(pawn.skills,0,229)).toBe(true);expect(validTraits(pawn.traits,SCHEMA_VERSION)).toBe(true);
    expect(validatePawnAppearance(pawn.appearance)).toEqual([]);
    expect(Object.keys(pawn.skills).sort()).toEqual([...BACKGROUND_SKILL_IDS,'lastResetTick'].sort());
    if(pawn.age!.biologicalTicks<BACKGROUND_ADULT_MIN_TICKS)expect(pawn.background!.adulthood).toBeUndefined();
    const gains=backgroundGains(pawn.background!);
    for(const skill of BACKGROUND_SKILL_IDS){
      const record=pawn.skills[skill]!;
      // The local 0..4 baseline has exactly one application of the story gain,
      // then (schema 361) one of the Core trait gains, each clamped to 0..20.
      const clamp=(n:number)=>Math.min(20,Math.max(0,n)),trait=(pawn.traits??[]).reduce((n,id)=>n+(TRAITS[id].skillGains?.[skill]??0),0);
      expect(record.level).toBeGreaterThanOrEqual(clamp(clamp(gains[skill]??0)+trait));
      expect(record.level).toBeLessThanOrEqual(clamp(clamp(4+(gains[skill]??0))+trait));
      expect(record.xp).toBe(0);expect(record.dailyXp).toBe(0);
      if(backgroundSkillRefusal(pawn,skill))expect(record.passion).toBe(0);
    }
    stories.add(JSON.stringify(pawn.background));pawn.traits!.forEach(id=>traits.add(id));ages.add(pawn.age!.biologicalTicks);
  }
  expect(stories.size).toBeGreaterThan(3);expect(traits.size).toBeGreaterThan(3);expect(ages.size).toBeGreaterThan(3);
});

test('a candidate keeps all birth data and needs across unrelated Thing IDs and landing placements',()=>{
  const descriptor={serial:8,generation:94,nameOverride:'Personne conservée'},seed=0xffffffff;
  const shown=previewStartingCandidate(seed,descriptor),allocated=materializeStartingCandidate(seed,descriptor,901234,7,19);
  expect(allocated.id).toBe(901234);expect(allocated.x).toBe(7);expect(allocated.z).toBe(19);
  expect(personal(allocated)).toEqual(personal(shown));
  expect(personal(materializeStartingCandidate(seed,descriptor,2,1,3))).toEqual(personal(shown));
});

test('new-world allocation publishes the selected previews, keeps terrain/stock/fauna RNG and IDs, and saves exactly',()=>{
  const selected=party(901337),roster=createStartingCandidateRoster(selected.seed);
  roster.unshift(roster.pop()!);selected.selected=startingPartyFromRoster(selected.seed,roster).selected;
  selected.selected[0]={...selected.selected[0],nameOverride:'Dernier devient premier'};
  const preview=previewStartingParty(selected.seed,selected.selected),before=structuredClone(selected);
  const legacy=createScenarioWorld(42,32,'crashlanded'),world=createScenarioWorld(42,32,'crashlanded',undefined,selected);
  expect(world.pawns.map(personal)).toEqual(preview.pawns.map(personal));
  expect(world.rng).toBe(legacy.rng);expect(world.nextId).toBe(legacy.nextId);
  expect(world.tiles).toEqual(legacy.tiles);expect(world.resources).toEqual(legacy.resources);
  expect(world.piles).toEqual(legacy.piles);expect(world.wildlife).toEqual(legacy.wildlife);
  expect(world.pawns.map(p=>p.id)).toEqual(legacy.pawns.map(p=>p.id));
  expect(world.pawns.map(p=>[p.x,p.z])).toEqual(legacy.pawns.map(p=>[p.x,p.z]));
  expect(selected).toEqual(before);expect(validateWorld(world)).toEqual([]);
  const text=serializeWorld(world);expect(deserializeWorld(text)).toEqual(world);expect(serializeWorld(deserializeWorld(text))).toBe(text);
  expect(Object.hasOwn(world,'startingParty')).toBe(false);
  expect(world.pawns.every(p=>!Object.hasOwn(p,'serial')&&!Object.hasOwn(p,'generation'))).toBe(true);
});

test('the independent candidate seed preserves people when map seed or dimensions change',()=>{
  const selected=party(76122),shown=previewStartingParty(selected.seed,selected.selected).pawns.map(personal);
  for(const [seed,size] of [[42,32],[93,32],[42,48]] as const){
    const world=createScenarioWorld(seed,size,'crashlanded',undefined,selected);
    expect(world.pawns.map(personal)).toEqual(shown);expect(validateWorld(world)).toEqual([]);
  }
});

test('prospective relations follow candidate identities through reorder and exact real-ID remapping',()=>{
  let selected:StartingParty|undefined;
  for(let index=0;index<256;index++){
    const candidate=party(Math.imul(index+1,0x9e3779b1)>>>0);
    if(previewStartingParty(candidate.seed,candidate.selected).relationships.links.length){selected=candidate;break;}
  }
  expect(selected).toBeDefined();const chosen=selected!;
  const preview=previewStartingParty(chosen.seed,chosen.selected);
  const reversed=[...chosen.selected].reverse();
  expect(previewStartingParty(chosen.seed,reversed).relationships).toEqual(preview.relationships);
  const reversedParty={...chosen,selected:reversed as StartingParty['selected']};
  const world=createScenarioWorld(42,32,'crashlanded',undefined,reversedParty);
  const realIds=new Map(reversedParty.selected.map((d,index)=>[d.serial,world.pawns[index]!.id]));
  expect(world.relationships!.links).toEqual(preview.relationships.links.map(link=>{
    const a=realIds.get(link.aId)!,b=realIds.get(link.bId)!;return {...link,aId:Math.min(a,b),bId:Math.max(a,b)};
  }));
  expect(validateWorld(world)).toEqual([]);expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  const reserve=[...chosen.selected];reserve[0]={serial:8,generation:0};
  const included=new Set(reserve.map(d=>d.serial));
  expect(previewStartingParty(chosen.seed,reserve).relationships.links.every(link=>included.has(link.aId)&&included.has(link.bId))).toBe(true);
});

test('creation without the option keeps the authored historical trio and does not introduce candidate state',()=>{
  const first=createScenarioWorld(42,32,'crashlanded'),explicit=createScenarioWorld(42,32,'crashlanded',undefined,undefined);
  expect(first).toEqual(explicit);expect(first.pawns.map(p=>p.name)).toEqual(['Ada','Noé','Mina']);
  expect(first.pawns.map(p=>p.traits)).toEqual([0,1,2].map(startingTraits));
  expect(first.pawns.map(p=>p.background!.childhood)).toEqual(['workshop-child','field-child','school-child']);
  expect(Object.hasOwn(first,'startingParty')).toBe(false);
});

test('strict party requests reject sparse/extra fields, duplicate identities and forged runtime profiles',()=>{
  const correct=party(),holes:StartingCandidateDescriptor[]=new Array(3);holes[0]=correct.selected[0];holes[2]=correct.selected[2];
  const extra=Object.assign([...correct.selected],{unexpected:true});
  const symbol=Symbol('unexpected');
  const invalid:unknown[]=[
    null,{}, {...correct,version:2}, {...correct,seed:-1}, {...correct,seed:0x100000000}, {...correct,selected:holes},
    {...correct,selected:extra}, {...correct,[symbol]:true}, {...correct,selected:[correct.selected[0],correct.selected[0],correct.selected[2]]},
    {...correct,selected:[...correct.selected,correct.selected[0]]}, {...correct,selected:[undefined,correct.selected[1],correct.selected[2]]},
    {...correct,selected:[{...correct.selected[0],skills:{construction:{level:20}}},...correct.selected.slice(1)]},
    {...correct,selected:[{serial:0,generation:0},...correct.selected.slice(1)]},
    {...correct,selected:[{serial:9,generation:0},...correct.selected.slice(1)]},
    {...correct,selected:[{serial:1,generation:-1},...correct.selected.slice(1)]},
    {...correct,selected:[{serial:1,generation:0,nameOverride:'bad\nname'},...correct.selected.slice(1)]},
  ];
  for(const value of invalid){
    expect(validStartingParty(value)).toBe(false);
    expect(()=>createScenarioWorld(42,32,'crashlanded',undefined,value as StartingParty)).toThrow();
  }
  expect(validStartingCandidateDescriptor({serial:1,generation:0,[symbol]:true})).toBe(false);
  expect(validStartingCandidateDescriptor(Object.assign(Object.create({serial:1}),{generation:0}))).toBe(false);
  expect(()=>createScenarioWorld(42,32,'survivors',undefined,correct)).toThrow();
  expect(()=>createScenarioWorld(42,32,'camp',undefined,correct)).toThrow();
  const sparseRoster=createStartingCandidateRoster(333);delete sparseRoster[5];
  expect(()=>startingPartyFromRoster(333,sparseRoster)).toThrow();
});

function manualUncoveredRoster(seed:number):StartingCandidateDescriptor[] {
  const roster=Array.from({length:8},(_,index)=>({serial:index+1,generation:0}));
  for(let index=0;index<3;index++){
    let found=false;
    for(let generation=0;generation<4096;generation++){
      const descriptor={serial:index+1,generation},pawn=previewStartingCandidate(seed,descriptor);
      // Schema 370: Core stories; three people who all refuse firefighting
      // (a pyromaniac or a medical assistant childhood) leave the team uncovered.
      if(backgroundWorkRefusal(pawn,'firefight')!==undefined){
        roster[index]=descriptor;found=true;break;
      }
    }
    expect(found).toBe(true);
  }
  return roster;
}

test('the nine installed required work types exclude doctor and initial generation covers them with bounded renewal',()=>{
  expect(STARTING_REQUIRED_WORK).toEqual(['firefight','warden','build','grow','mine','gather','craft','haul','clean']);
  expect(STARTING_REQUIRED_WORK).not.toContain('doctor');
  for(let index=0;index<64;index++){
    const seed=Math.imul(index+1,0x9e3779b1)>>>0,roster=createStartingCandidateRoster(seed);
    expect(startingPartyMissingWork(seed,roster.slice(0,3))).toEqual([]);
    expect(createStartingCandidateRoster(seed)).toEqual(roster);
    expect(roster.slice(0,3).every(d=>d.generation>=0&&d.generation<=20)).toBe(true);
    expect(roster.slice(3).every(d=>d.generation===0)).toBe(true);
  }
});

test('a manually selected incapacitated team reports actual work gaps without changing its advertised snapshot or preventing start',()=>{
  const seed=333,roster=manualUncoveredRoster(seed),selected=startingPartyFromRoster(seed,roster),before=previewStartingParty(seed,selected.selected);
  expect(startingPartyMissingWork(seed,selected.selected)).toEqual(STARTING_REQUIRED_WORK.filter(work=>before.pawns.every(p=>backgroundWorkRefusal(p,work)!==undefined)));
  expect(startingPartyMissingWork(seed,selected.selected)).toContain('firefight');
  expect(previewStartingParty(seed,selected.selected)).toEqual(before);
  const world=createScenarioWorld(42,32,'crashlanded',undefined,selected);
  expect(world.pawns.map(personal)).toEqual(before.pawns.map(personal));
  expect(validateWorld(world)).toEqual([]);expect(deserializeWorld(serializeWorld(world))).toEqual(world);
});

test('team-aware reroll renews only the chosen identity at least once and checks the selected team before stopping',()=>{
  const seed=333,roster=manualUncoveredRoster(seed),before=structuredClone(roster),original=roster[0]!;
  roster[0]={...original,nameOverride:'Ancien nom'};
  const renamedBefore=structuredClone(roster),after=rerollStartingCandidateForRoster(seed,roster,original.serial);
  expect(after[0]!.generation).toBeGreaterThan(original.generation);
  expect(after[0]!.generation).toBeLessThanOrEqual(original.generation+21);
  expect(after[0]!.nameOverride).toBeUndefined();expect(startingPartyMissingWork(seed,after.slice(0,3))).toEqual([]);
  expect(after.slice(1)).toEqual(before.slice(1));expect(roster).toEqual(renamedBefore);
  after[1]!.generation++;expect(roster[1]).toEqual(renamedBefore[1]);
  const covered=createStartingCandidateRoster(seed),renewed=rerollStartingCandidateForRoster(seed,covered,8);
  expect(renewed[7]!.generation).toBe(covered[7]!.generation+1);
  expect(renewed.slice(0,7)).toEqual(covered.slice(0,7));
});

test('renewing a reserve cannot cover disabled work in the selected three and stops after exactly twenty-one attempts',()=>{
  const seed=333,roster=manualUncoveredRoster(seed),before=structuredClone(roster);
  const after=rerollStartingCandidateForRoster(seed,roster,8);
  expect(after[7]!.generation).toBe(roster[7]!.generation+21);expect(after.slice(0,7)).toEqual(roster.slice(0,7));
  expect(startingPartyMissingWork(seed,after.slice(0,3))).toEqual(startingPartyMissingWork(seed,roster.slice(0,3)));
  expect(roster).toEqual(before);
});

test('work coverage and team-aware reroll keep the same strict descriptor and roster boundaries',()=>{
  const roster=createStartingCandidateRoster(333),holes=[...roster];delete holes[1];
  expect(()=>rerollStartingCandidateForRoster(333,holes,1)).toThrow();
  expect(()=>rerollStartingCandidateForRoster(333,roster,9)).toThrow();
  expect(()=>rerollStartingCandidateForRoster(-1,roster,1)).toThrow();
  expect(()=>startingPartyMissingWork(333,holes.slice(0,3))).toThrow();
  expect(()=>startingPartyMissingWork(333,[roster[0]!,roster[0]!,roster[2]!])).toThrow();
});
