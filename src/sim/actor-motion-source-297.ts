import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import type {TravelSegment} from './travel-timing.ts';

interface Source {readonly owner:object;readonly generation:number;readonly stamp:object}
const sources=new WeakMap<TravelSegment,Source>();
let generation=0;
/** Actual completed motion construction/in-place mutation only. Public engine
 * calls cannot enroll a source; commands and speculative transactions retire
 * all earlier stamps before they can reach another publication. */
export function markActorMotionSource297(motion:TravelSegment|null|undefined):void {
 if(!motion)return;
 const owner=terrainJournalReadOwner();
 if(owner)sources.set(motion,{owner,generation,stamp:{}});else sources.delete(motion);
}
export function invalidateActorMotionSources297():void {generation++;}
/** Internal fixed publisher read. A stamp only certifies that this exact
 * source was written by its closed owner; it contains no copied value. */
export function actorMotionSourceStamp297(motion:TravelSegment,owner:object):object|undefined {
 const source=sources.get(motion);return source?.owner===owner&&source.generation===generation?source.stamp:undefined;
}
