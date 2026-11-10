import { startSentryMelee } from './melee.ts';
import { equippedWeapon } from './equipment-rules.ts';
import { rangedWeaponProfile } from './ranged-statistics.ts';
import { RoomTopologyCache } from './room-topology.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { activeThreat,distanceSquared,hostileTo,isColonist } from './affiliation.ts';
import { clearShotSegment } from './combat-space.ts';
import { shootingQueries,startAutonomousShot } from './shooting.ts';
import { interruptDraftWork } from './drafting.ts';
import { candidateAccess } from './candidate-access.ts';
import { captureStandability } from './furniture-travel.ts';
import { canStep,routeToCell } from './pathfinding.ts';
import { startTravel } from './movement.ts';
import { retryInterruptedCargo } from './interrupted-cargo.ts';
import type { LightReader } from './light-environment.ts';
import type { NavigationGrid,SearchBudget } from './work-planner.ts';
import type { Cell,Pawn,World } from './types.ts';
import { activeCombatThreat,hostileCandidates,hostileTarget,isAnimalTarget,meleeThreatTarget,type LivingTarget } from './combat-target.ts';
import type { WildAnimal } from './wildlife-state.ts';

export interface FleeState { target:Cell; /** Zero while travelling, otherwise end of cowering. */ until:number }
const EMPTY:ReadonlySet<number>=new Set();
// Cache checks the complete current barrier mask on every read; it never trusts
// a tick/array identity and never keeps World alive.
const roomCaches=new WeakMap<World,RoomTopologyCache>();
/** One synchronous decision owner. Do not reuse after an actor changes the world. */
export function threatQueries(world:World,animalThreats?:readonly WildAnimal[]) {
  const queries=shootingQueries(world);
  const hostiles=(p:Pawn)=>{
    const targets=hostileCandidates(world,p,animalThreats),threat=meleeThreatTarget(world,p,world.tick*10,undefined,queries.grid);
    if(threat&&!targets.some(t=>t.id===threat.id))targets.push(threat);
    return targets;
  };
  return {queries,hostiles,
    nearby:(p:Pawn)=>hostiles(p).filter(t=>distanceSquared(p,t)<64&&clearShotSegment(queries.grid(),p,t)),
    /** Same as nearby(p).length>0, without listing every hostile of the map:
     * the distance is tested first, then the same pure hostility and shot
     * predicates, then the melee threat. */
    anyNearby:(p:Pawn):boolean=>{
      const near=(t:LivingTarget)=>distanceSquared(p,t)<64&&hostileTarget(p,t)&&activeCombatThreat(t)&&clearShotSegment(queries.grid(),p,t);
      for(const t of world.pawns)if(near(t))return true;
      for(const t of animalThreats??world.wildlife?.animals??[])if(near(t))return true;
      for(const t of world.mechanoids??[])if(near(t))return true;
      const threat=meleeThreatTarget(world,p,world.tick*10,undefined,queries.grid);
      return !!threat&&distanceSquared(p,threat)<64&&clearShotSegment(queries.grid(),p,threat);
    }};
}
type Context=ReturnType<typeof threatQueries>;
/** Forced civilian jobs and drafted control take precedence over default flee. */
export function considerFlee(world:World,pawn:Pawn,context:Context):void {
  if(!isColonist(pawn)||pawn.draft||pawn.hostilityResponse!==undefined||pawn.shooting&&!pawn.hunting||pawn.melee||pawn.flee||pawn.need?.kind==='sleep'||pawn.orders.active!==null||pawn.orders.queue.length||pawn.priorityWork||pawn.equipmentTask)return;
  if(!context.anyNearby(pawn))return;
  interruptDraftWork(world,pawn);
  pawn.flee={target:{x:pawn.x,z:pawn.z},until:0};pawn.path=[];pawn.planCooldown=0;
}
/** Fixed sentry scenario, deliberately not an assault/raid or melee controller. */
export function processSentry(world:World,pawn:Pawn,context:Context):void {
  if(startSentryMelee(world,pawn)||pawn.shooting)return;
  pawn.state='idle';
  const weapon=equippedWeapon(world,pawn),profile=weapon?.weapon?rangedWeaponProfile(weapon.item,weapon.weapon.quality):undefined;if(!profile)return;
  const range=profile.range;
  const targets=context.hostiles(pawn).filter(t=>distanceSquared(pawn,t)<=range**2).sort((a,b)=>distanceSquared(pawn,a)-distanceSquared(pawn,b)||a.id-b.id);
  for(const target of targets)if(!isAnimalTarget(target)&&startAutonomousShot(world,pawn,target,context.queries))break;
}
function planEscape(world:World,pawn:Pawn,hostiles:LivingTarget[],blocked:Uint8Array):Cell[]|undefined {
  const reach=candidateAccess(world,pawn,blocked,EMPTY),candidates:{cell:Cell;score:number;distance:number}[]=[];
  let roomCache=roomCaches.get(world);if(!roomCache){roomCache=new RoomTopologyCache();roomCaches.set(world,roomCache);}
  const stands=captureStandability(world),rooms=roomCache.read(world),reserved=reservedServiceCells(world,pawn.id);
  for(const p of world.pawns)if(p!==pawn){const c=p.flee?.target??p.draft?.target;if(c)reserved.add(c.z*world.width+c.x);}
  for(let z=Math.max(0,pawn.z-49);z<=Math.min(world.height-1,pawn.z+49);z++)for(let x=Math.max(0,pawn.x-49);x<=Math.min(world.width-1,pawn.x+49);x++) {
    const cell={x,z},distance=distanceSquared(cell,pawn);if(distance>=50**2||!stands(cell)||rooms.at(x,z)?.kind==='doorway')continue;
    let nearest=hostiles[0]!;for(const threat of hostiles)if(distanceSquared(cell,threat)<distanceSquared(cell,nearest))nearest=threat;
    const separation=Math.sqrt(distanceSquared(cell,nearest)),separateRoom=rooms.at(x,z)!==rooms.at(nearest.x,nearest.z);
    let score=Math.min(separation,23)**1.2*(1-Math.sqrt(distance)/50)*(separateRoom?4.2:separation<8?.05:1);
    if(reserved.has(z*world.width+x))score*=.5;
    candidates.push({cell,score,distance});
  }
  candidates.sort((a,b)=>b.score-a.score||a.distance-b.distance||a.cell.z-b.cell.z||a.cell.x-b.cell.x);
  for(const {cell} of candidates)if(reach.has(cell.z*world.width+cell.x)){const path=routeToCell(world,cell,reach);if(path)return path.length?path:undefined;}
  return;
}
export function processFlee(world:World,pawn:Pawn,context:Context,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader):void {
  const flee=pawn.flee!;
  if(pawn.hostilityResponse!==undefined||pawn.draft){delete pawn.flee;pawn.path=[];return;}
  // The decision may interrupt a civilian hunt immediately, but its emitted
  // shot still owns recovery before a new physical edge can start.
  if(pawn.shooting?.stance?.phase==='cooldown'){pawn.state='idle';return;}
  if(flee.until&&!pawn.path.length) {
    pawn.state='idle';retryInterruptedCargo(world,pawn);
    // Preserve Core's refuge observation interval, but admit the next escape
    // in this decision once the observation interrupts cowering.
    if((world.tick*10+pawn.id)%35<10&&context.anyNearby(pawn)){flee.until=0;pawn.planCooldown=0;}
    else {if(world.tick>=flee.until){delete pawn.flee;pawn.planCooldown=0;pawn.needCooldown=0;}return;}
  }
  if(!flee.until&&!pawn.path.length) {
    if(!budget.remaining||pawn.planCooldown)return;
    budget.remaining--;const threats=context.hostiles(pawn);
    const path=threats.length?planEscape(world,pawn,threats,getBlocked()):undefined;
    if(path){pawn.path=path;flee.target={...path.at(-1)!};}
    else {flee.target={x:pawn.x,z:pawn.z};flee.until=world.tick+120;}
  }
  const next=pawn.path[0];
  if(next) {
    if(!canStep(world,pawn,next,getBlocked(),EMPTY)){pawn.path=[];pawn.planCooldown=20;return;}
    pawn.state='moving';if(startTravel(world,pawn,next,getLight))pawn.path.shift();
    if(!pawn.path.length)flee.until=Math.ceil(pawn.motion?.end??world.tick)+120;
    return;
  }
  pawn.state='idle';retryInterruptedCargo(world,pawn);
}
