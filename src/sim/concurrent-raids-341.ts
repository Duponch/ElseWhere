import type {World} from './types.ts';
import type {RaidCalendar,RaidGroup} from './raid-state.ts';
import type {MechanoidRaidGroup} from './mechanoid-raid-state.ts';

/** Schema 341: several Cassandra home raids at once.
 *
 * Core's big-threat cycle fires an enemy raid at each of its opportunities;
 * neither IncidentWorker.CanFireNow nor IncidentWorker_RaidEnemy checks for a
 * raid already on the map, and every raid gets its own Lord. Elsewhere used
 * to drop the opportunity while any raid group was active. From schema 341 a
 * raid whose primary slot (active for people, mechActive for machines) is
 * taken arrives anyway, as an independent group in the multi-raid lists
 * (extraActive261 / extraMechActive261) marked concurrent341. It keeps every
 * rule of an ordinary Cassandra raid: faction, roster, staging, arrival mode,
 * give-up deadline, retreat, death on downing, exit and save checks. */
export const CONCURRENT_RAIDS_SCHEMA_341=341;
export const isConcurrentRaids341=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=CONCURRENT_RAIDS_SCHEMA_341;
/** True when a new Cassandra raid must arrive as a concurrent group. */
export const raidSlotTaken341=(w:Pick<World,'schemaVersion'|'raids'>):boolean=>isConcurrentRaids341(w.schemaVersion)&&w.raids?.profile==='cassandra-raids-v1'&&(!!w.raids.active||!!w.raids.mechActive);
export const concurrentHumanGroups341=(s:Pick<RaidCalendar,'extraActive261'>|undefined):RaidGroup[]=>(s?.extraActive261??[]).filter(g=>g?.concurrent341===true);
export const concurrentMechanicalGroups341=(s:Pick<RaidCalendar,'extraMechActive261'>|undefined):MechanoidRaidGroup[]=>(s?.extraMechActive261??[]).filter(g=>g?.concurrent341===true);
