import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {BoxBatches} from '../src/render/BoxBatches';
import {BoxMesh} from '../src/render/BoxMesh';
import {floorPartsForKind} from '../src/render/HygieneLayer';
import type {Placement} from '../src/render/primitives';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {PREPARED_SURFACE_VARIANT} from '../src/render/origami/baked/surfaces/PreparedSurfaceOwner';

test('closed floor spatial intervals preserve original source draw order, colours and prepared variants',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0});
 const producer={register(){},dirty(){},forget(){}};
 const a=withGraphicsStyle(context,()=>new BoxBatches()),b=withGraphicsStyle(context,()=>new BoxBatches(undefined,producer)),ga=new THREE.Group(),gb=new THREE.Group();
 try{
  const parts:Placement[]=[],runs:{first:number;count:number;page:number}[]=[];
  for(let z=0;z<10;z++)for(let x=0;x<96;x++){const page=x>>>5,floor=floorPartsForKind((x+z)%3===0?'wood-planks':'ancient-tile',x,z),last=runs.at(-1);
   if(last?.page===page)last.count+=floor.length;else runs.push({page,first:parts.length,count:floor.length});parts.push(...floor);}
  a.set(ga,'hygiene-floors',parts,'solid',false);
  b.set(gb,'hygiene-floors',parts,'solid',false);
  expect(b.setSpatialRanges(gb,'hygiene-floors',runs.map(r=>({first:r.first,count:r.count,bounds:b.readSpatialBounds(gb,'hygiene-floors',r.first,r.count)!})))).toBe(true);
  const m=gb.children[0] as BoxMesh,reference=ga.children[0] as BoxMesh;
  expect(m.activeCount).toBe(reference.activeCount);expect(m.castShadow).toBe(false);expect(m.receiveShadow).toBe(true);
  expect(b.spatialMetrics379()[0]!.ranges).toBe(runs.length);
  expect(m.geometry.getAttribute('boxPatternIndex')).toBeUndefined();
  for(let i=0;i<m.activeCount;i++){
   expect(Array.from(m.instanceMatrix.array.slice(i*16,i*16+16))).toEqual(Array.from(reference.instanceMatrix.array.slice(i*16,i*16+16)));
   expect(Array.from(m.colorBuffer.array.slice(i*3,i*3+3))).toEqual(Array.from(reference.colorBuffer.array.slice(i*3,i*3+3)));
   expect(m.geometry.getAttribute(PREPARED_SURFACE_VARIANT).getX(i)).toBe(reference.geometry.getAttribute(PREPARED_SURFACE_VARIANT).getX(i));
  }
  // The retained native instance ordinal selects the same pigment, even on
  // depth ties at the adjacent shared floor borders; no spatial permutation.
  const spatialMaterial=m.material;b.setTexturesEnabled(false);b.setTexturesEnabled(true);expect(m.material).toBe(spatialMaterial);
  b.setSpatialRanges(gb,'hygiene-floors',undefined);
  b.set(gb,'hygiene-floors',parts,'solid',false);
  expect(m.material).toBe(spatialMaterial);
  expect(m.instanceMatrix.array).toEqual(reference.instanceMatrix.array);
 }finally{a.dispose();b.dispose();context.dispose();}
});

test('a contiguous visible stretch is submitted in one immutable indirect command',async()=>{
 const {SpatialInstanceRanges379}=await import('../src/render/SpatialInstanceRanges379');
 const geometry=new THREE.InstancedBufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,0,1,0],3));geometry.setIndex([0,1,2]);geometry.instanceCount=8;
 const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,100);
 camera.coordinateSystem=THREE.WebGPUCoordinateSystem;camera.position.set(4,0,10);camera.lookAt(4,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const ranges=new SpatialInstanceRanges379(mesh);
 const renderer={backend:{isWebGPUBackend:true,device:{features:new Set(['indirect-first-instance'])}},_attributes:{update(){},delete(){}}} as unknown as Parameters<THREE.Mesh['onBeforeRender']>[0];
 try{
  expect(ranges.setRanges(Array.from({length:8},(_,i)=>({first:i,count:1,bounds:new THREE.Box3(new THREE.Vector3(i*2-.1,-.1,-.1),new THREE.Vector3(i*2+.1,.1,.1))})))).toBe(true);
  mesh.onBeforeRender(renderer,scene,camera,geometry,material,null as unknown as THREE.Group);
  expect(geometry.indirectOffset).toHaveLength(1);
  const first=(geometry.indirectOffset as number[])[0]!/4;
  expect(Array.from(geometry.indirect!.array).slice(first,first+5)).toEqual([3,3,0,0,1]);
 }finally{ranges.dispose();material.dispose();geometry.dispose();}
});
