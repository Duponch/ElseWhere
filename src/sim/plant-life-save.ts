import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validPartyNonOwner292} from './party-state-292.ts';
import {validSownResource291} from './forestry-save-291.ts';
import {isPlantSpeciesInVersion} from './biome-flora.ts';
import {validInitialPlantAge256} from './initial-plant-age-256.ts';
import {validPausedTreeLife,hasPausedTreeClock} from './tree-transfer-clock.ts';
import { isPlant } from './plants.ts';
import { PLANT_LIFE_INTERVAL } from './plant-life.ts';
import {isDeadStump382} from './native-special-plants-382.ts';
import type { Resource,World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;

export function validOrdinaryPlantLife(plant:Partial<Resource>,version:number,world:Pick<World,'tick'|'climate'>):boolean {
  if(!validSownResource291(plant,version))return false;
  if(plant.species!==undefined&&!isPlantSpeciesInVersion(plant.species,version))return false;
  if(plant.kind==='tinctoria'&&version<382||isDeadStump382(plant.species)&&plant.kind!=='wild-plant')return false;
  if(plant.kind==='healroot'&&version<182)return false;
  if(plant.species==='healroot-wild'&&version<167)return false;
  const life:unknown=plant.plantLife;
  if(!validInitialPlantAge256(plant,version))return false;
  if(life===undefined)return plant.sown291===true?false:!world.climate||!isPlant(plant as Resource);
  if(version<87||!world.climate&&!((version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))))&&plant.sown291===true)||!isPlant(plant as Resource)||!record(life)||!Object.keys(life).every(k=>['initialAgeCore','since','bornAt','age','darkTicks','leaflessAt','nextCheck'].includes(k)))return false;
  if(!integer(life.since,version>=256&&Object.hasOwn(life,'initialAgeCore')?0:(world.climate?.adoptedAt??0),world.tick)||!integer(life.age,0,world.tick-life.since)||!integer(life.darkTicks,0,life.age)||
    !integer(life.nextCheck,world.tick+1,world.tick+PLANT_LIFE_INTERVAL)||life.nextCheck%PLANT_LIFE_INTERVAL!==(plant.id!+1)%PLANT_LIFE_INTERVAL)return false;
  if(life.age!==Math.max(0,life.nextCheck-PLANT_LIFE_INTERVAL-life.since))return false;
  if(plant.sown291===true&&!Object.hasOwn(life,'bornAt')||life.bornAt!==undefined&&life.bornAt!==life.since)return false;
  return life.leaflessAt===undefined||(plant.kind==='berries'||plant.kind==='healroot'||plant.species!==undefined)&&integer(life.leaflessAt,life.since,world.tick)&&life.leaflessAt%PLANT_LIFE_INTERVAL===(plant.id!+1)%PLANT_LIFE_INTERVAL;
}

export function validPlantLife(plant:Partial<Resource>,version:number,world:Pick<World,'tick'|'climate'>):boolean {
  if(!validPartyNonOwner292(plant))return false;return validSownResource291(plant,version)&&(plant.species===undefined||isPlantSpeciesInVersion(plant.species,version))&&(hasPausedTreeClock(plant)?validPausedTreeLife(plant,version,world):validOrdinaryPlantLife(plant,version,world));}
