/** Which RimWorld definition answers each lore entry of Elsewhere, so the
 * texts of the player's installed game can be shown in its place. The key of
 * a lore id is the Core defName for backstories, traits and faction types; for
 * the others the importer's tables (Core defName → Elsewhere identifier, src/
 * import/rimworld/map-*.ts) are read backwards, exact matches only: an entry
 * that only approximates a Core thing (an « adapted » mapping) keeps
 * Elsewhere's text. Pure data, no text of the game. */
import {CORE_BACKSTORY_LIST_370} from '../sim/core-backstories-370.ts';
import {TRAITS} from '../sim/traits.ts';
import {CARAVAN_GUARDS_332,CARAVAN_TRADERS_332,CARAVAN_TRADER_KINDS_332} from '../sim/trader-caravans-332.ts';
import {ITEM_MAP,APPAREL_MAP,WEAPON_MAP} from '../import/rimworld/map-items.ts';
import {ANIMAL_MAP} from '../import/rimworld/map-pawns.ts';
import {PLANT_MAP} from '../import/rimworld/map-plants.ts';
import {BUILDING_MAP} from '../import/rimworld/map-buildings.ts';
import {BIOME_MAP} from '../import/rimworld/map-world.ts';
import {isDropped,type DefMapping} from '../import/rimworld/mapping.ts';

/** The faction types of the world creation screen (the registry's group
 * « types », `WORLD_FACTION_CHOICES`), by Core defName. */
export const GAME_LORE_FACTION_TYPES=['OutlanderCivil','OutlanderRough','TribeCivil','TribeRough','TribeSavage','Pirate','Mechanoid','Insect'] as const;
/** Lore group of the leader titles read from the game. Elsewhere has none of
 * its own (the faction dossier then says « Dirigeant »). */
export const GAME_LORE_LEADER_GROUP='titres-de-chef';

export type GameLoreDefType='BackstoryDef'|'TraitDef'|'FactionDef'|'ThingDef'|'PawnKindDef'|'BiomeDef'|'ScenarioDef'|'TraderKindDef';
/** How a lore entry's texts are read from one definition. */
export type GameLoreRead=
 |{readonly kind:'backstory'}
 |{readonly kind:'trait';readonly degree:number}
 |{readonly kind:'faction'}
 |{readonly kind:'leader'}
 |{readonly kind:'label'}
 |{readonly kind:'label-description'}
 |{readonly kind:'scenario'};
export interface GameLoreTarget {
 /** The lore id (`catégorie/groupe/clé`). */
 readonly id:string;
 readonly type:GameLoreDefType;
 readonly defName:string;
 readonly read:GameLoreRead;
}

const exactTarget=<T>(mapping:DefMapping<T>):T|undefined=>!isDropped(mapping)&&!mapping.adapt?mapping.to:undefined;
/** Elsewhere identifier → first Core defName mapped to it exactly. */
function backwards<T>(table:Readonly<Record<string,DefMapping<T>>>,key:(to:T)=>string|undefined):Map<string,string> {
 const out=new Map<string,string>();
 for(const [def,mapping] of Object.entries(table)){const to=exactTarget(mapping);if(to===undefined)continue;const id=key(to);if(id!==undefined&&!out.has(id))out.set(id,def);}
 return out;
}

let cached:readonly GameLoreTarget[]|undefined;
/** Every lore entry that has a counterpart in the game, in registry order. */
export function gameLoreTargets():readonly GameLoreTarget[] {
 if(cached)return cached;
 const out:GameLoreTarget[]=[];
 const push=(id:string,type:GameLoreDefType,defName:string,read:GameLoreRead)=>out.push(Object.freeze({id,type,defName,read}));
 for(const story of CORE_BACKSTORY_LIST_370)push(`histoires/${story.slot==='childhood'?'enfance':'adulte'}-base/${story.id}`,'BackstoryDef',story.id,{kind:'backstory'});
 for(const [key,trait] of Object.entries(TRAITS))push(`traits/traits/${key}`,'TraitDef',trait.def,{kind:'trait',degree:trait.degree});
 for(const def of GAME_LORE_FACTION_TYPES){push(`factions/types/${def}`,'FactionDef',def,{kind:'faction'});push(`factions/${GAME_LORE_LEADER_GROUP}/${def}`,'FactionDef',def,{kind:'leader'});}
 for(const [key,kind] of Object.entries(CARAVAN_TRADER_KINDS_332))push(`personnes/roles/caravane-${key}`,'TraderKindDef',kind.core,{kind:'label'});
 for(const [key,guard] of Object.entries(CARAVAN_GUARDS_332))push(`personnes/roles/garde-${key}`,'PawnKindDef',guard.core,{kind:'label'});
 for(const [key,trader] of Object.entries(CARAVAN_TRADERS_332))push(`personnes/roles/marchand-${key}`,'PawnKindDef',trader.core,{kind:'label'});
 for(const [biome,def] of backwards(BIOME_MAP,to=>to))push(`lieux/milieux/${biome}`,'BiomeDef',def,{kind:'label-description'});
 // Elsewhere's « Atterrissage forcé » is Core's Crashlanded; its other three
 // scenarios are its own.
 push('recits/scenarios/crashlanded','ScenarioDef','Crashlanded',{kind:'scenario'});
 const items=backwards(ITEM_MAP,to=>to);
 for(const [id,def] of backwards(APPAREL_MAP,to=>'item' in to?to.item:undefined))if(!items.has(id))items.set(id,def);
 for(const [id,def] of backwards(WEAPON_MAP,to=>'item' in to?to.item:undefined))if(!items.has(id))items.set(id,def);
 for(const [id,def] of items)push(`descriptions/objets/${id}`,'ThingDef',def,{kind:'label-description'});
 for(const [id,def] of backwards(ANIMAL_MAP,to=>to))push(`descriptions/animaux/${id}`,'ThingDef',def,{kind:'label-description'});
 for(const [id,def] of backwards(PLANT_MAP,to=>'wild' in to?to.wild:undefined))push(`descriptions/plantes-sauvages/${id}`,'ThingDef',def,{kind:'label-description'});
 for(const [id,def] of backwards(PLANT_MAP,to=>'crop' in to?to.crop:undefined))push(`descriptions/cultures/${id}`,'ThingDef',def,{kind:'label-description'});
 for(const [id,def] of backwards(BUILDING_MAP,to=>to.kind))push(`descriptions/batiments/${id}`,'ThingDef',def,{kind:'label-description'});
 cached=Object.freeze(out);
 return cached;
}

/** Registry groups whose entries the game cannot answer, and why (shown on the
 * lore page and in Options). */
export const GAME_LORE_UNMATCHED:Readonly<Record<string,string>>=Object.freeze({
 'histoires/enfance-elsewhere':'Histoires écrites pour Elsewhere : le jeu n’en a pas l’équivalent.',
 'histoires/adulte-elsewhere':'Histoires écrites pour Elsewhere : le jeu n’en a pas l’équivalent.',
 'personnes/prenoms':'Le jeu tire ses prénoms de ses propres listes et grammaires, pas d’une liste qui réponde à celle-ci mot pour mot.',
 'personnes/animaux':'Le jeu nomme les animaux par une grammaire : pas de liste équivalente.',
 'personnes/anciens':'Syllabes propres à Elsewhere.',
 'recits/lettres':'Les classes de lettres du jeu (LetterDef) n’ont pas de libellé.',
 'recits/romans':'Le jeu compose les titres et résumés de livres par une grammaire : pas de liste équivalente.',
});
