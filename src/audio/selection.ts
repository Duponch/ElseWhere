import type { AudioCue } from './scheduler';
import { audibleRange, listenerPose, sourceDistance, type AudioCamera } from './spatial';

export interface OneShotEventInfo { maxDistance: number; loop: boolean; gain: number; spatial?: boolean }

export function cueHash(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}

const WORK_KINDS = new Set([
  'mining.hit', 'woodcutting.hit', 'construction.hit', 'cooking.work',
  'crafting.work', 'tailoring.work', 'butchering.work', 'research.work',
  'cleaning.work', 'medical.tend', 'maintenance.work',
  'deconstruction.work', 'firefighting.beat',
]);

/** Presentation-only variation; never consumes the simulation PRNG. */
export function cueVariation(id: string, kind?: string): { playbackRate: number; gain: number } {
  const hash = cueHash(id);
  // Repeated foley of the game sounds of 22 November varies like the work hits.
  const work = kind !== undefined && (WORK_KINDS.has(kind) || /^(crafting|construction|eating|animal\.eat)\.|^haul\.drop-/.test(kind));
  const pitchSpread = work ? 0.06 : 0.03;
  const gainSpreadDb = work ? 1.5 : 1;
  const playbackRate = 1 - pitchSpread + (hash & 0xffff) / 0xffff * (2 * pitchSpread);
  const gainDb = -gainSpreadDb + (hash >>> 16) / 0xffff * (2 * gainSpreadDb);
  return { playbackRate, gain: 10 ** (gainDb / 20) };
}

function priority(kind: string): number {
  if (kind === 'ui.threat' || kind === 'ui.colonist-death') return -1;
  if (kind === 'weapon.gunshot' || kind.startsWith('weapon.shot-') || kind === 'weapon.explosion') return 0;
  if (kind === 'weapon.melee' || kind.startsWith('weapon.melee-') || kind.startsWith('weapon.impact-')
    || kind.startsWith('human.hurt.') || kind.startsWith('animal.hurt.')
    || kind === 'weather.thunder' || kind.startsWith('animal.death.')) return 1;
  return 2;
}

/** A snapshot burst can contain many work contacts; only audible top cues get nodes. */
export function selectOneShots(
  cues: readonly AudioCue[],
  events: Readonly<Record<string, OneShotEventInfo>>,
  camera: AudioCamera,
  limit = 12,
): AudioCue[] {
  const pose = listenerPose(camera);
  const candidates: { cue: AudioCue; distance: number; priority: number }[] = [];
  for (const cue of cues) {
    const event = events[cue.kind];
    if (!event || event.loop || event.gain <= 0) continue;
    const distance = event.spatial === false ? 0 : sourceDistance(cue.x, cue.z, pose);
    if (event.spatial !== false && distance >= audibleRange(event.maxDistance, camera)) continue;
    candidates.push({ cue, distance, priority: priority(cue.kind) });
  }
  candidates.sort((a, b) => a.priority - b.priority || a.distance - b.distance ||
    a.cue.tick - b.cue.tick || a.cue.id.localeCompare(b.cue.id));
  return candidates.slice(0, Math.max(0, limit)).map(candidate => candidate.cue);
}
