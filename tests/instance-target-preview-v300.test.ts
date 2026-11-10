import { expect, test } from 'vitest';
import * as THREE from 'three/webgpu';
import { BoxBatches } from '../src/render/BoxBatches';
import { BoxMesh } from '../src/render/BoxMesh';
import { DoorLayer } from '../src/render/DoorLayer';
import { TimberCladdingLayer } from '../src/render/TimberCladdingLayer';
import { WallLayer } from '../src/render/WallLayer';
import { buildFurniture } from '../src/render/FurnitureLayer';
import { buildJobMarkers } from '../src/render/JobLayer';
import { pileParts } from '../src/render/pile-parts';
import type { Placement } from '../src/render/primitives';
import { createWorld } from '../src/sim/engine';
import { newDoorState } from '../src/sim/door-rules';
import type { Structure, World } from '../src/sim/types';

const bits = (attribute: THREE.BufferAttribute) => Array.from(new Uint32Array(attribute.array.buffer,
  attribute.array.byteOffset, attribute.array.byteLength / 4));
const boxes = (group: THREE.Group) => group.children.filter((child): child is BoxMesh => child instanceof BoxMesh);
const building = (id: number, kind: Structure['kind'], x: number, z = 5): Structure =>
  ({ id, kind, x, z, orientation: 0, footprint: 'standard', material: 'wood' });
function fixture(): World {
  const world = createWorld(3003, 16, 16);
  world.tiles = world.tiles.map(() => ({ terrain: 'grass' }));
  world.resources = []; world.jobs = []; world.structures = []; world.packed = []; world.piles = [];
  return world;
}

test('instance tint follows explicit owner IDs, preserves other slots and restores original F32', () => {
  const group = new THREE.Group(), other = new THREE.Group(), batch = new BoxBatches();
  const items: Placement[] = [
    { x: 1, y: 1, z: 2, color: 0x8b4739, key: 99, targetId: 11 },
    { x: 2, y: 1, z: 2, color: 0x9fc891, key: 11, targetId: 22 },
    { x: 3, y: 1, z: 2, color: 0xe4c682, targetId: 11 },
  ];
  batch.set(group, 'owned', items); batch.set(other, 'other', items);
  const mesh = boxes(group)[0]!, untouched = bits(boxes(other)[0]!.colorBuffer);
  const original = bits(mesh.colorBuffer), matrix = Array.from(mesh.instanceMatrix.array), material = mesh.material;
  batch.setTargetPreview(group, new Set([11]));
  const tinted = bits(mesh.colorBuffer);
  expect(tinted.slice(0, 3)).not.toEqual(original.slice(0, 3));
  expect(tinted.slice(3, 6)).toEqual(original.slice(3, 6));
  expect(tinted.slice(6, 9)).not.toEqual(original.slice(6, 9));
  expect(bits(boxes(other)[0]!.colorBuffer)).toEqual(untouched);
  expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrix); expect(mesh.material).toBe(material);
  for (let i = 0; i < 15; i++) batch.setTargetPreview(group, new Set([i % 2 ? 11 : 22]));
  expect(mesh.colorBuffer.updateRanges.length).toBeLessThanOrEqual(1);
  batch.clearTargetPreview(group); expect(bits(mesh.colorBuffer)).toEqual(original);
  batch.dispose();
});

test('rebuilds and furniture patches replace the restoration baseline and keep full RGB uploads', () => {
  const group = new THREE.Group(), batch = new BoxBatches();
  const items: Placement[] = [
    { x: 1, y: 1, z: 2, color: 0x734f29, targetId: 11 },
    { x: 2, y: 1, z: 2, color: 0xa0a0a0, targetId: 22 },
  ];
  batch.set(group, 'furniture', items); batch.setTargetPreview(group, new Set([11]));
  const mesh = boxes(group)[0]!;
  const next = items.map((item, i) => ({ ...item, color: i ? 0xc65931 : 0x7dba93 }));
  batch.set(group, 'furniture', next);
  expect(mesh.colorBuffer.updateRanges.some(range => range.start === 0 && range.count === mesh.colorBuffer.array.length)).toBe(true);
  const patch = { ...next[1]!, color: 0x4963a9 };
  expect(batch.patchFurnitureBatch(group, 'furniture', [{ start: 1, items: [patch] }], 2, batch.furnitureStamp()!)).toBe(true);
  batch.clearTargetPreview();
  const reference = new BoxBatches(), referenceGroup = new THREE.Group();
  reference.set(referenceGroup, 'furniture', [next[0]!, patch]);
  expect(bits(mesh.colorBuffer)).toEqual(bits(boxes(referenceGroup)[0]!.colorBuffer));
  batch.setTargetPreview(group, new Set([11]));
  batch.set(group, 'furniture', Array.from({ length: 300 }, (_, i) => ({ ...items[i % 2]!, x: i })));
  expect(mesh.instanceMatrix.count).toBeGreaterThanOrEqual(300);
  batch.clearTargetPreview();
  reference.set(referenceGroup, 'furniture', Array.from({ length: 300 }, (_, i) => ({ ...items[i % 2]!, x: i })));
  expect(bits(mesh.colorBuffer)).toEqual(bits(boxes(referenceGroup)[0]!.colorBuffer));
  reference.dispose(); batch.dispose();
});

test('ground fragments carry target ownership through rounded shape splitting without changing seeds', () => {
  const parts = pileParts([
    { x: 3, z: 4, kind: 'chunk', item: 'granite-chunk', quantity: 1, supplied: false, targetId: 34 },
    { x: 4, z: 4, kind: 'steel', item: 'steel', quantity: 25, supplied: false, targetId: 44 },
  ]);
  expect(parts.filter(part => part.shape === 'rounded-rock').every(part => part.targetId === 34)).toBe(true);
  const group = new THREE.Group(), batch = new BoxBatches(); batch.set(group, 'pile:0:0', parts);
  const state = boxes(group).map(mesh => ({ mesh, colors: bits(mesh.colorBuffer), material: mesh.material,
    matrix: Array.from(mesh.instanceMatrix.array), contour: mesh.geometry.getAttribute('chunkContour')?.array.slice() }));
  batch.setTargetPreview(group, new Set([34]));
  expect(state.some(({ mesh, colors }) => mesh.activeCount > 0 && JSON.stringify(bits(mesh.colorBuffer)) !== JSON.stringify(colors))).toBe(true);
  for (const entry of state) {
    expect(entry.mesh.material).toBe(entry.material);
    expect(Array.from(entry.mesh.instanceMatrix.array)).toEqual(entry.matrix);
    expect(entry.mesh.geometry.getAttribute('chunkContour')?.array).toEqual(entry.contour);
    if (!entry.mesh.geometry.hasAttribute('chunkContour')) expect(bits(entry.mesh.colorBuffer)).toEqual(entry.colors);
  }
  batch.clearTargetPreview(); for (const entry of state) expect(bits(entry.mesh.colorBuffer)).toEqual(entry.colors);
  batch.dispose();
});

test('finished local furniture and every visible construction contribution retain their actual owner', () => {
  const world = fixture();
  world.structures = [building(11, 'wall', 2), { ...building(12, 'wall', 3), material: 'steel' },
    building(13, 'bed', 5), building(14, 'table', 8), building(15, 'stool', 11)];
  let furniture: Placement[] = [];
  const sink = { set(_group: THREE.Group, name: string, items: Placement[]) { if (name === 'furniture') furniture = items; } };
  buildFurniture(world, new THREE.Group(), false, sink as unknown as BoxBatches);
  expect(furniture.length).toBeGreaterThan(10);
  expect(furniture.every(part => part.targetId !== undefined)).toBe(true);
  expect(new Set(furniture.map(part => part.targetId))).toEqual(new Set([13, 14, 15]));
  // Walls of every material are drawn linked: their owner is kept per cell,
  // and an order preview tints exactly their cells, then restores them.
  const walls = new WallLayer();
  walls.update(world, false);
  const at = (s: { x: number; z: number }) => s.z * world.width + s.x, cells = world.structures.slice(0, 2).map(at);
  const texels = () => Array.from(walls['targetMap'].image.data as Uint8Array);
  const colours = Array.from(walls.mesh.geometry.getAttribute('color').array);
  walls.setTargetPreview(new Set([12]));
  expect(texels().flatMap((v, i) => v ? [i] : [])).toEqual([cells[1]]);
  walls.setTargetPreview(new Set([11, 12]));
  expect(texels().flatMap((v, i) => v ? [i] : [])).toEqual([...cells].sort((a, b) => a - b));
  walls.clearTargetPreview();
  expect(texels().every(v => v === 0)).toBe(true);
  expect(Array.from(walls.mesh.geometry.getAttribute('color').array)).toEqual(colours);
  walls.dispose();
  world.jobs = [
    { id: 30, kind: 'wall', x: 2, z: 8, orientation: 0, footprint: 'standard', status: 'pending', reservedBy: null, progress: 0, escrow: { wood: 0, food: 0 } },
    { id: 31, kind: 'table', x: 5, z: 8, orientation: 0, footprint: 'standard', status: 'active', reservedBy: null, progress: 20, construction: 'frame', escrow: { wood: 0, food: 0 } },
  ];
  const plans: Placement[] = [];
  buildJobMarkers(world, new THREE.Group(), false, { set(_group: THREE.Group, _name: string, items: Placement[]) { plans.push(...items); } } as unknown as BoxBatches);
  expect(plans.length).toBeGreaterThan(5);
  expect(plans.every(part => part.targetId === 30 || part.targetId === 31)).toBe(true);
});

test('door leaves and connected timber restore exact colours after movement, cutaway and replacement', () => {
  const world = fixture();
  world.structures = [building(10, 'wall', 4), { ...building(11, 'door', 5), door: newDoorState(world.tick) }, building(12, 'wall', 6)];
  const doors = new DoorLayer(), timber = new TimberCladdingLayer();
  const referenceDoors = new DoorLayer(), referenceTimber = new TimberCladdingLayer();
  doors.update(world, false); timber.update(world, false);
  referenceDoors.update(world, false); referenceTimber.update(world, false);
  const initial = bits(doors.mesh.colorBuffer);
  doors.setTargetPreview(new Set([11])); timber.setTargetPreview(new Set([10, 11]));
  expect(bits(doors.mesh.colorBuffer)).not.toEqual(initial);
  world.structures[1]!.door!.open = true; world.structures[1]!.door!.changedAt++; world.structures[1]!.material = 'steel';
  doors.update(world, true); timber.update(world, true);
  referenceDoors.update(world, true); referenceTimber.update(world, true);
  doors.clearTargetPreview(); timber.clearTargetPreview();
  expect(bits(doors.mesh.colorBuffer)).toEqual(bits(referenceDoors.mesh.colorBuffer));
  expect(bits(timber.wallMesh.colorBuffer)).toEqual(bits(referenceTimber.wallMesh.colorBuffer));
  expect(bits(timber.eaveMesh.colorBuffer)).toEqual(bits(referenceTimber.eaveMesh.colorBuffer));
  expect(Array.from(doors.mesh.instanceMatrix.array)).toEqual(Array.from(referenceDoors.mesh.instanceMatrix.array));
  const restore = doors.prepareForCompile(); doors.setTargetPreview(new Set([11])); restore(); doors.clearTargetPreview();
  expect(bits(doors.mesh.colorBuffer)).toEqual(bits(referenceDoors.mesh.colorBuffer));
  doors.dispose(); timber.dispose(); referenceDoors.dispose(); referenceTimber.dispose();
});
