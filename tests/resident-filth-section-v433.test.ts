import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {fixture} from './resident-presentation-fixtures-v427';
import {addFilth,advanceFilth,removeFilth} from '../src/sim/filth';
import type {World} from '../src/sim/types';
import {newCorePathBudget297} from '../src/sim/core-path-budget-297';
import {ResidentFilthEncoder,ResidentFilthFrameOwner,readResidentFilthFrame,type ResidentFilthDelta,type ResidentFilthPublication} from '../src/bridge/resident-filth-section';

type Wire={publication:ResidentFilthPublication;filth:ResidentFilthDelta};
function harness(){
 const world=fixture(),encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),transport=new ResidentFilthEncoder(),owner=new ResidentFilthFrameOwner(),base=new SnapshotDecoder(),oracle=new SnapshotDecoder();
 for(const [x,z]of [[2,3],[3,3],[4,3]]){world.tiles[z!*world.width+x!]={terrain:'soil'};expect(addFilth(world,{x:x!,z:z!},'blood')).toBe(true);}
 const capture=(checkpoint=false)=>{
  const packet=encoder.encode(world,0,1,checkpoint),literal=structuredClone(packet),wire=structuredClone(transport.capture(packet));
  expect(packet).toStrictEqual(literal);expect(packet.world.filth).toBe(world.filth);
  if(world.filth!==undefined){
   expect(Object.isFrozen(world.filth)).toBe(false);expect(Object.isFrozen(world.filth.items)).toBe(false);
   for(const row of world.filth.items)expect(Object.isFrozen(row)).toBe(false);
  }
  return {literal,wire};
 };
 const prepare=(wire:Wire)=>owner.prepare(wire.publication as unknown as SnapshotMessage<true>,wire.filth);
 const deliver=(row:ReturnType<typeof capture>,extra?:(world:World)=>boolean)=>{
  const draft=prepare(row.wire);expect(draft&&draft!=='stale').toBe(true);if(!draft||draft==='stale')throw Error('Expected filth draft');
  expect(draft.packet).toStrictEqual(row.literal);expect(Object.keys(draft.packet.world)).toEqual(Object.keys(row.literal.world));
  if(draft.packet.world.filth){expect(Object.keys(draft.packet.world.filth)).toEqual(Object.keys(row.literal.world.filth!));for(let i=0;i<draft.packet.world.filth.items.length;i++)expect(Object.keys(draft.packet.world.filth.items[i]!)).toEqual(Object.keys(row.literal.world.filth!.items[i]!));}
  const result=base.adopt(draft.packet,world=>(!extra||extra(world))&&owner.canCommit(world,draft));if(result.status==='applied')owner.commit(result.world,draft);return {draft,result};
 };
 const send=(checkpoint=false)=>{
  const row=capture(checkpoint),{result}=deliver(row),reference=oracle.adopt(row.literal);
  expect(result.status,result.status==='resync'?result.reason:undefined).toBe('applied');expect(reference.status,reference.status==='resync'?reference.reason:undefined).toBe('applied');
  if(result.status!=='applied'||reference.status!=='applied')throw Error('Expected admitted pair');expect(result.world).toStrictEqual(reference.world);return {...row,world:result.world};
 };
 return {world,encoder,transport,owner,base,oracle,capture,prepare,deliver,send};
}

test('unchanged and header-only publications retain every ordered item and leave public mutable snapshots literal',()=>{
 const h=harness(),a=h.send(),before=structuredClone(a.world),frame=readResidentFilthFrame(a.world)!;
 const b=h.send();expect(b.wire.publication.world.filth).toBe(0);expect(b.world.filth).toBe(a.world.filth);expect(readResidentFilthFrame(b.world)!.rootToken).toBe(frame.rootToken);
 h.world.filth!.rng^=1;h.world.filth!.cleaned++;const c=h.send();
 expect(c.wire.filth.section).toMatchObject({mode:'items',reset:false,removed:[],upserted:[]});expect(c.world.filth!.items).toBe(a.world.filth!.items);
 expect(c.world.filth).not.toBe(a.world.filth);expect(readResidentFilthFrame(c.world)!.itemsToken).toBe(frame.itemsToken);expect(readResidentFilthFrame(c.world)!.rootToken).not.toBe(frame.rootToken);
 expect(a.world).toStrictEqual(before);expect(readResidentFilthFrame(structuredClone(c.world))).toBeUndefined();
});

test('same-tick row edits and exact physical nextCheckCore changes send complete changed records only',()=>{
 const h=harness();h.world.filth!.items[0]!.nextCheckCore=h.world.tick*10+5;
 const a=h.send(),before=structuredClone(a.world);h.world.filth!.items[1]!.thickness=2;
 const b=h.send(),section=b.wire.filth.section;if(section.mode!=='items')throw Error('Expected item section');
 expect(section.upserted).toHaveLength(1);expect(section.upserted[0]).toStrictEqual(h.world.filth!.items[1]);expect(b.world.filth!.items[0]).toBe(a.world.filth!.items[0]);
 expect(b.world.filth!.items[1]).not.toBe(a.world.filth!.items[1]);expect(a.world).toStrictEqual(before);
 h.world.tick++;h.world.corePathBudget297=newCorePathBudget297(h.world.tick);if(h.world.deterioration)h.world.deterioration.lastTick=h.world.tick;advanceFilth(h.world,0);const c=h.send(),next=c.wire.filth.section;if(next.mode!=='items')throw Error('Expected item section');
 expect(next.upserted).toHaveLength(1);expect(next.upserted[0]!.id).toBe(h.world.filth!.items[0]!.id);expect(next.upserted[0]!.nextCheckCore).toBe(h.world.filth!.items[0]!.nextCheckCore);
 expect(b.world.filth!.items[0]!.nextCheckCore).toBe(before.tick*10+5);
});

test('replacement clones, key order, insertion, removal, reorder, empty and reactivation reconstruct the same public projection',()=>{
 const h=harness(),a=h.send();h.world.filth={cleaned:h.world.filth!.cleaned,items:h.world.filth!.items.map(row=>({...row})),rng:h.world.filth!.rng};
 const row=h.world.filth.items[0]!,expires=row.expiresAfterCore;delete (row as Partial<typeof row>).expiresAfterCore;row.expiresAfterCore=expires;
 const b=h.send();expect(Object.keys(b.world.filth!)).toEqual(['cleaned','items','rng']);expect(b.world.filth!.items[1]).toBe(a.world.filth!.items[1]);
 h.world.tiles[5+3*h.world.width]={terrain:'soil'};expect(addFilth(h.world,{x:5,z:3},'blood')).toBe(true);removeFilth(h.world,h.world.filth!.items[1]!);
 const c=h.send(),patch=c.wire.filth.section;if(patch.mode!=='items')throw Error('Expected item section');expect(patch.removed).toHaveLength(1);expect(patch.upserted).toHaveLength(1);
 h.world.filth!.items.reverse();const d=h.send();expect(d.wire.filth.section).toHaveProperty('order',h.world.filth!.items.map(row=>row.id));expect(d.world.filth!.items[0]).toBe(c.world.filth!.items.at(-1));
 h.world.filth!.items=[];const empty=h.send();expect(empty.world.filth!.items).toEqual([]);expect(addFilth(h.world,{x:2,z:3},'blood')).toBe(true);const live=h.send();expect(live.world.filth!.items).toHaveLength(1);
 expect(a.world.filth!.items).toHaveLength(3);expect(empty.world.filth!.items).toHaveLength(0);
});

test('missing edge, stale delivery, clear and checkpoints never borrow an uncertified predecessor',()=>{
 const h=harness(),a=h.send(),one=h.capture(),two=h.capture();
 expect(new ResidentFilthFrameOwner().prepare(one.wire.publication as unknown as SnapshotMessage<true>,one.wire.filth)).toBeUndefined();expect(h.prepare(two.wire)).toBeUndefined();
 expect(h.deliver(one).result.status).toBe('applied');expect(h.deliver(two).result.status).toBe('applied');expect(h.prepare(two.wire)).toBe('stale');
 h.owner.clear();const skipped=h.capture();expect(h.prepare(skipped.wire)).toBeUndefined();const fresh=h.send(true);expect(fresh.world.filth!.items[0]).not.toBe(a.world.filth!.items[0]);
});

test.each(['refuse','throw'] as const)('late extra %s publishes no filth state or capability and the same packet retries exactly',mode=>{
 const h=harness(),a=h.send(),frame=readResidentFilthFrame(a.world);h.world.filth!.items[0]!.thickness=2;const row=h.capture();let candidate:World|undefined;
 const extra=(world:World)=>{candidate=world;if(mode==='throw')throw Error('late filth test');return false;};
 if(mode==='throw')expect(()=>h.deliver(row,extra)).toThrow('late filth test');else expect(h.deliver(row,extra).result.status).toBe('resync');
 expect(candidate).toBeDefined();expect(readResidentFilthFrame(candidate!)).toBeUndefined();expect(readResidentFilthFrame(a.world)).toBe(frame);expect(a.world.filth!.items[0]!.thickness).toBe(1);
 const retry=h.deliver(row);expect(retry.result.status).toBe('applied');if(retry.result.status!=='applied')throw Error('Retry refused');expect(retry.result.world.filth!.items[0]!.thickness).toBe(2);
});

test('a late validator that substitutes the staged filth cannot advance base or filth state',()=>{
 const h=harness(),a=h.send(),frame=readResidentFilthFrame(a.world);h.world.filth!.rng^=1;const row=h.capture();
 expect(h.deliver(row,world=>{world.filth=structuredClone(world.filth);return true;}).result.status).toBe('resync');
 expect(readResidentFilthFrame(a.world)).toBe(frame);expect(h.deliver(row).result.status).toBe('applied');
});

test('malformed metadata, IDs, reset, order, markers and data descriptors refuse atomically without reading getters',()=>{
 const h=harness(),a=h.send(),frame=readResidentFilthFrame(a.world);h.world.filth!.items[0]!.thickness=2;const good=h.capture();
 const corruptions:((wire:Wire)=>void)[]=[
  w=>Object.assign(w.filth,{tick:w.filth.tick+1}),w=>Object.assign(w.filth,{baseRevision:0}),
  w=>Object.assign(w.filth.section,{count:0}),
  w=>Object.assign(w.filth.section,{removed:[999999]}),w=>Object.assign(w.filth.section,{reset:true}),
  w=>{if(w.filth.section.mode==='items')Object.assign(w.filth.section,{upserted:[...w.filth.section.upserted,...w.filth.section.upserted]});},
  w=>{if(w.filth.section.mode==='items')Object.assign(w.filth.section,{removed:[w.filth.section.upserted[0]!.id]});},
  w=>Object.assign(w.filth.section,{order:[a.world.filth!.items[0]!.id]}),
  w=>Object.assign(w.filth.section,{order:[a.world.filth!.items[0]!.id,a.world.filth!.items[0]!.id,a.world.filth!.items[2]!.id]}),
  w=>Object.assign(w.filth.section,{future:undefined}),w=>Object.assign(w.publication.world,{filth:[]}),
  w=>{if(w.filth.section.mode==='items')Object.assign(w.filth.section.header,{items:[]});},
 ];
 for(const mutate of corruptions){const wire=structuredClone(good.wire);mutate(wire);expect(h.prepare(wire)).toBeUndefined();expect(readResidentFilthFrame(a.world)).toBe(frame);}
 let reads=0;const getter=structuredClone(good.wire);if(getter.filth.section.mode!=='items')throw Error('Expected item section');Object.defineProperty(getter.filth.section.upserted[0]!,'thickness',{enumerable:true,get(){reads++;return 2;}});
 expect(h.prepare(getter)).toBeUndefined();expect(reads).toBe(0);expect(h.deliver(good).result.status).toBe('applied');
});

test('truncated checkpoints, duplicate checkpoint IDs and sparse arrays cannot certify complete items',()=>{
 const h=harness(),good=h.capture(true);
 const truncated=structuredClone(good.wire);if(truncated.filth.section.mode!=='items')throw Error('Expected item section');
 Object.assign(truncated.filth.section,{upserted:truncated.filth.section.upserted.slice(0,-1)});expect(h.prepare(truncated)).toBeUndefined();
 const duplicate=structuredClone(good.wire);if(duplicate.filth.section.mode!=='items')throw Error('Expected item section');Object.assign(duplicate.filth.section,{upserted:[duplicate.filth.section.upserted[0],duplicate.filth.section.upserted[0],duplicate.filth.section.upserted[2]]});expect(h.prepare(duplicate)).toBeUndefined();
 const sparse=structuredClone(good.wire);if(sparse.filth.section.mode!=='items')throw Error('Expected item section');delete (sparse.filth.section.upserted as unknown[])[0];expect(h.prepare(sparse)).toBeUndefined();
 expect(h.deliver(good).result.status).toBe('applied');
});

test('wire representation preserves absence, own undefined, extra own undefined and -0 without certifying invalid gameplay states',()=>{
 const h=harness();
 const representation=(mutate:(world:World)=>void)=>{
  mutate(h.world);const literal=h.encoder.encode(h.world,0,1,true),before=structuredClone(literal),wire=structuredClone(new ResidentFilthEncoder().capture(literal)),owner=new ResidentFilthFrameOwner();
  const draft=owner.prepare(wire.publication as unknown as SnapshotMessage<true>,wire.filth);expect(draft&&draft!=='stale').toBe(true);if(!draft||draft==='stale')throw Error('Representation refused');expect(draft.packet).toStrictEqual(before);expect(literal).toStrictEqual(before);return draft.packet.world;
 };
 const absent=representation(world=>{delete world.filth;});expect(Object.hasOwn(absent,'filth')).toBe(false);
 const undefinedRoot=representation(world=>{world.filth=undefined;});expect(Object.hasOwn(undefinedRoot,'filth')).toBe(true);expect(undefinedRoot.filth).toBeUndefined();
 const extra=representation(world=>{world.filth={rng:1,items:[],cleaned:-0};Object.defineProperty(world.filth,'representation',{value:undefined,enumerable:true,writable:true,configurable:true});});
 expect(Object.is(extra.filth!.cleaned,-0)).toBe(true);expect(Object.hasOwn(extra.filth!,'representation')).toBe(true);
});
