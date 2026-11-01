import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {PEACE_TALKS_OUTCOMES_293,type PeaceTalksSite293} from './peace-talks-state-293.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {tradeCatalogueEntry} from './trade-catalogue.ts';
import {groupCaravanUnitMass256} from './group-caravan-mass-256.ts';
import {worldGoodwillChange274,worldNaturalGoodwill274,validWorldRelationKind274} from './world-diplomacy-274.ts';
import {planetTileCount} from './planet-geography-256.ts';
import type {World} from './types.ts';
import type {WorldSitesValidationContext263} from './world-sites-save-263.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const data=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;};
const keys=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>!!data(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&!!data(v,k));
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const finite=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const core=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>int(v,min,max)&&v%10===0;
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>!!data(v,String(i))).every(Boolean);
export function validPeaceTalksArrival293(value:unknown,version:number):boolean {
 return (version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))&&keys(value,['kind','siteId'])&&value.kind==='peace-talks'&&int(value.siteId,1);
}
/** Contextual scalar admission. No diplomatic birth gate is reapplied on load. */
export function validPeaceTalksSite293(value:unknown,c:WorldSitesValidationContext263):value is PeaceTalksSite293 {
 try{
  if((Number(c.schemaVersion)!==293&&(Number(c.schemaVersion)!==294&&(Number(c.schemaVersion)!==295&&(Number(c.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(c.schemaVersion))))))||!keys(value,['kind','id','tile','factionId','createdAtCore','expiresAtCore','mapId','questTag'],['closed'])||value.kind!=='peace-talks'||value.mapId!==null
   ||!int(value.id,1)||!int(value.tile)||!int(value.factionId,1)||!core(value.createdAtCore,0,c.tick*10)||!int(value.expiresAtCore,Number(value.createdAtCore)+720000,Number(value.createdAtCore)+1680000)||(Number(value.expiresAtCore)-Number(value.createdAtCore))%60000
   ||typeof value.questTag!=='string'||!value.questTag.startsWith('PeaceTalks_')||value.questTag.length<=11||value.questTag.length>256)return false;
  const faction=c.worldFactions?.factions.find(f=>f.id===value.factionId);if(!faction||!c.planet||value.tile>=planetTileCount(c.planet)||value.factionId===c.worldFactions!.playerFactionId)return false;
  if(!Object.hasOwn(value,'closed'))return true;
  const closed=value.closed;if(!keys(closed,['atCore','reason'],closed&&plain(closed)&&closed.reason==='resolved'?['result']:[])||!core(closed.atCore,Number(value.createdAtCore),c.tick*10))return false;
  if(closed.reason==='expired')return !Object.hasOwn(closed,'result')&&closed.atCore>=Number(value.expiresAtCore);
  if(closed.reason!=='resolved'||closed.atCore>=Number(value.expiresAtCore))return false;
  const r=closed.result;if(!keys(r,['groupId','negotiatorId','outcome','negotiationAbility','goodwill','socialXp'],['reward','attack'])||!int(r.groupId,1,(c.planet?.nextGroupId??Number.MAX_SAFE_INTEGER)-1)||!int(r.negotiatorId,1,c.nextId-1)||!PEACE_TALKS_OUTCOMES_293.some(x=>x===r.outcome)||!finite(r.negotiationAbility,.4,100))return false;
  const xp=r.socialXp;if(!keys(xp,['direct','requested','credited'])||xp.direct!==true||xp.requested!==6000||!finite(xp.credited,0,9000)||Math.abs(xp.credited*1000-Math.round(xp.credited*1000))>1e-6)return false;
  const g=r.goodwill;if(!keys(g,['before','kindBefore','requested','adjusted','after','kindAfter'])||!int(g.before,-100,100)||!int(g.requested,-175,110)||!int(g.adjusted,-300,200)||!int(g.after,-100,100)||!validWorldRelationKind274(g.before,g.kindBefore,293))return false;
  const request=g.requested;
  if(r.outcome==='disaster'?request<Math.min(-50,g.kindBefore==='hostile'?0:-75-g.before)||request>Math.min(-40,g.kindBefore==='hostile'?0:-75-g.before):r.outcome==='backfire'?request< -20||request> -10:r.outcome==='flounder'?request!==0:r.outcome==='success'?request<60||request>70:request<100||request>110)return false;
  const natural=worldNaturalGoodwill274(faction),change=natural===undefined?undefined:worldGoodwillChange274(g.before,g.kindBefore as import('./world-faction-catalog.ts').WorldFactionRelationKind256,natural,request);
  if(!change||g.adjusted!==change.adjustedGain||g.after!==change.goodwillAfter||g.kindAfter!==change.kindAfter)return false;
  if(Object.hasOwn(r,'reward')!==(r.outcome==='triumph')||Object.hasOwn(r,'attack')!==(r.outcome==='disaster'))return false;
  if(r.outcome==='triumph'){
   const reward=r.reward;if(!keys(reward,['budget','marketValue','massGrams','delivered'])||!int(reward.budget,500,1200)||!finite(reward.marketValue,500,1200)||!int(reward.massGrams,1,20000)||!dense(reward.delivered,16)||!reward.delivered.length)return false;
   let market=0,mass=0;const ids=new Set<number>();
   for(const d of reward.delivered){if(!keys(d,['id','item','quantity','carrierId'],['quality'])||!int(d.id,1,c.nextId-1)||ids.has(d.id)||!int(d.carrierId,1,c.nextId-1)||typeof d.item!=='string'||!Object.hasOwn(ITEM_DEFINITIONS,d.item))return false;
    const item=d.item as keyof typeof ITEM_DEFINITIONS,def=ITEM_DEFINITIONS[item],price=tradeCatalogueEntry(item),unitMass=groupCaravanUnitMass256(item,true,293);
    // The explicitly finite V473 reward palette has no gear, condition or quality.
    if(!['gold','jade','component','medicine','plasteel','uranium','advanced-component','glitterworld-medicine'].includes(item)||!int(d.quantity,1,def.stackLimit)||Object.hasOwn(d,'quality')||!price||unitMass===undefined)return false;
    ids.add(d.id);market+=price.baseMarketValue*d.quantity;mass+=unitMass*d.quantity;
   }
   if(Math.abs(market-reward.marketValue)>1e-6||mass!==reward.massGrams)return false;
  }
  if(r.outcome==='disaster'){
   const a=r.attack;if(!plain(a)||!keys(a,a.phase==='pending'?['phase','groupId','points','enemyIds']:['phase','mapId','atCore','points','enemyIds'])||!finite(a.points,0,10000)||!dense(a.enemyIds,c.nextId)||!a.enemyIds.length||!a.enemyIds.every(id=>int(id,1,c.nextId-1))||new Set(a.enemyIds).size!==a.enemyIds.length)return false;
   if(a.phase==='pending'){if(a.groupId!==r.groupId)return false;}else if(a.phase!=='entered'||!int(a.mapId)||!core(a.atCore,closed.atCore,c.tick*10))return false;
  }
  return true;
 }catch{return false;}
}

/** Only registry/transport envelopes: never inspect terrain, Things or actors. */
export function validPeaceTalksHistorical293(raw:unknown,version:unknown):boolean {
 if(!int(version,1,300))return false;
 const active=new Set<object>();let budget=100000;
 const lanes=['world','summary','dynamic','campaign','worldMaps','worldGroups','campaignMap','secondarySite','map','worldSites263','sites','maps','entries','groups','group','state','pending261','arrival261','battlefield261','retained','destination','action','quest','recent'] as const;
 const visit=(v:unknown,lane:string):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(Array.isArray(v)){if(!dense(v,100000)||active.has(v))return false;active.add(v);for(const x of v){if(lane==='recent'&&x==='peace-talks'&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))))||!visit(x,lane==='entries'?'entry':lane))return false;}active.delete(v);return true;}
  if(!plain(v)||active.has(v))return false;active.add(v);
  const kind=data(v,'kind');if('kind'in v&&!kind)return false;
  if(kind?.value==='peace-talks'&&((version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))))||!['entry','action','pending261','battlefield261'].includes(lane)))return false;
  if(kind?.value==='peace-talks'&&Reflect.ownKeys(v).some(k=>typeof k!=='string'||!data(v,k)))return false;
  for(const key of ['peaceTalksSiteId293','questTag'])if(key in v){if((version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))))||!data(v,key)||(key==='questTag'?lane!=='entry':!['pending261','battlefield261'].includes(lane)))return false;}
  if('upserted'in v){const d=data(v,'upserted');if(!d||!visit(d.value,lane))return false;}
  for(const key of lanes){if(!(key in v))continue;const d=data(v,key);if(!d)return false;if(!visit(d.value,key))return false;}
  active.delete(v);return true;
 };
 try{return visit(raw,'world');}catch{return false;}
}

/** Shared scalar references remain valid in an unpublished local generator.
 * This is never sufficient for campaign admission or publication. */
export function validPeaceTalksRegistryScalars293(value:unknown):boolean {
 try{
  if(!plain(value)||!int(value.schemaVersion,1,300))return false;
  if((Number(value.schemaVersion)!==293&&(Number(value.schemaVersion)!==294&&(Number(value.schemaVersion)!==295&&(Number(value.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(value.schemaVersion)))))))return validPeaceTalksHistorical293(value,value.schemaVersion);
  const d=data(value,'worldSites263');if(!d)return !('worldSites263'in value);
  const registry=d.value;if(!keys(registry,['revision','nextId','entries'],['quest'])||registry.revision!==1||!int(registry.nextId,1)||!dense(registry.entries,4096))return false;
  const w=value as unknown as World,ids=new Set<number>(),tags=new Set<string>(),activeFactions=new Set<number>();
  for(const site of registry.entries){if(!plain(site)||!data(site,'kind'))return false;
   const id=data(site,'id')?.value;if(!int(id,1,registry.nextId-1)||ids.has(id))return false;ids.add(id);
   if(site.kind==='peace-talks'){
   if(!validPeaceTalksSite293(site,w)||!int(site.id,1,registry.nextId-1)||tags.has(site.questTag))return false;tags.add(site.questTag);
   if(!site.closed){if(activeFactions.has(site.factionId))return false;activeFactions.add(site.factionId);}
  }else if('questTag'in site)return false;
  }
  return true;
 }catch{return false;}
}

/** Reciprocal registry bindings, on either real authority or composed projection.
 * Terminal actor/Thing IDs are historical: no present-owner search is performed. */
export function validPeaceTalksBindings293(value:unknown):boolean {
 try{
  if(!validPeaceTalksRegistryScalars293(value)||!plain(value))return false;
  if((Number(value.schemaVersion)!==293&&(Number(value.schemaVersion)!==294&&(Number(value.schemaVersion)!==295&&(Number(value.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(value.schemaVersion)))))))return true;
  const w=value as unknown as World,sites=w.worldSites263?.entries??[];
  const byId=new Map(sites.map(s=>[s.id,s]));
  const meta=w.campaignMap?.revision===2?w.campaignMap:undefined;
  const groups=w.worldGroups?.groups??meta?.groups??(Array.isArray(value.groups)?value.groups:[]) as import('./world-map-state.ts').WorldGroupRecord[];
  const maps=w.worldMaps?.sites??meta?.maps??(Array.isArray(value.maps)?value.maps:[]) as import('./world-map-state.ts').WorldMapRecord[];
  const checkAction=(a:unknown,tile?:number)=>{if(!plain(a)||a.kind!=='peace-talks')return true;if(!validPeaceTalksArrival293(a,293))return false;const site=byId.get(Number(a.siteId));return site?.kind==='peace-talks'&&(tile===undefined||site.tile===tile);};
  const pendingSites=new Set<number>(),enteredSites=new Set<number>();
  for(const g of groups){if(g.arrival261&&!checkAction(g.arrival261.action,g.arrival261.tile))return false;const p=g.pending261;if(p?.kind!=='peace-talks')continue;
   if(!keys(p,['revision','kind','decision','peaceTalksSiteId293','atCore','factionId','people','animals','items','packed'])||p.revision!==1||p.decision!=='forced'||p.atCore!==w.tick*10||g.localMapId!==null||!('members'in g.state)||g.state.segment!==null||!dense(p.people,w.nextId)||!dense(p.animals,0)||!dense(p.items,w.nextId)||!dense(p.packed,w.nextId))return false;
   const site=byId.get(p.peaceTalksSiteId293);
   if(site?.kind!=='peace-talks'||site.closed?.reason!=='resolved')return false;const r=site.closed.result,a=r.attack;
   if(r.outcome!=='disaster'||a?.phase!=='pending'||a.groupId!==g.state.id||p.factionId!==site.factionId||site.tile!==('members'in g.state?g.state.tile:undefined)||site.closed.atCore!==p.atCore||a.enemyIds.length!==p.people.length||a.enemyIds.some((id,i)=>id!==p.people[i]!.id)||pendingSites.has(site.id))return false;
   pendingSites.add(site.id);
  }
  for(const m of maps){const b=m.battlefield261;if(!b)continue;const d=b.retained.destination;if(d&&!checkAction(d.action,d.tile))return false;if(b.kind!=='peace-talks')continue;
   if(!keys(b,['revision','kind','won','factionId','retained','peaceTalksSiteId293'])||b.revision!==1||typeof b.won!=='boolean')return false;const site=byId.get(b.peaceTalksSiteId293);
   if(site?.kind!=='peace-talks'||site.closed?.reason!=='resolved')return false;const r=site.closed.result,a=r.attack;
   if(r.outcome!=='disaster'||a?.phase!=='entered'||a.mapId!==m.id||m.kind!=='battlefield'||m.tile!==site.tile||m.createdAt*10>a.atCore||b.factionId!==site.factionId||enteredSites.has(site.id))return false;enteredSites.add(site.id);
  }
  for(const site of sites){if(site.kind!=='peace-talks'||site.closed?.reason!=='resolved')continue;const a=site.closed.result.attack;
   if(a?.phase==='pending'&&!pendingSites.has(site.id))return false;
   if(a?.phase==='entered'){
    if(w.worldMaps){
     if(!int(a.mapId,0,w.worldMaps.nextMapId-1))return false;
     const live=w.worldMaps.sites.find(m=>m.id===a.mapId);
     if(live){if(!enteredSites.has(site.id))return false;}
     else {const retired=w.worldMaps.retired.find(m=>m.id===a.mapId);if(!retired||retired.kind!=='battlefield'||retired.tile!==site.tile||retired.createdAt*10>a.atCore||retired.removedAt*10<a.atCore)return false;}
    }else if(maps.some(m=>m.id===a.mapId)&&!enteredSites.has(site.id))return false;
   }
  }
  return true;
 }catch{return false;}
}
