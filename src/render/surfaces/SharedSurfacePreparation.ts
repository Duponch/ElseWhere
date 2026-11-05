import type {World} from '../../sim/types';
import type {GraphicsStylePreferences} from '../../ui3d/native-preferences';
import type {WebGPURenderer} from 'three/webgpu';
import type {GraphicsStyleContext} from '../graphics-style';

export interface SharedSurfacePreparationSnapshot {
 readonly preferences:Readonly<GraphicsStylePreferences>;
 readonly world:World|undefined;
 readonly reset:boolean;
 readonly reason:'initial'|'settings'|'world'|'paint';
 readonly epoch:number;
 readonly renderer:WebGPURenderer;
 readonly paintRevision:number;
 readonly paintSource?:ReturnType<GraphicsStyleContext['prepareAtlasPaint']>;
 readonly density?:Readonly<{mode:'orthographic'|'perspective';physicalCellPixels:number}>;
}
/** publish changes only borrowed bindings/coefficients. commit transfers lifetime
 * after ALL owners published and the real programs uploaded/compiled. */
export interface SharedSurfacePreparationStage {
 publish():void;
 commit():void;
 rollback():void;
 dispose():void;
 readonly stats?:unknown;
}
export interface SharedSurfacePreparationOwner {
 readonly key:string;
 needsPreparation(snapshot:SharedSurfacePreparationSnapshot):boolean;
 stage(snapshot:SharedSurfacePreparationSnapshot,assertCurrent:()=>void):SharedSurfacePreparationStage|Promise<SharedSurfacePreparationStage>;
}
export interface SharedSurfaceDensityConsumer {
 readonly key:string;
 readonly maxCellPixels:number;
 readonly returnCellPixels:number;
 /** Evaluated only after a global preparation commit, never by stable frames. */
 isEligible():boolean;
 /** Called only on a real threshold/mode crossing, before the existing hold. */
 onCrossing(mode:'orthographic'|'perspective',physicalCellPixels:number,tier:'source'|'screen'):boolean|void;
}
type DensityRow={consumer:SharedSurfaceDensityConsumer;eligible:boolean;tier:'source'|'screen';initialized:boolean};
type BatchState='staged'|'published'|'committed'|'rolled-back'|'quarantined'|'disposed';
export interface SharedSurfacePreparationBatch extends SharedSurfacePreparationStage {
 readonly state:BatchState;
 readonly ownerKeys:readonly string[];
}

/** Renderer-local references only, NOT another GPU/texture owner. Owners retain
 * their canonical tables/textures; registrations end at their actual disposal.
 * No scene census, timer or frame callback exists in this coordinator. */
export class SharedSurfacePreparationRegistry {
 private readonly owners=new Map<string,SharedSurfacePreparationOwner>();
 private readonly retained=new Set<SharedSurfacePreparationBatch>();
 private readonly stagedReferences=new Set<SharedSurfacePreparationStage>();
 private revision=0;private settledRevision=0;private closed=false;
 private active=false;
 private readonly densityConsumers=new Map<string,DensityRow>();
 private densityCount=0;private densityLower=-Infinity;private densityUpper=Infinity;
 private densityMode:'orthographic'|'perspective'|undefined;private densityValid=false;private densityStyle:string|undefined;
 get hasDensityConsumers():boolean{return this.densityCount!==0;}
 registerDensityConsumer(consumer:SharedSurfaceDensityConsumer):()=>void{
  if(this.closed||!consumer.key||this.densityConsumers.has(consumer.key)||!Number.isFinite(consumer.maxCellPixels)||!Number.isFinite(consumer.returnCellPixels)||consumer.maxCellPixels<=0||consumer.returnCellPixels<=0||consumer.returnCellPixels>consumer.maxCellPixels)throw Error('Unique bounded surface density consumer required');
  this.densityConsumers.set(consumer.key,{consumer,eligible:false,tier:'source',initialized:false});let registered=true;
  return()=>{if(!registered)return;registered=false;this.densityConsumers.delete(consumer.key);this.rebuildDensityInterval();};
 }
 private rebuildDensityInterval():void{
  this.densityCount=0;this.densityLower=-Infinity;this.densityUpper=Infinity;
  for(const row of this.densityConsumers.values())if(row.eligible){this.densityCount++;if(row.tier==='screen')this.densityUpper=Math.min(this.densityUpper,row.consumer.maxCellPixels);else this.densityLower=Math.max(this.densityLower,row.consumer.returnCellPixels);}
 }
 private seedDensity(snapshot:SharedSurfacePreparationSnapshot):void{
  const density=snapshot.density,valid=density?.mode==='orthographic'&&Number.isFinite(density.physicalCellPixels)&&density.physicalCellPixels>0,initial=this.densityStyle!==snapshot.preferences.style;
  for(const row of this.densityConsumers.values()){
   row.eligible=snapshot.preferences.style==='origami'&&snapshot.preferences.impasto===0&&snapshot.preferences.wear===0&&row.consumer.isEligible();
   const p=density?.physicalCellPixels??Infinity;
   row.tier=!valid?'source':initial||!row.initialized?(p<=row.consumer.maxCellPixels?'screen':'source'):row.tier==='screen'?(p>row.consumer.maxCellPixels?'source':'screen'):(p<=row.consumer.returnCellPixels?'screen':'source');
   row.initialized=!!density;
  }
  this.densityMode=density?.mode;this.densityValid=valid;this.densityStyle=snapshot.preferences.style;this.rebuildDensityInterval();
 }
 /** One interval/mode comparison when stable. Different owner thresholds remain
  * independent; the nearest crossing is recalculated only at a transition or
  * preparation boundary. No owner scan/allocation/queue is added to that path. */
 observeDensity(mode:'orthographic'|'perspective',physicalCellPixels:number):boolean{
  if(this.closed||!this.densityCount)return false;
  const valid=mode==='orthographic'&&Number.isFinite(physicalCellPixels)&&physicalCellPixels>0;
  if(mode===this.densityMode&&valid===this.densityValid&&(!valid||physicalCellPixels>this.densityLower&&physicalCellPixels<=this.densityUpper))return false;
  let changed=false;
  for(const row of this.densityConsumers.values())if(row.eligible){const p=physicalCellPixels,next=!valid?'source':!row.initialized?(p<=row.consumer.maxCellPixels?'screen':'source'):row.tier==='screen'?(p>row.consumer.maxCellPixels?'source':'screen'):(p<=row.consumer.returnCellPixels?'screen':'source');if(next!==row.tier){row.consumer.onCrossing(mode,p,next);row.tier=next;changed=true;}row.initialized=true;}
  this.densityMode=mode;this.densityValid=valid;this.rebuildDensityInterval();return changed;
 }
 get dirty():boolean{return this.revision!==this.settledRevision;}
 invalidate():void{if(!this.closed)this.revision++;}
 register(owner:SharedSurfacePreparationOwner):()=>void{
  if(this.closed||!owner.key||this.owners.has(owner.key))throw Error('Unique live shared surface owner required');
  this.owners.set(owner.key,owner);this.invalidate();let registered=true;
  return()=>{if(!registered)return;registered=false;if(this.owners.get(owner.key)===owner){this.owners.delete(owner.key);this.invalidate();}};
 }
 /** Operation boundary only. A producer uses its actual dirty revisions; this
  * does not inspect a Scene, geometry vertices or paint residency. */
 needsPreparation(snapshot:SharedSurfacePreparationSnapshot):boolean{
  if(this.closed)throw Error('Shared surface registry closed');
  return this.dirty||[...this.owners.values()].some(owner=>owner.needsPreparation(snapshot));
 }
 async stage(snapshot:SharedSurfacePreparationSnapshot,assertCurrent:()=>void):Promise<SharedSurfacePreparationBatch>{
  if(this.closed||this.active)throw Error('One exclusive shared surface preparation required');
  this.active=true;const revision=this.revision,stages:{owner:SharedSurfacePreparationOwner;stage:SharedSurfacePreparationStage}[]=[];
  const current=()=>{assertCurrent();if(this.closed||revision!==this.revision)throw Error('Shared surface demand changed during preparation');};
  const failures:unknown[]=[];
  try{
   current();for(const owner of this.owners.values())if(owner.needsPreparation(snapshot)){const stage=await owner.stage(snapshot,current);this.stagedReferences.add(stage);stages.push({owner,stage});current();}
  }catch(error){failures.push(error);for(const{stage}of stages.toReversed())try{stage.dispose();this.stagedReferences.delete(stage);}catch(cleanup){failures.push(cleanup);}this.active=false;if(failures.length>1)throw new AggregateError(failures,'Shared surface staging cleanup failed');throw error;}
  let state:BatchState='staged',published=0,committed=0;
  const batch:SharedSurfacePreparationBatch={
   get state(){return state;},ownerKeys:Object.freeze(stages.map(row=>row.owner.key)),
   publish:()=>{if(state!=='staged')throw Error('Only a staged shared surface batch may publish');current();try{for(const row of stages){row.stage.publish();published++;}state='published';}catch(error){const errors=[error];for(let i=published;i>=0;i--)if(stages[i])try{stages[i]!.stage.rollback();}catch(cleanup){errors.push(cleanup);}state=errors.length>1?'quarantined':'rolled-back';throw errors.length>1?new AggregateError(errors,'Shared surface publication rollback failed'):error;}},
   commit:()=>{if(state==='committed')return;if(state!=='published')throw Error('Only the complete published batch may commit');current();try{for(const row of stages){row.stage.commit();committed++;}this.seedDensity(snapshot);state='committed';this.settledRevision=revision;}catch(error){state='quarantined';throw new AggregateError([error],'Shared surface owner transfer failed after '+committed+' commits; live bindings retained');}},
   rollback:()=>{if(state==='rolled-back'||state==='disposed')return;if(state==='committed'||committed)throw Error('Committed shared surface ownership cannot roll back');const errors:unknown[]=[];for(const{stage}of stages.toReversed())try{stage.rollback();}catch(error){errors.push(error);}state=errors.length?'quarantined':'rolled-back';if(errors.length)throw new AggregateError(errors,'Shared surface rollback quarantined');},
   dispose:()=>{if(state==='disposed')return;const errors:unknown[]=[];if(state==='staged'||state==='published')try{batch.rollback();}catch(error){errors.push(error);}for(const{stage}of stages.toReversed())if(this.stagedReferences.has(stage))try{stage.dispose();this.stagedReferences.delete(stage);}catch(error){errors.push(error);}if(errors.length){state='quarantined';throw new AggregateError(errors,'Shared surface stage cleanup quarantined');}state='disposed';this.retained.delete(batch);this.active=false;},
  };
  this.retained.add(batch);return batch;
 }
 /** O(1) safety latch only. No descriptor/owner iteration in stable rendering. */
 assertReadyForDraw():void{if(this.closed||this.active||this.dirty)throw Error('Shared surface preparation must settle before drawing');}
 snapshot(){return{owners:this.owners.size,revision:this.revision,settledRevision:this.settledRevision,active:this.active,retained:this.retained.size,stagedReferences:this.stagedReferences.size,closed:this.closed};}
 dispose():void{this.closed=true;const errors:unknown[]=[];for(const batch of [...this.retained])try{batch.dispose();}catch(error){errors.push(error);}if(!this.retained.size)for(const stage of [...this.stagedReferences])try{stage.dispose();this.stagedReferences.delete(stage);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Shared surface coordinator close quarantined');this.owners.clear();this.densityConsumers.clear();this.densityCount=0;this.active=false;}
}
