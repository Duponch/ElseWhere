/** PRIVATE preparation-only plan. No Source model mutation, pixels, renderer or RAF. */
import type * as THREE from 'three/webgpu';

export class ActorAtlasAdmissionRefusal extends Error {}
export interface ActorFaceDemand {
 readonly id:number;
 readonly triangles:readonly number[];
 readonly rawBounds:readonly[number,number,number,number];
 /** Max real post-morph dP/du and dP/dv lengths in world-cell units. */
 readonly tangentU:number;readonly tangentV:number;
 /** Full Source512 coverage of BOTH raw paper UV and metric pigment UV. */
 readonly sourceWidth:number;readonly sourceHeight:number;
}
export interface ActorAppearanceDomain {
 readonly modelKey:string;readonly morphKey:string;readonly paletteKey:string;
 readonly paintKey:string;readonly faces:readonly ActorFaceDemand[];
 /** Explicit current capability proof, never inferred from an atlas cache hit. */
 readonly rigidPoseMetric:true;readonly beforeInkBloodFree:true;
 readonly clinicalStage:0;readonly bodyTransformResolved:true;
 readonly relief:0;readonly wear:0;
}
export interface ActorAtlasLimits {
 readonly maxFaces:number;readonly maxPages:number;readonly maxCpuBytes:number;
 readonly maxRetainedGpuBytes:number;readonly maxPeakGpuBytes:number;
 readonly oldLiveGpuBytes:number;readonly externalGpuBytes:number;
 readonly oldLiveCpuBytes:number;readonly externalCpuBytes:number;
 /** Explicit compiler reservation, incl. source P512/KM512/dry, supersampled
  * targets, resolve/mip/dilation masks and temporary geometry. No guessed gain. */
 readonly compilerScratchGpuBytes:number;readonly compilerScratchCpuBytes:number;
}
export interface ActorAtlasTile {
 readonly face:number;readonly page:number;
 readonly rect:Readonly<{x:number;y:number;width:number;height:number}>;
 readonly content:Readonly<{x:number;y:number;width:number;height:number}>;
}
export interface ActorAtlasPlan {
 readonly key:string;readonly size:number;readonly levels:4;
 readonly tier:'screen'|'near-source';readonly maxCellPixels:number;
 readonly oversampling:number;readonly pages:number;readonly tiles:readonly ActorAtlasTile[];
 readonly retainedGpuBytes:number;readonly peakGpuBytes:number;
 readonly retainedCpuBytes:number;readonly peakCpuBytes:number;
 readonly clinical:'no-before-ink-blood';readonly sourcePigmentPixels:512;
}
export const ACTOR_RGBA_PAGE_BYTES=2048*2048*4*(1+1/4+1/16+1/64);
const finite=(n:number,min:number,label:string)=>{if(!Number.isFinite(n)||n<min)throw new ActorAtlasAdmissionRefusal('Invalid '+label);return n;};
const integer=(n:number,min:number,label:string)=>{finite(n,min,label);if(!Number.isSafeInteger(n))throw new ActorAtlasAdmissionRefusal('Integer '+label+' required');return n;};
const align=(n:number)=>Math.ceil(n/8)*8;

/** Uses ACTUAL post-morph Source positions/UVs, face partition and index order.
 * The input geometry is borrowed. Caller computes morph once, without animation,
 * then retains both its original model and paint/appearance epoch until completion.
 * No atlas/bbox generates an imaginary painted edge or new face partition. */
export function actorFaceDemands(geometry:THREE.BufferGeometry,options:{
 readonly uvAttribute:string;readonly faceId:(vertex:number)=>number;
 readonly maxFaces:number;readonly maxTriangles:number;
}):readonly ActorFaceDemand[]{
 const p=geometry.getAttribute('position'),uv=geometry.getAttribute(options.uvAttribute),ix=geometry.index;
 if(!p||!uv||p.itemSize!==3||uv.itemSize<2)throw new ActorAtlasAdmissionRefusal('Actual complete model/UV domain required');
 const n=ix?.count??p.count;if(n%3||n/3>options.maxTriangles)throw new ActorAtlasAdmissionRefusal('Actual complete triangle domain required');
 integer(options.maxFaces,1,'maxFaces');integer(options.maxTriangles,1,'maxTriangles');
 const work=new Map<number,{triangles:number[];bounds:number[];u:number;v:number;pminU:number;pmaxU:number;pminV:number;pmaxV:number}>();
 for(let triangle=0;triangle<n/3;triangle++){
  const vertices=[0,1,2].map(c=>ix?.getX(triangle*3+c)??triangle*3+c),ids=vertices.map(options.faceId),id=integer(ids[0]!,0,'actual faceId');
  if(ids.some(v=>v!==id))throw new ActorAtlasAdmissionRefusal('Source face must be constant on a triangle');
  let f=work.get(id);if(!f){if(work.size>=options.maxFaces)throw new ActorAtlasAdmissionRefusal('Face count before allocation');f={triangles:[],bounds:[Infinity,Infinity,-Infinity,-Infinity],u:0,v:0,pminU:Infinity,pmaxU:-Infinity,pminV:Infinity,pmaxV:-Infinity};work.set(id,f);}f.triangles.push(triangle);
  const a=vertices[0]!,b=vertices[1]!,c=vertices[2]!,du=uv.getX(b)-uv.getX(a),dv=uv.getY(b)-uv.getY(a),eu=uv.getX(c)-uv.getX(a),ev=uv.getY(c)-uv.getY(a),det=du*ev-eu*dv;
  if(![du,dv,eu,ev,det].every(Number.isFinite)||Math.abs(det)<=Math.max(1e-30,Math.hypot(du,dv)*Math.hypot(eu,ev)*1e-7))throw new ActorAtlasAdmissionRefusal('Singular actual UV triangle; retain Source');
  const axis=(component:number)=>{const q=p.getComponent(b,component)-p.getComponent(a,component),r=p.getComponent(c,component)-p.getComponent(a,component);return[(q*ev-r*dv)/det,(r*du-q*eu)/det]as const;},xyz=[axis(0),axis(1),axis(2)],U=xyz.map(v=>v[0]),V=xyz.map(v=>v[1]),A=Math.hypot(...U),C=U.reduce((s,v,i)=>s+v*V[i]!,0)/A,D=Math.hypot(...V.map((v,i)=>v-U[i]!*C/A));
  if(![A,C,D].every(Number.isFinite)||A<=1e-10||D<=1e-10||A>1e6||Math.abs(C)>1e6||D>1e6)throw new ActorAtlasAdmissionRefusal('Metric outside exact Source domain; retain Source');
  f.u=Math.max(f.u,A);f.v=Math.max(f.v,Math.hypot(...V));const density=1/Math.sqrt(A*D),pigmentU:number[]=[],pigmentV:number[]=[];
  for(const v of vertices){const u=uv.getX(v),w=uv.getY(v);if(!Number.isFinite(u)||!Number.isFinite(w))throw new ActorAtlasAdmissionRefusal('Nonfinite source UV');f.bounds[0]=Math.min(f.bounds[0]!,u);f.bounds[1]=Math.min(f.bounds[1]!,w);f.bounds[2]=Math.max(f.bounds[2]!,u);f.bounds[3]=Math.max(f.bounds[3]!,w);pigmentU.push((u*A+w*C)*density);pigmentV.push(w*D*density);}
  f.pminU=Math.min(f.pminU,...pigmentU);f.pmaxU=Math.max(f.pmaxU,...pigmentU);f.pminV=Math.min(f.pminV,...pigmentV);f.pmaxV=Math.max(f.pmaxV,...pigmentV);
 }
 return Object.freeze([...work].sort(([a],[b])=>a-b).map(([id,f])=>{const rawBounds=f.bounds as[number,number,number,number],rawU=rawBounds[2]-rawBounds[0],rawV=rawBounds[3]-rawBounds[1];return Object.freeze({id,triangles:Object.freeze(f.triangles),rawBounds:Object.freeze(rawBounds),tangentU:f.u,tangentV:f.v,sourceWidth:Math.ceil(512*Math.max(rawU,f.pmaxU-f.pminU)),sourceHeight:Math.ceil(512*Math.max(rawV,f.pmaxV-f.pminV))});}));
}
