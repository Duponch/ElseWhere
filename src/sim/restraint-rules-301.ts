import {schemaAtLeast} from './schema-range.ts';
import {prisonBreakActive} from './prison-break-state.ts';
import type {Pawn,World} from './types.ts';

/* RimWorld 1.6.4871: Pawn.TicksPerMove multiplies the move speed by 0.35 while
 * RestraintsUtility.InRestraints holds. A released prisoner (guest.Released)
 * is not restrained, nor a prisoner whose lord never restrains it
 * (LordJob_PrisonBreak.NeverInRestraints): both walk at their own speed.
 * Schema 301 family; historical schemas keep x0.35 for every prisoner. */
const restraintRules301=schemaAtLeast(301);
/** Whether this prisoner moves at the restrained x0.35 speed. */
export function inRestraints301(world:Pick<World,'schemaVersion'>,pawn:Pick<Pawn,'prisoner'>):boolean {
  const prisoner=pawn.prisoner;if(!prisoner)return false;
  if(!restraintRules301(Number(world.schemaVersion)))return true;
  return prisoner.releasedAt===undefined&&!prisonBreakActive(pawn);
}
