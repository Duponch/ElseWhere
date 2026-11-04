/** Shared animal geometry. Texture selection never changes a model, its face
 * IDs, the two UV domains, clinical tags or resident33-float instance layout. */
import * as THREE from 'three/webgpu';
import {commonAnimalPresentationGeometry} from '../origami/animal-geometry';
import {indexExactStaticVertices} from '../origami/static-index';
import {bakeAnimalCoatCoordinates} from '../animal-surface-paint';
import {compileFaceStrokeTable,attachFaceStrokeGpuRetirement,type FaceStrokeTable} from '../surfaces/FaceStrokeTable';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const instanced=(a:Attribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
const metadataKeys=['origamiReference','origamiParts','origamiBodyCenter','origamiReferenceScale','origamiReferenceFloor','origamiPresentationCorrections','origamiReferenceInfo','origamiCargoBack']as const;
export const ANIMAL_SURFACE_PROFILE_STRIDE=128;
export interface AnimalModel {
 readonly key:string;readonly species:string;readonly geometry:THREE.BufferGeometry;
 readonly sourceVertex:Uint32Array;readonly faceIds:Float32Array;readonly strokes:FaceStrokeTable;readonly triangleCount:number;readonly metadata:Readonly<Record<string,unknown>>;readonly cpuBytes:number;
 assertCurrent():void;retain():{assertCurrent():void;release():void};instantiate(capacity:number):THREE.InstancedBufferGeometry;
}
function arraysBytes(geometries:readonly THREE.BufferGeometry[],extra:readonly THREE.TypedArray[]):number{const seen=new Set<ArrayBufferLike>();for(const g of geometries){for(const a of Object.values(g.attributes))seen.add(a.array.buffer);if(g.index)seen.add(g.index.array.buffer);}for(const a of extra)seen.add(a.buffer);return[...seen].reduce((n,b)=>n+b.byteLength,0);}
/** GPU wrappers belong to their rig. Only immutable CPU backing arrays may be
 * shared: disposing another geometry must never retire a live BufferAttribute. */
function cloneStaticInto(target:THREE.BufferGeometry,source:THREE.BufferGeometry):void{
 const interleaved=new Map<THREE.InterleavedBuffer,THREE.InterleavedBuffer>();
 for(const[name,a]of Object.entries(source.attributes)){
  if(instanced(a))continue;
  if(a instanceof THREE.InterleavedBufferAttribute){let data=interleaved.get(a.data);if(!data){data=new THREE.InterleavedBuffer(a.data.array,a.data.stride).setUsage(a.data.usage);interleaved.set(a.data,data);}target.setAttribute(name,new THREE.InterleavedBufferAttribute(data,a.itemSize,a.offset,a.normalized));}
  else{const next=new THREE.BufferAttribute(a.array,a.itemSize,a.normalized).setUsage(a.usage);next.gpuType=a.gpuType;target.setAttribute(name,next);}
 }
 // Active-part unions compact this index in place. It is the rig's mutable
 // index, never a borrowed model index or another rig's clinical visibility.
 if(source.index)target.setIndex(new THREE.BufferAttribute(source.index.array.slice(),1));target.boundingBox=source.boundingBox?.clone()??null;target.boundingSphere=source.boundingSphere?.clone()??null;
}
function instanceOwners(geometry:THREE.InstancedBufferGeometry,capacity:number):void{
 const data=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*33),33).setUsage(THREE.StaticDrawUsage);
 for(const[name,size,offset]of [['aFrom',4,0],['aTo',4,4],['aTravel',4,8],['aAnimal',4,12],['aScale',1,16],['aBodyBlood',1,17],['aAbsent',1,18],['aCarrier',4,19],['aCorpseHandoff',2,23],['aCorpseFrom',4,25],['aCorpseTo',4,29],['aBiology',3,16]]as const)geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(data,size,offset));geometry.instanceCount=0;
}
export class AnimalModels {
 private readonly models=new Map<string,AnimalModel>();private readonly owned=new Set<THREE.BufferGeometry>();private readonly strokeTables=new Set<FaceStrokeTable>();private bytes=0;private holds=0;private closing=false;private retired=false;
 constructor(private readonly maxCpuBytes=128*1024*1024){if(!Number.isSafeInteger(maxCpuBytes)||maxCpuBytes<1)throw Error('Explicit animal model CPU budget required');}
 get(species:string):AnimalModel{
  if(this.closing)throw Error('Animal model library retired');const cached=this.models.get(species);if(cached)return cached;if(this.bytes+1024*1024>this.maxCpuBytes)throw Error('Animal model budget refused before allocation');
  const source=commonAnimalPresentationGeometry(1,species,false);if(!source)throw Error('No shared actual animal model for '+species);let original:THREE.BufferGeometry|undefined,template:THREE.BufferGeometry|undefined,strokes:FaceStrokeTable|undefined,delivered=false;
  try{
   indexExactStaticVertices(source);original=new THREE.BufferGeometry();for(const[name,a]of Object.entries(source.attributes))if(!instanced(a))original.setAttribute(name,a);if(source.index)original.setIndex(source.index);original.setDrawRange(source.drawRange.start,source.drawRange.count);for(const group of source.groups)original.addGroup(group.start,group.count,group.materialIndex);
   const metadata:Record<string,unknown>={};for(const key of metadataKeys)if(Object.hasOwn(source.userData,key))metadata[key]=source.userData[key];original.userData={...metadata};
   const corners=original.index?.count??original.getAttribute('position').count;if(corners%3||corners/3>20000)throw Error('Animal complete triangle domain exceeds its declared bound');
   const coatView=new THREE.BufferGeometry();for(const[name,a]of Object.entries(original.attributes))coatView.setAttribute(name,a);let coat:Attribute;try{bakeAnimalCoatCoordinates(coatView,species);coat=coatView.getAttribute('animalPaintUv');}finally{coatView.dispose();}
   original.setAttribute('uvAnimalCoat',coat!);strokes=compileFaceStrokeTable(original,{uvAttribute:'animalPaintUv',maxCpuBytes:64*1024*1024,maxTriangles:20000});const sourceVertex=strokes.sourceVertex,faceIds=strokes.faceIds,count=sourceVertex.length;
   template=new THREE.BufferGeometry();for(const[name,attr]of Object.entries(original.attributes)){const values=new Float32Array(count*attr.itemSize);for(let v=0;v<count;v++)for(let c=0;c<attr.itemSize;c++)values[v*attr.itemSize+c]=attr.getComponent(sourceVertex[v]!,c);template.setAttribute(name,new THREE.BufferAttribute(values,attr.itemSize));}template.setIndex(new THREE.BufferAttribute(strokes.sourceIndex,1));
   const author=template.getAttribute('animalPaintUv'),coatUv=template.getAttribute('uvAnimalCoat'),packedUv=new Float32Array(count*4),paint=template.getAttribute('animalPaint');if(!paint||paint.itemSize!==4)throw Error('Actual packed animal palette missing');
   for(let v=0;v<count;v++){packedUv[v*4]=author.getX(v);packedUv[v*4+1]=author.getY(v);packedUv[v*4+2]=coatUv.getX(v);packedUv[v*4+3]=coatUv.getY(v);const profile=paint.getW(v),word=profile+faceIds[v]!*ANIMAL_SURFACE_PROFILE_STRIDE;if(!Number.isSafeInteger(profile)||profile<0||profile>=ANIMAL_SURFACE_PROFILE_STRIDE||word>=2**24)throw Error('Animal virtual palette/face exceeds exact packed domain');paint.setW(v,word);}
   metadata.animalSurfaceProfileStride=ANIMAL_SURFACE_PROFILE_STRIDE;
   template.setAttribute('animalSurfaceUv',new THREE.BufferAttribute(packedUv,4));template.userData={...metadata};indexExactStaticVertices(template);template.computeBoundingBox();template.computeBoundingSphere();
   const cpuBytes=arraysBytes([template],[sourceVertex,faceIds])+strokes.cpuBytes+16384;if(this.bytes+cpuBytes>this.maxCpuBytes)throw Error('Animal retained model budget refused');const ownedTemplate=template,key=JSON.stringify(['animal-model-face-v1',species]),assertCurrent=()=>{if(this.closing||this.retired)throw Error('Animal model retired');};
   const model:AnimalModel={key,species,geometry:ownedTemplate,sourceVertex,faceIds,strokes,triangleCount:corners/3,metadata:Object.freeze(metadata),cpuBytes,assertCurrent,retain:()=>{assertCurrent();this.holds++;let live=true;return{assertCurrent:()=>{if(!live)throw Error('Animal model lease released');assertCurrent();},release:()=>{if(!live)return;live=false;this.holds--;if(this.closing&&!this.holds)this.retire();}};},instantiate:(capacity:number)=>{assertCurrent();if(!Number.isSafeInteger(capacity)||capacity<1)throw Error('Actual animal capacity required');const geometry=new THREE.InstancedBufferGeometry();cloneStaticInto(geometry,ownedTemplate);geometry.userData={...metadata};instanceOwners(geometry,capacity);return geometry;}};
   this.owned.add(template);this.strokeTables.add(strokes);this.models.set(species,model);this.bytes+=cpuBytes;delivered=true;return model;
  }finally{const errors:unknown[]=[];if(!delivered&&strokes)try{strokes.dispose();}catch(e){errors.push(e);}for(const g of [original,...(!delivered?[template]:[]),source,...['origamiLines','origamiWear'].map(key=>source.userData[key]).filter((g):g is THREE.BufferGeometry=>g instanceof THREE.BufferGeometry)])if(g)try{g.dispose();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Animal model preparation cleanup failed');}
 }
 snapshot(){return{models:this.models.size,cpuBytes:this.bytes,leases:this.holds,closing:this.closing};}
 /** Final closure only. Actual instanced animal bodies are outside435; any
  * initialized resident body can release these element-only shared buffers.
  * Never attach this metadata during normal drawing or capacity growth. */
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{if(this.closing)throw Error('Animal model library retired');const candidates=[...geometries];for(const table of this.strokeTables)attachFaceStrokeGpuRetirement(table,candidates);}
 private retire():void{if(this.retired)return;this.retired=true;const errors:unknown[]=[];for(const resource of [...this.owned,...this.strokeTables])try{resource.dispose();}catch(e){errors.push(e);}this.owned.clear();this.strokeTables.clear();this.models.clear();this.bytes=0;if(errors.length)throw new AggregateError(errors,'Animal model cleanup failed');}
 dispose():void{if(this.closing)return;this.closing=true;if(!this.holds)this.retire();}
}
