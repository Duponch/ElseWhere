/** Constructor-owned resource declarations for renderer-owned material programs.
 * Merely discovering a texture/group in a compiled graph never grants ownership.
 * Publication writers notify subscribers; stable frames do no graph census. */
import type {BufferAttribute,Node,NodeMaterial,Texture,UniformGroupNode} from 'three/webgpu';
export interface OwnedMaterialResourceSnapshot435 {
 readonly textures:readonly Texture[];
 readonly arrayTextures:readonly Texture[];
 readonly sharedGroups:readonly UniformGroupNode[];
 readonly storage?:readonly BufferAttribute[];
 /** Exact data uniforms written only by constructor/publication owners. */
 readonly objectUniforms?:readonly Node[];
}
export interface OwnedMaterialResources435 {
 readonly textures:ReadonlySet<Texture>;
 readonly arrayTextures:ReadonlySet<Texture>;
 readonly sharedGroups:ReadonlySet<UniformGroupNode>;
 readonly storage:ReadonlySet<BufferAttribute>;
 readonly objectUniforms:ReadonlySet<Node>;
 readonly revision:number;
 subscribe(listener:()=>void):()=>void;
}
const declarations=new WeakMap<NodeMaterial,OwnedMaterialResources435>();
export function ownedMaterialResources435(material:NodeMaterial):OwnedMaterialResources435|undefined{return declarations.get(material);}
export function createOwnedMaterialResources435(material:NodeMaterial,initial:OwnedMaterialResourceSnapshot435){
 if(declarations.has(material))throw Error('Material already has a Source resource declaration');
 const textures=new Set<Texture>(),arrays=new Set<Texture>(),groups=new Set<UniformGroupNode>(),storage=new Set<BufferAttribute>(),objectUniforms=new Set<Node>(),listeners=new Set<()=>void>();let revision=0,closed=false;
 const assign=(next:OwnedMaterialResourceSnapshot435)=>{
  if(next.arrayTextures.some(value=>!next.textures.includes(value)))throw Error('Declared array must be a declared live texture');
  textures.clear();arrays.clear();groups.clear();storage.clear();objectUniforms.clear();for(const value of next.textures)textures.add(value);for(const value of next.arrayTextures)arrays.add(value);for(const value of next.sharedGroups)groups.add(value);for(const value of next.storage??[])storage.add(value);for(const node of next.objectUniforms??[])objectUniforms.add(node);revision++;
 };
 assign(initial);
 const notify=()=>{const errors:unknown[]=[];for(const listener of [...listeners])try{listener();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Owned material resource publication listeners failed');};
 const declaration:OwnedMaterialResources435={textures,arrayTextures:arrays,sharedGroups:groups,storage,objectUniforms,get revision(){return revision;},subscribe(listener){if(closed)throw Error('Material resource journal closed');listeners.add(listener);return()=>listeners.delete(listener);}};
 declarations.set(material,declaration);
 return{declaration,publish(next:OwnedMaterialResourceSnapshot435){if(closed)throw Error('Material resource journal closed');assign(next);notify();},dispose(){if(closed)return;closed=true;declarations.delete(material);textures.clear();arrays.clear();groups.clear();storage.clear();objectUniforms.clear();revision++;try{notify();}finally{listeners.clear();}}};
}
