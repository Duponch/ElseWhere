import {animalBodySize} from './animal-life.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {activeHiveInsect256} from './cave-hive-lord-256.ts';
import { hostileTo,activeThreat } from './affiliation.ts';
import { clearShotSegment,type ShotGrid } from './combat-space.ts';
import { captureWorldShotGrid } from './combat-world.ts';
import { carrierOf } from './rescue-state.ts';
import { violentWorkRefusal } from './colonist-backgrounds.ts';
import { isColonist,distanceSquared } from './affiliation.ts';
import type { Cell,Pawn,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import {sleepingTempleMech256} from './temple-mech-duty-256.ts';
import type { Mechanoid } from './mechanoid-state.ts';

export type LivingTarget=Pawn|WildAnimal|Mechanoid;
export type LivingTargetKey=`pawn:${number}`|`animal:${number}`|`mech:${number}`;
/** Internal geometry only. Original humans occupy the unpaid edge's source;
 * plain proposed Cells, animals and machines keep their existing semantics.
 * Borrow a Cell: no Pawn/World clone, lookup, interpolation or mutable cache. */
export function combatCell297(version:number,actor:Cell,atCore:number):Cell {
  if(!isCorePhysicalSchema297(version)||!('skills' in actor)||!('orders' in actor))return actor;
  const motion=(actor as Pawn).motion;
  return motion&&atCore<motion.end*10?motion.from:actor;
}
export const isAnimalTarget=(p:LivingTarget):p is WildAnimal=>'species' in p;
export const isMechanoidTarget=(p:LivingTarget):p is Mechanoid=>'mechKind' in p;
export const isPawnTarget=(p:LivingTarget):p is Pawn=>!isAnimalTarget(p)&&!isMechanoidTarget(p);
export const combatTarget=(w:World,id:number):LivingTarget|undefined=>w.pawns.find(p=>p.id===id)??(w.schemaVersion>=77?w.wildlife?.animals.find(a=>a.id===id):undefined)??(w.schemaVersion>=194?w.mechanoids?.find(m=>m.id===id):undefined);
export const combatTargetKey=(p:LivingTarget):LivingTargetKey=>`${isAnimalTarget(p)?'animal':isMechanoidTarget(p)?'mech':'pawn'}:${p.id}`;
/** Exact namespace lookup: a typed reference never turns into another owner. */
export function combatTargetByKey(w:World,key:LivingTargetKey):LivingTarget|undefined {
  const id=Number(key.slice(key.indexOf(':')+1)),target=combatTarget(w,id);
  return target&&combatTargetKey(target)===key?target:undefined;
}
/** Schema 318: an animal offers its real body size (Core ShotReport). */
export const combatTargetSize=(p:LivingTarget,version:number)=>isAnimalTarget(p)?(version>=318?animalBodySize(p):.2):1;
/** Hostile mechanical factions share one relation; mental hostility does not
 * turn another machine into an enemy of that faction. */
export function mechanoidEnemy(w:World,m:Mechanoid,t:LivingTarget):boolean {
  return !sleepingTempleMech256(m)&&t.id!==m.id&&!isMechanoidTarget(t)&&!['dead','downed'].includes(t.state)&&!t.health?.death
    &&(isAnimalTarget(t)?!!t.domestic||!!t.manhunter||activeHiveInsect256(t):!t.prisoner&&!carrierOf(w,t.id));
}
export const hostileTarget=(p:Pawn,t:LivingTarget)=>isAnimalTarget(t)?p.mental?.crisis?.kind==='berserk'||!!t.manhunter||activeHiveInsect256(t):isMechanoidTarget(t)?!p.prisoner||p.mental?.crisis?.kind==='berserk':hostileTo(p,t);
/** The same predicate owns civilian fleeing, defense and auto-order validity. */
export const activeCombatThreat=(t:LivingTarget)=>isAnimalTarget(t)?activeHiveInsect256(t)||!!t.manhunter&&!['dead','downed','sleeping'].includes(t.state):isMechanoidTarget(t)?!sleepingTempleMech256(t)&&t.state!=='dead'&&t.state!=='downed'&&!t.health?.death:activeThreat(t);
export const hostileCandidates=(w:World,p:Pawn,animals:readonly WildAnimal[]=w.wildlife?.animals??[]):LivingTarget[]=>[
  ...w.pawns.filter(t=>hostileTarget(p,t)&&activeCombatThreat(t)),
  ...animals.filter(t=>hostileTarget(p,t)&&activeCombatThreat(t)),
  ...(w.mechanoids??[]).filter(t=>hostileTarget(p,t)&&activeCombatThreat(t)),
];

export const retaliationPermission=(p:Pawn):boolean=>isColonist(p)&&!p.prisoner&&!p.draft&&!p.mental?.crisis&&!violentWorkRefusal(p)
  &&p.hostilityResponse==='attack'&&p.orders.active===null&&!p.orders.queue.length&&!p.priorityWork&&!p.equipmentTask
  &&!p.orbitalTrade&&!p.trade&&!p.cleaning?.forced&&!p.firefighting?.forced;
/** A real attempt establishes this short-lived threat even between allies.
 * It is distinct from faction hostility and cannot turn Flee/Ignore into Attack. */
export function meleeThreatTarget(w:World,p:Pawn|Mechanoid,core=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10,grid?:ShotGrid,readGrid?:()=>ShotGrid):LivingTarget|undefined {
  const threat=p.meleeThreat;if(!threat||core<threat.atCore||core-threat.atCore>400)return;
  const attacker=combatTarget(w,threat.attackerId);
  if(!attacker||attacker===p||['dead','downed','sleeping'].includes(attacker.state)||distanceSquared(combatCell297(Number(w.schemaVersion),p,core),combatCell297(Number(w.schemaVersion),attacker,core))>9||isPawnTarget(attacker)&&carrierOf(w,attacker.id))return;
  return clearShotSegment(grid??(readGrid?readGrid():captureWorldShotGrid(w)),combatCell297(Number(w.schemaVersion),p,core),combatCell297(Number(w.schemaVersion),attacker,core))?attacker:undefined;
}
