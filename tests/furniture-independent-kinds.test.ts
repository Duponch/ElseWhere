import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/index';
import {footprintCells} from '../src/sim/definitions';
import {FurniturePresentation,FURNITURE_INDEPENDENT_KINDS} from '../src/render/FurnitureLayer';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';
import {sandbagParts} from '../src/render/sandbag-parts';
import type {Structure,World} from '../src/sim/types';
import {expected,laidOut,pot,RecordingBatches,structure} from './furniture-resident-fixtures';

// Neighbour-aware producers (walls, doors, fences, pens, conduits, vents…) and
// ordinary furniture, spaced on a grid so sandbags can touch each of them.
const KINDS:Structure['kind'][]=['wall','door','autodoor','fence','fence-gate','pen-marker','vent','power-conduit','power-switch','battery',
  'heater','cooler','passive-cooler','standing-lamp','sun-lamp','torch-lamp','campfire','bed','double-bed','bedroll','table','stool','armchair',
  'dresser','end-table','shelf','grave','hydroponics-basin','wind-turbine','solar-generator','wood-generator','research-bench','tailor-bench',
  'fueled-stove','electric-stove','butcher-table','crafting-spot','stonecutter','spike-trap','mini-turret','horseshoes','chess-table','tube-television',
  'nutrient-paste-dispenser','hopper'];

function varied():World {
  const world=createWorld(503,64,64);world.resources=[];world.packed=[];world.structures=[];
  let id=1000;
  KINDS.forEach((kind,i)=>{const x=3+(i%9)*6,z=3+Math.floor(i/9)*6;world.structures.push(structure(kind,id++,x,z));});
  // A wall run, a fence run and a conduit run, so connections are exercised.
  for(let x=10;x<16;x++){world.structures.push(structure('wall',id++,x,40),structure('fence',id++,x,44),structure('power-conduit',id++,x,48));}
  world.structures.push(pot(id++,30,40),structure('door',id++,16,40),structure('fence-gate',id++,16,44));
  return world;
}

/** Sandbags on every free cell touching a structure (8-neighbourhood). */
function withSandbags(world:World,firstId:number):World {
  const next=structuredClone(world),taken=new Set<number>();
  for(const s of world.structures)for(const c of footprintCells(s))taken.add(c.z*world.width+c.x);
  let id=firstId;
  for(const s of world.structures)for(const c of footprintCells(s))for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const x=c.x+dx,z=c.z+dz,cell=z*world.width+x;
    if(x<0||z<0||x>=world.width||z>=world.height||taken.has(cell))continue;
    taken.add(cell);next.structures.push(structure('sandbags',id++,x,z));
  }
  return next;
}

test('sandbags are the only independent kind and draw no furniture placement',()=>{
  expect([...FURNITURE_INDEPENDENT_KINDS]).toEqual(['sandbags']);
  const world=varied(),bagged=withSandbags(world,90000);
  expect(bagged.structures.length-world.structures.length).toBeGreaterThan(300);
  expect(sandbagParts(bagged).length).toBeGreaterThan(0);
  for(const cutaway of [false,true]){
    const base=expected(world,cutaway);expect(base.length).toBeGreaterThan(100);
    // Added anywhere, touching every kind: no furniture placement changes.
    expect(expected(bagged,cutaway)).toEqual(base);
    // Removed again, from the middle of the array: identical too.
    const removed=structuredClone(bagged);removed.structures=removed.structures.filter((s,i)=>s.kind!=='sandbags'||i%2===0);
    const kept=structuredClone(world);kept.structures=removed.structures.filter(s=>s.kind!=='sandbags');
    expect(expected(removed,cutaway)).toEqual(expected(kept,cutaway));
  }
});

function pipeline(world:World){
  const owner=new FurniturePresentation(),signature=new ConfirmedStructurePresentationSignature(),batches=new RecordingBatches(),group=new THREE.Group();
  let sandbagSets=0;const set=batches.set.bind(batches);
  batches.set=(g:THREE.Group,key:string,items)=>{if(key==='sandbags')sandbagSets++;set(g,key,items);};
  const full=(cutaway=false)=>{owner.update(world,group,cutaway,batches.asNative(),signature.flowerChanges(),true);signature.ackFurnitureBuild();};
  const fast=(cutaway=false)=>{const kinds=signature.changedKinds();const done=!!kinds&&owner.updateIndependent(world,group,cutaway,batches.asNative(),kinds);if(done)signature.ackFurnitureBuild();return done;};
  return {owner,signature,batches,group,full,fast,sandbagSets:()=>sandbagSets};
}

test('a change limited to sandbags rebuilds only their batch; anything else keeps the full build',()=>{
  const world=varied(),h=pipeline(world);
  h.signature.read(world.structures,'','');expect(h.signature.changedKinds()).toBeUndefined(); // No build yet.
  h.full();expect(h.batches.calls).toHaveLength(1);expect(h.signature.changedKinds()).toEqual(new Set());

  // A new sandbag at the end of the array: only the sandbag batch is rebuilt.
  world.structures.push(structure('sandbags',90000,11,41));
  h.signature.read(world.structures,'','');expect(h.signature.changedKinds()).toEqual(new Set(['sandbags']));
  const sets=h.sandbagSets();expect(h.fast()).toBe(true);
  expect(h.sandbagSets()).toBe(sets+1);expect(h.batches.calls).toHaveLength(1);expect(h.batches.items).toEqual(laidOut(world,h.owner));

  // A changed sandbag material (same slot): still independent.
  world.structures.at(-1)!.material='cloth';h.signature.read(world.structures,'','');expect(h.fast()).toBe(true);

  // A wall: the furniture batch must be rebuilt.
  world.structures.push(structure('wall',90001,20,41));h.signature.read(world.structures,'','');
  expect(h.signature.changedKinds()).toEqual(new Set(['wall']));expect(h.fast()).toBe(false);
  h.full();expect(h.batches.calls).toHaveLength(2);expect(h.batches.items).toEqual(laidOut(world,h.owner));

  // A sandbag inserted in the middle shifts later slots: other kinds appear.
  world.structures.splice(5,0,structure('sandbags',90002,1,1));h.signature.read(world.structures,'','');
  expect(h.fast()).toBe(false);h.full();

  // Door axes or packed furniture change, or a reset read: no kind receipt.
  world.structures.push(structure('sandbags',90003,2,1));h.signature.read(world.structures,'axes','');expect(h.signature.changedKinds()).toBeUndefined();expect(h.fast()).toBe(false);h.full();
  world.structures.push(structure('sandbags',90004,3,1));h.signature.read(world.structures,'axes','packed');expect(h.signature.changedKinds()).toBeUndefined();h.full();
  world.structures.push(structure('sandbags',90005,4,1));h.signature.read(world.structures,'axes','packed',true);expect(h.signature.changedKinds()).toBeUndefined();h.full();

  // Other cutaway, other group or no owned batch: no shortcut.
  world.structures.push(structure('sandbags',90006,5,1));h.signature.read(world.structures,'axes','packed');
  expect(h.fast(true)).toBe(false);
  expect(h.owner.updateIndependent(world,new THREE.Group(),false,h.batches.asNative(),new Set(['sandbags']))).toBe(false);
  h.owner.clear();expect(h.fast()).toBe(false);h.full();expect(h.batches.items).toEqual(laidOut(world,h.owner));
});

test('a sun lamp that changed state since the furniture build forces the full build',()=>{
  const world=varied(),h=pipeline(world),lamp=world.structures.find(s=>s.kind==='sun-lamp')!;
  lamp.power={on:false,parentId:null};
  h.signature.read(world.structures,'','');h.full();
  world.structures.push(structure('sandbags',90000,11,41));
  // The power state is part of the signature: the changed kinds include it.
  lamp.power={on:true,parentId:null};h.signature.read(world.structures,'','');
  expect(h.signature.changedKinds()).toEqual(new Set(['sandbags','sun-lamp']));expect(h.fast()).toBe(false);
  h.full();expect(h.batches.items).toEqual(laidOut(world,h.owner));
});
