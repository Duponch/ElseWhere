import * as THREE from 'three/webgpu';
import {
  Fn, If, float, hash, instanceIndex, mix, positionLocal, sin, smoothstep,
  texture, textureLoad, transformNormalToView, uint, uniform, uv, varyingProperty,
  vec2, vec3, output,
} from 'three/tsl';
import type { Terrain, World } from '../sim/types';
import { footprintCells } from '../sim/definitions';
import { noise } from './StaticGeometry';
import { ARID_GRASS_COLOR, TERRAIN_COLORS } from './TerrainLayer';
import { GRASS_BLOOD_COLOR } from './ground-blood';
import { GrassBloodMask, GRASS_BLOOD_SLOTS, GRASS_BLOOD_WORDS } from './grass-blood-mask';
import { readSceneResourceFrame, type SceneResourceFrame } from './scene-resource-index';
import {readResidentCollectionChanges379,type ResidentCollectionChanges379} from '../bridge/resident-collection-changes-379';
import type {GroundSurfaceTint} from './GroundSurfaceTint';
import type { AnimationDetail } from './AnimationDetail';
import { NaturalAnimationCache, NaturalPhasePalette } from './natural-animation-cache';
import {GrassCoverDraw379} from './GrassCoverDraw379';

/** AntSystem-inspired GPU blades, indexed by stable world cell and slot.
 * This is scenery: no Resource, job, save or simulation RNG. Four vertices/two
 * triangles are shared by a bounded visible field. */
export const GROUND_GRASS_MAX_BLADES = 120_000;
/** Natural soils introduced by geographic generation keep the legacy carpet.
 * Roads (packed-dirt), alluvium, mud and gravel remain distinct bare surfaces. */
const SOIL_TERRAINS = new Set<Terrain>([
  'grass', 'soil', 'rich-soil', 'soil-natural', 'mossy-soil', 'marshy-soil',
]);
const scratchColor = new THREE.Color();
const bloodColor = new THREE.Color(GRASS_BLOOD_COLOR);

type GroundWorld = Pick<World, 'width' | 'height' | 'tiles' | 'structures' | 'resources' | 'piles' | 'packed' | 'seed' | 'site' | 'filth'>;

// Each source contributes one occupant. Counts preserve cover when two things
// overlap and one moves or is removed.
function coverState(world: GroundWorld): { counts: Uint32Array<ArrayBuffer>; blocked: Uint8Array<ArrayBuffer> } {
  const counts = new Uint32Array(world.width * world.height);
  const mark = (x: number, z: number): void => {
    if (x >= 0 && z >= 0 && x < world.width && z < world.height) counts[z * world.width + x]!++;
  };
  // All constructed footprints cover their soil. Sparse piles and minified
  // furniture mask only when physically on the ground, not when carried.
  for (const structure of world.structures) {
    for (const { x, z } of footprintCells(structure)) mark(x, z);
  }
  for (const resource of world.resources) if (resource.kind === 'rock') mark(resource.x, resource.z);
  for (const pile of world.piles) if (pile.owner.type === 'ground') mark(pile.owner.x, pile.owner.z);
  for (const packed of world.packed) if (packed.owner.type === 'ground') mark(packed.owner.x, packed.owner.z);
  const blocked = new Uint8Array(counts.length);
  for (let i = 0; i < blocked.length; i++) {
    const tile = world.tiles[i]!;
    if (!SOIL_TERRAINS.has(tile.terrain) || tile.floor || counts[i]) blocked[i] = 1;
  }
  return { counts, blocked };
}

function sameStructureCover(a: World['structures'][number] | undefined,
  b: World['structures'][number] | undefined): boolean {
  return a === b || !!a && !!b && a.x === b.x && a.z === b.z && a.kind === b.kind &&
    a.orientation === b.orientation && a.footprint === b.footprint;
}

function sameRockCover(a: World['resources'][number] | undefined,
  b: World['resources'][number] | undefined): boolean {
  if (a === b) return true;
  const aRock = a?.kind === 'rock', bRock = b?.kind === 'rock';
  return aRock === bRock && (!aRock || a!.x === b!.x && a!.z === b!.z);
}

type GroundOwner = World['piles'][number]['owner'] | World['packed'][number]['owner'];

function sameGroundCover(a: { owner: GroundOwner } | undefined,
  b: { owner: GroundOwner } | undefined): boolean {
  if (a === b) return true;
  const aOwner = a?.owner, bOwner = b?.owner;
  if (aOwner?.type !== 'ground') return bOwner?.type !== 'ground';
  return bOwner?.type === 'ground' && aOwner.x === bOwner.x && aOwner.z === bOwner.z;
}

/** Index-aligned deltas are common. Reordered/inserted lists use IDs so only
 * the actual old and new footprints become dirty. Duplicate IDs trigger a
 * complete rebuild rather than risking incorrect counts. */
function diffCover<T>(before: T[] | undefined, after: T[], id: (item: T) => number,
  same: (a: T | undefined, b: T | undefined) => boolean,
  apply: (item: T, delta: -1 | 1) => void): boolean {
  if (before === after) return true;
  const old = before ?? [];
  let aligned = old.length === after.length;
  if (aligned) for (let i = 0; i < old.length; i++) {
    if (id(old[i]!) !== id(after[i]!)) { aligned = false; break; }
  }
  if (aligned) {
    for (let i = 0; i < old.length; i++) {
      const a = old[i]!, b = after[i]!;
      if (!same(a, b)) { apply(a, -1); apply(b, 1); }
    }
    return true;
  }
  const oldById = new Map<number, T>(), newById = new Map<number, T>();
  for (const item of old) {
    const key = id(item);
    if (oldById.has(key)) return false;
    oldById.set(key, item);
  }
  for (const item of after) {
    const key = id(item);
    if (newById.has(key)) return false;
    newById.set(key, item);
  }
  for (const [key, a] of oldById) {
    const b = newById.get(key);
    if (!same(a, b)) { apply(a, -1); if (b) apply(b, 1); }
  }
  for (const [key, b] of newById) if (!oldById.has(key) && !same(undefined, b)) apply(b, 1);
  return true;
}

/** Both endpoint directories are the accepted collection owners. A skipped
 * Full is a union of actual producer edits, not a comparison of dense rows.
 * Validate every source before applying the first contribution so a broken
 * suffix can take the original exhaustive reader without partial writes. */
function diffResidentCover379<T extends {id:number}>(proof:ResidentCollectionChanges379,before:readonly T[],after:readonly T[],same:(a:T|undefined,b:T|undefined)=>boolean,apply:(item:T,delta:-1|1)=>void):{visited:number;edits:number}|undefined {
  if(proof.before.count!==before.length||proof.after.count!==after.length)return;
  const touched=new Set<number>();for(const edge of proof.edges){for(const row of edge.removed)touched.add(row.id);for(const row of edge.added)touched.add(row.id);for(const row of edge.updated)touched.add(row.id);}
  const edits:{before:T|undefined;after:T|undefined;beforeOrdinal:number;afterOrdinal:number}[]=[];
  for(const id of touched){
    const a=proof.before.source(id),b=proof.after.source(id);
    if(a===undefined&&proof.before.capturedSource(id)!==undefined||b===undefined&&proof.after.capturedSource(id)!==undefined)return;
    const old=a===undefined?undefined:before[a],next=b===undefined?undefined:after[b];
    if(a!==undefined&&old?.id!==id||b!==undefined&&next?.id!==id)return;
    if(!same(old,next))edits.push({before:old,after:next,beforeOrdinal:a??Infinity,afterOrdinal:b??Infinity});
  }
  // Match the literal unaligned traversal: old source order, then new-only
  // additions. Overlapping footprints retain the exact contribution count.
  edits.sort((a,b)=>a.beforeOrdinal-b.beforeOrdinal||a.afterOrdinal-b.afterOrdinal);
  for(const edit of edits){if(edit.before)apply(edit.before,-1);if(edit.after)apply(edit.after,1);}
  return{visited:touched.size,edits:edits.length};
}

function writeGroundCell(data: Uint8Array, world: GroundWorld, i: number, blocked: Uint8Array, blood?: ReadonlySet<number>): boolean {
  const tile = world.tiles[i]!;
  const p = i * 4;
  let hex = 0, alpha = 0;
  if (!blocked[i]&&(tile.snowDepth??0)<.5) {
    // The same palette and per-cell noise as TerrainLayer, encoded in sRGB for
    // DataTexture sampling. A root in a tile thus follows its actual colour.
    const x = i % world.width, z = Math.floor(i / world.width);
    scratchColor.setHex(tile.terrain === 'grass' && world.site?.biome === 'arid-shrubland'
      ? ARID_GRASS_COLOR : TERRAIN_COLORS[tile.terrain]).multiplyScalar(0.94 + noise(x, z, world.seed) * 0.12);
    hex = scratchColor.getHex();
    // Coverage stays binary. The spare value marks cells with individual
    // stained roots so clean cells never read the pigment field on GPU.
    alpha = blood?.has(i) ? 254 : 255;
  }
  const r = hex >>> 16, g = hex >>> 8 & 255, b = hex & 255;
  if (data[p] === r && data[p + 1] === g && data[p + 2] === b && data[p + 3] === alpha) return false;
  data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = alpha;
  return true;
}

export function groundGrassPixels(world: GroundWorld): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(world.width * world.height * 4);
  const { blocked } = coverState(world);
  const blood = new GrassBloodMask(); blood.adopt(world.filth?.items ?? [], world.width, world.height);
  for (let i = 0; i < world.width * world.height; i++) {
    writeGroundCell(data, world, i, blocked, blood.cells);
  }
  return data;
}

function bladeGeometry(): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.033, 0, 0, .033, 0, 0, -.00375, 1, .029, .00375, 1, .029,
  ], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.instanceCount = 0;
  return geometry;
}

/** Rotation-invariant upper bound for the camera's one-cell-margined ground
 * rectangle. Orthographic corner edges rotate rigidly about the target; a
 * perspective quadrilateral uses its longest pairwise diagonal instead. */
function worldCellBudget(corners: Float64Array, orthographic: boolean): number {
  if (orthographic) {
    const horizontal = Math.hypot(corners[4]! - corners[0]!, corners[5]! - corners[1]!);
    const vertical = Math.hypot(corners[2]! - corners[0]!, corners[3]! - corners[1]!);
    const sum = horizontal + vertical;
    return Math.ceil(.5 * sum * sum + 4 * Math.SQRT2 * sum + 16);
  }
  let diameter = 0;
  for (let a = 0; a < 8; a += 2) for (let b = a + 2; b < 8; b += 2)
    diameter = Math.max(diameter, Math.hypot(corners[a]! - corners[b]!, corners[a + 1]! - corners[b + 1]!));
  return Math.ceil((diameter + 4) ** 2);
}

/** Conservative, yaw-invariant AABB budget for the lower perspective frustum.
 * It is a ground trapezoid rather than the full near-horizon footprint. */
function nearCellBudget(corners: Float64Array): number {
  const length = (a: number, b: number) => Math.hypot(corners[a]! - corners[b]!, corners[a + 1]! - corners[b + 1]!);
  const width = Math.max(length(0, 4), length(2, 6));
  const depth = Math.max(length(0, 2), length(4, 6));
  const sum = width + depth;
  return Math.ceil(.5 * sum * sum + 4 * Math.SQRT2 * sum + 16);
}

/** One resident draw. The GPU creates/recycles roots, shapes, wind and colour;
 * the CPU uploads the surface map and packed root pigment only on adoption. */
export class GpuGroundGrassLayer {
  private supported = true;
  private unsupportedWarning?: string;
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.MeshStandardNodeMaterial>;
  readonly map = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  readonly bloodMap = new THREE.DataTexture(new Uint32Array(1), 1, 1, THREE.RedIntegerFormat, THREE.UnsignedIntType);
  private readonly bloodPresent = uniform(0);
  private readonly texturesEnabled = uniform(1);
  private readonly terrainPaint = texture(this.map);
  private readonly terrainPaintPresent = uniform(0);
  private readonly gridOrigin = uniform(new THREE.Vector2());
  private readonly gridWidth = uniform(1);
  private readonly slotsPerCell = uniform(1);
  private readonly baseInstances = uniform(0);
  private readonly nearGridOrigin = uniform(new THREE.Vector2());
  private readonly nearGridWidth = uniform(1);
  private readonly nearSlotsPerCell = uniform(1);
  private readonly nearInstances = uniform(0);
  private readonly foregroundGridOrigin = uniform(new THREE.Vector2());
  private readonly foregroundGridWidth = uniform(1);
  private readonly foregroundSlotsPerCell = uniform(1);
  private readonly bandView = uniform(new THREE.Vector4());
  private readonly bandLimits = uniform(new THREE.Vector4());
  private readonly zoomVisibility = uniform(1);
  private readonly dimensions = uniform(new THREE.Vector2(1, 1));
  private readonly middleWind = new NaturalAnimationCache();
  private readonly middlePalette?: NaturalPhasePalette;
  private readonly windTick = uniform(0);
  private readonly windStrength = uniform(0);
  private readonly windDirection = uniform(new THREE.Vector2(1,0));
  private previousTiles: World['tiles'] | undefined;
  private previousStructures: World['structures'] | undefined;
  private previousResources: World['resources'] | undefined;
  private previousWorld: World | undefined;
  private previousPiles: World['piles'] | undefined;
  private previousPacked: World['packed'] | undefined;
  private previousSeed = Number.NaN;
  private previousBiome: NonNullable<World['site']>['biome'] | undefined;
  private previousPixels = new Uint8Array(0);
  private previousBlocked = new Uint8Array(0);
  private coverCounts = new Uint32Array(0);
  private dirtyFlags = new Uint8Array(0);
  private readonly dirtyCells: number[] = [];
  private readonly blood = new GrassBloodMask();
  private revision = 0;
  private readonly coverSourceCounts379={journalReads:0,journalRows:0,journalEdits:0,fallbackReads:0,fallbackRows:0};
  coverSourceMetrics379(){return{...this.coverSourceCounts379};}
  private readonly corner = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly footprint = new Float64Array(8);
  private readonly nearFootprint = new Float64Array(8);
  private readonly foregroundFootprint = new Float64Array(8);
  private readonly coverDraw:GrassCoverDraw379;

  constructor(configure?: (material: THREE.MeshStandardNodeMaterial) => void,
    private readonly maxTextureDimension = Infinity, private readonly onUnsupported: (message: string) => void = () => {},surfaceTint?:GroundSurfaceTint,
    groundedConfigure?:(material:THREE.MeshStandardNodeMaterial,root:THREE.Node)=>void,private readonly detail?:AnimationDetail) {
    if(detail)this.middlePalette=new NaturalPhasePalette();
    this.map.colorSpace = THREE.SRGBColorSpace;
    this.map.magFilter = this.map.minFilter = THREE.NearestFilter;
    this.map.generateMipmaps = false;
    this.map.needsUpdate = true;
    this.bloodMap.magFilter = this.bloodMap.minFilter = THREE.NearestFilter;
    this.bloodMap.generateMipmaps = false;
    this.bloodMap.needsUpdate = true;
    const material = new THREE.MeshStandardNodeMaterial({
      color: 0xffffff, roughness: .93, metalness: 0, flatShading: true, side: THREE.DoubleSide,
    });
    const groundColour = varyingProperty('vec3', 'groundGrassColour');
    const groundRoot=varyingProperty('vec2','groundGrassRoot');
    material.positionNode = Fn(() => {
      // instanceIndex maps to an integer world cell and a stable local slot.
      // Camera movement changes only the integer window origin; resizing that
      // window or its density never changes roots of the slots it retains.
      // The latter two ranges add stable slots to the nearer ground in a low
      // perspective view. All ranges decode to absolute cells, so moving the
      // camera cannot move the roots of slots they retain.
      const index = float(instanceIndex);
      const near = index.greaterThanEqual(this.baseInstances);
      const foregroundStart = this.baseInstances.add(this.nearInstances);
      const foreground = index.greaterThanEqual(foregroundStart);
      const localIndex = foreground.select(index.sub(foregroundStart),
        near.select(index.sub(this.baseInstances), index));
      const slotsInRange = foreground.select(this.foregroundSlotsPerCell,
        near.select(this.nearSlotsPerCell, this.slotsPerCell));
      const cellIndex = localIndex.div(slotsInRange).floor();
      const slot = localIndex.mod(slotsInRange).add(foreground.select(
        this.slotsPerCell.add(this.nearSlotsPerCell), near.select(this.slotsPerCell, float(0))));
      const gridOrigin = foreground.select(this.foregroundGridOrigin,
        near.select(this.nearGridOrigin, this.gridOrigin));
      const gridWidth = foreground.select(this.foregroundGridWidth,
        near.select(this.nearGridWidth, this.gridWidth));
      const cellX = gridOrigin.x.add(cellIndex.mod(gridWidth));
      const cellZ = gridOrigin.y.add(cellIndex.div(gridWidth).floor());
      const key = uint(cellX).mul(uint(73856093))
        .bitXor(uint(cellZ).mul(uint(19349663)))
        .bitXor(uint(slot).mul(uint(83492791)));
      const bx = cellX.add(hash(key).mul(.96).sub(.48));
      const bz = cellZ.add(hash(key.add(uint(11))).mul(.96).sub(.48));
      const root = vec2(bx, bz);
      groundRoot.assign(root);
      const sampled = texture(this.map, root.add(.5).div(this.dimensions)).level(float(0));
      groundColour.assign(sampled.rgb);
      // Share the renderer's painted ground at the existing root coordinates.
      // Vertex LOD0 keeps the visible grain without another fragment lookup;
      // its shore/foam alpha never changes grass coverage or blade geometry.
      If(this.texturesEnabled.greaterThan(0).and(this.terrainPaintPresent.greaterThan(0)).and(sampled.a.greaterThan(0)), () => {
        groundColour.assign(this.terrainPaint.sample(root.add(.5).div(this.dimensions)).level(float(0)).rgb);
      });
      If(this.texturesEnabled.greaterThan(0).and(this.bloodPresent.greaterThan(0)).and(sampled.a.greaterThan(0)).and(sampled.a.lessThan(1)), () => {
        const rootSlot = uint(slot);
        const word = uint(textureLoad(this.bloodMap, vec2(cellX.mul(GRASS_BLOOD_WORDS).add(float(rootSlot.div(uint(16)))), cellZ)).r);
        const pigment = word.shiftRight(rootSlot.mod(uint(16)).mul(uint(2))).bitAnd(uint(3));
        groundColour.assign(mix(groundColour, vec3(bloodColor.r, bloodColor.g, bloodColor.b), float(pigment).mul(.8 / 3)));
      });
      // Extra density tapers toward each band's far edge; otherwise the
      // boundary between one and many blades would cut across the landscape.
      const depth = root.sub(this.bandView.xy).dot(this.bandView.zw);
      const nearFade = float(1).sub(smoothstep(this.bandLimits.x.sub(this.bandLimits.y), this.bandLimits.x, depth));
      const foregroundFade = float(1).sub(smoothstep(this.bandLimits.z.sub(this.bandLimits.w), this.bandLimits.z, depth));
      const bandFade = foreground.select(foregroundFade, near.select(nearFade, float(1)));
      const coverage = sampled.a.greaterThan(0).select(float(1), float(0)).mul(this.zoomVisibility).mul(bandFade);
      const yaw = hash(key.add(uint(29))).mul(Math.PI * 2);
      const c = yaw.cos(), s = yaw.sin();
      const height = hash(key.add(uint(43))).mul(.17).add(.21).mul(coverage);
      const width = hash(key.add(uint(59))).mul(.45).add(.76).mul(coverage);
      const bladeT = uv().y;
      const animate=(tick:THREE.Node<'float'>)=>sin(tick.mul(2*Math.PI/18).add(bx.mul(.31)).add(bz.mul(.23)).add(yaw))
        .mul(.07).add(.04).mul(this.windStrength).mul(bladeT.mul(bladeT));
      const side = positionLocal.x.mul(width), lean = positionLocal.z.mul(width);
      const shape=(sway:THREE.Node<'float'>,direction:THREE.Node<'vec2'>)=>vec3(
        bx.add(side.mul(c)).add(lean.mul(s)).add(direction.x.mul(sway)),
        positionLocal.y.mul(height).add(.021),
        bz.add(lean.mul(c)).sub(side.mul(s)).add(direction.y.mul(sway)),
      );
      if(!detail)return shape(animate(this.windTick),this.windDirection);
      const level=detail.level(vec3(cellX,0,cellZ)).toVar(),position=shape(float(0),this.windDirection).toVar();
      If(level.equal(0),()=>{position.assign(shape(animate(this.windTick),this.windDirection));})
        .ElseIf(level.equal(1),()=>{
          const basis=this.middlePalette!.phase(bx.mul(.31).add(bz.mul(.23)).add(yaw));
          const wave=this.middleWind.phaseA.x.mul(basis.y).add(this.middleWind.phaseA.y.mul(basis.x));
          const sway=wave.mul(.07).add(.04).mul(this.middleWind.wind.z).mul(bladeT.mul(bladeT));
          position.assign(shape(sway,this.middleWind.wind.xy));
        });
      return position;
    })();
    // Match TerrainLayer's albedo and vertical normal exactly. As in
    // AntSystem, the three-dimensional silhouette makes the grass visible.
    material.colorNode = groundColour;
    material.normalNode = transformNormalToView(vec3(0, 1, 0));
    if(groundedConfigure)groundedConfigure(material,groundRoot);else configure?.(material);
    if(surfaceTint)material.outputNode=surfaceTint.shade(material.outputNode??output,groundRoot);
    this.mesh = new THREE.Mesh(bladeGeometry(), material);
    this.mesh.name = 'GPU decorative soil grass';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
    this.coverDraw=new GrassCoverDraw379(this.mesh);
  }

  setWind(strength:number,directionX:number,directionZ:number):void {
    this.windStrength.value=Number.isFinite(strength)?Math.max(0,Math.min(2,strength)):0;
    const length=Math.hypot(directionX,directionZ);
    if(length>0&&Number.isFinite(length))this.windDirection.value.set(directionX/length,directionZ/length);
  }
  setTexturesEnabled(enabled: boolean): void { this.texturesEnabled.value = enabled ? 1 : 0; }
  /** Bind before the first compile, then retain the renderer-owned texture
   * across pixel refreshes and texture toggles. Null disables the lookup but
   * retains its binding: the renderer may release/rebuild its image safely.
   * An actual texture-identity change needs a fresh binding because Three
   * shares uniforms by texture UUID; no texture is allocated/disposed here. */
  setTerrainPaint(paint: THREE.DataTexture | null): void {
    this.terrainPaintPresent.value = paint && paint.image.width > 1 && paint.image.height > 1 ? 1 : 0;
    if (paint && this.terrainPaint.value !== paint) {
      this.terrainPaint.value = paint;
      this.mesh.material.needsUpdate = true;
    }
  }
  presentWind(tick:number):void {
    this.windTick.value=((tick%7200)+7200)%7200;
    if(this.detail){const sample=this.windTick.value;
      this.middleWind.capture(this.detail,this.windDirection.value.x,this.windDirection.value.y,this.windStrength.value,sample*2*Math.PI/18);}
  }

  /** Diff spatial cover at source cells; dynamic edits leave the atlas alone.
   * Only seed/biome, dimensions and explicit force recolour the whole map. */
  update(world: World, force = false, changedTiles?: readonly number[], sceneFrame?: SceneResourceFrame): void {
    if(force||this.previousWorld?.width!==world.width||this.previousWorld?.height!==world.height)this.middleWind.reset();
    // Check the configured canvas device before allocating the dense mask.
    // Decorative grass can be disabled safely without changing the World.
    this.supported = world.width * GRASS_BLOOD_WORDS <= this.maxTextureDimension && world.height <= this.maxTextureDimension;
    if (!this.supported) {
      this.mesh.visible = false; this.mesh.geometry.instanceCount = 0;
      const message = `Herbe décorative désactivée : le masque ${world.width * GRASS_BLOOD_WORDS} × ${world.height} dépasse la limite de texture ${this.maxTextureDimension} de ce périphérique.`;
      if (message !== this.unsupportedWarning) { this.unsupportedWarning = message; this.onUnsupported(message); }
      return;
    }
    this.unsupportedWarning = undefined;
    const widthChanged = this.map.image.width !== world.width || this.map.image.height !== world.height ||
      this.previousPixels.length !== world.width * world.height * 4;
    // A contribution delta belongs to the exact preceding application of this
    // layer, which need not be the index's preceding application. A supplied
    // but unproved frame must rebuild cover; public calls without one retain
    // the historical source diff below.
    const resourceEdits = !force && !widthChanged && this.previousWorld && sceneFrame !== undefined
      ? readSceneResourceFrame(sceneFrame, world, this.previousWorld)?.rockCoverEdits : undefined;
    const unknownResourceFrame = sceneFrame !== undefined && resourceEdits === undefined;
    const biome = world.site?.biome;
    const bloodAdoption = this.blood.adopt(world.filth?.items ?? [], world.width, world.height);
    const bloodChanges = bloodAdoption.cells;
    this.bloodPresent.value = this.blood.cells.size > 0 ? 1 : 0;
    if (bloodAdoption.resized) {
      this.bloodMap.dispose();
      this.bloodMap.image = { data: this.blood.words, width: world.width * GRASS_BLOOD_WORDS, height: world.height };
    }
    if (bloodAdoption.changed) { this.bloodMap.needsUpdate = true; this.revision++; }
    if (!force && !widthChanged && !unknownResourceFrame && this.previousTiles === world.tiles &&
      this.previousStructures === world.structures && this.previousSeed === world.seed &&
      this.previousResources === world.resources &&
      this.previousPiles === world.piles && this.previousPacked === world.packed &&
      this.previousBiome === biome && !bloodChanges.length) { this.previousWorld = world; return; }
    const oldTiles = this.previousTiles;
    const seedChanged = this.previousSeed !== world.seed || this.previousBiome !== biome;
    let fullRebuild = widthChanged || force || unknownResourceFrame;
    if (!fullRebuild) {
      const touch = (i: number): void => {
        if (!this.dirtyFlags[i]) { this.dirtyFlags[i] = 1; this.dirtyCells.push(i); }
      };
      for (const i of bloodChanges) touch(i);
      const counts = this.coverCounts;
      let inconsistent = false;
      const adjust = (x: number, z: number, delta: -1 | 1): void => {
        if (x < 0 || z < 0 || x >= world.width || z >= world.height) return;
        const i = z * world.width + x;
        if (delta < 0 && !counts[i]) { inconsistent = true; return; }
        counts[i] = counts[i]! + delta;
        touch(i);
      };
      // Tile deltas share unchanged Tile objects. A copied array without a
      // changed-slot list still needs one comparison pass for mining/flooring.
      if (oldTiles !== world.tiles) {
        const inspect = changedTiles;
        for (let n = 0; n < (inspect?.length ?? world.tiles.length); n++) {
          const i = inspect ? inspect[n]! : n;
          if (oldTiles?.[i]?.terrain !== world.tiles[i]!.terrain ||
            oldTiles[i]?.floor !== world.tiles[i]!.floor ||
            ((oldTiles[i]?.snowDepth??0)>=.5)!==((world.tiles[i]!.snowDepth??0)>=.5)) touch(i);
        }
      }
      const previous=this.previousWorld,confirmed=resourceEdits!==undefined&&previous!==undefined;
      const closedDiff=<T extends {id:number}>(collection:'structures'|'piles',before:T[]|undefined,after:T[],same:(a:T|undefined,b:T|undefined)=>boolean,apply:(item:T,delta:-1|1)=>void):boolean=>{
        if(before===after)return true;
        const proof=confirmed&&previous&&Object.is(before,previous[collection])&&Object.is(after,world[collection])?readResidentCollectionChanges379(previous,world,collection):undefined;
        if(proof&&before){const result=diffResidentCover379(proof,before,after,same,apply);if(result){this.coverSourceCounts379.journalReads++;this.coverSourceCounts379.journalRows+=result.visited;this.coverSourceCounts379.journalEdits+=result.edits;return true;}}
        this.coverSourceCounts379.fallbackReads++;this.coverSourceCounts379.fallbackRows+=(before?.length??0)+after.length;
        return diffCover(before,after,row=>row.id,same,apply);
      };
      const structuresOkay = closedDiff('structures',this.previousStructures, world.structures,
        sameStructureCover, (s, delta) => {
          for (const { x, z } of footprintCells(s)) adjust(x, z, delta);
        });
      let resourcesOkay = structuresOkay;
      if (resourcesOkay) {
        if (resourceEdits !== undefined) {
          for (const { before, after } of resourceEdits) {
            if (before !== undefined) adjust(before % world.width, Math.floor(before / world.width), -1);
            if (after !== undefined) adjust(after % world.width, Math.floor(after / world.width), 1);
          }
        } else resourcesOkay = diffCover(this.previousResources, world.resources, r => r.id,
          sameRockCover, (r, delta) => { if (r.kind === 'rock') adjust(r.x, r.z, delta); });
      }
      const pilesOkay = resourcesOkay && closedDiff('piles',this.previousPiles, world.piles,
        sameGroundCover, (p, delta) => {
          if (p.owner.type === 'ground') adjust(p.owner.x, p.owner.z, delta);
        });
      const packedOkay = pilesOkay && diffCover(this.previousPacked, world.packed, p => p.building.id,
        sameGroundCover, (p, delta) => {
          if (p.owner.type === 'ground') adjust(p.owner.x, p.owner.z, delta);
        });
      fullRebuild = !packedOkay || inconsistent;
    }
    let changed = false;
    if (fullRebuild) {
      const { counts, blocked } = coverState(world);
      this.coverCounts = counts;
      this.previousBlocked = blocked;
      if (widthChanged) {
        this.previousPixels = new Uint8Array(world.width * world.height * 4);
        this.dirtyFlags = new Uint8Array(world.width * world.height);
        for (let i = 0; i < world.tiles.length; i++) writeGroundCell(this.previousPixels, world, i, blocked, this.blood.cells);
        this.map.dispose();
        this.map.image = { data: this.previousPixels, width: world.width, height: world.height };
        this.dimensions.value.set(world.width, world.height);
        this.map.needsUpdate = true; this.revision++;
      } else {
        for (let i = 0; i < world.tiles.length; i++)
          changed = writeGroundCell(this.previousPixels, world, i, blocked, this.blood.cells) || changed;
      }
    } else if (seedChanged) {
      for (let i = 0; i < world.tiles.length; i++) {
        const tile = world.tiles[i]!;
        this.previousBlocked[i] = !SOIL_TERRAINS.has(tile.terrain) || tile.floor || this.coverCounts[i] ? 1 : 0;
        changed = writeGroundCell(this.previousPixels, world, i, this.previousBlocked, this.blood.cells) || changed;
      }
    } else {
      for (const i of this.dirtyCells) {
        const tile = world.tiles[i]!;
        this.previousBlocked[i] = !SOIL_TERRAINS.has(tile.terrain) || tile.floor || this.coverCounts[i] ? 1 : 0;
        changed = writeGroundCell(this.previousPixels, world, i, this.previousBlocked, this.blood.cells) || changed;
      }
    }
    for (const i of this.dirtyCells) this.dirtyFlags[i] = 0;
    this.dirtyCells.length = 0;
    if (changed) { this.map.needsUpdate = true; this.revision++; }
    this.previousTiles = world.tiles; this.previousStructures = world.structures;
    this.previousResources = world.resources; this.previousPiles = world.piles;
    this.previousPacked = world.packed; this.previousSeed = world.seed; this.previousBiome = biome;
    this.previousWorld = world;
  }

  /** Constant CPU work per image; no map walk, position buffer or simulation
   * mutation. A one-cell margin covers projected blade tips near the screen;
   * fixed world cells keep the roots stable under camera rotation and zoom. */
  present(camera: THREE.Camera, _target: THREE.Vector3, _span: number, pixelsPerCell: number): void {
    if (!this.supported) { this.mesh.visible = false; this.mesh.geometry.instanceCount = 0; return; }
    // Thin subpixel blades become aliasing and vertex work, not useful detail.
    // Fade their size and density between 20 and 30 pixels/cell, then submit
    // nothing in the overview. The near field retains its original detail.
    if (pixelsPerCell <= 20 || this.map.image.width <= 1) {
      this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; return;
    }
    const zoomT = Math.min(1, (pixelsPerCell - 20) / 10);
    const zoomVisibility = zoomT * zoomT * (3 - 2 * zoomT);
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.forward);
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    let valid = true;
    let cornerIndex = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      // An orthographic ray starts on the near plane; a midpoint of a long
      // depth range may already lie below the ground and miss backwards.
      this.corner.set(sx, sy, camera instanceof THREE.OrthographicCamera ? -1 : .5).unproject(camera);
      if (camera instanceof THREE.OrthographicCamera) {
        this.ray.copy(this.forward);
      } else {
        this.ray.copy(this.corner).sub(camera.position).normalize();
        this.corner.copy(camera.position);
      }
      if (this.ray.y >= -.025) { valid = false; break; }
      const distance = -this.corner.y / this.ray.y;
      if (distance < 0) { valid = false; break; }
      const x = this.corner.x + distance * this.ray.x, z = this.corner.z + distance * this.ray.z;
      this.footprint[cornerIndex++] = x;
      this.footprint[cornerIndex++] = z;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    let budgetCells = valid ? worldCellBudget(this.footprint, camera instanceof THREE.OrthographicCamera) : 0;
    if (!valid) {
      // A near-horizon ray can hit ground beyond any fixed target radius.
      // The finite map itself is the conservative fallback; the GPU frustum
      // clips its fragments and the global vertex budget still applies.
      minX = -.5; maxX = this.map.image.width - .5;
      minZ = -.5; maxZ = this.map.image.height - .5;
      budgetCells = this.map.image.width * this.map.image.height;
    }
    minX = Math.max(-.5, minX); maxX = Math.min(this.map.image.width - .5, maxX);
    minZ = Math.max(-.5, minZ); maxZ = Math.min(this.map.image.height - .5, maxZ);
    if (minX >= maxX || minZ >= maxZ) {
      this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; return;
    }
    const firstX = Math.max(0, Math.floor(minX + .5) - 1);
    const lastX = Math.min(this.map.image.width - 1, Math.floor(maxX + .5) + 1);
    const firstZ = Math.max(0, Math.floor(minZ + .5) - 1);
    const lastZ = Math.min(this.map.image.height - 1, Math.floor(maxZ + .5) + 1);
    const columns = lastX - firstX + 1, rows = lastZ - firstZ + 1;
    const cells = columns * rows;
    if (cells <= 0) {
      this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; return;
    }
    // The footprint shrinks as the player zooms in: invest saved vertex budget
    // in more fixed slots per cell, never in a larger total submission.
    const closeBoost = Math.max(0, Math.min(1, (pixelsPerCell - 75) / 30));
    const desiredSlots = Math.min(GRASS_BLOOD_SLOTS,
      Math.floor((20 + Math.max(0, pixelsPerCell - 30) * .7 + 110 * closeBoost) * zoomVisibility));
    // A rotation changes the axis-aligned rectangle, but not the edge lengths
    // of its ground parallelogram. Reserve against its yaw-invariant maximum
    // AABB so slots per cell do not pulse as the player rotates the camera.
    budgetCells = Math.min(this.map.image.width * this.map.image.height, Math.max(cells, budgetCells));
    const uniformSlots = Math.min(desiredSlots, Math.floor(GROUND_GRASS_MAX_BLADES / budgetCells));
    let slots = uniformSlots;
    let nearColumns = 0, nearRows = 0, nearFirstX = 0, nearFirstZ = 0, nearSlots = 0;
    let foregroundColumns = 0, foregroundRows = 0, foregroundFirstX = 0, foregroundFirstZ = 0;
    let foregroundSlots = 0;
    let nearLimit = 0, foregroundLimit = 0;
    // At a grazing perspective angle the upper rays meet the horizon. The
    // conservative fallback can then cover all 250² cells; uniform budgeting
    // would leave only one blade in every cell, including the foreground.
    // Keep one sparse, stable base field and spend the remaining instances on
    // the lower half of the screen, where individual blades are resolvable.
    if (camera instanceof THREE.PerspectiveCamera && uniformSlots < desiredSlots * .65) {
      let nearValid = true;
      let nearMinX = Infinity, nearMaxX = -Infinity, nearMinZ = Infinity, nearMaxZ = -Infinity;
      let nearIndex = 0;
      for (const sx of [-1, 1]) for (const sy of [-1, 0]) {
        this.corner.set(sx, sy, .5).unproject(camera);
        this.ray.copy(this.corner).sub(camera.position).normalize();
        if (this.ray.y >= -.025) { nearValid = false; break; }
        const distance = -camera.position.y / this.ray.y;
        if (distance < 0) { nearValid = false; break; }
        const x = camera.position.x + distance * this.ray.x;
        const z = camera.position.z + distance * this.ray.z;
        this.nearFootprint[nearIndex++] = x;
        this.nearFootprint[nearIndex++] = z;
        nearMinX = Math.min(nearMinX, x); nearMaxX = Math.max(nearMaxX, x);
        nearMinZ = Math.min(nearMinZ, z); nearMaxZ = Math.max(nearMaxZ, z);
      }
      if (nearValid) {
        const horizontalLength = Math.hypot(this.forward.x, this.forward.z) || 1;
        const horizontalX = this.forward.x / horizontalLength, horizontalZ = this.forward.z / horizontalLength;
        nearLimit = (this.nearFootprint[2]! - camera.position.x) * horizontalX +
          (this.nearFootprint[3]! - camera.position.z) * horizontalZ;
        nearFirstX = Math.max(firstX, Math.floor(nearMinX + .5) - 1);
        nearFirstZ = Math.max(firstZ, Math.floor(nearMinZ + .5) - 1);
        const nearLastX = Math.min(lastX, Math.floor(nearMaxX + .5) + 1);
        const nearLastZ = Math.min(lastZ, Math.floor(nearMaxZ + .5) + 1);
        nearColumns = Math.max(0, nearLastX - nearFirstX + 1);
        nearRows = Math.max(0, nearLastZ - nearFirstZ + 1);
        if (nearColumns && nearRows) {
          // The base always covers the full field; the near range starts at
          // the next slot ID to avoid duplicate roots within overlapping cells.
          slots = Math.min(desiredSlots, Math.max(1, Math.floor(GROUND_GRASS_MAX_BLADES * .35 / budgetCells)));
          if (cells * slots > GROUND_GRASS_MAX_BLADES) slots = Math.floor(GROUND_GRASS_MAX_BLADES / cells);
          const nearCells = nearColumns * nearRows;
          const reserve = Math.min(this.map.image.width * this.map.image.height,
            Math.max(nearCells, nearCellBudget(this.nearFootprint)));
          const reservedBase = budgetCells * slots;
          const remaining = Math.max(0, GROUND_GRASS_MAX_BLADES - reservedBase);
          nearSlots = Math.min(desiredSlots - slots,
            Math.floor(remaining * .5 / reserve));
          if (nearSlots < 1) { slots = uniformSlots; nearColumns = nearRows = 0; }
          else {
            // The bottom quarter contains the closest and largest blades. A
            // third range uses the budget that the conservative mid-distance
            // reserve did not actually submit, still in this one draw call.
            let foregroundValid = true;
            let foreMinX = Infinity, foreMaxX = -Infinity, foreMinZ = Infinity, foreMaxZ = -Infinity;
            let foreIndex = 0;
            for (const sx of [-1, 1]) for (const sy of [-1, -.55]) {
              this.corner.set(sx, sy, .5).unproject(camera);
              this.ray.copy(this.corner).sub(camera.position).normalize();
              if (this.ray.y >= -.025) { foregroundValid = false; break; }
              const distance = -camera.position.y / this.ray.y;
              if (distance < 0) { foregroundValid = false; break; }
              const x = camera.position.x + distance * this.ray.x;
              const z = camera.position.z + distance * this.ray.z;
              this.foregroundFootprint[foreIndex++] = x;
              this.foregroundFootprint[foreIndex++] = z;
              foreMinX = Math.min(foreMinX, x); foreMaxX = Math.max(foreMaxX, x);
              foreMinZ = Math.min(foreMinZ, z); foreMaxZ = Math.max(foreMaxZ, z);
            }
            if (foregroundValid) {
              foregroundLimit = (this.foregroundFootprint[2]! - camera.position.x) * horizontalX +
                (this.foregroundFootprint[3]! - camera.position.z) * horizontalZ;
              foregroundFirstX = Math.max(nearFirstX, Math.floor(foreMinX + .5) - 1);
              foregroundFirstZ = Math.max(nearFirstZ, Math.floor(foreMinZ + .5) - 1);
              const foreLastX = Math.min(nearFirstX + nearColumns - 1, Math.floor(foreMaxX + .5) + 1);
              const foreLastZ = Math.min(nearFirstZ + nearRows - 1, Math.floor(foreMaxZ + .5) + 1);
              foregroundColumns = Math.max(0, foreLastX - foregroundFirstX + 1);
              foregroundRows = Math.max(0, foreLastZ - foregroundFirstZ + 1);
              if (foregroundColumns && foregroundRows) {
                const foregroundCells = foregroundColumns * foregroundRows;
                const reserveForeground = Math.min(this.map.image.width * this.map.image.height,
                  Math.max(foregroundCells, nearCellBudget(this.foregroundFootprint)));
                foregroundSlots = Math.min(desiredSlots - slots - nearSlots,
                  Math.floor((remaining - reserve * nearSlots) / reserveForeground));
              }
            }
            if (!foregroundSlots) nearSlots = Math.min(desiredSlots - slots, Math.floor(remaining / reserve));
          }
        }
      }
    }
    if (slots < 1) {
      this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; return;
    }
    this.gridOrigin.value.set(firstX, firstZ);
    this.gridWidth.value = columns;
    this.slotsPerCell.value = slots;
    this.baseInstances.value = cells * slots;
    this.nearGridOrigin.value.set(nearFirstX, nearFirstZ);
    this.nearGridWidth.value = Math.max(1, nearColumns);
    this.nearSlotsPerCell.value = Math.max(1, nearSlots);
    this.nearInstances.value = nearColumns * nearRows * nearSlots;
    this.foregroundGridOrigin.value.set(foregroundFirstX, foregroundFirstZ);
    this.foregroundGridWidth.value = Math.max(1, foregroundColumns);
    this.foregroundSlotsPerCell.value = Math.max(1, foregroundSlots);
    const horizontalLength = Math.hypot(this.forward.x, this.forward.z) || 1;
    this.bandView.value.set(camera.position.x, camera.position.z,
      this.forward.x / horizontalLength, this.forward.z / horizontalLength);
    this.bandLimits.value.set(nearLimit, Math.max(1.2, nearLimit * .18),
      foregroundLimit, Math.max(.8, foregroundLimit * .18));
    this.zoomVisibility.value = zoomVisibility;
    this.mesh.geometry.instanceCount = cells * slots + this.nearInstances.value +
      foregroundColumns * foregroundRows * foregroundSlots;
    this.coverDraw.setMask(this.previousPixels,this.map.image.width,this.map.version);
    this.coverDraw.setBand(0,firstX,firstZ,columns,rows,slots);
    this.coverDraw.setBand(5,nearFirstX,nearFirstZ,nearColumns,nearRows,nearSlots);
    this.coverDraw.setBand(10,foregroundFirstX,foregroundFirstZ,foregroundColumns,foregroundRows,foregroundSlots);
    this.mesh.visible = true;
  }

  prepareForCompile(): () => void {
    if (!this.supported) return () => {};
    const revision = this.revision, visible = this.mesh.visible, count = this.mesh.geometry.instanceCount;
    this.mesh.visible = true; this.mesh.geometry.instanceCount = Math.max(1, count);
    return () => { if (revision === this.revision) {
      this.mesh.geometry.instanceCount = count; this.mesh.visible = visible;
    } };
  }

  coverDrawMetrics(){return this.coverDraw.metrics();}
  dispose(): void { this.coverDraw.dispose();this.middlePalette?.dispose();this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.map.dispose(); this.bloodMap.dispose(); }
}
