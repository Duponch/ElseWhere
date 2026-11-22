/** Faction and settlement names as the game draws them at world generation
 * step 500, when the game's rule packs are available (read from an installed
 * game, never stored: `src/import/rimworld/game-grammar.ts`).
 *
 * Without them (every game created in the browser today, every existing
 * save) step 500 keeps Elsewhere's own names and draws, unchanged. With them,
 * a faction's name and its settlements' names are drawn by the ported
 * `NameGenerator` on the step's own stream, exactly where the game draws
 * them (`FactionGenerator.NewGeneratedFaction`: after the colour and the
 * ideology, before the relations, the first settlement and the leader). The
 * leaders stay Elsewhere's (`PawnGenerator` is not ported), so the stream
 * leaves the game's at the first leader: the first faction's name, its first
 * settlement's tile and name are the game's; what follows is drawn the same
 * way but no longer from the game's state. */
import type {WorldGenerationRandom} from './world-generation-random.ts';
import type {GrammarDatabase,GrammarRandom} from './verse-grammar.ts';
import {generateFactionName,generateSettlementName} from './verse-name-generator.ts';
const f=Math.fround;

/** What a faction definition says about names (`FactionDef`). */
export interface CoreFactionNaming {readonly factionNameMaker:string|null;readonly settlementNameMaker:string|null;readonly fixedName:string|null}
/** The game's name data for step 500. */
export interface CoreFactionNames {
 readonly grammar:GrammarDatabase;
 /** By faction definition name. */
 readonly factions:ReadonlyMap<string,CoreFactionNaming>;
}
/** The world generation stream seen as `Verse.Rand` (same counter hash; the
 * float range is evaluated as the game's runtime does). */
export function grammarRandomOf(random:WorldGenerationRandom):GrammarRandom {
 return {
  get value(){return random.value();},
  range:(min,max)=>random.integer(min,max),
  rangeInclusive:(min,max)=>max<=min?min:random.integer(min,max+1),
  rangeFloat:(min,max)=>{min=f(min);max=f(max);return max<=min?min:f(random.value()*(max-min)+min);},
 };
}
function namingOf(names:CoreFactionNames,def:string):CoreFactionNaming {
 const naming=names.factions.get(def);if(!naming)throw Error(`Définition de faction absente des données du jeu : ${def}.`);
 return naming;
}
/** The game's name of a new faction: its fixed name, or ten names from its
 * faction name pack (`visibleNames`: names of the visible factions already
 * created). */
export function coreFactionName(names:CoreFactionNames,def:string,visibleNames:readonly string[],random:WorldGenerationRandom):string {
 const naming=namingOf(names,def);
 if(naming.fixedName!==null)return naming.fixedName;
 if(!naming.factionNameMaker)throw Error(`Faction sans générateur de noms : ${def}.`);
 return generateFactionName(names.grammar,naming.factionNameMaker,visibleNames,grammarRandomOf(random));
}
/** The game's name of a new settlement of a faction (`usedNames`: names of
 * every settlement already placed). */
export function coreSettlementName(names:CoreFactionNames,def:string,usedNames:readonly string[],random:WorldGenerationRandom):string {
 const naming=namingOf(names,def);
 if(!naming.settlementNameMaker)throw Error(`Faction sans générateur de noms de colonie : ${def}.`);
 return generateSettlementName(names.grammar,naming.settlementNameMaker,usedNames,grammarRandomOf(random));
}
