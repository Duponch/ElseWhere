/** Schema 375: Core Apparel_FlakPants becomes craftable (ThingDefs_Misc/
 * Apparel_Various.xml, parent ArmorMachineableBase). The pants themselves
 * exist since schema 256 (Classic scenario gear); only their recipe is new.
 *
 * Core facts used: recipeUsers TableMachining, researchPrerequisite
 * FlakArmor, workSkill Crafting with skillRequirements Crafting 4,
 * WorkToMake 9 000 (900 local ticks, one local tick being ten Core ticks),
 * costList Cloth 30, Steel 60, ComponentIndustrial 1, displayPriority 230
 * (after the flak vest's 220). Core shares the UnfinishedTechArmor workpiece
 * with the flak vest; Elsewhere keeps one workpiece per flak recipe, so the
 * pants get their own `unfinished-flak-pants`.
 *
 * Older saves never offer the recipe, its workpiece or a bill: nothing is
 * granted by the migration, which changes only the number. */
export const FLAK_PANTS_SCHEMA_375=375;
export const isFlakPantsSchema375=(version:number):boolean=>Number.isSafeInteger(version)&&version>=FLAK_PANTS_SCHEMA_375;
export const FLAK_PANTS_RECIPE_375='make-flak-pants' as const;
export const FLAK_PANTS_WORKPIECE_375='unfinished-flak-pants' as const;
