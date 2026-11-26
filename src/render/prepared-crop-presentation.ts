import {readPreparedCropFrame,collectPreparedCropChanges,type PreparedCropFrame,type PreparedCropObservation} from '../bridge/prepared-natural-frame';
import {isResidentCrop,RESIDENT_CROP_KINDS,type ResidentCropKind} from './flora-presentation';
import {readSceneResourceFrame,type SceneResourceFrame} from './scene-resource-index';
import type {World,Resource} from '../sim/types';

/** Current-frame columns, consumed synchronously before the next readScene. */
export interface PreparedCropChanges {
 readonly resources:Resource[];
 readonly appearances:PreparedCropObservation[];
 readonly removed:number[];
}
const cropChanges=():PreparedCropChanges=>({resources:[],appearances:[],removed:[]});
const emptyOrder=():Record<ResidentCropKind,number[]>=>({rice:[],potato:[],corn:[],cotton:[],haygrass:[],hops:[],devilstrand:[]});

/** Renderer-owned numerical membership only. Current Resource references are
 * resolved through the already adopted SceneResourceIndex, never an extra
 * global ID map or a previous Resource. Primitive orders preserve tail/removal
 * semantics; only actual topology edits splice those small numeric arrays. */
export class PreparedCropPresentation {
 private previous:PreparedCropFrame|undefined;
 private previousWorld:World|undefined;
 private kinds=new Map<number,ResidentCropKind>();
 private order=emptyOrder();
 private tails:Partial<Record<ResidentCropKind,Resource>>={};
 private readonly batches:Record<ResidentCropKind,PreparedCropChanges>={
  rice:cropChanges(),potato:cropChanges(),corn:cropChanges(),cotton:cropChanges(),
  haygrass:cropChanges(),hops:cropChanges(),devilstrand:cropChanges(),
 };
 changesFor(kind:ResidentCropKind):PreparedCropChanges {return this.batches[kind];}
 private clearChanges():void {
  for(const kind of RESIDENT_CROP_KINDS){
   const batch=this.batches[kind];batch.resources.length=0;batch.appearances.length=0;batch.removed.length=0;
  }
 }
 hasFrameChange(world:World):boolean {return readPreparedCropFrame(world)!==this.previous;}
 count(kind:ResidentCropKind):number {return this.order[kind].length;}
 last(kind:ResidentCropKind):Resource|undefined {return this.tails[kind];}
 clear():void {this.previous=undefined;this.previousWorld=undefined;this.kinds.clear();this.order=emptyOrder();this.tails={};this.clearChanges();}
 readScene(world:World,reset=false,index?:SceneResourceFrame):{changed:boolean}|undefined {
  const frame=readPreparedCropFrame(world);if(!frame)return;
  this.clearChanges();if(!reset&&frame===this.previous)return {changed:false};
  const access=readSceneResourceFrame(index,world,reset?undefined:this.previousWorld);if(!access)throw Error('Prepared crops require current scene resource index and played predecessor');
  const affected=!reset&&this.previous?collectPreparedCropChanges(this.previous,frame):undefined;
  if(affected===undefined){
   const old=this.kinds;this.kinds=new Map();this.order=emptyOrder();
   for(const resource of world.resources){
    const appearance=frame.lookup(resource.id);
    if(!isResidentCrop(resource)){if(appearance)throw Error('Prepared crop observation on a natural resource');continue;}
    if(!appearance)throw Error('Missing prepared crop '+resource.id);
    const kind=resource.kind as ResidentCropKind;this.kinds.set(resource.id,kind);this.order[kind].push(resource.id);
    const batch=this.batches[kind];batch.resources.push(resource);batch.appearances.push(appearance);
   }
   for(const [id,kind] of old)if(this.kinds.get(id)!==kind)this.batches[kind].removed.push(id);
  }else{
   const present:{source:number;resource:Resource;appearance:PreparedCropObservation}[]=[];
   // Remove every retired membership before resolving new ordered insertions.
   for(const id of affected){
    const source=access.resourceSource(id),resource=source===undefined?undefined:world.resources[source],appearance=frame.lookup(id),before=this.kinds.get(id);
    if(appearance&&(!resource||resource.id!==id||!isResidentCrop(resource)))throw Error('Prepared crop identity mismatch '+id);
    if(!appearance&&resource&&isResidentCrop(resource))throw Error('Missing prepared crop observation '+id);
    const kind=appearance?resource!.kind as ResidentCropKind:undefined;
    if(before!==undefined&&before!==kind){const order=this.order[before],at=order.indexOf(id);if(at<0)throw Error('Lost crop order');order.splice(at,1);this.kinds.delete(id);this.batches[before].removed.push(id);}
    if(appearance)present.push({source:source!,resource:resource!,appearance});
   }
   present.sort((a,b)=>a.source-b.source);
   for(const {resource,appearance,source}of present){
    const kind=resource.kind as ResidentCropKind,id=resource.id;
    if(!this.kinds.has(id)){
     const order=this.order[kind];let low=0,high=order.length;
     while(low<high){const middle=(low+high)>>>1,ordinal=access.resourceSource(order[middle]!);if(ordinal===undefined)throw Error('Lost current crop source');if(ordinal<source)low=middle+1;else high=middle;}
     order.splice(low,0,id);this.kinds.set(id,kind);
    }
    const batch=this.batches[kind];batch.resources.push(resource);batch.appearances.push(appearance);
   }
  }
  if(this.kinds.size!==frame.cropCount)throw Error('Prepared crop population mismatch');
  this.tails={};for(const kind of RESIDENT_CROP_KINDS){const id=this.order[kind].at(-1);if(id!==undefined){const source=access.resourceSource(id),resource=source===undefined?undefined:world.resources[source];if(!resource||resource.id!==id||resource.kind!==kind)throw Error('Missing crop tail');this.tails[kind]=resource;}}
  this.previous=frame;this.previousWorld=world;return {changed:reset||affected===undefined||affected.length>0};
 }
}
