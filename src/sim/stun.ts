import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import { mergeSlowIntervals,travelEnd } from './travel-timing.ts';
import { syncPatient } from './rescue-state.ts';
import type { Pawn,World } from './types.ts';
export interface StunState {sinceCore:number;untilCore:number}
/** Duration is a documented calibration (45 Core ticks): published sources
 * disagree. Stun pauses an edge in place; stagger only changes its pace. */
export function applyMeleeStun(world:World,pawn:Pawn,core:number):void {
  if(pawn.state==='dead')return;
  const previous=pawn.stun;
  pawn.stun={sinceCore:previous&&previous.untilCore>=core?previous.sinceCore:core,untilCore:Math.max(previous?.untilCore??0,core+meleeStunCore318(world.schemaVersion))};
  if(world.schemaVersion<198&&pawn.shooting?.stance?.phase==='aim')pawn.shooting.stance=null;
  const m=pawn.motion;
  if(m&&m.end>core/10){pawn.motion={...m,stuns:mergeSlowIntervals([...(m.stuns??[]),{start:Math.max(m.start,core/10),end:pawn.stun.untilCore/10}])};pawn.motion.end=travelEnd(pawn.motion);pawn.moveCooldown=Math.max(0,pawn.motion.end-(isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick));syncPatient(world,pawn);}
}
/** Core Blunt stun: 120 ticks from schema 318 (45, a calibration, before). */
export const meleeStunCore318=(version:number):number=>version>=318?120:45;
export const isStunned=(pawn:Pawn,core:number):boolean=>!!pawn.stun&&pawn.stun.untilCore>core;
