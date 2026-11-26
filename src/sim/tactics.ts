import {shiftActorPath297} from './actor-path-source-297.ts';
import { assaultTarget,distanceSquared,hostileTo } from './affiliation.ts';
import { automaticShotScore,chooseAutomaticTarget } from './automatic-targets.ts';
import { candidateAccess } from './candidate-access.ts';
import { clearShotSegment,findShotLine } from './combat-space.ts';
import { captureWorldShotGrid } from './combat-world.ts';
import { equippedWeapon } from './equipment-rules.ts';
import { healthRandom } from './health.ts';
import { meleeContact,meleePlaces } from './melee-space.ts';
import { meleeTools } from './melee-statistics.ts';
import { processMelee,startSentryMelee } from './melee.ts';
import { cancelMelee } from './melee-state.ts';
import { startTravel } from './movement.ts';
import { canStep } from './pathfinding.ts';
import { rangedWeaponProfile } from './ranged-statistics.ts';
import { cancelShooting } from './shooting-state.ts';
import { shootingQueries,startAutonomousShot } from './shooting.ts';
import { firingPosition,tacticalClaims } from './tactical-positions.ts';
import { resetTactics } from './tactics-state.ts';
import type { LightReader } from './light-environment.ts';
import type { NavigationGrid,SearchBudget } from './work-planner.ts';
import type { Cell,Pawn,World } from './types.ts';
export interface TacticalDefenseArea261 {center:Cell;radius:28}

const EMPTY:ReadonlySet<number>=new Set();
function clearEngagement(p:Pawn):void {cancelShooting(p);cancelMelee(p);p.path=[];resetTactics(p);}
/** Visible human threats only. Group orders, unseen colony targets and raids
 * will have their own controller; do not turn this scenario into an omniscient AI. */
function acquire(world:World,p:Pawn,range:number,blocked:Uint8Array,defense?:TacticalDefenseArea261):Pawn|undefined {
  const candidates=world.pawns.filter(q=>hostileTo(p,q)&&assaultTarget(p,q)&&distanceSquared(p,q)<=56**2&&(!defense||distanceSquared(defense.center,q)<=defense.radius**2)).sort((a,b)=>distanceSquared(p,a)-distanceSquared(p,b)||a.id-b.id);
  if(!candidates.length)return;
  const margin=59,queries=shootingQueries(world,()=>captureWorldShotGrid(world,{minX:p.x-margin,minZ:p.z-margin,maxX:p.x+margin,maxZ:p.z+margin}));
  const visible=candidates.filter(q=>!queries.carried(q.id)&&clearShotSegment(queries.grid(),p,q));
  if(range) {
    const shots=visible.flatMap(target=>{
      const line=findShotLine(queries.grid(),p,{cell:target,leans:!['sleeping','resting'].includes(target.state)},range);
      return line.ok?[{target,score:automaticShotScore(world,p,target,queries.grid(),line.from,line.to,queries.carried)}]:[];
    });
    const selected=chooseAutomaticTarget(shots,()=>healthRandom(world));if(selected)return selected;
  }
  let reach:ReturnType<typeof candidateAccess>|undefined;
  for(const target of visible){reach??=candidateAccess(world,p,blocked,EMPTY);if(meleePlaces(world,p,target).some(c=>reach!.has(c.z*world.width+c.x)))return target;}
  return;
}
function reviewAt(world:World,melee=false):number {
  return world.tick*10+(melee?360:450)+Math.floor(healthRandom(world)*(melee?121:101));
}
/** Called only after a captured edge. Movement, impacts and stances remain in
 * their shared systems; this controller only chooses intent and a physical post. */
export function processTactics(world:World,p:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader,defense?:TacticalDefenseArea261):void {
  const t=p.tactics!;
  let target=world.pawns.find(q=>q.id===t.targetId&&hostileTo(p,q)&&assaultTarget(p,q));
  if(t.targetId!==null&&(!target||distanceSquared(p,target)>65**2||defense&&distanceSquared(defense.center,target)>defense.radius**2))clearEngagement(p);
  if(startSentryMelee(world,p)) {
    const id=p.melee!.order!.targetId;
    if(t.targetId!==id||t.post){t.targetId=id;t.post=null;t.reviewAtCore=reviewAt(world,true);}
  }
  // Re-evaluation may cancel intention, never a recovery or committed edge.
  if(p.shooting?.stance?.phase==='cooldown'||p.melee?.strike){p.state='idle';return;}
  const weapon=equippedWeapon(world,p),queries=shootingQueries(world);
  const range=weapon?.weapon&&!p.equipmentDropPending&&queries.body(p).capacities.manipulation>0?rangedWeaponProfile(weapon.item,weapon.weapon.quality)?.range??0:0;
  const expired=world.tick*10>=t.reviewAtCore;
  if(expired&&t.targetId!==null&&budget.remaining&&!p.planCooldown) {
    // Review is a new query, not an order to stop a still-valid pursuit.
    // Keep the current intent while this query is throttled; a same-target
    // result preserves its route/stance instead of inheriting an idle backoff.
    budget.remaining--;p.planCooldown=20;
    const reviewed=acquire(world,p,range,getBlocked(),defense);
    if(!reviewed){clearEngagement(p);p.state='idle';return;}
    if(reviewed.id!==t.targetId)clearEngagement(p);
    else if(p.melee&&range&&!meleeContact(world,p,reviewed,getBlocked())){
      cancelMelee(p);p.path=[];t.post=null;
    }
    target=reviewed;t.targetId=reviewed.id;t.reviewAtCore=reviewAt(world,!range);p.planCooldown=0;
  }
  if(!t.targetId) {
    if(!budget.remaining||p.planCooldown){p.state='idle';return;}
    budget.remaining--;p.planCooldown=20;
    target=acquire(world,p,range,getBlocked(),defense);
    if(!target){p.state='idle';return;}
    t.targetId=target.id;t.reviewAtCore=reviewAt(world,!range);p.planCooldown=0;
  } else target=world.pawns.find(q=>q.id===t.targetId)!;
  if(p.melee){processMelee(world,p,getBlocked,budget,getLight);return;}
  if(!range) {
    if(!meleeTools(world,p).length){clearEngagement(p);p.state='idle';p.planCooldown=20;return;}
    cancelShooting(p);p.path=[];t.post=null;
    p.melee={order:{targetId:target!.id,startedDowned:false},strike:null};
    processMelee(world,p,getBlocked,budget,getLight);return;
  }
  if(p.shooting)return;
  if(!p.path.length) {
    if(!t.post||distanceSquared(p,t.post)!==0||!startAutonomousShot(world,p,target!,queries)) {
      if(!budget.remaining||p.planCooldown){p.state='idle';return;}
      budget.remaining--;p.planCooldown=20;
      const r=Math.ceil(range)+3,grid=captureWorldShotGrid(world,{minX:Math.min(p.x-3,target!.x-r),minZ:Math.min(p.z-3,target!.z-r),maxX:Math.max(p.x+3,target!.x+r),maxZ:Math.max(p.z+3,target!.z+r)});
      const position=firingPosition(world,p,target!,range,grid,getBlocked());
      if(!position){t.post=null;p.state='idle';return;}
      t.post=position.post;p.path=position.path;p.planCooldown=0;
      if(!p.path.length){startAutonomousShot(world,p,target!,shootingQueries(world,()=>grid));p.state='idle';return;}
    } else return;
  }
  const next=p.path[0];
  if(next) {
    if(!canStep(world,p,next,getBlocked(),EMPTY)||t.post&&tacticalClaims(world,p).has(t.post.z*world.width+t.post.x)){
      p.path=[];t.post=null;p.planCooldown=4;p.state='idle';return;
    }
    p.state='moving';if(startTravel(world,p,next,getLight))shiftActorPath297(p.path);
  }
}
