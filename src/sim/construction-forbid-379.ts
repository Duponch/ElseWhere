import {isConstruction} from './construction-rules.ts';
import {wallDoorBlueprint296} from './wall-door-state-296.ts';
import {releaseAssignments,releaseWork} from './work-release.ts';
import {hasTravellingCargo} from './interrupted-cargo.ts';
import {reconcileConstructionBatches379} from './construction-batch-379.ts';
import {isConstructionSchema379,type ConstructionForbidCommand379} from './construction-state-379.ts';
import type {CommandResult,Job,Pawn,World} from './types.ts';
export {constructionJobAllowed379,type ConstructionForbidCommand379} from './construction-state-379.ts';

/** Same selected ghost as the inspector/F action, including the door intent
 * nested beside a separate physical wall-deconstruction job. */
export function constructionForbidTarget379(w:World,id:number):Job|undefined {
 if(!isConstructionSchema379(Number(w.schemaVersion)))return;
 const direct=w.jobs.find(j=>j.id===id&&isConstruction(j));if(direct)return direct;
 const parent=w.jobs.find(j=>j.wallDoor296?.plan?.id===id);
 return parent?wallDoorBlueprint296(parent):undefined;
}
/** Interrupt the actual execution while preserving unrelated future orders.
 * In-flight cargo stays its original Pawn-owned Thing until the normal drop
 * retry reaches the committed physical edge. No delivered frame item moves. */
function stopExecution(w:World,p:Pawn):void {
 const job=w.jobs.find(j=>j.id===p.jobId),progress=job&&isConstruction(job)?{progress:job.progress,workRemainder:job.workRemainder}:undefined;
 if(hasTravellingCargo(w,p)){releaseAssignments(w,p);p.interruptedCargo=true;p.planCooldown=0;}
 else if(!releaseWork(w,p)){releaseAssignments(w,p);p.interruptedCargo=true;p.planCooldown=1+p.id%20;}
 delete p.priorityWork;
 if(job&&progress){job.progress=progress.progress;if(progress.workRemainder===undefined)delete job.workRemainder;else job.workRemainder=progress.workRemainder;}
}
/** A blocker may finish after the toggle. Retire the following construction
 * stage before its next work/delivery commit or a paused publication. */
export function reconcileForbiddenConstruction379(w:World):void {
 if(!isConstructionSchema379(Number(w.schemaVersion)))return;
 const forbidden=new Map(w.jobs.filter(j=>j.forbidden379&&isConstruction(j)).map(j=>[j.id,j]));if(!forbidden.size)return;
 for(const p of w.pawns){const job=p.jobId===null?undefined:forbidden.get(p.jobId);
  if(job&&!job.clearance||p.haul?.destination.type==='job'&&forbidden.has(p.haul.destination.jobId))stopExecution(w,p);
 }
}
export const stopForbiddenConstructionExecutions379=reconcileForbiddenConstruction379;
export function applyConstructionForbid379(w:World,c:ConstructionForbidCommand379):CommandResult {
 if(!c||typeof c!=='object'||Reflect.ownKeys(c).length!==3||Reflect.ownKeys(c).some(k=>typeof k!=='string'||!['type','jobId','forbidden'].includes(k)||Object.getOwnPropertyDescriptor(c,k)?.enumerable!==true||!Object.hasOwn(Object.getOwnPropertyDescriptor(c,k)!,'value'))||c.type!=='construction-forbid-379'||!Number.isSafeInteger(c.jobId)||typeof c.forbidden!=='boolean')return {ok:false,reason:'Réglage de construction invalide.'};
 const target=constructionForbidTarget379(w,c.jobId);if(!target)return {ok:false,reason:'Projet de construction indisponible.'};
 const job=w.jobs.find(j=>j.id===target.id),parent=job?undefined:w.jobs.find(j=>j.wallDoor296?.plan?.id===target.id),owner=job??parent!.wallDoor296!.plan!;
 if(c.forbidden===!!owner.forbidden379)return {ok:true};
 if(c.forbidden)owner.forbidden379=true;else delete owner.forbidden379;
 if(!c.forbidden)return {ok:true};
 reconcileConstructionBatches379(w);
 // A running CutPlant/Deconstruct blocker targets that physical Thing, not
 // the blueprint. Core allows it to finish before the forbidden next stage.
 reconcileForbiddenConstruction379(w);
 return {ok:true};
}
