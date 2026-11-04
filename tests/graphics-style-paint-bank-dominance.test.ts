/** Actual actor/resource programs, two tiny synthetic pigment banks, no device.
 * The pixel data only exercise bindings and IDs; these are not quality proofs. */
import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {PawnLayer} from '../src/render/PawnLayer';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {animalCombatCamp} from './scenarios/animal-combat';
import type {Resource} from '../src/sim/types';
import {paintBankReads} from './wgsl-paint-bank-dominance';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';
import {writeTestFileSync} from './test-output';

interface BuilderPort {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 build():void;vertexShader:string;fragmentShader:string;
 getBindings():{bindings:{name:string;texture?:THREE.Texture;isSampledTexture?:boolean;visibility:number}[]}[];
}
const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;

test('the dominance oracle rejects the exact acquired sibling-bank initializer and accepts a dominating explicit initializer',()=>{
 const old=readFileSync(new URL('./fixtures/paint-bank-sibling-initializer.wgsl',import.meta.url),'utf8'),reads=paintBankReads(old,new Set(['nodeUniform18','nodeUniform21']));
 expect(reads.filter(r=>r.bank==='nodeUniform18')).toHaveLength(2);
 expect(reads.find(r=>r.bank==='nodeUniform18')!.missing).toEqual([]);
 expect(reads.filter(r=>r.bank==='nodeUniform18')[1]!.missing).toContain('nodeVar1298');
 expect(reads.find(r=>r.bank==='nodeUniform21')!.missing).toContain('nodeVar1304');
 const good=`var<private> metric : vec3<f32>;var<private> mapped : vec2<f32>;var<private> pigment : vec4<f32>;
 fn main() {if(valid){metric=vec3<f32>(2,0,1);}else{metric=vec3<f32>(1,0,1);}mapped=uv*metric.xz;
 if(active==1){pigment=textureSample(bank0,sampler0,mapped,i32(profile));}
 else{if(profile<256){pigment=textureSample(bank0,sampler0,mapped,i32(profile));}if(profile>=256){pigment=textureSample(bank1,sampler1,mapped,i32(profile-256));}}}`;
 expect(paintBankReads(good,new Set(['bank0','bank1'])).map(r=>r.missing)).toEqual([[],[],[]]);
});

for(const kind of ['human','resource'] as const)for(const impasto of [0,.2])test(`actual ${kind} ${kind==='human'?'two-bank':'static-bank0 with a resident second bank'} ${impasto===0?'color':'color and height probes'} coordinates are explicitly computed on every sampling path`,()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto,wear:0}),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No device in a cold paint-bank contract');});
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),group=new THREE.Group(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(group,sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 let dispose=()=>{};
 try{
  let mesh:THREE.Mesh;
  if(kind==='human'){
   const layer=withGraphicsStyle(context,()=>new PawnLayer());dispose=()=>layer.dispose();layer.update(animalCombatCamp(),0,true);group.add(layer.group);
   mesh=Reflect.get(layer,'pawnMesh') as THREE.Mesh;mesh.material=Reflect.get(layer,'texturedMaterial') as THREE.Material;
  }else{
   const plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),textured=new THREE.MeshLambertNodeMaterial({vertexColors:true}),layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,textured));
   dispose=()=>{layer.dispose();plain.dispose();textured.dispose();};
   // An anonymous anisotropic tree really uses the direct surface under test.
   // Named fixed trees at strict zero now use their separate one-fetch graph.
   const world={width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},resources:[{id:1001,kind:'tree',x:8,z:8,amount:1,growth:1}]as Resource[],structures:[],pawns:[],jobs:[]};
   Reflect.apply(layer.update,layer,[world,true,undefined,undefined,{read:()=>({size:1,ripe:true,leafless:false}),harvestable:()=>false}]);
   const candidates:THREE.Mesh[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry.hasAttribute('surfaceUv'))candidates.push(o);});
   expect(candidates.length).toBeGreaterThan(0);mesh=candidates[0]!;
  }
  // Pastel construction must not rasterize. Seed existing binding objects with
  // two distinct 1x1 data banks and physical IDs >=256, without a 257*512² bake.
  void context.paint;const storage=context.debugPaintStorage();
  storage.banks[0]!.texture.image={width:1,height:1,depth:256,data:new Uint8Array(256*4).fill(80)};
  storage.banks[1]!.texture.image={width:1,height:1,depth:256,data:new Uint8Array(256*4).fill(160)};
  for(let i=0;i<storage.lookup.data.length;i+=2){storage.lookup.data[i]=(kind==='human'?256:0)+(i/2)%256;storage.lookup.data[i+1]=0;}
  const active=Reflect.get(context,'activeBankCount') as {value:number};active.value=2;expect(active.value).toBe(2);expect(storage.lookup.data[0]).toBe(kind==='human'?256:0);
  scene.updateMatrixWorld(true);const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=mesh.material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
  const label=`paint-bank-dominance-${kind}-${impasto}`,bindings=builder.getBindings().flatMap(g=>g.bindings).filter(b=>b.isSampledTexture&&(b.visibility&2)!==0),names=storage.banks.slice(0,kind==='human'?2:1).map(bank=>bindings.find(binding=>binding.texture===bank.texture)?.name);
  writeTestFileSync(`artifacts/${label}-vertex.wgsl`,builder.vertexShader);writeTestFileSync(`artifacts/${label}-fragment.wgsl`,builder.fragmentShader);
  expect(names.every(name=>typeof name==='string'),JSON.stringify(bindings.map(b=>({name:b.name,texture:b.texture?.uuid})))).toBe(true);
  const reads=paintBankReads(builder.fragmentShader,new Set(names as string[]));writeTestFileSync(`artifacts/${label}-reads.json`,JSON.stringify({scope:'Cold actual producer programs and initializer dominance only; no GPU, raster quality or performance claim',activeBanks:active.value,names,reads},null,2)+'\n');
  expect(reads.filter(r=>r.bank===names[0]).length).toBeGreaterThanOrEqual(kind==='human'?2:impasto>0?3:1);if(kind==='human')expect(reads.filter(r=>r.bank===names[1]).length).toBeGreaterThanOrEqual(impasto>0?3:1);else expect(bindings.some(binding=>binding.texture===storage.banks[1]!.texture)).toBe(false);
  expect(reads.filter(r=>r.missing.length>0)).toEqual([]);expect(unboundWgslTextureResources(builder.vertexShader)).toEqual([]);expect(unboundWgslTextureResources(builder.fragmentShader)).toEqual([]);expect(init).not.toHaveBeenCalled();
 }finally{dispose();context.dispose();init.mockRestore();}
},60_000);
