import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {BoxBatches} from '../src/render/BoxBatches';
import {BoxMesh} from '../src/render/BoxMesh';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {PREPARED_SURFACE_VARIANT} from '../src/render/origami/baked/surfaces/PreparedSurfaceOwner';
import type {OwnedOpaqueProducer435} from '../src/render/OwnedOpaqueRevisionRegistry435';
import type {Placement} from '../src/render/primitives';

const KEY='pile:0:0',REFERENCE='reference';
const meshes=(g:THREE.Group)=>g.children.filter((c):c is BoxMesh=>c instanceof BoxMesh&&!c.name.endsWith('-warm'));
const bitArray=(a:ArrayBufferView)=>Array.from(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
function state(boxes:BoxBatches,g:THREE.Group){
 const counts=(boxes as unknown as {preparedBatchCounts:Map<BoxMesh,Map<number,number>>}).preparedBatchCounts;
 return meshes(g).map(m=>({
  key:m.name.replace(KEY,'').replace(REFERENCE,''),count:m.activeCount,capacity:m.instanceMatrix.count,
  matrix:bitArray(m.instanceMatrix.array),color:bitArray(m.colorBuffer.array),atlas:m.itemShapeBuffer?bitArray(m.itemShapeBuffer.array):undefined,
  contour:m.geometry.hasAttribute('chunkContour')?bitArray(m.geometry.getAttribute('chunkContour').array):undefined,
  prepared:m.geometry.hasAttribute(PREPARED_SURFACE_VARIANT)?bitArray(m.geometry.getAttribute(PREPARED_SURFACE_VARIANT).array):undefined,
  counts:[...counts.get(m)??[]],sphere:{center:m.boundingSphere.center.toArray(),radius:m.boundingSphere.radius},
  visible:m.visible,castShadow:m.castShadow,receiveShadow:m.receiveShadow,
 })).sort((a,b)=>a.key.localeCompare(b.key));
}
const item=(i:number,shape:Placement['shape']='item-nugget'):Placement=>({x:i*.137,y:.3+i%3*.04,z:i%7,sx:.37,sy:.29,sz:.61,ry:(i%4)*Math.PI/2,color:0x718d99,key:i+22,targetId:i%3,shape});
const fixture=()=>[item(0),item(1,'item-log'),item(2),item(3,'item-shirt'),{...item(4,'rounded-rock'),sx:.8},item(5,'rounded-rock'),item(6),item(7,'item-log')];

test('pile diffs match the historical full writer for every resident byte, ordered bound, atlas ordinal and prepared variant count',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0});
 const a=withGraphicsStyle(context,()=>new BoxBatches()),b=withGraphicsStyle(context,()=>new BoxBatches()),ga=new THREE.Group(),gb=new THREE.Group();
 const apply=(items:Placement[])=>{a.set(ga,REFERENCE,items);b.set(gb,KEY,items);expect(state(b,gb)).toEqual(state(a,ga));};
 try{
  let items=fixture();apply(items);const resident=meshes(gb).map(m=>({m,g:m.geometry,matrix:m.instanceMatrix,color:m.colorBuffer,atlas:m.itemShapeBuffer}));
  apply(items.map(p=>({...p})));items[2]!.color=0x849329;apply(items); // same mutable input array
  items[3]!.targetId=2;items[3]!.shape='item-pants';apply(items);
  items[1]!.sy=.43;items[4]!.key=441;apply(items);
  items=[item(8),...items];apply(items);items.splice(3,1);apply(items);items.reverse();apply(items);
  a.setTargetPreview(ga,new Set([2]));b.setTargetPreview(gb,new Set([2]));expect(state(b,gb)).toEqual(state(a,ga));
  items[1]!.color=0x563a2a;items[0]!.targetId=2;apply(items);
  a.clearTargetPreview();b.clearTargetPreview();expect(state(b,gb)).toEqual(state(a,ga));
  a.setTexturesEnabled(false);b.setTexturesEnabled(false);apply(items);a.setTexturesEnabled(true);b.setTexturesEnabled(true);apply(items);
  for(const r of resident){expect(r.m.geometry).toBe(r.g);expect(r.m.instanceMatrix).toBe(r.matrix);expect(r.m.colorBuffer).toBe(r.color);expect(r.m.itemShapeBuffer).toBe(r.atlas);}
  apply([]);apply(fixture());apply(Array.from({length:300},(_,i)=>item(i)));apply(fixture());apply([]);
 }finally{a.dispose();b.dispose();context.dispose();}
});

test('unchanged pile slots avoid transforms, bounds, uploads and opaque receipts; colour and target changes preserve current previews',()=>{
 const known=new Set<THREE.Mesh>(),receipts=new Map<THREE.Mesh,number>();
 const producer:OwnedOpaqueProducer435={register(m){known.add(m);},dirty(m){if(known.has(m))receipts.set(m,(receipts.get(m)??0)+1);},forget(m){known.delete(m);}};
 const boxes=new BoxBatches(undefined,producer),g=new THREE.Group(),items=fixture();
 try{
  boxes.set(g,KEY,items);const m=meshes(g).find(m=>m.itemShapeBuffer&&m.activeCount>1)!;
  const writes=vi.spyOn(m,'setMatrixAt'),bounds=vi.spyOn(m,'computeBoundingSphere'),versions=[m.instanceMatrix.version,m.colorBuffer.version,m.itemShapeBuffer!.version],revision=receipts.get(m);
  boxes.setTargetPreview(g,new Set([2]));const tinted=bitArray(m.colorBuffer.array),selectedRevision=receipts.get(m);
  boxes.set(g,KEY,items.map(p=>({...p})));
  expect(writes).not.toHaveBeenCalled();expect(bounds).not.toHaveBeenCalled();expect(bitArray(m.colorBuffer.array)).toEqual(tinted);
  expect([m.instanceMatrix.version,m.itemShapeBuffer!.version]).toEqual([versions[0],versions[2]]);expect(receipts.get(m)).toBe(selectedRevision);
  items[2]!.color=0xb48532;boxes.set(g,KEY,items);expect(writes).not.toHaveBeenCalled();expect(bounds).not.toHaveBeenCalled();expect(receipts.get(m)).toBeGreaterThan(revision!);
  items[2]!.x+=.125;boxes.set(g,KEY,items);expect(writes).toHaveBeenCalledTimes(1);expect(bounds).toHaveBeenCalledTimes(1);
  expect(m.matrixAutoUpdate).toBe(false);expect(m.matrix.equals(new THREE.Matrix4())).toBe(true);
 }finally{boxes.dispose();}
});

test('empty shadow receipts preserve an interposed adoption, stable capacity and an exact later full rewrite',()=>{
 const a=new BoxBatches(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group();
 const apply=(p:Placement[])=>{a.set(ga,REFERENCE,p);b.set(gb,KEY,p);expect(state(b,gb)).toEqual(state(a,ga));};
 try{
  apply(fixture());apply([]);const ra=a.prepareEmptyShadows(),rb=b.prepareEmptyShadows();
  apply([item(17)]);const adopted=state(b,gb);ra();rb();expect(state(b,gb)).toEqual(adopted);expect(state(b,gb)).toEqual(state(a,ga));
  apply([]);const cleanA=a.prepareEmptyShadows(),cleanB=b.prepareEmptyShadows();cleanA();cleanB();expect(state(b,gb)).toEqual(state(a,ga));
  apply([item(20)]);apply([]);const anotherA=a.prepareEmptyShadows(),anotherB=b.prepareEmptyShadows();
  apply([]);anotherA();anotherB();expect(state(b,gb)).toEqual(state(a,ga));apply(fixture());
 }finally{a.dispose();b.dispose();}
});

test('owned pile ranges retain every outstanding GPU component and exact ordered sphere prefixes',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0});
 const producer:OwnedOpaqueProducer435={register(){},dirty(){},forget(){}};
 const a=withGraphicsStyle(context,()=>new BoxBatches()),b=withGraphicsStyle(context,()=>new BoxBatches(undefined,producer)),ga=new THREE.Group(),gb=new THREE.Group();
 type Attribute=THREE.BufferAttribute|THREE.InterleavedBuffer;
 const gpu=new Map<Attribute,{version:number;values:Float32Array}>();
 // Emulate the renderer's initial complete upload and subsequent union of
 // component ranges. Culled/admission-only writes do not drain those ranges.
 const upload=()=>{
  for(const m of meshes(gb)){
   const attributes:Attribute[]=[m.instanceMatrix,m.colorBuffer];
   if(m.itemShapeBuffer)attributes.push(m.itemShapeBuffer);
   for(const k of ['chunkContour',PREPARED_SURFACE_VARIANT])if(m.geometry.hasAttribute(k))attributes.push(m.geometry.getAttribute(k) as THREE.BufferAttribute);
   for(const attr of attributes){
    const data=attr.array as Float32Array,held=gpu.get(attr);
    if(!held)gpu.set(attr,{version:attr.version,values:data.slice()});
    else if(held.version!==attr.version){if(!attr.updateRanges.length)held.values.set(data);
     else for(const {start,count}of attr.updateRanges)held.values.set(data.subarray(start,start+count),start);held.version=attr.version;}
    attr.clearUpdateRanges();expect(bitArray(gpu.get(attr)!.values)).toEqual(bitArray(data));
   }
  }
 };
 const apply=(items:Placement[])=>{a.set(ga,REFERENCE,items);b.set(gb,KEY,items);expect(state(b,gb)).toEqual(state(a,ga));};
 try{
  let items=Array.from({length:100},(_,i)=>item(i));apply(items);upload();
  const mesh=meshes(gb).find(m=>m.activeCount===100)!;expect(mesh).toBeDefined();
  const read=vi.spyOn(mesh,'getMatrixAt');
  items[90]!.x+=.37;apply(items);
  expect(read).toHaveBeenCalledTimes(10);expect(mesh.instanceMatrix.updateRanges).toEqual([{start:90*16,count:16}]);
  items[95]!.z+=.51;items[13]!.color=0x555718;apply(items);
  // Two admissions while culled must leave the first write covered as well.
  expect(mesh.instanceMatrix.updateRanges).toEqual([{start:90*16,count:6*16}]);
  expect(mesh.colorBuffer.updateRanges).toEqual([{start:13*3,count:3}]);
  a.setTargetPreview(ga,new Set([1]));b.setTargetPreview(gb,new Set([1]));
  items[96]!.sy=.73;items[14]!.color=0x992911;items[14]!.targetId=1;apply(items);
  a.clearTargetPreview();b.clearTargetPreview();expect(state(b,gb)).toEqual(state(a,ga));upload();
  items=items.slice(0,60);apply(items);upload();
  items=[...items,...Array.from({length:260},(_,i)=>item(i+60))];apply(items);
  items[200]!.x+=1;apply(items);upload(); // pending complete writer + sparse update
  apply([]);upload();const restoreA=a.prepareEmptyShadows(),restoreB=b.prepareEmptyShadows();
  apply([item(500)]);restoreA();restoreB();expect(state(b,gb)).toEqual(state(a,ga));upload();
 }finally{a.dispose();b.dispose();context.dispose();}
});
