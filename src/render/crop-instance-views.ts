import * as THREE from 'three/webgpu';
import { Fn, attribute, instanceColor, instanceIndex, normalLocal, positionLocal, transformNormal } from 'three/tsl';
import { ObjectResourceBinder } from './object-bound-nodes';

/** Instance color stream of a holder, read by name from its view geometry. */
const INSTANCE_COLOR='cropInstanceColor';
type Variant={readonly material:THREE.NodeMaterial;signature:readonly unknown[]};

/**
 * Crop batches keep an InstancedMesh as the holder of their instance streams
 * (matrices, colors, count, bounds), but cameras never draw it: three.js
 * builds a separate node graph for every InstancedMesh, so each crop kind
 * paid a full shader build. A plain child mesh draws the holder instead, with
 * one program shared by all kinds: the same instance transform as three's
 * InstancedMesh path (matrix storage, normal transform, instance color), the
 * matrices being read per drawn object.
 */
export class CropInstanceViews {
  private readonly holders=new WeakMap<THREE.Object3D,THREE.InstancedMesh>();
  private readonly binder=new ObjectResourceBinder<THREE.InstancedMesh>('Crop instances',object=>this.holders.get(object));
  private readonly matrices=this.binder.storage(holder=>holder.instanceMatrix as unknown as THREE.StorageBufferAttribute,new THREE.StorageInstancedBufferAttribute(1,16) as unknown as THREE.StorageBufferAttribute,'mat4');
  private readonly variants=new Map<THREE.NodeMaterial,Variant>();
  private readonly positions=new Map<THREE.Node|null,THREE.Node>();
  private readonly views=new Map<THREE.InstancedMesh,THREE.Mesh>();

  /** Hides the holder from cameras and returns its drawing child. */
  attach(holder:THREE.InstancedMesh):THREE.Mesh {
    const source=holder.geometry,geometry=new THREE.InstancedBufferGeometry();
    for(const [name,value] of Object.entries(source.attributes))geometry.setAttribute(name,value);
    if(source.index)geometry.setIndex(source.index);
    geometry.setDrawRange(source.drawRange.start,source.drawRange.count);
    geometry.setAttribute(INSTANCE_COLOR,holder.instanceColor!);
    // The holder's count is the number of drawn instances.
    Object.defineProperty(geometry,'instanceCount',{configurable:true,get:()=>holder.count,set:()=>{}});
    const view=new THREE.Mesh(geometry,this.variant(holder.material as THREE.Material));
    view.name=`${holder.name||'Crop batch'} — shared crop program`;
    view.castShadow=holder.castShadow;view.receiveShadow=holder.receiveShadow;view.frustumCulled=holder.frustumCulled;view.renderOrder=holder.renderOrder;
    // three multiplies the diffuse color by the instance color varying when
    // the drawn object has an instanceColor; the view assigns that varying.
    Object.assign(view,{instanceColor:holder.instanceColor});
    // Culling uses the holder's instance bounds.
    Object.defineProperty(view,'boundingSphere',{configurable:true,get:()=>holder.boundingSphere});
    Object.assign(view,{computeBoundingSphere:()=>holder.computeBoundingSphere()});
    view.onBeforeRender=()=>{this.select(view,holder);};
    holder.layers.disableAll();holder.add(view);
    this.holders.set(view,holder);this.views.set(holder,view);
    return view;
  }
  /** Before the holder is disposed. The view geometry is not disposed: its
   * attributes are the holder's and the kind geometry's, which a replacing
   * holder's view still draws (disposing would destroy their GPU buffers). */
  detach(holder:THREE.InstancedMesh):void {
    const view=this.views.get(holder);if(!view)return;
    this.views.delete(holder);view.removeFromParent();
  }
  /** The view of a holder draws its holder's current material. */
  select(view:THREE.Mesh,holder:THREE.InstancedMesh):void {
    const material=this.variant(holder.material as THREE.Material);if(view.material!==material)view.material=material;
  }
  /** Keeps every view and variant equal to its source material. */
  sync():void {
    for(const [source,variant] of this.variants)this.refresh(source,variant);
    for(const [holder,view] of this.views)this.select(view,holder);
  }
  private variant(source:THREE.Material):THREE.Material {
    if(!(source instanceof THREE.NodeMaterial))throw Error('Crop instance views require node materials');
    let variant=this.variants.get(source);
    if(!variant){variant={material:source.clone(),signature:[]};this.variants.set(source,variant);}
    this.refresh(source,variant);return variant.material;
  }
  private refresh(source:THREE.NodeMaterial,variant:Variant):void {
    const keys=Object.keys(source).filter(key=>key.endsWith('Node')).sort();
    const signature=[source.version,source.alphaTest,...keys.flatMap(key=>[key,Reflect.get(source,key)])];
    if(signature.length===variant.signature.length&&signature.every((value,i)=>value===variant.signature[i]))return;
    const material=variant.material;
    material.copy(source);
    // three r186 NodeMaterial.copy skips the inherited alphaTest accessor.
    material.alphaTest=source.alphaTest;
    material.positionNode=this.position(source.positionNode);
    material.needsUpdate=true;variant.signature=signature;
  }
  private position(source:THREE.Node|null):THREE.Node {
    let node=this.positions.get(source);
    if(!node){
      const binder=this.binder,matrices=this.matrices;
      node=Fn(()=>{
        // The drawn holder's matrices, then three's InstancedMesh transform.
        binder.toStack();
        const matrix=matrices.element(instanceIndex);
        positionLocal.assign(matrix.mul(positionLocal).xyz);
        normalLocal.assign(transformNormal(normalLocal,matrix));
        instanceColor.assign(attribute(INSTANCE_COLOR,'vec3'));
        return source??positionLocal;
      })() as THREE.Node;
      this.positions.set(source,node);
    }
    return node;
  }
  dispose():void {
    for(const holder of [...this.views.keys()])this.detach(holder);
    for(const variant of this.variants.values())variant.material.dispose();
    this.variants.clear();this.positions.clear();
  }
}
