import type {World,Structure} from '../sim/types';
import type {SnapshotMessage,ResourceStructureCandidate} from './snapshots';
import {isOrdinaryResidentOwnerRecord379,isOrdinaryResidentOwnerArray379,residentOwnerArray379,residentOwnerArraySlice379} from './resident-owner-records-379';
import {nextResidentMembershipValues379,nextResidentOrdinalSlots379,residentOrdinalSlots379} from './resident-ordinal-slots-379';

/** Native-only ownership negotiation. Literal rows remain on the wire, so the
 * independent fixed native guards keep their original record identities. */
export interface ResidentStructuresSection379 {readonly epoch:number;readonly revision:number;readonly checkpoint:boolean;readonly baseRevision?:number}
const own=Object.hasOwn;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(v:unknown):v is Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
 for(const key of Reflect.ownKeys(v)){const d=typeof key==='string'?Object.getOwnPropertyDescriptor(v,key):undefined;if(!d?.enumerable||!own(d,'value'))return false;}return true;
}
function dense(v:unknown):v is unknown[]{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)return false;
 for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,i);if(!d?.enumerable||!own(d,'value'))return false;}return true;
}
const keySets:ReadonlySet<PropertyKey>[]=[],negativeRows=new WeakMap<object,readonly string[]>();
type Positive={readonly id:number;readonly ordinal:number;readonly row:Structure};
interface Shape {readonly maxId:number;readonly positives:readonly Positive[];readonly keys:ReadonlySet<string>}
const shapes=new WeakMap<object,Shape>();
function noInherited(keys:ReadonlySet<PropertyKey>):boolean {
 if(Object.getPrototypeOf(Object.prototype)!==null)return false;
 for(const key of Reflect.ownKeys(Object.prototype))if(keys.has(key))return false;return true;
}
/** The only rows made immutable are ordinary NEW negative leaves. Positive
 * owners (caskets, nested pawns, markers) retain their original mutable roots
 * and full descriptor traversal. No previously exposed mutable row is upgraded. */
function prepareRow(row:Structure):readonly string[]|undefined {
 const held=negativeRows.get(row);if(held)return held;
 if(!isOrdinaryResidentOwnerRecord379(row)||!record(row))return;
 const keys=Object.keys(row);
 if(keySets.length<2)return keys;
 for(const relevant of keySets)for(const key of keys)if(relevant.has(key))return keys;
 Object.freeze(row);negativeRows.set(row,Object.freeze(keys));return keys;
}
function positiveShape(row:Positive):boolean {
 return isOrdinaryResidentOwnerRecord379(row.row)&&record(row.row)&&Object.getOwnPropertyDescriptor(row.row,'id')?.value===row.id;
}
export function hasOwnedResidentStructureShape379(values:unknown,nextId:number):boolean {
 const held=values&&typeof values==='object'?shapes.get(values):undefined;
 return !!held&&held.maxId<nextId&&held.positives.every(positiveShape);
}
export function createResidentStructureTransport379(keys:ReadonlySet<PropertyKey>):{
 read:(value:object)=>boolean;
 array:(values:readonly unknown[],visit:(value:unknown)=>boolean)=>boolean|undefined;
} {
 const relevant=new Set(keys);keySets.push(relevant);
 const leaf=(value:object):boolean=>{
  const row=negativeRows.get(value),list=shapes.get(value);
  const ownKeys=row??(list&&!list.positives.length?list.keys:undefined);if(!ownKeys)return false;
  for(const key of ownKeys)if(relevant.has(key))return false;return noInherited(relevant);
 };
 return {read:leaf,array:(values,visit)=>{
  const held=shapes.get(values);if(!held)return;
  let canSkip=true;for(const key of held.keys)if(relevant.has(key)){canSkip=false;break;}
  let from=0;
  const gap=(through:number):boolean=>{
   if(from<through&&(!canSkip||!noInherited(relevant)))for(let i=from;i<through;i++)if(!visit(values[i]))return false;
   from=through;return true;
  };
  for(const positive of held.positives){if(!gap(positive.ordinal)||!visit(positive.row))return false;from=positive.ordinal+1;}
  return gap(values.length);
 }};
}
function readonlyKeys(keys:ReadonlySet<string>):ReadonlySet<string>{
 const held=new Set(keys),view:ReadonlySet<string>=Object.freeze({get size(){return held.size;},has:(key:string)=>held.has(key),entries:()=>held.entries(),keys:()=>held.keys(),values:()=>held.values(),[Symbol.iterator]:()=>held[Symbol.iterator](),forEach:(callback:(v:string,k:string,s:ReadonlySet<string>)=>void,thisArg?:unknown)=>held.forEach(key=>callback.call(thisArg,key,key,view))});return view;
}
interface State {readonly epoch:number;readonly revision:number;readonly values:Structure[];readonly slots:ReadonlyMap<number,number>;readonly shape:Shape}
export interface PreparedResidentStructures379 {
 readonly packet:SnapshotMessage<true>;readonly previous:State|undefined;readonly state?:State;readonly generation:number;
 readonly indices?:number[];readonly edge?:ResourceStructureCandidate;
}
const preparations=new WeakMap<object,PreparedResidentStructures379>();
export function bindPreparedResidentStructures379(packet:SnapshotMessage<true>,draft:PreparedResidentStructures379):void {if(draft.state)preparations.set(packet,draft);}
export function readPreparedResidentStructures379(packet:SnapshotMessage<true>,previous:World|undefined):PreparedResidentStructures379|undefined {
 const draft=preparations.get(packet);return draft&&(packet.kind==='checkpoint'||draft.previous?.values===previous?.structures)?draft:undefined;
}
function sealList(values:Structure[],slots:ReadonlyMap<number,number>,keys:ReadonlySet<string>,maxId:number,previous?:Shape,incoming?:readonly Structure[]):Shape {
 if(!isOrdinaryResidentOwnerArray379(values))throw Error('Unknown native structure array');const positives:Positive[]=[];
 if(previous&&incoming){
  // The previous positive directory is exhaustive and every surviving
  // negative row is an immutable own-data leaf. A versioned edge can only
  // introduce positives through its actual incoming rows: never re-read
  // thousands of unchanged walls/floors simply to discover their absence.
  const seen=new Set<number>();
  const take=(id:number,held?:Positive)=>{if(seen.has(id))return;seen.add(id);const ordinal=slots.get(id);if(ordinal===undefined)return;const row=values[ordinal]!;if(!negativeRows.has(row))positives.push(held&&held.ordinal===ordinal&&held.row===row?held:Object.freeze({id,ordinal,row}));};
  for(const positive of previous.positives)take(positive.id,positive);
  for(const row of incoming)if(!negativeRows.has(row))take(row.id);
  positives.sort((a,b)=>a.ordinal-b.ordinal);
 }else for(let ordinal=0;ordinal<values.length;ordinal++){const row=values[ordinal]!;if(!negativeRows.has(row))positives.push(Object.freeze({id:row.id,ordinal,row}));}
 Object.freeze(values);const shape=Object.freeze({maxId,positives:Object.freeze(positives),keys:readonlyKeys(keys)});shapes.set(values,shape);return shape;
}
/** Closed immutable memberships, plus an explicit list of mutable positive
 * owners. Unknown/public packets keep the existing literal path unchanged. */
export class ResidentStructuresFrameOwner379 {
 private current:State|undefined;private generation=0;private readonly drafts=new WeakSet<object>();
 clear():void {this.current=undefined;this.generation++;}
 prepare(packet:SnapshotMessage<true>,raw:unknown):PreparedResidentStructures379|undefined {
  const generation=this.generation,previous=this.current,checkpoint=packet.kind==='checkpoint';
  try{
   if(!record(raw)||Object.keys(raw).some(key=>!['epoch','revision','checkpoint',...checkpoint?[]:['baseRevision']].includes(key))||Object.keys(raw).length!==(checkpoint?3:4)
    ||raw.epoch!==packet.epoch||raw.revision!==packet.revision||raw.checkpoint!==checkpoint||!checkpoint&&raw.baseRevision!==packet.baseRevision)return;
   const literal=()=>{const draft=Object.freeze({packet,previous,generation});this.drafts.add(draft);return draft;};
   if(!checkpoint&&(!previous||previous.epoch!==packet.epoch||previous.revision!==packet.baseRevision))return literal();
   const sparse=!checkpoint&&own(packet,'structures'),patch=sparse?(packet as unknown as Record<string,unknown>).structures:undefined;
   if(sparse&&(!patch||typeof patch!=='object'||!isOrdinaryResidentOwnerRecord379(patch)))return literal();
   if(sparse&&!record(patch))return;
   const rows=sparse&&record(patch)?patch.upserted:(packet.world as unknown as Record<string,unknown>).structures;
   if(!Array.isArray(rows)||!isOrdinaryResidentOwnerArray379(rows))return literal();
   if(!dense(rows)||!integer(packet.world.nextId,1))return;
   for(const row of rows)if(!row||typeof row!=='object'||!isOrdinaryResidentOwnerRecord379(row))return literal();
   if(previous&&!previous.shape.positives.every(positiveShape))return;
   const nextId=packet.world.nextId,seen=new Set<number>(),keys=new Set(checkpoint?undefined:previous?.shape.keys),incoming:Structure[]=residentOwnerArray379();let maxId=checkpoint?0:previous?.shape.maxId??0;
   for(const row of rows){if(!record(row)||!integer(row.id,1,nextId-1)||seen.has(row.id))return;seen.add(row.id);const fields=prepareRow(row as unknown as Structure);if(!fields)return;if(negativeRows.has(row))for(const field of fields)keys.add(field);maxId=Math.max(maxId,row.id);incoming.push(row as unknown as Structure);}
   let values:Structure[],slots:ReadonlyMap<number,number>,indices:number[]|undefined,edge:ResourceStructureCandidate|undefined;
   if(!sparse){values=incoming;slots=residentOrdinalSlots379(values);}
   else {
    if(!record(patch)||!own(patch,'removed')||!own(patch,'upserted')||Object.keys(patch).some(key=>!['removed','upserted','order'].includes(key))||!dense(patch.removed)||own(patch,'order')&&!dense(patch.order))return;
    const before=previous!,touched=new Set<number>(),gone=new Set<number>(),removed:ResourceStructureCandidate['removed'][number][]=[],writes=new Map<number,Structure>();
    for(const id of patch.removed){if(!integer(id,1,nextId-1)||gone.has(id)||!before.slots.has(id))return;gone.add(id);touched.add(id);removed.push({id,beforeOrdinal:before.slots.get(id)!});}
    for(const row of incoming){if(touched.has(row.id))return;touched.add(row.id);writes.set(row.id,row);}
    const membership=!gone.size&&!own(patch,'order')&&incoming.every(row=>before.slots.has(row.id)),appended=own(patch,'order')||membership?[]:incoming.filter(row=>!before.slots.has(row.id));
    if(own(patch,'order')){
     const byId=new Map<number,Structure>();for(const row of before.values)if(!gone.has(row.id))byId.set(row.id,row);for(const [id,row]of writes)byId.set(id,row);
     const order=patch.order as unknown[];if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!integer(id,1,nextId-1)||!byId.has(id)))return;
     values=residentOwnerArray379();for(const id of order)values.push(byId.get(id as number)!);
    }else if(membership){values=writes.size?residentOwnerArraySlice379(before.values):before.values;for(const [id,row]of writes)values[before.slots.get(id)!]=row;}
    else values=nextResidentMembershipValues379(before.values,before.slots,removed,writes,appended);
    slots=membership?before.slots:own(patch,'order')?residentOrdinalSlots379(values):nextResidentOrdinalSlots379(before.slots,removed,appended,values);
    indices=membership?[...touched].map(id=>slots.get(id)!):undefined;
    if(!own(patch,'order'))edge={beforeCount:before.values.length,afterCount:values.length,removed,added:[...writes.keys()].filter(id=>!before.slots.has(id)).map(id=>({id,afterOrdinal:slots.get(id)!})),updated:[...writes.keys()].filter(id=>before.slots.has(id)).map(id=>({id,afterOrdinal:slots.get(id)!}))};
   }
   const shape=previous&&values===previous.values?previous.shape:sealList(values,slots,keys,maxId,sparse?previous?.shape:undefined,sparse?incoming:undefined),state=Object.freeze({epoch:packet.epoch,revision:packet.revision,values,slots,shape});
   if(generation!==this.generation)return;
   if(indices)Object.freeze(indices);if(edge){for(const rows of [edge.removed,edge.added,edge.updated]){for(const row of rows)Object.freeze(row);Object.freeze(rows);}Object.freeze(edge);}
   const represented=sparse?packet:{...packet,world:{...packet.world,structures:values}} as SnapshotMessage<true>;
   const draft=Object.freeze({packet:represented,previous,state,generation,indices,edge});this.drafts.add(draft);return draft;
  }catch{return;}
 }
 canCommit(world:World,draft:PreparedResidentStructures379):boolean {return this.drafts.has(draft)&&draft.generation===this.generation&&draft.previous===this.current&&(!draft.state||world.structures===draft.state.values&&draft.state.shape.positives.every(positiveShape));}
 commit(world:World,draft:PreparedResidentStructures379):void {if(!this.canCommit(world,draft))throw Error('Lost native structure predecessor');this.drafts.delete(draft);this.current=draft.state;}
}
