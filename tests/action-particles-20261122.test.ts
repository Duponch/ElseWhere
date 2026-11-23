import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { createWorld } from '../src/sim/engine';
import { footprintCells } from '../src/sim/definitions';
import type { Job, Pawn, Structure, StructureKind, World } from '../src/sim/types';
import type { CookingTask } from '../src/sim/cooking-types';
import {
  ACTION_PARTICLES, ACTIONS_WITHOUT_PARTICLES, ONCE, PARTICLE_FAMILIES, PARTICLE_SLOTS, PLACEMENT_RULES, TIME_WRAP,
  actionParticleEvents, actionParticleForAnimal, actionParticleForPawn, actorParticleSeed, particleClock, placeActionParticles, sampleActionParticle,
  type ActionParticleLookup, type ActionParticleEvent, type ParticleAnchor,
} from '../src/render/action-particle-catalogue';
import { ATLAS_CELL, ATLAS_COLUMNS, ATLAS_HEIGHT, ATLAS_WIDTH, paintActionParticleAtlas } from '../src/render/action-particle-atlas';
import { ActionParticleLayer, MAX_PARTICLE_EMITTERS, actionParticleTable } from '../src/render/ActionParticleLayer';
import { FAMILY_FIRST_CELL, PARTICLE_CELL_COUNT } from '../src/render/action-particle-catalogue';

/** Presentation-only contracts of the action particles (22 November 2026).
 * Worlds below are prepared renderer inputs, never saved or simulated. */
function lookup(world: World): ActionParticleLookup {
  return {
    job: id => world.jobs.find(j => j.id === id), structure: id => world.structures.find(s => s.id === id),
    fire: id => world.fires?.items.find(f => f.id === id), pawn: id => world.pawns.find(p => p.id === id),
    animal: id => world.wildlife?.animals.find(a => a.id === id), pile: id => world.piles.find(p => p.id === id),
    tile: (x, z) => world.tiles[z * world.width + x],
  };
}
const anchor: ParticleAnchor = { x: 10, y: .8, z: 10, dirX: 0, dirZ: 1, ground: 0 };

test('every inventoried action has drawn particles, a placement rule and a pool that fits 16 quads', () => {
  const ids = new Set<string>();
  const families = new Set(PARTICLE_FAMILIES.map(f => f.id));
  expect(ACTION_PARTICLES.length).toBeGreaterThanOrEqual(60);
  for (const action of ACTION_PARTICLES) {
    expect(ids.has(action.id), action.id).toBe(false); ids.add(action.id);
    expect(action.label.length).toBeGreaterThan(3);
    expect(Object.keys(PLACEMENT_RULES)).toContain(action.placement);
    expect(action.channels.length, action.id).toBeGreaterThan(0);
    expect(action.channels.reduce((sum, c) => sum + c.slots, 0), action.id).toBeLessThanOrEqual(PARTICLE_SLOTS);
    for (const c of action.channels) {
      expect(families.has(c.family)).toBe(true);
      expect(c.slots % c.burst, `${action.id} ${c.family}`).toBe(0);
      expect(c.life).toBeGreaterThan(0);
      if (action.once) { expect(c.rhythm).toBe(ONCE); expect(c.burst).toBe(c.slots); continue; }
      // Integer omega: the burst schedule wraps with the 2π-second clock.
      expect(Number.isInteger(c.rhythm.omega) && c.rhythm.omega > 0, `${action.id} omega`).toBe(true);
      // Overlapping groups cover the whole life: no particle is cut short.
      expect(c.slots / c.burst * TIME_WRAP / c.rhythm.omega + 1e-9, `${action.id} ${c.family} life`).toBeGreaterThanOrEqual(c.life);
    }
    // The placement function answers for this rule with a finite anchor.
    const a = placeActionParticles(action.placement, { x: 5, y: 0, z: 5, yaw: .3 }, { tx: 6, tz: 5, ty: .85 });
    for (const v of [a.x, a.y, a.z, a.dirX, a.dirZ, a.ground]) expect(Number.isFinite(v)).toBe(true);
  }
  expect(ACTIONS_WITHOUT_PARTICLES.length).toBeGreaterThan(0);
  // The shader table has one row per action plus the empty row 0.
  expect(actionParticleTable().length).toBe(PARTICLE_SLOTS * 7 * (ACTION_PARTICLES.length + 1) * 4);
});

test('confirmed work phases select their action, target and tint', () => {
  const world = createWorld(1122, 32, 32), pawn = world.pawns[0]!, look = lookup(world);
  const reset = () => { pawn.state = 'working'; pawn.jobId = null; pawn.cooking = null; delete pawn.research; delete pawn.tend; pawn.stun = undefined; };
  reset();
  const job = (kind: Job['kind'], extra: Partial<Job> = {}): Job => {
    const j = { id: world.nextId++, kind, x: pawn.x + 1, z: pawn.z, orientation: 0, footprint: 'standard', status: 'active', reservedBy: pawn.id, progress: 0, escrow: {}, ...extra } as Job;
    world.jobs = [j]; pawn.jobId = j.id; return j;
  };
  const expectAction = (id: string) => expect(actionParticleForPawn(pawn, look)?.action).toBe(id);
  job('chop'); expectAction('chop-tree');
  job('cut'); expectAction('cut-plant');
  job('harvest'); expectAction('harvest');
  job('sow'); expectAction('sow');
  job('mine'); expectAction('mine');
  const tile = world.tiles[pawn.z * world.width + pawn.x + 1]!; tile.ore = 'gold';
  expect(actionParticleForPawn(pawn, look)?.tint).toBe(0xe2c25a); delete tile.ore;
  job('smooth-wall'); expectAction('smooth-wall');
  job('build-roof'); expectAction('roof');
  job('lay-floor'); expectAction('floor-work');
  job('deconstruct'); expectAction('deconstruct');
  job('repair'); expectAction('repair');
  job('wall', { material: 'wood' }); expectAction('build-wood');
  job('wall', { material: 'steel' }); expectAction('build-metal');
  job('wall', { material: 'granite-blocks' as Job['material'] }); expectAction('build-stone');
  // A job reserved by somebody else draws nothing.
  job('chop', { reservedBy: pawn.id + 999 }); expect(actionParticleForPawn(pawn, look)).toBeUndefined();
  pawn.jobId = null; world.jobs = [];
  const station = { id: world.nextId++, kind: 'electric-stove' as StructureKind, x: pawn.x + 1, z: pawn.z, orientation: 0, footprint: 'standard' } as Structure;
  world.structures.push(station);
  pawn.cooking = { stationId: station.id, billId: 1, spot: pawn, actionCell: pawn, phase: 'work', ingredients: [], progress: 0, productId: null, storageId: null } as CookingTask;
  for (const [kind, action] of [['electric-stove', 'cook'], ['butcher-table', 'butcher'], ['fueled-smithy', 'smith'], ['machining-table', 'smith'],
    ['fabrication-bench', 'machine'], ['tailor-bench', 'tailor'], ['crafting-spot', 'craft-wood'], ['stonecutter', 'stonecut'], ['art-bench', 'sculpt'],
    ['electric-smelter', 'smelt'], ['electric-crematorium', 'cremate'], ['drug-lab', 'drugs'], ['brewery', 'brew'], ['biofuel-refinery', 'refine']] as const) {
    station.kind = kind; expectAction(action);
  }
  station.kind = 'crafting-spot'; pawn.cooking.recipe = 'tribalwear'; expectAction('tailor');
  station.kind = 'machining-table'; pawn.cooking.recipe = 'shred-mechanoid'; expectAction('butcher-mech');
  // Bench work is drawn at the bench edge, at its top, towards the worker.
  const choice = actionParticleForPawn(pawn, look)!;
  expect(choice.ty).toBeCloseTo(.88);
  const nearest = footprintCells(station).sort((a, b) => Math.hypot(a.x - pawn.x, a.z - pawn.z) - Math.hypot(b.x - pawn.x, b.z - pawn.z))[0]!;
  expect(Math.hypot(choice.tx! - nearest.x, choice.tz! - nearest.z)).toBeCloseTo(nearest.x === pawn.x && nearest.z === pawn.z ? 0 : .48);
  pawn.cooking = null;
  pawn.research = { stationId: station.id, spot: pawn, worked: 0 }; expectAction('research'); delete pawn.research;
  const patient = world.pawns[1]!;
  pawn.tend = { patientId: patient.id, spot: pawn, phase: 'tend', progress: 0 }; expectAction('tend');
  expect(actionParticleForPawn(pawn, look)?.tx).toBe(patient.x); delete pawn.tend;
  pawn.state = 'sleeping'; expectAction('sleep');
  pawn.state = 'dead'; expect(actionParticleForPawn(pawn, look)).toBeUndefined();
  pawn.state = 'idle'; expect(actionParticleForPawn(pawn, look)).toBeUndefined();
  expect(actionParticleForAnimal({ state: 'eating', meal: { kind: 'plant', id: 1, quantity: 1, progress: 0 } } as never)?.action).toBe('graze');
  expect(actionParticleForAnimal({ state: 'sleeping' } as never)?.action).toBe('animal-sleep');
  expect(actionParticleForAnimal({ state: 'idle' } as never)).toBeUndefined();
});

test('pick-up, drop and confirmed hits are events, never invented for the first snapshot', () => {
  const world = createWorld(1123, 32, 32), [a, b] = world.pawns, look = lookup(world), out: ActionParticleEvent[] = [];
  a!.haul = { sourcePileId: 1, quantity: 1, phase: 'pickup', destination: { type: 'aside', x: 1, z: 1 }, carryPileId: null };
  let memory = actionParticleEvents(undefined, a!, 10, look, out);
  expect(out).toEqual([]);
  a!.haul = { ...a!.haul, phase: 'deliver', carryPileId: 7 };
  memory = actionParticleEvents(memory, a!, 11, look, out);
  expect(out.map(e => e.action)).toEqual(['haul-pickup']); out.length = 0;
  a!.haul = null;
  memory = actionParticleEvents(memory, a!, 14, look, out);
  expect(out.map(e => e.action)).toEqual(['haul-drop']); out.length = 0;
  a!.melee = { order: null, strike: { targetId: b!.id, atCore: 150, untilCore: 190, tool: 'fist' as never, outcome: 'hit' } };
  memory = actionParticleEvents(memory, a!, 15, look, out);
  expect(out.map(e => e.action)).toEqual(['melee-hit']);
  expect(out[0]!.tx).toBe(b!.x); out.length = 0;
  // The same strike is not repeated; a miss shows nothing.
  actionParticleEvents(memory, a!, 16, look, out); expect(out).toEqual([]);
  a!.melee.strike = { ...a!.melee.strike!, atCore: 200, outcome: 'miss' };
  actionParticleEvents(memory, a!, 20, look, out); expect(out).toEqual([]);
});

test('visuals are a pure function of seed and clock, continuous across the clock wrap', () => {
  const chop = ACTION_PARTICLES.find(a => a.id === 'chop-tree')!;
  const sample = (seed: number, time: number) => Array.from({ length: PARTICLE_SLOTS }, (_, slot) => sampleActionParticle(chop, slot, anchor, seed, 1.3, time));
  expect(sample(5, 2.2)).toEqual(sample(5, 2.2));
  const differs = sample(5, 2.2).some((p, i) => JSON.stringify(p) !== JSON.stringify(sample(6, 2.2)[i]));
  expect(differs).toBe(true);
  // Just before and after the 2π wrap the same particles are drawn (slots may swap).
  const key = (time: number) => sample(9, time).filter(p => p).map(p => `${p!.x.toFixed(4)},${p!.y.toFixed(4)},${p!.z.toFixed(4)},${p!.cell}`).sort();
  expect(key(TIME_WRAP - 1e-4)).toEqual(key(-1e-4 + TIME_WRAP * 2 - TIME_WRAP));
  expect(key(TIME_WRAP + .05 - TIME_WRAP)).toEqual(key(.05));
  // Particles do move between frames, fall back to the ground and stay above it.
  const states = [0, .1, .2, .3, .4].map(t => sample(9, 3 + t));
  expect(states.some((s, i) => i > 0 && JSON.stringify(s) !== JSON.stringify(states[0]))).toBe(true);
  for (const s of states) for (const p of s) if (p) { expect(p.y).toBeGreaterThanOrEqual(anchor.ground); expect(p.alpha).toBeLessThanOrEqual(1); }
  // The presentation clock follows the confirmed tick (6 ticks per second at ×1).
  expect(particleClock(6)).toBeCloseTo(1);
  expect(particleClock(6 * TIME_WRAP + 3)).toBeCloseTo(.5);
  expect(actorParticleSeed(42)).toBe(actorParticleSeed(42));
});

test('the atlas is painted identically on every load, one non-empty sprite per cell and two styles', () => {
  const first = paintActionParticleAtlas(), second = paintActionParticleAtlas();
  expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  expect(first.length).toBe(ATLAS_WIDTH * ATLAS_HEIGHT * 4 * 2);
  const layer = ATLAS_WIDTH * ATLAS_HEIGHT * 4;
  for (let l = 0; l < 2; l++) for (let cell = 0; cell < PARTICLE_CELL_COUNT; cell++) {
    const cx = (cell % ATLAS_COLUMNS) * ATLAS_CELL, cy = Math.floor(cell / ATLAS_COLUMNS) * ATLAS_CELL;
    let covered = 0, border = 0;
    for (let y = 0; y < ATLAS_CELL; y++) for (let x = 0; x < ATLAS_CELL; x++) {
      const alpha = first[l * layer + ((cy + y) * ATLAS_WIDTH + cx + x) * 4 + 3]!;
      if (alpha > 128) covered++;
      if ((x === 0 || y === 0 || x === ATLAS_CELL - 1 || y === ATLAS_CELL - 1) && alpha > 0) border++;
    }
    expect(covered, `layer ${l} cell ${cell}`).toBeGreaterThan(8);
    expect(border, `layer ${l} cell ${cell} bleeds`).toBe(0);
  }
  for (const family of PARTICLE_FAMILIES) expect(FAMILY_FIRST_CELL[family.id] + family.variants).toBeLessThanOrEqual(PARTICLE_CELL_COUNT);
});

function poseSource(world: World): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  for (const name of ['aFrom', 'aTo', 'aTravel']) geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(world.pawns.length * 4), 4));
  const to = geometry.getAttribute('aTo') as THREE.InstancedBufferAttribute;
  world.pawns.forEach((p, i) => to.setXYZW(i, p.x, 0, p.z, 0));
  return geometry;
}
const many = (count: number, state: Pawn['state']): World => {
  const world = createWorld(1124, 64, 64), base = world.pawns[0]!;
  world.pawns = Array.from({ length: count }, (_, i) => ({ ...structuredClone(base), id: 1000 + i, x: i % 64, z: Math.floor(i / 64) % 64, state, jobId: null, haul: null, cooking: null }));
  return world;
};

test('one resident draw with a fixed pool: never grows, never uploads while nothing changes', () => {
  const layer = new ActionParticleLayer({ travelTime: uniform(0) });
  try {
    const geometry = layer.mesh.geometry, records = (geometry.getAttribute('eA') as THREE.InterleavedBufferAttribute).data, array = records.array;
    const sleeping = many(40, 'sleeping'), source = poseSource(sleeping);
    layer.setPresentation(false, 1, 30);
    layer.update(sleeping, source); layer.present(100);
    expect(geometry.instanceCount).toBe(40); expect(layer.mesh.visible).toBe(true);
    const version = records.version;
    for (let tick = 101; tick < 110; tick++) layer.present(tick);
    expect(records.version).toBe(version);
    layer.update(sleeping, source); layer.present(110);
    expect(records.version).toBe(version);
    // Far beyond the pool: still one geometry, the same buffer, a bounded count.
    const crowd = many(MAX_PARTICLE_EMITTERS + 300, 'sleeping'), crowdSource = poseSource(crowd);
    layer.update(crowd, crowdSource); layer.present(120);
    expect(geometry.instanceCount).toBe(MAX_PARTICLE_EMITTERS);
    expect(layer.mesh.geometry).toBe(geometry);
    expect((geometry.getAttribute('eA') as THREE.InterleavedBufferAttribute).data.array).toBe(array);
    expect(array.length).toBe(MAX_PARTICLE_EMITTERS * 16);
    // Nobody acts: nothing is drawn; far zoom hides the layer.
    const idle = many(10, 'idle');layer.update(idle, poseSource(idle)); layer.present(130);
    expect(geometry.instanceCount).toBe(0); expect(layer.mesh.visible).toBe(false);
    layer.update(sleeping, source); layer.present(131); layer.setPresentation(true, .2, 5);
    expect(layer.mesh.visible).toBe(false);
    layer.setPresentation(true, .2, 40); expect(layer.mesh.visible).toBe(true);
  } finally { layer.dispose(); }
});

test('the former comic action sprites are gone from the renderer', () => {
  expect(existsSync('src/render/ActionVfxLayer.ts')).toBe(false);
  const core = readFileSync('src/render/SceneRenderCore.ts', 'utf8');
  expect(core).not.toMatch(/ActionVfx/);
  expect(core).toMatch(/new ActionParticleLayer\(/);
});
