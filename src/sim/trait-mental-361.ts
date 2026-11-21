import type {Pawn} from './types.ts';

/** Schema 361 trait rules of the mental break pool (Core TraitDefs and
 * MentalBreakWorker). Pre-361 people hold none of these traits. */
/** Gourmand theOnlyAllowedMentalBreaks Binging_Food: at the minor intensity a
 * food binge, when it can occur, is the only break (MentalBreakWorker.
 * BreakCanOccur); other intensities are unchanged. */
export function onlyAllowedMinorBreaks361<T extends {kind:string}>(pawn:Pawn,options:T[]):T[] {
  if(!pawn.traits?.includes('gourmand'))return options;
  const binge=options.filter(o=>o.kind==='food-binge');
  return binge.length?binge:options;
}
/** Teetotaler disallowedMentalStates Binging_DrugMajor and _DrugExtreme. */
export const traitForbidsDrugBinge361=(pawn:Pawn):boolean=>!!pawn.traits?.includes('teetotaler');
/** MentalBreakWorker_BingingDrug.CommonalityFor, mood-caused: x2.5 for a
 * chemical interest, x5 for a chemical fascination (base commonality 1). */
export const drugBingeWeight361=(pawn:Pawn):number=>pawn.traits?.includes('chemical-fascination')?5:pawn.traits?.includes('chemical-interest')?2.5:1;
/** A private, stateless draw for the trait mental state givers: neither the
 * world nor any owner stream moves. */
export function traitMentalStateRoll361(seed:number,id:number,tick:number):number {
  let n=(seed^0x361b1e5^Math.imul(id,0x9e3779b1)^Math.imul(tick,0x85ebca6b))>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/0x100000000;
}
