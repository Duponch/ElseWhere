import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import {designateHunt} from '../src/sim/hunting';
import {adultAgeTicks} from '../src/sim/animal-life';
import type {WildAnimal} from '../src/sim/wildlife-state';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {ownActorPlaybackWorld435} from '../src/render/ActorPlayback435';
import {AnimalSlaughterMarkerStyle,ANIMAL_DESIGNATION_ATLAS_URL} from '../src/render/AnimalSlaughterMarker';

function fixture(count=2){
 const world=createWorld(90,20,20);world.resources=[];world.jobs=[];
 const animals:WildAnimal[]=Array.from({length:count},(_,i)=>({id:world.nextId++,species:'hare',sex:'female',ageTicks:adultAgeTicks('hare'),x:7+i%8,z:4+Math.floor(i/8),food:.15,rest:.8,state:'moving',path:[],nextDecision:100,motion:{from:{x:6+i%8,z:4+Math.floor(i/8)},to:{x:7+i%8,z:4+Math.floor(i/8)},start:0,end:2}}));
 world.wildlife={profile:'temperate-hares-v1',rng:1,animals,eatenItems:0,eatenPlants:0,eatenNutrition:0};
 return{world,animals};
}
function mesh(layer:WildlifeLayer){return layer.mesh.children.find(m=>m.name.startsWith('Domestic slaughter')&&(m as THREE.Mesh<THREE.InstancedBufferGeometry>).geometry.instanceCount>0)as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.SpriteNodeMaterial>;}

test('real hunt designation shares the slaughter batch and current interpolated animal streams without changing the world or uploading unchanged flags',()=>{
 const{world,animals}=fixture(),layer=new WildlifeLayer();
 try{
  expect(designateHunt(world,{type:'hunt',animalId:animals[0]!.id,enabled:true}).ok).toBe(true);
  animals[1]!.domestic={since:0,care:'none',tameness:5,nextDecay:45000,slaughter:true};const before=structuredClone(world);
  layer.update(world,undefined,true);const marker=mesh(layer),body=layer.mesh.children.find(m=>m.name.startsWith('Wild hare '))as THREE.Mesh<THREE.InstancedBufferGeometry>;
  expect(marker.visible).toBe(true);expect(marker.geometry.instanceCount).toBe(2);expect(layer.mesh.children.filter(m=>m.name.startsWith('Domestic slaughter'))).toHaveLength(53);
  for(const name of ['aFrom','aTo','aTravel','aScale','aAnimal'])expect(marker.geometry.getAttribute(name)).toBe(body.geometry.getAttribute(name));
  const flags=marker.geometry.getAttribute('aSlaughter')as THREE.InstancedBufferAttribute;expect([flags.getX(0),flags.getX(1)]).toEqual([2,1]);const version=flags.version;
  for(let i=0;i<4;i++)layer.update(world,undefined,false);expect(flags.version).toBe(version);expect(world).toEqual(before);
  const cancelled=structuredClone(world);expect(designateHunt(cancelled,{type:'hunt',animalId:animals[0]!.id,enabled:false}).ok).toBe(true);layer.update(cancelled,undefined);expect([flags.getX(0),flags.getX(1)]).toEqual([0,1]);
  ownActorPlaybackWorld435(world,true);layer.update(world,undefined);expect(flags.getX(0)).toBe(2);const dead=structuredClone(world);ownActorPlaybackWorld435(dead,true);dead.wildlife!.animals[0]!.state='dead';layer.adoptPhase297(dead,[0]);expect(flags.getX(0)).toBe(0);
 }finally{layer.dispose();}
});

test('hunting marker grows with the resident pool and disappears when its actor is removed or domesticated',()=>{
 const{world,animals}=fixture(20),layer=new WildlifeLayer();world.hunting={targets:[animals[19]!.id],completed:0};
 try{
  layer.update(world,undefined,true);const marker=mesh(layer),body=layer.mesh.children.find(m=>m.name.startsWith('Wild hare '))as THREE.Mesh<THREE.InstancedBufferGeometry>;
  expect(marker.geometry.instanceCount).toBe(20);expect(marker.geometry.getAttribute('aSlaughter').getX(19)).toBe(2);for(const name of ['aFrom','aTo','aTravel','aScale','aAnimal'])expect(marker.geometry.getAttribute(name)).toBe(body.geometry.getAttribute(name));
  const tamed=structuredClone(world);tamed.wildlife!.animals[19]!.domestic={since:0,care:'none',tameness:5,nextDecay:45000};layer.update(tamed,undefined);expect(marker.visible).toBe(false);
  const gone=structuredClone(world);gone.wildlife!.animals=gone.wildlife!.animals.slice(0,19);layer.update(gone,undefined);expect(marker.visible).toBe(false);expect(marker.geometry.instanceCount).toBe(19);
 }finally{layer.dispose();}
});

test('hunting/slaughter share one atlas and identical zoom cutoffs, including the zero cutoff setting',()=>{
 const style=new AnimalSlaughterMarkerStyle(),camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,100);camera.position.set(0,15,15);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 try{
  const svg=decodeURIComponent(ANIMAL_DESIGNATION_ATLAS_URL.split(',')[1]!);expect(svg).toContain('data-pictogram="target"');expect(svg).toContain('data-pictogram="slaughter"');
  style.setMinCellPixels(32);style.present(camera,600,31);expect(style.enabled.value).toBe(0);style.present(camera,600,32);expect(style.enabled.value).toBe(1);
  style.setMinCellPixels(0);style.present(camera,600,1);expect(style.enabled.value).toBe(1);expect(style.limited.value).toBe(0);
 }finally{style.dispose();}
});

test('actual animated head marker compiles cold within native attribute/buffer limits and retains one icon sample',()=>{
 const{world}=fixture(),layer=new WildlifeLayer();world.hunting={targets:[world.wildlife!.animals[0]!.id],completed:0};layer.update(world,undefined,true);const marker=mesh(layer);
 const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold marker inspection cannot request a device');});
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100);scene.add(marker);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 interface Inspector {scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;vertexShader:string;fragmentShader:string;build():unknown;getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];getBindings():{bindings:{isSampledTexture?:boolean;visibility:number;texture?:THREE.Texture}[]}[]}
 const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Inspector;
 try{
  const builder=new Builder(marker,renderer);builder.scene=scene;builder.camera=camera;builder.material=marker.material;builder.build();
  const attributes=builder.getAttributesArray().map(a=>a.node?.attribute??marker.geometry.getAttribute(a.name)),buffers=new Set(attributes.filter(Boolean).map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a));
  expect(attributes.length).toBeLessThanOrEqual(16);expect(buffers.size).toBeLessThanOrEqual(8);expect(builder.getBindings().flatMap(b=>b.bindings).filter(b=>b.isSampledTexture&&(b.visibility&2))).toHaveLength(1);
  expect(builder.vertexShader).toContain('sin(');expect(init).not.toHaveBeenCalled();
 }finally{marker.removeFromParent();layer.dispose();init.mockRestore();}
},60_000);
