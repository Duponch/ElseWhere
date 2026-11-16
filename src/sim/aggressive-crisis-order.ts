import { isRoomDoor } from './door-rules.ts';
import type { MeleeState } from './melee-state.ts';
import { isAggressiveMentalCrisis } from './mental-state.ts';
import type { Pawn,World } from './types.ts';

/** A serialized flag never grants involuntary violence by itself: the current
 * crisis owns its primary target or a real door blocking that pursuit. */
export function mentalMeleeOwnership(w:World,p:Pawn,order:NonNullable<MeleeState['order']>):boolean {
  const c=p.mental?.crisis;if(order.auto!=='mental'||!c||!isAggressiveMentalCrisis(c))return false;
  if(c.kind==='tantrum')return !!order.structure&&order.targetId===c.targetId&&order.untilCore===undefined;
  if(c.kind==='berserk'&&(c.jobUntilCore===null||order.untilCore!==c.jobUntilCore))return false;
  if(c.kind==='murderous-rage'&&order.untilCore!==undefined)return false;
  return c.targetId!==null&&(order.structure?w.structures.some(s=>s.id===order.targetId&&isRoomDoor(s.kind)&&Math.max(Math.abs(s.x-p.x),Math.abs(s.z-p.z))<=1):order.targetId===c.targetId);
}
