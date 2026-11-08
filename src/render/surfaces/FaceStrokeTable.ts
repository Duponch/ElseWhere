/** Opaque face strokes from the complete original brush producer. Model data,
 * never a texture-style identity. Coplanar UV-continuous triangles share one
 * face and keep indexed corners; no blanket triangle expansion at draw time. */
import * as THREE from 'three/webgpu';
import {Fn,If,Loop,float,int,uint,mix,positionView,varying,vec2,vec3,vec4,storage} from 'three/tsl';
import {createOrigamiBrushGeometry} from '../origami/brush-geometry';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const instanced=(a:Attribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
const TAG='uvStrokeSourceFace',HEADER_ROWS=2,EDGE_ROWS=9,EDGE_FLOATS=36;
/** ABI for bounded mutable producers (mined rocks). Headers contain
 * [edgeStartRow,edgeCount,minU,minV,maxU,maxV,maxInset,boundaryGate].
 * Gate0 bypasses;1 axes only;2 adds the rising diagonal;3 the falling
 * diagonal;4 both. These are rejection bounds, never drawn geometry. */
export const FACE_STROKE_HEADER_ROWS=HEADER_ROWS,FACE_STROKE_EDGE_ROWS=EDGE_ROWS,FACE_STROKE_EDGE_FLOATS=EDGE_FLOATS;
export type FaceStrokeGateKind=0|1|2|3|4;
export type FaceStrokeBounds=readonly[minU:number,minV:number,maxU:number,maxV:number];
const GATE_BASE_TOLERANCE=1e-5;

/** Classify only the six ACTUAL Source base points of every strip. Any
 * unsupported edge disables the gate for the complete face. The measured
 * deviation is added to its existing maximum-width/roughness inset, so
 * classification tolerance can never shrink the admitted painted region. */
export function classifyFaceStrokeGate(records:Float32Array,bounds:FaceStrokeBounds):{kind:FaceStrokeGateKind;deviation:number}{
 const[loU,loV,hiU,hiV]=bounds,du=hiU-loU,dv=hiV-loV,scale=du+dv;
 if(records.length%EDGE_FLOATS||!bounds.every(Number.isFinite)||du<=0||dv<=0||records.some(value=>!Number.isFinite(value)))return{kind:0,deviation:0};
 let main=false,anti=false,deviation=0;
 for(let edge=0;edge<records.length;edge+=EDGE_FLOATS){
  const errors=[0,0,0,0,0,0];
  for(let vertex=0;vertex<6;vertex++){
   const at=edge+vertex*6,u=records[at]!,v=records[at+1]!,distances=[Math.abs(u-loU),Math.abs(v-loV),Math.abs(u-hiU),Math.abs(v-hiV),Math.abs((u-loU)*dv-(v-loV)*du)/scale,Math.abs((u-loU)*dv+(v-loV)*du-du*dv)/scale];
   for(let line=0;line<errors.length;line++)errors[line]=Math.max(errors[line]!,distances[line]!);
  }
  const closest=Math.min(...errors),line=errors.indexOf(closest);
  if(closest>GATE_BASE_TOLERANCE)return{kind:0,deviation:0};
  deviation=Math.max(deviation,closest);if(line===4)main=true;else if(line===5)anti=true;
 }
 return{kind:main?anti?4:2:anti?3:1,deviation};
}

/** CPU counterpart of the shader's conservative broad phase. Negative
 * infinity means UNKNOWN/bypass, not an empty face. */
export function faceStrokeGateDistance(point:readonly[number,number],bounds:FaceStrokeBounds,kind:FaceStrokeGateKind):number{
 if(kind===0)return-Infinity;
 const[u,v]=point,[loU,loV,hiU,hiV]=bounds,du=hiU-loU,dv=hiV-loV,scale=du+dv;
 let distance=Math.min(u-loU,v-loV,hiU-u,hiV-v);
 if(kind===2||kind===4)distance=Math.min(distance,Math.abs((u-loU)*dv-(v-loV)*du)/scale);
 if(kind===3||kind===4)distance=Math.min(distance,Math.abs((u-loU)*dv+(v-loV)*du-du*dv)/scale);
 return distance;
}

/** Encode one actual Source strip into a caller-owned sparse table. The
 * producer owns its global triangle seed and real-neighbor eligibility; this
 * helper never rediscovers edges or replaces that topology with cell bounds. */
export function writeFaceStrokeEdgeRecord(target:Float32Array,offset:number,stock:THREE.BufferGeometry,firstVertex:number,project:(point:THREE.Vector3,vector:boolean)=>readonly[number,number]):void{
 const base=stock.userData.referenceBrushBasePositions as Float32Array|undefined,width=stock.userData.referenceBrushWidthOffsets as Float32Array|undefined,rough=stock.userData.referenceBrushRoughOffsets as Float32Array|undefined;
 if(!base||!width||!rough||!Number.isSafeInteger(offset)||offset<0||offset+EDGE_FLOATS>target.length||!Number.isSafeInteger(firstVertex)||firstVertex<0||(firstVertex+6)*3>base.length||width.length!==base.length||rough.length!==base.length)throw Error('Actual complete Source strip and admitted target range required');
 const point=new THREE.Vector3();for(let vertex=0;vertex<6;vertex++){const first=(firstVertex+vertex)*3;let component=0;for(const[values,vector]of [[base,false],[width,true],[rough,true]] as const){const uv=project(point.set(values[first]!,values[first+1]!,values[first+2]!),vector);if(!uv.every(Number.isFinite))throw Error('Finite physical Source strip projection required');target[offset+vertex*6+component]=uv[0];target[offset+vertex*6+component+1]=uv[1];component+=2;}}
}
const stripTriangles=Object.freeze([[0,2,3],[0,3,1],[2,4,5],[2,5,3]] as const);
const key=(p:THREE.Vector3)=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)},${Math.round(p.z*1e6)}`;
export interface FaceStrokeTableOptions {readonly uvAttribute?:string;readonly maxCpuBytes:number;readonly maxTriangles:number;readonly maxEdgesPerFace?:number;readonly thresholdAngle?:number;readonly baseWidth?:number;readonly mergeCoplanar?:boolean}
export interface FaceStrokeData {
 readonly faceCount:number;readonly edgeCount:number;readonly maxEdgesPerFace:number;
 readonly values:Float32Array;readonly buffer:THREE.StorageBufferAttribute;readonly node:THREE.StorageBufferNode<'vec4'>;readonly cpuBytes:number;
 assertCurrent():void;
 /** Invalidates the owner and dispatches the TSL node's dispose event. Three
  * r186 does NOT retire an element-only storage GPU buffer from that event;
  * attachFaceStrokeGpuRetirement must precede final real-geometry disposal,
  * or the documented owner must retain it until renderer/device teardown. */
 dispose():void;
}

/** Terminal ownership only: attach a storage buffer to the real geometry
 * candidates immediately BEFORE their FINAL disposal. At least one candidate
 * must have been initialized by the renderer if this buffer reached the GPU.
 * r186 Geometries.onDispose visits every geometry attribute; the first live
 * listener deletes the shared buffer, subsequent deletes are harmless.
 *
 * Nothing is attached during drawing, cloning, growth, 435 reconciliation or
 * shader generation. Thus this creates no vertex slot, incompatible layout,
 * per-frame work or premature retirement while another surface borrows it.
 * A never-rendered synthetic geometry cannot stand in for a real owner. */
export function attachFaceStrokeGpuRetirement(table:FaceStrokeData,geometries:Iterable<THREE.BufferGeometry>):void{
 table.assertCurrent();const key=`uvFaceStrokeGpuRetirement${table.buffer.id}`;
 for(const geometry of new Set(geometries)){const previous=geometry.getAttribute(key);if(previous&&previous!==table.buffer)throw Error('Face stroke terminal GPU ownership collision');geometry.setAttribute(key,table.buffer);}
}
export interface FaceStrokeTable extends FaceStrokeData {
 readonly triangleCount:number;
 /** NEW indexed vertex -> original vertex; original triangle-corner order ->
  * NEW indexed vertex. Only genuine face/UV seams duplicate vertices. */
 readonly sourceVertex:Uint32Array;readonly sourceIndex:Uint32Array;readonly faceIds:Float32Array;readonly sourceTriangleFaceIds:Uint32Array;
 readonly sourceUvAttribute:string;
}
interface Triangle {vertices:readonly[number,number,number];points:readonly[THREE.Vector3,THREE.Vector3,THREE.Vector3];normal:THREE.Vector3;plane:number;partition:string}

/** Dynamic continuous roofs already own independent triangle corners. Keep
 * this exact domain instead of building coplanar-component maps or expanding
 * a second body. Source still discovers real edges on the COMPLETE surface. */
function compileUnmergedTriangleTable(source:THREE.BufferGeometry,options:FaceStrokeTableOptions,uvName:string):FaceStrokeTable{
 const p=source.getAttribute('position'),uv=source.getAttribute(uvName),triangles=p.count/3,minimum=triangles*(8+3+3+3+1)*4;
 if(minimum>options.maxCpuBytes)throw Error('Face stroke triangle preparation refused BEFORE allocation');
 const tagged=new THREE.BufferGeometry();for(const[name,a]of Object.entries(source.attributes))if(!instanced(a))tagged.setAttribute(name,a);tagged.setAttribute(TAG,new THREE.Float32BufferAttribute(Float32Array.from({length:p.count},(_,i)=>Math.floor(i/3)),1));for(const g of source.groups)tagged.addGroup(g.start,g.count,g.materialIndex);tagged.setDrawRange(source.drawRange.start,source.drawRange.count);let stock:THREE.BufferGeometry|undefined;
 try{
  stock=createOrigamiBrushGeometry(tagged,options.thresholdAngle??22,options.baseWidth??.008);const tags=stock.getAttribute(TAG),counts=new Uint8Array(triangles);if(tags.count%6)throw Error('Actual unmerged Source brush provenance missing');
  for(let first=0;first<tags.count;first+=6){const triangle=tags.getX(first);if(!Number.isSafeInteger(triangle)||triangle<0||triangle>=triangles)throw Error('Unmerged Source triangle tag outside domain');for(let v=1;v<6;v++)if(tags.getX(first+v)!==triangle)throw Error('Source brush crossed a real triangle');counts[triangle]=counts[triangle]!+1;if(counts[triangle]!>Math.min(3,options.maxEdgesPerFace??32))throw Error('Unmerged Source triangle edge-count admission refused');}
  const edgeCount=tags.count/6,bytes=minimum+edgeCount*EDGE_FLOATS*4;if(bytes>options.maxCpuBytes)throw Error('Face stroke triangle retention refused BEFORE allocation');
  const values=new Float32Array(triangles*8+edgeCount*EDGE_FLOATS),next=new Uint32Array(triangles);let row=triangles*HEADER_ROWS,maxEdges=0;
  for(let triangle=0;triangle<triangles;triangle++){const first=triangle*3,us=[uv.getX(first),uv.getX(first+1),uv.getX(first+2)],vs=[uv.getY(first),uv.getY(first+1),uv.getY(first+2)],count=counts[triangle]!;values.set([row,count,Math.min(...us),Math.min(...vs),Math.max(...us),Math.max(...vs),0,0],triangle*8);next[triangle]=row*4;row+=count*EDGE_ROWS;maxEdges=Math.max(maxEdges,count);}
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let first=0;first<tags.count;first+=6){const triangle=tags.getX(first),v=triangle*3;a.fromBufferAttribute(p,v);b.fromBufferAttribute(p,v+1).sub(a);c.fromBufferAttribute(p,v+2).sub(a);const bb=b.dot(b),bc=b.dot(c),cc=c.dot(c),det=bb*cc-bc*bc,ux=uv.getX(v+1)-uv.getX(v),uy=uv.getX(v+2)-uv.getX(v),vx=uv.getY(v+1)-uv.getY(v),vy=uv.getY(v+2)-uv.getY(v),ox=uv.getX(v),oy=uv.getY(v);if(Math.abs(det)<1e-24)throw Error('Actual unmerged brush triangle degenerate');
   writeFaceStrokeEdgeRecord(values,next[triangle]!,stock,first,(point,vector)=>{if(!vector)point.sub(a);const pb=point.dot(b),pc=point.dot(c),u=(pb*cc-pc*bc)/det,w=(pc*bb-pb*bc)/det;return[(vector?0:ox)+u*ux+w*uy,(vector?0:oy)+u*vx+w*vy];});next[triangle]=next[triangle]!+EDGE_FLOATS;
  }
  const sourceVertex=Uint32Array.from({length:p.count},(_,i)=>i),sourceIndex=sourceVertex.slice(),faceIds=Float32Array.from({length:p.count},(_,i)=>Math.floor(i/3)),sourceTriangleFaceIds=Uint32Array.from({length:triangles},(_,i)=>i),buffer=new THREE.StorageBufferAttribute(values,4),node=storage(buffer,'vec4',values.length/4).toReadOnly(),cpuBytes=values.byteLength+sourceVertex.byteLength+sourceIndex.byteLength+faceIds.byteLength+sourceTriangleFaceIds.byteLength;let closed=false;
  return{faceCount:triangles,triangleCount:triangles,edgeCount,maxEdgesPerFace:maxEdges,sourceVertex,sourceIndex,faceIds,sourceTriangleFaceIds,sourceUvAttribute:uvName,values,buffer,node,cpuBytes,assertCurrent(){if(closed)throw Error('Face stroke table retired');},dispose(){if(closed)return;closed=true;node.dispose();}};
 }finally{stock?.dispose();tagged.dispose();}
}
/** Compile once from the COMPLETE immutable index, before an active-part union
 * compacts it. Source stock is temporary; GPU retention is a small scalar table.
 * Original edge order/seed and all six base/width/rough vertices survive. */
export function compileFaceStrokeTable(source:THREE.BufferGeometry,options:FaceStrokeTableOptions):FaceStrokeTable {
 const p=source.getAttribute('position'),uvName=options.uvAttribute??'uv',uv=source.getAttribute(uvName),index=source.index,total=index?.count??p?.count??0,count=total/3,maxEdges=options.maxEdgesPerFace??32;
 if(!p||!uv||uv.itemSize<2||!Number.isSafeInteger(count)||count<1||count>options.maxTriangles||!Number.isSafeInteger(options.maxCpuBytes)||options.maxCpuBytes<1||!Number.isSafeInteger(options.maxTriangles)||options.maxTriangles<1||!Number.isSafeInteger(maxEdges)||maxEdges<1||maxEdges>64||source.userData.origamiBrushPrebuilt)throw Error(`Face strokes require a complete finite body with original UVs and explicit budgets (triangles ${count}/${options.maxTriangles}, UV ${uvName}:${uv?.itemSize??'missing'}, vertices ${p?.count??'missing'})`);
 if(options.mergeCoplanar===false&&!index)return compileUnmergedTriangleTable(source,options,uvName);
 const fields=Object.entries(source.attributes).filter(([,a])=>!instanced(a)),stride=fields.reduce((n,[,a])=>n+a.itemSize,0),estimate=count*(116*4+3*(stride+1)*4+18*(stride*4+36)+36*4+768);
 if(!Number.isSafeInteger(estimate)||estimate>options.maxCpuBytes)throw Error('Face stroke preparation refused BEFORE allocation');
 const corners=Uint32Array.from({length:total},(_,i)=>index?.getX(i)??i),triangles:Triangle[]=[],parents=Int32Array.from({length:count},(_,i)=>i),buckets=new Map<string,{triangle:number;a:number;b:number}[]>();
 const root=(n:number):number=>{let r=n;while(parents[r]!==r)r=parents[r]!;while(parents[n]!==n){const next=parents[n]!;parents[n]=r;n=next;}return r;};
 const semantic=fields.filter(([name])=>name!=='position'&&!/normal|tangent|uv/i.test(name)),paintUvs=fields.filter(([name,a])=>/uv/i.test(name)&&a.itemSize>=2);
 // A vertex's rounded position key, computed once per vertex (its point is
 // read from the same position attribute every time).
 const vertexKeys:(string|undefined)[]=[],pointKey=(vertex:number,point:THREE.Vector3)=>vertexKeys[vertex]??=key(point);
 for(let triangle=0;triangle<count;triangle++){
  const vertices=[corners[triangle*3]!,corners[triangle*3+1]!,corners[triangle*3+2]!] as const;if(vertices.some(v=>v>=p.count))throw Error('Face stroke index outside original vertex domain');
  const points=vertices.map(v=>new THREE.Vector3().fromBufferAttribute(p,v)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3],normal=new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0]));normal.normalize();
  const partition=semantic.map(([name,a])=>`${name}:${Array.from({length:a.itemSize},(_,c)=>a.getComponent(vertices[0],c)).join(',')}`).join('|'),t:Triangle={vertices,points,normal,plane:normal.dot(points[0]),partition};triangles.push(t);
  for(let e=0;e<3;e++){const a=vertices[e]!,b=vertices[(e+1)%3]!,ka=pointKey(vertices[e]!,points[e]!),kb=pointKey(vertices[(e+1)%3]!,points[(e+1)%3]!),edgeKey=partition+'/'+(ka<kb?ka+'/'+kb:kb+'/'+ka);const bucket=buckets.get(edgeKey)??[];bucket.push({triangle,a,b});buckets.set(edgeKey,bucket);}
 }
 const sameUv=(a:number,b:number)=>paintUvs.every(([,uv])=>Array.from({length:uv.itemSize},(_,c)=>Math.abs(uv.getComponent(a,c)-uv.getComponent(b,c))).every(d=>d<1e-7));
 if(options.mergeCoplanar!==false)for(const bucket of buckets.values())for(let i=0;i<bucket.length;i++)for(let j=i+1;j<bucket.length;j++){const x=bucket[i]!,y=bucket[j]!,a=triangles[x.triangle]!,b=triangles[y.triangle]!;if(a.normal.lengthSq()<.5||a.normal.dot(b.normal)<1-1e-7||Math.abs(a.plane-b.plane)>1e-6)continue;const same=key(new THREE.Vector3().fromBufferAttribute(p,x.a))===key(new THREE.Vector3().fromBufferAttribute(p,y.a));if(!sameUv(x.a,same?y.a:y.b)||!sameUv(x.b,same?y.b:y.a))continue;const ra=root(x.triangle),rb=root(y.triangle);if(ra!==rb)parents[Math.max(ra,rb)]=Math.min(ra,rb);}
 const groups=new Map<number,number>(),sourceTriangleFaceIds=new Uint32Array(count);for(let t=0;t<count;t++){const r=root(t);if(!groups.has(r))groups.set(r,groups.size);sourceTriangleFaceIds[t]=groups.get(r)!;}
 const vertexMap=new Map<string,number>(),sourceVertices:number[]=[],ids:number[]=[],sourceIndex=new Uint32Array(total);for(let corner=0;corner<total;corner++){const original=corners[corner]!,face=sourceTriangleFaceIds[Math.floor(corner/3)]!,id=original+':'+face;let mapped=vertexMap.get(id);if(mapped===undefined){mapped=sourceVertices.length;vertexMap.set(id,mapped);sourceVertices.push(original);ids.push(face);}sourceIndex[corner]=mapped;}
 const expanded=new THREE.BufferGeometry();let stock:THREE.BufferGeometry|undefined;
 try{
  for(const[name,a]of fields){if(a.count!==p.count)throw Error('Face stroke static field domain differs: '+name);const data=new Float32Array(total*a.itemSize);for(let v=0;v<total;v++)for(let c=0;c<a.itemSize;c++)data[v*a.itemSize+c]=a.getComponent(corners[v]!,c);expanded.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));}
  // A UV-named field is excluded from Source semantic partitions. Expansion
  // changes neither the original triangle order nor Source's at*3+edge seeds.
  expanded.setAttribute(TAG,new THREE.Float32BufferAttribute(Float32Array.from({length:total},(_,i)=>Math.floor(i/3)),1));for(const group of source.groups)expanded.addGroup(group.start,group.count,group.materialIndex);
  stock=createOrigamiBrushGeometry(expanded,options.thresholdAngle??22,options.baseWidth??.008);
  const base=stock.userData.referenceBrushBasePositions as Float32Array,width=stock.userData.referenceBrushWidthOffsets as Float32Array,rough=stock.userData.referenceBrushRoughOffsets as Float32Array,tag=stock.getAttribute(TAG);
  if(!base||!width||!rough||!tag||tag.count%6)throw Error('Actual Source brush provenance missing');
  const faceEdges=Array.from({length:groups.size},()=>[] as number[][]),point=new THREE.Vector3();
  const project=(triangle:number,x:number,y:number,z:number,vector=false):[number,number]=>{const t=triangles[triangle]!,a=t.points[0],b=t.points[1].clone().sub(a),c=t.points[2].clone().sub(a);point.set(x,y,z);if(!vector)point.sub(a);const bb=b.dot(b),bc=b.dot(c),cc=c.dot(c),pb=point.dot(b),pc=point.dot(c),det=bb*cc-bc*bc;if(Math.abs(det)<1e-24)throw Error('Face stroke body triangle is degenerate');const u=(pb*cc-pc*bc)/det,v=(pc*bb-pb*bc)/det,[i,j,k]=t.vertices,ox=uv.getX(i),oy=uv.getY(i);return[(vector?0:ox)+u*(uv.getX(j)-ox)+v*(uv.getX(k)-ox),(vector?0:oy)+u*(uv.getY(j)-oy)+v*(uv.getY(k)-oy)];};
  for(let start=0;start<tag.count;start+=6){const triangle=tag.getX(start);if(!Number.isSafeInteger(triangle)||triangle<0||triangle>=count||Array.from({length:6},(_,i)=>tag.getX(start+i)).some(id=>id!==triangle))throw Error('Source brush crossed a real triangle');const face=sourceTriangleFaceIds[triangle]!,edges=faceEdges[face]!;if(edges.length>=maxEdges)throw Error('Face stroke edge-count admission refused');const data:number[]=[];for(let v=0;v<6;v++){const i=(start+v)*3;data.push(...project(triangle,base[i]!,base[i+1]!,base[i+2]!),...project(triangle,width[i]!,width[i+1]!,width[i+2]!,true),...project(triangle,rough[i]!,rough[i+1]!,rough[i+2]!,true));}edges.push(data);}
  const edgeCount=faceEdges.reduce((n,e)=>n+e.length,0),values=new Float32Array(groups.size*HEADER_ROWS*4+edgeCount*EDGE_FLOATS),bounds=Array.from({length:groups.size},()=>[Infinity,Infinity,-Infinity,-Infinity]);let row=groups.size*HEADER_ROWS;
  for(let triangle=0;triangle<count;triangle++){const b=bounds[sourceTriangleFaceIds[triangle]!]!;for(const vertex of triangles[triangle]!.vertices){const u=uv.getX(vertex),v=uv.getY(vertex);b[0]=Math.min(b[0]!,u);b[1]=Math.min(b[1]!,v);b[2]=Math.max(b[2]!,u);b[3]=Math.max(b[3]!,v);}}
  for(let face=0;face<groups.size;face++){
   const edges=faceEdges[face]!,[minU,minV,maxU,maxV]=bounds[face]!;let rectangular=true,inset=0;
   for(const edge of edges){const a=edge.slice(0,2),b=edge.slice(24,26),axis=(Math.abs(a[0]!-b[0]!)<1e-5&&(Math.abs(a[0]!-minU)<1e-5||Math.abs(a[0]!-maxU)<1e-5))||(Math.abs(a[1]!-b[1]!)<1e-5&&(Math.abs(a[1]!-minV)<1e-5||Math.abs(a[1]!-maxV)<1e-5));rectangular&&=axis;for(let v=0;v<6;v++){const i=v*6;inset=Math.max(inset,5*(Math.abs(edge[i+2]!)+Math.abs(edge[i+4]!)),5*(Math.abs(edge[i+3]!)+Math.abs(edge[i+5]!)));}}
   values.set([row,edges.length,minU,minV,maxU,maxV,inset+2e-5,rectangular?1:0],face*8);for(const edge of edges){values.set(edge,row*4);row+=EDGE_ROWS;}
  }
  const sourceVertex=new Uint32Array(sourceVertices),faceIds=new Float32Array(ids),cpuBytes=values.byteLength+sourceVertex.byteLength+sourceIndex.byteLength+faceIds.byteLength+sourceTriangleFaceIds.byteLength;if(cpuBytes>options.maxCpuBytes)throw Error('Face stroke retained budget exceeded');const buffer=new THREE.StorageBufferAttribute(values,4),node=storage(buffer,'vec4',values.length/4).toReadOnly();let closed=false;
  return{triangleCount:count,faceCount:groups.size,edgeCount,maxEdgesPerFace:Math.max(...faceEdges.map(e=>e.length)),sourceVertex,sourceIndex,faceIds,sourceTriangleFaceIds,values,buffer,node,cpuBytes,sourceUvAttribute:uvName,assertCurrent(){if(closed)throw Error('Face stroke table retired');},dispose(){if(closed)return;closed=true;node.dispose();}};
 }finally{stock?.dispose();expanded.dispose();}
}

/** Compile each original model separately first: joining source triangles would
 * change Source's global at*3+edge seeds. Only scalar tables are combined here.
 * The individual vertex/index maps remain valid, offset their face IDs by the
 * corresponding faceOffsets entry. This bank uses one read-only GPU binding. */
export function combineFaceStrokeTables(tables:readonly FaceStrokeData[],options:{readonly maxCpuBytes:number}){
 if(!tables.length||!Number.isSafeInteger(options.maxCpuBytes)||options.maxCpuBytes<1)throw Error('Explicit nonempty face stroke bank and budget required');
 let faceCount=0,edgeCount=0,maxEdgesPerFace=0;const faceOffsets:number[]=[];
 for(const table of tables){table.assertCurrent();faceOffsets.push(faceCount);faceCount+=table.faceCount;edgeCount+=table.edgeCount;maxEdgesPerFace=Math.max(maxEdgesPerFace,table.maxEdgesPerFace);}
 const bytes=faceCount*HEADER_ROWS*16+edgeCount*EDGE_FLOATS*4;if(!Number.isSafeInteger(bytes)||bytes>options.maxCpuBytes)throw Error('Face stroke bank refused BEFORE allocation');
 const values=new Float32Array(bytes/4);let edgeRow=faceCount*HEADER_ROWS,faceOffset=0;
 for(const table of tables){for(let face=0;face<table.faceCount;face++){const source=face*8,start=table.values[source]!,count=table.values[source+1]!;values.set(table.values.subarray(source,source+8),(faceOffset+face)*8);values[(faceOffset+face)*8]=edgeRow;const floats=count*EDGE_FLOATS;values.set(table.values.subarray(start*4,start*4+floats),edgeRow*4);edgeRow+=count*EDGE_ROWS;}faceOffset+=table.faceCount;}
 const buffer=new THREE.StorageBufferAttribute(values,4),node=storage(buffer,'vec4',values.length/4).toReadOnly();let closed=false;
 const table:FaceStrokeData={faceCount,edgeCount,maxEdgesPerFace,values,buffer,node,cpuBytes:bytes,assertCurrent(){if(closed)throw Error('Face stroke bank retired');},dispose(){if(closed)return;closed=true;node.dispose();}};
 return{table,faceOffsets:Object.freeze(faceOffsets),dispose:()=>table.dispose()};
}

export interface FaceStrokeHit {readonly edge:number;readonly triangle:number;readonly uv:readonly[number,number];readonly jacobian:readonly[number,number,number,number]}
function inverseTriangle(a:readonly number[],b:readonly number[],c:readonly number[],q:readonly number[]){const x=b[0]!-a[0]!,y=b[1]!-a[1]!,z=c[0]!-a[0]!,w=c[1]!-a[1]!,det=x*w-z*y;if(Math.abs(det)<1e-20)return undefined;const px=q[0]!-a[0]!,py=q[1]!-a[1]!,u=(px*w-py*z)/det,v=(py*x-px*y)/det;return{u,v,inverse:[w/det,-z/det,-y/det,x/det] as const};}
/** Inspection seam, not a frame operation. Original edge order and corner
 * overdraw remain visible; each edge contributes at most one strip triangle. */
export function queryFaceStrokeTable(table:FaceStrokeData,face:number,faceUv:readonly[number,number],width:number,irregularity:number):readonly FaceStrokeHit[]{
 table.assertCurrent();if(!Number.isSafeInteger(face)||face<0||face>=table.faceCount||!faceUv.every(Number.isFinite)||!Number.isFinite(width)||!Number.isFinite(irregularity))throw Error('Finite actual face stroke query required');const d=table.values,first=d[face*8]!*4,count=d[face*8+1]!,w=Math.max(.5,Math.min(5,width)),r=Math.max(0,Math.min(1,irregularity)),out:FaceStrokeHit[]=[];
 for(let edge=0;edge<count;edge++){const offset=first+edge*EDGE_FLOATS,points=Array.from({length:6},(_,i)=>{const o=offset+i*6;return[d[o]!+w*(d[o+2]!+r*d[o+4]!),d[o+1]!+w*(d[o+3]!+r*d[o+5]!)] as const;});for(let t=0;t<stripTriangles.length;t++){const ids=stripTriangles[t]!,hit=inverseTriangle(points[ids[0]]!,points[ids[1]]!,points[ids[2]]!,faceUv);if(!hit||hit.u< -1e-6||hit.v< -1e-6||hit.u+hit.v>1+1e-6)continue;const bu=(i:number)=>[Math.floor(i/2)*.5,i%2] as const,a=bu(ids[0]),b=bu(ids[1]),c=bu(ids[2]),j=hit.inverse,ux=b[0]-a[0],uy=c[0]-a[0],vx=b[1]-a[1],vy=c[1]-a[1];out.push({edge,triangle:t,uv:[a[0]+ux*hit.u+uy*hit.v,a[1]+vx*hit.u+vy*hit.v],jacobian:[ux*j[0]+uy*j[2],ux*j[1]+uy*j[3],vx*j[0]+vy*j[2],vx*j[1]+vy*j[3]]});break;}}
 return out;
}

export interface FaceStrokeNodeOptions {
 readonly table:FaceStrokeData;readonly faceId:THREE.Node<'float'>;readonly faceUv:THREE.Node<'vec2'>;
 /** Optional bounded storage pagination. The logical ROW addresses, Source
  * records and all shader arithmetic are unchanged; no per-frame CPU lookup. */
 readonly readRow?:(row:THREE.Node<'int'>)=>THREE.Node<'vec4'>;
 /** Actual per-face headers may be loaded at the vertex stage.
  * Flat interpolation retains their exact Float32 values; dynamic paged
  * producers leave this absent and keep their current fragment ABI. */
 readonly headers?:readonly[THREE.Node<'vec4'>,THREE.Node<'vec4'>];
 readonly enabled:THREE.Node<'float'>;readonly width:THREE.Node<'float'>;readonly irregularity:THREE.Node<'float'>;readonly opacity:THREE.Node<'float'>;readonly brushColor:THREE.Node<'vec3'>;
 readonly samplePigment:(coordinates:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>)=>THREE.Node<'vec3'>;
 readonly sampleDry:(coordinates:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>)=>THREE.Node<'float'>;
 readonly surfacePosition?:THREE.Node<'vec3'>;
}
/** The caller must prove its actual faceId is constant on each triangle and
 * headers are constant over that triangle for one submitted draw. Actor
 * models are immutable; a paged dynamic owner may upload before submission.
 * No attribute, model, pose, table row or ownership changes.
 * Uniform OFF paths read no storage; only header work changes shader stage. */
export function faceStrokeVertexHeaders(options:Pick<FaceStrokeNodeOptions,'table'|'faceId'|'enabled'|'opacity'|'readRow'>,label:string):readonly[THREE.Node<'vec4'>,THREE.Node<'vec4'>]{
 options.table.assertCurrent();
 if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(label))throw Error('Stable vertex-header varying label required');
 const read=options.readRow??((row:THREE.Node<'int'>)=>options.table.node.element(row));
 const load=(offset:number)=>varying(Fn(()=>{const result=vec4(0).toVar();If(options.enabled.greaterThan(0).and(options.opacity.greaterThan(0)),()=>{result.assign(read(int(options.faceId).mul(HEADER_ROWS).add(offset)));});return result;})(),label+offset).setInterpolation('flat','first');
 return[load(0),load(1)];
}
/** The authored human halves use V0/.5/1, including their real half-face
 * bounds. Pack four ternary bounds and the gate into an exact integer, never
 * quantize arbitrary UVs or assume that every face is the whole unit square. */
export function assertHalfUvFaceStrokeHeaders(table:FaceStrokeData):{faces:number;halfFaces:number;maxCode:number}{
 table.assertCurrent();const a=table.values;let halfFaces=0,maxCode=0;
 for(let face=0;face<table.faceCount;face++){const at=face*8,values=[a[at+2]!,a[at+3]!,a[at+4]!,a[at+5]!],gate=a[at+7]!;
  if(values.some(v=>Object.is(v,-0)||v!==0&&v!==.5&&v!==1)||!Number.isInteger(gate)||gate<0||gate>4||!Number.isSafeInteger(a[at])||!Number.isSafeInteger(a[at+1])||!Number.isFinite(a[at+6]))throw Error('Actual human face header exceeds exact half-UV packing domain');
  if(values.some(v=>v===.5))halfFaces++;const code=gate+8*(values[0]!*2+values[1]!*8+values[2]!*32+values[3]!*128);if(!Number.isSafeInteger(code)||code<0||code>=2048)throw Error('Human face header code exceeds exact integer packing');maxCode=Math.max(maxCode,code);
 }return{faces:table.faceCount,halfFaces,maxCode};
}
/** Pure counterpart for representation contracts over the ACTUAL CPU table.
 * The constructor guard above proves the complete table before shader use. */
export function packHalfUvFaceStrokeHeader(values:ArrayLike<number>,at:number):Float32Array{
 return new Float32Array([values[at]!,values[at+1]!,values[at+6]!,values[at+7]!+8*(values[at+2]!*2+values[at+3]!*8+values[at+4]!*32+values[at+5]!*128)]);
}
export function unpackHalfUvFaceStrokeHeader(packed:ArrayLike<number>):Float32Array{
 const word=packed[3]!>>>0,code=word>>>3,digit=(shift:number)=>(code>>>shift&3)*.5;
 return new Float32Array([packed[0]!,packed[1]!,digit(0),digit(2),digit(4),digit(6),packed[2]!,word&7]);
}
/** ONE flat vec4 for the proven authored human domain. No model, attribute,
 * palette, table or UV changes. Integer arithmetic is exact in Float32; zero
 * encoding/opacity executes no vertex storage read. Other producers retain
 * their unrestricted two-header helper. */
export function faceStrokeHalfUvVertexHeaders(options:Pick<FaceStrokeNodeOptions,'table'|'faceId'|'enabled'|'opacity'>,label:string):readonly[THREE.Node<'vec4'>,THREE.Node<'vec4'>]{
 assertHalfUvFaceStrokeHeaders(options.table);if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(label))throw Error('Stable packed-header varying label required');
 const packed=varying(Fn(()=>{const result=vec4(0).toVar();If(options.enabled.greaterThan(0).and(options.opacity.greaterThan(0)),()=>{const first=int(options.faceId).mul(HEADER_ROWS),a=options.table.node.element(first),b=options.table.node.element(first.add(1)),code=a.z.mul(2).add(a.w.mul(8)).add(b.x.mul(32)).add(b.y.mul(128)).mul(8).add(b.w);result.assign(vec4(a.xy,b.z,code));});return result;})(),label).setInterpolation('flat','first'),word=packed.w.toUint(),bounds=word.shiftRight(uint(3)),digit=(shift:number)=>bounds.shiftRight(uint(shift)).bitAnd(uint(3)).toFloat().mul(.5);
 return[vec4(packed.xy,digit(0),digit(2)),vec4(digit(4),digit(6),packed.z,word.bitAnd(uint(7)).toFloat())];
}
/** Premultiplied ink RGB + alpha. Derivatives execute before varying branches;
 * only thin painted regions fetch generic pigment and the dry-brush map. */
export function queryFaceStrokeCoverage(options:FaceStrokeNodeOptions):THREE.Node<'vec4'> {
 options.table.assertCurrent();const face=varying(options.faceId,'v_surfaceStrokeFace').setInterpolation('flat','first'),uv=Reflect.get(options.faceUv,'isVaryingNode')===true?options.faceUv:varying(options.faceUv,'v_surfaceStrokeUv'),read=options.readRow??((row:THREE.Node<'int'>)=>options.table.node.element(row));
 return Fn(()=>{
  const result=vec4(0).toVar();
  // This caller-supplied switch is uniform (texture encoding × line opacity).
  // Pastel/zero ink execute no derivatives, SSBO reads or texture operations.
  If(options.enabled.greaterThan(0).and(options.opacity.greaterThan(0)),()=>{
   const dx=uv.dFdx().toVar(),dy=uv.dFdy().toVar(),px=(options.surfacePosition??positionView).dFdx().toVar(),py=(options.surfacePosition??positionView).dFdy().toVar(),first=int(face).mul(HEADER_ROWS),header=options.headers?.[0]??read(first),info=options.headers?.[1]??read(first.add(1)),distance=float(0).toVar(),span=info.xy.sub(header.zw),relative=uv.sub(header.zw),scale=span.x.add(span.y).max(1e-20);
   // Explicitly dominate both conditional updates and the final gate read.
   distance.assign(uv.x.sub(header.z).min(uv.y.sub(header.w)).min(info.x.sub(uv.x)).min(info.y.sub(uv.y)));
   // Diagonals are admitted only when present in the real Source records.
   // Their L-infinity distance uses the same per-coordinate inset bound.
   // No new storage read, strip query, texture sample or pixel color is added.
   If(info.w.equal(2).or(info.w.equal(4)),()=>{distance.assign(distance.min(relative.x.mul(span.y).sub(relative.y.mul(span.x)).abs().div(scale)));});
   If(info.w.equal(3).or(info.w.equal(4)),()=>{distance.assign(distance.min(relative.x.mul(span.y).add(relative.y.mul(span.x)).sub(span.x.mul(span.y)).abs().div(scale)));});
   If(header.y.greaterThan(0).and(info.w.lessThan(.5).or(distance.lessThanEqual(info.z))),()=>{
   Loop({start:int(0),end:int(header.y),type:'int',condition:'<'},({i})=>{
    const points:THREE.Node<'vec2'>[]=[],edge=int(header.x).add(i.mul(EDGE_ROWS));
    for(let vertex=0;vertex<6;vertex++){const o=vertex*6,row=edge.add(Math.floor(o/4)),offset=o%4,a=read(row),b=read(row.add(1)),base=offset===0?a.xy:a.zw,width=offset===0?a.zw:b.xy,rough=offset===0?b.xy:b.zw;points.push(base.add(width.add(rough.mul(options.irregularity)).mul(options.width)).toVar());}
    const matched=float(0).toVar();
    for(const ids of stripTriangles)If(matched.equal(0),()=>{
     const a=points[ids[0]]!,b=points[ids[1]]!.sub(a),c=points[ids[2]]!.sub(a),det=b.x.mul(c.y).sub(c.x.mul(b.y)).toVar(),inv=vec4(c.y,c.x.negate(),b.y.negate(),b.x).div(det.abs().max(1e-20).mul(det.lessThan(0).select(float(-1),float(1)))),p=uv.sub(a),s=vec2(p.x.mul(inv.x).add(p.y.mul(inv.y)),p.x.mul(inv.z).add(p.y.mul(inv.w))).toVar();
     If(det.abs().greaterThan(1e-20).and(s.x.greaterThanEqual(-1e-6)).and(s.y.greaterThanEqual(-1e-6)).and(s.x.add(s.y).lessThanEqual(1+1e-6)),()=>{
      const bu=(i:number)=>[Math.floor(i/2)*.5,i%2] as const,u0=bu(ids[0]),u1=bu(ids[1]),u2=bu(ids[2]),vx=vec2(u1[0]-u0[0],u1[1]-u0[1]),vy=vec2(u2[0]-u0[0],u2[1]-u0[1]),brush=vec2(u0 as unknown as THREE.Node<'vec2'>).add(vx.mul(s.x)).add(vy.mul(s.y)).toVar(),transform=(d:THREE.Node<'vec2'>)=>vx.mul(d.x.mul(inv.x).add(d.y.mul(inv.y))).add(vy.mul(d.x.mul(inv.z).add(d.y.mul(inv.w)))),gx=transform(dx),gy=transform(dy);
      // The exact Source physical metric, using analytic strip UV gradients.
      // Its singular-angle fallback is important at perspective silhouettes.
      const determinant=gx.x.mul(gy.y).sub(gx.y.mul(gy.x)),threshold=gx.length().mul(gy.length()).mul(1e-7).max(1e-30),safe=determinant.abs().max(threshold).mul(determinant.lessThan(0).select(float(-1),float(1))),tangent=px.mul(gy.y).sub(py.mul(gx.y)).div(safe),bitangent=py.mul(gx.x).sub(px.mul(gy.x)).div(safe),aLength=tangent.length(),unit=tangent.div(aLength.max(1e-10)),cLength=unit.dot(bitangent),dLength=bitangent.sub(unit.mul(cLength)).length(),valid=determinant.abs().greaterThan(threshold).and(aLength.greaterThan(1e-10)).and(dLength.greaterThan(1e-10)),actual=valid.select(vec3(aLength.min(1e6),cLength.clamp(-1e6,1e6),dLength.min(1e6)),vec3(1,0,1)),density=actual.x.mul(actual.z).max(1e-20).sqrt().reciprocal(),metric=(v:THREE.Node<'vec2'>)=>vec2(v.x.mul(actual.x).add(v.y.mul(actual.y)),v.y.mul(actual.z)).mul(density),paint=options.samplePigment(metric(brush),metric(gx),metric(gy)).mul(options.brushColor),dry=options.sampleDry(brush,gx,gy),soft=brush.y.smoothstep(0,.035).mul(float(1).sub(brush.y.smoothstep(.90,1))),alpha=options.opacity.mul(soft).mul(mix(float(1),dry.mul(.65).add(.35),options.irregularity)).toVar();
      If(alpha.lessThan(.012),()=>{alpha.assign(0);});result.rgb.assign(result.rgb.mul(float(1).sub(alpha)).add(paint.mul(alpha)));result.a.assign(result.a.add(float(1).sub(result.a).mul(alpha)));matched.assign(1);
     });
    });
   });
   });
  });
  return result;
 })();
}
export function createFaceStrokeNode(base:THREE.Node<'vec3'>,options:FaceStrokeNodeOptions):THREE.Node<'vec3'> {const coverage=queryFaceStrokeCoverage(options);return base.mul(float(1).sub(coverage.a)).add(coverage.rgb);}
