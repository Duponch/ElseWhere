/** One renderer-local cache per canonical family. The existing registry is
 * the only queue and transaction coordinator; stable frames do no census. */
import * as THREE from 'three/webgpu';
import {attribute} from 'three/tsl';
import type {GraphicsStyleContext} from '../../../graphics-style';
import type {SharedSurfacePreparationOwner,SharedSurfacePreparationSnapshot,SharedSurfacePreparationStage} from '../../../surfaces/SharedSurfacePreparation';
import {PreparedTextureSurface,type PreparedTextureSurfaceOptions} from '../../../surfaces/PreparedTextureSurface';
import {PreparedSurfaceAdmissionRefusal,type PreparedSurfaceSource,type PreparedSurfaceVariant,type PreparedSurfaceGpuResult,type PreparedSurfacePlan,type PreparedSurfacePresentation} from './PreparedSurfaceTypes';
import {PreparedSurfaceAddressBook,compilePreparedSurfaceAddresses} from './PreparedSurfaceAddressBook';
import {planPreparedSurfaces} from './PreparedSurfacePlan';
import {prepareSurfaceGpu} from './PreparedSurfaceGpu';
const MiB=1024*1024;
export const PREPARED_SURFACE_VARIANT='preparedSurfaceVariant';
type Asset={readonly key:string;readonly sourceKey:string;readonly semantic:string;readonly variantIds:readonly number[];readonly plan:PreparedSurfacePlan;readonly gpu:PreparedSurfaceGpuResult};
type Shared={readonly owned:Set<Asset>;readonly families:Set<PreparedSurfaceOwner>};const shared=new WeakMap<GraphicsStyleContext,Shared>();
const familyState=(c:GraphicsStyleContext)=>{let s=shared.get(c);if(!s){s={owned:new Set(),families:new Set()};shared.set(c,s);}return s;};
const paintKey=(c:GraphicsStyleContext)=>{const p=c.preferences;return JSON.stringify(['prepared-rigid-source-v1',c.genericPaintSemanticKey(),p.impasto,p.wear,p.edges,p.blackEdges,p.edgeWidth,p.strokeImperfection,p.contourImperfection,c.paintReplayState().refreshed]);};
export interface PreparedSurfaceOwnerOptions {
 readonly key:string;readonly context:GraphicsStyleContext;readonly source:()=>PreparedSurfaceSource;
 readonly changed:()=>void;readonly maxCellPixels?:number;readonly returnCellPixels?:number;
 readonly maxCpuBytes?:number;readonly maxRetainedGpuBytes?:number;readonly maxPeakGpuBytes?:number;
 /** Other family owners (e.g. existing fixed trees) remain independently owned. */
 readonly externalGpuBytes?:()=>number;
 /** CPU canonical models retained outside the generic atlas asset records. */
 readonly externalCpuBytes?:()=>number;
 readonly cacheIdentity?:()=>string;
 readonly hasExternalDemand?:()=>boolean;
 readonly minPageSize?:PreparedSurfacePlan['size'];
 /** CPU-resolved merged families declare that they do not own a GPU lookup. */
 readonly useAddressBook?:boolean;
 /** Borrowed attribute publication participates in the SAME registry hold and
  * lifetime transfer as texture publication, including cache hits and restores. */
 readonly stagePresentation?:(presentation:PreparedSurfacePresentation,snapshot:SharedSurfacePreparationSnapshot,assertCurrent:()=>void)=>SharedSurfacePreparationStage|Promise<SharedSurfacePreparationStage>;
 readonly compileAddresses?:(plan:PreparedSurfacePlan,ids:readonly number[],defaultData:Float32Array)=>Float32Array;
 readonly prepareGpu?:(renderer:THREE.WebGPURenderer,plan:PreparedSurfacePlan,paint:NonNullable<SharedSurfacePreparationSnapshot['paintSource']>,assertCurrent:()=>void,prepareDefault:()=>Promise<PreparedSurfaceGpuResult>)=>Promise<PreparedSurfaceGpuResult>;
}
export type PreparedSurfaceTargetOptions=Omit<PreparedTextureSurfaceOptions,'context'|'address'|'resources'>&{
 readonly faceId?:THREE.Node<'float'>;readonly chartUv?:THREE.Node<'vec2'>;
 readonly address?:(book:PreparedSurfaceAddressBook)=>ReturnType<PreparedSurfaceAddressBook['address']>;
 readonly addressWithoutBook?:()=>ReturnType<PreparedSurfaceAddressBook['address']>;
 readonly variantId?:THREE.Node<'float'>;readonly resources?:PreparedTextureSurfaceOptions['resources'];
};
export class PreparedSurfaceOwner implements SharedSurfacePreparationOwner {
 readonly key:string;private readonly addressBook:PreparedSurfaceAddressBook|undefined;
 /** Legacy book families retain their definite API; no-book families allocate
  * neither a dummy node nor a storage attribute merely to satisfy this getter. */
 get book():PreparedSurfaceAddressBook{if(!this.addressBook)throw Error('This prepared family explicitly has no address book');return this.addressBook;}
 private readonly presentations=new Set<SharedSurfacePreparationStage>();
 private readonly state:Shared;private readonly unregister:()=>void;private readonly unregisterDensity:()=>void;
 private readonly surfaces=new Map<THREE.NodeMaterial,PreparedTextureSurface>();private readonly variants=new Map<string,{id:number;value:PreparedSurfaceVariant}>();
 private readonly byId=new Map<number,PreparedSurfaceVariant>();private active:readonly number[]=[];private readonly owned=new Set<Asset>();private current:Asset|undefined;
 private readonly contributions=new Map<unknown,ReadonlySet<number>>();private readonly references=new Map<number,number>();
 private targetGpuBytes=0;private targetCpuBytes=0;
 private qualityRequested:'source'|'prepared'|undefined;private qualityPublished:'source'|'prepared'|undefined;
 private dirty=true;private closed=false;private pending=false;private publishedStyle:string|undefined;private semantic='';private publishedCacheIdentity='';private eligible=false;private desiredTier:'source'|'screen'='source';private publishedTier:'source'|'screen'='source';private fallback:string|undefined;
 constructor(readonly options:PreparedSurfaceOwnerOptions){this.addressBook=options.useAddressBook===false?undefined:new PreparedSurfaceAddressBook();this.key='prepared-surface:'+options.key;this.state=familyState(options.context);this.unregister=options.context.surfacePreparation.register(this);try{this.unregisterDensity=options.context.surfacePreparation.registerDensityConsumer({key:this.key,maxCellPixels:options.maxCellPixels??128,returnCellPixels:options.returnCellPixels??112,isEligible:()=>this.eligible&&options.context.origami,onCrossing:(_mode,_pixels,tier)=>{if(this.desiredTier===tier)return false;this.desiredTier=tier;this.invalidate();return true;}});}catch(error){this.unregister();throw error;}this.state.families.add(this);}
 /** Constructor/real geometry-writer only. Same material is returned before
  * first Pastel, for both encodings and every subsequent texture publication. */
 addTarget(options:PreparedSurfaceTargetOptions):THREE.NodeMaterial{
  const existing=this.surfaces.get(options.sourceMaterial);if(existing)return existing.material;
  const supplied=options.resources,book=this.addressBook;if(!book&&!options.addressWithoutBook)throw Error('No-book target needs a complete resolved address');const resources={get textures(){return supplied?.textures??[];},get arrayTextures(){return supplied?.arrayTextures??[];},get sharedGroups(){return supplied?.sharedGroups??[];},get storage(){return[...(book?[book.buffer]:[]),...(supplied?.storage??[])];},get objectUniforms(){return supplied?.objectUniforms??[];}};
  const surface=new PreparedTextureSurface({...options,context:this.options.context,resources,address:()=>{if(options.addressWithoutBook)return options.addressWithoutBook();if(!book)throw Error('Prepared address book is unavailable');if(options.address)return options.address(book);if(!options.faceId||!options.chartUv)throw Error('Prepared target needs actual Source face/UV address');return book.address(this.options.context,options.variantId??attribute(PREPARED_SURFACE_VARIANT,'float'),options.faceId,options.chartUv);}});surface.selectRepresentation('source');this.surfaces.set(options.sourceMaterial,surface);const pixels=(options.pastelSize??64)**2;this.targetCpuBytes+=pixels*8;this.targetGpuBytes+=(pixels*4-1)/3*8;this.invalidate();return surface.material;
 }
 selectedMaterial(source:THREE.NodeMaterial):THREE.NodeMaterial{return this.surfaces.get(source)?.material??source;}
 requestQualityRoute(route:'source'|'prepared'|undefined):void{if(this.closed)throw Error('Prepared family retired');this.qualityRequested=route;this.invalidate();}
 get materials(){return[...this.surfaces.values()].map(s=>s.material);}
 /** Canonical semantic variants, shared by every identical real instance.
  * No World, UUID, translation, colour or count belongs in this key. */
 registerVariant(value:PreparedSurfaceVariant):number{if(this.closed)throw Error('Prepared family retired');const previous=this.variants.get(value.key);if(previous){if(previous.value.model.key!==value.model.key||previous.value.linear.some((n,i)=>!Object.is(n,value.linear[i]))||previous.value.maxUniformScale!==value.maxUniformScale||previous.value.format!==value.format)throw Error('Canonical variant semantic collision');return previous.id;}const id=this.variants.size;if(id>=16777215)throw new PreparedSurfaceAdmissionRefusal('Exact f32 variant capacity exceeded');this.variants.set(value.key,{id,value});this.byId.set(id,value);return id;}
 setContribution(key:unknown,ids:Iterable<number>):void{const next=new Set(ids),old=this.contributions.get(key)??new Set<number>();for(const id of old)if(!next.has(id)){const n=this.references.get(id)!-1;if(n)this.references.set(id,n);else this.references.delete(id);}for(const id of next)if(!old.has(id))this.references.set(id,(this.references.get(id)??0)+1);if(next.size)this.contributions.set(key,next);else this.contributions.delete(key);this.setDemand(this.references.keys());}
 setDemand(ids:Iterable<number>):void{if(this.closed)return;const next=[...new Set(ids)].sort((a,b)=>a-b);if(next.some(id=>!this.byId.has(id)))throw Error('Register actual canonical variants before publication');if(next.length===this.active.length&&next.every((id,i)=>id===this.active[i]))return;this.active=Object.freeze(next);this.invalidate();}
 invalidate():void{if(this.closed)return;this.dirty=true;this.options.context.surfacePreparation.invalidate();}
 needsPreparation(snapshot:SharedSurfacePreparationSnapshot):boolean{return!this.closed&&(this.dirty||this.semantic!==paintKey(this.options.context)||this.publishedStyle!==snapshot.preferences.style||this.publishedTier!==this.desiredTier||this.publishedCacheIdentity!==(this.options.cacheIdentity?.()??'')||this.qualityRequested!==this.qualityPublished);}
 async stage(snapshot:SharedSurfacePreparationSnapshot,assertCurrent:()=>void):Promise<SharedSurfacePreparationStage>{
  if(this.closed||this.pending)throw Error('Prepared canonical family unavailable');assertCurrent();
  const context=this.options.context,semantic=paintKey(context),source=this.options.source(),identity=this.options.cacheIdentity?.()??'',sourceKey=JSON.stringify([source.key,identity]),ids=this.active,previous=this.current,
   old={quality:this.qualityPublished,fallback:this.fallback,eligible:this.eligible,publishedStyle:this.publishedStyle,publishedTier:this.publishedTier,desiredTier:this.desiredTier,surfaces:[...this.surfaces.values()].map(s=>({s,assets:s.assets,representation:s.snapshot().representation}))},
   gouache=snapshot.preferences.style==='origami',positive=snapshot.preferences.impasto>0||snapshot.preferences.wear>0,density=snapshot.density,max=this.options.maxCellPixels??128,low=this.options.returnCellPixels??112,initial=this.publishedStyle!==snapshot.preferences.style,
   tier=density?.mode==='orthographic'&&density.physicalCellPixels>0&&(initial||this.desiredTier==='screen'?density.physicalCellPixels<=max:density.physicalCellPixels<=low)?'screen':'source';
  this.pending=true;
  let next=previous,candidate:Asset|undefined,lookup:ReturnType<PreparedSurfaceAddressBook['stage']>|undefined,presentation:SharedSurfacePreparationStage|undefined,
   reason:string|undefined,eligible=false,prepared=false,published=false,commitStarted=false,committed=false,rolledBack=false,disposed=false;
  const current=()=>{assertCurrent();if(ids!==this.active||semantic!==paintKey(context)||identity!==(this.options.cacheIdentity?.()??''))throw Error('Actual canonical demand changed');};
  const pure=()=>!positive&&(!gouache||!!(prepared&&next&&tier==='screen'&&this.qualityRequested!=='source'));
  const stagePresentation=async()=>{
   if(!this.options.stagePresentation)return;
   const selected=gouache&&pure()?next:undefined;
   presentation=await this.options.stagePresentation({plan:selected?.plan,variantIds:selected?.variantIds??ids,representation:pure()?'pure':'source',gouache},snapshot,current);
   this.presentations.add(presentation);current();
  };
  const disposePresentation=()=>{if(!presentation||!this.presentations.has(presentation))return;presentation.dispose();this.presentations.delete(presentation);};
  const retireCandidate=()=>{if(!candidate)return;this.retire(candidate);candidate=undefined;};
  const abandonStaging=(error:unknown):never=>{
   const errors=[error];try{disposePresentation();}catch(cleanup){errors.push(cleanup);}try{lookup?.dispose();}catch(cleanup){errors.push(cleanup);}try{retireCandidate();}catch(cleanup){errors.push(cleanup);}this.pending=false;
   throw errors.length===1?error:new AggregateError(errors,'Prepared family staging quarantine');
  };
  try{
   if(!ids.length&&!this.options.hasExternalDemand?.()){reason='no-active-canonical-variants';next=undefined;}
   else if(!gouache)reason=positive?'positive-effects-Source':'Pastel-original';
   else if(positive)reason='positive-effects-Source';
   else if(!snapshot.world||!density)reason='catalog-or-unknown-density-Source-no-bake';
   else{
    eligible=true;source.assertCurrent();
    const reusable=previous&&previous.sourceKey===sourceKey&&previous.semantic===semantic&&ids.every(id=>previous.variantIds.includes(id));
    if(reusable){previous.gpu.assertCurrent();prepared=true;next=previous;}
    else if(tier==='source')reason='projection-or-near-Source-no-unused-bake';
    else{
     const maxCpu=this.options.maxCpuBytes??256*MiB,maxPeak=this.options.maxPeakGpuBytes??1024*MiB,
      oldGpu=[...this.state.owned].reduce((n,a)=>n+a.gpu.gpuBytes,0),oldCpu=[...this.state.owned].reduce((n,a)=>n+a.gpu.cpuBytes+a.plan.retainedCpuBytes,0),
      other=[...this.state.families].reduce((n,f)=>n+(f.addressBook?.gpuUpperBytes??0)+f.targetGpuBytes,0)+(this.options.externalGpuBytes?.()??0),values=ids.map(id=>this.byId.get(id)!),
      plan=planPreparedSurfaces(source,values,{maxCpuBytes:maxCpu,maxRetainedGpuBytes:(this.options.maxRetainedGpuBytes??512*MiB)-oldGpu,maxPeakGpuBytes:maxPeak,oldLiveGpuBytes:oldGpu,otherLiveGpuBytes:other,oldLiveCpuBytes:oldCpu+[...this.state.families].reduce((n,f)=>n+(f.addressBook?.cpuBytes??0)+f.targetCpuBytes+(f.options.externalCpuBytes?.()??0),0),maxPages:256,maxFaces:Math.floor(128*MiB/32)},{maxPhysicalCellPixels:max,oversampling:4,paintKey:semantic,minPageSize:this.options.minPageSize,allowEmpty:!!this.options.hasExternalDemand?.()});
     let reservedPlan=plan;
     if(this.addressBook){
      const addresses=compilePreparedSurfaceAddresses(plan,ids),addressData=this.options.compileAddresses?.(plan,ids,addresses.data)??addresses.data;
      lookup=this.addressBook.stage(addressData);reservedPlan={...plan,limits:{...plan.limits,otherLiveGpuBytes:plan.limits.otherLiveGpuBytes+lookup.stats.newGpuBytes,oldLiveCpuBytes:plan.limits.oldLiveCpuBytes+addressData.byteLength+lookup.stats.newGpuBytes+lookup.stats.undoCpuBytes}};
     }
     const paint=snapshot.paintSource;if(!paint)throw Error('One current Core paint lease required');
     const guard=()=>{current();source.assertCurrent();paint.assertCurrent();},prepareDefault=()=>prepareSurfaceGpu(snapshot.renderer,reservedPlan,paint,guard),
      gpu=await(this.options.prepareGpu?this.options.prepareGpu(snapshot.renderer,reservedPlan,paint,guard,prepareDefault):prepareDefault());
     candidate={key:plan.key,sourceKey,semantic,variantIds:ids,plan,gpu};this.owned.add(candidate);this.state.owned.add(candidate);next=candidate;prepared=true;
    }
   }
   // Every route stages presentation, including first Pastel and cached Gouache.
   // A fresh resident cohort may need new addresses without another GPU bake.
   await stagePresentation();
  }catch(error){
   if(!(error instanceof PreparedSurfaceAdmissionRefusal))return abandonStaging(error);
   reason=error.message;prepared=false;next=previous;
   try{disposePresentation();presentation=undefined;lookup?.dispose();lookup=undefined;retireCandidate();await stagePresentation();}
   catch(cleanup){abandonStaging(new AggregateError([error,cleanup],'Prepared family refusal Source restoration failed'));}
  }
  const restore=()=>{
   if(committed||commitStarted)throw Error('Transferred family cannot roll back');if(rolledBack)return;
   if(published){
    const errors:unknown[]=[];
    // Reverse publication order; failures retain every stage/asset for retry.
    for(const row of old.surfaces)try{row.s.setAssets(row.assets);row.s.selectRepresentation(row.representation);}catch(error){errors.push(error);}
    try{presentation?.rollback();}catch(error){errors.push(error);}try{lookup?.rollback();}catch(error){errors.push(error);}
    this.current=previous;this.qualityPublished=old.quality;this.fallback=old.fallback;this.eligible=old.eligible;this.publishedStyle=old.publishedStyle;this.publishedTier=old.publishedTier;this.desiredTier=old.desiredTier;
    try{this.options.changed();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Prepared family rollback quarantine');
   }
   rolledBack=true;
  };
  return{
   publish:()=>{
    if(disposed||published||rolledBack)throw Error('Prepared family stage superseded');current();
    if(this.qualityRequested==='prepared'&&(!gouache||!prepared||tier!=='screen'))throw Error('Prepared witness requires actual admission at this pixel density');
    published=true;lookup?.publish();presentation?.publish();this.current=next;this.qualityPublished=this.qualityRequested;this.fallback=this.qualityRequested==='source'?'diagnostic-Source':reason;this.eligible=eligible;this.publishedStyle=snapshot.preferences.style;this.publishedTier=this.desiredTier=tier;
    for(const surface of this.surfaces.values()){
     if(!gouache&&!positive){surface.setAssets(undefined);surface.selectRepresentation('pure');}
     else if(prepared&&next&&tier==='screen'&&this.qualityRequested!=='source'){surface.setAssets({texture:next.gpu.texture,assertCurrent:()=>next!.gpu.assertCurrent()});surface.selectRepresentation('pure');surface.assertReady();}
     else surface.selectRepresentation('source');
    }
    this.options.changed();
   },
   commit:()=>{
    if(committed)return;if(!published||rolledBack)throw Error('Publish the complete family before commit');current();
    commitStarted=true;lookup?.commit();presentation?.commit();committed=true;this.semantic=semantic;this.publishedCacheIdentity=identity;this.dirty=false;
    if(previous&&previous!==next)this.retire(previous);
   },
   rollback:restore,
   dispose:()=>{
    if(disposed)return;
    try{
     // A partially transferred owner is intentionally retained: releasing its
     // candidate or attribute undo would claim a rollback that never happened.
     if(commitStarted&&!committed)throw Error('Prepared family transfer quarantined; live bindings retained');
     if(!committed&&!rolledBack)restore();disposePresentation();lookup?.dispose();if(!committed)retireCandidate();disposed=true;
    }finally{this.pending=false;}
   },
   stats:{family:this.options.key,variants:ids.length,prepared,reason,layers:next?.plan.layers??0},
  };
 }

 status(){const pure=[...this.surfaces.values()].every(surface=>surface.snapshot().representation==='pure'),cached=!!this.current&&this.current.semantic===paintKey(this.options.context)&&this.active.every(id=>this.current!.variantIds.includes(id)),ready=!this.pending&&this.options.context.origami&&!this.options.context.reliefEnabled&&!this.options.context.wearEnabled&&pure&&cached&&this.publishedTier==='screen';return{ready,readyVariants:ready?this.active.length:0,cachedAdmission:cached,pipeline:'prepared-rigid-family',qualityRoute:this.qualityPublished??null,family:this.options.key,hasExternalDemand:!!this.options.hasExternalDemand?.(),hasActualDemand:this.active.length>0||!!this.options.hasExternalDemand?.(),activeVariants:this.active.length,cachedVariants:this.current?.variantIds.length??0,registeredVariants:this.variants.size,representation:[...this.surfaces.values()].some(s=>s.snapshot().representation==='source')?'source':'pure',tier:this.publishedTier,desiredTier:this.desiredTier,layers:(this.current?.gpu.texture.image as {depth?:number}|undefined)?.depth??0,pages:this.current?.gpu.pages.length??0,gpuBytes:[...this.owned].reduce((n,a)=>n+a.gpu.gpuBytes,0),cpuBytes:(this.addressBook?.cpuBytes??0)+this.targetCpuBytes+[...this.owned].reduce((n,a)=>n+a.gpu.cpuBytes+a.plan.retainedCpuBytes,0),lookupGpuUpperBytes:this.addressBook?.gpuUpperBytes??0,pastelCopiesGpuBytes:this.targetGpuBytes,fallback:this.fallback??null,pending:this.pending};}
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{this.addressBook?.attachGpuRetirement(geometries);}
 private retire(asset:Asset):void{if(!this.owned.has(asset))return;asset.gpu.dispose();this.owned.delete(asset);this.state.owned.delete(asset);}
 dispose():void{if(this.closed)return;if(this.pending)throw Error('Settle the canonical family before close');const errors:unknown[]=[];for(const stage of this.presentations)try{stage.dispose();this.presentations.delete(stage);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Prepared presentation close quarantine');for(const asset of this.owned)try{this.retire(asset);}catch(error){errors.push(error);}for(const[original,surface]of this.surfaces)try{surface.dispose();this.surfaces.delete(original);}catch(error){errors.push(error);}try{this.addressBook?.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Prepared canonical family close quarantine');this.unregisterDensity();this.unregister();this.state.families.delete(this);this.closed=true;this.current=undefined;}
}
