import type {Box3,Group} from 'three/webgpu';

export interface FurnitureDrawRange379 {readonly first:number;readonly count:number;readonly bounds:Box3}
export interface FurnitureSpatialBatches379 {
 readSpatialBounds?(group:Group,key:string,first:number,count:number):Box3|undefined;
 setSpatialRanges?(group:Group,key:string,ranges:readonly FurnitureDrawRange379[]|undefined):boolean;
}
export interface FurnitureRangeSegment379 {readonly key:string;readonly start:number;readonly capacity:number}
interface OwnedRanges {readonly group:Group;readonly batches:FurnitureSpatialBatches379;readonly total:number;readonly segments:ReadonlyMap<string,FurnitureDrawRange379>}

const finiteBounds=(bounds:Box3):boolean=>!bounds.isEmpty()&&[bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite);

/** Furniture's original ordered instance intervals, with bounds read only from
 * the renderer's committed matrices. The native owner decides whether it can
 * draw/cull those ranges; no alternate placements or camera list is retained.
 * Unchanged zones keep their exact bounds through sparse furniture patches. */
export class FurnitureSpatialRanges379 {
 private owned:OwnedRanges|undefined;
 clear():void {
  const old=this.owned;this.owned=undefined;
  old?.batches.setSpatialRanges?.(old.group,'furniture',undefined);
 }
 update(group:Group,batches:FurnitureSpatialBatches379,segments:Iterable<FurnitureRangeSegment379>,total:number,dirty?:ReadonlySet<string>):boolean {
  const read=batches.readSpatialBounds,set=batches.setSpatialRanges;
  if(!read||!set){this.clear();return false;}
  const previous=this.owned;this.owned=undefined;
  if(previous&&(previous.group!==group||previous.batches!==batches))previous.batches.setSpatialRanges?.(previous.group,'furniture',undefined);
  const retained=previous?.group===group&&previous.batches===batches&&previous.total===total?previous:undefined;
  const next=new Map<string,FurnitureDrawRange379>(),ranges:FurnitureDrawRange379[]=[];
  const refuse=()=>{set.call(batches,group,'furniture',undefined);return false;};
  let at=0;
  try{
   if(!Number.isSafeInteger(total)||total<0)return refuse();
   for(const segment of segments){
    const {key,start:first,capacity:count}=segment;
    if(next.has(key)||!Number.isSafeInteger(first)||!Number.isSafeInteger(count)||first!==at||count<=0||first+count>total)return refuse();
    const old=retained?.segments.get(key),bounds=dirty!==undefined&&!dirty.has(key)&&old?.first===first&&old.count===count?old.bounds:read.call(batches,group,'furniture',first,count)?.clone();
    if(!bounds||!finiteBounds(bounds))return refuse();
    const range={first,count,bounds};next.set(key,range);ranges.push(range);at+=count;
   }
   if(at!==total)return refuse();
   if(!set.call(batches,group,'furniture',ranges)){set.call(batches,group,'furniture',undefined);return false;}
   this.owned={group,batches,total,segments:next};return true;
  }catch(error){set.call(batches,group,'furniture',undefined);throw error;}
 }
}
