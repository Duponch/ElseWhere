import { distanceSquared } from './affiliation.ts';
import { aggressiveCrisisCandidates,chooseTantrumTarget,murderVictim } from './aggressive-crisis-admission.ts';
import { combatTarget } from './combat-target.ts';
import { finishMentalBreak,type AggressiveCrisis } from './mental-state.ts';
import { cancelMelee } from './melee-state.ts';
import { processMelee } from './melee.ts';
import { healthRandom } from './health.ts';
import { moodFrozen } from './mood.ts';
import { collapseFromExhaustion,processNeeds,type NeedContext } from './needs.ts';
import { retryInterruptedCargo } from './interrupted-cargo.ts';
import { isRoomDoor } from './door-rules.ts';
import { canStandAt } from './furniture-travel.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { hasReachableCell,routeToCell } from './pathfinding.ts';
import { searchCandidates,type NavigationGrid,type SearchBudget } from './work-planner.ts';
import type { LightReader } from './light-environment.ts';
import type { Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export const isAggressiveCrisis=(c:Pawn['mental']):boolean=>
  !!c?.crisis&&['tantrum','berserk','murderous-rage'].includes(c.crisis.kind);

function clearJob(p:Pawn):void {cancelMelee(p);p.path=[];p.planCooldown=0;}
function beginJob(p:Pawn,c:AggressiveCrisis):void {
  if(c.targetId===null)return;
  const order={targetId:c.targetId,startedDowned:false,auto:'mental' as const,
    ...(c.kind==='tantrum'?{structure:true as const}:{}),...(c.kind==='berserk'&&c.jobUntilCore!==null?{untilCore:c.jobUntilCore}:{})};
  if(p.melee?.order?.auto==='mental')return;
  p.melee={order,strike:p.melee?.strike??null};c.target=null;
}
function announceTarget(w:World,p:Pawn,targetId:number):void {
  const target=w.pawns.find(t=>t.id===targetId);
  w.events.push({tick:w.tick,type:'need',message:`Colère meurtrière : ${p.name} change de cible vers ${target?.name??'une personne'}.`});
  if(w.events.length>80)w.events.splice(0,w.events.length-80);
}

/** Fallback only when no aggressive target is available. Shared standability,
 * safe edges and budget remain real; this is not an attack on an arbitrary cell. */
function wander(w:World,p:Pawn,c:AggressiveCrisis,getBlocked:NavigationGrid,budget:SearchBudget,context:NeedContext):void {
  // A destroyed final target ends its order, but not the physical recovery.
  // Do not choose or engage a new wandering edge before that strike expires.
  if(p.melee?.strike){p.path=[];p.state='idle';return;}
  const reserved=reservedServiceCells(w,p.id);
  if(c.target){
    if(!canStandAt(w,c.target)||reserved.has(c.target.z*w.width+c.target.x)){c.target=null;p.path=[];p.state='idle';c.waitUntil=w.tick+1;return;}
    if(p.x===c.target.x&&p.z===c.target.z){c.target=null;p.path=[];p.state='idle';c.waitUntil=w.tick+(125+Math.floor(healthRandom(w)*76))/10;return;}
    context.move(c.target,true);return;
  }
  p.state='idle';if(w.tick<c.waitUntil||p.planCooldown)return;
  const reach=searchCandidates(w,p,getBlocked(),new Set(),budget);if(!reach)return;
  const candidates=[];
  for(let z=Math.max(0,p.z-7);z<=Math.min(w.height-1,p.z+7);z++)for(let x=Math.max(0,p.x-7);x<=Math.min(w.width-1,p.x+7);x++){
    const cell={x,z},index=z*w.width+x;
    if(distanceSquared(p,cell)>49||x===p.x&&z===p.z||reserved.has(index)||!canStandAt(w,cell)||!hasReachableCell(reach,index))continue;
    candidates.push(cell);
  }
  if(!candidates.length){c.waitUntil=w.tick+20;return;}
  c.target={...candidates[Math.floor(healthRandom(w)*candidates.length)]!};p.path=routeToCell(w,c.target,reach)!;p.planCooldown=0;context.move(c.target,true);
}

export function processAggressiveCrisis(w:World,p:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader,context:NeedContext):void {
  const current=p.mental?.crisis;if(!current||current.kind==='sad-wander'||current.kind==='food-binge'||current.kind==='confused-wander'||current.kind==='drug-binge')return;
  const c=current,core=w.tick*10;
  collapseFromExhaustion(w,p,context);
  if(moodFrozen(p)){finishMentalBreak(w,p,p.state!=='dead');return;}
  retryInterruptedCargo(w,p);
  // Only a real exhaustion sleep task is executed here. Ordinary meals/rest
  // must not replace the involuntary job before each attempted attack.
  if(p.need?.kind==='sleep'){processNeeds(w,p,context);if(moodFrozen(p))finishMentalBreak(w,p);return;}

  if(c.kind==='tantrum'){
    const target=c.targetId===null?undefined:structureById(w,c.targetId);
    if(c.targetId!==null&&!target||core>=c.nextTargetCore&&(c.targetId===null||c.attempted)){
      const ids=aggressiveCrisisCandidates(w,p,'tantrum',budget);if(ids===null)return;
      const choices=core-c.targetSinceCore>1250&&ids.some(id=>id!==c.targetId)?ids.filter(id=>id!==c.targetId):ids;
      const stream={value:w.rng},next=chooseTantrumTarget(w,p,choices,stream)??null;
      w.rng=stream.value;
      if(next!==c.targetId){clearJob(p);c.targetSinceCore=core;c.target=null;}
      c.targetId=next;c.attempted=false;c.nextTargetCore=core+500;
    }
    if(c.targetId===null){wander(w,p,c,getBlocked,budget,context);return;}
    if(c.attempted){p.state='idle';return;}
  }else if(c.kind==='berserk'){
    const target=c.targetId===null?undefined:combatTarget(w,c.targetId);
    if(c.targetId!==null&&(!target||['dead','downed'].includes(target.state)||c.jobUntilCore!==null&&core>=c.jobUntilCore)){
      clearJob(p);c.targetId=null;c.jobUntilCore=null;
    }
    if(c.targetId===null){
      if(c.target){wander(w,p,c,getBlocked,budget,context);return;}
      if(p.melee?.strike||w.tick<c.waitUntil||p.planCooldown||!budget.remaining){p.state='idle';return;}
      const stream={rng:w.rng};
      if(healthRandom(stream)<.5){w.rng=stream.rng;c.waitUntil=w.tick+9;p.path=[];p.state='idle';return;}
      const ids=aggressiveCrisisCandidates(w,p,'berserk',budget,true);if(ids===null)return;
      const targets=ids.flatMap(id=>{const t=combatTarget(w,id);return t?[t]:[];}).sort((a,b)=>distanceSquared(p,a)-distanceSquared(p,b)||a.id-b.id);
      if(!targets.length){w.rng=stream.rng;wander(w,p,c,getBlocked,budget,context);return;}
      c.targetId=targets[0]!.id;c.jobUntilCore=core+420+Math.floor(healthRandom(stream)*480);w.rng=stream.rng;c.target=null;p.path=[];p.planCooldown=0;
    }
  }else {
    const target=w.pawns.find(t=>t.id===c.targetId);
    if(target?.state==='dead'){finishMentalBreak(w,p);return;}
    if(core>=c.nextCheckCore){
      const ids=aggressiveCrisisCandidates(w,p,'murderous-rage',budget,true);if(ids===null)return;
      c.nextCheckCore=core+120;
      if(!target||!murderVictim(w,p,target)||!ids.includes(target.id)){
        if(!ids.length){finishMentalBreak(w,p);return;}
        const next=ids[Math.floor(healthRandom(w)*ids.length)]!;
        if(next!==c.targetId){clearJob(p);c.targetId=next;announceTarget(w,p,next);}
      }
    }
    const currentTarget=w.pawns.find(t=>t.id===c.targetId);
    if(!currentTarget||!murderVictim(w,p,currentTarget)){clearJob(p);p.state='idle';return;}
  }
  beginJob(p,c);
  if(!p.melee)return;
  const grid:NavigationGrid=c.kind==='tantrum'?getBlocked:()=>{
    const privateGrid=getBlocked().slice();
    for(const door of w.structures)if(isRoomDoor(door.kind))privateGrid[door.z*w.width+door.x]=0;
    return privateGrid;
  };
  processMelee(w,p,grid,budget,getLight);
}
