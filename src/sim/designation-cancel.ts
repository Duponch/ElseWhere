import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import { constructionHaulId } from './construction-rules.ts';
import { footprintCells } from './definitions.ts';
import { refreshStock } from './materials.ts';
import { isHaulOrder } from './order-types.ts';
import { isPlant } from './plants.ts';
import { isRoofJob } from './roof-rules.ts';
import { designateRoofArea } from './roofing.ts';
import { commitDrop, planSelectedDrops, releaseAssignments,releaseWork } from './work-release.ts';
import type { Command, CommandResult, Job, World } from './types.ts';

const fail=(reason:string,code:CommandResult['code']='invalid-command'):CommandResult=>({ok:false,code,reason});
const same=(a:{x:number;z:number},b:{x:number;z:number})=>a.x===b.x&&a.z===b.z;
const maintenance=(job:Job)=>job.kind==='repair'||job.kind==='fix-breakdown';
const actorFor=(pawn:World['pawns'][number],ids:ReadonlySet<number>)=>pawn.jobId!==null&&ids.has(pawn.jobId)
  ||!!pawn.haul&&ids.has(constructionHaulId(pawn.haul.destination)??-1);
function report(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'command',message});if(world.events.length>80)world.events.shift();
  for(const pawn of world.pawns)pawn.planCooldown=0;refreshStock(world);
}

/** One conservative physical transaction. A selected ID never resolves to the
 * first unrelated blueprint at the same coordinate. All refusals precede edits. */
export function cancelIntentJobs(world:World,ids:ReadonlySet<number>):CommandResult {
  if(!ids.size)return {ok:true};
  const jobs=world.jobs.filter(job=>ids.has(job.id)||job.wallDoor296?.plan&&ids.has(job.wallDoor296.plan.id));
  if([...ids].some(id=>!jobs.some(j=>j.id===id||j.wallDoor296?.plan?.id===id)))return fail('Un ordre sélectionné n’existe plus.','missing-target');
  if(jobs.some(maintenance))return fail('Retirez la zone de foyer pour suspendre cet entretien automatique.');
  const removeIds=new Set<number>(),releaseIds=new Set<number>(),queueIds=new Set<number>();
  const changes: {job:Job;manual:boolean;removePlan:boolean}[]=[];
  for(const job of jobs){
    const state=job.wallDoor296;
    if(!state){removeIds.add(job.id);releaseIds.add(job.id);queueIds.add(job.id);continue;}
    const removeManual=ids.has(job.id),removePlan=!!state.plan&&ids.has(state.plan.id);
    const manual=state.manual&&!removeManual,plan=!!state.plan&&!removePlan;
    const implicitActive=!!state.fromBlueprint&&world.pawns.some(p=>p.id===job.reservedBy&&p.jobId===job.id);
    changes.push({job,manual,removePlan});
    if(!manual&&!plan&&!implicitActive){removeIds.add(job.id);releaseIds.add(job.id);}
    if(removeManual&&!implicitActive)releaseIds.add(job.id);
    if(removeManual||removeIds.has(job.id))queueIds.add(job.id);
  }
  const actors=new Set(world.pawns.filter(p=>actorFor(p,releaseIds)).map(p=>p.id));
  const retained=new Set(world.pawns.filter(pawn=>actors.has(pawn.id)&&(pawn.motion?.end??0)>world.tick
    &&(world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)||world.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id))).map(p=>p.id));
  // Captured travel finishes with the original held object. The existing
  // interrupted-cargo producer will drop it at real contact, never ahead.
  const drops=planSelectedDrops(world,removeIds,new Set([...actors].filter(id=>!retained.has(id))));
  if(!drops)return fail('Pas de place pour restituer les matériaux du chantier ou la cargaison.','occupied');
  for(const {job,manual,removePlan} of changes){job.wallDoor296!.manual=manual;if(removePlan)delete job.wallDoor296!.plan;}
  const roofCells=jobs.filter(isRoofJob).map(j=>j.z*world.width+j.x);
  if(roofCells.length)designateRoofArea(world,roofCells,'ignore-roof');
  for(const pawn of world.pawns){
    const active=actorFor(pawn,releaseIds);
    if(active&&retained.has(pawn.id)){releaseAssignments(world,pawn);pawn.interruptedCargo=true;pawn.planCooldown=0;}
    else if(active&&!releaseWork(world,pawn,drops))throw Error('Preflighted cancellation has no physical cargo drop.');
    if(active&&pawn.priorityWork&&jobs.some(job=>footprintCells(job).some(cell=>same(cell,pawn.priorityWork!.cell))))delete pawn.priorityWork;
    pawn.orders.queue=pawn.orders.queue.filter(order=>typeof order==='number'?!queueIds.has(order)
      :!isHaulOrder(order)||!queueIds.has(constructionHaulId(order.destination)??-1));
  }
  for(const job of jobs)if(queueIds.has(job.id)&&job.reservedBy!==null&&!world.pawns.some(p=>p.id===job.reservedBy&&p.jobId===job.id)){job.reservedBy=null;job.status='pending';}
  for(const pile of world.piles)if(pile.owner.type==='job'&&removeIds.has(pile.owner.jobId)){
    const job=jobs.find(j=>pile.owner.type==='job'&&j.id===pile.owner.jobId)!;
    if(!commitDrop(world,pile,job,drops))throw Error('Preflighted cancellation has no material drop.');
  }
  world.jobs=world.jobs.filter(job=>!removeIds.has(job.id));
  report(world,'Ordre annulé ; les matériaux restent physiquement disponibles.');return {ok:true};
}

/** Permission is distinct from an explicit actor order or an already captured
 * delivery. No synthetic Job and no forced drop of an item in transit. */
export function clearPileHaulFlags(world:World,ids:ReadonlySet<number>):number {
  let removed=0;
  for(const pile of world.piles)if(ids.has(pile.id)&&pile.kind==='chunk'&&pile.haulRequested){
    delete markPileContentWrite379(pile).haulRequested;removed++;
    for(const pawn of world.pawns)if(pawn.haul?.sourcePileId===pile.id&&pawn.haul.phase==='pickup'&&pawn.orders.active!=='haul'){
      if(!releaseWork(world,pawn))throw Error('Empty automatic pickup could not release its designation.');
    }
  }
  return removed;
}
export function applyDesignationCancel(world:World,command:Command):CommandResult|undefined {
  if(!['cancel-job','cancel-resource','cancel-pile'].includes(command.type))return undefined;
  const key=command.type==='cancel-job'?'jobId':command.type==='cancel-resource'?'resourceId':'pileId';
  const value=(command as unknown as Record<string,unknown>)[key];
  if(Object.keys(command).length!==2||!Number.isSafeInteger(value)||Number(value)<1)return fail('Cible d’annulation invalide.');
  const id=Number(value);
  if(command.type==='cancel-job')return cancelIntentJobs(world,new Set([id]));
  if(command.type==='cancel-resource'){
    const resource=world.resources.find(r=>r.id===id);if(!resource||resource.kind!=='tree'&&!isPlant(resource))return fail('Cette plante n’existe plus.','missing-target');
    const jobs=world.jobs.filter(j=>j.tree?.kind==='extract'&&j.tree.resourceId===id
      ||['cut','chop','harvest'].includes(j.kind)&&same(j,resource));
    if(!jobs.length)return fail('Aucun ordre de plante à annuler.','missing-target');
    return cancelIntentJobs(world,new Set(jobs.map(j=>j.id)));
  }
  const pile=world.piles.find(p=>p.id===id);
  if(!pile||pile.kind!=='chunk'||!pile.haulRequested)return fail('Aucun ordre de transport à annuler sur cet objet.','missing-target');
  clearPileHaulFlags(world,new Set([id]));report(world,'Ordre de transport annulé.');return {ok:true};
}
