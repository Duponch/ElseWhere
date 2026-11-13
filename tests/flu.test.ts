import { expect,test } from 'vitest';
import { advanceMedical } from '../src/sim/injury-evolution';
import { assessMedical,createMedicalRecord,reconcileMedicalDeath } from '../src/sim/injury-state';
import { validateMedicalRecord } from '../src/sim/injury-validation';
import type { MedicalContext,MedicalRecord } from '../src/sim/injury-types';
import { FLU_INITIAL,FLU_UNIT,fluModifiers,fluStage } from '../src/sim/flu-rules';
import { fluVomitChance } from '../src/sim/flu-rules';
import { acquireFlu,fluNeedsRest,fluNextTendCore,fluTendable,tendFlu } from '../src/sim/flu-state';
import { processVomit } from '../src/sim/food-poisoning-runtime';
import { medicalRestNeeded,treatmentTarget,treatmentTargets } from '../src/sim/care-rules';
import { medicalCamp } from './scenarios/health';
import { medicineCamp } from './scenarios/medicine';
import { stepWorld } from '../src/sim/engine';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization';

const standing:MedicalContext={phase:0,posture:'standing',starving:false,hunger:100,rest:100};
const resting:MedicalContext={...standing,posture:'bed',restingBonus:true};
const noDraw=()=>{throw Error('Flu evolution must not draw the world RNG');};
const valid=(r:MedicalRecord,allow=true)=>validateMedicalRecord(r,true,true,true,true,false,false,true,true,true,true,true,91,allow);

test('flu admission is human-only, one episode at a time and does not reroll resistance',()=>{
  const h=createMedicalRecord(50);
  expect(acquireFlu(h,1_050_000)).toBe(true);
  expect(h.flu).toEqual({bornAt:50,severity:FLU_INITIAL,immunity:0,luck:1_050_000});
  expect(acquireFlu(h,800_000)).toBe(false);
  expect(h.flu!.luck).toBe(1_050_000);
  expect(valid(h)).toBeNull();expect(valid(h,false)).not.toBeNull();
  h.flu!.severity=0;h.flu!.immunity=600_000_000;
  expect(acquireFlu(h,800_000)).toBe(false);
  h.flu!.immunity=599_999_999;
  expect(acquireFlu(h,800_000)).toBe(true);
  expect(h.flu).toEqual({bornAt:50,severity:FLU_INITIAL,immunity:599_999_999,luck:800_000});
  const animal={...createMedicalRecord(),body:'hare' as const};
  expect(acquireFlu(animal,1_000_000)).toBe(false);
  expect(()=>acquireFlu(h,1_200_001)).toThrow();
});

test('flu stages affect capacities and death without an anatomical injury',()=>{
  expect([0,1,665_999_999,666_000_000,833_000_000].map(fluStage)).toEqual(['none','minor','minor','major','extreme']);
  const r=createMedicalRecord();expect(acquireFlu(r,1_000_000)).toBe(true);
  const clean=assessMedical(r);
  expect(clean.capacities.consciousness).toBeLessThan(1);
  expect(clean.capacities.manipulation).toBeLessThan(1);
  expect(clean.capacities.breathing).toBeLessThan(1);
  r.flu!.severity=833_000_000;
  expect(fluModifiers(r.flu).pain).toBe(.05);
  expect(assessMedical(r).capacities.consciousness).toBeLessThan(clean.capacities.consciousness);
  r.flu!.severity=FLU_UNIT;reconcileMedicalDeath(r);
  expect(r.death).toEqual({tick:0,cause:'flu'});
  expect(valid(r)).toBeNull();
  const falseCause=structuredClone(r);falseCause.death!.cause='infection';
  expect(valid(falseCause)).not.toBeNull();
});

test('flu progression, immunity and treatment are deterministic across split continuation',()=>{
  const initial=createMedicalRecord();acquireFlu(initial,1_000_000);
  const uninterrupted=structuredClone(initial),resumed=structuredClone(initial);
  advanceMedical(uninterrupted,2401,resting,noDraw);
  advanceMedical(resumed,1200,resting,noDraw);
  const checkpoint=JSON.parse(JSON.stringify(resumed)) as MedicalRecord;
  expect(valid(checkpoint)).toBeNull();
  advanceMedical(checkpoint,1201,resting,noDraw);
  expect(checkpoint).toEqual(uninterrupted);
  expect(uninterrupted.flu!.severity).toBeGreaterThan(FLU_INITIAL);
  expect(uninterrupted.flu!.immunity).toBeGreaterThan(0);
  expect(fluNeedsRest(uninterrupted)).toBe(true);
  expect(fluTendable(uninterrupted)).toBe(true);
  expect(tendFlu(uninterrupted,1000,316)).toBe(true);
  const expiry=uninterrupted.flu!.tend!.expiresAtCore;
  expect(expiry).toBe(uninterrupted.tick*10+30_000);
  expect(fluNextTendCore(uninterrupted.flu!)).toBe(expiry-6000+1);
  expect(tendFlu(uninterrupted,0,316)).toBe(false);
  const treated=structuredClone(uninterrupted),untreated=structuredClone(uninterrupted);
  delete untreated.flu!.tend;
  advanceMedical(treated,300,resting,noDraw);advanceMedical(untreated,300,resting,noDraw);
  expect(treated.flu!.severity).toBeLessThan(untreated.flu!.severity);
  expect(valid(treated)).toBeNull();
});

test('immunity reverses severity before recovery, then persists and wanes',()=>{
  const r=createMedicalRecord();acquireFlu(r,1_000_000);
  r.flu!.severity=100_000_000;r.flu!.immunity=FLU_UNIT;
  expect(fluNeedsRest(r)).toBe(false);
  expect(fluTendable(r)).toBe(false);
  advanceMedical(r,1250,standing,noDraw);
  expect(r.flu!.severity).toBe(0);
  expect(r.flu!.immunity).toBeGreaterThan(0);
  expect(r.flu!.tend).toBeUndefined();
  expect(valid(r)).toBeNull();
  const serial=JSON.parse(JSON.stringify(r)) as MedicalRecord;
  advanceMedical(r,300,standing,noDraw);advanceMedical(serial,300,standing,noDraw);
  expect(serial).toEqual(r);
  const invalid=structuredClone(r);invalid.flu!.immunity=FLU_UNIT+1;
  expect(valid(invalid)).not.toBeNull();
});

test('flu is a physical medical target, while immunity ends tending before the disease disappears',()=>{
  const w=medicalCamp(),p=w.pawns[0]!;
  p.health=createMedicalRecord(w.tick);acquireFlu(p.health,1_000_000);
  expect(treatmentTarget(p)).toEqual({flu:true});
  expect(treatmentTargets(p)).toHaveLength(1);
  expect(medicalRestNeeded(p)).toBe(true);
  expect(tendFlu(p.health,900,316)).toBe(true);
  expect(treatmentTarget(p)).toBeUndefined();
  p.health.flu!.immunity=FLU_UNIT;
  expect(medicalRestNeeded(p)).toBe(false);
  expect(p.health.flu!.severity).toBe(FLU_INITIAL);
});

test('major flu vomits at a scheduled interval and retains the physical episode until it ends',()=>{
  const r=createMedicalRecord();acquireFlu(r,1_000_000);r.flu!.severity=666_000_000;
  expect(fluVomitChance(r.flu)).toBeGreaterThan(0);
  let draws=0,deposits=0,starts=0;
  const context={awake:true,position:{x:1,z:2},foodLevel:100,foodMax:100,random:()=>{draws++;return 0;},
    canStand:()=>true,start:()=>{starts++;return true;},deposit:()=>{deposits++;}};
  expect(processVomit(r.flu!,0,0,context,fluVomitChance(r.flu)).active).toBe(true);
  const atStart=draws;expect(atStart).toBeGreaterThan(0);expect(starts).toBe(1);
  for(let tick=1;tick<30;tick++)processVomit(r.flu!,tick,0,context,fluVomitChance(r.flu));
  expect(draws).toBe(atStart);expect(deposits).toBe(2); // pulses at 0 and 15
  expect(r.flu!.vomit).toBeUndefined();
  for(let tick=30;tick<60;tick++)processVomit(r.flu!,tick,0,context,fluVomitChance(r.flu));
  expect(draws).toBe(atStart);expect(deposits).toBe(2);
  expect(valid(r)).toBeNull();
});

test('a doctor carries and spends a real medicine dose, and treatment resumes from a saved task',()=>{
  const w=medicineCamp(),doctor=w.pawns[0]!,patient=w.pawns[1]!;
  patient.health!.injuries=[];
  expect(acquireFlu(patient.health!,1_000_000)).toBe(true);
  const before=w.piles.reduce((sum,p)=>sum+(p.kind==='medicine'?p.quantity:0),0);
  for(let i=0;i<800&&doctor.tend?.phase!=='tend';i++)stepWorld(w);
  expect(doctor.tend?.phase).toBe('tend');
  expect(validateWorld(w)).toEqual([]);
  const resumed=deserializeWorld(serializeWorld(w));
  for(let i=0;i<800&&!patient.health!.flu!.tend;i++)stepWorld(w);
  stepWorld(resumed,w.tick-resumed.tick);
  expect(resumed).toEqual(w);
  expect(patient.health!.flu!.tend?.quality).toBeGreaterThanOrEqual(0);
  expect(w.piles.reduce((sum,p)=>sum+(p.kind==='medicine'?p.quantity:0),0)).toBe(before-1);
  expect(doctor.skills.medicine.xp).toBeGreaterThan(0);
  expect(validateWorld(w)).toEqual([]);
});
