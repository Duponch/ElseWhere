import {raidStaging330} from './raid-state.ts';
import {raidGroup261} from './temp-map-raids-261.ts';
import {processKidnapDuty261} from './caravan-kidnap-lord-261.ts';
import {processPhysicalKidnap261} from './caravan-kidnap-261.ts';
import { isBarrier } from './barriers.ts';
import { startTravel } from './movement.ts';
import { canStep } from './pathfinding.ts';
import { processMelee } from './melee.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { newTactics } from './tactics-state.ts';
import { processTactics } from './tactics.ts';
import { raidRoute } from './raid-space.ts';
import {distanceSquared} from './affiliation.ts';
import {moveToward} from './travel.ts';
import type { Pawn,World } from './types.ts';
import type { NavigationGrid,SearchBudget } from './work-planner.ts';
import type { LightReader } from './light-environment.ts';

const EMPTY:ReadonlySet<number>=new Set();
export function processRaider(w:World,p:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader):void {
  const r=p.raid!;
  if(p.melee?.strike||p.shooting?.stance?.phase==='cooldown'){p.state='idle';return;}
  processKidnapDuty261(w,p);
  if(processPhysicalKidnap261(w,p,getBlocked,budget,getLight)==='handled')return;
  const caravan=raidGroup261(w,r.group)?.caravan261;
  if(!r.exiting&&caravan?.kind==='defend-caravan'){
    // The original provisional non-fighters explicitly serve as carriers;
    // true trader/guard IDs came from their birth producer, never their names.
    if(p.id!==caravan.traderId&&!caravan.guardIds.includes(p.id)){
      const trader=w.pawns.find(q=>q.id===caravan.traderId&&q.state!=='dead'&&q.state!=='downed');
      if(trader&&distanceSquared(p,trader)>25){moveToward(w,p,trader,false,getBlocked,budget,false,getLight);r.goal=p.path.at(-1)??null;}
      else{p.path=[];r.goal=null;p.state='idle';}return;
    }
    p.tactics??=newTactics();
    processTactics(w,p,getBlocked,budget,getLight,{center:caravan.defendSpot,radius:28});
    if(p.tactics?.targetId!==null&&p.tactics?.targetId!==undefined)return;
    delete p.tactics;
    if(distanceSquared(p,caravan.defendSpot)>28**2){moveToward(w,p,caravan.defendSpot,false,getBlocked,budget,false,getLight);r.goal=p.path.at(-1)??null;}
    else{p.path=[];r.goal=null;p.state='idle';}return;
  }
  const group=!r.exiting?raidGroup261(w,r.group):undefined,stage=raidStaging330(group)?group!.stage330:undefined;
  if(stage){
    p.tactics??=newTactics();
    processTactics(w,p,getBlocked,budget,getLight,{center:stage.point,radius:28});
    if(p.tactics?.targetId!==null&&p.tactics?.targetId!==undefined)return;
    delete p.tactics;
    if(distanceSquared(p,stage.point)>36){moveToward(w,p,stage.point,false,getBlocked,budget,false,getLight);r.goal=p.path.at(-1)??null;}
    else{p.path=[];r.goal=null;p.state='idle';}return;
  }
  if(p.melee?.order?.structure){if(w.structures.some(s=>s.id===p.melee!.order!.targetId&&isBarrier(s))){processMelee(w,p,getBlocked,budget,getLight);return;}cancelMelee(p);p.path=[];r.goal=null;}
  let searched=false;
  if(!r.exiting){
    // Probe at bounded intervals without throwing away an unseen strategic route.
    if(p.tactics||!p.planCooldown&&budget.remaining){
      const route=p.tactics?[]:p.path;
      // A strategic route has no firing post. Detach it while acquiring a new
      // mandate; a failed probe restores it without touching the captured edge.
      if(!p.tactics){p.path=[];p.tactics=newTactics();}
      processTactics(w,p,getBlocked,budget,getLight);searched=true;
      if(p.tactics.targetId!==null){r.goal=null;return;}
      delete p.tactics;p.path=route;
    }
  }else{cancelShooting(p);cancelMelee(p);delete p.tactics;}
  if(!p.path.length){
    if(!budget.remaining||p.planCooldown&&!searched){p.state='idle';return;}
    budget.remaining--;p.planCooldown=20;
    const route=raidRoute(w,p,r.exiting,getBlocked());if(!route){p.state='idle';r.goal=null;return;}
    p.path=route.path;r.goal=route.goal;
    if(route.barrier){p.melee={order:{targetId:route.barrier.id,startedDowned:false,structure:true},strike:null};r.goal=null;processMelee(w,p,getBlocked,budget,getLight);return;}
  }
  const next=p.path[0];if(!next){p.state='idle';return;}
  if(!canStep(w,p,next,getBlocked(),EMPTY)){p.path=[];r.goal=null;p.planCooldown=0;p.state='idle';return;}
  p.state='moving';if(startTravel(w,p,next,getLight))p.path.shift();
}
