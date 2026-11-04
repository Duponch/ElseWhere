/** Real common animal models, clinical writers and cold pinned WGSL. Browser
 * paint pixels are a lifecycle sink only: no visual or GPU-time claim. ROOT
 * runs these contracts after all common-surface producers have frozen. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{
 const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');
 return{...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};
});
import {AnimalModels,ANIMAL_SURFACE_PROFILE_STRIDE} from '../src/render/models/AnimalModels';
import {commonAnimalPresentationGeometry,origamiAnimalCachedWearBytes} from '../src/render/origami/animal-geometry';
import {ActorPartUnionIndex,readAnimalPartUnion} from '../src/render/origami/actor-part-union';
import {bakeAnimalCoatCoordinates,createAnimalCoatTexture} from '../src/render/animal-surface-paint';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {AnimationDetail} from '../src/render/AnimationDetail';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ANIMAL_SPECIES_IDS,type AnimalSpeciesId} from '../src/sim/animal-species';
import {adultAgeTicks} from '../src/sim/animal-life';
import {attachGeneratedAnimalGrowth256} from '../src/sim/animal-growth-runtime-256';
import {initializeAnimalEggLayer256} from '../src/sim/animal-egg-local-v256';
import {createAnimalMedicalRecord256} from '../src/sim/animal-clinical-age-v256';
import {addResolvedInjury,reconcileMedicalDeath} from '../src/sim/injury-state';
import {medicalModel} from '../src/sim/body-model';
import {HP_UNIT,BLOOD_UNIT} from '../src/sim/injury-rules';
import {bodyBloodWord} from '../src/render/body-blood';
import {corpseVisualMask} from '../src/render/corpse-presentation';
import {ensureFireState} from '../src/sim/fire-rules';
import {animalCombatCamp} from './scenarios/animal-combat';
import {writeTestFileSync} from './test-output';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
type Body=THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>;
function stream(g:THREE.BufferGeometry,name:string,transform?:(value:number,component:number)=>number):Float32Array{
 const a=g.getAttribute(name),count=g.index?.count??a.count,out=new Float32Array(count*a.itemSize);
 for(let corner=0;corner<count;corner++)for(let component=0;component<a.itemSize;component++){
  const value=a.getComponent(g.index?.getX(corner)??corner,component);out[corner*a.itemSize+component]=transform?transform(value,component):value;
 }return out;
}
function disposeSource(g:THREE.BufferGeometry):void{g.dispose();for(const key of ['origamiLines','origamiWear'])if(g.userData[key] instanceof THREE.BufferGeometry)g.userData[key].dispose();}
function body(layer:WildlifeLayer,species:AnimalSpeciesId='deer'):Body{const found=layer.mesh.children.find(m=>m.name===`Wild ${species} — GPU rig`);if(!(found instanceof THREE.Mesh))throw Error('Actual species body missing');return found as Body;}
function freshAnimal(world:ReturnType<typeof animalCombatCamp>,species:AnimalSpeciesId,index:number,age=adultAgeTicks(species)){
 const animal:NonNullable<typeof world.wildlife>['animals'][number]={id:900+index,species,sex:'female',ageTicks:age,food:0,rest:1,x:2+index%25,z:2+Math.floor(index/25),state:'idle',path:[],nextDecision:world.tick+100};
 attachGeneratedAnimalGrowth256(animal,world.tick*10,world.schemaVersion);initializeAnimalEggLayer256(animal);return animal;
}
function owners(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),lighting=new EnvironmentLighting(),detail=new AnimationDetail();
 const layer=withGraphicsStyle(context,()=>new WildlifeLayer(lighting.configure,undefined,detail));
 return{context,flush,lighting,detail,layer,close(){layer.dispose();lighting.dispose();context.dispose();flush.mockRestore();}};
}
function geometryFacts(g:THREE.BufferGeometry){return{geometry:g,index:g.index,indexBytes:g.index!.array.slice(),attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{attribute:a,array:a.array,bytes:a.array.slice()}]))};}
function unchanged(g:THREE.BufferGeometry,original:ReturnType<typeof geometryFacts>):void{
 expect(g).toBe(original.geometry);expect(g.index).toBe(original.index);expect(g.index!.array).toEqual(original.indexBytes);
 for(const[name,row]of Object.entries(original.attributes)){const a=g.getAttribute(name);expect(a).toBe(row.attribute);expect(a.array).toBe(row.array);expect(a.array).toEqual(row.bytes);}
}

test('all53 common models retain complete Source triangle order, anatomy, both exact UV domains and the33-float resident layout before either texture is selected',()=>{
 const models=new AnimalModels();
 try{
  expect(ANIMAL_SPECIES_IDS).toHaveLength(53);
  for(const species of ANIMAL_SPECIES_IDS){
   const model=models.get(species),source=commonAnimalPresentationGeometry(1,species,false);if(!source)throw Error('Actual Source species missing: '+species);
   const coatSource=new THREE.BufferGeometry();for(const[name,a]of Object.entries(source.attributes))coatSource.setAttribute(name,a);if(source.index)coatSource.setIndex(source.index);bakeAnimalCoatCoordinates(coatSource,species);
   const runtime=model.instantiate(3),other=model.instantiate(1);
   try{
    expect(models.get(species)).toBe(model);expect(Reflect.get(model,'source')).toBeUndefined();expect(runtime.index!.count).toBe(source.index?.count??source.getAttribute('position').count);
    for(const name of ['position','normal','color','boneId','bindPivot','corpsePartMask','bloodRegion','eyeMark','animalPart','animalPaintUv','uv'])expect(stream(runtime,name),species+'/'+name).toEqual(stream(source,name));
    expect(stream(runtime,'animalPaint',(value,c)=>c===3?value%ANIMAL_SURFACE_PROFILE_STRIDE:value),species+'/palette').toEqual(stream(source,'animalPaint'));
    const sourceUv=stream(source,'animalPaintUv'),coatUv=stream(coatSource,'animalPaintUv'),runtimeUv=stream(runtime,'animalSurfaceUv'),words=stream(runtime,'animalPaint');
    for(let i=0;i<runtimeUv.length/4;i++){
     expect(Array.from(runtimeUv.subarray(i*4,i*4+4)),species+'/dual UV').toEqual([sourceUv[i*2],sourceUv[i*2+1],coatUv[i*2],coatUv[i*2+1]]);
     expect(Math.floor(words[i*4+3]!/ANIMAL_SURFACE_PROFILE_STRIDE),species+'/face ownership').toBe(model.strokes.sourceTriangleFaceIds[Math.floor(i/3)]);
    }
    const from=runtime.getAttribute('aFrom') as THREE.InterleavedBufferAttribute;expect(from.data).toBeInstanceOf(THREE.InstancedInterleavedBuffer);expect(from.data.stride).toBe(33);expect(from.count).toBe(3);
    for(const[name,size,offset]of [['aFrom',4,0],['aTo',4,4],['aTravel',4,8],['aAnimal',4,12],['aScale',1,16],['aBodyBlood',1,17],['aAbsent',1,18],['aCarrier',4,19],['aCorpseHandoff',2,23],['aCorpseFrom',4,25],['aCorpseTo',4,29],['aBiology',3,16]]as const){const a=runtime.getAttribute(name) as THREE.InterleavedBufferAttribute;expect(a.data).toBe(from.data);expect([a.itemSize,a.offset]).toEqual([size,offset]);}
    expect(runtime.getAttribute('position')).not.toBe(other.getAttribute('position'));expect(runtime.getAttribute('position').array).toBe(other.getAttribute('position').array);
    // The union mutates only this rig's private index, never the complete model
    // table or a second rig's original triangle domain.
    const templateIndex=model.geometry.index!.array.slice(),otherIndex=other.index!.array.slice(),union=new ActorPartUnionIndex(runtime,'animal');
    try{runtime.instanceCount=1;runtime.getAttribute('aAnimal').setZ(0,0);union.reconcile(readAnimalPartUnion(runtime,1));expect(runtime.drawRange.count).toBeLessThan(runtime.index!.count);expect(model.geometry.index!.array).toEqual(templateIndex);expect(other.index!.array).toEqual(otherIndex);}finally{union.dispose();}
    expect(runtime.userData.animalSurfaceProfileStride).toBe(128);expect(model.geometry.hasAttribute('bakedUv')).toBe(false);expect(model.geometry.userData.origamiWear).toBeUndefined();expect(origamiAnimalCachedWearBytes(species)).toBe(0);
   }finally{runtime.dispose();other.dispose();coatSource.dispose();disposeSource(source);}
  }
  expect(models.snapshot()).toMatchObject({models:53,leases:0,closing:false});
 }finally{models.dispose();}
 expect(models.snapshot()).toMatchObject({models:0,cpuBytes:0,closing:true});
 const tiny=new AnimalModels(1);try{expect(()=>tiny.get('deer')).toThrow(/before allocation/);expect(tiny.snapshot().models).toBe(0);}finally{tiny.dispose();}
},60_000);

test('actual wildlife changes texture data on the same geometry/material; injury, absent parts, corpse eyes, fire and capacity growth keep their real owner streams',()=>{
 const owner=owners(),{layer,context}=owner;let world=animalCombatCamp();world.piles=[];world.wildlife!.animals=[freshAnimal(world,'deer',0)];world.nextId=Math.max(world.nextId,1000);
 const animal=world.wildlife!.animals[0]!;ensureFireState(world).items=[{id:world.nextId++,x:animal.x,z:animal.z,size:.2,bornCore:0,nextPulseCore:15,complexCore:0,spreadCore:0,attachedAnimalId:animal.id}];
 let retiredBody:THREE.BufferGeometry|undefined;const retiredBodyDispose=vi.fn();
 try{
  layer.setSelected(new Set([animal.id]));layer.update(world,undefined,true);const mesh=body(layer),geometry=mesh.geometry,material=mesh.material,initial=geometryFacts(geometry),program=material.colorNode,normal=material.normalNode,position=material.positionNode,output=material.outputNode,mask=material.maskNode,version=material.version;
  retiredBody=geometry;geometry.addEventListener('dispose',retiredBodyDispose);
  const complete=layer.sharedSurfaceStatus();expect(complete.species).toHaveLength(53);expect(complete.species.every(s=>s.pipeline==='shared-paint'&&!s.sourceRibbons)).toBe(true);expect(complete.positiveEffectsTransitional).toBe(false);
  expect([material.roughness,material.metalness,material.transparent,material.depthWrite,material.alphaTest]).toEqual([.88,.02,false,true,0]);expect(normal).toBeNull();expect(output).not.toBeNull();expect(mask).not.toBeNull();expect(context.reliefLod).toBeUndefined();
  for(const style of ['origami','default','origami']as const){const before=JSON.stringify(world);context.update({...context.preferences,style});layer.update(world,undefined);unchanged(mesh.geometry,initial);expect(mesh.material).toBe(material);expect(material.colorNode).toBe(program);expect(material.positionNode).toBe(position);expect(material.normalNode).toBe(normal);expect(material.outputNode).toBe(output);expect(material.maskNode).toBe(mask);expect(material.version).toBe(version);expect(context.surfaceEncoding.value).toBe(style==='origami'?1:0);expect(JSON.stringify(world)).toBe(before);}
  for(const child of layer.mesh.children)if(child instanceof THREE.Mesh)expect(child.children.some(c=>c instanceof THREE.Mesh&&(c.material as THREE.Material).userData.origamiBrush)).toBe(false);
  expect(layer.bakedStatus()).toMatchObject({eligible:false,pending:false,published:[],bloodBlockedSpecies:[]});for(const name of ['hasPendingBakedSpecies','prepareBakedSpecies','invalidateBakedSpecies','settleBakedSpecies'])expect(Reflect.has(layer,name),name).toBe(false);expect(Reflect.get(context,'wearGeometries').size).toBe(0);expect(Reflect.get(context,'brushGeometries').size).toBe(0);
  const changed=structuredClone(world),deer=changed.wildlife!.animals[0]!,health=deer.health=createAnimalMedicalRecord256(changed,deer),medical=medicalModel(health),ear=medical.parts.find(p=>p.parent!==null&&p.id.endsWith('-ear'));
  if(!ear)throw Error('Actual deer ear owner absent');addResolvedInjury(health,ear.id,'cut',ear.hp*HP_UNIT+HP_UNIT,()=>.999999);expect(health.missing.some(m=>m.part===ear.id)).toBe(true);expect(addResolvedInjury(health,'torso','execution-cut',1000,()=>.999999)).not.toBeNull();
  const medicalBefore=JSON.stringify(changed);layer.update(changed,undefined);expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect(geometry.getAttribute('aBodyBlood').getX(0)).toBe(bodyBloodWord(health));expect(bodyBloodWord(health)).toBeGreaterThan(0);expect(geometry.getAttribute('aAbsent').getX(0)).toBe(corpseVisualMask({animalId:deer.id,species:deer.species,sex:deer.sex,ageTicks:deer.ageTicks,health}));expect(JSON.stringify(changed)).toBe(medicalBefore);
  const capacity=geometry.getAttribute('aFrom').count,grown=structuredClone(changed);grown.wildlife!.animals=Array.from({length:capacity+1},(_,i)=>i===0?structuredClone(deer):freshAnimal(grown,'deer',i,Math.floor(adultAgeTicks('deer')*.4)));grown.nextId=Math.max(grown.nextId,1000+capacity);
  layer.update(grown,undefined);const next=mesh.geometry;expect(next).not.toBe(geometry);expect(mesh.material).toBe(material);expect(next.getAttribute('position').array).toEqual(initial.attributes.position!.bytes);expect(next.getAttribute('animalSurfaceUv').array).toEqual(initial.attributes.animalSurfaceUv!.bytes);expect(next.instanceCount).toBe(capacity+1);expect(next.getAttribute('aScale').getX(1)).toBeLessThan(next.getAttribute('aScale').getX(0));
  expect(retiredBodyDispose).not.toHaveBeenCalled();expect(Object.keys(geometry.attributes).some(name=>name.startsWith('uvFaceStrokeGpuRetirement'))).toBe(false);
  const slot=ANIMAL_SPECIES_IDS.indexOf('deer'),aux=[layer.mesh.children[slot*3+1],layer.mesh.children[slot*3+2],layer.flames.children[slot]] as THREE.Mesh[];
  for(const item of aux){const actual=item.geometry.getAttribute('aFrom') as THREE.InterleavedBufferAttribute,expected=next.getAttribute('aFrom') as THREE.InterleavedBufferAttribute;expect(actual.data).toBe(expected.data);}
  const dead=structuredClone(grown),corpse=dead.wildlife!.animals[0]!;corpse.health!.bloodLoss=BLOOD_UNIT;reconcileMedicalDeath(corpse.health!);corpse.state='dead';layer.update(dead,undefined);expect(next.getAttribute('aAnimal').getZ(0)).toBe(2);expect(next.getAttribute('aAbsent').getX(0)).toBeGreaterThan(0);expect(mesh.material).toBe(material);
  const grownMaterial=mesh.material;layer.setTexturesEnabled(false);expect(mesh.material).not.toBe(grownMaterial);expect(mesh.geometry).toBe(next);layer.setTexturesEnabled(true);expect(mesh.material).toBe(grownMaterial);expect(mesh.geometry).toBe(next);
 }finally{owner.close();}
 expect(retiredBodyDispose).toHaveBeenCalledOnce();expect(Object.keys(retiredBody!.attributes).filter(name=>name.startsWith('uvFaceStrokeGpuRetirement'))).toHaveLength(1);
},60_000);

test('positive optional effects retain the same body and black-stroke program family; zero releases physical wear and its canonical cache without a style reconstruction',()=>{
 const owner=owners(),{layer,context}=owner,world=animalCombatCamp();world.piles=[];world.wildlife!.animals=[freshAnimal(world,'deer',0)];
 try{
  layer.update(world,undefined,true);const mesh=body(layer),geometry=mesh.geometry,material=mesh.material,position=material.positionNode,partTable=layer.sharedSurfaceStatus().species.find(s=>s.species==='deer')!;
  context.update({...context.preferences,impasto:.5,edges:.65,wear:.75});expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect(material.positionNode).toBe(position);expect(material.normalNode).not.toBeNull();expect(layer.sharedSurfaceStatus().species.find(s=>s.species==='deer')!.modelKey).toBe(partTable.modelKey);
  const wear=mesh.children.find(c=>c instanceof THREE.Mesh&&c.name.includes('optional physical paint wear')) as Body;expect(wear).toBeInstanceOf(THREE.Mesh);expect(wear.visible).toBe(false);expect(Reflect.get(context,'wearGeometries').size).toBe(53);expect(wear.geometry.getAttribute('aFrom')).toBe(geometry.getAttribute('aFrom'));
  const wearGeometry=wear.geometry,wearMaterial=wear.material,bodyVersion=material.version,wearVersion=wearMaterial.version;context.update({...context.preferences,style:'origami'});expect(wear.visible).toBe(true);context.update({...context.preferences,style:'default'});expect(wear.visible).toBe(false);expect(wear.geometry).toBe(wearGeometry);expect(wear.material).toBe(wearMaterial);expect(material.version).toBe(bodyVersion);expect(wearMaterial.version).toBe(wearVersion);
  const disposeGeometry=vi.fn(),disposeMaterial=vi.fn();wearGeometry.addEventListener('dispose',disposeGeometry);wearMaterial.addEventListener('dispose',disposeMaterial);context.update({...context.preferences,impasto:0,wear:0});expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect(material.normalNode).toBeNull();expect(context.reliefLod).toBeUndefined();expect(mesh.children).not.toContain(wear);expect(disposeGeometry).toHaveBeenCalledOnce();expect(disposeMaterial).toHaveBeenCalledOnce();expect(Reflect.get(context,'wearGeometries').size).toBe(0);expect(Reflect.get(context,'brushGeometries').size).toBe(0);for(const species of ANIMAL_SPECIES_IDS)expect(origamiAnimalCachedWearBytes(species),species+'/wear zero').toBe(0);
 }finally{owner.close();}
},60_000);

interface Binding {name:string;isSampledTexture?:boolean;texture?:THREE.Texture;visibility:number}
interface Inspector {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];build():unknown;
 getAttributesArray():{name:string;node?:{attribute?:Attribute}}[];getBindings():{bindings:Binding[]}[];
}
test('actual common animal body compiles cold with both texture paths and opaque Source stroke table within WebGPU attribute, buffer and varying budgets',()=>{
 const owner=owners(),{layer,context}=owner,mesh=body(layer),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold WGSL inspection cannot request a device');});
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),hemisphere=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(mesh,sun,hemisphere);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Inspector;
 try{
  const material=mesh.material,builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,hemisphere]);builder.build();
  const attributes=builder.getAttributesArray().flatMap(a=>{const attribute=a.node?.attribute??mesh.geometry.getAttribute(a.name);return attribute?[{name:a.name,attribute}]:[];}),buffers=new Set(attributes.map(({attribute:a})=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)),bindings=builder.getBindings().flatMap(b=>b.bindings),sampled=bindings.filter(b=>b.isSampledTexture);
  writeTestFileSync('artifacts/shared-animal-surface-vertex.wgsl',builder.vertexShader);writeTestFileSync('artifacts/shared-animal-surface-fragment.wgsl',builder.fragmentShader);writeTestFileSync('artifacts/shared-animal-surface-facts.json',JSON.stringify({scope:'Actual WildlifeLayer deer/body/Standard/Environment/exploration, Source FaceStrokeTable, lifecycle paint sink, cold WGSL only; no device/pixels/performance',attributes:attributes.map(a=>[a.name,a.attribute.itemSize]),buffers:buffers.size,varyings:builder.varyings.filter(v=>v.needsInterpolation).map(v=>v.name),sampled:sampled.map(b=>({name:b.name,visibility:b.visibility,texture:b.texture?.name}))},null,2)+'\n');
  expect(attributes.length,attributes.map(a=>a.name).join(',')).toBeLessThanOrEqual(16);expect(attributes).toHaveLength(15);expect(buffers.size).toBeLessThanOrEqual(8);expect(builder.varyings.filter(v=>v.needsInterpolation).length,builder.varyings.filter(v=>v.needsInterpolation).map(v=>v.name).join(',')).toBeLessThanOrEqual(16);expect(attributes.some(a=>a.name==='animalSurfaceUv'&&a.attribute.itemSize===4)).toBe(true);expect(attributes.some(a=>a.name==='color')).toBe(false);expect(material.normalNode).toBeNull();expect(material.transparent).toBe(false);expect(builder.fragmentShader).toContain('textureSampleGrad');expect(builder.fragmentShader).not.toContain('origamiGlobalRelief');
  for(const bit of [1,2])expect(sampled.filter(b=>(b.visibility&bit)!==0).length).toBeLessThanOrEqual(16);
  const coatBinding=sampled.find(b=>b.texture?.name==='Pastel animal coat — short');expect(coatBinding).toBeDefined();
  const coat=createAnimalCoatTexture('short');try{expect(coatBinding!.texture!.image).toEqual(coat.image);expect(coatBinding!.texture!.colorSpace).toBe(coat.colorSpace);expect(coatBinding!.texture!.wrapS).toBe(coat.wrapS);expect(coatBinding!.texture!.minFilter).toBe(coat.minFilter);}finally{coat.dispose();}
  expect(init).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);expect(context.surfaceEncoding.value).toBe(0);
 }finally{mesh.removeFromParent();owner.close();init.mockRestore();}
 // A cold pinned renderer owns no GPU resources. Its dispose() would enter
 // the asynchronous animation/init lifecycle, so it is deliberately not used.
},60_000);
