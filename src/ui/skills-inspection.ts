import { createTraitsInspection,updateTraitsInspection,traitSummary } from './traits-inspection';
import { intellectualSkill } from '../sim/research';
import { craftingSkill } from '../sim/crafting-quality';
import { artisticSkill } from '../sim/art-rules';
import { plantSkill,plantWorkSpeed,plantHarvestYield } from '../sim/plant-skills';
import { miningSkill,miningWorkSpeed,miningYield } from '../sim/mining-skills';
import { cookingSkill,cookingSpeed,butcherySpeed,butcheryEfficiency } from '../sim/cooking-statistics';
import { constructionSpeed, learningFactor, XP_SCALE, xpRequired } from '../sim/skills.ts';
import { medicalTendSpeed,medicalTendQuality } from '../sim/care-rules.ts';
import { socialImpact,wornSocialImpactOffset353 } from '../sim/social-state';
import { biologicalYears,chronologicalYears } from '../sim/human-age.ts';
import type { Pawn } from '../sim/types.ts';
import { SKILL_PASSION_LABELS,setCompactSkillPassion,setSkillPassion } from './skill-passion';
import type { World } from '../sim/types';
import { appearanceOf } from '../sim/pawn-appearance';
import { createBackgroundInspection, updateBackgroundInspection, updateBackgroundSkillControl } from './background-inspection';
import { createRelationshipInspection,updateRelationshipInspection } from './relationship-inspection';
import './pawn-dossiers-v199.css';

type SkillEntry = {
  skill: 'animals'|'plants'|'mining'|'construction'|'medicine'|'intellectual'|'crafting'|'artistic'|'cooking'|'shooting'|'melee'|'social';
  progress?: string;
  description?: string;
};
const SKILL_ENTRIES: readonly SkillEntry[] = [
  {skill:'shooting',progress:'data-shooting-xp'},
  {skill:'melee',progress:'data-melee-xp'},
  {skill:'construction',progress:'data-skill-xp',description:'data-skill-description'},
  {skill:'mining',progress:'data-mining-xp'},
  {skill:'cooking',progress:'data-cooking-xp',description:'data-cooking-description'},
  {skill:'plants',progress:'data-plants-xp'},
  {skill:'animals',progress:'data-animals-xp'},
  {skill:'crafting',progress:'data-crafting-xp'},
  {skill:'artistic',progress:'data-artistic-xp'},
  {skill:'medicine',progress:'data-medicine-xp',description:'data-medicine-description'},
  {skill:'social',progress:'data-social-xp'},
  {skill:'intellectual'},
];
/** Core displays biological age first and chronological age in parentheses. */
export function humanAgeText(pawn:Pawn):string {
  if(!pawn.age)return '';
  const biological=biologicalYears(pawn.age);
  const chronological=chronologicalYears(pawn.age);
  return `Âge : ${biological} ans${biological===chronological?'':` (${chronological} chronologiques)`}`;
}

function createSkillEntry(entry:SkillEntry):HTMLElement {
  const details=document.createElement('div');details.className='skill-entry';details.dataset.skillEntry=entry.skill;details.tabIndex=0;
  const summary=document.createElement('div'),label=document.createElement('span');summary.className='skill-entry-heading';label.dataset.skill=entry.skill;summary.append(label);
  const level=document.createElement('span');level.className='skill-level-bar';level.setAttribute('aria-hidden','true');summary.prepend(level);
  if(entry.progress){const progress=document.createElement('progress');progress.max=1;progress.hidden=true;progress.setAttribute(entry.progress,'');summary.append(progress);}
  const description=document.createElement('p');description.className='skill-entry-details muted';description.dataset.skillDetail=entry.skill;
  if(entry.description)description.setAttribute(entry.description,'');
  const availability=document.createElement('span');availability.className='skill-availability';availability.hidden=true;
  description.hidden=true;details.append(summary,availability,description);return details;
}

export function createSkillsInspection(panel:HTMLElement):void {
  const details=document.createElement('details');details.className='skills-inspection';
  const summary=document.createElement('summary');summary.textContent='Biographie · compétences';
  const age=document.createElement('p');age.className='pawn-age';age.dataset.pawnAge='';
  const identity=document.createElement('section');identity.className='bio-identity';
  const name=document.createElement('h3');name.dataset.bioName='';
  const sex=document.createElement('p');sex.dataset.bioSex='';identity.append(name,sex,age);
  createBackgroundInspection(identity);
  createRelationshipInspection(identity);
  createTraitsInspection(identity);
  const skills=document.createElement('section');skills.className='bio-skills';skills.setAttribute('aria-label','Compétences');
  const heading=document.createElement('h3');heading.textContent='Compétences';skills.append(heading,...SKILL_ENTRIES.map(createSkillEntry));
  const columns=document.createElement('div');columns.className='bio-columns';columns.append(identity,skills);
  details.append(summary,columns);panel.append(details);
}
export function updateSkillsInspection(panel:HTMLElement,pawn:Pawn,world?:World):void {
  updateTraitsInspection(panel,pawn);
  updateBackgroundInspection(panel,pawn);
  if(world)updateRelationshipInspection(panel,world,pawn);
  const name=panel.querySelector<HTMLElement>('[data-bio-name]');if(name)name.textContent=pawn.name;
  const sex=panel.querySelector<HTMLElement>('[data-bio-sex]');if(sex)sex.textContent=`${(world?appearanceOf(pawn,world.seed):pawn.appearance)?.sex==='female'?'Femme':'Homme'} · ${pawn.prisoner?'Prisonnier':pawn.visitor?'Visiteur':pawn.faction==='outlaws'?'Hors-la-loi':'Colon'}`;
  const age=panel.querySelector<HTMLElement>('[data-pawn-age]');if(age){age.textContent=humanAgeText(pawn);age.hidden=!age.textContent;}
  const s=pawn.skills.construction,label=panel.querySelector('[data-skill="construction"]');if(!label)return;
  setSkillPassion(label as HTMLElement,`Construction ${s.level}/20`,s.passion);
  const progress=panel.querySelector<HTMLProgressElement>('[data-skill-xp]')!;
  progress.value=Math.max(0,s.xp/xpRequired(s.level));progress.setAttribute('aria-label','Expérience de construction');
  panel.querySelector('[data-skill-description]')!.textContent=`${(s.xp/XP_SCALE).toFixed(1)} / ${xpRequired(s.level)/XP_SCALE} XP · Vitesse ${Math.round(constructionSpeed(pawn)*100)} % · Apprentissage ${Math.round(learningFactor(s,pawn)*100)} %${s.dailyXp>4000*XP_SCALE?' (saturation quotidienne)':''}. La lumière s’applique séparément.`;
  const mining=miningSkill(pawn);
  setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="mining"]')!,`Minage ${mining.level}/20`,mining.passion);
  const miningProgress=panel.querySelector<HTMLProgressElement>('[data-mining-xp]')!;miningProgress.value=Math.max(0,mining.xp/xpRequired(mining.level));miningProgress.setAttribute('aria-label','Expérience de minage');
  panel.querySelector<HTMLElement>('[data-skill-detail="mining"]')!.textContent=`${(mining.xp/XP_SCALE).toFixed(1)} / ${xpRequired(mining.level)/XP_SCALE} XP · Vitesse ${Math.round(miningWorkSpeed(pawn)*100)} % avant lumière · Rendement minéral ${Math.round(miningYield(pawn)*100)} % · Apprentissage ${Math.round(learningFactor(mining,pawn)*100)} %${mining.dailyXp>4000*XP_SCALE?' (saturation quotidienne)':''}. Le produit du gisement dépend de la moyenne des rendements pondérée par les dégâts de chaque coup ; plusieurs mineurs peuvent y contribuer. La chance de fragment de roche reste distincte.${pawn.skills.mining?'':' Profil historique neutre, sans pratique antérieure.'}`;
  const intellect=intellectualSkill(pawn);setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="intellectual"]')!,`Intellectuel ${intellect.level}/20`,intellect.passion);panel.querySelector<HTMLElement>('[data-skill-detail="intellectual"]')!.textContent=`${(intellect.xp/XP_SCALE).toFixed(1)} XP · recherche et synthèse des médicaments.`;
  const craft=craftingSkill(pawn);setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="crafting"]')!,`Artisanat ${craft.level}/20`,craft.passion);panel.querySelector<HTMLElement>('[data-skill-detail="crafting"]')!.textContent=`${(craft.xp/XP_SCALE).toFixed(1)} XP · influe sur la qualité de confection, sans accélérer la taille de pierre.`;
  const craftProgress=panel.querySelector<HTMLProgressElement>('[data-crafting-xp]')!;craftProgress.value=Math.max(0,craft.xp/xpRequired(craft.level));craftProgress.setAttribute('aria-label','Expérience d’artisanat');
  const animals=pawn.skills.animals??{level:0,xp:0,dailyXp:0,passion:0 as const};
  setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="animals"]')!,`Animaux ${animals.level}/20`,animals.passion);
  panel.querySelector<HTMLElement>('[data-skill-detail="animals"]')!.textContent=`${(animals.xp/XP_SCALE).toFixed(1)} XP · Apprivoisement et entretien. Niveau 8 requis pour le lièvre.`;
  const ap=panel.querySelector<HTMLProgressElement>('[data-animals-xp]')!;ap.value=Math.max(0,animals.xp/xpRequired(animals.level));ap.setAttribute('aria-label','Expérience Animaux');
  const plants=plantSkill(pawn),yieldStat=plantHarvestYield(pawn);
  setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="plants"]')!,`Plantes ${plants.level}/20`,plants.passion);
  const pp=panel.querySelector<HTMLProgressElement>('[data-plants-xp]')!;pp.value=Math.max(0,plants.xp/xpRequired(plants.level));pp.setAttribute('aria-label','Expérience Plantes');
  panel.querySelector<HTMLElement>('[data-skill-detail="plants"]')!.textContent=`${(plants.xp/XP_SCALE).toFixed(1)} / ${xpRequired(plants.level)/XP_SCALE} XP · Travail ${Math.round(plantWorkSpeed(pawn)*100)} % avant lumière · Réussite de récolte ${Math.round(Math.min(1,yieldStat)*100)} % · Bonus de rendement ${Math.round(Math.max(0,yieldStat-1)*100)} % · Apprentissage ${Math.round(learningFactor(plants,pawn)*100)} %. Les arbres ne subissent pas d’échec de récolte.${pawn.skills.plants?'':' Profil historique neutre, sans pratique antérieure.'}`;
  const art=artisticSkill(pawn);
  setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="artistic"]')!,`Artistique ${art.level}/20`,art.passion);
  panel.querySelector<HTMLElement>('[data-skill-detail="artistic"]')!.textContent=`${(art.xp/XP_SCALE).toFixed(1)} / ${xpRequired(art.level)/XP_SCALE} XP · détermine la qualité des sculptures, sans accélérer le travail. Apprentissage ${Math.round(learningFactor(art,pawn)*100)} %.`;
  const artProgress=panel.querySelector<HTMLProgressElement>('[data-artistic-xp]')!;artProgress.value=Math.max(0,art.xp/xpRequired(art.level));artProgress.setAttribute('aria-label','Expérience artistique');
  const cook=cookingSkill(pawn);setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="cooking"]')!,`Cuisine ${cook.level}/20`,cook.passion);
  const cp=panel.querySelector<HTMLProgressElement>('[data-cooking-xp]')!;cp.value=Math.max(0,cook.xp/xpRequired(cook.level));cp.setAttribute('aria-label','Expérience de cuisine');
  panel.querySelector('[data-cooking-description]')!.textContent=`${(cook.xp/XP_SCALE).toFixed(1)} / ${xpRequired(cook.level)/XP_SCALE} XP · Cuisson ${Math.round(cookingSpeed(pawn)*100)} % · Boucherie ${Math.round(butcherySpeed(pawn)*100)} % · Rendement ${Math.round(butcheryEfficiency(pawn)*100)} % avant poste · Apprentissage ${Math.round(learningFactor(cook,pawn)*100)} %. La lumière et la température s’appliquent séparément.`;
  const shot=pawn.skills.shooting;setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="shooting"]')!,`Tir ${shot.level}/20`,shot.passion);panel.querySelector<HTMLElement>('[data-skill-detail="shooting"]')!.textContent=`${(shot.xp/XP_SCALE).toFixed(1)} XP · Apprentissage ${Math.round(learningFactor(shot,pawn)*100)} %`;
  const sp=panel.querySelector<HTMLProgressElement>('[data-shooting-xp]')!;sp.value=Math.max(0,shot.xp/xpRequired(shot.level));sp.setAttribute('aria-label','Expérience de tir');
  const melee=pawn.skills.melee;setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="melee"]')!,`Mêlée ${melee.level}/20`,melee.passion);panel.querySelector<HTMLElement>('[data-skill-detail="melee"]')!.textContent=`${(melee.xp/XP_SCALE).toFixed(1)} XP · Apprentissage ${Math.round(learningFactor(melee,pawn)*100)} %`;
  const meleeProgress=panel.querySelector<HTMLProgressElement>('[data-melee-xp]')!;meleeProgress.value=Math.max(0,melee.xp/xpRequired(melee.level));meleeProgress.setAttribute('aria-label','Expérience de mêlée');
  const social=pawn.skills.social??{level:0,xp:0,dailyXp:0,passion:0 as const};
  setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="social"]')!,`Social ${social.level}/20`,social.passion);
  const socialProgress=panel.querySelector<HTMLProgressElement>('[data-social-xp]')!;socialProgress.value=Math.max(0,social.xp/xpRequired(social.level));socialProgress.setAttribute('aria-label','Expérience sociale');
  panel.querySelector<HTMLElement>('[data-skill-detail="social"]')!.textContent=`${(social.xp/XP_SCALE).toFixed(1)} XP · Impact ${Math.round(socialImpact(pawn,world?wornSocialImpactOffset353(world,pawn.id):0)*100)} % · Apprentissage ${Math.round(learningFactor(social,pawn)*100)} %`;
  const m=pawn.skills.medicine;
  setSkillPassion(panel.querySelector<HTMLElement>('[data-skill="medicine"]')!,`Médecine ${m.level}/20`,m.passion);
  const mp=panel.querySelector<HTMLProgressElement>('[data-medicine-xp]')!;mp.value=Math.max(0,m.xp/xpRequired(m.level));mp.setAttribute('aria-label','Expérience de médecine');
  panel.querySelector('[data-medicine-description]')!.textContent=`${(m.xp/XP_SCALE).toFixed(1)} / ${xpRequired(m.level)/XP_SCALE} XP · Vitesse ${Math.round(medicalTendSpeed(pawn)*100)} % avant lumière · Qualité de base ${Math.round(medicalTendQuality(pawn)*100)} % avant matériel et variation · Apprentissage ${Math.round(learningFactor(m,pawn)*100)} %.`;
  for(const entry of SKILL_ENTRIES){
    const row=panel.querySelector<HTMLElement>(`[data-skill-entry="${entry.skill}"]`)!;
    const skill=entry.skill==='mining'?mining:entry.skill==='plants'?plants:entry.skill==='cooking'?cook:pawn.skills[entry.skill]??{level:0,xp:0,dailyXp:0,passion:0 as const};
    row.querySelector<HTMLElement>('.skill-level-bar')!.style.width=`${Math.max(0,Math.min(100,skill.level/20*100))}%`;
    const label=row.querySelector<HTMLElement>('[data-skill]')!;
    updateBackgroundSkillControl(row,pawn,entry.skill,skill,label.getAttribute('aria-label')??'',row.querySelector<HTMLElement>('[data-skill-detail]')!.textContent??'');
    label.removeAttribute('title');
  }
}
export function updateWorkSkills(row:HTMLElement,pawn:Pawn):void {
  row.title=traitSummary(pawn);
  const mine=row.querySelector<HTMLSelectElement>('[data-work="mine"]');
  if(mine){let label=mine.parentElement!.querySelector<HTMLElement>('.work-mining');if(!label){label=document.createElement('small');label.className='work-mining';mine.parentElement!.append(label);}const skill=miningSkill(pawn);setCompactSkillPassion(label,skill.level,skill.passion,'Minage');mine.title=`Minage ${skill.level}/20 · ${SKILL_PASSION_LABELS[skill.passion]} · vitesse ${Math.round(miningWorkSpeed(pawn)*100)} % avant lumière · rendement minéral ${Math.round(miningYield(pawn)*100)} % ; moyenne pondérée par les dégâts des coups sur le gisement` ;}
  for(const work of ['grow','gather'] as const){
    const select=row.querySelector<HTMLSelectElement>(`[data-work="${work}"]`);if(!select)continue;
    let label=select.parentElement!.querySelector<HTMLElement>('.work-plants');if(!label){label=document.createElement('small');label.className='work-plants';select.parentElement!.append(label);}
    const skill=plantSkill(pawn);setCompactSkillPassion(label,skill.level,skill.passion,'Plantes');
    select.title=`Plantes ${skill.level}/20 · ${SKILL_PASSION_LABELS[skill.passion]} · vitesse ${Math.round(plantWorkSpeed(pawn)*100)} % avant lumière · semis, récolte et abattage`;
  }
  const handle=row.querySelector<HTMLSelectElement>('[data-work="handle"]');
  if(handle){let label=handle.parentElement!.querySelector<HTMLElement>('.work-animals');if(!label){label=document.createElement('small');label.className='work-animals';handle.parentElement!.append(label);}const a=pawn.skills.animals;setCompactSkillPassion(label,a?.level??0,a?.passion??0,'Animaux');handle.title='Apprivoisement et entretien des lièvres · niveau Animaux 8 requis';}
  const warden=row.querySelector<HTMLSelectElement>('[data-work="warden"]');
  if(warden){let label=warden.parentElement!.querySelector<HTMLElement>('.work-social');if(!label){label=document.createElement('small');label.className='work-social';warden.parentElement!.append(label);}const s=pawn.skills.social??{level:0,xp:0,dailyXp:0,passion:0};setCompactSkillPassion(label,s.level,s.passion,'Social');warden.title=`Social ${s.level}/20 · ${SKILL_PASSION_LABELS[s.passion]} · nourrit les prisonniers et mène les conversations selon le mode choisi`;}
  const doctor=row.querySelector<HTMLSelectElement>('[data-work="doctor"]');
  if(doctor){let label=doctor.parentElement!.querySelector<HTMLElement>('.work-medicine');if(!label){label=document.createElement('small');label.className='work-medicine';doctor.parentElement!.append(label);}const m=pawn.skills.medicine;setCompactSkillPassion(label,m.level,m.passion,'Médecine');doctor.title=`Médecine ${m.level}/20 · ${SKILL_PASSION_LABELS[m.passion]} · apprentissage ${Math.round(learningFactor(m,pawn)*100)} %`;}
  const cook=row.querySelector<HTMLSelectElement>('[data-work="cook"]');
  if(cook){let label=cook.parentElement!.querySelector<HTMLElement>('.work-cooking');if(!label){label=document.createElement('small');label.className='work-cooking';cook.parentElement!.append(label);}const c=cookingSkill(pawn);setCompactSkillPassion(label,c.level,c.passion,'Cuisine');cook.title=`Cuisine ${c.level}/20 · ${SKILL_PASSION_LABELS[c.passion]} · cuisson ${Math.round(cookingSpeed(pawn)*100)} % · rendement de boucherie ${Math.round(butcheryEfficiency(pawn)*100)} % avant poste`;}
  const artWork=row.querySelector<HTMLSelectElement>('[data-work="art"]');
  if(artWork){let label=artWork.parentElement!.querySelector<HTMLElement>('.work-artistic');if(!label){label=document.createElement('small');label.className='work-artistic';artWork.parentElement!.append(label);}const art=artisticSkill(pawn);setCompactSkillPassion(label,art.level,art.passion,'Artistique');artWork.title=`Artistique ${art.level}/20 · ${SKILL_PASSION_LABELS[art.passion]} · qualité des sculptures, sans effet direct sur la vitesse`;}
  const select=row.querySelector<HTMLSelectElement>('[data-work="build"]');if(!select)return;
  let label=row.querySelector<HTMLElement>('.work-skill');
  if(!label){label=document.createElement('small');label.className='work-skill';select.parentElement!.append(label);}
  const skill=pawn.skills.construction;
  setCompactSkillPassion(label,skill.level,skill.passion,'Construction');
  select.title=`Construction ${skill.level}/20 · ${SKILL_PASSION_LABELS[skill.passion]} · vitesse ${Math.round(constructionSpeed(pawn)*100)} % · apprentissage ${Math.round(learningFactor(skill,pawn)*100)} %`;
}
