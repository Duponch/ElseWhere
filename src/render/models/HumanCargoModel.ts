/** Complete carried-item vocabulary, shared by carried and released poses.
 * Index ranges and original brush seeds survive; texture selection owns no
 * topology. One packed static stream leaves the seven instance buffers free. */
import * as THREE from 'three/webgpu';
import {cargoGeometry} from '../pawn-geometry';
import {indexExactStaticVertices} from '../origami/static-index';
import {compileNaturalSurfaceModels,SURFACE_STROKE_UV,SURFACE_STROKE_FACE,type NaturalSurfaceModels} from '../surfaces/NaturalSurfaceModels';
import {attachFaceStrokeGpuRetirement,type FaceStrokeData} from '../surfaces/FaceStrokeTable';

export class HumanCargoModel {
 private library?:NaturalSurfaceModels;private master?:THREE.InstancedBufferGeometry;private closed=false;
 get strokes():FaceStrokeData{this.prepare();return this.library!.stroke;}
 createGeometry():THREE.InstancedBufferGeometry{this.prepare();return this.master!.clone();}
 /** Does not prepare an absent model, and never mutates a live layout. */
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{if(this.library)attachFaceStrokeGpuRetirement(this.library.stroke,geometries);}
 private prepare():void{
  if(this.closed)throw Error('Shared carried-item model retired');if(this.master)return;
  const source=cargoGeometry();let library:NaturalSurfaceModels|undefined,master:THREE.InstancedBufferGeometry|undefined;
  try{
   indexExactStaticVertices(source);
   // Stock generation normally follows the active cargo groups. Preparation
   // explicitly requests the complete immutable index, with its global seeds.
   source.addGroup(0,source.index!.count,0);
   library=compileNaturalSurfaceModels([source],128*1024*1024,{maxTriangles:100000});
   const compiled=library.geometries[0]!,count=compiled.getAttribute('position').count,data=new Float32Array(count*16),packed=new THREE.InterleavedBuffer(data,16);master=new THREE.InstancedBufferGeometry();
   let offset=0;for(const[name,size]of [['position',3],['normal',3],['color',3],['cargoKind',1],['corpsePartMask',1],['uv',2],[SURFACE_STROKE_UV,2],[SURFACE_STROKE_FACE,1]] as const){const a=compiled.getAttribute(name);for(let vertex=0;vertex<count;vertex++)for(let c=0;c<size;c++)data[vertex*16+offset+c]=a.getComponent(vertex,c);master.setAttribute(name,new THREE.InterleavedBufferAttribute(packed,size,offset));offset+=size;}
   master.setIndex(compiled.index!.clone());master.userData={...source.userData};master.instanceCount=0;master.computeBoundingBox();master.computeBoundingSphere();this.library=library;this.master=master;
  }catch(error){master?.dispose();library?.dispose();throw error;}finally{source.dispose();}
 }
 dispose():void{if(this.closed)return;this.closed=true;this.master?.dispose();this.library?.dispose();this.master=undefined;this.library=undefined;}
}
