import {researchPrerequisite,intellectualSkill,RESEARCH_SCALE,researchUnlocked,type ResearchProject} from '../sim/research';
import type { Command, World } from '../sim/types';
import './world-panels.css';
import './management-reference-v199.css';
import {setTooltip} from './tooltip';
import {researchProjects} from './research-projects';
import {researchLinks,researchNodePosition as nodePosition,researchPrerequisiteLabels as prerequisites,researchLinkSvgPath,RESEARCH_GRAPH_WIDTH as GRAPH_WIDTH,RESEARCH_GRAPH_HEIGHT as GRAPH_HEIGHT} from './research-tree';
export {researchLinks} from './research-tree';
import {captureResearchStationIssues,readResearchReadiness,type ResearchStationCapture,type ResearchStationIssue} from './research-readiness';
import {isSchema290OrLater,isSchema291OrLater} from '../sim/schema-compatibility-257.ts';
import {isBowResearch326,isBowSchema326} from '../sim/bows-326.ts';
export {researchProjects} from './research-projects';
export interface ResearchPanelActions {onOpenWork?:()=>void;onOpenProduction?:()=>void}

const projectById=new Map(researchProjects.map(project=>[project.id,project]));
const stationIssueLabels:Record<ResearchStationIssue,string>={
  bench:'Bureau de recherche construit requis',
  'advanced-bench':'Bureau de recherche avancé construit requis',
  power:'Alimentation active du bureau compatible requise',
  analyzer:'Multi-analyseur alimenté à proximité requis',
};
const stationIssueText=(capture:ResearchStationCapture,project:ResearchProject):string|undefined=>{const issue=capture.issues.get(project);return issue===undefined?undefined:stationIssueLabels[issue];};
function paintSelected(root:HTMLElement,world:World,send:(command:Command)=>void,stations:ResearchStationCapture):void {
  const selected=projectById.get(root.dataset.selectedResearch as ResearchProject)??researchProjects[0]!;
  root.querySelector('[data-research-selection-title]')!.textContent=selected.title;
  root.querySelector('[data-research-selection-detail]')!.textContent=selected.detail;
  const done=researchUnlocked(world,selected.id),active=world.research?.project===selected.id,missing=researchPrerequisite(world,selected.id);
  const issue=stationIssueText(stations,selected.id),admissionBlocked=selected.id==='vitals-monitor'&&!stations.vitalsMonitorAvailable;
  root.querySelector('[data-research-selection-status]')!.textContent=done?'Terminée':missing?'Verrouillée':issue?active?`En attente : ${issue}`:issue:active?'Projet choisi':'Disponible';
  root.querySelector('[data-research-selection-prerequisites]')!.textContent=(prerequisites.get(selected.id)??[]).join(' + ')||'Aucun';
  const progress=root.querySelector<HTMLProgressElement>('[data-research-selection-progress]')!;
  progress.max=selected.cost;progress.value=(selected.progress(world)?.points??0)/RESEARCH_SCALE;
  root.querySelector('[data-research-selection-points]')!.textContent=`${progress.value.toFixed(1)} / ${selected.cost} points`;
  const start=root.querySelector<HTMLButtonElement>('[data-research-selected-start]')!;
  start.disabled=done||active||!!missing||admissionBlocked;
  start.textContent=done?'Recherche terminée':active?'Recherche en cours':'Lancer la recherche';
  setTooltip(start,{title:selected.title,body:missing?`Nécessite ${missing}.`:done?'Ce projet est acquis.':active?'Ce projet est déjà sélectionné.':admissionBlocked?'Un bureau avancé et un multi-analyseur alimentés sont requis avant de choisir ce projet.':issue?`${issue}. Le projet peut être choisi maintenant ; la progression attend le travail réel au bureau.`:'Affecter ce projet aux chercheurs. Changer de projet conserve les progrès.'});
  start.onclick=()=>send({type:'research-project',project:selected.id});
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-research-select]')){
    button.setAttribute('aria-pressed',String(button.dataset.researchSelect===selected.id));
  }
}

export function updateResearchPanel(root: HTMLElement, world: World, send: (command: Command) => void, actions:ResearchPanelActions={}): void {
  const stations=captureResearchStationIssues(world);
  if(root.dataset.selectedResearch==='tree-sowing'&&!isSchema291OrLater(world.schemaVersion))root.dataset.selectedResearch=world.research?.project??'complex-clothing';
  if(root.dataset.selectedResearch==='firefoam'&&!isSchema290OrLater(world.schemaVersion))root.dataset.selectedResearch=world.research?.project??'complex-clothing';
  if(isBowResearch326(root.dataset.selectedResearch)&&!isBowSchema326(world.schemaVersion))root.dataset.selectedResearch=world.research?.project??'complex-clothing';
  if(!projectById.has(root.dataset.selectedResearch as ResearchProject))root.dataset.selectedResearch=world.research?.project??'complex-clothing';
  const readiness=readResearchReadiness(world,root.dataset.selectedResearch as ResearchProject,stations);
  root.classList.add('research-reference');
  root.closest('#research-panel')?.classList.add('research-reference');
  if(!root.querySelector('[data-research-map]')){
    const viewport=document.createElement('div');viewport.className='research-viewport';viewport.dataset.researchMap='';
    viewport.setAttribute('role','group');viewport.setAttribute('aria-label','Projets de recherche et prérequis');
    const graph=document.createElement('div');graph.className='research-graph';graph.style.height=`${GRAPH_HEIGHT}px`;
    const lines=document.createElementNS('http://www.w3.org/2000/svg','svg');lines.setAttribute('class','research-links');lines.setAttribute('viewBox',`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`);lines.setAttribute('aria-hidden','true');
    lines.style.height=`${GRAPH_HEIGHT}px`;
    for(const [fromId,toId] of researchLinks){
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',researchLinkSvgPath(fromId,toId));
      lines.append(path);
    }
    graph.append(lines);
    for(const project of researchProjects){
      const node=document.createElement('div');node.className='research-node';node.dataset.researchNode=project.id;
      const position=nodePosition(project);node.style.left=`${position.x}px`;node.style.top=`${position.y}px`;
      const select=document.createElement('button');select.className='research-node-select';select.dataset.researchSelect=project.id;select.textContent=project.title;select.setAttribute('aria-label',`Détails : ${project.title}`);
      const progress=document.createElement('progress');progress.max=project.cost;progress.setAttribute(`data-${project.prefix}-progress`,'');progress.setAttribute('aria-label',`Progression ${project.title}`);
      const status=document.createElement('span');status.className='research-node-status';status.setAttribute(`data-${project.prefix}-status`,'');
      const cost=document.createElement('span');cost.className='research-node-cost';cost.textContent=String(project.cost);
      const start=document.createElement('button');start.type='button';start.className='research-node-start';start.setAttribute(`data-${project.prefix}-start`,'');start.textContent='▶';start.setAttribute('aria-label',`Lancer ${project.title}`);
      node.append(select,cost,progress,status,start);graph.append(node);
    }
    viewport.append(graph);
    const detail=document.createElement('section');detail.className='research-detail';detail.setAttribute('aria-label','Projet sélectionné');
    detail.innerHTML='<div class="research-detail-header"><h3 data-research-selection-title></h3><span data-research-selection-status></span></div><p data-research-selection-detail></p><p class="research-prerequisites">Prérequis<br><strong data-research-selection-prerequisites></strong></p><progress data-research-selection-progress aria-label="Progression du projet sélectionné"></progress><div class="research-detail-footer"><span data-research-selection-points></span><button type="button" data-research-selected-start>Lancer la recherche</button></div>';
    const footer=document.createElement('div');footer.className='research-footer';
    footer.innerHTML='<section class="research-active"><h4>Projet actif</h4><button type="button" data-research-active-project>Aucun</button><progress data-research-active-progress aria-label="Progression du projet actif"></progress><span data-research-active-points></span></section><button type="button" data-research-pause>Suspendre la recherche</button><p data-research-readiness></p><p data-research-workers></p><button type="button" data-research-open-work>Ouvrir Travail</button><button type="button" data-research-open-production>Ouvrir Production</button><details class="research-help"><summary>Aide à la recherche</summary><p data-research-help></p></details>';
    footer.querySelector<HTMLButtonElement>('[data-research-pause]')!.onclick=()=>send({type:'research-project',project:null});
    const sidebar=document.createElement('div');sidebar.className='research-sidebar';sidebar.append(detail,footer);
    const map=document.createElement('section');map.className='research-map-section';map.innerHTML='<h3 class="research-map-title">Principal</h3>';map.append(viewport);
    const layout=document.createElement('div');layout.className='research-core-layout';layout.append(sidebar,map);
    root.replaceChildren(layout);
  }
  for(const project of researchProjects){
    if(project.id==='tree-sowing'){const node=root.querySelector<HTMLElement>('[data-research-node="tree-sowing"]')!;node.hidden=!isSchema291OrLater(world.schemaVersion);if(node.hidden)continue;}
    if(project.id==='firefoam'){const node=root.querySelector<HTMLElement>('[data-research-node="firefoam"]')!;node.hidden=!isSchema290OrLater(world.schemaVersion);if(node.hidden)continue;}
    if(isBowResearch326(project.id)){const node=root.querySelector<HTMLElement>(`[data-research-node="${project.id}"]`)!;node.hidden=!isBowSchema326(world.schemaVersion);if(node.hidden)continue;}
    const done=researchUnlocked(world,project.id),active=world.research?.project===project.id,progress=project.progress(world),points=(progress?.points??0)/RESEARCH_SCALE,missing=researchPrerequisite(world,project.id);
    root.querySelector<HTMLProgressElement>(`[data-${project.prefix}-progress]`)!.value=points;
    const initial=done&&progress?.completedAt===0&&(world.scenario?.id==='survivors'||world.scenario?.id==='crashlanded');
    const issue=stationIssueText(stations,project.id),admissionBlocked=project.id==='vitals-monitor'&&!stations.vitalsMonitorAvailable;
    root.querySelector(`[data-${project.prefix}-status]`)!.textContent=done?initial?'Acquise au départ':'Terminée':missing?'Verrouillée':issue?'En attente du poste':active?'En cours':'Disponible';
    const start=root.querySelector<HTMLButtonElement>(`[data-${project.prefix}-start]`)!;
    start.disabled=done||active||!!missing||admissionBlocked;
    setTooltip(start,{title:`Lancer ${project.title}`,body:missing?`Nécessite ${missing}.`:done?'Recherche acquise.':active?'Recherche active.':admissionBlocked?'Un bureau avancé et un multi-analyseur alimentés sont requis avant de choisir ce projet.':'Choisir ce projet ; les progrès antérieurs sont conservés.'});
    start.onclick=()=>{root.dataset.selectedResearch=project.id;send({type:'research-project',project:project.id});};
    const select=root.querySelector<HTMLButtonElement>(`[data-research-select="${project.id}"]`)!;
    select.onclick=()=>{root.dataset.selectedResearch=project.id;paintSelected(root,world,send,stations);};
    setTooltip(select,{title:project.title,body:project.detail,rows:[{label:'Progression',value:`${points.toFixed(1)} / ${project.cost}`},{label:'Prérequis',value:(prerequisites.get(project.id)??[]).join(' + ')||'Aucun'},{label:'État',value:done?'Acquise':missing?`Nécessite ${missing}`:active?'En cours':issue??'Disponible'}]});
    root.querySelector<HTMLElement>(`[data-research-node="${project.id}"]`)!.dataset.state=done?'done':active?'active':missing?'locked':'available';
  }
  if(!projectById.has(root.dataset.selectedResearch as ResearchProject))root.dataset.selectedResearch=world.research?.project??'complex-clothing';
  paintSelected(root,world,send,stations);
  const active=world.research?.project?projectById.get(world.research.project):undefined;
  const activeButton=root.querySelector<HTMLButtonElement>('[data-research-active-project]')!;
  activeButton.textContent=active?.title??'Aucun projet';activeButton.disabled=!active;
  activeButton.onclick=()=>{if(active){root.dataset.selectedResearch=active.id;paintSelected(root,world,send,stations);}};
  const activeProgress=root.querySelector<HTMLProgressElement>('[data-research-active-progress]')!;
  activeProgress.hidden=!active;activeProgress.max=active?.cost??1;activeProgress.value=active?(active.progress(world)?.points??0)/RESEARCH_SCALE:0;
  root.querySelector('[data-research-active-points]')!.textContent=active?`${activeProgress.value.toFixed(1)} / ${active.cost}`:'';
  root.querySelector<HTMLButtonElement>('[data-research-pause]')!.disabled=!world.research?.project;
  root.querySelector('[data-research-help]')!.textContent=researchProjects.every(p=>researchUnlocked(world,p.id))
    ? `Les ${researchProjects.length} projets disponibles sont acquis.`
    : 'Construisez un bureau de recherche dans Architecte → Production, puis affectez un colon dans Travail. Les recherches avancées exigent un bureau alimenté ; Fabrication exige aussi un multi-analyseur alimenté à proximité. L’électricité est disponible au départ.';
  const assigned=readiness.assignedIds.length,capable=readiness.capableIds.length,medical=readiness.medicallyUnavailableIds.length;
  root.querySelector('[data-research-readiness]')!.textContent=!readiness.localIds.length?'Aucun colon libre vivant sur cette carte.':!capable?'Aucun colon local ne peut exercer Recherche selon son dossier.':!assigned?`Recherche désactivée dans Travail pour les ${capable} colon(s) capables.`:`${assigned} colon(s) affecté(s) à Recherche${medical?` ; ${medical} physiquement indisponible(s)`:''}.`;
  const engaged=new Set(readiness.engagedIds),moving=new Set(readiness.movingIds),working=new Set(readiness.workingIds);
  const workers=world.pawns.filter(p=>engaged.has(p.id)).map(p=>`${p.name} · Intellectuel ${intellectualSkill(p).level} · ${working.has(p.id)?'au bureau':moving.has(p.id)?'en chemin':'engagement observé'}`);
  root.querySelector('[data-research-workers]')!.textContent=workers.join(' ; ')||`${readiness.benchIds.length} bureau(x) physique(s) présent(s) · aucun engagement de recherche observé actuellement. Les besoins et les autres travaux continuent.`;
  const work=root.querySelector<HTMLButtonElement>('[data-research-open-work]')!,production=root.querySelector<HTMLButtonElement>('[data-research-open-production]')!;
  work.hidden=!actions.onOpenWork;work.onclick=actions.onOpenWork?()=>actions.onOpenWork?.():null;
  production.hidden=!actions.onOpenProduction;production.onclick=actions.onOpenProduction?()=>actions.onOpenProduction?.():null;
}
