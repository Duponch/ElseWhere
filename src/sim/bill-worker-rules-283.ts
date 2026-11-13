import type {BillWorkerPolicy283} from './bill-worker-state-283.ts';
import type {BackgroundSkillId} from './colonist-backgrounds.ts';
import type {CookingBill} from './cooking-types.ts';
import type {ProductionRecipe} from './production-recipes.ts';
import {isSchema283OrLater} from './schema-compatibility-257.ts';
import type {Pawn,World} from './types.ts';
import {effectiveSkillLevel} from './work-types.ts';

export type ProductionRecipeSkill283=Extract<BackgroundSkillId,'cooking'|'crafting'|'artistic'|'intellectual'>;

/** RecipeDef.workSkill, independent of local work assignment, speed and XP.
 * Stonecutting retains Crafting despite its zero learning factor. */
const recipeSkills:Readonly<Record<ProductionRecipe,ProductionRecipeSkill283|null>>=Object.freeze({
 'make-prosthetic-arm':'crafting',
 'make-prosthetic-leg':'crafting',
 'brew-wort':'cooking',
 'make-pemmican':'cooking',
 'make-kibble':'cooking',
 'burn-apparel':null,
 'cremate-corpse':null,
 'smelt-slag':null,
 'make-spear':'crafting',
 'make-short-bow':'crafting',
 'make-longsword':'crafting',
 'make-mace':'crafting',
 'make-plasteel-knife':'crafting',
 'make-plate-armor':'crafting',
 'make-simple-helmet':'crafting',
 'smelt-apparel':null,
 'smelt-weapon':null,
 'chemfuel-from-wood':null,
 'chemfuel-from-organics':null,
 'make-medicine':'intellectual',
 'small-sculpture':'artistic',
 'large-sculpture':'artistic',
 'make-revolver':'crafting',
 'make-bolt-action-rifle':'crafting',
 'make-emp-launcher':'crafting',
 'make-flak-vest':'crafting',
 'make-flak-helmet':'crafting',
 'make-recon-armor':'crafting',
 'make-recon-helmet':'crafting',
 'make-component':'crafting',
 'make-advanced-component':'crafting',
 'smash-mechanoid':'crafting',
 'shred-mechanoid':'crafting',
 'butcher-creature':'cooking',
 shirt:'crafting',tshirt:'crafting',jacket:'crafting',
 tribalwear:'crafting',
 pants:'crafting',
 duster:'crafting',
 tuque:'crafting',
 parka:'crafting',
 'simple-meal':'cooking',
 'cook-simple-meal-bulk':'cooking',
 'cook-survival-meal':'cooking',
 'fine-meal':'cooking',
 'cook-fine-meal-bulk':'cooking',
 'vegetarian-fine-meal':'cooking',
 'cook-vegetarian-fine-meal-bulk':'cooking',
 'carnivore-fine-meal':'cooking',
 'cook-carnivore-fine-meal-bulk':'cooking',
 'lavish-meal':'cooking',
 'cook-lavish-meal-bulk':'cooking',
 'vegetarian-lavish-meal':'cooking',
 'cook-vegetarian-lavish-meal-bulk':'cooking',
 'cook-carnivore-lavish-meal':'cooking',
 'cook-carnivore-lavish-meal-bulk':'cooking',
 'stone-blocks':'crafting',
});

export const productionRecipeSkill283=(recipe:ProductionRecipe):ProductionRecipeSkill283|null=>recipeSkills[recipe];

const unrestricted:Readonly<BillWorkerPolicy283>=Object.freeze({pawnId:null,skillMin:0,skillMax:20});
/** Absence is an unrestricted read, never a migration or a saved mutation. */
export const readBillWorkerPolicy283=(bill:Pick<CookingBill,'worker'>):Readonly<BillWorkerPolicy283>=>bill.worker??unrestricted;

const integer=(value:unknown,min:number,max:number):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;

/** Shape and numeric bounds only. The owner validates the human reference.
 * Optional nextId is exclusive, like the existing world entity namespace. */
export function validBillWorkerPolicy283(value:unknown,nextId?:number):value is BillWorkerPolicy283 {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const keys=Reflect.ownKeys(value);
 if(keys.length!==3||keys.some(key=>typeof key!=='string'||key!=='pawnId'&&key!=='skillMin'&&key!=='skillMax'))return false;
 const pawn=Object.getOwnPropertyDescriptor(value,'pawnId'),min=Object.getOwnPropertyDescriptor(value,'skillMin'),max=Object.getOwnPropertyDescriptor(value,'skillMax');
 if(!pawn?.enumerable||!min?.enumerable||!max?.enumerable||!Object.hasOwn(pawn,'value')||!Object.hasOwn(min,'value')||!Object.hasOwn(max,'value'))return false;
 if(nextId!==undefined&&!integer(nextId,1,Number.MAX_SAFE_INTEGER))return false;
 return (pawn.value===null||integer(pawn.value,1,nextId===undefined?Number.MAX_SAFE_INTEGER:nextId-1))
  &&integer(min.value,0,20)&&integer(max.value,0,20)&&min.value<=max.value;
}

const skillLabels:Readonly<Record<ProductionRecipeSkill283,string>>=Object.freeze({cooking:'Cuisine',crafting:'Artisanat',artistic:'Artistique',intellectual:'Intellectuel'});

/** Prospective preference only: the producer still checks recipe minima and
 * physical admission. This read never cancels or changes an engaged task. */
export function billWorkerRefusal283(world:Pick<World,'schemaVersion'>,pawn:Pawn,bill:Pick<CookingBill,'recipe'|'worker'>):string|undefined {
 if(!isSchema283OrLater(world.schemaVersion)||!bill.worker)return;
 const policy=bill.worker;
 if(policy.pawnId!==null)return policy.pawnId===pawn.id?undefined:'Cette facture est réservée à une autre personne.';
 const skill=productionRecipeSkill283(bill.recipe);
 if(skill===null)return;
 const level=Math.max(0,Math.min(20,effectiveSkillLevel(pawn,skill,pawn.skills[skill]?.level??0)));
 if(level<policy.skillMin)return `Niveau ${skillLabels[skill]} inférieur au minimum choisi (${policy.skillMin}).`;
 if(level>policy.skillMax)return `Niveau ${skillLabels[skill]} supérieur au maximum choisi (${policy.skillMax}).`;
}
