import {isDoubleBedKind} from '../sim/bed-kinds';
import { isColonist } from '../sim/affiliation';
import { isBedKind } from '../sim/bed-kinds';
import { bedAssignmentReason,bedSlotCell,captureBedSlotClaimReader,bedSlotsCount,civilBedShareAllowed,pawnBedSlot } from '../sim/bed-slots';
import { captureActorBeds256 } from '../sim/actor-bed-local-256';
import { registeredCampaign } from '../sim/world-map-context';
import {captureFoodReadability,type FoodReadability} from '../sim/food-readability';
import { ITEM_DEFINITIONS } from '../sim/items';
import { ticksUntilRot } from '../sim/food-preservation';
import { foodStationUsable,isStove } from '../sim/food-workstations';
import { PRODUCTION_RECIPES,stationAccepts } from '../sim/production-recipes';
import { createPlantGrowthReader,harvestable } from '../sim/plants';
import { storageCells,storageCellAccepts } from '../sim/shelf-storage';
import { structureMaxHp } from '../sim/thing-damage-rules';
import { workPriority } from '../sim/work-types';
import type { BedSlot,MaterialPile,Pawn,Structure,World } from '../sim/types';
import type { ArchitectCategory,Panel,Tool } from './layout';
import { readAvailabilityStatusAlerts,type StatusAlert } from './status-alerts';
import type { NotificationTarget } from './notification-focus';
import {readResearchReadiness} from './research-readiness';
import {researchProjects} from './research-projects';

export type FirstDayGuideStatus='ready'|'started'|'missing'|'optional';
export type FirstDayGuideId='work'|'storage'|'beds'|'food'|'cultivation'|'cooking'|'equipment'|'research';
export interface FirstDayGuideAction {panel?:Exclude<Panel,null>;category?:ArchitectCategory;mapTools?:'orders'|'zones';tool?:Tool;worldTab?:'group'|'individual';target?:NotificationTarget;tab?:StatusAlert['tab']}
export interface FirstDayGuideSection {
  id:FirstDayGuideId;title:string;status:FirstDayGuideStatus;detail:string;body:string;
  action:FirstDayGuideAction;actionLabel:string;
}
export interface FirstDayGuideCallbacks {onAction:(action:FirstDayGuideAction)=>void}

const civil=(p:Pawn)=>isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&p.state!=='dead'&&!p.health?.death;
const foodCrop=(kind:string)=>kind==='rice'||kind==='potato'||kind==='corn';
const aliveBuilding=(s:Structure)=>s.kind==='sleeping-spot'||s.kind==='double-sleeping-spot'||(s.damage??0)<structureMaxHp(s);
const localPile=(ids:ReadonlySet<number>,p:MaterialPile)=>p.quantity>0&&(p.owner.type==='ground'||p.owner.type==='pawn'&&ids.has(p.owner.pawnId));

/** A wholly free double bed admits one automatic owner. Its second place is
 * counted after an owner makes the sharing rule decidable. No route prediction. */
function civilianPlaces(world:World,people:readonly Pawn[],retiring:ReadonlySet<number>):number {
  const localOwners=new Set(world.pawns.filter(p=>p.state!=='dead').map(p=>p.bedId));
  const slots=world.structures.filter(s=>isBedKind(s.kind)&&!s.medical&&!s.prisoner&&aliveBuilding(s)&&!retiring.has(s.id))
    .flatMap(bed=>{
      const unownedDouble=isDoubleBedKind(bed.kind)&&!localOwners.has(bed.id);
      return Array.from({length:unownedDouble?1:bedSlotsCount(bed)},(_,slot)=>({bed,slot:slot as BedSlot,cell:bedSlotCell(bed,slot as BedSlot),claimed:undefined as ReturnType<typeof captureBedSlotClaimReader>|undefined}));
    });
  // One capture of the campaign's beds for all the questions below (the same
  // World is read throughout), instead of one per person and place.
  let beds:ReturnType<typeof captureActorBeds256>|undefined;
  const actorBeds=()=>beds??=captureActorBeds256(registeredCampaign(world));
  const options=people.map(p=>slots.flatMap((place,index)=>{
    const {bed,slot,cell}=place;
    const owned=pawnBedSlot(p,bed);
    if(bedAssignmentReason(world,bed,p,slot)||(place.claimed??=captureBedSlotClaimReader(world,bed,slot,actorBeds))(p.id))return [];
    if(isDoubleBedKind(bed.kind)&&(!civilBedShareAllowed(world,bed,p,actorBeds)||owned!==undefined&&owned!==slot))return [];
    return cell&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height?[index]:[];
  }));
  // Only the cardinality is shown, never the matching itself. Any augmenting
  // path has the same maximum-cardinality result; take an immediately free
  // compatible slot first instead of recursively displacing all earlier
  // colonists in a room full of interchangeable, unassigned beds.
  const assigned=new Int32Array(slots.length).fill(-1),seen=new Uint32Array(slots.length);
  const assign=(person:number,mark:number):boolean=>{
    const candidates=options[person]!;
    for(const slot of candidates)if(assigned[slot]===-1&&seen[slot]!==mark){seen[slot]=mark;assigned[slot]=person;return true;}
    for(const slot of candidates)if(seen[slot]!==mark){
      seen[slot]=mark;const previous=assigned[slot]!;
      if(assign(previous,mark)){assigned[slot]=person;return true;}
    }
    return false;
  };
  return people.reduce((count,_,index)=>count+Number(assign(index,index+1)),0);
}

/** Current facts from one confirmed snapshot. No milestone, reservation,
 * command, PRNG consumption or persistent state is written by this guide. */
export function readFirstDayGuide(world:World,food:FoodReadability=captureFoodReadability(world)):FirstDayGuideSection[] {
  const people=world.pawns.filter(civil),ids=new Set(people.map(p=>p.id)),workers=people.filter(p=>p.state!=='downed');
  const enabled=(work:'haul'|'build'|'grow'|'cook')=>workers.some(p=>workPriority(p,work)>0);
  const coverage=[['haul','Transport'],['build','Construction'],['grow','Culture']] as const;
  const missingWork=coverage.filter(([work])=>!enabled(work)).map(([,label])=>label);
  const retiring=new Set<number>();
  for(const job of world.jobs){
    if(job.deconstruction)retiring.add(job.deconstruction.structureId);
    if(job.kind==='uninstall'&&job.furniture)retiring.add(job.furniture.structureId);
  }
  const availableShelfIds=new Set(world.structures.filter(s=>(s.kind==='shelf'||s.kind==='small-shelf')&&aliveBuilding(s)&&!retiring.has(s.id)).map(s=>s.id));
  // This UI read does not need the full spatial structure index just to list
  // shelf policies. The same provider has a direct-list decision view.
  const cells=storageCells({stockpiles:world.stockpiles,structures:world.structures,schemaVersion:world.schemaVersion,worldFactions:world.worldFactions}).filter(c=>c.capacity>0&&c.priority>0&&c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height
    &&!['water','rock'].includes(world.tiles[c.z*world.width+c.x]!.terrain)
    &&(c.shelfId===undefined||availableShelfIds.has(c.shelfId)));
  const woodCells=cells.filter(c=>storageCellAccepts(world,c,'wood')).length;
  const foodCells=cells.filter(c=>storageCellAccepts(world,c,'survival-meal')).length;
  const shelfPlans=world.jobs.filter(j=>j.kind==='shelf'||j.kind==='small-shelf').length;
  const beds=civilianPlaces(world,people,retiring);
  const bedPlans=world.jobs.filter(j=>isBedKind(j.kind)).length;
  const piles=world.piles.filter(p=>localPile(ids,p)&&ticksUntilRot(p,world.tick)>0);
  const nutrition=food.freshNutrition,survival=food.survivalMeals;
  const matched=food.evaluatedPawnIds.filter(id=>food.byPawn.get(id)?.status==='matched').length;
  const foodReady=food.evaluatedPawnIds.length>0&&matched===food.evaluatedPawnIds.length&&!food.blockedPawnIds.length&&!food.pasteUncheckedPawnIds.length&&!food.engagedPawnIds.length&&!food.excludedPawnIds.length&&nutrition>=food.evaluatedPawnIds.length*1.6;
  const zones=world.growingZones.filter(z=>foodCrop(z.plant)&&z.cells.length>0);
  const zoneCells=new Set(zones.flatMap(z=>z.cells));
  const crops=world.resources.filter(r=>foodCrop(r.kind)&&zoneCells.has(r.z*world.width+r.x));
  const growth=createPlantGrowthReader(world),harvest=crops.filter(r=>harvestable(world,r,()=>growth(r))).length;
  const stations=world.structures.filter(s=>(isStove(s.kind)||s.kind==='campfire')&&aliveBuilding(s)&&!retiring.has(s.id));
  const configured=stations.filter(s=>(s.bills??[]).some(b=>(b.recipe==='simple-meal'||b.recipe==='cook-simple-meal-bulk')
    &&stationAccepts(s,b.recipe)&&!b.suspended&&(b.mode==='forever'||b.target>0)
    &&PRODUCTION_RECIPES[b.recipe].inputs.some(item=>b.filters[item]===true)));
  const usable=configured.filter(s=>foodStationUsable(s)&&!s.breakdown);
  const groundWeapons=piles.filter(p=>p.kind==='weapon'&&p.owner.type==='ground'&&(p.weapon?.hitPoints??1)>0);
  const weaponOwners=new Set<number>();for(const item of world.piles)if(item.kind==='weapon'&&item.quantity>0&&item.owner.type==='equipment'&&(item.weapon?.hitPoints??1)>0)weaponOwners.add(item.owner.pawnId);
  const equipped=people.filter(p=>weaponOwners.has(p.id)).length;
  const noPeople=people.length===0,research=readResearchReadiness(world),project=researchProjects.find(p=>p.id===research.activeProject);
  const availability=readAvailabilityStatusAlerts(world),absence=availability[0];
  const absenceTarget=absence?.targets[0];
  const absenceAction:FirstDayGuideAction=absenceTarget?{target:absenceTarget,...absence?.tab?{tab:absence.tab}:{}}:absence?.context?{...absence.context}:{panel:'menu'};
  const absenceActionLabel=absenceTarget?absenceTarget.kind==='object'?'Inspecter le caisson':`Consulter ${absence?.tab==='health'?'Santé':absence?.tab==='needs'?'Besoins':'Prisonnier'}`:absence?.context?.panel==='world'?'Ouvrir Monde':'Ouvrir Menu';
  return [
    {id:'work',title:absence?'Comprendre la disponibilité des colons':'Répartir le travail',status:noPeople?'optional':absence||missingWork.length?'missing':'ready',
      detail:absence?`${absence.text}.${availability.length>1?` ${availability.slice(1).map(row=>row.text).join('. ')}.`:''}`:noPeople?'Aucun colon libre vivant sur cette carte.':missingWork.length?`À activer : ${missingWork.join(', ')}.`:'Transport, Construction et Culture ont un titulaire affecté.',
      body:absence?'Ces constats suivent les personnes et leurs propriétaires dans l’état confirmé. Inspectez les personnes présentes ou ouvrez leur voyage dans Monde. La partie reste ouverte ; Menu donne accès aux sauvegardes et à une nouvelle colonie.':'Dans Travail, 1 est la priorité la plus forte ; 0 désactive. Les incapacités du dossier comptent. Ces affectations ne garantissent pas un trajet ou des matériaux. En cas de blessure, consultez Santé puis les priorités Médecin, Patient et Repos au lit.',action:absence?absenceAction:{panel:'work'},actionLabel:absence?absenceActionLabel:'Ouvrir Travail'},
    {id:'storage',title:'Regrouper les réserves',status:woodCells&&foodCells?'ready':cells.length||shelfPlans?'started':'missing',
      detail:`${woodCells} case(s) acceptent le bois ; ${foodCells} acceptent les repas de survie.${shelfPlans?` ${shelfPlans} étagère(s) encore en chantier.`:''}`,
      body:'Tracez une réserve et vérifiez ses filtres, sa priorité et sa capacité. Une étagère doit être construite. Les transporteurs déplacent les piles au contact ; cette configuration ne garantit pas une place libre pour chaque objet.',action:{panel:'architect',mapTools:'zones',tool:'stockpile'},actionLabel:'Ouvrir Zones'},
    {id:'beds',title:'Préparer les couchages',status:noPeople?'optional':beds>=people.length?'ready':beds||bedPlans?'started':'missing',
      detail:`${beds} place(s) civile(s) compatibles pour ${people.length} colon(s).${bedPlans?` ${bedPlans} couchage(s) en chantier.`:''}`,
      body:'Placez trois Couchages au sol gratuits et immédiats pour les premiers colons, puis construisez des lits. Chaque emplacement accueille une personne ; affectez-la dans son inspection. Le repos au sol est moins efficace qu’un vrai lit. Un plan de lit ne permet pas de dormir. Les places médicales, de prison et déjà revendiquées restent distinctes. Un lit double entièrement libre compte ici une place : affectez ses occupants pour utiliser la seconde, ou laissez un partenaire la rejoindre. Vérifiez le trajet, le toit et la température la première nuit : une marque au sol ne crée pas d’abri.',action:{panel:'architect',category:'furniture'},actionLabel:'Ouvrir Meubles'},
    {id:'food',title:'Surveiller les provisions',status:noPeople?'optional':foodReady?'ready':nutrition>0||food.engagedPawnIds.length||food.pasteUncheckedPawnIds.length?'started':'missing',
      detail:`${nutrition.toFixed(1)} nutrition fraîche constatée, dont ${survival} repas de survie. ${matched}/${food.evaluatedPawnIds.length} colon(s) évalué(s) avec un type autorisé parmi les piles examinées.${food.blockedPawnIds.length?` ${food.blockedPawnIds.length} régime(s) sans type autorisé constaté.`:''}${food.engagedPawnIds.length?` ${food.engagedPawnIds.length} repas engagé(s) conservé(s).`:''}${food.pasteUncheckedPawnIds.length?` Pâte nutritive non évaluée pour ${food.pasteUncheckedPawnIds.length} colon(s).`:''}${food.excludedPawnIds.length?` ${food.excludedPawnIds.length} personne(s) hors évaluation.`:''}`,
      body:'Piles fraîches au sol de cette carte et portions propres portées. Un type autorisé ne garantit ni accès, réservation, partage ou autonomie. Repas engagés conservés ; patients, crises, voyageurs et pâte à produire non évalués. Renouvelez le stock par les récoltes, cultures et la cuisine.',action:{panel:'assign'},actionLabel:'Ouvrir Assignations'},
    {id:'cultivation',title:'Commencer les cultures alimentaires',status:harvest?'ready':zones.length?'started':'missing',
      detail:`${zones.length} zone(s) de riz, pommes de terre ou maïs ; ${crops.length} plant(s), ${harvest} récoltable(s).`,
      body:`${zones.some(z=>z.allowSow)?'Semis autorisés dans au moins une zone.':'Les semis alimentaires ne sont pas autorisés.'} Une zone seule ne nourrit personne. Fertilité, lumière, température et Culture conditionnent les semis ; coton, racines médicinales et foin ne remplacent pas une culture alimentaire humaine.`,action:{panel:'architect',mapTools:'zones',tool:'growing'},actionLabel:'Ouvrir Zones'},
    {id:'cooking',title:'Configurer les repas',status:usable.length&&enabled('cook')?'ready':stations.length||world.jobs.some(j=>isStove(j.kind)||j.kind==='campfire')?'started':'missing',
      detail:`${stations.length} poste(s) construit(s) ; ${usable.length} utilisable(s) avec facture de repas simples.${!enabled('cook')?' Cuisine sans titulaire actif.':''}`,
      body:'Construisez un feu ou une cuisinière, puis ajoutez une facture de repas simples dans son inspection. Une facture suspendue ou sans ingrédient autorisé ne suffit pas. Combustible ou électricité, ingrédients réellement disponibles et accès restent nécessaires ; aucun repas futur n’est compté ici.',action:{panel:'architect',category:'production'},actionLabel:'Ouvrir Production'},
    {id:'equipment',title:'Choisir les équipements',status:people.length&&equipped>=people.length?'ready':groundWeapons.length||equipped?'started':'optional',
      detail:`${equipped} colon(s) portent une arme ; ${groundWeapons.length} arme(s) restent au sol.`,
      body:groundWeapons.length?`Armes au sol : ${groundWeapons.map(p=>ITEM_DEFINITIONS[p.item].label).join(', ')}. Sélectionnez un seul colon, faites un clic droit sur l’arme au sol, puis choisissez Équiper : il doit la rejoindre. Assignations règle les politiques ; ce bouton n’équipe personne.`:'Inspectez les colons et leurs possessions avant une menace. L’équipement, l’inventaire et les vêtements sont distincts ; les incapacités peuvent interdire le combat.',action:{panel:'assign'},actionLabel:'Ouvrir Assignations'},
    {id:'research',title:'Commencer la recherche',status:research.remainingCount===0||research.engagedIds.length?'ready':research.activeProject?'started':'optional',
      detail:research.remainingCount===0?'Tous les projets livrés sont acquis.':project?`${project.title} choisi ; ${research.workingIds.length} chercheur(s) au travail, ${research.movingIds.length} en chemin.`:research.availableCount?`Aucun projet choisi ; ${research.availableCount} projet(s) sélectionnable(s).`:'Aucun projet choisi ; les recherches restantes ont des prérequis à remplir.',
      body:`Ce conseil est facultatif. Choisissez un projet et consultez ses prérequis dans Recherche. ${research.benchIds.length} bureau(x) physique(s) présent(s) ; ${research.assignedIds.length} colon(s) affecté(s) à Recherche dans Travail. Un projet choisi n’est pas achevé ; un poste compatible ne garantit pas l’accès ni la réservation. Les besoins, soins et autres tâches continuent.`,action:{panel:'research'},actionLabel:'Ouvrir Recherche'},
  ];
}

const STATUS_LABELS:Record<FirstDayGuideStatus,string>={ready:'Disponible',started:'À compléter',missing:'À préparer',optional:'À examiner'};
export function createFirstDayGuide(host:HTMLElement,callbacks:FirstDayGuideCallbacks):{
  update:(world:World,food?:FoodReadability)=>void;setActive:(active:boolean)=>void;reset:()=>void;dispose:()=>void;
} {
  type Row={node:HTMLDetailsElement;title:HTMLElement;status:HTMLElement;detail:HTMLElement;body:HTMLElement;button:HTMLButtonElement;section:FirstDayGuideSection};
  const rows=new Map<FirstDayGuideId,Row>();let active=false,disposed=false;
  host.classList.add('first-day-guide');host.hidden=true;
  const text=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};
  const clear=()=>{for(const row of rows.values())row.button.onclick=null;rows.clear();host.replaceChildren();};
  return {
    setActive(value){if(disposed)return;active=value;host.hidden=!value;},
    update(world,food){
      if(!active||disposed)return;
      for(const section of readFirstDayGuide(world,food)){
        let row=rows.get(section.id);
        if(!row){
          const doc=host.ownerDocument,node=doc.createElement('details'),summary=doc.createElement('summary'),title=doc.createElement('span'),status=doc.createElement('small');
          const detail=doc.createElement('p'),body=doc.createElement('p'),button=doc.createElement('button');button.type='button';
          node.dataset.firstDaySection=section.id;title.className='first-day-title';status.className='first-day-status';detail.className='first-day-detail';body.className='first-day-body';
          summary.append(title,status);node.append(summary,detail,body,button);host.append(node);
          row={node,title,status,detail,body,button,section};rows.set(section.id,row);
          const current=row;button.onclick=()=>{if(active&&!disposed)callbacks.onAction({...current.section.action});};
        }
        row.section=section;row.node.dataset.status=section.status;
        text(row.title,section.title);text(row.status,STATUS_LABELS[section.status]);text(row.detail,section.detail);text(row.body,section.body);text(row.button,section.actionLabel);
      }
    },
    reset(){if(!disposed)clear();},
    dispose(){clear();disposed=true;active=false;host.hidden=true;},
  };
}
