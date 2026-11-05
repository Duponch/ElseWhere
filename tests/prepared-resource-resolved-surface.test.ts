/** Actual Resource models/merged streams, final factory and real Three shadow
 * override. Only CPU cold builders/uniform packing; no device/atlas pixels. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {Fn,sharedUniformGroup,uniform} from 'three/tsl';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const stub=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {PreparedTextureSurface} from '../src/render/surfaces/PreparedTextureSurface';
import {resourceResolvedTextureInputs} from '../src/render/surfaces/ResourceResolvedAddresses';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import type {Resource} from '../src/sim/types';
import {writeTestFileSync} from './test-output';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';
import {inspectBiInkOccupancyProgram} from './bi-ink-occupancy-wgsl';

interface Binding {
 name:string;visibility:number;isSampledTexture?:boolean;isStorageBuffer?:boolean;
 isUniformsGroup?:boolean;isSampler?:boolean;texture?:THREE.Texture;update?:()=>boolean;
}
interface BuilderPort {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];
 updateNodes:THREE.Node[];build():unknown;
 getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];
 getBindings():{bindings:Binding[]}[];
}
const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;

function fixture(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0,edges:0}),
  flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),lighting=new EnvironmentLighting(),
  plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshLambertNodeMaterial({vertexColors:true}),
  pastel=createStylizedSurfaceTexture('vegetation'),group=new THREE.Group();
 lighting.configure(plain);lighting.configure(paint);
 const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint,undefined,{pastelTexture:pastel,configure:lighting.configure})),
  input={width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},resources:[
   {id:1001,kind:'tree',species:'poplar',x:8,z:8,amount:1,growth:1},
   {id:1002,kind:'tree',species:'oak',x:9,z:8,amount:1,growth:1},
   {id:1003,kind:'rock',x:10,z:8,amount:1},
  ] as Resource[],structures:[],pawns:[],jobs:[]};
 Reflect.apply(layer.update,layer,[input,true,undefined,undefined,{read:(r:Resource)=>({size:r.growth??1,ripe:true,leafless:false}),harvestable:()=>false}]);
 const source=Reflect.get(layer,'bodyTextured') as THREE.MeshLambertNodeMaterial,
  groupUniform=sharedUniformGroup('resourceResolvedSurfaceCold',0,null),treeLayers=uniform(2).setGroup(groupUniform),
  inputs=resourceResolvedTextureInputs(context,treeLayers),
  // The resolved path must not even build the obsolete coordinate graph.
  forbidden=Fn(()=>{throw Error('Resolved resident UV must not evaluate a legacy UV branch');})() as unknown as THREE.Node<'vec2'>,
  surface=new PreparedTextureSurface({...inputs,address:inputs.addressWithoutBook,context,sourceMaterial:source,pastelTexture:pastel,pastelUv:forbidden,resources:{sharedGroups:[groupUniform]},configure:lighting.configure}),
  atlas=new THREE.DataArrayTexture(new Uint8Array(2*2*14*4),2,2,14),meshes:THREE.Mesh[]=[];
 atlas.colorSpace=THREE.SRGBColorSpace;atlas.flipY=false;atlas.minFilter=THREE.LinearMipmapLinearFilter;atlas.magFilter=THREE.LinearFilter;
 group.traverse(object=>{if(object instanceof THREE.Mesh&&object.geometry.hasAttribute('surfaceUv')&&!object.userData.referenceCompanion)meshes.push(object);});
 if(!meshes.length)throw Error('Actual merged Resource meshes absent');
 return{context,lighting,plain,paint,pastel,group,layer,source,surface,treeLayers,groupUniform,atlas,meshes,close(){surface.dispose();context.surfacePreparation.dispose();layer.dispose();plain.dispose();paint.dispose();pastel.dispose();atlas.dispose();context.dispose();lighting.dispose();flush.mockRestore();}};
}

test('resolved Resource final surface keeps direct resident UV and no address SSBO in first Pastel/Gouache and real shadow CPU packing',()=>{
 const f=fixture(),renderer=new THREE.WebGPURenderer({canvas:{width:64,height:64,style:{}}as HTMLCanvasElement}),
  init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold resolved Resource contract must not create a device');}),
  scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-6,6,4,-4,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight(),
  shadowNode=new THREE.ShadowNode(sun,sun.shadow),shadow=shadowNode.getShadowMaterial(),dispatch=Reflect.get(renderer,'_handleObjectFunction');
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
 Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 scene.add(f.group,sun,sky);camera.position.set(15,12,16);camera.lookAt(9,1,8);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
 const material=f.surface.material,pureGraph=f.surface.material.colorNode,positions=f.meshes.map(m=>m.geometry.getAttribute('position')),geometries=f.meshes.map(m=>m.geometry),
  originals=f.meshes.map(m=>m.material),uvs=f.meshes.map(m=>m.geometry.getAttribute('uv')),nodes=[material.positionNode,material.maskNode,material.maskShadowNode,material.outputNode];
 let pass:'main'|'shadow'='main',style:'default'|'origami'='default',compiled=0,sourceRoute=false,relief=0;
 try{
  expect(f.source.normalNode).toBeNull();expect(f.surface.material).toBe(material);
  Reflect.set(renderer,'_handleObjectFunction',(object:THREE.Object3D,actualMaterial:THREE.Material)=>{
   const mesh=object as THREE.Mesh,saved=mesh.material,label='resolved-resource-'+style+'-'+(sourceRoute?'source-'+relief:'pure')+'-'+pass+'-'+mesh.name;
   expect(actualMaterial).toBe(pass==='shadow'?shadow:material);mesh.material=actualMaterial;
   try{
    const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=actualMaterial;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
    const bindings=builder.getBindings().flatMap(group=>group.bindings),frame=new THREE.NodeFrame();frame.renderer=renderer;frame.scene=scene;frame.camera=camera;frame.object=mesh;frame.material=actualMaterial;frame.frameId=1;frame.renderId=1;
    mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);mesh.normalMatrix.getNormalMatrix(mesh.modelViewMatrix);
    for(const node of builder.updateNodes)frame.updateNode(node);for(const binding of bindings)if(binding.isUniformsGroup){if(!binding.update)throw Error('Actual uniform group update required');binding.update();}
    const attributes=builder.getAttributesArray().flatMap(a=>{const v=a.node?.attribute??mesh.geometry.getAttribute(a.name);return v?[v]:[];}),storage=bindings.filter(b=>b.isStorageBuffer),vsStorage=[...builder.vertexShader.matchAll(/\bvar\s*<\s*storage\b[^>]*>\s+(\w+)\s*:/g)].map(m=>m[1]),fsStorage=[...builder.fragmentShader.matchAll(/\bvar\s*<\s*storage\b[^>]*>\s+(\w+)\s*:/g)].map(m=>m[1]);
    writeTestFileSync('artifacts/'+label+'-vertex.wgsl',builder.vertexShader);writeTestFileSync('artifacts/'+label+'-fragment.wgsl',builder.fragmentShader);
    writeTestFileSync('artifacts/'+label+'-bindings.json',JSON.stringify({scope:'Actual merged Resource/final factory/main or real shadow override; cold CPU packing only, no atlas pixel or GPU claim',style,pass,materialType:actualMaterial.type,sourceAttributes:Object.keys(mesh.geometry.attributes),attributes:attributes.length,buffers:new Set(attributes.map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)).size,varyings:builder.varyings,vsStorage,fsStorage,bindings:bindings.map(b=>({name:b.name,visibility:b.visibility,storage:!!b.isStorageBuffer,sampled:!!b.isSampledTexture,nativeIsSampler:!!b.isSampler,sampler:!!b.isSampler&&!b.isSampledTexture,bindingClass:b.constructor.name,texture:b.texture?.uuid}))},null,2));
    if(!sourceRoute){expect(storage).toEqual([]);expect(vsStorage).toEqual([]);expect(fsStorage).toEqual([]);}for(const bit of[1,2]){const visible=bindings.filter(b=>(b.visibility&bit)!==0);expect(visible.filter(b=>b.isStorageBuffer).length).toBeLessThanOrEqual(8);expect(visible.filter(b=>b.isSampledTexture).length).toBeLessThanOrEqual(16);expect(visible.filter(b=>b.isSampler&&!b.isSampledTexture).length).toBeLessThanOrEqual(16);}expect(builder.vertexShader).not.toContain('preparedSurfaceTerminal');expect(builder.vertexShader).not.toContain('FORBIDDEN');if(!sourceRoute){expect(builder.fragmentShader).not.toContain('origamiEndpointPigment');expect(builder.fragmentShader).not.toContain('v_surfaceStroke');}else if(pass==='main')expect(bindings.some(b=>b.isSampledTexture&&b.texture?.name==='Actual tree polygon fallback metadata')).toBe(true);
    expect(attributes.length).toBeLessThanOrEqual(16);expect(new Set(attributes.map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)).size).toBeLessThanOrEqual(8);expect(builder.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);expect(builder.getBindings().length).toBeLessThanOrEqual(4);
    expect(unboundWgslTextureResources(builder.vertexShader)).toEqual([]);expect(unboundWgslTextureResources(builder.fragmentShader)).toEqual([]);
    if(pass==='main'&&!sourceRoute){const occupancy=inspectBiInkOccupancyProgram(builder.fragmentShader,{bodyVariable:'preparedGouacheBody',dxVariable:'preparedSurfaceDx',dyVariable:'preparedSurfaceDy',formatToken:'v_preparedSurfaceFormat',resultVariable:'preparedSurfaceColor'});writeTestFileSync('artifacts/'+label+'-occupancy-program.json',JSON.stringify(occupancy,null,2));expect(occupancy.errors).toEqual([]);const bound=f.surface.snapshot().boundTexture;expect(bindings.filter(b=>b.isSampledTexture&&b.texture?.uuid===bound)).toHaveLength(1);expect(bindings.filter(b=>b.isSampler&&!b.isSampledTexture&&b.texture?.uuid===bound)).toHaveLength(1);}
    compiled++;
   }finally{mesh.material=saved;}
  });
  for(const nextStyle of ['default','origami']as const){style=nextStyle;f.context.update({...f.context.preferences,style});f.treeLayers.value=style==='origami'?2:0;f.groupUniform.needsUpdate=true;f.surface.setAssets(style==='origami'?{texture:f.atlas,assertCurrent(){}}:undefined);f.surface.selectRepresentation('pure');f.surface.assertReady();expect(material.colorNode).toBe(pureGraph);
   for(const nextPass of ['main','shadow']as const){pass=nextPass;scene.overrideMaterial=pass==='shadow'?shadow:null;for(const mesh of f.meshes){mesh.material=material;renderer.renderObject(mesh,scene,camera,mesh.geometry,material,null,new THREE.LightsNode().setLights([sun,sky]));}}
  }
  sourceRoute=true;for(const nextRelief of[0,.2]){relief=nextRelief;f.context.update({...f.context.preferences,style:'origami',impasto:relief,wear:0});f.surface.selectRepresentation('source');expect(material.colorNode).toBe(f.source.colorNode);expect(material.normalNode).toBe(f.source.normalNode);for(const nextPass of['main','shadow']as const){pass=nextPass;scene.overrideMaterial=pass==='shadow'?shadow:null;for(const mesh of f.meshes){mesh.material=material;renderer.renderObject(mesh,scene,camera,mesh.geometry,material,null,new THREE.LightsNode().setLights([sun,sky]));}}}
  expect(compiled).toBe(f.meshes.length*8);expect(init).not.toHaveBeenCalled();expect(f.surface.material).toBe(material);
  for(let i=0;i<f.meshes.length;i++){expect(f.meshes[i]!.geometry).toBe(geometries[i]);expect(f.meshes[i]!.geometry.getAttribute('position')).toBe(positions[i]);expect(f.meshes[i]!.geometry.getAttribute('uv')).toBe(uvs[i]);}
  [material.positionNode,material.maskNode,material.maskShadowNode,material.outputNode].forEach((node,i)=>expect(node).toBe(nodes[i]));
 }finally{Reflect.set(renderer,'_handleObjectFunction',dispatch);scene.overrideMaterial=null;for(let i=0;i<f.meshes.length;i++)f.meshes[i]!.material=originals[i]!;shadowNode.disposeShadowMaterial();f.close();init.mockRestore();}
},60_000);

test('resolved Resource final surface keeps its exact complete Source fallback on the same material and borrowed model',()=>{
 const f=fixture(),material=f.surface.material,geometry=f.meshes[0]!.geometry,position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 try{
  f.surface.selectRepresentation('source');expect(material.colorNode).toBe(f.source.colorNode);expect(material.normalNode).toBe(f.source.normalNode);expect(material.positionNode).toBe(f.source.positionNode);expect(material.maskNode).toBe(f.source.maskNode);expect(material.maskShadowNode).toBe(f.source.maskShadowNode);expect(material.outputNode).toBe(f.source.outputNode);
  f.context.update({...f.context.preferences,style:'origami'});f.surface.setAssets({texture:f.atlas,assertCurrent(){}});f.surface.selectRepresentation('pure');const pure=material.colorNode;expect(pure).not.toBe(f.source.colorNode);f.surface.assertReady();
  f.surface.selectRepresentation('source');expect(material.colorNode).toBe(f.source.colorNode);expect(material.normalNode).toBe(f.source.normalNode);f.surface.selectRepresentation('pure');expect(material.colorNode).toBe(pure);
  expect(f.surface.material).toBe(material);expect(f.meshes[0]!.geometry).toBe(geometry);expect(geometry.getAttribute('position')).toBe(position);expect(geometry.getAttribute('uv')).toBe(uv);
 }finally{f.close();}
});
