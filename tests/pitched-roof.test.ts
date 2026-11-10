import { expect, test } from 'vitest';
import { pitchedRoofFaces, roofComponents, ROOF_OVERHANG, ROOF_PART_PITCH, ROOF_PART_GABLE, ROOF_SLOPE, ROOF_CAP_CELLS, type RoofCell, type RoofFaces } from '../src/render/pitched-roof';
import { roofGeometry } from '../src/render/RoofLayer';
import { createWorld } from '../src/sim/index';
import type { World } from '../src/sim/types';

const EAVE = 2.88, SIZE = 40;
const rect = (x0: number, z0: number, w: number, d: number): RoofCell[] => Array.from({ length: w * d }, (_, i) => ({ x: x0 + i % w, z: z0 + Math.floor(i / w) }));
const shape = (rows: string[], x0 = 2, z0 = 2): RoofCell[] => rows.flatMap((row, z) => [...row].flatMap((c, x) => c === '#' ? [{ x: x0 + x, z: z0 + z }] : []));

type Tri = { a: number[]; b: number[]; c: number[] };
function pitch(faces: RoofFaces): Tri[] {
  const out: Tri[] = [], p = faces.position;
  for (let t = 0; t < faces.triangles; t++) if (faces.part[t * 3] === ROOF_PART_PITCH) {
    const v = (i: number) => [p[(t * 3 + i) * 3]!, p[(t * 3 + i) * 3 + 1]!, p[(t * 3 + i) * 3 + 2]!];
    out.push({ a: v(0), b: v(1), c: v(2) });
  }
  return out;
}
/** L∞ distance from a point to the footprint (unit squares). */
const distanceTo = (cells: RoofCell[], x: number, z: number) => Math.min(...cells.map(c => Math.max(Math.abs(x - c.x) - .5, Math.abs(z - c.z) - .5, 0)));
const covering = (tris: Tri[], x: number, z: number) => tris.filter(({ a, b, c }) => {
  const d = (p: number[], q: number[]) => (q[0]! - p[0]!) * (z - p[2]!) - (q[2]! - p[2]!) * (x - p[0]!);
  const d1 = d(a, b), d2 = d(b, c), d3 = d(c, a);
  return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
});
/** Height of the surface over (x,z) from its covering triangle. */
function heightAt(tris: Tri[], x: number, z: number): number {
  const [t] = covering(tris, x, z); if (!t) return NaN;
  const { a, b, c } = t, det = (b[0]! - a[0]!) * (c[2]! - a[2]!) - (c[0]! - a[0]!) * (b[2]! - a[2]!);
  const u = ((x - a[0]!) * (c[2]! - a[2]!) - (c[0]! - a[0]!) * (z - a[2]!)) / det, w = ((b[0]! - a[0]!) * (z - a[2]!) - (x - a[0]!) * (b[2]! - a[2]!)) / det;
  return a[1]! + u * (b[1]! - a[1]!) + w * (c[1]! - a[1]!);
}

/** The pitched surface covers the footprint grown by the overhang exactly once
 * (no hole, no double layer), and its only free edges lie on that outline. */
function expectWatertight(cells: RoofCell[], faces: RoofFaces): Tri[] {
  const tris = pitch(faces);
  const xs = cells.map(c => c.x), zs = cells.map(c => c.z);
  // Offsets keep samples off every cell, half-cell and diagonal line.
  for (let x = Math.min(...xs) - .9731; x <= Math.max(...xs) + 1; x += .37) for (let z = Math.min(...zs) - .9419; z <= Math.max(...zs) + 1; z += .41) {
    const inside = distanceTo(cells, x, z) < ROOF_OVERHANG - 1e-3, outside = distanceTo(cells, x, z) > ROOF_OVERHANG + 1e-3;
    const n = covering(tris, x, z).length;
    if (inside) expect(n, `covered once at ${x.toFixed(2)},${z.toFixed(2)}`).toBe(1);
    if (outside) expect(n, `nothing outside at ${x.toFixed(2)},${z.toFixed(2)}`).toBe(0);
  }
  const edges = new Map<string, number>(), k = (p: number[]) => p.map(v => Math.round(v * 1e5)).join(',');
  for (const { a, b, c } of tris) for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
    const key = [k(p), k(q)].sort().join('|'); edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  for (const [key, count] of edges) {
    expect(count).toBeLessThanOrEqual(2);
    if (count === 1) {
      const [p, q] = key.split('|').map(s => s.split(',').map(v => Number(v) / 1e5));
      const mx = (p![0]! + q![0]!) / 2, mz = (p![2]! + q![2]!) / 2;
      expect(distanceTo(cells, mx, mz)).toBeCloseTo(ROOF_OVERHANG, 4);
    }
  }
  return tris;
}

test('a square room gets a hipped roof whose apex is centred', () => {
  const cells = rect(5, 5, 6, 6), { faces, components } = pitchedRoofFaces(SIZE, SIZE, cells, { eave: EAVE });
  expect(components).toEqual([{ cells: 36, form: 'hip' }]);
  const tris = expectWatertight(cells, faces);
  const apex = heightAt(tris, 7.5, 7.5);
  expect(apex).toBeCloseTo(EAVE + ROOF_SLOPE * (3 + ROOF_OVERHANG), 5);
  // Four pitches: the eave is at the same height all around.
  for (const [x, z] of [[4.4, 7.5], [10.6, 7.5], [7.5, 4.4], [7.5, 10.6]]) expect(heightAt(tris, x!, z!)).toBeCloseTo(EAVE + ROOF_SLOPE * (ROOF_OVERHANG - .1), 5);
  expect(faces.part.includes(ROOF_PART_GABLE)).toBe(false);
});

test('a long house gets two pitches and two gables; wide halls are capped flat', () => {
  const cells = rect(3, 4, 12, 5), { faces, components } = pitchedRoofFaces(SIZE, SIZE, cells, { eave: EAVE, gableColor: () => 0x123456 });
  expect(components).toEqual([{ cells: 60, form: 'gable', ridgeAlongX: true }]);
  const tris = expectWatertight(cells, faces);
  // The ridge runs the whole length at a constant height, gables at both ends.
  const ridge = EAVE + ROOF_SLOPE * (2.5 + ROOF_OVERHANG);
  for (const x of [2.7, 3, 6.3, 9.9, 14.6]) expect(heightAt(tris, x, 6)).toBeCloseTo(ridge, 5);
  const gable = faces.part.filter(p => p === ROOF_PART_GABLE).length / 3;
  expect(gable).toBeGreaterThan(0);
  const big = rect(1, 1, 30, 12), hall = pitchedRoofFaces(SIZE, SIZE, big, { eave: EAVE });
  const top = Math.max(...hall.faces.position.filter((_, i) => i % 3 === 1));
  expect(top).toBeCloseTo(EAVE + ROOF_SLOPE * (ROOF_CAP_CELLS + ROOF_OVERHANG), 5);
  expectWatertight(big, hall.faces);
});

test('an L, a T and a courtyard get exact hipped roofs with valleys', () => {
  for (const rows of [
    ['#####', '#####', '##...', '##...', '##...'],
    ['#######', '#######', '..###..', '..###..'],
    ['######', '######', '##..##', '##..##', '######', '######'],
    ['#........', '#........', '#########', '#########'],
  ]) {
    const cells = shape(rows), { faces, components } = pitchedRoofFaces(SIZE, SIZE, cells, { eave: EAVE });
    expect(components.every(c => c.form === 'hip')).toBe(true);
    const tris = expectWatertight(cells, faces);
    // Never higher than the cap, never below the eave line.
    for (const { a, b, c } of tris) for (const p of [a, b, c]) {
      expect(p[1]).toBeGreaterThanOrEqual(EAVE - 1e-9);
      expect(p[1]).toBeLessThanOrEqual(EAVE + ROOF_SLOPE * (ROOF_CAP_CELLS + ROOF_OVERHANG) + 1e-9);
    }
  }
});

test('neighbouring rooms share one roof; a diagonal touch keeps two', () => {
  const two = [...rect(2, 2, 5, 5), ...rect(7, 2, 5, 5)];
  expect(roofComponents(SIZE, SIZE, two).components).toHaveLength(1);
  expectWatertight(two, pitchedRoofFaces(SIZE, SIZE, two, { eave: EAVE }).faces);
  const touching = [...rect(2, 2, 3, 3), ...rect(5, 5, 3, 3)], result = pitchedRoofFaces(SIZE, SIZE, touching, { eave: EAVE });
  expect(result.components).toHaveLength(2);
  const tris = pitch(result.faces);
  // Each building is still fully covered.
  for (const [x, z] of [[3, 3], [6, 6], [2.1, 4.4], [6.9, 5.2]]) expect(covering(tris, x!, z!).length).toBeGreaterThanOrEqual(1);
});

test('the roof layer keeps natural cells flat and pitches built ones', () => {
  const world: World = createWorld(3, 24, 24);
  world.structures = [];
  world.roofing = { constructed: rect(4, 4, 4, 4).map(c => c.z * 24 + c.x).sort((a, b) => a - b), build: [], remove: [], cursor: 0, natural: { thin: [20 * 24 + 20], thick: [] } };
  const cells = [...rect(4, 4, 4, 4), { x: 20, z: 20 }];
  const geometry = roofGeometry(world, cells, EAVE), p = geometry.getAttribute('position'), part = geometry.getAttribute('roofPart');
  let natural = 0, pitched = 0;
  for (let v = 0; v < p.count; v++) {
    if (part.getX(v) === 4) { natural++; expect(p.getX(v)).toBeGreaterThan(19); }
    else { pitched++; expect(p.getX(v)).toBeLessThan(9); }
  }
  expect(natural).toBeGreaterThan(0); expect(pitched).toBeGreaterThan(0);
  geometry.dispose();
});

/** Drawn triangles with their fields, zero-area reserved slots excluded. */
function drawn(geometry: import('three/webgpu').BufferGeometry, names = ['position', 'normal', 'color', 'uv', 'roofPart']): string[] {
  const out: string[] = [], p = geometry.getAttribute('position'), count = Math.min(p.count, geometry.drawRange.count);
  for (let t = 0; t < count / 3; t++) {
    const v = [0, 1, 2].map(i => [p.getX(t * 3 + i), p.getY(t * 3 + i), p.getZ(t * 3 + i)]);
    const ab = v[1]!.map((c, k) => c - v[0]![k]!), ac = v[2]!.map((c, k) => c - v[0]![k]!);
    if (Math.hypot(ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!) < 1e-9) continue;
    out.push([0, 1, 2].map(i => names.map(name => { const a = geometry.getAttribute(name); return Array.from({ length: a.itemSize }, (_, c) => a.getComponent(t * 3 + i, c).toFixed(5)).join(','); }).join('|')).join(' / '));
  }
  return out.sort();
}

test('a roof change rewrites only nearby regions and matches a fresh build', async () => {
  const { RoofLayer } = await import('../src/render/RoofLayer');
  const world: World = createWorld(3, 96, 96);
  world.structures = [];
  const roofs = (cells: RoofCell[]) => cells.map(c => c.z * 96 + c.x).sort((a, b) => a - b);
  world.roofing = { constructed: roofs([...rect(4, 4, 8, 5), ...rect(70, 70, 6, 6)]), build: [], remove: [], cursor: 0 };
  const layer = new RoofLayer();
  layer.updatePhysical(world);
  expect(layer.stats.lastRebuilt).toBeGreaterThan(0);
  // An L extension of the first house: its region only, never the far one.
  world.roofing = { ...world.roofing, constructed: roofs([...rect(4, 4, 8, 5), ...rect(4, 9, 3, 4), ...rect(70, 70, 6, 6)]) };
  layer.updatePhysical(world);
  expect(layer.stats.lastRebuilt).toBe(1);
  const fresh = new RoofLayer();fresh.updatePhysical(world);
  expect(drawn(layer.mesh.geometry)).toEqual(drawn(fresh.mesh.geometry));
  const cells = [...rect(4, 4, 8, 5), ...rect(4, 9, 3, 4), ...rect(70, 70, 6, 6)].sort((a, b) => a.z - b.z || a.x - b.x);
  const canonical = roofGeometry(world, cells, 2.8 + .08);
  expect(drawn(layer.mesh.geometry)).toEqual(drawn(canonical));
  canonical.dispose();layer.dispose();fresh.dispose();
});
