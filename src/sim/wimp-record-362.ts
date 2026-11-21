import {createMedicalRecord} from './injury-state.ts';
import type {Pawn} from './types.ts';

/** Schema 362, Wimp: the pain shock threshold lives on the medical record
 * (trait-links-362.ts). A newborn wimp gets its record at birth, at the birth
 * tick, as a newborn with an age ailment already does. */
export function bornWimpRecord362(pawn:Pawn,tick:number):void {
  if(!pawn.traits?.includes('wimp'))return;
  (pawn.health??=createMedicalRecord(Math.max(0,tick))).wimp362=true;
}
