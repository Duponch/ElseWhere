/** One Source-colour compiler contract for rigid canonical surface families. */
import type * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from '../../../graphics-style';
import type {FaceStrokeData} from '../../../surfaces/FaceStrokeTable';
export class PreparedSurfaceAdmissionRefusal extends Error {}
export type PreparedSurfaceFormat='rgba'|'bi';
export type PreparedSurfaceLinear=readonly[number,number,number,number,number,number,number,number,number];
export interface PreparedSurfaceModel {
 readonly key:string;readonly geometry:THREE.BufferGeometry;readonly chartUvAttribute:string;
 /** Source global face ID, constant on each original triangle. */
 faceId(vertex:number):number;assertCurrent():void;
}
export interface PreparedSurfaceVariant {
 /** Canonical semantic model/affine metric identity, never World/slot/pose. */
 readonly key:string;readonly model:PreparedSurfaceModel;readonly linear:PreparedSurfaceLinear;
 /** Uniform scale bound in real world-cell units; metric normalization cancels
  * the uniform factor, but retained texel density must cover this real bound. */
 readonly maxUniformScale:number;readonly format:PreparedSurfaceFormat;
}
export interface PreparedSurfaceSource {
 readonly key:string;readonly context:GraphicsStyleContext;readonly stroke:FaceStrokeData;
 /** Body is the CURRENT Source unlit colour, before ink. For BI it is the
  * proved tint-independent unit body; no colour transfer is reimplemented. */
 buildTerms(surfacePosition:THREE.Node<'vec3'>):Readonly<{body:THREE.Node<'vec3'>;ink:THREE.Node<'vec4'>}>;
 assertCurrent():void;
}
export interface PreparedSurfaceTile {
 readonly variant:number;readonly face:number;readonly triangles:readonly number[];
 readonly rawBounds:readonly[number,number,number,number];readonly page:number;
 readonly rect:Readonly<{x:number;y:number;width:number;height:number}>;
 readonly content:Readonly<{x:number;y:number;width:number;height:number}>;
}
export interface PreparedSurfacePage {readonly format:PreparedSurfaceFormat;readonly bodyLayer:number;readonly inkLayer?:number}
export interface PreparedSurfaceLimits {
 readonly maxCpuBytes:number;readonly maxRetainedGpuBytes:number;readonly maxPeakGpuBytes:number;
 readonly oldLiveGpuBytes:number;readonly otherLiveGpuBytes:number;readonly oldLiveCpuBytes:number;
 readonly maxPages:number;readonly maxFaces:number;
}
export interface PreparedSurfacePlan {
 readonly key:string;readonly source:PreparedSurfaceSource;readonly variants:readonly PreparedSurfaceVariant[];
 readonly size:128|256|512|1024|2048;readonly levels:4;readonly pages:readonly PreparedSurfacePage[];
 readonly layers:number;readonly tiles:readonly PreparedSurfaceTile[];
 readonly maxPhysicalCellPixels:number;readonly oversampling:number;
 readonly retainedGpuBytes:number;readonly retainedCpuBytes:number;readonly limits:PreparedSurfaceLimits;
 assertCurrent():void;
}
export interface PreparedSurfaceGpuResult {
 readonly texture:THREE.Texture;readonly pages:readonly PreparedSurfacePage[];
 readonly gpuBytes:number;readonly cpuBytes:number;readonly stats:Readonly<Record<string,unknown>>;
 assertCurrent():void;dispose():void;
}
