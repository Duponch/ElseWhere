import {schemaAtLeast} from './schema-range.ts';
import type {Job} from './types.ts';
export type ConstructionForbidCommand379={type:'construction-forbid-379';jobId:number;forbidden:boolean};
export const isConstructionSchema379=schemaAtLeast(379);
/** Independent manual deconstruction remains available beside a forbidden
 * door blueprint; the blueprint itself never authorizes new blocker work. */
export function constructionJobAllowed379(job:Pick<Job,'forbidden379'|'wallDoor296'>):boolean {
 return job.forbidden379!==true&&(!job.wallDoor296?.plan?.forbidden379||job.wallDoor296.manual);
}
const marker=(raw:object,key:string,version:number,allowed:()=>boolean):boolean=>{
 const d=Object.getOwnPropertyDescriptor(raw,key);if(!d)return !(key in raw);
 return isConstructionSchema379(version)&&d.enumerable===true&&Object.hasOwn(d,'value')&&d.value===true&&allowed();
};
/** Historical absence stays absent, including own undefined and getters. */
export function validConstructionMarkers379(raw:unknown,version:number):boolean {
 if(!raw||typeof raw!=='object')return false;
 const value=raw as Record<string,unknown>,read=(k:string)=>Object.getOwnPropertyDescriptor(value,k)?.value;
 return marker(value,'forbidden379',version,()=>
  (read('construction')==='blueprint'||read('construction')==='frame')&&typeof read('kind')==='string'
  ||read('revision')===1&&(read('kind')==='door'||read('kind')==='autodoor')&&Number.isSafeInteger(read('id')))
  &&marker(value,'tailorSteel379',version,()=>read('kind')==='electric-tailor-bench'&&read('material')==='steel');
}
