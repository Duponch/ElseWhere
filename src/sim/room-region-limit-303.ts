import {schemaAtLeast} from './schema-range.ts';
import type {RoomTopology} from './room-topology.ts';

/* Very large rooms (schema 303), RimWorld 1.6.
 *
 * `Room.UpdateRoomStatsAndRole` computes a room's stats and role only for a
 * proper room of at most 60 regions; beyond, every stat takes its roomless
 * score (`RoomStatDef.roomlessScore`) and the role is None. A region is a
 * connected part of a 12 x 12 block of the map grid (RoomTopology.regionCount).
 * Here the stat readers answer as for a cell outside any room, whose roomless
 * values already match Core's RoomStats.xml: cleanliness factors for research
 * x0.75, surgery x0.6, infection x1, food poisoning 0.02; no room thought; role
 * none. Approximation: every non-barrier cell of a space counts as a region
 * cell, including cells under impassable furniture. */
export const ROOM_REGION_LIMIT=60;
export const isRoomRegionLimitSchema303=schemaAtLeast(303);
/** Whether the space `id` keeps no room stats or role: true beyond 60 regions. */
export function roomWithoutStats303(version:unknown,topology:RoomTopology,id:number):boolean {
  return isRoomRegionLimitSchema303(version)&&topology.regionCount(id)>ROOM_REGION_LIMIT;
}
