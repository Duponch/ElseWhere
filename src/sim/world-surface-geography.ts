/** Physical surface stages for prospective worlds. This is one component of
 * planet generation: factions/roads/features/local maps remain separate real
 * stages and are never claimed from this physical result alone. */
import {generateCoveredSurfaceMesh,cropSurfaceCells,surfaceVisibilityAxis,WORLD_SURFACE_RADIUS,type SurfaceVector} from './world-surface-mesh.ts';
import {createWorldTerrainSampler} from './world-terrain-sampler.ts';
import {createSeaIceGate} from './world-sea-ice-gate.ts';
import {selectWorldBiome,resolveLakeComponents,type WorldBiome} from './world-biome-selection.ts';
import {generateWorldRivers,type WorldRiverLink} from './world-rivers.ts';
import {createCoreTerrainStep} from './world-terrain-core.ts';
import type {WorldClimateSettings} from './world-climate-settings.ts';
import type {WorldRelief} from './world-climate-evaluation.ts';
export interface WorldSurfaceTile {
 id:number;center:SurfaceVector;corners:SurfaceVector[];neighbours:number[];
 biome:WorldBiome;hilliness:WorldRelief;elevation:number;meanTemperature:number;rainfall:number;swampiness:number;
 rivers:WorldRiverLink[];riverDistance:number;
}
export interface WorldPhysicalSurface {
 revision:3;radius:100;seedText:string;generationSeed:number;settings:WorldClimateSettings;tiles:WorldSurfaceTile[];
 /** 2: the game's mesh precision and terrain step (`world-terrain-core.ts`),
  * new games from schema 376. Absent: the historical generator (revision 1). */
 geometryRevision?:2;
}
export interface WorldSurfaceGenerationOptions {
 /** The terrain step as the game runs it (geometry revision 2). */
 core?:boolean;
}
export interface WorldGenerationProgress {phase:'mesh'|'terrain'|'lakes'|'rivers';completed:number;total:number}
/** Yielding never consumes PRNG or changes physical results. A worker may
 * schedule the iterator in batches and discard a cancelled draft. */
export function* generateWorldPhysicalSurface(seedText:string,sourceSettings:WorldClimateSettings,options?:WorldSurfaceGenerationOptions):Generator<WorldGenerationProgress,WorldPhysicalSurface,void> {
 if(options?.core)return yield* generateCoreWorldPhysicalSurface(seedText,sourceSettings);
 const sampler=createWorldTerrainSampler(seedText,sourceSettings),settings={...sourceSettings},seaIce=createSeaIceGate(sampler.rootSeed,settings.coverage);
 yield {phase:'mesh',completed:0,total:1};
 const cells=cropSurfaceCells(generateCoveredSurfaceMesh(settings.coverage),settings.coverage,surfaceVisibilityAxis(settings.coverage));
 const tiles:WorldSurfaceTile[]=new Array(cells.length);
 for(let id=0;id<cells.length;id++){
  const cell=cells[id]!,e=sampler.sample(id,cell.center);
  tiles[id]={id,center:cell.center,corners:cell.corners,neighbours:cell.neighbours,
   biome:selectWorldBiome({...e,seaIceEligible:e.elevation<=0&&seaIce(cell.center)}),
   hilliness:e.hilliness,elevation:e.elevation,meanTemperature:e.temperature,rainfall:e.rainfall,swampiness:e.swampiness,rivers:[],riverDistance:0};
  if((id+1)%512===0)yield {phase:'terrain',completed:id+1,total:cells.length};
 }
 yield {phase:'lakes',completed:0,total:tiles.length};
 const biomes=resolveLakeComponents(tiles);for(let id=0;id<tiles.length;id++)tiles[id]!.biome=biomes[id]!;
 yield {phase:'rivers',completed:0,total:tiles.length};
 const rivers=generateWorldRivers(tiles,sampler.rootSeed);
 for(let id=0;id<tiles.length;id++){tiles[id]!.rivers=rivers.links[id]!;tiles[id]!.riverDistance=rivers.riverDistance[id]!;}
 return {revision:3,radius:WORLD_SURFACE_RADIUS,seedText,generationSeed:sampler.rootSeed>>>0,settings,tiles};
}
/** Geometry revision 2: the game's planet mesh (same tiles, same neighbour
 * order) and terrain step, then the lakes and Elsewhere's rivers as above. */
function* generateCoreWorldPhysicalSurface(seedText:string,sourceSettings:WorldClimateSettings):Generator<WorldGenerationProgress,WorldPhysicalSurface,void> {
 const terrain=createCoreTerrainStep(seedText,sourceSettings),settings={...sourceSettings};
 yield {phase:'mesh',completed:0,total:1};
 const cells=cropSurfaceCells(generateCoveredSurfaceMesh(settings.coverage,10,true),settings.coverage,surfaceVisibilityAxis(settings.coverage),true);
 const tiles:WorldSurfaceTile[]=new Array(cells.length);
 for(let id=0;id<cells.length;id++){
  const cell=cells[id]!,t=terrain.generateTile(id,cell.center);
  tiles[id]={id,center:cell.center,corners:cell.corners,neighbours:cell.neighbours,biome:t.biome,hilliness:t.hilliness,elevation:t.elevation,meanTemperature:t.temperature,rainfall:t.rainfall,swampiness:t.swampiness,rivers:[],riverDistance:0};
  if((id+1)%512===0)yield {phase:'terrain',completed:id+1,total:cells.length};
 }
 yield {phase:'lakes',completed:0,total:tiles.length};
 const biomes=resolveLakeComponents(tiles);for(let id=0;id<tiles.length;id++)tiles[id]!.biome=biomes[id]!;
 yield {phase:'rivers',completed:0,total:tiles.length};
 const rivers=generateWorldRivers(tiles,terrain.rootSeed);
 for(let id=0;id<tiles.length;id++){tiles[id]!.rivers=rivers.links[id]!;tiles[id]!.riverDistance=rivers.riverDistance[id]!;}
 return {revision:3,radius:WORLD_SURFACE_RADIUS,seedText,generationSeed:terrain.rootSeed>>>0,settings,tiles,geometryRevision:2};
}
