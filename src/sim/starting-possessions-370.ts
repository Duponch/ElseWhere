import { CORE_BACKSTORIES_370,isCoreBackstoryId370 } from './core-backstories-370.ts';
import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import type { StartingCandidateDescriptor } from './starting-candidates.ts';
import type { Pawn } from './types.ts';

/** Schema 370: StartingPawnUtility.GeneratePossessions for a starting
 * colonist (Crashlanded has no ScenPart_NoPossessions). Core facts:
 * - at most 2 possessions (MaxPossessionsCount);
 * - addiction drugs first: a new Elsewhere colonist has no addiction;
 * - with a 25 % chance (ChanceToHavePossessionsFromBackground), each
 *   possession of the ADULTHOOD story, count clamped to [1, stack limit];
 * - then trait possessions (25 %) and a random possession (6 %): left out.
 * Only the possessions Elsewhere has as plain items are given (the others,
 * stuffed weapons and apparel, books, schematics and minified furniture, are
 * skipped). The draw is private to the candidate descriptor, so the preview
 * and the departure agree. */
export const CORE_POSSESSION_ITEMS_370:Readonly<Record<string,ItemId>>=Object.freeze({
  MealFine:'fine-meal',MealLavish:'lavish-meal',MedicineUltratech:'glitterworld-medicine',MedicineHerbal:'herbal-medicine',
  BlocksMarble:'marble-blocks',Beer:'beer',Jade:'jade',WoodLog:'wood',Leather_Bear:'bear-leather',Meat_Pig:'pig-meat',
  Meat_Bison:'bison-meat',Kibble:'kibble',Milk:'milk',Cloth:'cloth',Gun_Autopistol:'autopistol',Bow_Short:'short-bow',
});
export const MAX_POSSESSIONS_370=2;
export const BACKGROUND_POSSESSION_CHANCE_370=.25;
const hash=(seed:number,serial:number,generation:number):number=>{
  let n=(seed^Math.imul(serial,0x9e3779b1)^Math.imul(generation,0x85ebca6b)^0x370a55e)>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/0x100000000;
};
export interface StartingPossession370 {readonly item:ItemId;readonly quantity:number}
export function startingPossessions370(seed:number,descriptor:Pick<StartingCandidateDescriptor,'serial'|'generation'>,pawn:Pick<Pawn,'background'>):StartingPossession370[] {
  const id=pawn.background?.adulthood;
  if(!isCoreBackstoryId370(id)||hash(seed,descriptor.serial,descriptor.generation)>=BACKGROUND_POSSESSION_CHANCE_370)return [];
  const out:StartingPossession370[]=[];
  for(const [def,count] of CORE_BACKSTORIES_370[id].possessions){
    if(out.length>=MAX_POSSESSIONS_370)break;
    const item=CORE_POSSESSION_ITEMS_370[def];if(!item)continue;
    out.push({item,quantity:Math.min(ITEM_DEFINITIONS[item].stackLimit,Math.max(1,count))});
  }
  return out;
}
