import { afterEach, expect, test, vi } from 'vitest';
import { AudioCueRecorder } from '../src/bridge/audio-cues.ts';
import { SnapshotEncoder } from '../src/bridge/snapshots.ts';
import { newDoorState } from '../src/sim/door-rules.ts';
import { applyDoorCommand, readyDoorEntry, updateDoors } from '../src/sim/doors.ts';
import { createWorld } from '../src/sim/index.ts';
import { advanceCorpses, animalCorpseItem } from '../src/sim/corpses.ts';
import { groundCapacity } from '../src/sim/ground-placement.ts';
import { newWeatherState } from '../src/sim/weather.ts';
import type { Job, Pawn, World } from '../src/sim/types.ts';
import type { WildAnimal } from '../src/sim/wildlife-state.ts';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

test('captures actual door motion once, but not loaded state or policy changes', () => {
  const world = createWorld(846, 32, 32), pawn = world.pawns[0]!;
  pawn.x = 1; pawn.z = 2;
  const door = { id: world.nextId++, kind: 'door' as const, x: 2, z: 2,
    orientation: 0 as const, footprint: 'standard' as const, door: newDoorState(world.tick) };
  world.structures.push(door);
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // A loaded closed door is not an action.

  expect(applyDoorCommand(world, { type: 'door-policy', structureId: door.id,
    setting: 'forbidden', value: true }).ok).toBe(true);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  expect(applyDoorCommand(world, { type: 'door-policy', structureId: door.id,
    setting: 'forbidden', value: false }).ok).toBe(true);

  expect(readyDoorEntry(world, pawn, door)).toBe(false);
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ id: `door.open:${world.tick}:${door.id}`,
    kind: 'door.open', tick: world.tick, x: door.x, z: door.z }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);

  world.tick += 30;
  updateDoors(world);
  expect(door.door.open).toBe(false);
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ id: `door.close:${world.tick}:${door.id}`,
    kind: 'door.close', tick: world.tick, x: door.x, z: door.z }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);

  readyDoorEntry(world, pawn, door);
  expect(door.door.open).toBe(true);
  recorder.reset();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // A resumed open door is not replayed.
});

test('haul sounds follow carried identity across pickup and release, without replaying loaded cargo', () => {
  const world = createWorld(848, 32, 32), pawn = world.pawns[0]!;
  const sourceId = world.nextId++, carryId = world.nextId++;
  pawn.haul = { sourcePileId: sourceId, quantity: 1, phase: 'pickup',
    destination: { type: 'stockpile', stockpileId: 1 }, carryPileId: null };
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);

  world.tick++;
  pawn.haul.phase = 'deliver'; pawn.haul.carryPileId = carryId;
  world.piles.push({ id: carryId, kind: 'wood', item: 'wood', quantity: 1,
    owner: { type: 'pawn', pawnId: pawn.id } });
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: 'haul.pickup', x: pawn.x, z: pawn.z }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);

  world.tick++;
  pawn.haul = null;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // Still owned by the pawn: no physical drop.
  recorder.reset();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // Loaded cargo is not replayed.

  pawn.haul = { sourcePileId: sourceId, quantity: 1, phase: 'deliver',
    destination: { type: 'stockpile', stockpileId: 1 }, carryPileId: carryId };
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++;
  pawn.haul = null;
  world.piles.find(pile => pile.id === carryId)!.owner = { type: 'ground', x: pawn.x, z: pawn.z };
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: 'haul.drop', x: pawn.x, z: pawn.z }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test.each([
  ['sow', 'farming.sow'], ['harvest', 'farming.harvest'], ['cut', 'farming.harvest'],
] as const)('captures active %s progress as %s, never a loaded task', (jobKind, cueKind) => {
  const world = createWorld(849, 32, 32), pawn = world.pawns[0]!;
  const job: Job = { id: world.nextId++, kind: jobKind, x: pawn.x + 1, z: pawn.z,
    orientation: 0, footprint: 'standard', status: 'active', reservedBy: pawn.id,
    progress: 0, escrow: { wood: 0, food: 0 },
    ...(jobKind === 'sow' ? { growingZoneId: 1 } : {}) };
  world.jobs.push(job);
  pawn.jobId = job.id; pawn.state = 'working';
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++; job.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: cueKind, tick: world.tick, x: job.x, z: job.z }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test('eating cue follows actual ingest progress, not travel or loaded state', () => {
  const world = createWorld(850, 32, 32), pawn = world.pawns[0]!;
  pawn.need = { kind: 'eat', phase: 'travel', sourcePileId: world.nextId++, carryPileId: world.nextId++,
    quantity: 1, progress: 0, dining: { target: { x: pawn.x, z: pawn.z }, seatId: null, tableId: null } };
  pawn.state = 'moving';
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++; pawn.need.phase = 'ingest'; pawn.state = 'eating';
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++; pawn.need.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: 'eating.work', tick: world.tick, x: pawn.x, z: pawn.z }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test('manual gates and autodoors use their own sounds on actual motion', () => {
  const world = createWorld(847, 32, 32);
  const gate = { id: world.nextId++, kind: 'fence-gate' as const, x: 2, z: 3,
    orientation: 0 as const, footprint: 'standard' as const, door: newDoorState(world.tick) };
  const auto = { id: world.nextId++, kind: 'autodoor' as const, x: 3, z: 3,
    orientation: 0 as const, footprint: 'standard' as const, door: newDoorState(world.tick) };
  world.structures.push(gate, auto);
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);

  world.tick++;
  gate.door.open = true;
  auto.door.open = true;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([
    { kind: 'fencegate.move', x: gate.x, z: gate.z }, // Core Door_FenceGateManual (audio coverage 20261122).
    { kind: 'autodoor.open', x: auto.x, z: auto.z },
  ]);

  world.tick++;
  gate.door.open = false;
  auto.door.open = false;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([
    { kind: 'fencegate.move', x: gate.x, z: gate.z },
    { kind: 'autodoor.close', x: auto.x, z: auto.z },
  ]);
});

test('thunder follows confirmed lightning, not rain or a loaded storm', () => {
  const world = createWorld(854, 32, 32);
  world.weather = newWeatherState(world.seed, world.tick);
  world.weather.current = 'rainy-thunderstorm';
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.weather.lightningCount++;
  world.weather.lastLightning = { x: 8, z: 9, coreTick: world.tick * 10 };
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: 'weather.thunder', x: 8, z: 9 }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  recorder.reset();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test('local recorder leaves raid arrivals to the global receipt and retains colonist death', () => {
  const world = createWorld(855, 32, 32), pawn = world.pawns[0]!;
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  world.raids = { profile: 'camp-raids-v1', rng: 1, nextCheck: null, serial: 1, completed: 0,
    departed: [], active: { id: 1, startedAt: world.tick, deadline: world.tick + 1000,
      lossPermille: 500, members: [], lost: [], phase: 'assault' } };
  recorder.capture(world);
  expect(recorder.drain().map(cue => cue.kind)).toEqual([]);
  pawn.state = 'dead';
  recorder.capture(world);
  expect(recorder.drain().map(cue => cue.kind)).toEqual(['ui.colonist-death']);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test('cleaning, tending and repairs sound only on physical work progress', () => {
  const world = createWorld(856, 32, 32), pawn = world.pawns[0]!;
  const recorder = new AudioCueRecorder();
  pawn.cleaning = { targets: [1], forced: true, phase: 'approach', progress: 0 };
  pawn.state = 'moving';
  recorder.capture(world);
  world.tick++; pawn.cleaning.phase = 'clean'; pawn.cleaning.progress = 1; pawn.state = 'working';
  recorder.capture(world);
  expect(recorder.drain().map(cue => cue.kind)).toEqual(['cleaning.work']);
  delete pawn.cleaning;
  pawn.tend = { patientId: 2, spot: { x: pawn.x, z: pawn.z }, phase: 'approach', progress: 0 };
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  world.tick++; pawn.tend.phase = 'tend'; pawn.tend.progress = 1;
  recorder.capture(world);
  expect(recorder.drain().map(cue => cue.kind)).toEqual(['medical.tend']);
  delete pawn.tend;
  const job: Job = { id: world.nextId++, kind: 'repair', x: pawn.x + 1, z: pawn.z,
    orientation: 0, footprint: 'standard', status: 'active', reservedBy: pawn.id,
    progress: 0, escrow: { wood: 0, food: 0 } };
  world.jobs.push(job); pawn.jobId = job.id;
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  world.tick++; job.progress++;
  recorder.capture(world);
  expect(recorder.drain().map(cue => cue.kind)).toEqual(['maintenance.work']);
});

test('animal pain and death follow new physical damage without replaying a loaded corpse', () => {
  const world = createWorld(857, 32, 32);
  const cell = world.tiles.map((_, index) => ({ x: index % world.width, z: Math.floor(index / world.width) }))
    .find(candidate => groundCapacity(world, candidate, animalCorpseItem('deer')) >= 1)!;
  expect(cell).toBeDefined();
  const animal: WildAnimal = { id: world.nextId++, x: cell.x, z: cell.z, species: 'deer', sex: 'female',
    ageTicks: 1000, food: 1, rest: 1, state: 'idle', path: [], nextDecision: 0,
    health: { body: 'deer', tick: world.tick, nextInjuryId: 1, injuries: [], missing: [], bloodLoss: 0 } };
  world.wildlife = { profile: 'biome-herbivores-v1', rng: 1, animals: [animal],
    eatenPlants: 0, eatenNutrition: 0, eatenItems: 0 };
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++;
  animal.health!.injuries.push({ id: 1, part: 'torso', kind: 'cut', severity: 1000, bornAt: world.tick });
  animal.health!.nextInjuryId++;
  recorder.capture(world);
  expect(recorder.drain().map(cue => cue.kind)).toEqual(['animal.hurt.deer']);
  world.tick++;
  animal.state = 'dead';
  animal.health!.death = { tick: world.tick, cause: 'blood-loss' };
  advanceCorpses(world);
  expect(world.wildlife!.animals).toEqual([]);
  expect(world.piles.some(pile => pile.corpse?.animalId === animal.id)).toBe(true);
  recorder.capture(world);
  expect(recorder.drain().map(cue => cue.kind)).toEqual(['animal.death.deer']);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  recorder.reset(); recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test('captures confirmed work, shot and melee once without playing loaded history', () => {
  const world = createWorld(152, 32, 32);
  const pawn = world.pawns[0]!;
  const mine = { id: world.nextId++, kind: 'mine' as const, x: pawn.x + 1, z: pawn.z,
    orientation: 0 as const, footprint: 'standard' as const, status: 'active' as const,
    reservedBy: pawn.id, progress: 0, escrow: { wood: 0, food: 0 } };
  world.jobs.push(mine);
  pawn.jobId = mine.id;
  pawn.state = 'working';
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++;
  mine.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: 'mining.hit', tick: world.tick, x: mine.x, z: mine.z }]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++;
  mine.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // bounded work cadence
  const nextHits = [];
  for (let step = 0; step < 15; step++) {
    world.tick++;
    mine.progress++;
    recorder.capture(world);
    nextHits.push(...recorder.drain());
  }
  expect(nextHits.length).toBeGreaterThan(2);
  const hitTicks = [world.tick - 16, ...nextHits.map(cue => cue.tick)];
  for (let index = 1; index < hitTicks.length; index++) {
    expect(hitTicks[index]! - hitTicks[index - 1]!).toBeGreaterThanOrEqual(2);
    expect(hitTicks[index]! - hitTicks[index - 1]!).toBeLessThanOrEqual(5);
  }

  const shot = { id: world.nextId++, flight: { origin: { x: pawn.x + .5, z: pawn.z + .5 } } } as World['projectiles'] extends (infer P)[] | undefined ? P : never;
  world.projectiles = [shot];
  pawn.melee = { order: null, strike: { targetId: 999, atCore: world.tick * 10,
    untilCore: world.tick * 10 + 80, tool: 'fist' as never, outcome: 'hit' } };
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([
    { kind: 'weapon.melee', tick: world.tick, x: pawn.x, z: pawn.z },
    { kind: 'weapon.gunshot', tick: world.tick, x: pawn.x + .5, z: pawn.z + .5 },
  ]);
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  recorder.reset();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test('delivers cues only after accepted snapshot adoption', async () => {
  class FakeWorker {
    onmessage?: (event: MessageEvent<unknown>) => void;
    onerror?: (event: ErrorEvent) => void;
    postMessage = vi.fn();
    terminate = vi.fn();
  }
  vi.stubGlobal('Worker', FakeWorker);
  const { SimulationClient } = await import('../src/bridge/SimulationClient.ts');
  const client = new SimulationClient();
  const worker = (client as unknown as { worker: FakeWorker }).worker;
  const world = createWorld(73, 32, 32);
  const encoder = new SnapshotEncoder();
  const order: string[] = [];
  client.onSnapshot = () => { order.push('snapshot'); };
  client.onAudioCues = (cues, _world, replaced) => { order.push(replaced ? 'reset' : cues[0]!.kind); };
  const packet = encoder.encode(world, 0, 1);
  packet.urgentThreats = { generation: 1, serial: 0, pauseRevision: 0, urgentHeld: false, rows: [] };
  worker.onmessage!({ data: packet } as MessageEvent<unknown>);
  worker.onmessage!({ data: packet } as MessageEvent<unknown>); // stale revision
  world.tick++;
  const next = encoder.encode(world, 0, 1);
  next.urgentThreats = { generation: 1, serial: 0, pauseRevision: 0, urgentHeld: false, rows: [] };
  next.audioCues = [{ id: 'test:1', tick: world.tick, kind: 'mining.hit', x: 1, z: 2 }];
  worker.onmessage!({ data: next } as MessageEvent<unknown>);
  expect(order).toEqual(['snapshot', 'reset', 'snapshot', 'mining.hit']);
  client.dispose();
});

test('caps crowded ticks and unpublished cues', () => {
  const world = createWorld(812, 32, 32);
  const initialTick = world.tick;
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  for (let tick = 1; tick <= 6; tick++) {
    world.tick++;
    world.projectiles = Array.from({ length: 50 }, (_, index) => ({
      id: tick * 100 + index,
      flight: { origin: { x: index, z: tick } },
    })) as World['projectiles'];
    recorder.capture(world);
  }
  const cues = recorder.drain();
  expect(cues).toHaveLength(128);
  expect(cues.filter(cue => cue.tick === initialTick + 1)).toHaveLength(32);
  expect(recorder.drain()).toEqual([]);
});

test('local contact cap cannot duplicate the global threat sound', () => {
  const world = createWorld(813, 32, 32);
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  world.tick++;
  world.projectiles = Array.from({ length: 50 }, (_, index) => ({
    id: 1000 + index,
    flight: { origin: { x: index, z: 1 } },
  })) as World['projectiles'];
  world.raids = { profile: 'camp-raids-v1', rng: 1, nextCheck: null, serial: 1, completed: 0,
    departed: [], active: { id: 1, startedAt: world.tick, deadline: world.tick + 1000,
      lossPermille: 500, members: [], lost: [], phase: 'assault' } };
  recorder.capture(world);
  const cues = recorder.drain();
  expect(cues).toHaveLength(32);
  expect(cues.filter(cue => cue.kind === 'ui.threat')).toHaveLength(0);
});

test('uses confirmed shooting cooldown when a short projectile is already gone', () => {
  const world = createWorld(827, 32, 32), pawn = world.pawns[0]!;
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  world.tick++;
  const emittedAtCore = world.tick * 10;
  pawn.shooting = { order: null, stance: { phase: 'cooldown', startedAtCore: emittedAtCore,
    endsAtCore: emittedAtCore + 96 } };
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ id: `shot:${pawn.id}:${emittedAtCore}`,
    kind: 'weapon.gunshot', tick: world.tick, x: pawn.x + .5, z: pawn.z + .5 }]);
  type Projectile = NonNullable<World['projectiles']>[number];
  const projectile = { id: world.nextId++, emittedAtCore,
    flight: { launcherKey: `pawn:${pawn.id}`, origin: { x: pawn.x + .5, z: pawn.z + .5 } } } as Projectile;
  world.projectiles = [projectile];
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // same emission cannot sound twice
  world.tick++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test.each([
  ['simple-meal', 'campfire', 'cooking.work'],
  ['carnivore-fine-meal', 'fueled-stove', 'cooking.work'],
  ['cook-carnivore-fine-meal-bulk', 'fueled-stove', 'cooking.work'],
  ['cook-lavish-meal-bulk', 'fueled-stove', 'cooking.work'],
  ['cook-vegetarian-lavish-meal-bulk', 'fueled-stove', 'cooking.work'],
  ['cook-carnivore-lavish-meal-bulk', 'fueled-stove', 'cooking.work'],
  ['vegetarian-lavish-meal', 'fueled-stove', 'cooking.work'],
  ['butcher-creature', 'butcher-table', 'butchering.work'],
  ['stone-blocks', 'stonecutter', 'crafting.work'],
  ['make-revolver', 'machining-table', 'crafting.work'],
  ['make-component', 'fabrication-bench', 'crafting.work'],
  ['small-sculpture', 'art-bench', 'crafting.work'],
  ['shirt', 'tailor-bench', 'tailoring.work'],
  ['tribalwear', 'crafting-spot', 'tailoring.work'],
] as const)('captures %s production progress at %s as %s', (recipe, stationKind, kind) => {
  const world = createWorld(296, 32, 32), pawn = world.pawns[0]!;
  const station = { id: world.nextId++, kind: stationKind, x: pawn.x + 1, z: pawn.z,
    orientation: 0 as const, footprint: 'standard' as const };
  world.structures.push(station);
  const task: NonNullable<Pawn['cooking']> = {
    ...(recipe === 'simple-meal' ? {} : { recipe }), stationId: station.id, billId: world.nextId++, spot: { x: pawn.x, z: pawn.z },
    actionCell: { x: station.x, z: station.z }, phase: 'gather', ingredients: [],
    progress: 0, productId: null, storageId: null,
  };
  pawn.cooking = task;
  pawn.state = 'moving';
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  pawn.state = 'working'; task.phase = 'work'; task.progress = 10000;
  world.tick++;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind, x: station.x, z: station.z, tick: world.tick }]);
  task.progress += 10000;
  world.tick++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // workshop cadence
  pawn.state = 'moving'; task.progress += 10000;
  world.tick += 8;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]); // no travel sound even if progress is malformed
});

test('construction and research require persisted progress and an active worker', () => {
  const world = createWorld(297, 32, 32), pawn = world.pawns[0]!;
  const job: Job = { id: world.nextId++, kind: 'wall', x: pawn.x + 1, z: pawn.z,
    orientation: 0 as const, footprint: 'standard' as const, status: 'active' as const,
    reservedBy: pawn.id, progress: 0, escrow: { wood: 0, food: 0 } };
  world.jobs.push(job);
  pawn.jobId = job.id;
  pawn.state = 'moving';
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  world.tick++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  pawn.state = 'working'; job.workRemainder = 5000;
  world.tick++;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: 'construction.hit', x: job.x, z: job.z }]);

  pawn.jobId = null;
  const station = { id: world.nextId++, kind: 'research-bench' as const, x: pawn.x + 1, z: pawn.z,
    orientation: 0 as const, footprint: 'standard' as const };
  world.structures.push(station);
  pawn.research = { stationId: station.id, spot: { x: pawn.x, z: pawn.z }, worked: 0 };
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  world.tick++;
  pawn.research.worked++;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ kind: 'research.work', x: station.x, z: station.z }]);
  world.tick += 8;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});

test.each([
  ['mine', 'mining.hit', 2, 5],
  ['chop', 'woodcutting.hit', 2, 5],
  ['wall', 'construction.hit', 2, 5],
  ['simple-meal', 'cooking.work', 5, 11],
  ['stone-blocks', 'crafting.work', 5, 11],
  ['shirt', 'tailoring.work', 5, 11],
  ['butcher-creature', 'butchering.work', 5, 11],
  ['research', 'research.work', 5, 11],
] as const)('%s has varied, bounded, reproducible contact gaps', (action, expectedKind, minimum, maximum) => {
  // Prepared active task; only the increments below are observed contacts.
  const run = () => {
    const world = createWorld(509, 32, 32), pawn = world.pawns[0]!;
    pawn.state = 'working';
    let advance: () => void;
    if (action === 'mine' || action === 'chop' || action === 'wall') {
      const job: Job = { id: world.nextId++, kind: action, x: pawn.x + 1, z: pawn.z,
        orientation: 0, footprint: 'standard', status: 'active', reservedBy: pawn.id,
        progress: 0, escrow: { wood: 0, food: 0 } };
      world.jobs.push(job);
      pawn.jobId = job.id;
      advance = () => { job.progress++; };
    } else if (action === 'research') {
      const station = { id: world.nextId++, kind: 'research-bench' as const, x: pawn.x + 1, z: pawn.z,
        orientation: 0 as const, footprint: 'standard' as const };
      world.structures.push(station);
      pawn.research = { stationId: station.id, spot: { x: pawn.x, z: pawn.z }, worked: 0 };
      advance = () => { pawn.research!.worked++; };
    } else {
      const stationKind: 'campfire' | 'stonecutter' | 'tailor-bench' | 'butcher-table' = action === 'simple-meal' ? 'campfire'
        : action === 'stone-blocks' ? 'stonecutter'
          : action === 'shirt' ? 'tailor-bench' : 'butcher-table';
      const station = { id: world.nextId++, kind: stationKind, x: pawn.x + 1, z: pawn.z,
        orientation: 0 as const, footprint: 'standard' as const };
      world.structures.push(station);
      pawn.cooking = { ...(action === 'simple-meal' ? {} : { recipe: action }),
        stationId: station.id, billId: world.nextId++,
        spot: { x: pawn.x, z: pawn.z }, actionCell: { x: station.x, z: station.z },
        phase: 'work', ingredients: [], progress: 0, productId: null, storageId: null };
      advance = () => { pawn.cooking!.progress++; };
    }
    const recorder = new AudioCueRecorder(), ticks: number[] = [];
    recorder.capture(world);
    for (let step = 0; step < 100; step++) {
      world.tick++;
      advance();
      recorder.capture(world);
      for (const cue of recorder.drain()) {
        expect(cue.kind).toBe(expectedKind);
        ticks.push(cue.tick);
      }
    }
    return ticks;
  };
  const ticks = run();
  expect(ticks).toEqual(run());
  expect(ticks[0]).toBe(1);
  const gaps = ticks.slice(1).map((tick, index) => tick - ticks[index]!);
  expect(gaps.length).toBeGreaterThan(5);
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(minimum);
  expect(Math.max(...gaps)).toBeLessThanOrEqual(maximum);
  expect(new Set(gaps).size).toBeGreaterThan(1);
});

test('skipped observations yield one current work cue, then a fresh gap; inactive progress stays silent', () => {
  const world = createWorld(510, 32, 32), pawn = world.pawns[0]!;
  const job: Job = { id: world.nextId++, kind: 'mine', x: pawn.x + 1, z: pawn.z,
    orientation: 0, footprint: 'standard', status: 'active', reservedBy: pawn.id,
    progress: 0, escrow: { wood: 0, food: 0 } };
  world.jobs.push(job);
  pawn.jobId = job.id;
  pawn.state = 'working';
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  world.tick++;
  job.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toHaveLength(1);
  world.tick += 100;
  job.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toMatchObject([{ tick: world.tick, kind: 'mining.hit' }]);
  world.tick++;
  job.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  pawn.state = 'moving';
  world.tick += 20;
  job.progress++;
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
  pawn.state = 'working';
  recorder.capture(world);
  expect(recorder.drain()).toEqual([]);
});
