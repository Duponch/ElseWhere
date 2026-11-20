import { ANIMAL_MEAT_ITEMS,isAnimalMeat } from './biome-items.ts';
import {COOKING_ANIMAL_PRODUCTS_353,cookingUnitValue353,isCookingAnimalProduct353,nutritionQuotaMet353} from './cooking-ingredients-353.ts';
import type { Structure } from './types.ts';

export const KIBBLE_RECIPE='make-kibble' as const;
export const KIBBLE_SCHEMA_VERSION=227;
export const KIBBLE_GROUP_UNITS=20,KIBBLE_INPUT_UNITS=40,KIBBLE_WORK_TICKS=45,KIBBLE_OUTPUT_UNITS=50;
export const KIBBLE_VEGETABLE_INPUTS=['raw-fungus','rice','berries','potato','corn','agave-fruit','hay'] as const;
export const KIBBLE_PROTEIN_INPUTS=['milk',...ANIMAL_MEAT_ITEMS] as const;
/** Core Make_Kibble protein is MeatRaw + AnimalProductRaw: schema 353 appends
 * the eggs and insect jelly after the older inputs (cooking-bills gates them). */
export const KIBBLE_INPUTS=[...KIBBLE_PROTEIN_INPUTS,...KIBBLE_VEGETABLE_INPUTS,...COOKING_ANIMAL_PRODUCTS_353] as const;
export const isKibbleRecipe=(value:unknown):value is typeof KIBBLE_RECIPE=>value===KIBBLE_RECIPE;
/** Separate from human-meal categories: hay never enters their shared group. */
export function kibbleIngredientGroup(item:string):'protein'|'vegetable'|null {
  if(item==='milk'||isAnimalMeat(item)||isCookingAnimalProduct353(item))return 'protein';
  return (KIBBLE_VEGETABLE_INPUTS as readonly string[]).includes(item)?'vegetable':null;
}
/** Each input unit contributes .05 nutrition; both independent quotas are 1.0.
 * An egg counts its own nutrition (schema 353, cookingUnitValue353). */
export function validKibbleIngredients(parts:readonly {item:string;quantity:number}[]):boolean {
  let protein=0,vegetable=0,largest=0;
  for(const part of parts){
    if(!part||typeof part!=='object'||typeof part.item!=='string'||!Number.isSafeInteger(part.quantity)||part.quantity<=0)return false;
    const group=kibbleIngredientGroup(part.item);
    if(group==='protein'){const unit=cookingUnitValue353(part.item);protein+=part.quantity*unit;if(unit>largest)largest=unit;}
    else if(group==='vegetable')vegetable+=part.quantity;
    else return false;
  }
  return nutritionQuotaMet353(protein,largest,KIBBLE_GROUP_UNITS)&&vegetable===KIBBLE_GROUP_UNITS;
}
/** The spot's .7 recipe efficiency affects output, never CookSpeed or quotas. */
export const kibbleOutputUnits=(station:Pick<Structure,'kind'>):number=>station.kind==='butcher-spot'?35:50;
