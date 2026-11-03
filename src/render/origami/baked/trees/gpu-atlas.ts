/** Exclusive tree-atlas preparation derived from the qualified poplar V27 kernel. Animals keep their independent compiler. No all-species visual/performance admission. */
import {attachLegacyMaskAttributes,legacyCoverageNode,compileLegacyFaceMasks,legacyMaskMargin} from './face-mask';
/** GPU colour-atlas preparation. No World/fixture, no new GPU device,
 * no readback and no runtime shader change. Caller must own an EXCLUSIVE render
 * preparation lease across all awaits and keep borrowed paint/ink stable.
 * Native orientation, half-float rounding, edge padding and timing UNQUALIFIED.
 */
import * as THREE from 'three/webgpu';
import {Fn,If,Discard,attribute,varying,texture,textureLoad,vec2,vec3,vec4,ivec2,float,int,mix,smoothstep} from 'three/tsl';
import type {BakedChartSet} from '../charts';
import type {BakedInk,AtlasPaintSource,PaintProfilePixels} from '../baker';

export interface GpuAtlasLimits {levels:number;maxCpuBytes:number;maxGpuBytes:number;maxTextureSize:number}
export interface GpuAtlasPaintSource {readProfile:AtlasPaintSource['readProfile'];edgeAlpha:AtlasPaintSource['edgeAlpha'];lineOpacity:number;strokeImperfection:number;brushColorLinear:readonly[number,number,number]}
export interface GpuAtlasPlan {width:number;height:number;levels:number;workingScale:2;dilationPasses:number;cpuBytes:number;peakGpuBytes:number;retainedGpuBytes:number;geometryBytes:number;compactProfileIds:readonly number[];paletteSize:number;compactCpuBytes:number;compactGpuBytes:number;alphaGpuBytes:number}
export interface GpuAtlasResult {texture:THREE.Texture;plan:GpuAtlasPlan;cpuBytes:number;gpuBytes:number;stats:Readonly<Record<string,unknown>>;dispose():void}
const running=new WeakSet<THREE.WebGPURenderer>();
const integer=(v:number,min:number,name:string)=>{if(!Number.isSafeInteger(v)||v<min)throw Error('GPU atlas: invalid '+name);return v;};
const fullMipBytes=(width:number,height:number,channels:number)=>{let total=0;for(;;){total+=width*height*channels;if(width===1&&height===1)return total;width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));}};
function borrowedProfiles(ids:readonly number[],readProfile:AtlasPaintSource['readProfile']){
 const sorted=[...new Set([0,...ids])].sort((a,b)=>a-b);if(sorted.length>256||sorted.some(id=>!Number.isSafeInteger(id)||id<0))throw Error('GPU atlas: compact profile identity/layer cap refused');
 const profiles=new Map<number,PaintProfilePixels>();let size=0;
 for(const id of sorted){const p=readProfile(id),s=Math.sqrt(p.coverage.length);if(!Number.isSafeInteger(s)||s<1||p.orientation!=='upload-bottom-up'||p.pigment.length!==s*s*4||p.paper.length!==s*s*4||size&&size!==s)throw Error('GPU atlas: exact matching borrowed P/K/M pixels required');size=s;profiles.set(id,p);}
 return{ids:sorted,profiles,size,cpuBytes:size*size*8*sorted.length,gpuBytes:fullMipBytes(size,size,8)*sorted.length};
}
export interface PackedCompactGpuPalette {ids:readonly number[];size:number;pigment:Uint8Array;paperCoverage:Uint8Array;cpuBytes:number;gpuBytes:number}
/** Copies ONLY the admitted profiles. P is byte-exact RGBA; KM is exact paper
 * RGB with exact linear coverage in A. SRGB sampling never transforms alpha. */
export function packCompactGpuPalette(ids:readonly number[],readProfile:AtlasPaintSource['readProfile'],maxCpuBytes:number):PackedCompactGpuPalette{
 const source=borrowedProfiles(ids,readProfile);integer(maxCpuBytes,1,'compact CPU cap');if(source.cpuBytes>maxCpuBytes)throw Error('GPU atlas: compact CPU budget refused BEFORE pixel allocation');
 const layerBytes=source.size*source.size*4,pigment=new Uint8Array(source.cpuBytes/2),paperCoverage=new Uint8Array(source.cpuBytes/2);
 source.ids.forEach((id,layer)=>{const p=source.profiles.get(id)!;pigment.set(p.pigment,layer*layerBytes);for(let pixel=0;pixel<p.coverage.length;pixel++){const at=layer*layerBytes+pixel*4;paperCoverage[at]=p.paper[pixel*4]!;paperCoverage[at+1]=p.paper[pixel*4+1]!;paperCoverage[at+2]=p.paper[pixel*4+2]!;paperCoverage[at+3]=p.coverage[pixel]!;}});
 return{ids:source.ids,size:source.size,pigment,paperCoverage,cpuBytes:source.cpuBytes,gpuBytes:source.gpuBytes};
}
function compactSources(charts:BakedChartSet,profile:AtlasPaintSource['profile'],paint:GpuAtlasPaintSource){
 const attr=charts.geometry.getAttribute(profile.attribute),ids:number[]=[];if(!attr||!Number.isSafeInteger(profile.component)||profile.component<0||profile.component>=attr.itemSize)throw Error('GPU atlas: paint attribute missing');
 for(const t of charts.triangles){const id=attr.getComponent(t.outputVertices[0],profile.component);if(!Number.isSafeInteger(id)||id<0||t.outputVertices.some(v=>attr.getComponent(v,profile.component)!==id))throw Error('GPU atlas: nonconstant paint profile');ids.push(id);}
 const edge=paint.edgeAlpha;integer(edge.width,1,'alpha width');integer(edge.height,1,'alpha height');if(edge.data.length!==edge.width*edge.height*4)throw Error('GPU atlas: borrowed alpha pixels incomplete');
 if([paint.lineOpacity,paint.strokeImperfection,...paint.brushColorLinear].some(v=>!Number.isFinite(v))||paint.lineOpacity<0||paint.lineOpacity>1||paint.strokeImperfection<0||paint.strokeImperfection>1)throw Error('GPU atlas: source controls refused');
 return borrowedProfiles(ids,paint.readProfile);
}

/** All render targets/geometry have a fixed declared ceiling BEFORE allocation.
 * Compact palette copies/mips ARE included; global CPU source views are borrowed,
 * never bound/uploaded. Existing renderer/driver allocations are not inventoried. */
export function planTreeGpuAtlas(charts:BakedChartSet,ink:BakedInk,profile:AtlasPaintSource['profile'],paint:GpuAtlasPaintSource,limits:GpuAtlasLimits):GpuAtlasPlan{
 compileLegacyFaceMasks(charts); // Domain/topology refusal BEFORE any GPU allocation.
 const width=integer(charts.atlas.width,1,'width'),height=integer(charts.atlas.height,1,'height'),levels=integer(limits.levels,1,'levels');
 for(const name of ['maxCpuBytes','maxGpuBytes','maxTextureSize'] as const)integer(limits[name],1,name);
 const quantum=2**(levels-1);if(levels>5||width*2>limits.maxTextureSize||height*2>limits.maxTextureSize||width%quantum||height%quantum||charts.atlas.paddingTexels<quantum||ink.disposed)throw Error('GPU atlas: size/mip/gutter admission refused');
 for(const c of charts.charts){const r=c.rect;if(r.x%quantum||r.y%quantum||r.width%quantum||r.height%quantum||r.x<0||r.y<0||r.x+r.width>width||r.y+r.height>height)throw Error('GPU atlas: chart rectangle isolation refused');}
 const compact=compactSources(charts,profile,paint);if(compact.size>limits.maxTextureSize||paint.edgeAlpha.width>limits.maxTextureSize||paint.edgeAlpha.height>limits.maxTextureSize)throw Error('GPU atlas: compact source texture size refused');
 const alphaGpuBytes=fullMipBytes(paint.edgeAlpha.width,paint.edgeAlpha.height,4),pixels=width*height,geometryBytes=charts.triangles.length*3*156+ink.triangleCount*3*28+charts.charts.length*6*36+6*20;
 let retainedGpuBytes=0;for(let l=0;l<levels;l++)retainedGpuBytes+=(width/2**l)*(height/2**l)*4;
 // Linear16F working2x(32N), two target-size16F ping-pong(16N), final
 // SRGB8 finite chain, and one SRGB8 mip scratch <=N. No hidden MSAA buffer.
 const peakGpuBytes=pixels*49+retainedGpuBytes+geometryBytes+compact.gpuBytes+alphaGpuBytes,cpuBytes=geometryBytes*4+levels*64+compact.cpuBytes+charts.charts.length*3*1024;
 if(!Number.isSafeInteger(peakGpuBytes)||cpuBytes>limits.maxCpuBytes||peakGpuBytes>limits.maxGpuBytes)throw Error('GPU atlas: peak budget refused BEFORE geometry/render targets');
 return Object.freeze({width,height,levels,workingScale:2,dilationPasses:2*quantum,cpuBytes,peakGpuBytes,retainedGpuBytes,geometryBytes,compactProfileIds:Object.freeze(compact.ids),paletteSize:compact.size,compactCpuBytes:compact.cpuBytes,compactGpuBytes:compact.gpuBytes,alphaGpuBytes});
}
function geometry(position:number[],uv:number[],extra:Record<string,{data:number[];size:number}>={}):THREE.BufferGeometry{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('bakeUv',new THREE.Float32BufferAttribute(uv,2));
 for(const [name,a]of Object.entries(extra))g.setAttribute(name,new THREE.Float32BufferAttribute(a.data,a.size));return g;
}
/** WebGPU viewport rows run top-down. Explicit clipY=1-2v makes RT row0==UVv0,
 * matching borrowed upload-order pixels. A four-corner Native proof is required. */
function clip(u:number,v:number):number[]{return[u*2-1,1-v*2,.5];}
function fullQuad():THREE.BufferGeometry{const uv=[0,0,1,0,1,1,0,0,1,1,0,1];return geometry(Array.from({length:6},(_,i)=>clip(uv[i*2]!,uv[i*2+1]!)).flat(),uv);}
function chartQuads(charts:BakedChartSet):THREE.BufferGeometry{
 const position:number[]=[],uv:number[]=[],bounds:number[]=[];const {width,height}=charts.atlas;
 for(const c of charts.charts){const r=c.rect,min=[r.x,r.y],max=[r.x+r.width-1,r.y+r.height-1];
  for(const [x,y]of [[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]]){const u=x!/width,v=y!/height;position.push(...clip(u,v));uv.push(u,v);bounds.push(...min,...max);}
 }return geometry(position,uv,{bakeBounds:{data:bounds,size:4}});
}
export function createTreeBodyGeometry(charts:BakedChartSet,profile:AtlasPaintSource['profile'],layers:ReadonlyMap<number,number>):THREE.BufferGeometry{
 const position:number[]=[],raw:number[]=[],pigment:number[]=[],ids:number[]=[],base:number[]=[],source=charts.geometry,uv=source.getAttribute('bakedUv'),paint=source.getAttribute(profile.attribute),color=source.getAttribute('color');
 if(!paint||profile.component<0||profile.component>=paint.itemSize)throw Error('GPU atlas: paint attribute missing');
 for(const t of charts.triangles){const id=paint.getComponent(t.outputVertices[0],profile.component);if(!Number.isSafeInteger(id)||id<0||t.outputVertices.some(v=>paint.getComponent(v,profile.component)!==id))throw Error('GPU atlas: nonconstant paint profile');
  const layer=layers.get(id);if(layer===undefined)throw Error('GPU atlas: virtual profile missing from compact palette');
  for(let c=0;c<3;c++){const v=t.outputVertices[c]!,u=t.rawUv[c]![0],w=t.rawUv[c]![1],m=t.pigmentMetric;position.push(...clip(uv.getX(v),uv.getY(v)));raw.push(u,w);pigment.push(u*m[0]+w*m[1],w*m[2]);ids.push(layer);base.push(id===0&&color?color.getX(v):1,id===0&&color?color.getY(v):1,id===0&&color?color.getZ(v):1);}
 }return attachLegacyMaskAttributes(geometry(position,raw,{bakePigmentUv:{data:pigment,size:2},bakeProfile:{data:ids,size:1},bakeBase:{data:base,size:3}}),charts);
}
function inkGeometry(charts:BakedChartSet,ink:BakedInk):THREE.BufferGeometry{
 const position:number[]=[],raw:number[]=[],pigment:number[]=[];
 for(let t=0;t<ink.triangleCount;t++)for(let c=0;c<3;c++){const at=t*6+c*2,u=ink.rawUv[at]!,v=ink.rawUv[at+1]!,m=t*3;position.push(...clip(ink.pixelXY[at]!/charts.atlas.width,ink.pixelXY[at+1]!/charts.atlas.height));raw.push(u,v);pigment.push(u*ink.pigmentMetric[m]!+v*ink.pigmentMetric[m+1]!,v*ink.pigmentMetric[m+2]!);}
 return geometry(position,raw,{bakePigmentUv:{data:pigment,size:2}});
}
function material(fragment:THREE.Node<'vec4'>,transparent=false):THREE.MeshBasicNodeMaterial{
 const m=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,transparent,side:THREE.DoubleSide,toneMapped:false,fog:false});m.vertexNode=vec4(attribute('position','vec3'),1);m.fragmentNode=fragment;return m;
}
function scene(g:THREE.BufferGeometry,m:THREE.NodeMaterial):THREE.Scene{const s=new THREE.Scene(),mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;s.add(mesh);return s;}
function target(width:number,height:number,linear=true):THREE.RenderTarget{
 const t=new THREE.RenderTarget(width,height,{type:linear?THREE.HalfFloatType:THREE.UnsignedByteType,format:THREE.RGBAFormat,colorSpace:linear?THREE.NoColorSpace:THREE.SRGBColorSpace,depthBuffer:false,stencilBuffer:false,samples:0,generateMipmaps:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});t.texture.flipY=false;return t;
}
const pixel=(width:number,height:number)=>ivec2(varying(attribute('bakeUv','vec2')).mul(vec2(width,height)));
function sourceArray(data:Uint8Array,size:number,depth:number,repeat:boolean):THREE.DataArrayTexture{
 const t=new THREE.DataArrayTexture(data,size,size,depth);t.format=THREE.RGBAFormat;t.type=THREE.UnsignedByteType;t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.wrapS=t.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
// Literal algebra from installed r186 ColorSpaceFunctions.js. Both transfer
// curves are required: filtered linear samples mix in Source's encoded sRGB.
// Float0/1 conversion preserves each boolean branch exactly for finite source
// colors and uses the installed TSL typings' supported vec3 mix overload.
const sourceOetf=(v:THREE.Node<'vec3'>)=>mix(v.pow(.41666).mul(1.055).sub(.055),v.mul(12.92),vec3(v.lessThanEqual(.0031308)));
const sourceEotf=(v:THREE.Node<'vec3'>)=>mix(v.mul(.9478672986).add(.0521327014).pow(2.4),v.mul(.0773993808),vec3(v.lessThanEqual(.04045)));

/** Standalone preparation transaction, never call from an object's update().
 * assertExclusive must also verify the borrowed CPU palette version. No global
 * GraphicsStyleContext, bank shader, metadata texture or palette GPU call exists. */
/** Actual body kernel, also exposed for cold shader contracts. */
export function createTreeBodyPaintNode(p:THREE.DataArrayTexture,km:THREE.DataArrayTexture,raw:THREE.Node<'vec2'>,pigment:THREE.Node<'vec2'>,layer:THREE.Node<'float'>,base:THREE.Node<'vec3'>,fill:number,size:number):THREE.Node<'vec3'>{
 const sampledP=texture(p,pigment).depth(layer).toVar(),sampledKM=texture(km,raw).depth(layer).toVar(),coverage=legacyCoverageNode(km,layer,fill,size);
 return sourceEotf(mix(sourceOetf(sampledKM.rgb),sourceOetf(sampledP.rgb),coverage)).mul(base);
}
export async function prepareTreeGpuAtlas(renderer:THREE.WebGPURenderer,charts:BakedChartSet,ink:BakedInk,profile:AtlasPaintSource['profile'],paint:GpuAtlasPaintSource,limits:GpuAtlasLimits,assertExclusive:()=>void,maskFillImperfection:number,admitPlan?:(plan:GpuAtlasPlan)=>void):Promise<GpuAtlasResult>{
 const plan=planTreeGpuAtlas(charts,ink,profile,paint,limits),backend=renderer.backend,isWebGPU='isWebGPUBackend' in backend&&backend.isWebGPUBackend===true;if(!renderer.initialized||!isWebGPU)throw Error('GPU atlas: prepared WebGPU renderer required');
 legacyMaskMargin(maskFillImperfection,plan.paletteSize);if(running.has(renderer))throw Error('GPU atlas: renderer preparation already active');assertExclusive();
 // The scene cache reserves the actual planned peak, not the maximum for an
 // unrelated large species. A refusal precedes every geometry/RT allocation.
 admitPlan?.(plan);assertExclusive();running.add(renderer);
 const old={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),autoClear:renderer.autoClear,color:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha()};
 // WebGPU updates the camera projection when selecting its coordinate system,
 // even though these passes supply clip-space vertices directly.
 const cleanup:(()=>void)[]=[],own=<T extends {dispose():void}>(v:T):T=>{cleanup.push(()=>v.dispose());return v;},camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);let final:THREE.RenderTarget|undefined,delivered:THREE.RenderTarget|undefined,failure:unknown;
 const render=async(s:THREE.Scene,t:THREE.RenderTarget)=>{assertExclusive();renderer.setRenderTarget(t);await renderer.renderAsync(s,camera);assertExclusive();};
 try{
  renderer.autoClear=true;renderer.setClearColor(0,0);
  const packed=packCompactGpuPalette(plan.compactProfileIds,paint.readProfile,plan.compactCpuBytes);if(packed.size!==plan.paletteSize||packed.gpuBytes!==plan.compactGpuBytes)throw Error('GPU atlas: compact source changed after preflight');
  const p=own(sourceArray(packed.pigment,packed.size,packed.ids.length,true)),km=own(sourceArray(packed.paperCoverage,packed.size,packed.ids.length,false)),layers=new Map(packed.ids.map((id,index)=>[id,index]));
  p.name='GPU bake compact exact pigment';km.name='GPU bake compact exact paper/coverage';
  const edgeAlpha=own(new THREE.DataTexture(paint.edgeAlpha.data,paint.edgeAlpha.width,paint.edgeAlpha.height,THREE.RGBAFormat));edgeAlpha.name='GPU bake compact alpha (borrowed CPU bytes)';edgeAlpha.colorSpace=THREE.NoColorSpace;edgeAlpha.flipY=false;edgeAlpha.wrapS=THREE.RepeatWrapping;edgeAlpha.wrapT=THREE.ClampToEdgeWrapping;edgeAlpha.magFilter=THREE.LinearFilter;edgeAlpha.minFilter=THREE.LinearMipmapLinearFilter;edgeAlpha.generateMipmaps=true;edgeAlpha.needsUpdate=true;
  const work=own(target(plan.width*2,plan.height*2)),a=own(target(plan.width,plan.height)),b=own(target(plan.width,plan.height));
  final=target(plan.width,plan.height,false);const output=final;
  // Public allocation metadata: RenderTarget textures do not upload CPU mip
  // arrays (WebGPUTextureUtils650). Textures.getMipLevels uses this finite count.
  output.texture.mipmaps=Array.from({length:plan.levels},(_,l)=>({data:new Uint8Array(0),width:plan.width/2**l,height:plan.height/2**l}));
  output.texture.minFilter=THREE.LinearMipmapLinearFilter;output.texture.magFilter=THREE.LinearFilter;
  const body=own(createTreeBodyGeometry(charts,profile,layers)),strokes=own(inkGeometry(charts,ink)),quads=own(chartQuads(charts)),quad=own(fullQuad());
  const raw=varying(attribute('bakeUv','vec2'),'v_gpuBakeRaw'),pigment=varying(attribute('bakePigmentUv','vec2'),'v_gpuBakePigment'),layer=varying(attribute('bakeProfile','float'),'v_gpuBakeCompactLayer').setInterpolation('flat');
  const base=varying(attribute('bakeBase','vec3'));
  const bodyMat=own(material(vec4(createTreeBodyPaintNode(p,km,raw,pigment,layer,base,maskFillImperfection,plan.paletteSize),1))),sourceScene=scene(body,bodyMat);
  const inkColor=texture(p,pigment).depth(float(layers.get(0)!)).rgb.mul(vec3(...paint.brushColorLinear));
  const inkAlpha=float(paint.lineOpacity).mul(smoothstep(0,.035,raw.y)).mul(float(1).sub(smoothstep(.90,1,raw.y))).mul(mix(float(1),texture(edgeAlpha,raw).level(float(0)).g.mul(.65).add(.35),float(paint.strokeImperfection)));
  const inkMat=own(material(Fn(()=>{Discard(inkAlpha.lessThanEqual(.012));return vec4(inkColor,inkAlpha);})(),true)),inkMesh=new THREE.Mesh(strokes,inkMat);inkMesh.frustumCulled=false;sourceScene.add(inkMesh);
  await render(sourceScene,work);
  const resolveMat=own(material(Fn(()=>{
   const p=pixel(plan.width,plan.height).mul(2),sum=textureLoad(work.texture,p,int(0)).add(textureLoad(work.texture,p.add(ivec2(1,0)),int(0))).add(textureLoad(work.texture,p.add(ivec2(0,1)),int(0))).add(textureLoad(work.texture,p.add(ivec2(1,1)),int(0))).toVar();
   return vec4(sum.rgb.div(sum.a.max(.000001)),sum.a.greaterThan(0).select(1,0));
  })()));await render(scene(quad,resolveMat),a);
  const dilation=(source:THREE.Texture)=>own(material(Fn(()=>{
   const p=pixel(plan.width,plan.height),bounds=varying(attribute('bakeBounds','vec4')).setInterpolation('flat'),lo=bounds.xy,hi=bounds.zw,result=textureLoad(source,p,int(0)).toVar();
   If(result.a.lessThan(.5),()=>{
    // Chart/pixel coordinates <=4096 are exactly representable as f32. Clamp
    // through TSL's supported vec2 overload, then restore integer texel indices.
    const left=textureLoad(source,ivec2(vec2(p.add(ivec2(-1,0))).clamp(lo,hi)),int(0)),right=textureLoad(source,ivec2(vec2(p.add(ivec2(1,0))).clamp(lo,hi)),int(0)),up=textureLoad(source,ivec2(vec2(p.add(ivec2(0,-1))).clamp(lo,hi)),int(0)),down=textureLoad(source,ivec2(vec2(p.add(ivec2(0,1))).clamp(lo,hi)),int(0));
    If(left.a.greaterThan(.5),()=>{result.assign(left);}).ElseIf(right.a.greaterThan(.5),()=>{result.assign(right);}).ElseIf(up.a.greaterThan(.5),()=>{result.assign(up);}).ElseIf(down.a.greaterThan(.5),()=>{result.assign(down);});
   });return result;
  })()));
  const aToB=scene(quads,dilation(a.texture)),bToA=scene(quads,dilation(b.texture));let current=a;
  for(let step=0;step<plan.dilationPasses;step++){const next=current===a?b:a;await render(current===a?aToB:bToA,next);current=next;}
  const finalMat=own(material(vec4(textureLoad(current.texture,pixel(plan.width,plan.height),int(0)).rgb,1)));await render(scene(quad,finalMat),output);
  // Distinct destination avoids sampling a view which also contains the
  // attached mip. Copy only the resulting region into the finite final chain.
  if(plan.levels>1){const mip=own(target(plan.width/2,plan.height/2,false));
   for(let level=1;level<plan.levels;level++){
    const width=plan.width/2**level,height=plan.height/2**level;mip.viewport.set(0,0,width,height);
    const mat=own(material(Fn(()=>{const p=pixel(width,height).mul(2),l=int(level-1);return textureLoad(output.texture,p,l).add(textureLoad(output.texture,p.add(ivec2(1,0)),l)).add(textureLoad(output.texture,p.add(ivec2(0,1)),l)).add(textureLoad(output.texture,p.add(ivec2(1,1)),l)).mul(.25);})()));
    await render(scene(quad,mat),mip);renderer.copyTextureToTexture(mip.texture,output.texture,new THREE.Box2(new THREE.Vector2(0,0),new THREE.Vector2(width,height)),new THREE.Vector2(0,0),0,level);
   }
  }
  assertExclusive();let disposed=false;
  const result:GpuAtlasResult={texture:output.texture,plan,cpuBytes:plan.levels*64,gpuBytes:plan.retainedGpuBytes,stats:Object.freeze({scope:'Compact GPU preparation only, Native unqualified',workingScale:2,sourcePaintBorrowed:true,globalPoolGpuBound:false,globalShaderCalls:false,compactProfileIds:plan.compactProfileIds,compactCpuBytes:plan.compactCpuBytes,compactGpuBytes:plan.compactGpuBytes,sourcePainterCpuCostEliminated:false,readback:false,mipLevels:plan.levels,paddingPasses:plan.dilationPasses,workingFormat:'linear RGBA16F',outputFormat:'RGBA8 sRGB',alphaSampler:'explicit level0 matching CPU V3',orientation:'row0/v0 via clipY=1-2v; corner proof pending',halfFloatRounding:'Native delta pending',timing:'not measured'}),dispose(){if(disposed)return;disposed=true;output.dispose();}};
  delivered=final;final=undefined;return result;
 }catch(error){failure=error;throw error;}finally{
  const failures:unknown[]=[];try{renderer.setRenderTarget(old.target,old.face,old.mip);renderer.autoClear=old.autoClear;renderer.setClearColor(old.color,old.alpha);}catch(error){failures.push(error);}running.delete(renderer);
  for(const dispose of cleanup.reverse())try{dispose();}catch(error){failures.push(error);}if(final)try{final.dispose();}catch(error){failures.push(error);}
  if(failures.length){if(delivered)try{delivered.dispose();}catch(error){failures.push(error);}throw new AggregateError(failure===undefined?failures:[failure,...failures],'GPU atlas preparation cleanup failed');}
 }
}
