import type { LivingTarget,LivingTargetKey } from './combat-target.ts';
import type { Cell,Structure,World } from './types.ts';
import { structuresOfKind } from './structure-navigation.ts';
import { IED_COMMON_357,isIedTrapKind357,isTrapKind357,trapStructures357 } from './ied-traps-357.ts';

export interface SpikeTrapState { autoRebuild:boolean; touching:LivingTargetKey[] }
export const SPIKE_TRAP_SEARCH_COST=Math.round(800/30*1000);
export const SPIKE_TRAP_WALK_DELAY=4;

/** Grid coordinates anticipate arrival. Contacts keep the original cell until
 * the complete edge (including stagger/stun) ends; retained old edges are inert. */
export function spikeTrapPhysicalCell(actor:Pick<LivingTarget,'x'|'z'|'motion'>,atCore:number):Cell {
  return actor.motion&&atCore<actor.motion.end*10?actor.motion.from:{x:actor.x,z:actor.z};
}
export function initialSpikeTrapState(world:World,cell:Cell):SpikeTrapState {
  return {autoRebuild:!!world.home?.includes(cell.z*world.width+cell.x),touching:[]};
}

/** Local traps belong to the colony. Mental hostility never changes faction
 * knowledge. No Lord avoidance ratio or factionless human exists locally. */
export function spikeTrapKnowsOf(_world:World,actor:LivingTarget):boolean {
  if('mechKind' in actor)return false;
  if('species' in actor)return !!actor.domestic||!actor.manhunter;
  return actor.faction!=='outlaws'||actor.prisoner?.releasedAt!==undefined;
}
/** Building_Trap.SpringChance; from 357 the IED traps scale the wild animal
 * knower chance by trapPeacefulWildAnimalsSpringChanceFactor 0.25. */
export function spikeTrapSpringChance(world:World,actor:LivingTarget,kind:Structure['kind']='spike-trap'):number {
  if(!spikeTrapKnowsOf(world,actor))return 1;
  if('species' in actor)return actor.domestic ? .005 : isIedTrapKind357(kind)?.2*IED_COMMON_357.peacefulWildAnimalFactor:.2;
  if('mechKind' in actor)return 1;
  return !actor.faction||actor.faction==='colony' ? .005 : 0;
}
/** Cell-only geometry queries have no implied affiliation. Actor snapshots
 * retain their identity, so a copied direct-order origin remains actor-aware. */
export function spikeTrapNavigationActor(world:World,origin:Cell|undefined):LivingTarget|undefined {
  if(!origin||!('id' in origin))return;
  if('species' in origin)return origin as LivingTarget;
  if('mechKind' in origin)return origin as LivingTarget;
  return world.pawns.find(p=>p.id===origin.id);
}
export const spikeTrapTargetKey=(actor:LivingTarget):LivingTargetKey=>`${'species' in actor?'animal':'mechKind' in actor?'mech':'pawn'}:${actor.id}`;

/** Sparse capture for one contact pass. Carried patients have no independent
 * spawned contact, even when their copied segment reaches a trap head. */
export function captureSpikeTrapContacts(world:World,atCore:number):{traps:ReadonlyMap<number,Structure>;actors:ReadonlyMap<number,readonly LivingTarget[]>} {
  const traps=new Map<number,Structure>(),actors=new Map<number,LivingTarget[]>();
  if(world.schemaVersion<226)return {traps,actors};
  for(const s of trapStructures357(world,kind=>structuresOfKind(world,kind)))if(s.spikeTrap)traps.set(s.z*world.width+s.x,s);
  if(!traps.size)return {traps,actors};
  const carriedPawns=new Set<number>(),carriedAnimals=new Set<number>();
  for(const p of world.pawns){if(p.rescue?.phase==='carry')carriedPawns.add(p.rescue.patientId);if(p.animalRescue?.phase==='carry')carriedAnimals.add(p.animalRescue.animalId);}
  const add=(actor:LivingTarget)=>{
    if(actor.state==='dead'||actor.health?.death)return;
    const c=spikeTrapPhysicalCell(actor,atCore),index=c.z*world.width+c.x;
    if(!traps.has(index))return;
    const bucket=actors.get(index);if(bucket)bucket.push(actor);else actors.set(index,[actor]);
  };
  for(const p of world.pawns)if(!carriedPawns.has(p.id))add(p);
  for(const a of world.wildlife?.animals??[])if(!carriedAnimals.has(a.id))add(a);
  for(const m of world.mechanoids??[])add(m);
  return {traps,actors};
}

/** Core NeverAdjacentTrap counts finished buildings, plans and frames, including
 * diagonal neighbours. The ignored identity is only the original object. */
export function spikeTrapPlacementAllowed(world:World,cell:Cell,ignoredId?:number):boolean {
  const adjacent=(c:Cell)=>Math.abs(c.x-cell.x)<=1&&Math.abs(c.z-cell.z)<=1;
  return !world.structures.some(s=>s.id!==ignoredId&&isTrapKind357(s.kind)&&adjacent(s))
    &&!world.jobs.some(j=>j.id!==ignoredId&&(isTrapKind357(j.kind)||j.kind==='install'&&isTrapKind357(j.furniture?.kind))&&adjacent(j));
}
