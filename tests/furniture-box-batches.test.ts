import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {BoxBatches as Reference} from '../src/render/BoxBatches';
import {BoxBatches} from '../src/render/BoxBatches';
import {FurniturePresentation} from '../src/render/FurnitureLayer';
import {StructurePresentationSignature} from '../src/render/presentation-signatures';
import {buildFurniture} from '../src/render/FurnitureLayer';
import type {Placement} from '../src/render/primitives';
import {boxState,camp,expected,growth,laidOut,layout,mesh} from './furniture-resident-fixtures';
import {sandbagParts} from '../src/render/sandbag-parts';

test('successive six-piece patches retain one mesh, global F32 order, all resident bytes and exact ordered bounds',()=>{
  const world=camp(),a=new Reference(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group();
  try{
    let parts=expected(world);a.set(ga,'furniture',parts);b.set(gb,'furniture',parts);
    const m=mesh(gb),resident={mesh:m,matrix:m.instanceMatrix,color:m.colorBuffer,geometry:m.geometry,material:m.material};
    for(const [index,value,hp] of [[1,.25,85],[4,.5,85],[8,.75,0],[1,1,85],[4,.75,0]]){
      growth(world,index!,value!,hp);const next=expected(world),id=world.structures[index!]!.id;
      const start=parts.findIndex(p=>p.key===id),replacement=next.filter(p=>p.key===id);
      expect(replacement).toHaveLength(6);expect(start).toBeGreaterThanOrEqual(0);
      a.set(ga,'furniture',next);expect(b.patchFurniture(gb,'furniture',start,replacement,next.length,b.furnitureStamp()!)).toBe(true);
      expect(boxState(gb)).toEqual(boxState(ga));layout(ga);layout(gb);
      expect(mesh(gb)).toBe(resident.mesh);expect(m.instanceMatrix).toBe(resident.matrix);
      expect(m.colorBuffer).toBe(resident.color);expect(m.geometry).toBe(resident.geometry);expect(m.material).toBe(resident.material);parts=next;
    }
  }finally{a.dispose();b.dispose();}
});

test('the actual resident Furniture owner and true BoxBatches agree with the zoned historical placements over three distinct pot updates',()=>{
  const world=camp(),a=new Reference(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group(),owner=new FurniturePresentation(),s=new StructurePresentationSignature();
  const apply=()=>{
    s.read(world.structures,'','');owner.update(world,gb,false,b,s.flowerChanges(),true);s.ackFurnitureBuild();a.set(ga,'furniture',laidOut(world,owner));a.set(ga,'sandbags',sandbagParts(world));
    expect(boxState(gb)).toEqual(boxState(ga));layout(gb);
  };
  try{apply();for(const index of [1,4,8]){growth(world,index,.25);apply();}growth(world,1,.5);growth(world,4,.75);apply();}
  finally{owner.clear();a.dispose();b.dispose();}
});

test('two simultaneous spans perform one matrix/color revision and exact ordered sphere fold; a later invalid range writes nothing',()=>{
  const world=camp(),a=new Reference(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group();
  try{
    const original=expected(world);a.set(ga,'furniture',original);b.set(gb,'furniture',original);
    growth(world,1,.5);growth(world,4,.75,0);const next=expected(world);
    const patches=[1,4].map(index=>{const id=world.structures[index]!.id;return {start:original.findIndex(p=>p.key===id),items:next.filter(p=>p.key===id)};});
    expect(patches.map(p=>p.items.length)).toEqual([6,6]);
    const m=mesh(gb),versions=[m.instanceMatrix.version,m.colorBuffer.version],stamp=b.furnitureStamp()!;
    const before=boxState(gb);
    expect(b.patchFurnitureBatch(gb,'furniture',[patches[0]!,{start:next.length,items:patches[1]!.items}],next.length,stamp)).toBe(false);
    expect(boxState(gb)).toEqual(before);
    expect(b.patchFurnitureBatch(gb,'furniture',[patches[1]!,patches[0]!],next.length,stamp)).toBe(false);expect(boxState(gb)).toEqual(before);
    expect(b.patchFurnitureBatch(gb,'furniture',[patches[0]!,patches[0]!],next.length,stamp)).toBe(false);expect(boxState(gb)).toEqual(before);
    a.set(ga,'furniture',next);expect(b.patchFurnitureBatch(gb,'furniture',patches,next.length,stamp)).toBe(true);
    expect([m.instanceMatrix.version,m.colorBuffer.version]).toEqual(versions.map(v=>v+1));
    expect(boxState(gb)).toEqual(boxState(ga));layout(gb);expect(b.furnitureStamp()).toBe(stamp);
  }finally{a.dispose();b.dispose();}
});

test('patch rejects absent/wrong group/key/count/span without writes and does not disturb allocations, neighboring batches or texture pipelines',()=>{
  const a=new Reference(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group();
  const items:Placement[]=Array.from({length:257},(_,i)=>({x:i*.137,y:.1+i%7*.041,z:i%13,sx:.33,sy:.29,sz:.71,ry:(i%4)*Math.PI/2,color:0x64747a}));
  try{
    expect(b.patchFurniture(gb,'furniture',0,items.slice(0,6),6,{})).toBe(false);
    for(const count of [0,1,256,257,6]){a.set(ga,'furniture',items.slice(0,count));b.set(gb,'furniture',items.slice(0,count));expect(boxState(gb)).toEqual(boxState(ga));}
    const m=mesh(gb),before=boxState(gb),otherGroup=new THREE.Group();
    for(const [group,key,start,total] of [[otherGroup,'furniture',0,6],[gb,'wrong',0,6],[gb,'furniture',0,7],[gb,'furniture',-1,6],[gb,'furniture',.5,6],[gb,'furniture',2,6]] as const){
      expect(b.patchFurniture(group,key,start,items.slice(0,6),total,b.furnitureStamp()!)).toBe(false);expect(boxState(gb)).toEqual(before);
    }
    const stale=b.furnitureStamp()!;a.set(ga,'furniture',items.slice(0,6));b.set(gb,'furniture',items.slice(0,6));
    const afterFull=boxState(gb);expect(b.patchFurniture(gb,'furniture',0,items.slice(7,13),6,stale)).toBe(false);
    expect(boxState(gb)).toEqual(afterFull);
    b.set(otherGroup,'neighbor',items.slice(0,1));const neighbor=otherGroup.children[0] as THREE.Mesh;
    const neighborGeometry=neighbor.geometry;let disposed=0;neighborGeometry.addEventListener('dispose',()=>disposed++);
    const originalMaterial=m.material;b.setTexturesEnabled(false);const plainMaterial=m.material;expect(plainMaterial).not.toBe(originalMaterial);
    a.setTexturesEnabled(false);expect(b.patchFurniture(gb,'furniture',0,items.slice(17,23),6,b.furnitureStamp()!)).toBe(true);
    a.set(ga,'furniture',items.slice(17,23));expect(boxState(gb)).toEqual(boxState(ga));expect(m.material).toBe(plainMaterial);
    b.setTexturesEnabled(true);a.setTexturesEnabled(true);expect(m.material).toBe(originalMaterial);
    a.set(ga,'furniture',items);b.set(gb,'furniture',items);expect(disposed).toBe(0);expect(neighbor.geometry).toBe(neighborGeometry);
    expect(m.geometry.getAttribute('position')).not.toBe(neighbor.geometry.getAttribute('position'));
    expect(m.geometry.index).not.toBe(neighbor.geometry.index);expect(boxState(gb)).toEqual(boxState(ga));
    b.clear();expect(gb.children).toHaveLength(0);expect(otherGroup.children).toHaveLength(0);expect(disposed).toBe(1);
    expect(b.furnitureStamp()).toBeUndefined();expect(b.patchFurniture(gb,'furniture',0,items.slice(0,6),6,stale)).toBe(false);
  }finally{a.dispose();b.dispose();}
});

test('real empty-shadow restoration never overwrites an interposed logical adoption or patch even when the new count is one',()=>{
  const a=new Reference(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group();
  const first=[{x:17.125,y:.37,z:3.375,sx:.27,sy:.19,sz:.53,ry:Math.PI/2,color:0x54733d}];
  const second=[{...first[0]!,x:21.625,y:.49,color:0x796641}];
  try{
    a.set(ga,'furniture',first);b.set(gb,'furniture',first);a.set(ga,'furniture',[]);b.set(gb,'furniture',[]);
    const original=boxState(gb),ra=a.prepareEmptyShadows(),rb=b.prepareEmptyShadows();expect(mesh(gb).activeCount).toBe(1);
    ra();rb();expect(boxState(gb)).toEqual(boxState(ga));
    expect((boxState(gb) as {matrix:number[]}).matrix).toEqual((original as {matrix:number[]}).matrix);
    const restoreA=a.prepareEmptyShadows(),restoreB=b.prepareEmptyShadows();
    a.set(ga,'furniture',second);b.set(gb,'furniture',second);const adopted=boxState(gb);
    restoreA();restoreB();expect(mesh(gb).activeCount).toBe(1);expect(boxState(gb)).toEqual(adopted);expect(boxState(gb)).toEqual(boxState(ga));
    a.set(ga,'furniture',[]);b.set(gb,'furniture',[]);const guardA=a.prepareEmptyShadows(),guardB=b.prepareEmptyShadows();
    // This is the actual historical failure shape: both sides temporarily have
    // count one, a logical writer replaces its matrix, then the older callback runs.
    a.set(ga,'furniture',first);expect(b.patchFurniture(gb,'furniture',0,first,1,b.furnitureStamp()!)).toBe(true);
    const patched=boxState(gb);guardA();guardB();expect(mesh(gb).activeCount).toBe(1);
    expect(boxState(gb)).toEqual(patched);expect(boxState(gb)).toEqual(boxState(ga));
    a.set(ga,'furniture',[]);b.set(gb,'furniture',[]);const clearA=a.prepareEmptyShadows(),clearB=b.prepareEmptyShadows();
    a.clear();b.clear();a.set(ga,'furniture',second);b.set(gb,'furniture',second);
    clearA();clearB();expect(boxState(gb)).toEqual(boxState(ga));expect(mesh(gb).activeCount).toBe(1);
  }finally{a.dispose();b.dispose();}
});
