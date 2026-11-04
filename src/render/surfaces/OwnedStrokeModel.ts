/** Shared immutable shape + exact Source stroke addresses. Model preparation
 * is CPU-only and never depends on texture encoding. In r186 the scalar SSBO
 * is retained until renderer/device teardown unless its producer explicitly
 * anchors final retirement on a genuinely initialized geometry. dispose()
 * invalidates the CPU owner; it is not a standalone GPU retirement claim. */
import * as THREE from 'three/webgpu';
import {compileNaturalSurfaceModels,interleaveNaturalSurfaceFields,SURFACE_STROKE_UV,SURFACE_STROKE_FACE,type NaturalSurfaceModels} from './NaturalSurfaceModels';
import type {FaceStrokeData} from './FaceStrokeTable';
export class OwnedStrokeModel {
 readonly geometry:THREE.BufferGeometry;readonly stroke:FaceStrokeData;
 readonly gpuLifetime='renderer' as const;
 private readonly library:NaturalSurfaceModels;
 constructor(source:THREE.BufferGeometry,maxCpuBytes=64*1024*1024,packedAddress=false){
  let library:NaturalSurfaceModels|undefined;
  try{library=compileNaturalSurfaceModels([source],maxCpuBytes);this.library=library;this.geometry=this.library.geometries[0]!;
   if(packedAddress){const coordinates=this.geometry.getAttribute(SURFACE_STROKE_UV),faces=this.geometry.getAttribute(SURFACE_STROKE_FACE),values=new Float32Array(coordinates.count*3);for(let v=0;v<coordinates.count;v++)values.set([coordinates.getX(v),coordinates.getY(v),faces.getX(v)],v*3);this.geometry.setAttribute(SURFACE_STROKE_UV,new THREE.BufferAttribute(values,3));}
   interleaveNaturalSurfaceFields(this.geometry);this.stroke=this.library.stroke;}catch(error){library?.dispose();throw error;}finally{source.dispose();}
 }
 dispose():void{this.library.dispose();}
}
