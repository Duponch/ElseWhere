/** TEST reference only. Existing CPU V3 raster/filtering arithmetic, explicitly
 * injected by source contracts; never imported by the product adapter. */
import * as THREE from 'three/webgpu';
import type {AnimalAtlasCompiler} from '../../src/render/origami/baked/animal-baked';
import {bakeColourAtlasSupersampled} from '../../src/render/origami/baked/baker-supersampled';
import {opaqueAtlasMipmaps} from '../../src/render/origami/baked/material';
import {AtlasBuildQuarantineError} from '../../src/render/origami/baked/atlas-cache';

const ownedBuffers=(arrays:readonly THREE.TypedArray[]):number=>{const buffers=new Set<ArrayBufferLike>();let bytes=0;for(const array of arrays)if(!buffers.has(array.buffer)){buffers.add(array.buffer);bytes+=array.buffer.byteLength;}return bytes;};

export const compileCpuAtlasReference:AnimalAtlasCompiler=input=>{
  input.assertCurrent();
  const result=bakeColourAtlasSupersampled(input.charts,{...input.paint,profile:input.profile},input.ink,input.bakeOptions),mips=opaqueAtlasMipmaps(result.data,result.width,result.height,input.charts.atlas.mipLevels);
  const map=new THREE.DataTexture(result.data,result.width,result.height,THREE.RGBAFormat,THREE.UnsignedByteType);
  try{
    map.name='Private complete animal atlas — '+input.species;map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=false;map.mipmaps=mips;map.needsUpdate=true;
    let disposed=false;return{texture:map,cpuBytes:ownedBuffers(mips.map(m=>m.data)),gpuBytes:mips.reduce((n,m)=>n+m.data.byteLength,0),stats:result.stats,dispose(){if(disposed)return;disposed=true;map.dispose();}};
  }catch(error){try{map.dispose();}catch(cleanup){throw new AtlasBuildQuarantineError(new AggregateError([error,cleanup],'CPU animal atlas cleanup failed'));}throw error;}
};
