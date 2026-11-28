import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { createWorld } from '../src/sim';
import { ANCIENT_MONUMENT_DEFS_256, isAncientMonumentKind256 } from '../src/sim/ancient-monument-props-256';
import { constructionMaterials } from '../src/sim/construction-materials';
import { JOB_DURATION, STRUCTURE_DEFINITIONS } from '../src/sim/definitions';
import { FLOOR_KINDS } from '../src/sim/flooring';
import { sowDaylily } from '../src/sim/flower-pot';
import type { Structure, StructureKind, World } from '../src/sim/types';
import { constructionPreviewParts, collectConstructionPreviewParts, type ConstructionPreviewSpec } from '../src/render/construction-preview-parts';
import { habitatParts } from '../src/render/habitat-parts';
import { biofuelParts } from '../src/render/biofuel-parts';
import { electricalParts } from '../src/render/electrical-parts';
import { doorLeafParts } from '../src/render/door-parts';
import { floorPartsForKind } from '../src/render/HygieneLayer';
import { roofSlabGeometry } from '../src/render/RoofLayer';
import { timberCladdingParts } from '../src/render/TimberCladdingLayer';
import { miniTurretTopPartsForStructure } from '../src/render/mini-turret-parts';
import { WIND_BLADE_SHAPE, windBladeHub, windBladeParts } from '../src/render/wind-blade-parts';
import { WORLD_SCALE } from '../src/world/scale';
import * as FurnitureBuilder from '../src/render/FurnitureLayer';
import {decorateFurniturePlacements} from '../src/render/furniture-surface-design';

function camp(): World {
  const world = createWorld(285, 20, 20);
  world.structures = []; world.packed = []; return world;
}
function structure(kind: StructureKind, x = 8, z = 8): Structure {
  return { id: 1, kind, x, z, orientation: 0, footprint: 'standard', material: constructionMaterials(kind)[0] };
}
// Ghosts author one virtual negative target id; saved source ids must not
// leak into preview highlighting. Compare the same geometry with that owner.
const keyed = (parts: readonly object[], key: number) => parts.map(part => ({ ...part, ...('targetId' in part&&typeof part.targetId==='number'&&part.targetId>=0?{targetId:-1}:{}), key }));

test('every constructible structure and installed sculpture has a complete model in every valid orientation', () => {
  const world = camp();
  // The physical catalogue also includes natural/recovery objects with no
  // construction job. The exhaustive JobKind table keeps all buildable kinds
  // and the finished sculptures whose installation also needs a preview.
  const kinds = (Object.keys(STRUCTURE_DEFINITIONS) as StructureKind[]).filter(kind => Object.hasOwn(JOB_DURATION, kind));
  expect(kinds).toEqual(expect.arrayContaining(['small-sculpture', 'large-sculpture']));
  for (const kind of kinds) for (const orientation of [0, 1, 2, 3] as const) {
    // Fixed ancient props cannot occur with a rotated physical footprint.
    // Exercise that refusal as well as every admitted orientation below.
    if (isAncientMonumentKind256(kind) && !ANCIENT_MONUMENT_DEFS_256[kind].rotatable && orientation !== 0) {
      expect(() => collectConstructionPreviewParts(world, [{ kind, x: 8, z: 8, orientation }]), `${kind}/${orientation}`).toThrow('Invalid ancient orientation');
      continue;
    }
    const parts = collectConstructionPreviewParts(world, [{ kind, x: 8, z: 8, orientation }]);
    expect(parts.length, `${kind}/${orientation}`).toBeGreaterThan(0);
    for (const part of parts) {
      expect([part.placement.x, part.placement.y, part.placement.z].every(Number.isFinite), kind).toBe(true);
      expect(part.placement.key).toBe(0);
    }
  }
  expect(() => constructionPreviewParts(world, [{ kind: 'unmodelled' as StructureKind, x: 1, z: 1 }])).toThrow('No construction model');
});

test('chair, long table and refinery previews retain the authored pieces, colours and rotated offsets', () => {
  const world = camp();
  for (const kind of ['dining-chair', 'table-long', 'biofuel-refinery'] as const) for (const orientation of [0, 1, 2, 3] as const) {
    const s = { ...structure(kind), orientation, material: 'steel' as const };
    const source = { ...world, structures: [s] };
    const reference = decorateFurniturePlacements(source,kind === 'biofuel-refinery' ? biofuelParts(source) : habitatParts(source));
    const preview = constructionPreviewParts(world, [{ ...s, key: 77 }]);
    expect(preview.boxes).toEqual(keyed(reference, 77));
    expect(reference.length).toBeGreaterThan(4);
  }
  const chair = constructionPreviewParts(world, [{ kind: 'dining-chair', x: 8, z: 8, material: 'wood' }]).boxes;
  expect(chair).toHaveLength(6);
  expect(chair.some(part => part.sy === .42 && part.z === 7.75)).toBe(true);
});

test('installation retains legacy footprint, original material and planted contents without changing any owner', () => {
  const world = camp();
  const bed: Structure = { ...structure('bed', 2, 3), id: 30, footprint: 'legacy-single', material: undefined, medical: true, quality: 'excellent' };
  const pot: Structure = { ...structure('flower-pot', 4, 3), id: 31, material: 'granite-blocks', flower: { allowSow: true, plant: { ...sowDaylily(0), growth: .75 } } };
  world.structures = [pot];
  world.packed = [{ building: bed, owner: { type: 'ground', x: 2, z: 3 } }];
  const before = structuredClone(world);
  const bedPreview = constructionPreviewParts(world, [{ kind: 'bed', x: 9, z: 9, orientation: 1, material: 'steel', furniture: bed }]);
  const frame = bedPreview.boxes.find(part => part.sy === WORLD_SCALE.bedFrameHeight)!;
  expect(frame).toMatchObject({ x: 9, z: 9, sz: .93, ry: Math.PI / 2 });
  expect(bedPreview.boxes.some(part => part.color === 0x639fe2)).toBe(true);
  const potPreview = constructionPreviewParts(world, [{ kind: 'flower-pot', x: 10, z: 11, material: 'steel', furniture: pot }]);
  expect(potPreview.boxes).toEqual(keyed(habitatParts({ ...world, structures: [{ ...pot, x: 10, z: 11 }] }), 0));
  expect(world).toEqual(before);
  expect(world.packed[0]!.building).toBe(bed);
});

test('separate valid and invalid subsets share actual and virtual conduit, timber and door neighbours', () => {
  const world = camp();
  world.structures = [{ ...structure('power-conduit', 3, 4), id: 40 }, { ...structure('wall', 6, 5), id: 41, material: 'wood' }];
  const specs: ConstructionPreviewSpec[] = [
    { key: 10, kind: 'power-conduit', x: 4, z: 4 }, { key: 11, kind: 'power-conduit', x: 5, z: 4 },
    { key: 12, kind: 'door', x: 6, z: 6, material: 'steel' }, { key: 13, kind: 'wall', x: 6, z: 7, material: 'wood' },
  ];
  const whole = constructionPreviewParts(world, specs);
  const first = constructionPreviewParts(world, [specs[0]!, specs[2]!], false, specs);
  const second = constructionPreviewParts(world, [specs[1]!, specs[3]!], false, specs);
  for (const field of ['boxes', 'timberWalls', 'timberEaves', 'rotatedBoxes'] as const) {
    expect(first[field]).toEqual(whole[field].filter(part => [10, 12].includes(part.key!)));
    expect(second[field]).toEqual(whole[field].filter(part => [11, 13].includes(part.key!)));
  }
  expect(first.boxes.filter(part => part.key === 10)).toHaveLength(3); // Centre and both real/virtual leads.
  const virtual: Structure[] = specs.map((spec, i) => ({ ...structure(spec.kind as StructureKind, spec.x, spec.z), id: -i - 1, material: spec.material ?? constructionMaterials(spec.kind)[0] }));
  const context = { ...world, structures: [...world.structures, ...virtual] };
  expect(first.boxes.filter(part => part.key === 10)).toEqual(keyed(electricalParts(context, false, [virtual[0]!]), 10));
  expect(first.boxes.filter(part => part.key === 12).slice(-2)).toEqual(keyed(doorLeafParts(context, false, [virtual[2]!]), 12));
  const timber = timberCladdingParts(context, false, [virtual[2]!, virtual[3]!]);
  expect(whole.timberWalls).toEqual(timber.walls.map(part => ({ ...part, key: specs[-part.key! - 1]!.key })));
});

test('floor ghosts use the finished plank/tile shapes and roof ghosts meet the actual slab contour at full height', () => {
  const world = camp();
  for (const floor of FLOOR_KINDS) {
    const parts = constructionPreviewParts(world, [{ kind: 'lay-floor', floor, x: 4, z: 5 }]);
    expect(parts.boxes).toEqual(keyed(floorPartsForKind(floor, 4, 5), 0));
  }
  expect(() => constructionPreviewParts(world, [{ kind: 'lay-floor', x: 4, z: 5 }])).toThrow('requires a floor kind');
  const specs: ConstructionPreviewSpec[] = [{ kind: 'build-roof', x: 4, z: 5 }, { kind: 'build-roof', x: 5, z: 5 }];
  const parts = constructionPreviewParts(world, specs, true).boxes;
  const geometry = roofSlabGeometry(specs, WORLD_SCALE.wallHeight + .08);
  geometry.computeBoundingBox();
  const min = [Math.min(...parts.map(p => p.x - p.sx! / 2)), Math.min(...parts.map(p => p.y - p.sy! / 2)), Math.min(...parts.map(p => p.z - p.sz! / 2))];
  const max = [Math.max(...parts.map(p => p.x + p.sx! / 2)), Math.max(...parts.map(p => p.y + p.sy! / 2)), Math.max(...parts.map(p => p.z + p.sz! / 2))];
  min.forEach((value, i) => expect(value).toBeCloseTo(geometry.boundingBox!.min.toArray()[i]!));
  max.forEach((value, i) => expect(value).toBeCloseTo(geometry.boundingBox!.max.toArray()[i]!));
  expect(parts[0]!.x + parts[0]!.sx! / 2).toBeCloseTo(parts[1]!.x - parts[1]!.sx! / 2);
  geometry.dispose();
});

test('wind blades follow the retained shader transform and mini turret includes its complete gun head', () => {
  const world = camp(), s = { ...structure('wind-turbine'), orientation: 3 as const };
  const parts = windBladeParts(s, .4), hub = windBladeHub(s);
  parts.forEach((part, index) => {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(hub.x, hub.y, hub.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hub.ry, 0)), new THREE.Vector3(1, 1, 1));
    const angle = .4 + index * Math.PI * 2 / 3;
    const shaderCenter = new THREE.Vector3(-Math.sin(angle) * WIND_BLADE_SHAPE.offsetY, Math.cos(angle) * WIND_BLADE_SHAPE.offsetY, 0).applyMatrix4(transform);
    [part.x, part.y, part.z].forEach((value, axis) => expect(value).toBeCloseTo(shaderCenter.toArray()[axis]!));
  });
  const wind = constructionPreviewParts(world, [{ kind: 'wind-turbine', x: 8, z: 8, orientation: 3 }]);
  expect(wind.rotatedBoxes).toHaveLength(3); expect(wind.boxes).toHaveLength(7);
  const gun = constructionPreviewParts(world, [{ kind: 'mini-turret', x: 8, z: 8 }]);
  expect(gun.boxes).toHaveLength(21);
  expect(gun.boxes.slice(-18)).toEqual(keyed(miniTurretTopPartsForStructure(structure('mini-turret')), 0));
});

test('previewing furniture never enumerates or copies the map or material piles', () => {
  const world = camp(), before = structuredClone(world);
  const forbidIteration = <T>(array: T[]): T[] => new Proxy(array, { get(target, property, receiver) {
    if (property === Symbol.iterator || ['map', 'slice', 'forEach', 'filter'].includes(String(property))) throw new Error('Map/pile enumeration');
    return Reflect.get(target, property, receiver);
  } });
  const view = { ...world, tiles: forbidIteration(world.tiles), piles: forbidIteration(world.piles) };
  expect(constructionPreviewParts(view, [{ kind: 'dining-chair', x: 8, z: 8 }]).boxes).toHaveLength(6);
  expect(world).toEqual(before);
});

test('a 250-cell construction line captures one real furniture batch for all subjects', () => {
  const world = createWorld(285, 250, 20); world.structures = []; world.packed = [];
  const specs: ConstructionPreviewSpec[] = Array.from({ length: 250 }, (_, i) => ({ key: i, kind: 'power-conduit', x: i, z: 8 }));
  const capture = vi.spyOn(FurnitureBuilder, 'buildFurniture');
  try {
    const parts = constructionPreviewParts(world, specs);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0].structures).toHaveLength(250);
    expect(parts.boxes.filter(part => part.key === 0)).toHaveLength(2);
    expect(parts.boxes.filter(part => part.key === 125)).toHaveLength(3);
    expect(parts.boxes.filter(part => part.key === 249)).toHaveLength(2);
  } finally { capture.mockRestore(); }
});
