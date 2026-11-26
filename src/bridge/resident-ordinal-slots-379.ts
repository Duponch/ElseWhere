import {isOrdinaryResidentOwnerArray379,residentOwnerArray379,residentOwnerArraySlice379} from './resident-owner-records-379';
import type {ResourceStructureCandidate} from './snapshots';

type Identity={readonly id:number};
const overlayDepth=new WeakMap<ReadonlyMap<number,number>,number>();
const MAX_OVERLAY_DEPTH=4,MAX_NATIVE_REMOVALS=24;
const nativeSplice=Array.prototype.splice;
const nativeIterator=Array.prototype[Symbol.iterator];

/** A retained flat directory is rebuilt only at checkpoints, ambiguous order
 * and bounded rebase. Its native map never escapes to an exposed World. */
export function residentOrdinalSlots379(values:readonly Identity[]):ReadonlyMap<number,number> {
 const map=new Map<number,number>();for(let i=0;i<values.length;i++)map.set(values[i]!.id,i);
 return wrapSlots(map);
}
function wrapSlots(map:Map<number,number>):ReadonlyMap<number,number> {
 const view:ReadonlyMap<number,number>=Object.freeze({get size(){return map.size;},get:(id:number)=>map.get(id),has:(id:number)=>map.has(id),entries:()=>map.entries(),keys:()=>map.keys(),values:()=>map.values(),[Symbol.iterator]:()=>map[Symbol.iterator](),forEach:(cb:(value:number,key:number,map:ReadonlyMap<number,number>)=>void,thisArg?:unknown)=>map.forEach((value,key)=>cb.call(thisArg,value,key,view))});return view;
}
function lowerBound(sorted:readonly number[],value:number):number {
 let from=0,to=sorted.length;while(from<to){const middle=(from+to)>>>1;if(sorted[middle]!<value)from=middle+1;else to=middle;}return from;
}
/** Exact remove/append source-ordinal transformation. Old directory views
 * remain immutable, including those held by queued Worlds. An occasional
 * rebase bounds the complete predecessor chain to four real membership
 * revisions; ordinary field-only Fulls reuse the same directory by identity. */
export function nextResidentOrdinalSlots379(previous:ReadonlyMap<number,number>,removed:ResourceStructureCandidate['removed'],appended:readonly Identity[],values:readonly Identity[]):ReadonlyMap<number,number> {
 if(!removed.length&&!appended.length)return previous;
 const depth=overlayDepth.get(previous)??0;
 if(depth>=MAX_OVERLAY_DEPTH||removed.length>MAX_NATIVE_REMOVALS||appended.length>256)return residentOrdinalSlots379(values);
 const offsets=removed.map(row=>row.beforeOrdinal).sort((a,b)=>a-b),gone=new Set(removed.map(row=>row.id));
 const tail=new Map<number,number>(),first=previous.size-removed.length;
 for(let i=0;i<appended.length;i++)tail.set(appended[i]!.id,first+i);
 // Enumeration is not the hot lookup contract; if demanded by a consumer,
 // keep exactly the previous flat Map iteration order minus removals plus
 // additions. A materialized index also lets later lookups use native Map.
 let materialized:Map<number,number>|undefined;
 const sparseGet=(id:number):number|undefined=>{const added=tail.get(id);if(added!==undefined)return added;if(gone.has(id))return;const old=previous.get(id);return old===undefined?undefined:old-lowerBound(offsets,old);};
 const entries=()=>{
  if(!materialized){const map=new Map<number,number>();for(const [id,ordinal]of previous)if(!gone.has(id))map.set(id,ordinal-lowerBound(offsets,ordinal));for(const [id,ordinal]of tail)map.set(id,ordinal);materialized=map;}
  return materialized;
 };
 const view:ReadonlyMap<number,number>=Object.freeze({size:first+appended.length,get:(id:number)=>materialized?materialized.get(id):sparseGet(id),has:(id:number)=>materialized?materialized.has(id):sparseGet(id)!==undefined,
  entries:()=>entries().entries(),keys:()=>entries().keys(),values:()=>entries().values(),[Symbol.iterator]:()=>entries()[Symbol.iterator](),forEach:(cb:(value:number,key:number,map:ReadonlyMap<number,number>)=>void,thisArg?:unknown)=>entries().forEach((v,k)=>cb.call(thisArg,v,k,view))});
 overlayDepth.set(view,depth+1);return view;
}
/** Keep flat World arrays, but the common small native removal/append edge
 * needs a single native slice, only changed original slots, and a few
 * descending contiguous splices. No per-row Map hash or copied ordinal
 * tuple for each survivor. Large/unknown arrays retain complete discovery. */
export function nextResidentMembershipValues379<T extends Identity>(previous:readonly T[],slots:ReadonlyMap<number,number>,removed:ResourceStructureCandidate['removed'],writes:ReadonlyMap<number,T>,appended:readonly T[]):T[] {
 if(removed.length<=MAX_NATIVE_REMOVALS&&isOrdinaryResidentOwnerArray379(previous)&&Object.getOwnPropertyDescriptor(Array.prototype,'splice')?.value===nativeSplice&&Object.getOwnPropertyDescriptor(Array.prototype,Symbol.iterator)?.value===nativeIterator){
  const values=residentOwnerArraySlice379(previous);
  if(isOrdinaryResidentOwnerArray379(values)){
   for(const [id,row]of writes){const slot=slots.get(id);if(slot!==undefined)values[slot]=row;}
   const ordinals=removed.map(row=>row.beforeOrdinal).sort((a,b)=>b-a);
   for(let i=0;i<ordinals.length;){const last=ordinals[i++]!;let first=last;while(i<ordinals.length&&ordinals[i]===first-1){first--;i++;}Reflect.apply(nativeSplice,values,[first,last-first+1]);}
   for(const row of appended)Object.defineProperty(values,values.length,{value:row,enumerable:true,writable:true,configurable:true});
   return values;
  }
 }
 const gone=new Set(removed.map(row=>row.id)),values=residentOwnerArray379<T>();
 for(const row of previous)if(!gone.has(row.id))values.push(writes.get(row.id)??row);
 for(const row of appended)values.push(row);
 return values;
}
