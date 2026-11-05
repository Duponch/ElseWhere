import type {BufferAttribute,Mesh,NodeMaterial,Texture} from 'three/webgpu';

/** Optional capability supplied only by the closed MAIN construction path.
 * Unknown dirty/forget calls never create an owner or grant membership. */
export interface OwnedOpaqueProducer435 {
  register(mesh:Mesh,materials:readonly NodeMaterial[],resources?:readonly(Texture|BufferAttribute)[],options?:{readonly beforeRender:Mesh['onBeforeRender']}):void;
  dirty(mesh:Mesh):void;
  forget(mesh:Mesh):void;
}
