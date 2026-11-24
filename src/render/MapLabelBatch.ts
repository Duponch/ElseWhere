import * as THREE from 'three/webgpu';
import { attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, positionGeometry, texture, uniform, uv, vec2, vec4 } from 'three/tsl';
import { perspectiveDetailRange, screenSpriteScale } from './map-overlay-detail';

export interface MapLabelEntry {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly label: string;
  /** Optional sRGB ink for a dedicated tinted annotation batch. Ordinary
   * inventory labels keep the original atlas and vertex layout. */
  readonly color?:number;
  /** CSS pixels below the anchor, fixed when the label data changes. */
  readonly offsetY?: number;
}

const GLYPH_WIDTH = 20;
const GLYPH_HEIGHT = 24;
const ATLAS_COLUMNS = 16;
const ATLAS_RATIO = 2;
// One original atlas covers numeric stacks, both short and full French quality
// labels, and a visible fallback. It never grows with quantities or camera DPR.
const GLYPHS = [...Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)),
  ...'àâäçéèêëîïôöùûüÿœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒ’–—'];
const ATLAS_ROWS = Math.ceil(GLYPHS.length / ATLAS_COLUMNS);
interface Glyph { index: number; advance: number }

function makeAtlas(): { map: THREE.Texture; glyphs: ReadonlyMap<string, Glyph> } {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas')
    : typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : undefined;
  if (canvas) {
    canvas.width = ATLAS_COLUMNS * GLYPH_WIDTH * ATLAS_RATIO;
    canvas.height = ATLAS_ROWS * GLYPH_HEIGHT * ATLAS_RATIO;
  }
  const context = canvas?.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
  const glyphs = new Map<string, Glyph>();
  if (context) {
    context.setTransform(ATLAS_RATIO, 0, 0, ATLAS_RATIO, 0, 0);
    context.font = '12px Arial, sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.lineJoin = 'round'; context.lineWidth = 2.5;
    context.strokeStyle = 'rgba(24, 29, 27, .85)';
    context.fillStyle = '#fff4d9';
  }
  GLYPHS.forEach((character, index) => {
    glyphs.set(character, { index, advance: context ? context.measureText(character).width : 7 });
    if (!context) return;
    const x = (index % ATLAS_COLUMNS + .5) * GLYPH_WIDTH;
    const y = (Math.floor(index / ATLAS_COLUMNS) + .5) * GLYPH_HEIGHT;
    context.strokeText(character, x, y); context.fillText(character, x, y);
  });
  // Pure Node consumers can construct/dispose the batch without a DOM. This
  // transparent placeholder is not an alternative browser text renderer.
  const map = context && canvas ? new THREE.CanvasTexture(canvas)
    : new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  return { map, glyphs };
}

function geometryFor(capacity: number,tinted=false): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute('labelAnchor', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.StaticDrawUsage));
  geometry.setAttribute('labelOffset', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.StaticDrawUsage));
  geometry.setAttribute('labelGlyph', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.StaticDrawUsage));
  if(tinted)geometry.setAttribute('labelTint',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.StaticDrawUsage));
  geometry.instanceCount = 0;
  return geometry;
}

/** One resident draw, with a quad per glyph. Only update() touches instance
 * buffers. Camera motion changes uniforms; the normal scene depth buffer masks
 * text behind opaque geometry at the label's physical anchor depth. */
export class MapLabelBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.MeshBasicNodeMaterial>;
  private readonly atlas = makeAtlas();
  private readonly screenScale = uniform(1);
  private readonly detailDistance = uniform(0);
  private readonly distanceLimited = uniform(1);
  private readonly perspectiveScale = uniform(0);
  private capacity = 16;
  private instanceCount = 0;
  private entries: MapLabelEntry[] = [];
  private revision = 0;
  private allowed = false;
  private disposed = false;
  private readonly tinted:boolean;

  constructor(options:{tinted?:boolean;aboveWorld?:boolean}={}) {
    this.tinted=!!options.tinted;
    const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: !options.aboveWorld, depthWrite: false, alphaTest: .01, fog: false, toneMapped: false });
    material.lights = false;
    // Entries already passed knownPile/knownPosition. The generic material
    // binder must not derive an owner from this screen-facing quad's vertices.
    material.userData.explorationIntent = true;
    const anchor = attribute('labelAnchor', 'vec3');
    const anchorView = cameraViewMatrix.mul(vec4(anchor, 1));
    const depth = anchorView.z.negate();
    const inRange = this.distanceLimited.lessThan(.5)
      .or(cameraPosition.sub(anchor).length().lessThan(this.detailDistance)).and(depth.greaterThan(0));
    const offset = positionGeometry.xy.mul(vec2(GLYPH_WIDTH, GLYPH_HEIGHT))
      .add(attribute('labelOffset', 'vec2')).mul(this.screenScale)
      .mul(this.perspectiveScale.greaterThan(.5).select(depth, 1)).mul(inRange.select(1, 0));
    // SpriteNodeMaterial r186's positionNode replaces only the world anchor;
    // explicit view-space offsets also preserve glyph spacing and screen size.
    // z/w stay exactly those of the anchor, including across camera switches.
    material.vertexNode = cameraProjectionMatrix.mul(vec4(anchorView.xy.add(offset), anchorView.zw));
    const glyph = attribute('labelGlyph', 'float');
    const atlasUv = vec2(uv().x.add(glyph.mod(ATLAS_COLUMNS)).div(ATLAS_COLUMNS),
      uv().y.add(glyph.div(ATLAS_COLUMNS).floor().negate().add(ATLAS_ROWS - 1)).div(ATLAS_ROWS));
    const ink=texture(this.atlas.map,atlasUv);
    material.colorNode=this.tinted?vec4(ink.rgb.mul(attribute('labelTint','vec3')),ink.a):ink;
    this.mesh = new THREE.Mesh(geometryFor(this.capacity,this.tinted), material);
    this.mesh.name = 'map-label-glyphs';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  update(entries: readonly MapLabelEntry[]): void {
    if (this.disposed) return;
    this.revision++;
    this.mesh.geometry.instanceCount = this.instanceCount;
    this.mesh.visible = this.instanceCount > 0 && this.allowed;
    if (entries.length === this.entries.length && entries.every((entry, index) => {
      const before = this.entries[index]!;
      return entry.x === before.x && entry.y === before.y && entry.z === before.z
        && entry.label === before.label && (entry.offsetY ?? 0) === (before.offsetY ?? 0)&&(!this.tinted||entry.color===before.color);
    })) return;
    this.entries = entries.map(entry => ({ ...entry }));
    let count = 0;
    for (const entry of entries) for (const character of entry.label) if (character !== ' ') count++;
    if (count > this.capacity) {
      this.capacity = 2 ** Math.ceil(Math.log2(count));
      const previous = this.mesh.geometry;
      this.mesh.geometry = geometryFor(this.capacity,this.tinted);
      previous.dispose();
    }
    const positions = this.mesh.geometry.getAttribute('labelAnchor');
    const offsets = this.mesh.geometry.getAttribute('labelOffset');
    const glyphs = this.mesh.geometry.getAttribute('labelGlyph');
    const colors=this.tinted?this.mesh.geometry.getAttribute('labelTint'):undefined,color=colors?new THREE.Color():undefined;
    const fallback = this.atlas.glyphs.get('?')!;
    let index = 0;
    for (const entry of entries) {
      if(color)color.setHex(entry.color??0xffffff);
      let width = 0;
      for (const character of entry.label) width += (this.atlas.glyphs.get(character) ?? fallback).advance;
      let cursor = -width / 2;
      for (const character of entry.label) {
        const glyph = this.atlas.glyphs.get(character) ?? fallback;
        if (character !== ' ') {
          positions.setXYZ(index, entry.x, entry.y, entry.z);
          offsets.setXY(index, cursor + glyph.advance / 2, -(entry.offsetY ?? 0));
          glyphs.setX(index, glyph.index);
          if(colors&&color)colors.setXYZ(index,color.r,color.g,color.b);
          index++;
        }
        cursor += glyph.advance;
      }
    }
    if (count > 0){positions.needsUpdate = offsets.needsUpdate = glyphs.needsUpdate = true;if(colors)colors.needsUpdate=true;}
    this.instanceCount = count;
    this.mesh.geometry.instanceCount = count;
    this.mesh.visible = count > 0 && this.allowed;
  }

  present(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, viewportHeight: number, cellPixels: number, minCellPixels: number): void {
    if (this.disposed) return;
    this.revision++;
    const threshold = Number.isFinite(minCellPixels) && minCellPixels > 0 ? minCellPixels : 0;
    this.allowed = Number.isFinite(viewportHeight) && viewportHeight > 0 && (threshold === 0 || cellPixels >= threshold);
    this.mesh.visible = this.instanceCount > 0 && this.allowed;
    if (!this.mesh.visible) return;
    const perspective = camera instanceof THREE.PerspectiveCamera;
    this.screenScale.value = screenSpriteScale(camera, viewportHeight, 1);
    this.perspectiveScale.value = perspective ? 1 : 0;
    this.distanceLimited.value = perspective && threshold > 0 ? 1 : 0;
    this.detailDistance.value = perspective && threshold > 0
      ? Math.min(1e30, perspectiveDetailRange(camera, viewportHeight, threshold)) : 1e8;
  }

  prepareForCompile(): () => void {
    const visible = this.mesh.visible, revision = this.revision;
    this.mesh.visible = true;
    if (this.instanceCount === 0) this.mesh.geometry.instanceCount = 1;
    return () => {
      if (this.disposed) return;
      this.mesh.geometry.instanceCount = this.instanceCount;
      if (this.revision === revision) this.mesh.visible = visible;
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.entries = [];
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.atlas.map.dispose();
  }
}
