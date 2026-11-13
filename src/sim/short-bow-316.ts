/** Core 1.6 Bow_Short (schema 316). Pure data: no runtime imports, so items,
 * recipes and statistics can consume it without an initialization cycle.
 *
 * Recipe: 30 WoodLog, WorkToMake 2400 (no stuff factor), Crafting 2, at the
 * crafting spot and both smithies. Verb: range 22.9, warmup 1.35 s, cooldown
 * 1.65 s, accuracy .75/.65/.45/.25. Arrow_Short: 11 damage (Arrow: Cut, Crack
 * on solid parts), armor penetration 11 x 0.015, speed 44, default stopping
 * power 0.5. Melee: one "limb" tool, Blunt and Poke, power 9, cooldown 2 s.
 * Mass 0.8 kg, 100 hit points, value 30 x 1.2 + 2400 x 0.0036. */
export const SHORT_BOW_316='short-bow' as const;
export type ShortBow316=typeof SHORT_BOW_316;
export const SHORT_BOW_WORKPIECE_316='unfinished-bow' as const;
export const SHORT_BOW_RECIPE_316='make-short-bow' as const;
export const SHORT_BOW_UNITS_316=30;
/** Local ticks (Core WorkToMake / 10). */
export const SHORT_BOW_WORK_TICKS_316=240;
export const SHORT_BOW_SKILL_316=2;
export const SHORT_BOW_MASS_GRAMS_316=800;
export const SHORT_BOW_BASE_VALUE_316=SHORT_BOW_UNITS_316*1.2+2400*.0036;
export const SHORT_BOW_COLOR_316=0x9a6b3f;
export const SHORT_BOW_RANGED_316=Object.freeze({
 damage:11,armorPenetration:11*.015,accuracy:Object.freeze([.75,.65,.45,.25] as const),
 range:22.9,warmupCoreTicks:81,cooldownCoreTicks:99,projectileTilesPerCoreTick:44/100,stoppingPower:.5,
});
export const isShortBow316=(v:unknown):v is ShortBow316=>v===SHORT_BOW_316;
/** Impact fields of an arrow (Cut); a bullet adds none. */
export const arrowHit316=(weaponItem:unknown):{injury?:'cut'}=>weaponItem===SHORT_BOW_316?{injury:'cut'}:{};
