import {isAnimalItem256,isAnimalItem382} from './animal-items-v256.ts';
import {isCoreStartingApparel256} from './starting-gear-256.ts';
export const CAVE_ITEM_DEFINITIONS_256={'raw-fungus':Object.freeze({label:'Champignons crus',kind:'food',stackLimit:75,nutrition:5,maxIngest:75,color:0xaf9a84})} as const;
export const isCaveProduct256=(item:unknown):item is 'raw-fungus'=>item==='raw-fungus';
/** Admission fence only, never an animal/diet classification. Prospective
 * mined jade and necessary initial supplies share it so RAW/full/delta/items/
 * loss ledgers keep one boundary. Never use this fence as a food classifier. */
export const isFutureEcologyItem256=(item:unknown):boolean=>item==='jade'||isCoreStartingApparel256(item)||isCaveProduct256(item)||isAnimalItem256(item);
/** Original 256 checks also refuse the new species' own products, including
 * special harvests, before 382 (including detached loss ledgers and deltas). */
export const unavailableEcologyItem=(item:unknown,version:number):boolean=>version<382&&(item==='ambrosia'||item==='dye'||isAnimalItem382(item)||version<256&&isFutureEcologyItem256(item));
export const CAVE_PRODUCT_FACTS_256={massGrams:30,hitPoints:60,flammability:1,deterioration:6,rotDays:30,marketValue:1.1,nutrition:.05,foodPoisonHuman:.02,foodType:'Fungus',rawBad:true} as const;
