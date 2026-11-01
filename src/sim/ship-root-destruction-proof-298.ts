import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isActualMapMutationContext298,registeredCampaign,registeredMapId} from './world-map-context.ts';
import type {CampaignState} from './world-map-state.ts';
import type {Structure,World} from './types.ts';

/** Private observation epoch, never a World/SAVE field or a launch permission. */
export interface ShipRootDestructionProof298 {readonly original:Structure}
interface Observation298 {
 proof:ShipRootDestructionProof298;owner:CampaignState;mapId:number;original:Structure;destroyed:boolean;
}
const observations=new WeakMap<object,Observation298>();
const watched=new WeakMap<Structure,Observation298>();
const currentByOwner=new WeakMap<object,Observation298>();
function state298(proof:unknown):Observation298|undefined {
 return proof!==null&&typeof proof==='object'?observations.get(proof):undefined;
}
/** Explicit cleanup for menu, accepted replacement, finish or fatal session exit. */
export function releaseShipRootDestruction298(proof:unknown):void {
 const state=state298(proof);if(!state)return;
 if(watched.get(state.original)===state)watched.delete(state.original);
 if(currentByOwner.get(state.owner)===state)currentByOwner.delete(state.owner);
 observations.delete(state.proof);
}
/** Caller has already accepted a normal ship-computer launch on its real owner. */
export function captureShipRootDestruction298(world:World,original:Structure,expectedOwner:CampaignState):ShipRootDestructionProof298 {
 if(!isSchema298OrLater(Number(world.schemaVersion))||original.kind!=='ship-computer'||!isActualMapMutationContext298(expectedOwner,world)||!world.structures.includes(original))throw Error('Capture requires the original installed computer and its actual local owner.');
 const mapId=registeredMapId(world);if(mapId===undefined)throw Error('The launch root has no actual map.');
 const old=currentByOwner.get(expectedOwner);if(old)releaseShipRootDestruction298(old.proof);
 const previous=watched.get(original);if(previous)releaseShipRootDestruction298(previous.proof);
 const proof=Object.freeze({original}),state:Observation298={proof,owner:expectedOwner,mapId,original,destroyed:false};
 observations.set(proof,state);watched.set(original,state);currentByOwner.set(expectedOwner,state);return proof;
}
/** Called only at the end of the two successful destructive commit paths. */
export function notifyShipRootDestruction298(world:World,original:Structure):void {
 if(original.kind!=='ship-computer')return;
 const state=watched.get(original);if(!state||currentByOwner.get(state.owner)!==state||registeredCampaign(world)!==state.owner||registeredMapId(world)!==state.mapId||!isActualMapMutationContext298(state.owner,world))return;
 state.destroyed=true;
}
/** Absence, packing, GC or a different original never establishes destruction. */
export function wasShipRootDestroyed298(expectedOwner:CampaignState,proof:unknown):boolean {
 const state=state298(proof);
 return !!state&&watched.get(state.original)===state&&currentByOwner.get(state.owner)===state&&expectedOwner===state.owner&&state.destroyed;
}
