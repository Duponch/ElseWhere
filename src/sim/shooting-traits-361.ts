import {rangedRound} from './ranged-statistics.ts';
import {TRAITS,isTraitsSchema361,type TraitId} from './traits.ts';

/** Schema 361: Core Stance_Warmup lasts (warmupTime x AimingDelayFactor)
 * .SecondsToTicks(), rounded to the nearest (even on a tie). Exactly the base
 * warmup without an aiming trait. */
export const aimedWarmup361=(baseCoreTicks:number,factor:number):number=>factor===1?baseCoreTicks:rangedRound(baseCoreTicks*factor);
/** The factor of an unvalidated saved trait list (its own validation runs
 * separately): 1 below 361 or without a known aiming trait. */
export function aimingFactorOf361(traits:unknown,version:number):number {
  if(!isTraitsSchema361(version)||!Array.isArray(traits))return 1;
  let sum=0;for(const id of traits)if(typeof id==='string'&&Object.hasOwn(TRAITS,id)){const v=TRAITS[id as TraitId].aimingDelay;if(v)sum+=v;}
  return sum?Math.max(.01,1+sum):1;
}
