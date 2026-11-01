import * as THREE from 'three/webgpu';
import {Fn,attribute,float,mat4,normalLocal,storage,transformNormal,uint,varying,vec2,vec4,vertexIndex,uv} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import {createItemGeometry,ITEM_SHAPES,type ItemShape} from '../item-geometry';
import {staticSceneSourceLayers435} from '../StaticSceneCompiler435';
import {createOrigamiBrushGeometry} from './brush-geometry';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const instanced=(attribute:Attribute):boolean=>attribute instanceof THREE.InstancedBufferAttribute||attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data instanceof THREE.InstancedInterleavedBuffer;
const surface=(body:THREE.Mesh):THREE.NodeMaterial=>(Array.isArray(body.material)?body.material[0]:body.material) as THREE.NodeMaterial;
const geometric=(name:string):boolean=>name==='position'||/normal|tangent|color|uv/i.test(name);
const pointKey=(p:Attribute,i:number):string=>`${Math.round(p.getX(i)*1e6)},${Math.round(p.getY(i)*1e6)},${Math.round(p.getZ(i)*1e6)}`;

/** Preserve endpoint metadata as well as shape. Overlaid cargo variants and
 * independently masked body parts must never weld to each other's vertices. */
export function createOrigamiContourGeometry(source:THREE.BufferGeometry,thresholdAngle=22):THREE.BufferGeometry {
  if(source.userData.origamiContourTopology==='lines')return source.clone();
  if(!source.hasAttribute('position')){const geometry=new THREE.BufferGeometry(),empty=new THREE.InterleavedBuffer(new Float32Array(0),8);geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(empty,3,0));geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(empty,3,3));geometry.setAttribute('uv',new THREE.InterleavedBufferAttribute(empty,2,6));return geometry;}
  const position=source.getAttribute('position'),index=source.index,staticAttributes=Object.entries(source.attributes).filter(([,a])=>!instanced(a));
  const discriminants=staticAttributes.filter(([name])=>!geometric(name));
  const total=index?.count??position.count,start=Math.max(0,source.drawRange.start),end=Math.min(total,start+source.drawRange.count);
  const selected=source.groups.length?source.groups.map(group=>[Math.max(start,group.start),Math.min(end,group.start+group.count)] as const)
    :source.userData.cargoRangesByKind?[]:[[start,end] as const];
  const groups=new Map<string,number[]>();
  for(const [first,last]of selected)for(let at=first;at+2<last;at+=3){
    const vertices=[0,1,2].map(offset=>index?index.getX(at+offset):at+offset),firstVertex=vertices[0]!;
    const key=discriminants.map(([name,a])=>`${name}:${Array.from({length:a.itemSize},(_,c)=>a.getComponent(firstVertex,c)).join(',')}`).join('|');
    let triangles=groups.get(key);if(!triangles){triangles=[];groups.set(key,triangles);}triangles.push(...vertices);
  }
  const data=new Map(staticAttributes.map(([name])=>[name,[] as number[]]));
  for(const triangles of groups.values()){
    const lookup=new Map<string,number>();for(const vertex of triangles)lookup.set(pointKey(position,vertex),vertex);
    const part=new THREE.BufferGeometry();part.setAttribute('position',position);part.setIndex(triangles);
    const edges=new THREE.EdgesGeometry(part,thresholdAngle),points=edges.getAttribute('position');
    for(let endpoint=0;endpoint<points.count;endpoint++){
      const vertex=lookup.get(pointKey(points,endpoint));if(vertex===undefined)throw new Error('Origami contour endpoint lost its source metadata');
      for(const [name,a]of staticAttributes){const target=data.get(name)!;for(let c=0;c<a.itemSize;c++)target.push(a.getComponent(vertex,c));}
    }
    edges.dispose();part.dispose();
  }
  const layout=staticAttributes.map(([name,a])=>({name,size:a.itemSize})),count=(data.get('position')?.length??0)/3;
  // Full shared position nodes may write normalLocal even though the contour
  // itself is unlit. A valid normal avoids missing-attribute fallback paths.
  if(!data.has('normal')){const normals=new Array<number>(count*3).fill(0);for(let i=1;i<normals.length;i+=3)normals[i]=1;data.set('normal',normals);layout.push({name:'normal',size:3});}
  if(!data.has('uv')){data.set('uv',new Array<number>(count*2).fill(0));layout.push({name:'uv',size:2});}
  // All static endpoint attributes occupy one vertex buffer, just like the
  // resident body. Individual arrays can exceed WebGPU's eight-buffer limit
  // once trajectory, appearance and cargo instance streams are also bound.
  const stride=layout.reduce((sum,a)=>sum+a.size,0),values=new Float32Array(count*stride),packed=new THREE.InterleavedBuffer(values,stride),geometry=new THREE.BufferGeometry();
  let offset=0;for(const {name,size}of layout){const sourceData=data.get(name)!;for(let vertex=0;vertex<count;vertex++)for(let component=0;component<size;component++)values[vertex*stride+offset+component]=sourceData[vertex*size+component]!;geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(packed,size,offset));offset+=size;}
  geometry.userData.origamiContourTopology='lines';return geometry;
}

export interface OrigamiContourBinding {
  /** Historical name retained for producer ownership; this is a surface mesh. */
  readonly line:THREE.Mesh;
  sync(body?:THREE.Mesh):void;
  rebuild(sourceGeometry?:THREE.BufferGeometry):void;
  dispose():void;
}
function signature(geometry:THREE.BufferGeometry):string {
  const position=geometry.getAttribute('position'),version=position instanceof THREE.InterleavedBufferAttribute?position.data.version:position?.version??0;return [geometry.id,version,geometry.index?.version??0,geometry.drawRange.start,geometry.drawRange.count,...geometry.groups.flatMap(group=>[group.start,group.count])].join(':');
}

/** One painted surface draw beside an existing batch. Only instance storage is
 * shared; the companion owns its ribbon topology, material and registration. */
export function createOrigamiContour(body:THREE.Mesh,context:GraphicsStyleContext,positionNode:THREE.Node|null=surface(body).positionNode??null,sourceGeometry:THREE.BufferGeometry=body.geometry,coordinates:THREE.Node<'vec2'>=uv()):OrigamiContourBinding {
  let current=body,source=sourceGeometry,followBody=sourceGeometry===body.geometry,lastSignature='',disposed=false;
  const material=context.createBrushMaterial(positionNode,coordinates),ownOpacity=material.opacityNode;let previousOpacity:THREE.Node|null|undefined,previousInstanceMatrix:THREE.InstancedBufferAttribute|undefined,releaseGeometry:(()=>void)|undefined;
  const line:THREE.Mesh=body instanceof THREE.InstancedMesh?new THREE.InstancedMesh(new THREE.BufferGeometry(),material,0):new THREE.Mesh(new THREE.BufferGeometry(),material);line.name=`${body.name||'Asset'} — Origami painted edges`;line.frustumCulled=false;line.castShadow=false;line.receiveShadow=false;
  const count=()=>current instanceof THREE.InstancedMesh?current.count:current.geometry instanceof THREE.InstancedBufferGeometry?current.geometry.instanceCount:1;
  let wantedVisible=true;
  Object.defineProperty(line,'visible',{configurable:true,get:()=>wantedVisible&&current.visible&&count()>0,set:(value:boolean)=>{wantedVisible=value;}});
  Object.defineProperty(line.layers,'mask',{configurable:true,get:()=>staticSceneSourceLayers435(current),set:()=>{}});
  // Support both a sibling (the normal producer integration) and a child
  // (standalone previews) without applying the body's object matrix twice.
  line.updateMatrix=()=>{if(line.parent===current)line.matrix.identity();else{if(current.matrixAutoUpdate)current.updateMatrix();line.matrix.copy(current.matrix);}line.matrixWorldNeedsUpdate=true;};
  line.matrixAutoUpdate=true;
  // This is an actual InstancedMesh, not a LineSegments engine-binding flag.
  // Matrices/count remain live aliases across owner growth and warm previews.
  if(body instanceof THREE.InstancedMesh){Object.defineProperty(line,'instanceMatrix',{get:()=>(current as THREE.InstancedMesh).instanceMatrix});Object.defineProperty(line,'instanceColor',{value:null});Object.defineProperty(line,'count',{get:count});}
  const release=context.trackEdgeObject(line,'line');
  function install(geometry:THREE.BufferGeometry):void {
    releaseGeometry?.();releaseGeometry=undefined;
    const old=line.geometry;
    if(current.geometry instanceof THREE.InstancedBufferGeometry&&!(current instanceof THREE.InstancedMesh)){
      const instancedGeometry=new THREE.InstancedBufferGeometry();for(const [name,a]of Object.entries(geometry.attributes))instancedGeometry.setAttribute(name,a);if(geometry.index)instancedGeometry.setIndex(geometry.index);instancedGeometry.userData=geometry.userData;
      instancedGeometry.setDrawRange(geometry.drawRange.start,geometry.drawRange.count);for(const group of geometry.groups)instancedGeometry.addGroup(group.start,group.count,group.materialIndex);
      Object.defineProperty(instancedGeometry,'instanceCount',{configurable:true,get:count});line.geometry=instancedGeometry;geometry.dispose();
    }else line.geometry=geometry;
    old.dispose();if(!line.geometry.userData.referenceBrushExternalUpdates)releaseGeometry=context.prepareBrushGeometry(line.geometry);
  }
  const binding:OrigamiContourBinding={line,
    rebuild(next=followBody?current.geometry:source){if(disposed)return;source=next;install(createOrigamiBrushGeometry(source));lastSignature=signature(source);},
    sync(next=current){
      if(disposed)return;current=next;if(followBody)source=current.geometry;
      if(signature(source)!==lastSignature)binding.rebuild(source);
      if(current instanceof THREE.InstancedMesh&&previousInstanceMatrix!==current.instanceMatrix){previousInstanceMatrix=current.instanceMatrix;material.needsUpdate=true;}
      for(const [name,a]of Object.entries(current.geometry.attributes))if(instanced(a))line.geometry.setAttribute(name,a);
      const sourceMaterial=surface(current),mask=sourceMaterial.maskNode??null,shadowMask=sourceMaterial.maskShadowNode??null,opacity=sourceMaterial.opacityNode??null;
      if(material.maskNode!==mask||material.maskShadowNode!==shadowMask){material.maskNode=mask;material.maskShadowNode=shadowMask;material.needsUpdate=true;}
      if(previousOpacity!==opacity){previousOpacity=opacity;material.opacityNode=previousOpacity&&ownOpacity?float(ownOpacity as THREE.Node<'float'>).mul(previousOpacity as THREE.Node<'float'>):ownOpacity;material.needsUpdate=true;}
      // Deliberately never copy outputNode or instanceColor. The brush
      // material owns its pigment and physical lighting independently.
      line.layers.mask=staticSceneSourceLayers435(current);line.renderOrder=current.renderOrder;line.updateMatrix();
      if(current.geometry.boundingBox)(line.geometry.boundingBox??=new THREE.Box3()).copy(current.geometry.boundingBox);else line.geometry.boundingBox=null;
      if(current.geometry.boundingSphere)(line.geometry.boundingSphere??=new THREE.Sphere()).copy(current.geometry.boundingSphere);else line.geometry.boundingSphere=null;
      context.refreshEdgeObject(line,'line');
      line.userData.origamiContourDiagnostic={sourceOutputNode:!!sourceMaterial.outputNode,contourOutputNode:!!material.outputNode,sharedPositionNode:material.positionNode===positionNode,sharedMasks:material.maskNode===sourceMaterial.maskNode,sourceVertices:source.getAttribute('position')?.count??0,lineEndpoints:line.geometry.getAttribute('position').count};
    },
    dispose(){if(disposed)return;disposed=true;release();releaseGeometry?.();line.removeFromParent();line.geometry.dispose();material.dispose();},
  };
  binding.rebuild();binding.sync();return binding;
}
export function createInstancedOrigamiContour(body:THREE.InstancedMesh,context:GraphicsStyleContext,positionNode:THREE.Node|null=surface(body).positionNode??null):OrigamiContourBinding{return createOrigamiContour(body,context,positionNode);}

/** Separate triangle-ribbon atlas: body triangle indices cannot address brush
 * triangles. Two vec4 reads carry real position/normal and both paint UVs. */
export class ItemContourAtlas {
  readonly geometry:THREE.BufferGeometry;
  readonly smallGeometry:THREE.BufferGeometry;
  readonly verticesPerSlot:number;
  readonly smallVertexLimit:number;
  private readonly buffer;
  private readonly data:THREE.StorageBufferAttribute;
  private readonly positionUv:THREE.Node<'vec4'>;
  private readonly normalUv:THREE.Node<'vec4'>;
  constructor(){
    const shapes:readonly (ItemShape|undefined)[]=[undefined,...ITEM_SHAPES];
    const bodyCounts:number[]=[],edges=shapes.map(shape=>{const source=shape?createItemGeometry(shape):new THREE.BoxGeometry(1,1,1);bodyCounts.push(source.index?.count??source.getAttribute('position').count);const edge=createOrigamiBrushGeometry(source);source.dispose();return edge;});
    const brushCounts=edges.map(edge=>edge.index?.count??edge.getAttribute('position').count);
    this.verticesPerSlot=Math.max(...brushCounts);
    this.smallVertexLimit=Math.max(...brushCounts.filter((_,slot)=>bodyCounts[slot]!<=96));
    const slots=shapes.length*this.verticesPerSlot,values=new Float32Array(slots*8),base=new Float32Array(slots*3),width=new Float32Array(slots*3),rough=new Float32Array(slots*3);
    edges.forEach((edge,slot)=>{
      const points=edge.getAttribute('position'),normals=edge.getAttribute('normal'),coordinates=edge.getAttribute('uv'),first=slot*this.verticesPerSlot,index=edge.index;
      const sourceBase=edge.userData.referenceBrushBasePositions as Float32Array,sourceWidth=edge.userData.referenceBrushWidthOffsets as Float32Array,sourceRough=edge.userData.referenceBrushRoughOffsets as Float32Array;
      for(let i=0;i<this.verticesPerSlot;i++){
        const at=(first+i)*8;if(i>=brushCounts[slot]!){values[at+5]=1;continue;}
        // The storage-fetch draw is non-indexed: explicitly expand the shared
        // face-strip indices once at bake, preserving its vertexIndex contract.
        const vertex=index?index.getX(i):i;
        values.set([points.getX(vertex),points.getY(vertex),points.getZ(vertex),coordinates.getX(vertex),normals.getX(vertex),normals.getY(vertex),normals.getZ(vertex),coordinates.getY(vertex)],at);
        for(let c=0;c<3;c++){base[(first+i)*3+c]=sourceBase[vertex*3+c]!;width[(first+i)*3+c]=sourceWidth[vertex*3+c]!;rough[(first+i)*3+c]=sourceRough[vertex*3+c]!;}
      }
      edge.dispose();
    });
    this.data=new THREE.StorageBufferAttribute(values,4);this.buffer=storage(this.data,'vec4',this.data.count).toReadOnly().setPBO(true);
    const metadata={origamiBrushPrebuilt:true,referenceBrushBasePositions:base,referenceBrushWidthOffsets:width,referenceBrushRoughOffsets:rough,referenceBrushPositionStorage:this.data,referenceBrushStorageStride:8};
    const makeGeometry=(limit:number)=>{
      const geometry=new THREE.BufferGeometry(),packed=new THREE.InterleavedBuffer(new Float32Array(this.verticesPerSlot*8),8);
      for(let i=0;i<this.verticesPerSlot;i++)packed.array[i*8+4]=1;
      geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(packed,3,0));geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(packed,3,3));geometry.setAttribute('uv',new THREE.InterleavedBufferAttribute(packed,2,6));
      geometry.userData={...metadata};geometry.setDrawRange(0,limit);return geometry;
    };
    this.geometry=makeGeometry(this.verticesPerSlot);this.smallGeometry=makeGeometry(this.smallVertexLimit);
    const address=uint(attribute('itemShape','float')).mul(this.verticesPerSlot).add(vertexIndex).mul(2).toVar();
    this.positionUv=this.buffer.element(address).toVar();this.normalUv=this.buffer.element(address.add(1)).toVar();
  }
  paintUvNode():THREE.Node<'vec2'>{return varying(vec2(this.positionUv.w,this.normalUv.w),'v_itemBrushUv');}
  positionNode():THREE.Node<'vec3'>{
    return Fn(()=>{const transform=mat4(attribute('boxMatrix0','vec4'),attribute('boxMatrix1','vec4'),attribute('boxMatrix2','vec4'),attribute('boxMatrix3','vec4')).toVar();normalLocal.assign(transformNormal(this.normalUv.xyz,transform));return transform.mul(vec4(this.positionUv.xyz,1)).xyz;})();
  }
  dispose():void{this.geometry.dispose();this.smallGeometry.dispose();this.buffer.dispose();(this.data as THREE.StorageBufferAttribute&{pbo?:THREE.Texture}).pbo?.dispose();}
}
/** Explicit name for new callers; the historical export keeps producer imports stable. */
export {ItemContourAtlas as ItemBrushAtlas};
