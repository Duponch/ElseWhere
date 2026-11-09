import { allowedAreaAllows } from './allowed-area-state.ts';
import { urgentTreatment } from './care-rules.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { workPriority } from './work-types.ts';
import type { WorkType } from './types.ts';
import { lyingPatient,tendingProposal,startTending } from './tending.ts';
import { patientProposal,startPatientRest } from './patient-rest.ts';
import { releaseWork } from './work-release.ts';
import type { Reachability } from './pathfinding.ts';
import type { Pawn,World } from './types.ts';
import { rimWorkGiverOrder301 } from './work-givers-rimworld.ts';

/** Emergency work is a branch at a decision point, not a global interrupt.
 * Core only promotes emergency providers whose priority reaches the best
 * enabled ordinary work category, even when that category has no ready job.
 * In the schema 301 family the bound is exactly Core's
 * (Pawn_WorkSettings.CacheWorkGiversInOrder): only work types that have an
 * ordinary giver set it, so firefighting, whose only giver is an emergency
 * one, never does. */
export function urgentWorkEnabled(pawn:Pawn,work:'patient'|'doctor'|'firefight',world?:Pick<World,'schemaVersion'>):boolean {
  const priority=workPriority(pawn,work),core=!!world&&rimWorkGiverOrder301(Number(world.schemaVersion));
  return priority>0&&Object.entries(pawn.priorities).every(([type,p])=>p===0||core&&type==='firefight'||backgroundWorkRefusal(pawn,type as WorkType)!==undefined||p>=priority);
}

/** The 211 Core-tick bed review is represented by alternating 21/22 local
 * ticks. Phase derives from saved tick/ID, with no transient timer to lose. */
export const medicalBedReview=(world:World,pawn:Pawn):boolean=>((world.tick%211)*10+pawn.id%211)%211<10;

export function urgentMedicalTask(pawn:Pawn,world?:Pick<World,'schemaVersion'>):boolean {
  return !!pawn.tend?.urgent||pawn.need?.kind==='sleep'&&pawn.need.medical==='patient'
    &&urgentWorkEnabled(pawn,'patient',world)&&urgentTreatment(pawn);
}

/** Returns true when a decision must wait for navigation capacity. A failed
 * access check never releases the current bed or consumes a resource. */
export function planUrgentCare(world:World,pawn:Pawn,search:()=>Reachability|null):boolean {
  if(world.schemaVersion<50||pawn.orders.active!==null||pawn.interruptedCargo||pawn.collapsePending
    ||world.restRules==='legacy'&&pawn.rest===0||pawn.jobId!==null||pawn.haul||pawn.research||pawn.cooking||pawn.ward||pawn.feed||pawn.tend||pawn.surgery||pawn.rescue||pawn.recreation.task)return false;
  if(pawn.need&&(pawn.need.kind!=='sleep'||pawn.need.phase!=='sleep'||!medicalBedReview(world,pawn)))return false;
  if(!pawn.need&&pawn.planCooldown>0)return false;
  const patient=urgentWorkEnabled(pawn,'patient',world)&&urgentTreatment(pawn);
  const doctor=urgentWorkEnabled(pawn,'doctor',world);
  const others=doctor?world.pawns.filter(p=>p!==pawn&&allowedAreaAllows(world,pawn,p)&&lyingPatient(p)&&urgentTreatment(p)):[];
  const self=doctor&&pawn.selfTend&&allowedAreaAllows(world,pawn,pawn)&&urgentTreatment(pawn);
  if(!patient&&!others.length&&!self)return false;
  const reach=search();if(!reach)return true;
  // Patient precedes Doctor on ties; both eligible categories have the same
  // best numeric priority. Keep an existing bed service without restarting it.
  if(patient){
    const proposal=patientProposal(world,pawn,reach);
    if(proposal){
      if(pawn.need?.kind==='sleep'&&pawn.need.bedId===proposal.bedId&&pawn.need.medical==='patient')return false;
      if(!releaseWork(world,pawn))return true;
      startPatientRest(world,pawn,proposal);return false;
    }
  }
  others.sort((a,b)=>(a.x-pawn.x)**2+(a.z-pawn.z)**2-(b.x-pawn.x)**2-(b.z-pawn.z)**2||a.id-b.id);
  for(const p of [...others,...(self?[pawn]:[])]){
    const proposal=tendingProposal(world,pawn,p,reach);if(!proposal)continue;
    if(!releaseWork(world,pawn))return true;
    proposal.task.urgent=true;startTending(pawn,proposal);return false;
  }
  return false;
}
