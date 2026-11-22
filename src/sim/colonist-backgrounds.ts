import { TICKS_PER_DAY, type Pawn, type WorkType } from './types.ts';
import type { HumanAge } from './human-age.ts';
import { TRAITS,traitDisablingWorkTag } from './traits.ts';
import { CORE_BACKSTORIES_370,CORE_SKILL_EXTRA_TAGS_370,CORE_WORK_TYPE_TAGS_370,isCoreBackstoryId370,type CoreBackstoryId370 } from './core-backstories-370.ts';

export type BackgroundWorkTag = 'manual-dumb' | 'manual-skilled' | 'caring' | 'social' | 'intellectual' | 'plant-work' | 'artistic' | 'animals' | 'hunting' | 'violent' | 'firefighting'
  /** Schema 370: the other Core WorkTags, only ever disabled by a Core backstory. */
  | 'commoner' | 'crafting' | 'cooking' | 'cleaning' | 'hauling' | 'mining' | 'constructing' | 'shooting' | 'all-work';
export const BACKGROUND_SKILL_IDS = ['shooting','melee','construction','mining','cooking','plants','animals','crafting','artistic','medicine','social','intellectual'] as const;
export type BackgroundSkillId = typeof BACKGROUND_SKILL_IDS[number];
export const BACKGROUND_ADULT_MIN_TICKS = 20 * 60 * TICKS_PER_DAY;
export interface BackgroundDefinition {
  readonly label:string;
  readonly description:string;
  readonly gains:Readonly<Partial<Record<BackgroundSkillId,number>>>;
  readonly disables:readonly BackgroundWorkTag[];
  readonly requires:readonly BackgroundWorkTag[];
}
const define=(label:string,description:string,gains:BackgroundDefinition['gains'],disables:readonly BackgroundWorkTag[]=[],requires:readonly BackgroundWorkTag[]=[]):BackgroundDefinition=>
  Object.freeze({label,description,gains:Object.freeze(gains),disables:Object.freeze([...disables]),requires:Object.freeze([...requires])});

/** Original Lisière stories. Their finite selection and numbers are authored
 * adaptations, not a copy or claim of the complete Core backstory catalogue. */
export const CHILDHOODS = Object.freeze({
  'settlement-child':define('Enfant du village','A participé aux potagers et à la cuisine commune, apprenant à faire durer les récoltes.',{plants:3,cooking:1}),
  'workshop-child':define('Apprenti d’atelier','A grandi parmi les outils et les réparations, sous la surveillance de plusieurs artisans.',{construction:3,crafting:2}),
  'school-child':define('Élève studieux','A passé ses premières années à étudier et à expliquer ses découvertes à ses camarades.',{intellectual:3,social:1}),
  'field-child':define('Enfant des pâturages','A suivi les troupeaux et entretenu les cultures au rythme des saisons.',{plants:2,animals:2,shooting:1}),
  'quiet-child':define('Éducation pacifique','A appris le dessin et la lecture dans une communauté qui rejetait toute violence.',{artistic:3,intellectual:1},['violent']),
  'sheltered-child':define('Enfant protégé','A appris à écouter et à soigner de petites blessures. Un incendie vécu dans sa jeunesse lui a laissé une peur durable des flammes.',{social:2,medicine:1},['firefighting']),
});
export const ADULTHOODS = Object.freeze({
  builder:define('Bâtisseur','A consacré sa vie adulte à monter et réparer les bâtiments de petites colonies.',{construction:4,crafting:2}),
  farmer:define('Exploitant agricole','A entretenu des champs, des troupeaux et les réserves alimentaires nécessaires à leur communauté.',{plants:4,animals:2,cooking:1}),
  medic:define('Soignant pacifiste','A traité les blessés de plusieurs conflits et refuse désormais de participer à la violence.',{medicine:4,social:1},['violent']),
  researcher:define('Chercheur','A travaillé dans un laboratoire où les tâches manuelles simples étaient toujours confiées à d’autres.',{intellectual:5},['manual-dumb']),
  mercenary:define('Mercenaire','A appris à combattre pour survivre. Refuse de prendre en charge les soins des autres.',{shooting:4,melee:4},['caring'],['violent']),
  artisan:define('Artisan','A fabriqué des objets utilitaires et des sculptures pour les communautés de passage.',{crafting:4,artistic:2}),
  merchant:define('Négociant','A vécu du commerce et de la négociation, sans apprendre les métiers manuels qualifiés.',{social:5},['manual-skilled']),
  hermit:define('Éleveur solitaire','A vécu loin des centres habités, avec ses cultures et ses animaux. Refuse les tâches de négociation et de gestion des prisonniers.',{plants:3,animals:3},['social']),
});
export type ElsewhereChildhoodId = keyof typeof CHILDHOODS;
export type ElsewhereAdulthoodId = keyof typeof ADULTHOODS;
/** Schema 370 adds Core's backstories (core-backstories-370.ts), keyed by defName. */
export type ChildhoodId = ElsewhereChildhoodId | CoreBackstoryId370;
export type AdulthoodId = ElsewhereAdulthoodId | CoreBackstoryId370;
export const childhoodDefinition=(id:ChildhoodId):BackgroundDefinition=>isCoreBackstoryId370(id)?CORE_BACKSTORIES_370[id]:CHILDHOODS[id];
export const adulthoodDefinition=(id:AdulthoodId):BackgroundDefinition=>isCoreBackstoryId370(id)?CORE_BACKSTORIES_370[id]:ADULTHOODS[id];
export interface ColonistBackground { childhood:ChildhoodId; adulthood?:AdulthoodId }
/** Schema 368: the traits are read with the background (Core
 * CombinedDisabledWorkTags reads backstories and traits alike). */
export type BackgroundBearer=Pick<Pawn,'background'>&Partial<Pick<Pawn,'traits'>>;
export const BACKGROUND_WORK_LABELS:Readonly<Record<WorkType,string>>=Object.freeze({handle:'Dressage',art:'Art',clean:'Nettoyage',firefight:'Incendie',warden:'Geôlier',basic:'Manutention',hunt:'Chasse',research:'Recherche',patient:'Patient',bedrest:'Repos au lit',doctor:'Médecin',mine:'Minage',gather:'Foresterie',build:'Construction',haul:'Transport',grow:'Culture',cook:'Cuisine',craft:'Artisanat',smith:'Forge',tailor:'Couture'});
const WORK_TAGS:Readonly<Record<WorkType,readonly BackgroundWorkTag[]>>={
  handle:['animals'],art:['artistic'],clean:['manual-dumb'],firefight:['firefighting'],warden:['social'],basic:[],hunt:['hunting','violent'],research:['intellectual'],patient:[],bedrest:[],doctor:['caring'],mine:['manual-skilled'],gather:['manual-skilled','plant-work'],build:['manual-skilled'],haul:['manual-dumb'],grow:['manual-skilled','plant-work'],cook:['manual-skilled'],craft:['manual-skilled'],smith:['manual-skilled'],tailor:['manual-skilled'],
};
const CORE_EXTRA_WORK_TAGS=Object.fromEntries((Object.keys(WORK_TAGS) as WorkType[]).map(work=>[work,CORE_WORK_TYPE_TAGS_370[work].filter(tag=>!WORK_TAGS[work].includes(tag))])) as unknown as Readonly<Record<WorkType,readonly BackgroundWorkTag[]>>;
const SKILL_TAGS:Readonly<Record<BackgroundSkillId,readonly BackgroundWorkTag[]>>={shooting:['violent'],melee:['violent'],construction:['manual-skilled'],mining:['manual-skilled'],cooking:['manual-skilled'],plants:['manual-skilled','plant-work'],animals:['animals'],crafting:['manual-skilled'],artistic:['artistic'],medicine:['caring'],social:['social'],intellectual:['intellectual']};

export function backgroundDefinitions(pawn:BackgroundBearer):readonly BackgroundDefinition[] {
  const b=pawn.background;
  return b?[childhoodDefinition(b.childhood),...(b.adulthood?[adulthoodDefinition(b.adulthood)]:[])]:[];
}
export function backgroundTagRefusal(pawn:BackgroundBearer,tag:BackgroundWorkTag):string|undefined {
  const b=pawn.background;
  if(b){
    const childhood=childhoodDefinition(b.childhood),adulthood=b.adulthood?adulthoodDefinition(b.adulthood):undefined;
    const cause=childhood.disables.includes(tag)?childhood:adulthood?.disables.includes(tag)?adulthood:undefined;
    if(cause)return `Incapacité liée au passé : ${cause.label}.`;
  }
  // Schema 368: a trait's disabledWorkTags (Pyromaniac: Firefighting).
  const trait=traitDisablingWorkTag(pawn,tag);
  return trait?`Incapacité liée au trait : ${TRAITS[trait].label}.`:undefined;
}
export function backgroundWorkRefusal(pawn:BackgroundBearer,work:WorkType):string|undefined {
  if(!pawn.background&&!pawn.traits)return undefined;
  for(const tag of WORK_TAGS[work]){const reason=backgroundTagRefusal(pawn,tag);if(reason)return `${BACKGROUND_WORK_LABELS[work]} impossible. ${reason}`;}
  // Schema 370: the rest of Core's tags of this work type (a Core story only).
  if(isCoreBackstoryId370(pawn.background?.childhood))for(const tag of CORE_EXTRA_WORK_TAGS[work]){const reason=backgroundTagRefusal(pawn,tag);if(reason)return `${BACKGROUND_WORK_LABELS[work]} impossible. ${reason}`;}
  return undefined;
}
export const violentWorkRefusal=(pawn:BackgroundBearer):string|undefined=>backgroundTagRefusal(pawn,'violent');
export function backgroundSkillRefusal(pawn:BackgroundBearer,skill:BackgroundSkillId):string|undefined {
  if(!pawn.background&&!pawn.traits)return undefined;
  // Animals contributes to both Handling and Hunting in Core; one remaining
  // allowed work type keeps the skill usable even if Handling is forbidden.
  if(skill==='animals'&&(!backgroundWorkRefusal(pawn,'handle')||!backgroundWorkRefusal(pawn,'hunt')))return undefined;
  for(const tag of SKILL_TAGS[skill]){const reason=backgroundTagRefusal(pawn,tag);if(reason)return reason;}
  if(isCoreBackstoryId370(pawn.background?.childhood))for(const tag of CORE_SKILL_EXTRA_TAGS_370[skill]??[]){const reason=backgroundTagRefusal(pawn,tag);if(reason)return reason;}
  return undefined;
}
export function backgroundGains(background:ColonistBackground):Readonly<Partial<Record<BackgroundSkillId,number>>> {
  const gains:Partial<Record<BackgroundSkillId,number>>={};
  for(const story of backgroundDefinitions({background}))for(const skill of BACKGROUND_SKILL_IDS)if(story.gains[skill]!==undefined)gains[skill]=(gains[skill]??0)+story.gains[skill]!;
  return gains;
}
/** Absence remains neutral even after migration. A child-only record may later
 * age beyond twenty; loading or a birthday never invents a new profession. */
export function validBackground(value:unknown,version:number,age?:HumanAge):boolean {
  if(value===undefined)return true;
  if(version<191||!value||typeof value!=='object'||Array.isArray(value)||!age)return false;
  const b=value as Record<string,unknown>;
  if(!Object.hasOwn(b,'childhood')||Object.keys(b).some(k=>k!=='childhood'&&k!=='adulthood')||typeof b.childhood!=='string')return false;
  if(isCoreBackstoryId370(b.childhood))return validCoreBackground370(b,version,age);
  if(!Object.hasOwn(CHILDHOODS,b.childhood))return false;
  if(Object.hasOwn(b,'adulthood')&&(typeof b.adulthood!=='string'||!Object.hasOwn(ADULTHOODS,b.adulthood)||age!==undefined&&(!age||!Number.isSafeInteger(age.biologicalTicks)||age.biologicalTicks<BACKGROUND_ADULT_MIN_TICKS)))return false;
  if(typeof b.adulthood==='string'&&ADULTHOODS[b.adulthood as ElsewhereAdulthoodId].requires.some(tag=>CHILDHOODS[b.childhood as ElsewhereChildhoodId].disables.includes(tag)))return false;
  return true;
}
/** Schema 370: a Core childhood (Childhood slot) and, from twenty years, a
 * Core adulthood (Adulthood slot); the two catalogues never mix. Core's own
 * pairing rule is a draw rule, not a pawn invariant (its fallback and fixed
 * kind stories may break it), so it is not required of a record. */
function validCoreBackground370(b:Record<string,unknown>,version:number,age:HumanAge):boolean {
  if(version<370||!isCoreBackstoryId370(b.childhood)||CORE_BACKSTORIES_370[b.childhood].slot!=='childhood')return false;
  if(!Object.hasOwn(b,'adulthood'))return true;
  return isCoreBackstoryId370(b.adulthood)&&CORE_BACKSTORIES_370[b.adulthood].slot==='adulthood'&&Number.isSafeInteger(age.biologicalTicks)&&age.biologicalTicks>=BACKGROUND_ADULT_MIN_TICKS;
}
