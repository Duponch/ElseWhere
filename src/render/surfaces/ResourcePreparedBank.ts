/** Texture-layer composition, not another scheduler or public texture owner.
 * The existing PreparedSurfaceOwner adopts the SINGLE returned final result. */
import * as THREE from 'three/webgpu';
import type {TreeAssetCatalog} from '../origami/baked/trees/types';
import type {PreparedSurfacePlan,PreparedSurfaceGpuResult} from '../origami/baked/surfaces/PreparedSurfaceTypes';
import {PreparedSurfaceAdmissionRefusal} from '../origami/baked/surfaces/PreparedSurfaceTypes';
import {planPreparedSurfaceGpu} from '../origami/baked/surfaces/PreparedSurfaceGpu';
const SIZE=2048,LEVELS=4,PAGE_BYTES=SIZE*SIZE*4*(1+1/4+1/16+1/64);
export function resourceBankLayout(plan:PreparedSurfacePlan,tree:TreeAssetCatalog|undefined){
 const treeLayers=tree?.pageCount??0;if(tree){tree.assertCurrent();const image=tree.texture.image as{width?:number;height?:number;depth?:number};if(image.width!==SIZE||image.height!==SIZE||image.depth!==treeLayers||tree.texture.type!==THREE.UnsignedByteType||tree.texture.format!==THREE.RGBAFormat||tree.texture.colorSpace!==THREE.SRGBColorSpace||tree.texture.flipY)throw new PreparedSurfaceAdmissionRefusal('Exact2048 RGBA8 tree source layers required');}
 if(plan.size!==SIZE||treeLayers+plan.layers>256||treeLayers+plan.layers<1)throw new PreparedSurfaceAdmissionRefusal('Bounded common resource array required');
 return{treeLayers,layers:treeLayers+plan.layers,gpuBytes:(treeLayers+plan.layers)*PAGE_BYTES};
}
export function resourceBankAddresses(data:Float32Array,tree:TreeAssetCatalog|undefined):Float32Array{
 const offset=tree?.pageCount??0,treeAt=data.length/4,out=new Float32Array(data.length+64*4);out.set(data);out[1]=treeAt;
 // The default address book contains header +2vec4 per hash slot. Empty
 // buckets have variant+1=0; only occupied records carry layer references.
 for(let row=1;row<data.length/4;row+=2)if(out[row*4]!>0){out[(row+1)*4+2]!+=offset;if(out[(row+1)*4+3]!>=0)out[(row+1)*4+3]!+=offset;}
 if(tree)for(let slot=0;slot<64;slot++){const t=tree.slots[slot]!;out.set([t.layer,t.paletteBaked?1:0,0,0],(treeAt+slot)*4);}
 return out;
}
/** Generic retained and combined retained coexist during copies. Scratch
 * belongs to the earlier bake phase: an actual submitted-work fence separates
 * their GPU lifetimes before combined allocation. No budget/resolution change.
 * Array-to-array copies preserve all four existing mip levels byte-for-byte. */
export async function prepareResourceBank(renderer:THREE.WebGPURenderer,plan:PreparedSurfacePlan,tree:TreeAssetCatalog|undefined,assert:()=>void,prepareDefault:()=>Promise<PreparedSurfaceGpuResult>,retainFailedCleanup:(resource:{dispose():void})=>void):Promise<PreparedSurfaceGpuResult>{
 assert();const layout=resourceBankLayout(plan,tree);
 if(!plan.layers){if(!tree)throw new PreparedSurfaceAdmissionRefusal('No actual external resource bank');let closed=false;return{texture:tree.texture,pages:[],gpuBytes:0,cpuBytes:0,stats:{borrowedExistingTreeBank:true,treeLayers:layout.treeLayers,finalLayers:layout.layers,extraAllocation:0},assertCurrent(){if(closed)throw Error('Borrowed resource asset retired');tree.assertCurrent();},dispose(){closed=true;}};}
 const budget=planPreparedSurfaceGpu(plan),copyPhasePeakGpuBytes=budget.peakGpuBytes-budget.scratchGpuBytes+layout.gpuBytes,peakGpuBytes=Math.max(budget.peakGpuBytes,copyPhasePeakGpuBytes);if(peakGpuBytes>plan.limits.maxPeakGpuBytes||layout.gpuBytes>plan.limits.maxRetainedGpuBytes)throw new PreparedSurfaceAdmissionRefusal('Combined resource old/new/tree/generic/scratch budget refused before GPU allocation');
 let generic:PreparedSurfaceGpuResult|undefined,output:THREE.RenderTarget|undefined;let delivered=false,primary:unknown;
 try{
  generic=await prepareDefault();assert();tree?.assertCurrent();
  // prepareSurfaceGpu settles its scratch disposers before returning. GPU
  // commands can still reference those textures: complete the submitted work
  // before allocating another bank. waitForGPU() was removed in runtime r186.
  const context=renderer.getContext() as GPUCanvasContext|WebGL2RenderingContext;
  const device='getConfiguration' in context?context.getConfiguration()?.device:undefined;
  if(!device)throw Error('Configured WebGPU device required to separate resource preparation phases');
  assert();await device.queue.onSubmittedWorkDone();assert();tree?.assertCurrent();
  output=new THREE.RenderTarget(SIZE,SIZE,{depth:layout.layers,samples:0,type:THREE.UnsignedByteType,format:THREE.RGBAFormat,colorSpace:THREE.SRGBColorSpace,depthBuffer:false,stencilBuffer:false,generateMipmaps:false,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter});
  output.texture.flipY=false;output.texture.wrapS=output.texture.wrapT=THREE.ClampToEdgeWrapping;output.texture.mipmaps=Array.from({length:LEVELS},(_,level)=>({data:new Uint8Array(0),width:SIZE/2**level,height:SIZE/2**level}));
  if(!output.texture.isArrayTexture)throw Error('Renderer did not construct an actual resource texture array');renderer.initRenderTarget(output);
  const copy=(source:THREE.Texture,sourceLayer:number,targetLayer:number)=>{for(let level=0;level<LEVELS;level++){const n=SIZE/2**level;assert();tree?.assertCurrent();generic?.assertCurrent();renderer.copyTextureToTexture(source,output!.texture,new THREE.Box3(new THREE.Vector3(0,0,sourceLayer),new THREE.Vector3(n,n,sourceLayer+1)),new THREE.Vector3(0,0,targetLayer),level,level);}};
  if(tree)for(let layer=0;layer<layout.treeLayers;layer++)copy(tree.texture,layer,layer);
  for(let layer=0;layer<plan.layers;layer++)copy(generic.texture,layer,layout.treeLayers+layer);
  assert();generic.dispose();generic=undefined;const retained=output;output=undefined;let closed=false;delivered=true;
  return{texture:retained.texture,pages:plan.pages.map(p=>({...p,bodyLayer:p.bodyLayer+layout.treeLayers,...(p.inkLayer===undefined?{}:{inkLayer:p.inkLayer+layout.treeLayers})})),gpuBytes:layout.gpuBytes,cpuBytes:64*16,stats:{...budget,genericPreparationPeakGpuBytes:budget.peakGpuBytes,copyPhasePeakGpuBytes,peakGpuBytes,submittedWorkFenceCompleted:true,commonResourceArray:true,treeLayers:layout.treeLayers,genericLayers:plan.layers,finalLayers:layout.layers,copiedMipLevels:LEVELS,treePixelsResampled:false,additionalPeakGpuBytes:layout.gpuBytes},assertCurrent(){if(closed)throw Error('Common resource bank retired');},dispose(){if(closed)return;retained.dispose();closed=true;}};
 }catch(error){primary=error;throw error;}finally{if(!delivered){const errors:unknown[]=[];if(generic)try{generic.dispose();}catch(error){retainFailedCleanup(generic);errors.push(error);}if(output)try{output.dispose();}catch(error){retainFailedCleanup(output);errors.push(error);}if(errors.length)throw new AggregateError([...(primary===undefined?[]:[primary]),...errors],'Resource bank preparation cleanup quarantined');}}
}
