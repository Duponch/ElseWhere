import {roofCells} from './roof-rules.ts';
import {annualNaturalLight} from './environment.ts';
import {terrainWriteCount} from './terrain-mutation-journal.ts';
import {isSchema300OrLater} from './schema-compatibility-257.ts';
import {idleWanderTask300,idleMotionAllowed300,idleOtherActivity300,releaseIdleWander300} from './idle-wander-300.ts';
import {createAnimalCoreMovement297} from './animal-core-movement-297.ts';
import {captureCorePassengers297} from './core-passengers-297.ts';
import {advancePhysicalDoors297,invalidatePhysicalDoors297} from './doors.ts';
import {recordFilthMovement297} from './filth.ts';
import {finishSnowStep} from './snow-surface.ts';
import {isForcedConsuming} from './consuming.ts';
import {isDraftedTending} from './drafted-tending.ts';
import {isDraftedRescue} from './rescue.ts';
import {effectiveCore297,effectiveLocal297} from './core-phase-297.ts';
import {startTravel} from './movement.ts';
import {processDraft} from './drafting.ts';
import {blockedCells,canStep} from './pathfinding.ts';
import {CIVIL_TRANSIT_BLOCKERS} from './travel.ts';
import {captureStructureNavigation} from './structure-navigation.ts';
import {carrierOf} from './rescue-state.ts';
import {medicallyStopped} from './health-rules.ts';
import {isStunned} from './stun.ts';
import {sharedLightEnvironmentCache,type LightEnvironmentCache,type LightReader} from './light-environment.ts';
import type {SearchBudget} from './work-planner.ts';
import type {Cell,World} from './types.ts';

/** No needs, work production or autonomous planner is run at the physical rate. */
export function createCoreMovement297(world:World){
 let blocked:Uint8Array|undefined,light:LightEnvironmentCache=sharedLightEnvironmentCache(world),passengers:ReturnType<typeof captureCorePassengers297>|undefined;
 let owned=world.corePathBudget297;
 if(!owned){if(world.phaseCore297!==0)throw Error('Missing owned path budget inside physical interval');owned=world.corePathBudget297={tick:world.tick,remaining:8,pairs:32768};}
 if(owned.tick!==world.tick)throw Error('Stale physical path budget');
 const budget:SearchBudget={get remaining(){return owned!.remaining;},set remaining(value){owned!.remaining=value;},get pairs(){return owned!.pairs;},set pairs(value){owned!.pairs=value;}};
 // One light snapshot per advance() while its inputs stay the same objects:
 // structures (membership), tiles and their write count, roofs, resources
 // (cave plant light) and the sky light of the hour. Door states do not affect
 // light (a doorway always blocks it) and source activity (fuel, power) is not
 // changed by a movement pass. read() returns the same snapshot while those
 // inputs are unchanged, so this is the same answer without its full checks.
 let lightPass:ReturnType<LightEnvironmentCache['read']>|undefined;
 let lightKey:{structures:World['structures'];count:number;first:unknown;last:unknown;tiles:World['tiles'];writes:number;roofs:ReadonlySet<number>;resources:World['resources'];sky:number}|undefined;
 const passLight=()=>{
  const structures=world.structures,count=structures.length,tiles=world.tiles,roofs=roofCells(world),sky=annualNaturalLight(world),k=lightKey;
  if(lightPass&&k&&k.structures===structures&&k.count===count&&k.first===structures[0]&&k.last===structures[count-1]&&k.tiles===tiles
   &&k.writes===terrainWriteCount(tiles)&&k.roofs===roofs&&k.resources===world.resources&&(k.sky===sky||k.sky!==k.sky&&sky!==sky))return lightPass;
  lightPass=light.read(world);
  lightKey={structures,count,first:structures[0],last:structures[count-1],tiles,writes:terrainWriteCount(tiles),roofs,resources:world.resources,sky};
  return lightPass;
 };
 const readLight:LightReader=Object.assign(()=>passLight(),{speedAt:(cell:Cell)=>light.speedAt(world,cell,passLight)});
 const grid=()=>blocked??=blockedCells(world);
 const animals=createAnimalCoreMovement297(world);
 return {
  invalidate(){lightPass=undefined;lightKey=undefined;animals.invalidate();passengers=undefined;budget.structureGeometry=undefined;invalidatePhysicalDoors297(world);blocked=undefined;},
  beginMacro(next:SearchBudget){animals.beginMacro();passengers=undefined;owned=world.corePathBudget297={tick:world.tick,remaining:next.remaining,pairs:next.pairs};budget.stats=next.stats;budget.structureGeometry=next.structureGeometry;invalidatePhysicalDoors297(world);blocked=undefined;},
  budget(){return budget;},
  advance():{actorsChanged:number[];changedCells:boolean;requiresFull:boolean;topologyChanged:boolean;deferredChange297:boolean;doorsMoved297:readonly number[]}{
   lightPass=undefined;lightKey=undefined;
   const now=effectiveLocal297(world),core=effectiveCore297(world),changed:number[]=[];let changedCells=false,requiresFull=false,deferredChange297=false;
   const touchPassengers=(carrier:World['pawns'][number])=>{
    passengers??=captureCorePassengers297(world);
    for(const mirror of passengers.get(carrier.id)??[]){if(Object.hasOwn(mirror,'moveCooldown'))mirror.moveCooldown=carrier.moveCooldown;if(!changed.includes(mirror.id))changed.push(mirror.id);}
   };
   for(const pawn of world.pawns){
    const before=pawn.moveCooldown;pawn.moveCooldown=Math.max(0,(pawn.motion?.end??now)-now);
    if(before!==pawn.moveCooldown){changed.push(pawn.id);touchPassengers(pawn);}
    if(before>0&&pawn.moveCooldown===0)changedCells=true;
    if(before>0&&pawn.moveCooldown===0&&!carrierOf(world,pawn.id)){
      const m=pawn.motion,index=m?m.to.z*world.width+m.to.x:-1,depth=index<0?undefined:world.tiles[index]?.snowDepth;
      finishSnowStep(world,pawn);const snowChanged=index>=0&&world.tiles[index]?.snowDepth!==depth;
      // Footprint filth and trodden snow are ground presentation, and a released
      // idle wander changes no physical field: the next calm Full (or the macro
      // dependency check) publishes them, not a hard Full.
      deferredChange297=recordFilthMovement297(world,pawn)||snowChanged||deferredChange297;
    }
    if(isSchema300OrLater(Number(world.schemaVersion))&&idleWanderTask300(pawn)?.kind==='move'&&!idleMotionAllowed300(world,pawn)){releaseIdleWander300(pawn,!idleOtherActivity300(pawn));if(!changed.includes(pawn.id))changed.push(pawn.id);deferredChange297=true;}
    if(pawn.moveCooldown>0)continue;
    // Clinical/task invalidation stays authoritative. A stale path is never
    // extended after an impact, command, retirement or ownership transfer.
    if(pawn.state!=='moving'&&!pawn.draft)continue;
    const tactical=!!pawn.draft&&!isForcedConsuming(pawn)&&!isDraftedTending(pawn)&&!isDraftedRescue(world,pawn);
    const target=pawn.draft?.target,tacticalActive=tactical&&(pawn.draft!.queue.length>0||!!target&&(target.x!==pawn.x||target.z!==pawn.z)||before>0);
    if(!pawn.path.length&&!tacticalActive)continue;
    if(medicallyStopped(pawn)||isStunned(pawn,core)||carrierOf(world,pawn.id))continue;
    const x=pawn.x,z=pawn.z,m=pawn.motion;
    if(tactical)processDraft(world,pawn,grid,budget,readLight);
    // The shared structure index (validated on each read) answers the door-corner
    // test of a diagonal step without scanning every structure, as for transit exits.
    else {const next=pawn.path[0];if(next&&canStep(world,pawn,next,grid(),CIVIL_TRANSIT_BLOCKERS,captureStructureNavigation(world))&&startTravel(world,pawn,next,readLight))pawn.path.shift();}
    if(m!==pawn.motion||x!==pawn.x||z!==pawn.z){if(!changed.includes(pawn.id))changed.push(pawn.id);touchPassengers(pawn);changedCells=true;}
   }
   const animal=animals.advance();for(const id of animal.actorsChanged)if(!changed.includes(id))changed.push(id);
   changedCells||=animal.changedCells;requiresFull||=animal.requiresFull;deferredChange297||=animal.deferredChange297;
   const doors=advancePhysicalDoors297(world);if(doors.topologyChanged)animals.invalidate();
   // Re-entering an open door or extending its close deadline changes nothing
   // visible; doors that open or close are reported for a door patch; a door
   // that reveals fog keeps the hard barrier.
   if(doors.changed&&!doors.moved297.length&&!doors.exploration297)deferredChange297=true;
   return {actorsChanged:changed,changedCells,requiresFull:doors.exploration297||requiresFull,topologyChanged:doors.topologyChanged,deferredChange297,doorsMoved297:doors.moved297.map(s=>s.id)};
  }
 };
}
