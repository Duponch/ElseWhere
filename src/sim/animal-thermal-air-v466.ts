import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {animalThermalProfile466,type AnimalThermalOpportunity466} from './animal-thermal-v466.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {outdoorTemperature,type ThermalRegion} from './temperature.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Cell,World} from './types.ts';

export interface AnimalAirReader466 {
  atCell(cell:Cell):number;
  atAnimal(animal:WildAnimal):number;
}

/** One real wildlife phase, not a persistent/public temperature cache.
 * Index room references only on the first due proven actor. Temperatures stay
 * live; an explosion's replacement of the actual regions rebuilds the index.
 * This phase's geometry mutations replace regions through reconciliation. */
export function createAnimalAirReader466(world:World):AnimalAirReader466 {
  let regions:ThermalRegion[]|undefined,index:Map<number,ThermalRegion>|undefined,outside:number|undefined;
  const atCell=(cell:Cell)=>{
    const current=world.thermal?.regions;
    if(!index||current!==regions){
      regions=current;index=new Map();
      // Preserve the public point reader's last-region priority on overlaps.
      for(const region of current??[])for(const cell of region.cells)index.set(cell,region);
    }
    return index.get(cell.z*world.width+cell.x)?.temperature??(outside??=outdoorTemperature(world));
  };
  return {atCell,atAnimal:animal=>{
    const carrier=animalCarrier(world,animal.id),owner=carrier??animal;
    // Logical destinations are anticipated for travel. Actual room exposure
    // changes only when the captured physical edge is complete.
    const cell=owner.motion&&owner.motion.end>world.tick?owner.motion.from:owner;
    return atCell(cell);
  }};
}

/** Clinical cadence belongs here; destination queries never invent a dose. */
export function createAnimalThermalPass466(world:World,air=createAnimalAirReader466(world)):(animal:WildAnimal)=>AnimalThermalOpportunity466|undefined {
  return animal=>{
    if(!isSchema287OrLater(Number(world.schemaVersion))||animal.state==='dead'||animal.health?.death||
      !groupPawnInterval256(animal.id,world.tick*10,60,10)||!animalThermalProfile466(animal))return;
    // AnyParentSpawned stays true for a patient carried on this actual map.
    return {temperature:air.atAnimal(animal),mapHeld:true};
  };
}
