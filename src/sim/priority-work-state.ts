import { stationWork,billWork,taskRecipe } from './production-recipes.ts';
import { isConstruction } from './construction-rules.ts';
import { isCookingOrder } from './order-types.ts';
import { haulingWork } from './work-types.ts';
import type { OrderCommand } from './player-orders.ts';
import type { QueuedOrder } from './order-types.ts';
import { TICKS_PER_DAY, type Cell, type Pawn, type World } from './types.ts';
import { structureById } from './structure-navigation.ts';

/** A cell and provider family, not a reservation or a radius of boosted jobs. */
export interface PriorityWork { cell:Cell; work:'build'|'haul'|'cook'|'craft'|'art'; startedAt:number }
export const PRIORITY_WORK_TICKS=TICKS_PER_DAY/2;

export function rememberPriorityWork(world:World,pawn:Pawn,command:OrderCommand,order?:QueuedOrder):void {
  let cell:Cell|undefined,work:PriorityWork['work']='build';
  if(command.type==='order-job') {
    const job=world.jobs.find(j=>j.id===command.jobId);if(job&&isConstruction(job)){cell=job;work=job.installationWork??'build';}
  } else if(command.type==='order-cook') {
    const station=structureById(world,command.structureId);cell=station;work=order&&isCookingOrder(order)?billWork({recipe:taskRecipe(order.cooking)}):order&&typeof order!=='number'&&!isCookingOrder(order)&&order.destination.type==='fuel'?haulingWork(order.destination) as PriorityWork['work']:station?stationWork(station):'cook';
  } else if(command.type==='order-haul'&&order&&typeof order!=='number'&&!isCookingOrder(order)) {
    const d=order.destination;
    if(d.type==='fuel'||d.type==='turret'){cell=structureById(world,d.structureId);work='haul';}
    else if(d.type==='job'||d.type==='aside'&&d.constructionId!==undefined) {
      cell=world.jobs.find(j=>j.id===(d.type==='job'?d.jobId:d.constructionId));work=d.forConstruction?'build':'haul';
    }
  }
  // The last sustaining command wins, including when queued. A one-shot order
  // does not replace that intent; explicit cancellation clears both.
  if(cell)pawn.priorityWork={cell:{x:cell.x,z:cell.z},work,startedAt:world.tick};
}
export function expirePriorityWork(world:World,pawn:Pawn):void {
  if(pawn.priorityWork&&world.tick-pawn.priorityWork.startedAt>=PRIORITY_WORK_TICKS)delete pawn.priorityWork;
}
export function validatePriorityWork(world:World,version:number):string[] {
  const errors:string[]=[];
  for(const pawn of world.pawns) {
    const p=pawn.priorityWork;if(p===undefined)continue;
    if(version<23){errors.push('Legacy save contains priority work.');continue;}
    if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['cell','work','startedAt'].includes(k))
      ||!['build','haul','cook',...(version>=32?['craft']:[]),...(version>=104?['art']:[])].includes(p.work)||!Number.isSafeInteger(p.startedAt)||p.startedAt<0||p.startedAt>world.tick||world.tick-p.startedAt>=PRIORITY_WORK_TICKS
      ||!p.cell||typeof p.cell!=='object'||Array.isArray(p.cell)||Object.keys(p.cell).some(k=>!['x','z'].includes(k))
      ||!Number.isInteger(p.cell.x)||p.cell.x<0||p.cell.x>=world.width||!Number.isInteger(p.cell.z)||p.cell.z<0||p.cell.z>=world.height)errors.push('Invalid priority work intent.');
    // The clicked object can disappear while an accepted job/queue finishes.
    // Absence of work is resolved at the next decision, never by inventing it.
  }
  return errors;
}
