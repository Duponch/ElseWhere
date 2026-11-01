import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validAiCoreInformationReceipt298} from './faction-comms-save-298.ts';
import {validationCore297} from './core-phase-297.ts';
import {validPeaceTalksSite293} from './peace-talks-save-293.ts';
import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {WORLD_FACTION_TECH_LEVEL_259} from './world-faction-catalog.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {validatePileRecordShape} from './material-record-save.ts';
import {isPerishable,ROT_DAYS} from './food-preservation.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {planetTileCount} from './planet-geography-256.ts';
import type {NumericMembershipSink} from './numeric-membership.ts';
import type {WorldMapRecord,CampaignState} from './world-map-state.ts';
import type {WorldSitesState263,WorldQuestCalendar263} from './world-sites-state-263.ts';
import type {MaterialPile} from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(r:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(r,k))&&Object.keys(r).every(k=>required.includes(k)||optional.includes(k));
function calendar(value:unknown,core:number,nextId:number,version:number):value is WorldQuestCalendar263 {
 if(!record(value)||!keys(value,['revision','adoptedAtCore','nextCheckCore','cycle','pendingCore','previousHitInterval','rng','opportunities','siteOffers','recent','populationAdaptationDays','populationAtCore','knownColonistIds']))return false;
 const s=value;
 return s.revision===1&&int(s.adoptedAtCore,0,core)&&s.adoptedAtCore%10===0&&int(s.nextCheckCore,core+1)&&s.nextCheckCore%1000===0&&s.nextCheckCore<=Math.floor(core/1000)*1000+1000&&int(s.cycle,0,Math.floor(core/600000))
  &&(s.pendingCore===null||int(s.pendingCore,core+1,(Number(s.cycle)+1)*600000-1)&&s.pendingCore%1000===0)
  &&int(s.previousHitInterval,-1000000,Math.floor(core/1000))&&int(s.rng,1,0xffffffff)&&int(s.opportunities)&&int(s.siteOffers,0,s.opportunities)
  &&Array.isArray(s.recent)&&s.recent.length<=5&&s.recent.length===Math.min(5,s.siteOffers)&&s.recent.every(x=>x==='item-stash'||isSchema284OrLater(version)&&x==='trade-request'||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))&&x==='peace-talks')
  &&typeof s.populationAdaptationDays==='number'&&Number.isFinite(s.populationAdaptationDays)&&s.populationAdaptationDays>=0&&Number.isInteger(s.populationAdaptationDays*2)
  &&int(s.populationAtCore,s.adoptedAtCore,core)&&s.populationAtCore%10===0&&Array.isArray(s.knownColonistIds)&&s.knownColonistIds.length<=4096&&s.knownColonistIds.every(id=>int(id,1,nextId-1))&&new Set(s.knownColonistIds).size===s.knownColonistIds.length;
}
export interface WorldSitesValidationContext263 {schemaVersion:number;tick:number;nextId:number;planet?:CampaignState['planet'];worldFactions?:CampaignState['worldFactions'];worldSites263?:unknown;worldMaps?:{sites:readonly Pick<WorldMapRecord,'id'|'tile'|'target263'>[]}}
/** The old262 validator must be called first by migration. Field presence,
 * even ownundefined, is rejected below for every non263 version. The existing
 * plain-data reader runs before nested value reads, including held owners. */
export function validateWorldSites263(value:unknown,root:WorldSitesValidationContext263,globalIds:NumericMembershipSink,coreNow298?:number):string[] {
 if(!isSchema263OrLater(Number(root.schemaVersion)))return Object.hasOwn(root,'worldSites263')||value!==undefined?['Future263 world Sites in an older campaign.']:[];
 if(value===undefined)return Object.hasOwn(root,'worldSites263')?['Undefined263 Site authority.']:[];
 if(!plainWorldPawnData256(value)||!record(value)||!keys(value,['revision','nextId','entries'],['quest'])||value.revision!==1||!int(value.nextId,1)||!Array.isArray(value.entries)||value.entries.length>4096||Object.hasOwn(value,'quest')&&!calendar(value.quest,root.tick*10,root.nextId,root.schemaVersion))return ['Invalid263 world Site authority.'];
 const sites=value as unknown as WorldSitesState263,ids=new Set<number>(),activeTiles=new Set<number>(),peaceTags=new Set<string>(),peaceActiveFactions=new Set<number>(),core=isSchema298OrLater(Number(root.schemaVersion))?validationCore297(298,root.tick,coreNow298):root.tick*10,factions=root.worldFactions;
 if(!Number.isSafeInteger(core))return ['Current298 Site authority requires its actual physical frontier.'];
 if(!factions||!root.planet)return ['Site authority requires the actual faction and planet registries.'];
 for(const raw of sites.entries){
  const paid=record(raw)&&'aiCoreInformation298'in raw;
  if(!record(raw)||!keys(raw,['id','tile','factionId','createdAtCore','mapId','kind'],['enterCooldownUntilCore','sourceSettlementId','expiresAtCore','heldAtCore','items','threat','closed','questTag','aiCoreInformation298'])||!int(raw.id,1,sites.nextId-1)||ids.has(raw.id)||!int(raw.tile,0,planetTileCount(root.planet)-1)||!int(raw.createdAtCore,0,core)||raw.createdAtCore%10&&!paid||raw.factionId!==null&&(!int(raw.factionId,1)||!factions.factions.some(f=>f.id===raw.factionId))||raw.mapId!==null&&!int(raw.mapId)||Object.hasOwn(raw,'enterCooldownUntilCore')&&!int(raw.enterCooldownUntilCore,0))return ['Invalid263 world Site header.'];
  if(paid&&(raw.kind!=='item-stash'||!validAiCoreInformationReceipt298(raw,root.schemaVersion,root.nextId,root.tick,core)))return ['Invalid paid AI information receipt.'];
  ids.add(raw.id);
  if(raw.kind==='peace-talks'){
   if(!validPeaceTalksSite293(raw,root)||peaceTags.has(raw.questTag))return ['Invalid or duplicate PeaceTalks site/tag receipt.'];peaceTags.add(raw.questTag);
   if(!raw.closed){if(peaceActiveFactions.has(raw.factionId))return ['Two active PeaceTalks offers share a faction.'];peaceActiveFactions.add(raw.factionId);}
  }else if(raw.kind==='destroyed-settlement'){
   if(!keys(raw,['id','tile','factionId','createdAtCore','mapId','kind','sourceSettlementId'],['enterCooldownUntilCore'])||!int(raw.factionId,1)||!int(raw.sourceSettlementId,1)||factions.settlements.some(s=>s.id===raw.sourceSettlementId))return ['Invalid destroyed foreign settlement.'];
  }else if(raw.kind==='item-stash'){
   if(!keys(raw,['id','tile','factionId','createdAtCore','mapId','kind','expiresAtCore','heldAtCore','items','threat'],['enterCooldownUntilCore','closed','aiCoreInformation298'])||raw.expiresAtCore!==null&&!int(raw.expiresAtCore,Number(raw.createdAtCore)+1)||!int(raw.heldAtCore,Number(raw.createdAtCore),core)||raw.heldAtCore%10&&!paid||!Array.isArray(raw.items)||raw.items.length>64||!record(raw.threat))return ['Invalid ItemStash holder.'];
   if(paid){const receipt=raw.aiCoreInformation298 as unknown as import('./faction-comms-state-298.ts').AiCoreInformationReceipt298;
    if(raw.heldAtCore!==raw.createdAtCore||raw.mapId===null&&!Object.hasOwn(raw,'closed')&&(raw.items.length!==1||!record(raw.items[0])||raw.items[0].id!==receipt.coreId||raw.items[0].item!=='ai-core'||raw.items[0].kind!=='ai-core'||raw.items[0].quantity!==1))return ['Paid unvisited Site must own its single actual AI original.'];
   }
   const threat=raw.threat;
   if(threat.kind==='none'){
    if(!keys(threat,['kind'])||raw.factionId!==null)return ['Invalid peaceful ItemStash.'];
   }else{
    const threatFactionId=Object.getOwnPropertyDescriptor(threat,'factionId')?.value;
    const human=['outpost','turrets'].includes(String(threat.kind));
    if(!human&&!['ambush-edge','ambush-hidden','manhunters','sleeping-mechanoids'].includes(String(threat.kind))||!keys(threat,human?['kind','factionId','points']:['kind','points'])||(human?(threatFactionId!==raw.factionId||!int(threatFactionId,1)):raw.factionId!==null))return ['Invalid ItemStash threat binding.'];
    if(threat.kind==='turrets'&&!factions.factions.some(f=>f.id===threatFactionId&&WORLD_FACTION_TECH_LEVEL_259[f.def]>=4))return ['ItemStash turrets require their actual industrial faction.'];
    if(typeof threat.points!=='number'||!Number.isFinite(threat.points)||threat.points<0||threat.points>10000)return ['Invalid ItemStash threat points.'];
   }
   if(raw.mapId!==null&&(raw.items.length||raw.expiresAtCore!==null))return ['A generated Site cannot also own unspawned contents or timeout.'];
   if(Object.hasOwn(raw,'closed')){
    const closed=raw.closed;if(!record(closed)||!keys(closed,['atCore','reason','lost'])||!int(closed.atCore,Number(raw.createdAtCore),core)||closed.atCore%10||!['expired','map-removed'].includes(String(closed.reason))||!Array.isArray(closed.lost)||raw.items.length||raw.mapId!==null)return ['Invalid retired Site receipt.'];
    const lost=new Set<number>();for(const p of closed.lost){if(!record(p)||!keys(p,['id','item','quantity'])||!int(p.id,1,root.nextId-1)||lost.has(p.id)||typeof p.item!=='string'||!Object.hasOwn(ITEM_DEFINITIONS,p.item)||!int(p.quantity,1,ITEM_DEFINITIONS[p.item as keyof typeof ITEM_DEFINITIONS].stackLimit))return ['Invalid retired Site Thing receipt.'];lost.add(p.id);}
   }
   for(const p of raw.items){
    if(!record(p)||!int(p.id,1,root.nextId-1)||globalIds.has(p.id)||!record(p.owner)||p.owner.type!=='world-site263'||p.owner.siteId!==raw.id||!keys(p.owner,['type','siteId']))return ['Duplicate or invalid263 held Site Thing.'];
    const holderTick=paid?Math.floor(Number(raw.heldAtCore)/10):Number(raw.heldAtCore)/10,context={width:1,height:1,tick:holderTick,nextId:root.nextId,climate:undefined};
    if(validatePileRecordShape(p,context,root.schemaVersion,holderTick,undefined,Number(raw.id)).length)return ['Invalid original Site Thing payload.'];
    const pile=p as unknown as MaterialPile;if(isPerishable(pile.item)&&(!pile.rot||pile.rot.atTick!==holderTick||pile.rot.rate!==0||pile.rot.progress<0||pile.rot.progress>=ROT_DAYS[pile.item]*6000))return ['Site contents must remain genuinely frozen.'];
    globalIds.add(p.id);
   }
  }else return ['Unknown263 world Site kind.'];
  const closed=Object.hasOwn(raw,'closed');if(!closed){if(activeTiles.has(Number(raw.tile)))return ['Two active world Sites share a tile.'];activeTiles.add(Number(raw.tile));}
  if(raw.mapId!==null){const map=root.worldMaps?.sites.find(m=>m.id===raw.mapId),target=map?.target263;if(!map||map.tile!==raw.tile||!target||(raw.kind==='item-stash'?target.kind!=='quest-site'||target.siteId!==raw.id:target.kind!=='foreign-settlement'||target.destroyedSiteId!==raw.id||target.factionId!==raw.factionId))return ['World Site/map binding differs from its actual owner.'];}
 }
 return [];
}
