import { BACKGROUND_ADULT_MIN_TICKS,childhoodDefinition,adulthoodDefinition,type BackgroundWorkTag,type ColonistBackground } from './colonist-backgrounds.ts';
import { CORE_BACKSTORIES_370,CORE_BACKSTORY_LIST_370,CORE_WORK_TYPE_TAGS_370,coreBackstoryBody370,isCoreBackstoryId370,type CoreBackstory370,type CoreBackstorySlot370 } from './core-backstories-370.ts';
import { WORLD_FACTION_DEFINITIONS_256,WORLD_FACTION_TECH_LEVEL_259,isWorldFactionDef256 } from './world-faction-catalog.ts';
import type { Pawn,World } from './types.ts';

/** Schema 370: Core's shuffled backstory draw (PawnBioAndNameGenerator).
 *
 * Core facts:
 * - GiveAppropriateBioAndNameTo first tries a solid bio (a named person) with
 *   a 25 % chance, or always for a faction leader. Solid bios hold real
 *   people's names and are not part of Elsewhere: the shuffled path is taken.
 * - GetBackstoryCategoryFiltersFor (adult): the kind's override filters, else
 *   the kind's filters followed by the faction's, else the fallback "Civil".
 * - FillBackstorySlotShuffled, once per slot (childhood first, then the
 *   adulthood from 20 biological years): one filter by commonality, the
 *   shuffleable stories it matches; a childhood must leave at least one
 *   matching adulthood whose required work tags it does not disable (on a
 *   same work type); 20 picks with replacement (TakeRandom), an adulthood
 *   whose required tags the childhood disables is skipped, and the streamed
 *   weighted choice by SelectionWeightFactorFromWorkTagsDisabled (Manual dumb
 *   ×0.5, Violent ×0.6, Social ×0.7, Intellectual ×0.4, Firefighting ×0.8).
 *   With nothing left, any story of the slot (Core logs an error).
 * - PawnGenerator retries the whole person (120 tries) when the request needs
 *   violence or the kind needs work tags the person cannot do: Elsewhere
 *   retries the two stories on the same private stream.
 * The draws use Elsewhere's private birth stream in Core's order; they are not
 * bit-identical to Core's Verse.Rand. */
export const isBackstories370=(schema:number):boolean=>schema>=370;

export interface BackstoryFilter370 {
  readonly categories?:readonly string[];readonly exclude?:readonly string[];
  readonly categoriesChildhood?:readonly string[];readonly excludeChildhood?:readonly string[];
  readonly categoriesAdulthood?:readonly string[];readonly excludeAdulthood?:readonly string[];
  readonly commonality:number;
}
const filter=(categories:readonly string[],commonality=1):BackstoryFilter370=>Object.freeze({categories:Object.freeze([...categories]),commonality});
/** PawnBioAndNameGenerator.FallbackCategoryGroup. No Core shuffled story has it. */
export const FALLBACK_BACKSTORY_FILTER_370=filter(['Civil']);
const OUTLANDER=Object.freeze([filter(['Outlander'],.95),filter(['Offworld'],.05)]),TRIBAL=Object.freeze([filter(['Tribal'])]),OFFWORLD=Object.freeze([filter(['Offworld'])]);
/** FactionDefs backstoryFilters (Core, resolved through inheritance). */
export const FACTION_BACKSTORY_FILTERS_370:Readonly<Record<string,readonly BackstoryFilter370[]>>=Object.freeze({
  PlayerColony:OFFWORLD,PlayerTribe:TRIBAL,OutlanderCivil:OUTLANDER,OutlanderRough:OUTLANDER,
  TribeCivil:TRIBAL,TribeRough:TRIBAL,TribeSavage:TRIBAL,Pirate:Object.freeze([filter(['Pirate'])]),Ancients:OFFWORLD,AncientsHostile:OFFWORLD,
});
export interface CoreKindBackstory370 {readonly filters?:readonly BackstoryFilter370[];readonly override?:readonly BackstoryFilter370[];readonly requiredWorkTags?:readonly BackgroundWorkTag[]}
const HUNTER=Object.freeze([Object.freeze({categoriesChildhood:Object.freeze(['Tribal']),categoriesAdulthood:Object.freeze(['TribalHunter']),commonality:1})]);
const OUTSIDER=Object.freeze([filter(['Offworld','Outlander','Outsider'])]);
const VIOLENT:readonly BackgroundWorkTag[]=Object.freeze(['violent']);
/** The human PawnKindDefs whose backstory fields are set (the others have
 * none and read their faction's filters). */
export const CORE_KIND_BACKSTORY_370:Readonly<Record<string,CoreKindBackstory370>>=Object.freeze({
  Slave:{override:OUTSIDER},StrangerInBlack:{override:OUTSIDER,requiredWorkTags:['violent','caring']},
  WildMan:{filters:Object.freeze([filter(['Offworld','Pirate','Tribal'])])},
  Tribal_Hunter:{override:HUNTER,requiredWorkTags:VIOLENT},Tribal_Trader:{override:HUNTER,requiredWorkTags:VIOLENT},
  Tribal_Archer:{requiredWorkTags:VIOLENT},Tribal_Warrior:{requiredWorkTags:VIOLENT},Tribal_Berserker:{requiredWorkTags:VIOLENT},
  Tribal_HeavyArcher:{requiredWorkTags:VIOLENT},Tribal_ChiefMelee:{requiredWorkTags:VIOLENT},Tribal_ChiefRanged:{requiredWorkTags:VIOLENT},
  AncientSoldier:{requiredWorkTags:VIOLENT},
});
/** GetBackstoryCategoryFiltersFor, for an adult (the only persons Elsewhere
 * generates). */
export function backstoryFiltersFor370(kind:string|undefined,factionDef:string|undefined):readonly BackstoryFilter370[] {
  const k=kind!==undefined&&Object.hasOwn(CORE_KIND_BACKSTORY_370,kind)?CORE_KIND_BACKSTORY_370[kind]:undefined;
  if(k?.override?.length)return k.override;
  const list:BackstoryFilter370[]=[...k?.filters??[]];
  for(const f of factionDef!==undefined&&Object.hasOwn(FACTION_BACKSTORY_FILTERS_370,factionDef)?FACTION_BACKSTORY_FILTERS_370[factionDef]!:[])if(!list.includes(f))list.push(f);
  return list.length?list:[FALLBACK_BACKSTORY_FILTER_370];
}
const any=(list:readonly string[]|undefined,of:readonly string[])=>!!list&&of.some(c=>list.includes(c));
/** BackstoryCategoryFilter.Matches(BackstoryDef). */
export function backstoryFilterMatches370(f:BackstoryFilter370,bs:CoreBackstory370):boolean {
  if(f.exclude&&any(f.exclude,bs.categories))return false;
  if(f.excludeChildhood?.length&&bs.slot==='childhood'&&any(f.excludeChildhood,bs.categories))return false;
  if(f.excludeAdulthood?.length&&bs.slot==='adulthood'&&any(f.excludeAdulthood,bs.categories))return false;
  if(f.categoriesChildhood?.length&&bs.slot==='childhood'&&!any(f.categoriesChildhood,bs.categories))return false;
  if(f.categoriesAdulthood?.length&&bs.slot==='adulthood'&&!any(f.categoriesAdulthood,bs.categories))return false;
  if(bs.requiresCategory){
    if(!f.categories?.length&&!f.categoriesChildhood?.length&&bs.slot==='childhood')return false;
    if(!f.categories?.length&&!f.categoriesAdulthood?.length&&bs.slot==='adulthood')return false;
  }
  return f.categories?any(f.categories,bs.categories):true;
}
/** WorkTypeDefsUtility.OverlapsWithOnAnyWorkType over Core's work types. */
export const workTagsOverlapOnAnyWorkType370=(a:readonly BackgroundWorkTag[],b:readonly BackgroundWorkTag[]):boolean=>
  !!a.length&&!!b.length&&Object.values(CORE_WORK_TYPE_TAGS_370).some(tags=>tags.some(t=>a.includes(t))&&tags.some(t=>b.includes(t)));
/** SelectionWeightFactorFromWorkTagsDisabled. */
export function backstorySelectionWeight370(bs:CoreBackstory370):number {
  let w=1;const d=bs.disables;
  if(d.includes('manual-dumb'))w*=.5;
  if(d.includes('violent'))w*=.6;
  if(d.includes('social'))w*=.7;
  if(d.includes('intellectual'))w*=.4;
  if(d.includes('firefighting'))w*=.8;
  return w;
}
/** GenCollection.RandomElementByWeight on a list: a single positive item is
 * returned without a draw. */
function weightedFromList<T>(items:readonly T[],weight:(t:T)=>number,draw:()=>number):T|undefined {
  const total=items.reduce((s,t)=>s+Math.max(0,weight(t)),0);
  if(items.length===1&&total>0)return items[0];
  if(total<=0)return undefined;
  const roll=draw()*total;let sum=0;
  for(const t of items){const w=weight(t);if(w<=0)continue;sum+=w;if(sum>=roll)return t;}
  return items.findLast(t=>weight(t)>0);
}
/** FillBackstorySlotShuffled for one slot. `draw` is a sequential stream. */
export function fillBackstorySlot370(draw:()=>number,slot:CoreBackstorySlot370,filters:readonly BackstoryFilter370[],childhood?:CoreBackstory370,mustBeCompatibleTo?:CoreBackstorySlot370):CoreBackstory370 {
  const f=weightedFromList(filters,c=>c.commonality,draw)??FALLBACK_BACKSTORY_FILTER_370;
  const source=CORE_BACKSTORY_LIST_370.filter(bs=>backstoryFilterMatches370(f,bs));
  let pool:CoreBackstory370[];
  if(!mustBeCompatibleTo)pool=source.filter(bs=>bs.slot===slot);
  else{
    const compatible=source.filter(bs=>bs.slot===mustBeCompatibleTo);
    pool=source.filter(bs=>bs.slot===slot&&compatible.some(b=>!workTagsOverlapOnAnyWorkType370(b.requires,bs.disables)));
  }
  // TakeRandom(20), the adulthood filter, then the streamed weighted choice.
  let result:CoreBackstory370|undefined,total=0;
  for(let i=0;pool.length&&i<20;i++){
    const bs=pool[Math.min(pool.length-1,Math.floor(draw()*pool.length))]!;
    if(slot==='adulthood'&&bs.requires.length&&childhood&&workTagsOverlapOnAnyWorkType370(bs.requires,childhood.disables))continue;
    const w=backstorySelectionWeight370(bs);
    if(!result){if(w>0){result=bs;total=w;}continue;}
    if(draw()*(total+w)>=total)result=bs;
    total+=w;
  }
  if(result)return result;
  const all=CORE_BACKSTORY_LIST_370.filter(bs=>bs.slot===slot);
  return all[Math.min(all.length-1,Math.floor(draw()*all.length))]!;
}
/** GiveShuffledBioTo's backstory part: a childhood (compatible with an
 * adulthood to come from 20 years), then the adulthood. */
export function drawCoreBackground370(draw:()=>number,biologicalTicks:number,filters:readonly BackstoryFilter370[]):ColonistBackground {
  const adult=biologicalTicks>=BACKGROUND_ADULT_MIN_TICKS;
  const childhood=fillBackstorySlot370(draw,'childhood',filters,undefined,adult?'adulthood':undefined);
  const adulthood=adult?fillBackstorySlot370(draw,'adulthood',filters,childhood):undefined;
  return {childhood:childhood.id as ColonistBackground['childhood'],...adulthood?{adulthood:adulthood.id as NonNullable<ColonistBackground['adulthood']>}:{}};
}
export const coreBackgroundDisables370=(b:ColonistBackground,tag:BackgroundWorkTag):boolean=>
  childhoodDefinition(b.childhood).disables.includes(tag)||!!b.adulthood&&adulthoodDefinition(b.adulthood).disables.includes(tag);
export interface CoreBackstoryRules370 {readonly violent?:boolean;readonly requiredWorkTags?:readonly BackgroundWorkTag[]}
/** PawnGenerator's retry (120 tries) for a request that needs violence or a
 * kind's required work tags; the last draw is kept when none passes. */
export function drawAdmittedCoreBackground370(draw:()=>number,biologicalTicks:number,filters:readonly BackstoryFilter370[],rules:CoreBackstoryRules370={}):ColonistBackground {
  const required=[...rules.violent?['violent' as const]:[],...rules.requiredWorkTags??[]];
  let background=drawCoreBackground370(draw,biologicalTicks,filters);
  for(let attempt=1;attempt<120&&required.some(tag=>coreBackgroundDisables370(background,tag));attempt++)background=drawCoreBackground370(draw,biologicalTicks,filters);
  return background;
}

const hash=(seed:number,identity:number,salt:number):number=>{
  let n=(seed^Math.imul(identity,0x9e3779b1)^salt)>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
};
/** A private sequential birth stream: the seed and the person's identity,
 * never a shared simulation stream. */
export function backstoryStream370(seed:number,identity:number):()=>number {
  let counter=0;return ()=>hash(seed^0x370b5f7,identity,0x3700000+counter++)/0x100000000;
}

type FactionWorld=Pick<World,'worldFactions'>;
/** FactionManager.TryGetRandomNonColonyHumanlikeFaction (allowDefeated as
 * asked, never temporary): weight 0.1 below Medieval when asked to prefer
 * Medieval or better, else 1; the streamed weighted choice. */
export function randomNonColonyHumanlikeFactionDef370(w:FactionWorld,draw:()=>number,tryMedievalOrBetter:boolean,allowDefeated:boolean):string|undefined {
  let result:string|undefined,total=0;
  for(const f of w.worldFactions?.factions??[]){
    if(!isWorldFactionDef256(f.def))continue;
    const def=WORLD_FACTION_DEFINITIONS_256[f.def];
    if(def.player||f.hidden||!def.humanlike||!allowDefeated&&f.lifecycle259?.defeated||f.lifecycle259?.temporary)continue;
    const weight=tryMedievalOrBetter&&WORLD_FACTION_TECH_LEVEL_259[f.def]<3?.1:1;
    if(!result){result=f.def;total=weight;continue;}
    if(draw()*(total+weight)>=total)result=f.def;
    total+=weight;
  }
  return result;
}
/** The Core FactionDef of a person's real world faction, when bound. */
export function pawnFactionDef370(w:FactionWorld,pawn:Pick<Pawn,'worldAffiliation259'>):string|undefined {
  const id=pawn.worldAffiliation259?.factionId;if(id===undefined||id===null)return undefined;
  return w.worldFactions?.factions.find(f=>f.id===id)?.def;
}
/** How a birth names its faction for the bio (PawnGenerator's faction2):
 * the request's faction, or a random non-colony humanlike faction (Ancients
 * when none). A refugee pod's request first tries, with a 60 % chance, a
 * random faction preferring Medieval or better (DownedRefugeeQuestUtility). */
export type CoreBirthFaction370={def:string}|'random'|'refugee';
/** `fallbackFaction`: the Core FactionDef of a person born without a bound
 * world faction (a world from before the world factions). */
export interface CoreBirth370 {readonly kind?:string;readonly faction?:CoreBirthFaction370;readonly violent?:boolean;readonly fallbackFaction?:string}
export function birthFactionDef370(w:FactionWorld,draw:()=>number,faction:CoreBirthFaction370|undefined,fallback:string|undefined):string {
  if(faction&&typeof faction==='object')return faction.def;
  if(faction===undefined&&fallback!==undefined)return fallback;
  if(faction==='refugee'&&draw()<.6){const def=randomNonColonyHumanlikeFactionDef370(w,draw,true,false);if(def)return def;}
  return randomNonColonyHumanlikeFactionDef370(w,draw,false,true)??'Ancients';
}
/** Core GetBodyTypeFor: a person with an adulthood takes its body type. */
export function applyCoreBackstoryBody370(pawn:Pick<Pawn,'background'|'appearance'>):void {
  const id=pawn.background?.adulthood,a=pawn.appearance;
  if(!a||!isCoreBackstoryId370(id))return;
  const body=coreBackstoryBody370(CORE_BACKSTORIES_370[id],a.sex);if(body)pawn.appearance={...a,bodyType:body};
}
