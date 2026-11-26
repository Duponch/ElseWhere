import type {World} from '../sim/types';
import type {ResourceStructureCandidate,SnapshotResourceStructureEdge} from './snapshots';

export type ResidentCollection379='resources'|'piles'|'structures';
export interface ResidentCollectionDirectory379 {
 readonly count:number;
 source(id:number):number|undefined;
 /** Primitive ordinal at capture time; never authorizes reading a World row. */
 capturedSource(id:number):number|undefined;
}
export interface ResidentCollectionChanges379 {
 readonly edges:readonly SnapshotResourceStructureEdge[];
 readonly before:ResidentCollectionDirectory379;
 readonly after:ResidentCollectionDirectory379;
}
type Stamp={owner:ResidentCollectionJournal379;generation:number;epoch:number;revision:number;directory:ResidentCollectionDirectory379;valid:()=>boolean};
const stamps:Record<ResidentCollection379,WeakMap<World,Stamp>>={resources:new WeakMap(),piles:new WeakMap(),structures:new WeakMap()};
type Entry={parent:number;edge:SnapshotResourceStructureEdge|undefined;cost:number};

/** Internal publisher at the accepted assembler commit. Slots are the exact
 * private maps already constructed while reconstructing the collection; they
 * are never mutated in place or exposed to a renderer. No second ID scan,
 * source-row copy, wire field or admission authority is introduced. */
export class ResidentCollectionJournal379 {
 private generation=0;
 private epoch=0;
 private revision=0;
 private values=0;
 private readonly records=new Map<number,Entry>();
 constructor(private readonly collection:ResidentCollection379){}
 private stamp(world:World,epoch:number,revision:number,slots:ReadonlyMap<number,number>):void {
  const values=world[this.collection],count=values.length,width=world.width,height=world.height,seed=world.seed,schema=world.schemaVersion;
  let active=true;
  const valid=()=>active&&(active=world[this.collection]===values&&values.length===count&&world.width===width&&world.height===height&&world.seed===seed&&world.schemaVersion===schema);
  const directory=Object.freeze({count,capturedSource:(id:number)=>slots.get(id),source:(id:number)=>{if(!valid())return;const source=slots.get(id);if(source!==undefined&&values[source]?.id!==id){active=false;return;}return source;}});
  stamps[this.collection].set(world,{owner:this,generation:this.generation,epoch,revision,directory,valid});
 }
 reset(world:World,epoch:number,revision:number,slots:ReadonlyMap<number,number>):void {
  this.records.clear();this.values=0;this.generation++;this.epoch=epoch;this.revision=revision;this.stamp(world,epoch,revision,slots);
 }
 append(previous:World,world:World,epoch:number,revision:number,slots:ReadonlyMap<number,number>,candidate:ResourceStructureCandidate|undefined):void {
  const before=stamps[this.collection].get(previous);
  if(!before||before.owner!==this||before.generation!==this.generation||before.epoch!==epoch||epoch!==this.epoch||before.revision!==this.revision||revision<=before.revision||!before.valid()){
   this.reset(world,epoch,revision,slots);return;
  }
  const cost=candidate?4+2*(candidate.removed.length+candidate.added.length+candidate.updated.length):0;
  const copy=(rows:ResourceStructureCandidate['added'])=>Object.freeze(rows.map(row=>Object.freeze({id:row.id,afterOrdinal:row.afterOrdinal})));
  const edge=candidate&&cost<=131072?Object.freeze({parentRevision:before.revision,revision,beforeCount:candidate.beforeCount,afterCount:candidate.afterCount,
   removed:Object.freeze(candidate.removed.map(row=>Object.freeze({id:row.id,beforeOrdinal:row.beforeOrdinal}))),added:copy(candidate.added),updated:copy(candidate.updated)}):undefined;
  this.records.set(revision,{parent:before.revision,edge,cost:edge?cost:0});this.values+=edge?cost:0;
  while(this.records.size>64||this.values>131072){const first=this.records.keys().next().value!;this.values-=this.records.get(first)!.cost;this.records.delete(first);}
  this.revision=revision;this.stamp(world,epoch,revision,slots);
 }
 read(before:Stamp,after:Stamp):ResidentCollectionChanges379|undefined {
  if(before.generation!==this.generation||after.generation!==this.generation||before.epoch!==this.epoch||after.epoch!==this.epoch||before.revision>=after.revision||!before.valid()||!after.valid())return;
  const edges:SnapshotResourceStructureEdge[]=[];let revision=after.revision;
  while(revision>before.revision){const entry=this.records.get(revision);if(!entry?.edge||entry.parent<before.revision||entry.parent>=revision)return;edges.push(entry.edge);revision=entry.parent;}
  if(revision!==before.revision)return;
  return Object.freeze({edges:Object.freeze(edges.reverse()),before:before.directory,after:after.directory});
 }
 accepts(stamp:Stamp):boolean{return stamp.generation===this.generation&&stamp.epoch===this.epoch&&stamp.valid();}
}

/** Read-only consumers still own their immutable snapshot mandate. The proof
 * covers IDs/order and the exact target, never arbitrary mutable leaf values. */
export function readResidentCollectionDirectory379(world:World,collection:ResidentCollection379):ResidentCollectionDirectory379|undefined {
 const stamp=stamps[collection].get(world);return stamp&&stamp.owner.accepts(stamp)?stamp.directory:undefined;
}
export function readResidentCollectionChanges379(from:World,to:World,collection:ResidentCollection379):ResidentCollectionChanges379|undefined {
 const before=stamps[collection].get(from),after=stamps[collection].get(to);
 return before&&after&&before.owner===after.owner?before.owner.read(before,after):undefined;
}
