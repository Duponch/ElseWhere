/** Injected-owner CONTROL FLOW only. Real deer geometry/brush preparation,
 * no renderer/device, no GPU pixels or visual/performance claim. */
import {test,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {BakedAnimalLibrary,type AnimalBakeRequest,type AnimalAtlasCompiler,type AnimalAtlasCompilation,type AnimalAtlasCompileInput} from '../src/render/origami/baked/animal-baked';
import type {PaintProfilePixels} from '../src/render/origami/baked/baker';
import {planGpuAtlas} from '../src/render/origami/baked/gpu-atlas-preparation';

const MiB=1024*1024;
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
function request():Omit<AnimalBakeRequest,'compiler'|'compilerFingerprint'>{
  const rgba=new Uint8Array(16).fill(255),pixels:PaintProfilePixels={pigment:rgba,paper:rgba,coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up'};
  return{recipeFingerprint:'TEST-real-deer-compile-owner',paletteFingerprint:'TEST-uniform-not-image-validation',paintFingerprint:'TEST-generation0',impasto:0,wear:0,edgeWidth:1.7,strokeImperfection:.15,
    chartOptions:{texelsPerUnit:256,paddingTexels:8,mipLevels:4,maxAtlasSize:2048,maxAtlasPixels:2048*2048,maxOutputBytes:32*MiB,maxTriangles:20000},
    paint:{readProfile:()=>pixels,edgeAlpha:{data:rgba,width:2,height:2},lineOpacity:.79,strokeImperfection:.15,brushColorLinear:[0,0,0]},
    maxInkTriangles:100000,reservation:{cpuBytes:128*MiB,gpuBytes:32*MiB}};
}
function targetOwner(input:AnimalAtlasCompileInput){
  const{width,height,mipLevels}=input.charts.atlas,target=new THREE.RenderTarget(width,height,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,colorSpace:THREE.SRGBColorSpace,depthBuffer:false,stencilBuffer:false,samples:0,generateMipmaps:false});
  target.texture.flipY=false;target.texture.generateMipmaps=false;target.texture.magFilter=THREE.LinearFilter;target.texture.minFilter=THREE.LinearMipmapLinearFilter;
  target.texture.mipmaps=Array.from({length:mipLevels},(_,level)=>({data:new Uint8Array(0),width:width/2**level,height:height/2**level}));
  const gpuBytes=Array.from({length:mipLevels},(_,level)=>width*height*4/4**level).reduce((a,b)=>a+b,0),disposeTarget=vi.spyOn(target,'dispose'),disposeTexture=vi.spyOn(target.texture,'dispose');let disposed=false;
  const result:AnimalAtlasCompilation={texture:target.texture,cpuBytes:mipLevels*64,gpuBytes,plan:{scope:'TEST-only RT-shaped ownership, no rendering',width,height,levels:mipLevels},stats:{testOnly:true,noGpu:true},dispose(){if(disposed)return;disposed=true;target.dispose();}};
  return{target,result,disposeTarget,disposeTexture};
}

test('injected animal compiler retains borrowed inputs across await, cancels only one shared waiter and releases its RT once; unprovable rejection cleanup quarantines the reservation',async()=>{
  const options=request(),library=new BakedAnimalLibrary({cpuBytes:256*MiB,gpuBytes:64*MiB}),entered=deferred<AnimalAtlasCompileInput>(),finish=deferred<AnimalAtlasCompilation>(),abort=new AbortController();
  const compiler=vi.fn<AnimalAtlasCompiler>(async input=>{input.assertCurrent();entered.resolve(input);return await finish.promise;});
  // Missing identity is refused before a producer or borrowed buffer is touched.
  // @ts-expect-error Deliberately absent required compiler: runtime admission must refuse.
  await expect(library.acquire('deer',options)).rejects.toThrow(/explicit compiler/);
  // @ts-expect-error Deliberately absent required fingerprint: runtime admission must refuse.
  await expect(library.acquire('deer',{...options,compiler})).rejects.toThrow(/compilerFingerprint/);expect(compiler).not.toHaveBeenCalled();
  const first=library.acquire('deer',{...options,compiler,compilerFingerprint:'TEST-RT-owner-v1',signal:abort.signal}).then(lease=>({lease,error:undefined}),(error:unknown)=>({lease:undefined,error}));
  const second=library.acquire('deer',{...options,compiler,compilerFingerprint:'TEST-RT-owner-v1'});
  const input=await entered.promise,inkDispose=vi.spyOn(input.ink,'dispose'),geometryDispose=vi.spyOn(input.charts.geometry,'dispose');
  expect(input.profile).toEqual({attribute:'animalPaint',component:3});expect(input.paint).toBe(options.paint);expect(input.ink.disposed).toBe(false);expect(input.ink.geometries).toHaveLength(1);
  expect(library.snapshot()).toMatchObject({pending:1,leases:2});expect(compiler).toHaveBeenCalledTimes(1);
  abort.abort();await Promise.resolve();expect(input.ink.disposed).toBe(false);expect(inkDispose).not.toHaveBeenCalled();expect(geometryDispose).not.toHaveBeenCalled();expect(()=>library.dispose()).toThrow(/owners|pending/);
  const rt=targetOwner(input);finish.resolve(rt.result);
  const rejected=await first,lease=await second;expect(rejected.lease).toBeUndefined();expect(rejected.error).toBeInstanceOf(Error);if(!(rejected.error instanceof Error))throw Error('Missing aborted owner error');expect(rejected.error.name).toBe('AbortError');
  expect(input.ink.disposed).toBe(true);expect(inkDispose).toHaveBeenCalledTimes(1);expect(geometryDispose).not.toHaveBeenCalled();
  expect(library.snapshot()).toMatchObject({ready:1,pending:0,leases:1});expect(lease.resource.atlas).toBe(rt.target.texture);expect(lease.resource.gpuBytes).toBe(rt.result.gpuBytes);expect(lease.resource.cpuBytes).toBeGreaterThan(rt.result.cpuBytes);expect(lease.resource.facts.compilerRetainedCpuBytes).toBe(rt.result.cpuBytes);expect(lease.resource.facts.compilerFingerprint).toBe('TEST-RT-owner-v1');
  // An aborted waiter must not free the target still used by the second owner.
  expect(rt.disposeTarget).not.toHaveBeenCalled();expect(rt.disposeTexture).not.toHaveBeenCalled();lease.release();expect(library.evictUnused()).toBe(1);
  expect(rt.disposeTarget).toHaveBeenCalledTimes(1);expect(rt.disposeTexture).not.toHaveBeenCalled();expect(geometryDispose).toHaveBeenCalledTimes(1);

  // Exercise THIS adapter's rejection/finally boundary, not just AtlasCache:
  // an invalid returned texture AND an owner disposer that cannot prove cleanup.
  let badInput:AnimalAtlasCompileInput|undefined,bad:ReturnType<typeof targetOwner>|undefined,badGeometryCalls=()=>0;
  const failedOwnerDispose=vi.fn(()=>{throw Error('TEST unprovable RT owner cleanup');});
  const badCompiler:AnimalAtlasCompiler=async value=>{badInput=value;const geometryDispose=vi.spyOn(value.charts.geometry,'dispose');badGeometryCalls=()=>geometryDispose.mock.calls.length;bad=targetOwner(value);bad.target.texture.colorSpace=THREE.NoColorSpace;return{...bad.result,dispose:failedOwnerDispose};};
  try{
    await expect(library.acquire('deer',{...options,compiler:badCompiler,compilerFingerprint:'TEST-invalid-output-owner-v2'})).rejects.toThrow(/quarantined/);
    expect(failedOwnerDispose).toHaveBeenCalledTimes(1);expect(badInput?.ink.disposed).toBe(true);expect(badGeometryCalls()).toBe(1);
    expect(library.snapshot()).toMatchObject({quarantined:1,unknownBytes:true,leases:0,cpuBytes:options.reservation.cpuBytes,gpuBytes:options.reservation.gpuBytes});
    const forbidden=vi.fn<AnimalAtlasCompiler>(()=>{throw Error('Must refuse before another compiler starts');});
    await expect(library.acquire('deer',{...options,compiler:forbidden,compilerFingerprint:'TEST-after-quarantine'})).rejects.toThrow(/quarantined/);expect(forbidden).not.toHaveBeenCalled();
    expect(()=>library.dispose()).toThrow(/quarantined/);
  }finally{
    // No GPU allocation exists in this test. Release the TEST-owned RT object
    // explicitly; do not retry the failed disposer or clear cache accounting.
    bad?.target.dispose();rt.disposeTarget.mockRestore();rt.disposeTexture.mockRestore();
  }
});

test('real deer geometry plans and admits its exact GPU preparation peak before the compiler creates its target owner',async()=>{
  const options=request(),rgba=new Uint8Array(512*512*4),coverage=new Uint8Array(512*512),pixels:PaintProfilePixels={pigment:rgba,paper:rgba,coverage,orientation:'upload-bottom-up'};
  options.paint={...options.paint,readProfile:()=>pixels,edgeAlpha:{data:rgba,width:512,height:512}};
  options.reservation={cpuBytes:128*MiB,gpuBytes:256*MiB};
  const library=new BakedAnimalLibrary({cpuBytes:256*MiB,gpuBytes:128*MiB});let target:ReturnType<typeof targetOwner>|undefined;
  const compiler=vi.fn<AnimalAtlasCompiler>(input=>{
    expect(library.snapshot().gpuBytes).toBe(0);
    const plan=planGpuAtlas(input.charts,input.ink,input.profile,input.paint,{levels:4,maxCpuBytes:32*MiB,maxGpuBytes:256*MiB,maxTextureSize:4096});
    expect(plan.peakGpuBytes).toBeLessThan(128*MiB);expect(plan.peakGpuBytes).toBeGreaterThan(plan.retainedGpuBytes);
    input.reservePreparation({cpuBytes:plan.cpuBytes,gpuBytes:plan.peakGpuBytes});
    expect(library.snapshot().gpuBytes).toBe(plan.peakGpuBytes);input.assertCurrent();
    target=targetOwner(input);return target.result;
  });
  await expect(library.acquire('deer',{...options,compiler,compilerFingerprint:'TEST-planned-real-deer'})).rejects.toThrow(/peak budget/);expect(compiler).not.toHaveBeenCalled();
  const lease=await library.acquire('deer',{...options,compiler,compilerFingerprint:'TEST-planned-real-deer',deferGpuReservation:true});
  expect(compiler).toHaveBeenCalledTimes(1);expect(library.snapshot().gpuBytes).toBe(target!.result.gpuBytes);
  lease.release();library.dispose();expect(target!.disposeTarget).toHaveBeenCalledTimes(1);expect(target!.disposeTexture).not.toHaveBeenCalled();
});
