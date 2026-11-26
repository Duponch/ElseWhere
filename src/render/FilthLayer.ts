import * as THREE from 'three/webgpu';
import { Fn, attribute, cos, sin, positionLocal, texture, uv, varyingProperty, vec2, vec3 } from 'three/tsl';
import type { FilthRecord } from '../sim/filth-rules';
import type {World} from '../sim/types';
import { createFilthAtlas, FILTH_ATLAS } from './filth-appearance';
import { prepareGrassBloodMasks } from './grass-blood-mask';
import { material } from './primitives';
import { FILTH_SURFACE_OFFSET, type FilthSurface } from './surface-height';
import {FilthPresentationPieces} from './filth-presentation-pieces';
import {markResidentAttributeRange} from './resident-attribute-range';

/** Flat alpha decals: one resident draw for all six species and all thicknesses.
 * No per-frame work, per-stain material, billboard or simulation randomness. */
export class FilthLayer {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.MeshStandardNodeMaterial>;
  private readonly atlas: THREE.DataTexture;
  private capacity = 16;
  private revision = 0;
  private readonly presentation=new FilthPresentationPieces();
  constructor(configure?: (m: THREE.MeshStandardNodeMaterial) => void) {
    const pixels = createFilthAtlas();
    prepareGrassBloodMasks(pixels);
    this.atlas = new THREE.DataTexture(pixels.data, pixels.width, pixels.height, THREE.RGBAFormat);
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.magFilter = THREE.LinearFilter; this.atlas.minFilter = THREE.LinearMipmapLinearFilter;
    this.atlas.generateMipmaps = true; this.atlas.needsUpdate = true;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, -.5, .5, 0, -.5, .5, 0, .5, -.5, 0, .5], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 2, 1, 0, 3, 2]); geometry.instanceCount = 0;
    const mat = material(0xffffff, { transparent: true, depthWrite: false });
    const worldXZ = varyingProperty('vec2', 'filthWorldXZ');
    mat.positionNode = Fn(() => {
      const pose = attribute('filthPose', 'vec4'), shape = attribute('filthShape', 'vec4');
      const x = positionLocal.x.mul(shape.x), z = positionLocal.z.mul(shape.y), c = cos(pose.w), s = sin(pose.w);
      const point = vec3(x.mul(c).sub(z.mul(s)), 0, x.mul(s).add(z.mul(c))).add(pose.xyz);
      worldXZ.assign(point.xz);
      return point;
    })();
    const shape = attribute('filthShape', 'vec4'), tile = shape.z;
    const localUV = vec2(shape.w.greaterThan(0).select(uv().x.oneMinus(), uv().x), uv().y);
    const atlasUV = localUV.add(vec2(tile.mod(FILTH_ATLAS.columns), tile.div(FILTH_ATLAS.columns).floor())).div(vec2(FILTH_ATLAS.columns, FILTH_ATLAS.rows));
    const texel = texture(this.atlas, atlasUV);
    const clip = attribute('filthClip', 'vec4');
    // Half-open bounds give each fragment exactly one supporting surface.
    // Copies retain the full rotated quad and its original UV derivatives.
    const within = worldXZ.x.greaterThanEqual(clip.x).and(worldXZ.y.greaterThanEqual(clip.y))
      .and(worldXZ.x.lessThan(clip.z)).and(worldXZ.y.lessThan(clip.w));
    mat.colorNode = texel.rgb; mat.opacityNode = texel.a.mul(within.select(1, 0));
    configure?.(mat);
    this.mesh = new THREE.Mesh(geometry, mat); this.mesh.name = 'Filth — transparent ground layers';
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.allocate();
  }
  private allocate(): void {
    const g = this.mesh.geometry;
    g.dispose();
    g.setAttribute('filthPose', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4));
    g.setAttribute('filthShape', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4));
    g.setAttribute('filthClip', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4));
  }
  /** Surface values are copied only beneath stain footprints. Floor placement
   * or removal invalidates unchanged filth, including mutable direct worlds.
   * Standalone callers without a surface retain the historical .071 height. */
  update(items: readonly FilthRecord[], reset = false, surface?: FilthSurface): void {
    const frame=this.presentation.read(items,reset,surface);
    this.apply(frame);
  }
  /** Only the closed scene application calls this. The presentation owner
   * obtains its own exact predecessor suffix, rather than trusting a flag. */
  updateWorld(world:World,reset=false):void {
    this.apply(this.presentation.readWorld(world,reset));
  }
  private apply(frame:ReturnType<FilthPresentationPieces['read']>):void {
    if(!frame.changed)return;
    this.revision++;
    const count=frame.count,resized=count>this.capacity;
    if (resized) { while (count > this.capacity) this.capacity *= 2; this.allocate(); }
    const pose = this.mesh.geometry.getAttribute('filthPose') as THREE.InstancedBufferAttribute;
    const shape = this.mesh.geometry.getAttribute('filthShape') as THREE.InstancedBufferAttribute;
    const clip = this.mesh.geometry.getAttribute('filthClip') as THREE.InstancedBufferAttribute;
    let first=count,last=0;
    for(const block of frame.blocks){
      if(!resized&&!block.changed)continue;
      let i=block.offset;
      for (const { decal: d, patch } of block.pieces) {
        pose.setXYZW(i, d.x, patch.height + FILTH_SURFACE_OFFSET, d.z, d.rotation);
        shape.setXYZW(i, d.width, d.height, d.tile, d.flip ? 1 : 0);
        clip.setXYZW(i, patch.minX, patch.minZ, patch.maxX, patch.maxZ); i++;
      }
      if(i>block.offset){first=Math.min(first,block.offset);last=Math.max(last,i);}
    }
    if(last>first)for(const attribute of [pose,shape,clip])markResidentAttributeRange(attribute,first*4,(last-first)*4);
    this.mesh.geometry.instanceCount = count; this.mesh.visible = count > 0;
  }
  prepareForCompile(): () => void {
    if (this.mesh.visible) return () => {};
    const revision = this.revision;
    // Zero size, underground: compile the same pipeline even on clean maps.
    const pose = this.mesh.geometry.getAttribute('filthPose') as THREE.InstancedBufferAttribute;
    const shape = this.mesh.geometry.getAttribute('filthShape') as THREE.InstancedBufferAttribute;
    const clip = this.mesh.geometry.getAttribute('filthClip') as THREE.InstancedBufferAttribute;
    pose.setXYZW(0, 0, -100, 0, 0); shape.setXYZW(0, 0, 0, 0, 0); clip.setXYZW(0, 0, 0, 0, 0);
    pose.needsUpdate = shape.needsUpdate = clip.needsUpdate = true;
    this.mesh.visible = true; this.mesh.geometry.instanceCount = 1;
    return () => { if (this.revision === revision) { this.mesh.visible = false; this.mesh.geometry.instanceCount = 0; } };
  }
  dispose(): void { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.atlas.dispose(); }
}
