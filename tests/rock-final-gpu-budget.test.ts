/** CPU admission only. No renderer/device, raster, visual or speed result. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileFaceStrokeTable} from '../src/render/surfaces/FaceStrokeTable';
import {AffineStrokeOwner} from '../src/render/surfaces/AffineStrokeOwner';
import {measureSurfaceBudget} from '../src/render/surfaces/SurfaceBudgetInventory';
import {planRockFinalGpu,RockFinalGpuAdmissionRefusal,rockFinalPageGpuBytes} from '../src/render/origami/baked/rocks/RockFinalGpu';
import type {RockFinalBakeInput,RockFinalBudgetDeclarations,RockFinalLayout} from '../src/render/origami/baked/rocks/RockFinalTypes';

const MiB=1024*1024;
function fixture(){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute([1,1,1,1,1,1,1,1,1],3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));
 const canonical=compileFaceStrokeTable(geometry,{maxCpuBytes:MiB,maxTriangles:1,maxEdgesPerFace:4,mergeCoplanar:false});
 if(canonical.faceCount!==1||canonical.edgeCount<1||canonical.edgeCount>4)throw Error('Actual tiny canonical triangle required');
 const header=canonical.values.slice(0,8),edgeCount=header[1]!,first=header[0]!*4;
 const input:RockFinalBakeInput={
  position:geometry.getAttribute('position').array as Float32Array,
  color:geometry.getAttribute('color').array as Float32Array,
  rockSurfaceUv:Float32Array.of(0,0,0,1,0,0,0,1,0),
  indices:Uint32Array.of(0,1,2),triangleFace:Uint32Array.of(0),
  faceId:Uint32Array.of(0),faceHeader:header,faceEdgeOffset:Uint32Array.of(0,edgeCount),
  canonicalEdges:canonical.values.slice(first,first+edgeCount*36),
  revision:()=> 'actual-tiny-canonical-triangle',assertCurrent:()=>canonical.assertCurrent(),
 };
 // A large allocated bank may contain reserve layers. Admission must count
 // every layer even when this fixture writes just one tiny chart on page0.
 const lookup=Float32Array.of(16.5/1024,16.5/1024,31/1024,31/1024,0,1,0,0);
 const layout:RockFinalLayout={key:'budget-only-31-layer-bank',size:1024,levels:4,layers:31,lookup,
  charts:[{id:0,page:0,rect:{x:0,y:0,width:64,height:64},content:{x:16,y:16,width:32,height:32},faceIds:[0]}],
  assertCurrent:()=>canonical.assertCurrent(),
 };
 const budget:RockFinalBudgetDeclarations={sourceScope:'Explicit test ledger; buffers/textures declared, not measured driver memory',sourceCpuBytes:2*MiB,sourceGpuBytes:24*MiB,otherLiveGpuBytes:400*MiB,oldAtlasCpuBytes:MiB,oldAtlasGpuBytes:4*MiB,newLookupCpuBytes:64,newLookupGpuBytes:32,maxFamilyRetainedGpuBytes:512*MiB,maxGlobalPeakGpuBytes:1024*MiB,maxPreparationCpuBytes:256*MiB};
 return{input,layout,budget,close(){canonical.dispose();geometry.dispose();}};
}

test('unknown owner/texture bytes refuse before local affine preparation and leave original inputs untouched',()=>{
 const f=fixture(),stage=vi.spyOn(AffineStrokeOwner.prototype,'stageAll'),position=f.input.position.slice(),header=f.input.faceHeader.slice(),edges=f.input.canonicalEdges.slice(),lookup=f.layout.lookup.slice(),unknown=new THREE.Texture();
 try{
  const inventory=measureSurfaceBudget(new THREE.Group(),[{textures:[unknown],gpuBufferBytes:0,cpuBytes:0,complete:true,scope:'Unknown shape is not a zero-cost texture'}]);
  expect(inventory.complete).toBe(false);expect(inventory.gpuBytes).toBeNull();
  expect(()=>planRockFinalGpu(f.input,f.layout,{...f.budget,otherLiveGpuBytes:inventory.gpuBytes},2)).toThrow('Unknown budget');
  for(const key of ['sourceCpuBytes','sourceGpuBytes','otherLiveGpuBytes','oldAtlasCpuBytes','oldAtlasGpuBytes','newLookupGpuBytes','newLookupCpuBytes']as const){
   expect(()=>planRockFinalGpu(f.input,f.layout,{...f.budget,[key]:null},2)).toThrow(RockFinalGpuAdmissionRefusal);
  }
  expect(stage).not.toHaveBeenCalled();
  expect(f.input.position).toEqual(position);expect(f.input.faceHeader).toEqual(header);expect(f.input.canonicalEdges).toEqual(edges);expect(f.layout.lookup).toEqual(lookup);
 }finally{stage.mockRestore();unknown.dispose();f.close();}
});

test('A/B admission counts full allocated banks, old/new overlap and scratch while keeping other owners outside the family cap',()=>{
 const f=fixture(),stage=vi.spyOn(AffineStrokeOwner.prototype,'stageAll');
 try{
  const p=planRockFinalGpu(f.input,f.layout,f.budget,2);
  // Independent storage contract: RGBA8,1024²,31layers,levels0..3, two banks.
  expect(rockFinalPageGpuBytes(1024)).toBe(5570560);
  expect(p.bankGpuBytes).toBe(172687360);expect(p.newAtlasGpuBytes).toBe(345374720);
  expect(p.familyLiveGpuBytes).toBe(24*MiB+4*MiB+32+345374720);
  expect(p.familyLiveGpuBytes).toBeLessThan(512*MiB);
  expect(p.familyLiveGpuBytes+400*MiB).toBeGreaterThan(512*MiB);
  expect(p.globalPeakGpuBytes).toBe(p.familyLiveGpuBytes+400*MiB+p.scratchGpuBytes);
  expect(p.scratchGpuBytes).toBeGreaterThan(1024*1024*48+5570560+1024*1024);
  // After the two arrays exist, declaring them as old-live and allocating zero
  // new arrays must reproduce the SAME peak, not silently undercount it.
  const live=planRockFinalGpu(f.input,f.layout,{...f.budget,oldAtlasGpuBytes:4*MiB+p.newAtlasGpuBytes},0);
  expect(live.familyLiveGpuBytes).toBe(p.familyLiveGpuBytes);expect(live.globalPeakGpuBytes).toBe(p.globalPeakGpuBytes);
  expect(()=>planRockFinalGpu(f.input,f.layout,{...f.budget,maxFamilyRetainedGpuBytes:p.familyLiveGpuBytes,maxGlobalPeakGpuBytes:p.globalPeakGpuBytes},2)).not.toThrow();
  expect(()=>planRockFinalGpu(f.input,f.layout,{...f.budget,maxFamilyRetainedGpuBytes:p.familyLiveGpuBytes-1},2)).toThrow('BEFORE GPU allocation');
  expect(()=>planRockFinalGpu(f.input,f.layout,{...f.budget,maxGlobalPeakGpuBytes:p.globalPeakGpuBytes-1},2)).toThrow('BEFORE GPU allocation');
  // Resizing cannot drop the still-live previous A/B pair from the retained
  // cap, even though the freshly requested pair itself fits comfortably.
  expect(()=>planRockFinalGpu(f.input,f.layout,{...f.budget,oldAtlasGpuBytes:p.newAtlasGpuBytes},2)).toThrow('BEFORE GPU allocation');
  expect(stage).not.toHaveBeenCalled();
 }finally{stage.mockRestore();f.close();}
});
