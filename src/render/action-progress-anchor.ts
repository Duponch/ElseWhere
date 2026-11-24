import {footprintCells} from '../sim/definitions';
import type {Cell,Job,MaterialPile,Pawn,Resource,Structure,World} from '../sim/types';
import type {ActionLookup,ActionProgress} from './action-feedback';

/** Snapshot-only indices, shared by all visible bars. Nothing is cached on World. */
export interface ActionAnchorLookup extends ActionLookup {
  structures?:ReadonlyMap<number,Structure>;
  piles?:ReadonlyMap<number,MaterialPile>;
  pawns?:ReadonlyMap<number,Pawn>;
  animals?:ReadonlyMap<number,NonNullable<World['wildlife']>['animals'][number]>;
  filth?:ReadonlyMap<number,NonNullable<World['filth']>['items'][number]>;
}
export interface ActionProgressAnchor {
  /** An absent/unspawned target follows the actor, as ToilEffects does. */
  target?:Cell;
  /** A human target uses the same rendered bed/body origin as PawnLayer. */
  pawnId?:number;
  actorWeight:0|.5|1;
  offsetZ:number;
}
const actor=():ActionProgressAnchor=>({actorWeight:1,offsetZ:-.5});
const target=(cell:Cell|undefined,midpoint=false,quality=false):ActionProgressAnchor=>cell
  ?{target:{x:cell.x,z:cell.z},actorWeight:midpoint ? .5 : 0,offsetZ:quality?-.25:-.5}:actor();
const byId=<T extends {id:number}>(items:readonly T[]):ReadonlyMap<number,T>=>new Map(items.map(item=>[item.id,item]));
function center(structure:Structure):Cell {
  const cells=footprintCells(structure);
  return {x:cells.reduce((sum,cell)=>sum+cell.x,0)/cells.length,z:cells.reduce((sum,cell)=>sum+cell.z,0)/cells.length};
}

/** Core 1.6.4871 ToilEffects.WithProgressBar: a spawned target, or the actor
 * when the target is carried/equipped/absent. Plant and cleaning drivers use
 * MoteDualAttached's midpoint. MoteProgressBar applies -0.5 on map Z (+0.25
 * for a quality-bearing target). Existing counters/visibility stay authoritative. */
export function actionProgressAnchor(world:World,pawn:Pawn,progress:ActionProgress,lookup:ActionAnchorLookup={}):ActionProgressAnchor {
  const structure=(id:number|undefined)=>id===undefined?undefined:(lookup.structures??=byId(world.structures)).get(id);
  const pile=(id:number|null|undefined)=>id==null?undefined:(lookup.piles??=byId(world.piles)).get(id);
  const resource=(id:number):Resource|undefined=>(lookup.resources??=byId(world.resources)).get(id);
  const building=(id:number|undefined)=>{const found=structure(id);return found?target(center(found),false,found.quality!==undefined):actor();};
  const groundPile=(id:number|null|undefined)=>{const found=pile(id);return target(found?.owner.type==='ground'?found.owner:undefined,false,!!(found?.apparel||found?.weapon));};
  const human=(id:number)=>{
    const found=(lookup.pawns??=byId(world.pawns)).get(id);
    return found&&found.id!==pawn.id&&found.body?.lostAt===undefined&&found.body?.pileId===undefined
      ?{...target(found),pawnId:found.id}:actor();
  };
  const animal=(id:number)=>target((lookup.animals??=byId(world.wildlife?.animals??[])).get(id));
  switch(progress.kind){
    case 'research':return building(pawn.research?.stationId);
    case 'production':return building(pawn.cooking?.stationId);
    case 'surgery':return pawn.surgery?human(pawn.surgery.patientId):actor();
    case 'tending':return pawn.tend?human(pawn.tend.patientId):pawn.animalCare?animal(pawn.animalCare.animalId):actor();
    // ChewIngestible targets the food, including FoodFeedPatient. Carried food
    // is not Spawned, so its bar belongs to the actor, not to the recipient.
    case 'ingestion':return pawn.need?.kind==='eat'?groundPile(pawn.need.carryPileId):actor();
    case 'feeding':return groundPile(pawn.feed?.carryPileId??pawn.animalFeed?.carryPileId);
    case 'equipment':return groundPile(pawn.equipmentTask?.itemId);
    case 'service':return pawn.haul?.destination.type==='fuel'||pawn.haul?.destination.type==='turret'?building(pawn.haul.destination.structureId):actor();
    case 'burial':return building(pawn.burial?.graveId);
    case 'handling':return pawn.animalHandling?animal(pawn.animalHandling.animalId):actor();
    case 'hunting':{
      const id=pawn.hunting?.animalId;if(id===undefined)return actor();
      const body=pile(id);return body?groundPile(id):animal(id);
    }
    case 'cleaning':{
      const task=pawn.cleaning;if(!task)return actor();
      if(task.snowCell!==undefined)return target({x:task.snowCell%world.width,z:Math.floor(task.snowCell/world.width)},true);
      return target((lookup.filth??=byId(world.filth?.items??[])).get(task.targets[0]!),true);
    }
    case 'clearing':case 'job':{
      const job:Job|undefined=pawn.jobId===null?undefined:(lookup.jobs??=byId(world.jobs)).get(pawn.jobId);
      if(!job||job.status!=='active'||job.reservedBy!==pawn.id)return actor();
      if(job.clearance)return target(resource(job.clearance.resourceId),true);
      if(job.tree?.kind==='extract')return target(resource(job.tree.resourceId));
      // Replant inherits HaulToContainer: its prepare delay targets the
      // destination blueprint (B), not the tree carried as target A.
      if(job.tree?.kind==='replant')return target(job);
      if(job.kind==='chop'||job.kind==='cut'||job.kind==='harvest'||job.kind==='sow')return target(job,true);
      if(job.deconstruction)return building(job.deconstruction.structureId);
      if(job.furniture)return building(job.furniture.structureId);
      return target(job);
    }
    default:return actor();
  }
}
