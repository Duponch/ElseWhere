import {expect,test} from 'vitest';
import type {Resource,World} from '../src/sim/types';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';
import type {Placement} from '../src/render/primitives';

function record(seed=123):World{return {seed,width:32,height:32,structures:[],growingZones:[]} as unknown as World;}
function tree(id=41,species:Resource['species']='oak'):Resource{return {id,kind:'tree',species,x:8,z:8,amount:1,growth:1};}
function placements(library:ReferenceFloraLibrary,world:World,resource:Resource,canopy:boolean):Placement[]{
  const batch=library.createBatch();expect(batch.append(world,resource,.42,1)).toBe(true);
  const parts=batch.parts(canopy);try{return parts.flatMap(part=>part.items.map(item=>({...item})));}finally{for(const part of parts)part.geometry.dispose();}
}

test('tree crowns vary per source group deterministically while wood keeps one common transform',()=>{
  const library=new ReferenceFloraLibrary(),world=record(),resource=tree();
  try{
    const first=placements(library,world,resource,true);
    expect(placements(library,structuredClone(world),structuredClone(resource),true)).toEqual(first);
    expect(placements(library,world,tree(42),true)).not.toEqual(first);
    const ratios=first.map(p=>p.sy!/p.sx!);
    expect(Math.max(...ratios)-Math.min(...ratios)).toBeLessThan(1e-12);
    expect(new Set(first.map(p=>p.sx))).toHaveProperty('size',5);
    const wood=placements(library,world,resource,false);
    expect(wood.every(p=>p.x===resource.x&&p.y===0&&p.z===resource.z&&p.ry===.42)).toBe(true);
    expect(new Set(wood.map(p=>p.sx)).size).toBe(1);expect(new Set(wood.map(p=>p.sy)).size).toBe(1);
    const poplar=placements(library,world,tree(53,'poplar'),true),fins=poplar.slice(-4);
    expect(fins).toHaveLength(4);for(const fin of fins)expect(fin).toEqual(fins[0]);
  }finally{library.dispose();}
});

test('procedural crown placement neither reads simulation RNG nor changes source records or UVs',()=>{
  const library=new ReferenceFloraLibrary(),world=record(),resource=tree(),before=JSON.stringify({world,resource});
  const protectedWorld=new Proxy(world,{get(target,key,receiver){if(typeof key==='string'&&/rng|random/i.test(key))throw Error('Presentation read simulation RNG');return Reflect.get(target,key,receiver);}});
  try{
    const original=library.recipe('oak').parts.map(part=>Array.from(part.geometry.getAttribute('uv').array));
    const first=placements(library,protectedWorld,resource,true);
    expect(first.every(p=>p.targetId===resource.id&&p.key===-resource.id*2&&p.rawGeometry&&Number.isInteger(p.profile))).toBe(true);
    placements(library,record(124),tree(70,'pine'),true);
    expect(placements(library,protectedWorld,resource,true)).toEqual(first);
    expect(JSON.stringify({world,resource})).toBe(before);
    expect(library.recipe('oak').parts.map(part=>Array.from(part.geometry.getAttribute('uv').array))).toEqual(original);
  }finally{library.dispose();}
});
