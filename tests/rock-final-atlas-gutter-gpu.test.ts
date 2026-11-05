/** CPU admission only. No renderer/device, raster, visual or speed result. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileFaceStrokeTable} from '../src/render/surfaces/FaceStrokeTable';
import {AffineStrokeOwner} from '../src/render/surfaces/AffineStrokeOwner';
import {planRockFinalGpu,RockFinalGpuAdmissionRefusal,ROCK_FINAL_GUTTER_PIXELS,ROCK_FINAL_DILATION_PASSES,ROCK_FINAL_DILATION_OFFSETS} from '../src/render/origami/baked/rocks/RockFinalGpu';
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

function aligned8(f:ReturnType<typeof fixture>,content={x:8,y:8,width:32,height:32},rect={x:0,y:0,width:48,height:48}):RockFinalLayout{
 return{...f.layout,charts:[{...f.layout.charts[0]!,rect,content}],lookup:Float32Array.of((content.x+.5)/1024,(content.y+.5)/1024,(content.width-1)/1024,(content.height-1)/1024,0,1,0,0)};
}
test('GPU admission requires the aligned8 minimum gutter and the declared dilation reaches diagonal16px support',()=>{
 const f=fixture(),stage=vi.spyOn(AffineStrokeOwner.prototype,'stageAll');
 try{
  expect(ROCK_FINAL_GUTTER_PIXELS).toBe(8);expect(ROCK_FINAL_DILATION_PASSES).toBe(16);expect(ROCK_FINAL_DILATION_OFFSETS).toHaveLength(8);
  expect(()=>planRockFinalGpu(f.input,aligned8(f),f.budget,2)).not.toThrow();
  for(const content of[{x:9,y:8,width:32,height:32},{x:8,y:9,width:32,height:32},{x:8,y:8,width:33,height:32},{x:8,y:8,width:32,height:33}])expect(()=>planRockFinalGpu(f.input,aligned8(f,content,{x:0,y:0,width:64,height:64}),f.budget,2)).toThrow('aligned8px');
  const reached=new Set(['0,0']);let front=[[0,0]];
  for(let pass=0;pass<ROCK_FINAL_DILATION_PASSES;pass++){const next:number[][]=[];for(const[x,y]of front)for(const[dx,dy]of ROCK_FINAL_DILATION_OFFSETS){const a=x!+dx,b=y!+dy,key=a+','+b;if(!reached.has(key)){reached.add(key);next.push([a,b]);}}front=next;}
  for(const x of[-16,16])for(const y of[-16,16])expect(reached.has(x+','+y)).toBe(true);
  expect(reached.has('17,0')).toBe(false);expect(reached.has('0,17')).toBe(false);
  // This certifies a propagation/support policy WHEN a seed exists. It is
  // neither a rendered image nor proof that a thin Source sliver has a seed.
  expect(stage).not.toHaveBeenCalled();
 }finally{stage.mockRestore();f.close();}
});
test('a numeric GPU refusal reports the exact Source/other/old/new/lookup/scratch/CPU cap partition without allocating',()=>{
 const f=fixture(),stage=vi.spyOn(AffineStrokeOwner.prototype,'stageAll');
 try{
  const layout=aligned8(f),permit=planRockFinalGpu(f.input,layout,f.budget,2),caps={...f.budget,maxGlobalPeakGpuBytes:permit.globalPeakGpuBytes-1};let refusal:unknown;
  try{planRockFinalGpu(f.input,layout,caps,2);}catch(error){refusal=error;}
  expect(refusal).toBeInstanceOf(RockFinalGpuAdmissionRefusal);const message=(refusal as Error).message;expect(message).toContain('BEFORE GPU allocation');const details=JSON.parse(message.slice(message.indexOf('{')))as Record<string,unknown>;
  expect(details.schema).toBe('rock-final-gpu-budget-refusal-v1');
  for(const name of['sourceGpuBytes','otherLiveGpuBytes','oldAtlasGpuBytes','newAtlasGpuBytes','newLookupGpuBytes','bankGpuBytes','scratchGpuBytes','familyLiveGpuBytes','globalPeakGpuBytes','sourceCpuBytes','oldAtlasCpuBytes','newLookupCpuBytes','inputCpuBytes','layoutLookupCpuBytes','geometryBytes','affineGpuBytes','affinePeakCpuBytes','paintCopyCpuBytes','paintCopyGpuBytes','preparationCpuBytes','maxBindingGpuBytes','maxFamilyRetainedGpuBytes','maxGlobalPeakGpuBytes','maxPreparationCpuBytes'])expect(Number.isSafeInteger(details[name])).toBe(true);
  expect(details.sourceGpuBytes).toBe(f.budget.sourceGpuBytes);expect(details.otherLiveGpuBytes).toBe(f.budget.otherLiveGpuBytes);expect(details.oldAtlasGpuBytes).toBe(f.budget.oldAtlasGpuBytes);expect(details.newLookupGpuBytes).toBe(f.budget.newLookupGpuBytes);expect(details.newAtlasGpuBytes).toBe(permit.newAtlasGpuBytes);expect(details.familyLiveGpuBytes).toBe(permit.familyLiveGpuBytes);expect(details.scratchGpuBytes).toBe(permit.scratchGpuBytes);expect(details.preparationCpuBytes).toBe(permit.preparationCpuBytes);
  expect(details.globalPeakGpuBytes).toBe((details.sourceGpuBytes as number)+(details.otherLiveGpuBytes as number)+(details.oldAtlasGpuBytes as number)+(details.newAtlasGpuBytes as number)+(details.newLookupGpuBytes as number)+(details.scratchGpuBytes as number));
  expect(details.maxGlobalPeakGpuBytes).toBe((details.globalPeakGpuBytes as number)-1);expect(stage).not.toHaveBeenCalled();
 }finally{stage.mockRestore();f.close();}
});
