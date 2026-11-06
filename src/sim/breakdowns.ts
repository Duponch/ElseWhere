import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import { pawnBody } from './health-rules.ts';
import { inHome } from './repairs.ts';
import { commitDrop,planJobDrops,releaseAssignments,releaseWork } from './work-release.ts';
import { deliveredMaterial } from './construction-materials.ts';
import { footprintContains } from './definitions.ts';
import { learnSkill } from './skills.ts';
import type { BodyAssessment } from './body-capacities.ts';
import type { Job,Pawn,Structure,StructureKind,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

/** Core 1.6.4871: CompBreakdownable, as present on shipped buildings. */
const KINDS:ReadonlySet<StructureKind>=new Set(['electric-smithy','geothermal-generator','electric-crematorium','electric-smelter','biofuel-refinery','chemfuel-generator','nutrient-paste-dispenser','orbital-beacon','comms-console','ground-scanner','mini-turret','autodoor','wood-generator','wind-turbine','battery','solar-generator','electric-tailor-bench','machining-table','electric-stove','fabrication-bench','heater','cooler']);
/** Existing plants retain their historical eligibility. The geothermal trader
 * is verified on current Core: its actual PowerOn gates the failure check. */
const REQUIRES_POWER:ReadonlySet<StructureKind>=new Set(['electric-smithy','geothermal-generator','electric-crematorium','electric-smelter','biofuel-refinery','nutrient-paste-dispenser','orbital-beacon','comms-console','ground-scanner','mini-turret','autodoor','electric-tailor-bench','machining-table','electric-stove','fabrication-bench','heater','cooler']);
export const BREAKDOWN_CHECK_CORE_TICKS=1041;
export const BREAKDOWN_MTB_CORE_TICKS=13_680_000;
export const BREAKDOWN_FIX_TICKS=100;
export interface BreakdownState { brokenAt:number }
export interface BreakdownTarget { structureId:number; kind:StructureKind }
export interface BreakdownCalendar { rng:number; nextCheckCore:number }

export const breakdownEligible=(s:Pick<Structure,'kind'>):boolean=>KINDS.has(s.kind);
export const canBreakdownNow=(s:Structure):boolean=>breakdownEligible(s)&&!s.breakdown&&(!REQUIRES_POWER.has(s.kind)||s.power?.on===true&&s.power.switchOn!==false);
const nextRandom=(calendar:BreakdownCalendar):number=>{
  let n=calendar.rng;n^=n<<13;n^=n>>>17;n^=n<<5;
  calendar.rng=n>>>0;
  return calendar.rng/0x100000000;
};
export function newBreakdownCalendar(seed:number,tick:number):BreakdownCalendar {
  const rng=((seed>>>0)^0x7c5d278b)>>>0;
  const coreTick=tick*10;
  return {rng:rng||0x9e3779b9,nextCheckCore:(Math.floor(coreTick/BREAKDOWN_CHECK_CORE_TICKS)+1)*BREAKDOWN_CHECK_CORE_TICKS};
}

/** A deterministic diagnostic entry point. Natural failures use the separate
 * calendar below; neither path changes the established world.rng stream. */
export function triggerBreakdown(world:World,structureId:number):boolean {
  const s=structureById(world,structureId);
  if(!s||!breakdownEligible(s)||s.breakdown)return false;
  s.breakdown={brokenAt:world.tick};
  if(s.power)s.power.on=false;
  if(s.battery){s.battery.stored=0;delete s.battery.half;}
  reconcileBreakdownJobs(world);
  return true;
}

/** Called at confirmed ticks only. The fractional Core interval survives save
 * and resume without converting 1041 to a systematically shorter 104 ticks. */
export function advanceBreakdowns(world:World):void {
  const calendar=world.breakdown;
  if(!calendar)return;
  const end=world.tick*10;
  while(calendar.nextCheckCore<=end){
    // This cold path runs only every 1041 Core ticks. Stable IDs keep the
    // separate breakdown stream independent of array insertion order.
    const candidates=world.structures.filter(canBreakdownNow).sort((a,b)=>a.id-b.id);
    for(const s of candidates)if(nextRandom(calendar)<BREAKDOWN_CHECK_CORE_TICKS/BREAKDOWN_MTB_CORE_TICKS)triggerBreakdown(world,s.id);
    calendar.nextCheckCore+=BREAKDOWN_CHECK_CORE_TICKS;
  }
}

export function fixBreakdownWanted(world:World,job:Job):boolean {
  const s=structureById(world,job.fixBreakdown?.structureId);
  return !!s&&targetBuildingPlayerUse263(world,s)&&!!s.breakdown&&inHome(world,s.z*world.width+s.x)
    &&!world.fires?.items.some(f=>f.attachedAnimalId===undefined&&f.attachedPawnId===undefined&&footprintContains(s,f))
    &&!world.jobs.some(other=>other!==job&&(other.deconstruction?.structureId===s.id||other.furniture?.structureId===s.id));
}

/** Return a delivered component to the ground before retiring an intention.
 * If no legal ground location exists, keep the job and its ownership intact. */
export function retireBreakdownJob(world:World,job:Job):boolean {
  const drops=planJobDrops(world,job.id);
  if(!drops)return false;
  for(const pawn of world.pawns)if(pawn.haul?.destination.type==='job'&&pawn.haul.destination.jobId===job.id&&!releaseWork(world,pawn,drops))throw new Error('Preflighted breakdown cargo has no drop cell.');
  for(const pawn of world.pawns)if(pawn.jobId===job.id)releaseAssignments(world,pawn);
  for(const pile of world.piles)if(pile.owner.type==='job'&&pile.owner.jobId===job.id&&!commitDrop(world,pile,job,drops))throw new Error('Preflighted breakdown material has no drop cell.');
  world.jobs=world.jobs.filter(other=>other!==job);
  for(const pawn of world.pawns)pawn.orders.queue=pawn.orders.queue.filter(order=>order!==job.id);
  return true;
}

/** Sparse automatic intentions follow the Home area. Breakdown takes priority
 * over an existing HP repair; the two independent services never occupy one job. */
export function reconcileBreakdownJobs(world:World):void {
  if(!world.structures.some(s=>s.breakdown)&&!world.jobs.some(j=>j.fixBreakdown))return;
  for(const job of [...world.jobs])if(job.fixBreakdown&&!fixBreakdownWanted(world,job))retireBreakdownJob(world,job);
  for(const s of world.structures)if(s.breakdown&&targetBuildingPlayerUse263(world,s)&&inHome(world,s.z*world.width+s.x)
    &&!world.fires?.items.some(f=>f.attachedAnimalId===undefined&&f.attachedPawnId===undefined&&footprintContains(s,f))
    &&!world.jobs.some(j=>j.fixBreakdown?.structureId===s.id||j.deconstruction?.structureId===s.id||j.furniture?.structureId===s.id)){
    if(!Number.isSafeInteger(world.nextId+1))continue;
    for(const old of [...world.jobs])if(old.repair?.structureId===s.id){for(const pawn of world.pawns)if(pawn.jobId===old.id)releaseAssignments(world,pawn);world.jobs=world.jobs.filter(j=>j!==old);}
    world.jobs.push({id:world.nextId++,kind:'fix-breakdown',fixBreakdown:{structureId:s.id,kind:s.kind},x:s.x,z:s.z,orientation:s.orientation,footprint:s.footprint,status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
    for(const pawn of world.pawns)pawn.planCooldown=0;
  }
}

const CHANCE=[.75,.8,.85,.875,.9,.925,.95,.975,1,1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.1,1.12,1.13] as const;
export function fixBreakdownSuccessChance(pawn:Pawn,body?:BodyAssessment):number {
  const base=CHANCE[Math.max(0,Math.min(20,pawn.skills.construction.level))]!;
  const capacities=(body??pawnBody(pawn)).capacities;
  return Math.max(0,Math.min(1,base*(.7+.3*capacities.manipulation)*(.8+.2*Math.min(1,capacities.sight))));
}
/** Fixed 1000-Core-tick interaction, then one physical component is spent on
 * either result. Failure leaves the building broken for the next delivery. */
export function advanceBreakdownFix(world:World,pawn:Pawn,job:Job,body?:BodyAssessment):'success'|'failure'|null {
  const s=structureById(world,job.fixBreakdown?.structureId);
  if(!s?.breakdown||!targetBuildingPlayerUse263(world,s)||deliveredMaterial(world,job,'component')!==1)return null;
  pawn.path=[];pawn.state='working';job.progress++;
  if(job.progress<BREAKDOWN_FIX_TICKS)return null;
  const component=world.piles.find(p=>p.item==='component'&&p.owner.type==='job'&&p.owner.jobId===job.id)!;
  if(component.quantity===1)world.piles=world.piles.filter(p=>p!==component);
  else component.quantity--;
  const calendar=world.breakdown!;
  const successful=nextRandom(calendar)<fixBreakdownSuccessChance(pawn,body);
  learnSkill(pawn.skills.construction,1000,pawn);
  job.progress=0;
  if(successful)delete s.breakdown;
  return successful?'success':'failure';
}
