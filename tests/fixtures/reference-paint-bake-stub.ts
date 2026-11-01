import type {ReferencePaintDescriptor,ReferencePaintBakeSettings} from '../../src/render/origami/reference-paint-library';
/** CPU lifecycle tests replace only the browser Canvas2D boundary. These zero
 * pixels do not qualify paint fidelity; the literal painter and browser compare
 * cover it separately. Reuse one opaque tile at the streaming seam. */
export function stubReferenceBakeToSink(descriptors:readonly ReferencePaintDescriptor[],_settings:ReferencePaintBakeSettings,onLayer:(index:number,color:Uint8Array,bump:Uint8Array)=>void){
 const pixels=new Uint8Array(512*512*4);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 for(let i=0;i<descriptors.length;i++)onLayer(i,pixels,pixels);
 const edge=new Uint8Array(512*128*4);for(let i=3;i<edge.length;i+=4)edge[i]=255;
 return {layers:descriptors.map(({key,seed})=>({key,seed,seedAfter:seed})),edge:{width:512 as const,height:128 as const,colorRgba:edge,alphaRgba:edge,bumpRgba:edge,seed:1337,seedAfter:1337}};
}
