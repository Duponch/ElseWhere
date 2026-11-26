import {expect,test} from 'vitest';
import {Box3,DataTexture,DepthTexture,DirectionalLight,Group,MaterialReferenceNode,Mesh,MeshLambertNodeMaterial,NodeMaterialObserver,PerspectiveCamera,Renderer,RenderObjectRefreshType,RenderTarget,Scene,TextureNode,UniformNode,Vector3} from 'three/webgpu';
import {OwnedOpaqueRevisions435} from '../src/render/OwnedOpaqueRevisions435';
import {nativeCompiledFixture435} from './helpers/owned-opaque-native-fixture-v435';
import {SpatialInstanceRanges379} from '../src/render/SpatialInstanceRanges379';
import {createOwnedMaterialResources435} from '../src/render/OwnedMaterialResources435';
import {createSourceOwnedRenderHook435} from '../src/render/SourceOwnedRenderHooks435';

test('an actual compiled native observer predating producer registration acquires its completed FULL receipt',()=>{
 const h=nativeCompiledFixture435(),monitor=h.nativeObserver(),owner=new OwnedOpaqueRevisions435(),scene=new Scene(),camera=new PerspectiveCamera(),shadow=new DirectionalLight().shadow;
 // This is the real observer made before registration. A later material
 // setupObserver factory cannot replace a cached NodeBuilderState's observer.
 expect(monitor.hasNode).toBe(true);expect(Reflect.get(monitor,'needsRefresh')).toBe(Reflect.get(NodeMaterialObserver.prototype,'needsRefresh'));
 shadow.map=new RenderTarget(512,512);shadow.map.depthTexture=new DepthTexture(512,512);shadow.mapSize.set(512,512);scene.add(h.mesh);scene.updateMatrixWorld();
 owner.attach(h.renderer,scene,[h.enabled,h.size],[]);const producer=owner.producer('box');producer.register(h.mesh,[h.material]);owner.setEnabled(true);owner.preflight(camera,shadow);
 const state=h.state(),ro={object:h.mesh,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:state,_bindings:state.bindings,_monitor:monitor,bundle:null},frame={renderer:h.renderer,camera};
 let fullBindings=0,sharedBindings=0,geometryUpdates=0,draws=0,last:unknown;
 const scope={_objects:{get:()=>ro},_currentRenderBundle:null,
  _nodes:{needsRefresh:()=>{const refresh:unknown=Reflect.get(monitor,'needsRefresh');if(typeof refresh!=='function')throw Error('Native monitor missing.');last=Reflect.apply(refresh,monitor,[ro,frame]);return last;},updateBefore(){},updateForRender(){},updateAfter(){}},
  _geometries:{updateForRender:()=>{geometryUpdates++;}},_bindings:{updateForRender:()=>{fullBindings++;},updateSharedForRender:()=>{sharedBindings++;}},
  _pipelines:{updateForRender(){},isReady:()=>true},backend:{draw:()=>{draws++;}},info:{},
 };
 const direct:unknown=Reflect.get(Renderer.prototype,'_renderObjectDirect'),certify:unknown=Reflect.get(owner,'certifyCommand');if(typeof direct!=='function'||typeof certify!=='function')throw Error('Pinned native receipt path missing.');
 const draw=()=>{Reflect.apply(direct,scope,[h.mesh,h.material,scene,camera,null,null,null]);Reflect.apply(h.mesh.onAfterRender,h.mesh,[h.renderer,scene,camera,h.mesh.geometry,h.material,null]);};
 try{
  draw();expect(last).toBe(RenderObjectRefreshType.FULL);expect(draws).toBe(1);expect(fullBindings).toBe(1);
  expect(Reflect.apply(certify,owner,[ro])).toBeDefined();expect(owner.metrics()).toMatchObject({acceptedPlans:1,commandNativeReceipts:1});expect(owner.metrics().commandDiagnostics.rejects).toEqual({});
  draw();expect(last).toBe(RenderObjectRefreshType.SHARED);expect(sharedBindings).toBe(1);expect(geometryUpdates).toBe(1);
  producer.dirty(h.mesh);draw();expect(last).toBe(RenderObjectRefreshType.FULL);expect(geometryUpdates).toBe(2);expect(Reflect.apply(certify,owner,[ro])).toBeDefined();
 }finally{owner.dispose();shadow.map.dispose();h.dispose();}
});

test('a strict ownership rejection uses live native object writers and UBOs without freezing undeclared inputs',()=>{
 const h=nativeCompiledFixture435(),owner=new OwnedOpaqueRevisions435(),scene=new Scene(),camera=new PerspectiveCamera(),shadow=new DirectionalLight().shadow;
 const fog=new UniformNode(25).setName('nativeLiveFog');h.add(fog,'float');
 shadow.map=new RenderTarget(512,512);shadow.map.depthTexture=new DepthTexture(512,512);shadow.mapSize.set(512,512);scene.add(h.mesh);scene.updateMatrixWorld();
 owner.attach(h.renderer,scene,[h.enabled,h.size],[]);owner.producer('box').register(h.mesh,[h.material]);owner.setEnabled(true);owner.preflight(camera,shadow);
 const monitor=h.material.setupObserver(h.builder),state=h.state(),ro={object:h.mesh,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:state,_bindings:state.bindings,_monitor:monitor,bundle:null},frame={renderer:h.renderer,camera};
 const certify:unknown=Reflect.get(owner,'certifyCommand'),refresh:unknown=Reflect.get(monitor,'needsRefresh');if(typeof certify!=='function'||typeof refresh!=='function')throw Error('Native command certification missing');
 try{
  expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(RenderObjectRefreshType.FULL);
  const plan:unknown=Reflect.apply(certify,owner,[ro]);expect(plan).toMatchObject({liveObjectInputs:true,shared:state.updateNodes});
  expect(owner.metrics()).toMatchObject({acceptedPlans:0,commandLivePlans:1,commandNativeReceipts:1,shared:0});
  expect(owner.metrics().commandDiagnostics.rejects).toEqual({});
  const sample:unknown=owner.metrics().commandDiagnostics.samples['live-object-inputs'];expect(sample).toMatchObject({uniforms:expect.arrayContaining([expect.objectContaining({nodeName:'nativeLiveFog',declared:false,update:'none',value:25})])});
  fog.value=90;
  // Native monitor stays FULL outside the bundle path. The live-input policy
  // never changes hasNode or makes the strict observer return SHARED.
  expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(RenderObjectRefreshType.FULL);expect(owner.metrics().shared).toBe(0);
  Reflect.set(monitor,'needsRefresh',()=>RenderObjectRefreshType.NONE);expect(Reflect.apply(certify,owner,[ro])).toBeUndefined();
 }finally{owner.dispose();shadow.map.dispose();h.dispose();}
});

test('a negative actual binding program skips later identity preflights but reopens when source resources publish',()=>{
 const h=nativeCompiledFixture435({texture:true}),owner=new OwnedOpaqueRevisions435(),scene=new Scene(),camera=new PerspectiveCamera(),shadow=new DirectionalLight().shadow;
 shadow.map=new RenderTarget(512,512);shadow.map.depthTexture=new DepthTexture(512,512);shadow.mapSize.set(512,512);scene.add(h.mesh);scene.updateMatrixWorld();
 owner.attach(h.renderer,scene,[h.enabled,h.size],[]);owner.producer('box').register(h.mesh,[h.material]);owner.setEnabled(true);owner.preflight(camera,shadow);
 const monitor=h.material.setupObserver(h.builder),state=h.state(),ro={object:h.mesh,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:state,_bindings:state.bindings,_monitor:monitor,bundle:null},frame={renderer:h.renderer,camera};
 const certify:unknown=Reflect.get(owner,'certifyCommand'),refresh:unknown=Reflect.get(monitor,'needsRefresh');if(typeof certify!=='function'||typeof refresh!=='function')throw Error('Native command certification missing');
 try{
  expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(RenderObjectRefreshType.FULL);
  expect(Reflect.apply(certify,owner,[ro])).toBeUndefined();
  const identityReads=owner.metrics().identityReads;
  for(let i=0;i<5;i++){owner.preflight(camera,shadow);expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(RenderObjectRefreshType.FULL);}
  expect(owner.metrics()).toMatchObject({identityReads,negativePreflights:5});
  owner.publishSharedSurfaceTextures([h.map]);owner.preflight(camera,shadow);
  expect(owner.metrics().identityReads).toBe(identityReads);
  expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(RenderObjectRefreshType.FULL);
  expect(owner.metrics().identityReads).toBeGreaterThan(identityReads);
  Reflect.apply(h.mesh.onAfterRender,h.mesh,[h.renderer,scene,camera,h.mesh.geometry,h.material,null]);
  expect(Reflect.apply(certify,owner,[ro])).toBeDefined();
 }finally{owner.dispose();shadow.map.dispose();h.dispose();}
});

test('publication replaces the actual storage owner, never declares a retired native binding',()=>{
 const h=nativeCompiledFixture435({storage:true}),owner=new OwnedOpaqueRevisions435(),scene=new Scene(),camera=new PerspectiveCamera(),shadow=new DirectionalLight().shadow;
 shadow.map=new RenderTarget(512,512);shadow.map.depthTexture=new DepthTexture(512,512);shadow.mapSize.set(512,512);scene.add(h.mesh);scene.updateMatrixWorld();
 owner.attach(h.renderer,scene,[h.enabled,h.size],[]);owner.producer('box').register(h.mesh,[h.material]);owner.setEnabled(true);owner.preflight(camera,shadow);
 const monitor=h.material.setupObserver(h.builder),state=h.state(),ro={object:h.mesh,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:state,_bindings:state.bindings,_monitor:monitor,bundle:null},frame={renderer:h.renderer,camera};
 const certify:unknown=Reflect.get(owner,'certifyCommand'),refresh:unknown=Reflect.get(monitor,'needsRefresh');if(typeof certify!=='function'||typeof refresh!=='function')throw Error('Native command certification missing');
 const draw=()=>{owner.preflight(camera,shadow);expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(RenderObjectRefreshType.FULL);Reflect.apply(h.mesh.onAfterRender,h.mesh,[h.renderer,scene,camera,h.mesh.geometry,h.material,null]);return Reflect.apply(certify,owner,[ro]);};
 try{
  expect(draw()).toBeUndefined();owner.publishSharedSurfaceStorage([h.attribute]);expect(draw()).toBeDefined();
  const epoch=owner.metrics().resourceEpoch;owner.publishSharedSurfaceStorage([h.attribute]);expect(owner.metrics().resourceEpoch).toBe(epoch);
  owner.publishSharedSurfaceStorage([]);expect(draw()).toBeUndefined();
 }finally{owner.dispose();shadow.map.dispose();h.dispose();}
});

test('actual MAIN draws admit visible producers once, without visiting the hidden roster or borrowing its ancestry proof',()=>{
 const h=nativeCompiledFixture435(),owner=new OwnedOpaqueRevisions435(),scene=new Scene(),camera=new PerspectiveCamera(),shadow=new DirectionalLight().shadow,hiddenGroup=new Group();
 shadow.map=new RenderTarget(512,512);shadow.map.depthTexture=new DepthTexture(512,512);shadow.mapSize.set(512,512);scene.add(h.mesh,hiddenGroup);hiddenGroup.visible=false;
 const hidden=Array.from({length:128},()=>new Mesh(h.mesh.geometry,h.material));hiddenGroup.add(...hidden);scene.updateMatrixWorld();
 owner.attach(h.renderer,scene,[h.enabled,h.size],[]);const producer=owner.producer('box');producer.register(h.mesh,[h.material]);for(const mesh of hidden)producer.register(mesh,[h.material]);owner.setEnabled(true);owner.preflight(camera,shadow);
 const monitor=h.material.setupObserver(h.builder),state=h.state(),frame={renderer:h.renderer,camera},refresh:unknown=Reflect.get(monitor,'needsRefresh');if(typeof refresh!=='function')throw Error('Native refresh missing');
 const make=(object:Mesh)=>({object,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:state,_bindings:state.bindings,_monitor:monitor,bundle:null}),main=make(h.mesh),revealed=make(hidden[0]!);
 const draw=(ro:typeof main)=>{const result=Reflect.apply(refresh,monitor,[ro,frame]);Reflect.apply(ro.object.onAfterRender,ro.object,[h.renderer,scene,camera,ro.geometry,ro.material,null]);return result;};
 try{
  expect(owner.metrics()).toMatchObject({meshes:129,visiblePreflights:0,identityReads:0});
  expect(draw(main)).toBe(RenderObjectRefreshType.FULL);expect(draw(main)).toBe(RenderObjectRefreshType.SHARED);expect(owner.metrics()).toMatchObject({visiblePreflights:1,identityReads:84});
  for(let i=0;i<10;i++)owner.preflight(camera,shadow);
  expect(owner.metrics()).toMatchObject({visiblePreflights:1,identityReads:84});
  hiddenGroup.visible=true;hiddenGroup.position.setX(4);scene.updateMatrixWorld();owner.preflight(camera,shadow);
  expect(draw(revealed)).toBe(RenderObjectRefreshType.FULL);expect(draw(revealed)).toBe(RenderObjectRefreshType.FULL);
  expect(owner.metrics().visiblePreflights).toBe(2);expect(owner.metrics().reasons.ownership).toBeGreaterThanOrEqual(2);
  hiddenGroup.position.setX(0);scene.updateMatrixWorld();owner.preflight(camera,shadow);
  expect(draw(revealed)).toBe(RenderObjectRefreshType.FULL);expect(draw(revealed)).toBe(RenderObjectRefreshType.SHARED);
  expect(owner.metrics().visiblePreflights).toBe(3);
 }finally{owner.dispose();shadow.map.dispose();h.dispose();}
});

test('a real static spatial page receives native FULL/SHARED receipts only through its exact constructor callbacks',()=>{
 const h=nativeCompiledFixture435(),owner=new OwnedOpaqueRevisions435(),scene=new Scene(),camera=new PerspectiveCamera(),shadow=new DirectionalLight().shadow;
 const materialJournal=createOwnedMaterialResources435(h.material,{textures:[],arrayTextures:[],sharedGroups:[]});
 h.mesh.onBeforeRender=createSourceOwnedRenderHook435(()=>{});const producer=owner.producer('static-page'),ranges=new SpatialInstanceRanges379(h.mesh,'indices',producer);
 camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 shadow.map=new RenderTarget(512,512);shadow.map.depthTexture=new DepthTexture(512,512);shadow.mapSize.set(512,512);scene.add(h.mesh);scene.updateMatrixWorld();
 Reflect.set(h.renderer,'_attributes',{update(){},delete(){}});
 expect(ranges.setRanges([-3,0,3,6].map((x,i)=>({first:i*9,count:9,bounds:new Box3(new Vector3(x-.1,-.1,-.1),new Vector3(x+.1,.1,.1))})))).toBe(true);
 owner.attach(h.renderer,scene,[h.enabled,h.size],[]);producer.register(h.mesh,[h.material],[],{beforeRender:h.mesh.onBeforeRender});owner.setEnabled(true);owner.preflight(camera,shadow);
 const monitor=h.material.setupObserver(h.builder),state=h.state(),ro={object:h.mesh,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:state,_bindings:state.bindings,_monitor:monitor,bundle:null},frame={renderer:h.renderer,camera},certify:unknown=Reflect.get(owner,'certifyCommand'),refresh:unknown=Reflect.get(monitor,'needsRefresh');if(typeof certify!=='function'||typeof refresh!=='function')throw Error('Native certification missing');
 const foreign=new Mesh(h.mesh.geometry.clone(),h.material);foreign.onBeforeRender=createSourceOwnedRenderHook435(()=>{});const borrowed=new SpatialInstanceRanges379(foreign,'indices',{register(){},dirty(){},forget(){}});
 expect(borrowed.setRanges([-3,0,3,6].map((x,i)=>({first:i*9,count:9,bounds:new Box3(new Vector3(x-.1,-.1,-.1),new Vector3(x+.1,.1,.1))})))).toBe(true);producer.register(foreign,[h.material],[],{beforeRender:foreign.onBeforeRender});
 const draw=()=>{owner.preflight(camera,shadow);Reflect.apply(h.mesh.onBeforeRender,h.mesh,[h.renderer,scene,camera,h.mesh.geometry,h.material,null]);const result=Reflect.apply(refresh,monitor,[ro,frame]);Reflect.apply(h.mesh.onAfterRender,h.mesh,[h.renderer,scene,camera,h.mesh.geometry,h.material,null]);return result;};
 try{
  expect(owner.metrics().meshes).toBe(1);expect(draw()).toBe(RenderObjectRefreshType.FULL);expect(h.mesh.geometry.indirect).not.toBeNull();expect(Reflect.apply(certify,owner,[ro])).toBeDefined();expect(draw()).toBe(RenderObjectRefreshType.SHARED);
  h.mesh.onBeforeRender=()=>{};expect(draw()).toBe(RenderObjectRefreshType.FULL);expect(Reflect.apply(certify,owner,[ro])).toBeUndefined();
 }finally{owner.dispose();ranges.dispose();borrowed.dispose();foreign.geometry.dispose();materialJournal.dispose();shadow.map.dispose();h.dispose();}
});

test('a real material-map reference can recover only after the native FULL writer and actual completion receipt',()=>{
 const run=(recover:boolean)=>{
  const h=nativeCompiledFixture435(),owner=new OwnedOpaqueRevisions435(),scene=new Scene(),camera=new PerspectiveCamera(),shadow=new DirectionalLight().shadow,foreignTexture=new DataTexture(new Uint8Array([255,30,10,255]),1,1),foreign=new MeshLambertNodeMaterial({map:foreignTexture});
  h.material.map=h.map;const reference=new MaterialReferenceNode('map','texture'),bind=(material:MeshLambertNodeMaterial)=>{Reflect.apply(reference.updateReference,reference,[{material}]);Reflect.apply(reference.update,reference,[{}]);};bind(h.material);
  const texture:unknown=Reflect.get(reference,'node');if(!(texture instanceof TextureNode))throw Error('Actual native map reference output missing.');h.add(texture,'texture','fragment','nativeMap');h.updates.push(reference,texture);
  shadow.map=new RenderTarget(512,512);shadow.map.depthTexture=new DepthTexture(512,512);shadow.mapSize.set(512,512);scene.add(h.mesh);scene.updateMatrixWorld();owner.attach(h.renderer,scene,[h.enabled,h.size],[h.map]);owner.producer('box').register(h.mesh,[h.material],[h.map]);owner.setEnabled(true);owner.preflight(camera,shadow);
  const monitor=h.material.setupObserver(h.builder),state=h.state(),ro={object:h.mesh,material:h.material,geometry:h.mesh.geometry,scene,camera,_nodeBuilderState:state,_bindings:state.bindings,_monitor:monitor,bundle:null},frame={renderer:h.renderer,camera},certify:unknown=Reflect.get(owner,'certifyCommand'),refresh:unknown=Reflect.get(monitor,'needsRefresh');if(typeof certify!=='function'||typeof refresh!=='function')throw Error('Native certification missing.');
  try{
   // Real r186 writer points to another material immediately before this draw.
   bind(foreign);expect(texture.value).toBe(foreignTexture);expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(RenderObjectRefreshType.FULL);expect(owner.metrics()).toMatchObject({resourceFullRetries:1,resourceFullRecoveries:0,commits:0});
   expect(Reflect.apply(certify,owner,[ro])).toBeUndefined();
   if(recover)bind(h.material);
   Reflect.apply(h.mesh.onAfterRender,h.mesh,[h.renderer,scene,camera,h.mesh.geometry,h.material,null]);
   const plan=Reflect.apply(certify,owner,[ro]);expect(owner.metrics().resourceFullRecoveries).toBe(recover?1:0);expect(plan!==undefined).toBe(recover);
   owner.preflight(camera,shadow);expect(Reflect.apply(refresh,monitor,[ro,frame])).toBe(recover?RenderObjectRefreshType.SHARED:RenderObjectRefreshType.FULL);
  }finally{owner.dispose();shadow.map.dispose();foreign.dispose();foreignTexture.dispose();h.dispose();}
 };
 run(true);run(false);
});
