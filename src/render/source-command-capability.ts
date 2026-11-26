import type {BufferGeometry,IndirectStorageBufferAttribute,Mesh} from 'three/webgpu';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';

const nativeIndirectGeometry=new WeakSet<BufferGeometry>();
/** A producer with per-pass indirect state retains native command preparation
 * for this geometry's entire lifetime, including full-visible direct passes. */
export function markNativeIndirectGeometry(geometry:BufferGeometry):void{nativeIndirectGeometry.add(geometry);}
export function allowsDirectSourceCommands(geometry:BufferGeometry):boolean{return geometry.indirect===null&&!nativeIndirectGeometry.has(geometry);}

/** A retained bundle encodes a particular indirect buffer and byte-offset
 * sequence. The immutable table's actual spatial producer, not a graph or GPU
 * handle census, is the only owner allowed to declare that sequence. */
export interface SourceCommandDrawState435 {readonly indirect:IndirectStorageBufferAttribute|null;readonly offsets?:readonly number[]}
const directDraw435:SourceCommandDrawState435=Object.freeze({indirect:null});
export interface OwnedSpatialCommand435 {
 readonly mesh:Mesh;
 readonly producer:OwnedOpaqueProducer435;
 readonly before:Mesh['onBeforeRender'];readonly shadow:Mesh['onBeforeShadow'];readonly afterShadow:Mesh['onAfterShadow'];
 readonly originalBefore:Mesh['onBeforeRender'];readonly originalShadow:Mesh['onBeforeShadow'];readonly originalAfterShadow:Mesh['onAfterShadow'];
 read():SourceCommandDrawState435|undefined;
}
const spatialOwners435=new WeakMap<BufferGeometry,OwnedSpatialCommand435>();
export function publishOwnedSpatialCommands435(geometry:BufferGeometry,owner:OwnedSpatialCommand435):void{if(spatialOwners435.has(geometry))throw Error('Two spatial command producers for one geometry');markNativeIndirectGeometry(geometry);spatialOwners435.set(geometry,owner);}
export function retireOwnedSpatialCommands435(geometry:BufferGeometry,owner:OwnedSpatialCommand435):void{if(spatialOwners435.get(geometry)===owner)spatialOwners435.delete(geometry);}
export function ownedSpatialCommands435(mesh:Mesh,geometry:BufferGeometry):OwnedSpatialCommand435|undefined{
 const owner=spatialOwners435.get(geometry);
 return owner&&owner.mesh===mesh&&mesh.geometry===geometry&&mesh.onBeforeRender===owner.before&&mesh.onBeforeShadow===owner.shadow&&mesh.onAfterShadow===owner.afterShadow?owner:undefined;
}
/** List admission precedes the actual native onBeforeRender selection. Only
 * this one immutable spatial owner may be admitted before its offsets exist. */
export function canPrepareSourceCommands435(mesh:Mesh,geometry:BufferGeometry):boolean{return allowsDirectSourceCommands(geometry)||!!ownedSpatialCommands435(mesh,geometry);}
export function selectedSourceDraw435(mesh:Mesh,geometry:BufferGeometry):SourceCommandDrawState435|undefined{
 if(allowsDirectSourceCommands(geometry))return directDraw435;
 return ownedSpatialCommands435(mesh,geometry)?.read();
}
export function sameSourceDraw435(before:SourceCommandDrawState435|undefined,after:SourceCommandDrawState435|undefined):boolean{
 if(!before||!after||before.indirect!==after.indirect)return false;
 const a=before.offsets,b=after.offsets;return a===b||!!a&&!!b&&a.length===b.length&&a.every((offset,i)=>offset===b[i]);
}
export const directOwnedSpatialDraw435=directDraw435;
