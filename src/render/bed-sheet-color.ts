import type {Structure} from '../sim/types';

/** RimWorld 1.6 Building_Bed.DrawColorTwo, read in the installed assembly.
 * These are the exact sheet RGB bytes; the 3D frame and painted shading remain
 * Elsewhere's own model. Medical prisoner beds have their distinct fourth tint. */
export const BED_SHEET_COLORS=Object.freeze({normal:0xa1d5b4,medical:0x639fe2,prisoner:0xffb721,medicalPrisoner:0xa76027});
export function bedSheetColor(bed:Pick<Structure,'medical'|'prisoner'>):number {
  return bed.prisoner?(bed.medical?BED_SHEET_COLORS.medicalPrisoner:BED_SHEET_COLORS.prisoner)
    :bed.medical?BED_SHEET_COLORS.medical:BED_SHEET_COLORS.normal;
}
