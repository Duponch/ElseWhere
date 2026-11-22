/** Data of the developer page `rules.html` (docs/development/rules-page.md).
 * Every rule says what it does, gives its numbers and names the file and the
 * symbol of Elsewhere that implements it. Numbers never live in the prose:
 * the prose holds `{clé}` placeholders filled from `values`, each value either
 * read from an exported symbol (`code`) or written here and pinned to a text
 * fragment of its source file (`pinned`), which the test looks for. */

/** Where a rule comes from, as the gameplay notes state it. */
export type RuleFidelity = 'core' | 'adaptation' | 'elsewhere';
/** How much of a domain the page describes. */
export type DomainCoverage = 'complete' | 'partial' | 'outline';

export interface RuleSource {
  /** Path from the repository root, e.g. `src/sim/needs.ts`. */
  file: string;
  /** Exported symbol, or the function/constant holding an inline number. */
  symbol: string;
}

export interface RuleValue {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  source: RuleSource;
  /** `code`: read from the symbol at load time. `pinned`: written in the
   * registry; `pin` is a fragment the source file must contain. */
  origin: 'code' | 'pinned';
  pin?: string;
}

/** A table generated from a collection of the code. */
export interface RuleTable {
  id: string;
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly (string | number)[])[];
  source: RuleSource;
  /** Set when the rows come from a private list copied in the registry: the
   * source file must contain this fragment (the list as written there). */
  pin?: string;
}

export interface Rule {
  /** `domaine.nom`, also the anchor of the rule on the page. */
  id: string;
  domain: string;
  title: string;
  /** What the rule does, with `{clé}` placeholders. No digit outside them. */
  text: string;
  /** The calculation, with `{clé}` placeholders. No digit outside them. */
  formula?: string;
  values: readonly RuleValue[];
  tables: readonly RuleTable[];
  sources: readonly RuleSource[];
  fidelity: RuleFidelity;
  /** Free text (may cite a schema or a Core version). */
  fidelityNote?: string;
  /** Notes of `docs/` that document the rule. */
  notes: readonly string[];
  /** Ids of related rules (links on the page). */
  related: readonly string[];
}

export interface RuleDomain {
  id: string;
  label: string;
  summary: string;
  coverage: DomainCoverage;
  /** What this domain does not describe yet. */
  missing: readonly string[];
  rules: readonly Rule[];
}

export const FIDELITY_LABELS: Readonly<Record<RuleFidelity, string>> = Object.freeze({
  core: 'Comme le jeu de base',
  adaptation: 'Adaptation',
  elsewhere: 'Propre à Elsewhere',
});
export const COVERAGE_LABELS: Readonly<Record<DomainCoverage, string>> = Object.freeze({
  complete: 'Complet',
  partial: 'Partiel',
  outline: 'Esquisse',
});
