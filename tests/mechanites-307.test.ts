import {expect,test} from 'vitest';
import {medicineCamp} from './scenarios/medicine.ts';
import {medicalCamp} from './scenarios/health.ts';
import {createMedicalRecord,medicalPain} from '../src/sim/injury-state.ts';
import {advanceMedical} from '../src/sim/injury-evolution.ts';
import {pawnBody} from '../src/sim/health-rules.ts';
import {depletedHumanRest} from '../src/sim/human-need-rates.ts';
import {treatmentTarget,treatmentTargets} from '../src/sim/care-rules.ts';
import {resolveHumanTendBatch} from '../src/sim/care-resolution.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {validateMedicalRecord} from '../src/sim/injury-validation.ts';
import {resolveMechaniteIncident307} from '../src/sim/flu-incidents.ts';
import {parasiteRestFactor306} from '../src/sim/parasites-306.ts';
import {MECHANITE_DISAPPEAR_MAX_CORE307,MECHANITE_DISAPPEAR_MIN_CORE307,MECHANITE_MIN307,MECHANITE_STAGE_TWO307,MECHANITE_TEND_DURATION_CORE307,MECHANITE_UNIT307,
  acquireMechanite307,advanceMechanites307,tendMechanite307} from '../src/sim/mechanites-307.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';

const check=(record:unknown,version:number)=>validateMedicalRecord(structuredClone(record),true,true,true,true,false,false,true,true,true,true,true,version,true);
const day=6000;
const ctx={phase:0,posture:'standing' as const,starving:false,hunger:80,rest:80},noRandom=()=>{throw Error('Mechanites drew a medical random');};

test('mechanites rise 0.25 a day from 0.001; stage two after two days; capped at 1',()=>{
  const r=createMedicalRecord(0);acquireMechanite307(r,'fibrous-mechanites',0);
  const m=r.mechanites307!['fibrous-mechanites']!;expect(m.severity).toBe(MECHANITE_MIN307);
  expect(m.disappearsAtCore).toBe(MECHANITE_DISAPPEAR_MIN_CORE307);
  for(let i=0;i<day;i++){r.tick++;advanceMechanites307(r);}
  expect(m.severity).toBe(MECHANITE_MIN307+MECHANITE_UNIT307/4);
  for(let i=0;i<day;i++){r.tick++;advanceMechanites307(r);}
  expect(m.severity).toBeGreaterThanOrEqual(MECHANITE_STAGE_TWO307);
  for(let i=0;i<3*day;i++){r.tick++;advanceMechanites307(r);}
  expect(m.severity).toBe(MECHANITE_UNIT307);
});

test('a tend of quality q lowers the severity by q a day for 51 hours, never under 0.001',()=>{
  const r=createMedicalRecord(0);acquireMechanite307(r,'sensory-mechanites',.5);
  const m=r.mechanites307!['sensory-mechanites']!;m.severity=MECHANITE_UNIT307/2;
  expect(tendMechanite307(r,'sensory-mechanites',1000)).toBe(true);
  expect(m.tend!.expiresAtCore).toBe(MECHANITE_TEND_DURATION_CORE307);
  expect(tendMechanite307(r,'sensory-mechanites',1000)).toBe(false);
  for(let i=0;i<day;i++){r.tick++;advanceMechanites307(r);}
  // 0.25 - 1.0 = -0.75 a day.
  expect(m.severity).toBe(MECHANITE_UNIT307/2-MECHANITE_UNIT307*3/4<MECHANITE_MIN307?MECHANITE_MIN307:MECHANITE_UNIT307/2-MECHANITE_UNIT307*3/4);
  for(let i=day;i<MECHANITE_TEND_DURATION_CORE307/10;i++){r.tick++;advanceMechanites307(r);}
  expect(m.severity).toBe(MECHANITE_MIN307);expect(m.tend).toBeUndefined();
  expect(tendMechanite307(r,'sensory-mechanites',500)).toBe(true);
});

test('mechanites leave by themselves after their 15 to 30 day lifetime',()=>{
  const r=createMedicalRecord(0);acquireMechanite307(r,'fibrous-mechanites',.999999);
  expect(r.mechanites307!['fibrous-mechanites']!.disappearsAtCore).toBe(MECHANITE_DISAPPEAR_MAX_CORE307);
  const r2=createMedicalRecord(0);acquireMechanite307(r2,'fibrous-mechanites',0);
  advanceMedical(r2,MECHANITE_DISAPPEAR_MIN_CORE307/10-1,ctx,noRandom);
  expect(r2.mechanites307).toBeDefined();
  advanceMedical(r2,1,ctx,noRandom);
  expect(r2.mechanites307).toBeUndefined();
});

test('effects: pain by stage, capacities raised, rest falls 1.7 or 2 times as fast, sick thought',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.health=createMedicalRecord(w.tick);
  const healthy=pawnBody(p).capacities,pain=medicalPain(p.health);
  acquireMechanite307(p.health,'fibrous-mechanites',0);
  expect(medicalPain(p.health)).toBeCloseTo(pain+.2,6);
  expect(parasiteRestFactor306(p.health)).toBeCloseTo(1.7,9);
  const fibrous=pawnBody(p).capacities;
  expect(fibrous.manipulation).toBeGreaterThan(healthy.manipulation);expect(fibrous.bloodPumping).toBeGreaterThan(healthy.bloodPumping);
  p.health.mechanites307!['fibrous-mechanites']!.severity=MECHANITE_STAGE_TWO307;
  expect(medicalPain(p.health)).toBeCloseTo(pain+.6,6);expect(parasiteRestFactor306(p.health)).toBe(2);
  expect(60-depletedHumanRest(60,false,parasiteRestFactor306(p.health))).toBeCloseTo((60-depletedHumanRest(60,false))*2,9);
  delete p.health.mechanites307;acquireMechanite307(p.health,'sensory-mechanites',0);
  const sensory=pawnBody(p).capacities;
  expect(sensory.sight).toBeGreaterThan(healthy.sight);expect(sensory.hearing).toBeGreaterThan(healthy.hearing);expect(sensory.talking).toBeGreaterThan(healthy.talking);
  expect(moodThoughts(w,p).some(t=>t.id==='sick')).toBe(true);
  expect(validateWorld(w)).toEqual([]);
});

test('mechanites are care targets and a real doctor tends them; the save resumes exactly',()=>{
  const w=medicalCamp(2),doctor=w.pawns[0]!,patient=w.pawns[1]!;
  patient.health=createMedicalRecord(w.tick);patient.medicalCare='best';
  acquireMechanite307(patient.health,'sensory-mechanites',0);
  expect(treatmentTarget(patient)).toEqual({disease:'sensory-mechanites'});
  resolveHumanTendBatch(patient,doctor,[treatmentTargets(patient)[0]!],{random:()=>.5,awardJobXp:false,medicine:'medicine',bedOffset:0,infectionRoomFactor:()=>{throw Error('Mechanites queried a wound room');}});
  expect(patient.health.mechanites307!['sensory-mechanites']!.tend!.quality).toBeGreaterThan(0);
  const w2=medicineCamp(),doc=w2.pawns[0]!,pat=w2.pawns[1]!;
  pat.health!.injuries=[];acquireMechanite307(pat.health!,'fibrous-mechanites',.3);
  for(let i=0;i<800&&doc.tend?.phase!=='tend';i++)stepWorld(w2);
  expect(doc.tend?.phase).toBe('tend');
  const resumed=deserializeWorld(serializeWorld(w2));
  for(let i=0;i<800&&!pat.health!.mechanites307!['fibrous-mechanites']!.tend;i++)stepWorld(w2);
  stepWorld(resumed,w2.tick-resumed.tick);
  expect(resumed).toEqual(w2);
});

test('the disease incident gives mechanites to 20 to 50 % of the colonists, never twice, only from 307',()=>{
  const w=medicalCamp(6),calendar={adoptedAt:1,rng:4242,draws:1,episodes:0,cases:0};
  const got=resolveMechaniteIncident307(w,'fibrous-mechanites',calendar);
  expect(got).toBeGreaterThanOrEqual(1);expect(got).toBeLessThanOrEqual(3);
  const lives=w.pawns.flatMap(p=>p.health?.mechanites307?.['fibrous-mechanites']?[p.health.mechanites307['fibrous-mechanites'].disappearsAtCore-w.tick*10]:[]);
  expect(lives).toHaveLength(got);expect(lives.every(l=>l>=MECHANITE_DISAPPEAR_MIN_CORE307&&l<=MECHANITE_DISAPPEAR_MAX_CORE307)).toBe(true);
  for(const p of w.pawns){p.health??=createMedicalRecord(w.tick);acquireMechanite307(p.health,'fibrous-mechanites',0);}
  expect(resolveMechaniteIncident307(w,'fibrous-mechanites',calendar)).toBe(0);
  const old=medicalCamp(2);old.schemaVersion=306 as never;
  expect(resolveMechaniteIncident307(old,'sensory-mechanites',{adoptedAt:1,rng:7,draws:1,episodes:0,cases:0})).toBe(0);
});

test('save: mechanites round-trip at 307, are refused at 306, and a 306 save migrates by its number only',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.health=createMedicalRecord(w.tick);
  acquireMechanite307(p.health,'fibrous-mechanites',.5);tendMechanite307(p.health,'fibrous-mechanites',700);
  const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
  expect(check(p.health,SCHEMA_VERSION)).toBeNull();expect(check(p.health,306)).not.toBeNull();
  const bad=structuredClone(p.health);bad.mechanites307!['fibrous-mechanites']!.severity=MECHANITE_MIN307-1;
  expect(check(bad,SCHEMA_VERSION)).not.toBeNull();
  delete p.health.mechanites307;const current=serializeWorld(w);
  const old=current.replace(`{"schemaVersion":${SCHEMA_VERSION},`,'{"schemaVersion":306,');
  expect(serializeWorld(deserializeWorld(old))).toBe(current);
});

test('fibrous mechanites make a walking doctor faster than 100 %, and the save accepts it from 307',()=>{
  const w=medicineCamp(),doctor=w.pawns[0]!,patient=w.pawns[1]!;
  doctor.health??=createMedicalRecord(w.tick);acquireMechanite307(doctor.health,'fibrous-mechanites',0);
  expect(pawnBody(doctor).capacities.moving).toBeGreaterThan(1);
  patient.health!.injuries=[];acquireMechanite307(patient.health!,'sensory-mechanites',0);
  let fast=false;
  for(let i=0;i<400&&!fast;i++){stepWorld(w);fast=(doctor.motion?.speedFactor??0)>1;}
  expect(fast).toBe(true);expect(validateWorld(w)).toEqual([]);
  const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
});
