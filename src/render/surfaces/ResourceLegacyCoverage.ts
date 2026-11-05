/** Complete Source fallback uses the very same convex tree-face mask as the
 * admitted RGBA tree bank. Its resident chart UV is a true planar coordinate;
 * original primitive UV is not (tapered trunk quads are trapezoids). Immutable
 * model metadata, never a World census. */
import * as THREE from 'three/webgpu';
import {Fn,If,float,int,ivec2,uniform,varying,vec2} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import type {TreeModelAtlasLayout} from '../models/TreeModels';
import {metadataTexel} from './MetadataTexel';
import {compileLegacyFaceMasks,legacyCoverageFromInputs,legacyMaskMargin} from '../origami/baked/trees/face-mask';
import {projectBakedChart,type Vec2} from '../origami/baked/charts';
import {SURFACE_STROKE_FACE} from './NaturalSurfaceModels';

const ROWS=8,WIDTH=1024,MAX_BYTES=1024*1024;
export interface ResourceLegacyModel {readonly mapped:THREE.BufferGeometry;readonly layout:TreeModelAtlasLayout;readonly triangleOffset:number;readonly triangleCount:number}
export interface ResourceLegacyCoverage {
 readonly data:Float32Array;readonly texture:THREE.DataTexture;readonly cpuBytes:number;readonly gpuBytes:number;readonly maskedFaces:number;
 point(face:number,uv:Vec2):Vec2;
 node(context:GraphicsStyleContext,raw:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,face:THREE.Node<'float'>,atlasUv:THREE.Node<'vec2'>,probe?:'x'|'y'):THREE.Node<'float'>;
 dispose():void;
}
export function compileResourceLegacyCoverage(models:readonly ResourceLegacyModel[],faceCount:number):ResourceLegacyCoverage{
 if(!Number.isSafeInteger(faceCount)||faceCount<1||faceCount>4096)throw Error('Bounded actual natural face IDs required');
 const height=Math.ceil(faceCount*ROWS/WIDTH),bytes=WIDTH*height*16;if(bytes>MAX_BYTES)throw Error('Tree fallback metadata budget exceeded before allocation');
 const data=new Float32Array(bytes/4),assigned=new Map<number,{layout:TreeModelAtlasLayout;chart:number}>(),masks=new Map<TreeModelAtlasLayout,ReturnType<typeof compileLegacyFaceMasks>>();
 for(const model of models){
  const {mapped,layout}=model,raw=mapped.getAttribute('bakedUv'),faces=mapped.getAttribute(SURFACE_STROKE_FACE),index=mapped.index;
  if(!raw||raw.itemSize!==3||!faces||faces.itemSize!==1)throw Error('Complete actual Resource face/physical atlas UV streams required');
  let mask=masks.get(layout);if(!mask){mask=compileLegacyFaceMasks(layout.charts);masks.set(layout,mask);}
  for(const t of layout.charts.triangles){
   if(t.sourceTriangle<model.triangleOffset||t.sourceTriangle>=model.triangleOffset+model.triangleCount)continue;
   const triangle=t.sourceTriangle-model.triangleOffset,vertices=[0,1,2].map(c=>index?.getX(triangle*3+c)??triangle*3+c),face=faces.getX(vertices[0]!);
   if(!Number.isSafeInteger(face)||face<0||face>=faceCount||vertices.some(v=>faces.getX(v)!==face))throw Error('Tree fallback canonical face provenance changed');
   const chart=layout.charts.charts[t.chartId]!,position=layout.charts.geometry.getAttribute('position'),points=t.outputVertices.map(v=>projectBakedChart(chart,[position.getX(v),position.getY(v),position.getZ(v)])),uv=vertices.map(v=>[raw.getX(v),raw.getY(v)]as const),m=mask[t.chartId]!,at=face*ROWS*4,previous=assigned.get(face);
   if(previous&&(previous.layout!==layout||previous.chart!==t.chartId))throw Error('Natural face spans different true tree polygons');
   if(!previous){const density=layout.charts.atlas.texelsPerUnit,a=[layout.charts.atlas.width/density,0,chart.min[0]-chart.content.x/density,0,layout.charts.atlas.height/density,chart.min[1]-chart.content.y/density]as const;data.set([a[0],a[1],a[2],a[3],a[4],a[5],m.edges.length,m.span],at);for(let i=0;i<m.edges.length;i++)data.set(m.edges[i]!,at+8+i*4);assigned.set(face,{layout,chart:t.chartId});}
   // Bound representational f32 error algebraically, not with a visual cutoff.
   // A pathological transform refuses the complete vocabulary instead of
   // changing paint density, geometry, or accepting an unknown face mapping.
   for(let c=0;c<3;c++)for(let axis=0;axis<2;axis++){
    const k=at+(axis===0?0:3),q=uv[c]!,predicted=data[k]!*q[0]+data[k+1]!*q[1]+data[k+2]!,scale=Math.abs(data[k]!*q[0])+Math.abs(data[k+1]!*q[1])+Math.abs(data[k+2]!)+Math.abs(points[c]![axis])+1;
    if(Math.abs(predicted-points[c]![axis])>32*2**-23*scale)throw Error('Tree fallback affine map exceeds f32 roundoff bound');
   }
  }
 }
 const texture=new THREE.DataTexture(data,WIDTH,height,THREE.RGBAFormat,THREE.FloatType);texture.name='Actual tree polygon fallback metadata';texture.colorSpace=THREE.NoColorSpace;texture.flipY=false;texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;let closed=false;
 // Match the painter's JS Math.round BEFORE float uniform conversion.
 // Settings callbacks only; a stable frame performs no margin work.
 const margins=new Map<GraphicsStyleContext,{node:THREE.Node<'float'>;release:()=>void}>();
 const marginFor=(context:GraphicsStyleContext)=>{const previous=margins.get(context);if(previous)return previous.node;const value=uniform(0),refresh=()=>{value.value=legacyMaskMargin(context.preferences.contourImperfection,512).safe;};refresh();const row={node:value as unknown as THREE.Node<'float'>,release:context.trackSharedPaintSettingsRefresh(refresh)};margins.set(context,row);return row.node;};
 const read=(row:THREE.Node<'int'>)=>metadataTexel(texture,ivec2(row.mod(WIDTH),row.div(WIDTH)));
 const point=(face:number,uv:Vec2):Vec2=>{const at=face*ROWS*4;return[data[at]!*uv[0]+data[at+1]!*uv[1]+data[at+2]!,data[at+3]!*uv[0]+data[at+4]!*uv[1]+data[at+5]!];};
 return{data,texture,cpuBytes:data.byteLength,gpuBytes:data.byteLength,maskedFaces:assigned.size,point,
  node(context,raw,profile,face,atlasUv,probe){if(closed)throw Error('Tree fallback mask owner retired');const original=context.faceCoverageNode(raw,profile),margin=marginFor(context),atlas=varying(atlasUv,'v_resourceMaskAtlasUv'),coordinate=probe==='x'?atlas.add(atlas.dFdx()):probe==='y'?atlas.add(atlas.dFdy()):atlas,flatFace=varying(face,'v_surfaceStrokeFace').setInterpolation('flat','first');return Fn(()=>{const first=int(flatFace).mul(ROWS),a=read(first),b=read(first.add(1)),result=float(1).toVar(),originalCoverage=float(0).toVar(),maskUv=vec2(0).toVar();originalCoverage.assign(original);maskUv.assign(coordinate);If(b.z.greaterThan(0),()=>{const p=vec2(maskUv.x.mul(a.x).add(maskUv.y.mul(a.y)).add(a.z),maskUv.x.mul(a.w).add(maskUv.y.mul(b.x)).add(b.y)),edges=Array.from({length:6},(_,i)=>read(first.add(2+i)));result.assign(legacyCoverageFromInputs({point:p,info:vec2(b.z,b.w),edges,fill:context.contour,margin,size:512,sample:coords=>context.faceCoverageNode(coords,profile,true)}));}).Else(()=>{result.assign(originalCoverage);});return result;})();},
  dispose(){if(closed)return;for(const[c,row]of margins){row.release();margins.delete(c);}texture.dispose();closed=true;},
 };
}
