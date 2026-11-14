import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {registeredCampaign,registeredMapId,registeredMap,flushRegisteredMap} from './world-map-context.ts';
import {CARAVAN_BIOME_MTB_261,caravanVisibility261,caravanIncidentOccurs261} from './caravan-incident-calculation-261.ts';
import {admitTempMapAssault261,admitTempMapManhunters261} from './temp-map-raids-261.ts';
import {admitTempMapTraveler261} from './temp-map-travelers-261.ts';
import {animalBodySize} from './animal-life.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {carrierOf} from './rescue-state.ts';
import {kidnapCarrierOf261} from './caravan-kidnap-261.ts';
import {isColonist} from './affiliation.ts';
import {computeThreatPoints,summaryHealthPercent} from './threat-points.ts';
import {colonyWealth} from './colony-wealth.ts';
import type {World} from './types.ts';
import type {CampaignState,WorldMapRecord} from './world-map-state.ts';
import type {WorldLandBiome} from './world-biome-selection.ts';
import {planetTile} from './planet-geography-256.ts';
/** Born on a real future play boundary only. Last dates are actual successes. */
export interface TempIncidents261 {revision:1;adoptedAtCore:number;last:{meeting?:number;ambush?:number;manhunterAmbush?:number}}
export function tempMapRecord261(w:World):WorldMapRecord|undefined {
 const root=registeredCampaign(w),id=registeredMapId(w);
 return root.worldMaps?.sites.find(m=>m.id===id)??(w.campaignMap?.revision===2?w.campaignMap.maps.find(m=>w.campaignMap?.revision===2&&m.id===w.campaignMap.activeMapId) as unknown as WorldMapRecord:undefined);
}
export const tempMapTarget261=(w:World):boolean=>(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))&&['camp','battlefield'].includes(tempMapRecord261(w)?.kind??'');
export const tempMapAdoptedAtCore261=(w:World):number|undefined=>(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))?tempMapRecord261(w)?.tempIncidents261?.adoptedAtCore:undefined;
export const tempMapModern261=(w:World):boolean=>tempMapTarget261(w)&&tempMapAdoptedAtCore261(w)!==undefined;
/** Home-only opportunities exclude Map_Misc targets. A truly destroyed
 * settlement is Map_PlayerHome before Settle; no TempIncident alias or clock. */
export function homeIncidentsBlocked261(w:World):boolean {
 if(tempMapModern261(w))return true;
 if(!isSchema263OrLater(Number(w.schemaVersion)))return false;
 const record=tempMapRecord261(w);
 return record?.kind==='quest-site'||record?.kind==='foreign-settlement'&&!(record.target263?.kind==='foreign-settlement'&&record.target263.destroyedSiteId!==undefined);
}

/** Called before advancing time, never by serialization/bootstrap. */
export function adoptTempMapIncidents261(w:World):void {
 if(!tempMapTarget261(w)||!w.gameProfile)return;const record=tempMapRecord261(w)!;
 record.tempIncidents261??={revision:1,adoptedAtCore:w.tick*10,last:{}};
}
/** The clinical/adaptation model is the existing declared AdventureStory one;
 * wealth comes from this actual map, without installing a home agenda. */
export function tempMapThreatPoints261(w:World):number|undefined {
 if(w.gameProfile?.difficulty!=='adventure-story')return;
 const people=w.pawns.filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead');
 return computeThreatPoints({timeFactorWholeDays:w.schemaVersion>=328,knownWealth:(w.economy?.wealth??colonyWealth(w)).knownStorytellerWealth,freeColonists:people.length,
  colonistHealthSum:people.reduce((n,p)=>n+(p.health?summaryHealthPercent(p.health):1),0),elapsedDays:w.tick/6000,adaptationDays:w.economy?.adaptationDays??0,seedBucket:Math.floor(w.tick/250)}).points;
}
function visibility(w:World):number {
 const player=registeredCampaign(w).worldFactions!.playerFactionId;
 let size=Math.fround(w.pawns.filter(p=>p.state!=='dead'&&(p.worldAffiliation259?.factionId===player||!!p.prisoner)&&!carrierOf(w,p.id)&&!kidnapCarrierOf261(w,p.id)).length);
 for(const a of w.wildlife?.animals??[])if(a.state!=='dead'&&a.domestic&&!animalCarrier(w,a.id))size=Math.fround(size+Math.fround(animalBodySize(a)));
 return caravanVisibility261(size,false);
}
/** Only three Core MTB defs. Component order first, then stable real maps;
 * no home tickets, map generation, deferred favorable retry or fake Caravan. */
export function advanceTempMapIncidents261(root:CampaignState):void {
 const core=root.tick*10;if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||core%1000||!root.worldMaps||root.planet?.revision!==3||!root.worldFactions)return;
 const records=root.worldMaps.sites.slice().sort((a,b)=>a.id-b.id);
 for(const kind of ['meeting','ambush','manhunter-ambush'] as const)for(const record of records){
  const state=record.tempIncidents261;if(!state||core<=state.adoptedAtCore||record.tile===null||!['camp','battlefield'].includes(record.kind))continue;
  const w=registeredMap(root,record.id)!;if(w.gameProfile?.storyteller!=='cassandra-partial')continue;
  const key=kind==='manhunter-ambush'?'manhunterAmbush':kind,last=state.last[key];if(last!==undefined&&core-last<10200)continue;
  const tile=planetTile(root.planet,record.tile);if(!tile||!Object.hasOwn(CARAVAN_BIOME_MTB_261,tile.biome))continue;
  const random={rng:root.rng},biome=tile.biome as WorldLandBiome;
  if(!caravanIncidentOccurs261(biome,kind,kind==='meeting'?1:visibility(w),random)){root.rng=random.rng;continue;}
  // Native GenerateParms/worker follows the MTB roll, including its failure.
  const points=kind==='meeting'?-1:tempMapThreatPoints261(w);
  const fired=points!==undefined&&(kind==='meeting'?admitTempMapTraveler261(w,points,random):kind==='ambush'?admitTempMapAssault261(w,points,random):admitTempMapManhunters261(w,points,random));
  root.rng=random.rng;if(fired)state.last[key]=core;flushRegisteredMap(w);
 }
}
