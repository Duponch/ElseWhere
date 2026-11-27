import * as THREE from 'three/webgpu';
import type {ForestrySpecies291} from '../sim/forestry-content-291';
import type {TreePrimitiveKind} from './models/TreeModels';
import {createStylizedSurfaceTexture} from './stylized-surfaces';

/** Neutral, hand-shaped paint illustrations. The existing model/material tint
 * still owns species, season, growth, blight and selection colour. A tile is
 * selected on the immutable part, never by a material, texture or shader
 * branch per resource. */
const motifs = [
  'wash', 'bark', 'birch', 'bamboo', 'oak-leaves', 'poplar-leaves',
  'needle', 'palm', 'cactus', 'leaf', 'grass', 'seed', 'cotton',
  'hop-cone', 'mushroom', 'fruit',
] as const;
export type NaturalPaintMotif = typeof motifs[number];

export const NATURAL_ART_SIZE = 256;
/** Whole leaves, fruit and seed heads intentionally follow their model. Bark,
 * needles and washes describe a material and use its physical surface metric. */
export function naturalArtUsesPhysicalMetric(motif:NaturalPaintMotif):boolean {
  return motif==='wash'||motif==='bark'||motif==='birch'||motif==='bamboo'||motif==='needle'||motif==='cactus'||motif==='grass';
}
const TILE = 64, GUTTER = 8, INNER = TILE - GUTTER * 2;
const clamp = (value: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, value));
function hash(x: number, y: number, salt: number): number {
  let n = Math.imul(x + 157, 0x1f123bb5) ^ Math.imul(y + 73, 0x5f356495) ^ Math.imul(salt + 13, 0x1b873593);
  n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  return ((n ^ n >>> 15) >>> 0) / 4294967295;
}
function stroke(distance: number, width: number): number {
  return clamp((width + .018 - Math.abs(distance)) / .028);
}
function line(x: number, y: number, ax: number, ay: number, bx: number, by: number, width: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return stroke(Math.hypot(x - ax - dx * t, y - ay - dy * t), width);
}
function leaf(x: number, y: number, cx: number, cy: number, angle: number, length: number, width: number, lobed = false): number {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const u = (x - cx) * cos + (y - cy) * sin;
  const v = (y - cy) * cos - (x - cx) * sin;
  const along = u / length + .5;
  if (along <= 0 || along >= 1) return 0;
  // A tapered silhouette with uneven margins, an articulated midrib and
  // branching veins, following the shape of each drawn leaf.
  const edge = Math.sin(along * Math.PI) ** .8 * width * (lobed ? .86 + .16 * Math.sin(along * Math.PI * 7) : 1);
  if (Math.abs(v) > edge) return 0;
  let tone = v < 0 ? 20 : -18;
  tone -= 24 * stroke(edge - Math.abs(v), .012);
  tone += 28 * stroke(v, .009);
  for (const branch of [.22, .42, .62]) {
    tone += 13 * line(along, Math.abs(v) / length, branch, 0, branch + .18, .13, .009);
  }
  return tone;
}
function canopy(x: number, y: number, motif: 'oak-leaves'|'poplar-leaves'|'palm'): number {
  if (motif === 'palm') {
    const dy = y - .14, dx = x - .5;
    let pigment = 28 * stroke(dx, .027);
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const root = .1 + i * .16;
        pigment -= 28 * line(dx, dy, 0, root, sign * (.35 - i * .025), root + .25, .025);
        pigment += 22 * line(dx, dy, 0, root + .026, sign * (.35 - i * .025), root + .276, .012);
      }
    }
    return pigment;
  }
  const oak = motif === 'oak-leaves';
  return leaf(x,y,.29,.73,-.65,oak?.34:.4,.115,oak)
    + leaf(x,y,.73,.7,.72,.42,.115,oak)
    + leaf(x,y,.43,.4,1.3,.46,.13,oak)
    + leaf(x,y,.83,.24,.3,.34,.105,oak)
    + leaf(x,y,.15,.17,-1,.36,.1,oak)
    - 18 * line(x,y,.34,.02,.55,.93,.022);
}
function art(x: number, y: number, motif: NaturalPaintMotif): number {
  if (motif === 'bark' || motif === 'birch' || motif === 'bamboo') {
    if (motif === 'birch') {
      // Dark lenticels and broken horizontal scar lines on pale bark.
      let t = 21 - 14 * stroke(x - .37 - .04 * Math.sin(y * 6), .038);
      for (let i=0; i<9; i++) {
        const cx = hash(i,1,7), cy = (i + .4) / 9;
        t -= (35 + hash(i,3,17) * 75) * line(x,y,cx-.14,cy,cx+.14,cy+.013,.014);
      }
      return t;
    }
    if (motif === 'bamboo') {
      const nodes = Math.min(Math.abs(y-.23),Math.abs(y-.63));
      return -56 * stroke(nodes,.024) + 21 * stroke(nodes-.04,.012) + 21 * stroke(x-.27,.05);
    }
    const knot = Math.hypot((x-.33)*1.6,(y-.56)*.75);
    const flow = x + .045*Math.sin(y*8) + .1*Math.exp(-knot*knot*10)*Math.sign(x-.33);
    return 19*Math.sin(flow*28) - 45*stroke(Math.sin(flow*17+.6),.11)
      - 37*stroke(knot-.16,.016) + 19*stroke(knot-.205,.014);
  }
  if (motif === 'oak-leaves' || motif === 'poplar-leaves' || motif === 'palm') return canopy(x,y,motif);
  if (motif === 'needle') {
    let t = -32*line(x,y,.12,.03,.86,.95,.02);
    for (let i=0; i<8; i++) {
      const a=.10+i*.105, b=.03+i*.13;
      t += 25*line(x,y,a,b,a-.27,b+.18,.012) - 28*line(x,y,a,b,a+.22,b+.22,.016);
    }
    return t;
  }
  if (motif === 'cactus') {
    const rib = x*4.0 + .018*Math.sin(y*9);
    const ridge = Math.abs(rib - Math.round(rib));
    let t = 22*Math.cos(rib*2*Math.PI) - 28*stroke(ridge-.43,.035);
    for(let i=0;i<5;i++)t -= 42*stroke(Math.hypot(ridge*.3, y-(i+.5)/5),.014);
    return t;
  }
  if (motif === 'leaf') return leaf(x,y,.5,.5,Math.PI/2,1.08,.39)
    - 19*stroke(x-.27-.10*Math.sin(y*5),.016);
  if (motif === 'grass') return 32*stroke(x-.54-.04*Math.sin(y*7),.028) - 24 * stroke(x-.19,.05) + y*22-9;
  if (motif === 'seed' || motif === 'hop-cone') {
    const scale = motif === 'hop-cone' ? .03 : .017;
    let t = 16 * stroke(x-.5,.018);
    for (let i=0;i<6;i++) for (const sign of [-1,1]) {
      const a=.10+i*.14;
      t += 22 * line(x,y,.5,a,.5+sign*.28,a+.11,scale) - 26*line(x,y,.5,a+.04,.5+sign*.28,a+.15,scale);
    }
    return t;
  }
  if (motif === 'cotton') {
    const p = Math.atan2(y-.49,x-.51), r = Math.hypot(y-.49,x-.51);
    return 21*Math.sin(p*5+.3)*clamp(r*3) - 32*stroke(Math.sin(p*2.5)*r,.025) + 25*(1-r);
  }
  if (motif === 'mushroom') {
    // Radial fibres and a lighter outer margin on the fungi caps.
    const p = Math.atan2(y-.5,x-.5), r = Math.hypot(y-.5,x-.5);
    return 26 * stroke(r-.39,.04) - 19 * stroke(Math.sin(p*11)*r,.018) + 18*(1-r);
  }
  if (motif === 'fruit') return 28 * clamp(1 - Math.hypot(x-.30,y-.72)*3.2) - 31 * clamp((Math.hypot(x-.34,y-.62)-.45)*4);
  return 0;
}

/** Four-by-four texture atlas. Eight texels of duplicated edge provide space
 * for bilinear/mipmap filtering at the ordinary zoom, with similar mean
 * pigment across the distant mip tail. No Canvas or additional draw passes. */
export function naturalSurfaceArtworkPixels(previous?: THREE.Texture,personalized=true):Uint8Array {
  const valid = previous instanceof THREE.DataTexture && previous.image.width === 64
    && previous.image.height === 64 && previous.image.data instanceof Uint8Array;
  const temporary = valid ? undefined : createStylizedSurfaceTexture('vegetation');
  const old = (valid ? previous : temporary!) as THREE.DataTexture;
  const base = old.image.data as Uint8Array;
  const pixels = new Uint8Array(NATURAL_ART_SIZE * NATURAL_ART_SIZE * 4);
  for (const [tile, motif] of motifs.entries()) for (let py=0;py<TILE;py++) for (let px=0;px<TILE;px++) {
    const x = clamp((px+.5-GUTTER)/INNER), y = clamp((py+.5-GUTTER)/INNER);
    const sx = Math.floor(x*63), sy = Math.floor(y*63);
    const oldValue = base[(sy*64+sx)*4]!;
    const grain = (hash(sx,sy,tile)-.5)*14;
    const variation = !personalized || motif === 'wash' ? oldValue : 201 + (oldValue-204)*.26 + art(x,y,motif) + grain;
    const at = (((tile >> 2)*TILE+py)*NATURAL_ART_SIZE+(tile%4)*TILE+px)*4;
    pixels[at]=pixels[at+1]=pixels[at+2]=Math.round(clamp(variation,73,255));
    pixels[at+3]=255;
  }
  temporary?.dispose();
  return pixels;
}

export function createNaturalSurfaceArtwork(previous?: THREE.Texture): THREE.DataTexture {
  const pixels=naturalSurfaceArtworkPixels(previous);
  const texture = new THREE.DataTexture(pixels,NATURAL_ART_SIZE,NATURAL_ART_SIZE,THREE.RGBAFormat);
  texture.name = 'Natural part paint — bark, leaf, stems and fruit';
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

export function naturalArtUv(motif: NaturalPaintMotif, u: number, v: number): readonly [number,number] {
  const tile = motifs.indexOf(motif);
  const start = GUTTER+.5, span = INNER-1;
  return [((tile%4)*TILE+start+clamp(u)*span)/NATURAL_ART_SIZE,((tile>>2)*TILE+start+clamp(v)*span)/NATURAL_ART_SIZE];
}

export function treeArtMotif(species: ForestrySpecies291|undefined, primitive: TreePrimitiveKind): NaturalPaintMotif {
  if (primitive === 'cactus') return 'cactus';
  if (primitive === 'trunk') return species === 'birch' ? 'birch' : species === 'bamboo' ? 'bamboo' : 'bark';
  if (species === 'pine' || species === 'cypress' || primitive === 'cone') return 'needle';
  if (species === 'palm' || species === 'drago' || species === 'cecropia') return 'palm';
  if (species === 'poplar' || species === 'willow' || species === 'bamboo') return 'poplar-leaves';
  return 'oak-leaves';
}

/** Broad authored pigment at the existing vertices gives both styles an
 * organic structure independent of the fine Pastel illustration. */
export function naturalVertexTone(motif:NaturalPaintMotif,u:number,v:number):number {
  if (motif === 'wash' || motif === 'fruit') return 1;
  if (motif === 'bark' || motif === 'birch' || motif === 'bamboo') return .87 + .1*clamp(v) + .03*Math.sin(u*2*Math.PI)**2;
  if (motif === 'mushroom' || motif === 'cotton' || motif === 'seed' || motif === 'hop-cone') return .86+.14*clamp(v);
  return .80 + .2*clamp(v);
}
