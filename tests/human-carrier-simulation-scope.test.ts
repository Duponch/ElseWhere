import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {carrierOf,markHumanCarrierCandidatesDirty,setHumanCarrierCacheVerification,withHumanCarrierReadScope} from '../src/sim/rescue-state.ts';
import {startPrisonerRelease} from '../src/sim/prisoner-release.ts';
import {groupHumanCarrierOf257} from '../src/sim/group-human-admission-257.ts';
import {emptyGroupLedger} from '../src/sim/group-loading.ts';
import type {Pawn,World} from '../src/sim/types.ts';

afterEach(()=>setHumanCarrierCacheVerification(false));
function fixture(){
  const w=createWorld(18,16,16),[first,second,patient]=w.pawns as [Pawn,Pawn,Pawn];
  return {w,first,second,patient};
}
function scalar(w:World,id:number):Pawn|undefined {
  return w.pawns.find(p=>p.rescue?.phase==='carry'&&p.rescue.patientId===id||p.cryptosleepTask?.action==='carry'&&(p.cryptosleepTask.phase==='carry'||p.cryptosleepTask.phase==='closing')&&p.cryptosleepTask.patientId===id)
    ??w.pawns.find(p=>p.shipCasketTask277?.action==='carry'&&(p.shipCasketTask277.phase==='carry'||p.shipCasketTask277.phase==='closing')&&p.shipCasketTask277.patient?.kind==='human'&&p.shipCasketTask277.patient.id===id)
    ??groupHumanCarrierOf257(w,id)
    ??w.pawns.find(p=>p.raid?.kidnap261?.phase==='carry'&&p.raid.kidnap261.patientId===id);
}
function agree(w:World,id:number,expected?:Pawn){
  const before=JSON.stringify(w);expect(carrierOf(w,id)).toBe(expected);expect(scalar(w,id)).toBe(expected);expect(JSON.stringify(w)).toBe(before);
}
type Kind='rescue'|'crypto'|'casket'|'kidnap';
function assign(p:Pawn,id:number,kind:Kind,carry=false){
  const phase=carry?'carry':'approach';
  if(kind==='rescue')p.rescue={patientId:id,bedId:1,phase};
  if(kind==='crypto')p.cryptosleepTask={action:'carry',casketId:2,patientId:id,phase,progressCore:0,lastWorkedAt:0};
  if(kind==='casket')p.shipCasketTask277={action:'carry',casketId:3,patient:{kind:'human',id},phase,progressCore:0,lastWorkedAt:0};
  if(kind==='kidnap')p.raid={group:1,exiting:false,goal:null,kidnap261:{patientId:id,phase}};
}
function clear(p:Pawn){delete p.rescue;delete p.cryptosleepTask;delete p.shipCasketTask277;if(p.raid)delete p.raid.kidnap261;}

test.each(['rescue','crypto','casket','kidnap'] as const)('%s creation, phase, patient change and cancellation are exact within one closed scope',kind=>{
  const {w,first,second,patient}=fixture();assign(second,patient.id,kind,true);
  setHumanCarrierCacheVerification(true);
  withHumanCarrierReadScope(()=>{
    agree(w,patient.id,second);assign(first,patient.id,kind);markHumanCarrierCandidatesDirty();agree(w,patient.id,second);
    assign(first,patient.id,kind,true);agree(w,patient.id,first);
    assign(first,patient.id+1,kind,true);agree(w,patient.id,second);agree(w,patient.id+1,first);
    clear(second);agree(w,patient.id);clear(first);agree(w,patient.id+1);
  });
});

test('the actual prisoner release starter marks a new owner even in a nested scope',()=>{
  const {w,first,patient}=fixture();setHumanCarrierCacheVerification(true);
  withHumanCarrierReadScope(()=>{
    agree(w,patient.id);
    withHumanCarrierReadScope(()=>startPrisonerRelease(first,{task:{patientId:patient.id,bedId:0,phase:'approach',release:{drop:{x:1,z:1},exit:{x:0,z:1}}},path:[]}));
    agree(w,patient.id);first.rescue!.phase='carry';agree(w,patient.id,first);
  });
});

test('roster push, replacement, removal and in-place owner reordering preserve the first owner',()=>{
  const {w,first,second,patient}=fixture();assign(first,patient.id,'rescue',true);assign(second,patient.id,'crypto',true);setHumanCarrierCacheVerification(true);
  withHumanCarrierReadScope(()=>{
    agree(w,patient.id,first);w.pawns.reverse();agree(w,patient.id,second);
    w.pawns=w.pawns.filter(p=>p!==second);agree(w,patient.id,first);
    const replacement={...first,rescue:undefined};w.pawns[w.pawns.indexOf(first)]=replacement;agree(w,patient.id);
    w.pawns.push(first);agree(w,patient.id,first);
    w.pawns=w.pawns.filter(p=>p!==first);agree(w,patient.id);
  });
});

test('casket precedence and live group fallback are retained before a kidnapping owner',()=>{
  const {w,first,second,patient}=fixture();assign(second,patient.id,'kidnap',true);assign(first,patient.id,'casket',true);setHumanCarrierCacheVerification(true);
  withHumanCarrierReadScope(()=>{
    agree(w,patient.id,first);clear(first);agree(w,patient.id,second);
    w.group={id:1,startedAt:w.tick,destination:1,phase:'gathering',memberIds:[first.id,patient.id],rendezvous:{x:5,z:5},meeting:[],manifest:[],cursor:0,exits:[],ledger:emptyGroupLedger(),humanPreparation:{revision:1,releaseIds:[],passengers:[{pawnId:patient.id,carrierId:first.id,phase:'carry'}]}};
    agree(w,patient.id,first);w.group.humanPreparation!.passengers[0]!.phase='waiting';agree(w,patient.id,second);
    delete w.group;agree(w,patient.id,second);
  });
});

test('verification detects an omitted writer; public calls and a fresh scope see direct fixture changes',()=>{
  const {w,first,patient}=fixture();setHumanCarrierCacheVerification(true);
  expect(()=>withHumanCarrierReadScope(()=>{
    agree(w,patient.id);assign(first,patient.id,'rescue',true);carrierOf(w,patient.id);
  })).toThrow('Unmarked human carrier task creation');
  agree(w,patient.id,first);clear(first);
  withHumanCarrierReadScope(()=>agree(w,patient.id));
  assign(first,patient.id,'crypto',true);
  withHumanCarrierReadScope(()=>agree(w,patient.id,first));
  clear(first);agree(w,patient.id);
});
