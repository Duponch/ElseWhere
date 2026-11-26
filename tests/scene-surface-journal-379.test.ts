import {expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {addFilth} from '../src/sim/filth';
import {RoomTopologyCache} from '../src/sim/room-topology';
import {FilthLayer} from '../src/render/FilthLayer';
import {FilthPresentationPieces} from '../src/render/filth-presentation-pieces';
import {SceneStructurePreparation} from '../src/render/SceneStructurePreparation';
import {SceneLightTopology} from '../src/render/SceneLightTopology';
import {ScenePilePresentation} from '../src/render/ScenePilePresentation';
import * as surface from '../src/render/surface-height';
import {harness} from './resident-presentation-fixtures-v427';

function fixture(){
 const world=createWorld(37912,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));world.resources=[];world.structures=[];world.jobs=[];world.piles=[];
 for(const [x,z]of [[4,4],[12,12],[24,24]])expect(addFilth(world,{x:x!,z:z!},'blood')).toBe(true);
 return harness(world);
}
const pieces=(frame:ReturnType<FilthPresentationPieces['read']>)=>frame.blocks.flatMap(block=>block.pieces);

test('confirmed filth checks only producer-dirty surface cells across skipped Fulls and resource membership changes',()=>{
 const h=fixture(),owner=new FilthPresentationPieces(),a=h.send(),initial=owner.readWorld(a),height=vi.spyOn(surface,'surfaceHeightAtCell');
 try{
  const b=h.send();height.mockClear();expect(owner.readWorld(b).changed).toBe(false);expect(height).not.toHaveBeenCalled();
  h.world.resources.push({id:h.world.nextId++,kind:'berries',x:2,z:2,amount:5,growth:.4,growthTick:h.world.tick});
  const c=h.send();height.mockClear();expect(owner.readWorld(c).changed).toBe(false);expect(height).not.toHaveBeenCalled();
  h.world.tiles[4*h.world.width+4]!.floor='steel-tile';h.send();
  h.world.tiles[24*h.world.width+24]={terrain:'water-shallow',bridge:true};const d=h.send();height.mockClear();
  const changed=owner.readWorld(d),calls=height.mock.calls.length;
  expect(calls).toBeGreaterThan(0);expect(calls).toBeLessThan(20);
  expect(changed.blocks[0]!.pieces).not.toBe(initial.blocks[0]!.pieces);expect(changed.blocks[1]!.pieces).toBe(initial.blocks[1]!.pieces);expect(changed.blocks[2]!.pieces).not.toBe(initial.blocks[2]!.pieces);
  expect(pieces(changed)).toStrictEqual(pieces(new FilthPresentationPieces().read(d.filth!.items,false,d)));
  // A backward endpoint has no suffix and must inspect every supporting cell.
  height.mockClear();const backwards=owner.readWorld(b);expect(height.mock.calls.length).toBeGreaterThan(0);expect(pieces(backwards)).toStrictEqual(pieces(new FilthPresentationPieces().read(b.filth!.items,false,b)));
 }finally{height.mockRestore();}
});

test('public reads, repeated mutable Worlds, checkpoint resets and reordered filth retain complete literal GPU attributes',()=>{
 const h=fixture(),native=new FilthLayer(),literal=new FilthLayer(),height=vi.spyOn(surface,'surfaceHeightAtCell');
 const check=(world:ReturnType<typeof h.send>)=>{
  native.updateWorld(world);literal.update(world.filth!.items,false,world);
  expect(native.mesh.geometry.instanceCount).toBe(literal.mesh.geometry.instanceCount);
  const count=native.mesh.geometry.instanceCount*4;
  for(const key of ['filthPose','filthShape','filthClip'])expect(Array.from(native.mesh.geometry.getAttribute(key).array).slice(0,count)).toEqual(Array.from(literal.mesh.geometry.getAttribute(key).array).slice(0,count));
 };
 try{
  const a=h.send();check(a);h.world.filth!.items.reverse();h.world.filth!.items[0]!.thickness=3;check(h.send());
  h.world.tiles[12*h.world.width+12]!.floor='marble-tile';const checkpoint=h.send(true);height.mockClear();check(checkpoint);expect(height.mock.calls.length).toBeGreaterThan(0);
  // The public method breaks the confirmed predecessor, even for the same
  // source object. The following read may not borrow its previous receipt.
  native.update(checkpoint.filth!.items,false,checkpoint);const next=h.send();height.mockClear();native.updateWorld(next);expect(height.mock.calls.length).toBeGreaterThan(0);check(next);
  const raw=structuredClone(next);raw.tiles[4*raw.width+4]!.bridge=true;check(raw);delete raw.tiles[4*raw.width+4]!.bridge;raw.tiles[4*raw.width+4]!.floor='wood-planks';check(raw);
 }finally{height.mockRestore();native.dispose();literal.dispose();}
});

test('full geometry fallback rereads all primitives without reconstructing unchanged support and light topology',()=>{
 const h=fixture(),geometry:{changed:boolean;visited:number}[]=[],owner=new SceneStructurePreparation((_world,_captures,changed,visited)=>geometry.push({changed,visited})),topology=new SceneLightTopology();
 h.world.structures=[{id:h.world.nextId++,kind:'wall',x:8,z:8,orientation:0,footprint:'standard',material:'wood'}];
 const a=h.send();owner.read(a);topology.read(a);const read=vi.spyOn(RoomTopologyCache.prototype,'read');
 try{
  h.world.structures[0]!.material='steel';const b=h.send(true);owner.read(b);read.mockClear();topology.read(b);
  expect(geometry.at(-1)).toEqual({changed:false,visited:1});expect(read).not.toHaveBeenCalled();
  // A same-World public edit still has no sparse authority. Its full captured
  // primitives detect movement and the topology changes immediately.
  b.structures[0]!.x=9;owner.read(b);const moved=topology.read(b);expect(geometry.at(-1)!.changed).toBe(true);expect(moved.at(9,8)?.kind).toBe('solid');expect(moved.at(8,8)?.kind).toBe('space');
  b.width=16;b.height=64;const reshaped=topology.read(b);expect(reshaped.width).toBe(16);expect(reshaped.height).toBe(64);
  b.structures[0]!.x=10;Object.defineProperty(b.tiles[0]!,'terrain',{configurable:true,get(){throw Error('surface read');}});
  expect(()=>topology.read(b)).toThrow('surface read');Object.defineProperty(b.tiles[0]!,'terrain',{configurable:true,enumerable:true,writable:true,value:'soil'});
  const retried=topology.read(b);expect(retried.at(10,8)?.kind).toBe('solid');expect(retried.at(9,8)?.kind).toBe('space');
 }finally{read.mockRestore();}
});

test('rot-only pile replacement keeps its captured cell and bundle while same-tick quantity and permission edits still publish',()=>{
 const h=fixture(),owner=new ScenePilePresentation();h.world.piles=[{id:h.world.nextId++,kind:'food',item:'simple-meal',quantity:5,owner:{type:'ground',x:6,z:4},rot:{progress:0,atTick:0}}];
 const a=h.send();owner.prepareSupports(a);const first=owner.read(a,new Map())!;expect(first.changedChunks).toHaveLength(1);owner.acknowledge(first);
 h.world.piles[0]!.rot!.rate=.5;const b=h.send();expect(b.piles[0]).not.toBe(a.piles[0]);
 const clone=vi.spyOn(globalThis,'structuredClone');
 try{
  owner.prepareSupports(b);const unchanged=owner.read(b,new Map())!;expect(unchanged.changedChunks).toEqual([]);expect(clone).not.toHaveBeenCalled();owner.acknowledge(unchanged);
  h.world.piles[0]!.quantity=4;const c=h.send();owner.prepareSupports(c);const quantity=owner.read(c,new Map())!;expect(quantity.changedChunks[0]!.bundles[0]!.quantity).toBe(4);owner.acknowledge(quantity);
  h.world.piles[0]!.forbidden=true;const d=h.send();owner.prepareSupports(d);const forbidden=owner.read(d,new Map())!;expect(forbidden.changedChunks[0]!.bundles[0]!.forbidden).toBe(true);
  expect(first.changedChunks[0]!.bundles[0]!.quantity).toBe(5);expect(first.changedChunks[0]!.bundles[0]!.forbidden).toBeUndefined();
 }finally{clone.mockRestore();owner.clear();}
});
