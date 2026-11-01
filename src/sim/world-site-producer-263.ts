import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297 as frontierCore297} from './core-phase-297.ts';
import {preparePaidAiSiteTile298} from './paid-ai-site-tile-298.ts';
import type {AiCoreSiteRequest298,AiCoreInformationReceipt298} from './faction-comms-state-298.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {WORLD_FACTION_TECH_LEVEL_259} from './world-faction-catalog.ts';
import {planetGeography256} from './planet-geography-256.ts';
import {worldBiomeCanSettle} from './world-biome-properties.ts';
import {selectCaravanFaction261,type CaravanFactionCapture261} from './caravan-faction-selection-261.ts';
import {draftItemStashGoods263,draftAiCoreSiteGoods298} from './world-site-goods-263.ts';
import {healthRandom} from './health.ts';
import type {CampaignState} from './world-map-state.ts';
import type {ItemStash263,ItemStashThreat263} from './world-sites-state-263.ts';
/** Actual reachable surface distance7..27 from a real player home. One
 * uniform draw over candidates, no favorable retry or new geography seed. */
function siteTile263(root:CampaignState,homeTile:number,draw:()=>number):number|undefined {
 if(root.planet?.revision!==3)return;
 const surface=planetGeography256(root.planet).surface,tiles=surface.tiles,distances=new Int16Array(tiles.length).fill(-1),queue=[homeTile],candidates:number[]=[];
 const occupied=new Set([...(root.worldMaps?.sites??[]).map(s=>s.tile),...root.worldFactions!.settlements.map(s=>s.tile),...root.worldSites263!.entries.filter(s=>!('closed'in s)||!s.closed).map(s=>s.tile),...(root.worldMaps?.retired??[]).filter(s=>s.markerUntilCore!==undefined&&s.markerUntilCore>root.tick*10).map(s=>s.tile)]);
 distances[homeTile]=0;
 for(let head=0;head<queue.length;head++){const id=queue[head]!,d=distances[id]!,tile=tiles[id]!;if(d>=7&&!occupied.has(id)&&worldBiomeCanSettle(tile.biome)&&tile.hilliness!=='impassable')candidates.push(id);if(d===27)continue;
  for(const next of tile.neighbours){const t=tiles[next]!;if(distances[next]!==-1||!worldBiomeCanSettle(t.biome)||t.hilliness==='impassable')continue;distances[next]=d+1;queue.push(next);}
 }
 return candidates.length?candidates[Math.floor(draw()*candidates.length)]:undefined;
}
/** Declared incident stimulus calls this SAME producer as the natural
 * calendar. It supplies real threat points, never a Site/pending/actor list.
 * Unsupported generated threat controllers retain their own selected ticket;
 * they are not silently converted to a peaceful Site. */
export function prepareItemStashBirth263(root:CampaignState,points:number,request?:AiCoreSiteRequest298):{ok:false;reason:string}|{ok:true;site:ItemStash263;current():boolean;commit():void} {
 if(request!==undefined&&!validAiInformationIntent298(request,root))return {ok:false,reason:'Invalid prospective paid information intent'};
 const registry=root.worldSites263,maps=root.worldMaps,factions=root.worldFactions;
 const homeRecord=request?maps?.sites.find(s=>s.id===request.homeMapId&&s.kind==='settlement'&&s.tile!==null):maps?.sites.find(s=>s.kind==='settlement'&&s.tile!==null);
 const mono=!!request&&!maps&&request.homeMapId===0&&'tiles'in root&&Array.isArray(root.tiles)&&root.planet?.revision===3&&Number.isSafeInteger(root.planet.homeTile);
 const home=homeRecord??(mono?{id:0,tile:root.planet!.homeTile}:undefined),tick=root.tick,nextId=root.nextId,rng=root.rng,atCore=request?.atCore??root.tick*10;
 if(!isSchema263OrLater(Number(root.schemaVersion))||!registry||(!maps&&!mono)||!factions||!home||typeof home.tile!=='number'||!Number.isFinite(points)||points<0||points>10000||registry.entries.length>=4096||!Number.isSafeInteger(registry.nextId+1))return {ok:false,reason:'Actual263 home, Site registry and threat budget required'};
 const random={rng},draw=()=>healthRandom(random);
 const paidSelection=request?preparePaidAiSiteTile298(root,atCore,draw):undefined;
 if(paidSelection&&!paidSelection.ok)return paidSelection;
 const tile=paidSelection?.ok?paidSelection.tile:siteTile263(root,home.tile,draw);if(tile===undefined)return {ok:false,reason:'No actual reachable unoccupied Site tile at distance7..27'};
 let threat:ItemStashThreat263={kind:'none'},factionId:number|null=null;
 if(draw()<.85){
  const kinds=['ambush-edge','ambush-hidden','manhunters',...points>=300?['outpost','turrets']:[],...points>=400?['sleeping-mechanoids']:[]] as const,kind=kinds[Math.floor(draw()*kinds.length)]!;
  if(kind==='manhunters'||kind==='sleeping-mechanoids'||kind==='ambush-edge'||kind==='ambush-hidden')threat={kind,points};
  else{
   const capture:CaravanFactionCapture261[]=factions.factions.filter(f=>kind!=='turrets'||WORLD_FACTION_TECH_LEVEL_259[f.def]>=4).map(f=>({id:f.id,def:f.def,player:f.id===factions.playerFactionId,hidden:f.hidden,lifecycle259:f.lifecycle259,hostileToPlayer:factions.relations.some(r=>r.aId===Math.min(f.id,factions.playerFactionId)&&r.bId===Math.max(f.id,factions.playerFactionId)&&r.kind==='hostile')}));
   const chosen=selectCaravanFaction261(capture,'combat',points,draw);if(!chosen.ok)return chosen;factionId=chosen.factionId;threat={kind:kind as 'outpost'|'turrets',factionId,points};
  }
 }
 const goods=request?draftAiCoreSiteGoods298(registry.nextId,nextId,random.rng,Number(root.schemaVersion)):draftItemStashGoods263(registry.nextId,nextId,points,tick,random.rng,root.schemaVersion);if(!goods)return {ok:false,reason:'Actual original reward producer refused'};random.rng=goods.rng;
 const expiresAtCore=atCore+(12+Math.floor(17*draw()))*60000;if(!Number.isSafeInteger(expiresAtCore))return {ok:false,reason:'Actual Site timeout exceeds the safe clock'};
 const site:ItemStash263={kind:'item-stash',id:registry.nextId,tile,factionId,createdAtCore:atCore,mapId:null,expiresAtCore,heldAtCore:atCore,items:goods.items,threat};
 if(request){const receipt:AiCoreInformationReceipt298={revision:1,atCore,mapId:home.id,pawnId:request.pawnId,factionId:request.factionId,consoleId:request.consoleId,cost:1500,silver:request.silver.map(row=>({...row})),coreId:goods.items[0]!.id};site.aiCoreInformation298=receipt;}
 const requestStamp=request?JSON.stringify(request):null;
 const entries=registry.entries,refs=entries.slice(),nextSiteId=registry.nextId,sites=maps?.sites,settlements=factions.settlements,factionRows=factions.factions,relations=factions.relations,planet=root.planet;
 const sourceStamp=()=>JSON.stringify([home,sites?.map(s=>[s.id,s.tile])??[],settlements,factionRows,relations,maps?.retired??[],entries.map(s=>[s.id,s.tile,s.mapId,'closed'in s?s.closed:null])]);
 const sourceBefore=sourceStamp(),candidateBefore=JSON.stringify(site),itemRefs=site.items.slice(),items=site.items;let used=false;
 const mutable=()=>['rng','nextId'].every(k=>Object.getOwnPropertyDescriptor(root,k)?.writable===true)&&['nextId'].every(k=>Object.getOwnPropertyDescriptor(registry,k)?.writable===true)&&Object.isExtensible(entries)&&Object.getOwnPropertyDescriptor(entries,'length')?.writable===true;
 const current=()=>!used&&(!paidSelection||paidSelection.ok&&paidSelection.current())&&(request===undefined||validAiInformationIntent298(request,root)&&JSON.stringify(request)===requestStamp&&frontierCore297(root)===atCore)&&root.tick===tick&&root.nextId===nextId&&root.rng===rng&&root.planet===planet&&root.worldSites263===registry&&root.worldMaps===maps&&root.worldFactions===factions&&maps?.sites===sites&&factions.settlements===settlements&&factions.factions===factionRows&&factions.relations===relations&&(homeRecord?!!sites?.includes(homeRecord):mono&&!root.worldMaps&&root.planet?.homeTile===home.tile)&&registry.nextId===nextSiteId&&registry.entries===entries&&entries.length===refs.length&&entries.every((s,i)=>s===refs[i])&&sourceStamp()===sourceBefore&&site.items===items&&items.length===itemRefs.length&&items.every((p,i)=>p===itemRefs[i])&&JSON.stringify(site)===candidateBefore&&!settlements.some(s=>s.tile===tile)&&!(sites??[]).some(s=>s.tile===tile)&&mutable();
 if(!current())return {ok:false,reason:'Actual Site birth recipients are immutable'};
 return {ok:true,site,current,commit(){if(!current())throw Error('Actual Site producer changed before publication');used=true;entries.push(site);registry.nextId++;root.nextId=goods.nextId;root.rng=random.rng;}};
}

/** Closed internal intent. All mutable sources are still sealed by its caller. */
function validAiInformationIntent298(value:unknown,root:CampaignState):value is AiCoreSiteRequest298 {
 const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const own=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d.value as unknown:undefined;};
 const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
 if(!isSchema298OrLater(Number(root.schemaVersion))||!plain(value)||Reflect.ownKeys(value).length!==7||own(value,'kind')!=='ai-core-information'||!int(own(value,'homeMapId'))||own(value,'atCore')!==frontierCore297(root)||!int(own(value,'pawnId'),1,root.nextId-1)||!int(own(value,'factionId'),1)||!int(own(value,'consoleId'),1,root.nextId-1))return false;
 const rows=own(value,'silver');if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length<1||rows.length>1500||Reflect.ownKeys(rows).length!==rows.length+1)return false;
 let sum=0;const ids=new Set<number>();for(let i=0;i<rows.length;i++){const row=own(rows,String(i));if(!plain(row)||Reflect.ownKeys(row).length!==2)return false;const id=own(row,'pileId'),quantity=own(row,'quantity');if(!int(id,1,root.nextId-1)||!int(quantity,1,1500)||ids.has(id))return false;ids.add(id);sum+=quantity;}return sum===1500;
}