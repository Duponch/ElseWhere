/** Preparation-only alpha reuse, after both final B/I layers and every mip
 * already exist. RGB is fetched at the identical integer texel and mip; this
 * is not a resolve, resample, dilation or a replacement for the colour bank.
 *
 * Ink alpha is deliberately ignored: RGBA8 can retain nonzero RGB while its
 * separately quantized alpha is zero. The boolean mask uses STORED ink RGB.
 * A filtered mask of exactly zero therefore certifies zero ink over its entire
 * nonnegative filtering footprint, including both levels of trilinear filtering.
 * The sRGB read/write byte roundtrip still requires Native qualification.
 */
import * as THREE from 'three/webgpu';
import {Fn,int,ivec2,textureLoad,vec2,vec4} from 'three/tsl';

export interface InkOccupancyPreparationEvent {
 readonly phase:'before'|'packed';
 readonly family:'rigid'|'plant';readonly page:number;
 readonly renderer:THREE.WebGPURenderer;readonly bank:THREE.Texture;
 readonly bodyLayer:number;readonly inkLayer:number;readonly level:number;
 readonly width:number;readonly height:number;
 /** BEFORE may copy bank B/I into this existing base-level scratch for public
  * readback. PACKED is READ-ONLY: its pixels are copied to Body immediately
  * after the observer resolves. No extra render target is allocated. */
 readonly scratch:THREE.RenderTarget;
 assertCurrent():void;
}
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
):THREE.Node<'vec4'> {
 const image=source.image as{width?:number;height?:number;depth?:number};
 if(!(source.isArrayTexture||source instanceof THREE.DataArrayTexture)||source.format!==THREE.RGBAFormat||source.type!==THREE.UnsignedByteType||source.colorSpace!==THREE.SRGBColorSpace||source.flipY||!Number.isSafeInteger(level)||level<0||level>3||size.some(n=>!Number.isSafeInteger(n)||n<1)||image?.width!==size[0]*2**level||image.height!==size[1]*2**level)throw Error('Ink occupancy needs the existing unflipped RGBA8 sRGB array and exact mip dimensions');
 return Fn(()=>{
  const pixel=ivec2(uv.mul(vec2(size[0],size[1]))),
   body=textureLoad(source,pixel,int(level)).depth(bodyLayer).toVar(),
   ink=textureLoad(source,pixel,int(level)).depth(inkLayer).toVar();
  return vec4(body.rgb,ink.r.max(ink.g).max(ink.b).greaterThan(0).select(1,0));
 })();
}
