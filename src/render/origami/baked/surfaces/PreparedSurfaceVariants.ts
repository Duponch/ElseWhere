/** Source authoring intent, not per-instance/World identity. Uniform scale
 * and rigid rotation are isometries of the normalized paint/brush metric. */
import type * as THREE from 'three/webgpu';
import type {FaceStrokeData} from '../../../surfaces/FaceStrokeTable';
import {SURFACE_STROKE_FACE,SURFACE_STROKE_UV} from '../../../surfaces/NaturalSurfaceModels';
import {PreparedSurfaceAdmissionRefusal,type PreparedSurfaceModel,type PreparedSurfaceVariant} from './PreparedSurfaceTypes';
export function preparedNaturalModel(key:string,geometry:THREE.BufferGeometry,stroke:FaceStrokeData):PreparedSurfaceModel{
 const index=geometry.index,p=geometry.getAttribute('position'),uv=geometry.getAttribute(SURFACE_STROKE_UV),faces=geometry.getAttribute(SURFACE_STROKE_FACE);if(!index||!p||!uv||!faces)throw new PreparedSurfaceAdmissionRefusal('Complete canonical natural geometry required');return{key,geometry,chartUvAttribute:SURFACE_STROKE_UV,faceId:v=>faces.getX(v),assertCurrent(){stroke.assertCurrent();if(geometry.index!==index||geometry.getAttribute('position')!==p||geometry.getAttribute(SURFACE_STROKE_UV)!==uv||geometry.getAttribute(SURFACE_STROKE_FACE)!==faces)throw Error('Canonical natural model replaced');}};
}
export function preparedDiagonalVariant(model:PreparedSurfaceModel,x:number,y:number,z:number):PreparedSurfaceVariant{
 const dimensions=[Math.abs(x),Math.abs(y),Math.abs(z)];if(dimensions.some(n=>!Number.isFinite(n)||n<=0))throw new PreparedSurfaceAdmissionRefusal('Visible affine diagonal scale required');const largest=Math.max(...dimensions),linear=[dimensions[0]!/largest,0,0,0,dimensions[1]!/largest,0,0,0,dimensions[2]!/largest]as const,maxUniformScale=Math.ceil(largest*2)/2;
 // The half-cell bound affects only oversampling; it never approximates the
 // exact normalized metric. Identical aspect+bound instances share one chart.
 return Object.freeze({key:JSON.stringify(['canonical-diagonal-v1',model.key,linear,maxUniformScale]),model,linear,maxUniformScale,format:'bi'});
}
