/** The presentation layer of the lore texts: one lookup per lore id that
 * returns the installed game's text when the player has loaded it (Options,
 * « Textes de RimWorld ») and Elsewhere's own text otherwise. The simulation
 * and the saves keep identifiers only; nothing here changes a rule. Lookups
 * are map reads.
 *
 * The game's person texts carry its symbols (`[PAWN_nameDef]`,
 * `{PAWN_gender ? … : …}`); they are resolved for the person shown as the game
 * does (decompiled `BackstoryDef.FullDescriptionFor`, `Trait.TipString`:
 * `Formatted` for the braces, then `AdjustedFor`, a grammar resolution with
 * `GrammarUtility.RulesForPawn`, then the language's post-processing and
 * capitalized sentences; no code copied). */
import {capitalizeFirst,capitalizeSentences,dotNetTrim,languagePostProcessed,type LanguageWorkerKind} from '../sim/verse-text.ts';
import {adulthoodDefinition,childhoodDefinition,type AdulthoodId,type BackgroundDefinition,type ChildhoodId} from '../sim/colonist-backgrounds.ts';
import {isCoreBackstoryId370} from '../sim/core-backstories-370.ts';
import {TRAITS,type TraitId} from '../sim/traits.ts';
import {GAME_LORE_LEADER_GROUP} from './game-lore-mapping.ts';
import type {GameLoreKeyed} from './game-lore-reader.ts';
import type {LoreEntry,LoreTextField} from './lore-types.ts';

export interface GameLoreTexts {
 /** Shown to the player, for example « RimWorld 1.6.4871 rev590 · French (Français) ». */
 readonly label:string;
 readonly languageFolder:string;
 readonly worker:LanguageWorkerKind;
 readonly entries:ReadonlyMap<string,LoreEntry>;
 readonly keyed:GameLoreKeyed;
}

let current:GameLoreTexts|undefined;
let revision=0;
const listeners=new Set<()=>void>();
/** Installs (or removes, with undefined) the game's texts; listeners repaint. */
export function setGameLoreTexts(texts:GameLoreTexts|undefined):void {
 if(texts===current)return;
 current=texts;revision++;
 for(const listener of [...listeners])listener();
}
export const gameLoreTexts=():GameLoreTexts|undefined=>current;
/** Changes each time the shown texts change (for caches keyed on texts). */
export const loreTextsRevision=():number=>revision;
export function onLoreTextsChange(listener:()=>void):()=>void {listeners.add(listener);return ()=>{listeners.delete(listener);};}
/** Builds the lookup map of a reader's entries. */
export function gameLoreTextsOf(label:string,languageFolder:string,worker:LanguageWorkerKind,entries:readonly LoreEntry[],keyed:GameLoreKeyed):GameLoreTexts {
 return Object.freeze({label,languageFolder,worker,entries:new Map(entries.map(entry=>[entry.id,entry])),keyed:Object.freeze({...keyed})});
}

/** The game's text of a field, or undefined when it is not loaded or has none. */
export function gameLoreText(id:string,field:LoreTextField):string|undefined {
 const value=current?.entries.get(id)?.[field];return typeof value==='string'&&value?value:undefined;
}
/** Elsewhere capitalizes some names (« Optimiste », « Union civile ») where the
 * game writes them in lower case; the game's text takes the case of the
 * fallback's first letter (as the game's `LabelCap`). */
function inCaseOf(text:string,fallback:string):string {
 const first=fallback[0];return first&&first!==first.toLowerCase()?capitalizeFirst(text):text;
}
/** One lookup: the game's text of `id` when loaded, else Elsewhere's. */
export function loreText(id:string,field:LoreTextField,fallback:string):string {
 const text=gameLoreText(id,field);return text===undefined?fallback:field==='description'?text:inCaseOf(text,fallback);
}

// ---- People's texts ------------------------------------------------------------
export interface LorePerson {
 readonly name:string;
 readonly sex?:'male'|'female'|undefined;
 /** The person's title (`[PAWN_title]`), the title of the latest story. */
 readonly title?:string|undefined;
}
type Gender='Male'|'Female'|'None';
const genderOf=(sex:LorePerson['sex']):Gender=>sex==='male'?'Male':sex==='female'?'Female':'None';
// English words when a language lacks one (the game would then show the English Keyed string).
const ENGLISH_DEFAULTS:Required<Pick<GameLoreKeyed,'Prohe'|'Proshe'|'Proit'|'Prohis'|'Proher'|'Proits'|'ProhimObj'|'ProherObj'|'ProitObj'|'ProHeNoun'|'ProSheNoun'|'ProItNoun'|'Male'|'Female'|'NoneLower'>>=
 {Prohe:'he',Proshe:'she',Proit:'it',Prohis:'his',Proher:'her',Proits:'its',ProhimObj:'him',ProherObj:'her',ProitObj:'it',ProHeNoun:'man',ProSheNoun:'woman',ProItNoun:'creature',Male:'male',Female:'female',NoneLower:'none'};
function word(keyed:GameLoreKeyed,key:keyof typeof ENGLISH_DEFAULTS):string {return keyed[key]??ENGLISH_DEFAULTS[key];}
const pronoun=(k:GameLoreKeyed,g:Gender)=>word(k,g==='Male'?'Prohe':g==='Female'?'Proshe':'Proit');
const possessive=(k:GameLoreKeyed,g:Gender)=>word(k,g==='Male'?'Prohis':g==='Female'?'Proher':'Proits');
const objective=(k:GameLoreKeyed,g:Gender)=>word(k,g==='Male'?'ProhimObj':g==='Female'?'ProherObj':'ProitObj');
/** `GrammarResolverSimple.GetArg` / `GetArgsCount` (« : » separated, spaces trimmed). */
const args=(text:string)=>text.split(':').map(arg=>arg.replace(/^ +| +$/g,''));
/** `ResolveGenderSymbol`: two forms (male, female; none takes the first) or three. */
function genderForm(g:Gender,text:string,k:GameLoreKeyed):string {
 if(!text)return word(k,g==='Male'?'Male':g==='Female'?'Female':'NoneLower');
 const forms=args(text);
 if(forms.length===2)return g==='Female'?forms[1]!:forms[0]!;
 if(forms.length===3)return g==='Male'?forms[0]!:g==='Female'?forms[1]!:forms[2]!;
 return '';
}
/** `GrammarResolverSimple.Formatted` with one argument named PAWN: `{PAWN_x}`
 * and `{PAWN_x ? args}`. A symbol of another argument resolves to nothing, as
 * the game does after logging it. */
function formatted(text:string,person:LorePerson,k:GameLoreKeyed):string {
 if(!text.includes('{'))return text;
 const g=genderOf(person.sex);let out='',i=0;
 while(i<text.length){
  const c=text[i]!;
  if(c!=='{'){out+=c;i++;continue;}
  const close=text.indexOf('}',i+1);if(close<0){out+=text.slice(i);break;}
  const inner=text.slice(i+1,close);i=close+1;
  if(inner.startsWith('{')){out+=inner;continue;}
  const question=inner.indexOf('?'),head=question<0?inner:inner.slice(0,question),symbolArgs=question<0?'':inner.slice(question+1);
  const underscore=head.indexOf('_'),label=(underscore<0?head:head.slice(0,underscore)).trim(),sub=(underscore<0?'':head.slice(underscore+1)).replace(/ +$/,'');
  if(label!=='PAWN')continue;
  switch(sub){
   case '':case 'nameFull':case 'nameFullDef':case 'label':case 'labelNoParenthesis':case 'labelShort':case 'definite':case 'nameDef':case 'indefinite':case 'nameIndef':out+=person.name;break;
   case 'pronoun':out+=pronoun(k,g);break;
   case 'possessive':out+=possessive(k,g);break;
   case 'objective':out+=objective(k,g);break;
   case 'genderNoun':out+=word(k,g==='Male'?'ProHeNoun':g==='Female'?'ProSheNoun':'ProItNoun');break;
   case 'gender':case 'genderResolved':out+=genderForm(g,symbolArgs,k);break;
   case 'title':if(person.title)out+=person.title;break;
  }
 }
 return out;
}
/** `AdjustedFor`: the `[PAWN_x]` rules of `GrammarUtility.RulesForPawn` for a
 * named person (names take no article), then the resolution's
 * post-processing and capitalized sentences. A symbol without a rule is left
 * as written. */
function adjusted(text:string,person:LorePerson,k:GameLoreKeyed,worker:LanguageWorkerKind):string {
 const g=genderOf(person.sex),rules:Record<string,string>={nameFull:person.name,label:person.name,labelNoParenthesis:person.name,definite:person.name,nameDef:person.name,
  indefinite:person.name,nameIndef:person.name,pronoun:pronoun(k,g),possessive:possessive(k,g),objective:objective(k,g)};
 if(person.title)rules.title=person.title;
 const resolved=text.replace(/\[PAWN_([A-Za-z]+)\]/g,(whole,symbol:string)=>rules[symbol]??whole);
 return dotNetTrim(capitalizeSentences(languagePostProcessed(worker,resolved),true).replace(/ +([,.])/g,'$1'));
}
/** A game text about a person, resolved for that person. */
export function resolveGamePersonText(text:string,person:LorePerson,texts:GameLoreTexts|undefined=current):string {
 if(!texts)return text;
 return languagePostProcessed(texts.worker,adjusted(formatted(text,person,texts.keyed),person,texts.keyed,texts.worker));
}

// ---- Stories -------------------------------------------------------------------
export type StorySlot='childhood'|'adulthood';
/** The lore id of a story recorded on a person. */
export function backstoryLoreId(slot:StorySlot,id:string):string {
 return `histoires/${slot==='childhood'?'enfance':'adulte'}-${isCoreBackstoryId370(id)?'base':'elsewhere'}/${id}`;
}
const storyDefinition=(slot:StorySlot,id:string):BackgroundDefinition=>slot==='childhood'?childhoodDefinition(id as ChildhoodId):adulthoodDefinition(id as AdulthoodId);
/** Elsewhere's title of a story for the person's sex (Core `TitleFor`). */
export function elsewhereStoryTitle(story:BackgroundDefinition,sex?:'male'|'female'):string {
 return sex==='female'&&'labelFemale' in story&&typeof story.labelFemale==='string'?story.labelFemale:story.label;
}
/** The title of a story: `TitleFor(gender)` of the game when loaded. */
export function storyTitle(slot:StorySlot,id:string,sex?:'male'|'female'):string {
 const story=storyDefinition(slot,id),lore=backstoryLoreId(slot,id);
 const own=gameLoreText(lore,'title');
 if(own===undefined)return elsewhereStoryTitle(story,sex);
 return sex==='female'?gameLoreText(lore,'titleFemale')??own:own;
}
/** The short title (`TitleShortFor`), Elsewhere's when the game is not loaded. */
export function storyShortTitle(slot:StorySlot,id:string,sex?:'male'|'female'):string {
 const lore=backstoryLoreId(slot,id);
 if(gameLoreText(lore,'title')===undefined){const story=storyDefinition(slot,id);return 'labelShort' in story&&typeof story.labelShort==='string'?(sex==='female'&&'labelShortFemale' in story&&typeof story.labelShortFemale==='string'?story.labelShortFemale:story.labelShort):elsewhereStoryTitle(story,sex);}
 if(sex==='female'){const female=gameLoreText(lore,'shortTitleFemale');if(female)return female;}
 return gameLoreText(lore,'shortTitle')??storyTitle(slot,id,sex);
}
/** The story's text about the person. */
export function storyDescription(slot:StorySlot,id:string,person:LorePerson):string {
 const text=gameLoreText(backstoryLoreId(slot,id),'description');
 return text===undefined?storyDefinition(slot,id).description:resolveGamePersonText(text,person);
}

// ---- Traits --------------------------------------------------------------------
export const traitLoreId=(id:TraitId):string=>`traits/traits/${id}`;
/** The trait's name for the person (`GetLabelCapFor(gender)` of the game). */
export function traitLabel(id:TraitId,sex?:'male'|'female'):string {
 const lore=traitLoreId(id),fallback=TRAITS[id].label,own=gameLoreText(lore,'title');
 if(own===undefined)return fallback;
 return inCaseOf(sex==='female'?gameLoreText(lore,'titleFemale')??own:own,fallback);
}
export interface TraitTexts {
 readonly label:string;
 /** What the trait is: the game's text about the person, or Elsewhere's description. */
 readonly description:string;
 /** Elsewhere's account of the rule, given apart when the game's text replaces it. */
 readonly rule:string|undefined;
}
export function traitTexts(id:TraitId,person:LorePerson):TraitTexts {
 const text=gameLoreText(traitLoreId(id),'description'),own=TRAITS[id].description;
 return text===undefined?{label:traitLabel(id,person.sex),description:own,rule:undefined}:{label:traitLabel(id,person.sex),description:resolveGamePersonText(text,person),rule:own};
}
/** The tooltip text of a trait: the game's text then Elsewhere's rule. */
export function traitTooltip(id:TraitId,person:LorePerson):string {
 const texts=traitTexts(id,person);return texts.rule?`${texts.description}\n\n${texts.rule}`:texts.description;
}

// ---- Factions, places, things ---------------------------------------------------
export const factionTypeLabel=(def:string,fallback:string):string=>loreText(`factions/types/${def}`,'title',fallback);
export const factionDescription=(def:string):string|undefined=>gameLoreText(`factions/types/${def}`,'description');
/** The title of a faction's leader, `fallback` when the game is not loaded or has none. */
export function factionLeaderTitle(def:string,fallback:string,sex?:'male'|'female'):string {
 const id=`factions/${GAME_LORE_LEADER_GROUP}/${def}`,own=gameLoreText(id,'title');
 if(own===undefined)return fallback;
 return inCaseOf(sex==='female'?gameLoreText(id,'titleFemale')??own:own,fallback);
}
export const itemTitle=(item:string,fallback:string):string=>loreText(`descriptions/objets/${item}`,'title',fallback);
export const itemDescription=(item:string):string|undefined=>gameLoreText(`descriptions/objets/${item}`,'description');
export const animalTitle=(species:string,fallback:string):string=>loreText(`descriptions/animaux/${species}`,'title',fallback);
export const animalDescription=(species:string):string|undefined=>gameLoreText(`descriptions/animaux/${species}`,'description');
export const wildPlantTitle=(species:string,fallback:string):string=>loreText(`descriptions/plantes-sauvages/${species}`,'title',fallback);
export const cropTitle=(kind:string,fallback:string):string=>loreText(`descriptions/cultures/${kind}`,'title',fallback);
export const buildingTitle=(kind:string,fallback:string):string=>loreText(`descriptions/batiments/${kind}`,'title',fallback);
export const buildingDescription=(kind:string):string|undefined=>gameLoreText(`descriptions/batiments/${kind}`,'description');
export const biomeTitle=(biome:string,fallback:string):string=>loreText(`lieux/milieux/${biome}`,'title',fallback);
export const biomeDescription=(biome:string):string|undefined=>gameLoreText(`lieux/milieux/${biome}`,'description');
export const roleTitle=(id:string,fallback:string):string=>loreText(`personnes/roles/${id}`,'title',fallback);
