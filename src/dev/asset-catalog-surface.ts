/** Existing gallery collections remain the sole owners of models, materials
 * and placements. The caller holds rendering/controls across every await. */
import type * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from '../render/graphics-style';
import type {GraphicsStylePreferences} from '../ui3d/native-preferences';
import type {CatalogCollection} from './asset-catalog-types';

export interface CatalogSurfacePort {
 readonly renderer:THREE.WebGPURenderer;
 readonly scene:THREE.Scene;
 readonly camera:THREE.Camera;
 assertCurrent():void;
}

/** Color images and optional feature graphs are prepared before publication to
 * the gallery's next frame. Rollback prepares the previous images on those
 * same owners; no style change constructs another context or collection. */
export async function changeCatalogSurface(context:GraphicsStyleContext,next:GraphicsStylePreferences,collections:readonly CatalogCollection[],port:CatalogSurfacePort):Promise<void>{
 const previous={...context.preferences};
 const prepare=async(preferences:GraphicsStylePreferences)=>{
  port.assertCurrent();
  // Detach an old generation before changing its borrowed paint. Rendering is
  // held; an atlas refusal retains the same complete opaque direct surface.
  for(const collection of collections)collection.invalidatePreparedTrees?.();
  context.update(preferences);
  for(const texture of context.prepareSharedSurfaceAssets())port.renderer.initTexture(texture);
  for(const collection of collections){await collection.prepareTrees?.(port.renderer,port.camera,port.scene,()=>port.assertCurrent());port.assertCurrent();}
  // A preparation may have admitted additional metadata/pigment layers.
  for(const texture of context.prepareSharedSurfaceAssets())port.renderer.initTexture(texture);
  await port.renderer.compileAsync(port.scene,port.camera);port.assertCurrent();
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
