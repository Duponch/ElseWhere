import {afterEach,expect,test,vi} from 'vitest';
import {filterPileEntries,appendPileEntries,splicePileEntries,markPileMembershipChanged,pileById} from '../src/sim/pile-identity-directory.ts';
import {assignPileOwner,markPileWrite,setPileIndexVerification,verifyPileIndex} from '../src/sim/pile-index.ts';
import {withJournalTerrainReadScope,withTerrainBlockedReadScope} from '../src/sim/terrain-read-scope.ts';
import {setTerrainWriteCacheVerification,verifyTerrainWriteCaches} from '../src/sim/terrain-mutation-journal.ts';
import {removeIdentity} from '../src/sim/collection-remove.ts';
import type {MaterialPile} from '../src/sim/types.ts';

const pile=(id:number):MaterialPile=>({id,kind:'steel',item:'steel',quantity:1,owner:{type:'ground',x:2,z:2}});
const initialPileVerification=verifyPileIndex,initialTerrainVerification=verifyTerrainWriteCaches;
afterEach(()=>{setPileIndexVerification(initialPileVerification);setTerrainWriteCacheVerification(initialTerrainVerification);vi.restoreAllMocks();});

test('only exclusive SIM calls reuse the identity directory independently of owner moves',()=>{
 setPileIndexVerification(false);setTerrainWriteCacheVerification(false);
 const a=pile(1),b=pile(2),w={piles:[a,b]},owner={},read=(id:unknown)=>withJournalTerrainReadScope(owner,()=>pileById(w,id));
 const iteration=vi.spyOn(w.piles,Symbol.iterator);
 expect(read(2)).toBe(b);expect(iteration).toHaveBeenCalledTimes(1);
 for(let i=0;i<20;i++){assignPileOwner(b,{type:'pawn',pawnId:i+1});expect(read(2)).toBe(b);expect(read(99)).toBeUndefined();}
 expect(iteration).toHaveBeenCalledTimes(1);
});

test('explicit membership marks cover append, same-length middle replacement, reorder and indirect removal',()=>{
 const a=pile(1),b=pile(2),c=pile(3),w={piles:[a,b,c]},owner={},read=(id:unknown)=>withJournalTerrainReadScope(owner,()=>pileById(w,id));
 expect(read(2)).toBe(b);const d=pile(4);markPileMembershipChanged(w.piles).push(d);expect(read(4)).toBe(d);
 const replacement=pile(2);markPileMembershipChanged(w.piles).splice(1,1,replacement);
 expect(read(2)).toBe(replacement);expect(read(1)).toBe(a);expect(read(4)).toBe(d);
 const duplicate=pile(2);markPileMembershipChanged(w.piles).unshift(duplicate);expect(read(2)).toBe(duplicate);
 markPileMembershipChanged(w.piles).reverse();expect(read(2)).toBe(replacement);
 expect(removeIdentity(w.piles,replacement)).toBe(true);expect(read(2)).toBe(duplicate);
 const before=w.piles.slice();expect(removeIdentity(w.piles,replacement)).toBe(false);expect(w.piles).toEqual(before);
});

test('replaced arrays, changed owners and public calls establish complete fresh membership',()=>{
 const a=pile(1),b=pile(2),w={piles:[a,b]},owner={},read=()=>withJournalTerrainReadScope(owner,()=>pileById(w,2));
 expect(read()).toBe(b);w.piles=[a,pile(2)];expect(read()).toBe(w.piles[1]);
 w.piles[1]=pile(2);expect(withJournalTerrainReadScope({},()=>pileById(w,2))).toBe(w.piles[1]);
 expect(pileById(w,2)).toBe(w.piles[1]);w.piles[1]=pile(2);expect(read()).toBe(w.piles[1]);
 w.piles[1]=pile(2);expect(withTerrainBlockedReadScope(()=>pileById(w,2))).toBe(w.piles[1]);
 w.piles[1]=pile(2);expect(pileById(w,2)).toBe(w.piles[1]);
});

test('generic unknown pile writes invalidate element and id changes without spatial ownership assumptions',()=>{
 const a=pile(1),w={piles:[a]},owner={},read=(id:number)=>withJournalTerrainReadScope(owner,()=>pileById(w,id));
 expect(read(1)).toBe(a);w.piles[0]=pile(1);markPileWrite();expect(read(1)).toBe(w.piles[0]);
 w.piles[0]!.id=2;markPileWrite();expect(read(1)).toBeUndefined();expect(read(2)).toBe(w.piles[0]);
});

test.each(['pile','terrain'] as const)('%s verification exhaustively rejects unmarked middle changes even for an unrelated lookup',flag=>{
 const w={piles:[pile(1),pile(2),pile(3)]},owner={},read=()=>withJournalTerrainReadScope(owner,()=>pileById(w,1));
 if(flag==='pile')setPileIndexVerification(true);else setTerrainWriteCacheVerification(true);
 read();w.piles[1]=pile(2);expect(read).toThrow('Unmarked pile identity membership write');
 markPileMembershipChanged(w.piles);expect(read()).toBe(w.piles[0]);
});

test('strict equality preserves first matches, missing keys, NaN, signed zero and dynamic public edits',()=>{
 const first=pile(3),second=pile(3),nan=pile(NaN),zero=pile(-0),w={piles:[first,second,nan,zero]},owner={};
 for(const id of [3,NaN,0,-0,4,'3',null,undefined]){
  const expected=w.piles.find(p=>p.id===id);
  expect(pileById(w,id)).toBe(expected);expect(withJournalTerrainReadScope(owner,()=>pileById(w,id))).toBe(expected);
 }
 expect(pileById(w,3)).toBe(first);w.piles.reverse();expect(pileById(w,3)).toBe(second);
});

test('native appends and splices update unique identities without another map-wide capture or find',()=>{
 setPileIndexVerification(false);setTerrainWriteCacheVerification(false);
 const w={piles:[pile(1),pile(2),pile(3)]},owner={},run=<T>(f:()=>T)=>withJournalTerrainReadScope(owner,f);
 const iteration=vi.spyOn(w.piles,Symbol.iterator),find=vi.spyOn(w.piles,'find');
 run(()=>pileById(w,1));const a=pile(4),b=pile(5);
 expect(run(()=>appendPileEntries(w.piles,a,b))).toBe(5);expect(run(()=>pileById(w,5))).toBe(b);
 const expected=w.piles.slice(),removed=expected.splice(-3,2,pile(6));
 expect(run(()=>splicePileEntries(w.piles,-3,2,expected[2]!))).toEqual(removed);
 expect(w.piles).toEqual(expected);expect(run(()=>pileById(w,3))).toBeUndefined();expect(run(()=>pileById(w,6))).toBe(expected[2]);
 expect(iteration).toHaveBeenCalledTimes(1);expect(find).not.toHaveBeenCalled();
});

test('incremental splices preserve duplicate first matches and native omitted or undefined deleteCount under the oracle',()=>{
 setPileIndexVerification(true);
 const first=pile(2),second=pile(2),w={piles:[pile(1),first,pile(3)]},owner={},run=<T>(f:()=>T)=>withJournalTerrainReadScope(owner,f);
 run(()=>pileById(w,2));run(()=>appendPileEntries(w.piles,second));expect(run(()=>pileById(w,2))).toBe(first);
 const earlier=pile(2);run(()=>splicePileEntries(w.piles,0,0,earlier));expect(run(()=>pileById(w,2))).toBe(earlier);
 run(()=>splicePileEntries(w.piles,0,1));expect(run(()=>pileById(w,2))).toBe(first);
 run(()=>splicePileEntries(w.piles,1,1));expect(run(()=>pileById(w,2))).toBe(second);
 expect(run(()=>splicePileEntries(w.piles,1,undefined))).toEqual([]);expect(run(()=>pileById(w,2))).toBe(second);
 expect(run(()=>splicePileEntries(w.piles,-1))).toEqual([second]);expect(run(()=>pileById(w,2))).toBeUndefined();
});

test('late oracle activation and operations under another owner rebuild instead of trusting a missing witness',()=>{
 setPileIndexVerification(false);setTerrainWriteCacheVerification(false);
 const w={piles:[pile(1),pile(2)]},owner={},read=()=>withJournalTerrainReadScope(owner,()=>pileById(w,2));
 read();setPileIndexVerification(true);expect(read()).toBe(w.piles[1]);
 w.piles[0]=pile(1);expect(read).toThrow('Unmarked pile identity membership write');markPileMembershipChanged(w.piles);read();
 withJournalTerrainReadScope({},()=>appendPileEntries(w.piles,pile(3)));expect(read()).toBe(w.piles[1]);
 w.piles[0]=pile(1);expect(read).toThrow('Unmarked pile identity membership write');
});

test('read-only filtering transfers the warm directory without another full capture and retires the old alias',()=>{
 setPileIndexVerification(false);setTerrainWriteCacheVerification(false);
 const a=pile(1),b=pile(2),c=pile(3),w={piles:[a,b,c]},old=w.piles,owner={},run=<T>(f:()=>T)=>withJournalTerrainReadScope(owner,f);
 const iteration=vi.spyOn(old,Symbol.iterator),predicate=vi.fn((p:MaterialPile)=>p!==b);
 run(()=>pileById(w,1));w.piles=run(()=>filterPileEntries(w.piles,predicate));
 const newIteration=vi.spyOn(w.piles,Symbol.iterator);expect(predicate).toHaveBeenCalledTimes(3);
 expect(predicate.mock.calls.map(([p])=>p)).toEqual([a,b,c]);expect(run(()=>pileById(w,2))).toBeUndefined();expect(run(()=>pileById(w,3))).toBe(c);
 expect(newIteration).not.toHaveBeenCalled();expect(iteration).toHaveBeenCalledTimes(1);
 expect(run(()=>pileById({piles:old},2))).toBe(b);expect(iteration).toHaveBeenCalledTimes(2);
});

test('filter migration preserves first duplicates, no-removal filters and the exhaustive oracle',()=>{
 setPileIndexVerification(true);
 const first=pile(2),second=pile(2),w={piles:[pile(1),first,second,pile(NaN)]},owner={},run=<T>(f:()=>T)=>withJournalTerrainReadScope(owner,f);
 run(()=>pileById(w,2));w.piles=run(()=>filterPileEntries(w.piles,p=>p!==first));expect(run(()=>pileById(w,2))).toBe(second);
 const old=w.piles;w.piles=run(()=>filterPileEntries(w.piles,()=>true));expect(w.piles).not.toBe(old);expect(run(()=>pileById(w,2))).toBe(second);
 expect(run(()=>pileById(w,NaN))).toBeUndefined();w.piles[0]=pile(1);expect(()=>run(()=>pileById(w,2))).toThrow('Unmarked pile identity membership write');
});

test('filter falls cold after marked predicate mutations and preserves custom public method arguments',()=>{
 const w={piles:[pile(1),pile(2)]},owner={},run=<T>(f:()=>T)=>withJournalTerrainReadScope(owner,f);
 run(()=>pileById(w,1));let once=false;
 w.piles=run(()=>filterPileEntries(w.piles,p=>{if(!once){once=true;appendPileEntries(w.piles,pile(3));}return p.id!==1;}));
 expect(run(()=>pileById(w,1))).toBeUndefined();expect(run(()=>pileById(w,2))).toBe(w.piles[0]);expect(run(()=>pileById(w,3))).toBeUndefined();
 const custom=[pile(1)];const filter=vi.fn(function(this:MaterialPile[],...args:unknown[]){expect(args).toHaveLength(1);return this;});
 Object.defineProperty(custom,'filter',{value:filter});expect(filterPileEntries(custom,()=>true)).toBe(custom);expect(filter).toHaveBeenCalledTimes(1);
});
