import {orderedTargets378} from './order-types.ts';
import type {Job,World} from './types.ts';

/** One synchronous candidate scan, never a retained world cache. Empty tails
 * allocate no sets; the ordinary no-tail path only visits the pawn records. */
export interface OrderedWorkClaims378 {jobs?:ReadonlySet<number>;structures?:ReadonlySet<number>}
const EMPTY:Readonly<OrderedWorkClaims378>=Object.freeze({});
export function captureOrderedWorkClaims378(world:World,exceptPawnId?:number):OrderedWorkClaims378 {
  if(Number(world.schemaVersion)<378)return EMPTY;
  let jobs:Set<number>|undefined,structures:Set<number>|undefined;
  for(const pawn of world.pawns)if(pawn.id!==exceptPawnId)for(const order of pawn.orderedQueue378??[]){
    for(const target of orderedTargets378(order)){
      if(target.kind==='job')(jobs??=new Set()).add(target.id);
      if(target.kind==='structure')(structures??=new Set()).add(target.id);
    }
  }
  return jobs||structures?{jobs,structures}:EMPTY;
}
/** A job may work on a still physical structure rather than its own cell. */
export function orderedJobClaimed378(claims:OrderedWorkClaims378,job:Job):boolean {
  if(claims.jobs?.has(job.id))return true;
  const id=job.deconstruction?.structureId??job.furniture?.structureId??job.repair?.structureId
    ??job.fixBreakdown?.structureId??job.flick?.structureId??job.flowerPotId;
  return id!==undefined&&!!claims.structures?.has(id);
}
