import {appendStructureEntries} from './structure-navigation.ts';
import {claimLocalActorBed256} from './actor-bed-local-256.ts';
import {isWetTerrain} from './shallow-water.ts';
import { footprintCells } from './definitions.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import { isRoofJob } from './roof-rules.ts';
import { animalSpotAvailable,releaseAnimalSpotBindings } from './animal-rest.ts';
import type { Cell,CommandResult,DesignateCommand,Structure,World } from './types.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const refusal=(reason:string):CommandResult=>({ok:false,code:'occupied',reason});

/** A free floor marking. Existing zones, plants and ground possessions remain. */
export function canPlaceAnimalSpot(world:World,c:DesignateCommand):CommandResult {
  if(world.schemaVersion<221||c.kind!=='animal-sleeping-spot'||c.material!==undefined||c.floor!==undefined||c.targetId!==undefined||c.orientation!==undefined&&c.orientation!==0)
    return {ok:false,code:'invalid-command',reason:'Emplacement animal non rotatif et sans matériau.'};
  if(!Number.isSafeInteger(c.x)||!Number.isSafeInteger(c.z)||c.x<0||c.z<0||c.x>=world.width||c.z>=world.height)
    return {ok:false,code:'out-of-bounds',reason:'Emplacement hors de la carte.'};
  if((['rock','water'].includes(world.tiles[c.z*world.width+c.x]!.terrain)||isWetTerrain(world.tiles[c.z*world.width+c.x]!.terrain)&&!world.tiles[c.z*world.width+c.x]!.bridge)||world.resources.some(r=>r.kind==='rock'&&same(r,c)))
    return refusal('Dégager la roche ou choisir un terrain praticable.');
  if(world.structures.some(s=>sharesConstructionLayer(s.kind,c.kind,world.schemaVersion,s.orientation,c.orientation)&&footprintCells(s).some(p=>same(p,c)))
    ||world.jobs.some(j=>!isRoofJob(j)&&sharesConstructionLayer(j.furniture?.kind??j.kind,c.kind,world.schemaVersion,j.orientation,c.orientation)&&footprintCells(j).some(p=>same(p,c))))
    return refusal('Un ouvrage ou son plan occupe cet emplacement.');
  if(!Number.isSafeInteger(world.nextId+1)||world.structures.length>=world.width*world.height)
    return {ok:false,code:'invalid-command',reason:'Limite des emplacements atteinte.'};
  return {ok:true};
}
export function placeAnimalSpot(world:World,c:DesignateCommand):CommandResult {
  const result=canPlaceAnimalSpot(world,c);if(!result.ok)return result;
  appendStructureEntries(world,{id:world.nextId++,kind:'animal-sleeping-spot',x:c.x,z:c.z,orientation:0,footprint:'standard'});
  for(const p of world.pawns)p.planCooldown=0;
  return {ok:true};
}
export function removeAnimalSpot(world:World,spot:Structure):void {
  releaseAnimalSpotBindings(world,spot.id);
  world.structures=world.structures.filter(s=>s.id!==spot.id);
  for(const p of world.pawns)p.planCooldown=0;
}
export function applyAnimalSpotMedical(world:World,c:{type:'animal-spot-medical';spotId:number;enabled:boolean}):CommandResult {
  if(world.schemaVersion<221||!Number.isSafeInteger(c.spotId)||typeof c.enabled!=='boolean'||Object.keys(c).some(k=>!['type','spotId','enabled'].includes(k)))
    return {ok:false,code:'invalid-command',reason:'Usage médical invalide.'};
  const spot=world.structures.find(s=>s.id===c.spotId&&s.kind==='animal-sleeping-spot');
  if(!spot)return {ok:false,code:'missing-target',reason:'Emplacement animal introuvable.'};
  if(!!spot.medical===c.enabled)return {ok:true};
  const occupant=world.wildlife?.animals.find(a=>a.animalRest?.spotId===spot.id&&a.animalRest.phase==='sleep');
  const wasSleeping=occupant?.state==='sleeping';
  releaseAnimalSpotBindings(world,spot.id);
  if(c.enabled)spot.medical=true;else delete spot.medical;
  // Actual occupancy survives a role change when the patient can use it.
  if(occupant&&same(occupant,spot)&&animalSpotAvailable(world,spot,occupant)){
    occupant.animalRest={spotId:spot.id,phase:'sleep'};
    if(wasSleeping)occupant.state='sleeping';
    if(!spot.medical&&occupant.domestic)claimLocalActorBed256(world,occupant,spot);
  }
  for(const p of world.pawns)p.planCooldown=0;
  return {ok:true};
}
