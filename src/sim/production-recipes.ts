import {isProstheticRecipe273,prostheticProduct273,PROSTHETIC_PRODUCTION_WORK_TICKS_273,type ProstheticRecipe273} from './prosthetic-content-273.ts';
import {isSmithingRecipe267,smithingMaterials267,smithingMaterialAllowed267,smithingProduct267,smithingWorkTotal267,smithingMaterialFromIngredients267,type SmithingMaterial267,type SmithingRecipe267,type SmithingWorkpiece267} from './smithing-content-267.ts';
import {BURN_APPAREL_INPUTS,BURN_APPAREL_WORK_TICKS,isBurnApparelRecipe} from './burn-apparel-content.ts';
import {PEMMICAN_INPUTS,PEMMICAN_INPUT_UNITS,PEMMICAN_WORK_TICKS,PEMMICAN_OUTPUT_UNITS,isPemmicanRecipe} from './pemmican-content.ts';
import {ART_MATERIALS,isArtRecipe,artWorkTotal,type ArtMaterial,type ArtRecipe} from './art-rules.ts';
import { isSmeltingRecipe,SMELTING_WORK_TICKS,SMELTING_MAX_OUTPUT,SMELTING_WEAPONS,SMELTING_APPAREL_INPUTS267,SMELTING_APPAREL_MAX_OUTPUT267,smeltingProduct } from './smelting-content.ts';
import { CREMATION_INPUTS,CREMATION_WORK_TICKS,isCremationRecipe,type CremationRecipe } from './cremation-content.ts';
import type { WeaponItem } from './equipment-rules.ts';
import { KIBBLE_INPUTS,KIBBLE_INPUT_UNITS,KIBBLE_WORK_TICKS,KIBBLE_OUTPUT_UNITS,isKibbleRecipe } from './fodder-recipes.ts';
import { ANIMAL_MEAT_ITEMS, ANIMAL_CORPSE_ITEMS, ANIMAL_LEATHER_ITEMS, isAnimalMeat } from './biome-items.ts';
import { APPAREL_MATERIALS,isApparelMaterial,apparelItemFor, type ApparelItem, type ApparelMaterial } from './apparel-rules.ts';
import { isStove, isButcherStation } from './food-workstations.ts';
import { ITEM_DEFINITIONS,MECH_CORPSE_ITEMS,type MechCorpseItem,type ItemId } from './items.ts';
import type { CookingBill, CookingTask } from './cooking-types.ts';
import type { Structure, WorkType, World } from './types.ts';

export const STONE_INPUTS = ['granite-chunk','limestone-chunk','marble-chunk','sandstone-chunk','slate-chunk'] as const;
export type StoneIngredient = typeof STONE_INPUTS[number];
export const TAILORING_RECIPES = ['tribalwear','shirt','pants','duster','parka','tuque'] as const;
export type TailoringRecipe = typeof TAILORING_RECIPES[number];
export type TailoringMaterial = ApparelMaterial;
export type UnfinishedApparelItem = 'unfinished-tribalwear'|'unfinished-shirt'|'unfinished-pants'|'unfinished-duster'|'unfinished-parka'|'unfinished-tuque';
export type ProductionIngredient = 'unfinished-prosthetic'|SmithingMaterial267|SmithingWorkpiece267|'hops'|'slag-steel-chunk'|ApparelItem|'hay'|'human-corpse'|WeaponItem|'herbal-medicine'|'neutroamine'|MechCorpseItem| ArtMaterial|'unfinished-sculpture'|'steel'|'component'|'advanced-component'|'plasteel'|'uranium'|'gold'|'unfinished-gun'|'unfinished-flak-vest'|'unfinished-flak-helmet'|'unfinished-recon-helmet'|'unfinished-recon-armor'|'unfinished-component'|'raw-fungus'|'rice'|'berries'|'milk'|'agave-fruit'|'potato'|'corn'|typeof ANIMAL_MEAT_ITEMS[number]|typeof ANIMAL_CORPSE_ITEMS[number]|TailoringMaterial|UnfinishedApparelItem|StoneIngredient;
export type FlakRecipe='make-flak-vest'|'make-flak-helmet'|'make-recon-helmet'|'make-recon-armor';
export const isFlakRecipe=(v:unknown):v is FlakRecipe=>v==='make-flak-vest'||v==='make-flak-helmet'||v==='make-recon-helmet'||v==='make-recon-armor';
export const FLAK_REQUIREMENTS={cloth:30,steel:60,component:1,skill:4} as const;
export const FLAK_HELMET_REQUIREMENTS={steel:40,component:2,plasteel:10,skill:5} as const;
export const RECON_HELMET_REQUIREMENTS={plasteel:30,'advanced-component':1,skill:6} as const;
export const RECON_ARMOR_REQUIREMENTS={plasteel:80,'advanced-component':3,uranium:10,skill:6} as const;
export const flakRequirements=(recipe:FlakRecipe)=>recipe==='make-flak-vest'?FLAK_REQUIREMENTS:recipe==='make-flak-helmet'?FLAK_HELMET_REQUIREMENTS:recipe==='make-recon-armor'?RECON_ARMOR_REQUIREMENTS:RECON_HELMET_REQUIREMENTS;
export const flakWorkpiece=(recipe:FlakRecipe)=>recipe==='make-flak-vest'?'unfinished-flak-vest':recipe==='make-flak-helmet'?'unfinished-flak-helmet':recipe==='make-recon-armor'?'unfinished-recon-armor':'unfinished-recon-helmet';
export type ComponentRecipe='make-component'|'make-advanced-component';
export const isComponentRecipe=(v:unknown):v is ComponentRecipe=>v==='make-component'||v==='make-advanced-component';
export const ADVANCED_COMPONENT_REQUIREMENTS={component:1,steel:20,plasteel:10,gold:3,skill:8} as const;
export type AdvancedComponentMaterial=Exclude<keyof typeof ADVANCED_COMPONENT_REQUIREMENTS,'skill'>;
export type ProductionRecipe = ProstheticRecipe273|SmithingRecipe267|'smelt-apparel'|'brew-wort'|'smelt-slag'|'burn-apparel'|'make-pemmican'|'make-kibble'|CremationRecipe|'smelt-weapon'|BiofuelRecipe|'make-medicine'|'smash-mechanoid'|'shred-mechanoid'|ArtRecipe|GunRecipe|FlakRecipe|ComponentRecipe|'simple-meal'|'cook-simple-meal-bulk'|'fine-meal'|'cook-fine-meal-bulk'|'vegetarian-fine-meal'|'cook-vegetarian-fine-meal-bulk'|'carnivore-fine-meal'|'cook-carnivore-fine-meal-bulk'|'lavish-meal'|'cook-lavish-meal-bulk'|'vegetarian-lavish-meal'|'cook-vegetarian-lavish-meal-bulk'|'cook-carnivore-lavish-meal'|'cook-carnivore-lavish-meal-bulk'|'cook-survival-meal'|'stone-blocks'|TailoringRecipe|'butcher-creature';

export type BiofuelRecipe='chemfuel-from-wood'|'chemfuel-from-organics';
export const isBiofuelRecipe=(value:unknown):value is BiofuelRecipe=>value==='chemfuel-from-wood'||value==='chemfuel-from-organics';
export const BIOFUEL_INITIAL_ORGANICS=['raw-fungus','rice','berries','potato','corn','agave-fruit'] as const;
export const BIOFUEL_ORGANIC_INPUTS=[...BIOFUEL_INITIAL_ORGANICS,'hops','milk',...ANIMAL_MEAT_ITEMS] as const;
/** Item nutrition uses hundredths: Core's organic quota is 3.5 nutrition.
 * Each of the thirteen delivered raw foods supplies five hundredths. */
export const BIOFUEL_ORGANIC_NUTRITION=350;
export function biofuelNutrition(parts:readonly {item:string;quantity:number}[]):number {
  return parts.reduce((sum,part)=>sum+((BIOFUEL_ORGANIC_INPUTS as readonly string[]).includes(part.item)?ITEM_DEFINITIONS[part.item as typeof BIOFUEL_ORGANIC_INPUTS[number]].nutrition*part.quantity:0),0);
}
export function validBiofuelIngredients(recipe:ProductionRecipe,parts:readonly {item:string;quantity:number}[]):boolean {
  if(!isBiofuelRecipe(recipe))return true;
  if(!parts.length||parts.some(part=>!Number.isSafeInteger(part.quantity)||part.quantity<=0))return false;
  return recipe==='chemfuel-from-wood'?parts.every(part=>part.item==='wood')&&parts.reduce((sum,part)=>sum+part.quantity,0)===70
    :parts.every(part=>(BIOFUEL_ORGANIC_INPUTS as readonly string[]).includes(part.item))&&biofuelNutrition(parts)===BIOFUEL_ORGANIC_NUTRITION;
}

export const MEDICINE_REQUIREMENTS={'herbal-medicine':1,neutroamine:1,cloth:3} as const;
/** Distinct material quotas cannot be replaced by five arbitrary admitted units. */
export function validMedicineIngredients(recipe:ProductionRecipe,parts:readonly {item:string;quantity:number}[]):boolean {
  return recipe!=='make-medicine'||parts.every(part=>Object.hasOwn(MEDICINE_REQUIREMENTS,part.item)&&Number.isSafeInteger(part.quantity)&&part.quantity>0)
    &&(Object.keys(MEDICINE_REQUIREMENTS) as (keyof typeof MEDICINE_REQUIREMENTS)[]).every(item=>parts.reduce((sum,part)=>sum+(part.item===item?part.quantity:0),0)===MEDICINE_REQUIREMENTS[item]);
}

/** Local raw foods all provide 0.05 nutrition per unit. Core's mixed fine and
 * lavish meals ask 0.25 and 0.5 from each group; milk is an animal product. */
export function fineMealIngredientGroup(item:ProductionIngredient):'protein'|'vegetable'|null {
  if(item==='milk'||isAnimalMeat(item))return 'protein';
  return item==='raw-fungus'||item==='rice'||item==='berries'||item==='potato'||item==='corn'||item==='agave-fruit'?'vegetable':null;
}
/** Core packaged survival meal: 0.3 nutrition in each distinct raw group. */
export function validSurvivalMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validMixedMealIngredients(ingredients,6);
}
export function validFineMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validMixedMealIngredients(ingredients,5);
}
export function validFineMealBulkIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validMixedMealIngredients(ingredients,20);
}
export function validLavishMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validMixedMealIngredients(ingredients,10);
}
/** Core's four-portion mixed lavish bill asks 2.0 nutrition from each group. */
export function validLavishMealBulkIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validMixedMealIngredients(ingredients,40);
}
/** One 0.75 nutrition quota: local plants and milk each provide 0.05. */
export function validVegetarianFineMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validVegetarianMealIngredients(ingredients,15);
}
/** Core's four-portion vegetarian fine bill asks one 3.0 nutrition quota. */
export function validVegetarianFineMealBulkIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validVegetarianMealIngredients(ingredients,60);
}
/** One 1.25 nutrition quota: raw plants and milk, never meat. */
export function validVegetarianLavishMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validVegetarianMealIngredients(ingredients,25);
}
/** Core's four-portion vegetarian lavish bill asks one 5.0 nutrition quota. */
export function validVegetarianLavishMealBulkIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validVegetarianMealIngredients(ingredients,100);
}
function validVegetarianMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[],required:number):boolean {
  let units=0;
  for(const ingredient of ingredients){
    if(!Number.isSafeInteger(ingredient.quantity)||ingredient.quantity<=0||ingredient.item!=='milk'&&fineMealIngredientGroup(ingredient.item)!=='vegetable')return false;
    units+=ingredient.quantity;
  }
  return units===required;
}
/** One 0.75 nutrition quota: only raw animal meat, never milk or plants. */
export function validCarnivoreFineMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validCarnivoreMealIngredients(ingredients,15);
}
/** Core's four-portion carnivore fine bill asks one 3.0 nutrition meat quota. */
export function validCarnivoreFineMealBulkIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validCarnivoreMealIngredients(ingredients,60);
}
/** One 1.25 nutrition quota: only raw animal meat, never milk or plants. */
export function validCarnivoreLavishMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validCarnivoreMealIngredients(ingredients,25);
}
/** Core's four-portion carnivore lavish bill asks one 5.0 nutrition meat quota. */
export function validCarnivoreLavishMealBulkIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[]):boolean {
  return validCarnivoreMealIngredients(ingredients,100);
}
function validCarnivoreMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[],required:number):boolean {
  let units=0;
  for(const ingredient of ingredients){
    if(!Number.isSafeInteger(ingredient.quantity)||ingredient.quantity<=0||!isAnimalMeat(ingredient.item))return false;
    units+=ingredient.quantity;
  }
  return units===required;
}
export const mixedMealGroupUnits=(recipe:ProductionRecipe):number=>isPemmicanRecipe(recipe)?5:recipe==='cook-survival-meal'?6:recipe==='fine-meal'?5:recipe==='cook-fine-meal-bulk'?20:recipe==='lavish-meal'?10:recipe==='cook-lavish-meal-bulk'?40:0;
function validMixedMealIngredients(ingredients:readonly {item:ProductionIngredient;quantity:number}[],required:number):boolean {
  let protein=0,vegetable=0;
  for(const ingredient of ingredients) {
    if(!Number.isSafeInteger(ingredient.quantity)||ingredient.quantity<=0)return false;
    const group=fineMealIngredientGroup(ingredient.item);
    if(group==='protein')protein+=ingredient.quantity;
    else if(group==='vegetable')vegetable+=ingredient.quantity;
    else return false;
  }
  return protein===required&&vegetable===required;
}

export type GunRecipe='make-revolver'|'make-bolt-action-rifle'|'make-emp-launcher';
export const isGunRecipe=(v:unknown):v is GunRecipe=>v==='make-revolver'||v==='make-bolt-action-rifle'||v==='make-emp-launcher';
export const GUN_REQUIREMENTS={ 'make-revolver':{steel:30,component:2,skill:3}, 'make-bolt-action-rifle':{steel:60,component:3,skill:5},'make-emp-launcher':{steel:75,component:8,skill:4} } as const;
export const PRODUCTION_RECIPES = Object.freeze({
  'make-prosthetic-arm':Object.freeze({label:'Fabriquer un bras prothétique',station:'machining-table',work:'craft',inputs:['steel','component'] as readonly ProductionIngredient[],units:44,workTicks:PROSTHETIC_PRODUCTION_WORK_TICKS_273,outputUnits:1}),
  'make-prosthetic-leg':Object.freeze({label:'Fabriquer une jambe prothétique',station:'machining-table',work:'craft',inputs:['steel','component'] as readonly ProductionIngredient[],units:44,workTicks:PROSTHETIC_PRODUCTION_WORK_TICKS_273,outputUnits:1}),
  'brew-wort':Object.freeze({label:'Brasser du moût',station:'brewery',work:'cook',inputs:['hops'] as readonly ProductionIngredient[],units:25,workTicks:100,outputUnits:5}),
  'make-pemmican':Object.freeze({label:'Préparer du pemmican',station:'campfire',work:'cook',inputs:PEMMICAN_INPUTS as readonly ProductionIngredient[],units:PEMMICAN_INPUT_UNITS,workTicks:PEMMICAN_WORK_TICKS,outputUnits:PEMMICAN_OUTPUT_UNITS}),
  'make-kibble':Object.freeze({label:'Fabriquer des croquettes',station:'butcher-table',work:'cook',inputs:KIBBLE_INPUTS as readonly ProductionIngredient[],units:KIBBLE_INPUT_UNITS,workTicks:KIBBLE_WORK_TICKS,outputUnits:KIBBLE_OUTPUT_UNITS}),
  'burn-apparel':Object.freeze({label:'Brûler des vêtements',station:'campfire',work:'haul',inputs:BURN_APPAREL_INPUTS as readonly ProductionIngredient[],units:1,workTicks:BURN_APPAREL_WORK_TICKS,outputUnits:0}),
  'cremate-corpse':Object.freeze({label:'Incinérer une dépouille',station:'electric-crematorium',work:'haul',inputs:CREMATION_INPUTS as readonly ProductionIngredient[],units:1,workTicks:CREMATION_WORK_TICKS,outputUnits:0}),
  'smelt-slag':Object.freeze({label:'Extraire l’acier des scories',station:'electric-smelter',work:'craft',inputs:['slag-steel-chunk'] as readonly ProductionIngredient[],units:1,workTicks:40,outputUnits:15}),
  'make-spear':Object.freeze({label:'Fabriquer une lance',station:'fueled-smithy',work:'craft',inputs:smithingMaterials267('make-spear') as readonly ProductionIngredient[],units:750,workTicks:1200,outputUnits:1}),
  'make-longsword':Object.freeze({label:'Fabriquer une épée longue',station:'fueled-smithy',work:'craft',inputs:smithingMaterials267('make-longsword') as readonly ProductionIngredient[],units:1000,workTicks:1800,outputUnits:1}),
  'make-mace':Object.freeze({label:'Fabriquer une masse',station:'fueled-smithy',work:'craft',inputs:smithingMaterials267('make-mace') as readonly ProductionIngredient[],units:500,workTicks:600,outputUnits:1}),
  'make-plasteel-knife':Object.freeze({label:'Fabriquer un couteau en plastacier',station:'fueled-smithy',work:'craft',inputs:smithingMaterials267('make-plasteel-knife') as readonly ProductionIngredient[],units:30,workTicks:396,outputUnits:1}),
  'make-plate-armor':Object.freeze({label:'Fabriquer une armure de plaques',station:'fueled-smithy',work:'craft',inputs:smithingMaterials267('make-plate-armor') as readonly ProductionIngredient[],units:1700,workTicks:3800,outputUnits:1}),
  'make-simple-helmet':Object.freeze({label:'Fabriquer un casque simple',station:'fueled-smithy',work:'craft',inputs:smithingMaterials267('make-simple-helmet') as readonly ProductionIngredient[],units:400,workTicks:320,outputUnits:1}),
  'smelt-apparel':Object.freeze({label:'Fondre une armure',station:'electric-smelter',work:'craft',inputs:SMELTING_APPAREL_INPUTS267 as readonly ProductionIngredient[],units:1,workTicks:SMELTING_WORK_TICKS,outputUnits:SMELTING_APPAREL_MAX_OUTPUT267}),
  'smelt-weapon':Object.freeze({label:'Fondre une arme',station:'electric-smelter',work:'craft',inputs:SMELTING_WEAPONS as readonly ProductionIngredient[],units:1,workTicks:SMELTING_WORK_TICKS,outputUnits:SMELTING_MAX_OUTPUT}),
  'chemfuel-from-wood':Object.freeze({label:'Raffiner du biocarburant à partir de bois',station:'biofuel-refinery',work:'craft',inputs:['wood'] as readonly ProductionIngredient[],units:70,workTicks:200,outputUnits:35}),
  'chemfuel-from-organics':Object.freeze({label:'Raffiner du biocarburant à partir de matières organiques',station:'biofuel-refinery',work:'craft',inputs:BIOFUEL_ORGANIC_INPUTS as readonly ProductionIngredient[],units:70,workTicks:250,outputUnits:35}),
  'make-medicine':Object.freeze({label:'Fabriquer des médicaments',station:'drug-lab',work:'craft',inputs:['herbal-medicine','neutroamine','cloth'] as readonly ProductionIngredient[],units:5,workTicks:70,outputUnits:1}),
  'small-sculpture':Object.freeze({label:'Petite sculpture',station:'art-bench',work:'art',inputs:ART_MATERIALS as readonly ProductionIngredient[],units:50,workTicks:1800,outputUnits:1}),
  'large-sculpture':Object.freeze({label:'Grande sculpture',station:'art-bench',work:'art',inputs:ART_MATERIALS as readonly ProductionIngredient[],units:100,workTicks:3000,outputUnits:1}),
  'make-revolver':Object.freeze({label:'Revolver',station:'machining-table',work:'craft',inputs:['steel','component'] as readonly ProductionIngredient[],units:32,workTicks:400,outputUnits:1}),
  'make-bolt-action-rifle':Object.freeze({label:'Fusil à verrou',station:'machining-table',work:'craft',inputs:['steel','component'] as readonly ProductionIngredient[],units:63,workTicks:1200,outputUnits:1}),
  'make-emp-launcher':Object.freeze({label:'Lanceur EMP',station:'machining-table',work:'craft',inputs:['steel','component'] as readonly ProductionIngredient[],units:83,workTicks:3000,outputUnits:1}),
  'make-flak-vest':Object.freeze({label:'Gilet pare-balles',station:'machining-table',work:'craft',inputs:['cloth','steel','component'] as readonly ProductionIngredient[],units:91,workTicks:900,outputUnits:1}),
  'make-flak-helmet':Object.freeze({label:'Casque pare-balles',station:'machining-table',work:'craft',inputs:['steel','component','plasteel'] as readonly ProductionIngredient[],units:52,workTicks:800,outputUnits:1}),
  'make-recon-armor':Object.freeze({label:'Combinaison de reconnaissance',station:'fabrication-bench',work:'craft',inputs:['plasteel','advanced-component','uranium'] as readonly ProductionIngredient[],units:93,workTicks:4500,outputUnits:1}),
  'make-recon-helmet':Object.freeze({label:'Casque de reconnaissance',station:'fabrication-bench',work:'craft',inputs:['plasteel','advanced-component'] as readonly ProductionIngredient[],units:31,workTicks:1575,outputUnits:1}),
  'make-component':Object.freeze({label:'Composant',station:'fabrication-bench',work:'craft',inputs:['steel'] as readonly ProductionIngredient[],units:12,workTicks:500,outputUnits:1}),
  'make-advanced-component':Object.freeze({label:'Composant avancé',station:'fabrication-bench',work:'craft',inputs:['component','steel','plasteel','gold'] as readonly ProductionIngredient[],units:34,workTicks:1000,outputUnits:1}),
  'smash-mechanoid':Object.freeze({label:'Concasser une carcasse mécanique',station:'crafting-spot',work:'craft',inputs:MECH_CORPSE_ITEMS as readonly ProductionIngredient[],units:1,workTicks:45,outputUnits:23}),
  'shred-mechanoid':Object.freeze({label:'Broyer une carcasse mécanique',station:'machining-table',work:'craft',inputs:MECH_CORPSE_ITEMS as readonly ProductionIngredient[],units:1,workTicks:30,outputUnits:23}),
  'butcher-creature':Object.freeze({label:'Dépecer une créature',station:'butcher-spot',work:'cook',inputs:ANIMAL_CORPSE_ITEMS as readonly ProductionIngredient[],units:1,workTicks:45,outputUnits:50}),
  shirt:Object.freeze({label:'Chemise',station:'tailor-bench',work:'craft',inputs:APPAREL_MATERIALS as readonly ProductionIngredient[],units:45,workTicks:270,outputUnits:1}),
  tribalwear:Object.freeze({label:'Tenue tribale',station:'crafting-spot',work:'craft',inputs:APPAREL_MATERIALS as readonly ProductionIngredient[],units:60,workTicks:180,outputUnits:1}),
  pants:Object.freeze({label:'Pantalon',station:'tailor-bench',work:'craft',inputs:APPAREL_MATERIALS as readonly ProductionIngredient[],units:40,workTicks:160,outputUnits:1}),
  duster:Object.freeze({label:'Cache-poussière',station:'tailor-bench',work:'craft',inputs:APPAREL_MATERIALS as readonly ProductionIngredient[],units:80,workTicks:1000,outputUnits:1}),
  tuque:Object.freeze({label:'Tuque',station:'tailor-bench',work:'craft',inputs:['cloth','muffalo-wool'] as readonly ProductionIngredient[],units:20,workTicks:120,outputUnits:1}),
  parka:Object.freeze({label:'Parka',station:'tailor-bench',work:'craft',inputs:APPAREL_MATERIALS as readonly ProductionIngredient[],units:80,workTicks:800,outputUnits:1}),
  // Neutral recipe work, before station/room/light factors; Core ticks / 10.
  'simple-meal': Object.freeze({label:'Repas simple',station:'campfire',work:'cook',inputs:['raw-fungus','rice','berries','milk',...ANIMAL_MEAT_ITEMS,'potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:10,workTicks:30,outputUnits:1}),
  'cook-simple-meal-bulk': Object.freeze({label:'Cuisiner des plats simples x4',station:'campfire',work:'cook',inputs:['raw-fungus','rice','berries','milk',...ANIMAL_MEAT_ITEMS,'potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:40,workTicks:120,outputUnits:4}),
  'cook-survival-meal': Object.freeze({label:'Cuisiner un repas de survie emballé',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk',...ANIMAL_MEAT_ITEMS,'potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:12,workTicks:45,outputUnits:1}),
  'fine-meal': Object.freeze({label:'Cuisiner un plat raffiné',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk',...ANIMAL_MEAT_ITEMS,'potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:10,workTicks:45,outputUnits:1}),
  'cook-fine-meal-bulk': Object.freeze({label:'Cuisiner des plats raffinés x4',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk',...ANIMAL_MEAT_ITEMS,'potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:40,workTicks:180,outputUnits:4}),
  'vegetarian-fine-meal': Object.freeze({label:'Cuisiner un plat raffiné végétarien',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk','potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:15,workTicks:45,outputUnits:1}),
  'cook-vegetarian-fine-meal-bulk': Object.freeze({label:'Cuisiner des plats raffinés végétariens x4',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk','potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:60,workTicks:180,outputUnits:4}),
  'carnivore-fine-meal': Object.freeze({label:'Cuisiner un plat raffiné carnivore',station:'fueled-stove',work:'cook',inputs:ANIMAL_MEAT_ITEMS as readonly ProductionIngredient[],units:15,workTicks:45,outputUnits:1}),
  'cook-carnivore-fine-meal-bulk': Object.freeze({label:'Cuisiner des plats raffinés carnivores x4',station:'fueled-stove',work:'cook',inputs:ANIMAL_MEAT_ITEMS as readonly ProductionIngredient[],units:60,workTicks:180,outputUnits:4}),
  'lavish-meal': Object.freeze({label:'Cuisiner un plat gastronomique',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk',...ANIMAL_MEAT_ITEMS,'potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:20,workTicks:80,outputUnits:1}),
  'cook-lavish-meal-bulk': Object.freeze({label:'Cuisiner des plats gastronomiques x4',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk',...ANIMAL_MEAT_ITEMS,'potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:80,workTicks:320,outputUnits:4}),
  'vegetarian-lavish-meal': Object.freeze({label:'Cuisiner un plat gastronomique végétarien',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk','potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:25,workTicks:80,outputUnits:1}),
  'cook-vegetarian-lavish-meal-bulk': Object.freeze({label:'Cuisiner des plats gastronomiques végétariens x4',station:'fueled-stove',work:'cook',inputs:['raw-fungus','rice','berries','milk','potato','corn','agave-fruit'] as readonly ProductionIngredient[],units:100,workTicks:320,outputUnits:4}),
  'cook-carnivore-lavish-meal': Object.freeze({label:'Cuisiner un plat gastronomique carnivore',station:'fueled-stove',work:'cook',inputs:ANIMAL_MEAT_ITEMS as readonly ProductionIngredient[],units:25,workTicks:80,outputUnits:1}),
  'cook-carnivore-lavish-meal-bulk': Object.freeze({label:'Cuisiner des plats gastronomiques carnivores x4',station:'fueled-stove',work:'cook',inputs:ANIMAL_MEAT_ITEMS as readonly ProductionIngredient[],units:100,workTicks:320,outputUnits:4}),
  'stone-blocks': Object.freeze({label:'Blocs de pierre',station:'stonecutter',work:'craft',inputs:STONE_INPUTS as readonly ProductionIngredient[],units:1,workTicks:160,outputUnits:20}),
} as const);
/** Persist integer work units; rounding error is at most 0.00005 neutral ticks
 * per action. A rate change never rewrites previously performed work. */
export const PRODUCTION_WORK_SCALE=10000;
export const productionWorkTotal=(recipe:ProductionRecipe):number=>isSmithingRecipe267(recipe)?smithingWorkTotal267(recipe,'plasteel'):PRODUCTION_RECIPES[recipe].workTicks*PRODUCTION_WORK_SCALE;
export const legacyProductionTicks=(recipe:ProductionRecipe):number=>recipe==='simple-meal'?60:200;
export const taskRecipe=(task:CookingTask):ProductionRecipe=>(task.recipe??'simple-meal') as ProductionRecipe;
export const taskWork=(task:CookingTask):WorkType=>billWork({recipe:taskRecipe(task)});
export const isTailoring=(recipe:unknown):recipe is TailoringRecipe=>typeof recipe==='string'&&TAILORING_RECIPES.includes(recipe as TailoringRecipe);
export const unfinishedItem=(recipe:TailoringRecipe):UnfinishedApparelItem=>({tribalwear:'unfinished-tribalwear',shirt:'unfinished-shirt',pants:'unfinished-pants',duster:'unfinished-duster',parka:'unfinished-parka',tuque:'unfinished-tuque'} as const)[recipe];
export const stationRecipe=(station:Pick<Structure,'kind'>):ProductionRecipe|null=>station.kind==='fueled-smithy'||station.kind==='electric-smithy'?'make-plate-armor':station.kind==='brewery'?'brew-wort':station.kind==='electric-crematorium'?'cremate-corpse':station.kind==='electric-smelter'?'smelt-weapon':station.kind==='biofuel-refinery'?'chemfuel-from-wood':station.kind==='drug-lab'?'make-medicine':station.kind==='art-bench'?'small-sculpture':station.kind==='machining-table'?'make-revolver':station.kind==='fabrication-bench'?'make-component':isButcherStation(station.kind)?'butcher-creature':station.kind==='tailor-bench'||station.kind==='electric-tailor-bench'?'shirt':station.kind==='crafting-spot'?'tribalwear':station.kind==='campfire'||isStove(station.kind)?'simple-meal':station.kind==='stonecutter'?'stone-blocks':null;
/** The electrical bench remains a physical work surface without power. Its
 * power state changes the work factor in WorkEnvironment instead of
 * invalidating an already reserved bill or unfinished garment. */
export const productionStationUsable=(station:Structure):boolean=>(station.kind!=='electric-smithy'&&station.kind!=='electric-crematorium'&&station.kind!=='electric-smelter'&&station.kind!=='machining-table'&&station.kind!=='fabrication-bench'&&station.kind!=='biofuel-refinery')||station.power?.on===true;
/** Core's bill work types: the smithy, machining table and fabrication bench
 * are Smithing, the tailor benches Tailoring, the other crafting stations
 * (crafting spot, stonecutter, smelter, refinery, drug lab) Crafting. */
const smithingStation=(kind:Structure['kind']):boolean=>kind==='fueled-smithy'||kind==='electric-smithy'||kind==='machining-table'||kind==='fabrication-bench';
const tailoringStation=(kind:Structure['kind']):boolean=>kind==='tailor-bench'||kind==='electric-tailor-bench';
const craftingWork=(kind:Structure['kind']):'craft'|'smith'|'tailor'=>smithingStation(kind)?'smith':tailoringStation(kind)?'tailor':'craft';
export const stationWork=(station:Pick<Structure,'kind'>):'cook'|'craft'|'smith'|'tailor'|'art'|'haul'=>station.kind==='brewery'?'cook':station.kind==='electric-crematorium'?'haul':station.kind==='art-bench'?'art':station.kind==='campfire'||isStove(station.kind)||isButcherStation(station.kind)?'cook':craftingWork(station.kind);
export const billWork=(bill:Pick<CookingBill,'recipe'>):'cook'|'craft'|'smith'|'tailor'|'art'|'haul'=>{const recipe=PRODUCTION_RECIPES[bill.recipe];return recipe.work==='craft'?craftingWork(recipe.station):recipe.work;};
export function admittedIngredient(bill:CookingBill,item:ItemId):item is ProductionIngredient {
  return PRODUCTION_RECIPES[bill.recipe].inputs.includes(item as ProductionIngredient)&&bill.filters[item as ProductionIngredient]===true;
}
export const blockFor=(chunk:StoneIngredient):ItemId=>chunk.replace('-chunk','-blocks') as ItemId;
/** Zero output is a real recipe result, with no sentinel item or allocation. */
export const recipeHasProducts=(recipe:ProductionRecipe):boolean=>!isCremationRecipe(recipe)&&!isBurnApparelRecipe(recipe);
export function tailoringMaterialFromIngredients(ingredients:readonly {item:ProductionIngredient}[]):TailoringMaterial|undefined {
  const found=new Set(ingredients.map(i=>i.item).filter((item):item is TailoringMaterial=>isApparelMaterial(item)));
  return found.size===1?[...found][0]:undefined;
}
export const tailoringMaterialAllowed=(recipe:TailoringRecipe,material:TailoringMaterial):boolean=>PRODUCTION_RECIPES[recipe].inputs.includes(material);
export function recipeProduct(recipe:ProductionRecipe,ingredients:readonly {item:ProductionIngredient}[],material?:TailoringMaterial):ItemId {
  if(!recipeHasProducts(recipe))throw new RangeError('Destructive recipe has no products');
  if(isSmithingRecipe267(recipe)){const m=ingredients[0]?.item;if(!smithingMaterialAllowed267(recipe,m)||ingredients.some(i=>i.item!==m))throw Error('Smithing product requires homogeneous material');return smithingProduct267(recipe,m);}
  if(isProstheticRecipe273(recipe))return prostheticProduct273(recipe);
  if(recipe==='brew-wort')return 'wort';
  if(isPemmicanRecipe(recipe))return 'pemmican';
  if(isKibbleRecipe(recipe))return 'kibble';
  if(recipe==='smelt-slag')return 'steel';
  if(isSmeltingRecipe(recipe))return smeltingProduct(ingredients[0]!.item as WeaponItem);
  if(isBiofuelRecipe(recipe))return 'chemfuel';
  if(recipe==='make-medicine')return 'medicine';
  if(isArtRecipe(recipe))throw new RangeError('Sculptures are whole furniture products');
  if(isGunRecipe(recipe))return recipe==='make-revolver'?'revolver':recipe==='make-emp-launcher'?'emp-launcher':'bolt-action-rifle';
  if(isFlakRecipe(recipe))return recipe==='make-flak-vest'?'flak-vest':recipe==='make-flak-helmet'?'flak-helmet':recipe==='make-recon-armor'?'recon-armor':'recon-helmet';
  if(recipe==='smash-mechanoid'||recipe==='shred-mechanoid')return 'steel';
  if(recipe==='make-component')return 'component';
  if(recipe==='make-advanced-component')return 'advanced-component';
  if(isTailoring(recipe)){const resolved=material??tailoringMaterialFromIngredients(ingredients);if(!resolved||!tailoringMaterialAllowed(recipe,resolved))throw new RangeError('Tailoring product requires one material admitted by the recipe');return apparelItemFor(recipe,resolved);}
  return recipe==='cook-survival-meal'?'survival-meal':recipe==='butcher-creature'?((ingredients[0]?.item??'hare-corpse').replace('-corpse','-meat') as ItemId):recipe==='simple-meal'||recipe==='cook-simple-meal-bulk'?'simple-meal':recipe==='fine-meal'||recipe==='cook-fine-meal-bulk'?'fine-meal':recipe==='vegetarian-fine-meal'||recipe==='cook-vegetarian-fine-meal-bulk'?'vegetarian-fine-meal':recipe==='carnivore-fine-meal'||recipe==='cook-carnivore-fine-meal-bulk'?'carnivore-fine-meal':recipe==='lavish-meal'||recipe==='cook-lavish-meal-bulk'?'lavish-meal':recipe==='vegetarian-lavish-meal'||recipe==='cook-vegetarian-lavish-meal-bulk'?'vegetarian-lavish-meal':recipe==='cook-carnivore-lavish-meal'||recipe==='cook-carnivore-lavish-meal-bulk'?'carnivore-lavish-meal':blockFor(ingredients[0]!.item as StoneIngredient);
}
export function isRecipeProduct(recipe:ProductionRecipe,item:ItemId):boolean {
  if(!recipeHasProducts(recipe))return false;
  if(isSmithingRecipe267(recipe))return smithingMaterials267(recipe).some(m=>item===smithingProduct267(recipe,m));
  if(isProstheticRecipe273(recipe))return item===prostheticProduct273(recipe);
  if(recipe==='brew-wort')return item==='wort';
  if(isPemmicanRecipe(recipe))return item==='pemmican';
  if(isKibbleRecipe(recipe))return item==='kibble';
  if(recipe==='smelt-slag')return item==='steel';
  if(isSmeltingRecipe(recipe))return ['steel','plasteel','uranium','silver','gold'].includes(item);
  if(isBiofuelRecipe(recipe))return item==='chemfuel';
  if(recipe==='make-medicine')return item==='medicine';
  if(isArtRecipe(recipe))return false;
  if(isGunRecipe(recipe))return item===(recipe==='make-revolver'?'revolver':recipe==='make-emp-launcher'?'emp-launcher':'bolt-action-rifle');
  if(isFlakRecipe(recipe))return item===(recipe==='make-flak-vest'?'flak-vest':recipe==='make-flak-helmet'?'flak-helmet':recipe==='make-recon-armor'?'recon-armor':'recon-helmet');
  if(recipe==='smash-mechanoid'||recipe==='shred-mechanoid')return item==='steel';
  if(recipe==='make-component')return item==='component';
  if(recipe==='make-advanced-component')return item==='advanced-component';
  if(isTailoring(recipe))return PRODUCTION_RECIPES[recipe].inputs.some(material=>isApparelMaterial(material)&&item===apparelItemFor(recipe,material));
  return recipe==='cook-survival-meal'?item==='survival-meal':recipe==='butcher-creature'?(isAnimalMeat(item)||(ANIMAL_LEATHER_ITEMS as readonly string[]).includes(item)):recipe==='simple-meal'||recipe==='cook-simple-meal-bulk'?item==='simple-meal':recipe==='fine-meal'||recipe==='cook-fine-meal-bulk'?item==='fine-meal':recipe==='vegetarian-fine-meal'||recipe==='cook-vegetarian-fine-meal-bulk'?item==='vegetarian-fine-meal':recipe==='carnivore-fine-meal'||recipe==='cook-carnivore-fine-meal-bulk'?item==='carnivore-fine-meal':recipe==='lavish-meal'||recipe==='cook-lavish-meal-bulk'?item==='lavish-meal':recipe==='vegetarian-lavish-meal'||recipe==='cook-vegetarian-lavish-meal-bulk'?item==='vegetarian-lavish-meal':recipe==='cook-carnivore-lavish-meal'||recipe==='cook-carnivore-lavish-meal-bulk'?item==='carnivore-lavish-meal':ITEM_DEFINITIONS[item].kind==='blocks';
}
export function tailoringProduct(recipe:TailoringRecipe,material:TailoringMaterial):ApparelItem { return apparelItemFor(recipe,material); }

export const stationRecipes=(station:Pick<Structure,'kind'>):readonly ProductionRecipe[]=>station.kind==='fueled-smithy'||station.kind==='electric-smithy'?['make-plate-armor','make-simple-helmet','make-plasteel-knife','make-mace','make-longsword','make-spear']:station.kind==='brewery'?['brew-wort']:station.kind==='electric-crematorium'?['cremate-corpse','burn-apparel']:station.kind==='electric-smelter'?['smelt-weapon','smelt-slag','smelt-apparel']:station.kind==='biofuel-refinery'?['chemfuel-from-wood','chemfuel-from-organics']:station.kind==='art-bench'?['small-sculpture','large-sculpture']:station.kind==='machining-table'?['make-prosthetic-arm','make-prosthetic-leg','make-revolver','make-bolt-action-rifle','make-emp-launcher','make-flak-vest','make-flak-helmet','shred-mechanoid','make-simple-helmet']:station.kind==='fabrication-bench'?['make-component','make-advanced-component','make-recon-helmet','make-recon-armor']:(station.kind==='tailor-bench'||station.kind==='electric-tailor-bench')?['shirt','pants','duster','parka','tribalwear','tuque']:station.kind==='crafting-spot'?['tribalwear','smash-mechanoid','make-plasteel-knife']:isStove(station.kind)?['make-pemmican','simple-meal','cook-simple-meal-bulk','fine-meal','cook-fine-meal-bulk','vegetarian-fine-meal','cook-vegetarian-fine-meal-bulk','carnivore-fine-meal','cook-carnivore-fine-meal-bulk','lavish-meal','cook-lavish-meal-bulk','vegetarian-lavish-meal','cook-vegetarian-lavish-meal-bulk','cook-carnivore-lavish-meal','cook-carnivore-lavish-meal-bulk','cook-survival-meal']:station.kind==='campfire'?['burn-apparel','make-pemmican','simple-meal','cook-simple-meal-bulk']:isButcherStation(station.kind)?['butcher-creature','make-kibble']:stationRecipe(station)?[stationRecipe(station)!]:[];
export const stationAccepts=(station:Pick<Structure,'kind'>,recipe:ProductionRecipe):boolean=>stationRecipes(station).includes(recipe);

/** Snapshot-only display total; the authoritative workpiece owns its material. */
export function productionTaskTotal(world:World,task:CookingTask):number {
  if(isSmithingRecipe267(task.recipe)){const u=world.piles.find(p=>p.id===task.ingredients[0]?.pileId)?.smithingWork,m=u?.material??smithingMaterialFromIngredients267(task.recipe,task.ingredients);if(m)return smithingWorkTotal267(task.recipe,m);}
  if(isArtRecipe(task.recipe)){const work=world.piles.find(p=>p.id===task.ingredients[0]?.pileId)?.artWork;if(work)return artWorkTotal(work.recipe,work.material);}
  return productionWorkTotal(taskRecipe(task));
}
