/** PARTIAL orchestration fixture: real SceneRenderCore methods on its prototype,
 * without its constructor, World, renderer/device, raster or scene submission.
 * Wildlife compilation and terminal subsystem disposal are observed ports.
 * These contracts establish async ordering only, never Whole/GPU correctness. */
import {afterEach,expect,test,vi} from 'vitest';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
import {Group,Scene,OrthographicCamera,PerspectiveCamera,MeshLambertNodeMaterial,MeshStandardNodeMaterial,RenderTarget} from 'three/webgpu';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {compileLegacyTreeRecipe,createReadyTreeRecipe} from '../src/render/origami/baked/trees/recipe';
import type {TreeSpecies} from '../src/render/origami/baked/trees/types';
import type {Resource} from '../src/sim/types';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import type {WildlifeBakedPreparation} from '../src/render/WildlifeLayer';
import {AtlasBuildQuarantineError} from '../src/render/origami/baked/atlas-cache';
import {TreeBakeOwner,type OwnedTreeCatalog} from '../src/render/origami/TreeBakeOwner';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,type GraphicsStylePreferences} from '../src/ui3d/native-preferences';

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
function deferred(){let resolve!:()=>void,reject!:(error:unknown)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function call<T=void>(core:object,key:string,...args:unknown[]):T{
  const fn:unknown=Reflect.get(core,key);if(typeof fn!=='function')throw Error('Missing real scene method '+key);return Reflect.apply(fn,core,args) as T;
}
function field<T>(core:object,key:string):T{return Reflect.get(core,key) as T;}
function fixture(){
  vi.useFakeTimers();vi.spyOn(console,'warn').mockImplementation(()=>{});
  let pending=true;
  const events:string[]=[],runs:{options:WildlifeBakedPreparation;wait:ReturnType<typeof deferred>}[]=[],received={speed:0};
  const graphics={origami:true,reliefEnabled:false,wearEnabled:false,preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0} as GraphicsStylePreferences,
    update:vi.fn((next:GraphicsStylePreferences)=>{events.push('settings-update');graphics.preferences=next;}),
    prepareAtlasPaint:vi.fn(()=>({fingerprint:'TEST-borrowed-paint-generation',isCurrent:():boolean=>true,assertCurrent:()=>{},paint:{}})),dispose:vi.fn(()=>events.push('paint-dispose'))};
  const wildlife={get hasPendingBakedSpecies(){return pending;},
    invalidateBakedSpecies:vi.fn(()=>{events.push('invalidate');pending=true;}),
    prepareBakedSpecies:vi.fn(async(options:WildlifeBakedPreparation)=>{
      const wait=deferred();runs.push({options,wait});await wait.promise;
      if(options.isCurrent())pending=false;
      return{prepared:[],retained:[],fallback:[]};
    }),dispose:vi.fn(()=>events.push('wildlife-dispose'))};
  const library={evictUnused:vi.fn(),dispose:vi.fn(()=>events.push('library-dispose'))},rendererDone=deferred();
  const renderer={compileAsync:vi.fn(()=>{throw Error('No GPU compiler admitted by this fixture');}),setAnimationLoop:vi.fn(),dispose:vi.fn(()=>{events.push('renderer-dispose');return rendererDone.promise;})};
  // No field initializer or constructor runs. In particular received contains
  // only the actual speed gate; no forged World is supplied to any method.
  const core:object=Object.assign(Object.create(SceneRenderCore.prototype),{
    disposed:false,fatalError:undefined,closingPresentation:false,bakedAnimalEpoch:0,preparing:false,lastFrame:123,
    backend:'WebGPU',texturesEnabled:true,received,graphicsStyle:graphics,wildlife,bakedAnimalLibrary:library,renderer,
    resources:{treeBakeDemand:()=>({key:'',species:[],isCurrent:()=>true}),bakedTreeStatus:()=>({ready:[]})},
    environmentLighting:{adoptConfiguredClone:vi.fn(()=>true),dispose:vi.fn()},invalidatePausedShadow:vi.fn(),
    cancelGraphicsMeasurement:vi.fn(),keys:new Set<string>(),onFatalError:vi.fn(),hostPort:{selectionReady:()=>false},
  });
  return{core,events,runs,received,graphics,wildlife,library,renderer,rendererDone};
}
/** Narrow no-device terminal ports permit the REAL dispose traversal. There
 * are no substitute implementations of prepare, queue, reportFailure,
 * dispose or disposeAsync; their guards and await chains execute unchanged. */
function addTeardownPorts(f:ReturnType<typeof fixture>):void{
  const disposableNames=['areaPreview','turretRange','recreationHints','orderRockPreview','constructionPreview','geysers','boxes','snowSurface','roofs','timber','hygiene','actionFeedback','actionVfx','brawlCloud','structureVfx','podRescue','orbitalDelivery','startingArrival','overview','deepResources','rocks','crops','plants','surfaceTint','resources','pawns','doors','projectiles','fires','wind','animalCargo','mechanoids','ropes','designations','staticMaterial','terrainPlainMaterial','terrainPaintMaterial','terrainPaintTexture','terrainPaintStaging','texturedStaticMaterial','staticPaint','waterMaterial','paintedWater','clouds','precipitation'];
  for(const name of disposableNames)Reflect.set(f.core,name,{dispose:vi.fn()});
  Reflect.set(f.core,'resources',{dispose:vi.fn(),treeBakeDemand:()=>({key:'',species:[],isCurrent:()=>true})});
  for(const name of ['terrainGroup','resourceGroup','structureGroup','jobGroup','storageGroup','pileGroup'])Reflect.set(f.core,name,new Group());
  for(const name of ['confirmedJobMarkers','preparedNaturalPresentation','sceneResources','structureSignature','storageSignature','homeSignature','pileChunks'])Reflect.set(f.core,name,new Map());
  Object.assign(f.core,{releaseCalmFullFrame297:vi.fn(),presentation:{clear:vi.fn()},pendingCore297:[],furniturePresentation:{clear:vi.fn()},rendererLifetime:{closed:false},
    hostPort:{selectionReady:()=>false,disposeSelection:vi.fn(),disconnectResize:vi.fn(),removeInputListeners:vi.fn(),disposeLabels:vi.fn(),removeSurface:vi.fn()}});
}

test('pause-only preparation becomes stale when speed resumes and queues no new work before an actual pause',async()=>{
  const f=fixture();call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(99);expect(f.runs).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);expect(f.runs).toHaveLength(1);const first=f.runs[0]!;expect(first.options.isCurrent()).toBe(true);expect(field(f.core,'preparing')).toBe(true);
  f.received.speed=1;expect(first.options.isCurrent()).toBe(false);expect(()=>first.options.request('deer').assertPreparationCurrent?.()).toThrow(/superseded/);
  first.wait.resolve();await vi.advanceTimersByTimeAsync(0);expect(field(f.core,'preparing')).toBe(false);expect(f.library.evictUnused).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(1000);expect(f.runs).toHaveLength(1);
  f.received.speed=0;call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(99);expect(f.runs).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);expect(f.runs).toHaveLength(2);expect(f.runs[1]!.options.isCurrent()).toBe(true);
  f.runs[1]!.wait.resolve();await vi.advanceTimersByTimeAsync(0);expect(f.library.evictUnused).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);expect(f.renderer.compileAsync).not.toHaveBeenCalled();
});

test('trees and wildlife share one renderer lease; resuming during the tree await retires its unpublished candidate and never starts animals',async()=>{
  const f=fixture(),wait=deferred(),retire=vi.fn(),assertCatalog=vi.fn();
  const demand={key:'poplar',species:['poplar'] as const,isCurrent:()=>true};
  const resources={treeBakeDemand:()=>demand,prepareTreeAssetCatalog:vi.fn(()=>{throw Error('Stale tree publication forbidden');})};
  Reflect.set(f.core,'resources',resources);
  const prepare=vi.spyOn(TreeBakeOwner.prototype,'prepare').mockImplementation(async(_renderer,_graphics,_demand,_paint,assert)=>{
    assert();await wait.promise;
    // Deliberately return even when stale: Core must guard this boundary too.
    return{assertCurrent:assertCatalog,dispose:retire} as unknown as OwnedTreeCatalog;
  });
  call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(100);
  expect(prepare).toHaveBeenCalledTimes(1);expect(f.runs).toHaveLength(0);expect(field(f.core,'preparing')).toBe(true);
  call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(500);expect(prepare).toHaveBeenCalledTimes(1);
  f.received.speed=1;wait.resolve();await vi.advanceTimersByTimeAsync(0);
  expect(retire).toHaveBeenCalledTimes(1);expect(resources.prepareTreeAssetCatalog).not.toHaveBeenCalled();
  expect(f.runs).toHaveLength(0);expect(f.renderer.compileAsync).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  expect(field(f.core,'preparing')).toBe(false);expect(f.library.evictUnused).not.toHaveBeenCalled();
});

test('settings invalidate the live preparation before changing uniforms and retry only 100ms after the stale job settles',async()=>{
  const f=fixture();call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(100);const first=f.runs[0]!;
  f.graphics.update.mockImplementationOnce(next=>{expect(first.options.isCurrent()).toBe(false);expect(f.wildlife.invalidateBakedSpecies).toHaveBeenCalledTimes(1);f.events.push('settings-update');f.graphics.preferences=next;});
  const settings={...f.graphics.preferences,edgeWidth:2.3};call(f.core,'setGraphicsStyleParameters',settings);
  expect(f.events).toEqual(['invalidate','settings-update']);expect(first.options.isCurrent()).toBe(false);expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(300);expect(f.runs).toHaveLength(1);
  first.wait.resolve();await vi.advanceTimersByTimeAsync(0);expect(field(f.core,'preparing')).toBe(false);expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(99);expect(f.runs).toHaveLength(1);await vi.advanceTimersByTimeAsync(1);expect(f.runs).toHaveLength(2);
  expect(f.runs[1]!.options.request('deer').edgeWidth).toBe(2.3);expect(f.runs[1]!.options.isCurrent()).toBe(true);
  f.runs[1]!.wait.resolve();await vi.advanceTimersByTimeAsync(0);expect(f.library.evictUnused).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});

test('an independent borrowed paint epoch invalidates publication and retains pending work until the next paused preparation',async()=>{
  const f=fixture(),settings=f.graphics.preferences;
  // Run the REAL paint lending method and its validity/assertion closures.
  // Only its already-prepared one-pixel upload and flush/ensure terminal ports
  // are supplied here: no raster, Canvas, World or GPU is admitted.
  const paintOwner:object=Object.assign(Object.create(GraphicsStyleContext.prototype),{
    preferences:settings,reliefEnabled:false,atlasPaintEpoch:0,
    edgeMaps:{alpha:{image:{data:new Uint8Array([255]),width:1,height:1}}},
    flushPaint:vi.fn(),ensureEdgeMaps:vi.fn(),brushColor:{value:{r:.1,g:.1,b:.1}},
    lineOpacity:{value:.79},strokeImperfection:{value:.15},
  });
  f.graphics.prepareAtlasPaint.mockImplementation(()=>call<ReturnType<GraphicsStyleContext['prepareAtlasPaint']>>(paintOwner,'prepareAtlasPaint'));
  call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(100);
  const first=f.runs[0]!,paintResult=f.graphics.prepareAtlasPaint.mock.results[0]!;
  if(paintResult.type!=='return')throw Error('Paint lending did not return its real validity closures');
  const source=paintResult.value;
  expect(source.isCurrent()).toBe(true);expect(()=>source.assertCurrent()).not.toThrow();
  const firstFingerprint=first.options.request('deer').paintFingerprint;
  // A completed paint admission/flush can advance this owner epoch without
  // changing scene ownership, graphics preferences, alpha storage or speed.
  Reflect.set(paintOwner,'atlasPaintEpoch',1);
  expect(source.isCurrent()).toBe(false);expect(()=>source.assertCurrent()).toThrow(/paint changed/);
  expect(first.options.isCurrent()).toBe(false);
  expect(()=>first.options.request('deer').assertPreparationCurrent?.()).toThrow(/paint changed/);
  expect(f.graphics.preferences).toBe(settings);expect(f.received.speed).toBe(0);expect(field(f.core,'bakedAnimalEpoch')).toBe(0);
  first.wait.resolve();await vi.advanceTimersByTimeAsync(0);
  expect(f.wildlife.hasPendingBakedSpecies).toBe(true);expect(f.library.evictUnused).not.toHaveBeenCalled();
  expect(field(f.core,'preparing')).toBe(false);expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(99);expect(f.runs).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);expect(f.runs).toHaveLength(2);const second=f.runs[1]!;
  expect(second.options.isCurrent()).toBe(true);expect(second.options.request('deer').paintFingerprint).not.toBe(firstFingerprint);
  second.wait.resolve();await vi.advanceTimersByTimeAsync(0);
  expect(f.wildlife.hasPendingBakedSpecies).toBe(false);expect(f.library.evictUnused).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  expect(f.graphics.update).not.toHaveBeenCalled();expect(f.wildlife.invalidateBakedSpecies).not.toHaveBeenCalled();expect(f.renderer.compileAsync).not.toHaveBeenCalled();
});

test('uncertain rollback/quarantine reports failure without retry; real disposeAsync waits for preparation and then for renderer teardown',async()=>{
  for(const error of [new AggregateError([Error('TEST rollback unknown')],'TEST rollback failed'),new AtlasBuildQuarantineError(Error('TEST cleanup unknown'))]){
    const f=fixture();call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(100);f.runs[0]!.wait.reject(error);await vi.advanceTimersByTimeAsync(0);
    expect(field<string>(f.core,'fatalError')).toContain(error.message);expect(field<()=>void>(f.core,'onFatalError')).toHaveBeenCalledTimes(1);expect(f.renderer.setAnimationLoop).toHaveBeenCalledWith(null);
    expect(f.library.evictUnused).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(1000);expect(f.runs).toHaveLength(1);
  }
  const f=fixture();addTeardownPorts(f);call(f.core,'queuePausedBakedAnimals');await vi.advanceTimersByTimeAsync(100);const first=f.runs[0]!;
  let complete=false;const closing=call<Promise<void>>(f.core,'disposeAsync').then(()=>{complete=true;});
  expect(field(f.core,'closingPresentation')).toBe(true);expect(first.options.isCurrent()).toBe(false);expect(f.renderer.setAnimationLoop).toHaveBeenCalledWith(null);
  expect(f.wildlife.dispose).not.toHaveBeenCalled();expect(f.library.dispose).not.toHaveBeenCalled();expect(f.graphics.dispose).not.toHaveBeenCalled();expect(f.renderer.dispose).not.toHaveBeenCalled();expect(complete).toBe(false);
  first.wait.resolve();await vi.advanceTimersByTimeAsync(0);
  expect(f.events).toEqual(['wildlife-dispose','library-dispose','paint-dispose','renderer-dispose']);expect(f.renderer.dispose).toHaveBeenCalledTimes(1);expect(complete).toBe(false);
  f.rendererDone.resolve();await closing;expect(complete).toBe(true);expect(field(f.core,'disposed')).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

test('a real published tree catalog survives old-material retirement failure until Source and435 detach before its release',async()=>{
  // Same partial Core orchestration boundary as above, now with REAL Layer
  // publication/commit, actual recipe geometry and actual TreeBakeOwner.adopt/
  // dispose. Only the atlas pixels/prepare and GPU compile are metadata ports.
  const f=fixture();addTeardownPorts(f);
  const settings={impasto:0,wear:0,edges:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6},graphics=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',...settings}),environment=new EnvironmentLighting(),group=new Group(),plain=new MeshLambertNodeMaterial({vertexColors:true}),paint=new MeshStandardNodeMaterial();
  plain.userData.rendererOwned=paint.userData.rendererOwned=true;environment.configure(plain);environment.configure(paint);
  const resources=withGraphicsStyle(graphics,()=>new ResourceLayer(group,plain,paint)),record={width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},structures:[],resources:[{id:1001,kind:'tree',species:'poplar',x:8,z:8,amount:1,growth:1},{id:1002,kind:'tree',species:'oak',x:9,z:8,amount:1,growth:1}] as Resource[]};
  Reflect.apply(resources.update,resources,[record,true,undefined,undefined,{read:()=>({size:1,ripe:true,leafless:false}),harvestable:()=>false}]);
  const events:string[]=[],makeCatalog=(species:readonly TreeSpecies[],revision:number)=>{
    const recipes=species.map(s=>compileLegacyTreeRecipe(s,{paintGeneration:'TEST-lifetime-only',settings,pageSize:2048,maxCpuBytes:8*1024*1024})),ready=recipes.map((r,i)=>createReadyTreeRecipe(r,i,recipes.length)),bySpecies=new Map(ready.map(r=>[r.species,r])),target=new RenderTarget(1,1,{depth:species.length,depthBuffer:false});let retired=false,calls=0;
    const assertCurrent=()=>{if(retired)throw Error('TEST tree catalog retired');};
    const catalog:OwnedTreeCatalog={revision,texture:target.texture,pageCount:species.length,demandKey:JSON.stringify(species),cpuBytes:ready.reduce((n,r)=>n+r.cpuBytes,0),gpuBytes:species.length*4,peakGpuBytes:species.length*4,assertCurrent,readReady(s){assertCurrent();return bySpecies.get(s as TreeSpecies);},dispose(){if(retired)return;calls++;
      // Independent lifetime oracle: a published, undisposed producer can
      // still read this texture. Retiring it at Core's catch/finally is wrong.
      expect(Reflect.get(resources,'disposed')||Reflect.get(resources,'treeCatalog')!==catalog).toBe(true);
      retired=true;events.push(`release:${revision}`);for(const r of ready)r.dispose();for(const r of recipes)r.dispose();target.dispose();
    }};return{catalog,target,calls:()=>calls};
  },old=makeCatalog(['poplar'],1),candidate=makeCatalog(['oak','poplar'],2),owner=new TreeBakeOwner({cpuBytes:128*1024*1024,gpuBytes:512*1024*1024});
  const initial=resources.prepareTreeAssetCatalog(old.catalog,environment.configure),oldMaterial=initial.warmup[0]!.material as MeshLambertNodeMaterial;initial.publish().commit();initial.dispose();owner.adopt(old.catalog);
  oldMaterial.addEventListener('dispose',()=>{events.push('old-material-failure');throw Error('TEST old tree material retirement failed');});
  const renderer={...f.renderer,compileAsync:vi.fn(async()=>{})};
  Object.assign(f.core,{graphicsStyle:graphics,environmentLighting:environment,resources,bakedTreeOwner:owner,preparing:true,scene:new Scene(),rig:{orthographic:new OrthographicCamera(),perspective:new PerspectiveCamera(),dispose:vi.fn()},renderer,
    ownedOpaqueRevisions435:{invalidateResources:vi.fn(()=>events.push('invalidate435')),dispose:vi.fn(()=>events.push('revisions-detached'))},staticSceneCompiler435:{clear:vi.fn(()=>events.push('clear435')),dispose:vi.fn(()=>events.push('compiler-detached'))}});
  const originalDispose=resources.dispose.bind(resources);vi.spyOn(resources,'dispose').mockImplementation(()=>{originalDispose();events.push('source-detached');});
  const paintDispose=vi.spyOn(graphics,'dispose');candidate.target.addEventListener('dispose',()=>{throw Error('TEST retired candidate target cleanup failed');});
  vi.spyOn(owner,'prepare').mockResolvedValue(candidate.catalog);
  try{
    const paintLease=graphics.prepareAtlasPaint();await expect(call<Promise<void>>(f.core,'prepareBakedTreeResources',paintLease,()=>{})).rejects.toThrow('Tree publication ownership transfer failed');
    expect(events).toContain('old-material-failure');expect(resources.bakedTreeStatus()).toMatchObject({revision:2,ready:2,fallback:0});expect(()=>candidate.catalog.assertCurrent()).not.toThrow();expect(candidate.calls()).toBe(0);expect(old.calls()).toBe(0);expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
    expect(field<Set<OwnedTreeCatalog>>(f.core,'quarantinedTreeCatalogs').has(candidate.catalog)).toBe(true);
    Reflect.set(f.core,'preparing',false);let settled=false,closeError:unknown;const closing=call<Promise<void>>(f.core,'disposeAsync').then(()=>{settled=true;},error=>{settled=true;closeError=error;});
    expect(candidate.calls()).toBe(1);expect(old.calls()).toBe(1);const detached=events.indexOf('source-detached');expect(events.indexOf('compiler-detached')).toBeLessThan(detached);expect(detached).toBeLessThan(events.indexOf('release:1'));expect(detached).toBeLessThan(events.indexOf('release:2'));expect(settled).toBe(false);
    // A target's real dispose listener failed after Source detached. The
    // remaining actors/paint and asynchronous renderer must still be retired.
    expect(f.wildlife.dispose).toHaveBeenCalledTimes(1);expect(f.library.dispose).toHaveBeenCalledTimes(1);expect(paintDispose).toHaveBeenCalledTimes(1);expect(renderer.dispose).toHaveBeenCalledTimes(1);
    f.rendererDone.resolve();await closing;expect(settled).toBe(true);expect(closeError).toBeInstanceOf(AggregateError);expect((closeError as AggregateError).message).toBe('Detached tree owner cleanup failed');expect(field<Set<OwnedTreeCatalog>>(f.core,'quarantinedTreeCatalogs').has(candidate.catalog)).toBe(true);
  }finally{f.rendererDone.resolve();resources.dispose();owner.dispose();candidate.catalog.dispose();graphics.dispose();environment.dispose();plain.dispose();paint.dispose();}
});
