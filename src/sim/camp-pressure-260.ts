import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {createBattlefieldPressureHumanRaid261} from './caravan-pressure-261.ts';
import type {CampaignState} from './world-map-state.ts';
import type {World} from './types.ts';
import {registeredCampaign,registeredMap,flushRegisteredMap} from './world-map-context.ts';
import {raidRandom} from './raid-state.ts';
import {computeThreatPoints,summaryHealthPercent} from './threat-points.ts';
import {isColonist} from './affiliation.ts';
import {TICKS_PER_DAY} from './types.ts';
import {createCampPressureMechanoidRaid260} from './mechanoid-raids.ts';
const notice=(root:CampaignState,map:World,message:string)=>{for(const rows of [map.events,root.worldGroups!.events]){rows.push({tick:root.tick,type:'command',message});if(rows.length>80)rows.splice(0,rows.length-80);}};
/** Real local values, same explicitly adapted AdventureStory threat helper as raids. */
export function campThreatPoints260(w:World):number|undefined {
 if(!w.economy||w.gameProfile?.difficulty!=='adventure-story')return;
 const free=w.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&!p.prisoner&&!p.visitor);
 return computeThreatPoints({timeFactorWholeDays:w.schemaVersion>=328,knownWealth:w.economy.wealth.knownStorytellerWealth,freeColonists:free.length,
  colonistHealthSum:free.reduce((n,p)=>n+(p.health?summaryHealthPercent(p.health):1),0),elapsedDays:w.tick/TICKS_PER_DAY,
  adaptationDays:w.economy.adaptationDays,seedBucket:Math.floor(w.tick/250)}).points*1.5;
}
/** Once per real campaign tick, after local actors, in stable map order. No catch-up loop. */
export function advanceCampPressure260(input:CampaignState):void {
 const root=registeredCampaign(input);if(root.schemaVersion<260||!root.worldMaps||!root.worldGroups)return;
 const core=root.tick*10;
 for(const site of root.worldMaps.sites.slice().sort((a,b)=>a.id-b.id)){
  const p=site.campPressure;if(!p)continue;
  const map=registeredMap(root,site.id);if(!(site.kind==='camp'||(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&site.kind==='battlefield')||!map){delete site.campPressure;continue;}
  if(p.notifyAtCore!==null&&core>=p.notifyAtCore){p.notifyAtCore=null;p.alert=true;notice(root,map,`Camp ${site.id} · détecté. Première tentative d’attaque dans ${Math.max(0,p.raidAtCore-core)/60000} jour(s).`);}
  if(core>=p.raidAtCore){
   // Real timer attempt spends its draw BEFORE producer failure/success, like Core.
   if(!Number.isSafeInteger(core+60000)||!Number.isSafeInteger(p.raidsSent+1))continue;
   const delay=45000+Math.floor(raidRandom(root)*15000);p.raidAtCore=core+delay;
   const points=campThreatPoints260(map),draft={rng:root.rng};
   const raid=points===undefined?null:site.battlefield261?.factionId!==undefined&&site.battlefield261.factionId!==null?createBattlefieldPressureHumanRaid261(map,points,draft):createCampPressureMechanoidRaid260(map,points,draft);
   if(raid){root.rng=draft.rng;p.raidsSent++;notice(root,map,`Camp ${site.id} · des adversaires arrivent réellement. Nouvelle tentative possible dans ${(delay/2500).toFixed(1)} h.`);}
  }
  flushRegisteredMap(map);
 }
}
