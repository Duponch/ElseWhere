/** The lore of Elsewhere: every narrative text the game shows (stories,
 * names, factions, places, letters, names of things), as opposed to its rules.
 * The registry (lore-registry.ts) reads these texts where they are defined;
 * it never copies nor moves them. A future custom lore will override entries
 * by their `id` and leave every rule untouched (docs/development/lore.md). */

export type LoreCategoryId='histoires'|'traits'|'factions'|'personnes'|'lieux'|'recits'|'descriptions';

/** Where an entry comes from: Elsewhere's own sources, or (later lot) the
 * player's installed RimWorld, read at run time and never stored. */
export type LoreOrigin='elsewhere'|'installed';

export interface LoreSourceRef {
  /** Repository path of the file that defines the text. */
  readonly file:string;
  /** Exported symbol (table or list) that holds it. */
  readonly symbol:string;
}

/** One lore entry. Only narrative fields: no skill gain, disabled work,
 * forced trait, relation, weight, cost or any other rule. */
export interface LoreEntry {
  /** Stable identifier `category/group/key`, the key of a future override. */
  readonly id:string;
  readonly origin:LoreOrigin;
  readonly category:LoreCategoryId;
  readonly group:string;
  /** The entry's key in its source table (defName, item id, list name…). */
  readonly key:string;
  readonly title?:string;
  readonly shortTitle?:string;
  readonly titleFemale?:string;
  readonly shortTitleFemale?:string;
  readonly description?:string;
  /** Word lists (first names, syllables, title parts…), in source order. */
  readonly words?:readonly string[];
  /** The RimWorld definition the entry answers to, to recognise it. */
  readonly reference?:string;
  /** What a future custom lore must respect for this entry. */
  readonly note?:string;
  readonly source:LoreSourceRef;
}

/** The narrative fields an override may replace, in display order. */
export const LORE_TEXT_FIELDS=['title','shortTitle','titleFemale','shortTitleFemale','description','words'] as const;
export type LoreTextField=typeof LORE_TEXT_FIELDS[number];
/** Every field a lore entry may carry. */
export const LORE_ENTRY_FIELDS:readonly (keyof LoreEntry)[]=Object.freeze(['id','origin','category','group','key',...LORE_TEXT_FIELDS,'reference','note','source']);

export interface LoreGroupInfo {readonly id:string;readonly label:string}
export interface LoreCategoryInfo {
  readonly id:LoreCategoryId;
  readonly label:string;
  readonly description:string;
  readonly groups:readonly LoreGroupInfo[];
  /** Texts of this kind the registry does not read yet, and why. */
  readonly pending:readonly string[];
}
