import {isCavePlant256,CAVE_PLANT_FACTS_256} from '../sim/cave-flora-256';
import type {LightSource} from '../sim/light-sources';
import type {Resource,World} from '../sim/types';
import {readSnapshotChanges,readSnapshotResourceStructure,sameSnapshotChangeDomain,type SnapshotResourceStructure} from '../bridge/snapshot-changes';
import {readResidentResourceBaseChanges} from '../bridge/resident-resource-base-changes';
import {readResidentCollectionDirectory379} from '../bridge/resident-collection-changes-379';
import {SceneResidentResourceMembership379} from './SceneResidentResourceMembership379';
import {WORLD_SCALE} from '../world/scale';
import {isClusterPlantSpecies,isResidentCrop} from './flora-presentation';
import type {NaturalPresentationChange} from './NaturalResourcePresentation';

declare const frameBrand:unique symbol;
export type SceneResourceFrame={readonly [frameBrand]:true};
export type RockCoverEdit=Readonly<{before:number|undefined;after:number|undefined}>;
export interface SceneResourceChunks {
  readonly emptiedKeys:readonly string[];
  readonly changedChunks:readonly Readonly<{key:string;resources:readonly Resource[]}>[];
}
export interface SceneResourceAccess {
  readonly caveLightSources:readonly LightSource[];
  readonly rockCoverEdits:readonly RockCoverEdit[]|undefined;
  treeAt(cell:number):number|undefined;
  resourceSource(id:number):number|undefined;
  previousResourceSource(id:number):number|undefined;
  chunksFor(changes?:ReadonlyMap<number,NaturalPresentationChange>,additionalKeys?:ReadonlySet<string>):SceneResourceChunks|undefined;
}
type Capture={id:number;kind:Resource['kind'];species:Resource['species'];x:number;z:number;key:string|undefined;tree:number|undefined;rock:number|undefined};
type FrameRecord={owner:SceneResourceIndex;generation:number;world:World;from:World|undefined;
  resources:readonly Resource[];tick:number;seed:number;width:number;height:number;
  caves:readonly LightSource[];oldKeys:ReadonlyMap<number,string>;oldSources:ReadonlyMap<number,number>|undefined;edits:readonly RockCoverEdit[]|undefined;projection?:SceneResourceAccess;active:boolean};
const frames=new WeakMap<SceneResourceFrame,FrameRecord>();
const records=new WeakSet<FrameRecord>();
const capture=(world:World,r:Resource):Capture=>{
  const built=!isResidentCrop(r)&&!isClusterPlantSpecies(r.species),cell=r.z*world.width+r.x;
  return {id:r.id,kind:r.kind,species:r.species,x:r.x,z:r.z,
    key:built?`${Math.floor(r.x/WORLD_SCALE.resourceChunkSize)}:${Math.floor(r.z/WORLD_SCALE.resourceChunkSize)}`:undefined,
    tree:built&&r.kind==='tree'?cell:undefined,rock:r.kind==='rock'?cell:undefined};
};
const same=(a:Capture,b:Resource):boolean=>a.id===b.id&&a.kind===b.kind&&a.species===b.species&&a.x===b.x&&a.z===b.z;
function insert(bucket:number[],source:number):void {
  if(!bucket.length||bucket[bucket.length-1]!<source){bucket.push(source);return;}
  let low=0,high=bucket.length;while(low<high){const middle=(low+high)>>>1;if(bucket[middle]!<source)low=middle+1;else high=middle;}
  if(bucket[low]!==source)bucket.splice(low,0,source);
}
function remove<K>(buckets:Map<K,number[]>,key:K|undefined,source:number):void {
  if(key===undefined)return;const bucket=buckets.get(key);if(!bucket)return;
  const at=bucket.indexOf(source);if(at>=0)bucket.splice(at,1);if(!bucket.length)buckets.delete(key);
}
function add<K>(buckets:Map<K,number[]>,key:K|undefined,source:number):void {
  if(key===undefined)return;let bucket=buckets.get(key);if(!bucket){bucket=[];buckets.set(key,bucket);}insert(bucket,source);
}
type StructuralPlan={removed:readonly Capture[];survivors:Capture[]|undefined;remap:readonly (number|undefined)[]|undefined;
  updates:readonly (readonly [number,Capture,Capture])[];added:readonly Capture[]};
/** Compose only certified metadata. Intermediate Worlds are never presented,
 * and their edge-local ordinals never index the final target. */
function structuralPlan(world:World,captures:readonly Capture[],byId:ReadonlyMap<number,number>,proof:Pick<SnapshotResourceStructure,'edges'>,
  validResource:(resource:Resource)=>boolean):StructuralPlan|undefined {
  const removed=new Set<number>(),added=new Map<number,true>(),updated=new Set<number>();
  let count=captures.length;
  for(const edge of proof.edges){
    if(edge.beforeCount!==count)return;
    for(const {id}of edge.removed){
      if(!added.delete(id)){
        if(!byId.has(id)||removed.has(id))return;removed.add(id);
      }
      updated.delete(id);
    }
    for(const {id}of edge.added){
      if(added.has(id)||byId.has(id)&&!removed.has(id))return;added.set(id,true);
    }
    for(const {id}of edge.updated){
      if(!added.has(id)){
        if(!byId.has(id)||removed.has(id))return;updated.add(id);
      }
    }
    count=count-edge.removed.length+edge.added.length;
    if(edge.afterCount!==count)return;
  }
  if(count!==world.resources.length||count!==captures.length-removed.size+added.size)return;
  const oldRemoved:Capture[]=[],survivors=removed.size?[] as Capture[]:undefined;
  const remap=removed.size?new Array<number|undefined>(captures.length):undefined;
  if(survivors&&remap)for(let source=0;source<captures.length;source++){
    const old=captures[source]!;
    if(removed.has(old.id)){oldRemoved.push(old);continue;}
    remap[source]=survivors.length;survivors.push(old);
  }
  const updates:Array<readonly [number,Capture,Capture]>=[];
  for(const id of updated){
    const oldSource=byId.get(id),old=oldSource===undefined?undefined:captures[oldSource];
    const source=oldSource===undefined?undefined:remap?remap[oldSource]:oldSource;
    const resource=source===undefined?undefined:world.resources[source];
    if(!old||old.id!==id||!resource||resource.id!==id||!validResource(resource))return;
    if(!same(old,resource))updates.push([source!,old,capture(world,resource)]);
  }
  updates.sort((a,b)=>a[0]-b[0]);
  const additions:Capture[]=[],base=captures.length-removed.size;
  for(const [id]of added){
    const resource=world.resources[base+additions.length];
    if(!resource||resource.id!==id||!validResource(resource))return;
    additions.push(capture(world,resource));
  }
  return {removed:oldRemoved,survivors,remap,updates,added:additions};
}
/** One numerical pass only when survivors shifted. Stable captures and bucket
 * arrays are retained; no source primitive/classification is reread here. */
function remapBuckets<K>(buckets:Map<K,number[]>,remap:readonly (number|undefined)[]):void {
  for(const [key,bucket]of buckets){
    let length=0;
    for(const source of bucket){const next=remap[source];if(next!==undefined)bucket[length++]=next;}
    bucket.length=length;if(!length)buckets.delete(key);
  }
}

/** Renderer-owned structural projection. Resource values/curves remain in the
 * exact applied World; only private primitive memberships persist here. */
export class SceneResourceIndex {
  #generation=0;
  #world:World|undefined;
  #map:Readonly<{seed:number;width:number;height:number}>|undefined;
  #captures:Capture[]=[];
  #byId=new Map<number,number>();
  #chunks=new Map<string,number[]>();
  #trees=new Map<number,number[]>();
  #caves:readonly LightSource[]=[];
  #resident:SceneResidentResourceMembership379|undefined;
  residentMetrics379(){return this.#resident?.metrics();}
  clear():void {this.#generation++;this.#world=undefined;this.#map=undefined;this.#captures=[];this.#byId.clear();this.#chunks.clear();this.#trees.clear();this.#caves=[];this.#resident=undefined;}
  adopt(world:World,reset=false):SceneResourceFrame {
    if(readResidentCollectionDirectory379(world,'resources')){
      if(!this.#resident){this.#resident=new SceneResidentResourceMembership379();if(this.#world)this.#resident.seed(this.#world,this.#captures,new Map(this.#byId));}
      const projection=this.#resident.adopt(world,reset);
      if(projection){
        const from=this.#world,generation=++this.#generation;this.#world=world;this.#map={seed:world.seed,width:world.width,height:world.height};
        const frame=Object.freeze({}) as SceneResourceFrame,record:FrameRecord={owner:this,generation,world,from,resources:world.resources,tick:world.tick,seed:world.seed,width:world.width,height:world.height,caves:projection.caveLightSources,oldKeys:new Map(),oldSources:undefined,edits:projection.rockCoverEdits,projection,active:true};
        frames.set(frame,record);records.add(record);queueMicrotask(()=>{record.active=false;frames.delete(frame);});return frame;
      }
    }
    if(this.#resident){
      // Exceptional transition back to a public/missing-directory reader.
      // Materialize the private previous captures, never reread old leaves.
      const previous=this.#resident.export();this.#resident=undefined;
      if(previous){this.#captures=new Array(previous.captures.length);this.#byId=new Map();this.#chunks=new Map();this.#trees=new Map();this.#caves=previous.caves;
        for(const c of previous.captures){const source=previous.source(c.id);if(source===undefined)continue;this.#captures[source]=c;this.#byId.set(c.id,source);add(this.#chunks,c.key,source);add(this.#trees,c.tree,source);}
      }
    }
    const from=this.#world,generation=++this.#generation;
    let caveChanged=reset||!from||from.schemaVersion!==world.schemaVersion||from.seed!==world.seed||from.width!==world.width||from.height!==world.height;
    const cave=(c:Pick<Resource,'species'>|undefined)=>!!c&&isCavePlant256(c.species,world.schemaVersion);
    const sameMap=!!from&&!!this.#map&&this.#map.seed===world.seed&&this.#map.width===world.width&&this.#map.height===world.height
      &&from.seed===this.#map.seed&&from.width===this.#map.width&&from.height===this.#map.height;
    const validResource=(r:Resource)=>Number.isSafeInteger(r.id)&&r.id>0&&Number.isSafeInteger(r.x)&&Number.isSafeInteger(r.z)
      &&r.x>=0&&r.z>=0&&r.x<world.width&&r.z<world.height;
    // Try the closed resident BASE suffix before gathering the full public
    // resource journal: dense growth-only edits cannot change this index.
    // Same-object reuse is a fresh decision, never a self-witness shortcut.
    const base=!reset&&from&&from!==world&&sameMap?readResidentResourceBaseChanges(from,world):undefined;
    const basePlan=base?structuralPlan(world,this.#captures,this.#byId,base,validResource):undefined;
    const journal=!basePlan&&!reset&&from&&from!==world&&sameMap
      ?readSnapshotChanges(from,world):undefined;
    let sparse=!!journal&&this.#captures.length===world.resources.length;
    if(sparse)for(const source of journal!.resourceIndices){
      const old=this.#captures[source],next=world.resources[source];
      if(!old||!next||old.id!==next.id||(old.key!==undefined)!==(!isResidentCrop(next)&&!isClusterPlantSpecies(next.species))){sparse=false;break;}
    }
    const structure=!basePlan&&!sparse&&!reset&&from&&from!==world&&sameMap?readSnapshotResourceStructure(from,world):undefined;
    const structural=basePlan??(structure?structuralPlan(world,this.#captures,this.#byId,structure,validResource):undefined);
    // This full diff owns both complete primitive sets; it does not manufacture
    // a sparse journal. Self reads and the common active domain gate restrict
    // which consumer may use the balance; neither replaces exhaustive reads.
    const fullCover=!sparse&&!structural&&!reset&&from&&from!==world&&sameMap
      &&readSnapshotChanges(from,from)!==undefined&&readSnapshotChanges(world,world)!==undefined
      &&sameSnapshotChangeDomain(from,world);
    const balance=structural||fullCover?new Map<number,number>():undefined;
    const oldKeys=new Map<number,string>(),edits:RockCoverEdit[]=[];
    let oldSources:Map<number,number>|undefined;
    let valid=Number.isSafeInteger(world.width)&&world.width>0&&Number.isSafeInteger(world.height)&&world.height>0;
    if(structural){
      if(structural.removed.some(cave)||structural.added.some(cave)||structural.updates.some(([,old,next])=>cave(old)||cave(next)))caveChanged=true;
      for(const old of structural.removed)(oldSources??=new Map()).set(old.id,this.#byId.get(old.id)!);
      for(const [,old]of structural.updates)(oldSources??=new Map()).set(old.id,this.#byId.get(old.id)!);
      for(const old of structural.removed){
        if(old.key!==undefined)oldKeys.set(old.id,old.key);
        this.#byId.delete(old.id);
        if(old.rock!==undefined)balance!.set(old.rock,(balance!.get(old.rock)??0)-1);
      }
      if(structural.survivors&&structural.remap){
        this.#captures=structural.survivors;
        remapBuckets(this.#chunks,structural.remap);remapBuckets(this.#trees,structural.remap);
        for(let source=0;source<this.#captures.length;source++){
          const id=this.#captures[source]!.id;if(this.#byId.get(id)!==source)this.#byId.set(id,source);
        }
      }
      for(const [source,old,next]of structural.updates){
        if(old.key!==undefined)oldKeys.set(old.id,old.key);
        remove(this.#chunks,old.key,source);remove(this.#trees,old.tree,source);
        add(this.#chunks,next.key,source);add(this.#trees,next.tree,source);this.#captures[source]=next;
        if(old.rock!==next.rock){
          if(old.rock!==undefined)balance!.set(old.rock,(balance!.get(old.rock)??0)-1);
          if(next.rock!==undefined)balance!.set(next.rock,(balance!.get(next.rock)??0)+1);
        }
      }
      for(const next of structural.added){
        const source=this.#captures.length;this.#captures.push(next);this.#byId.set(next.id,source);
        add(this.#chunks,next.key,source);add(this.#trees,next.tree,source);
        if(next.rock!==undefined)balance!.set(next.rock,(balance!.get(next.rock)??0)+1);
      }
    }else if(sparse){
      for(const source of journal!.resourceIndices){
        const r=world.resources[source]!,old=this.#captures[source]!;
        if(!validResource(r)){valid=false;break;}
        if(same(old,r))continue;
        (oldSources??=new Map()).set(old.id,source);
        const next=capture(world,r);if(cave(old)||cave(next))caveChanged=true;
        if(old.key!==undefined)oldKeys.set(old.id,old.key);
        remove(this.#chunks,old.key,source);remove(this.#trees,old.tree,source);
        add(this.#chunks,next.key,source);add(this.#trees,next.tree,source);this.#captures[source]=next;
        if(old.rock!==next.rock)edits.push(Object.freeze({before:old.rock,after:next.rock}));
      }
    }else if(!reset&&sameMap){
      // An absent sparse suffix still scans EVERY current primitive and ID.
      // Only structural allocations are reused, never previous validation.
      const seen=new Set<number>(),length=this.#captures.length;
      for(let source=0;source<world.resources.length;source++){
        const r=world.resources[source]!;
        if(!validResource(r)||seen.has(r.id)){valid=false;break;}
        seen.add(r.id);
        const old=this.#captures[source];
        if(old&&same(old,r))continue;
        const next=capture(world,r);if(cave(old)||cave(next))caveChanged=true;
        if(old){
          (oldSources??=new Map()).set(old.id,source);
          if(old.key!==undefined)oldKeys.set(old.id,old.key);
          remove(this.#chunks,old.key,source);remove(this.#trees,old.tree,source);
          // A moved ID may already have acquired its new ordinal. Deleting it
          // unconditionally would erase a completed earlier slot in an ID cycle.
          if(this.#byId.get(old.id)===source)this.#byId.delete(old.id);
          if(balance&&old.rock!==undefined)balance.set(old.rock,(balance.get(old.rock)??0)-1);
        }
        this.#captures[source]=next;this.#byId.set(next.id,source);
        add(this.#chunks,next.key,source);add(this.#trees,next.tree,source);
        if(balance&&next.rock!==undefined)balance.set(next.rock,(balance.get(next.rock)??0)+1);
      }
      if(valid){
        for(let source=world.resources.length;source<length;source++){
          const old=this.#captures[source]!;if(cave(old))caveChanged=true;
          (oldSources??=new Map()).set(old.id,source);
          if(old.key!==undefined)oldKeys.set(old.id,old.key);
          remove(this.#chunks,old.key,source);remove(this.#trees,old.tree,source);
          if(this.#byId.get(old.id)===source)this.#byId.delete(old.id);
          if(balance&&old.rock!==undefined)balance.set(old.rock,(balance.get(old.rock)??0)-1);
        }
        this.#captures.length=world.resources.length;
      }
    }else{
      for(let source=0;source<this.#captures.length;source++){
        const old=this.#captures[source]!;
        (oldSources??=new Map()).set(old.id,source);
        if(old.key!==undefined)oldKeys.set(old.id,old.key);
        if(balance&&old.rock!==undefined)balance.set(old.rock,(balance.get(old.rock)??0)-1);
      }
      this.#captures=[];this.#byId.clear();this.#chunks.clear();this.#trees.clear();
      for(let source=0;source<world.resources.length;source++){
        const r=world.resources[source]!;
        if(!validResource(r)||this.#byId.has(r.id)){valid=false;break;}
        const next=capture(world,r);caveChanged=true;this.#captures.push(next);this.#byId.set(next.id,source);
        add(this.#chunks,next.key,source);add(this.#trees,next.tree,source);
        if(balance&&next.rock!==undefined)balance.set(next.rock,(balance.get(next.rock)??0)+1);
      }
    }
    if(!valid){this.clear();const invalid=Object.freeze({}) as SceneResourceFrame;return invalid;}
    if(balance){
      // No partial result escapes an invalid capture. Net removals precede
      // additions, preserving overlap counts without transient underflow.
      for(const [cell,delta]of balance)for(let n=delta;n<0;n++)edits.push(Object.freeze({before:cell,after:undefined}));
      for(const [cell,delta]of balance)for(let n=0;n<delta;n++)edits.push(Object.freeze({before:undefined,after:cell}));
    }
    if(caveChanged){const caves:LightSource[]=[];for(const c of this.#captures)if(isCavePlant256(c.species,world.schemaVersion)){const d=CAVE_PLANT_FACTS_256[c.species];caves.push({cell:c.z*world.width+c.x,radius:d.radius,red:d.red,green:d.green,blue:d.blue});}caves.sort((a,b)=>a.cell-b.cell);this.#caves=Object.freeze(caves.map(s=>Object.freeze(s)));}
    this.#world=world;
    if(!this.#map||this.#map.seed!==world.seed||this.#map.width!==world.width||this.#map.height!==world.height)
      this.#map=Object.freeze({seed:world.seed,width:world.width,height:world.height});
    const frame=Object.freeze({}) as SceneResourceFrame;
    const record:FrameRecord={owner:this,generation,world,from,resources:world.resources,tick:world.tick,seed:world.seed,width:world.width,height:world.height,
      caves:this.#caves,oldKeys,oldSources,edits:sparse||balance?Object.freeze(edits):undefined,active:true};
    frames.set(frame,record);records.add(record);
    // No retained asynchronous authority. Arrays materialized below stay fixed.
    queueMicrotask(()=>{record.active=false;frames.delete(frame);});return frame;
  }
  /** These methods accept only the module-private record, never a public flag. */
  accepts(record:FrameRecord):boolean {return records.has(record)&&record.owner===this&&record.active&&record.generation===this.#generation&&record.world===this.#world
    &&record.resources===record.world.resources&&record.tick===record.world.tick&&record.seed===record.world.seed&&record.width===record.world.width&&record.height===record.world.height;}
  caveLightSources(record:FrameRecord):readonly LightSource[]|undefined {return this.accepts(record)?record.caves:undefined;}
  treeAt(record:FrameRecord,cell:number):number|undefined {
    if(!this.accepts(record))return;if(record.projection)return record.projection.treeAt(cell);const bucket=this.#trees.get(cell),source=bucket?.at(-1);
    return source===undefined?undefined:record.resources[source]?.id;
  }
  resourceSource(record:FrameRecord,id:number):number|undefined {
    return this.accepts(record)?record.projection?record.projection.resourceSource(id):this.#byId.get(id):undefined;
  }
  previousResourceSource(record:FrameRecord,id:number):number|undefined {
    return this.accepts(record)?record.projection?record.projection.previousResourceSource(id):record.oldSources?.get(id)??this.#byId.get(id):undefined;
  }
  chunksFor(record:FrameRecord,changes?:ReadonlyMap<number,NaturalPresentationChange>,additionalKeys?:ReadonlySet<string>):SceneResourceChunks|undefined {
    if(!this.accepts(record))return;
    if(record.projection)return record.projection.chunksFor(changes,additionalKeys);
    const affected=new Set(additionalKeys);
    if(changes)for(const [id]of changes){
      const old=record.oldKeys.get(id),source=this.#byId.get(id),key=source===undefined?undefined:this.#captures[source]?.key;
      if(old!==undefined)affected.add(old);if(key!==undefined)affected.add(key);
    }else{for(const key of this.#chunks.keys())affected.add(key);for(const key of record.oldKeys.values())affected.add(key);}
    const emptiedKeys:string[]=[],active:Array<readonly [string,number[]]>=[];
    for(const key of affected){const members=this.#chunks.get(key);if(members?.length)active.push([key,members]);else emptiedKeys.push(key);}
    active.sort((a,b)=>a[1][0]!-b[1][0]!);
    return Object.freeze({emptiedKeys:Object.freeze(emptiedKeys),changedChunks:Object.freeze(active.map(([key,members])=>Object.freeze({key,
      resources:Object.freeze(members.map(source=>record.resources[source]!))}))) });
  }
}

/** from, when supplied, must be this projection's exact predecessor. A handle
 * cannot apply index B→C contributions to a consumer still holding A. */
export function readSceneResourceFrame(frame:SceneResourceFrame|undefined,world:World,from?:World):SceneResourceAccess|undefined {
  if(!frame)return;const record=frames.get(frame);
  if(!record||!record.owner.accepts(record)||record.world!==world||record.resources!==world.resources
    ||record.tick!==world.tick||record.seed!==world.seed||record.width!==world.width||record.height!==world.height
    ||from!==undefined&&record.from!==from)return;
  return Object.freeze({caveLightSources:record.caves,rockCoverEdits:from===undefined?undefined:record.edits,
    treeAt:(cell:number)=>record.owner.treeAt(record,cell),
    resourceSource:(id:number)=>record.owner.resourceSource(record,id),
    previousResourceSource:(id:number)=>record.owner.previousResourceSource(record,id),
    chunksFor:(changes?:ReadonlyMap<number,NaturalPresentationChange>,additionalKeys?:ReadonlySet<string>)=>record.owner.chunksFor(record,changes,additionalKeys)});
}
