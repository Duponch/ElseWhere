import {isFurnitureCSchema363} from './furniture-c-363.ts';
import {isGroundSleepingSpotKind} from './bed-kinds.ts';
import {isWetTerrain} from './shallow-water.ts';
import {prepareBedOwnershipTransition256} from './actor-bed-transition-256.ts';
import {hasTravellingCargo,interruptWork} from './interrupted-cargo.ts';
import { footprintCells } from './definitions.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import { isRoofJob } from './roof-rules.ts';
import { humanSleepingSpotActors,planPawnDrops,releaseWork,type DropPlan } from './work-release.ts';
import type { Cell,CommandResult,DesignateCommand,Structure,World } from './types.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
/** A free, human, single floor emplacement. Ground possessions and zones stay. */
export function canPlaceHumanSleepingSpot(world:World,c:DesignateCommand):CommandResult {
  if(world.schemaVersion<232||c.kind!=='sleeping-spot'&&!(c.kind==='double-sleeping-spot'&&isFurnitureCSchema363(world.schemaVersion))||c.material!==undefined||c.floor!==undefined||c.targetId!==undefined
    ||c.orientation!==undefined&&(!Number.isInteger(c.orientation)||c.orientation<0||c.orientation>3))
    return {ok:false,code:'invalid-command',reason:'Couchage au sol sans matériau, orientation 0–3.'};
  const cells=footprintCells({...c,orientation:c.orientation??0,footprint:'standard'});
  if(cells.some(p=>!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.z)||p.x<0||p.z<0||p.x>=world.width||p.z>=world.height))
    return {ok:false,code:'out-of-bounds',reason:'Empreinte du couchage hors de la carte.'};
  if(cells.some(p=>(['rock','water'].includes(world.tiles[p.z*world.width+p.x]!.terrain)||isWetTerrain(world.tiles[p.z*world.width+p.x]!.terrain)&&!world.tiles[p.z*world.width+p.x]!.bridge)
    ||world.resources.some(r=>(r.kind==='rock'||r.kind==='tree')&&same(r,p))))
    return {ok:false,code:'occupied',reason:'Dégager la roche ou l’arbre et choisir un sol praticable.'};
  if(world.structures.some(s=>sharesConstructionLayer(s.kind,c.kind)&&footprintCells(s).some(p=>cells.some(q=>same(p,q))))
    ||world.jobs.some(j=>!isRoofJob(j)&&sharesConstructionLayer(j.furniture?.kind??j.kind,c.kind)&&footprintCells(j).some(p=>cells.some(q=>same(p,q)))))
    return {ok:false,code:'occupied',reason:'Un ouvrage ou son plan occupe le couchage.'};
  if(!Number.isSafeInteger(world.nextId+1)||world.structures.length>=world.width*world.height)
    return {ok:false,code:'invalid-command',reason:'Limite des emplacements atteinte.'};
  return {ok:true};
}
export function placeHumanSleepingSpot(world:World,c:DesignateCommand):CommandResult {
  const result=canPlaceHumanSleepingSpot(world,c);if(!result.ok)return result;
  world.structures.push({id:world.nextId++,kind:c.kind==='double-sleeping-spot'?'double-sleeping-spot':'sleeping-spot',x:c.x,z:c.z,orientation:c.orientation??0,footprint:'standard'});
  for(const p of world.pawns)p.planCooldown=0;
  return {ok:true};
}
/** All interruptions share one preflight; no partial removal can lose cargo. */
export function removeHumanSleepingSpot(world:World,spot:Structure,planned?:DropPlan):CommandResult {
  if(!isGroundSleepingSpotKind(spot.kind)||!world.structures.includes(spot))return {ok:false,code:'missing-target',reason:'Couchage au sol introuvable.'};
  const actors=humanSleepingSpotActors(world,new Set([spot.id]));
  const drops=planned??planPawnDrops(world,new Set(actors.filter(p=>!hasTravellingCargo(world,p)).map(p=>p.id)));
  if(!drops)return {ok:false,code:'occupied',reason:'Pas de place pour conserver les objets portés.'};
  const bedOwnership=prepareBedOwnershipTransition256(world,spot,'destroy');
  // Release while the occupied service still exists, so completed clinical and
  // room observations are settled against the correct original bed.
  for(const p of actors){if(hasTravellingCargo(world,p))interruptWork(world,p,true);else if(!releaseWork(world,p,drops))throw Error('Preflighted sleeping-spot interruption failed.');p.needCooldown=0;}
  for(const p of world.pawns){if(p.bedId===spot.id){p.bedId=null;delete p.bedSlot;}p.planCooldown=0;}
  world.structures=world.structures.filter(s=>s.id!==spot.id);
  bedOwnership?.commit();
  return {ok:true};
}
