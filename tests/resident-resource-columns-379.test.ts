import {expect,test,vi} from 'vitest';
import {ResidentResourceRowsEncoder379,ResidentResourceFrameOwner379,hasOwnedResidentResourceShape379,hasOwnedResidentResourceTransport379} from '../src/bridge/resident-resource-section-379';
import {ResidentAuxiliaryEncoder} from '../src/bridge/resident-auxiliary-sections';
import {ResidentVegetationAssembler} from '../src/bridge/resident-vegetation-assembler';
import {residentPublication,readResidentWorkerMessage,type ResidentAuxiliaryEnvelope} from '../src/bridge/resident-protocol';
import {SnapshotDecoder,SnapshotEncoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {WorkerNaturalAppearance} from '../src/bridge/worker-natural-appearance';
import {createResidentConstructionValidators379,validConstructionTransport379} from '../src/sim/construction-forbid-save-379';
import {createResidentOwnerLeafRun379,isOrdinaryResidentOwnerRecord379} from '../src/bridge/resident-owner-records-379';
import {readSnapshotChanges,readSnapshotResourceStructure} from '../src/bridge/snapshot-changes';
import {readResidentResourceBaseChanges} from '../src/bridge/resident-resource-base-journal';
import {adoptSiteClimate} from '../src/sim/site-climate';
import {createPlantLife,PLANT_LIFE_INTERVAL} from '../src/sim/plant-life';
import type {World,Resource} from '../src/sim/types';
import {fixture} from './resident-presentation-fixtures-v427';

function harness(world=fixture(),compact=true){
 const base=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true}),natural=new WorkerNaturalAppearance(),auxiliary=new ResidentAuxiliaryEncoder(true,compact),reader=new ResidentVegetationAssembler(),literal=new SnapshotDecoder();
 const capture=(checkpoint=false)=>{
  const packet=base.encode(world,0,1,checkpoint),oracle=structuredClone(packet),appearance=natural.capture(world,packet),wire=auxiliary.capture(packet);
  return {oracle,envelope:structuredClone(residentPublication(wire.publication,appearance,wire.auxiliary))};
 };
 const packet=(envelope:ResidentAuxiliaryEnvelope)=>{const p=readResidentWorkerMessage(envelope);if(p.type!=='snapshot')throw Error('Expected snapshot');return p;};
 const adopt=(value:ReturnType<typeof capture>)=>{
  const expected=literal.adopt(structuredClone(value.oracle)),actual=reader.adopt(packet(value.envelope));
  expect(actual.status,actual.status==='resync'?actual.reason:undefined).toBe('applied');expect(expected.status,expected.status==='resync'?expected.reason:undefined).toBe('applied');
  if(actual.status!=='applied'||expected.status!=='applied')throw Error('Representation refused');
  expect(actual.world).toStrictEqual(expected.world);expect(JSON.stringify(actual.world)).toBe(JSON.stringify(expected.world));return actual.world;
 };
 return {world,capture,packet,reader,adopt};
}

test('column construction preserves own undefined, -0, nested records and property order without freezing any source row',()=>{
 const rows=[{amount:-0,id:1,kind:'tree',x:2,z:3,species:undefined,growth:.25,plantLife:{since:0,age:0,darkTicks:0,nextCheck:2},blight:{since:0,severity:.25,lastHarmTick:0,nextCheck:2,rng:1}}] as Resource[];
 const packet={type:'snapshot',kind:'checkpoint',epoch:1,revision:1,stepMs:0,speed:0,world:{nextId:2,tick:0,resources:rows}} as unknown as SnapshotMessage<true>;
 const encoder=new ResidentResourceRowsEncoder379(),reader=new ResidentResourceFrameOwner379(),wire=encoder.capture(packet),copy=structuredClone(wire);
 expect((copy.packet.world as any).resources).toBe(0);const draft=reader.prepare(copy.packet,copy.resources)!;expect(draft).toBeDefined();
 const actual=draft.state.values;expect(actual).toStrictEqual(rows);expect(JSON.stringify(actual)).toBe(JSON.stringify(rows));expect(Object.is(actual[0]!.amount,-0)).toBe(true);expect(Object.hasOwn(actual[0]!,'species')).toBe(true);
 expect(Object.isFrozen(rows)).toBe(false);expect(Object.isFrozen(rows[0])).toBe(false);expect(Object.isFrozen(rows[0]!.plantLife)).toBe(false);
 expect(Object.isFrozen(actual)).toBe(true);expect(Object.isFrozen(actual[0])).toBe(true);expect(Object.isFrozen(actual[0]!.plantLife)).toBe(true);
 rows[0]!.plantLife!.age=10;rows[0]!.growth=.75;expect(actual[0]!.plantLife!.age).toBe(0);expect(actual[0]!.growth).toBe(.25);expect(hasOwnedResidentResourceShape379(actual,2)).toBe(true);
});

test('native checkpoint, mixed upserts/growth, membership, explicit order and reset match the full public oracle',()=>{
 const h=harness(),a=h.adopt(h.capture()),before=structuredClone(a);expect(hasOwnedResidentResourceShape379(a.resources,a.nextId)).toBe(true);
 h.world.resources[0]!.amount++;h.world.resources[1]!.growth=.451234567890123;h.world.resources[1]!.growthThermalFactor=-0;
 const mixed=h.capture();if(mixed.oracle.kind!=='delta')throw Error('Expected delta');expect(mixed.oracle.resources!.upserted).toHaveLength(1);expect(mixed.oracle.resources!.growth).toHaveLength(4);
 const b=h.adopt(mixed);expect(Object.is(b.resources[1]!.growthThermalFactor,-0)).toBe(true);expect(readSnapshotChanges(a,b)!.resourceIndices).toEqual([0,1]);expect(readResidentResourceBaseChanges(a,b)!.edges[0]!.updated).toEqual([{id:a.resources[0]!.id,afterOrdinal:0}]);
 h.world.resources.splice(0,1);h.world.resources.push({id:h.world.nextId++,kind:'berries',x:5,z:2,amount:10,growth:.2,growthTick:h.world.tick});h.world.tiles[5+2*h.world.width]={terrain:'soil'};
 const c=h.adopt(h.capture());expect(c.resources[0]).toBe(b.resources[1]);expect(readSnapshotResourceStructure(b,c)!.edges[0]!.removed).toEqual([{id:a.resources[0]!.id,beforeOrdinal:0}]);
 h.world.resources.reverse();const d=h.adopt(h.capture());expect(readResidentResourceBaseChanges(c,d)).toBeUndefined();
 const checkpoint=h.adopt(h.capture(true));expect(readResidentResourceBaseChanges(d,checkpoint)).toBeUndefined();expect(a).toStrictEqual(before);
});

test('life tuples reconstruct only the changed immutable row and keep the independent FULL and BASE journals',()=>{
 const world=fixture();adoptSiteClimate(world);for(const r of world.resources)r.plantLife=createPlantLife(world,r);const h=harness(world),a=h.adopt(h.capture());
 const r=world.resources.reduce((best,row)=>row.plantLife!.nextCheck<best.plantLife!.nextCheck?row:best),life=r.plantLife!;world.tick=life.nextCheck;
 if(world.corePathBudget297)world.corePathBudget297.tick=world.tick;if(world.deterioration)world.deterioration.lastTick=world.tick;
 const elapsed=world.tick-Math.max(life.since,life.nextCheck-PLANT_LIFE_INTERVAL);life.age+=elapsed;life.nextCheck+=PLANT_LIFE_INTERVAL;
 const next=h.capture();if(next.oracle.kind!=='delta')throw Error('Expected delta');expect(next.oracle.resources!.life).toHaveLength(4);
 const b=h.adopt(next),index=b.resources.findIndex(row=>row.id===r.id);expect(b.resources[index]).not.toBe(a.resources[index]);expect(b.resources[1-index]).toBe(a.resources[1-index]);
 expect(readResidentResourceBaseChanges(a,b)!.edges[0]!.updated).toEqual([]);expect(readSnapshotChanges(a,b)!.resourceIndices).toEqual([index]);expect(Object.isFrozen(b.resources[index]!.plantLife)).toBe(true);
});

test('owned negative resource collections eliminate row descriptor walks while mutable copies and inherited lanes stay strict',()=>{
 const h=harness(),a=h.adopt(h.capture()),memo=(_dependencies:ReadonlySet<PropertyKey>,keys:ReadonlySet<PropertyKey>)=>({begin(){},end(){},remember(){},read:(value:object)=>hasOwnedResidentResourceTransport379(value,keys)?0:undefined});
 const validators=createResidentConstructionValidators379(isOrdinaryResidentOwnerRecord379,createResidentOwnerLeafRun379,memo),targets=new Set<object>(a.resources);let reads=0;
 const native=Object.getOwnPropertyDescriptor,spy=vi.spyOn(Object,'getOwnPropertyDescriptor').mockImplementation((value,key)=>{if(targets.has(value))reads++;return native(value,key);});
 try{expect(validators.transport({resources:a.resources},379)).toBe(true);expect(reads).toBe(0);}finally{spy.mockRestore();}
 const mutable=structuredClone(a.resources);expect(hasOwnedResidentResourceTransport379(mutable,new Set(['resources','forbidden379']))).toBe(false);(mutable[0] as any).forbidden379=true;expect(validators.transport({resources:mutable},379)).toBe(validConstructionTransport379({resources:mutable},379));expect(validators.transport({resources:mutable},379)).toBe(false);
 Object.defineProperty(Object.prototype,'forbidden379',{value:true,configurable:true});try{expect(validators.transport({resources:a.resources},379)).toBe(false);}finally{delete (Object.prototype as any).forbidden379;}
 expect(validators.transport({resources:a.resources},379)).toBe(true);
});

test('malformed columns and late rejection preserve the exact immutable predecessor and allow an unchanged retry',()=>{
 const h=harness(),a=h.adopt(h.capture()),before=structuredClone(a);h.world.resources[0]!.amount++;h.world.resources[1]!.growth=.6;const good=h.capture();
 const bads:((envelope:any)=>void)[]=[
  e=>{e.auxiliary.resources.rows.layouts[0]=65535;},
  e=>{e.auxiliary.resources.rows.shapes[0].push('forbidden379');},
  e=>{e.auxiliary.resources.rows.numbers[0]=Infinity;},
  e=>{e.auxiliary.resources.rows=null;},
  e=>{e.publication.resources.growth[0]=999999;},
  e=>{e.publication.baseRevision++;},
 ];
 for(const corrupt of bads){const bad=structuredClone(good.envelope);corrupt(bad);expect(h.reader.adopt(h.packet(bad)).status).toBe('resync');expect(a).toStrictEqual(before);}
 let rejected:World|undefined;expect(h.reader.adopt(h.packet(structuredClone(good.envelope)),world=>{rejected=world;return false;}).status).toBe('resync');expect(rejected).toBeDefined();expect(readSnapshotChanges(a,rejected!)).toBeUndefined();
 const b=h.adopt(good);expect(b.resources[0]!.amount).toBe(a.resources[0]!.amount+1);expect(a).toStrictEqual(before);
});

test('default literal auxiliary decoding keeps mutable aliases, and unsupported source shapes choose the original wire',()=>{
 const h=harness(fixture(),false),a=h.adopt(h.capture());expect(Object.isFrozen(a.resources)).toBe(false);expect(Object.isFrozen(a.resources[0])).toBe(false);expect(hasOwnedResidentResourceShape379(a.resources,a.nextId)).toBe(false);
 a.resources[0]!.amount++;expect(a.resources[0]!.amount).toBe(h.world.resources[0]!.amount+1);
 const world=fixture();(world.resources[0] as any).unknownResourceField379=1;const packet=new SnapshotEncoder().encode(world,0,0),wire=new ResidentResourceRowsEncoder379().capture(packet);
 expect(wire.packet).toBe(packet);expect(wire.resources).toBeUndefined();expect(Object.isFrozen(world.resources[0])).toBe(false);
});

test('column layouts are detached by own descriptors before any immutable resource proof is produced',()=>{
 const world=fixture(),packet=new SnapshotEncoder().encode(world,0,0),wire=new ResidentResourceRowsEncoder379().capture(packet),reader=new ResidentResourceFrameOwner379();
 if(!wire.resources?.rows)throw Error('Expected columns');let reads=0;const rows=wire.resources.rows as any;
 const opaque=(value:object)=>new Proxy(value,{get(){reads++;throw Error('Wire get trap must not run');}});
 rows.shapes[0]=opaque(rows.shapes[0]);rows.strings=opaque(rows.strings);const section={...wire.resources,rows:opaque(rows)};
 const draft=reader.prepare(wire.packet,section);expect(draft).toBeDefined();expect(reads).toBe(0);expect(draft!.state.values).toStrictEqual(world.resources);
 const represented={...world,resources:draft!.state.values};expect(new ResidentResourceFrameOwner379().canCommit(represented,draft!)).toBe(false);expect(reader.canCommit(represented,draft!)).toBe(true);reader.clear();expect(reader.canCommit(represented,draft!)).toBe(false);
 const bad=structuredClone(new ResidentResourceRowsEncoder379().capture(packet));let getters=0;
 Object.defineProperty((bad.resources!.rows as any).shapes[0],'0',{enumerable:true,configurable:true,get(){getters++;return 'forbidden379';}});
 expect(reader.prepare(bad.packet,bad.resources)).toBeUndefined();expect(getters).toBe(0);
});

test('sparse existing-ID writes retain the exact private directory and preserve tuple absence before membership fallback',()=>{
 const world=fixture();world.resources[1]!.growthThermalFactor=.5;
 const source=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),wire=new ResidentResourceRowsEncoder379(),reader=new ResidentResourceFrameOwner379();
 const capture=()=>{const p=wire.capture(source.encode(world,0,1)),draft=reader.prepare(structuredClone(p.packet),structuredClone(p.resources));if(!draft)throw Error('Resource draft refused');reader.commit({...world,resources:draft.state.values},draft);return draft;};
 const a=capture(),old=structuredClone(a.state.values);world.resources[0]!.amount++;world.resources[1]!.growth=.55;delete world.resources[1]!.growthThermalFactor;
 const b=capture();expect(b.state.slots).toBe(a.state.slots);expect(b.indices).toEqual([0,1]);expect(b.edge!.updated.map(row=>row.id)).toEqual(world.resources.map(row=>row.id));expect(b.baseEdge!.updated.map(row=>row.id)).toEqual([world.resources[0]!.id]);
 expect(Object.hasOwn(b.state.values[1]!,'growthThermalFactor')).toBe(false);expect(a.state.values).toStrictEqual(old);
 const removed=world.resources.shift()!;world.resources.push({...removed,id:world.nextId++,x:5});const c=capture();expect(c.state.slots).not.toBe(b.state.slots);expect(c.indices).toBeUndefined();expect(c.state.values.map(row=>row.id)).toEqual(world.resources.map(row=>row.id));
 expect(c.edge!.removed).toEqual([{id:removed.id,beforeOrdinal:0}]);expect(c.edge!.added).toEqual([{id:world.resources.at(-1)!.id,afterOrdinal:1}]);
});
