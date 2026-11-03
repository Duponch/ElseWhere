/** PRIVATE baker contracts prepared only. No tests/GPU executed by author. */
import {test,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileBakedCharts} from '../src/render/origami/baked/charts';
import {compileSourceInk,bakeColourAtlas,sampleBodyLinear,sourceEotf,sourceStrokeAlpha,preparePaintProfileMips,sampleFilteredBodyLinear,atlasUvJacobian,sourceTextureLod,type PaintProfilePixels,type AtlasPaintSource} from '../src/render/origami/baked/baker';
import {createOrigamiBrushGeometry,updateOrigamiBrushGeometry} from '../src/render/origami/brush-geometry';

function pixels(pigment:readonly number[],paper:readonly number[]=pigment,coverage=255):PaintProfilePixels{return{pigment:new Uint8Array(Array.from({length:4},()=>[...pigment,255]).flat()),paper:new Uint8Array(Array.from({length:4},()=>[...paper,255]).flat()),coverage:new Uint8Array(4).fill(coverage),orientation:'upload-bottom-up'};}
function profile(g:THREE.BufferGeometry,id=1){g.setAttribute('paintProfile',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(id),1));return g;}
function charts(g:THREE.BufferGeometry){return compileBakedCharts(g,{texelsPerUnit:64,paddingTexels:2,mipLevels:1,maxAtlasSize:512,maxAtlasPixels:512*512,maxOutputBytes:8*1024*1024});}
const settings=(readProfile:AtlasPaintSource['readProfile'],lineOpacity=.79):AtlasPaintSource=>({readProfile,profile:{attribute:'paintProfile',component:0},edgeAlpha:{data:new Uint8Array([0,255,0,255]),width:1,height:1},brushColorLinear:[0,0,0],lineOpacity,strokeImperfection:.15});
function values(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute){const result=[];for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++)result.push(a.getComponent(i,c));return result;}

test('body follows Source encoded-sRGB mix, not a linear red/blue interpolation',()=>{
 const source=pixels([255,0,0],[0,0,255],128),actual=sampleBodyLinear(source,.25,.25,[1,0,1]);
 expect(actual[0]).toBeCloseTo((128/255*.9478672986+.0521327014)**2.4,12);expect(actual[1]).toBe(0);expect(actual[2]).toBeCloseTo((127/255*.9478672986+.0521327014)**2.4,12);
 expect(Math.abs(actual[0]-.5)).toBeGreaterThan(.25);expect(sourceEotf(.5)).toBeCloseTo(.2140411405,8);
});

test('sRGB texels decode before bilinear filtering; pigment repeats while paper/coverage clamp with upload row0 at UVv0',()=>{
 const p=pixels([0,0,0]);p.pigment.set([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
 const close=(a:readonly number[],b:readonly number[])=>a.forEach((v,i)=>expect(v).toBeCloseTo(b[i]!,12));close(sampleBodyLinear(p,.25,.25,[1,0,1]),[1,0,0]);close(sampleBodyLinear(p,1.25,.25,[1,0,1]),[1,0,0]);close(sampleBodyLinear(p,.25,.75,[1,0,1]),[0,0,1]);
 const mid=sampleBodyLinear(p,.5,.25,[1,0,1]);expect(mid[0]).toBeCloseTo(.5,4);expect(mid[1]).toBeCloseTo(.5,4);expect(mid[2]).toBe(0);
 p.coverage.fill(0);p.paper.set(p.pigment);close(sampleBodyLinear(p,-100,-100,[1,0,1]),[1,0,0]);close(sampleBodyLinear(p,100,100,[1,0,1]),[1,1,1]);
});

test('UV-to-atlas footprint prefilters a minified checker in linear light instead of sampling aliased level0; pigment uses its own metric',()=>{
 const size=16,p:PaintProfilePixels={pigment:new Uint8Array(size*size*4),paper:new Uint8Array(size*size*4),coverage:new Uint8Array(size*size).fill(255),orientation:'upload-bottom-up'};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const colour=(x+y)%2?255:0;for(let c=0;c<3;c++){p.pigment[(y*size+x)*4+c]=colour;p.paper[(y*size+x)*4+c]=colour;}p.pigment[(y*size+x)*4+3]=p.paper[(y*size+x)*4+3]=255;}
 const j=atlasUvJacobian([0,0,2,0,0,2],[[0,0],[1,0],[0,1]]),prepared=preparePaintProfileMips(p),u=.5/size,v=.5/size;
 expect(j).toEqual([.5,0,0,.5]);expect(sourceTextureLod(j,size,size)).toBe(3);expect(sourceTextureLod([1/64,0,0,1/64],size,size)).toBe(0);
 expect(sourceTextureLod([1/64,0,0,1/64],size,size,[8,0,1])).toBe(1);expect(sourceTextureLod([Math.SQRT2/16,0,0,Math.SQRT2/16],size,size)).toBeCloseTo(.5,12);
 expect(prepared.pigment.levels[1]!.data[0]).toBe(188);expect(sampleBodyLinear(p,u,v,[1,0,1])[0]).toBe(0);
 const filtered=sampleFilteredBodyLinear(prepared,u,v,[1,0,1],j);for(const channel of filtered)expect(channel).toBeCloseTo(.5,2);
 const magnified=sampleFilteredBodyLinear(prepared,u,v,[1,0,1],[1/64,0,0,1/64]);expect(magnified).toEqual(sampleBodyLinear(p,u,v,[1,0,1]));
 // Real bake regression: a half-source-texel shift makes all four atlas
 // samples land on black checker texels in V1 rather than the area average.
 const source=profile(new THREE.PlaneGeometry(.125,.125).toNonIndexed()),raw=source.getAttribute('uv');for(let i=0;i<raw.count;i++)raw.setXY(i,raw.getX(i)+u,raw.getY(i)+v);
 const plan=compileBakedCharts(source,{texelsPerUnit:16,paddingTexels:1,mipLevels:1,maxAtlasSize:32,maxAtlasPixels:1024,maxOutputBytes:1024*1024,maxTriangles:10}),ink=compileSourceInk(plan,[],{edgeWidth:1.7,strokeImperfection:.15});
 try{const baked=bakeColourAtlas(plan,settings(()=>p,0),ink);expect(baked.stats.maxSourceLod).toBeGreaterThanOrEqual(3);for(const chart of plan.charts)for(let y=chart.content.y;y<chart.content.y+chart.content.height;y++)for(let x=chart.content.x;x<chart.content.x+chart.content.width;x++)expect(baked.data[(y*baked.width+x)*4]).toBe(188);
  expect(()=>bakeColourAtlas(plan,settings(()=>p,0),ink,{maxScratchBytes:Number(baked.stats.scratchBytes)-1})).toThrow(/source mip memory budget/);
 }finally{ink.dispose();plan.geometry.dispose();source.dispose();}
 // Coverage is linear R8: its mip is128, not SRGB188, before the original encoded-sRGB body mix.
 p.coverage.set(Array.from({length:size*size},(_,i)=>((i%size)+Math.floor(i/size))%2?255:0));
 for(let i=0;i<size*size;i++){p.pigment.set([255,0,0,255],i*4);p.paper.set([0,0,255,255],i*4);}const maskPrepared=preparePaintProfileMips(p);expect(maskPrepared.coverage.levels[1]!.data[0]).toBe(128);
 const mixed=sampleFilteredBodyLinear(maskPrepared,u,v,[1,0,1],j);expect(mixed[0]).toBeCloseTo(sourceEotf(128/255),8);expect(mixed[2]).toBeCloseTo(sourceEotf(127/255),8);
});

test('provenance adapter preserves the exact actual Source ribbons, attributes, stride, index order and geometry inputs',()=>{
 const source=profile(new THREE.BoxGeometry(1,1,1).toNonIndexed()),plan=charts(source),before=values(source.getAttribute('position')),expected=createOrigamiBrushGeometry(source);updateOrigamiBrushGeometry(expected,1.7,.15);
 const ink=compileSourceInk(plan,[{geometry:source,sourceTriangleOffset:0}],{edgeWidth:1.7,strokeImperfection:.15});
 try{
  expect(ink.geometries).toHaveLength(1);const actual=ink.geometries[0]!;expect(Object.keys(actual.attributes)).toEqual(Object.keys(expected.attributes));
  for(const name of Object.keys(expected.attributes)){expect(values(actual.getAttribute(name))).toEqual(values(expected.getAttribute(name)));const a=actual.getAttribute(name),b=expected.getAttribute(name);expect(a instanceof THREE.InterleavedBufferAttribute&&a.data.stride).toBe(b instanceof THREE.InterleavedBufferAttribute&&b.data.stride);}
  expect(Array.from(actual.index!.array)).toEqual(Array.from(expected.index!.array));expect(ink.triangleCount).toBe(expected.index!.count/3);expect(actual.hasAttribute('uvBakedSourceTriangle')).toBe(false);expect(values(source.getAttribute('position'))).toEqual(before);
  for(let i=0;i<ink.triangleCount;i++)expect(ink.chartIds[i]).toBe(plan.triangleChart[ink.bodyTriangles[i]!]!);expect(Array.from(ink.pigmentMetric).every(Number.isFinite)).toBe(true);
 }finally{ink.dispose();ink.dispose();expected.dispose();plan.geometry.dispose();source.dispose();}
});

test('hidden eye triangles are filtered AFTER full Source edge generation, retaining visible edge seeds and original index values',()=>{
 const source=new THREE.BufferGeometry();source.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,2,0,0,3,0,0,2,1,0],3));source.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],3));source.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],2));source.setAttribute('eyeMark',new THREE.Float32BufferAttribute([1,1,1,0,0,0],1));profile(source);
 const body=source.clone();body.setIndex([3,4,5]);const plan=charts(body),expected=createOrigamiBrushGeometry(source);updateOrigamiBrushGeometry(expected,1.7,.15);
 const ink=compileSourceInk(plan,[{geometry:source,sourceTriangleOffset:0,sourceTriangleToBodyTriangle:new Uint32Array([0xffffffff,0])}],{edgeWidth:1.7,strokeImperfection:.15});
 try{const visible=[];for(let at=0;at<expected.index!.count;at+=3){const a=expected.index!.getX(at);if(expected.getAttribute('eyeMark').getX(a)===0)visible.push(a,expected.index!.getX(at+1),expected.index!.getX(at+2));}
  expect(Array.from(ink.geometries[0]!.index!.array)).toEqual(visible);expect(ink.stats.hiddenInkTriangles).toBeGreaterThan(0);expect(ink.triangleCount).toBe(visible.length/3);for(const name of Object.keys(expected.attributes))expect(values(ink.geometries[0]!.getAttribute(name))).toEqual(values(expected.getAttribute(name)));
 }finally{ink.dispose();expected.dispose();plan.geometry.dispose();body.dispose();source.dispose();}
});

test('opaque atlas uses real ink opacity and per-chart padding, keeping borrowed P/K/M bytes unchanged',()=>{
 const source=profile(new THREE.PlaneGeometry(1,1).toNonIndexed()),plan=charts(source),ink=compileSourceInk(plan,[{geometry:source,sourceTriangleOffset:0}],{edgeWidth:5,strokeImperfection:.15}),white=pixels([255,255,255]),read=vi.fn(()=>white),paint=settings(read),before=Array.from(white.pigment);
 try{
  const alpha=sourceStrokeAlpha(.5,.5,paint.edgeAlpha,.79,.15);expect(alpha).toBeCloseTo(.79,12);expect(sourceStrokeAlpha(.5,0,paint.edgeAlpha,.79,.15)).toBe(0);expect(sourceStrokeAlpha(.5,1,paint.edgeAlpha,.79,.15)).toBe(0);
  const baked=bakeColourAtlas(plan,paint,ink);expect(baked.width*baked.height*4).toBe(baked.data.length);for(let i=3;i<baked.data.length;i+=4)expect(baked.data[i]).toBe(255);expect(baked.stats.inkFragments).toBeGreaterThan(0);expect(baked.stats.paddedPixels).toBeGreaterThan(0);expect(baked.stats.scratchBytes).toBeLessThanOrEqual(32*1024*1024);
  expect(baked.data.some((v,i)=>i%4!==3&&v<250)).toBe(true);expect(Array.from(white.pigment)).toEqual(before);expect(read).toHaveBeenCalledTimes(2);
  const noInk=bakeColourAtlas(plan,settings(()=>white,0),ink);for(const chart of plan.charts)for(let y=chart.rect.y;y<chart.rect.y+chart.rect.height;y++)for(let x=chart.rect.x;x<chart.rect.x+chart.rect.width;x++){const p=(y*noInk.width+x)*4;expect(Array.from(noInk.data.subarray(p,p+4))).toEqual([255,255,255,255]);}
 }finally{ink.dispose();plan.geometry.dispose();source.dispose();}
});

test('atlas/scratch/ink triangle budgets refuse before profile reads or mutation; disposed ink cannot be sampled',()=>{
 const source=profile(new THREE.PlaneGeometry(1,1).toNonIndexed()),plan=charts(source),ink=compileSourceInk(plan,[],{edgeWidth:1.7,strokeImperfection:.15}),read=vi.fn(()=>pixels([255,255,255])),before=values(source.getAttribute('position'));
 try{expect(()=>bakeColourAtlas(plan,settings(read),ink,{maxAtlasBytes:1})).toThrow(/budget/);expect(()=>bakeColourAtlas(plan,settings(read),ink,{maxScratchBytes:1})).toThrow(/budget/);expect(read).not.toHaveBeenCalled();expect(()=>compileSourceInk(plan,[{geometry:source,sourceTriangleOffset:0}],{edgeWidth:1.7,strokeImperfection:.15,maxTriangles:1})).toThrow(/BEFORE/);expect(values(source.getAttribute('position'))).toEqual(before);ink.dispose();expect(()=>bakeColourAtlas(plan,settings(read),ink)).toThrow(/disposed/);
 }finally{ink.dispose();plan.geometry.dispose();source.dispose();}
});
