/** PRIVATE Rock final-colour ABI. Original model/UV/face IDs remain Source. */
import type * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from '../../../graphics-style';
import type {RockFinalCanonicalInput} from '../../../surfaces/RockFinalSource';
import type {StrokeSettings} from '../../../surfaces/AffineStrokeOwner';

export type RockFinalPaintLease=ReturnType<GraphicsStyleContext['prepareAtlasPaint']>;
export interface RockFinalBakeInput extends RockFinalCanonicalInput {
 readonly position:Float32Array;
 readonly color:Float32Array;
 /** Original Source u,v,sparseFaceId. Never rewritten for atlas clipping. */
 readonly rockSurfaceUv:Float32Array;
 readonly indices:Uint32Array;
 readonly triangleFace:Uint32Array;
}
export interface RockFinalRect {readonly x:number;readonly y:number;readonly width:number;readonly height:number}
export interface RockFinalChart {
 readonly id:number;
 readonly page:number;
 readonly rect:RockFinalRect;
 readonly content:RockFinalRect;
 readonly faceIds:readonly number[];
}
export interface RockFinalLayout {
 readonly key:string;
 readonly size:1024|2048;
 readonly levels:4;
 /** Entire allocated array depth, including any empty reserve layers. */
 readonly layers:number;
 readonly charts:readonly RockFinalChart[];
 /** Sparse Source ID*8: (offsetU,offsetV,scaleU,scaleV),(layer,route,0,0).
  * route=1 prepared,0 body-only,-1 explicit Source; load in VS only. */
 readonly lookup:Float32Array;
 assertCurrent():void;
}
/** Disjoint LIVE allocation sets, including potentially uploaded retirement.
 * Missing declarations MUST remain null, never an optimistic zero. */
export interface RockFinalBudgetDeclarations {
 readonly sourceScope:string;
 readonly sourceCpuBytes:number|null;
 readonly sourceGpuBytes:number|null;
 readonly otherLiveGpuBytes:number|null;
 readonly oldAtlasCpuBytes:number|null;
 readonly oldAtlasGpuBytes:number|null;
 /** Candidate/old lookup high-water GPU ownership, not logical written rows. */
 readonly newLookupGpuBytes:number|null;
 readonly newLookupCpuBytes:number|null;
 readonly maxFamilyRetainedGpuBytes:number;
 readonly maxGlobalPeakGpuBytes:number;
 readonly maxPreparationCpuBytes:number;
}
export interface RockFinalGpuBudget {
 readonly schema:'rock-final-gpu-budget-v1';
 readonly layoutKey:string;
 readonly layers:number;
 readonly newBankCopies:number;
 readonly bankGpuBytes:number;
 readonly newAtlasGpuBytes:number;
 readonly familyLiveGpuBytes:number;
 readonly globalPeakGpuBytes:number;
 readonly preparationCpuBytes:number;
 readonly geometryBytes:number;
 readonly affineGpuBytes:number;
 readonly affinePeakCpuBytes:number;
 readonly paintCopyCpuBytes:number;
 readonly paintCopyGpuBytes:number;
 readonly scratchGpuBytes:number;
 readonly scope:string;
}
export interface RockFinalGpuBank {
 readonly texture:THREE.Texture;
 readonly layers:number;
 readonly size:1024|2048;
 readonly levels:4;
 readonly gpuBytes:number;
 readonly allocationKey:string;
 assertCurrent():void;
 /** Terminal. Caller must fence queued readers and hold presentation first. */
 dispose():void;
}
export interface RockFinalBakeSelection {readonly pageIds?:readonly number[];readonly panelIds?:readonly number[]}
export interface RockFinalBakeReceipt {
 readonly pages:readonly number[];
 readonly panels:number;
 readonly gpuBytes:number;
 readonly cpuBytes:number;
 readonly budget:RockFinalGpuBudget;
 readonly settings:StrokeSettings;
 readonly paintFingerprint:string;
 readonly lightingBaked:false;
 readonly sourceFactory:true;
 readonly sourcePositionDistinctFromClip:true;
 readonly finalStorage:'RGBA8-sRGB-4mips';
 readonly queueFence:true;
 readonly scope:string;
}
