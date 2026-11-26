import type {FilthRecord} from '../sim/filth-rules';
import type {World} from '../sim/types';
import {readSnapshotTileChanges} from '../bridge/snapshot-changes';
import {filthDecal} from './filth-appearance';
import {FLOOR_SURFACE_Y,filthDecalBounds,filthSurfacePatches,surfaceHeightAtCell,type FilthSurface,type SurfacePatch} from './surface-height';

export interface FilthPresentationPiece {readonly decal:ReturnType<typeof filthDecal>;readonly patch:SurfacePatch}
type HeightCapture=Readonly<{index:number;height:number|undefined}>;
interface HeightCache {has(index:number):boolean;get(index:number):number|undefined;set(index:number,value:number|undefined):unknown}
type HeightCell={stamp:number;value:number|undefined};
const HEIGHT_CACHE_LIMIT=131072;
/** A per-read view, never a retained surface observation across reads. */
class HeightReadCache {
 constructor(private readonly cells:Map<number,HeightCell>,private readonly stamp:number){}
 has(index:number):boolean {return this.cells.get(index)?.stamp===this.stamp;}
 get(index:number):number|undefined {const cell=this.cells.get(index);return cell?.stamp===this.stamp?cell.value:undefined;}
 set(index:number,value:number|undefined):this {const cell=this.cells.get(index);if(cell){cell.stamp=this.stamp;cell.value=value;}else this.cells.set(index,{stamp:this.stamp,value});return this;}
}

type Capture=Pick<FilthRecord,'id'|'x'|'z'|'kind'|'thickness'>;
interface Entry {
 readonly source:Capture;readonly width:number|undefined;readonly height:number|undefined;
 readonly heights:readonly HeightCapture[];readonly pieces:readonly FilthPresentationPiece[];readonly offset:number;
}
export interface FilthPresentationBlock {readonly offset:number;readonly pieces:readonly FilthPresentationPiece[];readonly changed:boolean}

/** Preserve transparent draw order. Unchanged identities borrow their exact
 * pieces; insertions/removals only rewrite shifted blocks, never re-derive
 * their decals or surface partition. Value copies retain mutable RAW support. */
export class FilthPresentationPieces {
 private entries=new Map<number,Entry>();
 private ordered:Entry[]=[];
 private blocks:readonly FilthPresentationBlock[]=[];
 private count=0;
 // Scalars only: no World, surface, tile, callback or ID owner is retained.
 private readonly heightCells=new Map<number,HeightCell>();
 private heightStamp=0;
 private reading=false;
 private clearHeightCells=false;
 private world:World|undefined;
 private same(entry:Entry,item:FilthRecord,surface:FilthSurface|undefined,heights:HeightCache,changedTiles:ReadonlySet<number>|undefined):boolean {
  const p=entry.source;
  if(p.x!==item.x||p.z!==item.z||p.kind!==item.kind||p.thickness!==item.thickness||entry.width!==surface?.width||entry.height!==surface?.height)return false;
  if(changedTiles?.size===0)return true;
  if(surface)for(let at=0;at<entry.heights.length;at++){
   const capture=entry.heights[at]!,index=capture.index,height=capture.height;
   // These observations belong to the exact previous successful read. The
   // decoder's tile suffix covers every intermediate publication, including
   // resource births/removals. An untouched cell retains its captured height.
   if(changedTiles&&!changedTiles.has(index))continue;
   let current:number|undefined;
   if(heights.has(index))current=heights.get(index);
   else {current=surfaceHeightAtCell(surface,index%surface.width,Math.floor(index/surface.width));heights.set(index,current);}
   if(current!==height)return false;
  }
  return true;
 }
 read(items:readonly FilthRecord[],reset=false,surface?:FilthSurface):{blocks:readonly FilthPresentationBlock[];count:number;changed:boolean} {
  this.world=undefined;
  return this.readSurface(items,reset,surface);
 }
 /** Closed application path. A World flag, shared array or equal tick cannot
  * prove surface stability. Missing/evicted history and public reads return to
  * complete height observation. The predecessor is committed only on success. */
 readWorld(world:World,reset=false):{blocks:readonly FilthPresentationBlock[];count:number;changed:boolean} {
  const before=this.world;this.world=undefined;
  const changes=!reset&&before&&before!==world&&before.seed===world.seed&&before.width===world.width&&before.height===world.height
   ?readSnapshotTileChanges(before,world):undefined;
  const result=this.readSurface(world.filth?.items??[],reset,world,changes?new Set(changes):undefined);
  this.world=world;return result;
 }
 private readSurface(items:readonly FilthRecord[],reset:boolean,surface?:FilthSurface,changedTiles?:ReadonlySet<number>):{blocks:readonly FilthPresentationBlock[];count:number;changed:boolean} {
  const nested=this.reading;
  // A nested public read may be triggered by a surface getter. Its historical
  // local Map cannot invalidate this outer call's still-live view.
  if(!nested&&this.heightStamp>=Number.MAX_SAFE_INTEGER){this.heightCells.clear();this.heightStamp=0;}
  const stamp=++this.heightStamp;
  this.clearHeightCells=this.clearHeightCells||reset;
  const heights:HeightCache=nested?new Map<number,number|undefined>():new HeightReadCache(this.heightCells,stamp);
  if(!nested)this.reading=true;
  try{return this.readWithin(items,reset,surface,heights,nested?undefined:changedTiles);}
  finally {if(!nested){this.reading=false;if(this.clearHeightCells||this.heightCells.size>HEIGHT_CACHE_LIMIT)this.heightCells.clear();this.clearHeightCells=false;}}
 }
 private readWithin(items:readonly FilthRecord[],reset:boolean,surface:FilthSurface|undefined,heights:HeightCache,changedTiles:ReadonlySet<number>|undefined):{blocks:readonly FilthPresentationBlock[];count:number;changed:boolean} {
  if(!reset&&items.length===this.ordered.length&&items.every((item,i)=>{
   const old=this.ordered[i]!;return old.source.id===item.id&&this.same(old,item,surface,heights,changedTiles);
  }))return {blocks:this.blocks,count:this.count,changed:false};
  const next=new Map<number,Entry>(),ordered:Entry[]=[],blocks:FilthPresentationBlock[]=[];
  let count=0,changed=reset;
  for(const item of items){
   const old=!reset?this.entries.get(item.id):undefined;
   let entry:Entry;
   if(old&&this.same(old,item,surface,heights,changedTiles))entry=old;
   else {
    const pieces:FilthPresentationPiece[]=[],observed=new Map<number,number|undefined>();
    for(let layer=0;layer<item.thickness;layer++){
     const decal=filthDecal(item,layer),bounds=filthDecalBounds(decal);
     if(surface){
      const minX=Math.max(0,Math.floor(bounds.minX+.5)),maxX=Math.min(surface.width-1,Math.floor(bounds.maxX+.5));
      const minZ=Math.max(0,Math.floor(bounds.minZ+.5)),maxZ=Math.min(surface.height-1,Math.floor(bounds.maxZ+.5));
      for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
       const index=z*surface.width+x;
       if(!heights.has(index))heights.set(index,surfaceHeightAtCell(surface,x,z));
       observed.set(index,heights.get(index));
      }
     }
     for(const patch of surface?filthSurfacePatches(surface,bounds):[{...bounds,height:FLOOR_SURFACE_Y}])pieces.push({decal,patch});
    }
    const captured:HeightCapture[]=[];observed.forEach((height,index)=>captured.push({index,height}));
    entry={source:{id:item.id,x:item.x,z:item.z,kind:item.kind,thickness:item.thickness},width:surface?.width,height:surface?.height,heights:captured,pieces,offset:count};
   }
   const dirty=entry!==old||entry.offset!==count;
   blocks.push({offset:count,pieces:entry.pieces,changed:dirty});changed=changed||dirty;
   const retained=entry.offset===count?entry:{...entry,offset:count};
   next.set(item.id,retained);ordered.push(retained);count+=entry.pieces.length;
  }
  changed=changed||count!==this.count;this.count=count;this.entries=next;this.ordered=ordered;this.blocks=blocks;
  return {blocks,count,changed};
 }
}

