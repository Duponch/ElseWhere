import {SCHEMA_VERSION} from './types.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {validLinkedShelfPolicy286,sameLinkedShelfPolicy286} from './linked-storage-policy-286.ts';
import {captureLinkedStorageOwners286,type LinkedStorageOwners286} from './linked-storage-owners-286.ts';
import {registeredCampaign} from './world-map-context.ts';
import {validWorldPawnOriginProjection256} from './world-pawn-origin-projection-256.ts';
import {planetTileCount} from './planet-geography-256.ts';
import type {PlanetState} from './planet-state.ts';
import type {CampaignState} from './world-map-state.ts';
import type {LinkedShelfMember286,LinkedStorageRegistry286} from './linked-storage-state-286.ts';
import type {ShelfStorageSettings} from './shelf-storage.ts';

const own=(v:object,k:PropertyKey)=>Object.hasOwn(v,k);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const fields=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>Reflect.ownKeys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k)!;return typeof k==='string'&&required.concat(optional).includes(k)&&d.enumerable&&own(d,'value');})&&required.every(k=>own(v,k));
const dense=(v:unknown,min:number,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length>=min&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&own(d,'value'));

export function validLinkedShelfMemberShape286(value:unknown,version:number):value is LinkedShelfMember286 {
 return isSchema286OrLater(version)&&record(value)&&fields(value,['revision','groupId','independent'])&&value.revision===1&&int(value.groupId,1)&&validLinkedShelfPolicy286(value.independent,version);
}
/** Always called, including absence on old formats. No accessor is evaluated. */
export function validLinkedShelfField286(shelf:unknown,version:number):boolean {
 if(!int(version,1,SCHEMA_VERSION)||!record(shelf))return false;const d=Object.getOwnPropertyDescriptor(shelf,'linked286');
 return d?d.enumerable===true&&own(d,'value')&&validLinkedShelfMemberShape286(d.value,version):!('linked286'in shelf);
}
export function validLinkedStorageRegistryShape286(value:unknown,version:number,nextThingId=Number.MAX_SAFE_INTEGER):value is LinkedStorageRegistry286 {
 if(!isSchema286OrLater(version)||!int(nextThingId,1)||!record(value)||!fields(value,['revision','nextId','groups'])||value.revision!==1||!int(value.nextId,1)||!dense(value.groups,0,4096))return false;
 const ids=new Set<number>(),members=new Set<number>();
 for(const g of value.groups){
  if(!record(g)||!fields(g,['id','originMapId','name','settings','memberIds'])||!int(g.id,1,value.nextId-1)||ids.has(g.id)||!int(g.originMapId)||typeof g.name!=='string'||g.name.length<1||g.name.length>64||g.name.trim()!==g.name||/[\u0000-\u001f\u007f]/.test(g.name)||!validLinkedShelfPolicy286(g.settings,version)||!dense(g.memberIds,2,Math.min(nextThingId-1,1_000_000)))return false;
  ids.add(g.id);for(const id of g.memberIds){if(!int(id,1,nextThingId-1)||members.has(id))return false;members.add(id);}
 }
 return true;
}
/** Shared metadata shape; owner bijection belongs to the complete RAW guard. */
export function validLinkedStorageRegistryField286(value:object,version:number,nextThingId:number):boolean {
 if(!int(version,1,SCHEMA_VERSION))return false;const d=Object.getOwnPropertyDescriptor(value,'linkedStorage286');
 return d?d.enumerable===true&&own(d,'value')&&validLinkedStorageRegistryShape286(d.value,version,nextThingId):!('linkedStorage286'in value);
}

/** Cold historical fence only. Current286 uses the closed custody census,
 * never this generic walk on each publication. */
export function validLinkedStorageHistorical286(value:unknown,version:number):boolean {
 if(!int(version,1,SCHEMA_VERSION))return false;if(isSchema286OrLater(version))return true;
 let budget=2_000_000;const active=new Set<object>(),done=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return typeof v!=='function'&&typeof v!=='symbol';
  if(active.has(v))return false;if(done.has(v))return true;
  if(!Array.isArray(v)&&!record(v)||'linkedStorage286'in v||'linked286'in v)return false;
  active.add(v);for(const key of Reflect.ownKeys(v)){if(typeof key!=='string')return false;const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!own(d,'value'))return false;
   if(['tiles','resources','planet','roofing','homeArea','snow','thermal'].includes(key))continue;
   if(!walk(d.value))return false;
  }active.delete(v);done.add(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  if('linkedStorage286'in value||'linked286'in value)return false;
  const d=Object.getOwnPropertyDescriptor(value,'world');if(d&&!own(d,'value')||!d&&'world'in value)return false;
  const root=d?.value&&typeof d.value==='object'?d.value:value;
  if('linkedStorage286'in root||'linked286'in root)return false;
  for(const key of ['structures','packed','worldMaps','secondarySite','campaignMap','worldGroups','worldPawns','worldFactions','group','groups','groupLosses','animalLosses','visitors','podRescues','jobs']){const field=Object.getOwnPropertyDescriptor(root,key);if(field? !own(field,'value')||!walk(field.value):key in root)return false;}
  if(root!==value)for(const key of ['structures','packed']){const field=Object.getOwnPropertyDescriptor(value,key);if(field?!own(field,'value')||!walk(field.value):key in value)return false;}
  return true;
 }catch{return false;}
}

function validate(input:unknown,complete:boolean,captured?:LinkedStorageOwners286):boolean {
 try{
  if(!record(input)||!int(input.schemaVersion,1,SCHEMA_VERSION))return false;
  if(!isSchema286OrLater(input.schemaVersion))return validLinkedStorageHistorical286(input,input.schemaVersion);
  const registryField=Object.getOwnPropertyDescriptor(input,'linkedStorage286');
  if(registryField&&(!registryField.enumerable||!own(registryField,'value'))||!registryField&&'linkedStorage286'in input)return false;
  const registry=registryField?.value;
  if(registryField&&!validLinkedStorageRegistryShape286(registry,Number(input.schemaVersion),Number(input.nextId)))return false;
  const owners=captured??captureLinkedStorageOwners286(input as unknown as CampaignState,{seal:false});if(!owners.valid)return false;
  const groups=new Map((registry as LinkedStorageRegistry286|undefined)?.groups.map(g=>[g.id,g])??[]),live=new Set<number>(),retired=new Set<number>();
  if(record(input.worldMaps)){
   if(!Array.isArray(input.worldMaps.sites)||!Array.isArray(input.worldMaps.retired))return false;
   for(const site of input.worldMaps.sites){if(!record(site)||!int(site.id))return false;live.add(site.id);}
   for(const site of input.worldMaps.retired){if(!record(site)||!int(site.id)||live.has(site.id))return false;retired.add(site.id);}
  }else{
   const metadata=record(input.campaignMap)&&input.campaignMap.revision===2?input.campaignMap:input;
   if(Array.isArray(metadata.maps))for(const site of metadata.maps){if(!record(site)||!int(site.id))return false;live.add(site.id);}
   const tileCount=input.planet?planetTileCount(input.planet as unknown as PlanetState):0;
   if(!validWorldPawnOriginProjection256(metadata,286,Number(input.tick),Number(input.nextId),tileCount,live))return false;
   if(Array.isArray(metadata.worldPawnOrigins))for(const site of metadata.worldPawnOrigins){if(!record(site)||!int(site.mapId)||live.has(site.mapId))return false;retired.add(site.mapId);}
   if(!live.size&&!('maps'in metadata)&&Array.isArray(input.structures)&&Array.isArray(input.tiles))for(const row of owners.members)if(row.installed&&row.mapId!==null)live.add(row.mapId);
   // A classic real map0 with no shelves still permits an empty registry.
   if(!live.size&&!('maps'in metadata)&&Array.isArray(input.structures)&&Array.isArray(input.tiles)&&!('group'in input))live.add(0);
  }
  const policies=new Set<object>();
  const uniquePolicy=(p:ShelfStorageSettings):boolean=>{const visit=(v:unknown):boolean=>{if(v===null||typeof v!=='object')return true;if(policies.has(v))return false;policies.add(v);return Reflect.ownKeys(v).every(k=>visit(Object.getOwnPropertyDescriptor(v,k)!.value));};return visit(p);};
  for(const g of groups.values())if(!live.has(g.originMapId)&&!retired.has(g.originMapId)||!uniquePolicy(g.settings))return false;
  const present=new Set<number>(),groupMembers=new Map([...groups].map(([id,g])=>[id,new Set(g.memberIds)]));
  for(const row of owners.members){
   const sf=Object.getOwnPropertyDescriptor(row.building,'shelf');if(!sf?.enumerable||!own(sf,'value'))return false;
   const shelf=sf.value as NonNullable<typeof row.building.shelf>;if(!shelf||!validLinkedShelfField286(shelf,Number(input.schemaVersion)))return false;
   if(!own(shelf,'linked286'))continue;
   const link=shelf.linked286!,g=groups.get(link.groupId);if(!g||!groupMembers.get(g.id)!.has(row.building.id)||!sameLinkedShelfPolicy286(shelf.settings,g.settings)||!validLinkedShelfPolicy286(shelf.settings,Number(input.schemaVersion))||!uniquePolicy(shelf.settings)||!uniquePolicy(link.independent))return false;
   if(row.installed&&(row.mapId!==g.originMapId||!live.has(g.originMapId))||!row.installed&&!row.packed)return false;
   present.add(row.building.id);
  }
  for(const g of groups.values())for(const id of g.memberIds){const member=owners.byId.get(id);if(member&&!present.has(id)||complete&&!member)return false;}
  return true;
 }catch{return false;}
}
/** Complete RAW: actual owner bijection, including absent-map packed holders. */
export function validLinkedStorageWorld286(input:CampaignState,owners?:LinkedStorageOwners286):boolean {
 const root=registeredCampaign(input);return (!owners||owners.root===root)&&validate(root,true,owners);
}
/** Partial transport: validate only actual originals present, never instantiate
 * absent members. The enclosing metadata guard admits origin witnesses. */
export function validLinkedStorageProjection286(input:unknown):boolean {return validate(input,false);}
