import * as THREE from 'three/webgpu';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';
import { Fn, attribute, mat4, normalLocal, positionLocal, transformNormal } from 'three/tsl';

const matrix = new THREE.Matrix4(), sphere = new THREE.Sphere();

/** Attribute layouts are independent of allocation size and node IDs. Keep
 * transforms explicit so buffer growth reuses both solid and shadow shaders. */
export function configureBoxMaterial(material: THREE.NodeMaterial): void {
  material.positionNode = Fn(() => {
    const transform = mat4(attribute('boxMatrix0', 'vec4'), attribute('boxMatrix1', 'vec4'),
      attribute('boxMatrix2', 'vec4'), attribute('boxMatrix3', 'vec4')).toVar();
    normalLocal.assign(transformNormal(normalLocal, transform));
    return transform.mul(positionLocal).xyz;
  })();
  material.colorNode = attribute('boxColor', 'vec3');
}

export class BoxMesh extends THREE.Mesh<THREE.InstancedBufferGeometry> {
  instanceMatrix!: THREE.InstancedInterleavedBuffer;
  colorBuffer!: THREE.InstancedBufferAttribute;
  itemShapeBuffer?:THREE.InstancedInterleavedBuffer;
  private baseRadius = Math.sqrt(3) / 2;

  constructor(base: THREE.BufferGeometry, material: THREE.Material, capacity: number,private readonly ownedProducer435?:OwnedOpaqueProducer435) {
    super(new THREE.InstancedBufferGeometry(), material);
    this.allocate(base, capacity);
  }

  allocate(base: THREE.BufferGeometry, capacity: number): void {
    this.geometry.dispose();
    if (!base.boundingSphere) base.computeBoundingSphere();
    // Instance bounds are centred on their transform origin. Authored meshes
    // may be asymmetric, so enclose their displaced source sphere as well.
    this.baseRadius = base.boundingSphere ? base.boundingSphere.radius + base.boundingSphere.center.length() : 1;
    const geometry = new THREE.InstancedBufferGeometry();
    // Tiny authored box data is owned by each geometry. Disposing a grown batch
    // must never release another live batch's attributes or index.
    const staticCloneData={};
    for(const[name,attribute]of Object.entries(base.attributes)){
      if(attribute instanceof THREE.InstancedBufferAttribute||attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data instanceof THREE.InstancedInterleavedBuffer)continue;
      geometry.setAttribute(name,attribute instanceof THREE.InterleavedBufferAttribute?attribute.clone(staticCloneData):attribute.clone());
    }
    if (base.index) geometry.setIndex(base.index.clone());
    geometry.setDrawRange(base.drawRange.start,base.drawRange.count);
    this.instanceMatrix = new THREE.InstancedInterleavedBuffer(new Float32Array(capacity * 16), 16).setUsage(THREE.StaticDrawUsage);
    for(let column=0;column<4;column++)geometry.setAttribute(`boxMatrix${column}`, new THREE.InterleavedBufferAttribute(this.instanceMatrix,4,column*4));
    this.colorBuffer = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.StaticDrawUsage);
    geometry.setAttribute('boxColor', this.colorBuffer);
    if(base.userData.itemAtlas){
      this.itemShapeBuffer=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*2),2).setUsage(THREE.StaticDrawUsage);
      geometry.setAttribute('itemShape',new THREE.InterleavedBufferAttribute(this.itemShapeBuffer,1,0));
      geometry.setAttribute('itemPatternIndex',new THREE.InterleavedBufferAttribute(this.itemShapeBuffer,1,1));
    }else this.itemShapeBuffer=undefined;
    geometry.instanceCount=0;geometry.boundingSphere=new THREE.Sphere();
    this.geometry=geometry;
    this.commitOwnedOpaque435();
  }

  get activeCount():number { return this.geometry.instanceCount; }
  set activeCount(value:number) {const changed=this.geometry.instanceCount!==value||this.visible!==(value>0);this.geometry.instanceCount=value;this.visible=value>0;if(changed)this.commitOwnedOpaque435();}
  /** Only a capability supplied by a closed producer can issue this receipt.
   * Bulk writers commit once, rather than notifying for every instance. */
  commitOwnedOpaque435():void {this.ownedProducer435?.dirty(this);}
  get boundingSphere():THREE.Sphere { return this.geometry.boundingSphere!; }
  setMatrixAt(index:number,value:THREE.Matrix4):void { value.toArray(this.instanceMatrix.array,index*16); }
  getMatrixAt(index:number,target:THREE.Matrix4):void { target.fromArray(this.instanceMatrix.array,index*16); }
  setColorAt(index:number,value:THREE.Color):void { value.toArray(this.colorBuffer.array,index*3); }
  setItemShapeAt(index:number,slot:number,patternIndex:number):void {
    if(!this.itemShapeBuffer)throw new Error('Item atlas slots are missing');
    this.itemShapeBuffer.array[index*2]=slot;this.itemShapeBuffer.array[index*2+1]=patternIndex;
  }
  computeBoundingSphere():void {
    this.boundingSphere.makeEmpty();
    for(let i=0;i<this.activeCount;i++) {
      this.getMatrixAt(i,matrix);sphere.set(new THREE.Vector3(),this.baseRadius).applyMatrix4(matrix);this.boundingSphere.union(sphere);
    }
  }
  dispose():void {this.ownedProducer435?.forget(this);this.geometry.dispose();}
}
