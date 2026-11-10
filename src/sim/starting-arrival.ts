import {assignPileOwner} from './pile-index.ts';
import {advanceCoreStartingArrival256} from './starting-pod-runtime-256.ts';
import {CORE_STARTING_ARRIVAL_PROFILE_256} from './starting-pod-state-256.ts';
import { isConstruction } from './construction-rules.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import { footprintContains } from './definitions.ts';
import { canStandAt } from './furniture-travel.ts';
import { groundCapacity,groundPile } from './ground-placement.ts';
import { refreshStock } from './materials.ts';
import { groundOccupancyAllows } from './occupancy.ts';
import { ARRIVING_CRASHLANDED_REVISION } from './scenario-definitions.ts';
import { serviceCell } from './service-reservations.ts';
import { STARTING_ARRIVAL_FALL_TICKS,STARTING_ARRIVAL_OPEN_DELAY,STARTING_ARRIVAL_PROFILE,type StartingArrivalPending,type StartingArrivalPod } from './starting-arrival-state.ts';
import type { Cell,MaterialPile,World } from './types.ts';

/** Creation-only transfer. IDs come from the actual factory allocations, never
 * from a scan that could mistake natural chunks for starting possessions. */
export function prepareStartingArrival(world:World,selectedPawnIds:readonly number[],transportedPileIds:readonly number[]):void {
  if(world.tick!==0||world.schemaVersion<231||world.scenario?.id!=='crashlanded'||world.scenario.revision!==ARRIVING_CRASHLANDED_REVISION
    ||!(world.climate?.revision===2||world.schemaVersion>=256&&world.climate?.revision===4&&world.site?.revision===3&&world.planet?.revision===3)||!world.planet||world.startingArrival!==undefined
    ||selectedPawnIds.length!==3||new Set(selectedPawnIds).size!==3||new Set(transportedPileIds).size!==transportedPileIds.length
    ||!Number.isSafeInteger(world.nextId+3))throw new Error('Le départ ne peut pas être placé dans les capsules.');
  const pawns=selectedPawnIds.map(id=>world.pawns.find(p=>p.id===id)),items=transportedPileIds.map(id=>world.piles.find(p=>p.id===id));
  if(pawns.some(p=>!p||p.state!=='idle'||p.motion||p.path.length||p.jobId!==null||p.need||p.haul||p.cooking
    ||p.orders.active!==null||p.orders.queue.length||p.health&&(p.health.tick!==0||p.health.injuries.length||p.health.missing.length||p.health.bloodLoss!==0))
    ||items.some(p=>!p||p.item==='wood'||p.item==='steel'||!(p.owner.type==='ground'||p.owner.type==='apparel'&&selectedPawnIds.includes(p.owner.pawnId))))
    throw new Error('Les personnes et biens de départ doivent être des records initiaux disponibles.');
  const pods:StartingArrivalPod[]=pawns.map((pawn,index)=>({id:world.nextId+index,cell:{x:pawn!.x,z:pawn!.z},pawn:pawn!,items:[],drops:[]}));
  let loose=0;
  for(const item of items as MaterialPile[]){
    const owner=item.owner,pod=owner.type==='apparel'?pods.find(p=>p.pawn.id===owner.pawnId)!:pods[loose++%3]!;
    pod.items.push(item);
    if(owner.type==='ground')pod.drops.push({pileId:item.id,cell:{x:owner.x,z:owner.z}});
  }
  // Validate the complete ownership plan before changing any source array or ID.
  if(new Set(pods.map(p=>p.cell.z*world.width+p.cell.x)).size!==3||pods.some(p=>!canStandAt(world,p.cell)))throw new Error('Les cellules des capsules sont indisponibles.');
  for(const pod of pods)for(const drop of pod.drops){
    const pile=pod.items.find(p=>p.id===drop.pileId)!;
    if(groundPile(world,drop.cell)!==pile||!groundOccupancyAllows(world,drop.cell))throw new Error('Un dépôt initial est indisponible.');
  }
  for(const pod of pods)for(const pile of pod.items)if(pile.owner.type==='ground')assignPileOwner(pile,{type:'starting-pod',podId:pod.id});
  const pawnIds=new Set(selectedPawnIds),pileIds=new Set(transportedPileIds);
  world.pawns=world.pawns.filter(p=>!pawnIds.has(p.id));world.piles=world.piles.filter(p=>!pileIds.has(p.id));world.nextId+=3;
  world.startingArrival={profile:STARTING_ARRIVAL_PROFILE,phase:'incoming',start:0,landAt:STARTING_ARRIVAL_FALL_TICKS,openAt:STARTING_ARRIVAL_FALL_TICKS+STARTING_ARRIVAL_OPEN_DELAY,personalTick:0,pods};
  refreshStock(world);
}

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
function occupiedExit(world:World,cell:Cell):boolean {
  const intersects=(actor:Cell&{motion?:{from:Cell;to:Cell;end:number}|null})=>same(actor,cell)||!!actor.motion&&actor.motion.end>world.tick
    &&cell.x>=Math.min(actor.motion.from.x,actor.motion.to.x)&&cell.x<=Math.max(actor.motion.from.x,actor.motion.to.x)
    &&cell.z>=Math.min(actor.motion.from.z,actor.motion.to.z)&&cell.z<=Math.max(actor.motion.from.z,actor.motion.to.z);
  return world.pawns.some(p=>!(p.state==='dead'&&(p.body?.pileId!==undefined||p.body?.lostAt!==undefined))&&(intersects(p)||!!serviceCell(p,world)&&same(serviceCell(p,world)!,cell)))
    ||!!world.wildlife?.animals.some(a=>a.state!=='dead'&&intersects(a))||!!world.mechanoids?.some(a=>a.state!=='dead'&&intersects(a));
}
/** Blueprints remain cancellable by the player while no starting worker exists.
 * Floors and conduits coexist with people/items; other plans reserve the exit. */
const plannedBlocker=(world:World,cell:Cell)=>world.jobs.some(j=>isConstruction(j)&&j.kind!=='build-bridge'&&j.kind!=='lay-floor'&&j.kind!=='power-conduit'&&footprintContains(j,cell));
function canOpen(world:World,state:StartingArrivalPending):boolean {
  const ids=new Set<number>(),cells=new Set<number>();
  if(world.piles.length+state.pods.reduce((n,p)=>n+p.items.length,0)>32768)return false;
  for(const pod of state.pods){
    if(!canStandAt(world,pod.cell)||occupiedExit(world,pod.cell)||plannedBlocker(world,pod.cell)||world.pawns.some(p=>p.id===pod.pawn.id))return false;
    for(const drop of pod.drops){
      const pile=pod.items.find(p=>p.id===drop.pileId),key=drop.cell.z*world.width+drop.cell.x;
      // Existing stacks cannot be merged: each returning Thing keeps its ID.
      if(!pile||ids.has(drop.pileId)||cells.has(key)||groundPile(world,drop.cell)||plannedBlocker(world,drop.cell)||groundCapacity(world,drop.cell,pile)<pile.quantity)return false;
      ids.add(drop.pileId);cells.add(key);
    }
    if(pod.items.some(p=>world.piles.some(active=>active.id===p.id)))return false;
  }
  return true;
}

/** One confirmed simulation boundary, after actors and before stock refresh.
 * A blocked landing retries at most once per subsequent tick, never reroutes. */
export function advanceStartingArrival(world:World):void {
  if(world.startingArrival?.profile===CORE_STARTING_ARRIVAL_PROFILE_256){advanceCoreStartingArrival256(world);return;}
  const state=world.startingArrival;if(!state||state.phase==='opened')return;
  if(world.tick<state.landAt)return;
  state.phase='landed';
  if(world.tick<state.openAt||!canOpen(world,state))return;
  // No operation below allocates an identity, rolls RNG, merges or destroys an
  // item. The complete placement was accepted above before any transfer.
  for(const pod of state.pods){
    if(pod.pawn.health)pod.pawn.health.tick=world.tick;
    for(const pile of pod.items){
      if(pile.rot)pile.rot.atTick=world.tick;
      if(pile.owner.type==='starting-pod')assignPileOwner(pile,{type:'ground',...pod.drops.find(d=>d.pileId===pile.id)!.cell});
    }
  }
  world.pawns.push(...state.pods.map(p=>p.pawn));
  for(const pod of state.pods)world.piles.push(...pod.items);
  world.startingArrival={profile:state.profile,phase:'opened',start:state.start,landAt:state.landAt,openAt:state.openAt,openedAt:world.tick,cells:state.pods.map(p=>({...p.cell}))};
  for(const pod of state.pods)notifyActualExplorationSpawn256(world,pod.pawn);
}
