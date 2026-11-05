/** Existing gallery collections remain the sole owners of models, materials
 * and placements. The caller holds rendering/controls across every await. */
import * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from '../render/graphics-style';
import type {GraphicsStylePreferences} from '../ui3d/native-preferences';
import type {CatalogCollection} from './asset-catalog-types';
import type {PreparedPlantAtlasStage} from '../render/origami/baked/plants/PlantAtlasSurface';
import type {SharedSurfacePreparationBatch,SharedSurfacePreparationSnapshot} from '../render/surfaces/SharedSurfacePreparation';

export interface CatalogSurfacePort {
 readonly renderer:THREE.WebGPURenderer;
 readonly scene:THREE.Scene;
 readonly camera:THREE.Camera;
 readonly epoch?:number;
 assertCurrent():void;
}

function cameraKey(camera:THREE.Camera):string{
 // compileAsync may update matrixWorld; capture its actual inputs, not a stale
 // derived matrix which the first compilation legitimately recomputes.
 return JSON.stringify({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),scale:camera.scale.toArray(),up:camera.up.toArray(),projection:camera.projectionMatrix.toArray(),layers:camera.layers.mask});
}
/** Preview streams are real catalog data, not a fabricated simulation World.
 * Adapters may explicitly refuse atlas admission for this World-less scope. */
export async function stageCatalogSharedSurfaces(context:GraphicsStyleContext,port:CatalogSurfacePort,reason:'initial'|'settings'):Promise<SharedSurfacePreparationBatch|undefined>{
 port.assertCurrent();
 // Camera defaults to WebGL coordinates. The existing initialized renderer
 // would switch this public projection input at its first compile/render.
 // Finish that legitimate one-time setup BEFORE the exact projection guard.
 if(port.camera.coordinateSystem!==port.renderer.coordinateSystem){
  if(!(port.camera instanceof THREE.PerspectiveCamera||port.camera instanceof THREE.OrthographicCamera))throw Error('Catalog requires its actual projection camera');
  port.camera.coordinateSystem=port.renderer.coordinateSystem;port.camera.updateProjectionMatrix();
 }
 // Clears fillTimer and completes its actual Source repaint before one lease
 // is captured for every atlas page. No timer can race the following awaits.
 for(const texture of context.prepareSharedSurfaceAssets())port.renderer.initTexture(texture);
 const paintSource=context.origami&&!context.reliefEnabled&&!context.wearEnabled&&Reflect.get(port.renderer.backend,'isWebGPUBackend')===true?context.prepareAtlasPaint():undefined;
 const snapshot:SharedSurfacePreparationSnapshot=Object.freeze({preferences:Object.freeze({...context.preferences}),world:undefined,reset:false,reason,epoch:port.epoch??0,renderer:port.renderer,paintRevision:context.preparedPaintRevision,paintSource});
 if(!context.surfacePreparation.needsPreparation(snapshot))return;
 const camera=cameraKey(port.camera);
 return context.surfacePreparation.stage(snapshot,()=>{port.assertCurrent();paintSource?.assertCurrent();if(context.preparedPaintRevision!==snapshot.paintRevision||JSON.stringify(context.preferences)!==JSON.stringify(snapshot.preferences)||cameraKey(port.camera)!==camera)throw Error('Catalog actual paint/settings/camera changed before publication');});
}

/** Color images and optional feature graphs are prepared before publication to
 * the gallery's next frame. Rollback prepares the previous images on those
 * same owners; no style change constructs another context or collection. */
export async function changeCatalogSurface(context:GraphicsStyleContext,next:GraphicsStylePreferences,collections:readonly CatalogCollection[],port:CatalogSurfacePort):Promise<void>{
 const previous={...context.preferences};
 const prepare=async(preferences:GraphicsStylePreferences)=>{
  const plants:PreparedPlantAtlasStage[]=[];let shared:SharedSurfacePreparationBatch|undefined,committed=false;
  try{port.assertCurrent();
  // Preserve the previous Gouache bank across Pastel/Gouache selections. The
  // preparation owner compares the paint key and retains its old lease until
  // a real replacement has compiled and been published. Rendering is held.
  context.update(preferences);
  for(const texture of context.prepareSharedSurfaceAssets())port.renderer.initTexture(texture);
  for(const collection of collections){await collection.prepareTrees?.(port.renderer,port.camera,port.scene,()=>port.assertCurrent());port.assertCurrent();}
  for(const collection of collections){const stage=await collection.stagePlants?.(port.renderer,port.camera,port.scene,()=>port.assertCurrent());if(stage)plants.push(stage);port.assertCurrent();}
  // New coefficients and actor atlases stage together before either publishes.
  shared=await stageCatalogSharedSurfaces(context,port,'settings');shared?.publish();
  await port.renderer.compileAsync(port.scene,port.camera);port.assertCurrent();for(const collection of collections)collection.assertFixedTreeDrawReady?.();for(const stage of plants)stage.commit();shared?.commit();committed=true;
  }finally{const errors:unknown[]=[];if(shared){if(!committed)try{shared.rollback();}catch(error){errors.push(error);}try{shared.dispose();}catch(error){errors.push(error);}}for(const stage of plants.reverse()){if(!committed)try{stage.rollback();}catch(error){errors.push(error);}try{stage.dispose();}catch(error){errors.push(error);}}if(errors.length)throw new AggregateError(errors,'Catalog coordinated surface stage cleanup failed');}
 };
 try{await prepare(next);}
 catch(error){
  // Page closure waits for this job, then tears down the owners. It must not
  // start another GPU compilation merely to restore an already closed view.
  try{port.assertCurrent();}catch{throw error;}
  try{await prepare(previous);}catch(rollbackError){throw new AggregateError([error,rollbackError],'Le retour aux textures précédentes de l’atelier a échoué.');}
  throw error;
 }
}
