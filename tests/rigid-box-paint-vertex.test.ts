/** Actual Source primitive/owners and cold WGSL only. No GPU, visual or
 * performance equivalence is inferred from these contracts. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');return{...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
import {assertUnitBoxPaintGeometry} from '../src/render/surfaces/RigidBoxPaintUv';
import {compileNaturalSurfaceModels} from '../src/render/surfaces/NaturalSurfaceModels';
import {createSandbagGeometry} from '../src/render/sandbag-parts';
import {createChunkGeometry} from '../src/render/chunk-shape';
import {ITEM_SHAPES} from '../src/render/item-geometry';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {BoxBatches} from '../src/render/BoxBatches';
import {DoorLayer} from '../src/render/DoorLayer';
import {StaticSceneCompiler435} from '../src/render/StaticSceneCompiler435';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {writeTestFileSync} from './test-output';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';

test('rigid pigment capability proves actual unit-box corners/normal/UV orientations and refuses other Source models',()=>{
 const source=new THREE.BoxGeometry(),models=compileNaturalSurfaceModels([source]),bad=models.geometries[0]!.clone(),sandbag=createSandbagGeometry(),chunk=createChunkGeometry();
 try{expect(()=>assertUnitBoxPaintGeometry(source)).not.toThrow();expect(()=>assertUnitBoxPaintGeometry(models.geometries[0]!)).not.toThrow();bad.getAttribute('uv').setX(0,.37);expect(()=>assertUnitBoxPaintGeometry(bad)).toThrow(/orientation/);expect(()=>assertUnitBoxPaintGeometry(sandbag)).toThrow();expect(()=>assertUnitBoxPaintGeometry(chunk)).toThrow();}
 finally{bad.dispose();models.dispose();source.dispose();sandbag.dispose();chunk.dispose();}
});

interface BuilderPort {scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];build():void;getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];getBindings():{bindings:{name:string;isSampledTexture?:boolean;isStorageBuffer?:boolean;visibility:number;texture?:THREE.Texture}[]}[]}
const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;
for(const impasto of [0,.2])test(`actual furniture and sliding-door graphs place rigid metric in vertex only at strict zero (${impasto}) and keep non-box fallback`,()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),lighting=new EnvironmentLighting(),group=new THREE.Group(),boxes=withGraphicsStyle(context,()=>new BoxBatches(lighting.configure)),door=withGraphicsStyle(context,()=>new DoorLayer()),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold contract must not create a device');});
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(group,door.group,sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 try{
  boxes.set(group,'furniture',[{key:1,x:0,y:.4,z:0,sx:1.7,sy:.11,sz:.63,ry:.7,color:0xb39154}]);boxes.set(group,'sandbags',[{key:2,x:2,y:.4,z:0,sx:1.2,sy:.7,sz:.8,color:0x8a8676}]);
  boxes.set(group,'test-item',[{key:3,x:3,y:.3,z:0,sx:.3,sy:.6,sz:.2,shape:ITEM_SHAPES[0],color:0x9a8e75}]);boxes.set(group,'test-rock',[{key:4,x:4,y:.2,z:0,sx:.3,sy:.4,sz:.3,shape:'rounded-rock',color:0x817567}]);
  const furniture=group.children.find(o=>o.name==='furniture')as THREE.Mesh,sandbag=group.children.find(o=>o.name==='sandbags')as THREE.Mesh;expect(furniture).toBeDefined();expect(sandbag).toBeDefined();
  const item=group.children.find(o=>o.name==='test-item')as THREE.Mesh,rock=group.children.find(o=>o.name==='test-rock:rounded-rock')as THREE.Mesh;expect(item).toBeDefined();expect(rock).toBeDefined();
  door.mesh.activeCount=1;door.mesh.setMatrixAt(0,new THREE.Matrix4().makeScale(.45,2.1,.12));door.mesh.setColorAt(0,new THREE.Color(.7,.5,.3));
  const saved=[furniture,sandbag,door.mesh,item,rock].map(mesh=>({mesh,geometry:mesh.geometry,index:mesh.geometry.index?.array.slice(),attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,{attribute:a,words:a.array.slice()}])),material:mesh.material,node:(mesh.material as THREE.NodeMaterial).colorNode}));
  // Real435 explicitly excludes these instanced producers. No boxMatrix
  // lookup is ever introduced into the ordinary arena's programs/geometry.
  const compiler=new StaticSceneCompiler435(scene);try{compiler.reconcile([group],saved.map(row=>row.material as THREE.NodeMaterial));expect(compiler.snapshot().pageObjects).toBe(0);expect(compiler.snapshot().rejected['non-ordinary-geometry']).toBeGreaterThanOrEqual(2);}finally{compiler.dispose();}
  for(const [i,mesh]of[furniture,sandbag,door.mesh,item,rock].entries()){
   scene.updateMatrixWorld(true);const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=mesh.material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
   const attrs=builder.getAttributesArray().map(a=>a.node?.attribute??mesh.geometry.getAttribute(a.name)).filter((a):a is THREE.BufferAttribute|THREE.InterleavedBufferAttribute=>!!a),buffers=new Set(attrs.map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)),varyings=builder.varyings.filter(v=>v.needsInterpolation),bindings=builder.getBindings().flatMap(g=>g.bindings),label=`rigid-prop-${impasto}-${i}`;
   writeTestFileSync(`artifacts/${label}-vertex.wgsl`,builder.vertexShader);writeTestFileSync(`artifacts/${label}-fragment.wgsl`,builder.fragmentShader);writeTestFileSync(`artifacts/${label}-facts.json`,JSON.stringify({scope:'Cold actual producer only, placeholder paint bytes; no quality/device/timing claim',attrs:attrs.length,buffers:buffers.size,varyings:varyings.map(v=>v.name),sampled:bindings.filter(b=>b.isSampledTexture).map(b=>b.name)})+'\n');
   expect(builder.vertexShader.includes('rigidBoxVertexMetric')).toBe(impasto===0&&(i===0||i===2));expect(builder.fragmentShader).not.toContain('rigidBoxVertexMetric');expect(attrs.length).toBeLessThanOrEqual(16);expect(buffers.size).toBeLessThanOrEqual(8);expect(varyings.length).toBeLessThanOrEqual(16);for(const bit of[1,2])expect(bindings.filter(b=>b.isSampledTexture&&(b.visibility&bit)!==0).length).toBeLessThanOrEqual(16);expect(unboundWgslTextureResources(builder.vertexShader)).toEqual([]);expect(unboundWgslTextureResources(builder.fragmentShader)).toEqual([]);
  }
  for(const style of['origami','default','origami']as const){context.update({...context.preferences,style});for(const row of saved){expect(row.mesh.geometry).toBe(row.geometry);expect(row.mesh.material).toBe(row.material);expect((row.mesh.material as THREE.NodeMaterial).colorNode).toBe(row.node);expect(row.mesh.geometry.index?.array).toEqual(row.index);for(const[name,a]of Object.entries(row.attributes)){expect(row.mesh.geometry.getAttribute(name)).toBe(a.attribute);expect(row.mesh.geometry.getAttribute(name).array).toEqual(a.words);}}}
  boxes.setTexturesEnabled(false);expect(furniture.material).toBe(sandbag.material);boxes.setTexturesEnabled(true);expect(furniture.material).toBe(saved[0]!.material);expect(sandbag.material).toBe(saved[1]!.material);expect(furniture.material).not.toBe(sandbag.material);expect(init).not.toHaveBeenCalled();
 }finally{boxes.dispose();door.dispose();lighting.dispose();context.dispose();flush.mockRestore();init.mockRestore();}
},60_000);
