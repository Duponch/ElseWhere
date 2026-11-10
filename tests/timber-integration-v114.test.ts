import { expect, test } from 'vitest';
import * as THREE from 'three/webgpu';
import { createWorld } from '../src/sim/index';
import { BoxBatches } from '../src/render/BoxBatches';
import { buildFurniture } from '../src/render/FurnitureLayer';
import { WallLayer } from '../src/render/WallLayer';
import type { BoxMesh } from '../src/render/BoxMesh';

test('walls of every material are linked by one wall layer, never duplicated as furniture boxes', () => {
  const world = createWorld(14, 16, 16);
  world.structures = [
    { id: 1, kind: 'wall', x: 3, z: 4, orientation: 0, footprint: 'standard', material: 'wood' },
    { id: 2, kind: 'wall', x: 5, z: 4, orientation: 0, footprint: 'standard', material: 'steel' },
    { id: 3, kind: 'bed', x: 9, z: 9, orientation: 0, footprint: 'standard', material: 'wood' },
  ];
  const group = new THREE.Group();
  const boxes = new BoxBatches();
  const walls = new WallLayer();
  try {
    buildFurniture(world, group, false, boxes);
    walls.update(world, false);
    const furniture = () => (group.getObjectByName('furniture') as BoxMesh).activeCount;
    const bedParts = furniture();
    expect(bedParts).toBeGreaterThan(0);
    const separate = walls.triangles;
    expect(separate).toBeGreaterThan(0);

    // A steel wall between them: one linked run, still no furniture box.
    world.structures.push({ id: 4, kind: 'wall', x: 4, z: 4, orientation: 0, footprint: 'standard', material: 'steel' });
    buildFurniture(world, group, false, boxes);
    walls.update(world, false);
    expect(furniture()).toBe(bedParts);
    expect(walls.triangles).toBeLessThan(separate + 2 * 18);
  } finally {
    walls.dispose();
    boxes.dispose();
  }
});
