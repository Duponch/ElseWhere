import {isPenoxycyline337} from './penoxycyline-337.ts';
import {cancelToxicVomit256} from './toxic-buildup-256.ts';
import { releaseFurniture } from './furniture-transfer.ts';
import { pawnBody } from './health-rules.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { commitDrop,releaseAssignments,releaseWork } from './work-release.ts';
import type { Pawn,World } from './types.ts';

/** A forced interruption cannot fail because a drop failed. Existing ownership
 * survives without preserving the task, destination, workstation or queue. */
export const hasTravellingCargo=(world:World,pawn:Pawn):boolean=>(pawn.motion?.end??0)>world.tick&&(world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)||world.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id));
export function interruptWork(world:World,pawn:Pawn,retainTravellingCargo=false):void {
  if(pawn.health)cancelToxicVomit256(pawn.health);
  clearQueuedOrders(world,pawn);delete pawn.priorityWork;
  // Destruction explicitly retains any in-flight cargo. Other callers keep
  // their existing explicit-meal/tree exceptions over a captured edge;265
  // also retains the real beer from an interrupted automatic drink.
  // Health can interrupt before the actor dispatcher has observed that edge;
  // its logical arrival cell is not yet a physical drop location.
  if((retainTravellingCargo||pawn.recreation.task?.activity==='read')&&hasTravellingCargo(world,pawn)||(pawn.need?.kind==='eat'&&(pawn.need.forced===true||world.schemaVersion>=265&&pawn.need.alcoholReason!==undefined||isPenoxycyline337(world.schemaVersion)&&pawn.need.drugReason337!==undefined)||world.jobs.some(j=>j.id===pawn.jobId&&j.tree))&&(pawn.motion?.end??0)>world.tick
    &&world.piles.some(p=>(p.kind==='food'||p.kind==='plant'||world.schemaVersion>=265&&p.kind==='beer'||isPenoxycyline337(world.schemaVersion)&&p.kind==='drug'||world.jobs.some(j=>j.id===pawn.jobId&&j.tree))&&p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)){
    releaseAssignments(world,pawn);pawn.interruptedCargo=true;pawn.planCooldown=0;return;
  }
  if(releaseWork(world,pawn))return;
  releaseAssignments(world,pawn);
  pawn.interruptedCargo=true;
  pawn.planCooldown=1+pawn.id%20;
}

/** Bounded retry using existing drop rules. Does not cancel sleep or grant work.
 * No per-frame work; ordinary actors never enter this path. */
export function retryInterruptedCargo(world:World,pawn:Pawn):void {
  if(!pawn.interruptedCargo||pawn.planCooldown>0)return;
  const held=world.piles.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
  const pack=world.packed.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
  if(!held&&!pack){delete pawn.interruptedCargo;return;}
  if((pawn.motion?.end??0)>world.tick)return;
  pawn.planCooldown=20;
  if(pack?!releaseFurniture(world,pawn):held&&!commitDrop(world,held,pawn))return;
  delete pawn.interruptedCargo;
  pawn.planCooldown=0;
}

/** Shape validation precedes this ownership check. Sleeping remains the only
 * concurrent task. V235 exact cancellation can retain previously accepted
 * foreign queued work until the cargo is dropped; its ordinary queue validator
 * still checks reservations, identities and bounds before adoption. */
export function validateInterruptedCargo(world:World):string[] {
  const errors:string[]=[];
  for(const pawn of world.pawns)if(pawn.interruptedCargo) {
    const burning=world.schemaVersion>=87&&!!pawn.burning;
    const tactical=burning||world.schemaVersion>=193&&!!pawn.bombRefuge||world.schemaVersion>=65&&!!pawn.mental?.crisis||world.schemaVersion>=53&&!!pawn.draft||world.schemaVersion>=58&&!!pawn.flee
      ||world.schemaVersion>=125&&pawn.melee?.order?.auto==='social'||world.schemaVersion>=192&&pawn.melee?.order?.auto==='retaliation';
    const owners=world.piles.filter(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id).length
      +world.packed.filter(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id).length;
    if(owners!==1||pawn.jobId!==null||pawn.animalHandling||pawn.animalCare||pawn.animalFeed||pawn.animalRescue||pawn.ward||pawn.feed||pawn.tend||pawn.surgery||pawn.rescue||pawn.haul||pawn.cooking||pawn.recreation.task||pawn.orders.active!==null||pawn.orders.queue.length&&world.schemaVersion<235||pawn.priorityWork
      ||pawn.path.length&&!tactical||pawn.moveCooldown>0&&world.schemaVersion<53&&!tactical&&!(world.schemaVersion>=45&&(pawn.state==='downed'||pawn.state==='dead'||pawnBody(pawn).capacities.manipulation===0))||pawn.transitExit&&!tactical||pawn.need&&(pawn.need.kind!=='sleep'||pawn.need.phase!=='sleep')||!['sleeping','idle','hungry',...(tactical?['moving']:[]),...(burning?['working']:[]),...(world.schemaVersion>=45?['downed','dead']:[])].includes(pawn.state))errors.push('Invalid interrupted cargo ownership or task.');
  }
  return errors;
}
