/** No duplicated RGB compositor. The renderer's own SharedPaintSurface and
 * original canonical stroke coverage are the two offline Source factories. */
import type * as THREE from 'three/webgpu';
import {attribute,vec3} from 'three/tsl';
import {sharedPaintColorNode,type SharedPaintSurfaceOptions} from '../../../surfaces/SharedPaintSurface';
import {queryFaceStrokeCoverage,type FaceStrokeData} from '../../../surfaces/FaceStrokeTable';
import type {GraphicsStyleContext} from '../../../graphics-style';
import {SURFACE_STROKE_FACE,SURFACE_STROKE_UV} from '../../../surfaces/NaturalSurfaceModels';
import {PreparedSurfaceAdmissionRefusal,type PreparedSurfaceSource} from './PreparedSurfaceTypes';
export interface CanonicalPreparedSourceOptions {
 readonly key:string;readonly context:GraphicsStyleContext;readonly stroke:FaceStrokeData;
 /** Exact original renderer options; caller proves that its post-paint
  * transform is a multiplicative runtime tint, independent of stroke RGB. */
 readonly bodyOptions:()=>SharedPaintSurfaceOptions;
 readonly faceId?:THREE.Node<'float'>;readonly strokeUv?:THREE.Node<'vec2'>;
 readonly unitBodyProven:true;readonly profileDomain?:'static78-separable';assertCurrent():void;
}
export function canonicalPreparedSurfaceSource(options:CanonicalPreparedSourceOptions):PreparedSurfaceSource {
 const assert=()=>{options.assertCurrent();options.stroke.assertCurrent();const original=options.bodyOptions();if(original.profile&&options.profileDomain!=='static78-separable')throw new PreparedSurfaceAdmissionRefusal('Non-generic Source requires an explicit separable static78 proof');};
 const c=options.context,faceId=options.faceId??attribute(SURFACE_STROKE_FACE,'float'),strokeUv=options.strokeUv??attribute(SURFACE_STROKE_UV,'vec2');
 return{key:options.key,context:c,stroke:options.stroke,assertCurrent:assert,buildTerms:surfacePosition=>{
  const original=options.bodyOptions();if(original.context!==c||!options.unitBodyProven)throw Error('Actual Source body/tint factorization required');
  const body=sharedPaintColorNode({...original,base:vec3(1),pastel:vec3(1),gouacheTransform:undefined,stroke:undefined,pigmentUv:undefined,surfacePosition});
  const ink=queryFaceStrokeCoverage({table:options.stroke,faceId,faceUv:strokeUv,surfacePosition,enabled:c.surfaceEncoding,opacity:c.lineOpacity,width:c.edgeWidth,irregularity:c.strokeImperfection,brushColor:c.brushColor.rgb,samplePigment:(uv,dx,dy)=>c.sampleStrokePigment(uv,dx,dy),sampleDry:(uv,dx,dy)=>c.sampleStrokeDry(uv,dx,dy)});
  return{body,ink};
 }};
}
