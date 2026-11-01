import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {READING_POLICIES_295,effectiveReadingPolicy295} from '../sim/reading-state-295';
import type {NativeUiState,NativeUiActions,NativePage,NativeRow,NativeControl} from './native-contract';
import {buildNativeWorld,syncNativeWorldState,nativePaidAiSiteFacts298,focusNativePaidAiSite298} from './native-world';
import {effectiveCore297} from '../sim/core-phase-297';
import {nativeArrivalRows} from './native-arrivals';
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
import {TRAITS} from '../sim/traits';
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
import {effectiveDrugPolicies265,type BeerPolicy265} from '../sim/alcohol-policy-265';
import {APPAREL,type ApparelItem} from '../sim/apparel-rules';
import {APPAREL_POLICY_MATERIALS267,apparelPolicyMaterialLabel267} from '../sim/apparel-policy';
import {WEAPON_QUALITIES,QUALITY_LABELS,type WeaponQuality} from '../sim/equipment-rules';
import {tradeRequestContent284} from '../sim/trade-request-content-284';
import {worldSettlementAccess256} from '../sim/world-faction-access';
import {peaceTalksFacts293} from '../ui/peace-talks-293';
import {constructionMaterials} from '../sim/construction-materials';
import {createNativeStorageEditor} from './native-storage-editor';
import {registeredMapId} from '../sim/world-map-context';

/** Native drafts only. Confirmed World objects are borrowed and never edited. */
let latest:NativeUiState|undefined;
let host:NativeUiActions|undefined;
let scheduleBrush:ScheduleAssignment='anything';
let scheduleClipboard:ScheduleAssignment[]|undefined;
let lastIdentity='',lastTick=-1;
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
function nativeToolControl(tool:(typeof toolDefinitions)[number],state:NativeUiState,actions:NativeUiActions):NativeControl {
 return button(`tool-${tool.id}-select`,tool.title,()=>actions.tool(tool.id),{
  icon:tool.id,caption:tool.key||undefined,hint:`${tool.title}${tool.key?` · ${tool.key}`:''}\n${tool.hint}`,active:state.tool===tool.id,
 });
}
function architect(state:NativeUiState,actions:NativeUiActions,world:World):NativePage {
 const category=state.category==='orders'||state.category==='zones'?'structure':state.category;
 const tools=toolDefinitions.filter(tool=>tool.category===category&&architectToolAvailable(world,tool.id));
 if(category==='production')tools.sort((a,b)=>{const ai=productionToolOrder.indexOf(a.id),bi=productionToolOrder.indexOf(b.id);return (ai<0?productionToolOrder.length:ai)-(bi<0?productionToolOrder.length:bi);});
 const selected=tools.find(tool=>tool.id===state.tool),materials=selected?constructionMaterials(selected.id):[];
 const rows:NativeRow[]=[
  {id:'architect-categories',label:'',region:'navigation',controlStyle:'navigation',controls:categories.filter(([id])=>architectCategoryAvailable(world,id)).map(([id,label])=>button(`category-${id}`,label,()=>{actions.category(id);redraw();},{icon:id,hint:`${label}\nAfficher les constructions de cette catégorie.`,active:id===category}))},
  {id:'architect-tools',label:'',region:'catalogue',controlStyle:'tile',controls:tools.map(tool=>nativeToolControl(tool,state,actions))},
 ];
 if(selected){
  rows.push({...row('architect-selected',selected.title,undefined,selected.hint),region:'details',emphasis:'heading'});
  if(materials.length>1)rows.push({...row('architect-material','Matériau',undefined,undefined,[button(`tool-${selected.id}-material`,ITEM_DEFINITIONS[state.constructionMaterial].label,()=>{}, {hint:'Matériau de la construction sélectionnée',select:{value:state.constructionMaterial,options:materials.map(material=>({value:material,label:ITEM_DEFINITIONS[material].label})),onChange:value=>{const material=materials.find(item=>item===value);if(material)actions.material(material);}}})]),region:'details',compact:true});
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
 const skill=work==='mine'?miningSkill(pawn):work==='grow'||work==='gather'?plantSkill(pawn):work==='cook'?cookingSkill(pawn):work==='art'?artisticSkill(pawn):work==='handle'?pawn.skills.animals??zero:work==='warden'?pawn.skills.social??zero:work==='doctor'?pawn.skills.medicine:work==='build'?pawn.skills.construction:work==='hunt'?pawn.skills.shooting??zero:work==='craft'?pawn.skills.crafting??zero:work==='research'?pawn.skills.intellectual??zero:undefined;
 if(!skill)return {};
 const label=work==='mine'?'Minage':work==='grow'||work==='gather'?'Plantes':work==='cook'?'Cuisine':work==='art'?'Artistique':work==='handle'?'Animaux':work==='warden'?'Social':work==='doctor'?'Médecine':work==='hunt'?'Tir':work==='craft'?'Artisanat':work==='research'?'Intellectuel':'Construction';
 const stats=work==='mine'?`vitesse ${Math.round(miningWorkSpeed(pawn)*100)} % avant lumière · rendement minéral ${Math.round(miningYield(pawn)*100)} % ; moyenne pondérée par les dégâts des coups sur le gisement`:work==='grow'||work==='gather'?`vitesse ${Math.round(plantWorkSpeed(pawn)*100)} % avant lumière · semis, récolte et abattage`:work==='cook'?`cuisson ${Math.round(cookingSpeed(pawn)*100)} % · rendement de boucherie ${Math.round(butcheryEfficiency(pawn)*100)} % avant poste`:work==='art'?'qualité des sculptures, sans effet direct sur la vitesse':work==='handle'?'Apprivoisement et entretien des lièvres · niveau Animaux 8 requis':work==='warden'?'nourrit les prisonniers et mène les conversations selon le mode choisi':work==='build'?`vitesse ${Math.round(constructionSpeed(pawn)*100)} % · apprentissage ${Math.round(learningFactor(skill,pawn)*100)} %`:`apprentissage ${Math.round(learningFactor(skill,pawn)*100)} %`;
 return {caption:`${skill.level}${' ♨'.repeat(skill.passion)}`,hint:`${label} ${skill.level}/20 · ${passionLabels[skill.passion]} · ${stats}`};
}
function workPanel(world:World):NativePage {
 const pawns=world.pawns.filter(p=>isColonist(p)&&!p.prisoner);
 return {id:'work',title:'Travail',layout:'table',subtitle:'Priorités manuelles : 1 haute · 4 basse · 0 désactivée. Le transport livre aussi les chantiers.',width:14.8,rows:[
  {id:'work-headings',label:'Colon',value:'Activité',compact:true,columns:workColumns.map(c=>({label:c.label,hint:c.label}))},
  ...pawns.map(pawn=>({...row(`worker-${pawn.id}`,pawn.name,host?.pawnActivity?.(pawn.id)??queryPawnStatus(world,pawn).reason,pawn.traits?.map(id=>TRAITS[id].label).join(' · ')??'Aucun trait attribué',workColumns.map(({id,label})=>{
   const refusal=backgroundWorkRefusal(pawn,id),value=pawn.priorities[id],skill=workSkill(pawn,id);
   return button(`work-${pawn.id}-${id}`,String(value),()=>{},{caption:skill.caption,hint:[`Priorité ${label} · ${pawn.name}`,refusal?`${refusal} Priorité enregistrée : ${value}. Un ordre direct ne permet pas de contourner cette incapacité.`:undefined,skill.hint].filter(Boolean).join('\n'),disabled:!!refusal||pawn.state==='dead',active:value===1,select:{value:String(value),options:[0,1,2,3,4].map(priority=>({value:String(priority),label:String(priority),hint:priority===0?'Désactivé':`Priorité ${priority}${priority===1?' · haute':priority===4?' · basse':''}`})),onChange:value=>{const priority=Number(value);if(!Number.isInteger(priority)||priority<0||priority>4)throw Error('Priorité entière de 0 à 4 requise.');return send({type:'priority',pawnId:pawn.id,work:id,value:priority});}}});
  })),compact:true})),
 ],onClose:()=>void host?.panel(null)};
}
const assignmentColors:Record<ScheduleAssignment,string>={anything:'#e9d2a9',work:'#dfb7a4',sleep:'#c2d5e0',recreation:'#c9dfc1'};
function schedulePanel(world:World):NativePage {
 const hour=hourOfDay(calendarTick(world));
 const rows:NativeRow[]=[{...row('schedule-brush','Activité à peindre',undefined,'Choisir une activité puis cliquer ou glisser sur les heures. Temps libre : le colon gère ses besoins et son travail. Dormir exige un couchage accessible ; travailler permet toujours de manger.',(Object.keys(assignmentLabels) as ScheduleAssignment[]).map(id=>button(`brush-${id}`,assignmentLabels[id],()=>{scheduleBrush=id;redraw();},{color:assignmentColors[id],active:scheduleBrush===id}))),compact:true},
  {id:'schedule-headings',label:'Colon',compact:true,columns:[...Array.from({length:24},(_,h)=>({label:String(h),hint:`${h} h – ${h+1} h${h===hour?' · heure actuelle':''}`})),{label:'Copier'},{label:'Coller'}]},
 ];
 for(const pawn of world.pawns.filter(isColonist)){
  rows.push({...row(`schedule-${pawn.id}`,pawn.name,undefined,undefined,[...Array.from({length:24},(_,h)=>{
   const assignment=pawn.schedule[h]??'anything';
   return button(`hour-${pawn.id}-${h}`,assignmentSymbols[assignment],()=>send({type:'schedule-paint',pawnId:pawn.id,hours:[h],assignment:scheduleBrush}),{hint:`${pawn.name} · ${h} h – ${h+1} h : ${assignmentLabels[assignment]}`,color:assignmentColors[assignment],active:h===hour,disabled:pawn.state==='dead',paint:{group:`schedule-${pawn.id}`,index:h,onPaint:indices=>{const hours=[...new Set(indices)].filter(value=>Number.isInteger(value)&&value>=0&&value<24);if(hours.length)return send({type:'schedule-paint',pawnId:pawn.id,hours,assignment:scheduleBrush});}}});
  }),button(`copy-${pawn.id}`,'Copier',()=>{scheduleClipboard=[...currentPawn(pawn.id).schedule];redraw();},{hint:`Copier les 24 heures de ${pawn.name}`}),button(`paste-${pawn.id}`,'Coller',()=>send({type:'schedule-replace',pawnId:pawn.id,assignments:[...scheduleClipboard!]}),{disabled:!scheduleClipboard||pawn.state==='dead',hint:`Coller les 24 heures chez ${pawn.name}`})]),compact:true});
 }
 rows.push({...row('schedule-profile',world.restRules==='legacy'?'Sauvegarde historique : ancienne vitesse de fatigue conservée. Les horaires sont modifiables.':'Profil adulte : repos nocturne de 22 h à 6 h par défaut. Le sommeil peut continuer en plage libre jusqu’à récupération complète.'),compact:true});
 rows.push({...row('schedule-help','La plage indique une priorité, pas un ordre instantané.',undefined,'Tab parcourt les cases, Entrée ou Espace peint ; Échap annule le tracé. Loisir favorise les activités accessibles sous 95 % de satisfaction ; temps libre sous 35 %. Répéter la même famille crée de la lassitude.'),compact:true});
 return {id:'schedule',title:'Planning',layout:'table',rows,width:14.8,onClose:()=>void host?.panel(null)};
}
function animalArea(id:number):void {
 const world=currentWorld(),animal=currentAnimal(id),current=currentAnimalAreaChoice287(world,animal);
 const choices:{id:string;label:string;choice:AnimalAreaChoice287|null}[]=[{id:'unrestricted',label:'Sans restriction',choice:null},{id:'home',label:'Zone de foyer',choice:{kind:'home'}},...(world.allowedAreas??[]).map(area=>({id:`area-${area.id}`,label:area.label,choice:{kind:'allowed' as const,areaId:area.id}}))];
 choose(`animal-area-${id}`,'Zone autorisée',choices.map(choice=>({id:choice.id,label:choice.label,active:JSON.stringify(current)===JSON.stringify(choice.choice),choose:()=>send({type:'animal-area-assign',animalId:id,choice:choice.choice})})));
}
function animalDetails(id:number):void {
 const world=currentWorld(),animal=currentAnimal(id),species=animalSpecies(animal.species),name=actualAnimalName256(animal)??`${species.label} ${animal.id}`;
 const rows:NativeRow[]=[row('animal-state','État',animalActivity(world,animal)),row('animal-age','Âge',`${(animal.ageTicks/(TICKS_PER_DAY*60)).toLocaleString('fr-FR',{maximumFractionDigits:2})} an · ${stageLabels[animalLifeStage(animal)]}`),row('animal-food','Nourriture',`${Math.round(100*animal.food/animalNutritionMax(animal))} %`),row('animal-mobility','Mobilité',`${Math.round(100*animalBody(animal).capacities.moving)} %`),row('animal-position','Position',`${animal.x}, ${animal.z}`)];
 if(animal.pregnancy)rows.push(row('animal-pregnancy','Gestation',`${Math.round(100*animal.pregnancy.progress/gestationTicks(animal.species))} %`));
 if(animal.domestic){
  rows.push(row('animal-care','Soins',MEDICAL_CARE[animal.domestic.care],undefined,[button('animal-care-choose','Choisir',()=>choose(`animal-care-${id}`,'Politique médicale',(Object.keys(MEDICAL_CARE) as MedicalCare[]).map(care=>({id:care,label:MEDICAL_CARE[care],active:currentAnimal(id).domestic?.care===care,choose:()=>send({type:'animal-care-policy',animalId:id,care})}))))]));
  if(world.schemaVersion>=287&&supportsAnimalAreas287(animal.species))rows.push(row('animal-area','Zone autorisée',animalAreaLabel(world,animal),undefined,[button('animal-area-edit','Choisir',()=>animalArea(id))]));
  if(world.schemaVersion>=282)for(const skill of ['obedience','haul'] as const){const training=readAnimalTraining282(animal,skill),refusal=trainingRefusal282(world,animal,skill);rows.push(row(`training-${skill}`,skill==='haul'?'Transport':'Obéissance',`${training.steps}/${training.maxSteps}${training.learned?' · acquis':''}`,refusal??'Les leçons exigent un dresseur, la nourriture et les prérequis physiques.',[button(`training-${skill}-toggle`,training.wanted?'Demandé':'Demander',()=>send({type:'animal-training',animalId:id,skill,wanted:!readAnimalTraining282(currentAnimal(id),skill).wanted}),{active:training.wanted,disabled:!!refusal})]));}
 }
 open(detailPage(`animal-${id}`,name,rows,[button('animal-locate','Repérer',()=>host?.selectPawn(id))]));
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
function animalsPanel(world:World):NativePage {
 const animals=world.wildlife?.animals.filter(a=>!!a.domestic&&a.state!=='dead')??[],targets=autoSlaughterTargets(world);
 const rows:NativeRow[]=[{id:'animals-headings',label:'Animal',value:'Âge · activité',compact:true,columns:['Repérer','Dossier','Abattage','Transport','Zone'].map(label=>({label}))},...animals.map((animal):NativeRow=>{
  const product=productKind(animal),refusal=slaughterRefusal(world,animal),training=readAnimalTraining282(animal,'haul');
  const controls=[button(`animal-${animal.id}-locate`,'Repérer',()=>host?.selectPawn(animal.id)),button(`animal-${animal.id}-details`,'Dossier',()=>animalDetails(animal.id)),button(`animal-${animal.id}-slaughter`,animal.domestic!.slaughter?'Abattage demandé':'Abattre',()=>send({type:'slaughter',animalId:animal.id,enabled:!currentAnimal(animal.id).domestic?.slaughter}),{active:!!animal.domestic!.slaughter,disabled:!!refusal&&!animal.domestic!.slaughter,hint:refusal})];
  if(world.schemaVersion>=282)controls.push(button(`animal-${animal.id}-haul`,training.wanted?'Transport demandé':'Entraîner',()=>send({type:'animal-training',animalId:animal.id,skill:'haul',wanted:!readAnimalTraining282(currentAnimal(animal.id),'haul').wanted}),{active:training.wanted,disabled:!!trainingRefusal282(world,animal,'haul'),hint:trainingRefusal282(world,animal,'haul')??`${training.steps}/${training.maxSteps}`}));
  if(world.schemaVersion>=287&&supportsAnimalAreas287(animal.species))controls.push(button(`animal-${animal.id}-area`,'Zone',()=>animalArea(animal.id)));
  const identity=actualAnimalName256(animal)??`${animalSpecies(animal.species).label} ${animal.id}`;
  const age=`${animal.sex==='female'?'♀':'♂'} · ${(animal.ageTicks/(TICKS_PER_DAY*60)).toLocaleString('fr-FR',{maximumFractionDigits:2})} an · ${stageLabels[animalLifeStage(animal)]}`;
  const facts=[animalActivity(world,animal,targets),animalAreaLabel(world,animal),MEDICAL_CARE[animal.domestic!.care],product?`${product==='milk'?'Lait':'Laine'} ${Math.round(100*productFullness(animal))} %`:'',animal.pregnancy?`Gestation ${Math.round(100*animal.pregnancy.progress/gestationTicks(animal.species))} %`:''].filter(Boolean).join(' · ');
  const ordered=['locate','details','slaughter','haul','area'].map(action=>controls.find(control=>control.id===`animal-${animal.id}-${action}`)??button(`animal-${animal.id}-${action}-unavailable`,'—',()=>{},{disabled:true,hint:'Indisponible dans cette partie ou pour cette espèce.'}));
  return {...row(`animal-${animal.id}`,identity,`${age} · ${animalActivity(world,animal,targets)}`,undefined,ordered.map(control=>({...control,hint:[control.hint,identity,age,facts].filter(Boolean).join('\n')}))),compact:true,presentation:'record',hint:[identity,age,facts].join('\n')};
 })];
 if(!animals.length)rows.push(row('animals-empty','Aucun animal domestique.'));
 if(world.schemaVersion>=228){rows.push({id:'animals-quotas-heading',label:'Abattage automatique',emphasis:'heading',presentation:'plain'});for(const species of AUTO_SLAUGHTER_SPECIES){const c=autoSlaughterCounts(world,species),config=world.autoSlaughter?.find(c=>c.species===species)??defaultAutoSlaughterConfig(species);rows.push({...row(`quota-${species}`,animalSpecies(species).label,`${c.total} animaux · limite ${config.maxTotal<0?'∞':config.maxTotal}`,`Adultes ${c.males} ♂ / ${c.females} ♀ · jeunes ${c.malesYoung} ♂ / ${c.femalesYoung} ♀ · gestantes ${c.pregnant}`,[button(`quota-${species}-edit`,'Quotas',()=>quotaEditor(species))]),presentation:'record'});}}
 return {id:'animals',title:'Animaux',layout:'table',rows,width:11.4,onClose:()=>void host?.panel(null)};
}
function wildlifePanel(state:NativeUiState,world:World):NativePage {
 const animals=world.wildlife?.animals.filter(a=>!a.domestic&&knownPosition256(world,a))??[];
 const rows:NativeRow[]=[];
 if(!world.wildlife)rows.push(row('wildlife-enable','Partie historique',undefined,'Introduire la faune adopte le circuit existant.',[button('enable-wildlife','Introduire la faune',()=>send({type:'enable-wildlife'}))]));
 for(const animal of animals){const hunted=world.hunting?.targets.includes(animal.id)??false;const drafted=state.selectedPawnIds.length>0&&state.selectedPawnIds.every(id=>world.pawns.some(p=>p.id===id&&isColonist(p)&&!p.prisoner&&p.draft&&p.state!=='dead'&&p.state!=='downed'));
  const controls=[button(`wildlife-${animal.id}-focus`,'Repérer',()=>host?.selectPawn(animal.id)),button(`wildlife-${animal.id}-hunt`,hunted?'Chasse désignée':'Chasser',()=>send({type:'hunt',animalId:animal.id,enabled:!currentWorld().hunting?.targets.includes(animal.id)}),{active:hunted,disabled:animal.state==='dead'})];
  if(canTameSpecies(animal.species))controls.push(button(`wildlife-${animal.id}-tame`,animal.taming?.designated?'Apprivoisement demandé':'Apprivoiser',()=>send({type:'tame',animalId:animal.id,enabled:!currentAnimal(animal.id).taming?.designated}),{active:!!animal.taming?.designated,disabled:animal.state==='dead'}));
  controls.push(button(`wildlife-${animal.id}-shoot`,'Tirer',()=>send({type:'shoot',pawnIds:[...(latest?.selectedPawnIds??[])],targetId:animal.id}),{disabled:!drafted||animal.state==='dead'}),button(`wildlife-${animal.id}-melee`,'Mêlée',()=>send({type:'melee',pawnIds:[...(latest?.selectedPawnIds??[])],targetId:animal.id}),{disabled:!drafted||animal.state==='dead'}));
  rows.push({...row(`wildlife-${animal.id}`,actualAnimalName256(animal)??`${animalSpecies(animal.species).label} ${animal.id}`,`${animal.sex==='female'?'Femelle':'Mâle'} · ${animal.x}, ${animal.z}`,animalActivity(world,animal),controls),presentation:'record'});
 }
 if(world.wildlife&&!animals.length)rows.push(row('wildlife-empty','Aucun animal sauvage connu.'));
 return {id:'wildlife',title:'Faune',subtitle:'Les ordres de combat utilisent les colons mobilisés sélectionnés.',rows,width:7.8,onClose:()=>void host?.panel(null)};
}

function historyPanel(state:NativeUiState):NativePage {
 const source=state.world??state.campaign,rows:NativeRow[]=[];
 if(state.world){const economy=state.world.economy;if(economy){const wealth=economy.wealth,expect=expectationForWealth(wealth.knownTotal);rows.push(row('economy-total','Patrimoine évalué',`${money(wealth.knownTotal)}${wealth.complete?'':' au minimum'}`,`Relevé jour ${1+Math.floor(economy.sampledAt/TICKS_PER_DAY)} · attentes ${expect.label} (${signed(expect.moodOffset)} humeur)`),row('economy-parts','Composition',undefined,`Objets ${money(wealth.items)} · bâtiments ${money(wealth.structures)} · sols ${money(wealth.floors)}`),row('economy-coverage','Couverture',wealth.complete?'Complète':'Valeurs manquantes',`${wealth.unpricedPawnIds.length} personnes ; ${(wealth.unpricedPileIds?.length??0)+(wealth.unpricedPackedIds?.length??0)+(wealth.unpricedStructureIds?.length??0)} autres biens non évalués.`));}else rows.push(row('economy-adopt','Patrimoine',undefined,'La partie conserve ses règles historiques. Adopter le suivi part des biens présents.',[button('economy-enable','Activer le suivi économique',()=>send({type:'adopt-economy'}))]));}
 for(const fact of rows)fact.presentation='summary';
 const events=source?.events??[];for(let i=events.length-1;i>=0;i--){const event=events[i]!;rows.push({...row(`event-${i}`,`Jour ${1+Math.floor(event.tick/TICKS_PER_DAY)}`,event.message),labelWidth:72,presentation:'record'});}
 if(!events.length)rows.push(row('history-empty','Aucun événement consigné.'));
 return {id:'history',title:'Historique',rows,width:7.8,onClose:()=>void host?.panel(null)};
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
 const booleans:readonly [keyof Pick<BeerPolicy265,'allowedForAddiction'|'allowedForJoy'|'allowScheduled'>,string][]=[['allowedForAddiction','Autoriser pour dépendance'],['allowedForJoy','Autoriser pour loisir'],['allowScheduled','Prise programmée']];
 const numbers:readonly [keyof Pick<BeerPolicy265,'daysFrequency'|'onlyIfMoodBelow'|'onlyIfJoyBelow'|'takeToInventory'>,string,number,number,number][]=[['daysFrequency','Fréquence en jours',1,.1,25],['onlyIfMoodBelow','Seulement si humeur inférieure (%)',100,1,100],['onlyIfJoyBelow','Seulement si loisir inférieur (%)',100,1,100],['takeToInventory','Quantité dans l’inventaire',1,0,3]];
 const make=():NativePage=>detailPage(`drug-policy-${id}`,policy.name,[
  {id:'drug-name',label:'Nom',input:{value:name,maxLength:60,onCommit:value=>{name=value;}}},row('drug-item','Substance','Bière','Les effets passent par une consommation physique ; ce réglage ne donne aucun objet.'),
  ...booleans.map(([key,label])=>row(`drug-${key}`,label,undefined,undefined,[button(`drug-${key}-toggle`,beer[key]?'Oui':'Non',()=>{beer={...beer,[key]:!beer[key]};open(make());},{active:beer[key]})])),
  ...numbers.map(([key,label,scale,min,max]):NativeRow=>({id:`drug-${key}`,label,input:{value:String(beer[key]*scale),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||key==='takeToInventory'&&!Number.isInteger(n))throw Error(`Valeur attendue entre ${min} et ${max}.`);beer={...beer,[key]:n/scale};}}})),
 ],[button('drug-apply','Appliquer',async()=>{await send({type:'drug-policy-update',policyId:id,name,beer:{...beer}});back();}),button('drug-copy','Dupliquer',()=>inputPage(`drug-copy-${id}`,'Dupliquer',`${name} copie`,value=>send({type:'drug-policy-create',name:value,copyFromId:id}))),button('drug-default','Choisir par défaut',async()=>{await send({type:'drug-policy-default',policyId:id});back();}),button('drug-delete','Supprimer',()=>confirm(`drug-delete-${id}`,'Supprimer cette politique ?',policy.name,()=>send({type:'drug-policy-delete',policyId:id})))]);
 open(make());
}
function apparelEditor(id:number):void {
 const policy=currentWorld().apparelPolicies?.find(p=>p.id===id);if(!policy)throw Error('Cette tenue n’existe plus.');
 const items=new Set(policy.allowedItems),materials=new Set(policy.allowedMaterials);
 let minQuality=policy.minQuality,maxQuality=policy.maxQuality,minHitPointsPercent=policy.minHitPointsPercent,maxHitPointsPercent=policy.maxHitPointsPercent;
 const quality=(which:'min'|'max'):void=>choose(`quality-${which}`,'Qualité',(WEAPON_QUALITIES as readonly WeaponQuality[]).map(value=>({id:value,label:QUALITY_LABELS[value],active:value===(which==='min'?minQuality:maxQuality),choose:()=>{if(which==='min')minQuality=value;else maxQuality=value;}})),()=>open(make()));
 const make=():NativePage=>detailPage(`apparel-policy-${id}`,policy.label,[
  row('apparel-users','Utilisateurs présents',currentWorld().pawns.filter(p=>p.apparelPolicyId===id).map(p=>p.name).join(', ')||'Aucun','Appliquer modifie les filtres partagés ; les affectations, Auto et ports forcés sont indépendants.'),
  row('apparel-quality','Qualité',`${QUALITY_LABELS[minQuality]} → ${QUALITY_LABELS[maxQuality]}`,undefined,[button('apparel-min-quality','Minimum',()=>quality('min')),button('apparel-max-quality','Maximum',()=>quality('max'))]),
  {id:'apparel-min-hp',label:'PV minimum (%)',input:{value:String(minHitPointsPercent*100),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw Error('Pourcentage de 0 à 100 requis.');minHitPointsPercent=n/100;}}},
  {id:'apparel-max-hp',label:'PV maximum (%)',input:{value:String(maxHitPointsPercent*100),kind:'number',onCommit:value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw Error('Pourcentage de 0 à 100 requis.');maxHitPointsPercent=n/100;}}},
  ...(Object.keys(APPAREL) as ApparelItem[]).map(item=>row(`apparel-item-${item}`,APPAREL[item].label,undefined,undefined,[button(`apparel-item-${item}-toggle`,items.has(item)?'Autorisé':'Interdit',()=>{items.has(item)?items.delete(item):items.add(item);open(make());},{active:items.has(item)})])),
  ...APPAREL_POLICY_MATERIALS267.map(material=>row(`apparel-material-${material}`,apparelPolicyMaterialLabel267(material),undefined,undefined,[button(`apparel-material-${material}-toggle`,materials.has(material)?'Autorisée':'Interdite',()=>{materials.has(material)?materials.delete(material):materials.add(material);open(make());},{active:materials.has(material)})])),
 ],[button('apparel-apply','Appliquer',async()=>{if(WEAPON_QUALITIES.indexOf(minQuality)>WEAPON_QUALITIES.indexOf(maxQuality)||minHitPointsPercent>maxHitPointsPercent)throw Error('Le minimum dépasse le maximum.');await send({type:'apparel-policy-update',policyId:id,allowedItems:[...items],allowedMaterials:[...materials],minQuality,maxQuality,minHitPointsPercent,maxHitPointsPercent});back();}),button('apparel-copy','Copier les filtres confirmés',()=>inputPage(`apparel-copy-${id}`,'Copier la tenue',`${policy.label} copie`,label=>send({type:'apparel-policy-copy',policyId:id,label}))),button('apparel-rename','Renommer',()=>inputPage(`apparel-rename-${id}`,'Renommer la tenue',policy.label,label=>send({type:'apparel-policy-rename',policyId:id,label})))]);
 open(make());
}
function areaEditor(onBack:()=>void=back):void {
 const world=currentWorld(),returnToList=()=>areaEditor(onBack);
 const epoch=latest?.epoch,mapId=registeredMapId(world),seed=world.seed,width=world.width,height=world.height;
 const preview=(areaId:number|undefined):void=>{
  if(areaId===undefined){host?.previewAllowedArea?.(undefined);return;}
  const current=host?.readState?.()??latest,fresh=current?.world;
  if(!fresh||current?.epoch!==epoch||registeredMapId(fresh)!==mapId||fresh.seed!==seed||fresh.width!==width||fresh.height!==height)return;
  host?.previewAllowedArea?.(areaId!==undefined&&fresh.allowedAreas?.some(area=>area.id===areaId)?areaId:undefined);
 };
 const clearPreview=()=>preview(undefined),leaveList=()=>{clearPreview();onBack();};
 clearPreview();
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
 open(page);
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
function assignPanel(world:World):NativePage {
 const rows:NativeRow[]=[{id:'assign-headings',label:'Colon',value:'Activité',compact:true,columns:['Régime','Hostilité','Zone','Tenue','Auto','Port forcé','Drogues',...(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))?['Lecture']:[]].map(label=>({label}))}];
 for(const pawn of world.pawns.filter(p=>isColonist(p)&&!p.prisoner)){
  const food=world.foodPolicies.find(p=>p.id===pawn.foodPolicyId),apparel=world.apparelPolicies?.find(p=>p.id===pawn.apparelPolicyId),drug=effectiveDrugPolicies265(world).find(p=>p.id===pawn.drugPolicyId)??effectiveDrugPolicies265(world)[0]!;
   const controls=[button(`assign-food-${pawn.id}`,'Régime',()=>choose(`food-choice-${pawn.id}`,`${pawn.name} · alimentation`,currentWorld().foodPolicies.map(policy=>({id:`food-${policy.id}`,label:policy.name,active:currentPawn(pawn.id).foodPolicyId===policy.id,choose:()=>send({type:'food-policy-assign',pawnId:pawn.id,policyId:policy.id})})))),button(`assign-response-${pawn.id}`,'Hostilité',()=>choose(`response-${pawn.id}`,`${pawn.name} · réaction hostile`,(['flee','ignore','attack'] as const).map(response=>({id:response,label:{flee:'Fuir',ignore:'Ignorer',attack:'Attaquer'}[response],active:(currentPawn(pawn.id).hostilityResponse??'flee')===response,choose:()=>send({type:'hostility-response',pawnId:pawn.id,response})})))),button(`assign-area-${pawn.id}`,'Zone',()=>choose(`area-choice-${pawn.id}`,`${pawn.name} · zone autorisée`,[{id:0,label:'Sans restriction'},...(currentWorld().allowedAreas??[])].map(area=>({id:`area-${area.id}`,label:area.label,active:(currentPawn(pawn.id).allowedAreaId??0)===area.id,choose:()=>send({type:'assign-allowed-area',pawnId:pawn.id,areaId:area.id||null})}))))];
  if(world.schemaVersion>=90&&apparel){controls.push(button(`assign-apparel-${pawn.id}`,'Tenue',()=>choose(`apparel-choice-${pawn.id}`,`${pawn.name} · tenue`,(currentWorld().apparelPolicies??[]).map(policy=>({id:`apparel-${policy.id}`,label:policy.label,active:currentPawn(pawn.id).apparelPolicyId===policy.id,choose:()=>send({type:'apparel-policy-assign',pawnId:pawn.id,policyId:policy.id,automatic:!!currentPawn(pawn.id).apparelAutomation})})))),button(`assign-auto-${pawn.id}`,pawn.apparelAutomation?'Auto actif':'Auto inactif',()=>{const p=currentPawn(pawn.id);return send({type:'apparel-policy-assign',pawnId:p.id,policyId:p.apparelPolicyId??apparel.id,automatic:!p.apparelAutomation});},{active:!!pawn.apparelAutomation}),button(`assign-forced-${pawn.id}`,'Libérer le port forcé',()=>send({type:'apparel-clear-forced',pawnId:pawn.id})));}
  if(world.schemaVersion>=265)controls.push(button(`assign-drug-${pawn.id}`,'Drogues',()=>choose(`drug-choice-${pawn.id}`,`${pawn.name} · drogues`,effectiveDrugPolicies265(currentWorld()).map(policy=>({id:`drug-${policy.id}`,label:policy.name,active:currentPawn(pawn.id).drugPolicyId===policy.id,choose:()=>send({type:'drug-policy-assign',pawnId:pawn.id,policyId:policy.id})})))));
  if((Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion)))))controls.push(button(`assign-reading-${pawn.id}`,'Lecture',()=>choose(`reading-choice-${pawn.id}`,`${pawn.name} · lecture`,READING_POLICIES_295.map(policy=>({id:String(policy.id),label:policy.label,active:effectiveReadingPolicy295(currentPawn(pawn.id))===policy.id,choose:()=>send({type:'reading-policy-295',pawnId:pawn.id,policyId:policy.id})})))));
  const area=pawn.allowedAreaId?world.allowedAreas?.find(a=>a.id===pawn.allowedAreaId)?.label??'Zone inconnue':'Sans restriction';
  const response={flee:'Fuir',ignore:'Ignorer',attack:'Attaquer'}[pawn.hostilityResponse??'flee'];
  const values:Record<string,string>={food:food?.name??'Régime inconnu',response,area,apparel:apparel?.label??'Tenue indisponible',auto:pawn.apparelAutomation?'Auto actif':'Auto inactif',forced:'Libérer',drug:drug?.name??'Politique indisponible',reading:READING_POLICIES_295.find(p=>p.id===effectiveReadingPolicy295(pawn))!.label};
  const hint=[pawn.name,`Régime : ${values.food}`,`Hostilité : ${response}`,`Zone : ${area}`,`Tenue : ${values.apparel}`,values.auto,world.schemaVersion>=265?`Drogues : ${drug.name}`:'',queryPawnStatus(world,pawn).reason].filter(Boolean).join('\n');
  const ordered=['food','response','area','apparel','auto','forced','drug',...(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))?['reading']:[]].map(action=>{
   const original=controls.find(control=>control.id===`assign-${action}-${pawn.id}`);
   if(!original)return button(`assign-${action}-${pawn.id}-unavailable`,'—',()=>{},{disabled:true,hint:'Indisponible dans cette partie.'});
   return {...original,label:values[action]!,hint:[original.label,original.hint,hint].filter(Boolean).join('\n'),disabled:original.disabled||pawn.state==='dead'||!!pawn.health?.death||!!pawn.visitor};
  });
  rows.push({...row(`assign-${pawn.id}`,pawn.name,queryPawnStatus(world,pawn).reason,undefined,ordered),compact:true,hint});
 }
 rows.push(row('manage-food','Régimes alimentaires',undefined,undefined,[button('food-new','Nouveau régime',()=>inputPage('new-food','Nouveau régime','Nouveau régime',name=>send({type:'food-policy-create',name}))),...world.foodPolicies.map(policy=>button(`food-edit-${policy.id}`,policy.name,()=>foodEditor(policy.id)))]));
 if(world.apparelPolicies)rows.push(row('manage-apparel','Politiques de tenue',undefined,'Filtre des vêtements et matières, qualité, PV, copie et renommage.',world.apparelPolicies.map(policy=>button(`apparel-edit-${policy.id}`,policy.label,()=>apparelEditor(policy.id)))));
 if(world.schemaVersion>=265)rows.push(row('manage-drugs','Politiques de drogues',undefined,undefined,[button('drug-new','Nouvelle politique',()=>inputPage('new-drug','Nouvelle politique','Nouvelle politique',name=>send({type:'drug-policy-create',name}))),...effectiveDrugPolicies265(world).map(policy=>button(`drug-edit-${policy.id}`,policy.name,()=>drugEditor(policy.id)))]));
 rows.push(row('manage-areas','Zones autorisées',`${world.allowedAreas?.length??0} zones`,undefined,[button('areas-manage','Gérer les zones',areaEditor)]));
 return {id:'assign',title:'Assignations',layout:'table',rows,width:11.4,onClose:()=>void host?.panel(null)};
}

function questsPanel(state:NativeUiState):NativePage {
 const source=state.world??state.campaign,rows:NativeRow[]=[];
 if(!source)return {id:'quests',title:'Quêtes',rows:[row('quests-empty','Aucune partie active.')],onClose:()=>void host?.panel(null)};
 if(state.world){const world=state.world,eligible=!!world.gameProfile&&world.raids?.profile==='cassandra-raids-v1';
  if(!world.quests&&eligible)rows.push(row('quest-enable','Demandes d’asile',undefined,'Après activation, une première demande peut se présenter après huit jours de jeu.',[button('quest-enable-action','Recevoir des demandes',()=>send({type:'enable-quests'}))]));
  for(const quest of [...(world.quests?.entries??[])].reverse()){
   const controls:NativeControl[]=quest.status==='offered'?[button(`quest-${quest.id}-accept`,'Accueillir',()=>send({type:'answer-quest',questId:quest.id,accept:true}),{disabled:world.tick>=quest.expiresAt}),button(`quest-${quest.id}-refuse`,'Refuser sans pénalité',()=>send({type:'answer-quest',questId:quest.id,accept:false}),{disabled:world.tick>=quest.expiresAt})]:[];
   const detail=quest.status==='offered'?`Répondre sous ${days(quest.expiresAt-world.tick)} · arrivée ${days(quest.joinDelay)} et poursuite ${days(quest.raidDelay)} après acceptation. Un bandit au couteau poursuit cette personne.`:quest.arrivedAt!==undefined?'Personne arrivée ; la poursuite et son combat suivent leurs règles physiques.':'Dossier conservé.';
   rows.push(row(`quest-${quest.id}`,quest.name,({offered:'Offre en cours',accepted:'Acceptée',refused:'Refusée',expired:'Expirée',concluded:'Conclue'} as const)[quest.status],detail,controls));
   if(quest.relationship)rows.push(row(`quest-${quest.id}-relationship`,'Lien proposé',`${quest.relationship.kind} · personne #${quest.relationship.otherId}`));
   if(quest.background)rows.push(row(`quest-${quest.id}-background`,'Parcours',`${quest.background.childhood}${quest.background.adulthood?` · ${quest.background.adulthood}`:''}`));
  }
 }
 for(const request of [...(source.tradeRequests284?.entries??[])].reverse()){
  const content=tradeRequestContent284(request.family),familyLabel=content?.label??request.family,settlement=source.worldFactions?.settlements.find(s=>s.id===request.settlementId),access=source.worldFactions&&settlement?worldSettlementAccess256(source.worldFactions,request.settlementId):undefined,offered=request.status==='offered'&&source.tick*10<request.offerExpiresAtCore,available=offered&&!request.destinationLost&&!!access?.ok&&!!access.canTrade;
  const controls:NativeControl[]=[];
  if(offered){for(const option of request.options)controls.push(button(`trade-request-${request.id}-option-${option.id}`,`Accepter · récompense ${option.id}`,()=>confirm(`trade-answer-${request.id}`,'Accepter la demande commerciale',`${request.quantity} ${familyLabel} à livrer à ${request.settlementName}. Récompense : ${option.original.map(p=>`${p.quantity} ${ITEM_DEFINITIONS[p.item].label}`).join(', ')}${option.goodwill?` · relations +${option.goodwill}`:''}.`,()=>send({type:'trade-request-answer',requestId:request.id,optionId:option.id})),{disabled:!available}));controls.push(button(`trade-request-${request.id}-dismiss`,request.dismissed?'Réafficher la lettre':'Masquer la lettre',()=>send({type:'trade-request-dismiss',requestId:request.id,dismissed:!request.dismissed})));}
  rows.push(row(`trade-request-${request.id}`,`${request.quantity} ${familyLabel}`,`${request.settlementName} · case ${request.tile} · ${request.status}`,request.status==='accepted'?`Livrer avec une caravane sous ${days((request.expiresAtCore??source.tick*10)/10-source.tick)}.`:offered?`Offre sous ${days(request.offerExpiresAtCore/10-source.tick)} · durée de mission ${days(request.durationCore/10)}.`:request.closed?.reason,controls));
  for(const option of request.options)rows.push(row(`trade-request-${request.id}-reward-${option.id}`,`Récompense ${option.id}`,undefined,[...option.original.map(p=>`${p.quantity} ${ITEM_DEFINITIONS[p.item].label}${p.quality?` (${QUALITY_LABELS[p.quality]})`:''}`),option.goodwill?`Relations +${option.goodwill}`:''].filter(Boolean).join(' · ')));
 }
 for(const site of source.worldSites263?.entries??[])if(site.kind==='peace-talks'){const facts=peaceTalksFacts293(source,site);rows.push(row(`peace-${site.id}`,facts.title,facts.status,`${facts.destination} ${facts.body}`,[button(`peace-${site.id}-world`,'Monde',()=>host?.panel('world'))]));}
 for(const site of source.worldSites263?.entries??[]){
  const paid=nativePaidAiSiteFacts298(site,effectiveCore297(source));if(!paid)continue;
  rows.push({...row(`paid-ai-site-${site.id}`,paid.title,`Case ${site.tile} · ${paid.status}`,`${paid.deadline}. ${paid.detail}`,[button(`paid-ai-site-${site.id}-world`,'Inspecter sur le globe',async()=>{await host?.panel('world');focusNativePaidAiSite298(site.id);})]),presentation:'record'});
  rows.push(row(`paid-ai-site-${site.id}-risk`,'Risque',paid.risk));
 }
 rows.push(...nativeArrivalRows(state,host!));
 if(!rows.length)rows.push(row('quests-empty','Aucune quête signalée.'));
 return {id:'quests',title:'Quêtes',rows,width:7.8,onClose:()=>void host?.panel(null)};
}
function menuPanel(state:NativeUiState,actions:NativeUiActions):NativePage {
 const world=state.world,legacy:NativeRow[]=[];
 if(world){
  if(!world.climate)legacy.push(row('legacy-climate','Saisons et météo',undefined,'Activation prospective à l’heure actuelle ; aucune croissance passée ajoutée.',[button('legacy-climate-adopt','Activer les saisons',()=>send({type:'climate-adopt'}),{disabled:state.busy})]));
  if(!world.raids)legacy.push(row('legacy-raids','Raids du camp',undefined,'Calendrier historique : première attaque dans 3,5 à 4 jours, puis 6 à 8 jours après chaque issue.',[button('legacy-raids-adopt','Activer les raids',()=>send({type:'enable-raids'}),{disabled:state.busy})]));
  if(!world.raids?.mechanoid||world.schemaVersion>=197&&!world.raids.mechanoid.ranged)legacy.push(row('legacy-mech-raids','Raids mécaniques futurs',undefined,'Concurrence prospective aux occasions Cassandra à partir du jour 45. Aucun raid créé maintenant.',[button('legacy-mech-adopt','Admettre les raids mécaniques futurs',()=>send({type:'enable-mech-raids'}),{disabled:state.busy||world.schemaVersion<194||world.raids?.profile!=='cassandra-raids-v1'})]));
  if(!world.gameProfile&&!world.heatwaves)legacy.push(row('legacy-heatwaves','Canicules du camp',undefined,'Calendrier historique : première canicule dans 6 à 7 jours, sans exposition passée.',[button('legacy-heatwaves-adopt','Activer les canicules',()=>send({type:'enable-heatwaves'}),{disabled:state.busy})]));
 }
 return {id:'menu',title:'Menu',rows:[
  row('menu-game','Partie',undefined,state.fault,[button('menu-resume','Reprendre',()=>actions.panel(null),{disabled:!!state.fault}),button('menu-save','Sauvegarder',actions.save,{disabled:state.busy||!state.hasGame||!!state.fault}),button('menu-load','Charger',()=>actions.front('load'),{disabled:state.busy}),button('menu-export','Exporter',actions.exportSave,{disabled:state.busy||!state.hasGame||!!state.fault})]),
  row('menu-new','Autres actions',undefined,undefined,[button('menu-create','Nouvelle colonie',()=>actions.front('create'),{disabled:state.busy}),button('menu-home','Accueil',()=>actions.front('home'),{disabled:state.busy})]),
  ...state.saves.map(save=>row(`menu-save-${save.key}`,save.label,save.kind,save.detail)),
  ...legacy,
 ],onClose:()=>void actions.panel(null)};
}

/** Refresh confirmed readers while an owned native editor keeps its draft. */
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
 return page?{...page,textEntities:page.textEntities??nativeTextEntitiesFor(state.world,state.campaign)}:null;
}
