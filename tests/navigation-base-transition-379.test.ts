import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {blockedCells} from '../src/sim/pathfinding';
import {appendStructureEntries} from '../src/sim/structure-navigation';
import {ownedNavigationSource379,ownedNavigationGrid379,navigationGridWork379,navigationGridCorners379} from '../src/sim/owned-navigation-grid-379';
import {candidatePageConnectivity379,candidatePageWork379} from '../src/sim/candidate-page-connectivity-379';
import {WeightedSearch} from '../src/sim/weighted-search';
import {newDoorState} from '../src/sim/door-rules';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import type {Structure} from '../src/sim/types';

test('nonblocking structure append retains navigation base; a real blocker retires only its touched masks/pages',()=>{
 const w=createWorld(42,40,40);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.structures=[];w.jobs=[];
 const s=(kind:Structure['kind'],x:number,z:number):Structure=>({id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood',...(kind==='door'?{door:newDoorState(w.tick)}:{})});
 const size=w.width*w.height,goal=size-1,owner={};
 withJournalTerrainReadScope(owner,()=>{
  const first=blockedCells(w),source=ownedNavigationSource379(first,w.width,w.height)!,corners=navigationGridCorners379(first)!;
  const initial=new WeightedSearch(w.width,w.height,0,first,undefined,undefined,undefined,corners).finish(new Set([goal]));
  const old=ownedNavigationGrid379(first,w.width,w.height,corners)!;
  expect(initial.visited).toBeGreaterThan(128);
  expect(candidatePageConnectivity379(first,w.width,w.height,0,new Int32Array(size))!.has(goal)).toBe(true);
  appendStructureEntries(w,s('sandbags',8,8));const decorated=blockedCells(w);
  expect(ownedNavigationSource379(decorated,w.width,w.height)!.base).toBe(source.base);
  expect(ownedNavigationGrid379(decorated,w.width,w.height,navigationGridCorners379(decorated)!)!.words).toBe(old.words);
  const pageBefore=candidatePageWork379(),stats=navigationGridWork379();
  appendStructureEntries(w,s('wall',22,22));const edited=blockedCells(w),changed=ownedNavigationSource379(edited,w.width,w.height)!;
  expect(changed.base).not.toBe(source.base);expect(changed.base[22*w.width+22]).toBe(1);expect(source.base[22*w.width+22]).toBe(0);
  const kernel=ownedNavigationGrid379(edited,w.width,w.height,navigationGridCorners379(edited)!)!;
  expect(kernel.words).not.toBe(old.words);expect(kernel.words[20]).toBe(old.words[20]);expect(kernel.words[22*w.width+21]).toBe(0);
  expect(navigationGridWork379().baseDerivations-stats.baseDerivations).toBe(1);
  expect(candidatePageConnectivity379(edited,w.width,w.height,0,new Int32Array(size))!.has(goal)).toBe(true);
  expect(candidatePageWork379().retainedPages-pageBefore.retainedPages).toBeGreaterThan(0);
  // A real new door does not block the cardinal base; its 3D diagonal corners
  // still need a new weighted mask generation.
  appendStructureEntries(w,s('door',12,12));const door=blockedCells(w),doorCorners=navigationGridCorners379(door)!;
  expect(ownedNavigationSource379(door,w.width,w.height)!.base).toBe(changed.base);
  const next=ownedNavigationGrid379(door,w.width,w.height,doorCorners)!;expect(next.words).not.toBe(kernel.words);
  expect(next.words[20]).toBe(kernel.words[20]);
  const derived=new WeightedSearch(w.width,w.height,0,door,undefined,undefined,undefined,doorCorners).finish(new Set([goal])),oracle=new WeightedSearch(w.width,w.height,0,door.slice(),undefined,undefined,undefined,doorCorners).finish(new Set([goal]));expect(derived).toEqual(oracle);
 });
});
