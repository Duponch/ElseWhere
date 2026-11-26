import {expect,test,vi} from 'vitest';
import {ResidentStructuresFrameOwner379,createResidentStructureTransport379,hasOwnedResidentStructureShape379} from '../src/bridge/resident-structures-section-379';
import {createResidentConstructionValidators379,validConstructionTransport379} from '../src/sim/construction-forbid-save-379';
import {createPersonalOrdersTransportValidators378,validPersonalOrdersTransport378} from '../src/bridge/personal-orders-transport-378';
import {residentOwnerArray379,residentOwnerRecord379,isOrdinaryResidentOwnerRecord379,createResidentOwnerLeafRun379} from '../src/bridge/resident-owner-records-379';
import {ResidentAuxiliaryEncoder} from '../src/bridge/resident-auxiliary-sections';
import {ResidentVegetationAssembler} from '../src/bridge/resident-vegetation-assembler';
import {SnapshotEncoder,SnapshotDecoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {WorkerNaturalAppearance} from '../src/bridge/worker-natural-appearance';
import {residentPublication,readResidentWorkerMessage,type ResidentAuxiliaryEnvelope} from '../src/bridge/resident-protocol';
import {readSnapshotChanges,readSnapshotStructureChanges} from '../src/bridge/snapshot-changes';
import {fixture} from './resident-presentation-fixtures-v427';
import type {Structure,World} from '../src/sim/types';

const wall=(id:number):Structure=>({id,kind:'wall',x:id,z:1,orientation:0,footprint:'standard',material:'wood'});
function known<T extends object>(rows:readonly T[]):T[]{const values=residentOwnerArray379<T>();for(const row of rows)values.push(residentOwnerRecord379(row,{}));return values;}
function validators(){
 const factory=(_dependencies:ReadonlySet<PropertyKey>,keys:ReadonlySet<PropertyKey>)=>{
  const projection=createResidentStructureTransport379(keys);return {begin(){},end(){},remember(){},array:projection.array,read:(value:object)=>projection.read(value)?0:undefined};
 };
 return {construction:createResidentConstructionValidators379(isOrdinaryResidentOwnerRecord379,createResidentOwnerLeafRun379,factory),personal:createPersonalOrdersTransportValidators378(isOrdinaryResidentOwnerRecord379,factory)};
}
function checkpoint(rows:Structure[]):SnapshotMessage<true>{return {type:'snapshot',kind:'checkpoint',epoch:1,revision:1,stepMs:0,speed:0,world:{schemaVersion:379,tick:0,nextId:100,structures:rows}} as unknown as SnapshotMessage<true>;}
const section=(p:SnapshotMessage<true>)=>({epoch:p.epoch,revision:p.revision,checkpoint:p.kind==='checkpoint',...p.kind==='delta'?{baseRevision:p.baseRevision}:{}});
function prepare(reader:ResidentStructuresFrameOwner379,p:SnapshotMessage<true>){const draft=reader.prepare(p,section(p));if(!draft?.state)throw Error('Expected owned structure construction');return draft;}

test('only new negative ordinary rows are immutable; positive owners retain mutable roots and strict traversal',()=>{
 const v=validators(),reader=new ResidentStructuresFrameOwner379(),raw=known([wall(1),{...wall(2),casket:{humans:[],animals:[],items:[]}} as unknown as Structure,wall(3)]),p=checkpoint(raw),draft=prepare(reader,p),rows=draft.state!.values;
 expect(rows).not.toBe(raw);expect(rows).toStrictEqual(raw);expect(Object.isFrozen(rows)).toBe(true);expect(Object.isFrozen(rows[0])).toBe(true);expect(Object.isFrozen(rows[1])).toBe(false);
 expect(hasOwnedResidentStructureShape379(rows,100)).toBe(true);expect(v.construction.transport({structures:rows},379)).toBe(validConstructionTransport379({structures:rows},379));expect(v.personal.transport({structures:rows},379)).toBe(validPersonalOrdersTransport378({structures:rows},379));
 (rows[1] as any).forbidden379=true;expect(v.construction.transport({structures:rows},379)).toBe(false);delete (rows[1] as any).forbidden379;
 (rows[1] as any).identity378={revision:1,title:''};expect(v.personal.transport({structures:rows},379)).toBe(false);delete (rows[1] as any).identity378;
 expect(new ResidentStructuresFrameOwner379().canCommit({structures:rows} as World,draft)).toBe(false);expect(reader.canCommit({structures:rows} as World,draft)).toBe(true);reader.clear();expect(reader.canCommit({structures:rows} as World,draft)).toBe(false);
});

test('mixed native membership projects negative spans without rereading their descriptors, and observes prototype changes between spans',()=>{
 const v=validators(),reader=new ResidentStructuresFrameOwner379(),raw=known([wall(1),{...wall(2),casket:{}} as unknown as Structure,wall(3)]),draft=prepare(reader,checkpoint(raw)),rows=draft.state!.values;
 const negatives=new Set<object>([rows[0]!,rows[2]!]),read=Object.getOwnPropertyDescriptor;let descriptors=0;
 const spy=vi.spyOn(Object,'getOwnPropertyDescriptor').mockImplementation((value,key)=>{if(negatives.has(value))descriptors++;return read(value,key);});
 try{expect(v.construction.transport({structures:rows},379)).toBe(true);expect(v.personal.transport({structures:rows},379)).toBe(true);expect(descriptors).toBe(0);}finally{spy.mockRestore();}
 (rows[1] as any).casket=new Proxy({}, {getOwnPropertyDescriptor(target,key){if(key==='destinations')Object.defineProperty(Object.prototype,'forbidden379',{value:true,configurable:true});return Reflect.getOwnPropertyDescriptor(target,key);}});
 try{expect(v.construction.transport({structures:rows},379)).toBe(false);}finally{delete (Object.prototype as any).forbidden379;}
 (rows[1] as any).casket={};expect(v.construction.transport({structures:rows},379)).toBe(true);
});

test('positive mutable IDs, sparse member arrays, getters and historical markers retain their exact fences',()=>{
 const v=validators(),reader=new ResidentStructuresFrameOwner379(),p=checkpoint(known([{...wall(1),casket:{}} as unknown as Structure,wall(2)])),a=prepare(reader,p);reader.commit({structures:a.state!.values} as World,a);
 a.state!.values[0]!.id=20;expect(hasOwnedResidentStructureShape379(a.state!.values,100)).toBe(false);
 const delta={...p,kind:'delta',revision:2,baseRevision:1,world:{schemaVersion:379,tick:0,nextId:100},structures:residentOwnerRecord379({removed:[],upserted:known<Structure>([])},{})} as unknown as SnapshotMessage<true>;
 expect(reader.prepare(delta,section(delta))).toBeUndefined();a.state!.values[0]!.id=1;
 const frozen=prepare(new ResidentStructuresFrameOwner379(),checkpoint(known([{...wall(4),kind:'electric-tailor-bench',material:'steel',tailorSteel379:true}]))).state!.values;
 expect(Object.isFrozen(frozen[0])).toBe(false);expect(v.construction.transport({structures:frozen},379)).toBe(true);expect(v.construction.transport({structures:frozen},378)).toBe(false);
 const sparse=known([wall(5),wall(6)]);delete sparse[0];expect(new ResidentStructuresFrameOwner379().prepare(checkpoint(sparse),section(p))).toBeUndefined();
 const accessor=known([wall(7)]);let reads=0;Object.defineProperty(accessor[0],'extra',{enumerable:true,get(){reads++;return true;}});expect(new ResidentStructuresFrameOwner379().prepare(checkpoint(accessor),section(p))).toBeUndefined();expect(reads).toBe(0);
});

test('unknown/public records, Proxy wrappers and frozen envelopes keep the original literal path without freezing old rows',()=>{
 validators();const reader=new ResidentStructuresFrameOwner379(),row=wall(1),rows=[row],p=checkpoint(rows),draft=reader.prepare(p,Object.freeze(section(p)))!;
 expect(draft.state).toBeUndefined();expect(draft.packet).toBe(p);expect(Object.isFrozen(row)).toBe(false);expect(Object.isFrozen(rows)).toBe(false);
 const wrapped=new Proxy(known([wall(2)]),{}),q=checkpoint(wrapped),second=reader.prepare(q,section(q))!;expect(second.state).toBeUndefined();expect(Object.isFrozen(wrapped[0])).toBe(false);
});

test('native malformed headers, overlapping writes and unknown explicit order do not advance the private predecessor',()=>{
 validators();const owner=new ResidentStructuresFrameOwner379(),p=checkpoint(known([wall(1),wall(2)])),a=prepare(owner,p);owner.commit({structures:a.state!.values} as World,a);
 const make=(patch:object)=>({type:'snapshot',kind:'delta',epoch:1,revision:2,baseRevision:1,stepMs:0,speed:0,world:{schemaVersion:379,tick:0,nextId:100},structures:residentOwnerRecord379(patch,{})}) as unknown as SnapshotMessage<true>;
 const overlap=make({removed:[1],upserted:known([wall(1)])});expect(owner.prepare(overlap,section(overlap))).toBeUndefined();
 const order=make({removed:[],upserted:known<Structure>([]),order:[1,99]});expect(owner.prepare(order,section(order))).toBeUndefined();
 const good=make({removed:[],upserted:known([{...wall(2),damage:1}])});expect(owner.prepare(good,{...section(good),future:undefined})).toBeUndefined();
 let reads=0;const header=section(good);Object.defineProperty(header,'revision',{enumerable:true,get(){reads++;return 2;}});expect(owner.prepare(good,header)).toBeUndefined();expect(reads).toBe(0);
 const accepted=prepare(owner,good);expect(accepted.state!.values[0]).toBe(a.state!.values[0]);expect(accepted.state!.values[1]!.damage).toBe(1);owner.commit({structures:accepted.state!.values} as World,accepted);
});

test('a positive ancestor remains active even when an unknown child removes the lane before revisiting its array',()=>{
 const v=validators(),root:Record<string,any>=residentOwnerRecord379({...wall(1),casket:null},{}),source=residentOwnerArray379<Structure>();source.push(root as unknown as Structure, residentOwnerRecord379(wall(2),{}));
 root.casket=new Proxy({structures:source},{getOwnPropertyDescriptor(target,key){if(key==='forbidden379')delete root.casket;return Reflect.getOwnPropertyDescriptor(target,key);}});
 const owner=new ResidentStructuresFrameOwner379(),draft=prepare(owner,checkpoint(source));expect(v.construction.transport({structures:draft.state!.values},379)).toBe(false);expect(Object.hasOwn(root,'casket')).toBe(false);
});

test('actual checkpoint, sparse changes, removal/order and late rejection match the literal World and publish only accepted indices',()=>{
 validators();const world=fixture();world.structures=[{...wall(world.nextId++),x:7,z:7},{...wall(world.nextId++),x:8,z:7}];world.tiles[7+7*world.width]={terrain:'soil'};world.tiles[8+7*world.width]={terrain:'soil'};
 const base=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),aux=new ResidentAuxiliaryEncoder(true,true,true),natural=new WorkerNaturalAppearance(),reader=new ResidentVegetationAssembler(),literal=new SnapshotDecoder();
 const capture=(reset=false)=>{const p=base.encode(world,0,1,reset),oracle=structuredClone(p),n=natural.capture(world,p),r=aux.capture(p);return {oracle,envelope:structuredClone(residentPublication(r.publication,n,r.auxiliary))};};
 const unwrap=(envelope:ResidentAuxiliaryEnvelope)=>{const p=readResidentWorkerMessage(envelope);if(p.type!=='snapshot')throw Error('Expected snapshot');if(Object.hasOwn(p.world,'structures'))(p.world as any).structures=known((p.world as any).structures);if(p.kind==='delta'&&p.structures)(p as any).structures=residentOwnerRecord379(p.structures,{upserted:known(p.structures.upserted)});return p;};
 const adopt=(value:ReturnType<typeof capture>)=>{const expected=literal.adopt(structuredClone(value.oracle)),actual=reader.adopt(unwrap(value.envelope));expect(actual.status,actual.status==='resync'?actual.reason:undefined).toBe('applied');expect(expected.status).toBe('applied');if(actual.status!=='applied'||expected.status!=='applied')throw Error('Refused');expect(actual.world).toStrictEqual(expected.world);expect(JSON.stringify(actual.world)).toBe(JSON.stringify(expected.world));return actual.world;};
 const a=adopt(capture()),before=structuredClone(a);expect(Object.isFrozen(a.structures[0])).toBe(true);world.structures[0]!.damage=1;const next=capture();
 let rejected:World|undefined;expect(reader.adopt(unwrap(structuredClone(next.envelope)),w=>{rejected=w;return false;}).status).toBe('resync');expect(readSnapshotChanges(a,rejected!)).toBeUndefined();
 const b=adopt(next);expect(b.structures[1]).toBe(a.structures[1]);expect(readSnapshotStructureChanges(a,b)!.structureIndices).toEqual([0]);world.structures.splice(0,1);world.structures.push({...wall(world.nextId++),x:9,z:7});world.tiles[9+7*world.width]={terrain:'soil'};world.structures.reverse();const c=adopt(capture());
 expect(c.structures.map(row=>row.id)).toEqual(world.structures.map(row=>row.id));adopt(capture(true));expect(a).toStrictEqual(before);
});
