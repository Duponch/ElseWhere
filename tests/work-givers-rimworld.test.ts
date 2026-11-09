import { describe, expect, test } from 'vitest';
import { createWorld, addGroundMaterial, stepWorld, validateWorld } from '../src/sim/index';
import { compareRimWorkGivers, RIM_WORK_GIVER_SEARCH, RIM_WORK_GIVER_TABLE, rimWorkGiver } from '../src/sim/work-givers-rimworld';
import { newDoorState } from '../src/sim/door-rules';
import type { Structure, World } from '../src/sim/types';

const order = (a: Parameters<typeof rimWorkGiver>[0], pa: number, b: Parameters<typeof rimWorkGiver>[0], pb: number) => Math.sign(compareRimWorkGivers(rimWorkGiver(a), pa, rimWorkGiver(b), pb));

describe('RimWorld work giver order (Pawn_WorkSettings.CacheWorkGiversInOrder)', () => {
  test('the pawn priority comes first, then the natural priority of the work type, then priorityInType, then definition order', () => {
    // Priority 1 hauling before priority 2 firefighting.
    expect(order('HaulGeneral', 1, 'FightFires', 2)).toBe(-1);
    // Same priority: Firefighter (1400) before Doctor (1300) before Construction (900) before Hauling (300) before Cleaning (200).
    expect(order('FightFires', 3, 'DoctorTendToHumanlikes', 3)).toBe(-1);
    expect(order('DoctorRescue', 3, 'ConstructFinishFrames', 3)).toBe(-1);
    expect(order('ConstructFinishFrames', 3, 'HaulGeneral', 3)).toBe(-1);
    expect(order('HaulGeneral', 3, 'CleanFilth', 3)).toBe(-1);
    // Inside Doctor: emergency tending (110) before tending humans (100) before self (90).
    expect(order('DoctorTendEmergency', 3, 'DoctorTendToHumanlikes', 3)).toBe(-1);
    expect(order('DoctorTendToHumanlikes', 3, 'DoctorTendToSelf', 3)).toBe(-1);
    // Inside Hauling: rearm (150) and refuel (140) before general hauling (15).
    expect(order('RearmTurrets', 3, 'Refuel', 3)).toBe(-1);
    expect(order('Refuel', 3, 'HaulGeneral', 3)).toBe(-1);
    expect(order('HaulGeneral', 3, 'HaulGeneral', 3)).toBe(0);
  });
  test('the registry has the 105 Core givers once each, with how each one searches its target', () => {
    const ids = RIM_WORK_GIVER_TABLE.map(([id]) => id);
    expect(ids.length).toBe(105); expect(new Set(ids).size).toBe(105);
    expect(Object.keys(RIM_WORK_GIVER_SEARCH).sort()).toEqual([...ids].sort());
    // Region search (ThingRequest stored in regions): frames, blueprints, refuelables, bills, filth (4 regions), pawns.
    expect(RIM_WORK_GIVER_SEARCH.ConstructFinishFrames).toMatchObject({ scan: 'things', regionwise: true, maxRegions: 30, pathEnd: 'touch' });
    expect(RIM_WORK_GIVER_SEARCH.Refuel.regionwise).toBe(true);
    expect(RIM_WORK_GIVER_SEARCH.DoBillsCook).toMatchObject({ regionwise: true, pathEnd: 'interaction' });
    expect(RIM_WORK_GIVER_SEARCH.CleanFilth).toMatchObject({ regionwise: true, maxRegions: 4 });
    expect(RIM_WORK_GIVER_SEARCH.DoctorTendToHumanlikes.regionwise).toBe(true);
    // Global closest (own target list): general hauling, mining, plant cutting.
    for (const id of ['HaulGeneral', 'Mine', 'PlantsCut'] as const) expect(RIM_WORK_GIVER_SEARCH[id]).toMatchObject({ scan: 'things', regionwise: false });
    // Cell scanners and prioritized givers.
    expect(RIM_WORK_GIVER_SEARCH.GrowerSow.scan).toBe('cells');
    expect(RIM_WORK_GIVER_SEARCH.Research.prioritized).toBe(true);
    expect(RIM_WORK_GIVER_SEARCH.PatientGoToBedTreatment.scan).toBe('none');
  });
});

function camp(): World {
  const w = createWorld(42, 40, 40);
  w.tiles = w.tiles.map(() => ({ terrain: 'grass' })); w.resources = []; w.jobs = []; w.structures = []; w.piles = []; w.stockpiles = []; w.pawns = w.pawns.slice(0, 1);
  const p = w.pawns[0]!; Object.assign(p, { x: 6, z: 6, hunger: 100, rest: 100 }); p.schedule.fill('anything');
  for (const key of Object.keys(p.priorities) as (keyof typeof p.priorities)[]) p.priorities[key] = 0;
  return w;
}
function until(w: World, done: () => boolean, max = 400): void {
  for (let i = 0; i < max && !done(); i++) stepWorld(w);
  expect(done(), `tick ${w.tick}`).toBe(true);
  expect(validateWorld(w)).toEqual([]);
}

describe('general hauling (WorkGiver_HaulGeneral, StoreUtility.TryFindBestBetterStoreCellFor)', () => {
  test('the closest haulable thing goes to its best storage: the highest priority, then the closest cell', () => {
    const w = camp(), p = w.pawns[0]!; p.priorities.haul = 3;
    addGroundMaterial(w, 'wood', 10, { x: 9, z: 6 }, 'wood');
    addGroundMaterial(w, 'wood', 10, { x: 30, z: 30 }, 'wood');
    const low = { id: w.nextId++, x: 10, z: 6, priority: 1, capacity: 75, filters: { wood: true, food: false } };
    const farHigh = { id: w.nextId++, x: 30, z: 6, priority: 4, capacity: 75, filters: { wood: true, food: false } };
    const nearHigh = { id: w.nextId++, x: 20, z: 6, priority: 4, capacity: 75, filters: { wood: true, food: false } };
    w.stockpiles = [low, farHigh, nearHigh];
    const near = w.piles.find(pile => pile.owner.type === 'ground' && pile.owner.x === 9)!;
    until(w, () => !!p.haul);
    expect(p.haul!.sourcePileId).toBe(near.id);
    expect(p.haul!.destination).toEqual({ type: 'stockpile', stockpileId: nearHigh.id });
  });

  test('the thing closest to the pawn is hauled first, even when another trip would be shorter in total', () => {
    const w = camp(), p = w.pawns[0]!; p.priorities.haul = 3;
    // Behind the pawn: 4 cells away, 28 more to the storage.
    addGroundMaterial(w, 'wood', 10, { x: 2, z: 6 }, 'wood');
    // Ahead: 14 cells away, 10 more to the storage.
    addGroundMaterial(w, 'wood', 10, { x: 20, z: 6 }, 'wood');
    const storage = { id: w.nextId++, x: 30, z: 6, priority: 3, capacity: 75, filters: { wood: true, food: false } };
    w.stockpiles = [storage];
    const behind = w.piles.find(pile => pile.owner.type === 'ground' && pile.owner.x === 2)!;
    until(w, () => !!p.haul);
    expect(p.haul!.sourcePileId).toBe(behind.id);
    expect(p.haul!.destination).toEqual({ type: 'stockpile', stockpileId: storage.id });
  });
});

describe('first giver that finds a target (JobGiver_Work)', () => {
  test('at equal priority, refuelling a far building comes before hauling a thing at hand', () => {
    const w = camp(), p = w.pawns[0]!; p.priorities.haul = 3;
    addGroundMaterial(w, 'wood', 20, { x: 7, z: 6 }, 'wood');
    w.stockpiles = [{ id: w.nextId++, x: 8, z: 6, priority: 3, capacity: 75, filters: { wood: true, food: false } }];
    w.structures = [{ id: w.nextId++, kind: 'campfire', x: 34, z: 34, orientation: 0, footprint: 'standard', bills: [], fuel: { ticks: 0, burned: 0, autoRefuel: true } } as World['structures'][number]];
    until(w, () => !!p.haul);
    expect(p.haul!.destination.type).toBe('fuel');
  });

  test('a refuelable is searched region by region: the one in a nearby region wins over a closer one behind a wall', () => {
    const w = camp(), p = w.pawns[0]!; p.priorities.haul = 3;
    // A wall across the map with a single door at its far end.
    const walls: Structure[] = [];
    for (let x = 0; x < 40; x++) walls.push(x === 38
      ? { id: w.nextId++, kind: 'door', material: 'wood', x, z: 9, orientation: 0, footprint: 'standard', door: newDoorState(w.tick) } as Structure
      : { id: w.nextId++, kind: 'wall', material: 'wood', x, z: 9, orientation: 0, footprint: 'standard' } as Structure);
    const campfire = (x: number, z: number) => ({ id: w.nextId++, kind: 'campfire', x, z, orientation: 0, footprint: 'standard', bills: [], fuel: { ticks: 0, burned: 0, autoRefuel: true } }) as Structure;
    // Behind the wall, 5 cells away in a straight line but many regions away.
    const behind = campfire(6, 11);
    // On the pawn's side, 14 cells away in the next region.
    const beside = campfire(20, 3);
    w.structures = [...walls, behind, beside];
    addGroundMaterial(w, 'wood', 30, { x: 7, z: 6 }, 'wood');
    until(w, () => !!p.haul);
    expect(p.haul!.destination).toEqual({ type: 'fuel', structureId: beside.id });
  });
});
