import { enableAndInitializeWork, initializesWorkLikeCore302 } from './work-initialization.ts';
import {commitJoinedPlayer259} from './world-affiliation-259.ts';
import { comfortableTemperature,nextHeatSeverity } from './heat-rules.ts';
import { nextColdSeverity } from './cold-rules.ts';
import { medicalStatus } from './injury-state.ts';
import { carrierOf } from './rescue-state.ts';
import { outdoorTemperature } from './temperature.ts';
import type { PodRescueOrigin } from './pod-rescue-state.ts';
import type { Pawn,World } from './types.ts';

const hash=(value:number,salt:number):number=>{
  let n=(value^salt)>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
};
/** Local stable selection; independent is semantic provenance, not a faction.
 * Neither selection nor the recovery decision consumes simulation RNG. */
export const selectPodRescueOrigin=(seed:number):PodRescueOrigin=>hash(seed,0x2640c11d)<0x80000000?'independent':'outlander';
/** Adaptation of Core's identity-seeded recovery choice, not its RNG output. */
export const podRescueIdentityRoll=(pawnId:number):number=>hash(pawnId,0x88f8e4)/0x100000000;

/** Actual outside air, with the existing apparel-adjusted injury thresholds.
 * A merely uncomfortable temperature does not imply a dangerous departure.
 * Toxic fallout and noxious haze are not part of this local adaptation. */
export function podRescueOutdoorDanger(w:World,p:Pawn):boolean {
  const outside=outdoorTemperature(w),range=comfortableTemperature(w,p);
  return nextColdSeverity(0,outside,range.min)>0||nextHeatSeverity(0,outside,range.max)>0;
}
function mobileAndSettled(w:World,p:Pawn):boolean {
  return p.state!=='downed'&&p.state!=='dead'&&!p.prisoner&&!p.health?.death
    &&(!p.health||medicalStatus(p.health)==='mobile')&&!carrierOf(w,p.id)
    &&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick
    &&(p.stun?.untilCore??0)<=w.tick*10&&!p.shooting?.stance&&!p.melee?.strike
    &&!p.interruptedCargo&&!p.equipmentDropPending;
}
function emit(w:World,message:string):void {
  w.events.push({tick:w.tick,type:'need',message});
  if(w.events.length>80)w.events.splice(0,w.events.length-80);
}
/** Notify_PawnUndowned-style automatic integration after actual rescue.
 * No origin means historical behavior forever; ordinary outlanders leave.
 * Observe physiology, never heal, advance a captured edge or release a carrier.
 * Caller reconciles death/capture first; this entry also checks them itself. */
export function reconcilePodRescueJoining(w:World):void {
  if(w.schemaVersion<199||!w.podRescues)return;
  for(const incident of w.podRescues.incidents){
    if(incident.origin!=='independent'||incident.result||incident.decision)continue;
    const p=w.pawns.find(p=>p.id===incident.pawnId);
    const admittedAt=p?.podRescue?.admittedAt;
    if(!p||p.faction!=='outlanders'||p.podRescue?.incidentId!==incident.id||admittedAt===undefined||!mobileAndSettled(w,p))continue;
    const joins=podRescueIdentityRoll(p.id)<.5||podRescueOutdoorDanger(w,p);
    if(!joins){
      incident.decision={at:w.tick,outcome:'left',admittedAt};
      emit(w,`${p.name} ne rejoint pas la colonie après son secours et repartira après sa convalescence.`);
      continue;
    }
    const food=w.foodPolicies.find(policy=>policy.id===p.foodPolicyId)??w.foodPolicies[0];
    const apparel=w.apparelPolicies?.find(policy=>policy.id===p.apparelPolicyId)??w.apparelPolicies?.[0];
    // Do not commit a partial affiliation if a malformed host lacks policies.
    if(!food||!apparel)continue;
    // A guest's bare path is an exit intention. A real meal/medical/rest task
    // retains its path, bed, ownership and other actors' treatment commitments.
    if(!p.need){p.path=[];if(p.state==='moving')p.state='idle';}
    commitJoinedPlayer259(w,p);p.faction='colony';p.foodPolicyId=food.id;p.apparelPolicyId=apparel.id;
    p.apparelAutomation=true;p.nextApparelCheckAt=w.tick;
    // Before schema 302, the same defaults as startingPawn; from 302, RimWorld's
    // EnableAndInitialize. Background work restrictions remain enforced by
    // workPriority. Skills, traits and all possessions stay intact.
    if(initializesWorkLikeCore302(w.schemaVersion))enableAndInitializeWork(p);
    else p.priorities={handle:3,art:3,clean:3,firefight:1,warden:3,basic:3,hunt:2,research:3,patient:1,bedrest:3,doctor:1,mine:2,gather:2,build:2,haul:3,grow:2,cook:2,craft:2};
    p.planCooldown=0;p.needCooldown=0;
    delete p.podRescue;
    incident.decision={at:w.tick,outcome:'joined',admittedAt};
    incident.result='joined';incident.resolvedAt=w.tick;
    emit(w,`${p.name} rejoint la colonie après avoir été secouru.`);
  }
}
