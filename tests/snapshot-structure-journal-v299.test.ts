import {registeredMapPresentation} from '../src/sim/world-map-presentation';
import {expect, test} from 'vitest';
import {SnapshotDecoder, SnapshotEncoder, type SnapshotMessage} from '../src/bridge/snapshots.ts';
import {readSnapshotChanges, readSnapshotStructureChanges} from '../src/bridge/snapshot-changes.ts';
import type {World} from '../src/sim/types.ts';
import {deconstructionCamp, fixtureBuilding} from './scenarios/deconstruction.ts';

type Packet = SnapshotMessage<true>;
function fixture() {
  const world=deconstructionCamp();
  fixtureBuilding(world,'wall',4,4);
  fixtureBuilding(world,'wall',5,4);
  fixtureBuilding(world,'dining-chair',7,4);
  return world;
}
function sparse(packet:Packet) {
  if(packet.kind!=='delta'||!packet.structures)throw Error('Expected sparse structure transport.');
  return packet;
}
function harness() {
  const world=fixture(), encoder=new SnapshotEncoder({structureDelta:true});
  const decoder=new SnapshotDecoder();
  const packet=(checkpoint=false)=>structuredClone(encoder.encode(world,0,6,checkpoint));
  const accept=(input:Packet)=>{
    const copy=structuredClone(input), b=decoder.adopt(input);
    expect(input).toStrictEqual(copy);
    return b;
  };
  const applied=(input:Packet):World=>{
    const result=accept(input);
    if(result.status!=='applied')throw Error(JSON.stringify(result));
    return result.world;
  };
  const send=(checkpoint=false)=>{
    // Keep the complete real projection as an independent value. The Worker
    // retains worldMaps/worldGroups; snapshots carry their campaign metadata.
    const view=registeredMapPresentation(world);if(!view)throw Error('Expected selected registered map');
    const expected=structuredClone(view);
    const next=applied(packet(checkpoint));expect(next).toStrictEqual(expected);return next;
  };
  return {world,encoder,decoder,packet,accept,applied,send};
}

test('A→C is composed from C after D, with sorted owned metadata and retained views',()=>{
  const h=harness(), a=h.send(), saved=structuredClone(a);
  h.world.structures[2]!.orientation=1;const b=h.send();
  h.world.structures[0]!.damage=1;h.world.tiles[7]!.floor='wood-planks';
  const packet=sparse(h.packet()), c=h.applied(packet), savedC=structuredClone(c);
  h.world.structures[1]!.damage=2;h.world.tiles[9]!.floor='wood-planks';const d=h.send();
  const changes=readSnapshotStructureChanges(a,c)!;
  expect(changes).toEqual({structureIndices:[0,2],tileIndices:[7]});
  expect(readSnapshotStructureChanges(b,c)).toEqual({structureIndices:[0],tileIndices:[7]});
  expect(readSnapshotStructureChanges(c,d)).toEqual({structureIndices:[1],tileIndices:[9]});
  expect(c.structures[1]!.damage).toBeUndefined();expect(d.structures[1]!.damage).toBe(2);
  expect(Object.isFrozen(changes)).toBe(true);
  expect(Object.isFrozen(changes.structureIndices)).toBe(true);
  expect(Object.isFrozen(changes.tileIndices)).toBe(true);
  expect(()=>{(changes.structureIndices as number[]).push(99);}).toThrow();
  // Transport metadata may be changed after adoption; accepted leaf objects
  // are retained by the historical Decoder and remain private reader data.
  packet.structures!.removed.push(99999);packet.structures!.upserted.length=0;packet.tiles![0]![0]=100;
  expect(readSnapshotStructureChanges(a,c)).toEqual(changes);
  expect(a).toStrictEqual(saved);expect(c).toStrictEqual(savedC);
  expect(readSnapshotStructureChanges(c,a)).toBeUndefined();
});

test('late refusal, stale and gap publish nothing, and exact recovery keeps the suffix',()=>{
  const h=harness(), a=h.send();h.world.structures[0]!.damage=1;
  const good=h.packet(), bad=structuredClone(good);
  bad.world.relationships={links:[],unexpected:true} as never;
  expect(h.accept(bad)).toEqual({status:'resync',reason:'Liens, annonce ou souvenirs relationnels incohérents.'});
  expect(readSnapshotStructureChanges(a,bad.world as World)).toBeUndefined();
  expect(readSnapshotStructureChanges(a,a)).toEqual({structureIndices:[],tileIndices:[]});
  const b=h.applied(good), before=readSnapshotStructureChanges(a,b);
  expect(h.accept(structuredClone(good))).toEqual({status:'stale'});
  expect(readSnapshotStructureChanges(a,b)).toEqual(before);
  h.world.structures[1]!.damage=1;const missed=h.packet();
  h.world.structures[2]!.orientation=2;const ahead=h.packet();
  expect(h.accept(structuredClone(ahead))).toEqual({status:'resync',reason:'Snapshot intermédiaire manquant.'});
  expect(readSnapshotStructureChanges(a,b)).toEqual(before);
  h.applied(missed);const c=h.applied(ahead);
  expect(readSnapshotStructureChanges(a,c)).toEqual({structureIndices:[0,1,2],tileIndices:[]});
});

test('Resource membership/order is independent; terrain-only changes still reach structural consumers',()=>{
  const h=harness(), a=h.send();
  h.world.resources.push({id:h.world.nextId++,kind:'berries',x:10,z:10,amount:10});
  h.world.tiles[3]!.floor='wood-planks';const b=h.send();
  expect(readSnapshotChanges(a,b)).toBeUndefined();
  expect(readSnapshotStructureChanges(a,b)).toEqual({structureIndices:[],tileIndices:[3]});
  h.world.resources.push({id:h.world.nextId++,kind:'berries',x:11,z:10,amount:10});const c=h.send();
  h.world.resources.reverse();const d=h.send();
  expect(readSnapshotStructureChanges(b,d)).toEqual({structureIndices:[],tileIndices:[]});
  h.world.resources.splice(0,1);h.world.tiles[7]!.floor='wood-planks';const e=h.send();
  expect(readSnapshotStructureChanges(c,e)).toEqual({structureIndices:[],tileIndices:[7]});
  h.world.tiles[9]!.floor='wood-planks';const f=h.send();
  expect(readSnapshotStructureChanges(e,f)).toEqual({structureIndices:[],tileIndices:[9]});
});

test('64 edges compose exactly; the 65th evicts only the unreachable prefix',()=>{
  const h=harness(), frames=[h.send()];
  for(let i=0;i<64;i++){h.world.structures[0]!.damage=i+1;frames.push(h.send());}
  expect(readSnapshotStructureChanges(frames[0]!,frames[64]!)).toEqual({structureIndices:[0],tileIndices:[]});
  h.world.structures[1]!.damage=1;const next=h.send();
  expect(readSnapshotStructureChanges(frames[0]!,next)).toBeUndefined();
  expect(readSnapshotStructureChanges(frames[1]!,next)).toEqual({structureIndices:[0,1],tileIndices:[]});
});

test('private structure keys preserve nested same-tick values and order after outgoing records are edited',()=>{
  // Encoder representation contract only: the extra nested data is not a
  // claim that the gameplay decoder admits a new structure field.
  const world=fixture(),encoder=new SnapshotEncoder({structureDelta:true});
  const structure=world.structures[0]! as unknown as Record<string,unknown>;
  structure.representation={number:0,optional:undefined,rows:[{value:1}]};
  encoder.encode(world,0,1);
  expect(sparse(encoder.encode(world,0,1)).structures!.upserted).toEqual([]);
  const data=structure.representation as {number:number;optional?:unknown;rows:{value:number}[]};
  data.number=-0;data.rows[0]!.value=2;
  const changed=sparse(encoder.encode(world,0,1)).structures!.upserted;
  expect(changed).toHaveLength(1);
  const sent=(changed[0] as unknown as typeof structure).representation as typeof data;
  expect(Object.is(sent.number,-0)).toBe(true);
  // An outbound value has no authority over the encoder's owned key metadata.
  delete sent.optional;sent.rows[0]!.value=99;sent.number=7;
  expect(sparse(encoder.encode(world,0,1)).structures!.upserted).toEqual([]);
  delete data.optional;
  expect(sparse(encoder.encode(world,0,1)).structures!.upserted).toHaveLength(1);
  structure.representation={rows:data.rows,number:data.number};
  const reordered=sparse(encoder.encode(world,0,1)).structures!.upserted;
  expect(reordered).toHaveLength(1);
  expect(Object.keys((reordered[0] as unknown as typeof structure).representation as object)).toEqual(['rows','number']);
});
