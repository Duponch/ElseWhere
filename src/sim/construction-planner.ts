import {materialAllowedForPlayer256} from './material-permission-256.ts';
import { workPriority } from './work-types.ts';
import {plantExecutionReserved} from './construction-plants.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { planFurnitureTransport } from './furniture-haul-planner.ts';
import { constructionSkillRequired,constructionSupplied } from './construction-materials.ts';
import { furnitureReady, furnitureWorkTarget } from './furniture-rules.ts';
import { CARRY_CAPACITY } from './definitions.ts';
import { constructionSiteFree, constructionHaulPriority, asBuilder, isConstruction, type ConstructionObstruction } from './construction-rules.ts';
import { reservedSource } from './materials.ts';
import { findAsideDestination } from './haul-aside.ts';
import { canReach, type SearchBudget } from './work-planner.ts';
import type { Reachability } from './pathfinding.ts';
import type { Cell, HaulDestination, Job, Pawn, World } from './types.ts';

export interface ConstructionCandidate {
  priority:number; rank:number; distance:number; id:number; target:Cell;
  whole?:true; job?:Job; clearance?:{resourceId:number;progress:number};
  sourceId?:number; quantity?:number; destination?:HaulDestination;
}
/** One intent owns clearing and building. Hauling reserves the obstruction and
 * its destination quantitatively; a plant stays alive until real cutting ends. */
export function constructionCandidates(world:World,pawn:Pawn,blocked:Uint8Array,reach:Reachability,budget:SearchBudget,obstacles:ReadonlyMap<number,ConstructionObstruction>,jobs:readonly Job[]=world.jobs):ConstructionCandidate[] {
  const result:ConstructionCandidate[]=[];
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  if(!Number.isFinite(constructionHaulPriority(pawn)))return result;
  for(const job of jobs) {
    if(!allows(job)||!isConstruction(job)||job.reservedBy!==null)continue;
    const obstacle=obstacles.get(job.id)!;const {plant,pile}=obstacle;
    const base={id:job.id,rank:1,distance:Math.abs(job.x-pawn.x)+Math.abs(job.z-pawn.z)};
    if(plant) {
      if(world.schemaVersion>=235&&plantExecutionReserved(world,plant.id,pawn.id))continue;
      if(world.jobs.some(j=>j.tree?.kind==='extract'&&j.tree.resourceId===plant.id))continue;
      const target={x:plant.x,z:plant.z};
      if(allows(target)&&(workPriority(pawn,'build')>0||job.kind==='install'&&workPriority(pawn,'haul')>0)&&plant.kind!=='rock'&&canReach(world,target,reach,false))result.push({...base,priority:job.kind==='install'?constructionHaulPriority(pawn):workPriority(pawn,'build'),target,job,clearance:{resourceId:plant.id,progress:0}});
    } else if(pile?.owner.type==='ground') {
      if(!materialAllowedForPlayer256(pile)||!allows(pile.owner)||reservedSource(world,pile.id)>0||!canReach(world,pile.owner,reach,true))continue;
      const quantity=Math.min(CARRY_CAPACITY,pile.quantity),destination=findAsideDestination(world,pile.owner,pile,quantity,blocked,budget,pawn);
      if(destination)result.push({...base,priority:constructionHaulPriority(pawn),target:pile.owner,sourceId:pile.id,quantity,destination:{...destination,constructionId:job.id,forConstruction:asBuilder(pawn)}});
    } else if(obstacle.pack) {
      const candidate=planFurnitureTransport(world,pawn,obstacle.pack,blocked,reach,budget,job);if(candidate)result.push(candidate);
    } else if(job.kind==='install'&&Number.isFinite(constructionHaulPriority(pawn))&&furnitureReady(world,job,pawn)&&allows(furnitureWorkTarget(world,job))&&canReach(world,job,reach,false)&&canReach(world,furnitureWorkTarget(world,job),reach,false)) {
      result.push({...base,priority:constructionHaulPriority(pawn),target:furnitureWorkTarget(world,job),job});
    } else if(job.construction==='frame'&&pawn.skills.construction.level>=(job.kind==='lay-floor'&&job.floor?FLOOR_DEFINITIONS[job.floor].skill:constructionSkillRequired(job.kind,world.schemaVersion))&&workPriority(pawn,'build')>0&&constructionSupplied(world,job)&&constructionSiteFree(world,job,pawn.id,obstacle)&&canReach(world,job,reach,false)) {
      result.push({...base,priority:workPriority(pawn,'build'),target:job,job});
    }
  }
  return result;
}
