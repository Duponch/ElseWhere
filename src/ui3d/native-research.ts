import {isSchema298OrLater} from '../sim/schema-compatibility-257.ts';
import type {NativeControl,NativePage,NativeRow,NativeUiActions} from './native-contract';
import type {World} from '../sim/types';
import {intellectualSkill,needsHighTechBench,needsResearchAnalyzer,researchPrerequisite,researchUnlocked,RESEARCH_SCALE,type ResearchProject} from '../sim/research';
import {researchProjects,type ProjectNode} from '../ui/research-projects';
import {captureResearchStationIssues,readResearchReadiness,type ResearchStationIssue} from '../ui/research-readiness';
import {researchPrerequisiteLabels} from '../ui/research-tree';
import {coreResearchExtent,coreResearchLinks,coreResearchNodePosition,NATIVE_RESEARCH} from './native-research-geometry';

const minimumSchema:Partial<Record<ResearchProject,number>>={electricity:382,'passive-cooler':382,ieds:357,devilstrand:358,'carpet-making':355,'gas-operation':342,'precision-rifling':342,'blowback-operation':340,'penoxycyline-production':337,'recurve-bow':326,greatbow:326,'long-range-mineral-scanner':298,'ship-computer':298,'ship-sensors':298,'tree-sowing':291,firefoam:290,'ship-cryptosleep':277,'ship-engine':276,'ship-basics':275,'ship-reactor':275,prosthetics:273,cryptosleep:271,'long-blades':270,brewing:265,'geothermal-power':264,pemmican:248,'biofuel-refining':218,'nutrient-paste':217,'deep-drilling':215,'ground-scanner':215,'sterile-materials':211,'vitals-monitor':211,'drug-production':206,'medicine-production':206,hydroponics:203,'gun-turrets':193,'tube-television':190,'packaged-survival-meals':188,'hospital-bed':187,autodoors:143};
const issueLabels:Record<ResearchStationIssue,string>={bench:'Bureau de recherche construit requis','advanced-bench':'Bureau de recherche avancé construit requis',power:'Alimentation active du bureau compatible requise',analyzer:'Multi-analyseur alimenté à proximité requis'};
const nodeColors={done:'#bacb9c',active:'#d9ae60',locked:'#d0c3ac',available:'#b8c39a'} as const;
const helpText='Construisez un bureau de recherche dans Architecte → Production, puis affectez un colon dans Travail. Les recherches avancées exigent un bureau alimenté ; Les exigences du bureau et du multi-analyseur sont indiquées dans chaque dossier. L’électricité est disponible au départ.';
const catalogues=new Map<number,{projects:readonly ProjectNode[];links:typeof coreResearchLinks;width:number;height:number}>();
function catalogue(schema:number){
  let result=catalogues.get(schema);
  if(!result){const projects=researchProjects.filter(project=>minimumSchema[project.id]===298?isSchema298OrLater(schema):schema>=(minimumSchema[project.id]??0)),ids=new Set(projects.map(project=>project.id));result={projects,links:coreResearchLinks.filter(link=>ids.has(link.from)&&ids.has(link.to)),...coreResearchExtent([...ids])};catalogues.set(schema,result);}
  return result;
}
let selectedProject:ResearchProject|undefined;
let helpOpen=false,ownerIdentity='',lastTick=-1,researchSearch='',focusRevision=0,focusTarget:ResearchProject|undefined;
const fold=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr');
const searchable=new Map(researchProjects.map(project=>[project.id,fold([project.id,project.title,project.detail].join(' '))]));

/** Draft-only selection; no progress or command is stored in this UI state. */
export function resetNativeResearch():void{selectedProject=undefined;helpOpen=false;ownerIdentity='';lastTick=-1;researchSearch='';focusRevision++;focusTarget=undefined;}
const button=(id:string,label:string,onActivate:NativeControl['onActivate'],extra:Partial<NativeControl>={}):NativeControl=>({id,label,onActivate,...extra});
const detail=(id:string,label:string,value?:string,extra:Partial<NativeRow>={}):NativeRow=>({id,label,value,region:'details',...extra});

/** The same tree, dossier and admission rules as the former research window.
 * Only data for native meshes is returned. The caller supplies its ordinary
 * command guard (native-panels passes send), never an alternate game command. */
export function buildNativeResearch(world:World,actions:NativeUiActions,onRefresh:()=>void=actions.refresh):NativePage{
  const state=actions.readState?.(),identity=`${state?.epoch??''}:${world.seed}:${world.width}:${world.height}`;
  if(identity!==ownerIdentity||world.tick<lastTick){selectedProject=undefined;helpOpen=false;ownerIdentity=identity;researchSearch='';focusRevision++;focusTarget=undefined;}
  lastTick=world.tick;
  const {projects,links,width:graphWidth,height:graphHeight}=catalogue(world.schemaVersion);
  const selected=projects.find(project=>project.id===selectedProject)??projects.find(project=>project.id===world.research?.project)
    ??projects.find(project=>project.id==='complex-clothing')??projects[0]!;
  selectedProject=selected.id;
  if(!focusTarget||!projects.some(project=>project.id===focusTarget))focusTarget=selected.id;
  const queryWords=(query:string)=>fold(query).split(/\s+/).filter(Boolean);
  const matches=(project:ProjectNode,words:readonly string[])=>words.every(word=>searchable.get(project.id)!.includes(word));
  const words=queryWords(researchSearch),matching=words.length?projects.filter(project=>matches(project,words)):projects;
  const matchingIds=words.length?new Set(matching.map(project=>project.id)):undefined;
  const stations=captureResearchStationIssues(world),readiness=readResearchReadiness(world,selected.id,stations);
  const byId=new Map(world.pawns.map(pawn=>[pawn.id,pawn]));
  const names=(ids:readonly number[])=>ids.map(id=>byId.get(id)?.name??`#${id}`).join(', ')||'Aucun';
  const active=projects.find(project=>project.id===world.research?.project);
  const points=(project:ProjectNode)=>(project.progress(world)?.points??0)/RESEARCH_SCALE;
  const prerequisite=(project:ResearchProject)=>(researchPrerequisiteLabels.get(project)??[]).join(' + ')||'Aucun';
  const select=(project:ResearchProject,focus=false)=>{selectedProject=project;focusTarget=project;if(focus)focusRevision++;onRefresh();};
  const start=(project:ResearchProject)=>{selectedProject=project;focusTarget=project;return actions.command({type:'research-project',project});};
  const facts=(project:ProjectNode)=>{
    const done=researchUnlocked(world,project.id),isActive=world.research?.project===project.id,missing=researchPrerequisite(world,project.id),issue=stations.issues.get(project.id);
    const blocked=project.id==='vitals-monitor'&&!stations.vitalsMonitorAvailable;
    const status=done?'Terminée':missing?'Verrouillée':issue?isActive?`En attente : ${issueLabels[issue]}`:issueLabels[issue]:isActive?'Projet choisi':'Disponible';
    const hint=missing?`Nécessite ${missing}.`:done?'Ce projet est acquis.':isActive?'Ce projet est déjà sélectionné.':blocked?'Un bureau avancé et un multi-analyseur alimentés sont requis avant de choisir ce projet.':issue?`${issueLabels[issue]}. Le projet peut être choisi maintenant ; la progression attend le travail réel au bureau.`:'Affecter ce projet aux chercheurs. Changer de projet conserve les progrès.';
    return {done,isActive,missing,issue,status,hint,disabled:done||isActive||!!missing||blocked};
  };
  const selectedFacts=facts(selected),selectedPoints=points(selected);
  const rows:NativeRow[]=[
    {id:'research-tabs',label:'',region:'navigation',controlStyle:'tab',controls:[button('research-tab-main','Principal',()=>{}, {active:true,hint:'Arbre principal des projets de recherche livrés.'})]},
    {id:'research-search',label:'',region:'navigation',hint:`${matching.length} projet(s) correspondant(s) sur ${projects.length}. Les autres restent dans l'arbre.`,
      input:{value:researchSearch,placeholder:'Rechercher…',maxLength:100,onCommit:value=>{
        researchSearch=value.trim();
        const searchWords=queryWords(researchSearch);
        const first=searchWords.length?projects.filter(project=>matches(project,searchWords)).sort((a,b)=>{
          const left=coreResearchNodePosition(a.id),right=coreResearchNodePosition(b.id);
          return left.x-right.x||left.y-right.y;
        })[0]:undefined;
        if(first){select(first.id,true);return;}
        onRefresh();
      }}},
    detail('research-selected-title',selected.title,undefined,{emphasis:'heading'}),
    detail('research-selected-status',selectedFacts.status,undefined,{emphasis:selectedFacts.done?'normal':'muted'}),
    detail('research-selected-description',selected.detail),
    detail('research-equipment','Poste',needsResearchAnalyzer(selected.id)?'Bureau haute technologie + multi-analyseur reliés et alimentés':needsHighTechBench(selected.id)?'Bureau haute technologie alimenté':'Bureau simple ou haute technologie',{labelWidth:76}),
    detail('research-prerequisite','Prérequis',prerequisite(selected.id),{labelWidth:76,hint:selectedFacts.missing?`Nécessite ${selectedFacts.missing}`:'Prérequis acquis'}),
    detail('research-selected-progress','Progression',undefined,{meter:{value:selectedPoints,max:selected.cost,label:`${selectedPoints.toFixed(1)} / ${selected.cost}`,color:'#7e9860'},hint:`${selectedPoints.toFixed(1)} / ${selected.cost} points`}),
    detail('research-selected-action','',undefined,{controlStyle:'button',controls:[button('research-start',selectedFacts.done?'Recherche terminée':selectedFacts.isActive?'Recherche en cours':'Lancer la recherche',()=>start(selected.id),{icon:'recherches',disabled:selectedFacts.disabled,hint:`${selected.title}\n${selectedFacts.hint}`})]}),
    detail('research-active-heading','Projet actif',undefined,{emphasis:'heading'}),
    detail('research-active','',undefined,{controlStyle:'button',controls:[button('research-active-project',active?.title??'Aucun projet',()=>{if(active)select(active.id,true);},{disabled:!active,hint:active?'Revenir au dossier du projet actif.':'Aucun projet de recherche choisi.'})]}),
  ];
  if(active)rows.push(detail('research-active-progress','Progression',undefined,{meter:{value:points(active),max:active.cost,label:`${points(active).toFixed(1)} / ${active.cost}`,color:'#7e9860'}}));
  rows.push(
    detail('research-pause-row','',undefined,{controlStyle:'button',controls:[button('research-pause','Suspendre la recherche',()=>actions.command({type:'research-project',project:null}),{disabled:!world.research?.project,hint:'Suspendre le projet actif en conservant tous les progrès.'})]}),
    detail('research-station','Installation',readiness.stationIssue?issueLabels[readiness.stationIssue]:'Installation compatible disponible',{labelWidth:80}),
  );
  const assigned=readiness.assignedIds.length,capable=readiness.capableIds.length,medical=readiness.medicallyUnavailableIds.length;
  const readinessText=!readiness.localIds.length?'Aucun colon libre vivant sur cette carte.':!capable?'Aucun colon local ne peut exercer Recherche selon son dossier.':!assigned?`Recherche désactivée dans Travail pour les ${capable} colon(s) capables.`:`${assigned} colon(s) affecté(s) à Recherche${medical?` ; ${medical} physiquement indisponible(s)`:''}.`;
  const working=new Set(readiness.workingIds),moving=new Set(readiness.movingIds);
  const workers=readiness.engagedIds.map(id=>{const pawn=byId.get(id);return pawn?`${pawn.name} · Intellectuel ${intellectualSkill(pawn).level} · ${working.has(id)?'au bureau':moving.has(id)?'en chemin':'engagement observé'}`:`#${id}`;});
  rows.push(
    detail('research-readiness',readinessText,undefined,{hint:`Affectés : ${names(readiness.assignedIds)}\nEn travail : ${names(readiness.workingIds)}\nEn déplacement : ${names(readiness.movingIds)}\nIndisponibilité médicale : ${names(readiness.medicallyUnavailableIds)}`}),
    detail('research-workers',workers.join(' ; ')||`${readiness.benchIds.length} bureau(x) physique(s) présent(s) · aucun engagement de recherche observé actuellement. Les besoins et les autres travaux continuent.`,undefined,{emphasis:'muted'}),
    detail('research-context','',undefined,{controlStyle:'button',controls:[button('research-open-work','Ouvrir Travail',()=>actions.panel('work'),{icon:'travail',hint:'Consulter les priorités et les chercheurs affectés.'}),button('research-open-production','Ouvrir Production',()=>{actions.category('production');return actions.panel('architect');},{icon:'production',hint:'Construire un bureau de recherche ou une installation avancée.'})]}),
    detail('research-help-toggle','',undefined,{controlStyle:'button',controls:[button('research-help',`${helpOpen?'▾':'▸'} Aide à la recherche`,()=>{helpOpen=!helpOpen;onRefresh();},{active:helpOpen,hint:'Afficher ou replier les explications sur les recherches.'})]}),
  );
  if(helpOpen)rows.push(detail('research-help-body',projects.every(project=>researchUnlocked(world,project.id))?`Les ${projects.length} projets disponibles sont acquis.`:helpText));
  for(const project of projects){
    const current=facts(project),progress=points(project),position=coreResearchNodePosition(project.id),state=current.done?'done':current.isActive?'active':current.missing?'locked':'available';
    const initial=current.done&&project.progress(world)?.completedAt===0&&(world.scenario?.id==='survivors'||world.scenario?.id==='crashlanded');
    const status=initial?'Acquise au départ':current.done?'Terminée':current.missing?'Verrouillée':current.issue?'En attente du poste':current.isActive?'En cours':'Disponible';
    const searchMatch=matchingIds?.has(project.id)??true;
    rows.push({id:`research-node-${project.id}`,label:project.title,region:'graph',controlStyle:'research',
      graphNode:{...position,width:NATIVE_RESEARCH.nodeWidth,height:NATIVE_RESEARCH.nodeHeight,points:progress,cost:project.cost,state,searchMatch},
      controls:[button(`research-${project.id}-select`,project.title,()=>select(project.id),{active:selected.id===project.id,color:searchMatch?nodeColors[state]:'#e4dbc9',icon:project.id,hint:`${project.title}\n${project.detail}\nProgression : ${progress.toFixed(1)} / ${project.cost}\nPrérequis : ${prerequisite(project.id)}\nÉtat : ${status}`}),
        button(`research-${project.id}-start`,'▶',()=>start(project.id),{disabled:current.disabled,active:current.isActive,hint:`Lancer ${project.title}\n${current.hint}`})]});
  }
  return {id:'research',title:'Recherche',layout:'research',height:900,rows,
    research:{width:graphWidth,height:graphHeight,selected:selected.id,links,focus:{key:`${identity}:${focusRevision}`,...coreResearchNodePosition(focusTarget)}},
    onClose:()=>void actions.panel(null)};
}
