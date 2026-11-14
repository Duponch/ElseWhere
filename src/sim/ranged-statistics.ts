import type { AccuracyCurve } from './combat-report.ts';
import { WEAPON_QUALITIES,isRangedWeaponItem,type WeaponQuality } from './equipment-rules.ts';
import { TICKS_PER_DAY } from './types.ts';
import { SHORT_BOW_RANGED_316 } from './short-bow-316.ts';
import { BOW_FACTS_326,type BowRanged326 } from './bows-326.ts';
import { MINI_TURRET_PROFILE } from './mini-turret-profile.ts';
import { LANCER_GUN_PROFILE,PIKEMAN_GUN_PROFILE } from './mechanoid-ranged-profile.ts';

/** Projectile identity is broader than inventory/equipment ItemId. */
export type ProjectileProfileId='revolver'|'bolt-action-rifle'|'emp-launcher'|'short-bow'|'pump-shotgun'|'recurve-bow'|'greatbow'|'mini-turret-gun'|'lancer-gun'|'pikeman-gun';

/** Data/units shared by the persistent shooting skill and attack producer. See the explicit
 * current/historical source decisions in research/ranged-statistics-reference. */
const shootingCurve:readonly (readonly [number,number])[]=[[-20,.70],[-10,.80],[-6,.83],[-4,.85],[-2,.87],[0,.89],[2,.93],[4,.94],[6,.95],[8,.96],[10,.97],[12,.975],[14,.98],[16,.98333],[18,.98666],[20,.99],[22,.9925],[26,.995],[30,.9965],[40,.998],[60,.999]];
function finiteNonnegative(value:number):void {if(!Number.isFinite(value)||value<0)throw new RangeError('Invalid ranged stat input');}
export function shootingAccuracy(level:number,sight:number,manipulation:number):{score:number;perCell:number} {
  if(!Number.isInteger(level)||level<0||level>20)throw new RangeError('Invalid shooting level');
  finiteNonnegative(sight);finiteNonnegative(manipulation);
  const score=level+12*(Math.min(sight,2)-1)+8*(Math.min(manipulation,1)-1);
  for(let i=1;i<shootingCurve.length;i++)if(score<=shootingCurve[i][0]) {
    const [low,a]=shootingCurve[i-1],[high,b]=shootingCurve[i];
    return {score,perCell:a+(b-a)*(score-low)/(high-low)};
  }
  return {score,perCell:shootingCurve.at(-1)![1]};
}

/** Reference Mathf.RoundToInt uses nearest/even, not JS's positive tie-up. */
export function rangedRound(value:number):number {
  finiteNonnegative(value);if(value>Number.MAX_SAFE_INTEGER)throw new RangeError('Ranged value overflow');
  const floor=Math.floor(value);return value-floor===.5?floor+floor%2:Math.round(value);
}
export interface RevolverProfile {
  readonly quality:WeaponQuality;
  readonly damage:number;
  readonly armorPenetration:number;
  readonly accuracy:AccuracyCurve;
  readonly range:number;
  readonly warmupCoreTicks:number;
  readonly cooldownCoreTicks:number;
  readonly projectileTilesPerCoreTick:number;
  readonly stoppingPower:number;
}
const accuracyFactors=[.8,.9,1,1.1,1.2,1.35,1.5],damageFactors=[.9,1,1,1,1,1.25,1.5];
const profiles=Object.freeze(Object.fromEntries(WEAPON_QUALITIES.map((quality,i)=>[quality,Object.freeze({
  quality,damage:rangedRound(12*damageFactors[i]),armorPenetration:.18*damageFactors[i],
  accuracy:Object.freeze([.8,.75,.55,.4].map(a=>Math.min(1,a*accuracyFactors[i]))) as AccuracyCurve,
  range:25.9,warmupCoreTicks:18,cooldownCoreTicks:96,projectileTilesPerCoreTick:55/100,stoppingPower:1,
})])) as Record<WeaponQuality,RevolverProfile>);
export function revolverProfile(quality:WeaponQuality):RevolverProfile {
  if(!Object.hasOwn(profiles,quality))throw new RangeError('Invalid weapon quality');return profiles[quality];
}
const rifleProfiles=Object.freeze(Object.fromEntries(WEAPON_QUALITIES.map((quality,i)=>[quality,Object.freeze({
  quality,damage:rangedRound(18*damageFactors[i]),armorPenetration:.27*damageFactors[i],
  accuracy:Object.freeze([.65,.8,.9,.8].map(a=>Math.min(1,a*accuracyFactors[i]))) as AccuracyCurve,
  range:36.9,warmupCoreTicks:102,cooldownCoreTicks:90,projectileTilesPerCoreTick:70/100,stoppingPower:1.5,
})])) as Record<WeaponQuality,RevolverProfile>);
const empProfiles=Object.freeze(Object.fromEntries(WEAPON_QUALITIES.map((quality,i)=>[quality,Object.freeze({
  quality,damage:rangedRound(50*damageFactors[i]),armorPenetration:0,
  accuracy:Object.freeze([1,1,1,1].map(a=>Math.min(1,a*accuracyFactors[i]))) as AccuracyCurve,
  range:23.9,warmupCoreTicks:210,cooldownCoreTicks:210,projectileTilesPerCoreTick:.4,stoppingPower:0,
})])) as Record<WeaponQuality,RevolverProfile>);
/** Schema 316 short bow: same quality factors as every ranged weapon. */
const bowProfiles=Object.freeze(Object.fromEntries(WEAPON_QUALITIES.map((quality,i)=>[quality,Object.freeze({
  quality,damage:rangedRound(SHORT_BOW_RANGED_316.damage*damageFactors[i]),armorPenetration:SHORT_BOW_RANGED_316.armorPenetration*damageFactors[i],
  accuracy:Object.freeze(SHORT_BOW_RANGED_316.accuracy.map(a=>Math.min(1,a*accuracyFactors[i]))) as AccuracyCurve,
  range:SHORT_BOW_RANGED_316.range,warmupCoreTicks:SHORT_BOW_RANGED_316.warmupCoreTicks,cooldownCoreTicks:SHORT_BOW_RANGED_316.cooldownCoreTicks,
  projectileTilesPerCoreTick:SHORT_BOW_RANGED_316.projectileTilesPerCoreTick,stoppingPower:SHORT_BOW_RANGED_316.stoppingPower,
})])) as Record<WeaponQuality,RevolverProfile>);
/** Schema 322 pump shotgun (Core Gun_PumpShotgun, Bullet_Shotgun): range
 * 15.9, warmup 0.9 s, cooldown 1.25 s, accuracy .80/.87/.77/.64; 18 damage,
 * explicit armor penetration 0.14, speed 55, stopping power 3. */
const shotgunProfiles=Object.freeze(Object.fromEntries(WEAPON_QUALITIES.map((quality,i)=>[quality,Object.freeze({
  quality,damage:rangedRound(18*damageFactors[i]),armorPenetration:.14*damageFactors[i],
  accuracy:Object.freeze([.80,.87,.77,.64].map(a=>Math.min(1,a*accuracyFactors[i]))) as AccuracyCurve,
  range:15.9,warmupCoreTicks:54,cooldownCoreTicks:75,projectileTilesPerCoreTick:55/100,stoppingPower:3,
})])) as Record<WeaponQuality,RevolverProfile>);
/** Schema 326 recurve bow and greatbow: same quality factors. */
const qualityProfiles326=(r:BowRanged326)=>Object.freeze(Object.fromEntries(WEAPON_QUALITIES.map((quality,i)=>[quality,Object.freeze({
  quality,damage:rangedRound(r.damage*damageFactors[i]),armorPenetration:r.armorPenetration*damageFactors[i],
  accuracy:Object.freeze(r.accuracy.map(a=>Math.min(1,a*accuracyFactors[i]))) as AccuracyCurve,
  range:r.range,warmupCoreTicks:r.warmupCoreTicks,cooldownCoreTicks:r.cooldownCoreTicks,
  projectileTilesPerCoreTick:r.projectileTilesPerCoreTick,stoppingPower:r.stoppingPower,
})])) as Record<WeaponQuality,RevolverProfile>);
const recurveBowProfiles=qualityProfiles326(BOW_FACTS_326['recurve-bow'].ranged),greatbowProfiles=qualityProfiles326(BOW_FACTS_326.greatbow.ranged);
export function rangedWeaponProfile(item:unknown,quality:WeaponQuality):RevolverProfile|undefined {
  if(!isRangedWeaponItem(item))return undefined;
  if(!WEAPON_QUALITIES.includes(quality))throw new RangeError('Invalid weapon quality');
  return item==='revolver'?profiles[quality]:item==='emp-launcher'?empProfiles[quality]:item==='short-bow'?bowProfiles[quality]:item==='pump-shotgun'?shotgunProfiles[quality]:item==='recurve-bow'?recurveBowProfiles[quality]:item==='greatbow'?greatbowProfiles[quality]:rifleProfiles[quality];
}
export function projectileProfile(item:unknown,quality:WeaponQuality):RevolverProfile|undefined {
  if(item==='mini-turret-gun'||item==='lancer-gun'||item==='pikeman-gun')return quality==='normal'?
    item==='mini-turret-gun'?MINI_TURRET_PROFILE:item==='lancer-gun'?LANCER_GUN_PROFILE:PIKEMAN_GUN_PROFILE:undefined;
  return rangedWeaponProfile(item,quality);
}

/** Preserve the existing game-day conversion. A displayed Core second is not a
 * local wall-clock second. The future phase driver must carry fractional time. */
export const CORE_TICKS_PER_LOCAL=60000/TICKS_PER_DAY;
export function rangedTimings(profile:RevolverProfile,aimFactor=1,cooldownFactor=1):{warmup:number;cooldown:number;cycle:number;learningCycleSeconds:number} {
  finiteNonnegative(aimFactor);finiteNonnegative(cooldownFactor);
  const rawCooldownCore=profile.cooldownCoreTicks*Math.max(.01,cooldownFactor);
  const warmupCore=rangedRound(profile.warmupCoreTicks*Math.max(.01,aimFactor)),cooldownCore=rangedRound(rawCooldownCore);
  // WarmupComplete XP uses the verb's base warmup, not the aiming-time factor.
  return {warmup:warmupCore/CORE_TICKS_PER_LOCAL,cooldown:cooldownCore/CORE_TICKS_PER_LOCAL,cycle:(warmupCore+cooldownCore)/CORE_TICKS_PER_LOCAL,learningCycleSeconds:(profile.warmupCoreTicks+rawCooldownCore)/60};
}
/** Destination jitter must already be captured; no draw or target tracking here. */
export function projectileFlightTicks(distance:number,profile:RevolverProfile):number {
  finiteNonnegative(distance);
  const core=Math.max(1,Math.ceil(distance/profile.projectileTilesPerCoreTick));
  if(!Number.isSafeInteger(core))throw new RangeError('Flight duration overflow');
  return core/CORE_TICKS_PER_LOCAL;
}
