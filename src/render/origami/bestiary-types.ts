// Shared bestiary type boundary only; no runtime imports or registration.
import type * as Three from 'three/webgpu';

export type ThreeAPI=typeof import('three/webgpu');
export type Triple=readonly [number,number,number];
export interface BestiaryPaintConfig {
 readonly baseColor:string;readonly secondaryColor?:string;readonly accentColor?:string;
 readonly strokeStyle?:string;readonly strokeCount?:number;
 readonly gradientTip?:{readonly color:string};
 readonly flankStripe?:{readonly bellyColor:string;readonly stripeColor:string};
}
export type BestiaryMaterial=Three.MeshBasicMaterial;
export interface PartOptions {
 readonly pos?:readonly number[];readonly rot?:readonly number[];readonly scale?:readonly number[];
 readonly castShadow?:boolean;readonly receiveShadow?:boolean;readonly edgeAngle?:number;
}
export interface EyeSurface {
 readonly point:readonly number[];readonly normal:readonly number[];readonly clearance:number;
}
export interface ReferenceSurfaceHit {point:Three.Vector3;normal:Three.Vector3}
export interface BestiaryMeshData extends Record<string,unknown> {
 referenceEdgeAngle?:number;referenceAnatomyRole?:string;referenceEyeMark?:number;
 referenceEyeSurface?:EyeSurface;referenceAuthoredAdaptation?:boolean;
 referenceLimbOrdinal?:number;referenceLimbKind?:string;referenceHornAnchor?:readonly number[];
 referenceAdaptationPartOrdinal?:number;referenceSourcePartOrdinal?:number;
 referencePresentationChange?:string;
}
export type BestiaryMesh=Three.Mesh<Three.BufferGeometry,BestiaryMaterial>&{userData:BestiaryMeshData};
export interface AdaptationBounds {readonly min:readonly number[];readonly max:readonly number[];readonly size:readonly number[]}
export interface AdaptationReceipt {
 readonly id:string;readonly parent:string;readonly literalCopy:false;readonly productionIntegrated:boolean;
 readonly changes:readonly string[];readonly bounds:AdaptationBounds;
 readonly torsoBounds:{readonly min:readonly number[];readonly max:readonly number[]};
 readonly trunkLengthX:number;readonly headPivot:readonly number[]|null;
 readonly legPivots:readonly (readonly number[]|null)[];readonly tailPivot:readonly number[]|null;readonly meshCount:number;
}
export interface BestiaryGroupData extends Record<string,unknown> {
 headGroup:Three.Group;legs:Three.Object3D[];primaryMaterial:BestiaryMaterial;tailGroup?:Three.Group;
 referenceEyeMeshes?:BestiaryMesh[];referenceAdaptation?:AdaptationReceipt;
 referenceAnatomyRole?:string;referenceLimbOrdinal?:number;referenceLimbKind?:string;
 referenceHornAnchor?:readonly number[];
}
export type BestiaryGroup=Three.Group&{userData:BestiaryGroupData};
export interface MaterialRecord {readonly key:string;readonly config:BestiaryPaintConfig;readonly material:BestiaryMaterial}
export type RegisterMaterial=(key:string,config:BestiaryPaintConfig)=>BestiaryMaterial;
export type CreatePart=(geometry:Three.BufferGeometry,material:BestiaryMaterial,options?:PartOptions)=>BestiaryMesh;
export interface BestiaryFactory {
 readonly ids:readonly string[];readonly materialRecords:readonly MaterialRecord[];
 build(id:string):BestiaryGroup;
}
