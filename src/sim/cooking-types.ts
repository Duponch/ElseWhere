import { ANIMAL_MEAT_ITEMS } from './biome-items.ts';
import type { ProductionIngredient, ProductionRecipe } from './production-recipes.ts';
import type { Cell } from './types.ts';
import type { WeaponQuality } from './equipment-rules.ts';

export interface SmeltFilter {
  hpMin:number;hpMax:number;
  qualityMin:WeaponQuality;qualityMax:WeaponQuality;
}
export interface CremationFilter {
  colonists:boolean;strangers:boolean;
  fresh:boolean;rotting:boolean;desiccated:boolean;
}
/** V278: filters finished apparel counted toward a reserve, never ingredients
 * or the quality roll. Absence preserves the historical bill counter. */
export interface ApparelCountFilter278 {
  hpMin:number;hpMax:number;
  qualityMin:WeaponQuality;qualityMax:WeaponQuality;
  includeEquipped:boolean;
}

export type RawIngredient = 'raw-fungus' | 'rice' | 'berries' | 'agave-fruit' | typeof ANIMAL_MEAT_ITEMS[number] | 'potato' | 'corn';
export interface CookingBill {
  id:number;
  recipe:ProductionRecipe;
  mode:'times'|'until'|'forever';
  target:number;
  suspended:boolean;
  filters:Partial<Record<ProductionIngredient,boolean>>;
  radius:number;
  destination:'stockpile'|'drop';
  /** Shared HP/quality filter for whole weapons and apparel destruction. */
  smeltFilter?:SmeltFilter;
  cremationFilter?:CremationFilter;
  apparelCount?:ApparelCountFilter278;
  worker?:import('./bill-worker-state-283.ts').BillWorkerPolicy283;
  reservePause?:import('./bill-pause-state-289.ts').BillReservePause289;
}
// Admission has its own command: changing it must not cancel engaged work.
export type BillSettings=Omit<CookingBill,'id'|'recipe'|'worker'|'reservePause'>;
export interface CookingIngredient {
  pileId:number;
  item:ProductionIngredient;
  quantity:number;
  stage:'source'|'held'|'placed';
  cell:Cell;
}
/** Historical serialized envelope shared by meal and material production. */
export interface CookingTask {
  recipe?:'tshirt'|'jacket'|'make-short-bow'|'make-recurve-bow'|'make-greatbow'|'make-pump-shotgun'|'make-prosthetic-arm'|'make-prosthetic-leg'|'make-spear'|'make-longsword'|'make-mace'|'make-plasteel-knife'|'make-plate-armor'|'make-simple-helmet'|'smelt-apparel'|'brew-wort'|'smelt-slag'|'burn-apparel'|'make-pemmican'|'make-kibble'|'cremate-corpse'|'smelt-weapon'|'chemfuel-from-wood'|'chemfuel-from-organics'|'make-medicine'|'smash-mechanoid'|'shred-mechanoid'|'cook-survival-meal'|'small-sculpture'|'large-sculpture'|'make-revolver'|'make-bolt-action-rifle'|'make-emp-launcher'|'make-flak-vest'|'make-flak-helmet'|'make-recon-helmet'|'make-recon-armor'|'make-component'|'make-advanced-component'|'stone-blocks'|'tribalwear'|'shirt'|'pants'|'duster'|'parka'|'tuque'|'butcher-creature'|'fine-meal'|'cook-fine-meal-bulk'|'vegetarian-fine-meal'|'cook-vegetarian-fine-meal-bulk'|'carnivore-fine-meal'|'cook-carnivore-fine-meal-bulk'|'lavish-meal'|'cook-lavish-meal-bulk'|'vegetarian-lavish-meal'|'cook-vegetarian-lavish-meal-bulk'|'cook-carnivore-lavish-meal'|'cook-carnivore-lavish-meal-bulk'|'cook-simple-meal-bulk';
  stationId:number;
  billId:number;
  spot:Cell;
  actionCell:Cell;
  phase:'gather'|'work'|'output'|'interrupted';
  ingredients:CookingIngredient[];
  /** V36: integer neutral work units (10 000 per local work tick). */
  progress:number;
  /** V79: actual local work ticks; V206 medicine learns Intellectual at completion. */
  workTicks?:number;
  productId:number|null;
  storageId:number|null;
  storageQuantity?:number;
}
