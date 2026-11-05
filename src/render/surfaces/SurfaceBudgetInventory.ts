/** Preparation-only nominal inventory. This is not driver/device VRAM.
 * Fixed renderer targets and internal pipeline caches remain outside this ledger. */
import * as THREE from 'three/webgpu';
export interface SurfaceBudgetInventory {
 readonly textures:readonly THREE.Texture[];
 readonly gpuBufferBytes:number;
 readonly cpuBytes:number;
 readonly complete:boolean;
 readonly scope:string;
}
export interface SurfaceBudgetResult {
 readonly complete:boolean;readonly gpuBytes:number|null;readonly cpuBytes:number|null;
 readonly textureCount:number;readonly bufferCount:number;readonly objectCount:number;
 readonly scope:string;readonly refusal?:string;
}
const valid=(n:number)=>Number.isSafeInteger(n)&&n>=0;
/** Exact nominal dimensions/format/mips; unknown formats cannot count as zero. */
export function nominalSurfaceTextureBytes(t:THREE.Texture):number|null {
 const image=t.image as {width?:number;height?:number;depth?:number}|undefined;
 const channels=t.format===THREE.RGBAFormat?4:t.format===THREE.RGFormat?2:t.format===THREE.RedFormat?1:undefined;
 const scalar=t.type===THREE.UnsignedByteType?1:t.type===THREE.FloatType||t.type===THREE.UnsignedIntType||t.type===THREE.IntType?4:t.type===THREE.HalfFloatType||t.type===THREE.UnsignedShortType||t.type===THREE.ShortType?2:undefined;
 if(!image||!valid(image.width??-1)||!valid(image.height??-1)||!image.width||!image.height||!valid(image.depth??1)||!(image.depth??1)||!channels||!scalar||Reflect.get(t,'isCompressedTexture')===true)return null;
 let w=image.width,h=image.height,n=0;
 const levels=t.generateMipmaps?1+Math.floor(Math.log2(Math.max(w,h))):Math.max(1,t.mipmaps.length);
 if(levels>32)return null;
 for(let l=0;l<levels;l++){
  n+=w*h*(image.depth??1)*channels*scalar;if(!valid(n))return null;
  w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));
 }
 return n;
}
const mapFields=['map','alphaMap','normalMap','bumpMap','roughnessMap','metalnessMap','aoMap','emissiveMap','lightMap','displacementMap']as const;
/** Bounded census invoked only by a staged preparation. Resource identities,
 * interleaved buffers, shared geometries and textures are counted once. The
 * inventory adapters supply owned/staged resources absent from the live Scene. */
export function measureSurfaceBudget(root:THREE.Object3D,inventories:readonly SurfaceBudgetInventory[],exclude:ReadonlySet<THREE.Object3D>=new Set()):SurfaceBudgetResult {
 const textures=new Set<THREE.Texture>(),buffers=new Set<object>(),pixelBuffers=new Set<ArrayBufferLike>(),objects=new Set<THREE.Object3D>(),stack=[root];let gpu=0,cpu=0,refusal:string|undefined;
 const reject=(reason:string)=>{refusal??=reason;};
 const add=(g:number,c:number)=>{if(!valid(g)||!valid(c)||!valid(gpu+g)||!valid(cpu+c)){reject('Unknown or overflowing nominal surface bytes');return;}gpu+=g;cpu+=c;};
 const texture=(t:THREE.Texture)=>{if(textures.has(t))return;textures.add(t);if(textures.size>65536){reject('Surface texture census bound exceeded');return;}const n=nominalSurfaceTextureBytes(t);if(n===null)reject('Unknown surface texture shape/format');else add(n,0);
  const image=t.image as {data?:unknown}|undefined;
  for(const data of[image?.data,...t.mipmaps.map(m=>(m as {data?:unknown}).data)])if(ArrayBuffer.isView(data)&&!pixelBuffers.has(data.buffer)){pixelBuffers.add(data.buffer);add(0,data.buffer.byteLength);}
 };
 const attribute=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute|undefined)=>{
  if(!a)return;const resource=a instanceof THREE.InterleavedBufferAttribute?a.data:a;
  if(buffers.has(resource))return;buffers.add(resource);
  if(buffers.size>131072){reject('Surface buffer census bound exceeded');return;}
  const array=resource.array;if(!ArrayBuffer.isView(array)){reject('Unknown surface buffer allocation');return;}add(array.byteLength,array.byteLength);
 };
 for(const inventory of inventories){if(!inventory.complete)reject('Incomplete surface owner inventory: '+inventory.scope);add(inventory.gpuBufferBytes,inventory.cpuBytes);for(const t of inventory.textures)texture(t);}
 while(stack.length){
  const object=stack.pop()!;if(exclude.has(object)||objects.has(object))continue;objects.add(object);
  if(objects.size>100000){reject('Surface object census bound exceeded');break;}
  const geometry=Reflect.get(object,'geometry')as unknown;
  if(geometry instanceof THREE.BufferGeometry){for(const a of Object.values(geometry.attributes)){if(a instanceof THREE.BufferAttribute||a instanceof THREE.InterleavedBufferAttribute)attribute(a);else reject('Unknown surface geometry attribute');}attribute(geometry.index??undefined);}
  if(object instanceof THREE.InstancedMesh){attribute(object.instanceMatrix);attribute(object.instanceColor??undefined);}
  const material:unknown=Reflect.get(object,'material');
  for(const m of Array.isArray(material)?material:material?[material]:[])if(m instanceof THREE.Material)for(const key of mapFields){const map:unknown=Reflect.get(m,key);if(map instanceof THREE.Texture)texture(map);}
  stack.push(...object.children);
 }
 const complete=!refusal;
 return{complete,gpuBytes:complete?gpu:null,cpuBytes:complete?cpu:null,textureCount:textures.size,bufferCount:buffers.size,objectCount:objects.size,scope:'Nominal held Source/atlas/lookup/canonical/scene geometry and explicit material/paint textures; fixed renderer targets, internal caches and driver VRAM excluded. Preparation only.',...(refusal?{refusal}:{})};
}
