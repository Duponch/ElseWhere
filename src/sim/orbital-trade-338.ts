import {isOrdinaryApparel279} from './apparel-trade-279.ts';
import {isSmithingApparel267} from './smithing-apparel-267.ts';
import {ticksUntilRot} from './food-preservation.ts';
import {tradeCatalogueEntry} from './trade-catalogue.ts';
import {ALL_CLOTHING,BASIC_CLOTHING} from './trader-caravans-332.ts';
import {integer,random,select,traderQuality,visitorClothingStuff314,visitorClothingFamily,VISITOR_CLOTHING_POOL} from './trade-stock.ts';
import type {WeaponQuality} from './equipment-rules.ts';
import type {ItemId} from './items.ts';
import type {OrbitalKind} from './orbital-state.ts';
import type {MaterialPile} from './types.ts';

/** Schema 338: what the two represented orbital traders trade, from Core
 * TraderKinds_Orbital_Misc.xml (Orbital_BulkGoods, Orbital_Exotic) and the
 * HandlesThingDef of each stock generator (TraderKindDef.WillTrade), applied
 * to the items this game represents. Read from the Core 1.6 Defs (thing
 * categories, trade tags, tradeability, smallVolume) and the decompiled
 * StockGenerator_* classes; facts only, nothing copied.
 *
 * Bulk goods: its SingleDefs (silver, components, steel, wood, plasteel,
 * cloth, industrial medicine, gold, neutroamine, chemfuel, beer, novel), the
 * categories ResourcesRaw without silver (uranium, and hops through
 * PlantMatter), Textiles (leathers, wools), FoodRaw, FoodMeals and Drugs,
 * the MultiDef kibble/chocolate/pemmican and the BasicClothing/Clothing
 * tags (every ordinary garment, plate armour and simple helmet carry the
 * Clothing tag). Exotic goods: its SingleDefs (silver, components, gold,
 * plasteel, glitterworld medicine, neutroamine, novel), Drugs (beer), the
 * tags TechHediff (prosthetic arm and leg) and ExoticMisc (AI persona core).
 * Both: StockGenerator_BuyExpensiveSimple, items (not apparel, weapon,
 * medicine or drug) worth at least 15 silver per unit of volume, which the
 * player can only sell: component (32), advanced component (200), gold
 * (10, small volume), AI core, novel, prosthetic arm and leg, survival meal
 * (24). Weapons and armour without the Clothing tag are refused by both. */
export const ORBITAL_TRADE_SCHEMA_338=338;
const set=(items:readonly ItemId[]):ReadonlySet<ItemId>=>Object.freeze(new Set(items)) as ReadonlySet<ItemId>;
const BULK_338=set(['silver','component','advanced-component','steel','wood','plasteel','cloth','medicine','gold','neutroamine','chemfuel','beer','novel',
 'uranium','hops','light-leather','muffalo-wool','foxfur','berries','rice','potato','corn','hare-meat','red-fox-meat',
 'survival-meal','simple-meal','fine-meal','vegetarian-fine-meal','carnivore-fine-meal','lavish-meal','vegetarian-lavish-meal','carnivore-lavish-meal','nutrient-paste-meal',
 'kibble','pemmican',
 // Schema 358: Core DevilstrandCloth is in the Textiles category this trader handles.
 'devilstrand']);
const EXOTIC_338=set(['silver','component','advanced-component','gold','plasteel','glitterworld-medicine','neutroamine','beer','novel','prosthetic-arm','prosthetic-leg','ai-core']);
const EXPENSIVE_SIMPLE_338=set(['component','advanced-component','gold','ai-core','novel','prosthetic-arm','prosthetic-leg','survival-meal']);
/** Core tradeability All; the shared catalogue keeps them closed elsewhere. */
const OPENED_338=set(['chemfuel','kibble']);
const clothing338=(item:ItemId):boolean=>isOrdinaryApparel279(item)||isSmithingApparel267(item);
/** Trader-side handling, both directions unless `side` is the player's sale
 * of a BuyExpensiveSimple item. */
export function orbitalWillTrade338(kind:OrbitalKind,item:ItemId,side:'buy'|'sell'):boolean {
 if(kind==='bulk'&&(BULK_338.has(item)||clothing338(item))||kind==='exotic'&&EXOTIC_338.has(item))return true;
 return side==='sell'&&EXPENSIVE_SIMPLE_338.has(item);
}
/** A pile a ship of this kind may hold: its stock or what it bought. */
export const orbitalMayHold338=(kind:OrbitalKind,item:ItemId):boolean=>orbitalWillTrade338(kind,item,'sell');
/** Orbital_BulkGoods StockGenerator_MarketValue BasicClothing (7~15) then
 * Clothing (3~5): the schema 332 caravan draw per garment (def by value
 * weight, stuff, quality). Unrepresented defs and stuffs keep their weight
 * and yield nothing. Same xorshift stream as the rest of the ship's stock. */
export function orbitalClothing338(state:{rng:number},version=338):{item:ItemId;quality:WeaponQuality}[] {
 const out:{item:ItemId;quality:WeaponQuality}[]=[];
 for(const [indices,min,max] of [[BASIC_CLOTHING,7,15],[ALL_CLOTHING,3,5]] as const){
  const pool=indices.map(i=>VISITOR_CLOTHING_POOL[i]!),count=integer(state,min,max);
  for(let i=0;i<count;i++){
   const candidate=select(state,pool),roll=random(state),quality=traderQuality(state),family=visitorClothingFamily(VISITOR_CLOTHING_POOL.indexOf(candidate),version);
   const material=family?visitorClothingStuff314(roll,family==='tuque',version):undefined;
   if(family&&material)out.push({item:`${material}-${family}` as ItemId,quality});
  }
 }
 return out;
}
/** The 24 Core TechHediff things a trader can sell (no DLC), in Defs order:
 * three archotech parts, the bionic eye, arm, leg, spine, heart and stomach,
 * the death acidifier, the bionic ear, tongue and jaw, four natural organs
 * (heart, lung, kidney, liver), then the simple prosthetic leg, arm and
 * heart, cochlear implant, power claw, joywire and painstopper. Only the
 * two industrial prostheses are represented. */
const TECH_HEDIFF_338:readonly (ItemId|null)[]=Object.freeze([...Array<null>(17).fill(null),'prosthetic-leg','prosthetic-arm',null,null,null,null,null]);
/** Orbital_Exotic StockGenerator_Tag TechHediff: 3~5 distinct defs, equal
 * weight, one unit each. */
export function orbitalTechHediff338(state:{rng:number}):ItemId[] {
 const remaining=TECH_HEDIFF_338.map((_,i)=>i),out:ItemId[]=[];
 for(let k=integer(state,3,5);k>0&&remaining.length;k--){
  const index=remaining.splice(Math.min(remaining.length-1,Math.floor(random(state)*remaining.length)),1)[0]!,item=TECH_HEDIFF_338[index];
  if(item)out.push(item);
 }
 return out;
}
export function orbitalItemRefusal338(pile:MaterialPile,side:'buy'|'sell',tick:number,kind:OrbitalKind):string|undefined {
 const e=tradeCatalogueEntry(pile.item);
 if(!e||pile.quantity<=0||ticksUntilRot(pile,tick)<=0)return 'Objet indisponible ou sans profil commercial.';
 if(pile.kind==='weapon'||pile.unfinished||pile.corpse||pile.humanCorpse||pile.mechCorpse||pile.kind==='apparel'&&!clothing338(pile.item))return 'Ce profil orbital ne commerce pas cet objet.';
 const opened=OPENED_338.has(pile.item);
 if(side==='sell'&&!e.playerCanSell&&!opened||side==='buy'&&!e.playerCanBuy&&!opened)return 'Cet objet ne peut pas être échangé dans ce sens.';
 // Core TradeUtility.PlayerSellableNow: apparel worn by a corpse.
 if(side==='sell'&&pile.apparel?.corpseWear284===true)return 'Personne n’achète un vêtement porté par un mort.';
 if(!orbitalWillTrade338(kind,pile.item,side))return 'Ce profil orbital ne commerce pas cette catégorie.';
}
