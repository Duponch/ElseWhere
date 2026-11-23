import type { NativeControl, NativeRow } from './native-contract';
import type { MoodThought } from '../sim/mood';
import { moodTarget } from '../sim/mood';
import type { Pawn, World } from '../sim/types';
import { NATIVE_INK } from './native-ui-scale';
import type { NeedBarSpec, NeedThoughtSpec, NeedsSpec } from './native-tab-needs';
import type { HealthCapacitySpec, HealthEntryItem, HealthEntrySpec } from './native-tab-health';

/** Conversions from the inspector's data to the inspector tabs' cards (see
 * `native-tab-card.ts`). Pure: no command, no control is created here. */
const pct = (value: number) => `${Math.round(value * 100)} %`;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** `HealthCardUtility.EfficiencyValueToEstimate` and its colours. */
export function efficiencyInk(value: number): string {
  if (value <= 0) return NATIVE_INK.red;
  if (value < .4) return NATIVE_INK.negative;
  if (value < 1 && Math.abs(value - 1) > 1e-6) return NATIVE_INK.subtle;
  return Math.abs(value - 1) <= 1e-6 ? NATIVE_INK.good : NATIVE_INK.enhanced;
}
/** `HealthCardUtility.GetPainLabel`: wording and colour by total pain. */
export function painLabel(pain: number): { label: string; ink: string } {
  if (Math.abs(pain) < 1e-6) return { label: 'Aucune douleur', ink: NATIVE_INK.good };
  if (pain < .15) return { label: 'Un peu de douleur', ink: NATIVE_INK.relation };
  if (pain < .4) return { label: 'Douleur modérée', ink: NATIVE_INK.painMedium };
  if (pain < .8) return { label: 'Douleur forte', ink: NATIVE_INK.painSevere };
  return { label: 'Douleur extrême', ink: NATIVE_INK.red };
}
const needDefinitions: readonly { id: string; label: string; major: boolean; marks: readonly number[] }[] = [
  { id: 'need-hunger', label: 'Nourriture', major: true, marks: [12, 24] },
  { id: 'need-rest', label: 'Sommeil', major: true, marks: [14, 28] },
  { id: 'recreation-level', label: 'Loisirs', major: true, marks: [15, 30, 70, 85] },
  { id: 'need-beauty', label: 'Beauté', major: false, marks: [15, 35, 65, 85] },
  { id: 'need-comfort', label: 'Confort', major: false, marks: [10, 60, 70, 80, 90] },
  { id: 'need-outdoors', label: 'Plein air', major: false, marks: [5, 20, 40, 60, 80] },
  { id: 'need-indoors', label: 'Intérieur', major: false, marks: [5, 20, 40, 60, 80] },
];
/** Core's order is `listPriority` descending (food 800, rest 700, joy 500,
 * beauty 300, comfort 200, outdoors/indoors 100); the mood and the room size
 * are not on the list (`showOnNeedList` is false). What the old tab showed
 * about them moves into the mood bar's tooltip. */
export function needsSpec(world: World, pawn: Pawn, alive: boolean, tab: readonly NativeRow[], thoughts: readonly MoodThought[], thresholds: readonly [number, number, number]): NeedsSpec {
  const find = (id: string) => tab.find(entry => entry.id === id);
  const sleeping = pawn.state === 'sleeping';
  const arrows: Record<string, number> = { 'need-hunger': alive ? -1 : 0, 'need-rest': alive ? (sleeping ? 1 : -1) : 0, 'recreation-level': alive && !sleeping ? (pawn.recreation.task ? 1 : -1) : 0 };
  const needs: NeedBarSpec[] = [];
  for (const definition of needDefinitions) {
    const entry = find(definition.id); if (!entry) continue;
    const level = entry.meter ? clamp01(entry.meter.value / (entry.meter.max ?? 1)) : 0;
    const extras = definition.id === 'recreation-level' ? tab.filter(other => /^(recreation-task|party-participation)$/.test(other.id)).map(other => `${other.label} : ${other.value ?? ''}${other.hint ? ` (${other.hint})` : ''}`) : [];
    needs.push({ id: definition.id, label: definition.label, major: definition.major, level, thresholds: definition.marks.map(value => value / 100), arrow: arrows[definition.id] ?? 0, unavailable: !alive,
      hint: [`${definition.label} : ${alive ? pct(level) : '—'}`, entry.hint ?? '', ...extras].filter(Boolean).join('\n\n') });
  }
  const moodEntry = find('need-mood');
  let mood: NeedBarSpec | undefined;
  if (moodEntry) {
    const level = clamp01(pawn.mood / 100), target = clamp01(moodTarget(thoughts) / 100);
    const extras = tab.filter(other => /^(mood-inspiration|mood-crisis|need-room-size)$/.test(other.id)).map(other => `${other.label}${other.value ? ` : ${other.value}` : ''}${other.hint ? `\n${other.hint}` : ''}`);
    mood = { id: 'need-mood', label: 'Humeur', major: true, level, thresholds: thresholds.map(value => clamp01(value / 100)), arrow: alive && !sleeping ? (target > level + .05 ? 1 : target < level - .05 ? -1 : 0) : 0, marker: alive ? target : undefined, unavailable: !alive,
      hint: [`Humeur : ${alive ? pct(level) : '—'}`, moodEntry.hint ?? '', ...extras].filter(Boolean).join('\n\n') };
  }
  // Thoughts grouped by label, as Core groups the memories of one kind.
  const groups = new Map<string, { label: string; offset: number; count: number; hint: string; expires: number | undefined }>();
  for (const thought of thoughts) {
    if (thought.offset === 0) continue;
    const group = groups.get(thought.label);
    if (group) { group.offset += thought.offset; group.count++; group.expires = thought.expiresAt === undefined || group.expires === undefined ? group.expires ?? thought.expiresAt : Math.max(group.expires, thought.expiresAt); }
    else groups.set(thought.label, { label: thought.label, offset: thought.offset, count: 1, expires: thought.expiresAt, hint: `${thought.label}\n\n${thought.description}` });
  }
  const listed: NeedThoughtSpec[] = [...groups.values()].sort((a, b) => b.offset - a.offset).map(group => ({ id: group.label, label: group.label, count: group.count, offset: group.offset,
    hint: `${group.hint}${group.expires !== undefined ? `\n\nExpire dans ${Math.max(0, Math.ceil((group.expires - world.tick) / 250))} h` : ''}\n\nEffet sur l’humeur : ${group.offset > 0 ? '+' : ''}${Number(group.offset.toFixed(1))}` }));
  return { type: 'needs', needs, mood, thoughts: alive ? listed : [] };
}

export interface HealthPartInfo { label: string; hint: string; ink: string; info: NativeControl }
/** The right-hand hediff list: one entry per body part, whole-body entries
 * first, as `HealthCardUtility.VisibleHediffGroupsInOrder` orders them. */
export function healthEntries(rows: readonly NativeRow[], lookup: {
  injury: (id: number) => { part: string; bleeding: boolean; tended: boolean } | undefined;
  missing: (part: string) => { tended?: boolean } | undefined;
  infectionPart: (index: number) => string | undefined;
  part: (part: string) => HealthPartInfo;
  whole: () => NativeControl;
}): HealthEntrySpec[] {
  const parts = new Map<string, { info: HealthPartInfo; items: HealthEntryItem[] }>(), whole: HealthEntryItem[] = [];
  const add = (part: string | undefined, item: HealthEntryItem) => {
    if (part === undefined) { whole.push(item); return; }
    let entry = parts.get(part); if (!entry) { entry = { info: lookup.part(part), items: [] }; parts.set(part, entry); }
    entry.items.push(item);
  };
  const infected = rows.some(row => /^infection-\d+$/.test(row.id));
  for (const row of rows) {
    const hint = row.hint ?? '';
    if (row.id === 'pain' || row.id === 'health-clear') continue;
    // Core lists the hediffs a person actually has: a bar at zero (blood loss,
    // bleeding, malnutrition...) and the immunity of a person with no infection are not rows.
    if (row.meter && (row.meter.value <= 0 || /^0\s*%$/.test(row.meter.label ?? '')) || row.id === 'immunity' && !infected) continue;
    let match: RegExpMatchArray | null;
    if ((match = row.id.match(/^injury-(\d+)$/))) {
      const injury = lookup.injury(Number(match[1])); if (!injury) continue;
      add(injury.part, { id: row.id, label: row.value ?? row.label, count: 1, bleeding: injury.bleeding, tended: injury.tended, hint: hint || row.label });
    } else if ((match = row.id.match(/^missing-(.+)$/))) {
      add(match[1], { id: row.id, label: row.value ?? 'Partie perdue', count: 1, ink: NATIVE_INK.red, bleeding: false, tended: !!lookup.missing(match[1]!)?.tended, hint: hint || row.label });
    } else if ((match = row.id.match(/^artificial-(.+)$/))) {
      add(match[1], { id: row.id, label: row.value ?? row.label, count: 1, bleeding: false, tended: false, hint: hint || row.label });
    } else if ((match = row.id.match(/^infection-(\d+)$/))) {
      add(lookup.infectionPart(Number(match[1])), { id: row.id, label: `Infection${row.meter ? ` (${row.meter.label ?? ''})` : ''}`, count: 1, bleeding: false, tended: false, hint: hint || row.label });
    } else {
      const label = row.meter ? `${row.label.replace(/ · .*$/, '')} (${row.meter.label ?? row.value ?? ''})` : row.value ? `${row.label} (${row.value})` : row.label;
      add(undefined, { id: row.id, label, count: 1, bleeding: row.id === 'blood' && (row.meter?.value ?? 0) > 0, tended: false, hint: hint || row.label });
    }
  }
  const result: HealthEntrySpec[] = [];
  if (whole.length) result.push({ id: 'whole-body', info: lookup.whole(), items: whole });
  for (const [part, entry] of parts) result.push({ id: part, part: { label: entry.info.label, ink: entry.info.ink, hint: entry.info.hint }, info: entry.info.info, items: entry.items });
  return result;
}
export function capacitySpecs(entries: readonly [string, number][], label: (key: string) => string, hint: (key: string) => string): HealthCapacitySpec[] {
  return entries.map(([key, value]) => ({ id: key, label: label(key), value: pct(value), ink: efficiencyInk(value), hint: hint(key) }));
}
