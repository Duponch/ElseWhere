import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validStorageSettings} from './designation.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {validStorageItems,validNovelStorageFilters295,validAiCoreStorageFilters298} from './storage-filters.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {SCHEMA_VERSION} from './types.ts';
import {validStorageConditions} from './storage-condition.ts';
import {patchStockpilePolicy} from './stockpile-zones.ts';
import type {ShelfStorageSettings} from './shelf-storage.ts';
import type {StorageSettings} from './types.ts';

const keys=['filters','priority','capacity','items','quality','hitPoints','allowFresh','allowRotten'];
const filterKeys=new Set<string>(['plant','furniture',...Object.values(ITEM_DEFINITIONS).map(d=>d.kind)]);
/** Policies are small data records. Never invoke a caller's accessor, accept
 * hidden fields, or equate a missing option with an own undefined option. */
function dataRecord(value:unknown,allowUndefined=false,depth=0):value is Record<string,unknown>{
 if(depth>2||!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 return Reflect.ownKeys(value).every(key=>{const d=Object.getOwnPropertyDescriptor(value,key)!;return typeof key==='string'&&d.enumerable===true&&Object.hasOwn(d,'value')&&(d.value===undefined?allowUndefined:d.value===null||typeof d.value!=='object'||dataRecord(d.value,false,depth+1));});
}
export function validLinkedShelfPolicy286(value:unknown,version:number=SCHEMA_VERSION):value is ShelfStorageSettings{
 return isSchema286OrLater(version)&&dataRecord(value)&&['filters','priority','capacity'].every(k=>Object.hasOwn(value,k))&&Reflect.ownKeys(value).every(k=>typeof k==='string'&&keys.includes(k))&&dataRecord(value.filters)&&validNovelStorageFilters295(value.filters,version)&&validAiCoreStorageFilters298(value.filters,version)
  &&Object.entries(value.filters).every(([key,v])=>filterKeys.has(key)&&typeof v==='boolean')
  &&Number.isInteger(value.priority)&&Number(value.priority)>=1&&Number(value.priority)<=5&&value.capacity===500
  &&validStorageItems(value.items,isSchema298OrLater(version)?298:(version===295||(version===296||isCorePhysicalSchema297(version)))?295:286)&&validStorageConditions(value,286);
}
/** No effective/hidden/caller record shares a mutable policy leaf. */
export function cloneLinkedShelfPolicy286(value:ShelfStorageSettings):ShelfStorageSettings{
 return {...value,filters:{...value.filters},...(Object.hasOwn(value,'items')?{items:{...value.items}}:{}),...(Object.hasOwn(value,'quality')?{quality:{...value.quality!}}:{}),...(Object.hasOwn(value,'hitPoints')?{hitPoints:{...value.hitPoints!}}:{})};
}
function sameData(a:object,b:object,depth=0):boolean{
 if(depth>2)return false;
 const ka=Reflect.ownKeys(a),kb=Reflect.ownKeys(b);if(ka.length!==kb.length)return false;
 return ka.every(k=>{const da=Object.getOwnPropertyDescriptor(a,k),db=Object.getOwnPropertyDescriptor(b,k);if(!da||!db||!Object.hasOwn(da,'value')||!Object.hasOwn(db,'value')||da.enumerable!==db.enumerable)return false;return da.value&&db.value&&typeof da.value==='object'&&typeof db.value==='object'?sameData(da.value,db.value,depth+1):Object.is(da.value,db.value);});
}
export function sameLinkedShelfPolicy286(a:ShelfStorageSettings,b:ShelfStorageSettings):boolean{return sameData(a,b);}
/** Same partial-patch contract as ordinary shelves, including explicit clears.
 * Capacity remains one historical policy field, never a second footprint. */
export function patchLinkedShelfPolicy286(base:ShelfStorageSettings,patch:StorageSettings,version:number=SCHEMA_VERSION):ShelfStorageSettings|undefined{
 if(!validLinkedShelfPolicy286(base,version)||!dataRecord(patch,true)||Reflect.ownKeys(patch).some(k=>typeof k!=='string'||!keys.includes(k))||!validStorageSettings(patch,version))return;
 const next={...cloneLinkedShelfPolicy286(base),id:0,x:0,z:0};
 patchStockpilePolicy(next,patch);next.capacity=500;
 const {id:_id,x:_x,z:_z,...policy}=next;
 return validLinkedShelfPolicy286(policy,version)?policy:undefined;
}
