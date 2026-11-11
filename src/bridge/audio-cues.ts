import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {effectiveCore297} from '../sim/core-phase-297';
import type { World } from '../sim/types.ts';
import { isConstruction } from '../sim/construction-rules.ts';
import { structureById } from '../sim/structure-navigation.ts';
import { isTailoring, stationAccepts, taskRecipe } from '../sim/production-recipes.ts';
import { WORK_FRACTIONS } from '../sim/work-progress.ts';
import { isColonist } from '../sim/affiliation.ts';
import type { AnimalSpeciesId } from '../sim/animal-species.ts';
import { actualPowerSwitch, canFlickPower } from '../sim/power-flick.ts';
import { appearanceOf } from '../sim/pawn-appearance.ts';
import { anestheticModifiers } from '../sim/anesthetic.ts';

type AnimalVoiceSpecies = Exclude<AnimalSpeciesId, 'snow-hare'>;
type AnimalDeathVoiceSpecies = Exclude<AnimalVoiceSpecies, 'red-fox'>;
const animalVoiceSpecies = (species:AnimalSpeciesId):AnimalVoiceSpecies =>
  species === 'snow-hare' ? 'hare' : species;

export type AudioCueKind = 'mining.hit' | 'woodcutting.hit' | 'construction.hit'
  | 'cooking.work' | 'crafting.work' | 'tailoring.work' | 'butchering.work' | 'research.work'
  | 'weapon.gunshot' | 'weapon.melee' | 'weapon.impact-ground' | 'weapon.impact-barrier'
  | 'weapon.impact-flesh' | 'weapon.explosion' | 'door.open' | 'door.close'
  | 'haul.pickup' | 'haul.drop' | 'farming.sow' | 'farming.harvest' | 'eating.work'
  | 'cleaning.work' | 'medical.tend' | 'maintenance.work' | 'firefighting.beat'
  | 'power.switch-on' | 'power.switch-off' | 'deconstruction.work' | 'building.deconstructed'
  | 'autodoor.open' | 'autodoor.close' | 'weather.thunder'
  | `human.hurt.${'male'|'female'}`
  | `animal.hurt.${AnimalVoiceSpecies}` | `animal.death.${AnimalDeathVoiceSpecies}`
  | 'ui.threat' | 'ui.colonist-death'
  | 'ui.click' | 'ui.reject' | 'ui.panel';
/** Causal source facts, copied before later owners can clear an action. These
 * are Worker-internal observations, never a public/native grant. */
export interface CoreStrikeAudio297 {readonly actorId:number;readonly atCore:number;readonly x:number;readonly z:number;readonly kind:'human'|'animal'|'mechanical'}
export interface CoreShotAudio297 {readonly projectileId:number;readonly pawnId?:number;readonly atCore:number;readonly x:number;readonly z:number}
export interface PreparedAudioCuePublication297 {readonly cues:AudioCue[]}
export interface AudioCue {
  id: string;
  tick: number;
  kind: AudioCueKind;
  x: number;
  z: number;
  intensity?: number;
}

const MAX_CUES_PER_TICK = 32;
const MAX_PENDING_CUES = 128;
// Short, bounded gaps keep each action legible without a metronomic loop.
const WORK_CUE_INTERVAL_TICKS = [2, 3, 4, 5] as const;
const STATION_CUE_INTERVAL_TICKS = [5, 6, 7, 8, 9, 10, 11] as const;
const EATING_CUE_INTERVAL_TICKS = [4, 5, 6, 7] as const;

type WorkObservation = { key: string; progress: number; nextCueTick: number; cueCount: number };
type HaulObservation = { sourcePileId: number; phase: 'pickup' | 'deliver'; carryPileId: number | null;
  x: number; z: number; whole: boolean };
type DeconstructionObservation = { structureId: number; progress: number; reservedBy: number | null;
  x: number; z: number };
/** The medical kernel allocates an injury identity for every committed nonzero
 * layer, including merged injuries and immediately lost parts. Healing, blood
 * loss and illness never advance it. Copy the number, never retain World data. */
type ActorDamageObservation = { state: string; nextInjuryId: number };

function workCueInterval(pawnId: number, key: string, cueCount: number, intervals: readonly number[]): number {
  // This hash belongs to presentation only; it consumes no simulation random state.
  let hash = (2166136261 ^ pawnId ^ Math.imul(cueCount, 0x9e3779b9)) >>> 0;
  for (let index = 0; index < key.length; index++)
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  return intervals[(hash >>> 0) % intervals.length]!;
}

/** Presentation-only observer. Its state is neither simulation input nor saved. */
export class AudioCueRecorder {
  private coreCapture297:number|undefined;
  private publicationGeneration297=0;
  private readonly preparedPublications297=new WeakMap<object,{generation:number;prefix:readonly AudioCue[]}>();
  private initialized = false;
  private tick = -1;
  private tickCount = 0;
  private readonly pending: AudioCue[] = [];
  private work = new Map<number, WorkObservation>();
  private projectiles = new Set<number>();
  private projectileArrivals = new Set<number>();
  private bombWaves=new Set<number>();
  private shooting = new Map<number, number>();
  private melee = new Map<number, number>();
  private doors = new Map<number, boolean>();
  private hauls = new Map<number, HaulObservation>();
  private pawnStates = new Map<number, ActorDamageObservation>();
  private animalStates = new Map<number, ActorDamageObservation>();
  private firefighting = new Map<number, { fireId: number; cooldownCore: number }>();
  private fireIds = new Set<number>();
  private switches = new Map<number, boolean>();
  private flickJobs = new Map<number, boolean>();
  private deconstructionJobs = new Map<number, DeconstructionObservation>();
  private structures = new Set<number>();
  private deconstructionCount = 0;
  private lightningCount = 0;

  reset(): void {
    this.publicationGeneration297++;
    this.initialized = false;
    this.tick = -1;
    this.tickCount = 0;
    this.pending.length = 0;
    this.work.clear();
    this.projectiles.clear();
    this.projectileArrivals.clear();
    this.bombWaves.clear();
    this.shooting.clear();
    this.melee.clear();
    this.doors.clear();
    this.hauls.clear();
    this.pawnStates.clear();
    this.animalStates.clear();
    this.firefighting.clear();
    this.fireIds.clear();
    this.switches.clear();
    this.flickJobs.clear();
    this.deconstructionJobs.clear();
    this.structures.clear();
    this.deconstructionCount = 0;
    this.lightningCount = 0;
  }

  /** Only a committed physical boundary calls this. Work/doors/health retain
   * the existing observer; causal receipts preserve intra-Core transients. */
  capturePhysical297(world:World,core:number,strikes:readonly CoreStrikeAudio297[],shots:readonly CoreShotAudio297[]):void {
    if(!isCorePhysicalSchema297(Number(world.schemaVersion))||core!==effectiveCore297(world)||!Number.isSafeInteger(core)||strikes.length>512||shots.length>512||this.coreCapture297!==undefined)throw Error('Invalid physical audio boundary');
    this.coreCapture297=core;
    try{
      if(world.tick!==this.tick){this.tick=world.tick;this.tickCount=0;}
      for(const event of strikes){
        if(event.atCore!==core||!Number.isSafeInteger(event.actorId)||event.actorId<1||event.actorId>=world.nextId||!Number.isFinite(event.x)||!Number.isFinite(event.z)||!['human','animal','mechanical'].includes(event.kind))throw Error('Invalid causal strike audio');
        if(this.initialized&&this.melee.get(event.actorId)!==event.atCore){const id=event.kind==='mechanical'?`melee:${event.actorId}:${event.atCore}`:`melee:${event.atCore}:${event.actorId}`;this.add({id,tick:world.tick,kind:'weapon.melee',x:event.x,z:event.z});}
        this.melee.set(event.actorId,event.atCore);
      }
      for(const event of shots){
        if(event.atCore!==core||!Number.isSafeInteger(event.projectileId)||event.projectileId<1||event.projectileId>=world.nextId||!Number.isFinite(event.x)||!Number.isFinite(event.z)||event.pawnId!==undefined&&(!Number.isSafeInteger(event.pawnId)||event.pawnId<1||event.pawnId>=world.nextId))throw Error('Invalid causal shot audio');
        const fresh=!this.projectiles.has(event.projectileId),freshPawn=event.pawnId===undefined||this.shooting.get(event.pawnId)!==event.atCore;
        if(this.initialized&&fresh&&freshPawn)this.add({id:event.pawnId===undefined?`shot:${event.projectileId}`:`shot:${event.pawnId}:${event.atCore}`,tick:world.tick,kind:'weapon.gunshot',x:event.x,z:event.z});
        this.projectiles.add(event.projectileId);if(event.pawnId!==undefined)this.shooting.set(event.pawnId,event.atCore);
      }
      this.capture(world);
    }finally{this.coreCapture297=undefined;}
  }
  capture(world: World): void {
    if (world.tick !== this.tick) { this.tick = world.tick; this.tickCount = 0; }
    const previousWork = this.work;
    const previousProjectiles = this.projectiles;
    const previousProjectileArrivals = this.projectileArrivals;
    const previousShooting = this.shooting;
    const previousMelee = this.melee;
    const previousDoors = this.doors;
    const previousHauls = this.hauls;
    const work = new Map<number, WorkObservation>();
    const projectiles = new Set<number>();
    const projectileArrivals = new Set<number>();
    const shooting = new Map<number, number>();
    const emittedShots = new Set<string>();
    const melee = new Map<number, number>();
    const doors = new Map<number, boolean>();
    const hauls = new Map<number, HaulObservation>();
    const pawnStates = new Map<number, ActorDamageObservation>();
    const animalStates = new Map<number, ActorDamageObservation>();
    const firefighting = new Map<number, { fireId: number; cooldownCore: number }>();
    const fireIds = new Set((world.fires?.items ?? []).map(fire => fire.id));
    const switches = new Map<number, boolean>();
    const flickJobs = new Map<number, boolean>();
    const deconstructionJobs = new Map<number, DeconstructionObservation>();
    const jobs = new Map<number, World['jobs'][number]>();
    for (const job of world.jobs) {
      jobs.set(job.id, job);
      // Pending work cannot finish between two captures: both actions need at
      // least two contacted ticks. Follow targets from the first work tick.
      if (job.kind === 'flick' && job.flick && job.progress > 0)
        flickJobs.set(job.flick.structureId, job.flick.on);
      if (job.kind === 'deconstruct' && job.deconstruction && job.reservedBy !== null
        && (job.progress > 0 || (job.workRemainder ?? 0) > 0))
        deconstructionJobs.set(job.id, { structureId: job.deconstruction.structureId,
          progress: job.progress * WORK_FRACTIONS + (job.workRemainder ?? 0),
          reservedBy: job.reservedBy, x: job.x, z: job.z });
    }
    const watchedTargets = new Set<number>();
    for (const job of this.deconstructionJobs.values()) watchedTargets.add(job.structureId);
    for (const job of deconstructionJobs.values()) watchedTargets.add(job.structureId);
    const watchedSwitches = new Set<number>();
    for (const id of this.flickJobs.keys()) watchedSwitches.add(id);
    for (const id of flickJobs.keys()) watchedSwitches.add(id);
    const structures = new Set<number>();
    // Shared id index: the first structure with this id, as world.structures.find.
    const stationFor = (id: number): World['structures'][number] | undefined => structureById(world, id);

    const recordWork = (pawnId: number, key: string, progress: number, kind: AudioCueKind,
      x: number, z: number, active: boolean, intervals: readonly number[]): void => {
      const previous = previousWork.get(pawnId);
      const sameTask = previous?.key === key;
      const nextCueTick = sameTask ? previous.nextCueTick : -Infinity;
      const cueCount = sameTask ? previous.cueCount : 0;
      if (this.initialized && active && sameTask && progress > previous.progress
        && world.tick >= nextCueTick) {
        this.add({ id: `${kind}:${world.tick}:${pawnId}:${key}`, tick: world.tick, kind, x, z });
        work.set(pawnId, { key, progress,
          nextCueTick: world.tick + workCueInterval(pawnId, key, cueCount, intervals), cueCount: cueCount + 1 });
      } else work.set(pawnId, { key, progress, nextCueTick, cueCount });
    };

    for (const pawn of world.pawns) {
      const nextInjuryId = pawn.health?.nextInjuryId ?? 1;
      pawnStates.set(pawn.id, { state: pawn.state, nextInjuryId });
      const previousPawnState = this.pawnStates.get(pawn.id);
      if (this.initialized && previousPawnState && previousPawnState.state !== 'dead'
        && pawn.state !== 'dead' && !pawn.health?.death
        && nextInjuryId > previousPawnState.nextInjuryId
        && anestheticModifiers(pawn.health?.anesthetic).painFactor > 0) {
        const sex = appearanceOf(pawn, world.seed).sex;
        this.add({ id: `human.hurt:${pawn.id}:${nextInjuryId}`, tick: world.tick,
          kind: `human.hurt.${sex}`, x: pawn.x, z: pawn.z });
      }
      const beat = pawn.firefighting;
      if (beat) {
        firefighting.set(pawn.id, { fireId: beat.fireId, cooldownCore: beat.cooldownCore });
        const previousBeat = this.firefighting.get(pawn.id);
        if (this.initialized && pawn.state === 'working' && beat.phase === 'beat'
          && this.fireIds.has(beat.fireId)
          && beat.cooldownCore > (previousBeat?.fireId === beat.fireId ? previousBeat.cooldownCore : 0))
          this.add({ id: `firefighting.beat:${world.tick}:${pawn.id}:${beat.fireId}`,
            tick: world.tick, kind: 'firefighting.beat', x: pawn.x, z: pawn.z });
      }
      if (this.initialized && previousPawnState !== undefined && previousPawnState.state !== 'dead'
        && pawn.state === 'dead' && isColonist(pawn))
        this.add({ id: `ui.colonist-death:${world.tick}:${pawn.id}`, tick: world.tick,
          kind: 'ui.colonist-death', x: pawn.x, z: pawn.z });
      const previousHaul = previousHauls.get(pawn.id);
      const haul = pawn.haul;
      if (haul) {
        hauls.set(pawn.id, { sourcePileId: haul.sourcePileId, phase: haul.phase,
          carryPileId: haul.carryPileId, x: pawn.x, z: pawn.z, whole: haul.whole === true });
        if (this.initialized && previousHaul?.sourcePileId === haul.sourcePileId
          && previousHaul.phase === 'pickup' && haul.phase === 'deliver'
          && haul.carryPileId !== null) {
          this.add({ id: `haul.pickup:${world.tick}:${pawn.id}:${haul.carryPileId}`,
            tick: world.tick, kind: 'haul.pickup', x: pawn.x, z: pawn.z });
        }
      }
      if (this.initialized && previousHaul?.phase === 'deliver' && previousHaul.carryPileId !== null
        && (!haul || haul.carryPileId !== previousHaul.carryPileId)) {
        const stillCarried = previousHaul.whole
          ? world.packed.some(pack => pack.building.id === previousHaul.carryPileId
            && pack.owner.type === 'pawn' && pack.owner.pawnId === pawn.id)
          : world.piles.some(pile => pile.id === previousHaul.carryPileId
            && pile.owner.type === 'pawn' && pile.owner.pawnId === pawn.id);
        if (!stillCarried) this.add({ id: `haul.drop:${world.tick}:${pawn.id}:${previousHaul.carryPileId}`,
          tick: world.tick, kind: 'haul.drop', x: pawn.x, z: pawn.z });
      }
      const job = pawn.jobId === null ? undefined : jobs.get(pawn.jobId);
      if(pawn.haul?.destination.type==='turret'&&pawn.haul.serviceProgress!==undefined){
        const station=stationFor(pawn.haul.destination.structureId);
        if(station)recordWork(pawn.id,`turret-service:${station.id}:${pawn.haul.sourcePileId}`,pawn.haul.serviceProgress,
          'maintenance.work',station.x,station.z,pawn.state==='working',STATION_CUE_INTERVAL_TICKS);
      }
      if (job && (job.kind === 'mine' || job.kind === 'chop' || job.kind === 'sow'
        || job.kind === 'harvest' || job.kind === 'cut' || job.kind === 'repair'
        || job.kind === 'deconstruct'
        || job.kind === 'fix-breakdown' || isConstruction(job)) && !job.furniture
        && job.installationWork !== 'haul') {
        const kind = job.kind === 'mine' ? 'mining.hit' : job.kind === 'chop' ? 'woodcutting.hit'
          : job.kind === 'sow' ? 'farming.sow'
          : job.kind === 'harvest' || job.kind === 'cut' ? 'farming.harvest'
            : job.kind === 'deconstruct' ? 'deconstruction.work'
              : job.kind === 'repair' || job.kind === 'fix-breakdown' ? 'maintenance.work' : 'construction.hit';
        recordWork(pawn.id, `job:${job.id}`, job.progress * WORK_FRACTIONS + (job.workRemainder ?? 0), kind,
          job.x, job.z, pawn.state === 'working', WORK_CUE_INTERVAL_TICKS);
      } else if (pawn.cleaning) {
        const task = pawn.cleaning;
        recordWork(pawn.id, `clean:${task.snowCell===undefined?task.targets[0]??'none':'snow:'+task.snowCell}`, task.progress, 'cleaning.work',
          pawn.x, pawn.z, task.phase === 'clean' && pawn.state === 'working', STATION_CUE_INTERVAL_TICKS);
      } else if (pawn.surgery) {
        const task = pawn.surgery;
        // Actual contacted time drives cadence; dynamic surgical speed must
        // not turn a faster progress multiplier into a faster sound loop.
        recordWork(pawn.id, `surgery:${task.patientId}:${task.part}`, task.workCore, 'medical.tend',
          pawn.x, pawn.z, task.phase === 'work' && pawn.state === 'working', STATION_CUE_INTERVAL_TICKS);
      } else if (pawn.tend) {
        const task = pawn.tend;
        recordWork(pawn.id, `tend:${task.patientId}`, task.progress, 'medical.tend',
          pawn.x, pawn.z, task.phase === 'tend' && pawn.state === 'working', STATION_CUE_INTERVAL_TICKS);
      } else if (pawn.need?.kind === 'eat' && pawn.need.phase === 'ingest') {
        recordWork(pawn.id, `eat:${pawn.need.sourcePileId}:${pawn.need.carryPileId}`,
          pawn.need.progress * WORK_FRACTIONS + (pawn.need.workRemainder ?? 0), 'eating.work',
          pawn.x, pawn.z, pawn.state === 'eating', EATING_CUE_INTERVAL_TICKS);
      } else if (pawn.cooking) {
        const task = pawn.cooking, station = stationFor(task.stationId), recipe = taskRecipe(task);
        if (station && stationAccepts(station, recipe)) {
          const kind: AudioCueKind = recipe === 'cook-survival-meal' || recipe === 'simple-meal' || recipe === 'cook-simple-meal-bulk' || recipe === 'fine-meal' || recipe === 'cook-fine-meal-bulk' || recipe === 'vegetarian-fine-meal' || recipe === 'cook-vegetarian-fine-meal-bulk' || recipe === 'carnivore-fine-meal' || recipe === 'cook-carnivore-fine-meal-bulk' || recipe === 'lavish-meal' || recipe === 'cook-lavish-meal-bulk' || recipe === 'vegetarian-lavish-meal' || recipe === 'cook-vegetarian-lavish-meal-bulk' || recipe === 'cook-carnivore-lavish-meal' || recipe === 'cook-carnivore-lavish-meal-bulk' ? 'cooking.work'
            : recipe === 'butcher-creature' ? 'butchering.work'
              : isTailoring(recipe) ? 'tailoring.work' : 'crafting.work';
          recordWork(pawn.id, `production:${station.id}:${task.billId}:${recipe}`, task.progress, kind,
            station.x, station.z, task.phase === 'work' && pawn.state === 'working', STATION_CUE_INTERVAL_TICKS);
        }
      } else if (pawn.research) {
        const task = pawn.research, station = stationFor(task.stationId);
        if (station && (station.kind === 'research-bench' || station.kind === 'hi-tech-research-bench'))
          recordWork(pawn.id, `research:${station.id}`, task.worked, 'research.work', station.x, station.z,
            pawn.state === 'working', STATION_CUE_INTERVAL_TICKS);
      }
      const strike = pawn.melee?.strike;
      if (strike) {
        melee.set(pawn.id, strike.atCore);
        if (this.initialized && previousMelee.get(pawn.id) !== strike.atCore)
          this.add({ id: `melee:${strike.atCore}:${pawn.id}`, tick: world.tick,
            kind: 'weapon.melee', x: pawn.x, z: pawn.z });
      }
      const stance = pawn.shooting?.stance;
      if (stance?.phase === 'cooldown') {
        shooting.set(pawn.id, stance.startedAtCore);
        emittedShots.add(`${pawn.id}:${stance.startedAtCore}`);
        if (this.initialized && previousShooting.get(pawn.id) !== stance.startedAtCore) {
          this.add({ id: `shot:${pawn.id}:${stance.startedAtCore}`, tick: world.tick,
            kind: 'weapon.gunshot', x: pawn.x + .5, z: pawn.z + .5 });
        }
      }
    }
    for (const projectile of world.projectiles ?? []) {
      projectiles.add(projectile.id);
      const arrival = projectile.arrival;
      if (arrival) {
        projectileArrivals.add(projectile.id);
        const kind: AudioCueKind | undefined = arrival.kind !== 'impact'||projectile.weaponItem==='emp-launcher' ? undefined
          : arrival.effect === 'ground' ? 'weapon.impact-ground'
            : ['barrier','structure','pile','resource','packed','mech'].includes(arrival.effect) ? 'weapon.impact-barrier'
              : arrival.effect === 'pawn' || arrival.effect === 'animal' ? 'weapon.impact-flesh' : undefined;
        if (this.initialized && kind && !previousProjectileArrivals.has(projectile.id))
          this.add({ id: `${kind}:${projectile.id}`, tick: world.tick, kind,
            x: arrival.point.x, z: arrival.point.z });
      }
      const launcher = projectile.flight.launcherKey;
      const shotKey = launcher?.startsWith('pawn:') ? `${launcher.slice(5)}:${projectile.emittedAtCore}` : undefined;
      if (this.initialized && !previousProjectiles.has(projectile.id) && (!shotKey || !emittedShots.has(shotKey)))
        this.add({ id: `shot:${projectile.id}`, tick: world.tick, kind: 'weapon.gunshot',
          x: projectile.flight.origin.x, z: projectile.flight.origin.z });
    }
    const bombWaves=new Set<number>();
    for(const wave of world.bombWaves??[]){bombWaves.add(wave.id);if(this.initialized&&!this.bombWaves.has(wave.id))
      this.add({id:`bomb:${wave.id}`,tick:world.tick,kind:'weapon.explosion',x:wave.center.x,z:wave.center.z});}
    this.bombWaves=bombWaves;
    for(const actor of world.mechanoids??[]){
      const strike=actor.melee?.strike;
      if(!strike)continue;
      melee.set(actor.id,strike.atCore);
      if(this.initialized&&previousMelee.get(actor.id)!==strike.atCore)
        this.add({id:`melee:${actor.id}:${strike.atCore}`,tick:world.tick,kind:'weapon.melee',x:actor.x+.5,z:actor.z+.5});
    }
    for (const structure of world.structures) {
      if (watchedTargets.size && watchedTargets.has(structure.id)) structures.add(structure.id);
      if (watchedSwitches.size && watchedSwitches.has(structure.id) && canFlickPower(structure)) {
        const on = actualPowerSwitch(structure);
        switches.set(structure.id, on);
        const previousOn = this.switches.get(structure.id);
        if (this.initialized && previousOn !== undefined && previousOn !== on
          && this.flickJobs.get(structure.id) === on)
          this.add({ id: `power.switch-${on ? 'on' : 'off'}:${world.tick}:${structure.id}`,
            tick: world.tick, kind: on ? 'power.switch-on' : 'power.switch-off',
            x: structure.x, z: structure.z });
      }
      if ((structure.kind !== 'door' && structure.kind !== 'fence-gate' && structure.kind !== 'autodoor') || !structure.door) continue;
      const open = structure.door.open;
      doors.set(structure.id, open);
      const previous = previousDoors.get(structure.id);
      if (this.initialized && previous !== undefined && previous !== open) {
        const kind = structure.kind === 'autodoor'
          ? open ? 'autodoor.open' : 'autodoor.close'
          : open ? 'door.open' : 'door.close';
        this.add({ id: `${kind}:${world.tick}:${structure.id}`, tick: world.tick,
          kind, x: structure.x, z: structure.z });
      }
    }
    // The deconstruction ledger is incremented only by a successful physical
    // finish. Match its delta to disappeared active jobs and their exact targets;
    // a cancellation or unrelated destruction must not sound like success.
    if (this.initialized && world.deconstructed.count > this.deconstructionCount) {
      const completed = [...this.deconstructionJobs.entries()].filter(([jobId, previous]) =>
        previous.reservedBy !== null && previous.progress > 0
        && !deconstructionJobs.has(jobId) && this.structures.has(previous.structureId)
        && !structures.has(previous.structureId));
      if (completed.length === world.deconstructed.count - this.deconstructionCount)
        for (const [jobId, previous] of completed)
          this.add({ id: `building.deconstructed:${jobId}:${previous.structureId}`,
            tick: world.tick, kind: 'building.deconstructed', x: previous.x, z: previous.z });
    }
    for (const animal of world.wildlife?.animals ?? []) {

      if(animal.strike){
        melee.set(animal.id,animal.strike.atCore);
        if(this.initialized&&previousMelee.get(animal.id)!==animal.strike.atCore)
          this.add({id:`melee:${animal.strike.atCore}:${animal.id}`,tick:world.tick,kind:'weapon.melee',x:animal.x,z:animal.z});
      }
      const nextInjuryId = animal.health?.nextInjuryId ?? 1;
      animalStates.set(animal.id, { state: animal.state, nextInjuryId });
      const previous = this.animalStates.get(animal.id);
      if (!this.initialized || !previous) continue;
      const voiceSpecies=animalVoiceSpecies(animal.species);
      if (animal.state === 'dead' && previous.state !== 'dead' && voiceSpecies !== 'red-fox')
        this.add({ id: `animal.death:${world.tick}:${animal.id}`, tick: world.tick,
          kind: `animal.death.${voiceSpecies}`, x: animal.x, z: animal.z });
      else if (animal.state !== 'dead' && previous.state !== 'dead' && !animal.health?.death
        && nextInjuryId > previous.nextInjuryId)
        this.add({ id: `animal.hurt:${animal.id}:${nextInjuryId}`, tick: world.tick,
          kind: `animal.hurt.${voiceSpecies}`, x: animal.x, z: animal.z });
    }
    // Ordinary deaths become a physical corpse pile before the worker publishes
    // its snapshot. Observe that exact identity once, without scanning all piles
    // during snapshots where no previously live animal disappeared.
    if (this.initialized) {
      const missing = new Set<number>();
      for (const [id, previous] of this.animalStates)
        if (previous.state !== 'dead' && !animalStates.has(id)) missing.add(id);
      if (missing.size) for (const pile of world.piles) {
        const corpse = pile.corpse;
        if (!corpse || !missing.has(corpse.animalId) || !corpse.health.death) continue;
        const voiceSpecies=animalVoiceSpecies(corpse.species);if(voiceSpecies==='red-fox')continue;
        const owner = pile.owner;
        const position = owner.type === 'ground' ? owner
          : owner.type === 'pawn' ? world.pawns.find(pawn => pawn.id === owner.pawnId) : undefined;
        if (!position) continue;
        this.add({ id: `animal.death:${world.tick}:${corpse.animalId}`, tick: world.tick,
          kind: `animal.death.${voiceSpecies}`, x: position.x, z: position.z });
      }
    }
    const lightningCount = world.weather?.lightningCount ?? 0;
    const lightning = world.weather?.lastLightning;
    if (this.initialized && lightningCount > this.lightningCount && lightning)
      this.add({ id: `weather.thunder:${lightning.coreTick}`, tick: world.tick,
        kind: 'weather.thunder', x: lightning.x, z: lightning.z });
    this.work = work;
    this.projectiles = projectiles;
    this.projectileArrivals = projectileArrivals;
    this.shooting = shooting;
    this.melee = melee;
    this.doors = doors;
    this.hauls = hauls;
    this.pawnStates = pawnStates;
    this.animalStates = animalStates;
    this.firefighting = firefighting;
    this.fireIds = fireIds;
    this.switches = switches;
    this.flickJobs = flickJobs;
    this.deconstructionJobs = deconstructionJobs;
    this.structures = structures;
    this.deconstructionCount = world.deconstructed.count;
    this.lightningCount = lightningCount;
    this.initialized = true;
  }

  /** Owned copied peek: failed preparation/send leaves the live queue intact.
   * A publication token is local to this recorder, never Native provenance. */
  preparePublication297():PreparedAudioCuePublication297 {
    if(this.pending.length>MAX_PENDING_CUES)throw Error('Audio queue exceeded its existing bound');
    const prefix=this.pending.slice(),cues=Object.freeze(prefix.map(cue=>Object.freeze({...cue}))) as unknown as AudioCue[];
    const prepared=Object.freeze({cues});this.preparedPublications297.set(prepared,{generation:this.publicationGeneration297,prefix});return prepared;
  }
  /** Only after the synchronous real send and its publication commit. Appends
   * after capture survive; reset/drain/displacement revoke the old prefix. */
  commitPublication297(prepared:PreparedAudioCuePublication297):void {
    const held=this.preparedPublications297.get(prepared);
    if(!held||held.generation!==this.publicationGeneration297||held.prefix.length>this.pending.length||held.prefix.some((cue,i)=>this.pending[i]!==cue))throw Error('Stale audio publication');
    this.preparedPublications297.delete(prepared);this.pending.splice(0,held.prefix.length);this.publicationGeneration297++;
  }

  drain(): AudioCue[] {
    const cues = this.pending.slice();
    this.pending.length = 0;this.publicationGeneration297++;
    return cues;
  }

  private add(cue: AudioCue): void {
    if(this.coreCapture297!==undefined)cue={...cue,tick:this.coreCapture297/10};
    if (this.tickCount >= MAX_CUES_PER_TICK || this.pending.length >= MAX_PENDING_CUES) {
      // Keep severe interface alerts even if many local contacts occur on the
      // same tick. Presentation may discard one background cue, never a command.
      if (cue.kind !== 'ui.threat' && cue.kind !== 'ui.colonist-death') return;
      const sameTickFull = this.tickCount >= MAX_CUES_PER_TICK;
      const displaced = this.pending.findIndex(candidate =>
        (!sameTickFull || Math.floor(candidate.tick) === this.tick)
        && candidate.kind !== 'ui.threat' && candidate.kind !== 'ui.colonist-death');
      if (displaced < 0) return;
      if (Math.floor(this.pending[displaced]!.tick) === this.tick) this.tickCount--;
      this.pending.splice(displaced, 1);
    }
    this.pending.push(cue);
    this.tickCount++;
  }
}
