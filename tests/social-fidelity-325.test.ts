import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {initialRecreation} from '../src/sim/recreation-rules.ts';
import {aboutToRecover325,visitChanceScore325,visitPatient} from '../src/sim/recreation-space.ts';
import {advanceSocial,exchangeSocial,prisonerCanSocialize325} from '../src/sim/social.ts';
import {socialFightRecoveryDue} from '../src/sim/social-fight.ts';
import {socialRandom} from '../src/sim/social-state.ts';
import {createPrisonerState} from '../src/sim/prisoner-state.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {Pawn,World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
function prison():{world:World;a:Pawn;b:Pawn;c:Pawn} {
  const world=createWorld(325,32,32);
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.jobs=[];world.piles=[];world.structures=[];world.tick=1000;
  world.pawns=world.pawns.slice(0,3);
  const [a,b,c]=world.pawns as [Pawn,Pawn,Pawn];
  Object.assign(a,{x:5,z:5,state:'idle',need:null,jobId:null,faction:'outlaws'});
  Object.assign(b,{x:7,z:5,state:'idle',need:null,jobId:null,faction:'outlaws'});
  Object.assign(c,{x:6,z:7,state:'idle',need:null,jobId:null});
  a.prisoner=createPrisonerState(world,a);b.prisoner=createPrisonerState(world,b);
  return {world,a,b,c};
}

test('prisoners of one faction talk together, never with a colonist',()=>{
  const {world,a,b,c}=prison();
  expect(prisonerCanSocialize325(world,a,true)).toBe(true);
  expect(exchangeSocial(world,a,c,'chitchat')).toBe(false);
  expect(exchangeSocial(world,c,a,'chitchat')).toBe(false);
  expect(exchangeSocial(world,a,b,'chitchat')).toBe(true);
  expect(b.social!.memories.some(m=>m.otherId===a.id&&m.kind==='chitchat')).toBe(true);
  b.faction='outlanders';world.tick+=100;
  expect(exchangeSocial(world,a,b,'chitchat')).toBe(false);
  b.faction='outlaws';a.prisoner!.breakout={active:true} as never;
  expect(prisonerCanSocialize325(world,a,true)).toBe(false);
  delete a.prisoner!.breakout;setVersion(world,324);world.tick+=100;
  expect(exchangeSocial(world,a,b,'chitchat')).toBe(false);
});

test('a waiting prisoner finds a fellow prisoner to talk to',()=>{
  const {world,a,b}=prison();
  a.social={rng:7,memories:[],wants:true};
  for(let n=0;n<200&&!a.social.last;n++){advanceSocial(world);world.tick++;}
  expect(a.social.last?.otherId).toBe(b.id);
});

function ward(medicalBed:boolean):{world:World;patient:Pawn} {
  const world=createWorld(325,32,32);
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.jobs=[];world.piles=[];world.structures=[];world.tick=1000;
  world.pawns=world.pawns.slice(0,2);
  const patient=world.pawns[1]!;
  Object.assign(patient,{x:11,z:8,hunger:100,rest:90,state:'resting',jobId:null});
  patient.recreation=initialRecreation(10);
  const bed={id:world.nextId++,kind:'bed' as const,x:patient.x,z:patient.z,orientation:0 as const,footprint:'legacy-single' as const,...medicalBed?{medical:true as const}:{},quality:'normal' as const};
  world.structures.push(bed);patient.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:patient.x,z:patient.z},medical:'bedrest'};
  patient.health=createMedicalRecord(world.tick);patient.health.nextInjuryId=2;
  patient.health.injuries.push({id:1,part:'left-arm',kind:'bruise',severity:9000,bornAt:world.tick-1,tended:1000});
  return {world,patient};
}

test('a patient resting in any bed can be visited, unless about to recover',()=>{
  const {world,patient}=ward(false);
  expect(visitPatient(world,patient.id)).toBe(patient);
  setVersion(world,324);expect(visitPatient(world,patient.id)).toBeUndefined();setVersion(world,325);
  patient.health!.injuries[0]!.severity=7000;
  expect(aboutToRecover325(patient)).toBe(true);expect(visitPatient(world,patient.id)).toBeUndefined();
  patient.health!.flu={severity:100000000,immunity:0} as never;
  expect(aboutToRecover325(patient)).toBe(false);expect(visitPatient(world,patient.id)).toBe(patient);
});

test('the visitor picks a patient by opinion and distance',()=>{
  expect(visitChanceScore325(0,0)).toBeCloseTo(1.025,12);
  expect(visitChanceScore325(100,0)).toBeCloseTo(2,12);
  expect(visitChanceScore325(-100,200)).toBeCloseTo(.05*.2,12);
  expect(visitChanceScore325(0,75)).toBeCloseTo(1.025*.6,12);
});

test('a social fight stops with the Core chance of 30 in 1200 per check',()=>{
  const {a}=prison();
  // A seed whose first draw falls between 1-exp(-30/1200) and 30/1200.
  let seed=1;for(;seed<5000000;seed++){const r=socialRandom({rng:seed});if(r>=1-Math.exp(-30/1200)&&r<30/1200)break;}
  expect(seed).toBeLessThan(5000000);
  const core=420+((30-(420+a.id)%30)%30);
  const due=(version:number)=>{a.social={rng:seed,memories:[],fight:{opponentId:a.id+1,startedAt:0}};return socialFightRecoveryDue(a,core,version);};
  expect(due(325)).toBe(true);expect(due(324)).toBe(false);
});

test('a schema 324 save migrates to 325 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,324)))).toBe(current);
});
