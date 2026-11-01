import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {planetGeography256} from './planet-geography-256.ts';
import {worldBiomeCanSettle} from './world-biome-properties.ts';
import {worldSettlementAccess256} from './world-faction-access.ts';
import {WORLD_FACTION_DEFINITIONS_256} from './world-faction-catalog.ts';
import type {CampaignState,WorldMapRecord,WorldGroupRecord,CampaignSummary} from './world-map-state.ts';
import type {World,CommandResult} from './types.ts';
import type {WorldFactionSettlement256} from './world-faction-state.ts';
import type {WorldEntryTarget263,ItemStash263,ForeignSettlementAdmission263} from './world-sites-state-263.ts';

const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k)!;return typeof k==='string'&&d.enumerable&&Object.hasOwn(d,'value');});
const int=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
/** Command and save readers share this narrow shape; no accessor is read. */
export function validWorldEntryTarget263(value:unknown):value is WorldEntryTarget263 {
 if(!data(value))return false;
 return value.kind==='attack-settlement'?Object.keys(value).length===4&&['kind','settlementId','factionId','confirmed'].every(k=>Object.hasOwn(value,k))&&int(value.settlementId,1)&&int(value.factionId,1)&&value.confirmed===true
  :value.kind==='visit-site'&&Object.keys(value).length===2&&Object.hasOwn(value,'siteId')&&int(value.siteId,1);
}
type ActualSettlement263=WorldFactionSettlement256&{attack263?:ForeignSettlementAdmission263};
type TargetMapHeader263=Pick<WorldMapRecord,'id'|'tile'|'kind'|'target263'>;
type TargetAuthority263=Pick<CampaignState,'schemaVersion'|'tick'|'planet'|'worldFactions'|'worldSites263'>;
export type WorldTargetAccess263={ok:false;reason:string}|{ok:true;tile:number;map:TargetMapHeader263|undefined;source:{kind:'foreign-settlement';settlement:ActualSettlement263;factionId:number}|{kind:'quest-site';site:ItemStash263;factionId:number|null}};
/** Pure globe/order admission, repeated at actual arrival and before commit.
 * The target is its real existing world object. No object, actor, map, stock,
 * faction hostility or retained history is created by this reader. */
export function worldTargetAccess263(root:CampaignState,target:WorldEntryTarget263,tile:number):WorldTargetAccess263 {
 return access263(root,target,tile,root.worldMaps?.sites??[]);
}
function access263(root:TargetAuthority263,target:WorldEntryTarget263,tile:number,maps:readonly TargetMapHeader263[]):WorldTargetAccess263 {
 const no=(reason:string):WorldTargetAccess263=>({ok:false,reason});
 if(!isSchema263OrLater(Number(root.schemaVersion))||!validWorldEntryTarget263(target)||root.planet?.revision!==3||!root.worldFactions)return no('Le vrai contexte géographique263 est absent.');
 const surface=planetGeography256(root.planet).surface,t=surface.tiles[tile];
 if(!t||t.id!==tile||!worldBiomeCanSettle(t.biome)||t.hilliness==='impassable')return no('Cette tuile ne permet pas la vraie génération locale.');
 if(target.kind==='attack-settlement'){
  const a=worldSettlementAccess256(root.worldFactions,target.settlementId);
  if(!a.ok||a.settlement.tile!==tile||a.settlement.factionId!==target.factionId||target.factionId===root.worldFactions.playerFactionId)return no('L’établissement étranger ou sa vraie faction a changé.');
  const owner=root.worldFactions.factions.find(f=>f.id===target.factionId)!;
  if(!WORLD_FACTION_DEFINITIONS_256[owner.def].humanlike||owner.lifecycle259?.defeated)return no('Cette faction ne possède plus cet établissement attaquable.');
  const settlement=a.settlement as ActualSettlement263,map=maps.find(s=>s.tile===tile),binding=settlement.attack263;
  if(map&&(map.kind!=='foreign-settlement'||map.target263?.kind!=='foreign-settlement'||map.target263.settlementId!==settlement.id||binding?.mapId!==map.id))return no('Une autre carte détient cette tuile.');
  if(!map&&binding?.mapId!==undefined&&binding.mapId!==null)return no('La vraie carte de cet établissement est absente.');
  if(!map&&(binding?.cooldownUntilCore??0)>root.tick*10)return no('Le délai de retour dans cet établissement est encore actif.');
  return {ok:true,tile,map,source:{kind:'foreign-settlement',settlement,factionId:target.factionId}};
 }
 const site=root.worldSites263?.entries.find(s=>s.id===target.siteId);
 if(!site||site.kind!=='item-stash'||site.closed||site.tile!==tile)return no('Le vrai Site de cache est absent ou retiré.');
 const map=maps.find(s=>s.tile===tile);
 if(map&&(map.kind!=='quest-site'||map.target263?.kind!=='quest-site'||map.target263.siteId!==site.id||site.mapId!==map.id))return no('Une autre carte détient cette tuile de Site.');
 if(!map&&site.mapId!==null)return no('La carte réelle de ce Site est absente.');
 if(!map&&((site.enterCooldownUntilCore??0)>root.tick*10||site.expiresAtCore===null||site.expiresAtCore<=root.tick*10))return no('Ce Site ne peut plus être visité maintenant.');
 return {ok:true,tile,map,source:{kind:'quest-site',site,factionId:site.factionId}};
}
/** Same reader for confirmed MAIN projections. It returns scalar admission
 * only; no body/private source object escapes into a UI action payload. */
export function worldTargetActions263(view:World|CampaignState|CampaignSummary,target:WorldEntryTarget263,tile:number):{ok:boolean;reason?:string} {
 const maps='maps'in view?view.maps:view.worldMaps?.sites??('campaignMap'in view&&view.campaignMap?.revision===2?view.campaignMap.maps:[]);
 const result=access263(view,target,tile,maps);return result.ok?{ok:true}:{ok:false,reason:result.reason};
}
/** Both real threatened target families use the already existing individual
 * physical exit authority. This is admission of their actual map-parent,
 * never a Battlefield alias or a threat bypass for Reform. */
export function worldTargetRetreatAvailable263(view:Pick<CampaignState,'schemaVersion'|'worldFactions'|'worldSites263'>,map:TargetMapHeader263):boolean {
 if(!isSchema263OrLater(Number(view.schemaVersion))||!map.target263)return false;
 const target=map.target263;
 if(map.kind==='quest-site'&&target.kind==='quest-site')return !!view.worldSites263?.entries.some(s=>s.kind==='item-stash'&&!s.closed&&s.id===target.siteId&&s.mapId===map.id&&s.tile===map.tile);
 if(map.kind!=='foreign-settlement'||target.kind!=='foreign-settlement')return false;
 if(target.destroyedSiteId!==undefined)return !!view.worldSites263?.entries.some(s=>s.kind==='destroyed-settlement'&&s.id===target.destroyedSiteId&&s.sourceSettlementId===target.settlementId&&s.factionId===target.factionId&&s.mapId===map.id&&s.tile===map.tile);
 return !!view.worldFactions?.settlements.some(s=>s.id===target.settlementId&&s.factionId===target.factionId&&s.tile===map.tile&&s.attack263?.mapId===map.id);
}
/** Called only by real route completion, not an order preview. Holding this
 * accepted request pauses the worker's future ticks while its private full
 * generation yields. Cold reload resumes this same scalar target request. */
export function queueWorldTargetEntry263(root:CampaignState,record:WorldGroupRecord,target:WorldEntryTarget263):boolean {
 const g=record.state;if(!root.worldGroups?.groups.includes(record)||record.localMapId!==null||record.pending261||record.pendingEntry263||!('members'in g)||g.segment||!['at-site','awaiting-entry'].includes(g.phase)||g.tile!==g.destination||g.lastPersonalTick!==root.tick||!worldTargetAccess263(root,target,g.tile).ok)return false;
 const d=Object.getOwnPropertyDescriptor(record,'pendingEntry263');if(d?!Object.hasOwn(d,'value')||!d.writable:!Object.isExtensible(record)||'pendingEntry263'in record)return false;
 record.pendingEntry263={revision:1,requestedAtCore:root.tick*10,target:{...target}};return true;
}
/** Same-tile VisitSite298 is an actual StartPath/arrival command, not a quote.
 * Stop only its route control, then accept the scalar entry in one transaction.
 * requestedAtCore remains the historical MACRO conservation stamp used by both
 * save/projection readers; it is not the exact physical clock of Native arrival.
 * No clock, physiology, material owner, RNG or allocator is advanced here. */
export function queueWorldTargetEntryAtTile298(root:CampaignState,record:WorldGroupRecord,target:WorldEntryTarget263):boolean {
 const g=record.state;
 if(!isSchema298OrLater(Number(root.schemaVersion))||target.kind!=='visit-site'||!root.planet||!root.worldGroups?.groups.includes(record)||record.localMapId!==null||!record.encounters261||record.pending261||record.pendingEntry263||!('members'in g)||g.lastPersonalTick!==root.tick||!worldTargetAccess263(root,target,g.tile).ok)return false;
 const state=Object.getOwnPropertyDescriptor(record,'state'),pendingField=Object.getOwnPropertyDescriptor(record,'pendingEntry263'),arrival=Object.getOwnPropertyDescriptor(record,'arrival261');
 if(!state||!Object.hasOwn(state,'value')||state.value!==g||!state.writable||(pendingField?!Object.hasOwn(pendingField,'value')||!pendingField.writable:!Object.isExtensible(record)||'pendingEntry263'in record)||(arrival?!Object.hasOwn(arrival,'value')||!arrival.configurable:'arrival261'in record))return false;
 const phase=g.tile===root.planet.homeTile?'awaiting-entry' as const:'at-site' as const;
 const stopped:typeof g={...g,destination:g.tile,route:[g.tile],segment:null,phase,stop:{kind:phase},paused:false};
 const pending:NonNullable<WorldGroupRecord['pendingEntry263']>={revision:1,requestedAtCore:root.tick*10,target:{...target}};
 // All three own data recipients were admitted before the first write.
 record.state=stopped;if(arrival)delete record.arrival261;record.pendingEntry263=pending;return true;
}
export function pendingWorldEntry263(root:CampaignState):{groupId:number;pending:NonNullable<WorldGroupRecord['pendingEntry263']>}|null {
 if(!isSchema263OrLater(Number(root.schemaVersion)))return null;
 const record=root.worldGroups?.groups.find(r=>r.pendingEntry263);return record?.pendingEntry263?{groupId:record.state.id,pending:record.pendingEntry263}:null;
}
/** Existing order channel, same actual pending identity. Retrying does not
 * reroll/reroute; cancelling releases only the accepted entry request. */
export function pendingWorldTargetOrder263(root:CampaignState,record:WorldGroupRecord,destination:number,action:import('./caravan-encounter-state-261.ts').RetainedArrival261):CommandResult|undefined {
 const pending=record.pendingEntry263;if(!pending)return undefined;
 const g=record.state,no=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
 if(!isSchema263OrLater(Number(root.schemaVersion))||record.localMapId!==null||!('members'in g)||g.segment||g.tile!==destination||g.lastPersonalTick!==root.tick||!['at-site','awaiting-entry'].includes(g.phase))return no('Cette vraie préparation d’entrée ne peut pas être redirigée.');
 if(action===null){const d=Object.getOwnPropertyDescriptor(record,'pendingEntry263');if(!d||!Object.hasOwn(d,'value')||d.configurable!==true)return no('La vraie préparation ne peut pas être annulée.');delete record.pendingEntry263;return {ok:true};}
 if(!validWorldEntryTarget263(action)||action.kind!==pending.target.kind||(action.kind==='attack-settlement'?pending.target.kind!=='attack-settlement'||action.settlementId!==pending.target.settlementId||action.factionId!==pending.target.factionId:pending.target.kind!=='visit-site'||action.siteId!==pending.target.siteId))return no('Réessayez la même entrée ou annulez sa préparation.');
 const access=worldTargetAccess263(root,action,destination);return access.ok?{ok:true}:no(access.reason);
}
