import {isSchema300OrLater} from './schema-compatibility-257.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {mentalState} from './mental-state.ts';
import {interruptDraftWork} from './drafting.ts';
import {cancelMelee} from './melee-state.ts';
import {cancelShooting} from './shooting-state.ts';
import {retryInterruptedCargo} from './interrupted-cargo.ts';
import {collapseFromExhaustion,processNeeds,type NeedContext} from './needs.ts';
import {canStandAt,furnitureDelay} from './furniture-travel.ts';
import {blockedCells,canStep,hasReachableCell,routeToCell,type Reachability} from './pathfinding.ts';
import {comfortableTemperature} from './heat-rules.ts';
import {chooseClinicalWanderDestination256} from './animal-confused-wander-256.ts';
import {healthRandom} from './health.ts';
import {animalClinicalRandom256} from './animal-condition-medical-frontier-256.ts';
import {carrierOf} from './rescue-state.ts';
import {spikeTrapKnowsOf} from './spike-trap-state.ts';
import type {Pawn,World} from './types.ts';
export interface HumanConditionWander256 {revision:1;nextMoveOrderIsWait:boolean}
/** True NEW original construction only. TryStart/Load/Recover never call it:
 * primary TryStartMentalState and StopAll do not reset Pawn_MindState. */
export function constructHumanConditionMind256(p:Pawn,version:number):void {
 if(!isSchema256Or257(version)||p.mental?.wander)throw Error('Clinical mind must be constructed once with the actual new human');
 mentalState(p).wander={revision:1,nextMoveOrderIsWait:isSchema300OrLater(Number(version))};
}
export function hasHumanConditionMind256(p:Pawn):boolean {return p.mental?.wander?.revision===1;}
export function validHumanClinicalConditionOwner256(p:Pawn,version:number,clock:number,spatial=false):boolean {
 const h=p.health;if(!h?.animalAgeConditions&&!h?.toxicBuildup&&p.mental?.crisis?.kind!=='confused-wander')return true;
 const requiresMind=!isSchema265OrLater(version)||!h?.alcohol||!!h.toxicBuildup||p.mental?.crisis?.kind==='confused-wander'||h?.animalAgeConditions?.cases.some(c=>c.kind!=='Carcinoma');
 if(!isSchema256Or257(version)||requiresMind&&!hasHumanConditionMind256(p)||!h||h.body||medicalCivilTick271(h)>clock)return false;
 for(const c of h.animalAgeConditions?.cases??[])for(const key of Object.keys(c.skillDecayRemainders??{}))if(!Object.hasOwn(p.skills,key))return false;
 const c=p.mental?.crisis;
 if(c?.kind==='confused-wander'&&(!spatial&&(c.target!==null||c.waitUntil>clock)||p.state==='dead'||p.state==='downed'))return false;
 return true;
}
function stop(w:World,p:Pawn,keepLaying=false):void {
 const bed=keepLaying&&p.state==='sleeping'&&p.need?.kind==='sleep'?p.need:undefined;
 interruptDraftWork(w,p);if(bed)p.need=bed;
 p.path=[];p.planCooldown=0;p.needCooldown=0;
 if(!['dead','downed','sleeping'].includes(p.state))p.state=p.moveCooldown>0||(p.motion?.end??0)>w.tick?'moving':'idle';
}
export function startHumanConfusion256(p:Pawn,clock:number,w?:World):boolean {
 if(p.state==='dead'||p.state==='downed'||p.state==='sleeping'||p.mental?.crisis||w&&carrierOf(w,p.id))return false;
 if(!hasHumanConditionMind256(p))throw Error('Historical human has no clinical wander authority');
 if(w){delete p.draft;cancelShooting(p);cancelMelee(p);delete p.flee;stop(w,p);}
 mentalState(p).crisis={kind:'confused-wander',age:0,target:null,waitUntil:clock};return true;
}
/** Disease recovery is not mood recovery: no catharsis or fabricated reward. */
export function recoverHumanConfusion256(p:Pawn,w?:World):void {
 if(p.mental?.crisis?.kind!=='confused-wander')return;
 delete p.mental.crisis;if(w)stop(w,p,true);
}
export function processHumanConfusedWander256(w:World,p:Pawn,context:NeedContext,candidatesReach:()=>Reachability|null):void {
 const c=p.mental?.crisis,m=p.mental?.wander;if(c?.kind!=='confused-wander'||!m)return;
 collapseFromExhaustion(w,p,context);retryInterruptedCargo(w,p);
 if(p.state==='downed'||p.state==='dead'){recoverHumanConfusion256(p,w);return;}
 // The actual existing need producer owns food/rest/pickup/contact. Confused
 // wandering only requests emergency needs, never a replacement remote meal.
 if(p.need||p.hunger<5||p.rest<15){if(processNeeds(w,p,context)){c.target=null;return;}}
 if(p.interruptedCargo)return;
 if(c.target){
  if(!canStandAt(w,c.target)){c.target=null;p.path=[];return;}
  if(p.x!==c.target.x||p.z!==c.target.z){context.move(c.target,true);return;}
  c.target=null;p.path=[];
 }
 if(w.tick<c.waitUntil||p.planCooldown>0)return;
 const reach=candidatesReach();if(!reach)return;
 const random=animalClinicalRandom256(()=>healthRandom(w)),wait=m.nextMoveOrderIsWait;m.nextMoveOrderIsWait=!wait;
 const startWait=()=>{p.path=[];p.state='idle';c.waitUntil=w.tick+random.integer(125,201)/10;};
 if(wait){startWait();return;}
 const physical=blockedCells(w),occupied=new Set<number>(),range=comfortableTemperature(w,p),free=(cell:{x:number;z:number})=>canStandAt(w,cell);
 const destination=chooseClinicalWanderDestination256(w,p,{free,occupy:free,step:(from,to)=>canStep(w,from,to,physical,occupied)},
  {canReach:cell=>hasReachableCell(reach,cell.z*w.width+cell.x),pathTo:cell=>routeToCell(w,cell,reach)??undefined},random,
  {comfy:{minimum:range.min,maximum:range.max},water:false,knowsTraps:spikeTrapKnowsOf(w,p),delayCore:cell=>furnitureDelay(w,p,cell)*10,destinationAllowed:()=>true});
 if(destination.x===p.x&&destination.z===p.z){startWait();return;}
 const path=routeToCell(w,destination,reach);if(!path){m.nextMoveOrderIsWait=false;return;}
 c.target=destination;p.path=path;p.planCooldown=0;context.move(destination,true);
}
