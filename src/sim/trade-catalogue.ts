import {SHORT_BOW_BASE_VALUE_316} from './short-bow-316.ts';
import {LONGSWORD_ITEMS_270,longswordBaseValue270,longswordMaxHitPoints270} from './longsword-content-270.ts';
import {SPEAR_ITEMS_272,spearBaseValue272,spearMaxHitPoints272} from './spear-content-272.ts';
import type { ItemId } from './items.ts';
import {SMITHING_APPAREL_ITEMS267,SMITHING_APPAREL_DEFINITIONS267,smithingApparelBaseValue267} from './smithing-apparel-267.ts';
import {APPAREL_TRADE_ITEMS_279,APPAREL_TRADE_279,isNewApparelTrade279} from './apparel-trade-279.ts';

/** Core 1.6.4871 normal-quality values before quality, condition and rounding.
 * Fixed material is part of each existing ItemId; there is no generic price by kind. */
export interface TradeCatalogueEntry {
  readonly baseMarketValue:number;
  readonly healthAffectsPrice:boolean;
  readonly maxHitPoints:number;
  readonly hasQuality:boolean;
  readonly sellPriceFactor:number;
  readonly playerCanBuy:boolean;
  readonly playerCanSell:boolean;
  readonly visitorHandles:boolean;
}
function value(baseMarketValue:number,visitorHandles=false,extra:Partial<TradeCatalogueEntry>={}):TradeCatalogueEntry {
  return Object.freeze({baseMarketValue,healthAffectsPrice:false,maxHitPoints:0,hasQuality:false,sellPriceFactor:1,playerCanBuy:true,playerCanSell:true,visitorHandles,...extra});
}
function gear(baseMarketValue:number,maxHitPoints:number,visitorHandles:boolean,weapon=false,extra:Partial<TradeCatalogueEntry>={}):TradeCatalogueEntry {
  return value(baseMarketValue,visitorHandles,{healthAffectsPrice:true,maxHitPoints,hasQuality:true,sellPriceFactor:weapon?.2:1,...extra});
}
export const TRADE_CATALOGUE:Readonly<Partial<Record<ItemId,TradeCatalogueEntry>>>=Object.freeze({
  'ai-core':value(4000,false,{healthAffectsPrice:true,maxHitPoints:100,playerCanBuy:false,playerCanSell:true}),
  novel:gear(160,60,false),
  'prosthetic-arm':value(258,false,{healthAffectsPrice:true,maxHitPoints:50}),
  'prosthetic-leg':value(258,false,{healthAffectsPrice:true,maxHitPoints:50}),
  ...Object.fromEntries(SPEAR_ITEMS_272.map(item=>[item,gear(spearBaseValue272(item),spearMaxHitPoints272(item),false,true)])),
  ...Object.fromEntries(LONGSWORD_ITEMS_270.map(item=>[item,gear(longswordBaseValue270(item),longswordMaxHitPoints270(item),false,true)])),
  ...Object.fromEntries(MACE_ITEMS_269.map(item=>[item,gear(maceBaseValue269(item),maceMaxHitPoints269(item),false,true)])),
  // Both Core products carry Clothing and Armor trade tags. Preserve actual
  // quality/HP pricing; no merchant stock or generated material is invented.
  ...Object.fromEntries(SMITHING_APPAREL_ITEMS267.map(item=>[item,gear(smithingApparelBaseValue267(item),SMITHING_APPAREL_DEFINITIONS267[item].hitPoints,true)])),
  // New ordinary clothing is priced in every value reader. tradeRefusal owns
  // the narrower local standard-visitor permission; other channels stay shut.
  ...Object.fromEntries(APPAREL_TRADE_ITEMS_279.filter(isNewApparelTrade279).map(item=>{
    const p=APPAREL_TRADE_279[item];
    return [item,gear(p.baseMarketValue,p.maxHitPoints,true,false,{playerCanBuy:p.playerCanBuy})];
  })),
  hops:value(1.3,false),wort:value(2.5,false,{playerCanBuy:false,playerCanSell:false}),beer:value(12,false,{maxHitPoints:50}),
  pemmican:value(1.4),
  jade:value(5,false,{playerCanBuy:false,playerCanSell:false}),
  silver:value(1,true),wood:value(1.2),steel:value(1.9),gold:value(10),uranium:value(6),plasteel:value(9),cloth:value(1.5,true),'light-leather':value(1.9),'muffalo-wool':value(2.7),component:value(32,true),'advanced-component':value(200),
  'herbal-medicine':value(10),medicine:value(18,true),'glitterworld-medicine':value(50),
  chemfuel:value(2.3,false,{playerCanBuy:false,playerCanSell:false}),neutroamine:value(6),
  hay:value(.6,false,{playerCanBuy:false,playerCanSell:false}),kibble:value(1.1,false,{playerCanBuy:false,playerCanSell:false}),
  berries:value(1.2),rice:value(1.1),potato:value(1.1),corn:value(1.1),'hare-meat':value(2),'red-fox-meat':value(2),foxfur:value(3.5),
  'nutrient-paste-meal':value(10,false,{playerCanSell:false}),
  'simple-meal':value(15,false,{playerCanSell:false}),'fine-meal':value(20,false,{playerCanSell:false}),'vegetarian-fine-meal':value(20,false,{playerCanSell:false}),'carnivore-fine-meal':value(20,false,{playerCanSell:false}),'lavish-meal':value(40,false,{playerCanSell:false}),'vegetarian-lavish-meal':value(40,false,{playerCanSell:false}),'carnivore-lavish-meal':value(40,false,{playerCanSell:false}),'survival-meal':value(24,true),
  'granite-blocks':value(.9,false,{playerCanSell:false}),'limestone-blocks':value(.9,false,{playerCanSell:false}),
  'marble-blocks':value(.9,false,{playerCanSell:false}),'sandstone-blocks':value(.9,false,{playerCanSell:false}),'slate-blocks':value(.9,false,{playerCanSell:false}),
  'cloth-tribalwear':gear(96.48,100,true,false,{playerCanBuy:false}),'cloth-shirt':gear(77.22,100,true),'flak-vest':gear(223.4,200,false),'flak-helmet':gear(258.8,120,false),'recon-helmet':gear(526.7,120,false),'recon-armor':gear(1542,280,false),
  revolver:gear(135.4,100,true,true),'bolt-action-rifle':gear(253.2,100,true,true),'plasteel-knife':gear(284.256,280,false,true),
  // Fixed materials + Core work value: 75*1.9 + 8*32 + 30000*.0036.
  'emp-launcher':gear(506.5,100,true,true),
  // Schema 316: Core Bow_Short, 30 wood x 1.2 + 2400 x 0.0036.
  'short-bow':gear(SHORT_BOW_BASE_VALUE_316,100,true,true),
});
export const tradeCatalogueEntry=(item:ItemId):TradeCatalogueEntry|undefined=>TRADE_CATALOGUE[item];
import {MACE_ITEMS_269,maceBaseValue269,maceMaxHitPoints269} from './mace-content-269.ts';
