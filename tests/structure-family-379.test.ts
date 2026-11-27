import {SCHEMA_VERSION} from '../src/sim/types.ts';
import {expect,test} from 'vitest';
import {structureFamily379,damagedStructures379,structureDamageChanged379} from '../src/sim/structure-family-379.ts';
import {appendStructureEntries} from '../src/sim/structure-navigation.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {damageBarrier} from '../src/sim/barriers.ts';
import {setTerrainWriteCacheVerification,verifyTerrainWriteCaches} from '../src/sim/terrain-mutation-journal.ts';
import type {Structure,World} from '../src/sim/types.ts';

const stool=(id:number,x:number):Structure=>({id,kind:'stool',x,z:2,orientation:0,footprint:'standard',material:'wood'});
const fixture=():World=>({schemaVersion:SCHEMA_VERSION,width:8,height:8,tiles:Array.from({length:64},()=>({terrain:'grass'})),structures:[stool(1,1),{...stool(2,2),kind:'wall'},stool(3,3)],rng:1}) as World;
const stoolKind=(kind:Structure['kind'])=>kind==='stool';

test('resident families retain canonical order, append proofs, old lists and cold membership fallback',()=>{
 const w=fixture(),owner={};withJournalTerrainReadScope(owner,()=>{
  let kindReads=0;const accepts=(kind:Structure['kind'])=>{kindReads++;return stoolKind(kind);};
  const original=structureFamily379(w,'test-stools',accepts);expect(original.map(s=>s.id)).toEqual([1,3]);if(!verifyTerrainWriteCaches)expect(kindReads).toBe(2);
  for(let i=0;i<20;i++)expect(structureFamily379(w,'test-stools',accepts)).toBe(original);
  if(!verifyTerrainWriteCaches)expect(kindReads).toBe(2);
  appendStructureEntries(w,stool(4,4));expect(structureFamily379(w,'test-stools',accepts).map(s=>s.id)).toEqual([1,3,4]);expect(original.map(s=>s.id)).toEqual([1,3]);
  w.structures=w.structures.filter(s=>s.id!==3).reverse();expect(structureFamily379(w,'test-stools',accepts).map(s=>s.id)).toEqual([4,1]);
 });
 w.structures.splice(1,1,stool(5,5));expect(structureFamily379(w,'test-stools',stoolKind)).toBe(w.structures);
 withJournalTerrainReadScope(owner,()=>expect(structureFamily379(w,'test-stools',stoolKind).map(s=>s.id)).toEqual([4,5,1]));
});

test('public and unknown partial views keep live type-edge behavior and retire old witnesses',()=>{
 const w=fixture(),owner={};
 withJournalTerrainReadScope(owner,()=>{
  expect(structureFamily379({structures:w.structures},'test-stools',stoolKind)).toBe(w.structures);
  expect(structureFamily379(w,'test-stools',stoolKind).map(s=>s.id)).toEqual([1,3]);
  expect(structureFamily379({structures:w.structures},'test-stools',stoolKind).map(s=>s.id)).toEqual([1,3]);
  const unknown=w.structures.slice();expect(structureFamily379({structures:unknown},'test-stools',stoolKind)).toBe(unknown);
 });
 w.structures[1]!.kind='stool';w.structures[0]!.kind='wall';
 expect(structureFamily379(w,'test-stools',stoolKind)).toBe(w.structures);
 withJournalTerrainReadScope(owner,()=>expect(structureFamily379(w,'test-stools',stoolKind).map(s=>s.id)).toEqual([2,3]));
});

test('real damage commits enter sparse repair membership in source order and repair/removal retires rows',()=>{
 const w=fixture(),wall=w.structures[1]!;withJournalTerrainReadScope({},()=>{
  expect(damagedStructures379(w)).toEqual([]);expect(damageBarrier(w,wall,5)).toBe(true);expect(damagedStructures379(w)).toEqual([wall]);
  w.structures[0]!.damage=3;structureDamageChanged379(w,w.structures[0]!);expect(damagedStructures379(w).map(s=>s.id)).toEqual([1,2]);
  const previous=damagedStructures379(w);delete wall.damage;structureDamageChanged379(w,wall);expect(damagedStructures379(w).map(s=>s.id)).toEqual([1]);expect(previous.map(s=>s.id)).toEqual([1,2]);
  w.structures=w.structures.filter(s=>s.id!==1);expect(damagedStructures379(w)).toEqual([]);
 });
});

test('verification rejects an unmarked mutable damage membership edit',()=>{
 const before=verifyTerrainWriteCaches;setTerrainWriteCacheVerification(true);
 try{const w=fixture();withJournalTerrainReadScope({},()=>{expect(damagedStructures379(w)).toEqual([]);w.structures[1]!.damage=4;expect(()=>damagedStructures379(w)).toThrow('Unmarked structure damage membership');});}
 finally{setTerrainWriteCacheVerification(before);}
});
