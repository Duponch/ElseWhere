import {unavailableEcologyItem} from './cave-products-256.ts';
import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import { FOOD_POISON_CAUSES,FOOD_POISON_UNIT,foodCanCarryPoison,rawFoodPoisonChance } from './food-poisoning.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
/** Undefined is a clean historical stack; migration never invents contamination. */
export function validFoodContamination(value:unknown,item:ItemId,allowed:boolean):boolean {
  if(value===undefined)return true;
  return allowed&&foodCanCarryPoison(item)&&object(value)&&keys(value,['fraction','cause'])&&typeof value.fraction==='number'&&Number.isFinite(value.fraction)&&value.fraction>0&&value.fraction<=1&&typeof value.cause==='string'&&['filthy-kitchen','incompetent-cook','unknown'].includes(value.cause);
}
/** Spatial bounds are checked by the world owner (a medical record is also
 * used for retained corpses and off-map records without a live map). */
export function validFoodPoisoning(value:unknown,tick:number,allowed:boolean,version=91):boolean {
  if(value===undefined)return true;
  if(!allowed||!object(value)||!keys(value,['severity','bornAt','cause','item','vomit'])||!integer(value.severity,0,FOOD_POISON_UNIT)||!integer(value.bornAt,0,tick)||typeof value.cause!=='string'||!FOOD_POISON_CAUSES.includes(value.cause as typeof FOOD_POISON_CAUSES[number])||typeof value.item!=='string'||unavailableEcologyItem(value.item,version)||version<248&&value.item==='pemmican'||version<227&&value.item==='kibble'||version<217&&value.item==='nutrient-paste-meal'||version<157&&value.item==='vegetarian-lavish-meal'||version<159&&value.item==='carnivore-lavish-meal'||version<156&&value.item==='carnivore-fine-meal'||version<155&&value.item==='vegetarian-fine-meal'||version<154&&value.item==='lavish-meal'||version<152&&value.item==='fine-meal'||!Object.hasOwn(ITEM_DEFINITIONS,value.item)||ITEM_DEFINITIONS[value.item as ItemId].kind!=='food')return false;
  if(value.cause==='dangerous-food'?!rawFoodPoisonChance(value.item as ItemId):!foodCanCarryPoison(value.item as ItemId))return false;
  if(value.vomit===undefined)return Number(value.severity)>0;
  return object(value.vomit)&&keys(value.vomit,['remainingCore','cell'])&&integer(value.vomit.remainingCore,1,899)&&object(value.vomit.cell)&&keys(value.vomit.cell,['x','z'])&&integer(value.vomit.cell.x,0)&&integer(value.vomit.cell.z,0);
}
