import {effectiveCore297,effectiveLocal297} from './core-phase-297.ts';
import {createAnimalNavigationReader,moveAnimal} from './wildlife-navigation.ts';
import {captureAnimalPathGuards297,animalPathContinuationAllowed297} from './wildlife.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {animalBody} from './wildlife-health.ts';
import {animalBodySize} from './animal-life.ts';
import {finishSnowStep} from './snow-surface.ts';
import {recordShipCasketFilthMovement277} from './filth.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {World} from './types.ts';

/** Continues already-owned local paths only. Biology, jobs, destinations,
 * search quotas, flight jobs and decision RNG retain their macro owners. */
export function createAnimalCoreMovement297(world:World){
 let population:WildAnimal[]|undefined,active:WildAnimal[]|undefined;
 let guards:ReturnType<typeof captureAnimalPathGuards297>|undefined;
 let navigation:ReturnType<typeof createAnimalNavigationReader>|undefined;
 let lastArrivalCore=effectiveCore297(world),pendingFull=false,pendingSurface=false,pendingCells=false;
 const pendingActors=new Set<number>();
 const rows=()=>{
  if(population!==world.wildlife?.animals){population=world.wildlife?.animals;active=undefined;guards=undefined;navigation=undefined;}
  return active??=(population??[]).filter(a=>a.path.length>0||!!a.motion&&Math.ceil(a.motion.end*10)>lastArrivalCore||!!a.stun&&a.stun.untilCore>lastArrivalCore||!!a.strike&&a.strike.untilCore>lastArrivalCore);
 };
 const expire=(a:WildAnimal,core:number)=>{
  // Presence-based business guards must see recovery ending at THIS played
  // Core as finished. Stagger remains captured payment data.
  if(a.stun&&a.stun.untilCore<=core){delete a.stun;pendingActors.add(a.id);}
  if(a.strike&&a.strike.untilCore<=core&&a.strike.atCore<a.strike.untilCore){delete a.strike;pendingActors.add(a.id);}
 };
 const invalidate=()=>{active=undefined;guards=undefined;navigation=undefined;};
 const arrivals=()=>{
  const core=effectiveCore297(world);
  if(core===lastArrivalCore)return;
  if(core!==lastArrivalCore+1)throw Error('Animal arrival clock skipped an unplayed Core');
  // Capture before advancing the watermark, including an edge ending exactly
  // at this Core. Loading at Core7 starts at7 and never replays its arrivals.
  const candidates=rows();
  for(const a of candidates){const m=a.motion;
   if(!m||Math.ceil(m.end*10)!==core||a.state==='dead'||animalCarrier(world,a.id))continue;
   const index=m.to.z*world.width+m.to.x,depth=world.tiles[index]?.snowDepth;
   finishSnowStep(world,a,animalBodySize(a));
   // Snow and carried traces are ground presentation: published by the next
   // calm Full, not a hard one (deferredChange297).
   if(world.tiles[index]?.snowDepth!==depth)pendingSurface=true;
   // Preserve the old carried-traces operation, not ambient animal dirt. Its
   // private filth RNG is authoritative even when no visible deposit results.
   if(a.filthFeet){recordShipCasketFilthMovement277(world,a);pendingSurface=true;}
   pendingActors.add(a.id);pendingCells=true;
  }
  lastArrivalCore=core;
 };
 return {
  invalidate,
  /** Engine has committed this macro Core before biology can replace an old
   * edge. Complete only arrivals now; do not plan or start another edge here. */
  beginMacro(){arrivals();const core=effectiveCore297(world);for(const a of rows())expire(a,core);invalidate();},
  advance():{actorsChanged:number[];changedCells:boolean;requiresFull:boolean;deferredChange297:boolean}{
   arrivals();const now=effectiveLocal297(world),core=effectiveCore297(world);
   for(const a of rows()){
    expire(a,core);
    if(!a.path.length||a.motion&&a.motion.end>now)continue;
    guards??=captureAnimalPathGuards297(world);
    if(!animalPathContinuationAllowed297(world,a,core,guards))continue;
    navigation??=createAnimalNavigationReader(world,undefined,undefined,()=>effectiveLocal297(world));
    const nav=navigation(a),haul=!!a.haul&&a.haul.phase!=='holding';
    // Door operation stays with the macro hauling owner. A finished opening
    // may be used, but no inventory/permission/opening is acquired here.
    if(haul&&!nav.haulStep(a,a.path[0]!))continue;
    const motion=a.motion,x=a.x,z=a.z,pathLength=a.path.length;
    moveAnimal(world,a,haul?(from,to)=>nav.haulStep(a,to):nav.step,animalBody(a).capacities.moving,nav.geometry);
    if(a.motion!==motion||a.x!==x||a.z!==z||a.path.length!==pathLength){pendingActors.add(a.id);pendingCells=true;}
   }
   const result={actorsChanged:[...pendingActors],changedCells:pendingCells,requiresFull:pendingFull,deferredChange297:pendingSurface};
   pendingActors.clear();pendingCells=false;pendingFull=false;pendingSurface=false;return result;
  },
 };
}
