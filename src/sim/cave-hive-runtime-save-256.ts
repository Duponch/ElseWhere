import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Closed optional runtime data. Only the real local decision creates these
 * fields; load/migration never supply a first decision or reset its timestamp. */
import {isCaveInsectSpecies256} from './cave-insect-constructor-256.ts';
import {validHiveInsectField256} from './cave-hive-save-256.ts';
import type {World} from './types.ts';
type Data=Record<string,unknown>;
const object=(v:unknown):v is Data=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
function exact(v:unknown,keys:readonly string[]):boolean {return object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&Object.hasOwn(d,'value')&&d.enumerable===true;});}
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export function validHiveRuntimeFields256(v:unknown,version:number,tick:number,nextId:number):boolean {
 if(!object(v)||!validHiveInsectField256(v,version,nextId))return false;
 for(const field of ['hiveThink','hiveJob']){
  const d=Object.getOwnPropertyDescriptor(v,field);if(!d){if(field in v)return false;continue;}
  const species=Object.getOwnPropertyDescriptor(v,'species'),membership=Object.getOwnPropertyDescriptor(v,'hive');
  if(!isSchema256Or257(version)||!Object.hasOwn(d,'value')||!d.enumerable||!species||!('value'in species)||!isCaveInsectSpecies256(species.value)||!membership||!('value'in membership)||!object(membership.value))return false;
  if(field==='hiveThink'){
   if(!exact(d.value,['maintenanceLastTryCore'])||!int(d.value.maintenanceLastTryCore,-99999,tick*10))return false;
  }else {
   const domestic=Object.getOwnPropertyDescriptor(v,'domestic'),state=Object.getOwnPropertyDescriptor(v,'state');
   if(membership.value.lordId===null||domestic&&(!('value'in domestic)||domestic.value)||!state||!('value'in state)||state.value==='dead'||state.value==='downed'||!object(d.value))return false;
   const kind=Object.getOwnPropertyDescriptor(d.value,'kind');if(!kind||!('value'in kind))return false;
   if(kind.value==='maintain'){if(!exact(d.value,['kind','hiveId','progressCore'])||!int(d.value.hiveId,1,nextId-1)||!int(d.value.progressCore,0,179))return false;}
   else if(kind.value==='attack'){if(!(exact(d.value,['kind','targetId'])||exact(d.value,['kind','targetId','structure'])&&d.value.structure===true)||!int(d.value.targetId,1,nextId-1))return false;}
   else return false;
  }
 }
 return true;
}
export function validateHiveRuntimeOwners256(w:Pick<World,'schemaVersion'|'tick'|'nextId'|'wildlife'|'structures'|'pawns'|'mechanoids'>):string[] {
 const reserved=new Set<number>();
 for(const animal of w.wildlife?.animals??[]){
  if(!validHiveRuntimeFields256(animal,w.schemaVersion,w.tick,w.nextId))return ['Invalid or future Hive runtime job/think data'];
  const job=(animal as import('./cave-hive-maintenance-256.ts').HiveMaintenanceActor256).hiveJob;if(!job)continue;
  if(job.kind==='maintain'){if(reserved.has(job.hiveId)||!w.structures.some(s=>s.id===job.hiveId&&s.kind==='insect-hive'))return ['Missing or multiply reserved original Hive maintenance target'];reserved.add(job.hiveId);}
  else if(job.structure?!w.structures.some(s=>s.id===job.targetId&&s.kind!=='hidden-conduit'):![...w.pawns,...(w.wildlife?.animals??[]),...(w.mechanoids??[])].some(a=>a.id===job.targetId))return ['Hive attack references an absent physical owner'];
 }
 return [];
}
