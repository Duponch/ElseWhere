import * as THREE from 'three/webgpu';
import { attribute, exp, float, hash, int, ivec2, sin, cos, sqrt, texture, uint, uniform, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import type { Job, MaterialPile, Pawn, World } from '../sim/types';
import { TICKS_PER_SECOND } from '../sim/types';
import type { WildAnimal } from '../sim/wildlife-state';
import type { FireRecord } from '../sim/fire-rules';
import { structureById } from '../sim/structure-navigation';
import type { CachedActorPose } from './ActorAnimationCache';
import {
  ACTION_PARTICLES, FAMILY_FIRST_CELL, PARTICLE_SLOTS, TIME_WRAP,
  actionParticleEvents, actionParticleForAnimal, actionParticleForPawn, actionParticleIndex, actorParticleSeed, actorStrokeOffset,
  familyInfo, particleClock, placeActionParticles,
  type ActionParticleChoice, type ActionParticleEvent, type ActionParticleLookup, type ActionParticleMemory, type ParticleAnchor,
} from './action-particle-catalogue';
import { ATLAS_CELL, ATLAS_COLUMNS, ATLAS_HEIGHT, ATLAS_WIDTH, paintActionParticleAtlas } from './action-particle-atlas';

/** Fixed pool: at most this many emitters (16 particle quads each) are drawn;
 * beyond it the emitters nearest the camera target are kept. Never grows. */
export const MAX_PARTICLE_EMITTERS = 512;
/** Instance record: anchor xyz + action, direction xz + seed + event start,
 * tint rgb + stroke offset, ground + scale + visible + spare. */
const RECORD = 16;
/** Smallest on-screen particle (pixels at the current zoom). */
export const MIN_PARTICLE_PIXELS = 8;
/** Texels per pool slot in the action table. */
const TEXELS = 7;
const sourceNames = ['aFrom', 'aTo', 'aTravel'] as const;
type Stream = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
const versionOf = (attr: Stream | undefined) => attr ? attr instanceof THREE.InterleavedBufferAttribute ? attr.data.version : attr.version : -1;

/** Per-slot parameters of every action, read by the vertex shader. Row 0 is
 * "no action". Built once from the catalogue. */
export function actionParticleTable(): Float32Array {
  const width = PARTICLE_SLOTS * TEXELS, rows = ACTION_PARTICLES.length + 1, data = new Float32Array(width * rows * 4);
  ACTION_PARTICLES.forEach((action, a) => {
    let slot = 0;
    action.channels.forEach((channel, c) => {
      const groups = Math.floor(channel.slots / channel.burst), family = familyInfo(channel.family);
      for (let local = 0; local < channel.slots; local++, slot++) {
        const texel = (k: number, x: number, y: number, z: number, w: number) => { const at = (((a + 1) * width) + slot * TEXELS + k) * 4; data[at] = x; data[at + 1] = y; data[at + 2] = z; data[at + 3] = w; };
        texel(0, c, local % channel.burst, Math.floor(local / channel.burst), groups);
        texel(1, channel.rhythm.omega, channel.rhythm.phase, channel.life, 0);
        texel(2, channel.speed[0], channel.speed[1], channel.spread, channel.gravity);
        texel(3, channel.elevation[0], channel.elevation[1], channel.drag, channel.radius);
        texel(4, channel.size[0], channel.size[1], channel.growth, channel.spin);
        texel(5, channel.fadeIn, channel.fadeOut, channel.sway, (channel.tint ? 1 : 0) + (channel.land ? 2 : 0) + ('emissive' in family && family.emissive ? 4 : 0));
        texel(6, FAMILY_FIRST_CELL[channel.family], family.variants, 0, 0);
      }
    });
    // Unused slots keep channel -1: never drawn.
    for (; slot < PARTICLE_SLOTS; slot++) { const at = (((a + 1) * width) + slot * TEXELS) * 4; data[at] = -1; }
  });
  for (let slot = 0; slot < PARTICLE_SLOTS; slot++) data[(slot * TEXELS) * 4] = -1;
  return data;
}

function particleGeometry(): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  const positions: number[] = [], uvs: number[] = [], slots: number[] = [], indices: number[] = [];
  for (let slot = 0; slot < PARTICLE_SLOTS; slot++) {
    const base = positions.length / 3;
    positions.push(-.5, -.5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0);
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    slots.push(slot, slot, slot, slot);
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('pSlot', new THREE.Float32BufferAttribute(slots, 1));
  geometry.setIndex(indices);
  const records = new THREE.InstancedInterleavedBuffer(new Float32Array(MAX_PARTICLE_EMITTERS * RECORD), RECORD).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('eA', new THREE.InterleavedBufferAttribute(records, 4, 0));
  geometry.setAttribute('eB', new THREE.InterleavedBufferAttribute(records, 4, 4));
  geometry.setAttribute('eC', new THREE.InterleavedBufferAttribute(records, 4, 8));
  geometry.setAttribute('eD', new THREE.InterleavedBufferAttribute(records, 4, 12));
  geometry.instanceCount = 0;
  return geometry;
}

interface Emitter {
  action: number; choice: ActionParticleChoice;
  /** Human row in the pawn source, -1 for animals and events without actor. */
  row: number; seed: number; stroke: number;
  /** Fixed pose (animals, events), read once. */
  pose?: CachedActorPose;
  /** Event start tick, -1 for continuous actions. */
  startTick: number; endTick: number;
}
const NO_POSE: CachedActorPose = { x: 0, y: 0, z: 0, yaw: 0 };
export interface ActionParticleAnimals { cpuPoseForId(id: number): CachedActorPose | undefined }

/** Drawn action particles: one resident instanced draw, a fixed pool of
 * MAX_PARTICLE_EMITTERS × 16 quads, a shared painted atlas. The confirmed
 * snapshot chooses each actor's action (CPU, once per snapshot); every
 * particle's birth, arc, spin and fade is computed in the vertex shader from
 * the confirmed presentation clock and a per-emitter seed, with no particle
 * object, no per-frame allocation and no upload while nothing changes. */
export class ActionParticleLayer {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.SpriteNodeMaterial>;
  /** Confirmed presentation clock (s, wraps at 2π like the human rig's). */
  readonly time = uniform(0);
  private readonly visibleSlots = uniform(PARTICLE_SLOTS);
  private readonly gouache = uniform(0);
  private readonly light = uniform(1);
  /** Smallest drawn size (m): about eight pixels at the current zoom, so the
   * particles stay readable at the default zoom and true to scale up close. */
  private readonly minSize = uniform(0);
  private readonly atlas: THREE.DataArrayTexture;
  private readonly table: THREE.DataTexture;
  private readonly records: THREE.InstancedInterleavedBuffer;
  private readonly bounds = new THREE.Sphere();
  private emitters: Emitter[] = [];
  private events: Emitter[] = [];
  private readonly memories = new Map<number, ActionParticleMemory>();
  private readonly seen = new Set<number>();
  private readonly found: ActionParticleEvent[] = [];
  private source: THREE.InstancedBufferGeometry | undefined;
  private readonly versions: number[] = [-1, -1, -1];
  private dirty = false;
  private gated = 0;
  private count = 0;
  private detailVisible = true;
  private readonly anchor: ParticleAnchor = { x: 0, y: 0, z: 0, dirX: 0, dirZ: 0, ground: 0 };
  private readonly pose: CachedActorPose = { x: 0, y: 0, z: 0, yaw: 0 };
  private readonly target = new THREE.Vector3();
  private readonly tint = new THREE.Color();
  // Lookups over one snapshot, rebuilt only when their source array changes.
  private jobs: { source?: readonly Job[]; map: Map<number, Job> } = { map: new Map() };
  private pawnIndex: { source?: readonly Pawn[]; map: Map<number, Pawn> } = { map: new Map() };
  private animalIndex: { source?: readonly WildAnimal[]; map: Map<number, WildAnimal> } = { map: new Map() };
  private pileIndex: { source?: readonly MaterialPile[]; map: Map<number, MaterialPile> } = { map: new Map() };

  constructor(private readonly clock: { readonly travelTime: { value: number } }) {
    const geometry = particleGeometry();
    this.records = (geometry.getAttribute('eA') as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer;
    const pixels = paintActionParticleAtlas();
    this.atlas = new THREE.DataArrayTexture(pixels, ATLAS_WIDTH, ATLAS_HEIGHT, 2);
    this.atlas.format = THREE.RGBAFormat; this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.magFilter = THREE.LinearFilter; this.atlas.minFilter = THREE.LinearMipmapLinearFilter; this.atlas.generateMipmaps = true;
    this.atlas.wrapS = this.atlas.wrapT = THREE.ClampToEdgeWrapping; this.atlas.flipY = false; this.atlas.needsUpdate = true;
    this.table = new THREE.DataTexture(actionParticleTable(), PARTICLE_SLOTS * TEXELS, ACTION_PARTICLES.length + 1, THREE.RGBAFormat, THREE.FloatType);
    this.table.minFilter = this.table.magFilter = THREE.NearestFilter; this.table.generateMipmaps = false; this.table.colorSpace = THREE.NoColorSpace; this.table.needsUpdate = true;
    const tableNode = texture(this.table);
    const slot = attribute('pSlot', 'float'), eA = attribute('eA', 'vec4'), eB = attribute('eB', 'vec4'), eC = attribute('eC', 'vec4'), eD = attribute('eD', 'vec4');
    const row = int(eA.w);
    const texel = (k: number) => { const read = tableNode.load(ivec2(int(slot).mul(TEXELS).add(k), row)); read.updateMatrix = false; return read; };
    const t0 = texel(0), t1 = texel(1), t2 = texel(2), t3 = texel(3), t4 = texel(4), t5 = texel(5), t6 = texel(6);
    const channel = t0.x, index = t0.y, group = t0.z, groups = t0.w;
    const omega = t1.x, phase = t1.y, life = t1.z;
    const start = eB.w, once = start.greaterThanEqual(0);
    const wrap = float(TIME_WRAP);
    // Latest burst of this slot's group and its age (see sampleActionParticle).
    const u = omega.mul(this.time).add(eC.w).sub(phase).div(wrap);
    const burst = group.add(groups.mul(u.sub(group).div(groups.max(1)).floor()));
    const repeatAge = u.sub(burst).mul(wrap).div(omega.max(1e-3));
    const onceAge = this.time.sub(start).sub(wrap.mul(this.time.sub(start).div(wrap).floor()));
    const age = once.select(onceAge, repeatAge);
    const burstId = once.select(float(0), burst.sub(omega.mul(burst.div(omega.max(1)).floor())));
    const key = uint(eB.z.mul(4099).add(burstId.mul(131)).add(index.mul(17)).add(channel.mul(7919)));
    const r = (n: number) => hash(key.add(uint((n * 0x9e3779b1) >>> 0)));
    const turn = r(1).mul(2).sub(1).mul(t2.z), ct = cos(turn), st = sin(turn);
    const ux = eB.x.mul(ct).add(eB.y.mul(st)), uz = eB.y.mul(ct).sub(eB.x.mul(st));
    const elevation = t3.x.add(t3.y.sub(t3.x).mul(r(2))), speed = t2.x.add(t2.y.sub(t2.x).mul(r(3)));
    const horizontal = cos(elevation).mul(speed), vy = sin(elevation).mul(speed);
    const jitter = t3.w.mul(sqrt(r(4))), jitterAngle = r(5).mul(TIME_WRAP);
    const x0 = eA.x.add(cos(jitterAngle).mul(jitter)), z0 = eA.z.add(sin(jitterAngle).mul(jitter)), y0 = eA.y.add(r(6).sub(.5).mul(t3.w));
    const gravity = t2.w, drag = t3.z, flags = t5.w, land = flags.mod(4).greaterThanEqual(2), tinted = flags.mod(2).greaterThanEqual(1), emissive = flags.greaterThanEqual(4);
    const drop = y0.sub(eD.x).max(0), landing = vy.add(sqrt(vy.mul(vy).add(gravity.mul(2).mul(drop)))).div(gravity.max(1e-3));
    const flight = land.and(gravity.greaterThan(0)).select(age.min(landing), age);
    const travel = drag.greaterThan(.001).select(float(1).sub(exp(drag.negate().mul(flight))).div(drag.max(1e-3)), flight);
    const sway = sin(age.mul(6).add(r(7).mul(TIME_WRAP))).mul(t5.z);
    const fall = y0.add(vy.mul(flight)).sub(gravity.mul(.5).mul(flight).mul(flight));
    const center = vec3(x0.add(ux.mul(horizontal).mul(travel)).add(uz.mul(sway)), land.select(fall.max(eD.x.add(.01)), fall), z0.add(uz.mul(horizontal).mul(travel)).sub(ux.mul(sway)));
    const alive = channel.greaterThanEqual(0).and(eA.w.greaterThan(.5)).and(eD.z.greaterThan(.5)).and(slot.lessThan(this.visibleSlots))
      .and(age.greaterThanEqual(0)).and(age.lessThanEqual(life));
    const size = t4.x.add(t4.y.sub(t4.x).mul(r(8))).max(this.minSize.mul(r(8).mul(.3).add(.85))).mul(float(1).add(t4.z.mul(age).div(life.max(1e-3)))).mul(eD.y);
    const spinSign = r(9).lessThan(.5).select(float(-1), float(1));
    const fadeIn = t5.x.greaterThan(0).select(age.div(t5.x.max(1e-3)).min(1), float(1));
    const fadeOut = t5.y.greaterThan(0).select(life.sub(age).div(t5.y.max(1e-3)).min(1), float(1));
    const cell = t6.x.add(r(11).mul(t6.y).floor().min(t6.y.sub(1)));
    const material = new THREE.SpriteNodeMaterial({ transparent: true, depthTest: true, depthWrite: false, alphaTest: .02 });
    material.positionNode = center;
    material.scaleNode = vec2(alive.select(size, float(0)));
    material.rotationNode = r(10).mul(TIME_WRAP).add(spinSign.mul(t4.w).mul(flight));
    // Explicit varyings: an instanced sprite must not read vertex values in the fragment directly.
    const vUv = varying(uv()), vCell = varying(cell), vAlpha = varying(fadeIn.mul(fadeOut).max(0));
    const vTint = varying(tinted.select(eC.xyz, vec3(1))), vGlow = varying(emissive.select(float(1), float(0)));
    const cx = vCell.mod(ATLAS_COLUMNS), cy = vCell.div(ATLAS_COLUMNS).floor();
    const atlasUv = vec2(cx.add(vUv.x).mul(ATLAS_CELL / ATLAS_WIDTH), cy.add(float(1).sub(vUv.y)).mul(ATLAS_CELL / ATLAS_HEIGHT));
    const painted = texture(this.atlas, atlasUv).depth(this.gouache);
    const lit = vGlow.greaterThan(.5).select(float(1.15), this.light);
    material.colorNode = vec4(painted.rgb.mul(vTint).mul(lit), painted.a.mul(vAlpha));
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Action particles — drawn atlas, fixed pool';
    this.mesh.renderOrder = 4;
    geometry.boundingSphere = this.bounds;
    this.mesh.frustumCulled = true;
    this.mesh.visible = false;
    this.group.add(this.mesh);
  }

  /** Confirmed snapshot: chooses every actor's action and detects events. */
  update(world: World, source: THREE.InstancedBufferGeometry | undefined, animals?: ActionParticleAnimals): void {
    this.source = source;
    const lookup = this.lookup(world), tick = world.tick;
    const previous = this.emitters;this.emitters = [];
    this.seen.clear();this.found.length = 0;
    world.pawns.forEach((pawn, row) => {
      this.seen.add(pawn.id);
      const memory = this.memories.get(pawn.id);
      const next = actionParticleEvents(memory, pawn, tick, lookup, this.found);
      if (!memory) this.memories.set(pawn.id, next);
      for (const event of this.found) this.addEvent(event, pawn, row);
      this.found.length = 0;
      const choice = actionParticleForPawn(pawn, lookup);
      if (choice) this.emitters.push({ action: actionParticleIndex(choice.action), choice, row, seed: actorParticleSeed(pawn.id), stroke: actorStrokeOffset(pawn.id), startTick: -1, endTick: 0 });
    });
    for (const id of this.memories.keys()) if (!this.seen.has(id)) this.memories.delete(id);
    if (animals) for (const animal of world.wildlife?.animals ?? []) {
      if (animal.state !== 'eating' && animal.state !== 'sleeping') continue;
      const choice = actionParticleForAnimal(animal);
      if (!choice) continue;
      const pose = animals.cpuPoseForId(animal.id);
      this.emitters.push({ action: actionParticleIndex(choice.action), choice, row: -1, seed: actorParticleSeed(animal.id), stroke: actorStrokeOffset(animal.id),
        pose: pose ? { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw } : { x: animal.x, y: 0, z: animal.z, yaw: 0 }, startTick: -1, endTick: 0 });
    }
    if (!this.dirty && previous.length === this.emitters.length) {
      for (let i = 0; i < previous.length; i++) {
        const a = previous[i]!, b = this.emitters[i]!;
        if (a.action !== b.action || a.row !== b.row || a.seed !== b.seed || a.choice.tx !== b.choice.tx || a.choice.tz !== b.choice.tz || a.choice.tint !== b.choice.tint
          || a.pose?.x !== b.pose?.x || a.pose?.z !== b.pose?.z || a.pose?.yaw !== b.pose?.yaw) { this.dirty = true; break; }
      }
    } else this.dirty = true;
  }

  /** Every frame: the clock, and records only when an actor pose or the
   * emitter set changed (no upload while everything stands still). */
  present(tick: number): void {
    this.time.value = particleClock(tick);
    if (this.events.length) this.retire(tick);
    const source = this.source;
    let changed = this.dirty;
    if (source) for (let i = 0; i < 3; i++) { const v = versionOf(source.getAttribute(sourceNames[i]!) as Stream | undefined); if (v !== this.versions[i]) { this.versions[i] = v; changed = true; } }
    if (!changed && !this.gated) return;
    this.write();
  }
  setView(camera: THREE.Camera, target?: THREE.Vector3): void { if (target) this.target.copy(target); else this.target.setFromMatrixPosition(camera.matrixWorld); }
  /** Gouache or Pastel atlas layer, daylight (0..1) and the zoom level of detail. */
  setPresentation(gouache: boolean, daylight: number, cellPixels: number): void {
    this.gouache.value = gouache ? 1 : 0;
    this.light.value = .62 + .38 * Math.max(0, Math.min(1, daylight));
    this.visibleSlots.value = cellPixels < 9 ? 0 : cellPixels < 16 ? PARTICLE_SLOTS / 2 : PARTICLE_SLOTS;
    this.minSize.value = cellPixels > 0 ? MIN_PARTICLE_PIXELS / cellPixels : 0;
    this.mesh.visible = this.count > 0 && this.detailVisible && this.visibleSlots.value > 0;
  }
  setDetailVisible(visible: boolean): void { this.detailVisible = visible; this.mesh.visible = visible && this.count > 0 && this.visibleSlots.value > 0; }
  get emitterCount(): number { return this.count; }
  prepareForCompile(): () => void {
    const count = this.mesh.geometry.instanceCount, visible = this.mesh.visible, culled = this.mesh.frustumCulled;
    this.mesh.geometry.instanceCount = Math.max(1, count); this.mesh.visible = true; this.mesh.frustumCulled = false;
    return () => { this.mesh.geometry.instanceCount = count; this.mesh.visible = visible; this.mesh.frustumCulled = culled; };
  }
  dispose(): void { this.atlas.dispose(); this.table.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.source = undefined; }

  private addEvent(event: ActionParticleEvent, pawn: Pawn, row: number): void {
    const index = actionParticleIndex(event.action), spec = ACTION_PARTICLES[index - 1]!;
    const life = Math.max(...spec.channels.map(c => c.life));
    this.events.push({ action: index, choice: { action: event.action, tx: event.tx, tz: event.tz, ty: event.ty, tint: event.tint }, row,
      seed: actorParticleSeed(pawn.id * 31 + Math.round(event.tick)), stroke: 0, startTick: event.tick, endTick: event.tick + (life + .25) * TICKS_PER_SECOND });
    // A burst of events (many pick-ups at once) cannot grow the pool.
    if (this.events.length > 64) this.events.shift();
    this.dirty = true;
  }
  /** Events end with their longest particle; an event too far ahead of the
   * presented clock (its wrapped start would be ambiguous) is dropped. */
  private retire(tick: number): void {
    let kept = 0;
    for (const event of this.events) if (event.endTick > tick && event.startTick < tick + 4 * TICKS_PER_SECOND) this.events[kept++] = event;
    if (kept !== this.events.length) { this.events.length = kept; this.dirty = true; }
  }
  /** Presented end pose of the emitter's actor; sets `arrived`. */
  private actorPose(emitter: Emitter, out: CachedActorPose): CachedActorPose {
    this.arrived = true;
    if (emitter.row < 0 || !this.source) return emitter.pose ?? NO_POSE;
    const to = this.source.getAttribute('aTo') as Stream | undefined, travel = this.source.getAttribute('aTravel') as Stream | undefined;
    if (!to || !travel || emitter.row >= to.count) return emitter.pose ?? NO_POSE;
    out.x = to.getX(emitter.row); out.y = to.getY(emitter.row); out.z = to.getZ(emitter.row); out.yaw = to.getW(emitter.row);
    // Wait for the drawn body to arrive (an approach edge still running).
    const start = travel.getX(emitter.row), end = travel.getY(emitter.row);
    this.arrived = !(end > start && this.clock.travelTime.value < end);
    if (emitter.startTick >= 0) { emitter.pose = { x: out.x, y: out.y, z: out.z, yaw: out.yaw }; emitter.row = -1; this.arrived = true; }
    return out;
  }
  private write(): void {
    this.dirty = false;
    const total = this.events.length + this.emitters.length;
    let ordered: readonly Emitter[] | undefined;
    if (total > MAX_PARTICLE_EMITTERS) {
      // Keep the events, then the emitters nearest the camera target (rare: allocates).
      const tx = this.target.x, tz = this.target.z, distance = (e: Emitter) => { const p = this.actorPose(e, this.pose); return (p.x - tx) ** 2 + (p.z - tz) ** 2; };
      ordered = [...this.events, ...[...this.emitters].sort((a, b) => distance(a) - distance(b))].slice(0, MAX_PARTICLE_EMITTERS);
    }
    const count = Math.min(total, MAX_PARTICLE_EMITTERS);
    this.upload = count !== this.count;this.gatedCount = 0;
    this.minX = this.minZ = Infinity;this.maxX = this.maxZ = -Infinity;
    for (let i = 0; i < count; i++) this.writeRecord(i, ordered ? ordered[i]! : i < this.events.length ? this.events[i]! : this.emitters[i - this.events.length]!);
    this.gated = this.gatedCount;
    this.count = count;
    this.mesh.geometry.instanceCount = count;
    if (this.upload) { this.records.clearUpdateRanges(); this.records.addUpdateRange(0, Math.max(1, count) * RECORD); this.records.needsUpdate = true; }
    if (count) { this.bounds.center.set((this.minX + this.maxX) / 2, 1.2, (this.minZ + this.maxZ) / 2); this.bounds.radius = Math.hypot(this.maxX - this.minX, this.maxZ - this.minZ) / 2 + 3; }
    this.mesh.visible = count > 0 && this.detailVisible && this.visibleSlots.value > 0;
  }
  private arrived = true;
  private upload = false;
  private gatedCount = 0;
  private minX = 0; private minZ = 0; private maxX = 0; private maxZ = 0;
  private put(at: number, value: number): void { const v = Math.fround(value), array = this.records.array as Float32Array; if (array[at] !== v) { array[at] = v; this.upload = true; } }
  private writeRecord(i: number, emitter: Emitter): void {
    const spec = ACTION_PARTICLES[emitter.action - 1]!, pose = this.actorPose(emitter, this.pose);
    if (!this.arrived) this.gatedCount++;
    const a = placeActionParticles(spec.placement, pose, emitter.choice, this.anchor);
    const length = Math.hypot(a.dirX, a.dirZ), dx = length > .001 ? a.dirX / length : 0, dz = length > .001 ? a.dirZ / length : 1;
    if (emitter.choice.tint !== undefined) this.tint.setHex(emitter.choice.tint); else this.tint.setRGB(1, 1, 1);
    const at = i * RECORD;
    this.put(at, a.x); this.put(at + 1, a.y); this.put(at + 2, a.z); this.put(at + 3, emitter.action);
    this.put(at + 4, dx); this.put(at + 5, dz); this.put(at + 6, emitter.seed); this.put(at + 7, emitter.startTick >= 0 ? particleClock(emitter.startTick) : -1);
    this.put(at + 8, this.tint.r); this.put(at + 9, this.tint.g); this.put(at + 10, this.tint.b); this.put(at + 11, emitter.stroke);
    this.put(at + 12, a.ground); this.put(at + 13, 1); this.put(at + 14, this.arrived ? 1 : 0); this.put(at + 15, 0);
    if (a.x < this.minX) this.minX = a.x; if (a.x > this.maxX) this.maxX = a.x; if (a.z < this.minZ) this.minZ = a.z; if (a.z > this.maxZ) this.maxZ = a.z;
  }
  private lookup(world: World): ActionParticleLookup {
    const index = <T extends { id: number }>(cache: { source?: readonly T[]; map: Map<number, T> }, source: readonly T[] | undefined): Map<number, T> => {
      const list = source ?? [];
      if (cache.source !== list) { cache.source = list; cache.map.clear(); for (const item of list) if (!cache.map.has(item.id)) cache.map.set(item.id, item); }
      return cache.map;
    };
    const fires = world.fires?.items;
    return {
      job: id => index(this.jobs, world.jobs).get(id),
      structure: id => structureById(world, id),
      fire: id => fires?.find(fire => fire.id === id) as FireRecord | undefined,
      pawn: id => index(this.pawnIndex, world.pawns).get(id),
      animal: id => index(this.animalIndex, world.wildlife?.animals).get(id),
      pile: id => id < 0 ? undefined : index(this.pileIndex, world.piles).get(id),
      tile: (x, z) => x >= 0 && z >= 0 && x < world.width && z < world.height ? world.tiles[z * world.width + x] : undefined,
    };
  }
}
