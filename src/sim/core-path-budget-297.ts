import {SCHEMA_VERSION} from './types.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
export interface CorePathBudget297 {tick:number;remaining:number;pairs:number}
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
/** Only fresh owner/adoption/reset transactions call this; never a save reader. */
export function newCorePathBudget297(tick:number):CorePathBudget297 {if(!integer(tick))throw Error('Invalid actual path-budget owner tick');return {tick,remaining:8,pairs:32768};}
/** One real LOCAL map. Campaign phase is explicit; it is not copied as an owner capability. */
export function validCorePathBudget297(body:unknown,version:number,tick:number,phase:number,localOwner=true):boolean {
 if(!body||typeof body!=='object'||Array.isArray(body)||!integer(version,1,SCHEMA_VERSION))return false;
 const present='corePathBudget297'in body;
 if(!isCorePhysicalSchema297(version)||!localOwner)return !present;
 if(!integer(tick)||!integer(phase,0,9))return false;
 if(!present)return phase===0; // Only a phase-zero prospective adoption may lack the owner.
 const d=Object.getOwnPropertyDescriptor(body,'corePathBudget297');
 if(!d?.enumerable||!Object.hasOwn(d,'value')||!d.value||typeof d.value!=='object'||Array.isArray(d.value)||Object.getPrototypeOf(d.value)!==Object.prototype)return false;
 const b=d.value,names=['tick','remaining','pairs'];if(Reflect.ownKeys(b).length!==3||!names.every(key=>{const p=Object.getOwnPropertyDescriptor(b,key);return !!p&&p.enumerable===true&&Object.hasOwn(p,'value');}))return false;
 return b.tick===tick&&integer(b.tick)&&integer(b.remaining,0,8)&&integer(b.pairs,0,32768);
}
/** Genuine296 admission completed first. Every real map gets its prospective
 * phase-zero owner; an existing current owner is NEVER reset on load. No RNG. */
export function adoptMigratedCorePathBudgets297(raw:Record<string,unknown>):void {
 if(raw.schemaVersion!==297||raw.phaseCore297!==0||!integer(raw.tick))throw Error('Path budget migration requires actual prospective phase zero');
 const tick=raw.tick,attach=(value:unknown)=>{if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray((value as Record<string,unknown>).tiles))return;if(!('corePathBudget297'in value))(value as Record<string,unknown>).corePathBudget297=newCorePathBudget297(tick);};
 attach(raw);const maps=raw.worldMaps as {sites?:{map?:unknown}[]}|undefined;for(const record of maps?.sites??[])if(record.map)attach(record.map);
 const secondary=raw.secondarySite as {map?:unknown}|undefined;if(secondary?.map)attach(secondary.map);
}
