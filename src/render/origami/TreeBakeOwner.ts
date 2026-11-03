import type * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from '../graphics-style';
import {
  compileLegacyTreeRecipe,createReadyTreeRecipe,planTreeRecipeAtlas,buildTreeArrayPages,
  type TreeAssetCatalog,type TreeSpecies,type TreeRecipe,type ReadyTreeRecipe,type TreePaintLease,
} from './baked/trees';

export interface TreeBakeDemand {
  readonly key:string;
  readonly species:readonly TreeSpecies[];
  isCurrent():boolean;
}
export interface OwnedTreeCatalog extends TreeAssetCatalog {
  readonly demandKey:string;
  readonly cpuBytes:number;
  readonly gpuBytes:number;
  readonly peakGpuBytes:number;
  dispose():void;
}
export interface TreeBakeLimits {cpuBytes:number;gpuBytes:number}

/** One immutable texture bank for the current tree cohort. This owner is used
 * only during loading or an actual pause. It neither visits World nor schedules
 * work: SceneRenderCore holds the renderer and the single preparation queue.
 * ResourceLayer borrows catalogues; retire only after its meshes and compiler
 * pages have detached from the old material/texture. */
export class TreeBakeOwner {
  private active:OwnedTreeCatalog|undefined;
  private settledDemand:string|undefined;
  private generation=0;
  private catalogRevision=0;
  private closed=false;
  private refusal:string|undefined;
  constructor(private readonly limits:TreeBakeLimits){
    if(!Object.values(limits).every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Explicit tree preparation budgets required');
  }
  needsPreparation(demand:TreeBakeDemand):boolean {
    return !this.closed&&demand.species.length>0&&this.settledDemand!==demand.key
      &&!(this.active&&demand.species.every(species=>this.active!.readReady(species)));
  }
  snapshot(){return{ready:this.active?.pageCount??0,demand:this.settledDemand??null,
    cpuBytes:this.active?.cpuBytes??0,gpuBytes:this.active?.gpuBytes??0,
    peakGpuBytes:this.active?.peakGpuBytes??0,refusal:this.refusal??null,
    scope:'Nominal tree ownership only; shared paint, other renderers and driver memory are not total VRAM'};}
  /** A returned candidate owns all its resources but is not yet live. The
   * caller must warm it, recheck freshness, then publish without another await. */
  async prepare(renderer:THREE.WebGPURenderer,graphics:GraphicsStyleContext,demand:TreeBakeDemand,
    paint:TreePaintLease,assertPreparationCurrent:()=>void):Promise<OwnedTreeCatalog|undefined>{
    if(!this.needsPreparation(demand))return undefined;
    const generation=this.generation,recipes:TreeRecipe[]=[],ready:ReadyTreeRecipe[]=[],
      preparations:ReturnType<typeof planTreeRecipeAtlas>[]=[];
    let pages:Awaited<ReturnType<typeof buildTreeArrayPages>>|undefined,delivered=false;
    const assertCurrent=()=>{
      assertPreparationCurrent();paint.assertCurrent();
      if(this.closed||generation!==this.generation||!demand.isCurrent())throw Error('Tree preparation superseded');
    };
    try{
      assertCurrent();
      const p=graphics.preferences,settings={impasto:p.impasto,wear:p.wear,edges:p.edges,blackEdges:p.blackEdges,
        edgeWidth:p.edgeWidth,strokeImperfection:p.strokeImperfection,contourImperfection:p.contourImperfection};
      for(const species of demand.species){
        const recipe=compileLegacyTreeRecipe(species,{paintGeneration:paint.fingerprint,settings,pageSize:2048,maxCpuBytes:16*1024*1024});
        recipes.push(recipe);
        preparations.push(planTreeRecipeAtlas(recipe,paint,{levels:4,maxCpuBytes:32*1024*1024,maxGpuBytes:256*1024*1024,maxTextureSize:4096}));
      }
      for(let layer=0;layer<recipes.length;layer++)ready.push(createReadyTreeRecipe(recipes[layer]!,layer,recipes.length));
      const retainedCpu=recipes.reduce((n,r)=>n+r.cpuBytes,0)+ready.reduce((n,r)=>n+r.cpuBytes,0),
        sharedCpuBytes=retainedCpu+preparations.reduce((n,p)=>n+p.cpuBytes,0),
        byKey=new Map(preparations.map(p=>[p.key,p]));
      const limits={maxPages:13,maxArrayLayers:256,maxTextureSize:4096,maxPeakGpuBytes:this.limits.gpuBytes,
        maxCpuBytes:this.limits.cpuBytes,existingLiveGpuBytes:this.active?.gpuBytes??0,
        existingLiveCpuBytes:this.active?.cpuBytes??0,sharedCpuBytes};
      pages=await buildTreeArrayPages(renderer,preparations,paint.fingerprint,limits,async key=>{
        assertCurrent();const preparation=byKey.get(key);if(!preparation)throw Error('Missing admitted tree page');
        return preparation.bake(renderer,assertCurrent);
      },assertCurrent);
      assertCurrent();if(!pages)throw Error('Nonempty tree cohort produced no texture');
      const ownedPages=pages,bySpecies=new Map(ready.map(r=>[r.species,r]));let retired=false;
      const assertCatalog=()=>{if(retired||this.closed||generation!==this.generation)throw Error('Tree catalog retired');};
      const catalog:OwnedTreeCatalog={revision:++this.catalogRevision,texture:pages.texture,pageCount:recipes.length,
        demandKey:demand.key,cpuBytes:retainedCpu,gpuBytes:pages.plan.retainedGpuBytes,peakGpuBytes:pages.plan.peakGpuBytes,
        assertCurrent:assertCatalog,readReady(species){assertCatalog();return bySpecies.get(species as TreeSpecies);},
        dispose(){if(retired)return;retired=true;const errors:unknown[]=[];
          for(const item of [...ready,...recipes,ownedPages])try{item.dispose();}catch(error){errors.push(error);}
          if(errors.length)throw new AggregateError(errors,'Tree catalog cleanup failed');}};
      delivered=true;return catalog;
    }catch(error){
      // A stable refusal is retried only after composition/preferences change.
      // Stale preparation remains pending for the next actual pause.
      if(!this.closed&&generation===this.generation&&demand.isCurrent()&&paint.isCurrent()){
        try{assertPreparationCurrent();this.settledDemand=demand.key;this.refusal=error instanceof Error?error.message:String(error);}catch{/* superseded */}
      }
      throw error;
    }finally{
      const errors:unknown[]=[];
      for(const p of preparations)try{p.dispose();}catch(error){errors.push(error);}
      if(!delivered||errors.length){for(const r of [...ready,...recipes,...(pages?[pages]:[])])try{r.dispose();}catch(error){errors.push(error);}}
      if(errors.length)throw new AggregateError(errors,'Tree preparation cleanup failed');
    }
  }
  /** Called synchronously after ResourceLayer publication and compiler repair.
   * The returned old owner is now safe for the caller to release. */
  adopt(catalog:OwnedTreeCatalog):OwnedTreeCatalog|undefined {
    catalog.assertCurrent();if(this.closed)throw Error('Tree owner closed');
    const old=this.active;this.active=catalog;this.settledDemand=catalog.demandKey;this.refusal=undefined;return old;
  }
  refuse(demand:TreeBakeDemand,error:unknown):void {
    if(this.closed||!demand.isCurrent())return;
    this.settledDemand=demand.key;this.refusal=error instanceof Error?error.message:String(error);
  }
  /** First detach ResourceLayer/435, then invalidate and release this owner. */
  invalidate():void {
    this.generation++;this.settledDemand=undefined;this.refusal=undefined;
    const old=this.active;this.active=undefined;old?.dispose();
  }
  dispose():void {if(this.closed)return;this.invalidate();this.closed=true;}
}
