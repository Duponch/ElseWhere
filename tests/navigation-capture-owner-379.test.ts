import {expect,test} from 'vitest';
import {navigationCosts} from '../src/sim/furniture-travel';
import {withTerrainBlockedReadScope,withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {assignPileOwner,pileIndex,setPileIndexVerification,verifyPileIndex,withPileIndexScope} from '../src/sim/pile-index';
import {newDoorState} from '../src/sim/door-rules';
import {WeightedSearch} from '../src/sim/weighted-search';
import type {World} from '../src/sim/types';

const fixture=()=>({schemaVersion:83,width:8,height:8,tiles:Array.from({length:64},()=>({terrain:'grass'})),structures:[],jobs:[],piles:[],pawns:[],tick:30}) as unknown as World;

test('scoped copy-on-write captures preserve native public costs, sets, maxima, routes and old captures after mutable writes',()=>{
 const w=fixture();
 w.structures.push({id:1,kind:'table',x:3,z:3,orientation:0,footprint:'standard',material:'wood'},
  {id:2,kind:'stool',x:3,z:5,orientation:0,footprint:'standard',material:'wood'},
  {id:3,kind:'door',x:5,z:3,orientation:0,footprint:'standard',material:'wood',door:newDoorState(0)});
 w.jobs.push({id:4,kind:'wall',x:3,z:3,orientation:0,footprint:'standard',construction:'frame',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}},
  {id:5,kind:'wall',x:6,z:6,orientation:0,footprint:'standard',construction:'frame',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
 w.piles.push({id:6,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:4,z:3}},
  {id:7,kind:'steel',item:'steel',quantity:1,owner:{type:'ground',x:3,z:5}});
 const full=navigationCosts(w),scoped=withTerrainBlockedReadScope(()=>navigationCosts(w));
 expect(full.stops).toBeInstanceOf(Set);expect(full.repeaters).toBeInstanceOf(Set);
 for(const key of ['repeaters','stops'] as const){expect([...scoped[key]]).toEqual([...full[key]]);expect(scoped[key].size).toBe(full[key].size);}
 for(const key of ['costs','floors'] as const){
  expect(scoped[key]?.maximum).toBe(full[key]?.maximum);
  for(let i=-1;i<=64;i++){expect(scoped[key]?.get(i)).toBe(full[key]?.get(i));expect(scoped[key]?.has(i)).toBe(full[key]?.has(i));}
 }
 const route=(n:ReturnType<typeof navigationCosts>)=>new WeightedSearch(8,8,0,new Uint8Array(64),n.costs,n.repeaters,n.floors,new Set([29])).finish();
 expect(route(scoped)).toEqual(route(full));
 const old=Array.from({length:64},(_,i)=>scoped.costs?.get(i));
 w.jobs=[];w.piles=[];w.structures[2]!.door!.open=true;w.structures[2]!.door!.from=1;
 w.structures.push({id:8,kind:'standing-lamp',x:1,z:1,orientation:0,footprint:'standard',material:'wood'});
 const fresh=withTerrainBlockedReadScope(()=>navigationCosts(w));
 expect(fresh.costs?.get(54)).toBeUndefined();expect(fresh.stops.has(28)).toBe(false);
 expect(fresh.costs?.get(9)).toBe(467);expect(fresh.costs?.get(29)).toBe(0);
 expect(Array.from({length:64},(_,i)=>scoped.costs?.get(i))).toEqual(old);
 expect([...scoped.stops]).toEqual([...full.stops]);
});

test('exclusive pile witnesses observe marked writes, while public and different-owner scopes read unmarked external edits',()=>{
 const w=fixture(),owner={},read=()=>withPileIndexScope(()=>pileIndex(w)!);
 w.piles.push({id:1,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:2,z:2}});
 const first=withJournalTerrainReadScope(owner,read);expect(first.groundFacts[18]).toBe(1);
 expect(withJournalTerrainReadScope(owner,read)).toBe(first);
 assignPileOwner(w.piles[0]!,{type:'ground',x:3,z:2});
 const moved=withJournalTerrainReadScope(owner,read);expect(moved.groundFacts[18]).toBe(0);expect(moved.groundFacts[19]).toBe(1);
 w.piles[0]!.owner={type:'ground',x:4,z:2};
 expect(withJournalTerrainReadScope({},read).groundFacts[20]).toBe(1);
 w.piles[0]!.owner={type:'ground',x:5,z:2};expect(read().groundFacts[21]).toBe(1);
 w.piles[0]!.owner={type:'ground',x:6,z:2};expect(read().groundFacts[22]).toBe(1);
 withJournalTerrainReadScope(owner,read);expect(pileIndex(w)).toBeUndefined();
 w.piles[0]!.owner={type:'ground',x:7,z:2};expect(withJournalTerrainReadScope(owner,read).groundFacts[23]).toBe(1);
});

test('pile verification rejects an unmarked owner replacement across exclusive clock tasks',()=>{
 const w=fixture(),owner={},old=verifyPileIndex,read=()=>withJournalTerrainReadScope(owner,()=>withPileIndexScope(()=>pileIndex(w)!));
 w.piles.push({id:1,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:2,z:2}});
 try{
  setPileIndexVerification(true);read();w.piles[0]!.owner={type:'ground',x:3,z:2};
  expect(read).toThrow('Unmarked pile write');
  expect(withPileIndexScope(()=>pileIndex(w)!.groundFacts[19])).toBe(1);
 }finally{setPileIndexVerification(old);}
});
