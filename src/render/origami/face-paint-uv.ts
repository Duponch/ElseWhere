import * as THREE from 'three/webgpu';

/** ExtrudeGeometry's world-space UVs can be negative or occupy only a small
 * fraction of the fill mask. Give each planar cut-card face its own unit chart
 * before the existing physical pigment metric. Coplanar triangulation seams
 * share one chart, including concave front/back caps. The source is untouched.
 * This is a compilation-time correction: no extra attribute, material or draw. */
export function normalizeCutoutPaintUvs(source:THREE.BufferGeometry):THREE.BufferGeometry {
 const geometry=source.index?source.toNonIndexed():source.clone(),position=geometry.getAttribute('position'),sourceUv=geometry.getAttribute('uv');
 const coordinates=new Float32Array(position.count*2),groups=new Map<string,{vertices:number[];axes:readonly[number,number]}>();
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let first=0;first+2<position.count;first+=3){
  a.fromBufferAttribute(position,first);b.fromBufferAttribute(position,first+1);c.fromBufferAttribute(position,first+2);
  normal.crossVectors(b.sub(a),c.sub(a));if(normal.lengthSq()<1e-20)continue;normal.normalize();
  const plane=normal.dot(a),key=[normal.x,normal.y,normal.z,plane].map(value=>Math.round(value*1e5)).join(':');
  let group=groups.get(key);if(!group){const n=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)],major=n.indexOf(Math.max(...n));group={vertices:[],axes:major===0?[2,1]:major===1?[0,2]:[0,1]};groups.set(key,group);}
  group.vertices.push(first,first+1,first+2);
 }
 for(const {vertices,axes}of groups.values()){
  let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity;
  for(const vertex of vertices){const u=sourceUv?.getX(vertex)??position.getComponent(vertex,axes[0]),v=sourceUv?.getY(vertex)??position.getComponent(vertex,axes[1]);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);}
  const fallback=maxU-minU<1e-9||maxV-minV<1e-9;
  if(fallback){minU=minV=Infinity;maxU=maxV=-Infinity;for(const vertex of vertices){const u=position.getComponent(vertex,axes[0]),v=position.getComponent(vertex,axes[1]);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);}}
  for(const vertex of vertices){const u=fallback?position.getComponent(vertex,axes[0]):sourceUv?.getX(vertex)??position.getComponent(vertex,axes[0]),v=fallback?position.getComponent(vertex,axes[1]):sourceUv?.getY(vertex)??position.getComponent(vertex,axes[1]);coordinates[vertex*2]=(u-minU)/Math.max(1e-9,maxU-minU);coordinates[vertex*2+1]=(v-minV)/Math.max(1e-9,maxV-minV);}
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(coordinates,2));return geometry;
}
