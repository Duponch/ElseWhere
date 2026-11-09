import {SCHEMA_VERSION} from './types.ts';
import {isSchema278OrLater} from './schema-compatibility-257.ts';
import {isApparelCountRecipe278,validApparelCountFilter278} from './apparel-count-278.ts';

const domains=['piles','pawns','structures','jobs','packed','worldMaps','secondarySite','campaignMap',
 'worldGroups','worldPawns','group','groupLosses','commercialTrip','civilianPost','visitors','raids',
 'trade','orbital','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','wildlife'];
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;

/** Only the new optional bill field is checked here. Existing bill records
 * keep their ordinary domain validators; no world/grid or owner is fabricated. */
export function validApparelReservesBuilding278(value:unknown,version:number):boolean {
 if(!plain(value)||!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 const bills=Object.getOwnPropertyDescriptor(value,'bills');
 if(!bills)return !('bills'in value);
 if(!Object.hasOwn(bills,'value'))return false;
 if(!Array.isArray(bills.value))return true; // No new field; existing bill guard owns the shape.
 for(let i=0;i<bills.value.length;i++){
  const row=Object.getOwnPropertyDescriptor(bills.value,String(i));if(!row)continue;if(!Object.hasOwn(row,'value'))return false;
  const bill=row.value;
  if(bill===null||typeof bill!=='object'||!('apparelCount'in bill))continue;
  const field=Object.getOwnPropertyDescriptor(bill,'apparelCount'),recipe=Object.getOwnPropertyDescriptor(bill,'recipe');
  if(!isSchema278OrLater(version)||!plain(bill)||!field?.enumerable||!Object.hasOwn(field,'value')
    ||!recipe?.enumerable||!Object.hasOwn(recipe,'value')||!isApparelCountRecipe278(recipe.value)||!validApparelCountFilter278(field.value))return false;
 }
 return true;
}

/** Fence actual historical RAW and sparse public owners before migration or
 * adoption. Current bill shapes use validBillSettings; absence stays historical.
 * This does not walk terrain, resources or the planetary payload. */
export function validApparelReservesHistoricalTransport278(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 if(isSchema278OrLater(version))return true;
 let budget=2_000_000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v)||'apparelCount'in v)return false;
  active.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return false;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(!walk(d.value))return false;
  }
  active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const envelope=Object.getOwnPropertyDescriptor(value,'world');if(envelope&&!Object.hasOwn(envelope,'value'))return false;
  const root=envelope?.value&&typeof envelope.value==='object'?envelope.value:value;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in root)return false;}
  if(root!==value)for(const key of ['piles','pawns','structures','jobs']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in value)return false;}
  return true;
 }catch{return false;}
}
