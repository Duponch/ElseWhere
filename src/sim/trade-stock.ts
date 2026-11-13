import {isSchema284OrLater} from './schema-compatibility-257.ts';
import { freshRot } from './food-preservation.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { WEAPON_QUALITIES, type WeaponQuality } from './equipment-rules.ts';
import { tradeCatalogueEntry } from './trade-catalogue.ts';
import {APPAREL} from './apparel-definitions.ts';
import {isSchema279OrLater} from './schema-compatibility-257.ts';
import { SCHEMA_VERSION,type MaterialPile } from './types.ts';

interface StockCandidate {readonly value:number;readonly item?:ItemId}
/** All 25 Core-only WeaponRanged candidates participate. Unsupported selections
 * stay absent; their weights are never reassigned to the two delivered guns. */
export const VISITOR_RANGED_POOL:readonly StockCandidate[]=Object.freeze([
  {value:135.4,item:'revolver'},{value:139},{value:220},{value:340},{value:380},{value:505},
  {value:255,item:'bolt-action-rifle'},{value:255},{value:405},{value:355},{value:425},{value:480},
  {value:530},{value:1160},{value:1000},{value:1000},{value:265},{value:245},{value:315},
  {value:44.64},{value:109.2},{value:66},{value:104.4},{value:1010},{value:1355},
]);
/** Index of Core Bow_Short (value 44.64) in the ranged pool, sold from 316. */
export const VISITOR_SHORT_BOW_INDEX316=19;
/** Schema 322: pool entries 5 (Gun_EmpLauncher) and 7 (Gun_PumpShotgun),
 * in Core RangedIndustrial order, are sold (same random draws). */
export const VISITOR_RANGED_ITEMS322:Readonly<Partial<Record<number,ItemId>>>=Object.freeze({5:'emp-launcher',7:'pump-shotgun'});
/** The 22 Core Clothing definitions use abstract (no stuff) base values. The
 * tribal garment is Sellable-only; the flak vest has no Clothing trade tag. */
export const VISITOR_CLOTHING_POOL:readonly StockCandidate[]=Object.freeze([
  {value:56.48},{value:46.48},{value:121.6},{value:44.32},{value:60.8},{value:45.04},
  {value:91.52},{value:250},{value:121.6},{value:22.88},{value:174.96},{value:151.96},
  {value:188.8},{value:85.76},{value:85.76},{value:99.72,item:'cloth-shirt'},
  {value:196},{value:165.2},{value:475},{value:225},{value:290},{value:178},
]);
/** Soft materials allowed for the shirt: cloth 1.4 of 3.875 commonality.
 * Other textiles/leathers remain omitted rather than silently turned into cloth. */
export const VISITOR_SHIRT_CLOTH_CHANCE=1.4/3.875;
/** Schema 314: the Core clothing defs of the pool that this game now
 * represents (by pool index), all made of Fabric or Leathery stuff, the tuque
 * of Fabric only. */
export const VISITOR_CLOTHING_FAMILIES314:Readonly<Record<number,'tuque'|'parka'|'pants'|'tshirt'|'shirt'|'duster'|'jacket'>>=Object.freeze({3:'tuque',12:'parka',13:'pants',14:'tshirt',15:'shirt',16:'duster',17:'jacket'});
/** Core stuff commonality of every Fabric and Leathery stuff, cloth first so
 * that a roll which gave a cloth shirt before 314 still does. A material this
 * game does not represent (null) keeps its share and yields no garment. */
const CLOTHING_STUFF314:readonly (readonly [string|null,number,boolean])[]=Object.freeze([
  ['cloth',1.4,true],[null,.15,true],[null,.2,true],[null,.1,true],[null,.24,true],
  ['alpaca-wool',.12,true],['megasloth-wool',.12,true],['muffalo-wool',.12,true],['bison-wool',.12,true],
  ['plainleather',.2,false],['dog-leather',.075,false],['wolf-leather',.075,false],['panthera-fur',.075,false],['camelhide',.05,false],
  ['bluefur',.025,false],['bear-leather',.05,false],['guinea-pig-fur',.025,false],[null,.0025,false],['pig-leather',.05,false],
  ['light-leather',.25,false],['bird-leather',.1,false],['chinchilla-fur',.025,false],['foxfur',.075,false],['lizard-leather',.075,false],
  ['elephant-leather',.025,false],['heavy-fur',.025,false],['rhinoceros-leather',.025,false],[null,.0025,false],[null,.075,false],
] as const);
/** The stuff of a bought-in garment, from one roll in [0,1), by Core commonality. */
export function visitorClothingStuff314(roll:number,fabricOnly:boolean):string|undefined {
  const rows=CLOTHING_STUFF314.filter(r=>!fabricOnly||r[2]);
  let ticket=roll*rows.reduce((n,r)=>n+r[1],0);
  for(const [material,weight] of rows){ticket-=weight;if(ticket<0)return material??undefined;}
  return undefined;
}
export function visitorSelectionWeight(value:number):number {
  if(value<=500)return 1-value/1000;
  if(value<=1500)return .5-(value-500)*.0003;
  if(value<=5000)return .2-(value-1500)/35000;
  return .1;
}
function random(state:{rng:number}):number {
  let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng/4294967296;
}
function integer(state:{rng:number},min:number,max:number):number{return min+Math.floor(random(state)*(max-min+1));}
function select(state:{rng:number},pool:readonly StockCandidate[]):StockCandidate {
  let ticket=random(state)*pool.reduce((sum,p)=>sum+visitorSelectionWeight(p.value),0);
  for(const candidate of pool){ticket-=visitorSelectionWeight(candidate.value);if(ticket<0)return candidate;}
  return pool[pool.length-1]!;
}
function traderQuality(state:{rng:number}):WeaponQuality {
  const gaussian=Math.sqrt(-2*Math.log(Math.max(1/4294967296,random(state))))*Math.sin(2*Math.PI*random(state));
  return WEAPON_QUALITIES[Math.max(2,Math.min(5,Math.floor(2.5+gaussian)))]!;
}
export interface VisitorStockPlan {piles:MaterialPile[];nextId:number;rng:number}
/** Pure pre-plan. Callers commit its identities and PRNG only after a real entry
 * is available. Personal food is produced separately and is never sale stock.
 * This private generator reproduces distributions, not Unity's random sequence. */
export function generateVisitorStock(seed:number,pawnId:number,nextId:number,tick:number,version:number=SCHEMA_VERSION):VisitorStockPlan {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isSafeInteger(pawnId)||pawnId<=0||!Number.isSafeInteger(nextId)||nextId<=0||!Number.isSafeInteger(tick)||tick<0)throw new RangeError('Invalid visitor stock planning input.');
  const state={rng:seed||1},piles:MaterialPile[]=[];
  const add=(item:ItemId,quantity:number,quality?:WeaponQuality)=>{
    if(quantity<=0)return;
    if(!Number.isSafeInteger(nextId+1))throw new RangeError('Visitor stock identity overflow.');
    const kind=ITEM_DEFINITIONS[item].kind,pile:MaterialPile={id:nextId++,kind,item,quantity,owner:{type:'inventory',pawnId},...freshRot(item,tick)};
    if(quality){const condition={quality,hitPoints:tradeCatalogueEntry(item)!.maxHitPoints};if(kind==='weapon')pile.weapon=condition;else pile.apparel={...condition,...isSchema279OrLater(version)?{material:APPAREL[item as keyof typeof APPAREL].material}:{},...isSchema284OrLater(version)?{corpseWear284:false}:{}};}
    piles.push(pile);
  };
  add('silver',integer(state,50,250));
  add('component',integer(state,-2,5));
  add('survival-meal',integer(state,3,6));
  add('medicine',integer(state,1,6));
  // Barrels, recreational drugs and DLC techprints have no delivered item here.
  // MultiDef Cloth/Chocolate has no count/price range in this Core definition:
  // it can buy either but creates zero units, so no cloth quantity is invented.
  if(integer(state,0,1)){
    const candidate=select(state,VISITOR_RANGED_POOL),quality=traderQuality(state);
    // Schema 316: pool entry 19 is Core Bow_Short (same random draws).
    const index=VISITOR_RANGED_POOL.indexOf(candidate);
    const item=candidate.item??(version>=316&&index===VISITOR_SHORT_BOW_INDEX316?'short-bow':version>=322?VISITOR_RANGED_ITEMS322[index]:undefined);
    if(item)add(item,1,quality);
  }
  if(integer(state,0,1)){
    const candidate=select(state,VISITOR_CLOTHING_POOL),roll=random(state),cloth=roll<VISITOR_SHIRT_CLOTH_CHANCE,quality=traderQuality(state);
    // Schema 314: every represented family and stuff (same random draws).
    const family=version>=314?VISITOR_CLOTHING_FAMILIES314[VISITOR_CLOTHING_POOL.indexOf(candidate)]:undefined;
    if(family){const material=visitorClothingStuff314(roll,family==='tuque');if(material)add(`${material}-${family}` as ItemId,1,quality);}
    else if(candidate.item&&cloth)add(candidate.item,1,quality);
  }
  return {piles,nextId,rng:state.rng};
}

/** A separate physical exotic inventory. The ranges are per visit, and large
 * amounts are split into real stacks before the arrival is committed. */
export function generateExoticStock(seed:number,pawnId:number,nextId:number,tick:number,version:number=SCHEMA_VERSION):VisitorStockPlan {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isSafeInteger(pawnId)||pawnId<=0||!Number.isSafeInteger(nextId)||nextId<=0||!Number.isSafeInteger(tick)||tick<0)throw new RangeError('Invalid exotic stock planning input.');
  const state={rng:seed||1},piles:MaterialPile[]=[];
  const add=(item:ItemId,quantity:number)=>{
    const definition=ITEM_DEFINITIONS[item];
    while(quantity>0){
      if(!Number.isSafeInteger(nextId+1))throw new RangeError('Exotic stock identity overflow.');
      const part=Math.min(quantity,definition.stackLimit);
      piles.push({id:nextId++,kind:definition.kind,item,quantity:part,owner:{type:'inventory',pawnId},...freshRot(item,tick)});
      quantity-=part;
    }
  };
  add('silver',integer(state,500,2000));
  add('advanced-component',integer(state,1,4));
  add('plasteel',integer(state,50,150));
  add('gold',integer(state,40,80));
  // Core Orbital_Exotic range adapted to the existing physical local trader.
  // Append after the historical draws; older schemas never draw this stock.
  if(version>=206)add('neutroamine',integer(state,100,500));
  // Core Base_Outlander_Standard range; appended to our existing physical
  // exotic profile. Historical arrivals keep their exact draw sequence.
  if(version>=241)add('uranium',integer(state,40,200));
  return {piles,nextId,rng:state.rng};
}
