import {expect,test} from 'vitest';
import {generateVisitorStock,visitorClothingStuff314,VISITOR_CLOTHING_POOL,VISITOR_CLOTHING_FAMILIES314,VISITOR_SHIRT_CLOTH_CHANCE} from '../src/sim/trade-stock.ts';
import {APPAREL} from '../src/sim/apparel-definitions.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {tradeRefusal} from '../src/sim/trade-prices.ts';
import {validTradeInventoryCustody} from '../src/sim/trade-save.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {visitorTradeFixture} from './scenarios/visitors.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';
import type {ItemId} from '../src/sim/items.ts';

/** The visitor fixture prepares its date directly: date its clocks with it. */
function fixture(){
  const f=visitorTradeFixture();
  if(f.world.deterioration)f.world.deterioration.lastTick=f.world.tick;
  if(f.world.corePathBudget297)f.world.corePathBudget297.tick=f.world.tick;
  return f;
}

test('the garment stuff follows Core commonality: cloth first, unrepresented stuffs yield nothing',()=>{
  expect(visitorClothingStuff314(0,false)).toBe('cloth');
  expect(visitorClothingStuff314(VISITOR_SHIRT_CLOTH_CHANCE-1e-9,false)).toBe('cloth');
  // Right after cloth: synthread (0.15 of 3.875), not represented.
  expect(visitorClothingStuff314(VISITOR_SHIRT_CLOTH_CHANCE+1e-9,false)).toBeUndefined();
  const seen=new Set<string>();
  for(let i=0;i<20000;i++){const m=visitorClothingStuff314(i/20000,false);if(m)seen.add(m);}
  expect(seen.size).toBe(22);
  for(const m of seen)expect(APPAREL[`${m}-shirt` as keyof typeof APPAREL]).toBeDefined();
  // The tuque only takes fabric.
  const fabrics=new Set<string>();for(let i=0;i<20000;i++){const m=visitorClothingStuff314(i/20000,true);if(m)fabrics.add(m);}
  expect([...fabrics].sort()).toEqual(['alpaca-wool','bison-wool','cloth','megasloth-wool','muffalo-wool']);
});

test('visitors now carry every represented clothing family and stuff, with the same random draws as before',()=>{
  expect(Object.values(VISITOR_CLOTHING_FAMILIES314).sort()).toEqual(['duster','jacket','pants','parka','shirt','tshirt','tuque']);
  expect(VISITOR_CLOTHING_POOL[15]!.item).toBe('cloth-shirt');
  const items=new Set<string>();
  for(let n=1;n<=3000;n++){
    const seed=Math.imul(n,1013904223)>>>0,now=generateVisitorStock(seed,100,101,700),old=generateVisitorStock(seed,100,101,700,313);
    // Identical random consumption: the same final state and every older pile kept.
    expect(now.rng).toBe(old.rng);
    for(const p of old.piles)expect(now.piles).toContainEqual(expect.objectContaining({item:p.item,quantity:p.quantity}));
    for(const p of now.piles)if(p.kind==='apparel'){items.add(p.item);expect(tradeRefusal(p,'buy',700)).toBeUndefined();expect(p.apparel!.material).toBe(APPAREL[p.item as keyof typeof APPAREL].material);}
  }
  expect([...items].some(i=>i.endsWith('-tuque'))).toBe(true);expect([...items].some(i=>i.endsWith('-jacket'))).toBe(true);
  expect([...items].some(i=>i.endsWith('-pants'))).toBe(true);expect([...items].some(i=>i.startsWith('wolf-leather-')||i.startsWith('light-leather-'))).toBe(true);
  // Schema 313 only ever had the cloth shirt.
  for(let n=1;n<=600;n++)for(const p of generateVisitorStock(n,100,101,700,313).piles)if(p.kind==='apparel')expect(p.item).toBe('cloth-shirt');
});

test('a real visitor trader holding a new garment stays valid through the save',()=>{
  const f=fixture();
  const w=f.world,id=w.nextId;addMaterial(w,'apparel',1,{type:'inventory',pawnId:f.traderId},'wolf-leather-jacket' as ItemId);
  const p=w.piles.find(q=>q.id===id)!;
  expect(validateWorld(w)).toEqual([]);expect(validTradeInventoryCustody(w,p,SCHEMA_VERSION)).toBe(true);
  const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
});

test('a schema 313 save migrates to 314 by its number only',()=>{
  const f=fixture();
  const current=serializeWorld(f.world);
  expect(serializeWorld(deserializeWorld(asOldSchema(current,313)))).toBe(current);
});
