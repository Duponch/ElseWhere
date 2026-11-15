import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import type { Pawn,World } from './types.ts';

/** Schema 338: Core gives a drafted negotiator an ordered trade job
 * (TryTakeOrderedJob), which replaces its drafted goto or attack. The pawn
 * stays drafted; once the trade ends it waits where it stands. Only called
 * after every refusal of the order has passed. */
export function releaseDraftForTrade338(w:World,p:Pawn):void {
  if(w.schemaVersion<338||!p.draft)return;
  cancelShooting(p);cancelMelee(p);
  p.draft.target=null;p.draft.queue=[];p.draft.lastActiveTick=w.tick;
}
