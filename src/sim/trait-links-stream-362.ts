/* The own random draw of the schema 362 trait links.
 *
 * Core rolls Rand.Value in Trait.Notify_MentalStateEndedOn when a mood-caused
 * mental state ends (Tortured artist: a creativity inspiration at 0.5 or
 * less). Elsewhere gives that roll a stream of its own, a pure function of
 * the world seed, the pawn and the local tick of the recovery: no other
 * stream moves and nothing is saved. Kept apart so a test can force the roll
 * without touching the rule (as the 360 inspiration test does). */

const fmix=(h:number):number=>{h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;};

/** Uniform [0, 1) for the recovery of `pawnId` from a mental state at local tick `tick`. */
export function mentalRecoveryRoll362(seed:number,pawnId:number,tick:number):number {
  return fmix(fmix(fmix(((seed>>>0)^0x362a7715)>>>0)^(pawnId>>>0))^(tick>>>0)^Math.floor(tick/0x100000000))/0x100000000;
}
