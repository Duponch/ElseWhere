import {naturalArmor321,naturalArmorProtection321} from './natural-armor-321.ts';
import {meleeStunCore318} from './stun.ts';
import {combatTargetKey} from './combat-target.ts';
import {applyToxicBite256} from './toxic-buildup-256.ts';
import {animalBodySize} from './animal-life.ts';
import {toxicResistance256} from './toxic-victim-256.ts';
import {reconcileMedicalDeath} from './injury-state.ts';
import {requireAnimalDeathCapacity256} from './animal-death-explosion-v256.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import { isAnimalTarget,isMechanoidTarget,isPawnTarget,type LivingTarget } from './combat-target.ts';
import { apparelProtection } from './apparel-protection.ts';
import { disturbanceEvents,isLying } from './disturbance.ts';
import { healthRandom,reconcilePawnHealth,updatePawnHealth } from './health.ts';
import { pawnBody } from './health-rules.ts';
import { createMedicalRecord } from './injury-state.ts';
import { resolveUnarmoredMelee } from './melee-impact.ts';
import { meleeHitChance,mechaMeleeHitChance,meleeDodgeChance,type MeleeTool } from './melee-statistics.ts';
import { applyBulletStagger } from './stagger.ts';
import { applyMeleeStun,isStunned } from './stun.ts';
import { cancelShooting } from './shooting-state.ts';
import { learnSkill,XP_SCALE } from './skills.ts';
import { effectiveSkillLevel } from './work-types.ts';
import { advanceAnimalHealth,animalBody,commitAnimalImpact,delayAnimalImpact } from './wildlife-health.ts';
import type { World } from './types.ts';
import { cancelAnimalPredation } from './wildlife-predation.ts';
import { mechaAssessment,commitMechanoidImpact } from './mechanoid-health.ts';
import { delayMechanoidImpact,mechanoidProtection } from './mechanoid-impact.ts';

/** The same anatomical transaction serves both directions of interspecies
 * combat. Recovery is installed before injury can interrupt either actor. */
export function strikeLivingTarget(w:World,attacker:LivingTarget,target:LivingTarget,tool:MeleeTool,core:number,randomState:{rng:number},disturbance=disturbanceEvents(w),options:{surprise?:boolean;surpriseStun?:number;huntingForFood?:boolean}={}):void {
  if(isAnimalTarget(target))requireAnimalDeathCapacity256(w,target);
  const animal=isAnimalTarget(target),animalAttacker=isAnimalTarget(attacker),random=()=>healthRandom(randomState);
  if((w.schemaVersion>=192&&isPawnTarget(target)||w.schemaVersion>=197&&isMechanoidTarget(target))
    &&(!isPawnTarget(attacker)||attacker.melee?.order?.auto!=='social'))target.meleeThreat={attackerId:attacker.id,atCore:core};
  const immobile=isPawnTarget(target)?isLying(target):['downed','sleeping'].includes(target.state);
  if(isPawnTarget(attacker)&&!immobile)learnSkill(attacker.skills.melee,200*(tool.cooldownCore/60)*XP_SCALE,attacker);
  const body=(actor:LivingTarget)=>isAnimalTarget(actor)?animalBody(actor):isMechanoidTarget(actor)?mechaAssessment(actor):pawnBody(actor);
  const ac=body(attacker).capacities,dc=body(target).capacities;
  const accuracy=isMechanoidTarget(attacker)?mechaMeleeHitChance(ac.sight,ac.manipulation):meleeHitChance(isAnimalTarget(attacker)?4:effectiveSkillLevel(attacker,'melee',attacker.skills.melee.level),ac.sight,ac.manipulation);
  const hit=immobile||options.surprise||random()<accuracy;
  const dodge=hit&&!immobile&&!options.surprise&&(!isPawnTarget(target)||!target.shooting?.stance)
    &&(!isMechanoidTarget(target)||!target.ranged?.stance)&&random()<meleeDodgeChance(isPawnTarget(target)?effectiveSkillLevel(target,'melee',target.skills.melee.level):0,dc.moving,dc.sight);
  const outcome=!hit?'miss':dodge?'dodge':'hit';
  const strike={targetId:target.id,atCore:core,untilCore:core+tool.cooldownCore,tool:tool.id,outcome} as const;
  if(animalAttacker){attacker.strike=strike;delete attacker.retaliation;}else attacker.melee!.strike=strike;
  attacker.path=[];attacker.state='idle';
  // A miss still registers a nearby melee threat and wakes a wild animal.
  if(animal&&target.state!=='downed'){
    // A hunted animal can retaliate against its real animal attacker. A hunter
    // struck by its own prey keeps pursuing; a different melee threat supplants it.
    if(!target.manhunter&&target.predation?.targetId!==attacker.id){
      cancelAnimalPredation(w,target);target.threat={targetId:attacker.id,harmedAtCore:core};
    }
    delete target.exiting;
    target.sleepUntilCore=Math.max(target.sleepUntilCore??0,core+1000);
    delete target.meal;delete target.flee;target.path=[];target.state=target.motion&&target.motion.end>w.tick?'moving':'idle';target.nextDecision=w.tick;
  }
  let stun=false,injured=false;
  if(outcome==='hit'){
    const damage=Math.max(1,tool.damage*(.8+random()*.4));
    w.rng=randomState.rng;
    if(isAnimalTarget(target))advanceAnimalHealth(w,target);else if(isPawnTarget(target)&&(!target.health||target.health.tick<w.tick))updatePawnHealth(w,target);
    randomState.rng=w.rng;
    const category=['toxic-bite','bite','cut','stab','scratch'].includes(tool.kind)?'sharp':'blunt';
    const protection=isPawnTarget(target)?apparelProtection(w,target,category,tool.penetration,random):undefined;
    const record=target.health??(isAnimalTarget(target)?createAnimalMedicalRecord256(w,target):{...createMedicalRecord(w.tick),...(isMechanoidTarget(target)?{body:target.mechKind}:{})});
    const input=isMechanoidTarget(target)?{...structuredClone(record),tick:w.tick}:record;
    const natural=isAnimalTarget(target)&&w.schemaVersion>=321?naturalArmor321(target):undefined;
    const impact=resolveUnarmoredMelee(input,{damage,kind:tool.kind},random,isMechanoidTarget(target)?mechanoidProtection(category,tool.penetration,random,target.mechKind):natural?naturalArmorProtection321(natural,category,tool.penetration,random):protection?.protect,w.schemaVersion>=324);
    if(w.schemaVersion>=256&&tool.kind==='toxic-bite'&&!isMechanoidTarget(target)){applyToxicBite256(impact.record,impact.totalDamageDealt,isAnimalTarget(target)?animalBodySize(target):1,toxicResistance256(target),random,!!options.huntingForFood);reconcileMedicalDeath(impact.record);}
    protection?.commit();injured=impact.layers.length>0;stun=impact.stun;
    if(isAnimalTarget(target))commitAnimalImpact(w,target,impact.record,randomState,core,combatTargetKey(attacker));
    else if(isMechanoidTarget(target)){if(!commitMechanoidImpact(w,target,impact.record,randomState,core))throw new Error('Mechanical melee transaction refused');}
    else target.health=impact.record;
  }
  w.rng=randomState.rng;
  if(isAnimalTarget(target))delayAnimalImpact(target,core,stun||!!(options.surprise&&options.surpriseStun),
    options.surprise&&options.surpriseStun?Math.max(45,Math.round(options.surpriseStun*30)):meleeStunCore318(w.schemaVersion));
  else if(isMechanoidTarget(target))delayMechanoidImpact(w,target,core,stun);
  else {
    if(outcome==='hit'){reconcilePawnHealth(w,target,undefined,true);if(injured)disturbance.damage(target,core,immobile);}
    applyBulletStagger(w,target,core,1);if(stun)applyMeleeStun(w,target,core);
    if(target.shooting?.stance?.phase==='aim'&&(w.schemaVersion<198||!isStunned(target,core)))cancelShooting(target);
  }
  if(isPawnTarget(attacker))attacker.lastAttack={targetId:target.id,atCore:core};
}
