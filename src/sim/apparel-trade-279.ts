import {APPAREL,type ApparelItem,type ApparelFamily,type ApparelMaterial} from './apparel-definitions.ts';
import {TEXTILE_MATERIALS308,TEXTILE_MATERIAL_FACTS308,type TextileApparelItem308,type TextileMaterial308} from './textile-apparel-308.ts';

/** Core1.6.4871 ordinary textiles already represented by the tailoring chain.
 * Values are knowledge, not permission to trade raw textiles in any channel. */
export const APPAREL_TRADE_MATERIAL_VALUES_279:Readonly<Record<ApparelMaterial,number>>=Object.freeze({
 cloth:1.5,'light-leather':1.9,plainleather:2.1,bluefur:2.3,camelhide:2.3,'muffalo-wool':2.7,foxfur:3.5,
 ...Object.fromEntries(TEXTILE_MATERIALS308.map(m=>[m,TEXTILE_MATERIAL_FACTS308[m].marketValue])) as Record<TextileMaterial308,number>,
});
export type OrdinaryApparelItem279=`${ApparelMaterial}-${Exclude<ApparelFamily,'tuque'>}`|'cloth-tuque'|'muffalo-wool-tuque'|TextileApparelItem308;
export interface ApparelTradeProfile279 {
 readonly family:ApparelFamily;
 readonly material:ApparelMaterial;
 readonly baseMarketValue:number;
 readonly maxHitPoints:number;
 readonly playerCanBuy:boolean;
}
/** Native cost/WorkToMake facts, independent of runtime production imports.
 * Neutral local recipe ticks are Core/10; actor speed never prices a garment. */
const recipes:Readonly<Record<ApparelFamily,Readonly<{units:number;workCore:number}>>>=Object.freeze({
 tribalwear:Object.freeze({units:60,workCore:1800}),shirt:Object.freeze({units:45,workCore:2700}),
 pants:Object.freeze({units:40,workCore:1600}),duster:Object.freeze({units:80,workCore:10000}),
 parka:Object.freeze({units:80,workCore:8000}),tuque:Object.freeze({units:20,workCore:1200}),
});
export const APPAREL_TRADE_ITEMS_279:readonly OrdinaryApparelItem279[]=Object.freeze(
 (Object.keys(APPAREL) as ApparelItem[]).filter((item):item is OrdinaryApparelItem279=>!!APPAREL[item].family&&!!APPAREL[item].material),
);
/** One immutable table from the existing family/material/HP authority. Keep
 * the two historical decimal values exactly; retain common number arithmetic. */
export const APPAREL_TRADE_279:Readonly<Record<OrdinaryApparelItem279,ApparelTradeProfile279>>=Object.freeze(Object.fromEntries(
 APPAREL_TRADE_ITEMS_279.map(item=>{
  const d=APPAREL[item],family=d.family!,material=d.material!,recipe=recipes[family];
  const baseMarketValue=item==='cloth-shirt'?77.22:item==='cloth-tribalwear'?96.48
   :recipe.units*APPAREL_TRADE_MATERIAL_VALUES_279[material]+recipe.workCore*.0036;
  return [item,Object.freeze({family,material,baseMarketValue,maxHitPoints:d.hitPoints,playerCanBuy:family!=='tribalwear'})];
 }),
)) as Readonly<Record<OrdinaryApparelItem279,ApparelTradeProfile279>>;
export const isOrdinaryApparel279=(value:unknown):value is OrdinaryApparelItem279=>typeof value==='string'&&Object.hasOwn(APPAREL_TRADE_279,value);
/** Only these35 permissions are new. The two older cloth permissions retain
 * their exact historical behavior, including the existing caravan channel. */
export const isNewApparelTrade279=(value:unknown):value is Exclude<OrdinaryApparelItem279,'cloth-shirt'|'cloth-tribalwear'>=>
 isOrdinaryApparel279(value)&&value!=='cloth-shirt'&&value!=='cloth-tribalwear';
