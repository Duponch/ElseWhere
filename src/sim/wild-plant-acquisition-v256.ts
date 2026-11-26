import {FLORA_DEFINITIONS,isPlantSpeciesInVersion,type PlantSpecies} from './biome-flora.ts';
import {createPlantLife} from './plant-life.ts';
import {footprintCells} from './definitions.ts';
import {isRoofed} from './roof-rules.ts';
import {soilFertility} from './soil.ts';
import type {Resource,World} from './types.ts';

/** Shared real source constructor for future generation and renewal. Historical
 * generators keep their draws and records. No implicit biome/species substitute. */
export function createWildPlantResource256(world:Pick<World,'tick'|'schemaVersion'>,id:number,x:number,z:number,species:PlantSpecies,growth:number,born:boolean):Resource|undefined {
  if(world.schemaVersion<256||!isPlantSpeciesInVersion(species,world.schemaVersion)||!Number.isSafeInteger(id)||id<1||
    !Number.isSafeInteger(x)||x<0||!Number.isSafeInteger(z)||z<0||!Number.isFinite(growth)||growth<0||growth>1)return;
  const d=FLORA_DEFINITIONS[species];
  const plant:Resource={id,x,z,kind:d.kind,species,amount:d.yield,growth,growthTick:world.tick};
  plant.plantLife=createPlantLife(world,plant,born);return plant;
}
/** One physical acquisition; failure changes neither IDs, resources nor RNG.
 * Caller owns prospectively persisted capacity/profile and bounded cadence. */
export function acquireWildPlant256(world:World,index:number,species:PlantSpecies,growth=.0001,born=true):Resource|undefined {
  if(world.schemaVersion<256||!Number.isSafeInteger(index)||index<0||index>=world.width*world.height||
    !Number.isSafeInteger(world.nextId+1)||!isPlantSpeciesInVersion(species,world.schemaVersion))return;
  const tile=world.tiles[index];if(!tile||tile.floor||tile.bridge||(tile.snowDepth??0)>=.2||
    soilFertility(tile.terrain)<FLORA_DEFINITIONS[species].minFertility||isRoofed(world,index))return;
  const x=index%world.width,z=Math.floor(index/world.width),at=(c:{x:number;z:number})=>c.x===x&&c.z===z;
  if(world.resources.some(at)||world.growingZones.some(z=>z.cells.includes(index))||
    world.structures.some(s=>footprintCells(s).some(at))||world.jobs.some(j=>footprintCells(j).some(at))||
    world.piles.some(p=>p.owner.type==='ground'&&at(p.owner))||world.packed.some(p=>p.owner.type==='ground'&&at(p.owner)))return;
  const plant=createWildPlantResource256(world,world.nextId,x,z,species,growth,born);if(!plant)return;
  const beforeResources=world.resources;world.resources=[...world.resources,plant];markResourceArrayChanged(world,beforeResources,[plant],[]);world.nextId++;return plant;
}
import {markResourceArrayChanged} from './resource-mutation-journal.ts';
