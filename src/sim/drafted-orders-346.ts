import { isColonist } from './affiliation.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import type { Command,Pawn,World } from './types.ts';

/** Schema 346: Core FloatMenuOptionProvider_Equip, _Wear, _DropEquipment and
 * _CapturePawn declare Drafted = true. Their option gives the drafted pawn an
 * ordered job (TryTakeOrderedJob) that replaces its drafted goto or attack;
 * the pawn stays drafted and waits where it stands once the job ends. Below
 * 346 the historical refusal "Démobilisez ce colon avant un ordre civil"
 * stays. No new field: the existing equipment task and capture mandate carry
 * the order. */
export const DRAFTED_ORDERS_SCHEMA_346=346;
export const draftedOrdersActive346=(version:number):boolean=>Number(version)>=DRAFTED_ORDERS_SCHEMA_346;

/** The commands a drafted colonist accepts from schema 346 on. Rescue (237),
 * consume (234), drafted tend (233) and turret reload (193) keep their own
 * older admissions in the engine. */
export function draftedOrderAdmitted346(world:Pick<World,'schemaVersion'>,command:Command):boolean {
  return draftedOrdersActive346(world.schemaVersion)&&(command.type==='order-equipment'||command.type==='order-capture');
}

/** An ordered (not automatic) equip, wear or drop of a drafted colonist. */
export function isDraftedEquipment346(world:Pick<World,'schemaVersion'>,pawn:Pawn):boolean {
  return draftedOrdersActive346(world.schemaVersion)&&!!pawn.draft&&!!pawn.equipmentTask&&!pawn.equipmentTask.automatic
    &&pawn.orders.active==='equipment'&&isColonist(pawn)&&!pawn.prisoner;
}

/** The ordered job replaces the drafted goto, queue and attack (Core
 * TryTakeOrderedJob ends the current Wait_Combat or Goto job). */
export function releaseDraftForOrder346(world:World,pawn:Pawn):void {
  if(!draftedOrdersActive346(world.schemaVersion)||!pawn.draft)return;
  cancelShooting(pawn);cancelMelee(pawn);
  pawn.draft.target=null;pawn.draft.queue=[];pawn.draft.lastActiveTick=world.tick;
}
