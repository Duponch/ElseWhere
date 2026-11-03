/** Actual compiler orchestration/geometry with a no-device renderer port.
 * Readbacks are explicit TEST RGB, not a pixel, timing or visual proof. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileBakedCharts} from '../src/render/origami/baked/charts';
import {compileSourceInk,type PaintProfilePixels} from '../src/render/origami/baked/baker';
import {prepareGpuFilteredAtlas,type FilteredAtlasLimits} from '../src/render/origami/baked/gpu-filtered-atlas';

const limits:FilteredAtlasLimits={levels:4,maxCharts:256,maxCpuBytes:4*1024*1024,maxGpuBytes:32*1024*1024,maxTextureSize:512};
function fixture(){
 const indexed=new THREE.PlaneGeometry(1,1),source=indexed.toNonIndexed();indexed.dispose();source.setAttribute('paintProfile',new THREE.Float32BufferAttribute(new Float32Array(6).fill(88),1));
 const charts=compileBakedCharts(source,{texelsPerUnit:16,paddingTexels:8,mipLevels:4,maxAtlasSize:128,maxAtlasPixels:128*128,maxOutputBytes:1024*1024,maxTriangles:10}),ink=compileSourceInk(charts,[{geometry:source,sourceTriangleOffset:0}],{edgeWidth:1.7,strokeImperfection:.15});
 const rgba=new Uint8Array(16).fill(255),pixels:PaintProfilePixels={pigment:rgba,paper:rgba,coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up'};
 const paint={readProfile:()=>pixels,edgeAlpha:{data:rgba,width:2,height:2},lineOpacity:.79,strokeImperfection:.15,brushColorLinear:[0,0,0] as const};
 return{charts,ink,paint,source,dispose(){charts.geometry.dispose();ink.dispose();source.dispose();}};
}
function rendererPort(options:{readError?:boolean;afterRead?:()=>void}={}){
 const oldTarget=new THREE.RenderTarget(4,4),clear=new THREE.Color(.1,.2,.3),targets=new Set<THREE.RenderTarget>();let target:THREE.RenderTarget|null=oldTarget,face=2,mip=1,alpha=.7;
 const api={initialized:true,backend:{isWebGPUBackend:true},autoClear:false,getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,getClearColor:(out:THREE.Color)=>out.copy(clear),getClearAlpha:()=>alpha,
  setRenderTarget(next:THREE.RenderTarget|null,nextFace=0,nextMip=0){target=next;face=nextFace;mip=nextMip;if(next&&next!==oldTarget)targets.add(next);},setClearColor(value:THREE.Color|number,nextAlpha=1){clear.set(value);alpha=nextAlpha;},
  renderAsync:vi.fn(async()=>{}),copyTextureToTexture:vi.fn(),readRenderTargetPixelsAsync:vi.fn(async(_target:THREE.RenderTarget,_x:number,_y:number,width:number)=>{if(options.readError)throw Error('TEST mean read rejected');options.afterRead?.();return Float32Array.from({length:width*4},(_,i)=>i%4===0?.25:i%4===1?.5:i%4===2?.75:0);})};
 return{api,renderer:api as unknown as THREE.WebGPURenderer,oldTarget,targets,state:()=>({target,face,mip,alpha,clear:clear.toArray(),autoClear:api.autoClear})};
}

test('composed atlas owner retains only its texture and attaches mean RGB to the original chart geometry after the single readback',async()=>{
 const f=fixture(),r=rendererPort(),peaks:{cpuBytes:number;gpuBytes:number}[]=[],counts=new Map<THREE.RenderTarget,number>(),spy=vi.spyOn(THREE.RenderTarget.prototype,'dispose').mockImplementation(function(this:THREE.RenderTarget){counts.set(this,(counts.get(this)??0)+1);});
 const sourcePosition=f.charts.geometry.getAttribute('position'),before=sourcePosition.array.slice(),geometryDispose=vi.spyOn(f.charts.geometry,'dispose');
 try{
  const result=await prepareGpuFilteredAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,()=>{},p=>peaks.push({...p}));
  expect(peaks).toHaveLength(2);expect(peaks[1]!.cpuBytes).toBeGreaterThanOrEqual(peaks[0]!.cpuBytes);expect(peaks[1]!.gpuBytes).toBeGreaterThanOrEqual(peaks[0]!.gpuBytes);
  expect(r.api.readRenderTargetPixelsAsync).toHaveBeenCalledOnce();expect(r.api.readRenderTargetPixelsAsync.mock.calls[0]!.slice(1)).toEqual([0,0,f.charts.charts.length,1]);
  const rgb=f.charts.geometry.getAttribute('bakedMeanRgb');expect(rgb.count).toBe(sourcePosition.count);for(let i=0;i<rgb.count;i++)expect([rgb.getX(i),rgb.getY(i),rgb.getZ(i)]).toEqual([.25,.5,.75]);
  expect(f.charts.geometry.getAttribute('position')).toBe(sourcePosition);expect(sourcePosition.array).toEqual(before);expect(result.gpuBytes).toBe(result.plan.retainedGpuBytes);
  const facts=result.stats.filteredAtlas as {meanGeometryCpuBytes:number;meanGeometryGpuBytesPerBinding:number;ownership:string};expect(facts.meanGeometryCpuBytes).toBe(rgb.array.byteLength);expect(facts.meanGeometryGpuBytesPerBinding).toBe(rgb.array.byteLength);
  expect(JSON.stringify(result.stats)).not.toContain('meanLinearRGB');expect(geometryDispose).not.toHaveBeenCalled();expect(f.ink.disposed).toBe(false);
  expect(r.state()).toEqual({target:r.oldTarget,face:2,mip:1,alpha:.7,clear:[.1,.2,.3],autoClear:false});result.dispose();result.dispose();expect([...r.targets].every(t=>counts.get(t)===1)).toBe(true);
 }finally{spy.mockRestore();geometryDispose.mockRestore();r.oldTarget.dispose();f.dispose();}
});

test('a second-stage budget refusal retires the completed atlas before any mean target/readback and leaves borrowed charts untouched',async()=>{
 const f=fixture(),r=rendererPort(),counts=new Map<THREE.RenderTarget,number>(),spy=vi.spyOn(THREE.RenderTarget.prototype,'dispose').mockImplementation(function(this:THREE.RenderTarget){counts.set(this,(counts.get(this)??0)+1);});let calls=0;
 try{
  await expect(prepareGpuFilteredAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,{...limits,maxTextureSize:256},()=>{},()=>{calls++;})).rejects.toThrow(/320-wide/);
  expect(calls).toBe(0);expect(r.api.renderAsync).not.toHaveBeenCalled();
  await expect(prepareGpuFilteredAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,()=>{},()=>{if(++calls===2)throw Error('TEST second peak refused');})).rejects.toThrow(/second peak refused/);
  expect(r.api.readRenderTargetPixelsAsync).not.toHaveBeenCalled();expect(f.charts.geometry.hasAttribute('bakedMeanRgb')).toBe(false);expect(f.ink.disposed).toBe(false);expect([...r.targets].every(t=>counts.get(t)===1)).toBe(true);expect(r.state().target).toBe(r.oldTarget);
 }finally{spy.mockRestore();r.oldTarget.dispose();f.dispose();}
});

test('readback rejection or cancellation releases atlas and mean scratch once and never attaches stale RGB',async()=>{
 for(const cause of ['read','epoch'] as const){const f=fixture();let current=true;const r=rendererPort(cause==='read'?{readError:true}:{afterRead:()=>{current=false;}}),counts=new Map<THREE.RenderTarget,number>(),spy=vi.spyOn(THREE.RenderTarget.prototype,'dispose').mockImplementation(function(this:THREE.RenderTarget){counts.set(this,(counts.get(this)??0)+1);});
  try{
   await expect(prepareGpuFilteredAtlas(r.renderer,f.charts,f.ink,{attribute:'paintProfile',component:0},f.paint,limits,()=>{if(!current)throw Error('TEST superseded');},()=>{})).rejects.toThrow(cause==='read'?/read rejected/:/superseded/);
   expect(r.api.readRenderTargetPixelsAsync).toHaveBeenCalledOnce();expect(f.charts.geometry.hasAttribute('bakedMeanRgb')).toBe(false);expect([...r.targets].every(t=>counts.get(t)===1)).toBe(true);expect(r.state().target).toBe(r.oldTarget);expect(f.ink.disposed).toBe(false);
  }finally{spy.mockRestore();r.oldTarget.dispose();f.dispose();}
 }
});
