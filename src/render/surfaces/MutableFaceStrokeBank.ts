/** One logical scalar table for dynamic models. Publication/retirement occurs
 * only at confirmed geometry adoption. Existing regions and material/node
 * identities never move when a different model arrives or a style changes.
 *
 * r186 cannot publicly retire a replaced element-only SSBO independently.
 * Old GPU allocations therefore have renderer/device lifetime; capacity grows
 * geometrically and never shrinks. CPU buffers are released normally by GC.
 * No hidden geometry or fake draw is used to claim earlier GPU retirement. */
import * as THREE from 'three/webgpu';
import {storage} from 'three/tsl';
import type {FaceStrokeData} from './FaceStrokeTable';

export interface FaceStrokeBankRegion {readonly faceOffset:number;readonly rowStart:number;readonly rows:number;release():void}
type Free={first:number;count:number};
export class MutableFaceStrokeBank implements FaceStrokeData {
 private data=new Float32Array(64);private attribute=new THREE.StorageBufferAttribute(this.data,4);
 readonly node=storage(this.attribute,'vec4',this.attribute.count).toReadOnly();
 readonly gpuLifetime='renderer' as const;
 private free:Free[]=[{first:0,count:16}];private closed=false;private edges=0;private maximumEdges=0;private regions=0;private capacityPeak=16;private allocatedGpuUpperBoundBytes=this.data.byteLength;
 constructor(private readonly maxCpuBytes=128*1024*1024){if(!Number.isSafeInteger(maxCpuBytes)||maxCpuBytes<256||maxCpuBytes>128*1024*1024)throw Error('Explicit scalar stroke-bank budget in [256,128MiB] required');}
 get values():Float32Array{return this.data;}get buffer():THREE.StorageBufferAttribute{return this.attribute;}get cpuBytes():number{return this.data.byteLength;}get faceCount():number{return this.data.length/8;}get edgeCount():number{return this.edges;}get maxEdgesPerFace():number{return this.maximumEdges;}
 assertCurrent():void{if(this.closed)throw Error('Mutable face-stroke bank retired');}
 private mergeFree():void{this.free.sort((a,b)=>a.first-b.first);const merged:Free[]=[];for(const block of this.free){const prior=merged.at(-1);if(prior&&prior.first+prior.count===block.first)prior.count+=block.count;else merged.push({...block});}this.free=merged;}
 private grow(required:number):void{
  const oldRows=this.data.length/4,tail=this.free.find(block=>block.first+block.count===oldRows),minimum=oldRows+required-(tail?.count??0),rows=2**Math.ceil(Math.log2(minimum)),bytes=rows*16;
  if(!Number.isSafeInteger(bytes)||bytes>this.maxCpuBytes)throw Error('Mutable face-stroke bank capacity refused BEFORE allocation');
  const data=new Float32Array(rows*4);data.set(this.data);this.data=data;this.attribute=new THREE.StorageBufferAttribute(data,4);this.node.value=this.attribute;
  this.free.push({first:oldRows,count:rows-oldRows});this.mergeFree();this.capacityPeak=rows;this.allocatedGpuUpperBoundBytes+=bytes;
 }
 publish(table:FaceStrokeData):FaceStrokeBankRegion{
  this.assertCurrent();table.assertCurrent();const rows=Math.ceil(table.values.length/8)*2;if(rows<2||table.faceCount*8>table.values.length)throw Error('Actual nonempty face-stroke records required');
  let index=this.free.findIndex(block=>block.count>=rows);if(index<0){this.grow(rows);index=this.free.findIndex(block=>block.count>=rows);}const slot=this.free[index]!;const first=slot.first;slot.first+=rows;slot.count-=rows;if(slot.count===0)this.free.splice(index,1);
  this.data.set(table.values,first*4);for(let face=0;face<table.faceCount;face++)this.data[first*4+face*8]=table.values[face*8]!+first;
  const edgeCount=table.edgeCount;this.attribute.addUpdateRange(first*4,rows*4);this.attribute.needsUpdate=true;this.edges+=edgeCount;this.maximumEdges=Math.max(this.maximumEdges,table.maxEdgesPerFace);this.regions++;let released=false;
  return{faceOffset:first/2,rowStart:first,rows,release:()=>{if(released)return;released=true;if(this.closed)return;this.edges-=edgeCount;this.regions--;this.free.push({first,count:rows});this.mergeFree();}};
 }
 snapshot(){return{regions:this.regions,capacityRows:this.capacityPeak,cpuBytes:this.cpuBytes,allocatedGpuUpperBoundBytes:this.allocatedGpuUpperBoundBytes,gpuLifetime:this.gpuLifetime};}
 dispose():void{if(this.closed)return;this.closed=true;this.free=[];this.node.dispose();}
}
