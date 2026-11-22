import type { Pawn } from '../sim/types';
import { previewStartingCandidate, previewStartingParty, rerollStartingCandidateForRoster, validStartingCandidateName, STARTING_CANDIDATE_NAME_MAX, type StartingCandidateDescriptor } from '../sim/starting-candidates';
import { appearanceOf } from '../sim/pawn-appearance';
import { biologicalYears, chronologicalYears } from '../sim/human-age';
import { BACKGROUND_SKILL_IDS, backgroundSkillRefusal, type BackgroundSkillId } from '../sim/colonist-backgrounds';
import { APPAREL } from '../sim/apparel-rules';
import { traitLabel, traitTooltip } from '../lore/lore-text';
import { learningFactor, XP_SCALE, xpRequired } from '../sim/skills';
import { BODY_PARTS } from '../sim/body-definition';
import { HP_UNIT, INJURY_RULES } from '../sim/injury-rules';
import { captureRelationshipIndex, type RelationshipViewKind } from '../sim/relationship-state';
import type { apparelAppearance } from '../render/character-apparel';
import { humanLimbVisualMask } from '../render/human-anatomy-presentation';
import { factionOf } from '../sim/affiliation';
import { portraitDataUrl, portraitExpressionOf } from './pawn-portrait';
import { BACKGROUND_SKILL_LABELS, backgroundInspectionRows, backgroundRestrictionRows } from './background-inspection';
import { SKILL_PASSION_LABELS, setCompactSkillPassion } from './skill-passion';
import { setTooltip, dismissTooltip } from './tooltip';
import './front-starting-pawns.css';

export interface StartingPawnsConfigurationOptions {
  seed: number;
  roster: readonly StartingCandidateDescriptor[];
  onRosterChange: (roster: StartingCandidateDescriptor[]) => void;
  onError: (message: string) => void;
}
export interface StartingPawnsConfiguration {
  element: HTMLElement;
  validate: () => boolean;
  setBusy: (busy: boolean) => void;
  dispose: () => void;
}

const TEAM_SKILLS: readonly BackgroundSkillId[] = ['shooting','melee','construction','mining','cooking','plants','medicine','intellectual'];
const RELATION_LABELS: Readonly<Record<RelationshipViewKind,string>> = {
  parent:'Parent',child:'Enfant',sibling:'Fratrie',lover:'Partenaire',spouse:'Conjoint',
  'ex-lover':'Ancien partenaire','ex-spouse':'Ancien conjoint',
};
const SKILL_DESCRIPTIONS: Readonly<Record<BackgroundSkillId,string>> = {
  shooting:'Précision avec les armes à distance.',melee:'Combat au contact.',construction:'Construction et réparations.',
  mining:'Travail et rendement des gisements.',cooking:'Cuisine et boucherie.',plants:'Culture, récolte et travail des plantes.',
  animals:'Apprivoisement et entretien des animaux.',crafting:'Qualité des objets fabriqués.',artistic:'Qualité des œuvres d’art.',
  medicine:'Soins et opérations.',social:'Échanges et interactions sociales.',intellectual:'Recherche et synthèse des médicaments.',
};
const node = <K extends keyof HTMLElementTagNameMap>(tag:K,className='',text?:string):HTMLElementTagNameMap[K] => {
  const result=document.createElement(tag);result.className=className;if(text!==undefined)result.textContent=text;return result;
};
const action = (label:string,className=''):HTMLButtonElement => {const result=node('button',className,label);result.type='button';return result;};

/** A small draft projection. It never creates terrain, starts a renderer or changes the active colony. */
export function createStartingPawnsConfiguration(options:StartingPawnsConfigurationOptions):StartingPawnsConfiguration {
  const root=node('section','front-starting-pawns');
  root.setAttribute('aria-label','Préparer les personnages');
  const controller=new AbortController(),listenerOptions={signal:controller.signal};
  let dossierController=new AbortController();
  let roster=options.roster.map(candidate=>({...candidate}));
  const nameDrafts=new Map<number,string>();
  let inspected=roster[0]?.serial;
  let disposed=false,busy=false,showClothes=true,dragged:number|undefined;
  let touchDrag:{pointerId:number;serial:number;startY:number;moved:boolean;card:HTMLButtonElement}|undefined;
  let suppressTouchClick=false;
  let pawns:Pawn[]=[];
  let relationships=previewStartingParty(options.seed,roster.slice(0,3)).relationships;
  const list=node('aside','front-candidate-list');list.setAttribute('aria-label','Candidats au départ');
  const help=node('p','front-candidate-help','Glissez pour réordonner. Sur écran tactile, utilisez la poignée. Les trois premiers partent. Au clavier : Alt + ↑ ou ↓.');
  help.id='front-candidate-reorder-help';
  const cards=node('div','front-candidate-cards');cards.setAttribute('role','group');cards.setAttribute('aria-label','Huit candidats : les trois premiers partent');
  list.append(help,cards);
  const main=node('div','front-candidate-main');
  const dossier=node('article','front-candidate-dossier');
  const team=node('section','front-candidate-team');team.setAttribute('aria-label','Compétences de l’équipe');
  main.append(dossier,team);
  const live=node('p','front-candidate-announcement');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  root.append(list,main,live);

  function unavailable():boolean {return disposed||busy||root.closest('[aria-busy="true"]')!==null;}
  function stopDrag():void {
    const captured=touchDrag;touchDrag=undefined;
    dragged=undefined;
    if(captured?.card.hasPointerCapture(captured.pointerId))captured.card.releasePointerCapture(captured.pointerId);
    for(const card of cards.querySelectorAll('.is-dragged,.is-drop-target'))card.classList.remove('is-dragged','is-drop-target');
  }
  function apparel():ReturnType<typeof apparelAppearance> {
    // Crashlanded materialization equips this actual item on every selected person.
    return {shirt:showClothes,tribal:false,vest:false,helmet:false,plateArmor:false,simpleHelmet:false,simpleHelmetColor:undefined,simpleHelmetMaterial:0,plasteelHelmet:false,reconHelmet:false,tuque:0,hat353:0,hatColor353:undefined,silhouette:showClothes?1:0,pants:0,
      color:showClothes?APPAREL['cloth-shirt'].color:undefined,signature:showClothes?'cloth-shirt':'',description:showClothes?'Chemise en tissu':'Vêtements masqués pour le portrait'};
  }
  function portrait(pawn:Pawn,size:number):HTMLImageElement {
    const image=node('img','front-candidate-portrait');image.width=size;image.height=size;image.alt=`Portrait de ${pawn.name}`;
    image.src=portraitDataUrl(appearanceOf(pawn,options.seed),apparel(),undefined,portraitExpressionOf(pawn),humanLimbVisualMask(pawn));
    return image;
  }
  function heading(parent:HTMLElement,label:string):void {parent.append(node('h3','',label));}
  function empty(parent:HTMLElement,label:string):void {parent.append(node('p','front-candidate-empty',label));}
  function writeProfile():void {
    pawns=roster.map(candidate=>previewStartingCandidate(options.seed,candidate));
    const party=previewStartingParty(options.seed,roster.slice(0,3));
    relationships=party.relationships;
    // Use the same profiles that will be materialized for the selected party.
    for(const pawn of party.pawns){const index=pawns.findIndex(candidate=>candidate.id===pawn.id);if(index>=0)pawns[index]=pawn;}
  }
  function publish():boolean {
    try{options.onRosterChange(roster.map(candidate=>({...candidate})));return true;}
    catch(cause){options.onError(cause instanceof Error?cause.message:'Les choix des personnages ne peuvent pas être appliqués.');return false;}
  }
  function focusCandidate(serial:number):void {cards.querySelector<HTMLButtonElement>(`[data-candidate-serial="${serial}"]`)?.focus({preventScroll:true});}
  function reorder(serial:number,target:number):void {
    if(unavailable())return;
    const from=roster.findIndex(candidate=>candidate.serial===serial);
    if(from<0||target<0||target>=roster.length||from===target)return;
    const previous=roster;
    roster=[...roster];roster.splice(target,0,roster.splice(from,1)[0]!);
    if(!publish()){roster=previous;return;}
    stopDrag();render();focusCandidate(serial);
    const pawn=pawns.find(candidate=>candidate.id===serial)!;
    live.textContent=`${pawn.name} : position ${target+1}, ${target<3?'sélectionné pour le départ':'laissé sur place'}.`;
  }
  function inspect(serial:number):void {
    if(unavailable())return;
    inspected=serial;dismissTooltip();renderCards();renderDossier();focusCandidate(serial);
  }
  function renderCards():void {
    cards.replaceChildren();
    pawns.forEach((pawn,index)=>{
      if(index===0||index===3)cards.append(node('h2','front-candidate-group',index===0?'Sélectionnés':'Laissés sur place'));
      const card=action('','front-candidate-card');card.dataset.candidateSerial=String(pawn.id);card.dataset.candidateIndex=String(index);
      card.draggable=!unavailable();card.disabled=unavailable();card.setAttribute('aria-pressed',String(pawn.id===inspected));
      card.setAttribute('aria-describedby',help.id);
      const labels=node('span','front-candidate-labels');labels.append(node('strong','',pawn.name));
      const stories=backgroundInspectionRows(pawn);labels.append(node('span','',stories.at(-1)?.label??'Passé non renseigné'));
      card.setAttribute('aria-label',`${pawn.name} · ${stories.at(-1)?.label??'Passé non renseigné'} · ${index<3?'Sélectionné':'Laissé sur place'}`);
      const grip=node('span','front-candidate-drag-grip','⠿');grip.setAttribute('aria-hidden','true');
      card.append(portrait(pawn,56),labels,grip);cards.append(card);
    });
  }
  function renderDossier():void {
    dossierController.abort();dossierController=new AbortController();const dossierListeners={signal:dossierController.signal};
    dossier.replaceChildren();
    const pawn=pawns.find(candidate=>candidate.id===inspected)??pawns[0];if(!pawn)return;
    const descriptor=roster.find(candidate=>candidate.serial===pawn.id)!;
    const top=node('div','front-candidate-top');
    const identity=node('div','front-candidate-identity');
    const nameLabel=node('label','front-candidate-name-label','Nom');
    const name=node('input','front-candidate-name');name.type='text';name.value=nameDrafts.get(pawn.id)??pawn.name;name.maxLength=STARTING_CANDIDATE_NAME_MAX;name.autocomplete='off';
    name.disabled=unavailable();name.setAttribute('aria-label','Nom du personnage');nameLabel.append(name);
    if(!validStartingCandidateName(name.value.trim()))name.setAttribute('aria-invalid','true');
    const appearance=appearanceOf(pawn,options.seed);
    const years=pawn.age?`${biologicalYears(pawn.age)} ans (${chronologicalYears(pawn.age)} chronologiques)`:'';
    identity.append(nameLabel,node('p','',`${appearance.sex==='female'?'Femme':'Homme'}${years?` · ${years}`:''}`));
    identity.append(node('p','',factionOf(pawn)==='colony'?'Colonie':factionOf(pawn)==='outlaws'?'Hors-la-loi':'Étrangers'));
    const body=node('div','front-candidate-portrait-controls');body.append(portrait(pawn,112));
    const clothing=node('label','front-candidate-clothing'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=showClothes;checkbox.disabled=unavailable();
    clothing.append(checkbox,node('span','','Afficher les vêtements'));body.append(clothing);
    setTooltip(clothing,{title:'Vêtements du portrait',body:'Affiche ou masque la chemise en tissu réellement fournie au départ. Ce choix de vue ne change pas l’équipement.'});
    checkbox.addEventListener('change',()=>{if(unavailable())return;showClothes=checkbox.checked;renderCards();renderDossier();dossier.querySelector<HTMLInputElement>('.front-candidate-clothing input')?.focus();},dossierListeners);
    const reroll=action('Aléatoire','front-candidate-randomize');reroll.disabled=unavailable();reroll.dataset.candidateRandomize=String(pawn.id);
    setTooltip(reroll,{title:'Nouveau personnage',body:'Remplace ce candidat par un nouveau profil. Les autres candidats et leur ordre sont conservés.'});
    reroll.addEventListener('click',()=>{
      if(unavailable())return;const previous=roster;
      try{roster=rerollStartingCandidateForRoster(options.seed,roster,descriptor.serial);}
      catch(cause){options.onError(cause instanceof Error?cause.message:'Ce candidat ne peut pas être renouvelé.');return;}
      if(!publish()){roster=previous;return;}nameDrafts.delete(descriptor.serial);dismissTooltip();render();dossier.querySelector<HTMLButtonElement>('.front-candidate-randomize')?.focus();
      live.textContent=`Nouveau candidat : ${pawns.find(candidate=>candidate.id===descriptor.serial)!.name}.`;
    },dossierListeners);
    name.addEventListener('input',()=>{
      if(unavailable())return;nameDrafts.set(pawn.id,name.value);const value=name.value.trim();
      if(!validStartingCandidateName(value)){name.setAttribute('aria-invalid','true');return;}
      name.removeAttribute('aria-invalid');
      const previous=roster;roster=roster.map(candidate=>candidate.serial===descriptor.serial?{...candidate,nameOverride:value}:candidate);
      if(!publish()){roster=previous;name.value=pawns.find(candidate=>candidate.id===pawn.id)!.name;nameDrafts.set(pawn.id,name.value);return;}
      writeProfile();renderCards();renderTeam();renderRelations(social,pawns.find(candidate=>candidate.id===pawn.id)!);
    },dossierListeners);
    name.addEventListener('change',()=>{
      if(unavailable())return;
      nameDrafts.set(pawn.id,name.value);
      const value=name.value.trim();if(!validStartingCandidateName(value)){name.setAttribute('aria-invalid','true');options.onError('Saisissez un nom de 1 à 80 caractères, sans caractère de contrôle.');}
      else{name.value=value;nameDrafts.set(pawn.id,value);name.removeAttribute('aria-invalid');}
    },dossierListeners);
    top.append(identity,body,reroll);
    const columns=node('div','front-candidate-columns');
    const biography=node('section','front-candidate-biography');
    heading(biography,'Histoire');const stories=backgroundInspectionRows(pawn);
    for(const story of stories){const row=node('p','front-candidate-story');row.tabIndex=0;row.append(node('span','',`${story.phase} : `),node('strong','',story.label));setTooltip(row,story.tooltip);biography.append(row);}
    if(!stories.length)empty(biography,'Passé non renseigné');
    heading(biography,'Traits');
    for(const id of pawn.traits??[]){const label=traitLabel(id,pawn.appearance?.sex),trait=node('p','front-candidate-trait',label);trait.tabIndex=0;setTooltip(trait,{title:label,body:traitTooltip(id,{name:pawn.name,sex:pawn.appearance?.sex})});biography.append(trait);}
    if(!pawn.traits?.length)empty(biography,'Aucun trait');
    heading(biography,'Incapable de');const restrictions=backgroundRestrictionRows(pawn);
    for(const restriction of restrictions){const row=node('p','front-candidate-restriction',restriction.label);row.tabIndex=0;setTooltip(row,{title:restriction.label,body:restriction.reason});biography.append(row);}
    if(!restrictions.length)empty(biography,'Aucune incapacité');
    const skills=node('section','front-candidate-skills');heading(skills,'Compétences');
    for(const skill of BACKGROUND_SKILL_IDS)skills.append(skillRow(pawn,skill));
    const social=node('section','front-candidate-social');heading(social,'Santé');
    const health=pawn.health;
    const conditions=[...(health?.injuries??[]).map(injury=>`${BODY_PARTS[injury.part].label} : ${injury.scar?'Cicatrice':INJURY_RULES[injury.kind].label} (−${(injury.severity/HP_UNIT).toFixed(1)} PV)`),
      ...(health?.missing??[]).map(part=>`${BODY_PARTS[part.part].label} : partie perdue`),
      ...(health?.ageAilments??[]).map(ailment=>ailment==='bad-back'?'Lumbago':'Frêle')];
    for(const condition of conditions)social.append(node('p','front-candidate-condition',condition));
    if(!conditions.length)empty(social,'Aucun problème de santé');
    renderRelations(social,pawn);columns.append(biography,skills,social);dossier.append(top,columns);
  }
  function renderRelations(parent:HTMLElement,pawn:Pawn):void {
    parent.querySelector('.front-candidate-relations')?.remove();
    const section=node('section','front-candidate-relations');heading(section,'Relations');
    const index=captureRelationshipIndex(relationships);let count=0;
    for(const other of pawns){const kinds=index.kinds(pawn.id,other.id);if(!kinds.length)continue;count++;
      const row=node('p','front-candidate-relation',`${other.name} : ${kinds.map(kind=>RELATION_LABELS[kind]).join(', ')}`);row.tabIndex=0;
      setTooltip(row,{title:other.name,body:'Lien prévu pour les personnes sélectionnées. Il sera conservé lors de leur arrivée réelle.',rows:[{label:'Relation',value:kinds.map(kind=>RELATION_LABELS[kind]).join(', ')}]});section.append(row);
    }
    if(!count)empty(section,'Aucun lien connu');parent.append(section);
  }
  function skillRow(pawn:Pawn,skill:BackgroundSkillId):HTMLElement {
    const record=pawn.skills[skill]??{level:0,xp:0,dailyXp:0,passion:0 as const},refusal=backgroundSkillRefusal(pawn,skill);
    const row=node('div',`front-candidate-skill${refusal?' is-unavailable':''}`);row.tabIndex=0;row.dataset.candidateSkill=skill;
    const label=node('span','front-candidate-skill-label',BACKGROUND_SKILL_LABELS[skill]);
    const value=node('span','front-candidate-skill-value');setCompactSkillPassion(value,record.level,record.passion,BACKGROUND_SKILL_LABELS[skill]);
    value.removeAttribute('title');
    const meter=node('span','front-candidate-skill-meter');meter.setAttribute('aria-hidden','true');meter.style.setProperty('--skill-level',String(record.level/20));
    row.append(label,meter,value);row.setAttribute('aria-label',`${BACKGROUND_SKILL_LABELS[skill]} : ${refusal?'incapable':`${record.level} sur 20`} · ${SKILL_PASSION_LABELS[record.passion]}`);
    setTooltip(row,{title:BACKGROUND_SKILL_LABELS[skill],body:refusal??SKILL_DESCRIPTIONS[skill],rows:[
      {label:'Niveau enregistré',value:`${record.level}/20`},{label:'Passion',value:SKILL_PASSION_LABELS[record.passion]!},
      {label:'Expérience',value:`${record.xp/XP_SCALE} / ${xpRequired(record.level)/XP_SCALE}`},
      {label:'Apprentissage',value:`${Math.round(learningFactor(record,pawn)*100)} %`},
    ]});return row;
  }
  function renderTeam():void {
    team.replaceChildren();heading(team,'Compétences de l’équipe');const grid=node('div','front-candidate-team-grid');
    for(const skill of TEAM_SKILLS){const members=pawns.slice(0,3);
      const best=members.filter(pawn=>!backgroundSkillRefusal(pawn,skill)).reduce<Pawn|undefined>((owner,pawn)=>{
        const record=pawn.skills[skill],previous=owner?.skills[skill];
        return !owner||(record?.level??0)>(previous?.level??0)||(record?.level??0)===(previous?.level??0)&&(record?.passion??0)>(previous?.passion??0)?pawn:owner;
      },undefined);
      const row=node('div','front-candidate-team-skill');row.tabIndex=0;row.dataset.teamSkill=skill;
      const value=node('strong');if(best){const record=best.skills[skill];setCompactSkillPassion(value,record?.level??0,record?.passion??0,BACKGROUND_SKILL_LABELS[skill]);value.removeAttribute('title');}
      else{value.textContent='—';row.classList.add('is-unavailable');row.setAttribute('aria-label',`${BACKGROUND_SKILL_LABELS[skill]} : toute l’équipe est incapable`);}
      row.append(node('span','',BACKGROUND_SKILL_LABELS[skill]),value);
      setTooltip(row,{title:BACKGROUND_SKILL_LABELS[skill],body:best?`Meilleur niveau utilisable : ${best.name}. À niveau égal, la passion départage les candidats.`:'Aucune personne sélectionnée ne peut pratiquer cette compétence.',rows:members.map(pawn=>({label:pawn.name,value:backgroundSkillRefusal(pawn,skill)?'Incapable':`${pawn.skills[skill]?.level??0} · ${SKILL_PASSION_LABELS[pawn.skills[skill]?.passion??0]}`}))});grid.append(row);
    }team.append(grid);
  }
  function render():void {dismissTooltip();writeProfile();renderCards();renderDossier();renderTeam();}
  const candidateOf=(target:EventTarget|null):HTMLButtonElement|undefined=>target instanceof Element?target.closest<HTMLButtonElement>('[data-candidate-serial]')??undefined:undefined;
  cards.addEventListener('click',event=>{
    if(suppressTouchClick&&event.detail!==0){suppressTouchClick=false;event.preventDefault();return;}
    const card=candidateOf(event.target);if(card)inspect(Number(card.dataset.candidateSerial));
  },listenerOptions);
  cards.addEventListener('keydown',event=>{
    const card=candidateOf(event.target);if(!card)return;
    if(event.altKey&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();reorder(Number(card.dataset.candidateSerial),Number(card.dataset.candidateIndex)+(event.key==='ArrowUp'?-1:1));}
    if(event.key==='Escape'&&dragged!==undefined){event.preventDefault();event.stopPropagation();stopDrag();}
  },listenerOptions);
  cards.addEventListener('dragstart',event=>{
    const card=candidateOf(event.target);if(!card||unavailable()){event.preventDefault();return;}
    dragged=Number(card.dataset.candidateSerial);card.classList.add('is-dragged');event.dataTransfer?.setData('text/plain',String(dragged));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';dismissTooltip();
  },listenerOptions);
  cards.addEventListener('dragover',event=>{
    if(dragged===undefined||unavailable())return;const card=candidateOf(event.target);if(!card)return;
    event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';
    for(const old of cards.querySelectorAll('.is-drop-target'))old.classList.remove('is-drop-target');card.classList.add('is-drop-target');
  },listenerOptions);
  cards.addEventListener('drop',event=>{
    if(dragged===undefined)return;event.preventDefault();const serial=dragged,card=candidateOf(event.target);stopDrag();if(!card||unavailable())return;
    dropAt(serial,card,event.clientY);
  },listenerOptions);
  cards.addEventListener('dragend',stopDrag,listenerOptions);
  function dropAt(serial:number,card:HTMLButtonElement,y:number):void {
    const from=roster.findIndex(candidate=>candidate.serial===serial),target=Number(card.dataset.candidateIndex),rect=card.getBoundingClientRect();
    let insertion=target+(y>rect.top+rect.height/2?1:0);if(from<insertion)insertion--;
    reorder(serial,Math.min(roster.length-1,insertion));
  }
  function cardAt(x:number,y:number):HTMLButtonElement|undefined {
    const card=document.elementFromPoint(x,y)?.closest<HTMLButtonElement>('[data-candidate-serial]');
    return card&&cards.contains(card)?card:undefined;
  }
  // Native HTML drag remains available to the mouse. A dedicated touch handle
  // leaves the rest of the page scrollable and captures only this gesture.
  cards.addEventListener('pointerdown',event=>{
    suppressTouchClick=false;
    if(unavailable()||event.pointerType!=='touch'&&event.pointerType!=='pen'||!(event.target instanceof Element)||!event.target.closest('.front-candidate-drag-grip'))return;
    const card=event.target.closest<HTMLButtonElement>('[data-candidate-serial]');if(!card)return;
    event.preventDefault();stopDrag();touchDrag={pointerId:event.pointerId,serial:Number(card.dataset.candidateSerial),startY:event.clientY,moved:false,card};
    dragged=touchDrag.serial;card.setPointerCapture(event.pointerId);dismissTooltip();
  },listenerOptions);
  cards.addEventListener('pointermove',event=>{
    const gesture=touchDrag;if(!gesture||gesture.pointerId!==event.pointerId)return;
    if(unavailable()){stopDrag();return;}event.preventDefault();
    if(Math.abs(event.clientY-gesture.startY)<6&&!gesture.moved)return;
    gesture.moved=true;gesture.card.classList.add('is-dragged');
    const scroll=root.closest<HTMLElement>('.front-content');if(scroll){const rect=scroll.getBoundingClientRect();
      if(event.clientY<rect.top+32)scroll.scrollTop-=16;else if(event.clientY>rect.bottom-32)scroll.scrollTop+=16;}
    for(const old of cards.querySelectorAll('.is-drop-target'))old.classList.remove('is-drop-target');
    cardAt(event.clientX,event.clientY)?.classList.add('is-drop-target');
  },{...listenerOptions,passive:false});
  cards.addEventListener('pointerup',event=>{
    const gesture=touchDrag;if(!gesture||gesture.pointerId!==event.pointerId)return;
    event.preventDefault();const target=cardAt(event.clientX,event.clientY);stopDrag();suppressTouchClick=true;
    if(unavailable())return;if(gesture.moved){if(target)dropAt(gesture.serial,target,event.clientY);}else inspect(gesture.serial);
  },listenerOptions);
  cards.addEventListener('lostpointercapture',event=>{if(touchDrag?.pointerId===event.pointerId)stopDrag();},listenerOptions);
  // HTML drag cancels the mouse pointer stream after dragstart. Only cancel
  // an actual captured touch gesture here; dragend owns the native drag.
  root.addEventListener('pointercancel',event=>{if(touchDrag?.pointerId===event.pointerId)stopDrag();},listenerOptions);
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&dragged!==undefined){event.preventDefault();event.stopPropagation();stopDrag();}},{...listenerOptions,capture:true});
  function validate():boolean {
    if(unavailable())return false;
    const invalid=roster.find(candidate=>{const draft=nameDrafts.get(candidate.serial);return draft!==undefined&&!validStartingCandidateName(draft.trim());});
    if(!invalid)return true;
    inspect(invalid.serial);options.onError('Chaque candidat doit avoir un nom de 1 à 80 caractères, sans caractère de contrôle.');
    dossier.querySelector<HTMLInputElement>('.front-candidate-name')?.focus();return false;
  }
  render();
  return {element:root,validate,setBusy(next){busy=next;stopDrag();for(const control of root.querySelectorAll<HTMLInputElement|HTMLButtonElement>('button,input'))control.disabled=next;for(const card of cards.querySelectorAll<HTMLButtonElement>('[draggable]'))card.draggable=!next;},
    dispose(){if(disposed)return;disposed=true;stopDrag();controller.abort();dossierController.abort();dismissTooltip();}};
}
