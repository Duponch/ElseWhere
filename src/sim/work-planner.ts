import {woodWallTouch301} from './wall-frame-kind-301.ts';
import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {barrelFreeCapacity265,barrelExtractionProposal265,fermentationHaulCandidates265} from './fermentation-runtime-265.ts';
import {isBurialContainer256} from './ancient-monument-runtime-256.ts';
import {ancientRepairTarget256} from './ancient-monument-runtime-256.ts';
import {groupOnMapMember} from './group-state.ts';
import {explorationEnabled256} from './exploration-state-256.ts';
import {treeJobReason,treeWorkTarget} from './tree-transfer.ts';
import { storageCells,storageCellById,storageCellAccepts } from './shelf-storage.ts';
import { deepWorkWanted,deepWorkProposal,startDeepWork } from './deep-drilling.ts';
import { captureAllowedArea,allowedAreaAllows,allowedAreaWorkAllowed,type AllowedAreaPolicy } from './allowed-area-state.ts';
import type { AllowedAreaRouteResult } from './allowed-area-navigation.ts';
import { hopperAccepts,hopperCapacity,hopperFillWanted } from './nutrient-paste.ts';
import { workPriority, workType } from './work-types.ts';
export { workType } from './work-types.ts';
import { surgeryProposal,startSurgery } from './surgery.ts';
import { handlingWanted,handlingProposal,startHandling } from './animal-handling.ts';
import { slaughterWanted,slaughterProposal } from './animal-slaughter.ts';
import { leadingWanted,leadingProposal,startLeading } from './animal-leading.ts';
import { productWanted,productProposal,startProduct } from './animal-products.ts';
import { animalCareWanted,animalCareProposal,startAnimalCare } from './animal-care.ts';
import { animalRescueWanted,animalRescueProposal,startAnimalRescue } from './animal-rescue.ts';
import { animalFeedingWanted,animalFeedingProposal,startAnimalFeeding } from './animal-feeding.ts';
import { cleaningWanted,cleaningProposal,startCleaning } from './cleaning.ts';
import { assignBurial,burialReason } from './burial.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { firefightingTargets,firefightingProposal,startFirefighting } from './firefighting.ts';
import { prisonFoodChecker } from './prison-food.ts';
import { huntingWanted,huntingProposal } from './hunting.ts';
import { wardenWanted,wardenProposal,startWarden } from './warden.ts';
import {releaseReady,releaseProposal,startPrisonerRelease} from './prisoner-release.ts';
import { researchWanted,researchProposal } from './research.ts';
import { feedingProposal,startFeeding } from './feeding.ts';
import { FEED_HUNGER,needsAssistedFeeding,feedingWork } from './feeding-rules.ts';
import { lyingPatient,tendingProposal,startTending } from './tending.ts';
import { patientWork,patientProposal,startPatientRest } from './patient-rest.ts';
import { treatmentTarget,urgentTreatment } from './care-rules.ts';
import { rescueProposal,startRescue,wantsRescue } from './rescue.ts';
import { automaticallyHaulable } from './mining-rules.ts';
import { furnitureHaulValid } from './furniture-haul-rules.ts';
import { furnitureStorageCandidates, mayImproveFurnitureStorage } from './furniture-haul-planner.ts';
import { furnitureReady, furnitureWorkTarget, packedAt } from './furniture-rules.ts';
import { deconstructionAvailable } from './deconstruction-rules.ts';
import { startWallDoorWork296 } from './wall-door-state-296.ts';
import { validSowingClearance } from './sowing-clearance.ts';
import { sowingJobAllowed } from './farming.ts';
import { constructionCandidates } from './construction-planner.ts';
import { haulReservations } from './haul-reservations.ts';
import { asBuilder, ConstructionOccupancy, constructionHaulPriority, constructionObstructions, constructionSiteFree, isConstruction } from './construction-rules.ts';
import { productionPriority, planCooking, type CookingPlan } from './cooking-planner.ts';
import { candidateAccess } from './candidate-access.ts';
import { turretReloadCapacity,wantsTurretReload,turretReloadPawnReason } from './mini-turret-reload.ts';
import { fuelCapacity, wantsFuel, fuelItem, refuelable } from './fuel.ts';
import { mayImproveStorage } from './idle-logistics.ts';
import { asideCapacity, findAsideDestination } from './haul-aside.ts';
import { storageCapacity,createGroundCapacityReader } from './ground-placement.ts';
import { legacyItem, type ItemId } from './items.ts';
import { storageConditionKey } from './storage-condition.ts';
import { constructionCapacity, constructionRecipe, deliveredMaterial } from './construction-materials.ts';
import { fixBreakdownWanted } from './breakdowns.ts';
import { CARRY_CAPACITY, footprintCells, JOB_WOOD_COST } from './definitions.ts';
import { deliveredStock, groundQuantity, reservedDestination, reservedSource, reservedSourcesByPile } from './materials.ts';
import {smoothFloorReason281,canTouchSmoothFloor281} from './smooth-floor-281.ts';
import { cellIndex, workNeighbours, inBounds, canStopAt, hasReachableCell, reachableCells, routeToJob, routeToCell, interactionGoals } from './pathfinding.ts';
import type { Reachability } from './pathfinding.ts';
import { structureById,type StructureNavigationGeometry,structuresOfKind} from './structure-navigation.ts';
import type { Cell, HaulDestination, Job, JobKind, MaterialKind, MaterialPile, Pawn, World } from './types.ts';
export const PLAN_INTERVAL=20;
export interface SearchStats { searches:{pawnId:number;mode:'all'|'nearest'|'full';visited:number;unreachedGroups:number;connectivityVisited?:number}[] }
export interface SearchBudget { remaining:number; pairs:number; stats?:SearchStats;structureGeometry?:()=>StructureNavigationGeometry;
  /** The regions of the decision's navigation grid, only for that exact grid. */
  regions?:(grid:Uint8Array)=>import('./regions.ts').RegionMap|undefined }
export type NavigationGrid=()=>Uint8Array;
const sameCell=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;

export function search(world: World, pawn: Pawn, blocked: Uint8Array, occupied: ReadonlySet<number>, budget: SearchBudget, goals?: ReadonlySet<number>, allGroups?:readonly ReadonlySet<number>[]): Reachability | null {
  if (budget.remaining === 0) return null;
  budget.remaining--;
  const result=reachableCells(world,pawn,blocked,occupied,goals,allGroups,undefined,undefined,budget.structureGeometry?.());
  budget.stats?.searches.push({pawnId:pawn.id,mode:allGroups?'all':goals?'nearest':'full',visited:result.visited,unreachedGroups:result.unreachedGroups});
  return result;
}
export function searchAllowed(world:World,pawn:Pawn,blocked:Uint8Array,occupied:ReadonlySet<number>,budget:SearchBudget,policy:AllowedAreaPolicy):AllowedAreaRouteResult {
  if(!budget.remaining)return {kind:'deferred'};budget.remaining--;
  const result=reachableCells(world,pawn,blocked,occupied,undefined,undefined,index=>policy.has(index),policy,budget.structureGeometry?.());
  budget.stats?.searches.push({pawnId:pawn.id,mode:'nearest',visited:result.visited,unreachedGroups:0});
  if(result.goalIndex===undefined)return {kind:'unreachable'};
  const target={x:result.goalIndex%world.width,z:Math.floor(result.goalIndex/world.width)},path=routeToCell(world,target,result);
  return path?{kind:'found',target,path}:{kind:'unreachable'};
}
/** A decision-wide connectivity check replaces speculative paths to every
 * candidate. Precise routes share one resumable weighted search. */
export function searchCandidates(world:World,pawn:Pawn,blocked:Uint8Array,occupied:ReadonlySet<number>,budget:SearchBudget,deferNavigation=false):Reachability|null {
  if(!budget.remaining)return null;budget.remaining--;
  const result=candidateAccess(world,pawn,blocked,occupied,deferNavigation,pawn,budget.structureGeometry?.(),budget.regions?.(blocked));
  budget.stats?.searches.push({pawnId:pawn.id,mode:'all',get visited(){return result.visited;},unreachedGroups:0,get connectivityVisited(){return result.connectivityVisited;}});
  return result;
}
export function destinationCell(world: World, destination: HaulDestination): (Cell & { kind?: JobKind|import('./types.ts').StructureKind }) | null {
  if (destination.type === 'aside') return destination;
  if (destination.type === 'fuel'||destination.type==='turret'||destination.type==='hopper'||destination.type==='fermenting-barrel') return structureById(world,destination.structureId) ?? null;
  return destination.type === 'job' ? world.jobs.find(job => job.id === destination.jobId) ?? null : storageCellById(world,destination.stockpileId) ?? null;
}
export function destinationCapacity(world: World, destination: HaulDestination, kind: MaterialKind, exceptPawn?: number, subject: ItemId|MaterialPile = legacyItem(kind)): number {
  const item=typeof subject==='string'?subject:subject.item;
  if(destination.type==='fermenting-barrel')return item==='wort'?barrelFreeCapacity265(world,destination.structureId,exceptPawn):0;
  if(destination.type==='hopper')return hopperCapacity(world,destination.structureId,item,exceptPawn);
  if(destination.type==='turret')return item==='steel'?turretReloadCapacity(world,destination.structureId,exceptPawn,destination.forced):0;
  if (destination.type === 'fuel') {const station=refuelable(world,destination.structureId);return station&&item===fuelItem(station.kind)?fuelCapacity(world,destination.structureId,exceptPawn,destination.forced):0;}
  if (destination.type === 'aside'&&!validSowingClearance(world,destination))return 0;
  if (destination.type === 'aside') return asideCapacity(world, destination, subject, exceptPawn);
  if (destination.type === 'job') {
    const job = world.jobs.find(item => item.id === destination.jobId);
    return job ? constructionCapacity(world,job,item,exceptPawn) : 0;
  }
  const zone = storageCellById(world,destination.stockpileId);
  return zone ? storageCapacity(world, zone, subject, exceptPawn) : 0;
}
export function destinationValid(world: World, pawn: Pawn): boolean {
  const task = pawn.haul; if (!task) return false;
  if(!allowedAreaWorkAllowed(world,pawn))return false;
  if(task.whole)return furnitureHaulValid(world,task,pawn.id);
  const pile = world.piles.find(item => item.id === (task.phase === 'pickup' ? task.sourcePileId : task.carryPileId));
  const destination=task.destination;
  if(destination.type==='aside'&&destination.constructionId!==undefined&&!world.jobs.some(j=>j.id===destination.constructionId))return false;
  return !!pile && destinationCapacity(world, task.destination, pile.kind, pawn.id, pile) >= task.quantity;
}
interface Candidate { surgery?:NonNullable<ReturnType<typeof surgeryProposal>>; animalHandling?:NonNullable<ReturnType<typeof handlingProposal>>; animalCare?:NonNullable<ReturnType<typeof animalCareProposal>>; firefighting?:NonNullable<ReturnType<typeof firefightingProposal>>; ward?:NonNullable<ReturnType<typeof wardenProposal>>; hunting?:NonNullable<ReturnType<typeof huntingProposal>>; research?:NonNullable<ReturnType<typeof researchProposal>>; feed?:NonNullable<ReturnType<typeof feedingProposal>>; patientRest?:NonNullable<ReturnType<typeof patientProposal>>; tend?:NonNullable<ReturnType<typeof tendingProposal>>; rescue?:{patientId:number;bedId:number;path:Cell[]}; whole?:true; clearance?:{resourceId:number;progress:number}; cooking?: CookingPlan; priority: number; rank: number; distance: number; id: number; job?: Job; sourceId?: number; quantity?: number; destination?: HaulDestination; target: Cell }
interface Candidate {animalLeading?:NonNullable<ReturnType<typeof leadingProposal>>;animalProduct?:NonNullable<ReturnType<typeof productProposal>>}
interface Candidate {brewing?:NonNullable<ReturnType<typeof barrelExtractionProposal265>>}
interface Candidate {deepWork?:NonNullable<ReturnType<typeof deepWorkProposal>>}
interface Candidate {animalFeed?:NonNullable<ReturnType<typeof animalFeedingProposal>>}
interface Candidate {animalRescue?:NonNullable<ReturnType<typeof animalRescueProposal>>}
interface Candidate {prisonerRelease?:NonNullable<ReturnType<typeof releaseProposal>>}
interface Candidate {cleaning?:import('./cleaning.ts').CleaningProposal}
/** A delivery's destination cell (the thing RimWorld's giver scans, or the storage). */
interface Candidate {via?:Cell}
/** The family of a candidate compared before its proposal is built. */
interface Candidate {family?:'tend'|'feed'|'surgery'|'rescue'}
function compareCandidate(a: Candidate, b: Candidate): number { return a.priority - b.priority || a.rank - b.rank || a.distance - b.distance || a.id - b.id; }
export function canReach(world: World, target: Cell & { kind?: JobKind|import('./types.ts').StructureKind }, reachable: Reachability, allowTarget: boolean,geometry?:StructureNavigationGeometry): boolean {
  const cells = target.kind ? footprintCells(target as Job) : [target];
  if ((allowTarget||target.kind==='smooth-floor') && canStopAt(world,target,reachable) && hasReachableCell(reachable,cellIndex(world, target.x, target.z))) return true;
  for (const cell of cells) for (const next of workNeighbours(cell,target.kind,woodWallTouch301(world,target))) {
    if (canStopAt(world,next,reachable) && !cells.some(own => sameCell(own, next)) && (target.kind!=='smooth-floor'||canTouchSmoothFloor281(world,next,target,geometry)) && hasReachableCell(reachable,cellIndex(world, next.x, next.z))) return true;
  }
  return false;
}
export function planWork(world: World, pawn: Pawn, getBlocked: NavigationGrid, occupied: ReadonlySet<number>, budget: SearchBudget): void {
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  const trip=world.commercialTrip;
  // Schema 301 family: RimWorld's JobGiver_Work order. Each candidate belongs
  // to the work giver RimWorld would use; givers are ordered by the pawn's
  // priority, the work type's natural priority, priorityInType and definition
  // order, and a giver's targets by straight-line distance. Older schemas keep
  // their historical ranks.
  const rim=rimWorkGiverOrder301(Number(world.schemaVersion));
  const deliveryGiver=(destination:HaulDestination):RimWorkGiverId=>{
    switch(destination.type){
      case 'fuel':return 'Refuel';
      case 'turret':return 'RearmTurrets';
      case 'hopper':return 'CookFillHopper';
      case 'fermenting-barrel':return 'FillFermentingBarrel';
      case 'stockpile':return destination.forHunting?'HunterHunt':'HaulGeneral';
      case 'job':{const job=world.jobs.find(j=>j.id===destination.jobId),frame=job?.construction==='frame';return destination.forConstruction?(frame?'ConstructDeliverResourcesToFrames':'ConstructDeliverResourcesToBlueprints'):(frame?'DeliverResourcesToFrames':'DeliverResourcesToBlueprints');}
      case 'aside':return destination.constructionId!==undefined?(destination.forConstruction?'ConstructDeliverResourcesToBlueprints':'DeliverResourcesToBlueprints'):destination.growingZoneId!==undefined||destination.sowCell?'GrowerSow':'HaulGeneral';
    }
  };
  const giverOf=(c:Candidate):RimWorkGiverId=>{
    if(c.firefighting)return 'FightFires';
    if(c.patientRest)return c.patientRest.work==='patient'?'PatientGoToBedTreatment':'PatientGoToBedRecuperate';
    if(c.tend||c.family==='tend')return c.target===pawn?'DoctorTendToSelf':c.rank<=-5?'DoctorTendEmergency':'DoctorTendToHumanlikes';
    if(c.feed||c.family==='feed')return world.pawns.find(p=>p.id===c.id)?.prisoner?'FeedPrisoner':'DoctorFeedHumanlikes';
    if(c.surgery||c.family==='surgery')return 'DoBillsMedicalHumanOperation';
    if(c.rescue||c.family==='rescue')return world.pawns.find(p=>p.id===c.id)?.prisoner?'TakePrisonerToBed':'DoctorRescue';
    if(c.prisonerRelease){const basic=workPriority(pawn,'basic'),warden=workPriority(pawn,'warden');return basic>0&&(warden===0||basic<=warden)?'BasicReleasePrisoner':'ReleasePrisoner';}
    if(c.ward)return c.ward.task.kind==='food'?'DeliverFoodToPrisoner':'ChatWithPrisoner';
    if(c.brewing)return 'TakeBeerOutOfFermentingBarrel';
    if(c.animalRescue)return 'DoctorRescue';
    if(c.animalCare)return 'DoctorTendToAnimals';
    if(c.animalFeed)return 'DoctorFeedAnimals';
    if(c.animalLeading)return 'TakeToPen';
    if(c.animalProduct)return c.animalProduct.task.kind==='milk'?'Milk':'Shear';
    if(c.animalHandling){const kind=c.animalHandling.task.kind;return kind==='slaughter'?'Slaughter':kind==='tame'?'Tame':kind==='lead'?'TakeToPen':kind==='milk'?'Milk':kind==='shear'?'Shear':'Train';}
    if(c.hunting)return 'HunterHunt';
    if(c.research)return 'Research';
    if(c.deepWork)return world.structures.find(s=>s.id===c.id)?.kind==='deep-drill'?'Drill':'GroundPenetratingScan';
    if(c.cleaning)return c.cleaning.task.targets.length?'CleanFilth':'CleanClearSnow';
    if(c.cooking)return stationWorkGiver(c.cooking.station);
    if(c.destination)return deliveryGiver(c.destination);
    if(c.job){
      // A designated job's own blocking items or plants are cleared by its giver.
      if(c.clearance&&isConstruction(c.job))return asBuilder(pawn)?'ConstructDeliverResourcesToBlueprints':'DeliverResourcesToBlueprints';
      if(c.job.kind==='install')return asBuilder(pawn)?'ConstructDeliverResourcesToBlueprints':'DeliverResourcesToBlueprints';
      return jobWorkGiver(c.job);
    }
    return 'HaulGeneral';
  };
  // Distance to the thing the giver scans: the station for bills; for a
  // delivery the destination (blueprint, frame, refuelable, turret, hopper,
  // barrel), the resource then being the one closest to the pawn; for general
  // hauling the haulable thing, then its best storage (highest priority, then
  // closest to the thing). Otherwise the target.
  const scansDestination=(c:Candidate)=>!!c.via&&!!c.destination&&c.destination.type!=='stockpile'&&c.destination.type!=='aside';
  const workCell=(c:Candidate):Cell=>c.cooking?c.cooking.station:scansDestination(c)?c.via!:c.target;
  const deliveryTie=(a:Candidate,b:Candidate):number=>{
    if(!a.via||!b.via||!a.destination||!b.destination)return 0;
    if(a.destination.type==='stockpile'&&b.destination.type==='stockpile')return a.rank-b.rank||horizontalDistanceSquared(a.target,a.via)-horizontalDistanceSquared(b.target,b.via);
    if(scansDestination(a)&&scansDestination(b))return order(sourceKey(a),sourceKey(b))||horizontalDistanceSquared(pawn,a.target)-horizontalDistanceSquared(pawn,b.target);
    return 0;
  };
  // RimWorld's target search order (regions, then the whole map).
  const targetSearch=regionSearch(world,pawn,getBlocked,budget.regions);
  const searchKey=(cell:Cell,giver:RimWorkGiverId):number=>targetSearch.key(cell,giver);
  const giverMemo=new WeakMap<Candidate,RimWorkGiverId>(),keyMemo=new WeakMap<Candidate,number>(),sourceKeyMemo=new WeakMap<Candidate,number>();
  const giverFor=(c:Candidate)=>{let g=giverMemo.get(c);if(g===undefined){g=giverOf(c);giverMemo.set(c,g);}return g;};
  const regionKey=(c:Candidate)=>{let k=keyMemo.get(c);if(k===undefined){const g=giverFor(c);k=searchKey(RIM_WORK_GIVER_SEARCH[g].pathEnd==='interaction'&&!scansDestination(c)?c.target:workCell(c),g);keyMemo.set(c,k);}return k;};
  // A delivery's resource is searched the same way, from the pawn.
  const sourceKey=(c:Candidate)=>{let k=sourceKeyMemo.get(c);if(k===undefined){k=searchKey(c.target,'ConstructDeliverResourcesToBlueprints');sourceKeyMemo.set(c,k);}return k;};
  const order=compareSearchKeys;
  const cmp=(a:Candidate,b:Candidate):number=>rim
    ?compareRimWorkGivers(rimWorkGiver(giverFor(a)),a.priority,rimWorkGiver(giverFor(b)),b.priority)||order(regionKey(a),regionKey(b))||horizontalDistanceSquared(pawn,workCell(a))-horizontalDistanceSquared(pawn,workCell(b))||deliveryTie(a,b)||a.id-b.id
    :compareCandidate(a,b);
  if(groupOnMapMember(world,pawn.id)){pawn.planCooldown=20;return;}
  if(world.scout&&(world.scout.phase==='loading'||world.scout.phase==='leaving')&&world.scout.pawnId===pawn.id
    ||trip&&(trip.phase==='loading'||trip.phase==='leaving'||trip.phase==='unloading')&&trip.pawnId===pawn.id){pawn.planCooldown=20;return;}
  if(medicalWorkRefusal(pawn)){pawn.planCooldown=20;return;}
  // Never enumerate logistics after another colonist exhausted the shared search budget.
  if (budget.remaining === 0 || budget.pairs === 0) return;
  const animalRescuing=animalRescueWanted(world,pawn);
  const slaughtering=slaughterWanted(world,pawn),handling=slaughtering||handlingWanted(world,pawn),leading=leadingWanted(world,pawn),gathering=productWanted(world,pawn),vet=animalCareWanted(world,pawn),vetFeed=animalFeedingWanted(world,pawn);
  const cleaning=cleaningWanted(world,pawn),burying=workPriority(pawn,'haul')>0&&world.structures.some(s=>isBurialContainer256(s.kind,world.schemaVersion)&&s.grave?.corpseId===undefined)&&world.pawns.some(p=>p.state==='dead'&&!burialReason(world,pawn,p));
  const fightingFire=firefightingTargets(world,pawn).length>0;
  let looseWort:boolean|undefined;
  const brewing=world.schemaVersion>=265&&workPriority(pawn,'haul')>0&&world.structures.some(s=>s.kind==='fermenting-barrel'&&s.fermentation&&(s.fermentation.wort>0&&s.fermentation.progress>=1||barrelFreeCapacity265(world,s.id,pawn.id)>0&&(looseWort??=world.piles.some(p=>p.item==='wort'&&p.owner.type==='ground'))));
  const deepWorking=deepWorkWanted(world,pawn);
  const researching=researchWanted(world,pawn),hunting=huntingWanted(world,pawn),warding=wardenWanted(world,pawn);
  const releasePatients=world.pawns.filter(p=>releaseReady(world,pawn,p));
  const releasePriority=Math.min(...[workPriority(pawn,'basic'),workPriority(pawn,'warden')].filter(p=>p>0),5);
  const productionRank=productionPriority(world,pawn),cooking=productionRank<5;
  const selfCare=patientWork(pawn,world.schemaVersion),tendable=workPriority(pawn,'doctor')>0?world.pawns.filter(p=>p!==pawn&&lyingPatient(p)&&treatmentTarget(p)):[];
  const operations=workPriority(pawn,'doctor')>0?world.pawns.filter(p=>p!==pawn&&p.surgeryRequest&&lyingPatient(p)):[];
  const selfTreatment=pawn.selfTend&&workPriority(pawn,'doctor')>0&&treatmentTarget(pawn);
  const feedable=world.pawns.filter(p=>p!==pawn&&workPriority(pawn,feedingWork(p))>0&&(p.prisoner?p.hunger<FEED_HUNGER:p.hunger<=FEED_HUNGER)&&needsAssistedFeeding(p));
  const patients=world.pawns.filter(p=>workPriority(pawn,p.prisoner?'warden':'doctor')>0&&wantsRescue(p));
  let canReload:boolean|undefined;
  const fires=world.structures.filter(s=>allows(s)&&(s.kind==='mini-turret'?(canReload??=!turretReloadPawnReason(pawn))&&wantsTurretReload(world,s):wantsFuel(world,s)));
  const hoppers=workPriority(pawn,'haul')>0?world.structures.filter(s=>allows(s)&&s.kind==='hopper'&&hopperFillWanted(world,s.id)):[];
  if (!brewing && !deepWorking && !handling && !leading && !gathering && !vet && !vetFeed && !animalRescuing && !cleaning && !burying && !fightingFire && !warding && !releasePatients.length && !selfCare && !selfTreatment && !tendable.length && !operations.length && !feedable.length && !patients.length && !researching && !hunting && !cooking && !fires.length && !hoppers.length && !world.jobs.length && (!storageCells(world).length || !world.piles.length && !world.packed.length || workPriority(pawn,'haul') === 0)) { pawn.planCooldown = PLAN_INTERVAL; return; }
  if (!brewing && !deepWorking && !handling && !leading && !gathering && !vet && !vetFeed && !animalRescuing && !cleaning && !burying && !fightingFire && !warding && !releasePatients.length && !selfCare && !selfTreatment && !tendable.length && !operations.length && !feedable.length && !patients.length && !researching && !hunting && !cooking && !fires.length && !hoppers.length && !world.jobs.length && !mayImproveFurnitureStorage(world) && !mayImproveStorage(world)) {pawn.planCooldown=PLAN_INTERVAL;return;}
  const blocked = getBlocked();
  const clearingCells=new Set<number>();
  for(const job of world.jobs){
    if(!job.clearance){
      if(world.schemaVersion<235||job.flowerPotId!==undefined||!(['cut','chop','harvest'].includes(job.kind)||job.tree?.kind==='extract'))continue;
      if(job.status!=='active'||job.reservedBy===null||!world.pawns.some(p=>p.id===job.reservedBy&&p.jobId===job.id))continue;
    }
    // Single-cell jobs already carry the exact source coordinate. Only a
    // multi-cell clearance needs to resolve its persisted Resource ID.
    const source=world.schemaVersion>=235&&job.clearance&&footprintCells(job).length>1
      ?world.resources.find(r=>r.id===job.clearance!.resourceId)??job:job;
    clearingCells.add(cellIndex(world,source.x,source.z));
  }
  // Rankings do not depend on flood order. Try the top ready job directly;
  // a failed targeted search has explored the full component and is reusable.
  // Logistics with a higher priority still uses the ordinary complete planner.
  const ready = world.jobs.filter(job => (job.kind!=='mine'||!explorationEnabled256(world)||world.tiles[cellIndex(world,job.x,job.z)]?.terrain==='rock')&&(job.kind!=='smooth-floor'||!smoothFloorReason281(world,job,job.id,budget.structureGeometry?.()))&&allows(ancientRepairTarget256(world,job))&&(!job.tree||!treeJobReason(world,job,pawn))&&!isConstruction(job) && job.reservedBy === null && !clearingCells.has(cellIndex(world,job.x,job.z)) && workPriority(pawn,workType(job)) > 0
    &&(job.kind!=='fix-breakdown'||fixBreakdownWanted(world,job)&&deliveredMaterial(world,job,'component')===1)
    && sowingJobAllowed(world,pawn,job) && (job.kind!=='sow'||!packedAt(world,job)) && job.escrow.wood >= JOB_WOOD_COST[job.kind] && (isSchema299OrLater(Number(world.schemaVersion)) || pawn.hunger > 20 || job.kind === 'harvest') && (job.kind!=='deconstruct'||deconstructionAvailable(world,job,pawn.id)) && (!job.furniture||furnitureReady(world,job,pawn)&&allows(furnitureWorkTarget(world,job))))
    .map(job => ({ job, target: treeWorkTarget(world,job)??ancientRepairTarget256(world,job), id: job.id, priority: workPriority(pawn,workType(job)), rank: job.kind==='fix-breakdown'?-3:job.kind==='flick'?-2.5:job.kind==='uninstall' ? -2 : job.kind==='deconstruct' ? job.wallDoor296?.plan?2:3 : workType(job) === 'gather' ? 0 : 1, distance: Math.abs(job.x-pawn.x)+Math.abs(job.z-pawn.z) }))
    .sort(cmp);
  let reachable: Reachability | null = null;
  const first = ready[0];
  if (first && (!brewing||first.priority<workPriority(pawn,'haul')) && !deepWorking && (!handling||first.priority<workPriority(pawn,'handle')) && (!leading||first.priority<workPriority(pawn,'handle')) && (!gathering||first.priority<workPriority(pawn,'handle')) && (!vet||first.priority<workPriority(pawn,'doctor')) && (!vetFeed||first.priority<workPriority(pawn,'doctor')) && (!animalRescuing||first.priority<workPriority(pawn,'doctor')) && (!cleaning||first.priority<workPriority(pawn,'clean')) && (!burying||first.priority<workPriority(pawn,'haul')) && (!fightingFire||first.priority<workPriority(pawn,'firefight')) && (!warding||first.priority<workPriority(pawn,'warden')) && (!releasePatients.length||first.priority<releasePriority) && (!hunting||first.priority<workPriority(pawn,'hunt')) && (!researching||first.priority<=workPriority(pawn,'research')) && !selfCare && !selfTreatment && !tendable.length && !operations.length && !feedable.length && (!patients.length||patients.every(p=>workPriority(pawn,p.prisoner?'warden':'doctor')>first.priority)) && (!cooking || productionRank>first.priority) && (workPriority(pawn,'haul') === 0 || first.priority <= workPriority(pawn,'haul'))
    && (first.priority<constructionHaulPriority(pawn)||!world.jobs.some(isConstruction))) {
    const source = first.job.kind === 'sow' ? world.piles.find(p => p.owner.type === 'ground' && sameCell(p.owner, first.job)) : undefined;
    if (!source || reservedSource(world, source.id) === 0) {
      const goals=interactionGoals(world,[treeWorkTarget(world,first.job)??ancientRepairTarget256(world,first.job)],first.job.kind==='smooth-floor'?'smooth-floor':undefined,budget.structureGeometry?.());
      if (!source&&first.job.kind!=='smooth-floor') for (const cell of [treeWorkTarget(world,first.job)??ancientRepairTarget256(world,first.job)]) goals.delete(cellIndex(world,cell.x,cell.z));
      reachable=search(world,pawn,blocked,occupied,budget,goals);
      if (!reachable) return;
      const path=routeToJob(world,treeWorkTarget(world,first.job)??ancientRepairTarget256(world,first.job),reachable,!!source,budget.structureGeometry?.());
      if (path) {
        const quantity=source?Math.min(CARRY_CAPACITY,source.quantity):0;
        const destination=source?findAsideDestination(world,first.job,source,quantity,blocked,budget,pawn):null;
        if (!source || destination) {
          if (source && destination) pawn.haul={sourcePileId:source.id,quantity,phase:'pickup',destination,carryPileId:null};
          else {first.job.reservedBy=pawn.id;first.job.status='active';pawn.jobId=first.job.id;startWallDoorWork296(first.job);}
          pawn.path=path;pawn.state=path.length?'moving':'working';pawn.planCooldown=PLAN_INTERVAL;return;
        }
        reachable=null; // Partial result cannot rank the remaining jobs.
      }
    }
  }
  // No terrain, door, pile or structure mutation occurs during this planner's
  // candidate scan before the reachability object is first consulted.
  reachable ??= searchCandidates(world, pawn, blocked, occupied, budget, true); if (!reachable) return;
  pawn.planCooldown = PLAN_INTERVAL;
  const storage=storageCells(world),placementFacts=world.structures.some(s=>s.shelf)?createGroundCapacityReader(world):undefined;
  const delivered = new Map<string, number>(); const ground = new Map<number, number>();
  const sourceReserved = reservedSourcesByPile(world); const jobReserved = new Map<string, number>(); const zoneReserved = new Map<number, number>();
  const outbound = new Map<number, number>(); const pileById = new Map(world.piles.map(pile => [pile.id, pile]));
  for (const pile of world.piles) {
    if (pile.owner.type === 'job') {const key=`${pile.owner.jobId}:${pile.item}`;delivered.set(key, (delivered.get(key) ?? 0) + pile.quantity);}
    if (pile.owner.type === 'ground') { const key = cellIndex(world, pile.owner.x, pile.owner.z); ground.set(key, (ground.get(key) ?? 0) + pile.quantity); }
  }
  for (const task of haulReservations(world)) {
    if (task.phase === 'pickup') {
      const source = pileById.get(task.sourcePileId);
      if (source?.owner.type === 'ground') { const key = cellIndex(world, source.owner.x, source.owner.z); outbound.set(key, (outbound.get(key) ?? 0) + task.quantity); }
    }
    if (task.destination.type === 'aside' || task.destination.type === 'fuel'||task.destination.type==='turret'||task.destination.type==='hopper'||task.destination.type==='fermenting-barrel') continue;
    if(task.destination.type==='job') {
      const pile=pileById.get(task.phase==='pickup'?task.sourcePileId:task.carryPileId!);
      if(pile){const key=`${task.destination.jobId}:${pile.item}`;jobReserved.set(key,(jobReserved.get(key)??0)+task.quantity);}
    } else zoneReserved.set(task.destination.stockpileId,(zoneReserved.get(task.destination.stockpileId)??0)+task.quantity);
  }
  let best: Candidate | null = null;
  // RimWorld's first-giver rule: a family whose best possible giver (at the
  // pawn's priority for it) comes after the best candidate's giver is never
  // reached, so it is not evaluated at all. Equal givers still compare by
  // distance. Historical schemas evaluate every family.
  const reachableBy=(id:RimWorkGiverId,priority=workPriority(pawn,rimWorkGiver(id).work)):boolean=>!rim||priority>0&&(!best||compareRimWorkGivers(rimWorkGiver(id),priority,rimWorkGiver(giverFor(best)),best.priority)<=0);
  if(brewing&&reachableBy('TakeBeerOutOfFermentingBarrel')){
    for(const candidate of fermentationHaulCandidates265(world,pawn,reachable))if(!best||cmp(candidate,best)<0)best=candidate;
    const proposal=barrelExtractionProposal265(world,pawn,reachable);
    if(proposal){const candidate:Candidate={brewing:proposal,priority:workPriority(pawn,'haul'),rank:-2,distance:proposal.path.length,id:proposal.task.barrelId,target:proposal.task.spot};if(!best||cmp(candidate,best)<0)best=candidate;}
  }
  if(releasePatients.length&&(reachableBy('BasicReleasePrisoner')||reachableBy('ReleasePrisoner')))for(const patient of releasePatients){
    const proposal=releaseProposal(world,pawn,patient,reachable);if(!proposal)continue;
    const candidate:Candidate={prisonerRelease:proposal,priority:releasePriority,rank:-2,distance:Math.abs(pawn.x-patient.x)+Math.abs(pawn.z-patient.z),id:patient.id,target:patient};
    if(!best||cmp(candidate,best)<0)best=candidate;
  }
  if(warding&&reachableBy('DeliverFoodToPrisoner')){const proposal=wardenProposal(world,pawn,reachable,rim?targetSearch:undefined);if(proposal){const candidate:Candidate={ward:proposal,priority:workPriority(pawn,'warden'),rank:-2,distance:Math.abs(pawn.x-proposal.task.spot.x)+Math.abs(pawn.z-proposal.task.spot.z),id:proposal.task.patientId,target:proposal.task.spot};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(fightingFire){const proposal=firefightingProposal(world,pawn,reachable);if(proposal){const candidate:Candidate={firefighting:proposal,priority:workPriority(pawn,'firefight'),rank:-7,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.fireId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(selfCare){const proposal=patientProposal(world,pawn,reachable);if(proposal){const candidate:Candidate={patientRest:proposal,priority:workPriority(pawn,proposal.work),rank:proposal.work==='patient'?-6:-2,distance:0,id:pawn.id,target:pawn};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(selfTreatment){
    const candidate:Candidate={priority:workPriority(pawn,'doctor'),rank:-3.75,distance:0,id:pawn.id,target:pawn,family:'tend'};
    if(!best||cmp(candidate,best)<0){const proposal=tendingProposal(world,pawn,pawn,reachable);if(proposal)best={...candidate,tend:proposal};}
  }
  for(const patient of tendable){
    const candidate:Candidate={priority:workPriority(pawn,'doctor'),rank:urgentTreatment(patient)?-5:-4,distance:Math.abs(patient.x-pawn.x)+Math.abs(patient.z-pawn.z),id:patient.id,target:patient,family:'tend'};
    if(best&&cmp(candidate,best)>=0)continue;
    const proposal=tendingProposal(world,pawn,patient,reachable);if(proposal)best={...candidate,tend:proposal};
  }
  for(const patient of feedable){
    const candidate:Candidate={priority:workPriority(pawn,feedingWork(patient)),rank:-3.5,distance:Math.abs(patient.x-pawn.x)+Math.abs(patient.z-pawn.z),id:patient.id,target:patient,family:'feed'};
    if(best&&cmp(candidate,best)>=0)continue;
    const proposal=feedingProposal(world,pawn,patient,reachable);if(proposal)best={...candidate,feed:proposal};
  }
  for(const patient of operations){
    const candidate:Candidate={priority:workPriority(pawn,'doctor'),rank:-3.25,distance:Math.abs(patient.x-pawn.x)+Math.abs(patient.z-pawn.z),id:patient.id,target:patient,family:'surgery'};
    if(best&&cmp(candidate,best)>=0)continue;
    const proposal=surgeryProposal(world,pawn,patient,reachable);if(proposal)best={...candidate,surgery:proposal};
  }
  for(const patient of patients) {
    const candidate:Candidate={priority:workPriority(pawn,patient.prisoner?'warden':'doctor'),rank:patient.prisoner?-4:-3,distance:Math.abs(patient.x-pawn.x)+Math.abs(patient.z-pawn.z),id:patient.id,target:patient,family:'rescue'};
    if(best&&cmp(candidate,best)>=0)continue;
    const proposal=rescueProposal(world,pawn,patient,reachable);
    if(!proposal)continue;
    best={...candidate,rescue:proposal};
  }
  for (const job of world.jobs) {
    if(!allows(ancientRepairTarget256(world,job))||isConstruction(job)||job.tree&&treeJobReason(world,job,pawn))continue;
    if(job.kind==='mine'&&explorationEnabled256(world)&&world.tiles[cellIndex(world,job.x,job.z)]?.terrain!=='rock')continue;
    if(job.kind==='smooth-floor'&&smoothFloorReason281(world,job,job.id,budget.structureGeometry?.()))continue;
    const work = workType(job);
    if (job.reservedBy !== null || clearingCells.has(cellIndex(world,job.x,job.z)) || workPriority(pawn,work) === 0 || (delivered.get(`${job.id}:wood`) ?? 0) < JOB_WOOD_COST[job.kind] || (!isSchema299OrLater(Number(world.schemaVersion)) && pawn.hunger <= 20 && job.kind !== 'harvest')) continue;
    if(job.kind==='fix-breakdown'&&(!fixBreakdownWanted(world,job)||(delivered.get(`${job.id}:component`)??0)!==1))continue;
    if(job.kind==='sow'&&packedAt(world,job))continue;
    if(job.furniture&&(!furnitureReady(world,job,pawn)||!allows(furnitureWorkTarget(world,job))))continue;
    if(job.kind==='deconstruct'&&!deconstructionAvailable(world,job,pawn.id))continue;
    const candidate: Candidate = { priority: workPriority(pawn,work), rank: job.kind==='fix-breakdown'?-3:job.kind==='flick'?-2.5:job.kind==='uninstall' ? -2 : job.kind==='deconstruct' ? job.wallDoor296?.plan?2:3 : work === 'gather' ? 0 : 1, distance: Math.abs(job.x - pawn.x) + Math.abs(job.z - pawn.z), id: job.id, job, target: treeWorkTarget(world,job)??ancientRepairTarget256(world,job) };
    if (job.kind === 'sow' && ground.has(cellIndex(world, job.x, job.z))) {
      if (best && cmp(candidate, best) >= 0) continue;
      const source = world.piles.find(p => p.owner.type === 'ground' && sameCell(p.owner, job));
      // Clear one stack at a time. Do not compete with another eater or hauler
      // for an obstruction already being removed.
      if (!source || sourceReserved.has(source.id) || !canReach(world, job, reachable, true)) continue;
      const quantity = Math.min(CARRY_CAPACITY, source.quantity);
      const destination = findAsideDestination(world, job, source, quantity, blocked, budget,pawn);
      if (destination) best = { ...candidate, job: undefined, sourceId: source.id, quantity, destination };
      continue;
    }
    if (sowingJobAllowed(world,pawn,job) && (!best || cmp(candidate,best)<0) && canReach(world,ancientRepairTarget256(world,job),reachable,false,budget.structureGeometry?.())) best=candidate;
  }
  if(reachableBy('HaulGeneral')||reachableBy('HaulGeneral',workPriority(pawn,'build')))for(const candidate of furnitureStorageCandidates(world,pawn,blocked,reachable,budget))if(!best||cmp(candidate,best)<0)best=candidate;
  const constructionReachable=reachableBy('ConstructFinishFrames')||reachableBy('DeliverResourcesToBlueprints',workPriority(pawn,'haul'));
  let constructionObstacles:ReturnType<typeof constructionObstructions>|undefined;
  const obstaclesOf=()=>constructionObstacles??=constructionObstructions(world);
  if(constructionReachable)for(const candidate of constructionCandidates(world,pawn,blocked,reachable,budget,obstaclesOf()))if(!best||cmp(candidate,best)<0)best=candidate;
  if(cooking && (!best || productionRank<=best.priority)) {
    const proposal=planCooking(world,pawn,reachable,budget,undefined,rim?targetSearch:undefined);
    if(proposal){const candidate:Candidate={cooking:proposal,priority:proposal.priority,rank:-1,distance:Math.abs(pawn.x-proposal.station.x)+Math.abs(pawn.z-proposal.station.z),id:proposal.station.id,target:proposal.target};
      if(rim?!best||cmp(candidate,best)<0:!best||proposal.priority<best.priority||proposal.priority===best.priority&&best.rank>=-1)best=candidate;}
  }
  if (Number.isFinite(constructionHaulPriority(pawn)) && (isSchema299OrLater(Number(world.schemaVersion)) || pawn.hunger > 20) && (!best || best.priority >= constructionHaulPriority(pawn))
    && (reachableBy('RearmTurrets')||asBuilder(pawn)&&reachableBy('ConstructDeliverResourcesToFrames'))) {
    const zonesByCell = new Map(storage.map(zone => [cellIndex(world, zone.x, zone.z), zone]));
    const hoppersByCell=new Map([...structuresOfKind(world,'hopper')].map(s=>[cellIndex(world,s.x,s.z),s]));
    const isPrisonFood=prisonFoodChecker(world);
    const sources = world.piles.filter(pile => automaticallyHaulable(pile) && !isPrisonFood(pile) && pile.owner.type === 'ground' && allows(pile.owner) && pile.quantity > (sourceReserved.get(pile.id) ?? 0));
    const destinations: { destination: HaulDestination; target: Cell & { kind?: JobKind|import('./types.ts').StructureKind }; priority: number; workPriority:number; wood: number; food: number; 'ai-core'?:number; book?:number; beer?:number; wort?:number; plant?:number; chemfuel?:number; silver?:number; 'mech-corpse'?:number; corpse?:number; unfinished?:number; textile?:number; chunk?:number; steel?:number; gold?:number; uranium?:number; plasteel?:number; component?:number; 'advanced-component'?:number; weapon?:number; apparel?:number; neutroamine?:number; medicine?:number; blocks?:number; jade?:number; prosthesis?:number; items?:ReadonlyMap<ItemId,number>; reachable?: boolean }[] = [];
    // The World is unchanged during this scan: one occupancy index serves every job.
    let occupancy:ConstructionOccupancy|undefined;
    for (const job of world.jobs) {
      if(!allows(job))continue;
      const items=new Map<ItemId,number>();
      for(const cost of constructionRecipe(job).ingredients){const key=`${job.id}:${cost.item}`,capacity=cost.quantity-(delivered.get(key)??0)-(jobReserved.get(key)??0);if(capacity>0)items.set(cost.item,capacity);}
      if (items.size && (job.kind==='fix-breakdown'?fixBreakdownWanted(world,job):constructionSiteFree(world,job,pawn.id,obstaclesOf().get(job.id),occupancy??=new ConstructionOccupancy(world)))) destinations.push({ destination: { type: 'job', jobId: job.id, forConstruction:asBuilder(pawn) }, target: job, priority: 5, workPriority:constructionHaulPriority(pawn), wood: 0, food: 0,items });
    }
    if(workPriority(pawn,'haul')>0)for (const fire of fires) destinations.push(fire.kind==='mini-turret'?{destination:{type:'turret',structureId:fire.id},target:fire,priority:5,workPriority:workPriority(pawn,'haul'),wood:0,food:0,steel:turretReloadCapacity(world,fire.id)}:{destination:{type:'fuel',structureId:fire.id},target:fire,priority:5,workPriority:workPriority(pawn,'haul'),wood:0,food:0,items:new Map([[fuelItem(fire.kind),fuelCapacity(world,fire.id)]])});
    for(const hopper of hoppers)destinations.push({destination:{type:'hopper',structureId:hopper.id},target:hopper,priority:3,workPriority:workPriority(pawn,'haul'),wood:0,food:75});
    if(workPriority(pawn,'haul')>0)for (const zone of storage) {
      if(!allows(zone))continue;
      const capacity = zone.shelfId!==undefined?zone.capacity*3:zone.capacity - (ground.get(cellIndex(world, zone.x, zone.z)) ?? 0) - (zoneReserved.get(zone.id) ?? 0);
      if (capacity > 0 && (isSchema298OrLater(world.schemaVersion)&&zone.filters['ai-core']===true || zone.filters.book || zone.filters.beer || zone.filters.wort || zone.filters.plant || zone.filters.chemfuel || zone.filters.neutroamine || zone.filters['mech-corpse'] || zone.filters.silver || zone.filters.corpse || zone.filters.unfinished || zone.filters.textile || zone.filters.apparel || zone.filters.weapon || zone.filters.medicine || zone.filters.wood || zone.filters.food || zone.filters.chunk || zone.filters.component || zone.filters['advanced-component'] || zone.filters.steel || zone.filters.gold || zone.filters.uranium || zone.filters.jade || zone.filters.plasteel || zone.filters.blocks)) destinations.push({ destination: { type: 'stockpile', stockpileId: zone.id }, target: zone, priority: zone.priority, workPriority:workPriority(pawn,'haul'), 'ai-core':isSchema298OrLater(world.schemaVersion)&&zone.filters['ai-core']===true?1:0, book:zone.filters.book?1:0, beer:zone.filters.beer?capacity:0, wort:zone.filters.wort?capacity:0, plant:zone.filters.plant?1:0, chemfuel:zone.filters.chemfuel?capacity:0, 'mech-corpse':zone.filters['mech-corpse']?1:0, silver:zone.filters.silver?capacity:0, corpse:zone.filters.corpse?1:0, unfinished:zone.filters.unfinished?1:0,textile:zone.filters.textile?capacity:0, apparel:zone.filters.apparel?1:0, weapon:zone.filters.weapon?1:0, medicine:zone.filters.medicine?capacity:0, neutroamine:zone.filters.neutroamine?capacity:0, wood: zone.filters.wood ? capacity : 0, food: zone.filters.food ? capacity : 0, chunk: zone.filters.chunk ? 1 : 0, component: zone.filters.component ? capacity : 0, 'advanced-component':zone.filters['advanced-component']?capacity:0, steel: zone.filters.steel ? capacity : 0, gold:zone.filters.gold?capacity:0, uranium:zone.filters.uranium?capacity:0, jade:zone.filters.jade?capacity:0, plasteel:zone.filters.plasteel?capacity:0, blocks:zone.filters.blocks ? capacity : 0 });
    }
    const total = sources.length * destinations.length;
    const count = Math.min(total, budget.pairs);
    const start = total ? world.logisticsCursor % total : 0;
    const sourceReachable = new Map<number, boolean>();
    // Planning does not mutate piles/reservations until a candidate is committed.
    // A destination/item capacity is therefore stable for this one invocation.
    const storageCapacities = new Map<string,number>();
    // Every test below that can `continue` is a pure read of state that this
    // loop never mutates, so they are evaluated cheapest-first and the
    // pile-only facts are computed once per pile instead of once per pair.
    // The visited pairs, their order, the winner, the cursor and the budget
    // are exactly those of the original pair-by-pair evaluation.
    interface PileFacts {ground:boolean;sourceAdmits:boolean;excess:number;currentPriority:number;available:number;outboundExcess:number}
    const pileFacts:(PileFacts|undefined)[]=new Array(sources.length);
    const factsFor=(pileIndex:number):PileFacts=>{
      let facts=pileFacts[pileIndex];if(facts)return facts;
      const pile=sources[pileIndex]!;
      if(pile.owner.type!=='ground'){facts={ground:false,sourceAdmits:false,excess:0,currentPriority:0,available:0,outboundExcess:0};pileFacts[pileIndex]=facts;return facts;}
      const sourceCell=cellIndex(world, pile.owner.x, pile.owner.z);
      const sourceZone = zonesByCell.get(sourceCell);
      const excess = sourceZone?.shelfId===undefined&&sourceZone ? Math.max(0, (ground.get(sourceCell) ?? 0) - sourceZone.capacity) : 0;
      const sourceAdmits=!!sourceZone&&storageCellAccepts(world,sourceZone,pile);
      const currentPriority = Math.max(sourceAdmits&&!excess?sourceZone!.priority:0,hoppersByCell.has(sourceCell)&&hopperAccepts(pile.item)?3:0);
      facts={ground:true,sourceAdmits,excess,currentPriority,available:pile.quantity - (sourceReserved.get(pile.id) ?? 0),outboundExcess:Math.max(0, excess - (outbound.get(sourceCell) ?? 0))};
      pileFacts[pileIndex]=facts;return facts;
    };
    // One source x destination pair: undefined when it cannot be a candidate,
    // false when it cannot beat `against`, otherwise the candidate.
    const pair=(pileIndex:number,destinationIndex:number,against:Candidate|null):Candidate|undefined|false=>{
      const pile = sources[pileIndex]!;
      if (pile.owner.type !== 'ground') return;
      const facts = factsFor(pileIndex);
      const destination = destinations[destinationIndex]!;
      if (destination.priority <= facts.currentPriority) return;
      if(destination.destination.type==='hopper'&&!hopperAccepts(pile.item))return;
      // A trap leaves items in place. Its replacement still requires a real
      // pickup and delivery, including salvage lying on the blueprint cell.
      if (sameCell(pile.owner, destination.target) && !(world.schemaVersion>=226 && destination.destination.type==='job' && (destination.target as Job).kind==='spike-trap')) return;
      let available = facts.available;
      if (facts.sourceAdmits && facts.excess > 0 && destination.destination.type === 'stockpile') available = Math.min(available, facts.outboundExcess);
      if (available <= 0) return;
      // Ranking is independent of capacity/access. A candidate that cannot beat
      // the winner cannot affect this decision; retain pair order/cursor/budget.
      const candidate:Candidate={priority:destination.workPriority,rank:2+(5-destination.priority)/10,
        distance:Math.abs(pawn.x-pile.owner.x)+Math.abs(pawn.z-pile.owner.z)+Math.abs(destination.target.x-pile.owner.x)+Math.abs(destination.target.z-pile.owner.z),id:pile.id,
        sourceId:pile.id,quantity:0,destination:destination.destination,target:pile.owner,...rim?{via:{x:destination.target.x,z:destination.target.z}}:{}};
      if(against&&cmp(candidate,against)>=0)return false;
      if(destination.destination.type==='stockpile') {
        const zone=zonesByCell.get(cellIndex(world,destination.target.x,destination.target.z))!;
        if(!storageCellAccepts(world,zone,pile))return;
      }
      let capacity=destination.items?.get(pile.item)??destination[pile.kind]??0;
      // Same-priority storage pairs cannot win; avoid their pure capacity scan.
      if(destination.destination.type==='stockpile') {
        const zone=zonesByCell.get(cellIndex(world,destination.target.x,destination.target.z))!;
        const key=`${destination.destination.stockpileId}:${zone.quality||zone.hitPoints||zone.allowFresh===false||zone.allowRotten===false?storageConditionKey(pile,world.tick,zone.allowFresh===false||zone.allowRotten===false):pile.item}`;
        let cached=storageCapacities.get(key);
        if(cached===undefined){cached=storageCapacity(world,zone,pile,undefined,undefined,placementFacts);storageCapacities.set(key,cached);}
        capacity=cached;
      }
      if(destination.destination.type==='hopper')capacity=hopperCapacity(world,destination.destination.structureId,pile.item,pawn.id);
      if (capacity <= 0) return;
      let sourceAccess = sourceReachable.get(pile.id);
      if (sourceAccess === undefined) { sourceAccess = canReach(world, pile.owner, reachable, true); sourceReachable.set(pile.id, sourceAccess); }
      if(!sourceAccess)return;
      destination.reachable??=canReach(world,destination.target,reachable,destination.destination.type!=='job');
      if(!destination.reachable)return;
      candidate.quantity=Math.min(CARRY_CAPACITY,available,capacity);return candidate;
    };
    if(!rim){
      for (let offset = 0; offset < count; offset++) {
        const index = (start + offset) % total;
        const candidate=pair(Math.floor(index / destinations.length),index % destinations.length,best);
        if(candidate)best=candidate;
      }
      budget.pairs -= count;
      if (total) world.logisticsCursor = (start + count) % total;
    }else if(total){
      // RimWorld's order, without the rotating pair window. General hauling
      // scans the haulable things from the closest; the first one with a
      // better storage wins, with its best storage: the highest priority, then
      // the cell closest to the thing. A delivery giver scans its destinations
      // from the closest; the first one with a resource wins, with the
      // resource closest to the pawn. Every pair looked at counts against the
      // shared pair budget, which bounds the work of one tick.
      const near=(cell:Cell)=>horizontalDistanceSquared(pawn,cell);
      // Sources are ground piles: their owner is their cell.
      const at=(i:number)=>sources[i]!.owner as Cell;
      const sourceOrder=sources.map((_,i)=>i).sort((a,b)=>near(at(a))-near(at(b))||a-b);
      const storageIndexes:number[]=[],scannedIndexes:number[]=[];
      destinations.forEach((d,i)=>(d.destination.type==='stockpile'?storageIndexes:scannedIndexes).push(i));
      let visited=0;const spend=()=>++visited<=budget.pairs;
      // General hauling. Which storage cells accept a pile only depends on
      // its storage key: listed once per key, by priority level. A cell's room
      // and access are found on demand, once per key, and a level whose cells
      // all lack room or access is skipped from then on.
      interface StorageLevel {priority:number;cells:number[];open:number}
      const storageFor=new Map<string,{levels:StorageLevel[];usable:Map<number,boolean>}>();
      const storageOf=(pileIndex:number)=>{
        const pile=sources[pileIndex]!,key=storageConditionKey(pile,world.tick,true);
        let entry=storageFor.get(key);if(entry)return entry;
        const accepted=storageIndexes.filter(i=>{const d=destinations[i]!;return storageCellAccepts(world,zonesByCell.get(cellIndex(world,d.target.x,d.target.z))!,pile);})
          .sort((a,b)=>destinations[b]!.priority-destinations[a]!.priority||a-b);
        const levels:StorageLevel[]=[];
        for(const i of accepted){const priority=destinations[i]!.priority,last=levels[levels.length-1];if(last&&last.priority===priority){last.cells.push(i);last.open++;}else levels.push({priority,cells:[i],open:1});}
        entry={levels,usable:new Map()};storageFor.set(key,entry);return entry;
      };
      const usable=(pileIndex:number,destinationIndex:number,known:Map<number,boolean>):boolean=>{
        let ok=known.get(destinationIndex);if(ok!==undefined)return ok;
        const pile=sources[pileIndex]!,d=destinations[destinationIndex]!,zone=zonesByCell.get(cellIndex(world,d.target.x,d.target.z))!;
        const capacityKey=`${(d.destination as {stockpileId:number}).stockpileId}:${zone.quality||zone.hitPoints||zone.allowFresh===false||zone.allowRotten===false?storageConditionKey(pile,world.tick,zone.allowFresh===false||zone.allowRotten===false):pile.item}`;
        let capacity=storageCapacities.get(capacityKey);
        if(capacity===undefined){capacity=storageCapacity(world,zone,pile,undefined,undefined,placementFacts);storageCapacities.set(capacityKey,capacity);}
        ok=capacity>0&&(d.reachable??=canReach(world,d.target,reachable,true));
        known.set(destinationIndex,ok);return ok;
      };
      let hauled:Candidate|null=null;
      // A pile already in storage of the highest priority has no better one.
      let topPriority=-Infinity;for(const i of storageIndexes)topPriority=Math.max(topPriority,destinations[i]!.priority);
      scan:for(const pileIndex of sourceOrder){
        const source=at(pileIndex);
        if(hauled&&near(source)>near(hauled.target))break;
        const facts=factsFor(pileIndex);if(facts.available<=0||facts.currentPriority>=topPriority)continue;
        const {levels,usable:known}=storageOf(pileIndex);
        // The highest priority above the pile's current one that has a valid
        // cell, and in it the cell closest to the pile.
        for(const level of levels){
          if(level.priority<=facts.currentPriority)break;
          if(!level.open)continue;
          // Cells from the closest to the pile (ties by index); usually the
          // first one is taken, so it is found by a scan rather than a sort.
          let found=false;const tried=new Set<number>();
          for(;;){
            let destinationIndex=-1,closest=Infinity;
            for(const i of level.cells){
              if(known.get(i)===false||tried.has(i))continue;
              const d=horizontalDistanceSquared(source,destinations[i]!.target);
              if(d<closest||d===closest&&i<destinationIndex){closest=d;destinationIndex=i;}
            }
            if(destinationIndex<0)break;
            if(!spend())break scan;
            if(!usable(pileIndex,destinationIndex,known)){level.open--;continue;}
            tried.add(destinationIndex);
            const candidate=pair(pileIndex,destinationIndex,hauled??best);
            if(candidate===false){found=true;break;}
            if(candidate){hauled=candidate;found=true;break;}
          }
          if(found)break;
        }
      }
      if(hauled&&(!best||cmp(hauled,best)<0))best=hauled;
      // Deliveries, by giver then distance of the destination; for each, the
      // piles of the items and kinds it takes, closest to the pawn first.
      const byItem=new Map<string,number[]>(),byKind=new Map<string,number[]>();
      for(const i of sourceOrder){const p=sources[i]!;let a=byItem.get(p.item);if(!a)byItem.set(p.item,a=[]);a.push(i);let b=byKind.get(p.kind);if(!b)byKind.set(p.kind,b=[]);b.push(i);}
      const rank=new Map<number,number>();sourceOrder.forEach((i,k)=>rank.set(i,k));
      const sourcesFor=(d:typeof destinations[number]):number[]=>{
        const lists:number[][]=[];
        if(d.items)for(const item of d.items.keys()){const a=byItem.get(item);if(a)lists.push(a);}
        for(const [kind,list] of byKind)if(((d as unknown as Record<string,number|undefined>)[kind]??0)>0)lists.push(list);
        if(lists.length===1)return lists[0]!;
        return [...new Set(lists.flat())].sort((a,b)=>rank.get(a)!-rank.get(b)!);
      };
      const scanned=scannedIndexes.map(i=>{const d=destinations[i]!;const probe:Candidate={priority:d.workPriority,rank:0,distance:0,id:0,destination:d.destination,target:d.target,via:d.target};return {i,giver:rimWorkGiver(giverFor(probe)),priority:d.workPriority,key:regionKey(probe),near:near(d.target)};})
        .filter(d=>d.priority>0).sort((a,b)=>compareRimWorkGivers(a.giver,a.priority,b.giver,b.priority)||order(a.key,b.key)||a.near-b.near||a.i-b.i);
      const pileKeys=new Map<number,number>();
      const pileKey=(i:number)=>{let k=pileKeys.get(i);if(k===undefined){k=searchKey(at(i),'ConstructDeliverResourcesToBlueprints');pileKeys.set(i,k);}return k;};
      let delivered:Candidate|null=null;
      deliver:for(const d of scanned){
        if(delivered){const winner=rimWorkGiver(giverFor(delivered));if((compareRimWorkGivers(d.giver,d.priority,winner,delivered.priority)||order(d.key,regionKey(delivered))||d.near-near(delivered.via!))>0)break;}
        else if(best&&compareRimWorkGivers(d.giver,d.priority,rimWorkGiver(giverFor(best)),best.priority)>0)break;
        for(const pileIndex of [...sourcesFor(destinations[d.i]!)].sort((a,b)=>order(pileKey(a),pileKey(b))||rank.get(a)!-rank.get(b)!)){
          if(!spend())break deliver;
          const candidate=pair(pileIndex,d.i,delivered??best);
          if(candidate===false)break;
          if(candidate){delivered=candidate;break;}
        }
      }
      if(delivered&&(!best||cmp(delivered,best)<0))best=delivered;
      budget.pairs-=Math.min(visited,budget.pairs);
    }
  }
  if(animalRescuing&&reachableBy('DoctorRescue')){const proposal=animalRescueProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={animalRescue:proposal,priority:workPriority(pawn,'doctor'),rank:-3.95,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.task.animalId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(vet&&reachableBy('DoctorTendToAnimals')){const proposal=animalCareProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={animalCare:proposal,priority:workPriority(pawn,'doctor'),rank:-3.9,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.task.animalId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(vetFeed&&reachableBy('DoctorFeedAnimals')){const proposal=animalFeedingProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={animalFeed:proposal,priority:workPriority(pawn,'doctor'),rank:-3.8,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.task.animalId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(leading&&reachableBy('TakeToPen')){const proposal=leadingProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={animalLeading:proposal,priority:workPriority(pawn,'handle'),rank:-3.5,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.task.animalId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(gathering&&reachableBy('Milk')){const proposal=productProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={animalProduct:proposal,priority:workPriority(pawn,'handle'),rank:proposal.task.kind==='milk'?-.9:-.85,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.task.animalId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(slaughtering&&reachableBy('Slaughter')){const proposal=slaughterProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={animalHandling:proposal,priority:workPriority(pawn,'handle'),rank:-4,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.task.animalId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(handling&&reachableBy('Slaughter')){const proposal=handlingProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={animalHandling:proposal,priority:workPriority(pawn,'handle'),rank:-.25,distance:Math.abs(pawn.x-proposal.target.x)+Math.abs(pawn.z-proposal.target.z),id:proposal.task.animalId,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(hunting&&reachableBy('HunterHunt')&&(!best||workPriority(pawn,'hunt')<best.priority||workPriority(pawn,'hunt')===best.priority&&(rim||best.rank>=0))){const proposal=huntingProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={hunting:proposal,priority:workPriority(pawn,'hunt'),rank:-.5,distance:0,id:proposal.task.animalId,target:proposal.target};if(!rim||!best||cmp(candidate,best)<0)best=candidate;}}
  if(researching&&reachableBy('Research')&&(!best||workPriority(pawn,'research')<best.priority||rim&&workPriority(pawn,'research')===best.priority)){const proposal=researchProposal(world,pawn,reachable!);if(proposal){const candidate:Candidate={research:proposal,priority:workPriority(pawn,'research'),rank:9,distance:0,id:proposal.task.stationId,target:proposal.task.spot};if(!rim||!best||cmp(candidate,best)<0)best=candidate;}}
  if(deepWorking&&(reachableBy('Drill')||reachableBy('GroundPenetratingScan')))for(const station of world.structures){
    if(station.kind!=='deep-drill'&&station.kind!=='ground-scanner')continue;
    const priority=workPriority(pawn,station.kind==='deep-drill'?'mine':'research'),rank=station.kind==='deep-drill'?1.2:10;
    if(priority<=0||best&&(priority>best.priority||!rim&&priority===best.priority&&rank>best.rank))continue;
    const proposal=deepWorkProposal(world,pawn,station,reachable!);if(!proposal)continue;
    const candidate:Candidate={deepWork:proposal,priority,rank,distance:Math.abs(pawn.x-proposal.task.spot.x)+Math.abs(pawn.z-proposal.task.spot.z),id:station.id,target:proposal.task.spot};
    if(!best||cmp(candidate,best)<0)best=candidate;
  }
  if(cleaning&&reachableBy('CleanClearSnow')&&(!best||workPriority(pawn,'clean')<best.priority||rim&&workPriority(pawn,'clean')===best.priority)){const proposal=cleaningProposal(world,pawn,reachable!,rim?targetSearch:undefined);if(proposal){
    if(!rim){startCleaning(pawn,proposal);return;}
    const candidate:Candidate={cleaning:proposal,priority:workPriority(pawn,'clean'),rank:0,distance:0,id:proposal.id,target:proposal.target};if(!best||cmp(candidate,best)<0)best=candidate;}}
  if(burying&&(rim?!best||compareRimWorkGivers(rimWorkGiver('HaulCorpses'),workPriority(pawn,'haul'),rimWorkGiver(giverOf(best)),best.priority)<0:!best||workPriority(pawn,'haul')<best.priority||workPriority(pawn,'haul')===best.priority&&best.rank>1)&&assignBurial(world,pawn,()=>reachable))return;
  if(best?.cleaning){startCleaning(pawn,best.cleaning);return;}
  if(best?.brewing){pawn.brewing=best.brewing.task;pawn.path=best.brewing.path;pawn.state=pawn.path.length?'moving':'working';return;}
  if(best?.deepWork){startDeepWork(pawn,best.deepWork);return;}
  if(best?.animalHandling){startHandling(pawn,best.animalHandling,world);return;}
  if(best?.animalLeading){startLeading(world,pawn,best.animalLeading);return;}
  if(best?.animalProduct){startProduct(pawn,best.animalProduct);return;}
  if(best?.animalFeed){startAnimalFeeding(pawn,best.animalFeed);return;}
  if(best?.animalRescue){startAnimalRescue(world,pawn,best.animalRescue);return;}
  if(best?.animalCare){startAnimalCare(pawn,best.animalCare);return;}
  if(best?.firefighting){startFirefighting(pawn,best.firefighting);return;}
  if(best?.hunting){pawn.hunting=best.hunting.task;pawn.path=best.hunting.path;pawn.state=pawn.path.length?'moving':'idle';pawn.planCooldown=0;return;}
  if(best?.research){pawn.research=best.research.task;pawn.path=best.research.path;pawn.state=pawn.path.length?'moving':'working';return;}
  if(best?.patientRest){startPatientRest(world,pawn,best.patientRest);return;}
  if(best?.prisonerRelease){startPrisonerRelease(pawn,best.prisonerRelease);return;}
  if(best?.ward){startWarden(pawn,best.ward);return;}
  if(best?.feed){startFeeding(pawn,best.feed);return;}
  if(best?.surgery){startSurgery(pawn,best.surgery);return;}
  if(best?.tend){startTending(pawn,best.tend);return;}
  if(best?.rescue){startRescue(world,pawn,best.rescue);return;}
  if (best?.cooking) {
    const proposal=best.cooking;
    pawn.cooking=proposal.task??null;pawn.haul=proposal.refuel??null;pawn.path=proposal.path;pawn.state=proposal.path.length?'moving':'working';pawn.planCooldown=0;return;
  }
  if (best) {
    const path = routeToJob(world, best.target, reachable, !best.job,budget.structureGeometry?.())!;
    if (best.destination) pawn.haul = { ...(best.whole?{whole:true as const}:{}), sourcePileId: best.sourceId!, quantity: best.quantity!, phase: 'pickup', destination: best.destination, carryPileId: null };
    else { if(best.job!.kind==='install')best.job!.installationWork=asBuilder(pawn)?'build':'haul';if(best.clearance)best.job!.clearance=best.clearance;best.job!.reservedBy = pawn.id; best.job!.status = 'active'; pawn.jobId = best.job!.id;startWallDoorWork296(best.job!); }
    pawn.path = path; pawn.state = path.length ? 'moving' : 'working'; return;
  }
}
import { medicalWorkRefusal } from './health-rules.ts';
import { compareRimWorkGivers,horizontalDistanceSquared,jobWorkGiver,RIM_WORK_GIVER_SEARCH,rimWorkGiver,rimWorkGiverOrder301,stationWorkGiver,type RimWorkGiverId } from './work-givers-rimworld.ts';
import { compareSearchKeys,regionSearch } from './region-search.ts';
