import {isDoubleBedKind} from './bed-kinds.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import { isBedKind } from './bed-kinds.ts';
import {localBedClaimAvailable256} from './actor-bed-local-256.ts';
import {prepareConfirmedBedAssignment256} from './actor-bed-command-256.ts';
import {commitActorBedClaim256} from './actor-map-bed-256.ts';
import { bedSlotCell,bedSlotClaimed,bedSlotForPatient,pawnBedSlot } from './bed-slots.ts';
import { isColonist } from './affiliation.ts';
import { deconstructionReserved } from './deconstruction-rules.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { releaseRescue } from './rescue-state.ts';
import { prisonBedValid } from './prison-space.ts';
import type { BedSlot,Cell,CommandResult,Pawn,Structure,World } from './types.ts';

/** Keep role priority separate from bed type: a hospital bed switched to an
 * ordinary role remains an ordinary destination. */
export const medicalBedPreference=(bed:Structure):number=>bed.medical?(bed.kind==='hospital-bed'?0:1):2;

export type MedicalBedCommand={type:'medical-bed';bedId:number;enabled:boolean};
export function rescueBedAvailable(world:World,bed:Structure,patient:Pawn,carrierId:number,capture=false,slot?:BedSlot):boolean {
  if(!targetBuildingPlayerUse263(world,bed))return false;
  if(world.schemaVersion>=256&&isBedKind(bed.kind)&&!bed.medical&&!localBedClaimAvailable256(world,bed,patient,isDoubleBedKind(bed.kind)?(slot??pawnBedSlot(patient,bed)):undefined))return false;
  if(isDoubleBedKind(bed.kind)){
    const place=slot??pawnBedSlot(patient,bed);
    return world.schemaVersion>=224&&!bed.medical&&!bed.prisoner&&!capture&&isColonist(patient)&&!patient.prisoner&&!patient.visitor&&!patient.raid&&!patient.podRescue
      &&patient.state!=='dead'&&!patient.health?.death&&place!==undefined&&!!bedSlotCell(bed,place)
      &&!deconstructionReserved(world,bed.id,carrierId)&&!bedSlotClaimed(world,bed,place,patient.id);
  }
  return isBedKind(bed.kind)&&!deconstructionReserved(world,bed.id,carrierId)
    &&!!bed.prisoner===(!!patient.prisoner||capture)&&(!bed.prisoner||prisonBedValid(world,bed))
    &&!world.pawns.some(p=>p.id!==patient.id&&(p.need?.kind==='sleep'&&p.need.bedId===bed.id||!bed.medical&&p.bedId===bed.id))
    &&!world.pawns.some(p=>p.id!==carrierId&&p.rescue?.bedId===bed.id);
}
/** Candidate places are enumerated before the actor's area/path ranking. A
 * forbidden head0 must not hide an admissible head1 in an otherwise empty bed. */
export function rescueBedPlaces(world:World,bed:Structure,patient:Pawn,carrierId:number,capture=false):{cell:Cell;bedSlot?:BedSlot}[] {
  if(!isDoubleBedKind(bed.kind))return rescueBedAvailable(world,bed,patient,carrierId,capture)?[{cell:{x:bed.x,z:bed.z}}]:[];
  if(capture||bedSlotForPatient(world,bed,patient,carrierId)===undefined)return [];
  const owned=pawnBedSlot(patient,bed),slots=owned===undefined?[0,1] as const:[owned];
  return slots.flatMap(slot=>{
    const cell=bedSlotCell(bed,slot);
    return cell&&rescueBedAvailable(world,bed,patient,carrierId,false,slot)?[{cell,bedSlot:slot}]:[];
  });
}
export function applyMedicalBed(world:World,command:MedicalBedCommand):CommandResult {
  const bed=world.structures.find(s=>s.id===command.bedId&&isBedKind(s.kind));
  if(bed&&!targetBuildingPlayerUse263(world,bed))return {ok:false,code:'invalid-command',reason:'Ce lit appartient à une autre faction.'};
  if(!bed||typeof command.enabled!=='boolean')return {ok:false,code:'invalid-command',reason:'Lit ou usage médical invalide.'};
  if(isDoubleBedKind(bed.kind))return {ok:false,code:'invalid-command',reason:'Le lit double est réservé au couchage civil.'};
  if(!!bed.medical===command.enabled)return {ok:true};
  const staying=!command.enabled?world.pawns.find(p=>p.state==='downed'&&p.need?.kind==='sleep'&&p.need.bedId===bed.id&&p.need.phase==='sleep')??null:null;
  const ownership=prepareConfirmedBedAssignment256(world,bed,staying);
  if(command.enabled)bed.medical=true;else delete bed.medical;
  // Core changing the role removes durable owners. A patient already lying in
  // the bed keeps its actual use; returning to normal claims it for that patient.
  for(const p of world.pawns){
    if(p.bedId===bed.id){p.bedId=null;delete p.bedSlot;}
    if(p.need?.kind==='sleep'&&p.need.bedId===bed.id){
      if(p.state==='downed'&&p.need.phase==='sleep'){if(!bed.medical)p.bedId=bed.id;}
      else interruptWork(world,p);
    }
  }
  for(const p of world.pawns)if(p.rescue?.bedId===bed.id){releaseRescue(world,p);p.path=[];p.orders.active=null;p.state='idle';p.planCooldown=0;}
  for(const p of world.pawns)p.planCooldown=0;
  if(ownership)commitActorBedClaim256(ownership);
  return {ok:true};
}
