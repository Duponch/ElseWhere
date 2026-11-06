import {isPlayerCasket271,cryptosleepInteraction271} from './cryptosleep-state-271.ts';
import {isAncientCasket256,ancientCasketInteraction256} from './ancient-casket-state-256.ts';
import { storageCellById } from './shelf-storage.ts';
import type { Cell, Pawn, World } from './types.ts';
import { structureById } from './structure-navigation.ts';
export type { AllowedArea, AllowedAreaReturn } from './types.ts';

export const ALLOWED_AREA_LIMIT=10;
export const OUTSIDE_ALLOWED_AREA_SEARCH_COST=20000;
export interface AllowedAreaPolicy { readonly areaId:number; has(index:number):boolean }
const memberships=new WeakMap<number[],{width:number;height:number;policy:AllowedAreaPolicy}>();

/** Assignment survives mobilisation and off-map ownership. Only its effect is temporary. */
export function allowedAreaEffective(world:World,pawn:Pawn):boolean {
  if((pawn.faction??'colony')!=='colony'||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||pawn.draft||pawn.mental?.crisis||!world.pawns.some(p=>p.id===pawn.id))return false;
  const group=world.group;
  if(group&&(group.phase==='gathering'||group.phase==='loading'||group.phase==='leaving')&&group.memberIds.includes(pawn.id))return false;
  const scout=world.scout,trip=world.commercialTrip;
  return !(scout&&(scout.phase==='loading'||scout.phase==='leaving')&&scout.pawnId===pawn.id)
    &&!(trip&&(trip.phase==='loading'||trip.phase==='leaving')&&trip.pawnId===pawn.id);
}
export function captureAllowedArea(world:World,pawn:Pawn):AllowedAreaPolicy|undefined {
  if(pawn.allowedAreaId===undefined)return;
  const area=world.allowedAreas?.find(a=>a.id===pawn.allowedAreaId);if(!area?.cells.length)return;
  if(!allowedAreaEffective(world,pawn))return;
  const cached=memberships.get(area.cells);
  if(cached&&cached.width===world.width&&cached.height===world.height&&cached.policy.areaId===area.id)return cached.policy;
  const bits=new Uint8Array(world.width*world.height);for(const index of area.cells)bits[index]=1;
  const policy:AllowedAreaPolicy={areaId:area.id,has:index=>Number.isInteger(index)&&index>=0&&index<bits.length&&bits[index]===1};
  memberships.set(area.cells,{width:world.width,height:world.height,policy});return policy;
}
export function allowedAreaAllows(world:World,pawn:Pawn,cell:Cell,policy?:AllowedAreaPolicy):boolean {
  const effective=policy??captureAllowedArea(world,pawn);return !effective||Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height&&effective.has(cell.z*world.width+cell.x);
}
export function allowedAreaReason(world:World,pawn:Pawn,cell:Cell):string|undefined {
  if(!allowedAreaAllows(world,pawn,cell))return `Hors zone autorisée « ${world.allowedAreas?.find(a=>a.id===pawn.allowedAreaId)?.label??''} ».`;
}
/** Remove only the future steps owned by this intent. An engaged edge stays physical. */
export function releaseAllowedAreaReturn(pawn:Pawn):void {
  if(!pawn.allowedAreaReturn)return;delete pawn.allowedAreaReturn;
  if(!allowedAreaOtherActivity(pawn)){pawn.path=[];pawn.planCooldown=0;if(pawn.state==='moving')pawn.state='idle';}
}
export function allowedAreaOtherActivity(pawn:Pawn):boolean {
  return pawn.jobId!==null||!!(pawn.haul||pawn.cooking||pawn.need||pawn.recreation.task||pawn.rescue||pawn.tend||pawn.surgery||pawn.feed||pawn.ward||pawn.research||pawn.hunting||pawn.animalHandling||pawn.animalCare||pawn.animalFeed||pawn.animalRescue||pawn.cryptosleepTask||pawn.openCasket||pawn.burial||pawn.cleaning||pawn.firefighting||pawn.deepWork||pawn.orbitalTrade||pawn.trade||pawn.equipmentTask||pawn.equipmentDropPending||pawn.interruptedCargo||pawn.transitExit||pawn.social?.fight||pawn.flee||pawn.bombRefuge||pawn.heatRefuge||pawn.burning||pawn.priorityWork||pawn.shooting?.order||pawn.shooting?.stance||pawn.melee?.order||pawn.melee?.strike||pawn.tactics?.targetId!==undefined&&pawn.tactics.targetId!==null||pawn.tactics?.post||pawn.orders.active!==null||pawn.orders.queue.length);
}
/** Cell callers retain baseline navigation; full actors capture their current policy. */
export function navigationAllowedArea(world:World,start:Cell):AllowedAreaPolicy|undefined {
  if(!('id' in start))return;
  const pawn=world.pawns.find(p=>p.id===(start as Pawn).id);return pawn?captureAllowedArea(world,start as Pawn):undefined;
}

/** Runtime admission only: no flood, capabilities, recipes or serialized metadata guards. */
export function allowedAreaWorkAllowed(world:World,pawn:Pawn):boolean {
  const policy=captureAllowedArea(world,pawn);if(!policy)return true;
  const allows=(cell:Cell|undefined|null)=>!cell||allowedAreaAllows(world,pawn,cell,policy);
  const ground=(id:number|null|undefined)=>{const pile=world.piles.find(p=>p.id===id);return pile?.owner.type!=='ground'||allows(pile.owner);};
  if(pawn.cryptosleepTask){const c=structureById(world,pawn.cryptosleepTask!.casketId);if(!c||!isPlayerCasket271(c)||!allows(cryptosleepInteraction271(c)))return false;}
  if(pawn.openCasket){const c=structureById(world,pawn.openCasket!.casketId);if(!c||!isAncientCasket256(c)||!allows(ancientCasketInteraction256(c)))return false;}
  if(pawn.priorityWork&&!allows(pawn.priorityWork.cell))return false;
  if(pawn.jobId!==null){const job=world.jobs.find(j=>j.id===pawn.jobId);if(!allows(job))return false;
    if(job?.clearance&&!allows(world.resources.find(r=>r.id===job.clearance!.resourceId)))return false;
    if(job?.furniture){const pack=world.packed.find(p=>p.building.id===job.furniture!.structureId);if(pack?.owner.type==='ground'&&!allows(pack.owner))return false;}}
  if(pawn.haul){const h=pawn.haul,d=h.destination;
    const target=d.type==='aside'?d:d.type==='job'?world.jobs.find(j=>j.id===d.jobId):d.type==='stockpile'?storageCellById(world,d.stockpileId):structureById(world,d.structureId);
    if(!allows(target))return false;
    if(h.phase==='pickup'){
      if(h.whole){const pack=world.packed.find(p=>p.building.id===h.sourcePileId);if(pack?.owner.type==='ground'&&!allows(pack.owner))return false;}
      else if(!ground(h.sourcePileId))return false;
    }
  }
  if(pawn.cooking){const c=pawn.cooking;
    if(!allows(structureById(world,c.stationId)))return false;
    if(c.phase!=='output')for(const i of c.ingredients)if(!allows(i.cell)||i.stage!=='held'&&!ground(i.pileId))return false;
    // Output can reselect an admissible depot. Its old destination is not an ingredient.
  }
  if(pawn.cleaning?.snowCell!==undefined&&!allows({x:pawn.cleaning.snowCell%world.width,z:Math.floor(pawn.cleaning.snowCell/world.width)}))return false;
  if(pawn.cleaning?.targets.some(id=>!allows(world.filth?.items.find(f=>f.id===id))))return false;
  if(pawn.firefighting){const f=world.fires?.items.find(f=>f.id===pawn.firefighting!.fireId);if(f){const cell=f.attachedPawnId!==undefined?world.pawns.find(p=>p.id===f.attachedPawnId):f.attachedAnimalId!==undefined?world.wildlife?.animals.find(a=>a.id===f.attachedAnimalId):f;if(!allows(cell))return false;}}
  if(pawn.burial){const b=pawn.burial;if(!allows(structureById(world,b.graveId)))return false;
    if(b.phase==='pickup'){const body=world.pawns.find(p=>p.id===b.bodyPawnId);if(body?.body?.pileId!==undefined){if(!ground(body.body.pileId))return false;}else if(!allows(body))return false;}}
  if(pawn.deepWork&&!allows(structureById(world,pawn.deepWork!.structureId)))return false;
  if(pawn.orbitalTrade&&!allows(structureById(world,pawn.orbitalTrade!.consoleId)))return false;
  if(pawn.trade&&!allows(world.pawns.find(p=>p.id===pawn.trade!.traderId)))return false;
  if(pawn.equipmentTask?.automatic&&!ground(pawn.equipmentTask.itemId))return false;
  return true;
}
