import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health.ts';
import {createMedicalRecord,medicalPain,reconcileMedicalDeath} from '../src/sim/injury-state.ts';
import {advanceMedical} from '../src/sim/injury-evolution.ts';
import {acquireImmuneDisease,immuneDiseaseTendable,tendImmuneDisease} from '../src/sim/immune-diseases-state.ts';
import {IMMUNE_DISEASE_UNIT,immuneDiseaseModifiers,immuneDiseaseStage,immuneDiseaseTendCore} from '../src/sim/immune-diseases-rules.ts';
import {treatmentTarget} from '../src/sim/care-rules.ts';
import {resolveImmuneDiseaseIncident} from '../src/sim/flu-incidents.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {validateMedicalRecord} from '../src/sim/injury-validation.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';

const check=(record:unknown,version:number)=>validateMedicalRecord(structuredClone(record),true,true,true,true,false,false,true,true,true,true,true,version,true);
const ctx={phase:0,posture:'bed' as const,starving:false,hunger:80,rest:80},noRandom=()=>{throw Error('Sleeping sickness drew a medical random');};

test('sleeping sickness rises 0.12 a day untreated, by stage, and kills at 100 %',()=>{
  const r=createMedicalRecord(0);expect(acquireImmuneDisease(r,'sleeping-sickness',1_000_000)).toBe(true);
  const s=r.immuneDiseases!['sleeping-sickness']!;
  advanceMedical(r,6000,ctx,noRandom);
  // About 0.12 a day before immunity wins (immunity grows 0.10 a day).
  expect(s.severity/IMMUNE_DISEASE_UNIT).toBeGreaterThan(.11);expect(s.severity/IMMUNE_DISEASE_UNIT).toBeLessThan(.14);
  expect(immuneDiseaseStage('sleeping-sickness',s.severity)).toBe('minor');
  s.severity=630_000_000;expect(immuneDiseaseStage('sleeping-sickness',s.severity)).toBe('extreme');
  const m=immuneDiseaseModifiers(r);expect(m.consciousnessOffset).toBeCloseTo(-.15,9);expect(m.manipulationOffset).toBeCloseTo(-.06,9);expect(m.pain).toBeCloseTo(.05,9);
  s.severity=940_000_000;expect(immuneDiseaseModifiers(r).consciousnessMax).toBe(.1);
  s.severity=IMMUNE_DISEASE_UNIT;reconcileMedicalDeath(r);expect(r.death?.cause).toBe('sleeping-sickness');
});

test('a tend lasts 32 hours plus the 3 hour overlap and slows the disease by 0.07 x quality a day',()=>{
  const r=createMedicalRecord(0);acquireImmuneDisease(r,'sleeping-sickness',1_000_000);
  expect(immuneDiseaseTendCore('sleeping-sickness')).toBe(87_500);expect(immuneDiseaseTendCore('malaria')).toBe(37_500);
  expect(tendImmuneDisease(r,'sleeping-sickness',1000)).toBe(true);
  expect(r.immuneDiseases!['sleeping-sickness']!.tend!.expiresAtCore).toBe(87_500);
  expect(immuneDiseaseTendable(r,'sleeping-sickness')).toBe(false);
  const treated=createMedicalRecord(0),untreated=createMedicalRecord(0);
  acquireImmuneDisease(treated,'sleeping-sickness',1_000_000);acquireImmuneDisease(untreated,'sleeping-sickness',1_000_000);
  tendImmuneDisease(treated,'sleeping-sickness',1000);
  advanceMedical(treated,3000,ctx,noRandom);advanceMedical(untreated,3000,ctx,noRandom);
  const gap=(untreated.immuneDiseases!['sleeping-sickness']!.severity-treated.immuneDiseases!['sleeping-sickness']!.severity)/IMMUNE_DISEASE_UNIT;
  expect(gap).toBeGreaterThan(.03);expect(gap).toBeLessThan(.04);
});

test('a colonist with sleeping sickness is a care target, feels sick and suffers its pain',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.health=createMedicalRecord(w.tick);p.medicalCare='best';
  const pain=medicalPain(p.health);acquireImmuneDisease(p.health,'sleeping-sickness',1_000_000);
  expect(treatmentTarget(p)).toEqual({disease:'sleeping-sickness'});
  expect(medicalPain(p.health)).toBeCloseTo(pain+.02,6);
  expect(moodThoughts(w,p).some(t=>t.id==='sick')).toBe(true);
  expect(validateWorld(w)).toEqual([]);
  const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
  expect(check(p.health,SCHEMA_VERSION)).toBeNull();expect(check(p.health,308)).not.toBeNull();
});

test('the disease incident reaches 20 to 50 % of the colonists, only from schema 309',()=>{
  const w=medicalCamp(6),calendar={adoptedAt:1,rng:99,draws:1,episodes:0,cases:0};
  const got=resolveImmuneDiseaseIncident(w,'sleeping-sickness',calendar);
  expect(got).toBeGreaterThanOrEqual(1);expect(got).toBeLessThanOrEqual(3);
  expect(w.pawns.filter(p=>p.health?.immuneDiseases?.['sleeping-sickness']).length).toBe(got);
  const old=medicalCamp(2);old.schemaVersion=308 as never;
  expect(resolveImmuneDiseaseIncident(old,'sleeping-sickness',{adoptedAt:1,rng:7,draws:1,episodes:0,cases:0})).toBe(0);
});

test('a schema 308 save migrates to 309 by its number only',()=>{
  const w=medicalCamp(2),current=serializeWorld(w);
  const old=current.replace(`{"schemaVersion":${SCHEMA_VERSION},`,'{"schemaVersion":308,');
  expect(serializeWorld(deserializeWorld(old))).toBe(current);
});
