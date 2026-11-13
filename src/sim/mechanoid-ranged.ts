import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297} from './core-phase-297.ts';
import {mechanicalDuty256,mechanicalOrder256} from './temple-mech-duty-256.ts';
import { combatTargetByKey,combatTargetKey,combatTargetSize,isAnimalTarget,mechanoidEnemy,meleeThreatTarget,type LivingTarget,type LivingTargetKey } from './combat-target.ts';
import { clearShotSegment,findShotLine,type ShotGrid } from './combat-space.ts';
import { captureWorldProjectileTargets } from './projectile-world.ts';
import { captureStandability } from './furniture-travel.ts';
import { candidateAccess } from './candidate-access.ts';
import { blockedCells,canStep,canStopAt,routeToCell } from './pathfinding.ts';
import { distanceSquared } from './affiliation.ts';
import { mechaAssessment,type MechanicalBody } from './mechanoid-health.ts';
import { mechanoidGunId,mechanoidRangedProfile } from './mechanoid-ranged-profile.ts';
import { cancelMechanoidRanged } from './mechanoid-ranged-state.ts';
import { cancelMelee } from './melee-state.ts';
import { empMechanoidActive } from './emp-state.ts';
import { shootingAccuracy } from './ranged-statistics.ts';
import { shotAim,shotCover } from './combat-report.ts';
import { weatherShotFactor } from './weather-exposure.ts';
import { friendlyFireFactor } from './game-profile.ts';
import { emitRevolverBullet } from './bullet-emission.ts';
import { registerWorldProjectile } from './projectile-system.ts';
import { healthRandom } from './health.ts';
import type { BodyAssessment } from './body-capacities.ts';
import type { MechanoidCombatBatch } from './mechanoid-combat.ts';
import type { Mechanoid } from './mechanoid-state.ts';
import type { CandidateAccess } from './navigation-types.ts';
import type { SearchBudget } from './work-planner.ts';
import type { Cell,World } from './types.ts';

const EMPTY:ReadonlySet<number>=new Set();
export interface MechanoidRangedQueries {
  grid():ShotGrid;blocked():Uint8Array;targets():ReturnType<typeof captureWorldProjectileTargets>;
  stands():ReturnType<typeof captureStandability>;body(owner:Mechanoid):BodyAssessment;
}
/** One caller-owned synchronous capture, discarded after every real impact. */
export function mechanoidRangedQueries(w:World,readGrid:()=>ShotGrid,readBlocked=()=>blockedCells(w,true)):MechanoidRangedQueries {
  let targets:ReturnType<typeof captureWorldProjectileTargets>|undefined,stands:ReturnType<typeof captureStandability>|undefined;
  const bodies=new Map<Mechanoid,BodyAssessment>();
  return {grid:readGrid,blocked:readBlocked,targets:()=>targets??=captureWorldProjectileTargets(w),stands:()=>stands??=captureStandability(w),
    body:m=>{let body=bodies.get(m);if(!body){body=mechaAssessment(m);bodies.set(m,body);}return body;}};
}
export const mechanoidShootingAccuracy=(m:MechanicalBody):{score:number;perCell:number}=>{
  const c=mechaAssessment(m).capacities;return shootingAccuracy(8,c.sight,c.manipulation);
};
export function mechanoidGunAvailable(w:World,m:Mechanoid,core:number,q:MechanoidRangedQueries):boolean {
  if(w.schemaVersion<197||!w.mechanoids?.includes(m)||!mechanoidRangedProfile(m.mechKind)
    ||['dead','downed'].includes(m.state)||m.health?.death||q.body(m).capacities.manipulation<=0)return false;
  const threat=meleeThreatTarget(w,m,core,q.grid());
  return !threat||Math.max(Math.abs(threat.x-m.x),Math.abs(threat.z-m.z))>1;
}
export function planMechanoidShot(w:World,m:Mechanoid,key:LivingTargetKey,q:MechanoidRangedQueries,
  stage:'admission'|'warmup'|'emission',core=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10) {
  const profile=mechanoidRangedProfile(m.mechKind),target=combatTargetByKey(w,key);
  if(!profile||!target||!mechanoidEnemy(w,m,target)||distanceSquared(m,target)>72**2)return {reason:'Cible mécanique absente ou invalide.'} as const;
  if(stage!=='warmup'&&!mechanoidGunAvailable(w,m,core,q))return {reason:'Canon mécanique indisponible.'} as const;
  if(!q.stands()(m))return {reason:'Poste de tir non stable.'} as const;
  const line=findShotLine(q.grid(),m,{cell:target,leans:!isAnimalTarget(target)&&!['downed','resting','sleeping'].includes(target.state)},profile.range);
  if(!line.ok)return {reason:line.reason==='range'?'Cible hors portée.':'Ligne de tir bloquée.'} as const;
  return {target,profile,line} as const;
}
export type MechanoidShotPlan=Extract<ReturnType<typeof planMechanoidShot>,{target:LivingTarget}>;
export interface MechanoidRangedPost {targetKey:LivingTargetKey;cell:Cell;path:Cell[]}

/** Distance²/ID and nearest usable post are declared local adaptations. One
 * supplied search serves every candidate and the subsequent duty fallback.
 * No map capture is owned by a machine, and no incomplete scan commits RNG. */
export function planMechanoidRangedPost(w:World,m:Mechanoid,budget:SearchBudget,batch:MechanoidCombatBatch,
  q:MechanoidRangedQueries,onAccess?:(access:CandidateAccess)=>void):MechanoidRangedPost|null|undefined {
  if(!mechanoidGunAvailable(w,m,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10,q))return;
  const profile=mechanoidRangedProfile(m.mechKind)!,group=mechanicalDuty256(w,m);
  const candidates:LivingTarget[]=[];
  for(const t of batch.targets?.()??[...w.pawns,...(w.wildlife?.animals??[])]){
    if(budget.pairs<=0)return null;budget.pairs--;
    if(!mechanoidEnemy(w,m,t)||distanceSquared(m,t)>65**2)continue;
    if(budget.pairs<=0)return null;budget.pairs--;
    if(clearShotSegment(q.grid(),m,t))candidates.push(t);
  }
  candidates.sort((a,b)=>distanceSquared(m,a)-distanceSquared(m,b)||a.id-b.id);
  if(!candidates.length)return;
  const target=candidates[0]!,withinDuty=(c:Cell)=>group?.phase!=='staging'||distanceSquared(c,group.stage.point)<=28**2;
  // A shot from the current post needs no route or navigation admission.
  // Complete target ranking and its pair debit still precede that decision.
  if(budget.pairs<=0)return null;budget.pairs--;
  const current=planMechanoidShot(w,m,combatTargetKey(target),q,'admission');
  if(!('reason' in current)&&withinDuty(m))return {targetKey:combatTargetKey(target),cell:{x:m.x,z:m.z},path:[]};
  // Reserve a whole bounded post scan, avoiding a query that can never finish.
  const r=Math.ceil(profile.range),maxPosts=Math.min(w.width,2*r+1)*Math.min(w.height,2*r+1);
  if(!budget.remaining||budget.pairs<maxPosts)return null;
  budget.remaining--;
  const access=candidateAccess(w,m,batch.blocked(),EMPTY,true);onAccess?.(access);
  // Selection is complete before consulting a post for the chosen nearest
  // visible enemy. All candidates participate in that declared local ranking.
  {
    const posts:Cell[]=[];
    for(let z=Math.max(0,target.z-r);z<=Math.min(w.height-1,target.z+r);z++)for(let x=Math.max(0,target.x-r);x<=Math.min(w.width-1,target.x+r);x++){
      if(budget.pairs<=0)return null;budget.pairs--;
      const c={x,z};if(distanceSquared(c,target)>profile.range**2||!withinDuty(c)||!canStopAt(w,c,access)
        ||!q.stands()(c)||!access.has(z*w.width+x))continue;
      const line=findShotLine(q.grid(),c,{cell:target,leans:!isAnimalTarget(target)&&!['resting','sleeping'].includes(target.state)},profile.range);
      if(line.ok)posts.push(c);
    }
    posts.sort((a,b)=>distanceSquared(m,a)-distanceSquared(m,b)||a.z*w.width+a.x-b.z*w.width-b.x);
    const cell=posts[0];if(cell){const path=routeToCell(w,cell,access);if(path)return {targetKey:combatTargetKey(target),cell,path};}
  }
}

/** Intent may contain a route; no aim or random result is preplayed. */
export function admitMechanoidRangedOrder(w:World,m:Mechanoid,plan:MechanoidRangedPost,core:number,q:MechanoidRangedQueries):boolean {
  if(core!==(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10)||!Number.isSafeInteger(core+550)||m.ranged||m.melee?.strike||(m.motion?.end??0)>(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveLocal297(w):w.tick)
    ||m.stun&&core<m.stun.untilCore||empMechanoidActive(m,core)
    ||!mechanoidGunAvailable(w,m,core,q)||!mechanicalDuty256(w,m))return false;
  const target=combatTargetByKey(w,plan.targetKey),profile=mechanoidRangedProfile(m.mechKind)!;
  const group=mechanicalDuty256(w,m)!;
  if(!target||!mechanoidEnemy(w,m,target)||distanceSquared(m,target)>72**2||!q.stands()(plan.cell)
    ||group.phase==='staging'&&distanceSquared(plan.cell,group.stage.point)>28**2
    ||!findShotLine(q.grid(),plan.cell,{cell:target,leans:!isAnimalTarget(target)&&!['resting','sleeping'].includes(target.state)},profile.range).ok)return false;
  let previous:Cell&{id:number}=m;for(const cell of plan.path){if(!canStep(w,previous,cell,q.blocked(),EMPTY))return false;previous={...cell,id:m.id};}
  if(previous.x!==plan.cell.x||previous.z!==plan.cell.z)return false;
  const random={rng:w.rng},jobUntilCore=core+450+Math.floor(healthRandom(random)*101);
  cancelMelee(m);m.ranged={order:{targetKey:plan.targetKey,admittedAtCore:core,jobUntilCore},stance:null};
  m.path=plan.path.map(c=>({...c}));mechanicalOrder256(m)!.goal={...plan.cell};w.rng=random.rng;
  beginWarmup(w,m,core,q);
  return true;
}
function beginWarmup(w:World,m:Mechanoid,core:number,q:MechanoidRangedQueries):void {
  const state=m.ranged,order=state?.order;
  if(!state||!order||core<order.admittedAtCore||m.melee?.strike||(m.motion?.end??0)>core/10||m.path.length
    ||m.stun&&core<m.stun.untilCore||empMechanoidActive(m,core))return;
  const plan=planMechanoidShot(w,m,order.targetKey,q,'admission',core);
  if('reason' in plan){cancelMechanoidRanged(m);return;}
  state.stance={phase:'warmup',targetKey:order.targetKey,targetStartedDowned:plan.target.state==='downed',
    startedAtCore:core,lastAdvancedAtCore:core,remainingCore:plan.profile.warmupCoreTicks};m.state='idle';
  m.heading=Math.atan2(plan.target.x-m.x,plan.target.z-m.z);
}
/** Reconciliation after an impact never advances a stance. It closes the
 * final-substep publication boundary while keeping Core's stunned checks paused. */
export function reconcileMechanoidRanged(w:World,m:Mechanoid,core:number,q:MechanoidRangedQueries):void {
  const state=m.ranged;if(!state?.order||core<state.order.admittedAtCore||m.stun&&core<m.stun.untilCore||empMechanoidActive(m,core))return;
  const target=combatTargetByKey(w,state.order.targetKey);
  const invalid=!target||!mechanoidEnemy(w,m,target)||distanceSquared(m,target)>72**2;
  const lostAim=state.stance?.phase==='warmup'&&('reason' in planMechanoidShot(w,m,state.stance.targetKey,q,'warmup',core));
  if(invalid||lostAim){cancelMechanoidRanged(m);m.path=[];if(mechanicalOrder256(m))mechanicalOrder256(m)!.goal=null;}
}
/** Tick only the stance present at entry. Stun advances the checkpoint watermark
 * but never a timer; a newly installed cooldown stays full until the next Core. */
export function advanceMechanoidRanged(w:World,m:Mechanoid,core:number,q:MechanoidRangedQueries):void {
  const state=m.ranged;if(!state)return;
  if(state.order&&core>=state.order.jobUntilCore){cancelMechanoidRanged(m);m.path=[];if(mechanicalOrder256(m))mechanicalOrder256(m)!.goal=null;}
  if(!m.ranged)return;
  reconcileMechanoidRanged(w,m,core,q);
  if(!m.ranged)return;
  const stance=state.stance;
  if(!stance){beginWarmup(w,m,core,q);return;}
  if(core<=stance.lastAdvancedAtCore)return;
  if(core!==stance.lastAdvancedAtCore+1)throw new Error('Stale mechanical stance clock');
  stance.lastAdvancedAtCore=core;
  if(m.stun&&core<m.stun.untilCore||empMechanoidActive(m,core))return;
  if(stance.phase==='cooldown'){
    if(--stance.remainingCore>0)return;
    state.stance=null;if(!state.order){delete m.ranged;return;}beginWarmup(w,m,core,q);return;
  }
  const order=state.order;if(!order){cancelMechanoidRanged(m);return;}
  const aim=planMechanoidShot(w,m,stance.targetKey,q,'warmup',core);
  if('reason' in aim||!stance.targetStartedDowned&&aim.target.state==='downed'){cancelMechanoidRanged(m);return;}
  m.heading=Math.atan2(aim.target.x-m.x,aim.target.z-m.z);
  if(--stance.remainingCore>0)return;
  const plan=planMechanoidShot(w,m,stance.targetKey,q,'emission',core),profile=mechanoidRangedProfile(m.mechKind)!;
  if(!('reason' in plan)){
    const {target,line}=plan,c=q.body(m).capacities,cover=shotCover(q.grid(),m,target,combatTargetKey(target));
    const report=shotAim({distance:line.distance,pawnAccuracy:shootingAccuracy(8,c.sight,c.manipulation).perCell,
      weaponAccuracy:profile.accuracy,targetSize:combatTargetSize(target,w.schemaVersion),standing:!['sleeping','resting','downed'].includes(target.state),
      weather:weatherShotFactor(w,m,target),blindSmoke:false},cover.passChance);
    const random={rng:w.rng},emission=emitRevolverBullet({grid:q.grid(),line,origin:{x:m.x+.5,z:m.z+.5},launcherKey:`mech:${m.id}`,equipmentKey:null,
      target:{key:combatTargetKey(target),cell:target,full:false,canBenefitFromCover:true},aim:report,cover,profile,canHitOtherPawns:true,
      preventFriendlyFire:false,coverAnchor:key=>q.targets().anchor(key)},()=>healthRandom(random));
    registerWorldProjectile(w,emission.flight,'normal',{friendlyPawnIds:[],friendlyTargetKeys:(w.mechanoids??[]).map(friend=>`mech:${friend.id}` as const),
      friendlyFireFactor:friendlyFireFactor(w)},random.rng,core,mechanoidGunId(m.mechKind)!);
  }
  state.stance={phase:'cooldown',targetKey:stance.targetKey,startedAtCore:core,lastAdvancedAtCore:core,remainingCore:profile.cooldownCoreTicks};
}
