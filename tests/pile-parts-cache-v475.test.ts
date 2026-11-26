// Resident pile geometry, ownership, same-tick cargo and batch equivalence.
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {ScenePilePresentation} from '../src/render/ScenePilePresentation';
import {pileParts} from '../src/render/pile-parts';
import {BoxBatches} from '../src/render/BoxBatches';
import {BoxMesh} from '../src/render/BoxMesh';
import type {World} from '../src/sim/types';
import {fixture,harness} from './resident-presentation-fixtures-v427';
import {SnapshotChangeJournal} from '../src/bridge/snapshots';
import {ownActorPlaybackWorld435} from '../src/render/ActorPlayback435';

vi.mock('../src/render/pile-parts',async importOriginal=>{
 const original=await importOriginal<typeof import('../src/render/pile-parts')>();
 return {...original,pileParts:vi.fn(original.pileParts)};
});

function camp(){
 const w=fixture();w.structures=[];w.jobs=[];
 w.piles=[
  {id:w.nextId++,kind:'wood',item:'wood',quantity:10,owner:{type:'ground',x:4,z:4}},
  {id:w.nextId++,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:5,z:4}},
  {id:w.nextId++,kind:'beer',item:'beer',quantity:3,owner:{type:'ground',x:6,z:4}},
 ];
 return harness(w);
}
function read(owner:ScenePilePresentation,w:World,hidden:ReadonlyMap<number,number>=new Map()){
 owner.prepareSupports(w);const frame=owner.read(w,hidden);if(!frame)throw Error('Missing prepared frame');return frame;
}
function state(group:THREE.Group){return group.children.filter((m):m is BoxMesh=>m instanceof BoxMesh).map(m=>({
 name:m.name,count:m.activeCount,capacity:m.instanceMatrix.count,
 matrix:Array.from(m.instanceMatrix.array),colors:Array.from(m.colorBuffer.array),
 shape:m.itemShapeBuffer?Array.from(m.itemShapeBuffer.array):undefined,
 contour:m.geometry.hasAttribute('chunkContour')?Array.from(m.geometry.getAttribute('chunkContour').array):undefined,
 sphere:[...m.boundingSphere.center.toArray(),m.boundingSphere.radius],
}));}

test('only dirty bundles regenerate intrinsic geometry; cached flatten is exactly historical',()=>{
 const h=camp(),owner=new ScenePilePresentation(),a=read(owner,h.send()),change=a.changedChunks[0]!;
 vi.mocked(pileParts).mockClear();const first=owner.placements(a,change);
 expect(pileParts).toHaveBeenCalledTimes(3);
 expect(first).toEqual(pileParts(change.bundles));expect(owner.acknowledge(a)).toBe(true);
 h.world.piles[0]!.quantity++;const b=read(owner,h.send()),next=b.changedChunks[0]!;
 vi.mocked(pileParts).mockClear();const second=owner.placements(b,next);
 expect(pileParts).toHaveBeenCalledTimes(1);expect(second).toEqual(pileParts(next.bundles));
});

test('current frame identity fences stale/foreign reads and output mutation cannot poison cache',()=>{
 const h=camp(),owner=new ScenePilePresentation(),a=read(owner,h.send()),change=a.changedChunks[0]!;
 const expected=pileParts(change.bundles),parts=owner.placements(a,change);parts[0]!.x=12345;
 expect(owner.placements(a,change)).toEqual(expected);
 const owned=owner.ownedPlacements(a,change);expect(owned).toEqual(expected);
 expect(owner.ownedPlacements(a,change)[0]).toBe(owned[0]);
 expect(()=>{owned[0]!.x=12345;}).toThrow(TypeError);
 expect(owner.placements(a,change)[0]).not.toBe(owned[0]);
 const inspect=owner.inspect();inspect[0]!.bundles[0]!.quantity=345;inspect[0]!.bundles[0]!.x=999;
 expect(owner.placements(a,change)).toEqual(expected);
 expect(()=>owner.placements({...a},change)).toThrow('Stale or foreign');
 expect(()=>owner.placements(a,{...change})).toThrow('Stale or foreign');
 owner.acknowledge(a);expect(()=>owner.placements(a,change)).toThrow('Stale or foreign');
 owner.clear();expect(()=>owner.placements(a,change)).toThrow('Stale or foreign');
});

test('same World cargo release is immediate and preserves exact hidden quantities',()=>{
 const h=camp(),owner=new ScenePilePresentation(),w=h.send(),id=w.piles[0]!.id;
 const a=read(owner,w,new Map([[id,4]]));for(const chunk of a.changedChunks)expect(owner.placements(a,chunk)).toEqual(pileParts(chunk.bundles));owner.acknowledge(a);
 const b=read(owner,w,new Map());expect(b.changedChunks.length).toBeGreaterThan(0);
 for(const chunk of b.changedChunks)expect(owner.placements(b,chunk)).toEqual(pileParts(chunk.bundles));
});

test('the immutable admitted Full applies a same-World cargo overlay without scanning untouched pile rows',()=>{
 const h=camp(),closed=new ScenePilePresentation(),literal=new ScenePilePresentation(),w=h.send(),id=w.piles[0]!.id;
 // Both owners see the same admitted content. Only the closed renderer's
 // immutable playback mandate authorizes the same-object dirty overlay.
 ownActorPlaybackWorld435(w,true);
 try{
  for(let i=0;i<5;i++){
   const hidden=i%2?new Map<number,number>():new Map([[id,4]]),before=closed.residentMetrics379().visits;
   const a=read(closed,w,hidden);
   ownActorPlaybackWorld435(w,false);const b=read(literal,w,hidden);ownActorPlaybackWorld435(w,true);
   expect(closed.inspect()).toEqual(literal.inspect());
   expect(a.changedChunks).toEqual(b.changedChunks);
   for(const change of a.changedChunks)expect(closed.placements(a,change)).toEqual(pileParts(change.bundles));
   if(i>0)expect(closed.residentMetrics379().visits-before).toBe(1);
   closed.acknowledge(a);literal.acknowledge(b);
  }
 }finally{ownActorPlaybackWorld435(w,false);}
});

test('published bundle body rejects before/after cache mutation without freezing source aliases',()=>{
 // Deliberate narrow projection fixture: the journal grants a test-only
 // witness, not a claim that this is a complete valid gameplay tree import.
 const w=fixture(),tree={...w.resources[0]!,kind:'tree' as const,species:'oak' as const,growth:.5},surface={x:.1,y:.8,z:.2,scale:.65};
 w.piles=[{id:w.nextId++,kind:'plant',item:'minified-tree',quantity:1,owner:{type:'ground',x:4,z:4},innerResource:tree}];
 const journal=new SnapshotChangeJournal();journal.reset(w,1,1);const owner=new ScenePilePresentation();
 owner.prepareSupports(w,false,{cells:new Map([[4*w.width+4,surface]]),identities:new Map()});
 const frame=owner.read(w,new Map())!,change=frame.changedChunks[0]!,bundle=change.bundles[0]!;
 expect(bundle.innerResource).not.toBe(tree);expect(bundle.surface).not.toBe(surface);
 expect(Object.isFrozen(tree)).toBe(false);expect(Object.isFrozen(surface)).toBe(false);
 expect(()=>{bundle.quantity=2;}).toThrow(TypeError);
 expect(()=>{bundle.surface!.scale=.1;}).toThrow(TypeError);
 expect(()=>{(bundle.innerResource as {growth:number}).growth=1;}).toThrow(TypeError);
 expect(()=>{(change.bundles as unknown[]).splice(0,1);}).toThrow(TypeError);
 expect(()=>{(frame.changedChunks as unknown[]).push({...change});}).toThrow(TypeError);
 const expected=pileParts(change.bundles);expect(owner.placements(frame,change)).toEqual(expected);
 tree.growth=1;surface.scale=.1; // external aliases cannot mutate frozen body
 expect(owner.placements(frame,change)).toEqual(expected);
 expect(()=>{bundle.surface!.y=0;}).toThrow(TypeError);
 expect(owner.placements(frame,change)).toEqual(expected);
});

test('a retry retains pending writes but an intervening read retires the older parts receipt',()=>{
 const h=camp(),owner=new ScenePilePresentation(),w=h.send(),a=read(owner,w),old=a.changedChunks[0]!;
 const parts=owner.placements(a,old); // simulate caller failure before ACK
 const retry=read(owner,w),next=retry.changedChunks[0]!;
 expect(owner.placements(retry,next)).toEqual(parts);
 expect(()=>owner.placements(a,old)).toThrow('Stale or foreign');
 expect(owner.acknowledge(a)).toBe(false);expect(owner.acknowledge(retry)).toBe(true);
 const mutable={...w};expect(owner.prepareSupports(mutable)).toBeUndefined();
 expect(owner.read(mutable,new Map())).toBeUndefined();
 expect(()=>owner.placements(retry,next)).toThrow('Stale or foreign');
});

test('real BoxBatches retains exact F32, atlas ordinals and bounds across quanta/removal/reorder',()=>{
 const h=camp(),owner=new ScenePilePresentation(),a=new BoxBatches(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group();
 const apply=()=>{const frame=read(owner,h.send());for(const change of frame.changedChunks){
  const exact=pileParts(change.bundles),cached=owner.placements(frame,change),before=structuredClone(cached);
  a.set(ga,`pile:${change.key}`,exact);b.set(gb,`pile:${change.key}`,cached);
  expect(cached).toEqual(before);expect(state(gb)).toEqual(state(ga));
 }owner.acknowledge(frame);};
 try{apply();h.world.piles[2]!.quantity=5;apply();h.world.piles.shift();apply();h.world.piles.reverse();apply();
  const w=h.send();expect(owner.read({...w},new Map())).toBeUndefined();
 }finally{a.dispose();b.dispose();owner.clear();}
});
