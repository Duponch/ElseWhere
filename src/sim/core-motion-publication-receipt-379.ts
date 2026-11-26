import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {effectiveCore297} from './core-phase-297.ts';
import type {World} from './types.ts';

/** Source-side observer receipts only. None of these maps changes gameplay,
 * the public Core result's shape, or a saved World. The actual fixed owner
 * may omit pure ongoing cooldown writes from motion history discovery. */
interface MovementReceipt {readonly owner:object;readonly world:World;readonly core:number;readonly candidates:readonly number[]}
const movementReceipts=new WeakMap<object,MovementReceipt>();
export function recordMovementMotionCandidates379(result:object,world:World,candidates:readonly number[]):void {
 const owner=terrainJournalReadOwner();if(owner)movementReceipts.set(result,{owner,world,core:effectiveCore297(world),candidates});
}
/** Actual engine transaction only: the next physical writers can turn any
 * of these actors back into a genuine motion candidate. */
export function takeMovementMotionCandidates379(result:object,world:World):readonly number[]|undefined {
 const held=movementReceipts.get(result);movementReceipts.delete(result);
 return held&&held.owner===terrainJournalReadOwner()&&held.world===world&&held.core===effectiveCore297(world)?held.candidates:undefined;
}

interface SelectionReceipt {readonly owner:object;readonly world:World;readonly core:number;readonly original:readonly number[];readonly length:number;readonly selected:readonly number[]}
const selections=new WeakMap<object,SelectionReceipt>();
export function recordPhysicalMotionSelection379(result:object,world:World,original:readonly number[],selected:readonly number[]):void {
 const owner=terrainJournalReadOwner();if(owner&&selected.length<original.length)selections.set(result,{owner,world,core:effectiveCore297(world),original,length:original.length,selected:Object.freeze(selected)});
}
/** The Engine adds its map header after every local owner has committed. The
 * same actorsChanged array and actual map/core carry this private receipt. */
export function forwardPhysicalMotionSelection379(source:object,target:object,world:World,original:readonly number[]):void {
 const held=selections.get(source);selections.delete(source);
 if(held&&held.owner===terrainJournalReadOwner()&&held.world===world&&held.core===effectiveCore297(world)&&held.original===original&&held.length===original.length)selections.set(target,held);
}
/** The fixed bridge consumes exactly this genuine Engine result once. Public
 * calls and any unknown owner/map/clock/collection edge remain exhaustive. */
export function takePhysicalMotionSelection379(result:object,world:World,owner:object,original:readonly number[]):readonly number[]|undefined {
 const held=selections.get(result);selections.delete(result);
 return held&&held.owner===owner&&held.world===world&&held.core===effectiveCore297(world)&&held.original===original&&held.length===original.length?held.selected:undefined;
}
