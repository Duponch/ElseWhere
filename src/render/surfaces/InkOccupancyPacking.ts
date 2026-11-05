/** Preparation-only alpha reuse, after both final B/I layers and every mip
 * already exist. RGB is fetched at the identical integer texel and mip; this
 * is not a resolve, resample, dilation or a replacement for the colour bank.
 *
 * Ink alpha is deliberately ignored: RGBA8 can retain nonzero RGB while its
 * separately quantized alpha is zero. The boolean mask uses STORED ink RGB.
 * A filtered mask of exactly zero therefore certifies zero ink over its entire
 * nonnegative filtering footprint, including both levels of trilinear filtering.
 * An explicitly admitted scalar mode instead stores a quantized least-squares
 * coefficient of ACTUAL stored Ink.rgb. This is an approximation, not occupancy
 * and not an exact rank-one Source factorization. Original Ink remains intact.
 * The RGB roundtrip and scalar residual still require Native qualification.
 */
import * as THREE from 'three/webgpu';
import {Fn,int,ivec2,textureLoad,vec2,vec4} from 'three/tsl';
import {vec3} from 'three/tsl';
import type {PreparedSurfaceScalarInk} from '../origami/baked/surfaces/PreparedSurfaceTypes';

interface InkOccupancyPreparationBase {
 readonly family:'rigid'|'plant';readonly page:number;
 readonly renderer:THREE.WebGPURenderer;readonly bank:THREE.Texture;
 readonly bodyLayer:number;readonly inkLayer:number;readonly level:number;
 readonly width:number;readonly height:number;
 /** If present, Body.a is a quantized LS coefficient, NOT occupancy. The
  * private observer must measure the actual RGB residual, never assume exact. */
 readonly scalarInkColor?:readonly[number,number,number];
 /** BEFORE may copy bank B/I into this existing base-level scratch for public
  * readback. PACKED is READ-ONLY: its pixels are copied to Body immediately
  * after the observer resolves. No extra render target is allocated. */
 readonly scratch:THREE.RenderTarget;
 assertCurrent():void;
}
export type InkOccupancyPreparationEvent=InkOccupancyPreparationBase&(
 |{readonly phase:'before'|'packed';readonly compactBank?:never;readonly compactBodyLayer?:never}
 |{readonly phase:'compacted';readonly compactBank:THREE.Texture;readonly compactBodyLayer:number;readonly scalarInkColor:readonly[number,number,number]}
);
export type InkOccupancyPreparationWitness=(event:InkOccupancyPreparationEvent)=>void|Promise<void>;
const witnesses=new WeakMap<THREE.WebGPURenderer,InkOccupancyPreparationWitness>();
/** Explicit renderer-local preparation instrumentation. Normal product calls
 * never register it and perform no readback. The integrated private validator
 * owns/accounts its sequential readback buffers (at most16MiB each at2048²).
 * Public readback rows are256-byte aligned; validators must ignore row padding.
 * The observer may throw: the normal compiler quarantine then prevents publish.
 */
export function registerInkOccupancyPreparationWitness(renderer:THREE.WebGPURenderer,witness:InkOccupancyPreparationWitness):()=>void {
 if(witnesses.has(renderer))throw Error('An ink-occupancy preparation witness already owns this renderer');
 witnesses.set(renderer,witness);let closed=false;
 return()=>{if(closed)return;if(witnesses.get(renderer)===witness)witnesses.delete(renderer);closed=true;};
}
/** Capture once per exclusive preparation, never from a stable frame. */
export function inkOccupancyPreparationWitness(renderer:THREE.WebGPURenderer):InkOccupancyPreparationWitness|undefined{return witnesses.get(renderer);}

/** Optional approximation, admitted only by the caller's actual zero-effects,
 * zero-carton context. The source lease supplies the REAL uploaded f32 colour;
 * malformed, absent or degenerate bases keep the exact V67 B/I representation. */
export function preparedScalarInkBasis(enabled:boolean,color:readonly number[]|undefined):PreparedSurfaceScalarInk|undefined {
 if(!enabled||!color||color.length!==3||![0,1,2].every(index=>{const c=color[index];return typeof c==='number'&&Number.isFinite(c)&&c>=0&&c<=1;}))return undefined;
 const k=Object.freeze([Math.fround(color[0]!),Math.fround(color[1]!),Math.fround(color[2]!)])as readonly[number,number,number],norm=k[0]*k[0]+k[1]*k[1]+k[2]*k[2];
 if(!Number.isFinite(norm)||norm<1e-20)return undefined;
 return Object.freeze({color:k});
}

/** Public configured-canvas device only. No replacement renderer, custom
 * command encoder or readback. Missing capability retains full V69 scalar. */
export function scalarInkCompactionDevice(renderer:THREE.WebGPURenderer):GPUDevice|undefined {
 const context=typeof renderer.getContext==='function'?renderer.getContext()as GPUCanvasContext|WebGL2RenderingContext|undefined:undefined,
  device=context&&'getConfiguration'in context?context.getConfiguration()?.device:undefined;
 return device&&typeof device.queue.onSubmittedWorkDone==='function'?device:undefined;
}
/** Conservative simultaneous lifetime: the old full bank AND every existing
 * scratch are still live when the half-depth array is allocated. Optional
 * refusal keeps full V69 scalar; it never converts valid BI into Source. */
export function scalarInkCompactionBudget(input:{scalarInk:PreparedSurfaceScalarInk|undefined;allBiCanonical:boolean;fullLayers:number;fullGpuBytes:number;fullPeakGpuBytes:number;maxPeakGpuBytes:number;maxRetainedGpuBytes:number;fullCpuBytes:number;oldLiveCpuBytes:number;maxCpuBytes:number}){
 const layers=input.fullLayers/2,gpuBytes=input.fullGpuBytes/2,peakGpuBytes=input.fullPeakGpuBytes+gpuBytes,extraCpuBytes=layers*(4*64+32),peakCpuBytes=input.fullCpuBytes+input.oldLiveCpuBytes+extraCpuBytes,
  valid=[input.fullLayers,input.fullGpuBytes,input.fullPeakGpuBytes,input.maxPeakGpuBytes,input.maxRetainedGpuBytes,input.fullCpuBytes,input.oldLiveCpuBytes,input.maxCpuBytes].every(value=>Number.isSafeInteger(value)&&value>=0)&&Number.isSafeInteger(gpuBytes),
  reason=!valid?'invalid-budget':!input.scalarInk?'not-scalar':!input.allBiCanonical?'mixed-or-noncanonical-logical-pages':!Number.isSafeInteger(layers)||layers<1||layers>256?'physical-layer-limit':peakGpuBytes>input.maxPeakGpuBytes?'peak-budget':gpuBytes>input.maxRetainedGpuBytes?'retained-budget':peakCpuBytes>input.maxCpuBytes?'cpu-budget':undefined;
 return Object.freeze({eligible:reason===undefined,reason,layers,gpuBytes,peakGpuBytes,extraCpuBytes,peakCpuBytes});
}

/** `size` is the selected mip's dimensions, not the base-level dimensions.
 * The caller renders into a DISTINCT existing RGBA8 sRGB scratch attachment,
 * then copies only that body layer back after the draw has been submitted.
 * Never render with `source` itself attached while this node reads it.
 */
export function inkOccupancyPackingNode(
 source:THREE.Texture,
 bodyLayer:THREE.Node<'float'>,
 inkLayer:THREE.Node<'float'>,
 level:number,
 size:readonly[number,number],
 uv:THREE.Node<'vec2'>,
 scalarInkColor?:readonly[number,number,number],
):THREE.Node<'vec4'> {
 const image=source.image as{width?:number;height?:number;depth?:number};
 if(!(source.isArrayTexture||source instanceof THREE.DataArrayTexture)||source.format!==THREE.RGBAFormat||source.type!==THREE.UnsignedByteType||source.colorSpace!==THREE.SRGBColorSpace||source.flipY||!Number.isSafeInteger(level)||level<0||level>3||size.some(n=>!Number.isSafeInteger(n)||n<1)||image?.width!==size[0]*2**level||image.height!==size[1]*2**level)throw Error('Ink occupancy needs the existing unflipped RGBA8 sRGB array and exact mip dimensions');
 if(scalarInkColor&&(!preparedScalarInkBasis(true,scalarInkColor)||![0,1,2].every(index=>scalarInkColor[index]===Math.fround(scalarInkColor[index]!))))throw Error('Dense finite nondegenerate f32 scalar ink basis required');
 return Fn(()=>{
  const pixel=ivec2(uv.mul(vec2(size[0],size[1]))),
   body=textureLoad(source,pixel,int(level)).depth(bodyLayer).toVar(),
   ink=textureLoad(source,pixel,int(level)).depth(inkLayer).toVar();
  if(scalarInkColor){const k=vec3(scalarInkColor[0],scalarInkColor[1],scalarInkColor[2]);return vec4(body.rgb,ink.rgb.dot(k).div(k.dot(k)).clamp(0,1));}
  return vec4(body.rgb,ink.r.max(ink.g).max(ink.b).greaterThan(0).select(1,0));
 })();
}
