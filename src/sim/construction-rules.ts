import {shipComputerSensorsPlacementRefusal298} from './ship-computer-sensors-placement-298.ts';
import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {isShipCasketKind277} from './ship-casket-content-277.ts';
import {shipCasketPlacementRefusal277} from './ship-casket-placement-277.ts';
import {isShipPartKind276} from './ship-part-content-276.ts';
import {shipPartPlacementRefusal276} from './ship-reactor-placement-275.ts';
import {isRoofed} from './roof-rules.ts';
import {geothermalPlacementRefusal264} from './geothermal-placement-264.ts';
import {marshSupportsFootprint} from './marsh.ts';
import { workPriority } from './work-types.ts';
import { constructionPlantBlocks } from './construction-plants.ts';
import { furnitureWorkTarget } from './furniture-rules.ts';
import { clearsGroundItems } from './occupancy.ts';
import { footprintCells, STRUCTURE_DEFINITIONS } from './definitions.ts';
import type { Cell, HaulDestination, Job, MaterialPile, Pawn, Resource, World } from './types.ts';
import { serviceCell } from './service-reservations.ts';
import { spikeTrapPlacementAllowed } from './spike-trap-state.ts';
import { isShelfKind,shelfFixedAccepts } from './shelf-storage.ts';
import { structureById } from './structure-navigation.ts';

export const isConstruction = (job: Pick<Job,'kind'>): boolean => job.kind==='build-bridge'||job.kind==='install'||job.kind==='lay-floor'||job.kind in STRUCTURE_DEFINITIONS;
export const containsCell = (job: Job, cell: Cell): boolean => footprintCells(job).some(c=>c.x===cell.x&&c.z===cell.z);
/** Old saves are validated with the old solid-plan contract before migration. */
export const jobBlocksTransit = (world: World, job: Job): boolean => world.schemaVersion<16&&(job.kind==='wall'||job.kind==='table');
export const constructionWorkTarget = (world: World, job: Job): Cell => job.clearance ? world.resources.find(r=>r.id===job.clearance!.resourceId)??job : furnitureWorkTarget(world,job);
export const constructionHaulId = (destination: HaulDestination): number|undefined => destination.type==='job'?destination.jobId:destination.type==='aside'?destination.constructionId:undefined;
export const constructionHaulPriority = (pawn: Pawn): number => Math.min(workPriority(pawn,'build')||Infinity,workPriority(pawn,'haul')||Infinity);
export const asBuilder = (pawn: Pawn): boolean => workPriority(pawn,'build')>0&&workPriority(pawn,'build')<= (workPriority(pawn,'haul')||Infinity);

export interface ConstructionObstruction { plant?:Resource; pile?:MaterialPile; pack?:import('./furniture-rules.ts').PackedFurniture }
/** One synchronous planner decision. Keep array ordering for multi-cell sites,
 * and discard this index before any transfer, cutting or construction occurs.
 * Small plants are not blockers; their Frame/final destruction is committed
 * separately after the physical placement and custody preflight succeeds. */
export function constructionObstructions(world:World,candidates:readonly Job[]=world.jobs):ReadonlyMap<number,ConstructionObstruction> {
  const sites=new Map<number,number[]>(),result=new Map<number,ConstructionObstruction>(),clearItems=new Set<number>(),shelves=new Set<number>();
  for(const job of candidates)if(isConstruction(job)) {
    result.set(job.id,{});if(clearsGroundItems(world,job.furniture?.kind??job.kind))clearItems.add(job.id);
    if(isShelfKind(job.furniture?.kind??job.kind))shelves.add(job.id);
    for(const c of footprintCells(job)) {
      const cell=c.z*world.width+c.x,ids=sites.get(cell)??[];
      ids.push(job.id);sites.set(cell,ids);
    }
  }
  if(!sites.size)return result;
  for(const resource of world.resources)for(const id of sites.get(resource.z*world.width+resource.x)??[])if(constructionPlantBlocks(world.jobs.find(j=>j.id===id)!,resource))result.get(id)!.plant??=resource;
  for(const pile of world.piles)if(pile.owner.type==='ground')for(const id of sites.get(pile.owner.z*world.width+pile.owner.x)??[])if(clearItems.has(id)&&(!shelves.has(id)||!shelfFixedAccepts(pile)))result.get(id)!.pile??=pile;
  for(const pack of world.packed??[])if(pack.owner.type==='ground')for(const id of sites.get(pack.owner.z*world.width+pack.owner.x)??[])if(clearItems.has(id)&&world.jobs.find(j=>j.id===id)?.furniture?.structureId!==pack.building.id)result.get(id)!.pack??=pack;
  return result;
}
export function constructionObstruction(world: World, job: Job):ConstructionObstruction {
  const cells=new Set(footprintCells(job).map(c=>c.z*world.width+c.x));
  const plant=world.resources.find(r=>cells.has(r.z*world.width+r.x)&&constructionPlantBlocks(job,r));
  const kind=job.furniture?.kind??job.kind;
  const pile=clearsGroundItems(world,kind)?world.piles.find(p=>p.owner.type==='ground'&&cells.has(p.owner.z*world.width+p.owner.x)&&(!isShelfKind(kind)||!shelfFixedAccepts(p))):undefined;
  const pack=(job.kind==='sow'||clearsGroundItems(world,job.furniture?.kind??job.kind))?world.packed?.find(p=>p.owner.type==='ground'&&cells.has(p.owner.z*world.width+p.owner.x)&&p.building.id!==job.furniture?.structureId):undefined;
  return {plant,pile,pack};
}
/** A frame is traversable. Completion must not materialize a building across
 * a person, an active edge (including its diagonal corner), or a service. */
export function constructionSiteFree(world: World, job: Job, workerId?: number, obstacle=constructionObstruction(world,job)): boolean {
  if(isShipCasketKind277(job.kind)&&shipCasketPlacementRefusal277(world,{...job,kind:job.kind},job.id))return false;
  if(isShipComputerSensorsKind298(job.kind)&&shipComputerSensorsPlacementRefusal298(world,{...job,kind:job.kind},job.id))return false;
  if(isShipPartKind276(job.kind)&&shipPartPlacementRefusal276(world,{...job,kind:job.kind},job.id))return false;
  if(job.kind==='geothermal-generator'&&geothermalPlacementRefusal264(world,job,job.id))return false;
  if(obstacle.plant||obstacle.pile||obstacle.pack||job.kind!=='build-bridge'&&!marshSupportsFootprint(world,footprintCells(job),job.kind==='install'?{kind:job.furniture?.kind??'install',material:world.packed.find(p=>p.building.id===job.furniture?.structureId)?.building.material??structureById(world,job.furniture?.structureId)?.material}:job))return false;
  if((job.furniture?.kind??job.kind)==='spike-trap'&&!spikeTrapPlacementAllowed(
    {...world,jobs:world.jobs.filter(j=>j!==job)},job,job.furniture?.structureId))return false;
  const cells=footprintCells(job);
  // A shelf may retain ordinary floor items, but cannot acquire an engaged
  // exclusive ingredient staging cell while its owner is away gathering.
  if(isShelfKind(job.furniture?.kind??job.kind)&&world.pawns.some(p=>
    [...(p.cooking&&p.cooking.phase!=='interrupted'?p.cooking.ingredients:[]),...(p.surgery?.ingredients??[])]
      .some(i=>cells.some(c=>c.x===i.cell.x&&c.z===i.cell.z))))return false;
  if((job.furniture?.kind??job.kind)==='spike-trap'&&world.mechanoids?.some(a=>a.state!=='dead'&&cells.some(c=>{const m=a.motion;return a.x===c.x&&a.z===c.z||!!m&&m.end>world.tick&&c.x>=Math.min(m.from.x,m.to.x)&&c.x<=Math.max(m.from.x,m.to.x)&&c.z>=Math.min(m.from.z,m.to.z)&&c.z<=Math.max(m.from.z,m.to.z);})))return false;
  if(job.kind==='ground-scanner'&&cells.some(c=>isRoofed(world,c.z*world.width+c.x)))return false;
  if(world.wildlife?.animals.some(a=>cells.some(c=>{
    const m=a.motion;return a.x===c.x&&a.z===c.z||!!m&&m.end>world.tick&&c.x>=Math.min(m.from.x,m.to.x)&&c.x<=Math.max(m.from.x,m.to.x)&&c.z>=Math.min(m.from.z,m.to.z)&&c.z<=Math.max(m.from.z,m.to.z);
  })))return false;
  return !world.pawns.some(p=>p.id!==workerId&&!(p.state==='dead'&&(p.body?.pileId!==undefined||p.body?.lostAt!==undefined))&&cells.some(c=>{
    const edge=p.motion;
    const service=serviceCell(p,world);
    return p.x===c.x&&p.z===c.z || service?.x===c.x&&service.z===c.z || p.feed?.paste&&(p.feed.phase==='pickup'||p.feed.phase==='collect')&&p.feed.spot.x===c.x&&p.feed.spot.z===c.z || !!edge&&edge.end>world.tick&&c.x>=Math.min(edge.from.x,edge.to.x)&&c.x<=Math.max(edge.from.x,edge.to.x)&&c.z>=Math.min(edge.from.z,edge.to.z)&&c.z<=Math.max(edge.from.z,edge.to.z);
  }));
}
