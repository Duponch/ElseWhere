import { workPriority } from './work-types.ts';
import { allowedAreaAllows,allowedAreaReason,captureAllowedArea } from './allowed-area-state.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { planFurnitureHaulOrder } from './player-furniture-hauling.ts';
import { candidateAccess } from './candidate-access.ts';
import { asBuilder, constructionHaulPriority, constructionObstruction, isConstruction } from './construction-rules.ts';
import { growingJobValid } from './farming.ts';
import { CARRY_CAPACITY } from './definitions.ts';
import {carryStackLimit379} from './carry-quantity-379.ts';
import { refuelable, fuelCapacity, fuelStationReserved, fuelItem } from './fuel.ts';
import { planTurretReload } from './mini-turret-reload.ts';
import { findAsideDestination } from './haul-aside.ts';
import { reservedSource } from './materials.ts';
import { blockedCells, routeToJob } from './pathfinding.ts';
import { canReach } from './work-planner.ts';
import type { HaulProposal } from './player-hauling.ts';
import type { Cell, HaulDestination, Pawn, World } from './types.ts';

export type ServiceHaulTarget={type:'turret';structureId:number}|{type:'fuel';structureId:number}|{type:'clear';jobId:number}|{type:'clear-sow';jobId:number};
/** Contextual sub-jobs reuse the ordinary physical transport executor. */
export function planServiceHaul(world:World,pawn:Pawn,target:ServiceHaulTarget,access?:import('./pathfinding.ts').Reachability,budget={pairs:32768}):HaulProposal {
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  if(target.type==='turret')return planTurretReload(world,pawn,target.structureId,access,budget);
  const fire=target.type==='fuel'?refuelable(world,target.structureId):undefined;
  const input=fire?fuelItem(fire.kind):'wood',inputLabel=input==='chemfuel'?'biocarburant':'bois';
  const label=target.type==='fuel'?`Ravitailler en ${inputLabel}`:target.type==='clear-sow'?'Dégager avant de semer':'Dégager le chantier';
  const no=(reason:string):HaulProposal=>({label,reason});
  const work=target.type==='fuel'?'haul':target.type==='clear-sow'?'grow':asBuilder(pawn)?'build':'haul';
  const refusal=backgroundWorkRefusal(pawn,work);if(refusal)return no(refusal);
  if(target.type==='fuel'?!workPriority(pawn,'haul'):target.type==='clear-sow'?!workPriority(pawn,'grow'):!Number.isFinite(constructionHaulPriority(pawn)))return no('Ce travail est désactivé dans le tableau Travail.');
  const job=target.type!=='fuel'?world.jobs.find(j=>j.id===target.jobId):undefined;
  if(target.type==='clear'&&(!job||!isConstruction(job)))return no('Chantier introuvable.');
  if(target.type==='clear-sow'&&(!job||job.kind!=='sow'||!growingJobValid(world,job)))return no('Le semis n’est plus autorisé sur cette cellule.');
  if(job?.reservedBy!==undefined&&job.reservedBy!==null)return no('Chantier déjà réservé.');
  const obstacle=job?constructionObstruction(world,job):undefined;
  if(obstacle?.plant)return no('La plante doit être coupée avant le transport.');
  if(job&&obstacle?.pack)return planFurnitureHaulOrder(world,pawn,obstacle.pack.building.id,access,budget,job);
  if(job&&!obstacle?.pile)return no('Aucune pile à dégager.');
  if(target.type==='fuel'&&!fire?.fuel)return no('Bâtiment introuvable.');
  const areaReason=fire?allowedAreaReason(world,pawn,fire):job?allowedAreaReason(world,pawn,job):undefined;if(areaReason)return no(areaReason);
  if(fire&&fuelStationReserved(world,fire.id))return no('Bâtiment déjà réservé.');
  const capacity=fire?fuelCapacity(world,fire.id,undefined,true):Number(world.schemaVersion)>=379?Number.MAX_SAFE_INTEGER:CARRY_CAPACITY;
  if(!capacity)return no(`Le réservoir ne peut pas encore recevoir une unité entière de ${inputLabel}.`);
  const blocked=blockedCells(world),reach=access??candidateAccess(world,pawn,blocked,new Set());
  if(fire&&!canReach(world,fire,reach,true))return no('Aucun accès praticable au bâtiment.');
  const sources=obstacle?.pile?[obstacle.pile]:world.piles.filter(p=>p.item===input&&p.owner.type==='ground'&&allows(p.owner));
  let best:{source:Cell;id:number;quantity:number;distance:number;destination:HaulDestination}|undefined;
  for(const pile of sources) {
    if(budget.pairs--<=0){budget.pairs=0;return no('Décision reportée : budget de recherche atteint.');}
    if(pile.owner.type!=='ground'||!allows(pile.owner))continue;
    const reserved=reservedSource(world,pile.id);
    // Clearing owns the obstructing pile, including trips smaller than a stack.
    if(job&&reserved>0)continue;
    const quantity=Math.min(carryStackLimit379(world,pawn,pile.item),capacity,pile.quantity-reserved);if(quantity<=0)continue;
    if(!canReach(world,pile.owner,reach,true))continue;
    const aside=job?findAsideDestination(world,pile.owner,pile,quantity,blocked,budget,pawn):null;
    if(job&&!aside)return no('Aucune cellule proche accessible pour déposer la pile.');
    const destination:HaulDestination=fire?{type:'fuel',structureId:fire.id,forced:true}:target.type==='clear-sow'?{...aside!,growingZoneId:job!.growingZoneId,sowCell:{x:job!.x,z:job!.z}}:{...aside!,constructionId:job!.id,forConstruction:asBuilder(pawn)};
    const distance=Math.abs(pawn.x-pile.owner.x)+Math.abs(pawn.z-pile.owner.z);
    if(!best||distance<best.distance||distance===best.distance&&pile.id<best.id)best={source:pile.owner,id:pile.id,quantity,distance,destination};
  }
  if(!best)return no(job?'La pile est déjà réservée ou inaccessible.':`Aucun ${inputLabel} disponible et accessible.`);
  const path=routeToJob(world,best.source,reach,true);if(!path)return no('Aucun accès praticable à la pile.');
  return {label:`${label} (${best.quantity} unités)`,path,task:{sourcePileId:best.id,quantity:best.quantity,phase:'pickup',carryPileId:null,destination:best.destination}};
}
