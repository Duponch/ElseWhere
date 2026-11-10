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

/* Cell -> region slot of the last index built by any reader: a cell belongs
 * to that build when its stamp equals the build number (no clearing needed). */
const airScratch={build:0,stamp:new Uint32Array(0),slot:new Int32Array(0)};

/** One real wildlife phase, not a persistent/public temperature cache.
 * Index room references only on the first due proven actor. Temperatures stay
 * live; an explosion's replacement of the actual regions rebuilds the index.
 * This phase's geometry mutations replace regions through reconciliation. */
export function createAnimalAirReader466(world:World):AnimalAirReader466 {
  let regions:ThermalRegion[]|undefined,built=false,build=0,owners:ThermalRegion[]=[],fallback:Map<number,ThermalRegion>|undefined,outside:number|undefined;
  const atCell=(cell:Cell)=>{
    const current=world.thermal?.regions;
    // The shared scratch may have been refilled by another reader since.
    if(!built||current!==regions||!fallback&&airScratch.build!==build){
      regions=current;built=true;owners=current?current.slice():[];fallback=undefined;
      const size=world.width*world.height;
      // Preserve the public point reader's last-region priority on overlaps.
      let valid=true;
      for(const region of owners){for(const c of region.cells)if(!(Number.isInteger(c)&&c>=0&&c<size)){valid=false;break;}if(!valid)break;}
      if(valid){
        if(airScratch.stamp.length<size){airScratch.stamp=new Uint32Array(size);airScratch.slot=new Int32Array(size);}
        build=++airScratch.build;const {stamp,slot}=airScratch;
        for(let i=0;i<owners.length;i++)for(const c of owners[i]!.cells){stamp[c]=build;slot[c]=i;}
      }else{fallback=new Map();for(const region of owners)for(const c of region.cells)fallback.set(c,region);}
    }
    const key=cell.z*world.width+cell.x;
    const region=fallback?fallback.get(key):airScratch.stamp[key]===build?owners[airScratch.slot[key]!]:undefined;
    return region?.temperature??(outside??=outdoorTemperature(world));
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
