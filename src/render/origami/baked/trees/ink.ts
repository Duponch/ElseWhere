/** Tree ink projection: original primitive ribbons first, exact shape transform second. */
import {transformGeneratedRibbon,validateRibbonPostTransform} from './ribbon-transform';
/** Source ribbon projection. Preparation only; no CPU colour raster fallback.
 * Source pigment/paper/coverage and real ribbon triangles become ONE opaque
 * colour atlas. The runtime keeps stock renderer lighting once on the body.
 * This is not pixel equivalence to separately lit MSAA transparent ribbons. */
import * as THREE from 'three/webgpu';
import {createOrigamiBrushGeometry,updateOrigamiBrushGeometry} from '../../brush-geometry';
import {paintMetricFromDerivatives} from '../../paint-metric';
import {projectBakedChart,bakedChartPixel,type BakedChartSet,type BakedChart,type Vec2,type Vec3} from '../charts';

export interface InkSourcePart {
 geometry:THREE.BufferGeometry;
 /** Optional affine placement applied only AFTER original Source ribbon generation. */
 postTransform?:THREE.Matrix4;
 sourceTriangleOffset:number;
 /** Original local triangle ordinal -> visible BODY index-stream ordinal.
  * 0xffffffff hides crossed/dead eyes, without changing local ribbon seeds. */
 sourceTriangleToBodyTriangle?:Uint32Array;
 partName?:string;
}
export interface BakedInk {
 geometries:THREE.BufferGeometry[];
 readonly triangleCount:number;
 readonly chartIds:Uint32Array;
 readonly bodyTriangles:Uint32Array;
 readonly pixelXY:Float64Array;
 readonly rawUv:Float64Array;
 readonly pigmentMetric:Float64Array;
 readonly disposed:boolean;
 readonly stats:Record<string,number|boolean|string>;
 dispose():void;
}
export interface PaintProfilePixels {
 pigment:Uint8Array;paper:Uint8Array;coverage:Uint8Array;
 orientation:'upload-bottom-up';
}
export interface AtlasPaintSource {
 readProfile(id:number):PaintProfilePixels;
 profile:{attribute:string;component:number};
 edgeAlpha:{data:Uint8Array;width:number;height:number};
 brushColorLinear:readonly[number,number,number];
 lineOpacity:number;strokeImperfection:number;
}
export interface AtlasBakeOptions {maxAtlasBytes?:number;maxScratchBytes?:number}
export interface AtlasBakeResult {data:Uint8Array;width:number;height:number;stats:Record<string,unknown>}
const TAG='uvBakedSourceTriangle',HIDDEN=0xffffffff;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const positiveInteger=(v:number,name:string)=>{if(!Number.isSafeInteger(v)||v<1)throw Error('Baked atlas: invalid '+name);return v;};
const finite=(v:number,name:string)=>{if(!Number.isFinite(v))throw Error('Baked atlas: nonfinite '+name);return v;};
const instanced=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
function geometryBytes(g:THREE.BufferGeometry):number{const seen=new Set<ArrayBufferLike>();let sum=0;for(const a of [...Object.values(g.attributes),...(g.index?[g.index]:[])])if(!seen.has(a.array.buffer)){seen.add(a.array.buffer);sum+=a.array.buffer.byteLength;}for(const key of ['referenceBrushBasePositions','referenceBrushWidthOffsets','referenceBrushRoughOffsets']){const a=g.userData[key];if(a instanceof Float32Array&&!seen.has(a.buffer)){seen.add(a.buffer);sum+=a.byteLength;}}return sum;}
/** Remove ONLY our provenance field and restore the actual Source stride. No
 * welding, normal change, contour recreation or vertex/index reordering. */
function sourceStrideGeometry(source:THREE.BufferGeometry,visibleIndices:number[]):THREE.BufferGeometry{
 const fields=Object.entries(source.attributes).filter(([name,a])=>name!==TAG&&!instanced(a));
 const count=source.getAttribute('position').count,stride=fields.reduce((n,[,a])=>n+a.itemSize,0),data=new Float32Array(count*stride);let offset=0;
 const result=new THREE.BufferGeometry(),packed=new THREE.InterleavedBuffer(data,stride);
 for(const [name,a]of fields){for(let i=0;i<count;i++)for(let c=0;c<a.itemSize;c++)data[i*stride+offset+c]=a.getComponent(i,c);result.setAttribute(name,new THREE.InterleavedBufferAttribute(packed,a.itemSize,offset));offset+=a.itemSize;}
 const index=source.index;if(index&&index.array instanceof Uint32Array)result.setIndex(new THREE.BufferAttribute(new Uint32Array(visibleIndices),1));else result.setIndex(new THREE.BufferAttribute(new Uint16Array(visibleIndices),1));
 result.userData={...source.userData};result.computeBoundingBox();result.computeBoundingSphere();return result;
}
/** Generate the SAME Source factory per original part; local edge seed order
 * is preserved even when the visible body omits dead eyes. Extra uv-named tag
 * is geometric to Sourcebrush, never an edge partition/discriminant. */
export function compileSourceInk(charts:BakedChartSet,parts:readonly InkSourcePart[],options:{edgeWidth:number;strokeImperfection:number;maxTriangles?:number}):BakedInk{
 const started=performance.now(),max=positiveInteger(options.maxTriangles??100_000,'ink triangle budget');finite(options.edgeWidth,'edgeWidth');finite(options.strokeImperfection,'strokeImperfection');
 let capacity=0;
 for(const part of parts){if(part.postTransform)validateRibbonPostTransform(part.postTransform);const g=part.geometry;if(g.userData.origamiBrushPrebuilt||g.hasAttribute(TAG))throw Error('Baked ink: source body cannot be prebuilt/tagged');const count=g.index?.count??g.getAttribute('position')?.count??0;if(count%3)throw Error('Baked ink: source triangle list required');const start=Math.max(0,g.drawRange.start),end=Math.min(count,start+g.drawRange.count);const selected=g.groups.length?g.groups.reduce((sum,r)=>sum+Math.max(0,Math.min(end,r.start+r.count)-Math.max(start,r.start)),0):g.userData.cargoRangesByKind?0:Math.max(0,end-start);capacity+=selected/3*12;if(!Number.isSafeInteger(capacity)||capacity>max||count/3>0xffffff)throw Error('Baked ink: triangle budget refused BEFORE ribbon generation');}
 let chartIds=new Uint32Array(capacity),bodyTriangles=new Uint32Array(capacity),pixelXY=new Float64Array(capacity*6),rawUv=new Float64Array(capacity*6),pigmentMetric=new Float64Array(capacity*3),n=0,hidden=0,sourceTriangles=0;
 const geometries:THREE.BufferGeometry[]=[];let disposed=false;
 try{
  for(const part of parts){const source=part.geometry,tagged=source.index?source.toNonIndexed():source.clone();let ribbons:THREE.BufferGeometry|undefined;
   try{
    tagged.setDrawRange(source.drawRange.start,source.drawRange.count);tagged.clearGroups();for(const g of source.groups)tagged.addGroup(g.start,g.count,g.materialIndex);tagged.userData={...source.userData};
    const count=tagged.getAttribute('position').count,tags=new Float32Array(count);for(let i=0;i<count;i++)tags[i]=Math.floor(i/3);tagged.setAttribute(TAG,new THREE.BufferAttribute(tags,1));
    ribbons=createOrigamiBrushGeometry(tagged);updateOrigamiBrushGeometry(ribbons,options.edgeWidth,options.strokeImperfection);if(part.postTransform)transformGeneratedRibbon(ribbons,part.postTransform);
    const position=ribbons.getAttribute('position'),uv=ribbons.getAttribute('uv'),tag=ribbons.getAttribute(TAG),index=ribbons.index,visible:number[]=[];
    if(!index||!tag)throw Error('Baked ink: Source factory did not carry provenance');sourceTriangles+=count/3;
    for(let at=0;at<index.count;at+=3){const ids=[index.getX(at),index.getX(at+1),index.getX(at+2)] as const,local=tag.getX(ids[0]);if(!Number.isSafeInteger(local)||ids.some(i=>tag.getX(i)!==local))throw Error('Baked ink: triangle provenance changed');
     const body=part.sourceTriangleToBodyTriangle?part.sourceTriangleToBodyTriangle[local]:part.sourceTriangleOffset+local;if(body===HIDDEN){hidden++;continue;}if(body===undefined||!Number.isSafeInteger(body)||body<0||body>=charts.triangles.length)throw Error('Baked ink: no corresponding visible body triangle');
     const chartId=charts.triangleChart[body]!,chart=charts.charts[chartId];if(!chart||n>=capacity)throw Error('Baked ink: chart/capacity mismatch');
     const points=ids.map(i=>[position.getX(i),position.getY(i),position.getZ(i)] as Vec3),coords=ids.map(i=>[uv.getX(i),uv.getY(i)] as Vec2);
     for(let corner=0;corner<3;corner++){const p=points[corner]!,projected=projectBakedChart(chart,p),pixel=bakedChartPixel(chart,projected,charts.atlas.texelsPerUnit);const distance=(p[0]-chart.origin[0])*chart.normal[0]+(p[1]-chart.origin[1])*chart.normal[1]+(p[2]-chart.origin[2])*chart.normal[2];if(Math.abs(distance)>1e-4)throw Error('Baked ink: actual ribbon is not coplanar with its body chart');pixelXY[n*6+corner*2]=pixel[0];pixelXY[n*6+corner*2+1]=pixel[1];rawUv[n*6+corner*2]=coords[corner]![0];rawUv[n*6+corner*2+1]=coords[corner]![1];}
     const diff=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],m=paintMetricFromDerivatives(diff(points[1]!,points[0]!),diff(points[2]!,points[0]!),[coords[1]![0]-coords[0]![0],coords[1]![1]-coords[0]![1]],[coords[2]![0]-coords[0]![0],coords[2]![1]-coords[0]![1]]),density=1/Math.sqrt(m[0]*m[2]);
     chartIds[n]=chartId;bodyTriangles[n]=body;pigmentMetric.set([m[0]*density,m[1]*density,m[2]*density],n*3);visible.push(...ids);n++;
    }
    geometries.push(sourceStrideGeometry(ribbons,visible));
   }finally{ribbons?.dispose();tagged.dispose();}
  }
 }catch(error){for(const g of geometries)g.dispose();throw error;}
 const descriptorBytes=chartIds.byteLength+bodyTriangles.byteLength+pixelXY.byteLength+rawUv.byteLength+pigmentMetric.byteLength,bytes=geometries.reduce((sum,g)=>sum+geometryBytes(g),0);
 const stats={sourceParts:parts.length,sourceTriangles,triangleCapacity:capacity,visibleInkTriangles:n,hiddenInkTriangles:hidden,descriptorBytes,geometryBytes:bytes,sourceStrideRestored:true,preparationMs:performance.now()-started,scope:'Real Source ribbon factory/order/UV/width/irregularity, rest pose; no boundary reconstruction.'};
 chartIds=chartIds.subarray(0,n);bodyTriangles=bodyTriangles.subarray(0,n);pixelXY=pixelXY.subarray(0,n*6);rawUv=rawUv.subarray(0,n*6);pigmentMetric=pigmentMetric.subarray(0,n*3);
 return{geometries,triangleCount:n,get chartIds(){return chartIds;},get bodyTriangles(){return bodyTriangles;},get pixelXY(){return pixelXY;},get rawUv(){return rawUv;},get pigmentMetric(){return pigmentMetric;},get disposed(){return disposed;},stats,
  dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();geometries.length=0;chartIds=new Uint32Array(0);bodyTriangles=new Uint32Array(0);pixelXY=new Float64Array(0);rawUv=new Float64Array(0);pigmentMetric=new Float64Array(0);},
 };
}
