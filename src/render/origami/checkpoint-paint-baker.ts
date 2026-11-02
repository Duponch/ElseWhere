import {GouacheCardboardPainter,createSeparatedReferencePaint,replayReferenceCoverage} from './reference-painter';
import type {ReferenceFacePaintPixels,ReferencePaintDescriptor,ReferencePaintLayerReceipt} from './reference-paint-library';

export interface CheckpointFacePaintPixels extends ReferenceFacePaintPixels {coverageSeed:number}
export type CheckpointPaintSink=(index:number,color:Uint8Array,bump:Uint8Array,face:CheckpointFacePaintPixels)=>void;
/** Full authored raster plus a read-only checkpoint at the pigment/coverage boundary. */
export function bakeCheckpointPaintToSink(descriptors:readonly ReferencePaintDescriptor[],fill:number,onLayer:CheckpointPaintSink):{layers:ReferencePaintLayerReceipt[]}{
 const painter=new GouacheCardboardPainter();painter.fillImperfectionAmount=fill;
 const layers:ReferencePaintLayerReceipt[]=[];
 for(let index=0;index<descriptors.length;index++){
  const descriptor=descriptors[index]!;painter.seed=descriptor.seed;
  const separated=createSeparatedReferencePaint(painter,descriptor.config),material=separated.material;
  try{
   onLayer(index,separated.pigmentColorRgba,separated.pigmentBumpRgba,separated);
   layers.push({key:descriptor.key,seed:descriptor.seed,seedAfter:separated.seedAfter});
  }finally{
   const canvases=new Set<HTMLCanvasElement>();
   for(const map of [material.map,material.alphaMap,material.bumpMap]){const canvas=map?.image as HTMLCanvasElement|undefined;if(canvas)canvases.add(canvas);map?.dispose();}
   material.dispose();for(const canvas of canvases){canvas.width=0;canvas.height=0;}
  }
 }
 return{layers};
}
/** Returns the final upload orientation R8 plane. Disabled fill/kraft creates
 * neither a Canvas nor a painter. Other fills replay the exact authored block. */
export function replayCheckpointMaskR8(coverageSeed:number,fill:number,kraftEdgeWear:boolean):Uint8Array{
 if(!Number.isSafeInteger(coverageSeed)||!Number.isFinite(fill)||fill<0||fill>1)throw Error('Exact coverage checkpoint and normalized fill required');
 if(!kraftEdgeWear||fill<=.01)return new Uint8Array(512*512).fill(255);
 const {coverageRgba}=replayReferenceCoverage(coverageSeed,fill,kraftEdgeWear),r8=new Uint8Array(512*512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++)r8[(511-y)*512+x]=coverageRgba[(y*512+x)*4+3]!;
 return r8;
}
