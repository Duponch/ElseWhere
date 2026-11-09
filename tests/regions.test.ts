import { describe, expect, test } from 'vitest';
import { createWorld } from '../src/sim/engine';
import { blockedCells } from '../src/sim/pathfinding';
import { candidateAccess } from '../src/sim/candidate-access';
import { newDoorState } from '../src/sim/door-rules';
import { buildRegionMap, regionMapFor, regionSearchKey, regionTraversal, REGION_SIZE } from '../src/sim/regions';
import type { Structure, World } from '../src/sim/types';

// Deterministic pseudo-random numbers for the fixtures (not simulation state).
const lcg = (seed: number) => () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;

function open(width: number, height: number): World {
  const w = createWorld(7, width, height);
  w.tiles = w.tiles.map(() => ({ terrain: 'grass' }));
  w.resources = []; w.jobs = []; w.structures = []; w.piles = []; w.stockpiles = [];
  return w;
}
function wall(w: World, x: number, z: number): void {
  w.structures = [...w.structures, { id: w.nextId++, kind: 'wall', material: 'wood', x, z, orientation: 0, footprint: 'standard' } as Structure];
}
function door(w: World, x: number, z: number, forbidden = false): Structure {
  const s = { id: w.nextId++, kind: 'door', material: 'wood', x, z, orientation: 0, footprint: 'standard', door: { ...newDoorState(w.tick), ...forbidden ? { forbidden: true } : {} } } as Structure;
  w.structures = [...w.structures, s]; return s;
}

describe('region map (RimWorld RegionMaker)', () => {
  test('an open map is cut into 12 x 12 blocks aligned on multiples of 12, each linked to its neighbours', () => {
    const map = buildRegionMap(30, 30, new Uint8Array(900), []);
    expect(REGION_SIZE).toBe(12);
    expect(map.count).toBe(9);
    // Blocks of 12, 12 and 6 cells along each axis.
    expect(map.regionOf[0]).toBe(0); expect(map.regionOf[11]).toBe(0); expect(map.regionOf[12]).toBe(1); expect(map.regionOf[24]).toBe(2);
    expect(map.regionOf[12 * 30]).toBe(3); expect(map.regionOf[29 * 30 + 29]).toBe(8);
    const links = (r: number) => [...map.links.subarray(map.linkStart[r]!, map.linkStart[r + 1]!)];
    expect(links(0)).toEqual([1, 3]); expect(links(4)).toEqual([1, 3, 5, 7]); expect(links(8)).toEqual([5, 7]);
    expect([...map.portals]).toEqual([]);
  });
  test('a wall splits a block into two regions; a door is a one-cell portal region linking both sides', () => {
    const grid = new Uint8Array(144);
    for (let x = 0; x < 12; x++) if (x !== 5) grid[6 * 12 + x] = 1;
    const doorCell = 6 * 12 + 5;
    const map = buildRegionMap(12, 12, grid, [doorCell]);
    expect(map.count).toBe(3);
    const below = map.regionOf[0]!, door = map.regionOf[doorCell]!, above = map.regionOf[11 * 12]!;
    expect(new Set([below, door, above]).size).toBe(3);
    expect(map.doorCell[door]).toBe(doorCell); expect(map.doorCell[below]).toBe(-1);
    expect([...map.portals]).toEqual([door]);
    expect(map.regionOf[6 * 12]).toBe(-1);
    const links = (r: number) => [...map.links.subarray(map.linkStart[r]!, map.linkStart[r + 1]!)];
    expect(links(door).sort()).toEqual([below, above].sort());
    expect(links(below)).toEqual([door]);
  });
  test('the regions only depend on the grid: a rebuild gives the same ids and links', () => {
    const random = lcg(3), grid = new Uint8Array(40 * 40).map(() => random() < 0.3 ? 1 : 0);
    const a = buildRegionMap(40, 40, grid, [5, 77, 400]), b = buildRegionMap(40, 40, grid.slice(), [5, 77, 400]);
    expect([...a.regionOf]).toEqual([...b.regionOf]); expect([...a.links]).toEqual([...b.links]); expect([...a.linkStart]).toEqual([...b.linkStart]);
  });
  test('a map keeps its regions until its grid or doors change', () => {
    const w = open(30, 30), grid = blockedCells(w);
    const first = regionMapFor(w, grid);
    expect(regionMapFor(w, grid.slice())).toBe(first);
    wall(w, 3, 3);
    expect(regionMapFor(w, blockedCells(w))).not.toBe(first);
  });
});

describe('reachability on regions', () => {
  test('equals the cell flood for walls, open, closed and forbidden doors and every target', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const random = lcg(seed), w = open(37, 29);
      for (let i = 0; i < 260; i++) { const x = Math.floor(random() * 37), z = Math.floor(random() * 29); if (random() < 0.85) wall(w, x, z); else door(w, x, z, random() < 0.4); }
      // A closed line with a single door between two halves on some seeds.
      if (seed % 3 === 0) for (let x = 0; x < 37; x++) x === 20 ? door(w, x, 14, seed % 2 === 0) : wall(w, x, 14);
      const pawn = w.pawns[0]!;
      for (let k = 0; k < 4; k++) {
        pawn.x = Math.floor(random() * 37); pawn.z = Math.floor(random() * 29);
        const grid = blockedCells(w), map = regionMapFor(w, grid);
        const plain = candidateAccess(w, pawn, grid, new Set(), true), regions = candidateAccess(w, pawn, grid, new Set(), true, pawn, undefined, map);
        const size = w.width * w.height;
        for (let i = -2; i < size + 2; i++) expect(regions.has(i), `seed ${seed} pawn ${pawn.x},${pawn.z} cell ${i}`).toBe(plain.has(i));
        expect(regions.connectivityVisited).toBe(0);
      }
    }
  });
  test('a pawn standing on a wall cell reaches through its open neighbours, as the flood does', () => {
    const w = open(24, 24), pawn = w.pawns[0]!;
    for (let x = 0; x < 24; x++) if (x !== 10) wall(w, x, 12);
    Object.assign(pawn, { x: 10, z: 12 });
    wall(w, 10, 12);
    const grid = blockedCells(w), map = regionMapFor(w, grid);
    const plain = candidateAccess(w, pawn, grid, new Set(), true), regions = candidateAccess(w, pawn, grid, new Set(), true, pawn, undefined, map);
    for (let i = 0; i < 576; i++) expect(regions.has(i)).toBe(plain.has(i));
    expect(regions.has(0)).toBe(true); expect(regions.has(23 * 24)).toBe(true);
  });
  test('an occupied cell keeps the cell flood', () => {
    const w = open(24, 24), pawn = w.pawns[0]!, grid = blockedCells(w), map = regionMapFor(w, grid);
    const occupied = new Set([5 * 24 + 5]);
    const plain = candidateAccess(w, pawn, grid, occupied, true), regions = candidateAccess(w, pawn, grid, occupied, true, pawn, undefined, map);
    for (let i = 0; i < 576; i++) expect(regions.has(i)).toBe(plain.has(i));
  });
});

describe('region traversal (RimWorld RegionTraverser)', () => {
  test('breadth first from the pawn region, doors open or closed for the pawn, door regions not counted', () => {
    // Two blocks side by side, separated by a wall with a door.
    const grid = new Uint8Array(24 * 12);
    for (let z = 0; z < 12; z++) if (z !== 4) grid[z * 24 + 12] = 1;
    const doorCell = 4 * 24 + 12, map = buildRegionMap(24, 12, grid, [doorCell]);
    const left = map.regionOf[0]!, door = map.regionOf[doorCell]!, right = map.regionOf[23]!, rightStrip = map.regionOf[13]!;
    expect(map.regionOf[13]).toBe(map.regionOf[23]);
    const openAll = regionTraversal(map, 0, () => true);
    expect(openAll.position[left]).toBe(0); expect(openAll.position[door]).toBe(1); expect(openAll.position[right]).toBe(2);
    // The door is processed but not counted: the right side has one counted region before it.
    expect(openAll.countedBefore[right]).toBe(1);
    expect(regionSearchKey(map, openAll, [23], 1)).toBe(Infinity);
    expect(regionSearchKey(map, openAll, [23], 2)).toBe(2);
    expect(regionSearchKey(map, openAll, [0, 23], 30)).toBe(0);
    const closed = regionTraversal(map, 0, r => r !== door);
    expect(closed.position[door]).toBe(-1); expect(closed.position[rightStrip]).toBe(-1);
    expect(regionSearchKey(map, closed, [23], 30)).toBe(Infinity);
  });
});
