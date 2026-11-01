import {isSchema279OrLater} from './schema-compatibility-257.ts';
import {isOrdinaryApparel279,isNewApparelTrade279} from './apparel-trade-279.ts';
import {validApparelShape} from './apparel-save.ts';
import {validTradeInventoryCustody} from './trade-save.ts';
import type {World} from './types.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const domains=['piles','pawns','structures','jobs','packed','worldMaps','secondarySite','campaignMap','worldPawns','worldGroups',
 'group','groupLosses','visitors','raids','podRescues','prisonDepartures','scout','commercialTrip','trade','civilianPost','orbital','startingArrival','arrivals','quests'];

/** The37 ItemIds already existed on bodies/ground. Fence only their new
 * inventory custody and the35 newly traded receipt identities, before any
 * historical map migrates or a sparse public predecessor can be replaced. */
export function validApparelTradeHistoricalTransport279(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>300)return false;if(isSchema279OrLater(version))return true;
 let budget=2_000_000;const active=new Set<object>();
 const walk=(v:unknown,inTrade=false):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;active.add(v);
  const item=data(v,'item')?.value,owner=data(v,'owner')?.value;
  if(isOrdinaryApparel279(item)&&plain(owner)&&data(owner,'type')?.value==='inventory'||inTrade&&isNewApparelTrade279(item))return false;
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return false;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(inTrade&&['bought','sold'].includes(key)&&plain(d.value)&&Reflect.ownKeys(d.value).some(isNewApparelTrade279))return false;
   if(!walk(d.value,inTrade||key==='trade'))return false;
  }
  active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const wrapper=Object.getOwnPropertyDescriptor(value,'world');if(wrapper&&!Object.hasOwn(wrapper,'value'))return false;
  const root=data(value,'type')?.value==='snapshot'&&wrapper?.value&&typeof wrapper.value==='object'?wrapper.value:value;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value,key==='trade'))||!d&&key in root)return false;}
  if(root!==value)for(const key of ['piles','pawns','structures','jobs']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in value)return false;}
  return true;
 }catch{return false;}
}

/** Public readers already validate ordinary local pile shapes. This joins
 * the new custody to the existing real-human/animal inventory guard and checks
 * archived garments at their actual departure owner, without a synthetic map. */
export function validApparelTradeWorld279(w:World):boolean {
 try{
  if(!Number.isSafeInteger(w.schemaVersion)||Number(w.schemaVersion)<1||Number(w.schemaVersion)>300)return false;
  if(!isSchema279OrLater(w.schemaVersion))return true;
  for(const pile of w.piles)if(pile.owner.type==='inventory'&&isOrdinaryApparel279(pile.item)){
   if(pile.kind!=='apparel'||!validApparelShape(pile as unknown as Record<string,unknown>,w.schemaVersion))return false;
   if(!validTradeInventoryCustody(w,pile,w.schemaVersion))return false;
  }
  for(const records of [w.visitors?.departed??[],w.podRescues?.departed??[]])for(const d of records)for(const pile of d.items)if(pile.owner.type==='inventory'&&isOrdinaryApparel279(pile.item)){
   if(!plain(pile)||pile.kind!=='apparel'||!validApparelShape(pile as unknown as Record<string,unknown>,w.schemaVersion)||!plain(pile.owner)
     ||Reflect.ownKeys(pile.owner).length!==2||!['inventory','apparel'].includes(pile.owner.type)||!('pawnId'in pile.owner)||pile.owner.pawnId!==d.pawn.id)return false;
  }
  return true;
 }catch{return false;}
}
