import {Box3} from 'three/webgpu';
import type {SpatialInstanceRange379} from './SpatialInstanceRanges379';

export const PLANT_CLUSTER_PAGE_SIDE379=16;
interface Page {x:number;z:number;bounds:Box3;slots:number}
const pageCoordinate=(value:number)=>Math.floor(value/PLANT_CLUSTER_PAGE_SIDE379);
/** Initial admission only: no source Resource, transform, phase or attribute
 * changes. Stable ordering within a page keeps all original equal-cell ties. */
export function comparePlantClusterPages379(a:{x:number;z:number},b:{x:number;z:number}):number {
 return pageCoordinate(a.z)-pageCoordinate(b.z)||pageCoordinate(a.x)-pageCoordinate(b.x);
}
/** positionLocal has received the instance transform in the original shader.
 * Strength is clamped to2; .075*sin + .12 is at most .195. Both actual wind
 * branches therefore move horizontally by <= .39*y². Keep the previous .3
 * envelope as a floor, plus a small allowance for F32 basis/matrix rounding. */
export function plantClusterSwayPadding379(bounds:Box3):number {
 return Math.max(.3,.39*Math.max(bounds.min.y*bounds.min.y,bounds.max.y*bounds.max.y)+.00001);
}
/** Producer-owned spatial membership over the EXISTING global instance slots.
 * Bounds may grow conservatively after a removal/move. Stable growth stages
 * touch only their page; source slot runs rebuild only on real membership.
 * No camera, render visibility or alternate matrix/color buffer is kept here. */
export class PlantClusterSpatial379 {
 private readonly pages=new Map<string,Page>();
 private readonly slots=new Map<number,Page>();
 private readonly retired=new Set<number>();
 private readonly padded=new Box3();
 private revision=0;
 private published=-1;
 private ranges:readonly SpatialInstanceRange379[]|undefined;
 private invalid=false;
 private membershipDirty=true;
 private runs:{first:number;count:number;page:Page}[]=[];
 private rangeBuilds=0;
 private sourceCount=-1;
 clear():void {this.pages.clear();this.slots.clear();this.retired.clear();this.runs=[];this.invalid=false;this.membershipDirty=true;this.sourceCount=-1;this.revision++;}
 remove(index:number):void {
  if(this.slots.has(index))this.retired.add(index);
  // Retain page affinity for the original zero-matrix tombstone. The draw
  // table still covers the exact global prefix, including its zero slots.
  // Reuse can therefore keep both source buffers and interval commands.
 }
 set(index:number,x:number,z:number,bounds:Box3):void {
  if(!Number.isSafeInteger(index)||index<0||!Number.isFinite(x)||!Number.isFinite(z)
   ||![bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite)){
   this.invalid=true;this.revision++;return;
  }
  const px=pageCoordinate(x),pz=pageCoordinate(z),key=`${pz}:${px}`;
  let page=this.pages.get(key),old=this.slots.get(index);
  this.retired.delete(index);
  if(old&&(old.x!==px||old.z!==pz)){
   this.slots.delete(index);if(--old.slots===0)this.pages.delete(`${old.z}:${old.x}`);
   old=undefined;this.membershipDirty=true;this.revision++;
  }
  if(!page){page={x:px,z:pz,bounds:new Box3(),slots:0};this.pages.set(key,page);}
  if(!old){this.slots.set(index,page);page.slots++;this.membershipDirty=true;this.revision++;}
  this.padded.copy(bounds).expandByScalar(plantClusterSwayPadding379(bounds));
  if(!page.bounds.containsBox(this.padded)){page.bounds.union(this.padded);this.revision++;}
 }
 /** Immutable range/bounds publication. The generic native draw owner may
  * retain it across callbacks and independently cache each camera's plan. */
 capture(count:number):readonly SpatialInstanceRange379[]|undefined {
  if(count!==this.sourceCount){this.sourceCount=count;this.membershipDirty=true;this.revision++;}
  if(this.published===this.revision)return this.ranges;
  if(this.invalid){this.published=this.revision;return this.ranges=undefined;}
  if(this.membershipDirty){
   const ordered=[...this.slots].filter(([index])=>index<count).sort(([a],[b])=>a-b),runs:{first:number;count:number;page:Page}[]=[];
   for(const [index,page] of ordered){const last=runs.at(-1);if(last&&last.page===page&&last.first+last.count===index)last.count++;else runs.push({first:index,count:1,page});}
   this.runs=runs;this.membershipDirty=false;this.rangeBuilds++;
  }
  const bounds=new Map<Page,Box3>();
  this.ranges=this.runs.map(run=>{let box=bounds.get(run.page);if(!box){box=run.page.bounds.clone();bounds.set(run.page,box);}return{first:run.first,count:run.count,bounds:box};});
  this.published=this.revision;return this.ranges;
 }
 metrics(){return{pageSide:PLANT_CLUSTER_PAGE_SIDE379,pages:this.pages.size,activeSlots:this.slots.size-this.retired.size,tombstones:this.retired.size,ranges:this.runs.length,rangeBuilds:this.rangeBuilds,revision:this.revision,valid:!this.invalid};}
}
