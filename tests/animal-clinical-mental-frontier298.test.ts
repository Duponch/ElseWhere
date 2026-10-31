import {expect,test} from 'vitest';
import {localAnimalConditionFrontier256,caravanAnimalConditionFrontier256} from '../src/sim/animal-condition-medical-frontier-256';
import {tryStartAnimalConfusionLocal256} from '../src/sim/animal-condition-mental-runtime-256';
import {createMedicalRecord} from '../src/sim/injury-state';
import {advanceMedical} from '../src/sim/injury-evolution';
import {groupPawnInterval256} from '../src/sim/group-core-cadence-256';
import type {AnimalAgeMedical256} from '../src/sim/animal-age-condition-state-256';
import type {ActualAnimalMind256} from '../src/sim/animal-condition-mental-state-256';
import type {World} from '../src/sim/types';

// Declared partial owner fixture, not a valid saved World/campaign. No Engine,
// generation, RAW or browser is played. Clinical stepping and commit are real.
function setup(version:number,phase=0){
 const record:AnimalAgeMedical256={...createMedicalRecord(4),body:'hare',animalAgeConditions:{revision:1,nextId:2,cases:[{id:1,kind:'Dementia',part:'brain',bornAt:4,ageCore:0,severity:Math.fround(.001),noPain:false}]}};
 const path=[{x:2,z:1}],motion={from:{x:1,z:1},to:{x:2,z:1},start:4,end:7,fromFraction:0,toFraction:0};
 const animal={id:1,species:'hare',x:1,z:1,state:'idle',ageTicks:10,path,motion,nextDecision:9,wander:{revision:1,nextMoveOrderIsWait:false,job:{kind:'goto',destination:{x:2,z:1}}},health:record} as unknown as ActualAnimalMind256;
 const piles:unknown[]=[],world={schemaVersion:version,tick:5,...version>=297?{phaseCore297:phase}:{},rng:12345,width:8,height:8,pawns:[],piles,packed:[],wildlife:{animals:[animal]}} as unknown as World;
 let draws=0;const draw=()=>{draws++;return 0;};
 const step=(frontier:ReturnType<typeof localAnimalConditionFrontier256>)=>{if(!frontier)throw Error('Actual clinical frontier required');advanceMedical(record,1,{phase:1,posture:'standing',starving:false},draw,frontier);};
 return {world,animal,record,path,motion,piles,draw,draws:()=>draws,step};
}

test('the real clinical producer commits an inner-Core49 confusion at the current297/298 owner frontier without changing its clinical result',()=>{
 expect(groupPawnInterval256(1,49,60,1)).toBe(true);expect(groupPawnInterval256(1,50,60,1)).toBe(false);
 for(const[version,phase]of [[297,0],[298,0],[298,3]] as const){
  const h=setup(version,phase),frontier=localAnimalConditionFrontier256(h.world,h.animal,h.record,h.draw)!;h.step(frontier);
  expect(h.animal.confusion).toBeUndefined();expect(h.animal.path).toBe(h.path);expect(h.draws()).toBe(1);
  expect(h.record.tick).toBe(5);expect(h.record.animalAgeConditions!.cases[0]!.ageCore).toBe(10);
  expect(()=>frontier.commit()).not.toThrow();expect(h.animal.confusion).toEqual({revision:1,ageCore:30});
  expect(h.animal.path).toEqual([]);expect(h.animal.wander!.job).toBeUndefined();expect(h.animal.motion).toBe(h.motion);
  expect(h.world.tick).toBe(5);expect(h.world.phaseCore297).toBe(phase);expect(h.world.rng).toBe(12345);expect(h.world.piles).toBe(h.piles);expect(h.draws()).toBe(1);
 }
});

test('the historical296 clinical date and the real caravan admission keep their original outcome and draw count',()=>{
 const local=setup(296),frontier=localAnimalConditionFrontier256(local.world,local.animal,local.record,local.draw)!;local.step(frontier);frontier.commit();
 expect(local.animal.confusion).toEqual({revision:1,ageCore:30});expect(local.draws()).toBe(1);expect(local.world).not.toHaveProperty('phaseCore297');
 const caravan=setup(298),caravanFrontier=caravanAnimalConditionFrontier256(caravan.animal,caravan.record,caravan.draw)!;caravan.step(caravanFrontier);caravanFrontier.commit();
 expect(caravan.animal.confusion).toEqual({revision:1,ageCore:30});expect(caravan.animal.path).toBe(caravan.path);expect(caravan.animal.motion).toBe(caravan.motion);expect(caravan.draws()).toBe(1);
});

test('the unchanged local guard still rejects stale/future Core and preparation never applies mental work before commit',()=>{
 for(const version of [297,298])for(const atCore of [49,51]){const h=setup(version);expect(()=>tryStartAnimalConfusionLocal256(h.world,h.animal,atCore)).toThrow('Mental event is outside the actual owner frontier');expect(h.animal.confusion).toBeUndefined();expect(h.animal.path).toBe(h.path);expect(h.draws()).toBe(0);}
 for(const atCore of [40,51]){const h=setup(296);expect(()=>tryStartAnimalConfusionLocal256(h.world,h.animal,atCore)).toThrow('Mental event is outside the actual owner frontier');}
 const h=setup(298),frontier=localAnimalConditionFrontier256(h.world,h.animal,h.record,h.draw)!;h.step(frontier);expect(h.animal.confusion).toBeUndefined();expect(h.animal.path).toBe(h.path);expect(h.animal.wander!.job?.kind).toBe('goto');
 frontier.commit();expect(()=>frontier.commit()).toThrow('already committed');expect(h.draws()).toBe(1);expect(h.animal.motion).toBe(h.motion);
});
