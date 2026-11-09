import { TICKS_PER_DAY, type Pawn, type WorkType } from './types.ts';
import type { HumanAge } from './human-age.ts';

export type BackgroundWorkTag = 'manual-dumb' | 'manual-skilled' | 'caring' | 'social' | 'intellectual' | 'plant-work' | 'artistic' | 'animals' | 'hunting' | 'violent' | 'firefighting';
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
export type ChildhoodId = keyof typeof CHILDHOODS;
export type AdulthoodId = keyof typeof ADULTHOODS;
export interface ColonistBackground { childhood:ChildhoodId; adulthood?:AdulthoodId }
export type BackgroundBearer=Pick<Pawn,'background'>;
export const BACKGROUND_WORK_LABELS:Readonly<Record<WorkType,string>>=Object.freeze({handle:'Dressage',art:'Art',clean:'Nettoyage',firefight:'Incendie',warden:'Geôlier',basic:'Manutention',hunt:'Chasse',research:'Recherche',patient:'Patient',bedrest:'Repos au lit',doctor:'Médecin',mine:'Minage',gather:'Foresterie',build:'Construction',haul:'Transport',grow:'Culture',cook:'Cuisine',craft:'Artisanat',smith:'Forge',tailor:'Couture'});
const WORK_TAGS:Readonly<Record<WorkType,readonly BackgroundWorkTag[]>>={
  handle:['animals'],art:['artistic'],clean:['manual-dumb'],firefight:['firefighting'],warden:['social'],basic:[],hunt:['hunting','violent'],research:['intellectual'],patient:[],bedrest:[],doctor:['caring'],mine:['manual-skilled'],gather:['manual-skilled','plant-work'],build:['manual-skilled'],haul:['manual-dumb'],grow:['manual-skilled','plant-work'],cook:['manual-skilled'],craft:['manual-skilled'],smith:['manual-skilled'],tailor:['manual-skilled'],
};
const SKILL_TAGS:Readonly<Record<BackgroundSkillId,readonly BackgroundWorkTag[]>>={shooting:['violent'],melee:['violent'],construction:['manual-skilled'],mining:['manual-skilled'],cooking:['manual-skilled'],plants:['manual-skilled','plant-work'],animals:['animals'],crafting:['manual-skilled'],artistic:['artistic'],medicine:['caring'],social:['social'],intellectual:['intellectual']};

export function backgroundDefinitions(pawn:BackgroundBearer):readonly BackgroundDefinition[] {
  const b=pawn.background;
  return b?[CHILDHOODS[b.childhood],...(b.adulthood?[ADULTHOODS[b.adulthood]]:[])]:[];
}
export function backgroundTagRefusal(pawn:BackgroundBearer,tag:BackgroundWorkTag):string|undefined {
  const b=pawn.background;if(!b)return undefined;
  const childhood=CHILDHOODS[b.childhood],adulthood=b.adulthood?ADULTHOODS[b.adulthood]:undefined;
  const cause=childhood.disables.includes(tag)?childhood:adulthood?.disables.includes(tag)?adulthood:undefined;
  return cause?`Incapacité liée au passé : ${cause.label}.`:undefined;
}
export function backgroundWorkRefusal(pawn:BackgroundBearer,work:WorkType):string|undefined {
  if(!pawn.background)return undefined;
  for(const tag of WORK_TAGS[work]){const reason=backgroundTagRefusal(pawn,tag);if(reason)return `${BACKGROUND_WORK_LABELS[work]} impossible. ${reason}`;}
  return undefined;
}
export const violentWorkRefusal=(pawn:BackgroundBearer):string|undefined=>backgroundTagRefusal(pawn,'violent');
export function backgroundSkillRefusal(pawn:BackgroundBearer,skill:BackgroundSkillId):string|undefined {
  if(!pawn.background)return undefined;
  // Animals contributes to both Handling and Hunting in Core; one remaining
  // allowed work type keeps the skill usable even if Handling is forbidden.
  if(skill==='animals'&&(!backgroundWorkRefusal(pawn,'handle')||!backgroundWorkRefusal(pawn,'hunt')))return undefined;
  for(const tag of SKILL_TAGS[skill]){const reason=backgroundTagRefusal(pawn,tag);if(reason)return reason;}
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
  if(!Object.hasOwn(b,'childhood')||Object.keys(b).some(k=>k!=='childhood'&&k!=='adulthood')||typeof b.childhood!=='string'||!Object.hasOwn(CHILDHOODS,b.childhood))return false;
  if(Object.hasOwn(b,'adulthood')&&(typeof b.adulthood!=='string'||!Object.hasOwn(ADULTHOODS,b.adulthood)||age!==undefined&&(!age||!Number.isSafeInteger(age.biologicalTicks)||age.biologicalTicks<BACKGROUND_ADULT_MIN_TICKS)))return false;
  if(typeof b.adulthood==='string'&&ADULTHOODS[b.adulthood as AdulthoodId].requires.some(tag=>CHILDHOODS[b.childhood as ChildhoodId].disables.includes(tag)))return false;
  return true;
}
