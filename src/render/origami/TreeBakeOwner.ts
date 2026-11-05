import type * as THREE from 'three/webgpu';
import type {SurfaceBudgetInventory} from '../surfaces/SurfaceBudgetInventory';
import type {GraphicsStyleContext} from '../graphics-style';
import {TreeAtlasAdmissionRefusal} from './baked/trees/admission';
import {fixedTreePaintKey} from '../surfaces/FixedTreeTextureSurface';
import type {TreeModel} from '../models/TreeModels';
import {TEXTURE_SURFACE_SLOT_COUNT,type TextureSurfaceSlot} from '../surfaces/TextureSurface';
import {compileLegacyTreeRecipe,planTreeRecipeAtlas,buildTreeArrayPages,type TreeAssetCatalog,type TreeSpecies,type TreeRecipe,type TreePaintLease} from './baked/trees';

export interface TreeBakeDemand {
 readonly key:string;
 /** Labels only; the owner NEVER reconstructs models from these labels. */
 readonly species:readonly TreeSpecies[];
 readonly models:readonly TreeModel[];
 isCurrent():boolean;
}
export interface OwnedTreeCatalog extends TreeAssetCatalog {
 readonly demandKey:string;readonly paintKey:string;readonly cpuBytes:number;readonly gpuBytes:number;readonly peakGpuBytes:number;
 dispose():void;
}
export interface TreeBakeLimits {cpuBytes:number;gpuBytes:number}
type Disposable={dispose():void};
function cleanup(items:readonly Disposable[],message:string):void{const errors:unknown[]=[];for(const item of items)try{item.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,message);}

/** Texture-only Gouache compiler/owner. The Layer's shared TreeModels remain
 * the sole geometry owner, across every texture generation. No renderer, World,
 * model cache, ready geometry or per-frame scheduling belongs to this owner. */
export class TreeBakeOwner {
 private active:OwnedTreeCatalog|undefined;private activeKeys=new Set<string>();
 private readonly budgetOwned=new Set<OwnedTreeCatalog>();
 surfaceBudget():SurfaceBudgetInventory{return{textures:[...this.budgetOwned].map(c=>c.texture),gpuBufferBytes:0,cpuBytes:[...this.budgetOwned].reduce((n,c)=>n+c.cpuBytes,0),complete:!this.closed,scope:'All owned active/staged/quarantined tree catalogs; textures deduplicated by caller, no renderer/driver target claim.'};}
 private settledDemand:string|undefined;private settledPaintKey:string|undefined;private generation=0;private catalogRevision=0;private closed=false;private refusal:string|undefined;
 constructor(private readonly limits:TreeBakeLimits){if(!Object.values(limits).every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Explicit tree preparation budgets required');}
 get activeCatalog():OwnedTreeCatalog|undefined{return this.active;}
 needsPreparation(demand:TreeBakeDemand,paintKey?:string):boolean{
  if(this.closed||!demand.models.length)return false;
  const covered=demand.models.every(model=>this.activeKeys.has(model.key))&&(paintKey===undefined||this.active?.paintKey===paintKey);
  return!covered&&!(this.settledDemand===demand.key&&(paintKey===undefined||this.settledPaintKey===paintKey));
 }
 snapshot(){return{ready:this.active?.pageCount??0,models:this.active?.modelKeys.length??0,demand:this.settledDemand??null,cpuBytes:this.active?.cpuBytes??0,gpuBytes:this.active?.gpuBytes??0,peakGpuBytes:this.active?.peakGpuBytes??0,refusal:this.refusal??null,scope:'Owned texture/metadata only; Layer-owned models, shared paint and driver memory excluded'};}
 async prepare(renderer:THREE.WebGPURenderer,graphics:GraphicsStyleContext,demand:TreeBakeDemand,paint:TreePaintLease,assertPreparationCurrent:()=>void,force=false):Promise<OwnedTreeCatalog|undefined>{
  const paintKey=fixedTreePaintKey(graphics);if(!force&&!this.needsPreparation(demand,paintKey))return undefined;
  const generation=this.generation,recipes:TreeRecipe[]=[],preparations:ReturnType<typeof planTreeRecipeAtlas>[]=[],pins=demand.models.map(model=>({model,key:model.key,slot:model.surfaceSlot}));
  let pages:Awaited<ReturnType<typeof buildTreeArrayPages>>|undefined,delivered=false,sourcesReleased=false,failed=false,primaryError:unknown;
  const assertCurrent=()=>{assertPreparationCurrent();paint.assertCurrent();if(this.closed||generation!==this.generation||!demand.isCurrent())throw Error('Tree preparation superseded');for(const p of pins){p.model.assertCurrent();if(p.model.key!==p.key||p.model.surfaceSlot!==p.slot)throw Error('Shared tree model identity changed');}};
  const releaseSources=()=>{if(sourcesReleased)return;sourcesReleased=true;cleanup([...preparations,...recipes],'Tree texture preparation views cleanup failed');};
  try{
   assertCurrent();const keys=new Set<string>(),slots=new Set<number>(),variants=new Set<string>();
   if(pins.length>14)throw Error('Tree texture cohort exceeds thirteen species plus anonymous');
   for(const p of pins){if(keys.has(p.key)||!Number.isSafeInteger(p.slot)||p.slot<0||p.slot>=TEXTURE_SURFACE_SLOT_COUNT||slots.has(p.slot))throw Error('Unique shared tree model keys/slots required');keys.add(p.key);slots.add(p.slot);variants.add(p.model.variant);}
   if(variants.size>1)throw Error('One actual site variant per tree surface cohort required');
   const p=graphics.preferences,settings={impasto:p.impasto,wear:p.wear,edges:p.edges,blackEdges:p.blackEdges,edgeWidth:p.edgeWidth,strokeImperfection:p.strokeImperfection,contourImperfection:p.contourImperfection};
   for(const pin of pins){const recipe=compileLegacyTreeRecipe(pin.model.species,{paintGeneration:paint.fingerprint,settings,pageSize:2048,maxCpuBytes:16*1024*1024,variant:pin.model.variant},pin.model);recipes.push(recipe);preparations.push(planTreeRecipeAtlas(recipe,paint,{levels:4,maxCpuBytes:32*1024*1024,maxGpuBytes:256*1024*1024,maxTextureSize:4096}));}
   const sharedCpuBytes=recipes.reduce((n,r)=>n+r.cpuBytes,0)+preparations.reduce((n,r)=>n+r.cpuBytes,0),byKey=new Map(preparations.map(p=>[p.key,p])),limits={maxPages:14,maxArrayLayers:256,minArrayLayers:2,maxTextureSize:4096,maxPeakGpuBytes:this.limits.gpuBytes,maxCpuBytes:this.limits.cpuBytes,existingLiveGpuBytes:this.active?.gpuBytes??0,existingLiveCpuBytes:this.active?.cpuBytes??0,sharedCpuBytes};
   pages=await buildTreeArrayPages(renderer,preparations,paint.fingerprint,limits,async key=>{assertCurrent();const preparation=byKey.get(key);if(!preparation)throw Error('Missing admitted tree texture page');return preparation.bake(renderer,assertCurrent);},assertCurrent);
   assertCurrent();if(!pages||pages.plan.depth<2||!pages.texture.isArrayTexture)throw Error('Nonempty tree surface requires an actual array with two or more layers');
   // No model, geometry view, ink or paint lease escapes in the returned set.
   releaseSources();assertCurrent();
   const ownedPages=pages,modelKeys=Object.freeze(pins.map(p=>p.key)),rows:TextureSurfaceSlot[]=Array.from({length:TEXTURE_SURFACE_SLOT_COUNT},()=>Object.freeze({layer:0,paletteBaked:false}));
   for(let layer=0;layer<pins.length;layer++)rows[pins[layer]!.slot]=Object.freeze({layer,paletteBaked:true});
   const frozenRows=Object.freeze(rows),metadataBytes=16*1024+modelKeys.reduce((n,key)=>n+key.length*2,0)+demand.key.length*2;
   // Release even ordinary JS references to preparation views and models.
   byKey.clear();pins.length=0;recipes.length=0;preparations.length=0;
   const catalog=this.createOwnedCatalog(ownedPages,demand.key,modelKeys,frozenRows,generation,metadataBytes,paintKey);
   delivered=true;return catalog;
  }catch(error){failed=true;primaryError=error;if(error instanceof TreeAtlasAdmissionRefusal&&!this.closed&&generation===this.generation&&demand.isCurrent()&&paint.isCurrent())try{assertPreparationCurrent();this.settledDemand=demand.key;this.settledPaintKey=paintKey;this.refusal=error instanceof Error?error.message:String(error);}catch{/* superseded */}throw error;
  }finally{
   const errors:unknown[]=[];try{releaseSources();}catch(error){errors.push(error);}if(!delivered||errors.length)try{pages?.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError([...(failed?[primaryError]:[]),...errors],'Tree texture preparation cleanup failed');
  }
 }
 /** Its lexical environment contains texture ownership and immutable metadata
  * only, never preparation models, a paint lease, graphics or demand object. */
 private createOwnedCatalog(ownedPages:NonNullable<Awaited<ReturnType<typeof buildTreeArrayPages>>>,demandKey:string,modelKeys:readonly string[],rows:readonly TextureSurfaceSlot[],generation:number,metadataBytes:number,paintKey:string):OwnedTreeCatalog{
  let retired=false;const assertCatalog=()=>{if(retired||this.closed||generation!==this.generation)throw Error('Tree texture catalog retired');};
  const owner=this,catalog:OwnedTreeCatalog={paintKey,revision:++this.catalogRevision,texture:ownedPages.texture,pageCount:ownedPages.plan.depth,modelKeys,slots:rows,demandKey,cpuBytes:metadataBytes,gpuBytes:ownedPages.plan.retainedGpuBytes,peakGpuBytes:ownedPages.plan.peakGpuBytes,assertCurrent:assertCatalog,dispose(){if(retired)return;retired=true;ownedPages.dispose();owner.budgetOwned.delete(catalog);}};owner.budgetOwned.add(catalog);return catalog;
 }
 /** Publish the texture binding first, then adopt synchronously. Geometry and
  * model references have no publication/retirement operation here. */
 adopt(catalog:OwnedTreeCatalog):OwnedTreeCatalog|undefined{catalog.assertCurrent();if(this.closed)throw Error('Tree texture owner closed');const old=this.active;this.active=catalog;this.activeKeys=new Set(catalog.modelKeys);this.settledDemand=catalog.demandKey;this.settledPaintKey=catalog.paintKey;this.refusal=undefined;return old;}
 refuse(demand:TreeBakeDemand,error:unknown,paintKey?:string):void{if(!(error instanceof TreeAtlasAdmissionRefusal))throw error;if(this.closed||!demand.isCurrent())return;this.settledDemand=demand.key;this.settledPaintKey=paintKey;this.refusal=error instanceof Error?error.message:String(error);}
 /** Caller detaches the texture binding before releasing this owner. */
 invalidate():void{this.generation++;this.settledDemand=undefined;this.settledPaintKey=undefined;this.refusal=undefined;const old=this.active;this.active=undefined;this.activeKeys.clear();old?.dispose();}
 dispose():void{if(this.closed)return;this.closed=true;this.invalidate();}
}
