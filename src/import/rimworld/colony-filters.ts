/** Core ThingFilter admission. Core filters ThingDefs (not Stuff variants);
 * Elsewhere uses an explicit list of actual ItemIds. In particular merely
 * setting the apparel/weapon category while supplying a nonempty item list
 * does NOT allow any apparel or weapons. Expand every admissible variant. */
import {APPAREL} from '../../sim/apparel-definitions.ts';
import {WEAPON_LABELS} from '../../sim/equipment-rules.ts';
import {ITEM_DEFINITIONS,type ItemId} from '../../sim/items.ts';
import type {StorageFilters} from '../../sim/types.ts';
import type {StorageConditions} from '../../sim/storage-condition.ts';
import {minifiable} from '../../sim/furniture-rules.ts';
import {APPAREL_MAP,WEAPON_MAP,ITEM_MAP,QUALITY_MAP} from './map-items.ts';
import {ANIMAL_MAP} from './map-pawns.ts';
import {BUILDING_MAP} from './map-buildings.ts';
import {lookup,isDropped} from './mapping.ts';
import {at,items,text,type XmlNode} from './xml.ts';
import {STORAGE_PRIORITY} from './map-colony.ts';

const itemIds=(def:string):ItemId[]=>Object.hasOwn(ITEM_DEFINITIONS,def)?[def as ItemId]:[];
const allIds=()=>Object.keys(ITEM_DEFINITIONS) as ItemId[];
const cache=new Map<string,readonly ItemId[]>();

export function filterItemIds(def:string):readonly ItemId[] {
 let result=cache.get(def);
 if(!result){result=Object.freeze(resolveFilterItemIds(def));cache.set(def,result);}
 return result;
}
function resolveFilterItemIds(def:string):ItemId[] {
 const item=lookup(ITEM_MAP,def);
 if(item&&!isDropped(item))return itemIds(item.to);
 const apparel=lookup(APPAREL_MAP,def);
 if(apparel&&!isDropped(apparel)){
  const s=apparel.to;
  if('item' in s)return s.item==='flak-helmet'||s.item==='plasteel-flak-helmet'?['flak-helmet','plasteel-flak-helmet']:itemIds(s.item);
  if('family' in s)return Object.entries(APPAREL).filter(([,v])=>v.family===s.family).flatMap(([id])=>itemIds(id));
  return allIds().filter(i=>i.endsWith('-'+s.armor)&&ITEM_DEFINITIONS[i].kind==='apparel');
 }
 const weapon=lookup(WEAPON_MAP,def);
 if(weapon&&!isDropped(weapon)){
  const s=weapon.to;
  return 'item' in s?itemIds(s.item):allIds().filter(i=>Object.hasOwn(WEAPON_LABELS,i)&&i.endsWith('-'+s.family));
 }
 if(def==='Corpse_Human')return ['human-corpse'];
 if(def.startsWith('Corpse_Mech_'))return itemIds(def.slice(12).toLowerCase()+'-corpse');
 if(def.startsWith('Corpse_')){
  const animal=lookup(ANIMAL_MAP,def.slice(7));
  return animal&&!isDropped(animal)?itemIds(animal.to+'-corpse'):[];
 }
 if(def==='Novel')return ['novel'];
 const unfinished:Record<string,string>={UnfinishedSculpture:'unfinished-sculpture',UnfinishedGun:'unfinished-gun',UnfinishedComponent:'unfinished-component',UnfinishedHealthItemProsthetic:'unfinished-prosthetic'};
 if(def==='UnfinishedApparel')return allIds().filter(i=>['unfinished-tribalwear','unfinished-shirt','unfinished-pants','unfinished-duster','unfinished-parka','unfinished-tuque','unfinished-tshirt','unfinished-jacket','unfinished-cowboy-hat','unfinished-bowler-hat'].includes(i));
 if(def==='UnfinishedTechArmor'||def==='UnfinishedMetallicTechArmor')return allIds().filter(i=>i.startsWith('unfinished-flak-')||i.startsWith('unfinished-recon-'));
 if(def==='UnfinishedWeapon')return allIds().filter(i=>['unfinished-knife','unfinished-mace','unfinished-longsword','unfinished-spear','unfinished-bow'].includes(i));
 return unfinished[def]?itemIds(unfinished[def]!):[];
}

export function numberRange(value:string|undefined,low:number,high:number,scale=1):{min:number;max:number}|undefined {
 const matches=value?.match(/^\s*(-?(?:\d+\.?\d*|\.\d+))\s*~\s*(-?(?:\d+\.?\d*|\.\d+))\s*$/);
 if(!matches)return;
 const min=Math.round(Number(matches[1])*scale),max=Math.round(Number(matches[2])*scale);
 return Number.isSafeInteger(min)&&Number.isSafeInteger(max)&&min>=low&&max<=high&&min<=max?{min,max}:undefined;
}
export function qualityRange(value:string|undefined):StorageConditions['quality'] {
 if(!value)return;
 const [a,b]=value.split('~');
 const min=a&&Object.hasOwn(QUALITY_MAP,a)?QUALITY_MAP[a]:undefined,max=b&&Object.hasOwn(QUALITY_MAP,b)?QUALITY_MAP[b]:undefined;
 return min&&max?{min,max}:undefined;
}

export interface ImportedStorageSettings extends StorageConditions {filters:StorageFilters;items:Partial<Record<ItemId,boolean>>;priority:number}
export function storageSettingsFromCore(node:XmlNode|undefined):ImportedStorageSettings|undefined {
 if(!node||node.attrs?.IsNull==='True')return;
 const allowed=items(node,'filter/allowedDefs').flatMap(n=>text(n)??[]);
 const disallowed=new Set(items(node,'filter/disallowedSpecialFilters').map(n=>n.text.trim()));
 const filters:StorageFilters={wood:false,food:false},explicit:Partial<Record<ItemId,boolean>>={};
 for(const def of allowed){
  for(const item of filterItemIds(def)){
   explicit[item]=true;filters[ITEM_DEFINITIONS[item].kind]=true;
  }
  // Core records actual minified building defs, whereas Elsewhere has a
  // single furniture category. Do not turn it on for a non-minifiable def.
  const b=lookup(BUILDING_MAP,def);
  if(def==='MinifiedThing'||b&&!isDropped(b)&&minifiable(b.to.kind))filters.furniture=true;
 }
 // A material pile of a real minified tree is represented separately.
 if(allowed.includes('MinifiedTree')){explicit['minified-tree']=true;filters.plant=true;}
 const result:ImportedStorageSettings={filters,items:explicit,priority:STORAGE_PRIORITY[text(node,'priority')??'Normal']??2};
 const hp=numberRange(text(node,'filter/allowedHitPointsPercents'),0,100,100),q=qualityRange(text(node,'filter/allowedQualityLevels'));
 if(hp&&(hp.min!==0||hp.max!==100))result.hitPoints=hp;
 if(q&&(q.min!=='awful'||q.max!=='legendary'))result.quality=q;
 if(disallowed.has('AllowFresh'))result.allowFresh=false;
 if(disallowed.has('AllowRotten'))result.allowRotten=false;
 return result;
}
