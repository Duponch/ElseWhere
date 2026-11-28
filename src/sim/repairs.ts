import {roadPropCanRepair256} from './local-road-prop-ownership-256.ts';
import {damagedStructures379,structureDamageChanged379} from './structure-family-379.ts';
import { isBarrier } from './barriers.ts';
import { isRepairableStructure } from './thing-damage-rules.ts';
import { constructionSpeed,learnSkill } from './skills.ts';
import { physicalWorkFactor } from './health-rules.ts';
import { releaseAssignments } from './work-release.ts';
import { advanceWork,setWorkUnits,WORK_FRACTIONS } from './work-progress.ts';
import type { BodyAssessment } from './body-capacities.ts';
import type { Job,Pawn,World,Structure } from './types.ts';
import { structureById,captureStructureNavigation } from './structure-navigation.ts';
import {sharesConstructionLayer} from './power-grid.ts';

export interface RepairTarget { structureId:number; warmed?:true }
function repairCellBusy382(world:World,s:Structure,busy:ReadonlySet<number>):boolean {
  if(!busy.has(s.z*world.width+s.x))return false;
  if(world.schemaVersion<382||s.kind!=='wall-lamp'&&!captureStructureNavigation(world).at(s).some(other=>other.kind==='wall-lamp'))return true;
  // A repair on the floor building must not hide a different attachment's
  // repair (or vice versa). Keep the previous cell guard elsewhere.
  return world.jobs.some(j=>j.x===s.x&&j.z===s.z&&sharesConstructionLayer(j.deconstruction?.kind??j.furniture?.kind??j.flick?.kind??j.fixBreakdown?.kind??(j.repair?structureById(world,j.repair.structureId)?.kind:undefined)??j.kind,s.kind,world.schemaVersion,j.orientation,s.orientation));
}
export function inHome(world:World,index:number):boolean {const a=world.home??[];let lo=0,hi=a.length;while(lo<hi){const mid=(lo+hi)>>>1;if(a[mid]!<index)lo=mid+1;else hi=mid;}return a[lo]===index;}
export function repairWanted(world:World,j:Job):boolean {
  const s=structureById(world,j.repair?.structureId);
  return !!s&&roadPropCanRepair256(world,s)&&!s.breakdown&&(world.schemaVersion>=87?isRepairableStructure(s):isBarrier(s))&&!!s.damage&&inHome(world,s.z*world.width+s.x)&&!world.jobs.some(other=>other.deconstruction?.structureId===s.id);
}
/** Sparse automatic intentions reuse construction priorities, reservations and
 * direct/queued orders. No scan per pawn, no terrain-sized work per tick. */
export function reconcileRepairs(world:World):void {
  if(!world.home?.length&&!world.jobs.some(j=>j.repair))return;
  const removed=new Set(world.jobs.filter(j=>j.repair&&!repairWanted(world,j)).map(j=>j.id));
  if(removed.size){
    for(const p of world.pawns){if(p.jobId!==null&&removed.has(p.jobId))releaseAssignments(world,p);p.orders.queue=p.orders.queue.filter(o=>typeof o!=='number'||!removed.has(o));}
    world.jobs=world.jobs.filter(j=>!removed.has(j.id));
  }
  // Same conjunction of pure tests, the rare one first: almost every structure
  // is undamaged, and only a damaged one needs the job-cell set.
  const repairable=world.schemaVersion>=87?isRepairableStructure:isBarrier;let busy:Set<number>|undefined;
  for(const s of damagedStructures379(world))if(s.damage&&roadPropCanRepair256(world,s)&&!s.breakdown&&repairable(s)&&inHome(world,s.z*world.width+s.x)&&!repairCellBusy382(world,s,busy??=new Set(world.jobs.map(j=>j.z*world.width+j.x)))&&Number.isSafeInteger(world.nextId+1)) {
    world.jobs.push({id:world.nextId++,kind:'repair',repair:{structureId:s.id},x:s.x,z:s.z,orientation:s.orientation,footprint:s.footprint,status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
  }
}
/** 80 Core work before the first HP, then 20, ConstructionSpeed x1.7.
 * Simulate ten Core substeps: at most one HP per Core tick, including extreme stats. */
export function advanceRepair(world:World,pawn:Pawn,job:Job,light:number,body:BodyAssessment|undefined):boolean {
  const s=structureById(world,job.repair?.structureId);if(!s?.damage||!roadPropCanRepair256(world,s))return true;
  pawn.path=[];pawn.state='working';
  for(let core=0;core<10;core++){
    advanceWork(job,1.7*light*constructionSpeed(pawn)*physicalWorkFactor(pawn,'build',body));
    const threshold=job.repair!.warmed?20:80;
    if(job.progress>=threshold){
      setWorkUnits(job,(job.progress-threshold)*WORK_FRACTIONS+(job.workRemainder??0));job.repair!.warmed=true;
      if(--s.damage===0){learnSkill(pawn.skills.construction,50*(core+1),pawn);delete s.damage;structureDamageChanged379(world,s);return true;}
    }
  }
  learnSkill(pawn.skills.construction,500,pawn);
  return false;
}
