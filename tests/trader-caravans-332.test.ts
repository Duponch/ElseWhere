import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/index.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {ITEM_DEFINITIONS,type ItemId} from '../src/sim/items.ts';
import {quoteTrade,tradeGoods} from '../src/sim/trade-goods.ts';
import {tradeRefusal} from '../src/sim/trade-prices.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {tradingAtContact} from '../src/sim/trade-contact.ts';
import {advanceVisitors,arriveTraderCaravan332,enableVisitors,visitorMerchantLabel} from '../src/sim/visitors.ts';
import {consumeVisitorOpportunity,newVisitorAgenda,VISITOR_INTERVAL,VISITOR_YEAR,type HomeVisitorCalendar} from '../src/sim/visitor-state.ts';
import {validateVisitors} from '../src/sim/visitor-save.ts';
import {allyIncidentFraction332,caravanDealsIn332,caravanMaxGuardCost332,caravanSources332,chooseCaravanGuards332,drawCaravanTraderKind332,generateCaravanStock332,
  CARAVAN_GUARDS_332,CARAVAN_TRADER_KINDS_332,type CaravanTraderKind332} from '../src/sim/trader-caravans-332.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asMigratedFrom352,asOldSchema} from './scenarios/old-schema.ts';
import type {SettlementTile} from '../src/sim/world-settlement-placement.ts';
import {SCHEMA_VERSION,TICKS_PER_DAY,type MaterialPile,type World} from '../src/sim/types.ts';

const DAY=TICKS_PER_DAY;
const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const calendar=(w:World)=>w.visitors as HomeVisitorCalendar;
const total=(piles:readonly MaterialPile[],item:ItemId)=>piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
/** Declared fixture: a camp given the real default world faction registry
 * (the generator runs on a synthetic ring of tiles, as the 331 raid tests). */
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
/** Prepared clock (as the visitor trade fixture): the clock-bound counters a
 * played world keeps on its own tick follow the jump. */
function clock(w:World,tick:number):void {
  w.tick=tick;
  if(w.corePathBudget297)w.corePathBudget297.tick=tick;
  if(w.deterioration)w.deterioration.lastTick=tick;
}
/** Calls the calendar controller at each due opportunity only (no other system runs). */
function runCalendar(w:World,until:number):void {
  for(;;){
    const s=calendar(w),next=Math.min(...[s.traveler,s.visitor,s.exotic,s.caravan332].filter(a=>!!a).map(a=>a!.pending[0]!));
    if(next>until)return;clock(w,next);advanceVisitors(w);
  }
}
/** A free, standable ground cell near the colonists for a prepared pile. */
function freeCell(w:World,from:{x:number;z:number}):{x:number;z:number} {
  for(let r=1;r<10;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    const x=from.x+dx,z=from.z+dz;
    if(x<0||z<0||x>=w.width||z>=w.height||w.tiles[z*w.width+x]!.terrain!=='grass'||w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z)||w.pawns.some(p=>p.x===x&&p.z===z))continue;
    return {x,z};
  }
  throw Error('No free cell.');
}
const defOf=(w:World,id:number|null)=>w.worldFactions!.factions.find(f=>f.id===id)!.def;
const relation=(w:World,def:string)=>{const r=w.worldFactions!,id=r.factions.find(f=>f.def===def)!.id,p=r.playerFactionId;return r.relations.find(x=>x.aId===Math.min(id,p)&&x.bId===Math.max(id,p))!;};

test('the caravan agenda holds Cassandra\'s five yearly opportunities from day 5, six days apart',()=>{
  for(let seed=1;seed<=40;seed++){
    const a=newVisitorAgenda(seed,'caravan',0),hits:number[]=[];
    expect(a.pending).toHaveLength(5);
    for(let t=0;a.cycle<3;t+=VISITOR_INTERVAL)if(consumeVisitorOpportunity(a,'caravan',t))hits.push(t);
    expect(hits).toHaveLength(15);
    expect(hits[0]).toBeGreaterThanOrEqual(5*DAY);
    for(let i=0;i<hits.length;i++){
      expect(hits[i]!%VISITOR_INTERVAL).toBe(0);
      if(i)expect(hits[i]!-hits[i-1]!).toBeGreaterThanOrEqual(6*DAY);
      const cycle=Math.floor(i/5);
      expect(hits[i]).toBeGreaterThanOrEqual(5*DAY+cycle*VISITOR_YEAR);expect(hits[i]).toBeLessThanOrEqual(5*DAY+(cycle+1)*VISITOR_YEAR);
    }
  }
  // Its own salt: the other agendas are not shifted by the new one.
  expect(newVisitorAgenda(7,'caravan',0).rng).not.toBe(newVisitorAgenda(7,'visitor',0).rng);
});

test('non-hostile outlander and tribal factions send caravans; the kind follows Core commonality',()=>{
  const w=colony();
  expect(caravanSources332(w,1).map(s=>defOf(w,s.factionId)).sort()).toEqual(['OutlanderCivil','TribeCivil']);
  for(const s of caravanSources332(w,1))expect(s.family).toBe(defOf(w,s.factionId)==='OutlanderCivil'?'outlander':'tribe');
  // AllyIncidentFraction: 2 friendly of 4 that can be non-hostile, 0.5 -> 0.6+0.4/3.
  expect(allyIncidentFraction332(w)).toBeCloseTo(.6+.4*(.25/.75),10);
  relation(w,'TribeCivil').kind='hostile';
  expect(caravanSources332(w,1).map(s=>defOf(w,s.factionId))).toEqual(['OutlanderCivil']);
  relation(w,'OutlanderCivil').kind='hostile';
  expect(caravanSources332(w,1)).toEqual([]);expect(allyIncidentFraction332(w)).toBe(-1);
  // Commonality 1 each; the slaver scales with the population intent.
  const draws=(family:'outlander'|'tribe',intent:number)=>{const n=new Map<string,number>();for(let i=0;i<1200;i++){const k=drawCaravanTraderKind332(family,intent,()=>(i+.5)/1200)!;n.set(k,(n.get(k)??0)+1);}return n;};
  expect(draws('outlander',1)).toEqual(new Map([['outlander-bulk',300],['outlander-combat',300],['outlander-exotic',300],['outlander-slaver',300]]));
  expect(draws('tribe',.2).has('tribe-slaver')).toBe(false);
  expect(draws('tribe',2).get('tribe-slaver')).toBe(600);
  // Guards: Core ChoosePawnGenOptionsByPoints within the points and the faction curve.
  for(const family of ['outlander','tribe'] as const)for(let i=0;i<200;i++){
    let s=i*2654435761>>>0;const draw=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
    const points=505+i*2,guards=chooseCaravanGuards332(points,family,draw),spent=guards.reduce((n,g)=>n+CARAVAN_GUARDS_332[g].cost,0);
    expect(spent).toBeLessThanOrEqual(points);
    for(const g of guards){expect(CARAVAN_GUARDS_332[g].family).toBe(family);expect(CARAVAN_GUARDS_332[g].cost).toBeLessThanOrEqual(caravanMaxGuardCost332(family,points));}
    expect(points-spent).toBeLessThan(family==='outlander'?45:45);
    expect(guards.length+1).toBeLessThanOrEqual(24);
  }
});

test('caravan wares are only represented, buyable items in Core count ranges, carried in real stacks',()=>{
  for(const kind of Object.keys(CARAVAN_TRADER_KINDS_332) as CaravanTraderKind332[])for(let seed=1;seed<=40;seed++){
    const plan=generateCaravanStock332(seed,100,101,12000,kind);
    expect(plan).toEqual(generateCaravanStock332(seed,100,101,12000,kind));
    expect(new Set(plan.piles.map(p=>p.id)).size).toBe(plan.piles.length);
    expect(plan.nextId).toBe(101+plan.piles.length);
    expect(total(plan.piles,'silver')).toBeGreaterThanOrEqual(750);expect(total(plan.piles,'silver')).toBeLessThanOrEqual(1200);
    for(const pile of plan.piles){
      expect(Object.hasOwn(ITEM_DEFINITIONS,pile.item)).toBe(true);
      expect(tradeCatalogueEntry(pile.item)?.playerCanBuy).toBe(true);
      expect(pile.quantity).toBeGreaterThan(0);expect(pile.quantity).toBeLessThanOrEqual(ITEM_DEFINITIONS[pile.item].stackLimit);
      expect(pile.owner).toEqual({type:'inventory',pawnId:100});
      expect(tradeRefusal(pile,'buy',12000,undefined,'visitor',SCHEMA_VERSION,caravanDealsIn332(kind))).toBeUndefined();
    }
  }
  const sum=(kind:CaravanTraderKind332,item:ItemId)=>Array.from({length:40},(_,i)=>total(generateCaravanStock332(i+1,100,101,0,kind).piles,item));
  for(const n of sum('outlander-bulk','steel')){expect(n).toBeGreaterThanOrEqual(250);expect(n).toBeLessThanOrEqual(400);}
  for(const n of sum('outlander-bulk','component')){expect(n).toBeGreaterThanOrEqual(30);expect(n).toBeLessThanOrEqual(40);}
  for(const n of sum('outlander-exotic','gold')){expect(n).toBeGreaterThanOrEqual(40);expect(n).toBeLessThanOrEqual(80);}
  for(const n of sum('outlander-exotic','advanced-component')){expect(n).toBeGreaterThanOrEqual(1);expect(n).toBeLessThanOrEqual(4);}
  for(const n of sum('tribe-bulk','pemmican')){expect(n).toBeGreaterThanOrEqual(250);expect(n).toBeLessThanOrEqual(300);}
  for(const n of sum('tribe-shaman','plasteel')){expect(n).toBeGreaterThanOrEqual(50);expect(n).toBeLessThanOrEqual(150);}
  // Beer by total price -100~100 at 12 silver: never more than 8 bottles, often none.
  const beer=sum('outlander-bulk','beer');expect(Math.max(...beer)).toBeLessThanOrEqual(8);expect(beer.some(n=>n===0)).toBe(true);
  // Ranged wares come from the delivered guns and bows only.
  const guns=new Set(Array.from({length:40},(_,i)=>generateCaravanStock332(i+1,100,101,0,'outlander-combat').piles.filter(p=>p.kind==='weapon').map(p=>p.item)).flat());
  expect(guns.size).toBeGreaterThan(1);
  const bows=new Set(Array.from({length:40},(_,i)=>generateCaravanStock332(i+1,100,101,0,'tribe-war').piles.filter(p=>p.kind==='weapon').map(p=>p.item)).flat());
  for(const b of bows)expect(['short-bow','recurve-bow','greatbow']).toContain(b);
  // A caravan buys back what it sells; an ordinary visitor still refuses steel.
  const steel:MaterialPile={id:1,kind:'steel',item:'steel',quantity:5,owner:{type:'ground',x:0,z:0}};
  expect(tradeRefusal(steel,'sell',0,undefined,'visitor',SCHEMA_VERSION,caravanDealsIn332('outlander-bulk'))).toBeUndefined();
  expect(tradeRefusal(steel,'sell',0,undefined,'visitor',SCHEMA_VERSION)).toBeTruthy();
});

test('a caravan arrives, trades through the visitor trade, reloads mid-visit and leaves with what it still has',()=>{
  // Old local world without a faction registry: the implicit outlander source.
  const w=deconstructionCamp(2,48);enableVisitors(w);
  expect(calendar(w).caravan332).toBeDefined();
  let group=calendar(w).groups.find(g=>g.caravan332);
  for(let k=0;k<20&&!group;k++){clock(w,calendar(w).caravan332!.pending[0]!);advanceVisitors(w);group=calendar(w).groups.find(g=>g.caravan332);}
  expect(group).toBeDefined();
  const caravan=group!.caravan332!,members=w.pawns.filter(p=>p.visitor?.group===group!.id),trader=members.find(p=>p.visitor!.role==='trader')!;
  expect(caravan.factionId).toBeNull();expect(caravan.traderKind.startsWith('outlander-')).toBe(true);
  expect(members.length).toBeGreaterThanOrEqual(8);
  expect(members.every(p=>p.faction==='outlanders'&&!p.worldAffiliation259)).toBe(true);
  expect(members.filter(p=>p.visitor!.role==='trader')).toHaveLength(1);
  expect(members.every(p=>w.piles.some(i=>i.owner.type==='equipment'&&i.owner.pawnId===p.id))).toBe(true);
  expect(group!.durationCore).toBeGreaterThanOrEqual(27000);expect(group!.durationCore).toBeLessThan(45000);
  expect(trader.name).toMatch(/^Marchand/);
  expect(visitorMerchantLabel(w,trader)).toContain(CARAVAN_TRADER_KINDS_332[caravan.traderKind].label);
  expect(w.events.some(e=>e.message.startsWith('Caravane commerciale'))).toBe(true);
  expect(validateWorld(w)).toEqual([]);

  // Trade at contact: buy one ware, sell two components; silver and goods are conserved.
  const negotiator=w.pawns.find(p=>!p.visitor)!;
  expect(applyCommand(w,{type:'area',action:'home',from:{x:0,z:0},to:{x:w.width-1,z:w.height-1}}).ok).toBe(true);
  addMaterial(w,'silver',500,{type:'ground',...freeCell(w,negotiator)},'silver');
  addMaterial(w,'component',4,{type:'ground',...freeCell(w,negotiator)},'component');
  const caravanSilver=total(w.piles.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===trader.id),'silver');
  expect(applyCommand(w,{type:'order-trade',pawnId:negotiator.id,traderId:trader.id}).ok).toBe(true);
  for(let i=0;i<3000&&!tradingAtContact(w,negotiator,trader);i++)stepWorld(w);
  expect(tradingAtContact(w,negotiator,trader)).toBe(true);
  const stock=tradeGoods(w,negotiator,trader),buy=stock.goods.find(g=>g.side==='buy'&&!g.refusal&&g.unitPrice<=300)!,sell=stock.goods.find(g=>g.side==='sell'&&g.pile.item==='component'&&!g.refusal)!;
  expect(buy).toBeDefined();expect(sell).toBeDefined();
  const bought=buy.pile.item,watched:ItemId[]=['silver','component',bought];
  const before=Object.fromEntries(watched.map(i=>[i,total(w.piles,i)]));
  const lines=[{pileId:buy.pile.id,quantity:1},{pileId:sell.pile.id,quantity:-2}],quote=quoteTrade(w,negotiator.id,trader.id,lines);
  expect(quote.ok).toBe(true);if(!quote.ok)throw Error(quote.reason);
  expect(applyCommand(w,{type:'trade-execute',pawnId:negotiator.id,traderId:trader.id,lines,quote:quote.signature,acceptShortfall:true}).ok).toBe(true);
  for(const i of watched)expect(total(w.piles,i)).toBe(before[i]);
  expect(total(w.piles.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===trader.id),'component')).toBeGreaterThanOrEqual(2);
  expect(validateWorld(w)).toEqual([]);

  // Mid-visit save: strictly equal after reload.
  const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);

  // The halt ends (Core 27000-45000 ticks), the caravan walks out with its wares.
  // Silver of the colony (ground or colonists) plus the caravan's is conserved;
  // other visitors who may come meanwhile carry their own.
  const ownSilver=(owner:MaterialPile['owner'])=>owner.type==='ground'||'pawnId' in owner&&(caravanIds.has(owner.pawnId)||!!w.pawns.find(q=>q.id===owner.pawnId&&!q.visitor));
  const caravanIds=new Set(members.map(p=>p.id)),silverNow=()=>total(w.piles.filter(p=>ownSilver(p.owner)),'silver');
  expect(silverNow()).toBe(500+caravanSilver);
  const id=group!.id,startSilver=silverNow();
  for(let i=0;i<20000&&calendar(w).groups.some(g=>g.id===id);i++)stepWorld(w);
  expect(calendar(w).groups.some(g=>g.id===id)).toBe(false);
  const gone=calendar(w).departed.filter(d=>d.group===id);
  expect(gone.length).toBe(members.length);
  const leftWith=gone.flatMap(d=>d.items);
  expect(silverNow()+total(leftWith,'silver')).toBe(startSilver);
  expect(total(leftWith.filter(p=>p.owner.type==='inventory'),'component')).toBeGreaterThanOrEqual(2);
  expect(w.events.some(e=>e.message.includes('La caravane commerciale'))).toBe(true);
  expect(validateWorld(w)).toEqual([]);
  const after=serializeWorld(w);expect(serializeWorld(deserializeWorld(after))).toBe(after);
},600000);

test('331 saves adopt the caravan agenda by number only; older schemas never draw a caravan',()=>{
  // A current world created on day 20: the 331 relabel migrates to the same save.
  const w=deconstructionCamp(2,32);clock(w,20*DAY);enableVisitors(w);
  const current=serializeWorld(w),agenda=calendar(w).caravan332!;
  expect(agenda.pending.every(t=>t>w.tick&&t>=5*DAY)).toBe(true);
  expect(serializeWorld(deserializeWorld(asOldSchema(current,331)))).toBe(asMigratedFrom352(current));
  // A 331 save cannot hold the agenda.
  const raw=JSON.parse(current) as {schemaVersion:number};raw.schemaVersion=331;
  expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow();
  expect(validateVisitors(w,331,new Set())).toContain('Invalid visitor calendar.');
  // Migration day: every adopted opportunity is in the future, none fires at load.
  const loaded=deserializeWorld(asOldSchema(current,331));
  expect(calendar(loaded).caravan332!.pending.every(t=>t>loaded.tick)).toBe(true);
  expect(calendar(loaded).groups).toEqual([]);

  // Schema 331 in memory: visitors and the exotic merchant, never a caravan.
  const old=colony(32);setVersion(old,331);enableVisitors(old);
  expect(calendar(old).caravan332).toBeUndefined();
  runCalendar(old,130*DAY);
  expect(calendar(old).groups.some(g=>g.caravan332)).toBe(false);
  expect(old.pawns.some(p=>p.visitor?.merchantKind==='exotic')).toBe(true);
  // Schema 332: the home-grown exotic merchant no longer comes, caravans do.
  const now=colony(32);enableVisitors(now);
  runCalendar(now,130*DAY);
  expect(now.pawns.some(p=>p.visitor?.merchantKind==='exotic')).toBe(false);
  expect(calendar(now).groups.some(g=>g.caravan332)).toBe(true);
  expect(calendar(now).exotic!.cycle).toBeGreaterThanOrEqual(2);
},120_000);

// Les Éclaircies: a real geographic Cassandra colony (schema 263) with its world factions.
const ECLAIRCIES='public/test-saves/v419/les-eclaircies.json';
test('on a real campaign the agenda is adopted at load and a faction caravan round-trips mid-visit',()=>{
  const w=deserializeWorld(readFileSync(ECLAIRCIES,'utf8')),pristine=serializeWorld(w);
  const agenda=calendar(w).caravan332!;
  expect(agenda.pending.length).toBeGreaterThan(0);
  expect(agenda.pending.every(t=>t>w.tick&&t>=5*DAY)).toBe(true);
  expect(serializeWorld(deserializeWorld(asOldSchema(pristine,331)))).toBe(pristine);
  // Prepared opportunity: the producer is called at the current tick (day 0.3,
  // before Cassandra's first window), stepping one tick per refused draw.
  const before=new Set(w.pawns.map(p=>p.id));
  for(let i=0;i<40&&!arriveTraderCaravan332(w);i++)stepWorld(w);
  const group=calendar(w).groups.find(g=>g.caravan332)!;
  expect(group).toBeDefined();
  const caravan=group.caravan332!,members=w.pawns.filter(p=>p.visitor?.group===group.id);
  expect(members.every(p=>!before.has(p.id)&&p.worldAffiliation259?.factionId===caravan.factionId)).toBe(true);
  const def=defOf(w,caravan.factionId);
  expect(caravan.traderKind.startsWith(def.startsWith('Tribe')?'tribe-':'outlander-')).toBe(true);
  expect(relation(w,def).kind).not.toBe('hostile');
  const trader=members.find(p=>p.visitor!.role==='trader')!,family=def.startsWith('Tribe')?'cloth-tribalwear':'cloth-shirt';
  expect(w.piles.find(i=>i.owner.type==='apparel'&&i.owner.pawnId===trader.id)!.item).toBe(family);
  expect(validateWorld(w)).toEqual([]);
  const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);
  for(let i=0;i<300;i++)stepWorld(w);
  expect(validateWorld(w)).toEqual([]);
  const later=serializeWorld(w);expect(serializeWorld(deserializeWorld(later))).toBe(later);
  // A 331 save cannot hold a caravan group.
  expect(()=>deserializeWorld(asOldSchema(later,331))).toThrow();
},600_000);
