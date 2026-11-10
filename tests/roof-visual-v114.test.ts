import { expect, test } from 'vitest';
import { BoxBatches } from '../src/render/BoxBatches';
import { RoofLayer, roofSlabGeometry, roofSurfaceCells } from '../src/render/RoofLayer';
import { createWorld } from '../src/sim/index';
import { newDoorState } from '../src/sim/door-rules';
import { WORLD_SCALE } from '../src/world/scale';

function timberRoom() {
  const world = createWorld(42, 16, 16);
  world.tiles = world.tiles.map(() => ({ terrain: 'grass' })); world.structures = [];
  for (let z = 5; z <= 9; z++) for (let x = 5; x <= 9; x++) {
    if (x !== 5 && x !== 9 && z !== 5 && z !== 9) continue;
    if (x === 7 && z === 9) world.structures.push({ id: world.nextId++, kind: 'door', material: 'steel', x, z, orientation: 0, footprint: 'standard', door: newDoorState(world.tick) });
    else world.structures.push({ id: world.nextId++, kind: 'wall', material: 'wood', x, z, orientation: 0, footprint: 'standard' });
  }
  world.roofing = { constructed: [], build: [], remove: [], cursor: 0 };
  for (let z = 6; z <= 8; z++) for (let x = 6; x <= 8; x++) world.roofing.constructed.push(z * world.width + x);
  return world;
}

test('the roof forms one full-height surface across the opening, wall tops, doorway and corners', () => {
  const world = timberRoom(), original = JSON.stringify(world.roofing);
  const cells = roofSurfaceCells(world);
  expect(cells).toHaveLength(25);
  expect(cells.some(c => c.x === 7 && c.z === 9)).toBe(true);
  const top = WORLD_SCALE.wallHeight + .08;
  const geometry = roofSlabGeometry(cells, top), positions = geometry.getAttribute('position');
  const upper = Array.from({ length: positions.count }, (_, i) => positions.getY(i)).filter(y => Math.abs(y - top) < 1e-6);
  expect(upper.length).toBeGreaterThanOrEqual(cells.length * 6);
  expect(Math.max(...upper) - Math.min(...upper)).toBe(0);
  const lower = Array.from({ length: positions.count }, (_, i) => positions.getY(i)).filter(y => y < top - .01);
  expect(Math.min(...lower)).toBeCloseTo(top - .31);
  expect(JSON.stringify(world.roofing)).toBe(original);
  geometry.dispose();
});

test('one resident slab mesh rebuilds only when roof topology or cutaway changes; plain mode has no map', () => {
  const world = timberRoom(), batches = new BoxBatches(), layer = new RoofLayer();
  layer.update(world, batches);
  const mesh = layer.mesh, geometry = mesh.geometry;
  expect(mesh.visible).toBe(true);
  expect(layer.surface.children).toEqual([mesh]);
  layer.update(world, batches); expect(mesh.geometry).toBe(geometry);
  layer.setTexturesEnabled(false);
  expect(mesh.material).toBe(layer.plain);
  expect(layer.plain.map).toBeNull();
  expect(mesh.geometry).toBe(geometry);
  layer.update(world, batches, true);
  expect(mesh.geometry).not.toBe(geometry);
  // The eave line (lowest point of the pitched top) follows the cut walls.
  const p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal');
  const eave = Math.min(...Array.from({ length: p.count }, (_, i) => n.getY(i) > .5 ? p.getY(i) : Infinity));
  expect(eave).toBeCloseTo(WORLD_SCALE.wallCutawayHeight + .08);
  layer.setTexturesEnabled(true); expect(mesh.material).toBe(layer.textured);
  world.roofing!.constructed = [];
  layer.update(world, batches, false);
  expect(mesh.visible).toBe(false);
  const restore = layer.prepare(); expect(mesh.visible).toBe(true); restore(); expect(mesh.visible).toBe(false);
  const restoreDuringAdoption=layer.prepare();
  world.roofing!.constructed=[7*world.width+7];
  layer.update(world,batches);
  const adopted=mesh.geometry;
  restoreDuringAdoption();
  expect(mesh.geometry).toBe(adopted);
  expect(mesh.visible).toBe(true);
  layer.dispose(); batches.dispose();
});
