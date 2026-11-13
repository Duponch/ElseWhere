import {expect,test} from 'vitest';
import {isTextileApparelItem308} from '../src/sim/textile-apparel-308.ts';
import {isGarmentItem312} from '../src/sim/apparel-definitions.ts';
import {APPAREL_TRADE_ITEMS_279,isOrdinaryApparel279} from '../src/sim/apparel-trade-279.ts';
import {validApparelShape} from '../src/sim/apparel-save.ts';
import {newApparelState} from '../src/sim/apparel-rules.ts';
import {validApparelTradeHistoricalTransport279,validApparelTradeWorld279} from '../src/sim/apparel-trade-save-279.ts';
import {validTradeInventoryCustody} from '../src/sim/trade-save.ts';
import {generateVisitorStock} from '../src/sim/trade-stock.ts';
import {adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import {visitorTradeFixture} from './scenarios/visitors.ts';
import {apparelReserveWorkshop455} from './scenarios/apparel-reserves-v455.ts';
import {shipCasketServiceCamp277} from './scenarios/ship-casket-service-v453.ts';
import {registryCamp,preparedMap} from './helpers/world-maps-v255.ts';
import type {MaterialPile,World} from '../src/sim/types.ts';

function garment279(w:World,pawnId:number,item:'cloth-parka'|'plainleather-shirt'='cloth-parka'):MaterialPile {
 const id=w.nextId;addMaterial(w,'apparel',1,{type:'inventory',pawnId},item);const pile=w.piles.find(p=>p.id===id);if(!pile)throw Error('Prepared physical garment missing');return pile;
}
function historical278(w:World):World {const old=structuredClone(w);Object.assign(old,{schemaVersion:278});return old;}
function preparedVisitor279(){
 const f=visitorTradeFixture();
 // The historical helper prepares the opportunity date directly. This new
 // save/control fixture declares its deterioration frontier at that same date;
 // it does not simulate elapsed days, change RNG or repair a loaded campaign.
 if(f.world.deterioration)f.world.deterioration.lastTick=f.world.tick;
 return f;
}
function public279(w:World){
 const encoder=new SnapshotEncoder(),strict=new SnapshotDecoder(),resident=new ResidentPresentationAssembler(),packet=structuredClone(encoder.encode(w,0,0));
 const a=strict.adopt(structuredClone(packet)),b=resident.adopt(structuredClone(packet));expect(a.status,a.status==='resync'?a.reason:'strict publication').toBe('applied');expect(b.status,b.status==='resync'?b.reason:'resident publication').toBe('applied');
 if(a.status!=='applied'||b.status!=='applied')throw Error('Original publication refused');expect(b.world).toEqual(a.world);return {encoder,strict,resident,packet,a,b};
}

test('all37 ordinary garments admit only279 inventory, preserving quantity, material, forced and existing body/ground rules',()=>{
 // The 37 products of schema 279; schemas 308 and 312 add garments that did not exist then.
 const v279=APPAREL_TRADE_ITEMS_279.filter(item=>!isTextileApparelItem308(item)&&!isGarmentItem312(item));
 expect(v279).toHaveLength(37);
 for(const item of v279){
  const p={id:1,item,kind:'apparel',quantity:1,owner:{type:'inventory',pawnId:2},apparel:newApparelState(item)};
  expect(validApparelShape(p,279),item).toBe(true);expect(validApparelShape(p,278),item).toBe(false);expect(validApparelShape(p,280),item).toBe(false);
  expect(validApparelShape({...p,owner:{type:'ground',x:1,z:1}},278),item).toBe(true);
  for(const bad of [{...p,quantity:2},{...p,apparel:{...p.apparel,forced:true}},{...p,apparel:{...p.apparel,hitPoints:0}},
   {...p,apparel:{...p.apparel,material:'wood'}},{...p,owner:{type:'orbital-ship',shipId:2}},{...p,owner:{type:'orbital-cargo',deliveryId:2}}])expect(validApparelShape(bad,279),item).toBe(false);
 }
});

test('the real stock planner adds only current material metadata, preserving literal278 stock, RNG and IDs',()=>{
 // Bounded pure planner search, no incident probability or World time claimed.
 let seed=0;for(let n=1;n<=4096&&!seed;n++)if(generateVisitorStock(n,100,200,0,278).piles.some(p=>p.item==='cloth-shirt'))seed=n;
 expect(seed).toBeGreaterThan(0);const old=generateVisitorStock(seed,100,200,0,278),current=generateVisitorStock(seed,100,200,0,279),legacyCopy=structuredClone(current);
 expect(old.piles.some(p=>p.item==='cloth-shirt')).toBe(true);expect(old.piles.find(p=>p.item==='cloth-shirt')!.apparel?.material).toBeUndefined();
 expect(current.piles.find(p=>p.item==='cloth-shirt')!.apparel?.material).toBe('cloth');
 for(const p of legacyCopy.piles)if(p.apparel)delete p.apparel.material;
 expect(legacyCopy).toEqual(old);expect(current.rng).toBe(old.rng);expect(current.nextId).toBe(old.nextId);
});

test('valid278 migrates by number alone with reserve settings, sampled wealth and a declared factual old receipt unchanged',()=>{
 const {w,author,wearer,bill}=apparelReserveWorkshop455();
 // Literal historical receipt fixture, not a claimed played exchange. Its
 // saved unit price is factual; migration never requotes it with a new table.
 w.trade={count:1,silverPaid:18,silverReceived:0,forgone:0,bought:{medicine:1},sold:{},recent:[{tick:w.tick,negotiatorId:author.id,traderId:wearer.id,silver:18,forgone:0,lines:[{item:'medicine',quantity:1,unitPrice:18}]}]};
 expect(adoptColonyEconomy(w)).toBe(true);expect(validateWorld(w)).toEqual([]);
 const old=historical278(w),raw=JSON.stringify(old),copy=deserializeWorld(raw);
 expect(validateWorld(copy)).toEqual([]);expect(JSON.parse(serializeWorld(copy))).toEqual({...old,schemaVersion:279});
 expect(copy.trade).toEqual(old.trade);expect(copy.economy).toEqual(old.economy);expect(copy.structures.find(s=>s.bills?.some(b=>b.id===bill.id))!.bills![0]!.apparelCount).toEqual(bill.apparelCount);
 expect(copy.rng).toBe(old.rng);expect(copy.tick).toBe(old.tick);expect(copy.nextId).toBe(old.nextId);expect(JSON.stringify(old)).toBe(raw);
});

test('partial historical owners, sparse upserts and new trade receipts are fenced without rejecting old garments on the ground',()=>{
 const p={item:'cloth-parka',kind:'apparel',quantity:1,owner:{type:'inventory',pawnId:2},apparel:newApparelState('cloth-parka')};
 const cases=[{piles:[p]},{type:'snapshot',world:{schemaVersion:278},piles:{removed:[],upserted:[p]}},
  {worldMaps:{sites:[{map:{piles:[p]}}]}},{structures:[{shipCryptosleep277:{items:[p]}}]},
  {worldPawns:{owners:[{items:[p]}]}},{visitors:{departed:[{items:[p]}]}},{worldGroups:{groups:[{state:{items:[p]}}]}},
  {trade:{bought:{'cloth-parka':false}}},{trade:{recent:[{lines:[{item:'cloth-parka',quantity:-1,unitPrice:1}]}]}}];
 for(const raw of cases){expect(validApparelTradeHistoricalTransport279(raw,278)).toBe(false);expect(validApparelTradeHistoricalTransport279(raw,279)).toBe(true);expect(validApparelTradeHistoricalTransport279(raw,280)).toBe(false);}
 expect(validApparelTradeHistoricalTransport279({piles:[{...p,owner:{type:'ground',x:2,z:2}}],trade:{sold:{'cloth-shirt':1,'cloth-tribalwear':1}}},278)).toBe(true);
 let reads=0;const getter={piles:[p]};Object.defineProperty(getter,'resources',{enumerable:true,get(){reads++;throw Error('No terrain traversal');}});expect(validApparelTradeHistoricalTransport279(getter,278)).toBe(false);expect(reads).toBe(0);
});

test('a real visitor custodian keeps the prepared original garment and condition through RAW and both public readers',()=>{
 const {world:w,traderId}=preparedVisitor279(),p=garment279(w,traderId,'plainleather-shirt');p.apparel!.hitPoints=90;p.apparel!.quality='good';
 expect(validateWorld(w)).toEqual([]);expect(validTradeInventoryCustody(w,p,279)).toBe(true);const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 const q=public279(w),retained=structuredClone(q.a.world),shown=structuredClone(q.b.world);p.apparel!.hitPoints--;
 const delta=structuredClone(q.encoder.encode(w,0,0));expect(delta.kind).toBe('delta');const a=q.strict.adopt(structuredClone(delta)),b=q.resident.adopt(delta);
 expect(a.status).toBe('applied');expect(b.status).toBe('applied');if(a.status!=='applied'||b.status!=='applied')throw Error('Valid garment delta refused');expect(b.world).toEqual(a.world);
 expect(a.world.piles.find(i=>i.id===p.id)).toMatchObject({item:'plainleather-shirt',owner:{type:'inventory',pawnId:traderId},apparel:{quality:'good',hitPoints:89,material:'plainleather'}});
 expect(q.a.world).toEqual(retained);expect(q.b.world).toEqual(shown);
});

test('278 RAW/checkpoint/same-tick delta reject ordinary inventory before migration and leave retained versions unchanged',()=>{
 const {world:w,traderId}=preparedVisitor279();
 // Historical control preparation omits prospective stock; no stock draw or
 // exchange is credited by this hostile-payload boundary fixture.
 w.piles=w.piles.filter(p=>!(isOrdinaryApparel279(p.item)&&p.owner.type==='inventory'));
 const old=historical278(w),q=public279(old),retained=structuredClone(q.a.world),shown=structuredClone(q.b.world),p=garment279(old,traderId);
 expect(()=>deserializeWorld(JSON.stringify(old))).toThrow();const full=structuredClone(q.packet);if(full.kind!=='checkpoint')throw Error('Expected checkpoint');full.world.nextId=old.nextId;full.world.piles.push(structuredClone(p));
 expect(new SnapshotDecoder().adopt(structuredClone(full)).status).toBe('resync');expect(new ResidentPresentationAssembler().adopt(full).status).toBe('resync');
 const delta=structuredClone(q.encoder.encode(old,0,0));expect(q.strict.adopt(structuredClone(delta)).status).toBe('resync');expect(q.resident.adopt(delta).status).toBe('resync');expect(q.a.world).toEqual(retained);expect(q.b.world).toEqual(shown);
});

test('invalid279 custody/condition is refused atomically by RAW and reconstructed publications',()=>{
 for(const change of [(p:MaterialPile,w:World)=>{p.owner={type:'inventory',pawnId:w.nextId+10};},(p:MaterialPile)=>{p.apparel!.forced=true;},(p:MaterialPile)=>{p.apparel!.hitPoints=0;},(p:MaterialPile)=>{p.quantity=2;}]){
  const {world:w,traderId}=preparedVisitor279(),p=garment279(w,traderId),q=public279(w),retained=structuredClone(q.a.world),shown=structuredClone(q.b.world);change(p,w);
  expect(()=>deserializeWorld(serializeWorld(w))).toThrow();const delta=structuredClone(q.encoder.encode(w,0,0));
  expect(q.strict.adopt(structuredClone(delta)).status).toBe('resync');expect(q.resident.adopt(delta).status).toBe('resync');expect(q.a.world).toEqual(retained);expect(q.b.world).toEqual(shown);
 }
});

test('the targeted archive reader requires the recorded human owner and complete ordinary garment shape',()=>{
 const {world:w,traderId}=visitorTradeFixture(),p=garment279(w,traderId),pawn=w.pawns.find(p=>p.id===traderId)!;
 // Pure archive-reader fixture only; natural departure and complete departure
 // Worlds are exercised by the separate played trader loop/native control.
 const view={...w,visitors:{...w.visitors!,departed:[{group:pawn.visitor!.group,tick:w.tick,pawn,items:[structuredClone(p)]}]}};
 expect(validApparelTradeWorld279(view)).toBe(true);
 const item=view.visitors.departed[0]!.items[0]!;item.owner={type:'inventory',pawnId:w.pawns[0]!.id};expect(validApparelTradeWorld279(view)).toBe(false);
 item.owner={type:'inventory',pawnId:traderId};item.apparel!.hitPoints=0;expect(validApparelTradeWorld279(view)).toBe(false);
});

test('inactive original map is checked before278 migration instead of borrowing its current actor namespace',()=>{
 const w=registryCamp(),map=preparedMap(w,52,'legacy-site',true);garment279(map,map.pawns[0]!.id);
 expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
 const old=historical278(w);expect(()=>deserializeWorld(JSON.stringify(old))).toThrow();
});

test('the same human and ordinary inventory remain owned through real spatial closing, save and public publication',()=>{
 const {w,actor,casket}=shipCasketServiceCamp277(1),p=garment279(w,actor.id);expect(validateWorld(w)).toEqual([]);
 expect(applyCommand(w,{type:'order-enter-ship-casket',pawnId:actor.id,casketId:casket.id}).ok).toBe(true);
 for(let i=0;i<500&&!casket.shipCryptosleep277.occupant;i++)stepWorld(w);
 expect(casket.shipCryptosleep277.occupant?.kind).toBe('human');expect(casket.shipCryptosleep277.items.find(i=>i.id===p.id)).toBe(p);expect(w.piles.some(i=>i.id===p.id)).toBe(false);
 expect(validateWorld(w)).toEqual([]);const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);public279(w);
 expect(()=>deserializeWorld(JSON.stringify(historical278(w)))).toThrow();
});

test('future280 is refused by RAW, new custody guards and both public checkpoint readers',()=>{
 const {world:w,traderId}=preparedVisitor279();garment279(w,traderId);const q=public279(w),future=structuredClone(w);Object.assign(future,{schemaVersion:280});
 expect(validApparelTradeWorld279(future)).toBe(false);expect(()=>deserializeWorld(JSON.stringify(future))).toThrow();const full=structuredClone(q.packet);Object.assign(full.world,{schemaVersion:280});
 expect(new SnapshotDecoder().adopt(structuredClone(full)).status).toBe('resync');expect(new ResidentPresentationAssembler().adopt(full).status).toBe('resync');
});
