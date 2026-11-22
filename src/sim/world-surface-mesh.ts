/** Independent spherical centroid/edge-flip subdivision. The topological
 * operator triples triangular faces (sqrt(3), Kobbelt SIGGRAPH2000); old
 * vertices are NOT smoothed. This is the Core4871 behaviour confirmed by
 * reference-01, not a copy of its implementation or a seed-output certificate. */
import {vector3Angle} from './verse-vector.ts';
export type SurfaceVector=readonly [number,number,number];
export interface SurfaceMesh {positions:Float32Array;triangles:Uint32Array;level:number;closed?:boolean}
export const WORLD_SURFACE_RADIUS=100;
const f=Math.fround;
const add=(a:number,b:number)=>f(a+b);
const mul=(a:number,b:number)=>f(a*b);
const squared=(x:number,y:number,z:number)=>add(add(mul(x,x),mul(y,y)),mul(z,z));
/** Geometry revision 2 (`mono`) follows the game's runtime precision: the
 * magnitude's sum of squares is a double expression (`Vector3.Magnitude`),
 * angles are `Vector3.Angle` with the view centre scaled to the radius (see
 * `verse-vector.ts`). Revision 1 keeps its historical single-precision sums. */
const normalize=(x:number,y:number,z:number,mono=false):SurfaceVector=>{
 const magnitude=f(Math.sqrt(mono?x*x+y*y+z*z:squared(x,y,z)));
 if(!(magnitude>1e-5))throw Error('Degenerate spherical position');
 return [f(x/magnitude),f(y/magnitude),f(z/magnitude)];
};
const project=(v:SurfaceVector,mono=false):SurfaceVector=>{
 const u=normalize(v[0],v[1],v[2],mono);return [mul(u[0],WORLD_SURFACE_RADIUS),mul(u[1],WORLD_SURFACE_RADIUS),mul(u[2],WORLD_SURFACE_RADIUS)];
};
function projectedMean(a:SurfaceVector,b:SurfaceVector,c:SurfaceVector,mono=false):SurfaceVector {
 return project([f(add(add(a[0],b[0]),c[0])/3),f(add(add(a[1],b[1]),c[1])/3),f(add(add(a[2],b[2]),c[2])/3)],mono);
}
export function surfaceAngleDegrees(a:SurfaceVector,b:SurfaceVector):number {
 const denominator=f(Math.sqrt(mul(squared(...a),squared(...b))));
 if(denominator<1e-15)return 0;
 const dot=add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2]));
 return mul(f(Math.acos(Math.max(-1,Math.min(1,f(dot/denominator))))),f(57.29578));
}
function position(p:Float32Array,i:number):SurfaceVector{return [p[i*3]!,p[i*3+1]!,p[i*3+2]!];}
function write(p:Float32Array,i:number,v:SurfaceVector):void{p.set(v,i*3);}
/** Packed incident faces retain source face order without a set/hash iteration. */
function incidentFaces(mesh:SurfaceMesh):{offsets:Uint32Array;faces:Uint32Array} {
 const count=mesh.positions.length/3,offsets=new Uint32Array(count+1);
 for(const vertex of mesh.triangles)offsets[vertex+1]=offsets[vertex+1]!+1;
 for(let i=1;i<offsets.length;i++)offsets[i]=offsets[i]!+offsets[i-1]!;
 const cursor=offsets.slice(),faces=new Uint32Array(mesh.triangles.length);
 for(let f=0;f<mesh.triangles.length/3;f++)for(let j=0;j<3;j++){
  const vertex=mesh.triangles[f*3+j]!,index=cursor[vertex]!;
  faces[index]=f;cursor[vertex]=index+1;
 }
 return {offsets,faces};
}
function successor(triangles:Uint32Array,face:number,vertex:number):number {
 for(let i=0;i<3;i++)if(triangles[face*3+i]===vertex)return triangles[face*3+(i+1)%3]!;
 throw Error('Vertex absent from incident face');
}
function acrossFace(mesh:SurfaceMesh,incidents:ReturnType<typeof incidentFaces>,vertex:number,face:number,next:number):number {
 for(let k=incidents.offsets[vertex]!;k<incidents.offsets[vertex+1]!;k++){
  const other=incidents.faces[k]!;
  if(other===face)continue;
  for(let j=0;j<3;j++)if(mesh.triangles[other*3+j]===next)return other;
 }
 return -1;
}
export function initialSurfaceMesh(mono=false):SurfaceMesh {
 const t=f(add(1,f(Math.sqrt(5)))/2),raw:SurfaceVector[]=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
 const positions=new Float32Array(36);raw.forEach((v,i)=>write(positions,i,project(v,mono)));
 const triangles=new Uint32Array([0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1]);
 return {positions,triangles,level:0};
}
/** Typed output and packed face incidence. No per-tile scene/DOM objects,
 * mutable campaign RNG, smoothing, random rescue or hidden global cache. */
export function refineSurfaceMesh(input:SurfaceMesh,mono=false):SurfaceMesh {
 const oldCount=input.positions.length/3,faces=input.triangles.length/3;
 if(!Number.isInteger(oldCount)||!Number.isInteger(faces)||input.closed!==false&&(oldCount!==10*3**input.level+2||faces!==20*3**input.level)||input.level>=10)throw Error('Invalid or excessive surface mesh level');
 const positions=new Float32Array((oldCount+faces)*3);positions.set(input.positions);
 for(let f=0;f<faces;f++){
  const a=position(input.positions,input.triangles[f*3]!),b=position(input.positions,input.triangles[f*3+1]!),c=position(input.positions,input.triangles[f*3+2]!);
  write(positions,oldCount+f,projectedMean(a,b,c,mono));
 }
 const triangles=new Uint32Array(faces*9),incidents=incidentFaces(input);let out=0;
 for(let vertex=0;vertex<oldCount;vertex++){
  for(let k=incidents.offsets[vertex]!;k<incidents.offsets[vertex+1]!;k++){
   const face=incidents.faces[k]!,next=successor(input.triangles,face,vertex);
   const other=acrossFace(input,incidents,vertex,face,next);
   if(other<0)continue;
   triangles[out++]=vertex;triangles[out++]=oldCount+other;triangles[out++]=oldCount+face;
  }
 }
 if(input.closed!==false&&out!==triangles.length)throw Error('Non-closed surface mesh');
 return {positions,triangles:out===triangles.length?triangles:triangles.slice(0,out),level:input.level+1,...input.closed===false?{closed:false}:{}};
}
export function generateSurfaceMesh(level=10,mono=false):SurfaceMesh {
 if(!Number.isInteger(level)||level<0||level>10)throw Error('Invalid surface subdivision');
 let mesh=initialSurfaceMesh(mono);for(let i=0;i<level;i++)mesh=refineSurfaceMesh(mesh,mono);return mesh;
}
export function surfaceViewAngle(coverage:.3|.5|1):number{return mul(f(coverage),180);}
/** `viewCenter * radius`, as the game's visibility tests take it. */
const scaleToRadius=(v:SurfaceVector):SurfaceVector=>[mul(v[0],WORLD_SURFACE_RADIUS),mul(v[1],WORLD_SURFACE_RADIUS),mul(v[2],WORLD_SURFACE_RADIUS)];
export function surfaceVisibilityAxis(coverage:.3|.5|1):SurfaceVector {
 const view=surfaceViewAngle(coverage),rotation=view>45?Math.max(f(90-view),0):45;
 // Independent axis-angle mathematics. The native AngleAxis rounding boundary
 // remains explicitly distinct from the managed mesh oracle's supplied axis.
 const half=f(mul(rotation,f(.0174532924))*.5),x=f(Math.sin(half)),w=f(Math.cos(half)),twiceX=mul(x,2);
 return [0,mul(w,twiceX),f(mul(x,twiceX)-1)];
}
/** Initial face crop and boundary treatment are behavioural rules confirmed
 * by static Core reference. Never force a retained tile count after the fact. */
export function generateCoveredSurfaceMesh(coverage:.3|.5|1,level=10,mono=false):SurfaceMesh {
 if(![.3,.5,1].includes(coverage)||!Number.isInteger(level)||level<0||level>10)throw Error('Invalid covered surface request');
 if(coverage===1)return generateSurfaceMesh(level,mono);
 const base=initialSurfaceMesh(mono),axis=surfaceVisibilityAxis(coverage),view=add(surfaceViewAngle(coverage),18),scaledAxis=scaleToRadius(axis);
 const kept:number[]=[];const used=new Uint8Array(12);
 for(let f=0;f<20;f++){
  const indices=[base.triangles[f*3]!,base.triangles[f*3+1]!,base.triangles[f*3+2]!];
  if(!indices.some(i=>{const p=position(base.positions,i);return (mono?vector3Angle(scaledAxis,p):surfaceAngleDegrees(axis,p))<=view;}))continue;
  for(const i of indices){kept.push(i);used[i]=1;}
 }
 const remap=new Int32Array(12).fill(-1),points=base.positions.slice();let prefix=0;
 // The reference compacts the live prefix without truncating its initial
 // storage. Retain the unused tail: later face-centre IDs depend on Count.
 for(let i=0;i<12;i++)if(used[i]){remap[i]=prefix;write(points,prefix++,position(base.positions,i));}
 let mesh:SurfaceMesh={positions:points,triangles:new Uint32Array(kept.map(i=>remap[i]!)),level:0,closed:false};
 for(let i=0;i<level;i++)mesh=refineSurfaceMesh(mesh,mono);return mesh;
}
export interface SurfaceCellGeometry {sourceId:number;center:SurfaceVector;corners:SurfaceVector[];neighbours:number[]}
/** Cropping preserves complete dual polygons, while links point only to
 * retained neighbours. A coverage is angular, not a percentage of land. */
export function cropSurfaceCells(mesh:SurfaceMesh,coverage:.3|.5|1,axis:SurfaceVector,mono=false):SurfaceCellGeometry[] {
 if(![.3,.5,1].includes(coverage))throw Error('Invalid surface coverage');
 const view=surfaceViewAngle(coverage),vertexCount=mesh.positions.length/3,faces=mesh.triangles.length/3,scaledAxis=scaleToRadius(axis);
 const cornerData=new Float32Array(faces*3),incidents=incidentFaces(mesh);
 for(let f=0;f<faces;f++){
  const a=position(mesh.positions,mesh.triangles[f*3]!),b=position(mesh.positions,mesh.triangles[f*3+1]!),c=position(mesh.positions,mesh.triangles[f*3+2]!);
  write(cornerData,f,projectedMean(a,b,c,mono));
 }
 const ids=new Int32Array(vertexCount).fill(-1),cells:SurfaceCellGeometry[]=[],adjacentVertices:number[][]=[];
 for(let vertex=0;vertex<vertexCount;vertex++){
  const degree=incidents.offsets[vertex+1]!-incidents.offsets[vertex]!;
  if(degree!==5&&degree!==6)continue;
  const first=incidents.faces[incidents.offsets[vertex]!]!,corners:SurfaceVector[]=[],neighbours:number[]=[];
  let face=first;
  for(let k=0;k<degree;k++){
   corners.push(position(cornerData,face));
   const next=successor(mesh.triangles,face,vertex);neighbours.push(next);
   face=acrossFace(mesh,incidents,vertex,face,next);
   if(face<0)throw Error('Incomplete dual ring');
  }
  if(face!==first)throw Error('Non-closing dual ring');
  const sum=[0,0,0];for(const c of corners)for(let d=0;d<3;d++)sum[d]=add(sum[d]!,c[d]!);
  const center:SurfaceVector=[f(sum[0]!/degree),f(sum[1]!/degree),f(sum[2]!/degree)];
  if(coverage!==1&&(mono?f(vector3Angle(scaledAxis,center)+f(-.00001)):f(surfaceAngleDegrees(axis,center)-f(.00001)))>view)continue;
  ids[vertex]=cells.length;cells.push({sourceId:vertex,center,corners,neighbours:[]});adjacentVertices.push(neighbours);
 }
 for(let id=0;id<cells.length;id++){
  const neighbours:number[]=[];
  for(const source of adjacentVertices[id]!){const mapped=ids[source]!;if(mapped>=0)neighbours.push(mapped);}
  cells[id]!.neighbours=neighbours;
 }
 return cells;
}
