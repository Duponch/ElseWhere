import { WEAPON_QUALITIES,type WeaponQuality } from './equipment-rules.ts';
import type { SkillRecord } from './skills.ts';
import type { Pawn } from './types.ts';

const centers=[.7,1.1,1.5,1.8,2,2.2,2.4,2.6,2.8,2.95,3.1,3.25,3.4,3.5,3.6,3.7,3.8,3.9,4,4.1,4.2];
export const craftingSkill=(pawn:Pawn):SkillRecord=>pawn.skills.crafting??{level:0,xp:0,dailyXp:0,passion:0};
/** Core asymmetric Gaussian and masterwork reroll; from schema 360 an inspired
 * creator (Inspired_Creativity) adds two levels, up to legendary
 * (QualityUtility.AddLevels). The caller spends the inspiration.
 * PRNG supplied transactionally; no hidden cached normal or real-time state. */
export function craftingQuality(level:number,random:()=>number,inspired=false):WeaponQuality {
  const roll=(upper:number)=>{
    const z=Math.sqrt(-2*Math.log(Math.max(Number.MIN_VALUE,random())))*Math.sin(2*Math.PI*random());
    return Math.max(0,Math.min(5,Math.trunc(centers[level]!+z*(z<=0?.6:upper))));
  };
  let quality=roll(.8);if(quality===5&&random()<.5)quality=roll(.95);
  if(inspired)quality=Math.min(quality+2,WEAPON_QUALITIES.length-1);
  return WEAPON_QUALITIES[quality]!;
}

/** Dated Core stat part: penalty below 9 °C or above 35 °C. */
export const tailoringTemperatureFactor=(temperature:number):number=>temperature<9||temperature>35?.7:1;
