import {idleWanderTask300} from './idle-wander-300.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {humanMoveSpeedFactor297} from './human-move-speed-297.ts';
import {effectiveCore297,effectiveLocal297} from './core-phase-297.ts';
import {coreMoveDuration297} from './human-move-core-297.ts';
import {shipCasketCarrying277} from './ship-casket-carry-277.ts';
import {kidnapCarrying261} from './caravan-kidnap-261.ts';
import {syncGroupHumanPassenger257,groupHumanCarrying257} from './group-human-admission-257.ts';
import {finishSnowStep} from './snow-surface.ts';
import { apparelMoveFactor } from './apparel-rules.ts';
import { weatherMoveFactor } from './weather-exposure.ts';
import { isStunned } from './stun.ts';
import { actorStepAllowed } from './combat-navigation.ts';
import { syncPatient,carrierOf,cryptosleepCarrying271 } from './rescue-state.ts';
import { approachAutodoor, readyDoorEntry } from './doors.ts';
import { medicallyStopped,pawnBody } from './health-rules.ts';
import { doorAt, doorMotionTicks as importDoorDuration } from './door-rules.ts';
import type { Cell, Pawn, World } from './types.ts';
import { furnitureDelay } from './furniture-travel.ts';
import type { StructureNavigationGeometry } from './structure-navigation.ts';
import { LightEnvironmentCache, type LightReader } from './light-environment.ts';
import { edgeLength,TRAVEL_TICKS,mergeSlowIntervals,travelEnd,type TravelSegment } from './travel-timing.ts';
export { edgeLength,TRAVEL_TICKS,type TravelSegment } from './travel-timing.ts';
/** Integer search costs approximate distance; physical travel uses the exact edge length. */
export const CARDINAL_COST = 1000;
export const DIAGONAL_COST = 1414;
export const edgeCost = (a:Cell,b:Cell):number => a.x!==b.x && a.z!==b.z ? DIAGONAL_COST : CARDINAL_COST;
export function startTravel(world:World,pawn:Pawn,next:Cell,getLight?:LightReader,geometry?:StructureNavigationGeometry,freshStart297=false):boolean {
  const now=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick;
  if(isCorePhysicalSchema297(Number(world.schemaVersion))&&(pawn.motion?.end??0)>now)return false;
  if(isStunned(pawn,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):world.tick*10)||medicallyStopped(pawn)||carrierOf(world,pawn.id)||!actorStepAllowed(world,pawn,next))return false;
  if(!readyDoorEntry(world,pawn,next))return false;
  // Carry fractional tick overshoot to the next edge; never round each diagonal up.
  let start = !freshStart297&&pawn.motion && pawn.motion.end >= now-(isCorePhysicalSchema297(Number(world.schemaVersion))?.1:1) ? pawn.motion.end : now;
  const door=doorAt(world,next);if(door)start=Math.max(start,door.door!.changedAt+(1-door.door!.from)*importDoorDuration(door));
  const terrainDelay=furnitureDelay(world,pawn,next,undefined,geometry);
  let speedFactor=isCorePhysicalSchema297(Number(world.schemaVersion))?humanMoveSpeedFactor297(world,pawn,getLight):(getLight?.()??new LightEnvironmentCache().read(world)).speedAt(pawn)*pawnBody(pawn).capacities.moving*apparelMoveFactor(world,pawn)*weatherMoveFactor(world,pawn);
  if(world.schemaVersion>=86&&!isCorePhysicalSchema297(Number(world.schemaVersion))){if(pawn.prisoner)speedFactor*=.35;if(pawn.rescue?.phase==='carry'||cryptosleepCarrying271(pawn)||shipCasketCarrying277(pawn)||groupHumanCarrying257(world,pawn.id)||kidnapCarrying261(pawn))speedFactor*=.6;}
  const coreMove297=isCorePhysicalSchema297(Number(world.schemaVersion)),walk297=((pawn.mental?.crisis?.kind==='sad-wander'||pawn.mental?.crisis?.kind==='food-binge')&&!pawn.need)||(Number(world.schemaVersion)===300&&idleWanderTask300(pawn)?.kind==='move');
  if(!coreMove297&&walk297)speedFactor=Math.min(speedFactor/2,TRAVEL_TICKS/5);
  const duration = coreMove297?coreMoveDuration297(pawn,next,speedFactor,terrainDelay,walk297):TRAVEL_TICKS * edgeLength(pawn,next)/speedFactor+terrainDelay;
  const motion:TravelSegment={from:{x:pawn.x,z:pawn.z},to:{x:next.x,z:next.z},start,end:start+duration,...terrainDelay?{terrainDelay}:{},...speedFactor!==1?{speedFactor}:{}};
  if(coreMove297){motion.coreMove297=true;if(walk297)motion.coreMoveWalk297=true;}
  if(pawn.motion?.stagger||pawn.stagger) {
    const intervals=(pawn.motion?.stagger??[]).filter(s=>s.end>start).map(s=>({start:Math.max(start,s.start),end:s.end}));
    if(pawn.stagger&&pawn.stagger.untilCore/10>start)intervals.push({start:Math.max(start,pawn.stagger.sinceCore/10),end:pawn.stagger.untilCore/10});
    if(intervals.length){motion.stagger=mergeSlowIntervals(intervals);motion.end=travelEnd(motion);}
  }
  if(world.snow)motion.snowEntryPending=true;
  if(next.x!==pawn.x||next.z!==pawn.z)delete pawn.arrivalRotation;
  pawn.motion=motion;
  pawn.x=next.x; pawn.z=next.z; pawn.moveCooldown=Math.max(0,pawn.motion.end-now);
  approachAutodoor(world,pawn,next);
  finishSnowStep(world,pawn);syncPatient(world,pawn);syncGroupHumanPassenger257(world,pawn);return true;
}

/** A real pather interruption returns to the still committed source cell.
 * Ordinary retargets retain a progressed captured edge and its remaining cost. */
export function stopCapturedTravel297(world:World,pawn:Pawn):void {
  if(!isCorePhysicalSchema297(Number(world.schemaVersion)))throw Error('Physical stop requires297');
  if(carrierOf(world,pawn.id))return; // a carried mirror owns no autonomous pather
  const now=effectiveLocal297(world),m=pawn.motion;
  if(m&&m.end>now){pawn.x=m.from.x;pawn.z=m.from.z;}
  delete pawn.motion;pawn.moveCooldown=0;pawn.path=[];
  syncPatient(world,pawn);syncGroupHumanPassenger257(world,pawn);
}
