import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {adoptFluIncidents,FLU_CHECK_INTERVAL,FLU_FIRST_CHECK} from '../src/sim/flu-incidents.ts';
import {CASSANDRA_CYCLE_START,enableCassandraRaids,INTRO_RAID_TICK} from '../src/sim/cassandra-raids.ts';
import {advanceRaids} from '../src/sim/raids.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {injurePawn} from '../src/sim/health.ts';
import {raidGroups261} from '../src/sim/temp-map-raids-261.ts';
import {mechRaidGroups261} from '../src/sim/mechanical-raid-groups-261.ts';
import {validateRaids} from '../src/sim/raid-save.ts';
import {raidStaging330} from '../src/sim/raid-state.ts';
import {chooseMechanoidComposition,createMechanoidRaid} from '../src/sim/mechanoid-raids.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {drawBigThreat328,BIG_THREATS_328} from '../src/sim/big-threats-328.ts';
import {drawMiscIncident329,drawIntroMiscIncident329,MISC_POPULATION_CHANCE_329,type MiscRow329} from '../src/sim/misc-lottery-329.ts';
import {curve320,populationIntent320} from '../src/sim/population-intent-320.ts';
import {adoptMiscIncidents,adoptWeatherIncidents,consumeMiscOpportunity329,miscLotteryRows329} from '../src/sim/cassandra-misc.ts';
import {adoptWorldIncidents,advanceWorldIncidents,WORLD_CHECK_INTERVAL,WORLD_FIRST_CHECK} from '../src/sim/cassandra-world.ts';
import {adoptSmallIncidents,resolveSelectedSmallAnimal} from '../src/sim/cassandra-small.ts';
import {HOME_RECENT_INCIDENTS_341,homeRecentFactor341,recentFactor341,recordHomeIncident341,validRecentIncidents341} from '../src/sim/recent-incidents-341.ts';
import {validMiscIncidents} from '../src/sim/cassandra-misc-save.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import type {SettlementTile} from '../src/sim/world-settlement-placement.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const roundTrip=(w:World)=>{const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);return saved;};
/** A private xorshift stream for measured shares. */
const stream=(seed:number)=>{let x=seed>>>0||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/0x100000000;};};

function clock(w:World,tick:number):void {
  // Focused raid tests skip days without advancing other systems: move their
  // independent clocks with the jump (as raid-arrival-333 does).
  w.tick=tick;w.fluIncidents!.nextCheck=Math.max(FLU_FIRST_CHECK,(Math.floor(tick/FLU_CHECK_INTERVAL)+1)*FLU_CHECK_INTERVAL);
  if(w.corePathBudget297)w.corePathBudget297.tick=tick;
  if(w.deterioration)w.deterioration.lastTick=tick;
  const e=w.economy;if(e){e.sampledAt=Math.floor(tick/501)*501;e.nextSampleAt=e.sampledAt+501;e.nextAdaptAt=Math.ceil((tick+1)/3000)*3000;}
}
/** A Cassandra colony with an economy. With factions, the real default world
 * faction registry (declared fixture, as in raid-factions-331: whole-save
 * checks then use the raid validator only); without, a whole valid save. */
function colony(factions:boolean,version:number):World {
  const w=deconstructionCamp(3,72);setVersion(w,version);
  w.scenario={id:'crashlanded',revision:1,landing:{x:16,z:16}};
  w.gameProfile=crashlandedProfile();enableCassandraRaids(w);adoptColonyEconomy(w);adoptFluIncidents(w);
  if(factions){
    const tiles:readonly SettlementTile[]=Array.from({length:128},(_,i)=>({biome:'temperate-forest',hilliness:'flat',neighbours:[(i+127)%128,(i+1)%128]}));
    const foreign=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(718)});
    if(!foreign.ok)throw Error(foreign.reason);
    const registry=completeWorldFactionRegistry256({version:w.schemaVersion,draft:foreign.draft,playerDef:'PlayerColony',name:'Colonie de contrôle',postWorldRandom:new WorldGenerationRandom(991)});
    if(!registry.ok)throw Error(registry.reason);
    w.worldFactions=registry.registry;w.nextId=foreign.nextThingId;
  }
  // The introductory raid comes and ends.
  clock(w,INTRO_RAID_TICK);advanceRaids(w);
  for(const p of w.pawns.filter(q=>q.raid))injurePawn(w,p,'brain','crush',99000);
  advanceRaids(w);expect(w.raids!.active).toBeUndefined();
  return w;
}
/** The first cycle's two opportunities, placed 300 ticks apart (declared
 * fixture: in Core two opportunities of one cycle are 1.9 days apart, and a
 * raid that lasts that long is mostly a mechanoid one; the rule is the same). */
const FIRST=CASSANDRA_CYCLE_START+1000,SECOND=FIRST+300;
function firstRaid(version:number):World {
  const w=colony(false,version);
  expect(w.raids!.cassandra!.cycle).toBe(0);
  w.raids!.cassandra!.pending=[FIRST,SECOND];
  clock(w,FIRST);advanceRaids(w);
  expect(w.raids!.active?.startedAt).toBe(FIRST);
  return w;
}
const standing=(w:World,id:number)=>w.pawns.filter(p=>p.raid?.group===id&&p.state!=='dead'&&p.state!=='downed');
function end(w:World,id:number):void {
  for(let i=0;i<120&&raidGroups261(w).some(g=>g.id===id);i++){
    for(const p of standing(w,id))injurePawn(w,p,'brain','crush',99000);
    stepWorld(w);
  }
  expect(raidGroups261(w).some(g=>g.id===id)).toBe(false);
}

test('a second Cassandra raid arrives while the first is on the map; both play through real ticks and the save round-trips',()=>{
  const w=firstRaid(SCHEMA_VERSION),a=w.raids!.active!;
  // Real ticks up to the second opportunity: the raid no longer swallows it.
  while(w.tick<SECOND)stepWorld(w);
  const groups=raidGroups261(w);
  expect(groups.map(g=>g.id)).toEqual([a.id,a.id+1]);
  const b=w.raids!.extraActive261![0]!;
  expect(b.concurrent341).toBe(true);expect(b.startedAt).toBe(SECOND);
  expect(b.composition).toBeDefined();expect(b.deadline!-b.startedAt).toBeGreaterThanOrEqual(2600);
  expect(w.raids!.serial).toBe(b.id);expect(w.raids!.nextCheck).toBeNull();
  expect(w.events.some(e=>e.tick===SECOND&&e.message.startsWith('Raid'))).toBe(true);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
  // Both groups keep playing, each with its own Lord, timers and members.
  const before=new Map(b.members.map(id=>[id,(()=>{const p=w.pawns.find(q=>q.id===id);return p?`${p.x}:${p.z}`:'pod';})()]));
  for(let i=0;i<150;i++)stepWorld(w);
  expect(raidGroups261(w).map(g=>g.id)).toEqual([a.id,b.id]);
  // A raid that walks straight in has moved (a staging one may wait at its point).
  if(!raidStaging330(b)&&!b.arrival333?.pods)expect(b.members.some(id=>{const p=w.pawns.find(q=>q.id===id);return !!p&&`${p.x}:${p.z}`!==before.get(id);})).toBe(true);
  for(const g of [a,b])for(const id of g.members){const p=w.pawns.find(q=>q.id===id);if(p)expect(p.raid?.group).toBe(g.id);}
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
  // The second raid ends first: the first goes on and the calendar waits.
  end(w,b.id);
  expect(w.raids!.last).toMatchObject({id:b.id,concurrent341:true});
  expect(w.raids!.extraResults261!.some(r=>r.id===b.id&&r.concurrent341)).toBe(true);
  expect(w.raids!.active?.id).toBe(a.id);expect(w.raids!.nextCheck).toBeNull();
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
  // Then the first: the calendar resumes at its next opportunity.
  end(w,a.id);
  expect(w.raids!.active).toBeUndefined();expect(w.raids!.extraActive261).toEqual([]);
  expect(w.raids!.nextCheck).toBe(w.raids!.cassandra!.pending[0]);
  expect(w.raids!.completed).toBe(w.raids!.serial);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
},120000);

test('below schema 341 an active raid still swallows the opportunity, with no draw',()=>{
  const w=firstRaid(340),a=w.raids!.active!;
  while(w.tick<SECOND-1)stepWorld(w);
  const rng=w.raids!.rng,serial=w.raids!.serial;
  stepWorld(w);
  expect(w.raids!.cassandra!.pending).not.toContain(SECOND);
  expect(raidGroups261(w).map(g=>g.id)).toEqual([a.id]);
  expect(Object.hasOwn(w.raids!,'extraActive261')).toBe(false);
  expect(w.raids!.rng).toBe(rng);expect(w.raids!.serial).toBe(serial);
});

test('a raid arrives beside a mechanoid raid that never retreats; refused in a 340 save',()=>{
  for(const version of [SCHEMA_VERSION,340]){
    const w=colony(true,version);w.raids!.cassandra!.pending=[FIRST];clock(w,FIRST);
    let composition=chooseMechanoidComposition(1000,{rng:1},false);
    for(let seed=2;!composition;seed++)composition=chooseMechanoidComposition(1000,{rng:seed},false);
    const mech=createMechanoidRaid(w,composition,{rng:7})!;
    expect(w.raids!.mechActive).toBe(mech);
    advanceRaids(w);
    if(version===340){expect(raidGroups261(w)).toEqual([]);continue;}
    const human=raidGroups261(w);expect(human).toHaveLength(1);
    expect(human[0]!.concurrent341).toBe(true);expect(mechRaidGroups261(w).map(g=>g.id)).toEqual([mech.id]);
    expect(validateRaids(w,SCHEMA_VERSION,new Set())).toEqual([]);
    const copy=JSON.parse(JSON.stringify(w)) as World;expect(copy.raids).toEqual(w.raids);
    expect(validateRaids(copy,SCHEMA_VERSION,new Set())).toEqual([]);
    // The new group and its marker are refused in an older save, or forged.
    expect(validateRaids(w,340,new Set())).not.toEqual([]);
    const forged=structuredClone(w);(forged.raids!.extraActive261![0] as {concurrent341?:unknown}).concurrent341=1;
    expect(validateRaids(forged,SCHEMA_VERSION,new Set())).not.toEqual([]);
    const primary=structuredClone(w);(primary.raids!.mechActive as {concurrent341?:true}).concurrent341=true;
    expect(validateRaids(primary,SCHEMA_VERSION,new Set())).not.toEqual([]);
  }
},60000);

test('a save holding a concurrent raid cannot be read as schema 340',()=>{
  const w=firstRaid(SCHEMA_VERSION);
  while(w.tick<SECOND)stepWorld(w);
  const saved=serializeWorld(w);
  expect(()=>deserializeWorld(asOldSchema(saved,340))).toThrow();
},60000);

test('recent-incident weights: factors by position, compounded, measured over many draws',()=>{
  expect(recentFactor341(undefined,'x')).toBe(1);
  expect(recentFactor341(['a','b','c','d','e'],'a')).toBe(.01);
  expect(recentFactor341(['a','b','c','d','e'],'e')).toBe(.9);
  expect(recentFactor341(['a','b','a'],'a')).toBeCloseTo(.01*.5,12);
  // A lottery of four plain incidents, two of them recent.
  const w=createScenarioWorld(42,32,'crashlanded');
  const rows:MiscRow329[]=[{id:'a',weight:1,population:null},{id:'b',weight:1,population:null},{id:'c',weight:2,population:null},{id:'d',weight:1,population:null}];
  const recent=(id:string)=>recentFactor341(['c','d','a'],id);
  const expected={a:1*.5,b:1,c:2*.01,d:1*.3},total=Object.values(expected).reduce((s,v)=>s+v,0);
  const counts=new Map<string,number>(),random=stream(341),n=200000;
  // The population group draw comes first; with no population incident the
  // whole pool is used.
  for(let i=0;i<n;i++){const id=drawMiscIncident329(w,rows,random,recent)!.id;counts.set(id,(counts.get(id)??0)+1);}
  for(const [id,weight] of Object.entries(expected))expect(Math.abs((counts.get(id)??0)/n-weight/total)).toBeLessThan(.004);
  // The intro draw carries the same factors.
  const intro=new Map<string,number>(),r2=stream(7);
  for(let i=0;i<n;i++){const id=drawIntroMiscIncident329(w,rows,r2,recent)!.id;intro.set(id,(intro.get(id)??0)+1);}
  expect(Math.abs((intro.get('c')??0)/n-.02/total)).toBeLessThan(.002);
  // Without factors (before 341), the historical weights.
  const plain=new Map<string,number>(),r3=stream(9);
  for(let i=0;i<n;i++){const id=drawMiscIncident329(w,rows,r3)!.id;plain.set(id,(plain.get(id)??0)+1);}
  expect(Math.abs((plain.get('c')??0)/n-.4)).toBeLessThan(.004);
});

test('the real Misc lottery: an incident at the head of the record is a hundred times rarer',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');adoptMiscIncidents(w);adoptWeatherIncidents(w);
  const state=w.miscIncidents!,rows=miscLotteryRows329(w,state),intent=populationIntent320(w);
  const pool=rows.filter(r=>!r.eligible||r.eligible()),popChance=curve320(intent,MISC_POPULATION_CHANCE_329);
  const weight=(r:MiscRow329,list:string[])=>r.weight*(r.population===null?1:Math.max(intent+r.population,.05))*recentFactor341(list,r.id);
  const share=(id:string,list:string[])=>{const plainRows=pool.filter(r=>r.population===null);return (1-popChance)*weight(rows.find(r=>r.id===id)!,list)/plainRows.reduce((s,r)=>s+weight(r,list),0);};
  const measure=(list:string[])=>{
    if(list.length)state.recent341=list;else delete state.recent341;
    const factor=homeRecentFactor341(w)!,random=stream(1234),n=200000;let hits=0;
    for(let i=0;i<n;i++)if(drawMiscIncident329(w,rows,random,factor)!.id==='self-tame')hits++;
    return hits/n;
  };
  const free=measure([]),head=measure(['self-tame']),second=measure(['herd-migration','self-tame']);
  expect(Math.abs(free-share('self-tame',[]))).toBeLessThan(.003);
  expect(Math.abs(head-share('self-tame',['self-tame']))).toBeLessThan(.0015);
  expect(Math.abs(second-share('self-tame',['herd-migration','self-tame']))).toBeLessThan(.003);
  expect(head/free).toBeLessThan(.02);
  // A population incident in the record leaves the other group's shares alone.
  expect(share('self-tame',['refugee-pod'])).toBeCloseTo(share('self-tame',[]),12);
});

test('big threats: the absent tickets carry their factor, the raid none',()=>{
  const n=200000,base=BIG_THREATS_328.reduce((s,r)=>s+r.weight,0);
  const raidShare=(recent?:(id:string)=>number,seed=5)=>{const random=stream(seed);let raids=0;for(let i=0;i<n;i++)if(drawBigThreat328(30,1000,random,recent)==='raid')raids++;return raids/n;};
  expect(Math.abs(raidShare()-7.4/base)).toBeLessThan(.004);
  // Right after an infestation: 7.4 / (17.4 - 2.7 + 2.7 x 0.01).
  const afterInfestation=raidShare(id=>recentFactor341(['infestation'],id));
  expect(Math.abs(afterInfestation-7.4/(base-2.7+.027))).toBeLessThan(.004);
  // A raid in the record changes nothing (Core ignoreRecentSelectionWeighting).
  expect(raidShare(id=>recentFactor341(['raid'],id),5)).toBe(raidShare(undefined,5));
  // Before day 20 the slot is always a raid.
  expect(drawBigThreat328(15,1000,()=>{throw Error('no draw');},id=>recentFactor341(['infestation'],id))).toBe('raid');
});

test('World incidents: an eclipse right after an eclipse is rare, and each one is recorded',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');adoptWeatherIncidents(w);adoptWorldIncidents(w);
  const state=w.worldIncidents!,weather=w.miscIncidents!.weather!;
  const draw=(list:string[]|undefined)=>{
    const fired=new Map<string,number>();
    for(let seed=1;seed<=60000;seed++){
      w.tick=WORLD_FIRST_CHECK+WORLD_CHECK_INTERVAL*seed;state.nextCheck=w.tick;state.rng=seed;
      delete state.active;delete state.lastStart;delete state.aurora;delete state.lastAuroraStart;delete weather.eclipse;delete weather.lastEclipseStart;
      if(list)state.recent341=[...list];else delete state.recent341;
      const before=state.recent341?.length??0;advanceWorldIncidents(w);
      if((state.recent341?.length??0)>before){const id=state.recent341![0]!;fired.set(id,(fired.get(id)??0)+1);}
    }
    return fired;
  };
  const free=draw(undefined),after=draw(['eclipse']);
  const freeTotal=[...free.values()].reduce((s,v)=>s+v,0),afterTotal=[...after.values()].reduce((s,v)=>s+v,0);
  expect(freeTotal).toBeGreaterThan(30);expect(afterTotal).toBeGreaterThan(30);
  expect((free.get('eclipse')??0)/freeTotal).toBeGreaterThan(.2);
  expect((after.get('eclipse')??0)/afterTotal).toBeLessThan(.05);
});

test('fired incidents join the home record, newest first, five at most; absent tickets count, refusals do not',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');adoptMiscIncidents(w);adoptWeatherIncidents(w);
  // The ransom demand cannot fire (no kidnapped colonist): never recorded.
  const state=w.miscIncidents!,rows=miscLotteryRows329(w,state);
  expect(rows.find(r=>r.id==='ransom-demand')!.eligible!()).toBe(false);
  for(let seed=1;seed<=400;seed++){
    state.rng=seed;delete state.recent341;
    consumeMiscOpportunity329(w,state,true);
    if(state.recent341)expect(state.recent341[0]).not.toBe('ransom-demand');
  }
  // An absent ticket (no effect in Elsewhere) is recorded as the Core incident would be.
  delete state.recent341;let absent:string|undefined;
  for(let seed=1;seed<=400&&!absent;seed++){state.rng=seed;consumeMiscOpportunity329(w,state,false);const id=state.recent341?.[0];if(id&&!rows.find(r=>r.id===id)!.resolve)absent=id;}
  expect(absent).toBeDefined();
  // Order and size of the record.
  delete state.recent341;
  for(const id of ['visitor-group','traveler-group','heat-wave','trader-caravan','orbital-trader','psychic-drone'] as const)recordHomeIncident341(w,id);
  expect(state.recent341).toEqual(['psychic-drone','orbital-trader','trader-caravan','heat-wave','traveler-group']);
  // A real small threat records itself when it fires.
  adoptSmallIncidents(w);delete state.recent341;
  expect(resolveSelectedSmallAnimal(w)).toBe(true);
  expect(state.recent341).toEqual(['animal-insanity-single']);
  // Before 341 nothing is recorded.
  setVersion(w,340);recordHomeIncident341(w,'heat-wave');expect(state.recent341).toEqual(['animal-insanity-single']);
});

test('the records are strict in saves and absent before 341',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');adoptMiscIncidents(w);adoptWeatherIncidents(w);adoptWorldIncidents(w);
  w.miscIncidents!.recent341=['visitor-group','heat-wave','visitor-group'];w.worldIncidents!.recent341=['eclipse'];
  expect(validateWorld(w)).toEqual([]);
  const saved=roundTrip(w);
  // A 340 save cannot hold them; the old-schema helper strips them for older fixtures.
  const raw=JSON.parse(saved) as Record<string,unknown>;raw.schemaVersion=340;
  expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow();
  expect(JSON.parse(asOldSchema(saved,340)).miscIncidents.recent341).toBeUndefined();
  const ids=HOME_RECENT_INCIDENTS_341;
  expect(validRecentIncidents341(['heat-wave'],SCHEMA_VERSION,ids)).toBe(true);
  expect(validRecentIncidents341(['heat-wave'],340,ids)).toBe(false);
  expect(validRecentIncidents341([],SCHEMA_VERSION,ids)).toBe(false);
  expect(validRecentIncidents341(['raid'],SCHEMA_VERSION,ids)).toBe(false); // ignored by Core
  expect(validRecentIncidents341(['eclipse'],SCHEMA_VERSION,ids)).toBe(false); // a World incident
  expect(validRecentIncidents341(Array(6).fill('heat-wave'),SCHEMA_VERSION,ids)).toBe(false);
  const sparse:string[]=[];sparse[1]='heat-wave';
  expect(validRecentIncidents341(sparse,SCHEMA_VERSION,ids)).toBe(false);
  expect(validMiscIncidents({...w.miscIncidents!,recent341:'heat-wave'},SCHEMA_VERSION,w)).toBe(false);
});

test('a schema 340 save migrates to 341 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,340)))).toBe(current);
});

test('pods of several raids are drawn together, each on its own clock',async()=>{
  const {RaidPodLayer,RAID_POD_PARTS}=await import('../src/render/RaidPodLayer.ts');
  const {createWorld}=await import('../src/sim/engine.ts');
  const world=createWorld(341,32,32),layer=new RaidPodLayer();
  const pod=(pawnId:number,x:number,land:number)=>({pawnId,cell:{x,z:12},landAtCore:land,openAtCore:land+141,roofHit:false});
  world.raids={profile:'cassandra-raids-v1',rng:1,nextCheck:null,serial:2,completed:0,departed:[],
    active:{id:1,startedAt:10,deadline:3000,lossPermille:500,members:[900],lost:[],phase:'assault',arrival333:{mode:'edge-drop',atCore:100,centers:[{x:10,z:12}],pods:[pod(900,10,250)]}},
    extraActive261:[{id:2,startedAt:11,deadline:3000,lossPermille:500,members:[901],lost:[],phase:'assault',concurrent341:true,arrival333:{mode:'edge-drop',atCore:110,centers:[{x:14,z:12}],pods:[pod(901,14,260)]}}],extraResults261:[]};
  world.tick=12;
  expect(layer.adopt(world)).toBe(true);expect(layer.mesh.activeCount).toBe(2*RAID_POD_PARTS);
  layer.dispose();
});
