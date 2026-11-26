import { extractTreeDefinition } from '../sim/tree-transfer-rules';
import { isMinifiedTree } from '../sim/tree-transfer-state';
import { ARTIFICIAL_PARTS } from '../sim/artificial-parts-rules';
import { readProjectProgress, researchCost } from '../sim/research';
import { ANIMAL_FEED_TICKS } from '../sim/animal-feeding-rules';
import { BURIAL_TICKS } from '../sim/burial';
import { SURGERY_WORK } from '../sim/surgery-rules';
import { REFUEL_WORK_TICKS } from '../sim/fuel';
import { TURRET_RELOAD_WORK_TICKS } from '../sim/mini-turret-reload';
import { handlingStepDuration } from '../sim/animal-handling';
import { SLAUGHTER_WORK_TICKS } from '../sim/animal-slaughter';
import { isColonist } from '../sim/affiliation';
import { INGEST_TICKS } from '../sim/eating';
import { FEED_TICKS } from '../sim/feeding-rules';
import { FILTH_DEFINITIONS } from '../sim/filth-rules';
import { jobDuration } from '../sim/farming';
import { clearingDuration } from '../sim/gathering';
import { productionTaskTotal } from '../sim/production-recipes';
import { workProgress } from '../sim/work-progress';
import { rockMaxHP } from '../sim/mining-rules';
import { isConstruction } from '../sim/construction-rules';
import type { Cell, Job, Pawn, Resource, World } from '../sim/types';

export interface ActionProgress {
  kind: 'job'|'clearing'|'production'|'ingestion'|'feeding'|'tending'|'warden'|'cleaning'|'hunting'|'handling'|'burial'|'surgery'|'equipment'|'service'|'research';
  completed: number;
  total: number;
  fraction: number;
}

export interface ActionLookup {
  /** Closed phase presentation may share the authentic Full's unchanged
   * growing-zone derivation for sowing. Other job clocks keep the phase World. */
  sowingWorld?:World;
  /** Ephemeral snapshot indices. The large resource index is built only if a
   * colon is actually clearing a plant before construction. */
  jobs?:ReadonlyMap<number,Job>;
  resources?:ReadonlyMap<number,Resource>;
  resourceCells?:ReadonlyMap<number,Resource>;
  /** Presentation memory of the filth thickness when a colonist began
   * cleaning it (Core JobDriver_CleanFilth's totalCleaningWorkRequired). */
  cleaningStart?:Map<number,{filthId:number;thickness:number}>;
}

const measured=(kind:ActionProgress['kind'],completed:number,total:number):ActionProgress|undefined=>
  Number.isFinite(completed)&&Number.isFinite(total)&&total>0
    ?{kind,completed,total,fraction:Math.max(0,Math.min(1,completed/total))}:undefined;

/** Only work with a persisted counter and a known completion threshold gets a
 * bar. Research reports the global project's points. Waiting, travel, sleep,
 * recreation and hauling acquire no synthetic timer. Confirmed snapshots only. */
export function actionProgress(world:World,pawn:Pawn,lookup?:ActionLookup):ActionProgress|undefined {
  if(!isColonist(pawn))return undefined;
  if(pawn.state==='eating'&&pawn.need?.kind==='eat'&&pawn.need.phase==='ingest')
    return measured('ingestion',workProgress(pawn.need),INGEST_TICKS);
  if(pawn.state!=='working')return undefined;
  if(pawn.research&&world.research?.project){
    const progress=readProjectProgress(world.research,world.research.project);
    return measured('research',progress?.points??0,researchCost(world.research.project));
  }
  if(pawn.surgery?.phase==='work')return measured('surgery',pawn.surgery.progress,pawn.surgery.implant ? ARTIFICIAL_PARTS[pawn.surgery.implant].work : pawn.surgery.removeArtificial273 ? 2000 : SURGERY_WORK);
  if(pawn.burial?.phase==='bury')return measured('burial',pawn.burial.progress,BURIAL_TICKS);
  if(pawn.animalFeed?.phase==='feed')return measured('feeding',pawn.animalFeed.progress,ANIMAL_FEED_TICKS);
  if(pawn.equipmentTask){
    const task=pawn.equipmentTask;
    if(task.action==='wear'||task.action==='remove')return measured('equipment',task.progress,task.duration!);
    if(task.action==='drop')return measured('equipment',task.progress,3);
  }
  if(pawn.haul?.phase==='deliver'&&pawn.haul.serviceProgress!==undefined){
    if(pawn.haul.destination.type==='fuel')return measured('service',pawn.haul.serviceProgress,REFUEL_WORK_TICKS);
    if(pawn.haul.destination.type==='turret')return measured('service',pawn.haul.serviceProgress,TURRET_RELOAD_WORK_TICKS);
  }
  if(pawn.cooking?.phase==='work')return measured('production',pawn.cooking.progress,productionTaskTotal(world,pawn.cooking));
  if(pawn.feed?.phase==='feed')return measured('feeding',pawn.feed.progress,FEED_TICKS);
  if(pawn.cleaning?.phase==='clean'){
    if(pawn.cleaning.snowCell!==undefined)return measured('cleaning',pawn.cleaning.progress,50*(world.tiles[pawn.cleaning.snowCell]!.snowDepth??0));
    const filth=world.filth?.items.find(item=>item.id===pawn.cleaning!.targets[0]);
    if(filth){
      // Core: totalCleaningWorkDone / (cleaningWorkToReduceThickness x thickness
      // at the start), one bar for the whole filth, not one per thinned layer.
      const work=FILTH_DEFINITIONS[filth.kind].work,memory=lookup?.cleaningStart;
      let start=memory?.get(pawn.id);
      if(!start||start.filthId!==filth.id||start.thickness<filth.thickness){start={filthId:filth.id,thickness:filth.thickness};memory?.set(pawn.id,start);}
      return measured('cleaning',(start.thickness-filth.thickness)*work+pawn.cleaning.progress,start.thickness*work);
    }
  }
  if(pawn.animalHandling?.phase==='interact'){
    const task=pawn.animalHandling;
    // Core JobDriver_InteractAnimal (tame, train and its upkeep) and the rope
    // lead have no progress bar; Slaughter (WaitWith 180) and
    // GatherAnimalBodyResources (milk, shear) have one.
    if(task.kind==='tame'||task.kind==='train'||task.kind==='maintain'||task.kind==='lead')return undefined;
    return measured('handling',task.progress,task.kind==='slaughter'?SLAUGHTER_WORK_TICKS:handlingStepDuration(task));
  }
  if(pawn.animalCare?.phase==='treat'&&pawn.animalCare.duration!==undefined)return measured('tending',pawn.animalCare.progress,pawn.animalCare.duration);
  if(pawn.hunting?.phase==='finish')return measured('hunting',pawn.hunting.progress,18);
  if(pawn.tend?.phase==='tend'&&pawn.tend.duration!==undefined)
    return measured('tending',pawn.tend.progress,pawn.tend.duration);
  // Core JobDriver_ChatWithPrisoner has no progress bar.
  if(pawn.jobId!==null){
    if(lookup&&!lookup.jobs)lookup.jobs=new Map(world.jobs.map(job=>[job.id,job]));
    const candidate=lookup?.jobs?.get(pawn.jobId)??world.jobs.find(j=>j.id===pawn.jobId);
    const job=candidate?.status==='active'&&candidate.reservedBy===pawn.id?candidate:undefined;
    if(job){
      if(job.clearance){
        if(lookup&&!lookup.resources)lookup.resources=new Map(world.resources.map(resource=>[resource.id,resource]));
        const resource=lookup?.resources?.get(job.clearance.resourceId)??world.resources.find(r=>r.id===job.clearance!.resourceId);
        if(resource)return measured('clearing',workProgress(job.clearance),clearingDuration(resource));}
      if(job.tree?.kind==='extract') {
        const resource=lookup?.resources?.get(job.tree.resourceId)??world.resources.find(r=>r.id===job.tree!.resourceId);
        const definition=resource&&extractTreeDefinition(resource);
        return definition?measured('job',workProgress(job),definition.workCore):undefined;
      }
      if(job.tree?.kind==='replant') {
        const task=job.tree,pile=world.piles.find(p=>p.id===task.sourcePileId);
        if(task.phase!=='prepare'||task.durationCore===undefined||!pile||!isMinifiedTree(pile)||pile.innerResource.id!==task.resourceId||pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||task.carryPileId!==pile.id)return undefined;
        return measured('job',task.workCore,task.durationCore);
      }
      // Core JobDriver_Mine: 1 - HitPoints/MaxHitPoints of the rock, over the
      // whole rock, not one fill per pick stroke.
      if(job.kind==='mine'){const tile=world.tiles[job.z*world.width+job.x];return tile?.terrain==='rock'?measured('job',tile.miningDamage??0,rockMaxHP(tile)):undefined;}
      // Core JobDriver_ConstructFinishFrame has no bar: the frame draws its own
      // progress tiles. JobDriver_Repair and JobDriver_Flick have none either.
      if(isConstruction(job)||job.kind==='repair'||job.kind==='flick')return undefined;
      return measured('job',workProgress(job),jobDuration(job.kind==='sow'?lookup?.sowingWorld??world:world,job,lookup?.resourceCells ? lookup.resourceCells.get(job.z*world.width+job.x)??null : undefined));
    }
  }
  return undefined;
}

/** The current edge was removed from `path` when travel started. Keep its
 * confirmed destination before the untouched route; never search a new one. */
export function selectedConfirmedPath(world:World,pawn:Pawn):readonly Cell[] {
  if(!isColonist(pawn)||pawn.state!=='moving'||pawn.body?.lostAt!==undefined||pawn.body?.pileId!==undefined)return [];
  const route:Cell[]=[];
  if(pawn.motion&&pawn.motion.end>world.tick)route.push(pawn.motion.to);
  for(const cell of pawn.path)if(!route.length||route.at(-1)!.x!==cell.x||route.at(-1)!.z!==cell.z)route.push(cell);
  return route;
}
