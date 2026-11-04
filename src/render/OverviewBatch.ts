import * as THREE from 'three/webgpu';
import { Fn,attribute,mat4,normalLocal,positionLocal,transformNormal } from 'three/tsl';

const matrix=new THREE.Matrix4(),transformedSphere=new THREE.Sphere();
const matrixAttributes=['overviewMatrix0','overviewMatrix1','overviewMatrix2','overviewMatrix3'] as const;

/** Named vertex attributes keep the shader independent of capacity and buffer
 * identities. Three multiplies this instance tint by the authored vertex color. */
export function configureOverviewMaterial(material:THREE.NodeMaterial):void {
  material.positionNode=Fn(()=>{
    const transform=mat4(attribute('overviewMatrix0','vec4'),attribute('overviewMatrix1','vec4'),
      attribute('overviewMatrix2','vec4'),attribute('overviewMatrix3','vec4')).toVar();
    normalLocal.assign(transformNormal(normalLocal,transform));
    return transform.mul(positionLocal).xyz;
  })();
  material.colorNode=attribute('overviewColor','vec3');
}

/** One resident object and material graph. Allocation owns a copy of the tiny
 * model attributes; only the matrix/color buffers depend on colony capacity. */
export class OverviewBatch extends THREE.Mesh<THREE.InstancedBufferGeometry> {
  instanceMatrix!:THREE.InstancedInterleavedBuffer;
  // Three NodeMaterial treats a property named instanceColor as its implicit
  // InstancedMesh varying. This Mesh supplies its own named color attribute.
  colorBuffer!:THREE.InstancedBufferAttribute;
  readonly boundingSphere=new THREE.Sphere();
  private readonly baseSphere=new THREE.Sphere();

  constructor(base:THREE.BufferGeometry,material:THREE.Material,capacity:number) {
    super(new THREE.InstancedBufferGeometry(),material);
    this.allocate(base,capacity);
  }

  /** The caller copies live matrix/color data when growing. Passing the current
   * geometry is safe: its sphere still describes the model, not all instances. */
  allocate(base:THREE.BufferGeometry,capacity:number):void {
    if(!Number.isSafeInteger(capacity)||capacity<1)throw new RangeError('Invalid overview capacity.');
    if(!base.boundingSphere)base.computeBoundingSphere();
    const geometry=new THREE.InstancedBufferGeometry();
    const staticCloneData={};
    for(const [name,value] of Object.entries(base.attributes)) {
      if(name==='overviewColor'||(matrixAttributes as readonly string[]).includes(name))continue;
      // Each batch owns these buffers, including vertex colors and the index.
      geometry.setAttribute(name,value instanceof THREE.InterleavedBufferAttribute?value.clone(staticCloneData):value.clone());
    }
    if(base.index)geometry.setIndex(base.index.clone());
    for(const group of base.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
    geometry.setDrawRange(base.drawRange.start,base.drawRange.count);
    geometry.userData={...base.userData};
    geometry.boundingSphere=base.boundingSphere!.clone();
    const matrices=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*16),16).setUsage(THREE.StaticDrawUsage);
    // Unclaimed slots are finite degenerate transforms, including warmup.
    for(let i=0;i<capacity;i++)matrices.array[i*16+15]=1;
    for(let column=0;column<4;column++)geometry.setAttribute(matrixAttributes[column]!,new THREE.InterleavedBufferAttribute(matrices,4,column*4));
    const colors=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3).setUsage(THREE.StaticDrawUsage);
    geometry.setAttribute('overviewColor',colors);geometry.instanceCount=0;
    const previous=this.geometry;
    this.baseSphere.copy(base.boundingSphere!);this.boundingSphere.makeEmpty();
    this.geometry=geometry;this.instanceMatrix=matrices;this.colorBuffer=colors;
    this.visible=false;
    previous.dispose();
  }

  get activeCount():number {return this.geometry.instanceCount;}
  set activeCount(value:number) {
    if(!Number.isSafeInteger(value)||value<0||value>this.instanceMatrix.count)throw new RangeError('Invalid overview instance count.');
    this.geometry.instanceCount=value;this.visible=value>0;
  }
  setMatrixAt(index:number,value:THREE.Matrix4):void {value.toArray(this.instanceMatrix.array,index*16);}
  getMatrixAt(index:number,target:THREE.Matrix4):void {target.fromArray(this.instanceMatrix.array,index*16);}
  setColorAt(index:number,value:THREE.Color):void {value.toArray(this.colorBuffer.array,index*3);}
  getColorAt(index:number,target:THREE.Color):void {target.fromArray(this.colorBuffer.array,index*3);}
  computeBoundingSphere():void {
    this.boundingSphere.makeEmpty();
    for(let i=0;i<this.activeCount;i++) {
      this.getMatrixAt(i,matrix);
      transformedSphere.copy(this.baseSphere).applyMatrix4(matrix);
      this.boundingSphere.union(transformedSphere);
    }
  }
  dispose():void {this.geometry.dispose();}
}
