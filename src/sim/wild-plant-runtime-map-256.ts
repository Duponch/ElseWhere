import {isSchema256Or257} from './schema-compatibility-257.ts';
import {actualAdditionalPlantOwners256} from './actual-plant-physical-masks-256.ts';
import type {World} from './types.ts';
import {localBiomeRules256} from './local-biome-rules-v256.ts';
import {naturalPlantSubstrate256,terrainIsWater256} from './natural-terrain-runtime-256.ts';
import {roofKindAt} from './roof-rules.ts';
import {planetGeography256} from './planet-geography-256.ts';
import {surfaceTileHash} from './world-site-geography.ts';
import {plantSeasonRange256} from './plant-season-range-256.ts';
import {FLORA_DEFINITIONS,isPlantSpeciesInVersion} from './biome-flora.ts';
import {WILD_PLANT_GENERATION_FACTS_256 as FACTS} from './wild-plant-generation-data-256.ts';
import {runtimePlantCell256,runtimePlantDef256,runtimePlantNonStump382,type WildPlantMapReader256} from './wild-plant-runtime-256.ts';
import {actualPlantPhysicalMasks256} from './actual-plant-physical-masks-256.ts';
import {createActualPlantSpatialSpawner256} from './actual-plant-spatial-session-256.ts';
import {registerActualPlantRuntimeSession256} from './wild-plant-runtime-session-256.ts';

/** Actual physical classifications supplied by existing map composition.
 * Normal walkability and standability are DIFFERENT: bed/table/shelf remain
 * walkable; doors/fences/full-fill have their own RegionType precedence.
 * coverOrEdifice includes true existing rocks/buildings, not unbuilt jobs.
 * Items only enter blocksPlanting when their actual definition says so.
 * No default all-clear masks are provided by this adapter. */
export interface PlantPhysicalMasks256 {
 readonly normalWalkable:ArrayLike<number>;readonly door:ArrayLike<number>;readonly fence:ArrayLike<number>;readonly fullFill:ArrayLike<number>;
 readonly coverOrEdifice:ArrayLike<number>;readonly blocksPlanting:ArrayLike<number>;readonly sandDepth:ArrayLike<number>;
}
const ranges=new WeakMap<object,Readonly<{min:number;max:number}>>();
const binaryClassificationAt=(grid:ArrayLike<number>,cell:number):boolean=>grid[cell]===0||grid[cell]===1;
function actualPlantMapAuthority256(world:World) {
 const site=world.site,planet=world.planet,rules=site?.revision===3?localBiomeRules256(site.biome,world.schemaVersion):undefined;
 if(!isSchema256Or257(world.schemaVersion)||site?.revision!==3||planet?.revision!==3||!rules)throw Error('Missing actual geographic plant map');
 const owner=planetGeography256(planet),tile=owner.surface.tiles[site.tileId];if(!tile||tile.id!==site.tileId||tile.biome!==site.biome)throw Error('Plant biome differs from actual surface owner');
 let range=ranges.get(tile);if(!range){range=plantSeasonRange256(tile,owner.surface.radius);ranges.set(tile,range);}
 return {site,planet,rules,range};
}
/** The actual simulation composition alone uses this synchronous session.
 * capture remains the same complete strict oracle used by generation, public
 * readers, saves and diagnostics. No session survives an advance call. */
export function createActualWildPlantMapReader256(densityFactor:(world:World)=>number):WildPlantMapReader256 {
 const reader=createWildPlantMapReader256(actualPlantPhysicalMasks256,densityFactor);
 registerActualPlantRuntimeSession256(reader,(world,density,desired)=>{
  const {rules,range}=actualPlantMapAuthority256(world),order=Object.keys(FACTS) as (keyof typeof FACTS)[];
  const required=new Set([...rules.wildPlants.map(row=>row.defId),...order.filter(def=>FACTS[def].cavePlant)]);
  for(const id of required){
   if(!Object.hasOwn(FACTS,id))throw Error(`Unresolved initial plant ${id}`);
   const def=FACTS[id as keyof typeof FACTS];if(!isPlantSpeciesInVersion(def.species,world.schemaVersion)||!Object.hasOwn(FLORA_DEFINITIONS,def.species))throw Error(`Missing concrete initial plant ${id}`);
  }
  return createActualPlantSpatialSpawner256(world,{width:world.width,height:world.height,rules,densityFactor:density,
   tileMinTemperature:range.min,tileMaxTemperature:range.max,desiredPlants:desired},order);
 });
 return reader;
}
/** Pure captured grids from a real World; no terrain generation, World clone,
 * PRNG, cell reweighting or climate substitution. Used only at generation or
 * an actual sparse runtime attempt, never per frame. */
export function createWildPlantMapReader256(physical:(world:World)=>PlantPhysicalMasks256,densityFactor:(world:World)=>number):WildPlantMapReader256 {
 return {densityFactor,cell:runtimePlantCell256,capture(world){
  const {site,planet,rules,range}=actualPlantMapAuthority256(world);
  const masks=physical(world),n=world.width*world.height;
  if(Object.values(masks).some(grid=>grid.length!==n))throw Error('Physical plant masks differ from actual map');
  const fertility=new Float32Array(n),naturalRoof=new Uint8Array(n),water=new Uint8Array(n),baseWater=new Uint8Array(n),regionTypes=new Uint8Array(n),walkableNoDoor=new Uint8Array(n),snowDepth=new Float32Array(n),terrainDefIds:string[]=[],terrainTags:(readonly string[])[]=[];
  for(let c=0;c<n;c++){
   const actual=world.tiles[c];if(!actual)throw Error('Actual plant terrain is absent');
   const substrate=naturalPlantSubstrate256(actual),roof=roofKindAt(world,c);
   // Preserve the original six reference reads before testing any cell, and
   // the conditional second read of each nonzero classification, without a
   // temporary six-element Array for every cell.
   const normal=masks.normalWalkable,door=masks.door,fence=masks.fence,full=masks.fullFill,cover=masks.coverOrEdifice,blocks=masks.blocksPlanting;
   if(!binaryClassificationAt(normal,c)||!binaryClassificationAt(door,c)||!binaryClassificationAt(fence,c)
    ||!binaryClassificationAt(full,c)||!binaryClassificationAt(cover,c)||!binaryClassificationAt(blocks,c))throw Error('Invalid physical plant classification');
   fertility[c]=substrate.fertility;naturalRoof[c]=roof==='natural-thin'||roof==='natural-thick'?1:0;
   baseWater[c]=terrainIsWater256(actual.terrain)?1:0;water[c]=!actual.bridge&&!actual.floor?baseWater[c]!:0;
   terrainDefIds.push(substrate.terrainDefId);terrainTags.push(substrate.tags);snowDepth[c]=actual.snowDepth??0;
   regionTypes[c]=masks.door[c]?2:masks.fence[c]?3:masks.normalWalkable[c]?1:masks.fullFill[c]?0:4;
   walkableNoDoor[c]=masks.normalWalkable[c]&&!masks.door[c]?1:0;
  }
  const existing=world.resources.flatMap(resource=>{const defId=runtimePlantDef256(resource);return defId===undefined?[]:[{cell:resource.z*world.width+resource.x,defId,nonStump:runtimePlantNonStump382(resource)}];}).concat(actualAdditionalPlantOwners256(world));
  return {schemaVersion:world.schemaVersion,width:world.width,height:world.height,worldSeed:planet.generationSeed,tileHash:surfaceTileHash(site.tileId),rules,densityFactor:Math.fround(densityFactor(world)),tileMinTemperature:range.min,tileMaxTemperature:range.max,
   fertility,naturalRoof,water,baseWater,terrainDefIds,terrainTags,regionTypes,walkableNoDoor,occupied:masks.coverOrEdifice,blocksPlanting:masks.blocksPlanting,snowDepth,sandDepth:masks.sandDepth,existing,
   hasDefinition:(def,species)=>Object.hasOwn(FACTS,def)&&FACTS[def].species===species&&isPlantSpeciesInVersion(species,world.schemaVersion)&&Object.hasOwn(FLORA_DEFINITIONS,species)};
 }};
}
