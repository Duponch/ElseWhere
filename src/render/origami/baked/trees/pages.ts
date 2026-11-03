/** Exclusive fixed2048/mip4 GPU-page assembly. No raster, readback, format
 * conversion, downscale, global renderer override or per-frame operation. */
import * as THREE from 'three/webgpu';
export interface TreePageDemand {key:string;width:2048;height:2048;levels:4;preparationPeakGpuBytes:number;preparationCpuBytes:number}
export interface TreeArrayLimits {maxPages:number;maxArrayLayers:number;maxTextureSize:number;maxPeakGpuBytes:number;maxCpuBytes:number;existingLiveGpuBytes:number;existingLiveCpuBytes:number;sharedCpuBytes:number}
export interface TreeArrayPlan {key:string;kind:'2d'|'array';entries:readonly{key:string;layer:number}[];schedule:readonly number[];width:2048;height:2048;levels:4;retainedGpuBytes:number;sourcePageGpuBytes:number;peakGpuBytes:number;preparationCpuBytes:number;existingLiveGpuBytes:number;copyCommands:number}
export interface BorrowedTreePage {texture:THREE.Texture;dispose():void}
export type TreePageCopyPort=Pick<THREE.WebGPURenderer,'initRenderTarget'|'copyTextureToTexture'>;
const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0;
export const PAGE_GPU_BYTES=2048*2048*4*(1+1/4+1/16+1/64);
export function planTreeArrayPages(demands:readonly TreePageDemand[],paintAndLayoutFingerprint:string,limits:TreeArrayLimits):TreeArrayPlan|undefined{
 for(const n of Object.values(limits))if(!integer(n))throw Error('Explicit finite tree array limits/live bytes required');
 if(!demands.length)return undefined;if(!paintAndLayoutFingerprint||demands.length>limits.maxPages||demands.length>limits.maxArrayLayers||limits.maxTextureSize<2048)throw Error('Tree array page/capability admission refused BEFORE allocation');
 const seen=new Set<string>();for(const d of demands){if(!d.key||seen.has(d.key)||d.width!==2048||d.height!==2048||d.levels!==4||!integer(d.preparationPeakGpuBytes)||d.preparationPeakGpuBytes<PAGE_GPU_BYTES||!integer(d.preparationCpuBytes))throw Error('Exact unique2048/mip4 prepared pages required');seen.add(d.key);}
 const schedule=demands.map((_,i)=>i).sort((a,b)=>demands[b]!.preparationPeakGpuBytes-demands[a]!.preparationPeakGpuBytes||a-b),retainedGpuBytes=PAGE_GPU_BYTES*demands.length,kind=demands.length===1?'2d':'array';
 // Largest bake BEFORE array allocation. Once its final21.25MiB remains, allocate
 // the destination, copy/release it, then bake/copy one further page at a time.
 const peakGpuBytes=limits.existingLiveGpuBytes+(kind==='2d'?demands[0]!.preparationPeakGpuBytes:Math.max(demands[schedule[0]!]!.preparationPeakGpuBytes,retainedGpuBytes+PAGE_GPU_BYTES,...schedule.slice(1).map(i=>retainedGpuBytes+demands[i]!.preparationPeakGpuBytes))),preparationCpuBytes=limits.existingLiveCpuBytes+limits.sharedCpuBytes+Math.max(...demands.map(d=>d.preparationCpuBytes))+demands.length*4*64;
 if(!Number.isSafeInteger(peakGpuBytes)||peakGpuBytes>limits.maxPeakGpuBytes||preparationCpuBytes>limits.maxCpuBytes)throw Error('Tree array old-live/new/preparation peak refused BEFORE allocation');
 return Object.freeze({key:JSON.stringify({version:'tree-array-2048-rgba8srgb-m4-v1',paintAndLayoutFingerprint,pages:demands.map(d=>d.key)}),kind,entries:Object.freeze(demands.map((d,layer)=>Object.freeze({key:d.key,layer}))),schedule:Object.freeze(schedule),width:2048,height:2048,levels:4,retainedGpuBytes,sourcePageGpuBytes:PAGE_GPU_BYTES,peakGpuBytes,preparationCpuBytes,existingLiveGpuBytes:limits.existingLiveGpuBytes,copyCommands:kind==='2d'?0:demands.length*4});
}
/** Metadata only, no pixel array. N>=2 uses the constructor's actual array
 * flag. N=1 retains the acquired2D page instead; no one-layer flag override. */
export function createTreeArrayTarget(plan:TreeArrayPlan):THREE.RenderTarget{
 if(plan.kind!=='array'||plan.entries.length<2)throw Error('Single page must retain its original2D owner');
 const target=new THREE.RenderTarget(2048,2048,{depth:plan.entries.length,samples:0,type:THREE.UnsignedByteType,format:THREE.RGBAFormat,colorSpace:THREE.SRGBColorSpace,depthBuffer:false,stencilBuffer:false,generateMipmaps:false,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter});
 if(!target.texture.isArrayTexture){target.dispose();throw Error('Actual layered RenderTarget flag missing');}target.texture.flipY=false;target.texture.wrapS=target.texture.wrapT=THREE.ClampToEdgeWrapping;target.texture.mipmaps=Array.from({length:4},(_,level)=>({data:new Uint8Array(0),width:2048/2**level,height:2048/2**level}));return target;
}
function validate(page:BorrowedTreePage):void{const t=page.texture,image=t.image as {width?:number;height?:number};if(!t.isRenderTargetTexture||t.isArrayTexture||t.colorSpace!==THREE.SRGBColorSpace||t.type!==THREE.UnsignedByteType||t.format!==THREE.RGBAFormat||t.flipY||t.generateMipmaps||image.width!==2048||image.height!==2048||t.mipmaps.length!==4)throw Error('Exact cooked unflipped2D RGBA8sRGB/mip4 source required');for(let l=0;l<4;l++){const mip=t.mipmaps[l] as {width?:number;height?:number};if(mip.width!==2048/2**l||mip.height!==2048/2**l)throw Error('Source mip dimensions differ');}}
/** Caller holds the exclusive renderer, existing live owner and reservation.
 * This returns ONLY after every page copied; errors never publish a partial
 * array. Previous owner's texture/material/leases are never touched. */
export async function buildTreeArrayPages(port:TreePageCopyPort,demands:readonly TreePageDemand[],fingerprint:string,limits:TreeArrayLimits,prepare:(key:string)=>Promise<BorrowedTreePage>,assertCurrent:()=>void){
 const plan=planTreeArrayPages(demands,fingerprint,limits);if(!plan)return undefined;assertCurrent();let target:THREE.RenderTarget|undefined,delivered=false;
 if(plan.kind==='2d'){const page=await prepare(demands[0]!.key);let retained=false;try{assertCurrent();validate(page);let closed=false;retained=true;return{texture:page.texture,plan,stats:{pages:1,mips:4,copies:0,readback:false,resampled:false,retainedGpuBytes:plan.retainedGpuBytes,peakGpuBytes:plan.peakGpuBytes,scope:'Original cooked2D owner retained, no array allocation or copy; no Native quality/performance admission'},dispose(){if(closed)return;closed=true;page.dispose();}};}finally{if(!retained)page.dispose();}}
 try{for(const at of plan.schedule){assertCurrent();const page=await prepare(demands[at]!.key);try{assertCurrent();validate(page);if(!target){target=createTreeArrayTarget(plan);port.initRenderTarget(target);assertCurrent();}
    for(let level=0;level<4;level++){assertCurrent();const size=2048/2**level;port.copyTextureToTexture(page.texture,target.texture,new THREE.Box2(new THREE.Vector2(0,0),new THREE.Vector2(size,size)),new THREE.Vector3(0,0,at),level,level);}
   }finally{page.dispose();}}
  assertCurrent();if(!target)throw Error('Missing complete tree array');const owner=target;let closed=false;delivered=true;return{texture:owner.texture,plan,stats:{pages:plan.entries.length,mips:4,copies:plan.copyCommands,readback:false,resampled:false,retainedGpuBytes:plan.retainedGpuBytes,peakGpuBytes:plan.peakGpuBytes,scope:'Nominal owned bytes including declared old-live; excludes undeclared driver/other owners. Not Native or visual admission'},dispose(){if(closed)return;closed=true;owner.dispose();}};
 }finally{if(!delivered)target?.dispose();}
}
