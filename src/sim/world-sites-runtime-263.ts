import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {registeredMap} from './world-map-context.ts';
import {isColonist} from './affiliation.ts';
import {computeThreatPoints,summaryHealthPercent} from './threat-points.ts';
import {newQuestCalendar263,advanceQuestPopulation263,advanceWorldQuestCalendar263,notifyItemStashBorn263,notifyTradeRequestBorn284,notifyPeaceTalksBorn293} from './world-quest-calendar-263.ts';
import {preparePeaceTalksBirth293} from './peace-talks-producer-293.ts';
import {prepareTradeRequestBirth284} from './trade-request-producer-284.ts';
import {logTradeRequest284} from './trade-request-runtime-284.ts';
import {prepareItemStashBirth263} from './world-site-producer-263.ts';
import {expireWorldSites263} from './world-site-holder-263.ts';
import type {World} from './types.ts';
import type {CampaignState} from './world-map-state.ts';
/** Real SIM only. Absence is preserved by every RAW migration/admission.
 * Adoption happens at the true current tick, skips the current quest cycle,
 * and grants no retrospective quest, Thing, history or RNG opportunity. */
export function advanceWorldSites263(root:CampaignState):void {
 if(!isSchema263OrLater(Number(root.schemaVersion))||root.planet?.revision!==3||!root.worldMaps||!root.worldGroups||!root.worldFactions||root.gameProfile?.storyteller!=='cassandra-partial'||root.gameProfile.difficulty!=='adventure-story')return;
 const people=[...root.worldMaps.sites.flatMap(s=>registeredMap(root,s.id)!.pawns),...root.worldGroups.groups.flatMap(r=>'members'in r.state?r.state.members:[])].filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead'&&!p.health?.death),ids=[...new Set(people.map(p=>p.id))],core=root.tick*10;
 root.worldSites263??={revision:1,nextId:1,entries:[]};const registry=root.worldSites263;
 registry.quest??=newQuestCalendar263(core,root.rng,ids);const calendar=registry.quest;
 advanceQuestPopulation263(calendar,core,ids);expireWorldSites263(root);
 if(core<calendar.nextCheckCore)return;
 const homes=root.worldMaps.sites.filter(s=>s.kind==='settlement').map(s=>registeredMap(root,s.id)!).filter(w=>!!w.economy),home=homes[0];
 // The one-colony reference uses its real sampled wealth and adaptation.
 // An absent valuation is a refused opportunity, never assumed free wealth.
 const wealth=home?.economy?.wealth.knownStorytellerWealth??0,adaptation=home?.economy?.adaptationDays??0;
 const points=home?computeThreatPoints({knownWealth:wealth,freeColonists:people.length,colonistHealthSum:people.reduce((sum,p)=>sum+(p.health?summaryHealthPercent(p.health):1),0),elapsedDays:root.tick/6000,adaptationDays:adaptation,seedBucket:Math.floor(root.tick/250)}).points:0;
 const selected=advanceWorldQuestCalendar263(calendar,core,{acceptAtHit329:Number(root.schemaVersion)>=329,points,progress:people.length+wealth*.0001,adjustedPopulation:people.length,hasFreeColonist:people.length>0,hasHomeMap:!!home,tradeRequests284:isSchema284OrLater(root.schemaVersion)&&!!root.tradeRequests284&&core>root.tradeRequests284.adoptedAtCore,peaceTalks293:(Number(root.schemaVersion)===293||(Number(root.schemaVersion)===294||(Number(root.schemaVersion)===295||(Number(root.schemaVersion)===296||isCorePhysicalSchema297(Number(root.schemaVersion))))))});
 if(selected==='peace-talks'){
  const offer=preparePeaceTalksBirth293(root);if(!offer.ok)return;offer.commit();notifyPeaceTalksBorn293(calendar);
  root.worldGroups.events.push({tick:root.tick,type:'command',message:'Une faction propose des pourparlers. Consultez Quêtes et envoyez une caravane au lieu indiqué.'});if(root.worldGroups.events.length>80)root.worldGroups.events.splice(0,root.worldGroups.events.length-80);return;
 }
 if(selected==='trade-request'){
  const offer=prepareTradeRequestBirth284(root);if(!offer.ok)return;offer.commit();notifyTradeRequestBorn284(calendar);
  logTradeRequest284(root,`Une demande commerciale de ${offer.request.settlementName} est disponible dans Quêtes.`);return;
 }
 if(selected!=='item-stash')return;
 const birth=prepareItemStashBirth263(root,points);if(!birth.ok)return;birth.commit();notifyItemStashBorn263(calendar);
 root.worldGroups.events.push({tick:root.tick,type:'command',message:'Un Site de cache est signalé sur la planète ; son contenu reste dans son véritable contenant jusqu’à votre arrivée.'});if(root.worldGroups.events.length>80)root.worldGroups.events.splice(0,root.worldGroups.events.length-80);
}
