/** Compound compiler/binding CONTROL FLOW on the real complete deer model.
 * Render/readback are no-device ports: RGB values are TEST data, never pixels
 * or a visual/performance proof. Cold WGSL covers albedo+blood only; the true
 * Wildlife pose/Room/shadow graph has a separate contract, not repeated here. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {attribute,bool,float,positionLocal} from 'three/tsl';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {indexExactStaticVertices} from '../src/render/origami/static-index';
import {growPawnBuffers} from '../src/render/pawn-buffers';
import {bodyBloodPigment} from '../src/render/body-blood';
import {BakedAnimalLibrary,prepareAnimalAtlasBinding,type AnimalAtlasCompileInput,type AnimalAtlasCompilation,type AnimalBakeRequest,type AnimalAtlasCompiler,type AnimalAtlasPublication} from '../src/render/origami/baked/animal-baked';
import {prepareGpuFilteredAtlas} from '../src/render/origami/baked/gpu-filtered-atlas';
import {attachBakedChartMeans,BAKED_MEAN_ATTRIBUTE} from '../src/render/origami/baked/chart-mean';
import {writeTestFileSync} from './test-output';

const MiB=1024*1024;
function source(){const body=origamiAnimalPresentationGeometry(2,'deer',false);if(!body)throw Error('Actual deer unavailable');if(body.userData.origamiReference)indexExactStaticVertices(body);body.instanceCount=2;return body;}
function disposeSource(body:THREE.BufferGeometry){body.dispose();for(const key of ['origamiLines','origamiWear']){const g=body.userData[key];if(g instanceof THREE.BufferGeometry)g.dispose();}}
function request(compiler:AnimalAtlasCompiler,fingerprint:string):AnimalBakeRequest{
 const rgba=new Uint8Array(16).fill(255),pixels={pigment:rgba,paper:rgba,coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up' as const};
 return{recipeFingerprint:'TEST-real-deer-filtered-binding',paletteFingerprint:'TEST-uniform-not-image-validation',paintFingerprint:'TEST-generation0',compiler,compilerFingerprint:fingerprint,impasto:0,wear:0,edgeWidth:1.7,strokeImperfection:.15,
  chartOptions:{texelsPerUnit:256,paddingTexels:8,mipLevels:4,maxAtlasSize:2048,maxAtlasPixels:2048*2048,maxOutputBytes:32*MiB,maxTriangles:20000},
  paint:{readProfile:()=>pixels,edgeAlpha:{data:rgba,width:2,height:2},brushColorLinear:[.02,.015,.01],lineOpacity:.79,strokeImperfection:.15},maxInkTriangles:100000,reservation:{cpuBytes:64*MiB,gpuBytes:256*MiB},deferGpuReservation:true};
}
function rendererPort(){
 const oldTarget=new THREE.RenderTarget(4,4),clear=new THREE.Color(.1,.2,.3),targets=new Set<THREE.RenderTarget>();let target:THREE.RenderTarget|null=oldTarget,face=2,mip=1,alpha=.7;
 const api={initialized:true,backend:{isWebGPUBackend:true},autoClear:false,getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,getClearColor:(out:THREE.Color)=>out.copy(clear),getClearAlpha:()=>alpha,
  setRenderTarget(next:THREE.RenderTarget|null,nextFace=0,nextMip=0){target=next;face=nextFace;mip=nextMip;if(next&&next!==oldTarget)targets.add(next);},setClearColor(value:THREE.Color|number,nextAlpha=1){clear.set(value);alpha=nextAlpha;},
  renderAsync:vi.fn(async()=>{}),copyTextureToTexture:vi.fn(),readRenderTargetPixelsAsync:vi.fn(async(_target:THREE.RenderTarget,_x:number,_y:number,width:number)=>Float32Array.from({length:width*4},(_,i)=>i%4===0?.25:i%4===1?.5:i%4===2?.75:0))};
 return{api,renderer:api as unknown as THREE.WebGPURenderer,oldTarget,targets,state:()=>({target,face,mip,alpha,clear:clear.toArray(),autoClear:api.autoClear})};
}
function targetCompilation(input:AnimalAtlasCompileInput):{result:AnimalAtlasCompilation;dispose:ReturnType<typeof vi.fn>}{
 const{width,height,mipLevels}=input.charts.atlas,target=new THREE.RenderTarget(width,height,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,colorSpace:THREE.SRGBColorSpace,depthBuffer:false,stencilBuffer:false,samples:0,generateMipmaps:false});
 target.texture.flipY=false;target.texture.generateMipmaps=false;target.texture.magFilter=THREE.LinearFilter;target.texture.minFilter=THREE.LinearMipmapLinearFilter;target.texture.mipmaps=Array.from({length:mipLevels},(_,level)=>({data:new Uint8Array(0),width:width/2**level,height:height/2**level}));
 const gpuBytes=Array.from({length:mipLevels},(_,level)=>width*height*4/4**level).reduce((a,b)=>a+b,0),dispose=vi.fn(()=>target.dispose());input.reservePreparation({cpuBytes:1024,gpuBytes});
 return{dispose,result:{texture:target.texture,cpuBytes:mipLevels*64,gpuBytes,stats:{testOnly:true,noDevicePixels:true},dispose}};
}
function inspectColor(mesh:THREE.Mesh,atlas:THREE.Texture){
 const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}} as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold binding graph must not request a device');});renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),ambient=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(mesh,sun,ambient);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 type Binding={name:string;texture?:THREE.Texture;isSampledTexture?:boolean};
 type Inspector={scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;build():unknown;vertexShader:string;fragmentShader:string;getBindings():{bindings:Binding[]}[]};
 const Builder=THREE.WGSLNodeBuilder as unknown as new(object:THREE.Object3D,renderer:THREE.WebGPURenderer)=>Inspector;
 try{const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=mesh.material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,ambient]);builder.build();const bindings=builder.getBindings().flatMap(g=>g.bindings),atlasBindings=bindings.filter(b=>b.isSampledTexture&&b.texture===atlas);
  writeTestFileSync('artifacts/origami-animal-filtered-binding-vertex.wgsl',builder.vertexShader);writeTestFileSync('artifacts/origami-animal-filtered-binding-fragment.wgsl',builder.fragmentShader);
  expect(atlasBindings).toHaveLength(1);expect(builder.fragmentShader.match(new RegExp('textureSample(?:Bias|Level|Grad)?\\(\\s*'+atlasBindings[0]!.name+'\\s*,','g'))).toHaveLength(1);expect(bindings.filter(b=>b.isSampledTexture&&b.texture instanceof THREE.DataArrayTexture)).toHaveLength(0);
  expect(builder.vertexShader).toContain('v_bakedChartMeanLinear');expect(builder.fragmentShader).toContain('origamiBakedMeanFootprint');expect(builder.fragmentShader).toContain('v_bakedChartMeanLinear');expect(builder.fragmentShader).not.toMatch(/v_origamiPaintProfile|v_origamiInkStroke/);expect(init).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);
 }finally{mesh.removeFromParent();init.mockRestore();}
}

test('real compound filtered deer compiler lends a valid generated mean to the real binding, keeps blood/owners, and strictly checks means after real owner growth',async()=>{
 const r=rendererPort(),body=source(),library=new BakedAnimalLibrary({cpuBytes:128*MiB,gpuBytes:512*MiB}),counts=new Map<THREE.RenderTarget,number>(),targetDispose=vi.spyOn(THREE.RenderTarget.prototype,'dispose').mockImplementation(function(this:THREE.RenderTarget){counts.set(this,(counts.get(this)??0)+1);});
 const compiler:AnimalAtlasCompiler=input=>prepareGpuFilteredAtlas(r.renderer,input.charts,input.ink,input.profile,input.paint,{levels:4,maxCharts:256,maxCpuBytes:32*MiB,maxGpuBytes:256*MiB,maxTextureSize:4096},input.assertCurrent,input.reservePreparation);
 const material=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true});material.positionNode=positionLocal;material.normalNode=null;material.maskNode=bool(true);material.maskShadowNode=bool(false);
 const mesh=new THREE.Mesh(body,material),ribbons=new THREE.Object3D();ribbons.userData.origamiOwnerVisible=true;let attached=false;
 const port:AnimalAtlasPublication={isCurrent:()=>true,adoptConfiguredClone:(old,next)=>old===material&&next.positionNode===old.positionNode&&next.maskNode===old.maskNode&&next.maskShadowNode===old.maskShadowNode,warmup:async()=>{},publish:binding=>{mesh.geometry=binding.geometry;mesh.material=binding.material;attached=true;return{isAttached:()=>attached,detach(){mesh.geometry=body;mesh.material=material;attached=false;}};},ribbons};
 const blood=vi.fn((base:THREE.Node<'vec3'>)=>bodyBloodPigment(base,attribute('animalPart','vec4').z,1,attribute('animalPart','vec4').w.lessThan(0).select(float(1),float(0)),attribute('aBiology','vec3').y));
 let binding:ReturnType<typeof prepareAnimalAtlasBinding>|undefined,lease:Awaited<ReturnType<BakedAnimalLibrary['acquire']>>|undefined;const restoreSpies:(()=>void)[]=[];
 try{
  lease=await library.acquire('deer',request(compiler,'TEST-real-compound-filtered-v1'));const resource=lease.resource,resourceMean=resource.geometry.getAttribute(BAKED_MEAN_ATTRIBUTE),geometryDispose=vi.spyOn(resource.geometry,'dispose'),textureDispose=vi.spyOn(resource.atlas,'dispose');restoreSpies.push(()=>geometryDispose.mockRestore(),()=>textureDispose.mockRestore());
  expect(body.hasAttribute(BAKED_MEAN_ATTRIBUTE)).toBe(false);expect(resourceMean.itemSize).toBe(3);expect(resourceMean.count).toBe(resource.geometry.getAttribute('position').count);expect(r.api.readRenderTargetPixelsAsync).toHaveBeenCalledOnce();expect(library.snapshot()).toMatchObject({ready:1,pending:0,leases:1});
  binding=prepareAnimalAtlasBinding(lease,body,material,blood,port);expect(blood).toHaveBeenCalledTimes(1);expect(binding.geometry.getAttribute(BAKED_MEAN_ATTRIBUTE)).not.toBe(resourceMean);expect(binding.geometry.getAttribute(BAKED_MEAN_ATTRIBUTE).array).toBe(resourceMean.array);await binding.commit();
  expect(attached).toBe(true);expect(ribbons.visible).toBe(false);expect(binding.material.positionNode).toBe(material.positionNode);expect(binding.material.maskShadowNode).toBe(material.maskShadowNode);expect(binding.material.normalNode).toBeNull();expect(binding.material.transparent).toBe(false);inspectColor(mesh,resource.atlas);
  const beforeMean=binding.geometry.getAttribute(BAKED_MEAN_ATTRIBUTE).array.slice();growPawnBuffers([mesh],129);const grown=mesh.geometry as THREE.InstancedBufferGeometry,mean=grown.getAttribute(BAKED_MEAN_ATTRIBUTE);
  expect(mean.array).not.toBe(resourceMean.array);expect(mean.array).toEqual(beforeMean);grown.deleteAttribute(BAKED_MEAN_ATTRIBUTE);expect(()=>binding!.adoptGrownGeometry(grown)).toThrow(/static field mismatch bakedMeanRgb/);grown.setAttribute(BAKED_MEAN_ATTRIBUTE,mean);
  const old=mean.getX(0);mean.setX(0,old+.125);expect(()=>binding!.adoptGrownGeometry(grown)).toThrow(/epoch changed bakedMeanRgb/);mean.setX(0,old);binding.adoptGrownGeometry(grown);grown.instanceCount=129;binding.syncInstances(grown);
  expect(binding.geometry).toBe(grown);expect(grown.getAttribute('aFrom').count).toBe(256);expect(grown.getAttribute(BAKED_MEAN_ATTRIBUTE).array).toEqual(beforeMean);expect(resourceMean.getX(0)).toBe(old);expect(body.hasAttribute(BAKED_MEAN_ATTRIBUTE)).toBe(false);
  binding.dispose();binding=undefined;expect(attached).toBe(false);expect(ribbons.visible).toBe(true);expect(library.snapshot().leases).toBe(0);expect(library.evictUnused()).toBe(1);expect(geometryDispose).toHaveBeenCalledOnce();expect(textureDispose).not.toHaveBeenCalled();expect([...r.targets].every(t=>counts.get(t)===1)).toBe(true);expect(r.state()).toEqual({target:r.oldTarget,face:2,mip:1,alpha:.7,clear:[.1,.2,.3],autoClear:false});geometryDispose.mockRestore();
 }finally{binding?.dispose();lease?.release();library.evictUnused();library.dispose();for(const restore of restoreSpies)restore();targetDispose.mockRestore();r.oldTarget.dispose();material.dispose();disposeSource(body);}
},60_000);

test('animal preparation refuses malformed, out-of-range or nonconstant generated chart means and retires its compiler texture owner',async()=>{
 const library=new BakedAnimalLibrary({cpuBytes:128*MiB,gpuBytes:512*MiB});
 try{for(const failure of ['shape','range','chart'] as const){let owner:ReturnType<typeof targetCompilation>|undefined;
  const compiler:AnimalAtlasCompiler=input=>{const means=new Float32Array(input.charts.charts.length*3).fill(.5);attachBakedChartMeans(input.charts.geometry,input.charts.triangleChart,means);const field=input.charts.geometry.getAttribute(BAKED_MEAN_ATTRIBUTE);
   if(failure==='shape')input.charts.geometry.setAttribute(BAKED_MEAN_ATTRIBUTE,new THREE.BufferAttribute(new Float32Array(field.count*2),2));else field.setX(input.charts.triangles[0]!.outputVertices[1],failure==='range'?1.25:.25);owner=targetCompilation(input);return owner.result;};
  await expect(library.acquire('deer',request(compiler,'TEST-invalid-filtered-'+failure))).rejects.toThrow(failure==='shape'?/invalid static chart-mean/:failure==='range'?/invalid linear chart-mean/:/nonconstant chart-mean/);expect(owner?.dispose).toHaveBeenCalledOnce();expect(library.snapshot()).toMatchObject({ready:0,pending:0,leases:0,cpuBytes:0,gpuBytes:0,quarantined:0});
 }}finally{library.dispose();}
},60_000);

test('explicit blood-free capability skips the closure on normal and mean bindings while generic bindings retain it and their actual cold blood graph',async()=>{
 const body=source(),library=new BakedAnimalLibrary({cpuBytes:128*MiB,gpuBytes:512*MiB}),owners:ReturnType<typeof targetCompilation>[]=[],report:unknown[]=[];
 const inspect=(mesh:THREE.Mesh,atlas:THREE.Texture,label:string)=>{
  const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}} as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Blood-free cold inspection cannot request a device');});renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),ambient=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(mesh,sun,ambient);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
  type Binding={name:string;texture?:THREE.Texture;isSampledTexture?:boolean};
  type Inspector={scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;build():unknown;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];getBindings():{bindings:Binding[]}[]};
  const Builder=THREE.WGSLNodeBuilder as unknown as new(object:THREE.Object3D,renderer:THREE.WebGPURenderer)=>Inspector;
  try{const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=mesh.material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,ambient]);builder.build();
   writeTestFileSync(`artifacts/origami-animal-${label}-vertex.wgsl`,builder.vertexShader);writeTestFileSync(`artifacts/origami-animal-${label}-fragment.wgsl`,builder.fragmentShader);
   const bindings=builder.getBindings().flatMap(group=>group.bindings),atlasBinding=bindings.filter(b=>b.isSampledTexture&&b.texture===atlas);expect(atlasBinding).toHaveLength(1);
   const samples=(builder.fragmentShader.match(new RegExp('textureSample(?:Bias|Level|Grad)?\\(\\s*'+atlasBinding[0]!.name+'\\s*,','g'))??[]).length;expect(samples).toBe(1);expect(bindings.filter(b=>b.isSampledTexture&&b.texture instanceof THREE.DataArrayTexture)).toHaveLength(0);
   const facts={label,atlasSamples:samples,sinCalls:(builder.fragmentShader.match(/\bsin\s*\(/g)??[]).length,varyings:builder.varyings.filter(v=>v.needsInterpolation).map(v=>v.name),hasMean:builder.fragmentShader.includes('origamiBakedMeanFootprint')};expect(init).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);return facts;
  }finally{mesh.removeFromParent();init.mockRestore();}
 };
 try{for(const mean of [false,true]){
  const compiler=vi.fn<AnimalAtlasCompiler>(input=>{if(mean)attachBakedChartMeans(input.charts.geometry,input.charts.triangleChart,new Float32Array(input.charts.charts.length*3).fill(.5));const owner=targetCompilation(input);owners.push(owner);return owner.result;}),options=request(compiler,'TEST-blood-capability-'+(mean?'mean':'normal'));
  let generic:ReturnType<typeof inspect>|undefined,clean:ReturnType<typeof inspect>|undefined;
  for(const bloodFree of [false,true]){
   const lease=await library.acquire('deer',options),material=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true});material.positionNode=positionLocal;material.normalNode=null;material.maskNode=bool(true);material.maskShadowNode=bool(false);
   const mesh=new THREE.Mesh(body,material),ribbons=new THREE.Object3D();let attached=false,binding:ReturnType<typeof prepareAnimalAtlasBinding>|undefined;
   const blood=vi.fn((base:THREE.Node<'vec3'>)=>bodyBloodPigment(base,attribute('animalPart','vec4').z,1,attribute('animalPart','vec4').w.lessThan(0).select(float(1),float(0)),attribute('aBiology','vec3').y));
   const port:AnimalAtlasPublication={...(bloodFree?{bloodFree:true as const}:{}),isCurrent:()=>true,adoptConfiguredClone:()=>true,warmup:async()=>{},publish:next=>{mesh.geometry=next.geometry;mesh.material=next.material;attached=true;return{isAttached:()=>attached,detach(){mesh.geometry=body;mesh.material=material;attached=false;}};},ribbons};
   try{
    binding=prepareAnimalAtlasBinding(lease,body,material,blood,port);expect(blood).toHaveBeenCalledTimes(bloodFree?0:1);expect(binding.material.userData.origamiBakedBloodFree).toBe(bloodFree);await binding.commit();expect(attached).toBe(true);expect(binding.material.positionNode).toBe(material.positionNode);expect(binding.material.maskShadowNode).toBe(material.maskShadowNode);
    const facts=inspect(mesh,lease.resource.atlas,(mean?'mean':'normal')+(bloodFree?'-blood-free':'-generic-blood'));expect(facts.hasMean).toBe(mean);report.push(facts);if(bloodFree)clean=facts;else generic=facts;
   }finally{binding?.dispose();lease.release();material.dispose();}
   expect(attached).toBe(false);expect(library.snapshot().leases).toBe(0);
  }
  if(!generic||!clean)throw Error('Missing cold blood capability branches');expect(generic.sinCalls).toBe(3);expect(clean.sinCalls).toBe(0);expect(clean.varyings.length).toBeLessThan(generic.varyings.length);expect(compiler).toHaveBeenCalledOnce();expect(library.evictUnused()).toBe(1);
 }
 writeTestFileSync('artifacts/origami-animal-blood-free-graphs.json',JSON.stringify({scope:'Real deer/template/bindings, TEST RT metadata, cold albedo+blood graphs only; no device, pose/Room/performance claim',branches:report},null,2)+'\n');
 }finally{library.evictUnused();library.dispose();disposeSource(body);}
 expect(owners).toHaveLength(2);for(const owner of owners)expect(owner.dispose).toHaveBeenCalledOnce();
},60_000);
