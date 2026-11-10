/** Linked walls: one continuous presentation surface for every wall cell and
 * every doorway lintel, the 3D counterpart of RimWorld's linked wall atlas.
 *
 * The World is only read. A compact cell grid (codes and owner IDs) records
 * which cells belong to the wall network; faces are emitted only where the
 * network borders open space, so two neighbouring walls share no face, no
 * bevel and no contour. Side faces of consecutive cells are merged into runs.
 * Every side face is cut at the same global heights, so coplanar neighbours
 * always share exact edges and the contour detector never sees a false seam. */
import { Color } from 'three/webgpu';
import { isRoomDoor } from '../sim/door-rules';
import type { Structure, World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { buildingMaterialColor } from './building-material-color';
import { doorLeafTop } from './door-parts';

/** Light top band of every wall run (stone cap or timber top plate). */
export const WALL_CAP_HEIGHT = .1;
/** Spatial region rewritten as a whole when one of its walls changes. */
export const WALL_CHUNK_SIZE = 32;
/** Timber is drawn as horizontal boards, masonry as coursed blocks. */
export const WALL_FAMILY_MASONRY = 0, WALL_FAMILY_TIMBER = 1;
const TIMBER_BODY = 0xad8455, TIMBER_CAP = 0xcfa36b, MASONRY_FALLBACK = 0xa6916e;
/** A doorway lintel starts above the opening; masonry keeps its frame lintel. */
export const timberLintelBottom = (): number => doorLeafTop(false);
export const masonryLintelBottom = (): number => doorLeafTop(false) + .11;

/** Stable per-session material indices; codes never depend on map order. */
const materialIndex = new Map<string, number>([['', 0]]);
const materialNames = [''];
function indexOf(material: string | undefined): number {
  const key = material ?? '';
  let index = materialIndex.get(key);
  if (index === undefined) { index = materialNames.length; materialIndex.set(key, index); materialNames.push(key); }
  return index;
}

/** code: bit0 present, bits1-2 bottom (0 ground, 1 timber lintel, 2 masonry
 * lintel), bit3 timber family, bits4+ material index. */
const encode = (bottom: 0 | 1 | 2, timber: boolean, material: number): number => 1 | bottom << 1 | (timber ? 8 : 0) | material << 4;
export const wallCodeBottom = (code: number, cutaway: boolean): number => {
  const kind = code >> 1 & 3;
  return kind === 0 ? 0 : kind === 1 ? (cutaway ? 0 : timberLintelBottom()) : (cutaway ? 0 : masonryLintelBottom());
};
export const wallCodeFamily = (code: number): number => code & 8 ? WALL_FAMILY_TIMBER : WALL_FAMILY_MASONRY;
export const wallCodeMaterial = (code: number): number => code >> 4;

function shade(color: number, amount: number): number {
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round((color >> shift & 255) * amount)));
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}
export function wallBodyColor(code: number): number {
  if (code & 8) return TIMBER_BODY;
  const material = materialNames[wallCodeMaterial(code)] || undefined;
  return buildingMaterialColor(material as Structure['material'], MASONRY_FALLBACK) ?? MASONRY_FALLBACK;
}
export function wallCapColor(code: number): number { return code & 8 ? TIMBER_CAP : shade(wallBodyColor(code), 1.1); }

export interface WallGrid {
  readonly width: number; readonly height: number; readonly cutaway: boolean; readonly top: number;
  /** 0 outside the network, else the cell code above. */
  readonly codes: Int32Array;
  /** Owner structure (wall or door) of each network cell, -1 elsewhere. */
  readonly ids: Int32Array;
}

/** Read the network from a World. Doors join the network only through the
 * lintel above their opening, never in cutaway (the doorway stays open). */
export function readWallGrid(world: Pick<World, 'width' | 'height' | 'structures'>, cutaway: boolean): WallGrid {
  const { width, height } = world, codes = new Int32Array(width * height), ids = new Int32Array(width * height).fill(-1);
  const top = cutaway ? WORLD_SCALE.wallCutawayHeight : WORLD_SCALE.wallHeight;
  const doors: Structure[] = [];
  const material = new Map<number, Structure['material']>();
  for (const s of world.structures) {
    if (s.x < 0 || s.z < 0 || s.x >= width || s.z >= height) continue;
    const at = s.z * width + s.x;
    if (s.kind === 'wall') {
      codes[at] = encode(0, s.material === 'wood', indexOf(s.material)); ids[at] = s.id; material.set(at, s.material);
    } else if (isRoomDoor(s.kind)) doors.push(s);
  }
  if (!cutaway) for (const door of doors) {
    const at = door.z * width + door.x;
    if (codes[at]) continue;
    const wall = (x: number, z: number): Structure['material'] | null => x < 0 || z < 0 || x >= width || z >= height || !codes[z * width + x] ? null : material.get(z * width + x) ?? null;
    const east = wall(door.x + 1, door.z), west = wall(door.x - 1, door.z), north = wall(door.x, door.z + 1), south = wall(door.x, door.z - 1);
    const timber = east === 'wood' && west === 'wood' || north === 'wood' && south === 'wood';
    // The material above an opening belongs to the surrounding wall.
    const pair = east !== null || west !== null ? [east, west] : [north, south];
    const surround = pair[0] !== null && pair[0] === pair[1] ? pair[0] : pair[0] ?? pair[1] ?? door.material;
    const wood = timber || surround === 'wood';
    codes[at] = encode(timber ? 1 : 2, wood, indexOf(wood ? 'wood' : surround));
    ids[at] = door.id;
  }
  return { width, height, cutaway, top, codes, ids };
}

/** Raw triangle soup. Non-indexed: each triangle owns its corners so the
 * contour table can address it as one face. */
export interface WallFaces {
  triangles: number;
  readonly position: number[]; readonly normal: number[]; readonly color: number[];
  /** Planar face coordinates (world units) used by the contour table. */
  readonly faceUv: number[];
  /** 0 masonry, 1 timber, +2 for the light cap band and top. */
  readonly family: number[];
  /** Contour partition: a material or band change draws a line. */
  readonly seam: number[];
}
export const emptyWallFaces = (): WallFaces => ({ triangles: 0, position: [], normal: [], color: [], faceUv: [], family: [], seam: [] });

type P = readonly [number, number, number];
const scratch = new Color();
function pushQuad(out: WallFaces, a: P, b: P, c: P, d: P, normal: P, color: number, family: number, seam: number): void {
  // Wind counter-clockwise when seen from outside the surface.
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cross = (uy * vz - uz * vy) * normal[0] + (uz * vx - ux * vz) * normal[1] + (ux * vy - uy * vx) * normal[2];
  const order = cross >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
  // Same working-space conversion as every other vertex/instance colour.
  const { r, g, b: bl } = scratch.setHex(color);
  for (const p of order) {
    out.position.push(p[0], p[1], p[2]); out.normal.push(normal[0], normal[1], normal[2]); out.color.push(r, g, bl);
    out.faceUv.push(Math.abs(normal[1]) > .5 ? p[0] : Math.abs(normal[0]) > .5 ? p[2] : p[0], Math.abs(normal[1]) > .5 ? p[2] : p[1]);
    out.family.push(family); out.seam.push(seam);
  }
  out.triangles += 2;
}

/** Global cut heights: every side face is split at these values, so faces of
 * walls, lintels and caps always meet along identical edges. */
export function wallBandHeights(top: number, cutaway: boolean): number[] {
  const values = [0, top - WALL_CAP_HEIGHT, top];
  if (!cutaway) values.push(timberLintelBottom(), masonryLintelBottom());
  return [...new Set(values.filter(y => y >= 0 && y <= top))].sort((a, b) => a - b);
}

const SIDES = [
  // dx, dz, normal, run axis along x?
  { dx: 1, dz: 0, normal: [1, 0, 0] as P, alongX: false },
  { dx: -1, dz: 0, normal: [-1, 0, 0] as P, alongX: false },
  { dx: 0, dz: 1, normal: [0, 0, 1] as P, alongX: true },
  { dx: 0, dz: -1, normal: [0, 0, -1] as P, alongX: true },
] as const;

/** Faces of the network cells accepted by `include`, merged into runs. The
 * complete grid always decides exposure; `include` only selects ownership. */
export function emitWallFaces(grid: WallGrid, include: (x: number, z: number) => boolean, x0: number, z0: number, x1: number, z1: number, out: WallFaces = emptyWallFaces()): WallFaces {
  const { width, height, codes, top, cutaway } = grid, bands = wallBandHeights(top, cutaway), capY = top - WALL_CAP_HEIGHT;
  const code = (x: number, z: number) => x < 0 || z < 0 || x >= width || z >= height ? 0 : codes[z * width + x]!;
  const lo = (c: number) => wallCodeBottom(c, cutaway);
  const seamOf = (c: number, cap: boolean) => wallCodeMaterial(c) * 2 + (cap ? 1 : 0) + (c & 8 ? 1000 : 0);
  x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(width, x1); z1 = Math.min(height, z1);
  // Tops and lintel undersides, one quad per cell.
  for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    const c = code(x, z); if (!c || !include(x, z)) continue;
    const family = wallCodeFamily(c), cap = wallCapColor(c);
    pushQuad(out, [x - .5, top, z - .5], [x + .5, top, z - .5], [x + .5, top, z + .5], [x - .5, top, z + .5], [0, 1, 0], cap, family + 2, seamOf(c, true));
    const bottom = lo(c);
    if (bottom > 0) pushQuad(out, [x - .5, bottom, z - .5], [x + .5, bottom, z - .5], [x + .5, bottom, z + .5], [x - .5, bottom, z + .5], [0, -1, 0], shade(wallBodyColor(c), .82), family, seamOf(c, false));
  }
  // Side runs: one quad per band per maximal run of equally exposed cells.
  for (const side of SIDES) {
    const outer = side.alongX ? z1 - z0 : x1 - x0, inner = side.alongX ? x1 - x0 : z1 - z0;
    for (let o = 0; o < outer; o++) {
      // Most lines of a region hold no wall at all: skip them once.
      let any = false;
      for (let i = 0; i < inner && !any; i++) any = code(side.alongX ? x0 + i : x0 + o, side.alongX ? z0 + o : z0 + i) !== 0;
      if (!any) continue;
      for (let k = 0; k + 1 < bands.length; k++) {
      const yA = bands[k]!, yB = bands[k + 1]!, cap = yA >= capY - 1e-9;
      let start = -1, key = 0, color = 0, family = 0;
      const flush = (end: number) => {
        if (start < 0) return;
        const a = start, b = end; start = -1;
        if (side.alongX) {
          const z = z0 + o, plane = z + side.dz * .5;
          pushQuad(out, [x0 + a - .5, yA, plane], [x0 + b - .5, yA, plane], [x0 + b - .5, yB, plane], [x0 + a - .5, yB, plane], side.normal, color, family, key);
        } else {
          const x = x0 + o, plane = x + side.dx * .5;
          pushQuad(out, [plane, yA, z0 + a - .5], [plane, yA, z0 + b - .5], [plane, yB, z0 + b - .5], [plane, yB, z0 + a - .5], side.normal, color, family, key);
        }
      };
      for (let i = 0; i <= inner; i++) {
        let exposed = false, nextKey = 0, nextColor = 0, nextFamily = 0;
        if (i < inner) {
          const x = side.alongX ? x0 + i : x0 + o, z = side.alongX ? z0 + o : z0 + i, c = code(x, z);
          if (c && include(x, z)) {
            // Exposed from the own bottom up to the neighbour's bottom: a wall
            // beside a doorway shows its jamb below the lintel only.
            const n = code(x + side.dx, z + side.dz), limit = n ? lo(n) : top;
            exposed = yA >= lo(c) - 1e-9 && yB <= limit + 1e-9;
            if (exposed) { nextKey = seamOf(c, cap); nextColor = cap ? wallCapColor(c) : wallBodyColor(c); nextFamily = wallCodeFamily(c) + (cap ? 2 : 0); }
          }
        }
        if (start >= 0 && (!exposed || nextKey !== key || nextColor !== color || nextFamily !== family)) flush(i);
        if (exposed && start < 0) { start = i; key = nextKey; color = nextColor; family = nextFamily; }
      }
      }
    }
  }
  return out;
}

export interface WallChunkFaces { readonly drawn: WallFaces; readonly context: WallFaces }
/** One region's drawn faces plus, for contour detection only, the faces of
 * the one-cell ring around it: a run crossing the region border then keeps
 * a single continuous contour instead of a seam at each region. */
export function wallChunkFaces(grid: WallGrid, chunkX: number, chunkZ: number, size = WALL_CHUNK_SIZE): WallChunkFaces {
  const x0 = chunkX * size, z0 = chunkZ * size, x1 = x0 + size, z1 = z0 + size;
  const drawn = emitWallFaces(grid, () => true, x0, z0, x1, z1), all = () => true;
  // The ring as four disjoint strips: bottom and top rows, then both columns.
  const context = emitWallFaces(grid, all, x0 - 1, z0 - 1, x1 + 1, z0);
  emitWallFaces(grid, all, x0 - 1, z1, x1 + 1, z1 + 1, context);
  emitWallFaces(grid, all, x0 - 1, z0, x0, z1, context);
  emitWallFaces(grid, all, x1, z0, x1 + 1, z1, context);
  return { drawn, context };
}

/** Regions whose drawn or context faces can depend on these changed cells. */
export function wallChunksNear(width: number, height: number, cells: Iterable<number>, into: Set<number>, size = WALL_CHUNK_SIZE): Set<number> {
  const columns = Math.ceil(width / size), rows = Math.ceil(height / size);
  for (const cell of cells) {
    const x = cell % width, z = Math.floor(cell / width);
    for (let cz = Math.max(0, Math.floor((z - 2) / size)); cz <= Math.min(rows - 1, Math.floor((z + 2) / size)); cz++)
      for (let cx = Math.max(0, Math.floor((x - 2) / size)); cx <= Math.min(columns - 1, Math.floor((x + 2) / size)); cx++) into.add(cz * columns + cx);
  }
  return into;
}
