import {
  adulthoodDefinition, childhoodDefinition, BACKGROUND_SKILL_IDS, BACKGROUND_WORK_LABELS,
  backgroundSkillRefusal, backgroundWorkRefusal, violentWorkRefusal,
  type BackgroundBearer, type BackgroundSkillId,
} from '../sim/colonist-backgrounds.ts';
import { loreTextsRevision, storyDescription, storyTitle, type StorySlot } from '../lore/lore-text.ts';
import type { Pawn, WorkType } from '../sim/types.ts';
import { learningFactor, XP_SCALE, xpRequired, type PawnSkills, type SkillRecord } from '../sim/skills.ts';
import type { TooltipContent } from './tooltip';
import { setTooltip } from './tooltip';
import './background-inspection.css';

export const BACKGROUND_SKILL_LABELS: Readonly<Record<BackgroundSkillId, string>> = Object.freeze({
  shooting:'Tir', melee:'Mêlée', construction:'Construction', mining:'Minage', cooking:'Cuisine',
  plants:'Plantes', animals:'Animaux', crafting:'Artisanat', artistic:'Artistique', medicine:'Médecine',
  social:'Social', intellectual:'Intellectuel',
});
const tagLabels = {
  'manual-dumb':'Travail manuel simple', 'manual-skilled':'Travail manuel qualifié', caring:'Soins aux autres',
  social:'Travail social', intellectual:'Recherche', 'plant-work':'Travail des plantes', artistic:'Art',
  animals:'Dressage', hunting:'Chasse', violent:'Violence', firefighting:'Lutte contre les incendies',
  // Schema 370: the other Core work tags.
  commoner:'Travail ordinaire', crafting:'Artisanat', cooking:'Cuisine', cleaning:'Nettoyage', hauling:'Transport',
  mining:'Minage', constructing:'Construction', shooting:'Tir', 'all-work':'Tout travail',
} as const;
export interface BackgroundInspectionRow { phase:string; label:string; tooltip:TooltipContent }
export interface BackgroundRestrictionRow { label:string; reason:string }

/** Title and text come from the lore lookup (src/lore/lore-text.ts): the
 * installed RimWorld's when the player loaded it, Elsewhere's otherwise. Gains
 * and refusals are rules and always Elsewhere's. */
function storyRow(phase:string, slot:StorySlot, id:string, person:{name:string;sex?:'male'|'female';title?:string}):BackgroundInspectionRow {
  const story=slot==='childhood'?childhoodDefinition(id as never):adulthoodDefinition(id as never);
  const gains=BACKGROUND_SKILL_IDS.filter(skill=>story.gains[skill]!==undefined)
    .map(skill=>`${BACKGROUND_SKILL_LABELS[skill]} +${story.gains[skill]}`).join(' · ');
  const label=storyTitle(slot,id,person.sex);
  return {phase,label,tooltip:{title:`${phase} : ${label}`,body:storyDescription(slot,id,person),
    rows:[{label:'Gains à la création',value:gains||'Aucun'},
      {label:'Application',value:'Déjà intégrés au profil initial ; niveaux plafonnés à 20. Aucun gain au chargement.'},
      {label:'Interdictions',value:story.disables.map(tag=>tagLabels[tag]).join(' · ')||'Aucune'}]}};
}
/** Projection of recorded identifiers only: old people never acquire a story. */
export function backgroundInspectionRows(pawn:BackgroundBearer&{name?:string;appearance?:{sex:'male'|'female'}},shownSex?:'male'|'female'):readonly BackgroundInspectionRow[] {
  // `shownSex`: the sex the caller shows for this person (stored appearance or its fallback).
  const background=pawn.background,sex=shownSex??pawn.appearance?.sex;if(!background)return [];
  // [PAWN_title] of the game's texts: the title of the latest story (Core Pawn_StoryTracker.Title).
  const person={name:pawn.name??'',sex,title:storyTitle(background.adulthood?'adulthood':'childhood',background.adulthood??background.childhood,sex)};
  return [storyRow('Enfance','childhood',background.childhood,person),
    ...(background.adulthood?[storyRow('Adulte','adulthood',background.adulthood,person)]:[])];
}
export function backgroundRestrictionRows(pawn:BackgroundBearer):readonly BackgroundRestrictionRow[] {
  const rows:BackgroundRestrictionRow[]=[];
  for(const work of Object.keys(BACKGROUND_WORK_LABELS) as WorkType[]) {
    const reason=backgroundWorkRefusal(pawn,work);if(reason)rows.push({label:BACKGROUND_WORK_LABELS[work],reason});
  }
  const violent=violentWorkRefusal(pawn);if(violent)rows.push({label:'Combat',reason:violent});
  return rows;
}
export function backgroundSummary(pawn:BackgroundBearer):string {
  const rows=backgroundInspectionRows(pawn);
  return rows.length?rows.map(row=>`${row.phase} : ${row.label}`).join(' · '):'Passé non renseigné';
}
export function backgroundSkillSummary(skills:PawnSkills,pawn:BackgroundBearer):string {
  return BACKGROUND_SKILL_IDS.map(skill=>backgroundSkillRefusal(pawn,skill)
    ?`${BACKGROUND_SKILL_LABELS[skill]} indisponible (niveau enregistré ${skills[skill]?.level??0})`
    :`${BACKGROUND_SKILL_LABELS[skill]} ${skills[skill]?.level??0}`).join(' · ');
}
export function createBackgroundInspection(parent:HTMLElement):HTMLElement {
  const section=document.createElement('section');section.className='background-inspection';
  const heading=document.createElement('h3');heading.textContent='Passé';
  const unknown=document.createElement('p');unknown.dataset.backgroundUnknown='';unknown.textContent='Passé non renseigné';
  const stories=document.createElement('ul');stories.dataset.backgroundStories='';
  const restrictionsHeading=document.createElement('h3');restrictionsHeading.dataset.backgroundRestrictionsHeading='';restrictionsHeading.textContent='Incapable de';
  const restrictions=document.createElement('ul');restrictions.dataset.backgroundRestrictions='';
  section.append(heading,unknown,stories,restrictionsHeading,restrictions);parent.append(section);return section;
}
export function updateBackgroundInspection(parent:HTMLElement,pawn:BackgroundBearer):void {
  const section=parent.querySelector<HTMLElement>('.background-inspection');if(!section)return;
  const signature=JSON.stringify([pawn.background??null,(pawn as {name?:string}).name,loreTextsRevision()]);if(section.dataset.signature===signature)return;
  section.dataset.signature=signature;
  const rows=backgroundInspectionRows(pawn),restrictions=backgroundRestrictionRows(pawn);
  section.querySelector<HTMLElement>('[data-background-unknown]')!.hidden=rows.length>0;
  const stories=section.querySelector<HTMLElement>('[data-background-stories]')!;
  stories.hidden=!rows.length;stories.replaceChildren(...rows.map(row=>{
    const item=document.createElement('li');item.tabIndex=0;item.textContent=`${row.phase} : ${row.label}`;
    setTooltip(item,row.tooltip);return item;
  }));
  section.querySelector<HTMLElement>('[data-background-restrictions-heading]')!.hidden=!restrictions.length;
  const list=section.querySelector<HTMLElement>('[data-background-restrictions]')!;
  list.hidden=!restrictions.length;list.replaceChildren(...restrictions.map(row=>{
    const item=document.createElement('li');item.tabIndex=0;item.textContent=row.label;
    setTooltip(item,{title:`${row.label} indisponible`,body:row.reason});return item;
  }));
}
/** A disabled native select cannot take keyboard focus. Its cell owns the
 * explanation while retaining the saved priority instead of writing zero. */
export function updateBackgroundWorkControl(select:HTMLSelectElement,pawn:BackgroundBearer,work:WorkType):void {
  const cell=select.parentElement;if(!cell)return;
  const reason=backgroundWorkRefusal(pawn,work);
  select.disabled=!!reason;cell.classList.toggle('background-work-unavailable',!!reason);
  if(reason) {
    cell.tabIndex=0;cell.setAttribute('aria-disabled','true');
    cell.setAttribute('aria-label',`${select.getAttribute('aria-label')??BACKGROUND_WORK_LABELS[work]} · ${reason}`);
    setTooltip(cell,{title:`${BACKGROUND_WORK_LABELS[work]} indisponible`,body:reason,
      rows:[{label:'Priorité enregistrée',value:select.value},{label:'Restriction',value:'Un ordre direct ne permet pas de contourner cette incapacité.'}]});
  } else {
    cell.removeAttribute('tabindex');cell.removeAttribute('aria-disabled');cell.removeAttribute('aria-label');
    if(cell.hasAttribute('data-tooltip')){setTooltip(cell,{body:''});cell.removeAttribute('data-tooltip');}
  }
}
/** Read-only rows stay focusable even when their effective skill is zero. */
export function updateBackgroundSkillControl(row:HTMLElement,pawn:Pawn,skill:BackgroundSkillId,record:SkillRecord,title:string,description:string):void {
  const refusal=backgroundSkillRefusal(pawn,skill);
  row.classList.toggle('skill-unavailable',!!refusal);
  if(refusal){row.setAttribute('aria-disabled','true');row.setAttribute('aria-label',`${title} · Indisponible. ${refusal} Niveau enregistré, non utilisable.`);}
  else{row.removeAttribute('aria-disabled');row.removeAttribute('aria-label');}
  const availability=row.querySelector<HTMLElement>('.skill-availability')!;
  availability.hidden=!refusal;availability.textContent=refusal?'Indisponible':'';
  setTooltip(row,{title:`${title}${refusal?' · Indisponible':''}`,
    body:refusal?`${refusal} Le niveau enregistré est conservé ; cette compétence n’apprend pas et n’oublie pas.`:description,
    rows:[{label:'Expérience du niveau',value:`${(record.xp/XP_SCALE).toFixed(1)} / ${xpRequired(record.level)/XP_SCALE}`},
      {label:'Apprentissage',value:refusal?'Indisponible':`${Math.round(learningFactor(record,pawn)*100)} %`}]});
}
