import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {adoptFluIncidents,FLU_CHECK_INTERVAL,FLU_FIRST_CHECK} from '../src/sim/flu-incidents.ts';
import {consumeCassandraOpportunity,enableCassandraRaids,INTRO_RAID_TICK} from '../src/sim/cassandra-raids.ts';
import {advanceRaids,chooseRaidComposition} from '../src/sim/raids.ts';
import {createRaidGroup} from '../src/sim/raid-spawn.ts';
import {raidEntries} from '../src/sim/raid-space.ts';
import {injurePawn} from '../src/sim/health.ts';
import {completeCapture} from '../src/sim/capture.ts';
import {createPrisonerState} from '../src/sim/prisoner-state.ts';
import {validPrisonerStateRecord259} from '../src/sim/prisoner-save.ts';
import {RAID_KIND_RESISTANCE_334} from '../src/sim/prisoner-resistance-334.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import type {RaidRole} from '../src/sim/raid-state.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
function clock(w:World,tick:number):void {
  w.tick=tick;w.fluIncidents!.nextCheck=Math.max(FLU_FIRST_CHECK,(Math.floor(tick/FLU_CHECK_INTERVAL)+1)*FLU_CHECK_INTERVAL);
  if(w.corePathBudget297)w.corePathBudget297.tick=tick;
  if(w.deterioration)w.deterioration.lastTick=tick;
  const e=w.economy;if(e){e.sampledAt=Math.floor(tick/501)*501;e.nextSampleAt=e.sampledAt+501;e.nextAdaptAt=Math.ceil((tick+1)/3000)*3000;}
}
/** A Cassandra colony at its first cycle opportunity (as raid-arrival-333). */
function colony():World {
  const w=deconstructionCamp(3,72);
  w.scenario={id:'crashlanded',revision:1,landing:{x:16,z:16}};
  w.gameProfile=crashlandedProfile();enableCassandraRaids(w);adoptColonyEconomy(w);adoptFluIncidents(w);
  clock(w,INTRO_RAID_TICK);advanceRaids(w);
  for(const p of w.pawns.filter(q=>q.raid))injurePawn(w,p,'brain','crush',99000);
  advanceRaids(w);clock(w,w.raids!.cassandra!.pending[0]!);
  expect(consumeCassandraOpportunity(w,w.raids!)).toBe(true);
  return w;
}
/** A walking pirate raid, so its raiders are on the map at once. */
function walkingRaid(base:World):{w:World;raiders:Pawn[]} {
  for(let seed=1;seed<=300;seed++){
    const w=structuredClone(base),random={rng:seed*40503+7},composition=chooseRaidComposition(600,random);
    const sites=raidEntries(w,(seed*2654435761>>>0)||1,composition.roster.length);if(!sites)continue;
    const group=createRaidGroup(w,{count:sites.length,sites,random,composition,recompose333:(b,r)=>chooseRaidComposition(b,r)});
    if(!group||group.arrival333?.pods)continue;
    const raiders=w.pawns.filter(p=>p.raid?.group===group.id);
    if(new Set(raiders.map(p=>p.raid!.kind334)).size>1)return {w,raiders};
  }
  throw Error('No walking raid with two kinds');
}
const raider=(w:World,kind?:RaidRole):Pawn=>({...structuredClone(w.pawns[0]!),raid:{group:1,exiting:false,goal:null,...kind?{kind334:kind}:{}}});

test('Core initial resistance ranges of the raid pawn kinds',()=>{
  expect(RAID_KIND_RESISTANCE_334.drifter).toEqual([7,12]);
  expect(RAID_KIND_RESISTANCE_334.scavenger).toEqual([17,26]);
  expect(RAID_KIND_RESISTANCE_334.thrasher).toEqual([14,23]);
  expect(RAID_KIND_RESISTANCE_334['tribal-warrior']).toEqual([5,9]);
  // The concrete berserker chief overrides its abstract parent (19~30).
  expect(RAID_KIND_RESISTANCE_334['tribal-chief-melee']).toEqual([38,58]);
  expect(RAID_KIND_RESISTANCE_334['mercenary-gunner']).toEqual([6,10]);
});

test('a captive draws its resistance in its kind range; others and older schemas keep 7 to 12',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');
  for(const [kind,[low,high]] of Object.entries(RAID_KIND_RESISTANCE_334) as [RaidRole,readonly [number,number]][]){
    const seen=new Set<number>();
    for(let t=0;t<400;t++){w.tick=t;const s=createPrisonerState(w,raider(w,kind));expect(s.kind334).toBe(kind);expect(s.initialResistance).toBeGreaterThanOrEqual(low);expect(s.initialResistance).toBeLessThanOrEqual(high);seen.add(s.initialResistance);}
    expect(Math.min(...seen)).toBe(low);expect(Math.max(...seen)).toBe(high);
  }
  // No kind: the historical draw, identical to a drifter before 334.
  for(let t=0;t<200;t++){
    w.tick=t;const none=createPrisonerState(w,raider(w));
    expect(none.kind334).toBeUndefined();expect(none.initialResistance).toBeGreaterThanOrEqual(7);expect(none.initialResistance).toBeLessThanOrEqual(12);
    const old=structuredClone(w);setVersion(old,333);
    expect(createPrisonerState(old,raider(old,'tribal-chief-melee'))).toEqual(none);
  }
});

test('raiders carry their kind; a captured raider keeps its kind and range, and the save reloads',()=>{
  const {w,raiders}=walkingRaid(colony());
  for(const p of raiders)expect(p.raid!.kind334).toBeDefined();
  const target=raiders.find(p=>p.raid!.kind334==='scavenger'||p.raid!.kind334==='thrasher')??raiders[0]!,kind=target.raid!.kind334!;
  injurePawn(w,target,'brain','crush',99000);
  expect(completeCapture(w,target)).toBe(true);
  const [low,high]=RAID_KIND_RESISTANCE_334[kind];
  expect(target.prisoner!.kind334).toBe(kind);
  expect(target.prisoner!.initialResistance).toBeGreaterThanOrEqual(low);expect(target.prisoner!.initialResistance).toBeLessThanOrEqual(high);
  expect(validateWorld(w)).toEqual([]);
  const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);
});

test('a saved prisoner keeps its resistance within its recorded kind',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');
  const s=createPrisonerState(w,raider(w,'tribal-chief-melee'));
  const valid=(v:unknown,version:number=SCHEMA_VERSION)=>validPrisonerStateRecord259(v,version,w);
  expect(valid({...s,initialResistance:50,resistance:50})).toBe(true);
  expect(valid({...s,initialResistance:59,resistance:59})).toBe(false);
  const {kind334,...plain}={...s,initialResistance:50,resistance:50};void kind334;
  expect(valid(plain)).toBe(false); // without a kind, 7 to 12
  expect(valid({...s,kind334:'muffalo'})).toBe(false);
  expect(valid({...s,initialResistance:9,resistance:9},333)).toBe(false); // the field is future at 333
});

test('a schema 333 save migrates to 334 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,333)))).toBe(current);
});
