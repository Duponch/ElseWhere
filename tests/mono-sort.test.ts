// The game's unstable introspective sort (src/sim/mono-sort.ts). Every
// expected order below is derived by hand from the decompiled algorithm
// (mscorlib shipped with RimWorld 1.6: ArraySortHelper<T>.IntrospectiveSort).
import {describe,expect,it} from 'vitest';
import {monoIntrospectiveSort,monoHeapsort,floorLog2PlusOne} from '../src/sim/mono-sort';
interface Item {key:number;tag:string}
const items=(spec:string)=>spec.split(' ').map(s=>({key:Number(s.slice(0,-1)),tag:s.slice(-1)}));
const tags=(list:readonly Item[])=>list.map(i=>i.tag).join('');
const ascending=(a:Item,b:Item)=>a.key<b.key?-1:a.key>b.key?1:0;
/** The game's comparison for the ancient road chains: `-lhs.Count.CompareTo(rhs.Count)`. */
const descending=(a:Item,b:Item)=>-ascending(a,b);

describe('Mono introspective sort',()=>{
 it('depth limit: 2 × (⌊log2 n⌋ + 1)',()=>{
  expect([1,2,3,16,17,225,484].map(floorLog2PlusOne)).toEqual([1,2,2,5,5,8,9]);
 });
 it('three elements: the swap network reverses two equal keys',()=>{
  // (lo, hi−1): 1a vs 1b equal; (lo, hi): 1a > 0c, swap; (hi−1, hi): 1b vs 1a equal.
  const list=items('1a 1b 0c');monoIntrospectiveSort(list,ascending);expect(tags(list)).toBe('cba');
 });
 it('up to 16 elements: insertion sort keeps equal keys in order',()=>{
  const list=items('4a 6b 4c 6d 5e');monoIntrospectiveSort(list,descending);expect(tags(list)).toBe('bdeac');
 });
 it('17 equal keys: one median-of-three partition, then two insertion sorts',()=>{
  // Pivot keys[8] (i) parked at 15; the scans stop on every equal key and
  // swap 1↔14 … 7↔8; the pivot returns to 8; both halves (8 elements) are
  // already in order for insertion sort.
  const list=Array.from('abcdefghijklmnopq',tag=>({key:0,tag}));
  monoIntrospectiveSort(list,ascending);expect(tags(list)).toBe('aonmlkjpigfedcbhq');
 });
 it('sorts distinct keys like any sort, over the insertion-sort threshold',()=>{
  const list=Array.from({length:40},(_,i)=>({key:39-i,tag:String.fromCharCode(48+i)}));
  monoIntrospectiveSort(list,ascending);expect(list.map(i=>i.key)).toEqual(Array.from({length:40},(_,i)=>i));
 });
 it('sorts only the requested range',()=>{
  const list=items('9a 3b 2c 1d 0e');monoIntrospectiveSort(list,ascending,1,3);expect(tags(list)).toBe('adcbe');
  expect(()=>monoIntrospectiveSort(list,ascending,3,4)).toThrow();
 });
 it('heapsort fallback: equal keys end rotated',()=>{
  // Heapify: 1a stays (children equal to it). Pass 3: swap(0,2) → c b a,
  // sift c over b (not smaller). Pass 2: swap(0,1) → b c a.
  const list=items('1a 1b 1c');monoHeapsort(list,ascending);expect(tags(list)).toBe('bca');
  const mixed=items('2a 0b 1c 0d');monoHeapsort(mixed,ascending);expect(mixed.map(i=>i.key)).toEqual([0,0,1,2]);
 });
});
