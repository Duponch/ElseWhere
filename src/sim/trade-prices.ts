import {isNovelBook295,NOVEL_MAX_HIT_POINTS_295} from './book-state-295.ts';
import {isProstheticItem273} from './prosthetic-content-273.ts';
import {isNewApparelTrade279} from './apparel-trade-279.ts';
import { WEAPON_QUALITIES } from './equipment-rules.ts';
import { ticksUntilRot } from './food-preservation.ts';
import { tradeCatalogueEntry } from './trade-catalogue.ts';
import type { MaterialPile } from './types.ts';

/** Directions are always from the player's point of view. */
export type TradeDirection='buy'|'sell';
export type TradeChannel279='visitor'|'caravan';
const qualityFactors=[.5,.75,1,1.25,1.5,2.5,5] as const;
const qualityGains=[Infinity,Infinity,Infinity,500,1000,2000,3000] as const;
/** Unity/financial reference midpoint-to-even; apply once to the net basket. */
export function roundTradeSilver(amount:number):number {
  const lower=Math.floor(amount),part=amount-lower;
  return part===.5?lower+(Math.abs(lower)%2):Math.round(amount);
}
export function tradeHealthFactor(fraction:number):number {
  const hp=Math.max(0,Math.min(1,fraction));
  if(hp<=.5)return hp*.2;
  if(hp<=.6)return .1+(hp-.5)*4;
  if(hp<.9)return .5+(hp-.6)*(5/3);
  return 1;
}
/** Core StatPart_WornByCorpse (schema 327): apparel taken from a corpse is
 * worth a tenth, after quality and before the hit-point factor. */
export const TAINTED_VALUE_FACTOR_327=.1;
const tainted327=(pile:Pick<MaterialPile,'apparel'>,version:number):boolean=>version>=327&&pile.apparel?.corpseWear284===true;
export function pileMarketValue(pile:Pick<MaterialPile,'item'|'weapon'|'apparel'|'damage'|'book'>,version:number=0):number|undefined {
  const entry=tradeCatalogueEntry(pile.item);if(!entry)return undefined;
  let value=entry.baseMarketValue;
  if(!entry.hasQuality&&tainted327(pile,version))value*=TAINTED_VALUE_FACTOR_327;
  if(entry.hasQuality){
    if(pile.item==='novel'&&(!isNovelBook295(pile.book)||pile.weapon!==undefined||pile.apparel!==undefined||pile.damage!==undefined&&(!Number.isInteger(pile.damage)||pile.damage<0||pile.damage>=NOVEL_MAX_HIT_POINTS_295)))return undefined;
    const state=pile.weapon??pile.apparel,quality=pile.item==='novel'?pile.book?.quality:state?.quality;
    const hitPoints=pile.item==='novel'?NOVEL_MAX_HIT_POINTS_295-(pile.damage??0):state?.hitPoints;
    if(quality===undefined||hitPoints===undefined||!Number.isFinite(hitPoints))return undefined;
    const index=WEAPON_QUALITIES.indexOf(quality);if(index<0)return undefined;
    value+=Math.min(value*(qualityFactors[index]!-1),qualityGains[index]!);
    if(tainted327(pile,version))value*=TAINTED_VALUE_FACTOR_327;
    if(entry.healthAffectsPrice)value*=tradeHealthFactor(hitPoints/entry.maxHitPoints);
  }
  if(pile.item==='ai-core'){const damage=pile.damage??0;if(!Number.isInteger(damage)||damage<0||damage>=100)return undefined;if(entry.healthAffectsPrice)value*=tradeHealthFactor((100-damage)/100);}
  if(isProstheticItem273(pile.item)&&entry.healthAffectsPrice)value*=tradeHealthFactor((entry.maxHitPoints-(pile.damage??0))/entry.maxHitPoints);
  return value>200?roundTradeSilver(value/5)*5:value;
}
/** Pricing is separate from permission, source reachability and the atomic transfer.
 * The caller must also check tradeRefusal and current physical availability. */
export function tradeUnitPrice(pile:MaterialPile,direction:TradeDirection,improvement:number,priceLoss=0):number|undefined {
  if(!Number.isFinite(improvement)||improvement<0||improvement>.395)return undefined;
  return priceWithImprovement(pile,direction,improvement,priceLoss);
}
/** Settlement's two percentage points follow the Pawn stat clamp. This does
 * not broaden the historical visitor's admissible improvement range. */
export function settlementTradeUnitPrice(pile:Pick<MaterialPile,'item'|'weapon'|'apparel'|'damage'|'book'>,direction:TradeDirection,negotiatorImprovement:number,priceLoss=0):number|undefined {
  if(!Number.isFinite(negotiatorImprovement)||negotiatorImprovement<0||negotiatorImprovement>.395)return undefined;
  return priceWithImprovement(pile,direction,negotiatorImprovement+.02,priceLoss);
}
function priceWithImprovement(pile:Pick<MaterialPile,'item'|'weapon'|'apparel'|'damage'|'book'>,direction:TradeDirection,improvement:number,priceLoss:number):number|undefined {
  const marketValue=pileMarketValue(pile),entry=tradeCatalogueEntry(pile.item);
  if(marketValue===undefined||!entry||!Number.isFinite(priceLoss)||priceLoss<0||priceLoss>1)return undefined;
  if(pile.item==='silver')return 1;
  const roundUnit=(n:number)=>n>99.5?roundTradeSilver(n):n;
  const buy=roundUnit(Math.max(.5,marketValue*1.4*(1+priceLoss)*(1-improvement)));
  if(direction==='buy')return buy;
  return Math.min(buy,roundUnit(Math.max(.01,marketValue*.6*entry.sellPriceFactor*(1-priceLoss)*(1+improvement))));
}
/** Only authored sculptures have the Art tag in the delivered visitor profile.
 * The room value routine already applies stuff, work, quality, HP and Core's
 * market-value rounding. Selling then uses the sculpture's 1.10 factor. */
export function sculptureTradeUnitPrice(value:number,direction:TradeDirection,improvement:number):number|undefined {
  if(!Number.isFinite(improvement)||improvement<0||improvement>.395)return undefined;
  if(!Number.isFinite(value)||value<=0)return undefined;
  const roundUnit=(n:number)=>n>99.5?roundTradeSilver(n):n;
  const buy=roundUnit(Math.max(.5,value*1.4*(1-improvement)));
  return direction==='buy'?buy:Math.min(buy,roundUnit(Math.max(.01,value*.6*1.1*(1+improvement))));
}
/** The ordinary visitor and the V123 exotic visitor use their own finite stock;
 * category permission is checked against the merchant present at contact. */
/** Core visitor and caravan traders buy any item worth at least 15 silver a
 * unit (StockGenerator_BuyExpensiveSimple) and drugs (schema 327). */
export const VISITOR_EXPENSIVE_BUYS_327:ReadonlySet<string>=new Set(['gold','advanced-component','ai-core','novel','prosthetic-arm','prosthetic-leg','beer']);
export function tradeRefusal(pile:MaterialPile,direction:TradeDirection,tick:number,merchantKind?:'exotic',channel:TradeChannel279='visitor',version:number=0):string|undefined {
  const entry=tradeCatalogueEntry(pile.item);
  if(!entry)return 'Cet objet n’a pas de profil commercial disponible.';
  if(pile.quantity<=0||ticksUntilRot(pile,tick)<=0)return 'Cet objet n’est plus disponible.';
  if(direction==='sell'&&!entry.playerCanSell)return 'Cet objet ne peut pas être revendu.';
  // Core TradeUtility.PlayerSellableNow: no trader buys apparel worn by a corpse.
  if(direction==='sell'&&tainted327(pile,version))return 'Personne n’achète un vêtement porté par un mort.';
  if(direction==='buy'&&!entry.playerCanBuy)return 'Cet objet n’est pas vendu par les marchands.';
  if(isNewApparelTrade279(pile.item)&&(merchantKind==='exotic'||channel!=='visitor'))return 'Ces vêtements se négocient avec un visiteur ordinaire présent sur la carte.';
  if(!entry.visitorHandles&&!(merchantKind==='exotic'&&['gold','plasteel','uranium','advanced-component','neutroamine','recon-armor'].includes(pile.item))&&!(version>=327&&direction==='sell'&&VISITOR_EXPENSIVE_BUYS_327.has(pile.item)))return 'Ce visiteur ne commerce pas cette catégorie d’objets.';
  if(pileMarketValue(pile)===undefined)return 'L’état de cet objet ne permet pas de calculer son prix.';
  return undefined;
}
