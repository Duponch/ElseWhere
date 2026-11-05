/** Real Core transaction/admission/disposal methods on a narrow orchestration
 * fixture. No constructor, Native owner, Canvas, device or rendered pixels.
 * The legacy256 packets here are deliberately NOT current301 Native input. */
import {afterEach,expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {SharedSurfacePreparationRegistry} from '../src/render/surfaces/SharedSurfacePreparation';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {PresentationQueue} from '../src/render/PresentationQueue';
import {fixedTreePaintKey} from '../src/render/surfaces/FixedTreeTextureSurface';
import type {GraphicsStyleContext} from '../src/render/graphics-style';
import {TreeAtlasAdmissionRefusal} from '../src/render/origami/baked/trees/admission';
import {TreeBakeOwner,type OwnedTreeCatalog} from '../src/render/origami/TreeBakeOwner';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,type GraphicsStylePreferences} from '../src/ui3d/native-preferences';
import type {World} from '../src/sim/types';
import type {PawnTrack} from '../src/bridge/motion-tracks';

afterEach(()=>{vi.restoreAllMocks();vi.clearAllTimers();});
function deferred(){let resolve!:()=>void,reject!:(error:unknown)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function call<T=void>(target:object,name:string,...args:unknown[]):T{const method:unknown=Reflect.get(target,name);if(typeof method!=='function')throw Error('Missing Source Core method '+name);return Reflect.apply(method,target,args) as T;}
function field<T>(target:object,name:string):T{return Reflect.get(target,name) as T;}
const packet=(tick:number)=>({schemaVersion:256,tick,seed:917,width:16,height:16,resources:[],pawns:[],structures:[],jobs:[],piles:[]} as unknown as World);
function fixture(){
 const events:string[]=[],gate=deferred(),rendererDone=deferred(),texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),initial={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,impasto:0,wear:0},received={world:packet(10),speed:1,immutableSnapshot:false};
 const surfacePreparation=new SharedSurfacePreparationRegistry();const graphics={surfacePreparation,preparedPaintRevision:0,preferences:initial as GraphicsStylePreferences,get origami(){return this.preferences.style==='origami';},get reliefEnabled(){return this.preferences.impasto>0;},get wearEnabled(){return this.preferences.wear>0;},update:vi.fn((next:GraphicsStylePreferences)=>{events.push('preferences:'+next.style);graphics.preferences=next;surfacePreparation.invalidate();}),prepareSharedSurfaceAssets:vi.fn(()=>{events.push('assets');return[texture];}),prepareAtlasPaint:vi.fn(()=>({fingerprint:'orchestration-only',paint:{},isCurrent:()=>true,assertCurrent:()=>{}})),dispose:vi.fn(()=>{surfacePreparation.dispose();events.push('paint-dispose');})};
 const renderer={getPixelRatio:()=>1,initTexture:vi.fn((map:THREE.Texture)=>{expect(map).toBe(texture);events.push('upload');}),compileAsync:vi.fn(async()=>{}),setAnimationLoop:vi.fn(),dispose:vi.fn(()=>{events.push('renderer-dispose');return rendererDone.promise;})},timeline=new MotionTimeline(),adopt=vi.spyOn(timeline,'adopt'),applied=vi.fn((world:World,reset:boolean)=>{events.push('apply:'+world.tick+':'+reset);Reflect.set(core,'world',world);}),admit=vi.fn((world:World)=>({world}));
 const core:object=Object.assign(Object.create(SceneRenderCore.prototype),{disposed:false,closingPresentation:false,fatalError:undefined,preparing:false,holdSurfaceWorld:false,sharedSurfaceEpoch:0,backend:'WebGL2',texturesEnabled:true,graphicsStyle:graphics,renderer,rendererLifetime:{closed:false},
  captureGraphicsView:()=>({mode:'orthographic',position:[3,4,5],target:[0,0,0],zoom:1}),graphicsMeasurement:undefined,cancelGraphicsMeasurement:vi.fn(),invalidatePausedShadow:vi.fn(),updateSelectedObject:vi.fn(),updateHover:vi.fn(),keys:new Set(),onFatalError:vi.fn(),
  hostPort:{now:()=>1000,hidden:()=>false,selectionReady:()=>false},received,world:received.world,timeline,hasTracks:false,immutableWorlds:new WeakSet(),coreFullInputs297:new WeakMap(),pendingCore297:[],appliedCore297:-Infinity,presentation:new PresentationQueue(),releaseCalmFullFrame297:vi.fn(),
  confirmedIntentReader:{admit,clear:vi.fn()},confirmedJobMarkers:{clear:vi.fn()},projectiles:{adopt:vi.fn(),adoptPhase297:vi.fn()},applyWorldWithinSurfaceReads:applied,
  resources:{beginFixedWorldApplication:vi.fn(),abortFixedWorldApplication:vi.fn(),completeFixedWorld:vi.fn(),assertFixedTreeDrawReady:vi.fn(),treeBakeDemand:()=>({models:[],species:[],key:'empty',isCurrent:()=>true})},plants:{group:new THREE.Group(),hasPendingAtlasResources:()=>false,prepareAtlasResources:()=>undefined},environmentLighting:{configure:vi.fn(),dispose:vi.fn()},rig:{mode:'orthographic',pixelsPerCell:()=>32,orthographic:new THREE.OrthographicCamera(),perspective:new THREE.PerspectiveCamera(),dispose:vi.fn()},scene:new THREE.Scene(),
  preparePresentationResources:vi.fn(async()=>{events.push('compile');expect(field(core,'preparing')).toBe(true);await gate.promise;})});
 return{core,events,gate,rendererDone,texture,graphics,renderer,timeline,adopt,applied,admit,received,compile:field<ReturnType<typeof vi.fn>>(core,'preparePresentationResources')};
}
function begin(f:ReturnType<typeof fixture>,patch:Partial<GraphicsStylePreferences>={style:'origami'}){return call<Promise<void>>(f.core,'setGraphicsStyleParameters',{...f.graphics.preferences,...patch});}

test('same-renderer image preparation holds every World application but continues ordered admissions/timeline and resumes only the latest with OR(reset)',async()=>{
 const f=fixture(),renderer=f.renderer,job=begin(f),tracks:PawnTrack[]=[];
 try{
  expect(field(f.core,'preparing')).toBe(true);expect(field(f.core,'holdSurfaceWorld')).toBe(true);await vi.waitFor(()=>expect(f.compile).toHaveBeenCalledOnce(),{interval:1,timeout:1000});
  const inputs=[packet(11),packet(12),packet(13)],before=JSON.stringify(inputs);
  for(const[i,world]of inputs.entries())call(f.core,'setWorld',world,i===1,1,tracks,false);
  expect(f.admit.mock.calls.map(c=>c[0])).toEqual(inputs);expect(f.adopt).toHaveBeenCalledTimes(3);expect(f.applied).not.toHaveBeenCalled();expect(field<{world:World;reset:boolean}>(f.core,'pendingSurfaceWorld')).toEqual({world:inputs[2],reset:true});expect(JSON.stringify(inputs)).toBe(before);
  f.gate.resolve();await job;
  expect(f.applied).toHaveBeenCalledExactlyOnceWith(inputs[2],true);expect(field(f.core,'renderer')).toBe(renderer);expect(renderer.dispose).not.toHaveBeenCalled();expect(field(f.core,'preparing')).toBe(false);expect(field(f.core,'sharedSurfacePreparation')).toBeUndefined();expect(f.graphics.preferences.style).toBe('origami');expect(f.graphics.prepareSharedSurfaceAssets).toHaveBeenCalledTimes(3);expect(f.renderer.initTexture).toHaveBeenCalledTimes(3);expect(f.graphics.surfacePreparation.dirty).toBe(false);
  expect(f.events.indexOf('compile')).toBeLessThan(f.events.indexOf('apply:13:true'));expect(f.events.at(-1)).toBe('upload');
 }finally{f.gate.resolve();await job.catch(()=>{});f.texture.dispose();}
});

test('a failed candidate prepares the previous preference on the same renderer before releasing the latest received World',async()=>{
 const f=fixture(),old={...f.graphics.preferences};f.compile.mockImplementationOnce(async()=>{await f.gate.promise;throw Error('TEST candidate compile failed');}).mockImplementationOnce(async()=>{f.events.push('rollback-compiled');});const job=begin(f),handled=job.catch(error=>error),world=packet(15);
 try{
  call(f.core,'applyWorld',world,false);f.gate.resolve();const error=await handled;
  expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe('TEST candidate compile failed');expect(f.graphics.preferences).toEqual(old);expect(f.compile).toHaveBeenCalledTimes(2);expect(f.applied).toHaveBeenCalledExactlyOnceWith(world,false);expect(f.events.indexOf('rollback-compiled')).toBeLessThan(f.events.indexOf('apply:15:false'));expect(field(f.core,'fatalError')).toBeUndefined();expect(f.renderer.dispose).not.toHaveBeenCalled();expect(field(f.core,'preparing')).toBe(false);
 }finally{f.gate.resolve();await handled;f.texture.dispose();}
});

test('rollback failure stops rendering and never applies held Worlds as if the candidate had succeeded',async()=>{
 const f=fixture();f.compile.mockRejectedValue(Error('TEST compiler unavailable'));const error=await begin(f).catch(error=>error);
 try{expect(error).toBeInstanceOf(AggregateError);expect(field<string>(f.core,'fatalError')).toContain('retour aux textures');expect(field<ReturnType<typeof vi.fn>>(f.core,'onFatalError')).toHaveBeenCalledOnce();expect(f.renderer.setAnimationLoop).toHaveBeenCalledWith(null);expect(f.applied).not.toHaveBeenCalled();expect(f.renderer.dispose).not.toHaveBeenCalled();expect(field(f.core,'preparing')).toBe(false);}finally{f.texture.dispose();}
});

function teardownPorts(f:ReturnType<typeof fixture>){
 const names=['areaPreview','turretRange','recreationHints','orderRockPreview','constructionPreview','geysers','boxes','snowSurface','roofs','timber','hygiene','actionFeedback','actionVfx','brawlCloud','structureVfx','podRescue','orbitalDelivery','startingArrival','overview','deepResources','rocks','crops','plants','surfaceTint','resources','pawns','doors','projectiles','fires','wind','animalCargo','wildlife','mechanoids','ropes','designations','staticMaterial','terrainPlainMaterial','terrainPaintMaterial','terrainPaintTexture','terrainPaintStaging','texturedStaticMaterial','staticPaint','waterMaterial','paintedWater','clouds','precipitation'];
 for(const name of names)Reflect.set(f.core,name,{dispose:vi.fn()});Reflect.set(Reflect.get(f.core,'rocks'),'rockFinalRequiresAsyncClose',()=>false);
 for(const name of ['terrainGroup','resourceGroup','structureGroup','jobGroup','storageGroup','pileGroup'])Reflect.set(f.core,name,new THREE.Group());
 for(const name of ['confirmedJobMarkers','preparedNaturalPresentation','sceneResources','structureSignature','storageSignature','homeSignature','pileChunks'])Reflect.set(f.core,name,new Map());
 Object.assign(f.core,{furniturePresentation:{clear:vi.fn()},resources:{dispose:vi.fn(),attachPreparedResourceGpuRetirement:vi.fn(),treeBakeDemand:()=>({models:[],species:[],key:'empty',isCurrent:()=>true})},hostPort:{now:()=>1000,hidden:()=>false,selectionReady:()=>false,disposeSelection:vi.fn(),disconnectResize:vi.fn(),removeInputListeners:vi.fn(),disposeLabels:vi.fn(),removeSurface:vi.fn()}});
}
test('real disposeAsync waits for an active texture transaction before detaching producers and then awaits the same renderer teardown',async()=>{
 const f=fixture(),job=begin(f),rejection=job.catch(error=>error);teardownPorts(f);let closed=false;const closing=call<Promise<void>>(f.core,'disposeAsync').then(()=>{closed=true;});
 try{
  expect(field(f.core,'closingPresentation')).toBe(true);expect(f.graphics.dispose).not.toHaveBeenCalled();expect(f.renderer.dispose).not.toHaveBeenCalled();expect(closed).toBe(false);
  f.gate.resolve();await rejection;await field<Promise<void>>(f.core,'disposeAfterPreparation');
  expect(f.graphics.dispose).toHaveBeenCalledOnce();expect(f.renderer.dispose).toHaveBeenCalledOnce();expect(closed).toBe(false);expect(field(f.core,'disposed')).toBe(true);f.rendererDone.resolve();await closing;expect(closed).toBe(true);
 }finally{f.gate.resolve();f.rendererDone.resolve();await closing;f.texture.dispose();}
});

function treePorts(f:ReturnType<typeof fixture>,retirementFails=false){
 const oldDisposed=vi.fn(()=>{if(retirementFails)throw Error('TEST old texture retirement failed');}),newDisposed=vi.fn(),old={paintKey:fixedTreePaintKey(f.graphics as unknown as GraphicsStyleContext),revision:1,modelKeys:['actual-model-label'],demandKey:'one-model',assertCurrent:()=>{},dispose:oldDisposed} as unknown as OwnedTreeCatalog,candidate={paintKey:fixedTreePaintKey(f.graphics as unknown as GraphicsStyleContext),revision:2,modelKeys:['actual-model-label'],demandKey:'one-model',assertCurrent:()=>{},dispose:newDisposed} as unknown as OwnedTreeCatalog,owner=new TreeBakeOwner({cpuBytes:128*1024*1024,gpuBytes:512*1024*1024});owner.adopt(old);
 let active:OwnedTreeCatalog|undefined=old;const demand={models:[{key:'actual-model-label'}],species:['poplar'],key:'one-model',isCurrent:()=>true},publication=(value:OwnedTreeCatalog|undefined)=>{const previous=active;active=value;let committed=false;return{commit:()=>{committed=true;},rollback:()=>{if(!committed)active=previous;}};},stageDisposed=vi.fn(),resources={beginFixedWorldApplication:vi.fn(),abortFixedWorldApplication:vi.fn(),completeFixedWorld:vi.fn(),assertFixedTreeDrawReady:vi.fn(),treeBakeDemand:()=>demand,prepareTreeAssetCatalog:vi.fn((value:OwnedTreeCatalog)=>({warmup:[],publish:()=>publication(value),dispose:stageDisposed})),setTreeAssetCatalog:vi.fn((value:OwnedTreeCatalog|undefined)=>publication(value)),setTreeDirectFallback:vi.fn((_reason:string)=>publication(undefined))};
 Object.assign(f.core,{backend:'WebGPU',bakedTreeOwner:owner,resources});const prepare=vi.spyOn(owner,'prepare').mockImplementation(async(_renderer,_graphics,_demand,_paint,assert,force)=>{expect(force).toBe(true);assert();Object.assign(candidate,{paintKey:fixedTreePaintKey(f.graphics as unknown as GraphicsStyleContext)});return candidate;});return{old,candidate,owner,oldDisposed,newDisposed,stageDisposed,resources,prepare,active:()=>active};
}
test('tree image staging retains the old owner across both projection compiles and rolls back before freeing an uncommitted candidate',async()=>{
 const f=fixture(),tree=treePorts(f);f.compile.mockImplementationOnce(async()=>{expect(tree.active()).toBe(tree.candidate);expect(tree.oldDisposed).not.toHaveBeenCalled();await f.gate.promise;throw Error('TEST scene compile failed');}).mockResolvedValueOnce(undefined);const job=begin(f,{style:'origami',edgeWidth:2}),handled=job.catch(error=>error);
 try{await vi.waitFor(()=>expect(f.compile).toHaveBeenCalledOnce(),{interval:1,timeout:1000});expect(f.renderer.compileAsync).toHaveBeenCalledTimes(2);expect(tree.oldDisposed).not.toHaveBeenCalled();f.gate.resolve();const error=await handled;expect((error as Error).message).toBe('TEST scene compile failed');expect(tree.active()).toBe(tree.old);expect(tree.oldDisposed).not.toHaveBeenCalled();expect(tree.newDisposed).toHaveBeenCalledOnce();expect(tree.stageDisposed).toHaveBeenCalledOnce();expect(field(f.core,'fatalError')).toBeUndefined();}finally{f.gate.resolve();await handled;tree.owner.dispose();f.texture.dispose();}
});

test('a retirement failure after committed tree ownership is quarantined and cannot masquerade as a successful rollback',async()=>{
 const f=fixture(),tree=treePorts(f,true);f.compile.mockResolvedValue(undefined);const error=await begin(f,{style:'origami',edgeWidth:2}).catch(error=>error);
 try{expect(error).toBeInstanceOf(AggregateError);expect(field<string>(f.core,'fatalError')).toContain('retour aux textures');expect(tree.active()).toBe(tree.candidate);expect(tree.oldDisposed).toHaveBeenCalledOnce();expect(tree.newDisposed).not.toHaveBeenCalled();expect(field<Set<OwnedTreeCatalog>>(f.core,'quarantinedTreeCatalogs').has(tree.old)).toBe(true);expect(f.renderer.setAnimationLoop).toHaveBeenCalledWith(null);}finally{tree.owner.dispose();f.texture.dispose();}
});

test.each([false,true])('an empty tree cohort invalidates the previous paint generation only after successful compilation (rollback=%s)',async fail=>{
 const f=fixture(),tree=treePorts(f);tree.resources.treeBakeDemand=()=>({models:[],species:[],key:'empty',isCurrent:()=>true});
 f.compile.mockImplementationOnce(async()=>{expect(tree.active()).toBeUndefined();expect(tree.oldDisposed).not.toHaveBeenCalled();await f.gate.promise;if(fail)throw Error('TEST empty cohort compile failed');}).mockResolvedValueOnce(undefined);
 const job=begin(f,{style:'origami',edgeWidth:2}),handled=job.catch(error=>error);
 try{
  await vi.waitFor(()=>expect(f.compile).toHaveBeenCalledOnce(),{interval:1,timeout:1000});
  expect(tree.prepare).not.toHaveBeenCalled();expect(tree.resources.setTreeDirectFallback).toHaveBeenCalledExactlyOnceWith('paint-generation-direct-fallback');expect(tree.oldDisposed).not.toHaveBeenCalled();
  f.gate.resolve();const result=await handled;
  if(fail){expect(result).toBeInstanceOf(Error);expect(tree.active()).toBe(tree.old);expect(tree.oldDisposed).not.toHaveBeenCalled();expect(tree.owner.snapshot().models).toBe(1);}
  else{expect(result).toBeUndefined();expect(tree.active()).toBeUndefined();expect(tree.oldDisposed).toHaveBeenCalledOnce();expect(tree.owner.snapshot().models).toBe(0);}
  expect(f.renderer.dispose).not.toHaveBeenCalled();expect(field(f.core,'fatalError')).toBeUndefined();expect(field(f.core,'preparing')).toBe(false);
 }finally{f.gate.resolve();await handled;tree.owner.dispose();f.texture.dispose();}
});

test('style-only Pastel/Gouache/Pastel/Gouache retains the same prepared owner/images and actual scene objects without another tree bake',async()=>{
 const f=fixture(),tree=treePorts(f),scene=field<THREE.Scene>(f.core,'scene'),geometry=new THREE.BoxGeometry(),material=new THREE.MeshLambertNodeMaterial(),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);f.compile.mockResolvedValue(undefined);
 try{
  for(const style of ['origami','default','origami'] as const){await begin(f,{style});expect(tree.active()).toBe(tree.old);expect(tree.owner.snapshot().models).toBe(1);expect(tree.oldDisposed).not.toHaveBeenCalled();expect(f.graphics.preferences.style).toBe(style);expect(scene.children).toEqual([mesh]);expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect(field(f.core,'renderer')).toBe(f.renderer);}
  expect(tree.prepare).not.toHaveBeenCalled();expect(tree.resources.prepareTreeAssetCatalog).toHaveBeenCalledTimes(2);expect(tree.resources.setTreeAssetCatalog).not.toHaveBeenCalled();expect(f.compile.mock.calls.map(args=>args[0])).toEqual([true,true,true]);expect(f.renderer.dispose).not.toHaveBeenCalled();
 }finally{tree.owner.dispose();geometry.dispose();material.dispose();f.texture.dispose();}
});

test('each of the seven real paint changes invalidates old images, using the direct surface when a new atlas is refused or optional effects require their full graph',async()=>{
 vi.spyOn(console,'warn').mockImplementation(()=>{});
 for(const[key,value]of [['impasto',.2],['wear',.2],['edges',.35],['blackEdges',.4],['edgeWidth',2.3],['strokeImperfection',.3],['contourImperfection',.2]] as const){
  const f=fixture(),tree=treePorts(f);tree.prepare.mockRejectedValue(new TreeAtlasAdmissionRefusal('TEST bounded atlas reservation refused'));f.compile.mockResolvedValue(undefined);
  try{
   await begin(f,{style:'origami',[key]:value});expect(f.graphics.preferences[key],key).toBe(value);expect(tree.active(),key).toBeUndefined();const featureBoundary=key==='impasto'||key==='wear';if(featureBoundary)expect(tree.oldDisposed,key).toHaveBeenCalledOnce();else expect(tree.oldDisposed,key).not.toHaveBeenCalled();expect(tree.resources.setTreeDirectFallback,key).toHaveBeenCalledOnce();expect(tree.owner.snapshot().models,key).toBe(featureBoundary?0:1);expect(field(f.core,'fatalError'),key).toBeUndefined();expect(f.renderer.dispose,key).not.toHaveBeenCalled();
   expect(f.compile).toHaveBeenCalledExactlyOnceWith(!featureBoundary,false);if(featureBoundary)expect(tree.prepare,key).not.toHaveBeenCalled();else{expect(tree.prepare,key).toHaveBeenCalledOnce();expect(tree.prepare.mock.calls[0]![5],key).toBe(true);}
  }finally{tree.owner.dispose();f.texture.dispose();}
 }
});

test('the real data-only preparation uploads and compiles both cameras without rendering Room/shadow frames or touching producer geometry helpers',async()=>{
 const f=fixture(),scene=field<THREE.Scene>(f.core,'scene'),rig=field<{orthographic:THREE.Camera;perspective:THREE.Camera}>(f.core,'rig'),render=vi.fn(()=>{throw Error('Data-only preparation must not render');});Reflect.set(f.renderer,'render',render);Reflect.set(f.core,'preparing',true);Reflect.set(f.core,'holdSurfaceWorld',true);
 for(const name of ['room','diorama','pawns','resources','rocks','overview','landscape','daylight','staticSceneCompiler435','ownedOpaqueRevisions435','boxes'])Object.defineProperty(f.core,name,{get(){throw Error('Data-only preparation must not access '+name);},configurable:true});
 try{
  const source:unknown=Reflect.get(SceneRenderCore.prototype,'preparePresentationResources');if(typeof source!=='function')throw Error('Real preparation method absent');await Reflect.apply(source,f.core,[true]);
  expect(f.renderer.compileAsync.mock.calls).toEqual([[scene,rig.orthographic],[scene,rig.perspective]]);expect(f.graphics.prepareSharedSurfaceAssets).toHaveBeenCalledOnce();expect(f.renderer.initTexture).toHaveBeenCalledExactlyOnceWith(f.texture);expect(render).not.toHaveBeenCalled();expect(field(f.core,'preparing')).toBe(true);expect(field(f.core,'holdSurfaceWorld')).toBe(true);
 }finally{f.texture.dispose();}
});


test('failed CPU rollback quarantines the still-published candidate instead of retiring a possibly bound image',async()=>{
 const f=fixture(),tree=treePorts(f),failure=new Error('TEST publication rollback failed');tree.resources.prepareTreeAssetCatalog.mockImplementation(()=>({warmup:[],publish:()=>({commit:()=>{},rollback:()=>{throw failure;}}),dispose:tree.stageDisposed}));f.compile.mockRejectedValue(Error('TEST program failed'));
 try{const error=await begin(f,{style:'origami',edgeWidth:2}).catch(error=>error);expect(error).toBeInstanceOf(AggregateError);expect(tree.newDisposed).not.toHaveBeenCalled();expect(tree.oldDisposed).not.toHaveBeenCalled();expect(field<Set<OwnedTreeCatalog>>(f.core,'quarantinedTreeCatalogs').has(tree.candidate)).toBe(true);expect(field<string>(f.core,'fatalError')).toBeDefined();expect(f.renderer.setAnimationLoop).toHaveBeenCalledWith(null);}
 finally{tree.owner.dispose();tree.candidate.dispose();f.texture.dispose();}
});
