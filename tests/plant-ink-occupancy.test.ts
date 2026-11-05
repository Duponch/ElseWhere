/** Actual Plant compiler/surface/models. Renderer submission alone is mocked
 * for lifecycle/order; cold programs allocate no device. No pixel/timing claim. */
import{expect,test,vi}from'vitest';
import*as THREE from'three/webgpu';
import{GraphicsStyleContext,withGraphicsStyle}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{EnvironmentLighting}from'../src/render/EnvironmentLighting';
import{PlantClusterLayer}from'../src/render/PlantClusterLayer';
import{createStylizedSurfaceTexture}from'../src/render/stylized-surfaces';
import{createOrigamiGroundTuftGeometry}from'../src/render/origami/flora';
import{compileNaturalSurfaceModels}from'../src/render/surfaces/NaturalSurfaceModels';
import{planPlantAtlas}from'../src/render/origami/baked/plants/PlantAtlasPlan';
import{preparePlantAtlasGpu}from'../src/render/origami/baked/plants/PlantAtlasGpu';
import type{PlantAtlasSurface}from'../src/render/origami/baked/plants/PlantAtlasSurface';
import{registerInkOccupancyPreparationWitness}from'../src/render/surfaces/InkOccupancyPacking';
import{writeTestFileSync}from'./test-output';
import{unboundWgslTextureResources}from'./wgsl-resource-bindings';
import{inspectBiInkOccupancyProgram}from'./bi-ink-occupancy-wgsl';

type Event={kind:'render';name:string;target:THREE.RenderTarget;viewport:readonly number[]}|{kind:'copy';source:THREE.Texture;destination:THREE.Texture;layer:number;sourceLevel:number;level:number;width:number};
function preparationFixture(failPacking=false){
 const source=createOrigamiGroundTuftGeometry(),models=compileNaturalSurfaceModels([source]),geometry=models.geometries[0]!,plan=planPlantAtlas(geometry,{maxCpuBytes:32*1024*1024,maxPeakGpuBytes:416*1024*1024,existingLiveGpuBytes:43688}),events:Event[]=[],targets=new Set<THREE.RenderTarget>(),outputs:THREE.RenderTarget[]=[],retired=vi.fn(),failure=Error('TEST packing submission failure'),originalPositions=geometry.getAttribute('position').array.slice(),originalUv=geometry.getAttribute('uv').array.slice(),originalRows=plan.addressRows.slice();
 let active:THREE.RenderTarget|null=null,cubeFace=0,mipmap=0,clearAlpha=.6;const clearColor=new THREE.Color(.2,.3,.4);
 const renderer={initialized:true,backend:{isWebGPUBackend:true},autoClear:false,getRenderTarget:()=>active,getActiveCubeFace:()=>cubeFace,getActiveMipmapLevel:()=>mipmap,getClearColor:(out:THREE.Color)=>out.copy(clearColor),getClearAlpha:()=>clearAlpha,setClearColor:(color:THREE.Color|number,alpha:number)=>{clearColor.set(color);clearAlpha=alpha;},setRenderTarget:(target:THREE.RenderTarget|null,face=0,level=0)=>{active=target;cubeFace=face;mipmap=level;if(target)targets.add(target);},initRenderTarget:(target:THREE.RenderTarget)=>{targets.add(target);outputs.push(target);target.addEventListener('dispose',retired);},renderAsync:async(scene:THREE.Scene)=>{if(!active)throw Error('Actual preparation target required');const mesh=scene.children[0]as THREE.Mesh,name=(mesh.material as THREE.Material).name;events.push({kind:'render',name,target:active,viewport:active.viewport.toArray()});if(failPacking&&name.startsWith('Plant ink occupancy'))throw failure;},copyTextureToTexture:(source:THREE.Texture,destination:THREE.Texture,box:THREE.Box2,position:THREE.Vector3|THREE.Vector2,sourceLevel:number,level:number)=>{events.push({kind:'copy',source,destination,layer:position instanceof THREE.Vector3?position.z:-1,sourceLevel,level,width:box.max.x-box.min.x});}}as unknown as THREE.WebGPURenderer;
 const pigment=new Uint8Array(512*512*4),paper=new Uint8Array(512*512*4),coverage=new Uint8Array(512*512),edgeAlpha={data:new Uint8Array(512*128*4),width:512,height:128},lease={fingerprint:'TEST source dimension guards only; never sampled',isCurrent:()=>true,assertCurrent(){},paint:{readProfile:(id:number)=>{expect(id).toBe(0);return{physicalLayer:0,faceLayer:0,pigment,paper,coverage,orientation:'upload-bottom-up'as const};},edgeAlpha,brushColorLinear:[.02,.015,.01]as const,lineOpacity:.79,strokeImperfection:.15}};
 return{source,models,geometry,plan,events,targets,outputs,retired,failure,renderer,lease,originalPositions,originalUv,originalRows,active:()=>active,clear:()=>({color:clearColor.toArray(),alpha:clearAlpha,cubeFace,mipmap}),close(){models.dispose();source.dispose();}};
}

test('real Plant packing waits for both retained terms and rewrites only Body at each exact mip using the existing scratch targets',async()=>{
 const f=preparationFixture();let result:Awaited<ReturnType<typeof preparePlantAtlasGpu>>|undefined;
 try{
  result=await preparePlantAtlasGpu(f.renderer,f.plan,f.lease,f.models.stroke,{edgeWidth:1.7},()=>{});expect(f.outputs).toHaveLength(1);const output=f.outputs[0]!,packing=f.events.filter((e):e is Extract<Event,{kind:'render'}>=>e.kind==='render'&&e.name.startsWith('Plant ink occupancy'));
  expect(packing).toHaveLength(f.plan.pages*4);expect(f.targets.size).toBe(8);expect(result.gpuBytes).toBe(f.plan.retainedGpuBytes);expect(result.stats).toMatchObject({occupancyPackingPasses:f.plan.pages*4,occupancyReusesScratch:true,readback:false});
  for(let page=0;page<f.plan.pages;page++)for(let level=0;level<4;level++){
   const render=packing.find(e=>e.name==='Plant ink occupancy page'+page+' mip'+level)!;expect(render).toBeDefined();const at=f.events.indexOf(render),prior=f.events.slice(0,at);
   for(let mip=0;mip<4;mip++)expect(prior.some(e=>e.kind==='copy'&&e.destination===output.texture&&e.layer===page*2+1&&e.level===mip)).toBe(true);
   const copy=f.events[at+1];expect(copy?.kind).toBe('copy');if(copy?.kind!=='copy')throw Error('Pack render must immediately copy its result');expect(copy.destination).toBe(output.texture);expect(copy.source).toBe(render.target.texture);expect(copy.layer).toBe(page*2);expect(copy.sourceLevel).toBe(0);expect(copy.level).toBe(level);expect(copy.width).toBe(2048/2**level);expect(render.viewport).toEqual([0,0,2048/2**level,2048/2**level]);
  }
  const copies=f.events.filter((e):e is Extract<Event,{kind:'copy'}>=>e.kind==='copy'&&e.destination===output.texture);expect(copies).toHaveLength(f.plan.depth*4+f.plan.pages*4);expect(copies.filter(e=>e.layer%2===1)).toHaveLength(f.plan.pages*4);
  expect(f.geometry.getAttribute('position').array).toEqual(f.originalPositions);expect(f.geometry.getAttribute('uv').array).toEqual(f.originalUv);expect(f.plan.addressRows).toEqual(f.originalRows);expect(f.active()).toBeNull();expect(f.renderer.autoClear).toBe(false);expect(f.clear()).toEqual({color:[.2,.3,.4],alpha:.6,cubeFace:0,mipmap:0});
  result.dispose();result=undefined;expect(f.retired).toHaveBeenCalledTimes(1);
 }finally{result?.dispose();f.close();}
});

test('an ordinary Plant occupancy submission error never publishes its output and restores the actual held renderer state',async()=>{
 const f=preparationFixture(true);try{await expect(preparePlantAtlasGpu(f.renderer,f.plan,f.lease,f.models.stroke,{edgeWidth:1.7},()=>{})).rejects.toBe(f.failure);expect(f.outputs).toHaveLength(1);expect(f.retired).toHaveBeenCalledTimes(1);expect(f.active()).toBeNull();expect(f.renderer.autoClear).toBe(false);expect(f.clear()).toEqual({color:[.2,.3,.4],alpha:.6,cubeFace:0,mipmap:0});expect(f.geometry.getAttribute('position').array).toEqual(f.originalPositions);expect(f.geometry.getAttribute('uv').array).toEqual(f.originalUv);}finally{f.close();}
});

test('the optional Plant preparation witness awaits before/packed observations using only existing scratch and returns no data to stable rendering',async()=>{
 const f=preparationFixture(),observations:{phase:string;page:number;level:number}[]=[];let release!:()=>void,started!:()=>void;
 const hold=new Promise<void>(resolve=>{release=resolve;}),entered=new Promise<void>(resolve=>{started=resolve;});
 const unregister=registerInkOccupancyPreparationWitness(f.renderer,async event=>{
  event.assertCurrent();expect(event.family).toBe('plant');expect(event.bank).toBe(f.outputs[0]!.texture);expect(event.width).toBe(2048/2**event.level);expect(event.height).toBe(event.width);expect(event.bodyLayer).toBe(event.page*2);expect(event.inkLayer).toBe(event.bodyLayer+1);expect(f.targets.has(event.scratch)).toBe(true);
  const sameMipCopies=f.events.filter(e=>e.kind==='copy'&&e.destination===event.bank&&e.layer===event.bodyLayer&&e.level===event.level);expect(sameMipCopies).toHaveLength(1);
  observations.push({phase:event.phase,page:event.page,level:event.level});if(observations.length===1){started();await hold;}
 });
 let result:Awaited<ReturnType<typeof preparePlantAtlasGpu>>|undefined,work:ReturnType<typeof preparePlantAtlasGpu>|undefined;
 try{work=preparePlantAtlasGpu(f.renderer,f.plan,f.lease,f.models.stroke,{edgeWidth:1.7},()=>{});await Promise.race([entered,work.then(()=>{throw Error('Expected the real awaited witness boundary');})]);expect(f.events.some(e=>e.kind==='render'&&e.name.startsWith('Plant ink occupancy'))).toBe(false);release();result=await work;expect(result.stats.readback).toBe('Optional preparation witness registered');expect(observations).toEqual(Array.from({length:f.plan.pages},(_,page)=>Array.from({length:4},(_,level)=>[{phase:'before',page,level},{phase:'packed',page,level}]).flat()).flat());expect(f.targets.size).toBe(8);expect(f.active()).toBeNull();result.dispose();result=undefined;
 }finally{release();if(work)await work.then(value=>{if(value!==result)value.dispose();},()=>{});unregister();result?.dispose();f.close();}
});

interface Binding{name:string;visibility:number;isSampledTexture?:boolean;isSampler?:boolean;isStorageBuffer?:boolean;isUniformsGroup?:boolean;texture?:THREE.Texture;update?:()=>boolean}
interface Builder{scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];updateNodes:THREE.Node[];build():unknown;getBindings():{bindings:Binding[]}[];getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[]}
test('actual Plant main and real shadow programs preserve the common models and use equal explicit Body/Ink gradients before the strict occupancy branch',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),lighting=new EnvironmentLighting(),plain=new THREE.MeshLambertNodeMaterial({flatShading:true}),pastel=createStylizedSurfaceTexture('vegetation'),layer=withGraphicsStyle(context,()=>new PlantClusterLayer(plain,plain,undefined,pastel)),sourceMaterial=Reflect.get(layer,'windTextured')as THREE.NodeMaterial,surface=Reflect.get(layer,'plantAtlas')as PlantAtlasSurface,mesh=Reflect.get(layer,'mesh')as THREE.InstancedMesh;
 lighting.configure(sourceMaterial);surface.syncLighting();const plant={id:71,kind:'wild-plant'as const,species:'grass'as const,x:4,z:5,amount:1,growth:1};layer.update({resources:[plant]}as unknown as Parameters<PlantClusterLayer['update']>[0],true);
 const renderer=new THREE.WebGPURenderer({canvas:{width:64,height:64,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold Plant contract must not create a GPU device');}),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-6,6,4,-4,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight(),shadow=new THREE.ShadowNode(sun,sun.shadow).getShadowMaterial(),dispatch=Reflect.get(renderer,'_handleObjectFunction'),material=surface.material,geometry=mesh.geometry,attributes={...geometry.attributes},indices=geometry.index,matrices=mesh.instanceMatrix.array.slice(),colors=mesh.instanceColor!.array.slice();
 renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);scene.add(layer.group,sun,sky);camera.position.set(10,8,10);camera.lookAt(4,0,5);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);let style:'default'|'origami'='default',pass:'main'|'shadow'='main',compiled=0;
 try{
  Reflect.set(renderer,'_handleObjectFunction',(object:THREE.Object3D,actual:THREE.Material)=>{expect(actual).toBe(pass==='main'?material:shadow);const saved=mesh.material;mesh.material=actual;
   try{const Ctor=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Builder,b=new Ctor(object,renderer);b.scene=scene;b.camera=camera;b.material=actual;b.lightsNode=new THREE.LightsNode().setLights([sun,sky]);b.build();const bindings=b.getBindings().flatMap(g=>g.bindings),frame=new THREE.NodeFrame();frame.renderer=renderer;frame.scene=scene;frame.camera=camera;frame.object=object;frame.material=actual;frame.frameId=1;frame.renderId=1;mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);mesh.normalMatrix.getNormalMatrix(mesh.modelViewMatrix);for(const node of b.updateNodes)frame.updateNode(node);for(const binding of bindings)if(binding.isUniformsGroup){if(!binding.update)throw Error('Native CPU uniform writer required');binding.update();}
    const attrs=b.getAttributesArray().flatMap(a=>{const value=a.node?.attribute??geometry.getAttribute(a.name);return value?[value]:[];});expect(attrs.length).toBeLessThanOrEqual(16);expect(new Set(attrs.map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)).size).toBeLessThanOrEqual(8);expect(b.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);expect(b.getBindings().length).toBeLessThanOrEqual(4);expect(unboundWgslTextureResources(b.vertexShader)).toEqual([]);expect(unboundWgslTextureResources(b.fragmentShader)).toEqual([]);for(const bit of[1,2])expect(bindings.filter(v=>v.isStorageBuffer&&(v.visibility&bit)!==0).length).toBeLessThanOrEqual(8);
    if(pass==='main'){const inspection=inspectBiInkOccupancyProgram(b.fragmentShader,{bodyVariable:'plantAtlasBody',dxVariable:'plantAtlasDx',dyVariable:'plantAtlasDy'});expect(inspection.errors).toEqual([]);const banks=bindings.filter(v=>v.isSampledTexture&&(v.texture?.isArrayTexture||v.texture instanceof THREE.DataArrayTexture));expect(banks).toHaveLength(1);expect(bindings.filter(v=>v.isSampler&&!v.isSampledTexture&&v.texture===banks[0]!.texture)).toHaveLength(1);expect(bindings.filter(v=>v.isStorageBuffer&&(v.visibility&2)!==0)).toHaveLength(0);writeTestFileSync('artifacts/plant-occupancy-'+style+'-inspection.json',JSON.stringify(inspection,null,2));}
    writeTestFileSync('artifacts/plant-occupancy-'+style+'-'+pass+'-vertex.wgsl',b.vertexShader);writeTestFileSync('artifacts/plant-occupancy-'+style+'-'+pass+'-fragment.wgsl',b.fragmentShader);compiled++;
   }finally{mesh.material=saved;}
  });
  for(const next of['default','origami']as const){style=next;context.update({...context.preferences,style});for(const nextPass of['main','shadow']as const){pass=nextPass;scene.overrideMaterial=pass==='shadow'?shadow:null;mesh.material=material;renderer.renderObject(mesh,scene,camera,geometry,material,null,new THREE.LightsNode().setLights([sun,sky]));}}
  expect(compiled).toBe(4);expect(surface.material).toBe(material);expect(mesh.geometry).toBe(geometry);expect(geometry.index).toBe(indices);for(const[name,a]of Object.entries(attributes))expect(geometry.getAttribute(name)).toBe(a);expect(mesh.instanceMatrix.array).toEqual(matrices);expect(mesh.instanceColor!.array).toEqual(colors);expect(init).not.toHaveBeenCalled();
 }finally{Reflect.set(renderer,'_handleObjectFunction',dispatch);context.surfacePreparation.dispose();layer.dispose();plain.dispose();pastel.dispose();lighting.dispose();context.dispose();init.mockRestore();flush.mockRestore();}
},120_000);
