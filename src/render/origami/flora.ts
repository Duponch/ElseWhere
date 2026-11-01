import * as THREE from 'three/webgpu';
import type { Resource, World } from '../../sim/types';
import { BLIGHT_COLOR, floraTreeHeight, hydroponicFloraHeight } from '../flora-presentation';
import type { Placement } from '../primitives';

/** A fixed geometry vocabulary, merged into the existing two resource meshes.
 * Geometries are transient build inputs: mergedInstances owns their disposal.
 * No scene graph, material, random generator or simulation object is retained.
 */
export const ORIGAMI_FLORA_KEYS = [
  'trunk', 'oakBranchA', 'oakBranchB', 'oakBranchC',
  'oakPuffA', 'oakPuffB', 'oakPuffC', 'oakPuffD', 'oakPuffE',
  'poplarA', 'poplarB', 'poplarC', 'poplarD', 'poplarFin',
  'pineTier', 'pineTip', 'cactusStem', 'cactusArm', 'flower',
  'bushMound', 'bushCrest', 'berry', 'box',
  'acaciaBase', 'acaciaMain', 'acaciaSide', 'acaciaHigh', 'acaciaCanopy',
] as const;
export type OrigamiFloraKey = typeof ORIGAMI_FLORA_KEYS[number];
export type OrigamiFloraParts = Record<OrigamiFloraKey, Placement[]>;
export const ORIGAMI_FLORA_CANOPY_KEYS: ReadonlySet<OrigamiFloraKey> = new Set([
  'oakPuffA', 'oakPuffB', 'oakPuffC', 'oakPuffD', 'oakPuffE',
  'poplarA', 'poplarB', 'poplarC', 'poplarD', 'poplarFin', 'pineTier', 'pineTip', 'acaciaCanopy',
]);
export function createOrigamiFloraParts(): OrigamiFloraParts {
  return Object.fromEntries(ORIGAMI_FLORA_KEYS.map(key => [key, []])) as unknown as OrigamiFloraParts;
}

function prism(topX: number, topZ: number, bottomX: number, bottomZ: number, height: number,
  shearX = 0, shearZ = 0): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, height, 1), position = box.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const top = position.getY(i) > 0;
    position.setX(i, position.getX(i) * (top ? topX : bottomX) + (top ? shearX : 0));
    position.setZ(i, position.getZ(i) * (top ? topZ : bottomZ) + (top ? shearZ : 0));
  }
  const geometry = box.toNonIndexed(); box.dispose(); geometry.computeVertexNormals(); return geometry;
}
function cutout(points: readonly (readonly [number, number])[], thickness: number, center = true): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const source = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1 });
  if (center) source.center(); else source.translate(0, 0, -thickness / 2);
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  geometry.computeVertexNormals(); return geometry;
}
function rotated(geometry: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  return geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z)));
}

export function origamiFloraGeometries(): Record<OrigamiFloraKey, THREE.BufferGeometry>;
export function origamiFloraGeometries(keys: readonly OrigamiFloraKey[]): Partial<Record<OrigamiFloraKey, THREE.BufferGeometry>>;
export function origamiFloraGeometries(keys: readonly OrigamiFloraKey[] = ORIGAMI_FLORA_KEYS): Partial<Record<OrigamiFloraKey, THREE.BufferGeometry>> {
  const oakPuff = () => prism(.76, .76, .86, .86, .88, .04, .04);
  const branch = () => prism(.16, .16, .24, .24, .72);
  const factories: Record<OrigamiFloraKey, () => THREE.BufferGeometry> = {
    trunk: () => prism(.64, .64, 1, 1, 1),
    oakBranchA: () => rotated(branch(), .2, 0, .62), oakBranchB: () => rotated(branch(), -.25, 0, -.58),
    oakBranchC: () => rotated(branch(), .55, 0, -.12),
    oakPuffA: () => rotated(oakPuff(), .1, .3, 0), oakPuffB: () => rotated(oakPuff(), 0, .8, .15),
    oakPuffC: () => rotated(oakPuff(), -.12, .5, -.1), oakPuffD: () => rotated(oakPuff(), .2, -.4, 0),
    oakPuffE: () => rotated(oakPuff(), -.15, .2, .1),
    poplarA: () => prism(.72, .72, .52, .52, .78), poplarB: () => prism(.66, .66, .78, .78, .82),
    poplarC: () => prism(.46, .46, .68, .68, .78), poplarD: () => prism(.12, .12, .48, .48, .64),
    poplarFin: () => cutout([[0, -1.1], [.46, -.65], [.34, -.15], [.48, .35], [.28, .85], [0, 1.25]], .055),
    pineTier: () => new THREE.CylinderGeometry(.34, 1, 1, 6), pineTip: () => new THREE.CylinderGeometry(.09, 1, 1, 6),
    cactusStem: () => new THREE.CylinderGeometry(.24, .28, 2.25, 6),
    cactusArm: () => prism(.24, .24, .26, .26, 1), flower: () => prism(.22, .22, .10, .10, .16),
    bushMound: () => prism(.8, .8, 1, 1, 1),
    bushCrest: () => cutout([[-.45, 0], [-.32, .32], [-.12, .08], [0, .42], [.14, .10], [.36, .34], [.45, 0]], .045),
    berry: () => rotated(new THREE.BoxGeometry(.095, .095, .095), .3, .5, .2), box: () => new THREE.BoxGeometry(1, 1, 1),
    acaciaBase: () => prism(.26, .26, .38, .38, 1.25, .14, .04),
    acaciaMain: () => prism(.18, .18, .24, .24, 1.20, .42, .08),
    acaciaSide: () => prism(.15, .15, .20, .20, .95, -.58, -.14),
    acaciaHigh: () => prism(.14, .14, .18, .18, .75, -.28, .38),
    acaciaCanopy: () => prism(.85, .85, 1, 1, 1),
  };
  return Object.fromEntries([...new Set(keys)].map(key => [key, factories[key]()]));
}

/** Exact reference tuft outline, with its base at local Y=0 and normalized
 * height 1 for the existing grass instance transforms. Solid card thickness
 * avoids alpha sorting and adds no per-tuft mesh/material allocation.
 */
export function createOrigamiGroundTuftGeometry(): THREE.BufferGeometry {
  const geometry = cutout([[-.22, 0], [-.28, .38], [-.10, .06], [-.04, .48], [.06, .06], [.24, .42], [.20, 0]], .025, false);
  geometry.scale(1.35, 1 / .48, 1);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

/** Visual hashing only. Unlike the randomized HTML showcase this is stable
 * across reloads/chunk rebuilds and never touches World.rng or Math.random.
 */
function variation(seed: number, id: number, salt: number): number {
  let word = Math.imul(seed ^ salt, 374761393) ^ Math.imul(id, 668265263);
  word = Math.imul(word ^ word >>> 13, 1274126177);
  return ((word ^ word >>> 16) >>> 0) / 4294967296;
}
function tone(hex: number, factor: number): number {
  return (Math.min(255, Math.round((hex >>> 16) * factor)) << 16)
    | (Math.min(255, Math.round((hex >>> 8 & 255) * factor)) << 8)
    | Math.min(255, Math.round((hex & 255) * factor));
}
type Add = (key: OrigamiFloraKey, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, color: number, rotation?: number, identity?: number) => void;

/** Bound mappings are exact definition IDs, never guessed names. Absent
 * species (including acacia) and all other plants return false for the existing
 * renderer. Grass/tall-grass stay owned by PlantClusterLayer.
 */
export function appendOrigamiFlora(parts: OrigamiFloraParts, world: World, r: Resource,
  turn: number, size: number): boolean {
  const species = r.species;
  const tree = r.kind === 'tree' && (species === 'oak' || species === 'poplar' || species === 'pine' || species === 'saguaro');
  const shrub = species === 'berry-bush' || species === 'bush';
  const ground = species === 'moss' || species === 'brambles' || species === 'low-shrub' || species === 'chokevine' || species === 'astragalus' || species === 'dandelion';
  if (!tree && !shrub && !ground) return false;
  const seed = world.seed, height = .92 + variation(seed, r.id, 103) * .16;
  const width = .89 + variation(seed, r.id, 229) * .22;
  const tint = .94 + variation(seed, r.id, 541) * .12;
  const referenceHeight = species === 'poplar' ? 3.64 : species === 'pine' ? 3.40 : species === 'saguaro' ? 2.36 : 2.64;
  const scale = size * (tree ? floraTreeHeight(r) / referenceHeight : species === 'moss' ? .10 : ground ? .35 : .83);
  const support = hydroponicFloraHeight(world, r), cosine = Math.cos(turn), sine = Math.sin(turn);
  const leaves = -r.id * 2, fruit = leaves - 1;
  const add: Add = (key, dx, y, dz, sx, sy, sz, color, rotation = 0, identity = leaves) => {
    const lx = dx * width * scale, lz = dz * width * scale;
    parts[key].push({ key: identity, targetId: r.id, x: r.x + lx * cosine + lz * sine,
      y: support + y * scale * height, z: r.z + lz * cosine - lx * sine,
      sx: sx * width * scale, sy: sy * height * scale, sz: sz * width * scale,
      ry: turn + rotation, color: r.blight ? BLIGHT_COLOR : tone(color, tint) });
  };
  const bark = 0x5e432d;
  if (species === 'poplar') {
    add('trunk', 0, .65, 0, .30, 1.35, .30, bark, 0, r.id);
    const tiers = ['poplarA', 'poplarB', 'poplarC', 'poplarD'] as const;
    const ys = [1.35, 2.02, 2.72, 3.32];
    tiers.forEach((key, i) => add(key, 0, ys[i]!, 0, 1, 1, 1, 0x6d8c3a, i * .45));
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + .35;
      add('poplarFin', Math.cos(angle) * .22, 2.25, Math.sin(angle) * .22, 1, 1, 1, 0x6d8c3a, -angle);
    }
  } else if (species === 'oak') {
    add('trunk', 0, .70, 0, .56, 1.45, .56, bark, 0, r.id);
    add('oakBranchA', -.32, 1.42, .12, 1, 1, 1, bark, 0, r.id);
    add('oakBranchB', .34, 1.38, -.14, 1, 1, 1, bark, 0, r.id);
    add('oakBranchC', .04, 1.46, .28, 1, 1, 1, bark, 0, r.id);
    add('oakPuffA', 0, 2.18, 0, 1.35, .92, 1.28, 0x486b2f);
    add('oakPuffB', -.68, 1.88, .24, .92, .72, .88, 0x486b2f);
    add('oakPuffC', .66, 1.84, -.22, .95, .74, .90, 0x486b2f);
    add('oakPuffD', .12, 1.92, .62, .85, .68, .82, 0x486b2f);
    add('oakPuffE', -.18, 1.95, -.58, .88, .70, .84, 0x486b2f);
  } else if (species === 'pine') {
    add('trunk', 0, .55, 0, .36, 1.15, .36, bark, 0, r.id);
    for (const [i, tier] of [[1.22, 1.12, .92], [1.86, .92, .86], [2.46, .68, .78], [3.04, .44, .72]].entries())
      add(i === 3 ? 'pineTip' : 'pineTier', 0, tier[0]!, 0, tier[1]!, tier[2]!, tier[1]!, 0x294f3a, i * .42);
  } else if (species === 'saguaro') {
    add('cactusStem', 0, 1.10, 0, 1, 1, 1, 0x4e7846, 0, r.id);
    add('box', -.32, .95, 0, .46, .26, .26, 0x4e7846, 0, r.id);
    add('cactusArm', -.48, 1.38, 0, 1, .76, 1, 0x4e7846, 0, r.id);
    add('box', .34, 1.28, 0, .48, .26, .26, 0x4e7846, 0, r.id);
    add('cactusArm', .50, 1.74, 0, 1, .84, 1, 0x4e7846, 0, r.id);
    add('flower', 0, 2.28, 0, 1, 1, 1, 0xd99b8e, .4);
  } else {
    const green = species === 'dandelion' ? 0xc6b567 : species === 'astragalus' ? 0xb2a6bd : 0x3f632b;
    add('bushMound', 0, .36, 0, .78, .68, .78, green, .2);
    add('bushMound', -.38, .28, .18, .58, .52, .58, green, .75);
    add('bushMound', .36, .26, -.14, .56, .48, .56, green, -.55);
    add('bushMound', .06, .24, .36, .50, .44, .50, green, 1.1);
    if (species !== 'moss') {
      add('bushCrest', 0, .68, 0, 1, 1, 1, green, .4);
      add('bushCrest', 0, .68, 0, 1, 1, 1, green, 1.97);
    }
    if (r.kind === 'berries') for (const [dx, y, dz] of [[-.22, .52, .32], [.24, .48, .26], [.05, .64, -.28], [-.44, .38, -.12], [.42, .36, -.22], [.16, .34, .52]])
      add('berry', dx!, y!, dz!, 1, 1, 1, 0xc43b2d, 0, fruit);
  }
  return true;
}

/** Reference-only acacia asset. There is no acacia simulation definition, so
 * appendOrigamiFlora never selects it or aliases the existing drago species.
 */
export function appendUnboundOrigamiAcacia(parts: OrigamiFloraParts, x: number, z: number,
  scale = 1, rotation = 0): void {
  const cosine = Math.cos(rotation), sine = Math.sin(rotation);
  const add = (key: OrigamiFloraKey, dx: number, y: number, dz: number, sx = 1, sy = 1, sz = 1, color = 0x5e432d, ry = 0): void => {
    parts[key].push({ x: x + (dx * cosine + dz * sine) * scale, y: y * scale,
      z: z + (dz * cosine - dx * sine) * scale, sx: sx * scale, sy: sy * scale, sz: sz * scale, ry: rotation + ry, color });
  };
  add('acaciaBase', 0, .60, 0); add('acaciaMain', .22, 1.72, .04);
  add('acaciaSide', -.14, 1.52, -.06); add('acaciaHigh', .12, 1.88, .18);
  add('acaciaCanopy', .58, 2.34, .10, 1.95, .28, 1.72, 0x788a36, .25);
  add('acaciaCanopy', -.68, 1.98, -.18, 1.48, .24, 1.35, 0x788a36, -.4);
  add('acaciaCanopy', -.12, 2.58, .52, 1.32, .22, 1.22, 0x788a36, .65);
}
