import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {FurniturePresentation} from '../src/render/FurnitureLayer';
import {StructurePresentationSignature} from '../src/render/presentation-signatures';
import {habitatPartsForStructure} from '../src/render/habitat-parts';
import {habitatParts} from '../src/render/habitat-parts';
import {buildFurniture} from '../src/render/FurnitureLayer';
import {deserializeWorld} from '../src/sim/serialization';
import {decodeStoredSave} from '../src/ui/save-storage-codec';
import {sunLampActive} from '../src/sim/sun-lamp';
import {TICKS_PER_DAY,type World} from '../src/sim/types';
import {camp,growth,laidOut,pot,RecordingBatches,structure} from './furniture-resident-fixtures';

function pipeline(world:World){
  const owner=new FurniturePresentation(),signature=new StructurePresentationSignature(),batches=new RecordingBatches(),group=new THREE.Group();
  const apply=(cutaway=false,readonlyNative=true,reset=false)=>{
    signature.read(world.structures,'','',reset);
    owner.update(world,group,cutaway,batches.asNative(),signature.flowerChanges(),readonlyNative);
    signature.ackFurnitureBuild();expect(batches.items).toEqual(laidOut(world,owner,cutaway));
  };
  return {owner,signature,batches,group,apply};
}

test('unaltered public Aulnes payload keeps the historical placements and their order within each zone, then three distinct pots patch exactly',async()=>{
  const path='public/test-saves/v224/les-aulnes-sieges.json',raw=readFileSync(path,'utf8');
  const world=deserializeWorld(await decodeStoredSave(raw)),before=structuredClone(world),h=pipeline(world);
  h.apply();expect(world).toEqual(before);expect(h.batches.calls).toHaveLength(1);
  const ordinals=[20009,20043,20077].map(id=>world.structures.findIndex(s=>s.id===id));
  expect(ordinals.every(i=>i>=0&&world.structures[i]!.kind==='flower-pot'&&!!world.structures[i]!.flower?.plant)).toBe(true);
  for(const ordinal of ordinals){
    const old=world.structures[ordinal]!.flower!.plant!,next=Math.floor(old.growth*4)===1?.75:.25;
    growth(world,ordinal,next);h.apply();expect(h.batches.calls.at(-1)!.kind).toBe('patch');
  }
  expect(readFileSync(path,'utf8')).toBe(raw); // Synthetic later renders do not replace or claim a played archive.
},20_000);

test('same zoned batch remains byte-equivalent in placements across quarter thresholds, deaths and cumulative nonconsumed reads',()=>{
  const world=camp(),h=pipeline(world);h.apply();const initial=structuredClone(world);
  for(const value of [.25-Number.EPSILON,.25,.25+Number.EPSILON,.5,.75,1]){
    const previous=Math.floor(world.structures[1]!.flower!.plant!.growth*4);
    growth(world,1,value);h.apply();if(Math.floor(value*4)!==previous)expect(h.batches.calls.at(-1)!.kind).toBe('patch');
    expect(habitatPartsForStructure(world.structures[1]!)).toEqual(habitatParts({...world,structures:[world.structures[1]!]}));
  }
  growth(world,1,1,0);h.apply();expect(h.batches.calls.at(-1)!.kind).toBe('patch');
  growth(world,1,.5,85);h.signature.read(world.structures,'','');
  growth(world,4,.75);h.signature.read(world.structures,'','');
  expect(h.signature.flowerChanges()).toEqual([1,4]);h.apply();
  expect(h.batches.calls.slice(-2).map(c=>c.kind)).toEqual(['patch','patch']);
  expect(initial.structures[1]!.flower!.plant!.growth).toBe(.24);
});

test('reset, cutaway, owner clear, group replacement, shrink/presence and patch rejection all use an exact full rebuild',()=>{
  const world=camp(),h=pipeline(world);h.apply();
  const full=(cutaway=false,reset=false)=>{h.apply(cutaway,true,reset);expect(h.batches.calls.at(-1)!.kind).toBe('set');};
  growth(world,1,.25);full(false,true);
  growth(world,1,.5);full(true);
  h.owner.clear();growth(world,1,.75);full(true);
  const other=new THREE.Group();growth(world,1,1);h.signature.read(world.structures,'','');
  h.owner.update(world,other,true,h.batches.asNative(),h.signature.flowerChanges(),true);h.signature.ackFurnitureBuild();
  expect(h.batches.calls.at(-1)!.kind).toBe('set');expect(h.batches.items).toEqual(laidOut(world,h.owner,true));
  full(true);world.structures.splice(4,1);full(true);
  world.structures[1]!.flower={allowSow:true};full(true);world.structures[1]=pot(102,8,8,.24);full(true);
  growth(world,1,.25);h.batches.rejectPatch=true;full(true);h.batches.rejectPatch=false;
  growth(world,1,.5);h.apply(true);expect(h.batches.calls.at(-1)!.kind).toBe('patch');
  const colorManagement=THREE.ColorManagement.enabled;
  try{THREE.ColorManagement.enabled=!colorManagement;growth(world,1,.75);full(true);}
  finally{THREE.ColorManagement.enabled=colorManagement;}
  growth(world,1,1);full(true); // Switching back also invalidates the captured color pipeline.
  world.width++;growth(world,1,.25);full(true);
  world.height++;growth(world,1,.5);full(true);
});

test('the signature collision without Core build/ACK cannot later authorize a flowers-only update',()=>{
  const world=camp(),h=pipeline(world);world.structures[0]!.x=-0;h.apply();
  const old=h.signature.read(world.structures,'','');world.structures[0]!.x=0;
  expect(h.signature.read(world.structures,'','')).toBe(old); // Real Core skips rebuilding on equal legacy text.
  growth(world,1,.25);h.signature.read(world.structures,'','');expect(h.signature.flowerChanges()).toBeUndefined();
  h.owner.update(world,h.group,false,h.batches.asNative(),h.signature.flowerChanges(),true);h.signature.ackFurnitureBuild();
  expect(h.batches.calls.at(-1)!.kind).toBe('set');expect(h.batches.items).toEqual(laidOut(world,h.owner));
});

test('a coincident sun-lamp schedule boundary changes its electrical pieces instead of reusing stale furniture',()=>{
  const world=camp();delete world.climate;delete world.gameProfile;world.tick=TICKS_PER_DAY/4;
  const lamp={...structure('sun-lamp',200),power:{on:true,parentId:null}};world.structures.push(lamp);
  const h=pipeline(world);expect(sunLampActive(world,lamp)).toBe(false);h.apply();
  world.tick++;growth(world,1,.25);expect(sunLampActive(world,lamp)).toBe(true);h.apply();
  expect(h.batches.calls.at(-1)!.kind).toBe('set');
  world.tick=Math.floor(TICKS_PER_DAY*.8);growth(world,4,.5);expect(sunLampActive(world,lamp)).toBe(false);h.apply();
  expect(h.batches.calls.at(-1)!.kind).toBe('set');
  world.climate={revision:1,profile:'temperate-reference',adoptedAt:world.tick,calendarOrigin:TICKS_PER_DAY*.5};
  growth(world,8,.75);expect(sunLampActive(world,lamp)).toBe(true);h.apply();expect(h.batches.calls.at(-1)!.kind).toBe('set');
});

test('a failed resident patch preserves the unacknowledged receipt and clears the owner before a successful full retry',()=>{
  const world=camp(),h=pipeline(world);h.apply();growth(world,1,.25);h.signature.read(world.structures,'','');
  const sentinel=new Error('actual resident patch throws'),original=h.batches.patchFurnitureBatch.bind(h.batches);
  h.batches.patchFurnitureBatch=()=>{throw sentinel;};
  expect(()=>h.owner.update(world,h.group,false,h.batches.asNative(),h.signature.flowerChanges(),true)).toThrow(sentinel);
  expect(h.signature.flowerChanges()).toEqual([1]); // ROOT's success-only ACK has not run.
  h.batches.patchFurnitureBatch=original;h.apply();expect(h.batches.calls.at(-1)!.kind).toBe('set');
  growth(world,4,.5);h.apply();expect(h.batches.calls.at(-1)!.kind).toBe('patch');
});

test('the mutable public full path preserves real getter/Proxy reads, holes and thrown values',()=>{
  const create=()=>{
    const trace:string[]=[],raw=camp();
    raw.structures=raw.structures.map(s=>new Proxy(s,{get(t,k,r){trace.push(`s${t.id}:${String(k)}`);return Reflect.get(t,k,r);}}));
    raw.structures=new Proxy(raw.structures,{get(t,k,r){trace.push(`structures:${String(k)}`);return Reflect.get(t,k,r);}});
    const world=new Proxy(raw,{get(t,k,r){trace.push(`world:${String(k)}`);return Reflect.get(t,k,r);}});return {trace,world,raw};
  };
  const left=create(),right=create(),a=new RecordingBatches(),b=new RecordingBatches(),owner=new FurniturePresentation(),group=new THREE.Group();
  const run=(throwing=false)=>{
    left.trace.length=right.trace.length=0;
    const caught=(f:()=>void)=>{try{f();return undefined;}catch(e){return e;}};
    const l=caught(()=>buildFurniture(left.world,group,false,a.asReference()));
    const r=caught(()=>owner.update(right.world,group,false,b.asNative(),[1],false));
    if(throwing){expect(r).toBe(l);}else{expect(r).toBeUndefined();expect(l).toBeUndefined();expect(b.items).toEqual(a.items);}
    expect(right.trace).toEqual(left.trace);
  };
  run();run();
  const sentinel=new Error('world packed getter');
  for(const object of [left.raw,right.raw])Object.defineProperty(object,'packed',{get(){throw sentinel;},configurable:true});run(true);
  for(const object of [left.raw,right.raw])Object.defineProperty(object,'packed',{value:[],writable:true,configurable:true});
  delete left.raw.structures[0];delete right.raw.structures[0];
  left.trace.length=right.trace.length=0;
  const errorName=(f:()=>void)=>{try{f();return undefined;}catch(e){return (e as Error).name;}};
  expect(errorName(()=>owner.update(right.world,group,false,b.asNative(),[1],false))).toBe(errorName(()=>buildFurniture(left.world,group,false,a.asReference())));
  expect(right.trace).toEqual(left.trace);
});
