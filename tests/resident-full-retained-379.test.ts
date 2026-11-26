import {expect,test} from 'vitest';
import {SnapshotEncoder,SnapshotDecoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {ResidentFullRetainedEncoder379,ResidentFullRetainedFrameOwner379,hasOwnedRetainedJobsShape379,invalidateFullRetained379} from '../src/bridge/resident-full-retained-379';
import {ResidentAuxiliaryEncoder} from '../src/bridge/resident-auxiliary-sections';
import {ResidentVegetationAssembler} from '../src/bridge/resident-vegetation-assembler';
import {residentPublication,readResidentWorkerMessage} from '../src/bridge/resident-protocol';
import {WorkerNaturalAppearance} from '../src/bridge/worker-natural-appearance';
import {createFullRetainedCanonicalExpander379} from '../scripts/expand-full-retained-379';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {applyCommand} from '../src/sim/index';
import type {Job,World} from '../src/sim/types';
import {fixture} from './resident-presentation-fixtures-v427';

function add(w:World,x:number):Job {const j:Job={id:w.nextId++,kind:'wall',x,z:3,material:'wood',construction:'blueprint',orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};w.jobs.push(j);return j;}
function harness(){
 const w=fixture(),sourceOwner={},base=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),encoder=new ResidentFullRetainedEncoder379(sourceOwner),reader=new ResidentFullRetainedFrameOwner379(),expand=createFullRetainedCanonicalExpander379();
 w.jobs=[];for(let i=0;i<5;i++)add(w,3+i);w.thermal={regions:[{cells:[0,1,2],temperature:0},{temperature:22,cells:[4,5]},{cells:[10],temperature:18.625}]};
 const capture=(checkpoint=false,owned=true)=>{
  const packet=base.encode(w,0,1,checkpoint),literal=structuredClone(packet),prepared=owned?withJournalTerrainReadScope(sourceOwner,()=>encoder.prepare(packet,w)):encoder.prepare(packet,w);
  encoder.commit(prepared);expect(packet).toStrictEqual(literal);return {literal,...structuredClone({publication:prepared.publication,delta:prepared.delta})};
 };
 const send=(checkpoint=false,owned=true)=>{
  const row=capture(checkpoint,owned),draft=reader.prepare(row.publication,row.delta);expect(draft).toBeDefined();if(!draft)throw Error('Retained Full draft refused');
  expect(draft.packet).toStrictEqual(row.literal);expect(Object.keys(draft.packet.world)).toEqual(Object.keys(row.literal.world));
  const expected={type:'resident-publication',version:3,publication:row.literal,natural:null,auxiliary:{}};
  expect(expand({type:'resident-publication',version:3,publication:row.publication,natural:null,auxiliary:{retained379:row.delta}})).toStrictEqual(expected);
  for(let i=0;i<w.jobs.length;i++){expect(Object.keys(draft.packet.world.jobs[i]!)).toEqual(Object.keys(w.jobs[i]!));expect(Object.keys(draft.packet.world.jobs[i]!.escrow)).toEqual(Object.keys(w.jobs[i]!.escrow));}
  reader.commit(draft.packet.world as World,draft);return {row,world:draft.packet.world as World};
 };
 return {w,sourceOwner,base,encoder,reader,capture,send};
}

test('ordinary jobs are exact ordered upserts and retain unchanged identities; temperatures retain the actual immutable cell geometry',()=>{
 const h=harness(),a=h.send(true),unchanged=h.send(),w=h.w;
 expect(a.row.delta.jobs).toMatchObject({mode:'rows',reset:true,count:5});expect(unchanged.row.delta.jobs).toMatchObject({mode:'rows',reset:false,count:5,upserted:[],removed:[]});
 expect(unchanged.world.jobs).toBe(a.world.jobs);expect(unchanged.world.thermal).toBe(a.world.thermal);expect(hasOwnedRetainedJobsShape379(a.world.jobs,w.nextId)).toBe(true);
 w.jobs[1]!.progress=-0;w.jobs[1]!.workRemainder=undefined;w.jobs[2]!.escrow={food:2,wood:4};w.thermal!.regions[0]!.temperature=-0;w.thermal!.regions[2]!.temperature=19.125;
 const b=h.send(),t=b.row.delta.thermal;if(t.mode!=='regions'||t.reset)throw Error('Missing temperature columns');
 expect(Array.from(t.temperatures)).toEqual([0,-0,2,19.125]);expect(Object.is(b.world.thermal!.regions[0]!.temperature,-0)).toBe(true);
 expect(b.row.delta.jobs).toMatchObject({mode:'rows',upserted:[w.jobs[1],w.jobs[2]]});expect(b.world.jobs[0]).toBe(a.world.jobs[0]);expect(b.world.thermal!.regions[1]).toBe(a.world.thermal!.regions[1]);expect(b.world.thermal!.regions[0]!.cells).toBe(a.world.thermal!.regions[0]!.cells);
 const gone=w.jobs[0]!.id;w.jobs.shift();const created=add(w,9);w.jobs.reverse();const c=h.send();expect(c.row.delta.jobs).toMatchObject({mode:'rows',removed:[gone],upserted:[created],order:w.jobs.map(j=>j.id)});
 expect(c.world.jobs[0]!.id).toBe(created.id);expect(a.world.jobs).toHaveLength(5);expect(a.world.thermal!.regions[0]!.temperature).toBe(0);
 w.thermal={regions:[{cells:[3,8],temperature:21}]};const reset=h.send();expect(reset.row.delta.thermal).toMatchObject({mode:'regions',reset:true,count:1});expect(reset.world.thermal).toStrictEqual(w.thermal);
});

test('unknown nested Job shape, shared escrow, source mismatch and public capture keep literal graphs',()=>{
 const h=harness(),a=h.send(true),w=h.w;
 w.jobs[0]!.clearance={resourceId:1,progress:0};let b=h.send();expect(b.row.delta.jobs).toEqual({mode:'literal'});expect(b.row.publication.world.jobs).toStrictEqual(w.jobs);expect(hasOwnedRetainedJobsShape379(b.world.jobs,w.nextId)).toBe(false);
 delete w.jobs[0]!.clearance;const escrow=w.jobs[1]!.escrow;w.jobs[0]!.escrow=escrow;b=h.send();expect(b.row.delta.jobs).toEqual({mode:'literal'});expect(b.world.jobs[0]!.escrow).toBe(b.world.jobs[1]!.escrow);
 w.jobs[0]!.escrow=w.stock;b=h.send();expect(b.row.delta.jobs).toEqual({mode:'literal'});expect(b.world.jobs[0]!.escrow).toBe(b.world.stock);
 w.jobs[0]!.escrow={wood:0,food:0};const resumed=h.send();expect(resumed.row.delta.jobs).toMatchObject({mode:'rows',reset:true,count:5});
 w.thermal!.regions[0]!.cells[0]=0;const publicCapture=h.send(false,false);expect(publicCapture.row.delta.jobs).toEqual({mode:'literal'});expect(publicCapture.row.delta.thermal).toEqual({mode:'literal'});
 const next=h.send();expect(next.row.delta.jobs).toMatchObject({mode:'rows',reset:true});expect(next.row.delta.thermal).toMatchObject({mode:'regions',reset:true});expect(a.world.jobs[0]).not.toBe(next.world.jobs[0]);
});

test('unmarked thermal mutation is detected by exhaustive verification and invalidation re-enrolls on the exact same packet',()=>{
 const h=harness();h.send(true);const cells=h.w.thermal!.regions[0]!.cells;cells[1]=1.5;
 const packet=h.base.encode(h.w,0,1);setResourceJournalVerification(true);
 try{
  expect(()=>withJournalTerrainReadScope(h.sourceOwner,()=>h.encoder.prepare(packet,h.w))).toThrow('Unmarked thermal geometry');
  cells[1]=1;cells[2]=3;invalidateFullRetained379();
  const draft=withJournalTerrainReadScope(h.sourceOwner,()=>h.encoder.prepare(packet,h.w));expect(draft.delta.thermal).toMatchObject({mode:'regions',reset:true});h.encoder.commit(draft);
  const prepared=h.reader.prepare(draft.publication,draft.delta);expect(prepared).toBeDefined();expect(prepared!.packet.world.thermal).toStrictEqual(h.w.thermal);
 }finally{setResourceJournalVerification(false);}
});

test('malformed edges, duplicate jobs/temperature slots and accessors cannot advance retained state; late refusal retries',()=>{
 const h=harness(),a=h.send(true);h.w.jobs[2]!.progress=1;h.w.thermal!.regions[1]!.temperature=23;
 const good=h.capture(),copy=()=>structuredClone(good);
 const bads:((x:ReturnType<typeof copy>)=>void)[]=[
  p=>Object.assign(p.delta,{baseRevision:-1}),p=>Object.assign(p.delta.jobs,{count:1}),
  p=>Object.assign(p.delta.jobs,{removed:[a.world.jobs[0]!.id,a.world.jobs[0]!.id]}),
  p=>Object.assign(p.delta.jobs,{order:[a.world.jobs[0]!.id]}),
  p=>Object.assign(p.delta.thermal,{temperatures:new Float64Array([1,23,1,24])}),
  p=>Object.assign(p.delta.thermal,{temperatures:new Float64Array([3,23])}),p=>Object.assign(p.publication.world,{jobs:[]}),
 ];
 for(const corrupt of bads){const bad=copy();corrupt(bad);expect(h.reader.prepare(bad.publication,bad.delta)).toBeUndefined();}
 let reads=0;const getter=copy();if(getter.delta.jobs.mode!=='rows')throw Error('Expected jobs');Object.defineProperty(getter.delta.jobs.upserted[0]!,'progress',{enumerable:true,get(){reads++;return 1;}});
 expect(h.reader.prepare(getter.publication,getter.delta)).toBeUndefined();expect(reads).toBe(0);
 const first=h.reader.prepare(good.publication,good.delta)!;expect(first).toBeDefined();expect(h.reader.canCommit({...first.packet.world,jobs:structuredClone(first.packet.world.jobs)} as World,first)).toBe(false);
 const retry=h.reader.prepare(good.publication,good.delta)!;expect(retry.packet).toStrictEqual(good.literal);h.reader.commit(retry.packet.world as World,retry);expect(h.reader.canCommit(first.packet.world as World,first)).toBe(false);
});

test('fixed auxiliary bridge restores complete jobs/thermal before base and late acceptance; legacy stays literal',()=>{
 const w=fixture();w.jobs=[];for(const x of [5,6]){w.tiles[7*w.width+x]={terrain:'soil'};expect(applyCommand(w,{type:'designate',kind:'wall',material:'wood',x,z:7}).ok).toBe(true);}w.thermal={regions:[{cells:[0,1],temperature:18.5}]};
 const owner={},base=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),aux=new ResidentAuxiliaryEncoder(false,false,false,owner),natural=new WorkerNaturalAppearance(),reader=new ResidentVegetationAssembler(),strict=new SnapshotDecoder();
 const capture=(checkpoint=false)=>{const packet=base.encode(w,0,1,checkpoint),literal=structuredClone(packet),appearance=natural.capture(w,packet),encoded=withJournalTerrainReadScope(owner,()=>aux.capture(packet,w));return {literal,wire:structuredClone(residentPublication(encoded.publication,appearance,encoded.auxiliary))};};
 const unwrap=(raw:ReturnType<typeof capture>['wire']):SnapshotMessage<true>=>{const packet=readResidentWorkerMessage(raw);if(packet.type!=='snapshot')throw Error('Missing snapshot');return packet;};
 const a=capture(true);expect(a.wire.auxiliary.retained379?.jobs).toMatchObject({mode:'rows',reset:true});const result=reader.adopt(unwrap(a.wire)),expected=strict.adopt(a.literal);expect(result.status).toBe('applied');expect(expected.status).toBe('applied');
 if(result.status!=='applied'||expected.status!=='applied')throw Error('Checkpoint');expect(result.world).toStrictEqual(expected.world);
 const b=capture(),packet=unwrap(b.wire);
 expect(reader.adopt(packet,world=>{world.jobs=structuredClone(world.jobs);return true;}).status).toBe('resync');const after=reader.adopt(packet);expect(after.status).toBe('applied');if(after.status!=='applied')throw Error('Retry');expect(after.world.jobs).toBe(result.world.jobs);
 expect(after.world.thermal).toBe(result.world.thermal);
 const plain=new ResidentAuxiliaryEncoder().capture(base.encode(w,0,1,true));expect(plain.auxiliary.retained379).toBeUndefined();expect(plain.publication.world.jobs).toBe(w.jobs);
});
