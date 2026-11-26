import * as THREE from 'three/webgpu';

export interface NativeOpacityMaterial {material:THREE.Material;opacity:number}
/** Retain only this window's materials once at construction. Shared cardboard
 * edges and shadows are cloned so fading never changes another UI piece;
 * the ordinary piece disposer owns the clones just like its front material. */
export function retainNativeOpacityMaterials(piece:THREE.Object3D,shared:ReadonlySet<THREE.Material>):NativeOpacityMaterial[] {
  const retained:NativeOpacityMaterial[]=[],seen=new Set<THREE.Material>(),copies=new Map<THREE.Material,THREE.Material>();
  const own=(material:THREE.Material):THREE.Material=>{
    if(shared.has(material)){
      let copy=copies.get(material);if(!copy){copy=material.clone();copies.set(material,copy);}material=copy;
    }
    if(!seen.has(material)){
      seen.add(material);retained.push({material,opacity:material.opacity});
      material.transparent=true;material.depthWrite=false;material.needsUpdate=true;
    }
    return material;
  };
  piece.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    object.material=Array.isArray(object.material)?object.material.map(own):own(object.material);
  });
  return retained;
}
/** Pointer-driven only: no tree traversal, paint or geometry changes. The
 * caller advances its resource revision when this returns true so retained
 * CPU damage signatures and the GPU overlay both observe opacity changes. */
export function applyNativeOpacity(materials:readonly NativeOpacityMaterial[],opacity:number):boolean {
  let changed=false;
  for(const entry of materials){const value=entry.opacity*opacity;if(entry.material.opacity!==value){entry.material.opacity=value;changed=true;}}
  return changed;
}
