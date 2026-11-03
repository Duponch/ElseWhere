/** Source ownership only. Real deer/owner growth; explicit TEST atlas pixels.
 * A disposal observer checks the attributes visible to Three's dispose event,
 * not merely the source's unchanged JavaScript references. No GPU claim. */
import {test,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {positionLocal} from 'three/tsl';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {indexExactStaticVertices} from '../src/render/origami/static-index';
import {growPawnBuffers} from '../src/render/pawn-buffers';
import {BakedAnimalLibrary,prepareAnimalAtlasBinding,type AnimalBakeRequest,type AnimalAtlasCompiler,type AnimalAtlasPublication} from '../src/render/origami/baked/animal-baked';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const MiB=1024*1024;
const isInstance=(a:Attribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
const bufferOwner=(a:Attribute)=>a instanceof THREE.InterleavedBufferAttribute?a.data:a;
function body():THREE.InstancedBufferGeometry{
  const g=origamiAnimalPresentationGeometry(2,'deer',false);if(!g)throw Error('Real deer absent');
  if(g.userData.origamiReference)indexExactStaticVertices(g);g.instanceCount=2;return g;
}
const compiler:AnimalAtlasCompiler=input=>{
  const{width,height,mipLevels}=input.charts.atlas;
  const mips=Array.from({length:mipLevels},(_,level)=>({data:new Uint8Array(width*height*4/4**level),width:width/2**level,height:height/2**level}));
  const map=new THREE.DataTexture(mips[0]!.data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
  map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.generateMipmaps=false;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.mipmaps=mips;
  const bytes=mips.reduce((sum,m)=>sum+m.data.byteLength,0);let disposed=false;
  return{texture:map,cpuBytes:bytes,gpuBytes:bytes,stats:{testOnly:true,noImageOracle:true},dispose(){if(!disposed){disposed=true;map.dispose();}}};
};
function request():AnimalBakeRequest{
  const rgba=new Uint8Array(16).fill(255),profile={pigment:rgba,paper:rgba,coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up' as const};
  return{recipeFingerprint:'TEST-real-deer-alias-retirement',paletteFingerprint:'TEST-uniform',paintFingerprint:'TEST0',compiler,compilerFingerprint:'TEST-ownership-no-raster-v1',impasto:0,wear:0,edgeWidth:1.7,strokeImperfection:.15,
    chartOptions:{texelsPerUnit:256,paddingTexels:8,mipLevels:4,maxAtlasSize:2048,maxAtlasPixels:2048*2048,maxOutputBytes:32*MiB,maxTriangles:20000},
    paint:{readProfile:()=>profile,edgeAlpha:{data:rgba,width:2,height:2},brushColorLinear:[0,0,0],lineOpacity:.79,strokeImperfection:.15},reservation:{cpuBytes:128*MiB,gpuBytes:32*MiB}};
}
function companion(source:THREE.InstancedBufferGeometry):THREE.InstancedBufferGeometry{
  const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  for(const[name,a]of Object.entries(source.attributes))if(isInstance(a))g.setAttribute(name,a);g.instanceCount=source.instanceCount;return g;
}
function port(ribbons:THREE.Object3D):AnimalAtlasPublication{
  return{isCurrent:()=>true,adoptConfiguredClone:()=>true,warmup:async()=>{},publish:()=>{throw Error('This ownership contract never publishes');},ribbons};
}

test('independent atlas retirement excludes only borrowed instance aliases from the dispose event, including adopted real growth; source and companion owners survive',async()=>{
  const library=new BakedAnimalLibrary({cpuBytes:256*MiB,gpuBytes:64*MiB}),options=request(),source=body(),sibling=companion(source),material=new THREE.MeshStandardNodeMaterial();material.positionNode=positionLocal;material.normalNode=null;
  const sourceMesh=new THREE.Mesh(source,material),siblingMesh=new THREE.Mesh(sibling,material),ribbons=new THREE.Group();
  const binding=prepareAnimalAtlasBinding(await library.acquire('deer',options),source,material,base=>base,port(ribbons));
  try{
    const aliases=new Map(Object.entries(source.attributes).filter(([,a])=>isInstance(a))),owners=new Set([...aliases.values()].map(bufferOwner)),staticPosition=binding.geometry.getAttribute('position');
    // This alias was intentionally REPLACED by a clone-owned attribute: its
    // name matches a borrowed field, but its identity/backing does not.
    const ownInstance=new THREE.InstancedBufferAttribute(new Float32Array([4,5]),1);binding.geometry.setAttribute('aAbsent',ownInstance);
    const atDispose:Attribute[][]=[];binding.geometry.addEventListener('dispose',()=>atDispose.push(Object.values(binding.geometry.attributes)));
    const sourceDispose=vi.fn(),siblingDispose=vi.fn();source.addEventListener('dispose',sourceDispose);sibling.addEventListener('dispose',siblingDispose);
    binding.dispose();binding.dispose();
    expect(atDispose).toHaveLength(1);expect(atDispose[0]).toContain(staticPosition);expect(atDispose[0]).toContain(ownInstance);
    expect(atDispose[0]!.some(a=>owners.has(bufferOwner(a)))).toBe(false);
    for(const[name,a]of aliases){expect(source.getAttribute(name)).toBe(a);expect(sibling.getAttribute(name)).toBe(a);}
    expect(sourceDispose).not.toHaveBeenCalled();expect(siblingDispose).not.toHaveBeenCalled();expect(library.snapshot().leases).toBe(0);

    const grownBinding=prepareAnimalAtlasBinding(await library.acquire('deer',options),source,material,base=>base,port(ribbons)),atlasMesh=new THREE.Mesh(grownBinding.geometry,grownBinding.material);
    try{
      // Actual global growth replaces every consumer together. The binding
      // must subsequently register the NEW shared storage, not its old aliases.
      growPawnBuffers([sourceMesh,siblingMesh,atlasMesh],129);
      const grownSource=sourceMesh.geometry as THREE.InstancedBufferGeometry,grownSibling=siblingMesh.geometry as THREE.InstancedBufferGeometry,grown=atlasMesh.geometry as THREE.InstancedBufferGeometry;
      grownBinding.adoptGrownGeometry(grown);
      const aliveOwners=new Set(Object.values(grownSource.attributes).filter(isInstance).map(bufferOwner));
      const aFrom=grownSource.getAttribute('aFrom') as THREE.InterleavedBufferAttribute,bytes=new Uint8Array(aFrom.array.buffer).slice();
      expect(grown.getAttribute('aFrom').count).toBe(256);expect(bufferOwner(grown.getAttribute('aFrom'))).toBe(bufferOwner(grownSibling.getAttribute('aFrom')));
      const disposedFields:Attribute[][]=[];grown.addEventListener('dispose',()=>disposedFields.push(Object.values(grown.attributes)));
      const aliveSourceDispose=vi.fn(),aliveSiblingDispose=vi.fn();grownSource.addEventListener('dispose',aliveSourceDispose);grownSibling.addEventListener('dispose',aliveSiblingDispose);
      grownBinding.dispose();
      expect(disposedFields).toHaveLength(1);expect(disposedFields[0]).toContain(grown.getAttribute('position'));
      expect(disposedFields[0]!.some(a=>aliveOwners.has(bufferOwner(a)))).toBe(false);
      expect(aliveSourceDispose).not.toHaveBeenCalled();expect(aliveSiblingDispose).not.toHaveBeenCalled();
      expect(grownSource.getAttribute('aFrom')).toBe(aFrom);expect(new Uint8Array(aFrom.array.buffer)).toEqual(bytes);expect(grownSibling.getAttribute('aFrom').count).toBe(256);
    }finally{grownBinding.dispose();}
  }finally{
    binding.dispose();library.evictUnused();library.dispose();sourceMesh.geometry.dispose();siblingMesh.geometry.dispose();material.dispose();
    for(const key of ['origamiLines','origamiWear']){const g=source.userData[key];if(g instanceof THREE.BufferGeometry)g.dispose();}
  }
});
