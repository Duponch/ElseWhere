import {expect,test} from 'vitest';
import {asOldSchema} from './scenarios/old-schema.ts';
import {medicineCamp} from './scenarios/medicine.ts';
import {medicalCamp} from './scenarios/health.ts';
import {createMedicalRecord,medicalPain} from '../src/sim/injury-state.ts';
import {pawnBody} from '../src/sim/health-rules.ts';
import {depletedHumanHunger,depletedHumanRest} from '../src/sim/human-need-rates.ts';
import {medicalRestNeeded,treatmentTarget,treatmentTargets} from '../src/sim/care-rules.ts';
import {resolveHumanTendBatch} from '../src/sim/care-resolution.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {validateMedicalRecord} from '../src/sim/injury-validation.ts';
import {resolveParasiteIncident306} from '../src/sim/flu-incidents.ts';
import {PARASITE_CURE_TOTAL306,PARASITE_TEND_DURATION_CORE306,PARASITE_TEND_OVERLAP_CORE306,acquireParasite306,parasiteRestFactor306,parasiteTendable306,tendParasite306} from '../src/sim/parasites-306.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';

test('gut worms: +20 % pain, hunger falls twice as fast, the sick thought; no bed rest needed',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.health=createMedicalRecord(w.tick);p.hunger=60;
  const before=p.hunger-depletedHumanHunger(p,false),pain=medicalPain(p.health);
  expect(acquireParasite306(p.health,'gut-worms')).toBe(true);
  expect(acquireParasite306(p.health,'gut-worms')).toBe(false);
  expect(medicalPain(p.health)).toBeCloseTo(pain+.2,6);
  expect(p.hunger-depletedHumanHunger(p,false)).toBeCloseTo(before*2,9);
  expect(parasiteRestFactor306(p.health)).toBe(1);
  expect(moodThoughts(w,p).some(t=>t.id==='sick')).toBe(true);
  expect(medicalRestNeeded(p)).toBe(false);
  expect(validateWorld(w)).toEqual([]);
});

test('muscle parasites: manipulation and moving -30 points, rest falls twice as fast',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.health=createMedicalRecord(w.tick);
  const healthy=pawnBody(p).capacities;
  acquireParasite306(p.health,'muscle-parasites');
  const ill=pawnBody(p).capacities;
  expect(ill.manipulation).toBeLessThan(healthy.manipulation);expect(ill.moving).toBeLessThan(healthy.moving);
  const fall=(factor:number)=>60-depletedHumanRest(60,false,factor);
  expect(fall(parasiteRestFactor306(p.health))).toBeCloseTo(fall(1)*2,9);
  expect(p.hunger-depletedHumanHunger(p,false)).toBeGreaterThan(0);
});

test('a tend lasts 48 hours plus a 3 hour overlap and the ailment ends once the tends add up to 3',()=>{
  const record=createMedicalRecord(100);acquireParasite306(record,'muscle-parasites');
  expect(tendParasite306(record,'muscle-parasites',1000)).toBe(true);
  expect(record.parasites306!['muscle-parasites']!.tend!.expiresAtCore).toBe(1000+PARASITE_TEND_DURATION_CORE306);
  expect(parasiteTendable306(record,'muscle-parasites')).toBe(false);
  expect(tendParasite306(record,'muscle-parasites',1000)).toBe(false);
  // Renewable only in the last 3 hours, adding to what remains.
  record.tick+=(PARASITE_TEND_DURATION_CORE306-PARASITE_TEND_OVERLAP_CORE306)/10;
  expect(parasiteTendable306(record,'muscle-parasites')).toBe(false);
  record.tick++;
  expect(parasiteTendable306(record,'muscle-parasites')).toBe(true);
  const left=record.parasites306!['muscle-parasites']!.tend!.expiresAtCore-record.tick*10;
  tendParasite306(record,'muscle-parasites',1000);
  expect(record.parasites306!['muscle-parasites']!.tend!.expiresAtCore-record.tick*10).toBe(left+PARASITE_TEND_DURATION_CORE306);
  record.tick+=PARASITE_TEND_DURATION_CORE306/10;
  expect(record.parasites306!['muscle-parasites']!.totalTend).toBe(2000);
  tendParasite306(record,'muscle-parasites',PARASITE_CURE_TOTAL306-2000);
  expect(record.parasites306).toBeUndefined();
});

test('parasites are care targets; a tend through the human resolver applies its quality',()=>{
  const w=medicalCamp(2),doctor=w.pawns[0]!,patient=w.pawns[1]!;
  patient.health=createMedicalRecord(w.tick);patient.medicalCare='best';
  acquireParasite306(patient.health,'gut-worms');acquireParasite306(patient.health,'muscle-parasites');
  expect(treatmentTarget(patient)).toEqual({disease:'gut-worms'});
  const targets=treatmentTargets(patient);expect(targets.map(t=>t.disease)).toEqual(['gut-worms','muscle-parasites']);
  patient.medicalCare='none';expect(treatmentTargets(patient)).toEqual([]);patient.medicalCare='best';
  resolveHumanTendBatch(patient,doctor,[targets[0]!],{random:()=>.5,awardJobXp:false,medicine:'medicine',bedOffset:0,infectionRoomFactor:()=>{throw Error('A parasite queried a wound room');}});
  expect(patient.health.parasites306!['gut-worms']!.tend!.quality).toBeGreaterThan(0);
  expect(treatmentTarget(patient)).toEqual({disease:'muscle-parasites'});
  expect(validateWorld(w)).toEqual([]);
});

test('an actual doctor fetches medicine and tends gut worms; the save resumes the same treatment',()=>{
  const w=medicineCamp(),doctor=w.pawns[0]!,patient=w.pawns[1]!;
  patient.health!.injuries=[];acquireParasite306(patient.health!,'gut-worms');
  const doses=()=>w.piles.reduce((n,p)=>n+(p.kind==='medicine'?p.quantity:0),0),before=doses();
  for(let i=0;i<800&&doctor.tend?.phase!=='tend';i++)stepWorld(w);
  expect(doctor.tend?.phase).toBe('tend');expect(validateWorld(w)).toEqual([]);
  const resumed=deserializeWorld(serializeWorld(w));
  for(let i=0;i<800&&!patient.health!.parasites306!['gut-worms']!.tend;i++)stepWorld(w);
  stepWorld(resumed,w.tick-resumed.tick);
  expect(resumed).toEqual(w);expect(doses()).toBe(before-1);
  expect(patient.health!.parasites306!['gut-worms']!.tend!.expiresAtCore).toBe(patient.health!.tick*10+PARASITE_TEND_DURATION_CORE306);
  expect(doctor.skills.medicine.xp).toBeGreaterThan(0);
});

test('the disease incident infects 20 to 50 % of the colonists, never twice, gut worms need a stomach',()=>{
  const w=medicalCamp(6);
  const calendar={adoptedAt:1,rng:12345,draws:1,episodes:0,cases:0};
  const got=resolveParasiteIncident306(w,'gut-worms',calendar);
  expect(got).toBeGreaterThanOrEqual(1);expect(got).toBeLessThanOrEqual(3);
  expect(w.pawns.filter(p=>p.health?.parasites306?.['gut-worms']).length).toBe(got);
  expect(calendar).toMatchObject({episodes:1,cases:got});
  // Already infected colonists are not candidates; when all are, nothing happens.
  for(const p of w.pawns){p.health??=createMedicalRecord(w.tick);acquireParasite306(p.health,'gut-worms');}
  expect(resolveParasiteIncident306(w,'gut-worms',calendar)).toBe(0);
  const w2=medicalCamp(2);
  for(const p of w2.pawns){p.health=createMedicalRecord(w2.tick);p.health.missing.push({part:'stomach',bornAt:w2.tick,nonFresh:true});}
  expect(resolveParasiteIncident306(w2,'gut-worms',{adoptedAt:1,rng:7,draws:1,episodes:0,cases:0})).toBe(0);
  expect(resolveParasiteIncident306(w2,'muscle-parasites',{adoptedAt:1,rng:7,draws:1,episodes:0,cases:0})).toBeGreaterThan(0);
  // Never before schema 306.
  const old=medicalCamp(2);old.schemaVersion=305 as never;
  expect(resolveParasiteIncident306(old,'muscle-parasites',{adoptedAt:1,rng:7,draws:1,episodes:0,cases:0})).toBe(0);
});

/** null when valid (the validator returns its failure text). */
const check=(record:unknown,version:number)=>validateMedicalRecord(structuredClone(record),true,true,true,true,false,false,true,true,true,true,true,version,true);

test('save: parasites round-trip at 306, are refused at 305, and a 305 save migrates by its number only',()=>{
  const w=medicalCamp(2),p=w.pawns[1]!;p.health=createMedicalRecord(w.tick);
  acquireParasite306(p.health,'muscle-parasites');tendParasite306(p.health,'muscle-parasites',800);
  const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
  expect(check(p.health,SCHEMA_VERSION)).toBeNull();
  expect(check(p.health,305)).not.toBeNull();
  // A tend total at or above the cure total is not a living case.
  const cured=structuredClone(p.health);cured.parasites306!['muscle-parasites']!.totalTend=PARASITE_CURE_TOTAL306;
  expect(check(cured,SCHEMA_VERSION)).not.toBeNull();
  delete p.health.parasites306;const current=serializeWorld(w);
  expect(current.startsWith(`{"schemaVersion":${SCHEMA_VERSION},`)).toBe(true);
  const old=asOldSchema(current,305);
  expect(serializeWorld(deserializeWorld(old))).toBe(current);
});
