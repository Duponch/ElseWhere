import { AudioCueScheduler, type AudioCue } from './scheduler';
import { audibleRange, listenerPose, sourceDistance, SPATIAL_REF_DISTANCE, SPATIAL_ROLLOFF, type AudioCamera } from './spatial';
import { selectContinuousSources, type ContinuousSource, type ContinuousEventInfo } from './continuous';
import { cueHash, cueVariation, selectOneShots } from './selection';
import { interfaceBurstRule, isWorldInterfaceCue, MAX_INTERFACE_VOICES, type InterfaceCueKind } from './interface-cues';
import { applyManifestGainOffsets, emptyGainOffsets, type GainOffsets } from './gain-offsets';
import { fallbackCue } from './game-sounds';

export type { AudioCue } from './scheduler';
export type { InterfaceCueKind } from './interface-cues';
export type { AudioCamera } from './spatial';
export type { ContinuousSource } from './continuous';

interface SoundVariant { src: string; gain: number }
interface SoundEvent extends ContinuousEventInfo { variants: SoundVariant[]; gain: number }
export interface AudioManifest { version: 1; events: Record<string, SoundEvent> }

const MAX_VOICES = 24;
const MAX_ONE_SHOTS_PER_FRAME = 12;
const DEFAULT_RANGE = 24;
// Leave headroom for overlapping work, combat and weather at the default slider level.
const MIX_GAIN = 0.55 * 0.75;
/** The effects mix factor (also used by the sounds page to play at the game level). */
export const SFX_MIX_GAIN = MIX_GAIN;
const PREVIEW_KIND = 'mining.hit';
const MAX_CLUSTER_VOICES = 3;
const CLUSTER_RADIUS = 5;
const CLUSTERED_KINDS = new Set([
  'mining.hit', 'woodcutting.hit', 'construction.hit', 'cooking.work',
  'crafting.work', 'tailoring.work', 'butchering.work', 'research.work',
  'haul.pickup', 'haul.drop', 'farming.sow', 'farming.harvest', 'eating.work',
  'cleaning.work', 'medical.tend', 'maintenance.work', 'deconstruction.work', 'firefighting.beat',
  'weapon.impact-ground', 'weapon.impact-barrier', 'weapon.impact-flesh',
  'building.complete', 'woodcutting.fell', 'farming.harvest-finish', 'medical.surgery',
]);
/** Groups of the game sounds of 22 November: a busy colony layers at most this
 * many of them at once (grazing herds, many calls, several meals). */
const GROUP_VOICES: Readonly<Record<string, number>> = { 'animal-eat': 2, 'animal-voice': 3, eating: 2, 'haul-drop': 3, construction: 3, crafting: 3 };
function clusterGroup(kind: string): string | null {
  // An opening and closing door share one nearby acoustic patch.
  if (kind === 'door.open' || kind === 'door.close' || kind === 'autodoor.open' || kind === 'autodoor.close'
    || kind === 'fencegate.move') return 'door';
  if (kind.startsWith('animal.hurt.') || kind.startsWith('animal.death.')) return 'animal';
  if (kind.startsWith('human.hurt.')) return 'human-pain';
  if (kind.startsWith('animal.call.') || kind.startsWith('animal.angry.')) return 'animal-voice';
  if (kind.startsWith('animal.eat.')) return 'animal-eat';
  if (kind.startsWith('eating.')) return 'eating';
  if (kind === 'haul.drop' || kind.startsWith('haul.drop-')) return 'haul-drop';
  if (kind.startsWith('construction.')) return 'construction';
  if (kind.startsWith('crafting.')) return 'crafting';
  return CLUSTERED_KINDS.has(kind) ? kind : null;
}
const NO_DECODED_MP3_ERROR = 'Aucun MP3 du manifeste audio n’a pu être décodé.';

function level(value: unknown, fallback: number, ceiling: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= ceiling ? value : fallback;
}

/** Rejects external URLs and malformed assets rather than fetching arbitrary saved data. */
export function parseAudioManifest(input: unknown): AudioManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid audio manifest');
  const source = input as Record<string, unknown>;
  if (source.version !== 1 || !source.events || typeof source.events !== 'object' || Array.isArray(source.events))
    throw new Error('Unsupported audio manifest');
  const events: Record<string, SoundEvent> = Object.create(null);
  for (const [kind, raw] of Object.entries(source.events)) {
    if (!kind || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const event = raw as Record<string, unknown>;
    if (!Array.isArray(event.variants)) continue;
    const loop = event.loop === true;
    const ceiling = loop ? 2 : 8;
    const variants: SoundVariant[] = [];
    for (const value of event.variants) {
      const variant = typeof value === 'string' ? { src: value } : value;
      if (!variant || typeof variant !== 'object') continue;
      const candidate = variant as Record<string, unknown>;
      if (typeof candidate.src !== 'string' || !candidate.src.startsWith('/assets/audio/') ||
        candidate.src.includes('..') || candidate.src.includes('?') || candidate.src.includes('#')) continue;
      variants.push({ src: candidate.src, gain: level(candidate.gain, 1, ceiling) });
    }
    if (!variants.length) continue;
    const maxDistance = typeof event.maxDistance === 'number' && Number.isFinite(event.maxDistance)
      ? Math.max(2, Math.min(36, event.maxDistance)) : DEFAULT_RANGE;
    events[kind] = {
      variants, gain: level(event.gain, 1, ceiling), maxDistance,
      loop,
      spatial: event.spatial !== false,
    };
  }
  // Original assets are reused explicitly for this first Bomb presentation.
  // The cue remains an explosion identity; no new download or generation.
  if(!events['weapon.explosion']&&events['weapon.impact-barrier'])
    events['weapon.explosion']={...events['weapon.impact-barrier'],gain:events['weapon.impact-barrier'].gain*.9,maxDistance:30,loop:false};
  return { version: 1, events };
}

interface Voice { source: AudioBufferSourceNode; gain: GainNode; panner: PannerNode | null; kind: string; variantGain: number; x?: number; z?: number; interface?: boolean }

/** Plays short world sounds on the confirmed presentation clock. No World state. */
export class AudioDirector {
  private readonly scheduler = new AudioCueScheduler();
  private readonly manifestUrl: string;
  private camera: AudioCamera = { x: 0, y: 30, z: 0, targetX: 0, targetZ: 0, span: 32, mode: 'orthographic' };
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private interfaceOutput: GainNode | null = null;
  private manifest: AudioManifest | null = null;
  /** The manifest as read, before the sounds page's gain offsets. */
  private parsedManifest: AudioManifest | null = null;
  private gainOffsets: GainOffsets = emptyGainOffsets();
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private readonly voices = new Set<Voice>();
  private readonly continuous = new Map<string, Voice>();
  private readonly lastPlayedVariantByKind = new Map<string, string>();
  private continuousSources: readonly ContinuousSource[] = [];
  private lastSelection = { x: Infinity, y: Infinity, z: Infinity, span: 0 };
  private unlockPromise: Promise<void> | null = null;
  private previewPromise: Promise<void> | null = null;
  private readonly assetRequests = new Set<AbortController>();
  private readonly loadingBuffers = new Map<string, Promise<AudioBuffer | null>>();
  private activeBuffers = 0;
  private readonly queuedBuffers: (() => void)[] = [];
  private previewOutput: GainNode | null = null;
  private previewSource: AudioBufferSourceNode | null = null;
  private disposed = false;
  private volume = 0.75;
  private muted = false;
  private paused = false;
  private hidden = false;
  /** Simulation speed shown to the player: Core plays idle animal calls at a
   * quarter of their volume at the highest speed (IdleCallVolumeFactor). */
  private speed = 1;
  private lastPose = '';
  private lastGain = -1;
  private playedOneShots = 0;
  private lastOneShotKind: string | null = null;
  /** Audio-clock time of the last start of each interface cue (burst spacing). */
  private readonly interfaceStarts = new Map<string, number>();
  /** A generic click waits for the end of the current task: a specific cue
   * requested by the same gesture (a tab, a toggle, a speed) replaces it. */
  private pendingGeneric: { kind: InterfaceCueKind; pitch: number } | null = null;

  constructor(manifestUrl = '/assets/audio/manifest.json') { this.manifestUrl = manifestUrl; }

  /** Call directly from a trusted pointer/keyboard gesture before any await. */
  unlock(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (typeof AudioContext === 'undefined') return Promise.reject(new Error('Web Audio is unavailable'));
    if (this.context?.state === 'closed') {
      this.stopPreview();
      this.previewOutput?.disconnect();
      this.previewOutput = null;
      for (const voice of [...this.voices]) this.stopVoice(voice);
      this.master?.disconnect();
      this.interfaceOutput?.disconnect();
      this.context = null;
      this.master = null;
      this.interfaceOutput = null;
      this.unlockPromise = null;
    }
    if (this.unlockPromise) {
      if (this.context && this.context.state !== 'running') {
        // Repeat directly in the new gesture if the device/browser suspended it.
        try {
          const resumed = this.context.resume();
          return Promise.all([resumed, this.unlockPromise]).then(() => {
            this.updateMaster();
            this.reconcileContinuous();
          });
        } catch (error) { return Promise.reject(error); }
      }
      return this.unlockPromise;
    }
    try {
      if (!this.context || this.context.state === 'closed') {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        this.context = context;
        this.master = master;
        this.lastGain = -1;
        this.lastPose = '';
      }
      // Resume is invoked synchronously while browser gesture activation exists.
      const resumed = this.context.resume();
      this.unlockPromise = Promise.resolve(resumed).then(async () => {
        if (!this.manifest) await this.loadAssets();
        if (this.loadedCount === 0) throw new Error(NO_DECODED_MP3_ERROR);
        this.updateListener();
        this.updateMaster();
        this.reconcileContinuous();
      }).catch(error => {
        this.unlockPromise = null; // A later gesture may retry autoplay or fetch failure.
        throw error;
      });
      return this.unlockPromise;
    } catch (error) {
      this.unlockPromise = null;
      return Promise.reject(error);
    }
  }

  updateCamera(camera: AudioCamera): void {
    if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.z)) return;
    this.camera = camera;
    this.updateListener();
    const pose = listenerPose(camera);
    const span = camera.span ?? 32;
    if (Math.hypot(pose.x - this.lastSelection.x, pose.y - this.lastSelection.y,
      pose.z - this.lastSelection.z) >= 4 ||
      span > this.lastSelection.span * 1.25 || span < this.lastSelection.span * 0.8) {
      this.lastSelection = { x: pose.x, y: pose.y, z: pose.z, span };
      this.reconcileContinuous();
    }
  }

  ingestCues(cues: readonly AudioCue[]): void { if (!this.disposed) this.scheduler.ingest(cues); }

  /** Gain offsets of the sounds page (public/assets/audio/gain-offsets.json),
   * read once at load. They multiply the manifest gains from the next sound;
   * a sound already playing keeps its level. */
  setGainOffsets(offsets: GainOffsets): void {
    if (this.disposed) return;
    this.gainOffsets = offsets;
    if (this.parsedManifest) this.manifest = applyManifestGainOffsets(this.parsedManifest, offsets);
  }

  private adoptManifest(parsed: AudioManifest): void {
    this.parsedManifest = parsed;
    this.manifest = applyManifestGainOffsets(parsed, this.gainOffsets);
  }

  /** Replaces the current list on snapshot adoption; no world scan on RAF. */
  setContinuousSources(sources: readonly ContinuousSource[]): void {
    if (this.disposed) return;
    this.continuousSources = sources.slice();
    this.reconcileContinuous();
  }

  /** Called once per presented frame, including frames with no new snapshot. */
  update(state: { presentedTick: number; paused: boolean; hidden: boolean; speed?: number }): void {
    if (this.disposed) return;
    if (state.speed !== undefined && Number.isFinite(state.speed)) this.speed = state.speed;
    const wasInactive = this.paused || this.hidden || this.muted;
    this.paused = state.paused;
    this.setHidden(state.hidden);
    this.updateMaster();
    const inactive = this.paused || this.hidden || this.muted;
    if (inactive && !wasInactive) {
      for (const [id, voice] of this.continuous) this.fadeOutContinuous(id, voice);
    } else if (!inactive && wasInactive) this.reconcileContinuous();
    const due = this.scheduler.takeDue(state.presentedTick);
    // Important messages are interface sounds: an automatic pause must not
    // defer a raid/death alert until the player resumes the simulation. They
    // share the interface output and its burst limits, paused or not.
    for (const cue of due) if (isWorldInterfaceCue(cue.kind)) this.playInterface(cue.kind as InterfaceCueKind);
    if (state.paused) return;
    if (state.hidden || this.muted || !this.manifest || this.context?.state !== 'running') return;
    const ready: AudioCue[] = [];
    for (const cue of due) {
      if (isWorldInterfaceCue(cue.kind)) continue;
      const playable = this.playableCue(cue);
      if (playable) ready.push(playable);
    }
    for (const cue of selectOneShots(ready, this.manifest.events, this.camera, MAX_ONE_SHOTS_PER_FRAME)) this.playCue(cue);
  }

  /** The cue itself, or the cue it refines when the manifest has no decoded
   * take for it (a specific drop, bench or weapon falls back on the plain one). */
  private playableCue(cue: AudioCue): AudioCue | undefined {
    const decoded = (kind: string) => this.manifest?.events[kind]?.variants.some(variant => this.buffers.get(variant.src));
    if (decoded(cue.kind)) return cue;
    const fallback = fallbackCue(cue.kind);
    return fallback && decoded(fallback) ? { ...cue, kind: fallback as AudioCue['kind'] } : undefined;
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.interfaceOutput) this.interfaceOutput.gain.value = this.muted || this.hidden ? 0 : MIX_GAIN * this.volume;
    if (this.previewOutput) this.previewOutput.gain.value = this.muted || this.hidden ? 0 : Math.min(8, MIX_GAIN * this.volume * (this.manifest?.events[PREVIEW_KIND]?.gain ?? 1) * (this.manifest?.events[PREVIEW_KIND]?.variants[0]?.gain ?? 1));
    this.updateMaster();
  }

  /** Visibility must silence audio even when the browser suspends RAF. */
  setHidden(hidden: boolean): void {
    if (this.disposed || this.hidden === hidden) return;
    this.hidden = hidden;
    this.updateMaster();
    if (this.interfaceOutput) this.interfaceOutput.gain.value = hidden || this.muted ? 0 : MIX_GAIN * this.volume;
    if (hidden) {
      this.stopPreview();
      for (const [id, voice] of this.continuous) this.fadeOutContinuous(id, voice);
    } else this.reconcileContinuous();
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (this.interfaceOutput) this.interfaceOutput.gain.value = muted || this.hidden ? 0 : MIX_GAIN * this.volume;
    if (muted) this.stopPreview();
    this.updateMaster();
    if (muted) {
      for (const [id, voice] of this.continuous) this.fadeOutContinuous(id, voice);
    } else this.reconcileContinuous();
  }

  get loadedCount(): number {
    let count = 0;
    for (const buffer of this.buffers.values()) if (buffer) count++;
    return count;
  }

  get availableSounds(): number {
    if (!this.manifest) return 0;
    return Object.values(this.manifest.events).filter(event =>
      event.variants.some(variant => this.buffers.get(variant.src))).length;
  }

  get needsUnlock(): boolean {
    return !this.context || this.context.state !== 'running' || !this.manifest && !this.unlockPromise;
  }

  /** Read only when diagnostics are visible; no per-frame audio graph scan. */
  get diagnostics(): { state: string; loaded: number; playedOneShots: number; lastKind: string | null } {
    return { state: this.context?.state ?? 'inactif', loaded: this.loadedCount,
      playedOneShots: this.playedOneShots, lastKind: this.lastOneShotKind };
  }

  /** A decoded interface sound can play during pause or from the title menu.
   * The caller's gesture unlocks audio separately; an unavailable asset is silent. */
  /** `pitch` scales the playback rate (the clock takes at each speed).
   * `generic`: a plain click from a control activation; it is deferred to the
   * end of the current task and dropped if the gesture asks a specific cue. */
  playInterface(kind: InterfaceCueKind, pitch = 1, generic = false): void {
    if (generic) {
      if (this.pendingGeneric) return;
      this.pendingGeneric = { kind, pitch };
      queueMicrotask(() => {
        const pending = this.pendingGeneric;
        this.pendingGeneric = null;
        if (pending) this.startInterface(pending.kind, pending.pitch);
      });
      return;
    }
    this.pendingGeneric = null;
    this.startInterface(kind, pitch);
  }

  /** Interface voices currently sounding, per cue (bounded by MAX_VOICES). */
  private interfaceVoices(kind?: string): number {
    let count = 0;
    for (const voice of this.voices) if (voice.interface && (kind === undefined || voice.kind === kind)) count++;
    return count;
  }

  private startInterface(kind: InterfaceCueKind, pitch: number): void {
    const context = this.context;
    const event = this.manifest?.events[kind];
    if (this.disposed || this.muted || this.hidden || this.volume === 0 ||
      !context || context.state !== 'running' || !event || event.loop || event.spatial || !event.gain) return;
    const available = event.variants.filter(variant => this.buffers.get(variant.src));
    if (!available.length) return;
    // Burst limits: a wave of alerts or letters in one frame sounds once.
    const rule = interfaceBurstRule(kind), now = context.currentTime, last = this.interfaceStarts.get(kind);
    if (last !== undefined && rule.spacing > 0 && now - last < rule.spacing) return;
    if (this.interfaceVoices(kind) >= rule.voices || this.interfaceVoices() >= MAX_INTERFACE_VOICES) return;
    let variantIndex = this.playedOneShots % available.length;
    if (available.length > 1 && available[variantIndex]!.src === this.lastPlayedVariantByKind.get(kind))
      variantIndex = (variantIndex + 1) % available.length;
    const variant = available[variantIndex]!;
    if (this.voices.size >= MAX_VOICES) {
      const loops = new Set(this.continuous.values());
      const victim = [...this.voices].find(voice => !loops.has(voice));
      if (!victim) return;
      this.stopVoice(victim);
    }
    let voice: Voice | null = null;
    try {
      if (!this.interfaceOutput) {
        const output = context.createGain();
        output.gain.value = MIX_GAIN * this.volume;
        output.connect(context.destination);
        this.interfaceOutput = output;
      }
      const source = context.createBufferSource();
      source.buffer = this.buffers.get(variant.src)!;
      const variation = cueVariation(`${kind}:${this.playedOneShots}`, kind);
      source.playbackRate.value = variation.playbackRate * (Number.isFinite(pitch) && pitch > 0 ? pitch : 1);
      const gain = context.createGain();
      gain.gain.value = Math.min(8, event.gain * variant.gain * variation.gain);
      source.connect(gain);
      // This separate output follows the SFX slider and mute immediately,
      // while the world master remains silent during a simulation pause.
      gain.connect(this.interfaceOutput);
      voice = { source, gain, panner: null, kind, variantGain: variant.gain, interface: true };
      const playingVoice = voice;
      source.onended = () => this.releaseVoice(playingVoice);
      this.voices.add(voice);
      source.start();
      this.interfaceStarts.set(kind, now);
      this.lastPlayedVariantByKind.set(kind, variant.src);
      this.playedOneShots++;
      this.lastOneShotKind = kind;
    } catch {
      if (voice) this.releaseVoice(voice);
    }
  }

  /** Plays a published MP3 from an explicit UI gesture, even while the simulation is paused. */
  playPreview(): Promise<void> {
    if (this.previewPromise) return this.previewPromise;
    if (this.hidden) return Promise.reject(new Error('L’essai sonore a été annulé.'));
    if (this.muted) return Promise.reject(new Error('Activez les effets sonores pour faire l’essai.'));
    if (this.volume === 0) return Promise.reject(new Error('Montez le volume des effets pour faire l’essai.'));
    // resume() is called synchronously while this gesture still has browser activation.
    const hadManifest = !!this.manifest;
    const unlocked = this.unlock();
    const preview = unlocked.catch(error => {
      // Only a decoded-asset failure can be recovered by this explicit click.
      if (!(error instanceof Error && error.message === NO_DECODED_MP3_ERROR && this.manifest &&
        (hadManifest || !this.manifest.events[PREVIEW_KIND]))) throw error;
    }).then(async () => {
      if (this.disposed || this.muted || this.hidden || this.volume === 0) throw new Error('L’essai sonore a été annulé.');
      if (!this.manifest?.events[PREVIEW_KIND]) await this.refreshManifestForPreview();
      const event = this.manifest?.events[PREVIEW_KIND];
      if (!event || event.loop || !event.variants.length) throw new Error('Le son d’essai est absent du manifeste audio.');
      const variant = event.variants[0]!;
      // Recover this explicit preview first; other unavailable sounds retry in
      // the background and cannot hold the audible confirmation behind them.
      const buffer = this.buffers.get(variant.src) ?? await this.fetchBuffer(variant.src, 'reload');
      if (buffer && !this.disposed) this.buffers.set(variant.src, buffer);
      void this.retryFailedAssets();
      if (!buffer) throw new Error(`Le MP3 d’essai ne peut pas être chargé ou décodé : ${variant.src}`);
      const context = this.context;
      if (!context || context.state !== 'running') throw new Error('Le navigateur n’a pas activé la sortie audio.');
      if (this.disposed || this.muted || this.hidden || this.volume === 0) throw new Error('L’essai sonore a été annulé.');
      if (!this.previewOutput) {
        this.previewOutput = context.createGain();
        this.previewOutput.connect(context.destination);
      }
      this.previewOutput.gain.value = Math.min(8, MIX_GAIN * this.volume * event.gain * variant.gain);
      this.stopPreview();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.previewOutput);
      this.previewSource = source;
      source.onended = () => {
        if (this.previewSource === source) this.previewSource = null;
        source.disconnect();
      };
      try { source.start(); }
      catch (error) { this.stopPreview(); throw error; }
    });
    this.previewPromise = preview.finally(() => { this.previewPromise = null; });
    return this.previewPromise;
  }

  /** Loading/new map must not inherit old queued or currently playing sounds. */
  reset(): void {
    this.scheduler.reset();
    this.lastPlayedVariantByKind.clear();
    this.interfaceStarts.clear();
    this.pendingGeneric = null;
    this.stopPreview();
    this.continuousSources = [];
    this.continuous.clear();
    for (const voice of [...this.voices]) this.stopVoice(voice);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const request of this.assetRequests) request.abort();
    for (const queued of this.queuedBuffers.splice(0)) queued();
    this.reset();
    this.buffers.clear();
    this.manifest = null;
    this.parsedManifest = null;
    this.previewOutput?.disconnect();
    this.previewOutput = null;
    this.master?.disconnect();
    this.master = null;
    this.interfaceOutput?.disconnect();
    this.interfaceOutput = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private async loadAssets(): Promise<void> {
    const context = this.context;
    if (!context) return;
    const manifest = await this.readManifest('no-cache');
    if (this.disposed) return;
    this.adoptManifest(manifest);
    const paths = [...new Set(Object.values(manifest.events).flatMap(event => event.variants.map(variant => variant.src)))];
    let next = 0;
    // Activate the mix as soon as one decoded asset is usable. A slow or
    // unavailable unrelated MP3 must not hold every sound behind a batch.
    let ready!: () => void;
    const firstReady = new Promise<void>(resolve => { ready = resolve; });
    const loading = Promise.all(Array.from({ length: Math.min(3, paths.length) }, async () => {
      while (next < paths.length && !this.disposed) {
        const src = paths[next++]!;
        const buffer = await this.fetchBuffer(src, 'force-cache');
        if (!this.disposed) {
          this.buffers.set(src, buffer);
          if (buffer) { ready(); this.reconcileContinuous(); }
        }
      }
    })).then(() => { ready(); });
    await firstReady;
    // Loading is bounded and fetchBuffer converts each asset failure to null.
    // Keep it alive in the background without an unhandled rejection.
    void loading;
    if (!this.disposed && this.loadedCount === 0) throw new Error(NO_DECODED_MP3_ERROR);
  }

  /** A preview click can recover a stale cached manifest without discarding loaded world sounds. */
  private async refreshManifestForPreview(): Promise<void> {
    const fresh = await this.readManifest('no-store');
    const preview = fresh.events[PREVIEW_KIND];
    if (!preview || preview.loop || !preview.variants.length)
      throw new Error('Le son d’essai est absent du manifeste audio.');
    if (this.disposed) return;
    this.adoptManifest(fresh);
  }

  private async fetchBuffer(src: string, cache: RequestCache): Promise<AudioBuffer | null> {
    const context = this.context;
    if (!context || this.disposed) return null;
    const decoded = this.buffers.get(src);
    if (decoded) return decoded;
    const existing = this.loadingBuffers.get(src);
    if (existing) return existing;
    const request = new Promise<AudioBuffer | null>(resolve => {
      const start = () => {
        if (this.disposed) { resolve(null); return; }
        this.activeBuffers++;
        void this.boundedAsset(async signal => {
          const file = await fetch(src, { cache, signal });
          if (!file.ok) throw new Error(`Audio asset HTTP ${file.status}`);
          return context.decodeAudioData(await file.arrayBuffer());
        }).catch(() => null).then(resolve).finally(() => {
          this.activeBuffers--;
          this.queuedBuffers.shift()?.();
        });
      };
      if (this.activeBuffers < 3) start(); else this.queuedBuffers.push(start);
    }).finally(() => { this.loadingBuffers.delete(src); });
    this.loadingBuffers.set(src, request);
    return request;
  }

  private readManifest(cache: RequestCache): Promise<AudioManifest> {
    return this.boundedAsset(async signal => {
      const response = await fetch(this.manifestUrl, { cache, signal });
      if (!response.ok) throw new Error(`Audio manifest HTTP ${response.status}`);
      return parseAudioManifest(await response.json());
    });
  }

  /** Includes response bodies and non-cancellable decoding in the deadline. */
  private async boundedAsset<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.assetRequests.add(controller);
    let timer!: ReturnType<typeof setTimeout>;
    const cancelled = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('Chargement audio interrompu.')), { once: true });
      timer = setTimeout(() => controller.abort(), 8_000);
    });
    try { return await Promise.race([operation(controller.signal), cancelled]); }
    finally { clearTimeout(timer); this.assetRequests.delete(controller); }
  }

  private async retryFailedAssets(): Promise<void> {
    if (!this.manifest) return;
    const paths = [...new Set(Object.values(this.manifest.events).flatMap(event =>
      event.variants.map(variant => variant.src)))].filter(src => !this.buffers.get(src));
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, paths.length) }, async () => {
      while (next < paths.length && !this.disposed) {
        const src = paths[next++]!;
        const buffer = await this.fetchBuffer(src, 'reload');
        if (!this.disposed) this.buffers.set(src, buffer);
      }
    }));
  }

  private stopPreview(): void {
    const source = this.previewSource;
    if (!source) return;
    this.previewSource = null;
    source.onended = null;
    try { source.stop(); } catch { /* It may have ended already. */ }
    source.disconnect();
  }

  private updateMaster(): void {
    const context = this.context; const master = this.master;
    if (!context || !master || context.state === 'closed') return;
    const desired = this.muted || this.paused || this.hidden ? 0 : MIX_GAIN * this.volume;
    if (desired === this.lastGain) return;
    this.lastGain = desired;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(desired, now, desired === 0 ? 0.035 : 0.06);
  }

  private updateListener(): void {
    const context = this.context;
    if (!context || context.state === 'closed') return;
    const pose = listenerPose(this.camera);
    const key = [pose.x, pose.y, pose.z, pose.forwardX, pose.forwardZ].map(value => value.toFixed(3)).join(',');
    if (key === this.lastPose) return;
    this.lastPose = key;
    const listener = context.listener;
    const now = context.currentTime;
    listener.positionX.setValueAtTime(pose.x, now);
    listener.positionY.setValueAtTime(pose.y, now);
    listener.positionZ.setValueAtTime(pose.z, now);
    listener.forwardX.setValueAtTime(pose.forwardX, now);
    listener.forwardY.setValueAtTime(0, now);
    listener.forwardZ.setValueAtTime(pose.forwardZ, now);
  }

  private playCue(cue: AudioCue): void {
    const context = this.context; const master = this.master;
    const event = this.manifest?.events[cue.kind];
    if (!context || !master || !event || event.loop || !event.gain) return;
    const group = clusterGroup(cue.kind);
    if (group) {
      // Repeated work or doors at one patch should not layer recordings.
      // The set is bounded by MAX_VOICES and checked only for due contacts.
      const cap = GROUP_VOICES[group] ?? MAX_CLUSTER_VOICES;
      let active = 0;
      for (const voice of this.voices) {
        if (clusterGroup(voice.kind) !== group) continue;
        if (++active >= cap) return;
        if (voice.x !== undefined && voice.z !== undefined &&
          Math.hypot(cue.x - voice.x, cue.z - voice.z) < CLUSTER_RADIUS) return;
      }
    }
    const pose = listenerPose(this.camera);
    const range = audibleRange(event.maxDistance, this.camera);
    if (event.spatial && sourceDistance(cue.x, cue.z, pose) >= range) return;
    const available = event.variants.filter(variant => this.buffers.get(variant.src));
    if (!available.length) return;
    let variantIndex = cueHash(cue.id) % available.length;
    if (available.length > 1 && available[variantIndex]!.src === this.lastPlayedVariantByKind.get(cue.kind))
      variantIndex = (variantIndex + 1) % available.length;
    const variant = available[variantIndex]!;
    const buffer = this.buffers.get(variant.src)!;
    if (this.voices.size >= MAX_VOICES) {
      const loops = new Set(this.continuous.values());
      const victim = [...this.voices].find(voice => !loops.has(voice));
      if (victim) this.stopVoice(victim);
      else return;
    }
    let voice: Voice | null = null;
    try {
      const source = context.createBufferSource(); source.buffer = buffer;
      const variation = cueVariation(cue.id, cue.kind);
      const pitch = Number.isFinite(cue.pitch) ? Math.max(0.25, Math.min(4, cue.pitch!)) : 1;
      source.playbackRate.value = variation.playbackRate * pitch;
      const panner = event.spatial ? context.createPanner() : null;
      if (panner) {
        panner.panningModel = 'equalpower';
        panner.distanceModel = 'exponential';
        panner.refDistance = SPATIAL_REF_DISTANCE;
        panner.maxDistance = range;
        panner.rolloffFactor = SPATIAL_ROLLOFF;
        panner.positionX.value = cue.x;
        panner.positionY.value = 0;
        panner.positionZ.value = cue.z;
      }
      const gain = context.createGain();
      const intensity = Number.isFinite(cue.intensity) ? Math.max(0, Math.min(2, cue.intensity!)) : 1;
      const idleCall = cue.kind.startsWith('animal.call.') && this.speed >= 6 ? 0.25 : 1;
      gain.gain.value = Math.min(8, event.gain * variant.gain * intensity * idleCall * variation.gain);
      if (panner) { source.connect(panner); panner.connect(gain); }
      else source.connect(gain);
      gain.connect(master);
      voice = { source, panner, gain, kind: cue.kind, variantGain: variant.gain, x: cue.x, z: cue.z };
      const playingVoice = voice;
      source.onended = () => this.releaseVoice(playingVoice);
      this.voices.add(voice);
      source.start();
      this.lastPlayedVariantByKind.set(cue.kind, variant.src);
      this.playedOneShots++;
      this.lastOneShotKind = cue.kind;
    } catch {
      if (voice) this.releaseVoice(voice);
      // A decoding/device failure is silent and never affects the game.
    }
  }

  private stopVoice(voice: Voice): void {
    try { voice.source.stop(); } catch { /* Source may have already ended. */ }
    this.releaseVoice(voice);
  }

  private releaseVoice(voice: Voice): void {
    if (!this.voices.delete(voice)) return;
    for (const [id, active] of this.continuous) if (active === voice) this.continuous.delete(id);
    voice.source.onended = null;
    voice.source.disconnect();
    voice.panner?.disconnect();
    voice.gain.disconnect();
  }

  private reconcileContinuous(): void {
    const context = this.context; const master = this.master; const manifest = this.manifest;
    if (this.disposed || this.paused || this.hidden || this.muted || !context || !master || !manifest || context.state !== 'running') return;
    const selected = selectContinuousSources(this.continuousSources, manifest.events, this.camera);
    const selectedIds = new Set(selected.map(source => source.id));
    for (const [id, voice] of this.continuous) {
      if (!selectedIds.has(id)) this.fadeOutContinuous(id, voice);
    }
    for (const source of selected) {
      const event = manifest.events[source.kind]!;
      const existing = this.continuous.get(source.id);
      if (existing && existing.kind !== source.kind) this.fadeOutContinuous(source.id, existing);
      else if (existing) {
        if (existing.panner) {
          existing.panner.positionX.value = source.x;
          existing.panner.positionZ.value = source.z;
          existing.panner.maxDistance = audibleRange(event.maxDistance, this.camera);
        }
        existing.gain.gain.setTargetAtTime(this.continuousLevel(event, source) * existing.variantGain, context.currentTime, 0.12);
        continue;
      }
      const available = event.variants.filter(variant => this.buffers.get(variant.src));
      if (!available.length) continue;
      const variant = available[cueHash(source.id) % available.length]!;
      const buffer = this.buffers.get(variant.src)!;
      if (this.voices.size >= MAX_VOICES) {
        const victim = this.voices.values().next().value as Voice | undefined;
        if (victim) this.stopVoice(victim);
      }
      let voice: Voice | null = null;
      try {
        const node = context.createBufferSource();
        node.buffer = buffer;
        node.loop = true;
        const panner = event.spatial ? context.createPanner() : null;
        if (panner) {
          panner.panningModel = 'equalpower';
          panner.distanceModel = 'exponential';
          panner.refDistance = SPATIAL_REF_DISTANCE;
          panner.maxDistance = audibleRange(event.maxDistance, this.camera);
          panner.rolloffFactor = SPATIAL_ROLLOFF;
          panner.positionX.value = source.x;
          panner.positionY.value = 0;
          panner.positionZ.value = source.z;
        }
        const gain = context.createGain();
        gain.gain.value = 0;
        if (panner) { node.connect(panner); panner.connect(gain); }
        else node.connect(gain);
        gain.connect(master);
        voice = { source: node, panner, gain, kind: source.kind, variantGain: variant.gain };
        const playingVoice = voice;
        node.onended = () => this.releaseVoice(playingVoice);
        this.voices.add(voice);
        this.continuous.set(source.id, voice);
        node.start();
        gain.gain.setTargetAtTime(this.continuousLevel(event, source) * variant.gain, context.currentTime, 0.12);
      } catch {
        if (voice) {
          this.continuous.delete(source.id);
          this.releaseVoice(voice);
        }
        // Missing device/asset leaves game state untouched.
      }
    }
  }

  private continuousLevel(event: SoundEvent, source: ContinuousSource): number {
    const gain = Number.isFinite(source.gain) ? Math.max(0, Math.min(2, source.gain!)) : 1;
    return Math.min(2, event.gain * gain);
  }

  private fadeOutContinuous(id: string, voice: Voice): void {
    this.continuous.delete(id);
    const context = this.context;
    if (!context || context.state === 'closed') { this.stopVoice(voice); return; }
    voice.gain.gain.cancelScheduledValues(context.currentTime);
    voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
    try { voice.source.stop(context.currentTime + 0.45); } catch { this.releaseVoice(voice); }
  }
}
