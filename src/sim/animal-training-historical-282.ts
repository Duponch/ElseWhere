import {SCHEMA_VERSION} from './types.ts';
import {isSchema282OrLater} from './schema-compatibility-257.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const domains=['world','dynamic','campaign','wildlife','pawns','structures','packed','worldMaps','worldGroups','worldPawns','secondarySite','campaignMap','group','groupLosses','animalLosses','groups','lostMemories','lossContexts'];
/** Historical fence over actual animal owner lanes and human handling jobs.
 * Human haul is old content. Terrain, resources and planetary geography are
 * never visited. The current version has no recursive adoption overhead. */
export function validAnimalTrainingHistoricalTransport282(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 if(isSchema282OrLater(version))return true;
 let budget=2_000_000;const active=new Set<object>();
 const walk=(v:unknown,animal=false,animalOwners=false):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;
  active.add(v);
  if(animal&&(Object.hasOwn(v,'training')||Object.hasOwn(v,'haul')))return false;
  // Retained bodies can also be reached through a detached original wrapper.
  if(Object.hasOwn(v,'species')&&(Object.hasOwn(v,'training')||Object.hasOwn(v,'haul')))return false;
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return false;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(key==='animalHandling'&&plain(d.value)&&d.value.kind==='train')return false;
   const lane=Array.isArray(v)?animal:key==='animal'||key==='animals'||animalOwners&&key==='members';
   if(!walk(d.value,lane,key==='animalOwners'))return false;
  }
  active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const wrapper=Object.getOwnPropertyDescriptor(value,'world');if(wrapper&&!Object.hasOwn(wrapper,'value'))return false;
  const root=wrapper?.value&&typeof wrapper.value==='object'?wrapper.value:value;
  for(const candidate of root===value?[root]:[root,value])for(const key of domains){
   const d=Object.getOwnPropertyDescriptor(candidate,key);
   if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in candidate)return false;
  }
  return true;
 }catch{return false;}
}
