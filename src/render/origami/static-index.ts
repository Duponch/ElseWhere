import * as THREE from 'three/webgpu';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
export interface ExactStaticIndexFacts {vertices:number;referencedVertices:number;indices:number;mergedVertices:number}
const instanced=(a:Attribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;

/** Immutable actor bodies only. Reuse exactly equal static vertex records in
 * the post-transform cache, retaining buffers, triangle order and instance IDs.
 * All geometric attributes participate, including UVs, normals and rig tags;
 * a hard edge or a different anatomical owner can never be welded by position.
 * Do not use for independently mutable wear/brush/terrain vertex records.
 * Canonical model factories remain untouched; the product owner opts in once.
 */
export function indexExactStaticVertices(geometry:THREE.BufferGeometry):ExactStaticIndexFacts {
 if(Object.values(geometry.morphAttributes).some(attributes=>attributes.length))throw Error('Exact static indexing cannot merge morph targets.');
 const position=geometry.getAttribute('position'),count=position?.count??0;
 const attributes=Object.entries(geometry.attributes).filter(([,a])=>!instanced(a)).sort(([a],[b])=>a.localeCompare(b));
 const readers=attributes.map(([name,a])=>{
  if(a.count!==count)throw Error(`Incomplete static vertex attribute: ${name}`);
  const array=a.array,stride=a instanceof THREE.InterleavedBufferAttribute?a.data.stride:a.itemSize,offset=a instanceof THREE.InterleavedBufferAttribute?a.offset:0;
  // Float32 bit patterns distinguish -0 and retain every stored NaN payload.
  const values=array instanceof Float32Array?new Uint32Array(array.buffer,array.byteOffset,array.length):array;
  return {values,stride,offset,size:a.itemSize};
 });
 const previous=geometry.index,indices=previous?.array??Array.from({length:count},(_,i)=>i),first=new Map<string,number>(),canonical=new Uint32Array(count);
 for(let vertex=0;vertex<count;vertex++){
  let key='';for(const reader of readers)for(let component=0;component<reader.size;component++)key+=reader.values[vertex*reader.stride+reader.offset+component]+',';
  const found=first.get(key);if(found===undefined){first.set(key,vertex);canonical[vertex]=vertex;}else canonical[vertex]=found;
 }
 const next=count<=65536?new Uint16Array(indices.length):new Uint32Array(indices.length),referenced=new Set<number>();
 for(let i=0;i<indices.length;i++){const vertex=indices[i]!;if(vertex>=count)throw Error('Static index exceeds vertex buffer.');next[i]=canonical[vertex]!;referenced.add(next[i]!);}
 geometry.setIndex(new THREE.BufferAttribute(next,1));
 const facts={vertices:count,referencedVertices:referenced.size,indices:next.length,mergedVertices:count-first.size};geometry.userData.origamiExactStaticIndex=facts;return facts;
}
