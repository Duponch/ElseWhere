import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {markActorMotionSource297} from './actor-motion-source-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import { mergeSlowIntervals,travelEnd } from './travel-timing.ts';
import { syncPatient } from './rescue-state.ts';
import type { Pawn,World } from './types.ts';

export interface StaggerState { sinceCore:number; untilCore:number }
export const BULLET_STAGGER_CORE_TICKS=95;
/** Current natural adult: size 1, duration stat 1; other races/gear must supply
 * their actual stats before using this producer. No RNG or damage prerequisite. */
export function applyBulletStagger(world:World,pawn:Pawn,atCore:number,stoppingPower:number):void {
  if(!Number.isSafeInteger(atCore)||(isCorePhysicalSchema297(Number(world.schemaVersion))?atCore!==effectiveCore297(world):atCore<Math.max(0,(world.tick-1)*10)||atCore>world.tick*10)||!Number.isFinite(stoppingPower)||stoppingPower<0)throw new RangeError('Invalid bullet stagger input');
  if(stoppingPower+.001<1)return;
  const at=atCore/10,previous=pawn.stagger;
  pawn.stagger={sinceCore:previous&&previous.untilCore>=atCore?previous.sinceCore:atCore,untilCore:Math.max(previous?.untilCore??0,atCore+BULLET_STAGGER_CORE_TICKS)};
  const m=pawn.motion;
  if(m&&m.end>at) {
    const stagger=mergeSlowIntervals([...(m.stagger??[]),{start:Math.max(m.start,at),end:pawn.stagger.untilCore/10}]);
    const updated={...m,stagger};updated.end=travelEnd(updated);
    pawn.motion=updated;markActorMotionSource297(updated);pawn.moveCooldown=Math.max(0,updated.end-(isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick));syncPatient(world,pawn);
  }
}
export function expireStaggers(world:World):void {
  for(const p of world.pawns)if(p.stagger&&p.stagger.untilCore<=(isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):world.tick*10))delete p.stagger;
}
export function validStagger(value:unknown,version:number,tick:number,coreNow297?:number):boolean {
 const physicalCoreNow297=validationCore297(version,tick,coreNow297);if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(physicalCoreNow297))return false;
  if(value===undefined)return true;
  if(version<57||!value||typeof value!=='object')return false;
  const s=value as StaggerState;
  return Object.keys(s).every(k=>k==='sinceCore'||k==='untilCore')&&Number.isSafeInteger(s.sinceCore)&&s.sinceCore>=0&&s.sinceCore<=physicalCoreNow297&&Number.isSafeInteger(s.untilCore)&&s.untilCore>physicalCoreNow297&&s.untilCore<=physicalCoreNow297+95&&s.untilCore-s.sinceCore>=95;
}
