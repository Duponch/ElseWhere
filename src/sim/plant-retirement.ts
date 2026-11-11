import {footprintCells} from './definitions.ts';
import {constructionFinalWipesPlants,constructionFrameWipesPlants,isConstructionLightPlant,lightPlantKeyIn} from './construction-plants.ts';
import {planSelectedDrops,releaseWork,type DropPlan} from './work-release.ts';
import {refreshStock} from './materials.ts';
import type {Job,Resource,Structure,World} from './types.ts';

/** Ephemeral synchronous transaction; never serialized or retained by a cache. */
export interface PlantRetirementPlan {
  readonly target:Job|Structure;
  readonly producerJobId:number|undefined;
  readonly stage:'frame'|'final';
  readonly tick:number;
  readonly plants:readonly Resource[];
  readonly obsoleteJobs:ReadonlySet<number>;
  readonly clearedJobs:ReadonlySet<number>;
  readonly actors:ReadonlySet<number>;
  readonly drops:DropPlan;
  readonly signature:string;
}
const manualPlant=(j:Job)=>j.flowerPotId===undefined&&['cut','chop','harvest','extract-tree'].includes(j.kind);
const dropsKey=(drops:ReadonlyMap<number,{x:number;z:number}>)=>JSON.stringify([...drops].map(([id,c])=>[id,c.x,c.z]));

/** The physical Frame and the final entity have distinct planting policies.
 * No yield, draw, ID, elapsed work, task or owner mutation during preflight.
 * The producer's own Job and its already paid materials are deliberately kept. */
export function planConstructionPlantRetirement(world:World,target:Job|Structure,producerJobId?:number,stage:'frame'|'final'='final'):PlantRetirementPlan|null {
  if(!world.jobs.includes(target as Job)&&!world.structures.includes(target as Structure))return null;
  const kind='furniture' in target?target.furniture?.kind??target.kind:target.kind;
  const wipes=stage==='frame'?constructionFrameWipesPlants(kind):constructionFinalWipesPlants(kind);
  const cells=wipes?new Set(footprintCells(target).map(c=>c.z*world.width+c.x)):new Set<number>();
  // The light-plant index answers "none here" without scanning every resource.
  const plants=cells.size&&lightPlantKeyIn(world,cells)?world.resources.filter(r=>cells.has(r.z*world.width+r.x)&&isConstructionLightPlant(r)):[];
  const ids=new Set(plants.map(r=>r.id)),byCell=new Map(plants.map(r=>[r.z*world.width+r.x,r]));
  const obsolete=new Set<number>(),cleared=new Set<number>();
  if(ids.size)for(const job of world.jobs){
    if(job.id===producerJobId)continue;
    if(manualPlant(job)&&(job.tree?.resourceId!==undefined?ids.has(job.tree.resourceId):job.plantTarget?ids.has(job.plantTarget.resourceId):byCell.has(job.z*world.width+job.x)))obsolete.add(job.id);
    else if(job.clearance&&ids.has(job.clearance.resourceId))cleared.add(job.id);
  }
  const actors=new Set(world.pawns.filter(p=>p.jobId!==null&&(obsolete.has(p.jobId)||cleared.has(p.jobId))).map(p=>p.id));
  // A logical future arrival cannot become a drop cell. Refusal is before all
  // plant, queue, owner, material, stock, RNG or identity mutations.
  if(actors.size&&world.pawns.some(p=>actors.has(p.id)&&(p.motion?.end??0)>world.tick
    &&(world.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||world.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))))return null;
  const drops=planSelectedDrops(world,obsolete,actors);if(!drops)return null;
  const signature=JSON.stringify({target,plants,jobs:world.jobs.filter(j=>obsolete.has(j.id)||cleared.has(j.id)),
    actors:world.pawns.filter(p=>actors.has(p.id)).map(p=>({id:p.id,x:p.x,z:p.z,jobId:p.jobId,state:p.state,path:p.path,motion:p.motion,moveCooldown:p.moveCooldown,
      held:world.piles.filter(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id),packed:world.packed.filter(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)}))});
  return {target,producerJobId,stage,tick:world.tick,plants,obsoleteJobs:obsolete,clearedJobs:cleared,actors,drops,signature};
}

/** Called after the caller's final placement/material/ID preflight, immediately
 * before its successful Frame/floor/final-entity/install commit. No async gap.
 * The caller must explicitly choose Frame policy at physical material delivery.
 * Re-planning catches changed actor/cargo/drop reservations before a stale plan
 * can retire anything. Common no-claims/no-plants paths allocate no pile shadow. */
export function commitConstructionPlantRetirement(world:World,plan:PlantRetirementPlan):boolean {
  if(world.tick!==plan.tick||!world.jobs.includes(plan.target as Job)&&!world.structures.includes(plan.target as Structure)||plan.plants.some(r=>!world.resources.includes(r)))return false;
  const live=planConstructionPlantRetirement(world,plan.target,plan.producerJobId,plan.stage);
  if(!live||live.signature!==plan.signature||dropsKey(live.drops)!==dropsKey(plan.drops))return false;
  if(!plan.plants.length)return true;
  for(const pawn of world.pawns)if(plan.actors.has(pawn.id)&&!releaseWork(world,pawn,plan.drops))throw Error('Preflighted plant retirement lost its physical cargo drop.');
  for(const pawn of world.pawns)pawn.orders.queue=pawn.orders.queue.filter(order=>typeof order!=='number'||!plan.obsoleteJobs.has(order)&&!plan.clearedJobs.has(order));
  if(plan.obsoleteJobs.size)world.jobs=world.jobs.filter(j=>!plan.obsoleteJobs.has(j.id));
  for(const job of world.jobs)if(plan.clearedJobs.has(job.id)){
    delete job.clearance;delete job.installationWork;job.reservedBy=null;job.status='pending';
  }
  if(plan.plants.length){
    const ids=new Set(plan.plants.map(r=>r.id));world.resources=world.resources.filter(r=>!ids.has(r.id));
    for(const animal of world.wildlife?.animals??[])if(animal.meal?.kind==='plant'&&ids.has(animal.meal.id)){
      delete animal.meal;animal.path=[];animal.nextDecision=world.tick;
    }
  }
  if(plan.actors.size)refreshStock(world);return true;
}

/** A failed output preflight is not a voluntary task release. Keep the exact
 * reserved claimant, source and bounded saved work; the dispatcher must not
 * call releaseWork/wake/recreate this clearance on that branch.
 * Saved work remains 0.0001 local unit below completion. The caller skips
 * advancement and plant XP at this exact boundary, even on retry wake-up.
 * A naturally saved fraction at the same boundary is finalized prospectively;
 * at most0.0001 local work unit separates it from the paid-output sentinel. */
export function retainWorkAfterOutputRefusal(work:Pick<Job,'progress'|'workRemainder'>|undefined,duration:number):boolean {
  if(!work||!Number.isSafeInteger(duration)||duration<1)return false;
  work.progress=duration-1;work.workRemainder=9999;return true;
}
export function retainClearingWorkAfterOutputRefusal(job:Job,duration:number):boolean {
  return retainWorkAfterOutputRefusal(job.clearance,duration);
}
