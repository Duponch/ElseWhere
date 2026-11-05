/** Actual Timber producer, registry, material and EnvironmentLighting. No device,
 * fake owner or atlas preparation. Three's real renderObject override dispatch
 * and shadow-node factory run; only its final GPU submission is intercepted. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {TimberCladdingLayer} from '../src/render/TimberCladdingLayer';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {createWorld} from '../src/sim/engine';
import {writeTestFileSync} from './test-output';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';

interface Binding {
 name:string;visibility:number;isSampledTexture?:boolean;isStorageBuffer?:boolean;
 isUniformsGroup?:boolean;texture?:THREE.Texture;update?:()=>boolean;
}
interface BuilderPort {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];
 updateNodes:THREE.Node[];build():unknown;
 getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];
 getBindings():{bindings:Binding[]}[];
}
const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;

test('actual Timber wall/eave first-Pastel and real shadow overrides compile and pack live uniforms without a device',async()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),
  lighting=new EnvironmentLighting(),layer=withGraphicsStyle(context,()=>new TimberCladdingLayer(lighting.configure)),
  world=createWorld(7,16,16),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100),
  sun=new THREE.DirectionalLight(0xffffff,2),sky=new THREE.HemisphereLight(0xffffff,0x808080,1),
  renderer=new THREE.WebGPURenderer({canvas:{width:64,height:64,style:{}}as HTMLCanvasElement}),
  shadowNode=new THREE.ShadowNode(sun,sun.shadow),shadow=shadowNode.getShadowMaterial(),
  init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold Timber contract must not create a device');}),
  originalDispatch=Reflect.get(renderer,'_handleObjectFunction');
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
 Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});
 Reflect.set(renderer.backend,'renderer',renderer);
 world.structures=[{id:world.nextId++,kind:'wall',material:'wood',x:3,z:4,orientation:0,footprint:'legacy-single'}];
 world.jobs=[];scene.add(layer.group,sun,sky);camera.position.set(7,6,9);camera.lookAt(3,1,4);camera.updateMatrixWorld(true);
 let pass:'main'|'shadow'='main',compiled=0;
 try{
  layer.update(world,false,true);lighting.exploration.bind(scene);
  expect(layer.wallMesh.activeCount).toBeGreaterThan(0);expect(layer.eaveMesh.activeCount).toBeGreaterThan(0);
  const material=layer.material,position=material.positionNode,mask=material.maskNode,output=material.outputNode;
  const stage=await context.surfacePreparation.stage({preferences:{...context.preferences},world,reset:false,reason:'initial',epoch:1,renderer,paintRevision:context.preparedPaintRevision,density:{mode:'orthographic',physicalCellPixels:40}},()=>{});
  try{stage.publish();stage.commit();}finally{stage.dispose();}
  context.surfacePreparation.assertReadyForDraw();
  expect(layer.preparedSurfaceStatus()).toMatchObject({representation:'pure',fallback:'Pastel-original',activeVariants:expect.any(Number)});
  expect(layer.material).toBe(material);expect(material.positionNode).toBe(position);expect(material.maskNode).toBe(mask);expect(material.outputNode).toBe(output);expect(material.map).toBeNull();
  material.color.setRGB(.31,.47,.59);expect(Reflect.get(shadow,'color')).toBeUndefined();
  scene.updateMatrixWorld(true);
  // Intercept only the device-submission boundary. The preceding real Three
  // renderObject call installs its actual shadow color/mask/position graphs.
  Reflect.set(renderer,'_handleObjectFunction',(object:THREE.Object3D,actualMaterial:THREE.Material)=>{
   const mesh=object as typeof layer.wallMesh,saved=mesh.material,label=mesh.name+'-'+pass;
   expect(actualMaterial).toBe(pass==='shadow'?shadow:material);
   if(pass==='shadow')expect((actualMaterial as THREE.NodeMaterial).positionNode).toBe(material.positionNode);
   mesh.material=actualMaterial;
   try{
    const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=actualMaterial;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);
    builder.build();
    const bindings=builder.getBindings().flatMap(group=>group.bindings),frame=new THREE.NodeFrame();
    frame.renderer=renderer;frame.scene=scene;frame.camera=camera;frame.object=mesh;frame.material=actualMaterial;frame.frameId=1;frame.renderId=1;
    mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);mesh.normalMatrix.getNormalMatrix(mesh.modelViewMatrix);
    for(const node of builder.updateNodes)frame.updateNode(node);
    // Native V62 got beyond WGSL: undefined.color failed here in updateColor.
    // Exercise that same real CPU packer rather than only inspecting strings.
    for(const binding of bindings)if(binding.isUniformsGroup){if(!binding.update)throw Error('Actual uniform group update required');binding.update();}
    writeTestFileSync('artifacts/'+label+'-cold-vertex.wgsl',builder.vertexShader);writeTestFileSync('artifacts/'+label+'-cold-fragment.wgsl',builder.fragmentShader);
    const attributes=builder.getAttributesArray().flatMap(a=>{const value=a.node?.attribute??mesh.geometry.getAttribute(a.name);return value?[value]:[];}),fragmentStorage=[...builder.fragmentShader.matchAll(/\bvar\s*<\s*storage\b[^>]*>\s+(\w+)\s*:/g)].map(match=>match[1]);
    writeTestFileSync('artifacts/'+label+'-cold-bindings.json',JSON.stringify({scope:'Actual cold graph and CPU uniform updates; no GPU/pixel/performance claim',actualMaterial:actualMaterial.type,hasColor:Reflect.get(actualMaterial,'color')!==undefined,uniformGroups:bindings.filter(b=>b.isUniformsGroup).length,updates:builder.updateNodes.map(n=>n.constructor.name),fragmentStorage,varyings:builder.varyings,attributes:attributes.length},null,2));
    expect(unboundWgslTextureResources(builder.vertexShader)).toEqual([]);expect(unboundWgslTextureResources(builder.fragmentShader)).toEqual([]);
    expect(attributes.length).toBeLessThanOrEqual(16);expect(new Set(attributes.map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)).size).toBeLessThanOrEqual(8);expect(builder.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);
    for(const bit of[1,2]){const visible=bindings.filter(b=>(b.visibility&bit)!==0);expect(visible.filter(b=>b.isStorageBuffer).length).toBeLessThanOrEqual(8);expect(visible.filter(b=>b.isSampledTexture).length).toBeLessThanOrEqual(16);}
    expect(fragmentStorage).toEqual([]);compiled++;
   }catch(error){writeTestFileSync('artifacts/'+label+'-cold-error.json',JSON.stringify({scope:'Actual Timber graph and real override CPU packer; no GPU',name:mesh.name,pass,material:actualMaterial.type,hasColor:Reflect.get(actualMaterial,'color')!==undefined,attributes:Object.keys(mesh.geometry.attributes),error:error instanceof Error?error.stack:String(error)},null,2));throw error;}
   finally{mesh.material=saved;}
  });
  for(const nextPass of['main','shadow']as const){pass=nextPass;scene.overrideMaterial=pass==='shadow'?shadow:null;for(const mesh of[layer.wallMesh,layer.eaveMesh]){expect(mesh.material).toBe(material);renderer.renderObject(mesh,scene,camera,mesh.geometry,material,null,new THREE.LightsNode().setLights([sun,sky]));expect(mesh.material).toBe(material);}}
  expect(compiled).toBe(4);expect(init).not.toHaveBeenCalled();
 }finally{Reflect.set(renderer,'_handleObjectFunction',originalDispatch);scene.overrideMaterial=null;shadowNode.disposeShadowMaterial();context.surfacePreparation.dispose();layer.dispose();context.dispose();lighting.dispose();init.mockRestore();}
},60_000);
