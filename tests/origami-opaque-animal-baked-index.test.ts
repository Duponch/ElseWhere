/** Actual raccoon/template/binding/clinical union/growPawnBuffers. The compiler
 * provides TEST storage only; no raster, shader, appearance or GPU claim. */
import {test,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {positionLocal} from 'three/tsl';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {indexExactStaticVertices} from '../src/render/origami/static-index';
import {ActorPartUnionIndex,readAnimalPartUnion} from '../src/render/origami/actor-part-union';
import {growPawnBuffers} from '../src/render/pawn-buffers';
import {BakedAnimalLibrary,prepareAnimalAtlasBinding,type AnimalBakeRequest,type AnimalAtlasCompiler} from '../src/render/origami/baked/animal-baked';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const MiB=1024*1024;
const instanced=(a:Attribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
const compiler:AnimalAtlasCompiler=input=>{
 const{width,height,mipLevels}=input.charts.atlas,mips=Array.from({length:mipLevels},(_,level)=>({data:new Uint8Array(width*height*4/4**level),width:width/2**level,height:height/2**level}));
 const map=new THREE.DataTexture(mips[0]!.data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.generateMipmaps=false;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.mipmaps=mips;
 const bytes=mips.reduce((n,m)=>n+m.data.byteLength,0);return{texture:map,cpuBytes:bytes,gpuBytes:bytes,stats:{testOnly:true,noRaster:true},dispose(){map.dispose();}};
};
/** Raw stored words, not float equality: signed zero and NaN payload survive. */
function records(g:THREE.BufferGeometry,indices:readonly number[]){
 return Object.fromEntries(Object.entries(g.attributes).filter(([,a])=>!instanced(a)).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>{
  if(!(a.array instanceof Float32Array))throw Error('Expected actual Float32 actor attribute '+name);
  const words=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length),stride=a instanceof THREE.InterleavedBufferAttribute?a.data.stride:a.itemSize,offset=a instanceof THREE.InterleavedBufferAttribute?a.offset:0;
  return[name,indices.flatMap(i=>Array.from({length:a.itemSize},(_,c)=>words[i*stride+offset+c]!))];
 }));
}
const visibleIndices=(g:THREE.BufferGeometry)=>Array.from(g.index!.array).slice(g.drawRange.start,Math.min(g.index!.count,g.drawRange.start+g.drawRange.count));

test('atlas indexing reuses exact records while retaining every ordered chart/source corner, native clinical gate and actual grown owner stream',async()=>{
 const source=origamiAnimalPresentationGeometry(2,'raccoon',false);if(!source)throw Error('Actual raccoon unavailable');indexExactStaticVertices(source);source.instanceCount=2;
 const library=new BakedAnimalLibrary({cpuBytes:128*MiB,gpuBytes:64*MiB}),rgba=new Uint8Array(16).fill(255),profile={pigment:rgba,paper:rgba,coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up' as const};
 const options:AnimalBakeRequest={recipeFingerprint:'TEST-index-actual-raccoon',paletteFingerprint:'TEST-unused-storage',paintFingerprint:'TEST0',compiler,compilerFingerprint:'TEST-storage-no-raster',impasto:0,wear:0,edgeWidth:1.7,strokeImperfection:.15,chartOptions:{texelsPerUnit:16,paddingTexels:1,mipLevels:1,maxAtlasSize:2048,maxAtlasPixels:2048*2048,maxOutputBytes:32*MiB,maxTriangles:20000},paint:{readProfile:()=>profile,edgeAlpha:{data:rgba,width:2,height:2},brushColorLinear:[0,0,0],lineOpacity:.79,strokeImperfection:.15},reservation:{cpuBytes:64*MiB,gpuBytes:32*MiB}};
 const lease=await library.acquire('raccoon',options),resource=lease.resource,cornerCount=resource.sourceVertex.length,identity=Array.from({length:cornerCount},(_,i)=>i),templateRecords=records(resource.geometry,identity),sourceVertex=resource.sourceVertex.slice(),triangleChart=resource.triangleChart.slice();
 const material=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true});material.positionNode=positionLocal;material.normalNode=null;
 const ribbons=new THREE.Group(),binding=prepareAnimalAtlasBinding(lease,source,material,base=>base,{isCurrent:()=>true,adoptConfiguredClone:()=>true,warmup:async()=>{},publish:()=>{throw Error('This index contract never publishes');},ribbons});
 let baseline:THREE.InstancedBufferGeometry|undefined,union:ActorPartUnionIndex|undefined,baselineUnion:ActorPartUnionIndex|undefined;
 try{
  const geometry=binding.geometry,index=Array.from(geometry.index!.array),buffers=Object.fromEntries(Object.entries(resource.geometry.attributes).filter(([,a])=>!instanced(a)).map(([name,a])=>[name,a.array]));
  expect(index).toHaveLength(cornerCount);expect(new Set(index).size).toBeLessThan(cornerCount);expect(index.some((v,i)=>v!==i)).toBe(true);
  expect(records(geometry,index)).toEqual(templateRecords);expect(resource.geometry.index).toBeNull();
  for(const[name,array]of Object.entries(buffers))expect(geometry.getAttribute(name).array).toBe(array);
  expect(binding.sourceVertex).toBe(resource.sourceVertex);expect(binding.sourceVertex).toEqual(sourceVertex);expect(resource.triangleChart).toEqual(triangleChart);
  // Same whole template, identity index: independent baseline for the real
  // clinical controller. Every indexed corner must retain its complete record.
  baseline=geometry.clone();baseline.setIndex(new THREE.BufferAttribute(Uint32Array.from(identity),1));baselineUnion=new ActorPartUnionIndex(baseline,'animal');union=new ActorPartUnionIndex(geometry,'animal');
  const parts=source.getAttribute('animalPart'),legVertex=Array.from({length:parts.count},(_,v)=>v).find(v=>[1,2].includes(parts.getX(v))&&parts.getY(v)>0);if(legVertex===undefined)throw Error('Actual native leg gate absent');const legBit=parts.getY(legVertex);
  for(const[dead,absent]of [[false,0],[true,0],[false,legBit]] as const){
   for(const g of [geometry,baseline])for(let i=0;i<2;i++){g.getAttribute('aAnimal').setZ(i,dead?2:0);g.getAttribute('aBiology').setZ(i,absent);}
   union.reconcile(readAnimalPartUnion(geometry,2));baselineUnion.reconcile(readAnimalPartUnion(baseline,2));
   expect(records(geometry,visibleIndices(geometry))).toEqual(records(baseline,visibleIndices(baseline)));expect(geometry.drawRange.count).toBe(baseline.drawRange.count);
  }
  union.dispose();union=undefined;baselineUnion.dispose();baselineUnion=undefined;expect(Array.from(geometry.index!.array)).toEqual(index);
  // Actual growth clones this canonical index and relinks owner aliases. No
  // re-indexing or per-actor chart remap is needed when capacity changes.
  const oldOwner=geometry.getAttribute('aFrom'),mesh=new THREE.Mesh(geometry,binding.material);growPawnBuffers([mesh],129);const grown=mesh.geometry as THREE.InstancedBufferGeometry;binding.adoptGrownGeometry(grown);grown.instanceCount=129;
  expect(grown.getAttribute('aFrom').count).toBe(256);expect(grown.getAttribute('aFrom')).not.toBe(oldOwner);expect(Array.from(grown.index!.array)).toEqual(index);expect(records(grown,index)).toEqual(templateRecords);
  expect(binding.sourceVertex).toEqual(sourceVertex);expect(resource.triangleChart).toEqual(triangleChart);for(const[name,array]of Object.entries(buffers))expect(resource.geometry.getAttribute(name).array).toBe(array);
 }finally{union?.dispose();baselineUnion?.dispose();baseline?.dispose();binding.dispose();library.evictUnused();library.dispose();material.dispose();source.dispose();for(const key of ['origamiLines','origamiWear']){const g=source.userData[key];if(g instanceof THREE.BufferGeometry)g.dispose();}}
});
