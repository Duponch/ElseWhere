import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {rangedWeaponProfile} from '../src/sim/ranged-statistics.ts';
import {WEAPON_QUALITIES,isRangedWeaponItem} from '../src/sim/equipment-rules.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {GUN_REQUIREMENTS,PRODUCTION_RECIPES,stationRecipes} from '../src/sim/production-recipes.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {generateVisitorStock} from '../src/sim/trade-stock.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {validWeaponShape} from '../src/sim/equipment-save.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {firingCamp} from './scenarios/shooting.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {Command,World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};

test('the pump shotgun has the Core recipe, value and ranged statistics',()=>{
  expect(ITEM_DEFINITIONS['pump-shotgun']).toMatchObject({kind:'weapon',stackLimit:1});expect(isRangedWeaponItem('pump-shotgun')).toBe(true);
  const normal=rangedWeaponProfile('pump-shotgun','normal')!;
  expect(normal).toMatchObject({damage:18,range:15.9,warmupCoreTicks:54,cooldownCoreTicks:75,projectileTilesPerCoreTick:.55,stoppingPower:3});
  expect(normal.armorPenetration).toBeCloseTo(.14,12);expect(normal.accuracy).toEqual([.8,.87,.77,.64]);
  expect(WEAPON_QUALITIES.map(q=>rangedWeaponProfile('pump-shotgun',q)!.damage)).toEqual([16,18,18,18,18,22,27]);
  expect(GUN_REQUIREMENTS['make-pump-shotgun']).toEqual({steel:60,component:3,skill:5});
  expect(PRODUCTION_RECIPES['make-pump-shotgun']).toMatchObject({station:'machining-table',units:63,workTicks:1200});
  expect(stationRecipes({kind:'machining-table'})).toContain('make-pump-shotgun');
  expect(tradeCatalogueEntry('pump-shotgun')!.baseMarketValue).toBeCloseTo(60*1.9+3*32+12000*.0036,9);
});

test('a drafted colonist with a pump shotgun aims 54 Core ticks and shoots; the save resumes exactly',()=>{
  const w=firingCamp(),shooter=w.pawns[0]!,target=w.pawns[1]!;w.piles=[];
  addMaterial(w,'weapon',1,{type:'equipment',pawnId:shooter.id},'pump-shotgun');
  target.x=shooter.x+8;
  const start=w.tick*10;accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  expect(shooter.shooting?.stance).toMatchObject({phase:'aim',startedAtCore:start,endsAtCore:start+54,weaponItem:'pump-shotgun'});
  const copy=deserializeWorld(serializeWorld(w));let shells=0;
  for(let i=0;i<60;i++){stepWorld(w);stepWorld(copy);for(const p of w.projectiles??[])if(p.weaponItem==='pump-shotgun')shells++;}
  expect(shells).toBeGreaterThan(0);expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(validateWorld(w)).toEqual([]);
});

test('visitors may sell a pump shotgun or an EMP launcher from schema 322, with the same random draws',()=>{
  let shotguns=0,emp=0;
  for(let n=1;n<=4000;n++){
    const seed=Math.imul(n,1013904223)>>>0,now=generateVisitorStock(seed,100,101,700),old=generateVisitorStock(seed,100,101,700,321);
    expect(now.rng).toBe(old.rng);
    for(const p of old.piles)expect(now.piles).toContainEqual(expect.objectContaining({item:p.item,quantity:p.quantity}));
    if(now.piles.some(p=>p.item==='pump-shotgun'))shotguns++;if(now.piles.some(p=>p.item==='emp-launcher'))emp++;
    expect(old.piles.some(p=>p.item==='pump-shotgun'||p.item==='emp-launcher')).toBe(false);
  }
  expect(shotguns).toBeGreaterThan(0);expect(emp).toBeGreaterThan(0);
});

test('before schema 322 the shotgun, its recipe and shells are refused',()=>{
  expect(validBillSettings(newCookingBill(1,'make-pump-shotgun'),'make-pump-shotgun',321)).toBe(false);
  const gun={id:1,kind:'weapon',item:'pump-shotgun',quantity:1,owner:{type:'ground',x:1,z:1},weapon:{quality:'normal',hitPoints:100}};
  expect(validWeaponShape(gun,322)).toBe(true);expect(validWeaponShape(gun,321)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'pump-shotgun'}]},321)).toBe(false);
  expect(validTuqueCatalogueTransport({bills:[{recipe:'make-pump-shotgun'}]},321)).toBe(false);
  expect(validTuqueCatalogueTransport({projectiles:[{weaponItem:'pump-shotgun'}]},321)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'pump-shotgun'}]},322)).toBe(true);
});

test('a schema 321 save migrates to 322 by its number only',()=>{
  const current=serializeWorld(firingCamp());
  expect(serializeWorld(deserializeWorld(asOldSchema(current,321)))).toBe(current);
});
