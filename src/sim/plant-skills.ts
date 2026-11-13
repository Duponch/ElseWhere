import { HEALTHY_BODY, type BodyAssessment } from './body-capacities.ts';
import { pawnBody, physicalWorkFactor } from './health-rules.ts';
import { learnSkill, type SkillRecord } from './skills.ts';
import { effectiveSkillLevel } from './work-types.ts';
import { SCHEMA_VERSION, type Pawn } from './types.ts';

/** Missing on historical pawns until their first actual plant-work tick. */
const NEUTRAL_PLANTS: Readonly<SkillRecord> = Object.freeze({level:8,xp:0,dailyXp:0,passion:0});
const HARVEST_YIELD_BY_LEVEL = Object.freeze([
  .60,.70,.75,.80,.85,.90,.95,.975,1,1.01,1.02,
  1.03,1.04,1.05,1.06,1.07,1.08,1.10,1.12,1.13,1.13,
]);
/** Core PlantHarvestYield values per level from schema 315: levels 17 to 19
 * were shifted by one level (1.10/1.12/1.13 instead of 1.09/1.10/1.12). */
const HARVEST_YIELD_BY_LEVEL_315 = Object.freeze([
  .60,.70,.75,.80,.85,.90,.95,.975,1,1.01,1.02,
  1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.10,1.12,1.13,
]);

export const plantSkill = (pawn:Pawn):Readonly<SkillRecord> => pawn.skills.plants??NEUTRAL_PLANTS;

/** PlantWorkSpeed stat, excluding light and the historical job duration. */
export function plantWorkSpeed(pawn:Pawn,body?:BodyAssessment):number {
  const physical=physicalWorkFactor(pawn,'plant',body);
  // An actor unable to manipulate cannot produce real work.
  if(physical<=0)return 0;
  return Math.max(.1,(.08+.115*effectiveSkillLevel(pawn,'plants',plantSkill(pawn).level))*physical);
}

/** PlantHarvestYield stat before growth, health, and stochastic rounding. */
export function plantHarvestYield(pawn:Pawn,body?:BodyAssessment,version=SCHEMA_VERSION):number {
  const capabilities=pawn.health?(body??pawnBody(pawn)).capacities:HEALTHY_BODY.capacities;
  const manipulation=1+.3*(capabilities.manipulation-1);
  const sight=1+.2*(Math.min(1,capabilities.sight)-1);
  return Math.max(0,Math.min(1.5,(version>=315?HARVEST_YIELD_BY_LEVEL_315:HARVEST_YIELD_BY_LEVEL)[effectiveSkillLevel(pawn,'plants',plantSkill(pawn).level)]!*manipulation*sight));
}

/** Call only after contact and executable work checks. Core 0.085 XP/tick
 * becomes 0.85 XP per local tick. Unproductive cutting passes learn=false. */
export function plantWorkRate(pawn:Pawn,body?:BodyAssessment,learn=true):number {
  if(physicalWorkFactor(pawn,'plant',body)<=0)return 0;
  if(learn){
    const skill=pawn.skills.plants??={level:8,xp:0,dailyXp:0,passion:0};
    learnSkill(skill,850,pawn);
  }
  return plantWorkSpeed(pawn,body);
}
