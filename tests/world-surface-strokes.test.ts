import { expect, test } from 'vitest';
import * as THREE from 'three/webgpu';
import { compileFaceStrokeTable } from '../src/render/surfaces/FaceStrokeTable';
import { compileWorldSurfaceStrokes } from '../src/render/surfaces/WorldSurfaceStrokes';
import { emitWallFaces, readWallGrid, wallChunkFaces } from '../src/render/wall-network';
import { pitchedRoofFaces } from '../src/render/pitched-roof';
import { createWorld } from '../src/sim/index';
import type { Structure } from '../src/sim/types';

const soup = (position: number[], uv: number[], part: number[]) => ({ position: new Float32Array(position), faceUv: new Float32Array(uv), partition: new Float32Array(part) });
function original(input: ReturnType<typeof soup>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(input.position, 3));
  g.setAttribute('surfaceStrokeUv', new THREE.BufferAttribute(input.faceUv, 2));
  g.setAttribute('seamPart', new THREE.BufferAttribute(input.partition, 1));
  const table = compileFaceStrokeTable(g, { uvAttribute: 'surfaceStrokeUv', mergeCoplanar: false, maxEdgesPerFace: 3, maxTriangles: 1e6, maxCpuBytes: 256 * 1024 * 1024 });
  const out = { faceCount: table.faceCount, edgeCount: table.edgeCount, maxEdgesPerFace: table.maxEdgesPerFace, values: table.values.slice() };
  table.dispose(); g.dispose(); return out;
}
/** Records of one face, with its row made relative. */
function face(values: Float32Array, i: number) {
  const row = values[i * 8]!, count = values[i * 8 + 1]!;
  return { header: Array.from(values.subarray(i * 8 + 1, i * 8 + 8)), edges: Array.from(values.subarray(row * 4, row * 4 + count * 36)) };
}

function walls(): ReturnType<typeof readWallGrid> {
  const world = createWorld(5, 64, 64);let id = 1;
  const wall = (x: number, z: number, material: Structure['material'] = 'wood'): Structure => ({ id: id++, kind: 'wall', material, x, z, orientation: 0, footprint: 'standard' });
  world.structures = [];
  for (let x = 28; x < 38; x++) world.structures.push(wall(x, 10), wall(x, 16, x < 33 ? 'wood' : 'granite-blocks'));
  for (let z = 11; z < 16; z++) world.structures.push(wall(28, z), wall(37, z));
  world.structures.push({ ...wall(32, 10), kind: 'door', door: { open: false, changedAt: 0, ticksOpen: 0 } } as unknown as Structure);
  world.structures = world.structures.filter((s, i, all) => all.findIndex(o => o.x === s.x && o.z === s.z) === i || s.kind === 'door').filter((s, i, all) => !(s.kind === 'wall' && all.some(o => o.kind === 'door' && o.x === s.x && o.z === s.z)));
  return readWallGrid(world, false);
}

test('the world-surface compiler reproduces the Source table exactly on walls and roofs', () => {
  const grid = walls(), all = emitWallFaces(grid, () => true, 0, 0, 64, 64);
  const roof = pitchedRoofFaces(32, 32, [...Array(30)].map((_, i) => ({ x: 4 + i % 6, z: 4 + Math.floor(i / 6) })).concat([{ x: 4, z: 9 }, { x: 4, z: 10 }]), { eave: 2.88 }).faces;
  for (const input of [soup(all.position, all.faceUv, all.seam), soup(roof.position, roof.uv, roof.part)]) {
    const triangles = input.position.length / 9, expected = original(input), actual = compileWorldSurfaceStrokes({ ...input, drawnTriangles: triangles });
    expect(actual.faceCount).toBe(expected.faceCount);
    expect(actual.edgeCount).toBe(expected.edgeCount);
    expect(actual.maxEdgesPerFace).toBe(expected.maxEdgesPerFace);
    expect(actual.edgeCount).toBeGreaterThan(10);
    expect(Array.from(actual.values)).toEqual(Array.from(expected.values));
  }
});

test('context triangles shape the contours but store no record', () => {
  const grid = walls(), { drawn, context } = wallChunkFaces(grid, 0, 0);
  expect(drawn.triangles).toBeGreaterThan(0); expect(context.triangles).toBeGreaterThan(0);
  const input = soup([...drawn.position, ...context.position], [...drawn.faceUv, ...context.faceUv], [...drawn.seam, ...context.seam]);
  const expected = original(input), actual = compileWorldSurfaceStrokes({ ...input, drawnTriangles: drawn.triangles });
  expect(actual.faceCount).toBe(drawn.triangles);
  expect(actual.values.length).toBeLessThan(expected.values.length);
  for (let i = 0; i < drawn.triangles; i++) expect(face(actual.values, i)).toEqual(face(expected.values, i));
});
