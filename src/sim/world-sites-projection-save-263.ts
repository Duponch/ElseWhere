import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297 as frontierCore297} from './core-phase-297.ts';
import {registeredMapId} from './world-map-context.ts';
import {validPeaceTalksBindings293} from './peace-talks-save-293.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {validWorldSiteAmbush263} from './world-site-ambush-save-263.ts';
import {validSiteDefenceSource263} from './world-site-defence-source-263.ts';
import {targetBuilding263} from './world-target-building-263.ts';
import {validateWorldSites263,type WorldSitesValidationContext263} from './world-sites-save-263.ts';
import {validWorldTargetDefence263} from './world-target-defence-save-263.ts';
import type {NumericMembershipSink} from './numeric-membership.ts';
import type {CampaignSummary} from './world-map-state.ts';
import type {World} from './types.ts';
/** Complete shared Site holder is one real projected owner, outside the
 * selected map and every caravan. Decode registers its Things only once. */
export function registerProjectedWorldSites263(w:World,ids:NumericMembershipSink,summary?:CampaignSummary):string[] {
 const metadata=summary??(w.campaignMap?.revision===2?w.campaignMap:undefined);
 const mono298=isSchema298OrLater(Number(w.schemaVersion))&&metadata===undefined&&w.campaignMap===undefined&&registeredMapId(w)===0;
 if(!metadata&&!mono298)return isSchema263OrLater(Number(w.schemaVersion))&&Object.hasOwn(w,'worldSites263')?['Projected Sites lack their true campaign metadata.']:[];
 const context:WorldSitesValidationContext263={schemaVersion:w.schemaVersion,tick:w.tick,nextId:w.nextId,planet:w.planet,worldFactions:w.worldFactions,...metadata?{worldMaps:{sites:metadata.maps}}:{},...Object.hasOwn(w,'worldSites263')?{worldSites263:w.worldSites263}:{}};
 const errors=validateWorldSites263(w.worldSites263,context,ids,isSchema298OrLater(Number(w.schemaVersion))?frontierCore297(w):undefined);
 if(!errors.length&&!validPeaceTalksBindings293(summary??w))errors.push('Invalid projected PeaceTalks reciprocal bindings.');
 if(isSchema263OrLater(Number(w.schemaVersion))){const packs=[...w.packed??[],...(metadata?.groups??[]).flatMap(r=>'members'in r.state?r.state.packed??[]:[]),...w.worldPawns?.owners.flatMap(r=>r.packed)??[]];for(const p of packs)if(targetBuilding263(w,p.building)&&p.building.factionId!==w.worldFactions?.playerFactionId)errors.push('Projected target furniture is not actually player-owned.');}
 if(!summary&&!validWorldTargetDefence263(w,w.schemaVersion))errors.push('Invalid projected263 map defence.');
 if(!summary&&!validSiteDefenceSource263(w,w.schemaVersion))errors.push('Projected Site defence differs from its selected threat.');
 if(!summary&&!validWorldSiteAmbush263(w,w.schemaVersion))errors.push('Invalid projected263 Site ambush.');
 return errors;
}
