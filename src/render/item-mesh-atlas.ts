import * as THREE from 'three/webgpu';
import {Fn,attribute,float,mat4,normalLocal,storage,texture,transformNormal,uint,varying,vec2,vec4,vertexIndex} from 'three/tsl';
import {createItemGeometry,ITEM_SHAPES,type ItemShape} from './item-geometry';
import {PATTERN_SPAN} from './texture-variation';

/** Exact primitive meshes, not a union of whole item assemblies. Every
 * slot has the same vertex count; the remaining whole triangles collapse at0. */
export class ItemMeshAtlas {
  readonly shapes:readonly (ItemShape|undefined)[]=Object.freeze([undefined,...ITEM_SHAPES]);
  readonly vertexCounts:readonly number[];
  readonly verticesPerSlot:number;
  readonly data:THREE.StorageBufferAttribute;
  readonly geometry:THREE.BufferGeometry;
  readonly smallGeometry:THREE.BufferGeometry;
  readonly smallVertexLimit=96;
  private readonly slots=new Map<ItemShape|undefined,number>();
  private readonly buffer;
  private readonly positionUv:THREE.Node<'vec4'>;
  private readonly normalUv:THREE.Node<'vec4'>;
  private readonly stroke:THREE.Node<'vec4'>;

  constructor(borrowedModels?:readonly THREE.BufferGeometry[]){
    if(borrowedModels&&borrowedModels.length!==this.shapes.length)throw Error('Complete shared item model vocabulary required');
    const sources=borrowedModels??this.shapes.map(shape=>shape?createItemGeometry(shape):new THREE.BoxGeometry(1,1,1));
    this.vertexCounts=Object.freeze(sources.map(source=>source.index?.count??source.getAttribute('position').count));
    this.verticesPerSlot=Math.max(...this.vertexCounts);
    const stride=borrowedModels?12:8,values=new Float32Array(this.shapes.length*this.verticesPerSlot*stride);
    let radius=0;
    sources.forEach((source,slot)=>{
      this.slots.set(this.shapes[slot],slot);
      const position=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv'),index=source.index;
      for(let i=0;i<this.verticesPerSlot;i++){
        const offset=(slot*this.verticesPerSlot+i)*stride;
        if(i>=this.vertexCounts[slot]!){values[offset+5]=1;continue;}
        const vertex=index?index.getX(i):i,x=position.getX(vertex),y=position.getY(vertex),z=position.getZ(vertex);
        const face=source.getAttribute('surfaceStrokeFace'),strokeUv=source.getAttribute('surfaceStrokeUv');
        values.set([x,y,z,uv.getX(vertex),normal.getX(vertex),normal.getY(vertex),normal.getZ(vertex),uv.getY(vertex)],offset);
        if(borrowedModels)values.set([face?.getX(vertex)??0,strokeUv?.getX(vertex)??uv.getX(vertex),strokeUv?.getY(vertex)??uv.getY(vertex),0],offset+8);
        radius=Math.max(radius,Math.hypot(x,y,z));
      }
      if(!borrowedModels)source.dispose();
    });
    this.data=new THREE.StorageBufferAttribute(values,4);
    // WebGL's storage fallback otherwise ignores element indices. Its PBO
    // path preserves this same immutable lookup through an RGBA float texture.
    this.buffer=storage(this.data,'vec4',this.data.count).toReadOnly().setPBO(true);
    const address=uint(attribute('itemShape','float')).mul(this.verticesPerSlot).add(vertexIndex).mul(stride/4).toVar();
    this.positionUv=this.buffer.element(address).toVar();this.normalUv=this.buffer.element(address.add(1)).toVar();
    // Face/UV metadata is a vertex lookup. A global VarNode here can emit
    // a dead fragment load while a caller queries the prepared-address type.
    // UVs remain smoothly interpolated; face headers read X flat at the vertex.
    this.stroke=borrowedModels?varying(this.buffer.element(address.add(2)),'v_itemSourceStroke'):vec4(0);
    // Attributes establish the existing shader layout; authored data is fetched
    // from the atlas in the vertex stage. There is no per-frame buffer write.
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(this.verticesPerSlot*3),3));
    const normals=new Float32Array(this.verticesPerSlot*3);for(let i=0;i<this.verticesPerSlot;i++)normals[i*3+1]=1;
    this.geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    this.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(this.verticesPerSlot*2),2));
    this.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),radius);
    this.geometry.userData.itemAtlas=true;this.geometry.userData.rendererOwned=true;
    // The same atlas/shader serves both ranges. Small parts never submit the
    // coat's padded tail; complex silhouettes keep every authored vertex.
    this.smallGeometry=this.geometry.clone();
    this.smallGeometry.setDrawRange(0,Math.min(this.smallVertexLimit,this.verticesPerSlot));
  }

  slot(shape:ItemShape|undefined):number {return this.slots.get(shape)??0;}
  isSmall(shape:ItemShape|undefined):boolean {return this.vertexCounts[this.slot(shape)]!<=this.smallVertexLimit;}

  /** The true source UV occupies the spare W component of the existing two
   * atlas reads. Reuse those same nodes in the position and paint graphs. */
  paintUvNode():THREE.Node<'vec2'> {return varying(vec2(this.positionUv.w,this.normalUv.w),'v_itemPaintUv');}
  strokeFaceNode():THREE.Node<'float'>{return this.stroke.x;}
  strokeUvNode():THREE.Node<'vec2'>{return this.stroke.yz;}

  /** The original mapped Pastel UV, shared with the prepared representation. */
  patternUvNode():THREE.Node<'vec2'>{
    const positionUv=this.positionUv,normalUv=this.normalUv;
      const seed=attribute('itemPatternIndex','float'),sx=attribute('boxMatrix0','vec4').xyz.length(),sy=attribute('boxMatrix1','vec4').xyz.length(),sz=attribute('boxMatrix2','vec4').xyz.length();
      const facing=normalUv.xyz.abs(),u=sx.mul(facing.x.oneMinus()).add(sz.mul(facing.x)),v=sy.mul(facing.y.oneMinus()).add(sz.mul(facing.y)),longest=u.max(v).max(1e-6);
      const span=vec2(u,v).div(longest).mul(PATTERN_SPAN),phase=vec2(seed.mul(.61803398875).fract(),seed.mul(.41421356237).fract()).mul(1-PATTERN_SPAN);
      return varying(vec2(positionUv.w,normalUv.w).sub(.5).mul(span).add(float(PATTERN_SPAN*.5)).add(phase));
  }

  configure(material:THREE.NodeMaterial,surface?:THREE.Texture):void {
    const positionUv=this.positionUv,normalUv=this.normalUv;
    material.positionNode=Fn(()=>{
      const transform=mat4(attribute('boxMatrix0','vec4'),attribute('boxMatrix1','vec4'),attribute('boxMatrix2','vec4'),attribute('boxMatrix3','vec4')).toVar();
      normalLocal.assign(transformNormal(normalUv.xyz,transform));
      return transform.mul(positionUv.xyz).xyz;
    })();
    material.colorNode=attribute('boxColor','vec3');
    if(surface){
      material.colorNode=attribute('boxColor','vec3').mul(texture(surface,this.patternUvNode()).rgb);
    }
  }

  dispose():void {
    this.geometry.dispose();this.smallGeometry.dispose();this.buffer.dispose();
    (this.data as THREE.StorageBufferAttribute&{pbo?:THREE.Texture}).pbo?.dispose();
  }
}
