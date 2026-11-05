import {settlePreparedStrokes} from './fixtures/settle-prepared-strokes';
/** Real cliff writer and cold pinned shader reflection. No device, Canvas,
 * image-quality, VRAM or timing result is asserted by these contracts. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{
 const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');
 return{...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};
});
import {createWorld} from '../src/sim/engine';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {RockLayer} from '../src/render/RockLayer';
import {RockStrokeTable} from '../src/render/surfaces/RockStrokeTable';
import {ROCK_SURFACE_VERTICES} from '../src/render/models/RockSurfaceModel';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {writeTestFileSync} from './test-output';

function fixture(){const world=createWorld(42,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));for(let z=12;z<=16;z++)for(let x=12;x<=16;x++)world.tiles[z*32+x]={terrain:'rock',stone:'granite'};return world;}
interface Inspector {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 build():void;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];
 getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];
 getBindings():{bindings:{name:string;isStorageBuffer?:boolean;visibility:number;texture?:THREE.Texture;attribute?:THREE.StorageBufferAttribute}[]}[];
}

test('actual cliff preserves model/material through both texture encodings, sparse mining and cold WebGPU budgets',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),bodyPaint=vi.spyOn(context,'facePaintNode'),bodyHeight=vi.spyOn(context,'faceHeightNode'),lighting=new EnvironmentLighting(),layer=withGraphicsStyle(context,()=>new RockLayer(lighting.configure)),world=fixture(),source=JSON.stringify(world),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold rock contract cannot initialize a device');});
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 try{
  layer.update(world,true);settlePreparedStrokes(context);layer.setDistant(true);const mesh=layer.mesh,geometry=mesh.geometry,material=mesh.material,index=geometry.index!,arrays=Object.values(geometry.attributes).map(a=>({attribute:a,values:a.array.slice(),version:a instanceof THREE.InterleavedBufferAttribute?a.data.version:a.version})),indices=index.array.slice(),program=(material as THREE.NodeMaterial).colorNode,stroke=Reflect.get(layer,'stroke')as RockStrokeTable;
  const originalPreparation={...stroke.stats},prepared=context.preparedStrokes.acquire(stroke)!;
  for(const style of ['origami','default','origami']as const){context.update({...context.preferences,style});layer.update(world);expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect((material as THREE.NodeMaterial).colorNode).toBe(program);expect(index.array).toEqual(indices);for(const row of arrays){expect(row.attribute.array).toEqual(row.values);expect(row.attribute instanceof THREE.InterleavedBufferAttribute?row.attribute.data.version:row.attribute.version).toBe(row.version);}expect(stroke.stats).toEqual(originalPreparation);expect(layer.group.getObjectsByProperty('isMesh',true).every(object=>!object.userData.origamiContour)).toBe(true);}
  scene.add(mesh);scene.updateMatrixWorld(true);const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Inspector,builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
  const attributes=builder.getAttributesArray().map(a=>a.node?.attribute??geometry.getAttribute(a.name)).filter((a):a is THREE.BufferAttribute|THREE.InterleavedBufferAttribute=>!!a),buffers=new Set(attributes.map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)),varyings=builder.varyings.filter(v=>v.needsInterpolation).map(v=>v.name),bindings=builder.getBindings().flatMap(group=>group.bindings),storage=bindings.filter(binding=>binding.isStorageBuffer);
  expect(attributes.length).toBeLessThanOrEqual(16);expect(buffers.size).toBeLessThanOrEqual(8);expect(varyings.length,varyings.join(',')).toBeLessThanOrEqual(16);expect(new Set(storage.map(binding=>binding.attribute))).toEqual(new Set([prepared.buffer]));for(const bit of [1,2])expect(storage.filter(binding=>(binding.visibility&bit)!==0)).toHaveLength(1);expect(builder.vertexShader).toContain('v_rockStrokeHeader0');expect(builder.fragmentShader).toContain('v_rockStrokeHeader1');for(const bit of [1,2])expect(storage.filter(binding=>(binding.visibility&bit)!==0).length).toBeLessThanOrEqual(8);expect(builder.fragmentShader).toContain('textureSampleGrad');expect((material as THREE.NodeMaterial).normalNode).toBeNull();expect(context.reliefLod).toBeUndefined();
  // The Source rock body is the original broad stone texture in BOTH styles,
  // not a new generic gouache painting with kraft gaps on every cliff facet.
  const stone=Reflect.get(layer,'stonePaint')as THREE.Texture,paper=Reflect.get(context,'paperArray')as THREE.Texture;
  expect(bindings.some(binding=>binding.texture===stone)).toBe(true);expect(bindings.some(binding=>binding.texture===paper)).toBe(false);expect(bodyPaint).not.toHaveBeenCalled();expect(bodyHeight).not.toHaveBeenCalled();expect((material as THREE.NodeMaterial).vertexColors).toBe(false);
  layer.setTexturesEnabled(false);const plain=mesh.material as THREE.NodeMaterial,plainProgram=plain.colorNode,plainBuilder=new Builder(mesh,renderer);plainBuilder.scene=scene;plainBuilder.camera=camera;plainBuilder.material=plain;plainBuilder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);plainBuilder.build();
  const plainBindings=plainBuilder.getBindings().flatMap(group=>group.bindings);expect(plainBindings.some(binding=>binding.texture===stone)).toBe(false);expect(plainBindings.some(binding=>binding.texture===paper)).toBe(false);expect(plainBuilder.fragmentShader).toContain('textureSampleGrad');expect(new Set(plainBindings.filter(binding=>binding.isStorageBuffer).map(binding=>binding.attribute))).toEqual(new Set([prepared.buffer]));for(const bit of [1,2])expect(plainBindings.filter(binding=>binding.isStorageBuffer&&(binding.visibility&bit)!==0)).toHaveLength(1);expect(plain.vertexColors).toBe(false);
  for(const settings of [{style:'origami',impasto:1,wear:.75},{style:'default',impasto:1,wear:.75},{style:'origami',impasto:0,wear:0}]as const){context.update({...context.preferences,...settings});expect(plain.colorNode).toBe(plainProgram);expect((material as THREE.NodeMaterial).colorNode).toBe(program);expect(plain.normalNode).toBeNull();expect((material as THREE.NodeMaterial).normalNode).toBeNull();expect(bodyPaint).not.toHaveBeenCalled();expect(bodyHeight).not.toHaveBeenCalled();}
  layer.setTexturesEnabled(true);expect(mesh.material).toBe(material);
  writeTestFileSync('artifacts/shared-rock-surface-vertex.wgsl',builder.vertexShader);writeTestFileSync('artifacts/shared-rock-surface-fragment.wgsl',builder.fragmentShader);writeTestFileSync('artifacts/shared-rock-surface-facts.json',JSON.stringify({attributes:attributes.length,buffers:buffers.size,varyings,storage:storage.map(b=>({name:b.name,visibility:b.visibility})),scope:'Actual RockLayer cold WGSL only; no device, quality, VRAM or timing'},null,2)+'\n');
  writeTestFileSync('artifacts/shared-rock-plain-surface-fragment.wgsl',plainBuilder.fragmentShader);
  const slots=Reflect.get(layer,'slots')as Map<number,{slot:number}>,far=slots.get(12*32+12)!.slot,start=(24+far*ROCK_SURFACE_VERTICES)*3,position=geometry.getAttribute('position'),unchanged=position.array.slice(start,start+ROCK_SURFACE_VERTICES*3),changed={...world,tiles:world.tiles.slice()};changed.tiles[14*32+14]={terrain:'soil'};
  const priorCells=stroke.stats.preparedCells;layer.update(changed,false,[14*32+14]);settlePreparedStrokes(context);expect(layer.mesh.geometry).toBe(geometry);expect(layer.stats.updatedCells).toBe(9);expect(stroke.stats.preparedCells-priorCells).toBeLessThanOrEqual(25);expect(position.array.slice(start,start+ROCK_SURFACE_VERTICES*3)).toEqual(unchanged);expect(JSON.stringify(world)).toBe(source);expect(init).not.toHaveBeenCalled();
 }finally{layer.mesh.removeFromParent();layer.dispose();lighting.dispose();context.dispose();flush.mockRestore();bodyPaint.mockRestore();bodyHeight.mockRestore();init.mockRestore();}
},60_000);

test('large-map paged capacity is a bounded high-water mark across map changes and invalid dimensions publish nothing',()=>{
 const table=new RockStrokeTable(),write=Reflect.get(table,'write')as(first:number,values:Float32Array)=>void,nodes=Reflect.get(table,'nodes')as THREE.StorageBufferNode<'vec4'>[];
 const pages=()=>Reflect.get(table,'pages')as{attribute:THREE.StorageBufferAttribute;rows:number;allocated:boolean}[],starts=()=>Reflect.get(table,'starts')as{value:number}[];
 try{
  table.reset(192,192);write.call(table,starts()[1]!.value,new Float32Array([1,2,3,4]));table.commit([]);const small=pages()[1]!.attribute;
  table.reset(256,256);write.call(table,starts()[1]!.value,new Float32Array([5,6,7,8]));table.commit([]);const high=pages().map(p=>p.attribute),snapshot=table.snapshot();expect(high[1]).not.toBe(small);
  for(const dimensions of [[192,192],[256,192],[192,256],[256,256],[192,192]]){table.reset(dimensions[0]!,dimensions[1]!);expect(pages().map(p=>p.attribute)).toEqual(high);expect(table.snapshot().retiredBuffers).toBe(snapshot.retiredBuffers);expect(table.cpuBytes).toBe(snapshot.cpuBytes);}
  expect(Reflect.get(table,'nodes')).toBe(nodes);expect(high[1]!.array.every(value=>value===0)).toBe(true);
  const before=table.snapshot();for(const dimensions of [[0,32],[32,401],[Infinity,32],[32,NaN]])expect(()=>table.reset(dimensions[0]!,dimensions[1]!)).toThrow(/supported map bounds/);expect(table.snapshot()).toEqual(before);
  table.reset(400,400);expect(pages().every(page=>page.rows<=8388608)).toBe(true);expect(pages().filter(page=>page.allocated)).toHaveLength(0);expect(pages().every(page=>page.attribute.array.length===4)).toBe(true);
 }finally{table.dispose();}
});
