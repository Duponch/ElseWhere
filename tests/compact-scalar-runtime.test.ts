/** Actual runtime/publication and Resource/Plant owners, CPU only. GPU
 * preparation/submission and the recorded Resource budget are explicit test
 * boundaries; empty texture bytes are never uploaded or treated as pixels. */
import{expect,test,vi}from'vitest';
import*as THREE from'three/webgpu';
import{uniform,vec2,vec3}from'three/tsl';
vi.mock('../src/render/origami/baked/surfaces/PreparedSurfaceGpu',async original=>({...await original<typeof import('../src/render/origami/baked/surfaces/PreparedSurfaceGpu')>(),planPreparedSurfaceGpu:()=>({sourceGpuBytes:256201125,geometryBytes:2125440,scratchGpuBytes:238317184,peakGpuBytes:841247741,cpuBytes:0,pageBytes:22282240})}));
import{GraphicsStyleContext}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{PreparedTextureSurface,type PreparedTextureAsset}from'../src/render/surfaces/PreparedTextureSurface';
import{resourceResolvedTextureInputs}from'../src/render/surfaces/ResourceResolvedAddresses';
import{prepareResourceBank,resourceBankLayout}from'../src/render/surfaces/ResourcePreparedBank';
import{createStylizedSurfaceTexture}from'../src/render/stylized-surfaces';
import{createOrigamiGroundTuftGeometry}from'../src/render/origami/flora';
import{compileNaturalSurfaceModels}from'../src/render/surfaces/NaturalSurfaceModels';
import{PlantAtlasSurface}from'../src/render/origami/baked/plants/PlantAtlasSurface';
import*as PlantGpu from'../src/render/origami/baked/plants/PlantAtlasGpu';
import type{PreparedSurfacePlan,PreparedSurfaceGpuResult,PreparedSurfaceScalarInk}from'../src/render/origami/baked/surfaces/PreparedSurfaceTypes';
import type{TreeAssetCatalog}from'../src/render/origami/baked/trees/types';
const K=[.015625,.0078125,.00390625]as const,PAGE=2048*2048*4*(1+1/4+1/16+1/64);
function map(depth:number){const texture=new THREE.DataArrayTexture(new Uint8Array(0),2048,2048,depth);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;return texture;}

test('same actual Surface and object uniforms publish P/compact/full/compact rollback/P and reuse Resource tree-prefix node without another uniform',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0,edges:0}),source=new THREE.MeshLambertNodeMaterial(),pastel=createStylizedSurfaceTexture(),compact=map(3),full=map(6),base=uniform(1),inputs=resourceResolvedTextureInputs(context,base),
  surface=new PreparedTextureSurface({context,sourceMaterial:source,pastelTexture:pastel,pastelUv:vec2(0),pastelFromSample:s=>s.rgb,tint:vec3(1),scalarInkLayerBase:base,address:()=>({uv:vec2(0),bodyLayer:vec3(3).x,inkLayer:vec3(4).x,format:vec3(1).x})}),
  compactAsset:PreparedTextureAsset={texture:compact,scalarInk:{color:K,compact:true},assertCurrent(){}},fullAsset:PreparedTextureAsset={texture:full,scalarInk:{color:K},assertCurrent(){}},material=surface.material,graph=material.colorNode;
 try{
  expect(inputs.scalarInkLayerBase).toBe(base);expect(surface.snapshot().scalarInkEnabled).toBe(0);
  context.update({...context.preferences,style:'origami'});surface.setAssets(compactAsset);expect(surface.snapshot().scalarInkEnabled).toBe(2);expect(surface.assets).toBe(compactAsset);
  surface.setAssets(fullAsset);expect(surface.snapshot().scalarInkEnabled).toBe(1);surface.setAssets(compactAsset);expect(surface.snapshot().scalarInkEnabled).toBe(2);expect(surface.snapshot().scalarInkColor).toEqual(K);
  const before=surface.snapshot();expect(()=>surface.setAssets({...fullAsset,scalarInk:{color:K,compact:false}as unknown as PreparedSurfaceScalarInk})).toThrow();expect(surface.snapshot()).toEqual(before);
  surface.setAssets(undefined);expect(surface.snapshot().scalarInkEnabled).toBe(0);expect(surface.material).toBe(material);expect(material.colorNode).toBe(graph);
 }finally{surface.dispose();source.dispose();pastel.dispose();compact.dispose();full.dispose();context.dispose();}
});

test('actual Resource copies only dense compact physical pages after the fence, preserves the tree prefix and transports immutable metadata with exact physical accounting',async()=>{
 const treeTexture=map(2),genericTexture=map(6),tree={texture:treeTexture,pageCount:2,assertCurrent(){}}as unknown as TreeAssetCatalog,
  pages=Array.from({length:6},(_,i)=>({format:'bi'as const,bodyLayer:i*2,inkLayer:i*2+1})),plan={size:2048,levels:4,layers:12,pages,retainedGpuBytes:12*PAGE,limits:{maxPeakGpuBytes:1073741824,maxRetainedGpuBytes:369229824}}as unknown as PreparedSurfacePlan,
  scalarInk=Object.freeze({color:K,compact:true as const}),retired=vi.fn(),generic:PreparedSurfaceGpuResult={texture:genericTexture,pages:pages.map((_,i)=>({format:'scalar'as const,bodyLayer:i})),scalarInk,gpuBytes:6*PAGE,cpuBytes:32,stats:{peakGpuBytes:841247741+6*PAGE},assertCurrent(){},dispose:retired};
 let fenced=false;const outputs:THREE.RenderTarget[]=[],copies:{source:THREE.Texture;from:number;to:number;level:number}[]=[],renderer={getContext:()=>({getConfiguration:()=>({device:{queue:{onSubmittedWorkDone:async()=>{fenced=true;}}}})}),initRenderTarget:(target:THREE.RenderTarget)=>{expect(fenced).toBe(true);outputs.push(target);},copyTextureToTexture:(source:THREE.Texture,_to:THREE.Texture,region:THREE.Box3,position:THREE.Vector3,sourceLevel:number,level:number)=>{expect(fenced).toBe(true);expect(sourceLevel).toBe(level);copies.push({source,from:region.min.z,to:position.z,level});}}as unknown as THREE.WebGPURenderer;
 let result:PreparedSurfaceGpuResult|undefined;
 try{
  expect(resourceBankLayout(plan,tree,true)).toMatchObject({treeLayers:2,genericLayers:6,layers:8,gpuBytes:8*PAGE});
  result=await prepareResourceBank(renderer,plan,tree,()=>{},async()=>generic,()=>{throw Error('No failed cleanup expected');});
  expect((result.texture.image as{depth:number}).depth).toBe(8);expect(result.gpuBytes).toBe(8*PAGE);expect(result.cpuBytes).toBe(1056);expect(result.scalarInk).toBe(scalarInk);expect(retired).toHaveBeenCalledTimes(1);expect(copies).toHaveLength(8*4);
  expect(copies.filter(c=>c.source===treeTexture).map(c=>[c.from,c.to,c.level])).toEqual(Array.from({length:2},(_,l)=>Array.from({length:4},(_,m)=>[l,l,m])).flat());
  expect(copies.filter(c=>c.source===genericTexture).map(c=>[c.from,c.to,c.level])).toEqual(Array.from({length:6},(_,l)=>Array.from({length:4},(_,m)=>[l,l+2,m])).flat());
  expect(result.pages).toEqual(pages.map((_,i)=>({format:'scalar',bodyLayer:i+2})));expect(result.stats).toMatchObject({logicalGenericLayers:12,genericLayers:6,finalLayers:8,scalarCompact:true,genericPreparationPeakGpuBytes:974941181,copyPhasePeakGpuBytes:647495037,peakGpuBytes:974941181});
  expect(plan.pages).toBe(pages);expect(plan.layers).toBe(12);
 }finally{result?.dispose();for(const output of outputs)output.dispose();treeTexture.dispose();genericTexture.dispose();}
});

test('actual Plant stage rolls compact/full metadata and physical binding back together and excludes rebaking its cached compact return',async()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0,edges:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),raw=createOrigamiGroundTuftGeometry(),models=compileNaturalSurfaceModels([raw]),source=new THREE.MeshLambertNodeMaterial(),pastel=createStylizedSurfaceTexture('vegetation'),surface=new PlantAtlasSurface(context,models.geometries[0]!,models.stroke,source,pastel,()=>{}),lease={assertCurrent(){},paint:{brushColorLinear:K}}as unknown as Parameters<PlantAtlasSurface['stage']>[1];
 let compact=true;const retired:ReturnType<typeof vi.fn>[]=[],gpu=vi.spyOn(PlantGpu,'preparePlantAtlasGpu').mockImplementation(async(_renderer,plan)=>{const texture=map(compact?plan.pages:plan.depth),dispose=vi.fn(()=>texture.dispose());retired.push(dispose);return{texture,gpuBytes:(compact?plan.pages:plan.depth)*PAGE,cpuBytes:32,scalarInk:{color:K,...(compact?{compact:true as const}:{})},stats:{scope:'TEST only; empty bytes never uploaded'},dispose};});
 let pending:Awaited<ReturnType<PlantAtlasSurface['stage']>>;
 try{
  const first=await surface.stage({}as THREE.WebGPURenderer,lease,()=>{});expect(first).toBeDefined();first!.commit();first!.dispose();expect(surface.stats().scalarInkEnabled).toBe(2);const bound=surface.comparisonMetadata().boundTexture,width=context.preferences.edgeWidth;
  compact=false;context.update({...context.preferences,edgeWidth:width+.1});pending=await surface.stage({}as THREE.WebGPURenderer,lease,()=>{});expect(pending).toBeDefined();expect(surface.stats().scalarInkEnabled).toBe(1);
  context.update({...context.preferences,edgeWidth:width});pending!.rollback();pending!.dispose();pending=undefined;expect(surface.stats().scalarInkEnabled).toBe(2);expect(surface.comparisonMetadata().boundTexture).toBe(bound);expect(retired[0]).not.toHaveBeenCalled();expect(retired[1]).toHaveBeenCalledTimes(1);
  context.update({...context.preferences,style:'default'});expect(surface.stats().scalarInkEnabled).toBe(0);context.update({...context.preferences,style:'origami'});expect(surface.stats().scalarInkEnabled).toBe(2);expect(surface.needsPreparation()).toBe(false);expect(gpu).toHaveBeenCalledTimes(2);
 }finally{pending?.dispose();surface.dispose();source.dispose();pastel.dispose();models.dispose();raw.dispose();context.dispose();flush.mockRestore();gpu.mockRestore();}
});
