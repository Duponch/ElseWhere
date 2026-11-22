/** What the installed game's texts cover, group by group of the lore
 * registry: how many entries got the game's text, and why the others keep
 * Elsewhere's (lore page and tests). Numbers and identifiers only. */
import {GAME_LORE_UNMATCHED} from './game-lore-mapping.ts';
import type {LoreCategoryInfo,LoreEntry} from './lore-types.ts';

/** Why some entries of a group keep Elsewhere's text although the group maps. */
export const GAME_LORE_PARTIAL:Readonly<Record<string,string>>=Object.freeze({
 'recits/scenarios':'Seul « Atterrissage forcé » est un scénario du jeu ; les trois autres sont propres à Elsewhere.',
 'descriptions/objets':'Seuls les objets qui répondent exactement à une définition du jeu ; les objets faits d’une matière (vêtements, armes, blocs), les viandes que le jeu crée sans définition écrite et les objets seulement approchés gardent le texte d’Elsewhere.',
 'descriptions/cultures':'Une culture d’Elsewhere n’a pas d’équivalent exact dans le jeu.',
 'descriptions/batiments':'Les outils de l’Architecte sans définition exacte du jeu (bâtiments seulement approchés ou propres à Elsewhere) gardent leur nom.',
});
export interface GameLoreGroupCoverage {
 readonly id:string;
 readonly label:string;
 readonly matched:number;
 readonly total:number;
 readonly reason:string|undefined;
}
export interface GameLoreCoverage {
 readonly groups:readonly GameLoreGroupCoverage[];
 /** Texts of the game without an entry of Elsewhere's registry (leader titles…). */
 readonly extra:readonly string[];
 readonly matched:number;
 readonly total:number;
}
export function gameLoreCoverage(categories:readonly LoreCategoryInfo[],entries:readonly LoreEntry[],installed:ReadonlyMap<string,LoreEntry>):GameLoreCoverage {
 const groups:GameLoreGroupCoverage[]=[],known=new Set(entries.map(entry=>entry.id));
 for(const category of categories)for(const group of category.groups){
  const id=`${category.id}/${group.id}`,own=entries.filter(entry=>entry.category===category.id&&entry.group===group.id);
  const matched=own.filter(entry=>installed.has(entry.id)).length;
  groups.push({id,label:`${category.label} · ${group.label}`,matched,total:own.length,reason:matched===own.length?undefined:matched===0?GAME_LORE_UNMATCHED[id]??'Aucune définition du jeu ne répond à ces entrées.':GAME_LORE_PARTIAL[id]??'Le reste garde le texte d’Elsewhere.'});
 }
 const matched=groups.reduce((n,g)=>n+g.matched,0),total=groups.reduce((n,g)=>n+g.total,0);
 return {groups,extra:[...installed.keys()].filter(id=>!known.has(id)),matched,total};
}
