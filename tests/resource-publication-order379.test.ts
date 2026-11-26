import {expect,test} from 'vitest';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {ResourcePublicationOrder} from '../src/bridge/resource-publication-order';
import {markResourceArrayChanged,markResourceChanged,invalidateResourceJournal,RESOURCE_JOURNAL_CAPACITY} from '../src/sim/resource-mutation-journal';
import {fixture} from './resident-presentation-fixtures-v427';
import type {Resource} from '../src/sim/types';

class ClosedEncoder extends TerrainJournalSnapshotEncoder {protected override usesClosedResourceJournal=true;}
function harness(count=8){
 const world=fixture(),sample=world.resources[0]!;
 world.resources=Array.from({length:count},(_,i)=>({...sample,id:world.nextId++,x:i%world.width}));
 const full=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true}),closed=new ClosedEncoder();
 const send=()=>{const expected=structuredClone(full.encode(world,0,6)),actual=structuredClone(closed.encode(world,0,6));expect(actual).toStrictEqual(expected);return actual;};
 const edit=(removed:Resource[],appended:Resource[])=>{const before=world.resources,remove=new Set(removed);world.resources=before.filter(r=>!remove.has(r)).concat(appended);markResourceArrayChanged(world,before,appended,removed);};
 return {world,closed,send,edit,fresh:()=>({...sample,id:world.nextId++})};
}

test('resident membership emits exact old-order removals and explicit order for reinsertion around new rows',()=>{
 const h=harness();h.send();
 const a=h.world.resources[1]!,b=h.world.resources[5]!,fresh=h.fresh();
 h.edit([b,a],[fresh,a]);const packet=h.send();
 expect(packet.kind).toBe('delta');if(packet.kind==='delta'){
  expect(packet.resources?.removed).toEqual([b.id]);expect(packet.resources?.order).toEqual(h.world.resources.map(r=>r.id));
 }
 // A prior last survivor appended after a new row also needs explicit order,
 // although its relative order among old survivors is still unchanged.
 const last=h.world.resources.at(-1)!,next=h.fresh();h.edit([last],[next,last]);h.send();
 // Reinsert the last row in the same place with no field change: no resource
 // delta at all, exactly as the exhaustive codec discovers.
 h.edit([last],[last]);const unchanged=h.send();if(unchanged.kind==='delta')expect(unchanged.resources).toBeUndefined();
 // Removal and readdition of an unpublished new ID must not leak a removal.
 const ephemeral=h.fresh();h.edit([],[ephemeral]);h.edit([ephemeral],[]);h.send();
});

test('many writer transactions preserve dirty source order, growth/life forms and fallback baselines',()=>{
 const h=harness(40);h.send();let rng=743;
 const random=(n:number)=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%n;};
 for(let turn=0;turn<90;turn++){
  for(let edit=0;edit<3;edit++){
   const rows=h.world.resources,removed=rows.length?[rows[random(rows.length)]!]:[];
   const appended=random(3)===0?removed:random(2)?[h.fresh()]:[];
   h.edit(removed,appended);
   if(h.world.resources.length){const row=h.world.resources[random(h.world.resources.length)]!;row.growth=(row.growth??0)+.001;markResourceChanged(h.world,row);}
  }
  h.send();
 }
 // An unknown reorder must rebuild from the last *published* linked order,
 // including all previous sparse value updates and removals.
 const before=h.world.resources;h.world.resources=[...before].reverse();markResourceArrayChanged(h.world,before);h.send();
 h.edit(h.world.resources.slice(0,2),[h.fresh()]);h.send();
 if(h.world.resources[0]){h.world.resources[0].amount++;invalidateResourceJournal(h.world);}h.send();
 if(h.world.resources[0])for(let i=0;i<=RESOURCE_JOURNAL_CAPACITY;i++)markResourceChanged(h.world,h.world.resources[0]);h.send();
 h.edit([], [h.fresh()]);h.send();
});

test('a certified membership edit never traverses the surviving source array',()=>{
 const h=harness(512);h.send();const removed=h.world.resources[173]!,added=h.fresh();h.edit([removed],[added]);
 const source=h.world.resources;let indexedReads=0;
 h.world.resources=new Proxy(source,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))indexedReads++;return Reflect.get(target,key,receiver);}});
 // Transfer the already certified edit to the proxy without a survivor pass.
 markResourceArrayChanged(h.world,source,[],[]);
 const actual=structuredClone(h.closed.encode(h.world,0,6));
 expect(indexedReads).toBe(0);expect(actual.kind).toBe('delta');
 if(actual.kind==='delta'){expect(actual.resources?.removed).toEqual([removed.id]);expect(actual.resources?.upserted.map(r=>r.id)).toEqual([added.id]);}
});

test('contradictory edit records and duplicate identities refuse the resident order',()=>{
 const h=harness(),rows=h.world.resources,order=ResourcePublicationOrder.capture(rows)!;
 expect(order.prepare([{removed:[{...rows[0]!}],appended:[]}],new Set(),rows.length-1)).toBeUndefined();
 expect(order.publishedOrder()).toEqual(rows.map(r=>r.id));
 expect(ResourcePublicationOrder.capture([rows[0]!,rows[0]!])).toBeUndefined();
 const valid=ResourcePublicationOrder.capture(rows)!;
 expect(valid.prepare([{removed:[],appended:[rows[0]!]}],new Set(),rows.length+1)).toBeUndefined();
});
