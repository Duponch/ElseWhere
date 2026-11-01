import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {isProstheticItem273} from './prosthetic-content-273.ts';
import {isSchema272OrLater} from './schema-compatibility-257.ts';
import {isSchema269OrLater,isSchema270OrLater} from './schema-compatibility-257.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isMaceItem269} from './mace-content-269.ts';
import {isSmithingProduct267,isSmithingWorkpiece267} from './smithing-content-267.ts';
import {isFutureEcologyItem256} from './cave-products-256.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { storageConditionAccepts,type StorageConditions } from './storage-condition.ts';
import { isPerishable } from './food-preservation.ts';
import { SCHEMA_VERSION,type MaterialPile,type StockpileCell } from './types.ts';

/** One prospective category flag. Inspect its descriptor before a caller can
 * enumerate/read policy values; an absent historical choice stays absent. */
export function validNovelStorageFilters295(filters:unknown,version:number):boolean {
  if(filters===undefined)return true;
  if(!filters||typeof filters!=='object'||Array.isArray(filters))return false;
  if(!('book'in filters))return true;
  const d=Object.getOwnPropertyDescriptor(filters,'book');
  return (version===295||(version===296||isCorePhysicalSchema297(version)))&&!!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&typeof d.value==='boolean';
}

/** AI category and per-item choices are prospective own data. Inspect before
 * policy enumeration so accessors/hidden/inherited/undefined never grant admission. */
export function validAiCoreStorageFilters298(filters:unknown,version:number):boolean {
  if(filters===undefined)return true;
  if(!filters||typeof filters!=='object'||Array.isArray(filters))return false;
  if(!('ai-core'in filters))return true;
  const d=Object.getOwnPropertyDescriptor(filters,'ai-core');
  return isSchema298OrLater(version)&&!!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&typeof d.value==='boolean';
}

export function validStorageItems(items:unknown,version:number=SCHEMA_VERSION):boolean {
  if(!validAiCoreStorageFilters298(items,version))return false;
  if(items&&typeof items==='object'&&'novel'in items){const d=Object.getOwnPropertyDescriptor(items,'novel');if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!d||!d.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='boolean')return false;}
  return items===undefined||!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.entries(items).every(([key,value])=>Object.hasOwn(ITEM_DEFINITIONS,key)&&(key!=='ai-core'||isSchema298OrLater(version))&&(key!=='novel'||(version===295||(version===296||isCorePhysicalSchema297(version))))&&(isSchema273OrLater(version)||!isProstheticItem273(key)&&key!=='unfinished-prosthetic')&&(isSchema272OrLater(version)||!isSpearItem272(key)&&key!=='unfinished-spear')&&(isSchema269OrLater(version)||!isMaceItem269(key)&&key!=='unfinished-mace')&&(isSchema270OrLater(version)||!isLongswordItem270(key)&&key!=='unfinished-longsword')&&(version>=268||key!=='unfinished-knife')&&(version>=267||!isSmithingProduct267(key)&&!isSmithingWorkpiece267(key))&&(version>=265||!['hops','wort','beer'].includes(key))&&(version>=256||!isFutureEcologyItem256(key)&&key!=='slag-steel-chunk')&&(version>=241||!['uranium','recon-armor','unfinished-recon-armor'].includes(key))&&(version>=235||key!=='minified-tree')&&(version>=227||key!=='hay'&&key!=='kibble')&&(version>=218||key!=='chemfuel')&&(version>=206||key!=='neutroamine')&&(version>=217||key!=='nutrient-paste-meal')&&typeof value==='boolean');
}

/** A missing item list is the historical category-only rule. Once present,
 * the list is explicit: an omitted item is refused even when its category is on. */
export function storageAccepts(zone: Pick<StockpileCell, 'filters'> & StorageConditions & { items?: Partial<Record<ItemId, boolean>> }, subject: ItemId|MaterialPile,tick?:number): boolean {
  const item=typeof subject==='string'?subject:subject.item;
  return zone.filters[ITEM_DEFINITIONS[item].kind] === true && (zone.items === undefined || zone.items[item] === true)
    &&(typeof subject==='string'
      ?zone.allowFresh!==false&&zone.allowRotten!==false?true:ITEM_DEFINITIONS[item].kind==='corpse'?zone.allowFresh!==false||zone.allowRotten!==false
        :!isPerishable(item)&&ITEM_DEFINITIONS[item].nutrition<=0||zone.allowFresh!==false
      :storageConditionAccepts(zone,subject,tick));
}
