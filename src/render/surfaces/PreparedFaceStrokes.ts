/** One per-context owner of prepared stroke representations. Canonical model
 * records stay borrowed. No ordinary frame scans tables, copies rows or stages
 * settings. The shared presentation transaction publishes all coefficients. */
import type * as THREE from 'three/webgpu';
import type {GraphicsStylePreferences} from '../../ui3d/native-preferences';
import type {FaceStrokeData} from './FaceStrokeTable';
import {AffineAdmissionRefusal,AffineStrokeOwner,linearCanonicalStencil,normalizedStrokeSettings,type AffineStage,type StrokeSettings} from './AffineStrokeOwner';
import type {SharedSurfacePreparationRegistry,SharedSurfacePreparationSnapshot,SharedSurfacePreparationStage} from './SharedSurfacePreparation';

export interface PreparedStrokeDescriptor {
 readonly faceIds?:()=>readonly number[];
 readonly revision?:()=>string;
 readonly isLinear?:()=>boolean;
 /** Called only under initial admission/the shared draw hold, never because
  * Pastel/Gouache changes. Replaces the color Fn on the SAME material. */
 readonly onRepresentationChange?:()=>void;
}
interface Entry {
 readonly table:FaceStrokeData;readonly descriptor:PreparedStrokeDescriptor;
 owner:AffineStrokeOwner|undefined;mode:'prepared'|'source';full:boolean;
 readonly dirty:Set<number>;revision:number;stageBytes:number;refused?:string;
}
const consumers=new WeakMap<FaceStrokeData,Set<PreparedFaceStrokes>>();
/** Producer lifecycle/mutation notifications. They retain no models globally:
 * the key is weak, and each context unregisters its borrowed table explicitly. */
export function refreshPreparedFaceStrokes(table:FaceStrokeData,faces?:readonly number[]):void{for(const manager of consumers.get(table)??[])manager.refresh(table,faces);}
export function releasePreparedFaceStrokes(table:FaceStrokeData,geometries:Iterable<THREE.BufferGeometry>):void{const actual=[...new Set(geometries)];for(const manager of [...(consumers.get(table)??[])])manager.release(table,actual);}
export interface PreparedStrokeCanonical extends FaceStrokeData {preparedStrokeDescriptor?():PreparedStrokeDescriptor}
const settings=(preferences:Readonly<GraphicsStylePreferences>):StrokeSettings=>normalizedStrokeSettings({width:preferences.edgeWidth,irregularity:preferences.strokeImperfection});
const settingsKey=(value:StrokeSettings)=>JSON.stringify([value.width,value.irregularity]);
export type PreparedStrokeSettingsSnapshot=Pick<SharedSurfacePreparationSnapshot,'preferences'>;

export class PreparedFaceStrokes {
 private readonly entries=new Map<FaceStrokeData,Entry>();
 private readonly pendingRelease=new Set<Entry>();
 private readonly unregister:()=>void;
 private closed=false;private pending=false;private serial=0;private staged=false;
 private publishedSettings:string;
 readonly key='opaque-stroke-affines-v1';
 constructor(private readonly registry:SharedSurfacePreparationRegistry,private readonly preferences:()=>Readonly<GraphicsStylePreferences>,readonly limits={maxPreparedOwnedBytes:256*1024*1024,maxStageBytes:64*1024*1024}){
  this.publishedSettings=settingsKey(settings(preferences()));
  this.unregister=registry.register({key:this.key,needsPreparation:snapshot=>this.needsPreparation(snapshot),stage:(snapshot,assertCurrent)=>this.stage(snapshot,assertCurrent)});
 }
 private assertCurrent():void{if(this.closed)throw Error('Prepared face strokes retired');}
 /** Initial construction is synchronous and precedes the first graph/draw in
  * BOTH texture styles. A typed admission refusal chooses a Source graph in
  * JavaScript, without retaining it behind a fragment-uniform alternative. */
 acquire(table:FaceStrokeData,descriptor:PreparedStrokeDescriptor={}):AffineStrokeOwner|undefined{
  this.assertCurrent();const existing=this.entries.get(table);if(existing)return existing.mode==='prepared'?existing.owner:undefined;
  if(this.staged)throw Error('Do not admit a new stroke model into a staged surface batch');
  descriptor={...(table as PreparedStrokeCanonical).preparedStrokeDescriptor?.(),...descriptor};
  table.assertCurrent();let entry:Entry;const revision=descriptor.revision??(()=>String(table.buffer.id)),source=linearCanonicalStencil(table,{faceIds:descriptor.faceIds??(()=>Array.from({length:table.faceCount},(_,face)=>face)),revision,isLinear:descriptor.isLinear??(()=>true)});
  const headroom=this.limits.maxPreparedOwnedBytes-this.ownedBytes(),owner=headroom>=16?new AffineStrokeOwner(source,{maxBindingBytes:128*1024*1024,maxOwnedBytes:headroom,maxStageBytes:Math.min(32*1024*1024,this.limits.maxStageBytes)}):undefined;
  entry={table,descriptor,owner,mode:'prepared',full:false,dirty:new Set(),revision:0,stageBytes:0};
  let stage:AffineStage|undefined;
  try{if(!owner)throw new AffineAdmissionRefusal('No prepared storage reservation remains in this context');stage=owner.stageAll(settings(this.preferences()));if(this.stageQuota()+stage.stats.cpuBytes>this.limits.maxStageBytes)throw new AffineAdmissionRefusal('Prepared stroke settings-stage reservation exceeds context budget');stage.publish();stage.commit();entry.stageBytes=stage.stats.cpuBytes;}
  catch(error){if(!(error instanceof AffineAdmissionRefusal)){try{owner?.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Initial prepared stroke admission cleanup failed');}throw error;}entry.mode='source';entry.refused=error.message;stage?.dispose();stage=undefined;owner?.dispose();entry.owner=undefined;}
  finally{stage?.dispose();}
  this.entries.set(table,entry);let owners=consumers.get(table);if(!owners){owners=new Set();consumers.set(table,owners);}owners.add(this);this.serial++;this.registry.invalidate();return entry.mode==='prepared'?entry.owner:undefined;
 }
 /** Actual producer adoption/mining only. Queue dirty IDs; do not publish
  * while a settings/world transaction might still be preparing other owners. */
 refresh(table:FaceStrokeData,faces?:readonly number[]):void{
  this.assertCurrent();const entry=this.entries.get(table);if(!entry)return;
  if(faces!==undefined&&!faces.length)return;
  entry.revision++;if(faces===undefined){entry.full=true;entry.dirty.clear();}else if(!entry.full)for(const face of faces){if(!Number.isSafeInteger(face)||face<0)throw Error('Actual finite dirty face IDs required');entry.dirty.add(face);}
  this.pending=true;this.serial++;this.registry.invalidate();
 }
 private ownedBytes():number{let bytes=0;for(const entry of this.entries.values())bytes+=(entry.owner?.cpuBytes??0);for(const entry of this.pendingRelease)bytes+=(entry.owner?.cpuBytes??0);return bytes;}
 private stageQuota():number{let bytes=0;for(const entry of this.entries.values())if(entry.mode==='prepared')bytes+=entry.stageBytes;return bytes;}
 needsPreparation(snapshot:PreparedStrokeSettingsSnapshot):boolean{return!this.closed&&(this.pending||this.publishedSettings!==settingsKey(settings(snapshot.preferences)));}
 stage(snapshot:PreparedStrokeSettingsSnapshot,assertCurrent:()=>void):SharedSurfacePreparationStage{
  this.assertCurrent();if(this.staged)throw Error('Settle the existing global stroke stage first');assertCurrent();
  const target=settings(snapshot.preferences),targetKey=settingsKey(target),settingsChanged=targetKey!==this.publishedSettings,serial=this.serial,oldSettings=this.publishedSettings;
  const rows:{entry:Entry;stage?:AffineStage;before:Entry['mode'];next:Entry['mode'];refused?:string;revision:number}[]=[];let quota=this.stageQuota(),published=false,committed=false,disposed=false;
  try{
   for(const entry of this.entries.values()){
    // An immutable admission refusal remains an explicit Source graph. Its
    // Source settings uniforms already update normally; there is no hidden
    // kernel retry on every texture/settings switch.
    if(entry.mode==='source'&&!entry.full&&!entry.dirty.size)continue;
    if(!settingsChanged&&!entry.full&&!entry.dirty.size)continue;
    const row:{entry:Entry;stage?:AffineStage;before:Entry['mode'];next:Entry['mode'];refused?:string;revision:number}={entry,before:entry.mode,next:'prepared',revision:entry.revision};rows.push(row);
    try{
     // This limit includes every other live/retired prepared allocation.
     const headroom=this.limits.maxPreparedOwnedBytes-this.ownedBytes()+(entry.owner?.cpuBytes??0);if(headroom<16)throw new AffineAdmissionRefusal('No prepared context reservation remains');
     if(!entry.owner)entry.owner=new AffineStrokeOwner(linearCanonicalStencil(entry.table,{faceIds:entry.descriptor.faceIds??(()=>Array.from({length:entry.table.faceCount},(_,face)=>face)),revision:entry.descriptor.revision??(()=>String(entry.table.buffer.id)),isLinear:entry.descriptor.isLinear??(()=>true)}),{maxBindingBytes:128*1024*1024,maxOwnedBytes:headroom,maxStageBytes:Math.min(32*1024*1024,this.limits.maxStageBytes)});
     entry.owner.limits.maxOwnedBytes=headroom;
     row.stage=!settingsChanged&&!entry.full&&entry.mode==='prepared'?entry.owner.stageDirty([...entry.dirty]):entry.owner.stageAll(target);
     const reserved=row.stage.stats.kind==='full'?row.stage.stats.cpuBytes:entry.stageBytes;if(quota-entry.stageBytes+reserved>this.limits.maxStageBytes)throw new AffineAdmissionRefusal('Combined prepared stroke stage exceeds context budget');quota+=reserved-entry.stageBytes;
    }catch(error){if(!(error instanceof AffineAdmissionRefusal))throw error;row.stage?.dispose();row.stage=undefined;if(entry.mode==='prepared'&&!entry.descriptor.onRepresentationChange)throw new Error('Mutable prepared stroke producer requires an explicit JavaScript fallback publisher',{cause:error});row.next='source';row.refused=error.message;}
   }
   assertCurrent();
  }catch(error){const errors:unknown[]=[error];for(const row of rows.reverse())try{row.stage?.dispose();}catch(cleanup){errors.push(cleanup);}if(errors.length>1)throw new AggregateError(errors,'Global affine staging cleanup failed');throw error;}
  this.staged=true;
  const assertStage=()=>{this.assertCurrent();assertCurrent();if(disposed||committed||this.serial!==serial||rows.some(row=>row.entry.revision!==row.revision))throw Error('Prepared stroke stage superseded by an actual producer mutation');};
  const rollback=()=>{if(!published||committed)return;const errors:unknown[]=[];for(const row of [...rows].reverse()){try{row.stage?.rollback();}catch(error){errors.push(error);}if(row.entry.mode!==row.before){row.entry.mode=row.before;try{row.entry.descriptor.onRepresentationChange?.();}catch(error){errors.push(error);}}}this.publishedSettings=oldSettings;published=false;if(errors.length)throw new AggregateError(errors,'Global affine rollback failed');};
  return{publish:()=>{assertStage();if(published)throw Error('Prepared strokes already published');published=true;try{for(const row of rows){row.stage?.publish();const changed=row.entry.mode!==row.next;row.entry.mode=row.next;if(changed||row.next==='source')row.entry.descriptor.onRepresentationChange?.();}this.publishedSettings=targetKey;}catch(error){try{rollback();}catch(cleanup){throw new AggregateError([error,cleanup],'Global affine publication rollback failed');}throw error;}},commit:()=>{assertStage();if(!published)throw Error('Cannot commit unpublished prepared strokes');for(const row of rows)row.stage?.commit();committed=true;for(const row of rows){row.entry.full=false;row.entry.dirty.clear();row.entry.refused=row.refused;if(row.next==='source')row.entry.stageBytes=0;else if(row.stage?.stats.kind==='full')row.entry.stageBytes=row.stage.stats.cpuBytes;}this.pending=false;},rollback,dispose:()=>{if(disposed)return;const errors:unknown[]=[];try{rollback();}catch(error){errors.push(error);}for(const row of rows)try{row.stage?.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Global affine stage settlement failed');disposed=true;this.staged=false;}};
 }
 attachGpuRetirement(table:FaceStrokeData,geometries:Iterable<THREE.BufferGeometry>):void{this.assertCurrent();this.entries.get(table)?.owner?.attachGpuRetirement(geometries);}
 /** Terminal producer ownership only. Attach to actual initialized geometry
  * listeners before their final disposal; no fake draw/storage-free claim. */
 release(table:FaceStrokeData,geometries:Iterable<THREE.BufferGeometry>):void{
  this.assertCurrent();if(this.staged)throw Error('Settle shared surface preparation before retiring a producer');const entry=this.entries.get(table);if(!entry)return;
  entry.owner?.attachGpuRetirement(geometries);this.pendingRelease.add(entry);
  entry.owner?.dispose();this.pendingRelease.delete(entry);this.entries.delete(table);consumers.get(table)?.delete(this);this.serial++;this.registry.invalidate();
 }
 snapshot(){return{entries:this.entries.size,prepared:[...this.entries.values()].filter(entry=>entry.mode==='prepared').length,source:[...this.entries.values()].filter(entry=>entry.mode==='source').map(entry=>entry.refused??'explicit canonical representation'),ownedBytes:this.ownedBytes(),pending:this.pending,staged:this.staged,limits:{...this.limits},owners:[...this.entries.values()].map(entry=>entry.owner?.snapshot()??{ready:false,explicitSource:true})};}
 dispose():void{
  if(this.closed)return;if(this.staged)throw Error('Settle shared preparation before closing affine owners');const errors:unknown[]=[];
  for(const entry of new Set([...this.entries.values(),...this.pendingRelease]))try{entry.owner?.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Prepared stroke context cleanup failed');this.unregister();for(const table of this.entries.keys())consumers.get(table)?.delete(this);this.entries.clear();this.pendingRelease.clear();this.closed=true;
 }
}
