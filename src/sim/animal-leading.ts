import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { isColonist } from './affiliation.ts';
import { PEN_ANIMALS, penAccessCells, penRegion } from './animal-pens.ts';
import { readyDoorEntry } from './doors.ts';
import { doorAt } from './door-rules.ts';
import { pawnBody } from './health-rules.ts';
import type { AnimalHandlingTask } from './domestic-state.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { adjacent, blockedCells, routeToJob, type Reachability } from './pathfinding.ts';
import { releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { Cell, Pawn, World } from './types.ts';
import { animalNavigation, moveAnimal } from './wildlife-navigation.ts';
import { animalBody } from './wildlife-health.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { animalServiceIds } from './animal-rest-state.ts';
import { structureById,structuresOfKind } from './structure-navigation.ts';

export type LeadingTask=AnimalHandlingTask & {kind:'lead';markerId:number};
/** Core 1.6.4871 JobDriver_RopeToDestination constants. */
export const MAX_ROPEES=10, ROPE_SCAN_RADIUS=10, ROPE_LENGTH=8;
export const leadRopees=(task:Pick<LeadingTask,'animalId'|'ropees'>):readonly number[]=>task.ropees??[task.animalId];
export const leadingClaimIds=(task:AnimalHandlingTask):readonly number[]=>task.kind==='lead'
  ?[task.animalId,...(task.ropees??[]),...(task.gatherId===undefined?[]:[task.gatherId])]
  :[task.animalId];
const key=(world:World,cell:Cell)=>cell.z*world.width+cell.x;
export const livestock=(a:WildAnimal):boolean=>PEN_ANIMALS.includes(a.species);
const usable=(world:World,a:WildAnimal,markerId:number)=>{
  const found=structureById(world,markerId),marker=found?.kind==='pen-marker'?found:undefined;
  const region=penRegion(world,markerId);
  return marker?.pen?.accepted.includes(a.species)&&region?.closed&&region.accessible?region:undefined;
};
const handler=(p:Pawn)=>{
  if(!isColonist(p)||workPriority(p,'handle')===0||p.state==='dead'||p.state==='downed'||p.draft||p.mental?.crisis||p.flee||p.interruptedCargo)return false;
  const body=pawnBody(p).capacities;return body.moving>0&&body.manipulation>0;
};
const claimedIds=(world:World)=>new Set(world.pawns.flatMap(animalServiceIds));
const ropeable=(a:WildAnimal)=>!!a.domestic&&livestock(a)&&a.state!=='dead'&&a.state!=='downed'
  &&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike;
function destination(world:World,a:WildAnimal,pawn:Pawn):number|undefined {
  const assigned=a.domestic?.penMarkerId;
  const assignedStructure=assigned?structureById(world,assigned):undefined;
  if(assigned&&assignedStructure&&allowedAreaAllows(world,pawn,assignedStructure)&&usable(world,a,assigned))return assigned;
  return structuresOfKind(world,'pen-marker').filter(s=>allowedAreaAllows(world,pawn,s)&&usable(world,a,s.id))
    .sort((x,y)=>(x.x-a.x)**2+(x.z-a.z)**2-((y.x-a.x)**2+(y.z-a.z)**2)||x.id-y.id)[0]?.id;
}
export function leadingWanted(world:World,pawn:Pawn):boolean {
  if(!handler(pawn))return false;
  if(!world.wildlife?.animals.some(a=>a.domestic&&livestock(a)&&a.state!=='dead'&&a.state!=='downed'))return false;
  if(!structuresOfKind(world,'pen-marker').length)return false;
  const claimed=claimedIds(world);
  return !!world.wildlife?.animals.some(a=>allowedAreaAllows(world,pawn,a)&&ropeable(a)&&!claimed.has(a.id)
    &&(()=>{const id=destination(world,a,pawn),r=id&&usable(world,a,id);return !!r&&!r.cells.has(key(world,a));})());
}
export interface LeadingProposal {task:LeadingTask;path:Cell[];target:Cell}
export function leadingProposal(world:World,pawn:Pawn,reach:Reachability):LeadingProposal|undefined {
  if(!handler(pawn))return;
  const claimed=claimedIds(world);
  let navigation:ReturnType<typeof animalNavigation>|undefined;
  const animals=(world.wildlife?.animals??[]).filter(a=>allowedAreaAllows(world,pawn,a)&&ropeable(a)&&!claimed.has(a.id))
    .sort((a,b)=>(a.x-pawn.x)**2+(a.z-pawn.z)**2-((b.x-pawn.x)**2+(b.z-pawn.z)**2)||a.id-b.id);
  for(const a of animals){
    const markerId=destination(world,a,pawn);if(!markerId)continue;
    const marker=structureById(world,markerId);if(!marker||!allowedAreaAllows(world,pawn,marker))continue;
    const region=usable(world,a,markerId);if(!region||region.cells.has(key(world,a)))continue;
    const path=routeToJob(world,a,reach,false);if(!path)continue;
    const goals=penAccessCells(world,markerId).filter(c=>allowedAreaAllows(world,pawn,c));
    if(!goals.length||!(navigation??=animalNavigation(world,true)).route(a,[...goals])?.length)continue;
    return {task:{animalId:a.id,kind:'lead',markerId,phase:'approach',sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0},path,target:a};
  }
}
export function startLeading(world:World,pawn:Pawn,proposal:LeadingProposal):void {
  const animal=world.wildlife?.animals.find(a=>a.id===proposal.task.animalId);
  if(animal?.domestic)animal.domestic.penMarkerId=proposal.task.markerId;
  pawn.animalHandling=proposal.task;pawn.path=proposal.path;pawn.state=proposal.path.length?'moving':'working';pawn.planCooldown=0;
}
function nextGather(world:World,pawn:Pawn,task:LeadingTask,ctx:NeedContext):number|undefined {
  if(leadRopees(task).length>=MAX_ROPEES)return;
  const region=usable(world,world.wildlife!.animals.find(a=>a.id===task.animalId)!,task.markerId);
  if(!region)return;
  const claims=claimedIds(world);
  const candidates=world.wildlife!.animals.filter(a=>allowedAreaAllows(world,pawn,a)&&ropeable(a)&&!claims.has(a.id)&&!region.cells.has(key(world,a))
    &&!!usable(world,a,task.markerId)&&(a.x-pawn.x)**2+(a.z-pawn.z)**2<=ROPE_SCAN_RADIUS**2)
    .sort((a,b)=>(a.x-pawn.x)**2+(a.z-pawn.z)**2-((b.x-pawn.x)**2+(b.z-pawn.z)**2)||a.id-b.id);
  if(!candidates.length)return;
  const reach=ctx.search();if(!reach)return;
  return candidates.find(a=>!!routeToJob(world,a,reach,false))?.id;
}
/** Attached animals advance on confirmed simulation edges only. The handler
 * waits while a ropee is still traversing its edge. Routes are computed only
 * when a follower needs one, never from a render frame. */
function followRopees(world:World,pawn:Pawn,task:LeadingTask,activeId:number|null):boolean {
  let allNear=true;
  let plan:ReturnType<typeof animalNavigation>|undefined,physical:ReturnType<typeof animalNavigation>|undefined;
  const region=penRegion(world,task.markerId);
  for(const id of leadRopees(task)){
    if(id===activeId)continue;
    const a=world.wildlife?.animals.find(item=>item.id===id);
    if(!a||region?.cells.has(key(world,a)))continue;
    if(a.motion&&a.motion.end>world.tick){allNear=false;continue;}
    if(Math.max(Math.abs(a.x-pawn.x),Math.abs(a.z-pawn.z))<=1){a.path=[];continue;}
    allNear=false;
    if(!a.path.length){
      const goals=[pawn,{x:pawn.x-1,z:pawn.z},{x:pawn.x+1,z:pawn.z},{x:pawn.x,z:pawn.z-1},{x:pawn.x,z:pawn.z+1}]
        .filter(c=>c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height);
      a.path=(plan??=animalNavigation(world,true)).route(a,goals)??[];
      if(!a.path.length){interruptWork(world,pawn);return false;}
    }
    const next=a.path[0]!;
    if(doorAt(world,next)?.door?.forbidden){interruptWork(world,pawn);return false;}
    if(!readyDoorEntry(world,pawn,next))continue;
    if(!(physical??=animalNavigation(world)).step(a,next)){a.path=[];continue;}
    moveAnimal(world,a,physical.step,animalBody(a).capacities.moving);
    a.nextDecision=world.tick;
  }
  return allNear;
}
export function processLeading(world:World,pawn:Pawn,task:LeadingTask,ctx:NeedContext):void {
  if(!allowedAreaServicesAllowed(world,pawn)){interruptWork(world,pawn);return;}
  const animal=world.wildlife?.animals.find(a=>a.id===task.animalId);
  if(!animal||!ropeable(animal)||!handler(pawn)||leadRopees(task).some(id=>!world.wildlife?.animals.some(a=>a.id===id&&ropeable(a)))) {interruptWork(world,pawn);return;}
  const region=usable(world,animal,task.markerId);
  if(!region){interruptWork(world,pawn);return;}
  const attached=leadRopees(task).map(id=>world.wildlife!.animals.find(a=>a.id===id)!);
  if(attached.every(a=>region.cells.has(key(world,a)))){
    for(const a of attached){a.domestic!.penMarkerId=task.markerId;a.path=[];}
    // The handler must clear the leaf before it can close. This is still a
    // physical move, so an occupied or blocked landing cell postpones release.
    if(doorAt(world,pawn)){
      const blocked=blockedCells(world),choices=[{x:pawn.x-1,z:pawn.z},{x:pawn.x+1,z:pawn.z},{x:pawn.x,z:pawn.z-1},{x:pawn.x,z:pawn.z+1}];
      const exit=choices.find(c=>c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height&&!region.cells.has(key(world,c))&&!blocked[key(world,c)]);
      if(exit){ctx.move(exit,true);return;}
    }
    if(!releaseWork(world,pawn))interruptWork(world,pawn);return;
  }
  if(task.phase==='approach'){
    if(animal.motion&&animal.motion.end>world.tick)return;
    if(!adjacent(pawn,animal)&&(pawn.x!==animal.x||pawn.z!==animal.z)){ctx.move(animal,false);return;}
    delete animal.animalThermalRefuge288;animal.path=[];delete animal.meal;animal.nextDecision=world.tick;
    if(!animal.motion||animal.motion.end<=world.tick)animal.state='idle';
    task.ropees=[animal.id];
    task.gatherId=nextGather(world,pawn,task,ctx);
    task.phase=task.gatherId===undefined?'lead':'gather';
    pawn.path=[];pawn.state='working';return;
  }
  if(task.phase==='gather'){
    const target=world.wildlife?.animals.find(a=>a.id===task.gatherId);
    if(!target||!ropeable(target)||!usable(world,target,task.markerId)||region.cells.has(key(world,target))){
      delete task.gatherId;task.phase='lead';for(const a of attached)a.path=[];return;
    }
    if(!followRopees(world,pawn,task,null))return;
    if(target.motion&&target.motion.end>world.tick)return;
    if(!adjacent(pawn,target)&&(pawn.x!==target.x||pawn.z!==target.z)){ctx.move(target,false);return;}
    delete target.animalThermalRefuge288;target.path=[];delete target.meal;target.nextDecision=world.tick;
    if(!target.motion||target.motion.end<=world.tick)target.state='idle';
    target.domestic!.penMarkerId=task.markerId;
    task.ropees=[...leadRopees(task),target.id];delete task.gatherId;
    task.gatherId=nextGather(world,pawn,task,ctx);
    task.phase=task.gatherId===undefined?'lead':'gather';
    for(const a of world.wildlife!.animals)if(task.ropees.includes(a.id))a.path=[];
    pawn.path=[];pawn.state='working';return;
  }
  const active=attached.find(a=>!region.cells.has(key(world,a)));
  if(!active)return;
  if(!followRopees(world,pawn,task,active.id))return;
  if(active.motion&&active.motion.end>world.tick)return;
  task.phase='lead';pawn.state='working';pawn.path=[];
  if(!active.path.length){
    if(active.nextDecision>world.tick)return;
    const goals=penAccessCells(world,task.markerId).filter(c=>allowedAreaAllows(world,pawn,c));
    // One global animal route only when beginning or after a failed edge.
    const path=goals.length?animalNavigation(world,true).route(active,[...goals]):undefined;
    if(!path?.length){interruptWork(world,pawn);return;}
    active.path=path;
  }
  const next=active.path[0]!;
  if(!adjacent(pawn,next)&&!(pawn.x===next.x&&pawn.z===next.z)){ctx.move(next,false);return;}
  if(doorAt(world,next)?.door?.forbidden){active.path=[];active.nextDecision=world.tick+100;return;}
  if(!readyDoorEntry(world,pawn,next))return;
  const nav=animalNavigation(world);
  if(!nav.step(active,next)){active.path=[];active.nextDecision=world.tick+100;return;}
  moveAnimal(world,active,nav.step,animalBody(active).capacities.moving);
  active.nextDecision=world.tick;
}
