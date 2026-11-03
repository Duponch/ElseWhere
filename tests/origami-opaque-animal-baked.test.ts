/** CPU/source contracts only. Uniform 2x2 TEST pixels are not a visual oracle.
 * Actual model factories, real stock ribbon producer, owner buffers, real
 * growPawnBuffers and real clinical union run here. No World or renderer. */
import {test,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {bool,positionLocal,vec4,attribute,float} from 'three/tsl';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import {origamiAnimalPresentationGeometry,origamiAnimalReferenceInfo} from '../src/render/origami/animal-geometry';
import {createRigBrushGeometry} from '../src/render/origami/rig-brush';
import {updateOrigamiBrushGeometry} from '../src/render/origami/brush-geometry';
import {indexExactStaticVertices} from '../src/render/origami/static-index';
import {ActorPartUnionIndex,readAnimalPartUnion} from '../src/render/origami/actor-part-union';
import {growPawnBuffers} from '../src/render/pawn-buffers';
import {bodyBloodPigment} from '../src/render/body-blood';
import {BakedAnimalLibrary,prepareAnimalAtlasBinding,type AnimalBakeRequest,type AnimalAtlasPublication} from '../src/render/origami/baked/animal-baked';
import {compileCpuAtlasReference} from './helpers/origami-opaque-cpu-reference';

vi.mock('../src/render/origami/rig-brush',async importOriginal=>{
  const actual=await importOriginal<typeof import('../src/render/origami/rig-brush')>();
  return{...actual,createRigBrushGeometry:vi.fn(actual.createRigBrushGeometry)};
});
const MiB=1024*1024;
const isInstance=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
function source(species:string,capacity=2):THREE.InstancedBufferGeometry{
  const body=origamiAnimalPresentationGeometry(capacity,species,false);if(!body)throw Error('Actual source species unavailable '+species);
  if(body.userData.origamiReference)indexExactStaticVertices(body);return body;
}
function disposeSource(body:THREE.BufferGeometry):void{body.dispose();for(const key of ['origamiLines','origamiWear']){const g=body.userData[key];if(g instanceof THREE.BufferGeometry)g.dispose();}}
function request():{options:AnimalBakeRequest;reads:ReturnType<typeof vi.fn>} {
  const rgba=Uint8Array.from([180,160,140,255,180,160,140,255,180,160,140,255,180,160,140,255]);
  const profile={pigment:rgba,paper:rgba,coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up' as const};
  const reads=vi.fn((_id:number)=>profile);
  return{reads,options:{recipeFingerprint:'TEST-only-real-model-v1',paletteFingerprint:'TEST-uniform-pixels-not-appearance',paintFingerprint:'TEST-PKM-solid-generation0',compiler:compileCpuAtlasReference,compilerFingerprint:'TEST-cpu-v3-supersampled',impasto:0,wear:0,edgeWidth:1.7,strokeImperfection:.15,
    chartOptions:{texelsPerUnit:256,paddingTexels:8,mipLevels:4,maxAtlasSize:2048,maxAtlasPixels:2048*2048,maxOutputBytes:32*MiB,maxTriangles:20000},
    paint:{readProfile:reads,edgeAlpha:{data:new Uint8Array(16).fill(255),width:2,height:2},brushColorLinear:[.02,.015,.01],lineOpacity:.79,strokeImperfection:.15},
    bakeOptions:{maxAtlasBytes:16*MiB,maxScratchBytes:32*MiB},maxInkTriangles:100000,reservation:{cpuBytes:128*MiB,gpuBytes:32*MiB}}};
}

test('real protected deer keeps all source eye/clinical corners, shares one species preparation across two owners and refuses a changed ACTUAL stock ribbon before paint admission',async()=>{
  expect(origamiAnimalReferenceInfo('deer')?.kind).toBe('existing-reference');
  const library=new BakedAnimalLibrary({cpuBytes:256*MiB,gpuBytes:64*MiB}),body=source('deer'),{options,reads}=request(),real=await vi.importActual<typeof import('../src/render/origami/rig-brush')>('../src/render/origami/rig-brush');
  const stock=real.createRigBrushGeometry(body);updateOrigamiBrushGeometry(stock,options.edgeWidth,options.strokeImperfection);
  const oldIndex=[...body.index!.array],oldPosition=[...body.getAttribute('position').array],leases=await Promise.all([library.acquire('deer',options),library.acquire('deer',options)]);
  try{
    const [a,b]=leases,resource=a!.resource;expect(resource).toBe(b!.resource);expect(library.snapshot()).toMatchObject({ready:1,pending:0,leases:2});
    expect(reads.mock.calls.length).toBeGreaterThan(0);expect(new Set(reads.mock.calls.map(call=>call[0])).size).toBe(reads.mock.calls.length);
    expect(resource.sourceVertex.length).toBe(body.index!.count);expect(resource.triangleChart.length).toBe(body.index!.count/3);
    const eye=resource.geometry.getAttribute('eyeMark');expect(new Set(Array.from({length:eye.count},(_,v)=>eye.getX(v)))).toEqual(new Set([-1,0,1]));
    // Every full-source corner participates, including the crossed-eye records
    // which the standalone living deer fixture intentionally leaves out.
    expect(resource.facts.bodyTriangles).toBe(body.index!.count/3);expect(resource.facts.stockRibbonTriangles).toBe(stock.index!.count/3);
    for(const[name,original]of Object.entries(body.attributes))if(!isInstance(original)){
      const actual=resource.geometry.getAttribute(name);expect(actual.itemSize).toBe(original.itemSize);
      for(let v=0;v<actual.count;v++)for(let c=0;c<actual.itemSize;c++)expect(Object.is(actual.getComponent(v,c),original.getComponent(resource.sourceVertex[v]!,c))).toBe(true);
    }
    expect([...body.index!.array]).toEqual(oldIndex);expect([...body.getAttribute('position').array]).toEqual(oldPosition);
    const paintedBefore=reads.mock.calls.length;
    // Deliberately change only the REAL product producer output. If admission
    // merely trusts its own tagged path or sets a boolean, this would succeed.
    vi.mocked(createRigBrushGeometry).mockImplementationOnce(g=>{const changed=real.createRigBrushGeometry(g);changed.getAttribute('uv').setY(0,.123);return changed;});
    await expect(library.acquire('deer',{...options,recipeFingerprint:'TEST-deliberately-corrupted-stock-UV'})).rejects.toThrow(/stock|ribbon/i);
    expect(reads.mock.calls.length).toBe(paintedBefore);expect(library.snapshot()).toMatchObject({ready:1,pending:0,leases:2});
  }finally{vi.mocked(createRigBrushGeometry).mockImplementation(real.createRigBrushGeometry);for(const lease of leases)lease.release();library.evictUnused();library.dispose();stock.dispose();disposeSource(body);}
});

test('real raccoon binding preserves live/dead and actual leg union gates through real 2→256 owner-buffer growth; ribbons retire only after publication',async()=>{
  expect(ANIMAL_SPECIES_IDS as readonly string[]).toContain('raccoon');expect(origamiAnimalReferenceInfo('raccoon')?.kind).toBe('new-reference');
  const library=new BakedAnimalLibrary({cpuBytes:256*MiB,gpuBytes:64*MiB}),body=source('raccoon'),{options}=request();body.instanceCount=2;
  const animal=body.getAttribute('aAnimal'),biology=body.getAttribute('aBiology'),parts=body.getAttribute('animalPart');animal.setZ(0,0);animal.setZ(1,2);biology.setZ(0,0);biology.setZ(1,0);
  const legVertex=Array.from({length:parts.count},(_,v)=>v).find(v=>[1,2].includes(parts.getX(v))&&parts.getY(v)>0);expect(legVertex).toBeDefined();const legBit=parts.getY(legVertex!);
  const material=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true});material.positionNode=positionLocal;material.normalNode=null;material.maskNode=bool(true);material.maskShadowNode=bool(false);material.outputNode=vec4(1);
  const mesh=new THREE.Mesh(body,material),ribbonGeometry=createRigBrushGeometry(body),ribbonMaterial=new THREE.MeshBasicMaterial(),ribbons=new THREE.Mesh(ribbonGeometry,ribbonMaterial);ribbons.userData.origamiOwnerVisible=true;
  const configured=new WeakSet<THREE.Material>([material]);let finishWarm!:()=>void,attached=false;const warm=new Promise<void>(resolve=>{finishWarm=resolve;});
  const publish=vi.fn((next:Parameters<AnimalAtlasPublication['publish']>[0])=>{mesh.geometry=next.geometry;mesh.material=next.material;attached=true;return{detach(){attached=false;mesh.removeFromParent();},isAttached:()=>attached};});
  const port:AnimalAtlasPublication={isCurrent:()=>true,adoptConfiguredClone:(old,next)=>{if(!configured.has(old)||old.maskNode!==next.maskNode||old.outputNode!==next.outputNode)return false;configured.add(next);return true;},warmup:()=>warm,publish,ribbons};
  const lease=await library.acquire('raccoon',options);
  const blood=(base:THREE.Node<'vec3'>)=>bodyBloodPigment(base,attribute('animalPart','vec4').z,1,attribute('animalPart','vec4').w.lessThan(0).select(float(1),float(0)),attribute('aBiology','vec3').y);
  const binding=prepareAnimalAtlasBinding(lease,body,material,blood,port);let union:ActorPartUnionIndex|undefined;
  try{
    const commit=binding.commit();await Promise.resolve();expect(publish).not.toHaveBeenCalled();expect(ribbons.visible).toBe(true);finishWarm();await commit;
    expect(publish).toHaveBeenCalledTimes(1);expect(ribbons.visible).toBe(false);expect(ribbons.userData.origamiOwnerVisible).toBe(false);
    for(const key of ['positionNode','normalNode','maskNode','maskShadowNode','outputNode'] as const)expect(binding.material[key]).toBe(material[key]);
    for(const[name,a]of Object.entries(body.attributes))if(isInstance(a))expect(binding.geometry.getAttribute(name)).toBe(a);
    const canonicalIndices=[...binding.geometry.index!.array];
    union=new ActorPartUnionIndex(binding.geometry,'animal');union.reconcile(readAnimalPartUnion(binding.geometry,2));expect(binding.geometry.drawRange.count).toBe(binding.sourceVertex.length);
    // Two owners now share a REAL missing-leg bit and living-eye state.
    animal.setZ(1,0);biology.setZ(0,legBit);biology.setZ(1,legBit);union.reconcile(readAnimalPartUnion(binding.geometry,2));
    const traits=binding.geometry.getAttribute('animalPart'),expected:number[]=[];
    for(let first=0;first<canonicalIndices.length;first+=3){const ids=canonicalIndices.slice(first,first+3),leg=ids.every(v=>traits.getY(v)===legBit),deadEyes=ids.every(v=>traits.getW(v)===1);if(!leg&&!deadEyes)expected.push(...ids);}
    expect([...binding.geometry.index!.array].slice(0,binding.geometry.drawRange.count)).toEqual(expected);expect(expected.length).toBeLessThan(binding.sourceVertex.length);
    union.dispose();union=undefined;const oldOwnerBuffer=(binding.geometry.getAttribute('aFrom') as THREE.InterleavedBufferAttribute).data;
    // The actual producer restores its complete union before cloning/growing.
    growPawnBuffers([mesh],129);const grown=mesh.geometry as THREE.InstancedBufferGeometry;binding.adoptGrownGeometry(grown);grown.instanceCount=129;binding.syncInstances(grown);
    const owner=(grown.getAttribute('aFrom') as THREE.InterleavedBufferAttribute).data;expect(owner).not.toBe(oldOwnerBuffer);expect(owner).toBeInstanceOf(THREE.InstancedInterleavedBuffer);expect(owner.stride).toBe(33);expect(grown.getAttribute('aFrom').count).toBe(256);expect(binding.geometry).toBe(grown);expect(grown.instanceCount).toBe(129);
    for(const name of ['aFrom','aTo','aTravel','aAnimal','aScale','aBodyBlood','aAbsent','aCarrier','aCorpseHandoff','aCorpseFrom','aCorpseTo','aBiology'])expect((grown.getAttribute(name) as THREE.InterleavedBufferAttribute).data).toBe(owner);
    expect((grown.getAttribute('aBiology') as THREE.InterleavedBufferAttribute).offset).toBe(16);
    // The newly admitted real owner rows have no missing bit: the leg must
    // return, while every living owner still hides the crossed-eye family.
    union=new ActorPartUnionIndex(grown,'animal');union.reconcile(readAnimalPartUnion(grown,129));const selected=[...grown.index!.array].slice(0,grown.drawRange.count);
    expect(selected.some(v=>grown.getAttribute('animalPart').getY(v)===legBit)).toBe(true);expect(selected.every(v=>grown.getAttribute('animalPart').getW(v)!==1)).toBe(true);
    expect(grown.getAttribute('bakedUv').array).toEqual(binding.resource.geometry.getAttribute('bakedUv').array);
    binding.setAtlasEnabled(false);expect(ribbons.visible).toBe(true);binding.setAtlasEnabled(true);expect(ribbons.visible).toBe(false);expect(library.snapshot().leases).toBe(1);
  }finally{union?.dispose();binding.dispose();expect(attached).toBe(false);expect(ribbons.visible).toBe(true);library.evictUnused();library.dispose();ribbonGeometry.dispose();ribbonMaterial.dispose();material.dispose();disposeSource(body);}
});
