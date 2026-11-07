import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/index';
import {FurniturePresentation} from '../src/render/FurnitureLayer';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';
import {FURNITURE_ZONE_SIZE} from '../src/render/furniture-zones';
import type {Structure,World} from '../src/sim/types';
import {laidOut,pot,RecordingBatches,structure} from './furniture-resident-fixtures';

const Z=FURNITURE_ZONE_SIZE;
/** Three by three zones; neighbour-aware structures straddle zone borders. */
function town():World {
  const world=createWorld(911,Z*3,Z*3);world.resources=[];world.packed=[];world.structures=[];
  let id=1000;const add=(kind:Structure['kind'],x:number,z:number,extra:Partial<Structure>={})=>{const s={...structure(kind,id++,x,z),...extra} as Structure;world.structures.push(s);return s;};
  // A wall run crossing the x border, a door at the border, a fence run and a
  // conduit run crossing the z border, a pen marker, a powered lamp and its battery.
  for(let x=Z-4;x<Z+4;x++)add('wall',x,10,{material:'steel'});
  add('door',Z,11);add('wall',Z,12,{material:'steel'});
  for(let z=Z-3;z<Z+3;z++){add('fence',40,z);add('power-conduit',44,z);}
  add('pen-marker',41,Z-2);add('fence-gate',40,Z+3);
  const battery=add('battery',50,Z-1);add('standing-lamp',52,Z+1,{power:{on:true,parentId:battery.id}});
  for(const [i,kind] of (['bed','table','stool','vent','grave','campfire','torch-lamp','research-bench','dresser','armchair'] as const).entries())add(kind,8+i*7,70);
  world.structures.push(pot(id++,70,40));
  return world;
}

function pipeline(world:World){
  const owner=new FurniturePresentation(),signature=new ConfirmedStructurePresentationSignature(),batches=new RecordingBatches(),group=new THREE.Group();
  const apply=(reset=false,cutaway=false)=>{
    signature.read(world.structures,'','',reset);
    const before=batches.calls.length;
    owner.update(world,group,cutaway,batches.asNative(),signature.flowerChanges(),true,signature.changedKinds());signature.ackFurnitureBuild();
    expect(batches.items).toEqual(laidOut(world,owner,cutaway));
    return batches.calls.slice(before).map(c=>c.kind);
  };
  return {owner,signature,batches,apply};
}
const id=(world:World,kind:Structure['kind'])=>world.structures.find(s=>s.kind===kind)!.id;

test('the zoned layout holds every historical placement, zone by zone, with reserved slots',()=>{
  const world=town(),h=pipeline(world);expect(h.apply()).toEqual(['set']);
  const layout=h.owner.layout()!;
  expect(layout.segments.length).toBeGreaterThan(4);
  for(const s of layout.segments){expect(s.capacity).toBeGreaterThanOrEqual(s.count+8);}
  expect(layout.segments.map(s=>s.start)).toEqual([...layout.segments.map(s=>s.start)].sort((a,b)=>a-b));
});

test('changes next to zone borders rewrite only the affected slots and stay exact',()=>{
  const world=town(),h=pipeline(world);h.apply();
  const writes=()=>h.batches.calls.at(-1)!;
  // A wall beside the door across the border: the door frame material follows.
  world.structures.push({...structure('wall',5000,Z-1,11),material:'steel'});expect(h.apply()).toEqual(['patch']);
  // Wood (drawn by the timber layer) instead of steel for that wall: a changed slot.
  world.structures.at(-1)!.material='wood';expect(h.apply()).toEqual(['patch']);
  // A fence joining the run across the z border, and a conduit next to the conduits.
  world.structures.push(structure('fence',5001,40,Z+3-1+1),structure('power-conduit',5002,45,Z));expect(h.apply().every(k=>k==='patch')).toBe(true);
  // Power: the lamp loses its parent, then the battery is removed from the middle of the array.
  const lamp=world.structures.find(s=>s.kind==='standing-lamp')!;lamp.power={on:false,parentId:null};expect(h.apply().every(k=>k==='patch')).toBe(true);
  lamp.power={on:true,parentId:id(world,'battery')};h.apply();
  world.structures.splice(world.structures.findIndex(s=>s.kind==='battery'),1);expect(h.apply().every(k=>k==='patch')).toBe(true);
  // A structure removed from the middle: its zone is rewritten with reserved slots.
  world.structures.splice(world.structures.findIndex(s=>s.kind==='dresser'),1);expect(h.apply()).toEqual(['patch']);
  expect(writes().count).toBeGreaterThan(0);
  // A packed parcel dropped then moved.
  world.packed=[{building:structure('table',6000,0,0),owner:{type:'ground',x:12,z:70}} as World['packed'][number]];expect(h.apply()).toEqual(['patch']);
  world.packed=[{building:structure('table',6000,0,0),owner:{type:'ground',x:30,z:72}} as World['packed'][number]];expect(h.apply()).toEqual(['patch']);
  // A change with no visible effect writes nothing.
  world.structures.push({...structure('sandbags',7000,90,90)});expect(h.apply()).toEqual([]);
});

test('an overflowing zone, a new zone, a reset or a cutaway lays the whole batch out again',()=>{
  const world=town(),h=pipeline(world);h.apply();
  const segment=h.owner.layout()!.segments[0]!,[zx,zz]=segment.key.split(':').map(Number) as [number,number];
  // Enough walls (2 parts each) in that zone to exceed its reserved slots.
  for(let i=0;i<segment.capacity;i++)world.structures.push({...structure('wall',8000+i,zx*Z+(i%Z),zz*Z+20+Math.floor(i/Z)),material:'steel'});
  expect(h.apply()).toEqual(['set']);
  // First furniture in an empty zone (x and z zones 2 and 0), then a second one there.
  expect(h.owner.layout()!.segments.some(g=>g.key==='2:0')).toBe(false);
  world.structures.push(structure('bed',9000,Z*3-4,4));expect(h.apply()).toEqual(['set']);
  world.structures.push(structure('table',9001,Z*3-8,4));expect(h.apply()).toEqual(['patch']);
  expect(h.apply(true)).toEqual(['set']);
  expect(h.apply(false,true)).toEqual(['set']);
});
