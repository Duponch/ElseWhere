/** Compact persistent columns for prospective geography. Geometry is rebuilt
 * only from its recorded algorithm revision and coverage, never by rerunning
 * climate, relief, rivers, factions, roads, names or any PRNG. */
import {cropSurfaceCells,generateCoveredSurfaceMesh,surfaceVisibilityAxis} from './world-surface-mesh.ts';
import {stableWorldSeedHash,validateWorldClimateSettings,type WorldClimateSettings} from './world-climate-settings.ts';
import type {WorldPhysicalSurface,WorldSurfaceTile} from './world-surface-geography.ts';
import type {WorldBiome} from './world-biome-selection.ts';
import type {WorldRelief} from './world-climate-evaluation.ts';
import {WORLD_RIVERS,type WorldRiverId,type WorldRiverLink} from './world-rivers.ts';
import {WORLD_ROADS,type WorldRoadId,type WorldRoadLink} from './world-roads.ts';
const BIOMES:readonly WorldBiome[]=['boreal-forest','tundra','cold-bog','ice-sheet','sea-ice','temperate-forest','temperate-swamp','tropical-rainforest','tropical-swamp','arid-shrubland','desert','extreme-desert','ocean','lake'];
const RELIEF:readonly WorldRelief[]=['flat','small-hills','large-hills','mountainous','impassable'];
const RIVERS:readonly WorldRiverId[]=['huge-river','large-river','river','creek'];
const ROADS:readonly WorldRoadId[]=['dirt-path','dirt-road','stone-road','ancient-asphalt-road','ancient-asphalt-highway'];
/** Sparse rows [tileId, neighbourId, definitionId, ...] preserve each tile's
 * actual link order. A single unordered edge list would lose that authority. */
export interface StoredWorldSurface {
 revision:3;geometryRevision:1;floatEncoding:'ieee754-bits';seedText:string;generationSeed:number;settings:WorldClimateSettings;
 biome:number[];relief:number[];elevation:number[];temperature:number[];rainfall:number[];swampiness:number[];riverDistance:number[];
 rivers:number[][];roads:number[][];
}
export interface RestoredWorldSurface {surface:WorldPhysicalSurface;roads:WorldRoadLink[][]}
// Only enumerable data properties are accepted: a structured copy of an
// accepted value (which keeps exactly those) is therefore accepted too.
const enumerableData=(d:PropertyDescriptor|undefined):boolean=>!!d&&Object.hasOwn(d,'value')&&d.enumerable===true;
function record(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value))return false;
 const prototype=Object.getPrototypeOf(value);if(prototype!==null&&prototype!==Object.prototype)return false;
 const own=Reflect.ownKeys(value);return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&enumerableData(Object.getOwnPropertyDescriptor(value,k)));
}
function dense(value:unknown):value is unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)return false;
 for(let i=0;i<value.length;i++)if(!enumerableData(Object.getOwnPropertyDescriptor(value,String(i))))return false;return true;
}
const integer=(value:unknown,max:number):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
const finiteBits=(value:unknown):value is number=>integer(value,0xffffffff)&&(value&0x7f800000)!==0x7f800000;
/** JSON cannot preserve negative zero as a number. Persist float bits rather
 * than normalizing a real generation value or weakening exact continuation. */
function floatColumn(tiles:readonly WorldSurfaceTile[],pick:(tile:WorldSurfaceTile)=>number):number[]{return Array.from(new Uint32Array(Float32Array.from(tiles,pick).buffer));}
function readFloatColumn(column:readonly number[]):Float32Array{return new Float32Array(Uint32Array.from(column).buffer);}
function rows<T extends {neighbour:number}>(links:readonly (readonly T[])[],definition:(link:T)=>number):number[][]{
 const output:number[][]=[];for(let id=0;id<links.length;id++)if(links[id]!.length){const row=[id];for(const link of links[id]!)row.push(link.neighbour,definition(link));output.push(row);}return output;
}
export function storeWorldSurface(surface:WorldPhysicalSurface,roads:readonly (readonly WorldRoadLink[])[]):StoredWorldSurface {
 if(roads.length!==surface.tiles.length)throw Error('World road columns have a different surface');
 return {revision:3,geometryRevision:1,floatEncoding:'ieee754-bits',seedText:surface.seedText,generationSeed:surface.generationSeed,settings:{...surface.settings},
  biome:surface.tiles.map(t=>BIOMES.indexOf(t.biome)),relief:surface.tiles.map(t=>RELIEF.indexOf(t.hilliness)),
  elevation:floatColumn(surface.tiles,t=>t.elevation),temperature:floatColumn(surface.tiles,t=>t.meanTemperature),rainfall:floatColumn(surface.tiles,t=>t.rainfall),swampiness:floatColumn(surface.tiles,t=>t.swampiness),riverDistance:surface.tiles.map(t=>t.riverDistance),
  rivers:rows(surface.tiles.map(t=>t.rivers),link=>RIVERS.indexOf(link.river)),roads:rows(roads,link=>ROADS.indexOf(link.road))};
}
/** Strict shape/range validation comes before allocating any globe geometry.
 * Unbounded/nullable swampiness is not invented: actual stored values must be
 * finite float32, and may exceed1 because the generator can produce them. */
export function validStoredWorldSurface(value:unknown):value is StoredWorldSurface {
 if(!record(value,['revision','geometryRevision','floatEncoding','seedText','generationSeed','settings','biome','relief','elevation','temperature','rainfall','swampiness','riverDistance','rivers','roads']))return false;
 if(value.revision!==3||value.geometryRevision!==1||value.floatEncoding!=='ieee754-bits'||typeof value.seedText!=='string'||!integer(value.generationSeed,0xffffffff)||value.generationSeed!==(stableWorldSeedHash(value.seedText)>>>0))return false;
 if(!record(value.settings,['coverage','rainfall','temperature','population'])||!validateWorldClimateSettings(value.settings))return false;
 if(!dense(value.biome)||value.biome.length<12||value.biome.length>590492)return false;
 const count=value.biome.length;
 for(const key of ['relief','elevation','temperature','rainfall','swampiness','riverDistance'] as const)if(!dense(value[key])||value[key].length!==count)return false;
 for(let id=0;id<count;id++){
  if(!integer(value.biome[id],BIOMES.length-1)||!integer((value.relief as unknown[])[id],RELIEF.length-1)||!integer((value.riverDistance as unknown[])[id],count))return false;
  for(const key of ['elevation','temperature','rainfall','swampiness'] as const)if(!finiteBits((value[key] as unknown[])[id]))return false;
  const rain=(value.rainfall as number[])[id]!;if((rain>>>31)!==0&&(rain&0x7fffffff)!==0)return false;
 }
 for(const [key,definitions] of [['rivers',RIVERS],['roads',ROADS]] as const){const list=value[key];if(!dense(list)||list.length>count)return false;let last=-1;
  for(const row of list){if(!dense(row)||row.length<3||row.length>13||row.length%2!==1||!integer(row[0],count-1)||(row[0] as number)<=last)return false;last=row[0] as number;
   const neighbours=new Set<number>();for(let at=1;at<row.length;at+=2){if(!integer(row[at],count-1)||row[at]===row[0]||neighbours.has(row[at] as number)||!integer(row[at+1],definitions.length-1))return false;neighbours.add(row[at] as number);}
  }
 }
 return true;
}
/** Full restore validates actual graph membership/reciprocity after structural
 * validation. Old planet revisions never pass through this prospective path. */
export function restoreWorldSurface(value:unknown):RestoredWorldSurface {
 if(!validStoredWorldSurface(value))throw Error('Invalid prospective world surface columns');
 return restoreValidatedWorldSurface(value);
}
/** Same restoration for columns already accepted by validStoredWorldSurface,
 * or a structured copy of such columns (enumerable data only, so the copy is
 * accepted too): the column walk is not repeated on the copy. */
export function restoreValidatedWorldSurface(value:StoredWorldSurface):RestoredWorldSurface {
 const geometry=cropSurfaceCells(generateCoveredSurfaceMesh(value.settings.coverage),value.settings.coverage,surfaceVisibilityAxis(value.settings.coverage));
 if(geometry.length!==value.biome.length)throw Error('Surface coverage/column count mismatch');
 const elevation=readFloatColumn(value.elevation),temperature=readFloatColumn(value.temperature),rainfall=readFloatColumn(value.rainfall),swampiness=readFloatColumn(value.swampiness);
 const tiles:WorldSurfaceTile[]=geometry.map((cell,id)=>({id,center:cell.center,corners:cell.corners,neighbours:cell.neighbours,biome:BIOMES[value.biome[id]!]!,hilliness:RELIEF[value.relief[id]!]!,elevation:elevation[id]!,meanTemperature:temperature[id]!,rainfall:rainfall[id]!,swampiness:swampiness[id]!,rivers:[],riverDistance:value.riverDistance[id]!}));
 const roads:WorldRoadLink[][]=Array.from({length:tiles.length},()=>[]);
 for(const row of value.rivers){const tile=tiles[row[0]!]!;for(let i=1;i<row.length;i+=2){if(!tile.neighbours.includes(row[i]!))throw Error('River edge leaves surface topology');tile.rivers.push({neighbour:row[i]!,river:RIVERS[row[i+1]!]!});}}
 for(const row of value.roads){const tile=tiles[row[0]!]!;for(let i=1;i<row.length;i+=2){if(!tile.neighbours.includes(row[i]!))throw Error('Road edge leaves surface topology');roads[tile.id]!.push({neighbour:row[i]!,road:ROADS[row[i+1]!]!});}}
 for(const tile of tiles){for(const link of tile.rivers)if(!Object.hasOwn(WORLD_RIVERS,link.river)||!tiles[link.neighbour]!.rivers.some(back=>back.neighbour===tile.id&&back.river===link.river))throw Error('Non-reciprocal stored river');
  for(const link of roads[tile.id]!)if(!Object.hasOwn(WORLD_ROADS,link.road)||!roads[link.neighbour]!.some(back=>back.neighbour===tile.id&&back.road===link.road))throw Error('Non-reciprocal stored road');}
 return {surface:{revision:3,radius:100,seedText:value.seedText,generationSeed:value.generationSeed,settings:{...value.settings},tiles},roads};
}
