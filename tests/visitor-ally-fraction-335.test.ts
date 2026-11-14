import {expect,test} from 'vitest';
import {allyAccepts335,advanceVisitors,enableVisitors} from '../src/sim/visitors.ts';
import {allyIncidentFraction332} from '../src/sim/trader-caravans-332.ts';
import type {HomeVisitorCalendar} from '../src/sim/visitor-state.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {SettlementTile} from '../src/sim/world-settlement-placement.ts';
import type {World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const calendar=(w:World)=>w.visitors as HomeVisitorCalendar;
/** Declared fixture: a camp with the real default world faction registry (as trader-caravans-332). */
function colony():World {
  const w=deconstructionCamp(2,48);
  const tiles:readonly SettlementTile[]=Array.from({length:128},(_,i)=>({biome:'temperate-forest',hilliness:'flat',neighbours:[(i+127)%128,(i+1)%128]}));
  const foreign=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:2,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(718)});
  if(!foreign.ok)throw Error(foreign.reason);
  const registry=completeWorldFactionRegistry256({version:w.schemaVersion,draft:foreign.draft,playerDef:'PlayerColony',name:'Colonie de contrôle',postWorldRandom:new WorldGenerationRandom(991)});
  if(!registry.ok)throw Error(registry.reason);
  w.worldFactions=registry.registry;w.nextId=foreign.nextThingId;
  return w;
}
const relation=(w:World,def:string)=>{const r=w.worldFactions!,id=r.factions.find(f=>f.def===def)!.id,p=r.playerFactionId;return r.relations.find(x=>x.aId===Math.min(id,p)&&x.bId===Math.max(id,p))!;};

test('travelers and visitors follow the ally fraction from schema 335',()=>{
  const w=colony(),fraction=allyIncidentFraction332(w);
  expect(fraction).toBeGreaterThan(.6);expect(fraction).toBeLessThan(1);
  // Accepted share over many opportunities matches the fraction.
  for(const kind of ['traveler','visitor'] as const){
    let accepted=0;const n=4000;
    for(let t=0;t<n;t++){w.tick=t*100;if(allyAccepts335(w,kind))accepted++;}
    expect(Math.abs(accepted/n-fraction)).toBeLessThan(.03);
  }
  // Older schemas always accept; no friendly faction refuses everything.
  setVersion(w,334);expect(Array.from({length:50},(_,t)=>{w.tick=t;return allyAccepts335(w,'visitor');}).every(Boolean)).toBe(true);setVersion(w,335);
  relation(w,'TribeCivil').kind='hostile';relation(w,'OutlanderCivil').kind='hostile';
  expect(allyIncidentFraction332(w)).toBe(-1);
  expect(Array.from({length:50},(_,t)=>{w.tick=t;return allyAccepts335(w,'traveler');}).some(Boolean)).toBe(false);
  // Without a faction registry (old local worlds), every hit is accepted.
  const plain=deconstructionCamp(2,32);expect(allyAccepts335(plain,'visitor')).toBe(true);
});

test('without a friendly faction no traveler arrives at its opportunity',()=>{
  const w=colony();enableVisitors(w);
  relation(w,'TribeCivil').kind='hostile';relation(w,'OutlanderCivil').kind='hostile';
  const s=calendar(w),due=s.traveler.pending[0]!;
  w.tick=due;if(w.corePathBudget297)w.corePathBudget297.tick=due;if(w.deterioration)w.deterioration.lastTick=due;
  const groups=s.groups.length;advanceVisitors(w);
  expect(calendar(w).groups.length).toBe(groups);
  expect(calendar(w).traveler.pending[0]).not.toBe(due); // the opportunity is consumed
});

test('a schema 334 save migrates to 335 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,334)))).toBe(current);
});
