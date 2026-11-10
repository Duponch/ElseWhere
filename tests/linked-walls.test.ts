import { expect, test } from 'vitest';
import * as THREE from 'three/webgpu';
import { createWorld } from '../src/sim/index';
import { newDoorState } from '../src/sim/door-rules';
import type { Structure, World } from '../src/sim/types';
import { createOrigamiBrushGeometry } from '../src/render/origami/brush-geometry';
import { readWallGrid, wallChunkFaces, emitWallFaces, timberLintelBottom, WALL_CAP_HEIGHT, type WallFaces } from '../src/render/wall-network';
import { WallLayer } from '../src/render/WallLayer';
import { WORLD_SCALE } from '../src/world/scale';

let nextId = 1;
const wall = (x: number, z: number, material: Structure['material'] = 'wood'): Structure => ({ id: nextId++, kind: 'wall', material, x, z, orientation: 0, footprint: 'standard' });
const door = (x: number, z: number): Structure => ({ id: nextId++, kind: 'door', material: 'wood', x, z, orientation: 0, footprint: 'standard', door: newDoorState(0) });
function worldWith(structures: Structure[], size = 48): World {
  const world = createWorld(5, size, size);
  world.structures = structures;
  return world;
}

/** Contour strips found on the COMPLETE surface (drawn + context ring). */
function strips(faces: WallFaces, context?: WallFaces): number[][] {
  const g = new THREE.BufferGeometry(), join = (a: number[], b: number[] = []) => new Float32Array([...a, ...b]);
  g.setAttribute('position', new THREE.BufferAttribute(join(faces.position, context?.position), 3));
  g.setAttribute('surfaceStrokeUv', new THREE.BufferAttribute(join(faces.faceUv, context?.faceUv), 2));
  g.setAttribute('wallSeam', new THREE.BufferAttribute(join(faces.seam, context?.seam), 1));
  const brush = createOrigamiBrushGeometry(g), base = brush.userData.referenceBrushBasePositions as Float32Array, out: number[][] = [];
  for (let i = 0; i < base.length; i += 18) out.push(Array.from(base.subarray(i, i + 18)));
  brush.dispose(); g.dispose();
  return out;
}
const onPlaneX = (strip: number[], x: number) => [0, 6, 12].every(i => Math.abs(strip[i]! - x) < 1e-6);
const onPlaneZ = (strip: number[], z: number) => [2, 8, 14].every(i => Math.abs(strip[i]! - z) < 1e-6);

test('a straight timber run is one continuous block: no face, cap or contour at its joints', () => {
  const world = worldWith([0, 1, 2, 3, 4].map(x => wall(10 + x, 7)));
  const grid = readWallGrid(world, false), faces = emitWallFaces(grid, () => true, 0, 0, 48, 48);
  // 5 tops + 4 bands on each long side and on each end, merged along the run.
  expect(faces.triangles).toBe(2 * (5 + 4 * 4));
  const positions = faces.position, normals = faces.normal;
  for (let v = 0; v < positions.length / 3; v++) if (Math.abs(normals[v * 3]!) > .5)
    expect([9.5, 14.5]).toContain(positions[v * 3]);
  const lines = strips(faces);
  expect(lines.length).toBeGreaterThan(0);
  for (const joint of [10.5, 11.5, 12.5, 13.5]) expect(lines.filter(s => onPlaneX(s, joint))).toHaveLength(0);
  // Real folds keep their contour: run ends and the long top edges.
  expect(lines.some(s => onPlaneX(s, 9.5))).toBe(true);
  expect(lines.some(s => onPlaneZ(s, 7.5) && Math.abs(s[1]! - WORLD_SCALE.wallHeight) < 1e-6)).toBe(true);
});

test('a run crossing a region border keeps one contour thanks to the context ring', () => {
  const world = worldWith([29, 30, 31, 32, 33, 34].map(x => wall(x, 4, 'granite-blocks')), 64);
  const grid = readWallGrid(world, false), left = wallChunkFaces(grid, 0, 0), right = wallChunkFaces(grid, 1, 0);
  expect(left.drawn.triangles).toBeGreaterThan(0); expect(right.drawn.triangles).toBeGreaterThan(0);
  // The border joint is between x=31 and x=32.
  const border = 31.5, drawnLeft = left.drawn.triangles * 3;
  const withContext = strips(left.drawn, left.context), alone = strips(left.drawn);
  expect(alone.some(s => onPlaneX(s, border))).toBe(true);
  expect(withContext.some(s => onPlaneX(s, border))).toBe(false);
  expect(drawnLeft).toBeGreaterThan(0);
});

test('corners, tees and crosses fuse; outer corners keep their vertical contour', () => {
  // An L corner at (5,5), a tee at (12,5) and a cross at (20,5).
  const cells: [number, number][] = [[5, 5], [6, 5], [7, 5], [5, 6], [5, 7],
    [11, 5], [12, 5], [13, 5], [12, 6], [12, 7],
    [19, 5], [20, 5], [21, 5], [20, 4], [20, 6]];
  const world = worldWith(cells.map(([x, z]) => wall(x, z, 'slate-blocks')));
  const faces = emitWallFaces(readWallGrid(world, false), () => true, 0, 0, 48, 48), lines = strips(faces);
  // No side face ever lies inside the network.
  for (let v = 0; v < faces.position.length / 3; v++) {
    const x = faces.position[v * 3]!, z = faces.position[v * 3 + 2]!, nx = faces.normal[v * 3]!, nz = faces.normal[v * 3 + 2]!;
    if (Math.abs(nx) < .5 && Math.abs(nz) < .5) continue;
    const insideX = x + nx * .25, insideZ = z + nz * .25, cell = cells.some(([cx, cz]) => Math.abs(cx - insideX) < .5 && Math.abs(cz - insideZ) < .5);
    expect(cell).toBe(false);
  }
  // The outer corner of the L (x=4.5, z=4.5) is a vertical fold with a contour.
  expect(lines.some(s => onPlaneX(s, 4.5) && onPlaneZ(s, 4.5))).toBe(true);
  // Joints of the tee and the cross carry none on the top.
  const top = WORLD_SCALE.wallHeight;
  const topJoint = (x: number) => lines.filter(s => onPlaneX(s, x) && [1, 7, 13].every(i => Math.abs(s[i]! - top) < 1e-6) && [2, 8, 14].every(i => Math.abs(s[i]! - 5) < .5 - 1e-6));
  for (const x of [11.5, 12.5, 19.5, 20.5]) expect(topJoint(x)).toHaveLength(0);
});

test('a doorway joins the wall through its lintel; jambs stop below it', () => {
  const world = worldWith([wall(3, 3), wall(4, 3), door(5, 3), wall(6, 3), wall(7, 3)]);
  const grid = readWallGrid(world, false), faces = emitWallFaces(grid, () => true, 0, 0, 48, 48);
  expect(grid.codes[3 * 48 + 5]).not.toBe(0);
  const lintel = timberLintelBottom(), positions = faces.position, normals = faces.normal;
  let underside = 0, jamb = 0;
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, nx = normals[v * 3]!, ny = normals[v * 3 + 1]!;
    if (ny < -.5) { expect(y).toBeCloseTo(lintel); underside++; }
    if (Math.abs(nx) > .5 && (Math.abs(x - 4.5) < 1e-6 || Math.abs(x - 5.5) < 1e-6)) { expect(y).toBeLessThanOrEqual(lintel + 1e-6); jamb++; }
  }
  expect(underside).toBe(6); expect(jamb).toBeGreaterThan(0);
  // Cutaway leaves the doorway open and lowers the cap.
  const cut = readWallGrid(world, true);
  expect(cut.codes[3 * 48 + 5]).toBe(0); expect(cut.top).toBe(WORLD_SCALE.wallCutawayHeight);
  expect(Math.max(...emitWallFaces(cut, () => true, 0, 0, 48, 48).position.filter((_, i) => i % 3 === 1))).toBeCloseTo(WORLD_SCALE.wallCutawayHeight);
});

test('a material change draws a contour, the cap band too', () => {
  const world = worldWith([wall(2, 2, 'granite-blocks'), wall(3, 2, 'limestone-blocks')]);
  const lines = strips(emitWallFaces(readWallGrid(world, false), () => true, 0, 0, 48, 48));
  expect(lines.some(s => onPlaneX(s, 2.5))).toBe(true);
  const capY = WORLD_SCALE.wallHeight - WALL_CAP_HEIGHT;
  expect(lines.some(s => [1, 7, 13].every(i => Math.abs(s[i]! - capY) < 1e-6))).toBe(true);
});

test('the layer is one resident mesh; a built or removed wall rewrites only its own region', () => {
  const structures = [wall(3, 3), wall(4, 3), wall(40, 40, 'granite-blocks')], world = worldWith(structures, 64);
  const layer = new WallLayer();
  layer.update(world, false);
  expect(layer.group.children).toEqual([layer.mesh]);
  expect(layer.mesh.visible).toBe(true);
  expect(layer.stats.lastRebuilt).toBe(4);
  const geometry = layer.mesh.geometry, triangles = layer.triangles;
  expect(geometry.drawRange.count).toBe(layer.reservedTriangles * 3);
  // Same walls: nothing rebuilt.
  layer.update({ ...world, structures: [...structures] }, false);
  expect(layer.stats.lastRebuilt).toBe(0);
  // One more wall in the first region: one region rewritten in place.
  world.structures = [...structures, wall(5, 3)];
  layer.update(world, false);
  expect(layer.stats.lastRebuilt).toBe(1);
  expect(layer.mesh.geometry).toBe(geometry);
  expect(layer.triangles).toBe(triangles + 2);
  // Removing the far wall empties its region.
  world.structures = world.structures.filter(s => s.x !== 40);
  layer.update(world, false);
  expect(layer.stats.lastRebuilt).toBe(1);
  expect(layer.triangles).toBeLessThan(triangles);
  // Target preview tints only the targeted cells (one texel per cell).
  layer.setTargetPreview(new Set([structures[0]!.id]));
  layer.clearTargetPreview();
  layer.setTexturesEnabled(false); expect(layer.mesh.material).toBe(layer.plain);
  world.structures = [];
  layer.update(world, false);
  expect(layer.mesh.visible).toBe(false);
  const restore = layer.prepare(); expect(layer.mesh.visible).toBe(true); restore(); expect(layer.mesh.visible).toBe(false);
  layer.dispose();
});

test('walls rebuilt region by region equal a fresh build after many edits', () => {
  const structures: Structure[] = [];
  for (let x = 20; x < 45; x++) structures.push(wall(x, 30), wall(x, 36, x % 3 ? 'wood' : 'granite-blocks'));
  for (let z = 31; z < 36; z++) structures.push(wall(20, z), wall(44, z));
  const world = worldWith(structures, 64), layer = new WallLayer();
  layer.update(world, false);
  world.structures = world.structures.filter(s => !(s.x === 31 && s.z === 30)).concat(door(31, 30), wall(32, 31), wall(32, 32));
  layer.update(world, false);
  expect(layer.stats.lastRebuilt).toBeLessThanOrEqual(4);
  world.structures = world.structures.filter(s => !(s.x === 44 && s.z === 33));
  layer.update(world, false);
  const fresh = new WallLayer(); fresh.update(world, false);
  const drawn = (l: WallLayer) => {
    const g = l.mesh.geometry, p = g.getAttribute('position'), out: string[] = [];
    for (let t = 0; t < g.drawRange.count / 3; t++) {
      const v = [0, 1, 2].map(i => [p.getX(t * 3 + i), p.getY(t * 3 + i), p.getZ(t * 3 + i)]);
      if (v[0]!.join() === v[1]!.join() && v[1]!.join() === v[2]!.join()) continue;
      out.push(v.map(c => c.map(n => n.toFixed(5)).join(',')).join(' / ') + ['normal', 'color', 'wallFamily'].map(n => Array.from({ length: g.getAttribute(n).itemSize }, (_, c) => g.getAttribute(n).getComponent(t * 3, c).toFixed(5)).join(',')).join('|'));
    }
    return out.sort();
  };
  expect(drawn(layer)).toEqual(drawn(fresh));
  layer.dispose(); fresh.dispose();
});
