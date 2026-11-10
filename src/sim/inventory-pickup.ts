/** Shared contact pickup without merging away a receipt identity. */
import {assignPileOwner} from './pile-index.ts';
import {validAiCorePile298} from './victory-content-save-298.ts';
import type { MaterialPile, Pawn, World } from './types.ts';
import { copyPileCondition } from './pile-condition.ts';

export interface InventoryPickupPlan {
  readonly source:MaterialPile;
  readonly expectedSource:string;
  readonly expectedPiles:MaterialPile[];
  readonly expectedPileCount:number;
  readonly expectedNextId:number;
  readonly expectedTick:number;
  readonly carrier:Pawn;
  readonly quantity:number;
  readonly pawnId:number;
  readonly carried:MaterialPile;
  readonly split:boolean;
}
/** Physical contact/reservations/carrier capacity are caller's real preflight. */
export function planInventoryPickup(world:World,source:MaterialPile,pawnId:number,quantity:number):InventoryPickupPlan|undefined {
  const carrier=world.pawns.find(p=>p.id===pawnId);
  if(!world.piles.includes(source)||source.owner.type!=='ground'||!Number.isSafeInteger(quantity)||quantity<1||quantity>source.quantity
    ||!Number.isSafeInteger(pawnId)||pawnId<1||!carrier)return undefined;
  if((source.kind==='ai-core'||source.item==='ai-core')&&(!validAiCorePile298(source,world.schemaVersion)||quantity!==1))return undefined;
  const split=quantity<source.quantity;
  if(split&&(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1)))return undefined;
  const carried=split?{...source,id:world.nextId,quantity,owner:{type:'inventory' as const,pawnId},...copyPileCondition(source)}:source;
  return {source,expectedSource:JSON.stringify(source),expectedPiles:world.piles,expectedPileCount:world.piles.length,
    expectedNextId:world.nextId,expectedTick:world.tick,carrier,quantity,pawnId,carried,split};
}
export function inventoryPickupCurrent(world:World,plan:InventoryPickupPlan):boolean {
  if((plan.source.kind==='ai-core'||plan.source.item==='ai-core')&&(!validAiCorePile298(plan.source,world.schemaVersion)||plan.quantity!==1||plan.split||plan.carried!==plan.source))return false;
  return world.tick===plan.expectedTick&&world.pawns.includes(plan.carrier)&&plan.carrier.id===plan.pawnId
    &&world.piles===plan.expectedPiles&&world.piles.length===plan.expectedPileCount&&world.nextId===plan.expectedNextId&&world.piles.includes(plan.source)
    &&JSON.stringify(plan.source)===plan.expectedSource;
}
/** Caller invokes inside synchronous prevalidated transaction. No fail after writes.
 * Full source retains object+ID; partial creates exactly one real split identity. */
export function commitInventoryPickup(world:World,plan:InventoryPickupPlan):boolean {
  if(!inventoryPickupCurrent(world,plan))return false;
  if(plan.split){plan.source.quantity-=plan.quantity;world.nextId++;world.piles.push(plan.carried);}
  else assignPileOwner(plan.source,{type:'inventory',pawnId:plan.pawnId});
  return true;
}
