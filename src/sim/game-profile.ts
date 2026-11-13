import { isColonist } from './affiliation.ts';
import type { Pawn,World } from './types.ts';

/** Applied creation choices. Absence preserves every historical camp rule. */
export interface GameProfile {
  revision:1;
  storyteller:'cassandra-partial';
  difficulty:'adventure-story';
  saveMode:'reloadable';
}
export function crashlandedProfile():GameProfile {
  return {revision:1,storyteller:'cassandra-partial',difficulty:'adventure-story',saveMode:'reloadable'};
}
/** Core Need_Mood: colonistMoodOffset for a colonist or (schema 313) a prisoner of the colony. */
export const colonistMoodOffset=(world:Pick<World,'gameProfile'>&Partial<Pick<World,'schemaVersion'>>,pawn:Pawn):number=>world.gameProfile&&(isColonist(pawn)||Number(world.schemaVersion)>=313&&!!pawn.prisoner)?5:0;
/** Current Core player-faction multiplier applies when an exposed wound
 * reaches its infection deadline, not when the original wound is received. */
export const playerInfectionFactor=(world:Pick<World,'gameProfile'>,pawn:Pawn):number=>world.gameProfile&&isColonist(pawn)?.75:1;
/** Both the historical camp and the selected Core difficulty use .40. */
export const friendlyFireFactor=(_world:Pick<World,'gameProfile'>):number=>.4;
