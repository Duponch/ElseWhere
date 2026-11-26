import {afterEach,expect,test} from 'vitest';
import {PhasePilePublication379,type PhasePileDraft379} from '../src/bridge/phase-pile-publication-379';
import {OrdinaryPilePublication379} from '../src/bridge/ordinary-pile-publication-379';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {frozenDataCopy297} from '../src/bridge/core-frozen-copy-297';
import {samePilePresentation297} from '../src/bridge/actor-phase-dependencies-297';
import {capturePileContentCursor379,readPileContentCursor379,markPileContentWrite379,invalidateOrdinaryPileSources379} from '../src/sim/ordinary-pile-source-379';
import {capturePileMembershipCursor379,readPileMembershipCursor379,appendPileEntries,splicePileEntries,filterPileEntries,markPileMembershipChanged} from '../src/sim/pile-identity-directory';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {fixture} from './resident-presentation-fixtures-v427';
import type {MaterialPile,World} from '../src/sim/types';

const pile=(id:number):MaterialPile=>({id,kind:'wood',item:'wood',quantity:10,owner:{type:'ground',x:4,z:4}});
const patch=(p:MaterialPile)=>frozenDataCopy297({id:p.id,pile:p});
function commit(draft:PhasePileDraft379):Map<number,Readonly<MaterialPile>> {
 for(const row of draft.rows){if(row.pile)draft.baseline.set(row.id,row.pile);else draft.baseline.delete(row.id);}
 draft.commit();return draft.baseline;
}
function setup(count=1800){
 const world=fixture(),owner={},ordinary=new OrdinaryPilePublication379(owner),calls={full:0,same:0,patch:0};
 world.piles=Array.from({length:count},()=>pile(world.nextId++));
 const publisher=new PhasePilePublication379(owner,{
  full:(p,previous)=>{calls.full++;if(previous&&ordinary.unchanged(p,previous,()=>samePilePresentation297(p,previous)))return previous;
   const copy=frozenDataCopy297(p);ordinary.remember(p,copy);return copy;},
  same:(p,previous)=>{calls.same++;if(ordinary.unchanged(p,previous,()=>samePilePresentation297(p,previous)))return true;
   const same=samePilePresentation297(p,previous);if(same)ordinary.remember(p,previous);return same;},
  patch:p=>{calls.patch++;const copy=patch(p);ordinary.remember(p,copy.pile);return copy;},
 });
 const complex=world.piles.at(-1)!;complex.weapon=undefined;
 const baseline=commit(publisher.prepare(world,undefined,true));
 calls.full=calls.same=calls.patch=0;
 return {world,owner,publisher,baseline,calls,complex,mutate:<T>(fn:()=>T)=>withJournalTerrainReadScope(owner,fn)};
}
afterEach(()=>{setResourceJournalVerification(false);invalidateOrdinaryPileSources379();});

test('phase and Full use only actual content/membership writes plus complex components',()=>{
 const h=setup(),[a,b,c]=h.world.piles;
 const added=pile(h.world.nextId++),removed=b!,replacement=pile(c!.id);
 h.mutate(()=>{
  markPileContentWrite379(a!).quantity=33;
  appendPileEntries(h.world.piles,added);
  h.world.piles=filterPileEntries(h.world.piles,p=>p!==removed);
  splicePileEntries(h.world.piles,1,1,replacement);
  markPileContentWrite379(h.complex).quantity=7;
 });
 const draft=h.publisher.prepare(h.world,h.baseline,false);
 expect(draft.rows).toStrictEqual([patch(a!),{id:removed.id,pile:null},patch(h.complex),patch(added)].sort((a,b)=>a.id-b.id));
 expect(h.calls.same).toBe(3);expect(h.calls.patch).toBe(3);expect(h.calls.full).toBe(0);
 expect(h.baseline.get(a!.id)?.quantity).toBe(10);expect(h.baseline.has(removed.id)).toBe(true);
 commit(draft);expect(h.baseline.get(a!.id)?.quantity).toBe(33);expect(h.baseline.has(removed.id)).toBe(false);
 const previous=h.baseline.get(a!.id);h.calls.full=0;
 h.mutate(()=>{markPileContentWrite379(added).quantity++;});
 const full=h.publisher.prepare(h.world,h.baseline,true);expect(full.baseline).toBe(h.baseline);expect(h.calls.full).toBe(2);
 expect(full.rows.map(row=>row.id)).toEqual([h.complex.id,added.id]);commit(full);expect(h.baseline.get(a!.id)).toBe(previous);
 expect(h.baseline.get(added.id)?.quantity).toBe(11);
});

test('independent readers, filter edges, unknown replacement and abandoned read preserve writer history',()=>{
 const h=setup(8),source=h.world.piles,p=source[0]!,membership=capturePileMembershipCursor379(source,h.owner)!,content=capturePileContentCursor379(h.owner);
 h.mutate(()=>{
  markPileContentWrite379(p).quantity=18;
  h.world.piles=filterPileEntries(source,row=>row!==p);
 });
 const change=readPileMembershipCursor379(h.world.piles,h.owner,membership)!;
 expect(change.edits).toEqual([{removed:[p],appended:[]}]);expect(readPileMembershipCursor379(source,h.owner,membership)).toBeUndefined();
 expect(readPileContentCursor379(h.owner,content)?.writes.has(p)).toBe(true);
 const abandoned=h.publisher.prepare(h.world,h.baseline,false);expect(abandoned.rows).toEqual([{id:p.id,pile:null}]);
 const next=h.world.piles[0]!;h.mutate(()=>markPileContentWrite379(next).quantity++);
 const retry=h.publisher.prepare(h.world,h.baseline,false);expect(retry.rows).toStrictEqual([{id:p.id,pile:null},patch(next)]);commit(retry);
 h.calls.full=0;markPileMembershipChanged(h.world.piles)[0]=pile(h.world.nextId++);
 const full=h.publisher.prepare(h.world,h.baseline,true);expect(full.baseline).not.toBe(h.baseline);expect(h.calls.full).toBe(h.world.piles.length);commit(full);
 invalidateOrdinaryPileSources379();expect(readPileContentCursor379(h.owner,content)).toBeUndefined();
});

test('journal proof is independently exhaustive when enabled and catches missed membership or content',()=>{
 const h=setup(8),p=h.world.piles[0]!;setResourceJournalVerification(true);p.quantity++;
 expect(()=>h.publisher.prepare(h.world,h.baseline,false)).toThrow('Unmarked pile publication content write');
 h.mutate(()=>markPileContentWrite379(p));commit(h.publisher.prepare(h.world,h.baseline,false));
 h.world.piles[0]=pile(p.id);expect(()=>h.publisher.prepare(h.world,h.baseline,false)).toThrow('Unmarked pile publication membership write');
 markPileMembershipChanged(h.world.piles);commit(h.publisher.prepare(h.world,h.baseline,false));
});

class ProbeFullEncoder extends TerrainJournalSnapshotEncoder {
 protected override usesClosedResourceJournal=true;
 candidates:number|undefined;
 protected override pileCandidates(world:World){const result=super.pileCandidates(world);this.candidates=result?.rows.length;return result;}
}
test('Full codec retains exact ordered row/rotation payload while avoiding cold ordinary comparisons',()=>{
 const world=fixture(),owner={},full=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true}),closed=new ProbeFullEncoder(owner);
 world.piles=Array.from({length:1800},()=>pile(world.nextId++));
 const food:MaterialPile={...world.piles[1]!,kind:'food',item:'berries',rot:{progress:0,atTick:0}};world.piles[1]=food;
 const complex=world.piles.at(-1)!;complex.weapon=undefined;
 const send=()=>{const packet=structuredClone(closed.encode(world,0,6)),expected=structuredClone(full.encode(world,0,6));expect(packet).toStrictEqual(expected);return packet;};
 send();expect(closed.candidates).toBeUndefined();send();expect(closed.candidates).toBe(2);
 const dirty=world.piles[2]!,gone=world.piles[3]!,added=pile(world.nextId++);
 withJournalTerrainReadScope(owner,()=>{
  markPileContentWrite379(dirty).quantity++;
  food.rot={progress:1,atTick:0,rate:.5};
  appendPileEntries(world.piles,added);
  world.piles=filterPileEntries(world.piles,p=>p!==gone);
 });
 const next=send();expect(closed.candidates).toBe(4);
 expect(next.kind==='delta'&&next.piles).toStrictEqual({removed:[gone.id],upserted:[dirty,added],rotClock:new Float64Array([food.id,1,0,.5])});
 // An actual middle insertion is a membership edge but does not certify
 // remove/append order. The ordered Full codec falls back once, then seeds.
 const middle=pile(world.nextId++);
 withJournalTerrainReadScope(owner,()=>splicePileEntries(world.piles,4,0,middle));
 const unordered=send();expect(closed.candidates).toBeUndefined();
 expect(unordered.kind==='delta'&&unordered.piles?.order).toEqual(world.piles.map(p=>p.id));
 send();expect(closed.candidates).toBe(2);
 // Removing then re-appending an existing id at the end needs explicit
 // order even though the key set and its value might remain unchanged.
 withJournalTerrainReadScope(owner,()=>{const moved=splicePileEntries(world.piles,0,1)[0]!;appendPileEntries(world.piles,moved);});
 const moved=send();expect(moved.kind==='delta'&&moved.piles?.order).toEqual(world.piles.map(p=>p.id));
 expect(closed.candidates).toBe(3);
});
