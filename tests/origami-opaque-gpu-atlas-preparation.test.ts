/** PRIVATE pure/control-flow contracts. Fake renderer records public calls;
 * no GPU/WGSL/pixels/timing/orientation-on-device claim follows from them. */
import {test,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileBakedCharts} from '../src/render/origami/baked/charts';
import {compileSourceInk,type PaintProfilePixels} from '../src/render/origami/baked/baker';
import {planGpuAtlas,prepareGpuAtlas,packCompactGpuPalette,type GpuAtlasLimits,type GpuAtlasPaintSource} from '../src/render/origami/baked/gpu-atlas-preparation';
import {createOpaqueAtlasMaterialFromTexture} from '../src/render/origami/baked/material';
const limits:GpuAtlasLimits={levels:4,maxCpuBytes:4*1024*1024,maxGpuBytes:32*1024*1024,maxTextureSize:256};
function fixture(){
 const source=new THREE.PlaneGeometry(1,1).toNonIndexed();source.setAttribute('paintProfile',new THREE.Float32BufferAttribute(new Float32Array(6).fill(88),1));
 const charts=compileBakedCharts(source,{texelsPerUnit:16,paddingTexels:8,mipLevels:4,maxAtlasSize:128,maxAtlasPixels:128*128,maxOutputBytes:1024*1024,maxTriangles:10}),ink=compileSourceInk(charts,[{geometry:source,sourceTriangleOffset:0}],{edgeWidth:1.7,strokeImperfection:.15}),edge=new THREE.DataTexture(new Uint8Array([0,255,0,255]),1,1,THREE.RGBAFormat);
 const make=(seed:number):PaintProfilePixels=>({pigment:Uint8Array.from({length:16},(_,i)=>seed+i),paper:Uint8Array.from({length:16},(_,i)=>seed+32+i),coverage:Uint8Array.from([0,64,128,255]),orientation:'upload-bottom-up'}),profiles=new Map([[0,make(1)],[88,make(80)]]);
 const forbidden=()=>{throw Error('Global GPU bank/graph must never be requested');},context={resolvedPaintIdsNode:vi.fn(forbidden),facePaintNode:vi.fn(forbidden),paintNode:vi.fn(forbidden),genericPaintIdsNode:vi.fn(forbidden),dispose:vi.fn()},readProfile=vi.fn((id:number)=>{const p=profiles.get(id);if(!p)throw Error('An unused global profile was requested');return p;});
 const alphaData=edge.image.data;if(!(alphaData instanceof Uint8Array))throw Error('Contract alpha must be Uint8Array');
 const paint:GpuAtlasPaintSource={readProfile,edgeAlpha:{data:alphaData,width:1,height:1},lineOpacity:.79,strokeImperfection:.15,brushColorLinear:[0,0,0]};
 return{source,charts,ink,edge,context,paint,profiles,readProfile,dispose(){ink.dispose();charts.geometry.dispose();source.dispose();edge.dispose();}};
}
function fakeRenderer(failAtRender=-1){
 const oldTarget=new THREE.RenderTarget(4,4),oldColor=new THREE.Color(.12,.23,.34),clear=oldColor.clone();let target:THREE.RenderTarget|null=oldTarget,face=2,mip=1,alpha=.7;
 const renders:{target:THREE.RenderTarget;positions:number[];uv:number[];format:{type:number;colorSpace:string;samples:number};width:number;height:number}[]=[],copies:{srcLevel:number;dstLevel:number;width:number;height:number;dest:THREE.Texture}[]=[];
 const api={initialized:true,backend:{isWebGPUBackend:true},autoClear:false,getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,getClearColor:(value:THREE.Color)=>value.copy(clear),getClearAlpha:()=>alpha,
  setRenderTarget(next:THREE.RenderTarget|null,nextFace=0,nextMip=0){target=next;face=nextFace;mip=nextMip;},setClearColor(value:THREE.Color|number,nextAlpha=1){clear.set(value);alpha=nextAlpha;},
  async renderAsync(scene:THREE.Scene){
   if(!target)throw Error('Contract requires a private target');const mesh=scene.children[0] as THREE.Mesh,g=mesh.geometry;
   renders.push({target,positions:Array.from(g.getAttribute('position').array),uv:Array.from(g.getAttribute('bakeUv').array),format:{type:target.texture.type,colorSpace:target.texture.colorSpace,samples:target.samples},width:target.width,height:target.height});
   if(renders.length===failAtRender)throw Error('injected render rejection');
  },
  copyTextureToTexture(_source:THREE.Texture,dest:THREE.Texture,region:THREE.Box2,_offset:THREE.Vector2,srcLevel:number,dstLevel:number){copies.push({srcLevel,dstLevel,width:region.max.x-region.min.x,height:region.max.y-region.min.y,dest});}
 };
 return{api,renders,copies,oldTarget,oldColor,getState:()=>({target,face,mip,alpha,color:clear.clone(),autoClear:api.autoClear}),renderer:api as unknown as THREE.WebGPURenderer};
}

test('metadata admission counts compact palettes, linear working/pingpong and finite mips before GPU/pixel allocation',async()=>{
 const f=fixture(),r=fakeRenderer(),guard=vi.fn();
 try{const p=planGpuAtlas(f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits),pixels=p.width*p.height,chain=Array.from({length:4},(_,l)=>pixels*4/4**l).reduce((a,b)=>a+b,0);
  expect(p.compactProfileIds).toEqual([0,88]);expect(p.compactCpuBytes).toBe(64);expect(p.compactGpuBytes).toBe(80);expect(p.alphaGpuBytes).toBe(4);
  expect(p.retainedGpuBytes).toBe(chain);expect(p.peakGpuBytes).toBe(pixels*49+chain+p.geometryBytes+p.compactGpuBytes+p.alphaGpuBytes);expect(p.cpuBytes).toBe(p.geometryBytes*4+4*64+p.compactCpuBytes);expect(p.dilationPasses).toBe(16);
  await expect(prepareGpuAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,{...limits,maxGpuBytes:p.peakGpuBytes-1},guard)).rejects.toThrow(/peak budget/);
  expect(guard).not.toHaveBeenCalled();expect(r.renders).toHaveLength(0);expect(r.getState().target).toBe(r.oldTarget);expect(f.readProfile.mock.calls.every(([id])=>id===0||id===88)).toBe(true);
 }finally{r.oldTarget.dispose();f.dispose();}
});

test('scene-wide planned-peak refusal precedes private geometry and render state, then a later admitted retry remains usable',async()=>{
 const f=fixture(),r=fakeRenderer(),stateRead=vi.spyOn(r.api,'getRenderTarget'),geometryWrite=vi.spyOn(THREE.BufferGeometry.prototype,'setAttribute'),guard=vi.fn();
 try{
  const admission=vi.fn((plan:ReturnType<typeof planGpuAtlas>)=>{expect(plan.peakGpuBytes).toBeGreaterThan(plan.retainedGpuBytes);expect(guard).toHaveBeenCalledOnce();throw Error('TEST scene-wide live owners leave no peak space');});
  await expect(prepareGpuAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,guard,admission)).rejects.toThrow(/scene-wide live owners/);
  expect(admission).toHaveBeenCalledOnce();expect(stateRead).not.toHaveBeenCalled();expect(geometryWrite).not.toHaveBeenCalled();expect(r.renders).toHaveLength(0);
  const accepted=vi.fn(),result=await prepareGpuAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,()=>{},accepted);
  expect(accepted).toHaveBeenCalledOnce();expect(accepted.mock.calls[0]![0]).toBe(result.plan);expect(r.renders.length).toBeGreaterThan(0);result.dispose();
 }finally{stateRead.mockRestore();geometryWrite.mockRestore();r.oldTarget.dispose();f.dispose();}
});

test('actual preparation geometry declares row0/v0 clip orientation and copies exactly three finite mip regions without readback',async()=>{
 const f=fixture(),r=fakeRenderer(),disposed=new Map<THREE.RenderTarget,number>(),spy=vi.spyOn(THREE.RenderTarget.prototype,'dispose').mockImplementation(function(this:THREE.RenderTarget){disposed.set(this,(disposed.get(this)??0)+1);});
 try{const result=await prepareGpuAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,()=>{}),uv=f.charts.geometry.getAttribute('bakedUv'),body=r.renders[0]!;
  for(let v=0;v<uv.count;v++){expect(body.positions[v*3]).toBeCloseTo(uv.getX(v)*2-1,6);expect(body.positions[v*3+1]).toBeCloseTo(1-uv.getY(v)*2,6);expect(body.positions[v*3+2]).toBe(.5);}
  const quad=r.renders[1]!;expect(quad.uv.slice(0,6)).toEqual([0,0,1,0,1,1]);expect(quad.positions.slice(0,9)).toEqual([-1,1,.5,1,1,.5,1,-1,.5]);
  expect(body.width).toBe(result.plan.width*2);expect(body.height).toBe(result.plan.height*2);expect(body.format).toEqual({type:THREE.HalfFloatType,colorSpace:THREE.NoColorSpace,samples:0});
  expect(r.copies.map(c=>[c.srcLevel,c.dstLevel,c.width,c.height])).toEqual([1,2,3].map(level=>[0,level,result.plan.width/2**level,result.plan.height/2**level]));expect(r.copies.every(c=>c.dest===result.texture)).toBe(true);
  expect(result.texture.mipmaps).toHaveLength(4);expect(result.texture.generateMipmaps).toBe(false);expect(result.texture.colorSpace).toBe(THREE.SRGBColorSpace);expect(result.texture.mipmaps.every(m=>'data'in m&&(m.data as Uint8Array).byteLength===0)).toBe(true);
  expect(result.stats).toMatchObject({readback:false,workingScale:2,sourcePaintBorrowed:true,globalPoolGpuBound:false,globalShaderCalls:false,compactProfileIds:[0,88],sourcePainterCpuCostEliminated:false});expect(r.getState()).toMatchObject({target:r.oldTarget,face:2,mip:1,alpha:.7,autoClear:false});expect(r.getState().color.toArray()).toEqual(r.oldColor.toArray());
  for(const globalCall of [f.context.resolvedPaintIdsNode,f.context.facePaintNode,f.context.paintNode,f.context.genericPaintIdsNode])expect(globalCall).not.toHaveBeenCalled();
  expect(f.context.dispose).not.toHaveBeenCalled();const runtime=createOpaqueAtlasMaterialFromTexture(result.texture,result.gpuBytes,()=>result.dispose()),runtimeDispose=vi.spyOn(runtime.material,'dispose');
  expect(runtime.texture).toBe(result.texture);expect(runtime.material.normalNode).toBeNull();expect(runtime.material.transparent).toBe(false);expect(runtime.material.roughness).toBe(.88);expect(runtime.material.metalness).toBe(.02);
  runtime.dispose();runtime.dispose();result.dispose();expect(runtimeDispose).toHaveBeenCalledTimes(1);expect([...disposed.values()].every(n=>n===1)).toBe(true);
 }finally{spy.mockRestore();r.oldTarget.dispose();f.dispose();}
});

test('an asynchronous render rejection restores state, releases every allocated private target once and unlocks a retry',async()=>{
 const f=fixture(),r=fakeRenderer(2),targets=new Set<THREE.RenderTarget>(),counts=new Map<THREE.RenderTarget,number>(),spy=vi.spyOn(THREE.RenderTarget.prototype,'dispose').mockImplementation(function(this:THREE.RenderTarget){targets.add(this);counts.set(this,(counts.get(this)??0)+1);});
 try{await expect(prepareGpuAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,()=>{})).rejects.toThrow(/injected render rejection/);
  expect(targets.size).toBe(4);expect([...counts.values()].every(n=>n===1)).toBe(true);expect(r.getState()).toMatchObject({target:r.oldTarget,face:2,mip:1,alpha:.7,autoClear:false});expect(f.context.dispose).not.toHaveBeenCalled();
  const retried=await prepareGpuAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,()=>{});retried.dispose();expect([...counts.values()].every(n=>n===1)).toBe(true);
 }finally{spy.mockRestore();r.oldTarget.dispose();f.dispose();}
});

test('compact P/KM copies preserve exact selected upload-order bytes, share no mutable source storage and refuse before allocation',()=>{
 const f=fixture(),before=[...f.profiles].map(([id,p])=>[id,Array.from(p.pigment),Array.from(p.paper),Array.from(p.coverage)]);
 try{expect(()=>packCompactGpuPalette([88,88],f.paint.readProfile,63)).toThrow(/BEFORE pixel allocation/);const packed=packCompactGpuPalette([88,88],f.paint.readProfile,64);
  expect(packed.ids).toEqual([0,88]);expect(packed.pigment.byteLength+packed.paperCoverage.byteLength).toBe(64);
  for(const [layer,id]of packed.ids.entries()){const p=f.profiles.get(id)!;expect(Array.from(packed.pigment.subarray(layer*16,(layer+1)*16))).toEqual(Array.from(p.pigment));
   for(let pixel=0;pixel<4;pixel++){const at=layer*16+pixel*4;expect(Array.from(packed.paperCoverage.subarray(at,at+3))).toEqual(Array.from(p.paper.subarray(pixel*4,pixel*4+3)));expect(packed.paperCoverage[at+3]).toBe(p.coverage[pixel]);}}
  packed.pigment.fill(0);packed.paperCoverage.fill(0);expect([...f.profiles].map(([id,p])=>[id,Array.from(p.pigment),Array.from(p.paper),Array.from(p.coverage)])).toEqual(before);
  expect(f.readProfile.mock.calls.every(([id])=>id===0||id===88)).toBe(true);for(const globalCall of [f.context.resolvedPaintIdsNode,f.context.facePaintNode,f.context.paintNode,f.context.genericPaintIdsNode])expect(globalCall).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
