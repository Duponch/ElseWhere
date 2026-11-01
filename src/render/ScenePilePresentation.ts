import {readSnapshotChanges,readSnapshotStructureChanges} from '../bridge/snapshot-changes';
import {WORLD_SCALE} from '../world/scale';
import {corpseStage} from '../sim/corpses';
import {materialAllowedForPlayer256} from '../sim/material-permission-256';
import {corpseVisualMask} from './corpse-presentation';
import type {World,Structure,MaterialPile,Job} from '../sim/types';
import {pileParts,type PileBundle} from './pile-parts';
import type {Placement} from './primitives';
import {pileSurfaces,pileShelfCells,pileIdentitySurfacesFromCells,type PileSurface,type PileShelfCell,type PileSurfaceReadPair} from './pile-surfaces';

type Geometry=Pick<Structure,'id'|'kind'|'x'|'z'|'orientation'|'footprint'>;
const geometry=(s:Structure):Geometry=>({id:s.id,kind:s.kind,x:s.x,z:s.z,orientation:s.orientation,footprint:s.footprint});
const sameGeometry=(a:Geometry|undefined,b:Structure)=>!!a&&a.id===b.id&&a.kind===b.kind&&Object.is(a.x,b.x)&&Object.is(a.z,b.z)&&Object.is(a.orientation,b.orientation)&&a.footprint===b.footprint;
const sameNumbers=(a:readonly number[]|undefined,b:readonly number[])=>!!a&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const chunkKey=(x:number,z:number)=>`${Math.floor(x/WORLD_SCALE.chunkSize)}:${Math.floor(z/WORLD_SCALE.chunkSize)}`;
interface SupportState {readonly cells:ReadonlyMap<number,PileSurface>;readonly identities:ReadonlyMap<number,PileSurface>}
interface Input {readonly key:string;readonly chunk:string;readonly quantity:number;readonly job:Job|undefined;readonly jobX:number|undefined;readonly jobZ:number|undefined;readonly hidden:number;readonly surface:PileSurface|undefined;readonly corpseStage:PileBundle['corpseStage'];readonly seed:PileBundle}
interface PileRecord {readonly id:number;source:number;pile:MaterialPile;input:Input|undefined;seen:number}
interface Bundle {readonly source:number;readonly chunk:string;readonly value:PileBundle}
interface Chunk {readonly signature:string;readonly bundles:readonly PileBundle[];readonly source:number}
export interface ScenePileChunks {readonly activeKeys:ReadonlySet<string>;readonly emptiedKeys:readonly string[];readonly changedChunks:readonly {key:string;signature:string;bundles:readonly PileBundle[]}[]}

/** The exact old chunk signature, including its historical string collisions.
 * This is called only for affected chunks on the closed immutable path. */
function signature(bundles:readonly PileBundle[]):string {
 return bundles.map(bundle=>`${bundle.x}:${bundle.z}:${bundle.item}:${bundle.quantity}:${bundle.supplied}:${bundle.pileId??''}:${bundle.corpseStage??''}:${bundle.facing??0}:${bundle.innerResource?`${bundle.innerResource.species??'legacy'}:${bundle.innerResource.growth??1}:${bundle.innerResource.blight??false}`:''}:${bundle.corpse?corpseVisualMask(bundle.corpse):0}:${bundle.surface?Object.values(bundle.surface).join(','):'ground'}${bundle.forbidden?':forbidden':''}${bundle.markerOnly?':marker-only':''}`).join('|');
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
 private pendingChunks=new Map<string,{key:string;signature:string;bundles:readonly PileBundle[];source:number}>();
 private pendingEmpty=new Set<string>();
 private lastRead:ScenePileChunks|undefined;
 // Only renderer-owned, once-published bundles are keys. Atlas category and
 // pattern ordinals remain BoxBatches' current whole-group responsibility.
 private partCache=new WeakMap<PileBundle,readonly Placement[]>();
 private visit=0;

 private clearProjection():void {this.records.clear();this.ordered=[];this.members.clear();this.bundles.clear();this.chunkMembers.clear();this.chunks.clear();this.pendingChunks.clear();this.pendingEmpty.clear();this.lastRead=undefined;this.partCache=new WeakMap();this.visit=0;}

 clear():void {
  this.supportWorld=undefined;this.geometry=[];this.cells=new Map();this.shelves=new Map();this.shelfMembers.clear();this.identities=new Map();this.supports=new WeakMap();this.clearProjection();
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
  if(old?.pile===pile&&before&&!!before.seed.forbidden===forbidden&&!!before.seed.markerOnly===markerOnly&&Object.is(before.hidden,masked)&&before.surface===surface&&before.corpseStage===stage&&before.jobX===job?.x&&before.jobZ===job?.z)return before;
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
  const membership=world.piles.length!==this.ordered.length;let orderChanged=membership;
  const nextOrder=membership?new Array<PileRecord>(world.piles.length):this.ordered;
  const remove=(record:PileRecord)=>{const key=record.input?.key;if(key===undefined)return;const bucket=this.members.get(key);bucket?.delete(record.id);if(!bucket?.size)this.members.delete(key);dirty.add(key);};
  for(let source=0;source<world.piles.length;source++){
   const pile=world.piles[source]!,at=this.ordered[source],old=at?.id===pile.id?at:this.records.get(pile.id);
   if(!old||old.source!==source)orderChanged=true;
   const input=this.input(world,pile,hidden,jobs,supports,old);
   let record:PileRecord;
   if(old){record=old;if(old.input!==input){remove(old);old.input=input;if(input){let bucket=this.members.get(input.key);if(!bucket){bucket=new Map();this.members.set(input.key,bucket);}bucket.set(pile.id,old);dirty.add(input.key);}}else if(old.source!==source&&input)dirty.add(input.key);record.source=source;record.pile=pile;record.seen=visit;}
   else {record={id:pile.id,source,pile,input,seen:visit};this.records.set(pile.id,record);if(input){let bucket=this.members.get(input.key);if(!bucket){bucket=new Map();this.members.set(input.key,bucket);}bucket.set(pile.id,record);dirty.add(input.key);}}
   nextOrder[source]=record;
  }
  if(orderChanged)for(const [id,record]of this.records)if(record.seen!==visit){remove(record);this.records.delete(id);}
  this.ordered=nextOrder;
  const dirtyChunks=new Set<string>();
  for(const key of dirty){
   const old=this.bundles.get(key);if(old){const chunk=this.chunkMembers.get(old.chunk);chunk?.delete(key);if(!chunk?.size)this.chunkMembers.delete(old.chunk);dirtyChunks.add(old.chunk);this.bundles.delete(key);}
   const bucket=this.members.get(key);if(!bucket?.size)continue;
   const ordered=[...bucket.values()].sort((a,b)=>a.source-b.source),first=ordered[0]!,input=first.input!,value={...input.seed};
   // Preserve original floating arithmetic/source-order even for atypical
   // direct fixtures. No sum is reordered by ID or chunk membership.
   for(let i=1;i<ordered.length;i++)value.quantity+=ordered[i]!.input!.quantity;
   const bundle:Bundle={source:first.source,chunk:input.chunk,value:ownBundle(value)};this.bundles.set(key,bundle);
   let chunk=this.chunkMembers.get(input.chunk);if(!chunk){chunk=new Map();this.chunkMembers.set(input.chunk,chunk);}chunk.set(key,bundle);dirtyChunks.add(input.chunk);
  }
  for(const key of dirtyChunks){
   const members=this.chunkMembers.get(key),old=this.chunks.get(key);if(!members?.size){if(old||this.pendingChunks.has(key)){this.chunks.delete(key);this.pendingChunks.delete(key);this.pendingEmpty.add(key);}continue;}
   const ordered=[...members.values()].sort((a,b)=>a.source-b.source),bundles=Object.freeze(ordered.map(row=>row.value)),text=signature(bundles),source=ordered[0]!.source;
   this.chunks.set(key,{signature:text,bundles,source});this.pendingEmpty.delete(key);if(old?.signature!==text||this.pendingChunks.has(key))this.pendingChunks.set(key,Object.freeze({key,signature:text,bundles,source}));
  }
  const changedChunks=Object.freeze([...this.pendingChunks.values()].sort((a,b)=>a.source-b.source));
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
  if(frame!==this.lastRead||!frame.changedChunks.includes(chunk))throw Error('Stale or foreign pile placement frame');
  const result:Placement[]=[];
  for(const bundle of chunk.bundles){
   let parts=this.partCache.get(bundle);
   if(!parts){parts=pileParts([bundle]);this.partCache.set(bundle,parts);}
   for(const part of parts)result.push({...part});
  }
  return result;
 }

 /** Diagnostics/tests only: complete current value oracle, no timing state or
  * source references added to a public World. */
 inspect():readonly {key:string;signature:string;bundles:readonly PileBundle[]}[]{return [...this.chunks].sort((a,b)=>a[1].source-b[1].source).map(([key,value])=>({key,bundles:structuredClone(value.bundles),signature:value.signature}));}
}
