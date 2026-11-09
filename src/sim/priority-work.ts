import { stationRecipe } from './production-recipes.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { deconstructionAvailable } from './deconstruction-rules.ts';
import { constructionCandidates } from './construction-planner.ts';
import { constructionObstruction, containsCell, isConstruction } from './construction-rules.ts';
import { footprintCells } from './definitions.ts';
import { turretReloadCapacity } from './mini-turret-reload.ts';
import { wantsFuel } from './fuel.ts';
import { isCookingOrder } from './order-types.ts';
import { routeToJob } from './pathfinding.ts';
import { planCookingOrder, startCookingOrder } from './player-cooking.ts';
import { planHaulOrder, startHaulOrder } from './player-hauling.ts';
import { startJobOrder } from './player-orders.ts';
import { expirePriorityWork } from './priority-work-state.ts';
import { searchCandidates, type NavigationGrid, type SearchBudget } from './work-planner.ts';
import type { Pawn, World } from './types.ts';

/** At most one bounded decision after accepted orders, before ordinary needs.
 * This intent reserves nothing until an executable job is selected. */
export function advancePriorityWork(world:World,pawn:Pawn,getBlocked:NavigationGrid,budget:SearchBudget):boolean {
  expirePriorityWork(world,pawn);
  const intent=pawn.priorityWork;
  if(intent&&backgroundWorkRefusal(pawn,intent.work)){delete pawn.priorityWork;return false;}
  if(!intent||pawn.orbitalTrade||pawn.deepWork||pawn.animalHandling||pawn.animalCare||pawn.animalFeed||pawn.animalRescue||pawn.hunting||pawn.jobId!==null||pawn.haul||pawn.cooking||pawn.need||pawn.recreation.task||pawn.orders.queue.length)return false;
  if(pawn.collapsePending||world.restRules==='legacy'&&pawn.rest===0)return false;
  const job=world.jobs.find(j=>(isConstruction(j)||intent.work==='build'&&j.kind==='deconstruct')&&containsCell(j,intent.cell));
  const station=world.structures.find(s=>(stationRecipe(s)!==null||s.kind==='torch-lamp'||s.kind==='passive-cooler'||s.kind==='mini-turret')&&footprintCells(s).some(c=>c.x===intent.cell.x&&c.z===intent.cell.z));
  if((intent.work==='cook'||intent.work==='craft'||intent.work==='smith'||intent.work==='tailor'||intent.work==='art')?!station:!job&&!(intent.work==='haul'&&station&&(wantsFuel(world,station)||station.kind==='mini-turret'&&turretReloadCapacity(world,station.id,pawn.id,true)>0))) {
    delete pawn.priorityWork;return false;
  }
  if(!budget.remaining||!budget.pairs)return true;
  const blocked=getBlocked(),reach=searchCandidates(world,pawn,blocked,new Set(),budget)!;
  // Assignment zero is not an incapacity: a previously accepted priority keeps
  // its provider family, even after the ordinary work table changes.
  const actor={...pawn,priorities:{...pawn.priorities,build:0,haul:0,cook:0,craft:0,art:0,[intent.work]:1}};
  if((intent.work==='cook'||intent.work==='craft'||intent.work==='smith'||intent.work==='tailor'||intent.work==='art')&&station) {
    const p=planCookingOrder(world,actor,station.id,reach,budget,false);
    if(p.order&&p.path) {
      if(isCookingOrder(p.order))startCookingOrder(pawn,p.order,p.path);
      else {if(p.order.destination.type==='fuel')p.order.destination.forced=true;startHaulOrder(pawn,p.order,p.path);}
      return false;
    }
  } else if(job?.kind==='deconstruct') {
    if(deconstructionAvailable(world,job,pawn.id)&&job.reservedBy===null) {
      const path=routeToJob(world,job,reach,false);if(path){startJobOrder(pawn,job,path);return false;}
    }
  } else if(job) {
    // Only the clicked footprint participates; no spatial-neighbour boost.
    const c=constructionCandidates(world,actor,blocked,reach,budget,new Map([[job.id,constructionObstruction(world,job)]]),[job])[0];
    if(c) {
      const path=routeToJob(world,c.target,reach,!c.job);
      if(path) {
        if(c.job){startJobOrder(pawn,job,path);if(job.kind==='install')job.installationWork=intent.work==='haul'?'haul':'build';if(c.clearance)job.clearance=c.clearance;}
        else startHaulOrder(pawn,{...(c.whole?{whole:true as const}:{}),sourcePileId:c.sourceId!,quantity:c.quantity!,destination:c.destination!,phase:'pickup',carryPileId:null},path);
        return false;
      }
    }
    const p=planHaulOrder(world,actor,{type:'job',jobId:job.id},reach,budget);
    if(p.task&&p.path){startHaulOrder(pawn,p.task,p.path);return false;}
  } else if(station&&(wantsFuel(world,station)||station.kind==='mini-turret'&&turretReloadCapacity(world,station.id,pawn.id,true)>0)) {
    const p=planHaulOrder(world,actor,{type:station.kind==='mini-turret'?'turret':'fuel',structureId:station.id},reach,budget);
    if(p.task&&p.path){startHaulOrder(pawn,p.task,p.path);return false;}
  }
  if(!budget.pairs)return true; // Defer, never mistake budget exhaustion for no job.
  delete pawn.priorityWork;return false;
}
