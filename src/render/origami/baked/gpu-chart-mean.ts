/** Preparation-only quadrature of the FINAL opaque colour atlas.
 * Actual chart triangles, physical-area weights, no bounding-box averaging.
 * No World, paint/Canvas fallback, simulation RNG, LOD owner or frame work. */
import * as THREE from 'three/webgpu';
import {Fn,Loop,attribute,varying,texture,textureLoad,ivec2,vec3,vec4,float,int,max} from 'three/tsl';
import type {BakedChartSet,BakedTriangle} from './charts';

export interface GpuFaceMeanLimits {
 maxCharts:number;maxCpuBytes:number;maxGpuBytes:number;maxTextureSize:number;
 /** Optional EXPLICIT grid-agreement admission. Not an absolute integration or
  * perceptual error bound; omit for initial real-asset qualification. */
 maxConvergenceLinearDelta?:number;
}
export interface GpuFaceMeanPlan {
 chartCount:number;width:number;height:1;sampleLevel:3;primarySamples:256;comparisonSamples:64;
 tableWidth:320;tableBytes:number;geometryBytes:number;targetBytes:number;
 readbackBytes:number;readbackRowPitch:number;peakCpuBytes:number;peakGpuBytes:number;
 retainedCpuBytes:number;retainedGpuBytes:0;
}
export interface GpuFaceMeanQuadrature {
 /** Row=chartId. Columns0..255 primary,256..319 comparison. RG=atlasUV,
  * B=physical triangle area/(chart area*its sample count), A=0. */
 data:Float32Array;
 stats:Readonly<Record<string,unknown>>;
}
export interface GpuFaceMeanResult {
 meanLinearRGB:Float32Array;chartCount:number;convergenceLinearDelta:Float32Array;
 plan:GpuFaceMeanPlan;stats:Readonly<Record<string,unknown>>;
}
const running=new WeakSet<THREE.WebGPURenderer>(),MAX_TRIANGLES_PER_CHART=64;
const integer=(v:number,min:number,name:string)=>{if(!Number.isSafeInteger(v)||v<min)throw Error('GPU face mean: invalid '+name);return v;};
function triangleArea(charts:BakedChartSet,t:BakedTriangle):number {
 const p=charts.geometry.getAttribute('position'),[a,b,c]=t.outputVertices;
 const bx=p.getX(b)-p.getX(a),by=p.getY(b)-p.getY(a),bz=p.getZ(b)-p.getZ(a),cx=p.getX(c)-p.getX(a),cy=p.getY(c)-p.getY(a),cz=p.getZ(c)-p.getZ(a);
 return Math.hypot(by*cz-bz*cy,bz*cx-bx*cz,bx*cy-by*cx)*.5;
}

/** Preflight only: no pixel/geometry allocation or GPU call. Bounds count new
 * typed arrays/texture/RT/readback. Borrowed atlas/charts and JS/compiler/driver
 * overhead are explicitly outside these nominal byte counts. */
export function planGpuFaceMeans(charts:BakedChartSet,atlas:THREE.Texture,limits:GpuFaceMeanLimits):GpuFaceMeanPlan {
 const count=integer(charts.charts.length,1,'chart count'),width=integer(charts.atlas.width,1,'atlas width'),height=integer(charts.atlas.height,1,'atlas height');
 for(const name of ['maxCharts','maxCpuBytes','maxGpuBytes','maxTextureSize'] as const)integer(limits[name],1,name);
 const tolerance=limits.maxConvergenceLinearDelta;
 if(tolerance!==undefined&&(!Number.isFinite(tolerance)||tolerance<0||tolerance>1))throw Error('GPU face mean: invalid explicit convergence tolerance');
 if(count>limits.maxCharts||Math.max(count,320,width,height)>limits.maxTextureSize||charts.atlas.mipLevels!==4||charts.atlas.paddingTexels<8||width%8||height%8)throw Error('GPU face mean: chart/mip/gutter/size admission refused');
 const image:unknown=atlas.image;
 if(atlas.colorSpace!==THREE.SRGBColorSpace||atlas.type!==THREE.UnsignedByteType||atlas.format!==THREE.RGBAFormat||atlas.flipY||atlas.generateMipmaps||atlas.mipmaps.length!==4||atlas.minFilter!==THREE.LinearMipmapLinearFilter||atlas.magFilter!==THREE.LinearFilter||!image||typeof image!=='object'||Reflect.get(image,'width')!==width||Reflect.get(image,'height')!==height)throw Error('GPU face mean: actual finite-four-mip opaque SRGB atlas required');
 const p=charts.geometry.getAttribute('position'),uv=charts.geometry.getAttribute('bakedUv');if(!p||!uv||uv.itemSize!==2||uv.count!==p.count)throw Error('GPU face mean: actual chart position/bakedUv missing');
 let admittedTriangles=0;
 for(let i=0;i<count;i++){
  const c=charts.charts[i]!,r=c.rect;
  if(c.id!==i||!c.triangles.length||c.triangles.length>MAX_TRIANGLES_PER_CHART||[r.x,r.y,r.width,r.height].some(v=>!Number.isSafeInteger(v)||v<0)||r.width<16||r.height<16||r.x%8||r.y%8||r.width%8||r.height%8||r.x+r.width>width||r.y+r.height>height)throw Error('GPU face mean: isolated chart/64-triangle quadrature coverage refused');
  let sum=0;
  for(const id of c.triangles){
   const t=charts.triangles[id];if(!t||t.id!==id||t.chartId!==i||charts.triangleChart[id]!==i||c.triangles.indexOf(id)!==c.triangles.lastIndexOf(id))throw Error('GPU face mean: actual triangle/chart ownership refused');
   for(const v of t.outputVertices)if(!Number.isSafeInteger(v)||v<0||v>=p.count||!Number.isFinite(uv.getX(v))||!Number.isFinite(uv.getY(v))||uv.getX(v)<(r.x+8)/width-1e-7||uv.getX(v)>(r.x+r.width-8)/width+1e-7||uv.getY(v)<(r.y+8)/height-1e-7||uv.getY(v)>(r.y+r.height-8)/height+1e-7)throw Error('GPU face mean: triangle escaped isolated content');
   const area=triangleArea(charts,t);if(!Number.isFinite(area)||area<=0)throw Error('GPU face mean: degenerate physical chart triangle');sum+=area;admittedTriangles++;
  }
  if(!Number.isFinite(sum)||sum<=0)throw Error('GPU face mean: invalid physical chart area');
 }
 if(admittedTriangles!==charts.triangles.length)throw Error('GPU face mean: incomplete actual triangle coverage');
 const tableBytes=count*320*4*4,geometryBytes=count*6*4*4,targetBytes=count*16,readbackBytes=count*16,readbackRowPitch=Math.ceil(readbackBytes/256)*256,retainedCpuBytes=count*16;
 // r186's single/final row is exactly16*N bytes; reserve aligned pitch anyway.
 // Mapped staging +slice coexist; reserve both plus outputs and max per-chart
 // Float64 areas /Uint32 counts /Uint32 ordinals scratch.
 const peakCpuBytes=tableBytes+geometryBytes+2*readbackRowPitch+retainedCpuBytes+MAX_TRIANGLES_PER_CHART*16,peakGpuBytes=tableBytes+geometryBytes+targetBytes+readbackRowPitch;
 if(!Number.isSafeInteger(peakCpuBytes)||!Number.isSafeInteger(peakGpuBytes)||peakCpuBytes>limits.maxCpuBytes||peakGpuBytes>limits.maxGpuBytes)throw Error('GPU face mean: peak budget refused BEFORE allocation');
 return Object.freeze({chartCount:count,width:count,height:1,sampleLevel:3,primarySamples:256,comparisonSamples:64,tableWidth:320,tableBytes,geometryBytes,targetBytes,readbackBytes,readbackRowPitch,peakCpuBytes,peakGpuBytes,retainedCpuBytes,retainedGpuBytes:0});
}
function radicalInverse2(value:number):number {let n=value,result=0,fraction=.5;while(n){result+=(n%2)*fraction;n=Math.floor(n/2);fraction*=.5;}return result;}

/** Geometry-only deterministic quadrature. Every real triangle receives at
 * least one sample even in the64-sample comparison. Extra samples follow its
 * physical area. Per-sample weights remove area/count quantisation bias. */
export function packGpuFaceMeanQuadrature(charts:BakedChartSet,plan:GpuFaceMeanPlan):GpuFaceMeanQuadrature {
 if(plan.chartCount!==charts.charts.length||plan.tableBytes!==plan.chartCount*320*16)throw Error('GPU face mean: quadrature plan changed');
 const data=new Float32Array(plan.tableBytes/4),areas=new Float64Array(MAX_TRIANGLES_PER_CHART),counts=new Uint32Array(MAX_TRIANGLES_PER_CHART),ordinal=new Uint32Array(MAX_TRIANGLES_PER_CHART),uv=charts.geometry.getAttribute('bakedUv');let maxWeightSumError=0;
 for(const c of charts.charts){
  const n=c.triangles.length;if(!n||n>MAX_TRIANGLES_PER_CHART)throw Error('GPU face mean: quadrature triangle cap refused');let total=0;
  for(let i=0;i<n;i++){const t=charts.triangles[c.triangles[i]!]!;areas[i]=triangleArea(charts,t);total+=areas[i]!;}
  if(!Number.isFinite(total)||total<=0)throw Error('GPU face mean: invalid quadrature area');
  for(const[samples,start]of [[256,0],[64,256]] as const){
   counts.fill(0);ordinal.fill(0);for(let i=0;i<n;i++)counts[i]=1;
   const remaining=samples-n;let triangle=0,cumulative=areas[0]!/total;
   for(let sample=0;sample<remaining;sample++){const quantile=(sample+.5)/remaining;while(triangle<n-1&&quantile>cumulative){triangle++;cumulative+=areas[triangle]!/total;}counts[triangle]=counts[triangle]!+1;}
   let column=start,weightSum=0;
   for(let i=0;i<n;i++){
    const t=charts.triangles[c.triangles[i]!]!,[a,b,d]=t.outputVertices,count=counts[i]!,weight=areas[i]!/(total*count);
    for(let sample=0;sample<count;sample++){
     // Hammersley inside a triangle, sqrt warp gives uniform AREA. Both
     // coordinates and all barycentric weights are strictly inside(0,1).
     const u=(ordinal[i]!+.5)/count,v=radicalInverse2(ordinal[i]!)+.5/count,s=Math.sqrt(u),wa=1-s,wb=s*(1-v),wc=s*v;ordinal[i]=ordinal[i]!+1;
     if(!(wa>0&&wb>0&&wc>0))throw Error('GPU face mean: quadrature left triangle interior');
     const at=(c.id*320+column++)*4;data[at]=uv.getX(a)*wa+uv.getX(b)*wb+uv.getX(d)*wc;data[at+1]=uv.getY(a)*wa+uv.getY(b)*wb+uv.getY(d)*wc;data[at+2]=weight;weightSum+=data[at+2]!;
    }
   }
   if(column!==start+samples)throw Error('GPU face mean: incomplete stratified sample allocation');maxWeightSumError=Math.max(maxWeightSumError,Math.abs(weightSum-1));
  }
 }
 return{data,stats:Object.freeze({coverage:'Every actual triangle has >=1 sample in both quadratures; no bounding rectangle or outside-polygon samples intended',weighting:'Physical bind-plane triangle area / chart area / triangle sample count',sequence:'Deterministic area-CDF allocation + interior sqrt-warp Hammersley, no RNG',primarySamples:256,comparisonSamples:64,maxWeightSumError,uvStorage:'Float32; Native orientation/filter and finite rounding remain to qualify'})};
}
function rowGeometry(plan:GpuFaceMeanPlan):THREE.BufferGeometry {
 const positions=new Float32Array(plan.chartCount*6*3),ids=new Float32Array(plan.chartCount*6),corners=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]] as const;
 for(let chart=0;chart<plan.chartCount;chart++)for(let corner=0;corner<6;corner++){const[x,y]=corners[corner]!,v=chart*6+corner;positions.set([2*(chart+x)/plan.chartCount-1,1-2*y,.5],v*3);ids[v]=chart;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('faceMeanChart',new THREE.BufferAttribute(ids,1));return g;
}

/** EXCLUSIVE initialized-renderer preparation. Source atlas/charts stay borrowed.
 * Only N*16bytes are read back. All owned GPU scratch is disposed before return. */
export async function prepareGpuFaceMeans(renderer:THREE.WebGPURenderer,charts:BakedChartSet,atlas:THREE.Texture,limits:GpuFaceMeanLimits,assertExclusive:()=>void):Promise<GpuFaceMeanResult> {
 const plan=planGpuFaceMeans(charts,atlas,limits),backend=renderer.backend;
 if(!renderer.initialized||!('isWebGPUBackend' in backend)||backend.isWebGPUBackend!==true)throw Error('GPU face mean: initialized Native WebGPU renderer required');
 if(running.has(renderer))throw Error('GPU face mean: renderer preparation already active');assertExclusive();running.add(renderer);
 const old={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),autoClear:renderer.autoClear,color:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha()},version=atlas.version,image=atlas.image,mips=[...atlas.mipmaps],cleanup:(()=>void)[]=[],own=<T extends {dispose():void}>(value:T):T=>{cleanup.push(()=>value.dispose());return value;};let failure:unknown;
 const assertCurrent=()=>{assertExclusive();if(atlas.version!==version||atlas.image!==image||atlas.mipmaps.length!==mips.length||atlas.mipmaps.some((m,i)=>m!==mips[i]))throw Error('GPU face mean: borrowed atlas changed before publication');};
 try{
  const at=performance.now(),packed=packGpuFaceMeanQuadrature(charts,plan),cpuQuadratureMs=performance.now()-at,g=own(rowGeometry(plan)),table=own(new THREE.DataTexture(packed.data,320,plan.chartCount,THREE.RGBAFormat,THREE.FloatType));table.colorSpace=THREE.NoColorSpace;table.flipY=false;table.minFilter=table.magFilter=THREE.NearestFilter;table.generateMipmaps=false;table.needsUpdate=true;
  const chart=varying(attribute('faceMeanChart','float'),'v_gpuFaceMeanChart').setInterpolation('flat');
  const quadrature=(count:64|256,start:0|256)=>Fn(()=>{
   const sum=vec3(0).toVar(),weight=float(0).toVar();
   Loop(count,({i})=>{const sample=textureLoad(table,ivec2(int(i).add(start),int(chart)),int(0)).toVar();sum.addAssign(texture(atlas,sample.xy).level(float(3)).rgb.mul(sample.z));weight.addAssign(sample.z);});
   return sum.div(weight.max(1e-20));
  })();
  const m=own(new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,side:THREE.DoubleSide,transparent:false,toneMapped:false,fog:false}));m.vertexNode=vec4(attribute('position','vec3'),1);m.fragmentNode=Fn(()=>{const primary=quadrature(256,0).toVar(),comparison=quadrature(64,256).toVar(),delta=primary.sub(comparison).abs();return vec4(primary,max(max(delta.x,delta.y),delta.z));})();
  const target=own(new THREE.RenderTarget(plan.chartCount,1,{type:THREE.FloatType,format:THREE.RGBAFormat,colorSpace:THREE.NoColorSpace,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false,depthBuffer:false,stencilBuffer:false,samples:0}));target.texture.flipY=false;
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(g,m),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);mesh.frustumCulled=false;scene.add(mesh);renderer.autoClear=true;renderer.setClearColor(0,0);assertCurrent();renderer.setRenderTarget(target);const submitAt=performance.now();await renderer.renderAsync(scene,camera);assertCurrent();const readAt=performance.now();const pixels=await renderer.readRenderTargetPixelsAsync(target,0,0,plan.chartCount,1);assertCurrent();const readDone=performance.now();
  if(!(pixels instanceof Float32Array)||pixels.byteLength!==plan.readbackBytes)throw Error('GPU face mean: installed r186 single-row Float32 readback contract changed');
  const meanLinearRGB=new Float32Array(plan.chartCount*3),convergenceLinearDelta=new Float32Array(plan.chartCount);let worst=0,squared=0,roundoffClamps=0;
  const admitChannel=(value:number)=>{if(!Number.isFinite(value)||value<0||value>1+1e-6)throw Error('GPU face mean: invalid nonnegative linear readback');if(value>1){roundoffClamps++;return 1;}return value;};
  for(let chart=0;chart<plan.chartCount;chart++){
   const at=chart*4;for(let c=0;c<3;c++)meanLinearRGB[chart*3+c]=admitChannel(pixels[at+c]!);
   const error=admitChannel(pixels[at+3]!);convergenceLinearDelta[chart]=error;worst=Math.max(worst,error);squared+=error*error;
  }
  const stats=Object.freeze({scope:'PRIVATE actual-triangle area-weighted quadrature of final body+ink atlas, not an exact integral',chartCount:plan.chartCount,quadrature:packed.stats,primarySamples:256,comparisonSamples:64,atlasSamplesPerChart:320,sampleLevel:3,linearMean:true,outputFormat:'RGBA32Float NoColorSpace, RGB=mean256 A=maxRGBabs(mean256-mean64)',readbackSize:[plan.chartCount,1],readbackBytes:plan.readbackBytes,roundoffClamps,roundoffUpperTolerance:1e-6,convergenceMaxLinearDelta:worst,convergenceRmsLinearDelta:Math.sqrt(squared/plan.chartCount),convergenceTolerance:limits.maxConvergenceLinearDelta??null,convergenceMeaning:'Quadrature agreement only; no absolute integration or perceptual PASS',cpuQuadratureMs,submitAndRenderAsyncWallMs:readAt-submitAt,readbackFenceWallMs:readDone-readAt,retainedCpuBytes:plan.retainedCpuBytes,retainedGpuBytes:0,quality:'Native orientation/sRGB/filter/triangular/concave and real-asset convergence qualification pending',runtime:'No CPU LOD decision; preparation only'});
  if(limits.maxConvergenceLinearDelta!==undefined&&worst>limits.maxConvergenceLinearDelta)throw Error('GPU face mean: EXPLICIT convergence tolerance refused BEFORE publication '+JSON.stringify({worst,tolerance:limits.maxConvergenceLinearDelta,chartCount:plan.chartCount}));assertCurrent();return{meanLinearRGB,chartCount:plan.chartCount,convergenceLinearDelta,plan,stats};
 }catch(error){failure=error;throw error;}finally{
  const failures:unknown[]=[];try{renderer.setRenderTarget(old.target,old.face,old.mip);renderer.autoClear=old.autoClear;renderer.setClearColor(old.color,old.alpha);}catch(error){failures.push(error);}running.delete(renderer);for(const dispose of cleanup.reverse())try{dispose();}catch(error){failures.push(error);}if(failures.length)throw new AggregateError(failure===undefined?failures:[failure,...failures],'GPU face mean cleanup failed; no CPU result published');
 }
}
