import {mechRaidGroups261} from '../sim/mechanical-raid-groups-261';
import {knownPosition256,knownBuilding256,knownNutrition256,knownPile256} from './exploration-readers-256';
import type {MapIncident,CampaignSummary} from '../sim/world-map-state';
import {mapDisplayName} from './map-registry-adapter';
import {alertManhunter,alertDownedColonist} from '../sim/status-alert-rules';
import { isColonist,activeThreat } from '../sim/affiliation';
import { isBedKind } from '../sim/bed-kinds';
import { bedSlotsCount } from '../sim/bed-slots';
import { storageCells } from '../sim/shelf-storage';
import { constructionRecipe } from '../sim/construction-materials';
import { firePosition } from '../sim/fire-rules';
import { FLU_UNIT,fluStage } from '../sim/flu-rules';
import { IMMUNE_DISEASE_UNIT,immuneDiseaseStage } from '../sim/immune-diseases-rules';
import { IMMUNE_DISEASE_KINDS } from '../sim/immune-diseases-types';
import { INFECTION_UNIT,infectionStage } from '../sim/infection-rules';
import { medicalBleed } from '../sim/injury-state';

import {captureFoodReadability,type FoodReadability} from '../sim/food-readability';
import { mentalCrisisView } from '../sim/mental-presentation';
import { prisonBreakActive } from '../sim/prison-break-state';
import type { Pawn,World } from '../sim/types';
import { buildingLabels } from './building-labels';
import type { ArchitectCategory,Panel } from './layout';
import { miniTurretView,turretSeconds } from '../sim/mini-turret-presentation';
import { actorNotificationTarget,cellNotificationTarget,objectNotificationTarget,personNotificationTarget,NotificationFocusCycle,type NotificationTarget,type FocusNotification } from './notification-focus';
import { readColonistAvailability,type AwayColonistAvailability } from './colonist-availability';
import { readMoodRiskAlerts } from './mood-risk-alerts';
import { setTooltip,type TooltipContent } from './tooltip';
import {readResearchReadiness} from './research-readiness';
import {partyView292} from './party-inspection-292';

export interface NotificationContext { panel:Exclude<Panel,null>;category?:ArchitectCategory;tool?:'stockpile';worldTab?:'group'|'individual'; }
export interface StatusAlert { key:string;text:string;targets:NotificationTarget[];context?:NotificationContext;tab?:'health'|'needs'|'prisoner';tooltip?:TooltipContent;campaign?:({mapId:number}|{site:'home'|'secondary'})&{actorId?:number}; }
export function readCampaignMapAlerts(summary:Pick<CampaignSummary,'maps'|'incidents'>):StatusAlert[]{
 return [...summary.maps.filter(map=>map.campPressure?.alert).map(map=>({key:`camp-pressure:${map.id}`,text:`${mapDisplayName(map)} · détecté · risque mécanique · voir`,targets:[],campaign:{mapId:map.id}})),...summary.incidents.map(incident=>{const map=summary.maps.find(map=>map.id===incident.mapId),place=map?mapDisplayName(map):`Carte ${incident.mapId}`,label=incident.kind==='raid'?'assaillant(s)':incident.kind==='mechanoid'?'mécanoïde(s)':incident.kind==='manhunter'?'animal(aux) en rage':incident.kind==='downed'?'colon(s) à terre':'visiteur(s)';return {key:`campaign:${incident.mapId}:${incident.kind}:${incident.actorId}`,text:`${place} · ${incident.count} ${label} · voir`,targets:[],campaign:{mapId:incident.mapId,actorId:incident.actorId}};})];
}
const present=<T>(target:T|undefined):target is T=>target!==undefined;
const people=(world:World,pawns:readonly Pawn[])=>[...pawns].sort((a,b)=>a.id-b.id).map(p=>personNotificationTarget(world,p.id)).filter(present);
const actors=(values:readonly {id:number}[])=>[...values].sort((a,b)=>a.id-b.id).map(p=>actorNotificationTarget(p.id));

const awayContext=(owner:AwayColonistAvailability['owner']):NotificationContext=>({panel:'world',worldTab:owner==='group-away'?'group':'individual'});
const awayLabel=(owner:AwayColonistAvailability['owner'])=>owner==='scout-away'?'reconnaissance hors carte':owner==='commercial-away'?'voyage commercial hors carte':'groupe hors carte';
const phaseLabels:Partial<Record<AwayColonistAvailability['phase'],string>>={outbound:'trajet aller','at-post':'au comptoir',returning:'trajet retour','awaiting-entry':'entrée sur la carte en attente',travelling:'en déplacement','at-site':'sur le site'};

/** Explanations use original owners, never an old position for a traveller.
 * The arrival banner remains the sole feedback for contained starting pawns. */
export function readAvailabilityStatusAlerts(world:World):StatusAlert[] {
  const availability=readColonistAvailability(world);if(availability.kind!=='unavailable')return [];
  const details:StatusAlert[]=availability.local.map(person=>{
    const tab:NonNullable<StatusAlert['tab']>=person.causes.includes('downed')?'health':person.causes.includes('mental-crisis')?'needs':'prisoner';
    const causes=person.causes.map(c=>c==='downed'?'à terre':c==='mental-crisis'?'en crise mentale':'détenu').join(', ');
    const target=personNotificationTarget(world,person.id);
    return {key:`availability-local:${person.id}`,text:`${person.name} · ${causes}`,targets:target?[target]:[],context:{panel:'history'},tab};
  });
  for(const person of availability.away)details.push({key:`availability-away:${person.id}`,
    text:`${person.name} · ${awayLabel(person.owner)}${phaseLabels[person.phase]?` · ${phaseLabels[person.phase]}`:''}`,
    targets:[],context:awayContext(person.owner)});
  for(const person of availability.suspended??[]){
    const target=personNotificationTarget(world,person.id);
    details.push({key:`availability-suspended:${person.id}`,text:`${person.name} · vivant, en cryptosommeil dans ${person.owner==='ship-casket'?'le caisson spatial':'le caisson de colonie'}`,
      targets:target?[target]:[]});
  }
  for(const person of availability.deaths){
    const target=person.owner==='map'?personNotificationTarget(world,person.id):undefined;
    details.push({key:`availability-death:${person.id}`,text:`${person.name} · décès confirmé${person.owner==='group-loss'?' dans le groupe':person.owner==='scout-away'?' en reconnaissance':person.owner==='commercial-away'?' en voyage commercial':''}`,
      targets:target?[target]:[],context:person.owner==='map'?{panel:'history'}:awayContext(person.owner==='group-loss'?'group-away':person.owner),tab:'health'});
  }
  const first=availability.local.length||availability.away.length||availability.suspended?.length?details[0]:undefined;
  const summary:StatusAlert={key:'colonist-availability',text:first?'Aucun colon libre sur cette carte':'Aucun colon vivant actuellement recensé dans la colonie ou ses voyages',targets:first?.targets??[],...first?first.context?{context:first.context}:{}:{context:{panel:'menu' as const}},...first?.tab?{tab:first.tab}:{}};
  return [summary,...details];
}

/** All predicates and targets share the same confirmed snapshot. Labels are
 * never parsed to find an entity, a medical condition or a management panel. */
export function readStatusAlerts(world:World,food:FoodReadability=captureFoodReadability(world,{pileVisible:p=>knownPile256(world,p),structureVisible:s=>knownBuilding256(world,s)})):StatusAlert[] {
  const rows:StatusAlert[]=[...readAvailabilityStatusAlerts(world),...(world.campaignMap?.revision===2?readCampaignMapAlerts({maps:world.campaignMap.maps,incidents:[]}):[])],colonists=world.pawns.filter(isColonist),living=colonists.filter(p=>p.state!=='dead');
  const campaignIncidents:readonly (MapIncident|{site:'home'|'secondary';kind:MapIncident['kind'];count:number;actorId:number})[]=world.campaignMap?.incidents??[];
  for(const incident of campaignIncidents){
    const target='mapId' in incident?{mapId:incident.mapId}:{site:incident.site},maps=world.campaignMap&&'maps' in world.campaignMap?world.campaignMap.maps:[];
    const map='mapId' in incident?maps.find(map=>map.id===incident.mapId):undefined;
    const place=map?mapDisplayName(map):'mapId' in incident?`Carte ${incident.mapId}`:incident.site==='home'?'Foyer':'Second site',label=incident.kind==='raid'?'assaillant(s)':incident.kind==='mechanoid'?'mécanoïde(s)':incident.kind==='manhunter'?'animal(aux) en rage':incident.kind==='downed'?'colon(s) à terre':'visiteur(s)';
    rows.push({key:`campaign:${'mapId' in incident?incident.mapId:incident.site}:${incident.kind}:${incident.actorId}`,text:`${place} · ${incident.count} ${label} hors carte · voir`,targets:[],campaign:{...target,actorId:incident.actorId}});
  }
  const add=(key:string,text:string,targets:NotificationTarget[],context?:NotificationContext,tab?:StatusAlert['tab'])=>rows.push({key,text,targets,...context?{context}:{},...tab?{tab}:{}});
  const party=partyView292(world);
  if(party&&knownPosition256(world,party.site))add('party',`Fête · ${party.members.length} participant(s) · ${party.remaining}`,
    [cellNotificationTarget('party-site',party.site),...people(world,living.filter(p=>p.id===party.organizerId))]);
  const counted=(key:string,pawns:Pawn[],text:(count:number)=>string,tab?:StatusAlert['tab'])=>{if(pawns.length)add(key,text(pawns.length),people(world,pawns),{panel:'history'},tab);};
  counted('sad-wander',living.filter(p=>p.mental?.crisis?.kind==='sad-wander'),n=>`${n} colon(s) en errance triste`,'needs');
  counted('food-binge',living.filter(p=>p.mental?.crisis?.kind==='food-binge'),n=>`${n} colon(s) en frénésie alimentaire`,'needs');
  for(const pawn of living.filter(p=>p.mental?.crisis&&['tantrum','berserk','murderous-rage'].includes(p.mental.crisis.kind))){
    const crisis=mentalCrisisView(world,pawn,s=>buildingLabels[s.kind])!;
    add(`mental:${pawn.id}`,`${pawn.name} · ${crisis.label}${crisis.target&&knownPosition256(world,crisis.target.cell)?` · cible : ${crisis.target.label}${crisis.target.type==='structure'?` (${crisis.target.cell.x}, ${crisis.target.cell.z})`:''}`:''}`,people(world,[pawn]),undefined,'needs');
  }
  rows.push(...readMoodRiskAlerts(world));
  const rebels=world.pawns.filter(p=>prisonBreakActive(p)&&activeThreat(p)&&knownPosition256(world,p));
  if(rebels.length)add('prison-break',`Révolte de prison · ${rebels.length} détenu${rebels.length>1?'s':''} en fuite`,people(world,rebels));
  const machines=world.mechanoids?.filter(m=>m.state!=='dead'&&m.state!=='downed'&&knownPosition256(world,m))??[];
  if(machines.length)add('mechanical-threat',`${machines.length} machine(s) hostiles${mechRaidGroups261(world).some(g=>g.phase==='assault')?' · assaut mécanique':mechRaidGroups261(world).some(g=>g.phase==='staging')?' · regroupement avant assaut':''}`,actors(machines));
  for(const structure of world.structures)if(structure.turret?.wick&&knownBuilding256(world,structure)){
    const view=miniTurretView(world,structure)!;
    add(`turret-wick:${structure.id}`,`Mini-tourelle (${structure.x}, ${structure.z}) · mèche engagée · danger 3,9 · ${turretSeconds(view.wick!.remainingCore)}`,[objectNotificationTarget('structure',structure.id,structure)]);
  }
  for(const structure of world.structures)if(structure.kind==='ancient-cryptosleep-casket'&&structure.casketWick&&knownBuilding256(world,structure))add(`casket-wick:${structure.id}`,`Capsule ancienne (${structure.x}, ${structure.z}) · mèche engagée · danger 2,66 · ${turretSeconds(Math.max(0,structure.casketWick.endCore-world.tick*10))}`,[objectNotificationTarget('structure',structure.id,structure)]);
  const enraged=world.wildlife?.animals.filter(a=>alertManhunter(a)&&knownPosition256(world,a))??[];
  if(enraged.length)add('manhunter',`${enraged.length} ${enraged.length>1?'animaux':'animal'} en rage`,actors(enraged));
  counted('malnutrition',living.filter(p=>(p.health?.malnutrition??0)>0),n=>`${n} colon(s) en malnutrition`,'health');
  counted('hypothermia',living.filter(p=>(p.health?.hypothermia??0)>=40000000),n=>`${n} colon(s) en hypothermie`,'health');
  const infected=living.filter(p=>!!p.health?.infections?.cases.length);
  counted('infection-critical',infected.filter(p=>p.health!.infections!.immunity<INFECTION_UNIT&&p.health!.infections!.cases.some(c=>['extreme','critical'].includes(infectionStage(c.severity)))),n=>`Urgence médicale : ${n} colon(s) avec une infection grave`,'health');
  counted('infection',infected,n=>`${n} colon(s) avec une infection · consulter Santé`,'health');
  const flu=living.filter(p=>!!p.health?.flu?.severity);
  counted('flu-critical',flu.filter(p=>p.health!.flu!.immunity<FLU_UNIT&&fluStage(p.health!.flu!.severity)==='extreme'),n=>`Urgence médicale : ${n} colon(s) avec une grippe extrême`,'health');
  counted('flu',flu,n=>`${n} colon(s) grippé(s) · consulter Santé`,'health');
  for(const kind of IMMUNE_DISEASE_KINDS){
    const cases=living.filter(p=>!!p.health?.immuneDiseases?.[kind]?.severity),label=kind==='malaria'?'paludisme':kind==='plague'?'peste':'la maladie du sommeil';
    counted(`${kind}-critical`,cases.filter(p=>{const d=p.health!.immuneDiseases![kind]!;return d.immunity<IMMUNE_DISEASE_UNIT&&['extreme','critical'].includes(immuneDiseaseStage(kind,d.severity));}),n=>`Urgence médicale : ${n} colon(s) avec ${label} grave`,'health');
    counted(kind,cases,n=>`${n} colon(s) avec ${label} · consulter Santé`,'health');
  }
  counted('downed',living.filter(alertDownedColonist),n=>`${n} colon(s) à terre`,'health');
  counted('bleeding',living.filter(p=>p.health&&medicalBleed(p.health)>=.1),n=>`${n} colon(s) saignent`,'health');
  counted('deaths',colonists.filter(p=>p.state==='dead'),n=>`${n} colon(s) décédé(s)`,'health');
  if(knownNutrition256(world)<living.length*1.6)add('food-reserves','Réserves de nourriture faibles',[],{panel:'assign'});
  if(food.blockedPawnIds.length){
    const ids=new Set(food.blockedPawnIds),names=world.pawns.filter(p=>ids.has(p.id)).map(p=>p.name);
    rows.push({key:'food-policy-blocked',text:`Régime alimentaire à vérifier · ${food.blockedPawnIds.length} colon(s)`,targets:[],context:{panel:'assign'},tooltip:{title:'Aucun type autorisé parmi les piles évaluées',body:`Personnes concernées : ${names.join(', ')}. Les piles fraîches au sol et leur propre portion portée ne contiennent aucun type autorisé par le régime. Accès, réservations, partage et autonomie non évalués. Les repas déjà engagés sont conservés.`}});
  }
  counted('hungry',living.filter(p=>p.hunger<25),n=>`${n} colon(s) affamé(s)`,'needs');
  const research=world.research?.project?undefined:readResearchReadiness(world);
  if(research?.needProject)rows.push({key:'research-project',text:'Choisir une recherche',targets:[],context:{panel:'research'},tooltip:{title:'Choisir une recherche',body:'Un bureau physique est présent et un projet est sélectionnable, mais aucun projet n’est choisi. Ouvrir Recherche permet de consulter les prérequis et de choisir ; cela n’affecte personne et ne garantit pas un travail au bureau.'}});
  const pending=world.jobs.filter(j=>j.status==='pending'&&knownPosition256(world,j));
  if(pending.length)add('pending-jobs',`${pending.length} ordre(s) en attente`,pending.map(j=>objectNotificationTarget('job',j.id,j)),{panel:'work'});
  if(!world.stockpiles.length&&!storageCells(world).some(c=>knownPosition256(world,c)))add('no-stockpile','Aucune réserve de stockage',[],{panel:'architect',tool:'stockpile'});
  if(world.pawns.every(p=>p.priorities.haul===0&&p.priorities.build===0)&&world.jobs.some(j=>knownPosition256(world,j)&&constructionRecipe(j).ingredients.length>0))add('disabled-construction','Construction/transport désactivés : chantiers non approvisionnés',[],{panel:'work'});
  const interrupted=world.pawns.filter(p=>p.interruptedCargo);
  if(interrupted.length)add('interrupted-cargo',`${interrupted.length} cargaison(s) conservée(s) : fin de déplacement ou sol proche à libérer`,people(world,interrupted),{panel:'work'});
  counted('idle',world.pawns.filter(p=>isColonist(p)&&!p.prisoner&&p.state==='idle'&&!p.draft&&!p.flee&&!p.mental?.crisis&&!p.interruptedCargo),n=>`${n} colon(s) disponible(s)`);
  const beds=world.structures.filter(s=>isBedKind(s.kind)&&!s.medical&&!s.prisoner&&knownBuilding256(world,s)).reduce((n,s)=>n+bedSlotsCount(s),0);
  if(beds<living.length)add('beds',`${living.length-beds} couchage(s) manquant(s)`,[],{panel:'architect',category:'furniture'});
  const prisoners=world.pawns.filter(p=>p.prisoner&&p.state!=='dead');
  if(prisoners.length)add('prisoners',`${prisoners.length} prisonnier(s) · ${living.some(p=>p.priorities.warden>0)?'Geôlier activé':'Geôlier désactivé'}`,people(world,prisoners),{panel:'work'},'prisoner');
  return rows;
}

export function readInspectAlerts(world:World):Partial<Record<'inspect-fire'|'inspect-blight'|'inspect-threat',StatusAlert>> {
  const result:ReturnType<typeof readInspectAlerts>={},fires=(world.fires?.items??[]).filter(f=>{const p=firePosition(world,f);return !!p&&knownPosition256(world,p);}),blighted=world.resources.filter(r=>!!r.blight&&knownPosition256(world,r));
  if(fires.length)result['inspect-fire']={key:'fire',text:`Incendie · ${fires.length} foyer${fires.length>1?'s':''} · voir`,targets:fires.map(f=>{
    if(f.attachedPawnId!==undefined)return personNotificationTarget(world,f.attachedPawnId);
    if(f.attachedAnimalId!==undefined)return world.wildlife?.animals.some(a=>a.id===f.attachedAnimalId)?actorNotificationTarget(f.attachedAnimalId):undefined;
    const cell=firePosition(world,f);return cell?cellNotificationTarget(`fire:${f.id}`,cell):undefined;
  }).filter(present),context:{panel:'work'}};
  if(blighted.length)result['inspect-blight']={key:'blight',text:`Fléau des cultures · ${blighted.length} plant(s) · voir`,targets:blighted.map(r=>objectNotificationTarget('resource',r.id,r)),context:{panel:'architect',category:'orders'}};
  const enemies=world.pawns.filter(p=>p.faction==='outlaws'&&!p.prisoner&&activeThreat(p)&&knownPosition256(world,p)),rebels=world.pawns.filter(p=>prisonBreakActive(p)&&activeThreat(p)&&knownPosition256(world,p));
  const machines=world.mechanoids?.filter(m=>m.state!=='dead'&&m.state!=='downed'&&knownPosition256(world,m))??[],mental=world.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&p.mental?.crisis&&['tantrum','berserk','murderous-rage'].includes(p.mental.crisis.kind)),animals=world.wildlife?.animals.filter(a=>alertManhunter(a)&&knownPosition256(world,a))??[];
  const targets=[...people(world,enemies),...people(world,rebels),...actors(machines),...people(world,mental),...actors(animals)];
  if(targets.length)result['inspect-threat']={key:'threat',text:enemies.length?'Menace armée · voir':rebels.length?'Révolte de prison · voir':machines.length?'Menace mécanique · voir':mental.length?`${mentalCrisisView(world,mental[0]!)!.label} · voir`:'Animal en rage · voir',targets};
  return result;
}

export interface StatusAlertsActions {
  focus:FocusNotification;context:(context:NotificationContext)=>void;tab?:(tab:NonNullable<StatusAlert['tab']>)=>void;
  campaign?:(target:NonNullable<StatusAlert['campaign']>)=>void;
}
/** Keyed nodes keep keyboard focus and the per-alert ring through tick refreshes. */
export function createStatusAlerts(host:HTMLElement,jumps:Partial<Record<'inspect-fire'|'inspect-blight'|'inspect-threat',HTMLButtonElement>>,actions:StatusAlertsActions):{update:(world:World,food?:FoodReadability)=>void;updateCampaign:(summary:Pick<CampaignSummary,'maps'|'incidents'>)=>void;reset:()=>void} {
  const cycle=new NotificationFocusCycle(),nodes=new Map<string,{node:HTMLElement;row:StatusAlert}>();
  const activate=(row:StatusAlert)=>{if(row.campaign){actions.campaign?.(row.campaign);return;}const target=cycle.next(row.key,row.targets);if(target){actions.focus(target);if(row.tab&&target.kind==='actor')actions.tab?.(row.tab);}else if(row.context)actions.context(row.context);};
  let inspection:ReturnType<typeof readInspectAlerts>={};
  for(const [id,button] of Object.entries(jumps))if(button)button.onclick=()=>{const row=inspection[id as keyof typeof inspection];if(row)activate(row);};
  function paint(rows:StatusAlert[],nextInspection:ReturnType<typeof readInspectAlerts>={}){
    const keys=new Set(rows.map(row=>row.key));
    for(const [key,record] of nodes)if(!keys.has(key)){record.node.remove();nodes.delete(key);}
    rows.forEach((row,index)=>{
      let record=nodes.get(row.key);if(!record){
        const node=document.createElement('p');node.setAttribute('role','button');node.tabIndex=0;node.style.cursor='pointer';node.dataset.alert=row.key;
        const created={node,row};record=created;nodes.set(row.key,created);node.onclick=()=>activate(created.row);
        node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();activate(created.row);}};
      }
      record.row=row;const node=record.node;if(node.textContent!==row.text)node.textContent=row.text;
      if(row.tooltip)setTooltip(node,row.tooltip);
      if(host.children[index]!==node)host.insertBefore(node,host.children[index]??null);
    });
    inspection=nextInspection;
    for(const [id,button] of Object.entries(jumps)){if(!button)continue;const row=inspection[id as keyof typeof inspection];if(button.hidden!==!row)button.hidden=!row;if(row&&button.textContent!==row.text)button.textContent=row.text;}
  }
  return {reset:()=>cycle.reset(),update:(world,food)=>paint(readStatusAlerts(world,food),readInspectAlerts(world)),updateCampaign:summary=>paint(readCampaignMapAlerts(summary))};
}
