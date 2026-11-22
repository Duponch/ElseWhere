import {expect,test} from 'vitest';
import {isApparelCountRecipe278,newApparelCountFilter278,validApparelCountFilter278,countedApparelProducts278} from '../src/sim/apparel-count-278.ts';
import {newCookingBill,validBillSettings,countedProducts,billWanted} from '../src/sim/cooking-bills.ts';
import {applyCommand} from '../src/sim/engine.ts';
import {addMaterial,reservedSource} from '../src/sim/materials.ts';
import {APPAREL,type ApparelItem} from '../src/sim/apparel-definitions.ts';
import {WEAPON_QUALITIES} from '../src/sim/equipment-rules.ts';
import {isRecipeProduct,type ProductionRecipe} from '../src/sim/production-recipes.ts';
import {storageConditionAccepts} from '../src/sim/storage-condition.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import type {ApparelCountFilter278,BillSettings,CookingBill} from '../src/sim/cooking-types.ts';
import {SCHEMA_VERSION,type MaterialPile,type World,type Command} from '../src/sim/types.ts';

const RECIPES=['tribalwear','shirt','pants','duster','parka','tuque','make-flak-vest','make-flak-helmet','make-recon-helmet','make-recon-armor','make-plate-armor','make-simple-helmet'] as const;
function world278(count=1):World {
 const w=deconstructionCamp(count,32);w.stockpiles=[];
 for(const p of w.pawns)p.apparelAutomation=false;
 return w;
}
function garment(w:World,item:ApparelItem='cloth-shirt',owner:MaterialPile['owner']={type:'ground',x:8,z:8}):MaterialPile {
 addMaterial(w,'apparel',1,owner,item);return w.piles.at(-1)!;
}
function bill278(recipe:ProductionRecipe='shirt',filter:Partial<ApparelCountFilter278>={}):CookingBill {
 return {...newCookingBill(900,recipe,278),mode:'until',target:1,apparelCount:{...newApparelCountFilter278(),...filter}};
}
const accept=(w:World,c:Command)=>expect(applyCommand(w,c)).toMatchObject({ok:true});
/** Pure visibility-reader input, never submitted as a saved geographic World.
 * Full geography/provenance admission is exercised by the transport tests. */
const fogReader278=(w:World):World=>({...w,site:{revision:3} as World['site'],exploration:{revision:1}});

test('only the twelve current apparel recipes create a neutral prospective count filter, with fresh independent data',()=>{
 expect(RECIPES.every(isApparelCountRecipe278)).toBe(true);
 for(const recipe of RECIPES){
  const old=newCookingBill(1,recipe,277),current=newCookingBill(2,recipe,278),future=newCookingBill(3,recipe,SCHEMA_VERSION+1);
  expect(Object.hasOwn(old,'apparelCount')).toBe(false);expect(Object.hasOwn(future,'apparelCount')).toBe(false);
  expect(current.apparelCount).toEqual({hpMin:0,hpMax:100,qualityMin:'awful',qualityMax:'legendary',includeEquipped:false});
  expect(validBillSettings(current,recipe,278)).toBe(true);expect(validBillSettings(current,recipe,279)).toBe(true);expect(validBillSettings(current,recipe,SCHEMA_VERSION)).toBe(true);
  expect(newCookingBill(3,recipe,279).apparelCount).toEqual(current.apparelCount);
  // Schema 374: a new filter also holds Core's includeTainted, false by default.
  expect(newCookingBill(3,recipe,SCHEMA_VERSION).apparelCount).toEqual({...current.apparelCount,includeTainted374:false});
  expect(validBillSettings(current,recipe,277)).toBe(false);expect(validBillSettings(current,recipe,SCHEMA_VERSION+1)).toBe(false);
  const other=newCookingBill(4,recipe,278);expect(other.apparelCount).not.toBe(current.apparelCount);
 }
 for(const recipe of ['make-mace','make-longsword','make-spear','make-plasteel-knife','make-revolver','simple-meal','small-sculpture','make-prosthetic-arm','smelt-apparel','burn-apparel'] as const){
  expect(isApparelCountRecipe278(recipe)).toBe(false);expect(Object.hasOwn(newCookingBill(1,recipe,278),'apparelCount')).toBe(false);
 }
 expect(isApparelCountRecipe278(null)).toBe(false);expect(isApparelCountRecipe278('future-apparel')).toBe(false);
});

test('filter shape, integer HP ranges, ordered qualities and presence are closed without reading accessors',()=>{
 const initial=newApparelCountFilter278(),invalid:unknown[]=[undefined,null,false,[],{},Object.create(initial),{...initial,hpMin:-1},{...initial,hpMax:101},{...initial,hpMin:.5},{...initial,hpMax:NaN},{...initial,hpMax:Infinity},{...initial,hpMin:80,hpMax:20},{...initial,qualityMin:'missing'},{...initial,qualityMin:'legendary',qualityMax:'normal'},{...initial,includeEquipped:1},{...initial,future279:true},{...initial,[Symbol('future')]:true}];
 const missing={...initial} as Partial<ApparelCountFilter278>;delete missing.hpMax;invalid.push(missing);
 const getter={...initial};Object.defineProperty(getter,'hpMin',{enumerable:true,get(){throw Error('Filter getter must not run');}});invalid.push(getter);
 const hidden={...initial};Object.defineProperty(hidden,'includeEquipped',{value:false,enumerable:false});invalid.push(hidden);
 const legacy=newCookingBill(1,'shirt',277);
 for(const value of invalid){expect(validApparelCountFilter278(value)).toBe(false);expect(validBillSettings({...legacy,apparelCount:value},'shirt',278)).toBe(false);}
 expect(validApparelCountFilter278(initial)).toBe(true);
 expect(validBillSettings({...newCookingBill(1,'simple-meal',278),apparelCount:initial},'simple-meal',278)).toBe(false);
 const settings={...legacy};Object.defineProperty(settings,'apparelCount',{enumerable:true,get(){throw Error('Bill getter must not run');}});
 expect(validBillSettings(settings,'shirt',278)).toBe(false);
 const inherited=Object.assign(Object.create({apparelCount:initial}),legacy);expect(validBillSettings(inherited,'shirt',278)).toBe(false);
});

test.each(RECIPES)('%s counts its current material variants once and no product from another recipe',recipe=>{
 const w=world278(),bill=bill278(recipe),products=(Object.keys(APPAREL) as ApparelItem[]).filter(item=>isRecipeProduct(recipe,item));
 for(const [i,item] of products.entries())garment(w,item,{type:'ground',x:2+i%20,z:2+Math.floor(i/20)});
 const different=(Object.keys(APPAREL) as ApparelItem[]).find(item=>!isRecipeProduct(recipe,item))!;garment(w,different,{type:'ground',x:28,z:28});
 expect(countedProducts(w,bill)).toBe(products.length);expect(countedApparelProducts278(w,bill)).toBe(products.length);
 // Native limitToAllowedStuff is outside this lot: input material settings
 // do not silently narrow the finished-product family.
 bill.filters=Object.fromEntries(Object.keys(bill.filters).map(item=>[item,false]));expect(countedProducts(w,bill)).toBe(products.length);
});

test('bill HP uses float32 ratios and epsilon instead of storage rounded percentages; qualities have inclusive bounds',()=>{
 const w=world278(),parka=garment(w,'cloth-parka'),bill=bill278('parka',{hpMin:51,qualityMin:'normal',qualityMax:'excellent'});
 expect(APPAREL['cloth-parka'].hitPoints).toBe(180);parka.apparel!.hitPoints=91;
 expect(storageConditionAccepts({hitPoints:{min:51,max:100}},parka)).toBe(true);expect(countedProducts(w,bill)).toBe(0);
 parka.apparel!.hitPoints=92;expect(countedProducts(w,bill)).toBe(1);
 for(const quality of WEAPON_QUALITIES){parka.apparel!.quality=quality;expect(countedProducts(w,bill)).toBe(['normal','good','excellent'].includes(quality)?1:0);}
 parka.apparel!.quality='normal';parka.apparel!.hitPoints=90;bill.apparelCount!.hpMin=50;bill.apparelCount!.hpMax=50;expect(countedProducts(w,bill)).toBe(1);
 parka.apparel!.hitPoints=89;expect(countedProducts(w,bill)).toBe(0);parka.apparel!.hitPoints=91;expect(countedProducts(w,bill)).toBe(0);
 const shirt=garment(w,'cloth-shirt',{type:'ground',x:9,z:8}),shirtBill=bill278('shirt',{hpMin:51,hpMax:51});shirt.apparel!.hitPoints=51;expect(countedProducts(w,shirtBill)).toBe(1);
});

test('visible loose stock and player task cargo count while forbidden/reserved status does not mint or erase a reserve',()=>{
 const w=world278(),p=w.pawns[0]!,loose=garment(w),cargo=garment(w,'light-leather-shirt',{type:'pawn',pawnId:p.id}),bill=bill278();p.interruptedCargo=true;
 loose.apparel!.forbidden=true;
 expect(validateWorld(w)).toEqual([]);const before=serializeWorld(w),rng=w.rng,id=w.nextId;
 expect(countedProducts(w,bill)).toBe(2);expect(billWanted(w,bill)).toBe(false);expect(serializeWorld(w)).toBe(before);expect(w.rng).toBe(rng);expect(w.nextId).toBe(id);
 const fog=fogReader278(w);
 w.tiles[loose.owner.type==='ground'?loose.owner.z*w.width+loose.owner.x:0]!.fogged=true;expect(countedProducts(fog,bill)).toBe(1);expect(countedProducts(w,bill)).toBe(2);
 w.tiles[p.z*w.width+p.x]!.fogged=true;expect(countedProducts(fog,bill)).toBe(0);
 delete w.tiles[p.z*w.width+p.x]!.fogged;cargo.owner={type:'ground',x:9,z:9};delete p.interruptedCargo;expect(countedProducts(fog,bill)).toBe(1);
});

test('a real dressing reservation leaves the same finished garment in the reserve without making it personal inventory',()=>{
 const w=world278(),p=w.pawns[0]!,a=garment(w),bill=bill278();
 accept(w,{type:'order-equipment',pawnId:p.id,itemId:a.id,action:'wear',queue:false});
 expect(reservedSource(w,a.id)).toBe(1);expect(a.owner.type).toBe('ground');expect(validateWorld(w)).toEqual([]);
 const before=serializeWorld(w);expect(countedProducts(w,bill)).toBe(1);expect(serializeWorld(w)).toBe(before);
 const copy=deserializeWorld(before);expect(countedProducts(copy,bill)).toBe(1);expect(reservedSource(copy,a.id)).toBe(1);
});

test('the optional personal-owner supplement is map-local and distinguishes carry, inventory, worn, guest and captive',()=>{
 // A pure selector fixture; full owner/transport admission has its own tests.
 // Only active local arrays are read, never a synthetic WorldPawns registry.
 const w=world278(4),[colonist,captive,visitor,enemy]=w.pawns;
 captive!.prisoner={} as NonNullable<typeof captive>['prisoner'];visitor!.faction='outlanders';enemy!.faction='outlaws';
 const a=garment(w,'cloth-shirt',{type:'apparel',pawnId:colonist!.id}),b=garment(w,'cloth-shirt',{type:'inventory',pawnId:colonist!.id});
 garment(w,'cloth-shirt',{type:'apparel',pawnId:captive!.id});garment(w,'cloth-shirt',{type:'apparel',pawnId:visitor!.id});garment(w,'cloth-shirt',{type:'apparel',pawnId:enemy!.id});
 for(const owner of [{type:'inventory',pawnId:w.nextId+10},{type:'starting-pod',podId:1},{type:'orbital-cargo',deliveryId:1}] as const)w.piles.push({...structuredClone(a),id:w.nextId++,owner});
 const bill=bill278();expect(countedProducts(w,bill)).toBe(0);bill.apparelCount!.includeEquipped=true;expect(countedProducts(w,bill)).toBe(2);
 colonist!.state='downed';expect(countedProducts(w,bill)).toBe(2);colonist!.state='dead';expect(countedProducts(w,bill)).toBe(0);colonist!.state='idle';
 colonist!.cryptosleepHeldAt271=w.tick;expect(countedProducts(w,bill)).toBe(0);delete colonist!.cryptosleepHeldAt271;
 colonist!.shipCryptosleepHeldAt277=w.tick;expect(countedProducts(w,bill)).toBe(0);delete colonist!.shipCryptosleepHeldAt277;
 w.pawns=w.pawns.filter(p=>p.id!==colonist!.id);expect(countedProducts(w,bill)).toBe(0);expect(a.owner).toEqual({type:'apparel',pawnId:colonist!.id});expect(b.owner).toEqual({type:'inventory',pawnId:colonist!.id});
});

test('absent prospective settings retain exact textile, armor and loose-stock historical decisions',()=>{
 const w=world278(),p=w.pawns[0]!;garment(w,'cloth-shirt',{type:'apparel',pawnId:p.id});garment(w,'flak-vest',{type:'apparel',pawnId:p.id});garment(w,'cloth-shirt',{type:'ground',x:5,z:5});
 const shirt=newCookingBill(1,'shirt',277),vest=newCookingBill(2,'make-flak-vest',277);
 expect(countedProducts(w,shirt)).toBe(0);expect(countedProducts(w,vest)).toBe(1);expect(countedApparelProducts278(w,shirt)).toBe(0);
 w.stockpiles.push({id:w.nextId++,x:5,z:5,priority:1,capacity:75,filters:{wood:false,food:false,apparel:true}});expect(countedProducts(w,shirt)).toBe(1);
 const fresh=bill278('make-flak-vest');expect(countedProducts(w,fresh)).toBe(0);fresh.apparelCount!.includeEquipped=true;expect(countedProducts(w,fresh)).toBe(1);
});

test('the new reader touches no storage, structures, resources, remote owners or unrelated terrain cells and notices same-tick changes',()=>{
 const originalWorld=world278(),a=garment(originalWorld),w=fogReader278(originalWorld),bill=bill278(),original=w.tiles;let cellReads=0;
 for(const key of ['stockpiles','structures','resources','worldPawns','worldMaps','worldGroups'] as const)Object.defineProperty(w,key,{get(){throw Error(`Global ${key} must stay unread`);}});
 w.tiles=new Proxy(original,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key)){cellReads++;expect(key).toBe(String(8*w.width+8));}return Reflect.get(target,key,receiver);}});
 expect(countedProducts(w,bill)).toBe(1);expect(cellReads).toBe(1);
 a.apparel!.hitPoints=30;bill.apparelCount!.hpMin=51;expect(countedProducts(w,bill)).toBe(0);a.apparel!.hitPoints=100;expect(countedProducts(w,bill)).toBe(1);
});

test('actual bill commands opt in, copy data, refuse malformed edits atomically, and can explicitly remove the new domain',()=>{
 const w=world278();accept(w,{type:'designate',kind:'crafting-spot',x:8,z:8});const station=w.structures[0]!;
 accept(w,{type:'bill-add',structureId:station.id,recipe:'tribalwear'});const bill=station.bills![0]!;expect(bill.apparelCount).toEqual(newApparelCountFilter278());expect(validateWorld(w)).toEqual([]);
 const settings:BillSettings={...bill,mode:'until',target:2,apparelCount:{...newApparelCountFilter278(),hpMin:51,qualityMin:'normal',includeEquipped:true}};
 const before=serializeWorld(w);expect(applyCommand(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:{...settings,apparelCount:undefined}}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
 const getter={...settings};Object.defineProperty(getter,'apparelCount',{enumerable:true,get(){throw Error('Malformed edit invoked a getter');}});expect(applyCommand(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:getter}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
 accept(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings});expect(bill.apparelCount).toEqual(settings.apparelCount);expect(bill.apparelCount).not.toBe(settings.apparelCount);
 settings.apparelCount!.hpMin=80;expect(bill.apparelCount!.hpMin).toBe(51);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
 const legacy={...bill};delete legacy.apparelCount;accept(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:legacy});expect(Object.hasOwn(bill,'apparelCount')).toBe(false);
 accept(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings});expect(bill.apparelCount!.hpMin).toBe(80);expect(validateWorld(w)).toEqual([]);
});
