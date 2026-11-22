export interface AudioCue {
  /** Stable identity of this occurrence, including across repeated snapshots. */
  id: string;
  tick: number;
  kind: string;
  x: number;
  z: number;
  intensity?: number;
  /** Playback-rate factor (a young animal's voice, a lower great bow). */
  pitch?: number;
}

const MAX_PENDING = 256;
const MAX_SEEN = 1024;
const RETAIN_TICKS = 12;
const isCritical = (kind: string): boolean => kind === 'ui.threat' || kind === 'ui.colonist-death' || kind === 'ui.colonist-downed';

/** Presentation-only queue. The worker may publish the same cue more than once. */
export class AudioCueScheduler {
  private pending: AudioCue[] = [];
  private seen = new Map<string, number>();
  // Severe events are rare and must not replay after the ordinary cue cache ages out.
  private criticalSeen = new Set<string>();
  private presentedTick = -Infinity;
  private lastPruneTick = -Infinity;

  ingest(cues: readonly AudioCue[]): void {
    for (const cue of cues) {
      if (!cue.id || !cue.kind || !Number.isFinite(cue.tick) ||
        !Number.isFinite(cue.x) || !Number.isFinite(cue.z) || this.seen.has(cue.id)
        || this.criticalSeen.has(cue.id)) continue;
      if (cue.tick < this.presentedTick - RETAIN_TICKS && !isCritical(cue.kind)) continue;
      // A busy worker may fill the queue with local contacts before an alert
      // arrives. Keep the newest critical signal through presentation.
      if (this.pending.length >= MAX_PENDING && isCritical(cue.kind)) {
        const displaced = this.pending.findIndex(pending => !isCritical(pending.kind));
        this.pending.splice(displaced < 0 ? 0 : displaced, 1);
      }
      // Binary insertion leaves frame updates proportional only to due cues.
      let low = 0; let high = this.pending.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (this.pending[mid]!.tick <= cue.tick) low = mid + 1;
        else high = mid;
      }
      if (low >= MAX_PENDING) continue;
      this.pending.splice(low, 0, cue);
      if (this.pending.length > MAX_PENDING) this.pending.pop();
      this.seen.set(cue.id, cue.tick);
      if (isCritical(cue.kind)) this.criticalSeen.add(cue.id);
      if (this.seen.size > MAX_SEEN) this.pruneSeen();
    }
  }

  /** Recovers one missed contact on short frame jumps; drops stale bursts after stalls. */
  takeDue(presentedTick: number, maxLateTicks = 2): AudioCue[] {
    if (!Number.isFinite(presentedTick)) return [];
    if (presentedTick < this.presentedTick - 0.01) this.reset();
    this.presentedTick = presentedTick;
    let end = 0;
    while (end < this.pending.length && this.pending[end]!.tick <= presentedTick) end++;
    const drained = this.pending.splice(0, end);
    const due: AudioCue[] = [];
    let latestMissed: AudioCue | undefined;
    for (const cue of drained) {
      if (isCritical(cue.kind) || cue.tick >= presentedTick - maxLateTicks) due.push(cue);
      else if (cue.tick >= presentedTick - RETAIN_TICKS) latestMissed = cue;
    }
    // A low-FPS frame or accelerated game may cross many ticks. One recent
    // contact is enough to signal ongoing work; never replay its whole backlog.
    if (!due.length && latestMissed) due.push(latestMissed);
    if (presentedTick - this.lastPruneTick >= RETAIN_TICKS || this.seen.size > MAX_SEEN) {
      this.pruneSeen();
      this.lastPruneTick = presentedTick;
    }
    return due;
  }

  reset(): void {
    this.pending.length = 0;
    this.seen.clear();
    this.criticalSeen.clear();
    this.presentedTick = -Infinity;
    this.lastPruneTick = -Infinity;
  }

  get pendingCount(): number { return this.pending.length; }

  private pruneSeen(): void {
    for (const [id, tick] of this.seen) {
      if (tick < this.presentedTick - RETAIN_TICKS || this.seen.size > MAX_SEEN) this.seen.delete(id);
    }
  }
}
