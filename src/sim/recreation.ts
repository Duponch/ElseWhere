import {isSchema300OrLater} from './schema-compatibility-257.ts';
import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import { allowedAreaRecreationAllowed } from './allowed-area-services.ts';
import {readingAllowed295,readingAutoNeeds295} from './reading-state-295.ts';
import {processReading295,selectAutomaticReading295} from './reading-runtime-295.ts';
import {readingSourceAllowed295} from './reading-space-295.ts';
import {interruptWork} from './interrupted-cargo.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { assignmentAt } from './schedule.ts';
import { gainRecreation, RECREATION_GAIN, RECREATION_DURATION, VISIT_SICK_DURATION, recreationKind, recreationRandom, type RecreationActivity, type RecreationTask } from './recreation-rules.ts';
import { adjacentToTable, availableChessTables, availablePins, availableTelevisions, captureRecreationResources, chessCells, horseshoeCells, isGatherSpot, nearVisitPatient, recreationSiteValid, recreationSpace, visitablePatient, visitPatient,type RecreationSpace } from './recreation-space.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { isColonist } from './affiliation.ts';
import { televisionWatchCells,TELEVISION_GAIN_FACTOR,TELEVISION_WEIGHT } from './television-recreation.ts';
import { footprintCells } from './definitions.ts';
import { rememberRoomUse } from './room-experience.ts';
import { canSocialize, visitSocialExchange } from './social.ts';
import { urgentMedicalTask, urgentWorkEnabled } from './urgent-care.ts';
import { urgentTreatment } from './care-rules.ts';
import { lyingPatient } from './tending.ts';
import { learnSkill } from './skills.ts';
import { pawnBody } from './health-rules.ts';
import { cellIndex, routeToCell } from './pathfinding.ts';
import type { NeedContext } from './needs.ts';
import type { Pawn, World } from './types.ts';

const labels: Record<RecreationActivity,string> = {horseshoes: 'jouer aux fers à cheval', skygaze: 'observer le ciel', chess:'jouer aux échecs','social-relax':'se détendre ensemble','visit-sick':'rendre visite à un malade','watch-television':'regarder la télévision',party:'participer à la fête',read:'lire un roman'};
const urgentDoctorCall=(world:World,pawn:Pawn):boolean=>urgentWorkEnabled(pawn,'doctor',world)&&world.pawns.some(p=>p!==pawn&&allowedAreaAllows(world,pawn,p)&&lyingPatient(p)&&urgentTreatment(p));
/** Search shares the existing bounded navigation budget. No gain in transit,
 * no worker/cargo preemption just because the timetable recommends recreation. */
export function processRecreation(world: World, pawn: Pawn, context: NeedContext, afterWork = false, provider:'ordinary'|'idle300'='ordinary'): boolean {
  // Party has its own physical presence watermark and outcome; personal joy
  // saturation and the ordinary 400-tick limit must never finish it.
  if(pawn.recreation.task?.activity==='party')return false;
  if(pawn.recreation.task?.activity==='read'){
    if(urgentDoctorCall(world,pawn)){interruptWork(world,pawn,true);return false;}
    return processReading295(world,pawn,context);
  }
  const joy=pawn.recreation;
  if (joy.task) {
    const assignment=assignmentAt(world,pawn);
    if (assignment==='work' || urgentMedicalTask(pawn,world) || urgentDoctorCall(world,pawn)
      || joy.task.activity==='visit-sick'&&world.pawns.some(p=>p.id===joy.task!.patientId&&urgentTreatment(p))
      || joy.task.activity==='chess'&&pawnBody(pawn).capacities.manipulation<=0
      || joy.task.activity==='watch-television'&&(world.schemaVersion<190||!isColonist(pawn)||!!pawn.prisoner||!!pawn.visitor||pawnBody(pawn).capacities.sight<=0)
      || (joy.task.activity==='social-relax'||joy.task.activity==='visit-sick')&&!canSocialize(world,pawn,true)
      || !allowedAreaRecreationAllowed(world,pawn,joy.task)||!recreationSiteValid(world,joy.task,undefined,context.recreationTopology)) { context.release(); return false; }
    const task=joy.task;
    if (task.phase==='travel') {
      if(pawn.x!==task.target.x||pawn.z!==task.target.z) {context.move(task.target,true);return true;}
      task.phase='active';pawn.path=[];pawn.state='recreating';
      context.event(`${pawn.name} commence à ${labels[task.activity]}.`);
    }
    pawn.state='recreating';gainRecreation(joy,recreationKind(task.activity),RECREATION_GAIN*(task.activity==='watch-television'?TELEVISION_GAIN_FACTOR:1));
    if(task.activity==='visit-sick') {
      const patient=visitPatient(world,task.patientId!,false);
      if(!patient){context.release();return false;}
      gainRecreation(patient.recreation,'social');
      // The exchange uses the existing directed-memory and social RNG rules.
      if(task.elapsed>0&&task.elapsed%32===0)visitSocialExchange(world,pawn,patient);
    }
    if(task.activity==='social-relax'&&task.elapsed===0||task.activity==='visit-sick'&&task.elapsed===0)rememberRoomUse(world,pawn,'recreation');
    if(task.activity==='chess') {
      pawn.skills.intellectual??={level:0,xp:0,dailyXp:0,passion:0};
      learnSkill(pawn.skills.intellectual,20,pawn); // Core 0.002 XP per tick, ten Core ticks per local tick.
    }
    task.elapsed++;
    if(joy.level>99.99||task.elapsed>=(task.activity==='visit-sick'?VISIT_SICK_DURATION:RECREATION_DURATION)) {
      context.event(`${pawn.name} termine son loisir : ${labels[task.activity]}.`);
      context.release();
    }
    return true;
  }
  return offerRecreation300(world,pawn,context,afterWork,provider)!=='unavailable';
}

export type RecreationProvider300='ordinary'|'idle300';
export type RecreationOffer300='admitted'|'unavailable'|'pending';
/** Admission only: do not process an existing recreation/reading task. Search,
 * ordering, RNG, cooldown writes and real reading admission remain shared with
 * the macro wrapper; no elapsed, joy or XP is granted by this offer. */
export function offerRecreation300(world:World,pawn:Pawn,context:NeedContext,afterWork=false,provider:RecreationProvider300='ordinary'):RecreationOffer300 {
  if(pawn.recreation.task)return 'unavailable';
  const joy=pawn.recreation,assignment=assignmentAt(world,pawn);
  // The idle supplier has its own admission conditions; no fake timetable or World.
  const idle300=isSchema300OrLater(Number(world.schemaVersion))&&provider==='idle300';
  if(idle300&&(effectiveCore297(world)<60000||assignment==='work'))return 'unavailable';
  if (world.tick<500 || pawn.hunting || pawn.research || pawn.need || pawn.jobId!==null || pawn.haul || pawn.cooking || pawn.burial || pawn.cleaning || pawn.needCooldown>0 || (!isSchema299OrLater(Number(world.schemaVersion)) && pawn.hunger<=20)
    || !idle300&&(assignment==='work'||assignment==='sleep'&&!afterWork) || joy.level >= (idle300?99:assignment==='anything'?35:95) || urgentMedicalTask(pawn,world) || urgentDoctorCall(world,pawn)) return 'unavailable';
  const choices: {activity: RecreationActivity; weight: number}[] = [];
  let pins:ReturnType<typeof availablePins>|undefined,chessTables:ReturnType<typeof availableChessTables>|undefined;
  const televisions=world.schemaVersion>=190&&isColonist(pawn)&&!pawn.prisoner&&!pawn.visitor&&pawnBody(pawn).capacities.sight>0?availableTelevisions(world,pawn.id):[];
  const socialCapable=canSocialize(world,pawn,true);
  const gathers=socialCapable?world.structures.filter(s=>isGatherSpot(s)&&s.gatherSpot!==false&& (s.kind!=='campfire'||!!s.fuel?.ticks&&s.power?.switchOn!==false)):[];
  const claimedPatients=new Set(world.pawns.flatMap(p=>p.recreation.task?.activity==='visit-sick'&&p.id!==pawn.id?[p.recreation.task.patientId!]:[]));
  const patients=socialCapable?world.pawns.filter(p=>p.id!==pawn.id&&!claimedPatients.has(p.id)&&visitablePatient(world,p)):[];
  for(const activity of ['skygaze','horseshoes','chess','social-relax','visit-sick','watch-television'] as const) {
    if(activity==='watch-television'&&!televisions.length)continue;
    const kind=recreationKind(activity);
    if(!joy.bored[kind]&&(activity!=='horseshoes'||(pins??=availablePins(world,pawn.id)).length)&&(activity!=='chess'||(chessTables??=availableChessTables(world,pawn.id)).length&&pawnBody(pawn).capacities.manipulation>0)
      &&(activity!=='social-relax'||gathers.length)&&(activity!=='visit-sick'||patients.length))
      choices.push({activity,weight:(activity==='horseshoes'?2.5:activity==='chess'?2:activity==='social-relax'?4:activity==='visit-sick'?3:activity==='watch-television'?TELEVISION_WEIGHT:1)*Math.max(.001,(1-(joy.tolerance[kind]??0)/100)**5)});
  }
  if((Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))&&readingAllowed295(pawn)&&readingAutoNeeds295(pawn)&&!joy.bored.reading&&world.piles.some(p=>p.kind==='book'&&readingSourceAllowed295(world,pawn,p)))
    choices.push({activity:'read',weight:3*Math.max(.001,(1-(joy.tolerance.reading??0)/100)**5)});
  if(!choices.length){pawn.needCooldown=20;return 'unavailable';}
  const reserved=reservedServiceCells(world,pawn.id);
  let space:RecreationSpace|undefined;
  const readSpace=()=>space??=recreationSpace(world,undefined,choices.some(c=>c.activity==='visit-sick'),context.recreationTopology);
  while(choices.length) {
    let draw=recreationRandom(world)*choices.reduce((sum,c)=>sum+c.weight,0), index=0;
    for(;index<choices.length-1;index++){draw-=choices[index]!.weight;if(draw<0)break;}
    const {activity}=choices.splice(index,1)[0]!;
    if(activity==='read'){
      const selected=selectAutomaticReading295(world,pawn,context);if(selected!=='unavailable')return selected?(joy.task?'admitted':'pending'):'unavailable';continue;
    }
    const candidates: RecreationTask[]=[];
    if(activity==='horseshoes') {
      for(const pin of pins??=availablePins(world,pawn.id))for(const target of horseshoeCells(pin))
        if(!reserved.has(cellIndex(world,target.x,target.z)))candidates.push({activity,buildingId:pin.id,target,phase:'travel',elapsed:0});
    } else if(activity==='chess') {
      const seats=readSpace().seats;
      for(const table of chessTables??=availableChessTables(world,pawn.id))for(const target of chessCells(table)) {
        const seat=seats.get(cellIndex(world,target.x,target.z));
        if(seat&&!reserved.has(cellIndex(world,target.x,target.z)))candidates.push({activity,buildingId:table.id,seatId:seat.id,target,phase:'travel',elapsed:0});
      }
    } else if(activity==='watch-television') {
      const seats=readSpace().seats;
      for(const tv of televisions)for(const target of televisionWatchCells(tv)) {
        const key=cellIndex(world,target.x,target.z),seat=seats.get(key);
        if(seat&&!reserved.has(key))candidates.push({activity,buildingId:tv.id,seatId:seat.id,target,phase:'travel',elapsed:0});
      }
    } else if(activity==='social-relax'||activity==='visit-sick') {
      const seats=readSpace().seats;
      if(activity==='social-relax')for(const spot of gathers) {
        if(spot.kind!=='campfire') {
          const around=new Set<number>();
          for(const part of footprintCells(spot))for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]])around.add(cellIndex(world,part.x+dx!,part.z+dz!));
          for(const key of around){const seat=seats.get(key);if(seat&&!reserved.has(key)&&adjacentToTable(spot,seat))candidates.push({activity,buildingId:spot.id,seatId:seat.id,target:{x:seat.x,z:seat.z},phase:'travel',elapsed:0});}
        } else for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)if(dx*dx+dz*dz>0&&dx*dx+dz*dz<=15){
          const target={x:spot.x+dx,z:spot.z+dz},key=cellIndex(world,target.x,target.z),seat=seats.get(key);
          if(!reserved.has(key))candidates.push({activity,buildingId:spot.id,...(seat?{seatId:seat.id}:{}),target,phase:'travel',elapsed:0});
        }
      }
      else for(const patient of patients)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
        const target={x:patient.x+dx,z:patient.z+dz},key=cellIndex(world,target.x,target.z),seat=seats.get(key);
        if(nearVisitPatient(patient,target)&&!reserved.has(key))candidates.push({activity,buildingId:null,patientId:patient.id,...(seat?{seatId:seat.id}:{}),target,phase:'travel',elapsed:0});
      }
    } else {
      // Local open-air sites replace the reference's region-based random search.
      // Eight rays, three distances: bounded candidates, varied physical trips.
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]])for(const distance of [2,4,6])
        candidates.push({activity,buildingId:null,target:{x:pawn.x+dx!*distance,z:pawn.z+dz!*distance},phase:'travel',elapsed:0});
    }
    const decisionSpace=readSpace();
    if(activity==='skygaze'&&!decisionSpace.resources)captureRecreationResources(world,decisionSpace,candidates.map(c=>c.target));
    const policy=captureAllowedArea(world,pawn);
    const valid=candidates.filter(c=>(!policy||allowedAreaRecreationAllowed(world,pawn,c,policy))&&!reserved.has(cellIndex(world,c.target.x,c.target.z))&&recreationSiteValid(world,c,decisionSpace));
    if(!valid.length)continue;
    // Search all usable destinations as one nearest-goal request; never assume
    // geometrically near means reachable. An inaccessible pin gives no benefit.
    // A nearest-goal search stops before more distant chairs are settled.
    // Prefer facing chairs in the goal set itself, before requesting routes.
    // If every facing goal is unreachable, the completed component also
    // contains the fallback chairs, so this still uses one search request.
    const facing=activity==='watch-television'?valid.filter(task=>{
      const tv=decisionSpace.televisions?.get(task.buildingId!),seat=decisionSpace.seats.get(cellIndex(world,task.target.x,task.target.z));
      return !!tv&&seat?.orientation===(tv.orientation+2)%4;
    }):[];
    const goals=facing.length?facing:valid;
    const reach=context.search(new Set(goals.map(c=>cellIndex(world,c.target.x,c.target.z))));
    if(!reach)return 'pending';
    const reachable=valid.flatMap(task=>{const path=routeToCell(world,task.target,reach);return path?[{task,path}]:[];});
    if(!reachable.length)continue;
    let preferred=(activity==='social-relax'||activity==='visit-sick')&&reachable.some(r=>r.task.seatId!==undefined)?reachable.filter(r=>r.task.seatId!==undefined):reachable;
    if(activity==='watch-television') {
      const facingReachable=reachable.filter(r=>facing.includes(r.task));
      if(facingReachable.length)preferred=facingReachable;
    }
    const selected=preferred[Math.floor(recreationRandom(world)*preferred.length)]!;
    joy.task=selected.task;pawn.path=selected.path;pawn.state='moving';pawn.planCooldown=0;return 'admitted';
  }
  pawn.needCooldown=20;return 'unavailable';
}
