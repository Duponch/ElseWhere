/** Natural/prop model topology shared by every texture encoding. Compilation
 * preserves the original triangle order and stroke seed of EACH source model;
 * the scalar stroke records are combined only after those independent passes. */
import * as THREE from 'three/webgpu';
import {attribute} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import {compileFaceStrokeTable,combineFaceStrokeTables,faceStrokeVertexHeaders,createFaceStrokeNode,type FaceStrokeTable,type FaceStrokeData} from './FaceStrokeTable';

export const SURFACE_STROKE_UV='surfaceStrokeUv',SURFACE_STROKE_FACE='surfaceStrokeFace';
const instanced=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;

/** Authored paint UVs may be singular on a perfectly valid side face (e.g. a
 * sandbag). Give stroke projection its own nonsingular planar coordinates;
 * body/Pastel UVs and all physical corners remain untouched. */
function strokeSource(source:THREE.BufferGeometry):THREE.BufferGeometry{
 const p=source.getAttribute('position'),index=source.index,total=index?.count??p.count;
 if(total%3)throw Error('Natural surface model requires complete triangles');
 const originalUv=source.getAttribute('uv');let regular=!!originalUv;
 if(originalUv)for(let at=0;at<total&&regular;at+=3){const a=index?.getX(at)??at,b=index?.getX(at+1)??at+1,c=index?.getX(at+2)??at+2,det=(originalUv.getX(b)-originalUv.getX(a))*(originalUv.getY(c)-originalUv.getY(a))-(originalUv.getY(b)-originalUv.getY(a))*(originalUv.getX(c)-originalUv.getX(a));regular=Number.isFinite(det)&&Math.abs(det)>1e-20;}
 // The common case keeps the original index/vertex domain, including the
 //24-corner cube. Only a genuine UV-singular surface needs corner expansion.
 if(regular){const copy=source.clone();copy.setAttribute(SURFACE_STROKE_UV,originalUv!.clone());return copy;}
 const result=new THREE.BufferGeometry();
 for(const[name,a]of Object.entries(source.attributes)){if(instanced(a))continue;const values=new Float32Array(total*a.itemSize);for(let i=0;i<total;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.getComponent(index?.getX(i)??i,c);result.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}
 const positions=result.getAttribute('position'),authored=result.getAttribute('uv'),coordinates=new Float32Array(total*2),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let first=0;first<total;first+=3){
  const determinant=authored?(authored.getX(first+1)-authored.getX(first))*(authored.getY(first+2)-authored.getY(first))-(authored.getY(first+1)-authored.getY(first))*(authored.getX(first+2)-authored.getX(first)):0;
  a.fromBufferAttribute(positions,first);b.fromBufferAttribute(positions,first+1);c.fromBufferAttribute(positions,first+2);normal.crossVectors(b.sub(a),c.sub(a));
  const axis=Math.abs(normal.x)>Math.abs(normal.y)?Math.abs(normal.x)>Math.abs(normal.z)?0:2:Math.abs(normal.y)>Math.abs(normal.z)?1:2;
  for(let i=first;i<first+3;i++)if(authored&&Math.abs(determinant)>1e-20){coordinates[i*2]=authored.getX(i);coordinates[i*2+1]=authored.getY(i);}else if(axis===0){coordinates[i*2]=positions.getZ(i);coordinates[i*2+1]=positions.getY(i);}else if(axis===1){coordinates[i*2]=positions.getX(i);coordinates[i*2+1]=positions.getZ(i);}else{coordinates[i*2]=positions.getX(i);coordinates[i*2+1]=positions.getY(i);}
 }
 result.setAttribute(SURFACE_STROKE_UV,new THREE.BufferAttribute(coordinates,2));
 for(const group of source.groups)result.addGroup(group.start,group.count,group.materialIndex);
 result.setDrawRange(source.drawRange.start,source.drawRange.count);return result;
}

export interface NaturalSurfaceModels {
 readonly geometries:readonly THREE.BufferGeometry[];
 readonly stroke:FaceStrokeData;
 readonly cpuBytes:number;
 dispose():void;
}

/** Resident instancing has no435 ordinary-buffer requirement. Pack immutable
 * fields once so adding face topology never exceeds eight vertex bindings.
 * Names, values and triangle indices are unchanged; instance aliases stay out. */
export function interleaveNaturalSurfaceFields(geometry:THREE.BufferGeometry):void{
 const fields=Object.entries(geometry.attributes).filter(([,a])=>!instanced(a)),count=geometry.getAttribute('position').count,stride=fields.reduce((n,[,a])=>n+a.itemSize,0),values=new Float32Array(count*stride),buffer=new THREE.InterleavedBuffer(values,stride);let offset=0;
 for(const[name,a]of fields){if(a.count!==count)throw Error('Natural static fields require one vertex domain');for(let vertex=0;vertex<count;vertex++)for(let c=0;c<a.itemSize;c++)values[vertex*stride+offset+c]=a.getComponent(vertex,c);geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(buffer,a.itemSize,offset,a.normalized));offset+=a.itemSize;}
}

export function compileNaturalSurfaceModels(sources:readonly THREE.BufferGeometry[],maxCpuBytes=64*1024*1024,options:{readonly maxTriangles?:number}={}):NaturalSurfaceModels{
 if(!sources.length||!Number.isSafeInteger(maxCpuBytes)||maxCpuBytes<1)throw Error('Explicit natural model vocabulary/budget required');
 const prepared:THREE.BufferGeometry[]=[],tables:FaceStrokeTable[]=[],outputs:THREE.BufferGeometry[]=[];let bank:ReturnType<typeof combineFaceStrokeTables>|undefined,delivered=false;
 try{
  for(const source of sources){const p=strokeSource(source);prepared.push(p);tables.push(compileFaceStrokeTable(p,{uvAttribute:SURFACE_STROKE_UV,maxCpuBytes,maxTriangles:options.maxTriangles??20000}));}
  bank=combineFaceStrokeTables(tables,{maxCpuBytes});
  for(let model=0;model<sources.length;model++){
   const source=sources[model]!,p=prepared[model]!,table=tables[model]!,g=new THREE.BufferGeometry();outputs.push(g);
   for(const[name,a]of Object.entries(p.attributes)){const values=new Float32Array(table.sourceVertex.length*a.itemSize);for(let i=0;i<table.sourceVertex.length;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.getComponent(table.sourceVertex[i]!,c);g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}
   const faces=Float32Array.from(table.faceIds,id=>id+bank!.faceOffsets[model]!);g.setAttribute(SURFACE_STROKE_FACE,new THREE.BufferAttribute(faces,1));g.setIndex(new THREE.BufferAttribute(table.sourceVertex.length<=65535?new Uint16Array(table.sourceIndex):table.sourceIndex.slice(),1));
   for(const group of source.groups)g.addGroup(group.start,group.count,group.materialIndex);g.setDrawRange(source.drawRange.start,source.drawRange.count);g.userData={...source.userData};g.computeBoundingBox();g.computeBoundingSphere();
  }
  const owner=bank,cpuBytes=owner.table.cpuBytes+outputs.reduce((n,g)=>n+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength??0),0);if(cpuBytes>maxCpuBytes)throw Error('Natural surface vocabulary retained budget exceeded');let closed=false;delivered=true;
  return{geometries:Object.freeze(outputs),stroke:owner.table,cpuBytes,dispose(){if(closed)return;closed=true;const errors:unknown[]=[];for(const g of outputs)try{g.dispose();}catch(e){errors.push(e);}try{owner.dispose();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Natural surface model cleanup failed');}};
 }finally{for(const p of prepared)p.dispose();for(const t of tables)t.dispose();if(!delivered){for(const g of outputs)g.dispose();bank?.dispose();}}
}

/** Original brush pigments/dryness with no companion surface draw. */
export function naturalStroke(context:GraphicsStyleContext|undefined,table:FaceStrokeData|undefined,faceId:THREE.Node<'float'>=attribute(SURFACE_STROKE_FACE,'float'),coordinates:THREE.Node<'vec2'>=attribute(SURFACE_STROKE_UV,'vec2'),vertexHeaders=false):(body:THREE.Node<'vec3'>)=>THREE.Node<'vec3'>{
 if(!context||!table)return body=>body;
 const headers=vertexHeaders?faceStrokeVertexHeaders({table,faceId,enabled:context.surfaceEncoding,opacity:context.lineOpacity},'v_naturalStrokeHeader'):undefined;
 return body=>createFaceStrokeNode(body,{table,faceId,headers,faceUv:coordinates,enabled:context.surfaceEncoding,width:context.edgeWidth,irregularity:context.strokeImperfection,opacity:context.lineOpacity,brushColor:context.brushColor as unknown as THREE.Node<'vec3'>,samplePigment:(p,dx,dy)=>context.sampleStrokePigment(p,dx,dy),sampleDry:(p,dx,dy)=>context.sampleStrokeDry(p,dx,dy)});
}
