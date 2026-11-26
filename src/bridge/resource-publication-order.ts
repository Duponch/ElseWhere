import type {Resource} from '../sim/types.ts';
interface IdentityRow {id:number}
interface Node<T extends IdentityRow> {readonly resource:T;readonly rank:number;previous:Node<T>|undefined;next:Node<T>|undefined}
interface OrderedMembershipEdit<T extends IdentityRow> {readonly removed:readonly T[];readonly appended:readonly T[]}
export interface ResourcePublicationCandidates<T extends IdentityRow=Resource> {
 readonly rows:readonly T[];
 readonly dirtyIds:ReadonlySet<number>;
 readonly membership:{readonly changed:boolean;readonly removed:readonly number[];readonly order?:readonly number[]};
}
/** Private codec order, advanced by the real writers' remove/append commits.
 * Numeric ranks preserve source order without rebuilding ordinal tables when
 * a plant disappears. The published ranks remain intact until codec commit,
 * including if an ID is removed and reinserted before that publication. */
export class ResourcePublicationOrder<T extends IdentityRow=Resource> {
 private readonly nodes=new Map<number,Node<T>>();
 private readonly publishedRanks=new Map<number,number>();
 private readonly touched=new Set<number>();
 private first:Node<T>|undefined;
 private last:Node<T>|undefined;
 private rank=0;
 private inversions=0;
 static capture<T extends IdentityRow>(resources:readonly T[]):ResourcePublicationOrder<T>|undefined {
  const order=new ResourcePublicationOrder<T>();
  for(const resource of resources){
   if(order.nodes.has(resource.id)||!Number.isSafeInteger(resource.id))return;
   const node=order.append(resource);order.publishedRanks.set(resource.id,node.rank);
  }
  return order;
 }
 /** Called only on a journal gap/unknown transaction, to restore the public
  * codec's previous order before its exhaustive fallback. No live fields read. */
 publishedOrder():number[] {return [...this.publishedRanks].sort((a,b)=>a[1]-b[1]).map(row=>row[0]);}
 row(id:number):T|undefined {return this.nodes.get(id)?.resource;}
 orderedRows(ids:ReadonlySet<number>):T[] {
  const rows:Node<T>[]=[];for(const id of ids){const node=this.nodes.get(id);if(node)rows.push(node);}rows.sort((a,b)=>a.rank-b.rank);return rows.map(node=>node.resource);
 }
 private inverted(left:Node<T>|undefined,right:Node<T>|undefined):number {
  if(!left||!right)return 0;
  const a=this.publishedRanks.get(left.resource.id),b=this.publishedRanks.get(right.resource.id);
  // Implicit codec order is published survivors, then genuinely new upserts
  // in source order. An existing ID after a new ID requires explicit order.
  return a===undefined?(b===undefined?Number(left.rank>right.rank):1):b===undefined?0:Number(a>b);
 }
 private append(resource:T):Node<T> {
  const node:Node<T>={resource,rank:this.rank++,previous:this.last,next:undefined};
  this.inversions+=this.inverted(this.last,node);
  if(this.last)this.last.next=node;else this.first=node;
  this.last=node;this.nodes.set(resource.id,node);return node;
 }
 private remove(node:Node<T>):void {
  const {previous,next}=node;
  this.inversions-=this.inverted(previous,node)+this.inverted(node,next);
  this.inversions+=this.inverted(previous,next);
  if(previous)previous.next=next;else this.first=next;
  if(next)next.previous=previous;else this.last=previous;
  this.nodes.delete(node.resource.id);
 }
 /** Unknown/contradictory edits refuse; a caller then discards this directory.
  * Every ordinary edit touches only the removed/appended nodes and neighbors.
  * All-reader verification remains the independent exhaustive codec. */
 prepare(edits:readonly OrderedMembershipEdit<T>[],dirtyIds:ReadonlySet<number>,length:number):ResourcePublicationCandidates<T>|undefined {
  for(const edit of edits){
   for(const resource of edit.removed){
    const node=this.nodes.get(resource.id);if(!node||node.resource!==resource)return;
    this.touched.add(resource.id);this.remove(node);
   }
   for(const resource of edit.appended){
    if(this.nodes.has(resource.id)||!Number.isSafeInteger(resource.id)||this.rank===Number.MAX_SAFE_INTEGER)return;
    this.touched.add(resource.id);this.append(resource);
   }
  }
  if(this.nodes.size!==length)return;
  const removed:number[]=[];let added=false;
  for(const id of this.touched){
   if(this.nodes.has(id)){if(!this.publishedRanks.has(id))added=true;}
   else if(this.publishedRanks.has(id))removed.push(id);
  }
  removed.sort((a,b)=>this.publishedRanks.get(a)!-this.publishedRanks.get(b)!);
  let explicit:number[]|undefined;
  if(this.inversions){explicit=[];for(let node=this.first;node;node=node.next)explicit.push(node.resource.id);}
  return {rows:this.orderedRows(dirtyIds),dirtyIds,membership:{changed:added||removed.length>0||!!explicit,removed,...explicit?{order:explicit}:{}}};
 }
 commit():void {
  for(const id of this.touched){const node=this.nodes.get(id);if(node)this.publishedRanks.set(id,node.rank);else this.publishedRanks.delete(id);}
  this.touched.clear();this.inversions=0;
 }
}
