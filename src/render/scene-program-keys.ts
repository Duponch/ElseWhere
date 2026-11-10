import type * as THREE from 'three/webgpu';

type Drawable=THREE.Object3D&{material?:THREE.Material|THREE.Material[];geometry?:THREE.BufferGeometry;
 isInstancedMesh?:boolean;isSkinnedMesh?:boolean;isBatchedMesh?:boolean;isPoints?:boolean;isLine?:boolean;isSprite?:boolean};
type Attribute={itemSize:number;normalized?:boolean;isInstancedBufferAttribute?:boolean;isInterleavedBufferAttribute?:boolean;
 data?:{stride:number;isInstancedInterleavedBuffer?:boolean};array?:{constructor:{name:string}}};

/** What a geometry contributes to a render program and its pipeline: the
 * attributes it offers (names, sizes, types, instancing), not its contents. */
function layoutKey(geometry:THREE.BufferGeometry):string {
 let key=geometry.index?'indexed':'plain';
 const attributes=geometry.attributes as unknown as Record<string,Attribute>;
 for(const name of Object.keys(attributes)){
  const a=attributes[name]!;
  key+='|'+name+':'+a.itemSize+(a.normalized?'n':'')+(a.isInstancedBufferAttribute||a.data?.isInstancedInterleavedBuffer?'I':'')
   +(a.isInterleavedBufferAttribute?'L'+a.data!.stride:'')+(a.array?.constructor.name??a.data?.constructor.name??'');
 }
 const morph=geometry.morphAttributes as Record<string,unknown[]>|undefined;
 if(morph)for(const name of Object.keys(morph))key+='|morph:'+name+':'+morph[name]!.length;
 return key;
}

/** One key per render program the visible part of a scene can need: a material
 * in its current version, with a geometry layout and an object kind. Two calls
 * give the same set exactly when no visible object brought a material state,
 * layout or kind the other did not have; moving, hiding nothing new, resizing
 * an instanced lot or replacing buffer contents changes nothing.
 * Read-only: one traversal, no frame callback, no render state touched. */
export function sceneProgramKeys(root:THREE.Object3D):Set<string> {
 const keys=new Set<string>();
 const visit=(object:Drawable):void=>{
  if(!object.visible)return;
  const material=object.material,geometry=object.geometry;
  if(material&&geometry){
   const kind=(object.isInstancedMesh?'I':'')+(object.isSkinnedMesh?'S':'')+(object.isBatchedMesh?'B':'')+(object.isPoints?'P':'')+(object.isLine?'L':'')+(object.isSprite?'s':'')+(object.receiveShadow?'r':'');
   const layout=layoutKey(geometry);
   if(Array.isArray(material))for(const m of material)keys.add(m.uuid+':'+m.version+'#'+kind+'#'+layout);
   else keys.add(material.uuid+':'+material.version+'#'+kind+'#'+layout);
  }
  for(const child of object.children)visit(child as Drawable);
 };
 visit(root as Drawable);
 return keys;
}

/** True when `current` holds a program key that `known` lacks. */
export function hasNewProgramKey(current:ReadonlySet<string>,known:ReadonlySet<string>|undefined):boolean {
 if(!known)return true;
 for(const key of current)if(!known.has(key))return true;
 return false;
}
