/** RimWorld's name generator (`RimWorld.NameGenerator.GenerateName`, Core
 * 1.6.4871) and its two uses at world generation, the faction name
 * (`FactionGenerator.NewGeneratedFaction`) and the settlement name
 * (`SettlementNameGenerator.GenerateSettlementName`), rewritten from the
 * decompiled code on the ported grammar (`verse-grammar.ts`); no code copied.
 *
 * - `GenerateName(pack, validator)`: the request includes the pack alone; the
 *   root keyword is the pack's first rule keyword (« none » without rules),
 *   the untranslated one for the English retry. Up to 150 resolutions, each
 *   capitalized as a title by the language, until the validator accepts one;
 *   otherwise the last.
 * - With `appendNumberIfNameUsed`: 100 rounds of 5 resolutions, the round
 *   number from the second round on appended (« Nom 2 »); after all of them,
 *   one more resolution, kept as it is.
 * - Faction: ten names (validator: no visible faction has it), the last one of
 *   20 characters or fewer is kept; an eleventh name when none is.
 * - Settlement: a name not yet taken by a settlement, number appended.
 *
 * Pure: the caller supplies the rule packs and the generator. */
import {grammarResolve,type GrammarDatabase,type GrammarRandom,type GrammarRequest} from './verse-grammar.ts';
import {languageTitleCase} from './verse-text.ts';

/** `NameGenerator.GenerateName(GrammarRequest, …)`. */
export function generateNameFromRequest(db:GrammarDatabase,request:GrammarRequest,random:GrammarRandom,options:{validator?:((name:string)=>boolean)|null;appendNumberIfNameUsed?:boolean;rootKeyword:string;untranslatedRootKeyword?:string|null}):string {
 const untranslatedRootKeyword=options.untranslatedRootKeyword??options.rootKeyword,validator=options.validator??null;
 const resolve=()=>languageTitleCase(db.language.worker,grammarResolve(db,options.rootKeyword,request,random,{untranslatedRootKeyword}));
 let text='ErrorName';
 if(options.appendNumberIfNameUsed){
  for(let i=0;i<100;i++)for(let j=0;j<5;j++){
   text=resolve();if(i!==0)text=`${text} ${i+1}`;
   if(!validator||validator(text))return text;
  }
  return resolve();
 }
 for(let k=0;k<150;k++){text=resolve();if(!validator||validator(text))return text;}
 return text;
}
/** `NameGenerator.GenerateName(RulePackDef, …)`. */
export function generateName(db:GrammarDatabase,rootPack:string,random:GrammarRandom,options:{validator?:((name:string)=>boolean)|null;appendNumberIfNameUsed?:boolean;rootKeyword?:string|null}={}):string {
 return generateNameFromRequest(db,{includes:[rootPack]},random,{validator:options.validator??null,appendNumberIfNameUsed:options.appendNumberIfNameUsed??false,
  rootKeyword:options.rootKeyword??db.firstRuleKeyword(rootPack,false),untranslatedRootKeyword:options.rootKeyword??db.firstRuleKeyword(rootPack,true)});
}
/** Longest faction name the game prefers (`MaxPreferredFactionNameLength`). */
export const MAX_PREFERRED_FACTION_NAME_LENGTH=20;
/** The faction-name part of `FactionGenerator.NewGeneratedFaction`.
 * `visibleNames`: names of the factions already created and not hidden. */
export function generateFactionName(db:GrammarDatabase,factionNameMaker:string,visibleNames:readonly string[],random:GrammarRandom):string {
 const validator=(name:string)=>!visibleNames.includes(name);let kept='';
 for(let i=0;i<10;i++){const name=generateName(db,factionNameMaker,random,{validator});if(name.length<=MAX_PREFERRED_FACTION_NAME_LENGTH)kept=name;}
 return kept||generateName(db,factionNameMaker,random,{validator});
}
/** `SettlementNameGenerator.GenerateSettlementName` for a faction with a
 * settlement namer. `usedNames`: names of every existing settlement. */
export function generateSettlementName(db:GrammarDatabase,settlementNameMaker:string,usedNames:readonly string[],random:GrammarRandom):string {
 return generateName(db,settlementNameMaker,random,{validator:name=>!usedNames.includes(name),appendNumberIfNameUsed:true});
}
