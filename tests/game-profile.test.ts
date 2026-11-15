import { withoutFoodCrops,withMigratedBasic } from './scenarios/legacy-skills';
import { expect,test } from 'vitest';
import { applyCommand,stepWorld } from '../src/sim/engine';
import { createScenarioWorld } from '../src/sim/new-game';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization';
import { moodTarget,moodThoughts } from '../src/sim/mood';
import { crashlandedProfile,playerInfectionFactor } from '../src/sim/game-profile';
import { healthRandom,injurePawn,updatePawnHealth } from '../src/sim/health';
import { createMedicalRecord } from '../src/sim/injury-state';
import { SCHEMA_VERSION,type World } from '../src/sim/types';
import { advanceRaids } from '../src/sim/raids';
import { validateRaids } from '../src/sim/raid-save';
import { CASSANDRA_ACTIVE_TICKS,CASSANDRA_CYCLE_START,CASSANDRA_CYCLE_TICKS,CASSANDRA_MIN_SPACING,INTRO_RAID_TICK,consumeCassandraOpportunity,enableCassandraRaids,validCassandraAgenda } from '../src/sim/cassandra-raids';
import { atMapEdge } from '../src/sim/raid-space';
import { COMPLEX_FURNITURE_RESEARCH_COST,NUTRIENT_PASTE_RESEARCH_COST,STONECUTTING_RESEARCH_COST } from '../src/sim/research';
import { deconstructionCamp } from './scenarios/deconstruction';
import { adoptFluIncidents } from '../src/sim/flu-incidents';
import { adultAgeTicks } from '../src/sim/animal-life';

function stock(world:World) {const totals:Record<string,number>={};for(const p of world.piles)if(p.kind!=='chunk')totals[p.item]=(totals[p.item]??0)+p.quantity;return totals;}
function raidFixture() {
  const world=deconstructionCamp();
  world.scenario={id:'crashlanded',revision:1,landing:{x:16,z:16}};
  world.gameProfile=crashlandedProfile();enableCassandraRaids(world);adoptFluIncidents(world);return world;
}

test('explicit Crashlanded adaptation has physical supplies, mature wild food and separate applied choices; old starts remain unchanged',()=>{
  for(const seed of [42,93,2048]) {
    const world=createScenarioWorld(seed,250,'crashlanded'),legacy=createScenarioWorld(seed,250,'survivors');
    expect(world.tick).toBe(0);expect(world.scenario!.id).toBe('crashlanded');expect(world.gameProfile).toEqual(crashlandedProfile());
    expect(stock(world)).toEqual({...stock(legacy),silver:800,'bolt-action-rifle':1,'plasteel-knife':1});
    expect(world.research).toEqual({...legacy.research,stonecutting:{points:STONECUTTING_RESEARCH_COST,completedAt:0},complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0},nutrientPaste:{points:NUTRIENT_PASTE_RESEARCH_COST,completedAt:0}});
    expect(world.site?.hilliness).toBe('small-hills');expect(legacy.site).toBeUndefined();
    expect(world.pawns).toHaveLength(3);expect(world.arrivals).toBeUndefined();expect(world.heatwaves).toBeUndefined();
    expect(world.raids!.nextCheck).toBe(INTRO_RAID_TICK);expect(legacy.arrivals).toBeDefined();expect(legacy.heatwaves).toBeDefined();
    expect(legacy.gameProfile).toBeUndefined();expect(legacy.resources.filter(r=>r.kind==='berries').every(r=>r.growth!<1)).toBe(true);
    const berries=world.resources.filter(r=>r.kind==='berries'),mature=berries.filter(r=>r.growth===1);
    expect(mature.length).toBeGreaterThan(berries.length*.25);expect(mature.length).toBeLessThan(berries.length*.5);
    expect(validateWorld(world)).toEqual([]);expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  }
  const world=createScenarioWorld(42,32,'crashlanded'),before=serializeWorld(world);
  expect(applyCommand(world,{type:'enable-arrivals'}).ok).toBe(false);
  expect(applyCommand(world,{type:'enable-heatwaves'}).ok).toBe(false);expect(serializeWorld(world)).toBe(before);
});

test('adventure difficulty changes colonist mood target and delayed infection acquisition, not exposure rolls, enemies or physiology',()=>{
  const legacy=createScenarioWorld(42,32,'survivors'),world=createScenarioWorld(42,32,'crashlanded');
  const p=world.pawns[0]!,old=legacy.pawns[0]!;
  // Schema 343: the Crashlanded colony also starts with NewColonyOptimism (+10).
  expect(moodTarget(moodThoughts(world,p).filter(t=>t.id!=='lost-new-colony-null'))-moodTarget(moodThoughts(legacy,old))).toBe(5);
  const enemy={...p,faction:'outlaws' as const};
  expect(moodThoughts(world,enemy).some(t=>t.id==='difficulty-mood')).toBe(false);
  expect(playerInfectionFactor(world,enemy)).toBe(1);
  world.rng=legacy.rng=991;
  injurePawn(world,p,'left-arm','crush',2000);injurePawn(legacy,old,'left-arm','crush',2000);
  expect(p.health).toEqual(old.health);expect(world.rng).toBe(legacy.rng);

  // Controlled boundary at the second roll: .525 with Adventure versus .7
  // historically, for a 12-HP wound tended at zero quality, room factor 1.
  let seed=1;while(true){const rng={rng:seed};const roll=healthRandom(rng);if(roll>.525&&roll<.7)break;seed++;}
  // Immunity luck is keyed by actor identity: terrain generation now consumes
  // different IDs. Compare physiology with the same actor, changing only profile.
  const specimens=[structuredClone(world),structuredClone(legacy),structuredClone(legacy)];
  specimens[2]!.gameProfile=crashlandedProfile();
  for(const [index,sample] of specimens.entries()) {
    sample.tick=1500;sample.rng=seed;const pawn=sample.pawns[0]!;
    if(index===2)pawn.faction='outlaws';
    pawn.health={...createMedicalRecord(1499),nextInjuryId:2,injuries:[{id:1,part:'left-arm',kind:'cut',severity:12000,bornAt:0,tended:0,infection:{dueCore:15000,roomFactor:1000}}]};
    updatePawnHealth(sample,pawn);
    expect(pawn.health.injuries[0]!.infection).toBeUndefined();
    expect(pawn.health.infections?.cases.length??0).toBe(index===0?0:1);
  }
  const first=specimens[1]!,second=specimens[2]!;
  expect(first.pawns[0]!.health).toEqual(second.pawns[0]!.health);
});

test('Cassandra opportunities use fixed windows, survive saves and skip impossible raids without postponement or resource creation',()=>{
  const world=raidFixture();world.tick=INTRO_RAID_TICK-1;advanceRaids(world);expect(world.raids!.serial).toBe(0);
  world.tick++;advanceRaids(world);expect(world.raids!.active!.startedAt).toBe(INTRO_RAID_TICK);
  const enemy=world.pawns.find(p=>p.raid)!;expect(atMapEdge(world,enemy)).toBe(true);
  const agenda=structuredClone(world.raids!.cassandra),copy=deserializeWorld(serializeWorld(world));
  stepWorld(world,120);stepWorld(copy,120);expect(copy).toEqual(world);expect(validateWorld(world)).toEqual([]);
  injurePawn(world,enemy,'brain','crush',99000);advanceRaids(world);
  expect(world.raids!.active).toBeUndefined();expect(world.raids!.cassandra).toEqual(agenda);
  expect(world.raids!.nextCheck).toBe(agenda!.pending[0]);expect(validateWorld(world)).toEqual([]);

  const blocked=raidFixture();
  for(let z=0;z<blocked.height;z++)for(let x=0;x<blocked.width;x++)if(atMapEdge(blocked,{x,z}))blocked.tiles[z*blocked.width+x]={terrain:'rock'};
  const ids=blocked.nextId,rng=blocked.raids!.rng;blocked.tick=INTRO_RAID_TICK;advanceRaids(blocked);
  expect(blocked.raids!.serial).toBe(0);expect(blocked.nextId).toBe(ids);expect(blocked.raids!.rng).toBe(rng);
  expect(blocked.raids!.nextCheck).toBeGreaterThanOrEqual(CASSANDRA_CYCLE_START);
  const next=blocked.raids!.nextCheck;blocked.tick++;advanceRaids(blocked);expect(blocked.raids!.nextCheck).toBe(next);

  const occupied=raidFixture();occupied.tick=INTRO_RAID_TICK;advanceRaids(occupied);
  const memberIds=[...occupied.raids!.active!.members],due=occupied.raids!.cassandra!.pending[0]!;
  occupied.tick=due;advanceRaids(occupied);
  expect(occupied.raids!.serial).toBe(1);expect(occupied.raids!.active!.members).toEqual(memberIds);
  expect(occupied.raids!.cassandra!.pending[0]).toBeGreaterThan(due);
  expect(occupied.raids!.nextCheck).toBeNull();expect(validateRaids(occupied,occupied.schemaVersion,new Set())).toEqual([]);

  // Audit forty calendar cycles, including after day 20, without inventing
  // full colony outcomes by fast-forwarding its medical and work systems.
  for(const seed of [1,42,93,2048]) {
    const schedule=raidFixture();schedule.seed=seed;delete schedule.raids;enableCassandraRaids(schedule);
    schedule.tick=INTRO_RAID_TICK;consumeCassandraOpportunity(schedule,schedule.raids!);
    for(let cycle=0;cycle<40;cycle++) {
      const s=schedule.raids!.cassandra!,times=[...s.pending],start=CASSANDRA_CYCLE_START+cycle*CASSANDRA_CYCLE_TICKS;
      expect(s.cycle).toBe(cycle);expect(validCassandraAgenda(s,schedule.tick)).toBe(true);
      expect(times.length).toBeGreaterThanOrEqual(1);expect(times.length).toBeLessThanOrEqual(2);
      expect(times[0]).toBeGreaterThanOrEqual(start);expect(times.at(-1)).toBeLessThanOrEqual(start+CASSANDRA_ACTIVE_TICKS);
      if(times.length===2)expect(times[1]!-times[0]!).toBeGreaterThanOrEqual(CASSANDRA_MIN_SPACING);
      for(const tick of times){schedule.tick=tick;expect(consumeCassandraOpportunity(schedule,schedule.raids!)).toBe(true);}
      expect(validateRaids(schedule,schedule.schemaVersion,new Set()),`seed ${seed}, cycle ${cycle}`).toEqual([]);
    }
  }
});

test('Cassandra next opportunity follows its exact anchored window, including gaps longer than one cycle',()=>{
  const world=raidFixture();world.tick=392899;
  // Calendar-only witness extracted from the natural V86 colony at J65.
  // No population, combat outcome or physiological fast-forward is claimed.
  world.raids!.cassandra={rng:1390367705,cycle:5,pending:[392900]};world.raids!.nextCheck=392900;
  expect(validateRaids(world,world.schemaVersion,new Set())).toEqual([]);
  const copy=structuredClone(world);
  for(const w of [world,copy]){w.tick++;expect(consumeCassandraOpportunity(w,w.raids!)).toBe(true);}
  expect(world.raids!.cassandra).toEqual({rng:1879587103,cycle:6,pending:[458800,470200]});
  expect(world.raids!.nextCheck).toBe(458800);
  expect(world.raids!.nextCheck!-world.tick).toBeGreaterThan(CASSANDRA_CYCLE_TICKS);
  expect(validateRaids(world,world.schemaVersion,new Set())).toEqual([]);expect(copy.raids).toEqual(world.raids);
  const start=CASSANDRA_CYCLE_START+6*CASSANDRA_CYCLE_TICKS,end=start+CASSANDRA_ACTIVE_TICKS;
  for(const mutate of [
    (w:World)=>w.raids!.nextCheck!+=100,
    (w:World)=>{w.raids!.cassandra!.pending=[start-100];w.raids!.nextCheck=start-100;},
    (w:World)=>{w.raids!.cassandra!.pending=[end+100];w.raids!.nextCheck=end+100;},
    (w:World)=>{w.raids!.cassandra!.pending=[458801];w.raids!.nextCheck=458801;},
    (w:World)=>{w.raids!.cassandra!.pending=[458800,458900];},
    (w:World)=>w.raids!.completed++,
  ]){const bad=structuredClone(world);mutate(bad);expect(validateRaids(bad,bad.schemaVersion,new Set()).length).toBeGreaterThan(0);}
  // The historical camp retains its own bounded delay, with no Cassandra rule.
  const legacy=structuredClone(world);delete legacy.raids!.cassandra;delete legacy.raids!.mechanoid;legacy.raids!.profile='camp-raids-v1';
  legacy.raids!.nextCheck=legacy.tick+8*6000;expect(validateRaids(legacy,legacy.schemaVersion,new Set())).toEqual([]);
  legacy.raids!.nextCheck++;expect(validateRaids(legacy,legacy.schemaVersion,new Set())).toContain('Invalid raid schedule or count.');
});

test('V81 migration is strictly neutral and rejects future profile/calendar injection; malformed current choices cannot enter a session',()=>{
  const world=createScenarioWorld(42,32,'survivors');stepWorld(world,35);
  const old=withoutFoodCrops({...structuredClone(world),schemaVersion:81});
  for(const pawn of old.pawns)delete pawn.background;
  if(old.arrivals?.pending){delete old.arrivals.pending.background;delete old.arrivals.pending.age;}
  delete old.climate;delete old.weather;delete old.fires;delete old.wind;
  // These prospective calendars were not stored in an authentic V81 payload.
  delete old.rainElectrical;delete old.miscIncidents;delete old.smallIncidents;delete old.worldIncidents;
  for(const plant of old.resources)delete plant.plantLife;
  for(const animal of old.wildlife?.animals??[])delete (animal as Partial<typeof animal>).ageTicks;
  const restored=deserializeWorld(JSON.stringify(old));
  const expected=withMigratedBasic({...old,schemaVersion:SCHEMA_VERSION});
  for(const animal of expected.wildlife?.animals??[])animal.ageTicks=adultAgeTicks(animal.species);
  expect(restored).toEqual(expected);expect(restored.gameProfile).toBeUndefined();
  for(const mutate of [(w:any)=>w.gameProfile=crashlandedProfile(),(w:any)=>w.scenario.id='crashlanded',(w:any)=>w.raids.profile='cassandra-raids-v1',(w:any)=>w.pawns[0].priorities.basic=3]) {
    const bad=structuredClone(old);mutate(bad);expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow(/version 81/);
  }
  const current=createScenarioWorld(42,32,'crashlanded');
  for(const mutate of [(w:any)=>delete w.gameProfile,(w:any)=>w.gameProfile.difficulty='peaceful',(w:any)=>w.gameProfile.other=true,
    (w:any)=>w.scenario.id='survivors',(w:any)=>w.raids.cassandra.pending=[INTRO_RAID_TICK+1],(w:any)=>w.raids.cassandra.rng=0,
    (w:any)=>w.raids.cassandra.cycle=0,(w:any)=>w.raids.nextCheck++,(w:any)=>delete w.raids,
    (w:any)=>w.heatwaves=world.heatwaves,(w:any)=>w.arrivals=world.arrivals]) {
    const bad=structuredClone(current);mutate(bad);expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow();
  }
  stepWorld(current,125);const resumed=deserializeWorld(serializeWorld(current));stepWorld(current,75);stepWorld(resumed,75);
  expect(resumed).toEqual(current);expect(validateWorld(current)).toEqual([]);
});
