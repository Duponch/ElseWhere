import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {carrierOf,createPhysicalHumanCarrierReader,releaseCryptosleepCarry271,releaseRescue} from '../src/sim/rescue-state.ts';
import {releaseKidnap261} from '../src/sim/caravan-kidnap-261.ts';
import {groupHumanCarrierOf257} from '../src/sim/group-human-admission-257.ts';
import {emptyGroupLedger} from '../src/sim/group-loading.ts';
import type {PreparingGroup} from '../src/sim/group-capture.ts';
import type {Pawn,World} from '../src/sim/types.ts';

// Query-only prepared fixtures deliberately admit conflicting ownership to
// prove precedence and pawn order, rather than claiming loadable checkpoints.
function scalar(w:World,id:number):Pawn|undefined {
  return w.pawns.find(p=>p.rescue?.phase==='carry'&&p.rescue.patientId===id||p.cryptosleepTask?.action==='carry'&&(p.cryptosleepTask.phase==='carry'||p.cryptosleepTask.phase==='closing')&&p.cryptosleepTask.patientId===id)
    ??w.pawns.find(p=>p.shipCasketTask277?.action==='carry'&&(p.shipCasketTask277.phase==='carry'||p.shipCasketTask277.phase==='closing')&&p.shipCasketTask277.patient?.kind==='human'&&p.shipCasketTask277.patient.id===id)
    ??groupHumanCarrierOf257(w,id)
    ??w.pawns.find(p=>p.raid?.kidnap261?.phase==='carry'&&p.raid.kidnap261.patientId===id);
}
function fixture(){
  const w=createWorld(18,16,16);
  while(w.pawns.length<5)w.pawns.push({...structuredClone(w.pawns[0]!),id:w.nextId++});
  const [first,second,third,raider,patient]=w.pawns as [Pawn,Pawn,Pawn,Pawn,Pawn];
  delete patient.health;
  return {w,first,second,third,raider,patient};
}
type Kind='rescue'|'crypto'|'casket'|'kidnap';
function assign(p:Pawn,id:number,kind:Kind,phase:'approach'|'carry'|'closing'='carry'):void {
  if(kind==='rescue')p.rescue={patientId:id,bedId:1,phase:phase==='approach'?'approach':'carry'};
  if(kind==='crypto')p.cryptosleepTask={action:'carry',casketId:2,patientId:id,phase,progressCore:0,lastWorkedAt:0};
  if(kind==='casket')p.shipCasketTask277={action:'carry',casketId:3,patient:{kind:'human',id},phase,progressCore:0,lastWorkedAt:0};
  if(kind==='kidnap')p.raid={group:1,exiting:false,goal:null,kidnap261:{patientId:id,phase:phase==='approach'?'approach':'carry'}};
}
function remove(p:Pawn,kind:Kind):void {
  if(kind==='rescue')delete p.rescue;
  if(kind==='crypto')delete p.cryptosleepTask;
  if(kind==='casket')delete p.shipCasketTask277;
  if(kind==='kidnap'&&p.raid)delete p.raid.kidnap261;
}
function group(w:World,patient:Pawn,carrier:Pawn):PreparingGroup {
  const g:PreparingGroup={id:1,startedAt:w.tick,destination:1,phase:'gathering',memberIds:[patient.id,carrier.id],rendezvous:{x:5,z:5},meeting:[],manifest:[],cursor:0,exits:[],ledger:emptyGroupLedger(),humanPreparation:{revision:1,releaseIds:[],passengers:[{pawnId:patient.id,carrierId:carrier.id,phase:'carry'}]}};
  w.group=g;return g;
}
function agree(w:World,read:(id:number)=>Pawn|undefined,id:number,expected?:Pawn):void {
  const before=JSON.stringify(w);
  expect(read(id)).toBe(expected);expect(carrierOf(w,id)).toBe(expected);expect(scalar(w,id)).toBe(expected);
  expect(JSON.stringify(w)).toBe(before);
}

test.each([false,true])('physical human reader preserves rescue/crypto, casket, group, kidnap precedence, reversed=%s',reversed=>{
  const {w,first,second,third,raider,patient}=fixture();
  assign(first,patient.id,'rescue');assign(second,patient.id,'crypto','closing');assign(third,patient.id,'casket','closing');assign(raider,patient.id,'kidnap');group(w,patient,first);
  if(reversed)w.pawns.reverse();
  const read=createPhysicalHumanCarrierReader(w);
  agree(w,read,patient.id,reversed?second:first);agree(w,read,w.nextId+10);
  delete first.rescue;agree(w,read,patient.id,second);
  delete second.cryptosleepTask;agree(w,read,patient.id,third);
  third.shipCasketTask277!.patient={kind:'animal',id:patient.id};agree(w,read,patient.id,first);
  delete w.group;agree(w,read,patient.id,raider);
  delete raider.raid!.kidnap261;agree(w,read,patient.id);
});

test.each(['rescue','crypto','casket','kidnap'] as const)('%s candidates keep live phase/identity changes and handover within one scope',kind=>{
  const {w,first,second,patient}=fixture();assign(first,patient.id,kind,'approach');assign(second,patient.id,kind);
  const read=createPhysicalHumanCarrierReader(w);agree(w,read,patient.id,second);
  assign(first,patient.id,kind,'closing');agree(w,read,patient.id,first);
  assign(first,patient.id+1,kind);agree(w,read,patient.id,second);
  remove(second,kind);agree(w,read,patient.id);
  assign(first,patient.id,kind);agree(w,read,patient.id,first);
  if(kind==='crypto'){first.cryptosleepTask!.action='enter';agree(w,read,patient.id);}
  if(kind==='casket'){first.shipCasketTask277!.action='enter';agree(w,read,patient.id);}
});

test.each(['rescue','crypto','kidnap'] as const)('a real %s cancellation is visible and preserves the patient edge/identity',kind=>{
  const {w,first,second,patient}=fixture();assign(first,patient.id,kind);assign(second,patient.id,kind,'approach');
  first.motion={from:{x:5,z:5},to:{x:6,z:5},start:w.tick,end:w.tick+2,speedFactor:1,terrainDelay:0};
  const read=createPhysicalHumanCarrierReader(w),rng=w.rng,nextId=w.nextId;
  agree(w,read,patient.id,first);
  if(kind==='rescue')releaseRescue(w,first);
  if(kind==='crypto')releaseCryptosleepCarry271(w,first);
  if(kind==='kidnap')releaseKidnap261(w,first);
  expect(patient.motion).toEqual(first.motion);expect(w.pawns.includes(patient)).toBe(true);
  agree(w,read,patient.id);assign(second,patient.id,kind);agree(w,read,patient.id,second);
  expect(w.rng).toBe(rng);expect(w.nextId).toBe(nextId);
});

test('group carrier phase, handler and cancellation stay live without initial pawn candidates',()=>{
  const {w,first,second,patient}=fixture(),read=createPhysicalHumanCarrierReader(w),g=group(w,patient,first);
  const row=g.humanPreparation!.passengers[0]!;row.phase='approach';agree(w,read,patient.id);
  row.phase='carry';agree(w,read,patient.id,first);
  row.carrierId=second.id;agree(w,read,patient.id,second);
  row.phase='waiting';agree(w,read,patient.id);row.phase='carry';agree(w,read,patient.id,second);
  delete w.group;agree(w,read,patient.id);
});

test('public queries and fresh physical scopes see direct same-tick additions, replacements and order changes',()=>{
  const {w,first,second,patient}=fixture(),tick=w.tick;
  agree(w,createPhysicalHumanCarrierReader(w),patient.id);
  assign(first,patient.id,'rescue');agree(w,createPhysicalHumanCarrierReader(w),patient.id,first);
  const replacement:Pawn={...first,rescue:{patientId:patient.id,bedId:1,phase:'approach'}};
  w.pawns[0]=replacement;agree(w,createPhysicalHumanCarrierReader(w),patient.id);
  replacement.rescue!.phase='carry';assign(second,patient.id,'crypto');w.pawns.reverse();
  agree(w,createPhysicalHumanCarrierReader(w),patient.id,second);
  w.pawns=w.pawns.filter(p=>p!==second);agree(w,createPhysicalHumanCarrierReader(w),patient.id,replacement);
  expect(w.tick).toBe(tick);
});
