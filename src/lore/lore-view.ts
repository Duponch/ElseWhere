import {LORE_TEXT_FIELDS,type LoreCategoryId,type LoreCategoryInfo,type LoreEntry} from './lore-types.ts';

/** Lower case without accents, so « eleveur » finds « Éleveur ». */
export const foldLoreText=(text:string):string=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();

/** Everything a search reads in an entry: its texts, ids and source. */
export function loreSearchText(entry:LoreEntry):string {
  const parts:string[]=[entry.id,entry.key,entry.reference??'',entry.note??'',entry.source.file,entry.source.symbol];
  for(const field of LORE_TEXT_FIELDS){const value=entry[field];if(typeof value==='string')parts.push(value);else if(value)parts.push(...value);}
  return foldLoreText(parts.join(' '));
}

export interface LoreFilter {category?:LoreCategoryId|undefined;query?:string|undefined}
/** Entries of one category (or all), keeping those that contain every word of the query. */
export function filterLoreEntries(entries:readonly LoreEntry[],filter:LoreFilter):LoreEntry[] {
  const words=foldLoreText(filter.query??'').split(/\s+/).filter(Boolean);
  return entries.filter(entry=>(!filter.category||entry.category===filter.category)&&(!words.length||words.every(word=>loreSearchText(entry).includes(word))));
}
export function loreCategoryCounts(entries:readonly LoreEntry[]):Record<LoreCategoryId,number> {
  const counts={histoires:0,traits:0,factions:0,personnes:0,lieux:0,recits:0,descriptions:0} as Record<LoreCategoryId,number>;
  for(const entry of entries)counts[entry.category]++;
  return counts;
}
/** Texts counted one by one: a word list counts each word. */
export function loreTextCount(entries:readonly LoreEntry[]):number {
  let count=0;
  for(const entry of entries)for(const field of LORE_TEXT_FIELDS){const value=entry[field];count+=typeof value==='string'?1:value?value.length:0;}
  return count;
}

/** Local calendar date, `YYYY-MM-DD`. */
export function loreDate(date:Date):string {
  const two=(n:number)=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${two(date.getMonth()+1)}-${two(date.getDate())}`;
}
export const loreExportFileName=(date:Date):string=>`lore-elsewhere-${loreDate(date)}.json`;

export const LORE_EXPORT_FORMAT='elsewhere-lore';
export const LORE_EXPORT_VERSION=1;
export interface LoreExport {
  readonly format:typeof LORE_EXPORT_FORMAT;
  readonly version:typeof LORE_EXPORT_VERSION;
  readonly exportedOn:string;
  readonly note:string;
  readonly categories:readonly (LoreCategoryInfo&{readonly count:number})[];
  readonly entries:readonly LoreEntry[];
}
/** The whole registry, the starting point of a custom lore. */
export function buildLoreExport(categories:readonly LoreCategoryInfo[],entries:readonly LoreEntry[],date:Date):LoreExport {
  const counts=loreCategoryCounts(entries);
  return {format:LORE_EXPORT_FORMAT,version:LORE_EXPORT_VERSION,exportedOn:loreDate(date),
    note:'Textes du récit d’Elsewhere, lus là où le jeu les définit. Une histoire personnalisée remplacera des champs de texte par l’identifiant `id` d’une entrée ; aucune règle du jeu ne se trouve ici.',
    categories:categories.map(category=>({...category,count:counts[category.id]})),entries:[...entries]};
}
