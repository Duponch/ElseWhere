import * as THREE from 'three/webgpu';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const isInstanced=(a:Attribute):boolean=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
const geometric=(name:string):boolean=>name==='position'||/normal|tangent|color|uv/i.test(name);
const read=(a:Attribute,i:number)=>new THREE.Vector3(a.getX(i),a.getY(i),a.getZ(i));
const hash=(n:number)=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
type FaceEdge={a:number;b:number;c:number;normal:THREE.Vector3;key:string;seed:number};
// Where each output value comes from, decided once per layout entry with the
// same precedence as before (position, uv, missing attribute, geometric, other).
const FROM_POSITION=0,FROM_UV=1,FROM_FACE_NORMAL=2,FROM_ZERO=3,FROM_LERP=4,FROM_FIRST=5;
const CROSS_SECTIONS=[0,.5,1] as const,STRIP_TRIANGLES=[0,2,3,0,3,1,2,4,5,2,5,3] as const;

/** One strip on each adjacent face of a sharp edge. Triangles never leave the
 * face plane. The strips move inward toward the source triangle's third point,
 * so their ends also stay on that face at corners. No line primitive, screen
 * offset, additional pose evaluation or per-frame CPU work is involved. */
export function createOrigamiBrushGeometry(source:THREE.BufferGeometry,thresholdAngle=22,baseWidth=.008):THREE.BufferGeometry {
 if(source.userData.origamiBrushPrebuilt){
  const result=new THREE.BufferGeometry();for(const [name,a]of Object.entries(source.attributes))result.setAttribute(name,a);
  if(source.index)result.setIndex(source.index);result.setDrawRange(source.drawRange.start,source.drawRange.count);
  for(const group of source.groups)result.addGroup(group.start,group.count,group.materialIndex);result.userData={...source.userData};return result;
 }
 const position=source.getAttribute('position'),index=source.index;
 const attributes=Object.entries(source.attributes).filter(([,a])=>!isInstanced(a));
 const layout=attributes.map(([name,a])=>({name,size:a.itemSize}));
 if(!layout.some(a=>a.name==='position'))layout.unshift({name:'position',size:3});
 if(!layout.some(a=>a.name==='normal'))layout.push({name:'normal',size:3});
 if(!layout.some(a=>a.name==='uv'))layout.push({name:'uv',size:2});
 const discriminants=attributes.filter(([name])=>!geometric(name));
 const edges=new Map<string,FaceEdge[]>();
 const total=index?.count??position?.count??0,start=Math.max(0,source.drawRange.start),end=Math.min(total,start+source.drawRange.count);
 const selected=source.groups.length?source.groups.map(group=>[Math.max(start,group.start),Math.min(end,group.start+group.count)] as const)
  :source.userData.cargoRangesByKind?[]:[[start,end] as const];
 // A vertex's rounded position key (micro-units), computed once per vertex.
 const vertexKeys:(string|undefined)[]=[];
 const vertexKey=(i:number)=>vertexKeys[i]??=`${Math.round(position.getX(i)*1e6)},${Math.round(position.getY(i)*1e6)},${Math.round(position.getZ(i)*1e6)}`;
 if(position)for(const [first,last]of selected)for(let at=first;at+2<last;at+=3){
  const vertices=[0,1,2].map(n=>index?index.getX(at+n):at+n),[a,b,c]=vertices as [number,number,number];
  const pa=read(position,a),pb=read(position,b),pc=read(position,c),normal=new THREE.Vector3().crossVectors(pb.clone().sub(pa),pc.clone().sub(pa));
  if(normal.lengthSq()<1e-20)continue;normal.normalize();
  const partition=discriminants.map(([name,attr])=>`${name}:${Array.from({length:attr.itemSize},(_,n)=>attr.getComponent(a,n)).join(',')}`).join('|');
  for(let e=0;e<3;e++){
   const i=vertices[e]!,j=vertices[(e+1)%3]!,k=vertices[(e+2)%3]!,ki=vertexKey(i),kj=vertexKey(j);
   const key=`${partition}/${ki<kj?`${ki}/${kj}`:`${kj}/${ki}`}`;
   let bucket=edges.get(key);if(!bucket){bucket=[];edges.set(key,bucket);}
   // Triangle seams can repeat vertices with different normals/UV. Retain
   // each face's own indices rather than recovering metadata by position.
   bucket.push({a:i,b:j,c:k,normal:normal.clone(),key,seed:at*3+e});
  }
 }
 const threshold=Math.cos(THREE.MathUtils.degToRad(thresholdAngle)),values:number[]=[],base:number[]=[],width:number[]=[],rough:number[]=[],indices:number[]=[];
 const sources=layout.map(entry=>{
  const attr=source.getAttribute(entry.name);
  const from=entry.name==='position'?FROM_POSITION:entry.name==='uv'?FROM_UV:!attr?(entry.name==='normal'?FROM_FACE_NORMAL:FROM_ZERO):geometric(entry.name)?FROM_LERP:FROM_FIRST;
  return {from,size:entry.size,attr};
 });
 // Same arithmetic, in the same order, as the former Vector3 version: copy,
 // sub, length, multiplyScalar, lerp and cross on plain numbers.
 function emit(edge:FaceEdge,t:number,across:number):void{
  const ax=position.getX(edge.a),ay=position.getY(edge.a),az=position.getZ(edge.a),bx=position.getX(edge.b),by=position.getY(edge.b),bz=position.getZ(edge.b);
  const cx=position.getX(edge.c),cy=position.getY(edge.c),cz=position.getZ(edge.c);
  let dx=bx-ax,dy=by-ay,dz=bz-az;const length=Math.sqrt(dx*dx+dy*dy+dz*dz),inverse=1/length;dx*=inverse;dy*=inverse;dz*=inverse;
  const px=ax+(bx-ax)*t,py=ay+(by-ay)*t,pz=az+(bz-az)*t,ex=cx-ax,ey=cy-ay,ez=cz-az;
  const qx=ey*dz-ez*dy,qy=ez*dx-ex*dz,qz=ex*dy-ey*dx,altitude=Math.sqrt(qx*qx+qy*qy+qz*qz);
  // Width5 and the maximum rough border still fit inside this triangle.
  const span=Math.min(baseWidth,altitude/7),scale=span/Math.max(altitude,1e-12),ix=(cx-px)*scale,iy=(cy-py)*scale,iz=(cz-pz)*scale;
  base.push(px,py,pz);width.push(ix*across,iy*across,iz*across);
  const irregular=across?(hash(edge.seed+t*97.13)-.5)*.7:hash(edge.seed+t*97.13+31)*.12;
  rough.push(ix*irregular,iy*irregular,iz*irregular);
  for(const {from,size,attr} of sources){
   for(let component=0;component<size;component++){
    let value:number;
    if(from===FROM_POSITION)value=component===0?px:component===1?py:component===2?pz:new THREE.Vector3().getComponent(component);
    else if(from===FROM_UV)value=component===0?t:across;
    else if(from===FROM_FACE_NORMAL)value=edge.normal.getComponent(component);
    else if(from===FROM_ZERO)value=0;
    else if(from===FROM_LERP)value=THREE.MathUtils.lerp(attr!.getComponent(edge.a,component),attr!.getComponent(edge.b,component),t);
    else value=attr!.getComponent(edge.a,component);
    values.push(value);
   }
  }
 }
 for(const bucket of edges.values()){
  for(const edge of bucket){
   // A coplanar triangle seam is not a painted silhouette edge. Boundaries
   // and each face of a true fold retain their own coplanar brush strip.
   if(bucket.length>1&&!bucket.some(other=>other!==edge&&edge.normal.dot(other.normal)<=threshold))continue;
   if(!position)continue;
   const sx=position.getX(edge.a)-position.getX(edge.b),sy=position.getY(edge.a)-position.getY(edge.b),sz=position.getZ(edge.a)-position.getZ(edge.b);
   if(sx*sx+sy*sy+sz*sz<1e-20)continue;
   const first=base.length/3;
   // Three cross-sections share their six real vertices across four triangles.
   // This halves pose work without changing the strip's triangles or UVs.
   for(const t of CROSS_SECTIONS){emit(edge,t,0);emit(edge,t,1);}
   for(const i of STRIP_TRIANGLES)indices.push(first+i);
  }
 }
 const geometry=new THREE.BufferGeometry(),stride=layout.reduce((sum,a)=>sum+a.size,0),packed=new THREE.InterleavedBuffer(new Float32Array(values),stride);
 let offset=0;for(const entry of layout){geometry.setAttribute(entry.name,new THREE.InterleavedBufferAttribute(packed,entry.size,offset));offset+=entry.size;}
 geometry.setIndex(indices);
 geometry.userData.origamiBrushPrebuilt=true;
 geometry.userData.referenceBrushBasePositions=new Float32Array(base);
 geometry.userData.referenceBrushWidthOffsets=new Float32Array(width);
 geometry.userData.referenceBrushRoughOffsets=new Float32Array(rough);
 updateOrigamiBrushGeometry(geometry,1,0);return geometry;
}

/** Called by the context only at construction and preference gestures. Atlas
 * entries target their shared SSBO; ordinary ribbons update the position field
 * of their one packed vertex stream. Padded atlas triangles have zero offsets. */
export function updateOrigamiBrushGeometry(geometry:THREE.BufferGeometry,width:number,imperfection:number,startVertex=0,vertexCount=Infinity):void {
 const base=geometry.userData.referenceBrushBasePositions as Float32Array|undefined,
  offsets=geometry.userData.referenceBrushWidthOffsets as Float32Array|undefined,
  rough=geometry.userData.referenceBrushRoughOffsets as Float32Array|undefined;
 if(!base||!offsets||!rough)return;
 const scale=Math.max(.5,Math.min(5,width)),amount=Math.max(0,Math.min(1,imperfection));
 const storage=geometry.userData.referenceBrushPositionStorage as THREE.StorageBufferAttribute|undefined,
  stride=(geometry.userData.referenceBrushStorageStride as number|undefined)??8,attribute=geometry.getAttribute('position');
 const first=Math.min(base.length/3,Math.max(0,Math.floor(startVertex))),last=Math.min(base.length/3,first+Math.max(0,Math.floor(vertexCount)));
 if(last<=first)return;
 if(storage){const target=storage.array;for(let i=first;i<last;i++)for(let c=0;c<3;c++)target[i*stride+c]=base[i*3+c]!+scale*(offsets[i*3+c]!+amount*rough[i*3+c]!);storage.addUpdateRange(first*stride,(last-first)*stride);storage.needsUpdate=true;}
 else if(attribute){for(let i=first;i<last;i++)attribute.setXYZ(i,base[i*3]!+scale*(offsets[i*3]!+amount*rough[i*3]!),base[i*3+1]!+scale*(offsets[i*3+1]!+amount*rough[i*3+1]!),base[i*3+2]!+scale*(offsets[i*3+2]!+amount*rough[i*3+2]!));if(attribute instanceof THREE.InterleavedBufferAttribute){attribute.data.addUpdateRange(first*attribute.data.stride,(last-first)*attribute.data.stride);attribute.data.needsUpdate=true;}else{attribute.addUpdateRange(first*attribute.itemSize,(last-first)*attribute.itemSize);attribute.needsUpdate=true;}}
 geometry.boundingBox=null;geometry.boundingSphere=null;
}
