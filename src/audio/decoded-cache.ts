/* Decoded takes held by the AudioDirector (game sounds of 22 November 2026,
 * docs/development/audio-coverage-20261122.md, « Décodage à la demande »).
 * A decoded take is raw PCM: 48 kHz stereo float costs 384 KB per second,
 * about twenty times its MP3. Only a warm set is decoded at load and pinned;
 * every other take is decoded at its first need and kept in least-recently-used
 * order under a byte budget; a take still sounding is evicted last. */

export interface DecodedBuffer { readonly length: number; readonly numberOfChannels: number }

/** Bytes of decoded PCM held by one buffer (32-bit float per sample and channel). */
export const decodedBytes = (buffer: DecodedBuffer): number => {
  const bytes = buffer.length * buffer.numberOfChannels * 4;
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
};

/** 32 MiB ≈ 87 s of 48 kHz stereo float. It holds the warm set decoded at load
 * (31 MB, of which the pinned first takes are 10 MB), then makes room as the
 * game needs it: the four loops that can sound at once (3 to 4 MB each) and the
 * world takes heard recently push out the least recently used second and third
 * takes. Decoding every take held 81 MB before the game sounds of 22 November
 * and 193 MB with them. */
export const DECODED_BUDGET_BYTES = 32 * 1024 * 1024;

/** The world contacts heard most often in any colony (Les Forges recorder:
 * harvest, sowing, drops, pickups, doors and construction lead the counts). */
const WARM_WORLD: ReadonlySet<string> = new Set(['mining.hit', 'construction.hit', 'haul.pickup', 'haul.drop',
  'farming.sow', 'farming.harvest', 'eating.work', 'door.open', 'door.close']);

/** Decoded at load: every interface sound (gestures, letters, alerts, the
 * tutorial: non-spatial one-shots, thunder aside) and the most frequent foley.
 * 43 sounds, 136 takes, 31 MB; the first take of each, 10 MB, is pinned. */
export function warmKind(kind: string, event: { readonly loop: boolean; readonly spatial?: boolean }): boolean {
  if (event.loop) return false;
  if (event.spatial === false && !kind.startsWith('weather.')) return true;
  return WARM_WORLD.has(kind);
}

export class DecodedCache<T extends DecodedBuffer> {
  /** Insertion order is the recency order: the first entry is the least recent. */
  private readonly entries = new Map<string, T | null>();
  private readonly pinned = new Set<string>();
  private held = 0;

  constructor(readonly budget: number, private readonly inUse: (buffer: T) => boolean = () => false) {}

  /** The decoded buffer, null after a failed decode, undefined when never decoded. */
  get(src: string): T | null | undefined { return this.entries.get(src); }

  /** Marks a take as just used (most recent) and returns it. */
  use(src: string): T | undefined {
    const buffer = this.entries.get(src);
    if (!buffer) return undefined;
    this.entries.delete(src);
    this.entries.set(src, buffer);
    return buffer;
  }

  /** Pinned takes are never evicted (the warm set). */
  pin(src: string): void { this.pinned.add(src); }
  isPinned(src: string): boolean { return this.pinned.has(src); }

  set(src: string, buffer: T | null): void {
    const previous = this.entries.get(src);
    if (previous) this.held -= decodedBytes(previous);
    this.entries.delete(src);
    this.entries.set(src, buffer);
    if (buffer) this.held += decodedBytes(buffer);
    this.evict(src);
  }

  /** Least recently used first, takes not sounding before sounding ones;
   * never a pinned take nor `keep` (the take just decoded). A sounding take
   * dropped here keeps playing: its node holds it until it ends, and the cache
   * decodes it again at its next need. */
  evict(keep?: string): void {
    for (const sounding of [false, true]) for (const [src, buffer] of this.entries) {
      if (this.held <= this.budget) return;
      if (!buffer || src === keep || this.pinned.has(src) || this.inUse(buffer) !== sounding) continue;
      this.entries.delete(src);
      this.held -= decodedBytes(buffer);
    }
  }

  get bytes(): number { return this.held; }
  get count(): number { let count = 0; for (const buffer of this.entries.values()) if (buffer) count++; return count; }
  values(): IterableIterator<T | null> { return this.entries.values(); }
  clear(): void { this.entries.clear(); this.pinned.clear(); this.held = 0; }
}
