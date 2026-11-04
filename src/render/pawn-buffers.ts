import * as THREE from 'three/webgpu';

/** Grow the three resident meshes together. Keep materials/node graphs so both
 * colour and shadow pipelines survive population changes. Each geometry owns
 * its static vertices; trajectory attributes remain shared by all consumers. */
export function growPawnBuffers(meshes:readonly THREE.Mesh[],required:number,retireGeometry?:(geometry:THREE.BufferGeometry,mesh:THREE.Mesh)=>void):void {
  const capacity=2**Math.ceil(Math.log2(Math.max(1,required)));
  const shared=new Map<string,THREE.InstancedBufferAttribute>();
  const interleaved=new Map<THREE.InterleavedBuffer,THREE.InstancedInterleavedBuffer>();
  const replacements=meshes.map(mesh=>{
    const geometry=mesh.geometry.clone() as THREE.InstancedBufferGeometry;
    for(const [name,previous] of Object.entries(mesh.geometry.attributes)) {
      if(previous instanceof THREE.InterleavedBufferAttribute && previous.data instanceof THREE.InstancedInterleavedBuffer) {
        let next=interleaved.get(previous.data);
        if(!next){
          next=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*previous.data.stride),previous.data.stride,previous.data.meshPerAttribute).setUsage(previous.data.usage);
          next.array.set(previous.data.array);interleaved.set(previous.data,next);
        }
        geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(next,previous.itemSize,previous.offset,previous.normalized));
        continue;
      }
      if(!(previous instanceof THREE.InstancedBufferAttribute))continue;
      let next=shared.get(name);
      if(!next) {
        next=new THREE.InstancedBufferAttribute(new Float32Array(capacity*previous.itemSize),previous.itemSize,previous.normalized).setUsage(previous.usage);
        next.array.set(previous.array);shared.set(name,next);
        if(name==='aTravel')for(let i=previous.count;i<capacity;i++)next.setW(i,1);
      }
      geometry.setAttribute(name,next);
    }
    return geometry;
  });
  // No render can interleave this synchronous replacement. Dispose only after
  // every clone is ready: shared old attributes are no longer used anywhere.
  meshes.forEach((mesh,i)=>{const previous=mesh.geometry;mesh.geometry=replacements[i]!;if(retireGeometry)retireGeometry(previous,mesh);else previous.dispose();});
}
