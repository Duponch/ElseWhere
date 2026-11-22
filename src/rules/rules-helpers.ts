import type { Rule, RuleFidelity, RuleSource, RuleTable, RuleValue } from './rules-types.ts';
import { TICKS_PER_DAY } from '../sim/types.ts';

/** Builders of the rules registry (docs/development/rules-page.md). Pure:
 * the page and the test both import them. */

export const sim = (file: string, symbol: string): RuleSource => ({ file: `src/sim/${file}`, symbol });
export const at = (file: string, symbol: string): RuleSource => ({ file, symbol });

/** A number read from the code. */
export function code(key: string, label: string, value: number | string, source: RuleSource, unit?: string): RuleValue {
  return { key, label, value, source, origin: 'code', ...(unit ? { unit } : {}) };
}
/** A number written inline in a function: `pin` must appear in its file. */
export function pinned(key: string, label: string, value: number | string, source: RuleSource, pin: string, unit?: string): RuleValue {
  return { key, label, value, source, origin: 'pinned', pin, ...(unit ? { unit } : {}) };
}
export function table(id: string, caption: string, columns: readonly string[], rows: readonly (readonly (string | number)[])[], source: RuleSource, pin?: string): RuleTable {
  return { id, caption, columns, rows, source, ...(pin ? { pin } : {}) };
}

export interface RuleSpec {
  id: string; title: string; text: string; formula?: string;
  values?: readonly RuleValue[]; tables?: readonly RuleTable[]; sources?: readonly RuleSource[];
  fidelity: RuleFidelity; fidelityNote?: string; notes?: readonly string[]; related?: readonly string[];
}
/** Sources default to those of the values and tables, without repeats. */
export function rule(domain: string, spec: RuleSpec): Rule {
  const values = spec.values ?? [], tables = spec.tables ?? [];
  const seen = new Set<string>(), sources: RuleSource[] = [];
  for (const source of [...(spec.sources ?? []), ...values.map(v => v.source), ...tables.map(t => t.source)]) {
    const key = `${source.file}#${source.symbol}`;
    if (!seen.has(key)) { seen.add(key); sources.push(source); }
  }
  return {
    id: `${domain}.${spec.id}`, domain, title: spec.title, text: spec.text,
    ...(spec.formula ? { formula: spec.formula } : {}),
    values, tables, sources, fidelity: spec.fidelity,
    ...(spec.fidelityNote ? { fidelityNote: spec.fidelityNote } : {}),
    notes: spec.notes ?? [], related: (spec.related ?? []).map(id => id.includes('.') ? id : `${domain}.${id}`),
  };
}

/** French number, at most four decimals, no trailing zeros. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : '—';
  const rounded = Math.round(value * 10000) / 10000;
  const [whole, fraction] = Math.abs(rounded).toString().split('.');
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${rounded < 0 ? '−' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}
export const formatCell = (cell: string | number): string => typeof cell === 'number' ? formatNumber(cell) : cell;
/** A value in the prose: the prose says the unit itself. */
export const formatBare = (value: RuleValue): string => typeof value.value === 'number' ? formatNumber(value.value) : value.value;
/** A value in the table of numbers, with its unit. */
export function formatValue(value: RuleValue): string {
  const text = formatBare(value);
  return value.unit ? `${text} ${value.unit}` : text;
}

export const PLACEHOLDER = /\{([A-Za-z0-9-]+)\}/g;
/** Splits a text into literal parts and placeholders, for safe DOM rendering. */
export function textParts(text: string, values: readonly RuleValue[]): ({ kind: 'text'; text: string } | { kind: 'value'; value: RuleValue })[] {
  const parts: ({ kind: 'text'; text: string } | { kind: 'value'; value: RuleValue })[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (match.index! > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    const value = values.find(v => v.key === match[1]);
    parts.push(value ? { kind: 'value', value } : { kind: 'text', text: match[0] });
    last = match.index! + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
export function renderText(text: string, values: readonly RuleValue[]): string {
  return textParts(text, values).map(part => part.kind === 'text' ? part.text : formatBare(part.value)).join('');
}

/** Local ticks per day (a local tick is ten ticks of the base game). */
export const DAY = TICKS_PER_DAY;
export const days = (ticks: number): number => ticks / DAY;
export const pct = (fraction: number): number => fraction * 100;
export const sorted = <T>(entries: readonly T[], key: (entry: T) => string): T[] => [...entries].sort((a, b) => key(a).localeCompare(key(b), 'fr'));
