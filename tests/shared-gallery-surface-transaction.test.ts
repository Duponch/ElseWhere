/** Real gallery transaction and GraphicsStyleContext on existing scene owners.
 * Painting/upload/compile are controlled orchestration seams, not a Native,
 * rendered-image or performance proof. No gallery DOM or World is fabricated. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {changeCatalogSurface} from '../src/dev/asset-catalog-surface';
import type {CatalogCollection} from '../src/dev/asset-catalog-types';

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
function fixture(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),previous={...context.preferences},texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),geometry=new THREE.BoxGeometry(),material=new THREE.MeshLambertNodeMaterial(),mesh=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();scene.add(mesh);camera.position.set(3,4,5);camera.updateMatrixWorld();
 const renderer=new THREE.WebGPURenderer({canvas:{width:32,height:32,style:{}} as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Orchestration must not create a device');}),upload=vi.spyOn(renderer,'initTexture').mockImplementation(()=>{}),compile=vi.spyOn(renderer,'compileAsync').mockResolvedValue(undefined),assets=vi.spyOn(context,'prepareSharedSurfaceAssets').mockReturnValue([texture]),contextDisposed=vi.spyOn(context,'dispose'),geometryDisposed=vi.spyOn(geometry,'dispose'),materialDisposed=vi.spyOn(material,'dispose'),gate=deferred();let valid=true;
 const collection:CatalogCollection={sections:[{id:'one-owner',label:'Existing collection',group:new THREE.Group(),items:[]}],invalidatePreparedTrees:vi.fn(),prepareTrees:vi.fn(async()=>{await gate.promise;}),dispose:vi.fn()},collections=[collection],port={renderer,scene,camera,assertCurrent:()=>{if(!valid)throw Error('TEST gallery closed');}};
 return{context,previous,texture,geometry,material,mesh,scene,camera,renderer,init,upload,compile,assets,contextDisposed,geometryDisposed,materialDisposed,gate,collection,collections,port,close:()=>{valid=false;},cleanup(){gate.resolve();init.mockRestore();upload.mockRestore();compile.mockRestore();assets.mockRestore();contextDisposed.mockRestore();geometryDisposed.mockRestore();materialDisposed.mockRestore();context.dispose();geometry.dispose();material.dispose();texture.dispose();}};
}

test('gallery style changes preserve actual context, collections, scene owners, geometry/material and camera while preparing before compile',async()=>{
 const f=fixture(),children=[...f.scene.children],position=f.camera.position.toArray(),projection=f.camera.projectionMatrix.toArray(),job=changeCatalogSurface(f.context,{...f.previous,style:'origami'},f.collections,f.port);
 try{
  expect(f.compile).not.toHaveBeenCalled();expect(f.context.surfaceEncoding.value).toBe(1);expect(f.collection.prepareTrees).toHaveBeenCalledExactlyOnceWith(f.renderer,f.camera,f.scene,expect.any(Function));
  f.gate.resolve();await job;
  expect(f.compile).toHaveBeenCalledExactlyOnceWith(f.scene,f.camera);expect(f.assets).toHaveBeenCalledTimes(2);expect(f.upload).toHaveBeenCalledTimes(2);expect(f.scene.children).toEqual(children);expect(f.mesh.geometry).toBe(f.geometry);expect(f.mesh.material).toBe(f.material);expect(f.camera.position.toArray()).toEqual(position);expect(f.camera.projectionMatrix.toArray()).toEqual(projection);expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.contextDisposed).not.toHaveBeenCalled();expect(f.geometryDisposed).not.toHaveBeenCalled();expect(f.materialDisposed).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();
  await changeCatalogSurface(f.context,f.previous,f.collections,f.port);expect(f.context.surfaceEncoding.value).toBe(0);expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.scene.children).toEqual(children);
 }finally{f.gate.resolve();await job.catch(()=>{});f.cleanup();}
});

test('failed gallery candidate prepares previous images and recompiles the same owners before rejecting',async()=>{
 const f=fixture();f.compile.mockRejectedValueOnce(Error('TEST candidate compile failed')).mockResolvedValueOnce(undefined);const job=changeCatalogSurface(f.context,{...f.previous,style:'origami',edgeWidth:2},f.collections,f.port),handled=job.catch(error=>error);
 try{
  f.gate.resolve();const error=await handled;expect((error as Error).message).toBe('TEST candidate compile failed');expect(f.context.preferences).toEqual(f.previous);expect(f.context.surfaceEncoding.value).toBe(0);expect(f.compile).toHaveBeenCalledTimes(2);expect(f.collection.invalidatePreparedTrees).toHaveBeenCalledTimes(2);expect(f.assets).toHaveBeenCalledTimes(4);expect(f.upload).toHaveBeenCalledTimes(4);expect(f.scene.children).toEqual([f.mesh]);expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.contextDisposed).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();
 }finally{f.gate.resolve();await handled;f.cleanup();}
});

test('closing a held gallery never starts rollback compilation after its preparation has settled',async()=>{
 const f=fixture(),job=changeCatalogSurface(f.context,{...f.previous,style:'origami'},f.collections,f.port),handled=job.catch(error=>error);
 try{f.close();f.gate.resolve();const error=await handled;expect((error as Error).message).toBe('TEST gallery closed');expect(f.compile).not.toHaveBeenCalled();expect(f.collection.invalidatePreparedTrees).toHaveBeenCalledOnce();expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.contextDisposed).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();}
 finally{f.gate.resolve();await handled;f.cleanup();}
});

test('gallery rollback failure keeps both causes and never disposes or replaces live scene owners',async()=>{
 const f=fixture();f.compile.mockRejectedValue(Error('TEST compiler unavailable'));f.gate.resolve();
 try{const error=await changeCatalogSurface(f.context,{...f.previous,style:'origami'},f.collections,f.port).catch(error=>error);expect(error).toBeInstanceOf(AggregateError);expect((error as AggregateError).errors).toHaveLength(2);expect(f.compile).toHaveBeenCalledTimes(2);expect(f.scene.children).toEqual([f.mesh]);expect(f.geometryDisposed).not.toHaveBeenCalled();expect(f.materialDisposed).not.toHaveBeenCalled();expect(f.collection.dispose).not.toHaveBeenCalled();expect(f.init).not.toHaveBeenCalled();}
 finally{f.cleanup();}
});
