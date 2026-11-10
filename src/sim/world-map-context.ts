import {isSchema298OrLater} from './schema-compatibility-257.ts';
import type {GroupMemberProjectionContext} from './group-reorganization-state.ts';
import {calendarTick} from './calendar.ts';
import {CAMPAIGN_FIELDS} from './secondary-site-state.ts';
import type {World} from './types.ts';
import type {CampaignState,LocalMapState,WorldMapRecord,WorldGroupRecord,CampaignSummary,SharedCampaignState} from './world-map-state.ts';
const shared=new Set<string>([...CAMPAIGN_FIELDS,'worldMaps','worldGroups']);
const presentation=new Set(['secondarySite','campaignPeople','campaignMap','group','groupLosses','civilianPost']);
/* One accessor pair per shared field, each its own function literal reading a
 * named property: closures made from one literal share a property cache, and
 * a single `root[key]` getter for every field kept that cache megamorphic on
 * each read of tick, nextId or schemaVersion. Same reads and writes. */
type SharedRoot=Record<string,unknown>;
const SHARED_ACCESSORS:Readonly<Record<string,(r:SharedRoot)=>{get():unknown;set(value:unknown):void}>>={
 schemaVersion:r=>({get:()=>r.schemaVersion,set:value=>{r.schemaVersion=value;}}),
 tick:r=>({get:()=>r.tick,set:value=>{r.tick=value;}}),
 phaseCore297:r=>({get:()=>r.phaseCore297,set:value=>{r.phaseCore297=value;}}),
 rng:r=>({get:()=>r.rng,set:value=>{r.rng=value;}}),
 nextId:r=>({get:()=>r.nextId,set:value=>{r.nextId=value;}}),
 planet:r=>({get:()=>r.planet,set:value=>{r.planet=value;}}),
 worldFactions:r=>({get:()=>r.worldFactions,set:value=>{r.worldFactions=value;}}),
 worldPawns:r=>({get:()=>r.worldPawns,set:value=>{r.worldPawns=value;}}),
 escapedShips298:r=>({get:()=>r.escapedShips298,set:value=>{r.escapedShips298=value;}}),
 research:r=>({get:()=>r.research,set:value=>{r.research=value;}}),
 relationships:r=>({get:()=>r.relationships,set:value=>{r.relationships=value;}}),
 drugPolicies:r=>({get:()=>r.drugPolicies,set:value=>{r.drugPolicies=value;}}),
 nextDrugPolicyId:r=>({get:()=>r.nextDrugPolicyId,set:value=>{r.nextDrugPolicyId=value;}}),
 foodPolicies:r=>({get:()=>r.foodPolicies,set:value=>{r.foodPolicies=value;}}),
 nextFoodPolicyId:r=>({get:()=>r.nextFoodPolicyId,set:value=>{r.nextFoodPolicyId=value;}}),
 apparelPolicies:r=>({get:()=>r.apparelPolicies,set:value=>{r.apparelPolicies=value;}}),
 nextApparelPolicyId:r=>({get:()=>r.nextApparelPolicyId,set:value=>{r.nextApparelPolicyId=value;}}),
 foodRules:r=>({get:()=>r.foodRules,set:value=>{r.foodRules=value;}}),
 restRules:r=>({get:()=>r.restRules,set:value=>{r.restRules=value;}}),
 gameProfile:r=>({get:()=>r.gameProfile,set:value=>{r.gameProfile=value;}}),
 worldIncidents:r=>({get:()=>r.worldIncidents,set:value=>{r.worldIncidents=value;}}),
 worldSites263:r=>({get:()=>r.worldSites263,set:value=>{r.worldSites263=value;}}),
 tradeRequests284:r=>({get:()=>r.tradeRequests284,set:value=>{r.tradeRequests284=value;}}),
 linkedStorage286:r=>({get:()=>r.linkedStorage286,set:value=>{r.linkedStorage286=value;}}),
 worldMaps:r=>({get:()=>r.worldMaps,set:value=>{r.worldMaps=value;}}),
 worldGroups:r=>({get:()=>r.worldGroups,set:value=>{r.worldGroups=value;}}),
};
const sharedAccessor=(root:CampaignState,key:string):{get():unknown;set(value:unknown):void}=>{
 const make=Object.hasOwn(SHARED_ACCESSORS,key)?SHARED_ACCESSORS[key]:undefined;const r=root as unknown as SharedRoot;
 return make?make(r):{get:()=>r[key],set:value=>{r[key]=value;}};
};
const authorities=new WeakMap<object,CampaignState>(),mapIds=new WeakMap<object,number>(),groupBindings=new WeakMap<object,WorldGroupRecord>();
const groupSources=new WeakMap<object,number|null>(),projectionOrigins=new WeakMap<object,number|null>(),projectionFilth=new WeakSet<object>();
const groupMemberProjectionContexts=new WeakMap<World,ReadonlyMap<number,GroupMemberProjectionContext>>();
export function brandGroupMemberProjection(view:World,rows:readonly GroupMemberProjectionContext[]):void {groupMemberProjectionContexts.set(view,new Map(rows.map(r=>[r.pawnId,r])));}
export function projectedGroupMemberContext(view:World,pawnId:number):GroupMemberProjectionContext|undefined {return groupMemberProjectionContexts.get(view)?.get(pawnId);}
export function brandGroupProjection(view:World,record:WorldGroupRecord,originTile:number|null,filthPresent=false):void {if(filthPresent)projectionFilth.add(view);groupBindings.set(view,record);projectionOrigins.set(view,originTile);}
export const brandLossProjection=(w:World,filthPresent:boolean):void=>{if(filthPresent)projectionFilth.add(w);};
export const projectionAllowsFilth=(w:World):boolean=>projectionFilth.has(w);
export function groupOriginMapTile(view:World):number|null|undefined {if(projectionOrigins.has(view))return projectionOrigins.get(view);const r=groupBindings.get(view),root=registeredCampaign(view);return r?(root.worldMaps?.sites.find(s=>s.id===r.originMapId)?.tile??root.worldMaps?.retired.find(s=>s.id===r.originMapId)?.tile):undefined;}
const contexts=new WeakMap<object,Map<number,{record:WorldMapRecord;body:LocalMapState|World;world:World;stamp:Map<string,unknown>}>>();
export const registeredCampaign=(w:CampaignState):CampaignState=>authorities.get(w)??w;
/** The existing unregistered, loaded single-map root is actual map0, as in
 * registeredMap(root,0). Away/clock projections and mapless roots never get it.
 * Historical callers keep their old undefined result until prospective256. */
export const registeredMapId=(w:World):number|undefined=>mapIds.get(w)??(authorities.has(w)?undefined:w.worldMaps?.rootMapId??(w.schemaVersion>=260&&w.campaignMap?.revision===2?w.campaignMap.activeMapId:!w.worldMaps&&w.schemaVersion>=256&&Array.isArray(w.tiles)?0:undefined));
export function forwardCampaignFields(view:World,root:CampaignState):void {for(const key of shared)if((key!=='worldFactions'&&key!=='worldPawns'&&key!=='worldSites263'&&key!=='tradeRequests284'&&key!=='linkedStorage286'&&key!=='phaseCore297')||Object.hasOwn(root,key))Object.defineProperty(view,key,{enumerable:true,configurable:true,get:()=>(root as unknown as Record<string,unknown>)[key],set:value=>{(root as unknown as Record<string,unknown>)[key]=value;}});authorities.set(view,root);}
export function brandCampaignContext(view:World,root:CampaignState,mapId?:number,group?:WorldGroupRecord):void {authorities.set(view,root);if(mapId!==undefined)mapIds.set(view,mapId);if(group)groupBindings.set(view,group);}
export function campaignClockContext(input:CampaignState):World {const root=registeredCampaign(input),view={...root,seed:root.worldMaps!.campaignSeed,events:root.worldGroups!.events} as World;for(const key of shared)if((key!=='worldFactions'&&key!=='worldPawns'&&key!=='worldSites263'&&key!=='tradeRequests284'&&key!=='linkedStorage286'&&key!=='phaseCore297')||Object.hasOwn(root,key))Object.defineProperty(view,key,{enumerable:true,configurable:true,get:()=>(root as unknown as Record<string,unknown>)[key],set:value=>{(root as unknown as Record<string,unknown>)[key]=value;}});authorities.set(view,root);return view;}
export const boundWorldGroup=(w:World):WorldGroupRecord|undefined=>groupBindings.get(w);
/** Read-only mutation authority, with an EXPECTED runtime owner. Validation
 * and group projections are not the canonical mutating map context. */
export function isActualMapMutationContext298(expectedOwner:CampaignState,world:World):boolean {
 if(!isSchema298OrLater(Number(world.schemaVersion))||registeredCampaign(world)!==expectedOwner||groupBindings.has(world))return false;
 const maps=expectedOwner.worldMaps,id=registeredMapId(world);
 if(world===expectedOwner){
  if(!Array.isArray(world.tiles))return false;
  if(!maps)return !world.campaignMap&&id===0&&Number.isSafeInteger(world.planet?.homeTile)&&Number(world.planet?.homeTile)>=0;
  return maps.rootMapId!==null&&id===maps.rootMapId&&maps.sites.some(record=>record.id===id);
 }
 if(!maps||id===undefined)return false;
 const cached=contexts.get(expectedOwner)?.get(id);
 if(!cached||cached.world!==world||cached.record.id!==id||!maps.sites.includes(cached.record))return false;
 const body=id===maps.rootMapId&&hasLoadedRoot(expectedOwner)?expectedOwner:cached.record.map;
 return body!==undefined&&cached.body===body;
}
export const hasLoadedRoot=(w:CampaignState):w is World=>w.worldMaps?w.worldMaps.rootMapId!==null:Array.isArray((w as World).tiles);
export function captureLocalMap(w:World):LocalMapState {
 const data:Record<string,unknown>={};for(const k of Object.keys(w))if(!shared.has(k)&&!presentation.has(k))data[k]=(w as unknown as Record<string,unknown>)[k];return data as unknown as LocalMapState;
}
export function sharedCampaignData(w:CampaignState):SharedCampaignState&Pick<CampaignState,'worldMaps'|'worldGroups'> {
 const data:Record<string,unknown>={};for(const k of shared)if(Object.hasOwn(w,k))data[k]=(w as unknown as Record<string,unknown>)[k];return data as SharedCampaignState&Pick<CampaignState,'worldMaps'|'worldGroups'>;
}
export function initialWorldRegistry(w:World):void {
 if(w.schemaVersion<255)return;if(w.worldMaps){const initial=w.worldMaps.sites.find(m=>m.id===0);if(initial&&initial.tile===null&&w.planet)initial.tile=w.planet.homeTile;return;}
 w.worldMaps={revision:1,rootMapId:0,selectedMapId:0,nextMapId:1,campaignSeed:w.seed,calendarOrigin:calendarTick(w,0),mapSize:{width:w.width,height:w.height},sites:[{id:0,tile:w.planet?.homeTile??null,kind:'settlement',createdAt:0,visit:null}],retired:[]};
 w.worldGroups={revision:1,lostMemories:[],events:[],posts:[],nextPostId:1,canonicalPostId:null,selectedGroupId:null,groups:[],losses:[],lossContexts:[],legacyTravellers:[],abandonedPawns:[],abandonedContents:[]};
}
/** Neutral wrapping AFTER strict legacy validation: originals and absent contracts stay literal. */
export function migrateWorldRegistry(w:World):void {
 const old=w.secondarySite;initialWorldRegistry(w);const maps=w.worldMaps!,groups=w.worldGroups!;
 const moveGroup=(source:World|LocalMapState,mapId:number)=>{const raw=source as unknown as World,site=maps.sites.find(s=>s.id===mapId)!;if(raw.civilianPost){const id=groups.nextPostId++;groups.posts.push({id,state:raw.civilianPost});site.postId=id;groups.canonicalPostId??=id;delete raw.civilianPost;}if(raw.group){groups.groups.push({...site.postId!==undefined?{postId:site.postId}:{},originMapId:raw.group.originTile!==undefined&&old&&raw.group.originTile===old.tile?1:mapId,localMapId:'memberIds' in raw.group?mapId:null,context:{seed:raw.seed??w.seed,width:raw.width??w.width,height:raw.height??w.height,...raw.climate?{climate:raw.climate}:{},...raw.site?{site:raw.site}:{},...raw.scenario?{scenario:raw.scenario}:{}},state:raw.group});delete raw.group;}if(raw.groupLosses){groups.losses.push(...raw.groupLosses);for(const groupId of new Set(raw.groupLosses.map(l=>l.groupId)))groups.lossContexts.push({groupId,originMapId:mapId,context:{seed:raw.seed??w.seed,width:raw.width??w.width,height:raw.height??w.height,...raw.climate?{climate:raw.climate}:{},...raw.site?{site:raw.site}:{},...raw.scenario?{scenario:raw.scenario}:{}}});delete raw.groupLosses;}};
 moveGroup(w,0);
 if(old){maps.sites.push({id:1,tile:old.tile,kind:'legacy-site',createdAt:old.createdAt,map:old.map as LocalMapState,visit:old.visit});maps.nextMapId=2;maps.selectedMapId=old.selected?1:0;moveGroup(old.map as LocalMapState,1);delete w.secondarySite;}
 groups.groups.sort((a,b)=>a.state.id-b.state.id);groups.selectedGroupId=groups.groups[0]?.state.id??null;
}
/** Stable per-map identities retain WeakMap caches. Shared clock/IDs/RNG forward to ONE campaign. */
export function registeredMap(w:CampaignState,id:number):World|undefined {
 const root=registeredCampaign(w),maps=root.worldMaps;if(!maps)return id===0&&hasLoadedRoot(root)?root:undefined;
 const record=maps.sites.find(s=>s.id===id);if(!record)return;
 const body=id===maps.rootMapId&&hasLoadedRoot(root)?root:record.map;if(!body)return;
 let table=contexts.get(root);if(!table){table=new Map();contexts.set(root,table);}let cached=table.get(id);
 if(!cached||cached.record!==record||cached.body!==body||Object.hasOwn(cached.world,'phaseCore297')!==Object.hasOwn(root,'phaseCore297')){const view={...body} as World;for(const key of shared)if((key!=='worldFactions'&&key!=='worldPawns'&&key!=='worldSites263'&&key!=='tradeRequests284'&&key!=='linkedStorage286'&&key!=='phaseCore297')||Object.hasOwn(root,key)){const accessor=sharedAccessor(root,key);Object.defineProperty(view,key,{enumerable:true,configurable:false,get:accessor.get,set:accessor.set});}authorities.set(view,root);mapIds.set(view,id);attachPost(view,root,record);cached={record,body,world:view,stamp:new Map(Object.entries(captureLocalMap(view)))};table.set(id,cached);}
 else if(!sameLocalData(cached.body,cached.stamp)){const data=currentLocalData(cached);for(const k of Object.keys(cached.world))if(!shared.has(k)&&!presentation.has(k)&&!Object.hasOwn(data,k))delete (cached.world as unknown as Record<string,unknown>)[k];Object.assign(cached.world,data);cached.stamp=new Map(Object.entries(captureLocalMap(body as World)));}
 // The optional owner is born at the first real link, possibly after this
 // stable map context was cached. Never add an own-undefined historical field.
 if(Object.hasOwn(root,'linkedStorage286')&&!Object.hasOwn(cached.world,'linkedStorage286'))Object.defineProperty(cached.world,'linkedStorage286',{enumerable:true,configurable:false,get:()=>root.linkedStorage286,set:value=>{root.linkedStorage286=value;}});
 return cached.world;
}
export function flushRegisteredMap(w:World):void {
 const root=registeredCampaign(w),id=registeredMapId(w);if(id===undefined)return;const record=root.worldMaps?.sites.find(s=>s.id===id);if(!record)return;const original=id===root.worldMaps!.rootMapId?root:record.map;if(!original||w===original)return;
 if(flushIsNoop(w,original,contexts.get(root)?.get(id)))return;const next=captureLocalMap(w) as unknown as Record<string,unknown>,target=original as unknown as Record<string,unknown>;
 for(const k of Object.keys(target))if(!shared.has(k)&&!Object.hasOwn(next,k))delete target[k];Object.assign(target,next);const cache=contexts.get(root)?.get(id);if(cache?.world===w)cache.stamp=new Map(Object.entries(next));
}
export const registeredMaps=(w:CampaignState):World[]=>{const root=registeredCampaign(w);return root.worldMaps?root.worldMaps.sites.slice().sort((a,b)=>a.id-b.id).flatMap(s=>{const map=registeredMap(root,s.id);return map?[map]:[];}):hasLoadedRoot(root)?[root]:[];};
export function selectedRegisteredMap(w:CampaignState):World|undefined {const root=registeredCampaign(w),id=root.worldMaps?.selectedMapId;return id===null?undefined:registeredMap(root,id??0);}
export const localWorldGroups=(w:World):WorldGroupRecord[]=>{const root=registeredCampaign(w),id=registeredMapId(w)??(w.campaignMap?.revision===2?w.campaignMap.activeMapId:undefined);return root.worldGroups?.groups.filter(g=>g.localMapId===id)??(w.campaignMap?.revision===2?w.campaignMap.groups.filter(g=>g.localMapId===id).map(g=>({originMapId:g.originMapId,localMapId:g.localMapId,context:g.context,state:g.state})):[]);};
export const pawnWorldGroup=(w:World,id:number):WorldGroupRecord|undefined=>localWorldGroups(w).find(g=>'memberIds' in g.state&&g.state.memberIds.includes(id));
/** A group-only adapter has no local terrain authority and is never stepped as a map or saved. */
export function worldGroupContext(rootInput:CampaignState,id:number,validation=false):World|undefined {
 const root=registeredCampaign(rootInput),record=root.worldGroups?.groups.find(g=>g.state.id===id);if(!record)return;
 const live=validation?registeredMapForValidation(root,record.localMapId??record.originMapId):registeredMap(root,record.localMapId??record.originMapId),archived=root.worldGroups!.abandonedContents.find(a=>a.mapId===record.originMapId),local=live,maps=root.worldMaps!;
 const empty={seed:maps.campaignSeed,width:maps.mapSize.width,height:maps.mapSize.height,tiles:[],pawns:[],resources:[],structures:[],jobs:[],piles:[],stockpiles:[],growingZones:[],growingCursor:0,environment:'temperate-equinox-v1',stock:{wood:0,food:0},spoiled:{wood:0,food:0},events:[],logisticsCursor:0,packed:[],deconstructed:{count:0,lostWood:0,fuelTicks:0}};
 const origin=local??empty;const view={...origin,...(record.localMapId===null?empty:{}),...record.context,...sharedCampaignData(root),events:record.localMapId===null?root.worldGroups!.events:local!.events,group:record.state,groupLosses:root.worldGroups!.losses.filter(l=>l.groupId===record.state.id)} as World;
 if(record.localMapId===null)for(const key of ['shipReactorThreats275','startingArrival','scout','commercialTrip','visitors','podRescues','raids','prisonDepartures','wildlife','mechanoids','orbital'])delete (view as unknown as Record<string,unknown>)[key];
 for(const key of shared)if((key!=='worldFactions'&&key!=='worldPawns'&&key!=='worldSites263'&&key!=='tradeRequests284'&&key!=='linkedStorage286'&&key!=='phaseCore297')||Object.hasOwn(root,key))Object.defineProperty(view,key,{enumerable:true,configurable:false,get:()=>(root as unknown as Record<string,unknown>)[key],set:value=>{(root as unknown as Record<string,unknown>)[key]=value;}});
 if(!live&&archived?.filthPresent)brandLossProjection(view,true);authorities.set(view,root);mapIds.set(view,record.localMapId??record.originMapId);groupBindings.set(view,record);attachPost(view,root,record);groupSources.set(view,record.localMapId);return view;
}
export function commitWorldGroupContext(view:World):void {
 const record=groupBindings.get(view);if(!record)return;const root=registeredCampaign(view),registry=root.worldGroups!,sourceId=groupSources.get(view),local=sourceId===undefined||sourceId===null?undefined:registeredMap(root,sourceId);
 if(local){const data=captureLocalMap(view) as unknown as Record<string,unknown>;for(const key of Object.keys(local))if(!shared.has(key)&&!presentation.has(key)&&!Object.hasOwn(data,key))delete (local as unknown as Record<string,unknown>)[key];Object.assign(local,data);flushRegisteredMap(local);}
 if(view.group)record.state=view.group;else{registry.groups=registry.groups.filter(g=>g!==record);if(registry.selectedGroupId===record.state.id)registry.selectedGroupId=null;}
 registry.losses=[...registry.losses.filter(l=>l.groupId!==record.state.id),...view.groupLosses??[]];
}
export function withWorldGroup<T>(root:CampaignState,id:number,operation:(view:World)=>T):T|undefined {const view=worldGroupContext(root,id);if(!view)return;try{return operation(view);}finally{commitWorldGroupContext(view);}}
/** Promotion moves original local references; no Pawn, item, terrain or ID is copied. */
export function promoteRootMap(root:CampaignState,id:number):World {
 const maps=root.worldMaps!,record=maps.sites.find(s=>s.id===id);if(!record)throw Error('Missing root map.');if(maps.rootMapId===id&&hasLoadedRoot(root))return root;
 const next=registeredMap(root,id);if(!next)throw Error('Missing original local map.');flushRegisteredMap(next);const data=record.map!;
 if(hasLoadedRoot(root)){const old=maps.sites.find(s=>s.id===maps.rootMapId);if(old){const live=registeredMap(root,old.id);if(live)flushRegisteredMap(live);old.map=captureLocalMap(root);}for(const key of Object.keys(root))if(!shared.has(key))delete (root as unknown as Record<string,unknown>)[key];}
 Object.assign(root,data);delete record.map;maps.rootMapId=id;contexts.delete(root);return root as World;
}
export function clearRootMap(root:CampaignState):void {if(hasLoadedRoot(root))for(const key of Object.keys(root))if(!shared.has(key))delete (root as unknown as Record<string,unknown>)[key];root.worldMaps!.rootMapId=null;root.worldMaps!.selectedMapId=null;contexts.delete(root);}

/** Read-only validation projection: original records, plain shared descriptors, no runtime cache installation. */
export function registeredMapForValidation(root:CampaignState,id:number):World|undefined {
 const record=root.worldMaps?.sites.find(s=>s.id===id);if(!record)return;const body=id===root.worldMaps!.rootMapId&&hasLoadedRoot(root)?captureLocalMap(root):record.map;if(!body)return;
 const cached=contexts.get(root)?.get(id),source=id===root.worldMaps!.rootMapId?root:record.map;const exact=cached?.record===record&&cached.body===source?currentLocalData(cached):body;const post=postFor(root,record);const view={...exact,...sharedCampaignData(root),...post?{civilianPost:post}:{}} as World;authorities.set(view,root);mapIds.set(view,id);return view;
}

/** One persisted stock owner per real post; legacy links remain separate and literal. */
export function postFor(root:CampaignState,owner:{postId?:number}):World['civilianPost'] {const r=root.worldGroups;if(!r)return;return r.posts.find(p=>p.id===(owner.postId??r.canonicalPostId))?.state;}
export function canAttachPost(w:World):boolean {const root=registeredCampaign(w),r=root.worldGroups;if(!r)return true;return r.canonicalPostId!==null||Number.isSafeInteger(r.nextPostId+1);}
export function attachPost(view:World,root:CampaignState,owner:{postId?:number}):void {Object.defineProperty(view,'civilianPost',{enumerable:true,configurable:true,get:()=>postFor(root,owner),set:value=>{const r=root.worldGroups!;const linked=owner.postId??r.canonicalPostId;if(linked!==null&&linked!==undefined){const p=r.posts.find(p=>p.id===linked);if(!p)throw Error('Missing post owner');if(!value)throw Error('Cannot delete actual post stock');p.state=value;owner.postId=linked;}else{if(!value)return;if(!Number.isSafeInteger(r.nextPostId+1))throw Error('Post identity exhausted');const id=r.nextPostId++;r.posts.push({id,state:value});r.canonicalPostId=id;owner.postId=id;}}});}

/* Fast paths of the two copies between a map's original local fields (`body`)
 * and its stable view. Both copies are field-by-field: when no field differs
 * they write nothing, and the stamp they rebuild holds the same keys, values
 * and order as before. These checks prove that case and nothing else; any
 * difference (a key added, removed, reordered, or a value not ===, NaN
 * included) takes the original copy. */
/** The original's local fields are still exactly the stamp: registeredMap would merge nothing. */
function sameLocalData(body:LocalMapState|World,stamp:ReadonlyMap<string,unknown>):boolean {
 const it=stamp.entries(),data=body as unknown as Record<string,unknown>;
 for(const k of Object.keys(data)){
  if(shared.has(k)||presentation.has(k))continue;
  const entry=it.next();if(entry.done||entry.value[0]!==k||entry.value[1]!==data[k])return false;
 }
 return !!it.next().done;
}
/** flushRegisteredMap would copy nothing: the view's local fields are exactly
 * its stamp, in order, and so are the original's unshared fields, with no
 * presentation field for the copy to delete. Without a stamp: not proven. */
function flushIsNoop(view:World,original:object,cache:{world:World;stamp:Map<string,unknown>}|undefined):boolean {
 if(cache?.world!==view)return false;
 const live=view as unknown as Record<string,unknown>,target=original as unknown as Record<string,unknown>;
 let it=cache.stamp.entries();
 for(const k of Object.keys(live)){
  if(shared.has(k)||presentation.has(k))continue;
  const entry=it.next();if(entry.done||entry.value[0]!==k||entry.value[1]!==live[k])return false;
 }
 if(!it.next().done)return false;
 it=cache.stamp.entries();
 for(const k of Object.keys(target)){
  if(shared.has(k))continue;if(presentation.has(k))return false;
  const entry=it.next();if(entry.done||entry.value[0]!==k||entry.value[1]!==target[k])return false;
 }
 return !!it.next().done;
}
function currentLocalData(c:{body:LocalMapState|World;world:World;stamp:Map<string,unknown>}):LocalMapState {const body=captureLocalMap(c.body as World) as unknown as Record<string,unknown>,live=captureLocalMap(c.world) as unknown as Record<string,unknown>,result={...live};for(const k of new Set([...c.stamp.keys(),...Object.keys(body)])){const before=c.stamp.get(k),present=Object.hasOwn(body,k);if(present!==c.stamp.has(k)||body[k]!==before){if(present)result[k]=body[k];else delete result[k];}}return result as unknown as LocalMapState;}
export function finalizeInitialWorldRegistry(w:World):void {initialWorldRegistry(w);if(w.tick!==0||!w.worldMaps||w.worldMaps.sites.length!==1||w.worldGroups!.groups.length)return;w.worldMaps.calendarOrigin=calendarTick(w,0);w.worldMaps.campaignSeed=w.planet?.generationSeed??w.seed;w.worldMaps.sites[0]!.tile=w.planet?.homeTile??null;contexts.delete(w);}
