import {ANIMAL_EGG_CONTENT_256,eggSpeciesForItem256,type EggSpecies256} from './animal-egg-content-v256.ts';
import {ANIMAL_EGG_ITEM_DEFINITIONS_256} from './animal-egg-items-v256.ts';

/** Schema 353: Core 1.6 cooks eggs and insect jelly. Both are AnimalProductRaw,
 * a child of FoodRaw: the simple meal takes any FoodRaw, the fine, lavish and
 * survival meals and kibble take them in their "protein" ingredient (MeatRaw +
 * AnimalProductRaw), the vegetarian meals with the plants. Pemmican and the
 * carnivore meals disallow AnimalProductRaw. Paraphrased facts, no def text. */
export const COOKING_INGREDIENT_SCHEMA_353=353;
const SPECIES=Object.keys(ANIMAL_EGG_CONTENT_256) as EggSpecies256[];
/** Core ThingCategory EggsUnfertilized, in this game's species order. */
export const COOKING_UNFERTILIZED_EGGS_353=Object.freeze(SPECIES.map(s=>ANIMAL_EGG_CONTENT_256[s].unfertilizedItem));
/** Core ThingCategory EggsFertilized. */
export const COOKING_FERTILIZED_EGGS_353=Object.freeze(SPECIES.map(s=>ANIMAL_EGG_CONTENT_256[s].fertilizedItem));
export type CookingEgg353=typeof COOKING_UNFERTILIZED_EGGS_353[number]|typeof COOKING_FERTILIZED_EGGS_353[number];
/** The animal products a recipe gains at 353, appended after its older inputs. */
export const COOKING_ANIMAL_PRODUCTS_353=Object.freeze([...COOKING_UNFERTILIZED_EGGS_353,...COOKING_FERTILIZED_EGGS_353,'insect-jelly'] as const);
export type CookingAnimalProduct353=CookingEgg353|'insect-jelly';
const PRODUCTS=new Set<unknown>(COOKING_ANIMAL_PRODUCTS_353),FERTILIZED=new Set<unknown>(COOKING_FERTILIZED_EGGS_353);
export const isCookingAnimalProduct353=(value:unknown):value is CookingAnimalProduct353=>PRODUCTS.has(value);
/** Core CookMealBase and Make_Kibble defaultIngredientFilter: fertilized eggs
 * and insect jelly are admitted by the recipe but refused by a new bill until
 * the player allows them; unfertilized eggs are allowed. */
export const cookingDefaultAllowed353=(item:unknown):boolean=>!FERTILIZED.has(item)&&item!=='insect-jelly';
/** The meal and kibble recipes whose Core filters include AnimalProductRaw. */
export const COOKING_ANIMAL_PRODUCT_RECIPES_353=Object.freeze(['simple-meal','cook-simple-meal-bulk','fine-meal','cook-fine-meal-bulk','lavish-meal','cook-lavish-meal-bulk','cook-survival-meal','vegetarian-fine-meal','cook-vegetarian-fine-meal-bulk','vegetarian-lavish-meal','cook-vegetarian-lavish-meal-bulk','make-kibble'] as const);
const RECIPES=new Set<unknown>(COOKING_ANIMAL_PRODUCT_RECIPES_353);
export const cooksAnimalProducts353=(recipe:unknown):boolean=>RECIPES.has(recipe);
/** Recipe quotas count units of 0.05 nutrition (Core IngredientValueGetter_
 * Nutrition). Every older ingredient, milk and insect jelly is one unit; an
 * egg is its Core nutrition: 0.25 → 5, 0.5 → 10, the fertilized ostrich 0.6 → 12. */
export function cookingUnitValue353(item:unknown):number {
  const species=eggSpeciesForItem256(item);
  return species?ANIMAL_EGG_ITEM_DEFINITIONS_256[item as keyof typeof ANIMAL_EGG_ITEM_DEFINITIONS_256].nutrition/5:1;
}
/** Core WorkGiver_DoBill AllowMix takes ceil(remaining / value) of each thing,
 * so only the last one may overshoot the quota. A quota is met when the units
 * reach it and the largest thing taken is not superfluous. With one-unit
 * ingredients only, this is exactly the older `units === required`. */
export function nutritionQuotaMet353(units:number,largest:number,required:number):boolean {
  return largest<=1?units===required:units>=required&&units-largest<required;
}
/** The whole ingredient list against one total: same rule. */
export function nutritionTotalMatches353(ingredients:readonly {item:unknown;quantity:number}[],required:number):boolean {
  let units=0,largest=0;
  for(const ingredient of ingredients){const unit=cookingUnitValue353(ingredient.item);units+=ingredient.quantity*unit;if(unit>largest)largest=unit;}
  return nutritionQuotaMet353(units,largest,required);
}
