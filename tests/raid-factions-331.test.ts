import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {adoptFluIncidents,FLU_CHECK_INTERVAL,FLU_FIRST_CHECK} from '../src/sim/flu-incidents.ts';
import {consumeCassandraOpportunity,enableCassandraRaids,INTRO_RAID_TICK} from '../src/sim/cassandra-raids.ts';
import {advanceRaids} from '../src/sim/raids.ts';
import {createRaidGroup} from '../src/sim/raid-spawn.ts';
import {raidEntries} from '../src/sim/raid-space.ts';
import {validComposition,validateRaids} from '../src/sim/raid-save.ts';
import {mechFactionCommonality} from '../src/sim/mechanoid-raid-composition.ts';
import {RAID_KINDS_331,RAID_MAKERS_331,chooseRaidComposition331,drawRaidFaction331,raidFactionCandidates331,raidMaxPawnCost331,type RaidKind331,type RaidMaker331} from '../src/sim/raid-factions-331.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import type {SettlementTile} from '../src/sim/world-settlement-placement.ts';
import {TICKS_PER_DAY,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
/** A Cassandra colony with an economy, given the real default world faction
 * registry (declared fixture: the generator runs on a synthetic ring of tiles). */
function colony(size=48):World {
  const w=deconstructionCamp(3,size);
  w.scenario={id:'crashlanded',revision:1,landing:{x:16,z:16}};
  w.gameProfile=crashlandedProfile();enableCassandraRaids(w);adoptColonyEconomy(w);adoptFluIncidents(w);
  const tiles:readonly SettlementTile[]=Array.from({length:128},(_,i)=>({biome:'temperate-forest',hilliness:'flat',neighbours:[(i+127)%128,(i+1)%128]}));
  const foreign=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(718)});
  if(!foreign.ok)throw Error(foreign.reason);
  const registry=completeWorldFactionRegistry256({version:w.schemaVersion,draft:foreign.draft,playerDef:'PlayerColony',name:'Colonie de contrôle',postWorldRandom:new WorldGenerationRandom(991)});
  if(!registry.ok)throw Error(registry.reason);
  w.worldFactions=registry.registry;w.nextId=foreign.nextThingId;
  return w;
}
function clock(w:World,tick:number):void {
  w.tick=tick;w.fluIncidents!.nextCheck=Math.max(FLU_FIRST_CHECK,(Math.floor(tick/FLU_CHECK_INTERVAL)+1)*FLU_CHECK_INTERVAL);
}
const factionOf=(w:World,def:string)=>w.worldFactions!.factions.find(f=>f.def===def)!;
const defOf=(w:World,id:number)=>w.worldFactions!.factions.find(f=>f.id===id)!.def;
function freeEdge(w:World,count:number):{x:number;z:number}[] {
  const cells:{x:number;z:number}[]=[];
  for(let x=1;x<w.width-1&&cells.length<count;x+=2)cells.push({x,z:0});
  return cells;
}

test('every hostile world faction weighs 1, mechanoids their Core curve, the last raider 0.4',()=>{
  const w=colony();clock(w,50*TICKS_PER_DAY);
  const choices=raidFactionCandidates331(w,1000,false);
  expect(choices.map(c=>defOf(w,c.factionId)).sort()).toEqual(['Mechanoid','OutlanderRough','Pirate','TribeRough','TribeSavage']);
  for(const c of choices)expect(c.weight).toBeCloseTo(c.family==='mechanoid'?mechFactionCommonality(1000):1,10);
  // Mechanoids: a quarter of the raids at 1000 points, against 57 % before.
  const total=choices.reduce((sum,c)=>sum+c.weight,0),mech=choices.find(c=>c.family==='mechanoid')!.weight;
  expect(mech/total).toBeGreaterThan(.24);expect(mech/total).toBeLessThan(.26);
  const counts=new Map<string,number>();
  for(let i=0;i<1000;i++){const pick=drawRaidFaction331(w,1000,()=>(i+.5)/1000)!;counts.set(defOf(w,pick.factionId),(counts.get(defOf(w,pick.factionId))??0)+1);}
  expect(counts.get('Mechanoid')).toBe(251);for(const def of ['OutlanderRough','TribeRough','TribeSavage','Pirate'])expect(Math.abs(counts.get(def)!-187.2)).toBeLessThan(1);
  // The faction of the previous raid weighs 0.4.
  w.raids!.lastFaction331=factionOf(w,'Pirate').id;
  expect(raidFactionCandidates331(w,1000,false).find(c=>c.factionId===factionOf(w,'Pirate').id)!.weight).toBeCloseTo(.4,10);
  // Cheapest Core fighter: outlanders need 60 points, tribes 40, pirates 35.
  expect(raidFactionCandidates331(w,50,false).map(c=>defOf(w,c.factionId)).sort()).toEqual(['Pirate','TribeRough','TribeSavage']);
  expect(raidFactionCandidates331(w,38,false).map(c=>defOf(w,c.factionId))).toEqual(['Pirate']);
});

test('mechanoids wait 45 days except in the desperate pass; peaceful factions never raid',()=>{
  const w=colony();clock(w,30*TICKS_PER_DAY);
  expect(raidFactionCandidates331(w,1000,false).some(c=>c.family==='mechanoid')).toBe(false);
  const player=w.worldFactions!.playerFactionId;
  for(const r of w.worldFactions!.relations)if((r.aId===player||r.bId===player)&&defOf(w,r.aId===player?r.bId:r.aId)!=='Mechanoid'){r.goodwill=0;r.kind='neutral';}
  expect(raidFactionCandidates331(w,1000,false)).toEqual([]);
  const desperate=drawRaidFaction331(w,1000,()=>.5)!;
  expect(defOf(w,desperate.factionId)).toBe('Mechanoid');
  delete w.raids!.mechanoid;
  expect(drawRaidFaction331(w,1000,()=>.5)).toBeNull();
});

test('tribal and outlander rosters spend their points with Core makers, costs and one leader',()=>{
  const makers=new Set<RaidMaker331>();
  for(const [family,budget] of [['tribe',40],['tribe',300],['tribe',2000],['outlander',60],['outlander',700]] as const)for(let seed=1;seed<=60;seed++){
    const random={rng:seed*2654435761>>>0||1},c=chooseRaidComposition331(budget,family,random);
    makers.add(c.group331!);expect(RAID_MAKERS_331[c.group331!].family).toBe(family);
    const kinds=c.roster as RaidKind331[],spent=kinds.reduce((sum,k)=>sum+RAID_KINDS_331[k].cost,0);
    expect(kinds.length).toBeGreaterThan(0);expect(spent).toBeLessThanOrEqual(budget);
    expect(kinds.filter(k=>RAID_KINDS_331[k].leader).length).toBeLessThanOrEqual(1);
    for(const k of kinds){expect(RAID_MAKERS_331[c.group331!].options.some(o=>o.kind===k)).toBe(true);expect(RAID_KINDS_331[k].cost).toBeLessThanOrEqual(raidMaxPawnCost331(family,budget));}
    expect(validComposition(c,kinds.length,331,true,true,true)).toBe(true);
    expect(validComposition(c,kinds.length,330,true,true,true)).toBe(false);
    expect(validComposition(c,kinds.length,331,true,true,false)).toBe(false);
  }
  expect([...makers].sort()).toEqual(['outlander','tribe-melee','tribe-mixed','tribe-ranged']);
  // Forged rosters: a pirate role, two chiefs, unspent points or overspending.
  expect(validComposition({budget:300,roster:['drifter'],group331:'tribe-mixed'},1,331,true,true,true)).toBe(false);
  expect(validComposition({budget:200,roster:['tribal-chief-melee','tribal-chief-melee'],group331:'tribe-melee'},2,331,true,true,true)).toBe(false);
  expect(validComposition({budget:200,roster:['tribal-archer','tribal-archer'],group331:'tribe-ranged'},2,331,true,true,true)).toBe(false);
  expect(validComposition({budget:90,roster:['tribal-archer','tribal-archer'],group331:'tribe-ranged'},2,331,true,true,true)).toBe(true);
  expect(validComposition({budget:89,roster:['tribal-archer','tribal-archer'],group331:'tribe-ranged'},2,331,true,true,true)).toBe(false);
  expect(validComposition({budget:120,roster:['town-councilman','villager','villager'],group331:'outlander'},3,331,true,true,true)).toBe(false);
});

/** Lot 330 staging pushes the give-up deadline back; its save bound is being
 * fixed on main in parallel, so the validations below use raids that attack
 * at once (the seed loops only skip staged draws). */
const attacksNow=(group:{stage330?:unknown}|null|undefined)=>!!group&&!group.stage330;
const roundTrip=(w:World)=>JSON.parse(JSON.stringify(w)) as World;

/** A Cassandra composition belongs to a cycle raid: play the intro raid, end
 * it, then consume the first cycle opportunity as advanceRaids does. */
function cycleOpportunity():World {
  const w=colony();clock(w,INTRO_RAID_TICK);advanceRaids(w);
  for(const p of w.pawns)if(p.raid)p.state='dead';
  advanceRaids(w);clock(w,w.raids!.cassandra!.pending[0]!);
  expect(consumeCassandraOpportunity(w,w.raids!)).toBe(true);
  return w;
}

test('a tribal or outlander raid arrives with its real gear, clothes and world faction',()=>{
  for(const [def,family] of [['TribeSavage','tribe'],['OutlanderRough','outlander']] as const){
    let w=colony(),group:ReturnType<typeof createRaidGroup>=null,composition=chooseRaidComposition331(600,family,{rng:1});
    for(let seed=1;seed<=40&&!attacksNow(group);seed++){
      w=cycleOpportunity();const random={rng:seed*40503+7};composition=chooseRaidComposition331(600,family,random);
      const sites=freeEdge(w,composition.roster.length);
      expect(createRaidGroup(w,{count:sites.length,sites,random:{...random},composition,faction331:{factionId:factionOf(w,'Pirate').id,family}})).toBeNull();
      expect(createRaidGroup(w,{count:sites.length,sites,random:{...random},composition})).toBeNull();
      group=createRaidGroup(w,{count:sites.length,sites,random,composition,faction331:{factionId:factionOf(w,def).id,family}});
      expect(group).not.toBeNull();
    }
    expect(attacksNow(group)).toBe(true);
    const faction=factionOf(w,def);
    if(family==='outlander')expect(composition.group331).toBe('outlander');
    for(const [i,id] of group!.members.entries()){
      const p=w.pawns.find(q=>q.id===id)!,kind=RAID_KINDS_331[composition.roster[i] as RaidKind331];
      expect(p.faction).toBe('outlaws');expect(p.worldAffiliation259?.factionId).toBe(faction.id);
      expect(w.piles.find(i=>i.owner.type==='equipment'&&i.owner.pawnId===id)!.item).toBe(kind.weapon);
      expect(w.piles.find(i=>i.owner.type==='apparel'&&i.owner.pawnId===id)!.item).toBe(family==='tribe'?'cloth-tribalwear':'cloth-shirt');
    }
    expect(w.events.at(-1)!.message).toContain(faction.name);
    expect(validateRaids(w,331,new Set())).toEqual([]);
    const copy=roundTrip(w);expect(copy.raids).toEqual(w.raids);expect(validateRaids(copy,331,new Set())).toEqual([]);
    // A raider of another family, or this roster in a 330 save, is refused.
    const forged=structuredClone(w);forged.pawns.find(p=>p.id===group!.members[0])!.worldAffiliation259!.factionId=factionOf(w,'Pirate').id;
    expect(validateRaids(forged,331,new Set())).toContain('Raider outside the raid faction family.');
    const old=structuredClone(w);delete old.raids!.lastFaction331;
    expect(validateRaids(old,330,new Set())).toContain('Invalid active raid group.');
  }
});

test('Cassandra draws the faction of her intro and later raids; the roster follows it',()=>{
  const seen=new Set<string>();
  for(let seed=1;seed<=60&&seen.size<5;seed++){
    const w=colony();w.raids!.rng=seed*977+1;w.raids!.mechanoid!.rng=seed*7919+3;
    clock(w,INTRO_RAID_TICK);advanceRaids(w);
    const intro=w.raids!.active!,raider=w.pawns.find(p=>p.id===intro.members[0])!;
    const introDef=defOf(w,raider.worldAffiliation259!.factionId!);
    expect(['Pirate','TribeRough','TribeSavage']).toContain(introDef);
    expect(intro.members).toHaveLength(1);expect(intro.composition).toBeUndefined();
    expect(w.raids!.lastFaction331).toBe(raider.worldAffiliation259!.factionId);
    seen.add('intro-'+(introDef==='Pirate'?'pirate':'tribe'));
    if(attacksNow(intro))expect(validateRaids(w,331,new Set())).toEqual([]);
    // End the intro, then play the first cycle raid with a real wealth budget.
    raider.state='dead';advanceRaids(w);expect(w.raids!.active).toBeUndefined();
    const due=w.raids!.cassandra!.pending[0]!;clock(w,due);
    const e=w.economy!;e.wealth={...e.wealth,items:60000,knownTotal:60000,knownStorytellerWealth:60000};
    e.sampledAt=Math.floor(due/501)*501;e.nextSampleAt=e.sampledAt+501;e.nextAdaptAt=Math.ceil((due+1)/3000)*3000;
    advanceRaids(w);
    const active=w.raids!.active;if(!active)continue;
    const def=defOf(w,w.pawns.find(p=>p.id===active.members[0])!.worldAffiliation259!.factionId!);
    const family=def==='Pirate'?'pirate':def.startsWith('Tribe')?'tribe':'outlander';
    expect(active.composition!.group331===undefined?'pirate':RAID_MAKERS_331[active.composition!.group331].family).toBe(family);
    expect(active.members.length).toBe(active.composition!.roster.length);
    expect(w.raids!.lastFaction331).toBe(factionOf(w,def).id);
    seen.add(family);
    if(attacksNow(active)){expect(validateRaids(w,331,new Set())).toEqual([]);expect(validateRaids(roundTrip(w),331,new Set())).toEqual([]);}
  }
  expect([...seen].sort()).toEqual(['intro-pirate','intro-tribe','outlander','pirate','tribe']);
});

test('the new raid fields are refused before 331 by the direct validators',()=>{
  let w=colony();
  for(let seed=1;seed<=40;seed++){w=colony();w.raids!.rng=seed*977+1;clock(w,INTRO_RAID_TICK);advanceRaids(w);if(attacksNow(w.raids!.active))break;}
  expect(w.raids!.lastFaction331).toBeDefined();
  expect(validateRaids(w,331,new Set())).toEqual([]);
  expect(validateRaids(w,330,new Set())).toContain('Invalid raid calendar.');
  const player=structuredClone(w);player.raids!.lastFaction331=w.worldFactions!.playerFactionId;
  expect(validateRaids(player,331,new Set())).toContain('Invalid last raid faction.');
  const insect=structuredClone(w);insect.raids!.lastFaction331=factionOf(w,'Insect').id;
  expect(validateRaids(insect,331,new Set())).toContain('Invalid last raid faction.');
  const composition=chooseRaidComposition331(300,'tribe',{rng:5});
  expect(validComposition(composition,composition.roster.length,330,true,true,true)).toBe(false);
});

// Les Éclaircies: a real geographic Cassandra colony with its world factions.
const ECLAIRCIES='public/test-saves/v419/les-eclaircies.json';
test('on a real campaign, a tribal raid and the last raider round-trip; a 330 save refuses them',()=>{
  let w=deserializeWorld(readFileSync(ECLAIRCIES,'utf8'));const pristine=serializeWorld(w);
  // A schema 330 save migrates to 331 by its number only.
  expect(serializeWorld(deserializeWorld(asOldSchema(pristine,330)))).toBe(pristine);
  const tribe=factionOf(w,'TribeSavage');
  for(let seed=1;seed<=40;seed++){
    w=deserializeWorld(pristine);
    const sites=raidEntries(w,(seed*2654435761>>>0)||1,1)!,group=createRaidGroup(w,{count:1,sites,random:{rng:seed*977+1},faction331:{factionId:tribe.id,family:'tribe'}});
    if(attacksNow(group))break;
  }
  w.raids!.lastFaction331=tribe.id;
  const raider=w.pawns.find(p=>p.raid)!;
  expect(raider.worldAffiliation259?.factionId).toBe(tribe.id);
  expect(w.piles.find(i=>i.owner.type==='apparel'&&i.owner.pawnId===raider.id)!.item).toBe('cloth-tribalwear');
  expect(validateWorld(w)).toEqual([]);
  const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);
  expect(()=>deserializeWorld(asOldSchema(saved,330))).toThrow();
},600_000);

test('before 331, Cassandra keeps the single pirate faction',()=>{
  const w=colony();setVersion(w,330);
  clock(w,INTRO_RAID_TICK);advanceRaids(w);
  expect(w.raids!.lastFaction331).toBeUndefined();
  expect(defOf(w,w.pawns.find(p=>p.raid)!.worldAffiliation259!.factionId!)).toBe('Pirate');
});
