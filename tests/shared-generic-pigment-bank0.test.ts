/** Cold actual Source surface/producers and pure residency only. The Canvas
 * seam supplies synthetic512-square pixels: no GPU, visual or performance
 * equivalence is claimed by these contracts. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {attribute,float,texture,uv} from 'three/tsl';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {applySharedPaintSurface} from '../src/render/surfaces/SharedPaintSurface';
import {compileNaturalSurfaceModels,naturalStroke} from '../src/render/surfaces/NaturalSurfaceModels';
import {BoxBatches} from '../src/render/BoxBatches';
import {VirtualPaintPool} from '../src/render/origami/virtual-paint-pool';
import {PROTECTED_REFERENCE_PAINT_DESCRIPTORS} from '../src/render/origami/reference-profiles';
import {writeTestFileSync} from './test-output';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';
import {paintBankReads} from './wgsl-paint-bank-dominance';

interface Binding {readonly name:string;readonly visibility:number;readonly isSampledTexture?:boolean;readonly isSampler?:boolean;readonly isStorageBuffer?:boolean;readonly texture?:THREE.Texture;readonly attribute?:unknown}
interface BuilderPort {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 build():void;vertexShader:string;fragmentShader:string;
 varyings:{name:string;needsInterpolation:boolean}[];
 getBindings():{bindings:Binding[]}[];
}
const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;

test('late virtual generic0 remains physical bank0/layer0 after more than256 dynamic human pigments',()=>{
 const pool=new VirtualPaintPool(PROTECTED_REFERENCE_PAINT_DESCRIPTORS),source=PROTECTED_REFERENCE_PAINT_DESCRIPTORS[35]!,ids:number[]=[];
 try{
  pool.sealStaticCatalog();
  for(let i=0;i<300;i++)ids.push(pool.registerHumanProfile({...source,key:`human:bank0-contract:${i}`,config:{...source.config,baseColor:`#${(0x100000+i).toString(16)}`}}));
  pool.requireProfiles('human-cohort',ids);const first=pool.plan();expect(first.entries).toHaveLength(300);expect(first.bankShapes[0]).toEqual({size:512,depth:256});expect(first.bankShapes[1]).toEqual({size:512,depth:45});pool.commit(first);
  expect(pool.resolve(0)).toBeUndefined();const before=ids.map(id=>pool.resolve(id));expect(before[0]?.[0]).toBe(1);expect(before.at(-1)?.[0]).toBe(300);
  pool.requireProfiles('generic-surfaces',[0]);const late=pool.plan();expect(late.entries).toHaveLength(1);expect(late.entries[0]).toMatchObject({virtualId:0,pigmentLayer:0,newlyResident:true});expect(late.bankShapes).toEqual(first.bankShapes);pool.commit(late);
  expect(pool.resolve(0)?.[0]).toBe(0);expect(ids.map(id=>pool.resolve(id))).toEqual(before);expect(pool.metadataData()?.[0]).toBe(0);expect(pool.stats().residentCount).toBe(301);
 }finally{pool.dispose();}
});

for(const impasto of [0,.2])test(`generic-only Source surface uses only pigment bank0 for color${impasto?' and all positive height probes':''}; explicit profiles retain all banks`,()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto,wear:0}),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No device in a cold bank0 contract');});
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const original=new THREE.BoxGeometry(),models=compileNaturalSurfaceModels([original]),geometry=models.geometries[0]!,base=attribute('color','vec3'),pastel=new THREE.DataTexture(new Uint8Array([173,139,101,255]),1,1),group=new THREE.Group(),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight(),materials:THREE.MeshLambertNodeMaterial[]=[];
 geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*3).fill(.5),3));scene.add(group,sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();pastel.needsUpdate=true;
 const boxes=withGraphicsStyle(context,()=>new BoxBatches());
 try{
  for(const explicit of [false,true]){
   const material=new THREE.MeshLambertNodeMaterial({flatShading:true});materials.push(material);
   applySharedPaintSurface(material,{context,base,pastel:base.mul(texture(pastel,uv()).rgb),...(explicit?{profile:float(0)}:{}),stroke:naturalStroke(context,models.stroke)});
   group.add(new THREE.Mesh(geometry,material));
  }
  boxes.set(group,'actual-bank0-box',[{key:1,x:2,y:.5,z:0,sx:1,sy:1,sz:1,color:0x9d794c}]);
  context.prepareSharedSurfaceAssets();const storage=context.debugPaintStorage(),saved=storage.banks.map(bank=>({texture:bank.texture,data:bank.data,version:bank.texture.version})),savedPaper={texture:storage.paper.texture,data:storage.paper.data,version:storage.paper.texture.version};
  expect(storage.banks[0]!.texture.image.width).toBe(512);expect(storage.banks[0]!.texture.image.height).toBe(512);expect(storage.paper.texture.image.width).toBe(512);expect(storage.paper.texture.image.height).toBe(512);
  const meshes:THREE.Mesh[]=[];group.traverse(object=>{if(object instanceof THREE.Mesh)meshes.push(object);});expect(meshes.length).toBe(3);const facts:unknown[]=[],counts:number[]=[];
  for(const [i,mesh]of meshes.entries()){
   scene.updateMatrixWorld(true);const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=mesh.material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
   const bindings=builder.getBindings().flatMap(group=>group.bindings),fragmentBindings=bindings.filter(binding=>(binding.visibility&2)!==0),sampled=fragmentBindings.filter(binding=>binding.isSampledTexture),pigmentBindings=sampled.filter(binding=>storage.banks.some(bank=>bank.texture===binding.texture)),samplers=(builder.fragmentShader.match(/\bvar\s+\w+\s*:\s*sampler\s*;/g)??[]).length;
   const expectedBanks=i===1?8:1;expect(pigmentBindings.length).toBe(expectedBanks);expect(pigmentBindings.map(binding=>binding.texture)).toEqual(storage.banks.slice(0,expectedBanks).map(bank=>bank.texture));
   expect(sampled.some(binding=>binding.texture===storage.paper.texture)).toBe(true);expect(sampled.some(binding=>binding.texture===storage.coverage.texture)).toBe(false);
   const height=Reflect.get(context,'paperHeightArray') as THREE.Texture|undefined;expect(sampled.some(binding=>binding.texture===height)).toBe(impasto>0);if(impasto===0){expect(height).toBeUndefined();expect((mesh.material as THREE.NodeMaterial).normalNode).toBeNull();expect(builder.fragmentShader).toContain('origamiEndpointCoverage');}else{expect(height).toBeDefined();expect((mesh.material as THREE.NodeMaterial).normalNode).not.toBeNull();expect(builder.fragmentShader).toContain('origamiGlobalRelief');}
   expect(sampled.length).toBeLessThanOrEqual(16);expect(samplers).toBeLessThanOrEqual(16);expect(fragmentBindings.filter(binding=>binding.isStorageBuffer).length).toBeLessThanOrEqual(8);expect(builder.getBindings().length).toBeLessThanOrEqual(4);expect(builder.varyings.filter(varying=>varying.needsInterpolation).length).toBeLessThanOrEqual(16);
   const reads=paintBankReads(builder.fragmentShader,new Set(pigmentBindings.map(binding=>binding.name)));expect(reads.length).toBeGreaterThanOrEqual(impasto>0?3:1);expect(reads.filter(read=>read.missing.length)).toEqual([]);if(i!==1)expect(reads.every(read=>/^(?:0|i32\(\s*0(?:\.0)?\s*\))$/.test(read.profile))).toBe(true);
   expect(unboundWgslTextureResources(builder.vertexShader)).toEqual([]);expect(unboundWgslTextureResources(builder.fragmentShader)).toEqual([]);
   const label=`generic-bank0-${impasto}-${i===0?'generic':i===1?'explicit':'actual-box'}`;writeTestFileSync(`artifacts/${label}-vertex.wgsl`,builder.vertexShader);writeTestFileSync(`artifacts/${label}-fragment.wgsl`,builder.fragmentShader);
   facts.push({label,material:(mesh.material as THREE.Material).type,sourceSize:512,syntheticPixels:true,bankNames:pigmentBindings.map(binding=>binding.name),sampled:sampled.map(binding=>({name:binding.name,texture:binding.texture?.uuid})),samplers,normal:!!(mesh.material as THREE.NodeMaterial).normalNode,reads});counts.push(samplers);
  }
  expect(counts[1]!-counts[0]!).toBe(7);
  const after=context.debugPaintStorage();for(const [i,before]of saved.entries()){expect(after.banks[i]!.texture).toBe(before.texture);expect(after.banks[i]!.data).toBe(before.data);expect(after.banks[i]!.texture.version).toBe(before.version);}expect(after.paper.texture).toBe(savedPaper.texture);expect(after.paper.data).toBe(savedPaper.data);expect(after.paper.texture.version).toBe(savedPaper.version);
  writeTestFileSync(`artifacts/generic-bank0-${impasto}-facts.json`,JSON.stringify({scope:'Cold declarations and ownership only, no Native quality/GPU/performance claim',facts},null,2)+'\n');expect(init).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);
 }finally{boxes.dispose();for(const material of materials)material.dispose();models.dispose();original.dispose();pastel.dispose();context.dispose();init.mockRestore();}
},60_000);
