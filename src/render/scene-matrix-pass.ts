import type {Object3D,Scene} from 'three/webgpu';

const retainedLocalMatrices=new WeakSet<Object3D>();
/** Closed scene producers whose LOCAL transform is fixed may retain the
 * matrix instead of rewriting it on every draw (which also forces every
 * descendant's world matrix). Instance transforms remain independent.
 * Parent motion is still handled by Three's ordinary propagation; a move
 * to or from another parent explicitly invalidates matrixWorld. */
export function retainFixedLocalMatrix<T extends Object3D>(object:T):T {
  if(retainedLocalMatrices.has(object))return object;
  retainedLocalMatrices.add(object);
  if(object.matrixAutoUpdate)object.updateMatrix();
  object.matrixAutoUpdate=false;
  const invalidate=()=>{object.matrixWorldNeedsUpdate=true;};
  invalidate();
  object.addEventListener('added',invalidate);
  object.addEventListener('removed',invalidate);
  return object;
}

/** All CPU poses are settled before the draw. Three r186 otherwise traverses
 * the same game scene again for each nested shadow render. Keep one complete
 * update for this draw; preparation and callers outside it retain normal
 * automatic updates, including after a failed render. */
export function withPreparedSceneMatrices<T>(scene:Scene,draw:()=>T):T {
  const automatic=scene.matrixWorldAutoUpdate;
  if(automatic){scene.updateMatrixWorld();scene.matrixWorldAutoUpdate=false;}
  try{return draw();}
  finally{scene.matrixWorldAutoUpdate=automatic;}
}
