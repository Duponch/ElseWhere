import type * as THREE from 'three/webgpu';
import type {TreeRecipe,TreePaintLease} from './types';
import type {BakedInk} from './ink';
import {planTreeGpuAtlas,prepareTreeGpuAtlas,type GpuAtlasLimits} from './gpu-atlas';
import {completeLegacyPageTransfer} from './transfer';
export interface PreparedTreePage {readonly texture:THREE.Texture;readonly gpuBytes:number;readonly cpuBytes:number;readonly stats:Readonly<Record<string,unknown>>;dispose():void}
export interface TreeRecipePreparation {
 readonly key:string;readonly width:2048;readonly height:2048;readonly levels:4;
 /** Retained ink/metadata ONLY. Recipe and renderer builder scratch separate. */
 readonly cpuBytes:number;
 readonly preparationCpuBytes:number;readonly preparationPeakGpuBytes:number;
 bake(renderer:THREE.WebGPURenderer,assertExclusive:()=>void):Promise<PreparedTreePage>;
 dispose():void;
}
function inkBytes(ink:BakedInk):number{const buffers=new Set<ArrayBufferLike>();for(const a of [ink.chartIds,ink.bodyTriangles,ink.pixelXY,ink.rawUv,ink.pigmentMetric])buffers.add(a.buffer);for(const g of ink.geometries){for(const a of Object.values(g.attributes))buffers.add(a.array.buffer);if(g.index)buffers.add(g.index.array.buffer);for(const key of ['referenceBrushBasePositions','referenceBrushWidthOffsets','referenceBrushRoughOffsets']){const a:unknown=g.userData[key];if(a instanceof Float32Array)buffers.add(a.buffer);}}return[...buffers].reduce((n,b)=>n+b.byteLength,0);}
/** CPU preflight/lease, not a GPU operation. The global owner counts
 * sum(recipe.cpuBytes)+sum(preparation.cpuBytes)+sum(ready.cpuBytes) as shared,
 * then the MAX preparationCpuBytes. Nothing is multiplied by tree count. */
export function planTreeRecipeAtlas(recipe:TreeRecipe,paintLease:TreePaintLease,limits:GpuAtlasLimits):TreeRecipePreparation{
 recipe.assertCurrent();paintLease.assertCurrent();if(paintLease.fingerprint!==recipe.options.paintGeneration||recipe.charts.atlas.width!==2048||recipe.charts.atlas.height!==2048||limits.levels!==4||limits.maxGpuBytes>256*1024*1024)throw Error('Exact tree paint/page/per-builder admission required');
 let ink:BakedInk|undefined=recipe.compileInk(),heldRecipe:TreeRecipe|undefined=recipe,heldPaint:TreePaintLease|undefined=paintLease,closed=false,running=false,used=false,closeRequested=false;const key=recipe.key,fill=recipe.options.settings.contourImperfection;
 try{const plan=planTreeGpuAtlas(recipe.charts,ink,{attribute:'paintProfile',component:0},paintLease.paint,limits),retainedInkBytes=inkBytes(ink),metadataBytes=key.length*2+1024;let retained=retainedInkBytes+metadataBytes;
  const releaseSources=()=>{const value=ink;ink=undefined;heldRecipe=undefined;heldPaint=undefined;retained=metadataBytes;value?.dispose();};
  return{key,width:2048,height:2048,levels:4,get cpuBytes(){return closed?0:retained;},preparationCpuBytes:plan.cpuBytes,preparationPeakGpuBytes:plan.peakGpuBytes,
   async bake(renderer,assertExclusive){if(closed||running||used||!ink||!heldRecipe||!heldPaint)throw Error('Tree page preparation is consumable once');running=true;used=true;let result:Awaited<ReturnType<typeof prepareTreeGpuAtlas>>|undefined;
    const assert=()=>{if(closed||closeRequested)throw Error('Tree page preparation cancelled');assertExclusive();heldRecipe?.assertCurrent();heldPaint?.assertCurrent();if(!heldRecipe||!heldPaint||!ink)throw Error('Tree preparation sources retired prematurely');};
    try{assert();result=await prepareTreeGpuAtlas(renderer,heldRecipe.charts,ink,{attribute:'paintProfile',component:0},heldPaint.paint,limits,assert,fill,actual=>{if(JSON.stringify(actual)!==JSON.stringify(plan))throw Error('Tree atlas exact plan changed after reservation');});assert();const acquired=result;result=undefined;const owner=completeLegacyPageTransfer(acquired,releaseSources);let retired=false;
     // A cooked page is independent of source pixels/paint epoch/gate. The
     // Core catalog invalidates on settings/lifetime, not unrelated arrivals.
     return{texture:owner.texture,gpuBytes:owner.gpuBytes,cpuBytes:owner.cpuBytes,stats:Object.freeze({...owner.stats,key,plan,retainedInkBytes,metadataBytes,preparationCpuBytes:plan.cpuBytes,preparationPeakGpuBytes:plan.peakGpuBytes,sourceLeaseReleased:true}),dispose(){if(retired)return;retired=true;owner.dispose();}};
    }finally{running=false;const errors:unknown[]=[];try{releaseSources();}catch(e){errors.push(e);}try{result?.dispose();}catch(e){errors.push(e);}if(closeRequested)closed=true;if(errors.length)throw new AggregateError(errors,'Tree atlas preparation cleanup quarantine');}
   },dispose(){if(closed||closeRequested)return;closeRequested=true;if(running)return;closed=true;releaseSources();}};
 }catch(error){ink?.dispose();throw error;}
}
