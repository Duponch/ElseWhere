import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {clearActualGuest259} from './world-affiliation-259.ts';
import {forgetLocalActorBed256} from './actor-bed-local-256.ts';
import { isColonist } from './affiliation.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { patientClaimed } from './care-access.ts';
import { canStandAt } from './furniture-travel.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { updatePawnHealth } from './health.ts';
import { hasReachableCell,routeToCell,type Reachability } from './pathfinding.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { capturePrisonTopology,prisonRoom } from './prison-space.ts';
import { carrierOf,rescueClaim,syncPatient,type RescueTask } from './rescue-state.ts';
import { workPriority } from './work-types.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,Pawn,World } from './types.ts';

export interface PrisonerReleaseProposal {task:RescueTask;path:Cell[]}
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const settled=(world:World,p:Pawn)=>p.moveCooldown===0&&(p.motion?.end??0)<=world.tick;
const edge=(w:World,c:Cell)=>c.x===0||c.z===0||c.x===w.width-1||c.z===w.height-1;
const distance=(a:Cell,b:Cell)=>(a.x-b.x)**2+(a.z-b.z)**2;

/** Core registers release under both BasicWorker and Warden. Work priority
 * includes the existing background refusals; Manipulation uses the shared
 * medical work guard, rather than the prisoner's social capacities. */
export function releaseReady(world:World,actor:Pawn,patient:Pawn):boolean {
  if(actor.rescue?.phase!=='carry'&&!allowedAreaAllows(world,actor,patient))return false;
  if(world.schemaVersion<202||!isColonist(actor)||actor.prisoner||actor.draft||actor.mental?.crisis||actor.burning||actor.flee
    ||actor.collapsePending||world.restRules==='legacy'&&actor.rest===0||actor.interruptedCargo||actor.orders.active!==null||medicalWorkRefusal(actor)
    ||!workPriority(actor,'warden')&&!workPriority(actor,'basic')||carrierOf(world,actor.id))return false;
  const prisoner=patient.prisoner,carrier=carrierOf(world,patient.id);
  return patient!==actor&&!!prisoner&&!prisonBreakActive(patient)&&prisoner.mode==='release'&&prisoner.releasedAt===undefined&&!prisoner.escape
    &&patient.state!=='dead'&&patient.state!=='downed'&&!patient.health?.death&&!patient.mental?.crisis
    &&(!carrier||carrier===actor)&&!rescueClaim(world,patient.id,actor.id)&&!patientClaimed(world,patient.id,actor);
}

/** The Core searches regions and chooses a random cell in an edge-connected
 * district. Our room representation has no district/random-region stream:
 * choose the nearest accessible standing cell in an edge-touching air space,
 * then its nearest accessible border cell, with cell index breaking ties.
 * This preserves the physical carry/deposit/independent exit sequence. */
export function releaseProposal(world:World,actor:Pawn,patient:Pawn,reach:Reachability):PrisonerReleaseProposal|undefined {
  if(!releaseReady(world,actor,patient))return;
  const path=routeToCell(world,patient,reach);if(!path)return;
  const topology=capturePrisonTopology(world),candidates:Cell[]=[],local=world.schemaVersion>=213&&isColonist(patient);
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++){
    const c={x,z},room=topology.at(x,z);
    if(room?.kind==='space'&&(local?!prisonRoom(world,c,topology):room.touchesMapEdge)&&canStandAt(world,c)&&hasReachableCell(reach,z*world.width+x))candidates.push(c);
  }
  candidates.sort((a,b)=>distance(a,patient)-distance(b,patient)||a.z*world.width+a.x-b.z*world.width-b.x);
  const drops=candidates.filter(c=>allowedAreaAllows(world,actor,c));
  if(local&&drops[0])return {task:{patientId:patient.id,bedId:0,phase:'approach',release:{drop:{...drops[0]},exit:{...drops[0]}}},path};
  const exits=candidates.filter(c=>edge(world,c));
  for(const drop of drops){
    const room=topology.at(drop.x,drop.z);
    const exit=exits.filter(c=>topology.at(c.x,c.z)===room)
      .sort((a,b)=>distance(a,drop)-distance(b,drop)||a.z*world.width+a.x-b.z*world.width-b.x)[0];
    if(exit)return {task:{patientId:patient.id,bedId:0,phase:'approach',release:{drop:{...drop},exit:{...exit}}},path};
  }
}

export function startPrisonerRelease(actor:Pawn,proposal:PrisonerReleaseProposal):void {
  actor.rescue=proposal.task;actor.path=proposal.path;actor.state='moving';actor.planCooldown=0;
}

function destinationValid(world:World,task:RescueTask,patient:Pawn):boolean {
  if(task.capture||task.arrest||task.bedId!==0||!task.release)return false;
  const {drop,exit}=task.release,topology=capturePrisonTopology(world),room=topology.at(drop.x,drop.z);
  if(world.schemaVersion>=213&&isColonist(patient))return room?.kind==='space'&&!prisonRoom(world,drop,topology)&&same(drop,exit)&&canStandAt(world,drop);
  return room?.kind==='space'&&room.touchesMapEdge&&topology.at(exit.x,exit.z)===room
    &&edge(world,exit)&&canStandAt(world,drop)&&canStandAt(world,exit);
}

/** Shared releaseRescue owns interruptions: the original patient's position,
 * captured edge and cooldown stay with the body, without marking it released. */
export function reconcileRelease(world:World,actor:Pawn):boolean {
  const task=actor.rescue,patient=task&&world.pawns.find(p=>p.id===task.patientId);
  if(task?.release&&patient&&allowedAreaAllows(world,actor,task.release.drop)&&releaseReady(world,actor,patient)&&destinationValid(world,task,patient))return true;
  if(task?.release)releaseWork(world,actor);
  return false;
}

export function processPrisonerRelease(world:World,actor:Pawn,context:NeedContext):void {
  const task=actor.rescue;if(!task?.release)return;
  const patient=world.pawns.find(p=>p.id===task.patientId);
  // Settle physiology under its previous posture before pickup or deposit.
  if(patient?.health&&!patient.health.death&&patient.health.tick<world.tick)updatePawnHealth(world,patient);
  if(!reconcileRelease(world,actor)||!patient)return;
  if(!settled(world,actor)||(actor.stun?.untilCore??0)>world.tick*10){syncPatient(world,actor);return;}
  actor.state='moving';
  if(task.phase==='approach'){
    if(!same(actor,patient)){context.move(patient,true);return;}
    if(!settled(world,patient)||(patient.stun?.untilCore??0)>world.tick*10)return;
    // An engaged meal/cargo must be physically retained before the patient is
    // picked up. A full floor postpones the pickup without granting release.
    const drops=planCommandDrops(world,{type:'clear-orders',pawnId:patient.id});
    if(!drops||!releaseWork(world,patient,drops))return;
    clearQueuedOrders(world,patient);delete patient.priorityWork;
    task.phase='carry';actor.path=[];actor.planCooldown=0;syncPatient(world,actor);
    context.event(`${actor.name} prend ${patient.name} pour le porter hors de la prison.`);
  }
  const {drop,exit}=task.release;
  if(!same(actor,drop)){context.move(drop,true);syncPatient(world,actor);return;}
  if(!settled(world,actor))return;
  // No admission/status change is committed if conservative release cannot
  // keep a patient's temporary cargo on the floor at the actual deposit.
  if(!releaseWork(world,patient))return;
  syncPatient(world,actor);delete actor.rescue;
  actor.orders.active=null;actor.path=[];actor.state='idle';actor.planCooldown=0;
  patient.motion=null;patient.moveCooldown=0;forgetLocalActorBed256(world,patient);patient.need=null;
  patient.state='idle';patient.planCooldown=0;patient.needCooldown=0;
  if(world.schemaVersion>=213&&isColonist(patient)){
    if((Number(world.schemaVersion)===259||Number(world.schemaVersion)===260||(Number(world.schemaVersion)===261||(Number(world.schemaVersion)===262||isSchema263OrLater(Number(world.schemaVersion)))))&&patient.worldAffiliation259)clearActualGuest259(patient);else delete patient.prisoner;
    context.event(`${actor.name} a libéré ${patient.name}, qui retrouve sa liberté dans la colonie.`);
  }else{
    patient.prisoner!.releasedAt=world.tick;patient.prisoner!.escape={...exit};
    context.event(`${actor.name} a libéré ${patient.name}, qui rejoint la sortie de la carte.`);
  }
}
