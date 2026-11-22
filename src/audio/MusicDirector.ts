/** Long music is streamed by the browser, outside the decoded SFX pool. */
import { emptyGainOffsets, musicTrackGain, type GainOffsets } from './gain-offsets';

export type MusicMood = 'day' | 'night' | 'tension';

export interface MusicTrack {
  id: string;
  src: string;
  mood: MusicMood;
  /** Per-master balance, applied after the independent music slider. */
  gain: number;
}

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: 'aube', src: '/assets/audio/music/lisiere-aube-v1.mp3', mood: 'day', gain: 0.40 },
  { id: 'clairiere', src: '/assets/audio/music/lisiere-clairiere-v175.mp3', mood: 'day', gain: 0.637 },
  { id: 'atelier', src: '/assets/audio/music/lisiere-atelier-v175.mp3', mood: 'day', gain: 0.494 },
  { id: 'sentier', src: '/assets/audio/music/lisiere-sentier-v175.mp3', mood: 'day', gain: 0.593 },
  { id: 'veille', src: '/assets/audio/music/lisiere-veille-v1.mp3', mood: 'night', gain: 0.75 },
  { id: 'lucioles', src: '/assets/audio/music/lisiere-lucioles-v175.mp3', mood: 'night', gain: 0.742 },
  { id: 'brume', src: '/assets/audio/music/lisiere-brume-v175.mp3', mood: 'night', gain: 0.554 },
  { id: 'constellations', src: '/assets/audio/music/lisiere-constellations-v175.mp3', mood: 'night', gain: 0.405 },
  { id: 'alerte', src: '/assets/audio/music/lisiere-alerte-v1.mp3', mood: 'tension', gain: 0.32 },
  { id: 'veilleurs', src: '/assets/audio/music/lisiere-veilleurs-v175.mp3', mood: 'tension', gain: 1.102 },
];

/** Choose only the requested family. Recent history is per family; on a small
 * custom catalogue, the least recently heard title is the safe fallback. */
export function chooseMusicTrack(mood: MusicMood, previousId: string | null,
  tracks: readonly MusicTrack[] = MUSIC_TRACKS, recentIds: readonly string[] = [],
  rotation = 0): MusicTrack | null {
  const eligible = tracks.filter(track => track.mood === mood);
  if (!eligible.length) return null;
  const history = recentIds.length ? recentIds : previousId ? [previousId] : [];
  const recent = history.slice(-3);
  const fresh = eligible.filter(track => !recent.includes(track.id));
  const pool = fresh.length ? fresh : eligible.filter(track => track.id !== previousId);
  if (!pool.length) return eligible[0]!;
  // Never-heard titles precede older ones; rotation breaks ties. This covers
  // the whole family before revisiting a title, while excluding the last 3.
  const oldestIndex = Math.min(...pool.map(track => history.indexOf(track.id)));
  const oldest = pool.filter(track => history.indexOf(track.id) === oldestIndex);
  return oldest[((rotation % oldest.length) + oldest.length) % oldest.length]!;
}

interface Playback { track: MusicTrack; audio: HTMLAudioElement }
const MUSIC_GAIN = 0.36;
/** Element volume of a title: slider × music mix × its balance × the sounds
 * page offset, at most 1 (an HTMLMediaElement refuses a louder volume). */
export function musicLevel(volume: number, track: MusicTrack, offsets: GainOffsets): number {
  return Math.min(1, volume * MUSIC_GAIN * musicTrackGain(track, offsets));
}
const FADE_MS = 3600;
const TENSION_RELEASE_MS = 8000;
const RETRY_MS = 15000;
const START_TIMEOUT_MS = 20000;
const CALM_GAPS_MS = [24000, 37000, 29000] as const;
const MOODS: readonly MusicMood[] = ['day', 'night', 'tension'];

export class MusicDirector {
  private mood: MusicMood = 'day';
  private active: Playback | null = null;
  private retiring: Playback | null = null;
  private pending: Playback | null = null;
  private readonly recent: Record<MusicMood, string[]> = { day: [], night: [], tension: [] };
  private readonly rotation: Record<MusicMood, number> = { day: 0, night: 0, tension: 0 };
  private readonly failed: Record<MusicMood, Set<string>> = {
    day: new Set(), night: new Set(), tension: new Set(),
  };
  private volume = 0.5;
  private enabled = true;
  private hidden = false;
  private started = false;
  private disposed = false;
  private playedCount = 0;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private gapKind: 'normal' | 'retry' | null = null;
  private tensionReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeStart = 0;
  private oldFadeBase = 1;
  private gainOffsets: GainOffsets = emptyGainOffsets();

  constructor(private readonly tracks: readonly MusicTrack[] = MUSIC_TRACKS,
    private readonly createAudio: () => HTMLAudioElement = () => new Audio()) {}

  /** Call synchronously from a trusted pointer or keyboard gesture. */
  unlock(): void {
    if (this.disposed || !this.enabled || this.hidden || this.volume === 0) return;
    this.started = true;
    if (this.active) {
      if (this.active.audio.paused && this.active.track.mood !== this.mood && !this.tensionReleaseTimer) {
        this.release(this.active);
        this.active = null;
      } else if (this.active.audio.paused) {
        const playback = this.active;
        playback.audio.volume = this.levelFor(playback.track);
        try { void playback.audio.play().catch(() => this.onResumeFailure(playback)); }
        catch { this.onResumeFailure(playback); }
        return;
      } else return;
    }
    // Frequent pointer gestures must not shorten the intentional silence
    // after a completed title. An error backoff can retry on a new gesture.
    if (this.gapKind === 'normal') return;
    if (this.gapKind === 'retry') this.clearGap();
    const familySize = this.tracks.filter(track => track.mood === this.mood).length;
    if (!this.pending && familySize > 0 && this.failed[this.mood].size >= familySize) {
      this.failed[this.mood].clear();
    }
    this.startSelected();
  }

  setMood(mood: MusicMood): void {
    if (this.mood === mood) return;
    const former = this.mood;
    this.mood = mood;
    if (this.tensionReleaseTimer) {
      clearTimeout(this.tensionReleaseTimer);
      this.tensionReleaseTimer = null;
    }
    if (!this.started || !this.enabled || this.hidden || this.volume === 0) return;
    if (this.pending && this.pending.track.mood !== mood) this.cancelPending();
    if (mood !== 'tension' && this.active?.track.mood === 'tension') {
      this.tensionReleaseTimer = setTimeout(() => {
        this.tensionReleaseTimer = null;
        this.clearGap();
        this.startSelected();
      }, TENSION_RELEASE_MS);
      return;
    }
    if (this.active?.track.mood === mood) return;
    if (mood === 'tension' || former === 'tension' || !this.active) {
      this.clearGap();
      this.startSelected();
    }
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    const wasSilent = this.volume === 0;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.volume === 0) this.suspend();
    else if (wasSilent && this.started && this.enabled && !this.hidden) this.unlock();
    else this.updateVolumes();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.suspend();
    else if (this.started) this.unlock();
  }

  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    if (hidden) this.suspend();
    else if (this.started) this.unlock();
  }

  /** Gain offsets of the sounds page, read once at load; a title playing
   * takes its new level at once. */
  setGainOffsets(offsets: GainOffsets): void {
    this.gainOffsets = offsets;
    if (this.active || this.retiring) this.updateVolumes();
  }

  get diagnostics(): { state: string; track: string | null } {
    return {
      state: !this.enabled ? 'coupée' : this.hidden ? 'masquée' : this.active?.audio.paused ? 'en pause'
        : this.active ? 'active' : this.pending ? 'chargement' : 'attente',
      track: this.active?.track.id ?? null,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearGap();
    this.clearFade();
    this.clearTensionRelease();
    this.cancelPending();
    this.release(this.active);
    this.release(this.retiring);
    this.active = this.retiring = null;
  }

  private levelFor(track: MusicTrack): number { return musicLevel(this.volume, track, this.gainOffsets); }

  private startSelected(): void {
    if (this.pending || this.disposed || !this.started || !this.enabled || this.hidden || this.volume === 0) return;
    this.clearGap();
    if (this.retiring) {
      this.clearFade();
      // Keep the louder side of an interrupted fade. The next load still
      // creates at most one additional element, without a sudden quiet dip.
      if (this.active && this.retiring.audio.volume > this.active.audio.volume) {
        this.release(this.active);
        this.active = this.retiring;
      } else this.release(this.retiring);
      this.retiring = null;
    }
    const available = this.tracks.filter(track => !this.failed[this.mood].has(track.id));
    const history = this.recent[this.mood];
    const track = chooseMusicTrack(this.mood, history.at(-1) ?? null, available,
      history, this.rotation[this.mood]);
    if (!track) {
      this.scheduleRetry();
      return;
    }
    let audio: HTMLAudioElement;
    try { audio = this.createAudio(); }
    catch { this.onStartFailure(track); return; }
    const playback = { track, audio };
    this.pending = playback;
    audio.onerror = () => this.onAudioError(playback);
    audio.preload = 'auto';
    audio.src = track.src;
    audio.loop = false;
    audio.volume = 0;
    // play() remains synchronous with the initiating gesture where possible.
    try {
      void audio.play().then(() => this.onStarted(playback), () => this.onFailed(playback));
      this.loadTimer = setTimeout(() => this.onFailed(playback), START_TIMEOUT_MS);
    } catch { this.onFailed(playback); }
  }

  private onStarted(playback: Playback): void {
    if (this.pending !== playback) return;
    this.pending = null;
    this.clearLoadTimeout();
    if (this.disposed || !this.enabled || this.hidden || this.volume === 0 ||
      playback.track.mood !== this.mood) {
      this.release(playback);
      if (!this.disposed && this.enabled && !this.hidden) this.startSelected();
      return;
    }
    this.clearFade();
    this.release(this.retiring);
    this.retiring = this.active;
    this.active = playback;
    const history = this.recent[playback.track.mood];
    const previousIndex = history.indexOf(playback.track.id);
    if (previousIndex >= 0) history.splice(previousIndex, 1);
    history.push(playback.track.id);
    const familySize = this.tracks.filter(track => track.mood === playback.track.mood).length;
    if (history.length > familySize) history.shift();
    this.rotation[playback.track.mood]++;
    this.playedCount++;
    playback.audio.onended = () => this.onEnded(playback);
    this.startFade();
  }

  private onFailed(playback: Playback): void {
    if (this.pending !== playback) return;
    this.pending = null;
    this.clearLoadTimeout();
    this.release(playback);
    this.onStartFailure(playback.track);
  }

  private onStartFailure(track: MusicTrack): void {
    if (this.disposed || !this.enabled || this.hidden) return;
    this.failed[track.mood].add(track.id);
    // Try another file promptly, but back off once the whole family failed.
    this.startSelected();
  }

  private onResumeFailure(playback: Playback): void {
    if (this.active !== playback) return;
    this.release(playback);
    this.active = null;
    this.onStartFailure(playback.track);
  }

  private onAudioError(playback: Playback): void {
    if (this.pending === playback) {
      this.onFailed(playback);
      return;
    }
    if (this.retiring === playback) {
      this.release(playback);
      this.retiring = null;
      this.clearFade();
      if (this.active) this.active.audio.volume = this.levelFor(this.active.track);
      return;
    }
    if (this.active !== playback) return;
    this.clearTensionRelease();
    this.clearFade();
    this.release(playback);
    // A still-audible outgoing title bridges the replacement when available.
    this.active = this.retiring;
    this.retiring = null;
    if (this.active) this.active.audio.volume = this.levelFor(this.active.track);
    this.onStartFailure(playback.track);
  }

  private onEnded(playback: Playback): void {
    if (this.active !== playback) return;
    this.failed[playback.track.mood].clear();
    this.release(playback);
    this.active = null;
    this.clearFade();
    this.release(this.retiring);
    this.retiring = null;
    this.clearTensionRelease();
    if (!this.enabled || this.hidden || this.disposed) return;
    if (this.pending) return;
    const gap = this.mood === 'tension' ? 7000 : CALM_GAPS_MS[this.playedCount % CALM_GAPS_MS.length]!;
    this.gapKind = 'normal';
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null;
      this.gapKind = null;
      this.startSelected();
    }, gap);
  }

  private startFade(): void {
    if (!this.active) return;
    this.fadeStart = performance.now();
    this.oldFadeBase = this.retiring
      ? this.retiring.audio.volume / Math.max(this.levelFor(this.retiring.track), Number.EPSILON)
      : 1;
    this.active.audio.volume = 0;
    this.fadeTimer = setInterval(() => {
      this.updateVolumes();
      if (performance.now() - this.fadeStart >= FADE_MS) {
        this.clearFade();
        this.release(this.retiring);
        this.retiring = null;
      }
    }, 80);
  }

  private updateVolumes(): void {
    const fraction = this.fadeTimer === null ? 1 : Math.min(1, (performance.now() - this.fadeStart) / FADE_MS);
    if (this.active) this.active.audio.volume = this.levelFor(this.active.track) * fraction;
    if (this.retiring) this.retiring.audio.volume = this.levelFor(this.retiring.track) * this.oldFadeBase * (1 - fraction);
  }

  private scheduleRetry(): void {
    this.clearGap();
    this.gapKind = 'retry';
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null;
      this.gapKind = null;
      for (const mood of MOODS) this.failed[mood].clear();
      this.startSelected();
    }, RETRY_MS);
  }

  private suspend(): void {
    this.clearGap();
    this.clearFade();
    this.clearTensionRelease();
    this.cancelPending();
    this.active?.audio.pause();
    this.release(this.retiring);
    this.retiring = null;
  }

  private cancelPending(): void {
    const pending = this.pending;
    this.pending = null;
    this.clearLoadTimeout();
    this.release(pending);
  }

  private clearLoadTimeout(): void {
    if (this.loadTimer !== null) clearTimeout(this.loadTimer);
    this.loadTimer = null;
  }

  private clearFade(): void {
    if (this.fadeTimer !== null) clearInterval(this.fadeTimer);
    this.fadeTimer = null;
  }

  private clearGap(): void {
    if (this.gapTimer !== null) clearTimeout(this.gapTimer);
    this.gapTimer = null;
    this.gapKind = null;
  }

  private clearTensionRelease(): void {
    if (this.tensionReleaseTimer !== null) clearTimeout(this.tensionReleaseTimer);
    this.tensionReleaseTimer = null;
  }

  private release(playback: Playback | null): void {
    if (!playback) return;
    playback.audio.onended = null;
    playback.audio.onerror = null;
    playback.audio.pause();
    playback.audio.removeAttribute('src');
    playback.audio.load();
  }
}
