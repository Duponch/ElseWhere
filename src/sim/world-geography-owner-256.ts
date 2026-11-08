/** Campaign geography is immutable, shared by every local map and sent once
 * per simulation connection. Saves keep scalar columns and actual modifiers;
 * loading rebuilds recorded geometry only, never climate, rivers or RNG.
 * This owner is transient and cannot be serialized as a World authority. */
import {storeWorldSurface,restoreValidatedWorldSurface,validStoredWorldSurface,type StoredWorldSurface} from './world-surface-storage.ts';
import {validWorldFactionSelection,type ConfigurableWorldFaction} from './world-generation-settings.ts';
import {validCoreWorldMutators256} from './world-local-mutators-256.ts';
import type {WorldPhysicalSurface} from './world-surface-geography.ts';
import type {WorldRoadLink} from './world-roads.ts';
import type {GeographicWorldDraft256} from './world-geographic-draft.ts';
export interface StoredCampaignGeography256 {revision:1;surface:StoredWorldSurface;mutators:number[];factions:ConfigurableWorldFaction[]}
declare const ownerBrand:unique symbol;
export interface CampaignGeography256 {
 readonly [ownerBrand]:true;readonly definition:StoredCampaignGeography256;readonly surface:WorldPhysicalSurface;
 readonly roads:readonly (readonly WorldRoadLink[])[];readonly mutators:readonly number[];
}
const owners=new WeakSet<object>();
const definitions=new WeakMap<object,CampaignGeography256>();
function record(v:unknown,keys:readonly string[]):v is Record<string,unknown> {
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 const own=Reflect.ownKeys(v);return own.length===keys.length&&own.every(k=>{if(typeof k!=='string'||!keys.includes(k))return false;const d=Object.getOwnPropertyDescriptor(v,k)!;return Object.hasOwn(d,'value')&&d.enumerable===true;});
}
/** Deep freeze, each object before its children: an object already frozen is
 * not visited again, which also stops shared and cyclic references without a
 * visited set (≈1.3 million planet objects). The trees frozen here are fresh
 * restorations or generator outputs, whose only objects frozen beforehand are
 * empty constant arrays: the result is the same as freezing children first. */
function freezeTree<T>(value:T):T {
 if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))if(child!==null&&typeof child==='object')freezeTree(child);}return value;
}
export function validCampaignGeographyShape256(value:unknown):value is StoredCampaignGeography256 {
 if(!record(value,['revision','surface','mutators','factions'])||value.revision!==1||!validStoredWorldSurface(value.surface)||!validWorldFactionSelection(value.factions)
  ||!Array.isArray(value.mutators)||Object.getPrototypeOf(value.mutators)!==Array.prototype||value.mutators.length!==value.surface.biome.length||Reflect.ownKeys(value.mutators).length!==value.mutators.length+1)return false;
 for(let i=0;i<value.mutators.length;i++){const d=Object.getOwnPropertyDescriptor(value.mutators,String(i));if(!d||!Object.hasOwn(d,'value')||!Number.isInteger(d.value)||d.value<0||d.value>15)return false;}return true;
}
function owner(definition:StoredCampaignGeography256,surface:WorldPhysicalSurface,roads:WorldRoadLink[][]):CampaignGeography256 {
 const value=Object.freeze({definition:freezeTree(definition),surface:freezeTree(surface),roads:freezeTree(roads),mutators:definition.mutators}) as unknown as CampaignGeography256;owners.add(value);definitions.set(definition,value);return value;
}
export function isCampaignGeography256(value:unknown):value is CampaignGeography256 {return !!value&&typeof value==='object'&&owners.has(value);}
/** Exact immutable owner lookup only. A raw equal object is not certified,
 * and must cross the complete external restore boundary first. */
export function ownedCampaignGeography256(definition:unknown):CampaignGeography256|undefined {return definition&&typeof definition==='object'?definitions.get(definition):undefined;}
/** Internal generation boundary. The completed original generator owns its
 * real mesh; freezing it avoids constructing a duplicate large sphere. */
export function captureGeneratedGeography256(draft:GeographicWorldDraft256):CampaignGeography256 {
 const definition:StoredCampaignGeography256={revision:1,surface:storeWorldSurface(draft.surface,draft.roads),mutators:[...draft.mutators],factions:[...draft.settings.factions]};
 if(!validCampaignGeographyShape256(definition)||!validCoreWorldMutators256(definition.mutators,draft.surface.tiles))throw Error('Incomplete generated campaign geography');
 return owner(definition,draft.surface,draft.roads);
}
/** External RAW/transport boundary: check all columns before geometry
 * allocation, own a primitive copy and then verify actual graph membership. */
export function restoreCampaignGeography256(raw:unknown):CampaignGeography256 {
 if(!validCampaignGeographyShape256(raw))throw Error('Invalid campaign geography definition');
 // The copy keeps exactly the enumerable data accepted above, so its columns
 // are not walked a second time.
 const copied=structuredClone(raw),restored=restoreValidatedWorldSurface(copied.surface);
 if(!validCoreWorldMutators256(copied.mutators,restored.surface.tiles))throw Error('Invalid saved campaign terrain modifiers');
 return owner(copied,restored.surface,restored.roads);
}
export type GeographyPacket256={kind:'definition';id:number;definition:StoredCampaignGeography256}|{kind:'reference';id:number};
/** Transport IDs belong to the worker connection, never to Thing IDs or game
 * RNG. Map changes do not resend or duplicate the same geographic owner. */
export class GeographyEncoder256 {
 #current:CampaignGeography256|undefined;#id=0;#serial=0;
 #draft:{owner:CampaignGeography256;id:number;authorized:boolean}|undefined;
 reserveDraftPreview(owner:CampaignGeography256):GeographyPacket256 {
  if(!isCampaignGeography256(owner)||!Number.isSafeInteger(this.#serial+1))throw Error('Invalid draft geography reservation');
  const id=++this.#serial;this.#draft={owner,id,authorized:false};return {kind:'definition',id,definition:owner.definition};
 }
 authorizeDraftPreview(owner:CampaignGeography256,id:number):void {const d=this.#draft;if(!d||d.owner!==owner||d.id!==id)throw Error('Draft geography reservation lost');d.authorized=true;}
 discardDraftPreview():void {this.#draft=undefined;}
 encode(geography:CampaignGeography256,forceDefinition=false):GeographyPacket256 {
  if(!isCampaignGeography256(geography))throw Error('Unowned campaign geography');
  if(this.#draft?.authorized&&this.#draft.owner===geography){this.#id=this.#draft.id;this.#current=geography;this.#draft=undefined;return {kind:'reference',id:this.#id};}
  if(geography!==this.#current){if(!Number.isSafeInteger(this.#serial+1))throw Error('Geography transport identity exhausted');this.#id=++this.#serial;this.#current=geography;return {kind:'definition',id:this.#id,definition:geography.definition};}
  return forceDefinition?{kind:'definition',id:this.#id,definition:geography.definition}:{kind:'reference',id:this.#id};
 }
 reset():void {this.#current=undefined;this.#draft=undefined;}
}
export type PreparedGeography256={readonly ok:false;readonly reason:string}|{readonly ok:true;readonly id:number;readonly owner:CampaignGeography256};
function sameDefinition(a:StoredCampaignGeography256,b:StoredCampaignGeography256):boolean {
 // This rare repeated-definition check is outside warm snapshot adoption.
 // Canonical stored records have the same strict key order on creation, but
 // JSON key order supplied externally is not part of geographic identity.
 const same=(x:unknown,y:unknown):boolean=>{
  if(Object.is(x,y))return true;if(!x||!y||typeof x!=='object'||typeof y!=='object'||Array.isArray(x)!==Array.isArray(y))return false;
  const keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(k=>Object.hasOwn(y,k)&&same((x as Record<string,unknown>)[k],(y as Record<string,unknown>)[k]));
 };return same(a,b);
}
/** Pending definitions are committed only after the surrounding snapshot
 * passes every other guard. A malformed or abandoned packet changes nothing. */
export interface DraftGeographyPreview256 {readonly id:number;readonly owner:CampaignGeography256}
export class GeographyDecoder256 {
 #draft:DraftGeographyPreview256|undefined;#draftAuthorized=false;
 /** Separate preview owner: neither active transport nor accepted World changes. */
 prepareDraftPreview(raw:unknown):DraftGeographyPreview256 {
  if(!record(raw,['kind','id','definition'])||raw.kind!=='definition'||!Number.isSafeInteger(raw.id)||Number(raw.id)<1||this.#accepted&&Number(raw.id)<=this.#accepted.id)throw Error('Invalid draft geography definition');
  const prepared=Object.freeze({id:Number(raw.id),owner:restoreCampaignGeography256(raw.definition)});this.#draft=prepared;this.#draftAuthorized=false;return prepared;
 }
 authorizeDraftPreview(preview:DraftGeographyPreview256):void {if(this.#draft!==preview)throw Error('Unconfirmed draft geography preview');this.#draftAuthorized=true;}
 discardDraftPreview():void {this.#draft=undefined;this.#draftAuthorized=false;}
 #accepted:{id:number;owner:CampaignGeography256}|undefined;#pending:PreparedGeography256|undefined;
 prepare(raw:unknown,allowReplacement:boolean):PreparedGeography256 {
  this.#pending=undefined;const fail=(reason:string):PreparedGeography256=>({ok:false,reason});
  if(typeof allowReplacement!=='boolean'||!record(raw,['kind','id'])&&!record(raw,['kind','id','definition'])||!Number.isSafeInteger(raw.id)||Number(raw.id)<1)return fail('Invalid geography transport envelope');
  if(raw.kind==='definition'?!record(raw,['kind','id','definition']):!record(raw,['kind','id']))return fail('Invalid geography transport fields');
  const id=Number(raw.id),before=this.#accepted;let prepared:PreparedGeography256;
  if(raw.kind==='reference'){
   if(before?.id===id)prepared={ok:true,id,owner:before.owner};
   else if(allowReplacement&&this.#draftAuthorized&&this.#draft?.id===id&&(!before||id>before.id))prepared={ok:true,id,owner:this.#draft.owner};
   else return fail('Unknown campaign geography reference');
  }else if(raw.kind==='definition'){
   if(before&&id<before.id)return fail('Stale campaign geography definition');
   if(before&&id===before.id){if(!validCampaignGeographyShape256(raw.definition)||!sameDefinition(before.owner.definition,raw.definition))return fail('Confirmed campaign geography changed');prepared={ok:true,id,owner:before.owner};}
   else{if(before&&!allowReplacement)return fail('Campaign geography replacement was not authorized');try{prepared={ok:true,id,owner:this.#draftAuthorized&&this.#draft?.id===id&&validCampaignGeographyShape256(raw.definition)&&sameDefinition(this.#draft.owner.definition,raw.definition)?this.#draft.owner:restoreCampaignGeography256(raw.definition)};}catch{return fail('Invalid campaign geography definition');}}
  }else return fail('Unknown geography transport kind');
  // The public receipt is also the pending identity. Freeze it so a caller
  // cannot change its id/owner between prepare and the surrounding commit.
  this.#pending=Object.freeze(prepared);return this.#pending;
 }
 commit(prepared:PreparedGeography256):boolean {if(!prepared.ok||prepared!==this.#pending)return false;this.#accepted={id:prepared.id,owner:prepared.owner};this.#pending=undefined;if(this.#draft?.owner===prepared.owner&&this.#draft.id===prepared.id)this.discardDraftPreview();return true;}
 reset():void {this.#accepted=undefined;this.#pending=undefined;this.discardDraftPreview();}
}
