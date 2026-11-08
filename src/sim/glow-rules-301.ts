import {schemaAtLeast} from './schema-range.ts';
import {pawnBody} from './health-rules.ts';
import type {Pawn,World} from './types.ts';

/* RimWorld 1.6.4871: the darkness factor (StatPart_Glow of MoveSpeed and
 * WorkSpeedGlobal, 0.8 at glow 0 up to 1 at glow 0.3) applies to humanlike
 * pawns only, and is ignored for a pawn incapable of sight
 * (PawnUtility.IsBiologicallyBlind: Sight level 0). Schema 301 family;
 * historical schemas keep applying it to every actor. */
const glowRules301=schemaAtLeast(301);
/** Mechanoids (not humanlike) move at full speed in the dark. */
export const glowAppliesToMechanoids=(world:Pick<World,'schemaVersion'>):boolean=>!glowRules301(Number(world.schemaVersion));
/** A blind pawn ignores the darkness factor of its move and work speeds. */
export function glowIgnoredByBlindPawn(world:Pick<World,'schemaVersion'>,pawn:Pawn):boolean {
  return glowRules301(Number(world.schemaVersion))&&pawnBody(pawn).capacities.sight<=0;
}
