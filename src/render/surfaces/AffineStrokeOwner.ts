/** Prepared opaque-stroke representation. Canonical Source CPU records remain
 * borrowed and untouched. This owner alone owns the prepared GPU coefficients.
 * No admission/settings/dirty work is called by an ordinary render frame. */
import * as THREE from'three/webgpu';
import{storage,uniform}from'three/tsl';
import type{FaceStrokeData}from'./FaceStrokeTable';
import{FACE_STROKE_EDGE_ROWS}from'./FaceStrokeTable';

export interface StrokeSettings{readonly width:number;readonly irregularity:number}
export interface CanonicalStencil{
 readonly canonical:FaceStrokeData;
 /** Explicit unit-UV Rock domain only. The last row of its first edge block
  * already exists and is unused by all four affine triangle queries. */
 readonly interiorCircle?:true;
 /** A producer revision, not a frame/pose/paint epoch. Rock uses stats.patches
  * plus buffer.id; immutable models use a stable model key. */
 revision():string;
 /** Full catalog ONLY at admission/settings. Sparse Rock must provide actual
  * owned IDs, never range(0,faceCount): its IDs/headers are not dense. */
 faceIds():readonly number[];
 /** Borrowed linear canonical rows. Single Rock/fixed tables only in v1.
  * This call must be O(1), with no source.values whole-table assembly. */
 rows():Float32Array;
 assertCurrent():void;
}
export interface AffineStage{publish():void;commit():void;rollback():void;dispose():void;readonly stats:{faces:number;edges:number;rows:number;cpuBytes:number;cpuMs:number;kind:'full'|'dirty'}}
export class AffineAdmissionRefusal extends Error{}
const f=Math.fround,EPS=f(1e-20),STRIPS=[[0,2,3],[0,3,1],[2,4,5],[2,5,3]]as const,HEADER_ROWS=2,EDGE_FLOATS=FACE_STROKE_EDGE_ROWS*4;
if(FACE_STROKE_EDGE_ROWS!==9)throw Error('Review affine ABI when canonical Source edge stride changes');
export function normalizedStrokeSettings(settings:StrokeSettings):StrokeSettings{
 if(!Number.isFinite(settings.width)||!Number.isFinite(settings.irregularity))throw Error('Finite Source stroke settings required');
 return{width:f(Math.max(.5,Math.min(5,settings.width))),irregularity:f(Math.max(0,Math.min(1,settings.irregularity)))};
}
const key=(settings:StrokeSettings)=>JSON.stringify([settings.width,settings.irregularity]);
/** Eight useful rows in the NINE-row canonical edge slot. Padding retains all
 * Source header addresses, edge order and allocator/free-block arithmetic.
 * Per-op fround models WGSL f32, NOT a proof about driver contraction/FMA. */
export function prepareAffineEdge(records:Float32Array,settings:StrokeSettings):Float32Array{
 if(records.length!==EDGE_FLOATS||records.some(value=>!Number.isFinite(value)))throw Error('Actual finite36-float Source edge required');
 const s=normalizedStrokeSettings(settings),points=Array.from({length:6},(_,i)=>{const p=i*6;return[0,1].map(k=>f(records[p+k]!+f(f(records[p+k+2]!+f(records[p+k+4]!*s.irregularity))*s.width)))as[number,number];}),result=new Float32Array(EDGE_FLOATS);
 for(let which=0;which<4;which++){
  const ids=STRIPS[which]!,a=points[ids[0]]!,b=points[ids[1]]!,c=points[ids[2]]!,bx=f(b[0]-a[0]),by=f(b[1]-a[1]),cx=f(c[0]-a[0]),cy=f(c[1]-a[1]),det=f(f(bx*cy)-f(cx*by)),safe=f(Math.max(Math.abs(det),EPS)*(det<0?-1:1)),at=which*8;
  result.set([a[0],a[1],f(cy/safe),f(-cx/safe),f(-by/safe),f(bx/safe),Math.abs(det)>EPS?1:0,0],at);
 }
 if(result.some(value=>!Number.isFinite(value)))throw new AffineAdmissionRefusal('Prepared Source inverse exceeds finite f32 domain');
 return result;
}
/** Conservative certificates against the ACTUAL prepared f32 predicates.
 * This is not a raster/sample test of the strip. For each triangle, at least
 * one of its three accepting half-planes must be false throughout the disk.
 * The radius uses an L1 upper bound on the row's Euclidean slope, so no CPU
 * sqrt/normalization or inverse-of-an-inverse is required.
 *
 * On q in [0,1]^2, each subtraction/product/sum (including contraction) has
 * absolute error bounded by the sum of absolute intermediate magnitudes times
 * 2^-18, plus normal-minimum terms for permitted subnormal flushing. This
 * leaves at least32 single-precision ulps per elementary operation, and also
 * dominates the double arithmetic and the final downward f32 radius store.
 * Overflow/nonfinite certificates disable rejection rather than approximation.
 * Runtime separately proves q in the unit domain and adds a 2^-14 positive
 * guard to its squared-distance test. Thus a rounded-down distance cannot
 * admit an exterior point. Derivative-footprint shrink only reduces the disk.
 * These are analytic bounds; Native quality remains an independent gate. */
export const AFFINE_CIRCLE_DISTANCE_GUARD=2**-14;
const CIRCLE_ERROR=2**-18,MIN_NORMAL=2**-126;
const CIRCLE_CENTRES=Object.freeze([[.5,.5],[1/3,1/3],[1/3,2/3],[2/3,1/3],[2/3,2/3]].map(p=>Object.freeze([f(p[0]!),f(p[1]!)]as const)));
export function prepareAffineInteriorCircle(edges:readonly Float32Array[]):readonly[number,number,number,number]{
 if(!edges.length||edges.some(edge=>edge.length!==EDGE_FLOATS||edge.some(v=>!Number.isFinite(v))))return[0,0,0,0];
 if(!edges.some(edge=>[0,1,2,3].some(triangle=>edge[triangle*8+6]!>.5)))return[0,0,0,0];
 let best:readonly[number,number,number,number]=[0,0,0,0];
 for(const[cx,cy]of CIRCLE_CENTRES){
  let radius=Math.min(cx,cy,1-cx,1-cy);
  for(const edge of edges)for(let triangle=0;triangle<4;triangle++){
   const at=triangle*8;if(edge[at+6]!<=.5)continue;
   const ax=edge[at]!,ay=edge[at+1]!,ux=edge[at+2]!,uy=edge[at+3]!,vx=edge[at+4]!,vy=edge[at+5]!,px=cx-ax,py=cy-ay;
   const u=px*ux+py*uy,v=px*vx+py*vy,mu=(1+Math.abs(ax))*Math.abs(ux)+(1+Math.abs(ay))*Math.abs(uy),mv=(1+Math.abs(ax))*Math.abs(vx)+(1+Math.abs(ay))*Math.abs(vy),eu=CIRCLE_ERROR*(mu+1)+MIN_NORMAL*(Math.abs(ux)+Math.abs(uy)+8),ev=CIRCLE_ERROR*(mv+1)+MIN_NORMAL*(Math.abs(vx)+Math.abs(vy)+8),es=eu+ev+CIRCLE_ERROR*(mu+mv+eu+ev+1);
   if(!Number.isFinite(mu+mv)||mu+mv>2**120){radius=0;break;}
   const lower=f(-1e-6),upper=f(1+1e-6),candidate=(violation:number,slope:number)=>violation>0?(slope>0?violation/slope:.5):0;
   const certificate=Math.max(candidate(lower-u-eu,Math.abs(ux)+Math.abs(uy)),candidate(lower-v-ev,Math.abs(vx)+Math.abs(vy)),candidate(u+v-upper-es,Math.abs(ux+vx)+Math.abs(uy+vy)));
   if(!Number.isFinite(certificate)){radius=0;break;}radius=Math.min(radius,certificate);
  }
  // Shrink by64 ulps before storing. Never round a proved radius outward.
  const down=f(Math.max(0,radius)*(1-2**-18));if(down*down>AFFINE_CIRCLE_DISTANCE_GUARD&&down>best[2])best=[cx,cy,down,0];
 }
 return best;
}
interface Span{row:number;values:Float32Array;undo?:Float32Array}
export class AffineStrokeOwner{
 private attribute=new THREE.StorageBufferAttribute(new Float32Array(4),4);
 readonly node=storage(this.attribute,'vec4',0).toReadOnly();
 readonly width=uniform(1);readonly irregularity=uniform(0);
 private readonly retired:THREE.StorageBufferAttribute[]=[];
 private staging:AffineStage|undefined;private closed=false;private ready=false;private currentKey='';private preparedRevision='';
 readonly counters={fullPreparations:0,dirtyPreparations:0,preparedFaces:0,preparedEdges:0,publishedRows:0,capacityGrowths:0};
 constructor(readonly source:CanonicalStencil,readonly limits={maxBindingBytes:128*1024*1024,maxOwnedBytes:256*1024*1024,maxStageBytes:32*1024*1024}){}
 get buffer():THREE.StorageBufferAttribute{return this.attribute;}
 get cpuBytes():number{return[this.attribute,...this.retired].reduce((sum,a)=>sum+a.array.byteLength,0);}
 needsPreparation(settings:StrokeSettings):boolean{this.assertCurrent();return!this.ready||this.currentKey!==key(normalizedStrokeSettings(settings))||this.preparedRevision!==this.source.revision();}
 assertCurrent():void{if(this.closed)throw Error('Prepared stroke owner retired');this.source.assertCurrent();}
 assertReady():void{this.assertCurrent();if(!this.ready)throw Error('Prepared affine stroke admission must precede shader/draw publication');}
 readonly readRow=(row:THREE.Node<'int'>):THREE.Node<'vec4'>=>this.node.element(row);
 /** HEADER-only compatibility facade. CPU values are canonical; node/buffer
  * are prepared. Never pass this facade to the old canonical edge kernel. */
 headerTable():FaceStrokeData{
  const owner=this,canonical=this.source.canonical;return{get values(){return canonical.values;},get buffer(){return owner.buffer;},node:this.node,get faceCount(){return canonical.faceCount;},get edgeCount(){return canonical.edgeCount;},get maxEdgesPerFace(){return canonical.maxEdgesPerFace;},get cpuBytes(){return owner.cpuBytes;},assertCurrent:()=>owner.assertCurrent(),dispose:()=>{throw Error('Header facade borrows its owner');}};
 }
 private ensureRows(rows:number):void{
  if(rows<=this.attribute.count)return;
  const capacity=2**Math.ceil(Math.log2(Math.max(4,rows))),bytes=capacity*16;
  if(!Number.isSafeInteger(rows)||rows<0||bytes>this.limits.maxBindingBytes||this.cpuBytes+bytes>this.limits.maxOwnedBytes)throw new AffineAdmissionRefusal('Affine storage admission exceeds bounded ownership budget');
  const next=new THREE.StorageBufferAttribute(new Float32Array(capacity*4),4);(next.array as Float32Array).set(this.attribute.array as Float32Array);this.retired.push(this.attribute);this.attribute=next;this.node.value=next;next.addUpdateRange(0,next.array.length);next.needsUpdate=true;this.counters.capacityGrowths++;
 }
 stageAll(settings:StrokeSettings):AffineStage{return this.prepare(this.source.faceIds(),settings,'full');}
 stageDirty(faces:readonly number[]):AffineStage{
  this.assertReady();return this.prepare(faces,{width:this.width.value,irregularity:this.irregularity.value},'dirty');
 }
 private prepare(faces:readonly number[],settings:StrokeSettings,kind:'full'|'dirty'):AffineStage{
  this.assertCurrent();if(this.staging)throw Error('Settle the existing affine publication before preparing another');
  const started=performance.now(),normalized=normalizedStrokeSettings(settings),revision=this.source.revision(),canonical=this.source.rows(),spans:Span[]=[],seen=new Set<number>();let edges=0,stageBytes=0,required=0;
  for(const face of faces){
   if(!Number.isSafeInteger(face)||face<0||face>=this.source.canonical.faceCount||seen.has(face))throw Error('Unique actual canonical face IDs required');seen.add(face);
   const first=face*HEADER_ROWS,at=first*4;if(at+8>canonical.length)throw Error('Canonical header outside source rows');const header=canonical.slice(at,at+8),row=header[0]!,count=header[1]!;
   if(!Number.isSafeInteger(row)||row<0||!Number.isSafeInteger(count)||count<0||count>this.source.canonical.maxEdgesPerFace||row*4+count*EDGE_FLOATS>canonical.length||header.some(value=>!Number.isFinite(value)))throw Error('Canonical face has invalid Source header/edge span');
   spans.push({row:first,values:header});stageBytes+=header.byteLength;required=Math.max(required,first+2);
   const preparedEdges:Float32Array[]=[];
   for(let edge=0;edge<count;edge++){const base=row+edge*FACE_STROKE_EDGE_ROWS,values=prepareAffineEdge(canonical.subarray(base*4,base*4+EDGE_FLOATS),normalized);preparedEdges.push(values);spans.push({row:base,values});stageBytes+=values.byteLength;required=Math.max(required,base+FACE_STROKE_EDGE_ROWS);edges++;}
   if(this.source.interiorCircle&&preparedEdges.length)preparedEdges[0]!.set(prepareAffineInteriorCircle(preparedEdges),32);
   if(stageBytes*2>this.limits.maxStageBytes)throw new AffineAdmissionRefusal('Affine staging/undo admission exceeds bounded CPU budget');
  }
  spans.sort((a,b)=>a.row-b.row);for(let i=1;i<spans.length;i++)if(spans[i]!.row<spans[i-1]!.row+spans[i-1]!.values.length/4)throw Error('Canonical faces aliased an owned header/edge span');
  this.source.assertCurrent();if(this.source.revision()!==revision)throw Error('Canonical stencil changed during affine preparation');
  this.ensureRows(required); // HWM growth preserves old semantic content.
  for(const span of spans)span.undo=(this.attribute.array as Float32Array).slice(span.row*4,span.row*4+span.values.length);
  const before={width:this.width.value,irregularity:this.irregularity.value,key:this.currentKey,revision:this.preparedRevision,ready:this.ready};let published=false,committed=false,disposed=false;
  const stats={faces:faces.length,edges,rows:spans.reduce((sum,s)=>sum+s.values.length/4,0),cpuBytes:stageBytes*2,cpuMs:performance.now()-started,kind};
  const write=(undo:boolean)=>{for(const span of spans){(this.attribute.array as Float32Array).set(undo?span.undo!:span.values,span.row*4);this.attribute.addUpdateRange(span.row*4,span.values.length);}if(spans.length)this.attribute.needsUpdate=true;};
  const rollback=()=>{if(!published||committed)return;write(true);this.width.value=before.width;this.irregularity.value=before.irregularity;this.currentKey=before.key;this.preparedRevision=before.revision;this.ready=before.ready;published=false;};
  const stage:AffineStage={stats,publish:()=>{
   this.assertCurrent();if(disposed||committed||published)throw Error('Invalid affine publication state');if(this.source.revision()!==revision)throw Error('Canonical stencil superseded before affine publication');
   // One synchronous CPU critical section under the caller's draw hold. Both
   // inverse coefficients AND the roughness used by dry ink are one revision.
   published=true;try{write(false);this.width.value=normalized.width;this.irregularity.value=normalized.irregularity;this.currentKey=key(normalized);this.preparedRevision=revision;this.ready=true;}catch(error){try{rollback();}catch(cleanup){throw new AggregateError([error,cleanup],'Affine publication rollback failed');}throw error;}
  },commit:()=>{this.assertCurrent();if(!published||disposed||committed||this.source.revision()!==revision)throw Error('Cannot commit stale/unpublished affine coefficients');committed=true;if(kind==='full')this.counters.fullPreparations++;else this.counters.dirtyPreparations++;this.counters.preparedFaces+=faces.length;this.counters.preparedEdges+=edges;this.counters.publishedRows+=stats.rows;},rollback,dispose:()=>{if(disposed)return;rollback();disposed=true;this.staging=undefined;}};
  this.staging=stage;return stage;
 }
 snapshot(){return{ready:this.ready,settingsKey:this.currentKey,preparedRevision:this.preparedRevision,cpuBytes:this.cpuBytes,canonicalBorrowedCpuBytes:this.source.canonical.cpuBytes,totalKnownCpuBytes:this.cpuBytes+this.source.canonical.cpuBytes,pendingStageCpuBytes:this.staging?.stats.cpuBytes??0,rows:this.attribute.count,retiredBuffers:this.retired.length,pending:!!this.staging,counters:{...this.counters},interiorCircle:this.source.interiorCircle?{storage:'Existing ninth row of first edge; original headers and addresses preserved',additionalRetainedCpuBytes:0,additionalGpuBytes:0,additionalStageBytes:0,additionalFlatVaryings:1}:null,scope:'Prepared affine coefficients; canonical CPU remains separate/borrowed. Potential old canonical GPU allocation is producer-owned and not hidden here. No pixel/performance/driver-VRAM equivalence presumed.'};}
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{this.assertCurrent();const actual=[...new Set(geometries)];for(const attribute of new Set([this.attribute,...this.retired]))for(const geometry of actual)geometry.setAttribute(`uvAffineStrokeGpuRetirement${attribute.id}`,attribute);}
 dispose():void{if(this.closed)return;const errors:unknown[]=[];try{this.staging?.dispose();}catch(error){errors.push(error);}try{this.node.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Affine owner terminal settlement failed');this.closed=true;this.retired.length=0;}
}
/** Fixed models: dense IDs supplied at admission. Rock: provide its actual
 * catalog/dirty IDs and a single-linear predicate; no private reflection seam. */
export function linearCanonicalStencil(canonical:FaceStrokeData,options:{faceIds:()=>readonly number[];revision:()=>string;isLinear:()=>boolean;interiorCircle?:true}):CanonicalStencil{
 return{canonical,interiorCircle:options.interiorCircle,faceIds:options.faceIds,revision:options.revision,assertCurrent:()=>canonical.assertCurrent(),rows:()=>{canonical.assertCurrent();if(!options.isLinear())throw new AffineAdmissionRefusal('Private affine v1 supports contiguous canonical storage only; large paged representation remains Source');const rows=canonical.buffer.array;if(!(rows instanceof Float32Array)||canonical.buffer.itemSize!==4)throw Error('Actual linear canonical vec4 storage required');return rows;}};
}
