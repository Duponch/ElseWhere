import {expect,test} from 'vitest';
import {candidateAccess,candidateScratchWork379} from '../src/sim/candidate-access';
import {createWorld} from '../src/sim/engine';
import {blockedCells,routeToCell} from '../src/sim/pathfinding';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';

test('exclusive planner fields recycle only after dispose, nested and public routes remain exact',()=>{
 const w=createWorld(29,40,40),pawn=w.pawns[0]!;w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.structures=[];w.jobs=[];w.piles=[];pawn.x=2;pawn.z=2;
 const target={x:25,z:25},other={x:6,z:6},empty=new Set<number>(),grid=blockedCells(w),expected=routeToCell(w,target,candidateAccess(w,pawn,grid,empty));
 const before=candidateScratchWork379();
 withJournalTerrainReadScope({},()=>{
  const first=candidateAccess(w,pawn,grid,empty,true,pawn,undefined,undefined,true,true),path=routeToCell(w,target,first);expect(path).toEqual(expected);
  const live=structuredClone(first.resolve(new Set([target.z*w.width+target.x]))),stats=first.visited;
  const nested=candidateAccess(w,pawn,grid,empty,true,pawn,undefined,undefined,true,true);expect(routeToCell(w,other,nested)).toEqual(routeToCell(w,other,candidateAccess(w,pawn,grid,empty)));nested.dispose!();
  expect(first.resolve(new Set([target.z*w.width+target.x]))).toEqual(live);first.dispose!();expect(first.visited).toBe(stats);expect(()=>first.resolve(new Set([0]))).toThrow(/owner ended/);expect(()=>first.has(0)).toThrow(/decision ended/);
  for(let i=0;i<5;i++){
   const next=candidateAccess(w,pawn,grid,empty,true,pawn,undefined,undefined,true,true);expect(routeToCell(w,target,next)).toEqual(expected);next.dispose!();
  }
 });
 const after=candidateScratchWork379();expect(after.allocations-before.allocations).toBe(2);expect(after.weightedAllocations-before.weightedAllocations).toBe(2);expect(after.reuses-before.reuses).toBe(5);
 expect(routeToCell(w,target,candidateAccess(w,pawn,grid,empty))).toEqual(expected);
});
