/** Shared Rock Source algebra and an isolated, freshly prepared bake stencil.
 * No atlas, renderer, paint generation, lighting or frame observer lives here. */
import * as THREE from 'three/webgpu';
import {positionLocal,texture,varying,vec2} from 'three/tsl';
import {AffineStrokeOwner,linearCanonicalStencil,normalizedStrokeSettings,type StrokeSettings} from './AffineStrokeOwner';
import {createPreparedAffineStrokeNode,type AffineStrokeNodeOptions} from './AffineStrokeKernel';
import {FACE_STROKE_EDGE_FLOATS,FACE_STROKE_EDGE_ROWS,FACE_STROKE_HEADER_ROWS,type FaceStrokeData} from './FaceStrokeTable';
import {storage} from 'three/tsl';

/** Keep the original arithmetic, unnamed varying and texture decode. In a bake,
 * positionForStone is the REAL interpolated Source position, never chart clip. */
export function rockStonePaintUvNode(positionForStone:THREE.Node<'vec3'>=positionLocal):THREE.Node<'vec2'>{
 return varying(positionForStone.xz.mul(.026).add(positionForStone.y.mul(vec2(.009,.007))));
}
export function rockBodyColorNode(vertexColor:THREE.Node<'vec3'>,stonePaint:THREE.Texture,stoneUv:THREE.Node<'vec2'>):THREE.Node<'vec3'>{
 return vertexColor.mul(texture(stonePaint,stoneUv).rgb);
}
/** The current affine kernel owns Source coverage/order/dry/alpha/algebra.
 * A future chart baker MUST supply its real3D surfacePosition explicitly. */
export function rockFinalAffineAlbedoNode(body:THREE.Node<'vec3'>,options:AffineStrokeNodeOptions):THREE.Node<'vec3'>{
 return createPreparedAffineStrokeNode(body,options);
}
/** Explicit bake port: real3D metric and real Source stone position cannot be
 * silently replaced by the geometry's atlas-clip position. No lighting baked. */
export function rockFinalBakeAlbedoNode(options:{readonly positionForStone:THREE.Node<'vec3'>;readonly vertexColor:THREE.Node<'vec3'>;readonly stonePaint:THREE.Texture;readonly physicalSurfacePosition:THREE.Node<'vec3'>;readonly stroke:Omit<AffineStrokeNodeOptions,'surfacePosition'>}):THREE.Node<'vec3'>{
 const body=rockBodyColorNode(options.vertexColor,options.stonePaint,rockStonePaintUvNode(options.positionForStone));
 return rockFinalAffineAlbedoNode(body,{...options.stroke,surfacePosition:options.physicalSurfacePosition});
}

/** Exact typed streams exported by the real Rock producer. Offsets are in
 * EDGES, not floats or original sparse Source row addresses. Headers preserve
 * all eight original Source floats; only header.x is rebased by this owner. */
export interface RockFinalCanonicalInput{
 readonly faceId:Uint32Array;
 readonly faceHeader:Float32Array;
 readonly faceEdgeOffset:Uint32Array;
 readonly canonicalEdges:Float32Array;
 revision():string;
 assertCurrent():void;
}
export interface RockFinalAffineSnapshot{
 readonly owner:AffineStrokeOwner;
 readonly canonical:FaceStrokeData;
 readonly denseToSource:Uint32Array;
 readonly revision:string;
 readonly settings:StrokeSettings;
 readonly peakPreparationCpuBytes:number;
 readonly cpuBytes:number;
 /** Prepared buffer only; canonical rows are CPU-only in this snapshot. */
 readonly potentialPreparedGpuBytes:number;
 denseFaceId(sourceFaceId:number):number;
 assertCurrent():void;
 /** Terminal only, on ACTUAL baker geometry before that geometry is disposed.
  * Public r186 storage retirement has no stronger guarantee than this API. */
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void;
 dispose():void;
}
export class RockFinalSourceAdmissionRefusal extends Error{}
const MiB=1024*1024;

/** Preparation-only. Never borrows the manager's published AffineOwner: its
 * coefficients may still describe the old settings during global stageALL. */
export function createRockFinalAffineSnapshot(input:RockFinalCanonicalInput,settings:StrokeSettings,limits:{readonly maxCpuBytes:number;readonly maxBindingBytes:number}):RockFinalAffineSnapshot{
 input.assertCurrent();
 const ids=input.faceId,headers=input.faceHeader,offsets=input.faceEdgeOffset,edges=input.canonicalEdges,revision=input.revision(),normalized=Object.freeze(normalizedStrokeSettings(settings)),faces=ids.length;
 if(!(ids instanceof Uint32Array)||!(headers instanceof Float32Array)||!(offsets instanceof Uint32Array)||!(edges instanceof Float32Array)||!Number.isSafeInteger(limits.maxCpuBytes)||limits.maxCpuBytes<=0||!Number.isSafeInteger(limits.maxBindingBytes)||limits.maxBindingBytes<=0||limits.maxBindingBytes>128*MiB||!faces||headers.length!==faces*8||offsets.length!==faces+1||offsets[0]!==0||edges.length%FACE_STROKE_EDGE_FLOATS||offsets[faces]!==edges.length/FACE_STROKE_EDGE_FLOATS)throw new RockFinalSourceAdmissionRefusal('Exact bounded Source face/header/edge streams required');
 let maxEdges=0;
 for(let face=0;face<faces;face++){
  const sourceId=ids[face]!,first=face*8,count=offsets[face+1]!-offsets[face]!;
  if((face>0&&sourceId<=ids[face-1]!)||Math.fround(sourceId)!==sourceId||!Number.isSafeInteger(headers[first])||headers[first]!<0||count<0||count>4||headers[first+1]!==count)throw new RockFinalSourceAdmissionRefusal('Sorted unique Source IDs and actual four-edge Rock counts required');
  maxEdges=Math.max(maxEdges,count);
 }
 if(headers.some(value=>!Number.isFinite(value))||edges.some(value=>!Number.isFinite(value)))throw new RockFinalSourceAdmissionRefusal('Finite exact Source canonical records required');
 const denseRows=faces*FACE_STROKE_HEADER_ROWS+edges.length/4,canonicalBytes=denseRows*16,idBytes=ids.byteLength,preparedBytes=2**Math.ceil(Math.log2(Math.max(4,denseRows)))*16;
 // Source copy + ID map + prepared HWM/initial16B + stage values AND undo.
 const peakPreparationCpuBytes=canonicalBytes+idBytes+preparedBytes+16+canonicalBytes*2;
 if(!Number.isSafeInteger(peakPreparationCpuBytes)||peakPreparationCpuBytes>limits.maxCpuBytes||preparedBytes>limits.maxBindingBytes||canonicalBytes>limits.maxBindingBytes)throw new RockFinalSourceAdmissionRefusal('Dense Source/prepared/staging budget refused BEFORE allocation');
 let closed=false,canonicalClosed=false;
 const assertCurrent=()=>{if(closed)throw Error('Rock final affine snapshot retired');input.assertCurrent();if(input.revision()!==revision||input.faceId!==ids||input.faceHeader!==headers||input.faceEdgeOffset!==offsets||input.canonicalEdges!==edges)throw Error('Rock Source snapshot superseded');};
 assertCurrent();
 const denseToSource=ids.slice(),values=new Float32Array(denseRows*4);let row=faces*FACE_STROKE_HEADER_ROWS;
 for(let face=0;face<faces;face++){
  values.set(headers.subarray(face*8,face*8+8),face*8);values[face*8]=row;
  const first=offsets[face]!*FACE_STROKE_EDGE_FLOATS,last=offsets[face+1]!*FACE_STROKE_EDGE_FLOATS;
  values.set(edges.subarray(first,last),row*4);row+=(last-first)/4;
 }
 const buffer=new THREE.StorageBufferAttribute(values,4),node=storage(buffer,'vec4',0).toReadOnly();
 const canonical:FaceStrokeData={faceCount:faces,edgeCount:edges.length/FACE_STROKE_EDGE_FLOATS,maxEdgesPerFace:maxEdges,values,buffer,node,cpuBytes:values.byteLength,assertCurrent(){if(canonicalClosed)throw Error('Dense Rock canonical snapshot retired');assertCurrent();},dispose(){if(canonicalClosed)return;node.dispose();canonicalClosed=true;}};
 const denseIds=()=>Array.from({length:faces},(_,i)=>i),source=linearCanonicalStencil(canonical,{faceIds:denseIds,revision:()=>revision,isLinear:()=>true,interiorCircle:true}),owner=new AffineStrokeOwner(source,{maxBindingBytes:limits.maxBindingBytes,maxOwnedBytes:limits.maxCpuBytes-canonicalBytes-idBytes,maxStageBytes:limits.maxCpuBytes-canonicalBytes-idBytes});
 try{
  const stage=owner.stageAll(normalized);
  try{stage.publish();stage.commit();}finally{stage.dispose();}
  assertCurrent();
 }catch(error){const failures:unknown[]=[error];try{owner.dispose();}catch(cleanup){failures.push(cleanup);}try{canonical.dispose();}catch(cleanup){failures.push(cleanup);}if(failures.length>1)throw new AggregateError(failures,'Isolated Rock affine preparation cleanup failed');throw error;}
 return{
  owner,canonical,denseToSource,revision,settings:normalized,peakPreparationCpuBytes,
  get cpuBytes(){return canonical.cpuBytes+denseToSource.byteLength+owner.cpuBytes;},
  get potentialPreparedGpuBytes(){return owner.buffer.array.byteLength;},
  denseFaceId(sourceFaceId){assertCurrent();let lo=0,hi=denseToSource.length-1;while(lo<=hi){const mid=(lo+hi)>>>1,value=denseToSource[mid]!;if(value===sourceFaceId)return mid;if(value<sourceFaceId)lo=mid+1;else hi=mid-1;}throw Error('Source face absent from actual Rock bake demand');},
  assertCurrent,
  attachGpuRetirement(geometries){assertCurrent();owner.attachGpuRetirement(geometries);},
  dispose(){if(closed)return;const failures:unknown[]=[];try{owner.dispose();}catch(error){failures.push(error);}try{canonical.dispose();}catch(error){failures.push(error);}if(failures.length)throw new AggregateError(failures,'Rock final affine terminal cleanup failed');closed=true;}
 };
}
