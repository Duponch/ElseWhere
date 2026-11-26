import {Texture} from 'three/webgpu';

/** A rejected decode selects the layer's normal fallback. An exception
 * inside its success callback is a rendering failure and propagates. */
export function applySceneTexture(bitmap:Promise<ImageBitmap>,closed:()=>boolean,loaded:(texture:Texture)=>void,onError:()=>void):Promise<void>{
  return bitmap.then(image=>{
    if(closed()){image.close();return;}
    const texture=new Texture(image);
    texture.flipY=false;texture.needsUpdate=true;
    texture.addEventListener('dispose',()=>image.close());
    try{loaded(texture);}catch(error){texture.dispose();throw error;}
  },()=>{if(!closed())onError();});
}
