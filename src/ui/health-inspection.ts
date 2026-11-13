import {firefoamProtectionText290} from './firefoam-inspection-290.ts';
import {isSchema273OrLater,isSchema280OrLater} from '../sim/schema-compatibility-257.ts';
import {artificialPartIngredient273} from '../sim/artificial-parts-rules';
import {isProstheticItem273} from '../sim/prosthetic-content-273';
import {ITEM_DEFINITIONS} from '../sim/items';
import {alcoholInspection265} from '../sim/alcohol-rules-265';
import {cryptosleepSick256,cryptosleepSicknessModifiers256} from '../sim/cryptosleep-sickness-256';
import { MALNUTRITION_UNIT,MALNUTRITION_LABELS,malnutritionStage } from '../sim/malnutrition';
import { HEAT_UNIT,HEAT_LABELS,heatStage } from '../sim/heat-rules';
import { BODY_PARTS,BODY_INDEX,HUMAN_BODY,type BodyPartId } from '../sim/body-definition';
import { BLOOD_UNIT,HP_UNIT,PAIN_UNIT,INJURY_RULES,bloodConsciousness } from '../sim/injury-rules';
import { medicalBleed,medicalPain,injuryBleed,remainingPartHealth,freshMissing } from '../sim/injury-state';
import { bodyEfficiencies } from '../sim/body-capacities';
import { pawnBody } from '../sim/health-rules';
import type { Pawn,Command,World } from '../sim/types';
import { MEDICAL_CARE,medicalCare,type MedicalCare } from '../sim/medicine-rules';
import { createInfectionInspection,updateInfectionInspection,infectionPercent } from './infection-inspection';
import { createFluInspection,updateFluInspection } from './flu-inspection';
import { activeImmuneDisease,createImmuneDiseasesInspection,updateImmuneDiseasesInspection,IMMUNE_DISEASE_LABELS } from './immune-diseases-inspection';
import { IMMUNE_DISEASE_KINDS } from '../sim/immune-diseases-types';
import { immuneDiseaseModifiers } from '../sim/immune-diseases-rules';
import { parasiteModifiers306 } from '../sim/parasites-306';
import { createParasitesInspection306,updateParasitesInspection306 } from './parasites-inspection';
import { foodPoisoningStage,FOOD_POISON_UNIT } from '../sim/food-poisoning';
import { bodyDescription } from './burial-controls';
import { isCarePatient,isColonist } from '../sim/affiliation';
import { SURGERY_PARTS,surgeryRequestReason,surgeryInstallRequestReason,surgeryRemoveRequestReason273 } from '../sim/surgery-rules';
import type { SurgicalLimb } from '../sim/surgery-anatomy';
import { ARTIFICIAL_PARTS,artificialPartCovering,artificialPartEfficiencies } from '../sim/artificial-parts-rules';
import type { ArtificialPartKind,ArtificialPartSite } from '../sim/artificial-parts-types';
import { ANESTHETIC_UNIT,anestheticStage,anestheticModifiers } from '../sim/anesthetic';
import { heatModifiers } from '../sim/heat-rules';
import { coldModifiers } from '../sim/cold-rules';
import { malnutritionModifiers } from '../sim/malnutrition';
import { infectionModifiers } from '../sim/infection-rules';
import { fluModifiers } from '../sim/flu-rules';
import { foodPoisoningModifiers } from '../sim/food-poisoning';
import { dismissTooltip,setTooltip } from './tooltip';
import { openObjectInformation } from './object-information';
import './health-inspection.css';

export interface SurgeryInspectionActions {
  /** Re-read the authority version at click time, alongside the selected pawn. */
  version?:()=>number|undefined;
  request:(pawnId:number,part:SurgicalLimb)=>void;
  install?:(pawnId:number,part:ArtificialPartSite,implant:ArtificialPartKind)=>void;
  remove?:(pawnId:number,part:ArtificialPartSite)=>void;
  cancel:(pawnId:number)=>void;
}

/** Operation access does not grant colony work or self-treatment controls. The
 * individual clinical guards still decide every actual therapeutic choice. */
export function healthSurgeryActionsAvailable280(pawn:Pawn,version:number):boolean {
  return isColonist(pawn)&&!pawn.prisoner||isSchema280OrLater(version)&&!!pawn.prisoner;
}

const artificialOperationChoices=()=>Object.entries(ARTIFICIAL_PARTS).flatMap(([kind,rule])=>rule.sites.map(part=>({
  implant:kind as ArtificialPartKind,part,label:`${rule.label} · ${BODY_PARTS[part].label.toLocaleLowerCase('fr-FR')}`,
  guidance:`1 ${ITEM_DEFINITIONS[artificialPartIngredient273(kind as ArtificialPartKind)].label.toLocaleLowerCase('fr-FR')} + 2 médicaments du même type autorisé · Médecine ${rule.medicineSkill} · efficacité ${Math.round(rule.efficiency*100)} % de la partie.`,
})));

/** Request projection only: the clinical command owns admission, cancellation,
 * reservations and anatomy. The inspector never invents an operation result. */
export function healthSurgeryView(pawn:Pawn,world?:World) {
  const request=pawn.surgeryRequest,doctor=world?.pawns.find(p=>p.surgery?.patientId===pawn.id);
  const phase=doctor?.surgery?.phase;
  const installing=request?.implant!==undefined,removing=request?.removeArtificial273!==undefined,wooden=installing&&!isProstheticItem273(request!.implant);
  const status=request
    ?`${installing?`Pose demandée (${ARTIFICIAL_PARTS[request.implant!].label.toLocaleLowerCase('fr-FR')})`:removing?`Retrait demandé (${ARTIFICIAL_PARTS[request.removeArtificial273!].label.toLocaleLowerCase('fr-FR')})`:'Amputation demandée'} : ${BODY_PARTS[request.part].label.toLocaleLowerCase('fr-FR')} · ${phase==='work'?'opération en cours':phase==='pickup'?installing?wooden?'collecte du bois et des médicaments':'collecte de la pièce et des médicaments':'collecte du médicament':phase==='approach'?'approche du chevet':installing?wooden?'en attente du lit, du médecin, du bois et des médicaments':'en attente du lit, du médecin, de la pièce et des médicaments':'en attente du lit, du médecin et du médicament'}.`
    :'Aucune opération demandée.';
  return {status,canCancel:!!request&&pawn.state!=='dead'&&!pawn.health?.death,
    choices:SURGERY_PARTS.map(part=>({part,label:BODY_PARTS[part].label,
      reason:request?'Une opération est déjà demandée pour ce patient.':surgeryRequestReason(pawn,part,{version:world?.schemaVersion})})),
    removals:world&&isSchema273OrLater(world.schemaVersion)?(pawn.health?.artificialParts??[]).filter(a=>isProstheticItem273(a.kind)).map(a=>({part:a.part,kind:a.kind,label:`${ARTIFICIAL_PARTS[a.kind].label} · ${BODY_PARTS[a.part].label.toLocaleLowerCase('fr-FR')}`,reason:request?'Une opération est déjà demandée pour ce patient.':surgeryRemoveRequestReason273(pawn,a.part,a.kind,{version:world.schemaVersion})})):[],
    installations:world&&world.schemaVersion>=210?artificialOperationChoices().filter(choice=>isSchema273OrLater(world.schemaVersion)||!isProstheticItem273(choice.implant)).map(choice=>({...choice,
      reason:request?'Une opération est déjà demandée pour ce patient.':surgeryInstallRequestReason(pawn,choice.part,choice.implant,{version:world.schemaVersion})})):[]};
}

/** Re-read the selected snapshot at click time; stale controls never send a
 * replacement request or make a missing member. Worker validation still owns
 * races between this display and the command's actual acknowledgement. */
export function requestInspectedAmputation(pawn:Pawn|undefined,part:SurgicalLimb,actions:SurgeryInspectionActions):string|undefined {
  const reason=!pawn?'Aucun patient sélectionné.':pawn.surgeryRequest?'Une opération est déjà demandée pour ce patient.':surgeryRequestReason(pawn,part,{version:actions.version?.()});
  if(reason)return reason;
  actions.request(pawn!.id,part);return undefined;
}
export function requestInspectedInstallation(pawn:Pawn|undefined,part:ArtificialPartSite,implant:ArtificialPartKind,actions:SurgeryInspectionActions):string|undefined {
  const reason=!pawn?'Aucun patient sélectionné.':pawn.surgeryRequest?'Une opération est déjà demandée pour ce patient.':surgeryInstallRequestReason(pawn,part,implant,{version:actions.version?.()});
  if(reason)return reason;
  if(!actions.install)return 'La pose de prothèse n’est pas disponible.';
  actions.install(pawn!.id,part,implant);return undefined;
}
export function requestInspectedProstheticRemoval273(pawn:Pawn|undefined,part:ArtificialPartSite,kind:ArtificialPartKind,actions:SurgeryInspectionActions):string|undefined {
  const reason=!pawn?'Aucun patient sélectionné.':pawn.surgeryRequest?'Une opération est déjà demandée pour ce patient.':surgeryRemoveRequestReason273(pawn,part,kind,{version:actions.version?.()});
  if(reason)return reason;
  if(!actions.remove)return 'Le retrait n’est pas disponible.';
  actions.remove(pawn!.id,part);return undefined;
}
export function cancelInspectedAmputation(pawn:Pawn|undefined,actions:SurgeryInspectionActions):boolean {
  if(!pawn?.surgeryRequest||pawn.state==='dead'||pawn.health?.death)return false;
  actions.cancel(pawn.id);return true;
}
export function healthAnestheticText(pawn:Pawn):string {
  const state=pawn.health?.anesthetic;if(!state)return '';
  const stage=anestheticStage(state.severity),label=stage==='sedated'?'sédation':stage==='woozy'?'réveil progressif':'dissipation';
  return `Anesthésie · ${label} · ${(state.severity/ANESTHETIC_UNIT*100).toFixed(1)} %.${pawn.state==='dead'?' Dossier arrêté au décès.':''}`;
}

const CAPACITY_LABELS = [
  ['consciousness','Conscience'],['moving','Mouvement'],['manipulation','Manipulation'],
  ['talking','Parole'],['eating','Alimentation'],['sight','Vue'],['hearing','Ouïe'],
  ['breathing','Respiration'],['bloodFiltration','Filtrage du sang'],
  ['bloodPumping','Pompage du sang'],['digestion','Digestion'],
] as const;
let inspectionSequence=0;

export function healthCapacityRows(pawn:Pawn):ReadonlyArray<{label:string;value:string}> {
  if(pawn.state==='dead')return [];
  const c=pawnBody(pawn).capacities;
  return [
    {label:'Douleur',value:pawn.health&&medicalPain(pawn.health)>0?`${Math.round(medicalPain(pawn.health)*100)} %`:'Aucune'},
    ...CAPACITY_LABELS.map(([key,label])=>({label,value:`${Math.round(c[key]*100)} %`})),
  ];
}

/** Anatomical order follows the visible health tree, rather than injury time. */
export function healthInjuryRows(pawn:Pawn):ReadonlyArray<{part:string;description:string}> {
  const health=pawn.health;if(!health)return [];
  const order=new Map(HUMAN_BODY.map((part,index)=>[part.id,index]));
  return [
    ...health.injuries.map(i=>({partId:i.part,part:BODY_PARTS[i.part].label,description:`${i.scar?.pain!==undefined?'Cicatrice':INJURY_RULES[i.kind].label} · −${(i.severity/HP_UNIT).toFixed(2)} PV${i.tended!==undefined?` · soignée (${Math.round(i.tended/10)} %)` :''}`})),
    ...health.missing.filter(m=>!artificialPartCovering(health,m.part)).map(m=>({partId:m.part,part:BODY_PARTS[m.part].label,description:`Partie perdue${m.tended?' · plaie soignée':''}`})),
    ...(health.artificialParts??[]).map(added=>({partId:added.part,part:BODY_PARTS[added.part].label,description:`${ARTIFICIAL_PARTS[added.kind].label} · efficacité ${Math.round(ARTIFICIAL_PARTS[added.kind].efficiency*100)} %`})),
    ...(health.ageAilments??[]).map(kind=>kind==='bad-back'
      ?{partId:'spine' as const,part:'Colonne vertébrale',description:'Lumbago'}
      :{partId:'torso' as const,part:'Torse',description:'Frêle'}),
  ].sort((a,b)=>(order.get(a.partId)??Infinity)-(order.get(b.partId)??Infinity)).map(({part,description})=>({part,description}));
}

type TooltipRow={label:string;value:string};
const percent=(value:number)=>`${(value*100).toFixed(1).replace('.0','')} %`;
const anatomyInput=(pawn:Pawn)=>({damage:pawn.health?.injuries.map(i=>({part:i.part,loss:i.severity/HP_UNIT}))??[],missing:pawn.health?.missing.map(m=>m.part)??[],pain:0,...(pawn.health?.artificialParts?{artificialParts:artificialPartEfficiencies(pawn.health)}:{})});
const CAPACITY_HELP:Record<typeof CAPACITY_LABELS[number][0],{body:string;parts:readonly BodyPartId[]}>={
  consciousness:{body:'Le cerveau, la douleur, le pompage du sang, la respiration et le filtrage du sang déterminent la conscience. Les maladies peuvent ajouter une pénalité ou un plafond.',parts:['brain','heart','left-lung','right-lung','left-kidney','right-kidney','liver']},
  moving:{body:'Les jambes, pieds et orteils, le bassin et la colonne vertébrale déterminent le mouvement, avec la conscience, la respiration et le pompage du sang. Une conscience inférieure à 30 % empêche de se déplacer.',parts:HUMAN_BODY.filter(p=>p.groups.some(g=>g==='legs'||g==='feet')||p.id==='pelvis'||p.id==='spine').map(p=>p.id)},
  manipulation:{body:'Chaque bras dépend de son épaule, de ses os, de sa main et de ses doigts. La moyenne des deux bras est multipliée par la conscience. Une conscience inférieure à 30 % empêche de manipuler.',parts:HUMAN_BODY.filter(p=>p.groups.some(g=>g==='shoulders'||g==='arms'||g==='hands')||p.id.endsWith('-clavicle')).map(p=>p.id)},
  talking:{body:'La mâchoire, le cou, la langue et la conscience déterminent la parole.',parts:['jaw','neck','tongue']},
  eating:{body:'La mâchoire, le cou, la langue et la conscience déterminent l’alimentation. La manipulation intervient aussi dans la vitesse d’ingestion.',parts:['jaw','neck','tongue']},
  sight:{body:'Le meilleur œil compte pour 75 % et l’autre pour 25 % de la vue.',parts:['left-eye','right-eye']},
  hearing:{body:'La meilleure oreille compte pour 75 % et l’autre pour 25 % de l’ouïe.',parts:['left-ear','right-ear']},
  breathing:{body:'La moyenne des poumons est multipliée par l’efficacité du cou et par la moyenne de la cage thoracique et du sternum.',parts:['left-lung','right-lung','neck','ribcage','sternum']},
  bloodFiltration:{body:'La moyenne des reins est multipliée par l’efficacité du foie.',parts:['left-kidney','right-kidney','liver']},
  bloodPumping:{body:'Le pompage du sang dépend de l’efficacité du cœur.',parts:['heart']},
  digestion:{body:'La digestion dépend de la moyenne de l’estomac et du foie.',parts:['stomach','liver']},
};

/** Snapshot-only inspection projection. Numbers use the same anatomical and
 * condition rules as simulation; no attacker or weapon is guessed from a wound. */
export function healthPartTooltip(pawn:Pawn,part:BodyPartId):{title:string;body:string;rows:TooltipRow[]} {
  const definition=BODY_PARTS[part],efficiency=bodyEfficiencies(anatomyInput(pawn))[BODY_INDEX[part]]!;
  const added=pawn.health?artificialPartCovering(pawn.health,part):undefined;
  if(added&&added.part!==part)return {title:definition.label,body:'Cette partie naturelle est remplacée par la prothèse de son parent ; elle ne constitue pas une nouvelle plaie à soigner.',rows:[{label:'Prothèse',value:ARTIFICIAL_PARTS[added.kind].label},{label:'Efficacité de la prothèse',value:percent(ARTIFICIAL_PARTS[added.kind].efficiency)}]};
  return {title:definition.label,body:added?'Prothèse : fonction partielle, sensible aux dégâts. Les autres affections du patient continuent à modifier ses capacités.':efficiency===0?'Cette partie ne contribue plus aux capacités qui en dépendent.':'Les lésions et les parties perdues modifient son efficacité.',rows:[
    ...added?[{label:'Prothèse',value:ARTIFICIAL_PARTS[added.kind].label}]:[],
    {label:'Points de vie',value:`${pawn.health?remainingPartHealth(pawn.health,part)/HP_UNIT:definition.hp} / ${definition.hp}`},
    {label:'Efficacité',value:percent(efficiency)},
    {label:'Position',value:definition.depth==='inside'?'Interne':'Externe'},
  ]};
}

export function healthCapacityTooltip(pawn:Pawn,key:typeof CAPACITY_LABELS[number][0]):{title:string;body:string;rows:TooltipRow[]} {
  const c=pawnBody(pawn).capacities,help=CAPACITY_HELP[key],efficiency=bodyEfficiencies(anatomyInput(pawn));
  const relevant=(help.parts.length>10?help.parts.filter(part=>efficiency[BODY_INDEX[part]]!<1):help.parts).filter(part=>{
    const added=pawn.health?artificialPartCovering(pawn.health,part):undefined;return !added||added.part===part;
  });
  const rows:TooltipRow[]=[{label:'Capacité actuelle',value:percent(c[key])},...relevant.map(part=>({label:BODY_PARTS[part].label,value:percent(efficiency[BODY_INDEX[part]]!)}))];
  if(help.parts.length>10&&!relevant.length)rows.push({label:'Anatomie concernée',value:'Toutes les parties à 100 %'});
  if(['moving','manipulation','talking','eating'].includes(key))rows.push({label:'Conscience',value:percent(c.consciousness)});
  if(key==='consciousness')rows.push({label:'Douleur totale',value:percent(pawn.health?medicalPain(pawn.health):0)},{label:'Respiration',value:percent(c.breathing)},{label:'Pompage du sang',value:percent(c.bloodPumping)},{label:'Filtrage du sang',value:percent(c.bloodFiltration)});
  const health=pawn.health;
  if(health){
    const modifiers:ReadonlyArray<[string,object]>=[['Perte de sang',bloodConsciousness(health.bloodLoss)],['Coup de chaleur',heatModifiers(health.heatstroke)],['Hypothermie',coldModifiers(health.hypothermia)],['Malnutrition',malnutritionModifiers(health.malnutrition)],['Infection',infectionModifiers(health)],['Grippe',fluModifiers(health.flu)],['Mal de cryptosommeil',cryptosleepSicknessModifiers256(health.cryptosleepSickness)],['Paludisme / peste',immuneDiseaseModifiers(health)],['Parasites',parasiteModifiers306(health)],['Intoxication alimentaire',foodPoisoningModifiers(health.foodPoisoning)],['Anesthésie',anestheticModifiers(health.anesthetic)]];
    for(const [label,modifier] of modifiers)for(const [field,value] of Object.entries(modifier)){
      if(typeof value!=='number'||!field.startsWith(key))continue;
      if(field.endsWith('Offset')&&value!==0)rows.push({label,value:`${value>0?'+':''}${percent(value)} points`});
      if(field.endsWith('Factor')&&value!==1)rows.push({label,value:`× ${value.toFixed(2)}`});
      if(field.endsWith('Max')&&Number.isFinite(value)&&value<1)rows.push({label:`${label} · maximum`,value:percent(value)});
    }
    if(key==='moving'||key==='manipulation')for(const kind of health.ageAilments??[]){
      const penalty=kind==='bad-back'?(key==='moving'?.3:.1):.3;
      rows.push({label:kind==='bad-back'?'Lumbago':'Frêle',value:`−${percent(penalty)} points`});
    }
  }
  return {title:CAPACITY_LABELS.find(([id])=>id===key)![1],body:help.body,rows};
}

interface ClinicalRow {partId:BodyPartId;part:string;description:string;tooltip:{title:string;body:string;rows:TooltipRow[]};bleeding:boolean}
function clinicalRows(pawn:Pawn):ClinicalRow[]{
  const health=pawn.health;if(!health)return [];
  const rows:ClinicalRow[]=health.injuries.map(injury=>{
    const scar=injury.scar?.pain!==undefined,rule=INJURY_RULES[injury.kind],bleed=injuryBleed(health,injury);
    const artificial=artificialPartCovering(health,injury.part);
    const pain=artificial?0:injury.severity*(scar?5*injury.scar!.pain!:rule.painUnits)/PAIN_UNIT;
    const title=scar?`Cicatrice de ${rule.label.toLocaleLowerCase('fr-FR')}`:rule.label;
    const treatment=injury.tended!==undefined?`Soignée · qualité ${percent(injury.tended/1000)}`:scar?'Lésion permanente':'Non soignée';
    return {partId:injury.part,part:BODY_PARTS[injury.part].label,description:title,bleeding:bleed>0,tooltip:{title,body:artificial?`Lésion de la prothèse ${ARTIFICIAL_PARTS[artificial.kind].label.toLocaleLowerCase('fr-FR')}, sans douleur ni saignement.`:scar?'Cette ancienne lésion laisse une cicatrice permanente.':`Lésion du ${BODY_PARTS[injury.part].label.toLocaleLowerCase('fr-FR')}. ${treatment}.`,rows:[
      {label:'Gravité',value:`${(injury.severity/HP_UNIT).toFixed(2)} PV`},
      {label:'Saignement',value:`${percent(bleed)}/jour`},
      {label:'Douleur avant anesthésie',value:`+${percent(pain)}`},
      {label:'Traitement',value:treatment},
    ]}};
  });
  for(const missing of health.missing)if(!artificialPartCovering(health,missing.part))rows.push({partId:missing.part,part:BODY_PARTS[missing.part].label,description:'Partie perdue',bleeding:freshMissing(health,missing),tooltip:{title:'Partie perdue',body:'La partie et ses descendants ne contribuent plus aux capacités du corps.',rows:[{label:'Traitement',value:missing.tended?'Plaie soignée':freshMissing(health,missing)?'Plaie fraîche non soignée':'Plaie fermée'}]}});
  for(const added of health.artificialParts??[]){const rule=ARTIFICIAL_PARTS[added.kind];rows.push({partId:added.part,part:BODY_PARTS[added.part].label,description:rule.label,bleeding:false,tooltip:{title:rule.label,body:'Cette partie a été remplacée par une prothèse. Sa fonction et les affections ou lésions présentes déterminent ses capacités.',rows:[{label:'Efficacité de la partie',value:percent(rule.efficiency)},{label:'Type',value:isProstheticItem273(added.kind)?'Prothèse industrielle':'Bois'}]}});}
  for(const kind of health.ageAilments??[]){const partId=kind==='bad-back'?'spine':'torso';rows.push({partId,part:BODY_PARTS[partId].label,description:kind==='bad-back'?'Lumbago':'Frêle',bleeding:false,tooltip:{title:kind==='bad-back'?'Lumbago':'Frêle',body:'Affection chronique liée à l’âge.',rows:[{label:'Mouvement',value:'−30 % points'},{label:'Manipulation',value:kind==='bad-back'?'−10 % points':'−30 % points'}]}});}
  return rows.sort((a,b)=>BODY_INDEX[a.partId]-BODY_INDEX[b.partId]);
}

function clinicalElement(pawn:Pawn,row:ClinicalRow):HTMLElement {
  const element=document.createElement('p');element.className='health-injury-row';
  const name=document.createElement('strong');name.textContent=row.part;name.tabIndex=0;setTooltip(name,healthPartTooltip(pawn,row.partId));
  const condition=document.createElement('span');condition.textContent=row.description;condition.tabIndex=0;setTooltip(condition,row.tooltip);
  const info=document.createElement('button');info.type='button';info.className='health-condition-info';info.textContent='i';info.setAttribute('aria-label',row.bleeding?'Saignement · détails de la lésion':'Détails de la lésion');info.dataset.bleeding=String(row.bleeding);setTooltip(info,row.tooltip);
  info.onclick=()=>openObjectInformation({title:row.tooltip.title??row.description,description:row.tooltip.body,rows:[...(healthPartTooltip(pawn,row.partId).rows??[]),...(row.tooltip.rows??[])].map(fact=>({...fact,category:'État de santé',description:row.tooltip.body}))});
  element.append(name,condition,info);return element;
}

export function createHealthInspection(panel:HTMLElement,selected?:()=>Pawn|undefined,send?:(c:Command)=>void,allowSelfTend=true,surgery?:SurgeryInspectionActions):void {
  const scope=`health-${++inspectionSequence}`;
  const details=document.createElement('details');details.id='health-inspection';details.open=true;
  details.className='health-core-dossier';
  const summary=document.createElement('summary');summary.textContent='Santé';details.append(summary);
  const navigation=document.createElement('div');navigation.className='health-subtabs';navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','Dossier médical');details.append(navigation);
  const layout=document.createElement('div');layout.className='health-dossier';
  const overview=document.createElement('section');overview.className='health-overview';
  overview.dataset.healthView='overview';overview.setAttribute('role','tabpanel');overview.id=`${scope}-view-overview`;overview.setAttribute('aria-labelledby',`${scope}-tab-overview`);
  if(selected&&send){
    const food=document.createElement('label');food.dataset.health='food-policy';food.append('Alimentation');overview.append(food);
    const label=document.createElement('label'),input=document.createElement('select');input.id='medical-policy';
    for(const [value,name] of Object.entries(MEDICAL_CARE)){const o=document.createElement('option');o.value=value;o.textContent=name;input.append(o);}
    input.onchange=()=>{const p=selected();if(p)send({type:'medical-care',pawnId:p.id,care:input.value as MedicalCare});};
    label.append('Médecine ',input);setTooltip(input,{title:'Médecine',body:'Détermine les soins autorisés et la meilleure catégorie de médicament que les médecins peuvent utiliser. Les doses sont consommées pendant les soins.'});overview.append(label);
    if(allowSelfTend){const selfLabel=document.createElement('label'),selfInput=document.createElement('input');selfInput.type='checkbox';selfInput.id='self-tend-policy';
      selfInput.onchange=()=>{const p=selected();if(p)send({type:'self-tend-policy',pawnId:p.id,enabled:selfInput.checked});};
      selfLabel.append('Auto-soin ',selfInput);setTooltip(selfLabel,{title:'Auto-soin',body:'Autorise cette personne à soigner ses propres lésions. Le travail Médecin doit être activé.',rows:[{label:'Facteur de qualité du soin',value:'× 0,70 avant variation et plafond du médicament'}]});overview.append(selfLabel);
      const hint=document.createElement('small');hint.dataset.health='self-tend-hint';overview.append(hint);
    }
  }
  const status=document.createElement('p');status.dataset.health='status';status.className='health-status';overview.append(status);
  const capacities=document.createElement('dl');capacities.dataset.health='capacities';capacities.className='health-capacities';overview.append(capacities);
  const conditions=document.createElement('section');conditions.className='health-conditions';
  const conditionsTitle=document.createElement('h4');conditionsTitle.textContent='État de santé';conditionsTitle.className='health-accessible-heading';conditions.append(conditionsTitle);
  const empty=document.createElement('p');empty.dataset.health='healthy';empty.className='health-empty';empty.textContent='Aucune affection';conditions.append(empty);
  const injuries=document.createElement('div');injuries.dataset.health='injuries';injuries.className='health-injury-list';conditions.append(injuries);
  createInfectionInspection(conditions);createFluInspection(conditions);createImmuneDiseasesInspection(conditions);createParasitesInspection306(conditions);
  for(const name of ['food-poisoning','cryptosleep-sickness','malnutrition','thermal','stagger','anesthetic','alcohol']){
    const p=document.createElement('p');p.dataset.health=name;conditions.append(p);
  }
  const bleeding=document.createElement('p');bleeding.dataset.health='bleeding';bleeding.className='health-bleeding';conditions.append(bleeding);
  layout.append(overview,conditions);details.append(layout);
  const operations=document.createElement('section');operations.dataset.health='surgery';operations.className='health-operations';operations.dataset.healthView='operations';operations.hidden=true;operations.id=`${scope}-view-operations`;operations.setAttribute('role','tabpanel');operations.setAttribute('aria-labelledby',`${scope}-tab-operations`);
  if(selected&&surgery){
    const request=document.createElement('p');request.dataset.health='surgery-request';operations.append(request);
    const empty=document.createElement('p');empty.dataset.health='surgery-empty';empty.textContent='Aucune opération disponible.';operations.append(empty);
    for(const part of SURGERY_PARTS){
      const row=document.createElement('p'),button=document.createElement('button');row.className='health-operation-row';button.type='button';button.dataset.surgeryPart=part;
      button.textContent=`Amputer : ${BODY_PARTS[part].label.toLocaleLowerCase('fr-FR')}`;button.disabled=true;
      const reason=document.createElement('small');reason.dataset.surgeryReason=part;
      button.onclick=()=>{const refusal=requestInspectedAmputation(selected(),part,surgery);if(refusal){request.textContent=refusal;request.hidden=false;}};
      row.append(button,document.createTextNode(' '),reason);operations.append(row);
    }
    if(surgery.install)for(const choice of artificialOperationChoices()){
      const row=document.createElement('p'),button=document.createElement('button');row.className='health-operation-row';row.hidden=true;
      button.type='button';button.dataset.surgeryInstall=`${choice.implant}:${choice.part}`;button.disabled=true;button.textContent=`Poser : ${choice.label}`;
      const reason=document.createElement('small');reason.dataset.surgeryInstallReason=`${choice.implant}:${choice.part}`;
      button.onclick=()=>{const refusal=requestInspectedInstallation(selected(),choice.part,choice.implant,surgery);if(refusal){request.textContent=refusal;request.hidden=false;}};
      row.append(button,document.createTextNode(' '),reason);operations.append(row);
    }
    if(surgery.remove)for(const choice of artificialOperationChoices().filter(c=>isProstheticItem273(c.implant))){
      const row=document.createElement('p'),button=document.createElement('button');row.className='health-operation-row';row.hidden=true;
      button.type='button';button.dataset.surgeryRemove=`${choice.implant}:${choice.part}`;button.textContent=`Retirer : ${choice.label}`;
      button.onclick=()=>{const refusal=requestInspectedProstheticRemoval273(selected(),choice.part,choice.implant,surgery);if(refusal){request.textContent=refusal;request.hidden=false;}};
      row.append(button);operations.append(row);
    }
    const cancel=document.createElement('button');cancel.type='button';cancel.dataset.surgeryCancel='true';cancel.textContent='Annuler la demande';cancel.disabled=true;
    cancel.onclick=()=>{cancelInspectedAmputation(selected(),surgery);};operations.append(cancel);
    setTooltip(cancel,{title:'Annuler l’opération',body:'Annule la demande en cours. Les ingrédients déjà consommés restent consommés et l’anesthésie continue à se dissiper.'});
  }else{
    const empty=document.createElement('p');empty.textContent='Aucune opération disponible.';operations.append(empty);
  }
  layout.insertBefore(operations,conditions);
  for(const [id,label] of [['overview','Vue d’ensemble'],['operations','Opérations']] as const){
    const button=document.createElement('button');button.type='button';button.id=`${scope}-tab-${id}`;button.dataset.healthTab=id;button.setAttribute('role','tab');button.setAttribute('aria-controls',`${scope}-view-${id}`);button.setAttribute('aria-selected',String(id==='overview'));button.tabIndex=id==='overview'?0:-1;button.textContent=label;
    button.onclick=()=>{dismissTooltip();for(const tab of navigation.querySelectorAll<HTMLButtonElement>('[data-health-tab]')){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}overview.hidden=id!=='overview';operations.hidden=id!=='operations';};
    button.onkeydown=event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight'&&event.key!=='Home'&&event.key!=='End')return;event.preventDefault();const tabs=Array.from(navigation.querySelectorAll<HTMLButtonElement>('button'));const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs[1]:tabs.find(tab=>tab!==button);next?.click();next?.focus();};
    navigation.append(button);
  }
  panel.append(details);
}

export function healthStatusText(pawn:Pawn,world?:World):string {
  if(pawn.state==='dead')return [world?bodyDescription(world,pawn):'Décédé',firefoamProtectionText290(pawn.health,true)].filter(Boolean).join(' · ');
  const health=pawn.health;
  if(!health)return 'Aucune lésion';
  return `${pawn.state==='downed'?'À terre · ':''}${cryptosleepSick256(health.cryptosleepSickness)||health.flu?.severity||activeImmuneDisease(health)||health.parasites306?'Malade · ':''}Douleur ${Math.round(medicalPain(health)*100)} % · Sang perdu ${(health.bloodLoss/BLOOD_UNIT*100).toFixed(1)} % · Saignement ${(medicalBleed(health)*100).toFixed(0)} %/jour${health.coveredInFirefoam290?' · '+firefoamProtectionText290(health):''}`;
}

/** Selected pawn only, at HUD cadence. Save strings never enter innerHTML. */
export function updateHealthInspection(panel:HTMLElement,pawn:Pawn,world?:World):void {
  const details=panel.querySelector('#health-inspection');if(!details)return;
  const health=pawn.health;
  const alcohol=alcoholInspection265(pawn),alcoholRow=details.querySelector('[data-health="alcohol"]');if(alcoholRow)alcoholRow.textContent=alcohol.join(' · ');
  const anesthetic=details.querySelector('[data-health="anesthetic"]');if(anesthetic)anesthetic.textContent=healthAnestheticText(pawn);
  const crypto=details.querySelector('[data-health="cryptosleep-sickness"]'),sickness=health?.cryptosleepSickness;if(crypto)crypto.textContent=sickness?`${sickness.remainingCore>0?`Mal de cryptosommeil · ${(sickness.remainingCore/2500).toFixed(1)} h restantes`:'Vomissement résiduel'}${sickness.vomit?' · Vomit':''}`:'';
  const surgery=details.querySelector('[data-health="surgery"]');if(surgery?.querySelector('[data-health="surgery-request"]')){
    const view=healthSurgeryView(pawn,world),request=surgery.querySelector<HTMLElement>('[data-health="surgery-request"]')!;request.textContent=view.status;request.hidden=!pawn.surgeryRequest;
    surgery.querySelector<HTMLElement>('[data-health="surgery-empty"]')!.hidden=view.choices.some(choice=>choice.reason===undefined)||view.installations.some(choice=>choice.reason===undefined&&surgery.querySelector(`[data-surgery-install="${choice.implant}:${choice.part}"]`))||view.removals.some(choice=>choice.reason===undefined)||!!pawn.surgeryRequest;
    for(const choice of view.choices){
      const button=surgery.querySelector<HTMLButtonElement>(`[data-surgery-part="${choice.part}"]`)!;
      button.disabled=choice.reason!==undefined;button.parentElement!.hidden=choice.reason!==undefined&&(pawn.surgeryRequest?.part!==choice.part||pawn.surgeryRequest.implant!==undefined);
      setTooltip(button,{title:`Amputation · ${choice.label}`,body:choice.reason??'Retire définitivement ce membre directement infecté et ses parties dépendantes. Continuer les soins et attendre l’immunité reste possible.',rows:[{label:'Préparation',value:'Lit, médecin et une dose autorisée'},{label:'Risques',value:'Échec opératoire et lésions'},{label:'Après annulation',value:'Anesthésie et dose déjà administrée conservées'}]});
      surgery.querySelector(`[data-surgery-reason="${choice.part}"]`)!.textContent=choice.reason??'Infection présente sur ce membre.';
    }
    for(const button of surgery.querySelectorAll<HTMLButtonElement>('[data-surgery-install]'))button.parentElement!.hidden=true;
    for(const choice of view.installations){
      const key=`${choice.implant}:${choice.part}`,button=surgery.querySelector<HTMLButtonElement>(`[data-surgery-install="${key}"]`);if(!button)continue;
      button.disabled=choice.reason!==undefined;
      button.parentElement!.hidden=choice.reason!==undefined&&(pawn.surgeryRequest?.part!==choice.part||pawn.surgeryRequest.implant!==choice.implant);
      setTooltip(button,{title:`Pose · ${choice.label}`,body:choice.reason??'Pose cette prothèse à la place du membre ou de sa prothèse actuelle. La fonction reste partielle et l’opération peut échouer.',rows:[{label:'Préparation',value:choice.guidance},{label:'Conditions',value:'Patient installé au lit, chevet accessible et anesthésie'},{label:'Risques',value:'Échec opératoire et lésions ; aucun résultat garanti'}]});
      surgery.querySelector(`[data-surgery-install-reason="${key}"]`)!.textContent=choice.reason??choice.guidance;
    }
    for(const button of surgery.querySelectorAll<HTMLButtonElement>('[data-surgery-remove]'))button.parentElement!.hidden=true;
    for(const choice of view.removals){
      const button=surgery.querySelector<HTMLButtonElement>(`[data-surgery-remove="${choice.kind}:${choice.part}"]`);if(!button)continue;
      button.disabled=choice.reason!==undefined;button.parentElement!.hidden=choice.reason!==undefined;
      setTooltip(button,{title:`Retrait · ${choice.label}`,body:choice.reason??'Une dose autorisée, un lit et un médecin. En cas de réussite, la même sorte de prothèse est récupérée au sol ; le membre redevient absent. Risque d’échec opératoire.'});
    }
    const cancel=surgery.querySelector<HTMLButtonElement>('[data-surgery-cancel]')!;cancel.disabled=!view.canCancel;cancel.hidden=!view.canCancel;
  }
  updateInfectionInspection(details,health);
  updateFluInspection(details,health);
  updateImmuneDiseasesInspection(details,health);updateParasitesInspection306(details,health);
  for(const kind of IMMUNE_DISEASE_KINDS){
    const section=details.querySelector<HTMLElement>(`[data-health="${kind}"]`);if(!section||section.hidden)continue;
    const summary=section.querySelector<HTMLElement>('[data-disease="summary"]')!,care=section.querySelector<HTMLElement>('[data-disease="care"]')!,guidance=section.querySelector<HTMLElement>('[data-disease="guidance"]')!;
    summary.tabIndex=0;setTooltip(summary,{title:IMMUNE_DISEASE_LABELS[kind],body:`${summary.textContent} ${care.textContent} ${guidance.textContent}`});care.hidden=true;guidance.hidden=true;
  }
  for(const infection of health?.infections?.cases??[]){
    const row=details.querySelector<HTMLElement>(`[data-infection="${infection.id}"]`)!;
    const treatment=row.textContent??'';
    row.className='health-injury-row';
    const name=document.createElement('strong');name.textContent=BODY_PARTS[infection.part].label;name.tabIndex=0;setTooltip(name,healthPartTooltip(pawn,infection.part));
    const description=document.createElement('span');description.textContent=`Infection (${infectionPercent(infection.severity)})`;description.tabIndex=0;
    const tip={title:'Infection',body:treatment,rows:[{label:'Gravité',value:infectionPercent(infection.severity)},{label:'Immunité',value:infectionPercent(health!.infections!.immunity)}]};setTooltip(description,tip);
    const info=document.createElement('span');info.className='health-condition-info';info.textContent='ⓘ';info.tabIndex=0;info.setAttribute('aria-label','Détails de l’infection');setTooltip(info,tip);row.replaceChildren(name,description,info);
  }
  const infectionHint=details.querySelector<HTMLElement>('[data-health="infection-hint"]');if(infectionHint)infectionHint.hidden=true;
  const flu=details.querySelector<HTMLElement>('[data-health="flu"]');if(flu&&!flu.hidden){
    const summary=flu.querySelector<HTMLElement>('[data-flu="summary"]')!,care=flu.querySelector<HTMLElement>('[data-flu="care"]')!,guidance=flu.querySelector<HTMLElement>('[data-flu="guidance"]')!;
    summary.tabIndex=0;setTooltip(summary,{title:'Grippe',body:`${summary.textContent} ${care.textContent} ${guidance.textContent}`});care.hidden=true;guidance.hidden=true;
  }
  const poison=health?.foodPoisoning;
  details.querySelector('[data-health="food-poisoning"]')!.textContent=poison?`Intoxication alimentaire · ${{none:'récupération',initial:'phase initiale',major:'phase majeure',recovering:'récupération'}[foodPoisoningStage(poison)]} · ${(100*poison.severity/FOOD_POISON_UNIT).toFixed(1)} %${poison.vomit?' · vomissements':''}`:'';
  details.querySelector('[data-health="malnutrition"]')!.textContent=health?.malnutrition?`Malnutrition ${MALNUTRITION_LABELS[malnutritionStage(health.malnutrition)]} · ${(health.malnutrition/MALNUTRITION_UNIT*100).toFixed(1)} %`:'';
  const stage=heatStage(health?.heatstroke),coldStage=heatStage(health?.hypothermia);
  details.querySelector('[data-health="thermal"]')!.textContent=(stage?`Coup de chaleur ${HEAT_LABELS[stage]} · ${(100*health!.heatstroke!/HEAT_UNIT).toFixed(1)} %. `:'')+(coldStage?`Hypothermie ${HEAT_LABELS[coldStage]} · ${(100*health!.hypothermia!/HEAT_UNIT).toFixed(1)} %.`:'');
  details.querySelector('[data-health="stagger"]')!.textContent=pawn.stagger?'Ralenti temporairement par un impact.':'';
  const policy=details.querySelector<HTMLSelectElement>('#medical-policy');if(policy){policy.value=medicalCare(pawn);policy.disabled=pawn.state==='dead'||!isCarePatient(pawn);setTooltip(policy,{title:'Médecine',body:'Détermine les soins autorisés et la meilleure catégorie de médicament que les médecins peuvent utiliser. Les doses sont consommées pendant les soins.',rows:[{label:'Soins autorisés',value:MEDICAL_CARE[medicalCare(pawn)]}]});}
  const self=details.querySelector<HTMLInputElement>('#self-tend-policy');if(self){self.checked=!!pawn.selfTend;self.disabled=pawn.state==='dead';}
  const hint=details.querySelector('[data-health="self-tend-hint"]');if(hint)hint.textContent=pawn.selfTend&&pawn.priorities.doctor===0?'Auto-soins autorisés, mais Médecin est désactivé dans Travail.':'';
  const status=details.querySelector<HTMLElement>('[data-health="status"]')!;
  status.textContent=pawn.state==='dead'?(world?bodyDescription(world,pawn):'Décédé'):pawn.state==='downed'?'À terre':cryptosleepSick256(health?.cryptosleepSickness)||health?.flu?.severity||activeImmuneDisease(health)||health?.parasites306?'Malade':'';
  status.hidden=!status.textContent;setTooltip(status,{title:'État général',body:healthStatusText(pawn,world)});
  const bleeding=details.querySelector<HTMLElement>('[data-health="bleeding"]')!,bleed=health?medicalBleed(health):0;
  bleeding.textContent=bleed>0?`Saignement : ${percent(bleed)}/jour`:health?.bloodLoss?`Sang perdu : ${percent(health.bloodLoss/BLOOD_UNIT)}`:'';
  setTooltip(bleeding,{title:'Perte de sang',body:'Le saignement fait progresser la perte de sang. Le traitement des plaies arrête leur saignement ; la récupération du sang reste progressive.',rows:[{label:'Saignement actuel',value:`${percent(bleed)}/jour`},{label:'Sang perdu',value:percent((health?.bloodLoss??0)/BLOOD_UNIT)}]});
  const capacities=details.querySelector<HTMLElement>('[data-health="capacities"]')!;
  const rows=healthCapacityRows(pawn),signature=JSON.stringify(rows);
  if(capacities.dataset.signature!==signature){capacities.dataset.signature=signature;capacities.replaceChildren(...rows.flatMap(({label,value})=>{
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dt.tabIndex=0;dd.tabIndex=0;dd.dataset.reduced=String(value!=='100 %'&&value!=='Aucune');return [dt,dd];
  }));}
  for(const [index,row] of rows.entries()){
    const key=CAPACITY_LABELS.find(([,label])=>label===row.label)?.[0];
    const tooltip=key?healthCapacityTooltip(pawn,key):{title:'Douleur',body:'La douleur provient des lésions, des parties fraîchement perdues et de certaines affections. L’anesthésie atténue la douleur ; une douleur totale d’au moins 80 % provoque une incapacité.',rows:[{label:'Douleur actuelle',value:row.value},{label:'Facteur anesthésique',value:`× ${anestheticModifiers(health?.anesthetic).painFactor.toFixed(2)}`}]};
    setTooltip(capacities.children[index*2] as HTMLElement,tooltip);setTooltip(capacities.children[index*2+1] as HTMLElement,tooltip);
  }
  const injuries=details.querySelector<HTMLElement>('[data-health="injuries"]')!,injuryRows=clinicalRows(pawn),injurySignature=JSON.stringify([injuryRows,health?.bloodLoss]);
  if(injuries.dataset.signature!==injurySignature){injuries.dataset.signature=injurySignature;injuries.replaceChildren(...injuryRows.map(row=>clinicalElement(pawn,row)));}
  const healthy=details.querySelector<HTMLElement>('[data-health="healthy"]')!;
  healthy.hidden=alcohol.length>0||injuryRows.length>0||!!health?.infections?.cases.length||!!health?.flu||!!health?.immuneDiseases||!!health?.parasites306||!!poison||!!health?.malnutrition||!!stage||!!coldStage||!!pawn.stagger||!!health?.cryptosleepSickness||!!health?.anesthetic||pawn.state==='dead';
  for(const name of ['food-poisoning','cryptosleep-sickness','malnutrition','thermal','stagger','anesthetic','alcohol']){
    const row=details.querySelector<HTMLElement>(`[data-health="${name}"]`)!;row.hidden=!row.textContent;row.tabIndex=0;if(row.textContent)setTooltip(row,{title:row.textContent.split(' · ')[0],body:row.textContent});
  }
}
