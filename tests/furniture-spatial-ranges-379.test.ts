import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {FurnitureSpatialRanges379,type FurnitureDrawRange379} from '../src/render/FurnitureSpatialRanges379';
import {FurniturePresentation} from '../src/render/FurnitureLayer';
import {RecordingBatches,camp,expected,growth,laidOut,pot} from './furniture-resident-fixtures';
import type {Placement} from '../src/render/primitives';

/** Commits F32 matrices, then independently encloses every transformed unit
 * cube corner. This is a producer contract, not a native GPU measurement. */
class SpatialRecorder extends RecordingBatches {
 matrices=new Float32Array();reads:{first:number;count:number}[]=[];
 ranges:readonly FurnitureDrawRange379[]|undefined;refuse=false;throwRead=false;clears=0;
 private commit():void {
  this.matrices=new Float32Array(this.items.length*16);const object=new THREE.Object3D();
  this.items.forEach((p,i)=>{object.position.set(p.x,p.y,p.z);object.rotation.set(0,p.ry??0,0);object.scale.set(p.sx??1,p.sy??1,p.sz??1);object.updateMatrix();object.matrix.toArray(this.matrices,i*16);});
 }
 override set(group:THREE.Group,key:string,items:Placement[]):void {super.set(group,key,items);if(key==='furniture')this.commit();}
 override patchFurniture(group:THREE.Group,key:string,start:number,items:Placement[],total:number,stamp?:object):boolean {const ok=super.patchFurniture(group,key,start,items,total,stamp);if(ok)this.commit();return ok;}
 readSpatialBounds(_group:THREE.Group,key:string,first:number,count:number):THREE.Box3|undefined {
  expect(key).toBe('furniture');this.reads.push({first,count});if(this.throwRead)throw Error('fixture bounds failure');
  const bounds=new THREE.Box3(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(let i=first;i<first+count;i++){matrix.fromArray(this.matrices,i*16);for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])bounds.expandByPoint(point.set(x,y,z).applyMatrix4(matrix));}
  return bounds;
 }
 setSpatialRanges(_group:THREE.Group,key:string,ranges:readonly FurnitureDrawRange379[]|undefined):boolean {expect(key).toBe('furniture');this.ranges=ranges;if(ranges===undefined)this.clears++;return !this.refuse;}
}

test('real furniture layout retains every original slot and refreshes only committed changed-zone bounds',()=>{
 const world=camp();world.width=96;world.height=96;world.tiles=Array.from({length:96*96},()=>({terrain:'grass'}));world.structures.push(pot(200,70,70));
 const group=new THREE.Group(),batches=new SpatialRecorder(),owner=new FurniturePresentation();
 owner.update(world,group,false,batches.asNative(),undefined,true);
 expect(batches.ranges).toHaveLength(2);expect(batches.items).toEqual(laidOut(world,owner));
 const layout=owner.layout()!,ranges=batches.ranges!;
 expect(ranges.map(r=>({first:r.first,count:r.count}))).toEqual(layout.segments.map(s=>({first:s.start,count:s.capacity})));
 expect(ranges.reduce((n,r)=>n+r.count,0)).toBe(batches.items.length);
 for(const range of ranges)expect(range.bounds.equals(batches.readSpatialBounds(group,'furniture',range.first,range.count)!)).toBe(true);
 batches.reads=[];growth(world,1,.5);owner.update(world,group,false,batches.asNative(),[1],true);
 expect(batches.calls.at(-1)!.kind).toBe('patch');expect(batches.items).toEqual(laidOut(world,owner));
 expect(batches.reads).toHaveLength(1);expect(batches.ranges![1]!.bounds).toBe(ranges[1]!.bounds);
 expect(batches.ranges!.map(r=>({first:r.first,count:r.count}))).toEqual(ranges.map(r=>({first:r.first,count:r.count})));
 owner.update(world,group,false,batches.asNative(),undefined,false);
 expect(batches.ranges).toBeUndefined();expect(batches.items).toEqual(expected(world));
});

test('group replacement and producer failure retire prior spatial authority without retaining a partial binding',()=>{
 const owner=new FurnitureSpatialRanges379(),a=new SpatialRecorder(),b=new SpatialRecorder(),ga=new THREE.Group(),gb=new THREE.Group();
 const items=[{x:1,y:.2,z:2,sx:.3,sy:.4,sz:.7},{x:50,y:.1,z:55,sx:.2,sy:.2,sz:.2}],segments=[{key:'a',start:0,capacity:1},{key:'b',start:1,capacity:1}];
 a.set(ga,'furniture',items);b.set(gb,'furniture',items);expect(owner.update(ga,a,segments,2)).toBe(true);
 expect(owner.update(gb,b,segments,2)).toBe(true);expect(a.ranges).toBeUndefined();
 b.throwRead=true;expect(()=>owner.update(gb,b,segments,2)).toThrow('fixture bounds failure');expect(b.ranges).toBeUndefined();
 b.throwRead=false;expect(owner.update(gb,b,segments,2)).toBe(true);owner.clear();expect(b.ranges).toBeUndefined();
});

test('missing/refused producers, incomplete intervals and invalid committed bounds retain full draw fallback',()=>{
 const owner=new FurnitureSpatialRanges379(),batches=new SpatialRecorder(),group=new THREE.Group();batches.set(group,'furniture',[{x:1,y:0,z:1},{x:2,y:0,z:2}]);
 expect(owner.update(group,batches,[{key:'all',start:0,capacity:2}],2)).toBe(true);
 expect(owner.update(group,batches,[{key:'gap',start:1,capacity:1}],2)).toBe(false);expect(batches.ranges).toBeUndefined();
 expect(owner.update(group,batches,[{key:'short',start:0,capacity:1}],2)).toBe(false);expect(batches.ranges).toBeUndefined();
 batches.refuse=true;expect(owner.update(group,batches,[{key:'all',start:0,capacity:2}],2)).toBe(false);expect(batches.ranges).toBeUndefined();
 batches.refuse=false;expect(owner.update(group,batches,[{key:'all',start:0,capacity:2}],2)).toBe(true);
 batches.matrices[12]=NaN;expect(owner.update(group,batches,[{key:'all',start:0,capacity:2}],2)).toBe(false);expect(batches.ranges).toBeUndefined();
 batches.set(group,'furniture',[{x:1,y:0,z:1},{x:2,y:0,z:2}]);expect(owner.update(group,batches,[{key:'all',start:0,capacity:2}],2)).toBe(true);
 expect(owner.update(group,{},[{key:'all',start:0,capacity:2}],2)).toBe(false);expect(batches.ranges).toBeUndefined();
});
