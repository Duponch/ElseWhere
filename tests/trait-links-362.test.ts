import {expect,test,vi} from 'vitest';

/* Schema 362: the Core traits that tie wave 5 together (Undergrounder,
 * Tortured artist, Wimp, and the inspiration trait rules). The private
 * streams of the inspiration check (360), the trait mental state giver (361)
 * and the mental recovery roll (362) are pure functions of seed, pawn and
 * tick; a few tests script one draw (as Rand.PushState would), every other
 * call keeps the real stream. */
const hook=vi.hoisted(()=>({recovery:new Map<number,number>(),recoveryCalls:[] as string[],inspiration:new Map<string,number[]>(),gourmand:new Set<number>()}));
vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));
vi.mock('../src/sim/trait-links-stream-362.ts',async importOriginal=>{
  const real=await importOriginal<typeof import('../src/sim/trait-links-stream-362.ts')>();
  return {mentalRecoveryRoll362:(seed:number,id:number,tick:number)=>{hook.recoveryCalls.push(`${id}@${tick}`);return hook.recovery.get(id)??real.mentalRecoveryRoll362(seed,id,tick);}};
});
vi.mock('../src/sim/inspiration-stream-360.ts',async importOriginal=>{
  const real=await importOriginal<typeof import('../src/sim/inspiration-stream-360.ts')>();
  return {inspirationStream360:(seed:number,id:number,tick:number)=>{
    const scripted=hook.inspiration.get(`${id}@${tick}`);
    if(!scripted)return real.inspirationStream360(seed,id,tick);
    const queue=[...scripted];return ()=>queue.length?queue.shift()!:0;
  }};
});
vi.mock('../src/sim/trait-mental-361.ts',async importOriginal=>{
  const real=await importOriginal<typeof import('../src/sim/trait-mental-361.ts')>();
  return {...real,traitMentalStateRoll361:(seed:number,id:number,tick:number)=>hook.gourmand.has(id)?0:real.traitMentalStateRoll361(seed,id,tick)};
});

import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeCampaign,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {CORE_TRAIT_DEFS,CORE_TRAIT_DEF_NAMES,TRAITS,traitDefCommonality,traitDefsConflict,validTraits,type TraitId} from '../src/sim/traits.ts';
import {drawCoreTraits361,giveBornTraits361,traitBirthDraw361} from '../src/sim/trait-generation-361.ts';
import {createStartingCandidateRoster,previewStartingCandidate} from '../src/sim/starting-candidates.ts';
import {violentWorkRefusal} from '../src/sim/colonist-backgrounds.ts';
import {traitMoodThoughts361} from '../src/sim/trait-thoughts-361.ts';
import {outdoorsLevel359,outdoorsNeedApplies359} from '../src/sim/outdoors-need-359.ts';
import {advanceCaravanIndoors362,indoorsLevel362,indoorsNeedApplies362,indoorsStage362,indoorsStep362} from '../src/sim/indoors-need-362.ts';
import {isTraitLinks362,markCrisisNotMood362,traitDisallowsInspiration362} from '../src/sim/trait-links-362.ts';
import {bornWimpRecord362} from '../src/sim/wimp-record-362.ts';
import {startSadWander} from '../src/sim/mental-break.ts';
import {MENTAL_CRISIS_CATALOG} from '../src/sim/mental-catalog.ts';
import {inspirationCanOccur360,startInspiration360} from '../src/sim/inspirations-360.ts';
import {groupPawnInterval256} from '../src/sim/group-core-cadence-256.ts';
import {campaignLetters352,stackLetters352} from '../src/sim/letters-352.ts';
import {addResolvedInjury,medicalPain,medicalStatus} from '../src/sim/injury-state.ts';
import {pawnBody} from '../src/sim/health-rules.ts';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector.ts';
import type {NativeUiActions,NativeUiState} from '../src/ui3d/native-contract.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';

const f=Math.fround;
const delta=(rate:number)=>f(f(rate)*f(.0025));
const idle={handle:0,clean:0,firefight:0,warden:0,basic:0,hunt:0,research:0,patient:0,bedrest:0,doctor:0,art:0,craft:0,mine:0,gather:0,build:0,haul:0,grow:0,cook:0} as Pawn['priorities'];
const regular=(t:readonly TraitId[])=>t.filter(id=>!CORE_TRAIT_DEFS[TRAITS[id].def].sexuality);

/** Prepared fixture from a fresh world at tick 0: grass, no resources or
 * piles, three adults who take no work, without background. Every need step,
 * thought, break end and collapse below comes from real ticks. */
function camp(version=SCHEMA_VERSION as number):World {
  const w=createWorld(362,32,32);
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
  w.pawns=w.pawns.slice(0,3);expect(w.pawns).toHaveLength(3);
  for(const p of w.pawns){Object.assign(p,{hunger:100,rest:100});p.priorities={...idle};delete p.background;delete p.traits;}
  w.schemaVersion=version as typeof SCHEMA_VERSION;refreshStock(w);return w;
}
const cells=(w:World,x0:number,z0:number,x1:number,z1:number)=>{const r:number[]=[];for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)r.push(z*w.width+x);return r;};
function walls(w:World,x0:number,z0:number,x1:number,z1:number,door?:{x:number;z:number}):void {
  for(let x=x0-1;x<=x1+1;x++)for(let z=z0-1;z<=z1+1;z++){
    if(x>=x0&&x<=x1&&z>=z0&&z<=z1)continue;
    if(door&&door.x===x&&door.z===z)w.structures.push({id:w.nextId++,kind:'door',x,z,orientation:0,footprint:'standard',material:'wood',door:newDoorState(w.tick)});
    else w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard'});
  }
}
/** A room under the mountain (natural thick roof), a room under a built roof
 * and the open sky; three undergrounders, one in each, drafted in place. */
function shelters(){
  const w=camp();
  walls(w,2,2,4,4);walls(w,2,10,4,12);
  w.roofing={constructed:cells(w,2,10,4,12),build:[],remove:[],cursor:0,natural:{thin:[],thick:cells(w,2,2,4,4)}};
  const [under,inside,sky]=w.pawns as [Pawn,Pawn,Pawn];
  Object.assign(under,{x:3,z:3});Object.assign(inside,{x:3,z:11});Object.assign(sky,{x:20,z:20});
  for(const p of w.pawns){p.traits=['undergrounder'];expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);}
  return {w,under,inside,sky};
}
function live(w:World,ticks:number,each?:()=>void):void {
  for(let done=0;done<ticks;done+=150){for(const p of w.pawns){p.hunger=100;p.rest=100;}stepWorld(w,Math.min(150,ticks-done));each?.();}
}
const ids=(w:World,p:Pawn)=>moodThoughts(w,p).map(t=>t.id);
function needsPage(world:World,pawn:Pawn){
  const state:NativeUiState={world,epoch:362,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[pawn.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  const noop=()=>{};
  const actions:NativeUiActions={command:async()=>({ok:true}),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:noop,readState:()=>state};
  setNativeInspectorTab('needs');return buildNativeInspector(state,actions)!;
}

test('Core data: three degrees from 362 with their commonalities and conflicts',()=>{
  expect(isTraitLinks362(361)).toBe(false);expect(isTraitLinks362(SCHEMA_VERSION)).toBe(true);
  expect([TRAITS.undergrounder,TRAITS['tortured-artist'],TRAITS.wimp].map(t=>[t.def,t.since])).toEqual([['Undergrounder',362],['TorturedArtist',362],['Wimp',362]]);
  expect(['Undergrounder','TorturedArtist','Wimp','Pyromaniac'].map(d=>CORE_TRAIT_DEFS[d as 'Wimp'].commonality)).toEqual([.2,.6,1,.8]);
  // Pyromaniac stays out (doc): it is never drawn.
  expect(CORE_TRAIT_DEFS.Pyromaniac.degrees).toEqual([]);
  expect(traitDefsConflict('Wimp','Brawler')).toBe(true);expect(traitDefsConflict('Masochist','Wimp')).toBe(true);
  expect(CORE_TRAIT_DEFS.Wimp.allowOnHostileSpawn).toBe(false);
  // The tortured artist's permanent thought (MoodOffsetTorturedArtist −8).
  expect(TRAITS['tortured-artist'].mood).toBe(-8);
  for(const id of ['undergrounder','tortured-artist','wimp'] as const){expect(validTraits([id],361)).toBe(false);expect(validTraits([id],362)).toBe(true);}
  expect(validTraits(['wimp','brawler'],362)).toBe(false);expect(validTraits(['masochist','wimp'],362)).toBe(false);
});

test('generation at 362 draws the new traits at Core\'s frequencies; 361 draws are unchanged; tutorial candidates still fight',()=>{
  const drawable=CORE_TRAIT_DEF_NAMES.filter(d=>CORE_TRAIT_DEFS[d].degrees.length>0);
  expect(drawable).toEqual(expect.arrayContaining(['Undergrounder','TorturedArtist','Wimp']));
  const N=14000,first:Record<string,number>={};let hostileWimps=0;
  for(let i=0;i<N;i++){
    const traits=drawCoreTraits361({draw:traitBirthDraw361(362362,i+1),sex:'male',ageYears:30,schema:362});
    expect(validTraits(traits,362)).toBe(true);
    const def=TRAITS[traits[0]!].def;first[def]=(first[def]??0)+1;
    if(drawCoreTraits361({draw:traitBirthDraw361(9,i+1),sex:'female',ageYears:30,hostile:true,schema:362}).includes('wimp'))hostileWimps++;
  }
  const total=drawable.reduce((s,d)=>s+traitDefCommonality(d,'male'),0);
  for(const def of drawable){
    const expected=traitDefCommonality(def,'male')/total,observed=(first[def]??0)/N;
    expect(Math.abs(observed-expected)).toBeLessThan(4*Math.sqrt(expected*(1-expected)/N)+.002);
  }
  expect(first.Undergrounder).toBeGreaterThan(0);expect(first.TorturedArtist).toBeGreaterThan(0);expect(first.Wimp).toBeGreaterThan(0);
  // allowOnHostileSpawn false: a hostile birth is never a wimp.
  expect(hostileWimps).toBe(0);
  // Below 362 every draw is the one of the 361 code (hashes computed with origin/main at schema 361).
  let h=0;const mix=(s:string)=>{for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;};
  for(let i=0;i<240;i++){const p=previewStartingCandidate(1000+i,{serial:1+i%8,generation:i%3},361);mix(JSON.stringify([p.traits,p.skills,p.health??null]));}
  expect(h).toBe(3244278862);
  h=0;for(let i=0;i<2000;i++)mix(JSON.stringify(drawCoreTraits361({draw:traitBirthDraw361(31337,i+1),sex:i%3===0?'female':i%3===1?'male':'none',ageYears:8+i%40,hostile:i%5===0})));
  expect(h).toBe(2342343626);
  // From 362 the candidates change: some hold a new degree, with its birth effects.
  const all=Array.from({length:600},(_,i)=>previewStartingCandidate(i+1,{serial:1+i%8,generation:0},362));
  for(const id of ['undergrounder','tortured-artist','wimp'] as const)expect(all.some(p=>p.traits?.includes(id))).toBe(true);
  for(const p of all){
    expect(validTraits(p.traits,362)).toBe(true);
    expect(!!p.health?.wimp362).toBe(!!p.traits?.includes('wimp'));
    // forcedPassions Artistic: at least a minor passion.
    if(p.traits?.includes('tortured-artist'))expect(p.skills.artistic!.passion).toBeGreaterThan(0);
  }
  // The tutorial rule: every candidate can fight.
  for(const seed of [3,62,362])for(const d of createStartingCandidateRoster(seed,{capableOfViolence:true})){
    const p=previewStartingCandidate(seed,d);expect(violentWorkRefusal(p)).toBeUndefined();expect(validTraits(p.traits,SCHEMA_VERSION)).toBe(true);
  }
  // A born person of a 362 world: giveBornTraits361 draws the 362 set.
  const w=camp();let born:Pawn|undefined;
  for(let i=0;i<400&&!born;i++){const p=structuredClone(w.pawns[0]!);p.id=1000+i;delete p.traits;delete p.health;giveBornTraits361(w,p);if((p.traits as TraitId[]|undefined)?.includes('wimp'))born=p;}
  expect(born?.health?.wimp362).toBe(true);
});

test('an undergrounder keeps no outdoors need, gains its indoors need and the Core thoughts under a roof',()=>{
  const {w,under,inside,sky}=shelters();
  for(const p of w.pawns){expect(outdoorsNeedApplies359(p)).toBe(false);expect(indoorsNeedApplies362(p)).toBe(true);}
  // Prepared low indoors level, then two real need intervals (30 local ticks).
  for(const p of w.pawns)p.indoors362=f(.5);
  live(w,30);
  expect(under.indoors362).toBe(f(f(f(.5)+delta(2))+delta(2)));
  expect(inside.indoors362).toBe(f(f(f(.5)+delta(1))+delta(1)));
  expect(sky.indoors362).toBe(f(f(f(.5)+delta(-.25))+delta(-.25)));
  // The outdoors need never appears (Pawn_NeedsTracker.RemoveNeed).
  for(const p of w.pawns){expect(p.outdoors359).toBeUndefined();expect(outdoorsLevel359(p)).toBe(1);}
  expect(ids(w,under)).toEqual(expect.arrayContaining(['undergrounder-underground','indoors-outdoors']));
  expect(ids(w,inside)).toEqual(expect.arrayContaining(['undergrounder-indoors','indoors-outdoors']));
  expect(ids(w,sky)).toEqual(expect.arrayContaining(['undergrounder-outdoors','indoors-outdoors']));
  for(const p of w.pawns)expect(ids(w,p).some(id=>id.startsWith('outdoors-'))).toBe(false);
  expect(moodThoughts(w,under).find(t=>t.id==='undergrounder-underground')).toMatchObject({label:'Souterrain sous la roche',offset:4});
  expect(moodThoughts(w,inside).find(t=>t.id==='undergrounder-indoors')).toMatchObject({offset:3});
  expect(moodThoughts(w,sky).find(t=>t.id==='undergrounder-outdoors')).toMatchObject({offset:-3});
  // Rises to full under a roof (no thought), falls without a floor outdoors.
  live(w,6000);
  expect(under.indoors362).toBeUndefined();expect(inside.indoors362).toBeUndefined();
  expect(ids(w,under).some(id=>id.startsWith('indoors-'))).toBe(false);
  expect(sky.indoors362).toBeLessThan(.45);
  // Need_Indoors thresholds and its five thoughts.
  expect([1,f(.8001),f(.8),f(.6),f(.4),f(.2),f(.05),0].map(indoorsStage362)).toEqual([undefined,undefined,0,1,2,3,4,4]);
  sky.indoors362=f(.04);expect(moodThoughts(w,sky).find(t=>t.id.startsWith('indoors-'))).toMatchObject({id:'indoors-brutal-outdoors',offset:-8});
  expect(indoorsStep362(f(.0001),'outdoors-open')).toBe(0);expect(indoorsStep362(f(.3),'outdoors-thick')).toBe(f(.3));expect(indoorsStep362(f(.3),'indoors-open')).toBe(f(.3));
  // EnvironmentDark is nullified for an undergrounder (and still given to others).
  const dark={id:'environment-dark',label:'Obscurité',offset:-5,kind:'situation' as const,description:''};
  expect(traitMoodThoughts361(under,[dark],{items:[]}).some(t=>t.id==='environment-dark')).toBe(false);
  const plain={...under,traits:['night-owl'] as TraitId[]};expect(traitMoodThoughts361(plain,[dark],{items:[]}).length).toBe(0);
  const kind={...under,traits:['kind'] as TraitId[]};expect(traitMoodThoughts361(kind,[dark],{items:[]}).length).toBe(1);
  // A prisoner has the need but not its thought (HostFaction); asleep, it is frozen and no trait thought shows.
  under.prisoner={} as never;expect(indoorsNeedApplies362(under)).toBe(true);delete under.prisoner;
  // In a caravan the need falls by 0.25 per day (not spawned: outdoors, no roof).
  const away=structuredClone(inside);away.indoors362=f(.7);advanceCaravanIndoors362(away);expect(away.indoors362).toBe(f(f(.7)+delta(-.25)));
  // The Needs tab shows the indoors bar instead of the outdoors one.
  const page=needsPage(w,sky);
  expect(page.rows.some(r=>r.id==='need-outdoors')).toBe(false);
  expect(page.rows.find(r=>r.id==='need-indoors')).toMatchObject({label:'Intérieur',value:`${Math.round(sky.indoors362!*100)} %`});
  expect(validateWorld(w)).toEqual([]);
  // Strict reading: the field belongs to an undergrounder; an undergrounder never holds the outdoors need.
  const raw=JSON.parse(serializeWorld(w)) as {pawns:Record<string,unknown>[]};
  for(const bad of [1.5,-.1,.1,'0.5',null]){const r=structuredClone(raw);r.pawns[2]!.indoors362=bad;expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
  {const r=structuredClone(raw);r.pawns[2]!.traits=['kind'];expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
  {const r=structuredClone(raw);r.pawns[0]!.outdoors359=.5;expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
});

/** A colonist able to receive a creativity inspiration (Core admission). */
const artist=(p:Pawn)=>{delete p.background;for(const s of ['construction','artistic','crafting'] as const)p.skills[s]={level:8,xp:0,dailyXp:0,passion:0};};
/** Real ticks until the mood break ends; the crisis is brought to its last
 * 30-tick interval first (prepared), so the natural end comes within 3 ticks. */
function endBreak(w:World,p:Pawn):void {
  const c=p.mental!.crisis!;c.age=MENTAL_CRISIS_CATALOG[c.kind as 'sad-wander'].maxCore-30;
  for(let i=0;i<6&&p.mental?.crisis;i++){for(const q of w.pawns){q.hunger=100;q.rest=100;}stepWorld(w);}
  expect(p.mental?.crisis).toBeUndefined();
}

test('a tortured artist recovering from a mood break may be inspired (Core 0.5, roll forced through the stream module)',()=>{
  const w=camp(),[a,b]=w.pawns as [Pawn,Pawn];
  a.traits=['tortured-artist'];b.traits=['tortured-artist'];artist(a);artist(b);
  // MoodOffsetTorturedArtist: −8 in permanence, off the map too.
  expect(moodThoughts(w,a).find(t=>t.id==='trait-tortured-artist')).toMatchObject({label:'Artiste torturé',offset:-8});
  hook.recovery.set(a.id,.5);hook.recovery.set(b.id,.5000001);hook.recoveryCalls.length=0;
  expect(startSadWander(w,a)).toBe(true);expect(startSadWander(w,b)).toBe(true);
  endBreak(w,a);endBreak(w,b);
  // Rand.Value ≤ 0.5: Inspired_Creativity with the trait's reason; above: nothing.
  expect(a.inspiration360?.kind).toBe('creativity');expect(b.inspiration360).toBeUndefined();
  for(const p of [a,b])expect(p.mental!.catharsis.length).toBe(1);
  const letter=stackLetters352(campaignLetters352(w)).find(l=>l.title===`Créativité inspirée : ${a.name}`)!;
  expect(letter.cls).toBe('positive');expect(letter.text).toContain('Artiste torturé');
  expect(hook.recoveryCalls.filter(c=>c.startsWith(`${a.id}@`))).toHaveLength(1);
  // Already inspired: TryStartInspiration refuses (the roll is still drawn).
  expect(startSadWander(w,a)).toBe(true);endBreak(w,a);expect(a.inspiration360?.kind).toBe('creativity');
  expect(validateWorld(w)).toEqual([]);
});

test('a break not caused by mood gives neither catharsis nor the artist\'s chance; a gourmand\'s random binge is marked so',()=>{
  const w=camp(),[a,g]=w.pawns as [Pawn,Pawn];
  a.traits=['tortured-artist'];artist(a);hook.recovery.set(a.id,0);hook.recoveryCalls.length=0;
  expect(startSadWander(w,a)).toBe(true);markCrisisNotMood362(w.schemaVersion,a);
  expect(a.mental!.crisis!.notMood362).toBe(true);expect(validateWorld(w)).toEqual([]);
  endBreak(w,a);
  expect(a.inspiration360).toBeUndefined();expect(a.mental!.catharsis).toEqual([]);
  // Core calls the traits' notice only for a mood-caused state: no roll at all.
  expect(hook.recoveryCalls.some(c=>c.startsWith(`${a.id}@`))).toBe(false);
  // TraitMentalStateGiver (gourmand, MTB 50 days, forced here) starts with causedByMood false.
  g.traits=['gourmand'];g.mood=90;hook.gourmand.add(g.id);
  for(let i=0;i<40&&!g.mental?.crisis;i++){g.hunger=100;g.rest=100;stepWorld(w);}
  hook.gourmand.delete(g.id);
  expect(g.mental?.crisis).toMatchObject({kind:'food-binge',notMood362:true});
  expect(validateWorld(w)).toEqual([]);
  endBreak(w,g);expect(g.mental!.catharsis).toEqual([]);
  // Below 362 the marker cannot exist: every crisis ends with its catharsis, as at 361.
  const old=camp(361),c=old.pawns[0]!;expect(startSadWander(old,c)).toBe(true);markCrisisNotMood362(old.schemaVersion,c);
  expect(c.mental!.crisis!.notMood362).toBeUndefined();endBreak(old,c);expect(c.mental!.catharsis.length).toBe(1);
});

/** The first local tick from `from` holding the pawn's hashed 100-tick inspiration check. */
function nextCheck(id:number,from:number):number {for(let t=Math.max(1,from);;t++)if(groupPawnInterval256(id,(t-1)*10+1,100,10))return t;}
test('a brawler never gets a shoot frenzy and a slowpoke never a go frenzy from 362; at 361 they still could',()=>{
  const run=(version:number,traits:TraitId[])=>{
    const w=camp(version),p=w.pawns[0]!;p.traits=traits;
    // Only the three frenzies admit this pawn (low social, animals, medicine, art).
    for(const s of ['social','animals','medicine','construction','artistic','crafting','shooting'] as const)p.skills[s]={level:0,xp:0,dailyXp:0,passion:0};
    const at=nextCheck(p.id,w.tick+1);
    // MTB event at 100 % mood, then a draw keeping work over go and one taking shoot over both.
    hook.inspiration.set(`${p.id}@${at}`,[0,0,.99]);
    while(w.tick<at){p.mood=100;p.hunger=100;p.rest=100;stepWorld(w);}
    hook.inspiration.delete(`${p.id}@${at}`);
    return p.inspiration360?.kind;
  };
  expect(run(361,['brawler'])).toBe('shoot-frenzy');
  expect(run(362,['brawler'])).toBe('work-frenzy');
  expect(run(362,['kind'])).toBe('shoot-frenzy');
  const w=camp(),p=w.pawns[0]!,body=pawnBody(p);
  p.traits=['slowpoke'];
  expect(inspirationCanOccur360(p,'go-frenzy',body,361)).toBe(true);expect(inspirationCanOccur360(p,'go-frenzy',body,362)).toBe(false);
  expect(startInspiration360(w,p,'go-frenzy')).toBe(false);expect(startInspiration360(w,p,'work-frenzy')).toBe(true);
  // No other Core degree disallows an inspiration.
  for(const id of Object.keys(TRAITS) as TraitId[])for(const kind of ['work-frenzy','go-frenzy','shoot-frenzy','trade','recruitment','taming','surgery','creativity'] as const)
    expect(traitDisallowsInspiration362({traits:[id]},kind,362)).toBe(id==='brawler'&&kind==='shoot-frenzy'||id==='slowpoke'&&kind==='go-frenzy');
});

test('a wimp collapses from 30 % pain where another person stays on its feet',()=>{
  const w=camp(),[wimp,other]=w.pawns as [Pawn,Pawn];
  wimp.traits=['wimp'];bornWimpRecord362(wimp,w.tick);
  expect(wimp.health?.wimp362).toBe(true);expect(validateWorld(w)).toEqual([]);
  for(const p of [wimp,other]){p.health??={tick:w.tick,nextInjuryId:1,injuries:[],missing:[],bloodLoss:0};
    for(const part of ['left-leg','right-leg','left-arm','right-arm','torso'] as const){if(medicalPain(p.health)>=.4)break;addResolvedInjury(p.health,part,'bruise',8000,()=>.999999);}}
  const pain=medicalPain(wimp.health!);
  expect(pain).toBeGreaterThanOrEqual(.3);expect(pain).toBeLessThan(.8);expect(medicalPain(other.health!)).toBe(pain);
  expect(medicalStatus(wimp.health!)).toBe('downed');expect(medicalStatus(other.health!)).toBe('mobile');
  for(let i=0;i<3;i++)stepWorld(w);
  expect(wimp.state).toBe('downed');expect(other.state).not.toBe('downed');
  expect(validateWorld(w)).toEqual([]);
  // The marker and the trait go together.
  const raw=JSON.parse(serializeWorld(w)) as {pawns:Record<string,{wimp362?:unknown}|unknown>[]};
  {const r=structuredClone(raw) as {pawns:{traits?:unknown;health?:Record<string,unknown>}[]};delete r.pawns[0]!.health!.wimp362;expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
  {const r=structuredClone(raw) as {pawns:{traits?:unknown;health?:Record<string,unknown>}[]};r.pawns[1]!.health!.wimp362=true;expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
  {const r=structuredClone(raw) as {pawns:{traits?:unknown;health?:Record<string,unknown>}[]};r.pawns[0]!.health!.wimp362=1;expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
});

test('save and reload keep every 362 state, then the same continuation',()=>{
  const {w,under,inside,sky}=shelters();
  under.traits=['undergrounder','tortured-artist'];artist(under);sky.indoors362=f(.6);
  inside.traits=['undergrounder','wimp'];bornWimpRecord362(inside,w.tick);
  live(w,300);
  expect(startSadWander(w,under)).toBe(true);markCrisisNotMood362(w.schemaVersion,under);
  expect(validateWorld(w)).toEqual([]);
  const raw=serializeCampaign(w),loaded=deserializeWorld(raw);
  expect(serializeCampaign(loaded)).toBe(raw);
  live(w,900);live(loaded,900);
  expect(serializeCampaign(loaded)).toBe(serializeCampaign(w));
});

test('a new game started with a wimp, an undergrounder and a tortured artist runs and reloads',()=>{
  const seed=4242,want=['wimp','undergrounder','tortured-artist'] as const;
  const selected=want.map((id,i)=>{for(let g=0;g<5000;g++){const d={serial:i+1,generation:g};if(previewStartingCandidate(seed,d).traits?.includes(id))return d;}throw new Error(id);});
  const w=createScenarioWorld(seed,64,'crashlanded',undefined,{version:1,seed,selected:selected as never});
  expect(validateWorld(w)).toEqual([]);
  const [wimp,under,art]=want.map(id=>w.pawns.find(p=>p.traits?.includes(id))!);
  expect(wimp!.health?.wimp362).toBe(true);expect(art!.skills.artistic!.passion).toBeGreaterThan(0);
  stepWorld(w,1500);
  expect(under!.outdoors359).toBeUndefined();expect(validateWorld(w)).toEqual([]);
  const copy=deserializeWorld(serializeCampaign(w));expect(serializeCampaign(copy)).toBe(serializeCampaign(w));
});

test('nothing changes below 362, a 361 save holds none of it, and 361 → 362 migrates by number only',()=>{
  const current=createScenarioWorld(42,64,'crashlanded');stepWorld(current,60);
  // A colony without 362 content: the step 361 → 362 changes only the number.
  for(const p of current.pawns)if(p.traits?.some(id=>TRAITS[id].since===362)){p.traits=p.traits.filter(id=>TRAITS[id].since!==362);if(p.health)delete p.health.wimp362;delete p.indoors362;if(!p.traits.length)delete p.traits;}
  expect(validateWorld(current)).toEqual([]);
  const plain=serializeWorld(current);
  expect(serializeWorld(deserializeWorld(asOldSchema(plain,361)))).toBe(asNumberOnly(plain,361));
  // Each 362 field is refused in a 361 save.
  const old=JSON.parse(asOldSchema(plain,361)) as {schemaVersion:number;pawns:(Pawn&Record<string,unknown>)[]};
  expect(old.schemaVersion).toBe(361);
  const refused=(edit:(r:typeof old)=>void)=>{const r=structuredClone(old);edit(r);expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();};
  refused(r=>{r.pawns[0]!.traits=['undergrounder'];});
  refused(r=>{r.pawns[0]!.traits=['tortured-artist'];});
  refused(r=>{r.pawns[0]!.traits=['wimp'];r.pawns[0]!.health={tick:0,nextInjuryId:1,injuries:[],missing:[],bloodLoss:0,wimp362:true};});
  refused(r=>{r.pawns[0]!.traits=['brawler'];r.pawns[0]!.indoors362=.5;});
  // A migrated colony gains nothing: no new trait, no need, no marker.
  const migrated=deserializeWorld(asOldSchema(plain,361));
  for(const p of migrated.pawns){expect(p.traits?.some(id=>TRAITS[id].since===362)??false).toBe(false);expect(p.indoors362).toBeUndefined();expect(p.health?.wimp362).toBeUndefined();expect(indoorsLevel362(p)).toBe(1);}
  stepWorld(migrated,30);expect(validateWorld(migrated)).toEqual([]);
  // A 362 save with the new content loses it when relabelled 361.
  const p0=current.pawns[0]!;p0.traits=['undergrounder'];delete p0.outdoors359;p0.indoors362=f(.5);expect(validateWorld(current)).toEqual([]);
  const back=JSON.parse(asOldSchema(serializeWorld(current),361)) as {pawns:Record<string,unknown>[]};
  expect(back.pawns.some(p=>'indoors362'in p)).toBe(false);
  expect(()=>deserializeWorld(JSON.stringify(back))).not.toThrow();
});
