import {journalPictogram} from '../ui/journal-events';
import { storedPriority } from '../sim/work-types.ts';
import {liveNativePage} from './native-page-refresh';
import {CARPET_FLOORS_355,carpetColor355,isCarpetFloor355} from '../sim/carpet-355';
import {LETTER_CLASSES_352,isSchema352OrLater} from '../sim/letters-352';
import {DEFAULT_PLAN_COLOR_369,PLAN_COLORS_369,PLAN_COLOR_DEFS_369,planColorHex369} from '../sim/plans-369';
import {storytellerIncidents347,tutorialMode347} from '../sim/game-profile';
import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {READING_POLICIES_295,effectiveReadingPolicy295} from '../sim/reading-state-295';
import type {NativeUiState,NativeUiActions,NativePage,NativeRow,NativeControl,NativeGesture} from './native-contract';
import {buildNativeWorld,syncNativeWorldState,resetNativeWorldSession,nativePaidAiSiteFacts298,focusNativePaidAiSite298,focusNativeTradeRequestDestination,nativeTradeRequestVisitors} from './native-world';
import {groupDisplayLabel} from '../ui/map-registry-adapter';
import {effectiveCore297} from '../sim/core-phase-297';
import {nativeArrivalRows} from './native-arrivals';
import {NATIVE_HISTORY,NATIVE_MENU,NATIVE_QUESTS} from './native-main-tab-metrics';
import {NATIVE_MESSAGE} from './native-dialog-metrics';
import {nativeTextEntitiesFor} from './native-text-entities';
import {toolDefinitions,workColumns,productionToolOrder} from './native-catalog';
import type {ArchitectCategory} from '../ui/layout';
import {architectCategoryAvailable,architectToolAvailable} from '../ui/architect-availability';
import {isColonist} from '../sim/affiliation';
import {backgroundWorkRefusal} from '../sim/colonist-backgrounds';
import {miningSkill,miningWorkSpeed,miningYield} from '../sim/mining-skills';
import {plantSkill,plantWorkSpeed} from '../sim/plant-skills';
import {cookingSkill,cookingSpeed,butcheryEfficiency} from '../sim/cooking-statistics';
import {artisticSkill} from '../sim/art-rules';
import {constructionSpeed,learningFactor} from '../sim/skills';
import {traitLabel} from '../lore/lore-text';
import {appearanceOf} from '../sim/pawn-appearance';
import {queryPawnStatus} from '../sim/diagnostics';
import {calendarTick} from '../sim/calendar';
import {hourOfDay,type ScheduleAssignment} from '../sim/schedule';
import {TICKS_PER_DAY,type Command,type Pawn,type WorkType,type World} from '../sim/types';
import {animalSpecies} from '../sim/animal-species';
import {actualAnimalName256} from '../sim/starting-pet-state-256';
import {knownPosition256} from '../ui/exploration-readers-256';
import {animalActivity} from '../ui/animal-activity';
import {animalLifeStage,animalNutritionMax,gestationTicks} from '../sim/animal-life';
import {animalBody} from '../sim/wildlife-health';
import {canTameSpecies} from '../sim/animal-handling';
import {isManhunterRevengeSchema348,manhunterOnDamageChance348,manhunterOnTameFailChance348} from '../sim/animal-manhunter-revenge-348';
import {slaughterRefusal} from '../sim/animal-slaughter';
import {readAnimalTraining282,trainingRefusal282} from '../sim/animal-training-282';
import {MEDICAL_CARE,type MedicalCare} from '../sim/medicine-rules';
import {productKind,productFullness} from '../sim/animal-products';
import {animalPenStatus} from '../ui/pen-status';
import {supportsAnimalAreas287,currentAnimalAreaChoice287} from '../sim/animal-area-policy-287';
import type {AnimalAreaChoice287} from '../sim/animal-area-state-287';
import {AUTO_SLAUGHTER_SPECIES,defaultAutoSlaughterConfig,type AutoSlaughterConfig,type AutoSlaughterSpecies} from '../sim/auto-slaughter-state';
import {autoSlaughterCounts,autoSlaughterTargets} from '../sim/auto-slaughter';
import {buildNativeResearch,resetNativeResearch} from './native-research';
import {expectationForWealth} from '../sim/expectations';
import {ITEM_DEFINITIONS} from '../sim/items';
import {FOOD_ITEMS} from '../sim/food-policy';
import {effectiveDrugPolicies265,penoxycylinePolicyOf337,type BeerPolicy265} from '../sim/alcohol-policy-265';
import {isPenoxycyline337,type PenoxycylinePolicy337} from '../sim/penoxycyline-337';
import {APPAREL,type ApparelItem} from '../sim/apparel-rules';
import {APPAREL_POLICY_MATERIALS267,apparelPolicyMaterialLabel267} from '../sim/apparel-policy';
import {WEAPON_QUALITIES,QUALITY_LABELS,type WeaponQuality} from '../sim/equipment-rules';
import {tradeRequestContent284} from '../sim/trade-request-content-284';
import {worldSettlementAccess256} from '../sim/world-faction-access';
import {peaceTalksFacts293} from '../ui/peace-talks-293';
import {constructionMaterials} from '../sim/construction-materials';
import {constructionToolObject,constructionMaterialLines,constructionMaterialLabel,constructionThingLabel,constructionCostText} from '../ui/construction-material-presentation';
import {createNativeStorageEditor} from './native-storage-editor';
import {registeredMapId} from '../sim/world-map-context';
import {previewBackgroundSkills} from '../sim/background-generation';
import {startingSkills} from '../sim/skills';
import {biologicalYears,chronologicalYears} from '../sim/human-age';
import {backgroundInspectionRows,backgroundSkillSummary,BACKGROUND_SKILL_LABELS} from '../ui/background-inspection';
import {WORK_COLUMN_LABEL} from './native-pawn-table';
import {isSchema344OrLater,simpleWorkTab344,shownWorkPriority344,nextCellPriority344,nextWorkSort344,sortWorkRows344,relevantSkills344,relevantSkillAverage344,relevantPassion344,veryBadSkill344,type WorkClick344,type WorkSort344} from '../sim/work-tab-344';
import {offeredRelationshipText} from '../ui/relationship-inspection';
import {copyWorkPriorities,hasWorkPriorityClipboard,pasteWorkPriorities,workPriorityPastePlan} from '../ui/work-priority-clipboard';
import type {JoinerQuest} from '../sim/quest-state';
import type {TradeRequest284} from '../sim/trade-request-state-284';

/** Native drafts only. Confirmed World objects are borrowed and never edited. */
let latest:NativeUiState|undefined;
let host:NativeUiActions|undefined;
let scheduleBrush:ScheduleAssignment='anything';
let scheduleClipboard:ScheduleAssignment[]|undefined;
let lastIdentity='',lastTick=-1;
let panelSessionRevision=0;
let dispatching=false;
const categories:readonly [ArchitectCategory,string][]=[['temperature','Température'],['structure','Structure'],['floors','Sols'],['furniture','Mobilier'],['recreation','Loisirs'],['production','Production'],['power','Énergie'],['ship','Vaisseau']];
const assignmentLabels:Record<ScheduleAssignment,string>={anything:'Temps libre',work:'Travail',sleep:'Dormir',recreation:'Loisir'};
const assignmentSymbols:Record<ScheduleAssignment,string>={anything:'·',work:'T',sleep:'Z',recreation:'L'};
const stageLabels={baby:'Petit',juvenile:'Jeune',adult:'Adulte'} as const;
const money=(value:number)=>`${value.toLocaleString('fr-FR',{maximumFractionDigits:2})} argent`;
const days=(ticks:number)=>`${Math.max(0,ticks/TICKS_PER_DAY).toLocaleString('fr-FR',{maximumFractionDigits:2})} j`;
const signed=(n:number)=>`${n>0?'+':''}${n}`;
const button=(id:string,label:string,onActivate:NativeControl['onActivate'],extra:Partial<NativeControl>={}):NativeControl=>({id,label,onActivate,...extra});
const row=(id:string,label:string,value?:string,detail?:string,controls?:NativeControl[]):NativeRow=>({id,label,value,detail,controls});
function currentWorld():World {const world=latest?.world;if(!world)throw Error('La carte locale n’est plus disponible.');return world;}
function currentPawn(id:number):Pawn {const pawn=currentWorld().pawns.find(p=>p.id===id);if(!pawn)throw Error('Cette personne n’est plus présente sur la carte.');return pawn;}
function currentAnimal(id:number){const animal=currentWorld().wildlife?.animals.find(a=>a.id===id);if(!animal)throw Error('Cet animal n’est plus présent sur la carte.');return animal;}
async function send(command:Command):Promise<unknown>{
 if(!host||!latest||dispatching||(host.readState?.()??latest).busy)throw Error('Attendez la fin de l’opération courante.');
 dispatching=true;
 try {const result=await host.command(command);if(result&&typeof result==='object'&&'ok'in result&&result.ok===false)throw Error('reason'in result&&typeof result.reason==='string'?result.reason:'La commande a été refusée.');return result;}
 finally {dispatching=false;host.refresh();}
}
function open(page:NativePage):void {host?.showPage({...page,textEntities:page.textEntities??nativeTextEntitiesFor(latest?.world,latest?.campaign)});}
/** Read-only dossiers are live projections. The separate editor factories
 * continue to own their drafts and are deliberately opened with open(). */
function livePanelPage(make:()=>NativePage|null):NativePage|null {
 const page=make(),state=latest;if(!page||!state)return null;
 return liveNativePage(page,state,(next,actions)=>{syncNativePanelState(next,actions);return livePanelPage(make);});
}
function openLive(make:()=>NativePage|null):void {const page=livePanelPage(make);if(page)open(page);}
function redraw():void {host?.refresh();}
function back():void {const state=latest,actions=host;if(!state||!actions)return;const page=buildNativePanel(state,actions);if(page)open(page);}
function detailPage(id:string,title:string,rows:NativeRow[],actions:NativeControl[]=[],onBack:()=>void=back):NativePage{return {id,title,rows,actions:[...actions,button(`${id}-back`,'Retour',onBack)],modal:true,width:7.8,onClose:onBack};}
function choose(id:string,title:string,choices:{id:string;label:string;detail?:string;active?:boolean;disabled?:boolean;choose:()=>void|Promise<unknown>}[],after:()=>void=back):void {
 const rows=choices.map(choice=>row(choice.id,choice.label,undefined,choice.detail,[button(`${choice.id}-choose`,choice.active?'Choisi':'Choisir',async()=>{await choice.choose();after();},{active:choice.active,disabled:choice.disabled})]));
 open(detailPage(id,title,rows,[],after));
}
function confirm(id:string,title:string,detail:string,action:()=>Promise<unknown>):void {open(detailPage(id,title,[row(`${id}-message`,detail)], [button(`${id}-confirm`,'Confirmer',async()=>{await action();back();})]));}
function inputPage(id:string,title:string,value:string,onCommit:(value:string)=>void|Promise<unknown>,detail?:string,maxLength=60):void {
 let draft=value;
 const input:NativeRow={id:`${id}-input`,label:'Nom',detail,input:{value,placeholder:'Saisir un nom',maxLength,onCommit:text=>{draft=text;}}};
 open(detailPage(id,title,[input],[button(`${id}-apply`,'Appliquer',async()=>{await onCommit(draft);back();})]));
}

function creationStorageEditor(onBack:()=>void=back):void {
 if(!latest||!host)return;
 open(createNativeStorageEditor({id:'creation-storage',title:'Réglages de la nouvelle réserve',initial:latest.creationStorage,
  show:open,onApply:settings=>host!.creationStorage(settings),onBack,applyLabel:'Appliquer aux prochaines zones'}));
}
/** Map designations keep their own owner, separate from construction categories. */
export function buildNativeToolPalette(state:NativeUiState,actions:NativeUiActions,kind:'orders'|'zones'):NativePage {
 syncNativePanelState(state,actions);
 const tools=toolDefinitions.filter(tool=>tool.category===kind&&tool.id!=='select'&&!!state.world&&architectToolAvailable(state.world,tool.id));
 const controls=tools.map(tool=>nativeToolControl(tool,state,actions));
 if(kind==='zones')controls.push(button('zones-areas-open','Zones autorisées',()=>areaEditor(()=>{if(latest&&host)open(buildNativeToolPalette(latest,host,'zones'));}),{icon:'zones',hint:'Gérer les dix zones autorisées · noms, couleurs, agrandissement et réduction.'}));
 if(kind==='zones')controls.push(button('architect-storage-settings-open','Réglages du stockage',()=>creationStorageEditor(()=>{if(latest&&host)open(buildNativeToolPalette(latest,host,'zones'));}),{icon:'settings',hint:'Réglages de la nouvelle réserve\nObjets acceptés, priorité, conservation, qualité et points de vie. Les réglages sont appliqués aux prochaines réserves tracées.'}));
 return {id:`map-tools-${kind}`,title:kind==='orders'?'Ordres':'Zones',layout:'palette',palette:kind,width:600,
  rows:[{id:`${kind}-tools`,label:'',region:'catalogue',controlStyle:'icon',controls}],onClose:()=>{actions.closePage?.();void actions.panel(null);}};
}
/** Schema 369: Core's Planifier opens its colour grid; a colour arms the tool. */
function planColorPage369(state:NativeUiState,actions:NativeUiActions):void {
 const current=state.planColor369??DEFAULT_PLAN_COLOR_369,reopen=()=>{if(latest&&host)open(buildNativeToolPalette(latest,host,'orders'));};
 const page=detailPage('plan-colors-369','Couleur du plan',[
  {id:'plan-colors',label:'Couleurs',compact:true,presentation:'plain',controls:PLAN_COLORS_369.map(color=>button(`plan-color-${color}`,PLAN_COLOR_DEFS_369[color].label,()=>actions.planColor369!(color),
   {color:`#${planColorHex369(color).toString(16).padStart(6,'0')}`,caption:color===current?'Choisie':undefined,hint:`Planifier en ${PLAN_COLOR_DEFS_369[color].label.toLowerCase()}`}))},
 ],[],reopen);
 page.width=600;open(page);
}
function nativeToolControl(tool:(typeof toolDefinitions)[number],state:NativeUiState,actions:NativeUiActions):NativeControl {
 const selected=state.tool===tool.id,entity=selected?constructionToolObject(tool.id,state.constructionMaterial):undefined;
 return button(`tool-${tool.id}-select`,tool.title,()=>tool.id==='plan'&&actions.planColor369?planColorPage369(state,actions):actions.tool(tool.id),{
  icon:tool.id,caption:tool.key||undefined,hint:`${entity?constructionThingLabel(tool.title,entity):tool.title}${tool.key?` · ${tool.key}`:''}\n${[entity?constructionCostText(entity,true):'',tool.hint].filter(Boolean).join('\n')}`,active:selected,
 });
}
function architect(state:NativeUiState,actions:NativeUiActions,world:World):NativePage {
 const category=state.category==='orders'||state.category==='zones'?'structure':state.category;
 // Schema 355: one carpet tile (Core's Floor_Carpet dropdown); its colour is chosen below.
 const carpetShown=isCarpetFloor355(state.tool)?state.tool:CARPET_FLOORS_355[0];
 const tools=toolDefinitions.filter(tool=>tool.category===category&&architectToolAvailable(world,tool.id)&&(!isCarpetFloor355(tool.id)||tool.id===carpetShown));
 if(category==='production')tools.sort((a,b)=>{const ai=productionToolOrder.indexOf(a.id),bi=productionToolOrder.indexOf(b.id);return (ai<0?productionToolOrder.length:ai)-(bi<0?productionToolOrder.length:bi);});
 const selected=tools.find(tool=>tool.id===state.tool),materials=selected?constructionMaterials(selected.id):[];
 const rows:NativeRow[]=[
  {id:'architect-categories',label:'',region:'navigation',controlStyle:'navigation',controls:categories.filter(([id])=>architectCategoryAvailable(world,id)).map(([id,label])=>button(`category-${id}`,label,()=>{actions.category(id);redraw();},{icon:id,hint:`${label}\nAfficher les constructions de cette catégorie.`,active:id===category}))},
  {id:'architect-tools',label:'',region:'catalogue',controlStyle:'tile',controls:tools.map(tool=>nativeToolControl(tool,state,actions))},
 ];
 if(selected){
  const entity=constructionToolObject(selected.id,state.constructionMaterial),material=entity.material;
  rows.push({...row('architect-selected',constructionThingLabel(selected.title,entity),undefined,selected.hint),region:'details',emphasis:'heading'});
  for(const line of constructionMaterialLines(entity,world,undefined,true).sort((a,b)=>b.required-a.required))rows.push({...row(`architect-cost-${line.item}`,line.label,String(line.required)),region:'details',compact:true});
  if(materials.length>1&&material)rows.push({...row('architect-material','Matériau',undefined,undefined,[button(`tool-${selected.id}-material`,constructionMaterialLabel(material),()=>{}, {hint:'Matériau de la construction sélectionnée',select:{value:material,options:materials.map(material=>({value:material,label:constructionMaterialLabel(material)})),onChange:value=>{const material=materials.find(item=>item===value);if(material)actions.material(material);}}})]),region:'details',compact:true});
  if(isCarpetFloor355(selected.id))rows.push({...row('architect-carpet-color','Couleur',undefined,undefined,[button(`tool-${selected.id}-color`,carpetColor355(selected.id).label,()=>{},{hint:'Couleur du tapis : les 63 teintes du jeu de base',select:{value:selected.id,options:CARPET_FLOORS_355.map(id=>({value:id,label:carpetColor355(id).label})),onChange:value=>{if(isCarpetFloor355(value))actions.tool(value);}}})]),region:'details',compact:true});
  if(selected.id==='ship-computer'||selected.id==='ship-sensors')rows.push({...row('architect-rotation','Orientation','Fixe','Édifice 2 × 2 fixe, sans rotation.'),region:'details',compact:true});
  else rows.push({...row('architect-rotation','Orientation',`${state.orientation*90}°`,'Q / E tourne les constructions orientables.',[button('rotate-left','↶',()=>actions.rotate(-1),{hint:'Tourner à gauche · Q'}),button('rotate-right','↷',()=>actions.rotate(1),{hint:'Tourner à droite · E'})]),region:'details',compact:true});
 }else rows.push({...row('architect-instruction','Choisir une construction',undefined,'Choisissez une carte du catalogue, puis désignez son emplacement sur le terrain. Q / E tourne les constructions orientables.'),region:'details'});
 const pending=world.jobs.filter(job=>job.status==='pending').length;
 rows.push({...row('architect-job-count',world.jobs.length?`${world.jobs.length} ordre(s) · ${pending} en attente`:'Aucun ordre en cours'),region:'details',emphasis:'muted'});
 return {id:'architect',title:'Architecte',layout:'architect',width:1420,height:900,rows,onClose:()=>void actions.panel(null)};
}
const passionLabels=['Sans passion','Passion','Passion brûlante'] as const;
function workSkill(pawn:Pawn,work:WorkType):{caption?:string;hint?:string} {
 const zero={level:0,xp:0,dailyXp:0,passion:0 as const};
 const skill=work==='mine'?miningSkill(pawn):work==='grow'||work==='gather'?plantSkill(pawn):work==='cook'?cookingSkill(pawn):work==='art'?artisticSkill(pawn):work==='handle'?pawn.skills.animals??zero:work==='warden'?pawn.skills.social??zero:work==='doctor'?pawn.skills.medicine:work==='build'?pawn.skills.construction:work==='hunt'?pawn.skills.shooting??zero:work==='craft'||work==='smith'||work==='tailor'?pawn.skills.crafting??zero:work==='research'?pawn.skills.intellectual??zero:undefined;
 if(!skill)return {};
 const label=work==='mine'?'Minage':work==='grow'||work==='gather'?'Plantes':work==='cook'?'Cuisine':work==='art'?'Artistique':work==='handle'?'Animaux':work==='warden'?'Social':work==='doctor'?'Médecine':work==='hunt'?'Tir':work==='craft'||work==='smith'||work==='tailor'?'Artisanat':work==='research'?'Intellectuel':'Construction';
 const stats=work==='mine'?`vitesse ${Math.round(miningWorkSpeed(pawn)*100)} % avant lumière · rendement minéral ${Math.round(miningYield(pawn)*100)} % ; moyenne pondérée par les dégâts des coups sur le gisement`:work==='grow'||work==='gather'?`vitesse ${Math.round(plantWorkSpeed(pawn)*100)} % avant lumière · semis, récolte et abattage`:work==='cook'?`cuisson ${Math.round(cookingSpeed(pawn)*100)} % · rendement de boucherie ${Math.round(butcheryEfficiency(pawn)*100)} % avant poste`:work==='art'?'qualité des sculptures, sans effet direct sur la vitesse':work==='handle'?'Apprivoisement et entretien des lièvres · niveau Animaux 8 requis':work==='warden'?'nourrit les prisonniers et mène les conversations selon le mode choisi':work==='build'?`vitesse ${Math.round(constructionSpeed(pawn)*100)} % · apprentissage ${Math.round(learningFactor(skill,pawn)*100)} %`:`apprentissage ${Math.round(learningFactor(skill,pawn)*100)} %`;
 return {caption:`${skill.level}${' ♨'.repeat(skill.passion)}`,hint:`${label} ${skill.level}/20 · ${passionLabels[skill.passion]} · ${stats}`};
}
type ColonistTableKind='work'|'schedule'|'assign';
const colonistTableSearches:Record<ColonistTableKind,string>={work:'',schedule:'',assign:''};
let colonistTableIdentity='';
const colonistSearchText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
function colonistTableKey(state:NativeUiState):string {
 const world=state.world;return world?`${state.epoch??''}:${registeredMapId(world)??''}:${world.seed}:${world.width}:${world.height}`:'none';
}
function colonistTableSearch(kind:ColonistTableKind):string {
 const key=colonistTableKey(latest!);if(key!==colonistTableIdentity){for(const id of ['work','schedule','assign'] as const)colonistTableSearches[id]='';scheduleClipboard=undefined;workSort=undefined;colonistTableIdentity=key;}
 return colonistTableSearches[kind];
}
/** Local view callbacks never reuse the owner or scope captured by an older map. */
function colonistTableGuard<T extends unknown[]>(action:(...args:T)=>void|Promise<unknown>):(...args:T)=>void|Promise<unknown> {
 const key=colonistTableKey(latest!),revision=panelSessionRevision;
 return (...args)=>{if(revision!==panelSessionRevision)return;const current=host?.readState?.()??latest;if(!current||colonistTableKey(current)!==key)throw Error('Ce tableau appartient à une autre carte.');if(current.busy)throw Error('Attendez la fin de l’opération courante.');latest=current;return action(...args);};
}
function colonistTableControl(id:string,label:string,onActivate:NativeControl['onActivate'],extra:Partial<NativeControl>={}):NativeControl {
 const control=button(id,label,onActivate,extra);
 return {...control,onActivate:colonistTableGuard(control.onActivate),
  ...(control.select?{select:{...control.select,onChange:colonistTableGuard(control.select.onChange)}}:{}),
  ...(control.paint?{paint:{...control.paint,onPaint:colonistTableGuard(control.paint.onPaint)}}:{}),
  ...(control.onSecondary?{onSecondary:colonistTableGuard(control.onSecondary)}:{})};
}
function colonistTableRows(kind:ColonistTableKind,world:World):{all:Pawn[];shown:Pawn[];search:string} {
 const search=colonistTableSearch(kind),needle=colonistSearchText(search.trim());
 const all=world.pawns.filter(p=>isColonist(p)&&(kind==='schedule'||!p.prisoner));
 return {all,search,shown:needle?all.filter(p=>colonistSearchText(`${p.name} ${p.id}`).includes(needle)):all};
}
function colonistTableToolbar(kind:ColonistTableKind,search:string,shown:number,total:number):NativeRow {
 return {id:`${kind}-search`,label:`Rechercher · ${shown}/${total}`,region:'navigation',hint:'Recherche locale par nom ou identifiant. Aucune affectation n’est modifiée.',input:{value:search,placeholder:'Nom ou identifiant…',maxLength:80,onCommit:colonistTableGuard((value:string)=>{colonistTableSearches[kind]=value;back();})}};
}
function colonistTablePawn(id:number,kind:ColonistTableKind):Pawn {
 const pawn=currentPawn(id);if(!isColonist(pawn)||(kind!=='schedule'&&pawn.prisoner))throw Error('Cette personne n’est plus dans ce tableau.');return pawn;
}
/** Table order only (Core PawnTable sorting is not saved); reset with the map. */
let workSort:WorkSort344|undefined;
/** WidgetsWork.DrawWorkBoxBackground: Awful → Bad below 4, Bad → Mid up to
 * 14, Mid → Excellent up to 20, by the relevant skill average. */
const WORK_BOX:readonly (readonly [number,readonly [number,number,number]])[]=[[0,[201,147,124]],[4,[211,185,143]],[14,[183,192,143]],[20,[144,181,124]]];
function workBoxColor(average:number):string {
 const value=Math.max(0,Math.min(20,average));let i=0;while(i<WORK_BOX.length-2&&value>WORK_BOX[i+1]![0])i++;
 const [a,from]=WORK_BOX[i]!,[b,to]=WORK_BOX[i+1]!,t=(value-a)/(b-a);
 return '#'+from.map((c,k)=>Math.round(c+(to[k]!-c)*t).toString(16).padStart(2,'0')).join('');
}
const decimal=(value:number)=>value.toLocaleString('fr-FR',{maximumFractionDigits:1});
function workCell(pawn:Pawn,work:WorkType,label:string,simple:boolean):NativeControl {
 const refusal=backgroundWorkRefusal(pawn,work),stored=storedPriority(pawn,work),shown=refusal?0:shownWorkPriority344(pawn,work,simple),skill=workSkill(pawn,work);
 const skills=relevantSkills344(work),average=relevantSkillAverage344(pawn,work),warning=!refusal&&veryBadSkill344(pawn,work,shown);
 // The click reads the CURRENT pawn and mode: a retained cell never replays an old value.
 const click=(button:WorkClick344)=>()=>{const current=colonistTablePawn(pawn.id,'work'),mode=simpleWorkTab344(currentWorld());return send({type:'priority',pawnId:current.id,work,value:nextCellPriority344(shownWorkPriority344(current,work,mode),mode,button)});};
 const state=refusal?'impossible':simple?shown>0?'activé':'désactivé':shown===0?'désactivé':`priorité ${shown}${shown===1?' (faite en premier)':shown===4?' (la plus basse)':''}`;
 const hint=[`${label} · ${pawn.name} : ${state}`,
  refusal?`${pawn.name} ne peut pas faire ce travail. ${refusal} Priorité enregistrée : ${stored}. Un ordre direct ne permet pas de contourner cette incapacité.`:undefined,
  !refusal&&skills.length?`Compétences utiles : ${skills.map(id=>BACKGROUND_SKILL_LABELS[id]).join(', ')} · moyenne ${decimal(average)}/20`:undefined,
  warning?'Compétence très faible pour ce travail.':undefined,
  refusal?undefined:skill.hint,
  refusal?undefined:simple?'Clic : cocher ou décocher.':'Clic gauche : priorité plus haute (vide → 4 → 1 → vide) · clic droit : plus basse.'].filter(Boolean).join('\n');
 const passion=relevantPassion344(pawn,work);
 return colonistTableControl(`work-${pawn.id}-${work}`,refusal?'':simple?shown>0?'Activé':'':shown>0?String(shown):'',click('primary'),{
  ...(passion?{passion:passion>=2?2 as const:1 as const}:{}),hint,disabled:!!refusal||pawn.state==='dead',
  color:refusal?undefined:workBoxColor(average),...(simple&&shown>0?{mark:'check' as const}:{}),onSecondary:click('secondary')});
}
function workHeader(work:WorkType,label:string,full:string,simple:boolean):{label:string;hint:string;control:NativeControl} {
 const sorted=workSort?.work===work?workSort.descending?' ↑':' ↓':'';
 const act=(button:WorkClick344)=>(gesture?:NativeGesture)=>{
  if(gesture?.shift){const ids=sortWorkRows344(colonistTableRows('work',currentWorld()).shown,workSort).map(p=>p.id);return ids.length?send({type:'priority-column',work,pawnIds:ids,click:button}):undefined;}
  workSort=nextWorkSort344(workSort,work,button);back();
 };
 const hint=[full,
  workSort?.work===work?(workSort.descending?'Trié : compétence croissante de haut en bas.':'Trié : compétence décroissante de haut en bas.'):undefined,
  'Clic : trier par compétence moyenne (clic suivant : sens inverse, puis ordre normal ; clic droit : sens opposé).',
  simple?'Maj + clic gauche : cocher toute la colonne · Maj + clic droit : tout décocher.':'Maj + clic gauche : toute la colonne un cran plus haut · Maj + clic droit : un cran plus bas.'].filter(Boolean).join('\n');
 return {label:label+sorted,hint:full,control:colonistTableControl(`work-column-${work}`,full,act('primary'),{hint,onSecondary:act('secondary')})};
}
/** Core Work tab copy/paste column (PawnColumnWorker_CopyPasteWorkPriorities): the copy stays in the interface. */
const workClipboardHeaders=[{label:'Copier',hint:'Copier les priorités de travail d’un colon'},{label:'Coller',hint:'Coller les priorités copiées ; un travail impossible pour ce colon garde sa valeur'}];
function workClipboardCells(pawn:Pawn):NativeControl[] {
 const works=workColumns.map(c=>c.id),dead=pawn.state==='dead';
 return [colonistTableControl(`work-copy-${pawn.id}`,'Copier',()=>{copyWorkPriorities(colonistTablePawn(pawn.id,'work'),works,simpleWorkTab344(currentWorld()));redraw();},{disabled:dead,hint:`Copier les priorités de travail de ${pawn.name}. Un travail qu’il ne peut pas faire est copié désactivé.`}),
  colonistTableControl(`work-paste-${pawn.id}`,'Coller',()=>{const current=colonistTablePawn(pawn.id,'work');if(!hasWorkPriorityClipboard())return;return pasteWorkPriorities(send,current.id,workPriorityPastePlan(currentWorld(),current,works));},{disabled:dead||!hasWorkPriorityClipboard(),hint:`Coller les priorités copiées chez ${pawn.name}. Un travail qu’il ne peut pas faire garde sa valeur.`})];
}
function workPanel(world:World):NativePage {
 const {all,shown,search}=colonistTableRows('work',world),simple=simpleWorkTab344(world),pawns=sortWorkRows344(shown,workSort);
 const manualToggle=colonistTableControl('work-manual-priorities','Priorités manuelles',()=>send({type:'work-tab-mode',manual:simpleWorkTab344(currentWorld())}),{active:!simple,
  hint:simple?'Désactivé : chaque travail est simplement coché ou non, tous au même rang (priorité 3).\nCliquer pour régler des priorités de 1 à 4 ; celles déjà réglées reviennent.':'Activé : priorités 1 à 4, la priorité 1 est faite en premier.\nCliquer pour revenir aux cases à cocher ; les priorités réglées sont conservées.'});
 return {id:'work',title:'Travail',layout:'table',tableProfile:'colonists',contentKey:`work:${colonistTableKey(latest!)}:${search}`,
  subtitle:simple?'Cases à cocher : un travail coché est fait, dans l’ordre naturel des travaux. Le transport livre aussi les chantiers.':'Priorités manuelles : 1 est fait en premier, 4 en dernier, vide désactivé. Le transport livre aussi les chantiers.',
  width:1480,rows:[
  {id:'work-headings',label:'Colon',value:'Activité',compact:true,columns:[...workClipboardHeaders,...workColumns.map(c=>workHeader(c.id,WORK_COLUMN_LABEL[c.id]??c.label,c.label,simple))]},
  ...(isSchema344OrLater(world.schemaVersion)?[{id:'work-manual-row',label:'',region:'navigation' as const,controlStyle:'button' as const,controls:[manualToggle]}]:[]),
  colonistTableToolbar('work',search,pawns.length,all.length),
  ...pawns.map(pawn=>({...row(`worker-${pawn.id}`,pawn.name,host?.pawnActivity?.(pawn.id)??queryPawnStatus(world,pawn).reason,pawn.traits?.map(id=>traitLabel(id,appearanceOf(pawn,world.seed).sex)).join(' · ')??'Aucun trait attribué',[...workClipboardCells(pawn),...workColumns.map(({id,label})=>workCell(pawn,id,label,simple))]),compact:true})),
 ],onClose:()=>void host?.panel(null)};
}
const assignmentColors:Record<ScheduleAssignment,string>={anything:'#e9d2a9',work:'#dfb7a4',sleep:'#c2d5e0',recreation:'#c9dfc1'};
function schedulePanel(world:World):NativePage {
 const hour=hourOfDay(calendarTick(world)),{all,shown:pawns,search}=colonistTableRows('schedule',world);
 const rows:NativeRow[]=[{id:'schedule-headings',label:'Colon',compact:true,columns:[{label:'Copier'},{label:'Coller'},...Array.from({length:24},(_,h)=>({label:String(h),hint:`${h} h – ${h+1} h${h===hour?' · heure actuelle':''}`}))]},
  colonistTableToolbar('schedule',search,pawns.length,all.length),
  {id:'schedule-brush',label:'',region:'navigation',controlStyle:'button',hint:'Choisir une activité puis cliquer ou glisser sur les heures. La plage indique une priorité, pas un ordre instantané.',controls:(Object.keys(assignmentLabels) as ScheduleAssignment[]).map(id=>colonistTableControl(`brush-${id}`,assignmentLabels[id],()=>{scheduleBrush=id;redraw();},{color:assignmentColors[id],active:scheduleBrush===id}))},
 ];
 for(const pawn of pawns){
  rows.push({...row(`schedule-${pawn.id}`,pawn.name,undefined,undefined,((c:NativeControl[])=>[...c.slice(24),...c.slice(0,24)])([...Array.from({length:24},(_,h)=>{
   const assignment=pawn.schedule[h]??'anything';
   return colonistTableControl(`hour-${pawn.id}-${h}`,assignmentSymbols[assignment],()=>{const current=colonistTablePawn(pawn.id,'schedule');return send({type:'schedule-paint',pawnId:current.id,hours:[h],assignment:scheduleBrush});},{hint:`${pawn.name} · ${h} h – ${h+1} h : ${assignmentLabels[assignment]}`,color:assignmentColors[assignment],active:h===hour,disabled:pawn.state==='dead',paint:{group:`schedule-${pawn.id}`,index:h,onPaint:indices=>{const hours=[...new Set(indices)].filter(value=>Number.isInteger(value)&&value>=0&&value<24);if(hours.length){const current=colonistTablePawn(pawn.id,'schedule');return send({type:'schedule-paint',pawnId:current.id,hours,assignment:scheduleBrush});}}}});
  }),colonistTableControl(`copy-${pawn.id}`,'Copier',()=>{scheduleClipboard=[...colonistTablePawn(pawn.id,'schedule').schedule];redraw();},{hint:`Copier les 24 heures de ${pawn.name}`}),colonistTableControl(`paste-${pawn.id}`,'Coller',()=>{const current=colonistTablePawn(pawn.id,'schedule');if(!scheduleClipboard)return;return send({type:'schedule-replace',pawnId:current.id,assignments:[...scheduleClipboard]});},{disabled:!scheduleClipboard||pawn.state==='dead',hint:`Coller les 24 heures chez ${pawn.name}`})])),compact:true});
 }
 const help=()=>open(detailPage('schedule-help','Planning · repères',[
  row('schedule-instructions','Peindre les horaires',undefined,'Choisir une activité puis cliquer ou glisser sur les heures. Tab parcourt les cases, Entrée ou Espace peint ; Échap annule le tracé.'),
  row('schedule-priorities','Les plages sont des priorités',undefined,'Temps libre : le colon gère ses besoins et son travail. Dormir exige un couchage accessible ; travailler permet toujours de manger. Loisir favorise les activités accessibles sous 95 % de satisfaction ; temps libre sous 35 %. Répéter la même famille crée de la lassitude.'),
  row('schedule-profile',world.restRules==='legacy'?'Sauvegarde historique : ancienne vitesse de fatigue conservée. Les horaires sont modifiables.':'Profil adulte : repos nocturne de 22 h à 6 h par défaut. Le sommeil peut continuer en plage libre jusqu’à récupération complète.'),
 ]));
 return {id:'schedule',title:'Planning',layout:'table',tableProfile:'colonists',contentKey:`schedule:${colonistTableKey(latest!)}:${search}`,rows,width:1480,actions:[colonistTableControl('schedule-help-open','Aide du planning',help)],onClose:()=>void host?.panel(null)};
}
function animalArea(id:number):void {
 const world=currentWorld(),animal=currentAnimal(id),current=currentAnimalAreaChoice287(world,animal);
 const choices:{id:string;label:string;choice:AnimalAreaChoice287|null}[]=[{id:'unrestricted',label:'Sans restriction',choice:null},{id:'home',label:'Zone de foyer',choice:{kind:'home'}},...(world.allowedAreas??[]).map(area=>({id:`area-${area.id}`,label:area.label,choice:{kind:'allowed' as const,areaId:area.id}}))];
 choose(`animal-area-${id}`,'Zone autorisée',choices.map(choice=>({id:choice.id,label:choice.label,active:JSON.stringify(current)===JSON.stringify(choice.choice),choose:()=>send({type:'animal-area-assign',animalId:id,choice:choice.choice})})));
}
function animalDetails(id:number):void {openLive(()=>animalDetailsPage(id));}
function animalDetailsPage(id:number):NativePage|null {
 const world=currentWorld(),animal=world.wildlife?.animals.find(animal=>animal.id===id);if(!animal)return null;
 const species=animalSpecies(animal.species),name=actualAnimalName256(animal)??`${species.label} ${animal.id}`;
 const rows:NativeRow[]=[row('animal-state','État',animalActivity(world,animal)),row('animal-age','Âge',`${(animal.ageTicks/(TICKS_PER_DAY*60)).toLocaleString('fr-FR',{maximumFractionDigits:2})} an · ${stageLabels[animalLifeStage(animal)]}`),row('animal-food','Nourriture',`${Math.round(100*animal.food/animalNutritionMax(animal))} %`),row('animal-mobility','Mobilité',`${Math.round(100*animalBody(animal).capacities.moving)} %`),row('animal-position','Position',`${animal.x}, ${animal.z}`)];
 if(animal.pregnancy)rows.push(row('animal-pregnancy','Gestation',`${Math.round(100*animal.pregnancy.progress/gestationTicks(animal.species))} %`));
 if(animal.domestic){
  rows.push(row('animal-care','Soins',MEDICAL_CARE[animal.domestic.care],undefined,[button('animal-care-choose','Choisir',()=>choose(`animal-care-${id}`,'Politique médicale',(Object.keys(MEDICAL_CARE) as MedicalCare[]).map(care=>({id:care,label:MEDICAL_CARE[care],active:currentAnimal(id).domestic?.care===care,choose:()=>send({type:'animal-care-policy',animalId:id,care})}))))]));
  if(world.schemaVersion>=287&&supportsAnimalAreas287(animal.species))rows.push(row('animal-area','Zone autorisée',animalAreaLabel(world,animal),undefined,[button('animal-area-edit','Choisir',()=>animalArea(id))]));
  if(world.schemaVersion>=282)for(const skill of ['obedience','haul'] as const){const training=readAnimalTraining282(animal,skill),refusal=trainingRefusal282(world,animal,skill);rows.push(row(`training-${skill}`,skill==='haul'?'Transport':'Obéissance',`${training.steps}/${training.maxSteps}${training.learned?' · acquis':''}`,refusal??'Les leçons exigent un dresseur, la nourriture et les prérequis physiques.',[button(`training-${skill}-toggle`,training.wanted?'Demandé':'Demander',()=>send({type:'animal-training',animalId:id,skill,wanted:!readAnimalTraining282(currentAnimal(id),skill).wanted}),{active:training.wanted,disabled:!!refusal})]));}
 }
 return detailPage(`animal-${id}`,name,rows,[button('animal-locate','Repérer',()=>host?.selectPawn(id))]);
}
function animalAreaLabel(world:World,animal:NonNullable<World['wildlife']>['animals'][number]):string {
 if(world.schemaVersion<287||!supportsAnimalAreas287(animal.species))return animalPenStatus(world,animal)??'Libre';
 const choice=currentAnimalAreaChoice287(world,animal);return choice===null?'Sans restriction':choice.kind==='home'?'Zone de foyer':world.allowedAreas?.find(a=>a.id===choice.areaId)?.label??'Zone indisponible';
}
function quotaEditor(species:AutoSlaughterSpecies):void {
 let draft={...(currentWorld().autoSlaughter?.find(c=>c.species===species)??defaultAutoSlaughterConfig(species))};
 const fields:readonly [keyof Pick<AutoSlaughterConfig,'maxTotal'|'maxMales'|'maxMalesYoung'|'maxFemales'|'maxFemalesYoung'>,string][]=[['maxTotal','Total'],['maxMales','Mâles adultes'],['maxMalesYoung','Jeunes mâles'],['maxFemales','Femelles adultes'],['maxFemalesYoung','Jeunes femelles']];
 const make=():NativePage=>detailPage(`quota-${species}`,`${animalSpecies(species).label} · abattage automatique`,[
  row('quota-help','Limites',undefined,'−1 signifie sans limite. Les plus âgés excédentaires sont désignés ; le travail reste physique. Les désignations manuelles sont indépendantes.'),
  ...fields.map(([key,label]):NativeRow=>({id:`quota-${key}`,label,input:{value:String(draft[key]),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n< -1)throw Error('Limite entière supérieure ou égale à −1 requise.');draft={...draft,[key]:n};}}})),
  row('quota-pregnant','Inclure les femelles gestantes',draft.allowPregnant?'Oui':'Non',undefined,[button('quota-pregnant-toggle',draft.allowPregnant?'Oui':'Non',()=>{draft={...draft,allowPregnant:!draft.allowPregnant};open(make());},{active:draft.allowPregnant})]),
 ],[button('quota-apply','Appliquer',async()=>{await send({type:'auto-slaughter-policy',config:{...draft}});back();})]);open(make());
}
type AnimalTableKind='animals'|'wildlife';
type TableAnimal=NonNullable<World['wildlife']>['animals'][number];
type AnimalTableView={search:string;filter:string;sort:string;descending:boolean};
const animalTableViews:Record<AnimalTableKind,AnimalTableView>={animals:{search:'',filter:'all',sort:'name',descending:false},wildlife:{search:'',filter:'all',sort:'name',descending:false}};
let animalTableIdentity='';
const animalSearchText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
const animalCareTableLabels:Record<MedicalCare,string>={none:'Aucun soin',dry:'Sans médicament',herbal:'Plantes ou moins',industrial:'Indust. ou moins',best:'Meilleurs'};
const animalTableAgeFormat=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2});
const animalTableCollator=new Intl.Collator('fr',{numeric:true,sensitivity:'base'});
function animalTableKey(state:NativeUiState):string {
 const world=state.world;return world?`${state.epoch??''}:${registeredMapId(world)??''}:${world.seed}:${world.width}:${world.height}`:'none';
}
function animalTableView(kind:AnimalTableKind):AnimalTableView {
 const key=animalTableKey(latest!);
 if(key!==animalTableIdentity){for(const view of Object.values(animalTableViews))Object.assign(view,{search:'',filter:'all',sort:'name',descending:false});animalTableIdentity=key;}
 return animalTableViews[kind];
}
/** Every retained callback re-reads the real scope before exposing or ordering an actor. */
function animalTableGuard<T extends unknown[]>(action:(...args:T)=>void|Promise<unknown>):(...args:T)=>void|Promise<unknown> {
 const key=animalTableKey(latest!),revision=panelSessionRevision;
 return (...args)=>{if(revision!==panelSessionRevision)return;const current=host?.readState?.()??latest;if(!current||animalTableKey(current)!==key||current.busy)return;latest=current;return action(...args);};
}
function tableAnimal(kind:AnimalTableKind,id:number):TableAnimal {
 const world=currentWorld(),animal=currentAnimal(id);
 if(kind==='animals'?(!animal.domestic||animal.state==='dead'):(!!animal.domestic||!knownPosition256(world,animal)))throw Error('Cet animal n’est plus disponible dans cette liste.');
 return animal;
}
function animalTableButton(id:string,label:string,activate:()=>void|Promise<unknown>,extra:Partial<NativeControl>={}):NativeControl {
 return button(id,label,extra.disabled?()=>{}:animalTableGuard(activate),extra);
}
function animalFact(id:string,label:string,hint=label):NativeControl{return button(id,label,()=>{},{disabled:true,hint});}
function animalTableToolbar(kind:AnimalTableKind,world:World,total:number,shown:number):NativeRow[] {
 const view=animalTableView(kind),refresh=()=>back();
 const filters=kind==='animals'?[['all','Tous'],['female','Femelles'],['male','Mâles'],['young','Jeunes'],['slaughter','Abattage demandé'],['haul','Transport demandé'],['ready','Produit prêt']]:[['all','Tous'],['female','Femelles'],['male','Mâles'],['hunt','Chasse désignée'],['tame','Apprivoisement demandé']];
 const sorts=[['name','Nom'],['species','Espèce'],['age','Âge'],['sex','Sexe'],['activity','Activité'],...(kind==='animals'?[['area','Zone / enclos'],['product','Produit']]:[['position','Position'],...(isManhunterRevengeSchema348(world.schemaVersion)?[['harm-rage','Rage si blessé'],['tame-rage','Rage si raté']]:[])])];
 const select=(suffix:string,label:string,value:string,choices:string[][],write:(value:string)=>void):NativeControl=>animalTableButton(`${kind}-${suffix}`,`${label} : ${choices.find(([key])=>key===value)?.[1]??value}`,()=>{}, {select:{value,options:choices.map(([value,label])=>({value:value!,label:label!})),onChange:animalTableGuard((value:string)=>{if(!choices.some(([key])=>key===value))return;write(value);refresh();})}});
 return [
  {id:`${kind}-search`,label:'Rechercher',region:'navigation',compact:true,presentation:'plain',input:{value:view.search,placeholder:'Nom, espèce ou activité…',maxLength:160,onCommit:animalTableGuard((value:string)=>{view.search=value;refresh();})}},
  {id:`${kind}-filters`,label:'',region:'navigation',compact:true,presentation:'plain',controls:[select('filter','Filtrer',view.filter,filters,value=>{view.filter=value;}),select('sort','Trier',view.sort,sorts,value=>{view.sort=value;}),animalTableButton(`${kind}-direction`,view.descending?'Décroissant':'Croissant',()=>{view.descending=!view.descending;refresh();},{hint:'Inverser le tri de la liste'})]},
 ];
}
function filteredTableAnimals(kind:AnimalTableKind,world:World,animals:TableAnimal[],targets?:ReturnType<typeof autoSlaughterTargets>):TableAnimal[] {
 const view=animalTableView(kind),needle=animalSearchText(view.search.trim());
 const activities=new Map<TableAnimal,string>();
 const activity=(animal:TableAnimal)=>{let value=activities.get(animal);if(value===undefined){value=animalActivity(world,animal,kind==='animals'?targets:undefined);activities.set(animal,value);}return value;};
 const name=(animal:TableAnimal)=>actualAnimalName256(animal)??`${animalSpecies(animal.species).label} ${animal.id}`;
 const filtered=animals.filter(animal=>{
  const filter=view.filter,match=filter==='all'||filter==='female'&&animal.sex==='female'||filter==='male'&&animal.sex==='male'||filter==='young'&&animalLifeStage(animal)!=='adult'||filter==='slaughter'&&!!animal.domestic?.slaughter||filter==='haul'&&readAnimalTraining282(animal,'haul').wanted||filter==='ready'&&!!productKind(animal)&&productFullness(animal)>=1||filter==='hunt'&&!!world.hunting?.targets.includes(animal.id)||filter==='tame'&&!!animal.taming?.designated;
  return match&&(!needle||animalSearchText([name(animal),animalSpecies(animal.species).label,animal.sex==='female'?'Femelle':'Mâle',activity(animal),kind==='animals'?animalAreaLabel(world,animal):'',animal.id].join(' ')).includes(needle));
 });
 const textKeys=new Map<TableAnimal,string>();
 const text=(animal:TableAnimal)=>{let value=textKeys.get(animal);if(value===undefined){value=view.sort==='species'?animalSpecies(animal.species).label:view.sort==='sex'?animal.sex:view.sort==='activity'?activity(animal):view.sort==='area'?animalAreaLabel(world,animal):name(animal);textKeys.set(animal,value);}return value;};
 return filtered.sort((a,b)=>{const compared=view.sort==='age'?a.ageTicks-b.ageTicks:view.sort==='product'?productFullness(a)-productFullness(b):view.sort==='position'?a.z-b.z||a.x-b.x:view.sort==='harm-rage'?manhunterOnDamageChance348(world,a)-manhunterOnDamageChance348(world,b):view.sort==='tame-rage'?manhunterOnTameFailChance348(a)-manhunterOnTameFailChance348(b):animalTableCollator.compare(text(a),text(b));return (view.descending?-compared:compared)||a.id-b.id;});
}
function animalQuotaOverview():void {openLive(animalQuotaOverviewPage);}
function animalQuotaOverviewPage():NativePage {
 const world=currentWorld(),rows:NativeRow[]=[{id:'quotas-headings',label:'Espèce',value:'Total',compact:true,columns:['Adultes ♂','Adultes ♀','Jeunes ♂','Jeunes ♀','Gestantes','Limite','Modifier'].map(label=>({label}))}];
 for(const species of AUTO_SLAUGHTER_SPECIES){const counts=autoSlaughterCounts(world,species),config=world.autoSlaughter?.find(row=>row.species===species)??defaultAutoSlaughterConfig(species);
  rows.push({id:`quota-${species}`,label:animalSpecies(species).label,value:String(counts.total),compact:true,presentation:'plain',controls:[...[[counts.males,'males'],[counts.females,'females'],[counts.malesYoung,'males-young'],[counts.femalesYoung,'females-young'],[counts.pregnant,'pregnant'],[config.maxTotal<0?'∞':config.maxTotal,'limit']].map(([value,suffix])=>animalFact(`quota-${species}-${suffix}`,String(value))),animalTableButton(`quota-${species}-edit`,'Quotas',()=>quotaEditor(species))]});
 }
 const page=detailPage('animals-quotas','Abattage automatique',rows);page.layout='table';page.width=1140;return page;
}
function animalsPanel(world:World):NativePage {
 const all=world.wildlife?.animals.filter(animal=>!!animal.domestic&&animal.state!=='dead')??[],targets=autoSlaughterTargets(world),animals=filteredTableAnimals('animals',world,all,targets);
 const rows:NativeRow[]=[...animalTableToolbar('animals',world,all.length,animals.length),{id:'animals-headings',label:'Animal',value:'Activité · gestation',region:'catalogue',compact:true,columns:['Sexe','Âge','Maturité','Soins','Zone / enclos','Produit','Transport','Abattre','Repérer','Dossier'].map(label=>({label}))}];
 for(const animal of animals){
  const id=animal.id,identity=actualAnimalName256(animal)??`${animalSpecies(animal.species).label} ${id}`,product=productKind(animal),training=readAnimalTraining282(animal,'haul'),refusal=slaughterRefusal(world,animal),trainingRefusal=trainingRefusal282(world,animal,'haul');
  const areaValue=animalAreaLabel(world,animal),area=areaValue==='Aucun enclos attribué'?'Sans enclos':areaValue,productLabel=product?`${product==='milk'?'Lait':'Laine'} ${Math.round(100*Math.max(0,Math.min(1,productFullness(animal))))} %`:'—';
  const areaControl=world.schemaVersion>=287&&supportsAnimalAreas287(animal.species)?animalTableButton(`animal-${id}-area`,area,()=>{tableAnimal('animals',id);animalArea(id);},{hint:`Zone autorisée de ${identity} · ${areaValue}`}):animalFact(`animal-${id}-area`,area,areaValue);
  const transport=world.schemaVersion>=282?animalTableButton(`animal-${id}-haul`,`${training.steps}/${training.maxSteps}${training.wanted?' Oui':''}`,()=>{const current=tableAnimal('animals',id);return send({type:'animal-training',animalId:id,skill:'haul',wanted:!readAnimalTraining282(current,'haul').wanted});},{active:training.wanted,disabled:!!trainingRefusal,hint:trainingRefusal??`Entraîner ${identity} au transport · ${training.steps}/${training.maxSteps}`}):animalFact(`animal-${id}-haul-unavailable`,'—');
  const careControl=animalTableButton(`animal-${id}-care`,animalCareTableLabels[animal.domestic!.care],()=>{}, {hint:`Soins de ${identity} · ${MEDICAL_CARE[animal.domestic!.care]}`,select:{value:animal.domestic!.care,options:(Object.keys(MEDICAL_CARE) as MedicalCare[]).map(care=>({value:care,label:MEDICAL_CARE[care]})),onChange:animalTableGuard((value:string)=>{
   const care=(Object.keys(MEDICAL_CARE) as MedicalCare[]).find(care=>care===value);if(!care)return;
   tableAnimal('animals',id);return send({type:'animal-care-policy',animalId:id,care});
  })}});
  const controls=[animalFact(`animal-${id}-sex`,animal.sex==='female'?'F':'M',animal.sex==='female'?'Femelle':'Mâle'),animalFact(`animal-${id}-age`,`${animalTableAgeFormat.format(animal.ageTicks/(TICKS_PER_DAY*60))} an`),animalFact(`animal-${id}-stage`,stageLabels[animalLifeStage(animal)]),careControl,areaControl,animalFact(`animal-${id}-product`,productLabel),transport,
   animalTableButton(`animal-${id}-slaughter`,animal.domestic!.slaughter?'Annuler l’abattage':'Désigner pour abattage',()=>{const current=tableAnimal('animals',id);return send({type:'slaughter',animalId:id,enabled:!current.domestic!.slaughter});},{glyph:animal.domestic!.slaughter?'allow':'forbid',active:!!animal.domestic!.slaughter,disabled:!!refusal&&!animal.domestic!.slaughter,hint:refusal??`Abattage manuel de ${identity}`}),
   animalTableButton(`animal-${id}-locate`,'Repérer',()=>{tableAnimal('animals',id);host?.selectPawn(id);}),animalTableButton(`animal-${id}-details`,'Dossier',()=>{tableAnimal('animals',id);animalDetails(id);})];
  const activity=[animalActivity(world,animal,targets),animal.pregnancy?`Gestation ${Math.round(100*animal.pregnancy.progress/gestationTicks(animal.species))} %`:''].filter(Boolean).join(' · ');
  rows.push({id:`animal-${id}`,label:identity,value:activity,region:'catalogue',compact:true,presentation:'plain',controls});
 }
 if(!animals.length)rows.push({id:'animals-empty',label:all.length?'Aucun animal ne correspond à la recherche et au filtre.':'Aucun animal domestique.',region:'catalogue',presentation:'plain'});
 return {id:'animals',title:`Animaux · ${animals.length} / ${all.length}`,layout:'table',contentKey:JSON.stringify([animalTableKey(latest!),animalTableView('animals')]),rows,width:1640,actions:world.schemaVersion>=228?[animalTableButton('animals-quotas-open','Abattage automatique',animalQuotaOverview)]:undefined,onClose:()=>void host?.panel(null)};
}
function wildlifePanel(state:NativeUiState,world:World):NativePage {
 const all=world.wildlife?.animals.filter(animal=>!animal.domestic&&knownPosition256(world,animal))??[],animals=filteredTableAnimals('wildlife',world,all);
 const rows:NativeRow[]=[...animalTableToolbar('wildlife',world,all.length,animals.length)];
 if(!world.wildlife)rows.push({...row('wildlife-enable','Partie historique',undefined,'Introduire la faune adopte le circuit existant.',[animalTableButton('enable-wildlife','Introduire la faune',()=>send({type:'enable-wildlife'}))]),region:'navigation',presentation:'plain'});
 // Schema 348: Core's ManhunterOnDamageChance and ManhunterOnTameFailChance
 // columns, beside Hunt and Tame, now that the simulation draws both chances.
 const revenge=isManhunterRevengeSchema348(world.schemaVersion);
 rows.push({id:'wildlife-headings',label:'Animal',value:'Activité',region:'catalogue',compact:true,columns:['Sexe','Position','Chasse',...(revenge?['Rage si blessé']:[]),'Apprivoiser',...(revenge?['Rage si raté']:[]),'Repérer','Tirer','Mêlée'].map(label=>({label}))});
 for(const animal of animals){
  const id=animal.id,hunted=world.hunting?.targets.includes(id)??false,drafted=state.selectedPawnIds.length>0&&state.selectedPawnIds.every(id=>world.pawns.some(pawn=>pawn.id===id&&isColonist(pawn)&&!pawn.prisoner&&pawn.draft&&pawn.state!=='dead'&&pawn.state!=='downed'));
  const combat=(type:'shoot'|'melee')=>{const current=host?.readState?.()??latest!,fresh=current.world!;tableAnimal('wildlife',id);if(!current.selectedPawnIds.length||!current.selectedPawnIds.every(id=>fresh.pawns.some(pawn=>pawn.id===id&&isColonist(pawn)&&!pawn.prisoner&&pawn.draft&&pawn.state!=='dead'&&pawn.state!=='downed')))return;return send({type,pawnIds:[...current.selectedPawnIds],targetId:id});};
  const controls=[animalFact(`wildlife-${id}-sex`,animal.sex==='female'?'Femelle':'Mâle'),animalFact(`wildlife-${id}-position`,`${animal.x}, ${animal.z}`),
   animalTableButton(`wildlife-${id}-hunt`,hunted?'Annuler la chasse':'Désigner pour chasse',()=>{tableAnimal('wildlife',id);return send({type:'hunt',animalId:id,enabled:!currentWorld().hunting?.targets.includes(id)});},{glyph:hunted?'allow':'forbid',active:hunted,disabled:animal.state==='dead'}),
   ...(revenge?[revengeFact(`wildlife-${id}-harm-rage`,manhunterOnDamageChance348(world,animal),'blessé')]:[]),
   canTameSpecies(animal.species)?animalTableButton(`wildlife-${id}-tame`,animal.taming?.designated?'Annuler l’apprivoisement':'Demander l’apprivoisement',()=>{const current=tableAnimal('wildlife',id);return send({type:'tame',animalId:id,enabled:!current.taming?.designated});},{glyph:animal.taming?.designated?'allow':'forbid',active:!!animal.taming?.designated,disabled:animal.state==='dead'}):animalFact(`wildlife-${id}-tame-unavailable`,'—'),
   ...(revenge?[revengeFact(`wildlife-${id}-tame-rage`,manhunterOnTameFailChance348(animal),'raté')]:[]),
   animalTableButton(`wildlife-${id}-focus`,'Repérer',()=>{tableAnimal('wildlife',id);host?.selectPawn(id);}),animalTableButton(`wildlife-${id}-shoot`,'Tirer',()=>combat('shoot'),{disabled:!drafted||animal.state==='dead'}),animalTableButton(`wildlife-${id}-melee`,'Mêlée',()=>combat('melee'),{disabled:!drafted||animal.state==='dead'})];
  rows.push({id:`wildlife-${id}`,label:actualAnimalName256(animal)??`${animalSpecies(animal.species).label} ${id}`,value:animalActivity(world,animal),region:'catalogue',compact:true,presentation:'plain',controls});
 }
 if(world.wildlife&&!animals.length)rows.push({id:'wildlife-empty',label:all.length?'Aucun animal ne correspond à la recherche et au filtre.':'Aucun animal sauvage connu.',region:'catalogue',presentation:'plain'});
 return {id:'wildlife',title:`Faune · ${animals.length} / ${all.length}`,subtitle:'Les ordres de combat utilisent les colons mobilisés sélectionnés.',layout:'table',contentKey:JSON.stringify([animalTableKey(latest!),animalTableView('wildlife')]),rows,width:revenge?1480:1280,onClose:()=>void host?.panel(null)};
}
/** A Core percentage cell ('—' for zero) with the rule that uses it. */
function revengeFact(id:string,chance:number,cause:'blessé'|'raté'):NativeControl {
 const label=chance>0?`${Math.round(chance*100)} %`:'—';
 return animalFact(id,label,cause==='blessé'
  ?`Chance de rage quand on le blesse : ${label} (espèce × difficulté). Elle est tirée à chaque coup reçu, triplée puis réduite par la discrétion de chasse de l’agresseur (compétences Tir et Animaux).`
  :`Chance de rage quand un apprivoisement échoue : ${label}.`);
}
type NarrativeSource=World|NonNullable<NativeUiState['campaign']>;
type QuestTab='available'|'active'|'history';
interface QuestDossier {id:string;tab:QuestTab;kind:string;rows:NativeRow[];auxiliary?:boolean}
const narrativeView={identity:'',historySearch:'',historyAll:false,historyPinnedOnly:false,
 historyTab:'messages' as 'messages'|'graph'|'stats',historySelected:undefined as string|undefined,historyShowLetters:true,historyShowMessages:true,
 questTab:undefined as QuestTab|undefined,questSelected:undefined as string|undefined,questSearch:'',questSelectionExplicit:false,tradeChoices:new Map<number,number>()};
function narrativeIdentity(state:NativeUiState):string {
 const world=state.world,campaign=state.campaign;
 return world?['local',state.epoch,registeredMapId(world),world.seed,world.width,world.height].join(':'):campaign?['campaign',state.epoch,campaign.campaignSeed,campaign.activeMapId].join(':'):'none';
}
function syncNarrativeView(state:NativeUiState):void {
 const identity=narrativeIdentity(state);if(identity===narrativeView.identity)return;
 narrativeView.identity=identity;narrativeView.historySearch='';narrativeView.historyAll=false;narrativeView.historyPinnedOnly=false;
 narrativeView.historyTab='messages';narrativeView.historySelected=undefined;narrativeView.historyShowLetters=true;narrativeView.historyShowMessages=true;
 narrativeView.questTab=undefined;narrativeView.questSelected=undefined;narrativeView.questSearch='';narrativeView.questSelectionExplicit=false;narrativeView.tradeChoices.clear();
}
/** View navigation and retained buttons borrow the current scope, never a captured World. */
function narrativeGuard<T extends unknown[]>(action:(state:NativeUiState,...args:T)=>void|Promise<unknown>):(...args:T)=>void|Promise<unknown> {
 const identity=narrativeIdentity(latest!),revision=panelSessionRevision;
 return (...args)=>{if(revision!==panelSessionRevision)return;const current=host?.readState?.()??latest;if(!current||current.busy||narrativeIdentity(current)!==identity)return;latest=current;return action(current,...args);};
}
function narrativeButton(id:string,label:string,activate:(state:NativeUiState)=>void|Promise<unknown>,extra:Partial<NativeControl>={}):NativeControl {
 return button(id,label,extra.disabled?()=>{}:narrativeGuard(activate),extra);
}
const narrativeHeading=(id:string,label:string):NativeRow=>({id,label,emphasis:'heading',presentation:'plain',compact:true});
const narrativeFact=(id:string,label:string,value?:string,detail?:string):NativeRow=>({...row(id,label,value,detail),presentation:'plain',compact:true});
function questDuration(ticks:number,elapsed=false):string {
 const exact=Math.max(0,ticks)*1440/TICKS_PER_DAY,minutes=elapsed?Math.floor(exact):Math.ceil(exact);
 if(minutes<60)return String(minutes)+' min';
 const hours=Math.floor(minutes/60),rest=minutes%60;return String(hours)+' h'+(rest?' '+rest+' min':'');
}
const questAgo=(ticks:number):string=>ticks<=0||questDuration(ticks,true)==='0 min'?'à l’instant':'il y a '+questDuration(ticks,true);
function joinerQuestTiming(quest:JoinerQuest,world:World):string {
 if(quest.status==='offered')return 'Répondre sous '+questDuration(quest.expiresAt-world.tick)+'. Après acceptation : arrivée dans '+questDuration(quest.joinDelay)+', poursuite dans '+questDuration(quest.raidDelay)+'. Une bordure bloquée peut retarder ces entrées.';
 if(quest.status==='accepted'){
  if(quest.raidGroupId!==undefined)return 'La poursuite est apparue. Conclusion dans '+questDuration((quest.raidAt??world.tick)+60-world.tick)+'. Le combat peut continuer après la conclusion du dossier.';
  if(quest.arrivedAt!==undefined){const due=Math.max((quest.acceptedAt??world.tick)+quest.raidDelay,quest.arrivedAt+quest.raidDelay-quest.joinDelay);return world.tick<due?'Personne arrivée. Poursuite prévue dans '+questDuration(due-world.tick)+'.':'Personne arrivée. La poursuite attend une bordure libre ou la fin de l’attaque en cours.';}
  const due=(quest.acceptedAt??world.tick)+quest.joinDelay;return world.tick<due?'Arrivée attendue dans '+questDuration(due-world.tick)+'.':'Arrivée attendue : une bordure libre manque encore.';
 }
 return (quest.status==='concluded'?'Conclusion neutre ; le combat et les blessés peuvent rester présents. ':quest.status==='refused'?'Refus sans pénalité. ':'Expiration sans pénalité. ')+questAgo(world.tick-(quest.endedAt??quest.offeredAt))+'.';
}
function tradeDurationCore(core:number):string {
 const minutes=Math.ceil(Math.max(0,core)*1440/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
 return days?String(days)+' j'+(hours?' '+hours+' h':''):hours?String(hours)+' h'+(rest?' '+rest+' min':''):String(minutes)+' min';
}
function tradeRequestAvailable(source:NarrativeSource,request:TradeRequest284):boolean {
 const settlement=source.worldFactions?.settlements.find(s=>s.id===request.settlementId);
 if(request.status!=='offered'||source.tick*10>=request.offerExpiresAtCore||request.destinationLost||!source.worldFactions||!settlement||settlement.factionId!==request.factionId||settlement.tile!==request.tile)return false;
 const access=worldSettlementAccess256(source.worldFactions,request.settlementId);return !!access.ok&&!!access.canTrade;
}
function freshTradeRequest(state:NativeUiState,id:number):{source:NarrativeSource;request:TradeRequest284}|undefined {
 const source=state.world??state.campaign,request=source?.tradeRequests284?.entries.find(request=>request.id===id);return source&&request?{source,request}:undefined;
}
const tradeRewardText=(option:TradeRequest284['options'][number]):string=>[...option.original.map(p=>String(p.quantity)+' '+ITEM_DEFINITIONS[p.item].label+(p.quality?' ('+QUALITY_LABELS[p.quality]+')':'')),option.goodwill?'Relations +'+option.goodwill:''].filter(Boolean).join(' · ');
/** Core MainTabWindow_History, Messages tab (schema 352): the archived
 * letters and pinned journal lines, newest first. Pinning keeps an entry
 * beyond the 200 most recent unpinned ones (Archive.MaxNonPinnedArchivables). */
function letterArchiveRows(source:NarrativeSource):NativeRow[] {
 const state=source.letters352,archive=state?.archive??[],pinned=new Set(state?.pinned??[]),stacked=new Set(state?.stack??[]);
 const needle=colonistSearchText(narrativeView.historySearch.trim()),kept=archive.filter(entry=>{
  const letter='cls'in entry;
  return (letter?narrativeView.historyShowLetters:narrativeView.historyShowMessages)&&(!narrativeView.historyPinnedOnly||pinned.has(entry.id))
    &&(!needle||colonistSearchText(letter?entry.title+' '+entry.text:entry.message).includes(needle));
 });
 const ordered=[...kept].reverse(),shown=narrativeView.historyAll?ordered:ordered.slice(0,30);
 const rows:NativeRow[]=[narrativeHeading('history-letters-heading','Lettres archivées'),
  narrativeFact('history-letters-count','Archive',`${archive.length} entrée${archive.length===1?'':'s'} · ${pinned.size} épinglée${pinned.size===1?'':'s'}`,
   'Les 200 entrées non épinglées les plus récentes sont gardées ; une lettre encore dans la pile n’est jamais retirée.')];
 for(const entry of shown){
  const letter='cls'in entry,pin=pinned.has(entry.id);
  const controls=[...letter?[narrativeButton(`archive-open-${entry.id}`,'Ouvrir',()=>host?.openLetter352?.(entry.id),{icon:'history-letter',color:LETTER_CLASSES_352[entry.cls].color,hint:'Ouvrir la lettre complète'})]:[],
   narrativeButton(`archive-pin-${entry.id}`,pin?'Désépingler':'Épingler',async()=>{await host?.command({type:'archive-pin',id:entry.id,pinned:!pin});back();},{icon:'history-pin',active:pin,hint:pin?'Retirer l’épingle : l’entrée pourra quitter l’archive avec le temps.':'Garder cette entrée dans l’archive.'})];
  rows.push({...narrativeFact(`archive-${entry.id}`,'Jour '+(1+Math.floor(entry.tick/TICKS_PER_DAY)),letter?entry.title:entry.message,
   letter?LETTER_CLASSES_352[entry.cls].label+(stacked.has(entry.id)?' · dans la pile':''):'Ligne du journal épinglée'),labelWidth:90,controls,
   historyEntry:{kind:letter?'letter':'journal',body:letter?entry.text:entry.message,...!letter?{icon:journalPictogram({tick:entry.tick,type:entry.journal,message:entry.message})}:{},...letter?{color:LETTER_CLASSES_352[entry.cls].color}:{}}});
 }
 if(!shown.length)rows.push(narrativeFact('history-letters-empty',narrativeView.historyPinnedOnly?'Aucune entrée épinglée.':'Aucune lettre reçue.'));
 return rows;
}
function historyEconomyRows(state:NativeUiState):NativeRow[] {
 const rows:NativeRow[]=[];
 if(state.world){
  const economy=state.world.economy;rows.push(narrativeHeading('history-economy-heading','Patrimoine de la colonie'));
  if(economy){
   const wealth=economy.wealth,expect=expectationForWealth(wealth.knownTotal),missing=(wealth.unpricedPileIds?.length??0)+(wealth.unpricedPackedIds?.length??0)+(wealth.unpricedStructureIds?.length??0);
   rows.push(narrativeFact('economy-total','Patrimoine évalué',money(wealth.knownTotal)+(wealth.complete?'':' au minimum')),
    narrativeFact('economy-items','Objets',money(wealth.items)),narrativeFact('economy-buildings','Bâtiments',money(wealth.structures)),narrativeFact('economy-floors','Sols',money(wealth.floors)),
    narrativeFact('economy-expectations','Attentes',expect.label+' ('+signed(expect.moodOffset)+' humeur)'+(wealth.complete?'':' · palier provisoire')),
    narrativeFact('economy-coverage','Couverture',wealth.complete?'Complète':'Valeurs manquantes',String(wealth.unpricedPawnIds.length)+(wealth.unpricedPawnIds.length===1?' personne':' personnes')+' et '+missing+' autres biens non évalués.'),
    narrativeFact('economy-sample','Dernier relevé','Jour '+(1+Math.floor(economy.sampledAt/TICKS_PER_DAY)),'Montants du dernier relevé. Les attentes sont provisoires si des valeurs manquent.'));
  }else rows.push({...row('economy-adopt','Patrimoine',undefined,'Cette partie conserve ses règles historiques. Activer le suivi part des biens présents, sans inventer les relevés passés.',[narrativeButton('economy-enable','Activer le suivi économique',current=>{if(current.world&&!current.world.economy)return send({type:'adopt-economy'});})]),presentation:'plain'});
 }else rows.push(narrativeFact('history-economy-off-map','Aucune colonie locale sélectionnée.'));
 return rows;
}
function historyPanel(state:NativeUiState):NativePage {
 syncNarrativeView(state);
 const source=state.world??state.campaign,tab=narrativeView.historyTab,rows:NativeRow[]=[
  {id:'history-tabs',label:'',region:'toolbar',controlStyle:'tab',controls:([['graph','Graphiques'],['messages','Messages'],['stats','Statistiques']] as const).map(([kind,label])=>
   narrativeButton('history-tab-'+kind,label,()=>{narrativeView.historyTab=kind;back();},{active:kind===tab}))},
 ];
 const close=()=>void host?.panel(null);
 if(tab!=='messages'){
  const economy=state.world?.economy;
  if(tab==='graph'&&economy){
   const wealth=economy.wealth;
   rows.push({id:'history-wealth-graph',label:'Patrimoine actuel',region:'details',
    historyGraph:{sample:'Jour '+(1+Math.floor(economy.sampledAt/TICKS_PER_DAY))+' · dernier relevé',total:wealth.knownTotal,complete:wealth.complete,
      bars:[{label:'Objets',value:wealth.items,color:'#9db77e'},{label:'Bâtiments',value:wealth.structures,color:'#c2ab82'},{label:'Sols',value:wealth.floors,color:'#94b5c1'},{label:'Personnes évaluées',value:wealth.pawnsKnown,color:'#dcb267'}]},
    hint:'La simulation garde le dernier relevé du patrimoine, pas une série historique. Aucune courbe passée n’est inventée.'});
  }else rows.push(...historyEconomyRows(state).map(row=>({...row,region:'details' as const})));
  return {id:'history',title:'Historique',layout:'history',historyMode:tab,width:NATIVE_HISTORY.width,height:NATIVE_HISTORY.height,
   contentKey:JSON.stringify([narrativeIdentity(state),tab]),rows,onClose:close};
 }
 const messages:NativeRow[]=[];
 const letters352=!!source&&isSchema352OrLater(source.schemaVersion);
 if(letters352&&(narrativeView.historyShowLetters||narrativeView.historyShowMessages))messages.push(...letterArchiveRows(source!));
 // Journal lines already copied into the archive by a pin.
 const archived=letters352?source!.letters352:undefined,pinnedLines=new Set<string>();
 for(const entry of archived?.archive??[])if(!('cls'in entry)&&archived!.pinned.includes(entry.id))pinnedLines.add(`${entry.tick}|${entry.journal}|${entry.message}`);
 const events=source?.events??[],needle=narrativeView.historySearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr'),matches:number[]=[];
 for(let i=events.length-1;i>=0;i--)if(!needle||events[i]!.message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').includes(needle))matches.push(i);
 const shown=narrativeView.historyShowMessages?(narrativeView.historyAll?matches:matches.slice(0,30)):[];
 rows.push({id:'history-search',label:'',region:'toolbar',hint:'Rechercher dans le titre, la lettre et le journal',input:{value:narrativeView.historySearch,placeholder:'Rechercher…',maxLength:160,onCommit:narrativeGuard((_current,value:string)=>{narrativeView.historySearch=value;narrativeView.historySelected=undefined;back();})}},
   {id:'history-filters',label:'',region:'toolbar',controlStyle:'button',controls:[
     narrativeButton('history-filter-letters','Lettres',()=>{narrativeView.historyShowLetters=!narrativeView.historyShowLetters;narrativeView.historySelected=undefined;back();},{active:narrativeView.historyShowLetters}),
     narrativeButton('history-filter-messages','Messages',()=>{narrativeView.historyShowMessages=!narrativeView.historyShowMessages;narrativeView.historySelected=undefined;back();},{active:narrativeView.historyShowMessages}),
   ]});
 if(narrativeView.historyShowMessages)messages.push(narrativeHeading('history-journal-heading','Journal de la colonie'),
  narrativeFact('history-count','Événements',shown.length+' / '+matches.length+(needle?' correspondants':'')+' · '+events.length+' au total'));
 for(const index of shown){const event=events[index]!,pinned=pinnedLines.has(`${event.tick}|${event.type}|${event.message}`);
  messages.push({...narrativeFact('event-'+index,'Jour '+(1+Math.floor(event.tick/TICKS_PER_DAY)),event.message),labelWidth:90,
   historyEntry:{kind:'journal',body:event.message,icon:journalPictogram(event)},...letters352?{controls:[narrativeButton(`event-pin-${index}`,pinned?'Épinglée':'Épingler',async()=>{await host?.command({type:'journal-pin',tick:event.tick,journal:event.type,message:event.message});back();},{icon:'history-pin',active:pinned,disabled:pinned,hint:'Copier cette ligne dans l’archive des lettres, où elle reste.'})]}:{}});}
 if(narrativeView.historyShowMessages&&!shown.length)messages.push(narrativeFact('history-empty',events.length?'Aucun événement ne correspond à la recherche.':'Aucun événement consigné.'));
 const selected=messages.find(row=>row.historyEntry&&row.id===narrativeView.historySelected)??messages.find(row=>row.historyEntry);
 narrativeView.historySelected=selected?.id;
 for(const message of messages){
  message.region='navigation';
  if(message.historyEntry)(message.controls??=[]).push(narrativeButton('history-select-'+message.id,message.value??message.label,
   ()=>{narrativeView.historySelected=message.id;back();},{active:selected?.id===message.id,hint:message.historyEntry.body,presentation:'history-row'}));
  rows.push(message);
 }
 if(selected){
  rows.push({...narrativeHeading('history-selected-date',selected.label+(selected.detail?' · '+selected.detail:'')),region:'details'});
  if(selected.historyEntry!.kind==='letter')rows.push({...narrativeFact('history-selected-title',selected.value??selected.label),region:'details'});
  rows.push({...narrativeFact('history-selected-body',selected.historyEntry!.body),region:'details'});
  const open=selected.controls?.find(control=>control.id.startsWith('archive-open-'));
  if(open)rows.push({...row('history-selected-open','',undefined,undefined,[{...open,id:'history-detail-open',label:'Ouvrir la lettre',icon:'history-letter'}]),region:'details'});
 }else rows.push({...narrativeFact('history-selected-empty','Aucun message sélectionné.'),region:'details'});
 const navigationKey=JSON.stringify([narrativeIdentity(state),tab,narrativeView.historySearch,narrativeView.historyAll,narrativeView.historyPinnedOnly,narrativeView.historyShowLetters,narrativeView.historyShowMessages]);
 return {id:'history',title:'Historique',layout:'history',historyMode:tab,width:NATIVE_HISTORY.width,height:NATIVE_HISTORY.height,navigationKey,contentKey:JSON.stringify([navigationKey,selected?.id]),rows,actions:[
  ...letters352?[narrativeButton('history-pinned-only',narrativeView.historyPinnedOnly?'Toute l’archive':'Épinglées seulement',()=>{narrativeView.historyPinnedOnly=!narrativeView.historyPinnedOnly;back();})]:[],
  narrativeButton('history-range',narrativeView.historyAll?'30 derniers événements':'Tout le journal',()=>{narrativeView.historyAll=!narrativeView.historyAll;back();},{hint:'Le journal complet reste conservé. Cette commande change uniquement son affichage.'}),
 ],onClose:close};
}

function foodEditor(id:number):void {
 const policy=currentWorld().foodPolicies.find(p=>p.id===id);if(!policy)throw Error('Ce régime n’existe plus.');
 let name=policy.name;const allowed=new Set(policy.allowed);
 const make=():NativePage=>detailPage(`food-policy-${id}`,policy.name,[
  {id:'food-name',label:'Nom du régime',input:{value:name,maxLength:60,onCommit:value=>{name=value;}}},
  row('food-users','Utilisateurs présents',currentWorld().pawns.filter(p=>p.foodPolicyId===id).map(p=>p.name).join(', ')||'Aucun','Modifier ce régime partagé affecte toutes les personnes qui l’utilisent.'),
  row('food-all','Aliments',undefined,undefined,[button('food-allow-all','Tout autoriser',()=>{for(const item of FOOD_ITEMS)allowed.add(item);open(make());}),button('food-deny-all','Tout interdire',()=>{allowed.clear();open(make());})]),
  ...FOOD_ITEMS.map(item=>row(`food-${item}`,ITEM_DEFINITIONS[item].label,undefined,undefined,[button(`food-${item}-toggle`,allowed.has(item)?'Autorisé':'Interdit',()=>{allowed.has(item)?allowed.delete(item):allowed.add(item);open(make());},{active:allowed.has(item)})])),
 ],[button('food-apply','Appliquer',async()=>{await send({type:'food-policy-update',policyId:id,name,allowed:[...allowed]});back();}),button('food-copy','Dupliquer',()=>inputPage(`food-copy-${id}`,'Dupliquer le régime',`${policy.name} copie`,value=>send({type:'food-policy-create',name:value,copyFromId:id}))),button('food-delete','Supprimer',()=>confirm(`food-delete-${id}`,'Supprimer ce régime ?',`La commande vérifie les utilisateurs et le régime de remplacement.`,()=>send({type:'food-policy-delete',policyId:id})))]);
 open(make());
}
function drugEditor(id:number):void {
 const policy=effectiveDrugPolicies265(currentWorld()).find(p=>p.id===id);if(!policy)throw Error('Cette politique n’existe plus.');
 let name=policy.name,beer:BeerPolicy265={...policy.beer};
 const withPenoxycyline=isPenoxycyline337(currentWorld().schemaVersion);let penoxycyline:PenoxycylinePolicy337={...penoxycylinePolicyOf337(policy)};
 const penoxycylineNumbers:readonly [keyof Pick<PenoxycylinePolicy337,'daysFrequency'|'onlyIfMoodBelow'|'onlyIfJoyBelow'>,string,number,number,number][]=[['daysFrequency','Pénoxycyline : fréquence en jours',1,.1,25],['onlyIfMoodBelow','Pénoxycyline : seulement si humeur inférieure (%)',100,1,100],['onlyIfJoyBelow','Pénoxycyline : seulement si loisir inférieur (%)',100,1,100]];
 const booleans:readonly [keyof Pick<BeerPolicy265,'allowedForAddiction'|'allowedForJoy'|'allowScheduled'>,string][]=[['allowedForAddiction','Autoriser pour dépendance'],['allowedForJoy','Autoriser pour loisir'],['allowScheduled','Prise programmée']];
 const numbers:readonly [keyof Pick<BeerPolicy265,'daysFrequency'|'onlyIfMoodBelow'|'onlyIfJoyBelow'|'takeToInventory'>,string,number,number,number][]=[['daysFrequency','Fréquence en jours',1,.1,25],['onlyIfMoodBelow','Seulement si humeur inférieure (%)',100,1,100],['onlyIfJoyBelow','Seulement si loisir inférieur (%)',100,1,100],['takeToInventory','Quantité dans l’inventaire',1,0,3]];
 const make=():NativePage=>detailPage(`drug-policy-${id}`,policy.name,[
  {id:'drug-name',label:'Nom',input:{value:name,maxLength:60,onCommit:value=>{name=value;}}},row('drug-item','Substance','Bière','Les effets passent par une consommation physique ; ce réglage ne donne aucun objet.'),
  ...booleans.map(([key,label])=>row(`drug-${key}`,label,undefined,undefined,[button(`drug-${key}-toggle`,beer[key]?'Oui':'Non',()=>{beer={...beer,[key]:!beer[key]};open(make());},{active:beer[key]})])),
  ...numbers.map(([key,label,scale,min,max]):NativeRow=>({id:`drug-${key}`,label,input:{value:String(beer[key]*scale),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||key==='takeToInventory'&&!Number.isInteger(n))throw Error(`Valeur attendue entre ${min} et ${max}.`);beer={...beer,[key]:n/scale};}}})),
  ...(withPenoxycyline?[
   row('drug-penoxycyline','Substance','Pénoxycyline','Médicament préventif : une dose protège environ 5,5 jours du paludisme, de la maladie du sommeil et de la peste. Le jeu de base conseille une prise tous les cinq jours ; la politique par défaut ne la programme pas.'),
   row('drug-penoxycyline-scheduled','Pénoxycyline : prise programmée',undefined,undefined,[button('drug-penoxycyline-scheduled-toggle',penoxycyline.allowScheduled?'Oui':'Non',()=>{penoxycyline={...penoxycyline,allowScheduled:!penoxycyline.allowScheduled};open(make());},{active:penoxycyline.allowScheduled})]),
   ...penoxycylineNumbers.map(([key,label,scale,min,max]):NativeRow=>({id:`drug-penoxycyline-${key}`,label,input:{value:String(penoxycyline[key]*scale),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(`Valeur attendue entre ${min} et ${max}.`);penoxycyline={...penoxycyline,[key]:n/scale};}}})),
  ]:[]),
 ],[button('drug-apply','Appliquer',async()=>{await send({type:'drug-policy-update',policyId:id,name,beer:{...beer},...(withPenoxycyline?{penoxycyline337:{...penoxycyline}}:{})});back();}),button('drug-copy','Dupliquer',()=>inputPage(`drug-copy-${id}`,'Dupliquer',`${name} copie`,value=>send({type:'drug-policy-create',name:value,copyFromId:id}))),button('drug-default','Choisir par défaut',async()=>{await send({type:'drug-policy-default',policyId:id});back();}),button('drug-delete','Supprimer',()=>confirm(`drug-delete-${id}`,'Supprimer cette politique ?',policy.name,()=>send({type:'drug-policy-delete',policyId:id})))]);
 open(make());
}
function apparelEditor(id:number):void {
 const policy=currentWorld().apparelPolicies?.find(p=>p.id===id);if(!policy)throw Error('Cette tenue n’existe plus.');
 const items=new Set(policy.allowedItems),materials=new Set(policy.allowedMaterials);
 let minQuality=policy.minQuality,maxQuality=policy.maxQuality,minHitPointsPercent=policy.minHitPointsPercent,maxHitPointsPercent=policy.maxHitPointsPercent;
 // Schema 374: Core's "allow tainted apparel" filter of the policy.
 const taintedFilter=currentWorld().schemaVersion>=374;let taintedAllowed=policy.taintedAllowed374!==false;
 const quality=(which:'min'|'max'):void=>choose(`quality-${which}`,'Qualité',(WEAPON_QUALITIES as readonly WeaponQuality[]).map(value=>({id:value,label:QUALITY_LABELS[value],active:value===(which==='min'?minQuality:maxQuality),choose:()=>{if(which==='min')minQuality=value;else maxQuality=value;}})),()=>open(make()));
 const make=():NativePage=>detailPage(`apparel-policy-${id}`,policy.label,[
  row('apparel-users','Utilisateurs présents',currentWorld().pawns.filter(p=>p.apparelPolicyId===id).map(p=>p.name).join(', ')||'Aucun','Appliquer modifie les filtres partagés ; les affectations, Auto et ports forcés sont indépendants.'),
  row('apparel-quality','Qualité',`${QUALITY_LABELS[minQuality]} → ${QUALITY_LABELS[maxQuality]}`,undefined,[button('apparel-min-quality','Minimum',()=>quality('min')),button('apparel-max-quality','Maximum',()=>quality('max'))]),
  {id:'apparel-min-hp',label:'PV minimum (%)',input:{value:String(minHitPointsPercent*100),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw Error('Pourcentage de 0 à 100 requis.');minHitPointsPercent=n/100;}}},
  {id:'apparel-max-hp',label:'PV maximum (%)',input:{value:String(maxHitPointsPercent*100),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw Error('Pourcentage de 0 à 100 requis.');maxHitPointsPercent=n/100;}}},
  ...(taintedFilter?[row('apparel-tainted','Vêtements de mort',undefined,'Vêtements pris sur quelqu’un qui y est mort : les porter met mal à l’aise et les marchands les refusent.',[button('apparel-tainted-toggle',taintedAllowed?'Autorisés':'Interdits',()=>{taintedAllowed=!taintedAllowed;open(make());},{active:taintedAllowed})])]:[]),
  ...(Object.keys(APPAREL) as ApparelItem[]).map(item=>row(`apparel-item-${item}`,APPAREL[item].label,undefined,undefined,[button(`apparel-item-${item}-toggle`,items.has(item)?'Autorisé':'Interdit',()=>{items.has(item)?items.delete(item):items.add(item);open(make());},{active:items.has(item)})])),
  ...APPAREL_POLICY_MATERIALS267.map(material=>row(`apparel-material-${material}`,apparelPolicyMaterialLabel267(material),undefined,undefined,[button(`apparel-material-${material}-toggle`,materials.has(material)?'Autorisée':'Interdite',()=>{materials.has(material)?materials.delete(material):materials.add(material);open(make());},{active:materials.has(material)})])),
 ],[button('apparel-apply','Appliquer',async()=>{if(WEAPON_QUALITIES.indexOf(minQuality)>WEAPON_QUALITIES.indexOf(maxQuality)||minHitPointsPercent>maxHitPointsPercent)throw Error('Le minimum dépasse le maximum.');await send({type:'apparel-policy-update',policyId:id,allowedItems:[...items],allowedMaterials:[...materials],minQuality,maxQuality,minHitPointsPercent,maxHitPointsPercent,...(taintedFilter?{allowTainted374:taintedAllowed}:{})});back();}),button('apparel-copy','Copier les filtres confirmés',()=>inputPage(`apparel-copy-${id}`,'Copier la tenue',`${policy.label} copie`,label=>send({type:'apparel-policy-copy',policyId:id,label}))),button('apparel-rename','Renommer',()=>inputPage(`apparel-rename-${id}`,'Renommer la tenue',policy.label,label=>send({type:'apparel-policy-rename',policyId:id,label})))]);
 open(make());
}
function areaEditor(onBack:()=>void=back):void {host?.previewAllowedArea?.(undefined);openLive(()=>areaEditorPage(onBack));}
function areaEditorPage(onBack:()=>void):NativePage {
 const world=currentWorld(),returnToList=()=>areaEditor(onBack);
 const epoch=latest?.epoch,mapId=registeredMapId(world),seed=world.seed,width=world.width,height=world.height;
 const preview=(areaId:number|undefined):void=>{
  if(areaId===undefined){host?.previewAllowedArea?.(undefined);return;}
  const current=host?.readState?.()??latest,fresh=current?.world;
  if(!fresh||current?.epoch!==epoch||registeredMapId(fresh)!==mapId||fresh.seed!==seed||fresh.width!==width||fresh.height!==height)return;
  host?.previewAllowedArea?.(areaId!==undefined&&fresh.allowedAreas?.some(area=>area.id===areaId)?areaId:undefined);
 };
 const clearPreview=()=>preview(undefined),leaveList=()=>{clearPreview();onBack();};
 const page=detailPage('allowed-areas','Zones autorisées',[
  row('areas-help','Règles',`${world.allowedAreas?.length??0} / 10`,'Une zone vide équivaut à Sans restriction. Les trajets peuvent traverser le reste de la carte.'),
  ...(world.allowedAreas??[]).map(area=>row(`area-${area.id}`,area.label,`${area.cells.length} cases · #${area.color.toString(16).padStart(6,'0')}`,undefined,[
   button(`area-${area.id}-rename`,'Renommer',()=>renameAllowedArea(area.id,returnToList)),
   button(`area-${area.id}-color`,'Couleur',()=>colorAllowedArea(area.id,returnToList),{color:`#${area.color.toString(16).padStart(6,'0')}`,hint:`Couleur de ${area.label}`} ),
   ...(host?.paintAllowedArea?[button(`area-${area.id}-expand`,'Agrandir',()=>host?.paintAllowedArea?.(area.id,true)),button(`area-${area.id}-shrink`,'Réduire',()=>host?.paintAllowedArea?.(area.id,false))]:[]),
   button(`area-${area.id}-paint`,'Coordonnées',()=>paintAreaCoordinates(area.id,returnToList)),
   button(`area-${area.id}-delete`,'Supprimer',()=>open(detailPage(`area-delete-${area.id}`,'Supprimer cette zone ?',[row('area-delete-name',area.label)],
    [button(`area-delete-${area.id}-confirm`,'Confirmer',async()=>{await send({type:'allowed-area-delete',areaId:area.id});returnToList();})],returnToList))),
  ])),
 ],[button('area-new','Nouvelle zone',async()=>{await send({type:'allowed-area-create'});returnToList();},{disabled:(world.allowedAreas?.length??0)>=10})],leaveList);
 // The actions of a zone share one preview; a dialog releases it first.
 for(const area of world.allowedAreas??[]){
  const entry=page.rows.find(row=>row.id===`area-${area.id}`);if(!entry)continue;
  const onHover=(hovered:boolean)=>preview(hovered?area.id:undefined);
  entry.controls=entry.controls?.map(action=>{
   const activate=action.onActivate;
   return {...action,onHover,onActivate:()=>{clearPreview();return activate();}};
  });
 }
 page.layout='table';page.width=1280;
 for(const entry of page.rows){entry.compact=true;entry.presentation='plain';}
 page.rows.splice(1,0,{id:'areas-headings',label:'Zone',value:'Cases · couleur',compact:true,presentation:'plain',columns:['Renommer','Couleur',...(host?.paintAllowedArea?['Agrandir','Réduire']:[]),'Coordonnées','Supprimer'].map(label=>({label}))});
 return page;
}
function renameAllowedArea(areaId:number,onBack:()=>void):void {
 const area=currentWorld().allowedAreas?.find(area=>area.id===areaId);if(!area)return;
 let draft=area.label;
 const page=detailPage(`area-rename-${areaId}`,'Nom de zone',[
  {id:`area-rename-${areaId}-input`,label:'Nom',compact:true,presentation:'plain',input:{value:draft,maxLength:64,onCommit:value=>{draft=value;}}},
 ],[button(`area-rename-${areaId}-apply`,'Appliquer',async()=>{await send({type:'allowed-area-settings',areaId,label:draft});onBack();})],onBack);
 page.width=480;open(page);
}
/** Named painted swatches complement, rather than remove, the precise color. */
function colorAllowedArea(areaId:number,onBack:()=>void):void {
 const area=currentWorld().allowedAreas?.find(area=>area.id===areaId);if(!area)return;
 let draft=area.color.toString(16).padStart(6,'0');
 const palette=[['Sauge','8ca77b'],['Bleu','8eb0bd'],['Terre cuite','ca927b'],['Ocre','d5b36c'],['Lavande','b4a0bf'],['Rose','d2a5ab'],['Menthe','8db9aa'],['Sable','c9ba98']] as const;
 const make=():NativePage=>{
  const page=detailPage(`area-color-${areaId}`,'Couleur de zone',[
   {id:'area-color-palette',label:'Couleurs',compact:true,presentation:'plain',controls:palette.map(([label,hex])=>button(`area-color-${hex}`,label,()=>{draft=hex;open(make());},{color:`#${hex}`,caption:draft.toLowerCase()===hex?'Choisie':undefined,hint:`${label} · #${hex}`}))},
   {id:'area-color-input',label:'Code précis',compact:true,presentation:'plain',input:{value:draft,placeholder:'#RRGGBB',maxLength:7,onCommit:value=>{draft=value.replace(/^#/,'');open(make());}}},
   {id:'area-color-preview',label:'Aperçu',compact:true,presentation:'plain',controls:[button('area-color-current','Couleur choisie',()=>{},{color:/^[0-9a-fA-F]{6}$/.test(draft)?`#${draft}`:undefined,hint:`#${draft}`})]},
  ],[button('area-color-apply','Appliquer',async()=>{if(!/^[0-9a-fA-F]{6}$/.test(draft))throw Error('Six chiffres hexadécimaux requis.');await send({type:'allowed-area-settings',areaId,color:parseInt(draft,16)});onBack();})],onBack);
  page.width=600;return page;
 };open(make());
}
/** Coordinate entry keeps the same bounded rectangle command. */
function paintAreaCoordinates(areaId:number,onBack:()=>void=()=>areaEditor()):void {
 const world=currentWorld();let fromX=latest?.selectedCell?.x??0,fromZ=latest?.selectedCell?.z??0,toX=fromX,toZ=fromZ,enabled=true;
 const make=():NativePage=>{
  const page=detailPage(`area-paint-${areaId}`,'Modifier la zone',[
   {...row('paint-mode','Opération',enabled?'Agrandir':'Réduire',undefined,[button('paint-toggle',enabled?'Ajouter les cases':'Retirer les cases',()=>{enabled=!enabled;open(make());})]),compact:true,presentation:'plain'},
   ...([['from-x','Début X',()=>fromX,(n:number)=>{fromX=n;},world.width],['from-z','Début Z',()=>fromZ,(n:number)=>{fromZ=n;},world.height],['to-x','Fin X',()=>toX,(n:number)=>{toX=n;},world.width],['to-z','Fin Z',()=>toZ,(n:number)=>{toZ=n;},world.height]] as const).map(([id,label,read,write,limit],index):NativeRow=>({id,label,column:index%2===0?0:1,compact:true,presentation:'plain',input:{value:String(read()),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>=limit)throw Error(`Coordonnée de 0 à ${limit-1} requise.`);write(n);}}})),
  ],[button('paint-apply','Appliquer le rectangle',async()=>{await send({type:'allowed-area-paint',areaId,enabled,from:{x:fromX,z:fromZ},to:{x:toX,z:toZ}});onBack();})],onBack);
  page.width=600;return page;
 };open(make());
}
/** Core's Assign columns first (hostility, apparel, food, drugs, reading), the allowed area last as in the Restrict table. */
const assignOrder=<T,>(values:readonly T[]):T[]=>[1,3,4,5,0,6,7,2].filter(i=>i<values.length).map(i=>values[i]!);
function assignPanel(world:World):NativePage {
 const {all,shown:pawns,search}=colonistTableRows('assign',world),reading=Number(world.schemaVersion)===295||Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion));
 const rows:NativeRow[]=[{id:'assign-headings',label:'Colon',value:'Activité',compact:true,columns:assignOrder(['Régime','Hostilité','Zone','Tenue','Auto','Port forcé','Drogues',...(reading?['Lecture']:[])]).map(label=>({label}))},colonistTableToolbar('assign',search,pawns.length,all.length)];
 for(const pawn of pawns){
  const food=world.foodPolicies.find(p=>p.id===pawn.foodPolicyId),apparel=world.apparelPolicies?.find(p=>p.id===pawn.apparelPolicyId),drug=effectiveDrugPolicies265(world).find(p=>p.id===pawn.drugPolicyId)??effectiveDrugPolicies265(world)[0]!;
  const area=pawn.allowedAreaId?world.allowedAreas?.find(a=>a.id===pawn.allowedAreaId)?.label??'Zone inconnue':'Sans restriction',response={flee:'Fuir',ignore:'Ignorer',attack:'Attaquer'}[pawn.hostilityResponse??'flee'];
  const values:Record<string,string>={food:food?.name??'Régime inconnu',response,area,apparel:apparel?.label??'Tenue indisponible',auto:pawn.apparelAutomation?'Actif':'Inactif',forced:'Libérer',drug:drug?.name??'Politique indisponible',reading:READING_POLICIES_295.find(p=>p.id===effectiveReadingPolicy295(pawn))!.label};
  const dead=pawn.state==='dead'||!!pawn.health?.death||!!pawn.visitor;
  const owner=()=>colonistTablePawn(pawn.id,'assign');
  const controls:NativeControl[]=[
   colonistTableControl(`assign-food-${pawn.id}`,values.food!,()=>{},{disabled:dead,hint:`${pawn.name} · Régime : ${values.food}`,select:{value:String(pawn.foodPolicyId),options:world.foodPolicies.map(policy=>({value:String(policy.id),label:policy.name})),onChange:value=>{const id=Number(value),policy=currentWorld().foodPolicies.find(p=>p.id===id);if(!policy)return;return send({type:'food-policy-assign',pawnId:owner().id,policyId:policy.id});}}}),
   colonistTableControl(`assign-response-${pawn.id}`,response,()=>{},{disabled:dead,hint:`${pawn.name} · réaction hostile`,select:{value:pawn.hostilityResponse??'flee',options:([{value:'flee',label:'Fuir'},{value:'ignore',label:'Ignorer'},{value:'attack',label:'Attaquer'}]),onChange:value=>{if(value!=='flee'&&value!=='ignore'&&value!=='attack')return;return send({type:'hostility-response',pawnId:owner().id,response:value});}}}),
   colonistTableControl(`assign-area-${pawn.id}`,area,()=>{},{disabled:dead,hint:`${pawn.name} · zone autorisée : ${area}`,select:{value:String(pawn.allowedAreaId??0),options:[{value:'0',label:'Sans restriction'},...(world.allowedAreas??[]).map(a=>({value:String(a.id),label:a.label}))],onChange:value=>{const areaId=Number(value);if(!Number.isSafeInteger(areaId)||areaId!==0&&!currentWorld().allowedAreas?.some(a=>a.id===areaId))return;return send({type:'assign-allowed-area',pawnId:owner().id,areaId:areaId||null});}}}),
  ];
  if(world.schemaVersion>=90&&apparel){controls.push(
   colonistTableControl(`assign-apparel-${pawn.id}`,values.apparel!,()=>{},{disabled:dead,hint:`${pawn.name} · Tenue : ${values.apparel}`,select:{value:String(pawn.apparelPolicyId),options:(world.apparelPolicies??[]).map(policy=>({value:String(policy.id),label:policy.label})),onChange:value=>{const policy=(currentWorld().apparelPolicies??[]).find(p=>p.id===Number(value));if(!policy)return;const p=owner();return send({type:'apparel-policy-assign',pawnId:p.id,policyId:policy.id,automatic:!!p.apparelAutomation});}}}),
   colonistTableControl(`assign-auto-${pawn.id}`,values.auto!,()=>{const p=owner();return send({type:'apparel-policy-assign',pawnId:p.id,policyId:p.apparelPolicyId??apparel.id,automatic:!p.apparelAutomation});},{disabled:dead,active:!!pawn.apparelAutomation,hint:`${pawn.name} · automatisation de la tenue : ${pawn.apparelAutomation?'active':'inactive'}`}),
   colonistTableControl(`assign-forced-${pawn.id}`,'Libérer',()=>send({type:'apparel-clear-forced',pawnId:owner().id}),{disabled:dead,hint:`${pawn.name} · libérer le port forcé`}),
  );}else controls.push(...['apparel','auto','forced'].map(action=>button(`assign-${action}-${pawn.id}-unavailable`,'—',()=>{},{disabled:true,hint:'Indisponible dans cette partie.'})));
  if(world.schemaVersion>=265)controls.push(colonistTableControl(`assign-drug-${pawn.id}`,values.drug!,()=>{},{disabled:dead,hint:`${pawn.name} · Drogues : ${values.drug}`,select:{value:String(drug.id),options:effectiveDrugPolicies265(world).map(policy=>({value:String(policy.id),label:policy.name})),onChange:value=>{const policy=effectiveDrugPolicies265(currentWorld()).find(p=>p.id===Number(value));if(!policy)return;return send({type:'drug-policy-assign',pawnId:owner().id,policyId:policy.id});}}}));else controls.push(button(`assign-drug-${pawn.id}-unavailable`,'—',()=>{},{disabled:true,hint:'Indisponible dans cette partie.'}));
  if(reading)controls.push(colonistTableControl(`assign-reading-${pawn.id}`,values.reading!,()=>{},{disabled:dead,hint:`${pawn.name} · Lecture : ${values.reading}`,select:{value:String(effectiveReadingPolicy295(pawn)),options:READING_POLICIES_295.map(policy=>({value:String(policy.id),label:policy.label})),onChange:value=>{const policy=READING_POLICIES_295.find(p=>String(p.id)===value);if(!policy)return;return send({type:'reading-policy-295',pawnId:owner().id,policyId:policy.id});}}}));
  rows.push({...row(`assign-${pawn.id}`,pawn.name,queryPawnStatus(world,pawn).reason,undefined,assignOrder(controls)),compact:true,hint:[pawn.name,`Régime : ${values.food}`,`Hostilité : ${response}`,`Zone : ${area}`,`Tenue : ${values.apparel}`,`Auto : ${values.auto}`,`Drogues : ${values.drug}`].join('\n')});
 }
 const actions:NativeControl[]=[colonistTableControl('assign-manage-food','Régimes',()=>openLive(()=>detailPage('assign-food-policies','Régimes alimentaires',[
  row('manage-food','Régimes alimentaires',undefined,undefined,[colonistTableControl('food-new','Nouveau régime',()=>inputPage('new-food','Nouveau régime','Nouveau régime',colonistTableGuard((name:string)=>send({type:'food-policy-create',name})))),...currentWorld().foodPolicies.map(policy=>colonistTableControl(`food-edit-${policy.id}`,policy.name,()=>foodEditor(policy.id)))]),
 ])))];
 if(world.apparelPolicies)actions.push(colonistTableControl('assign-manage-apparel','Tenues',()=>openLive(()=>detailPage('assign-apparel-policies','Politiques de tenue',[
  row('manage-apparel','Politiques de tenue',undefined,'Filtre des vêtements et matières, qualité, PV, copie et renommage.',(currentWorld().apparelPolicies??[]).map(policy=>colonistTableControl(`apparel-edit-${policy.id}`,policy.label,()=>apparelEditor(policy.id)))),
 ]))));
 if(world.schemaVersion>=265)actions.push(colonistTableControl('assign-manage-drugs','Drogues',()=>openLive(()=>detailPage('assign-drug-policies','Politiques de drogues',[
  row('manage-drugs','Politiques de drogues',undefined,undefined,[colonistTableControl('drug-new','Nouvelle politique',()=>inputPage('new-drug','Nouvelle politique','Nouvelle politique',colonistTableGuard((name:string)=>send({type:'drug-policy-create',name})))),...effectiveDrugPolicies265(currentWorld()).map(policy=>colonistTableControl(`drug-edit-${policy.id}`,policy.name,()=>drugEditor(policy.id)))]),
 ]))));
 actions.push(colonistTableControl('areas-manage','Zones',()=>areaEditor()));
 return {id:'assign',title:'Assignations',layout:'table',tableProfile:'colonists',contentKey:`assign:${colonistTableKey(latest!)}:${search}`,rows,actions,width:1480,onClose:()=>void host?.panel(null)};
}

function questsPanel(state:NativeUiState):NativePage {
 syncNarrativeView(state);
 const source=state.world??state.campaign,rows:NativeRow[]=[],entries:QuestDossier[]=[];
 const add=(id:string,tab:QuestTab,kind:string,dossier:NativeRow[],auxiliary=false)=>{if(dossier.length)entries.push({id,tab,kind,rows:dossier,auxiliary});};
 if(!source)return {id:'quests',title:'Quêtes',layout:'quests',width:NATIVE_QUESTS.width,height:NATIVE_QUESTS.height,rows:[{...narrativeFact('quests-empty','Aucune partie active.'),region:'details'}],onClose:()=>void host?.panel(null)};
 if(state.world){
  const world=state.world,eligible=storytellerIncidents347(world)&&world.raids?.profile==='cassandra-raids-v1';
  if(!world.quests&&eligible)add('quest-enable','available','Asile et poursuite',[{...row('quest-enable','Demandes d’asile',undefined,'Après activation, une première demande peut se présenter après huit jours de jeu.',[narrativeButton('quest-enable-action','Recevoir des demandes',fresh=>{if(fresh.world&&!fresh.world.quests&&fresh.world.gameProfile&&fresh.world.raids?.profile==='cassandra-raids-v1')return send({type:'enable-quests'});})]),presentation:'plain'}],true);
  for(const quest of [...(world.quests?.entries??[])].reverse()){
   const ongoing=quest.status==='offered'||quest.status==='accepted',id=quest.id,target:NativeRow[]=[];
   const status=({offered:'Offre en cours',accepted:'Acceptée',refused:'Refusée sans pénalité',expired:'Expirée sans pénalité',concluded:'Conclue · issue neutre'} as const)[quest.status];
   const answer=(accept:boolean)=>narrativeGuard((fresh:NativeUiState)=>{const current=fresh.world?.quests?.entries.find(q=>q.id===id);if(current?.status==='offered'&&fresh.world!.tick<current.expiresAt)return send({type:'answer-quest',questId:id,accept});});
   const controls:NativeControl[]=quest.status==='offered'?[button('quest-'+id+'-accept','Accueillir et poursuite',answer(true),{disabled:world.tick>=quest.expiresAt,hint:'Accueillir cette personne et accepter la poursuite annoncée.'}),button('quest-'+id+'-refuse','Refuser sans pénalité',answer(false),{disabled:world.tick>=quest.expiresAt})]:[];
   target.push({...row('quest-'+id,quest.name,status,joinerQuestTiming(quest,world),controls),presentation:'plain',compact:true});
   if(ongoing){
    if(quest.age)target.push(narrativeFact('quest-'+id+'-age','Âge biologique / chronologique',biologicalYears(quest.age)+' / '+chronologicalYears(quest.age)+' ans'));
    if(quest.relationship)target.push(narrativeFact('quest-'+id+'-relationship','Lien proposé',offeredRelationshipText(world,quest.relationship)));
    const stories=backgroundInspectionRows(quest);if(stories.length)target.push(narrativeFact('quest-'+id+'-background','Parcours',stories.map(story=>story.phase+' : '+story.label).join(' · ')));
    const skills=quest.background?previewBackgroundSkills(quest.profile,quest.background):startingSkills(quest.profile);
    target.push(narrativeFact('quest-'+id+'-skills','Compétences proposées',backgroundSkillSummary(skills,quest)),
     narrativeFact('quest-'+id+'-consequences','Engagement',quest.status==='offered'?'Un colon et sa chemise ; un bandit au couteau le poursuit. Aucun butin promis. Refuser ou laisser expirer ne crée aucune pénalité.':'Préparez nourriture, couchage et défense. La poursuite engagée ne peut plus être annulée.'));
   }
   add('quest-'+id,quest.status==='offered'?'available':quest.status==='accepted'?'active':'history','Asile et poursuite',target);
  }
 }
 for(const request of [...(source.tradeRequests284?.entries??[])].reverse()){
  const id=request.id,ongoing=request.status==='offered'||request.status==='accepted',target:NativeRow[]=[],content=tradeRequestContent284(request.family),family=content?.label??request.family,offered=request.status==='offered'&&source.tick*10<request.offerExpiresAtCore,available=tradeRequestAvailable(source,request);
  const chosen=request.selectedOptionId??narrativeView.tradeChoices.get(id),selected=request.options.find(option=>option.id===chosen);
  const controls:NativeControl[]=[];
  if(offered){
   controls.push(narrativeButton('trade-request-'+id+'-accept','Accepter la demande',fresh=>{
    const current=freshTradeRequest(fresh,id);if(!current||!tradeRequestAvailable(current.source,current.request)||!selected||narrativeView.tradeChoices.get(id)!==selected.id)return;
    const reward=current.request.options.find(option=>option.id===selected.id);if(!reward)return;
    const confirmAction=narrativeGuard(async actual=>{const value=freshTradeRequest(actual,id);if(!value||!tradeRequestAvailable(value.source,value.request)||narrativeView.tradeChoices.get(id)!==reward.id||!value.request.options.some(option=>option.id===reward.id))return;await send({type:'trade-request-answer',requestId:id,optionId:reward.id});});
    const returnToQuests=narrativeGuard(()=>back());
    open({...detailPage('trade-answer-'+id,'Accepter la demande commerciale',[narrativeFact('trade-answer-detail',String(current.request.quantity)+' '+family,'À livrer à '+current.request.settlementName),narrativeFact('trade-answer-reward','Récompense choisie',tradeRewardText(reward))],[narrativeButton('trade-answer-'+id+'-confirm','Confirmer',async()=>{await confirmAction();returnToQuests();})],returnToQuests),layout:'message',width:NATIVE_MESSAGE.width,height:NATIVE_MESSAGE.height,closeOwnsNavigation:true});
   },{disabled:!available||!selected}));
   controls.push(narrativeButton('trade-request-'+id+'-dismiss',request.dismissed?'Réafficher la lettre':'Masquer la lettre',fresh=>{const current=freshTradeRequest(fresh,id);if(current&&current.request.status==='offered'&&current.source.tick*10<current.request.offerExpiresAtCore)return send({type:'trade-request-dismiss',requestId:id,dismissed:!current.request.dismissed});}));
  }
  const status=request.status==='offered'?(request.dismissed?'Offre masquée · délai maintenu':'Offre à accepter'):request.status==='accepted'?'Acceptée':request.status==='succeeded'?'Livraison effectuée':request.status==='failed'?'Échouée':'Expirée';
  const timing=request.status==='accepted'?'Livrer avec une caravane sous '+tradeDurationCore((request.expiresAtCore??source.tick*10)-source.tick*10)+'.':offered?'Accepter sous '+tradeDurationCore(request.offerExpiresAtCore-source.tick*10)+' ; puis '+tradeDurationCore(request.durationCore)+' pour livrer.':request.closed?.reason==='fulfilled'?'Récompense remise à la caravane qui a livré.':'Aucune récompense acquise par cette offre.';
  target.push({...row('trade-request-'+id,String(request.quantity)+' '+family,request.settlementName+' · case '+request.tile+' · '+status,timing,controls),presentation:'plain',compact:true});
  for(const option of request.options){
   if(request.status!=='offered'&&request.selectedOptionId!==undefined&&option.id!==request.selectedOptionId)continue;
   const choice=offered?[narrativeButton('trade-request-'+id+'-option-'+option.id,chosen===option.id?'Choisie':'Choisir',fresh=>{const current=freshTradeRequest(fresh,id);if(!current||!tradeRequestAvailable(current.source,current.request)||!current.request.options.some(candidate=>candidate.id===option.id))return;narrativeView.tradeChoices.set(id,option.id);back();},{active:chosen===option.id,disabled:!available,hint:'Choix local : accepter la demande reste une action séparée.'})]:[];
   target.push({...row('trade-request-'+id+'-reward-'+option.id,'Récompense '+option.id,tradeRewardText(option),undefined,choice),presentation:'plain',compact:true});
  }
  if(ongoing){
   const go=async(fresh:NativeUiState,groupId?:number)=>{
    const callbacks=host,anchor=narrativeIdentity(fresh);if(!callbacks)return;
    await callbacks.panel('world');const now=callbacks.readState?.()??latest;
    if(now&&now.panel==='world'&&narrativeIdentity(now)===anchor)focusNativeTradeRequestDestination(now,callbacks,id,groupId);
   };
   const liveDestination=!!(!request.destinationLost&&source.worldFactions?.settlements.some(entry=>entry.id===request.settlementId&&entry.tile===request.tile&&entry.factionId===request.factionId)&&(offered||request.status==='accepted'&&(request.expiresAtCore??-1)>source.tick*10));
   target.push({...narrativeFact('trade-request-'+id+'-delivery','Livraison',request.destinationLost?'La destination a disparu ; la livraison est indisponible.':'Biens dans les inventaires de la caravane : frais, de qualité normale ou meilleure si applicable, vêtements non souillés. La récompense suit la livraison complète.'),controls:liveDestination&&source.planet?[narrativeButton('trade-request-'+id+'-destination','Voir la destination',fresh=>go(fresh),{icon:'monde'})]:undefined});
   for(const group of nativeTradeRequestVisitors(source,request))target.push({...narrativeFact(`trade-request-${id}-group-${group.id}`,'Caravane présente',groupDisplayLabel(group),'Ouvrir les actions de cet inventaire réel, où les marchandises admissibles sont vérifiées.'),controls:[narrativeButton(`trade-request-${id}-group-${group.id}-open`,'Ouvrir la caravane',fresh=>go(fresh,group.id),{icon:'haul'})]});
  }
  if(request.status==='succeeded'&&request.fulfillment){
   const receipt=request.fulfillment,goodwill=receipt.goodwill;
   target.push(narrativeHeading(`trade-request-${id}-receipt`,'Reçu de livraison'),narrativeFact(`trade-request-${id}-receipt-group`,'Caravane n° '+receipt.groupId,`${receipt.consumed.reduce((sum,pile)=>sum+pile.quantity,0)} unités remises`,questAgo(source.tick-Math.floor(receipt.atCore/10))),
    ...receipt.delivered.map(pile=>narrativeFact(`trade-request-${id}-received-${pile.id}`,`${pile.quantity} ${ITEM_DEFINITIONS[pile.item].label}`,pile.quality?QUALITY_LABELS[pile.quality]:undefined,`Lot n° ${pile.id} reçu par le porteur n° ${pile.pawnId}.`)),
    narrativeFact(`trade-request-${id}-receipt-goodwill`,'Relations appliquées',`${goodwill.before} → ${goodwill.afterReward}`,`Après le bonus : ${goodwill.afterBonus} ; récompense demandée ${goodwill.rewardRequested}.`));
  }
  add('trade-request-'+id,request.status==='offered'?'available':request.status==='accepted'?'active':'history','Demandes commerciales',target);
 }
 for(const site of source.worldSites263?.entries??[]){
  if(site.kind==='peace-talks'){const facts=peaceTalksFacts293(source,site);add('peace-'+site.id,facts.active?'active':'history','Pourparlers diplomatiques',[{...row('peace-'+site.id,facts.title,facts.status,facts.destination+' '+facts.body,[narrativeButton('peace-'+site.id+'-world','Monde',()=>host?.panel('world'))]),presentation:'plain',compact:true}]);}
  const paid=nativePaidAiSiteFacts298(site,effectiveCore297(source));if(paid&&site.kind==='item-stash')add('paid-ai-site-'+site.id,site.closed?'history':'active','Informations de sites acquises',[{...row('paid-ai-site-'+site.id,paid.title,'Case '+site.tile+' · '+paid.status,paid.deadline+'. '+paid.detail,[narrativeButton('paid-ai-site-'+site.id+'-world','Inspecter sur le globe',async()=>{await host?.panel('world');focusNativePaidAiSite298(site.id);})]),presentation:'plain',compact:true},narrativeFact('paid-ai-site-'+site.id+'-risk','Risque',paid.risk)]);
 }
 add('arrivals','available','Arrivées et départs',nativeArrivalRows(state,host!),!state.world?.arrivals?.pending);
 const counts:Record<QuestTab,number>={available:0,active:0,history:0};
 for(const entry of entries)counts[entry.tab]++;
 const previous=entries.find(entry=>entry.id===narrativeView.questSelected);
 // When a selected quest is accepted or concludes, follow it to its new
 // tab. An explicit tab switch clears the selection instead.
 if(previous&&narrativeView.questTab&&previous.tab!==narrativeView.questTab)narrativeView.questTab=previous.tab;
 const tab=narrativeView.questTab??(counts.available?'available':counts.active?'active':counts.history?'history':'available');
 if(entries.length)narrativeView.questTab=tab;
 const needle=colonistSearchText(narrativeView.questSearch.trim()),visible=entries.filter(entry=>entry.tab===tab&&(!needle||colonistSearchText([entry.kind,...entry.rows.flatMap(row=>[row.label,row.value??'',row.detail??''])].join(' ')).includes(needle)));
 const retained=visible.find(entry=>entry.id===narrativeView.questSelected);
 const selected=retained&&(!retained.auxiliary||narrativeView.questSelectionExplicit)?retained:visible.find(entry=>!entry.auxiliary)??visible[0];
 if(selected?.id!==narrativeView.questSelected)narrativeView.questSelectionExplicit=false;
 narrativeView.questSelected=selected?.id;
 rows.push({id:'quests-tabs',label:'',region:'toolbar',controlStyle:'tab',controls:([['available','Disponibles'],['active','Actives'],['history','Historique']] as const).map(([kind,label])=>
  narrativeButton(kind==='history'?'quests-history-toggle':'quests-tab-'+kind,`${label} (${counts[kind]})`,()=>{narrativeView.questTab=kind;narrativeView.questSelected=undefined;narrativeView.questSelectionExplicit=false;back();},{active:kind===tab}))});
 rows.push({id:'quests-search',label:'',region:'toolbar',hint:`${visible.length} / ${counts[tab]} quête(s)`,input:{value:narrativeView.questSearch,placeholder:'Rechercher…',maxLength:120,
  onCommit:narrativeGuard((_state,value:string)=>{narrativeView.questSearch=value;narrativeView.questSelected=undefined;narrativeView.questSelectionExplicit=false;back();})}});
 for(const entry of visible){
  const primary=entry.rows[0]!;
  rows.push({id:'quests-entry-'+entry.id,label:'',region:'navigation',controlStyle:'button',controls:[
   narrativeButton('quests-select-'+entry.id,primary.label,()=>{narrativeView.questSelected=entry.id;narrativeView.questSelectionExplicit=true;back();},
    {active:selected?.id===entry.id,hint:[entry.kind,primary.label,primary.value].filter(Boolean).join(' · ')})]});
 }
 if(!visible.length)rows.push({...narrativeFact('quests-empty-list',needle?'Aucune quête ne correspond à la recherche.':'Aucune quête dans cette liste.'),region:'navigation'});
 if(selected)rows.push({...narrativeHeading('quests-kind',selected.kind),region:'details'},...selected.rows.map(row=>({...row,region:'details' as const})));
 else rows.push({...narrativeFact('quests-empty-selected','Aucune quête sélectionnée.'),region:'details'});
 const navigationKey=JSON.stringify([narrativeIdentity(state),tab,narrativeView.questSearch]);
 return {id:'quests',title:'Quêtes',layout:'quests',width:NATIVE_QUESTS.width,height:NATIVE_QUESTS.height,navigationKey,
  contentKey:JSON.stringify([navigationKey,selected?.id]),rows,onClose:()=>void host?.panel(null)};
}

const menuView={identity:'',legacy:false,copies:false};
function menuPanel(state:NativeUiState,actions:NativeUiActions):NativePage {
 const identity=narrativeIdentity(state);if(menuView.identity!==identity){menuView.identity=identity;menuView.legacy=false;menuView.copies=false;}
 const world=state.world,legacy:NativeRow[]=[],rows:NativeRow[]=[];
 const compact=(id:string,label:string,controls?:NativeControl[],detail?:string):NativeRow=>({...row(id,label,undefined,detail,controls),presentation:'plain',compact:true});
 const menuAction=(id:string,label:string,run:(fresh:NativeUiState)=>void|Promise<unknown>,disabled=false):NativeControl=>narrativeButton(id,label,run,{disabled});
 if(world){
  if(!world.climate)legacy.push(compact('legacy-climate','Saisons et météo',[menuAction('legacy-climate-adopt','Activer les saisons',fresh=>{if(fresh.world&&!fresh.world.climate)return send({type:'climate-adopt'});},state.busy)],'Activation prospective à l’heure actuelle ; aucune croissance passée ajoutée.'));
  if(!world.raids)legacy.push(compact('legacy-raids','Raids du camp',[menuAction('legacy-raids-adopt','Activer les raids',fresh=>{if(fresh.world&&!fresh.world.raids)return send({type:'enable-raids'});},state.busy)],'Calendrier historique : première attaque dans 3,5 à 4 jours, puis 6 à 8 jours après chaque issue.'));
  if(!world.raids?.mechanoid||world.schemaVersion>=197&&!world.raids.mechanoid.ranged)legacy.push(compact('legacy-mech-raids','Raids mécaniques futurs',[menuAction('legacy-mech-adopt','Admettre les raids mécaniques futurs',fresh=>{const value=fresh.world;if(value&&value.schemaVersion>=194&&value.raids?.profile==='cassandra-raids-v1'&&(!value.raids.mechanoid||value.schemaVersion>=197&&!value.raids.mechanoid.ranged))return send({type:'enable-mech-raids'});},state.busy||world.schemaVersion<194||world.raids?.profile!=='cassandra-raids-v1')],'Concurrence prospective aux occasions Cassandra à partir du jour 45. Aucun raid créé maintenant.'));
  if(!world.gameProfile&&!world.heatwaves)legacy.push(compact('legacy-heatwaves','Canicules du camp',[menuAction('legacy-heatwaves-adopt','Activer les canicules',fresh=>{if(fresh.world&&!fresh.world.gameProfile&&!fresh.world.heatwaves)return send({type:'enable-heatwaves'});},state.busy)],'Calendrier historique : première canicule dans 6 à 7 jours, sans exposition passée.'));
 }
 rows.push({...compact('menu-game','',[
  menuAction('menu-save','Sauvegarder',fresh=>{if(fresh.hasGame&&!fresh.fault)return host?.save();},state.busy||!state.hasGame||!!state.fault),
  menuAction('menu-load','Charger',()=>host?.front('load'),state.busy),
 ],state.fault),region:'navigation'});
 // Schema 347 tutorial: Core's ChooseStoryteller step (Options, storyteller
 // settings) hands the game to a real storyteller and ends the tutorial.
 if(world&&tutorialMode347(world))rows.push(compact('menu-storyteller','Narrateur : Tuteur (tutoriel)',[
  menuAction('menu-choose-storyteller','Choisir Cassandra Classique · Récit d’aventure',fresh=>{if(fresh.world&&tutorialMode347(fresh.world))return send({type:'choose-storyteller',storyteller:'cassandra-partial',difficulty:'adventure-story'});},state.busy),
 ],'Pendant le tutoriel, aucun incident ni alerte, difficulté Bâtisseur de communauté. Choisir le narrateur termine le tutoriel : raids, visiteurs, maladies et autres événements commencent à partir de maintenant.'));
 const saved=state.saves,named=saved.filter(save=>save.kind==='named').length,automatic=saved.filter(save=>save.kind==='auto').length;
 rows.push(compact('menu-saves','Sauvegardes',[
  ...(actions.openSaveManager?[menuAction('native-manage-saves','Gérer les sauvegardes',()=>host?.openSaveManager?.(),state.busy)]:[]),
  menuAction('menu-copies-toggle',menuView.copies?'Masquer les copies':'Copies disponibles ('+saved.length+')',()=>{menuView.copies=!menuView.copies;back();},state.busy),
 ],String(named)+' nommée'+(named===1?'':'s')+' · '+automatic+' automatique'+(automatic===1?'':'s')+' · '+saved.length+' copies au total.'));
 if(menuView.copies){
  if(!saved.length)rows.push(compact('menu-copies-empty','Aucune copie disponible.'));
  for(const save of saved)rows.push({...row('menu-save-'+save.key,save.label,({manual:'Manuelle',recovery:'Colonie précédente',named:'Nommée',auto:'Automatique'} as const)[save.kind],save.detail),presentation:'plain',compact:true});
 }
 if(actions.openOptions)rows.push({...compact('native-menu-details','',[menuAction('native-options','Options',()=>host?.openOptions?.(),state.busy)]),region:'navigation'});
 rows.push(compact('menu-extra','Autres commandes',[
  menuAction('menu-export','Exporter',fresh=>{if(fresh.hasGame&&!fresh.fault)return host?.exportSave();},state.busy||!state.hasGame||!!state.fault),
  ...(actions.openHelp?[menuAction('native-help','Aide',()=>host?.openHelp?.(),state.busy)]:[]),
 ]));
 const exchanges:NativeControl[]=[
  ...(actions.openVisitorTrade?[menuAction('native-visitor-trade','Visiteurs et commerce',()=>host?.openVisitorTrade?.(),state.busy)]:[]),
  ...(actions.openOrbitalTrade?[menuAction('native-orbital-trade','Commerce orbital',()=>host?.openOrbitalTrade?.(),state.busy)]:[]),
  ...(world&&world.schemaVersion>=298&&isCorePhysicalSchema297(world.schemaVersion)&&actions.openFactionComms298?[menuAction('native-faction-comms298','Communications de faction',()=>host?.openFactionComms298?.(),state.busy)]:[]),
 ];
 if(exchanges.length)rows.push(compact('native-menu-trade','Échanges',exchanges));
 rows.push({...compact('menu-new','',[
  menuAction('menu-create','Nouvelle colonie',()=>host?.front('create'),state.busy),
  menuAction('menu-home','Accueil',()=>host?.front('home'),state.busy),
 ]),region:'navigation'});
 if(legacy.length){
  rows.push(compact('menu-legacy','Anciennes parties',[
   {...menuAction('menu-legacy-toggle',menuView.legacy?'Masquer les réglages historiques':'Réglages historiques ('+legacy.length+')',()=>{menuView.legacy=!menuView.legacy;back();},state.busy),glyph:menuView.legacy?'collapse':'expand'},
  ],'Activations prospectives des anciens formats ; aucune activation au simple dépliage.'));
  if(menuView.legacy)rows.push(...legacy);
 }
 const close=narrativeGuard(()=>host?.panel(null));
 return {id:'menu',title:'Menu',contentKey:identity,layout:'menu',width:NATIVE_MENU.width,height:NATIVE_MENU.height,rows,actions:[
  menuAction('menu-resume','Reprendre',fresh=>{if(!fresh.fault)return host?.panel(null);},state.busy||!!state.fault),
 ],onClose:close};
}


/** Refresh confirmed readers while an owned native editor keeps its draft. */
/** A genuine window close discards its local view, not orders already sent,
 * copied schedules, world facts, or the currently armed map tool. */
export function resetNativePanelSession(panel:NativeUiState['panel']):void{
 if(!panel)return;panelSessionRevision++;
 switch(panel){
  case 'history':Object.assign(narrativeView,{historySearch:'',historyAll:false,historyPinnedOnly:false,historyTab:'messages',historySelected:undefined,historyShowLetters:true,historyShowMessages:true});break;
  case 'quests':Object.assign(narrativeView,{questTab:undefined,questSelected:undefined,questSearch:'',questSelectionExplicit:false});narrativeView.tradeChoices.clear();break;
  case 'menu':menuView.legacy=menuView.copies=false;break;
  case 'work':colonistTableSearches.work='';workSort=undefined;break;
  case 'assign':colonistTableSearches.assign='';break;
  case 'schedule':colonistTableSearches.schedule='';scheduleBrush='anything';break;
  case 'animals':case 'wildlife':Object.assign(animalTableViews[panel],{search:'',filter:'all',sort:'name',descending:false});break;
  case 'research':resetNativeResearch();break;
  case 'world':resetNativeWorldSession();break;
 }
}
export function syncNativePanelState(state:NativeUiState,actions:NativeUiActions):void {
 latest=state;host=actions;
 syncNativeWorldState(state,actions);
 const source=state.world??state.campaign,identity=state.world?`${state.world.seed}:${state.world.width}:${state.world.height}`:state.campaign?`campaign:${state.campaign.campaignSeed}`:'none';
 if(identity!==lastIdentity||(source&&source.tick<lastTick)){resetNativeResearch();scheduleClipboard=undefined;lastIdentity=identity;}
 lastTick=source?.tick??-1;
}
/** Builds data for native meshes. It never reads a legacy control or emits HTML. */
function buildNativePanelContent(state:NativeUiState,actions:NativeUiActions):NativePage|null {
 syncNativePanelState(state,actions);
 if(state.panel===null)return null;
 if(state.panel==='menu')return menuPanel(state,actions);
 if(state.panel==='history')return historyPanel(state);
 if(state.panel==='quests')return questsPanel(state);
 if(state.panel==='world')return buildNativeWorld(state,actions);
 const world=state.world;
 if(!world)return {id:'no-local-map',title:'Carte locale nécessaire',rows:[row('no-local-map-message','Cette campagne n’a pas de carte locale active.')],onClose:()=>void actions.panel(null)};
 switch(state.panel){
  case 'architect':return architect(state,actions,world);
  case 'work':return workPanel(world);
  case 'schedule':return schedulePanel(world);
  case 'assign':return assignPanel(world);
  case 'animals':return animalsPanel(world);
  case 'wildlife':return wildlifePanel(state,world);
  case 'research':return buildNativeResearch(world,{...actions,command:send},redraw);
 }
}
export function buildNativePanel(state:NativeUiState,actions:NativeUiActions):NativePage|null {
 const page=buildNativePanelContent(state,actions);
 return page?liveNativePage({...page,textEntities:page.textEntities??nativeTextEntitiesFor(state.world,state.campaign)},state,
  (next,callbacks)=>next.panel===state.panel?buildNativePanel(next,callbacks):null):null;
}
