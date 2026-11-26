import {isCavePlant256,CAVE_PLANT_FACTS_256} from '../sim/cave-flora-256';
import type {LightSource} from '../sim/light-sources';
import type {World,Resource} from '../sim/types';
import {readResidentCollectionChanges379,readResidentCollectionDirectory379,type ResidentCollectionDirectory379} from '../bridge/resident-collection-changes-379';
import {readResidentResourceBaseChanges} from '../bridge/resident-resource-base-changes';
import type {SnapshotResourceStructureEdge} from '../bridge/snapshot-changes';
import {WORLD_SCALE} from '../world/scale';
import {isClusterPlantSpecies,isResidentCrop} from './flora-presentation';
import type {SceneResourceAccess,RockCoverEdit} from './scene-resource-index';

export type ResourceMembershipCapture379={id:number;kind:Resource['kind'];species:Resource['species'];x:number;z:number;key:string|undefined;tree:number|undefined;rock:number|undefined};
const capture=(world:World,r:Resource):ResourceMembershipCapture379=>{
 const built=!isResidentCrop(r)&&!isClusterPlantSpecies(r.species),cell=r.z*world.width+r.x;
 return{id:r.id,kind:r.kind,species:r.species,x:r.x,z:r.z,key:built?`${Math.floor(r.x/WORLD_SCALE.resourceChunkSize)}:${Math.floor(r.z/WORLD_SCALE.resourceChunkSize)}`:undefined,tree:built&&r.kind==='tree'?cell:undefined,rock:r.kind==='rock'?cell:undefined};
};
const same=(a:ResourceMembershipCapture379,b:ResourceMembershipCapture379)=>a.id===b.id&&a.kind===b.kind&&a.species===b.species&&a.x===b.x&&a.z===b.z;
function add<K>(map:Map<K,Set<number>>,key:K|undefined,id:number):void {if(key===undefined)return;let ids=map.get(key);if(!ids){ids=new Set();map.set(key,ids);}ids.add(id);}
function remove<K>(map:Map<K,Set<number>>,key:K|undefined,id:number):void {if(key===undefined)return;const ids=map.get(key);ids?.delete(id);if(!ids?.size)map.delete(key);}

/** Stable graphical identities, independent of dense publication ordinals.
 * Removing one plant touches its two memberships; it does not compact every
 * capture and remap every chunk. Ordinals come from the accepted assembler's
 * already-built target directory and are resolved only for requested chunks. */
export class SceneResidentResourceMembership379 {
 private world:World|undefined;
 private directory:ResidentCollectionDirectory379|undefined;
 private captures=new Map<number,ResourceMembershipCapture379>();
 private chunks=new Map<string,Set<number>>();
 private trees=new Map<number,Set<number>>();
 private caves=new Set<number>();
 private caveSources:readonly LightSource[]=[];
 private visits=0;
 metrics(){return{visits:this.visits,resources:this.captures.size};}
 seed(world:World,captures:readonly ResourceMembershipCapture379[],sources:ReadonlyMap<number,number>):void {
  this.world=world;this.directory={count:captures.length,source:id=>sources.get(id),capturedSource:id=>sources.get(id)};
  for(const c of captures){this.captures.set(c.id,c);add(this.chunks,c.key,c.id);add(this.trees,c.tree,c.id);if(isCavePlant256(c.species,world.schemaVersion))this.caves.add(c.id);}
 }
 export():{world:World;captures:readonly ResourceMembershipCapture379[];caves:readonly LightSource[];source:(id:number)=>number|undefined}|undefined {
  if(!this.world||!this.directory)return;return{world:this.world,captures:[...this.captures.values()],caves:this.caveSources,source:id=>this.directory!.capturedSource(id)};
 }
 private affected(edges:readonly SnapshotResourceStructureEdge[],count:number):{removed:Set<number>;changed:Set<number>}|undefined {
  const removed=new Set<number>(),added=new Set<number>(),updated=new Set<number>();
  for(const edge of edges){
   if(edge.beforeCount!==count)return;
   for(const {id}of edge.removed){if(!added.delete(id)){if(!this.captures.has(id)||removed.has(id))return;removed.add(id);}updated.delete(id);}
   for(const {id}of edge.added){if(added.has(id)||this.captures.has(id)&&!removed.has(id))return;added.add(id);}
   for(const {id}of edge.updated){if(!added.has(id)){if(!this.captures.has(id)||removed.has(id))return;updated.add(id);}}
   count=count-edge.removed.length+edge.added.length;if(count!==edge.afterCount)return;
  }
  if(count!==this.captures.size-removed.size+added.size)return;
  return{removed,changed:new Set([...updated,...added])};
 }
 adopt(world:World,reset=false):SceneResourceAccess|undefined {
  const directory=readResidentCollectionDirectory379(world,'resources');if(!directory)return;
  const before=this.world,oldDirectory=this.directory,sameMap=!reset&&before&&before!==world&&before.seed===world.seed&&before.width===world.width&&before.height===world.height;
  const journal=sameMap?readResidentCollectionChanges379(before,world,'resources'):undefined;
  const base=journal?readResidentResourceBaseChanges(before!,world):undefined;
  const plan=journal&&this.captures.size===journal.before.count?this.affected(base?.edges??journal.edges,this.captures.size):undefined;
  const oldKeys=new Map<number,string>(),oldSources=new Map<number,number>(),edits:RockCoverEdit[]=[],balance=new Map<number,number>();
  const removed:ResourceMembershipCapture379[]=[],changed:ResourceMembershipCapture379[]=[],seen=new Set<number>();
  const valid=(r:Resource)=>Number.isSafeInteger(r.id)&&r.id>0&&Number.isSafeInteger(r.x)&&Number.isSafeInteger(r.z)&&r.x>=0&&r.z>=0&&r.x<world.width&&r.z<world.height;
  if(plan){
   if(directory.count!==this.captures.size-plan.removed.size+[...plan.changed].filter(id=>!this.captures.has(id)||plan.removed.has(id)).length)return;
   for(const id of plan.removed){const old=this.captures.get(id);if(!old||oldDirectory?.source(id)===undefined)return;removed.push(old);}
   for(const id of plan.changed){const source=directory.source(id),r=source===undefined?undefined:world.resources[source];this.visits++;if(!r||!valid(r)||r.id!==id)return;const next=capture(world,r),old=this.captures.get(id);if(!old||!same(old,next)||plan.removed.has(id))changed.push(next);}
  }else{
   // Missing suffix/order/checkpoint: every target identity and primitive is
   // observed. Stable-ID storage still avoids ordinal remapping afterwards.
   for(let source=0;source<world.resources.length;source++){
    const r=world.resources[source]!;this.visits++;if(!valid(r)||seen.has(r.id)||directory.source(r.id)!==source)return;seen.add(r.id);
    const next=capture(world,r),old=this.captures.get(r.id);if(!sameMap||!old||!same(old,next))changed.push(next);
   }
   for(const old of this.captures.values())if(!seen.has(old.id))removed.push(old);
  }
  let caveChanged=reset||!before||before.schemaVersion!==world.schemaVersion||!sameMap||!plan||this.caveSources.length!==this.caves.size;
  const retire=(old:ResourceMembershipCapture379):void=>{
   if(old.key!==undefined)oldKeys.set(old.id,old.key);const source=oldDirectory?.capturedSource(old.id);if(source!==undefined)oldSources.set(old.id,source);
   remove(this.chunks,old.key,old.id);remove(this.trees,old.tree,old.id);this.captures.delete(old.id);
   if(this.caves.delete(old.id))caveChanged=true;if(old.rock!==undefined)balance.set(old.rock,(balance.get(old.rock)??0)-1);
  };
  for(const old of removed)retire(old);
  for(const next of changed){const old=this.captures.get(next.id);if(old)retire(old);this.captures.set(next.id,next);add(this.chunks,next.key,next.id);add(this.trees,next.tree,next.id);
   if(isCavePlant256(next.species,world.schemaVersion)){this.caves.add(next.id);caveChanged=true;}if(next.rock!==undefined)balance.set(next.rock,(balance.get(next.rock)??0)+1);
  }
  if(caveChanged){
   const ids=[...this.caves].sort((a,b)=>{const ca=this.captures.get(a)!,cb=this.captures.get(b)!;return(ca.z*world.width+ca.x)-(cb.z*world.width+cb.x)||(directory.source(a)??0)-(directory.source(b)??0);});
   this.caveSources=Object.freeze(ids.map(id=>{const c=this.captures.get(id)!,d=CAVE_PLANT_FACTS_256[c.species as keyof typeof CAVE_PLANT_FACTS_256];return Object.freeze({cell:c.z*world.width+c.x,radius:d.radius,red:d.red,green:d.green,blue:d.blue});}));
  }
  for(const [cell,delta]of balance)for(let n=delta;n<0;n++)edits.push(Object.freeze({before:cell,after:undefined}));
  for(const [cell,delta]of balance)for(let n=0;n<delta;n++)edits.push(Object.freeze({before:undefined,after:cell}));
  this.world=world;this.directory=directory;
  const source=(id:number)=>directory.source(id),previousSource=(id:number)=>oldSources.get(id)??oldDirectory?.capturedSource(id)??source(id);
  return{caveLightSources:this.caveSources,rockCoverEdits:plan?Object.freeze(edits):undefined,
   resourceSource:source,previousResourceSource:previousSource,
   treeAt:cell=>{let id:number|undefined,ordinal=-1;for(const candidate of this.trees.get(cell)??[]){const at=source(candidate);if(at!==undefined&&at>ordinal){ordinal=at;id=candidate;}}return id;},
   chunksFor:(changes,additional)=>{
    const affected=new Set(additional);if(changes)for(const [id]of changes){const old=oldKeys.get(id),key=this.captures.get(id)?.key;if(old!==undefined)affected.add(old);if(key!==undefined)affected.add(key);}else{for(const key of this.chunks.keys())affected.add(key);for(const key of oldKeys.values())affected.add(key);}
    const emptiedKeys:string[]=[],chunks:{key:string;resources:readonly Resource[];first:number}[]=[];
    for(const key of affected){const ids=this.chunks.get(key);if(!ids?.size){emptiedKeys.push(key);continue;}const ordinals=[...ids].map(id=>source(id)).filter((value):value is number=>value!==undefined).sort((a,b)=>a-b);if(ordinals.length!==ids.size)return;
     chunks.push({key,resources:Object.freeze(ordinals.map(at=>world.resources[at]!)),first:ordinals[0]!});}
    chunks.sort((a,b)=>a.first-b.first);return Object.freeze({emptiedKeys:Object.freeze(emptiedKeys),changedChunks:Object.freeze(chunks.map(({key,resources})=>Object.freeze({key,resources})))});
   }};
 }
}
