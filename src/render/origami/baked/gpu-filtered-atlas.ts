/** Compound preparation owner, not yet enabled in SceneRenderCore. All GPU
 * work and the small readback finish inside the caller's exclusive lease.
 * The complete chart geometry receives owned mean RGB; no frame/CPU LOD loop. */
import type * as THREE from 'three/webgpu';
import type {BakedChartSet} from './charts';
import type {AtlasPaintSource,BakedInk} from './baker';
import {prepareGpuAtlas,type GpuAtlasLimits,type GpuAtlasPaintSource,type GpuAtlasResult} from './gpu-atlas-preparation';
import {planGpuFaceMeans,prepareGpuFaceMeans,type GpuFaceMeanLimits} from './gpu-chart-mean';
import {attachBakedChartMeans} from './chart-mean';
import type {AtlasBytes} from './atlas-cache';

export interface FilteredAtlasLimits extends GpuAtlasLimits {maxCharts:number;maxConvergenceLinearDelta?:number}
/** Counts cover this compiler only. Borrowed source/chart/ink arrays and the
 * caller's other live resources remain part of the outer reservation. */
export async function prepareGpuFilteredAtlas(renderer:THREE.WebGPURenderer,charts:BakedChartSet,ink:BakedInk,profile:AtlasPaintSource['profile'],paint:GpuAtlasPaintSource,limits:FilteredAtlasLimits,assertCurrent:()=>void,admitPeak:(bytes:AtlasBytes)=>void):Promise<GpuAtlasResult>{
 let atlas:GpuAtlasResult|undefined,delivered=false,failure:unknown;
 try{
  if(limits.levels!==4||!Number.isSafeInteger(limits.maxCharts)||limits.maxCharts<charts.charts.length||limits.maxTextureSize<320||charts.geometry.hasAttribute('bakedMeanRgb'))throw Error('Filtered atlas: fresh four-mip chart domain and 320-wide mean table required');
  assertCurrent();
  atlas=await prepareGpuAtlas(renderer,charts,ink,profile,paint,limits,assertCurrent,plan=>admitPeak({cpuBytes:plan.cpuBytes,gpuBytes:plan.peakGpuBytes}));
  assertCurrent();
  const meanLimits:GpuFaceMeanLimits={maxCharts:limits.maxCharts,maxCpuBytes:limits.maxCpuBytes,maxGpuBytes:limits.maxGpuBytes,maxTextureSize:limits.maxTextureSize,maxConvergenceLinearDelta:limits.maxConvergenceLinearDelta};
  const meanPlan=planGpuFaceMeans(charts,atlas.texture,meanLimits),vertexCount=charts.geometry.getAttribute('position').count,meanBytes=vertexCount*12,attachScratchBytes=vertexCount*4;
  const peak={cpuBytes:Math.max(atlas.plan.cpuBytes,atlas.cpuBytes+meanPlan.peakCpuBytes,atlas.cpuBytes+meanPlan.retainedCpuBytes+meanBytes+attachScratchBytes),gpuBytes:Math.max(atlas.plan.peakGpuBytes,atlas.gpuBytes+meanPlan.peakGpuBytes)};
  if(!Number.isSafeInteger(peak.cpuBytes)||peak.cpuBytes>limits.maxCpuBytes||peak.gpuBytes>limits.maxGpuBytes)throw Error('Filtered atlas: combined compiler peak refused before mean allocation');
  admitPeak(peak);assertCurrent();
  const mean=await prepareGpuFaceMeans(renderer,charts,atlas.texture,meanLimits,assertCurrent);assertCurrent();
  const attached=attachBakedChartMeans(charts.geometry,charts.triangleChart,mean.meanLinearRGB,limits.maxCpuBytes-atlas.cpuBytes-meanPlan.retainedCpuBytes-attachScratchBytes);
  if(attached.bytes!==meanBytes||attached.scratchBytes!==attachScratchBytes)throw Error('Filtered atlas: generated geometry byte accounting changed');
  const owner=atlas;
  const result:GpuAtlasResult={texture:owner.texture,plan:owner.plan,cpuBytes:owner.cpuBytes,gpuBytes:owner.gpuBytes,
   stats:Object.freeze({...owner.stats,filteredAtlas:{peak,meanPlan,mean:mean.stats,meanGeometryCpuBytes:meanBytes,meanGeometryGpuBytesPerBinding:meanBytes,retainedCompilerGpuBytes:owner.gpuBytes,
    ownership:'Mean RGB belongs to charts.geometry; the caller counts geometry CPU once and GPU separately for each binding. Shared compiler owns only its atlas RT. No mean arrays retained in stats.',
    quality:'Far Native appearance and mean convergence remain unqualified; this support is not enabled by SceneRenderCore.'}}),dispose:()=>owner.dispose()};
  assertCurrent();delivered=true;return result;
 }catch(error){failure=error;throw error;}finally{
  // The chart owner retains every geometry attribute, including a generated
  // mean on a failed late publication. It must retire that chart geometry.
  if(atlas&&!delivered)try{atlas.dispose();}catch(error){throw new AggregateError(failure===undefined?[error]:[failure,error],'Filtered atlas cleanup failed');}
 }
}
