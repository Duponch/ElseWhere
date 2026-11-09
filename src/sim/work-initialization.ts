import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { schemaAtLeast } from './schema-range.ts';
import type { Pawn, WorkType } from './types.ts';
import { RIM_WORK_TYPES } from './work-givers-rimworld.ts';
import { effectiveSkillLevel } from './work-types.ts';

/** From schema 302, a human who joins the colony (a new game's colonists, an
 * arrival, a quest joiner, a rescued survivor, a recruited prisoner) receives
 * RimWorld's initial work settings. */
export const initializesWorkLikeCore302=schemaAtLeast(302);

/** Pawn_WorkSettings.EnableAndInitialize (Core 1.6), called when a human
 * joins the player faction. Every work type is first disabled. Among those
 * that do not always start active and that the pawn can do, the six with the
 * best average level of their relevant skills (3 when a type has none) are
 * enabled at priority 3, ties in definition order (a stable sort). The types
 * that always start active (firefighting, patient, bed rest, basic work,
 * hauling, cleaning) are enabled at 3 unless the pawn is incapable of them.
 * Smithing and Tailoring are set apart from Crafting. */
export function enableAndInitializeWork(pawn:Pawn):void {
  const level=(skill:Parameters<typeof effectiveSkillLevel>[1])=>effectiveSkillLevel(pawn,skill,pawn.skills[skill]?.level??0);
  const types=Object.values(RIM_WORK_TYPES);
  const priorities={} as Record<WorkType,number>;
  for(const type of types)priorities[type.work]=0;
  types.map((type,order)=>({type,order,average:type.skills.length?type.skills.reduce((sum,skill)=>sum+level(skill),0)/type.skills.length:3}))
    .filter(({type})=>!type.always&&!backgroundWorkRefusal(pawn,type.work))
    .sort((a,b)=>b.average-a.average||a.order-b.order)
    .slice(0,6)
    .forEach(({type})=>{priorities[type.work]=3;});
  for(const type of types)if(type.always&&!backgroundWorkRefusal(pawn,type.work))priorities[type.work]=3;
  pawn.priorities=priorities;
}
