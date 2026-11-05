/** Actual final surface/uniform journal and Resource composition. CPU only;
 * the recorded Source budget and device submission boundary in the second
 * test are explicitly mocked. No texture pixels or performance are claimed. */
import{expect,test,vi}from'vitest';
import*as THREE from'three/webgpu';
import{vec2,vec3}from'three/tsl';
vi.mock('../src/render/origami/baked/surfaces/PreparedSurfaceGpu',async original=>({...await original<typeof import('../src/render/origami/baked/surfaces/PreparedSurfaceGpu')>(),planPreparedSurfaceGpu:()=>({sourceGpuBytes:256201125,geometryBytes:2125440,scratchGpuBytes:238317184,peakGpuBytes:841247741,cpuBytes:0,pageBytes:22282240})}));
import{GraphicsStyleContext}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{PreparedTextureSurface,type PreparedTextureAsset}from'../src/render/surfaces/PreparedTextureSurface';
import{createStylizedSurfaceTexture}from'../src/render/stylized-surfaces';
import{ownedMaterialResources435}from'../src/render/OwnedMaterialResources435';
import{prepareResourceBank}from'../src/render/surfaces/ResourcePreparedBank';
import type{PreparedSurfaceGpuResult,PreparedSurfacePlan,PreparedSurfaceScalarInk}from'../src/render/origami/baked/surfaces/PreparedSurfaceTypes';
import type{TreeAssetCatalog}from'../src/render/origami/baked/trees/types';

test('actual scalar flag/K publication is dense and atomic, resets on Pastel/V67 assets and follows bank metadata rather than later preferences',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0,edges:0}),source=new THREE.MeshLambertNodeMaterial(),pastel=createStylizedSurfaceTexture(),bank=new THREE.DataArrayTexture(new Uint8Array(0),2,2,2);
 bank.colorSpace=THREE.SRGBColorSpace;bank.flipY=false;bank.minFilter=THREE.LinearMipmapLinearFilter;bank.magFilter=THREE.LinearFilter;
 const K=[.015625,.0078125,.00390625]as const,asset:PreparedTextureAsset={texture:bank,scalarInk:{color:K},assertCurrent(){}},bi:PreparedTextureAsset={texture:bank,assertCurrent(){}},surface=new PreparedTextureSurface({context,sourceMaterial:source,pastelTexture:pastel,pastelUv:vec2(0),pastelFromSample:s=>s.rgb,tint:vec3(.4,.6,.2),inkTint:vec3(1),address:()=>({uv:vec2(0),bodyLayer:vec3(0).x,inkLayer:vec3(1).x,format:vec3(1).x})});
 const material=surface.material,graph=material.colorNode,flag=Reflect.get(surface,'scalarInkEnabled')as{value:number},color=Reflect.get(surface,'scalarInkColor')as{value:THREE.Vector3};
 try{
  expect(surface.snapshot().scalarInkEnabled).toBe(0);expect(color.value.toArray()).toEqual([0,0,0]);
  context.update({...context.preferences,style:'origami'});surface.setAssets(asset);expect(surface.assets).toBe(asset);expect(flag.value).toBe(1);expect(color.value.toArray()).toEqual(K);expect(surface.snapshot().scalarInkColor).toEqual(K);
  const journal=ownedMaterialResources435(material)!;expect(journal.objectUniforms.has(flag as unknown as THREE.Node)).toBe(true);expect(journal.objectUniforms.has(color as unknown as THREE.Node)).toBe(true);
  // A new setting requires a different preparation/Source representation.
  // It must NEVER reinterpret the still-bound coefficient bank as occupancy.
  context.update({...context.preferences,edges:.25});expect(flag.value).toBe(1);expect(color.value.toArray()).toEqual(K);
  surface.setAssets(bi);expect(flag.value).toBe(0);expect(color.value.toArray()).toEqual([0,0,0]);
  for(const invalid of[{color:new Array(3)},{color:[NaN,0,0]},{color:[.2,.5,.75]},{color:[-1,0,0]}]){
   const before=surface.snapshot();expect(()=>surface.setAssets({...asset,scalarInk:invalid as unknown as PreparedSurfaceScalarInk})).toThrow();expect(surface.assets).toBe(bi);expect(flag.value).toBe(0);expect(color.value.toArray()).toEqual([0,0,0]);expect(surface.snapshot().boundTexture).toBe(before.boundTexture);expect(surface.snapshot().journalRevision).toBe(before.journalRevision);
  }
  surface.setAssets(asset);surface.setAssets(undefined);expect(flag.value).toBe(0);expect(color.value.toArray()).toEqual([0,0,0]);expect(surface.snapshot().scalarInkColor).toBeUndefined();expect(surface.material).toBe(material);expect(material.colorNode).toBe(graph);
 }finally{surface.dispose();source.dispose();pastel.dispose();bank.dispose();context.dispose();}
});

test('real Resource composition carries the exact immutable scalar metadata through the submitted-work fence without new layers or metadata lifetime loss',async()=>{
 const treeTexture=new THREE.DataArrayTexture(new Uint8Array(0),2048,2048,2),genericTexture=new THREE.DataArrayTexture(new Uint8Array(0),2048,2048,12);for(const texture of[treeTexture,genericTexture]){texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;}
 const tree={texture:treeTexture,pageCount:2,assertCurrent(){}}as unknown as TreeAssetCatalog,pages=Array.from({length:6},(_,i)=>({format:'bi'as const,bodyLayer:i*2,inkLayer:i*2+1})),plan={size:2048,levels:4,layers:12,pages,retainedGpuBytes:267386880,limits:{maxPeakGpuBytes:1073741824,maxRetainedGpuBytes:369229824}}as unknown as PreparedSurfacePlan,scalarInk=Object.freeze({color:Object.freeze([.015625,.0078125,.00390625]as const)}),disposed=vi.fn(),generic:PreparedSurfaceGpuResult={texture:genericTexture,pages,scalarInk,gpuBytes:267386880,cpuBytes:32,stats:{scope:'TEST empty bytes never uploaded'},assertCurrent(){},dispose:disposed};
 let fenced=false;const targets:THREE.RenderTarget[]=[],copies:{source:THREE.Texture;layer:number;level:number}[]=[],renderer={getContext:()=>({getConfiguration:()=>({device:{queue:{onSubmittedWorkDone:async()=>{fenced=true;}}}})}),initRenderTarget:(target:THREE.RenderTarget)=>{expect(fenced).toBe(true);targets.push(target);},copyTextureToTexture:(source:THREE.Texture,_target:THREE.Texture,_box:THREE.Box3,position:THREE.Vector3,_sourceLevel:number,level:number)=>{expect(fenced).toBe(true);copies.push({source,layer:position.z,level});}}as unknown as THREE.WebGPURenderer;
 let result:PreparedSurfaceGpuResult|undefined;
 try{
  result=await prepareResourceBank(renderer,plan,tree,()=>{},async()=>generic,()=>{throw Error('No failed cleanup expected');});
  expect(result.scalarInk).toBe(scalarInk);expect(result.scalarInk!.color).toBe(scalarInk.color);expect(disposed).toHaveBeenCalledTimes(1);expect(result.cpuBytes).toBe(1024+32);expect(result.gpuBytes).toBe(311951360);expect(targets).toHaveLength(1);expect((result.texture.image as{depth:number}).depth).toBe(14);expect(copies).toHaveLength(14*4);expect(result.pages).toEqual(pages.map(p=>({...p,bodyLayer:p.bodyLayer+2,inkLayer:p.inkLayer+2})));expect(copies.filter(c=>c.source===genericTexture)).toHaveLength(12*4);
 }finally{result?.dispose();for(const target of targets)target.dispose();treeTexture.dispose();genericTexture.dispose();}
});
