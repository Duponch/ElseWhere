/** PRIVATE, NOT RUN; intended tests/fixed-tree-one-fetch-components.test.ts.
 * Real Source models and final surface graph. Tiny bank bytes are lifecycle
 * metadata, never painter, Native, final image or performance evidence. */
import{expect,test}from'vitest';
import*as THREE from'three/webgpu';
import{positionLocal,vec3}from'three/tsl';
import type{World,Resource}from'../src/sim/types';
import{TreeModels}from'../src/render/models/TreeModels';
import{FixedTreeCohorts}from'../src/render/models/FixedTreeCohort';
import{FixedTreeTextureSurface,fixedTreePaintKey}from'../src/render/surfaces/FixedTreeTextureSurface';
import{GraphicsStyleContext}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{copyPastelTextureToArray,type TextureSurfaceSlot}from'../src/render/surfaces/TextureSurface';
import{createStylizedSurfaceTexture}from'../src/render/stylized-surfaces';
import type{TreeAssetCatalog}from'../src/render/origami/baked/trees/types';
import{writeTestFileSync}from'./test-output';

const world=(resources:Resource[]):World=>({seed:61103,width:32,height:32,tick:0,resources,site:{biome:'temperate-forest'}}as unknown as World);
const tree=(id:number,species:'poplar'|'oak',growth=1):Resource=>({id,kind:'tree',species,x:id,z:5,amount:40,growth});
function fixture(){
 const models=new TreeModels(),cohorts=new FixedTreeCohorts(models),context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),source=createStylizedSurfaceTexture('vegetation'),pastel=copyPastelTextureToArray(source),pastelAssets={texture:pastel,uvAddress:'raw' as const,slots:Array.from({length:64},()=>({layer:0,paletteBaked:false}))},fast=new FixedTreeTextureSurface(context,pastelAssets,{positionNode:positionLocal,color:vec3(.4,.6,.3),baseline:vec3(.4,.6,.3)});
 const banks:THREE.DataArrayTexture[]=[];let bankDisposals=0;
 const bank=(plan:ReturnType<FixedTreeCohorts['inspect']>)=>{const depth=Math.max(2,plan.models.length),texture=new THREE.DataArrayTexture(new Uint8Array(2*2*4*depth),2,2,depth);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.addEventListener('dispose',()=>{bankDisposals++;});banks.push(texture);const slots:TextureSurfaceSlot[]=Array.from({length:64},()=>({layer:0,paletteBaked:false}));plan.models.forEach((model,layer)=>{slots[model.surfaceSlot]={layer,paletteBaked:true};});const catalog:TreeAssetCatalog={revision:banks.length,texture,pageCount:depth,modelKeys:plan.models.map(m=>m.key),slots,assertCurrent(){}};return{catalog,paintKey:fixedTreePaintKey(context)};};
 return{models,cohorts,context,fast,pastel,pastelAssets,bank,bankDisposals:()=>bankDisposals,dispose(){fast.dispose();cohorts.dispose();models.dispose();context.dispose();source.dispose();pastel.dispose();for(const bank of banks)bank.dispose();}};
}

test('prospective actual tree cohort excludes anonymous trees and growth, and commits only the actually presented World',()=>{
 const models=new TreeModels(),cohorts=new FixedTreeCohorts(models),a=world([tree(1,'poplar'),tree(2,'oak'),{id:3,kind:'tree',x:4,z:6,amount:10}]);
 try{const before=JSON.stringify(a),first=cohorts.inspect(a,{immutableSnapshot:true});expect(first.traversal).toBe('full');expect(first.models).toHaveLength(2);expect(cohorts.snapshot().namedTrees).toBe(0);expect(JSON.stringify(a)).toBe(before);cohorts.commit(first);
  const growth=cohorts.inspect(world([tree(1,'poplar',.3),tree(2,'oak',.8)]),{immutableSnapshot:true});expect(growth.key).toBe(first.key);expect(growth.models).toEqual(first.models);expect(growth.traversal).toBe('full');expect(cohorts.snapshot().namedTrees).toBe(2);
  const mutable=world([tree(1,'poplar')]),stale=cohorts.inspect(mutable,{immutableSnapshot:true});mutable.resources[0]!.species='oak';expect(stale.isCurrent()).toBe(false);expect(()=>cohorts.commit(stale)).toThrow('Stale');
  const latest=cohorts.inspect(world([tree(1,'poplar'),tree(2,'poplar')]));expect(latest.models).toHaveLength(1);expect(latest.key).not.toBe(first.key);expect(cohorts.snapshot().species).toBe(2);cohorts.commit(latest);expect(cohorts.snapshot()).toMatchObject({namedTrees:2,species:1});expect(()=>cohorts.commit(growth)).toThrow('Stale');
 }finally{cohorts.dispose();models.dispose();}
});

test('the real fixed-tree surface compiles cold with one array/sampler and no fragment storage or Direct graph',()=>{
 const f=fixture(),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement});renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const plan=f.cohorts.inspect(world([tree(1,'poplar')])),geometry=plan.models[0]!.parts[0]!.geometry.clone(),mesh=new THREE.Mesh(geometry,f.fast.surface.material),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(mesh,sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 interface Binding{isSampledTexture?:boolean;isSampler?:boolean;isStorageBuffer?:boolean;visibility:number;texture?:THREE.Texture}
 interface Builder{scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;build():void;getBindings():{bindings:Binding[]}[]}
 try{const Constructor=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Builder,b=new Constructor(mesh,renderer);b.scene=scene;b.camera=camera;b.material=f.fast.surface.material;b.lightsNode=new THREE.LightsNode().setLights([sun,sky]);b.build();const bindings=b.getBindings().flatMap(g=>g.bindings),sampled=bindings.filter(x=>x.isSampledTexture);writeTestFileSync('artifacts/fixed-tree-one-fetch-fragment.wgsl',b.fragmentShader);writeTestFileSync('artifacts/fixed-tree-one-fetch-vertex.wgsl',b.vertexShader);writeTestFileSync('artifacts/fixed-tree-one-fetch-bindings.json',JSON.stringify({scope:'Cold actual Source model/component graph; tiny test bank, no Native/painter/performance evidence',bindings:bindings.map(x=>({sampled:!!x.isSampledTexture,sampler:!!x.isSampler,storage:!!x.isStorageBuffer,visibility:x.visibility,texture:x.texture?.uuid??null}))})+'\n');expect(sampled).toHaveLength(1);expect(sampled[0]!.texture).toBe(f.pastel);expect(bindings.filter(x=>x.isSampler&&!x.isSampledTexture)).toHaveLength(1);expect(bindings.filter(x=>x.isStorageBuffer&&(x.visibility&2)!==0)).toHaveLength(0);expect(b.fragmentShader).not.toContain('textureDimensions');expect(renderer.initialized).toBe(false);
 }finally{mesh.removeFromParent();geometry.dispose();f.dispose();}
},120000);

test('cold Pastel and admitted P/G/P keep the same final material, graph, model and texture owners',()=>{
 const f=fixture();
 try{const plan=f.cohorts.inspect(world([tree(1,'poplar'),tree(2,'oak')])),material=f.fast.surface.material,color=material.colorNode,position=material.positionNode,model=plan.models[0]!,geometry=model.parts[0]!.geometry,positions=geometry.getAttribute('position'),words=positions.array.slice();
  const initial=f.fast.prepare(undefined,plan,()=>{});initial.publish();initial.commit();initial.dispose();expect(f.fast.surface.assets.texture).toBe(f.pastel);expect(f.fast.assertDrawable()).toBeUndefined();
  f.context.update({...f.context.preferences,style:'origami'});expect(()=>f.fast.assertDrawable()).toThrow('admission');expect(f.fast.surface.assets.texture).toBe(f.pastel);
  const bank=f.bank(plan),stage=f.fast.prepare(bank,plan,()=>{});stage.publish();stage.commit();stage.dispose();expect(f.fast.surface.assets.texture).toBe(bank.catalog.texture);expect(f.fast.assertDrawable()).toBeUndefined();
  for(const style of['default','origami','default']as const){f.context.update({...f.context.preferences,style});expect(f.fast.surface.material).toBe(material);expect(material.colorNode).toBe(color);expect(material.positionNode).toBe(position);expect(f.fast.surface.assets.texture).toBe(style==='origami'?bank.catalog.texture:f.pastel);expect(geometry.getAttribute('position')).toBe(positions);expect(positions.array).toEqual(words);expect(f.fast.assertDrawable()).toBeUndefined();}
  expect(f.bankDisposals()).toBe(0);f.fast.dispose();expect(f.bankDisposals()).toBe(0);model.assertCurrent();
 }finally{f.dispose();}
});

test('new Gouache model cannot publish against an incomplete bank, and closing stage restores prior binding without a live renderer gate',()=>{
 const f=fixture();try{const initial=f.cohorts.inspect(world([tree(1,'poplar')]));f.context.update({...f.context.preferences,style:'origami'});const old=f.bank(initial),first=f.fast.prepare(old,initial,()=>{});first.publish();first.commit();first.dispose();
  const expanded=f.cohorts.inspect(world([tree(1,'poplar'),tree(2,'oak')]));expect(()=>f.fast.prepare(old,expanded,()=>{})).toThrow('Complete');expect(f.fast.status().models).toBe(1);expect(f.fast.surface.assets.texture).toBe(old.catalog.texture);
  const next=f.bank(expanded);let closing=false;const gate=()=>{if(closing)throw Error('TEST closed');},stage=f.fast.prepare(next,expanded,gate);stage.publish();expect(f.fast.status().models).toBe(2);closing=true;expect(()=>f.fast.dispose()).toThrow('Settle');expect(()=>stage.dispose()).not.toThrow();expect(f.fast.status().models).toBe(1);expect(f.fast.surface.assets.texture).toBe(old.catalog.texture);expect(f.bankDisposals()).toBe(0);
 }finally{f.dispose();}
});

test('paint mismatch cannot relabel a cached bank and an empty cohort detaches its borrowed Gouache texture',()=>{
 const f=fixture();try{const plan=f.cohorts.inspect(world([tree(1,'poplar')]));f.context.update({...f.context.preferences,style:'origami'});const old=f.bank(plan),stage=f.fast.prepare(old,plan,()=>{});stage.publish();stage.commit();stage.dispose();f.context.update({...f.context.preferences,edgeWidth:f.context.preferences.edgeWidth+.1});expect(()=>f.fast.assertDrawable()).toThrow('admission');expect(()=>f.fast.prepare(old,plan,()=>{})).toThrow('different paint');
  const empty=f.cohorts.inspect(world([])),clear=f.fast.prepare(undefined,empty,()=>{});clear.publish();clear.commit();clear.dispose();expect(f.fast.status().models).toBe(0);expect(f.fast.status().bank).toBeNull();expect(f.fast.surface.assets.texture).toBe(f.pastel);expect(f.bankDisposals()).toBe(0);
 }finally{f.dispose();}
});
