/** Actual ResourceLayer/common models/surface. Only Canvas painting uses TEST
 * sink pixels; tiny array textures are metadata, not cooked atlas pixels.
 * No renderer/device, simulation execution, visual or timing claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-paint-library',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:s.stubReferenceBakeToSink};});
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:s.stubResidentPaintToSink};});
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:s.stubCheckpointPaintToSink,replayCheckpointMaskR8:s.stubReplayCheckpointMaskR8};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {fixedTreePaintKey} from '../src/render/surfaces/FixedTreeTextureSurface';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ResourceLayer,type PreparedTreeCatalogStage} from '../src/render/ResourceLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import type {TreeAssetCatalog} from '../src/render/origami/baked/trees/types';
import type {ResourceRangeData} from '../src/render/StaticGeometry';
import type {Resource} from '../src/sim/types';
import type {TreeModel} from '../src/render/models/TreeModels';
import type {TextureSurfaceSlot} from '../src/render/surfaces/TextureSurface';
import {StaticSceneCompiler435} from '../src/render/StaticSceneCompiler435';
import {writeTestFileSync} from './test-output';

const settings={impasto:0,wear:0,edges:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6};
function bodies(group:THREE.Group){const rows:THREE.Mesh[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh&&!o.userData.referenceCompanion)rows.push(o);});return rows;}
const trees=(group:THREE.Group)=>bodies(group).filter(m=>m.geometry.hasAttribute('surfaceUv')&&Math.floor(m.geometry.getAttribute('origamiPaint').getW(0)/128)%32<31);
function stream(group:THREE.Group,id:number,name:string){const out:number[]=[];for(const m of bodies(group)){const data=m.userData.resourceRanges as ResourceRangeData|undefined,a=m.geometry.getAttribute(name);if(!data||!a)continue;for(const r of data.ranges)if(r.id===id||r.id===-id*2)for(let i=r.start;i<r.start+r.count;i++)for(let k=0;k<a.itemSize;k++)out.push(a.getComponent(data.original[i]!,k));}return out;}
function record(){return{width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},resources:[{id:1001,kind:'tree',species:'poplar',x:8,z:8,amount:1,growth:1},{id:1002,kind:'tree',species:'poplar',x:9,z:8,amount:1,growth:1},{id:1003,kind:'rock',x:10,z:8,amount:1}] as Resource[],structures:[],pawns:[{id:7,x:7,z:8,state:'working',jobId:91}],jobs:[{id:91,kind:'chop',x:8,z:8,status:'active',reservedBy:7,progress:0}]};}
type Input=ReturnType<typeof record>;
function update(layer:ResourceLayer,input:Input,newMap:boolean,leafless:ReadonlySet<number>=new Set()){const before=JSON.stringify(input);Reflect.apply(layer.update,layer,[input,newMap,undefined,undefined,{read:(r:Resource)=>({size:r.growth??1,ripe:true,leafless:leafless.has(r.id)}),harvestable:()=>false}]);expect(JSON.stringify(input)).toBe(before);}
function make(style:'default'|'origami'){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,...settings}),environment=new EnvironmentLighting(),group=new THREE.Group(),plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshLambertNodeMaterial({vertexColors:true}),pastel=createStylizedSurfaceTexture('vegetation'),configure=vi.fn(environment.configure);
 plain.userData.rendererOwned=paint.userData.rendererOwned=true;environment.configure(plain);environment.configure(paint);const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint,undefined,{pastelTexture:pastel,configure}));
 return{context,environment,group,layer,configure,dispose(){layer.dispose();plain.dispose();paint.dispose();pastel.dispose();environment.dispose();context.dispose();}};
}
function catalog(models:readonly TreeModel[],revision:number,context:GraphicsStyleContext){
 const depth=Math.max(2,models.length),texture=new THREE.DataArrayTexture(new Uint8Array(2*2*4*depth),2,2,depth);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;
 const slots:TextureSurfaceSlot[]=Array.from({length:64},()=>({layer:0,paletteBaked:false}));models.forEach((model,i)=>{slots[model.surfaceSlot]={layer:i,paletteBaked:true};});let live=true;
 const bank:TreeAssetCatalog={paintKey:fixedTreePaintKey(context),revision,texture,pageCount:depth,modelKeys:models.map(m=>m.key),slots,assertCurrent(){if(!live)throw Error('TEST texture epoch expired');}};
 return{bank,texture,expire(){live=false;},dispose(){live=false;texture.dispose();}};
}
function refs(group:THREE.Group){return trees(group).map(mesh=>{if(Array.isArray(mesh.material))throw Error('A common tree uses one material');const material=mesh.material as THREE.NodeMaterial;return{mesh,parent:mesh.parent,geometry:mesh.geometry,material,version:material.version,hooks:[material.colorNode,material.positionNode,material.outputNode,material.maskNode,material.maskShadowNode,material.castShadowPositionNode,material.receivedShadowPositionNode],index:mesh.geometry.index,indexArray:mesh.geometry.index?.array,ranges:mesh.userData.resourceRanges,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,{a,array:a.array,bytes:new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength).slice()}]))};});}
function sameRefs(before:ReturnType<typeof refs>,bytes=true){for(const old of before){expect(old.mesh.parent).toBe(old.parent);expect(old.mesh.geometry).toBe(old.geometry);expect(old.mesh.material).toBe(old.material);expect(old.material.version).toBe(old.version);[old.material.colorNode,old.material.positionNode,old.material.outputNode,old.material.maskNode,old.material.maskShadowNode,old.material.castShadowPositionNode,old.material.receivedShadowPositionNode].forEach((node,i)=>expect(node).toBe(old.hooks[i]));expect(old.geometry.index).toBe(old.index);expect(old.geometry.index?.array).toBe(old.indexArray);expect(old.mesh.userData.resourceRanges).toBe(old.ranges);for(const[name,row]of Object.entries(old.attributes)){const a=old.geometry.getAttribute(name);expect(a).toBe(row.a);expect(a.array).toBe(row.array);if(bytes)expect(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)).toEqual(row.bytes);}}}

test('shared tree surface publishes and withdraws only texture data while real ranges, preview, growth, leaves and recoil retain Source owners',()=>{
 const f=make('origami'),source=make('default'),input=record(),stages:PreparedTreeCatalogStage[]=[],banks:ReturnType<typeof catalog>[]=[];let surfaceRetirements=0,borrowedTextureRetirements=0;
 try{
  update(f.layer,input,true);update(source.layer,input,true);expect(f.configure).toHaveBeenCalledTimes(3);const demand=f.layer.treeBakeDemand(),model=demand.models[0]!;expect(demand.models).toHaveLength(1);expect(model.species).toBe('poplar');expect(model.variant).toBe('broadleaf');expect(f.layer.bakedTreeStatus()).toMatchObject({total:2,ready:0,fallback:2,fallbackReason:'source-face-paint-until-bank-ready'});
  const meshes=trees(f.group);expect(meshes).toHaveLength(2);const initial=refs(f.group),materials435=f.layer.compiledMaterials435();expect(new Set(meshes.map(m=>m.material)).size).toBe(1);
  for(const mesh of meshes){expect(mesh.material).toBeInstanceOf(THREE.MeshLambertNodeMaterial);expect((mesh.material as THREE.NodeMaterial).normalNode).toBeNull();const surface=mesh.geometry.getAttribute('surfaceUv'),paint=mesh.geometry.getAttribute('origamiPaint');expect(surface.itemSize).toBe(4);expect(mesh.geometry.hasAttribute('bakedUv')).toBe(false);for(let v=0;v<surface.count;v++)expect(Math.floor(paint.getW(v)/128)%32).toBe(model.surfaceSlot);}
  for(const id of [1001,1002])for(const field of ['position','normal','uv'])expect(stream(f.group,id,field)).toEqual(stream(source.group,id,field));expect(stream(f.group,1001,'position')).toHaveLength(60*9);
  const first=catalog(demand.models,1,f.context);banks.push(first);first.texture.addEventListener('dispose',()=>borrowedTextureRetirements++);const stage=f.layer.prepareTreeAssetCatalog(first.bank,f.environment.configure);stages.push(stage);expect(stage.warmup).toHaveLength(2);const surfaceMats=stage.warmup.map(m=>m.material as THREE.MeshLambertNodeMaterial);expect(new Set(surfaceMats).size).toBe(2);expect(surfaceMats.every(m=>m instanceof THREE.MeshLambertNodeMaterial)).toBe(true);surfaceMats.forEach(m=>m.addEventListener('dispose',()=>surfaceRetirements++));expect(f.configure).toHaveBeenCalledTimes(3);
  const materialChanges=vi.fn(),attributeChanges=vi.fn();f.layer.compiledMaterialsChanged435=materialChanges;f.layer.compiledAttributeChanged435=attributeChanges;
  const publication=stage.publish();publication.commit();stage.dispose();sameRefs(initial);expect(f.layer.compiledMaterials435()).toEqual(materials435);expect(materialChanges).not.toHaveBeenCalled();expect(attributeChanges).not.toHaveBeenCalled();expect(f.layer.bakedTreeStatus()).toMatchObject({ready:2,fallback:0,texturePages:2,revision:1});expect(surfaceRetirements).toBe(0);
  const colors=[1001,1002].map(id=>stream(f.group,id,'color')),baseline=stream(f.group,1001,'origamiPaint');f.layer.setTargetPreview(new Set([1001]));expect(stream(f.group,1001,'color')).not.toEqual(colors[0]);expect(stream(f.group,1002,'color')).toEqual(colors[1]);expect(stream(f.group,1001,'origamiPaint')).toEqual(baseline);sameRefs(initial,false);expect(attributeChanges).toHaveBeenCalled();expect(materialChanges).not.toHaveBeenCalled();f.layer.clearTargetPreview();expect([1001,1002].map(id=>stream(f.group,id,'color'))).toEqual(colors);sameRefs(initial);
  f.layer.setTexturesEnabled(false);expect(meshes.every(m=>m.material===surfaceMats[1])).toBe(true);f.layer.setTexturesEnabled(true);sameRefs(initial);expect(f.configure).toHaveBeenCalledTimes(3);
  const beforeTextureOnlyAttributes=attributeChanges.mock.calls.length,second=catalog(demand.models,2,f.context);banks.push(second);const replacement=f.layer.prepareTreeAssetCatalog(second.bank);stages.push(replacement);expect(replacement.warmup.map(m=>m.material)).toEqual(surfaceMats);const swap=replacement.publish();sameRefs(initial);swap.rollback();swap.commit();replacement.dispose();sameRefs(initial);expect(f.layer.bakedTreeStatus().revision).toBe(1);expect(surfaceRetirements).toBe(0);
  const removal=f.layer.setTreeDirectFallback('TEST explicit direct retirement');for(const row of initial){expect(row.mesh.geometry).toBe(row.geometry);expect(row.mesh.material).not.toBe(row.material);}expect(f.layer.bakedTreeStatus().ready).toBe(0);removal.rollback();removal.commit();sameRefs(initial);expect(f.layer.bakedTreeStatus().ready).toBe(2);
  const expired=catalog(demand.models,3,f.context);banks.push(expired);const pending=f.layer.prepareTreeAssetCatalog(expired.bank);stages.push(pending);expired.expire();expect(()=>pending.publish()).toThrow('epoch expired');pending.dispose();sameRefs(initial);expect(f.layer.bakedTreeStatus().revision).toBe(1);
  const badSlots=first.bank.slots.map(row=>({...row}));badSlots[model.surfaceSlot]={layer:1,paletteBaked:true};expect(()=>f.layer.prepareTreeAssetCatalog({...first.bank,slots:badSlots})).toThrow('Complete compatible tree texture bank');sameRefs(initial);
  // A staging copy owns only its geometry. Failed retirement must surface the
  // error while preserving both persistent materials and the borrowed bank.
  const badCleanup=f.layer.prepareTreeAssetCatalog(first.bank);stages.push(badCleanup);badCleanup.warmup[0]!.geometry.addEventListener('dispose',()=>{throw Error('TEST staging geometry cleanup failed');});expect(()=>badCleanup.dispose()).toThrow('Tree publication staging cleanup failed');sameRefs(initial);expect(surfaceRetirements).toBe(0);expect(borrowedTextureRetirements).toBe(0);expect(attributeChanges).toHaveBeenCalledTimes(beforeTextureOnlyAttributes);
  const beforeWind=stream(f.group,1001,'position');f.layer.setWind(1,.7,.3);f.layer.presentWind(123);expect(stream(f.group,1001,'position')).toEqual(beforeWind);sameRefs(initial);
  input.resources[0]!.growth=.63;update(f.layer,input,false);update(source.layer,input,false);for(const id of [1001,1002]){const actual=stream(f.group,id,'position'),expected=stream(source.group,id,'position');expect(actual).toHaveLength(expected.length);expect(Math.max(...actual.map((v,i)=>Math.abs(v-expected[i]!)))).toBeLessThan(2e-6);}sameRefs(initial,false);
  const canopy=meshes.find(m=>m.name==='tree-canopy')!,index=canopy.geometry.index!,visible=canopy.geometry.drawRange.count;update(f.layer,input,false,new Set([1001]));expect(canopy.geometry.drawRange.count).toBe(visible/2);update(f.layer,input,false);expect(canopy.geometry.index).toBe(index);expect(canopy.geometry.drawRange.count).toBe(visible);sameRefs(initial,false);
  const phase=7*1.7-1.5*Math.PI;let tick=2;while(Math.floor((11*tick/6+phase)/(2*Math.PI))===Math.floor((11*(tick-1)/6+phase)/(2*Math.PI)))tick++;input.tick=tick-1;const next=structuredClone(input);next.tick=tick;next.jobs[0]!.progress=1;const at=(Math.floor((11*tick/6+phase)/(2*Math.PI))*2*Math.PI-phase)/11,beforeChop=stream(f.group,1001,'position'),other=stream(f.group,1002,'position');Reflect.apply(f.layer.adoptChopWork,f.layer,[input,next]);f.layer.presentChop(at+.09);expect(stream(f.group,1001,'position')).not.toEqual(beforeChop);expect(stream(f.group,1002,'position')).toEqual(other);f.layer.clearChopRecoil();expect(stream(f.group,1001,'position')).toEqual(beforeChop);
  const healthy=stream(f.group,1001,'color'),healthyBaseline=stream(f.group,1001,'origamiPaint'),position=stream(f.group,1001,'position');input.resources[0]!.blight={since:0,severity:.5,lastHarmTick:0,nextCheck:200,rng:1};update(f.layer,input,false);const sickPosition=stream(f.group,1001,'position');expect(sickPosition).toHaveLength(position.length);expect(Math.max(...sickPosition.map((v,i)=>Math.abs(v-position[i]!)))).toBeLessThan(2e-6);expect(stream(f.group,1001,'color')).not.toEqual(healthy);expect(stream(f.group,1001,'origamiPaint')).toEqual(healthyBaseline);expect(f.layer.treeBakeDemand().models[0]).toBe(model);expect(f.layer.bakedTreeStatus()).toMatchObject({ready:2,fallback:0});delete input.resources[0]!.blight;update(f.layer,input,false);expect(stream(f.group,1001,'color')).toEqual(healthy);expect(stream(f.group,1001,'origamiPaint')).toEqual(healthyBaseline);
  expect(materialChanges).toHaveBeenCalledTimes(2);expect(surfaceRetirements).toBe(0);expect(borrowedTextureRetirements).toBe(0);f.layer.dispose();expect(surfaceRetirements).toBe(2);expect(borrowedTextureRetirements).toBe(0);
 }finally{for(const stage of stages)stage.dispose();f.dispose();source.dispose();for(const bank of banks)bank.dispose();}
},45_000);

test('actual resource models survive optional-feature boundaries while fixed and complete direct materials are selected explicitly',()=>{
 const f=make('default'),input=record();
 try{
  update(f.layer,input,true);const before=bodies(f.group).map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,index:mesh.geometry.index,position:mesh.geometry.getAttribute('position')}));
  expect(Reflect.get(f.layer,'wearFlora')).toBeUndefined();expect(Reflect.get(f.layer,'wearTemplates')).toBeUndefined();
  f.context.update({...f.context.preferences,style:'origami'});f.context.prepareSharedSurfaceAssets();
  const unchanged=(material=true)=>{for(const row of before){expect(row.mesh.geometry).toBe(row.geometry);if(material)expect(row.mesh.material).toBe(row.material);expect(row.geometry.index).toBe(row.index);expect(row.geometry.getAttribute('position')).toBe(row.position);}};
  unchanged();expect(f.layer.bakedTreeStatus()).toMatchObject({ready:0,fallback:2});
  f.context.update({...f.context.preferences,impasto:.2,wear:.4,edges:.65});unchanged(false);
  expect(bodies(f.group)).toEqual(before.map(row=>row.mesh));expect(f.group.children.flatMap(group=>group.children).some(mesh=>mesh.userData.referenceCompanion==='wear')).toBe(true);
  for(const row of before)if((row.mesh.material as THREE.NodeMaterial).colorNode!==null)expect((row.mesh.material as THREE.NodeMaterial).normalNode).not.toBeNull();
  f.context.update({...f.context.preferences,impasto:0,wear:0});unchanged();expect(Reflect.get(f.layer,'wearFlora')).toBeUndefined();expect(Reflect.get(f.layer,'wearTemplates')).toBeUndefined();expect(f.group.children.flatMap(group=>group.children).some(mesh=>mesh.userData.referenceCompanion)).toBe(false);expect(f.context.reliefLod).toBeUndefined();
  f.context.update({...f.context.preferences,style:'default'});unchanged();
 }finally{f.dispose();}
},45_000);

test('real mixed resource bodies, tree surfaces and staging views compile cold with packed eight-buffer layouts',()=>{
 const f=make('default'),input=record(),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold source inspection cannot initialize a device');});renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),hemisphere=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(f.group,sun,hemisphere);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 type Inspector={scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];build():unknown;getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];getBindings():{bindings:{visibility:number;isSampledTexture?:boolean}[]}[];};const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Inspector;let stage:PreparedTreeCatalogStage|undefined;
 try{
  input.width=128;input.height=128;input.resources[2]!.x=80;input.resources[2]!.z=80;input.resources.push({id:1004,kind:'tree',x:11,z:8,amount:1,growth:1});update(f.layer,input,true);stage=f.layer.prepareTreeAssetCatalog(undefined);scene.add(...stage.warmup);scene.updateMatrixWorld(true);const facts:unknown[]=[];
  const unique=new Map<THREE.Material,THREE.Mesh>();for(const mesh of [...bodies(f.group),...stage.warmup])unique.set(mesh.material as THREE.Material,mesh);
  for(const [material,mesh]of unique){const b=new Builder(mesh,renderer);b.scene=scene;b.camera=camera;b.material=material;b.lightsNode=new THREE.LightsNode().setLights([sun,hemisphere]);b.build();const attrs=b.getAttributesArray().flatMap(a=>{const attribute=a.node?.attribute??mesh.geometry.getAttribute(a.name);return attribute?[{name:a.name,attribute}]:[];}),buffers=new Set(attrs.map(({attribute:a})=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)),bindings=b.getBindings().flatMap(group=>group.bindings).filter(binding=>binding.isSampledTexture);expect(attrs.length).toBeLessThanOrEqual(16);expect(buffers.size,attrs.map(a=>a.name).join(',')).toBeLessThanOrEqual(8);expect(b.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);for(const bit of [1,2])expect(bindings.filter(binding=>(binding.visibility&bit)!==0).length).toBeLessThanOrEqual(16);expect((material as THREE.NodeMaterial).normalNode).toBeNull();expect(material.transparent).toBe(false);expect(b.fragmentShader).not.toContain('origamiGlobalRelief');facts.push({material:material.type,attributes:attrs.map(a=>[a.name,a.attribute.itemSize]),buffers:buffers.size,varyings:b.varyings.filter(v=>v.needsInterpolation).map(v=>v.name)});writeTestFileSync(`artifacts/shared-resource-${facts.length}-fragment.wgsl`,b.fragmentShader);}
  expect(unique.size).toBe(3);expect(init).not.toHaveBeenCalled();writeTestFileSync('artifacts/shared-resource-program-facts.json',JSON.stringify({scope:'Actual ResourceLayer and staging, source paint sink, cold WGSL only; no device, image or performance claim',facts},null,2)+'\n');
 }finally{stage?.dispose();f.dispose();init.mockRestore();}
},60_000);


/** The tiny bank is a binding/publication fixture, never a visual paint oracle. */
test('fixed one-fetch and complete direct resource families retain the same packed models and435 pages across texture changes',()=>{
 const f=make('default'),input=record(),scene=new THREE.Scene(),compiler=new StaticSceneCompiler435(scene),banks:ReturnType<typeof catalog>[]=[],stages:PreparedTreeCatalogStage[]=[];
 input.resources.push({id:1004,kind:'tree',x:11,z:8,amount:1,growth:1});
 let materialDisposals=0;
 try{
  update(f.layer,input,true);scene.add(f.group);scene.updateMatrixWorld(true);
  const meshes=bodies(f.group),material=meshes[0]!.material as THREE.NodeMaterial;
  expect(meshes.length).toBeGreaterThanOrEqual(4);expect(new Set(meshes.map(m=>m.material)).size).toBe(2);
  const attributes=['color','normal','origamiPaint','position','surfaceUv','uv','windBasis','windRoot'];
  let cached=0,direct=0;
  for(const mesh of meshes){
   expect(Object.keys(mesh.geometry.attributes).sort()).toEqual(attributes);
   const paint=mesh.geometry.getAttribute('origamiPaint'),root=mesh.geometry.getAttribute('windRoot');
   for(let i=0;i<paint.count;i++){const slot=Math.floor(paint.getW(i)/128)%32;if(slot===31)direct++;else cached++;}
   const ranges=mesh.userData.resourceRanges as ResourceRangeData;
   for(const r of ranges.ranges)if(r.id===1003)for(let i=r.vertexStart;i<r.vertexStart+r.vertexCount;i++)expect([root.getX(i),root.getY(i),root.getZ(i)]).toEqual([0,0,0]);
  }
  expect(cached).toBeGreaterThan(0);expect(direct).toBeGreaterThan(0);
  const triangles=meshes.reduce((sum,m)=>sum+Math.min(m.geometry.drawRange.count,m.geometry.index!.count)/3,0);
  const originals=meshes.map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,index:mesh.geometry.index,fields:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,{attribute:a,array:a.array,bytes:new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength).slice()}]))}));
  compiler.reconcile([f.group],f.layer.compiledMaterials435());const pages=[...compiler.meshes()],facts=compiler.snapshot();
  expect(facts).toMatchObject({candidateFamilies:2,pageObjects:2,sourceObjects:meshes.length,unmergedNativeObjects:0,sourceActiveTriangles:triangles,compiledActiveTriangles:triangles,fallbacks:0});
  expect(facts.pages.flatMap(page=>page.blocks)).toHaveLength(meshes.length);expect(facts.pages.reduce((n,page)=>n+page.sources,0)).toBe(meshes.length);
  const bank=catalog(f.layer.treeBakeDemand().models,31,f.context);banks.push(bank);const stage=f.layer.prepareTreeAssetCatalog(bank.bank);stages.push(stage);stage.warmup.forEach(mesh=>(mesh.material as THREE.Material).addEventListener('dispose',()=>materialDisposals++));
  const published=stage.publish();published.commit();stage.dispose();
  for(const style of ['origami','default','origami','default'] as const){
   f.context.update({...f.context.preferences,style});compiler.syncVisibility();expect(compiler.meshes()).toEqual(pages);expect(compiler.stats.reconciles).toBe(1);
   for(const row of originals){expect(row.mesh.material).toBe(row.material);expect(row.mesh.geometry).toBe(row.geometry);expect(row.geometry.index).toBe(row.index);for(const[k,a]of Object.entries(row.fields)){const actual=row.geometry.getAttribute(k);expect(actual).toBe(a.attribute);expect(actual.array).toBe(a.array);expect(new Uint8Array(actual.array.buffer,actual.array.byteOffset,actual.array.byteLength)).toEqual(a.bytes);}}
  }
  compiler.clear();f.layer.setTexturesEnabled(false);expect(new Set(meshes.map(m=>m.material)).size).toBe(1);f.layer.setTexturesEnabled(true);for(const row of originals)expect(row.mesh.material).toBe(row.material);expect(materialDisposals).toBe(0);
 }finally{compiler.dispose();for(const stage of stages)stage.dispose();f.dispose();for(const bank of banks)bank.dispose();}
 expect(materialDisposals).toBe(2);
},60_000);
