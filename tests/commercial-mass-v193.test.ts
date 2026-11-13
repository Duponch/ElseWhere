import { expect,test } from 'vitest';
import { APPAREL_FAMILIES,APPAREL_MATERIALS,apparelItemFor } from '../src/sim/apparel-rules.ts';
import { commercialItemMassGrams,commercialMass,commercialPawnMass } from '../src/sim/commercial-mass.ts';
import { settlementTradeUnitPrice,tradeUnitPrice } from '../src/sim/trade-prices.ts';
import { ITEM_DEFINITIONS,type ItemId } from '../src/sim/items.ts';
import type { MaterialPile } from '../src/sim/types.ts';
import { medicalCamp } from './scenarios/health.ts';

test('all 35 textiles and delivered gear have Core mass independent of quality, HP and stuff',()=>{
  const grams={tribalwear:500,shirt:300,pants:500,duster:2000,parka:2000,tshirt:250,jacket:1700};
  for(const material of APPAREL_MATERIALS)for(const family of APPAREL_FAMILIES)
    expect(commercialItemMassGrams(apparelItemFor(family,material))).toBe(grams[family]);
  for(const [item,mass] of Object.entries({'flak-vest':4000,'flak-helmet':1200,'recon-helmet':1000,revolver:1400,'bolt-action-rifle':3500,'plasteel-knife':500,silver:8,'survival-meal':300,medicine:500,component:600}))
    expect(commercialItemMassGrams(item as ItemId)).toBe(mass);
  expect(commercialItemMassGrams('wood',193)).toBeUndefined();
  expect(commercialItemMassGrams('wood',235)).toBe(400);
  expect(commercialItemMassGrams('minified-tree',234)).toBeUndefined();
  expect(commercialItemMassGrams('minified-tree',235)).toBe(150000);
});

test('mass includes worn gear and personal inventory exactly once, never bodies or other owners',()=>{
  const w=medicalCamp(2,16),p=w.pawns[0]!,other=w.pawns[1]!;
  const pile=(id:number,item:ItemId,quantity:number,owner:MaterialPile['owner']):MaterialPile=>({id,item,quantity,kind:ITEM_DEFINITIONS[item].kind,owner});
  const items=[pile(100,'revolver',1,{type:'equipment',pawnId:p.id}),pile(101,'cloth-shirt',1,{type:'apparel',pawnId:p.id}),
    pile(102,'silver',500,{type:'inventory',pawnId:p.id}),pile(103,'survival-meal',3,{type:'inventory',pawnId:p.id}),
    pile(104,'wood',50,{type:'ground',x:0,z:0}),pile(105,'wood',50,{type:'inventory',pawnId:other.id})];
  const before=JSON.stringify({w,p,items});
  expect(commercialMass(w,p,items)).toEqual({grams:6600,capacityGrams:35000});
  expect(JSON.stringify({w,p,items})).toBe(before);
  expect(commercialPawnMass(p,[...items,items[0]!])).toBeNull();
  expect(commercialPawnMass(p,[pile(106,'wood',1,{type:'inventory',pawnId:p.id})],193)).toBeNull();
  expect(commercialPawnMass(p,[pile(106,'wood',1,{type:'inventory',pawnId:p.id})],235)).toEqual({grams:400,capacityGrams:35000});
});

test('mass reports exact capacity and overload without a hidden clamp',()=>{
  const p=medicalCamp(1,16).pawns[0]!;
  const item:MaterialPile={id:100,kind:'medicine',item:'medicine',quantity:70,owner:{type:'inventory',pawnId:p.id}};
  expect(commercialPawnMass(p,[item])).toEqual({grams:35000,capacityGrams:35000});
  expect(commercialPawnMass(p,[{...item,quantity:71}])).toEqual({grams:35500,capacityGrams:35000});
  expect(commercialPawnMass(p,[{...item,quantity:Number.MAX_SAFE_INTEGER}])).toBeNull();
});

test('settlement bonus follows Pawn clamp while historical visitor admission and price remain exact',()=>{
  const pile:MaterialPile={id:100,item:'medicine',kind:'medicine',quantity:1,owner:{type:'ground',x:0,z:0}};
  expect(tradeUnitPrice(pile,'buy',0)).toBe(18*1.4);
  expect(settlementTradeUnitPrice(pile,'buy',0)).toBe(18*1.4*.98);
  expect(settlementTradeUnitPrice(pile,'buy',.395)).toBe(18*1.4*(1-(.395+.02)));
  expect(tradeUnitPrice(pile,'buy',.415)).toBeUndefined();
  expect(settlementTradeUnitPrice(pile,'buy',.415)).toBeUndefined();
});
