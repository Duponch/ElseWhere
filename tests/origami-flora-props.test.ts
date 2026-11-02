import { expect, test, vi } from 'vitest';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import * as THREE from 'three/webgpu';
import { PLANT_SPECIES } from '../src/sim/biome-flora';
import { footprintCells } from '../src/sim/definitions';
import type { Resource, Structure, World } from '../src/sim/types';
import { appendFlora, type FloraParts } from '../src/render/flora-presentation';
import { HYDROPONIC_SUPPORT_HEIGHT } from '../src/render/hydroponics-parts';
import type { Placement } from '../src/render/primitives';
import { SHELF_LEVELS } from '../src/render/shelf-presentation';
import {
  appendOrigamiFlora, appendUnboundOrigamiAcacia, createOrigamiFloraParts,
  createOrigamiGroundTuftGeometry, origamiFloraGeometries,
} from '../src/render/origami/flora';
import { origamiFurnitureParts, replaceOrigamiFurnitureParts } from '../src/render/origami/props';
import { GraphicsStyleContext, withGraphicsStyle } from '../src/render/graphics-style';
import { DEFAULT_GRAPHICS_STYLE_PREFERENCES } from '../src/ui3d/native-preferences';
import { ResourceLayer } from '../src/render/ResourceLayer';
import { PlantClusterLayer } from '../src/render/PlantClusterLayer';

// Deliberately small presentation input, not a generated/admitted simulation.
function world(seed = 123): World {
  return { seed, width: 32, height: 32, structures: [], growingZones: [] } as unknown as World;
}
function plant(species: Resource['species'] = 'oak', id = 41): Resource {
  return { id, kind: species === 'berry-bush' ? 'berries' : ['bush', 'moss', 'brambles'].includes(species ?? '') ? 'wild-plant' : 'tree',
    species, x: 8, z: 8, amount: 1, growth: 1 };
}
function structure(kind: Structure['kind'], id = 101, orientation: Structure['orientation'] = 0): Structure {
  return { id, kind, orientation, footprint: 'standard', material: 'wood', x: 8, z: 8 };
}
function authored(w: World, r: Resource, size = 1) {
  const parts = createOrigamiFloraParts();
  expect(appendOrigamiFlora(parts, w, r, .42, size)).toBe(true);
  return parts;
}

test('seeded forest silhouettes survive clone/reordering without simulation random reads or mutations', () => {
  const w = world(), r = plant(), snapshot = JSON.stringify({ w, r });
  const protectedWorld = new Proxy(w, { get(target, key, receiver) {
    if (typeof key === 'string' && /rng|random/i.test(key)) throw new Error('Presentation read simulation RNG');
    return Reflect.get(target, key, receiver);
  } });
  const first = authored(protectedWorld, r);
  authored(w, plant('pine', 333));
  expect(authored(structuredClone(w), structuredClone(r))).toEqual(first);
  expect(JSON.stringify({ w, r })).toBe(snapshot);
  expect(authored(world(124), r)).not.toEqual(first);
  expect(authored(w, { ...r, id: r.id + 1 })).not.toEqual(first);
  // Diversity concerns silhouette, not only a different key/color.
  const dimensions = (seed: number) => Object.values(authored(world(seed), r)).flat().map(p => [p.sx, p.sy, p.sz]);
  expect(dimensions(124)).not.toEqual(dimensions(123));
});

test('leafless and harvest masks can hide foliage/berries independently of the real trunk identity', () => {
  const w = world(), r = plant('oak'), parts = Object.values(authored(w, r)).flat();
  const winter = parts.filter(p => p.key === r.id), leaves = parts.filter(p => p.key === -r.id * 2);
  expect(winter.length).toBeGreaterThan(0); expect(leaves.length).toBeGreaterThan(0);
  expect(parts.every(p => p.targetId === r.id)).toBe(true);
  expect(parts.every(p => p.key === r.id || p.key === -r.id * 2)).toBe(true);
  const berry = plant('berry-bush', 57), bush = authored(w, berry);
  expect(bush.berry.length).toBeGreaterThan(0);
  expect(bush.berry.every(p => p.key === -berry.id * 2 - 1)).toBe(true);
  expect(Object.entries(bush).filter(([name]) => name !== 'berry').flatMap(([, p]) => p).every(p => p.key === -berry.id * 2)).toBe(true);
  expect(authored(w, plant('bush')).berry).toEqual([]);
});

test('growth rescales about the same physical root without changing branch/foliage identity', () => {
  const w = world(), r = plant('poplar'), grown = Object.values(authored(w, r, 1)).flat();
  const small = Object.values(authored(w, r, .25)).flat();
  expect(small.length).toBe(grown.length);
  for (let i = 0; i < small.length; i++) {
    const a = small[i]!, b = grown[i]!;
    expect(a.key).toBe(b.key); expect(a.ry).toBe(b.ry); expect(a.color).toBe(b.color);
    expect(a.x - r.x).toBeCloseTo((b.x - r.x) * .25, 12);
    expect(a.z - r.z).toBeCloseTo((b.z - r.z) * .25, 12);
    for (const field of ['y', 'sx', 'sy', 'sz'] as const) expect(a[field]).toBeCloseTo(b[field]! * .25, 12);
  }
});

test('unsupported medicinal plants retain the ordinary hydroponic support recipe', () => {
  const w = world(), medicinal: Resource = { id: 88, kind: 'healroot', x: 8, z: 8, amount: 1, growth: 1 };
  const empty = (): FloraParts => ({ trunks: [], crowns: [], cones: [], bushes: [], blades: [], cacti: [], fruit: [] });
  const ground = empty(); appendFlora(ground, w, medicinal, 0, 1);
  const basin = structure('hydroponics-basin');
  w.structures = [basin]; w.growingZones = [{ id: 102, basinId: basin.id, cells: footprintCells(basin).map(c => c.z * w.width + c.x), plant: 'healroot', allowSow: true, allowCut: true }];
  const custom = createOrigamiFloraParts();
  expect(appendOrigamiFlora(custom, w, medicinal, 0, 1)).toBe(false);
  expect(Object.values(custom).flat()).toEqual([]);
  const raised = empty(); appendFlora(raised, w, medicinal, 0, 1);
  expect(raised.bushes.length).toBeGreaterThan(0);
  for (let i = 0; i < raised.bushes.length; i++) expect(raised.bushes[i]!.y - ground.bushes[i]!.y).toBeCloseTo(HYDROPONIC_SUPPORT_HEIGHT, 12);
});

test('unmapped definitions fall through untouched and acacia exists only as an unbound visual asset', () => {
  const w = world(), parts = authored(w, plant('oak')), before = structuredClone(parts);
  for (const species of ['birch', 'drago', 'palm', 'glowstool', 'grass', 'tall-grass'] as const)
    expect(appendOrigamiFlora(parts, w, plant(species), 0, 1)).toBe(false);
  expect(appendOrigamiFlora(parts, w, { ...plant(), species: undefined }, 0, 1)).toBe(false);
  expect(parts).toEqual(before);
  expect(PLANT_SPECIES as readonly string[]).not.toContain('acacia');
  const asset = createOrigamiFloraParts(); appendUnboundOrigamiAcacia(asset, 0, 0);
  expect(Object.values(asset).flat().length).toBeGreaterThan(0);
  expect(Object.values(asset).flat().every(p => p.key === undefined && p.targetId === undefined)).toBe(true);
});

test('shared solid-card assets have finite positions/normals/UVs and grass roots stay on the ground', () => {
  const assets = origamiFloraGeometries(), grass = createOrigamiGroundTuftGeometry();
  try {
    for (const geo of [...Object.values(assets), grass]) {
      for (const field of ['position', 'normal', 'uv']) {
        const data = geo.getAttribute(field); expect(data).toBeDefined();
        expect(Array.from(data.array).every(Number.isFinite)).toBe(true);
      }
    }
    grass.computeBoundingBox();
    expect(grass.boundingBox!.min.y).toBeCloseTo(0, 7);
    expect(grass.boundingBox!.max.y).toBeCloseTo(1, 7);
    expect(grass.boundingBox!.max.z - grass.boundingBox!.min.z).toBeGreaterThan(0);
  } finally { Object.values(assets).forEach(g => g.dispose()); grass.dispose(); }
});

test('requested-key geometry builds allocate only used assets without unbound acacia shapes', () => {
  const assets = origamiFloraGeometries(['poplarFin']);
  try { expect(Object.keys(assets)).toEqual(['poplarFin']); }
  finally { Object.values(assets).forEach(g => g?.dispose()); }
});

test('resource integration retains two opaque sources and four batched reference companions, masks, wind and growth', () => {
  const w = world(), r = plant('oak'); w.resources = [r];
  const context = new GraphicsStyleContext({ ...DEFAULT_GRAPHICS_STYLE_PREFERENCES, style: 'origami' });
  const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true }); material.userData.rendererOwned = true;
  const group = new THREE.Group(), layer = withGraphicsStyle(context, () => new ResourceLayer(group, material));
  let leafless = false;
  const appearance = { read: (resource: Resource) => ({ size: resource.growth ?? 1, ripe: false, leafless }), harvestable: () => false };
  try {
    // Update occurs after leaving construction scope: the layer must retain it.
    layer.update(w, true, undefined, undefined, appearance);
    const meshes = (group.children[0] as THREE.Group).children as (THREE.Mesh|THREE.LineSegments)[];
    const surfaces=meshes.filter(mesh=>!mesh.userData.referenceCompanion);
    expect(surfaces).toHaveLength(2);expect(meshes).toHaveLength(6);
    expect(meshes.filter(mesh=>mesh instanceof THREE.Mesh&&(mesh.material as THREE.NodeMaterial).userData.origamiBrush)).toHaveLength(2);
    expect(meshes.filter(mesh=>mesh.userData.referenceCompanion==='wear')).toHaveLength(2);
    const canopy = surfaces.find(mesh => mesh.name === 'tree-canopy')!;
    expect(canopy.geometry.drawRange.count).toBeGreaterThan(0);
    for (const mesh of meshes) {
      expect(mesh.geometry.hasAttribute('windRoot')).toBe(true);
      expect(mesh.geometry.hasAttribute('windBasis')).toBe(true);
      expect(mesh.userData.resourceRanges).toBeDefined();
      // Original prism-face boundaries must survive chunk merging: cropping
      // them into a texture atlas interior would erase the kraft edge treatment.
      if(!mesh.userData.referenceCompanion){
        const faceUvs = Array.from(mesh.geometry.getAttribute('uv').array);
        expect(faceUvs).toContain(0); expect(faceUvs).toContain(1);
      }
      expect(mesh.geometry.getAttribute('origamiPaint').count).toBe(mesh.geometry.getAttribute('position').count);
    }
    const geometry = canopy.geometry, oldPositions = Array.from(geometry.getAttribute('position').array);
    r.growth = .5; layer.update(w, false, undefined, undefined, appearance);
    expect(canopy.geometry).toBe(geometry);
    expect(Array.from(geometry.getAttribute('position').array)).not.toEqual(oldPositions);
    leafless = true; layer.update(w, false, undefined, undefined, appearance);
    expect(canopy.geometry.drawRange.count).toBe(0);
    expect(surfaces.find(mesh => mesh !== canopy)!.geometry.drawRange.count).toBeGreaterThan(0);
    for(const mesh of meshes.filter(mesh=>mesh.name==='tree-canopy'))expect(mesh.geometry.drawRange.count).toBe(0);
    layer.setFoliageVisible(false);for(const mesh of meshes.filter(mesh=>mesh.name==='tree-canopy'))expect(mesh.visible).toBe(false);
  } finally { layer.dispose(); material.dispose(); context.dispose(); }
});

test('physical grass retains one resident surface with a matching Origami brush companion', () => {
  const context = new GraphicsStyleContext({ ...DEFAULT_GRAPHICS_STYLE_PREFERENCES, style: 'origami' });
  const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true });
  const folded = withGraphicsStyle(context, () => new PlantClusterLayer(material)), ordinary = new PlantClusterLayer(material);
  try {
    expect(folded.group.children).toHaveLength(2); expect(ordinary.group.children).toHaveLength(1);
    expect((folded.group.children[1] as THREE.Mesh).geometry.userData.origamiBrushPrebuilt).toBe(true);
    const foldedGeometry = (folded.group.children[0] as THREE.Mesh).geometry;
    const ordinaryGeometry = (ordinary.group.children[0] as THREE.Mesh).geometry;
    foldedGeometry.computeBoundingBox(); ordinaryGeometry.computeBoundingBox();
    expect(foldedGeometry.boundingBox!.max.y).toBeCloseTo(1, 7);
    expect(foldedGeometry.getAttribute('position').count).not.toBe(ordinaryGeometry.getAttribute('position').count);
  } finally { folded.dispose(); ordinary.dispose(); material.dispose(); context.dispose(); }
});

test('requested furniture kinds bind only real completed structure identities and preserve world state', () => {
  const w = world(); w.structures = ['bed', 'solar-generator', 'wood-generator', 'heater', 'table', 'stool', 'table-square', 'table-long', 'shelf', 'small-shelf']
    .map((kind, index) => structure(kind as Structure['kind'], 101 + index, index % 4 as Structure['orientation']));
  const before = structuredClone(w), parts = origamiFurnitureParts(w), ids = new Set(w.structures.map(s => s.id));
  for (const s of w.structures) expect(parts.some(p => p.targetId === s.id)).toBe(true);
  expect(parts.every(p => p.key === p.targetId && ids.has(p.targetId!))).toBe(true);
  expect(parts.every(p => [p.x, p.y, p.z, p.sx, p.sy, p.sz, p.ry].every(v => typeof v === 'number' && Number.isFinite(v)))).toBe(true);
  expect(origamiFurnitureParts({ ...w, structures: [structure('hospital-bed')] })).toEqual([]);
  expect(w).toEqual(before);
});

test.each([0, 1, 2, 3] as const)('three shelf boards still meet the real item support tiers, orientation %i', orientation => {
  const w = world(); w.structures = [structure('shelf', 101, orientation)];
  const boards = origamiFurnitureParts(w).filter(p => p.sy === .07);
  expect(boards.map(p => p.y + p.sy! / 2)).toEqual(SHELF_LEVELS);
  expect(boards.every(p => p.targetId === 101 && p.ry === orientation * Math.PI / 2)).toBe(true);
});

test('furniture replacement keeps unsupported/packed placement owners and real electrical connection leads', () => {
  const w = world(), heater = structure('heater'); w.structures = [heater, structure('wall', 102)];
  const oldHeater: Placement = { targetId: 101, x: 8, y: .56, z: 8, sx: .84, sy: .76, sz: .54 };
  const lead: Placement = { targetId: 101, x: 9, y: .065, z: 8, sx: .025, sy: .025, sz: 2 };
  const wall: Placement = { targetId: 102, x: 8, y: 1, z: 9 };
  const packed: Placement = { targetId: 777, x: 3, y: .24, z: 4 };
  const unowned: Placement = { x: 2, y: 0, z: 2 };
  const result = replaceOrigamiFurnitureParts(w, [oldHeater, lead, wall, packed, unowned]);
  expect(result).not.toContain(oldHeater);
  for (const preserved of [lead, wall, packed, unowned]) expect(result).toContain(preserved);
  expect(result.some(p => p.targetId === heater.id && p !== lead)).toBe(true);
});

test('medical bedding and appliance indicators follow the existing real status', () => {
  const w = world(), heater = structure('heater'), bed = structure('bed', 102);
  w.structures = [heater, bed];
  const off = origamiFurnitureParts(w);
  heater.power = { on: true, parentId: 66 }; bed.medical = true;
  const on = origamiFurnitureParts(w);
  const indicator = (p: Placement[]) => p.find(p => p.targetId === heater.id && p.sy === .22)!;
  expect(indicator(off).color).not.toBe(indicator(on).color);
  expect(on.some(p => p.targetId === bed.id && p.color === 0x91c2d2)).toBe(true);
  heater.power.switchOn = false;
  expect(indicator(origamiFurnitureParts(w)).color).toBe(indicator(off).color);
});
