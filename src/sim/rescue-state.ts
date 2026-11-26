import {syncShipCasketPassenger277} from './ship-casket-carry-277.ts';
import {orderedTargetClaimant378} from './order-types.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {syncKidnappedPatient261,releaseKidnap261} from './caravan-kidnap-261.ts';
import {groupHumanCarrierOf257} from './group-human-admission-257.ts';
import type { Cell,Pawn,World } from './types.ts';
import { updatePawnHealth } from './health.ts';

/** One authoritative carrier owns this relationship; the patient is never cloned
 * into an item. During carry its saved position/edge mirror that carrier. */
export interface RescueTask {
  patientId:number;bedId:number;bedSlot?:import('./types.ts').BedSlot;phase:'approach'|'carry';capture?:true;arrest?:true;
  /** A release uses no bed (bedId=0), and cannot also capture the person. */
  release?:{drop:Cell;exit:Cell};
}
export const cryptosleepCarrying271=(p:Pawn):boolean=>p.cryptosleepTask?.action==='carry'&&(p.cryptosleepTask.phase==='carry'||p.cryptosleepTask.phase==='closing');
export const cryptosleepCarrierOf271=(w:World,id:number):Pawn|undefined=>w.pawns.find(p=>cryptosleepCarrying271(p)&&p.cryptosleepTask!.patientId===id);
/** The pawn carrying a human, by precedence: a rescue or cryptosleep carrier,
 * then a ship casket carrier, then a caravan group handler, then a kidnapper;
 * the first in pawn order within each. One pass over the pawns instead of
 * one per kind (the same result). */
interface CarrierCandidates {readonly revision:number;readonly length:number;readonly pawns:Pawn[];readonly indices:number[]}
let carrierScope:{revision:number;entries:WeakMap<readonly Pawn[],CarrierCandidates>}|undefined;
let verifyHumanCarrierCache=false;
/** Only engine entry points may hold this scope across human decisions. Every
 * true creation of a rescue, casket or kidnapping task marks the scope below.
 * Returning (including throwing) discards it; public mutable queries stay live. */
export function withHumanCarrierReadScope<T>(run:()=>T):T {
  if(carrierScope)return run();
  carrierScope={revision:0,entries:new WeakMap()};
  try{return run();}finally{carrierScope=undefined;}
}
/** Call immediately after creating a potential carrier task. Phase/target
 * updates and cancellations need no mark: those tasks are always read live.
 * Global within the synchronous scope because some task starters lack World. */
export function markHumanCarrierCandidatesDirty():void {if(carrierScope)carrierScope.revision++;}
export function setHumanCarrierCacheVerification(on:boolean):void {verifyHumanCarrierCache=on;}
export function humanCarrierCandidates(pawns:readonly Pawn[]):readonly Pawn[] {
  const scope=carrierScope;if(!scope)return pawns;
  let entry=scope.entries.get(pawns);
  if(entry&&entry.revision===scope.revision&&entry.length===pawns.length){
    // Existing owners can move within an in-place reordered roster. Checking
    // only their slots is enough to preserve their source order without a
    // fresh scan over all people on every query.
    let unchanged=true;
    for(let i=0;i<entry.pawns.length;i++)if(pawns[entry.indices[i]!]!==entry.pawns[i]){unchanged=false;break;}
    if(unchanged)return entry.pawns;
  }
  const candidates:Pawn[]=[],indices:number[]=[];
  for(let i=0;i<pawns.length;i++){const p=pawns[i]!;if(p.rescue||p.cryptosleepTask||p.shipCasketTask277||p.raid?.kidnap261){candidates.push(p);indices.push(i);}}
  entry={revision:scope.revision,length:pawns.length,pawns:candidates,indices};scope.entries.set(pawns,entry);return candidates;
}
export function carrierOf(world:World,patientId:number):Pawn|undefined {
  const answer=carrierFrom(world,patientId,humanCarrierCandidates(world.pawns));
  if(carrierScope&&verifyHumanCarrierCache&&answer!==carrierFrom(world,patientId))throw Error('Unmarked human carrier task creation within the simulation scope');
  return answer;
}
function carrierFrom(world:World,patientId:number,pawns:readonly Pawn[]=world.pawns):Pawn|undefined {
  let shipCasket:Pawn|undefined,kidnapper:Pawn|undefined;
  for(const p of pawns){
    const r=p.rescue,crypto=p.cryptosleepTask,casket=p.shipCasketTask277;
    if(r&&r.phase==='carry'&&r.patientId===patientId||crypto&&crypto.action==='carry'&&(crypto.phase==='carry'||crypto.phase==='closing')&&crypto.patientId===patientId)return p;
    if(!shipCasket&&casket&&casket.action==='carry'&&(casket.phase==='carry'||casket.phase==='closing')&&casket.patient?.kind==='human'&&casket.patient.id===patientId)shipCasket=p;
    if(!kidnapper&&p.raid?.kidnap261?.phase==='carry'&&p.raid.kidnap261.patientId===patientId)kidnapper=p;
  }
  return shipCasket??groupHumanCarrierOf257(world,patientId)??kidnapper;
}
/** For one synchronous physical movement pass, whose pawn list/order stays
 * fixed and which cannot start a new human carrier task. Include prospective
 * owners in every phase; reread their actual tasks on every query so releases,
 * phase changes and handovers among them are immediately visible. Caravan
 * ownership remains live. Discard before commands or human decisions. */
export function createPhysicalHumanCarrierReader(world:World):(patientId:number)=>Pawn|undefined {
  const candidates=world.pawns.filter(p=>p.rescue||p.cryptosleepTask||p.shipCasketTask277||p.raid?.kidnap261);
  return patientId=>carrierFrom(world,patientId,candidates);
}
export const rescueClaim=(world:World,patientId:number,except?:number):Pawn|undefined=>world.pawns.find(p=>p.id!==except&&(p.rescue?.patientId===patientId||p.cryptosleepTask?.action==='carry'&&p.cryptosleepTask.patientId===patientId||p.id===patientId&&p.cryptosleepTask?.action==='enter'||p.shipCasketTask277?.action==='carry'&&p.shipCasketTask277.patient?.kind==='human'&&p.shipCasketTask277.patient.id===patientId||p.id===patientId&&p.shipCasketTask277?.action==='enter'))??orderedTargetClaimant378(world,'pawn',patientId,except);
export function syncPatient(world:World,carrier:Pawn):void {
  syncShipCasketPassenger277(world,carrier);
  syncKidnappedPatient261(world,carrier);
  const patientId=carrier.rescue?.phase==='carry'?carrier.rescue.patientId:cryptosleepCarrying271(carrier)?carrier.cryptosleepTask!.patientId:undefined;if(patientId===undefined)return;
  const patient=world.pawns.find(p=>p.id===patientId);if(!patient)return;
  patient.x=carrier.x;patient.z=carrier.z;
  patient.motion=carrier.motion?{...carrier.motion,from:{...carrier.motion.from},to:{...carrier.motion.to},...carrier.motion.stagger?{stagger:carrier.motion.stagger.map(s=>({...s}))}:{}}:null;
  if(patient.motion)delete patient.motion.snowEntryPending;
  patient.moveCooldown=carrier.moveCooldown;
}
/** Cancelling cryptosleep keeps a passenger on the carrier's actual captured
 * edge. Civil people can share this floor; no remote bed or copied body. */
export function releaseCryptosleepCarry271(world:World,carrier:Pawn,despawning=false):void {
 const task=carrier.cryptosleepTask;if(!task)return;const carrying=cryptosleepCarrying271(carrier),patient=carrying?world.pawns.find(p=>p.id===task.patientId):undefined;
 if(!despawning&&patient?.health&&!patient.health.death&&medicalCivilTick271(patient.health)<world.tick)updatePawnHealth(world,patient);
 if(carrying)syncPatient(world,carrier);delete carrier.cryptosleepTask;
 if(patient){patient.planCooldown=0;patient.needCooldown=0;}
}
/** Civil people can share the floor, including an emergency fall on furniture.
 * A captured edge finishes with both bodies; there is no teleport to its origin. */
export function releaseRescue(world:World,carrier:Pawn,despawning=false):void {
  releaseKidnap261(world,carrier);
  const task=carrier.rescue;if(!task)return;
  const patient=world.pawns.find(p=>p.id===task.patientId);
  if(!despawning&&task.phase==='carry'&&patient?.health&&!patient.health.death&&medicalCivilTick271(patient.health)<world.tick)updatePawnHealth(world,patient);
  syncPatient(world,carrier);delete carrier.rescue;
  if(task.phase==='carry'&&patient){patient.planCooldown=0;patient.needCooldown=0;}
}
