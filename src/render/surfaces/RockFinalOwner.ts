/** PRIVATE A/B transaction owner. The existing global registry is the only
 * scheduler; a stable frame performs no owner census, allocation or GPU work. */
import type {SharedSurfacePreparationOwner,SharedSurfacePreparationSnapshot,SharedSurfacePreparationStage} from './SharedSurfacePreparation';
import {RockFinalAdmissionRefusal,type RockFinalGpuBank,type RockFinalGpuPort,type RockFinalHost,type RockFinalInput,type RockFinalPublication,type RockFinalRuntimePlan} from './RockFinalRuntimeTypes';
type Bank={readonly gpu:RockFinalGpuBank;readonly stale:Set<number>};
type Asset={input:RockFinalInput;plan:RockFinalRuntimePlan;semantic:string;active:Bank;inactive?:Bank};
export interface RockFinalOwnerOptions {
 readonly host:RockFinalHost;readonly gpu:RockFinalGpuPort;
 /** Previous layout is immutable metadata: its old Source revision is expected
  * to be stale after a real writer. Retain rectangles; never repack on mining. */
 readonly plan:(input:RockFinalInput,snapshot:SharedSurfacePreparationSnapshot,previous:RockFinalRuntimePlan|undefined,oldAtlasGpuBytes:number,oldAtlasCpuBytes:number,newBankCopies:0|1)=>RockFinalRuntimePlan;
 readonly maxCellPixels:number;readonly returnCellPixels:number;
}
const semantic=(s:SharedSurfacePreparationSnapshot)=>{const p=s.preferences;return JSON.stringify([p.impasto,p.wear,p.edges,p.blackEdges,p.edgeWidth,p.strokeImperfection,p.contourImperfection,s.paintRevision]);};
export class RockFinalOwner implements SharedSurfacePreparationOwner {
 readonly preparationPriority=1000;
 readonly key='rock-final-rgba-v1';private readonly unregister:()=>void;private readonly unregisterDensity:()=>void;
 private closed=false;private pending=false;private dirty=true;private full=true;private serial=0;
 private dirtyCells=new Set<number>();private dirtyFaces=new Set<number>();private current:Asset|undefined;
 private publication:RockFinalPublication={route:'source',style:'default'};private publishedSemantic='';
 private desiredTier:'source'|'screen'='source';private publishedTier:'source'|'screen'='source';private eligible=false;
 private qualityRequested:'source'|'prepared'|undefined;private qualityPublished:'source'|'prepared'|undefined;
 private readonly owned=new Set<RockFinalGpuBank>();private readonly quarantine=new Set<RockFinalGpuBank>();
 private readonly retiring=new Map<RockFinalGpuBank,Promise<void>>();private readonly retirementErrors=new Map<RockFinalGpuBank,unknown>();
 private refusal:string|undefined;private lastSnapshot:SharedSurfacePreparationSnapshot|undefined;
 constructor(readonly options:RockFinalOwnerOptions){
  const registry=options.host.context.surfacePreparation;this.unregister=registry.register(this);
  try{this.unregisterDensity=registry.registerDensityConsumer({key:this.key,maxCellPixels:options.maxCellPixels,returnCellPixels:options.returnCellPixels,isEligible:()=>this.eligible,onCrossing:(_mode,_pixels,tier)=>{if(this.desiredTier===tier)return false;this.desiredTier=tier;this.invalidate();return true;}});}catch(error){this.unregister();throw error;}
 }
 private invalidate():void{if(this.closed)return;this.serial++;this.dirty=true;this.options.host.context.surfacePreparation.invalidate();}
 /** Body dirty is the writer's3x3 halo. Stroke faces include its extra ring,
  * hence the true5x5 stencil footprint. A colour-only change still repaints. */
 changed(bodyCells:Iterable<number>,strokeFaceIds:Iterable<number>,reset=false):void{if(this.closed)return;for(const cell of bodyCells)this.dirtyCells.add(cell);for(const face of strokeFaceIds)this.dirtyFaces.add(face);this.full ||= reset;this.invalidate();}
 texturesChanged():void{this.invalidate();}
 requestQualityRoute(route:'source'|'prepared'|undefined):void{if(this.closed)throw Error('Rock final owner closed');if(route!==this.qualityRequested){this.qualityRequested=route;this.invalidate();}}
 needsPreparation(s:SharedSurfacePreparationSnapshot):boolean{return!this.closed&&(this.dirty||this.publication.style!==s.preferences.style||this.publishedSemantic!==semantic(s)||this.tier(s)!==this.publishedTier);}
 private tier(s:SharedSurfacePreparationSnapshot):'source'|'screen'{const d=s.density;if(d?.mode!=='orthographic'||!Number.isFinite(d.physicalCellPixels)||d.physicalCellPixels<=0)return'source';const first=!this.publishedSemantic||this.publication.style!==s.preferences.style;return(first||this.publishedTier==='screen'?d.physicalCellPixels<=this.options.maxCellPixels:d.physicalCellPixels<=this.options.returnCellPixels)?'screen':'source';}
 private async retire(bank:RockFinalGpuBank,snapshot:SharedSurfacePreparationSnapshot):Promise<void>{if(!this.owned.has(bank))return;this.quarantine.add(bank);try{await this.options.gpu.fence(snapshot);bank.dispose();this.owned.delete(bank);this.quarantine.delete(bank);this.retirementErrors.delete(bank);}catch(error){this.retirementErrors.set(bank,error);throw error;}}
 private retireLater(bank:RockFinalGpuBank,snapshot:SharedSurfacePreparationSnapshot):void{if(this.retiring.has(bank)||!this.owned.has(bank))return;const job=this.retire(bank,snapshot).catch(()=>{}).finally(()=>{this.retiring.delete(bank);});this.retiring.set(bank,job);}
 async stage(snapshot:SharedSurfacePreparationSnapshot,assertCurrent:()=>void):Promise<SharedSurfacePreparationStage>{
  if(this.closed||this.pending)throw Error('One held Rock final stage required');assertCurrent();this.pending=true;
  const serial=this.serial,previous=this.current,oldPublication=this.publication,oldTier=this.publishedTier,oldSemantic=this.publishedSemantic,oldRefusal=this.refusal,oldEligible=this.eligible,oldQuality=this.qualityPublished,targetSemantic=semantic(snapshot),tier=this.tier(snapshot),created:RockFinalGpuBank[]=[];
  let input:RockFinalInput|undefined,next=previous,route:RockFinalPublication['route']='source',reason:string|undefined,presentation:SharedSurfacePreparationStage|undefined,touched:number[]=[];
  const epochCheck=()=>{assertCurrent();if(this.closed||serial!==this.serial)throw Error('Rock final stage superseded by actual Source writer');};
  const check=()=>{epochCheck();input?.assertCurrent();};
  const abandon=async(error:unknown):Promise<never>=>{const errors=[error];for(const bank of created)try{await this.retire(bank,snapshot);}catch(cleanup){errors.push(cleanup);}this.pending=false;throw errors.length===1?error:new AggregateError(errors,'Rock staging resources quarantined');};
  try{
   input=this.options.host.collect(epochCheck);check();
   const p=snapshot.preferences,gouache=p.style==='origami',supported=p.impasto===0&&p.wear===0&&this.options.host.texturesEnabled();
   if(!gouache){route='body';reason='Pastel Source stone';}
   else if(!supported)reason='Positive effects or texture disabled: explicit Source';
   else if(!snapshot.world||tier==='source')reason='Near/perspective/unknown density: explicit Source';
   else{
    const sameSource=previous?.input.revision()===input.revision(),cached=sameSource&&previous?.semantic===targetSemantic&&!this.full;
    if(cached){previous!.active.gpu.assertCurrent();route='prepared';}
    else{
     const oldGpu=[...this.owned].reduce((n,b)=>n+b.gpuBytes,0),oldCpu=(previous?.input.cpuBytes??0)+(previous?.plan.cpuBytes??0)+[...this.owned].reduce((n,b)=>n+b.cpuBytes,0);
     const reusable=!!previous&&!this.full,newBankCopies:0|1=reusable&&previous.inactive?0:1;
     const plan=this.options.plan(input,snapshot,reusable?previous!.plan:undefined,oldGpu,oldCpu,newBankCopies);if(!plan.admitted)throw new RockFinalAdmissionRefusal(plan.refusal??'Unknown/incomplete Rock budget');plan.assertCurrent();
     if(reusable&&(previous!.plan.size!==plan.size||previous!.plan.layers!==plan.layers))throw new RockFinalAdmissionRefusal('Stable Rock layout changed dimensions without replacement admission');
     let target:Bank;
     if(reusable&&previous!.inactive)target=previous!.inactive;
     else{const bank=await this.options.gpu.allocate(snapshot,input,plan,check);this.owned.add(bank);created.push(bank);this.lastSnapshot=snapshot;check();target={gpu:bank,stale:new Set<number>()};if(reusable)for(let page=0;page<plan.layers;page++)target.stale.add(page);}
     const fullBake=!reusable||previous!.semantic!==targetSemantic||this.full,dirty=new Set<number>();
     if(fullBake)for(let page=0;page<plan.layers;page++)dirty.add(page);
     else{
      const oldCharts=new Map(previous!.plan.charts.map(c=>[c.stableKey,c]));
      for(const chart of plan.charts)if(this.dirtyCells.has(chart.cell)||chart.faceIds.some(f=>this.dirtyFaces.has(f))||!oldCharts.has(chart.stableKey))dirty.add(chart.page);
      const now=new Set(plan.charts.map(c=>c.stableKey));for(const old of previous!.plan.charts)if(!now.has(old.stableKey))dirty.add(old.page);
     }
     touched=[...dirty].sort((a,b)=>a-b);
     // A deferred spare starts stale for EVERY allocated page, so its first
     // local edit copies the complete published bank once before dirty bake.
     if(reusable){const sync=[...new Set([...target.stale,...dirty])].sort((a,b)=>a-b);if(sync.length)await this.options.gpu.copyPages(snapshot,previous!.active.gpu,target.gpu,sync,check);check();}
     for(const page of dirty)target.stale.add(page);
     if(touched.length)await this.options.gpu.bakePages(snapshot,input,plan,target.gpu,touched,check);check();
     await this.options.gpu.fence(snapshot);check();
     next={input,plan,semantic:targetSemantic,active:target,...(reusable?{inactive:previous!.active}:{})};route='prepared';
    }
   }
  }catch(error){
   if(!(error instanceof RockFinalAdmissionRefusal))return abandon(error);
   reason=error.message;route='source';for(const bank of created)try{await this.retire(bank,snapshot);}catch(cleanup){return abandon(new AggregateError([error,cleanup],'Rock refusal retirement failed'));}created.length=0;next=previous;
  }
  const binding:RockFinalPublication={route:this.qualityRequested==='source'?'source':route,style:snapshot.preferences.style,input,plan:route==='prepared'?next?.plan:undefined,bank:route==='prepared'?next?.active.gpu:undefined};
  try{if(this.qualityRequested==='prepared'&&(binding.route!=='prepared'||tier!=='screen'))throw new RockFinalAdmissionRefusal('Prepared quality route requires actual pixel-density/budget admission');presentation=this.options.host.stage(binding);check();}catch(error){return abandon(error);}
  let published=false,committed=false,disposed=false,rolledBack=false;
  const rollback=()=>{if(committed)throw Error('Transferred Rock stage cannot roll back');if(rolledBack)return;if(published){presentation!.rollback();this.current=previous;this.publication=oldPublication;this.publishedTier=oldTier;this.publishedSemantic=oldSemantic;this.refusal=oldRefusal;this.eligible=oldEligible;this.qualityPublished=oldQuality;}rolledBack=true;};
  return{
   publish:()=>{check();if(disposed||published||rolledBack)throw Error('Rock stage already settled');published=true;presentation!.publish();this.current=next;this.publication=binding;this.publishedTier=this.desiredTier=tier;this.publishedSemantic=targetSemantic;this.refusal=this.qualityRequested==='source'?'Diagnostic Source':reason;this.eligible=snapshot.preferences.style==='origami'&&snapshot.preferences.impasto===0&&snapshot.preferences.wear===0&&this.options.host.texturesEnabled();this.qualityPublished=this.qualityRequested;},
   commit:()=>{check();if(!published||rolledBack)throw Error('Publish Rock before commit');presentation!.commit();committed=true;if(route==='prepared'&&next&&next!==previous){next.active.stale.clear();if(next.inactive)for(const page of touched)next.inactive.stale.add(page);if(previous){const carried=new Set([next.active.gpu,...(next.inactive?[next.inactive.gpu]:[])]);for(const bank of[previous.active.gpu,...(previous.inactive?[previous.inactive.gpu]:[])])if(!carried.has(bank))this.retireLater(bank,snapshot);}}this.dirty=false;if(route==='prepared'){this.full=false;this.dirtyCells.clear();this.dirtyFaces.clear();}this.lastSnapshot=snapshot;},
   rollback,
   dispose:()=>{if(disposed)return;if(!committed)rollback();presentation!.dispose();if(!committed)for(const bank of created)this.retireLater(bank,snapshot);this.pending=false;disposed=true;},
   stats:{family:'rocks-final',representation:binding.route,tier,reason:reason??null,pages:next?.plan.layers??0,dirtyPages:touched.length,sourceRawUvPreserved:true,sourceKernelInFinalFragment:false,submittedWorkFence:true},
  };
 }
 status(){return{ready:!this.closed&&!this.pending&&!this.dirty&&this.publication.route==='prepared',representation:this.publication.route,tier:this.publishedTier,layers:this.current?.plan.layers??0,density:this.current?.plan.density??0,size:this.current?.plan.size??0,gpuBytes:[...this.owned].reduce((n,b)=>n+b.gpuBytes,0),cpuBytes:(this.current?.input.cpuBytes??0)+(this.current?.plan.cpuBytes??0)+[...this.owned].reduce((n,b)=>n+b.cpuBytes,0),pending:this.pending,dirty:this.dirty,qualityRoute:this.qualityPublished??null,refusal:this.refusal??null,quarantined:this.quarantine.size,closed:this.closed};}
 closeEmpty():void{if(this.closed)return;if(this.pending||this.owned.size||this.retiring.size||this.quarantine.size)throw Error('Live Rock GPU ownership requires asynchronous fence close');this.unregisterDensity();this.unregister();this.current=undefined;this.closed=true;}
 /** Actual terminal close is awaited BEFORE renderer.dispose. On a fence
  * failure, retain banks and report the quarantine instead of claiming free. */
 async close():Promise<void>{if(this.closed)return;if(this.pending)throw Error('Settle the global Rock stage before close');await Promise.all([...this.retiring.values()]);const snapshot=this.lastSnapshot;if(this.owned.size&&!snapshot)throw Error('No live renderer fence for Rock retirement');this.unregisterDensity();this.unregister();const failures:unknown[]=[];for(const bank of [...this.owned])try{await this.retire(bank,snapshot!);}catch(error){failures.push(error);}if(failures.length)throw new AggregateError(failures,'Rock terminal resources quarantined');this.current=undefined;this.closed=true;}
}
