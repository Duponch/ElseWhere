import {isDoubleBedKind} from './bed-kinds.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import type { BedSlot,Cell,Pawn,Structure,World } from './types.ts';
import {actualBedOwners256,captureActorBeds256,globalCivilBedShare256} from './actor-bed-local-256.ts';
import {registeredCampaign} from './world-map-context.ts';
export type { BedSlot } from './types.ts';

const directions:readonly Cell[]=[{x:0,z:1},{x:1,z:0},{x:0,z:-1},{x:-1,z:0}];
const bedKind=(bed:Structure)=>bed.kind==='sleeping-spot'||bed.kind==='bedroll'||bed.kind==='bed'||bed.kind==='hospital-bed'||isDoubleBedKind(bed.kind);
const civil=(pawn:Pawn)=> (pawn.faction??'colony')==='colony'&&!pawn.prisoner&&!pawn.visitor&&!pawn.raid&&!pawn.podRescue&&pawn.state!=='dead';
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;

/** The anchor is head0. A durable slot never follows the rank of its owner. */
export const bedSlotsCount=(bed:Structure):1|2=>isDoubleBedKind(bed.kind)?2:1;
export function bedSlotCell(bed:Structure,slot:BedSlot):Cell|undefined {
  if(!bedKind(bed)||(slot!==0&&slot!==1)||slot>=bedSlotsCount(bed))return;
  const orientation=bed.orientation??0;
  if(!Number.isInteger(orientation)||orientation<0||orientation>3)return;
  const side=directions[(orientation+1)%4]!;
  return {x:bed.x+side.x*slot,z:bed.z+side.z*slot};
}
export function bedSlotBodyCenter(bed:Structure,slot:BedSlot):Cell|undefined {
  const head=bedSlotCell(bed,slot);if(!head)return;
  const direction=directions[bed.orientation??0]!;
  return {x:head.x+direction.x*.5,z:head.z+direction.z*.5};
}
export function pawnBedSlot(pawn:Pick<Pawn,'bedId'|'bedSlot'>,bed:Structure):BedSlot|undefined {
  if(pawn.bedId!==bed.id||!bedKind(bed))return;
  if(!isDoubleBedKind(bed.kind))return pawn.bedSlot===undefined?0:undefined;
  return pawn.bedSlot===0||pawn.bedSlot===1?pawn.bedSlot:undefined;
}
/** The beneficiary, not the carrier, owns a rescue reservation. A person's
 * durable assignment, sleeping need and rescue are the same logical claim. */
/** `actorBeds`, when given, returns captureActorBeds256(registeredCampaign(world))
 * for this unchanged World: a reader asking about many slots of one World
 * captures the campaign's beds once instead of once per question. */
export function bedSlotClaimed(world:World,bed:Structure,slot:BedSlot,exceptPawnId?:number,actorBeds?:()=>ReturnType<typeof captureActorBeds256>):boolean {
  const head=bedSlotCell(bed,slot);if(!head)return true;
  for(const pawn of world.pawns){
    if(pawn.id!==exceptPawnId&&pawn.state!=='dead'){
      if(!bed.medical&&pawnBedSlot(pawn,bed)===slot)return true;
      if(pawn.need?.kind==='sleep'&&pawn.need.bedId===bed.id&&same(pawn.need.target,head))return true;
    }
    const rescue=pawn.rescue;
    if(rescue&&rescue.patientId!==exceptPawnId&&rescue.bedId===bed.id&&(isDoubleBedKind(bed.kind)?rescue.bedSlot===slot:slot===0))return true;
  }
  return world.schemaVersion>=256&&!bed.medical&&actualBedOwners256(actorBeds?actorBeds():captureActorBeds256(registeredCampaign(world)),bed.id,isDoubleBedKind(bed.kind)?slot:undefined).some(p=>p.id!==exceptPawnId&&p.state!=='dead'&&!p.health?.death);
}
/** Manual assignments do not require a relationship. This rule is only the
 * admission of a new owner by a sleep/patient provider into a shared bed. */
export function civilBedShareAllowed(world:World,bed:Structure,pawn:Pawn):boolean {
  if(!isDoubleBedKind(bed.kind)||bed.medical||bed.prisoner||!civil(pawn)||!world.pawns.some(p=>p.id===pawn.id))return false;
  if(pawnBedSlot(pawn,bed)!==undefined)return true;
  if(world.schemaVersion>=256)return globalCivilBedShare256(world,bed,pawn);
  const owners=world.pawns.filter(p=>p.bedId===bed.id&&p.state!=='dead');
  if(!owners.length)return true;
  return owners.every(owner=>civil(owner)&&world.relationships?.links.some(link=>
    (link.kind==='lover'||link.kind==='spouse')&&(link.aId===pawn.id&&link.bId===owner.id||link.bId===pawn.id&&link.aId===owner.id)));
}
/** A place proposal, not a navigation/role verdict. Callers retain their
 * historical simple-bed availability/deconstruction/prison guards. */
export function bedSlotForPatient(world:World,bed:Structure,patient:Pawn,carrierId:number):BedSlot|undefined {
  if(!bedKind(bed))return;
  if(world.jobs.some(job=>(job.deconstruction?.structureId??job.furniture?.structureId)===bed.id&&job.reservedBy!==null&&job.reservedBy!==carrierId))return;
  if(isDoubleBedKind(bed.kind)){
    if(!civilBedShareAllowed(world,bed,patient)||patient.surgeryRequest)return;
    const owned=pawnBedSlot(patient,bed);
    if(owned!==undefined)return bedSlotClaimed(world,bed,owned,patient.id)?undefined:owned;
    for(const slot of [0,1] as const)if(!bedSlotClaimed(world,bed,slot,patient.id))return slot;
    return;
  }
  if(!!bed.prisoner!==!!patient.prisoner)return;
  return bedSlotClaimed(world,bed,0,patient.id)?undefined:0;
}
export function bedAssignmentReason(world:World,bed:Structure,pawn:Pawn|null,slot:BedSlot):string|undefined {
  if(!targetBuildingPlayerUse263(world,bed))return 'Ce lit appartient à une autre faction.';
  if(!bedKind(bed)||!bedSlotCell(bed,slot))return 'Place de lit invalide.';
  if(bed.medical||bed.prisoner)return 'Ce lit ne permet pas une affectation civile.';
  if(isDoubleBedKind(bed.kind)&&pawn&&(!civil(pawn)||!world.pawns.some(p=>p.id===pawn.id)))return 'Cette place nécessite un colon libre présent.';
  if(pawn?.state==='dead')return 'Ce colon est décédé.';
}
