import {detachMissingBills} from './unfinished.ts';
import {detachMissingSmithingBills267} from './smithing-work-267.ts';
import {detachMissingGunBills} from './gun-work.ts';
import {detachMissingFlakBills} from './flak-work.ts';
import {detachMissingArtBills} from './art-work.ts';
import {detachMissingComponentBills} from './component-work.ts';
import {detachMissingProstheticBills273} from './prosthetic-work-273.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import type {MaterialPile,World} from './types.ts';

/** Literal mutable/public readers retain their existing independently callable
 * passes. The private macro owns seven contiguous queries of the same piles;
 * these only delete their own workpiece's missing bill link, not a bill or an
 * actor. Capture one directory and perform detachments in the old family then
 * source order. */
export function detachMissingMacroWorkBills379(world:World):void {
 if(!terrainJournalReadOwner()){
  detachMissingBills(world);detachMissingSmithingBills267(world);detachMissingGunBills(world);detachMissingFlakBills(world);detachMissingArtBills(world);detachMissingComponentBills(world);detachMissingProstheticBills273(world);return;
 }
 type Work={billId?:number};type Link={pile:MaterialPile,work:Work};
 const rows:Link[][]=[[],[],[],[],[],[],[]];let count=0;
 const add=(family:number,pile:MaterialPile,work:Work|undefined)=>{if(work?.billId){rows[family]!.push({pile,work});count++;}};
 for(const pile of world.piles){
  // Keep nonstandard/legacy component identities visible too: admission of
  // a missing link does not need (or assert) the workpiece kind's schema.
  if(pile.unfinished?.billId)add(0,pile,pile.unfinished);
  if(pile.smithingWork?.billId)add(1,pile,pile.smithingWork);
  if(pile.gunWork?.billId)add(2,pile,pile.gunWork);
  if(pile.flakWork?.billId)add(3,pile,pile.flakWork);
  if(pile.artWork?.billId)add(4,pile,pile.artWork);
  if(pile.componentWork?.billId)add(5,pile,pile.componentWork);
  if(pile.prostheticWork273?.billId)add(6,pile,pile.prostheticWork273);
 }
 if(!count)return;
 const bills=new Set<number>();for(const structure of world.structures)for(const bill of structure.bills??[])bills.add(bill.id);
 for(const pack of world.packed)for(const bill of pack.building.bills??[])bills.add(bill.id);
 for(const family of rows)for(const {pile,work} of family)if(work.billId&&!bills.has(work.billId)){markPileContentWrite379(pile);delete work.billId;}
}
