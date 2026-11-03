/** Far filtering support. No actor, camera owner, frame loop or texture
 * allocation. Not enabled by SceneRenderCore until visual qualification. */
import * as THREE from 'three/webgpu';
import {Fn,attribute,varying,texture,vec2,mix,smoothstep} from 'three/tsl';
import {createOpaqueAtlasMaterialFromTexture,type OpaqueAtlasMaterial} from './material';

export const BAKED_MEAN_ATTRIBUTE='bakedMeanRgb';
export const BAKED_MEAN_FOOTPRINT=Object.freeze({startTexels:8,endTexels:32});
type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const instanced=(a:Attribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;

/** Call on the OWNED complete chart geometry before union/culling indices.
 * triangleChart is its full index-stream triangle→chart map; means are borrowed
 * linear RGB from the composed atlas preparation (including paper and ink).
 * Adds only RGB; positions, index/groups, UVs, all rig/owner data stay intact.
 * Conflicting shared vertices are refused rather than silently deindexed.
 * The attribute becomes geometry-owned. It survives ordinary clone/growth. */
export function attachBakedChartMeans(geometry:THREE.BufferGeometry,triangleChart:Uint32Array,meanLinearRGB:Readonly<Float32Array>,maxOutputBytes=64*1024*1024){
  if(geometry.hasAttribute(BAKED_MEAN_ATTRIBUTE))throw Error('Baked mean attribute already exists');
  const position=geometry.getAttribute('position'),uv=geometry.getAttribute('bakedUv');
  if(!position||!uv||instanced(position)||instanced(uv)||uv.itemSize!==2||uv.count!==position.count)throw Error('Complete static baked UV geometry required');
  const streamCount=geometry.index?.count??position.count,count=position.count,bytes=count*3*4;
  if(!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<0||!Number.isSafeInteger(bytes)||bytes>maxOutputBytes)throw Error('Baked mean RGB output budget refused before allocation');
  if(streamCount%3||triangleChart.length!==streamCount/3||geometry.drawRange.start!==0||geometry.drawRange.count<streamCount)throw Error('Complete unfiltered triangle index stream required for chart means');
  if(!meanLinearRGB.length||meanLinearRGB.length%3)throw Error('Complete linear RGB chart means required');
  const chartCount=meanLinearRGB.length/3;
  for(const value of meanLinearRGB)if(!Number.isFinite(value)||value<0||value>1)throw Error('Finite composed RGBA8 linear chart means required');
  // Bounded scratch: one signed chart ordinal per source vertex, in addition
  // to the declared retained RGB output. No per-frame allocation follows.
  const firstChart=new Int32Array(count).fill(-1);
  if(chartCount>0x7fffffff)throw Error('Chart ordinal domain refused');
  for(let at=0;at<streamCount;at++){
    const vertex=geometry.index?.getX(at)??at,chart=triangleChart[Math.floor(at/3)]!;
    if(!Number.isSafeInteger(vertex)||vertex<0||vertex>=count||chart>=chartCount)throw Error('Baked chart/vertex ordinal outside its source domain');
    const previous=firstChart[vertex]!;
    if(previous>=0&&previous!==chart)for(let channel=0;channel<3;channel++)if(meanLinearRGB[previous*3+channel]!==meanLinearRGB[chart*3+channel])throw Error('Shared vertex crosses incompatible chart means');
    firstChart[vertex]=chart;
  }
  const rgb=new Float32Array(count*3);
  for(let vertex=0;vertex<count;vertex++){const chart=firstChart[vertex]!;if(chart>=0)for(let channel=0;channel<3;channel++)rgb[vertex*3+channel]=meanLinearRGB[chart*3+channel]!;}
  const result=new THREE.BufferAttribute(rgb,3);geometry.setAttribute(BAKED_MEAN_ATTRIBUTE,result);
  return{attribute:result,bytes,scratchBytes:firstChart.byteLength,chartCount,vertexCount:count};
}

/** ONE implicit atlas sample; sampling stays outside any varying branch.
 * Hardware/Three supplies its existing sRGB→linear result. Means are already
 * linear and are NOT decoded again. The fade is in linear albedo, before PBR.
 * Screen derivatives naturally include perspective, pose, scale and grazing.
 * Derivative max-length is an isotropic footprint estimate, not exact EWA. */
export function bakedChartMeanColorNode(map:THREE.Texture):THREE.Node<'vec3'>{
  const image:unknown=map.image;
  if(map.colorSpace!==THREE.SRGBColorSpace||!image||typeof image!=='object')throw Error('Prepared sRGB atlas required for chart-mean color');
  const width:unknown=Reflect.get(image,'width'),height:unknown=Reflect.get(image,'height');
  if(typeof width!=='number'||typeof height!=='number'||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||map.flipY||map.generateMipmaps||map.mipmaps.length!==4)throw Error('Finite four-mip atlas dimensions required');
  const uv=attribute('bakedUv','vec2'),mean=varying(attribute(BAKED_MEAN_ATTRIBUTE,'vec3'),'v_bakedChartMeanLinear').setInterpolation('flat','first');
  return Fn(()=>{
    const sampled=texture(map,uv).rgb.toVar('origamiBakedMeanSample'),size=vec2(width,height);
    const footprint=uv.dFdx().mul(size).length().max(uv.dFdy().mul(size).length()).toVar('origamiBakedMeanFootprint');
    const weight=smoothstep(BAKED_MEAN_FOOTPRINT.startTexels,BAKED_MEAN_FOOTPRINT.endTexels,footprint).toVar('origamiBakedMeanWeight');
    return mix(sampled,mean,weight);
  })();
}

/** Same existing opaque Standard .88/.02 factory and owner contract, with only
 * its albedo node replaced. No atlas ownership change or extra runtime map. */
export function createChartMeanAtlasMaterial<T extends THREE.Texture>(map:T,bytes:number,releaseTexture:()=>void):OpaqueAtlasMaterial<T>{
  // Validate the new node BEFORE acquiring the existing material/texture owner.
  const color=bakedChartMeanColorNode(map),result=createOpaqueAtlasMaterialFromTexture(map,bytes,releaseTexture);
  result.material.colorNode=color;result.material.name='Private opaque atlas — finite mip chain plus chart mean';return result;
}
