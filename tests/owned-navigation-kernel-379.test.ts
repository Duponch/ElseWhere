import {expect,test} from 'vitest';
import {WeightedSearch,WeightedSearchScratch} from '../src/sim/weighted-search.ts';
import {registerNavigationGrid379,deriveNavigationGrid379,ownedNavigationGrid379,navigationGridWork379} from '../src/sim/owned-navigation-grid-379.ts';
import {captureNavigationCostProgram379,scaleNavigationCosts,searchNavigationCostColumns,type NavigationCostLookup} from '../src/sim/navigation-costs.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';

const lookup=(size:number,factor:number):NavigationCostLookup=>({maximum:factor*5,has:i=>i>=0&&i<size&&i%9===0,get:i=>i>=0&&i<size&&i%9===0?i%6*factor:undefined});

test('compiled topology retains every direction, diagonal refusal, double sum, tie and resumed goal layer',()=>{
 for(const [width,height] of [[1,19],[21,1],[17,19],[31,10]]){
  const size=width!*height!,base=Uint8Array.from({length:size},(_,i)=>i%23===8?1:0),grid=base.slice(),corners=new Set<number>();
  for(let i=0;i<size;i++)if(i%17===5)corners.add(i);
  const changed=new Set([0,Math.min(size-1,16),Math.min(size-1,255),size-1]);for(const i of changed)grid[i]=1-grid[i]!;
  const traffic=grid.slice(),trafficCells=new Set([Math.min(size-1,1),Math.min(size-1,256)]);for(const i of trafficCells)traffic[i]=1;
  withJournalTerrainReadScope({},()=>{
   registerNavigationGrid379(grid,width!,height!,corners,base,changed);deriveNavigationGrid379(traffic,grid,trafficCells);
   const topology=ownedNavigationGrid379(traffic,width!,height!,corners);expect(topology).toBeDefined();
   const extra=lookup(size,1.001),floors=lookup(size,.003),additive=lookup(size,.00001),repeaters=new Set<number>();for(let i=0;i<size;i++)if(i%5<2)repeaters.add(i);
   const actual=new WeightedSearch(width!,height!,0,traffic,extra,repeaters,floors,corners,additive,{cardinal:13,diagonal:18});
   const expected=new WeightedSearch(width!,height!,0,traffic.slice(),extra,repeaters,floors,corners,additive,{cardinal:13,diagonal:18});
   for(const goal of [Math.min(size-1,5),Math.floor(size/2),size-1])expect(actual.advance(new Set([goal]))).toEqual(expected.advance(new Set([goal])));
   const groups=[new Set([Math.min(size-1,2),Math.min(size-1,3)]),new Set([size-1,Math.floor(size/2)])];
   expect(actual.finish(undefined,groups,i=>i%41===0&&i>0)).toEqual(expected.finish(undefined,groups,i=>i%41===0&&i>0));
  });
 }
});

test('owned topology reuses immutable base compilation and source-written physical door masks, public reads retire admission',()=>{
 const width=19,height=17,size=width*height,base=new Uint8Array(size),grid=base.slice(),corners=new Set([10]),owner={};
 let first:ReturnType<typeof ownedNavigationGrid379>;
 withJournalTerrainReadScope(owner,()=>{
  const before=navigationGridWork379();registerNavigationGrid379(grid,width,height,corners,base,[]);first=ownedNavigationGrid379(grid,width,height,corners)!;
  grid[10]=1;registerNavigationGrid379(grid,width,height,corners,base,[10]);const closed=ownedNavigationGrid379(grid,width,height,corners)!;
  expect(closed.masks).toBe(first!.masks);expect(closed.patched.size).toBeGreaterThan(0);expect(navigationGridWork379().baseBuilds-before.baseBuilds).toBe(1);
  registerNavigationGrid379(grid,width,height,corners,base,[10]);expect(ownedNavigationGrid379(grid,width,height,corners)).toBe(closed);
  grid[10]=0;registerNavigationGrid379(grid,width,height,corners,base,[10]);expect(ownedNavigationGrid379(grid,width,height,corners)!.patched.size).toBe(0);
 });
 expect(ownedNavigationGrid379(grid,width,height,corners)).toBeUndefined();grid[11]=1;
 withJournalTerrainReadScope(owner,()=>expect(ownedNavigationGrid379(grid,width,height,corners)).toBeUndefined());
});

test('producer cost programs compile cold cells once and preserve all transforms and public fallback',()=>{
 const owner={},size=520;let reads=0,value=67;
 const source:NavigationCostLookup={maximum:1400,get(i){reads++;return i===0?0:i===255?value:i===256?1400:undefined;},has:i=>i===0||i===255||i===256};
 let costs:NavigationCostLookup;
 withJournalTerrainReadScope(owner,()=>{
  costs=scaleNavigationCosts(captureNavigationCostProgram379(source,size),3)!;
  expect(costs.get(255)).toBe(201);expect(costs.get(255)).toBe(201);expect(reads).toBe(1);
  expect(costs.has(0)).toBe(true);expect(costs.get(0)).toBe(0);expect(costs.get(256)).toBe(4200);
  expect(costs.get(511)).toBeUndefined();expect(costs.has(511)).toBe(false);
  expect(searchNavigationCostColumns(costs)!.pages[0]!.values[255]).toBe(201);
 });
 value=99;expect(costs!.get(255)).toBe(297);
 withJournalTerrainReadScope(owner,()=>expect(searchNavigationCostColumns(costs!)).toBeUndefined());
});

test('compiled topology retains scratch release and original parent fields after other searches',()=>{
 const width=17,height=17,size=width*height,base=new Uint8Array(size),corners=new Set<number>(),scratch=new WeightedSearchScratch(size);
 withJournalTerrainReadScope({},()=>{
  const grid=base.slice();grid[255]=1;registerNavigationGrid379(grid,width,height,corners,base,[255]);
  const expected=new WeightedSearch(width,height,0,grid.slice()).finish(new Set([280]));
  expect(scratch.acquire()).toBe(true);const actual=new WeightedSearch(width,height,0,grid,undefined,undefined,undefined,corners,undefined,undefined,scratch).finish(new Set([280]));
  expect(actual).toEqual(expected);const kept=structuredClone(actual);scratch.release();
  expect(scratch.acquire()).toBe(true);new WeightedSearch(width,height,1,grid,undefined,undefined,undefined,corners,undefined,undefined,scratch).finish();scratch.release();
  // Scratch-backed fields intentionally expire on release; the independent
  // historical result is stable and the next field still matches a full run.
  expect(expected).toEqual(kept);
 });
});

test('short searches do not compile whole-map topology; long searches share only reached cells until explicit diagnostics',()=>{
 const width=250,height=250,size=width*height,base=new Uint8Array(size),corners=new Set<number>(),grid=base.slice();
 const near=new Set([1]),far=new Set([40*width+37]);
 const search=(source:Uint8Array,goals:ReadonlySet<number>)=>new WeightedSearch(width,height,0,source,undefined,undefined,undefined,corners).finish(goals);
 withJournalTerrainReadScope({},()=>{
  registerNavigationGrid379(grid,width,height,corners,base,[]);
  const before=navigationGridWork379();
  expect(search(grid,near)).toEqual(search(grid.slice(),near));
  expect(navigationGridWork379()).toMatchObject({baseBuilds:before.baseBuilds,baseCells:before.baseCells,admissions:before.admissions});
  const long=search(grid,far),after=navigationGridWork379();
  expect(long).toEqual(search(grid.slice(),far));
  expect(after.baseBuilds-before.baseBuilds).toBe(1);
  expect(after.baseCells-before.baseCells).toBeGreaterThan(0);
  expect(after.baseCells-before.baseCells).toBeLessThanOrEqual(long.visited);
  expect(after.baseCells-before.baseCells).toBeLessThan(size/2);
  const first=ownedNavigationGrid379(grid,width,height,corners)!;
  const another=base.slice();registerNavigationGrid379(another,width,height,corners,base,[]);
  expect(search(another,far)).toEqual(long);
  const second=ownedNavigationGrid379(another,width,height,corners)!;
  expect(second.words).toBe(first.words);
  expect(navigationGridWork379().baseCells).toBe(after.baseCells);
  expect(second.masks).toBe(first.masks);
  expect(navigationGridWork379().baseCells-before.baseCells).toBe(size);
 });
});
