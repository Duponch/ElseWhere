import {expect,test} from 'vitest';
import {candidatePageConnectivity379,candidatePageWork379} from '../src/sim/candidate-page-connectivity-379.ts';
import {registerNavigationGrid379,deriveNavigationGrid379} from '../src/sim/owned-navigation-grid-379.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {candidateAccess} from '../src/sim/candidate-access.ts';
import {blockedCells} from '../src/sim/pathfinding.ts';
import type {World} from '../src/sim/types.ts';

function flood(grid:Uint8Array,width:number,height:number,origin:number):{seen:Uint8Array;visited:number} {
 const size=width*height,seen=new Uint8Array(size),queue=new Int32Array(size);let head=0,tail=1;seen[origin]=1;queue[0]=origin;
 const add=(i:number)=>{if(!seen[i]&&!grid[i]){seen[i]=1;queue[tail++]=i;}};
 while(head<tail){const i=queue[head++]!,x=i%width;if(i>=width)add(i-width);if(x+1<width)add(i+1);if(i+width<size)add(i+width);if(x>0)add(i-1);}
 return {seen,visited:head};
}

test('page labels and sparse portals equal the exact cardinal flood on partial pages, cuts, openings and blocked origins',()=>{
 withJournalTerrainReadScope({},()=>{
  for(const [width,height] of [[1,23],[23,1],[7,9],[8,8],[9,17],[17,19],[33,25]])for(const variant of [0,1,2,3]){
   const size=width!*height!,base=Uint8Array.from({length:size},(_,i)=>variant===0?0:variant===1?((i%width!+Math.floor(i/width!))%2?1:0):i%13===4||(i%width!)===Math.floor(width!/2)?1:0),corners=new Set<number>(),grid=base.slice(),edits=new Set<number>();
   for(let i=variant;i<size;i+=17){grid[i]=1-grid[i]!;edits.add(i);}
   registerNavigationGrid379(grid,width!,height!,corners,base,edits);
   const traffic=grid.slice(),trafficEdits=new Set<number>();for(let i=3;i<size;i+=29){traffic[i]=1;trafficEdits.add(i);}deriveNavigationGrid379(traffic,grid,trafficEdits);
   const origin=variant%2?Math.floor(size/2):0,expected=flood(traffic,width!,height!,origin),actual=candidatePageConnectivity379(traffic,width!,height!,origin,new Int32Array(size))!;
   expect(actual).toBeDefined();for(let i=size-1;i>=0;i--)expect(actual.has(i),`${width}x${height} variant ${variant} cell ${i}`).toBe(expected.seen[i]===1);
   expect(actual.has(origin)).toBe(true);expect(actual.has(-1)).toBe(false);expect(actual.has(size)).toBe(false);expect(actual.has(.5)).toBe(false);
  }
 });
});

test('a blocked origin seeds the same disconnected free neighbour components without admitting other blocked cells',()=>{
 const width=17,height=17,size=width*height,base=new Uint8Array(size).fill(1),grid=base.slice(),origin=8*width+8,edits=new Set<number>();
 for(const i of [origin-width,origin-2*width,origin+1,origin+2,origin+width,origin+2*width,origin-1,origin-2]){grid[i]=0;edits.add(i);}
 withJournalTerrainReadScope({},()=>{
  registerNavigationGrid379(grid,width,height,new Set(),base,edits);const graph=candidatePageConnectivity379(grid,width,height,origin,new Int32Array(size))!,expected=flood(grid,width,height,origin);
  for(let i=0;i<size;i++)expect(graph.has(i)).toBe(expected.seen[i]===1);
 });
});

test('resident immutable pages are reused across actors and only real override pages are rebuilt',()=>{
 const width=250,height=250,size=width*height,base=new Uint8Array(size),corners=new Set<number>();
 withJournalTerrainReadScope({},()=>{
  const first=base.slice();registerNavigationGrid379(first,width,height,corners,base,[]);const before=candidatePageWork379(),graph=candidatePageConnectivity379(first,width,height,0,new Int32Array(size))!;
  expect(graph.has(size-1)).toBe(true);const warm=candidatePageWork379();expect(warm.baseCells-before.baseCells).toBe(size);expect(graph.expandedRegions).toBeLessThan(1100);
  const second=base.slice(),edits=new Set<number>();for(let i=0;i<80;i++){const cell=(i*733+1111)%size;second[cell]=1;edits.add(cell);}registerNavigationGrid379(second,width,height,corners,base,edits);
  const next=candidatePageConnectivity379(second,width,height,0,new Int32Array(size))!,expected=flood(second,width,height,0);expect(next.has(size-1)).toBe(expected.seen[size-1]===1);
  const done=candidatePageWork379();expect(done.basePages).toBe(warm.basePages);expect(done.overrideCells-warm.overrideCells).toBeLessThanOrEqual(edits.size*64);expect(next.expandedRegions).toBeLessThan(expected.visited/20);
 });
});

test('only the opted-in owned planner switches after its ordinary prefix; default quota counts and weighted results stay exact',()=>{
 const width=72,height=72,size=width*height,w={schemaVersion:83,width,height,tiles:Array.from({length:size},()=>({terrain:'grass'})),structures:[],jobs:[],piles:[],pawns:[],resources:[],tick:30} as unknown as World,start={x:0,z:0},occupied=new Set([99,199,299]);
 const publicAccess=candidateAccess(w,start,blockedCells(w),occupied,true),expected=publicAccess.has(size-1),expectedVisits=publicAccess.connectivityVisited;
 withJournalTerrainReadScope({},()=>{
  const blocked=blockedCells(w),before=candidatePageWork379(),ordinary=candidateAccess(w,start,blocked,occupied,true),planner=candidateAccess(w,start,blocked,occupied,true,start,undefined,undefined,true);
  expect(planner.has(1)).toBe(true);expect(candidatePageWork379().decisions).toBe(before.decisions);
  expect(ordinary.has(size-1)).toBe(expected);expect(ordinary.connectivityVisited).toBe(expectedVisits);expect(candidatePageWork379().decisions).toBe(before.decisions);
  expect(planner.has(size-1)).toBe(expected);expect(planner.connectivityVisited).toBe(512);expect(candidatePageWork379().decisions-before.decisions).toBe(1);
  for(const i of [0,1,99,199,299,size-1,size,-1,.5])expect(planner.has(i)).toBe(ordinary.has(i));
  expect(planner.resolve(new Set([size-1]))).toEqual(ordinary.resolve(new Set([size-1])));planner.dispose?.();ordinary.dispose?.();
 });
});

test('unknown grids and public observations retain the original path',()=>{
 const width=16,height=16,grid=new Uint8Array(width*height),owner={};
 expect(candidatePageConnectivity379(grid,width,height,0,new Int32Array(grid.length))).toBeUndefined();
 withJournalTerrainReadScope(owner,()=>{expect(candidatePageConnectivity379(grid,width,height,0,new Int32Array(grid.length))).toBeUndefined();registerNavigationGrid379(grid,width,height,new Set(),grid.slice(),[]);});
 expect(candidatePageConnectivity379(grid,width,height,0,new Int32Array(grid.length))).toBeUndefined();
 withJournalTerrainReadScope(owner,()=>expect(candidatePageConnectivity379(grid,width,height,0,new Int32Array(grid.length))).toBeUndefined());
});
