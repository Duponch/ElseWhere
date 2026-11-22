/* The own random draws of the schema 368 pyromaniac (pyromaniac-368).
 *
 * Core draws Rand in TraitMentalStateGiver.CheckGive (the random spree, MTB 50
 * days) and in JobGiver_FireStartingSpree (wait length, the 0.75 chance, the
 * target, the wander cell). Elsewhere gives them a stream of their own: a pure
 * function of the world seed, the pawn, the local tick and a salt per draw
 * (one salt per Core draw, in Core's order). No other stream moves and nothing
 * is saved. Kept apart so a test may force a draw without touching the rules. */

const fmix=(h:number):number=>{h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;};

/** Salts of the draws, in Core's order within one decision. */
export const FIRE_SPREE_SALT_368=Object.freeze({randomState:1,wait:2,chance:3,target:4,wander:5});

/** Uniform [0, 1) for `salt` of `pawnId` at local tick `tick`. */
export function fireSpreeRoll368(seed:number,pawnId:number,tick:number,salt:number):number {
  return fmix(fmix(fmix(fmix(((seed>>>0)^0x368f1e57)>>>0)^(pawnId>>>0))^(tick>>>0)^Math.floor(tick/0x100000000))^Math.imul(salt,0x9e3779b1))/0x100000000;
}
