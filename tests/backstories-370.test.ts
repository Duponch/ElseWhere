import {describe,expect,test,vi} from 'vitest';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {asOldSchema,numberOnlyWorld} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';
import {CORE_BACKSTORIES_370,CORE_BACKSTORY_LIST_370,isCoreBackstoryId370,type CoreBackstory370} from '../src/sim/core-backstories-370.ts';
import {CORE_BACKSTORY_TEXTS_370} from '../src/sim/core-backstory-texts-370.ts';
import {FACTION_BACKSTORY_FILTERS_370,backstoryFiltersFor370,backstorySelectionWeight370,backstoryStream370,drawCoreBackground370,workTagsOverlapOnAnyWorkType370} from '../src/sim/core-backstory-draw-370.ts';
import {childhoodDefinition,adulthoodDefinition,backgroundWorkRefusal,validBackground,violentWorkRefusal,type ColonistBackground} from '../src/sim/colonist-backgrounds.ts';
import {generateBornBackground} from '../src/sim/background-generation.ts';
import {drawCoreTraits361,traitBirthDraw361} from '../src/sim/trait-generation-361.ts';
import {CORE_TRAIT_DEFS,TRAITS} from '../src/sim/traits.ts';
import {createStartingCandidateRoster,previewStartingCandidate,type StartingCandidateDescriptor,type StartingParty} from '../src/sim/starting-candidates.ts';
import {startingPossessions370} from '../src/sim/starting-possessions-370.ts';
import {startingPawn} from '../src/sim/starting-pawns.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {workPriority} from '../src/sim/work-types.ts';
import {priorityColumnChanges344,workSortValue344} from '../src/sim/work-tab-344.ts';
import {enableAndInitializeWork} from '../src/sim/work-initialization.ts';
import {backgroundInspectionRows,backgroundRestrictionRows} from '../src/ui/background-inspection.ts';
import {makeRaider} from '../src/sim/raid-spawn.ts';
import {HUMAN_YEAR_TICKS} from '../src/sim/human-age.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const ADULT=30*HUMAN_YEAR_TICKS;
const stories=(b:ColonistBackground):CoreBackstory370[]=>[b.childhood,b.adulthood].filter(isCoreBackstoryId370).map(id=>CORE_BACKSTORIES_370[id]);

describe('catalogue (Core BackstoryDefs/Shuffled)',()=>{
  test('166 shuffled backstories, id = Core defName, French texts for each',()=>{
    expect(CORE_BACKSTORY_LIST_370).toHaveLength(166);
    expect(CORE_BACKSTORY_LIST_370.filter(s=>s.slot==='childhood')).toHaveLength(48);
    expect(CORE_BACKSTORY_LIST_370.filter(s=>s.slot==='adulthood')).toHaveLength(118);
    expect(Object.keys(CORE_BACKSTORY_TEXTS_370).sort()).toEqual(CORE_BACKSTORY_LIST_370.map(s=>s.id).sort());
    for(const s of CORE_BACKSTORY_LIST_370){expect(s.label.length).toBeGreaterThan(1);expect(s.labelShort.length).toBeGreaterThan(1);expect(s.description.length).toBeGreaterThan(10);expect(s.description).not.toMatch(/\[PAWN_|\bthe\b|\bhis\b/i);}
  });
  test('a sample of mechanical fields, as written in the Core XML',()=>{
    const p=CORE_BACKSTORIES_370.Policeman45;
    expect([p.slot,p.categories,p.gains,p.disables,p.requires,p.body]).toEqual(['adulthood',['Offworld','ImperialCommon','Outlander'],{social:3,shooting:4,melee:3},[],['social','violent'],{m:'Male',f:'Female'}]);
    const c=CORE_BACKSTORIES_370.Chef52;
    expect([c.gains,c.disables,c.requires,c.possessions]).toEqual([{cooking:6,social:2},['cleaning','manual-dumb'],['cooking'],[['MealFine',3]]]);
    const a=CORE_BACKSTORIES_370.Assassin20;
    expect([a.gains,a.disables,a.forcedTraits,a.possessions,a.body]).toEqual([{melee:10,shooting:10},['intellectual','manual-dumb','manual-skilled','social','caring'],[['Psychopath',0]],[],{m:'Hulk',f:'Thin'}]);
    expect([CORE_BACKSTORIES_370.Scout59.forcedTraits,CORE_BACKSTORIES_370.Model99.forcedTraits,CORE_BACKSTORIES_370.MedicalAssistant12.disallowedTraits]).toEqual([[['SpeedOffset',2]],[['Beauty',2]],[['Pyromaniac',0]]]);
    expect([CORE_BACKSTORIES_370.Hermit82.requires,CORE_BACKSTORIES_370.Hermit82.categories]).toEqual([['plant-work','manual-dumb','crafting'],['Outsider','Cult']]);
    expect([CORE_BACKSTORIES_370.Taster16.body,CORE_BACKSTORIES_370.Child27.requiresCategory]).toEqual([{m:'Fat',f:'Fat'},true]);
  });
  // The whole table against the installed Core definitions, when present.
  const dir='E:/Steam/steamapps/common/RimWorld/Data/Core/Defs/BackstoryDefs/Shuffled/';
  test.skipIf(!existsSync(dir))('every mechanical field of the 166 equals the installed Core XML',()=>{
    const SK:Record<string,string>={Shooting:'shooting',Melee:'melee',Construction:'construction',Mining:'mining',Cooking:'cooking',Plants:'plants',Animals:'animals',Crafting:'crafting',Artistic:'artistic',Medicine:'medicine',Social:'social',Intellectual:'intellectual'};
    const tag=(t:string)=>t.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase();
    const block=(b:string,name:string)=>b.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];
    const lis=(t:string|undefined)=>t?[...t.matchAll(/<li>(.*?)<\/li>/g)].map(m=>m[1]!.trim()):[];
    const pairs=(t:string|undefined)=>t?[...t.matchAll(/<(\w+)([^>]*?)(?:\/>|>([^<]*)<\/\1>)/g)].map(m=>[m[1]!,m[2]!,m[3]] as const):[];
    let n=0;
    for(const file of readdirSync(dir).sort())for(const m of readFileSync(dir+file,'utf8').matchAll(/<BackstoryDef>([\s\S]*?)<\/BackstoryDef>/g)){
      const b=m[1]!,id=block(b,'defName')!.trim(),s=(CORE_BACKSTORIES_370 as Record<string,CoreBackstory370>)[id]!;n++;
      expect(s,id).toBeDefined();
      expect(s.slot).toBe(block(b,'slot')!.trim()==='Childhood'?'childhood':'adulthood');
      expect(s.categories).toEqual(lis(block(b,'spawnCategories')));
      expect(s.gains).toEqual(Object.fromEntries(pairs(block(b,'skillGains')).map(([k,,v])=>[SK[k],Number(v)])));
      expect(s.disables).toEqual(lis(block(b,'workDisables')).map(tag));
      expect(s.requires).toEqual(lis(block(b,'requiredWorkTags')).map(tag));
      expect(s.forcedTraits).toEqual(pairs(block(b,'forcedTraits')).map(([k,,v])=>[k,Number(v??0)]));
      expect(s.disallowedTraits).toEqual(pairs(block(b,'disallowedTraits')).map(([k,,v])=>[k,Number(v??0)]));
      expect(s.possessions).toEqual(pairs(block(b,'possessions')).filter(([,attr])=>!attr.includes('MayRequire')).map(([k,,v])=>[k,Number(v)]));
      expect(s.body).toEqual({...block(b,'bodyTypeGlobal')?{g:block(b,'bodyTypeGlobal')}:{},...block(b,'bodyTypeMale')?{m:block(b,'bodyTypeMale')}:{},...block(b,'bodyTypeFemale')?{f:block(b,'bodyTypeFemale')}:{}});
      expect(s.requiresCategory).toBe(block(b,'requiresSpawnCategory')?.trim()==='true');
    }
    expect(n).toBe(166);
  });
});

describe('draw (PawnBioAndNameGenerator.FillBackstorySlotShuffled)',()=>{
  const many=(filters:ReturnType<typeof backstoryFiltersFor370>,count:number,seed=7,ticks=ADULT)=>Array.from({length:count},(_,i)=>drawCoreBackground370(backstoryStream370(seed,i+1),ticks,filters));
  test('a colonist: Offworld stories, compatible pairs, no special story, no adulthood before 20',()=>{
    const drawn=many(FACTION_BACKSTORY_FILTERS_370.PlayerColony!,4000);
    for(const b of drawn){
      const [c,a]=stories(b);
      expect(c!.categories).toContain('Offworld');expect(a!.categories).toContain('Offworld');
      expect(c!.requiresCategory||a!.requiresCategory).toBe(false);
      expect(workTagsOverlapOnAnyWorkType370(a!.requires,c!.disables)).toBe(false);
      expect(validBackground(b,370,{biologicalTicks:ADULT,chronologicalTicks:ADULT})).toBe(true);
      expect(validBackground(b,369,{biologicalTicks:ADULT,chronologicalTicks:ADULT})).toBe(false);
    }
    expect(many(FACTION_BACKSTORY_FILTERS_370.PlayerColony!,50,3,19*HUMAN_YEAR_TICKS).every(b=>b.adulthood===undefined)).toBe(true);
  });
  test('frequencies follow the work-tag selection weights',()=>{
    const N=20000,count=new Map<string,number>();
    for(const b of many(FACTION_BACKSTORY_FILTERS_370.PlayerColony!,N,11))count.set(b.adulthood!,(count.get(b.adulthood!)??0)+1);
    const pool=CORE_BACKSTORY_LIST_370.filter(s=>s.slot==='adulthood'&&s.categories.includes('Offworld'));
    const mean=(w:number)=>{const of=pool.filter(s=>backstorySelectionWeight370(s)===w);return of.reduce((n,s)=>n+(count.get(s.id)??0),0)/of.length;};
    // Weight 1 against Intellectual (×0.4), Violent (×0.6) and Manual dumb (×0.5).
    expect(mean(.4)/mean(1)).toBeGreaterThan(.3);expect(mean(.4)/mean(1)).toBeLessThan(.55);
    expect(mean(.6)/mean(1)).toBeGreaterThan(.45);expect(mean(.6)/mean(1)).toBeLessThan(.75);
    expect(mean(.5)/mean(1)).toBeGreaterThan(.38);expect(mean(.5)/mean(1)).toBeLessThan(.65);
  });
  test('NPC factions and kinds read their own categories',()=>{
    const outlander=many(backstoryFiltersFor370(undefined,'OutlanderCivil'),6000,5);
    const offOnly=outlander.filter(b=>!stories(b)[1]!.categories.includes('Outlander')).length/outlander.length;
    // Outlander 0.95 / Offworld 0.05, drawn for each slot.
    expect(offOnly).toBeGreaterThan(.01);expect(offOnly).toBeLessThan(.06);
    for(const b of many(backstoryFiltersFor370('Pirate','Pirate'),500))for(const s of stories(b))expect(s.categories).toContain('Pirate');
    for(const b of many(backstoryFiltersFor370('Tribal_Warrior','TribeRough'),500))for(const s of stories(b))expect(s.categories).toContain('Tribal');
    for(const b of many(backstoryFiltersFor370('Tribal_Hunter','TribeRough'),500)){const [c,a]=stories(b);expect(c!.categories).toContain('Tribal');expect(a!.categories).toContain('TribalHunter');}
    for(const b of many(backstoryFiltersFor370('Slave','OutlanderCivil'),500))for(const s of stories(b))expect(s.categories.some(x=>['Offworld','Outlander','Outsider'].includes(x))).toBe(true);
    // A person born without a faction (and no world faction): Ancients, Offworld.
    expect(backstoryFiltersFor370('SpaceRefugee','Ancients')).toEqual(FACTION_BACKSTORY_FILTERS_370.Ancients);
  });
  test('births by kind: violence and required work tags are retried, raiders through the real producer',()=>{
    for(let id=1;id<=400;id++){
      const p=startingPawn(id,'PNJ',0,0,0,55,99,0,370);generateBornBackground({schemaVersion:370},p,99,false,false,{kind:'Tribal_Archer',fallbackFaction:'TribeCivil'});
      expect(violentWorkRefusal(p)).toBeUndefined();for(const s of stories(p.background!))expect(s.categories).toContain('Tribal');
      const g=startingPawn(id,'Garde',0,0,0,55,98,0,370);generateBornBackground({schemaVersion:370},g,98,true,false,{fallbackFaction:'OutlanderCivil'});expect(violentWorkRefusal(g)).toBeUndefined();
    }
    const w=createScenarioWorld(42,32,'crashlanded');
    const made=makeRaider(w,{groupId:1,index:0,pawnId:w.nextId,nextId:w.nextId+1,cell:{x:1,z:1},factionId:undefined,tribe:true,weapon:undefined,exiting:false,kind:'tribal-hunter'})!;
    const [c,a]=stories(made.pawn.background!);expect(c!.categories).toContain('Tribal');expect(a!.categories).toContain('TribalHunter');
    // Below 370 the historical Elsewhere draw is unchanged (values of schema 366).
    const old=startingPawn(21,'X',0,0,0,55,777,0,369);generateBornBackground({schemaVersion:369},old,777,true,false);
    expect([old.background,old.skills.shooting.level]).toEqual([{childhood:'field-child',adulthood:'builder'},9]);
  });
});

/** Deterministic search of a candidate with a property. */
function findCandidate(pred:(p:Pawn)=>boolean,from=1):{seed:number;d:StartingCandidateDescriptor;pawn:Pawn} {
  for(let seed=from;seed<from+4000;seed++)for(let serial=1;serial<=8;serial++){const d={serial,generation:0},pawn=previewStartingCandidate(seed,d);if(pred(pawn))return {seed,d,pawn};}
  throw Error('none');
}
describe('effects',()=>{
  test('forced traits are born with the person; disallowed ones never',()=>{
    // A forced trait Elsewhere delivers at the current schema (Pyromaniac from 368).
    const delivered=([def,degree]:readonly [string,number])=>CORE_TRAIT_DEFS[def as keyof typeof CORE_TRAIT_DEFS].degrees.some(id=>TRAITS[id].degree===degree&&(TRAITS[id].since??0)<=SCHEMA_VERSION);
    const forced=findCandidate(p=>stories(p.background!).some(s=>s.forcedTraits.some(delivered)));
    for(const s of stories(forced.pawn.background!))for(const [def,degree] of s.forcedTraits.filter(delivered))expect(forced.pawn.traits!.some(id=>TRAITS[id].def===def&&TRAITS[id].degree===degree)).toBe(true);
    for(let i=0;i<3000;i++){
      expect(drawCoreTraits361({draw:traitBirthDraw361(5,i+1),sex:'male',ageYears:30,background:{childhood:'MedievalSlave49',adulthood:'Assassin20'},schema:370})).toContain('psychopath');
      expect(drawCoreTraits361({draw:traitBirthDraw361(5,i+1),sex:'female',ageYears:30,background:{childhood:'Mute34',adulthood:'Scout59'},schema:370})).toContain('jogger');
      expect(drawCoreTraits361({draw:traitBirthDraw361(6,i+1),sex:'male',ageYears:30,background:{childhood:'SicklyChild55',adulthood:'CharityWorker36'},schema:370})).not.toContain('psychopath');
    }
    // The same birth without a Core story is the 361 draw.
    expect(drawCoreTraits361({draw:traitBirthDraw361(5,1),sex:'male',ageYears:30,background:{childhood:'quiet-child',adulthood:'medic'},schema:369}))
      .toEqual(drawCoreTraits361({draw:traitBirthDraw361(5,1),sex:'male',ageYears:30,background:{childhood:'quiet-child',adulthood:'medic'},schema:362}));
  });
  test('disabled work: Work tab, planner priority and Bio “Incapable de”',()=>{
    const cook=findCandidate(p=>stories(p.background!).some(s=>s.disables.includes('cooking')));
    const party:StartingParty={version:1,seed:cook.seed,selected:[cook.d,...[1,2,3,4,5,6,7,8].filter(s=>s!==cook.d.serial).slice(0,2).map(serial=>({serial,generation:0}))] as StartingParty['selected']};
    const w=createScenarioWorld(cook.seed,32,'crashlanded',undefined,party),pawn=w.pawns.find(p=>p.background?.childhood===cook.pawn.background!.childhood&&p.background?.adulthood===cook.pawn.background!.adulthood)!;
    expect(backgroundWorkRefusal(pawn,'cook')).toMatch(/^Cuisine impossible/);
    expect(pawn.priorities.cook).toBe(0);pawn.priorities.cook=1;expect(workPriority(pawn,'cook')).toBe(0);
    expect(workSortValue344(pawn,'cook')).toBe(-1);
    expect(priorityColumnChanges344(w,{work:'cook',pawnIds:[pawn.id],click:'primary'})).toEqual([]);
    expect(backgroundRestrictionRows(pawn).map(r=>r.label)).toContain('Cuisine');
    const fresh=structuredClone(pawn);fresh.priorities.cook=0;enableAndInitializeWork(fresh);expect(fresh.priorities.cook).toBe(0);
    // Bio: the French title (female when it has one) and description.
    const rows=backgroundInspectionRows(pawn),adult=adulthoodDefinition(pawn.background!.adulthood!) as CoreBackstory370;
    expect(rows[1]!.label).toBe(pawn.appearance?.sex==='female'&&adult.labelFemale?adult.labelFemale:adult.label);
    expect(rows[0]!.tooltip.body).toBe(childhoodDefinition(pawn.background!.childhood).description);
    // Core GetBodyTypeFor: the adulthood's body type.
    const body=adult.body.g??(pawn.appearance!.sex==='female'?adult.body.f:adult.body.m);expect(pawn.appearance!.bodyType).toBe(body);
  });
  test('the tutorial candidates can fight; the rest of the roster may not',()=>{
    for(const seed of [1,42,9001,31337])for(const d of createStartingCandidateRoster(seed,{capableOfViolence:true}))expect(violentWorkRefusal(previewStartingCandidate(seed,d))).toBeUndefined();
    expect(Array.from({length:400},(_,i)=>previewStartingCandidate(i+1,{serial:1,generation:0})).some(p=>violentWorkRefusal(p)!==undefined)).toBe(true);
  });
  test('starting possessions of the adulthood (25 %), left near the landing',()=>{
    const plain=['MealFine','Beer','MedicineHerbal','Jade','Kibble','Milk','Leather_Bear','Meat_Pig','BlocksMarble','MealLavish','Gun_Autopistol','MedicineUltratech'];
    const able=(p:Pawn)=>!!p.background?.adulthood&&isCoreBackstoryId370(p.background.adulthood)&&plain.includes(CORE_BACKSTORIES_370[p.background.adulthood].possessions[0]?.[0]??'');
    // The 25 % roll, over the candidates whose adulthood brings a plain item.
    let able_=0,hits=0;
    for(let seed=1;seed<=600;seed++)for(let serial=1;serial<=8;serial++){const d={serial,generation:0},p=previewStartingCandidate(seed,d);if(!able(p))continue;able_++;if(startingPossessions370(seed,d,p).length)hits++;}
    expect(able_).toBeGreaterThan(200);expect(hits/able_).toBeGreaterThan(.18);expect(hits/able_).toBeLessThan(.32);
    const own=findCandidate(p=>able(p)),fill=(seed:number,serial:number)=>{for(let generation=0;;generation++){const d={serial,generation},pawn=previewStartingCandidate(seed,d);if(able(pawn)&&startingPossessions370(seed,d,pawn).length)return {d,pawn};}};
    const {d,pawn}=fill(own.seed,own.d.serial),items=startingPossessions370(own.seed,d,pawn);
    // Only an adulthood gives possessions, at most two.
    expect(items.length).toBeGreaterThan(0);expect(items.length).toBeLessThanOrEqual(2);
    const party:StartingParty={version:1,seed:own.seed,selected:[d,...[1,2,3,4,5,6,7,8].filter(s=>s!==d.serial).slice(0,2).map(serial=>({serial,generation:0}))] as StartingParty['selected']};
    const w=createScenarioWorld(own.seed,32,'crashlanded',undefined,party);
    for(const it of items)expect(w.piles.some(p=>p.item===it.item&&p.owner.type==='ground'&&p.quantity===it.quantity)).toBe(true);
    expect(validateWorld(w)).toEqual([]);
  });
});

describe('saves',()=>{
  const game=()=>{const {seed,d}=findCandidate(p=>!!p.background?.adulthood&&isCoreBackstoryId370(p.background.adulthood));
    return createScenarioWorld(seed,32,'crashlanded',undefined,{version:1,seed,selected:[d,...[1,2,3,4,5,6,7,8].filter(s=>s!==d.serial).slice(0,2).map(serial=>({serial,generation:0}))] as StartingParty['selected']});};
  test('save, reload and continuation keep the Core backstories',()=>{
    const w=game();expect(validateWorld(w)).toEqual([]);
    expect(w.pawns.filter(p=>p.background&&isCoreBackstoryId370(p.background.childhood)).length).toBe(3);
    const json=serializeWorld(w),again=deserializeWorld(json);expect(serializeWorld(again)).toBe(json);
    for(let i=0;i<120;i++){stepWorld(w);stepWorld(again);}
    expect(serializeWorld(again)).toBe(serializeWorld(w));
  });
  test('strict below 370; 369 migrates by its number only; old stories stay valid',()=>{
    const current=serializeWorld(game());
    expect(()=>deserializeWorld(current.replace(`{"schemaVersion":${SCHEMA_VERSION},`,'{"schemaVersion":369,'))).toThrow();
    const bad=JSON.parse(current) as World;bad.pawns[0]!.background={childhood:'SewerKid57',adulthood:'Newborn79' as never};expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow();
    const mixed=JSON.parse(current) as World;mixed.pawns[0]!.background={childhood:'school-child',adulthood:'Chef52'};expect(()=>deserializeWorld(JSON.stringify(mixed))).toThrow();
    // An older save holds no Core story (the helper drops them); it migrates by its number only.
    const old=JSON.parse(asOldSchema(current,369)) as Record<string,unknown>,migrated=deserializeWorld(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(serializeWorld(migrated)).toBe(serializeWorld(numberOnlyWorld(old)));
    expect(migrated.pawns.every(p=>!p.background||!isCoreBackstoryId370(p.background.childhood))).toBe(true);
    expect(validBackground({childhood:'school-child',adulthood:'medic'},370,{biologicalTicks:ADULT,chronologicalTicks:ADULT})).toBe(true);
  });
  test('below 370 every candidate is the historical one (values of schema 366)',()=>{
    const a=previewStartingCandidate(42,{serial:1,generation:0},369),b=previewStartingCandidate(9001,{serial:5,generation:0},369);
    expect([a.background,a.traits,a.appearance!.bodyType,a.skills.construction.level,a.skills.shooting.level]).toEqual([{childhood:'settlement-child',adulthood:'hermit'},['greedy','teetotaler','fast-learner'],'Thin',4,2]);
    expect([b.background,b.traits,b.appearance!.bodyType,b.skills.construction.level,b.skills.shooting.level]).toEqual([{childhood:'school-child',adulthood:'hermit'},['lazy','optimist'],'Thin',4,3]);
    expect(isCoreBackstoryId370(previewStartingCandidate(42,{serial:1,generation:0}).background!.childhood)).toBe(true);
  });
});
