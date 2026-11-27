import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioDirector } from '../src/audio/AudioDirector';
import {
  ANIMAL_CALL_INTERVAL_TICKS, GAME_SOUND_CUE_KINDS, animalEatCue, animalVoiceCue, constructionCue, dropCue,
  fallbackCue, ingestCue, meleeCue, nightInsectsGain, productionCue, shotCue,
} from '../src/audio/game-sounds';
import { gameAmbienceSources } from '../src/audio/ambience';
import { cueVariation } from '../src/audio/selection';
import { runningMachineAudioSource } from '../src/audio/continuous';
import { DecodedCache, warmKind } from '../src/audio/decoded-cache';
import { AudioCueRecorder, type AudioCue } from '../src/bridge/audio-cues';
import { validCoreAudioCues297 } from '../src/bridge/core-phase-data-297';
import { ANIMAL_SPECIES_IDS } from '../src/sim/animal-species';
import { addGroundMaterial, applyCommand, createWorld, stepWorld } from '../src/sim/index';
import { deconstructionCamp } from './scenarios/deconstruction';
import type { Job, World } from '../src/sim/types';
import type { WildAnimal } from '../src/sim/wildlife-state';

/* Game sound coverage of 22 November 2026, point 20 of the feedback list
 * (docs/development/audio-coverage-20261122.md, « Sons du jeu »). Tests muted:
 * no AudioContext reaches a device, the director plays through a fake one. */

const repo = resolve(__dirname, '..');
type ManifestEvent = { variants: { src: string; gain: number }[]; gain: number; loop: boolean; spatial?: boolean; maxDistance?: number };
const manifest = JSON.parse(readFileSync(resolve(repo, 'public/assets/audio/manifest.json'), 'utf8')) as { version: 1; events: Record<string, ManifestEvent> };
const plan = JSON.parse(readFileSync(resolve(repo, 'scripts/audio/sfx-plan.json'), 'utf8')) as {
  events: Record<string, { filename: string; takes?: number; loop: boolean; spatial?: boolean; maxDistance?: number; calibrationFamily?: string }> };
const GAME_PLAN = Object.entries(plan.events).filter(([, item]) => item.filename.includes('-g1122-'));
const LOOPS = ['ambient.night-insects', 'weather.wind-clear', 'weather.wind-storm', 'machine.chemfuel-generator', 'machine.geothermal'];

describe('Core sound tables', () => {
  it('gives every species, stage and verb a game cue, a published species voice, or Core silence', () => {
    for (const species of ANIMAL_SPECIES_IDS) {
      expect(GAME_SOUND_CUE_KINDS.has(animalEatCue(species)), species).toBe(true);
      for (const stage of [0, 1, 2] as const) for (const verb of ['call', 'angry', 'hurt', 'death'] as const) {
        const voice = animalVoiceCue(species, stage, verb);
        if (!voice) continue;
        expect(GAME_SOUND_CUE_KINDS.has(voice.kind) || !!manifest.events[voice.kind], `${species} ${stage} ${verb}`).toBe(true);
      }
    }
  });

  it('keeps Core silences, life-stage pitch and the species voices of earlier passes', () => {
    for (const fox of ['arctic-fox', 'fennec-fox'] as const) for (const verb of ['call', 'angry', 'hurt', 'death'] as const)
      expect(animalVoiceCue(fox, 2, verb)).toBeUndefined();
    expect(animalVoiceCue('red-fox', 2, 'hurt')?.kind).toBe('animal.hurt.red-fox');
    expect(animalVoiceCue('red-fox', 2, 'death')).toBeUndefined();
    for (const bird of ['ostrich', 'emu', 'cassowary', 'turkey'] as const) {
      expect(animalVoiceCue(bird, 2, 'call')).toBeUndefined();
      expect(animalVoiceCue(bird, 1, 'hurt')).toBeUndefined();
      expect(animalVoiceCue(bird, 0, 'death')).toEqual({ kind: 'animal.call.chick', pitch: 1, volume: 1 });
    }
    expect(animalVoiceCue('duck', 1, 'call')).toEqual({ kind: 'animal.call.bird', pitch: 1.2, volume: 1 });
    expect(animalVoiceCue('cougar', 2, 'call')).toBeUndefined();
    expect(animalVoiceCue('cougar', 2, 'angry')?.kind).toBe('animal.angry.big-cat');
    expect(animalVoiceCue('muffalo', 0, 'call')).toEqual({ kind: 'animal.call.bovine', pitch: 1.6, volume: 0.8 });
    expect(animalVoiceCue('muffalo', 2, 'hurt')?.kind).toBe('animal.hurt.muffalo');
    expect(animalVoiceCue('megaspider', 0, 'call')).toEqual({ kind: 'animal.call.insect', pitch: 1.6, volume: 0.4 });
    expect(animalVoiceCue('timber-wolf', 2, 'call')?.kind).toBe('animal.call.canine');
    expect(animalEatCue('grizzly-bear')).toBe('animal.eat.predator-large');
    expect(animalEatCue('hare')).toBe('animal.eat.rodent');
    expect(dropCue('wood', 'wood')).toBe('haul.drop-wood');
    expect(dropCue('slag-steel-chunk', 'chunk')).toBe('haul.drop-slag');
    expect(dropCue('granite-chunk', 'chunk')).toBe('haul.drop-chunk');
    expect(dropCue('gold', 'gold')).toBe('haul.drop-silver');
    expect(dropCue('rice', 'food')).toBe('haul.drop-grain');
    expect(dropCue('simple-meal', 'food')).toBe('haul.drop');
    expect(ingestCue('beer', 'beer')).toBe('eating.drink');
    expect(ingestCue('berries', 'food')).toBe('eating.vegetable');
    expect(ingestCue('deer-meat', 'food')).toBe('eating.meat');
    expect(ingestCue('fine-meal', 'food')).toBe('eating.work');
    expect(constructionCue({ kind: 'wall', material: 'steel' })).toBe('construction.metal');
    expect(constructionCue({ kind: 'wall', material: 'wood' })).toBe('construction.hit');
    expect(constructionCue({ kind: 'lay-floor', floor: 'granite-tile' })).toBe('construction.dirt');
    expect(constructionCue({ kind: 'lay-floor', floor: 'steel-tile' })).toBe('construction.metal');
    expect(productionCue('make-revolver')).toBe('crafting.smith');
    expect(productionCue('chemfuel-from-wood')).toBe('crafting.cremate');
    expect(shotCue('greatbow')).toEqual({ kind: 'weapon.shot-bow', pitch: 0.86 });
    expect(shotCue('mini-turret-gun').kind).toBe('weapon.gunshot');
    expect(meleeCue('human', 'hit', 'mace-head', { item: 'steel-mace' }, false)).toBe('weapon.melee-blunt');
    expect(meleeCue('human', 'hit', 'longsword-edge', { item: 'wood-longsword' }, false)).toBe('weapon.melee-wood');
    expect(meleeCue('human', 'dodge', 'left-fist', undefined, false)).toBe('weapon.melee-miss');
    expect(meleeCue('animal', 'hit', undefined, undefined, true)).toBe('weapon.melee-bash');
    // Core Ambient_NightInsects_Standard: full at night, silent by day, none in the cold.
    expect(nightInsectsGain(23, 15)).toBe(1);
    expect(nightInsectsGain(12, 15)).toBe(0);
    expect(nightInsectsGain(23, -2)).toBe(0);
    expect(nightInsectsGain(20.5, 2.5)).toBeGreaterThan(0.2);
  });

  it('lets the strict phase validator carry every game cue with its pitch, and nothing unknown', () => {
    const cue = (kind: string, extra: Partial<AudioCue> = {}) => ({ id: `t:${kind}`, tick: 1, kind, x: 1, z: 2, ...extra });
    expect(validCoreAudioCues297([...GAME_SOUND_CUE_KINDS].map(kind => cue(kind, { pitch: 1.6, intensity: 0.8 })), 10, 10)).toBe(true);
    expect(validCoreAudioCues297([cue('animal.call.dragon')], 10, 10)).toBe(false);
    expect(validCoreAudioCues297([cue('animal.call.canine', { pitch: 9 })], 10, 10)).toBe(false);
    expect(validCoreAudioCues297([cue('animal.hurt.deer')], 10, 10)).toBe(true);
  });
});

describe('published takes', () => {
  it('documents temporary softening as local playback treatment of unchanged historical files',()=>{
    const log=JSON.parse(readFileSync(resolve(repo,'scripts/audio/processing-log.json'),'utf8')) as {runtimeTreatments:{id:string;sources:{filename:string;sha256:string}[];processing:{decodedCacheExtraBytes:number;targetSourceRmsDbfsBeforeFilter:number}}[]};
    const treatment=log.runtimeTreatments.find(row=>row.id==='ambient.night-insects')!;
    expect(treatment.sources).toHaveLength(2);expect(treatment.processing.decodedCacheExtraBytes).toBe(0);
    expect(treatment.processing.targetSourceRmsDbfsBeforeFilter).toBe(-48);
    for(const row of treatment.sources){const bytes=readFileSync(resolve(repo,'public/assets/audio/sfx',row.filename));expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);}
    expect(plan.events['ambient.night-insects']!.filename).toBe('ambient-night-insects-g1122-take-1.mp3');
    expect(manifest.events['ambient.night-insects']!.variants.every(row=>row.src.includes('-g1122-'))).toBe(true);
  });
  it('plans every game cue and loop, and publishes every take that passed its measurement', () => {
    const planned = new Map(GAME_PLAN);
    const rejected = (JSON.parse(readFileSync(resolve(repo, 'scripts/audio/pcm-balance-g1122.json'), 'utf8')) as { rejectedTakes: { id: string }[] }).rejectedTakes;
    for (const kind of [...GAME_SOUND_CUE_KINDS, ...LOOPS]) {
      const item = planned.get(kind);
      expect(item, kind).toBeDefined();
      expect(item!.takes, kind).toBeGreaterThanOrEqual(2);
      const event = manifest.events[kind];
      expect(event, kind).toBeDefined();
      expect(event!.variants.length, kind).toBeGreaterThanOrEqual(2);
      expect(event!.variants, kind).toHaveLength(item!.takes! - rejected.filter(row => row.id === kind).length);
      expect(event!.loop, kind).toBe(LOOPS.includes(kind));
      for (const variant of event!.variants) {
        expect(variant.src, kind).toContain('-g1122-');
        expect(existsSync(resolve(repo, 'public', variant.src.slice(1))), variant.src).toBe(true);
      }
      if (item!.spatial === false) expect(event!.spatial, kind).toBe(false);
      else expect(event!.maxDistance, kind).toBe(item!.maxDistance);
    }
  });

  it('keeps a published sound for every cue that refines one', () => {
    for (const kind of GAME_SOUND_CUE_KINDS) {
      const fallback = fallbackCue(kind);
      if (fallback) expect(manifest.events[fallback], `${kind} -> ${fallback}`).toBeDefined();
    }
  });

  it('calibrates every published take to its family target, under its ceiling, unclipped', () => {
    const balance = JSON.parse(readFileSync(resolve(repo, 'scripts/audio/pcm-balance-g1122.json'), 'utf8')) as {
      families: Record<string, { targetRmsDbfs: number; peakCeilingDbfs: number }>;
      files: { id: string; family: string; file: string; sha256: string; peakDbfs: number; clippedPercent: number; published: boolean;
        variantGain: number; effectiveRmsDbfs: number; effectivePeakDbfs: number }[] };
    const published = new Map(Object.entries(manifest.events).flatMap(([kind, event]) =>
      event.variants.map(variant => [variant.src.split('/').pop()!, { kind, gain: variant.gain * event.gain }] as const)));
    const rows = balance.files.filter(row => row.published);
    expect(rows.length).toBe([...published.keys()].filter(file => file.includes('-g1122-')).length);
    for (const row of rows) {
      const family = balance.families[row.family]!;
      expect(row.family).toBe(plan.events[row.id]!.calibrationFamily);
      expect(row.effectiveRmsDbfs, row.file).toBeLessThanOrEqual(family.targetRmsDbfs + 0.5);
      if (row.effectiveRmsDbfs < family.targetRmsDbfs - 0.5)
        expect(row.effectivePeakDbfs, row.file).toBeGreaterThanOrEqual(family.peakCeilingDbfs - 0.2);
      expect(row.effectivePeakDbfs, row.file).toBeLessThanOrEqual(family.peakCeilingDbfs + 0.05);
      // A loop is published as generated (a second encode would break its seam):
      // a couple of overs may remain in its source, far under its gain.
      expect(row.clippedPercent, row.file).toBeLessThanOrEqual(LOOPS.includes(row.id) ? 0.001 : 0);
      expect(published.get(row.file)?.kind, row.file).toBe(row.id);
      expect(published.get(row.file)!.gain).toBeCloseTo(row.variantGain, 6);
      const bytes = readFileSync(resolve(repo, 'public/assets/audio/sfx', row.file));
      expect(createHash('sha256').update(bytes).digest('hex'), row.file).toBe(row.sha256);
    }
  });
});

function wildAnimal(world: World, species: WildAnimal['species'], extra: Partial<WildAnimal> = {}): WildAnimal {
  const pawn = world.pawns[0]!;
  return { id: world.nextId++, x: Math.min(world.width - 2, pawn.x + 3), z: pawn.z, species, sex: 'female', ageTicks: 10_000_000,
    food: 1, rest: 1, state: 'idle', path: [], nextDecision: 0,
    health: { body: species, tick: world.tick, nextInjuryId: 1, injuries: [], missing: [], bloodLoss: 0 } as WildAnimal['health'], ...extra };
}
function run(world: World, recorder: AudioCueRecorder, ticks: number, step?: () => void): AudioCue[] {
  const heard: AudioCue[] = [];
  for (let i = 0; i < ticks; i++) { if (step) step(); else world.tick++; recorder.capture(world); heard.push(...recorder.drain()); }
  return heard;
}

describe('cues from real events', () => {
  it('calls on Core intervals while awake, never asleep, downed or under fog, and never on load', () => {
    const world = createWorld(2211, 32, 32);
    const awake = wildAnimal(world, 'deer'), asleep = wildAnimal(world, 'muffalo', { state: 'sleeping' });
    const fogged = wildAnimal(world, 'horse', { z: Math.max(1, awake.z - 3) });
    world.wildlife = { profile: 'biome-herbivores-v1', rng: 1, animals: [awake, asleep, fogged], eatenPlants: 0, eatenNutrition: 0, eatenItems: 0 };
    world.tiles[fogged.z * world.width + fogged.x] = { ...world.tiles[fogged.z * world.width + fogged.x]!, fogged: true } as World['tiles'][number];
    const recorder = new AudioCueRecorder();
    recorder.capture(world); expect(recorder.drain()).toEqual([]);
    const heard = run(world, recorder, 1600);
    const calls = heard.filter(cue => cue.kind.startsWith('animal.'));
    expect(calls.every(cue => cue.kind === 'animal.call.cervid')).toBe(true);
    // 1600 ticks = 16 000 Core ticks: four to eight calls at 2000–4000 Core ticks each.
    expect(calls.length).toBeGreaterThanOrEqual(Math.floor(1600 / ANIMAL_CALL_INTERVAL_TICKS[1]));
    expect(calls.length).toBeLessThanOrEqual(Math.ceil(1600 / ANIMAL_CALL_INTERVAL_TICKS[0]));
    for (let i = 1; i < calls.length; i++) expect(calls[i]!.tick - calls[i - 1]!.tick).toBeGreaterThanOrEqual(ANIMAL_CALL_INTERVAL_TICKS[0]);
    // A reload reschedules without replaying anything.
    recorder.reset(); recorder.capture(world); expect(recorder.drain()).toEqual([]);
  });

  it('calls four times as often and angrily while hostile, with a young voice pitched as in Core', () => {
    const world = createWorld(2212, 32, 32);
    const wolf = wildAnimal(world, 'timber-wolf', { ageTicks: 0, manhunter: { startedAtCore: 0, rng: 1, zeroRestTicks: 0 } });
    world.wildlife = { profile: 'biome-herbivores-v1', rng: 1, animals: [wolf], eatenPlants: 0, eatenNutrition: 0, eatenItems: 0 };
    const recorder = new AudioCueRecorder();
    recorder.capture(world); recorder.drain();
    const heard = run(world, recorder, 1200).filter(cue => cue.kind.startsWith('animal.'));
    expect(heard.length).toBeGreaterThanOrEqual(8);
    expect(heard.slice(1).every(cue => cue.kind === 'animal.angry.canine')).toBe(true);
    expect(heard.every(cue => cue.pitch === 1.6 && cue.intensity === 0.8)).toBe(true);
  });

  it('a grazing animal chews at a sparse, bounded cadence while it really eats', () => {
    const world = createWorld(2213, 32, 32);
    const deer = wildAnimal(world, 'deer', { state: 'eating', meal: { kind: 'plant', id: 1, quantity: 1, progress: 0 } });
    world.wildlife = { profile: 'biome-herbivores-v1', rng: 1, animals: [deer], eatenPlants: 0, eatenNutrition: 0, eatenItems: 0 };
    const recorder = new AudioCueRecorder();
    recorder.capture(world); recorder.drain();
    const chews = run(world, recorder, 60, () => { world.tick++; deer.meal!.progress += 0.5; })
      .filter(cue => cue.kind === 'animal.eat.herbivore');
    expect(chews.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < chews.length; i++) {
      expect(chews[i]!.tick - chews[i - 1]!.tick).toBeGreaterThanOrEqual(6);
      expect(chews[i]!.tick - chews[i - 1]!.tick).toBeLessThanOrEqual(10);
    }
    deer.state = 'idle';
    expect(run(world, recorder, 20, () => { world.tick++; deer.meal!.progress += 0.5; })
      .filter(cue => cue.kind.startsWith('animal.eat.'))).toEqual([]);
  });

  it('builds a steel wall with the metal construction sound, then completes it once', () => {
    const world = deconstructionCamp(1, 32), pawn = world.pawns[0]!;
    addGroundMaterial(world, 'steel', 20, { x: pawn.x - 1, z: pawn.z }, 'steel');
    expect(applyCommand(world, { type: 'designate', kind: 'wall', material: 'steel', x: pawn.x + 2, z: pawn.z }).ok).toBe(true);
    const recorder = new AudioCueRecorder();
    recorder.capture(world); recorder.drain();
    const heard: string[] = [];
    for (let i = 0; i < 3000 && !world.structures.some(s => s.kind === 'wall'); i++) {
      stepWorld(world); recorder.capture(world); heard.push(...recorder.drain().map(cue => cue.kind));
    }
    expect(world.structures.some(s => s.kind === 'wall' && s.material === 'steel')).toBe(true);
    expect(heard).toContain('construction.metal');
    expect(heard).not.toContain('construction.hit');
    expect(heard.filter(kind => kind === 'building.complete')).toHaveLength(1);
    expect(heard).toContain('haul.drop-metal');
  });

  it('drops each carried material with its own sound, resolved once per carried pile', () => {
    const world = createWorld(2214, 32, 32), pawn = world.pawns[0]!, recorder = new AudioCueRecorder();
    recorder.capture(world);
    for (const [item, kind, expected] of [['steel', 'steel', 'haul.drop-metal'], ['silver', 'silver', 'haul.drop-silver'],
      ['granite-blocks', 'blocks', 'haul.drop-stone'], ['granite-chunk', 'chunk', 'haul.drop-chunk'], ['rice', 'food', 'haul.drop-grain'],
      ['simple-meal', 'food', 'haul.drop']] as const) {
      const sourceId = world.nextId++, carryId = world.nextId++;
      pawn.haul = { sourcePileId: sourceId, quantity: 1, phase: 'deliver', destination: { type: 'stockpile', stockpileId: 1 }, carryPileId: carryId };
      world.piles.push({ id: carryId, kind, item, quantity: 1, owner: { type: 'pawn', pawnId: pawn.id } } as World['piles'][number]);
      world.tick++; recorder.capture(world); recorder.drain();
      world.tick++; pawn.haul = null;
      world.piles.find(pile => pile.id === carryId)!.owner = { type: 'ground', x: pawn.x, z: pawn.z };
      recorder.capture(world);
      expect(recorder.drain().map(cue => cue.kind), item).toEqual([expected]);
    }
  });

  it('ingests each food with its Core ingest sound', () => {
    for (const [item, kind, expected] of [['beer', 'beer', 'eating.drink'], ['rice', 'food', 'eating.vegetable'],
      ['penoxycyline', 'drug', 'eating.pill'], ['fine-meal', 'food', 'eating.work']] as const) {
      const world = createWorld(2215, 32, 32), pawn = world.pawns[0]!, carryId = world.nextId++;
      world.piles.push({ id: carryId, kind, item, quantity: 1, owner: { type: 'pawn', pawnId: pawn.id } } as World['piles'][number]);
      pawn.need = { kind: 'eat', phase: 'ingest', sourcePileId: null, carryPileId: carryId, quantity: 1, progress: 0,
        dining: { target: { x: pawn.x, z: pawn.z }, seatId: null, tableId: null } };
      pawn.state = 'eating';
      const recorder = new AudioCueRecorder();
      recorder.capture(world);
      world.tick++; pawn.need.progress++;
      recorder.capture(world);
      expect(recorder.drain().map(cue => cue.kind), item).toEqual([expected]);
    }
  });

  it('sounds each weapon by its Core cast group and each blow by weapon, outcome and body', () => {
    const world = createWorld(2216, 32, 32), pawn = world.pawns[0]!;
    const recorder = new AudioCueRecorder();
    recorder.capture(world);
    type Projectile = NonNullable<World['projectiles']>[number];
    const heard: AudioCue[] = [];
    for (const weaponItem of ['short-bow', 'sniper-rifle', 'pikeman-gun', 'mini-turret-gun'] as const) {
      world.tick++;
      world.projectiles = [{ id: world.nextId++, weaponItem, flight: { origin: { x: 3, z: 4 } } } as unknown as Projectile];
      recorder.capture(world); heard.push(...recorder.drain());
    }
    expect(heard.map(cue => [cue.kind, cue.pitch])).toEqual([['weapon.shot-bow', 1.08], ['weapon.shot-sniper', undefined],
      ['weapon.shot-needle', undefined], ['weapon.gunshot', undefined]]);
    world.projectiles = [];
    world.tick++;
    pawn.melee = { order: null, strike: { targetId: 999, atCore: world.tick * 10, untilCore: world.tick * 10 + 80,
      tool: 'left-fist', outcome: 'miss' } };
    recorder.capture(world);
    expect(recorder.drain().map(cue => cue.kind)).toEqual(['weapon.melee-miss']);
    const bear = wildAnimal(world, 'grizzly-bear');
    world.wildlife = { profile: 'biome-herbivores-v1', rng: 1, animals: [bear], eatenPlants: 0, eatenNutrition: 0, eatenItems: 0 };
    recorder.capture(world); recorder.drain();
    world.tick++;
    bear.strike = { targetId: pawn.id, atCore: world.tick * 10, untilCore: world.tick * 10 + 80, tool: 'left-claw', outcome: 'hit' };
    recorder.capture(world);
    expect(recorder.drain().map(cue => cue.kind)).toContain('weapon.melee-bash');
  });

  it('finishes a real harvest once, and nothing for a cancelled one', () => {
    const world = createWorld(2217, 32, 32), pawn = world.pawns[0]!;
    const plant = { id: world.nextId++, kind: 'rice', x: pawn.x + 1, z: pawn.z, amount: 1, growth: 1 } as unknown as World['resources'][number];
    world.resources = [...world.resources, plant]; // The simulation replaces this array, never grows it in place.
    const job = { id: world.nextId++, kind: 'harvest', x: plant.x, z: plant.z, orientation: 0, footprint: 'standard', status: 'active',
      reservedBy: pawn.id, progress: 1, escrow: { wood: 0, food: 0 }, plantTarget: { resourceId: plant.id } } as unknown as Job;
    world.jobs.push(job);
    const recorder = new AudioCueRecorder();
    recorder.capture(world); recorder.drain();
    world.tick++; world.jobs = []; // Cancelled: the grown plant stays.
    recorder.capture(world);
    expect(recorder.drain().map(cue => cue.kind)).not.toContain('farming.harvest-finish');
    world.jobs = [job]; recorder.capture(world); recorder.drain();
    world.tick++; world.jobs = []; world.resources = world.resources.filter(resource => resource.id !== plant.id);
    recorder.capture(world);
    expect(recorder.drain().map(cue => cue.kind)).toEqual(['farming.harvest-finish']);
  });

  it('adds the night insects, the wind bed and the running machines as loops', () => {
    const world = createWorld(2218, 32, 32);
    const night = gameAmbienceSources(world, { x: 16, z: 16 }, 'clear', 1);
    expect(night.map(source => source.kind)).toContain('weather.wind-clear');
    expect(gameAmbienceSources(world, { x: 16, z: 16 }, 'rainy-thunderstorm', 1).map(source => source.kind)).toContain('weather.wind-storm');
    expect(gameAmbienceSources(world, { x: 16, z: 16 }, 'rain', 1).map(source => source.kind)).not.toContain('weather.wind-clear');
    const generator = { id: 7, kind: 'chemfuel-generator', x: 3, z: 4, power: { on: true }, fuel: { ticks: 100 } } as unknown as World['structures'][number];
    expect(runningMachineAudioSource(generator)?.kind).toBe('machine.chemfuel-generator');
    expect(runningMachineAudioSource({ ...generator, fuel: { ticks: 0 } } as World['structures'][number])).toBeUndefined();
  });
});

describe('director voice limits', () => {
  afterEach(() => vi.unstubAllGlobals());
  class Param { value = 0; setValueAtTime(v: number): void { this.value = v; } setTargetAtTime(v: number): void { this.value = v; } cancelScheduledValues(): void {} }
  class Node { connections:Node[]=[];disconnections=0;connect(target?:Node): void {if(target)this.connections.push(target);} disconnect(): void {this.disconnections++;} }
  class Source extends Node {
    buffer: unknown; playbackRate = { value: 1 }; onended: (() => void) | null = null; starts = 0; gainNode?: { gain: Param };
    start(): void { this.starts++; } stop(): void {}
  }
  class FakeContext {
    static latest: FakeContext;
    state = 'running'; currentTime = 0; destination = new Node(); sources: Source[] = []; gains: { gain: Param }[] = [];
    filters:(Node&{type:string;frequency:Param;Q:Param})[]=[];
    listener = { positionX: new Param(), positionY: new Param(), positionZ: new Param(), forwardX: new Param(), forwardY: new Param(), forwardZ: new Param() };
    constructor() { FakeContext.latest = this; }
    createGain() { const gain = Object.assign(new Node(), { gain: new Param() }); this.gains.push(gain); return gain; }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
    createBiquadFilter(){const filter=Object.assign(new Node(),{type:'lowpass',frequency:new Param(),Q:new Param()});this.filters.push(filter);return filter;}
    createPanner() { return Object.assign(new Node(), { positionX: new Param(), positionY: new Param(), positionZ: new Param() }); }
    // 0.5 s of 48 kHz stereo: 192 000 bytes of decoded PCM per take.
    decodeAudioData(): Promise<object> { return Promise.resolve({ duration: 0.5, length: 24_000, numberOfChannels: 2 }); }
    resume(): Promise<void> { this.state = 'running'; return Promise.resolve(); }
    close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
  }
  // A manifest with every game cue the recorder can emit, so the limits are
  // checked whatever the generation state.
  const testManifest = { version: 1, events: {
    ...manifest.events,
    ...Object.fromEntries(['animal.eat.herbivore', 'animal.call.cervid', 'animal.call.canine'].map(kind =>
      [kind, { variants: [{ src: `/assets/audio/sfx/test-${kind.replace(/\./g, '-')}.mp3`, gain: 1 }], gain: 1, maxDistance: 26, loop: false }])),
  } };
  delete (testManifest.events as Record<string, unknown>)['haul.drop-wood'];
  const fetched = new Map<string, number>();
  const warmPaths = new Set(Object.entries(testManifest.events).filter(([kind, event]) => warmKind(kind, event) || kind === 'mining.hit')
    .flatMap(([, event]) => event.variants.map(variant => variant.src)));
  async function director(budget?: number): Promise<{ audio: AudioDirector; context: FakeContext }> {
    fetched.clear();
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(testManifest));
      fetched.set(url, (fetched.get(url) ?? 0) + 1);
      return new Response(new Uint8Array([1]));
    }));
    const audio = budget === undefined ? new AudioDirector() : new AudioDirector(undefined, budget);
    await audio.unlock();
    // The warm set finishes decoding in the background (a small budget may evict its unpinned takes).
    for (let i = 0; i < 4000 && [...warmPaths].some(src => !fetched.has(src)); i++) await new Promise(resolveTick => setTimeout(resolveTick, 0));
    for (let i = 0; i < 10; i++) await new Promise(resolveTick => setTimeout(resolveTick, 0));
    audio.updateCamera({ x: 16, y: 30, z: 16, targetX: 16, targetZ: 16, span: 32, mode: 'orthographic' });
    return { audio, context: FakeContext.latest };
  }
  const started = (context: FakeContext) => context.sources.filter(source => source.starts > 0);
  const cue = (kind: string, i: number, extra: Partial<AudioCue> = {}): AudioCue =>
    ({ id: `${kind}:${i}`, tick: 1, kind: kind as AudioCue['kind'], x: 16 + (i % 5) * 6, z: 16 + Math.floor(i / 5) * 6, ...extra });

  it('softens only historical night insect loops once, preserves their buffers and releases the continuous filter',async()=>{
    const {audio,context}=await director();
    try{
      await audio.prefetch(['ambient.night-insects','weather.wind-clear']);
      const before=audio.decodedMemory.bytes;
      audio.setContinuousSources([{id:'ambient:night-insects',kind:'ambient.night-insects',x:16,z:16,gain:1},{id:'wind',kind:'weather.wind-clear',x:16,z:16,gain:1}]);
      audio.update({presentedTick:1,paused:false,hidden:false});
      expect(context.filters).toHaveLength(1);
      const filter=context.filters[0]!;
      expect(filter.type).toBe('lowpass');expect(filter.frequency.value).toBe(1500);expect(filter.Q.value).toBe(-6);
      expect(started(context).filter(s=>s.connections.includes(filter))).toHaveLength(1);
      const sources=started(context).length;
      for(let tick=2;tick<20;tick++)audio.update({presentedTick:tick,paused:false,hidden:false});
      expect(context.filters).toHaveLength(1);expect(started(context)).toHaveLength(sources);
      expect(audio.decodedMemory.bytes).toBe(before);
      expect(filter.disconnections).toBe(0);
      audio.dispose();expect(filter.disconnections).toBe(1);
    }finally{audio.dispose();}
  });

  it('plays nothing muted, and caps a grazing herd, a chorus of calls and many meals', async () => {
    const { audio, context } = await director();
    await audio.prefetch(['animal.call.cervid', 'animal.eat.herbivore']);
    audio.setMuted(true);
    audio.ingestCues(Array.from({ length: 10 }, (_, i) => cue('animal.call.cervid', i)));
    audio.update({ presentedTick: 1, paused: false, hidden: false });
    expect(started(context)).toHaveLength(0);
    audio.setMuted(false);
    audio.ingestCues(Array.from({ length: 10 }, (_, i) => cue('animal.eat.herbivore', 100 + i, { tick: 2 })));
    audio.update({ presentedTick: 2, paused: false, hidden: false });
    expect(started(context).length).toBeLessThanOrEqual(2);
    const before = started(context).length;
    audio.ingestCues(Array.from({ length: 10 }, (_, i) => cue('animal.call.cervid', 200 + i, { tick: 3 })));
    audio.update({ presentedTick: 3, paused: false, hidden: false });
    expect(started(context).length - before).toBeLessThanOrEqual(3);
    audio.dispose();
  });

  it('falls back on the plain drop, pitches a young voice and quarters idle calls at the highest speed', async () => {
    const { audio, context } = await director();
    audio.ingestCues([cue('haul.drop-wood', 1)]);
    audio.update({ presentedTick: 1, paused: false, hidden: false });
    const drop = started(context);
    expect(drop).toHaveLength(1);
    const cache = (audio as unknown as { buffers: DecodedCache<never> }).buffers;
    expect(testManifest.events['haul.drop']!.variants.some(variant => cache.get(variant.src) === drop[0]!.buffer)).toBe(true);
    await audio.prefetch(['animal.call.canine']);
    audio.ingestCues([cue('animal.call.canine', 2, { tick: 2, pitch: 1.6 })]);
    audio.update({ presentedTick: 2, paused: false, hidden: false, speed: 1 });
    const young = started(context).at(-1)!;
    expect(young.playbackRate.value).toBeGreaterThan(1.5);
    const gainAt = (speed: number, i: number) => {
      audio.ingestCues([cue('animal.call.canine', 300 + i, { tick: 3 + i, x: 16, z: 16 })]);
      audio.update({ presentedTick: 3 + i, paused: false, hidden: false, speed });
      return context.gains.at(-1)!.gain.value;
    };
    for (const source of started(context)) source.onended?.();
    const normal = gainAt(1, 0);
    for (const source of started(context)) source.onended?.();
    const fast = gainAt(6, 1);
    // Core IdleCallVolumeFactor: a quarter at the highest speed (with the usual small take variation).
    const variation = (i: number) => cueVariation(`animal.call.canine:${300 + i}`, 'animal.call.canine').gain;
    expect(fast / normal).toBeCloseTo(0.25 * variation(1) / variation(0), 6);
    audio.dispose();
  });

  it('decodes only the warm set at load, a cold take once at its first need, and plays its first cue late', async () => {
    const { audio, context } = await director();
    expect(audio.loadedCount).toBe(warmPaths.size);
    expect([...fetched.keys()].every(src => warmPaths.has(src))).toBe(true);
    const cold = testManifest.events['animal.call.cervid']!.variants[0]!.src;
    expect(fetched.has(cold)).toBe(false);
    // Cold: the first cues wait for the take instead of stalling the frame.
    audio.ingestCues(Array.from({ length: 4 }, (_, i) => cue('animal.call.cervid', 400 + i, { tick: 5, x: 16 + i * 8, z: 16 })));
    audio.update({ presentedTick: 5, paused: false, hidden: false });
    expect(started(context)).toHaveLength(0);
    for (let i = 0; i < 20; i++) await new Promise(resolveTick => setTimeout(resolveTick, 0));
    context.currentTime += 1 / 60;
    audio.update({ presentedTick: 5, paused: false, hidden: false });
    expect(started(context).length).toBeGreaterThanOrEqual(1);
    expect(started(context).length).toBeLessThanOrEqual(3);
    expect(fetched.get(cold)).toBe(1);
    // Warm now: the next cue plays in its own frame, without another decode.
    for (const source of started(context)) source.onended?.();
    const before = started(context).length;
    audio.ingestCues([cue('animal.call.cervid', 500, { tick: 6, x: 16, z: 16 })]);
    audio.update({ presentedTick: 6, paused: false, hidden: false });
    expect(started(context).length - before).toBe(1);
    expect(fetched.get(cold)).toBe(1);
    // A cold cue whose take arrives after 0.25 s of audio clock is dropped.
    const late = testManifest.events['animal.eat.herbivore']!.variants[0]!.src;
    audio.ingestCues([cue('animal.eat.herbivore', 600, { tick: 7, x: 16, z: 16 })]);
    audio.update({ presentedTick: 7, paused: false, hidden: false });
    for (let i = 0; i < 20; i++) await new Promise(resolveTick => setTimeout(resolveTick, 0));
    context.currentTime += 0.3;
    const count = started(context).length;
    audio.update({ presentedTick: 7, paused: false, hidden: false });
    expect(started(context).length).toBe(count);
    expect(fetched.get(late)).toBe(1);
    audio.dispose();
  });

  it('never holds more decoded takes than its budget, keeping the warm takes and evicting the least recent', async () => {
    const pinned = Object.entries(testManifest.events).filter(([kind, event]) => warmKind(kind, event) || kind === 'mining.hit').length * 192_000;
    const budget = pinned + 2_000_000;
    const { audio } = await director(budget);
    const cold = Object.keys(testManifest.events).filter(kind => !warmKind(kind, testManifest.events[kind]!) && !testManifest.events[kind]!.loop).slice(0, 40);
    expect(cold.length).toBeGreaterThan(20);
    for (const kind of cold) {
      await audio.prefetch([kind]);
      expect(audio.decodedMemory.bytes, kind).toBeLessThanOrEqual(budget);
    }
    const cache = (audio as unknown as { buffers: DecodedCache<never> }).buffers;
    for (const [kind, event] of Object.entries(testManifest.events)) if (warmKind(kind, event)) expect(cache.get(event.variants[0]!.src), kind).toBeTruthy();
    expect(cache.get(testManifest.events[cold[0]!]!.variants[0]!.src)).toBeUndefined(); // evicted first
    expect(cache.get(testManifest.events[cold.at(-1)!]!.variants[0]!.src)).toBeTruthy();
    audio.dispose();
  });
});

describe('decoded cache', () => {
  const take = (seconds: number) => ({ length: seconds * 48_000, numberOfChannels: 2 });
  it('evicts the least recently used, sounding takes last, never a pinned take, and stays within its budget', () => {
    const playing = new Set<object>(), budget = 3 * 384_000;
    const cache = new DecodedCache<ReturnType<typeof take>>(budget, buffer => playing.has(buffer));
    const [a, b, c, d, e, f] = [take(1), take(1), take(1), take(1), take(1), take(1)];
    cache.pin('a'); cache.set('a', a);
    cache.set('b', b); cache.set('c', c);
    expect(cache.bytes).toBe(budget);
    cache.use('b'); playing.add(c);
    cache.set('d', d); // c sounds, so the least recent free take goes: b
    expect([cache.get('a'), cache.get('b'), cache.get('c'), cache.get('d')]).toEqual([a, undefined, c, d]);
    playing.add(d);
    cache.set('e', e); // everything free is pinned: the oldest sounding take goes (it keeps playing)
    expect([cache.get('c'), cache.get('d'), cache.get('e')]).toEqual([undefined, d, e]);
    cache.set('f', f);
    expect(cache.bytes).toBeLessThanOrEqual(budget);
    expect(cache.get('a')).toBe(a);
    cache.set('x', null); // a failed decode costs nothing and is remembered
    expect(cache.get('x')).toBeNull();
    expect(cache.count).toBe(3);
  });
});
