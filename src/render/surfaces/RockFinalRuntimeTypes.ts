/** PRIVATE runtime ABI. Source attributes/UV/tag IDs remain borrowed and exact. */
import type * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from '../graphics-style';
import type {SharedSurfacePreparationSnapshot,SharedSurfacePreparationStage} from './SharedSurfacePreparation';
export type RockFinalRoute='source'|'body'|'prepared';
export type RockFinalPanel={readonly id:number;readonly stableKey:string;readonly kind:'slab'|'top'|'side';readonly cell:number;readonly slot:number;readonly side:number;readonly firstTriangle:number;readonly triangleCount:number};
export interface RockFinalInput {
 readonly arrays:Readonly<{position:Float32Array;normal:Float32Array;color:Float32Array;rockSurfaceUv:Float32Array;sourceVertex:Uint32Array;indices:Uint32Array;triangleFace:Uint32Array;trianglePanel:Uint32Array;faceId:Uint32Array;faceHeader:Float32Array;faceEdgeOffset:Uint32Array;facePanel:Uint32Array;canonicalEdges:Float32Array}>;
 readonly panels:readonly RockFinalPanel[];readonly faceSpan:number;readonly cpuBytes:number;readonly width:number;readonly height:number;
 revision():string;assertCurrent():void;
}
export interface RockFinalChart {
 readonly id:number;readonly stableKey:string;readonly page:number;readonly cell:number;readonly kind:'top'|'side';readonly side:number;
 readonly firstTriangle:number;readonly triangleCount:number;readonly chartSplit:number;readonly faceIds:readonly number[];
 readonly rect:Readonly<{x:number;y:number;width:number;height:number}>;
 readonly content:Readonly<{x:number;y:number;width:number;height:number}>;
}
export interface RockFinalRuntimePlan {
 readonly key:string;readonly admitted:boolean;readonly refusal?:string;readonly size:1024|2048;readonly levels:4;readonly layers:number;readonly density:number;
 readonly charts:readonly RockFinalChart[];readonly lookup:Float32Array;readonly gpuBytes:number;readonly cpuBytes:number;
 readonly retainedGpuBytes:number;readonly peakGpuBytes:number;readonly maxCellPixels:number;readonly returnCellPixels:number;
 /** Every retained live Source/old/new/scratch byte is declared by the planner. */
 readonly permit:unknown;
 assertCurrent():void;
}
export interface RockFinalGpuBank {readonly texture:THREE.Texture;readonly gpuBytes:number;readonly cpuBytes:number;assertCurrent():void;dispose():void}
export interface RockFinalGpuPort {
 allocate(snapshot:SharedSurfacePreparationSnapshot,input:RockFinalInput,plan:RockFinalRuntimePlan,assertCurrent:()=>void):Promise<RockFinalGpuBank>;
 copyPages(snapshot:SharedSurfacePreparationSnapshot,from:RockFinalGpuBank,to:RockFinalGpuBank,pages:readonly number[],assertCurrent:()=>void):Promise<void>;
 /** Repaint ALL current charts on each selected page. Other pages stay exact. */
 bakePages(snapshot:SharedSurfacePreparationSnapshot,input:RockFinalInput,plan:RockFinalRuntimePlan,bank:RockFinalGpuBank,pages:readonly number[],assertCurrent:()=>void):Promise<void>;
 /** Public submitted-work fence. A failure keeps the resource quarantined. */
 fence(snapshot:SharedSurfacePreparationSnapshot):Promise<void>;
}
export interface RockFinalPublication {
 readonly route:RockFinalRoute;readonly style:'default'|'origami';readonly input?:RockFinalInput;readonly plan?:RockFinalRuntimePlan;readonly bank?:RockFinalGpuBank;
}
export interface RockFinalHost {
 readonly context:GraphicsStyleContext;
 collect(assertCurrent:()=>void):RockFinalInput;
 /** Publish only borrowed texture/lookup/index views while Core holds draw. */
 stage(binding:RockFinalPublication):SharedSurfacePreparationStage;
 /** World/style/camera lifecycle uses the existing shared registry exclusively. */
 readonly texturesEnabled:()=>boolean;
}
export class RockFinalAdmissionRefusal extends Error{}
