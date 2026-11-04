/** Shared human bind models. Geometry and face-stroke provenance depend only
 * on resident model features; texture styles and palette rows never enter keys. */
import * as THREE from 'three/webgpu';
import {origamiHumanGeometry} from '../origami/human-geometry';
import {indexExactStaticVertices} from '../origami/static-index';
import {compileFaceStrokeTable,type FaceStrokeTable} from '../surfaces/FaceStrokeTable';

export interface HumanModelFeatures {readonly smithing:boolean;readonly mace:boolean;readonly longsword:boolean;readonly spear:boolean}
export interface HumanModel {readonly key:string;readonly strokes:FaceStrokeTable;readonly cpuBytes:number;createGeometry():THREE.InstancedBufferGeometry;assertCurrent():void}

/** Optional physical wear is an effect of the existing bind model. No cache
 * survives wear0, and no style identity participates in its preparation. */
export function createHumanWearGeometry(features:HumanModelFeatures):THREE.InstancedBufferGeometry{
 const source=origamiHumanGeometry(features.smithing,features.mace,features.longsword,features.spear,true,true),wear=source.userData.origamiWear as THREE.InstancedBufferGeometry|undefined;
 try{
  if(!wear)throw Error('Actual human physical-wear source missing');
  const count=wear.getAttribute('position').count,values=new Float32Array(count*18),packed=new THREE.InterleavedBuffer(values,18),result=new THREE.InstancedBufferGeometry();
  for(const[name,size,offset]of [['position',3,0],['normal',3,3],['color',3,6],['boneId',1,9],['dye',1,10],['origamiMaterialProfile',1,11],['bindPivot',3,13],['uv',2,16]] as const){const a=wear.getAttribute(name);for(let v=0;v<count;v++)for(let c=0;c<size;c++)values[v*18+offset+c]=a.getComponent(v,c);result.setAttribute(name,new THREE.InterleavedBufferAttribute(packed,size,offset));}
  result.setAttribute('pawnRigTraits',new THREE.InterleavedBufferAttribute(packed,4,9));result.setAttribute('origamiPaintUv',result.getAttribute('uv'));result.userData={...wear.userData};result.instanceCount=0;return result;
 }finally{source.dispose();wear?.dispose();const lines=source.userData.origamiLines;if(lines instanceof THREE.BufferGeometry)lines.dispose();}
}
function byteSize(g:THREE.BufferGeometry){const buffers=new Set<ArrayBufferLike>();for(const a of Object.values(g.attributes))buffers.add(a.array.buffer);if(g.index)buffers.add(g.index.array.buffer);return[...buffers].reduce((n,b)=>n+b.byteLength,0);}
export class HumanModels {
 private readonly entries=new Map<string,HumanModel>();private readonly owned:THREE.BufferGeometry[]=[];private readonly strokes:FaceStrokeTable[]=[];private bytes=0;private closed=false;
 constructor(private readonly maxCpuBytes=64*1024*1024){if(!Number.isSafeInteger(maxCpuBytes)||maxCpuBytes<1)throw Error('Explicit shared-human model budget required');}
 get(features:HumanModelFeatures):HumanModel{
  if(this.closed)throw Error('Shared human model library retired');const key=JSON.stringify(['shared-human-model-v1',features.smithing,features.mace,features.longsword,features.spear]),cached=this.entries.get(key);if(cached)return cached;
  const source=origamiHumanGeometry(features.smithing,features.mace,features.longsword,features.spear,false,false);let strokes:FaceStrokeTable|undefined,geometry:THREE.InstancedBufferGeometry|undefined,delivered=false;
  try{
   indexExactStaticVertices(source);strokes=compileFaceStrokeTable(source,{maxCpuBytes:32*1024*1024,maxTriangles:10000,uvAttribute:'uv'});
   const count=strokes.sourceVertex.length,data=new Float32Array(count*18),packed=new THREE.InterleavedBuffer(data,18);geometry=new THREE.InstancedBufferGeometry();
   const position=source.getAttribute('position'),normal=source.getAttribute('normal'),color=source.getAttribute('color'),traits=source.getAttribute('pawnRigTraits'),pivot=source.getAttribute('bindPivot'),uv=source.getAttribute('uv');
   for(let vertex=0;vertex<count;vertex++){const old=strokes.sourceVertex[vertex]!,at=vertex*18;data.set([position.getX(old),position.getY(old),position.getZ(old),normal.getX(old),normal.getY(old),normal.getZ(old),color.getX(old),color.getY(old),color.getZ(old),traits.getX(old),traits.getY(old),traits.getZ(old),strokes.faceIds[vertex]!,pivot.getX(old),pivot.getY(old),pivot.getZ(old),uv.getX(old),uv.getY(old)],at);}
   for(const[name,size,offset]of [['position',3,0],['normal',3,3],['color',3,6],['boneId',1,9],['dye',1,10],['origamiMaterialProfile',1,11],['pawnRigTraits',4,9],['bindPivot',3,13]] as const)geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(packed,size,offset));
   const authorUv=new THREE.InterleavedBufferAttribute(packed,2,16);geometry.setAttribute('uv',authorUv);geometry.setAttribute('origamiPaintUv',authorUv);geometry.setIndex(new THREE.BufferAttribute(count>65535?strokes.sourceIndex:Uint16Array.from(strokes.sourceIndex),1));geometry.instanceCount=0;geometry.userData={...source.userData,sharedHumanModel:key};geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const cpuBytes=byteSize(geometry)+strokes.cpuBytes;if(this.bytes+cpuBytes>this.maxCpuBytes)throw Error('Shared human model retention budget refused');const master=geometry,table=strokes,assertCurrent=()=>{if(this.closed)throw Error('Shared human model library retired');table.assertCurrent();},model:HumanModel={key,strokes:table,cpuBytes,assertCurrent,createGeometry:()=>{assertCurrent();return master.clone();}};
   this.owned.push(master);this.strokes.push(table);this.bytes+=cpuBytes;this.entries.set(key,model);delivered=true;return model;
  }finally{source.dispose();if(!delivered){geometry?.dispose();strokes?.dispose();}}
 }
 snapshot(){return{models:this.entries.size,cpuBytes:this.bytes,scope:'Shared bind geometry and scalar edge provenance only; no palette raster or renderer'};}
 dispose(){if(this.closed)return;this.closed=true;const errors:unknown[]=[];for(const r of [...this.owned,...this.strokes])try{r.dispose();}catch(error){errors.push(error);}this.owned.length=this.strokes.length=0;this.entries.clear();this.bytes=0;if(errors.length)throw new AggregateError(errors,'Shared human model cleanup failed');}
}
