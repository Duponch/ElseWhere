/** Affine placement AFTER the true Source ribbon has been generated.
 * No edge detection, seed, topology, UV or provenance field is reconstructed. */
import * as THREE from 'three/webgpu';
export function validateRibbonPostTransform(matrix:THREE.Matrix4):void{
 const e=matrix.elements;if(e.some(v=>!Number.isFinite(v))||e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1||matrix.determinant()<=0)throw Error('Ink post-transform requires positive finite affine placement');
}
export function transformGeneratedRibbon(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4):void{
 validateRibbonPostTransform(matrix);
 if(matrix.elements.every((v,i)=>v===(i%5===0?1:0)))return;
 const base:unknown=geometry.userData.referenceBrushBasePositions,width:unknown=geometry.userData.referenceBrushWidthOffsets,rough:unknown=geometry.userData.referenceBrushRoughOffsets;
 if(!(base instanceof Float32Array)||!(width instanceof Float32Array)||!(rough instanceof Float32Array)||base.length!==width.length||base.length!==rough.length)throw Error('True Source ribbon metadata required');
 geometry.applyMatrix4(matrix);const linear=new THREE.Matrix3().setFromMatrix4(matrix),v=new THREE.Vector3();
 for(let at=0;at<base.length;at+=3){v.fromArray(base,at).applyMatrix4(matrix);v.toArray(base,at);for(const array of [width,rough]){v.fromArray(array,at).applyMatrix3(linear);v.toArray(array,at);}}
}
