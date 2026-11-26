import {afterEach,expect,test} from 'vitest';
import {prisonerUiFixture,recruitmentUiFixture} from './scenarios/prison-camp.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {foodSearchGoals,foodSourceSearchGoals,selectFood,selectFoodSource} from '../src/sim/food-selection.ts';
import {assistedFoodAccessible,createAssistedFoodAccessibilityQuery379,createSelfFoodAccessibilityQuery379,prisonFood,selfFoodAccessible} from '../src/sim/prison-food.ts';
import {hasPrisonBedMark379,prisonRoom} from '../src/sim/prison-space.ts';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {applyPrisonBed} from '../src/sim/prisoners.ts';

afterEach(()=>setTerrainWriteCacheVerification(false));

test('closed food loops match independent public ranking and see bed role changes without a geometry change',()=>{
 const {world:w,actorId,bedId}=prisonerUiFixture(),p=w.pawns.find(q=>q.id===actorId)!,bed=w.structures.find(s=>s.id===bedId)!,owner={};
 Object.assign(p,{x:9,z:10});
 addGroundMaterial(w,'food',1,{x:11,z:9},'lavish-meal');
 addGroundMaterial(w,'food',1,{x:15,z:10},'simple-meal');
 const inside=w.piles.find(q=>q.item==='lavish-meal')!,outside=w.piles.find(q=>q.item==='simple-meal')!,sources=[inside,outside];
 const reach=reachableCells(w,p,blockedCells(w),new Set());
 const read=()=>({marked:hasPrisonBedMark379(w),private:prisonFood(w,inside),room:prisonRoom(w,inside.owner as {x:number;z:number})?.id,
  eligible:sources.map(q=>selfFoodAccessible(w,p,q)),goals:[...foodSearchGoals(w,p,sources)],sourceGoals:[...foodSourceSearchGoals(w,p,sources)],
  selected:selectFood(w,p,sources,reach),source:selectFoodSource(w,p,sources,reach)});
 setTerrainWriteCacheVerification(true);
 const publicUnmarked=read();expect(publicUnmarked.marked).toBe(false);expect(publicUnmarked.eligible).toEqual([true,true]);
 expect(withJournalTerrainReadScope(owner,read)).toEqual(publicUnmarked);
 // The actual writer only changes the live role, not the structure's kind.
 const array=w.structures;
 expect(applyPrisonBed(w,{bedId,enabled:true})).toMatchObject({ok:true});expect(w.structures).toBe(array);expect(bed.prisoner).toBe(true);
 const marked=read();expect(marked.private).toBe(true);expect(marked.eligible).toEqual([false,true]);
 expect(withJournalTerrainReadScope(owner,read)).toEqual(marked);
 // Direct role edits also take effect on every new closed query even without
 // replacing the array, changing geometry, or notifying a role-specific cache.
 withJournalTerrainReadScope(owner,()=>{
  delete bed.prisoner;expect(read()).toEqual(publicUnmarked);
  bed.prisoner=true;expect(read()).toEqual(marked);
 });
 expect(applyPrisonBed(w,{bedId,enabled:false})).toMatchObject({ok:true});
 expect(withJournalTerrainReadScope(owner,read)).toEqual(publicUnmarked);
});

test('closed prison-food checker preserves patient access and public malformed marker fallback',()=>{
 const {world:w,actorId,patientId,bedId}=recruitmentUiFixture(),supplier=w.pawns.find(q=>q.id===actorId)!,patient=w.pawns.find(q=>q.id===patientId)!,bed=w.structures.find(s=>s.id===bedId)!;
 addGroundMaterial(w,'food',1,{x:11,z:9},'simple-meal');const pile=w.piles.find(q=>q.item==='simple-meal')!;
 expect(prisonFood(w,pile)).toBe(true);
 expect(assistedFoodAccessible(w,supplier,patient,pile)).toBe(true);
 const publicRead=createSelfFoodAccessibilityQuery379(w,supplier);
 expect(publicRead(pile)).toBe(false);
 setTerrainWriteCacheVerification(true);
 const owner={};
 const closedRead=withJournalTerrainReadScope(owner,()=>{
  const read=createSelfFoodAccessibilityQuery379(w,supplier),assisted=createAssistedFoodAccessibilityQuery379(w,supplier,patient);
  expect(read(pile)).toBe(false);expect(assisted(pile)).toBe(true);
  return read;
 });
 // The public reader retains the historical exhaustive preflight even for a
 // malformed direct fixture. A non-bed alone still does not mark a room.
 delete bed.prisoner;w.structures.find(s=>s.kind==='wall')!.prisoner=true;
 expect(hasPrisonBedMark379(w)).toBe(true);expect(prisonFood(w,pile)).toBe(false);
 expect(selfFoodAccessible(w,supplier,pile)).toBe(true);
 expect(publicRead(pile)).toBe(true);expect(closedRead(pile)).toBe(true);
 // A held private query cannot reuse its mark after its generation ended or
 // for a different owner (even the same original world). No predicate is a
 // parameter of the public APIs; an extra JS argument is simply ignored.
 delete w.structures.find(s=>s.kind==='wall')!.prisoner;
 expect(withJournalTerrainReadScope(owner,()=>closedRead(pile))).toBe(true);
 expect(withJournalTerrainReadScope({},()=>closedRead(pile))).toBe(true);
 bed.prisoner=true;
 const forged=selfFoodAccessible as (...args:any[])=>boolean;
 expect(forged(w,supplier,pile,undefined,false,()=>false)).toBe(false);
});
