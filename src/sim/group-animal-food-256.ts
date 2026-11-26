import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import type {WildAnimal} from './wildlife-state.ts';
import {foodPoisonFactor347} from './game-profile.ts';
import type {MaterialPile,World} from './types.ts';
import {SCHEMA_VERSION} from './types.ts';
import type {AwayGroup} from './group-capture.ts';
import type {GroupInventoryVector} from './group-reorganization-state.ts';
import {animalItemDiet256,animalPlantDiet256} from './animal-diet-v256.ts';
import {animalSpecies} from './animal-species.ts';
import {isAnimalMeat} from './biome-items.ts';
import {eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {ticksUntilRot} from './food-preservation.ts';
import {animalNutritionMax,animalFoodWantEat256} from './animal-life.ts';
import {ingestionFoodPoison,exposeFoodPoisoningAtRecord} from './food-poisoning.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {GROUP_FORAGED_ITEMS_256,type GroupForagedItem256} from './group-forage-state-256.ts';
import type {GroupAnimalOwners256} from './group-animal-state-256.ts';
type Group=AwayGroup&{animalOwners?:GroupAnimalOwners256;reorganization?:NonNullable<AwayGroup['reorganization']>&{inventoryEffects?:GroupInventoryVector}};
export const caravanAnimalWantFood256=animalFoodWantEat256;
const plants=new Set<ItemId>(['rice','corn','potato','berries','agave-fruit','raw-fungus']);
/** Positive Core categories only, no corpse-as-stack or inappropriate drug. */
export function caravanAnimalFood256(a:WildAnimal,p:MaterialPile,tick:number,version:number=SCHEMA_VERSION):boolean {
 if(p.kind!=='food'||!ITEM_DEFINITIONS[p.item].nutrition||ticksUntilRot(p,tick)<=0)return false;
 return caravanAnimalFoodEver256(a,p.item,version);
}
/** Definition-only diet shared by the preview; freshness belongs to the actual
 * stack check above, independently of future rot duration. */
export function caravanAnimalFoodEver256(a:WildAnimal,item:ItemId,version:number=SCHEMA_VERSION):boolean {
 const exact=animalItemDiet256(a,item,false,version);if(exact!==undefined)return exact;
 if(item==='hops')return version>=265&&!animalSpecies(a.species).predator;
 if(item==='kibble')return true;if(item==='hay')return !animalSpecies(a.species).predator;
 return animalSpecies(a.species).predator?isAnimalMeat(item)||item.endsWith('-meal')||item==='pemmican':plants.has(item)||item.endsWith('-meal')||item==='pemmican'||item==='milk';
}
export function caravanAnimalFoodScore256(p:Pick<MaterialPile,'item'>):number {
 const item=p.item,base=item==='kibble'||item==='hay'||item==='hops'?5:isAnimalMeat(item)?4:plants.has(item)&&item!=='berries'?3:eggSpeciesForItem256(item)?3:item==='berries'||item==='milk'?2:item==='pemmican'||item==='survival-meal'||item==='simple-meal'||item==='nutrient-paste-meal'?1:0;
 return Math.fround(base+Math.min(Math.fround(ITEM_DEFINITIONS[item].nutrition/10000),.999));
}
/** Counter changes are actual physical effects since the current opening;
 * loading contacts and earlier histories never become this vector. */
export function recordCaravanInventoryEffect256(g:Group,item:ItemId,delta:number):void {
 const r=g.reorganization;if(!r||!Number.isSafeInteger(delta))throw Error('Missing current inventory opening');
 const prior=r.inventoryEffects?.[item]??0,next=BigInt(prior)+BigInt(delta),limit=BigInt(Number.MAX_SAFE_INTEGER);if(next>limit||next< -limit)throw Error('Animal inventory effect exhausted');
 r.inventoryEffects={...r.inventoryEffects,[item]:Number(next)};
}
export function recordCaravanAnimalConsumption256(g:Group,item:ItemId,quantity:number):void {
 if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('Invalid actual ingestion');
 if(item==='survival-meal'){if(!Number.isSafeInteger(g.ledger.foodConsumed+quantity))throw Error('Food counter overflow');g.ledger.foodConsumed+=quantity;return;}
 if(item==='pemmican'){const p=g.provisions;if(p){if(!Number.isSafeInteger(p.pemmicanConsumedUnits+quantity))throw Error('Food counter overflow');p.pemmicanConsumedUnits+=quantity;}else if(g.reorganization?.pemmicanSinceOpening){const c=g.reorganization.pemmicanSinceOpening;if(!Number.isSafeInteger(c.consumed+quantity))throw Error('Food counter overflow');c.consumed+=quantity;}else throw Error('Missing actual pemmican effects');return;}
 if(GROUP_FORAGED_ITEMS_256.includes(item as GroupForagedItem256)){const counters=g.travel?.forage??g.reorganization?.foodSinceOpening;if(!counters)throw Error('Missing fruit effects');const key=item as GroupForagedItem256;if(!Number.isSafeInteger(counters.consumed[key]+quantity))throw Error('Fruit counter overflow');counters.consumed[key]+=quantity;return;}
 recordCaravanInventoryEffect256(g,item,-quantity);
}
export function satisfyCaravanAnimalFood256(w:World,g:Group,a:WildAnimal,c:{temperature:number;hasVirtualPlants:boolean;random():number}):void {
 if(!g.animalOwners?.members.includes(a)||a.state==='dead'||a.health?.death||a.food>=animalNutritionMax(a)*caravanAnimalWantFood256(a)*.8)return;
 const plant=animalPlantDiet256(a);if((plant===true||plant===undefined&&!animalSpecies(a.species).predator)&&c.hasVirtualPlants&&c.temperature>=0){a.food=Math.min(animalNutritionMax(a),Math.fround(a.food+Math.fround(.5*Math.fround(.7+.3*c.random()))));return;}
 const holders=new Set([...g.members,...g.animalOwners.members].filter(p=>p.state!=='dead'&&!p.health?.death).map(p=>p.id));
 let selected:MaterialPile|undefined,score=-Infinity;for(const p of g.items)if(p.owner.type==='inventory'&&holders.has(p.owner.pawnId)&&caravanAnimalFood256(a,p,w.tick,w.schemaVersion)){const s=caravanAnimalFoodScore256(p);if(s>score){selected=p;score=s;}}
 if(!selected)return;const nutrition=ITEM_DEFINITIONS[selected.item].nutrition/100,wanted=animalNutritionMax(a)-a.food;
 const quantity=Math.min(selected.quantity,ITEM_DEFINITIONS[selected.item].maxIngest,Math.max(1,Math.ceil(wanted/nutrition)));if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('Invalid animal food quantity');
 recordCaravanAnimalConsumption256(g,selected.item,quantity);
 const poison=ingestionFoodPoison(selected,false,foodPoisonFactor347(w),c.random);
 if(quantity===selected.quantity)g.items.splice(g.items.indexOf(selected),1);else markPileContentWrite379(selected).quantity-=quantity;
 a.food=Math.min(animalNutritionMax(a),a.food+nutrition*quantity);
 if(poison){a.health??=createAnimalMedicalRecord256(w,a);a.health.foodPoisoning=exposeFoodPoisoningAtRecord(a.health,poison,selected.item,w.tick);}
}

export function validGroupAdditionalFoodEffects256(v:unknown):v is GroupInventoryVector {
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;return Reflect.ownKeys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k)!;return typeof k==='string'&&Object.hasOwn(d,'value')&&d.enumerable&&Object.hasOwn(ITEM_DEFINITIONS,k)&&(ITEM_DEFINITIONS[k as ItemId].nutrition>0&&!['survival-meal','pemmican',...GROUP_FORAGED_ITEMS_256].includes(k)||k==='herbal-medicine'||k==='glitterworld-medicine'||['weapon','apparel'].includes(ITEM_DEFINITIONS[k as ItemId].kind))&&typeof d.value==='number'&&Number.isSafeInteger(d.value)&&(!['herbal-medicine','glitterworld-medicine'].includes(k)||d.value<=0)&&(!['weapon','apparel'].includes(ITEM_DEFINITIONS[k as ItemId].kind)||d.value>=0);});
}
