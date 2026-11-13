/** Shared numerical rates; local needs/rest retain their original wrappers. */
import { adultHungerFactor } from './items.ts';
import { malnutritionModifiers } from './malnutrition.ts';
import { parasiteHungerFactor306,parasiteRestFactor306 } from './parasites-306.ts';
import { TICKS_PER_DAY,type Pawn } from './types.ts';
export const HUNGER_PER_TICK=160/TICKS_PER_DAY;
export const REST_PER_TICK=95/TICKS_PER_DAY,LEGACY_REST_PER_TICK=.008;
export const BED_REST_PER_TICK=100/(TICKS_PER_DAY*10.5/24);
export const GROUND_REST_PER_TICK=BED_REST_PER_TICK*.8;
export const restFallFactor=(rest:number):number=>rest>=28?1:rest>=14?.7:rest>=1?.3:.6;
export function depletedHumanHunger(p:Pawn,legacy:boolean):number {
  return Math.max(0,p.hunger-(legacy?.015:HUNGER_PER_TICK*adultHungerFactor(p.hunger))*malnutritionModifiers(p.health?.malnutrition).hungerFactor*parasiteHungerFactor306(p.health));
}
/** factor: muscle parasites double the fall (schema 306). */
export function depletedHumanRest(rest:number,legacy:boolean,factor=1):number {
  return Math.max(0,rest-(legacy?LEGACY_REST_PER_TICK:REST_PER_TICK*restFallFactor(rest))*factor);
}
/** One application: never fall and gain in the same interval. Stationary/no
 * delivered bed uses the existing local ground .8 adaptation, not an old bedId. */
export function groupRestAfterInterval(p:Pawn,resting:boolean,legacy:boolean):number {
  return resting?Math.min(100,p.rest+GROUND_REST_PER_TICK):depletedHumanRest(p.rest,legacy,parasiteRestFactor306(p.health));
}
