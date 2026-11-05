/** PRIVATE pure one-fetch Standard representation. Owns no model or atlas. */
import * as THREE from 'three/webgpu';
import {Fn,If,float,int,mix,sharedUniformGroup,storage,texture,uint,uniform,varying,vec3,vec4} from 'three/tsl';
import type {GraphicsStyleContext} from '../../../graphics-style';
import {copyPastelTextureToArray} from '../../../surfaces/TextureSurface';
import {ActorAtlasAdmissionRefusal,type ActorAtlasPlan} from './ActorAtlasSchema';
export interface ActorAtlasAddressCohort {readonly key:number;readonly signature:string;readonly faces:readonly{face:number;tile:number;rawBounds:readonly[number,number,number,number]}[]}
export interface ActorTextureAssets {readonly texture:THREE.Texture;readonly plan:ActorAtlasPlan;readonly cohorts:readonly ActorAtlasAddressCohort[];assertCurrent():void}
export interface ActorTextureSurfaceOptions {
 readonly context:GraphicsStyleContext;readonly sourceMaterial:THREE.MeshStandardNodeMaterial;
 readonly pastelTexture:THREE.DataTexture;readonly pastelUv:THREE.Node<'vec2'>;
 readonly pastelFromSample:(sample:THREE.Node<'vec4'>)=>THREE.Node<'vec3'>;
 readonly faceId:THREE.Node<'float'>;readonly faceUv:THREE.Node<'vec2'>;
 readonly appearanceKey:THREE.Node<'uint'>;readonly faceCount:number;
 readonly maxAddressBytes?:number;readonly configure?:(material:THREE.MeshStandardNodeMaterial)=>void;
}
const MAX_PROBES=8,MAX_BINDING_BYTES=128*1024*1024;
const hash=(key:number,mask:number)=>{const x=(key^(key>>>7)^(key>>>14))>>>0;return(Math.imul(x,0x9e3779b1)>>>0)&mask;};
/** Header/hash/rects share ONE vertex-only SSBO. Size follows actual cohorts
 * and binding/memory budgets; no three-pawn ceiling or profile Cartesian set. */
export function compileActorAddressData(faceCount:number,assets:ActorTextureAssets,maxBytes=MAX_BINDING_BYTES){
 assets.assertCurrent();if(!Number.isSafeInteger(maxBytes)||maxBytes<256||maxBytes>MAX_BINDING_BYTES||!Number.isSafeInteger(faceCount)||faceCount<1||!assets.cohorts.length)throw new ActorAtlasAdmissionRefusal('Actual whole-actor address/binding budget required');
 const size=assets.plan.size,image=assets.texture.image as{width?:number;height?:number;depth?:number};if(!(assets.texture.isArrayTexture||assets.texture instanceof THREE.DataArrayTexture)||![128,256,512,1024,2048].includes(size)||image.width!==size||image.height!==size||image.depth!==assets.plan.pages||assets.texture.flipY||assets.texture.type!==THREE.UnsignedByteType||assets.texture.format!==THREE.RGBAFormat||assets.texture.minFilter!==THREE.LinearMipmapLinearFilter||assets.texture.magFilter!==THREE.LinearFilter)throw Error('Prepared actor RGBA array shape mismatch');
 const keys=new Set<number>();for(const c of assets.cohorts){if(!Number.isSafeInteger(c.key)||c.key<0||c.key>0xffffffff||keys.has(c.key))throw Error('Distinct exact actor appearance key required');keys.add(c.key);if(c.faces.length!==faceCount||new Set(c.faces.map(f=>f.face)).size!==faceCount)throw new ActorAtlasAdmissionRefusal('Every actual actor face must map; partial actors refused');}
 let hashSize=2**Math.ceil(Math.log2(Math.max(2,assets.cohorts.length*2))),entries:number[][]=[],maximumProbes=0;
 for(;;){const required=(1+hashSize+faceCount*assets.cohorts.length*2)*16;if(!Number.isSafeInteger(required)||required>maxBytes)throw new ActorAtlasAdmissionRefusal('Actual actor metadata budget exceeded BEFORE allocation');entries=Array.from({length:hashSize},()=>[]);let failed=false;maximumProbes=0;for(const[c,cohort]of assets.cohorts.entries()){let probe=0;for(;probe<MAX_PROBES;probe++){const bucket=(hash(cohort.key,hashSize-1)+probe)&(hashSize-1);if(!entries[bucket]!.length){entries[bucket]=[(cohort.key&65535)+1,cohort.key>>>16,c*faceCount,1];break;}}if(probe===MAX_PROBES){failed=true;break;}maximumProbes=Math.max(maximumProbes,probe+1);}if(!failed)break;hashSize*=2;}
 const rectBase=1+hashSize,data=new Float32Array((rectBase+faceCount*assets.cohorts.length*2)*4);data.set([hashSize-1,rectBase,faceCount,1]);for(let i=0;i<entries.length;i++)if(entries[i]!.length)data.set(entries[i]!,4+i*4);
 for(const[c,cohort]of assets.cohorts.entries())for(const r of cohort.faces){const tile=assets.plan.tiles[r.tile],face=r.face,[u0,v0,u1,v1]=r.rawBounds;if(!Number.isSafeInteger(face)||face<0||face>=faceCount||!tile||!(u1>u0)||!(v1>v0)||![u0,v0,u1,v1].every(Number.isFinite))throw Error('Actual face/chart address invalid');const sx=tile.content.width/(size*(u1-u0)),sy=tile.content.height/(size*(v1-v0)),at=(rectBase+(c*faceCount+face)*2)*4;data.set([sx,sy,tile.content.x/size-u0*sx,tile.content.y/size-v0*sy,tile.page,1,0,0],at);}
 return{data,maximumProbes,keys:Object.freeze([...keys]),cpuBytes:data.byteLength,gpuBytes:data.byteLength,hashSize};
}
/** Same material first Pastel and all encodings. Source paint/ink is absent FS. */
export class ActorTextureSurface {
 readonly material:THREE.MeshStandardNodeMaterial;readonly pastel:THREE.DataArrayTexture;
 private readonly group=sharedUniformGroup('actorOneReadAssets',0,null);private readonly encoded=uniform(0).setGroup(this.group);
 private data=new Float32Array(16);private attribute=new THREE.StorageBufferAttribute(this.data,4);private readonly metadata=storage(this.attribute,'vec4',0).toReadOnly();
 private readonly allocations=[this.attribute];private allocatedGpuUpperBoundBytes=this.data.byteLength;
 private readonly sample:THREE.TextureNode;private readonly pureColor:THREE.Node<'vec3'>;private mode:'pure'|'source'='pure';private faceCount:number;private active:ActorTextureAssets|undefined;private prepared:ActorTextureAssets|undefined;private closed=false;
 constructor(readonly options:ActorTextureSurfaceOptions){
  if(!Number.isSafeInteger(options.faceCount)||options.faceCount<1)throw Error('Actual complete actor face count required');this.faceCount=options.faceCount;const pastelSize=options.pastelTexture.image.width;if(pastelSize!==64&&pastelSize!==256)throw Error('Actual human64 or animal256 Pastel source required');this.pastel=copyPastelTextureToArray(options.pastelTexture,pastelSize);
  const chart=Fn(()=>{const result=vec3(0).toVar();If(this.encoded.greaterThan(0),()=>{const header=this.metadata.element(int(0)),mask=header.x.toUint(),key=options.appearanceKey,x=key.bitXor(key.shiftRight(uint(7))).bitXor(key.shiftRight(uint(14))),bucket=x.mul(uint(0x9e3779b1)).bitAnd(mask),lo=key.bitAnd(uint(65535)).add(uint(1)).toFloat(),hi=key.shiftRight(uint(16)).toFloat(),found=float(0).toVar(),base=float(0).toVar();for(let probe=0;probe<MAX_PROBES;probe++)If(found.equal(0),()=>{const row=this.metadata.element(int(bucket.add(uint(probe)).bitAnd(mask)).add(1));If(row.x.equal(lo).and(row.y.equal(hi)).and(row.w.equal(1)),()=>{base.assign(row.z);found.assign(1);});});const at=int(header.y).add(int(base.add(options.faceId)).mul(2)),a=this.metadata.element(at),b=this.metadata.element(at.add(1));result.assign(vec3(options.faceUv.mul(a.xy).add(a.zw),b.x));});return result;})();
  const xy=varying(mix(options.pastelUv,chart.xy,this.encoded),'v_actorOneReadUv'),layer=varying(chart.z,'v_actorOneReadLayer').setInterpolation('flat','first');this.sample=texture(this.pastel,xy).depth(layer);
  const s=options.sourceMaterial,m=new THREE.MeshStandardNodeMaterial();m.copy(s);m.userData={...s.userData};m.vertexColors=false;this.material=m;
  this.pureColor=Fn(()=>{const read=vec4(0).toVar();read.assign(this.sample);const result=vec3(0).toVar();If(this.encoded.equal(0),()=>{result.assign(options.pastelFromSample(read));}).Else(()=>{result.assign(read.rgb);});return result;})();
  try{if(options.configure){m.outputNode=null;m.maskNode=null;m.maskShadowNode=null;options.configure(m);}for(const key of['positionNode','normalNode','maskNode','maskShadowNode','outputNode','opacityNode','castShadowPositionNode','receivedShadowPositionNode','roughnessNode','metalnessNode','lightsNode']as const)Reflect.set(m,key,Reflect.get(s,key));m.colorNode=this.pureColor;}catch(error){m.dispose();this.pastel.dispose();throw error;}
 }
 get assets(){return this.active;}get encoding(){return this.encoded.value;}
 setModelDomain(faceCount:number):void{if(!Number.isSafeInteger(faceCount)||faceCount<1)throw Error('Actual complete face domain required');if(faceCount!==this.faceCount){this.faceCount=faceCount;this.prepared=undefined;}}
 /** Explicit JS representation boundary under the existing prepare/compile hold.
  * UUID stays fixed. Source is never hidden behind a uniform in the pure shader. */
 selectRepresentation(mode:'pure'|'source'):void{if(this.closed)throw Error('Actor surface retired');const s=this.options.sourceMaterial,m=this.material,color=mode==='pure'?this.pureColor:s.colorNode,normal=s.normalNode;let changed=this.mode!==mode||m.colorNode!==color||m.normalNode!==normal;for(const key of['positionNode','castShadowPositionNode','receivedShadowPositionNode','maskNode','maskShadowNode','outputNode','opacityNode','roughnessNode','metalnessNode','lightsNode','side','transparent','depthTest','depthWrite','alphaTest','flatShading','roughness','metalness','opacity']as const)if(Reflect.get(m,key)!==Reflect.get(s,key)){Reflect.set(m,key,Reflect.get(s,key));changed=true;}if(!changed)return;this.mode=mode;m.colorNode=color;m.normalNode=normal;m.normalMap=s.normalMap;m.bumpMap=s.bumpMap;m.normalScale.copy(s.normalScale);m.userData={...s.userData};m.needsUpdate=true;}
 setAssets(assets:ActorTextureAssets|undefined):void{
  if(this.closed)throw Error('Actor surface retired');if(assets){if(this.prepared!==assets){const next=compileActorAddressData(this.faceCount,assets,this.options.maxAddressBytes);let size=this.data.byteLength;while(size<next.data.byteLength)size*=2;if(size>(this.options.maxAddressBytes??MAX_BINDING_BYTES))throw new ActorAtlasAdmissionRefusal('Actor address growth refused before allocation');if(size!==this.data.byteLength){this.data=new Float32Array(size/4);this.attribute=new THREE.StorageBufferAttribute(this.data,4);this.metadata.value=this.attribute;this.allocations.push(this.attribute);this.allocatedGpuUpperBoundBytes+=size;}this.data.fill(0);this.data.set(next.data);this.attribute.needsUpdate=true;this.prepared=assets;}this.sample.value=assets.texture;this.encoded.value=1;}else{this.sample.value=this.pastel;this.encoded.value=0;}this.group.needsUpdate=true;this.active=assets;
 }
 assertReady(keys:readonly number[]):void{if(this.closed)throw Error('Actor surface retired');if(!this.options.context.origami)return;this.active?.assertCurrent();if(!this.active||this.encoded.value!==1||keys.some(key=>!this.active!.cohorts.some(c=>c.key===key)))throw Error('Admit complete Gouache actors or choose Source');}
 snapshot(){return{representation:this.mode,faceCount:this.faceCount,capacityCpuBytes:this.data.byteLength,allocatedGpuUpperBoundBytes:this.allocatedGpuUpperBoundBytes,pastelCpuBytes:this.pastel.image.data!.byteLength,pastelGpuBytes:(this.pastel.image.width*this.pastel.image.height*4-1)/3*8,metadataGpuLifetime:'renderer-or-terminal-real-geometry',encoding:this.encoded.value};}
 /** Terminal only before actual initialized producer geometries are disposed.
  * r186 otherwise retains element-only buffers until renderer/device teardown. */
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{for(const g of new Set(geometries))for(const a of this.allocations)g.setAttribute('actorAtlasTerminal'+a.id,a);}
 dispose():void{if(this.closed)return;const failures:unknown[]=[];for(const close of[()=>this.material.dispose(),()=>this.pastel.dispose(),()=>this.metadata.dispose()])try{close();}catch(error){failures.push(error);}if(failures.length)throw new AggregateError(failures,'Actor surface close quarantine');this.closed=true;this.active=undefined;this.prepared=undefined;}
}
