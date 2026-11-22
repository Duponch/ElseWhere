import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioDirector, parseAudioManifest } from '../src/audio/AudioDirector';
import {
  alertCue, areaActionCue, clockCue, commandCue, interfaceBurstRule, letterCue, MAX_INTERFACE_VOICES,
  nativeActivationCue, tutorialLessonCue, type InterfaceCueKind,
} from '../src/audio/interface-cues';
import { AudioCueRecorder } from '../src/bridge/audio-cues';
import { addGroundMaterial, applyCommand, createWorld, stepWorld } from '../src/sim/index';
import { deconstructionCamp } from './scenarios/deconstruction';
import type { World } from '../src/sim/types';

/* Audio coverage pass of 22 November 2026 (docs/development/audio-coverage-20261122.md). */

const repo = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(repo, 'public/assets/audio/manifest.json'), 'utf8')) as {
  version: 1; events: Record<string, { variants: { src: string; gain: number }[]; gain: number; loop: boolean; spatial?: boolean; maxDistance?: number }> };
const balance = JSON.parse(readFileSync(resolve(repo, 'scripts/audio/pcm-balance-20261122.json'), 'utf8')) as {
  families: Record<string, { targetRmsDbfs: number; peakCeilingDbfs: number }>;
  files: { id: string; family: string; file: string; sha256: string; peakDbfs: number; clippedPercent: number;
    variantGain: number; effectiveRmsDbfs: number; effectivePeakDbfs: number; targetRmsDbfs: number; peakCeilingDbfs: number }[];
};
const plan = JSON.parse(readFileSync(resolve(repo, 'scripts/audio/sfx-plan.json'), 'utf8')) as { events: Record<string, { filename: string; spatial?: boolean }> };
const NEW_CUES = Object.entries(plan.events).filter(([, item]) => /-c1122-take-1\.mp3$/.test(item.filename)).map(([id]) => id);

/** The inventory's "done" rows: every cue a player-facing event or action plays. */
const INVENTORY_DONE: readonly string[] = [
  'letter.threat-big', 'letter.threat-small', 'letter.negative', 'letter.neutral', 'letter.positive',
  'alert.high', 'alert.critical', 'ui.threat', 'ui.colonist-death', 'ui.colonist-downed', 'ui.research-complete',
  'building.complete', 'woodcutting.fell', 'ui.trade-open', 'ui.trade-execute', 'quest.accepted',
  'tutorial.lesson-appear', 'tutorial.lesson-complete',
  'ui.tab-open', 'ui.tab-close', 'ui.tool-select', 'ui.designate', 'ui.designate-zone', 'ui.designate-cancel',
  'ui.place-building', 'ui.click', 'ui.toggle-on', 'ui.toggle-off', 'ui.reject', 'ui.clock-pause', 'ui.clock-run',
  'ui.draft-on', 'ui.draft-off', 'ui.order', 'ui.select', 'ui.panel',
  'eating.work', 'haul.pickup', 'haul.drop', 'farming.harvest', 'farming.sow', 'medical.tend', 'woodcutting.hit',
  'mining.hit', 'construction.hit', 'door.open', 'door.close', 'autodoor.open', 'autodoor.close', 'fencegate.move',
];

describe('cue map and manifest', () => {
  it('covers every "done" inventory row with a published cue whose files exist', () => {
    for (const kind of INVENTORY_DONE) {
      const event = manifest.events[kind];
      expect(event, kind).toBeDefined();
      for (const variant of event!.variants) expect(existsSync(resolve(repo, 'public', variant.src.slice(1))), variant.src).toBe(true);
    }
    const parsed = parseAudioManifest(manifest);
    for (const kind of INVENTORY_DONE) expect(parsed.events[kind], kind).toBeDefined();
  });

  it('publishes two to four takes per new cue, interface cues global and world cues local', () => {
    expect(NEW_CUES).toHaveLength(32);
    for (const kind of NEW_CUES) {
      const event = manifest.events[kind]!;
      expect(event.variants.length, kind).toBeGreaterThanOrEqual(2);
      expect(event.variants.length, kind).toBeLessThanOrEqual(4);
      expect(event.loop).toBe(false);
      if (plan.events[kind]!.spatial === false) expect(event.spatial, kind).toBe(false);
      else expect(event.maxDistance, kind).toBeGreaterThan(0);
    }
  });

  it('maps letters, alerts, speeds, commands, tabs and lessons to their cues', () => {
    expect(letterCue(['neutral', 'threat-small', 'positive'])).toBe('letter.threat-small');
    expect(letterCue(['new-quest'])).toBe('letter.positive');
    for (const cls of ['threat-big', 'threat-small', 'negative', 'neutral', 'positive'] as const)
      expect(letterCue([cls])).toBe(`letter.${cls}`);
    expect(letterCue(['death'])).toBeUndefined();
    expect(alertCue({ priority: 'critical', bell: true })).toBe('alert.critical');
    expect(alertCue({ priority: 'high', bell: true })).toBe('alert.high');
    expect(alertCue({ priority: 'critical', bell: false })).toBeUndefined();
    expect(clockCue(0)).toEqual({ kind: 'ui.clock-pause', pitch: 1 });
    expect(clockCue(6).pitch).toBeGreaterThan(clockCue(3).pitch);
    expect(commandCue({ type: 'designate', kind: 'mine' })).toBe('ui.designate');
    expect(commandCue({ type: 'designate', kind: 'wall' })).toBe('ui.place-building');
    expect(commandCue({ type: 'area', action: 'stockpile' }, '{"affected":4,"skipped":0}')).toBe('ui.designate-zone');
    expect(commandCue({ type: 'area', action: 'stockpile' }, '{"affected":0,"skipped":4}')).toBeUndefined();
    expect(areaActionCue('remove-growing')).toBe('ui.designate-cancel');
    expect(commandCue({ type: 'draft', enabled: true })).toBe('ui.draft-on');
    expect(commandCue({ type: 'draft', enabled: false })).toBe('ui.draft-off');
    expect(commandCue({ type: 'draft-move' })).toBe('ui.order');
    expect(commandCue({ type: 'order-rescue' })).toBe('ui.order');
    expect(commandCue({ type: 'trade-execute' })).toBe('ui.trade-execute');
    expect(commandCue({ type: 'answer-quest', accept: true })).toBe('quest.accepted');
    expect(commandCue({ type: 'bill-add' })).toBeUndefined();
    expect(nativeActivationCue('tab:work', { panel: null })).toBe('ui.tab-open');
    expect(nativeActivationCue('tab:work', { panel: 'work' })).toBe('ui.tab-close');
    expect(nativeActivationCue('map-dock:orders', { palette: 'orders' })).toBe('ui.tab-close');
    expect(nativeActivationCue('hud:speed:3', {})).toBeUndefined();
    expect(nativeActivationCue('native-save-slot-2', {})).toBe('ui.click');
    expect(tutorialLessonCue(undefined, 'CameraDolly')).toBe('tutorial.lesson-appear');
    expect(tutorialLessonCue('CameraDolly', 'CameraZoom')).toBe('tutorial.lesson-complete');
    expect(tutorialLessonCue('CameraZoom', 'CameraZoom')).toBeUndefined();
  });
});

describe('calibration of the new takes', () => {
  it('keeps every published take within its family target, below its ceiling and unclipped', () => {
    const published = new Map(Object.entries(manifest.events).flatMap(([kind, event]) =>
      event.variants.map(variant => [variant.src.split('/').pop()!, { kind, gain: variant.gain * event.gain }] as const)));
    expect(balance.files.length).toBeGreaterThanOrEqual(NEW_CUES.length * 2);
    for (const row of balance.files) {
      const family = balance.families[row.family]!;
      expect(row.targetRmsDbfs).toBe(family.targetRmsDbfs);
      // At the target, or below it only when the peak ceiling decided.
      expect(row.effectiveRmsDbfs, row.file).toBeLessThanOrEqual(family.targetRmsDbfs + 0.5);
      expect(row.effectiveRmsDbfs, row.file).toBeGreaterThanOrEqual(family.targetRmsDbfs - 5);
      if (row.effectiveRmsDbfs < family.targetRmsDbfs - 0.5)
        expect(row.effectivePeakDbfs, row.file).toBeGreaterThanOrEqual(family.peakCeilingDbfs - 0.2);
      expect(row.effectivePeakDbfs, row.file).toBeLessThanOrEqual(family.peakCeilingDbfs + 0.05);
      expect(row.peakDbfs, row.file).toBeLessThanOrEqual(-0.9);
      expect(row.clippedPercent, row.file).toBe(0);
      const entry = published.get(row.file);
      expect(entry?.kind, row.file).toBe(row.id);
      expect(entry!.gain).toBeCloseTo(row.variantGain, 6);
      const bytes = readFileSync(resolve(repo, 'public/assets/audio/sfx', row.file));
      expect(createHash('sha256').update(bytes).digest('hex'), row.file).toBe(row.sha256);
    }
    // Takes of one cue stay within 5 dB of each other.
    const byCue = new Map<string, number[]>();
    for (const row of balance.files) byCue.set(row.id, [...byCue.get(row.id) ?? [], row.effectiveRmsDbfs]);
    for (const [kind, levels] of byCue) expect(Math.max(...levels) - Math.min(...levels), kind).toBeLessThanOrEqual(5);
  });
});

describe('interface playback limits', () => {
  afterEach(() => vi.unstubAllGlobals());
  class Param { value = 0; setValueAtTime(v: number): void { this.value = v; } setTargetAtTime(v: number): void { this.value = v; } cancelScheduledValues(): void {} }
  class Node { connections: Node[] = []; connect(node: Node): void { this.connections.push(node); } disconnect(): void {} }
  class Source extends Node {
    buffer: unknown; playbackRate = { value: 1 }; onended: (() => void) | null = null; starts = 0;
    start(): void { this.starts++; } stop(): void {}
  }
  class FakeContext {
    static latest: FakeContext;
    state = 'running'; currentTime = 0; destination = new Node(); sources: Source[] = [];
    listener = { positionX: new Param(), positionY: new Param(), positionZ: new Param(), forwardX: new Param(), forwardY: new Param(), forwardZ: new Param() };
    constructor() { FakeContext.latest = this; }
    createGain() { return Object.assign(new Node(), { gain: new Param() }); }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
    createPanner() { return Object.assign(new Node(), { positionX: new Param(), positionY: new Param(), positionZ: new Param() }); }
    decodeAudioData(): Promise<object> { return Promise.resolve({ duration: 0.5 }); }
    resume(): Promise<void> { this.state = 'running'; return Promise.resolve(); }
    close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
  }
  async function director(): Promise<{ audio: AudioDirector; context: FakeContext }> {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify(manifest)) : new Response(new Uint8Array([1]))));
    const audio = new AudioDirector();
    await audio.unlock();
    // Let the bounded loader decode every take.
    for (let i = 0; i < 400 && audio.loadedCount < 240; i++) await new Promise(resolveTick => setTimeout(resolveTick, 0));
    return { audio, context: FakeContext.latest };
  }
  const started = (context: FakeContext) => context.sources.filter(source => source.starts > 0);

  it('plays nothing while the effects are muted, as in the muted test mode', async () => {
    const { audio, context } = await director();
    audio.setMuted(true);
    for (const kind of NEW_CUES.filter(kind => plan.events[kind]!.spatial === false)) audio.playInterface(kind as InterfaceCueKind);
    audio.ingestCues([{ id: 'down:1', tick: 1, kind: 'ui.colonist-downed', x: 0, z: 0 },
      { id: 'built:1', tick: 1, kind: 'building.complete', x: 0, z: 0 }]);
    audio.update({ presentedTick: 1, paused: false, hidden: false });
    audio.update({ presentedTick: 1, paused: true, hidden: false });
    await Promise.resolve();
    expect(started(context)).toHaveLength(0);
    audio.setMuted(false);
    audio.playInterface('letter.positive');
    expect(started(context)).toHaveLength(1);
    audio.dispose();
  });

  it('collapses a burst of twenty alerts and letters into a bounded set of voices', async () => {
    const { audio, context } = await director();
    for (let i = 0; i < 20; i++) audio.playInterface('alert.critical');
    expect(started(context)).toHaveLength(1);
    for (let i = 0; i < 20; i++) audio.playInterface('alert.high');
    for (const cls of ['threat-big', 'threat-small', 'negative', 'neutral', 'positive'])
      for (let i = 0; i < 4; i++) audio.playInterface(`letter.${cls}` as InterfaceCueKind);
    expect(started(context).length).toBeLessThanOrEqual(MAX_INTERFACE_VOICES);
    expect(started(context)).toHaveLength(MAX_INTERFACE_VOICES);
    // Twenty colonists falling at once through the worker queue: one sound.
    audio.ingestCues(Array.from({ length: 20 }, (_, i) => ({ id: `down:${i}`, tick: 2, kind: 'ui.colonist-downed', x: i, z: 0 })));
    const before = started(context).length;
    for (const source of started(context)) source.onended?.();
    audio.update({ presentedTick: 2, paused: true, hidden: false });
    expect(started(context).length - before).toBe(1);
    // Once the spacing has elapsed and the voices ended, the next alert sounds.
    context.currentTime += interfaceBurstRule('alert.critical').spacing + 0.01;
    for (const source of started(context)) source.onended?.();
    audio.playInterface('alert.critical');
    expect(started(context).length - before).toBe(2);
    audio.dispose();
  });

  it('replaces the generic click of a gesture by the specific cue it asked for', async () => {
    const { audio, context } = await director();
    audio.playInterface('ui.click', 1, true);
    audio.playInterface('ui.tab-open');
    await Promise.resolve();
    expect(started(context)).toHaveLength(1);
    expect(manifest.events['ui.tab-open']!.variants.length).toBeGreaterThan(1);
    audio.playInterface('ui.click', 1, true);
    await Promise.resolve();
    expect(started(context)).toHaveLength(2);
    audio.dispose();
  });
});

describe('world cues of the coverage pass', () => {
  function capture(world: World, recorder: AudioCueRecorder, done: () => boolean, limit: number): string[] {
    const heard: string[] = [];
    for (let i = 0; i < limit && !done(); i++) { stepWorld(world); recorder.capture(world); heard.push(...recorder.drain().map(cue => cue.kind)); }
    expect(done()).toBe(true);
    return heard;
  }

  it('sounds a finished wall once, and nothing for a cancelled one', () => {
    const world = deconstructionCamp(1, 32), pawn = world.pawns[0]!;
    addGroundMaterial(world, 'wood', 10, { x: pawn.x - 1, z: pawn.z }, 'wood');
    expect(applyCommand(world, { type: 'designate', kind: 'wall', material: 'wood', x: pawn.x + 2, z: pawn.z }).ok).toBe(true);
    const recorder = new AudioCueRecorder();
    recorder.capture(world); expect(recorder.drain()).toEqual([]);
    const heard = capture(world, recorder, () => world.structures.some(s => s.kind === 'wall'), 2000);
    expect(heard).toContain('construction.hit');
    expect(heard.filter(kind => kind === 'building.complete')).toHaveLength(1);
    expect(applyCommand(world, { type: 'designate', kind: 'wall', material: 'wood', x: pawn.x + 2, z: pawn.z + 2 }).ok).toBe(true);
    const job = world.jobs.find(j => j.kind === 'wall')!;
    capture(world, recorder, () => job.progress > 0 || (job.workRemainder ?? 0) > 0, 2000);
    expect(applyCommand(world, { type: 'cancel', x: job.x, z: job.z }).ok).toBe(true);
    stepWorld(world); recorder.capture(world);
    expect(recorder.drain().map(cue => cue.kind)).not.toContain('building.complete');
  });

  it('sounds a felled tree once when its chop job finishes', () => {
    const world = createWorld(1122, 32, 32), pawn = world.pawns[0]!;
    const tree = [...world.resources].filter(r => r.kind === 'tree')
      .sort((a, b) => Math.hypot(a.x - pawn.x, a.z - pawn.z) - Math.hypot(b.x - pawn.x, b.z - pawn.z))[0]!;
    expect(applyCommand(world, { type: 'designate', kind: 'chop', x: tree.x, z: tree.z }).ok).toBe(true);
    const job = world.jobs.find(j => j.kind === 'chop' && j.x === tree.x && j.z === tree.z)!;
    expect(applyCommand(world, { type: 'order-job', pawnId: pawn.id, jobId: job.id, queue: false }).ok).toBe(true);
    const recorder = new AudioCueRecorder();
    recorder.capture(world); recorder.drain();
    const heard = capture(world, recorder, () => !world.resources.some(r => r.id === tree.id), 4000);
    expect(heard).toContain('woodcutting.hit');
    expect(heard.filter(kind => kind === 'woodcutting.fell')).toHaveLength(1);
  });

  it('signals a colonist falling down and a finished research once, never on load or under anaesthesia', () => {
    const world = createWorld(1123, 32, 32), [first, second] = world.pawns;
    const recorder = new AudioCueRecorder();
    first!.state = 'downed';
    recorder.capture(world); expect(recorder.drain()).toEqual([]); // Loaded downed colonist: silent.
    first!.state = 'idle'; recorder.capture(world);
    first!.state = 'downed'; recorder.capture(world);
    expect(recorder.drain().map(cue => cue.kind)).toEqual(['ui.colonist-downed']);
    recorder.capture(world); expect(recorder.drain()).toEqual([]);
    second!.health = { ...second!.health!, anesthetic: { untilCore: world.tick * 10 + 600 } as never };
    second!.state = 'downed'; recorder.capture(world);
    expect(recorder.drain()).toEqual([]);
    world.research = { ...(world.research ?? { points: 0 }), batteries: { points: 1, completedAt: world.tick } } as World['research'];
    recorder.capture(world);
    expect(recorder.drain().map(cue => cue.kind)).toEqual(['ui.research-complete']);
    recorder.capture(world); expect(recorder.drain()).toEqual([]);
  });
});
