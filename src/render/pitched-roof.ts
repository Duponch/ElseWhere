/** Pitched roofs over constructed roof cells: presentation only.
 *
 * A roof covers exactly its footprint F (built roof cells and the walls and
 * doors supporting them), plus a constant eave overhang. Each 4-connected
 * component chooses its form from its shape:
 * - a rectangle at least 1.5 times longer than wide receives two pitches
 *   with gables (pignons) at its short ends;
 * - every other shape (square, L, T, U, courtyard, partial roof) receives a
 *   hipped roof (pavillon). Its height is the slope times the Chebyshev (L∞)
 *   distance to the outside of the component: for a rectilinear outline this
 *   field is exactly the straight-skeleton roof, ridges, hips and valleys
 *   included, whatever the shape, holes or neighbouring rooms.
 * Every possible fold of these fields lies on a half-cell line or on a cell
 * diagonal through a cell centre, so the cell lattice below triangulates it
 * EXACTLY: no hole, no crack, no surface poking through another. Heights are
 * capped (flat top) above a few cells, so large halls stay low. */
import { Color } from 'three/webgpu';
import { isRoomDoor } from '../sim/door-rules';

/** Cells that complete a building outline under its roof: the simulation's
 * roof holders, plus coolers and vents set into a wall line. Presentation
 * only; the simulation's support rules are unchanged. */
export const isRoofOutlineKind=(kind:unknown):boolean=>kind==='wall'||kind==='column'||isRoomDoor(kind)||kind==='cooler'||kind==='vent';


export const ROOF_SLOPE = .6;
export const ROOF_OVERHANG = .3;
export const ROOF_THICKNESS = .2;
/** Distance (cells) above which the roof is flat: 2.4 units of ridge. */
export const ROOF_CAP_CELLS = 4;
/** Long side / short side from which a rectangle gets gables. */
export const GABLE_ASPECT = 1.5;
export const ROOF_PART_PITCH = 0, ROOF_PART_FASCIA = 1, ROOF_PART_GABLE = 2, ROOF_PART_SOFFIT = 3;
const PITCH_COLOR = 0xab7656, FASCIA_COLOR = 0x8a5a3c, SOFFIT_COLOR = 0x806044, GABLE_FALLBACK = 0xad8455;

export interface RoofCell { readonly x: number; readonly z: number }
export interface RoofFaces {
  triangles: number;
  readonly position: number[]; readonly normal: number[]; readonly color: number[]; readonly uv: number[];
  /** Part of the roof (pitch, fascia, gable, soffit): shingles and contours. */
  readonly part: number[];
}
export const emptyRoofFaces = (): RoofFaces => ({ triangles: 0, position: [], normal: [], color: [], uv: [], part: [] });
export interface RoofComponent { readonly cells: number; readonly form: 'hip' | 'gable'; readonly ridgeAlongX?: boolean }

type V = readonly [number, number, number];
const scratch = new Color();
function pushTriangle(out: RoofFaces, a: V, b: V, c: V, up: boolean | V, color: number, part: number): void {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz); if (length < 1e-12) return;
  nx /= length; ny /= length; nz /= length;
  const want = typeof up === 'boolean' ? (up ? ny >= 0 : ny <= 0) : nx * up[0] + ny * up[1] + nz * up[2] >= 0;
  const order = want ? [a, b, c] : [a, c, b];
  if (!want) { nx = -nx; ny = -ny; nz = -nz; }
  const { r, g, b: blue } = scratch.setHex(color);
  for (const p of order) {
    out.position.push(p[0], p[1], p[2]); out.normal.push(nx, ny, nz); out.color.push(r, g, blue);
    // World planar paint/contour coordinates (same scale as the flat slab).
    const horizontal = Math.abs(ny) > .3;
    out.uv.push(horizontal ? p[0] / 8 : Math.abs(nx) > Math.abs(nz) ? p[2] / 8 : p[0] / 8, horizontal ? p[2] / 8 : p[1] / 8);
    out.part.push(part);
  }
  out.triangles++;
}

/** Classify the components of F and return, per cell, its component index. */
export function roofComponents(width: number, height: number, cells: readonly RoofCell[]): { label: Int32Array; components: RoofComponent[]; bounds: number[][] } {
  const label = new Int32Array(width * height).fill(-1), inF = new Uint8Array(width * height);
  for (const { x, z } of cells) if (x >= 0 && z >= 0 && x < width && z < height) inF[z * width + x] = 1;
  const components: RoofComponent[] = [], bounds: number[][] = [];
  const stack: number[] = [];
  for (const { x, z } of cells) {
    const start = z * width + x; if (!inF[start] || label[start]! >= 0) continue;
    const id = components.length; let count = 0, x0 = x, x1 = x, z0 = z, z1 = z;
    label[start] = id; stack.push(start);
    while (stack.length) {
      const at = stack.pop()!, cx = at % width, cz = Math.floor(at / width); count++;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); z0 = Math.min(z0, cz); z1 = Math.max(z1, cz);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
        const next = nz * width + nx; if (inF[next] && label[next]! < 0) { label[next] = id; stack.push(next); }
      }
    }
    const w = x1 - x0 + 1, d = z1 - z0 + 1, rectangle = w * d === count;
    const gable = rectangle && Math.max(w, d) >= GABLE_ASPECT * Math.min(w, d);
    components.push(gable ? { cells: count, form: 'gable', ridgeAlongX: w >= d } : { cells: count, form: 'hip' });
    bounds.push([x0, x1, z0, z1]);
  }
  return { label, components, bounds };
}

export interface PitchedRoofOptions {
  /** Eave height: top of the walls plus the existing roof clearance. */
  readonly eave: number;
  /** Colour of the gable face above a support cell (its wall material). */
  readonly gableColor?: (x: number, z: number) => number | undefined;
}

/** Height field of every built roof component of a map. Lattice values and
 * cell classes are computed lazily, once, then shared by every region. */
export interface RoofField {
  readonly width: number; readonly height: number; readonly eave: number;
  readonly label: Int32Array; readonly components: readonly RoofComponent[]; readonly bounds: readonly (readonly number[])[];
  /** Smallest cell index of each component: its identity across updates. */
  readonly anchors: readonly number[];
  readonly gableColor?: (x: number, z: number) => number | undefined;
  readonly cache: Map<number, number>;
  readonly klass: Map<number, Klass>;
}
type Klass = 'plane' | 'diag' | 'anti' | 'centre';

export function roofField(width: number, height: number, cells: readonly RoofCell[], options: PitchedRoofOptions): RoofField {
  const { label, components, bounds } = roofComponents(width, height, cells);
  const anchors = components.map(() => Infinity);
  for (const { x, z } of cells) { const id = x >= 0 && z >= 0 && x < width && z < height ? label[z * width + x]! : -1; if (id >= 0) anchors[id] = Math.min(anchors[id]!, z * width + x); }
  return { width, height, eave: options.eave, label, components, bounds, anchors, gableColor: options.gableColor, cache: new Map(), klass: new Map() };
}

const EPS = 1e-6;
const comp = (f: RoofField, x: number, z: number) => x < 0 || z < 0 || x >= f.width || z >= f.height ? -1 : f.label[z * f.width + x]!;
/** Signed distance driving the height, defined for any point of the lattice
 * of component `id` (cell centres are integers, cell edges half-integers). */
function distance(f: RoofField, px: number, pz: number, id: number): number {
  const c = f.components[id]!, [x0, x1, z0, z1] = f.bounds[id]! as [number, number, number, number], cap = ROOF_CAP_CELLS;
  if (c.form === 'gable') return c.ridgeAlongX ? Math.min(pz - (z0 - .5), z1 + .5 - pz) : Math.min(px - (x0 - .5), x1 + .5 - px);
  // L∞ distance to the cells outside this component. Beyond the cap the
  // exact value no longer matters: search cap+1 cells.
  let best = cap + 1;
  const r = cap + 1, cx = Math.round(px), cz = Math.round(pz);
  for (let qz = cz - r; qz <= cz + r && best > 0; qz++) for (let qx = cx - r; qx <= cx + r; qx++) {
    if (comp(f, qx, qz) === id) continue;
    const d = Math.max(Math.max(0, Math.abs(px - qx) - .5), Math.max(0, Math.abs(pz - qz) - .5));
    if (d < best) best = d;
  }
  return best;
}
const roofY = (f: RoofField, d: number) => f.eave + ROOF_SLOPE * (Math.min(d, ROOF_CAP_CELLS) + ROOF_OVERHANG);
function yAt(f: RoofField, px: number, pz: number, id: number): number {
  const k = ((Math.round(pz * 2) + 1) * (2 * f.width + 3) + Math.round(px * 2) + 1) * f.components.length + id;
  let y = f.cache.get(k); if (y === undefined) { y = roofY(f, distance(f, px, pz, id)); f.cache.set(k, y); } return y;
}
/** Classify a cell from its nine lattice samples. */
function klassOf(f: RoofField, x: number, z: number): Klass {
  const at = z * f.width + x; let k = f.klass.get(at); if (k) return k;
  const id = comp(f, x, z), h = (dx: number, dz: number) => yAt(f, x + dx, z + dz, id);
  const c00 = h(-.5, -.5), c10 = h(.5, -.5), c01 = h(-.5, .5), c11 = h(.5, .5), centre = h(0, 0);
  const m0 = h(0, -.5), m1 = h(.5, 0), m2 = h(0, .5), m3 = h(-.5, 0);
  const edges = Math.abs(m0 - (c00 + c10) / 2) < EPS && Math.abs(m1 - (c10 + c11) / 2) < EPS && Math.abs(m2 - (c01 + c11) / 2) < EPS && Math.abs(m3 - (c00 + c01) / 2) < EPS;
  const diag = Math.abs(centre - (c00 + c11) / 2) < EPS, anti = Math.abs(centre - (c10 + c01) / 2) < EPS;
  k = !edges ? 'centre' : diag && anti ? 'plane' : diag ? 'diag' : anti ? 'anti' : 'centre';
  f.klass.set(at, k); return k;
}

/** Faces of the built roof cells accepted by `include`: pitched top, eave and
 * rake overhang, fascia, gables and flat underside (needed for the back-face
 * shadow pass). The complete field always decides heights and exposure. */
export function emitPitchedRoof(f: RoofField, include: (x: number, z: number) => boolean, x0: number, z0: number, x1: number, z1: number, out: RoofFaces = emptyRoofFaces()): RoofFaces {
  const o = ROOF_OVERHANG, eave = f.eave, bottom = eave - ROOF_THICKNESS;
  const any = (x: number, z: number) => comp(f, x, z) >= 0;
  const isCentre = (x: number, z: number) => any(x, z) && klassOf(f, x, z) === 'centre';
  /** A cell edge needs its midpoint if a centre-fan cell lies on either side. */
  const mid = (x: number, z: number, dx: number, dz: number) => isCentre(x, z) || isCentre(x + dx, z + dz);
  const gableAt = (x: number, z: number) => f.gableColor?.(x, z) ?? GABLE_FALLBACK;
  x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(f.width, x1); z1 = Math.min(f.height, z1);
  const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  for (let z = z0; z < z1; z++) {
    let rowStart = -1;
    const flushRow = (end: number) => {
      if (rowStart < 0) return;
      const a: V = [rowStart - .5, bottom, z - .5], b: V = [end - .5, bottom, z - .5], c: V = [end - .5, bottom, z + .5], d: V = [rowStart - .5, bottom, z + .5];
      pushTriangle(out, a, b, c, false, SOFFIT_COLOR, ROOF_PART_SOFFIT); pushTriangle(out, a, c, d, false, SOFFIT_COLOR, ROOF_PART_SOFFIT);
      rowStart = -1;
    };
    for (let x = x0; x <= x1; x++) {
      const id = x < x1 ? comp(f, x, z) : -1;
      if (id < 0 || !include(x, z)) { flushRow(x); continue; }
      if (rowStart < 0) rowStart = x;
      // 1. Pitched surface of the cell.
      const P = (dx: number, dz: number): V => [x + dx, yAt(f, x + dx, z + dz, id), z + dz];
      const c00 = P(-.5, -.5), c10 = P(.5, -.5), c11 = P(.5, .5), c01 = P(-.5, .5);
      const kind = klassOf(f, x, z), mids = [mid(x, z, 0, -1), mid(x, z, 1, 0), mid(x, z, 0, 1), mid(x, z, -1, 0)];
      if (kind !== 'centre' && !mids.some(Boolean)) {
        if (kind === 'anti') { pushTriangle(out, c10, c11, c01, true, PITCH_COLOR, ROOF_PART_PITCH); pushTriangle(out, c10, c01, c00, true, PITCH_COLOR, ROOF_PART_PITCH); }
        else { pushTriangle(out, c00, c10, c11, true, PITCH_COLOR, ROOF_PART_PITCH); pushTriangle(out, c00, c11, c01, true, PITCH_COLOR, ROOF_PART_PITCH); }
      } else {
        const ring: V[] = [c00];
        if (mids[0]) ring.push(P(0, -.5)); ring.push(c10);
        if (mids[1]) ring.push(P(.5, 0)); ring.push(c11);
        if (mids[2]) ring.push(P(0, .5)); ring.push(c01);
        if (mids[3]) ring.push(P(-.5, 0));
        const centre = P(0, 0);
        for (let i = 0; i < ring.length; i++) pushTriangle(out, centre, ring[i]!, ring[(i + 1) % ring.length]!, true, PITCH_COLOR, ROOF_PART_PITCH);
      }
      // 2. Eave/rake overhang, soffit, fascia and gable on every exposed edge.
      for (const [nx, nz] of SIDES) {
        if (any(x + nx, z + nz)) continue;
        // Edge endpoints A -> B along direction (tx,tz), outward normal (nx,nz).
        const tx = -nz, tz = nx;
        const ax = x + nx * .5 - tx * .5, az = z + nz * .5 - tz * .5, bx = x + nx * .5 + tx * .5, bz = z + nz * .5 + tz * .5;
        const end = (sign: number): number => {
          const along = any(x + sign * tx, z + sign * tz), diagonal = any(x + sign * tx + nx, z + sign * tz + nz);
          if (along && diagonal) return -o;      // re-entrant corner: valley
          if (!along && !diagonal) return o;     // outer corner: hip/eave corner
          return 0;                              // straight run (or a diagonal touch)
        };
        const ea = end(-1), eb = end(1);
        const inner: [number, number][] = [[ax, az]];
        if (mid(x, z, nx, nz)) inner.push([(ax + bx) / 2, (az + bz) / 2]);
        inner.push([bx, bz]);
        const outer = inner.map(([px, pz], i): [number, number] => {
          const shift = i === 0 ? -ea : i === inner.length - 1 ? eb : 0;
          return [px + nx * o + tx * shift, pz + nz * o + tz * shift];
        });
        const c = f.components[id]!, rake = c.form === 'gable' && (c.ridgeAlongX ? nx !== 0 : nz !== 0);
        const innerV = inner.map(([px, pz]): V => [px, yAt(f, px, pz, id), pz]);
        const outerV = outer.map(([px, pz]): V => [px, rake ? roofY(f, distance(f, px, pz, id)) : roofY(f, -o), pz]);
        for (let i = 0; i + 1 < inner.length; i++) {
          pushTriangle(out, innerV[i]!, innerV[i + 1]!, outerV[i + 1]!, true, PITCH_COLOR, ROOF_PART_PITCH);
          pushTriangle(out, innerV[i]!, outerV[i + 1]!, outerV[i]!, true, PITCH_COLOR, ROOF_PART_PITCH);
          const a: V = [innerV[i]![0], bottom, innerV[i]![2]], b: V = [innerV[i + 1]![0], bottom, innerV[i + 1]![2]];
          const a2: V = [outerV[i]![0], bottom, outerV[i]![2]], b2: V = [outerV[i + 1]![0], bottom, outerV[i + 1]![2]];
          pushTriangle(out, a, b2, b, false, SOFFIT_COLOR, ROOF_PART_SOFFIT); pushTriangle(out, a, a2, b2, false, SOFFIT_COLOR, ROOF_PART_SOFFIT);
          const n: V = [nx, 0, nz], fa: V = [outerV[i]![0], eave, outerV[i]![2]], fb: V = [outerV[i + 1]![0], eave, outerV[i + 1]![2]];
          pushTriangle(out, a2, b2, fb, n, FASCIA_COLOR, ROOF_PART_FASCIA); pushTriangle(out, a2, fb, fa, n, FASCIA_COLOR, ROOF_PART_FASCIA);
          if (rake) {
            const gable = gableAt(x, z), ta = outerV[i]!, tb = outerV[i + 1]!;
            if (tb[1] > eave + EPS) pushTriangle(out, fa, fb, tb, n, gable, ROOF_PART_GABLE);
            if (ta[1] > eave + EPS) pushTriangle(out, fa, tb, ta, n, gable, ROOF_PART_GABLE);
          }
        }
      }
    }
    flushRow(x1);
  }
  return out;
}

/** Complete roof of these cells (all components, whole map). */
export function pitchedRoofFaces(width: number, height: number, cells: readonly RoofCell[], options: PitchedRoofOptions, out: RoofFaces = emptyRoofFaces()): { faces: RoofFaces; components: RoofComponent[] } {
  const field = roofField(width, height, cells, options);
  if (field.components.length) emitPitchedRoof(field, () => true, 0, 0, width, height, out);
  return { faces: out, components: [...field.components] };
}
