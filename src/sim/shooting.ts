import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import { huntingPermission } from './hunting-state.ts';
import { violentWorkRefusal } from './colonist-backgrounds.ts';
import { weatherShotFactor } from './weather-exposure.ts';
import { friendlyFireFactor } from './game-profile.ts';
import { combatTarget,combatTargetKey,combatTargetSize,hostileTarget,isAnimalTarget,isPawnTarget,type LivingTarget } from './combat-target.ts';
import { automaticPermission,automaticTarget } from './automatic-combat-state.ts';
import { cancelMelee } from './melee-state.ts';
import { isStunned } from './stun.ts';
import { assaultTarget,hostileTo,isColonist,distanceSquared } from './affiliation.ts';
import type { CommandResult,Pawn,World } from './types.ts';
import type { ShootingCommand } from './shooting-state.ts';
import { advanceShootingClock,cancelShooting,shootingOrderAuthority } from './shooting-state.ts';
import { equippedWeapon,isRangedWeaponItem } from './equipment-rules.ts';
import { pawnBody,medicallyStopped } from './health-rules.ts';
import { captureWorldShotGrid } from './combat-world.ts';
import { captureWorldProjectileTargets } from './projectile-world.ts';
import { findShotLine } from './combat-space.ts';
import { shotAim,shotCover } from './combat-report.ts';
import { emitRevolverBullet,type BulletEmissionInput } from './bullet-emission.ts';
import { emitEmpProjectile } from './emp-emission.ts';
import { registerWorldProjectile } from './projectile-system.ts';
import { CORE_TICKS_PER_LOCAL,rangedWeaponProfile,shootingAccuracy,rangedTimings } from './ranged-statistics.ts';
import { learnSkill,XP_SCALE } from './skills.ts';
import { healthRandom } from './health.ts';
import { captureStandability } from './furniture-travel.ts';

/** Captures are shared only during this synchronous, unchanged decision. */
export function shootingQueries(world:World,readGrid=()=>captureWorldShotGrid(world)) {
  let grid:ReturnType<typeof captureWorldShotGrid>|undefined,targets:ReturnType<typeof captureWorldProjectileTargets>|undefined;
  let stand:ReturnType<typeof captureStandability>|undefined,carried:Set<number>|undefined;
  const bodies=new Map<Pawn,ReturnType<typeof pawnBody>>();
  const body=(p:Pawn)=>{let b=bodies.get(p);if(!b){b=pawnBody(p);bodies.set(p,b);}return b;};
  return {body,carried:(id:number)=>(carried??=new Set(world.pawns.filter(p=>p.rescue?.phase==='carry').map(p=>p.rescue!.patientId))).has(id),grid:()=>grid??=readGrid(),targets:()=>targets??=captureWorldProjectileTargets(world),stands:()=>stand??=captureStandability(world)};
}
type Queries=ReturnType<typeof shootingQueries>;
export function shotPlan(world:World,pawn:Pawn,targetId:number,queries:Queries,automatic=pawn.shooting?.order?.auto?.kind) {
  const refusal=violentWorkRefusal(pawn);if(refusal)return {reason:refusal} as const;
  if(!pawn.draft&&isColonist(pawn)&&automatic!=='response'&&!huntingPermission(world,pawn,targetId)||automatic&&!automaticPermission(pawn,automatic)||medicallyStopped(pawn)||pawn.state==='sleeping'||pawn.need&&automatic!=='response'||pawn.collapsePending||queries.carried(pawn.id))return {reason:'Le tireur doit être mobilisé, éveillé et capable de tirer.'} as const;
  if(!queries.stands()(pawn))return {reason:'Le colon doit terminer le franchissement avant de viser.'} as const;
  const weapon=equippedWeapon(world,pawn);
  if(!weapon?.weapon||!isRangedWeaponItem(weapon.item)||pawn.equipmentDropPending||queries.body(pawn).capacities.manipulation<=0)return {reason:'Aucune arme à distance utilisable en main.'} as const;
  if(pawn.shooting?.order?.hunt&&weapon.item==='emp-launcher')return {reason:'Le lanceur EMP ne blesse pas les animaux : une arme de chasse est nécessaire.'} as const;
  const target=combatTarget(world,targetId);
  if(!target||target.id===pawn.id||target.state==='dead'||queries.carried(targetId))return {reason:'Cible absente ou invalide.'} as const;
  if(isAnimalTarget(target)&&target.domestic)return {reason:'Cet animal appartient à la colonie.'} as const;
  if(hostileTarget(pawn,target)&&target.state!=='downed'&&distanceSquared(pawn,target)<1.421**2)return {reason:'Un adversaire adjacent empêche le tir : utilisez la mêlée.'} as const;
  const profile=rangedWeaponProfile(weapon.item,weapon.weapon.quality)!,line=findShotLine(queries.grid(),pawn,{cell:target,leans:!isAnimalTarget(target)&&!['downed','resting','sleeping'].includes(target.state)},profile.range);
  if(!line.ok)return {reason:line.reason==='range'?'La cible est hors de portée.':'La ligne de tir est bloquée.'} as const;
  return {weapon,target,profile,line} as const;
}
function startAim(world:World,pawn:Pawn,core:number,queries:Queries):void {
  const order=pawn.shooting?.order;if(!order)return;
  if(isStunned(pawn,core)||pawn.melee?.strike||(pawn.motion?.end??0)*CORE_TICKS_PER_LOCAL>core)return;
  const plan=shotPlan(world,pawn,order.targetId,queries);
  if('reason' in plan||plan.weapon.id!==order.weaponId){cancelShooting(pawn);return;}
  pawn.shooting!.stance={phase:'aim',startedAtCore:core,endsAtCore:core+plan.profile.warmupCoreTicks,targetStartedDowned:plan.target.state==='downed',...plan.weapon.item!=='revolver'?{weaponItem:plan.weapon.item as 'bolt-action-rifle'|'emp-launcher'|'short-bow'}:{},
    ...world.schemaVersion>=198?{clock:{lastAdvancedAtCore:core,pausedCore:0}}:{},
    ...world.schemaVersion>=238&&(plan.line.from.x!==pawn.x||plan.line.from.z!==pawn.z)?{lean:{x:plan.line.from.x-pawn.x,z:plan.line.from.z-pawn.z}}:{}};
  pawn.state='idle';
}
export function applyShootingCommand(world:World,command:ShootingCommand):CommandResult {
  const reject=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!Array.isArray(command.pawnIds)||!command.pawnIds.length||command.pawnIds.some(id=>!Number.isSafeInteger(id))||new Set(command.pawnIds).size!==command.pawnIds.length||!Number.isSafeInteger(command.targetId))return reject('Ordre de tir invalide.');
  const queries=shootingQueries(world),plans=[];
  for(const id of [...command.pawnIds].sort((a,b)=>a-b)) {
    const pawn=world.pawns.find(p=>p.id===id);if(!pawn||!pawn.draft)return reject('Mobilisez le tireur.');
    const plan=shotPlan(world,pawn,command.targetId,queries);if('reason' in plan)return reject(`${pawn.name} : ${plan.reason}`);
    plans.push({pawn,plan});
  }
  // Atomic group acceptance. Preserve the captured edge and every cooldown.
  for(const {pawn,plan} of plans) {
    cancelMelee(pawn);const stance=pawn.shooting?.stance;
    pawn.shooting={order:{targetId:command.targetId,weaponId:plan.weapon.id,startedDowned:plan.target.state==='downed'},stance:stance?.phase==='cooldown'?stance:null};
    pawn.draft!.target=null;pawn.draft!.queue=[];pawn.draft!.lastActiveTick=world.tick;pawn.path=[];
    if(!pawn.shooting.stance)startAim(world,pawn,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):world.tick*CORE_TICKS_PER_LOCAL,queries);
  }
  return {ok:true};
}

export type ShootingPass='core'|'revalidate';
/** Core clock is shared with flight. Caller invalidates queries after an impact.
 * Commands may revalidate/start a stance, but cannot advance its busy clock. */
export function advanceShooter(world:World,pawn:Pawn,core:number,queries:Queries,pass:ShootingPass='revalidate'):void {
  const shot=pawn.shooting;if(!shot)return;
  if(violentWorkRefusal(pawn)||medicallyStopped(pawn)||queries.body(pawn).capacities.manipulation===0){delete pawn.shooting;return;}
  const suspendedClock=world.schemaVersion>=198,stunned=isStunned(pawn,core);
  if(suspendedClock){
    if(!shootingOrderAuthority(world,pawn))cancelShooting(pawn);
    if(!pawn.shooting)return;
    if(shot.order){const weapon=equippedWeapon(world,pawn);
      if(!weapon?.weapon||!isRangedWeaponItem(weapon.item)||weapon.id!==shot.order.weaponId||pawn.equipmentDropPending
        ||shot.stance?.phase==='aim'&&(shot.stance.weaponItem??'revolver')!==weapon.item
        ||pawn.state==='sleeping'||pawn.need&&shot.order.auto?.kind!=='response'||pawn.collapsePending||queries.carried(pawn.id))cancelShooting(pawn);
    }
    if(!pawn.shooting)return;
    if(pawn.draft)pawn.draft.lastActiveTick=world.tick;
    if(shot.stance&&pass==='core'){
      // Adoption is prospective at the previous publication; no past stun is repaid.
      shot.stance.clock??={lastAdvancedAtCore:core-1,pausedCore:0};
      if(advanceShootingClock(shot.stance,core,stunned)==='duplicate')return;
    }
    if(stunned&&shot.stance?.phase==='aim')return;
    if(shot.order&&(shot.order.hunt?!huntingPermission(world,pawn,shot.order.targetId)
      :shot.order.auto&&!automaticTarget(world,pawn,shot.order.targetId)))cancelShooting(pawn);
  }else if(shot.order){const a=shot.order.auto;if(shot.order.hunt?!huntingPermission(world,pawn,shot.order.targetId):a?(!automaticPermission(pawn,a.kind)||!automaticTarget(world,pawn,shot.order.targetId)||a.kind==='draft'&&pawn.draft?.holdFire||a.kind==='response'&&world.tick>=a.until):!pawn.draft&&isColonist(pawn))cancelShooting(pawn);}
  if(!pawn.shooting)return;
  if(shot.order) {
    const target=combatTarget(world,shot.order!.targetId);
    if(!target||target.state==='dead'||!shot.order.startedDowned&&target.state==='downed'||!isColonist(pawn)&&(!hostileTarget(pawn,target)||isAnimalTarget(target)||isPawnTarget(target)&&!assaultTarget(pawn,target)))cancelShooting(pawn);
    if(!pawn.shooting)return;
  }
  if(pawn.draft)pawn.draft.lastActiveTick=world.tick;
  if(suspendedClock&&stunned)return;
  if(suspendedClock&&pass==='revalidate'&&shot.stance){
    if(shot.stance.phase==='aim'&&shot.order){const plan=shotPlan(world,pawn,shot.order.targetId,queries);
      if('reason' in plan||plan.weapon.id!==shot.order.weaponId||!shot.stance.targetStartedDowned&&plan.target.state==='downed')cancelShooting(pawn);
    }
    return;
  }
  if(shot.stance?.phase==='cooldown') {
    if(core<shot.stance.endsAtCore)return;
    shot.stance=null;if(shot.order?.auto?.kind==='response'&&shot.order.auto.remaining===0)shot.order=null;if(!shot.order){delete pawn.shooting;return;}
  }
  if(isStunned(pawn,core)||pawn.melee?.strike)return;
  if(!shot.stance){startAim(world,pawn,core,queries);return;}
  if(shot.stance.phase!=='aim'||!shot.order)return;
  const plan=shotPlan(world,pawn,shot.order.targetId,queries);
  if('reason' in plan||plan.weapon.id!==shot.order.weaponId||!shot.stance.targetStartedDowned&&plan.target.state==='downed'){cancelShooting(pawn);return;}
  if(core<shot.stance.endsAtCore)return;
  const {target,weapon,profile,line}=plan,standing=!['sleeping','resting','downed'].includes(target.state),body=queries.body(pawn).capacities;
  const cover=shotCover(queries.grid(),pawn,target,combatTargetKey(target));
  const aim=shotAim({distance:line.distance,pawnAccuracy:shootingAccuracy(pawn.skills.shooting.level,body.sight,body.manipulation).perCell,weaponAccuracy:profile.accuracy,targetSize:combatTargetSize(target),standing,weather:weatherShotFactor(world,pawn,target),blindSmoke:false},cover.passChance);
  const random={rng:world.rng};
  // The current18/102/210-Core warmups exceed Core lean saturation (14Core).
  // Capture the warmup offset, not the newly queried line. Legacy aims stay base.
  const lean=world.schemaVersion>=238?shot.stance.lean:undefined;
  const origin={x:pawn.x+.5+(lean?.x??0)*.5,z:pawn.z+.5+(lean?.z??0)*.5};
  const emissionInput:BulletEmissionInput={grid:queries.grid(),line,origin,launcherKey:`pawn:${pawn.id}`,equipmentKey:`pile:${weapon.id}`,target:{key:combatTargetKey(target),cell:target,full:false,canBenefitFromCover:true},aim,cover,profile,canHitOtherPawns:true,preventFriendlyFire:false,coverAnchor:key=>queries.targets().anchor(key)};
  // Forced-radius distance uses the logical pawn cell, independently of DrawPos.
  const emission=weapon.item==='emp-launcher'?emitEmpProjectile(emissionInput,()=>healthRandom(random),pawn):emitRevolverBullet(emissionInput,()=>healthRandom(random));
  registerWorldProjectile(world,emission.flight,profile.quality,{friendlyPawnIds:world.pawns.filter(p=>!hostileTo(pawn,p)).map(p=>p.id),friendlyFireFactor:friendlyFireFactor(world)},random.rng,core,weapon.item as 'revolver'|'bolt-action-rifle'|'emp-launcher');
  // Same projectile rules; only the documented hostile learning rate differs.
  if(target.state!=='downed')learnSkill(pawn.skills.shooting,(hostileTarget(pawn,target)?170:20)*rangedTimings(profile).learningCycleSeconds*XP_SCALE,pawn);
  pawn.lastAttack={targetId:target.id,atCore:core};
  if(shot.order.auto?.kind==='response')shot.order.auto.remaining--;
  if(shot.order.auto?.kind==='draft')shot.order=null;
  shot.stance={phase:'cooldown',startedAtCore:core,endsAtCore:core+profile.cooldownCoreTicks,...weapon.item!=='revolver'?{weaponItem:weapon.item as 'bolt-action-rifle'|'emp-launcher'|'short-bow'}:{},
    ...suspendedClock?{clock:{lastAdvancedAtCore:core,pausedCore:0}}:{}};
}

export function startAutonomousShot(world:World,pawn:Pawn,target:LivingTarget,queries:Queries):boolean {
  if(isColonist(pawn)||!hostileTarget(pawn,target)||isAnimalTarget(target)||isPawnTarget(target)&&!assaultTarget(pawn,target)||pawn.shooting)return false;
  const plan=shotPlan(world,pawn,target.id,queries);if('reason' in plan)return false;
  pawn.path=[];pawn.shooting={order:{targetId:target.id,weaponId:plan.weapon.id,startedDowned:false},stance:null};
  startAim(world,pawn,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):world.tick*CORE_TICKS_PER_LOCAL,queries);return !!pawn.shooting;
}
