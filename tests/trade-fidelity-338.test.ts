import {expect,test,vi} from 'vitest';
import * as healthRules from '../src/sim/health-rules.ts';
import {applyCommand,stepWorld} from '../src/sim/index.ts';
import {addMaterial,addGroundMaterial} from '../src/sim/materials.ts';
import {quoteTrade,tradeGoods} from '../src/sim/trade-goods.ts';
import {tradingAtContact} from '../src/sim/trade-contact.ts';
import {negotiatorRefusal,bestGroupNegotiator} from '../src/sim/trade-negotiator.ts';
import {arriveTraderCaravan332,enableVisitors} from '../src/sim/visitors.ts';
import type {HomeVisitorCalendar} from '../src/sim/visitor-state.ts';
import {CARAVAN_GUARDS_332,CARAVAN_TRADERS_332,CARAVAN_TRADER_KINDS_332,caravanApparel332,caravanDealsIn332} from '../src/sim/trader-caravans-332.ts';
import {planTradeGoodwill338,soldSilver338,tradeGoodwillGain338} from '../src/sim/trade-goodwill-338.ts';
import {validWorldRelationKind274,worldGoodwillChange274} from '../src/sim/world-diplomacy-274.ts';
import {draftForeignRoster261} from '../src/sim/caravan-foreign-roster-261.ts';
import {validPendingEncounterShape261,validatePendingEncounterRecords261} from '../src/sim/caravan-pending-save-261.ts';
import {quoteMeetingTrade261} from '../src/sim/caravan-meeting-trade-261.ts';
import {orbitalCamp} from './helpers/orbital-v281.ts';
import {applyOrbitalTrade,advanceOrbital,createOrbitalShip,orderOrbitalTrade,processOrbitalTrade} from '../src/sim/orbital.ts';
import {orbitalAtContact,orbitalConsoleSpot,orbitalItemRefusal,orbitalTradeGoods,quoteOrbitalTrade} from '../src/sim/orbital-rules.ts';
import {orbitalClothing338,orbitalItemRefusal338,orbitalTechHediff338} from '../src/sim/orbital-trade-338.ts';
import {isOrdinaryApparel279} from '../src/sim/apparel-trade-279.ts';
import {blockedCells,reachableCells,routeToCell} from '../src/sim/pathfinding.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {SettlementTile} from '../src/sim/world-settlement-placement.ts';
import type {ItemId} from '../src/sim/items.ts';
import type {NeedContext} from '../src/sim/needs.ts';
import type {TradeLine} from '../src/sim/trade-state.ts';
import type {WorldGroupRecord} from '../src/sim/world-map-state.ts';
import type {PendingCaravanEncounter261} from '../src/sim/caravan-encounter-state-261.ts';
import {SCHEMA_VERSION,type MaterialPile,type Pawn,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const total=(piles:readonly MaterialPile[],item:ItemId)=>piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
const calendar=(w:World)=>w.visitors as HomeVisitorCalendar;
/** Declared fixture (as the schema 332 tests): a camp given the real default
 * world faction registry, generated on a synthetic ring of tiles. */
function colony(size=48):World {
  const w=deconstructionCamp(2,size);
  const tiles:readonly SettlementTile[]=Array.from({length:128},(_,i)=>({biome:'temperate-forest',hilliness:'flat',neighbours:[(i+127)%128,(i+1)%128]}));
  const foreign=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:2,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(718)});
  if(!foreign.ok)throw Error(foreign.reason);
  const registry=completeWorldFactionRegistry256({version:w.schemaVersion,draft:foreign.draft,playerDef:'PlayerColony',name:'Colonie de contrôle',postWorldRandom:new WorldGenerationRandom(991)});
  if(!registry.ok)throw Error(registry.reason);
  w.worldFactions=registry.registry;w.nextId=foreign.nextThingId;
  return w;
}
function clock(w:World,tick:number):void {
  w.tick=tick;
  if(w.corePathBudget297)w.corePathBudget297.tick=tick;
  if(w.deterioration)w.deterioration.lastTick=tick;
}
function freeCell(w:World,from:{x:number;z:number}):{x:number;z:number} {
  for(let r=1;r<10;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    const x=from.x+dx,z=from.z+dz;
    if(x<0||z<0||x>=w.width||z>=w.height||w.tiles[z*w.width+x]!.terrain!=='grass'||w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z)||w.pawns.some(p=>p.x===x&&p.z===z))continue;
    return {x,z};
  }
  throw Error('No free cell.');
}
const factionId=(w:World,def:string)=>w.worldFactions!.factions.find(f=>f.def===def)!.id;
const relationOf=(w:World,id:number)=>{const r=w.worldFactions!,p=r.playerFactionId;return r.relations.find(x=>x.aId===Math.min(id,p)&&x.bId===Math.max(id,p))!;};
/** A prepared opportunity (declared): the real producer is called at the
 * current tick and, when it refuses, one tick later. */
function caravanArrives(w:World):{trader:Pawn;factionId:number|null} {
  enableVisitors(w);
  for(let i=0;i<400&&!calendar(w).groups.some(g=>g.caravan332);i++)if(!arriveTraderCaravan332(w))clock(w,w.tick+1);
  const group=calendar(w).groups.find(g=>g.caravan332)!;
  expect(group).toBeDefined();
  return {trader:w.pawns.find(p=>p.visitor?.group===group.id&&p.visitor.role==='trader')!,factionId:group.caravan332!.factionId};
}
/** Real order, real walk, real contact; then sells every unit of `item`. */
function sellAtContact(w:World,negotiator:Pawn,trader:Pawn,item:ItemId){
  const order=applyCommand(w,{type:'order-trade',pawnId:negotiator.id,traderId:trader.id});
  expect(order.ok,order.reason).toBe(true);
  for(let i=0;i<3000&&!tradingAtContact(w,negotiator,trader);i++)stepWorld(w);
  expect(tradingAtContact(w,negotiator,trader)).toBe(true);
  const good=tradeGoods(w,negotiator,trader).goods.find(g=>g.side==='sell'&&g.pile.item===item&&!g.refusal)!;
  expect(good).toBeDefined();
  const lines=[{pileId:good.pile.id,quantity:-good.available}],quote=quoteTrade(w,negotiator.id,trader.id,lines);
  if(!quote.ok)throw Error(quote.reason);
  const sold=soldSilver338([{count:good.available,unitPrice:good.unitPrice}]);
  expect(applyCommand(w,{type:'trade-execute',pawnId:negotiator.id,traderId:trader.id,lines,quote:quote.signature,acceptShortfall:true}).ok).toBe(true);
  return sold;
}

test('the trade goodwill follows Core Notify_PlayerTraded and TryAffectGoodwillWith',()=>{
  expect(tradeGoodwillGain338(599.99)).toBe(0);expect(tradeGoodwillGain338(600)).toBe(1);expect(tradeGoodwillGain338(1799.5)).toBe(2);expect(tradeGoodwillGain338(0)).toBe(0);
  // Float32 sum of count x unit sell price of the sold lines only.
  expect(soldSilver338([{count:100,unitPrice:6.12},{count:0,unitPrice:1000}])).toBe(Math.fround(Math.fround(100)*Math.fround(6.12)));
  const w=colony(32),civil=factionId(w,'OutlanderCivil'),r=relationOf(w,civil);
  // Below the natural goodwill (0) a gain gets Core's quarter bonus: 4 -> 5.
  Object.assign(r,{goodwill:-50,kind:'neutral'});
  expect(planTradeGoodwill338(w.worldFactions,civil,2400,338)).toMatchObject({before:-50,after:-45,kindAfter:'neutral',requested:4});
  expect(planTradeGoodwill338(w.worldFactions,civil,2400,337)).toBeUndefined();
  expect(planTradeGoodwill338(w.worldFactions,civil,599,338)).toBeUndefined();
  // No faction, no goodwill (orbital ship, historical visitor, civilian post).
  expect(planTradeGoodwill338(undefined,civil,6000,338)).toBeUndefined();
  expect(planTradeGoodwill338(w.worldFactions,null,6000,338)).toBeUndefined();
  // Thresholds and clamp.
  Object.assign(r,{goodwill:74,kind:'neutral'});
  expect(planTradeGoodwill338(w.worldFactions,civil,600,338)).toMatchObject({after:75,kindAfter:'ally'});
  Object.assign(r,{goodwill:100,kind:'ally'});
  expect(planTradeGoodwill338(w.worldFactions,civil,6000,338)).toBeUndefined();
  // CanChangeGoodwillFor: permanent enemies and defeated factions never change.
  const pirate=w.worldFactions!.factions.find(f=>f.def==='Pirate');
  if(pirate)expect(planTradeGoodwill338(w.worldFactions,pirate.id,6000,338)).toBeUndefined();
  const faction=w.worldFactions!.factions.find(f=>f.id===civil)!;
  Object.assign(r,{goodwill:0,kind:'neutral'});faction.lifecycle259={revision:1,defeated:true,temporary:false};
  expect(planTradeGoodwill338(w.worldFactions,civil,6000,338)).toBeUndefined();
});

test('a drafted negotiator trades with a faction caravan, whose faction gains goodwill; schema 337 refuses both',()=>{
  const w=colony(48),{trader,factionId:id}=caravanArrives(w);
  expect(id).not.toBeNull();expect(trader.worldAffiliation259?.factionId).toBe(id);
  const negotiator=w.pawns.find(p=>!p.visitor)!,relation=relationOf(w,id!);
  expect(applyCommand(w,{type:'area',action:'home',from:{x:0,z:0},to:{x:w.width-1,z:w.height-1}}).ok).toBe(true);
  addMaterial(w,'gold',250,{type:'ground',...freeCell(w,negotiator)},'gold');
  expect(applyCommand(w,{type:'draft',pawnIds:[negotiator.id],enabled:true}).ok).toBe(true);
  expect(negotiatorRefusal(negotiator,338)).toBeUndefined();
  expect(negotiatorRefusal(negotiator)).toMatch(/démobilisé/);
  const before=relation.goodwill,kind=relation.kind,sold=sellAtContact(w,negotiator,trader,'gold');
  expect(negotiator.draft).toBeDefined();
  const gain=tradeGoodwillGain338(sold);expect(gain).toBeGreaterThanOrEqual(2);
  const change=worldGoodwillChange274(before,kind,0,gain)!;
  expect(relation.goodwill).toBe(change.goodwillAfter);expect(relation.goodwill).toBeGreaterThan(before);
  expect(w.events.some(e=>e.message===`Relations avec ${w.worldFactions!.factions.find(f=>f.id===id)!.name} : ${before} → ${change.goodwillAfter} (commerce).`)).toBe(true);
  // The synthetic registry has no geographic campaign to save; the relation
  // itself stays a valid persisted pair.
  expect(validWorldRelationKind274(relation.goodwill,relation.kind,338)).toBe(true);

  // Schema 337 in memory: a drafted negotiator is refused, a sale changes nothing.
  setVersion(w,337);
  const refused=applyCommand(w,{type:'order-trade',pawnId:negotiator.id,traderId:trader.id});
  expect(refused.ok).toBe(false);expect(refused.reason).toMatch(/démobilisé/);
  expect(applyCommand(w,{type:'draft',pawnIds:[negotiator.id],enabled:false}).ok).toBe(true);
  addMaterial(w,'gold',200,{type:'ground',...freeCell(w,negotiator)},'gold');
  const after338=relation.goodwill;
  expect(tradeGoodwillGain338(sellAtContact(w,negotiator,trader,'gold'))).toBeGreaterThan(0);
  expect(relation.goodwill).toBe(after338);
},300_000);

test('a trader without a world faction brings no goodwill',()=>{
  const w=deconstructionCamp(2,48),{trader,factionId:id}=caravanArrives(w);
  expect(id).toBeNull();expect(trader.worldAffiliation259).toBeUndefined();expect(w.worldFactions).toBeUndefined();
  const negotiator=w.pawns.find(p=>!p.visitor)!;
  expect(applyCommand(w,{type:'area',action:'home',from:{x:0,z:0},to:{x:w.width-1,z:w.height-1}}).ok).toBe(true);
  addMaterial(w,'gold',250,{type:'ground',...freeCell(w,negotiator)},'gold');
  expect(tradeGoodwillGain338(sellAtContact(w,negotiator,trader,'gold'))).toBeGreaterThan(0);
  expect(w.events.some(e=>e.message.startsWith('Relations avec'))).toBe(false);
  expect(validateWorld(w)).toEqual([]);
},300_000);

test('a caravan met on the world map is a Core Trader group of its faction\'s caravan kinds; 337 keeps the visitor roster',()=>{
  const w=colony(32);
  for(const def of ['OutlanderCivil','TribeCivil'])for(let seed=1;seed<=24;seed++){
    const id=factionId(w,def),family=def==='OutlanderCivil'?'outlander':'tribe',r=draftForeignRoster261(w,'trader',id,100,seed*7919);
    if(!r)throw Error('No roster');
    const kind=r.meeting!.caravanKind338!,trader=r.people[0]!;
    expect(CARAVAN_TRADER_KINDS_332[kind].family).toBe(family);
    expect(r.meeting!.traderId).toBe(trader.id);expect(r.meeting!.guardIds).toEqual(r.people.slice(1).map(p=>p.id));
    expect(r.people.length).toBeLessThanOrEqual(24);
    // Guards from GenerateGuardPoints (550-1000) less the trader's cost.
    const guards=r.people.slice(1).map(p=>Object.values(CARAVAN_GUARDS_332).find(g=>g.family===family&&p.name.slice(0,p.name.lastIndexOf(' '))===g.label)!);
    expect(guards.every(g=>!!g)).toBe(true);
    expect(guards.reduce((n,g)=>n+g.cost,0)).toBeLessThanOrEqual(1000-CARAVAN_TRADERS_332[family].cost);
    for(const p of r.people){
      expect(p.worldAffiliation259?.factionId).toBe(id);
      expect(r.items.some(i=>i.owner.type==='equipment'&&i.owner.pawnId===p.id)).toBe(true);
      expect(r.items.find(i=>i.owner.type==='apparel'&&i.owner.pawnId===p.id)!.item).toBe(caravanApparel332(family));
    }
    // Wares: the kind's generators (silver 750-1200), carried by the trader.
    // The trader's last inventory pile is its personal meal, never a ware.
    const wares=r.items.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===trader.id).slice(0,-1);
    const silver=total(wares,'silver');expect(silver).toBeGreaterThanOrEqual(750);expect(silver).toBeLessThanOrEqual(1200);
    for(const i of wares)expect(caravanDealsIn332(kind).has(i.item)||i.kind==='apparel').toBe(true);
    const ids=[...r.people,...r.items].map(x=>x.id);
    expect(new Set(ids).size).toBe(ids.length);expect(Math.max(...ids)).toBeLessThan(r.nextId);expect(Math.min(...ids)).toBeGreaterThanOrEqual(w.nextId);
    expect(draftForeignRoster261(w,'trader',id,100,seed*7919)).toEqual(r);
  }
  // Schema 337: the historical visitor roster and stock (silver 50-250), no kind.
  setVersion(w,337);
  const old=draftForeignRoster261(w,'trader',factionId(w,'OutlanderCivil'),100,7919)!;
  setVersion(w,SCHEMA_VERSION);
  expect(Object.hasOwn(old.meeting!,'caravanKind338')).toBe(false);
  const oldSilver=total(old.items.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===old.meeting!.traderId),'silver');
  expect(oldSilver).toBeGreaterThanOrEqual(50);expect(oldSilver).toBeLessThanOrEqual(250);
});

test('the met caravan record keeps its kind strictly, and buys back its own wares',()=>{
  const w=colony(32),id=factionId(w,'OutlanderCivil'),r=draftForeignRoster261(w,'trader',id,100,4242)!,atCore=w.tick*10;
  const pending={revision:1,kind:'meeting',decision:'open',atCore,factionId:id,people:r.people,animals:[],items:r.items,packed:[],...r.meeting} as PendingCaravanEncounter261;
  expect(validPendingEncounterShape261(pending,338,r.nextId,atCore)).toBe(true);
  expect(validPendingEncounterShape261({...pending,caravanKind338:'orbital-bulk'},338,r.nextId,atCore)).toBe(false);
  expect(validPendingEncounterShape261(pending,337,r.nextId,atCore)).toBe(false);
  const {caravanKind338:_,...migrated}=pending as Extract<PendingCaravanEncounter261,{kind:'meeting'}>;
  expect(validPendingEncounterShape261(migrated,338,r.nextId,atCore)).toBe(true);
  expect(validPendingEncounterShape261(migrated,337,r.nextId,atCore)).toBe(true);
  // The kind must belong to the met faction's caravan family.
  const family=(p:PendingCaravanEncounter261)=>validatePendingEncounterRecords261({schemaVersion:w.schemaVersion,nextId:r.nextId,tick:w.tick,worldFactions:w.worldFactions},
    {originMapId:0,localMapId:null,context:{},state:{members:[w.pawns[0]!],items:[]},encounters261:{revision:1},pending261:p} as never,w,new Set(),new Set());
  const mismatch='Pending caravan trader kind does not belong to its faction';
  expect(family({...pending,caravanKind338:'tribe-bulk'} as PendingCaravanEncounter261)).toEqual([mismatch]);
  expect(family({...pending,caravanKind338:'outlander-exotic'} as PendingCaravanEncounter261)).not.toContain(mismatch);
  // A pure quote over the real quote code: the met bulk trader buys and sells steel.
  const negotiator=w.pawns.find(p=>!p.visitor)!,traderId=r.meeting!.traderId;
  const steel:MaterialPile={id:r.nextId,kind:'steel',item:'steel',quantity:30,owner:{type:'inventory',pawnId:negotiator.id}};
  const wares:MaterialPile[]=[{id:r.nextId+1,kind:'steel',item:'steel',quantity:50,owner:{type:'inventory',pawnId:traderId}},{id:r.nextId+2,kind:'silver',item:'silver',quantity:900,owner:{type:'inventory',pawnId:traderId}}];
  const quote=(p:PendingCaravanEncounter261)=>{
    const record={originMapId:0,localMapId:null,context:{},state:{members:[negotiator],items:[steel],lastPersonalTick:w.tick},pending261:{...p,items:wares}} as unknown as WorldGroupRecord;
    const q=quoteMeetingTrade261({schemaVersion:w.schemaVersion,tick:w.tick,nextId:r.nextId+3},record,[]);if(!q.ok)throw Error(q.reason);return q.goods;
  };
  const withKind=quote({...pending,caravanKind338:'outlander-bulk'} as PendingCaravanEncounter261);
  expect(withKind.find(g=>g.id===steel.id)!.refusal).toBeUndefined();
  expect(withKind.find(g=>g.id===wares[0]!.id)!.refusal).toBeUndefined();
  const historical=quote(migrated as PendingCaravanEncounter261);
  expect(historical.find(g=>g.id===steel.id)!.refusal).toMatch(/catégorie/);
  expect(historical.find(g=>g.id===wares[0]!.id)!.refusal).toMatch(/catégorie/);
});

test('caravan and settlement negotiators no longer need to talk and hear; the comms console needs talking',()=>{
  const w=colony(32),p=w.pawns.find(q=>!q.visitor)!;
  p.draft={lastActiveTick:w.tick,target:null,queue:[]};
  expect(bestGroupNegotiator([p],338)).toBe(p);expect(bestGroupNegotiator([p])).toBeUndefined();
  delete p.draft;
  // Declared stub of the body assessment: a mute and deaf negotiator (the
  // trade stat still weighs both capacities, at 0.1 each).
  const real=healthRules.pawnBody,spy=vi.spyOn(healthRules,'pawnBody').mockImplementation(q=>{const b=real(q);return {...b,capacities:{...b.capacities,talking:0,hearing:0}};});
  try{
    expect(negotiatorRefusal(p)).toMatch(/parler et entendre/);
    expect(negotiatorRefusal(p,338,'pawn')).toBeUndefined();
    expect(negotiatorRefusal(p,338,'comms')).toMatch(/parler/);
    expect(bestGroupNegotiator([p],338)).toBe(p);expect(bestGroupNegotiator([p],337)).toBeUndefined();
  }finally{spy.mockRestore();}
});

function orbitalFixture(kind:'bulk'|'exotic'='bulk'){
  const f=orbitalCamp(kind),w=f.world,p=w.pawns.find(q=>q.id===f.negotiatorId)!,ship=w.orbital!.ships.find(s=>s.id===f.shipId)!,console=w.structures.find(s=>s.id===f.consoleId)!;
  return {...f,w,p,ship,console};
}
const context=(w:World,p:Pawn):NeedContext=>{const reach=()=>reachableCells(w,p,blockedCells(w),new Set());return {search:reach,move:c=>{p.path=routeToCell(w,c,reach())??[];p.state='moving';},release:()=>releaseWork(w,p),event:message=>w.events.push({tick:w.tick,type:'need',message})};};
function contact(f:ReturnType<typeof orbitalFixture>){
  const order=orderOrbitalTrade(f.w,f.p.id,f.ship.id,f.console.id);expect(order.ok,order.reason).toBe(true);
  const spot=orbitalConsoleSpot(f.console);Object.assign(f.p,{x:spot.x,z:spot.z,path:[],motion:null,moveCooldown:0});
  processOrbitalTrade(f.w,f.p,context(f.w,f.p));expect(orbitalAtContact(f.w,f.p,f.ship)).toBe(true);
}
function execute(f:ReturnType<typeof orbitalFixture>,lines:TradeLine[]){
  const q=quoteOrbitalTrade(f.w,f.p.id,f.ship.id,lines);if(!q.ok)throw Error(q.reason);
  return applyOrbitalTrade(f.w,{type:'orbital-trade-execute',pawnId:f.p.id,shipId:f.ship.id,lines,quote:q.signature,acceptShortfall:true});
}

test('orbital buy lists follow Orbital_BulkGoods and Orbital_Exotic',()=>{
  const pile=(item:ItemId,kind:MaterialPile['kind'],extra:Partial<MaterialPile>={}):MaterialPile=>({id:1,kind,item,quantity:1,owner:{type:'ground',x:0,z:0},...extra});
  const shirt=pile('cloth-shirt','apparel',{apparel:{quality:'normal',hitPoints:100,material:'cloth',corpseWear284:false}});
  const sell=(p:MaterialPile,kind:'bulk'|'exotic')=>orbitalItemRefusal338(p,'sell',0,kind);
  // Bulk: clothing, raw resources (uranium, hops), pemmican and kibble, chemfuel, expensive simple items.
  for(const p of [shirt,pile('uranium','uranium'),pile('hops','food'),pile('pemmican','food'),pile('kibble','food'),pile('chemfuel','chemfuel'),pile('ai-core','ai-core'),pile('prosthetic-arm','prosthesis'),pile('light-leather','light-leather' as MaterialPile['kind'])])
    expect(sell(p,'bulk'),p.item).toBeUndefined();
  expect(sell({...shirt,apparel:{...shirt.apparel!,corpseWear284:true}},'bulk')).toMatch(/mort/);
  expect(sell(pile('flak-vest','apparel',{apparel:{quality:'normal',hitPoints:200,corpseWear284:false}}),'bulk')).toBeTruthy();
  expect(sell(pile('revolver','weapon',{weapon:{quality:'normal',hitPoints:100}}),'bulk')).toBeTruthy();
  expect(sell(pile('hay','food'),'bulk')).toBeTruthy();expect(sell(pile('glitterworld-medicine','glitterworld-medicine' as MaterialPile['kind']),'bulk')).toBeTruthy();
  // Exotic: expensive simple items, exotic misc (AI core), prostheses, beer, its own resources; not steel, clothing or pemmican.
  for(const p of [pile('ai-core','ai-core'),pile('prosthetic-leg','prosthesis'),pile('beer','beer'),pile('survival-meal','food'),pile('gold','gold'),pile('glitterworld-medicine','glitterworld-medicine' as MaterialPile['kind'])])
    expect(sell(p,'exotic'),p.item).toBeUndefined();
  for(const p of [pile('steel','steel'),shirt,pile('pemmican','food'),pile('uranium','uranium'),pile('medicine','medicine')])expect(sell(p,'exotic'),p.item).toBeTruthy();
  // BuyExpensiveSimple is sell-only: an orbital ship never sells a survival meal to the exotic channel.
  expect(orbitalItemRefusal338(pile('survival-meal','food'),'buy',0,'exotic')).toBeTruthy();
  // Schema 337 keeps the historical lists.
  const f=orbitalFixture();setVersion(f.w,337);
  for(const p of [shirt,pile('uranium','uranium'),pile('pemmican','food'),pile('chemfuel','chemfuel')])expect(orbitalItemRefusal(p,'sell',f.w,f.ship),p.item).toBeTruthy();
});

test('the bulk ship stocks chemfuel and garments, the exotic ship prostheses; 337 ships keep the old stock',()=>{
  const f=orbitalFixture('bulk'),held=f.w.piles.filter(p=>p.owner.type==='orbital-ship'&&p.owner.shipId===f.ship.id);
  const chemfuel=total(held,'chemfuel');expect(chemfuel).toBeGreaterThanOrEqual(200);expect(chemfuel).toBeLessThanOrEqual(600);
  const garments=held.filter(p=>p.kind==='apparel');
  for(const g of garments){expect(isOrdinaryApparel279(g.item)).toBe(true);expect(g.apparel?.corpseWear284).toBe(false);expect(['normal','good','excellent','masterwork']).toContain(g.apparel!.quality);}
  expect(validateWorld(f.w)).toEqual([]);
  // Deterministic draws; unrepresented defs keep their weight and yield nothing.
  let some=0,none=0,parts=0;
  for(let seed=1;seed<=300;seed++){
    const a=orbitalClothing338({rng:seed});expect(orbitalClothing338({rng:seed})).toEqual(a);expect(a.length).toBeLessThanOrEqual(20);
    if(a.length)some++;else none++;
    const t=orbitalTechHediff338({rng:seed});expect(new Set(t).size).toBe(t.length);for(const i of t)expect(['prosthetic-arm','prosthetic-leg']).toContain(i);parts+=t.length;
  }
  expect(some).toBeGreaterThan(none);
  // About 4 of 24 defs drawn: each prosthesis about 1/6 of ships.
  expect(parts/300).toBeGreaterThan(.15);expect(parts/300).toBeLessThan(.55);
  // An exotic ship holding drawn prostheses is a valid save.
  const e=orbitalFixture('exotic');
  for(let i=0;i<4&&!e.w.piles.some(p=>p.owner.type==='orbital-ship'&&p.item.startsWith('prosthetic'));i++)createOrbitalShip(e.w,'exotic');
  expect(validateWorld(e.w)).toEqual([]);
  // A ship created at 337 has neither.
  const o=orbitalFixture('exotic');setVersion(o.w,337);const ship=createOrbitalShip(o.w,'bulk')!;setVersion(o.w,SCHEMA_VERSION);
  const old=o.w.piles.filter(p=>p.owner.type==='orbital-ship'&&p.owner.shipId===ship.id);
  expect(total(old,'chemfuel')).toBe(0);expect(old.some(p=>p.kind==='apparel')).toBe(false);
});

test('a drafted negotiator sells garments and raw resources to a bulk ship and buys chemfuel',()=>{
  const f=orbitalFixture('bulk');
  addGroundMaterial(f.w,'apparel',1,{x:13,z:16},'cloth-shirt');addGroundMaterial(f.w,'uranium',20,{x:14,z:16},'uranium');
  expect(applyCommand(f.w,{type:'draft',pawnIds:[f.p.id],enabled:true}).ok).toBe(true);
  contact(f);expect(f.p.draft).toBeDefined();
  const goods=orbitalTradeGoods(f.w,f.p,f.ship).goods,find=(item:ItemId,side:'buy'|'sell')=>goods.find(g=>g.pile.item===item&&g.side===side&&!g.refusal)!;
  const shirt=find('cloth-shirt','sell'),uranium=find('uranium','sell'),chemfuel=find('chemfuel','buy');
  expect(shirt&&uranium&&chemfuel).toBeTruthy();
  const shirtId=shirt.pile.id,before=total(f.w.piles,'chemfuel');
  expect(execute(f,[{pileId:shirtId,quantity:-1},{pileId:uranium.pile.id,quantity:-20},{pileId:chemfuel.pile.id,quantity:10}]).ok).toBe(true);
  expect(f.w.piles.find(p=>p.id===shirtId)!.owner).toEqual({type:'orbital-ship',shipId:f.ship.id});
  // Orbital ships have no faction: no goodwill message.
  expect(f.w.events.some(e=>e.message.startsWith('Relations avec'))).toBe(false);
  expect(validateWorld(f.w)).toEqual([]);
  const saved=serializeWorld(f.w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);
  const delivery=f.w.orbital!.pending[0]!;f.w.tick=delivery.openAt;advanceOrbital(f.w);
  expect(f.w.piles.some(p=>p.item==='chemfuel'&&p.owner.type==='ground'&&p.quantity===10)).toBe(true);
  expect(total(f.w.piles,'chemfuel')).toBe(before);
  // Schema 337: the drafted negotiator cannot call the ship.
  const o=orbitalFixture('bulk');setVersion(o.w,337);
  expect(applyCommand(o.w,{type:'draft',pawnIds:[o.p.id],enabled:true}).ok).toBe(true);
  const refused=orderOrbitalTrade(o.w,o.p.id,o.ship.id,o.console.id);expect(refused.ok).toBe(false);expect(refused.reason).toMatch(/démobilisé/);
});

test('337 saves migrate by number only; 338 content is refused under the old number',()=>{
  const w=deconstructionCamp(2,32),current=serializeWorld(w);
  expect(serializeWorld(deserializeWorld(asOldSchema(current,337)))).toBe(current);
  // A bulk ship of 338 holds chemfuel and garments that a 337 ship could not.
  const f=orbitalFixture('bulk'),json=serializeWorld(f.w);
  expect(()=>deserializeWorld(asOldSchema(json,337))).toThrow();
});
