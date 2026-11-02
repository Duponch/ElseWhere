// Presentation-only attachment derived once from actual compiled torso triangles.
// No inventory, task, animal rule or clock is changed by this helper.
import * as THREE from 'three/webgpu';

export interface AnimalCargoBack {
 readonly x:number;readonly y:number;readonly z:number;readonly width:number;readonly depth:number;
 readonly bodyCenter:number;readonly restFloor:number;readonly supportTriangles:number;readonly footprintScale:number;
}
export interface AnimalCargoBackInput {
 /** Nonindexed XYZ corners of actual rigid torso pieces, in compiled units. */
 readonly torsoTriangles:Float32Array;
 readonly torsoBounds:THREE.Box3;readonly bodyBounds:THREE.Box3;readonly bodyCenter:number;
 readonly widthFraction?:number;readonly depthFraction?:number;
}
type Point=readonly [number,number,number];
function verticalSupport(vertices:Float32Array,x:number,z:number):number|undefined {
 let top=-Infinity;
 for(let i=0;i<vertices.length;i+=9){
  const ax=vertices[i]!,ay=vertices[i+1]!,az=vertices[i+2]!,bx=vertices[i+3]!,by=vertices[i+4]!,bz=vertices[i+5]!,cx=vertices[i+6]!,cy=vertices[i+7]!,cz=vertices[i+8]!;
  const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(denominator)<1e-15)continue;
  const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator,c=1-a-b;
  if(a>=-1e-9&&b>=-1e-9&&c>=-1e-9)top=Math.max(top,a*ay+b*by+c*cy);
 }
 return Number.isFinite(top)?top:undefined;
}
function clip(points:readonly Point[],axis:0|2,limit:number,keepAbove:boolean):Point[]{
 const output:Point[]=[];if(!points.length)return output;
 let previous=points.at(-1)!,previousInside=keepAbove?previous[axis]>=limit:previous[axis]<=limit;
 for(const current of points){
  const inside=keepAbove?current[axis]>=limit:current[axis]<=limit;
  if(inside!==previousInside){const t=(limit-previous[axis])/(current[axis]-previous[axis]);output.push([previous[0]+t*(current[0]-previous[0]),previous[1]+t*(current[1]-previous[1]),previous[2]+t*(current[2]-previous[2])]);}
  if(inside)output.push(current);previous=current;previousInside=inside;
 }
 return output;
}
function footprintTop(vertices:Float32Array,x:number,z:number,width:number,depth:number):{top:number;supportTriangles:number}|undefined {
 const lowX=x-width*.5,highX=x+width*.5,lowZ=z-depth*.5,highZ=z+depth*.5;
 let top=-Infinity,supportTriangles=0;
 for(let i=0;i<vertices.length;i+=9){
  let polygon:Point[]=[[vertices[i]!,vertices[i+1]!,vertices[i+2]!],[vertices[i+3]!,vertices[i+4]!,vertices[i+5]!],[vertices[i+6]!,vertices[i+7]!,vertices[i+8]!]];
  if(!polygon.every(point=>point.every(Number.isFinite)))return;
  polygon=clip(clip(clip(clip(polygon,0,lowX,true),0,highX,false),2,lowZ,true),2,highZ,false);
  if(polygon.length<3)continue;let twiceArea=0;
  for(let p=0;p<polygon.length;p++){const a=polygon[p]!,b=polygon[(p+1)%polygon.length]!;twiceArea+=a[0]*b[2]-b[0]*a[2];}
  if(Math.abs(twiceArea)<=1e-15)continue;
  supportTriangles++;for(const point of polygon)top=Math.max(top,point[1]);
 }
 return Number.isFinite(top)&&supportTriangles>0?{top,supportTriangles}:undefined;
}
/** Exact maximum of the actual triangle planes over a centred rectangular
 * cargo footprint. Clipping interpolates Y as well as X/Z: a sloping back is
 * not replaced by its global AABB top or the legacy species rings. */
export function deriveAnimalCargoBack(input:AnimalCargoBackInput):AnimalCargoBack|undefined {
 const {torsoTriangles:vertices,torsoBounds:torso,bodyBounds:body}=input;
 if(vertices.length===0||vertices.length%9||torso.isEmpty()||body.isEmpty()||![...torso.min.toArray(),...torso.max.toArray(),...body.min.toArray(),...body.max.toArray(),input.bodyCenter].every(Number.isFinite))return;
 const wf=input.widthFraction??.9,df=input.depthFraction??.6;if(!Number.isFinite(wf)||!Number.isFinite(df)||wf<=0||df<=0||wf>1||df>1)return;
 const x=(torso.min.x+torso.max.x)*.5,z=(torso.min.z+torso.max.z)*.5;let width=(torso.max.x-torso.min.x)*wf,depth=(torso.max.z-torso.min.z)*df;
 if(![x,z,width,depth].every(Number.isFinite)||width<=0||depth<=0)return;
 if(verticalSupport(vertices,x,z)===undefined)return;
 const supported=(factor:number):boolean=>[-.5,0,.5].every(u=>[-.5,0,.5].every(v=>verticalSupport(vertices,x+u*width*factor,z+v*depth*factor)!==undefined));
 let footprintScale=1;
 if(!supported(1)){let low=0,high=1;for(let step=0;step<22;step++){const middle=(low+high)*.5;if(supported(middle))low=middle;else high=middle;}if(low<=1e-6)return;footprintScale=low;width*=low;depth*=low;}
 const support=footprintTop(vertices,x,z,width,depth);if(!support)return;const {top,supportTriangles}=support;
 // SpeciesRig uses these precise bind-space values for its quarter roll.
 // Whole-body minX includes the same ears/horns/crosses as the actual rig.
 return{x,y:top,z,width,depth,bodyCenter:input.bodyCenter,restFloor:.025-body.min.x,supportTriangles,footprintScale};
}
export interface CargoRootPose {readonly x:number;readonly y:number;readonly z:number;readonly yaw:number}
/** Same upright -> resting affine transform as SpeciesRig, then growth/yaw
 * once. Unlike the current layer's formula this also handles nonzero torso X. */
export function cargoBackPoint(back:Pick<AnimalCargoBack,'x'|'y'|'z'|'bodyCenter'|'restFloor'>,pose:CargoRootPose,growth:number,resting:boolean,clearance=.025,target=new THREE.Vector3()):THREE.Vector3 {
 if(![pose.x,pose.y,pose.z,pose.yaw,growth,clearance].every(Number.isFinite)||growth<0)throw Error('Invalid presentation-only cargo transform');
 const localX=resting?back.bodyCenter-back.y-clearance:back.x,localY=resting?back.x+back.restFloor:back.y+clearance,c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
 return target.set(pose.x+(localX*c+back.z*s)*growth,pose.y+localY*growth,pose.z+(back.z*c-localX*s)*growth);
}

/** Immutable eight-number attachment in compiled adult bind units. Width/depth
 * and clearance are scaled by the current real animal growth exactly once. */
export type CompiledAnimalCargoBack=readonly [x:number,y:number,z:number,width:number,depth:number,bodyCenter:number,restFloor:number,footprintScale:number];
export function cargoBackMetadata(back:AnimalCargoBack):CompiledAnimalCargoBack{return Object.freeze([back.x,back.y,back.z,back.width,back.depth,back.bodyCenter,back.restFloor,back.footprintScale] as const);}
/** Fit the actual item-variant rectangle inside the animal's allowed footprint,
 * then clip only that rectangle to the real torso planes. Called once per
 * species/variant batch, never per frame. Growth multiplies both rectangles
 * equally, so it does not change this adult-bind-space result. */
export function fitAnimalCargoBack(base:CompiledAnimalCargoBack,torsoTriangles:Float32Array,itemWidth:number,itemDepth:number):CompiledAnimalCargoBack|undefined {
 if(!Number.isFinite(itemWidth)||!Number.isFinite(itemDepth)||itemWidth<=0||itemDepth<=0||!torsoTriangles.length||torsoTriangles.length%9)return;
 const fit=Math.min(1,base[3]/itemWidth,base[4]/itemDepth),width=itemWidth*fit,depth=itemDepth*fit;
 const support=footprintTop(torsoTriangles,base[0],base[2],width,depth);if(!support)return;
 return Object.freeze([base[0],support.top,base[2],width,depth,base[5],base[6],base[7]*fit] as const);
}
/** Allocation-free equivalent of cargoBackPoint for cached compiled metadata. */
export function compiledCargoBackPoint(back:CompiledAnimalCargoBack,pose:CargoRootPose,growth:number,resting:boolean,target:THREE.Vector3,clearance=.025):THREE.Vector3 {
 if(!Number.isFinite(pose.x)||!Number.isFinite(pose.y)||!Number.isFinite(pose.z)||!Number.isFinite(pose.yaw)||!Number.isFinite(growth)||!Number.isFinite(clearance)||growth<0)throw Error('Invalid presentation-only cargo transform');
 const localX=resting?back[5]-back[1]-clearance:back[0],localY=resting?back[0]+back[6]:back[1]+clearance,c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
 return target.set(pose.x+(localX*c+back[2]*s)*growth,pose.y+localY*growth,pose.z+(back[2]*c-localX*s)*growth);
}
