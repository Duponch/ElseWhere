import { PARTICLE_FAMILIES, FAMILY_FIRST_CELL, PARTICLE_CELL_COUNT, type ParticleFamily } from './action-particle-catalogue';

/** Drawn sprites of the action particles, painted once at load into two
 * atlas layers: 0 Pastel (soft chalk edges, paper tooth, lighter pigment) and
 * 1 Gouache (flat opaque pigment, bristle tracks, a thin dark ink contour).
 * The same deterministic brush language as the other painted bitmaps of the
 * game (fire paper, cloud and surface paints): hashed grain, never a random
 * call, so the atlas is identical on every load. Presentation only. */
export const ATLAS_CELL = 32;
export const ATLAS_COLUMNS = 16;
export const ATLAS_ROWS = 8;
export const ATLAS_WIDTH = ATLAS_CELL * ATLAS_COLUMNS;
export const ATLAS_HEIGHT = ATLAS_CELL * ATLAS_ROWS;
/** Transparent border kept around each sprite (mip levels 0–2 stay clean). */
const MARGIN = 3;
const INNER = ATLAS_CELL - 2 * MARGIN;
if (PARTICLE_CELL_COUNT > ATLAS_COLUMNS * ATLAS_ROWS) throw Error('Action particle atlas is full');

type Rgb = readonly [number, number, number];
type Style = 'pastel' | 'gouache';
const hex = (value: number): Rgb => [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scaleRgb = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];
const clamp = (v: number, lo = 0, hi = 1) => v < lo ? lo : v > hi ? hi : v;
const smooth = (lo: number, hi: number, v: number) => { const t = clamp((v - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
function grain(x: number, y: number, salt = 0): number {
  let n = Math.imul(x + 29 + salt * 131, 0x1f123bb5) ^ Math.imul(y + 17 - salt * 71, 0x5f356495);
  n = Math.imul(n ^ n >>> 15, 0x2c1b3c6d);
  return ((n ^ n >>> 12) >>> 0) / 4294967296;
}
/** Deterministic value in [0,1) for a sprite parameter. */
const rand = (family: number, variant: number, n: number) => grain(family * 97 + n * 13, variant * 53 + n * 7, n + 5);
const INK: Rgb = hex(0x2b2320);
const PAPER: Rgb = hex(0xf6efe0);

// Signed distance helpers in sprite space ([-1, 1]², +y up).
type Sdf = (x: number, y: number) => number;
const circle = (cx: number, cy: number, r: number): Sdf => (x, y) => Math.hypot(x - cx, y - cy) - r;
const ellipse = (cx: number, cy: number, rx: number, ry: number, angle = 0): Sdf => {
  const c = Math.cos(angle), s = Math.sin(angle), k = Math.min(rx, ry);
  return (x, y) => { const dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry; return (Math.hypot(u, v) - 1) * k; };
};
function segment(ax: number, ay: number, bx: number, by: number, r0: number, r1 = r0): Sdf {
  return (x, y) => { const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay, t = clamp((px * dx + py * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(px - dx * t, py - dy * t) - (r0 + (r1 - r0) * t); };
}
/** Exact polygon distance (Inigo Quilez's sdPolygon). */
function polygon(points: readonly (readonly [number, number])[]): Sdf {
  return (x, y) => {
    let d = (x - points[0]![0]) ** 2 + (y - points[0]![1]) ** 2, s = 1;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i++) {
      const [ix, iy] = points[i]!, [jx, jy] = points[j]!, ex = jx - ix, ey = jy - iy, wx = x - ix, wy = y - iy;
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1)), bx = wx - ex * t, by = wy - ey * t;
      d = Math.min(d, bx * bx + by * by);
      const c1 = y >= iy, c2 = y < jy, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  };
}
const union = (...shapes: Sdf[]): Sdf => (x, y) => { let d = Infinity; for (const f of shapes) d = Math.min(d, f(x, y)); return d; };
const subtract = (a: Sdf, b: Sdf): Sdf => (x, y) => Math.max(a(x, y), -b(x, y));
/** Irregular rounded polygon around the origin (chips, clods, crumbs). */
function shard(family: number, variant: number, corners: number, radius: number, roughness: number, stretch = 1, angle = 0): Sdf {
  const points: [number, number][] = [];
  for (let i = 0; i < corners; i++) {
    const a = angle + (i + rand(family, variant, 20 + i) * .55) / corners * Math.PI * 2;
    const r = radius * (1 - roughness + roughness * 2 * rand(family, variant, 40 + i));
    points.push([Math.cos(a) * r * stretch, Math.sin(a) * r / stretch]);
  }
  return polygon(points);
}
/** Puffy cloud of overlapping circles. */
function cloud(family: number, variant: number, lobes: number, spread: number, size: number): Sdf {
  const parts: Sdf[] = [circle(0, 0, size)];
  for (let i = 0; i < lobes; i++) {
    const a = (i + rand(family, variant, 60 + i) * .6) / lobes * Math.PI * 2, d = spread * (.55 + .45 * rand(family, variant, 70 + i));
    parts.push(circle(Math.cos(a) * d, Math.sin(a) * d * .85, size * (.55 + .35 * rand(family, variant, 80 + i))));
  }
  return union(...parts);
}

interface Brush {
  /** Pigment at a sprite point (light from the upper left). */
  color: Rgb | ((x: number, y: number) => Rgb);
  /** 0 = no ink line in Gouache. */
  ink?: number;
  opacity?: number;
  /** Soft-edged (dust, smoke): wider edge, no ink, chalk breakup in Pastel. */
  soft?: number;
  /** Emissive glow halo (sparks): additive-looking bright core. */
  glow?: boolean;
}

class CellPainter {
  constructor(private readonly data: Uint8Array, private readonly cell: number, private readonly style: Style, private readonly salt: number) {}
  /** Fills the transparent cell with a colour so filtering never darkens edges. */
  clear(color: Rgb): void {
    this.forPixels((index) => { this.data[index] = color[0] * 255; this.data[index + 1] = color[1] * 255; this.data[index + 2] = color[2] * 255; this.data[index + 3] = 0; }, true);
  }
  paint(shape: Sdf, brush: Brush): void {
    const pastel = this.style === 'pastel', pixel = 2 / INNER;
    const edge = (brush.soft ?? 0) > 0 ? brush.soft! : pastel ? 1.4 * pixel : .75 * pixel;
    const ink = pastel ? 0 : (brush.ink ?? 1) * 1.35 * pixel;
    this.forPixels((index, x, y, px, py) => {
      const d = shape(x, y);
      if (d > edge * 1.5) return;
      let alpha = (brush.soft ?? 0) > 0 ? 1 - smooth(-edge, edge * .6, d) : clamp(.5 - d / edge);
      if (alpha <= 0) return;
      let color = typeof brush.color === 'function' ? brush.color(x, y) : brush.color;
      const tooth = grain(px, py, this.salt), wash = grain(px >> 2, py >> 2, this.salt + 3);
      if (pastel) {
        // Dry chalk: lighter pigment, paper tooth breaking the edge.
        color = mixRgb(color, PAPER, .12 + .08 * wash);
        color = scaleRgb(color, .94 + .1 * tooth);
        if ((brush.soft ?? 0) === 0) {
          const rim = smooth(-2.6 * pixel, 0, d);
          color = mixRgb(color, scaleRgb(color, .74), rim * .5);
          alpha *= 1 - rim * (tooth < .3 ? .75 : .08);
        } else alpha *= .82 + .18 * tooth;
      } else {
        // Gouache: opaque flat pigment, bristle tracks along a diagonal, ink.
        const bristle = grain(Math.floor((x + y * .6) * 22), Math.floor(y * 3), this.salt + 9);
        color = scaleRgb(color, .93 + .09 * bristle + .04 * wash);
        if (ink > 0 && (brush.soft ?? 0) === 0) {
          const line = smooth(-ink, -ink * .35, d);
          color = mixRgb(color, INK, line * .78);
        }
      }
      if (brush.glow) { const core = 1 - smooth(-.5, 0, d); color = mixRgb(color, [1, 1, .92], core * .65); }
      alpha *= brush.opacity ?? 1;
      const a0 = this.data[index + 3]! / 255, out = alpha + a0 * (1 - alpha);
      if (out <= 0) return;
      for (let k = 0; k < 3; k++) {
        const below = this.data[index + k]! / 255, value = (clamp(color[k]!) * alpha + below * a0 * (1 - alpha)) / out;
        this.data[index + k] = Math.round(clamp(value) * 255);
      }
      this.data[index + 3] = Math.round(clamp(out) * 255);
    });
  }
  private forPixels(visit: (index: number, x: number, y: number, px: number, py: number) => void, whole = false): void {
    const cx = (this.cell % ATLAS_COLUMNS) * ATLAS_CELL, cy = Math.floor(this.cell / ATLAS_COLUMNS) * ATLAS_CELL;
    const from = whole ? 0 : MARGIN - 1, to = whole ? ATLAS_CELL : ATLAS_CELL - MARGIN + 1;
    for (let j = from; j < to; j++) for (let i = from; i < to; i++) {
      const px = cx + i, py = cy + j, x = ((i + .5) - MARGIN) / INNER * 2 - 1, y = 1 - ((j + .5) - MARGIN) / INNER * 2;
      visit((py * ATLAS_WIDTH + px) * 4, x, y, px, py);
    }
  }
}

/** Shading of a faceted chip: lit upper-left facet, darker lower-right. */
const facet = (light: Rgb, dark: Rgb, nx: number, ny: number) => (x: number, y: number): Rgb => mixRgb(light, dark, smooth(-.15, .15, x * nx + y * ny));

type FamilyPainter = (p: CellPainter, variant: number, family: number, style: Style) => void;
const PAINTERS: Readonly<Record<ParticleFamily, FamilyPainter>> = {
  'wood-chip': (p, v, f) => {
    const chip = shard(f, v, 5, .78, .3, 1.35, rand(f, v, 1) * Math.PI);
    p.clear(hex(0xd9b98a));
    p.paint(chip, { color: (x, y) => mixRgb(hex(0xe8cfa0), hex(0xb48a58), smooth(-.4, .6, x * .5 - y * .8)) });
    p.paint((x, y) => Math.max(chip(x, y), (y - .25 + x * .3) * -1), { color: hex(0x6b4a2f), ink: 0 });
    p.paint(segment(-.45, .05, .45, -.12, .04), { color: hex(0x9b7448), ink: 0, opacity: .7 });
  },
  splinter: (p, v, f) => {
    const a = rand(f, v, 2) * .8 - .4, len = .9;
    const s = segment(-Math.cos(a) * len, -Math.sin(a) * len, Math.cos(a) * len, Math.sin(a) * len, .14, .03);
    p.clear(hex(0xd4b07c));
    p.paint(s, { color: (x, y) => mixRgb(hex(0xead2a2), hex(0xa77d4c), smooth(-.1, .1, -x * Math.sin(a) + y * Math.cos(a))) });
  },
  bark: (p, v, f) => {
    const b = shard(f, v, 6, .72, .25, 1.5, .4);
    p.clear(hex(0x6e4c30));
    p.paint(b, { color: facet(hex(0x8a6240), hex(0x4f3420), .6, -.5) });
    for (let i = 0; i < 3; i++) p.paint(subtract(segment(-.5, -.3 + i * .3, .5, -.2 + i * .3, .035), (x, y) => -b(x, y)), { color: hex(0x3e2817), ink: 0, opacity: .8 });
  },
  sawdust: (p, v, f) => {
    const parts: Sdf[] = [];
    for (let i = 0; i < 7; i++) parts.push(circle((rand(f, v, i) - .5) * 1.4, (rand(f, v, i + 9) - .5) * 1.4, .13 + .1 * rand(f, v, i + 30)));
    p.clear(hex(0xdcc08e));
    p.paint(union(...parts), { color: facet(hex(0xead3a2), hex(0xbd9a64), .5, -.6), ink: .5 });
  },
  'stone-chip': (p, v, f) => {
    const chip = shard(f, v, 5 + (v & 1), .82, .32, 1.15, rand(f, v, 3) * Math.PI);
    p.clear(hex(0xd8d6d0));
    p.paint(chip, { color: facet(hex(0xf2f0ea), hex(0xa6a39c), .7, -.7) });
    p.paint((x, y) => Math.max(chip(x, y), x * .6 - y * .8 - .05), { color: hex(0x8e8b85), ink: 0, opacity: .55 });
  },
  gravel: (p, v, f) => {
    const parts: Sdf[] = [];
    for (let i = 0; i < 4; i++) parts.push(shard(f, v * 7 + i, 5, .26 + .1 * rand(f, v, i), .25, 1, i));
    const offsets = [[-.4, .25], [.35, .3], [-.15, -.35], [.42, -.3]] as const;
    p.clear(hex(0xd8d6d0));
    for (let i = 0; i < 4; i++) { const o = offsets[i]!, s = parts[i]!; p.paint((x, y) => s(x - o[0], y - o[1]), { color: facet(hex(0xf0eee8), hex(0xa09d96), .6, -.7) }); }
  },
  dust: (p, v, f) => {
    // Warm grey dust; tinted channels darken it to the rock, soil or material.
    p.clear(hex(0xe2d8c6));
    p.paint(cloud(f, v, 5, .45, .42), { color: (x, y) => mixRgb(hex(0xf1e9da), hex(0xb9ad98), smooth(-.6, .7, x * .4 - y * .7)), soft: .32, opacity: .62 });
    p.paint(cloud(f, v + 4, 3, .25, .26), { color: hex(0xf8f2e6), soft: .25, opacity: .25 });
  },
  smoke: (p, v, f) => {
    p.clear(hex(0xe6e6e6));
    const curl = (x: number, y: number) => cloud(f, v, 4, .35, .34)(x - Math.sin(y * 2.4 + v) * .18, y);
    p.paint(curl, { color: (x, y) => mixRgb(hex(0xfafafa), hex(0xbdbdbd), smooth(-.7, .8, x * .5 - y * .6)), soft: .38, opacity: .8 });
  },
  spark: (p, v, f) => {
    const a = rand(f, v, 4) * .6 - .3;
    p.clear(hex(0xffd27a));
    p.paint(segment(-Math.cos(a) * .85, -Math.sin(a) * .85, Math.cos(a) * .85, Math.sin(a) * .85, .05, .16), { color: hex(0xffb347), ink: 0, glow: true });
    p.paint(circle(Math.cos(a) * .75, Math.sin(a) * .75, .2), { color: hex(0xfff1b8), ink: 0, glow: true });
  },
  ember: (p, v, f) => {
    p.clear(hex(0xff8a3a));
    p.paint(shard(f, v, 6, .62, .2), { color: (x, y) => mixRgb(hex(0xffe08a), hex(0xd8451e), smooth(0, .7, Math.hypot(x, y))), ink: .5, glow: true });
  },
  glint: (p, v) => {
    // A tapered four-ray highlight, the diagonal pair shorter on variant 1.
    p.clear(hex(0xfffbe8));
    const rays: Sdf[] = [circle(0, 0, .17)];
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + (v ? Math.PI / 4 : 0), l = i % 2 ? .62 : .95; rays.push(segment(0, 0, Math.cos(a) * l, Math.sin(a) * l, .13, 0)); }
    p.paint(union(...rays), { color: hex(0xfff3c8), ink: 0, glow: true, soft: .12 });
  },
  shaving: (p, v, f) => {
    p.clear(hex(0xd0d4d8));
    const turns = 1.4 + rand(f, v, 5) * .6, parts: Sdf[] = [];
    for (let i = 0; i < 10; i++) { const t0 = i / 10, t1 = (i + 1) / 10, r0 = .2 + .6 * t0, r1 = .2 + .6 * t1, a0 = t0 * turns * 6.28, a1 = t1 * turns * 6.28;
      parts.push(segment(Math.cos(a0) * r0, Math.sin(a0) * r0 * .7, Math.cos(a1) * r1, Math.sin(a1) * r1 * .7, .09 - .05 * t0)); }
    p.paint(union(...parts), { color: facet(hex(0xf4f6f8), hex(0x8e959c), .5, -.8), ink: .6 });
  },
  cloth: (p, v, f) => {
    const piece = shard(f, v, 4, .8, .22, 1.2, rand(f, v, 6) * Math.PI);
    p.clear(hex(0xf2ecdf));
    p.paint(piece, { color: facet(hex(0xfaf6ee), hex(0xcfc6b4), .5, -.7) });
    for (let i = 0; i < 5; i++) p.paint(segment(-.5 + i * .22, -.15, -.42 + i * .22, -.15, .035), { color: hex(0x8f8574), ink: 0, opacity: .85 });
  },
  thread: (p, v, f) => {
    const parts: Sdf[] = [], phase = rand(f, v, 7) * 6;
    for (let i = 0; i < 12; i++) { const x0 = -.9 + i * .15, x1 = x0 + .15; parts.push(segment(x0, Math.sin(x0 * 3.5 + phase) * .35, x1, Math.sin(x1 * 3.5 + phase) * .35, .06)); }
    p.clear(hex(0xf0ead8));
    p.paint(union(...parts), { color: hex(0xf6f1e4), ink: .6 });
  },
  wool: (p, v, f) => {
    p.clear(hex(0xf4efe2));
    p.paint(cloud(f, v, 6, .42, .36), { color: (x, y) => mixRgb(hex(0xfffcf4), hex(0xd8cfbc), smooth(-.5, .7, x * .4 - y * .7)), ink: .7 });
    for (let i = 0; i < 3; i++) p.paint(ellipse((rand(f, v, i + 50) - .5) * .8, (rand(f, v, i + 60) - .5) * .7, .16, .07, rand(f, v, i) * 3), { color: hex(0xc9bfab), ink: 0, opacity: .6 });
  },
  seed: (p, v, f) => {
    p.clear(hex(0xc8a76a));
    for (let i = 0; i < 4; i++) p.paint(ellipse((rand(f, v, i) - .5) * 1.1, (rand(f, v, i + 4) - .5) * 1.1, .24, .14, rand(f, v, i + 8) * 3.1),
      { color: facet(hex(0xe0c48a), hex(0x8c6a36), .5, -.6), ink: .7 });
  },
  leaf: (p, v, f) => {
    const a = rand(f, v, 8) * 1.2 - .6, greens = [0x7fae5a, 0x9cbf5c, 0x5f9150, 0xc2b45a];
    const body = ellipse(0, 0, .9, .42, a), tip = segment(Math.cos(a) * -.9, Math.sin(a) * -.9, Math.cos(a) * -1.05, Math.sin(a) * -1.05, .05);
    const green = hex(greens[v % greens.length]!);
    p.clear(green);
    p.paint(union(body, tip), { color: facet(mixRgb(green, [1, 1, .9], .22), scaleRgb(green, .7), -Math.sin(a), Math.cos(a)) });
    p.paint(segment(Math.cos(a) * -.8, Math.sin(a) * -.8, Math.cos(a) * .75, Math.sin(a) * .75, .035), { color: scaleRgb(green, .6), ink: 0 });
  },
  grass: (p, v, f) => {
    p.clear(hex(0x86b05c));
    for (let i = 0; i < 3; i++) {
      const x = -.45 + i * .45 + (rand(f, v, i) - .5) * .2, lean = (rand(f, v, i + 3) - .5) * .7;
      p.paint(segment(x, -.85, x + lean, .8 - .3 * rand(f, v, i + 6), .12, .02), { color: facet(hex(0xa8cf72), hex(0x5c8a3e), .7, 0), ink: .6 });
    }
  },
  soil: (p, v, f) => {
    const clod = shard(f, v, 7, .72, .28, 1.1, rand(f, v, 9) * 3);
    p.clear(hex(0xe2d3bd));
    p.paint(clod, { color: facet(hex(0xf3e8d6), hex(0xa89478), .6, -.7) });
    for (let i = 0; i < 4; i++) p.paint(circle((rand(f, v, i + 20) - .5) * .8, (rand(f, v, i + 30) - .5) * .8, .07), { color: hex(0x8c7a60), ink: 0, opacity: .7 });
  },
  droplet: (p, v) => {
    p.clear(hex(0xf4f8fa));
    const drop = union(circle(0, -.25, .5), segment(0, -.2, 0, .8, .42, .02));
    p.paint(drop, { color: (x, y) => mixRgb(hex(0xffffff), hex(0xc8d2d8), smooth(-.4, .5, x * .6 - y * .3)), ink: .7 });
    p.paint(ellipse(-.18, -.18, .14, .2, .4 + v * .2), { color: hex(0xffffff), ink: 0, opacity: .95 });
  },
  blood: (p, v, f) => {
    p.clear(hex(0x8a2a22));
    const main = shard(f, v, 7, .55, .3, 1.1, v);
    p.paint(union(main, circle(.55, .35, .14), circle(-.5, -.4, .1)), { color: facet(hex(0xa8392d), hex(0x5e1712), .5, -.6), ink: .6 });
    p.paint(circle(-.15, .15, .12), { color: hex(0xd46a5a), ink: 0, opacity: .7 });
  },
  bandage: (p, v, f) => {
    const a = rand(f, v, 10) - .5, wave = (x: number) => Math.sin(x * 2.8 + v) * .2;
    p.clear(hex(0xf6f3ea));
    p.paint((x, y) => { const c = Math.cos(a), s = Math.sin(a), u = x * c + y * s, w = -x * s + y * c; return Math.max(Math.abs(u) - .9, Math.abs(w - wave(u)) - .2); },
      { color: facet(hex(0xffffff), hex(0xd6d0c2), .3, -.8) });
    p.paint((x, y) => { const c = Math.cos(a), s = Math.sin(a), u = x * c + y * s, w = -x * s + y * c; return Math.max(Math.abs(u) - .85, Math.abs(w - wave(u)) - .04); },
      { color: hex(0xc8bfae), ink: 0, opacity: .5 });
  },
  crumb: (p, v, f) => {
    p.clear(hex(0xf0e6d2));
    const parts = [[-.35, .3], [.35, .2], [0, -.35]] as const;
    for (let i = 0; i < 3; i++) { const o = parts[i]!, s = shard(f, v * 5 + i, 5, .3, .3); p.paint((x, y) => s(x - o[0], y - o[1]), { color: facet(hex(0xfbf4e6), hex(0xbfae92), .5, -.6) }); }
  },
  meat: (p, v, f) => {
    p.clear(hex(0xc0574a));
    const piece = shard(f, v, 6, .7, .25, 1.2, v * 1.3);
    p.paint(piece, { color: facet(hex(0xd8796a), hex(0x8e3428), .5, -.6) });
    p.paint((x, y) => Math.max(piece(x, y), -(y + .2)), { color: hex(0xf2d8c4), ink: 0, opacity: .55 });
  },
  page: (p, v) => {
    const a = v ? .35 : -.25, c = Math.cos(a), s = Math.sin(a), bend = (u: number) => u * u * .18;
    const sheet: Sdf = (x, y) => { const u = x * c + y * s, w = -x * s + y * c - bend(u); return Math.max(Math.abs(u) - .7, Math.abs(w) - .85); };
    p.clear(hex(0xf6efdc));
    p.paint(sheet, { color: facet(hex(0xfffaf0), hex(0xd9cdb2), .4, -.8) });
    for (let i = 0; i < 5; i++) p.paint((x, y) => { const u = x * c + y * s, w = -x * s + y * c - bend(u); return Math.max(Math.abs(u) - .45, Math.abs(w - .5 + i * .25) - .03); },
      { color: hex(0x6d7f86), ink: 0, opacity: .6 });
  },
  'sleep-z': (p, v) => {
    const k = v ? .9 : 1;
    p.clear(hex(0xf2e6c8));
    p.paint(union(segment(-.55 * k, .62 * k, .55 * k, .62 * k, .17), segment(.52 * k, .55 * k, -.52 * k, -.55 * k, .16), segment(-.55 * k, -.62 * k, .58 * k, -.62 * k, .17)),
      { color: hex(0xf4e8c8), ink: 1.2 });
  },
  snow: (p, v, f) => {
    p.clear(hex(0xf6f9fc));
    for (let i = 0; i < 5; i++) { const s = shard(f, v * 5 + i + 9, 6, .2 + .05 * rand(f, v, i), .2), ox = (rand(f, v, i + 40) - .5) * 1.3, oy = (rand(f, v, i + 50) - .5) * 1.3;
      p.paint((x, y) => s(x - ox, y - oy), { color: facet(hex(0xffffff), hex(0xc7d6e2), .5, -.6), ink: .5 }); }
  },
  ash: (p, v, f) => {
    p.clear(hex(0x6a6764));
    p.paint(shard(f, v, 6, .62, .35, 1.4, v), { color: facet(hex(0x8f8b86), hex(0x45423f), .5, -.6), ink: .4 });
  },
  foam: (p, v, f) => {
    p.clear(hex(0xfbf8f0));
    p.paint(cloud(f, v, 5, .4, .34), { color: facet(hex(0xffffff), hex(0xe2d8c0), .4, -.7), ink: .6 });
    for (let i = 0; i < 4; i++) p.paint(subtract(circle((rand(f, v, i) - .5) * .8, (rand(f, v, i + 5) - .5) * .7, .14), circle((rand(f, v, i) - .5) * .8, (rand(f, v, i + 5) - .5) * .7, .08)),
      { color: hex(0xc9bea4), ink: 0, opacity: .6 });
  },
};

/** RGBA8 data of both layers (Pastel then Gouache), each ATLAS_WIDTH × ATLAS_HEIGHT. */
export function paintActionParticleAtlas(): Uint8Array {
  const layer = ATLAS_WIDTH * ATLAS_HEIGHT * 4, data = new Uint8Array(layer * 2);
  const styles: readonly Style[] = ['pastel', 'gouache'];
  styles.forEach((style, l) => {
    const view = data.subarray(l * layer, (l + 1) * layer);
    PARTICLE_FAMILIES.forEach((family, f) => {
      for (let variant = 0; variant < family.variants; variant++) {
        const cell = FAMILY_FIRST_CELL[family.id] + variant;
        PAINTERS[family.id](new CellPainter(view, cell, style, cell * 7 + l * 101), variant, f, style);
      }
    });
  });
  return data;
}
