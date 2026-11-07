import {expect,test} from 'vitest';
import {recruitmentUiFixture} from './scenarios/prison-camp.ts';
import {medicalCamp} from './scenarios/health.ts';
import {hostileTo} from '../src/sim/affiliation.ts';
import {processPrisonBreak} from '../src/sim/prison-break-behavior.ts';
import {advanceMelee} from '../src/sim/melee.ts';
import {validateMelee,validMeleeShape} from '../src/sim/melee-save.ts';
import {shootingQueries} from '../src/sim/shooting.ts';
import {blockedCells} from '../src/sim/pathfinding.ts';
import {search,type SearchBudget} from '../src/sim/work-planner.ts';
import {LightEnvironmentCache} from '../src/sim/light-environment.ts';
import {exitPrisoner} from '../src/sim/prisoner-exit.ts';
import {meleeRecoveryCore} from '../src/sim/melee-statistics.ts';
import type {NeedContext} from '../src/sim/needs.ts';
import type {Pawn,World} from '../src/sim/types.ts';

function fixture(){
  const {world:w,patientId,actorId}=recruitmentUiFixture(),p=w.pawns.find(p=>p.id===patientId)!,a=w.pawns.find(p=>p.id===actorId)!;
  p.prisoner!.breakout={rng:123,lastAt:w.tick,active:{startedAt:w.tick,initiatorId:p.id}};
  p.planCooldown=0;
  return {w,p,a};
}
function run(w:World,p:Pawn,budget:SearchBudget={remaining:4,pairs:0}){
  const getBlocked=()=>blockedCells(w),context:NeedContext={search:goals=>search(w,p,getBlocked(),new Set(),budget,goals),move:()=>{},release:()=>true,event:()=>{}};
  return processPrisonBreak(w,p,getBlocked,budget,()=>new LightEnvironmentCache().read(w),context);
}

test('detention is neutral, active breakout is mutually hostile to colonists but never other captives',()=>{
  const {w,p,a}=fixture();expect(hostileTo(p,a)).toBe(true);expect(hostileTo(a,p)).toBe(true);
  const other=structuredClone(p);other.id=w.nextId++;other.faction='outlanders';
  expect(hostileTo(p,other)).toBe(false);expect(hostileTo(other,p)).toBe(false);
  delete p.prisoner!.breakout!.active;expect(hostileTo(p,a)).toBe(false);expect(hostileTo(a,p)).toBe(false);
});

test('an adjacent colonist acquires shared melee; deactivated ownership cannot strike',()=>{
  const {w,p,a}=fixture();expect(run(w,p)).toBe(true);
  expect(p.melee?.order).toMatchObject({auto:'prison-break',targetId:a.id,startedDowned:false});
  expect(validMeleeShape(p.melee,204,w.tick)).toBe(true);expect(validateMelee(w)).toEqual([]);
  const before=structuredClone(a),rng=w.rng;delete p.prisoner!.breakout!.active;
  advanceMelee(w,p,w.tick*10,()=>blockedCells(w,true),shootingQueries(w));
  expect(p.melee?.order).toBeFalsy();expect(a).toEqual(before);expect(w.rng).toBe(rng);
  expect(validMeleeShape({order:{auto:'prison-break',targetId:a.id,startedDowned:false},strike:null},203,w.tick)).toBe(false);
});

test('sealed enclosure uses a budgeted barrier mandate, never hypothetical travel',()=>{
  const {w,p,a}=fixture();p.x=9;p.z=10;a.x=20;a.z=20;w.pawns[1]!.x=21;w.pawns[1]!.z=20;
  // Structure kind is immutable (shared structure index contract): replace the
  // door by a wall in a new array, as the simulation does, not in place.
  const door=w.structures.find(s=>s.kind==='door')!,{door:_open,...wall}={...door,kind:'wall' as const};
  w.structures=w.structures.map(s=>s===door?wall:s);
  const before={x:p.x,z:p.z},budget={remaining:2,pairs:0};
  run(w,p,budget);expect(p.melee?.order).toMatchObject({auto:'prison-break',structure:true});
  expect(budget.remaining).toBeLessThan(2);expect({x:p.x,z:p.z}).toEqual(before);
  expect(validateMelee(w)).toEqual([]);
});

test('no search budget means no invented path or barrier engagement',()=>{
  const {w,p,a}=fixture();a.x=20;a.z=20;w.pawns[1]!.x=21;w.pawns[1]!.z=20;
  const before={x:p.x,z:p.z};run(w,p,{remaining:0,pairs:0});
  expect(p.path).toEqual([]);expect(p.melee).toBeUndefined();expect({x:p.x,z:p.z}).toEqual(before);
});

test('exhaustion ends breakout and hands real sleep back to ordinary prisoner behavior',()=>{
  const {w,p}=fixture();p.rest=0;p.collapsePending=true;
  expect(run(w,p)).toBe(false);expect(p.prisoner!.breakout!.active).toBeUndefined();
  expect(p.need).toMatchObject({kind:'sleep',phase:'sleep'});expect(p.state).toBe('sleeping');
});

test('an openable closed door is never converted into a breach target by a blocking colonist',()=>{
  const {w,p,a}=fixture(),door=w.structures.find(s=>s.kind==='door')!;
  a.x=door.x;a.z=door.z;w.pawns[1]!.x=20;w.pawns[1]!.z=20;
  run(w,p);
  expect(p.melee?.order?.structure? p.melee.order.targetId : undefined).not.toBe(door.id);
  expect(door.door!.open).toBe(false);
});

test('nonraid departure cancels incoming orders while retaining their committed recovery archive',()=>{
  const w=medicalCamp(2),[a,p]=w.pawns as [Pawn,Pawn];
  p.faction='outlaws';p.x=0;p.z=10;p.prisoner={...fixture().p.prisoner!,capturedAt:w.tick};
  p.prisoner.breakout={rng:123,active:{startedAt:w.tick,initiatorId:p.id}};p.prisoner.escape={x:0,z:10};
  a.melee={order:{targetId:p.id,startedDowned:false},strike:{targetId:p.id,atCore:w.tick*10,untilCore:w.tick*10+meleeRecoveryCore('left-fist'),tool:'left-fist',outcome:'hit'}};
  const strike=structuredClone(a.melee.strike);
  expect(exitPrisoner(w,p)).toBe(true);expect(a.melee?.order).toBeNull();expect(a.melee?.strike).toEqual(strike);
  expect(validateMelee(w)).toEqual([]);expect(w.prisonDepartures?.[0]?.pawnId).toBe(p.id);
});
