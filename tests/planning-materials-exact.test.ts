import {expect,test} from 'vitest';
import {addGroundMaterial,addMaterial,reservedSource,reservedSourcesByPile,tryAddGroundMaterial} from '../src/sim/materials.ts';
import {medicalCamp} from './scenarios/health.ts';
import {funeralFixture} from './scenarios/hygiene-ui.ts';

test('single-source queued claims preserve existing allocations and observe cancellation and ownership immediately',()=>{
  const w=medicalCamp(2),[actor,other]=w.pawns;
  addMaterial(w,'food',10,{type:'ground',x:12,z:10},'rice');const source=w.piles.at(-1)!;
  actor!.orderedQueue378=[{type:'order-consume',pawnId:actor!.id,pileId:source.id,queue:false}];
  other!.haul={sourcePileId:source.id,quantity:3,phase:'pickup',carryPileId:null,destination:{type:'aside',x:13,z:10}};
  const check=()=>{for(const except of [undefined,actor!.id,other!.id])expect(reservedSource(w,source.id,except)).toBe(reservedSourcesByPile(w,except).get(source.id)??0);};
  check();expect(reservedSource(w,source.id)).toBe(10);
  expect(reservedSource(w,source.id,actor!.id)).toBe(3);
  expect(reservedSource(w,source.id,other!.id)).toBe(7);
  expect(reservedSource(w,source.id,undefined,undefined,new Set([actor!.id]))).toBe(3);
  expect(reservedSource(w,source.id,undefined,undefined,new Set([other!.id]))).toBe(7);
  source.owner={type:'pawn',pawnId:actor!.id};check();expect(reservedSource(w,source.id)).toBe(3);
  source.owner={type:'ground',x:12,z:10};check();expect(reservedSource(w,source.id)).toBe(10);
  delete actor!.orderedQueue378;check();expect(reservedSource(w,source.id)).toBe(3);
});

test('queued human targets claim their actual corpse pile, with no collision between person and pile ids',()=>{
  const {w,actor,body}=funeralFixture(),corpse=w.piles.find(p=>p.id===body.body!.pileId)!;
  addMaterial(w,'food',10,{type:'ground',x:12,z:10},'rice');const food=w.piles.at(-1)!;
  actor.orderedQueue378=[{type:'order-strip',pawnId:actor.id,targetId:body.id}];
  expect(reservedSource(w,corpse.id)).toBe(1);
  expect(reservedSource(w,corpse.id,actor.id)).toBe(0);
  expect(reservedSourcesByPile(w).get(corpse.id)).toBe(1);
  actor.orderedQueue378=[{type:'order-rescue',pawnId:actor.id,patientId:food.id,queue:false}];
  expect(reservedSource(w,corpse.id)).toBe(0);expect(reservedSource(w,food.id)).toBe(0);
  expect(reservedSourcesByPile(w).get(food.id)??0).toBe(0);
});

test('ground producer commit preserves stack order, merging, spill and identities of the throwing API',()=>{
  const w=medicalCamp();addMaterial(w,'wood',73,{type:'ground',x:12,z:10},'wood');
  const expected=structuredClone(w);
  addGroundMaterial(expected,'wood',80,{x:12,z:10},'wood');
  expect(tryAddGroundMaterial(w,'wood',80,{x:12,z:10},'wood')).toBe(true);
  expect(w).toEqual(expected);
});

test('ground producer identity refusal is atomic and keeps ordinary argument and capacity errors',()=>{
  const w=medicalCamp();w.nextId=Number.MAX_SAFE_INTEGER;
  const before=structuredClone(w);
  expect(tryAddGroundMaterial(w,'wood',1,{x:12,z:10},'wood')).toBe(false);expect(w).toEqual(before);
  expect(()=>addGroundMaterial(w,'wood',1,{x:12,z:10},'wood')).toThrow('No room for ground material.');
  expect(()=>tryAddGroundMaterial(w,'wood',-1,{x:12,z:10},'wood')).toThrow('Invalid ground quantity.');
  expect(w).toEqual(before);
});
