/* Manual gain adjustments of the sounds page (sounds-review.html, see
 * docs/development/audio-coverage-20261122.md « Réglages manuels »).
 * One JSON in the repository, public/assets/audio/gain-offsets.json, holds
 * offsets in decibels per sound event, per take (variant src) and per music
 * track. The game reads it once at load and multiplies the manifest and music
 * gains; nothing is saved in a colony. Presentation only.
 * Keep this module free of browser globals: the dev server plugin imports it. */
import type { AudioManifest } from './AudioDirector.ts';

export const GAIN_OFFSET_MIN_DB = -30;
export const GAIN_OFFSET_MAX_DB = 12;
/** Served path the game and the page read. */
export const GAIN_OFFSETS_URL = '/assets/audio/gain-offsets.json';
/** Repository path the dev server writes (the only file it may write). */
export const GAIN_OFFSETS_FILE = 'public/assets/audio/gain-offsets.json';
/** Dev-server-only endpoint of « Enregistrer » (scripts/vite-dev-audio-gain-offsets.ts). */
export const GAIN_OFFSETS_ENDPOINT = '/__elsewhere/audio-gain-offsets';
/** Response header that tells the page the dev endpoint answered. */
export const GAIN_OFFSETS_ENDPOINT_HEADER = 'x-elsewhere-gain-offsets';
const MAX_ENTRIES = 2000;

export interface GainOffsets {
  version: 1;
  /** Sound event (manifest key) → dB. */
  events: Record<string, number>;
  /** Take (manifest variant src) → dB. */
  variants: Record<string, number>;
  /** Music track id → dB. */
  music: Record<string, number>;
}

export function emptyGainOffsets(): GainOffsets {
  return { version: 1, events: Object.create(null), variants: Object.create(null), music: Object.create(null) };
}

const SECTIONS = ['events', 'variants', 'music'] as const;
type Section = typeof SECTIONS[number];
const KEY_RULES: Record<Section, (key: string) => boolean> = {
  events: key => key.length <= 80 && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(key),
  variants: key => key.length <= 200 && key.startsWith('/assets/audio/') && /^[A-Za-z0-9/._-]+$/.test(key) && !key.includes('..'),
  music: key => key.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key),
};

export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (gain: number): number => 20 * Math.log10(gain);

/** Bounds an offset and rounds it to a tenth of a decibel. */
export function clampOffsetDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  const rounded = Math.round(Math.max(GAIN_OFFSET_MIN_DB, Math.min(GAIN_OFFSET_MAX_DB, db)) * 10) / 10;
  return rounded === 0 ? 0 : rounded; // No negative zero in the file.
}

/** A base gain with its offset, kept under the manifest ceiling of the event
 * (2 for a loop, 8 otherwise, as parseAudioManifest). */
export function offsetGain(base: number, db: number | undefined, ceiling: number): number {
  return db ? Math.min(ceiling, base * dbToGain(clampOffsetDb(db))) : base;
}

/** Lenient reader used by the game: a malformed entry is ignored, a value out
 * of bounds is clamped, a missing or broken file means no adjustment. */
export function parseGainOffsets(input: unknown): GainOffsets {
  const offsets = emptyGainOffsets();
  if (!input || typeof input !== 'object' || Array.isArray(input) || (input as { version?: unknown }).version !== 1) return offsets;
  let entries = 0;
  for (const section of SECTIONS) {
    const raw = (input as Record<string, unknown>)[section];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    for (const [key, value] of Object.entries(raw)) {
      if (entries >= MAX_ENTRIES || !KEY_RULES[section](key) || typeof value !== 'number') continue;
      const db = clampOffsetDb(value);
      if (db !== 0) { offsets[section][key] = db; entries++; }
    }
  }
  return offsets;
}

/** Strict reader used before writing the file: anything outside the format or
 * the bounds is refused with a French message, nothing is silently changed. */
export function validateGainOffsets(input: unknown): GainOffsets {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Le réglage doit être un objet JSON.');
  const source = input as Record<string, unknown>;
  if (source.version !== 1) throw new Error('Version de réglage inconnue (1 attendue).');
  for (const key of Object.keys(source)) if (key !== 'version' && !(SECTIONS as readonly string[]).includes(key)) throw new Error(`Champ inconnu : ${key}.`);
  const offsets = emptyGainOffsets();
  let entries = 0;
  for (const section of SECTIONS) {
    const raw = source[section];
    if (raw === undefined) continue;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`« ${section} » doit être un objet.`);
    for (const [key, value] of Object.entries(raw)) {
      if (!KEY_RULES[section](key)) throw new Error(`Clé refusée dans « ${section} » : ${key}.`);
      if (typeof value !== 'number' || !Number.isFinite(value) || value < GAIN_OFFSET_MIN_DB || value > GAIN_OFFSET_MAX_DB)
        throw new Error(`Valeur hors limites pour ${key} (${GAIN_OFFSET_MIN_DB} à +${GAIN_OFFSET_MAX_DB} dB).`);
      if (++entries > MAX_ENTRIES) throw new Error('Trop de réglages.');
      const db = clampOffsetDb(value);
      if (db !== 0) offsets[section][key] = db;
    }
  }
  return offsets;
}

/** Canonical text of the file: sorted keys, zeros dropped, one final newline. */
export function serializeGainOffsets(offsets: GainOffsets): string {
  const sorted = (record: Record<string, number>): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const key of Object.keys(record).sort()) { const db = clampOffsetDb(record[key]!); if (db !== 0) result[key] = db; }
    return result;
  };
  return `${JSON.stringify({ version: 1, events: sorted(offsets.events), variants: sorted(offsets.variants), music: sorted(offsets.music) }, null, 2)}\n`;
}

export function countGainOffsets(offsets: GainOffsets): number {
  return SECTIONS.reduce((count, section) => count + Object.keys(offsets[section]).length, 0);
}

/** The manifest the game plays: event and take gains times their offsets,
 * under the same ceilings as the manifest reader. A new object; the parsed
 * manifest stays untouched so the offsets can be replaced later. */
export function applyManifestGainOffsets(manifest: AudioManifest, offsets: GainOffsets): AudioManifest {
  if (countGainOffsets(offsets) === 0) return manifest;
  const events: AudioManifest['events'] = Object.create(null);
  for (const [kind, event] of Object.entries(manifest.events)) {
    const ceiling = event.loop ? 2 : 8;
    events[kind] = {
      ...event,
      gain: offsetGain(event.gain, offsets.events[kind], ceiling),
      variants: event.variants.map(variant => ({ ...variant, gain: offsetGain(variant.gain, offsets.variants[variant.src], ceiling) })),
    };
  }
  return { version: 1, events };
}

/** Music track gain with its offset (the element volume is clamped to 1 by the player). */
export function musicTrackGain(track: { id: string; gain: number }, offsets: GainOffsets): number {
  return offsetGain(track.gain, offsets.music[track.id], 8);
}

/** Reads the repository file; never throws (no file, offline, invalid JSON → no adjustment). */
export async function loadGainOffsets(url = GAIN_OFFSETS_URL): Promise<GainOffsets> {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return emptyGainOffsets();
    return parseGainOffsets(await response.json());
  } catch { return emptyGainOffsets(); }
}
