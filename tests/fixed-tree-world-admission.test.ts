/** Actual Core admission/finalizer/stage/frame/dispose methods and ResourceLayer
 * producers. Only GPU baking, Canvas/texture uploads and unrelated scene layers
 * are TEST ports. Partial schema256 records are NOT Native301/Worker Worlds.
 * No device, image, performance, campaign or WholeMain evidence. */
import{afterEach,expect,test,vi}from'vitest';
import*as THREE from'three/webgpu';
import type{World,Resource}from'../src/sim/types';
import{SceneRenderCore}from'../src/render/SceneRenderCore';
import{ResourceLayer}from'../src/render/ResourceLayer';
import{GraphicsStyleContext,withGraphicsStyle}from'../src/render/graphics-style';
import{TreeBakeOwner,type TreeBakeDemand,type OwnedTreeCatalog}from'../src/render/origami/TreeBakeOwner';
import{TreeAtlasAdmissionRefusal}from'../src/render/origami/baked/trees/admission';
import{fixedTreePaintKey}from'../src/render/surfaces/FixedTreeTextureSurface';
import{createStylizedSurfaceTexture}from'../src/render/stylized-surfaces';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';

afterEach(()=>vi.restoreAllMocks());
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function call<T=void>(owner:object,name:string,...args:unknown[]):T{const fn:unknown=Reflect.get(owner,name);if(typeof fn!=='function')throw Error('Actual method missing '+name);return Reflect.apply(fn,owner,args)as T;}
const tree=(id:number,species:'poplar'|'oak',growth=1):Resource=>({id,kind:'tree',species,x:5+id,z:8,amount:20,growth});
const record=(tick:number,resources:Resource[]):World=>({schemaVersion:256,seed:61103,width:32,height:32,tick,site:{biome:'temperate-forest'},resources,structures:[],pawns:[],jobs:[],piles:[]}as unknown as World);
function fixture(){
 const graphics=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),paint=createStylizedSurfaceTexture('vegetation'),plain=new THREE.MeshLambertNodeMaterial({flatShading:true}),textured=new THREE.MeshLambertNodeMaterial({flatShading:true}),group=new THREE.Group(),resources=withGraphicsStyle(graphics,()=>new ResourceLayer(group,plain,textured,undefined,{pastelTexture:paint,configure:()=>{}}));
 // The graph is real; painting is outside this lifecycle fixture's mandate.
 Reflect.set(graphics,'ensureEdgeMaps',()=>{});Reflect.set(graphics,'prepareAtlasPaint',()=>({fingerprint:'TEST-paint-lease-only',assertCurrent(){},isCurrent:()=>true,paint:{}}));
 const applied=vi.fn(),uploads=vi.fn(),rendererDone=deferred(),renderer={getPixelRatio:()=>1,compileAsync:vi.fn(async()=>{}),setAnimationLoop:vi.fn(async()=>{}),dispose:vi.fn(()=>rendererDone.promise)},scene=new THREE.Scene();scene.add(group);
 const core:object=Object.assign(Object.create(SceneRenderCore.prototype),{disposed:false,closingPresentation:false,fatalError:undefined,preparing:false,holdSurfaceWorld:false,sharedSurfaceEpoch:0,backend:'WebGPU',texturesEnabled:true,graphicsStyle:graphics,resources,renderer,rendererLifetime:{closed:false},scene,captureGraphicsView:()=>({mode:'orthographic',position:[3,4,5],target:[0,0,0],zoom:1}),rig:{mode:'orthographic',pixelsPerCell:()=>32,orthographic:new THREE.OrthographicCamera(),perspective:new THREE.PerspectiveCamera(),dispose:vi.fn()},
  keys:new Set(),cancelGraphicsMeasurement:vi.fn(),invalidatePausedShadow:vi.fn(),updateSelectedObject:vi.fn(),updateHover:vi.fn(),onFatalError:vi.fn(),hostPort:{now:()=>1000,hidden:()=>false,selectionReady:()=>false},immutableWorlds:new WeakSet<World>(),coreFullInputs297:new WeakMap(),pendingCore297:[],appliedCore297:-Infinity,presentation:{clear:vi.fn(),take:vi.fn()},releaseCalmFullFrame297:vi.fn(),uploadSharedSurfaceAssets:uploads,hasTracks:false,
  environmentLighting:{configure:()=>{},dispose:vi.fn()},plants:{group:new THREE.Group(),hasPendingAtlasResources:()=>false,prepareAtlasResources:async()=>undefined,dispose:vi.fn()},
  applyWorldWithinSurfaceReads:(world:World,reset:boolean)=>{const input=JSON.stringify(world);Reflect.apply(resources.update,resources,[world,reset,undefined,undefined,{read:(r:Resource)=>({size:r.growth??1,ripe:true,leafless:false}),harvestable:()=>false}]);Reflect.set(core,'world',world);applied(world,reset);expect(JSON.stringify(world)).toBe(input);}});
 const banks:{value:OwnedTreeCatalog;disposed:ReturnType<typeof vi.fn>}[]=[];
 const bank=(demand:TreeBakeDemand)=>{const depth=Math.max(2,demand.models.length),texture=new THREE.DataArrayTexture(new Uint8Array(2*2*4*depth),2,2,depth);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.generateMipmaps=true;const slots=Array.from({length:64},()=>({layer:0,paletteBaked:false}));demand.models.forEach((m,layer)=>{slots[m.surfaceSlot]={layer,paletteBaked:true};});let closed=false;const disposed=vi.fn(()=>{if(!closed){closed=true;texture.dispose();}}),value:OwnedTreeCatalog={revision:banks.length+1,texture,pageCount:depth,slots,modelKeys:demand.models.map(m=>m.key),paintKey:fixedTreePaintKey(graphics),demandKey:demand.key,cpuBytes:0,gpuBytes:1024,peakGpuBytes:2048,assertCurrent(){if(closed)throw Error('TEST bank retired');},dispose:disposed};banks.push({value,disposed});return value;};
 const gpu=vi.spyOn(TreeBakeOwner.prototype,'prepare').mockImplementation(async(_r,_g,demand,_p,assert)=>{assert();return bank(demand);});
 return{core,graphics,resources,group,plain,textured,paint,applied,uploads,renderer,rendererDone,banks,bank,gpu,goGouache(){graphics.update({...graphics.preferences,style:'origami'});},job:()=>Reflect.get(core,'sharedSurfacePreparation')as Promise<void>,async dispose(){rendererDone.resolve();await(this.job()?.catch(()=>{}));resources.dispose();(Reflect.get(core,'bakedTreeOwner')as TreeBakeOwner|undefined)?.dispose();graphics.dispose();plain.dispose();textured.dispose();paint.dispose();for(const b of banks)b.value.dispose();}};
}

test('actual mid-frame application defers a new named model before drawing, then resumes only the latest World and OR(reset)',async()=>{
 const f=fixture(),gate=deferred(),a=record(1,[tree(1,'poplar')]),b=record(2,[tree(1,'poplar',.3)]),c=record(3,[tree(1,'poplar',.8)]);f.goGouache();
 f.gpu.mockImplementationOnce(async(_r,_g,demand,_p,assert)=>{await gate.promise;assert();return f.bank(demand);});
 Object.assign(f.core,{hasTracks:true,timeline:{tick:0,advance:vi.fn()},presentConfirmedIntents:vi.fn(()=>{throw Error('Must exit this frame before normal rendering');})});Reflect.set(Reflect.get(f.core,'presentation'),'take',vi.fn(()=>a));
 try{call(f.core,'frame',1000);expect(f.applied).not.toHaveBeenCalled();expect(Reflect.get(f.core,'preparing')).toBe(true);const job=f.job();await vi.waitFor(()=>expect(f.gpu).toHaveBeenCalledOnce(),{interval:1,timeout:1000});call(f.core,'applyWorld',b,true);call(f.core,'applyWorld',c,false);gate.resolve();await job;expect(f.applied).toHaveBeenCalledExactlyOnceWith(c,true);expect(f.gpu).toHaveBeenCalledOnce();expect(f.banks[0]!.disposed).not.toHaveBeenCalled();expect(f.resources.bakedTreeStatus()).toMatchObject({ready:1,fallback:0});expect(Reflect.get(f.core,'preparing')).toBe(false);expect(Reflect.get(f.core,'sharedSurfacePreparation')).toBeUndefined();}
 finally{gate.resolve();await f.dispose();}
},60000);

test('an added species during preparation retires only the unpublished candidate and admits the complete latest cohort before scene application',async()=>{
 const f=fixture(),gate=deferred(),a=record(1,[tree(1,'poplar')]),b=record(2,[tree(1,'poplar'),tree(2,'oak')]);f.goGouache();f.gpu.mockImplementationOnce(async(_r,_g,demand,_p,assert)=>{await gate.promise;assert();return f.bank(demand);});
 try{call(f.core,'applyWorld',a,false);const job=f.job();await vi.waitFor(()=>expect(f.gpu).toHaveBeenCalledOnce(),{interval:1,timeout:1000});call(f.core,'applyWorld',b,true);gate.resolve();await job;expect(f.gpu).toHaveBeenCalledTimes(2);expect(f.applied).toHaveBeenCalledExactlyOnceWith(b,true);expect(f.banks[0]!.disposed).toHaveBeenCalledOnce();expect(f.banks[1]!.disposed).not.toHaveBeenCalled();expect(f.resources.bakedTreeStatus()).toMatchObject({ready:2,fallback:0});expect(Reflect.get(f.core,'fatalError')).toBeUndefined();}
 finally{gate.resolve();await f.dispose();}
},60000);

test('real Core P/G/P keeps the fixed material created for the first Pastel frame and never rebakes its cached Gouache bank',async()=>{
 const f=fixture(),world=record(1,[tree(1,'poplar')]);
 try{call(f.core,'applyWorld',world,true);const meshes:THREE.Mesh[]=[];f.group.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});expect(meshes).toHaveLength(2);const before=meshes.map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,index:mesh.geometry.index,attributes:Object.values(mesh.geometry.attributes).map(a=>a.array)}));
  for(const style of['origami','default','origami','default']as const){await call<Promise<void>>(f.core,'setGraphicsStyleParameters',{...f.graphics.preferences,style});for(const row of before){expect(row.mesh.geometry).toBe(row.geometry);expect(row.mesh.material).toBe(row.material);expect(row.mesh.geometry.index).toBe(row.index);expect(Object.values(row.mesh.geometry.attributes).map(a=>a.array)).toEqual(row.attributes);}expect(f.resources.assertFixedTreeDrawReady()).toBeUndefined();}
  expect(f.gpu).toHaveBeenCalledOnce();expect(f.banks[0]!.disposed).not.toHaveBeenCalled();expect(f.renderer.dispose).not.toHaveBeenCalled();expect(Reflect.get(f.core,'renderer')).toBe(f.renderer);
 }finally{await f.dispose();}
},60000);

test.each([false,true])('only a typed pre-GPU capacity refusal selects direct Source; ordinary GPU error stops admission (runtimeError=%s)',async runtimeError=>{
 const f=fixture(),world=record(1,[tree(1,'poplar')]),error=runtimeError?new Error('TEST GPU failure'):new TreeAtlasAdmissionRefusal('TEST pre-GPU capacity');f.goGouache();f.gpu.mockRejectedValue(error);
 try{call(f.core,'applyWorld',world,false);const result=await f.job().catch(x=>x);if(runtimeError){expect(result).toBe(error);expect(f.applied).not.toHaveBeenCalled();expect(Reflect.get(f.core,'fatalError')).toContain('TEST GPU failure');}else{expect(result).toBeUndefined();expect(f.applied).toHaveBeenCalledExactlyOnceWith(world,false);expect(f.resources.assertFixedTreeDrawReady()).toBeUndefined();const plan=f.resources.inspectFixedTreeCohort(world);expect(f.resources.fixedTreeNeedsAdmission(plan)).toBe(false);call(f.core,'applyWorld',record(2,[tree(1,'poplar',.5)]),false);expect(f.gpu).toHaveBeenCalledOnce();expect(Reflect.get(f.core,'fatalError')).toBeUndefined();}}
 finally{await f.dispose();}
},60000);

test('closing during the actual admission job drains its pending prepare before any producer or renderer teardown',async()=>{
 const f=fixture(),gate=deferred(),world=record(1,[tree(1,'poplar')]);f.goGouache();f.gpu.mockImplementationOnce(async(_r,_g,demand)=>{await gate.promise;return f.bank(demand);});
 call(f.core,'applyWorld',world,false);const job=f.job();await vi.waitFor(()=>expect(f.gpu).toHaveBeenCalledOnce(),{interval:1,timeout:1000});
 const disposed=vi.spyOn(f.resources,'dispose');
 const names=['areaPreview','turretRange','recreationHints','orderRockPreview','constructionPreview','geysers','boxes','snowSurface','roofs','walls','hygiene','actionFeedback','actionVfx','brawlCloud','structureVfx','podRescue','orbitalDelivery','startingArrival','overview','deepResources','rocks','crops','surfaceTint','pawns','doors','projectiles','fires','wind','animalCargo','wildlife','mechanoids','ropes','designations','terrainPlainMaterial','terrainPaintMaterial','terrainPaintTexture','terrainPaintStaging','waterMaterial','paintedWater','clouds','precipitation'];
 for(const name of names)Reflect.set(f.core,name,{dispose:vi.fn()});Reflect.set(Reflect.get(f.core,'rocks'),'rockFinalRequiresAsyncClose',()=>false);for(const name of['terrainGroup','structureGroup','jobGroup','storageGroup','pileGroup'])Reflect.set(f.core,name,new THREE.Group());Reflect.set(f.core,'resourceGroup',f.group);
 for(const name of['confirmedJobMarkers','preparedNaturalPresentation','sceneResources','structureSignature','storageSignature','homeSignature','pileChunks'])Reflect.set(f.core,name,new Map());Object.assign(f.core,{furniturePresentation:{clear:vi.fn()},staticMaterial:f.plain,texturedStaticMaterial:f.textured,staticPaint:f.paint,hostPort:{now:()=>1000,hidden:()=>false,selectionReady:()=>false,disposeSelection:vi.fn(),disconnectResize:vi.fn(),removeInputListeners:vi.fn(),disposeLabels:vi.fn(),removeSurface:vi.fn()}});
 const closing=call<Promise<void>>(f.core,'disposeAsync');
 try{expect(Reflect.get(f.core,'closingPresentation')).toBe(true);expect(disposed).not.toHaveBeenCalled();expect(f.renderer.dispose).not.toHaveBeenCalled();gate.resolve();await job.catch(()=>{});await(Reflect.get(f.core,'disposeAfterPreparation')as Promise<void>);expect(disposed).toHaveBeenCalledOnce();expect(f.applied).not.toHaveBeenCalled();expect(f.banks[0]!.disposed).toHaveBeenCalledOnce();expect(f.renderer.dispose).toHaveBeenCalledOnce();f.rendererDone.resolve();await closing;}
 finally{gate.resolve();f.rendererDone.resolve();await closing.catch(()=>{});await f.dispose();}
},60000);
