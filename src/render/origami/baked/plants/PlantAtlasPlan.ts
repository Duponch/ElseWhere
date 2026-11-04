/** Source card topology with bounded approximate aspect bins. */
import * as THREE from 'three/webgpu';
import {packMaxRectsNoRotation} from '../rectangle-pack';
import {SURFACE_STROKE_FACE,SURFACE_STROKE_UV} from '../../../surfaces/NaturalSurfaceModels';
export const PLANT_ATLAS_SIZE=2048,PLANT_ATLAS_LEVELS=4,PLANT_ATLAS_BINS=16;
/** Only explicit validation/reservation failures BEFORE GPU allocation may
 * retain Source as an optional-cache refusal. GPU/runtime errors propagate. */
export class PlantAtlasAdmissionRefusal extends Error {readonly beforeGpuAllocation=true;}
export const PLANT_PAGE_BYTES=2048*2048*4*(1+1/4+1/16+1/64);
export interface PlantAtlasRect {x:number;y:number;width:number;height:number}
export interface PlantAtlasFace {id:number;triangles:readonly number[];rawBounds:readonly[number,number,number,number];basisU:readonly[number,number,number];basisV:readonly[number,number,number];ratioMin:number;ratioMax:number}
export interface PlantAtlasTile {face:number;bin:number;page:number;rect:PlantAtlasRect;content:PlantAtlasRect;ratio:number;aspect:number}
export interface PlantAtlasPlan {
 readonly size:2048;readonly levels:4;readonly bins:16;readonly pages:1|2;readonly depth:2|4;readonly geometry:THREE.BufferGeometry;
 readonly faces:readonly PlantAtlasFace[];readonly tiles:readonly PlantAtlasTile[];readonly key:string;
 readonly retainedGpuBytes:number;readonly peakGpuBytes:number;readonly maxCpuBytes:number;readonly addressRows:Float32Array;
 readonly worstRestMetricError:number;readonly existingLiveGpuBytes:number;
}
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((n,v,i)=>n+v*b[i]!,0),norm=(v:readonly number[])=>Math.hypot(...v),scaled=(v:readonly number[],s:readonly number[])=>v.map((x,i)=>x*s[i]!);
const size=2048,padding=8,quantum=8,align=(n:number)=>Math.ceil(n/quantum)*quantum;
/** Entire authored interval; uniform growth and rigid yaw cancel this ratio. */
const scales=([.78,1.12]as const).flatMap(w=>([.46*.88,.78*1.12]as const).map(h=>[w,h,1.12-w*.12]as const));
export function plantFaceRatio(face:PlantAtlasFace,scale:readonly[number,number,number]):number{
 if(scale.some(v=>!Number.isFinite(v)||v<=0))throw new PlantAtlasAdmissionRefusal('Positive finite plant scale required');return norm(scaled(face.basisU,scale))/norm(scaled(face.basisV,scale));
}
export function plantFaceBin(face:PlantAtlasFace,scale:readonly[number,number,number]):number{
 const ratio=plantFaceRatio(face,scale),lo=face.ratioMin,hi=face.ratioMax;if(ratio<lo*(1-1e-5)||ratio>hi*(1+1e-5))throw new PlantAtlasAdmissionRefusal('Plant shape outside admitted metric domain');
 return Math.max(0,Math.min(15,Math.round((Math.log(ratio)-Math.log(lo))/(Math.log(hi)-Math.log(lo)||1)*15)));
}
/** Two exact uint32 words carry sixteen four-bit face-bin indices. This is
 * called by the existing placement writer, never from a frame/LOD traversal. */
export function packPlantFaceBins(plan:PlantAtlasPlan,scale:readonly[number,number,number]):readonly[number,number]{
 const words=[0,0];for(const face of plan.faces){const word=face.id>>>3,shift=(face.id&7)*4;words[word]=(words[word]!|(plantFaceBin(face,scale)<<shift))>>>0;}return[words[0]!,words[1]!];
}
export function planPlantAtlas(geometry:THREE.BufferGeometry,limits:{maxCpuBytes:number;maxPeakGpuBytes:number;existingLiveGpuBytes:number}):PlantAtlasPlan{
 for(const n of Object.values(limits))if(!Number.isSafeInteger(n)||n<0)throw new PlantAtlasAdmissionRefusal('Explicit plant atlas budgets required');
 const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),strokeUv=geometry.getAttribute(SURFACE_STROKE_UV),faceIds=geometry.getAttribute(SURFACE_STROKE_FACE),index=geometry.index,total=index?.count??p.count;
 if(!uv||!strokeUv||!faceIds||total%3||total/3>32)throw new PlantAtlasAdmissionRefusal('Actual bounded Source tuft with UV/face IDs required');
 const color=geometry.getAttribute('color');if(!color||Array.from({length:color.count},(_,v)=>[color.getX(v),color.getY(v),color.getZ(v)]).flat().some(value=>value!==1))throw new PlantAtlasAdmissionRefusal('Source tuft white body vocabulary required before instance tint');
 for(let v=0;v<p.count;v++)if(Math.abs(uv.getX(v)-strokeUv.getX(v))>1e-7||Math.abs(uv.getY(v)-strokeUv.getY(v))>1e-7)throw new PlantAtlasAdmissionRefusal('First plant atlas requires identical actual body/stroke UV domain');
 const groups=new Map<number,number[]>();for(let t=0;t<total/3;t++){const v=index?.getX(t*3)??t*3,id=faceIds.getX(v);if(!Number.isSafeInteger(id)||id<0||id>=16)throw new PlantAtlasAdmissionRefusal('Plant face does not fit packed domain');for(let c=1;c<3;c++)if(faceIds.getX(index?.getX(t*3+c)??t*3+c)!==id)throw new PlantAtlasAdmissionRefusal('Plant triangle crosses a Source face');const old=groups.get(id);if(old)old.push(t);else groups.set(id,[t]);}
 const faces:PlantAtlasFace[]=[];
 for(const[id,triangles]of [...groups].sort((a,b)=>a[0]-b[0])){
  if(id!==faces.length)throw new PlantAtlasAdmissionRefusal('Contiguous Source plant faces required');const bounds=[Infinity,Infinity,-Infinity,-Infinity];let u:readonly[number,number,number]|undefined,v:readonly[number,number,number]|undefined;
  for(const t of triangles){const ids=[0,1,2].map(c=>index?.getX(t*3+c)??t*3+c),points=ids.map(i=>[p.getX(i),p.getY(i),p.getZ(i)]),coords=ids.map(i=>[uv.getX(i),uv.getY(i)]),du=coords[1]![0]!-coords[0]![0]!,dv=coords[1]![1]!-coords[0]![1]!,eu=coords[2]![0]!-coords[0]![0]!,ev=coords[2]![1]!-coords[0]![1]!,det=du*ev-dv*eu;if(Math.abs(det)<1e-20)throw new PlantAtlasAdmissionRefusal('Singular actual plant UV face');
   const bu=points[0]!.map((_,k)=>((points[1]![k]!-points[0]![k]!)*ev-(points[2]![k]!-points[0]![k]!)*dv)/det)as[number,number,number],bv=points[0]!.map((_,k)=>((points[2]![k]!-points[0]![k]!)*du-(points[1]![k]!-points[0]![k]!)*eu)/det)as[number,number,number];
   if(u&&bu.some((x,k)=>Math.abs(x-u![k]!)>1e-5)||v&&bv.some((x,k)=>Math.abs(x-v![k]!)>1e-5))throw new PlantAtlasAdmissionRefusal('Non-affine Source face cannot use a single aspect bin');u=bu;v=bv;
   for(const q of coords){bounds[0]=Math.min(bounds[0]!,q[0]!);bounds[1]=Math.min(bounds[1]!,q[1]!);bounds[2]=Math.max(bounds[2]!,q[0]!);bounds[3]=Math.max(bounds[3]!,q[1]!);}
  }
  const a=u!,b=v!,pure=(x:readonly number[],axis:number)=>x.every((value,k)=>k===axis||Math.abs(value)<1e-6),xy=(x:readonly number[])=>Math.abs(x[2]!)<1e-6;
  if(Math.abs(dot(a,b))>norm(a)*norm(b)*1e-6||!(pure(a,0)&&pure(b,1)||pure(a,1)&&pure(b,0)||pure(a,2)&&xy(b)||pure(b,2)&&xy(a)))throw new PlantAtlasAdmissionRefusal('Source tuft lost its orthogonal extruded-card metric domain');
  const ratios=scales.map(s=>norm(scaled(a,s))/norm(scaled(b,s)));faces.push({id,triangles:Object.freeze(triangles),rawBounds:bounds as[number,number,number,number],basisU:a,basisV:b,ratioMin:Math.min(...ratios),ratioMax:Math.max(...ratios)});
 }
 const tiles:PlantAtlasTile[]=[];let worstRestMetricError=0;
 for(const face of faces){const lo=Math.log(face.ratioMin),hi=Math.log(face.ratioMax);worstRestMetricError=Math.max(worstRestMetricError,Math.exp((hi-lo)/(4*15))-1);
  for(let bin=0;bin<16;bin++){const ratio=Math.exp(lo+(hi-lo)*bin/15),aspect=Math.sqrt(ratio),du=face.rawBounds[2]-face.rawBounds[0],dv=face.rawBounds[3]-face.rawBounds[1],w=Math.max(1,Math.ceil(512*du*Math.max(1,aspect))),h=Math.max(1,Math.ceil(512*dv*Math.max(1,1/aspect)));
   const width=align(w+2*padding),height=align(h+2*padding);if(width>size||height>size)throw new PlantAtlasAdmissionRefusal('Plant chart exceeds full-density page budget');tiles.push({face:face.id,bin,page:0,ratio,aspect,rect:{x:0,y:0,width,height},content:{x:padding,y:padding,width:w,height:h}});
  }
 }
 const pack=(ids:readonly number[])=>{if(ids.reduce((n,id)=>n+tiles[id]!.rect.width*tiles[id]!.rect.height,0)>size*size)return undefined;try{return packMaxRectsNoRotation(ids.map(id=>({id,width:tiles[id]!.rect.width,height:tiles[id]!.rect.height})),{width:size,height:size,quantum,maxPixels:size*size});}catch(error){if(error instanceof Error&&error.message.startsWith('MaxRects:'))throw new PlantAtlasAdmissionRefusal(error.message);throw error;}};
 const ids=tiles.map((_,i)=>i),single=pack(ids);let pages:1|2=1;
 const apply=(result:NonNullable<ReturnType<typeof pack>>,page:number)=>{for(const p of result.placements){const t=tiles[p.id]!;t.page=page;t.rect.x=p.x;t.rect.y=p.y;t.content.x=p.x+padding;t.content.y=p.y+padding;}};
 if(single)apply(single,0);else{pages=2;const buckets:number[][]=[[],[]],areas=[0,0];for(const id of [...ids].sort((a,b)=>tiles[b]!.rect.width*tiles[b]!.rect.height-tiles[a]!.rect.width*tiles[a]!.rect.height)){const page=areas[0]!<=areas[1]!?0:1;buckets[page]!.push(id);areas[page]!+=tiles[id]!.rect.width*tiles[id]!.rect.height;}for(let page=0;page<2;page++){const packed=pack(buckets[page]!);if(!packed)throw new PlantAtlasAdmissionRefusal('Full-density plant charts refused; no resolution reduction');apply(packed,page);}}
 // Three complete Source512 RGBA mip chains approach4MiB by themselves.
 // Include the compiled chart geometry as well, before GPU admission.
 const depth=(pages*2)as 2|4,retainedGpuBytes=depth*PLANT_PAGE_BYTES,peakGpuBytes=limits.existingLiveGpuBytes+retainedGpuBytes+PLANT_PAGE_BYTES+size*size*(32+16+1+2)+6*1024*1024,totalRows=faces.length+tiles.length*2,addressRows=new Float32Array(totalRows*4);
 if(retainedGpuBytes>85*1024*1024||peakGpuBytes>limits.maxPeakGpuBytes||addressRows.byteLength+total*16*128>limits.maxCpuBytes)throw new PlantAtlasAdmissionRefusal('Plant old-live/new/scratch budget refused BEFORE GPU allocation');
 for(const face of faces)addressRows.set([face.rawBounds[0],face.rawBounds[1],1/(face.rawBounds[2]-face.rawBounds[0]),1/(face.rawBounds[3]-face.rawBounds[1])],face.id*4);
 for(const tile of tiles){const row=faces.length+(tile.face*16+tile.bin)*2;addressRows.set([tile.content.x/size,tile.content.y/size,tile.content.width/size,tile.content.height/size],row*4);addressRows.set([tile.page*2,0,0,0],(row+1)*4);}
 return Object.freeze({size,levels:4,bins:16,pages,depth,geometry,faces:Object.freeze(faces),tiles:Object.freeze(tiles),key:JSON.stringify({version:'private-plant-BI-card16-v1',geometry:geometry.uuid,faces:faces.map(f=>[f.rawBounds,f.basisU,f.basisV,f.ratioMin,f.ratioMax]),tiles}),retainedGpuBytes,peakGpuBytes,maxCpuBytes:limits.maxCpuBytes,addressRows,worstRestMetricError,existingLiveGpuBytes:limits.existingLiveGpuBytes});
}
