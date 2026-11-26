import {expect,test} from 'vitest';
import {captureNavigationCostLayers,overlayNavigationCosts,scaleNavigationCosts,transformNavigationCosts,searchNavigationCostColumns,type NavigationCostLookup} from '../src/sim/navigation-costs.ts';
import {addFireNavigationCosts} from '../src/sim/fire-navigation.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {WeightedSearch} from '../src/sim/weighted-search.ts';

function legacy(terrain:Uint16Array,sparse:Map<number,number>,additions:Map<number,number>[],base=true):NavigationCostLookup|undefined {
 let result=base?overlayNavigationCosts(terrain,Math.max(...terrain),sparse):undefined;
 for(const addition of additions)result=addFireNavigationCosts(result,addition);return result;
}
const rounded=(costs:NavigationCostLookup):NavigationCostLookup=>({get(i){const v=costs.get(i);return v===undefined?undefined:Math.round(v*.03);},has:i=>costs.has(i),maximum:Math.round(costs.maximum*.03)});

test('one cost program preserves present zeroes, additive order, maxima and every normalization',()=>{
 const terrain=Uint16Array.from({length:561},(_,i)=>i%7?i%3*67:0),sparse=new Map([[0,0],[255,1400],[256,0],[560,34],[700,0],[2.5,19]]);
 const additions=[new Map([[0,0],[255,33333],[256,5000],[700,4]]),new Map([[255,26667],[511,26667]]),new Map([[256,400],[512,800]])];
 for(const base of [true,false]){
  let expected=legacy(terrain,sparse,additions,base)!,actual=captureNavigationCostLayers(terrain,Math.max(...terrain),sparse,additions,base)!;
  for(let operation=0;operation<4;operation++){
   for(const i of [-1,0,.5,2.5,254,255,256,257,511,512,559,560,561,700,4294967296]){expect(actual.get(i)).toBe(expected.get(i));expect(actual.has(i)).toBe(expected.has(i));}
   expect(actual.maximum).toBe(expected.maximum);
   if(operation===0){actual=transformNavigationCosts(actual,.03,true)!;expected=rounded(expected);}
   else{actual=scaleNavigationCosts(actual,1.41421)!;const before=expected;expected={get(i){const v=before.get(i);return v===undefined?undefined:v*1.41421;},has:i=>before.has(i),maximum:before.maximum*1.41421};}
  }
 }
});

test('only a closed owner memoizes cells; public observation retires all transformed witnesses',()=>{
 const owner={},terrain=new Uint16Array(512),sparse=new Map([[255,67]]);
 let actual:NavigationCostLookup,scaled:NavigationCostLookup;
 withJournalTerrainReadScope(owner,()=>{
  actual=captureNavigationCostLayers(terrain,0,sparse,[])!;scaled=scaleNavigationCosts(actual,3)!;
  expect(actual.get(255)).toBe(67);expect(actual.get(255)).toBe(67);expect(scaled.get(255)).toBe(201);
  expect(searchNavigationCostColumns(actual)!.pages[0]!.states[255]).toBe(2);
  expect(searchNavigationCostColumns(actual)!.pages[1]).toBeUndefined();
 });
 sparse.set(255,99);expect(actual!.get(255)).toBe(99);expect(scaled!.get(255)).toBe(297);
 withJournalTerrainReadScope(owner,()=>{expect(searchNavigationCostColumns(actual!)).toBeUndefined();expect(searchNavigationCostColumns(scaled!)).toBeUndefined();expect(actual!.get(255)).toBe(99);});
});

test('owned cost pages retain exact resumable parents, ties, goal layers and final sentinels',()=>{
 const width=17,height=17,size=width*height,terrain=Uint16Array.from({length:size},(_,i)=>i%9===0?67:i%11===0?167:0);
 const sparse=new Map<number,number>(),fire=new Map<number,number>(),marsh=new Map<number,number>();
 for(let i=1;i<size;i++){if(i%13===0)sparse.set(i,1400);if(i%31===0)fire.set(i,5000);if(i%17===0)marsh.set(i,400);}
 const floors=new Map<number,number>([[90,467],[165,467]]),blocked=new Uint8Array(size),repeaters=new Set<number>(),corners=new Set([24,60,150]);
 for(let i=1;i<size;i++){if(i%43===0)blocked[i]=1;if(i%13===0)repeaters.add(i);}
 withJournalTerrainReadScope({},()=>{
  const costs=transformNavigationCosts(captureNavigationCostLayers(terrain,167,sparse,[fire,marsh]),.03,true),floorCosts=transformNavigationCosts(captureNavigationCostLayers(terrain,167,floors,[fire,marsh]),.03,true)!;
  const expectedCosts=rounded(legacy(terrain,sparse,[fire,marsh])!),expectedFloors=rounded(legacy(terrain,floors,[fire,marsh])!);
  const actual=new WeightedSearch(width,height,0,blocked,costs,repeaters,floorCosts,corners,undefined,{cardinal:13,diagonal:18});
  const expected=new WeightedSearch(width,height,0,blocked,expectedCosts,repeaters,expectedFloors,corners,undefined,{cardinal:13,diagonal:18});
  for(const goals of [new Set([40,41]),new Set([200]),new Set([280,281])])expect(actual.advance(goals)).toEqual(expected.advance(goals));
  expect(actual.finish()).toEqual(expected.finish());
 });
});

test('private frontier reuse leaves prior fields intact after early finish, disposal and changed bucket sizes',()=>{
 const size=256,blocked=new Uint8Array(size),cases=Array.from({length:12},(_,i)=>({start:i,goal:240-i,maximum:i%2?300:1900}));
 const lookup=(maximum:number):NavigationCostLookup=>({maximum,has:i=>i%7===0,get:i=>i%7===0?maximum:undefined});
 const expected=cases.map(c=>new WeightedSearch(16,16,c.start,blocked,lookup(c.maximum)).finish(new Set([c.goal])));
 withJournalTerrainReadScope({},()=>{
  const retained:ReturnType<WeightedSearch['advance']>[]=[],copies:ReturnType<typeof structuredClone>[]=[];
  for(const [i,c] of cases.entries()){
   const abandoned=new WeightedSearch(16,16,0,blocked,lookup(1400));const partial=abandoned.advance(new Set([1]));
   retained.push(partial);copies.push(structuredClone(partial));abandoned.dispose();
   const actual=new WeightedSearch(16,16,c.start,blocked,lookup(c.maximum)).finish(new Set([c.goal]));expect(actual).toEqual(expected[i]);
   retained.push(actual);copies.push(structuredClone(actual));
  }
  for(let i=0;i<retained.length;i++)expect(retained[i]).toEqual(copies[i]);
 });
});
