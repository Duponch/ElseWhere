import type * as THREE from 'three/webgpu';
import {GouacheCardboardPainter,createSeparatedReferencePaint,createReferencePaintMaterial,createReferenceEdgeMaterial,type ReferencePaintConfig} from './reference-painter';

export interface ReferencePaintDescriptor {
  key: string;
  config: ReferencePaintConfig;
  /** Exact painter seed at this source material's registration boundary. */
  seed: number;
  /** Original allGouacheMaterials index, before any material deduplication. */
  sourceIndex?: number;
  /** Original refreshAllGouacheTextures(true): final source seed + index*1013. */
  refreshSeed?: number;
}
export interface ReferencePaintLayerReceipt {
  key: string;
  seed: number;
  seedAfter: number;
}
export interface ReferenceEdgePixels {
  width: 512;
  height: 128;
  colorRgba?: Uint8Array;
  alphaRgba: Uint8Array;
  bumpRgba?: Uint8Array;
  seed: number;
  seedAfter: number;
}
export interface ReferencePaintPixels {
  width: 512;
  height: 512;
  depth: number;
  /** Whole independent 512² layers, without resampling, gutters or atlas bleed.
   * Set the GPU color texture's colorSpace to THREE.SRGBColorSpace. */
  colorRgba: Uint8Array;
  /** Linear source heights when requested; absent for color-only baking. */
  bumpRgba?: Uint8Array;
  layers: ReferencePaintLayerReceipt[];
  edge: ReferenceEdgePixels;
}
export interface ReferencePaintBakeSettings {
  /** False omits every pigment/paper height raster and texture; RGB/RNG stay exact. */
  includeHeight?: boolean;
  /** Alpha always remains for brush strokes; omitted channels allocate nothing. */
  edgeChannels?: {color:boolean;height:boolean};
  fillImperfection?: number;
  /** Product mapping separates the face boundary from the repeating pigment.
   * The canonical oracle retains the literal composited Canvas by default. */
  separateFill?: boolean;
  /** The source creates its physical edge material before any paint material. */
  edgeSeed?: number;
}
export interface ReferencePaintStreamResult {
  edge: ReferenceEdgePixels;
  layers: ReferencePaintLayerReceipt[];
}
/** Called synchronously with one source profile. Copy/pack it into the final
 * destination before returning; production consumers must not retain every layer. */
export interface ReferenceFacePaintPixels {paperColorRgba:Uint8Array;paperBumpRgba?:Uint8Array;coverageRgba:Uint8Array}
export type ReferencePaintLayerSink = (index: number, colorRgba: Uint8Array, bumpRgba: Uint8Array|undefined,face?:ReferenceFacePaintPixels) => void;

const PIXELS_PER_LAYER = 512 * 512 * 4;

/** Preserve the exact opaque source RGB and linear red-channel bump height in
 * one RGBA8 texture. CPU row inversion matches CanvasTexture.flipY=true while
 * permitting flipY=false on both backends and avoiding a GPU flip pass per layer.
 * Rows are reversed independently inside each array layer; layer IDs stay fixed.
 */
export function packReferencePaintPixels(
  colorRgba: Uint8Array,
  bumpRgba: Uint8Array|undefined,
  width: number,
  height: number,
  layers: number,
  target?: Uint8Array,
): Uint8Array {
  if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1||!Number.isInteger(layers)||layers<0)
    throw new Error('Origami paint packing requires positive integer dimensions and a nonnegative layer count');
  const length=width*height*layers*4;
  if(!Number.isSafeInteger(length)||colorRgba.length!==length||(bumpRgba!==undefined&&bumpRgba.length!==length))
    throw new Error('Origami paint packing requires complete matching RGBA layers');
  if(target&&target.length!==length)throw new Error('Origami paint packing target must match the complete RGBA output length');
  const packed=target??new Uint8Array(length),rowBytes=width*4,layerBytes=rowBytes*height;
  const overlaps=(source:Uint8Array)=>packed.buffer===source.buffer&&packed.byteOffset<source.byteOffset+source.byteLength&&source.byteOffset<packed.byteOffset+packed.byteLength;
  if(overlaps(colorRgba)||(bumpRgba!==undefined&&overlaps(bumpRgba)))throw new Error('Origami paint packing target must not overlap either source');
  for(let layer=0;layer<layers;layer++)for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=layer*layerBytes+y*rowBytes+x*4;
    if(colorRgba[source+3]!==255||(bumpRgba!==undefined&&bumpRgba[source+3]!==255))
      throw new Error('Origami paint packing requires opaque source color and bump canvases');
    const target=layer*layerBytes+(height-1-y)*rowBytes+x*4;
    packed[target]=colorRgba[source];packed[target+1]=colorRgba[source+1];packed[target+2]=colorRgba[source+2];packed[target+3]=bumpRgba?.[source]??255;
  }
  return packed;
}

function rgba(canvas: HTMLCanvasElement): Uint8Array {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Origami requires Canvas2D for the supplied gouache painter');
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function release(material: THREE.MeshStandardMaterial): void {
  const canvases = new Set<HTMLCanvasElement>();
  for (const texture of [material.map, material.alphaMap, material.bumpMap]) {
    const canvas = texture?.image as HTMLCanvasElement | undefined;
    if (canvas) canvases.add(canvas);
    texture?.dispose();
  }
  material.dispose();
  // The source raster is already copied. Release its backing storage promptly;
  // none of these transient materials become per-primitive draw calls.
  for (const canvas of canvases) { canvas.width = 0; canvas.height = 0; }
}

/** Production streaming path: no full-pool color/bump/packed arrays are held.
 * The literal painter, seed order and edge creation are identical to the full
 * oracle API below; one profile is sent to the sink before its canvases/maps are
 * released. Source intermediate paint/mask canvases remain browser-managed.
 */
export function bakeReferencePaintLayersToSink(
  descriptors: readonly ReferencePaintDescriptor[],
  settings: ReferencePaintBakeSettings = {},
  onLayer: ReferencePaintLayerSink,
): ReferencePaintStreamResult {
  const painter = new GouacheCardboardPainter();
  painter.fillImperfectionAmount = settings.fillImperfection ?? .60;
  painter.seed = settings.edgeSeed ?? 1337;
  const edgeSeed = painter.seed;
  const edgeMaterial = createReferenceEdgeMaterial(painter,settings.edgeChannels??{color:true,height:settings.includeHeight!==false});
  let edge: ReferenceEdgePixels;
  try {
    edge = {
      width: 512, height: 128,
      ...(edgeMaterial.map?{colorRgba:rgba(edgeMaterial.map.image as HTMLCanvasElement)}:{}),
      alphaRgba: rgba(edgeMaterial.alphaMap!.image as HTMLCanvasElement),
      ...(edgeMaterial.bumpMap?{bumpRgba:rgba(edgeMaterial.bumpMap.image as HTMLCanvasElement)}:{}),
      seed: edgeSeed, seedAfter: painter.seed,
    };
  } finally { release(edgeMaterial); }

  const layers: ReferencePaintLayerReceipt[] = [];
  for (let index = 0; index < descriptors.length; index++) {
    const {key, config, seed} = descriptors[index];
    painter.seed = seed;
    const separated=settings.separateFill?createSeparatedReferencePaint(painter,config,settings):undefined;
    const material = separated?.material??createReferencePaintMaterial(painter,config,settings);
    try {
      onLayer(index,separated?.pigmentColorRgba??rgba(material.userData.colorCanvas as HTMLCanvasElement),separated?separated.pigmentBumpRgba:material.userData.bumpCanvas?rgba(material.userData.bumpCanvas as HTMLCanvasElement):undefined,separated);
      layers.push({key, seed, seedAfter: painter.seed});
    } finally { release(material); }
  }
  return {layers, edge};
}

/** Full-array oracle/fixture compatibility path. Production uses the streaming
 * API so only its final destination banks and one reusable pack scratch remain.
 * This wrapper calls the painter/edge factory exactly once through that API.
 */
export function bakeReferencePaintLayers(
  descriptors: readonly ReferencePaintDescriptor[],
  settings: ReferencePaintBakeSettings = {},
): ReferencePaintPixels {
  const colorRgba=new Uint8Array(PIXELS_PER_LAYER*descriptors.length);
  const bumpRgba=settings.includeHeight===false?undefined:new Uint8Array(PIXELS_PER_LAYER*descriptors.length);
  const {layers,edge}=bakeReferencePaintLayersToSink(descriptors,settings,(index,color,bump)=>{
    colorRgba.set(color,index*PIXELS_PER_LAYER);if(bumpRgba){if(!bump)throw Error('Requested paint height was not returned');bumpRgba.set(bump,index*PIXELS_PER_LAYER);}
  });
  return {width:512,height:512,depth:descriptors.length,colorRgba,bumpRgba,layers,edge};
}
