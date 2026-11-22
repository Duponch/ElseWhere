import type { Rule, RuleDomain } from './rules-types.ts';
import { formatCell, renderText } from './rules-helpers.ts';

/** Search of the rules page: pure, so the test can run it. */

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Every searchable text of a rule: title, prose with its numbers, values,
 * table captions and cells, sources. */
export function ruleSearchText(rule: Rule): string {
  return fold([
    rule.id, rule.title, renderText(rule.text, rule.values), rule.formula ? renderText(rule.formula, rule.values) : '',
    ...rule.values.map(v => `${v.label} ${v.value}`),
    ...rule.tables.flatMap(t => [t.caption, ...t.columns, ...t.rows.flatMap(row => row.map(formatCell))]),
    ...rule.sources.map(s => `${s.file} ${s.symbol}`), rule.fidelityNote ?? '',
  ].join(' '));
}

/** Rules whose text contains every word of the query (accents ignored). */
export function filterRules(domains: readonly RuleDomain[], query: string): ReadonlyMap<string, readonly Rule[]> {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const result = new Map<string, readonly Rule[]>();
  for (const domain of domains) {
    const domainText = fold(`${domain.label} ${domain.summary}`);
    const rules = words.length ? domain.rules.filter(rule => {
      const text = `${domainText} ${ruleSearchText(rule)}`;
      return words.every(word => text.includes(word));
    }) : domain.rules;
    if (rules.length) result.set(domain.id, rules);
  }
  return result;
}

export interface RulesStats { domains: number; rules: number; tables: number; values: number; rows: number }
export function rulesStats(domains: readonly RuleDomain[]): RulesStats {
  const rules = domains.flatMap(d => d.rules);
  return {
    domains: domains.length, rules: rules.length,
    tables: rules.reduce((n, r) => n + r.tables.length, 0),
    values: rules.reduce((n, r) => n + r.values.length, 0),
    rows: rules.reduce((n, r) => n + r.tables.reduce((m, t) => m + t.rows.length, 0), 0),
  };
}

export const REPOSITORY_URL = 'https://github.com/Duponch/RimWorld/blob/main/';
export const sourceUrl = (file: string): string => `${REPOSITORY_URL}${file}`;
