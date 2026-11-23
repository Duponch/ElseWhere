import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioDirector, parseAudioManifest } from '../src/audio/AudioDirector';
import { AudioCueScheduler } from '../src/audio/scheduler';
import { audibleRange, listenerPose, sourceDistance, SPATIAL_REF_DISTANCE, SPATIAL_ROLLOFF } from '../src/audio/spatial';
import { createNearbyFireCollector, createNearbyMachineCollector, runningMachineAudioSource, selectContinuousSources } from '../src/audio/continuous';
import type { Structure } from '../src/sim/types';
import { cueVariation, selectOneShots } from '../src/audio/selection';

describe('audio cue presentation queue', () => {
  it('orders cues by tick and deduplicates repeated snapshot delivery', () => {
    const queue = new AudioCueScheduler();
    const later = { id: 'hit:2', tick: 12, kind: 'mining.hit', x: 3, z: 4 };
    const first = { id: 'hit:1', tick: 10, kind: 'mining.hit', x: 3, z: 4 };
    queue.ingest([later, first, first]);
    expect(queue.takeDue(9.9)).toEqual([]);
    expect(queue.takeDue(10)).toEqual([first]);
    queue.ingest([first]);
    expect(queue.takeDue(12)).toEqual([later]);
    expect(queue.pendingCount).toBe(0);
  });

  it('drops stale cues after a stalled presentation and clears on a new world', () => {
    const queue = new AudioCueScheduler();
    queue.ingest([
      { id: 'old', tick: 1, kind: 'weapon.gunshot', x: 0, z: 0 },
      { id: 'fresh', tick: 20, kind: 'weapon.gunshot', x: 0, z: 0 },
    ]);
    expect(queue.takeDue(20)).toEqual([{ id: 'fresh', tick: 20, kind: 'weapon.gunshot', x: 0, z: 0 }]);
    queue.ingest([{ id: 'new-map', tick: 21, kind: 'mining.hit', x: 0, z: 0 }]);
    queue.reset();
    expect(queue.takeDue(21)).toEqual([]);
  });

  it('keeps delayed mining contacts audible across skipped frames without replaying a backlog', () => {
    const queue = new AudioCueScheduler();
    queue.takeDue(0);
    const frames = [
      { presented: 20, contacts: [3, 6, 9, 12, 15] },
      { presented: 40, contacts: [18, 21, 24, 27, 30, 33, 36] },
      { presented: 60, contacts: [39, 42, 45, 48, 51, 54] },
      { presented: 80, contacts: [57, 60, 63, 66, 69, 72, 75] },
    ];
    const heard: number[] = [];
    for (const { presented, contacts } of frames) {
      const cues = contacts.map(tick => ({ id: `mining:${tick}`, tick, kind: 'mining.hit', x: 1, z: 1 }));
      // The former two-tick cutoff is silent at every one of these frames.
      expect(cues.filter(cue => cue.tick >= presented - 2)).toEqual([]);
      queue.ingest(cues);
      queue.ingest(cues); // Repeated snapshot delivery must not double a contact.
      const due = queue.takeDue(presented);
      expect(due).toHaveLength(1);
      heard.push(due[0]!.tick);
      expect(queue.takeDue(presented)).toEqual([]);
    }
    expect(heard).toEqual([15, 36, 54, 75]);
    expect(queue.pendingCount).toBe(0);
  });

  it('does not recover a backlog after a long presentation stall', () => {
    const queue = new AudioCueScheduler();
    queue.takeDue(1);
    queue.ingest(Array.from({ length: 20 }, (_, i) => ({
      id: `stalled:${i}`, tick: 3 + i * 3, kind: 'mining.hit', x: 1, z: 1,
    })));
    const fresh = { id: 'fresh', tick: 69, kind: 'mining.hit', x: 1, z: 1 };
    queue.ingest([fresh]);
    expect(queue.takeDue(70)).toEqual([fresh]);
    expect(queue.pendingCount).toBe(0);
    queue.ingest([{ id: 'current', tick: 71, kind: 'mining.hit', x: 1, z: 1 }]);
    expect(queue.takeDue(71).map(cue => cue.id)).toEqual(['current']);
  });

  it('keeps one recent contact even when a very slow frame spans more than 24 ticks', () => {
    const queue = new AudioCueScheduler();
    queue.takeDue(1);
    queue.ingest([3, 12, 24, 39, 45].map(tick => ({
      id: `slow:${tick}`, tick, kind: 'mining.hit', x: 1, z: 1,
    })));
    expect(queue.takeDue(50).map(cue => cue.tick)).toEqual([45]);
    queue.ingest([{ id: 'stale', tick: 60, kind: 'mining.hit', x: 1, z: 1 }]);
    expect(queue.takeDue(90)).toEqual([]);
  });

  it('bounds a flood of future cues without scanning them on every frame', () => {
    const queue = new AudioCueScheduler();
    queue.ingest(Array.from({ length: 500 }, (_, i) => ({
      id: `event:${i}`, tick: i + 1, kind: 'woodcutting.hit', x: 1, z: 1,
    })));
    expect(queue.pendingCount).toBe(256);
    expect(queue.takeDue(1)).toHaveLength(1);
  });

  it('keeps a severe alert through a full queue and a slow presentation jump', () => {
    const queue = new AudioCueScheduler();
    queue.ingest(Array.from({ length: 256 }, (_, i) => ({
      id: `work:${i}`, tick: 260 + i, kind: 'woodcutting.hit', x: 1, z: 1,
    })));
    const alert = { id: 'raid:1', tick: 300, kind: 'ui.threat', x: 0, z: 0 };
    queue.ingest([alert]);
    expect(queue.pendingCount).toBe(256);
    const due = queue.takeDue(500);
    expect(due).toContainEqual(alert);
    expect(due.some(cue => cue.kind === 'woodcutting.hit')).toBe(true);
    queue.ingest([alert]);
    expect(queue.takeDue(501).some(cue => cue.kind === 'ui.threat')).toBe(false);
  });

  it('retains a delayed colonist death alert even when the current frame has another sound', () => {
    const queue = new AudioCueScheduler();
    queue.takeDue(40);
    const alert = { id: 'death:1', tick: 12, kind: 'ui.colonist-death', x: 0, z: 0 };
    const work = { id: 'work:40', tick: 40, kind: 'mining.hit', x: 1, z: 1 };
    queue.ingest([alert, work]);
    expect(queue.takeDue(40)).toEqual([alert, work]);
  });
});

describe('sound spatialisation', () => {
  // Web Audio's exponential Panner has a gentle distant tail. Culling at the
  // explicit horizon is separate from the node's clamped distance gain.
  const pannerLevel = (distance: number, range: number): number =>
    (Math.max(SPATIAL_REF_DISTANCE, Math.min(distance, range)) / SPATIAL_REF_DISTANCE) ** -SPATIAL_ROLLOFF;

  it('uses the orthographic focus and zoom as its effective camera distance', () => {
    const pose = listenerPose({ x: 150, y: 300, z: 160, targetX: 20, targetZ: 30, span: 32, mode: 'orthographic' });
    expect(pose.x).toBe(20);
    expect(pose.z).toBe(30);
    expect(pose.y).toBeGreaterThan(1.6);
    expect(pose.y).toBeLessThan(20);
    expect(sourceDistance(21, 30, pose)).toBeGreaterThan(pose.y);
    expect(Math.hypot(pose.forwardX, pose.forwardZ)).toBeCloseTo(1);
  });

  it('places the listener at the perspective camera without reducing range a second time on zoom', () => {
    const pose = listenerPose({ x: 0, y: 3, z: 0, targetX: 10, targetZ: 0, mode: 'perspective' });
    expect(pose.x).toBe(0);
    expect(pose.y).toBe(3);
    const near = audibleRange(24, { x: 0, y: 30, z: 0, span: 16, mode: 'perspective' });
    const overview = audibleRange(24, { x: 0, y: 30, z: 0, span: 128, mode: 'perspective' });
    expect(overview).toBe(near);
    expect(overview).toBe(64);
    expect(audibleRange(24, { x: 0, y: 30, z: 0, span: 128, mode: 'orthographic' })).toBeLessThan(24);
  });

  it('cuts local mining when perspective height grows even if the map focus stays fixed', () => {
    const events = { 'mining.hit': { loop: false, spatial: true, gain: 1, maxDistance: 20 } };
    const cues = [{ id: 'mining:near', tick: 1, kind: 'mining.hit', x: 10, z: 10 }];
    const near = { x: 10, y: 4, z: 10, targetX: 10, targetZ: 10, span: 32, mode: 'perspective' as const };
    expect(selectOneShots(cues, events, near)).toHaveLength(1);
    expect(selectOneShots(cues, events, { ...near, y: 65 })).toHaveLength(0);
    expect(selectOneShots(cues, events, { ...near, x: 75 })).toHaveLength(0);
    expect(selectOneShots(cues, events, { ...near, y: 25 })).toHaveLength(1);
  });

  it('cuts local work and fire as an orthographic view zooms out', () => {
    const near = { x: 130, y: 100, z: 130, targetX: 10, targetZ: 10, span: 32, mode: 'orthographic' as const };
    const far = { ...near, span: 96 };
    const cue = [{ id: 'mining:near', tick: 1, kind: 'mining.hit', x: 10, z: 10 }];
    const mining = { 'mining.hit': { loop: false, spatial: true, gain: 1, maxDistance: 20 } };
    const fire = [{ id: 'fire', kind: 'ambient.fire', x: 10, z: 10 }];
    const fireInfo = { 'ambient.fire': { loop: true, spatial: true, maxDistance: 22 } };
    expect(sourceDistance(10, 10, listenerPose(far))).toBeGreaterThan(sourceDistance(10, 10, listenerPose(near)));
    expect(selectOneShots(cue, mining, near)).toHaveLength(1);
    expect(selectOneShots(cue, mining, far)).toHaveLength(0);
    expect(selectContinuousSources(fire, fireInfo, near)).toHaveLength(1);
    expect(selectContinuousSources(fire, fireInfo, far)).toHaveLength(0);
  });

  it('keeps a progressively quieter distant tail in both cameras at a matched 32-cell framing', () => {
    // CameraRig keeps this inclination and moves the perspective camera to
    // span / (2 * tan(22.5°)) when switching from the iso projection.
    const inclination = 2 / Math.hypot(0.85, 2, 0.9);
    const perspectiveDistance = 32 / (2 * Math.tan(Math.PI / 8));
    const perspectiveX = perspectiveDistance * Math.sqrt(1 - inclination ** 2);
    const perspectiveY = perspectiveDistance * inclination;
    const iso = { x: perspectiveX, y: perspectiveY, z: 0, targetX: 0, targetZ: 0,
      span: 32, mode: 'orthographic' as const };
    const perspective = { ...iso, mode: 'perspective' as const };
    for (const baseRange of [16, 22]) {
      const isoPose = listenerPose(iso);
      const perspectivePose = listenerPose(perspective);
      const isoRange = audibleRange(baseRange, iso);
      const perspectiveRange = audibleRange(baseRange, perspective);
      const nearIso = pannerLevel(sourceDistance(0, 0, isoPose), isoRange);
      const middleIso = pannerLevel(sourceDistance(14, 0, isoPose), isoRange);
      const middlePerspective = pannerLevel(sourceDistance(14, 0, perspectivePose), perspectiveRange);
      const farIso = pannerLevel(sourceDistance(40, 0, isoPose), isoRange);
      const farPerspective = pannerLevel(sourceDistance(40, 0, perspectivePose), perspectiveRange);
      expect(nearIso).toBeLessThan(0.5);
      expect(middleIso).toBeLessThan(nearIso * 0.5);
      expect(farIso).toBeGreaterThan(0);
      expect(farIso).toBeLessThan(middleIso * 0.35);
      expect(farPerspective).toBeGreaterThan(0);
      expect(farPerspective).toBeLessThan(0.1);
      expect(middlePerspective).toBeLessThan(0.1);
      expect(isoRange).toBeGreaterThan(baseRange * 2.8);
    }
  });
});

describe('audio manifest', () => {
  it('keeps valid local assets and rejects external or traversal URLs', () => {
    const manifest = parseAudioManifest({
      version: 1,
      events: {
        'mining.hit': {
          gain: 0.6, maxDistance: 20,
          variants: [
            { src: '/assets/audio/sfx/mining-1.ogg', gain: 0.8 },
            { src: 'https://example.org/a.ogg' },
            { src: '/assets/audio/../secret.ogg' },
          ],
        },
      },
    });
    expect(manifest.events['mining.hit']).toEqual({
      gain: 0.6, maxDistance: 20, loop: false, spatial: true,
      variants: [{ src: '/assets/audio/sfx/mining-1.ogg', gain: 0.8 }],
    });
  });

  it('accepts a QA gain of five for a one-shot while keeping loops conservatively capped', () => {
    const manifest = parseAudioManifest({
      version: 1,
      events: {
        'weapon.gunshot': { gain: 5, variants: [{ src: '/assets/audio/sfx/gun.mp3', gain: 1.5 }] },
        'ambient.fire': { loop: true, gain: 5, variants: [{ src: '/assets/audio/sfx/fire.mp3' }] },
      },
    });
    expect(manifest.events['weapon.gunshot']?.gain).toBe(5);
    expect(manifest.events['weapon.gunshot']?.variants[0]?.gain).toBe(1.5);
    expect(manifest.events['ambient.fire']?.gain).toBe(1);
  });
});

describe('continuous sound selection', () => {
  it('sounds only a fueled generator and a producing turbine', () => {
    const base={id:7,x:10,z:10,orientation:0,footprint:'standard',power:{on:true,parentId:null}} as const;
    const generator={...base,kind:'wood-generator',fuel:{ticks:600,burned:0,autoRefuel:true}} as Structure;
    expect(runningMachineAudioSource(generator)?.kind).toBe('machine.wood-generator');
    generator.fuel!.ticks=0;
    expect(runningMachineAudioSource(generator)).toBeUndefined();
    const turbine={...base,kind:'wind-turbine',wind:{autoCut:false,updateCounter:0,cachedWatts:1200}} as Structure;
    expect(runningMachineAudioSource(turbine)?.kind).toBe('machine.wind-turbine');
    turbine.wind!.cachedWatts=0;
    expect(runningMachineAudioSource(turbine)).toBeUndefined();
    turbine.wind!.cachedWatts=1200; turbine.breakdown={brokenAt:5};
    expect(runningMachineAudioSource(turbine)).toBeUndefined();
  });
  it('keeps only nearby active machinery candidates before the shared voice budget', () => {
    const machines=createNearbyMachineCollector({x:10,z:10},2,20);
    machines.add('wood:near','machine.wood-generator',11,10,.6);
    machines.add('wind:middle','machine.wind-turbine',19,10,.4);
    machines.add('wood:far','machine.wood-generator',40,10,.6);
    machines.add('wind:closer','machine.wind-turbine',13,10,.4);
    expect(machines.sources().map(source=>source.id)).toEqual(['wood:near','wind:closer']);
  });
  it('samples fires around the low-perspective listener after rotation while bounding candidates', () => {
    const before={x:100,y:8,z:135,targetX:100,targetZ:100,span:30,mode:'perspective' as const};
    const camera={...before,x:135,z:100}; // Orbit target is unchanged; the ear moves with the camera.
    const previous=listenerPose(before),pose=listenerPose(camera);
    expect(Math.hypot(pose.x-previous.x,pose.z-previous.z)).toBeGreaterThan(4);
    expect(pose.x).toBeCloseTo(135);
    expect(Math.hypot(132-camera.targetX,100-camera.targetZ)).toBeGreaterThan(30);
    expect(sourceDistance(132,100,pose)).toBeLessThan(audibleRange(22,camera));
    const nearby=createNearbyFireCollector(pose);
    nearby.add('fire:audible',132,100,1);
    nearby.add('fire:far',205,100,1);
    expect(nearby.sources().map(source=>source.id)).toEqual(['fire:audible']);
    const selected=selectContinuousSources(nearby.sources(),{'ambient.fire':{loop:true,spatial:true,maxDistance:22}},camera);
    expect(selected.map(source=>source.id)).toEqual(['fire:audible']);
    for(let i=0;i<20;i++)nearby.add(`fire:${i}`,pose.x+i/10,pose.z,1);
    expect(nearby.sources()).toHaveLength(12);
    expect(nearby.sources().some(source=>source.id==='fire:far')).toBe(false);
  });

  it('keeps the closest fires and a global rain bed within four voices', () => {
    const events = {
      'ambient.fire': { loop: true, spatial: true, maxDistance: 24 },
      'weather.rain': { loop: true, spatial: false, maxDistance: 24 },
    };
    const sources = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `fire:${i}`, kind: 'ambient.fire', x: i + 1, z: 0 })),
      { id: 'rain', kind: 'weather.rain', x: 999, z: 999 },
    ];
    expect(selectContinuousSources(sources, events, { x: 0, y: 100, z: 0, targetX: 0, targetZ: 0, span: 32 }, 4)
      .map(source => source.id)).toEqual(['rain', 'fire:0', 'fire:1', 'fire:2']);
  });
});

describe('one-shot burst budget', () => {
  it('keeps non-spatial cues audible regardless of their source coordinates', () => {
    const cues = [
      { id: 'global', tick: 5, kind: 'ui.notice', x: 999, z: 999 },
      { id: 'local', tick: 5, kind: 'mining.hit', x: 999, z: 999 },
    ];
    const events = {
      'ui.notice': { loop: false, spatial: false, gain: 1, maxDistance: 20 },
      'mining.hit': { loop: false, spatial: true, gain: 1, maxDistance: 20 },
    };
    expect(selectOneShots(cues, events, { x: 0, y: 30, z: 0, targetX: 0, targetZ: 0, span: 32 })
      .map(cue => cue.id)).toEqual(['global']);
  });

  it('prefers audible combat over nearby work and creates at most twelve candidates', () => {
    const cues = [
      ...Array.from({ length: 100 }, (_, i) => ({ id: `work:${i}`, tick: 10, kind: 'mining.hit', x: i % 10, z: 0 })),
      { id: 'gun', tick: 10, kind: 'weapon.gunshot', x: 12, z: 0 },
      { id: 'melee', tick: 10, kind: 'weapon.melee', x: 11, z: 0 },
      { id: 'far-gun', tick: 10, kind: 'weapon.gunshot', x: 100, z: 0 },
    ];
    const events = {
      'mining.hit': { loop: false, gain: 1, maxDistance: 24 },
      'weapon.gunshot': { loop: false, gain: 1, maxDistance: 24 },
      'weapon.melee': { loop: false, gain: 1, maxDistance: 24 },
    };
    const selected = selectOneShots(cues, events, { x: 0, y: 100, z: 0, targetX: 0, targetZ: 0, span: 32 });
    expect(selected).toHaveLength(12);
    expect(selected.slice(0, 2).map(cue => cue.id)).toEqual(['gun', 'melee']);
    expect(selected.some(cue => cue.id === 'far-gun')).toBe(false);
  });

  it('varies one-shot playback deterministically within three percent and one decibel', () => {
    for (let i = 0; i < 100; i++) {
      const id = `cue:${i}`;
      const variation = cueVariation(id);
      expect(variation).toEqual(cueVariation(id));
      expect(variation.playbackRate).toBeGreaterThanOrEqual(0.97);
      expect(variation.playbackRate).toBeLessThanOrEqual(1.03);
      expect(variation.gain).toBeGreaterThanOrEqual(10 ** (-1 / 20));
      expect(variation.gain).toBeLessThanOrEqual(10 ** (1 / 20));
    }
  });

  it('gives work gestures a wider but bounded variation while keeping doors and combat subtle', () => {
    for (const kind of ['mining.hit', 'woodcutting.hit', 'construction.hit', 'cooking.work',
      'crafting.work', 'tailoring.work', 'butchering.work', 'research.work']) {
      const variations = Array.from({ length: 256 }, (_, i) => cueVariation(`${kind}:${i}`, kind));
      expect(variations).toEqual(Array.from({ length: 256 }, (_, i) => cueVariation(`${kind}:${i}`, kind)));
      expect(Math.min(...variations.map(value => value.playbackRate))).toBeGreaterThanOrEqual(0.94);
      expect(Math.max(...variations.map(value => value.playbackRate))).toBeLessThanOrEqual(1.06);
      expect(Math.min(...variations.map(value => value.gain))).toBeGreaterThanOrEqual(10 ** (-1.5 / 20));
      expect(Math.max(...variations.map(value => value.gain))).toBeLessThanOrEqual(10 ** (1.5 / 20));
    }
    for (const kind of ['door.open', 'door.close', 'weapon.gunshot', 'weapon.melee']) {
      const variation = cueVariation(`${kind}:1`, kind);
      expect(variation.playbackRate).toBeGreaterThanOrEqual(0.97);
      expect(variation.playbackRate).toBeLessThanOrEqual(1.03);
      expect(variation.gain).toBeGreaterThanOrEqual(10 ** (-1 / 20));
      expect(variation.gain).toBeLessThanOrEqual(10 ** (1 / 20));
    }
  });
});

describe('continuous voice lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('alternates decoded one-shot variants when consecutive cue hashes choose the same file', async () => {
    class Param {
      value = 0;
      setValueAtTime(value: number): void { this.value = value; }
      setTargetAtTime(value: number): void { this.value = value; }
      cancelScheduledValues(): void {}
    }
    class Node { connect(): void {} disconnect(): void {} }
    class Source extends Node {
      buffer: unknown;
      playbackRate = { value: 1 };
      onended: (() => void) | null = null;
      start(): void {}
      stop(): void {}
    }
    class FakeContext {
      static latest: FakeContext;
      state = 'running';
      currentTime = 0;
      destination = new Node();
      sources: Source[] = [];
      listener = {
        positionX: new Param(), positionY: new Param(), positionZ: new Param(),
        forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(),
      };
      constructor() { FakeContext.latest = this; }
      createGain() { return Object.assign(new Node(), { gain: new Param() }); }
      createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
      decodeAudioData(bytes: ArrayBuffer): Promise<object> {
        return Promise.resolve({ file: new Uint8Array(bytes)[0] });
      }
      resume(): Promise<void> { return Promise.resolve(); }
      close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({ version: 1, events: {
        'ui.notice': { spatial: false, variants: [
          { src: '/assets/audio/sfx/a.mp3' }, { src: '/assets/audio/sfx/b.mp3' },
        ] },
      } })) : new Response(new Uint8Array([url.endsWith('a.mp3') ? 1 : 2]))));
    const audio = new AudioDirector();
    await audio.unlock();
    for (const [tick, id] of [[1, 'notice:0'], [2, 'notice:2']] as const) {
      audio.ingestCues([{ id, tick, kind: 'ui.notice', x: 0, z: 0 }]);
      audio.update({ presentedTick: tick, paused: false, hidden: false });
    }
    const [first, second] = FakeContext.latest.sources;
    expect(first?.buffer).not.toEqual(second?.buffer);
    audio.reset();
    audio.ingestCues([{ id: 'notice:0', tick: 3, kind: 'ui.notice', x: 0, z: 0 }]);
    audio.update({ presentedTick: 3, paused: false, hidden: false });
    expect(FakeContext.latest.sources[2]?.buffer).toEqual(first?.buffer);
    audio.dispose();
  });

  it('reports a blocked resume and retries on a later gesture', async () => {
    class Param {
      value = 0;
      setValueAtTime(value: number): void { this.value = value; }
      setTargetAtTime(value: number): void { this.value = value; }
      cancelScheduledValues(): void {}
    }
    class Node { connect(): void {} disconnect(): void {} }
    class FakeContext {
      state = 'suspended';
      currentTime = 0;
      destination = new Node();
      resumes = 0;
      listener = {
        positionX: new Param(), positionY: new Param(), positionZ: new Param(),
        forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(),
      };
      createGain() { return Object.assign(new Node(), { gain: new Param() }); }
      decodeAudioData(): Promise<object> { return Promise.resolve({}); }
      resume(): Promise<void> {
        this.resumes++;
        if (this.resumes === 1) return Promise.reject(new Error('blocked'));
        this.state = 'running';
        return Promise.resolve();
      }
      close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({ version: 1, events: {
        'mining.hit': { variants: [{ src: '/assets/audio/sfx/mining.mp3' }] },
      } })) : new Response(new Uint8Array([1]))));
    const audio = new AudioDirector();
    await expect(audio.unlock()).rejects.toThrow('blocked');
    await expect(audio.unlock()).resolves.toBeUndefined();
    expect((audio as any).context.resumes).toBe(2);
    audio.dispose();
  });

  it('loops, fades on pause, restarts on resume, and stops when removed', async () => {
    class Param {
      value = 0;
      targets: number[] = [];
      setValueAtTime(value: number): void { this.value = value; }
      setTargetAtTime(value: number): void { this.value = value; this.targets.push(value); }
      cancelScheduledValues(): void {}
    }
    class Node {
      connect(): void {}
      disconnect(): void {}
    }
    class Source extends Node {
      buffer: unknown;
      loop = false;
      playbackRate = { value: 1 };
      onended: (() => void) | null = null;
      starts = 0;
      stops = 0;
      start(): void { this.starts++; }
      stop(): void { this.stops++; }
    }
    class FakeContext {
      static latest: FakeContext;
      state = 'running';
      currentTime = 1;
      destination = new Node();
      gains: { gain: Param }[] = [];
      sources: Source[] = [];
      panners = 0;
      lastPanner: (Node & { distanceModel: string; refDistance: number; rolloffFactor: number; maxDistance: number }) | null = null;
      listener = {
        positionX: new Param(), positionY: new Param(), positionZ: new Param(),
        forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(),
      };
      constructor() { FakeContext.latest = this; }
      createGain() {
        const node = Object.assign(new Node(), { gain: new Param() });
        this.gains.push(node);
        return node;
      }
      createPanner() {
        this.panners++;
        const node = Object.assign(new Node(), {
          positionX: new Param(), positionY: new Param(), positionZ: new Param(),
          panningModel: '', distanceModel: '', refDistance: 0, maxDistance: 0, rolloffFactor: 0,
        });
        this.lastPanner = node;
        return node;
      }
      createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
      decodeAudioData(): Promise<object> { return Promise.resolve({}); }
      resume(): Promise<void> { return Promise.resolve(); }
      close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({
        version: 1, events: {
          'weather.rain': { loop: true, spatial: false, variants: [{ src: '/assets/audio/sfx/rain.ogg' }] },
          'mining.hit': { gain: 5, variants: [{ src: '/assets/audio/sfx/rain.ogg' }] },
          'construction.hit': { variants: [{ src: '/assets/audio/sfx/rain.ogg' }] },
          'door.open': { variants: [{ src: '/assets/audio/sfx/rain.ogg' }] },
          'door.close': { variants: [{ src: '/assets/audio/sfx/rain.ogg' }] },
          'weapon.gunshot': { variants: [{ src: '/assets/audio/sfx/rain.ogg' }] },
          'ui.notice': { spatial: false, variants: [{ src: '/assets/audio/sfx/rain.ogg' }] },
        },
      })) : new Response(new Uint8Array([1]))));

    const audio = new AudioDirector();
    await audio.unlock();
    expect(audio.loadedCount).toBe(1);
    expect(audio.availableSounds).toBe(7);
    audio.setContinuousSources([{ id: 'rain', kind: 'weather.rain', x: 0, z: 0 }]);
    const context = FakeContext.latest;
    const initialEarHeight = context.listener.positionY.value;
    audio.updateCamera({ x: 0, y: 100, z: 0, targetX: 0, targetZ: 0, span: 40, mode: 'orthographic' });
    expect(context.listener.positionY.value).toBeGreaterThan(initialEarHeight);
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]!.loop).toBe(true);
    expect(context.sources[0]!.starts).toBe(1);
    audio.update({ presentedTick: 1, paused: true, hidden: false });
    expect(context.gains[0]!.gain.targets.at(-1)).toBe(0);
    expect(context.sources[0]!.stops).toBe(1);
    audio.update({ presentedTick: 1, paused: false, hidden: false });
    expect(context.sources).toHaveLength(2);
    expect(context.gains[0]!.gain.targets.at(-1)).toBeCloseTo(0.75 * 0.55 * 0.75);
    audio.setContinuousSources([]);
    expect(context.sources[1]!.stops).toBe(1);
    audio.ingestCues([{ id: 'mining:5', tick: 5, kind: 'mining.hit', x: 0, z: 0 }]);
    audio.update({ presentedTick: 4.9, paused: false, hidden: false });
    expect(context.sources).toHaveLength(2);
    audio.update({ presentedTick: 5, paused: false, hidden: false });
    expect(context.sources).toHaveLength(3);
    expect(context.sources[2]!.loop).toBe(false);
    expect(context.sources[2]!.starts).toBe(1);
    expect(context.lastPanner).toMatchObject({ distanceModel: 'exponential',
      refDistance: SPATIAL_REF_DISTANCE, rolloffFactor: SPATIAL_ROLLOFF,
      maxDistance: audibleRange(24, { x: 0, y: 100, z: 0, targetX: 0, targetZ: 0, span: 40, mode: 'orthographic' }) });
    expect(context.gains[3]!.gain.value).toBeCloseTo(5 * cueVariation('mining:5', 'mining.hit').gain);
    expect(audio.diagnostics).toMatchObject({ state: 'running', loaded: 1,
      playedOneShots: 1, lastKind: 'mining.hit' });
    audio.ingestCues([
      { id: 'mining:same-patch', tick: 5.5, kind: 'mining.hit', x: 1, z: 1 },
      { id: 'mining:other-patch', tick: 5.5, kind: 'mining.hit', x: 6, z: 0 },
    ]);
    audio.update({ presentedTick: 5.5, paused: false, hidden: false });
    expect(context.sources).toHaveLength(4); // Only the distinct patch adds a voice.
    expect(audio.diagnostics.playedOneShots).toBe(2);
    audio.ingestCues([{ id: 'notice:6', tick: 6, kind: 'ui.notice', x: 999, z: 999 }]);
    audio.update({ presentedTick: 6, paused: false, hidden: false });
    expect(context.sources).toHaveLength(5);
    expect(context.panners).toBe(2);
    audio.ingestCues([
      { id: 'build:near', tick: 6.5, kind: 'construction.hit', x: 0, z: 0 },
      { id: 'build:same-patch', tick: 6.5, kind: 'construction.hit', x: 1, z: 1 },
      { id: 'build:other-patch', tick: 6.5, kind: 'construction.hit', x: 6, z: 0 },
    ]);
    audio.update({ presentedTick: 6.5, paused: false, hidden: false });
    expect(context.sources).toHaveLength(7); // Same construction recording is heard once per patch.
    expect(context.panners).toBe(4); // Construction and mining can coexist at one patch.
    audio.updateCamera({ x: 0, y: 3, z: 0, targetX: 0, targetZ: 0, span: 32, mode: 'perspective' });
    audio.ingestCues([
      { id: 'door:open:0', tick: 7, kind: 'door.open', x: 0, z: 0 },
      { id: 'door:close:same-patch', tick: 7, kind: 'door.close', x: 1, z: 0 },
      { id: 'door:close:other-patch', tick: 7, kind: 'door.close', x: 6, z: 0 },
      { id: 'door:open:third-patch', tick: 7, kind: 'door.open', x: 12, z: 0 },
      { id: 'door:close:over-budget', tick: 7, kind: 'door.close', x: 18, z: 0 },
      { id: 'gun:near-door', tick: 7, kind: 'weapon.gunshot', x: 1, z: 0 },
    ]);
    audio.update({ presentedTick: 7, paused: false, hidden: false });
    expect(context.sources).toHaveLength(11); // Three door voices plus the unrestricted gunshot.
    expect(context.panners).toBe(8);
    audio.dispose();
  });

  it('loads and decodes no more than three assets concurrently at unlock', async () => {
    class Param {
      value = 0;
      setValueAtTime(value: number): void { this.value = value; }
      setTargetAtTime(value: number): void { this.value = value; }
      cancelScheduledValues(): void {}
    }
    class Node { connect(): void {} disconnect(): void {} }
    let activeFetches = 0; let peakFetches = 0;
    let activeDecodes = 0; let peakDecodes = 0;
    class FakeContext {
      state = 'running';
      currentTime = 0;
      destination = new Node();
      listener = {
        positionX: new Param(), positionY: new Param(), positionZ: new Param(),
        forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(),
      };
      createGain() { return Object.assign(new Node(), { gain: new Param() }); }
      resume(): Promise<void> { return Promise.resolve(); }
      close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
      async decodeAudioData(): Promise<object> {
        activeDecodes++;
        peakDecodes = Math.max(peakDecodes, activeDecodes);
        await new Promise(resolve => setTimeout(resolve, 2));
        activeDecodes--;
        return {};
      }
      createBufferSource() { return Object.assign(new Node(), { buffer: null, playbackRate: { value: 1 }, onended: null, start(): void {}, stop(): void {} }); }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) {
        const events = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [
          i === 0 ? 'mining.hit' : `ui.test-${i}`, { spatial: i === 0 ? undefined : false, variants: [{ src: `/assets/audio/sfx/${i}.mp3` }] },
        ]));
        return new Response(JSON.stringify({ version: 1, events }));
      }
      activeFetches++;
      peakFetches = Math.max(peakFetches, activeFetches);
      await new Promise(resolve => setTimeout(resolve, 2));
      activeFetches--;
      return new Response(new Uint8Array([1]));
    }));
    const audio = new AudioDirector();
    await audio.unlock();
    await audio.playPreview(); // Recovery overlaps initial loading, sharing its budget.
    await vi.waitFor(() => expect(audio.loadedCount).toBe(13));
    expect(peakFetches).toBeLessThanOrEqual(3);
    expect(peakDecodes).toBeLessThanOrEqual(3);
    audio.dispose();
  });
});

describe('explicit sound preview and failed asset recovery', () => {
  afterEach(() => vi.unstubAllGlobals());

  class Param {
    value = 0;
    setValueAtTime(value: number): void { this.value = value; }
    setTargetAtTime(value: number): void { this.value = value; }
    cancelScheduledValues(): void {}
  }
  class Node {
    connections: Node[] = [];
    disconnected = false;
    connect(node: Node): void { this.connections.push(node); }
    disconnect(): void { this.disconnected = true; }
  }
  class Source extends Node {
    buffer: unknown;
    playbackRate = { value: 1 };
    onended: (() => void) | null = null;
    starts = 0;
    stops = 0;
    start(): void { this.starts++; }
    stop(): void { this.stops++; }
  }
  class FakeContext {
    static latest: FakeContext;
    state = 'running';
    currentTime = 0;
    destination = new Node();
    gains: (Node & { gain: Param })[] = [];
    sources: Source[] = [];
    listener = {
      positionX: new Param(), positionY: new Param(), positionZ: new Param(),
      forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(),
    };
    constructor() { FakeContext.latest = this; }
    createGain() {
      const gain = Object.assign(new Node(), { gain: new Param() });
      this.gains.push(gain);
      return gain;
    }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
    decodeAudioData(): Promise<object> { return Promise.resolve({ duration: 0.6 }); }
    resume(): Promise<void> { this.state = 'running'; return Promise.resolve(); }
    close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
  }
  const manifest = { version: 1, events: {
    'mining.hit': { gain: 2, variants: [{ src: '/assets/audio/sfx/mining.mp3' }] },
  } };

  it('plays ready sounds and the preview while an unrelated MP3 is stalled, then aborts its deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeContext);
    let stalledSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify({ version: 1, events: {
        ...manifest.events, 'door.open': { variants: [{ src: '/assets/audio/sfx/stalled.mp3' }] },
      } }));
      if (url.endsWith('stalled.mp3')) {
        stalledSignal = options?.signal as AbortSignal;
        return new Promise<Response>(() => {}); // Includes servers that ignore abort.
      }
      return new Response(new Uint8Array([1]));
    }));
    const audio = new AudioDirector();
    try {
      await audio.unlock();
      expect(audio.loadedCount).toBe(1);
      await audio.playPreview();
      expect(FakeContext.latest.sources.some(source => source.starts === 1)).toBe(true);
      expect(stalledSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(8_001);
      expect(stalledSignal?.aborted).toBe(true);
      expect(audio.loadedCount).toBe(1);
    } finally { audio.dispose(); vi.useRealTimers(); }
  });

  it('silences world and interface output directly on visibility without another animation frame', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({ version: 1, events: { ...manifest.events,
        'ui.click': { spatial: false, variants: [{ src: '/assets/audio/sfx/click.mp3' }] },
      } })) : new Response(new Uint8Array([1]))));
    const audio = new AudioDirector();
    await audio.unlock();
    audio.update({ presentedTick: 1, paused: false, hidden: false });
    audio.playInterface('ui.click');
    const context = FakeContext.latest;
    const count = context.sources.length;
    audio.setHidden(true);
    expect(context.gains[0]!.gain.value).toBe(0);
    expect(context.gains[1]!.gain.value).toBe(0);
    audio.setVolume(0.8); audio.setMuted(false); audio.playInterface('ui.click');
    expect(context.gains[1]!.gain.value).toBe(0);
    expect(context.sources).toHaveLength(count);
    audio.setHidden(false);
    expect(context.gains[0]!.gain.value).toBeGreaterThan(0);
    audio.dispose();
  });

  it('bounds stalled response bodies and decoding, and aborts pending asset work on disposal', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeContext);
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
      signals.push(options?.signal as AbortSignal);
      return { ok: true, arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) };
    }));
    const audio = new AudioDirector();
    const first = expect(audio.unlock()).rejects.toThrow('Aucun MP3');
    await vi.advanceTimersByTimeAsync(8_001); await first;
    expect(signals[0]!.aborted).toBe(true);
    const retry = expect(audio.playPreview()).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    audio.dispose();
    await retry;
    expect(signals.at(-1)!.aborted).toBe(true);
    class StalledDecoder extends FakeContext {
      override decodeAudioData(): Promise<object> { return new Promise(() => {}); }
    }
    vi.stubGlobal('AudioContext', StalledDecoder);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify(manifest)) : new Response(new Uint8Array([1]))));
    const decoding = new AudioDirector();
    const decoded = expect(decoding.unlock()).rejects.toThrow('Aucun MP3');
    await vi.advanceTimersByTimeAsync(8_001); await decoded;
    expect(decoding.loadedCount).toBe(0);
    decoding.dispose();
    vi.useRealTimers();
  });

  it('cancels a preview whose decode finishes after the page becomes hidden', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    let complete: ((response: Response) => void) | undefined;
    let manifests = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify({ version: 1, events: {
        'door.open': { variants: [{ src: '/assets/audio/sfx/cooking.mp3' }] },
        ...(manifests++ ? manifest.events : {}),
      } }));
      if (url.endsWith('mining.mp3')) return new Promise<Response>(resolve => { complete = resolve; });
      return new Response(new Uint8Array([1]));
    }));
    const audio = new AudioDirector(); await audio.unlock();
    const preview = expect(audio.playPreview()).rejects.toThrow('annulé');
    await vi.waitFor(() => expect(complete).toBeDefined());
    audio.setHidden(true); complete!(new Response(new Uint8Array([1])));
    await preview;
    expect(FakeContext.latest.sources).toHaveLength(0);
    audio.dispose();
  });

  it('plays decoded interface cues during pause through the common SFX mix without another unlock', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const fetchMock = vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({ version: 1, events: {
        'ui.click': { spatial: false, variants: [
          { src: '/assets/audio/sfx/click-1.mp3' },
          { src: '/assets/audio/sfx/click-2.mp3' },
        ] },
      } })) : new Response(new Uint8Array([1])));
    vi.stubGlobal('fetch', fetchMock);
    const audio = new AudioDirector();
    audio.playInterface('ui.click'); // No implicit context creation or fetch.
    expect(fetchMock).not.toHaveBeenCalled();
    await audio.unlock();
    const context = FakeContext.latest;
    audio.update({ presentedTick: 1, paused: true, hidden: false });
    expect(context.gains[0]!.gain.value).toBe(0);
    audio.playInterface('ui.click');
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]!.starts).toBe(1);
    expect(context.gains[1]!.connections).toEqual([context.destination]);
    expect(context.gains[1]!.gain.value).toBeCloseTo(0.55 * 0.75 * 0.75);
    expect(context.gains[2]!.gain.value).toBeCloseTo(cueVariation('ui.click:0', 'ui.click').gain);
    expect(context.gains[2]!.connections).toEqual([context.gains[1]]);
    audio.setVolume(0.25);
    expect(context.gains[1]!.gain.value).toBeCloseTo(0.55 * 0.75 * 0.25);
    audio.playInterface('ui.click');
    expect(context.sources).toHaveLength(2);
    expect(context.sources[1]!.buffer).not.toBe(context.sources[0]!.buffer);
    audio.playInterface('ui.reject'); // Missing event is silent.
    audio.setMuted(true);
    expect(context.gains[1]!.gain.value).toBe(0);
    audio.playInterface('ui.click');
    expect(context.sources).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3); // Manifest plus two decoded files.
    audio.dispose();
  });

  it('plays confirmed raid and death alerts during an automatic pause exactly once', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({ version: 1, events: {
        'ui.threat': { spatial: false, variants: [{ src: '/assets/audio/sfx/threat.mp3' }] },
        'ui.colonist-death': { spatial: false, variants: [{ src: '/assets/audio/sfx/death.mp3' }] },
      } })) : new Response(new Uint8Array([1]))));
    const audio = new AudioDirector();
    await audio.unlock();
    const cues = [
      { id: 'raid:1', tick: 4, kind: 'ui.threat', x: 0, z: 0 },
      { id: 'death:1', tick: 4, kind: 'ui.colonist-death', x: 1, z: 1 },
    ];
    audio.ingestCues(cues);
    audio.update({ presentedTick: 4, paused: true, hidden: false });
    expect(FakeContext.latest.sources.map(source => source.starts)).toEqual([1, 1]);
    audio.ingestCues(cues);
    audio.update({ presentedTick: 4, paused: true, hidden: false });
    expect(FakeContext.latest.sources).toHaveLength(2);
    audio.dispose();
  });

  it('refreshes a cached manifest missing the preview on the click and keeps loaded world sounds', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const cooking = { variants: [{ src: '/assets/audio/sfx/cooking.mp3' }] };
    let manifestReads = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('manifest.json')) {
        manifestReads++;
        expect(options?.cache).toBe(manifestReads === 1 ? 'no-cache' : 'no-store');
        return new Response(JSON.stringify({ version: 1, events: manifestReads === 1
          ? { 'door.open': cooking } : { ...manifest.events, 'door.open': cooking } }));
      }
      return new Response(new Uint8Array([1]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const audio = new AudioDirector();
    await audio.unlock();
    expect(audio.availableSounds).toBe(1);
    await audio.playPreview();
    expect(manifestReads).toBe(2);
    expect(audio.availableSounds).toBe(2);
    expect(audio.loadedCount).toBe(2);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('cooking.mp3'))).toHaveLength(1);
    expect(FakeContext.latest.sources[0]!.starts).toBe(1);
    await audio.playPreview();
    expect(manifestReads).toBe(2);
    audio.dispose();
  });

  it('reports a still incomplete fresh manifest without losing a loaded world sound', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const incomplete = { version: 1, events: {
      'door.open': { variants: [{ src: '/assets/audio/sfx/cooking.mp3' }] },
    } };
    let manifestReads = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('manifest.json')) {
        manifestReads++;
        expect(options?.cache).toBe(manifestReads === 1 ? 'no-cache' : 'no-store');
        return new Response(JSON.stringify(incomplete));
      }
      return new Response(new Uint8Array([1]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const audio = new AudioDirector();
    await audio.unlock();
    await expect(audio.playPreview()).rejects.toThrow('Le son d’essai est absent du manifeste audio.');
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('manifest.json'))).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('cooking.mp3'))).toHaveLength(1);
    expect(audio.availableSounds).toBe(1);
    expect(audio.loadedCount).toBe(1);
    expect(FakeContext.latest.sources).toHaveLength(0);
    audio.dispose();
  });

  it('does not report an absent preview when browser audio activation fails', async () => {
    class BlockedContext extends FakeContext {
      resume(): Promise<void> { return Promise.reject(new Error('Audio activation blocked')); }
    }
    vi.stubGlobal('AudioContext', BlockedContext);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const audio = new AudioDirector();
    await expect(audio.playPreview()).rejects.toThrow('Audio activation blocked');
    expect(fetchMock).not.toHaveBeenCalled();
    audio.dispose();
  });

  it('rejects a manifest with zero decoded files and retries only on an explicit preview click', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    let mp3Fetches = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
      mp3Fetches++;
      return mp3Fetches === 1 ? new Response('', { status: 503 }) : new Response(new Uint8Array([1]));
    }));
    const audio = new AudioDirector();
    await expect(audio.unlock()).rejects.toThrow('Aucun MP3');
    expect(audio.loadedCount).toBe(0);
    expect(audio.needsUnlock).toBe(false); // Ordinary gestures must not keep retrying a failed download.
    audio.update({ presentedTick: 10, paused: false, hidden: false });
    await expect(audio.unlock()).rejects.toThrow('Aucun MP3');
    expect(mp3Fetches).toBe(1);
    await audio.playPreview();
    expect(mp3Fetches).toBe(2);
    expect(audio.loadedCount).toBe(1);
    expect(FakeContext.latest.sources).toHaveLength(1);
    expect(FakeContext.latest.sources[0]!.starts).toBe(1);
    await audio.playPreview();
    expect(mp3Fetches).toBe(2);
    expect(FakeContext.latest.sources[0]!.stops).toBe(1);
    audio.dispose();
    expect(FakeContext.latest.sources[1]!.stops).toBe(1);
    expect(FakeContext.latest.gains.every(gain => gain.disconnected)).toBe(true);
  });

  it('reports a missing manifest or an unavailable preview MP3 clearly', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response('', { status: 404 }) : new Response('', { status: 404 })));
    const missing = new AudioDirector();
    await expect(missing.playPreview()).rejects.toThrow('Audio manifest HTTP 404');
    missing.dispose();

    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify(manifest)) : new Response('', { status: 404 })));
    const failed = new AudioDirector();
    await expect(failed.playPreview()).rejects.toThrow('Aucun MP3');
    await expect(failed.playPreview()).rejects.toThrow('Le MP3 d’essai ne peut pas être chargé');
    expect(FakeContext.latest.sources).toHaveLength(0);
    failed.dispose();
  });

  it('recovers another failed world sound on an explicit preview without refetching decoded files', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const attempts = new Map<string, number>();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify({ version: 1, events: {
        ...manifest.events,
        'door.open': { variants: [{ src: '/assets/audio/sfx/cooking.mp3' }] },
      } }));
      attempts.set(url, (attempts.get(url) ?? 0) + 1);
      if (url.endsWith('cooking.mp3') && attempts.get(url) === 1) return new Response('', { status: 503 });
      return new Response(new Uint8Array([1]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const audio = new AudioDirector();
    await audio.unlock();
    expect(audio.loadedCount).toBe(1);
    await audio.playPreview();
    await vi.waitFor(() => expect(audio.loadedCount).toBe(2));
    expect(attempts.get('/assets/audio/sfx/cooking.mp3')).toBe(2);
    expect(attempts.get('/assets/audio/sfx/mining.mp3')).toBe(1);
    await audio.playPreview();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    audio.dispose();
  });

  it('plays while paused through a reused direct output and obeys mute and volume', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const fetchMock = vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify(manifest)) : new Response(new Uint8Array([1])));
    vi.stubGlobal('fetch', fetchMock);
    const audio = new AudioDirector();
    audio.update({ presentedTick: 1, paused: true, hidden: false });
    await audio.playPreview();
    const context = FakeContext.latest;
    expect(context.gains[0]!.gain.value).toBe(0); // The game mix remains paused.
    expect(context.gains[1]!.gain.value).toBeCloseTo(1.5 * 0.55 * 0.75);
    expect(context.sources[0]!.connections).toEqual([context.gains[1]]);
    audio.setVolume(0.25);
    expect(context.gains[1]!.gain.value).toBeCloseTo(0.5 * 0.55 * 0.75);
    await audio.playPreview();
    expect(context.gains).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    audio.setMuted(true);
    expect(context.sources[1]!.stops).toBe(1);
    await expect(audio.playPreview()).rejects.toThrow('Activez les effets sonores');
    audio.setMuted(false);
    audio.setVolume(0);
    await expect(audio.playPreview()).rejects.toThrow('Montez le volume');
    audio.dispose();
  });
});
