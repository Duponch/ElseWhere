import {beforeAll,describe,expect,it,vi} from 'vitest';

// The wood wall's success chance is forced to 0 so that a failure is certain
// whenever Core rolls it (JobDriver_ConstructFinishFrame).
vi.mock('../src/sim/construction-success-301.ts',async importOriginal=>({...await importOriginal<typeof import('../src/sim/construction-success-301.ts')>(),constructionSuccessChance301:()=>0}));

import {applyCommand,createWorld,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index';
import {SCHEMA_VERSION,type Command,type Pawn,type World} from '../src/sim/types';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {captureGeneratedGeography256} from '../src/sim/world-geography-owner-256';
import {createGeographicNewGame256} from '../src/sim/geographic-new-game-256';
import {ACTUAL_SHRINES_750_256} from '../src/sim/ancient-temple-orchestration-256';
import {createStartingCandidateRoster,previewStartingCandidate} from '../src/sim/starting-candidates';
import {startingOriginalRequestFromRoster256} from '../src/sim/starting-original-request-256';
import {violentWorkRefusal} from '../src/sim/colonist-backgrounds';
import {isColonist} from '../src/sim/affiliation';
import {alertsDisabled347,colonistMoodOffset,cropYieldFactor347,crashlandedProfile,effectiveMineableYield347,foodPoisonFactor347,playerInfectionFactor,researchSpeedFactor347,storytellerIncidents347,tutorialMode347,tutorialProfile347} from '../src/sim/game-profile';
import {findUsableRect347,TUTORIAL_POTATOES_347} from '../src/sim/tutorial-347';
import {startSadWander,startBerserk,updateMentalBreak} from '../src/sim/mental-break';
import {canStartSocialFight} from '../src/sim/social-fight';
import {romanceSelectionWeight} from '../src/sim/romance';
import {advanceWeather} from '../src/sim/weather';
import {questsSupported} from '../src/sim/quests';
import {deathOnDownedEligible320} from '../src/sim/population-intent-320';
import {damageUnarmoredPawnWithBullet} from '../src/sim/bullet-damage';
import {medicalStatus} from '../src/sim/injury-state';
import {canDesignate} from '../src/sim/engine';
import {raidFamilyOfFaction331} from '../src/sim/raid-factions-331';
import {fixture,play} from './wall-fixture301';
import {asOldSchema} from './scenarios/old-schema';

/* Core RimWorld 1.6 "Learn to play" prerequisites (schema 347):
 * MainMenuDrawer.InitLearnToPlay, StorytellerDef Tutor (Storytellers.xml),
 * DifficultyDef Easy (Difficulties.xml), ScenarioDef Tutorial, the
 * TutorSystem.TutorialMode switches, Lesson_Instruction.OnActivated
 * (giveOnActivate RawPotatoes x75), Instruction_MineSteel, Instruction_DownRaider
 * and the ChooseStoryteller handover. */

const drain=<Y,T>(it:Generator<Y,T,void>):T=>{let step=it.next();while(!step.done)step=it.next();return step.value;};
const ROSTER_SEED=259017;
function newGame(tutorial:boolean):World {
 const draft=drain(generateGeographicWorldDraft256({seed:'Camp2274 preview 256 🌲',settings:{...defaultWorldGenerationSettings(),rainfall:4,temperature:2},tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'QA347',terrain:'historical'})); // Historical terrain: these games are also relabelled as schema 346 saves.
 const geography=captureGeneratedGeography256(draft);
 // The tutorial's pawn page only starts with three violence-capable colonists.
 const roster=createStartingCandidateRoster(ROSTER_SEED),able=roster.filter(d=>violentWorkRefusal(previewStartingCandidate(ROSTER_SEED,d))===undefined);
 const ordered=[...able.slice(0,3),...roster.filter(d=>!able.slice(0,3).includes(d))];
 return drain(createGeographicNewGame256({draft,geography,tile:50388,size:200,scenario:'crashlanded',startingParty:startingOriginalRequestFromRoster256(ROSTER_SEED,ordered),...tutorial?{tutorial:true as const}:{}},{shrines750:ACTUAL_SHRINES_750_256}));
}
const ok=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(r)).toMatchObject({ok:true});return r;};
const refused=(w:World,c:unknown,pattern?:RegExp)=>{const before=serializeWorld(w);const r=applyCommand(w,c as Command);expect(r.ok).toBe(false);if(pattern)expect(r.reason).toMatch(pattern);expect(serializeWorld(w)).toBe(before);return r;};
const roundTrip=(w:World)=>{const text=serializeWorld(w);const back=deserializeWorld(text);expect(serializeWorld(back)).toBe(text);return back;};
const colonists=(w:World)=>w.pawns.filter(p=>isColonist(p)&&!p.prisoner);
function openPods(w:World):void {for(let i=0;i<40&&w.startingArrival?.phase!=='opened';i++)stepWorld(w,50);expect(w.startingArrival?.phase).toBe('opened');}

let tutorialGame:World,normalGame:World;
beforeAll(()=>{tutorialGame=newGame(true);normalGame=newGame(false);},300000);

describe('a tutorial game: Tutor, Easy, scenario Tutorial',()=>{
 it('has the profile, its rules and the cloth of the Tutorial scenario',()=>{
  const w=tutorialGame;
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);
  // Schema 349 adds the lessons' record (tests/tutorial-lessons-349.test.ts).
  expect(w.gameProfile).toEqual({revision:1,storyteller:'tutor',difficulty:'community-builder',saveMode:'reloadable',tutorial347:{revision:1,lessons349:expect.objectContaining({revision:1,introDone:true})}});
  expect(w.scenario?.id).toBe('crashlanded');
  expect(tutorialMode347(w)).toBe(true);expect(alertsDisabled347(w)).toBe(true);expect(storytellerIncidents347(w)).toBe(false);
  // No storyteller comps: only the silent raid agenda is born.
  expect(w.raids?.profile).toBe('cassandra-raids-v1');
  for(const k of ['fluIncidents','miscIncidents','smallIncidents','visitors','quests'] as const)expect(w[k]).toBeUndefined();
  expect(questsSupported(w)).toBe(false);
  // ScenPart_ScatterThingsNearPlayerStart Cloth x300, forbidden like every start item.
  const cloth=w.piles.filter(p=>p.item==='cloth'&&p.owner.type==='ground');
  expect(cloth.reduce((n,p)=>n+p.quantity,0)).toBe(300);
  expect(cloth.every(p=>p.forbidden===true)).toBe(true);
  // WeatherDecider: the tutorial map starts clear.
  expect(w.weather?.current).toBe('clear');
  // Easy (community builder) values.
  const someone=w.startingArrival&&'pods'in w.startingArrival?w.startingArrival.pods[0]!.pawn:w.pawns.find(isColonist)!;
  expect(colonistMoodOffset(w,someone)).toBe(10);expect(playerInfectionFactor(w,someone)).toBe(.5);expect(foodPoisonFactor347(w)).toBe(.5);
  expect(researchSpeedFactor347(w)).toBe(1.2);expect(cropYieldFactor347(w)).toBe(1.2);expect(effectiveMineableYield347(w,40)).toBe(48);expect(effectiveMineableYield347(w,2)).toBe(2);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
 });
 it('fires no storyteller incident while the Tutor tells the story',()=>{
  const w=deserializeWorld(serializeWorld(tutorialGame));
  openPods(w);
  // Past the Cassandra intro raid and the intro visitor (days 5.4 and 2.5).
  for(let day=0;day<6;day++)stepWorld(w,6000);
  expect(w.raids!.active).toBeUndefined();expect(w.raids!.serial).toBe(0);
  for(const k of ['fluIncidents','miscIncidents','smallIncidents','visitors','quests','podRescues'] as const)expect(w[k]).toBeUndefined();
  expect(w.orbital?.ships.length??0).toBe(0);
  // The dormant agenda consumed its opportunities without firing them.
  expect(w.raids!.cassandra!.pending[0]!).toBeGreaterThan(w.tick);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
 },300000);
 it('gives the forced content once each: potatoes, steel lump and the single-raider raid',()=>{
  const w=deserializeWorld(serializeWorld(tutorialGame));
  openPods(w);
  // AddBillSimpleMeal: 75 raw potatoes at the center of a usable 2x2 rect.
  const potatoesBefore=w.piles.filter(p=>p.item==='potato').reduce((n,p)=>n+p.quantity,0);
  ok(w,{type:'tutorial-potatoes'});
  const potatoes=w.piles.filter(p=>p.item==='potato'&&p.owner.type==='ground');
  expect(potatoes.reduce((n,p)=>n+p.quantity,0)-potatoesBefore).toBe(TUTORIAL_POTATOES_347);
  expect(potatoes.every(p=>!p.forbidden)).toBe(true);
  refused(w,{type:'tutorial-potatoes'},/déjà/);
  refused(w,{type:'tutorial-potatoes',extra:1});
  // MineSteel: a compacted steel lump of 30 to 40 cells, really mineable.
  const steelBefore=w.tiles.filter(t=>t.ore==='steel').length;
  ok(w,{type:'tutorial-steel-lump'});
  const lump=w.tiles.flatMap((t,i)=>t.ore==='steel'&&t.mineable?.def==='MineableSteel'?[i]:[]);
  expect(lump.length-steelBefore).toBeGreaterThanOrEqual(1);
  const added=lump.length-steelBefore;expect(added).toBeLessThanOrEqual(40);
  const cell=lump.find(i=>Math.abs(i%w.width-w.width/2)<=w.width/2-10)!;
  expect(canDesignate(w,{type:'designate',kind:'mine',x:cell%w.width,z:Math.floor(cell/w.width)}).ok).toBe(true);
  refused(w,{type:'tutorial-steel-lump'},/déjà/);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
  // DownRaider: RaidEnemy at a Drifter's 35 points, EdgeWalkIn, ImmediateAttack, one raider forced downed.
  ok(w,{type:'tutorial-raid'});
  const group=w.raids!.active!;expect(group.members.length).toBe(1);
  expect(group.stage330).toBeUndefined();expect(group.arrival333?.mode).toBe('edge-walk-in');
  expect(group.composition?.roster).toEqual(['drifter']);
  const raider=w.pawns.find(p=>p.id===group.members[0])!;
  expect(group.forcedDowned347).toBe(raider.id);
  expect(raider.x===0||raider.z===0||raider.x===w.width-1||raider.z===w.height-1).toBe(true);
  expect(raidFamilyOfFaction331(w,raider.worldAffiliation259!.factionId!)).toBe('pirate');
  refused(w,{type:'tutorial-raid'},/déjà/);
  expect(validateWorld(w)).toEqual([]);
  const saved=serializeWorld(w);roundTrip(w);
  // Forced downed: a spine shot downs the raider, never kills him through the downing roll.
  for(let seed=1;seed<=8;seed++){
   const loaded=deserializeWorld(saved),target=loaded.pawns.find(p=>p.id===raider.id)!;loaded.rng=seed*7919;
   expect(deathOnDownedEligible320(loaded,target)).toBe(false);
   damageUnarmoredPawnWithBullet(loaded,target,{damage:30,part:'spine'});
   expect(target.state).toBe('downed');expect(medicalStatus(target.health!)).toBe('downed');
  }
 },300000);
 it('hands the game over to Cassandra at Adventure Story (ChooseStoryteller)',()=>{
  const w=deserializeWorld(serializeWorld(tutorialGame));
  openPods(w);
  refused(w,{type:'choose-storyteller',storyteller:'tutor',difficulty:'community-builder'},/non disponible/);
  refused(w,{type:'choose-storyteller',storyteller:'cassandra-partial',difficulty:'community-builder'},/non disponible/);
  const core=w.tick*10+(w.phaseCore297??0);
  ok(w,{type:'choose-storyteller',storyteller:'cassandra-partial',difficulty:'adventure-story'});
  expect(w.gameProfile).toEqual({...crashlandedProfile(),tutorial347:{revision:1,endedAtCore:core,lessons349:{revision:1,introDone:true,startingItems:[]}}});
  expect(tutorialMode347(w)).toBe(false);expect(alertsDisabled347(w)).toBe(false);expect(storytellerIncidents347(w)).toBe(true);
  expect(colonistMoodOffset(w,colonists(w)[0]!)).toBe(5);expect(researchSpeedFactor347(w)).toBe(1);
  // Storyteller.Notify_DefChanged: its calendars start now.
  expect(w.fluIncidents?.profile).toBe('cassandra-flu-v1');expect(w.visitors?.profile).toBe('cassandra-visitors-v1');
  if(w.tick<2.5*6000)expect((w.visitors as {introAt:number|null}).introAt).toBe(2.5*6000);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
  // The other Cassandra calendars are adopted prospectively at the next simulated tick.
  const handover=w.tick;stepWorld(w,1);
  for(const at of [w.miscIncidents?.adoptedAt,w.smallIncidents?.adoptedAt]){expect(at).toBeGreaterThanOrEqual(handover);expect(at).toBeLessThanOrEqual(w.tick);}
  refused(w,{type:'tutorial-potatoes'},/tutoriel/);refused(w,{type:'choose-storyteller',storyteller:'cassandra-partial',difficulty:'adventure-story'},/tutoriel/);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
 },300000);
});

describe('each tutorial rule switch',()=>{
 /** A camp colony with the Tutor profile; rule readers only. */
 const tutorCamp=(tutor:boolean)=>{const w=createWorld(347001,32,32);if(tutor)w.gameProfile=tutorialProfile347();return w;};
 it('no mental break or mental state for the player\'s pawns, even at the lowest mood',()=>{
  for(const tutor of [true,false]){
   const w=tutorCamp(tutor),p=w.pawns.find(isColonist)!;p.mood=0;
   expect(startSadWander(w,p)).toBe(!tutor);if(!tutor)continue;
   expect(startBerserk(w,p)).toBe(false);expect(p.mental?.crisis).toBeUndefined();
   // The thresholds are still tracked, but no break is chosen and no draw is made.
   for(let i=0;i<3000;i++){w.tick++;const rng=w.rng;updateMentalBreak(w,p);expect(w.rng).toBe(rng);}
   expect(p.mental?.crisis).toBeUndefined();expect(p.mental!.below[2]).toBe(2100);
  }
 });
 it('no social fight and no romance attempt',()=>{
  for(const tutor of [true,false]){
   const w=tutorCamp(tutor),[a,b]=w.pawns.filter(isColonist) as [Pawn,Pawn];
   if(tutor){expect(canStartSocialFight(w,a,b)).toBe(false);expect(romanceSelectionWeight(w,a,b)).toBe(0);}
   else expect(canStartSocialFight(w,a,b)).toBe(true);
  }
 });
 it('no construction failure (no roll) while building',()=>{
  const failed=fixture(),kept=fixture();kept.w.gameProfile=tutorialProfile347();
  play(failed.w,12);play(kept.w,12);
  // Success chance 0: Core's roll always fails outside the tutorial.
  expect(failed.w.jobs.includes(failed.j)).toBe(false);
  expect(kept.w.jobs.includes(kept.j)).toBe(true);expect(kept.j.frameWork301!.done).toBeGreaterThan(0);
 });
 it('clear weather whenever the weather changes',()=>{
  const w=tutorCamp(true);w.weather={revision:1,originTick:0,lastCoreTick:0,rng:12345,current:'rain',previous:'rain',ageCore:0,durationCore:1,fireWatchCore:0,largeFire:false,lightningCount:0};
  const inputs={outsideTemperature:15,rainfall:2000,fireDanger:()=>0,lightning:()=>{}};
  for(let i=1;i<=200;i++){w.tick=i*2000;advanceWeather(w,inputs as Parameters<typeof advanceWeather>[1]);expect(w.weather!.current).toBe('clear');}
 });
 it('the forced content and the handover exist only in the tutorial',()=>{
  const w=tutorCamp(false);
  for(const c of [{type:'tutorial-potatoes'},{type:'tutorial-steel-lump'},{type:'tutorial-raid'},{type:'choose-storyteller',storyteller:'cassandra-partial',difficulty:'adventure-story'}])refused(w,c,/tutoriel/);
 });
 it('finds the usable rect of Core\'s tutorial targets on the real map',()=>{
  const w=deserializeWorld(serializeWorld(tutorialGame)),rect=findUsableRect347(w,10,8,.5)!;
  expect(rect.maxX-rect.minX+1).toBe(10);expect(rect.maxZ-rect.minZ+1).toBe(8);
  for(let z=rect.minZ-1;z<=rect.maxZ+1;z++)for(let x=rect.minX-1;x<=rect.maxX+1;x++)expect(w.tiles[z*w.width+x]!.fogged).toBeUndefined();
 });
});

describe('a normal game is unchanged',()=>{
 it('keeps the Cassandra profile, its calendars and no tutorial record',()=>{
  const w=normalGame;
  expect(w.gameProfile).toEqual(crashlandedProfile());expect(Object.keys(w.gameProfile!)).toHaveLength(4);
  expect(tutorialMode347(w)).toBe(false);expect(alertsDisabled347(w)).toBe(false);
  expect(w.fluIncidents?.profile).toBe('cassandra-flu-v1');expect(w.miscIncidents?.profile).toBe('cassandra-misc-v1');expect(w.visitors?.profile).toBe('cassandra-visitors-v1');
  expect(w.piles.some(p=>p.item==='cloth'&&p.owner.type==='ground')).toBe(false);
  expect(colonistMoodOffset(w,w.startingArrival&&'pods'in w.startingArrival?w.startingArrival.pods[0]!.pawn:w.pawns[0]!)).toBe(5);
  expect(serializeWorld(w)).not.toMatch(/tutorial347|forcedDowned347/);
  for(const c of [{type:'tutorial-potatoes'},{type:'tutorial-raid'},{type:'choose-storyteller',storyteller:'cassandra-partial',difficulty:'adventure-story'}])refused(w,c,/tutoriel/);
  expect(validateWorld(w)).toEqual([]);
 });
});

describe('saves (schema 347)',()=>{
 it('migrates a 346 save by its number only; the profile stays',()=>{
  const old=asOldSchema(serializeWorld(normalGame),346),loaded=deserializeWorld(old);
  expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);expect(loaded.gameProfile).toEqual(crashlandedProfile());
  expect(JSON.parse(serializeWorld(loaded)).gameProfile).toEqual(JSON.parse(old).gameProfile);
 });
 it('refuses a tutorial profile before 347 and any malformed tutorial record',()=>{
  const text=serializeWorld(tutorialGame);
  expect(()=>deserializeWorld(asOldSchema(text,346))).toThrow();
  const mutate=(change:(raw:Record<string,any>)=>void)=>{const raw=JSON.parse(text);change(raw);return JSON.stringify(raw);};
  for(const bad of [
   (r:Record<string,any>)=>{r.gameProfile.tutorial347.extra=1;},
   (r:Record<string,any>)=>{r.gameProfile.difficulty='adventure-story';},
   (r:Record<string,any>)=>{r.gameProfile.storyteller='cassandra-partial';},
   (r:Record<string,any>)=>{r.gameProfile.tutorial347.potatoesAtCore=-1;},
   (r:Record<string,any>)=>{r.gameProfile.tutorial347.raidAtCore=(r.tick+5)*10;},
   (r:Record<string,any>)=>{r.gameProfile.tutorial347.endedAtCore=0;},
   (r:Record<string,any>)=>{delete r.gameProfile.tutorial347;r.gameProfile.storyteller='tutor';},
  ])expect(()=>deserializeWorld(mutate(bad))).toThrow();
 });
});
