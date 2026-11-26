import {afterEach,expect,test} from 'vitest';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {captureResourceJournal,readResourceJournal,markResourceChanged,markResourceArrayChanged,invalidateResourceJournal,RESOURCE_JOURNAL_CAPACITY,setResourceJournalVerification,resourceMembershipUnchanged} from '../src/sim/resource-mutation-journal';
import {fixture} from './resident-presentation-fixtures-v427';
import type {Resource} from '../src/sim/types';
import {markTerrainCellChanged} from '../src/sim/terrain-mutation-journal';

afterEach(()=>setResourceJournalVerification(false));
/** Explicit fixture ownership, matching the fixed production entry only. */
class ClosedResourceFixtureEncoder extends TerrainJournalSnapshotEncoder {
 protected override usesClosedResourceJournal=true;
}
function pair(){
 const world=fixture(),full=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true}),closed=new ClosedResourceFixtureEncoder();
 const send=(checkpoint=false)=>{
  const before=structuredClone(world),a=structuredClone(full.encode(world,0,1,checkpoint)),b=structuredClone(closed.encode(world,0,1,checkpoint));
  expect(b).toStrictEqual(a);expect(world).toStrictEqual(before);return b;
 };return {world,full,closed,send};
}
test('opaque independent cursors track nested writes, presence, A-B-A and overflow without consuming another reader',()=>{
 const world=fixture(),a=captureResourceJournal(world.resources),b=captureResourceJournal(world.resources),r=world.resources[0]!;
 expect(Reflect.ownKeys(a)).toStrictEqual([]);expect(Object.isFrozen(a)).toBe(true);
 r.damage=1;markResourceChanged(world,r);delete r.damage;markResourceChanged(world,r);
 expect([...readResourceJournal(world.resources,a)!.dirtyIds]).toStrictEqual([r.id]);expect([...readResourceJournal(world.resources,b)!.dirtyIds]).toStrictEqual([r.id]);
 expect(resourceMembershipUnchanged(world.resources,a)).toBe(true);
 const before=world.resources,added:Resource={...r,id:world.nextId++};world.resources=[before[1]!,added];markResourceArrayChanged(world,before,[added],[r]);
 const change=readResourceJournal(world.resources,a)!;expect(change.membershipChanged).toBe(true);expect(change.membershipEdits).toStrictEqual([{removed:[r],appended:[added]}]);
 expect(resourceMembershipUnchanged(world.resources,a)).toBe(false);expect(readResourceJournal(before,a)).toBeUndefined();
 for(let i=0;i<=RESOURCE_JOURNAL_CAPACITY;i++)markResourceChanged(world,added);
 expect(readResourceJournal(world.resources,change.cursor)).toBeUndefined();expect(resourceMembershipUnchanged(world.resources,change.cursor)).toBe(true);
 const cursor=captureResourceJournal(world.resources);invalidateResourceJournal(world);expect(readResourceJournal(world.resources,cursor)).toBeUndefined();
});
test('closed packets equal exhaustive packets through values, nested records, property deletion, membership and same-tick order',()=>{
 const h=pair(),w=h.world,r=w.resources[0]!;h.send();
 r.damage=2;markResourceChanged(w,r);h.send();delete r.damage;markResourceChanged(w,r);h.send();
 r.plantLife={since:w.tick,age:0,darkTicks:0,nextCheck:w.tick+20};markResourceChanged(w,r);h.send();
 r.plantLife.age=1;r.plantLife.nextCheck+=200;markResourceChanged(w,r);h.send();
 r.plantLife.leaflessAt=undefined;markResourceChanged(w,r);h.send();delete r.plantLife.leaflessAt;markResourceChanged(w,r);h.send();
 r.blight={since:w.tick,severity:.2,lastHarmTick:w.tick,nextCheck:w.tick+1,rng:19};markResourceChanged(w,r);h.send();
 r.blight.rng=99;r.blight.severity=.3;markResourceChanged(w,r);h.send();
 const before=w.resources,added:Resource={...r,id:w.nextId++};w.resources=[before[1]!,added];markResourceArrayChanged(w,before,[added],[r]);h.send();
 const reordered=w.resources;w.resources=[...w.resources].reverse();markResourceArrayChanged(w,reordered);h.send();
 w.resources=w.resources.map(p=>({...p,amount:p.amount+1}));h.send();h.send(true);h.send();
});
test('stable membership never reads untouched resource fields; public encoding stays exhaustive on enrolled arrays',()=>{
 const w=fixture(),closed=new ClosedResourceFixtureEncoder(),full=new SnapshotEncoder();closed.encode(w,0,1);full.encode(w,0,1);
 const r=w.resources[1]!,amount=r.amount;let reads=0;Object.defineProperty(r,'amount',{configurable:true,enumerable:true,get(){reads++;return amount;}});
 closed.encode(w,0,1);expect(reads).toBe(0);full.encode(w,0,1);expect(reads).toBeGreaterThan(0);
 Object.defineProperty(r,'amount',{configurable:true,enumerable:true,writable:true,value:amount+1});
 const packet=full.encode(w,0,1);expect(packet.kind).toBe('delta');if(packet.kind==='delta')expect(packet.resources?.upserted[0]?.id).toBe(r.id);
});
test('unknown transaction and rollback force complete rediscovery; late failure forces checkpoint retry',()=>{
 const h=pair(),w=h.world;h.send();w.resources[0]!.amount++;invalidateResourceJournal(w);h.send();
 const before=structuredClone(w.resources);w.resources[0]!.growth=.9;invalidateResourceJournal(w);w.resources=before;h.send();
 w.resources[0]!.damage=1;markResourceChanged(w,w.resources[0]!);Object.defineProperty(w.tiles[0]!,'fogged',{value:undefined,enumerable:true,configurable:true});
 markTerrainCellChanged(w.tiles,0);
 expect(()=>h.full.encode(w,0,1)).toThrow();expect(()=>h.closed.encode(w,0,1)).toThrow();delete w.tiles[0]!.fogged;
 const actual=structuredClone(h.closed.encode(w,0,1));expect(actual.kind).toBe('checkpoint');expect(actual).toStrictEqual(structuredClone(h.full.encode(w,0,1,true)));
});
test('independent exhaustive verification rejects an unmarked nested resource writer',()=>{
 setResourceJournalVerification(true);const w=fixture(),closed=new ClosedResourceFixtureEncoder();closed.encode(w,0,1);
 const r=w.resources[0]!;r.plantLife={since:w.tick,age:0,darkTicks:0,nextCheck:w.tick+1};markResourceChanged(w,r);closed.encode(w,0,1);
 r.plantLife.darkTicks++;expect(()=>closed.encode(w,0,1)).toThrow('differs from exhaustive codec');
 invalidateResourceJournal(w);expect(closed.encode(w,0,1).kind).toBe('checkpoint');
});

test('verification can be enabled after earlier publications and a campaign header',()=>{
 const w=fixture(),closed=new ClosedResourceFixtureEncoder();closed.encode(w,0,1);closed.encode(w,0,1);closed.campaignHeader(true);closed.encode(w,0,1);
 setResourceJournalVerification(true);expect(closed.encode(w,0,1).kind).toBe('checkpoint');
 w.resources[0]!.amount++;markResourceChanged(w,w.resources[0]!);expect(closed.encode(w,0,1).kind).toBe('delta');
});

test('public terrain encoder discovers unmarked resource writes even on an enrolled array',()=>{
 const w=fixture(),full=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true}),publicTerrain=new TerrainJournalSnapshotEncoder(),closed=new ClosedResourceFixtureEncoder();
 const send=()=>expect(structuredClone(publicTerrain.encode(w,0,1))).toStrictEqual(structuredClone(full.encode(w,0,1)));
 closed.encode(w,0,1);send();
 w.resources[0]!.amount++;send();
 w.resources[0]!.plantLife={since:w.tick,age:0,darkTicks:0,nextCheck:w.tick+1};send();
 w.resources[0]!.plantLife.darkTicks++;send();
 w.resources.reverse();send();w.resources.splice(0,1);send();
});
