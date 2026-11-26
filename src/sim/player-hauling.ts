import {pileById} from './pile-identity-directory.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import { storageCells,storageCellAccepts } from './shelf-storage.ts';
import { workPriority } from './work-types.ts';
import { allowedAreaAllows,allowedAreaReason,captureAllowedArea } from './allowed-area-state.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { planFurnitureHaulOrder } from './player-furniture-hauling.ts';
import { furnitureHaulValid } from './furniture-haul-rules.ts';
import { validSowingClearance } from './sowing-clearance.ts';
import { planServiceHaul, type ServiceHaulTarget } from './player-service-hauling.ts';
import { candidateAccess } from './candidate-access.ts';
import { asBuilder, constructionHaulPriority, constructionSiteFree, isConstruction } from './construction-rules.ts';
import { carryStackLimit379 } from './carry-quantity-379.ts';
import {constructionJobAllowed379} from './construction-state-379.ts';
import {constructionSupplyRefusal379} from './construction-supply-379.ts';
import {planConstructionBatch379,queuedConstructionBatchReason379} from './construction-batch-379.ts';
import { storageCapacity,createGroundCapacityReader } from './ground-placement.ts';
import { withoutQueuedOrder } from './haul-reservations.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { constructionCapacity, constructionRecipe, requiredMaterial } from './construction-materials.ts';
import { deliveredStock, reservedDestination, reservedSource } from './materials.ts';
import { blockedCells, routeToJob } from './pathfinding.ts';
import { canReach, destinationCapacity, destinationCell } from './work-planner.ts';
import type { Cell, HaulTask, Pawn, World } from './types.ts';

export type HaulOrderTarget={type:'furniture';structureId:number}|{type:'pile';pileId:number}|{type:'job';jobId:number}|ServiceHaulTarget;
export interface HaulProposal { task?:HaulTask; path?:Cell[]; label:string; reason?:string }
const distance=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;

/** One read-only decision with one shared, resumable access search. No global
 * logistics cursor or per-frame query. A delivery is one trip, not a build chain. */
export function planHaulOrder(world:World,pawn:Pawn,target:HaulOrderTarget,access?:import('./pathfinding.ts').Reachability,budget={pairs:32768}):HaulProposal {
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  if(target.type==='furniture')return planFurnitureHaulOrder(world,pawn,target.structureId,access,budget);
  if(target.type==='turret'||target.type==='fuel'||target.type==='clear'||target.type==='clear-sow')return planServiceHaul(world,pawn,target,access,budget);
  const label=target.type==='pile'?'Transporter vers le stockage':'Livrer les matériaux';
  const no=(reason:string):HaulProposal=>({label,reason});
  const work=target.type==='pile'?'haul':asBuilder(pawn)?'build':'haul';
  const refusal=backgroundWorkRefusal(pawn,work);if(refusal)return no(refusal);
  if(target.type!=='pile'&&target.type!=='job')return no('Cible de transport invalide.');
  if(target.type==='pile'?!workPriority(pawn,'haul'):!Number.isFinite(constructionHaulPriority(pawn)))return no('Ce travail est désactivé dans le tableau Travail.');
  const source=target.type==='pile'?pileById(world,target.pileId):undefined;
  const job=target.type==='job'?world.jobs.find(j=>j.id===target.jobId):undefined;
  if(target.type==='pile'&&source&&!eggAllowedForPlayer256(source))return no('Ce bien est interdit.');
  if(target.type==='pile'&&source?.owner.type!=='ground')return no('La pile n’est plus au sol.');
  if(target.type==='job'&&(!job||!isConstruction(job)))return no('Chantier introuvable.');
  if(job&&!constructionJobAllowed379(job))return no('Ce chantier est interdit. Autorisez-le avant de livrer les matériaux.');
  const areaReason=job?allowedAreaReason(world,pawn,job):source?.owner.type==='ground'?allowedAreaReason(world,pawn,source.owner):undefined;if(areaReason)return no(areaReason);
  if(job&&!constructionSiteFree(world,job,pawn.id))return no('Le chantier doit être dégagé avant la livraison.');
  if(job&&!constructionRecipe(job).ingredients.some(c=>constructionCapacity(world,job,c.item)>0))return no(Number(world.schemaVersion)>=379?constructionSupplyRefusal379(world,pawn,job):'Les matériaux sont déjà livrés ou réservés.');
  const reach=access??candidateAccess(world,pawn,blockedCells(world),new Set());
  if(job&&!canReach(world,job,reach,false))return no('Aucun accès praticable au chantier.');
  const cells=storageCells(world),byCell=new Map(cells.map(c=>[c.z*world.width+c.x,c]));
  const placementFacts=world.structures.some(s=>s.shelf)?createGroundCapacityReader(world):undefined;
  const sources=source?[source]:world.piles.filter(p=>p.owner.type==='ground'&&allows(p.owner)&&job&&requiredMaterial(job,p.item)>0);
  let best:{task:HaulTask;source:Cell;rank:number;distance:number;id:number}|undefined;
  for(const pile of sources) {
    if(budget.pairs--<=0){budget.pairs=0;return no('Décision reportée : budget de recherche atteint.');}
    if(!eggAllowedForPlayer256(pile)||pile.owner.type!=='ground'||!allows(pile.owner))continue;
    let available=pile.quantity-reservedSource(world,pile.id);if(available<=0)continue;
    if(!canReach(world,pile.owner,reach,true))continue;
    const sourceZone=byCell.get(pile.owner.z*world.width+pile.owner.x);
    const excess=sourceZone?.shelfId===undefined&&sourceZone?Math.max(0,pile.quantity-sourceZone.capacity):0;
    const sourceAdmits=sourceZone&&storageCellAccepts(world,sourceZone,pile);
    const currentPriority=sourceAdmits&&!excess?sourceZone!.priority:0;
    if(!job&&sourceAdmits&&excess)available=Math.min(available,Math.max(0,excess-reservedSource(world,pile.id)));
    const destinations=job?[{destination:{type:'job' as const,jobId:job.id,forConstruction:asBuilder(pawn)},cell:job,rank:0,
      capacity:constructionCapacity(world,job,pile.item)}]
      :cells.filter(z=>allows(z)&&z.priority>currentPriority&&!same(z,pile.owner as Cell))
        .map(z=>({destination:{type:'stockpile' as const,stockpileId:z.id},cell:z,rank:-z.priority,capacity:storageCapacity(world,z,pile,undefined,undefined,placementFacts)}));
    for(const dest of destinations) {
      if(budget.pairs--<=0){budget.pairs=0;return no('Décision reportée : budget de recherche atteint.');}
      const quantity=Math.min(carryStackLimit379(world,pawn,pile.item),available,dest.capacity);if(quantity<=0||!canReach(world,dest.cell,reach,!job))continue;
      const cost=distance(pawn,pile.owner)+distance(pile.owner,dest.cell),id=job?pile.id:dest.cell.id;
      if(!best||dest.rank<best.rank||dest.rank===best.rank&&(cost<best.distance||cost===best.distance&&id<best.id))
        best={task:{sourcePileId:pile.id,quantity,phase:'pickup',destination:dest.destination,carryPileId:null},source:pile.owner,rank:dest.rank,distance:cost,id};
    }
  }
  if(!best)return no(job?Number(world.schemaVersion)>=379?constructionSupplyRefusal379(world,pawn,job,reach):'Aucun matériau requis disponible et accessible.':'Aucune réserve accessible de meilleure priorité avec une place compatible, ou pile déjà réservée.');
  const path=routeToJob(world,best.source,reach,true);if(!path)return no('Aucun accès praticable à la pile.');
  const item=pileById(world,best.task.sourcePileId)!,task=job?planConstructionBatch379(world,pawn,best.task,reach):best.task;
  return {task,path,label:`${label} (${task.quantity} ${ITEM_DEFINITIONS[item.item].label})`};
}

/** Own waiting reservation is excluded exactly once, never the rest of its queue. */
export function queuedHaulReason(world:World,task:HaulTask,pawn?:Pawn):string|undefined {
  if(task.constructionBatch379){
    if(!pawn)return 'Le propriétaire de cette livraison groupée est introuvable.';
    return queuedConstructionBatchReason379(world,task,pawn);
  }
  if(pawn){const source=haulOrderCell(world,task),target=destinationCell(world,task.destination),reason=(source?allowedAreaReason(world,pawn,source):undefined)??(target?allowedAreaReason(world,pawn,target):undefined);if(reason)return reason;}
  if(task.whole)return furnitureHaulValid(withoutQueuedOrder(world,task),task)?undefined:'Le meuble ou son emplacement réservé n’est plus disponible.';
  const view=withoutQueuedOrder(world,task),pile=pileById(world,task.sourcePileId);
  if(!pile||!eggAllowedForPlayer256(pile)||pile.owner.type!=='ground'||pile.quantity-reservedSource(view,pile.id)<task.quantity)return 'La pile ou sa quantité réservée n’est plus disponible.';
  if(destinationCapacity(view,task.destination,pile.kind,undefined,pile)<task.quantity)return 'La destination n’accepte plus la quantité réservée.';
  const destination=task.destination;
  if(!validSowingClearance(world,destination))return 'Culture supprimée ou semis désactivés.';
  if(destination.type==='aside'&&destination.constructionId!==undefined&&!world.jobs.some(j=>j.id===destination.constructionId&&isConstruction(j)))return 'Chantier annulé.';
  const target=destinationCell(world,task.destination);
  if(!target||destination.type!=='fuel'&&destination.type!=='turret'&&same(target,pile.owner))return 'La destination a disparu ou coïncide avec la source.';
}

export function haulOrderCell(world:World,task:HaulTask):Cell|undefined {
  if(task.whole){const pack=world.packed.find(p=>p.building.id===task.sourcePileId);return pack?.owner.type==='ground'?pack.owner:undefined;}
  const pile=pileById(world,task.sourcePileId);
  return pile?.owner.type==='ground'?pile.owner:undefined;
}
export function startHaulOrder(pawn:Pawn,task:HaulTask,path:Cell[]):void {
  pawn.haul=task;pawn.orders.active='haul';pawn.path=path;pawn.planCooldown=0;
  pawn.state=path.length||pawn.moveCooldown>0?'moving':'working';
}
