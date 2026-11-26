import {shiftActorPath297} from './actor-path-source-297.ts';
import { hostileTo } from './affiliation.ts';
import { prisonBreakActive,prisonBreakMeleeOwned } from './prison-break-state.ts';
import { endPrisonBreak } from './prison-break.ts';
import { prisonerEscapeRoute } from './prison-space.ts';
import { raidRoute } from './raid-space.ts';
import { isRoomDoor } from './door-rules.ts';
import { canStep } from './pathfinding.ts';
import { startTravel } from './movement.ts';
import { meleeContact } from './melee-space.ts';
import { processMelee } from './melee.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { medicallyStopped } from './health-rules.ts';
import { carrierOf } from './rescue-state.ts';
import { isStunned } from './stun.ts';
import { collapseFromExhaustion,processNeeds,type NeedContext } from './needs.ts';
import type { LightReader } from './light-environment.ts';
import type { NavigationGrid,SearchBudget } from './work-planner.ts';
import type { Pawn,World } from './types.ts';

const EMPTY:ReadonlySet<number>=new Set();
/** Escape first, fight an immediate hostile obstruction, breach only when no
 * physical exit route exists. raidRoute's hypothetical graph never moves a pawn.
 * Weapon scavenging, drugs, regrouping and rock digging are outside this adapter. */
export function processPrisonBreak(world:World,p:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader,needsContext:NeedContext):boolean {
  if(world.schemaVersion<204||!prisonBreakActive(p))return false;
  if(medicallyStopped(p)||carrierOf(world,p.id)||isStunned(p,world.tick*10))return true;
  collapseFromExhaustion(world,p,needsContext);
  if(p.need?.kind==='sleep'){endPrisonBreak(world,p);return false;}
  if(p.need&&!needsContext.release()) {processNeeds(world,p,needsContext);return true;}
  if(p.melee?.order&&!prisonBreakMeleeOwned(world,p,p.melee.order)){cancelMelee(p);p.path=[];}
  if(p.melee?.strike||p.shooting?.stance?.phase==='cooldown'){p.state='idle';return true;}
  if(p.melee?.order){processMelee(world,p,getBlocked,budget,getLight);return true;}
  const blocked=getBlocked();
  const adjacent=world.pawns.filter(t=>t!==p&&!t.prisoner&&hostileTo(p,t)&&t.state!=='dead'&&t.state!=='downed'&&!carrierOf(world,t.id)&&meleeContact(world,p,t,blocked)).sort((a,b)=>a.id-b.id)[0];
  if(adjacent){
    cancelShooting(p);p.path=[];
    p.melee={order:{auto:'prison-break',targetId:adjacent.id,startedDowned:false},strike:null};
    processMelee(world,p,getBlocked,budget,getLight);return true;
  }
  const next=p.path[0];
  if(next&&!canStep(world,p,next,blocked,EMPTY)){p.path=[];p.planCooldown=0;}
  if(!p.path.length||p.planCooldown===0){
    if(p.planCooldown||!budget.remaining){p.state='idle';return true;}
    const route=prisonerEscapeRoute(world,p,goals=>needsContext.search(goals));
    if(route===null)return true;
    p.planCooldown=20;
    if(route!==undefined){
      p.path=route;const goal=route.at(-1)??p;p.prisoner!.escape={x:goal.x,z:goal.z};
    }else{
      delete p.prisoner!.escape;p.path=[];
      if(!budget.remaining){p.state='idle';return true;}
      budget.remaining--;
      // Door permission must not turn a temporary actor obstruction into a
      // mandate to smash an otherwise openable leaf. Only this private planner
      // view marks leaves open; all returned travel rechecks the real world.
      const planning={...world,structures:world.structures.map(s=>isRoomDoor(s.kind)&&s.door?{...s,door:{...s.door,open:true}}:s)};
      const breach=raidRoute(planning,p,true,blocked);
      if(!breach){p.state='idle';return true;}
      p.path=breach.path;
      if(breach.barrier){
        cancelShooting(p);
        p.melee={order:{auto:'prison-break',targetId:breach.barrier.id,startedDowned:false,structure:true},strike:null};
        processMelee(world,p,getBlocked,budget,getLight);return true;
      }
      // A real route returned by the shared fallback is safe to follow too.
      p.prisoner!.escape={...breach.goal};
    }
  }
  const step=p.path[0];
  if(!step){p.state='idle';return true;}
  if(!canStep(world,p,step,getBlocked(),EMPTY)){p.path=[];p.planCooldown=0;p.state='idle';return true;}
  p.state='moving';if(startTravel(world,p,step,getLight))shiftActorPath297(p.path);
  return true;
}
