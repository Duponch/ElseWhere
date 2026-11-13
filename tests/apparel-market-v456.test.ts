import {describe,expect,test} from 'vitest';
import {APPAREL_TRADE_ITEMS_279,APPAREL_TRADE_279,APPAREL_TRADE_MATERIAL_VALUES_279,isOrdinaryApparel279,isNewApparelTrade279,type OrdinaryApparelItem279} from '../src/sim/apparel-trade-279.ts';
import {APPAREL,LEGACY_APPAREL_MATERIALS308 as APPAREL_MATERIALS,type ApparelMaterial,type ApparelFamily} from '../src/sim/apparel-definitions.ts';
import {isTextileApparelItem308,TEXTILE_APPAREL_ITEMS308} from '../src/sim/textile-apparel-308.ts';
// V456 covers the 37 historical products; schema 308 adds 78 more (tests/textile-apparel-308.test.ts).
const V456_ITEMS=APPAREL_TRADE_ITEMS_279.filter(item=>!isTextileApparelItem308(item));
import {PRODUCTION_RECIPES,tailoringMaterialAllowed} from '../src/sim/production-recipes.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {pileMarketValue,tradeRefusal,tradeUnitPrice} from '../src/sim/trade-prices.ts';
import {colonyWealth} from '../src/sim/colony-wealth.ts';
import type {MaterialPile,Pawn,Structure,World} from '../src/sim/types.ts';

const garment=(item:OrdinaryApparelItem279,id=1,owner:MaterialPile['owner']={type:'ground',x:0,z:0}):MaterialPile=>({
 id,kind:'apparel',item,quantity:1,owner,
 apparel:{quality:'normal',hitPoints:APPAREL[item].hitPoints,material:APPAREL[item].material},
});
const itemFor=(family:ApparelFamily,material:ApparelMaterial):OrdinaryApparelItem279=>`${material}-${family}` as OrdinaryApparelItem279;
/** Pure valuation-reader views, not saved worlds or replacement owner proofs.
 * Physical transactions and complete transport admission are covered separately. */
const readerWorld=(parts:Partial<World>={}):World=>({schemaVersion:279,tick:0,pawns:[],piles:[],packed:[],structures:[],tiles:[],...parts} as World);
const person=(id:number,faction:Pawn['faction']='colony'):Pawn=>({id,faction,state:'idle',x:0,z:0} as Pawn);

describe('V456 ordinary apparel catalogue, value and channel boundaries',()=>{
 test('the immutable catalogue contains exactly the37 existing ordinary products and no armor or invented material',()=>{
  expect(V456_ITEMS).toHaveLength(37);
  expect(APPAREL_TRADE_ITEMS_279).toHaveLength(37+TEXTILE_APPAREL_ITEMS308.length);
  expect(new Set(V456_ITEMS).size).toBe(37);
  expect(V456_ITEMS.filter(isNewApparelTrade279)).toHaveLength(35);
  expect(Object.isFrozen(APPAREL_TRADE_ITEMS_279)&&Object.isFrozen(APPAREL_TRADE_279)&&Object.isFrozen(APPAREL_TRADE_MATERIAL_VALUES_279)).toBe(true);
  for(const item of V456_ITEMS){expect(isOrdinaryApparel279(item)).toBe(true);expect(Object.isFrozen(APPAREL_TRADE_279[item])).toBe(true);}
  for(const item of ['cloth-tuque','muffalo-wool-tuque','plainleather-shirt'])expect(isOrdinaryApparel279(item)).toBe(true);
  for(const item of ['light-leather-tuque','plainleather-tuque','steel-shirt','flak-vest','recon-armor','steel-plate-armor','unfinished-shirt','toString','__proto__',null,{},[]])expect(isOrdinaryApparel279(item)).toBe(false);
 });

 // Primary Core costs/work/PV and the independently calculated decimal table.
 // Concordance with actual production definitions catches local recipe drift.
 test.each([
  {family:'tribalwear',units:60,work:1800,bases:[96.48,120.48,132.48,144.48,144.48,168.48,216.48],hp:[100,100,130,130,130,100,100]},
  {family:'shirt',units:45,work:2700,bases:[77.22,95.22,104.22,113.22,113.22,131.22,167.22],hp:[100,100,130,130,130,100,100]},
  {family:'pants',units:40,work:1600,bases:[65.76,81.76,89.76,97.76,97.76,113.76,145.76],hp:[100,100,130,130,130,100,100]},
  {family:'duster',units:80,work:10000,bases:[156,188,204,220,220,252,316],hp:[200,200,260,260,260,200,200]},
  {family:'parka',units:80,work:8000,bases:[148.8,180.8,196.8,212.8,212.8,244.8,308.8],hp:[180,180,234,234,234,180,180]},
  {family:'tuque',units:20,work:1200,bases:[34.32,58.32],hp:[80,80]},
 ] as const)('$family keeps native derived bases, actual maxHP and production cost/work',row=>{
  const materials:readonly ApparelMaterial[]=row.family==='tuque'?['cloth','muffalo-wool']:APPAREL_MATERIALS;
  expect(PRODUCTION_RECIPES[row.family].units).toBe(row.units);
  expect(PRODUCTION_RECIPES[row.family].workTicks*10).toBe(row.work);
  for(const [i,material] of materials.entries()){
   const item=itemFor(row.family,material),entry=APPAREL_TRADE_279[item];
   expect(tailoringMaterialAllowed(row.family,material)).toBe(true);
   expect(entry).toMatchObject({family:row.family,material,maxHitPoints:row.hp[i],playerCanBuy:row.family!=='tribalwear'});
   expect(entry.baseMarketValue).toBeCloseTo(row.bases[i]!,10);
   expect(tradeCatalogueEntry(item)).toMatchObject({baseMarketValue:entry.baseMarketValue,maxHitPoints:row.hp[i],hasQuality:true,healthAffectsPrice:true,sellPriceFactor:1,playerCanSell:true,playerCanBuy:row.family!=='tribalwear'});
  }
 });

 test('condition follows the native nonlinear50/60/90percent curve before market rounding',()=>{
  const p=garment('foxfur-duster');
  for(const [hp,value] of [[1,.316],[100,31.6],[120,158],[180,315],[200,315]]){
   p.apparel!.hitPoints=hp!;expect(pileMarketValue(p)).toBeCloseTo(value!,10);
  }
 });

 test('all seven qualities price the garment, then condition, then the market multiple of5',()=>{
  const p=garment('foxfur-shirt');
  for(const [quality,value] of [['awful',83.61],['poor',125.415],['normal',167.22],['good',210],['excellent',250],['masterwork',420],['legendary',835]] as const){
   p.apparel!.quality=quality;expect(pileMarketValue(p)).toBeCloseTo(value,10);
  }
  const duster=garment('foxfur-duster');duster.apparel!.quality='good';duster.apparel!.hitPoints=100;
  //316*1.25*.1=39.5, not rounded intact market value times a linear HP ratio.
  expect(pileMarketValue(duster)).toBeCloseTo(39.5,10);
 });

 test('the HP denominator belongs to each actual leather variant, without rounding intact value first',()=>{
  for(const [item,hp,value] of [['plainleather-shirt',65,10.422],['plainleather-duster',130,20.4],['camelhide-parka',117,21.28],['bluefur-parka',117,21.28]] as const){
   const p=garment(item);p.apparel!.hitPoints=hp;expect(pileMarketValue(p)).toBeCloseTo(value,10);
  }
 });

 test('buy/sell use the shared negotiation, condition and unit rounding, without weapon or sculpture sale factors',()=>{
  const p=garment('foxfur-duster');
  expect(pileMarketValue(p)).toBe(315);
  expect(tradeUnitPrice(p,'buy',0)).toBe(441);expect(tradeUnitPrice(p,'sell',0)).toBe(189);
  expect(tradeUnitPrice(p,'buy',.15)).toBe(375);expect(tradeUnitPrice(p,'sell',.15)).toBe(217);
  p.apparel!.quality='good';p.apparel!.hitPoints=100;
  expect(tradeUnitPrice(p,'buy',0)).toBeCloseTo(55.3,10);expect(tradeUnitPrice(p,'sell',0)).toBeCloseTo(23.7,10);
  const shirt=garment('plainleather-shirt');
  expect(tradeUnitPrice(shirt,'buy',0)).toBe(146);expect(tradeUnitPrice(shirt,'sell',0)).toBeCloseTo(62.532,10);
 });

 test('the two historical cloth values and permissions remain exact in visitor, exotic and caravan channels',()=>{
  for(const [item,value] of [['cloth-shirt',77.22],['cloth-tribalwear',96.48]] as const){
   const p=garment(item);expect(APPAREL_TRADE_279[item].baseMarketValue).toBe(value);expect(tradeCatalogueEntry(item)?.baseMarketValue).toBe(value);expect(pileMarketValue(p)).toBe(value);
   for(const channel of ['visitor','caravan'] as const)for(const merchant of [undefined,'exotic'] as const){
    expect(tradeRefusal(p,'sell',0,merchant,channel)).toBeUndefined();
    expect(tradeRefusal(p,'buy',0,merchant,channel)===undefined).toBe(item==='cloth-shirt');
   }
  }
  const shirt=garment('cloth-shirt');
  expect(tradeUnitPrice(shirt,'buy',0)).toBe(108);expect(tradeUnitPrice(shirt,'sell',0)).toBeCloseTo(46.332,10);
  shirt.apparel!.hitPoints=50;expect(pileMarketValue(shirt)).toBeCloseTo(7.722,10);expect(tradeUnitPrice(shirt,'sell',0)).toBeCloseTo(4.6332,10);
 });

 test('the35 new permissions apply only to the standard local visitor while every value remains known',()=>{
  for(const item of V456_ITEMS.filter(isNewApparelTrade279)){
   const p=garment(item);
   expect(pileMarketValue(p)).toBeGreaterThan(0);
   expect(tradeRefusal(p,'sell',0)).toBeUndefined();
   expect(tradeRefusal(p,'sell',0,'exotic')).toBeDefined();
   expect(tradeRefusal(p,'sell',0,undefined,'caravan')).toBeDefined();
   expect(tradeRefusal(p,'sell',0,'exotic','caravan')).toBeDefined();
   expect(tradeRefusal(p,'buy',0)===undefined).toBe(APPAREL_TRADE_279[item].family!=='tribalwear');
   expect(tradeRefusal(p,'buy',0,'exotic')).toBeDefined();
   expect(tradeRefusal(p,'buy',0,undefined,'caravan')).toBeDefined();
  }
 });

 test('all seven tribal garments are sell-only; armor and raw textile permissions are not broadened',()=>{
  for(const material of APPAREL_MATERIALS){
   const p=garment(itemFor('tribalwear',material));expect(tradeRefusal(p,'sell',0)).toBeUndefined();expect(tradeRefusal(p,'buy',0)).toBeDefined();
  }
  for(const item of ['light-leather','muffalo-wool','foxfur','plainleather','bluefur','camelhide'] as const){
   const p={id:1,kind:'textile',item,quantity:1,owner:{type:'ground',x:0,z:0}} as MaterialPile;
   expect(tradeRefusal(p,'sell',0)).toBeDefined();
  }
  expect(isOrdinaryApparel279('flak-vest')).toBe(false);
  expect(tradeCatalogueEntry('flak-vest')?.visitorHandles).toBe(false);
  expect(tradeCatalogueEntry('cloth')?.visitorHandles).toBe(true);
 });
});

describe('V456 material wealth, existing owners and unfinished inputs',()=>{
 test('all37 finished ordinary garments are known once at their market value, independent of sale permission',()=>{
  const w=readerWorld({piles:V456_ITEMS.map((item,i)=>garment(item,i+1))});
  const before=JSON.stringify(w),value=colonyWealth(w);
  // Independent sum of the native normal/intact table after market rounding.
  expect(value.items).toBeCloseTo(5673.78,8);expect(value.unpricedPileIds).toEqual([]);expect(value.complete).toBe(true);
  expect(JSON.stringify(w)).toBe(before);
 });

 test('ground, worn, colonial inventory and both installed human holders retain the same value; neutral inventory is excluded',()=>{
  const active=person(1),neutral=person(2,'outlanders'),ordinary=person(3),spatial=person(4);
  const ordinaryItem=garment('muffalo-wool-shirt',14,{type:'apparel',pawnId:ordinary.id});
  const spatialItem=garment('foxfur-pants',15,{type:'inventory',pawnId:spatial.id});
  const old:Structure={id:20,kind:'cryptosleep-casket',x:3,z:3,orientation:0,footprint:'standard',material:'steel',cryptosleep:{revision:1,heldAt:0,human:ordinary,items:[ordinaryItem],packed:[]}};
  const ship:Structure={id:21,kind:'ship-cryptosleep-casket',x:6,z:3,orientation:0,footprint:'standard',material:'steel',shipCryptosleep277:{revision:1,heldAt:0,occupant:{kind:'human',pawn:spatial},items:[spatialItem],packed:[]}};
  const w=readerWorld({pawns:[active,neutral],structures:[old,ship],piles:[
   garment('plainleather-shirt',10),garment('bluefur-parka',11,{type:'apparel',pawnId:active.id}),
   garment('camelhide-pants',12,{type:'inventory',pawnId:active.id}),garment('foxfur-duster',13,{type:'inventory',pawnId:neutral.id}),
  ]});
  const before=JSON.stringify(w),value=colonyWealth(w);
  expect(value.items).toBeCloseTo(693.96,8);expect(value.unpricedPileIds).toEqual([]);
  expect(value.unpricedPawnIds).toEqual([1,3,4]);expect(value.pawnsKnown).toBe(0);expect(value.complete).toBe(false);
  expect(old.cryptosleep!.human).toBe(ordinary);expect(ship.shipCryptosleep277!.occupant).toEqual({kind:'human',pawn:spatial});
  expect(JSON.stringify(w)).toBe(before);
 });

 test('ownership transfer to an actual neutral owner removes apparel value while pricing knowledge remains available',()=>{
  const trader=person(2,'outlanders'),p=garment('foxfur-duster',10),w=readerWorld({pawns:[trader],piles:[p]});
  expect(colonyWealth(w).items).toBe(315);
  // Reader boundary only: the real transaction performs this transfer atomically.
  p.owner={type:'inventory',pawnId:trader.id};
  expect(colonyWealth(w).items).toBe(0);expect(pileMarketValue(p)).toBe(315);expect(colonyWealth(w).unpricedPileIds).toEqual([]);
 });

 test('unfinished work keeps only incorporated material value for all seven existing materials, including the three previously missing leathers',()=>{
  const prices=[1.5,1.9,2.1,2.3,2.3,2.7,3.5];
  for(const [i,material] of APPAREL_MATERIALS.entries()){
   const work:MaterialPile={id:1,item:'unfinished-shirt',kind:'unfinished',quantity:1,owner:{type:'ground',x:0,z:0},unfinished:{recipe:'shirt',authorId:2,progress:0,material,units:45,parts:[20,25]}};
   const w=readerWorld({piles:[work]});expect(colonyWealth(w).items).toBeCloseTo(45*prices[i]!,10);expect(colonyWealth(w).unpricedPileIds).toEqual([]);
   work.unfinished!.progress=269;
   expect(colonyWealth(w).items).toBeCloseTo(45*prices[i]!,10);
   expect(colonyWealth(w).items).toBeLessThan(APPAREL_TRADE_279[itemFor('shirt',material)].baseMarketValue);
  }
 });
});
