/** Real gallery transaction and GraphicsStyleContext on existing scene owners.
 * Painting/upload/compile are controlled orchestration seams, not a Native,
 * rendered-image or performance proof. No gallery DOM or World is fabricated. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {changeCatalogSurface,stageCatalogSharedSurfaces} from '../src/dev/asset-catalog-surface';
import type {SharedSurfacePreparationSnapshot,SharedSurfacePreparationStage} from '../src/render/surfaces/SharedSurfacePreparation';
import type {CatalogCollection} from '../src/dev/asset-catalog-types';

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
function fixture(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),previous={...context.preferences},texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),geometry=new THREE.BoxGeometry(),material=new THREE.MeshLambertNodeMaterial(),mesh=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();scene.add(mesh);camera.position.set(3,4,5);camera.updateMatrixWorld();
 const renderer=new THREE.WebGPURenderer({canvas:{width:32,height:32,style:{}} as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Orchestration must not create a device');}),upload=vi.spyOn(renderer,'initTexture').mockImplementation(()=>{}),compile=vi.spyOn(renderer,'compileAsync').mockResolvedValue(undefined),assets=vi.spyOn(context,'prepareSharedSurfaceAssets').mockReturnValue([texture]),paint=vi.spyOn(context,'prepareAtlasPaint').mockImplementation(()=>{const preferences=JSON.stringify(context.preferences),revision=context.preparedPaintRevision;return{fingerprint:'TEST-orchestration-lease',isCurrent:()=>JSON.stringify(context.preferences)===preferences&&context.preparedPaintRevision===revision,assertCurrent:()=>{if(JSON.stringify(context.preferences)!==preferences||context.preparedPaintRevision!==revision)throw Error('TEST paint changed');},paint:{}} as ReturnType<GraphicsStyleContext['prepareAtlasPaint']>;}),contextDisposed=vi.spyOn(context,'dispose'),geometryDisposed=vi.spyOn(geometry,'dispose'),materialDisposed=vi.spyOn(material,'dispose'),gate=deferred();let valid=true;
 const collection:CatalogCollection={sections:[{id:'one-owner',label:'Existing collection',group:new THREE.Group(),items:[]}],invalidatePreparedTrees:vi.fn(),assertFixedTreeDrawReady:vi.fn(),prepareTrees:vi.fn(async()=>{await gate.promise;}),dispose:vi.fn()},collections=[collection],port={renderer,scene,camera,assertCurrent:()=>{if(!valid)throw Error('TEST gallery closed');}};
 camera.coordinateSystem=renderer.coordinateSystem;camera.updateProjectionMatrix();
 return{context,previous,texture,geometry,material,mesh,scene,camera,renderer,init,upload,compile,assets,contextDisposed,geometryDisposed,materialDisposed,gate,collection,collections,port,close:()=>{valid=false;},cleanup(){gate.resolve();init.mockRestore();upload.mockRestore();compile.mockRestore();assets.mockRestore();paint.mockRestore();contextDisposed.mockRestore();geometryDisposed.mockRestore();materialDisposed.mockRestore();context.dispose();geometry.dispose();material.dispose();texture.dispose();}};
}

test('gallery style changes preserve actual context, collections, scene owners, geometry/material and camera while preparing before compile',async()=>{
 const f=fixture(),children=[...f.scene.children],position=f.camera.position.toArray(),projection=f.camera.projectionMatrix.toArray(),job=changeCatalogSurface(f.context,{...f.previous,style:'origami'},f.collections,f.port);
 try{
  expect(f.compile).not.toHaveBeenCalled();expect(f.context.surfaceEncoding.value).toBe(1);expect(f.context.surfacePreparation.dirty).toBe(true);expect(f.collection.prepareTrees).toHaveBeenCalledExactlyOnceWith(f.renderer,f.camera,f.scene,expect.any(Function));
  f.gate.resolve();await job;expect(f.context.surfacePreparation.dirty).toBe(false);
  expect(f.compile).toHaveBeenCalledExactlyOnceWith(f.scene,f.camera);expect(f.assets).toHaveBeenCalledTimes(2);expect(f.upload).toHaveBeenCalledTimes(2);expect(f.scene.children).toEqual(children);expect(f.mesh.geometry).toBe(f.geometry);expect(f.mesh.material).toBe(f.material);expect(f.camera.position.toArray()).toEqual(position);expect(f.camera.projectionMatrix.toArray()).toEqual(projection);expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.contextDisposed).not.toHaveBeenCalled();expect(f.geometryDisposed).not.toHaveBeenCalled();expect(f.materialDisposed).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();
  await changeCatalogSurface(f.context,f.previous,f.collections,f.port);expect(f.context.surfaceEncoding.value).toBe(0);expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.scene.children).toEqual(children);expect(f.collection.invalidatePreparedTrees).not.toHaveBeenCalled();expect(f.collection.assertFixedTreeDrawReady).toHaveBeenCalledTimes(2);
 }finally{f.gate.resolve();await job.catch(()=>{});f.cleanup();}
});

test('failed gallery candidate prepares previous images and recompiles the same owners before rejecting',async()=>{
 const f=fixture();f.compile.mockRejectedValueOnce(Error('TEST candidate compile failed')).mockResolvedValueOnce(undefined);const job=changeCatalogSurface(f.context,{...f.previous,style:'origami',edgeWidth:2},f.collections,f.port),handled=job.catch(error=>error);
 try{
  f.gate.resolve();const error=await handled;expect((error as Error).message).toBe('TEST candidate compile failed');expect(f.context.preferences).toEqual(f.previous);expect(f.context.surfaceEncoding.value).toBe(0);expect(f.compile).toHaveBeenCalledTimes(2);expect(f.collection.invalidatePreparedTrees).not.toHaveBeenCalled();expect(f.collection.assertFixedTreeDrawReady).toHaveBeenCalledOnce();expect(f.assets).toHaveBeenCalledTimes(4);expect(f.upload).toHaveBeenCalledTimes(4);expect(f.scene.children).toEqual([f.mesh]);expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.contextDisposed).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();
 }finally{f.gate.resolve();await handled;f.cleanup();}
});

test('closing a held gallery never starts rollback compilation after its preparation has settled',async()=>{
 const f=fixture(),job=changeCatalogSurface(f.context,{...f.previous,style:'origami'},f.collections,f.port),handled=job.catch(error=>error);
 try{f.close();f.gate.resolve();const error=await handled;expect((error as Error).message).toBe('TEST gallery closed');expect(f.compile).not.toHaveBeenCalled();expect(f.collection.invalidatePreparedTrees).not.toHaveBeenCalled();expect(f.collection.assertFixedTreeDrawReady).not.toHaveBeenCalled();expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.contextDisposed).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();}
 finally{f.gate.resolve();await handled;f.cleanup();}
});

test('gallery rollback failure keeps both causes and never disposes or replaces live scene owners',async()=>{
 const f=fixture();f.compile.mockRejectedValue(Error('TEST compiler unavailable'));f.gate.resolve();
 try{const error=await changeCatalogSurface(f.context,{...f.previous,style:'origami'},f.collections,f.port).catch(error=>error);expect(error).toBeInstanceOf(AggregateError);expect((error as AggregateError).errors).toHaveLength(2);expect(f.compile).toHaveBeenCalledTimes(2);expect(f.scene.children).toEqual([f.mesh]);expect(f.geometryDisposed).not.toHaveBeenCalled();expect(f.materialDisposed).not.toHaveBeenCalled();expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();}
 finally{f.cleanup();}
});

test('initial gallery staging admits real preview streams without inventing a World, then compiles before committing the borrowed surface',async()=>{
 const f=fixture(),events:string[]=[];let captured:SharedSurfacePreparationSnapshot|undefined;
 const stage:SharedSurfacePreparationStage={publish:()=>{events.push('publish');},commit:()=>{events.push('commit');},rollback:()=>{events.push('rollback');},dispose:()=>{events.push('dispose');}};
 f.context.surfacePreparation.register({key:'TEST-preview-owner',needsPreparation:()=>true,stage:(snapshot)=>{captured=snapshot;events.push('stage');return stage;}});
 const batch=await stageCatalogSharedSurfaces(f.context,{...f.port,epoch:17},'initial');
 try{expect(captured?.world).toBeUndefined();expect(captured?.renderer).toBe(f.renderer);expect(captured?.epoch).toBe(17);expect(captured?.reason).toBe('initial');expect(events).toEqual(['stage']);expect(f.compile).not.toHaveBeenCalled();batch!.publish();expect(()=>f.context.surfacePreparation.assertReadyForDraw()).toThrow();await f.renderer.compileAsync(f.scene,f.camera);batch!.commit();batch!.dispose();expect(events).toEqual(['stage','publish','commit','dispose']);expect(()=>f.context.surfacePreparation.assertReadyForDraw()).not.toThrow();expect(f.init).not.toHaveBeenCalled();}finally{batch?.dispose();f.cleanup();}
});

test('gallery width/roughness stages hold both actual map bindings and coefficient stages until the common compile completes',async()=>{
 const f=fixture(),gate=deferred(),candidate=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1),events:string[]=[];f.material.map=f.texture;
 f.context.surfacePreparation.register({key:'TEST-actual-material-binding',needsPreparation:()=>true,stage:()=>{let committed=false;const old=f.material.map;return{publish:()=>{events.push('publish');f.material.map=candidate;},commit:()=>{events.push('commit');committed=true;},rollback:()=>{events.push('rollback');f.material.map=old;},dispose:()=>{if(!committed)f.material.map=old;events.push('dispose');}};}});
 f.compile.mockImplementationOnce(async()=>{expect(f.material.map).toBe(candidate);expect(f.context.surfacePreparation.snapshot().active).toBe(true);expect(events).toEqual(['publish']);await gate.promise;});
 const job=changeCatalogSurface(f.context,{...f.previous,edgeWidth:2,strokeImperfection:.25},f.collections,f.port);
 try{f.gate.resolve();await vi.waitFor(()=>expect(f.compile).toHaveBeenCalledOnce(),{interval:1,timeout:1000});expect(events).toEqual(['publish']);expect(f.mesh.material).toBe(f.material);expect(f.mesh.geometry).toBe(f.geometry);gate.resolve();await job;expect(events).toEqual(['publish','commit','dispose']);expect(f.context.surfacePreparation.dirty).toBe(false);expect(f.material.map).toBe(candidate);}finally{gate.resolve();f.gate.resolve();await job.catch(()=>{});f.cleanup();candidate.dispose();}
});

test('a failed gallery compile restores the previous actual binding and Source preference before the hold can end',async()=>{
 const f=fixture(),candidate=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1),events:string[]=[];f.material.map=f.texture;
 f.context.surfacePreparation.register({key:'TEST-rollback-binding',needsPreparation:()=>true,stage:snapshot=>{const old=f.material.map,next=snapshot.preferences.edgeWidth===f.previous.edgeWidth?f.texture:candidate;let committed=false;return{publish:()=>{events.push(next===candidate?'new-publish':'old-publish');f.material.map=next;},commit:()=>{committed=true;},rollback:()=>{events.push('rollback');f.material.map=old;},dispose:()=>{if(!committed)f.material.map=old;}};}});
 f.compile.mockRejectedValueOnce(Error('TEST global program failed')).mockResolvedValueOnce(undefined);f.gate.resolve();
 try{await expect(changeCatalogSurface(f.context,{...f.previous,edgeWidth:2},f.collections,f.port)).rejects.toThrow('TEST global program failed');expect(f.material.map).toBe(f.texture);expect(f.context.preferences).toEqual(f.previous);expect(events.indexOf('rollback')).toBeLessThan(events.indexOf('old-publish'));expect(f.context.surfacePreparation.dirty).toBe(false);expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.geometryDisposed).not.toHaveBeenCalled();}finally{f.cleanup();candidate.dispose();}
});


test('initial catalog projection is initialized for the actual backend before the strict publication pin',async()=>{
 const f=fixture();f.camera.coordinateSystem=THREE.WebGLCoordinateSystem;f.camera.updateProjectionMatrix();const before=f.camera.projectionMatrix.toArray();let batch:Awaited<ReturnType<typeof stageCatalogSharedSurfaces>>;
 f.context.surfacePreparation.register({key:'TEST-first-backend-projection',needsPreparation:()=>true,stage:()=>({publish(){},commit(){},rollback(){},dispose(){}})});
 try{
  expect(f.camera.coordinateSystem).toBe(THREE.WebGLCoordinateSystem);expect(f.renderer.coordinateSystem).toBe(THREE.WebGPUCoordinateSystem);
  batch=await stageCatalogSharedSurfaces(f.context,f.port,'initial');const pinned=f.camera.projectionMatrix.toArray();
  expect(f.camera.coordinateSystem).toBe(f.renderer.coordinateSystem);expect(pinned).not.toEqual(before);batch!.publish();
  f.compile.mockImplementationOnce(async()=>{f.camera.coordinateSystem=f.renderer.coordinateSystem;f.camera.updateProjectionMatrix();});
  await f.renderer.compileAsync(f.scene,f.camera);expect(f.camera.projectionMatrix.toArray()).toEqual(pinned);expect(()=>batch!.commit()).not.toThrow();
  batch!.dispose();expect(()=>f.context.surfacePreparation.assertReadyForDraw()).not.toThrow();expect(f.init).not.toHaveBeenCalled();
 }finally{batch?.dispose();f.cleanup();}
});

test('a genuine camera/projection change after catalog staging still refuses publication',async()=>{
 const f=fixture();let batch:Awaited<ReturnType<typeof stageCatalogSharedSurfaces>>;f.context.surfacePreparation.register({key:'TEST-real-camera-change',needsPreparation:()=>true,stage:()=>({publish(){},commit(){},rollback(){},dispose(){}})});
 try{batch=await stageCatalogSharedSurfaces(f.context,f.port,'initial');batch!.publish();f.compile.mockImplementationOnce(async()=>{f.camera.fov+=1;f.camera.updateProjectionMatrix();});await f.renderer.compileAsync(f.scene,f.camera);expect(()=>batch!.commit()).toThrow('Catalog actual paint/settings/camera changed before publication');batch!.rollback();expect(()=>f.context.surfacePreparation.assertReadyForDraw()).toThrow();expect(f.init).not.toHaveBeenCalled();}
 finally{batch?.dispose();f.cleanup();}
});
