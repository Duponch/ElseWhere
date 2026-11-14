import { expect,test } from 'vitest';
import { withoutMiningSkill, withoutTelevisionRecreation } from './scenarios/legacy-skills.ts';
import { createWorld,deserializeWorld,serializeWorld,stepWorld,validateWorld } from '../src/sim/index.ts';
import { createScenarioWorld } from '../src/sim/new-game.ts';
import { crashlandedProfile } from '../src/sim/game-profile.ts';
import { climateTick,seasonalOutdoorTemperature,seasonTemperature,siteClimateDefinition } from '../src/sim/site-climate.ts';
import { adoptMiscIncidents,advanceMiscIncidents,eligibleMiscHeatwave,MISC_CATEGORY_CHANCE,MISC_FIRST_CHECK,
  MISC_HEAT_COOLDOWN,MISC_INTRO_TICK,resolveSelectedHeatwave } from '../src/sim/cassandra-misc.ts';
import { validMiscIncidents } from '../src/sim/cassandra-misc-save.ts';
import { heatwaveOffset } from '../src/sim/heatwave.ts';
import { outdoorTemperature } from '../src/sim/temperature.ts';
import { SnapshotDecoder,SnapshotEncoder } from '../src/bridge/snapshots.ts';
import { V190_ITEM_IDS } from '../src/sim/biome-items.ts';
import { faunaBiome } from '../src/sim/animal-species.ts';
import { withoutPredatorApparelPolicies,withoutPredatorFoodPolicies } from './scenarios/legacy-save.ts';
import type { World } from '../src/sim/types.ts';

function cassandra(tick=0,seed=42):World {
  const world=createWorld(seed,16,16);world.pawns=[];world.gameProfile=crashlandedProfile();world.tick=tick;
  adoptMiscIncidents(world);return world;
}
/** The seeds below were chosen for the single-ticket lottery used before
 * schema 329; tests/storyteller-fidelity-329.test.ts covers the Core one. */
const lottery328=(world:World):World=>{(world as {schemaVersion:number}).schemaVersion=328;return world;};
function warm(world:World):void {
  const definition=siteClimateDefinition(world);
  const warmDay=Array.from({length:60},(_,day)=>day).find(day=>
    seasonTemperature(definition.latitude,definition.meanTemperature,day*6000)>=20);
  expect(warmDay).toBeDefined();
  world.climate={revision:1,profile:'temperate-reference',adoptedAt:world.tick,calendarOrigin:warmDay!*6000};
}
function cold(world:World):void {
  const definition=siteClimateDefinition(world);
  const coldDay=Array.from({length:60},(_,day)=>day).find(day=>
    seasonTemperature(definition.latitude,definition.meanTemperature,day*6000)>=14&&
    seasonTemperature(definition.latitude,definition.meanTemperature,day*6000)<18);
  expect(coldDay).toBeDefined();
  world.climate={revision:1,profile:'temperate-reference',adoptedAt:world.tick,calendarOrigin:coldDay!*6000+4080};
}

test('Cassandra adopts prospectively, while historical camps keep their calendar and world RNG',()=>{
  const historical=createWorld(42,16,16);const originalHeat=historical.heatwaves;
  adoptMiscIncidents(historical);expect(historical.miscIncidents).toBeUndefined();expect(historical.heatwaves).toBe(originalHeat);
  const world=cassandra(MISC_INTRO_TICK-1);const state=world.miscIncidents!;
  expect(state).toMatchObject({adoptedAt:MISC_INTRO_TICK-1,nextCheck:MISC_FIRST_CHECK,introDone:false,
    checks:0,opportunities:0,heatwaves:0});
  const worldRng=world.rng,privateRng=state.rng;
  adoptMiscIncidents(world);expect(state.rng).toBe(privateRng);
  advanceMiscIncidents(world);expect(state.opportunities).toBe(0);
  world.tick=MISC_INTRO_TICK;advanceMiscIncidents(world);
  expect(state.introDone).toBe(true);expect(state.opportunities).toBe(1);expect(world.rng).toBe(worldRng);
  advanceMiscIncidents(world);expect(state.opportunities).toBe(1);
  const selected=lottery328(cassandra(MISC_INTRO_TICK-1,13312));
  warm(selected);selected.tick=MISC_INTRO_TICK;advanceMiscIncidents(selected);
  expect(selected.miscIncidents!.active?.start).toBe(MISC_INTRO_TICK);
  expect(selected.miscIncidents!.heatwaves).toBe(1);
  const late=cassandra(MISC_INTRO_TICK);expect(late.miscIncidents!.introDone).toBe(true);
  advanceMiscIncidents(late);expect(late.miscIncidents!.opportunities).toBe(0);
  const later=cassandra(MISC_FIRST_CHECK+17);
  expect(later.miscIncidents!.nextCheck).toBe(MISC_FIRST_CHECK+100);
});

test('category checks use linear Core MTB and silent unimplemented tickets',()=>{
  expect(MISC_CATEGORY_CHANCE).toBe(1/288);
  const world=cassandra(MISC_FIRST_CHECK-1),state=world.miscIncidents!;
  const firstRng=state.rng;
  advanceMiscIncidents(world);expect(state.checks).toBe(0);
  world.tick=MISC_FIRST_CHECK;advanceMiscIncidents(world);
  expect(state.checks).toBe(1);expect(state.nextCheck).toBe(MISC_FIRST_CHECK+100);
  expect(state.rng).not.toBe(firstRng);
  advanceMiscIncidents(world);expect(state.checks).toBe(1);
  const selected=lottery328(cassandra(MISC_FIRST_CHECK-1));
  warm(selected);selected.miscIncidents!.rng=1;
  selected.tick=MISC_FIRST_CHECK;advanceMiscIncidents(selected);
  expect(selected.miscIncidents!).toMatchObject({checks:1,opportunities:1,heatwaves:1});
  expect(selected.miscIncidents!.active?.start).toBe(MISC_FIRST_CHECK);
  // A chosen unsupported ticket consumes the opportunity without creating heat.
  const other=lottery328(cassandra(MISC_INTRO_TICK-1));
  warm(other);other.miscIncidents!.rng=0x12345678;
  other.tick=MISC_INTRO_TICK;advanceMiscIncidents(other);
  expect(other.miscIncidents!.opportunities).toBe(1);
  expect(other.miscIncidents!.heatwaves).toBe(0);
  expect(other.miscIncidents!.active).toBeUndefined();
});

test('a legacy Cassandra continuation without adopted climate consumes heat without inventing a season',()=>{
  const world=cassandra(MISC_INTRO_TICK-1,13312),state=world.miscIncidents!;
  expect(world.climate).toBeUndefined();
  world.tick=MISC_INTRO_TICK;
  const worldRng=world.rng,air=outdoorTemperature(world);
  expect(eligibleMiscHeatwave(world)).toBe(false);
  advanceMiscIncidents(world);
  expect(state).toMatchObject({introDone:true,opportunities:1,heatwaves:0});
  expect(state.active).toBeUndefined();
  expect(world.rng).toBe(worldRng);
  expect(outdoorTemperature(world)).toBe(air);
  expect(world.climate).toBeUndefined();
});

test('seasonal temperature, occupancy and exact thirty-day start cooldown gate heat',()=>{
  const world=cassandra(26_399),state=world.miscIncidents!;
  cold(world);
  expect(seasonTemperature(siteClimateDefinition(world).latitude,siteClimateDefinition(world).meanTemperature,climateTick(world))).toBeLessThan(20);
  expect(seasonalOutdoorTemperature(world)).toBeGreaterThan(20);
  expect(eligibleMiscHeatwave(world)).toBe(false);
  // The daily term can be warm while the season stays cold.
  warm(world);world.tick=26_400;expect(eligibleMiscHeatwave(world)).toBe(true);
  const worldRng=world.rng;expect(resolveSelectedHeatwave(world)).toBe(true);
  expect(world.rng).toBe(worldRng);expect(state.heatwaves).toBe(1);
  const active=state.active!;expect(active.start).toBe(world.tick);
  expect(active.end-active.start).toBeGreaterThanOrEqual(9000);
  expect(active.end-active.start).toBeLessThan(21000);
  expect(resolveSelectedHeatwave(world)).toBe(false);
  expect(heatwaveOffset(active.start+1200,state)).toBe(17);
  world.tick=active.end;advanceMiscIncidents(world);expect(state.active).toBeUndefined();
  expect(world.events.filter(e=>e.message.startsWith('La canicule se termine'))).toHaveLength(1);
  world.tick=active.start+MISC_HEAT_COOLDOWN-1;
  expect(eligibleMiscHeatwave(world)).toBe(false);
  world.tick++;
  warm(world);
  expect(eligibleMiscHeatwave(world)).toBe(true);
  expect(resolveSelectedHeatwave(world)).toBe(true);
  expect(state.heatwaves).toBe(2);
  expect(world.events.filter(e=>e.message.startsWith('Canicule'))).toHaveLength(2);
});

test('calendar shape rejects earlier schema, missing profile, future fields and inconsistent intervals',()=>{
  const world=cassandra(25000),state=world.miscIncidents!;
  expect(validMiscIncidents(state,169,world)).toBe(true);
  expect(validMiscIncidents(undefined,169,world)).toBe(true);
  expect(validMiscIncidents(state,168,world)).toBe(false);
  expect(validMiscIncidents({...state,future:true},169,world)).toBe(false);
  expect(validMiscIncidents({...state,profile:'camp-heat-v1'},169,world)).toBe(false);
  expect(validMiscIncidents({...state,rng:0},169,world)).toBe(false);
  expect(validMiscIncidents({...state,nextCheck:world.tick},169,world)).toBe(false);
  expect(validMiscIncidents({...state,opportunities:2},169,world)).toBe(false);
  expect(validMiscIncidents({...state,active:{start:world.tick,end:world.tick+9000}},169,world)).toBe(false);
  const noProfile={...world,gameProfile:undefined};
  expect(validMiscIncidents(state,169,noProfile)).toBe(false);
  const later=cassandra(0);later.tick=50_000;
  expect(validMiscIncidents({...later.miscIncidents!,introDone:true,nextCheck:50_100,
    checks:2,opportunities:2,heatwaves:2,lastHeatwaveStart:30_100},169,later)).toBe(false);
});

test('saved Cassandra state resumes exactly; a neutral 168 continuation gains no past incident',()=>{
  const world=createScenarioWorld(42,32,'crashlanded');
  expect(validateWorld(world)).toEqual([]);
  const restored=deserializeWorld(serializeWorld(world));
  expect(restored.miscIncidents).toEqual(world.miscIncidents);
  stepWorld(world,100);stepWorld(restored,100);expect(restored).toEqual(world);
  const legacy=withoutTelevisionRecreation(withoutMiningSkill(withoutPredatorApparelPolicies(withoutPredatorFoodPolicies(JSON.parse(serializeWorld(world))))));
  // V210 biographies did not exist in the declared schema 168 fixture.
  for(const pawn of legacy.pawns)delete pawn.background;
  if(legacy.raids)delete legacy.raids.mechanoid;
  // Schema 168 already had these recipes and Plants, but no V190 ingredient
  // permissions or V201 calendar. Construct its fixture before lowering schema.
  for(const structure of [...legacy.structures,...(legacy.packed??[]).map((p:{building:World['structures'][number]})=>p.building)])
    for(const bill of structure.bills??[])
      for(const item of V190_ITEM_IDS)delete bill.filters[item];
  delete legacy.rainElectrical;
  if(legacy.wildlife?.profile==='biome-fauna-v2'){
    legacy.wildlife.profile='biome-herbivores-v1';
    legacy.wildlife.animals=legacy.wildlife.animals.filter((a:{species:string})=>a.species!=='red-fox');
    const population=legacy.wildlife.population,biome=faunaBiome(population.biome,false);
    population.targetWeight=population.fullTargetWeight*biome.entries.reduce((sum,entry)=>sum+entry.commonality,0)/biome.totalCommonality;
  }
  delete legacy.smallIncidents;
  delete legacy.worldIncidents;
  legacy.schemaVersion=(withoutTelevisionRecreation(legacy),168);delete legacy.miscIncidents;
  const migrated=deserializeWorld(JSON.stringify(legacy));
  expect(migrated.miscIncidents).toBeUndefined();
  adoptMiscIncidents(migrated);
  expect(migrated.miscIncidents!.adoptedAt).toBe(migrated.tick);
  expect(migrated.miscIncidents!.opportunities).toBe(0);
  const future=structuredClone(legacy);future.miscIncidents=world.miscIncidents;
  expect(()=>deserializeWorld(JSON.stringify(future))).toThrow();
});

test('checkpoint and same-tick delta reject a future calendar without changing accepted snapshot',()=>{
  const world=createScenarioWorld(42,32,'crashlanded');
  const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  const checkpoint=encoder.encode(world,0,0);
  expect(checkpoint.kind).toBe('checkpoint');
  const invalidCheckpoint=structuredClone(checkpoint);
  Object.assign(invalidCheckpoint.world.miscIncidents!,{future:true});
  expect(new SnapshotDecoder().adopt(invalidCheckpoint).status).toBe('resync');
  // The worker transport clones packet metadata before the decoder owns it.
  const initial=decoder.adopt(structuredClone(checkpoint));
  expect(initial.status).toBe('applied');
  if(initial.status!=='applied')throw Error('Expected checkpoint.');
  const accepted=structuredClone(initial.world);
  world.miscIncidents!.rng=123456;
  const delta=structuredClone(encoder.encode(world,0,0));
  expect(delta.kind).toBe('delta');
  const invalidDelta=structuredClone(delta);
  invalidDelta.world.miscIncidents!.profile='invalid-profile' as never;
  expect(decoder.adopt(invalidDelta).status).toBe('resync');
  expect(initial.world).toEqual(accepted);
  const applied=decoder.adopt(delta);
  expect(applied.status).toBe('applied');
  if(applied.status==='applied')expect(applied.world.miscIncidents?.rng).toBe(123456);
});
