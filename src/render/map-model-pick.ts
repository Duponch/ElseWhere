import { footprintCells, STRUCTURE_DEFINITIONS } from '../sim/definitions';
import type { Cell, Job, Structure, World } from '../sim/types';
import { knownPosition256 } from '../ui/exploration-readers-256';
import { mapResourceSelectable, type MapObjectSelection } from '../ui/map-object-selection';
import { WORLD_SCALE } from '../world/scale';
import { constructionPreviewParts, type ConstructionPreviewParts } from './construction-preview-parts';
import { floraSize, floraTreeHeight } from './flora-presentation';
import { noise } from './StaticGeometry';

/** A camera ray in world space (direction need not be normalised). */
export interface MapPickRay { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }
export interface MapModelHit { selection: MapObjectSelection; cell: Cell; distance: number; cells: readonly Cell[] }

/** Above the tallest drawn thing (trees reach about 7 cells). */
const MODEL_CEILING = 8;
/** Largest reach of a footprint from its anchor (definitions.footprintContains). */
const FOOTPRINT_REACH = 6;
/** Natural rock tops are drawn between 2.15 and 3.4 cells (RockSurface). */
const ROCK_TOP = 2.4;
/** Side inset so two neighbouring boxes never share a face. */
const INSET = .04;

const heights = new Map<string, number>();
/** Top of the drawn model of a building kind: the highest of the parts the
 * placement cursor draws for it (the same authored builders as the map),
 * measured once per kind on an empty copy of the map. */
export function buildingModelTop(world: World, kind: Structure['kind'], cutaway: boolean): number {
  const key = `${kind}:${cutaway}`;
  let top = heights.get(key);
  if (top !== undefined) return top;
  top = 0;
  try {
    const empty: World = { ...world, structures: [], piles: [], packed: [], jobs: [] };
    const parts: ConstructionPreviewParts = constructionPreviewParts(empty, [{ kind, x: Math.min(8, world.width - 1), z: Math.min(8, world.height - 1) }], cutaway);
    for (const part of [...parts.boxes, ...parts.timberWalls, ...parts.timberEaves, ...parts.rotatedBoxes])
      top = Math.max(top, part.y + Math.max(part.sy ?? 1, part.rx || part.rz ? Math.max(part.sx ?? 1, part.sz ?? 1) : 0) / 2);
  } catch { top = 0; }
  // Kinds without a construction model (cave hives, glow pods): a low box.
  if (!(top > 0)) top = WORLD_SCALE.bedSurfaceHeight;
  heights.set(key, top);
  return top;
}

/** Slab test of the ray against an axis-aligned box; distance or Infinity. */
function rayBox(r: MapPickRay, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
  let near = 0, far = Infinity;
  for (const [o, d, lo, hi] of [[r.ox, r.dx, x0, x1], [r.oy, r.dy, y0, y1], [r.oz, r.dz, z0, z1]] as const) {
    if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return Infinity; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > near) near = a; if (b < far) far = b;
    if (near > far) return Infinity;
  }
  return near;
}

const treeHeight = (world: World, r: World['resources'][number]): number => r.species
  ? floraTreeHeight(r) * floraSize(world, r)
  : WORLD_SCALE.treeMinHeight + noise(r.x, r.z, 77) * (WORLD_SCALE.treeMaxHeight - WORLD_SCALE.treeMinHeight);

/** The thing whose drawn model the ray meets first, by approximate boxes:
 * buildings and placed constructions over their footprint up to the top of
 * their model, trees and plants by their drawn size, piles, packed furniture
 * and natural rock. Run on a click only; wall lamps (drawn on the wall face)
 * and actors (screen proxies) have their own picks. Fogged things are skipped. */
export function pickMapModel(world: World, ray: MapPickRay, options: { cutaway?: boolean; jobs?: readonly Job[] } = {}): MapModelHit | undefined {
  if (ray.dy >= 0) return undefined;
  const cutaway = !!options.cutaway;
  const tTop = Math.max(0, (MODEL_CEILING - ray.oy) / ray.dy), tGround = -ray.oy / ray.dy;
  if (!(tGround > 0)) return undefined;
  const ax = ray.ox + ray.dx * tTop, az = ray.oz + ray.dz * tTop, bx = ray.ox + ray.dx * tGround, bz = ray.oz + ray.dz * tGround;
  const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
  const near = (x: number, z: number, reach: number) => x >= minX - reach && x <= maxX + reach && z >= minZ - reach && z <= maxZ + reach;
  let best: MapModelHit | undefined;
  /** `top` is read only when the ray crosses the column of the footprint. */
  const consider = (selection: MapObjectSelection, cells: readonly Cell[], top: number | (() => number), half = .5) => {
    if (!cells.length) return;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of cells) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
    const inset = half >= .5 ? INSET : 0;
    if (typeof top === 'function') {
      if (!(rayBox(ray, x0 - half + inset, 0, z0 - half + inset, x1 + half - inset, MODEL_CEILING, z1 + half - inset) < (best?.distance ?? Infinity))) return;
      top = top();
    }
    if (!cells.some(c => knownPosition256(world, c))) return;
    const t = rayBox(ray, x0 - half + inset, 0, z0 - half + inset, x1 + half - inset, top, z1 + half - inset);
    if (!(t < (best?.distance ?? Infinity))) return;
    const hx = ray.ox + ray.dx * t, hz = ray.oz + ray.dz * t;
    const cell = { x: Math.min(x1, Math.max(x0, Math.round(hx))), z: Math.min(z1, Math.max(z0, Math.round(hz))) };
    best = { selection, cell: cells.some(c => c.x === cell.x && c.z === cell.z) ? cell : cells[0]!, distance: t, cells };
  };
  for (const s of world.structures) {
    if (s.kind === 'wall-lamp' || !near(s.x, s.z, FOOTPRINT_REACH)) continue;
    consider({ kind: 'structure', id: s.id }, footprintCells(s), () => buildingModelTop(world, s.kind, cutaway));
  }
  for (const job of options.jobs ?? world.jobs) {
    if (job.wallDoor296?.manual === false || !near(job.x, job.z, FOOTPRINT_REACH)) continue;
    const kind = job.kind === 'install' ? job.furniture?.kind : job.kind === 'lay-floor' || job.kind === 'build-bridge' ? undefined : job.kind;
    const top = job.kind === 'lay-floor' || job.kind === 'build-bridge' ? .1 : kind && Object.hasOwn(STRUCTURE_DEFINITIONS, kind) ? () => buildingModelTop(world, kind as Structure['kind'], cutaway) : undefined;
    if (top !== undefined) consider({ kind: 'job', id: job.id }, footprintCells(job), top);
  }
  for (const r of world.resources) {
    if (!near(r.x, r.z, 2) || !mapResourceSelectable(r)) continue;
    if (r.kind === 'tree') { const size = r.species ? floraSize(world, r) : 1; consider({ kind: 'resource', id: r.id }, [r], treeHeight(world, r), Math.max(.3, .55 * size)); }
    else if (r.kind === 'rock') consider({ kind: 'resource', id: r.id }, [r], 1);
    else consider({ kind: 'resource', id: r.id }, [r], Math.max(.25, .7 * floraSize(world, r)), .4);
  }
  for (const p of world.piles) if (p.owner.type === 'ground' && near(p.owner.x, p.owner.z, 1))
    consider({ kind: 'pile', id: p.id }, [p.owner], WORLD_SCALE.pileMaxHeight, WORLD_SCALE.pileWidth / 2);
  for (const p of world.packed) if (p.owner.type === 'ground' && near(p.owner.x, p.owner.z, 1))
    consider({ kind: 'packed', id: p.building.id }, [p.owner], .5, .34);
  // Natural rock: walk the cells under the ray from the ceiling to the ground.
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 2) + 1;
  for (let i = 0; i <= steps; i++) {
    const t = tTop + (tGround - tTop) * i / steps, x = Math.round(ray.ox + ray.dx * t), z = Math.round(ray.oz + ray.dz * t);
    if (x < 0 || z < 0 || x >= world.width || z >= world.height || world.tiles[z * world.width + x]?.terrain !== 'rock') continue;
    consider({ kind: 'rock', id: z * world.width + x }, [{ x, z }], ROCK_TOP);
    // The cells come in ray order: the first rock met is the nearest one.
    if (best?.selection.kind === 'rock' && best.selection.id === z * world.width + x) break;
  }
  return best;
}

/** The cell whose things a selection click lists, and the thing to select
 * first: Core lists the things of the clicked cell (GenUI.ThingsUnderMouse),
 * which stays the rule whenever the model met first stands on that cell. A
 * model drawn over another cell (a tree crown, the face of a wall, a pile
 * seen from the side) is selected first, then the clicks cycle on its cell. */
export function modelPickTarget(ground: Cell | null, hit: MapModelHit | undefined): { cell: Cell; preferred?: MapObjectSelection } | null {
  if (!hit) return ground ? { cell: ground } : null;
  if (ground && hit.cells.some(c => c.x === ground.x && c.z === ground.z)) return { cell: ground };
  return { cell: hit.cell, preferred: hit.selection };
}
