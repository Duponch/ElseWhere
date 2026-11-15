import type {World} from './types.ts';

/** Schema 341: Core StoryState.recentRandomIncidents and the recent-incident
 * weighting of StorytellerComp.IncidentChanceFinal.
 *
 * Each incident target (a map, the planet) keeps the last five incidents the
 * storyteller fired on it, newest first. When a category is drawn by weight,
 * an incident found at position i of that list has its weight multiplied by
 * QuestTuning.RecentStoryWeightFactors[i] = 0.01, 0.3, 0.5, 0.7, 0.9, once per
 * position where it appears. An incident is recorded when it really fires
 * (not forced), except the categories Core leaves out: quests, Special, and
 * the defs flagged ignoreRecentSelectionWeighting (the enemy raid and the
 * diseases). Elsewhere keeps the home map's list on its Misc calendar and the
 * planet's list on its World calendar.
 *
 * Incidents Elsewhere does not have, drawn as absent tickets by the Misc and
 * big threat lotteries, are recorded as if they had fired: they stand for the
 * Core incident in the list as they do in the draw. Absent incidents outside
 * those lotteries (ship chunk drop, friendly raid) are not represented. */
export const RECENT_STORY_WEIGHT_FACTORS_341=Object.freeze([.01,.3,.5,.7,.9] as const);
export const RECENT_INCIDENTS_MAX_341=RECENT_STORY_WEIGHT_FACTORS_341.length;
export const RECENT_INCIDENTS_SCHEMA_341=341;
export const isRecentIncidents341=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=RECENT_INCIDENTS_SCHEMA_341;

/** The home map's incidents with a recent-weighting record (Core categories
 * Misc, ThreatBig without the raid, ThreatSmall, FactionArrival, OrbitalVisitor). */
export const HOME_RECENT_INCIDENTS_341=Object.freeze([
  // Misc (Incidents_Map_Misc), the ids of the Misc lottery.
  'heat-wave','flashstorm','refugee-pod','cold-snap','resource-pod','psychic-soothe','self-tame','ambrosia-sprout','farm-animals',
  'wanderer-join','thrumbo-passes','ransom-demand','meteorite','herd-migration','wild-man','psychic-drone','toxic-fallout',
  'volcanic-winter','short-circuit','crop-blight','alphabeavers',
  // ThreatBig, the raid excepted (ignoreRecentSelectionWeighting).
  'infestation','manhunter-pack','defoliator-ship-part','psychic-ship-part','mass-animal-insanity',
  // ThreatSmall.
  'animal-insanity-single',
  // FactionArrival and OrbitalVisitor.
  'visitor-group','traveler-group','trader-caravan','orbital-trader',
] as const);
export type HomeRecentIncident341=typeof HOME_RECENT_INCIDENTS_341[number];
/** The planet's incidents (Incidents_World_Conditions, category Misc). */
export const WORLD_RECENT_INCIDENTS_341=Object.freeze(['eclipse','solar-flare','aurora'] as const);
export type WorldRecentIncident341=typeof WORLD_RECENT_INCIDENTS_341[number];

/** Product of the factors of every position where `id` appears. */
export function recentFactor341(list:readonly string[]|undefined,id:string):number {
  let factor=1;
  if(list)for(let i=0;i<list.length&&i<RECENT_INCIDENTS_MAX_341;i++)if(list[i]===id)factor*=RECENT_STORY_WEIGHT_FACTORS_341[i]!;
  return factor;
}
function push(list:string[]|undefined,id:string):string[] {
  const next=[id,...list??[]];next.length=Math.min(next.length,RECENT_INCIDENTS_MAX_341);return next;
}
/** The home map's factor reader, or undefined before schema 341. */
export function homeRecentFactor341(w:Pick<World,'schemaVersion'|'miscIncidents'>):((id:string)=>number)|undefined {
  if(!isRecentIncidents341(w.schemaVersion))return undefined;
  const list=w.miscIncidents?.recent341;return id=>recentFactor341(list,id);
}
export function worldRecentFactor341(w:Pick<World,'schemaVersion'|'worldIncidents'>):((id:string)=>number)|undefined {
  if(!isRecentIncidents341(w.schemaVersion))return undefined;
  const list=w.worldIncidents?.recent341;return id=>recentFactor341(list,id);
}
/** Record an incident that fired on the home map (no-op before 341 or
 * without the home Misc calendar that holds the list). */
export function recordHomeIncident341(w:World,id:HomeRecentIncident341):void {
  if(!isRecentIncidents341(w.schemaVersion)||!w.miscIncidents)return;
  w.miscIncidents.recent341=push(w.miscIncidents.recent341,id);
}
export function recordWorldIncident341(w:World,id:WorldRecentIncident341):void {
  if(!isRecentIncidents341(w.schemaVersion)||!w.worldIncidents)return;
  w.worldIncidents.recent341=push(w.worldIncidents.recent341,id);
}
/** Absent before 341; then one to five known ids, as a plain dense array. */
export function validRecentIncidents341(value:unknown,version:number,ids:readonly string[]):boolean {
  if(value===undefined)return true;
  if(!isRecentIncidents341(version)||!Array.isArray(value)||value.length<1||value.length>RECENT_INCIDENTS_MAX_341||Object.getPrototypeOf(value)!==Array.prototype)return false;
  if(Reflect.ownKeys(value).length!==value.length+1)return false;
  for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!ids.includes(d.value))return false;}
  return true;
}
