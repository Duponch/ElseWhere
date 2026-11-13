import { expect,test } from 'vitest';
import { advanceMedical } from '../src/sim/injury-evolution.ts';
import { createMedicalRecord,partMissing } from '../src/sim/injury-state.ts';
import { immunityGainSpeed } from '../src/sim/infection-rules.ts';
import { healthRandom,updatePawnHealth } from '../src/sim/health.ts';
import { pawnBody } from '../src/sim/health-rules.ts';
import { humanAgeImmunityFactor } from '../src/sim/human-age.ts';
import { COMPLEX_FURNITURE_RESEARCH_COST,MICROELECTRONICS_RESEARCH_COST,HOSPITAL_BED_RESEARCH_COST } from '../src/sim/research.ts';
import { currentMedicalBed,bedHealPerDay,bedImmunityFactor,bedTendOffset,bedSurgeryFactor } from '../src/sim/hospital-medical-stats.ts';
import { tendQuality } from '../src/sim/medicine-rules.ts';
import { medicalTendQuality } from '../src/sim/care-rules.ts';
import { tendingReason,processTending } from '../src/sim/tending.ts';
import { surgerySuccessChance } from '../src/sim/surgery-rules.ts';
import { surgeryReason } from '../src/sim/surgery.ts';
import { applyCommand,stepWorld } from '../src/sim/engine.ts';
import { serializeWorld,deserializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { medicalCamp,controlledInjury } from './scenarios/health.ts';
import { fixtureBuilding } from './scenarios/deconstruction.ts';
import { medicineCamp } from './scenarios/medicine.ts';
import { surgeryCamp } from './helpers/surgery-v192.ts';
import type { MedicalContext } from '../src/sim/injury-types.ts';
import type { Structure,World } from '../src/sim/types.ts';

const base:MedicalContext={phase:0,posture:'standing',starving:false};
function wound() {
  const record=createMedicalRecord();
  record.nextInjuryId=2;record.injuries=[{id:1,part:'left-arm',kind:'bruise',severity:5000,bornAt:0}];
  return record;
}
function valid(world:World) {expect(validateWorld(world),`tick ${world.tick}`).toEqual([]);}
function until(world:World,done:()=>boolean,limit=1200) {
  for(let tick=0;tick<limit&&!done();tick++){stepWorld(world);valid(world);}
  expect(done(),`transition not reached at tick ${world.tick}`).toBe(true);
}
const units=(world:World)=>world.piles.reduce((total,pile)=>total+(pile.kind==='medicine'?pile.quantity:0),0);
/** Prepared prerequisites isolate clinical services. Actual research and
 * construction are exercised by the separate V205 acquisition tests. */
function hospitalResearch(world:World):void {
  world.research={...world.research??{points:0},project:null,
    complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:world.tick},
    microelectronics:{points:MICROELECTRONICS_RESEARCH_COST,completedAt:world.tick},
    hospitalBed:{points:HOSPITAL_BED_RESEARCH_COST,completedAt:world.tick}};
}
function lyingWorld(kind:'bed'|'hospital-bed'='hospital-bed') {
  const world=medicalCamp(2),patient=world.pawns[0]!;
  if(kind==='hospital-bed')hospitalResearch(world);
  const bed:Structure=fixtureBuilding(world,kind,patient.x,patient.z);bed.material='steel';
  controlledInjury(world,patient,'left-arm',5000,'bruise');
  patient.state='resting';patient.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:bed.x,z:bed.z},medical:'bedrest'};
  return {world,patient,bed};
}

test('hospital healing adds six HP/day to the real bed rate, keeps tended healing separate and preserves historical contexts',()=>{
  for(const [context,healed] of [[base,80],[{...base,posture:'ground'},120],[{...base,posture:'bed'},160],
    [{...base,posture:'bed',bedHealPerDay:10},220],[{...base,bedHealPerDay:10},80],
    [{...base,posture:'ground',bedHealPerDay:10},120]] as const) {
    const record=wound();advanceMedical(record,60,context,()=>0);
    expect(record.injuries[0]!.severity).toBe(5000-healed);
  }
  const tended=wound();tended.injuries[0]!.tended=1000;
  advanceMedical(tended,60,{...base,posture:'bed',bedHealPerDay:10},()=>0);
  expect(tended.injuries[0]!.severity).toBe(5000-220-120);
  const starving=wound();starving.injuries[0]!.tended=1000;
  advanceMedical(starving,60,{...base,posture:'bed',bedHealPerDay:10,starving:true},()=>{throw Error('Starvation cannot heal');});
  expect(starving.injuries[0]!.severity).toBe(5000);
  const selected=wound();selected.nextInjuryId=3;selected.injuries.push({id:2,part:'right-arm',kind:'bruise',severity:5000,bornAt:0});
  advanceMedical(selected,60,{...base,posture:'bed',bedHealPerDay:10},()=>0);
  expect(selected.injuries.map(i=>i.severity)).toEqual([4780,5000]);
});

test('hospital immunity replaces only the actual bed factor and does not depend on quality',()=>{
  const record=wound();
  expect(immunityGainSpeed(record,{...base,posture:'bed',restingBonus:true})).toBeCloseTo(1.177);
  expect(immunityGainSpeed(record,{...base,posture:'bed',restingBonus:true,bedImmunityFactor:1.11})).toBeCloseTo(1.221);
  expect(immunityGainSpeed(record,{...base,bedImmunityFactor:1.11})).toBe(1);
  expect(immunityGainSpeed(record,{...base,posture:'bed',restingBonus:true,bedImmunityFactor:1.11,hunger:0,rest:0},.5)).toBeCloseTo(.75*.7*.8*1.221);
  for(const kind of ['bed','hospital-bed'] as const)for(const quality of ['awful','legendary'] as const) {
    const {world,patient,bed}=lyingWorld(kind);bed.quality=quality;
    patient.health!.infections={nextId:2,immunity:0,cases:[{id:1,part:'right-arm',bornAt:world.tick,severity:100000000,luck:1000000}]};
    const filtration=pawnBody(patient).capacities.bloodFiltration,age=humanAgeImmunityFactor(patient.age);
    world.tick++;updatePawnHealth(world,patient);
    expect(patient.health!.infections!.immunity).toBe(Math.round(.6441*(.5+.5*filtration)*age*bedImmunityFactor(bed)*1.1*1000000000/6000));
    expect(bedHealPerDay(bed)).toBe(kind==='bed'?4:10);
  }
});

test('optional medical bed context rejects invalid values before mutation and never persists in the record',()=>{
  for(const context of [{...base,bedHealPerDay:NaN},{...base,bedHealPerDay:2.5},{...base,bedImmunityFactor:1.07+1.11},{...base,bedImmunityFactor:Infinity}]) {
    const record=wound(),before=structuredClone(record);
    expect(()=>advanceMedical(record,60,context as MedicalContext,()=>0)).toThrow('Invalid medical interval');expect(record).toEqual(before);
  }
  const record=wound();advanceMedical(record,60,{...base,posture:'bed',bedHealPerDay:10,bedImmunityFactor:1.11},()=>0);
  expect(Object.hasOwn(record,'bedHealPerDay')).toBe(false);expect(Object.hasOwn(record,'bedImmunityFactor')).toBe(false);
});

test('clinical interval changes settle the previous posture and continuation preserves healing, immunity and RNG',()=>{
  const record=wound(),stream={rng:17};
  record.infections={nextId:2,immunity:0,cases:[{id:1,part:'right-arm',bornAt:0,severity:100000000,luck:1000000}]};
  advanceMedical(record,60,base,()=>healthRandom(stream));expect(record.injuries[0]!.severity).toBe(4920);
  const checkpoint=JSON.parse(JSON.stringify({record,stream})) as {record:typeof record;stream:typeof stream};
  const hospital:MedicalContext={...base,posture:'bed',restingBonus:true,bedHealPerDay:10,bedImmunityFactor:1.11};
  advanceMedical(record,60,hospital,()=>healthRandom(stream));
  for(let i=0;i<60;i++)advanceMedical(checkpoint.record,1,hospital,()=>healthRandom(checkpoint.stream));
  expect(checkpoint).toEqual({record,stream});expect(record.injuries[0]!.severity).toBe(4700);
  advanceMedical(record,60,base,()=>healthRandom(stream));expect(record.injuries[0]!.severity).toBe(4620);
});

test('World clinical consultation reads the physically occupied bed, excluding travel, carried bodies, missing beds and death',()=>{
  for(const [mode,healed] of [['hospital',220],['ordinary',160],['travel',80],['carried',80],['missing',120],['elsewhere',120],['historical',120]] as const) {
    const {world,patient,bed}=lyingWorld(mode==='ordinary'?'bed':'hospital-bed');
    if(mode==='travel'){patient.state='moving';patient.need!.phase='travel';}
    if(mode==='carried')world.pawns[1]!.rescue={patientId:patient.id,bedId:bed.id,phase:'carry'};
    if(mode==='missing')world.structures=[];
    if(mode==='elsewhere')patient.x++;
    if(mode==='historical')world.schemaVersion=186 as World['schemaVersion'];
    expect(!!currentMedicalBed(world,patient)).toBe(mode==='hospital'||mode==='ordinary');
    world.tick+=60;updatePawnHealth(world,patient);
    expect(patient.health!.injuries[0]!.severity,mode).toBe(5000-healed);
  }
  const {world,patient}=lyingWorld();patient.state='dead';patient.health!.death={tick:world.tick,cause:'trauma'};
  const before=structuredClone(patient.health);world.tick+=60;updatePawnHealth(world,patient);expect(patient.health).toEqual(before);
});

test('hospital tending adds an offset after potency and variance, before self reduction and all medication caps',()=>{
  expect(tendQuality(1,.5,false,undefined,.1,316)).toBe(400);
  expect(tendQuality(1,.5,false,'herbal-medicine',.1,316)).toBe(700);
  expect(tendQuality(1,.5,true,'medicine',.1,316)).toBe(770);
  expect(tendQuality(.2,1,true,'medicine',.1,316)).toBe(385);
  expect(tendQuality(5,0,false,'herbal-medicine',.1,316)).toBe(700);
  expect(tendQuality(5,0,false,'medicine',.1,316)).toBe(1000);
  expect(tendQuality(5,0,false,'glitterworld-medicine',.1,316)).toBe(1300);
  // These historical witnesses distinguish the old variation/clamp order.
  expect(tendQuality(5,0,false,'herbal-medicine')).toBe(450);
  expect(tendQuality(.2,1,true,'medicine')).toBe(390);
});

test('real tending admits the patient, carries and consumes one herbal dose, uses the current hospital bed and resumes exactly',()=>{
  const world=medicineCamp(1,32,'herbal-medicine'),doctor=world.pawns[0]!,patient=world.pawns[1]!,bed=world.structures[0]!;
  hospitalResearch(world);
  bed.kind='hospital-bed';bed.material='steel';
  until(world,()=>doctor.tend?.phase==='pickup');expect(doctor.skills.medicine.xp).toBe(0);expect(units(world)).toBe(4);
  until(world,()=>doctor.tend?.phase==='tend');expect(currentMedicalBed(world,patient)?.id).toBe(bed.id);
  const ordinary=deserializeWorld(serializeWorld(world));ordinary.structures[0]!.kind='bed';
  const resumed=deserializeWorld(serializeWorld(world));
  // Pause/serialization is read-only; the saved duration, source and clinical
  // clocks are conserved without any bonus, consumption or random draw.
  expect(resumed).toEqual(world);const checkpoint=serializeWorld(world);expect(serializeWorld(world)).toBe(checkpoint);
  for(let i=0;i<120&&doctor.skills.medicine.xp===0;i++){stepWorld(world);stepWorld(ordinary);stepWorld(resumed);valid(world);valid(ordinary);valid(resumed);}
  expect(doctor.skills.medicine.xp).toBe(87500);expect(units(world)).toBe(3);expect(world).toEqual(resumed);
  expect(world.rng).toBe(ordinary.rng);
  for(const injury of patient.health!.injuries) {
    const historical=ordinary.pawns[1]!.health!.injuries.find(i=>i.id===injury.id)!;
    expect(injury.tended).toBe(Math.min(700,historical.tended!+100));
  }
  expect(doctor.skills.medicine.xp).toBe(ordinary.pawns[0]!.skills.medicine.xp);
});

test('tending refuses a patient not physically installed and grants no treatment, XP, dose or remote hospital bonus',()=>{
  const world=medicineCamp(),doctor=world.pawns[0]!,patient=world.pawns[1]!;
  hospitalResearch(world);
  world.structures[0]!.kind='hospital-bed';world.structures[0]!.material='steel';doctor.priorities.doctor=0;
  until(world,()=>patient.state==='resting');doctor.priorities.doctor=1;
  for(const reason of ['travel','missing','elsewhere','carried','dead'] as const) {
    const copy=structuredClone(world),d=copy.pawns[0]!,p=copy.pawns[1]!,bed=copy.structures[0]!;
    if(reason==='travel'){p.need!.phase='travel';p.state='moving';}
    if(reason==='missing')copy.structures=[];
    if(reason==='elsewhere')p.x++;
    if(reason==='carried')d.rescue={patientId:p.id,bedId:bed.id,phase:'carry'};
    if(reason==='dead')p.state='dead';
    expect(tendingReason(copy,d,p),reason).toBeDefined();
    const before=structuredClone({health:p.health,xp:d.skills.medicine.xp,units:units(copy),rng:copy.rng});
    expect(applyCommand(copy,{type:'order-tend',pawnId:d.id,patientId:p.id,queue:false}).ok).toBe(false);
    expect({health:p.health,xp:d.skills.medicine.xp,units:units(copy),rng:copy.rng}).toEqual(before);
  }
  // The ordinary self-care provider stands to work and consequently receives
  // no bed bonus, even when its former bed is the hospital definition.
  const {world:selfWorld,patient:self,bed:selfBed}=lyingWorld();self.selfTend=true;self.priorities.doctor=1;self.need=null;self.state='working';self.x=selfBed.x+1;
  self.tend={patientId:self.id,spot:{x:self.x,z:self.z},phase:'tend',progress:590,duration:600};
  const stream={rng:selfWorld.rng},draw=healthRandom(stream),stat=medicalTendQuality(self);
  processTending(selfWorld,self,{search:()=>null,move:()=>{throw Error('Unexpected movement');},release:()=>true,event:()=>{}},()=>1);
  expect(self.health!.injuries[0]!.tended).toBe(tendQuality(stat,draw,true));expect(bedTendOffset(currentMedicalBed(selfWorld,self))).toBe(0);
});

test('hospital surgery multiplies quality and environment once, requires physical admission and retains the operation across reload',()=>{
  const prepared=surgeryCamp(),world=prepared.world,doctor=world.pawns.find(p=>p.id===prepared.doctorId)!,patient=world.pawns.find(p=>p.id===prepared.patientId)!;
  hospitalResearch(world);
  const bed=world.structures.find(s=>s.id===prepared.bedId)!;bed.kind='hospital-bed';bed.material='steel';bed.quality='good';
  const chanceInput={doctor,medicine:'medicine' as const,bedQuality:'good' as const,patientGlow:0,roomCleanliness:null,outdoors:true};
  const ordinary=surgerySuccessChance(chanceInput);
  expect(surgerySuccessChance({...chanceInput,bedSurgeryFactor:bedSurgeryFactor(bed)})).toBeCloseTo(ordinary*1.1);
  expect(surgerySuccessChance({...chanceInput,patientGlow:1,roomCleanliness:5,outdoors:false,bedSurgeryFactor:1.1})).toBe(.98);
  expect(applyCommand(world,{type:'surgery-request',pawnId:patient.id,part:'left-arm'})).toEqual({ok:true});
  doctor.priorities.doctor=1;
  expect(surgeryReason(world,doctor,patient)).toMatch(/installé dans un lit/);expect(patient.health!.anesthetic).toBeUndefined();
  doctor.priorities.doctor=0;
  until(world,()=>!!currentMedicalBed(world,patient));expect(units(world)).toBe(3);
  doctor.priorities.doctor=1;doctor.planCooldown=0;
  for(const missing of ['bed','position','carry'] as const) {
    const copy=structuredClone(world),d=copy.pawns.find(p=>p.id===doctor.id)!,p=copy.pawns.find(q=>q.id===patient.id)!;
    if(missing==='bed')copy.structures=[];
    if(missing==='position')p.x++;
    if(missing==='carry')d.rescue={patientId:p.id,bedId:bed.id,phase:'carry'};
    expect(surgeryReason(copy,d,p)).toBeDefined();expect(p.health!.anesthetic).toBeUndefined();expect(units(copy)).toBe(3);
  }
  until(world,()=>doctor.surgery?.phase==='work');expect(units(world)).toBe(2);expect(patient.health!.anesthetic).toBeDefined();
  const resumed=deserializeWorld(serializeWorld(world));expect(resumed).toEqual(world);
  for(let i=0;i<500&&doctor.surgery;i++){stepWorld(world);stepWorld(resumed);valid(world);valid(resumed);}
  expect(world).toEqual(resumed);expect(doctor.surgery).toBeUndefined();expect(doctor.skills.medicine.xp).toBeGreaterThan(0);
  expect(partMissing(patient.health!,'left-arm')).toBe(true);expect(units(world)).toBe(2);expect(patient.health!.anesthetic).toBeDefined();
});
