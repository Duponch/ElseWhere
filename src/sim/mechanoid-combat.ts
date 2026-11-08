import {recordShipCasketFilthMovement277} from './filth.ts';
import {shipCasketCarrierOf277,syncShipCasketPassenger277} from './ship-casket-carry-277.ts';
import {mechanicalDuty256,mechanicalOrder256,sleepingTempleMech256} from './temple-mech-duty-256.ts';
import { mechanoidDefinition } from './mechanoid-definition.ts';
import { glowAppliesToMechanoids } from './glow-rules-301.ts';
import { mechanoidBodyModel } from './mechanoid-anatomy.ts';
import { bodyEfficiencies } from './body-capacities.ts';
import { HP_UNIT } from './injury-rules.ts';
import { mechaAssessment } from './mechanoid-health.ts';
import { partMissing } from './injury-state.ts';
import { chooseMeleeTool,rankMeleeTools,type MeleeTool } from './melee-statistics.ts';
import { cancelMelee } from './melee-state.ts';
import { combatTarget,combatTargetByKey,mechanoidEnemy,type LivingTarget } from './combat-target.ts';
export { mechanoidEnemy } from './combat-target.ts';
import { cancelMechanoidRanged } from './mechanoid-ranged-state.ts';
import { empMechanoidActive } from './emp-state.ts';
import { advanceMechanoidRanged,admitMechanoidRangedOrder,mechanoidGunAvailable,mechanoidRangedQueries,planMechanoidRangedPost,type MechanoidRangedQueries } from './mechanoid-ranged.ts';
import { meleeContact,meleeTargetContact,meleePlaces,structureMeleeCell,captureMeleePlaces } from './melee-space.ts';
import { captureWorldShotGrid } from './combat-world.ts';
import { clearShotSegment,type ShotGrid } from './combat-space.ts';
import { candidateAccess } from './candidate-access.ts';
import { canStep,routeToCell,blockedCells } from './pathfinding.ts';
import { raidRoute } from './raid-space.ts';
import { damageStructure } from './thing-damage.ts';
import { isBarrier } from './barriers.ts';
import { distanceSquared } from './affiliation.ts';
import { healthRandom } from './health.ts';
import { strikeLivingTarget } from './living-melee.ts';
import { furnitureDelay } from './furniture-travel.ts';
import { weatherMoveFactor } from './weather-exposure.ts';
import { edgeLength,mergeSlowIntervals,travelEnd,type TravelSegment } from './travel-timing.ts';
import type { NavigationGrid,SearchBudget } from './work-planner.ts';
import type { CandidateAccess } from './navigation-types.ts';
import type { LightReader } from './light-environment.ts';
import type { Mechanoid } from './mechanoid-state.ts';
import type { Cell,World } from './types.ts';

export interface MechanoidCombatBatch { blocked():Uint8Array;grid():ShotGrid;afterImpact?():void;targets?():readonly LivingTarget[];ranged?:MechanoidRangedQueries }
/** One caller-owned unchanged decision/batch; never retained across ticks. */
export function mechanoidCombatBatch(w:World,getBlocked:NavigationGrid=()=>blockedCells(w,true)):MechanoidCombatBatch {
  let grid:ShotGrid|undefined,targets:LivingTarget[]|undefined;
  const read=()=>grid??=captureWorldShotGrid(w);
  return {blocked:getBlocked,grid:read,targets:()=>targets??=[...w.pawns,...(w.wildlife?.animals??[])],ranged:mechanoidRangedQueries(w,read,getBlocked)};
}
export const readMechRaid=mechanicalDuty256;
export function mechanoidMeleeTools(m:Mechanoid):MeleeTool[] {
  const tools:MeleeTool[]=[];
  if(m.mechKind!=='scyther'){
    const model=mechanoidBodyModel(m.mechKind),record=m.health;
    const efficiencies=bodyEfficiencies({damage:record?.injuries.map(i=>({part:i.part,loss:i.severity/HP_UNIT}))??[],missing:record?.missing.map(p=>p.part)??[],pain:0},model);
    const add=(id:MeleeTool['id'],damage:number,kind:MeleeTool['kind'],cooldownCore=120,factor=1)=>tools.push({id,damage,kind,penetration:damage*.015,cooldownCore,weight:damage*(1+damage*.015)/(cooldownCore/60)*factor});
    for(const side of ['left','right'] as const){
      const group=m.mechKind==='lancer'?`${side}-hand`:`front-${side}-leg`;
      const parts=model.parts.filter(p=>p.groups.some(g=>g===group)&&(!record||!partMissing(record,p.id)));
      const efficiency=parts.length?parts.reduce((n,p)=>n+efficiencies[model.index[p.id]]!,0)/parts.length:0;
      if(efficiency>0)add(`${side}-fist`,12*efficiency,'blunt');
    }
    const head=mechanoidDefinition(m.mechKind).headPart;
    if(!record||!partMissing(record,head))add('head',8.5*Math.max(.4,efficiencies[model.index[head]]!),'blunt',120,.2);
    if(mechaAssessment(m).capacities.manipulation>0){const cooldown=m.mechKind==='pikeman'?156:120;
      add('barrel',9,'blunt',cooldown);add('barrel-poke',9,'poke',cooldown);}
    return rankMeleeTools(tools);
  }
  for(const side of ['left','right'] as const)if(!m.health||!partMissing(m.health,`scyther-${side}-blade`))
    for(const kind of ['cut','stab'] as const)tools.push({id:`${side}-blade-${kind}`,kind,damage:20,penetration:.3,cooldownCore:120,weight:20*1.3/2});
  // The Core head tool is always usable as a linked tool, independent of hands.
  tools.push({id:'head',kind:'blunt',damage:9,penetration:.135,cooldownCore:120,weight:9*1.135/2*.2});
  return rankMeleeTools(tools);
}
const EMPTY:ReadonlySet<number>=new Set();
function present(w:World,m:Mechanoid,core:number):LivingTarget|undefined {
  const order=m.melee?.order;if(!order||order.structure||core>=order.jobUntilCore!)return;
  const t=combatTarget(w,order.targetId);return t&&mechanoidEnemy(w,m,t)&&distanceSquared(m,t)<=72**2?t:undefined;
}
/** Acquisition uses actual populations and one supplied pair/navigation budget.
 * Null means incomplete; it never commits a target or consumes randomness. */
function acquire(w:World,m:Mechanoid,budget:SearchBudget,batch:MechanoidCombatBatch):{target?:LivingTarget;path?:Cell[];access?:CandidateAccess}|null {
  if(!budget.remaining)return null;
  const candidates:LivingTarget[]=[];
  for(const t of [...w.pawns,...(w.wildlife?.animals??[])]){
    if(budget.pairs<=0)return null;budget.pairs--;
    if(!mechanoidEnemy(w,m,t)||distanceSquared(m,t)>65**2)continue;
    if(budget.pairs<=0)return null;budget.pairs--;
    if(clearShotSegment(batch.grid(),m,t))candidates.push(t);
  }
  if(!candidates.length)return {};
  budget.remaining--;
  const places=captureMeleePlaces(w,m),reach=candidateAccess(w,m,batch.blocked(),EMPTY,true);
  candidates.sort((a,b)=>distanceSquared(m,a)-distanceSquared(m,b)||a.id-b.id);
  for(const target of candidates){
    if(meleeContact(w,m,target,batch.blocked()))return {target,path:[],access:reach};
    for(const cell of places(target))if(reach.has(cell.z*w.width+cell.x)){const path=routeToCell(w,cell,reach);if(path)return {target,path,access:reach};}
  }
  return {access:reach};
}
function travel(w:World,m:Mechanoid,next:Cell,getLight:LightReader,blocked:Uint8Array):boolean {
  if(!canStep(w,m,next,blocked,EMPTY))return false;
  const moving=mechaAssessment(m).capacities.moving;if(moving<=.15)return false;
  const speedFactor=mechanoidDefinition(m.mechKind).moveSpeed/4.6*moving*(glowAppliesToMechanoids(w)?getLight().speedAt(m):1)*weatherMoveFactor(w,m);
  const start=m.motion&&m.motion.end>=w.tick-1?m.motion.end:w.tick,terrainDelay=furnitureDelay(w,m,next);
  const motion:TravelSegment={from:{x:m.x,z:m.z},to:{...next},start,end:start+3*edgeLength(m,next)/speedFactor+terrainDelay,speedFactor,...terrainDelay?{terrainDelay}:{}};
  if(m.stagger&&m.stagger.untilCore/10>start)motion.stagger=mergeSlowIntervals([{start:Math.max(start,m.stagger.sinceCore/10),end:m.stagger.untilCore/10}]);
  if(m.stun&&m.stun.untilCore/10>start)motion.stuns=mergeSlowIntervals([{start:Math.max(start,m.stun.sinceCore/10),end:m.stun.untilCore/10}]);
  motion.end=travelEnd(motion);m.heading=Math.atan2(next.x-m.x,next.z-m.z);m.motion=motion;m.x=next.x;m.z=next.z;
  m.moveCooldown=Math.max(0,motion.end-w.tick);m.path.shift();m.state='moving';return true;
}
/** Physical decisions share the caller's terrain/light and acquisition capture. */
export function processMechanoidCombat(w:World,m:Mechanoid,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader,batch=mechanoidCombatBatch(w,getBlocked)):void {
  const casketCarrier=shipCasketCarrierOf277(w,{kind:'mechanical',id:m.id});if(casketCarrier){syncShipCasketPassenger277(w,casketCarrier);return;}
  if(m.filthFeet&&m.motion&&m.motion.end>w.tick-1&&m.motion.end<=w.tick)recordShipCasketFilthMovement277(w,m);
  if(sleepingTempleMech256(m))return;
  m.moveCooldown=Math.max(0,(m.motion?.end??w.tick)-w.tick);m.planCooldown=Math.max(0,m.planCooldown-1);
  if(empMechanoidActive(m,w.tick*10))return;
  if(m.melee?.order&&!m.melee.order.structure&&w.tick*10>=m.melee.order.jobUntilCore!){cancelMelee(m);m.path=[];}
  if(m.ranged?.order&&w.tick*10>=m.ranged.order.jobUntilCore){cancelMechanoidRanged(m);m.path=[];if(mechanicalOrder256(m))mechanicalOrder256(m)!.goal=null;}
  if(m.moveCooldown)return;
  if(m.state==='dead'||m.state==='downed')return;
  const group=readMechRaid(w,m);if(!group){cancelMelee(m);cancelMechanoidRanged(m);m.path=[];m.state='idle';return;}
  const core=w.tick*10;
  if(m.melee?.strike||m.stun&&m.stun.untilCore>core){m.path=[];m.state='idle';return;}
  const q=batch.ranged??mechanoidRangedQueries(w,batch.grid,batch.blocked);
  if(m.ranged?.stance){m.state='idle';return;}
  if(m.ranged?.order){
    const order=m.ranged.order,target=combatTargetByKey(w,order.targetKey),end=m.path.at(-1)??m;
    if(!target||!mechanoidEnemy(w,m,target)||distanceSquared(m,target)>72**2||!mechanoidGunAvailable(w,m,core,q)
      ||!q.stands()(end)){
      cancelMechanoidRanged(m);m.path=[];mechanicalOrder256(m)!.goal=null;
    }else{
      const step=m.path[0];if(step&&!travel(w,m,step,getLight,getBlocked())){cancelMechanoidRanged(m);m.path=[];mechanicalOrder256(m)!.goal=null;m.planCooldown=0;m.state='idle';}
      else if(!step)m.state='idle';return;
    }
  }
  let target:LivingTarget|import('./types.ts').Structure|undefined=m.melee?.order?.structure?w.structures.find(s=>s.id===m.melee!.order!.targetId&&isBarrier(s)):present(w,m,core);
  if(m.melee?.order&&!target){cancelMelee(m);m.path=[];mechanicalOrder256(m)!.goal=null;}
  let searched=false,access:CandidateAccess|undefined;
  if(m.mechKind!=='scyther'&&!target&&!m.planCooldown&&mechanoidGunAvailable(w,m,core,q)){
    const plan=planMechanoidRangedPost(w,m,budget,batch,q,reach=>{access=reach;});
    if(plan===null)return;
    searched=true;m.planCooldown=20;
    if(plan&&admitMechanoidRangedOrder(w,m,plan,core,q)){
      const step=m.path[0];if(step&&!travel(w,m,step,getLight,getBlocked())){cancelMechanoidRanged(m);m.path=[];mechanicalOrder256(m)!.goal=null;m.planCooldown=0;m.state='idle';}
      else if(!step)m.state='idle';return;
    }
  }
  if(!target&&!m.planCooldown&&!searched){
    const plan=acquire(w,m,budget,batch);
    if(plan!==null){searched=true;access=plan.access;m.planCooldown=20;if(plan.target){const draft={rng:w.rng};m.melee={order:{targetId:plan.target.id,startedDowned:false,jobUntilCore:core+360+Math.floor(healthRandom(draft)*121)},strike:null};w.rng=draft.rng;m.path=plan.path!;target=plan.target;mechanicalOrder256(m)!.goal=null;}}
  }
  if(target){
    if(meleeTargetContact(w,m,target,batch.blocked())){m.path=[];m.state='idle';return;}
    const end=m.path.at(-1),safe=!!m.path[0]&&canStep(w,m,m.path[0],getBlocked(),EMPTY);
    if(!safe||!end||!meleeTargetContact(w,end,target,batch.blocked())){
      if(budget.remaining&&!m.planCooldown){budget.remaining--;m.planCooldown=20;const places=meleePlaces(w,m,target),reach=candidateAccess(w,m,getBlocked(),EMPTY,true);let path:Cell[]|null=null;
        for(const cell of places)if(reach.has(cell.z*w.width+cell.x)){path=routeToCell(w,cell,reach);if(path)break;}
        if(path)m.path=path;else{cancelMelee(m);m.path=[];m.state='idle';return;}
      }else if(!safe){m.path=[];m.state='idle';return;}
    }
  }else if(!m.path.length){
    if(!access&&(!budget.remaining||m.planCooldown&&!searched)){m.state='idle';return;}
    if(!access)budget.remaining--;m.planCooldown=20;
    if(group.phase==='staging'){
      const point=group.stage.point,reach=access??candidateAccess(w,m,getBlocked(),EMPTY,true),path=reach.has(point.z*w.width+point.x)?routeToCell(w,point,reach):null;
      if(!path){m.state='idle';return;}m.path=path;mechanicalOrder256(m)!.goal={...point};
    }else{
      const route=raidRoute(w,m,false,getBlocked(),access);if(!route){m.state='idle';mechanicalOrder256(m)!.goal=null;return;}
      m.path=route.path;mechanicalOrder256(m)!.goal=route.goal;
      if(route.barrier)m.melee={order:{targetId:route.barrier.id,startedDowned:false,structure:true},strike:null};
    }
  }
  const step=m.path[0];if(step&&!travel(w,m,step,getLight,getBlocked())){m.path=[];mechanicalOrder256(m)!.goal=null;m.planCooldown=0;m.state='idle';}else if(!step)m.state='idle';
}
/** Called exactly once/Core by the common owner scheduler; no second clock. */
export function advanceMechanoidCombat(w:World,m:Mechanoid,core:number,batch=mechanoidCombatBatch(w)):boolean {
  if(sleepingTempleMech256(m))return false;
  if(m.stun&&core>=m.stun.untilCore)delete m.stun;if(m.stagger&&core>=m.stagger.untilCore)delete m.stagger;
  const recovery=m.melee?.strike,pause=recovery?.empPause;
  if(recovery&&pause&&core>pause.lastAtCore){
    if(core!==pause.lastAtCore+1)throw new Error('Stale EMP mechanical recovery clock');
    pause.lastAtCore=core;
    if(empMechanoidActive(m,core)){recovery.untilCore++;pause.ticks++;}
  }
  if(m.melee?.strike&&core>=m.melee.strike.untilCore)m.melee.strike=null;
  if(m.melee?.order&&!m.melee.order.structure&&core>=m.melee.order.jobUntilCore!){cancelMelee(m);m.path=[];}
  advanceMechanoidRanged(w,m,core,batch.ranged??mechanoidRangedQueries(w,batch.grid,batch.blocked));
  if(m.ranged?.stance)return false;
  const melee=m.melee;if(!melee)return false;
  if(!melee.order&&!melee.strike){delete m.melee;return false;}
  if(shipCasketCarrierOf277(w,{kind:'mechanical',id:m.id})||m.state==='dead'||m.state==='downed'||m.stun&&core<m.stun.untilCore||empMechanoidActive(m,core)||melee.strike||(m.motion?.end??0)>core/10)return false;
  const group=readMechRaid(w,m);if(!group){cancelMelee(m);m.path=[];return false;}
  if(melee.order?.structure){
    const target=w.structures.find(s=>s.id===melee.order!.targetId&&isBarrier(s));
    if(!target||group.phase!=='assault'){cancelMelee(m);m.path=[];return false;}
    const cell=structureMeleeCell(w,m,target,batch.blocked());if(!cell)return false;
    const draft={rng:w.rng},draw=()=>healthRandom(draft),tool=chooseMeleeTool(mechanoidMeleeTools(m),draw);if(!tool)return false;
    const raw=Math.max(1,tool.damage*(.8+draw()*.4)),floor=Math.floor(raw),amount=floor+Number(draw()<raw-floor);
    const order=melee.order;
    if(!damageStructure(w,target,amount,'melee',draft.rng,{core,rawAmount:amount,instigatorKey:`mech:${m.id}`}))return false;
    if(['dead','downed'].includes(m.state))return true;
    m.melee={order:w.structures.includes(target)?order:null,strike:{targetId:target.id,structure:{...cell},atCore:core,untilCore:core+tool.cooldownCore,tool:tool.id,outcome:'hit'}};
    m.path=[];m.state='idle';batch.afterImpact?.();return true;
  }
  const target=present(w,m,core);if(!target){cancelMelee(m);m.path=[];return false;}
  if((target.motion?.end??0)>core/10||!meleeContact(w,m,target,batch.blocked()))return false;
  const draft={rng:w.rng},tool=chooseMeleeTool(mechanoidMeleeTools(m),()=>healthRandom(draft));if(!tool)return false;
  strikeLivingTarget(w,m,target,tool,core,draft);batch.afterImpact?.();return true;
}
