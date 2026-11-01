import {isSchema280OrLater} from './schema-compatibility-257.ts';
import {validateSurgeries} from './surgery-save.ts';
import type {World} from './types.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const domains=['pawns','structures','jobs','packed','piles','worldMaps','secondarySite','campaignMap','worldPawns','worldGroups',
 'group','groupLosses','visitors','raids','podRescues','prisonDepartures','scout','commercialTrip','civilianPost','orbital','startingArrival','arrivals','quests','people','lossContexts','lostMemories'];

/** No new field exists: the prospective domain is the actual captive paired
 * with surgical intent/service. Historical bodies and doses stay unchanged.
 * Inspect real owner domains before migration or sparse reconstruction. */
export function validPrisonerSurgeryHistoricalTransport280(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>299)return false;
 if(isSchema280OrLater(version))return true;
 let budget=2_000_000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;
  active.add(v);
  if(data(v,'prisoner')?.value!==undefined&&(data(v,'surgeryRequest')?.value!==undefined||data(v,'surgery')?.value!==undefined))return false;
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
  const wrapper=Object.getOwnPropertyDescriptor(value,'world');if(wrapper&&!Object.hasOwn(wrapper,'value'))return false;
  const root=data(value,'type')?.value==='snapshot'&&wrapper?.value&&typeof wrapper.value==='object'?wrapper.value:value;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in root)return false;}
  if(root!==value)for(const key of ['pawns','structures','jobs','piles']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in value)return false;}
  return true;
 }catch{return false;}
}

/** No body, terrain, room or inventory scan for people without surgery. A
 * stale doctor's target also counts, so a missing patient intent cannot evade
 * the existing clinical relation validator after a sparse replacement. */
export function hasPrisonerSurgery280(w:World):boolean {
 for(const p of w.pawns)if(p.prisoner&&(p.surgeryRequest||p.surgery))return true;
 for(const d of w.pawns)if(d.surgery){
  const patient=w.pawns.find(p=>p.id===d.surgery!.patientId);
  if(!patient||patient.prisoner||w.structures.some(s=>s.id===d.surgery!.bedId&&s.prisoner))return true;
 }
 return false;
}
/** Reuse the authoritative clinical relations only for this new active
 * pairing. Ordinary Worlds never pay another clinical/topology validation. */
export function validPrisonerSurgeryWorld280(w:World):boolean {
 try{
  if(!Number.isSafeInteger(w.schemaVersion)||Number(w.schemaVersion)<1||Number(w.schemaVersion)>299)return false;
  if(!hasPrisonerSurgery280(w))return true;
  return isSchema280OrLater(w.schemaVersion)&&validateSurgeries(w,w.schemaVersion).length===0;
 }catch{return false;}
}
