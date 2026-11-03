/** Supersampled CPU reference used by tests, never an implicit game fallback.
 * Source pigment/paper/coverage and real ribbon triangles become ONE opaque
 * colour atlas. The runtime keeps genuine dynamic PBR lighting once on body.
 * Four true working samples per final texel, composed before linear resolve.
 * This is not pixel equivalence to separately lit MSAA transparent ribbons. */
import * as THREE from 'three/webgpu';
import {createOrigamiBrushGeometry,updateOrigamiBrushGeometry} from '../brush-geometry';
import {paintMetricFromDerivatives} from '../paint-metric';
import {projectBakedChart,bakedChartPixel,type BakedChartSet,type BakedChart,type Vec2,type Vec3} from './charts';

export interface InkSourcePart {
 geometry:THREE.BufferGeometry;
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
 for(const part of parts){const g=part.geometry;if(g.userData.origamiBrushPrebuilt||g.hasAttribute(TAG))throw Error('Baked ink: source body cannot be prebuilt/tagged');const count=g.index?.count??g.getAttribute('position')?.count??0;if(count%3)throw Error('Baked ink: source triangle list required');const start=Math.max(0,g.drawRange.start),end=Math.min(count,start+g.drawRange.count);const selected=g.groups.length?g.groups.reduce((sum,r)=>sum+Math.max(0,Math.min(end,r.start+r.count)-Math.max(start,r.start)),0):g.userData.cargoRangesByKind?0:Math.max(0,end-start);capacity+=selected/3*12;if(!Number.isSafeInteger(capacity)||capacity>max||count/3>0xffffff)throw Error('Baked ink: triangle budget refused BEFORE ribbon generation');}
 let chartIds=new Uint32Array(capacity),bodyTriangles=new Uint32Array(capacity),pixelXY=new Float64Array(capacity*6),rawUv=new Float64Array(capacity*6),pigmentMetric=new Float64Array(capacity*3),n=0,hidden=0,sourceTriangles=0;
 const geometries:THREE.BufferGeometry[]=[];let disposed=false;
 try{
  for(const part of parts){const source=part.geometry,tagged=source.index?source.toNonIndexed():source.clone();let ribbons:THREE.BufferGeometry|undefined;
   try{
    tagged.setDrawRange(source.drawRange.start,source.drawRange.count);tagged.clearGroups();for(const g of source.groups)tagged.addGroup(g.start,g.count,g.materialIndex);tagged.userData={...source.userData};
    const count=tagged.getAttribute('position').count,tags=new Float32Array(count);for(let i=0;i<count;i++)tags[i]=Math.floor(i/3);tagged.setAttribute(TAG,new THREE.BufferAttribute(tags,1));
    ribbons=createOrigamiBrushGeometry(tagged);updateOrigamiBrushGeometry(ribbons,options.edgeWidth,options.strokeImperfection);
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

/** Hardware sRGB texel decode, BEFORE linear filtering. The following two
 * transfer functions reproduce the installed r186 shader constants, not a
 * fitted gamma. Final atlas storage uses standard sRGB encode for hardware. */
const decodeByte=Float64Array.from({length:256},(_,i)=>{const x=i/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
export const sourceOetf=(x:number)=>x<=.0031308?x*12.92:x**.41666*1.055-.055;
export const sourceEotf=(x:number)=>x<=.04045?x*.0773993808:(x*.9478672986+.0521327014)**2.4;
const storeSrgb=(x:number)=>Math.round(clamp(x<=.0031308?x*12.92:1.055*clamp(x)**(1/2.4)-.055)*255);
function texel(value:number,size:number,repeat:boolean):number{return repeat?((value%size)+size)%size:Math.max(0,Math.min(size-1,value));}
function sample(data:Uint8Array,width:number,height:number,u:number,v:number,channel:number,channels:number,srgb:boolean,repeatU:boolean,repeatV:boolean):number{
 const x=(repeatU?u-Math.floor(u):clamp(u))*width-.5,y=(repeatV?v-Math.floor(v):clamp(v))*height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const tap=(dx:number,dy:number)=>{const b=data[(texel(iy+dy,height,repeatV)*width+texel(ix+dx,width,repeatU))*channels+channel]!;return srgb?decodeByte[b]!:b/255;};
 const a=tap(0,0)*(1-fx)+tap(1,0)*fx,b=tap(0,1)*(1-fx)+tap(1,1)*fx;return a*(1-fy)+b*fy;
}
export function sampleBodyLinear(profile:PaintProfilePixels,u:number,v:number,metric:readonly[number,number,number],base:readonly[number,number,number]=[1,1,1]):[number,number,number]{
 const size=Math.sqrt(profile.coverage.length),pu=u*metric[0]+v*metric[1],pv=v*metric[2],coverage=sample(profile.coverage,size,size,u,v,0,1,false,false,false);
 const result=[0,0,0] as [number,number,number];for(let c=0;c<3;c++){const pigment=sample(profile.pigment,size,size,pu,pv,c,4,true,true,true),paper=sample(profile.paper,size,size,u,v,c,4,true,false,false);result[c]=sourceEotf(sourceOetf(paper)*(1-coverage)+sourceOetf(pigment)*coverage)*base[c]!;}return result;
}
export interface SourceMipChain {levels:{data:Uint8Array;width:number;height:number}[];channels:number;srgb:boolean;extraBytes:number}
export interface PreparedPaintProfile {pigment:SourceMipChain;paper:SourceMipChain;coverage:SourceMipChain}
/** [du/dx,dv/dx,du/dy,dv/dy], with x/y measured in atlas level0 pixels. */
export type AtlasUvJacobian=readonly[number,number,number,number];
function mipBytes(width:number,height:number,channels:number):number{
 let result=0;while(width>1||height>1){width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));result+=width*height*channels;}return result;
}
/** Source WebGPU mip generation samples the previous SRGB view in linear light
 * and writes its SRGB attachment. Retain the same UNORM8 quantisation per level.
 * Level0 is borrowed, never copied or changed. No alpha/height channel is used. */
function sourceMipChain(data:Uint8Array,width:number,height:number,channels:number,srgb:boolean):SourceMipChain{
 const levels=[{data,width,height}];
 while(width>1||height>1){
  const previous=levels[levels.length-1]!,w=Math.max(1,Math.floor(width/2)),h=Math.max(1,Math.floor(height/2)),out=new Uint8Array(w*h*channels);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<channels;c++){
   // Destination pixel centres sampled through Source's linear mip sampler.
   const value=channels===4&&c===3?1:sample(previous.data,width,height,(x+.5)/w,(y+.5)/h,c,channels,srgb,false,false);
   out[(y*w+x)*channels+c]=srgb&&c<3?storeSrgb(value):Math.round(clamp(value)*255);
  }
  levels.push({data:out,width:w,height:h});width=w;height=h;
 }
 return{levels,channels,srgb,extraBytes:levels.slice(1).reduce((n,l)=>n+l.data.byteLength,0)};
}
export function preparePaintProfileMips(profile:PaintProfilePixels):PreparedPaintProfile{
 const size=Math.sqrt(profile.coverage.length);positiveInteger(size,'source texture size');
 if(profile.pigment.length!==size*size*4||profile.paper.length!==size*size*4||profile.orientation!=='upload-bottom-up')throw Error('Baked atlas: invalid mip source pixels');
 return{pigment:sourceMipChain(profile.pigment,size,size,4,true),paper:sourceMipChain(profile.paper,size,size,4,true),coverage:sourceMipChain(profile.coverage,size,size,1,false)};
}
export function atlasUvJacobian(xy:readonly number[],uv:readonly Vec2[]):AtlasUvJacobian{
 const ax=xy[2]!-xy[0]!,ay=xy[3]!-xy[1]!,bx=xy[4]!-xy[0]!,by=xy[5]!-xy[1]!,det=ax*by-ay*bx;
 if(!Number.isFinite(det)||Math.abs(det)<1e-14)return[0,0,0,0];
 const au=uv[1]![0]-uv[0]![0],av=uv[1]![1]-uv[0]![1],bu=uv[2]![0]-uv[0]![0],bv=uv[2]![1]-uv[0]![1];
 return[(au*by-bu*ay)/det,(av*by-bv*ay)/det,(bu*ax-au*bx)/det,(bv*ax-av*bx)/det];
}
/** Max column norm, not an invented LOD bias or anisotropy approximation.
 * Source uses LinearFilter / LinearMipmapLinearFilter / anisotropy1. This is
 * the atlas-pixel footprint; screen perspective can still select another LOD. */
export function sourceTextureLod(j:AtlasUvJacobian,width:number,height:number,metric:readonly[number,number,number]=[1,0,1]):number{
 const dx=Math.hypot((j[0]*metric[0]+j[1]*metric[1])*width,j[1]*metric[2]*height),dy=Math.hypot((j[2]*metric[0]+j[3]*metric[1])*width,j[3]*metric[2]*height);
 return clamp(Math.log2(Math.max(1,dx,dy)),0,Math.floor(Math.log2(Math.max(width,height))));
}
function sampleMips(chain:SourceMipChain,u:number,v:number,channel:number,lod:number,repeatU:boolean,repeatV:boolean):number{
 const level=clamp(lod,0,chain.levels.length-1),first=Math.floor(level),fraction=level-first,a=chain.levels[first]!,b=chain.levels[Math.min(first+1,chain.levels.length-1)]!;
 const p=sample(a.data,a.width,a.height,u,v,channel,chain.channels,chain.srgb,repeatU,repeatV);
 return fraction===0?p:p*(1-fraction)+sample(b.data,b.width,b.height,u,v,channel,chain.channels,chain.srgb,repeatU,repeatV)*fraction;
}
function filteredBody(profile:PreparedPaintProfile,u:number,v:number,metric:readonly[number,number,number],paperLod:number,pigmentLod:number,base:readonly[number,number,number]):[number,number,number]{
 const pu=u*metric[0]+v*metric[1],pv=v*metric[2],coverage=sampleMips(profile.coverage,u,v,0,paperLod,false,false),result=[0,0,0] as [number,number,number];
 for(let c=0;c<3;c++){const pigment=sampleMips(profile.pigment,pu,pv,c,pigmentLod,true,true),paper=sampleMips(profile.paper,u,v,c,paperLod,false,false);result[c]=sourceEotf(sourceOetf(paper)*(1-coverage)+sourceOetf(pigment)*coverage)*base[c]!;}return result;
}
export function sampleFilteredBodyLinear(profile:PreparedPaintProfile,u:number,v:number,metric:readonly[number,number,number],j:AtlasUvJacobian,base:readonly[number,number,number]=[1,1,1]):[number,number,number]{
 const size=profile.pigment.levels[0]!;return filteredBody(profile,u,v,metric,sourceTextureLod(j,size.width,size.height),sourceTextureLod(j,size.width,size.height,metric),base);
}
function smoothstep(a:number,b:number,x:number):number{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
export function sourceStrokeAlpha(u:number,v:number,edge:AtlasPaintSource['edgeAlpha'],lineOpacity:number,imperfection:number):number{
 const dry=sample(edge.data,edge.width,edge.height,u,v,1,4,false,true,false),soft=smoothstep(0,.035,v)*(1-smoothstep(.90,1,v));return lineOpacity*soft*(1-imperfection+(dry*.65+.35)*imperfection);
}
/** Deterministic pixel-centre raster, one top-left owner for shared edges.
 * Not an emulation of the screen's MSAA/per-primitive helper invocations. */
function raster(xy:readonly number[],width:number,height:number,visit:(pixel:number,w0:number,w1:number,w2:number)=>void):void{
 const x0=xy[0]!,y0=xy[1]!,x1=xy[2]!,y1=xy[3]!,x2=xy[4]!,y2=xy[5]!,cross=(ax:number,ay:number,bx:number,by:number,x:number,y:number)=>(bx-ax)*(y-ay)-(by-ay)*(x-ax),area=cross(x0,y0,x1,y1,x2,y2);
 if(!Number.isFinite(area)||Math.abs(area)<1e-14)return;const sign=area>0?1:-1,denominator=1/Math.abs(area),top=(ax:number,ay:number,bx:number,by:number)=>{const dx=(bx-ax)*sign,dy=(by-ay)*sign;return dy>0||dy===0&&dx<0;},e0top=top(x1,y1,x2,y2),e1top=top(x2,y2,x0,y0),e2top=top(x0,y0,x1,y1);
 const minX=Math.max(0,Math.ceil(Math.min(x0,x1,x2)-.5)),maxX=Math.min(width-1,Math.floor(Math.max(x0,x1,x2)-.5)),minY=Math.max(0,Math.ceil(Math.min(y0,y1,y2)-.5)),maxY=Math.min(height-1,Math.floor(Math.max(y0,y1,y2)-.5));
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const a=cross(x1,y1,x2,y2,x+.5,y+.5)*sign,b=cross(x2,y2,x0,y0,x+.5,y+.5)*sign,c=cross(x0,y0,x1,y1,x+.5,y+.5)*sign;if((a>0||a===0&&e0top)&&(b>0||b===0&&e1top)&&(c>0||c===0&&e2top))visit(y*width+x,a*denominator,b*denominator,c*denominator);}
}
function localPixels(chart:BakedChart,points:readonly Vec3[],density:number):number[]{return points.flatMap(p=>{const xy=bakedChartPixel(chart,projectBakedChart(chart,p),density);return[xy[0]-chart.rect.x,xy[1]-chart.rect.y];});}

export function bakeColourAtlasSupersampled(charts:BakedChartSet,paint:AtlasPaintSource,ink:BakedInk,options:AtlasBakeOptions={}):AtlasBakeResult{
 const started=performance.now(),width=positiveInteger(charts.atlas.width,'atlas width'),height=positiveInteger(charts.atlas.height,'atlas height'),maxAtlasBytes=positiveInteger(options.maxAtlasBytes??16*1024*1024,'atlas byte budget'),maxScratchBytes=positiveInteger(options.maxScratchBytes??32*1024*1024,'scratch budget'),atlasBytes=width*height*4;
 let maxChartPixels=0;for(const chart of charts.charts){const r=chart.rect;if(!Number.isSafeInteger(r.width)||!Number.isSafeInteger(r.height)||r.width<1||r.height<1||r.x<0||r.y<0||r.x+r.width>width||r.y+r.height>height)throw Error('Baked atlas: chart rect outside target');maxChartPixels=Math.max(maxChartPixels,r.width*r.height);}
 // Working RGB/mask:4*(12+1)N ; resolved RGB/mask/dilation queue:(12+1+4)N.
 // All four samples remain distinct through every ordered stroke/discard.
 const metadataBytes=charts.triangles.length*4+(charts.charts.length*2+1)*4+ink.triangleCount*4,rasterScratchBytes=maxChartPixels*69+metadataBytes+decodeByte.byteLength;let scratchBytes=rasterScratchBytes;
 if(!Number.isSafeInteger(atlasBytes)||atlasBytes>maxAtlasBytes||!Number.isSafeInteger(scratchBytes)||scratchBytes>maxScratchBytes)throw Error('Baked atlas: memory budget refused BEFORE allocation/profile reads');
 if(ink.disposed)throw Error('Baked atlas: disposed ink');for(const n of [...paint.brushColorLinear,paint.lineOpacity,paint.strokeImperfection])finite(n,'paint settings');if(paint.lineOpacity<0||paint.lineOpacity>1||paint.strokeImperfection<0||paint.strokeImperfection>1)throw Error('Baked atlas: paint settings outside source domain');
 const edge=paint.edgeAlpha;if(!Number.isSafeInteger(edge.width)||!Number.isSafeInteger(edge.height)||edge.width<1||edge.height<1||edge.data.length!==edge.width*edge.height*4)throw Error('Baked atlas: RGBA edge-alpha source required');
 const attr=charts.geometry.getAttribute(paint.profile.attribute),colour=charts.geometry.getAttribute('color'),position=charts.geometry.getAttribute('position');if(!attr||paint.profile.component<0||paint.profile.component>=attr.itemSize)throw Error('Baked atlas: missing body profile attribute');
 const profiles=new Map<number,PaintProfilePixels>(),triProfiles=new Uint32Array(charts.triangles.length);let borrowedViewsBytes=0;
 const get=(id:number)=>{let p=profiles.get(id);if(!p){p=paint.readProfile(id);const size=Math.sqrt(p.coverage.length);if(p.orientation!=='upload-bottom-up'||!Number.isSafeInteger(size)||size<1||p.pigment.length!==size*size*4||p.paper.length!==size*size*4)throw Error('Baked atlas: invalid borrowed P/K/M pixels');profiles.set(id,p);borrowedViewsBytes+=p.pigment.byteLength+p.paper.byteLength+p.coverage.byteLength;}return p;};
 for(const t of charts.triangles){const id=attr.getComponent(t.outputVertices[0],paint.profile.component);if(!Number.isSafeInteger(id)||id<0||id>0xffffffff||t.outputVertices.some(v=>attr.getComponent(v,paint.profile.component)!==id))throw Error('Baked atlas: nonconstant/invalid triangle profile');triProfiles[t.id]=id;get(id);}if(ink.triangleCount)get(0);
 // Deduplicate shared paper/coverage views by buffer+range, not virtual profile.
 // Preflight all extra mip allocations before creating any mip output buffer.
 const buffers=new WeakMap<object,number>(),mipPlans=new Map<string,{data:Uint8Array;size:number;channels:number;srgb:boolean}>();let bufferSerial=0,sourceMipBytes=0;
 const mipKey=(data:Uint8Array,size:number,channels:number,srgb:boolean)=>{let id=buffers.get(data.buffer);if(id===undefined){id=++bufferSerial;buffers.set(data.buffer,id);}return[id,data.byteOffset,data.byteLength,size,channels,srgb].join(':');};
 for(const p of profiles.values()){const size=Math.sqrt(p.coverage.length);for(const [data,channels,srgb]of [[p.pigment,4,true],[p.paper,4,true],[p.coverage,1,false]] as const){const key=mipKey(data,size,channels,srgb);if(!mipPlans.has(key)){mipPlans.set(key,{data,size,channels,srgb});sourceMipBytes+=mipBytes(size,size,channels);}}}
 scratchBytes+=sourceMipBytes;if(!Number.isSafeInteger(scratchBytes)||scratchBytes>maxScratchBytes)throw Error('Baked atlas: source mip memory budget refused BEFORE mip allocation');
 const mipChains=new Map<string,SourceMipChain>();for(const [key,p]of mipPlans)mipChains.set(key,sourceMipChain(p.data,p.size,p.size,p.channels,p.srgb));
 const preparedProfiles=new Map<number,PreparedPaintProfile>();for(const [id,p]of profiles){const size=Math.sqrt(p.coverage.length);preparedProfiles.set(id,{pigment:mipChains.get(mipKey(p.pigment,size,4,true))!,paper:mipChains.get(mipKey(p.paper,size,4,true))!,coverage:mipChains.get(mipKey(p.coverage,size,1,false))!});}
 const data=new Uint8Array(atlasBytes);for(let i=3;i<data.length;i+=4)data[i]=255;
 const workRgb=new Float32Array(maxChartPixels*4*3),workFilled=new Uint8Array(maxChartPixels*4),rgb=new Float32Array(maxChartPixels*3),filled=new Uint8Array(maxChartPixels),queue=new Uint32Array(maxChartPixels),offsets=new Uint32Array(charts.charts.length+1),counts=new Uint32Array(charts.charts.length),order=new Uint32Array(ink.triangleCount);
 for(let i=0;i<ink.triangleCount;i++){const id=ink.chartIds[i]!;if(id>=counts.length)throw Error('Baked atlas: ink chart missing');counts[id]++;}for(let i=0;i<counts.length;i++)offsets[i+1]=offsets[i]!+counts[i]!;counts.fill(0);for(let i=0;i<ink.triangleCount;i++){const id=ink.chartIds[i]!;order[offsets[id]!+counts[id]!]=i;counts[id]++;}
 let bodyFragments=0,inkFragments=0,resolvedBodyTexels=0,resolvedBodySamples=0,paddedPixels=0,emptyCharts=0,minSourceLod=Infinity,maxSourceLod=0;
 for(const chart of charts.charts){const r=chart.rect,count=r.width*r.height,workWidth=r.width*2,workHeight=r.height*2;if(!Number.isSafeInteger(r.width)||!Number.isSafeInteger(r.height)||r.width<1||r.height<1||r.x<0||r.y<0||r.x+r.width>width||r.y+r.height>height)throw Error('Baked atlas: chart rect outside target');workRgb.fill(0,0,count*4*3);workFilled.fill(0,0,count*4);rgb.fill(0,0,count*3);filled.fill(0,0,count);
  for(const id of chart.triangles){const t=charts.triangles[id]!,profile=triProfiles[id]!,p=preparedProfiles.get(profile)!,points=t.outputVertices.map(v=>[position.getX(v),position.getY(v),position.getZ(v)] as Vec3),xy=localPixels(chart,points,charts.atlas.texelsPerUnit).map(value=>value*2),j=atlasUvJacobian(xy,t.rawUv),size=p.pigment.levels[0]!,paperLod=sourceTextureLod(j,size.width,size.height),pigmentLod=sourceTextureLod(j,size.width,size.height,t.pigmentMetric);minSourceLod=Math.min(minSourceLod,paperLod,pigmentLod);maxSourceLod=Math.max(maxSourceLod,paperLod,pigmentLod);
   raster(xy,workWidth,workHeight,(pixel,a,b,c)=>{const u=t.rawUv[0][0]*a+t.rawUv[1][0]*b+t.rawUv[2][0]*c,v=t.rawUv[0][1]*a+t.rawUv[1][1]*b+t.rawUv[2][1]*c;let base:[number,number,number]=[1,1,1];if(profile===0&&colour)base=[0,1,2].map(k=>colour.getComponent(t.outputVertices[0],k)*a+colour.getComponent(t.outputVertices[1],k)*b+colour.getComponent(t.outputVertices[2],k)*c) as [number,number,number];const colourValue=filteredBody(p,u,v,t.pigmentMetric,paperLod,pigmentLod,base);workRgb.set(colourValue,pixel*3);workFilled[pixel]=1;bodyFragments++;});
  }
  for(let slot=offsets[chart.id]!;slot<offsets[chart.id+1]!;slot++){const i=order[slot]!,xy=Array.from(ink.pixelXY.subarray(i*6,i*6+6));for(let k=0;k<6;k+=2){xy[k]=(xy[k]!-r.x)*2;xy[k+1]=(xy[k+1]!-r.y)*2;}const uv=ink.rawUv,metric=ink.pigmentMetric,m0=metric[i*3]!,m1=metric[i*3+1]!,m2=metric[i*3+2]!,generic=preparedProfiles.get(0)!.pigment,size=generic.levels[0]!,coords=[[uv[i*6]!,uv[i*6+1]!],[uv[i*6+2]!,uv[i*6+3]!],[uv[i*6+4]!,uv[i*6+5]!]] as const,lod=sourceTextureLod(atlasUvJacobian(xy,coords),size.width,size.height,[m0,m1,m2]);minSourceLod=Math.min(minSourceLod,lod);maxSourceLod=Math.max(maxSourceLod,lod);
   raster(xy,workWidth,workHeight,(pixel,a,b,c)=>{if(!workFilled[pixel])return;const u=uv[i*6]!*a+uv[i*6+2]!*b+uv[i*6+4]!*c,v=uv[i*6+1]!*a+uv[i*6+3]!*b+uv[i*6+5]!*c,alpha=sourceStrokeAlpha(u,v,edge,paint.lineOpacity,paint.strokeImperfection);if(alpha<=.012)return;const pu=u*m0+v*m1,pv=v*m2;for(let channel=0;channel<3;channel++){const pigment=sampleMips(generic,pu,pv,channel,lod,true,true)*paint.brushColorLinear[channel]!;workRgb[pixel*3+channel]=workRgb[pixel*3+channel]!*(1-alpha)+pigment*alpha;}inkFragments++;});
  }
  // Resolve only actual body samples. Missing surface samples are NOT black
  // paint: opaque atlas color is conditional on the mesh's own coverage, which
  // the runtime rasterizer still handles. Empty texels are padded afterwards.
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
   const first=(y*2)*workWidth+x*2,target=y*r.width+x;let samples=0;
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const id=first+dy*workWidth+dx;if(workFilled[id]){samples++;for(let c=0;c<3;c++)rgb[target*3+c]+=workRgb[id*3+c]!;}}
   if(samples){for(let c=0;c<3;c++)rgb[target*3+c]/=samples;filled[target]=1;resolvedBodyTexels++;resolvedBodySamples+=samples;}
  }
  // Multi-source nearest-neighbour dilation INSIDE this chart's own padded
  // rectangle only. Never mix adjacent islands; runtime alpha remains opaque.
  let read=0,write=0;for(let i=0;i<count;i++)if(filled[i])queue[write++]=i;if(!write){emptyCharts++;throw Error('Baked atlas: chart has no pixel centre; increase admitted density');}
  while(read<write){const p=queue[read++]!,x=p%r.width,y=Math.floor(p/r.width);const add=(q:number)=>{if(filled[q])return;filled[q]=1;rgb[q*3]=rgb[p*3]!;rgb[q*3+1]=rgb[p*3+1]!;rgb[q*3+2]=rgb[p*3+2]!;queue[write++]=q;paddedPixels++;};if(x)add(p-1);if(x+1<r.width)add(p+1);if(y)add(p-r.width);if(y+1<r.height)add(p+r.width);}
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const s=(y*r.width+x)*3,d=((r.y+y)*width+r.x+x)*4;data[d]=storeSrgb(rgb[s]!);data[d+1]=storeSrgb(rgb[s+1]!);data[d+2]=storeSrgb(rgb[s+2]!);}
 }
 return{data,width,height,stats:{scope:'CPU2x2 true working samples. Source LOD uses twice the target chart density; each ordered ribbon alpha/.012 discard is composed per working sample, then linear color resolves before dilation. Ink alpha remains level0/analytic. No lights baked; runtime PBR once. Not screen-perspective/MSAA/double-PBR/animated-wind pixel identity.',preparationMs:performance.now()-started,atlasBytes,scratchBytes,rasterScratchBytes,sourceMipBytes,sourceMipChains:mipChains.size,metadataBytes,profileMetadataBytes:triProfiles.byteLength,borrowedProfileByteViewsTotal:borrowedViewsBytes,profiles:[...profiles.keys()],charts:charts.charts.length,bodyTriangles:charts.triangles.length,bodyFragments,resolvedBodyTexels,resolvedBodySamples,inkTriangles:ink.triangleCount,inkFragments,paddedPixels,emptyCharts,opaque:true,orientation:'upload-bottom-up',workingScale:2,samplesPerTexel:4,targetTexelsPerUnit:charts.atlas.texelsPerUnit,workingTexelsPerUnit:charts.atlas.texelsPerUnit*2,resolve:'linear mean of covered body samples before padding',sourceSamplerLod:'trilinear-max-column-norm-working-grid',minSourceLod:Number.isFinite(minSourceLod)?minSourceLod:0,maxSourceLod,sourceMagFilter:'linear',sourceMinFilter:'linear-mipmap-linear',sourceAnisotropy:1,colourSpace:'sRGB storage / linear composition',ink:ink.stats}};
}
