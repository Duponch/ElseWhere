import {expect,test} from 'vitest';
import {drawMiscIncident329,type MiscRow329} from '../src/sim/misc-lottery-329.ts';
import {populationIntent320} from '../src/sim/population-intent-320.ts';
import {adoptWorldIncidents,advanceWorldIncidents,WORLD_CHECK_INTERVAL,WORLD_FIRST_CHECK} from '../src/sim/cassandra-world.ts';
import {adoptWeatherIncidents} from '../src/sim/cassandra-misc.ts';
import {advanceWorldQuestCalendar263,newQuestCalendar263} from '../src/sim/world-quest-calendar-263.ts';
import {homeAnimalThreatPoints329} from '../src/sim/animal-threat-points-329.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {domesticColony} from './scenarios/domestic-colony.ts';
import {ANIMAL_SPECIES} from '../src/sim/animal-species.ts';
import {animalCore256,isAnimalSpecies256} from '../src/sim/animal-core-v256.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const sequence=(values:number[])=>()=>{const v=values.shift();if(v===undefined)throw Error('random exhausted');return v;};

test('the misc lottery leaves ineligible incidents out and weighs population incidents by intent',()=>{
  const w=createScenarioWorld(42,32,'crashlanded'),intent=populationIntent320(w);
  const rows:MiscRow329[]=[
    {id:'never',weight:5,population:null,eligible:()=>false},
    {id:'plain',weight:1,population:null},
    {id:'easy',weight:1,population:-.4},
    {id:'hard',weight:1,population:.4},
  ];
  // Population group refused (draw .999), then the only eligible plain incident.
  expect(drawMiscIncident329(w,rows,sequence([.999,0]))?.id).toBe('plain');
  // Population group chosen (draw 0): easy then hard by their intent factors.
  const easy=Math.max(intent-.4,.05),hard=Math.max(intent+.4,.05);
  expect(drawMiscIncident329(w,rows,sequence([0,easy/(easy+hard)*.999]))?.id).toBe('easy');
  expect(drawMiscIncident329(w,rows,sequence([0,(easy/(easy+hard))+.001]))?.id).toBe('hard');
  // An empty group falls back to the whole pool.
  expect(drawMiscIncident329(w,rows.slice(0,2),sequence([0,0]))?.id).toBe('plain');
});

test('the eclipse comes from the World component from schema 329',()=>{
  const eclipses=(version:number)=>{
    const w=createScenarioWorld(42,32,'crashlanded');setVersion(w,version);adoptWeatherIncidents(w);adoptWorldIncidents(w);
    const state=w.worldIncidents!,weather=w.miscIncidents!.weather!;let count=0;
    for(let seed=1;seed<=20000;seed++){
      w.tick=WORLD_FIRST_CHECK+WORLD_CHECK_INTERVAL*seed;state.nextCheck=w.tick;state.rng=seed;delete state.active;
      delete weather.eclipse;delete weather.lastEclipseStart;
      advanceWorldIncidents(w);if(weather.eclipse)count++;
    }
    return count;
  };
  expect(eclipses(328)).toBe(0);
  expect(eclipses(329)).toBeGreaterThan(0);
});

test('a random quest is accepted by the day curve read at its hit date',()=>{
  let before=0,after=0;
  for(let seed=1;seed<=400;seed++){
    for(const flag of [false,true]){
      const s=newQuestCalendar263(599000,seed,[1]);
      advanceWorldQuestCalendar263(s,600000,{points:100,progress:3,adjustedPopulation:3,hasFreeColonist:true,hasHomeMap:true,acceptAtHit329:flag});
      if(s.pendingCore!==null){if(flag)after++;else before++;}
    }
  }
  expect(after).toBeGreaterThan(before);
});

test('colony animals that can learn attack add to the threat points',()=>{
  const w=domesticColony(),a=w.wildlife!.animals.find(x=>x.domestic)!;
  expect(homeAnimalThreatPoints329(w)).toBe(0); // a historical hare has no Core trainability
  const species=(Object.keys(ANIMAL_SPECIES) as (keyof typeof ANIMAL_SPECIES)[]).find(id=>isAnimalSpecies256(id)&&animalCore256(id).race.trainability==='Advanced')!;
  (a as {species:string}).species=species;delete a.health;
  expect(homeAnimalThreatPoints329(w)).toBeCloseTo(.08*ANIMAL_SPECIES[species].combatPower,9);
  a.state='downed';expect(homeAnimalThreatPoints329(w)).toBe(0);a.state='idle';
  setVersion(w,328);expect(homeAnimalThreatPoints329(w)).toBe(0);
});

test('a schema 328 save migrates to 329 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,328)))).toBe(current);
});
