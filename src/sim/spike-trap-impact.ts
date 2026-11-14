import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import { seriesApparelProtection } from './apparel-protection.ts';
import { animalCarrier } from './animal-rest-state.ts';
import type { ConstructionMaterial } from './building-materials.ts';
import { combatTargetByKey,isAnimalTarget,isMechanoidTarget,type LivingTarget,type LivingTargetKey } from './combat-target.ts';
import { healthRandom,reconcilePawnHealth,updatePawnHealth } from './health.ts';
import { HumanOwnerError } from './human-owners.ts';
import { validateInterruptedCargo } from './interrupted-cargo.ts';
import { createMedicalRecord } from './injury-state.ts';
import { validateMedicalRecord,validateMechanoidMedicalRecord } from './injury-validation.ts';
import type { MedicalRecord } from './injury-types.ts';
import { resolveUnarmoredMelee,type MeleeImpactResult } from './melee-impact.ts';
import { createMechaMedicalRecord,commitMechanoidImpact } from './mechanoid-health.ts';
import { mechanoidProtection } from './mechanoid-impact.ts';
import { carrierOf } from './rescue-state.ts';
import { spikeTrapImpactProjection } from './spike-trap-impact-projection.ts';
import type { World } from './types.ts';
import { advanceAnimalHealth,commitAnimalImpact } from './wildlife-health.ts';

const SHARP:Partial<Record<ConstructionMaterial,number>>={wood:.4,steel:1,'sandstone-blocks':.5,'granite-blocks':.65,'limestone-blocks':.6,'slate-blocks':.6,'marble-blocks':.6};
export interface SpikeTrapImpactPlan {
  readonly key:LivingTargetKey;readonly atCore:number;readonly rngBefore:number;readonly rngAfter:number;
  readonly factor:number;readonly damage:number;readonly penetration:number;
  readonly impacts:readonly MeleeImpactResult[];readonly record:MedicalRecord;
  /** Compose structural loss against this prospective apparel-loss ledger. */
  readonly destroyedAfter:World['destroyed'];
}
const prepared=new WeakMap<SpikeTrapImpactPlan,{world:World;tick:number;core297?:number;adopt:()=>boolean}>();
const uint32=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
function invalidRecord(world:World,actor:LivingTarget,record:MedicalRecord):boolean {
  if(medicalCivilTick271(record)>world.tick)return true;
  return isMechanoidTarget(actor)?!!validateMechanoidMedicalRecord(record,world.schemaVersion,actor.mechKind):
    !!validateMedicalRecord(record,true,true,true,true,isAnimalTarget(actor),true,true,true,true,true,true,world.schemaVersion,true);
}

/** One shared uniform, then at most five sequential anatomical Stabs. The
 * chance controller can supply its private post-chance stream without writing
 * World.rng. The guard always retains the original World stream. No hit/dodge,
 * attacker, XP, ranged stagger, scare or corpse allocation is manufactured. */
export function planSpikeTrapImpact(world:World,key:LivingTargetKey,material:ConstructionMaterial,atCore:number,rngStart=world.rng):SpikeTrapImpactPlan|undefined {
  const multiplier=SHARP[material],target=combatTargetByKey(world,key);
  if(world.schemaVersion<226||multiplier===undefined||!target||target.state==='dead'||target.health?.death
    ||!uint32(world.rng)||!uint32(rngStart)||!Number.isSafeInteger(atCore)||(isCorePhysicalSchema297(Number(world.schemaVersion))?atCore!==effectiveCore297(world):atCore<Math.max(0,(world.tick-1)*10)||atCore>world.tick*10)
    ||isAnimalTarget(target)&&animalCarrier(world,target.id)||!isAnimalTarget(target)&&!isMechanoidTarget(target)&&carrierOf(world,target.id))return;
  if(target.health&&invalidRecord(world,target,target.health))return;
  try {
    const projection=spikeTrapImpactProjection(world),draft=projection.view,actor=combatTargetByKey(draft,key)!;
    draft.rng=rngStart;
    const factor=.8+.4*healthRandom(draft),damage=100*multiplier/5*factor,penetration=damage*.015;
    // Match the existing projectile/melee owner preparation on this isolated
    // view, including infection timing, medical rest and coupled release.
    if(isAnimalTarget(actor))advanceAnimalHealth(draft,actor);
    else if(isMechanoidTarget(actor))actor.health={...structuredClone(actor.health??createMechaMedicalRecord(draft.tick,actor.mechKind)),tick:draft.tick};
    else if(!actor.health||actor.health.tick<draft.tick)updatePawnHealth(draft,actor);
    actor.health??=isAnimalTarget(actor)?createAnimalMedicalRecord256(draft,actor):createMedicalRecord(draft.tick);
    const impacts:MeleeImpactResult[]=[];
    for(let n=0;n<5&&actor.state!=='dead'&&!actor.health.death;n++){
      const random={rng:draft.rng},draw=()=>healthRandom(random);
      const clothes=!isAnimalTarget(actor)&&!isMechanoidTarget(actor)?seriesApparelProtection(draft,actor,penetration,draw):undefined;
      const protect=isMechanoidTarget(actor)?mechanoidProtection('sharp',penetration,draw,actor.mechKind):clothes?.protect;
      const impact=resolveUnarmoredMelee(actor.health,{damage,kind:'stab'},draw,protect,draft.schemaVersion>=324);
      draft.rng=random.rng;
      clothes?.commit();
      // Releasing an equipment task can also release a carried patient whose
      // medical owner is due. Keep that real stream consumption in the group.
      random.rng=draft.rng;
      if(isAnimalTarget(actor))commitAnimalImpact(draft,actor,impact.record,random,atCore);
      else if(isMechanoidTarget(actor)){
        if(!commitMechanoidImpact(draft,actor,impact.record,random,atCore))return;
      }else {draft.rng=random.rng;actor.health=impact.record;reconcilePawnHealth(draft,actor,undefined,true);}
      impacts.push(impact);
      // Local domestic animals deliberately retain the historical .5 violent
      // death-on-downed roll; mechanical downed death is certain without RNG.
    }
    const record=actor.health;
    if(invalidRecord(world,actor,record)||validateInterruptedCargo(draft).length)return;
    const plan:SpikeTrapImpactPlan=Object.freeze({key,atCore,rngBefore:world.rng,rngAfter:draft.rng,factor,damage,penetration,
      impacts:Object.freeze(impacts.map(i=>structuredClone(i))),record:structuredClone(record),destroyedAfter:structuredClone(draft.destroyed)});
    prepared.set(plan,{world,tick:world.tick,...isCorePhysicalSchema297(Number(world.schemaVersion))?{core297:effectiveCore297(world)}:{},adopt:projection.finish().adopt});return plan;
  }catch(error){
    // Bounded record/ledger exhaustion and invalid ownership are a refused
    // transaction, never partial damage or consumption of the real stream.
    if(error instanceof RangeError||error instanceof HumanOwnerError||error instanceof Error&&[
      'Medical severity overflow','Medical identity exhausted','Medical impact capacity exhausted',
      'Infection exposure clock exhausted','Infection identities exhausted','Infection clock exhausted','Immune disease clock exhausted',
    ].includes(error.message))return;
    throw error;
  }
}

/** Adopt exactly once. The contact owner immediately composes structure loss
 * and rebuilding in the same synchronous transaction after this guarded step. */
export function commitSpikeTrapImpact(world:World,plan:SpikeTrapImpactPlan):boolean {
  const p=prepared.get(plan);
  if(!p||p.world!==world||p.tick!==world.tick||isCorePhysicalSchema297(Number(world.schemaVersion))&&p.core297!==effectiveCore297(world)||world.rng!==plan.rngBefore||!p.adopt())return false;
  world.rng=plan.rngAfter;prepared.delete(plan);return true;
}
