import {readSnapshotChanges,readSnapshotStructureChanges} from '../bridge/snapshot-changes';
import {readResidentCollectionChanges379,readResidentCollectionDirectory379,type ResidentCollectionDirectory379} from '../bridge/resident-collection-changes-379';
import {WORLD_SCALE} from '../world/scale';
import {corpseStage} from '../sim/corpses';
import {materialAllowedForPlayer256} from '../sim/material-permission-256';
import {corpseVisualMask} from './corpse-presentation';
import type {World,Structure,MaterialPile,Job} from '../sim/types';
import {pileParts,type PileBundle} from './pile-parts';
import type {Placement} from './primitives';
import {pileSurfaces,pileShelfCells,pileIdentitySurfacesFromCells,type PileSurface,type PileShelfCell,type PileSurfaceReadPair} from './pile-surfaces';
import {isActorPlaybackWorld435} from './ActorPlayback435';

type Geometry=Pick<Structure,'id'|'kind'|'x'|'z'|'orientation'|'footprint'>;
const geometry=(s:Structure):Geometry=>({id:s.id,kind:s.kind,x:s.x,z:s.z,orientation:s.orientation,footprint:s.footprint});
const sameGeometry=(a:Geometry|undefined,b:Structure)=>!!a&&a.id===b.id&&a.kind===b.kind&&Object.is(a.x,b.x)&&Object.is(a.z,b.z)&&Object.is(a.orientation,b.orientation)&&a.footprint===b.footprint;
const sameNumbers=(a:readonly number[]|undefined,b:readonly number[])=>!!a&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const chunkKey=(x:number,z:number)=>`${Math.floor(x/WORLD_SCALE.chunkSize)}:${Math.floor(z/WORLD_SCALE.chunkSize)}`;
interface SupportState {readonly cells:ReadonlyMap<number,PileSurface>;readonly identities:ReadonlyMap<number,PileSurface>}
interface Input {readonly key:string;readonly chunk:string;readonly quantity:number;readonly job:Job|undefined;readonly jobX:number|undefined;readonly jobZ:number|undefined;readonly hidden:number;readonly surface:PileSurface|undefined;readonly corpseStage:PileBundle['corpseStage'];readonly seed:PileBundle}
interface PileRecord {readonly id:number;source:number;pile:MaterialPile;input:Input|undefined;seen:number;supportCell?:number}
interface Bundle {readonly id:number;readonly source:number;readonly chunk:string;readonly value:PileBundle;readonly signature:string}
interface Chunk {readonly id:number;readonly signature:string;readonly bundles:readonly PileBundle[];readonly source:number}
export interface ScenePileChunks {readonly activeKeys:ReadonlySet<string>;readonly emptiedKeys:readonly string[];readonly changedChunks:readonly {key:string;signature:string;bundles:readonly PileBundle[]}[]}

/** Capture once with the owned bundle. Reassembling a changed chunk can then
 * reuse the exact text for all of its unchanged neighbours, in source order. */
function pileSignature(bundle:PileBundle):string {
 return `${bundle.x}:${bundle.z}:${bundle.item}:${bundle.quantity}:${bundle.supplied}:${bundle.pileId??''}:${bundle.corpseStage??''}:${bundle.facing??0}:${bundle.innerResource?`${bundle.innerResource.species??'legacy'}:${bundle.innerResource.growth??1}:${bundle.innerResource.blight??false}`:''}:${bundle.corpse?corpseVisualMask(bundle.corpse):0}:${bundle.surface?Object.values(bundle.surface).join(','):'ground'}${bundle.forbidden?':forbidden':''}${bundle.markerOnly?':marker-only':''}`;
}

/** Clone BEFORE freezing: seeds may contain nested references to the admitted
 * World. Publication must never freeze or expose those source-owned objects. */
function ownBundle(value:PileBundle):PileBundle {
 const copy=structuredClone(value),seen=new WeakSet<object>();
 const freeze=(object:object):void=>{if(seen.has(object))return;seen.add(object);for(const child of Object.values(object))if(child!==null&&typeof child==='object')freeze(child);Object.freeze(object);};
 freeze(copy);return copy;
}

/** One renderer-owned projection, covering physical pile support, ordered
 * aggregation, chunk signatures and the MAIN cargo-quantity overlay. No World
 * flag or timestamp confers reuse. Only decoder-stamped Worlds from the fixed
 * owner enter prepareSupports; public Core calls retain the old complete path.
 * No GPU object, public snapshot, authoritative row or save is mutated here. */
export class ScenePilePresentation {
 private supportWorld:World|undefined;
 private geometry:Geometry[]=[];
 private cells:ReadonlyMap<number,PileSurface>=new Map();
 private shelves:ReadonlyMap<number,PileShelfCell>=new Map();
 private shelfMembers=new Map<number,number[]>();
 private identities:ReadonlyMap<number,PileSurface>=new Map();
 private supports=new WeakMap<World,SupportState>();
 private records=new Map<number,PileRecord>();
 private ordered:PileRecord[]=[];
 private members=new Map<string,Map<number,PileRecord>>();
 private bundles=new Map<string,Bundle>();
 private chunkMembers=new Map<string,Map<string,Bundle>>();
 private chunks=new Map<string,Chunk>();
 private pendingChunks=new Map<string,{key:string;signature:string;bundles:readonly PileBundle[];source:number;id:number}>();
 private pendingEmpty=new Set<string>();
 private lastRead:ScenePileChunks|undefined;
 // Only renderer-owned, once-published bundles are keys. Atlas category and
 // pattern ordinals remain BoxBatches' current whole-group responsibility.
 private partCache=new WeakMap<PileBundle,readonly Placement[]>();
 private visit=0;
 private world:World|undefined;
 private hidden=new Map<number,number>();
 private previousSupports:SupportState|undefined;
 private surfaceMembers=new Map<number,Set<number>>();
 private corpseMembers=new Set<number>();
 private jobMembers=new Set<number>();
 private views297=new WeakMap<World,{base:World;ids:readonly number[];directory:ResidentCollectionDirectory379;valid:()=>boolean}>();
 private rowVisits379=0;
 residentMetrics379(){return{visits:this.rowVisits379,piles:this.records.size};}

 private clearProjection():void {this.records.clear();this.ordered=[];this.members.clear();this.bundles.clear();this.chunkMembers.clear();this.chunks.clear();this.pendingChunks.clear();this.pendingEmpty.clear();this.lastRead=undefined;this.partCache=new WeakMap();this.visit=0;this.world=undefined;this.hidden.clear();this.previousSupports=undefined;this.surfaceMembers.clear();this.corpseMembers.clear();this.jobMembers.clear();}

 clear():void {
  this.supportWorld=undefined;this.geometry=[];this.cells=new Map();this.shelves=new Map();this.shelfMembers.clear();this.identities=new Map();this.supports=new WeakMap();this.views297=new WeakMap();this.clearProjection();
 }

 /** Call once before the current applyWorld's surface scope. Old admitted
  * World keys retain their own support maps for exact cargo handoff endpoints. */
 prepareSupports(world:World,reset=false,shared?:PileSurfaceReadPair):PileSurfaceReadPair|undefined {
  if(readSnapshotChanges(world,world)===undefined){this.clear();return;}
  if(shared){this.supports.set(world,shared);this.supportWorld=world;return shared;}
  if(reset){this.supportWorld=undefined;this.geometry=[];this.cells=new Map();this.shelves=new Map();this.shelfMembers.clear();this.identities=new Map();this.supports=new WeakMap();}
  if(world===this.supportWorld)return this.supports.get(world);
  const previous=this.supportWorld,sameMap=previous&&previous.seed===world.seed&&previous.width===world.width&&previous.height===world.height;
  const changes=sameMap&&this.geometry.length===world.structures.length?readSnapshotStructureChanges(previous,world):undefined;
  let topology=!changes;
  // Poison the base before reads which can throw. A retry takes the full path.
  this.supportWorld=undefined;
  if(changes){for(const i of changes.structureIndices){const s=world.structures[i];if(!s||!sameGeometry(this.geometry[i],s)){topology=true;break;}}}
  if(topology){
   this.geometry=world.structures.map(geometry);this.cells=pileSurfaces(world);this.shelves=pileShelfCells(world);
  }
  const byCell=new Map<number,number[]>();
  if(this.shelves.size)for(const pile of world.piles)if(pile.owner.type==='ground'){
   const cell=pile.owner.z*world.width+pile.owner.x;if(!this.shelves.has(cell))continue;
   const ids=byCell.get(cell);if(ids)ids.push(pile.id);else byCell.set(cell,[pile.id]);
  }
  let membership=topology||byCell.size!==this.shelfMembers.size;
  for(const [cell,ids]of byCell){ids.sort((a,b)=>a-b);if(!sameNumbers(this.shelfMembers.get(cell),ids))membership=true;}
  if(membership)this.identities=pileIdentitySurfacesFromCells(world.width,world.piles,this.shelves);
  this.shelfMembers=byCell;const state={cells:this.cells,identities:this.identities};this.supports.set(world,state);this.supportWorld=world;return state;
 }

 /** Frontier pile-patch view: a presentation-only World over a prepared Full,
  * same structures (same support cells), some pile records replaced. Its reads
  * stay incremental: untouched piles keep the Full's references. */
 registerView297(view:World,support:PileSurfaceReadPair,base?:World,patches?:ReadonlyMap<number,Readonly<MaterialPile>|null>):void{
  this.supports.set(view,support);if(base)this.views297.delete(view);if(!base||view.structures!==base.structures||view.seed!==base.seed||view.width!==base.width||view.height!==base.height)return;
  const before=readResidentCollectionDirectory379(base,'piles');if(!before)return;
  if(view.piles===base.piles){this.bindViewDirectory297(view,base,[],before.count,before.capturedSource);return;}
  if(!patches)return;
  const removed:number[]=[],added:number[]=[];
  const removedIds=new Set<number>();
  for(const [id,value]of patches){const source=before.source(id);if(source===undefined&&before.capturedSource(id)!==undefined||value&&value.id!==id)return;if(source!==undefined&&!value){removed.push(source);removedIds.add(id);}else if(source===undefined&&value)added.push(id);}
  removed.sort((a,b)=>a-b);added.sort((a,b)=>a-b);const offset=before.count-removed.length;
  if(offset+added.length!==view.piles.length)return;const additions=new Map(added.map((id,i)=>[id,offset+i]));
  // Phase patches accumulate in a mutable Map at the producer. Capture its
  // actual membership now; yesterday's projection may still be used for a
  // cargo hand-off or sparse comparison after that Map advances.
  const ordinal=(id:number):number|undefined=>{if(removedIds.has(id))return;const old=before.capturedSource(id);if(old===undefined)return additions.get(id);let lo=0,hi=removed.length;while(lo<hi){const mid=(lo+hi)>>>1;if(removed[mid]!<old)lo=mid+1;else hi=mid;}return old-lo;};
  this.bindViewDirectory297(view,base,Object.freeze([...patches.keys()]),view.piles.length,ordinal);
 }
 private bindViewDirectory297(view:World,base:World,ids:readonly number[],count:number,ordinal:(id:number)=>number|undefined):void {
  const values=view.piles,structures=view.structures,width=view.width,height=view.height,seed=view.seed;let active=true;
  const valid=()=>active&&(active=view.piles===values&&values.length===count&&view.structures===structures&&view.width===width&&view.height===height&&view.seed===seed);
  const directory=Object.freeze({count,capturedSource:ordinal,source:(id:number)=>{if(!valid())return;const source=ordinal(id);return source!==undefined&&values[source]?.id===id?source:undefined;}});
  for(const id of ids)if(directory.capturedSource(id)!==undefined&&directory.source(id)===undefined)return;
  this.views297.set(view,{base,ids,directory,valid});
 }
 /** A pose-only frontier has the same admitted piles and geometry as its
  * predecessor. No shelf census, patch snapshot or ordinal walk is needed. */
 reuseView297(view:World,previous:World,base:World):boolean {
  const support=this.supports.get(previous),record=this.views297.get(previous);
  if(!support||!record?.valid()||record.base!==base||view.piles!==previous.piles||view.structures!==previous.structures||view.width!==previous.width||view.height!==previous.height||view.seed!==previous.seed)return false;
  this.supports.set(view,support);this.bindViewDirectory297(view,base,record.ids,record.directory.count,record.directory.capturedSource);
  return this.views297.has(view);
 }
 viewDirectory297(view:World):ResidentCollectionDirectory379|undefined{const record=this.views297.get(view);return record?.valid()?record.directory:undefined;}

 /** Only previously prepared immutable Worlds resolve. Returning undefined
  * leaves pile-surfaces' complete, application-local mutable fallback intact. */
 readSupports=(world:World):PileSurfaceReadPair|undefined=>this.supports.get(world);

 private input(world:World,pile:MaterialPile,hidden:ReadonlyMap<number,number>,jobs:ReadonlyMap<number,Job>,supports:SupportState,old:PileRecord|undefined):Input|undefined {
  const forbidden=pile.owner.type==='ground'&&!materialAllowedForPlayer256(pile),markerOnly=!!(pile.humanCorpse||pile.mechCorpse);
  if(markerOnly&&!forbidden||pile.owner.type==='grave'||pile.owner.type!=='ground'&&pile.owner.type!=='job')return;
  const masked=hidden.get(pile.id)??0,quantity=pile.quantity-masked;if(quantity<=0)return;
  const job=pile.owner.type==='job'?jobs.get(pile.owner.jobId):undefined;if(pile.owner.type==='job'&&!job)return;
  const position=pile.owner.type==='ground'?pile.owner:job!,identity=job?undefined:supports.identities.get(pile.id),surface=job?undefined:identity??supports.cells.get(position.z*world.width+position.x),stage=!markerOnly&&pile.kind==='corpse'?corpseStage(pile,world.tick):undefined;
  const before=old?.input;
  if((pile.corpse||pile.innerResource)&&old?.pile===pile&&before&&!!before.seed.forbidden===forbidden&&!!before.seed.markerOnly===markerOnly&&Object.is(before.hidden,masked)&&Object.is(before.quantity,quantity)&&before.surface===surface&&before.corpseStage===stage&&before.jobX===job?.x&&before.jobZ===job?.z)return before;
  // Rot clocks and durability replace native pile leaves without changing
  // ground geometry. Compare the complete ordinary-pile graphical capture
  // before allocating a seed or dirtying its aggregation cell. Nested corpse
  // and tree values retain their complete historical capture below.
  if(before&&!pile.corpse&&!pile.innerResource&&!before.seed.corpse&&!before.seed.innerResource
   &&before.seed.kind===pile.kind&&before.seed.item===pile.item&&Object.is(before.seed.x,position.x)&&Object.is(before.seed.z,position.z)
   &&Object.is(before.quantity,quantity)&&Object.is(before.hidden,masked)&&!!before.job===!!job
   &&!!before.seed.forbidden===forbidden&&!!before.seed.markerOnly===markerOnly&&before.surface===surface
   &&before.corpseStage===stage&&Object.is(before.jobX,job?.x)&&Object.is(before.jobZ,job?.z))return before;
  const key=`${position.x}:${position.z}:${pile.item}:${job?'job':'ground'}${pile.corpse||pile.innerResource||identity||markerOnly?`:${pile.id}`:''}${forbidden?':forbidden':''}`;
  const seed:PileBundle={x:position.x,z:position.z,kind:pile.kind,item:pile.item,quantity,supplied:!!job,...(forbidden?{forbidden:true as const}:{}),...(markerOnly?{markerOnly:true as const}:{}),
   ...(identity||pile.innerResource||markerOnly?{pileId:pile.id}:{}),...(pile.innerResource?{innerResource:pile.innerResource}:{}),
   ...(pile.kind==='chunk'&&pile.owner.type==='ground'?{targetId:position.z*world.width+position.x}:{}),surface,
   ...(!markerOnly&&pile.kind==='corpse'?{corpseStage:stage!,facing:pile.corpse?.facing??0,corpse:pile.corpse}:{})};
  return {key,chunk:chunkKey(position.x,position.z),quantity,hidden:masked,job,jobX:job?.x,jobZ:job?.z,surface,corpseStage:stage,seed};
 }

 /** A reference pass over pile rows replaces all-pile aggregation/stringing.
  * Changed memberships rebuild only their cells and chunks. No cadence gate:
  * a same-tick edit or newly completed handoff is applied on this very read. */
 read(world:World,hidden:ReadonlyMap<number,number>,reset=false):ScenePileChunks|undefined {
  const supports=this.supports.get(world);if(!supports)return;
  if(reset)this.clearProjection();
  try{const result=this.readPrepared(world,hidden,supports);this.lastRead=result;return result;}catch(error){this.clearProjection();throw error;}
 }
 private readPrepared(world:World,hidden:ReadonlyMap<number,number>,supports:SupportState):ScenePileChunks {
  const jobs=new Map(world.jobs.map(job=>[job.id,job])),dirty=new Set<string>(),visit=++this.visit;
  const beforeRecord=this.world?this.views297.get(this.world):undefined,afterRecord=this.views297.get(world),beforeView=beforeRecord?.valid()?beforeRecord:undefined,afterView=afterRecord?.valid()?afterRecord:undefined;
  const directory=afterView?.directory??readResidentCollectionDirectory379(world,'piles');
  const beforeBase=beforeView?.base??this.world,afterBase=afterView?.base??world;
  const beforeDirectory=beforeBase?readResidentCollectionDirectory379(beforeBase,'piles'):undefined,afterDirectory=readResidentCollectionDirectory379(afterBase,'piles');
  const proof=beforeBase&&beforeBase!==afterBase?readResidentCollectionChanges379(beforeBase,afterBase,'piles'):undefined;
  let sparse:Readonly<{sources:readonly number[];removed:readonly number[]}>|undefined;
  // A cargo hand-off can change hidden quantities on the very same admitted
  // Full or phase view between RAFs. Its immutable records/ordinals and time
  // have not changed. Do not repeat the entire pile census for that overlay.
  // Same-World public callers retain the old exhaustive read (including
  // mutations made in place without a new publication).
  const sameClosedWorld=this.world===world&&isActorPlaybackWorld435(world);
  if((this.world!==world||sameClosedWorld)&&directory&&beforeDirectory&&afterDirectory&&(beforeBase===afterBase||proof)){
   const removed=new Set<number>(),changed=new Set<number>(sameClosedWorld?[]:[...(beforeView?.ids??[]),...(afterView?.ids??[])]);let count=beforeDirectory.count,valid=true,added=0;
   for(const edge of proof?.edges??[]){
    if(edge.beforeCount!==count){valid=false;break;}
    for(const row of [...edge.removed,...edge.added,...edge.updated])changed.add(row.id);
    count=count-edge.removed.length+edge.added.length;if(count!==edge.afterCount){valid=false;break;}
   }
   if(valid&&count===afterDirectory.count){
    for(const id of changed){const source=directory.source(id);if(source===undefined){if(directory.capturedSource(id)!==undefined)valid=false;else if(this.records.has(id))removed.add(id);}else if(!this.records.has(id))added++;}
    if(directory.count!==this.records.size-removed.size+added)valid=false;
    if(!sameClosedWorld){for(const id of this.corpseMembers)changed.add(id);for(const id of this.jobMembers)changed.add(id);}
    for(const [id,value]of hidden)if(!Object.is(value,this.hidden.get(id)))changed.add(id);
    for(const [id,value]of this.hidden)if(!Object.is(value,hidden.get(id)))changed.add(id);
    const old=this.previousSupports;
    if(old&&old.cells!==supports.cells){
     for(const cell of new Set([...old.cells.keys(),...supports.cells.keys()]))if(old.cells.get(cell)!==supports.cells.get(cell))for(const id of this.surfaceMembers.get(cell)??[])changed.add(id);
    }
    if(old&&old.identities!==supports.identities)for(const id of new Set([...old.identities.keys(),...supports.identities.keys()]))if(old.identities.get(id)!==supports.identities.get(id))changed.add(id);
    const sources:number[]=[];
    for(const id of changed){if(removed.has(id))continue;const source=directory.source(id);if(source===undefined){if(this.records.has(id))valid=false;continue;}sources.push(source);}
    if(valid)sparse={sources:sources.sort((a,b)=>a-b),removed:[...removed].sort((a,b)=>(beforeView?.directory.capturedSource(a)??beforeDirectory.capturedSource(a)??0)-(beforeView?.directory.capturedSource(b)??beforeDirectory.capturedSource(b)??0))};
   }
  }
  const membership=world.piles.length!==this.ordered.length;let orderChanged=membership;
  const nextOrder=!sparse&&membership?new Array<PileRecord>(world.piles.length):this.ordered;
  const remove=(record:PileRecord)=>{const key=record.input?.key;if(key===undefined)return;const bucket=this.members.get(key);bucket?.delete(record.id);if(!bucket?.size)this.members.delete(key);dirty.add(key);};
  const forgetDependencies=(record:PileRecord):void=>{if(record.supportCell!==undefined){const ids=this.surfaceMembers.get(record.supportCell);ids?.delete(record.id);if(!ids?.size)this.surfaceMembers.delete(record.supportCell);}this.corpseMembers.delete(record.id);this.jobMembers.delete(record.id);};
  if(sparse)for(const id of sparse.removed){const record=this.records.get(id)!;remove(record);forgetDependencies(record);this.records.delete(id);}
  const update=(source:number):void=>{
   this.rowVisits379++;
   const pile=world.piles[source]!,at=this.ordered[source],old=at?.id===pile.id?at:this.records.get(pile.id);
   if(!old||old.source!==source)orderChanged=true;
   const input=this.input(world,pile,hidden,jobs,supports,old);
   let record:PileRecord;
   if(old){record=old;if(old.input!==input){remove(old);old.input=input;if(input){let bucket=this.members.get(input.key);if(!bucket){bucket=new Map();this.members.set(input.key,bucket);}bucket.set(pile.id,old);dirty.add(input.key);}}else if(old.source!==source&&input)dirty.add(input.key);record.source=source;record.pile=pile;record.seen=visit;}
   else {record={id:pile.id,source,pile,input,seen:visit};this.records.set(pile.id,record);if(input){let bucket=this.members.get(input.key);if(!bucket){bucket=new Map();this.members.set(input.key,bucket);}bucket.set(pile.id,record);dirty.add(input.key);}}
   forgetDependencies(record);record.supportCell=pile.owner.type==='ground'?pile.owner.z*world.width+pile.owner.x:undefined;
   if(record.supportCell!==undefined){let ids=this.surfaceMembers.get(record.supportCell);if(!ids){ids=new Set();this.surfaceMembers.set(record.supportCell,ids);}ids.add(record.id);}
   if(pile.kind==='corpse')this.corpseMembers.add(record.id);if(pile.owner.type==='job')this.jobMembers.add(record.id);
   if(!sparse)nextOrder[source]=record;
  };
  if(sparse)for(const source of sparse.sources)update(source);else for(let source=0;source<world.piles.length;source++)update(source);
  if(!sparse&&orderChanged)for(const [id,record]of this.records)if(record.seen!==visit){remove(record);forgetDependencies(record);this.records.delete(id);}
  this.ordered=sparse?[]:nextOrder;
  const dirtyChunks=new Set<string>();
  for(const key of dirty){
   const old=this.bundles.get(key);if(old){const chunk=this.chunkMembers.get(old.chunk);chunk?.delete(key);if(!chunk?.size)this.chunkMembers.delete(old.chunk);dirtyChunks.add(old.chunk);this.bundles.delete(key);}
   const bucket=this.members.get(key);if(!bucket?.size)continue;
   const ordered=[...bucket.values()].sort((a,b)=>(directory?.source(a.id)??a.source)-(directory?.source(b.id)??b.source)),first=ordered[0]!,input=first.input!,value={...input.seed};
   // Preserve original floating arithmetic/source-order even for atypical
   // direct fixtures. No sum is reordered by ID or chunk membership.
   for(let i=1;i<ordered.length;i++)value.quantity+=ordered[i]!.input!.quantity;
   const owned=ownBundle(value);
   const bundle:Bundle={id:first.id,source:directory?.source(first.id)??first.source,chunk:input.chunk,value:owned,signature:pileSignature(owned)};this.bundles.set(key,bundle);
   let chunk=this.chunkMembers.get(input.chunk);if(!chunk){chunk=new Map();this.chunkMembers.set(input.chunk,chunk);}chunk.set(key,bundle);dirtyChunks.add(input.chunk);
  }
  for(const key of dirtyChunks){
   const members=this.chunkMembers.get(key),old=this.chunks.get(key);if(!members?.size){if(old||this.pendingChunks.has(key)){this.chunks.delete(key);this.pendingChunks.delete(key);this.pendingEmpty.add(key);}continue;}
   const ordered=[...members.values()].sort((a,b)=>(directory?.source(a.id)??a.source)-(directory?.source(b.id)??b.source)),bundles=Object.freeze(ordered.map(row=>row.value)),text=ordered.map(row=>row.signature).join('|'),id=ordered[0]!.id,source=directory?.source(id)??ordered[0]!.source;
   this.chunks.set(key,{id,signature:text,bundles,source});this.pendingEmpty.delete(key);if(old?.signature!==text||this.pendingChunks.has(key))this.pendingChunks.set(key,Object.freeze({key,signature:text,bundles,source,id}));
  }
  this.world=world;this.hidden=new Map(hidden);this.previousSupports=supports;
  const changedChunks=Object.freeze([...this.pendingChunks.values()].sort((a,b)=>(directory?.source(a.id)??a.source)-(directory?.source(b.id)??b.source)));
  return Object.freeze({activeKeys:new Set(this.chunks.keys()),emptiedKeys:Object.freeze([...this.pendingEmpty]),changedChunks});
 }

 /** ACK only after all current Core writes succeed. Failure leaves exact
  * pending output available to the next read, even for the same World. */
 acknowledge(frame:ScenePileChunks):boolean {if(frame!==this.lastRead)return false;this.pendingChunks.clear();this.pendingEmpty.clear();this.lastRead=undefined;return true;}

 /** Closed current-frame capability: callers cannot cache mutable public
  * fixtures or a forged/replayed chunk. Parts contain intrinsic item geometry,
  * support and exact target IDs only; BoxBatches still computes every atlas
  * ordinal in its current category order and retains its original full writes.
  * Never expose the cached Placement references through a public diagnostic. */
 placements(frame:ScenePileChunks,chunk:ScenePileChunks['changedChunks'][number]):Placement[] {
  return this.ownedPlacements(frame,chunk).map(part=>({...part}));
 }

 /** Intrinsic geometry is scalar own data. Each run belongs to its immutable
  * bundle and survives changes to other piles in the same chunk. */
 visitPlacementRuns(frame:ScenePileChunks,chunk:ScenePileChunks['changedChunks'][number],visit:(parts:readonly Placement[])=>void):void {
  if(frame!==this.lastRead||!frame.changedChunks.includes(chunk))throw Error('Stale or foreign pile placement frame');
  for(let i=0;i<chunk.bundles.length;i++){
   const bundle=chunk.bundles[i]!;
   let parts=this.partCache.get(bundle);
   if(!parts){parts=Object.freeze(pileParts([bundle]).map(part=>Object.freeze(part)));this.partCache.set(bundle,parts);}
   visit(parts);
  }
 }

 ownedPlacements(frame:ScenePileChunks,chunk:ScenePileChunks['changedChunks'][number]):Placement[] {
  const result:Placement[]=[];
  this.visitPlacementRuns(frame,chunk,parts=>{for(let i=0;i<parts.length;i++)result.push(parts[i]!);});
  return result;
 }

 /** Diagnostics/tests only: complete current value oracle, no timing state or
  * source references added to a public World. */
 inspect():readonly {key:string;signature:string;bundles:readonly PileBundle[]}[]{const directory=this.world?this.viewDirectory297(this.world)??readResidentCollectionDirectory379(this.world,'piles'):undefined;return [...this.chunks].sort((a,b)=>(directory?.source(a[1].id)??a[1].source)-(directory?.source(b[1].id)??b[1].source)).map(([key,value])=>({key,bundles:structuredClone(value.bundles),signature:value.signature}));}
}
