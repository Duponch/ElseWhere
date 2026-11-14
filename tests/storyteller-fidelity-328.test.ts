import {expect,test} from 'vitest';
import {drawBigThreat328} from '../src/sim/big-threats-328.ts';
import {computeThreatPoints} from '../src/sim/threat-points.ts';
import {deathOnDownedEligible320} from '../src/sim/population-intent-320.ts';
import {eligibleVolcanicWinter310} from '../src/sim/volcanic-winter-310.ts';
import {smallAnimalCandidates} from '../src/sim/cassandra-small.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {TICKS_PER_DAY,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};

test('after day 20 the big-threat slot draws Core weights, absent threats use it up',()=>{
  expect(drawBigThreat328(19,5000,()=>.99)).toBe('raid');
  expect(drawBigThreat328(20,5000,()=>0)).toBe('raid');
  // 300 points: raid 7.4, manhunter pack 2, mass insanity 1.3 (total 10.7).
  expect(drawBigThreat328(30,300,()=>.99)).toBe('mass-animal-insanity');
  expect(drawBigThreat328(30,300,()=>7.39/10.7)).toBe('raid');
  // 500 points: the infestation follows the raid (7.4 then 2.7 of 17.4).
  expect(drawBigThreat328(30,500,()=>8.7/17.4)).toBe('infestation');
});

test('the days factor of threat points reads whole days',()=>{
  const input={knownWealth:50000,freeColonists:5,colonistHealthSum:5,elapsedDays:12.9,adaptationDays:0,seedBucket:1};
  const fractional=computeThreatPoints(input),whole=computeThreatPoints({...input,timeFactorWholeDays:true});
  expect(whole.timeFactor).toBeLessThan(fractional.timeFactor);
  expect(whole.timeFactor).toBeCloseTo(computeThreatPoints({...input,elapsedDays:12}).timeFactor,12);
});

test('the first raider of a Cassandra game is never killed when downed',()=>{
  const w=createScenarioWorld(42,32,'crashlanded'),p=w.pawns[0]!;
  p.faction='outlaws';p.raid={group:1,exiting:false,goal:null};
  if(w.raids?.profile==='cassandra-raids-v1'){
    expect(deathOnDownedEligible320(w,p)).toBe(false);
    p.raid.group=2;expect(deathOnDownedEligible320(w,p)).toBe(true);
    p.raid.group=1;setVersion(w,327);expect(deathOnDownedEligible320(w,p)).toBe(true);
  }
});

test('a volcanic winter cannot start during a heat wave',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');w.tick=61*TICKS_PER_DAY;
  const state=w.miscIncidents;
  if(state&&eligibleVolcanicWinter310(w)){
    state.active={start:w.tick-10,end:w.tick+1000};
    expect(eligibleVolcanicWinter310(w)).toBe(false);
    setVersion(w,327);expect(eligibleVolcanicWinter310(w)).toBe(true);
  }
});

test('single animal insanity ignores animals under the fog',()=>{
  const w=createScenarioWorld(42,32,'crashlanded'),animal=w.wildlife?.animals.find(a=>smallAnimalCandidates(w).includes(a));
  if(animal){
    w.tiles[Math.round(animal.z)*w.width+Math.round(animal.x)]!.fogged=true;
    expect(smallAnimalCandidates(w)).not.toContain(animal);
    setVersion(w,327);expect(smallAnimalCandidates(w)).toContain(animal);
  }
});

test('a schema 327 save migrates to 328 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,327)))).toBe(current);
});
