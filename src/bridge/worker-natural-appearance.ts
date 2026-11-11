import {createPlantGrowthReader,harvestable,isPlant,plantGrowthExceedTickBound,plantHarvestMinGrowth} from '../sim/plants';
import {plantLeafless} from '../sim/plant-life';
import {hydroponicBasinAt,readHydroponicCells} from '../sim/hydroponics';
import type {Resource,World} from '../sim/types';
import type {SnapshotMessage} from './snapshots';
import {floraSize,isMedicinalPlant,isResidentCrop,type TypedCropNaturalVisualDelta,type NaturalVisualUpsert} from './natural-appearance-values';
import {CropVisualColumnWriter} from './crop-visual-columns';

type Capture=Pick<Resource,'kind'|'x'|'z'|'stone'|'species'>&{
 size:number;ripe:boolean;leafless:boolean;harvestable:boolean;blighted:boolean;support:boolean;seen:number;
 /** First tick at which these values may differ while the resource record
 * stays the same (naturalVisualDue). */
 due:number;
};
type CropCapture=Pick<Resource,'kind'|'x'|'z'>&{growth:number;leafless:boolean;blighted:boolean;supported:boolean;seen:number};
function same(before:Capture,r:Resource,size:number,ripe:boolean,leafless:boolean,ready:boolean,support:boolean):boolean {
 return before.kind===r.kind&&before.x===r.x&&before.z===r.z&&before.stone===r.stone&&before.species===r.species
  &&Object.is(before.size,size)&&before.ripe===ripe&&before.leafless===leafless&&before.harvestable===ready
  &&before.blighted===!!r.blight&&before.support===support;
}

/** Verification mode (tests, benches): after each delta publication, every
 * non-crop capture is recomputed and compared; a difference throws. */
let verifyNaturalAppearance=false;
export function setNaturalAppearanceVerification(on:boolean):void {verifyNaturalAppearance=on;}
/** plantLeafless: leafless for 6000 ticks after leaflessAt. */
const LEAFLESS_TICKS=6000;
/* First tick at which a non-crop plant's visual values may change while its
 * record does not (a record change is re-read at once, see touched below):
 * - the end of its leafless time;
 * - its next visible size step (floraSize rounds growth up to quarters) and
 *   its harvest threshold, bounded by plantGrowthExceedTickBound from the
 *   record alone, whatever happens meanwhile to roofs, light or terrain;
 * - every publication for healroot, whose hydroponic support follows the
 *   basins (structures), not its record.
 * The bound is only ever earlier than the change, so skipping until then
 * yields the same values as reading every plant at every publication. */
function naturalVisualDue(world:World,r:Resource,readGrowth:()=>number,ready:boolean):number {
 if(r.kind==='healroot')return world.tick;
 let due=Infinity;
 const leaflessAt=r.plantLife?.leaflessAt;
 if(leaflessAt!==undefined&&world.tick-leaflessAt<LEAFLESS_TICKS)due=leaflessAt+LEAFLESS_TICKS;
 if((r.growth??1)!==1&&isPlant(r)){
  if(r.species||isMedicinalPlant(r))due=Math.min(due,plantGrowthExceedTickBound(r,Math.ceil(readGrowth()*4)/4));
  if(!ready)due=Math.min(due,plantGrowthExceedTickBound(r,plantHarvestMinGrowth(r)));
 }
 return due;
}

/** One exact current-value pass; crop values share the existing growth inputs.
 * No forecast, World mutation, second resource pass or gameplay RNG. A
 * non-crop resource whose record did not change since the previous
 * publication is re-read only from its due tick (naturalVisualDue). */
export class WorkerNaturalAppearance {
 private captures=new Map<number,Capture>();private cropCaptures=new Map<number,CropCapture>();
 private epoch=0;private revision=0;private tick=-1;private visit=0;
 clear():void {this.captures.clear();this.cropCaptures.clear();this.epoch=0;this.revision=0;this.tick=-1;this.visit=0;}
 protected canReuseInputs(_world:World,_publication:SnapshotMessage<true>):boolean{return false;}
 capture(world:World,publication:SnapshotMessage<true>):TypedCropNaturalVisualDelta {
  const checkpoint=publication.kind==='checkpoint';
  if(!Number.isSafeInteger(publication.epoch)||publication.epoch<1||!Number.isSafeInteger(publication.revision)||publication.revision<1
   ||publication.world.tick!==world.tick||publication.world.seed!==world.seed||publication.world.width!==world.width
   ||publication.world.height!==world.height||publication.world.schemaVersion!==world.schemaVersion
   ||this.revision>0&&(publication.epoch<this.epoch||publication.epoch===this.epoch&&publication.revision<=this.revision))throw Error('Mismatched natural visual publication');
  if(!checkpoint&&(publication.epoch!==this.epoch||publication.baseRevision!==this.revision
   ||publication.revision!==this.revision+1||world.tick<this.tick))throw Error('Missing natural visual predecessor');
  if(!checkpoint&&this.canReuseInputs(world,publication)){
   const crops=new CropVisualColumnWriter(0).finish([]);
   this.visit++;this.epoch=publication.epoch;this.revision=publication.revision;this.tick=world.tick;
   return {epoch:publication.epoch,revision:publication.revision,baseRevision:publication.baseRevision,tick:world.tick,checkpoint:false,upsert:[],removed:[],crops};
  }
  const staged=new Map<number,Capture>(),cropStaged=new Map<number,CropCapture>(),removed=new Set<number>(),cropRemoved=new Set<number>(),
   upsert:NaturalVisualUpsert[]=[],cropColumns=new CropVisualColumnWriter(world.resources.length),visit=++this.visit,
   physicalRemoved=!checkpoint&&publication.resources?.removed.length?new Set(publication.resources.removed):undefined;
  for(const id of physicalRemoved??[]){if(this.captures.has(id))removed.add(id);if(this.cropCaptures.has(id))cropRemoved.add(id);}
  // Resources whose record changed in this publication (complete upserts,
  // growth and plant-age tuples): their visual values are re-read at once.
  const touched=new Set<number>(),changes=checkpoint?undefined:publication.resources;
  if(changes){
   for(const r of changes.upserted)touched.add(r.id);
   for(const tuples of [changes.growth,changes.life])if(tuples)for(let i=0;i<tuples.length;i+=4)touched.add(tuples[i]!);
  }
  const growth=createPlantGrowthReader(world),supports=readHydroponicCells(world);
  let current:Resource,value:number|undefined;
  // readPlantGrowth returns exactly 1 whenever the stored growth is exactly 1
  // (every branch then yields base or 1), so mature plants skip the reader.
  const matureOrRead=(r:Resource):number=>(r.growth??1)===1?1:growth(r);
  const readGrowth=():number=>value??(value=matureOrRead(current));
  for(let ordinal=0;ordinal<world.resources.length;ordinal++){
   const r=world.resources[ordinal]!,id=r.id;
   if(!Number.isSafeInteger(id)||id<=0||id>=world.nextId)throw Error('Invalid natural visual resource ID');
   if(physicalRemoved?.has(id))throw Error('Natural visual resource is both present and removed');
   const before=staged.get(id)??(!checkpoint?this.captures.get(id):undefined),cropBefore=cropStaged.get(id)??(!checkpoint?this.cropCaptures.get(id):undefined);
   if(before?.seen===visit||cropBefore?.seen===visit)throw Error('Duplicate natural visual resource ID');
   if(before)before.seen=visit;if(cropBefore)cropBefore.seen=visit;
   if(isResidentCrop(r)){
    if(before)removed.add(id);
    const number=matureOrRead(r),leafless=plantLeafless(world,r),blighted=!!r.blight,supported=supports.has(r.z*world.width+r.x);
    if(!Number.isFinite(number)||number<0||number>1)throw Error('Invalid crop visual growth');
    if(cropBefore&&cropBefore.kind===r.kind&&cropBefore.x===r.x&&cropBefore.z===r.z&&Object.is(cropBefore.growth,number)
     &&cropBefore.leafless===leafless&&cropBefore.blighted===blighted&&cropBefore.supported===supported)continue;
    cropStaged.set(id,{kind:r.kind,x:r.x,z:r.z,growth:number,leafless,blighted,supported,seen:visit});
    cropColumns.append(id,ordinal,number,(leafless?1:0)|(blighted?2:0)|(supported?4:0));continue;
   }
   if(cropBefore)cropRemoved.add(id);
   if(!checkpoint&&before&&world.tick<before.due&&!touched.has(id))continue;
   current=r;value=undefined;
   const size=floraSize(world,r,readGrowth),ready=harvestable(world,r,readGrowth),ripe=r.kind==='berries'&&ready,
    leafless=plantLeafless(world,r),support=r.kind==='healroot'&&hydroponicBasinAt(world,r)!==undefined;
   if(!Number.isFinite(size)||size<=0||size>1)throw Error('Invalid natural visual size');
   const due=naturalVisualDue(world,r,readGrowth,ready);
   if(before&&same(before,r,size,ripe,leafless,ready,support)){before.due=due;continue;}
   staged.set(id,{kind:r.kind,x:r.x,z:r.z,stone:r.stone,species:r.species,size,ripe,leafless,harvestable:ready,blighted:!!r.blight,support,seen:visit,due});
   upsert.push({id,ordinal,size,ripe,leafless,harvestable:ready});
  }
  // Finish owned wire buffers BEFORE committing either capture stream.
  const crops=cropColumns.finish(checkpoint?[]:cropRemoved);
  if(checkpoint){this.captures=staged;this.cropCaptures=cropStaged;}
  else {
   for(const id of removed)this.captures.delete(id);for(const [id,capture]of staged)this.captures.set(id,capture);
   for(const id of cropRemoved)this.cropCaptures.delete(id);for(const [id,capture]of cropStaged)this.cropCaptures.set(id,capture);
  }
  this.epoch=publication.epoch;this.revision=publication.revision;this.tick=world.tick;
  if(verifyNaturalAppearance&&!checkpoint)this.verify(world);
  return {epoch:publication.epoch,revision:publication.revision,...checkpoint?{}:{baseRevision:publication.baseRevision},tick:world.tick,
   checkpoint,upsert,removed:checkpoint?[]:[...removed],crops};
 }
 /** Recomputes every non-crop capture (verification mode). */
 private verify(world:World):void {
  const growth=createPlantGrowthReader(world);
  for(const r of world.resources){
   if(isResidentCrop(r))continue;
   let value:number|undefined;const readGrowth=():number=>value??(value=(r.growth??1)===1?1:growth(r));
   const capture=this.captures.get(r.id);if(!capture)throw Error(`Natural visual capture missing for resource ${r.id}`);
   const size=floraSize(world,r,readGrowth),ready=harvestable(world,r,readGrowth),ripe=r.kind==='berries'&&ready,
    leafless=plantLeafless(world,r),support=r.kind==='healroot'&&hydroponicBasinAt(world,r)!==undefined;
   if(!same(capture,r,size,ripe,leafless,ready,support))throw Error(`Skipped natural visual change for resource ${r.id} at tick ${world.tick} (due ${capture.due})`);
  }
 }
}
