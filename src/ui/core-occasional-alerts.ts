import {treatmentTargets} from '../sim/care-rules';
import {footprintCells} from '../sim/definitions';
import {captureGroupMass,type AwayGroup} from '../sim/group-capture';
import {freightGroup} from '../sim/group-freight';
import {pawnBody} from '../sim/health-rules';
import {currentMedicalBed} from '../sim/hospital-medical-stats';
import {planetHomeCivilCore,tileHour} from '../sim/planet-navigation';
import {needsHighTechBench} from '../sim/research';
import {workPriority} from '../sim/work-types';
import type {Pawn,Structure,World} from '../sim/types';
import {isPlayerHomeMap} from './alert-priority';
import {worldCaravans} from './alert-caravans';
import {freeColonist} from './core-colony-alerts';
import {knownBuilding256,knownPosition256} from './exploration-readers-256';
import {objectNotificationTarget,personNotificationTarget,type NotificationTarget} from './notification-focus';
import {researchProjects} from './research-projects';
import type {StatusAlert} from './status-alerts';

/** Alerts lot C: the occasional Core alerts (RimWorld 1.6 Alert_* classes)
 * whose watched feature exists in Elsewhere. Same contract as lots A and B:
 * one confirmed snapshot, read on the alert cadence (at most every 400 ms),
 * never mutated, no randomness, no scan of the map cells. Most readers stop at
 * a cheap guard (no designation, no request, no caravan) before any loop over
 * people or buildings. */

const present=<T>(value:T|undefined):value is T=>value!==undefined;
const byId=(a:{id:number},b:{id:number})=>a.id-b.id;
const people=(world:World,pawns:readonly Pawn[])=>pawns.map(p=>personNotificationTarget(world,p.id)).filter(present);
const names=(pawns:readonly Pawn[])=>pawns.map(p=>p.name).join(', ');

/** Core Need_Food.CurCategory above Fed for a human: below 0.8 × the
 * omnivore FoodLevelPercentageWantEat (0.3), i.e. under 24 %. */
export const HUNGRY_BELOW_PERCENT=24;

/** Alert_PasteDispenserNeedsHopper (High): a nutrient paste dispenser with no
 * hopper on a cell cardinally adjacent to its footprint (Building_Nutrient
 * PasteDispenser.AdjCellsCardinalInBounds). Every such dispenser is a culprit.
 * The hopper cells are gathered once, only when a dispenser exists. */
export function readPasteDispenserNeedsHopper(world:World):StatusAlert|undefined {
  let hoppers:Set<number>|undefined;const bad:Structure[]=[];
  for(const s of world.structures){
    if(s.kind!=='nutrient-paste-dispenser'||!knownBuilding256(world,s))continue;
    if(!hoppers){hoppers=new Set();for(const h of world.structures)if(h.kind==='hopper')hoppers.add(h.z*world.width+h.x);}
    const cells=footprintCells(s),own=new Set(cells.map(c=>c.z*world.width+c.x));
    const fed=cells.some(c=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>{
      const x=c.x+dx!,z=c.z+dz!;if(x<0||z<0||x>=world.width||z>=world.height)return false;
      const index=z*world.width+x;return !own.has(index)&&hoppers!.has(index);
    }));
    if(!fed)bad.push(s);
  }
  if(!bad.length)return;
  const text=bad.length>1?`${bad.length} distributeurs sans trémie`:'Distributeur sans trémie';
  return {key:'paste-dispenser-hopper',text,targets:bad.sort(byId).map(s=>objectNotificationTarget('structure',s.id,s)),context:{panel:'architect',category:'production'},explanation:
    'Un distributeur de pâte nutritive puise ses ingrédients dans une trémie posée contre l’un de ses côtés. Construisez une trémie à côté et faites-y transporter de la nourriture crue.'};
}

/** Core WorkGiver_PatientGoToBedTreatment.AnyAvailableDoctorFor: another
 * colony human, not downed, awake, not lying in a bed, not in a mental state,
 * not a prisoner, with the Doctor work enabled and able to manipulate.
 * Reachability is not checked here (no path search on the alert cadence). */
function availableDoctor(world:World,patient:Pawn):boolean {
  return world.pawns.some(p=>p.id!==patient.id&&freeColonist(p)&&p.state!=='downed'&&p.state!=='sleeping'&&!p.medicalSleep
    &&!p.mental?.crisis&&workPriority(p,'doctor')>0&&pawnBody(p).capacities.manipulation>0&&!currentMedicalBed(world,p));
}
/** Alert_AwaitingMedicalOperation (Medium): a colonist or prisoner of the
 * colony with an operation requested (Elsewhere keeps one request per person,
 * never suspended), lying in a bed, while a doctor is available to operate. */
export function readAwaitingMedicalOperation(world:World):StatusAlert|undefined {
  let patients:Pawn[]|undefined;
  for(const p of world.pawns){
    if(!p.surgeryRequest||p.state==='dead'||p.health?.death||!(freeColonist(p)||p.prisoner&&p.prisoner.releasedAt===undefined&&!p.visitor))continue;
    if(!currentMedicalBed(world,p)||!availableDoctor(world,p))continue;
    (patients??=[]).push(p);
  }
  if(!patients)return;
  patients.sort(byId);
  const text=`${patients.length} patient${patients.length>1?'s':''} en attente d’opération`;
  return {key:'awaiting-operation',text,targets:people(world,patients),tab:'health',explanation:
    `${patients.length>1?'En attente dans leur lit qu’un médecin disponible vienne les opérer':'En attente dans son lit qu’un médecin disponible vienne l’opérer'} : ${names(patients)}.`};
}

/** Alert_NeedDoctor (High): on the home map, no free colonist present and
 * conscious has the Doctor work enabled, while a free colonist needs care:
 * down in a bed and hungry, or with an injury or illness to tend (medical care
 * not set to none). The patients are the culprits. */
export function readNeedDoctor(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  if(!free.length||!isPlayerHomeMap(world))return;
  if(free.some(p=>p.state!=='downed'&&workPriority(p,'doctor')>0))return;
  const patients=free.filter(p=>p.state==='downed'&&p.hunger<HUNGRY_BELOW_PERCENT&&!!currentMedicalBed(world,p)||treatmentTargets(p).length>0);
  if(!patients.length)return;
  return {key:'need-doctor',text:'Médecin nécessaire',targets:people(world,patients),context:{panel:'work'},tab:'health',explanation:
    `Aucun colon disponible n’a le travail Médecin activé, alors que des soins attendent : ${names(patients)}. Activez Médecin dans Travail.`};
}

/** Alert_NeedMiner (High): mining designations on the home map and no free
 * colonist present and conscious with the Mining work enabled. Core points at
 * the first designation; here the first mine order the player can see. */
export function readNeedMiner(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  if(!isPlayerHomeMap(world))return;
  let first:World['jobs'][number]|undefined,any=false;
  for(const job of world.jobs){if(job.kind!=='mine')continue;any=true;if(knownPosition256(world,job)){first=job;break;}}
  if(!any||free.some(p=>p.state!=='downed'&&workPriority(p,'mine')>0))return;
  const targets:NotificationTarget[]=first?[objectNotificationTarget('job',first.id,first)]:[];
  return {key:'need-miner',text:'Mineur nécessaire',targets,context:{panel:'work'},explanation:
    'Des roches sont désignées pour le minage, mais aucun colon disponible n’a le travail Minage activé. Activez-le dans Travail.'};
}

/** Alert_NeedResearchBench (Medium): the selected project needs a research
 * bench the colony has not built (a hi-tech bench for the projects that
 * require one, any bench otherwise). Core does not check power or the
 * multi-analyzer for this alert. The click opens Research. */
export function readNeedResearchBench(world:World):StatusAlert|undefined {
  const project=world.research?.project;if(!project)return;
  const advanced=needsHighTechBench(project);
  for(const s of world.structures)if((s.kind==='hi-tech-research-bench'||!advanced&&s.kind==='research-bench')&&knownBuilding256(world,s))return;
  const label=researchProjects.find(p=>p.id===project)?.title??'en cours';
  return {key:'need-research-bench',text:advanced?'Bureau de recherche avancé nécessaire':'Bureau de recherche nécessaire',targets:[],context:{panel:'research'},explanation:
    `Le projet « ${label} » se recherche à ${advanced?'un bureau de recherche avancé':'un bureau de recherche'}, et la colonie n’en a pas. Construisez-en un (Architecte > Production) ou choisissez un autre projet dans Recherche.`};
}

/** Core Caravan.MassUsage / MassCapacity, read with the same capture as the
 * march (captureGroupTravel): goods, packed furniture and pack animals. */
function caravanMass(world:World,g:AwayGroup) {
  return captureGroupMass(g.members,g.items,freightGroup(g),Number(world.schemaVersion),g.packed,g.animalOwners?.members);
}
const kg=(grams:number)=>`${(grams/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})} kg`;

/** Alert_ImmobileCaravan (Critical): a caravan carrying more than its
 * capacity (Caravan.ImmobilizedByMass), whatever it is doing. */
export function readImmobileCaravan(world:World):StatusAlert|undefined {
  const loads:string[]=[];
  for(const {group} of worldCaravans(world)){
    const mass=caravanMass(world,group);
    if(mass&&mass.grams>mass.capacityGrams)loads.push(`${kg(mass.grams)} pour ${kg(mass.capacityGrams)} de capacité`);
  }
  if(!loads.length)return;
  const several=loads.length>1;
  return {key:'immobile-caravan',text:several?`${loads.length} caravanes immobilisées`:'Caravane immobilisée',targets:[],context:{panel:'world',worldTab:'group'},explanation:
    `${several?'Ces caravanes portent':'La caravane porte'} plus que ${several?'leur':'sa'} capacité (${loads.join(' ; ')}) : ${several?'elles ne peuvent':'elle ne peut'} plus avancer. Allégez-${several?'les':'la'}, par exemple en vendant ou en donnant des biens.`};
}

/** Caravan.NightResting: every caravan human needs rest, so a caravan that is
 * not finishing its last stretch rests while the local hour at its tile is
 * before 6 h or after 22 h. */
function nightAt(world:World,tile:number):boolean {
  if(!world.planet)return false;
  let hour:number;
  try{hour=tileHour(world.planet,tile,planetHomeCivilCore(world));}catch{return false;}
  return hour<6||hour>22;
}
/** Alert_CaravanIdle (Medium): a caravan standing still that could move
 * (Core: not moving and not CantMove). A caravan halted at its destination, at
 * rest with no route, or stopped by an unreachable destination is idle; a
 * marching, paused, overloaded or night-resting caravan is not, nor one that
 * Elsewhere's march rule stops (a member down, in a mental break or unable to
 * walk). Waiting to enter a map or for an encounter answer is not idle either. */
export function readCaravanIdle(world:World):StatusAlert|undefined {
  let idle=0;
  for(const {group:g,record} of worldCaravans(world)){
    if(g.paused||record?.pending261||record?.pendingEntry263)continue;
    if(!(g.phase==='stationary'||g.phase==='at-site'||g.phase==='travelling'&&g.stop?.kind==='unreachable'))continue;
    if(g.members.some(p=>p.state==='downed'||!!p.mental?.crisis||pawnBody(p).capacities.moving<=0))continue;
    const mass=caravanMass(world,g);if(!mass||mass.grams>mass.capacityGrams||nightAt(world,g.tile))continue;
    idle++;
  }
  if(!idle)return;
  return {key:'caravan-idle',text:idle>1?`${idle} caravanes inactives`:'Caravane inactive',targets:[],context:{panel:'world',worldTab:'group'},explanation:
    `${idle>1?'Ces caravanes sont':'La caravane est'} à l’arrêt alors que rien ne l’empêche de repartir. Choisissez ${idle>1?'leur':'sa'} prochaine destination dans Monde.`};
}
