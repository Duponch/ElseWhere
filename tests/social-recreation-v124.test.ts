import { expect,test } from 'vitest';
import { createWorld,stepWorld } from '../src/sim/engine.ts';
import { blockedCells, reachableCells } from '../src/sim/pathfinding.ts';
import { initialRecreation } from '../src/sim/recreation-rules.ts';
import { processRecreation } from '../src/sim/recreation.ts';
import { recreationSiteValid, visitPatient } from '../src/sim/recreation-space.ts';
import { reservedServiceCells } from '../src/sim/service-reservations.ts';
import { validateRecreation } from '../src/sim/recreation-save.ts';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { createMedicalRecord } from '../src/sim/injury-state.ts';
import { urgentTreatment } from '../src/sim/care-rules.ts';
import { controlledInjury } from './scenarios/health.ts';
import { refreshStock } from '../src/sim/materials.ts';
import { SCHEMA_VERSION,type Pawn,type World } from '../src/sim/types.ts';

function scene():{world:World; visitor:Pawn; patient:Pawn} {
  const world=createWorld(124,32,32);
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.jobs=[];world.piles=[];world.structures=[];world.tick=1000;
  world.pawns=world.pawns.slice(0,2);
  const [visitor,patient]=world.pawns as [Pawn,Pawn];
  Object.assign(visitor,{x:7,z:8,hunger:100,rest:100,state:'idle',need:null,jobId:null});
  Object.assign(patient,{x:11,z:8,hunger:100,rest:90,state:'resting',jobId:null});
  for(const pawn of world.pawns){pawn.schedule.fill('recreation');pawn.recreation=initialRecreation(10);pawn.recreation.bored.solitary=true;pawn.recreation.bored.dexterity=true;pawn.recreation.bored.cerebral=true;pawn.recreation.tolerance.solitary=80;pawn.recreation.tolerance.dexterity=80;pawn.recreation.tolerance.cerebral=80;}
  const bed={id:world.nextId++,kind:'bed' as const,x:patient.x,z:patient.z,orientation:0 as const,footprint:'legacy-single' as const,medical:true as const,quality:'normal' as const};
  world.structures.push(bed);patient.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:patient.x,z:patient.z},medical:'bedrest'};
  patient.health=createMedicalRecord(world.tick);patient.health.nextInjuryId=2;
  // Schema 325: at least 8 HP of healing injuries, or the patient is about to recover.
  patient.health.injuries.push({id:1,part:'left-arm',kind:'bruise',severity:9000,bornAt:world.tick-1,tended:1000});
  patient.priorities.bedrest=1;
  refreshStock(world);
  return {world,visitor,patient};
}
function context(world:World,pawn:Pawn){
  return {search:()=>reachableCells(world,pawn,blockedCells(world),new Set<number>()),move:()=>{},release:()=>{pawn.recreation.task=null;pawn.path=[];pawn.state='idle';return true;},event:()=>{}};
}

test('sick visit reserves a physical place and gives both people joy only after arrival',()=>{
  const {world,visitor,patient}=scene();
  expect(visitPatient(world,patient.id)).toBe(patient);
  const beforeVisitor=visitor.recreation.level,beforePatient=patient.recreation.level;
  expect(processRecreation(world,visitor,context(world,visitor))).toBe(true);
  const task=visitor.recreation.task!;
  expect(task).toMatchObject({activity:'visit-sick',phase:'travel',patientId:patient.id,buildingId:null,elapsed:0});
  expect(visitor.recreation.level).toBe(beforeVisitor);expect(patient.recreation.level).toBe(beforePatient);
  expect(reservedServiceCells(world,patient.id).has(task.target.z*world.width+task.target.x)).toBe(true);
  expect(recreationSiteValid(world,task)).toBe(true);
  visitor.x=task.target.x;visitor.z=task.target.z;visitor.path=[];visitor.moveCooldown=0;
  expect(processRecreation(world,visitor,context(world,visitor))).toBe(true);
  expect(task.phase).toBe('active');expect(visitor.recreation.level).toBeGreaterThan(beforeVisitor);expect(patient.recreation.level).toBeGreaterThan(beforePatient);
  expect(validateRecreation(world,SCHEMA_VERSION)).toEqual([]);
  expect(validateWorld(world)).toEqual([]);
  const resumed=deserializeWorld(serializeWorld(world));
  for(let i=0;i<35;i++){stepWorld(world);stepWorld(resumed);}
  expect(serializeWorld(resumed)).toBe(serializeWorld(world));
  expect(validateWorld(world)).toEqual([]);
  const socialRng=visitor.social?.rng;
  patient.state='sleeping';processRecreation(world,visitor,context(world,visitor));
  expect(visitor.recreation.task).toBeNull();expect(visitor.social?.rng).toBe(socialRng);
  expect(reservedServiceCells(world,patient.id).has(task.target.z*world.width+task.target.x)).toBe(false);
});

test('one table seat arbitrates social relaxation against a meal and disabling the point interrupts it',()=>{
  const {world,visitor,patient}=scene();patient.need=null;patient.state='idle';
  world.structures.push({id:world.nextId++,kind:'table',x:9,z:8,orientation:0,footprint:'standard',gatherSpot:true,quality:'normal'});
  const table=world.structures.at(-1)!;
  world.structures.push({id:world.nextId++,kind:'stool',x:8,z:8,orientation:0,footprint:'standard',quality:'normal'});
  const seat=world.structures.at(-1)!;
  patient.need={kind:'eat',phase:'travel',sourcePileId:1,carryPileId:2,quantity:1,progress:0,dining:{target:{x:seat.x,z:seat.z},seatId:seat.id,tableId:table.id}};
  expect(processRecreation(world,visitor,context(world,visitor))).toBe(false);
  expect(visitor.recreation.task).toBeNull();
  patient.need=null;visitor.needCooldown=0;
  expect(processRecreation(world,visitor,context(world,visitor))).toBe(true);
  expect(visitor.recreation.task).toMatchObject({activity:'social-relax',buildingId:table.id,seatId:seat.id,target:{x:seat.x,z:seat.z}});
  expect(validateRecreation(world,SCHEMA_VERSION)).toEqual([]);
  table.gatherSpot=false;
  expect(validateWorld(world)).toEqual([]);
  const before=visitor.recreation.level;
  processRecreation(world,visitor,context(world,visitor));
  expect(visitor.recreation.task).toBeNull();expect(visitor.recreation.level).toBe(before);
});

test('a patient leaving medical rest after the visitor acts remains saveable until the next tick cancels the visit',()=>{
  const {world,visitor,patient}=scene();
  expect(processRecreation(world,visitor,context(world,visitor))).toBe(true);
  expect(visitor.recreation.task?.activity).toBe('visit-sick');
  patient.need=null;patient.state='idle';
  expect(validateWorld(world)).toEqual([]);
  const resumed=deserializeWorld(serializeWorld(world));
  const resumedVisitor=resumed.pawns.find(p=>p.id===visitor.id)!;
  expect(processRecreation(resumed,resumedVisitor,context(resumed,resumedVisitor))).toBe(false);
  expect(resumedVisitor.recreation.task).toBeNull();
});

test('before schema 325, a sick visit requires a medical bed',()=>{
  const {world,patient}=scene();(world as {schemaVersion:number}).schemaVersion=324;
  world.structures[0]!.medical=undefined;
  expect(visitPatient(world,patient.id)).toBeUndefined();
});

test('an emergency releases a leisure visitor and immediately frees the bedside service place',()=>{
  const {world,visitor,patient}=scene();
  expect(processRecreation(world,visitor,context(world,visitor))).toBe(true);
  const target=visitor.recreation.task!.target,key=target.z*world.width+target.x;
  expect(reservedServiceCells(world,patient.id).has(key)).toBe(true);
  controlledInjury(world,patient,'neck',6000,'cut');
  expect(urgentTreatment(patient)).toBe(true);
  expect(reservedServiceCells(world,patient.id).has(key)).toBe(false);
  expect(processRecreation(world,visitor,context(world,visitor))).toBe(false);
  expect(visitor.recreation.task).toBeNull();
});
