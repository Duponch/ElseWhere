import {LONGSWORD_ITEMS_270,isLongswordItem270,longswordMaterial270} from './longsword-content-270.ts';
import {SPEAR_ITEMS_272,isSpearItem272,spearMaterial272} from './spear-content-272.ts';
import type { WeaponItem } from './equipment-rules.ts';
import {MACE_ITEMS_269,isMaceItem269,maceMaterial269} from './mace-content-269.ts';
import {SMITHING_APPAREL_ITEMS267,isSmithingApparel267,smithingApparelStuff267,type SmithingApparel267,type ArmorMetal267} from './smithing-apparel-267.ts';

/** Recipe declarations must not load pawn health or learning during initialization. */
export type SmeltingRecipe='smelt-weapon'|'smelt-slag'|'smelt-apparel';
export const SMELTING_WORK_TICKS=160;
export const SMELTING_MAX_OUTPUT=250;
export const SMELTING_WEAPONS:readonly WeaponItem[]=Object.freeze(['revolver','bolt-action-rifle','emp-launcher','pump-shotgun','plasteel-knife',...MACE_ITEMS_269.filter(item=>maceMaterial269(item)!=='wood'),...LONGSWORD_ITEMS_270.filter(item=>longswordMaterial270(item)!=='wood'),...SPEAR_ITEMS_272.filter(item=>spearMaterial272(item)!=='wood')]);
export const SMELTING_APPAREL_INPUTS267=Object.freeze(SMITHING_APPAREL_ITEMS267.filter(item=>smithingApparelStuff267(item)!=='wood'));
export const SMELTING_APPAREL_MAX_OUTPUT267=425;
export const isSmeltingRecipe=(value:unknown):value is SmeltingRecipe=>value==='smelt-weapon'||value==='smelt-slag'||value==='smelt-apparel';
export const smeltingProduct=(item:WeaponItem|SmithingApparel267):ArmorMetal267=>{
 if(isSmithingApparel267(item)){const stuff=smithingApparelStuff267(item);if(stuff==='wood')throw Error('Wooden apparel is not smeltable');return stuff;}
 if(isSpearItem272(item)){const stuff=spearMaterial272(item);if(stuff==='wood')throw Error('Wooden weapon is not smeltable');return stuff;}
 if(isLongswordItem270(item)){const stuff=longswordMaterial270(item);if(stuff==='wood')throw Error('Wooden weapon is not smeltable');return stuff;}
 if(isMaceItem269(item)){const stuff=maceMaterial269(item);if(stuff==='wood')throw Error('Wooden weapon is not smeltable');return stuff;}
 return item==='plasteel-knife'?'plasteel':'steel';
};
