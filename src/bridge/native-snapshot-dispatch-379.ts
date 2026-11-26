import type {World} from '../sim/types';
import type {SnapshotAdoption,SnapshotMessage} from './snapshots';
import type {PawnTrack} from './motion-tracks';

/** Opaque fixed ingress receipt. This interface carries only the existing
 * control scalars and operations, never an unpublished raw World/sidecar. */
export interface NativeSnapshotDispatch379 {
 readonly epoch:number;readonly revision:number;readonly stepMs:number;readonly speed:number;
 readonly urgentThreats:SnapshotMessage<true>['urgentThreats'];readonly audioCues:SnapshotMessage<true>['audioCues'];
 acceptsUrgent(accept:(meta:unknown,tick:unknown,speed:unknown,maxTiles?:number)=>boolean):boolean;
 adopt(accept:(world:World)=>boolean):SnapshotAdoption;
 motion():PawnTrack[]|undefined;
 coreInput():object|undefined;
}
