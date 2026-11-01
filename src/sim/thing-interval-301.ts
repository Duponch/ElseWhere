/** Core1.6 Thing.DoTick/GenTicks contract. The owner supplies the persisted
 * tickDelta BEFORE this fixed tick. A Job/toil change must not reset it.
 * Camera/grid interpretation and mutation of the real pawn are caller duties.
 * Returning zero means retain previousDelta+1; otherwise reset it to zero and
 * call the one eligible interval action with the returned complete delta.
 * No allocation, World scan, RNG, work, admission or time is advanced here. */
export function thingHashOffset301(id:number):number {
 const value=id|0;
 return (value^(169495093+2654435769+(value<<6)+(value>>2)))|0;
}

export function dueThingIntervalDelta301(previousDelta:number,core:number,thingId:number,requestedRate:number):number {
 if(!Number.isSafeInteger(previousDelta)||previousDelta<0||previousDelta>14||!Number.isSafeInteger(core)||core<0||!Number.isSafeInteger(thingId)||thingId<1||!Number.isInteger(requestedRate))throw Error('Invalid actual Thing interval input');
 const rate=Math.min(15,Math.max(1,requestedRate)),delta=previousDelta+1;
 return delta>=rate||(((core|0)+thingHashOffset301(thingId))|0)%rate===0?delta:0;
}
