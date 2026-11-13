import {isColonist} from './affiliation.ts';
import type {Pawn,World} from './types.ts';

/** Core StorytellerUtilityPopulation and StoryWatcher_PopAdaptation, used
 * from schema 320 for the death of a downed non-colony humanlike.
 *
 * Population intent = popCurve(adjusted population), multiplied, when
 * positive, by adaptCurve(days since the last colonist gain). Cassandra's
 * curves are the clone's only storyteller. Adapt days advance by half a day
 * at every Core tick congruent to 171 modulo 30000 and reset to zero when a
 * colonist joins. */
const POP_CURVE=[[0,8],[1,2],[4,1],[7,.35],[11,0],[20,-1]] as const;
const ADAPT_CURVE=[[0,0],[8,1]] as const;
/** HealthTuning.DeathOnDownedChance_NonColonyHumanlikeFromPopulationIntentCurve
 * (unwavering prisoners, the Core default without Ideology). */
const DEATH_ON_DOWNED_CURVE=[[-1,.8667],[0,.8],[1,.5657],[2,.5],[8,.2632]] as const;
/** Medium (Adventure Story) enemyDeathOnDownedChanceFactor. */
const DIFFICULTY_FACTOR=1;
const PRISONER_VALUE=.5;

export function curve320(x:number,points:readonly (readonly [number,number])[]):number {
  if(x<=points[0]![0])return points[0]![1];
  for(let i=1;i<points.length;i++){const [bx,by]=points[i]!,[ax,ay]=points[i-1]!;if(x<=bx)return ay+(by-ay)*(x-ax)/(bx-ax);}
  return points[points.length-1]![1];
}
/** Free colonists count 1, prisoners of the colony 0.5, alive, on every map
 * and in the active caravan. */
export function adjustedPopulation320(w:World):number {
  let total=0;const seen=new Set<number>();
  const count=(p:Pawn)=>{
    if(seen.has(p.id)||p.state==='dead')return;seen.add(p.id);
    if(p.prisoner)total+=PRISONER_VALUE;else if(isColonist(p))total+=1;
  };
  for(const p of w.pawns)count(p);
  const group=w.group as {members?:Pawn[]}|undefined;
  for(const p of group?.members??[])count(p);
  for(const site of (w.worldMaps?.sites??[]) as {map?:{pawns?:Pawn[]}}[])for(const p of site.map?.pawns??[])count(p);
  return total;
}
/** Core half-day steps since the last colonist gain (or the game start). */
export function populationAdaptDays320(w:World):number {
  const now=w.tick*10,gain=w.populationGainCore320??0,steps=(core:number)=>Math.floor((core-171)/30000);
  return Math.max(0,steps(now)-steps(gain))*.5;
}
export function populationIntent320(w:World):number {
  const intent=curve320(adjustedPopulation320(w),POP_CURVE);
  return intent>0?intent*curve320(populationAdaptDays320(w),ADAPT_CURVE):intent;
}
export const deathOnDownedChance320=(w:World):number=>curve320(populationIntent320(w),DEATH_ON_DOWNED_CURVE)*DIFFICULTY_FACTOR;
/** Every real colonist gain resets the adaptation (Core GainedColonist). */
export function notePopulationGain320(w:World):void {if(w.schemaVersion>=320)w.populationGainCore320=w.tick*10;}
/** A non-colony humanlike (raider, visitor, trader) violently downed, not a
 * prisoner of the colony. */
export const deathOnDownedEligible320=(w:World,p:Pawn):boolean=>w.schemaVersion>=320&&!isColonist(p)&&!p.prisoner;
export function validPopulationGain320(value:unknown,version:number,tick:number):boolean {
  return value===undefined||version>=320&&Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=tick*10;
}
