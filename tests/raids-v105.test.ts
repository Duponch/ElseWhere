import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {adoptFluIncidents,FLU_CHECK_INTERVAL,FLU_FIRST_CHECK} from '../src/sim/flu-incidents.ts';
import {enableCassandraRaids,INTRO_RAID_TICK} from '../src/sim/cassandra-raids.ts';
import {advanceRaids,chooseRaidComposition} from '../src/sim/raids.ts';
import {validateRaids} from '../src/sim/raid-save.ts';
import {RAID_ROLE_COST,pirateMaxPawnCost,type PirateRaidRole} from '../src/sim/raid-state.ts';
import {injurePawn} from '../src/sim/health.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import type {World} from '../src/sim/types.ts';

function fixture():World {
  const world=deconstructionCamp(3);
  world.scenario={id:'crashlanded',revision:1,landing:{x:16,z:16}};
  world.gameProfile=crashlandedProfile();enableCassandraRaids(world);adoptColonyEconomy(world);adoptFluIncidents(world);
  return world;
}
/** Focused historical raid context only. Other World systems retain their
 * current shape; this does not sanitize a payload for the global validator. */
function raidContext105(source:World):World {
  const historical=structuredClone(source);
  if(historical.raids)delete historical.raids.mechanoid;
  return historical;
}
// These focused raid tests skip days without advancing other systems. Move the
// independent, still-unused disease check into the future at each clock jump.
function raidClock(world:World,tick:number):void {
  world.tick=tick;
  world.fluIncidents!.nextCheck=Math.max(FLU_FIRST_CHECK,(Math.floor(tick/FLU_CHECK_INTERVAL)+1)*FLU_CHECK_INTERVAL);
}
function afterIntro(world:World):void {
  raidClock(world,INTRO_RAID_TICK);advanceRaids(world);
  const first=world.pawns.find(p=>p.raid)!;
  expect(world.raids!.active!.members).toEqual([first.id]);
  expect(world.raids!.active!.composition).toBeUndefined();
  injurePawn(world,first,'brain','crush',99000);advanceRaids(world);
  expect(world.raids!.active).toBeUndefined();
  const forged=structuredClone(world);forged.raids!.last!.composition={budget:40,roster:['drifter']};
  expect(validateRaids(raidContext105(forged),105,new Set())).toContain('Invalid raid outcome.');
}

test('projected pirate roster spends its budget with Core kind costs and individual limit',()=>{
  const forty={rng:41};
  expect(chooseRaidComposition(40,forty).roster).toEqual(['drifter']);
  expect(chooseRaidComposition(60,{rng:41}).roster).toEqual(['drifter']);
  const first={rng:93},second={rng:93};
  const a=chooseRaidComposition(10000,first),b=chooseRaidComposition(10000,second);
  expect(a).toEqual(b);expect(first.rng).toBe(second.rng);
  expect(a.roster.length).toBeGreaterThan(2);
  const spent=a.roster.reduce((sum,role)=>sum+RAID_ROLE_COST[role],0);
  expect(spent).toBeLessThanOrEqual(a.budget);
  expect(a.budget-spent).toBeLessThan(35);
  expect(() => chooseRaidComposition(34,{rng:1})).toThrow(RangeError);
});

test('a failed introductory opportunity does not make the first ordinary raid fixed',()=>{
  const world=fixture(),originalTiles=structuredClone(world.tiles);
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)
    if(x===0||z===0||x===world.width-1||z===world.height-1)world.tiles[z*world.width+x]={terrain:'rock'};
  raidClock(world,INTRO_RAID_TICK);advanceRaids(world);
  expect(world.raids!.serial).toBe(0);
  expect(world.raids!.active).toBeUndefined();
  world.tiles=originalTiles;
  const due=world.raids!.cassandra!.pending[0]!;
  raidClock(world,due);
  const economy=world.economy!;
  economy.wealth={...economy.wealth,items:100000,knownTotal:100000,knownStorytellerWealth:100000};
  economy.sampledAt=Math.floor(due/501)*501;economy.nextSampleAt=economy.sampledAt+501;
  economy.nextAdaptAt=Math.ceil((due+1)/3000)*3000;
  advanceRaids(world);
  const active=world.raids!.active!;
  expect(active.id).toBe(1);
  expect(active.composition!.roster.length).toBeGreaterThan(2);
  expect(active.members).toHaveLength(active.composition!.roster.length);
  expect(validateWorld(world)).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  const missing=structuredClone(world);delete missing.raids!.active!.composition;
  expect(validateRaids(raidContext105(missing),105,new Set())).toContain('Invalid active raid group.');
  for(const id of active.members)injurePawn(world,world.pawns.find(p=>p.id===id)!,'brain','crush',99000);
  advanceRaids(world);
  expect(world.raids!.last!.id).toBe(1);
  expect(world.raids!.last!.composition).toEqual(active.composition);
  expect(validateWorld(world)).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
});

test('intro is fixed; an adopted Cassandra occasion has priced physical raiders and saved roster',()=>{
  const world=fixture();afterIntro(world);
  const due=world.raids!.cassandra!.pending[0]!;
  raidClock(world,due);
  const e=world.economy!;
  e.wealth={...e.wealth,items:100000,knownTotal:100000,knownStorytellerWealth:100000};
  e.sampledAt=Math.floor(due/501)*501;e.nextSampleAt=e.sampledAt+501;
  e.nextAdaptAt=Math.ceil((due+1)/3000)*3000;
  const priorId=world.nextId;advanceRaids(world);
  const active=world.raids!.active!,composition=active.composition!;
  expect(composition.budget).toBeGreaterThan(100);
  expect(composition.roster.length).toBeGreaterThan(2);
  expect(active.members).toHaveLength(composition.roster.length);
  expect(validateRaids(raidContext105(world),105,new Set())).toEqual([]);
  expect(validateWorld(world)).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  for(const [index,id] of active.members.entries()){
    const pawn=world.pawns.find(p=>p.id===id)!;
    const gear=world.piles.filter(p=>p.owner.type==='equipment'&&p.owner.pawnId===id);
    expect(pawn.faction).toBe('outlaws');expect(id).toBeGreaterThanOrEqual(priorId);
    expect(gear).toHaveLength(1);
    expect(gear[0]!.item).toBe(({drifter:'plasteel-knife',thrasher:'plasteel-knife',
      scavenger:'revolver',pirate:'bolt-action-rifle'} as const)[composition.roster[index]! as PirateRaidRole]);
  }
  const invalid=structuredClone(world);invalid.raids!.active!.composition!.budget=0;
  expect(validateRaids(raidContext105(invalid),105,new Set())).toContain('Invalid active raid group.');
  const missing=structuredClone(world);delete missing.raids!.active!.composition;
  expect(validateRaids(raidContext105(missing),105,new Set())).toContain('Invalid active raid group.');
  const tooExpensive=structuredClone(world),n=composition.roster.length;
  const lowBudget=65+(n-1)*35;
  expect(pirateMaxPawnCost(lowBudget)).toBeLessThan(65);
  tooExpensive.raids!.active!.composition={budget:lowBudget,roster:['pirate',...Array.from({length:n-1},()=> 'drifter' as const)]};
  expect(validateRaids(raidContext105(tooExpensive),105,new Set())).toContain('Invalid active raid group.');
  const predatesAdoption=structuredClone(world);predatesAdoption.economy!.adoptedAt=active.startedAt+1;
  expect(validateRaids(raidContext105(predatesAdoption),105,new Set())).toContain('Invalid active raid group.');
  for(const id of active.members)injurePawn(world,world.pawns.find(p=>p.id===id)!,'brain','crush',99000);
  advanceRaids(world);
  expect(world.raids!.last!.composition).toEqual(composition);
  expect(world.raids!.last!.killed).toBe(composition.roster.length);
  expect(validateRaids(raidContext105(world),105,new Set())).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  const forgedOutcome=structuredClone(world);forgedOutcome.economy!.adoptedAt=world.raids!.last!.tick+1;
  expect(validateRaids(raidContext105(forgedOutcome),105,new Set())).toContain('Invalid raid outcome.');
});

test('blocked adopted occasion consumes calendar without identities or raid RNG',()=>{
  const world=fixture();afterIntro(world);
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)
    if(x===0||z===0||x===world.width-1||z===world.height-1)world.tiles[z*world.width+x]={terrain:'rock'};
  const due=world.raids!.cassandra!.pending[0]!,nextId=world.nextId,rng=world.raids!.rng;
  raidClock(world,due);advanceRaids(world);
  expect(world.raids!.active).toBeUndefined();
  expect(world.raids!.serial).toBe(1);
  expect(world.nextId).toBe(nextId);
  expect(world.raids!.rng).toBe(rng);
  expect(world.raids!.nextCheck).toBeGreaterThan(due);
});

test('minimum ordinary budget makes one physical melee drifter with knife durability',()=>{
  const world=fixture();afterIntro(world);
  const due=world.raids!.cassandra!.pending[0]!,e=world.economy!;
  raidClock(world,due);e.wealth={...e.wealth,items:0,structures:0,floors:0,pawnsKnown:0,
    knownTotal:0,knownStorytellerWealth:0};
  e.sampledAt=Math.floor(due/501)*501;e.nextSampleAt=e.sampledAt+501;
  e.nextAdaptAt=Math.ceil((due+1)/3000)*3000;
  advanceRaids(world);
  expect(world.raids!.active!.composition!.budget).toBeGreaterThanOrEqual(35);
  expect(world.raids!.active!.composition!.budget).toBeLessThan(50);
  expect(world.raids!.active!.composition!.roster).toEqual(['drifter']);
  const id=world.raids!.active!.members[0]!;
  expect(world.piles.find(p=>p.owner.type==='equipment'&&p.owner.pawnId===id)).toMatchObject({
    item:'plasteel-knife',weapon:{hitPoints:280}});
  expect(validateWorld(world)).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
});
