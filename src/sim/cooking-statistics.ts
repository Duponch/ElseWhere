import { pawnBody } from './health-rules.ts';
import { learnSkill,type SkillRecord } from './skills.ts';
import { SCHEMA_VERSION,type Pawn } from './types.ts';

export const cookingSkill=(pawn:Pawn):SkillRecord=>pawn.skills.cooking??{level:0,xp:0,dailyXp:0,passion:0};
/** Core CookingSpeed combines skill and capacities into a score before its curve.
 * Environment factors are supplied independently by the station. */
export function cookingSpeed(pawn:Pawn,version:number=SCHEMA_VERSION):number {
  const c=pawnBody(pawn).capacities;
  const score=Math.max(-20,Math.min(20,cookingSkill(pawn).level+16*(Math.min(1.5,c.manipulation)-1)+4*(Math.min(1.5,c.sight)-1)));
  return cookSpeedCurve315(score,version);
}
/** Core CookSpeed postProcessCurve (-20, 0.01) (0, 0.4) (20, 1.6), then its
 * minValue 0.1, from schema 315; the older slope below 0 was 0.015. */
export function cookSpeedCurve315(score:number,version:number=SCHEMA_VERSION):number {
  if(score<0)return version>=315?Math.max(.1,.4+.0195*score):.4+.015*score;
  return .4+.06*score;
}
export function butcherySpeed(pawn:Pawn):number {
  const c=pawnBody(pawn).capacities;
  return Math.max(.1,(.4+.06*cookingSkill(pawn).level)*c.manipulation*(.6+.4*Math.min(1,c.sight)));
}
export function butcheryEfficiency(pawn:Pawn):number {
  const c=pawnBody(pawn).capacities;
  return Math.max(0,Math.min(1.5,(.75+.025*cookingSkill(pawn).level)*(.1+.9*c.manipulation)*(.6+.4*Math.min(1,c.sight))));
}
/** Core RoundRandom draws even for an integer; order is meat then leather. */
export function roundYield(value:number,random:()=>number):number {
  const whole=Math.floor(value),fraction=value-whole;
  return whole+(random()<fraction?1:0);
}

/** Completion learning is projected so a blocked product never advances XP. */
export function completedCookingSkill(pawn:Pawn,workTicks:number):SkillRecord {
  const skill={...cookingSkill(pawn)},worker={...pawn,skills:{...pawn.skills,cooking:skill}};
  learnSkill(skill,workTicks*1000,worker);return skill;
}
