import * as THREE from 'three/webgpu';
import {GouacheCardboardPainter,createSeparatedReferencePaint,createReferencePaintMaterial,createReferenceEdgeMaterial} from './reference-painter';
import type {ReferencePaintDescriptor,ReferencePaintBakeSettings,ReferencePaintLayerSink,ReferencePaintLayerReceipt,ReferenceEdgePixels} from './reference-paint-library';

/** Streaming authored paint seam. Exact current painter, optional independently-owned
 * edge generation. Every profile explicitly resets its recorded seed, so
 * skipping an already-owned edge draw never changes its source RNG stream. */
export interface ResidentPaintSettings extends ReferencePaintBakeSettings {includeEdge?:boolean}
function rgba(canvas:HTMLCanvasElement):Uint8Array{const context=canvas.getContext('2d');if(!context)throw Error('Origami requires Canvas2D');const data=context.getImageData(0,0,canvas.width,canvas.height).data;return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);}
function release(material:THREE.MeshStandardMaterial):void{
 const canvases=new Set<HTMLCanvasElement>();for(const map of [material.map,material.alphaMap,material.bumpMap]){const canvas=map?.image as HTMLCanvasElement|undefined;if(canvas)canvases.add(canvas);map?.dispose();}material.dispose();for(const canvas of canvases){canvas.width=0;canvas.height=0;}
}
export function bakeResidentPaintToSink(descriptors:readonly ReferencePaintDescriptor[],settings:ResidentPaintSettings,onLayer:ReferencePaintLayerSink):{layers:ReferencePaintLayerReceipt[];edge?:ReferenceEdgePixels}{
 const painter=new GouacheCardboardPainter();painter.fillImperfectionAmount=settings.fillImperfection??.60;painter.seed=settings.edgeSeed??1337;
 let edge:ReferenceEdgePixels|undefined;
 if(settings.includeEdge){const seed=painter.seed,material=createReferenceEdgeMaterial(painter,settings.edgeChannels??{color:true,height:settings.includeHeight!==false});try{edge={width:512,height:128,...(material.map?{colorRgba:rgba(material.map.image as HTMLCanvasElement)}:{}),alphaRgba:rgba(material.alphaMap!.image as HTMLCanvasElement),...(material.bumpMap?{bumpRgba:rgba(material.bumpMap.image as HTMLCanvasElement)}:{}),seed,seedAfter:painter.seed};}finally{release(material);}}
 const layers:ReferencePaintLayerReceipt[]=[];
 for(let index=0;index<descriptors.length;index++){
  const {key,config,seed}=descriptors[index]!;painter.seed=seed;
  const separated=settings.separateFill?createSeparatedReferencePaint(painter,config,settings):undefined,material=separated?.material??createReferencePaintMaterial(painter,config,settings);
  try{onLayer(index,separated?.pigmentColorRgba??rgba(material.userData.colorCanvas as HTMLCanvasElement),separated?separated.pigmentBumpRgba:material.userData.bumpCanvas?rgba(material.userData.bumpCanvas as HTMLCanvasElement):undefined,separated);layers.push({key,seed,seedAfter:painter.seed});}finally{release(material);}
 }
 return {layers,edge};
}
