import {isSchema277OrLater} from './schema-compatibility-257.ts';
const tokens277=new Set(['ship-cryptosleep-casket','shipCryptosleep277','shipCasketTask277','shipCryptosleepHeldAt277','ship-cryptosleep','shipCryptosleep','heldShipCaskets277','shipCasketTerminal277','destroyed277','ship277','suspendedCore277',
 'order-enter-ship-casket','order-carry-ship-casket','eject-ship-casket']);
const domains277=['piles','pawns','mechanoids','wildlife','structures','jobs','packed','stockpiles','research','spoiled','destroyed','deconstructed','apparelPolicies',
 'group','groupLosses','worldGroups','worldPawns','commercialTrip','civilianPost','visitors','raids','trade','orbital','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','fires','bombWaves','campaignMap'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
/** Fence original RAW and sparse/public domains before migration/adoption.
 * It never reads terrain, resource arrays or the planetary payload. */
export function validShipCasketHistoricalTransport277(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>299)return false;if(isSchema277OrLater(version))return true;
 let budget=2000000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!record(v))return false;active.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string'||tokens277.has(key))return false;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(['kind','item','recipe','tool','project','type','result'].includes(key)&&typeof d.value==='string'&&tokens277.has(d.value))return false;
   if(['allowed','allowedItems','inputs'].includes(key)&&Array.isArray(d.value))for(const k of Reflect.ownKeys(d.value)){
    const item=Object.getOwnPropertyDescriptor(d.value,k);if(!item||!Object.hasOwn(item,'value')||typeof item.value==='string'&&tokens277.has(item.value))return false;
   }
   if(!walk(d.value))return false;
  }
  active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const wrapped=Object.getOwnPropertyDescriptor(value,'world');if(wrapped&&!Object.hasOwn(wrapped,'value'))return false;
  const root=wrapped?.value&&typeof wrapped.value==='object'?wrapped.value:value;
  for(const key of [...domains277,'secondarySite','worldMaps']){const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in root)return false;}
  if(root!==value)for(const key of ['piles','pawns','structures','jobs','mechanoids']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in value)return false;}
  return true;
 }catch{return false;}
}
