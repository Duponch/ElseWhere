import {startInspiration360} from './inspirations-360.ts';
import {mentalRecoveryRoll362} from './trait-links-stream-362.ts';
import type {Pawn,World} from './types.ts';

/* Schema 362, Tortured artist (TraitDef TorturedArtist): mentalBreakInspiration-
 * GainSet [Inspired_Creativity], mentalBreakInspirationGainChance 0.5. In Core,
 * MentalState.RecoverFromState (natural end, end on downed or on waking, never
 * on death) calls Trait.Notify_MentalStateEndedOn for a mood-caused state: one
 * Rand.Value, then if it is 0.5 or less InspirationHandler.TryStartInspiration
 * (refused if already inspired or if the worker does not admit the pawn). The
 * degree exists only from 362, so an older game never reaches this. */
export const TORTURED_ARTIST_INSPIRATION_CHANCE_362=.5;
export function torturedArtistRecovery362(world:World,pawn:Pawn):boolean {
  if(!pawn.traits?.includes('tortured-artist')||pawn.state==='dead'||pawn.health?.death)return false;
  if(mentalRecoveryRoll362(world.seed,pawn.id,world.tick)>TORTURED_ARTIST_INSPIRATION_CHANCE_362)return false;
  return startInspiration360(world,pawn,'creativity',`Artiste torturé, ${pawn.name} a traversé sa crise et en ressort avec une idée qui ne le quitte plus.`);
}
