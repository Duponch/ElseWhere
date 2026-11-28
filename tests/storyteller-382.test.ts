import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {adoptRwsProfile382} from '../src/import/rimworld/import-clock.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {createWorld} from '../src/sim/index.ts';
import {validGameProfile} from '../src/sim/game-profile-save.ts';
import {consumeCassandraOpportunity,enableCassandraRaids,validCassandraAgenda,INTRO_RAID_TICK} from '../src/sim/cassandra-raids.ts';
import {adoptSmallIncidents,advanceSmallIncidents,smallCycleAt} from '../src/sim/cassandra-small.ts';
import {validSmallIncidents} from '../src/sim/cassandra-small-save.ts';
import {adoptFluIncidents,fluFirstCheck382} from '../src/sim/flu-incidents.ts';
import {validFluIncidents} from '../src/sim/flu-incidents-save.ts';
import {crashlandedProfile,difficultyValues347,diseaseIntervalFactor382,extremeWeatherAllowed382,homeThreatCycle382,threatModifiers382,type GameProfile} from '../src/sim/game-profile.ts';
import {computeThreatPoints} from '../src/sim/threat-points.ts';
import {TICKS_PER_DAY,type World} from '../src/sim/types.ts';
import {phoebeCoreBigHit382,phoebeCoreSmallHit382} from '../src/sim/phoebe-native-cycle-382.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const phoebe=():GameProfile=>({...crashlandedProfile(),storyteller:'phoebe-partial',difficulty:'community-builder'});

it('adopts the actual Phoebe/Easy and Cassandra/Rough source profile when the map owns a geographic game profile',()=>{
 for(const [narrator,difficulty,wanted] of [['Phoebe','Easy',phoebe()],['Cassandra','Rough',{...crashlandedProfile(),difficulty:'strive-to-survive'}]] as const){
  const save=readRwsSave(fixture.replace('<def>Cassandra</def><difficulty>Medium</difficulty>',`<def>${narrator}</def><difficulty>${difficulty}</difficulty>`)),w=createWorld(42,16,16),notes=new ImportNotes();
  w.gameProfile=crashlandedProfile();adoptRwsProfile382({w,save,notes});
  expect(w.gameProfile).toEqual(wanted);expect(validGameProfile(w.gameProfile,382,{id:'crashlanded'})).toBe(true);expect(validGameProfile(w.gameProfile,381,{id:'crashlanded'})).toBe(false);
 }
});

it('Phoebe has exactly one big threat opportunity per eight active and eight quiet days, starting day 13',()=>{
 const w=createWorld(313,16,16);w.gameProfile=phoebe();delete w.raids;enableCassandraRaids(w);
 expect(homeThreatCycle382(w)).toEqual({start:13*TICKS_PER_DAY,active:8*TICKS_PER_DAY,cycle:16*TICKS_PER_DAY,spacing:0,bigCount:1});
 w.tick=INTRO_RAID_TICK;expect(consumeCassandraOpportunity(w,w.raids!)).toBe(true);
 for(let i=0;i<12;i++){
  const due=w.raids!.cassandra!.pending;expect(due).toHaveLength(1);
  expect(due[0]).toBeGreaterThanOrEqual((13+16*i)*TICKS_PER_DAY);expect(due[0]).toBeLessThan((21+16*i)*TICKS_PER_DAY);
  expect(validCassandraAgenda(w.raids!.cassandra,w.tick,382,w.gameProfile)).toBe(true);
  w.tick=due[0]!;expect(consumeCassandraOpportunity(w,w.raids!)).toBe(true);expect(consumeCassandraOpportunity(w,w.raids!)).toBe(false);
 }
});

it('starts small threats and diseases at the correct Phoebe frontiers',()=>{
 const w=createWorld(123,16,16);w.gameProfile=phoebe();delete w.smallIncidents;delete w.fluIncidents;
 adoptSmallIncidents(w);adoptFluIncidents(w);
 expect((w as World).smallIncidents?.nextCheck).toBe(13*TICKS_PER_DAY);expect(fluFirstCheck382(w)).toBe(12*TICKS_PER_DAY+100);
 expect((w as World).fluIncidents?.nextCheck).toBe(fluFirstCheck382(w));expect(validFluIncidents(w,382)).toBe(true);
 expect(smallCycleAt(13*TICKS_PER_DAY-1,w)).toBe(-1);expect(smallCycleAt(13*TICKS_PER_DAY,w)).toBe(0);expect(smallCycleAt(29*TICKS_PER_DAY,w)).toBe(1);
 w.tick=13*TICKS_PER_DAY;advanceSmallIncidents(w);expect((w as World).smallIncidents?.cycle).toBe(0);expect(validSmallIncidents(w.smallIncidents,382,w)).toBe(true);
});

it('retains future source-seeded hits in the current cycle and rejects a tampered pending date',()=>{
 const native={worldRandom:12345678,mapUniqueId:4},w=createWorld(1,16,16);w.gameProfile=phoebe();
 const hit=phoebeCoreBigHit382(native,3);w.tick=hit-1;
 delete w.raids;enableCassandraRaids(w,true,native);
 const agenda=(w as World).raids!.cassandra!;expect(agenda.cycle).toBe(3);expect(agenda.pending[0]).toBe(hit);expect(validCassandraAgenda(agenda,w.tick,382,w.gameProfile)).toBe(true);
 expect(validCassandraAgenda({...agenda,pending:[hit+100]},w.tick,382,w.gameProfile)).toBe(false);
 expect(validCassandraAgenda(agenda,w.tick,381,w.gameProfile)).toBe(false);
 // A retained mid-cycle small hit is a future candidate; acceptance is not
 // consumed before its own boundary.
 let cycle=0,small=phoebeCoreSmallHit382(native,cycle);while(!small||small.tick===13*TICKS_PER_DAY)small=phoebeCoreSmallHit382(native,++cycle);
 w.tick=small.tick-1;delete w.smallIncidents;adoptSmallIncidents(w);
 expect((w as World).smallIncidents?.pending).toEqual([small.tick]);expect(validSmallIncidents(w.smallIncidents,382,w)).toBe(true);
});

it('applies separate difficulty threat scaling, adaptation blend, disease interval and Core table values',()=>{
 const easy={gameProfile:phoebe()},rough={gameProfile:{...crashlandedProfile(),difficulty:'strive-to-survive' as const}},medium={gameProfile:crashlandedProfile()};
 expect(difficultyValues347(easy)).toMatchObject({colonistMoodOffset:10,playerPawnInfectionChanceFactor:.5,cropYieldFactor:1.2,researchSpeedFactor:1.2,enemyReproductionRateFactor:.15});
 expect(difficultyValues347(rough)).toMatchObject({colonistMoodOffset:0,playerPawnInfectionChanceFactor:1,cropYieldFactor:1,researchSpeedFactor:1,enemyReproductionRateFactor:1,scariaRotChance:.6});
 expect(diseaseIntervalFactor382(easy)).toBe(2.5);expect(diseaseIntervalFactor382(rough)).toBe(1);expect(diseaseIntervalFactor382(medium)).toBe(1.5);
 expect(extremeWeatherAllowed382(easy)).toBe(false);expect(extremeWeatherAllowed382(rough)).toBe(true);
 const common={knownWealth:400000,freeColonists:10,colonistHealthSum:10,elapsedDays:60,adaptationDays:60,seedBucket:800};
 const e=computeThreatPoints({...common,difficulty:threatModifiers382(easy)}),m=computeThreatPoints(common),r=computeThreatPoints({...common,difficulty:threatModifiers382(rough)});
 expect(e.points).toBe(m.points/2);expect(e.minimum).toBeLessThanOrEqual(45);expect(r.adaptationFactor).toBeCloseTo(1.18);expect(r.points).toBeCloseTo(m.points*(1.18/1.2)/.6);
});
