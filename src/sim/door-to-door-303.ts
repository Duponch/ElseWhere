import {schemaAtLeast} from './schema-range.ts';
import type {Structure} from './types.ts';

/* Door to door (schema 303), RimWorld 1.6.
 *
 * `PathGrid.CalculatedCostAt` adds 45 ticks to a door cell entered from
 * another door cell when neither door is in free passage. The path search
 * grid is computed without a previous cell, so only the real step pays it
 * (`Pawn_PathFollower.CostToMoveIntoCell` passes the pawn's position), before
 * the 450 cap and before the urgency factors (a walk doubles it).
 *
 * `Building_Door.FreePassage` is "open, and held open or not closing soon".
 * `WillCloseSoon` is true while a pawn able to open the door stands in it or
 * is moving into it, and the stepping pawn does both (it stands in the first
 * door, its next cell is the second). So, for that pawn, a door is in free
 * passage only while open and held open. Adaptation: every human that walks
 * through a door here opens it, so the rule is applied to every human step;
 * animals and mechanoids keep their own step costs. Doors keep a solid frame
 * at their diagonal cells, so a door-to-door step is always cardinal. */
export const isDoorToDoorSchema303=schemaAtLeast(303);
export const DOOR_TO_DOOR_CORE303=45;
const freePassage303=(door:Structure):boolean=>!!door.door?.open&&!!door.door.holdOpen;
/** Whether a step from the door `from` into the door `to` pays the surcharge. */
export function doorToDoorSurcharge303(from:Structure|undefined,to:Structure|undefined):boolean {
  return !!from&&!!to&&from!==to&&!freePassage303(from)&&!freePassage303(to);
}
/** The captured step delay (local ticks, one decimal) with the surcharge. */
export const withDoorToDoorDelay303=(terrainDelay:number):number=>(Math.round(terrainDelay*10)+DOOR_TO_DOOR_CORE303)/10;
