/** Real current texture-only TREE publication and quarantine lifecycle.
 * Five preceding historical animal-atlas queue contracts were archived with
 * SHA before retiring that product queue; they are superseded by the common
 * scene/gallery transaction contracts. This retained case still exercises real
 * ResourceLayer/TreeBakeOwner and Source435 detach order. Renderer/raster ports
 * remain explicit TEST metadata: no Native device, World or visual proof. */
import {afterEach,expect,test,vi} from 'vitest';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
import {Group,Scene,OrthographicCamera,PerspectiveCamera,Mesh,MeshLambertNodeMaterial,MeshStandardNodeMaterial,RenderTarget,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter} from 'three/webgpu';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {type TreeModel} from '../src/render/models/TreeModels';
import type {Resource} from '../src/sim/types';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {TreeBakeOwner,type OwnedTreeCatalog} from '../src/render/origami/TreeBakeOwner';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

afterEach(()=>{vi.restoreAllMocks();});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
function call<T=void>(core:object,key:string,...args:unknown[]):T{const fn:unknown=Reflect.get(core,key);if(typeof fn!=='function')throw Error('Missing real scene method '+key);return Reflect.apply(fn,core,args) as T;}
function field<T>(core:object,key:string):T{return Reflect.get(core,key) as T;}
function fixture(){
 const events:string[]=[],rendererDone=deferred(),wildlife={dispose:vi.fn(()=>events.push('wildlife-dispose'))},renderer={compileAsync:vi.fn(async()=>{}),setAnimationLoop:vi.fn(),dispose:vi.fn(()=>{events.push('renderer-dispose');return rendererDone.promise;})};
 const core:object=Object.assign(Object.create(SceneRenderCore.prototype),{disposed:false,fatalError:undefined,closingPresentation:false,sharedSurfaceEpoch:0,preparing:false,backend:'WebGPU',texturesEnabled:true,wildlife,renderer,environmentLighting:{dispose:vi.fn()},invalidatePausedShadow:vi.fn(),cancelGraphicsMeasurement:vi.fn(),keys:new Set<string>(),onFatalError:vi.fn()});
 return{core,events,wildlife,renderer,rendererDone};
}
function addTeardownPorts(f:ReturnType<typeof fixture>):void{
 const disposableNames=['areaPreview','turretRange','recreationHints','orderRockPreview','constructionPreview','geysers','boxes','snowSurface','roofs','timber','hygiene','actionFeedback','actionVfx','brawlCloud','structureVfx','podRescue','orbitalDelivery','startingArrival','overview','deepResources','rocks','crops','plants','surfaceTint','resources','pawns','doors','projectiles','fires','wind','animalCargo','mechanoids','ropes','designations','staticMaterial','terrainPlainMaterial','terrainPaintMaterial','terrainPaintTexture','terrainPaintStaging','texturedStaticMaterial','staticPaint','waterMaterial','paintedWater','clouds','precipitation'];
 for(const name of disposableNames)Reflect.set(f.core,name,{dispose:vi.fn()});
 for(const name of ['terrainGroup','resourceGroup','structureGroup','jobGroup','storageGroup','pileGroup'])Reflect.set(f.core,name,new Group());
 for(const name of ['confirmedJobMarkers','preparedNaturalPresentation','sceneResources','structureSignature','storageSignature','homeSignature','pileChunks'])Reflect.set(f.core,name,new Map());
 Object.assign(f.core,{releaseCalmFullFrame297:vi.fn(),presentation:{clear:vi.fn()},pendingCore297:[],furniturePresentation:{clear:vi.fn()},rendererLifetime:{closed:false},hostPort:{selectionReady:()=>false,disposeSelection:vi.fn(),disconnectResize:vi.fn(),removeInputListeners:vi.fn(),disposeLabels:vi.fn(),removeSurface:vi.fn()}});
}

test('a published texture-only tree catalog survives old-texture retirement failure until Source and435 detach before its release',async()=>{
  // REAL Layer publication and TreeBakeOwner.adopt/dispose; Layer owns the
  // actual shared models throughout. Only atlas preparation/pixels and GPU
  // compile are metadata ports. No recipe/ready geometry owner is fabricated.
  const f=fixture();addTeardownPorts(f);
  const settings={impasto:0,wear:0,edges:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6},graphics=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',...settings}),environment=new EnvironmentLighting(),group=new Group(),plain=new MeshLambertNodeMaterial({vertexColors:true}),paint=new MeshStandardNodeMaterial();
  plain.userData.rendererOwned=paint.userData.rendererOwned=true;environment.configure(plain);environment.configure(paint);
  const resources=withGraphicsStyle(graphics,()=>new ResourceLayer(group,plain,paint)),record={width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},structures:[],resources:[{id:1001,kind:'tree',species:'poplar',x:8,z:8,amount:1,growth:1}] as Resource[]};
  Reflect.apply(resources.update,resources,[record,true,undefined,undefined,{read:()=>({size:1,ripe:true,leafless:false}),harvestable:()=>false}]);
  const events:string[]=[],makeCatalog=(models:readonly TreeModel[],revision:number)=>{
    const target=new RenderTarget(2048,2048,{depth:2,depthBuffer:false,colorSpace:SRGBColorSpace,generateMipmaps:false,minFilter:LinearMipmapLinearFilter,magFilter:LinearFilter}),slots=Array.from({length:64},()=>({layer:0,paletteBaked:false}));for(let i=0;i<models.length;i++)slots[models[i]!.surfaceSlot]={layer:i,paletteBaked:true};let retired=false,calls=0;target.texture.flipY=false;target.texture.mipmaps=Array.from({length:4},(_,l)=>({data:new Uint8Array(0),width:2048/2**l,height:2048/2**l}));
    const assertCurrent=()=>{if(retired)throw Error('TEST tree catalog retired');};
    const catalog:OwnedTreeCatalog={revision,texture:target.texture,pageCount:2,modelKeys:models.map(model=>model.key),slots,demandKey:resources.treeBakeDemand().key,cpuBytes:16384,gpuBytes:2*2048**2*4*1.328125,peakGpuBytes:3*2048**2*4*1.328125,assertCurrent,dispose(){if(retired)return;calls++;
      // Independent lifetime oracle: a published, undisposed producer can
      // still read this texture. Retiring it at Core's catch/finally is wrong.
      expect(Reflect.get(resources,'disposed')||Reflect.get(resources,'treeCatalog')!==catalog).toBe(true);
      retired=true;events.push(`release:${revision}`);target.dispose();
    }};return{catalog,target,calls:()=>calls};
  },old=makeCatalog(resources.treeBakeDemand().models,1),owner=new TreeBakeOwner({cpuBytes:128*1024*1024,gpuBytes:512*1024*1024});
  const initial=resources.prepareTreeAssetCatalog(old.catalog,environment.configure);expect(initial.warmup).toHaveLength(2);initial.publish().commit();initial.dispose();owner.adopt(old.catalog);
  // Actual cohort growth requires a new texture bank, not a forced owner
  // retry. All following publication checks start AFTER this normal update.
  record.resources.push({id:1002,kind:'tree',species:'oak',x:9,z:8,amount:1,growth:1});Reflect.apply(resources.update,resources,[record,true,undefined,undefined,{read:()=>({size:1,ripe:true,leafless:false}),harvestable:()=>false}]);const candidate=makeCatalog(resources.treeBakeDemand().models,2),draws:Mesh[]=[];group.traverse(object=>{if(object instanceof Mesh)draws.push(object);});const drawState=draws.map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,index:mesh.geometry.index,attributes:Object.values(mesh.geometry.attributes).map(a=>a.array)})),materials=resources.compiledMaterials435();
  expect(owner.needsPreparation(resources.treeBakeDemand())).toBe(true);old.target.addEventListener('dispose',()=>{events.push('old-texture-failure');throw Error('TEST old tree texture retirement failed');});
  const renderer={...f.renderer,compileAsync:vi.fn(async()=>{})};
  Object.assign(f.core,{graphicsStyle:graphics,environmentLighting:environment,resources,bakedTreeOwner:owner,preparing:true,scene:new Scene(),rig:{orthographic:new OrthographicCamera(),perspective:new PerspectiveCamera(),dispose:vi.fn()},renderer,
    ownedOpaqueRevisions435:{invalidateResources:vi.fn(()=>events.push('invalidate435')),dispose:vi.fn(()=>events.push('revisions-detached'))},staticSceneCompiler435:{clear:vi.fn(()=>events.push('clear435')),dispose:vi.fn(()=>events.push('compiler-detached'))}});
  const originalDispose=resources.dispose.bind(resources);vi.spyOn(resources,'dispose').mockImplementation(()=>{originalDispose();events.push('source-detached');});
  const paintDispose=vi.spyOn(graphics,'dispose');candidate.target.addEventListener('dispose',()=>{throw Error('TEST retired candidate target cleanup failed');});
  vi.spyOn(owner,'prepare').mockResolvedValue(candidate.catalog);
  try{
    const paintLease=graphics.prepareAtlasPaint();await expect(call<Promise<void>>(f.core,'prepareBakedTreeResources',paintLease,()=>{})).rejects.toThrow('Tree publication ownership transfer failed');
    expect(events).toContain('old-texture-failure');expect(resources.bakedTreeStatus()).toMatchObject({revision:2,ready:2,fallback:0});expect(()=>candidate.catalog.assertCurrent()).not.toThrow();expect(candidate.calls()).toBe(0);expect(old.calls()).toBe(1);expect(owner.snapshot()).toMatchObject({models:2,ready:2});expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
    expect(resources.compiledMaterials435()).toEqual(materials);for(const before of drawState){expect(before.mesh.geometry).toBe(before.geometry);expect(before.mesh.material).toBe(before.material);expect(before.mesh.geometry.index).toBe(before.index);Object.values(before.mesh.geometry.attributes).forEach((a,i)=>expect(a.array).toBe(before.attributes[i]));}expect(field<{invalidateResources:()=>void}>(f.core,'ownedOpaqueRevisions435').invalidateResources).not.toHaveBeenCalled();
    expect(field<Set<OwnedTreeCatalog>>(f.core,'quarantinedTreeCatalogs').has(candidate.catalog)).toBe(true);
    Reflect.set(f.core,'preparing',false);let settled=false,closeError:unknown;const closing=call<Promise<void>>(f.core,'disposeAsync').then(()=>{settled=true;},error=>{settled=true;closeError=error;});
    expect(candidate.calls()).toBe(1);expect(old.calls()).toBe(1);const detached=events.indexOf('source-detached');expect(events.indexOf('compiler-detached')).toBeLessThan(detached);expect(events.indexOf('release:1')).toBeLessThan(detached);expect(detached).toBeLessThan(events.indexOf('release:2'));expect(settled).toBe(false);
    // A target's real dispose listener failed after Source detached. The
    // remaining actors/paint and asynchronous renderer must still be retired.
    expect(f.wildlife.dispose).toHaveBeenCalledTimes(1);expect(paintDispose).toHaveBeenCalledTimes(1);expect(renderer.dispose).toHaveBeenCalledTimes(1);
    f.rendererDone.resolve();await closing;expect(settled).toBe(true);expect(closeError).toBeInstanceOf(AggregateError);expect((closeError as AggregateError).message).toBe('Detached tree owner cleanup failed');expect(field<Set<OwnedTreeCatalog>>(f.core,'quarantinedTreeCatalogs').has(candidate.catalog)).toBe(true);
  }finally{f.rendererDone.resolve();resources.dispose();owner.dispose();candidate.catalog.dispose();graphics.dispose();environment.dispose();plain.dispose();paint.dispose();}
});
