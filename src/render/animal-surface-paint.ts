import * as THREE from 'three/webgpu';
import { attribute, texture } from 'three/tsl';
import { referencePaintProfiles } from './origami/reference-profiles';
import { corpseVisualPartBit } from './corpse-presentation';

export type AnimalCoat = 'soft' | 'short' | 'shaggy';
const SIZE = 256;
const TILE = 64, GUTTER = 8, INTERIOR = TILE - 2 * GUTTER;
/** Every species uses one of these sixteen authored panels, in the same three
 * resident 256² textures. RGB is premultiplied coloured pastel; alpha is the
 * remaining strength of the actual part's base pigment. */
export const ANIMAL_PASTEL_PANELS = [
  'plain','belly','gazelle','muzzle','spots','tabby','scales','shell',
  'feathers','tail','folds','wool','saddle','mask','stocking','sac',
] as const;
export type AnimalPastelPanel = typeof ANIMAL_PASTEL_PANELS[number];
const PIGMENTS = {
  cream: new THREE.Color('#e8dec8'), white: new THREE.Color('#eae9dc'),
  dark: new THREE.Color('#35271f'), slate: new THREE.Color('#434b4b'),
  shell: new THREE.Color('#4b3c25'), amber: new THREE.Color('#f5ce72'),
};
const clamp = (x: number) => Math.min(1, Math.max(0, x));

function hash(index: number, salt: number): number {
  let value = Math.imul(index + 31, 0x1f123bb5) ^ Math.imul(salt + 73, 0x5f356495);
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  return ((value ^ (value >>> 12)) >>> 0) / 0xffffffff;
}

function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function wash(x: number, y: number, cells: number, salt: number): number {
  const px = x / SIZE * cells, py = y / SIZE * cells;
  const ix = Math.floor(px), iy = Math.floor(py), tx = smooth(px - ix), ty = smooth(py - iy);
  const sample = (a: number, b: number): number => hash(((a + cells) % cells) + ((b + cells) % cells) * cells, salt);
  return (sample(ix, iy) * (1 - tx) + sample(ix + 1, iy) * tx) * (1 - ty)
    + (sample(ix, iy + 1) * (1 - tx) + sample(ix + 1, iy + 1) * tx) * ty;
}

/** Paint a tapered curved mark into the existing colour sample. Rasterisation
 * wraps at tile edges, so neither a repeated border nor a square patch appears.
 * This is construction-time work; there is no stroke node in the shader. */
function curve(field: Float32Array, x: number, y: number, length: number, bend: number, angle: number, width: number, pigment: number, salt: number): void {
  const c = Math.cos(angle), s = Math.sin(angle), steps = Math.ceil(length * 1.5);
  for (let step = 0; step <= steps; step++) {
    const t = step / steps, across = bend * 4 * t * (1 - t), along = (t - .5) * length;
    const cx = x + along * c - across * s, cy = y + along * s + across * c;
    const taper = .28 + .72 * Math.sin(Math.PI * t);
    const radius = width * taper, bound = Math.ceil(radius + 1);
    for (let iy = Math.floor(cy) - bound; iy <= Math.floor(cy) + bound; iy++) {
      for (let ix = Math.floor(cx) - bound; ix <= Math.floor(cx) + bound; ix++) {
        const coverage = 1 - smooth((Math.hypot(ix + .5 - cx, iy + .5 - cy) - radius * .35) / Math.max(.7, radius * .8));
        if (coverage <= 0) continue;
        const wrappedX = (ix % SIZE + SIZE) % SIZE, wrappedY = (iy % SIZE + SIZE) % SIZE;
        const at = wrappedY * SIZE + wrappedX;
        // Dry pastel leaves broken edges and small gaps within the stroke.
        const chalk = .55 + hash(wrappedX + wrappedY * SIZE, salt) * .45;
        const target = pigment + (hash(wrappedX + wrappedY * SIZE, salt + 19) - .5) * 12;
        field[at] = field[at]! + (target - field[at]!) * coverage * chalk * .42;
      }
    }
  }
}

interface PastelInk { weight: number; pigment: THREE.Color }
function panelInk(panel: AnimalPastelPanel, u: number, v: number, grain: number): PastelInk {
  // Coordinates are fixed to the bind-space part, v=0 belly/feet, u=1 nose.
  // A small ragged edge follows the authored drawing, never the world camera.
  const edge = grain * .025;
  const zone = (value: number, width = .035) => smooth((value + width * .5 + edge) / width);
  const stroke = (distance: number, width: number) => 1 - zone(Math.abs(distance) - width, .018);
  const pale = (weight: number): PastelInk => ({ weight, pigment: PIGMENTS.cream });
  const dark = (weight: number): PastelInk => ({ weight, pigment: PIGMENTS.dark });
  const shade = (weight: number): PastelInk => ({ weight, pigment: PIGMENTS.slate });
  switch (panel) {
    case 'gazelle': {
      const belly = .33 + Math.sin(u * Math.PI * 2) * .026;
      const top = belly + .19 + Math.sin(u * 11) * .014;
      if (v + edge < belly) return pale(.94 * (1 - zone(v - belly, .045)));
      return dark(.94 * zone(v - belly, .045) * (1 - zone(v - top, .065)));
    }
    case 'belly': return pale(.54 * (1 - zone(v - (.34 + Math.sin(u * Math.PI) * .075), .19)));
    case 'muzzle': return pale(.92 * zone(u - .60, .35));
    case 'spots': {
      // Uneven, separate feline spots, drawn once on the full flank.
      let amount = 0;
      for (let spot = 0; spot < 21; spot++) {
        const x = .08 + .84 * hash(spot, 181), y = .08 + .84 * hash(spot, 197);
        const rx = .025 + hash(spot, 211) * .052, ry = .035 + hash(spot, 223) * .038;
        amount = Math.max(amount, (1 - zone(Math.hypot((u - x) / rx, (v - y) / ry) - .83, .30)) * .72);
      }
      return dark(amount);
    }
    case 'tabby': {
      const bands = Math.sin((u * 5.7 + .21 * Math.sin(v * 7) + .13 * v) * Math.PI * 2);
      return dark(zone(bands - .60, .25) * (.27 + v * .45) * zone(v - .18, .14));
    }
    case 'scales': {
      const row = Math.floor(v * 5.5), x = ((u * 7 + row * .5) % 1 + 1) % 1;
      const y = (v * 5.5) % 1;
      return shade(.36 * stroke(y - (.22 + .43 * Math.sin(x * Math.PI)), .055));
    }
    case 'shell': {
      const y = v * 3, row = Math.floor(y), x = u * 4 + (row % 2) * .5;
      const localX = x - Math.floor(x), localY = y - row;
      const ring = Math.max(Math.abs(localX - .5), Math.abs(localY - .5) * .85 + Math.abs(localX - .5) * .35);
      return { weight: .63 * zone(ring - .41, .13), pigment: PIGMENTS.shell };
    }
    case 'feathers': {
      const x = ((u * 6 + Math.floor(v * 4) * .5) % 1 + 1) % 1;
      const y = (v * 4) % 1;
      const barb = stroke(y - (.12 + .62 * Math.abs(x - .5)), .045);
      return shade(.29 * Math.max(barb, stroke(x - .5, .035) * .6));
    }
    case 'tail': return dark(.72 * zone(Math.sin((u * 4.2 + .05 * Math.sin(v * 13)) * Math.PI * 2) - .15, .5));
    case 'folds': {
      const wrinkles = Math.sin((u * 4.4 + .22 * Math.sin(v * 7) + .12 * Math.cos(v * 15)) * Math.PI * 2);
      return shade(.34 * zone(wrinkles - .82, .30));
    }
    case 'wool': {
      const row = Math.floor(v * 4), x = ((u * 5.5 + row * .5) % 1 + 1) % 1;
      const scallop = Math.sin(x * Math.PI), y = v * 4 - row;
      return shade(.25 * stroke(y - (.23 + .38 * scallop), .08));
    }
    case 'saddle': return dark(.37 * zone(v - (.65 - Math.sin(u * Math.PI) * .12), .22));
    case 'mask': {
      const patch = Math.hypot((u - .59) / .35, (v - .59) / .23);
      return dark(.87 * (1 - zone(patch - .82, .26)));
    }
    case 'stocking': return dark(.66 * (1 - zone(v - .32, .16)));
    case 'sac': {
      const curve = Math.abs(Math.sin((u * 3 + .6 * (v - .5)) * Math.PI * 2));
      return { weight: .42 + .34 * (1 - zone(curve - .15, .20)), pigment: PIGMENTS.amber };
    }
    default: return dark(0);
  }
}

/** Three shared coats, now with dry-pastel anatomical panels. Atlas dimensions,
 * format, mip count and number of textures are unchanged. Gutters repeat the
 * nearest panel pixels so bilinear/trilinear filtering stays inside the paint
 * at normal zoom; very distant mips blend only subpixel detail. */
export function createAnimalCoatPixels(coat: AnimalCoat, personalized = true): Uint8Array {
  const field = new Float32Array(SIZE * SIZE), salt = coat === 'soft' ? 41 : coat === 'short' ? 89 : 137;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    field[y * SIZE + x] = 233 + (wash(x, y, 3, salt) - .5) * 23
      + (wash(x, y, 7, salt + 13) - .5) * 11 + (hash(x + y * SIZE, salt) - .5) * 9;
  }
  const count = coat === 'shaggy' ? 190 : coat === 'soft' ? 260 : 330;
  for (let i = 0; i < count; i++) {
    const x = hash(i, salt + 1) * SIZE, y = hash(i, salt + 2) * SIZE;
    const length = coat === 'shaggy' ? 24 + hash(i, salt + 3) * 28
      : coat === 'soft' ? 13 + hash(i, salt + 3) * 17 : 9 + hash(i, salt + 3) * 14;
    const angle = coat === 'short' ? -.5 + hash(i, salt + 4) * .8
      : coat === 'soft' ? -.85 + hash(i, salt + 4) * 1.45 : -1.85 + hash(i, salt + 4) * .9;
    const bend = (coat === 'shaggy' ? 4 + hash(i, salt + 5) * 9 : 1.3 + hash(i, salt + 5) * 3.2)
      * (hash(i, salt + 6) > .5 ? 1 : -1);
    const width = coat === 'shaggy' ? 1.8 + hash(i, salt + 7) * 1.2 : 1.1 + hash(i, salt + 7) * .7;
    // A bright rubbed edge beside the shadow makes individual tufts legible,
    // while the grayscale pigment preserves blue, cream and ochre identities.
    curve(field, x - Math.sin(angle) * 1.8, y + Math.cos(angle) * 1.8,
      length * .92, bend, angle, width * 1.1, 254, salt + 11);
    curve(field, x, y, length, bend, angle, width, 137 + hash(i, salt + 8) * 32, salt + 17);
    if (coat === 'shaggy' && i % 3 === 0) {
      curve(field, x + 3, y - 2, length * .53, -bend * .7, angle - .38, width * .7, 167, salt + 23);
    }
  }
  const bytes = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const panel = ANIMAL_PASTEL_PANELS[Math.floor(x / TILE) + 4 * Math.floor(y / TILE)]!;
    const tx = Math.max(GUTTER, Math.min(TILE - GUTTER - 1, x % TILE));
    const ty = Math.max(GUTTER, Math.min(TILE - GUTTER - 1, y % TILE));
    const u = (tx - GUTTER + .5) / INTERIOR, v = (ty - GUTTER + .5) / INTERIOR;
    const pattern = field[(y - y % TILE + ty) * SIZE + (x - x % TILE + tx)]!;
    const shade = .28 + .8 * clamp(pattern / 255);
    const ink = personalized ? panelInk(panel, u, v, hash(tx + ty * TILE, salt + 31) - .5) : {weight:0,pigment:PIGMENTS.dark};
    const weight = clamp(ink.weight), at = (y * SIZE + x) * 4;
    // Linear RGBA8 stores a tinted overlay plus residual base. Adjacent
    // texels interpolate their premultiplied mixture without a second read.
    bytes[at] = Math.round(clamp(ink.pigment.r * weight * shade) * 255);
    bytes[at + 1] = Math.round(clamp(ink.pigment.g * weight * shade) * 255);
    bytes[at + 2] = Math.round(clamp(ink.pigment.b * weight * shade) * 255);
    bytes[at + 3] = Math.round(clamp((1 - weight) * shade / 1.08) * 255);
  }
  return bytes;
}

export function createAnimalCoatTexture(coat: AnimalCoat): THREE.DataTexture {
  const map = new THREE.DataTexture(createAnimalCoatPixels(coat), SIZE, SIZE, THREE.RGBAFormat);
  map.name = `Pastel animal coat — ${coat}`;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

export function animalCoat(species: string): AnimalCoat {
  return ['hare','snow-hare','fennec-fox','arctic-fox','chinchilla','squirrel','rat','guinea-pig','cat'].includes(species) ? 'soft'
    : ['muffalo','dromedary','alpaca','yak','bison','megasloth','caribou','grizzly-bear','polar-bear'].includes(species) ? 'shaggy' : 'short';
}

/** Only animal-exclusive source pigments, or profiles whose game users have
 * equivalent anatomy. Keep the existing gazelle and fox-snout source
 * drawings. The capybara keeps its distinct dark fur pigment, while the
 * overlapping marks on reptile skin also suit the mallard's green feathers.
 * This is a product embellishment after the
 * original painter; no reference key, seed, coverage or height is altered. */
export const ANIMAL_GOUACHE_PANELS: Readonly<Record<string,AnimalPastelPanel>> = Object.freeze({
  matFoxBody:'belly',matHareSand:'belly',matDeerAuburn:'belly',matCamelTan:'belly',matElephantSlate:'folds',
  'best46:matDeerAuburn':'belly','best46:matLynxSpotted':'spots','best46:matRhinoArmour':'folds',
  'best46:matChitinOlive':'shell','best46:matEquineBay':'saddle','best46:matBoarBristle':'saddle',
  'best46:matYakShaggy':'wool','best46:matWargSlate':'saddle','best46:matCassowaryBlue':'folds',
  'best46:matCapybaraBrown':'spots','best46:matTortoiseShell':'shell','best46:matReptileGreen':'scales',
  'best46:matTimberWolfGrey':'saddle',
});

/** Transform the existing packed pigment pixels, which are sRGB color plus
 * bump in A, with the authored dry-brush silhouette. The original brush
 * variation remains within the ink; only a small temporary mask is needed
 * at the bank's normal preparation boundary. */
export function decorateAnimalGouachePigment(key:string,baseColor:string|undefined,packed:Uint8Array,size=512):void {
  const panel = ANIMAL_GOUACHE_PANELS[key];
  if (!panel) return;
  if (!Number.isInteger(size) || size < 1 || packed.length !== size*size*4) throw Error('Animal Gouache pigment size mismatch');
  const resolution = 128, mask = new Float32Array(resolution*resolution);
  for (let y=0;y<resolution;y++) for (let x=0;x<resolution;x++) {
    const at = y*resolution+x, grain = hash(at,79)-.5;
    mask[at] = panelInk(panel,x/(resolution-1),y/(resolution-1),grain).weight * .88;
  }
  const target = panelInk(panel,0,0,0).pigment.getHex(), base = new THREE.Color(baseColor ?? '#ffffff').getHex();
  const r = target>>>16&255, g = target>>>8&255, b = target&255;
  const nominal = Math.max(1,(base>>>16&255)+(base>>>8&255)+(base&255));
  const lookup = (x:number,y:number) => mask[Math.min(resolution-1,y)*resolution+Math.min(resolution-1,x)]!;
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const mx = x/Math.max(1,size-1)*(resolution-1), my = y/Math.max(1,size-1)*(resolution-1);
    const ix = Math.floor(mx), iy = Math.floor(my), dx = mx-ix, dy = my-iy;
    const amount = (lookup(ix,iy)*(1-dx)+lookup(ix+1,iy)*dx)*(1-dy)
      +(lookup(ix,iy+1)*(1-dx)+lookup(ix+1,iy+1)*dx)*dy;
    if (amount <= 0) continue;
    const at = 4*(y*size+x), tone = Math.min(1.18,Math.max(.68,(packed[at]!+packed[at+1]!+packed[at+2]!)/nominal));
    packed[at] = Math.round(packed[at]!*(1-amount)+Math.min(255,r*tone)*amount);
    packed[at+1] = Math.round(packed[at+1]!*(1-amount)+Math.min(255,g*tone)*amount);
    packed[at+2] = Math.round(packed[at+2]!*(1-amount)+Math.min(255,b*tone)*amount);
  }
}

const speciesPanel: Readonly<Record<string,AnimalPastelPanel>> = Object.freeze({
  hare:'belly','snow-hare':'belly',deer:'belly',muffalo:'wool',gazelle:'belly',dromedary:'wool',
  'red-fox':'belly','arctic-fox':'belly','fennec-fox':'belly',elephant:'folds',
  'labrador-retriever':'belly',husky:'saddle','yorkshire-terrier':'wool',cat:'tabby',
  boomalope:'belly',boomrat:'belly',megasloth:'wool',megaspider:'shell',megascarab:'shell',spelopede:'shell',
  warg:'saddle','grizzly-bear':'saddle','polar-bear':'wool',cougar:'belly',panther:'spots',lynx:'spots',
  'timber-wolf':'saddle','arctic-wolf':'belly',bison:'wool',yak:'wool',rhinoceros:'folds',horse:'saddle',
  donkey:'saddle',alpaca:'wool',caribou:'wool',elk:'belly',ibex:'belly','wild-boar':'saddle',
  ostrich:'feathers',emu:'feathers',cassowary:'feathers',turkey:'feathers',duck:'feathers',
  tortoise:'shell',iguana:'scales',cobra:'scales',capybara:'belly',chinchilla:'belly',
  raccoon:'saddle',squirrel:'belly','guinea-pig':'spots',monkey:'belly',rat:'belly',
});
export function animalPastelPanel(species:string,profile:number,bone:number,mark:number,partMask:number):AnimalPastelPanel {
  const descriptor = referencePaintProfiles()[profile], config = descriptor?.config;
  const key = descriptor?.key ?? '';
  if (config?.flankStripe) return 'gazelle';
  if (config?.gradientTip) return 'muzzle';
  if (mark >= 0) return 'plain';
  if (key.includes('BoomSac')) return 'sac';
  if (/Charcoal|Horn|Antler|PinkEar|Wattle|Beak|Collar|CreamWhite/.test(key)) return 'plain';
  if (mark === -2 && ['raccoon','lynx','cat'].includes(species)) return 'tail';
  if (mark === -3 || mark === -4) return 'feathers';
  if (bone === 3) {
    // A head marking must never repeat over a separately articulated neck.
    const head = partMask === corpseVisualPartBit('head',species);
    if (head && ['husky','raccoon','gazelle'].includes(species)) return 'mask';
    if ((head || partMask === corpseVisualPartBit('jaw',species)) && ['red-fox','fennec-fox','cougar','hare','deer'].includes(species)) return 'muzzle';
    if (['elephant','rhinoceros'].includes(species)) return 'folds';
    return species === 'gazelle' && partMask === corpseVisualPartBit('neck',species) ? 'belly' : 'plain';
  }
  if (bone !== 0) return ['horse','donkey','gazelle','ibex','red-fox','caribou','elk'].includes(species) ? 'stocking' : 'plain';
  return speciesPanel[species] ?? 'plain';
}

/** These drawings have a meaning at a particular position on the body. Fur,
 * scales and other generic fields instead retain one physical scale on both
 * axes by taking a centred crop of their square panel. */
export function animalPanelUsesPhysicalCrop(panel:AnimalPastelPanel):boolean {
  return ['plain','spots','tabby','scales','shell','feathers','folds','wool'].includes(panel);
}

/** Face-addressed pastel UVs. Measure the bind-space part once and place its
 * anatomical pattern in a padded panel. Neither the authored Gouache UVs nor
 * the geometry / clinical streams are changed, and no per-animal allocation
 * or runtime projection accompanies movement. */
export function bakeAnimalCoatCoordinates(geometry: THREE.BufferGeometry, species: string): void {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  const paint = geometry.getAttribute('animalPaint'), part = geometry.getAttribute('animalPart');
  const coordinates = new Float32Array(positions.count * 2);
  interface PanelBounds { panel:AnimalPastelPanel; min:number[]; max:number[] }
  const groups = new Map<string,PanelBounds>(), owners:PanelBounds[] = [];
  for (let i = 0; i < positions.count; i++) {
    const profile = paint?.getW(i) ?? 0, bone = part?.getX(i) ?? 0, mask = part?.getY(i) ?? 0, mark = part?.getW(i) ?? -1;
    const key = `${profile}/${bone}/${mask}/${mark}`;
    let group = groups.get(key);
    if (!group) {
      group = { panel:animalPastelPanel(species,profile,bone,mark,mask), min:[Infinity,Infinity,Infinity], max:[-Infinity,-Infinity,-Infinity] };
      groups.set(key, group);
    }
    for (let axis = 0; axis < 3; axis++) {
      const coordinate = positions.getComponent(i,axis);
      group.min[axis] = Math.min(group.min[axis]!,coordinate);
      group.max[axis] = Math.max(group.max[axis]!,coordinate);
    }
    owners.push(group);
  }
  const normal=new THREE.Vector3(),tangentU=new THREE.Vector3(),tangentV=new THREE.Vector3(),point=new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const group = owners[i]!;
    const relative = (axis:number) => clamp((positions.getComponent(i,axis) - group.min[axis]!) / Math.max(.00001,group.max[axis]! - group.min[axis]!));
    const x = relative(0), y = relative(1), z = relative(2);
    const nx = Math.abs(normals.getX(i)), nz = Math.abs(normals.getZ(i)), ny = normals.getY(i);
    const horizontal = Math.abs(ny) > nx && Math.abs(ny) > nz;
    let axisU = nx >= nz ? 2 : 0, axisV = 1;
    let u = nx >= nz ? z : x, v = y;
    if (horizontal) {
      u = z;
      if (['belly','gazelle','stocking','saddle'].includes(group.panel)) v = ny > 0 ? .86 + .14*x : .14*x;
      else if (species==='gazelle'&&group.panel==='mask') v = ny>0?.91+.09*x:.09*x;
      else v = x;
      axisU = 2;axisV = 0;
    }
    if (group.panel === 'muzzle' || group.panel === 'mask' || group.panel === 'tail') u = z;
    if (animalPanelUsesPhysicalCrop(group.panel)) {
      // A face's orthonormal tangent frame also handles the tapered/tilted
      // primitive faces; dominant-axis projection alone shortens those axes.
      normal.fromBufferAttribute(normals,i).normalize();
      tangentU.set(0,0,0).setComponent(axisU,1);tangentU.addScaledVector(normal,-tangentU.dot(normal)).normalize();
      tangentV.crossVectors(normal,tangentU);if(tangentV.getComponent(axisV)<0)tangentV.negate();
      let radiusU=0,radiusV=0;
      for(let axis=0;axis<3;axis++){
        const half=(group.max[axis]!-group.min[axis]!)*.5;
        radiusU+=Math.abs(tangentU.getComponent(axis))*half;radiusV+=Math.abs(tangentV.getComponent(axis))*half;
        point.setComponent(axis,positions.getComponent(i,axis)-(group.min[axis]!+group.max[axis]!)*.5);
      }
      const span=Math.max(.00001,2*radiusU,2*radiusV);
      u=.5+point.dot(tangentU)/span;v=.5+point.dot(tangentV)/span;
    }
    const slot = ANIMAL_PASTEL_PANELS.indexOf(group.panel);
    coordinates[i*2] = ((slot % 4) * TILE + GUTTER + .5 + u * (INTERIOR - 1)) / SIZE;
    coordinates[i*2+1] = (Math.floor(slot / 4) * TILE + GUTTER + .5 + v * (INTERIOR - 1)) / SIZE;
  }
  geometry.setAttribute('animalPaintUv', new THREE.BufferAttribute(coordinates, 2));
}

/** Replaces the old wash's single sample, with enough contrast for close zoom.
 * The plain material never references this graph or any pigment texture. */
export function animalCoatShade(map: THREE.Texture) {
  return texture(map, attribute('animalPaintUv', 'vec2')).a.mul(1.08);
}
