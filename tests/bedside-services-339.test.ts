import {expect,test} from 'vitest';
import {medicalCamp,controlledInjury} from './scenarios/health.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {bedSlotCell} from '../src/sim/bed-slots.ts';
import {bedServicePlace339} from '../src/sim/care-access.ts';
import {surgeryProposal,surgeryReason} from '../src/sim/surgery.ts';
import {feedingProposal} from '../src/sim/feeding.ts';
import {feedingPlaceValid} from '../src/sim/feeding-rules.ts';
import {wardenProposal} from '../src/sim/warden.ts';
import {createPrisonerState} from '../src/sim/prisoner-state.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {addMaterial,addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SCHEMA_VERSION,type Cell,type Pawn,type Structure,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const reach=(w:World,p:Pawn)=>reachableCells(w,p,blockedCells(w),new Set());
const valid=(w:World)=>expect(validateWorld(w)).toEqual([]);
function until(w:World,done:()=>boolean,max=900){for(let n=0;n<max&&!done();n++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}
/** Prepared placement in bed (not an admission played by the patient): a
 * medical bed rests its patient without ownership, a prison bed is owned. */
function layInBed(w:World,p:Pawn,bedId:number,injured=true){
  const bed=w.structures.find(b=>b.id===bedId)!,head=bedSlotCell(bed,0)!;
  Object.assign(p,{...head,path:[],moveCooldown:0,motion:null,bedId:bed.medical?null:bedId,state:'resting'});
  if(injured){controlledInjury(w,p,'left-leg',30000);controlledInjury(w,p,'right-leg',30000);}
  p.need={kind:'sleep',phase:'sleep',bedId,target:head,...bed.medical?{medical:'patient' as const}:{}};
}
/** The Atterrissage layout (lot 336): three beds side by side, heads against a
 * wall. The middle bed has no free cell beside its head; the first free one in
 * Core's order is beyond the foot, at (10,12). */
function bedRow(w:World):Structure[] {
  const beds=[9,10,11].map(x=>fixtureBuilding(w,'bed',x,10));
  for(const x of [8,9,10,11,12])fixtureBuilding(w,'wall',x,9);
  fixtureBuilding(w,'wall',8,10);fixtureBuilding(w,'wall',12,10);
  return beds;
}
const beyondFoot:Cell={x:10,z:12};

test('surgery on a patient between two beds goes to the bed interaction cell from 339',()=>{
  const w=medicalCamp(3,32),[patient,doctor,neighbour]=w.pawns as [Pawn,Pawn,Pawn];
  const beds=bedRow(w);beds[1]!.medical=true;
  layInBed(w,patient,beds[1]!.id,false);patient.priorities.patient=1;
  patient.health=createMedicalRecord(w.tick);patient.medicalCare='best';
  patient.health.infections={nextId:2,immunity:0,cases:[{id:1,part:'left-arm',bornAt:w.tick,severity:100_000_000,luck:1_000_000,tend:{quality:1000,expiresAtCore:w.tick*10+37500}}]};
  patient.surgeryRequest={part:'left-arm',requestedAt:w.tick};
  Object.assign(neighbour,{x:25,z:25});Object.assign(doctor,{x:10,z:16});doctor.priorities.doctor=1;
  doctor.skills.medicine={level:8,xp:0,dailyXp:0,passion:0};
  addMaterial(w,'medicine',3,{type:'ground',x:12,z:16},'medicine');refreshStock(w);
  const proposal=surgeryProposal(w,doctor,patient,reach(w,doctor));
  expect(proposal?.task.spot).toEqual(beyondFoot);
  expect(bedServicePlace339(w,patient,beyondFoot)).toBe(true);
  // Before 339 surgery kept the four cells beside the head: none is free.
  setVersion(w,338);
  expect(surgeryProposal(w,doctor,patient,reach(w,doctor))).toBeUndefined();
  expect(bedServicePlace339(w,patient,beyondFoot)).toBe(false);
  setVersion(w,SCHEMA_VERSION);
  // The real operation: the surgeon takes the medicine and works from the foot.
  until(w,()=>doctor.surgery?.phase==='work');
  expect(doctor).toMatchObject({x:10,z:12,state:'working'});expect(surgeryReason(w,doctor,patient,true)).toBeUndefined();valid(w);
  const copy=deserializeWorld(serializeWorld(w));stepWorld(w,3);stepWorld(copy,3);expect(serializeWorld(copy)).toBe(serializeWorld(w));
});

test('feeding a patient between two beds falls back to beyond the foot; elsewhere it touches the patient',()=>{
  const w=medicalCamp(3,32),[patient,doctor,neighbour]=w.pawns as [Pawn,Pawn,Pawn];
  const beds=bedRow(w);beds[1]!.medical=true;layInBed(w,patient,beds[1]!.id);patient.hunger=20;
  Object.assign(neighbour,{x:25,z:25});Object.assign(doctor,{x:10,z:16});doctor.priorities.doctor=1;
  addGroundMaterial(w,'food',3,{x:12,z:16},'simple-meal');refreshStock(w);
  expect(feedingProposal(w,doctor,patient,reach(w,doctor))?.task.spot).toEqual(beyondFoot);
  setVersion(w,338);expect(feedingProposal(w,doctor,patient,reach(w,doctor))).toBeUndefined();setVersion(w,SCHEMA_VERSION);
  until(w,()=>doctor.feed?.phase==='feed');expect(doctor).toMatchObject({x:10,z:12});valid(w);
  until(w,()=>!doctor.feed);expect(patient.hunger).toBeGreaterThan(20);valid(w);

  // A free-standing bed: the cheapest cell touching the patient, never the
  // cells beyond the foot, even when the doctor comes from the foot side.
  const v=medicalCamp(2,32),[lying,carer]=v.pawns as [Pawn,Pawn];
  const bed:Structure=fixtureBuilding(v,'bed',15,15);bed.medical=true;layInBed(v,lying,bed.id);lying.hunger=20;
  Object.assign(carer,{x:15,z:22});carer.priorities.doctor=1;
  addGroundMaterial(v,'food',3,{x:15,z:24},'simple-meal');refreshStock(v);
  const spot=feedingProposal(v,carer,lying,reach(v,carer))!.task.spot;
  expect(Math.max(Math.abs(spot.x-15),Math.abs(spot.z-15))).toBe(1);
  // A corner of the head counts from 339 (Core Touch), not before.
  const task={patientId:lying.id,spot:{x:14,z:14},sourcePileId:null,carryPileId:null,quantity:1,phase:'pickup' as const,progress:0};
  expect(feedingPlaceValid(v,task,lying)).toBe(true);
  setVersion(v,338);expect(feedingPlaceValid(v,task,lying)).toBe(false);
});

test('a warden talks with a prisoner lying between two beds from beyond the foot',()=>{
  const w=medicalCamp(3,32),[prisoner,warden,neighbour]=w.pawns as [Pawn,Pawn,Pawn];
  const beds=bedRow(w);for(const b of beds)b.prisoner=true;beds[1]!.medical=true;
  layInBed(w,prisoner,beds[1]!.id);prisoner.hunger=100;prisoner.faction='outlaws';
  prisoner.prisoner=createPrisonerState(w,prisoner);prisoner.prisoner.mode='recruit';
  Object.assign(neighbour,{x:25,z:25});Object.assign(warden,{x:10,z:16});
  warden.skills.social={level:12,xp:0,dailyXp:0,passion:0};
  expect(applyCommand(w,{type:'priority',pawnId:warden.id,work:'warden',value:1}).ok).toBe(true);
  const proposal=wardenProposal(w,warden,reach(w,warden));
  expect(proposal?.task).toMatchObject({kind:'chat',spot:beyondFoot});
  setVersion(w,338);expect(wardenProposal(w,warden,reach(w,warden))).toBeUndefined();setVersion(w,SCHEMA_VERSION);
  until(w,()=>warden.ward?.kind==='chat'&&warden.ward.phase==='rapport');
  expect(warden).toMatchObject({x:10,z:12});valid(w);
});

test('a schema 338 save migrates to 339 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,338)))).toBe(current);
});
