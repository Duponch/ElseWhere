import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {factionCommsTask298} from './faction-comms-state-298.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import { startWallDoorWork296, wallDoorHasIntent296 } from './wall-door-state-296.ts';
import {ancientCasketOpenIntent256} from './ancient-casket-open-intent-256.ts';
import {isAncientCasket256} from './ancient-casket-state-256.ts';
import {planAncientCasketRelease256} from './ancient-casket-release-256.ts';
import {treeJobReason} from './tree-transfer.ts';
import { isFueledBuilding } from './fuel.ts';
import {plantExecutionReserved} from './construction-plants.ts';
import { allowedAreaReason } from './allowed-area-state.ts';
import { workPriority, workType, haulingWork } from './work-types.ts';
import { backgroundWorkRefusal,violentWorkRefusal } from './colonist-backgrounds.ts';
import { mentalCrisisLabel,mentalCrisisRefusal } from './mental-presentation.ts';
import {smoothFloorReason281} from './smooth-floor-281.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { isColonist } from './affiliation.ts';
import { captureReason,captureProposal } from './capture.ts';
import { arrestReason,arrestProposal } from './arrest.ts';
import { arrestSuccessChance } from './arrest-rules.ts';
import { feedingReason } from './feeding-rules.ts';
import { feedingProposal } from './feeding.ts';
import { tendingReason,tendingProposal,lyingPatient } from './tending.ts';
import { carrierOf } from './rescue-state.ts';
import { rescueReason,rescueProposal,wantsRescue } from './rescue.ts';
import { stationRecipe, taskWork } from './production-recipes.ts';
import { furnitureReady, furnitureWorkTarget, packedAt } from './furniture-rules.ts';
import { deconstructionAvailable } from './deconstruction-rules.ts';
import { rememberPriorityWork, expirePriorityWork } from './priority-work-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { cancelMelee } from './melee-state.ts';
import { isCookingOrder } from './order-types.ts';
import { advanceCookingOrder, planCookingOrder, queuedCookingReason, startCookingOrder } from './player-cooking.ts';
import { footprintCells } from './definitions.ts';
import { constructionSkillRequired,constructionSupplied } from './construction-materials.ts';
import { isRoofJob } from './roof-rules.ts';
import { asBuilder, constructionHaulPriority, constructionObstruction, constructionSiteFree, isConstruction } from './construction-rules.ts';
import { growingJobValid, sowingJobAllowed } from './farming.ts';
import { groundPile,groundPilesAt } from './ground-placement.ts';
import { harvestable } from './plants.ts';
import { blockedCells, cellIndex, interactionGoals, reachableCells, routeToJob } from './pathfinding.ts';
import { search, type NavigationGrid, type SearchBudget } from './work-planner.ts';
import { planCommandDrops, releaseWork } from './work-release.ts';
import { haulOrderCell, planHaulOrder, queuedHaulReason, startHaulOrder, type HaulOrderTarget } from './player-hauling.ts';
import { canReach, destinationCell } from './work-planner.ts';
import type { Cell, CommandResult, HaulTask, Job, Pawn, World } from './types.ts';

import { interruptDraftWork } from './drafting.ts';
import { consumeReason,consumeProposal,consumeWarnings,isForcedConsuming } from './consuming.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { equipmentOrderReason } from './equipment.ts';
import { apparelLabel } from './apparel-rules.ts';
import { equippedWeapon,weaponLabel,type EquipmentAction } from './equipment-rules.ts';

export interface PlayerOrders { active: number | 'bury' | 'equipment' | 'haul' | 'cook' | 'feed' | 'tend' | 'rescue' | 'consume' | null; queue: import('./order-types.ts').QueuedOrder[] }
export type OrderCommand = { type:'order-cook';pawnId:number;structureId:number;queue:boolean } | { type: 'order-job'; pawnId: number; jobId: number; queue: boolean } | { type:'order-haul';pawnId:number;target:HaulOrderTarget;queue:boolean } | { type: 'clear-orders'; pawnId: number };
export interface OrderOption { jobId: number; openCasketId?:number; consumePileId?:number; warnings?:string[]; arrestPatientId?:number; capturePatientId?:number; equipmentItemId?:number; equipmentAction?:EquipmentAction; cookStationId?:number; rescuePatientId?:number; tendPatientId?:number; feedPatientId?:number; haulTarget?:HaulOrderTarget; label: string; enabled: boolean; reason?: string }
export const MAX_QUEUED_ORDERS = 32;
const labels: Record<Job['kind'], string> = {'ship-computer':'Construire l’ordinateur de vaisseau','ship-sensors':'Construire les capteurs de vaisseau','firefoam-popper':'Construire le diffuseur de mousse','smooth-floor':'Lisser le sol','ship-cryptosleep-casket':'Construire le caisson spatial','ship-beam':'Construire la poutre structurelle de vaisseau','ship-engine':'Construire le moteur Johnson–Tanaka','ship-reactor':'Construire le réacteur stellaire','cryptosleep-casket':'Construire le caisson de cryptosommeil','fueled-smithy':'Construire la forge à combustible','electric-smithy':'Construire la forge électrique',brewery:'Construire la brasserie','fermenting-barrel':'Construire le tonneau de fermentation',column:'Construire la colonne',urn:'Construire l’urne','stele-large':'Construire la grande stèle','stele-grand':'Construire la stèle monumentale',sarcophagus:'Construire le sarcophage','torch-lamp':'Construire la lampe-torche','build-bridge':'Construire le pont','remove-bridge':'Retirer le pont',vent:'Construire la bouche d’aération','extract-tree':'Déraciner cet arbre','replant-tree':'Replanter cet arbre',shelf:'Construire l’étagère','small-shelf':'Construire la petite étagère','spike-trap':'Construire le piège à pointes','double-bed':'Construire le lit double','electric-crematorium':'Construction du crématorium électrique','electric-smelter':'Construire la fonderie électrique','sleeping-spot':'Placer le couchage au sol','animal-sleeping-spot':'Placer le couchage animal','biofuel-refinery':'Construire la raffinerie de biocarburant','geothermal-generator':'Construire la centrale géothermique','chemfuel-generator':'Construire le générateur à biocarburant','nutrient-paste-dispenser':'Construire le distributeur de pâte nutritive',hopper:'Construire la trémie','orbital-beacon':'Construire une balise orbitale','comms-console':'Construire la console de communication','deep-drill':'Construire une foreuse profonde','ground-scanner':'Construire le scanner souterrain', 'vitals-monitor':'Construire le moniteur vital', 'drug-lab':'Construire le laboratoire de chimie', 'hydroponics-basin':'Construire le bac hydroponique', 'mini-turret':'Construire la mini-tourelle', 'tube-television':'Construire la télévision cathodique', sandbags:'Construire les sacs de sable', autodoor:'Construire la porte automatique', fence:'Construire la clôture','fence-gate':'Construire le portillon','pen-marker':'Construire le marqueur d’enclos', 'art-bench':'Construire l’atelier de sculpture','small-sculpture':'Petite sculpture','large-sculpture':'Grande sculpture',grave:'Creuser une tombe','lay-floor':'Poser un sol','remove-floor':'Retirer un sol',heater:'Radiateur','wind-turbine':'Éolienne',flick:'Actionner l’interrupteur','power-conduit':'Construire le conduit','power-switch':'Construire l’interrupteur',battery:'Construire la batterie','solar-generator':'Construire le panneau solaire', 'fueled-stove':'Construire la cuisinière à bois', 'electric-stove':'Construire la cuisinière électrique', 'butcher-table':'Construire la table de boucherie', 'butcher-spot':'boucherie', cooler:'Construire le climatiseur', 'research-bench':'Bureau de recherche','tailor-bench':'Établi de tailleur','electric-tailor-bench':'Établi de tailleur électrique','machining-table':'Construire l’atelier d’usinage','fabrication-bench':'Construire l’établi de fabrication','hi-tech-research-bench':'Construire le bureau de recherche haute technologie','multi-analyzer':'Construire le multi-analyseur', 'crafting-spot':'Placer l’artisanat', repair:'réparer', 'fix-breakdown':'Remplacer le composant en panne', 'wood-generator':'construire le générateur à bois', 'sun-lamp':'construire la lampe horticole', 'standing-lamp':'construire la lampe', 'passive-cooler':'Construire le refroidisseur passif', 'build-roof':'Poser le toit', 'remove-roof':'Retirer le toit', door:'Construire la porte', stonecutter:'Construire la table de taille', mine:'Miner', uninstall:'Désinstaller',install:'Réinstaller', deconstruct:'Déconstruire', chop:'Abattre',harvest:'Récolter',cut:'Couper',sow:'Semer',wall:'Construire le mur',bedroll:'Construire le sac de couchage',bed:'Construire le lit','hospital-bed':'Construire le lit d’hôpital',table:'Construire la table','table-square':'Construire la table carrée','table-long':'Construire la table longue',stool:'Construire le tabouret','dining-chair':'Construire la chaise',armchair:'Construire le fauteuil','end-table':'Construire la table de chevet',dresser:'Construire la commode','flower-pot':'Construire le pot de fleurs',campfire:'Construire le feu',horseshoes:'Construire le piquet','chess-table':'Construire la table d’échecs' };
const fail = (reason: string): CommandResult => ({ok:false,code:'invalid-command',reason});
const busy = (pawn: Pawn) => pawn.jobId !== null || !!(pawn.shipCasketTask277 || pawn.cryptosleepTask || pawn.openCasket || pawn.firefoamTask290 || pawn.hunting || pawn.heatRefuge || pawn.research || pawn.equipmentTask || pawn.ward || pawn.feed || pawn.tend || pawn.surgery || pawn.rescue || pawn.haul || pawn.cooking || pawn.need || pawn.recreation.task);
const clearingPlant=(world:World,job:Job)=>!isConstruction(job)?undefined:job.clearance?world.resources.find(r=>r.id===job.clearance!.resourceId):constructionObstruction(world,job).plant;
const orderLabel=(world:World,job:Job)=>clearingPlant(world,job)?'Couper la plante qui gêne le chantier':labels[job.kind];

/** This provider orders one executable job, never an entire construction chain.
 * Quantity-based delivery is handled separately by player-hauling. */
export function orderReadiness(world: World, pawn: Pawn, job: Job, accepted=false, queued=false): string | undefined {
  if(!wallDoorHasIntent296(job)&&(!accepted||queued))return 'Le plan et la désignation de ce retrait ont été annulés.';
  const areaReason=allowedAreaReason(world,pawn,job);if(areaReason)return areaReason;
  if(!isColonist(pawn)||pawn.prisoner)return 'Seul un colon libre peut recevoir un ordre de travail.';
  const work=job.kind==='install'&&!job.installationWork?(asBuilder(pawn)?'build':'haul'):workType(job);
  const refusal=backgroundWorkRefusal(pawn,work);if(refusal)return refusal;
  if(job.kind==='lay-floor'&&job.floor&&pawn.skills.construction.level<FLOOR_DEFINITIONS[job.floor].skill)return `Construction ${FLOOR_DEFINITIONS[job.floor].skill} nécessaire pour finir ce sol.`;
  if (!accepted&&(job.kind==='install'?!Number.isFinite(constructionHaulPriority(pawn)):!workPriority(pawn,workType(job)))) return 'Ce travail est désactivé dans le tableau Travail.';
  if (job.reservedBy !== null && job.reservedBy !== pawn.id) return 'Travail réservé par un autre colon.';
  if(world.schemaVersion>=235&&!queued&&job.flowerPotId===undefined){
    const sourceId=job.clearance?.resourceId??(job.tree?.kind==='extract'?job.tree.resourceId:undefined)??job.plantTarget?.resourceId
      ??(['cut','chop','harvest'].includes(job.kind)?world.resources.find(r=>r.x===job.x&&r.z===job.z)?.id:clearingPlant(world,job)?.id);
    if(sourceId!==undefined&&plantExecutionReserved(world,sourceId,pawn.id))return 'Cette plante est déjà travaillée par un autre colon.';
  }
  if (job.growingZoneId !== undefined && !growingJobValid(world,job)) return 'La culture ne permet plus ce travail.';
  if(!accepted&&!sowingJobAllowed(world,pawn,job))return 'Plantes 8 nécessaire pour semer cette racine médicinale.';
  if(job.kind==='smooth-floor'){const reason=smoothFloorReason281(world,job,job.id);if(reason)return reason;}
  if(job.kind==='mine'&&world.tiles[job.z*world.width+job.x]?.terrain!=='rock')return 'Le massif a disparu.';
  if(job.tree){const reason=treeJobReason(world,job,pawn);if(reason)return reason;}
  if (job.kind === 'harvest') {
    const plant = world.resources.find(r=>r.x===job.x&&r.z===job.z);
    if (!plant || !harvestable(world,plant)) return 'La plante ne peut pas être récoltée.';
  }
  if (isConstruction(job)) {
    const plant=clearingPlant(world,job);
    if((!accepted||job.clearance)&&plant&&plant.kind!=='rock')return;
    if(job.clearance)return 'La plante à dégager a disparu.';
    const skill=constructionSkillRequired(job.kind);if(pawn.skills.construction.level<skill)return `Construction ${skill} nécessaire pour finir cet ouvrage.`;
    if (!constructionSupplied(world,job)) return 'Approvisionnement nécessaire ; choisissez Livrer les matériaux.';
    if (!constructionSiteFree(world,job,pawn.id)) return 'Chantier gêné ; dégagez les piles ou attendez le passage des colons.';
  }
  if(job.furniture&&!furnitureReady(world,job,pawn))return 'Meuble utilisé ou emplacement encombré.';
  if (job.kind === 'deconstruct' && !deconstructionAvailable(world,job,pawn.id)) return 'Bâtiment utilisé ou réservé par un autre colon.';
  if (job.kind === 'sow' && (groundPile(world,job)||packedAt(world,job))) return 'Le sol doit être dégagé ; choisissez Dégager avant de semer.';
}
function goals(world: World, job: Job) {
  const plant=clearingPlant(world,job),cells=plant?[plant]:footprintCells(furnitureWorkTarget(world,job) as Job), result=interactionGoals(world,cells,job.kind,undefined,job);
  if(job.kind!=='smooth-floor')for(const cell of cells)result.delete(cellIndex(world,cell.x,cell.z));
  return result;
}
function route(world:World,pawn:Pawn,job:Job):Cell[]|null {
  return routeToJob(world,clearingPlant(world,job)??furnitureWorkTarget(world,job),reachableCells(world,pawn,blockedCells(world),new Set(),goals(world,job)),false);
}
function preflight(world:World,pawn:Pawn,job:Job,queue=false):string|undefined {
  const medical=medicalWorkRefusal(pawn);if(medical)return medical;
  if(pawn.interruptedCargo)return 'Ce colon doit d’abord déposer sa cargaison interrompue. Libérez une case de sol à proximité.';
  if(pawn.collapsePending || world.restRules==='legacy'&&pawn.rest===0) return 'Ce colon doit récupérer de son épuisement.';
  if(pawn.jobId===job.id || queue&&pawn.orders.queue.includes(job.id)) return 'Ce travail est déjà attribué à ce colon.';
  return orderReadiness(world,pawn,job,false,queue&&(busy(pawn)||pawn.orders.queue.length>0));
}
/** Called only for a menu query in the worker, not on render frames/snapshots. */
export function queryOrderOptions(world:World,pawnId:number,cell:Cell,queue=false):OrderOption[] {
  if(world.pawns.some(p=>p.id===pawnId&&(!isColonist(p)||p.prisoner)))return [];
  const pawn=world.pawns.find(p=>p.id===pawnId);if(!pawn)return [];
  if(pawn.mental?.crisis)return [{jobId:0,label:mentalCrisisLabel(pawn.mental.crisis.kind),enabled:false,reason:mentalCrisisRefusal(pawn)}];
  const jobs=world.jobs.filter(j=>footprintCells(j).some(c=>c.x===cell.x&&c.z===cell.z));
  const job=jobs.find(j=>!isRoofJob(j))??jobs[0],piles=groundPilesAt(world,cell),pile=piles[0],options:OrderOption[]=[];
  for(const casket of world.structures.filter(isAncientCasket256))if(footprintCells(casket).some(c=>c.x===cell.x&&c.z===cell.z)){
    let reason=queue?'Ouvrir une capsule est un ordre direct, sans mise en file.':exhausted(world,pawn);
    if(!reason){const intent=ancientCasketOpenIntent256(world,{type:'order-open-casket',pawnId,casketId:casket.id});if(!intent.ok)reason=intent.reason;}
    if(!reason&&!planCommandDrops(world,{type:'clear-orders',pawnId}))reason='La cargaison doit pouvoir être déposée avant l’ouverture.';
    // Read-only real release preflight, on this explicit worker query only.
    // Its clinical draft/RNG remain private. Do not expose hidden occupants or
    // offer an opening that the current original-holder boundary will refuse.
    if(!reason&&!planAncientCasketRelease256(world,casket).ok)reason='Le contenu de cette capsule ne peut pas encore être libéré.';
    options.push({jobId:0,openCasketId:casket.id,label:'Ouvrir la capsule ancienne',enabled:!reason,...reason?{reason}:{}});
  }
  for(const food of piles)if(food.kind==='food'||isSchema265OrLater(world.schemaVersion)&&food.kind==='beer'&&food.item==='beer'){
    const reason=queue?'La consommation directe ne peut pas être mise en file.':consumeReason(world,pawn,food)??(!consumeProposal(world,pawn,food)?'Aucun accès libre au contact de cette nourriture.':undefined);
    options.push({jobId:0,consumePileId:food.id,label:(food.kind==='beer'?'Boire ':'Consommer ')+ITEM_DEFINITIONS[food.item].label,enabled:!reason,warnings:consumeWarnings(world,pawn,food),...reason?{reason}:{}});
  }
  for(const target of jobs) {
    const reason=preflight(world,pawn,target,queue) ?? (route(world,pawn,target)===null?'Aucun accès praticable à ce travail.':undefined);
    options.push({jobId:target.id,label:orderLabel(world,target),enabled:!reason,...(reason?{reason}:{})});
  }
  const primary=equippedWeapon(world,pawn);
  const weapons=piles.filter(p=>p.kind==='weapon');
  if(!weapons.length&&pawn.x===cell.x&&pawn.z===cell.z&&primary)weapons.push(primary);
  for(const weapon of weapons){
    const action=weapon===primary?'drop':'equip';
    const reason=queue?'La file d’équipement n’est pas encore disponible.':equipmentOrderReason(world,pawn,weapon,action)
      ??(action==='equip'&&routeToJob(world,cell,reachableCells(world,pawn,blockedCells(world),new Set()),true)===null?'Aucun accès praticable à cette arme.':undefined);
    options.push({jobId:0,equipmentItemId:weapon.id,equipmentAction:action,label:`${action==='equip'?'Équiper':'Déposer'} ${weaponLabel(weapon)}`,enabled:!reason,...reason?{reason}:{}});
  }
  for(const apparel of piles.filter(p=>p.kind==='apparel')){
    const reason=queue?'La file d’équipement n’est pas encore disponible.':equipmentOrderReason(world,pawn,apparel,'wear')
      ??(routeToJob(world,cell,reachableCells(world,pawn,blockedCells(world),new Set()),true)===null?'Aucun accès praticable à ce vêtement.':undefined);
    options.push({jobId:0,equipmentItemId:apparel.id,equipmentAction:'wear',label:`Porter ${apparelLabel(apparel)}`,enabled:!reason,...reason?{reason}:{}});
  }
  const targets:HaulOrderTarget[]=[];
  if(job&&isConstruction(job)) {
    const obstacle=constructionObstruction(world,job);
    if((obstacle.pile||obstacle.pack)&&!obstacle.plant)targets.push({type:'clear',jobId:job.id});
    if(!constructionSupplied(world,job))targets.push({type:'job',jobId:job.id});
  }
  if(job?.kind==='sow'&&(pile||packedAt(world,cell)))targets.push({type:'clear-sow',jobId:job.id});
  const pack=packedAt(world,cell);if(pack)targets.push({type:'furniture',structureId:pack.building.id});
  for(const source of piles)targets.push({type:'pile',pileId:source.id});
  const fire=world.structures.find(s=>(stationRecipe(s)!==null||isFueledBuilding(s.kind)||s.kind==='mini-turret')&&footprintCells(s).some(c=>c.x===cell.x&&c.z===cell.z));
  if(fire&&isFueledBuilding(fire.kind))targets.push({type:'fuel',structureId:fire.id});
  if(fire?.kind==='mini-turret')targets.push({type:'turret',structureId:fire.id});
  for(const target of targets) {
    const view=orderView(world,pawn,queue),proposal=planHaulOrder(view,view.pawns.find(p=>p.id===pawn.id)!,target);
    const reason=exhausted(world,pawn)??proposal.reason;
    options.push({jobId:job?.id??0,haulTarget:target,label:proposal.label,enabled:!reason,...(reason?{reason}:{})});
  }
  if(fire&&stationRecipe(fire)) {
    const view=orderView(world,pawn,queue),proposal=planCookingOrder(view,view.pawns.find(p=>p.id===pawn.id)!,fire.id),reason=exhausted(world,pawn)??proposal.reason;
    options.push({jobId:0,cookStationId:fire.id,label:proposal.label,enabled:!reason,...(reason?{reason}:{})});
  }
  if(world.schemaVersion>=213)for(const patient of world.pawns)if(patient!==pawn&&patient.x===cell.x&&patient.z===cell.z&&isColonist(patient)&&!patient.prisoner&&patient.mental?.crisis&&patient.state!=='dead'){
    const admission=exhausted(world,pawn)??arrestReason(world,pawn,patient);
    const reason=queue?'L’arrestation est un ordre direct, sans mise en file.':admission
      ??(!arrestProposal(world,pawn,patient,reachableCells(world,pawn,blockedCells(world),new Set()))?'Aucun lit de prison accessible et disponible.':undefined);
    const chance=admission?undefined:patient.state==='downed'||violentWorkRefusal(patient)?1:arrestSuccessChance(pawn);
    options.push({jobId:0,arrestPatientId:patient.id,label:`Arrêter ${patient.name}${chance!==undefined?` · acceptation ${Number((chance*100).toFixed(1)).toLocaleString('fr-FR')} %`:''}`,enabled:!reason,...reason?{reason}:{}});
  }
  for(const patient of world.pawns)if(patient!==pawn&&patient.x===cell.x&&patient.z===cell.z&&!isColonist(patient)&&!patient.prisoner&&patient.state!=='dead'){
    const reason=queue?'La capture ne peut pas encore être ajoutée à une file.':exhausted(world,pawn)??captureReason(world,pawn,patient)
      ??(!captureProposal(world,pawn,patient,reachableCells(world,pawn,blockedCells(world),new Set()))?'Aucun lit de prison accessible et disponible.':undefined);
    options.push({jobId:0,capturePatientId:patient.id,label:`Capturer ${patient.name}`,enabled:!reason,...reason?{reason}:{}});
  }
  for(const patient of world.pawns)if(patient.id!==pawn.id&&patient.x===cell.x&&patient.z===cell.z&&wantsRescue(patient,true)){
    const reason=queue?'Le secours direct ne peut pas encore être ajouté à une file.':exhausted(world,pawn)??rescueReason(world,pawn,patient,true)
      ??(!rescueProposal(world,pawn,patient,reachableCells(world,pawn,blockedCells(world),new Set()),true)?'Aucun couchage accessible et disponible.':undefined);
    options.push({jobId:0,rescuePatientId:patient.id,label:`Secourir ${patient.name}`,enabled:!reason,...reason?{reason}:{}});
  }
  for(const patient of world.pawns)if(patient!==pawn&&patient.x===cell.x&&patient.z===cell.z&&lyingPatient(patient)){
    const reason=queue?'La file de soins n’est pas encore disponible.':tendingReason(world,pawn,patient)??(!tendingProposal(world,pawn,patient,reachableCells(world,pawn,blockedCells(world),new Set()))?'Aucune place accessible au chevet.':undefined);
    options.push({jobId:0,tendPatientId:patient.id,label:`Soigner ${patient.name}`,enabled:!reason,...reason?{reason}:{}});
    const feedReason=queue?'La file d’alimentation assistée n’est pas encore disponible.':feedingReason(world,pawn,patient)??(!feedingProposal(world,pawn,patient,reachableCells(world,pawn,blockedCells(world),new Set()))?'Aucun aliment autorisé ou accès au chevet.':undefined);
    options.push({jobId:0,feedPatientId:patient.id,label:`Nourrir ${patient.name}`,enabled:!feedReason,...feedReason?{reason:feedReason}:{}});
  }
  if(pawn.x===cell.x&&pawn.z===cell.z){
    const reason=queue?'La file de soins n’est pas encore disponible.':tendingReason(world,pawn,pawn)??(!tendingProposal(world,pawn,pawn,reachableCells(world,pawn,blockedCells(world),new Set()))?'Aucune place pour se soigner.':undefined);
    options.push({jobId:0,tendPatientId:pawn.id,label:'Se soigner',enabled:!reason,...reason?{reason}:{}});
  }
  return options;
}
const exhausted=(world:World,pawn:Pawn)=>(carrierOf(world,pawn.id)?'Ce colon est transporté.':undefined)??medicalWorkRefusal(pawn)??(pawn.interruptedCargo?'Ce colon doit d’abord déposer sa cargaison interrompue. Libérez une case de sol à proximité.':pawn.collapsePending||world.restRules==='legacy'&&pawn.rest===0?'Ce colon doit récupérer de son épuisement.':undefined);
function orderView(world:World,pawn:Pawn,queue:boolean):World {
  if(queue)return world;
  return {...world,pawns:world.pawns.map(p=>p!==pawn?p:{...p,allowedAreaReturn:undefined,haul:null,need:null,cooking:null,orders:{active:null,queue:[]}})};
}
export function clearQueuedOrders(world:World,pawn:Pawn):void {
  const ids=new Set(pawn.orders.queue);
  for(const job of world.jobs)if(ids.has(job.id)&&job.reservedBy===pawn.id){delete job.clearance;delete job.installationWork;job.reservedBy=null;job.status='pending';}
  pawn.orders.queue=[];
}
export function startJobOrder(pawn:Pawn,job:Job,path:Cell[]):void {
  if(job.kind==='install')job.installationWork??=asBuilder(pawn)?'build':'haul';
  job.reservedBy=pawn.id;job.status='active';pawn.jobId=job.id;
  startWallDoorWork296(job);
  pawn.orders.active=job.id;pawn.path=path;pawn.planCooldown=0;
  pawn.state=path.length||pawn.moveCooldown>0?'moving':'working';
}
export function applyOrderCommand(world:World,command:OrderCommand):CommandResult {
  const pawn=world.pawns.find(p=>p.id===command.pawnId);
  if(!pawn)return fail('Colon introuvable.');
  if(command.type==='clear-orders') {
    if(isForcedConsuming(pawn)){interruptDraftWork(world,pawn);return {ok:true};}
    const active=pawn.orders.active!==null||!!pawn.shipCasketTask277||!!pawn.cryptosleepTask||!!pawn.openCasket||!!pawn.firefoamTask290||!!pawn.orbitalTrade||!!factionCommsTask298(pawn)||!!pawn.allowedAreaReturn||(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))&&pawn.recreation.task?.activity==='read'&&pawn.recreation.task.manual===true;
    const drops=active?planCommandDrops(world,command):new Map();
    if(!drops)return fail('Pas de place pour déposer la cargaison.');
    if(active&&!releaseWork(world,pawn,drops))return fail('Impossible d’interrompre ce travail.');
    clearQueuedOrders(world,pawn);delete pawn.priorityWork;return {ok:true};
  }
  if(command.type==='order-haul'||command.type==='order-cook') {
    if(typeof command.queue!=='boolean'||(command.type==='order-cook'?!Number.isSafeInteger(command.structureId):!command.target||!['pile','furniture','job','clear','clear-sow','fuel','turret'].includes(command.target.type)
      ||!Number.isSafeInteger(command.target.type==='pile'?command.target.pileId:command.target.type==='turret'||command.target.type==='fuel'||command.target.type==='furniture'?command.target.structureId:command.target.jobId)))return fail('Ordre de transport invalide.');
    const reason=exhausted(world,pawn);if(reason)return fail(reason);
    if(command.queue&&pawn.orders.queue.length>=MAX_QUEUED_ORDERS)return fail(`File limitée à ${MAX_QUEUED_ORDERS} travaux.`);
    let view=orderView(world,pawn,command.queue);
    const drops=command.queue?new Map():planCommandDrops(view,command);if(!drops)return fail('Pas de place pour déposer la cargaison.');
    if(drops.size)view={...view,packed:view.packed.map(p=>drops.has(p.building.id)?{...p,owner:{type:'ground',...drops.get(p.building.id)!}}:p),piles:view.piles.map(p=>drops.has(p.id)?{...p,owner:{type:'ground',...drops.get(p.id)!}}:p)};
    const actor=view.pawns.find(p=>p.id===pawn.id)!;
    const proposal=command.type==='order-cook'?planCookingOrder(view,actor,command.structureId):(()=>{const p=planHaulOrder(view,actor,command.target);return {...p,order:p.task};})();
    if(!proposal.order||!proposal.path)return fail(proposal.reason??'Transport impossible.');
    if(command.queue&&(busy(pawn)||pawn.orders.queue.length))pawn.orders.queue.push(proposal.order);
    else {
      if(!releaseWork(world,pawn,drops))return fail('Impossible d’interrompre ce travail.');
      clearQueuedOrders(world,pawn);if(isCookingOrder(proposal.order))startCookingOrder(pawn,proposal.order,proposal.path);else startHaulOrder(pawn,proposal.order,proposal.path);
    }
    rememberPriorityWork(world,pawn,command,proposal.order);
    if(pawn.draft&&command.type==='order-haul'&&command.target.type==='turret'){
      cancelShooting(pawn);cancelMelee(pawn);pawn.draft.target=null;pawn.draft.queue=[];pawn.draft.lastActiveTick=world.tick;
    }
    world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : ${proposal.label}${command.queue?' (file)':''}.`});
    if(world.events.length>80)world.events.shift();return {ok:true};
  }
  if(typeof command.queue!=='boolean'||!Number.isSafeInteger(command.jobId))return fail('Ordre invalide.');
  const job=world.jobs.find(j=>j.id===command.jobId);if(!job)return fail('Ce travail n’existe plus.');
  const reason=preflight(world,pawn,job,command.queue);if(reason)return fail(reason);
  if(command.queue&&pawn.orders.queue.length>=MAX_QUEUED_ORDERS)return fail(`File limitée à ${MAX_QUEUED_ORDERS} travaux.`);
  const path=route(world,pawn,job);if(path===null)return fail('Aucun accès praticable à ce travail.');
  const plant=clearingPlant(world,job),label=orderLabel(world,job);
  if(command.queue&&(busy(pawn)||pawn.orders.queue.length>0)) {
    // Queue reservations are exclusive from acceptance, as in the reference.
    if(job.kind==='install')job.installationWork=asBuilder(pawn)?'build':'haul';
    job.reservedBy=pawn.id;job.status='active';pawn.orders.queue.push(job.id);
    if(plant)job.clearance={resourceId:plant.id,progress:0};
  } else {
    const drops=planCommandDrops(world,command);if(!drops)return fail('Pas de place pour déposer la cargaison.');
    if(!releaseWork(world,pawn,drops))return fail('Impossible d’interrompre ce travail.');
    clearQueuedOrders(world,pawn);startJobOrder(pawn,job,path);
    if(plant)job.clearance={resourceId:plant.id,progress:0};
  }
  rememberPriorityWork(world,pawn,command);
  world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : ${label}${command.queue?' (file)':''}.`});
  if(world.events.length>80)world.events.shift();
  return {ok:true};
}
/** Reconcile cancellations before a save can observe
 * dangling reservations. No navigation and no scan when nobody has orders. */
export function reconcileOrders(world:World):void {
  let jobs:Map<number,Job>|undefined;
  for(const pawn of world.pawns) {
    expirePriorityWork(world,pawn);
    const orders=pawn.orders;if(orders.active===null&&!orders.queue.length)continue;
    if(orders.active==='bury'?!pawn.burial:orders.active==='equipment'?!pawn.equipmentTask:orders.active==='haul'?!pawn.haul:orders.active==='cook'?!pawn.cooking:orders.active==='feed'?!pawn.feed:orders.active==='tend'?!pawn.tend:orders.active==='rescue'?!pawn.rescue:orders.active==='consume'?!isForcedConsuming(pawn):orders.active!==pawn.jobId)orders.active=null;
    if(!orders.queue.length)continue;
    jobs??=new Map(world.jobs.map(j=>[j.id,j]));
    orders.queue=orders.queue.filter(id=>{
      if(typeof id!=='number') {
        const station=isCookingOrder(id)?structureById(world,id.cooking.stationId):undefined;
        const work=isCookingOrder(id)?station?taskWork(id.cooking):undefined:haulingWork(id.destination);
        const reason=(work?backgroundWorkRefusal(pawn,work):undefined)??(isCookingOrder(id)?queuedCookingReason(world,id,pawn):queuedHaulReason(world,id,pawn));
        if(reason){world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : livraison abandonnée. ${reason}`});if(world.events.length>80)world.events.shift();}
        return !reason;
      }
      const job=jobs!.get(id);
      if(job&&job.reservedBy===pawn.id&&!backgroundWorkRefusal(pawn,workType(job))&&!allowedAreaReason(world,pawn,job))return true;
      if(job?.reservedBy===pawn.id){delete job.installationWork;job.reservedBy=null;job.status='pending';}
      return false;
    });
  }
}
/** Returns true if a queued decision has to wait for the shared search budget. */
export function advanceOrders(world:World,pawn:Pawn,getBlocked:NavigationGrid,budget:SearchBudget):boolean {
  if(busy(pawn)||!pawn.orders.queue.length)return false;
  const order=pawn.orders.queue[0]!;
  if(isCookingOrder(order))return advanceCookingOrder(world,pawn,order,getBlocked,budget);
  if(typeof order!=='number') {
    let reason=backgroundWorkRefusal(pawn,haulingWork(order.destination))??queuedHaulReason(world,order,pawn);const source=haulOrderCell(world,order),target=destinationCell(world,order.destination);
    let path:Cell[]|null=null;
    if(!reason&&source&&target) {
      const targetGoals=interactionGoals(world,'kind' in target?footprintCells(target as Job):[target]);
      if(order.destination.type==='job')for(const cell of footprintCells(target as Job))targetGoals.delete(cellIndex(world,cell.x,cell.z));
      const reach=search(world,pawn,getBlocked(),new Set(),budget,undefined,[interactionGoals(world,[source]),targetGoals]);if(!reach)return true;
      path=routeToJob(world,source,reach,true);
      if(!path||!canReach(world,target,reach,order.destination.type!=='job'))reason='Accès perdu.';
    }
    pawn.orders.queue.shift();
    if(!reason&&path)startHaulOrder(pawn,order,path);
    else {
      world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : livraison abandonnée. ${reason??'Cible disparue.'}`});
      if(world.events.length>80)world.events.shift();return true;
    }
    return false;
  }
  const id=pawn.orders.queue[0]!,job=world.jobs.find(j=>j.id===id);
  let reason=job?orderReadiness(world,pawn,job,true):'Travail annulé.';
  let path:Cell[]|null=null;
  if(!reason&&job) {
    const reach=search(world,pawn,getBlocked(),new Set(),budget,goals(world,job));
    if(!reach)return true;
    path=routeToJob(world,clearingPlant(world,job)??furnitureWorkTarget(world,job),reach,false);if(path===null)reason='Accès perdu.';
  }
  pawn.orders.queue.shift();
  if(!reason&&job&&path)startJobOrder(pawn,job,path);
  else {
    if(job?.reservedBy===pawn.id){delete job.clearance;delete job.installationWork;job.reservedBy=null;job.status='pending';}
    world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : ordre abandonné. ${reason}`});
    if(world.events.length>80)world.events.shift();
    return true; // Process at most one queue entry per pawn/tick.
  }
  return false;
}
import { medicalWorkRefusal } from './health-rules.ts';
import { structureById } from './structure-navigation.ts';
