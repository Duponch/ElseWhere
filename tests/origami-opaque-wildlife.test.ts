/** Product owner/rig contracts, never GPU pixels or a visual/performance oracle.
 * Only the browser paint boundary and the injected atlas compiler are synthetic;
 * real WildlifeLayer rigs, geometry, unions, growth and lighting owners run. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {actorExplorationMaterial256} from '../src/render/ExplorationMask256';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {WildlifeLayer,type WildlifeBakedPreparation} from '../src/render/WildlifeLayer';
import {BakedAnimalLibrary,type AnimalAtlasCompiler,type AnimalAtlasCompileInput,type AnimalBakeRequest} from '../src/render/origami/baked/animal-baked';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ANIMAL_SPECIES_IDS,type AnimalSpeciesId} from '../src/sim/animal-species';
import {adultAgeTicks} from '../src/sim/animal-life';
import {createAnimalMedicalRecord256} from '../src/sim/animal-clinical-age-v256';
import {addResolvedInjury,reconcileMedicalDeath} from '../src/sim/injury-state';
import {advanceMedical} from '../src/sim/injury-evolution';
import {BLOOD_UNIT} from '../src/sim/injury-rules';
import {bodyBloodWord} from '../src/render/body-blood';
import {ensureFireState} from '../src/sim/fire-rules';
import {bool,positionLocal,vec3} from 'three/tsl';
import {animalCombatCamp} from './scenarios/animal-combat';
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>();
 const{stubResidentPaintToSink}=await import('./fixtures/reference-paint-bake-stub');
 return{...actual,bakeResidentPaintToSink:stubResidentPaintToSink};
});

const MiB=1024*1024;
type Mesh=THREE.Mesh<THREE.InstancedBufferGeometry>;
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
function body(layer:WildlifeLayer,species:string):Mesh {
 const found=layer.mesh.children.find(m=>m.name===`Wild ${species} — GPU rig`);if(!(found instanceof THREE.Mesh))throw Error('Missing real species mesh '+species);return found as Mesh;
}
function auxiliary(layer:WildlifeLayer,species:AnimalSpeciesId){
 const slot=ANIMAL_SPECIES_IDS.indexOf(species);
 return{selection:layer.mesh.children[slot*3+1] as Mesh,slaughter:layer.mesh.children[slot*3+2] as Mesh,fire:layer.flames.children[slot] as Mesh};
}
function expectSameOwnerBuffer(actual:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,expected:THREE.BufferAttribute|THREE.InterleavedBufferAttribute):void {
 // The real growPawnBuffers constructs a fresh view per mesh, but its Map
 // shares ONE InstancedInterleavedBuffer. Three Attributes._getBufferAttribute
 // keys the GPU allocation by that exact .data object, not by each view.
 if(expected instanceof THREE.InterleavedBufferAttribute){
  expect(actual).toBeInstanceOf(THREE.InterleavedBufferAttribute);if(!(actual instanceof THREE.InterleavedBufferAttribute))throw Error('Lost interleaved owner view');
  expect(actual.data).toBe(expected.data);expect(actual.data).toBeInstanceOf(THREE.InstancedInterleavedBuffer);expect(actual.array).toBe(expected.array);
  expect(actual.offset).toBe(expected.offset);expect(actual.itemSize).toBe(expected.itemSize);expect(actual.normalized).toBe(expected.normalized);expect(actual.count).toBe(expected.count);
 }else expect(actual).toBe(expected);
}
function ribbons(mesh:Mesh):THREE.Mesh {
 const found=mesh.children.find(child=>child instanceof THREE.Mesh&&child.material instanceof THREE.NodeMaterial&&child.material.userData.origamiBrush);if(!(found instanceof THREE.Mesh))throw Error('Missing actual Origami ribbons');return found;
}
function worldWith(species:AnimalSpeciesId='deer'){
 const world=animalCombatCamp(),original=world.wildlife!.animals[0]!;
 world.piles=[];world.wildlife!.animals=[{...original,id:900,species,ageTicks:adultAgeTicks(species),health:undefined}];world.nextId=Math.max(world.nextId,1000);return world;
}
function productOwners(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0});
 // Avoid Canvas/palette admission in this owner-only contract. The actual
 // source material/node factories still execute with their cold bindings.
 const flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),lighting=new EnvironmentLighting();
 const layer=withGraphicsStyle(context,()=>new WildlifeLayer(lighting.configure));
 const library=new BakedAnimalLibrary({cpuBytes:128*MiB,gpuBytes:64*MiB});
 return{context,lighting,layer,library,flush};
}
function testCompiler(){
 const owners:{dispose:()=>void;textureDispose:()=>void}[]=[];
 const compiler=vi.fn<AnimalAtlasCompiler>((input:AnimalAtlasCompileInput)=>{
  input.assertCurrent();const{width,height,mipLevels}=input.charts.atlas;
  // RT metadata only: no renderer/device, no allocation or generated pixels.
  const target=new THREE.RenderTarget(width,height,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,colorSpace:THREE.SRGBColorSpace,depthBuffer:false,stencilBuffer:false,samples:0,generateMipmaps:false});
  target.texture.flipY=false;target.texture.magFilter=THREE.LinearFilter;target.texture.minFilter=THREE.LinearMipmapLinearFilter;target.texture.generateMipmaps=false;
  target.texture.mipmaps=Array.from({length:mipLevels},(_,level)=>({data:new Uint8Array(0),width:width/2**level,height:height/2**level}));
  const gpuBytes=Array.from({length:mipLevels},(_,level)=>width*height*4/4**level).reduce((n,v)=>n+v,0),dispose=vi.fn(()=>target.dispose()),textureDispose=vi.spyOn(target.texture,'dispose');owners.push({dispose,textureDispose});
  return{texture:target.texture,cpuBytes:mipLevels*64,gpuBytes,stats:{testOnly:true,noGpuPixels:true},dispose};
 });
 return{compiler,owners};
}
function request(compiler:AnimalAtlasCompiler):AnimalBakeRequest {
 const pixels=new Uint8Array(16).fill(255);
 return{recipeFingerprint:'TEST-real-product-owners-v1',paletteFingerprint:'TEST-2x2-not-a-visual-oracle',paintFingerprint:'TEST-generation0',compiler,compilerFingerprint:'TEST-no-device-RT-owner',impasto:0,wear:0,edgeWidth:1.7,strokeImperfection:.15,
  chartOptions:{texelsPerUnit:256,paddingTexels:8,mipLevels:4,maxAtlasSize:2048,maxAtlasPixels:2048*2048,maxOutputBytes:32*MiB,maxTriangles:20000},maxInkTriangles:100000,
  paint:{readProfile:()=>({pigment:pixels,paper:pixels,coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up'}),edgeAlpha:{data:pixels,width:2,height:2},lineOpacity:.79,strokeImperfection:.15,brushColorLinear:[.02,.015,.01]},reservation:{cpuBytes:64*MiB,gpuBytes:32*MiB}};
}
function preparation(owner:ReturnType<typeof productOwners>,compiler:AnimalAtlasCompiler):WildlifeBakedPreparation {
 return{library:owner.library,request:()=>request(compiler),isCurrent:()=>true,adoptConfiguredClone:owner.lighting.adoptConfiguredClone,warmup:async()=>{}};
}
async function close(owner:ReturnType<typeof productOwners>){
 await owner.layer.settleBakedSpecies();owner.layer.dispose();owner.library.evictUnused();owner.library.dispose();owner.lighting.dispose();owner.context.dispose();owner.flush.mockRestore();
}
function injure(world:ReturnType<typeof worldWith>){
 const animal=world.wildlife!.animals[0]!,health=animal.health??=createAnimalMedicalRecord256(world,animal);
 // This actual localized injury producer supplies the medical record; the
 // renderer must use its real published blood word, never a test-only flag.
 expect(addResolvedInjury(health,'torso','execution-cut',1000,()=>.999999)).not.toBeNull();expect(bodyBloodWord(health)).toBeGreaterThan(0);return health;
}
function heal(world:ReturnType<typeof worldWith>){
 const animal=world.wildlife!.animals[0]!,health=animal.health!;
 advanceMedical(health,1200,{phase:0,posture:'bed',starving:false},()=>.999999);
 world.tick=health.tick;animal.ageTicks+=1200;expect(health.injuries).toEqual([]);expect(bodyBloodWord(health)).toBe(0);
}

test('actual deer rig publishes atomically, keeps auxiliary shapes/owners through real growth, restores source before preferences and safely retires borrowed aliases',async()=>{
 const owner=productOwners(),{layer,context,library}=owner,{compiler,owners}=testCompiler(),world=worldWith(),animal=world.wildlife!.animals[0]!,gate=deferred(),entered=deferred();
 ensureFireState(world).items=[{id:world.nextId++,x:animal.x,z:animal.z,size:.2,bornCore:0,nextPulseCore:15,complexCore:0,spreadCore:0,attachedAnimalId:animal.id}];
 layer.setSelected(new Set([animal.id]));layer.update(world,undefined,true);
 const mesh=body(layer,'deer'),source=mesh.geometry,sourceMaterial=mesh.material,sourcePosition=source.getAttribute('position'),positionBytes=new Uint8Array(sourcePosition.array.buffer,sourcePosition.array.byteOffset,sourcePosition.array.byteLength).slice(),ink=ribbons(mesh),aux=auxiliary(layer,'deer');
 const auxiliaryShapes=Object.values(aux).map(m=>({mesh:m,geometry:m.geometry,position:Array.from(m.geometry.getAttribute('position').array)})),before=structuredClone(world);
 const options=preparation(owner,compiler);options.warmup=vi.fn(async(next,species)=>{expect(species).toBe('deer');expect(mesh.geometry).toBe(source);expect(ink.visible).toBe(true);expect(next.geometry).not.toBe(source);entered.resolve();await gate.promise;});
 try{
  expect(layer.hasPendingBakedSpecies).toBe(true);expect(aux.selection.visible).toBe(true);expect(aux.fire.visible).toBe(true);
  for(const m of Object.values(aux))expect(m.geometry.getAttribute('aFrom')).toBe(source.getAttribute('aFrom'));
  const pending=layer.prepareBakedSpecies(options);await Promise.race([entered.promise,pending.then(()=>{throw Error('Actual source failed before reaching warmup');})]);
  expect(mesh.geometry).toBe(source);expect(layer.bakedStatus().published).toEqual([]);gate.resolve();
  expect(await pending).toEqual({prepared:['deer'],retained:[],fallback:[]});expect(compiler).toHaveBeenCalledTimes(1);expect(layer.hasPendingBakedSpecies).toBe(false);
  const baked=mesh.geometry,bakedMaterial=mesh.material;expect(baked).not.toBe(source);expect(baked.getAttribute('bakedUv')).toBeDefined();expect(ink.visible).toBe(false);
  expect(layer.bakedStatus().published).toEqual([expect.objectContaining({species:'deer',bodyUsesBakedGeometry:true,bodyUsesBakedMaterial:true,sourceRibbonsVisible:false})]);
  for(const shape of auxiliaryShapes){expect(shape.mesh.geometry).toBe(shape.geometry);expect(Array.from(shape.mesh.geometry.getAttribute('position').array)).toEqual(shape.position);expect(shape.mesh.geometry.getAttribute('aFrom')).toBe(baked.getAttribute('aFrom'));}
  expect(world).toEqual(before);
  layer.setTexturesEnabled(false);expect(mesh.geometry).toBe(baked);expect(mesh.material).not.toBe(bakedMaterial);expect(ink.visible).toBe(true);expect(library.snapshot().leases).toBe(1);
  layer.setTexturesEnabled(true);expect(mesh.material).toBe(bakedMaterial);expect(ink.visible).toBe(false);
  const count=source.getAttribute('aFrom').count+1,grownWorld=structuredClone(world);grownWorld.wildlife!.animals=Array.from({length:count},(_,i)=>({...structuredClone(animal),id:i===0?animal.id:1100+i,x:2+i%28,z:2+Math.floor(i/28)}));grownWorld.nextId=Math.max(grownWorld.nextId,1100+count);
  layer.update(grownWorld,undefined);const grown=mesh.geometry;expect(grown).not.toBe(baked);expect(grown.instanceCount).toBe(count);expect(grown.getAttribute('aFrom').count).toBe(2**Math.ceil(Math.log2(count)));expect(grown.getAttribute('bakedUv').array).toEqual(baked.getAttribute('bakedUv').array);
  for(const shape of auxiliaryShapes){expect(Array.from(shape.mesh.geometry.getAttribute('position').array)).toEqual(shape.position);expectSameOwnerBuffer(shape.mesh.geometry.getAttribute('aFrom'),grown.getAttribute('aFrom'));}
  const currentFrom=grown.getAttribute('aFrom');let aliasAtDisposal:unknown='not disposed';grown.addEventListener('dispose',()=>{aliasAtDisposal=grown.getAttribute('aFrom');});
  layer.invalidateBakedSpecies();expect(mesh.geometry).toBe(source);expect(mesh.material).toBe(sourceMaterial);expect(source.instanceCount).toBe(count);expect(source.getAttribute('aFrom')).toBe(currentFrom);expect(aliasAtDisposal).toBeUndefined();expect(ink.visible).toBe(true);
  for(const shape of auxiliaryShapes)expectSameOwnerBuffer(shape.mesh.geometry.getAttribute('aFrom'),currentFrom);
  expect(new Uint8Array(sourcePosition.array.buffer,sourcePosition.array.byteOffset,sourcePosition.array.byteLength)).toEqual(positionBytes);expect(layer.bakedStatus().published).toEqual([]);expect(library.snapshot().leases).toBe(0);
  context.update({...context.preferences,blackEdges:.3,edgeWidth:2,strokeImperfection:.2});expect(mesh.geometry).toBe(source);expect(context.blackEdges.value).toBe(.3);expect(ink.userData.origamiOwnerVisible).not.toBe(false);
  // The real compact fire path must remain able to read the restored owners.
  layer.presentAnimations();expect(aux.fire.geometry.getAttribute('aFrom').getX(0)).toBe(source.getAttribute('aFrom').getX(0));
 }finally{gate.resolve();await close(owner);}
 expect(owners).toHaveLength(1);expect(owners[0]!.dispose).toHaveBeenCalledTimes(1);expect(owners[0]!.textureDispose).not.toHaveBeenCalled();
},60_000);

test('actual new species joins lazily, a refused budget stays on source without a paused retry loop, and cancelled preparation stays pending',async()=>{
 const owner=productOwners(),{layer,library}=owner,{compiler,owners}=testCompiler();let world=worldWith();layer.update(world,undefined,true);
 let refuseRaccoon=true,current=true;const ask=vi.fn((species:string)=>({...request(compiler),...(species==='raccoon'&&refuseRaccoon?{reservation:{cpuBytes:64*MiB,gpuBytes:65*MiB}}:{})}));
 const options={...preparation(owner,compiler),request:ask,isCurrent:()=>current};
 try{
  expect(await layer.prepareBakedSpecies(options)).toEqual({prepared:['deer'],retained:[],fallback:[]});expect(compiler).toHaveBeenCalledTimes(1);
  world=structuredClone(world);const animal=world.wildlife!.animals[0]!;world.wildlife!.animals.push({...structuredClone(animal),id:901,species:'raccoon',ageTicks:adultAgeTicks('raccoon')});layer.update(world,undefined);
  const raccoon=body(layer,'raccoon'),source=raccoon.geometry,sourceMaterial=raccoon.material;expect(layer.hasPendingBakedSpecies).toBe(true);expect(raccoon.visible).toBe(true);expect(source.hasAttribute('bakedUv')).toBe(false);
  const failed=await layer.prepareBakedSpecies(options);expect(failed.retained).toEqual(['deer']);expect(failed.prepared).toEqual([]);expect(failed.fallback).toEqual([{species:'raccoon',reason:expect.stringMatching(/budget/i)}]);
  expect(compiler).toHaveBeenCalledTimes(1);expect(ask).toHaveBeenCalledTimes(2);expect(raccoon.geometry).toBe(source);expect(raccoon.material).toBe(sourceMaterial);expect(layer.hasPendingBakedSpecies).toBe(false);expect(layer.bakedStatus().fallback).toEqual(failed.fallback);
  // Actual snapshot/paused update opportunities do no preparation themselves.
  layer.update(world,undefined);world=structuredClone(world);world.tick++;layer.update(world,undefined);expect(layer.hasPendingBakedSpecies).toBe(false);expect(ask).toHaveBeenCalledTimes(2);expect(compiler).toHaveBeenCalledTimes(1);
  layer.invalidateBakedSpecies();current=false;expect(layer.hasPendingBakedSpecies).toBe(true);expect(await layer.prepareBakedSpecies(options)).toEqual({prepared:[],retained:[],fallback:[]});expect(layer.hasPendingBakedSpecies).toBe(true);expect(compiler).toHaveBeenCalledTimes(1);expect(raccoon.geometry).toBe(source);
  current=true;refuseRaccoon=false;const recovered=await layer.prepareBakedSpecies(options);expect(recovered.prepared).toEqual(['deer','raccoon']);expect(recovered.fallback).toEqual([]);expect(compiler).toHaveBeenCalledTimes(2);expect(layer.bakedStatus().published.map(row=>row.species)).toEqual(['deer','raccoon']);expect(library.snapshot()).toMatchObject({ready:2,pending:0,leases:2});
  world=structuredClone(world);world.wildlife!.animals=[];layer.update(world,undefined);expect(layer.hasPendingBakedSpecies).toBe(false);expect(layer.bakedStatus().published).toEqual([]);expect(library.snapshot().leases).toBe(0);expect(raccoon.geometry).toBe(source);
 }finally{await close(owner);}
 expect(owners).toHaveLength(2);for(const result of owners)expect(result.dispose).toHaveBeenCalledTimes(1);
},60_000);

test('actual blood suspends only the fused surface, healing resumes the retained atlas and real growth/removal preserve clinical owners',async()=>{
 const owner=productOwners(),{layer,library}=owner,{compiler}=testCompiler();let world=worldWith();layer.update(world,undefined,true);
 const mesh=body(layer,'deer'),source=mesh.geometry,sourceMaterial=mesh.material,ink=ribbons(mesh),options=preparation(owner,compiler);
 try{
  await layer.prepareBakedSpecies(options);const baked=mesh.geometry,atlasMaterial=mesh.material,generation=layer.bakedStatus().generation;
  world=structuredClone(world);injure(world);const clinicalBefore=structuredClone(world);layer.update(world,undefined);
  expect(mesh.geometry).toBe(baked);expect(mesh.material).toBe(sourceMaterial);expect(ink.visible).toBe(true);expect(mesh.geometry.getAttribute('aBodyBlood').getX(0)).toBe(bodyBloodWord(world.wildlife!.animals[0]!.health));
  expect(layer.bakedStatus()).toMatchObject({bloodBlockedSpecies:['deer'],pending:false,generation,published:[{bloodBlocked:true,bodyUsesBakedGeometry:true,bodyUsesBakedMaterial:false,bodyUsesSourceMaterial:true,sourceRibbonsVisible:true}]});
  expect(library.snapshot().leases).toBe(1);expect(compiler).toHaveBeenCalledTimes(1);expect(world).toEqual(clinicalBefore);
  layer.setTexturesEnabled(false);expect(mesh.material).not.toBe(atlasMaterial);layer.setTexturesEnabled(true);expect(mesh.material).toBe(sourceMaterial);expect(ink.visible).toBe(true);
  // Unchanged presentation calls do not add a clinical resident scan.
  const blood=mesh.geometry.getAttribute('aBodyBlood'),read=vi.spyOn(blood,'getX');
  try{layer.update(world,undefined);layer.update(world,undefined);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}
  const recovered=structuredClone(world);heal(recovered);
  // This ordinary fixture uses the real full-snapshot admission boundary.
  // It is not owned by the closed MAIN factory and therefore makes no claim
  // about the separate resident adoptPhase297/playback path.
  layer.update(recovered,undefined);world=recovered;
  expect(mesh.geometry).toBe(baked);expect(mesh.material).toBe(atlasMaterial);expect(ink.visible).toBe(false);expect(layer.hasPendingBakedSpecies).toBe(false);
  expect(layer.bakedStatus().generation).toBe(generation);expect(layer.bakedStatus().bloodBlockedSpecies).toEqual([]);expect(compiler).toHaveBeenCalledTimes(1);expect(library.snapshot().leases).toBe(1);
  const grownWorld=structuredClone(world),template=structuredClone(grownWorld.wildlife!.animals[0]!),count=source.getAttribute('aFrom').count+1;
  grownWorld.wildlife!.animals=Array.from({length:count},(_,i)=>({...structuredClone(template),id:i===0?template.id:1200+i,x:2+i%28,z:2+Math.floor(i/28)}));grownWorld.nextId=Math.max(grownWorld.nextId,1200+count);injure(grownWorld);
  layer.update(grownWorld,undefined);const grown=mesh.geometry;expect(grown).not.toBe(baked);expect(grown.instanceCount).toBe(count);expect(mesh.material).toBe(sourceMaterial);expect(ink.visible).toBe(true);expect(library.snapshot().leases).toBe(1);
  for(const auxiliaryMesh of Object.values(auxiliary(layer,'deer')))expectSameOwnerBuffer(auxiliaryMesh.geometry.getAttribute('aFrom'),grown.getAttribute('aFrom'));
  const removed=structuredClone(grownWorld);removed.wildlife!.animals.shift();layer.update(removed,undefined);
  expect(mesh.geometry).toBe(grown);expect(grown.instanceCount).toBe(count-1);expect(mesh.material).toBe(atlasMaterial);expect(ink.visible).toBe(false);expect(layer.bakedStatus().bloodBlockedSpecies).toEqual([]);expect(layer.hasPendingBakedSpecies).toBe(false);expect(compiler).toHaveBeenCalledTimes(1);
 }finally{await close(owner);}
},60_000);

test('actual carried and corpse blood defer atlas admission without acquisition or paused retries, and deactivation clears the cohort guard',async()=>{
 const owner=productOwners(),{layer,library}=owner,{compiler}=testCompiler();let world=worldWith();const health=injure(world),animal=world.wildlife!.animals[0]!,pawn=world.pawns[0]!;
 animal.state='downed';pawn.animalRescue={animalId:animal.id,spotId:999,phase:'carry'};
 const ask=vi.fn(()=>request(compiler)),options={...preparation(owner,compiler),request:ask};
 layer.update(world,undefined,true);const mesh=body(layer,'deer'),source=mesh.geometry,sourceMaterial=mesh.material,ink=ribbons(mesh);
 try{
  // The real rescue classification enters the carried-animal writer. No pawn
  // renderer is supplied here, so its established missing-carrier fallback
  // supplies the pose; this is a clinical admission contract, not cargo QA.
  expect(mesh.geometry.getAttribute('aBodyBlood').getX(0)).toBe(bodyBloodWord(health));expect(layer.bakedStatus().bloodBlockedSpecies).toEqual(['deer']);expect(layer.hasPendingBakedSpecies).toBe(false);
  expect(await layer.prepareBakedSpecies(options)).toEqual({prepared:[],retained:[],fallback:[{species:'deer',reason:expect.stringMatching(/body blood.*source ink/i)}]});
  expect(ask).not.toHaveBeenCalled();expect(compiler).not.toHaveBeenCalled();expect(library.snapshot().leases).toBe(0);expect(mesh.geometry).toBe(source);expect(mesh.material).toBe(sourceMaterial);expect(ink.visible).toBe(true);
  const dead=structuredClone(world),corpseHealth=structuredClone(health);corpseHealth.bloodLoss=BLOOD_UNIT;reconcileMedicalDeath(corpseHealth);expect(corpseHealth.death).toBeDefined();
  dead.wildlife!.animals=[];delete dead.pawns[0]!.animalRescue;dead.piles=[{id:1100,kind:'corpse',item:'deer-corpse',quantity:1,owner:{type:'ground',x:8,z:9},corpse:{animalId:animal.id,species:'deer',sex:animal.sex,ageTicks:animal.ageTicks,health:corpseHealth}}];dead.nextId=Math.max(dead.nextId,1101);
  layer.update(dead,undefined);expect(mesh.geometry).toBe(source);expect(mesh.geometry.getAttribute('aAnimal').getZ(0)).toBe(2);expect(mesh.geometry.getAttribute('aBodyBlood').getX(0)).toBe(bodyBloodWord(corpseHealth));expect(layer.bakedStatus().bloodBlockedSpecies).toEqual(['deer']);expect(layer.hasPendingBakedSpecies).toBe(false);
  layer.update(dead,undefined);world=structuredClone(dead);world.tick++;layer.update(world,undefined);expect(ask).not.toHaveBeenCalled();expect(compiler).not.toHaveBeenCalled();expect(layer.hasPendingBakedSpecies).toBe(false);
  const empty=structuredClone(world);empty.piles=[];layer.update(empty,undefined);expect(layer.bakedStatus().bloodBlockedSpecies).toEqual([]);expect(layer.hasPendingBakedSpecies).toBe(false);expect(mesh.visible).toBe(false);
  const healthy=worldWith();layer.update(healthy,undefined);expect(layer.hasPendingBakedSpecies).toBe(true);expect(layer.bakedStatus().bloodBlockedSpecies).toEqual([]);
  expect(await layer.prepareBakedSpecies(options)).toEqual({prepared:['deer'],retained:[],fallback:[]});expect(ask).toHaveBeenCalledTimes(1);expect(compiler).toHaveBeenCalledTimes(1);
 }finally{await close(owner);}
},60_000);

test('a real clinical change during warmup cancels publication once, then healing admits the cached resource without repainting',async()=>{
 const owner=productOwners(),{layer,library}=owner,{compiler,owners}=testCompiler(),world=worldWith(),gate=deferred(),entered=deferred(),otherGate=deferred(),otherEntered=deferred();layer.update(world,undefined,true);
 const mesh=body(layer,'deer'),source=mesh.geometry,sourceMaterial=mesh.material,ink=ribbons(mesh),options=preparation(owner,compiler);
 options.warmup=vi.fn(async()=>{entered.resolve();await gate.promise;});
 try{
  const generation=layer.bakedStatus().generation,pending=layer.prepareBakedSpecies(options);
  await Promise.race([entered.promise,pending.then(()=>{throw Error('Actual source failed before reaching clinical warmup');})]);
  const wounded=structuredClone(world);injure(wounded);layer.update(wounded,undefined);
  expect(layer.bakedStatus().generation).toBe(generation+1);expect(layer.hasPendingBakedSpecies).toBe(false);gate.resolve();
  const cancelled=await pending;expect(cancelled.prepared).toEqual([]);expect(cancelled.fallback).toEqual([{species:'deer',reason:expect.stringMatching(/superseded/i)}]);
  expect(mesh.geometry).toBe(source);expect(mesh.material).toBe(sourceMaterial);expect(ink.visible).toBe(true);expect(layer.bakedStatus().published).toEqual([]);expect(library.snapshot()).toMatchObject({ready:1,pending:0,leases:0});
  layer.update(wounded,undefined);expect(layer.hasPendingBakedSpecies).toBe(false);expect(compiler).toHaveBeenCalledTimes(1);
  const recovered=structuredClone(wounded);heal(recovered);layer.update(recovered,undefined);expect(layer.hasPendingBakedSpecies).toBe(true);
  expect(await layer.prepareBakedSpecies(options)).toEqual({prepared:['deer'],retained:[],fallback:[]});expect(compiler).toHaveBeenCalledTimes(1);expect(owners).toHaveLength(1);expect(library.snapshot().leases).toBe(1);expect(ink.visible).toBe(false);expect(layer.hasPendingBakedSpecies).toBe(false);
  // Retained deer transitions must not cancel a different species' warmup.
  const joined=structuredClone(recovered),template=joined.wildlife!.animals[0]!;
  joined.wildlife!.animals.push({...structuredClone(template),id:901,species:'raccoon',ageTicks:adultAgeTicks('raccoon'),health:undefined});layer.update(joined,undefined);
  const normalRequest=options.request,ask=vi.fn((species:Parameters<WildlifeBakedPreparation['request']>[0])=>({...normalRequest(species),...(species==='raccoon'?{reservation:{cpuBytes:64*MiB,gpuBytes:65*MiB}}:{})}));options.request=ask;
  const refused=await layer.prepareBakedSpecies(options);expect(refused).toEqual({prepared:[],retained:['deer'],fallback:[{species:'raccoon',reason:expect.stringMatching(/budget/i)}]});expect(ask).toHaveBeenCalledTimes(1);expect(layer.hasPendingBakedSpecies).toBe(false);
  const refusedGeneration=layer.bakedStatus().generation,budgetWounded=structuredClone(joined);injure(budgetWounded);layer.update(budgetWounded,undefined);
  expect(mesh.material).toBe(sourceMaterial);expect(layer.bakedStatus()).toMatchObject({generation:refusedGeneration,pending:false,fallback:refused.fallback});
  const budgetHealed=structuredClone(budgetWounded);heal(budgetHealed);layer.update(budgetHealed,undefined);
  expect(layer.bakedStatus()).toMatchObject({generation:refusedGeneration,pending:false,fallback:refused.fallback});expect(ask).toHaveBeenCalledTimes(1);expect(compiler).toHaveBeenCalledTimes(1);
  // Only this explicit preparation opportunity retries the refused species.
  options.request=normalRequest;layer.setTexturesEnabled(false);layer.setTexturesEnabled(true);expect(layer.hasPendingBakedSpecies).toBe(true);
  options.warmup=vi.fn(async(_next,species)=>{expect(species).toBe('raccoon');otherEntered.resolve();await otherGate.promise;});
  const joining=layer.prepareBakedSpecies(options);await Promise.race([otherEntered.promise,joining.then(()=>{throw Error('Actual raccoon failed before reaching warmup');})]);
  const joiningGeneration=layer.bakedStatus().generation,retainedWounded=structuredClone(budgetHealed);injure(retainedWounded);layer.update(retainedWounded,undefined);
  expect(mesh.material).toBe(sourceMaterial);expect(layer.bakedStatus().generation).toBe(joiningGeneration);
  const retainedHealed=structuredClone(retainedWounded);heal(retainedHealed);layer.update(retainedHealed,undefined);
  expect(layer.bakedStatus().generation).toBe(joiningGeneration);expect(ink.visible).toBe(false);otherGate.resolve();
  expect(await joining).toEqual({prepared:['raccoon'],retained:['deer'],fallback:[]});expect(compiler).toHaveBeenCalledTimes(2);expect(library.snapshot().leases).toBe(2);expect(layer.hasPendingBakedSpecies).toBe(false);
 }finally{gate.resolve();otherGate.resolve();await close(owner);}
 for(const result of owners)expect(result.dispose).toHaveBeenCalledTimes(1);
},60_000);

test('real blood-free species capability rejects a wounded warmup and switches to source immediately on later blood, then resumes the same clean atlas',async()=>{
 const owner=productOwners(),{layer,library}=owner,{compiler,owners}=testCompiler(),gate=deferred(),entered=deferred();let world=worldWith();layer.update(world,undefined,true);
 const mesh=body(layer,'deer'),source=mesh.geometry,sourceMaterial=mesh.material,ink=ribbons(mesh),options=preparation(owner,compiler),warmCapabilities:boolean[]=[];
 options.warmup=vi.fn(async binding=>{warmCapabilities.push(binding.material.userData.origamiBakedBloodFree===true);entered.resolve();await gate.promise;});
 try{
  const pending=layer.prepareBakedSpecies(options);await Promise.race([entered.promise,pending.then(()=>{throw Error('No actual guarded warmup reached');})]);expect(warmCapabilities).toEqual([true]);
  world=structuredClone(world);injure(world);layer.update(world,undefined);expect(mesh.geometry.getAttribute('aBodyBlood').getX(0)).not.toBe(0);gate.resolve();const rejected=await pending;
  expect(rejected.prepared).toEqual([]);expect(rejected.fallback).toEqual([{species:'deer',reason:expect.stringMatching(/superseded/i)}]);expect(mesh.geometry).toBe(source);expect(mesh.material).toBe(sourceMaterial);expect(ink.visible).toBe(true);expect(layer.hasPendingBakedSpecies).toBe(false);expect(library.snapshot().leases).toBe(0);
  world=structuredClone(world);heal(world);layer.update(world,undefined);expect(layer.hasPendingBakedSpecies).toBe(true);expect(await layer.prepareBakedSpecies(options)).toEqual({prepared:['deer'],retained:[],fallback:[]});
  const baked=mesh.geometry,atlasMaterial=mesh.material;if(Array.isArray(atlasMaterial))throw Error('Expected the single guarded species material');expect(atlasMaterial.userData.origamiBakedBloodFree).toBe(true);expect(warmCapabilities).toEqual([true,true]);expect(compiler).toHaveBeenCalledOnce();expect(layer.bakedStatus().published).toEqual([expect.objectContaining({atlasMaterialBloodFree:true,bloodBlocked:false,bodyUsesBakedMaterial:true})]);
  world=structuredClone(world);injure(world);layer.update(world,undefined);expect(mesh.geometry).toBe(baked);expect(mesh.material).toBe(sourceMaterial);expect(ink.visible).toBe(true);expect(layer.bakedStatus().published).toEqual([expect.objectContaining({atlasMaterialBloodFree:true,bloodBlocked:true,bodyUsesBakedMaterial:false,bodyUsesSourceMaterial:true})]);expect(library.snapshot().leases).toBe(1);expect(layer.hasPendingBakedSpecies).toBe(false);
  world=structuredClone(world);heal(world);layer.update(world,undefined);expect(mesh.geometry).toBe(baked);expect(mesh.material).toBe(atlasMaterial);expect(ink.visible).toBe(false);expect(mesh.geometry.getAttribute('aBodyBlood').getX(0)).toBe(0);expect(compiler).toHaveBeenCalledOnce();expect(layer.hasPendingBakedSpecies).toBe(false);
 }finally{gate.resolve();await close(owner);}
 expect(owners).toHaveLength(1);expect(owners[0]!.dispose).toHaveBeenCalledOnce();
},60_000);

test('real lighting/exploration owners adopt only the already composed clone and bind it without changing its graphs',()=>{
 const lighting=new EnvironmentLighting(),source=actorExplorationMaterial256(new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true}));source.positionNode=positionLocal;lighting.configure(source);
 const clone=source.clone(),changed=source.clone(),wrongOwner=source.clone(),orphan=new THREE.MeshStandardNodeMaterial(),orphanClone=orphan.clone(),geometry=new THREE.BoxGeometry(1,1,1),scene=new THREE.Scene();
 try{
  clone.colorNode=vec3(.3,.4,.5);expect(source.outputNode).not.toBeNull();expect(lighting.adoptConfiguredClone(source,clone)).toBe(true);
  const graphs={position:clone.positionNode,normal:clone.normalNode,mask:clone.maskNode,shadow:clone.maskShadowNode,output:clone.outputNode},version=clone.version;
  scene.add(new THREE.Mesh(geometry,clone));lighting.exploration.bind(scene);lighting.configure(clone);expect(clone.version).toBe(version);
  expect(clone.positionNode).toBe(graphs.position);expect(clone.normalNode).toBe(graphs.normal);expect(clone.maskNode).toBe(graphs.mask);expect(clone.maskShadowNode).toBe(graphs.shadow);expect(clone.outputNode).toBe(graphs.output);
  changed.maskShadowNode=bool(false);expect(lighting.adoptConfiguredClone(source,changed)).toBe(false);changed.maskShadowNode=source.maskShadowNode;expect(lighting.adoptConfiguredClone(source,changed)).toBe(true);
  wrongOwner.userData.explorationActor=false;expect(lighting.adoptConfiguredClone(source,wrongOwner)).toBe(false);expect(lighting.adoptConfiguredClone(orphan,orphanClone)).toBe(false);
  // Restoring a role flag does not admit a changed pose graph either.
  wrongOwner.userData.explorationActor=true;wrongOwner.positionNode=positionLocal.add(vec3(0));expect(lighting.exploration.adoptConfiguredClone(source,wrongOwner)).toBe(false);
 }finally{geometry.dispose();for(const material of [source,clone,changed,wrongOwner,orphan,orphanClone])material.dispose();lighting.dispose();}
});
