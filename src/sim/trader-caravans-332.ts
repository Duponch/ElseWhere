import {freshRot} from './food-preservation.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {APPAREL} from './apparel-definitions.ts';
import {tradeCatalogueEntry} from './trade-catalogue.ts';
import {curve320} from './population-intent-320.ts';
import {isIedSchema357,mortarShellStock357,SHELL_ITEMS_357} from './ied-traps-357.ts';
import {WORLD_FACTION_DEFINITIONS_256,type WorldFactionDef256} from './world-faction-catalog.ts';
import {integer,random,select,traderQuality,visitorClothingStuff314,visitorClothingFamily,VISITOR_CLOTHING_POOL,
  VISITOR_RANGED_ITEMS322,VISITOR_RANGED_ITEMS326,VISITOR_RANGED_ITEMS340,VISITOR_RANGED_ITEMS342,VISITOR_RANGED_POOL,VISITOR_SHORT_BOW_INDEX316,type VisitorStockPlan} from './trade-stock.ts';
import type {WeaponQuality,WeaponItem} from './equipment-rules.ts';
import type {ApparelItem} from './apparel-definitions.ts';
import type {MaterialPile,World} from './types.ts';

/** Schema 332: Core trader caravans (Cassandra StorytellerComp_FactionInteraction,
 * incident TraderCaravanArrival). Facts read from Core 1.6 Storytellers.xml,
 * Factions_Misc.xml, TraderKinds_Caravan_Outlander/Neolithic.xml,
 * PawnKinds_Outlander/Tribal/Mercenary.xml and the decompiled
 * IncidentWorker_TraderCaravanArrival, IncidentWorker_NeutralGroup,
 * PawnGroupKindWorker_Trader, TraderCaravanUtility, LordJob_TradeWithColony
 * and StorytellerUtility.AllyIncidentFraction (facts only, nothing copied). */
export const TRADER_CARAVAN_SCHEMA_332=332;
export type CaravanFamily332='outlander'|'tribe';
export type CaravanTraderKind332='outlander-bulk'|'outlander-combat'|'outlander-exotic'|'outlander-slaver'|'tribe-bulk'|'tribe-war'|'tribe-slaver'|'tribe-shaman';
/** The group-level record of an arrived caravan; the trader is its role-trader member. */
export interface TraderCaravan332 {traderKind:CaravanTraderKind332;factionId:number|null}

/** A represented Core stock generator. `single` is StockGenerator_SingleDef
 * with countRange, `price` the same with totalPriceRange (count = price over
 * the base value, rounded), `ranged`/`clothing` StockGenerator_MarketValue over
 * the given indices of the visitor pools (unsupported Core defs keep their
 * weight and simply yield nothing). Category, Tag, techprint, slave, animal,
 * book and barrel generators have no represented item and are left out. */
type StockGenerator332={kind:'single';item:ItemId;min:number;max:number}|{kind:'price';item:ItemId;min:number;max:number}
  |{kind:'ranged';count:number;pool:readonly number[]}|{kind:'clothing';count:number;pool:readonly number[]}
  /** Schema 357: StockGenerator_Tag MortarShell (thingDefCountRange, countRange). */
  |{kind:'mortar-shells';defs:readonly [number,number];count:readonly [number,number]};
interface CaravanKindDefinition332 {core:string;family:CaravanFamily332;label:string;slaver:boolean;stock:readonly StockGenerator332[]}
const single=(item:ItemId,min:number,max:number):StockGenerator332=>({kind:'single',item,min,max});
const ALL_RANGED=Object.freeze(VISITOR_RANGED_POOL.map((_,i)=>i));
/** Core RangedNeolithic order: Bow_Short, Pila (absent), Bow_Recurve, Bow_Great. */
const NEOLITHIC_RANGED=Object.freeze([19,20,21,22]);
export const ALL_CLOTHING=Object.freeze(VISITOR_CLOTHING_POOL.map((_,i)=>i));
/** BasicClothing tag (the Sellable tribal wear is never generated): cowboy and
 * bowler hats, tribal headdress, tuque, war mask, war veil, hood, parka, pants,
 * T-shirt, button-down shirt, duster, jacket, robe. */
export const BASIC_CLOTHING=Object.freeze([0,1,2,3,4,5,8,12,13,14,15,16,17,21]);
/** maxTechLevelGenerate Neolithic: tribal headdress, war mask, war veil, parka;
 * the Clothing tag adds the cloth mask. */
const NEOLITHIC_BASIC_CLOTHING=Object.freeze([2,4,5,12]);
const NEOLITHIC_CLOTHING=Object.freeze([2,4,5,9,12]);
export const CARAVAN_TRADER_KINDS_332:Readonly<Record<CaravanTraderKind332,CaravanKindDefinition332>>=Object.freeze({
  'outlander-bulk':{core:'Caravan_Outlander_BulkGoods',family:'outlander',label:'marchand en gros',slaver:false,stock:[
    single('silver',750,1200),single('component',30,40),single('advanced-component',-10,2),single('steel',250,400),single('cloth',250,400),
    single('neutroamine',70,160),{kind:'price',item:'beer',min:-100,max:100},{kind:'clothing',count:7,pool:BASIC_CLOTHING},{kind:'clothing',count:3,pool:ALL_CLOTHING}]},
  'outlander-combat':{core:'Caravan_Outlander_CombatSupplier',family:'outlander',label:'fournisseur militaire',slaver:false,stock:[
    single('silver',750,1200),single('medicine',10,20),{kind:'ranged',count:5,pool:ALL_RANGED},{kind:'mortar-shells',defs:[1,2],count:[3,15]}]},
  'outlander-exotic':{core:'Caravan_Outlander_Exotic',family:'outlander',label:'marchand d’objets exotiques',slaver:false,stock:[
    single('silver',750,1200),single('component',6,20),single('advanced-component',1,4),single('plasteel',50,150),single('gold',40,80),single('glitterworld-medicine',2,8)]},
  'outlander-slaver':{core:'Caravan_Outlander_PirateMerchant',family:'outlander',label:'marchand d’esclaves',slaver:true,stock:[
    single('silver',750,1200),single('medicine',2,5),{kind:'mortar-shells',defs:[-1,2],count:[1,10]}]},
  'tribe-bulk':{core:'Caravan_Neolithic_BulkGoods',family:'tribe',label:'marchand en gros',slaver:false,stock:[
    single('silver',750,1200),single('wood',100,350),single('cloth',100,350),single('pemmican',250,300),single('herbal-medicine',0,10),
    {kind:'clothing',count:7,pool:NEOLITHIC_BASIC_CLOTHING},{kind:'clothing',count:3,pool:NEOLITHIC_CLOTHING}]},
  'tribe-war':{core:'Caravan_Neolithic_WarMerchant',family:'tribe',label:'marchand de guerre',slaver:false,stock:[
    single('silver',750,1200),single('pemmican',150,300),single('herbal-medicine',15,30),{kind:'ranged',count:4,pool:NEOLITHIC_RANGED},
    {kind:'clothing',count:7,pool:NEOLITHIC_BASIC_CLOTHING},{kind:'clothing',count:3,pool:NEOLITHIC_CLOTHING}]},
  'tribe-slaver':{core:'Caravan_Neolithic_Slaver',family:'tribe',label:'marchand d’esclaves',slaver:true,stock:[
    single('silver',750,1200),single('pemmican',150,300),single('herbal-medicine',10,20)]},
  // The Neolithic Medicine category holds only herbal medicine (count 1-2).
  'tribe-shaman':{core:'Caravan_Neolithic_ShamanMerchant',family:'tribe',label:'marchand chamane',slaver:false,stock:[
    single('silver',750,1200),single('pemmican',150,300),single('plasteel',50,150),single('gold',30,60),single('neutroamine',25,100),single('herbal-medicine',1,2)]},
});
export const isCaravanTraderKind332=(v:unknown):v is CaravanTraderKind332=>typeof v==='string'&&Object.hasOwn(CARAVAN_TRADER_KINDS_332,v);
/** Core caravanTraderKinds: the outlander and tribal bases (the savage tribe
 * inherits them but is a permanent enemy). Pirates have none. */
export const CARAVAN_FAMILY_BY_DEF_332:Readonly<Partial<Record<WorldFactionDef256,CaravanFamily332>>>=Object.freeze({
  OutlanderCivil:'outlander',OutlanderRough:'outlander',TribeCivil:'tribe',TribeRough:'tribe',TribeSavage:'tribe',
});
/** Slaver commonalityMultFromPopulationIntent (0.2,0) (1,1) (2,3); others 1. */
const SLAVER_CURVE=[[.2,0],[1,1],[2,3]] as const;
export const caravanKindCommonality332=(kind:CaravanTraderKind332,populationIntent:number):number=>CARAVAN_TRADER_KINDS_332[kind].slaver?curve320(populationIntent,SLAVER_CURVE):1;
export function drawCaravanTraderKind332(family:CaravanFamily332,populationIntent:number,draw:()=>number):CaravanTraderKind332|null {
  const kinds=(Object.keys(CARAVAN_TRADER_KINDS_332) as CaravanTraderKind332[]).filter(k=>CARAVAN_TRADER_KINDS_332[k].family===family);
  const weights=kinds.map(k=>caravanKindCommonality332(k,populationIntent)),total=weights.reduce((n,x)=>n+x,0);
  if(!(total>0))return null;
  let ticket=draw()*total;
  for(let i=0;i<kinds.length;i++){if(weights[i]!<=0)continue;ticket-=weights[i]!;if(ticket<0)return kinds[i]!;}
  return kinds.filter((_,i)=>weights[i]!>0).at(-1)!;
}

/** Trader pawn group makers. Traders: Town_Trader (45, Gun) and Tribal_Trader
 * (60, child of Tribal_Hunter). Guards: Villager 3/45, Town_Guard 10/60,
 * Mercenary_Gunner 10/85; Tribal_Warrior 7/50, Tribal_Archer 10/45,
 * Tribal_Hunter 10/60, Tribal_HeavyArcher 10/75, Tribal_Berserker 7/65.
 * Left out as in the schema 331 raids: Grenadier_Destructive (70, grenades),
 * Mercenary_Slasher (140, shield belt) and Mercenary_Elite (130); the last two
 * already exceed the maximum pawn cost of every guard budget. Weapons follow
 * the schema 331 adaptations (Gun: revolver, rifle or shotgun). */
export type CaravanGuardKind332='villager'|'town-guard'|'mercenary-gunner'|'tribal-warrior'|'tribal-archer'|'tribal-hunter'|'tribal-heavy-archer'|'tribal-berserker';
interface CaravanPawnKind332 {core:string;cost:number;weapon:WeaponItem;label:string}
export const CARAVAN_GUARDS_332:Readonly<Record<CaravanGuardKind332,CaravanPawnKind332&{family:CaravanFamily332;weight:number}>>=Object.freeze({
  'villager':{core:'Villager',family:'outlander',cost:45,weight:3,weapon:'revolver',label:'Villageois'},
  'town-guard':{core:'Town_Guard',family:'outlander',cost:60,weight:10,weapon:'bolt-action-rifle',label:'Garde'},
  'mercenary-gunner':{core:'Mercenary_Gunner',family:'outlander',cost:85,weight:10,weapon:'pump-shotgun',label:'Mercenaire'},
  'tribal-warrior':{core:'Tribal_Warrior',family:'tribe',cost:50,weight:7,weapon:'steel-mace',label:'Guerrier'},
  'tribal-archer':{core:'Tribal_Archer',family:'tribe',cost:45,weight:10,weapon:'short-bow',label:'Archer'},
  'tribal-hunter':{core:'Tribal_Hunter',family:'tribe',cost:60,weight:10,weapon:'recurve-bow',label:'Chasseur'},
  'tribal-heavy-archer':{core:'Tribal_HeavyArcher',family:'tribe',cost:75,weight:10,weapon:'greatbow',label:'Archer lourd'},
  'tribal-berserker':{core:'Tribal_Berserker',family:'tribe',cost:65,weight:7,weapon:'steel-spear',label:'Berserker'},
});
export const CARAVAN_TRADERS_332:Readonly<Record<CaravanFamily332,CaravanPawnKind332&{apparel:ApparelItem}>>=Object.freeze({
  outlander:{core:'Town_Trader',cost:45,weapon:'revolver',label:'Marchand',apparel:'cloth-shirt'},
  tribe:{core:'Tribal_Trader',cost:60,weapon:'recurve-bow',label:'Marchand',apparel:'cloth-tribalwear'},
});
/** Tribal members wear tribal wear, outlanders a shirt (as the schema 331 raiders). */
export const caravanApparel332=(family:CaravanFamily332):ApparelItem=>CARAVAN_TRADERS_332[family].apparel;
/** Core maxPawnCostPerTotalPointsCurve of the outlander and tribal factions.
 * The Trader group needs no minimum points, so the curve is not floored. */
const MAX_PAWN_COST:Readonly<Record<CaravanFamily332,readonly (readonly [number,number])[]>>=Object.freeze({
  outlander:[[0,35],[70,50],[700,100],[1300,150],[100000,10000]],
  tribe:[[0,35],[70,50],[800,100],[1300,150],[100000,10000]],
});
export const caravanMaxGuardCost332=(family:CaravanFamily332,points:number):number=>curve320(points,MAX_PAWN_COST[family]);
/** TraderCaravanUtility.GenerateGuardPoints: Rand.Range(550,1000). */
export const caravanGuardPoints332=(draw:()=>number):number=>550+450*draw();
/** ChoosePawnGenOptionsByPoints over the guards: weighted options within the
 * points left and the maximum pawn cost, until none fits. No guard is a
 * faction leader; the cost-fraction weight factor stays 1 for these costs. */
export function chooseCaravanGuards332(points:number,family:CaravanFamily332,draw:()=>number):CaravanGuardKind332[] {
  if(!Number.isFinite(points)||points>10000)throw new RangeError('Invalid caravan guard points.');
  const options=(Object.keys(CARAVAN_GUARDS_332) as CaravanGuardKind332[]).filter(k=>CARAVAN_GUARDS_332[k].family===family);
  const maxCost=caravanMaxGuardCost332(family,points),out:CaravanGuardKind332[]=[];let remaining=points;
  for(;;){
    const eligible=options.filter(k=>CARAVAN_GUARDS_332[k].cost<=remaining&&CARAVAN_GUARDS_332[k].cost<=maxCost);
    if(!eligible.length)break;
    let ticket=draw()*eligible.reduce((n,k)=>n+CARAVAN_GUARDS_332[k].weight,0),chosen=eligible.at(-1)!;
    for(const k of eligible){ticket-=CARAVAN_GUARDS_332[k].weight;if(ticket<0){chosen=k;break;}}
    out.push(chosen);remaining-=CARAVAN_GUARDS_332[chosen].cost;
  }
  return out;
}
/** Hard bound of a caravan group: the trader and at most 955 / 45 guards. */
export const CARAVAN_MAX_MEMBERS_332=24;

const relationTo=(w:Pick<World,'worldFactions'>,factionId:number)=>{
  const r=w.worldFactions!,player=r.playerFactionId;
  return r.relations.find(x=>x.aId===Math.min(factionId,player)&&x.bId===Math.max(factionId,player));
};
/** StorytellerUtility.AllyIncidentFraction(fullAlliesOnly false): visible,
 * non-player, non-temporary factions; the share that is not hostile, over
 * those that can ever be non-hostile, through the curve (0.25,0.6)-(1,1);
 * -1 (no caravan) when none is non-hostile. Without a faction registry (old
 * local worlds) the single implicit outlander source counts as 1. */
export function allyIncidentFraction332(w:Pick<World,'worldFactions'>):number {
  const r=w.worldFactions;if(!r)return 1;
  let friendly=0,possible=0;
  for(const f of r.factions){
    if(f.hidden||f.id===r.playerFactionId||f.lifecycle259?.temporary)continue;
    if(!WORLD_FACTION_DEFINITIONS_256[f.def].permanentEnemy)possible++;
    const kind=relationTo(w,f.id)?.kind;if(kind&&kind!=='hostile')friendly++;
  }
  if(!friendly)return -1;
  return curve320(friendly/Math.max(possible,1),[[.25,.6],[1,1]]);
}
export interface CaravanSource332 {factionId:number|null;family:CaravanFamily332}
/** IncidentWorker_TraderCaravanArrival.FactionCanBeGroupSource: a visible,
 * non-player, not defeated nor temporary faction, not hostile to the player,
 * with caravan trader kinds of positive commonality. The arrival temperature
 * range (-40 to 45 for all of them) only orders a first pass that the
 * desperate second pass repeats without it, so it never changes the choice. */
export function caravanSources332(w:Pick<World,'worldFactions'>,populationIntent:number):CaravanSource332[] {
  const r=w.worldFactions;if(!r)return [{factionId:null,family:'outlander'}];
  const out:CaravanSource332[]=[];
  for(const f of r.factions){
    const family=CARAVAN_FAMILY_BY_DEF_332[f.def];
    if(!family||f.hidden||f.id===r.playerFactionId||f.lifecycle259?.defeated||f.lifecycle259?.temporary)continue;
    const kind=relationTo(w,f.id)?.kind;if(!kind||kind==='hostile')continue;
    if((Object.keys(CARAVAN_TRADER_KINDS_332) as CaravanTraderKind332[]).some(k=>CARAVAN_TRADER_KINDS_332[k].family===family&&caravanKindCommonality332(k,populationIntent)>0))out.push({factionId:f.id,family});
  }
  return out;
}
/** TryRandomElement: a uniform choice. */
export function drawCaravanSource332(w:Pick<World,'worldFactions'>,populationIntent:number,draw:()=>number):CaravanSource332|null {
  const sources=caravanSources332(w,populationIntent);
  return sources.length?sources[Math.min(sources.length-1,Math.floor(draw()*sources.length))]!:null;
}

/** Mathf.RoundToInt (to even on halves). */
const roundToInt=(n:number):number=>{const lo=Math.floor(n),part=n-lo;return part===.5?lo+(Math.abs(lo)%2):Math.round(n);};
/** Schema 340 adds the autopistol and machine pistol entries, 342 the five
 * gas-operated and precision guns (same draws). */
const rangedItem=(index:number,version=342):ItemId|undefined=>VISITOR_RANGED_POOL[index]?.item??(index===VISITOR_SHORT_BOW_INDEX316?'short-bow':VISITOR_RANGED_ITEMS322[index]??VISITOR_RANGED_ITEMS326[index]??(version>=340?VISITOR_RANGED_ITEMS340[index]??(version>=342?VISITOR_RANGED_ITEMS342[index]:undefined):undefined));
/** Pure pre-plan of a caravan trader's wares, committed only with a real
 * arrival. Every represented generator of the Core kind runs in its order;
 * large counts become real stacks. Private PRNG, Core distributions. */
export function generateCaravanStock332(seed:number,pawnId:number,nextId:number,tick:number,kind:CaravanTraderKind332,version=342):VisitorStockPlan {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isSafeInteger(pawnId)||pawnId<=0||!Number.isSafeInteger(nextId)||nextId<=0||!Number.isSafeInteger(tick)||tick<0||!isCaravanTraderKind332(kind))throw new RangeError('Invalid caravan stock planning input.');
  const state={rng:seed||1},piles:MaterialPile[]=[];
  const add=(item:ItemId,quantity:number,quality?:WeaponQuality)=>{
    const definition=ITEM_DEFINITIONS[item];
    while(quantity>0){
      if(!Number.isSafeInteger(nextId+1))throw new RangeError('Caravan stock identity overflow.');
      const part=Math.min(quantity,definition.stackLimit),pile:MaterialPile={id:nextId++,kind:definition.kind,item,quantity:part,owner:{type:'inventory',pawnId},...freshRot(item,tick)};
      if(quality){const condition={quality,hitPoints:tradeCatalogueEntry(item)!.maxHitPoints};if(definition.kind==='weapon')pile.weapon=condition;else pile.apparel={...condition,material:APPAREL[item as keyof typeof APPAREL].material,corpseWear284:false};}
      piles.push(pile);quantity-=part;
    }
  };
  for(const g of CARAVAN_TRADER_KINDS_332[kind].stock){
    if(g.kind==='single'){const n=integer(state,g.min,g.max);if(n>0)add(g.item,n);continue;}
    if(g.kind==='price'){const n=roundToInt((g.min+(g.max-g.min)*random(state))/tradeCatalogueEntry(g.item)!.baseMarketValue);if(n>0)add(g.item,n);continue;}
    // Schema 357: the shells draw on a sub-stream forked from this point, so
    // the caravan's later wares, guards and RNG continue exactly as before.
    if(g.kind==='mortar-shells'){if(isIedSchema357(version)){const fork={rng:((state.rng^0x5e115357)>>>0)||1};
      for(const s of mortarShellStock357({integer:(min,max)=>integer(fork,min,max),random:()=>random(fork)},g.defs,g.count))add(s.item,s.quantity);}continue;}
    const pool=(g.kind==='ranged'?g.pool.map(i=>VISITOR_RANGED_POOL[i]!):g.pool.map(i=>VISITOR_CLOTHING_POOL[i]!));
    for(let i=0;i<g.count;i++){
      const candidate=select(state,pool);
      if(g.kind==='ranged'){
        const quality=traderQuality(state),item=rangedItem(VISITOR_RANGED_POOL.indexOf(candidate),version);
        if(item)add(item,1,quality);
      }else{
        const roll=random(state),quality=traderQuality(state),family=visitorClothingFamily(VISITOR_CLOTHING_POOL.indexOf(candidate),version);
        const material=family?visitorClothingStuff314(roll,family==='tuque'):undefined;
        if(family&&material)add(`${material}-${family}` as ItemId,1,quality);
      }
    }
  }
  return {piles,nextId,rng:state.rng};
}
/** Items the kind's represented generators sell, hence also buy back (Core
 * StockGenerator.HandlesThingDef). Garments already pass the visitor rules. */
const DEALS=new Map<CaravanTraderKind332,ReadonlySet<ItemId>>();
export function caravanDealsIn332(kind:CaravanTraderKind332):ReadonlySet<ItemId> {
  let set=DEALS.get(kind);if(set)return set;
  const items=new Set<ItemId>();
  for(const g of CARAVAN_TRADER_KINDS_332[kind].stock){
    if(g.kind==='single'||g.kind==='price')items.add(g.item);
    else if(g.kind==='ranged')for(const i of g.pool){const item=rangedItem(i);if(item)items.add(item);}
    else if(g.kind==='mortar-shells')for(const item of SHELL_ITEMS_357)items.add(item);
  }
  set=Object.freeze(items) as ReadonlySet<ItemId>;DEALS.set(kind,set);return set;
}
/** Private stream of one caravan opportunity: the visitor business RNG and
 * every other stream stay untouched. */
export const caravanSeed332=(seed:number,tick:number,serial:number):number=>((seed^Math.imul(tick,0x2c1b3c6d)^Math.imul(serial+1,0x297a2d39)^0x7ca2a332)>>>0)||1;
/** Core LordJob_TradeWithColony: Trigger_TicksPassed(Rand.Range(27000,45000)) after arrival. */
export const CARAVAN_STAY_MIN_CORE_332=27000,CARAVAN_STAY_MAX_CORE_332=45000;
export const caravanStayCore332=(draw:()=>number):number=>CARAVAN_STAY_MIN_CORE_332+Math.floor(draw()*(CARAVAN_STAY_MAX_CORE_332-CARAVAN_STAY_MIN_CORE_332));

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
/** The group record: exactly its two fields, a known kind and, with a faction
 * registry, an existing faction of the kind's family (null without one). */
export function validTraderCaravan332(value:unknown,w:Pick<World,'worldFactions'>):value is TraderCaravan332 {
  if(!record(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'traderKind')||!Object.hasOwn(value,'factionId')||!isCaravanTraderKind332(value.traderKind))return false;
  const family=CARAVAN_TRADER_KINDS_332[value.traderKind].family;
  if(!w.worldFactions)return value.factionId===null;
  const id=value.factionId;
  return typeof id==='number'&&Number.isSafeInteger(id)&&w.worldFactions.factions.some(f=>f.id===id&&CARAVAN_FAMILY_BY_DEF_332[f.def]===family);
}
/** French display: "marchand en gros (Union X)". */
export function caravanLabel332(w:Pick<World,'worldFactions'>,c:TraderCaravan332):string {
  const name=c.factionId===null?undefined:w.worldFactions?.factions.find(f=>f.id===c.factionId)?.name;
  return `${CARAVAN_TRADER_KINDS_332[c.traderKind].label}${name?` (${name})`:''}`;
}
