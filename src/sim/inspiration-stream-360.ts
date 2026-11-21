/* The own random stream of the schema 360 inspirations.
 *
 * Core draws the inspiration check from the global Rand at each pawn's hashed
 * 100-tick interval. Elsewhere gives it a stream of its own so that no other
 * stream moves: the draws of one check are a pure function of the world seed,
 * the pawn and the local tick of the check. Nothing is saved, the iteration
 * order of the pawns does not matter and a reloaded game draws the same
 * values. Kept apart so a test can drive a check without touching the rule. */

const fmix=(h:number):number=>{h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;};

/** Uniform draws in [0, 1) for the check of `pawnId` at local tick `tick`. */
export function inspirationStream360(seed:number,pawnId:number,tick:number):()=>number {
  let state=fmix(fmix(fmix(((seed>>>0)^0x1d2b5c71)>>>0)^(pawnId>>>0))^(tick>>>0)^Math.floor(tick/0x100000000))||0x6d2b79f5;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/0x100000000;};
}
