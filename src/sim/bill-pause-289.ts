import {isSchema289OrLater} from './schema-compatibility-257.ts';
import {countedProducts} from './cooking-bills.ts';
import {nextBillReservePaused289,supportsBillReservePause289} from './bill-pause-rules-289.ts';
import type {CookingBill} from './cooking-types.ts';
import type {World} from './types.ts';

/** A fresh synchronous pass only. Identical recipe/filter counters share one
 * read; no stale inter-tick cache or new global reserve is introduced. */
export function createBillReserveCountReader289(world:World):(bill:CookingBill)=>number {
  const counts=new Map<string,number>();
  return bill=>{
    const f=bill.apparelCount;
    const key=bill.recipe+(f?`|${f.hpMin}|${f.hpMax}|${f.qualityMin}|${f.qualityMax}|${f.includeEquipped}|${f.includeTainted374}`:'|legacy');
    const previous=counts.get(key);if(previous!==undefined)return previous;
    const count=countedProducts(world,bill);counts.set(key,count);return count;
  };
}
function commit(bill:CookingBill,read:(bill:CookingBill)=>number):void {
  const state=bill.reservePause;if(!state)return;
  const paused=nextBillReservePaused289(bill,()=>read(bill));
  if(paused!==state.paused)state.paused=paused;
}
/** Explicit local simulation boundary, never called by UI, save/load, a
 * diagnostic or a planning query. Packed/off-map bills retain their memory. */
export function reconcileBillReservePauses289(world:World):void {
  if(!isSchema289OrLater(world.schemaVersion))return;
  let read:ReturnType<typeof createBillReserveCountReader289>|undefined;
  for(const station of world.structures){
    if(!station.bills)continue;
    for(const bill of station.bills){
      if(!bill.reservePause||!supportsBillReservePause289(bill.recipe))continue;
      commit(bill,read??=createBillReserveCountReader289(world));
    }
  }
}
/** A successful policy/target transaction evaluates only its actual original. */
export function reconcileBillReservePause289(world:World,bill:CookingBill):void {
  if(!isSchema289OrLater(world.schemaVersion)||!bill.reservePause)return;
  commit(bill,b=>countedProducts(world,b));
}
export function canResumeBillReserve289(world:World,bill:CookingBill):boolean {
  return isSchema289OrLater(world.schemaVersion)&&bill.mode==='until'&&!!bill.reservePause?.enabled&&bill.reservePause.paused
    &&countedProducts(world,bill)<bill.target;
}
