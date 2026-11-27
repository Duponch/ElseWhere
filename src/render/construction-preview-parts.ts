import * as THREE from 'three/webgpu';
import { constructionMaterials, type ConstructionMaterial } from '../sim/construction-materials';
import { STRUCTURE_DEFINITIONS } from '../sim/definitions';
import { isFloorKind, type FloorKind } from '../sim/flooring';
import type { Orientation, Structure, StructureKind, World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import type { BoxBatches } from './BoxBatches';
import { buildFurniture } from './FurnitureLayer';
import { floorPartsForKind } from './HygieneLayer';
import { bridgePartsForCell } from './bridge-parts';
import { roofSlabCellBounds, roofSurfaceCells } from './RoofLayer';
import { timberCladdingParts } from './TimberCladdingLayer';
import { doorLeafParts } from './door-parts';
import { miniTurretTopPartsForStructure } from './mini-turret-parts';
import type { Placement } from './primitives';
import { windBladeParts } from './wind-blade-parts';
import { buildingMaterialColor } from './building-material-color';
import { MASONRY_FALLBACK, masonryCapColor, WALL_CAP_HEIGHT } from './wall-network';
import {isWallAppliance,wallApplianceSurroundMaterial,WALL_APPLIANCE_BOTTOM,WALL_APPLIANCE_TOP} from './wall-appliance';

export { createTimberGeometry } from './TimberCladdingLayer';

export interface ConstructionPreviewSpec {
  key?: number;
  kind: StructureKind | 'lay-floor' | 'build-roof' | 'build-bridge' | 'remove-bridge';
  x: number; z: number;
  orientation?: Orientation;
  material?: ConstructionMaterial;
  floor?: FloorKind;
  /** An installation retains its authored material, footprint and contents. */
  furniture?: Structure | null;
  /** A placed construction keeps the footprint of its job (legacy beds). */
  footprint?: Structure['footprint'];
}

export type ConstructionPreviewPlacement = Placement & { rx?: number; rz?: number; tint?: number };
export interface ConstructionPreviewParts {
  boxes: ConstructionPreviewPlacement[];
  timberWalls: ConstructionPreviewPlacement[];
  timberEaves: ConstructionPreviewPlacement[];
  rotatedBoxes: ConstructionPreviewPlacement[];
}
export type ConstructionPreviewPart = {
  geometry: 'box' | 'timber-wall' | 'timber-eave' | 'sandbag';
  placement: ConstructionPreviewPlacement;
};

function virtualStructure(spec: ConstructionPreviewSpec, id: number): Structure {
  if (!Object.hasOwn(STRUCTURE_DEFINITIONS, spec.kind)) throw new Error(`No construction model for ${spec.kind}`);
  if (spec.furniture && spec.furniture.kind !== spec.kind) throw new Error('Installation model kind differs from its furniture');
  const kind = spec.kind as StructureKind;
  return {
    ...spec.furniture,
    id, kind, x: spec.x, z: spec.z,
    orientation: spec.orientation ?? spec.furniture?.orientation ?? 0,
    footprint: spec.furniture?.footprint ?? spec.footprint ?? 'standard',
    // The current construction selector must not recolour a packed object.
    material: spec.furniture ? spec.furniture.material : spec.material ?? defaultMaterial(kind),
  };
}
/** First allowed material of a kind (static catalogue), read once per kind. */
const defaultMaterials = new Map<StructureKind, ConstructionMaterial | undefined>();
function defaultMaterial(kind: StructureKind): ConstructionMaterial | undefined {
  if (!defaultMaterials.has(kind)) defaultMaterials.set(kind, constructionMaterials(kind)[0]);
  return defaultMaterials.get(kind);
}

/** Read the actual authored builders through their set port. The small subject
 * view shares the map, inventories and clocks; only its structure list and
 * packed-parcel render subjects differ. Neighbours remain in contextWorld. */
export function constructionPreviewParts(world: World, specs: readonly ConstructionPreviewSpec[], cutaway = false,
  contextSpecs: readonly ConstructionPreviewSpec[] = specs): ConstructionPreviewParts {
  const result: ConstructionPreviewParts = { boxes: [], timberWalls: [], timberEaves: [], rotatedBoxes: [] };
  if (!specs.length) return result;
  const all = [...contextSpecs], included = new Set(all);
  for (const spec of specs) if (!included.has(spec)) { all.push(spec); included.add(spec); }
  const ordinals = new Map(all.map((spec, index) => [spec, index]));
  const virtuals = new Map<ConstructionPreviewSpec, Structure>(), keys = new Map<number, number>();
  for (let index = 0; index < all.length; index++) {
    const spec = all[index]!;
    if (spec.kind === 'lay-floor' || spec.kind === 'build-roof' || spec.kind === 'build-bridge' || spec.kind === 'remove-bridge') continue;
    const structure = virtualStructure(spec, -index - 1);
    virtuals.set(spec, structure); keys.set(structure.id, spec.key ?? index);
  }
  const moving = new Set(all.flatMap(spec => spec.furniture ? [spec.furniture.id] : []));
  const contextWorld: World = { ...world, structures: [
    ...world.structures.filter(s => !moving.has(s.id)), ...virtuals.values(),
  ] };
  const subjects = specs.flatMap(spec => virtuals.has(spec) ? [virtuals.get(spec)!] : []);
  const timber = timberCladdingParts(contextWorld, cutaway, subjects);
  result.timberWalls = timber.walls.map(part => ({ ...part, key: keys.get(part.key!)! }));
  result.timberEaves = timber.eaves.map(part => ({ ...part, key: keys.get(part.key!)! }));

  const group = new THREE.Group();
  const captureFurniture = (renderSubjects: Structure[]): Placement[] => {
    const subjectWorld: World = { ...contextWorld, structures: renderSubjects, packed: [] };
    const authored=new Map<string,Placement[]>();
    const sink: Pick<BoxBatches, 'set'> = { set(_group, name, parts) {
      if ((name !== 'furniture'&&name!=='sandbags')||authored.has(name)) throw new Error('Unexpected construction furniture batch');
      authored.set(name,parts);
    } };
    buildFurniture(subjectWorld, group, cutaway, sink as BoxBatches, contextWorld);
    if (!authored.has('furniture')||!authored.has('sandbags')) throw new Error('Construction builder produced no furniture batch');
    return [...authored.get('furniture')!,...authored.get('sandbags')!];
  };
  // Lines contain mono-cellular objects. Their authored pieces remain within
  // the owning cell, so one capture can retain the preview key by its anchor.
  // Context indexes (conduits, boundary axes, frames) are built once per line.
  const linearSubjects = subjects.filter(s => s.kind === 'wall' || s.kind === 'fence' || s.kind === 'power-conduit');
  const lineModels = new Map<number, Placement[]>();
  if (linearSubjects.length) {
    const byCell = new Map(linearSubjects.map(s => [`${s.x}:${s.z}`, s.id]));
    for (const s of linearSubjects) lineModels.set(s.id, []);
    for (const part of captureFurniture(linearSubjects)) {
      const id = part.key !== undefined && lineModels.has(part.key) ? part.key : byCell.get(`${Math.round(part.x)}:${Math.round(part.z)}`);
      if (id === undefined) throw new Error('Construction line part has no owning cell');
      lineModels.get(id)!.push(part);
    }
  }
  for (const spec of specs) {
    const key = spec.key ?? ordinals.get(spec)!;
    if (spec.kind === 'build-bridge' || spec.kind === 'remove-bridge') {
      result.boxes.push(...bridgePartsForCell(spec.x,spec.z).map(part=>({...part,key})));
      if(spec.kind==='remove-bridge')for(const ry of [-Math.PI/4,Math.PI/4])result.boxes.push({x:spec.x,z:spec.z,y:.09,sx:.85,sy:.025,sz:.045,ry,color:0xd77855,key});
      continue;
    }
    if (spec.kind === 'lay-floor') {
      if (!isFloorKind(spec.floor)) throw new Error('Construction floor model requires a floor kind');
      result.boxes.push(...floorPartsForKind(spec.floor, spec.x, spec.z).map(part => ({ ...part, key })));
      continue;
    }
    if (spec.kind === 'build-roof') continue;
    const structure = virtuals.get(spec)!;
    const linear = lineModels.get(structure.id);
    const parts: Placement[] = linear ? [...linear, ...masonryWallParts(structure, cutaway,contextWorld)] : [...captureFurniture([structure]), ...doorLeafParts(contextWorld, cutaway, [structure]),...masonryWallParts(structure,cutaway,contextWorld)];
    if (structure.kind === 'mini-turret') parts.push(...miniTurretTopPartsForStructure(structure));
    if (structure.kind === 'wind-turbine') result.rotatedBoxes.push(...windBladeParts(structure).map(part => ({ ...part, key })));
    result.boxes.push(...parts.map(part => ({ ...part, key })));
    if (!parts.length && !timber.walls.some(part => part.key === structure.id)) throw new Error(`Empty construction model for ${spec.kind}`);
  }

  const roofs = specs.filter(spec => spec.kind === 'build-roof');
  if (roofs.length) {
    const constructed = new Set(world.roofing?.constructed ?? []);
    for (const spec of all) if (spec.kind === 'build-roof') constructed.add(spec.z * world.width + spec.x);
    const roofWorld: World = { ...contextWorld, roofing: { build: [], remove: [], cursor: 0, ...world.roofing, constructed: [...constructed] } };
    const bounds = new Map(roofSlabCellBounds(roofSurfaceCells(roofWorld), WORLD_SCALE.wallHeight + .08)
      .map(cell => [cell.z * world.width + cell.x, cell]));
    for (const spec of roofs) {
      const cell = bounds.get(spec.z * world.width + spec.x)!;
      result.boxes.push({ key: spec.key ?? ordinals.get(spec)!, x: (cell.w + cell.e) / 2, y: (cell.top + cell.bottom) / 2,
        z: (cell.s + cell.n) / 2, sx: cell.e - cell.w, sy: cell.top - cell.bottom, sz: cell.n - cell.s, color: 0xe6bc83 });
    }
  }
  return result;
}

/** Ghosts of placed constructions: the same builders and context as the
 * placement cursor, but one capture for every subject instead of one per spec,
 * so a few hundred blueprints cost one furniture pass. `specs` are drawn;
 * `context` (all placed constructions, `specs` included) are the neighbours
 * they link to. A ghost's identity derives from its key (the job id), so its
 * model never depends on the other ghosts' order. Parts carry the key of their
 * owner when it is known (target tint); floors sit just above a floor already
 * laid so the translucent ghost never fights it for depth. */
export function constructionGhostParts(world: World, specs: readonly ConstructionPreviewSpec[], cutaway = false, reach = GHOST_CONTEXT_REACH,
  context: readonly ConstructionPreviewSpec[] = specs): ConstructionPreviewParts {
  const result: ConstructionPreviewParts = { boxes: [], timberWalls: [], timberEaves: [], rotatedBoxes: [] };
  if (!specs.length) return result;
  const drawn = new Set(specs), subjects: Structure[] = [], virtuals: Structure[] = [], owners = new Map<number, number>(), cells = new Map<string, number>();
  const all = [...context, ...specs.filter(spec => !context.includes(spec))];
  for (let index = 0; index < all.length; index++) {
    const spec = all[index]!, key = spec.key ?? index;
    if (spec.kind === 'build-bridge' || spec.kind === 'remove-bridge' || spec.kind === 'lay-floor' || spec.kind === 'build-roof') {
      if (!drawn.has(spec)) continue;
      if (spec.kind === 'lay-floor') {
        if (!isFloorKind(spec.floor)) throw new Error('Construction floor model requires a floor kind');
        result.boxes.push(...floorPartsForKind(spec.floor, spec.x, spec.z).map(part => ({ ...part, y: part.y + GHOST_FLOOR_LIFT, key })));
      } else if (spec.kind !== 'build-roof') result.boxes.push(...bridgePartsForCell(spec.x, spec.z).map(part => ({ ...part, key })));
      continue;
    }
    const structure = virtualStructure(spec, -1 - key);
    virtuals.push(structure);
    if (drawn.has(spec)) { subjects.push(structure); owners.set(structure.id, key); cells.set(`${structure.x}:${structure.z}`, key); }
  }
  if (!subjects.length) return result;
  const moving = new Set(all.flatMap(spec => spec.furniture ? [spec.furniture.id] : []));
  const near = ghostNeighbourhood(world, subjects, reach);
  const contextWorld: World = { ...world, structures: [...world.structures.filter(s => !moving.has(s.id) && near(s)), ...virtuals.filter(near)] };
  const owner = (part: Placement): number | undefined => {
    const id = part.targetId ?? part.key;
    return (id !== undefined ? owners.get(id) : undefined) ?? cells.get(`${Math.round(part.x)}:${Math.round(part.z)}`);
  };
  const timber = timberCladdingParts(contextWorld, cutaway, subjects);
  result.timberWalls = timber.walls.map(part => ({ ...part, key: owner(part) }));
  result.timberEaves = timber.eaves.map(part => ({ ...part, key: owner(part) }));
  const authored = new Map<string, Placement[]>();
  const sink: Pick<BoxBatches, 'set'> = { set(_group, name, parts) {
    if ((name !== 'furniture' && name !== 'sandbags') || authored.has(name)) throw new Error('Unexpected construction furniture batch');
    authored.set(name, parts);
  } };
  buildFurniture({ ...contextWorld, structures: subjects, packed: [] }, new THREE.Group(), cutaway, sink as BoxBatches, contextWorld);
  const parts = [...authored.get('furniture') ?? [], ...authored.get('sandbags') ?? [], ...doorLeafParts(contextWorld, cutaway, subjects), ...subjects.flatMap(s => masonryWallParts(s, cutaway,contextWorld))];
  for (const structure of subjects) if (structure.kind === 'mini-turret') parts.push(...miniTurretTopPartsForStructure(structure));
  result.boxes.push(...parts.map(part => ({ ...part, key: owner(part) })));
  for (const structure of subjects) if (structure.kind === 'wind-turbine')
    result.rotatedBoxes.push(...windBladeParts(structure).map(part => ({ ...part, key: owners.get(structure.id) })));
  return result;
}
/** A wall of stone blocks or steel: WallLayer draws every wall, the timber
 * trim only covers wooden ones, so the ghost of any other wall is the block
 * WallLayer draws for it, body and lighter cap in its material colour. */
function masonryWallParts(structure: Structure, cutaway: boolean,world:Pick<World,'structures'>): Placement[] {
  const appliance=isWallAppliance(structure.kind);
  if (structure.kind !== 'wall'&&!appliance)return [];
  const material=appliance?wallApplianceSurroundMaterial(structure,(x,z)=>world.structures.find(s=>s.kind==='wall'&&s.x===x&&s.z===z)?.material):structure.material;
  if(material==='wood')return [];
  const body = buildingMaterialColor(material, MASONRY_FALLBACK) ?? MASONRY_FALLBACK, cap = masonryCapColor(body);
  const top = cutaway ? WORLD_SCALE.wallCutawayHeight : WORLD_SCALE.wallHeight, rest = top - WALL_CAP_HEIGHT;
  if(appliance&&!cutaway)return [
    {targetId:structure.id,x:structure.x,z:structure.z,y:WALL_APPLIANCE_BOTTOM/2,sx:1,sy:WALL_APPLIANCE_BOTTOM,sz:1,color:body},
    {targetId:structure.id,x:structure.x,z:structure.z,y:(WALL_APPLIANCE_TOP+rest)/2,sx:1,sy:rest-WALL_APPLIANCE_TOP,sz:1,color:body},
    {targetId:structure.id,x:structure.x,z:structure.z,y:rest+WALL_CAP_HEIGHT/2,sx:1,sy:WALL_CAP_HEIGHT,sz:1,color:cap},
  ];
  return [{ targetId: structure.id, x: structure.x, z: structure.z, y: rest / 2, sx: 1, sy: rest, sz: 1, color: body },
    { targetId: structure.id, x: structure.x, z: structure.z, y: rest + WALL_CAP_HEIGHT / 2, sx: 1, sy: WALL_CAP_HEIGHT, sz: 1, color: cap }];
}
/** Above a laid floor (FLOOR_SURFACE_Y) and below every furniture base. */
export const GHOST_FLOOR_LIFT = .012;
/** The models read only their close neighbours (linked walls and fences,
 * timber trim, door axes, conduits): the buildings anchored within this many
 * cells of a ghost. Large maps then cost what the ghosts cost, not the map. */
export const GHOST_CONTEXT_REACH = 6;
function ghostNeighbourhood(world: World, subjects: readonly Structure[], reach: number): (s: Structure) => boolean {
  if (reach >= Math.max(world.width, world.height)) return () => true;
  const mask = new Uint8Array(world.width * world.height);
  for (const s of subjects)
    for (let z = Math.max(0, s.z - reach); z <= Math.min(world.height - 1, s.z + reach); z++)
      mask.fill(1, z * world.width + Math.max(0, s.x - reach), z * world.width + Math.min(world.width - 1, s.x + reach) + 1);
  return s => s.x >= 0 && s.z >= 0 && s.x < world.width && s.z < world.height && mask[s.z * world.width + s.x] === 1;
}

/** Flat form for callers which group instances by geometry themselves. */
export function collectConstructionPreviewParts(world: World, specs: readonly ConstructionPreviewSpec[], cutaway = false,
  contextSpecs: readonly ConstructionPreviewSpec[] = specs): ConstructionPreviewPart[] {
  const parts = constructionPreviewParts(world, specs, cutaway, contextSpecs);
  return [
    ...[...parts.boxes, ...parts.rotatedBoxes].map(placement => ({ geometry: placement.shape==='sandbag'?'sandbag' as const:'box' as const, placement })),
    ...parts.timberWalls.map(placement => ({ geometry: 'timber-wall' as const, placement })),
    ...parts.timberEaves.map(placement => ({ geometry: 'timber-eave' as const, placement })),
  ];
}
