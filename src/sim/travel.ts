import { footprintCells } from './definitions.ts';
import { startTravel } from './movement.ts';
import { canStep, cellIndex, interactionGoals, routeToCell, routeToJob } from './pathfinding.ts';
import { PLAN_INTERVAL, search, type NavigationGrid, type SearchBudget } from './work-planner.ts';
import { releaseWork } from './work-release.ts';
import type { Cell, Job, Pawn, World } from './types.ts';
import type { LightReader } from './light-environment.ts';

/** Current actors are peaceful colonists: their bodies do not obstruct transit.
 * Furniture/job reservations govern use, not this graph. Combat must introduce
 * an explicit collision profile here before hostile actors become playable. */
export const CIVIL_TRANSIT_BLOCKERS: ReadonlySet<number> = new Set<number>();

export function moveToward(world: World, pawn: Pawn, target: Cell, allowTarget: boolean, getBlocked: NavigationGrid, budget: SearchBudget, exact = false, getLight?:LightReader): void {
  pawn.state = 'moving'; if (pawn.moveCooldown > 0) return;
  const blocked = getBlocked();
  let next = pawn.path[0];
  if (!next || !canStep(world,pawn,next,blocked,CIVIL_TRANSIT_BLOCKERS,budget.structureGeometry?.())) {
    if (pawn.planCooldown > 0) return;
    const cells = 'kind' in target ? footprintCells(target as Job) : [target];
    const goals = exact ? new Set([cellIndex(world,target.x,target.z)]) : interactionGoals(world,cells,'kind' in target?String(target.kind):undefined,budget.structureGeometry?.(),target);
    if (!exact && !allowTarget) for (const cell of cells) goals.delete(cellIndex(world,cell.x,cell.z));
    const reachable = search(world,pawn,blocked,CIVIL_TRANSIT_BLOCKERS,budget,goals); if (!reachable) return;
    const path = exact ? routeToCell(world,target,reachable) : routeToJob(world,target,reachable,allowTarget);
    pawn.planCooldown = PLAN_INTERVAL;
    if (path === null) { releaseWork(world,pawn); return; }
    pawn.path = path; next = path[0];
  }
  if (next&&startTravel(world,pawn,next,getLight,budget.structureGeometry?.())) pawn.path.shift();
}
