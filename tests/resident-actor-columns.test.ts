import {expect,test} from 'vitest';
import {ResidentActorsEncoder,ResidentActorsFrameOwner,isOwnedResidentActorListInternal,hasOwnedResidentActorShapeInternal} from '../src/bridge/resident-actors-section';
import {ResidentAuxiliaryEncoder} from '../src/bridge/resident-auxiliary-sections';
import {ResidentVegetationAssembler} from '../src/bridge/resident-vegetation-assembler';
import {residentPublication,readResidentWorkerMessage,type ResidentAuxiliaryEnvelope} from '../src/bridge/resident-protocol';
import {WorkerNaturalAppearance} from '../src/bridge/worker-natural-appearance';
import {SnapshotDecoder,SnapshotEncoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {fixture} from './resident-presentation-fixtures-v427';
import type {World} from '../src/sim/types';

type Row=Record<string,any>;
function harness(){
 const human=[{id:1,hunger:1,rest:-0,path:[{x:1,z:2},{x:2,z:2},{x:3,z:2}],skills:{mining:{level:2,xp:0}},optional:undefined},
  {id:2,hunger:2,rest:0,path:[],skills:{mining:{level:3,xp:12}}}] as Row[];
 const animal=[{id:3,age:500,food:.5,details:{flag:true},path:[]}] as Row[];
 const encoder=new ResidentActorsEncoder(),reader=new ResidentActorsFrameOwner();let revision=0;
 const capture=(checkpoint=false)=>{
  revision++;const packet={type:'snapshot',kind:checkpoint||revision===1?'checkpoint':'delta',epoch:1,revision,baseRevision:revision-1,speed:0,stepMs:0,world:{nextId:100,tick:0,pawns:human,wildlife:{animals:animal}}} as unknown as SnapshotMessage<true>;
  const oracle=structuredClone(packet.world),draft=encoder.prepare(packet);encoder.commit(draft);return{oracle,wire:structuredClone(draft.packet),columns:structuredClone(draft.actors)};
 };
 const adopt=(row:ReturnType<typeof capture>)=>{const draft=reader.prepare(row.wire,row.columns);if(!draft)throw Error('Actor representation refused');const represented=draft.packet.world as World;reader.commit(represented,draft);expect(represented).toStrictEqual(row.oracle);return represented;};
 return {human,animal,capture,adopt,reader};
}

test('numeric columns, literal changed subtrees, retained suffixes, -0 and own undefined reconstruct exactly',()=>{
 const h=harness(),first=h.adopt(h.capture()),firstHash=structuredClone(first),oldPath=first.pawns[0]!.path;
 h.human[0]!.hunger=.125;h.human[0]!.rest=0;h.human[0]!.path.shift();h.human[0]!.skills.mining.xp=3;h.animal[0]!.age++;
 const second=h.capture();expect(second.wire.world.pawns).toBe(0);const changed=second.columns.pawns;
 expect(changed.mode).toBe('rows');if(changed.mode!=='rows')throw Error('No columns');expect(changed.full).toHaveLength(0);expect(changed.numbers).toHaveLength(6);expect(changed.tails).toHaveLength(3);
 const view=h.adopt(second);expect(Object.is(view.pawns[0]!.rest,0)).toBe(true);expect(Object.hasOwn(view.pawns[0]!,'optional')).toBe(true);
 expect(view.pawns[0]!.path[0]).toBe(oldPath[1]);expect(view.pawns[1]).toBe(first.pawns[1]);expect(first).toStrictEqual(firstHash);
 expect(isOwnedResidentActorListInternal(view.pawns)).toBe(true);expect(isOwnedResidentActorListInternal(Object.freeze([...view.pawns]))).toBe(false);
 expect(hasOwnedResidentActorShapeInternal(view.pawns,3)).toBe(true);expect(hasOwnedResidentActorShapeInternal(view.pawns,2)).toBe(false);
 expect(Object.isFrozen(view.pawns[0]!.skills)).toBe(true);expect(Object.isFrozen(h.human[0]!.skills)).toBe(false);
 const same=h.adopt(h.capture());expect(same.pawns[0]).toBe(view.pawns[0]);
});

test('shape change, key order, membership and reorder are explicit full rows; checkpoint resets',()=>{
 const h=harness(),first=h.adopt(h.capture());delete h.human[0]!.optional;h.human[0]!.optional=undefined;
 h.human[0]!.newField='new';h.human.reverse();h.animal.splice(0,1,{id:4,age:1,path:[]});
 const c=h.capture();if(c.columns.pawns.mode!=='rows'||c.columns.animals.mode!=='rows')throw Error('Missing columns');
 expect(c.columns.pawns.order).toEqual([2,1]);expect(c.columns.pawns.full.map(r=>r.id)).toEqual([1]);expect(c.columns.animals.removed).toEqual([3]);
 const next=h.adopt(c);expect(next.pawns[0]).toBe(first.pawns[1]);expect(Object.keys(next.pawns[1]!)).toEqual(Object.keys(h.human[1]!));
 const checkpoint=h.capture(true);expect(checkpoint.columns.pawns.mode==='rows'&&checkpoint.columns.pawns.reset).toBe(true);expect(h.adopt(checkpoint).pawns).toStrictEqual(next.pawns);
});

test('malformed columns, duplicate/unknown fields, bad markers, accessors and depth refuse without advancing',()=>{
 const h=harness(),first=h.adopt(h.capture());h.human[0]!.hunger=.25;h.human[0]!.skills.mining.level=4;const good=h.capture();
 const corruptions:((row:any)=>void)[]=[
  r=>{r.columns.pawns.numbers=new Float64Array([1,1,NaN]);},
  r=>{r.columns.pawns.numbers=new Float64Array([1,0,7]);},
  r=>{r.columns.pawns.numbers=new Float64Array([1,1,.4,1,1,.5]);},
  r=>{r.columns.pawns.numbers=new Float64Array([99,1,.4]);},
  r=>{r.columns.pawns.tails=new Float64Array([1,3,99]);},
  r=>{r.columns.pawns.order=[1,1];},
  r=>{r.columns.pawns.count=1;},
  r=>{r.wire.world.pawns=[];},
  r=>{const obj:Row={};let child=obj;for(let i=0;i<25;i++){child.n={};child=child.n;}r.columns.pawns.values[0][2]=obj;},
 ];
 for(const corrupt of corruptions){const row=structuredClone(good);corrupt(row);expect(h.reader.prepare(row.wire,row.columns)).toBeUndefined();}
 const get=structuredClone(good) as any;let reads=0;Object.defineProperty(get.columns.pawns.values[0][2],'bad',{enumerable:true,get(){reads++;return true;}});
 expect(h.reader.prepare(get.wire,get.columns)).toBeUndefined();expect(reads).toBe(0);expect(first.pawns[0]!.hunger).toBe(1);expect(h.adopt(good).pawns[0]!.hunger).toBe(.25);
});

test('actual resident v3 admission keeps full public oracle and commits actors with auxiliary, natural and strict World',()=>{
 const world=fixture(),base=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),natural=new WorkerNaturalAppearance(),auxiliary=new ResidentAuxiliaryEncoder(true),reader=new ResidentVegetationAssembler(),strict=new SnapshotDecoder();
 const capture=()=>{const packet=base.encode(world,0,0),oracle=structuredClone(packet),appearance=natural.capture(world,packet),wire=auxiliary.capture(packet);return {oracle,envelope:structuredClone(residentPublication(wire.publication,appearance,wire.auxiliary))};};
 const unwrap=(envelope:ResidentAuxiliaryEnvelope)=>{const packet=readResidentWorkerMessage(envelope);if(packet.type!=='snapshot')throw Error('Expected full');return packet;};
 const send=(value:ReturnType<typeof capture>)=>{const a=reader.adopt(unwrap(value.envelope)),b=strict.adopt(value.oracle);expect(a.status,a.status==='resync'?a.reason:undefined).toBe('applied');expect(b.status).toBe('applied');if(a.status!=='applied'||b.status!=='applied')throw Error('Refused');expect(a.world).toStrictEqual(b.world);return a.world;};
 const first=send(capture()),before=structuredClone(first);world.pawns[0]!.hunger*=.9;
 const second=capture();expect(reader.adopt(unwrap(structuredClone(second.envelope)),()=>false).status).toBe('resync');
 const adopted=send(second);expect(adopted.pawns[0]!.hunger).toBe(world.pawns[0]!.hunger);expect(first).toStrictEqual(before);expect(isOwnedResidentActorListInternal(adopted.pawns)).toBe(true);
});
