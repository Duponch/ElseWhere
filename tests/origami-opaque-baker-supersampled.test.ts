/** Prepared only. No tests/build/Native run by this author. V2 remains frozen. */
import {test,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileBakedCharts,type BakedChartSet} from '../src/render/origami/baked/charts';
import {compileSourceInk,bakeColourAtlas,type BakedInk,type AtlasPaintSource,type PaintProfilePixels} from '../src/render/origami/baked/baker';
import {bakeColourAtlasSupersampled} from '../src/render/origami/baked/baker-supersampled';
const white=():PaintProfilePixels=>({pigment:new Uint8Array(16).fill(255),paper:new Uint8Array(16).fill(255),coverage:new Uint8Array(4).fill(255),orientation:'upload-bottom-up'});
function plane(density:number){const source=new THREE.PlaneGeometry(1,1).toNonIndexed();source.setAttribute('paintProfile',new THREE.Float32BufferAttribute(new Float32Array(6).fill(1),1));const charts=compileBakedCharts(source,{texelsPerUnit:density,paddingTexels:2,mipLevels:1,maxAtlasSize:128,maxAtlasPixels:128*128,maxOutputBytes:1024*1024,maxTriangles:10});return{source,charts};}
const paint=(readProfile:AtlasPaintSource['readProfile'],lineOpacity=1,tint:readonly[number,number,number]=[0,0,0]):AtlasPaintSource=>({readProfile,profile:{attribute:'paintProfile',component:0},edgeAlpha:{data:new Uint8Array([0,255,0,255]),width:1,height:1},brushColorLinear:tint,lineOpacity,strokeImperfection:0});
function contentColours(charts:BakedChartSet,data:Uint8Array,width:number){const values:number[][]=[];for(const chart of charts.charts){const r=chart.content;for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){const at=(y*width+x)*4;values.push(Array.from(data.subarray(at,at+4)));}}return values;}

/** Synthetic exact quads isolate ordering/shared-edge ownership, while the
 * first contract uses the actual Source ribbon factory and width. */
function fullQuads(charts:BakedChartSet,colourUvs:readonly number[]):BakedInk{
 if(charts.charts.length!==1)throw Error('Contract requires one chart');const r=charts.charts[0]!.content,xy:number[]=[],uv:number[]=[],metric:number[]=[];
 for(const u of colourUvs)for(const tri of [[[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height]],[[r.x,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]]]){for(const p of tri){xy.push(...p);uv.push(u,.5);}metric.push(1,0,1);}
 const n=colourUvs.length*2;return{geometries:[],triangleCount:n,chartIds:new Uint32Array(n),bodyTriangles:new Uint32Array(n),pixelXY:new Float64Array(xy),rawUv:new Float64Array(uv),pigmentMetric:new Float64Array(metric),disposed:false,stats:{scope:'Contract quads only'},dispose(){}};
}

test('a true Source strip0.32texel wide missed by V2 is integrated by quarter-position samples without increasing atlas density',()=>{
 const {source,charts}=plane(32),ink=compileSourceInk(charts,[{geometry:source,sourceTriangleOffset:0}],{edgeWidth:1.25,strokeImperfection:0}),pixels=white(),p=paint(()=>pixels),before=Array.from(charts.geometry.getAttribute('bakedUv').array);
 try{const v2=bakeColourAtlas(charts,p,ink),v3=bakeColourAtlasSupersampled(charts,p,ink);expect(v2.stats.inkFragments).toBe(0);expect(contentColours(charts,v2.data,v2.width).every(c=>c[0]===255)).toBe(true);
  expect(v3.stats.inkFragments).toBeGreaterThan(0);expect(contentColours(charts,v3.data,v3.width).some(c=>c[0]!>0&&c[0]!<250)).toBe(true);expect([v3.width,v3.height,v3.data.length]).toEqual([v2.width,v2.height,v2.data.length]);expect(Array.from(charts.geometry.getAttribute('bakedUv').array)).toEqual(before);
  expect(v3.stats).toMatchObject({workingScale:2,samplesPerTexel:4,targetTexelsPerUnit:32,workingTexelsPerUnit:64});expect(Number(v3.stats.scratchBytes)).toBeLessThanOrEqual(32*1024*1024);
 }finally{ink.dispose();charts.geometry.dispose();source.dispose();}
});

test('each of four body/ink samples has one shared-triangle owner; ordered translucent strokes compose before linear resolve',()=>{
 const {source,charts}=plane(8),body=white(),generic=white();generic.pigment.set([255,0,0,255,0,0,255,255,255,0,0,255,0,0,255,255]);
 const p=paint(id=>id===0?generic:body,.5,[1,1,1]),forward=fullQuads(charts,[.25,.75]),reverse=fullQuads(charts,[.75,.25]);
 try{const a=bakeColourAtlasSupersampled(charts,p,forward),b=bakeColourAtlasSupersampled(charts,p,reverse),area=charts.charts[0]!.content.width*charts.charts[0]!.content.height;
  expect(a.stats.bodyFragments).toBe(area*4);expect(a.stats.resolvedBodySamples).toBe(area*4);expect(a.stats.inkFragments).toBe(area*4*2);
  for(const c of contentColours(charts,a.data,a.width))expect(c).toEqual([188,137,225,255]);for(const c of contentColours(charts,b.data,b.width))expect(c).toEqual([225,137,188,255]);
  // The Source threshold is applied to every working fragment, before blend.
  const discarded=bakeColourAtlasSupersampled(charts,paint(id=>id===0?generic:body,.012,[1,1,1]),forward);expect(discarded.stats.inkFragments).toBe(0);expect(contentColours(charts,discarded.data,discarded.width).every(c=>c[0]===255)).toBe(true);
 }finally{forward.dispose();reverse.dispose();charts.geometry.dispose();source.dispose();}
});

test('working4x plus linear resolve and mip caches are admitted inside the scratch budget before allocation',()=>{
 const {source,charts}=plane(8),ink=compileSourceInk(charts,[],{edgeWidth:1,strokeImperfection:0}),pixels:PaintProfilePixels={pigment:new Uint8Array(16*16*4).fill(255),paper:new Uint8Array(16*16*4).fill(255),coverage:new Uint8Array(16*16).fill(255),orientation:'upload-bottom-up'},read=vi.fn(()=>pixels);
 try{const result=bakeColourAtlasSupersampled(charts,paint(read),ink),v2=bakeColourAtlas(charts,paint(read),ink),largest=Math.max(...charts.charts.map(c=>c.rect.width*c.rect.height)),base=largest*69+Number(result.stats.metadataBytes)+256*8;
  expect(v2.stats.maxSourceLod).toBe(1);expect(result.stats.maxSourceLod).toBe(0);
  expect(result.stats.rasterScratchBytes).toBe(base);expect(result.stats.scratchBytes).toBe(base+Number(result.stats.sourceMipBytes));read.mockClear();
  expect(()=>bakeColourAtlasSupersampled(charts,paint(read),ink,{maxScratchBytes:base-1})).toThrow(/memory budget/);expect(read).not.toHaveBeenCalled();
 }finally{ink.dispose();charts.geometry.dispose();source.dispose();}
});
