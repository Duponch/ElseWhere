import {isSchema298OrLater} from './schema-compatibility-257.ts';
import type {World} from './types.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import {SHIP_ESCAPE_HISTORY_LIMIT_298,type EscapeCampaign298,type ShipEscapeReceipt298} from './ship-escape-state-298.ts';

/** Read model only: no original actor, possession, structure, context or alias.
 * Departure IDs are a separate positive namespace; they are never Thing owners.
 * Session countdown presentation belongs to the bridge, not to this World model. */
export interface EscapedShipsSummary298 {
 revision:1;
 receipt:ShipEscapeReceipt298;
 credits:{id:number;mapId:number;computerId:number;departedAt:number;departedAtCore298:number;humans:{id:number;name:string}[];animalCount:number;mechanicalCount:number;casketCount:number;partCount:number}|null;
}
export interface ShipEscapeProjection298 {escapedShips298?:never;escapedShipsSummary298?:EscapedShipsSummary298}
/** Structural UI type, not a RAW save and not an ownership capability. Existing
 * World presentation fields use the same transport-only validation boundary. */
export type NativeUIWorld298=Omit<World,'escapedShips298'|'escapedShipsSummary298'>&ShipEscapeProjection298;

/** Fixed SIM producer, after complete authority/load validation. The caller
 * passes registeredCampaign(input), never a projected/guessed owner. No cache
 * relies on mutable archive identity. O(1) receipt; while credits are
 * open, scan only that latest successful ship's parts, never its possessions
 * or any previous departure. postMessage owns copying the scalar result. */
export function escapedShipProjection298(root:EscapeCampaign298):ShipEscapeProjection298 {
 const field=Object.getOwnPropertyDescriptor(root,'escapedShips298');
 if(!field){if('escapedShips298'in root)throw Error('Inherited escaped-ship authority');return {};}
 const version:unknown=root.schemaVersion;
 if(!isSchema298OrLater(version)||!field.enumerable||!Object.hasOwn(field,'value')||!field.value)throw Error('Invalid escaped-ship projection source');
 const s=field.value as NonNullable<EscapeCampaign298['escapedShips298']>,r=s.receipts.at(-1);
 if(!r)throw Error('Saved escaped-ship owner has no actual departure receipt');
 const receipt={id:r.id,mapId:r.mapId,computerId:r.computerId,at:r.at,atCore298:r.atCore298,outcome:r.outcome};
 let credits:EscapedShipsSummary298['credits']=null;
 if(s.credits!==null){
  const e=s.departures.at(-1);if(!e||e.id!==s.credits)throw Error('Credits have no matching latest departure');
  const humans:{id:number;name:string}[]=[];let animalCount=0,mechanicalCount=0,casketCount=0;
  for(const part of e.parts)if(isShipCasket277(part)){
   casketCount++;const o=part.shipCryptosleep277.occupant;
   if(o?.kind==='human')humans.push({id:o.pawn.id,name:o.pawn.name});
   else if(o?.kind==='animal')animalCount++;else if(o?.kind==='mechanical')mechanicalCount++;
  }
  credits={id:e.id,mapId:e.mapId,computerId:e.computerId,departedAt:e.departedAt,departedAtCore298:e.departedAtCore298,humans,animalCount,mechanicalCount,casketCount,partCount:e.parts.length};
 }
 return {escapedShipsSummary298:{revision:1,receipt,credits}};
}

const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const atCore=(civil:unknown,core:unknown,max:number):core is number=>int(civil)&&int(core,0,max)&&Math.floor(core/10)===civil;
const data=(v:object,k:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{return record(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>!!data(v,k));}
function dense(v:unknown,max:number):v is unknown[]{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max||Reflect.ownKeys(v).length!==v.length+1)return false;
 for(let i=0;i<v.length;i++)if(!data(v,String(i)))return false;return true;
}
const departure=(v:unknown)=>int(v,1,SHIP_ESCAPE_HISTORY_LIMIT_298);
const computer=(v:unknown,nextId:number)=>int(v,1,nextId-1);
const name=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=80;

/** Transport-only descriptor-first shape. RAW archives are forbidden even in
 * 298. Own undefined/inherited/hidden/accessor/symbol additions are refused;
 * old wire has no new field. No supplied flag can bypass authority guards. */
export function validEscapedShipsProjection298(value:unknown,version:unknown,tick:unknown,nextId:unknown,physicalCore298?:number):boolean {
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||'escapedShips298'in value)return false;
  const field=data(value,'escapedShipsSummary298');
  if(!field)return !('escapedShipsSummary298'in value);
  if(!isSchema298OrLater(version)||!atCore(tick,physicalCore298,Number.MAX_SAFE_INTEGER)||!int(nextId,1)||!exact(field.value,['revision','receipt','credits']))return false;
  const s=field.value;if(s.revision!==1)return false;
  const r=s.receipt,c=s.credits;
  if(!record(r)||!exact(r,['id','mapId','computerId','at','atCore298','outcome'])||!departure(r.id)||!int(r.mapId)||!computer(r.computerId,nextId)||!atCore(r.at,r.atCore298,physicalCore298)||r.outcome!=='departed')return false;
  if(c===null)return true;
  if(!exact(c,['id','mapId','computerId','departedAt','departedAtCore298','humans','animalCount','mechanicalCount','casketCount','partCount'])||c.id!==r.id||c.mapId!==r.mapId||c.computerId!==r.computerId||c.departedAt!==r.at||c.departedAtCore298!==r.atCore298||!dense(c.humans,Math.min(32768,nextId-1))||!int(c.animalCount,0,32768)||!int(c.mechanicalCount,0,32768)||!int(c.casketCount,0,32768)||!int(c.partCount,0,32768)||c.casketCount>c.partCount||c.humans.length+c.animalCount+c.mechanicalCount>c.casketCount)return false;
  const ids=new Set<number>();for(const h of c.humans){if(!exact(h,['id','name'])||!computer(h.id,nextId)||!name(h.name)||ids.has(h.id as number))return false;ids.add(h.id as number);}
  return true;
 }catch{return false;}
}

/** Conjoin after the ordinary shape/knowledge guards, including reconstructed
 * checkpoint/delta Worlds. Each credited human must remain known away, never
 * a new physical registration. Receipt/credits may refer to a later
 * retired map. These are references, not a live-map or graph certificate. */
export function validEscapedShipsProjectionScope298(value:object):boolean {
 try{
  const s=data(value,'escapedShipsSummary298')?.value as EscapedShipsSummary298|undefined;
  if(!s?.credits?.humans.length)return true;
  const field=data(value,'people')??data(value,'campaignPeople');
  if(!field||!Array.isArray(field.value))return false;
  const needed=new Map(s.credits.humans.map(h=>[h.id,h.name]));
  for(let i=0;i<field.value.length;i++){
   const p=data(field.value,String(i))?.value;if(!p||typeof p!=='object')return false;
   const id=data(p,'id')?.value;if(!needed.has(id))continue;
   if(data(p,'name')?.value!==needed.get(id)||data(p,'status')?.value!=='away')return false;needed.delete(id);
  }
  return needed.size===0;
 }catch{return false;}
}
