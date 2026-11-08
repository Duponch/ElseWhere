import { expect, test } from 'vitest';
import { createScenarioWorld } from '../src/sim/new-game';
import { updatePlantTemperatures } from '../src/sim/thermal-plants';
import { isPlant, plantGrowth, plantTemperatureFactorFor } from '../src/sim/plants';
import type { Resource, World } from '../src/sim/types';

// RimWorld 1.6 Plant.TickLong: every 2000 Core ticks, on the Core tick where
// TicksGame % 2000 == id % 2000, the plant reads its cell temperature.
// One local tick is 10 Core ticks, so a plant samples once every 200 local ticks.
const slot = (plant: Resource) => Math.floor(plant.id % 2000 / 10);

/** Every cell in one thermal region whose temperature the test sets. */
function regionWorld(schemaVersion?: number) {
  const world = createScenarioWorld(42, 32, 'crashlanded', { hilliness: 'small-hills', biome: 'temperate-forest' });
  if (schemaVersion !== undefined) world.schemaVersion = schemaVersion as World['schemaVersion'];
  const region = { temperature: 20 };
  (world as { thermal?: unknown }).thermal = { regions: [region] };
  const layout = { rooms: [], doors: [], indices: new Int32Array(world.width * world.height).fill(0) };
  const plants = world.resources.filter(isPlant);
  return { world, layout, region, plants };
}
const state = (plants: Resource[]) => plants.map(p => [p.id, p.growth, p.growthTick, p.growthThermalFactor]);

test('a plant samples its cell temperature only at its own TickLong slot', () => {
  const { world, layout, region, plants } = regionWorld();
  expect(plants.length).toBeGreaterThan(50);
  updatePlantTemperatures(world, layout);
  region.temperature = 3;
  const before = new Map(plants.map(p => [p.id, { tick: p.growthTick, factor: p.growthThermalFactor }]));
  world.tick += 1; updatePlantTemperatures(world, layout);
  for (const p of plants) {
    const old = before.get(p.id)!, now = slot(p) === world.tick % 200;
    if (!now) expect([p.growthTick, p.growthThermalFactor]).toEqual([old.tick, old.factor]);
    else expect(p.growthThermalFactor ?? 1).toBe(plantTemperatureFactorFor(p, 3));
  }
  // A repeated call in the same tick samples nothing more, even after a change.
  region.temperature = -5;
  const same = state(plants); updatePlantTemperatures(world, layout);
  expect(state(plants)).toEqual(same);
});

test('a full TickLong period samples every plant once, settling growth at the previous factor', () => {
  const { world, layout, region, plants } = regionWorld();
  updatePlantTemperatures(world, layout);
  region.temperature = 3;
  // Growth read just before each plant's sample equals its settled anchor.
  const expected = new Map<number, number>();
  for (let step = 1; step <= 200; step++) {
    world.tick += 1;
    for (const p of plants) if (slot(p) === world.tick % 200 && plantTemperatureFactorFor(p, 3) !== (p.growthThermalFactor ?? 1)) expected.set(p.id, plantGrowth(world, p));
    updatePlantTemperatures(world, layout);
  }
  for (const p of plants) {
    expect(p.growthThermalFactor ?? 1).toBe(plantTemperatureFactorFor(p, 3));
    if (expected.has(p.id)) { expect(p.growth).toBe(expected.get(p.id)); expect(p.growthTick).toBe(world.tick - ((world.tick - slot(p)) % 200 + 200) % 200); }
  }
});

test('elapsed local ticks are all sampled by the next call, and only those', () => {
  const { world, layout, region, plants } = regionWorld();
  updatePlantTemperatures(world, layout);
  region.temperature = 3;
  const from = world.tick, before = new Map(plants.map(p => [p.id, p.growthThermalFactor]));
  world.tick += 100; updatePlantTemperatures(world, layout);
  for (const p of plants) {
    const elapsed = ((slot(p) - from) % 200 + 200) % 200;
    if (elapsed >= 1 && elapsed <= 100) expect(p.growthThermalFactor ?? 1).toBe(plantTemperatureFactorFor(p, 3));
    else expect(p.growthThermalFactor).toBe(before.get(p.id));
  }
});

test('historical schemas keep the immediate regional update', () => {
  const { world, layout, region, plants } = regionWorld(300);
  updatePlantTemperatures(world, layout);
  region.temperature = 3; world.tick += 1; updatePlantTemperatures(world, layout);
  for (const p of plants) expect(p.growthThermalFactor ?? 1).toBe(plantTemperatureFactorFor(p, 3));
});
