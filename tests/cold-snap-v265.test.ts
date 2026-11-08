import { expect,test } from 'vitest';
import { adoptMiscIncidents,adoptWeatherIncidents,advanceMiscIncidents,MISC_FIRST_CHECK } from '../src/sim/cassandra-misc.ts';
import { enableCassandraRaids } from '../src/sim/cassandra-raids.ts';
import { activeColdSnap,coldSnapOffset,eligibleColdSnap,COLD_SNAP_COOLDOWN,COLD_SNAP_TRANSITION_TICKS } from '../src/sim/cold-snap.ts';
import { advanceHeatExposure } from '../src/sim/heat-exposure.ts';
import { crashlandedProfile } from '../src/sim/game-profile.ts';
import { createMedicalRecord } from '../src/sim/injury-state.ts';
import { createWorld,refreshStock } from '../src/sim/index.ts';
import { newCampfireFuel } from '../src/sim/fuel.ts';
import { plantGrowth } from '../src/sim/plants.ts';
import { deserializeWorld,serializeWorld } from '../src/sim/serialization.ts';
import { adoptSiteClimate,climateTick,seasonTemperature,siteClimateDefinition } from '../src/sim/site-climate.ts';
import { resolveSite } from '../src/sim/site.ts';
import { initializeWildFlora } from '../src/sim/wild-flora.ts';
import { adoptFluIncidents } from '../src/sim/flu-incidents.ts';
import { advanceTemperature,outdoorTemperature,reconcileTemperature,TemperatureView } from '../src/sim/temperature.ts';
import { updatePlantTemperatures } from '../src/sim/thermal-plants.ts';
import { TICKS_PER_DAY,type World } from '../src/sim/types.ts';
import { plantClimateFixture } from './scenarios/plant-climate.ts';
import { fixtureBuilding } from './scenarios/deconstruction.ts';

/** Choose a real climate phase rather than mocking the season calculation. */
function season(world:World,predicate:(temperature:number)=>boolean,dayFraction=.5):void {
  world.climate={revision:1,profile:'boreal-reference',adoptedAt:world.tick,calendarOrigin:0};
  const site=siteClimateDefinition(world);
  const day=Array.from({length:60},(_,i)=>i).find(day=>predicate(seasonTemperature(site.latitude,site.meanTemperature,(day+dayFraction)*TICKS_PER_DAY)));
  expect(day).toBeDefined();world.climate.calendarOrigin=(day!+dayFraction)*TICKS_PER_DAY;
}
function weather(world:World):void {
  world.gameProfile=crashlandedProfile();adoptMiscIncidents(world);adoptWeatherIncidents(world);
}
/** Prepared plateau for consequences; calendar generation is tested separately. */
function plateau(world:World):void {
  weather(world);
  const state=world.miscIncidents!.weather!;
  state.coldSnaps=1;state.lastColdSnapStart=world.tick-COLD_SNAP_TRANSITION_TICKS;
  state.coldSnap={start:state.lastColdSnapStart,end:world.tick+9000};
}
function smallCassandra():World {
  const world=createWorld(42,16,16);
  world.pawns=[];world.resources=[];world.piles=[];world.jobs=[];world.structures=[];
  world.stockpiles=[];world.growingZones=[];refreshStock(world);
  world.tick=MISC_FIRST_CHECK-1;season(world,t=>t>8&&t<12);weather(world);
  return world;
}

test('cold offset follows both transitions and contributes nothing outside its interval',()=>{
  const world=smallCassandra(),start=world.tick+1,end=start+9000;
  world.miscIncidents!.weather!.coldSnap={start,end};
  for(const [tick,offset] of [[start-1,0],[start,0],[start+600,-10],[start+1200,-20],
    [end-1200,-20],[end-600,-10],[end,0],[end+1,0]]) {
    world.tick=tick!;expect(coldSnapOffset(world)).toBe(offset);
    expect(!!activeColdSnap(world)).toBe(tick!>=start&&tick!<end);
  }
  world.miscIncidents!.weather!.coldSnap={start,end:start+1200};world.tick=start+600;
  expect(coldSnapOffset(world)).toBe(-10);
});

test('outdoor temperature adds the cold offset while historical numeric temperature remains exact',()=>{
  const world=smallCassandra(),baseline=outdoorTemperature(world),numeric=outdoorTemperature(world.tick);
  plateau(world);expect(coldSnapOffset(world)).toBe(-20);
  expect(outdoorTemperature(world)).toBeCloseTo(baseline-20,12);
  expect(outdoorTemperature(world.tick)).toBe(numeric);
  delete world.miscIncidents!.weather!.coldSnap;expect(outdoorTemperature(world)).toBe(baseline);
});

test('eligibility uses the seasonal range rather than daily warmth or existing cold offset',()=>{
  const world=smallCassandra();expect(eligibleColdSnap(world)).toBe(true);
  const seasonal=seasonTemperature(siteClimateDefinition(world).latitude,siteClimateDefinition(world).meanTemperature,climateTick(world));
  expect(seasonal).toBeGreaterThan(0);expect(seasonal).toBeLessThan(15);
  season(world,t=>t>8&&t<12,0);expect(eligibleColdSnap(world)).toBe(true);
  season(world,t=>t<0);expect(eligibleColdSnap(world)).toBe(false);
  season(world,t=>t>15);expect(eligibleColdSnap(world)).toBe(false);
  delete world.climate;expect(eligibleColdSnap(world)).toBe(false);
});

test('heat/cold overlap, schema admission and thirty-day cooldown gate a selected cold ticket',()=>{
  const world=smallCassandra(),state=world.miscIncidents!,extra=state.weather!;
  const rng=world.rng;expect(eligibleColdSnap(world)).toBe(true);
  state.active={start:world.tick,end:world.tick+9000};expect(eligibleColdSnap(world)).toBe(false);delete state.active;
  extra.coldSnap={start:world.tick,end:world.tick+9000};expect(eligibleColdSnap(world)).toBe(false);delete extra.coldSnap;
  extra.lastColdSnapStart=world.tick;world.tick+=COLD_SNAP_COOLDOWN-1;season(world,t=>t>8&&t<12);
  expect(eligibleColdSnap(world)).toBe(false);world.tick++;expect(eligibleColdSnap(world)).toBe(true);
  world.schemaVersion=199 as World['schemaVersion'];expect(eligibleColdSnap(world)).toBe(false);
  expect(world.rng).toBe(rng);
});

test('the same cold outside air causes hypothermia while a warm actual room protects its occupant',()=>{
  const world=plantClimateFixture(20);season(world,t=>t>8&&t<12);plateau(world);
  const outside=world.pawns[0]!;outside.x=12;outside.z=12;
  world.tick+=((outside.id-world.tick)%6+6)%6;outside.health=createMedicalRecord(world.tick);
  const indoor=structuredClone(world),sheltered=indoor.pawns[0]!;sheltered.x=4;sheltered.z=4;
  const outsideAir=new TemperatureView(world),indoorAir=new TemperatureView(indoor);
  expect(outsideAir.at(world,outside)).toBeLessThan(0);expect(indoorAir.at(indoor,sheltered)).toBe(20);
  advanceHeatExposure(world,outside,()=>outsideAir.at(world,outside));
  advanceHeatExposure(indoor,sheltered,()=>indoorAir.at(indoor,sheltered));
  expect(outside.health!.hypothermia).toBeGreaterThan(0);expect(sheltered.health!.hypothermia).toBeUndefined();
});

test('existing fueled room heating counters cold leakage without changing the outside event',()=>{
  const plain=plantClimateFixture(0);season(plain,t=>t>8&&t<12);plateau(plain);
  const heated=structuredClone(plain),fire=fixtureBuilding(heated,'campfire',3,3);
  Object.assign(fire,{fuel:newCampfireFuel(),bills:[]});
  const coldLayout=reconcileTemperature(plain),warmLayout=reconcileTemperature(heated);
  for(let i=0;i<60;i++) {
    plain.tick++;heated.tick++;advanceTemperature(plain,coldLayout);advanceTemperature(heated,warmLayout);
  }
  expect(new TemperatureView(heated).at(heated,{x:3,z:3})).toBeGreaterThan(new TemperatureView(plain).at(plain,{x:3,z:3}));
  expect(coldSnapOffset(plain)).toBe(coldSnapOffset(heated));expect(outdoorTemperature(plain)).toBe(outdoorTemperature(heated));
});

test('outside crop growth settles its previous interval at its TickLong and stops in the cold rather than losing prior growth',()=>{
  const world=plantClimateFixture(20);
  // Resource producers replace the array, invalidating the fixture's indoor binding.
  world.resources=[{...world.resources[0]!,x:12,z:12,growth:.2,growthTick:world.tick}];
  const plant=world.resources[0]!;
  // Schema 301, as RimWorld 1.6 Plant.TickLong: the plant reads its temperature
  // once every 200 local ticks (2000 Core), in the local tick of id % 2000.
  const nextSample=(after:number)=>{const slot=Math.floor(plant.id%2000/10);return after+1+((slot-(after+1))%200+200)%200;};
  season(world,t=>t>8&&t<12);const layout=reconcileTemperature(world);updatePlantTemperatures(world,layout);
  plateau(world);const cold=nextSample(world.tick);
  world.tick=cold-1;updatePlantTemperatures(world,layout);expect(plant.growthThermalFactor).toBeUndefined();
  world.tick=cold;const before=plantGrowth(world,plant);updatePlantTemperatures(world,layout);
  expect(plant.growth).toBe(before);expect(plant.growthTick).toBe(world.tick);expect(plant.growthThermalFactor).toBe(0);
  world.tick+=30;expect(plantGrowth(world,plant)).toBe(before);
  delete world.miscIncidents!.weather!.coldSnap;const thaw=nextSample(world.tick);
  world.tick=thaw-1;updatePlantTemperatures(world,layout);expect(plant.growthThermalFactor).toBe(0);
  world.tick=thaw;updatePlantTemperatures(world,layout);
  expect(plantGrowth(world,plant)).toBe(before);expect(plant.growthThermalFactor).toBeUndefined();
  world.tick+=30;expect(plantGrowth(world,plant)).toBeGreaterThan(before);
});

test('a naturally selected cold interval saves and resumes its ramp and end exactly once',()=>{
  // Full save validation requires the scenario, site and climate adoption provenance.
  const world=createWorld(265,32,32);
  world.pawns=[];world.resources=[];world.piles=[];world.jobs=[];world.structures=[];
  world.stockpiles=[];world.growingZones=[];refreshStock(world);
  world.gameProfile=crashlandedProfile();world.tick=MISC_FIRST_CHECK-1;
  world.scenario={id:'crashlanded',revision:8,landing:{x:4,z:4}};
  world.site=resolveSite(world.seed,{hilliness:'flat',biome:'boreal-forest'});
  if(world.site.revision===2)initializeWildFlora(world,world.site);
  enableCassandraRaids(world);adoptFluIncidents(world);adoptSiteClimate(world);adoptMiscIncidents(world);adoptWeatherIncidents(world);
  const state=world.miscIncidents!;state.rng=11;
  const rng=world.rng;world.tick=MISC_FIRST_CHECK;advanceMiscIncidents(world);
  expect(state.weather!.coldSnap).toBeDefined();expect(state.opportunities).toBe(1);expect(world.rng).toBe(rng);
  const interval=structuredClone(state.weather!.coldSnap!);
  expect(interval.end-interval.start).toBeGreaterThanOrEqual(9000);
  expect(interval.end-interval.start).toBeLessThan(21000);
  const resumed=deserializeWorld(serializeWorld(world));expect(resumed).toEqual(world);
  for(const tick of [interval.start+600,interval.start+1200,interval.end-600,interval.end]) {
    world.tick=tick;resumed.tick=tick;advanceMiscIncidents(world);advanceMiscIncidents(resumed);
    expect(resumed).toEqual(world);expect(coldSnapOffset(resumed)).toBe(coldSnapOffset(world));
  }
  expect(state.weather!.coldSnap).toBeUndefined();expect(state.weather!.coldSnaps).toBe(1);
  const ended=structuredClone(world);advanceMiscIncidents(world);expect(world).toEqual(ended);
});
