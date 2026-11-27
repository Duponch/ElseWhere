import type * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from './graphics-style';

/** Swap immutable pixels on the existing texture at a settings boundary.
 * Producers keep their existing one-read material and ownership. */
export function bindPersonalizedTexture(context:GraphicsStyleContext|undefined,map:THREE.DataTexture,
  pixels:(enabled:boolean)=>Uint8Array):()=>void {
  const apply=(enabled:boolean)=>{
    const data=pixels(enabled),image=map.image;
    if(!(data instanceof Uint8Array)||data.length!==image.width*image.height*4)
      throw Error('Personalized texture must keep its exact RGBA dimensions');
    if(image.data!==data){image.data=data;map.needsUpdate=true;}
  };
  let unsubscribe=()=>{},closed=false;
  const release=()=>{if(closed)return;closed=true;unsubscribe();map.removeEventListener('dispose',release);};
  if(context)unsubscribe=context.trackPersonalizedTextures(apply);else apply(true);
  map.addEventListener('dispose',release);
  return release;
}
