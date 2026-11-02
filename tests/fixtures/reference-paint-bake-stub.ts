import type {ReferencePaintDescriptor,ReferencePaintBakeSettings,ReferenceEdgePixels,ReferenceFacePaintPixels} from '../../src/render/origami/reference-paint-library';
/** CPU lifecycle tests replace only the browser Canvas2D boundary. These zero
 * pixels do not qualify paint fidelity; the literal painter and browser compare
 * cover it separately. Reuse one opaque tile at the streaming seam. */
export function stubReferenceBakeToSink(descriptors:readonly ReferencePaintDescriptor[],_settings:ReferencePaintBakeSettings,onLayer:(index:number,color:Uint8Array,bump:Uint8Array)=>void){
 const pixels=new Uint8Array(512*512*4);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 for(let i=0;i<descriptors.length;i++)onLayer(i,pixels,pixels);
 const edge=new Uint8Array(512*128*4);for(let i=3;i<edge.length;i+=4)edge[i]=255;
 return {layers:descriptors.map(({key,seed})=>({key,seed,seedAfter:seed})),edge:{width:512 as const,height:128 as const,colorRgba:edge,alphaRgba:edge,bumpRgba:edge,seed:1337,seedAfter:1337}};
}

/** Synthetic lifecycle data only. None of these helpers qualifies source paint
 * commands, RNG replay, mipmaps, rendering or visual fidelity. */
export function stubReferenceEdgePixels():ReferenceEdgePixels{
 const edge=new Uint8Array(512*128*4);for(let i=3;i<edge.length;i+=4)edge[i]=255;
 return{width:512,height:128,colorRgba:edge,alphaRgba:edge,bumpRgba:edge,seed:1337,seedAfter:1337};
}
export function stubResidentPaintToSink(descriptors:readonly ReferencePaintDescriptor[],settings:ReferencePaintBakeSettings&{includeEdge?:boolean},onLayer:(index:number,color:Uint8Array,bump:Uint8Array,face?:ReferenceFacePaintPixels)=>void){
 const pixels=new Uint8Array(512*512*4);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 for(let i=0;i<descriptors.length;i++)onLayer(i,pixels,pixels);
 return{layers:descriptors.map(({key,seed})=>({key,seed,seedAfter:seed})),edge:settings.includeEdge?stubReferenceEdgePixels():undefined};
}
export function stubCheckpointPaintToSink(descriptors:readonly ReferencePaintDescriptor[],fill:number,onLayer:(index:number,color:Uint8Array,bump:Uint8Array,face:ReferenceFacePaintPixels&{coverageSeed:number})=>void){
 const pixels=new Uint8Array(512*512*4),coverage=new Uint8Array(512*512*4);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 for(let i=0;i<descriptors.length;i++){
  const descriptor=descriptors[i]!;coverage.fill(descriptor.config.kraftEdgeWear===false||fill<=.01?255:Math.round(fill*255));
  onLayer(i,pixels,pixels,{paperColorRgba:pixels,paperBumpRgba:pixels,coverageRgba:coverage,coverageSeed:descriptor.seed+10000});
 }
 return{layers:descriptors.map(({key,seed})=>({key,seed,seedAfter:seed+10000}))};
}
export function stubReplayCheckpointMaskR8(_seed:number,fill:number,kraft:boolean):Uint8Array{
 return new Uint8Array(512*512).fill(!kraft||fill<=.01?255:Math.round(fill*255));
}
