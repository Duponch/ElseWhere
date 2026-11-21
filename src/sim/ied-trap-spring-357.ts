import { combatTargetByKey,isAnimalTarget,isPawnTarget,type LivingTarget,type LivingTargetKey } from './combat-target.ts';
import { healthRandom } from './health.ts';
import { IED_TRAPS_357,isIedSchema357,isIedTrapKind357,startIedWick357 } from './ied-traps-357.ts';
import { sendLetter352 } from './letters-352.ts';
import { carrierOf } from './rescue-state.ts';
import { animalCarrier } from './animal-rest-state.ts';
import { spikeTrapPhysicalCell,spikeTrapSpringChance } from './spike-trap-state.ts';
import type { BombInstigatorKey } from './mini-turret-state.ts';
import type { Structure,World } from './types.ts';

const present=(w:World,a:LivingTarget)=>a.state!=='dead'&&!a.health?.death&&('species'in a?!animalCarrier(w,a.id):'mechKind'in a||!carrierOf(w,a.id));
/** Core Building_Trap.CheckSpring + Building_TrapExplosive.SpringSub for a new
 * toucher: the pawn joins the touching list, one SpringChance roll (none at
 * 0 or 1), and a spring lights the CompExplosive wick (a no-op when it already
 * burns). The trap stays until the wick detonates it, so this never reports a
 * removed trap: the caller sees the contact or RNG change. A friendly spring
 * (the player's colonists and animals, its prisoners) sends Core's
 * LetterFriendlyTrapSprung as a negative letter. */
export function trySpringIedTrap357(w:World,s:Structure,key:LivingTargetKey,atCore:number):false {
  const actor=combatTargetByKey(w,key),state=s.spikeTrap;
  if(!isIedSchema357(w.schemaVersion)||!state||!isIedTrapKind357(s.kind)||!w.structures.includes(s)||!actor||!present(w,actor)||state.touching.includes(key))return false;
  const c=spikeTrapPhysicalCell(actor,atCore);if(c.x!==s.x||c.z!==s.z)return false;
  const chance=spikeTrapSpringChance(w,actor,s.kind),stream={rng:w.rng};
  const springs=chance>=1||chance>0&&healthRandom(stream)<chance;
  w.rng=stream.rng;state.touching.push(key);
  if(!springs||s.iedWick357)return false;
  startIedWick357(s,atCore,key as BombInstigatorKey,true);
  const friendly=isPawnTarget(actor)?(!actor.faction||actor.faction==='colony'||!!actor.prisoner):isAnimalTarget(actor)&&!!actor.domestic;
  const name=isPawnTarget(actor)?actor.name:isAnimalTarget(actor)?'un animal de la colonie':'un mécanoïde';
  if(friendly)sendLetter352(w,{cls:'negative',title:`Piège déclenché par ${name}`,text:`${name} a déclenché un ${IED_TRAPS_357[s.kind].label.toLowerCase()} de la colonie. La mèche brûle : l’explosion suit dans un quart de seconde.`,targets:[{kind:'cell',x:s.x,z:s.z}]});
  w.events.push({tick:w.tick,type:'job',message:`${IED_TRAPS_357[s.kind].label} déclenché${friendly?` par ${name}`:''} · mèche allumée.`});if(w.events.length>80)w.events.shift();
  return false;
}
