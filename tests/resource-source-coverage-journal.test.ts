/** Actual Resource ownership plus existing native compiled-record/observer
 * fixture. No Source pixel, complete Source shader, device or timing claim. */
import{expect,test,vi}from'vitest';
import*as THREE from'three/webgpu';
import{ivec2}from'three/tsl';
import{GraphicsStyleContext,withGraphicsStyle}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{ResourceLayer}from'../src/render/ResourceLayer';
import{EnvironmentLighting}from'../src/render/EnvironmentLighting';
import{createStylizedSurfaceTexture}from'../src/render/stylized-surfaces';
import{ownedMaterialResources435}from'../src/render/OwnedMaterialResources435';
import{compatibleOwnedOpaqueCompiled435}from'../src/render/OwnedOpaqueCompiled435';
import{OwnedOpaqueRevisions435}from'../src/render/OwnedOpaqueRevisions435';
import{metadataTexel}from'../src/render/surfaces/MetadataTexel';
import type{ResourcePreparedAtlas,ResourcePreparedAtlasOptions}from'../src/render/surfaces/ResourcePreparedAtlas';
import type{PreparedTextureSurface}from'../src/render/surfaces/PreparedTextureSurface';
import type{ResourceLegacyCoverage}from'../src/render/surfaces/ResourceLegacyCoverage';
import{nativeCompiledFixture435}from'./helpers/owned-opaque-native-fixture-v435';

test('the actual borrowed Source polygon texture stays declared in both representations while its non-native reader keeps the existing435 native fallback',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),
  flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),environment=new EnvironmentLighting(),
  plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshLambertNodeMaterial({vertexColors:true}),pastel=createStylizedSurfaceTexture('vegetation');
 environment.configure(plain);environment.configure(paint);
 const layer=withGraphicsStyle(context,()=>new ResourceLayer(new THREE.Group(),plain,paint,undefined,{pastelTexture:pastel,configure:environment.configure})),
  atlas=Reflect.get(layer,'preparedResources')as ResourcePreparedAtlas,
  coverage=(Reflect.get(layer,'surfaceModels')as{legacyCoverage:ResourceLegacyCoverage}).legacyCoverage,
  surface=[...(Reflect.get(atlas.owner,'surfaces')as Map<THREE.NodeMaterial,PreparedTextureSurface>).values()][0]!;
 if(!surface)throw Error('Actual Resource-owned final surface required');
 const mask=coverage.texture,material=surface.material,journal=ownedMaterialResources435(material)!;
 let maskDisposals=0;mask.addEventListener('dispose',()=>{maskDisposals++;});
 const h=nativeCompiledFixture435(),observerOwner=new OwnedOpaqueRevisions435(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),shadow=new THREE.DirectionalLight().shadow;
 try{
  const atlasOptions=Reflect.get(atlas,'options')as ResourcePreparedAtlasOptions,borrowedMask=atlasOptions.sourceCoverageTexture;
  expect(typeof borrowedMask).toBe('function');expect(borrowedMask!()).toBe(mask);expect(mask).toBeInstanceOf(THREE.DataTexture);expect(mask.type).toBe(THREE.FloatType);
  expect(journal.textures.has(mask)).toBe(true);expect(journal.arrayTextures.has(mask)).toBe(false);expect(journal.storage.size).toBe(0);expect(atlas.owner.options.externalGpuBytes?.()).toBe(coverage.gpuBytes);
  surface.selectRepresentation('pure');surface.setAssets(undefined);expect(ownedMaterialResources435(material)!.textures.has(mask)).toBe(true);
  context.update({...context.preferences,style:'origami'});surface.selectRepresentation('source');surface.setAssets(undefined);expect(surface.material).toBe(material);expect(ownedMaterialResources435(material)!.textures.has(mask)).toBe(true);

  // This is the SAME public reader used by Source coverage. Exercise the real
  // native binding classes without whitelisting its TextureNode subclass.
  const wrapper=metadataTexel(mask,ivec2(0,0)),reader:unknown=Reflect.get(wrapper,'node');
  if(!(reader instanceof THREE.TextureNode)||Object.getPrototypeOf(reader)===THREE.TextureNode.prototype)throw Error('Actual Source metadata subclass required');
  h.updates.push(reader);h.add(reader,'texture','fragment','actualSourcePolygonMask');h.textures.add(mask);
  const compiled=h.state();expect(compatibleOwnedOpaqueCompiled435(compiled,h.declaration)).toMatchObject({accepted:false,reason:'texture-writer-not-native'});

  scene.add(h.mesh);scene.updateMatrixWorld(true);shadow.map=new THREE.RenderTarget(512,512);shadow.map.depthTexture=new THREE.DepthTexture(512,512);
  observerOwner.attach(h.renderer,scene,[h.enabled,h.size],[mask]);observerOwner.producer('box').register(h.mesh,[h.material],[mask]);observerOwner.setEnabled(true);observerOwner.preflight(camera,shadow);
  const observer=h.material.setupObserver(h.builder),refresh:unknown=Reflect.get(observer,'needsRefresh');if(typeof refresh!=='function')throw Error('Actual installed observer required');
  const renderObject={object:h.mesh,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:compiled,_bindings:[],bundle:null},frame={renderer:h.renderer,camera,frameId:1,renderId:1};
  for(let i=0;i<2;i++){Reflect.apply(refresh,observer,[renderObject,frame]);Reflect.apply(h.mesh.onAfterRender,h.mesh,[h.renderer,scene,camera,h.mesh.geometry,h.material,null]);frame.frameId++;frame.renderId++;}
  expect(observerOwner.metrics().reasons['program:texture-writer-not-native']).toBe(2);expect(observerOwner.metrics().shared).toBe(0);
  surface.dispose();expect(maskDisposals).toBe(0);layer.dispose();expect(maskDisposals).toBe(1);
 }finally{
  observerOwner.dispose();shadow.map?.dispose();h.dispose();context.surfacePreparation.dispose();layer.dispose();plain.dispose();paint.dispose();pastel.dispose();environment.dispose();context.dispose();flush.mockRestore();
 }
},60_000);
