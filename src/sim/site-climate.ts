import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {irregularTemperatureOffset262} from './geographic-irregular-temperature-262.ts';
import {evaluateClimateCurve} from './world-climate-settings.ts';
import {planetTile,planetGeography256} from './planet-geography-256.ts';
import {worldSurfaceCoordinates} from './world-surface-movement.ts';
import type {PlanetState} from './planet-state.ts';
import type { World } from './types.ts';
import { TICKS_PER_DAY } from './types.ts';
import { isPlant,plantGrowth } from './plants.ts';
import { createPlantLife } from './plant-life.ts';
import type { BiomeId } from './biome-flora.ts';
import type { PlanetTile } from './planet-state.ts';

/** Civil time at explicit adoption; elapsed jobs and health keep World.tick. */
export interface ReferenceSiteClimate {
  revision:1;
  profile:ClimateProfile;
  adoptedAt:number;
  calendarOrigin:number;
}
export interface StartingSiteClimate {
  revision:2;
  adoptedAt:number;
  calendarOrigin:number;
  definition:ClimateDefinition;
}
export interface ExpeditionSiteClimate {revision:3;adoptedAt:number;calendarOrigin:number;definition:ClimateDefinition}
export interface GeographicSiteClimate256 {irregular262?:true;revision:4;adoptedAt:number;calendarOrigin:number;tileId:number;definition:ClimateDefinition}
export type SiteClimate=ReferenceSiteClimate|StartingSiteClimate|ExpeditionSiteClimate|GeographicSiteClimate256;

export type ClimateProfile='temperate-reference'|'boreal-reference'|'arid-reference'|'tundra-preset';
export interface ClimateDefinition {meanTemperature:number;amplitude:number;rainfall:number;latitude:number;longitude:number}
export type ClimateWorld=Pick<World,'tick'|'gameProfile'|'climate'|'miscIncidents'>;
export const TICKS_PER_YEAR=60*TICKS_PER_DAY;
/** Historical colony B: climate read from its saved tile, location reported
 * by the user. This is an observed reference, not an average world tile. */
export const TEMPERATE_CLIMATE=Object.freeze({meanTemperature:16.2,amplitude:seasonalAmplitude(22.21),rainfall:900,
  latitude:22.21,longitude:-18.23});
/** Reference-Core-4871 starting tile 60125, decoded from the saved world grid. */
export const BOREAL_CLIMATE=Object.freeze({meanTemperature:5.3,amplitude:seasonalAmplitude(39.71),rainfall:655,
  latitude:39.71,longitude:13.47});
/** Reference-Core-4871 tile 89, decoded from the same 119904-cell surface. */
export const ARID_CLIMATE=Object.freeze({meanTemperature:25.4,amplitude:seasonalAmplitude(4.01),rainfall:690,
  latitude:4.01,longitude:27.74});
/** Authored cold local preset, not an observed Core tile or universal biome climate. */
export const TUNDRA_CLIMATE=Object.freeze({meanTemperature:-12,amplitude:seasonalAmplitude(60),rainfall:700,latitude:60,longitude:0});
export const CLIMATE_DEFINITIONS:Readonly<Record<ClimateProfile,ClimateDefinition>>=Object.freeze({
  'temperate-reference':TEMPERATE_CLIMATE,'boreal-reference':BOREAL_CLIMATE,'arid-reference':ARID_CLIMATE,'tundra-preset':TUNDRA_CLIMATE,
});
const climateForBiome:Readonly<Record<BiomeId,ClimateProfile>>={'temperate-forest':'temperate-reference','boreal-forest':'boreal-reference','arid-shrubland':'arid-reference',tundra:'tundra-preset'};
export const siteClimateDefinition=(world:Pick<World,'climate'>):ClimateDefinition=>world.climate&&(world.climate.revision===2||world.climate.revision===3||world.climate.revision===4)?
  world.climate.definition:CLIMATE_DEFINITIONS[world.climate?.profile??'temperate-reference'];

/** Persist only the tile's actual climate and its geographic seasonal amplitude. */
export function planetTileClimateDefinition(tile:PlanetTile):ClimateDefinition {
  const latitude=Math.asin(Math.max(-1,Math.min(1,tile.center[1])))*180/Math.PI;
  const longitude=Math.atan2(tile.center[2],tile.center[0])*180/Math.PI;
  return {meanTemperature:tile.meanTemperature,rainfall:tile.rainfall,latitude,longitude,amplitude:seasonalAmplitude(latitude)};
}

/** Actual prospective tile, distinct radius/axes from the literal old globe. */
export function geographicPlanetClimateDefinition256(planet:PlanetState,id:number):ClimateDefinition {
 if(planet.revision!==3){const tile=planet.tiles[id];if(!tile)throw Error('Unknown literal planet tile');return planetTileClimateDefinition(tile);}
 const tile=planetGeography256(planet).surface.tiles[id];if(!tile)throw Error('Unknown geographic climate tile');return geographicSurfaceTileClimateDefinition256(tile);
}
/** Read-only immutable surface-tile facts; shared by the creation preview and
 * the actual planet owner, with the same geographic amplitude calculation. */
export function geographicSurfaceTileClimateDefinition256(tile:import('./world-surface-geography.ts').WorldSurfaceTile):ClimateDefinition {
 const {latitude,longitude}=worldSurfaceCoordinates(tile);
 return {meanTemperature:tile.meanTemperature,rainfall:tile.rainfall,latitude,longitude,amplitude:evaluateClimateCurve([[0,3],[.1,4],[1,28]],Math.abs(Math.fround(tile.center[1]/100)))};
}

/** Trigonometric results can differ by one ULP between JS runtimes. Keep the
 * stored values; this tolerance applies only to derived climate numbers. */
export function sameDerivedClimateNumber(a:number,b:number):boolean {
  return Number.isFinite(a)&&Number.isFinite(b)&&
    Math.abs(a-b)<=2*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
}

export function validClimateDefinition(value:unknown):value is ClimateDefinition {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const v=value as Record<string,unknown>,keys=Reflect.ownKeys(v);
  const finite=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  return keys.length===5&&keys.every(k=>typeof k==='string'&&['meanTemperature','amplitude','rainfall','latitude','longitude'].includes(k)&&
    Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'))&&
    finite(v.meanTemperature,-100,100)&&finite(v.rainfall,0,10000)&&finite(v.latitude,-90,90)&&finite(v.longitude,-180,180)&&
    finite(v.amplitude,3,28)&&sameDerivedClimateNumber(v.amplitude,seasonalAmplitude(v.latitude));
}

export function climateTick(world:ClimateWorld,tick=world.tick):number {
  return world.climate?world.climate.calendarOrigin+tick-world.climate.adoptedAt:tick+(world.gameProfile?TICKS_PER_DAY/4:0);
}

/** Scalar site temperatures use a separate yearly phase from civil hour. */
export function seasonalAmplitude(latitude:number):number {
  const distance=Math.abs(Math.sin(latitude*Math.PI/180));
  return distance<=.1?3+10*distance:4+(distance-.1)/.9*24;
}

export function seasonTemperature(latitude:number,mean:number,civilTick:number):number {
  const phase=((civilTick%TICKS_PER_YEAR)+TICKS_PER_YEAR)%TICKS_PER_YEAR/TICKS_PER_YEAR;
  return mean-Math.cos(2*Math.PI*(phase-50/60))*seasonalAmplitude(latitude)*(latitude<0?-1:1);
}

/** Core Auto selects the first warm five-day period, including wraparound. */
export function automaticStartDay(latitude:number,mean:number):number {
  const warm=Array.from({length:12},(_,twelfth)=>{
    let sum=0;for(let i=0;i<120;i++)sum+=seasonTemperature(latitude,mean,(twelfth*5+.5+i/24)*TICKS_PER_DAY);
    return sum/120>=12;
  });
  let first=warm.indexOf(true);
  if(first<0)return latitude>=0?15:45;
  if(first===0&&!warm.every(Boolean))while(warm[(first+11)%12])first=(first+11)%12;
  return first*5;
}
const referenceStartDays=new Map<ClimateProfile,number>();

export function climateOriginAtAdoption(world:Pick<World,'gameProfile'|'site'>,adoptedAt:number,profile:ClimateProfile='temperate-reference'):number {
  const civil=adoptedAt+(world.gameProfile?TICKS_PER_DAY/4:0);
  const definition=CLIMATE_DEFINITIONS[profile];let referenceStartDay=referenceStartDays.get(profile);
  if(referenceStartDay===undefined){referenceStartDay=automaticStartDay(definition.latitude,definition.meanTemperature);referenceStartDays.set(profile,referenceStartDay);}
  return Math.floor(civil/TICKS_PER_YEAR)*TICKS_PER_YEAR+
    referenceStartDay*TICKS_PER_DAY+civil%TICKS_PER_DAY;
}

/** New colonies start at Auto, 06:00. Adoption time remains the elapsed clock's origin. */
export function startingSiteClimateOrigin(adoptedAt:number,definition:ClimateDefinition):number {
  const civil=adoptedAt+TICKS_PER_DAY/4;
  return Math.floor(civil/TICKS_PER_YEAR)*TICKS_PER_YEAR+
    automaticStartDay(definition.latitude,definition.meanTemperature)*TICKS_PER_DAY+civil%TICKS_PER_DAY;
}

/** Prospective initialization only: no resource growth or plant-life history is rewritten. */
export function adoptStartingSiteClimate(world:World,definition:ClimateDefinition):boolean {
  if(world.planet?.revision===3){if(world.tick!==0||world.climate)return false;const expected=geographicPlanetClimateDefinition256(world.planet,world.planet.homeTile);if(!Object.keys(expected).every(k=>definition[k as keyof ClimateDefinition]===expected[k as keyof ClimateDefinition]))return false;world.climate=createGeographicSiteClimate256(world.planet,world.planet.homeTile,{tick:0,calendarOrigin:startingSiteClimateOrigin(0,expected)});return true;}
  if(world.tick!==0||world.climate||!validClimateDefinition(definition))return false;
  world.climate={revision:2,adoptedAt:world.tick,calendarOrigin:startingSiteClimateOrigin(world.tick,definition),definition:{...definition}};
  return true;
}

/** Explicit transition starts a warm observed season without inventing past
 * frost/plant age. Save old growth before changing the civil environment. */
export function adoptSiteClimate(world:World):boolean {
  if(world.climate)return false;
  for(const plant of world.resources)if(isPlant(plant)) {
    plant.growth=plantGrowth(world,plant);plant.growthTick=world.tick;
    plant.plantLife=createPlantLife(world,plant);
  }
  const profile=world.site?.revision===2?climateForBiome[world.site.biome]:'temperate-reference';
  world.climate={revision:1,profile,adoptedAt:world.tick,calendarOrigin:climateOriginAtAdoption(world,world.tick,profile)};
  return true;
}

interface OutdoorSample {
  civil:number;mode:number;tile:number|undefined;
  latitude:number;longitude:number;mean:number;amplitude:number;temperature:number;
}
const outdoorSamples=new WeakMap<ClimateWorld,OutdoorSample>();
/** Base + annual + daily cycle. Weather and incidents remain separate owners. */
export function seasonalOutdoorTemperature(world:ClimateWorld,tick=world.tick):number {
  // Core caches site temperature for 60 ticks. This profile uses the adopted
  // origin rather than making the result depend on the first caller's timing.
  const sample=world.climate?tick-((tick-world.climate.adoptedAt)%6+6)%6:tick;
  const civil=climateTick(world,sample);
  const definition=siteClimateDefinition(world);
  // The 60-Core-tick sample is shared by every environmental reader of this
  // exact site. Its pure dependencies are primitives (not climate identity
  // or a World.tick guess), so even a public in-place edit of an imported
  // climate definition, longitude, profile, or clock changes the key.
  const climate=world.climate,mode=climate?.revision===4?(climate.irregular262===true?3:2):climate?1:0;
  const tile=mode===3&&(climate?.revision===4)?climate.tileId:undefined;
  const {latitude,longitude,meanTemperature:mean,amplitude}=definition;
  const previous=outdoorSamples.get(world);
  if(previous&&Object.is(previous.civil,civil)&&previous.mode===mode&&Object.is(previous.tile,tile)
    &&Object.is(previous.latitude,latitude)&&Object.is(previous.longitude,longitude)&&Object.is(previous.mean,mean)&&Object.is(previous.amplitude,amplitude))return previous.temperature;
  let temperature:number;
  if(mode===3)temperature=geographicOutdoorTemperature262(definition,tile!,civil*10-geographicLongitudeOffsetCore256(longitude));
  else{
    const base=mode===2?geographicSeasonTemperature256(definition,civil*10-geographicLongitudeOffsetCore256(longitude)):mode===1?seasonTemperature(latitude,mean,civil):21;
    temperature=base+7*Math.cos(2*Math.PI*(civil%TICKS_PER_DAY/TICKS_PER_DAY+.32));
  }
  outdoorSamples.set(world,{civil,mode,tile,latitude,longitude,mean,amplitude,temperature});
  return temperature;
}

export function climateDate(world:ClimateWorld):{year:number;day:number;quadrum:number;season:string} {
  const civil=climateTick(world),day=((Math.floor(civil/TICKS_PER_DAY)%60)+60)%60;
  const seasonOffset=world.climate&&(world.climate.revision===2||world.climate.revision===3||world.climate.revision===4)&&world.climate.definition.latitude<0?2:0;
  return {year:5500+Math.floor(civil/TICKS_PER_YEAR),day:day%15+1,quadrum:Math.floor(day/15),
    season:['Printemps','Été','Automne','Hiver'][(Math.floor(day/15)+seasonOffset)%4]!};
}

/** New geography may have true extreme finite temperatures/rainfall. This
 * predicate never relaxes validClimateDefinition used by historical1/2/3. */
export function validGeographicClimateDefinition256(value:unknown):value is ClimateDefinition {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>,keys=['meanTemperature','amplitude','rainfall','latitude','longitude'];
 if(Reflect.ownKeys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)??{},'value')))return false;
 return keys.every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]))&&Number(v.rainfall)>=0&&Number(v.latitude)>=-90&&Number(v.latitude)<=90&&Number(v.longitude)>=-180&&Number(v.longitude)<=180&&Number(v.amplitude)>=3&&Number(v.amplitude)<=28;
}
/** clock.calendarOrigin is the shared civil anchor at campaign tick0, not
 * the creation time of this temporary map. No age, season or growth resets. */
export function createGeographicSiteClimate256(planet:Extract<PlanetState,{revision:3}>,tileId:number,clock:{tick:number;calendarOrigin:number;schemaVersion?:number}):GeographicSiteClimate256 {
 if(!Number.isSafeInteger(clock.tick)||clock.tick<0||!Number.isSafeInteger(clock.calendarOrigin)||!Number.isSafeInteger(tileId)||tileId<0)throw Error('Invalid geographic climate clock/tile');
 const definition=geographicPlanetClimateDefinition256(planet,tileId),home=geographicPlanetClimateDefinition256(planet,planet.homeTile),offset=(geographicLongitudeOffsetCore256(definition.longitude)-geographicLongitudeOffsetCore256(home.longitude))/10,calendarOrigin=clock.calendarOrigin+clock.tick+offset;
 if(!Number.isSafeInteger(calendarOrigin))throw Error('Geographic calendar overflow');return {revision:4,tileId,adoptedAt:clock.tick,calendarOrigin,definition,...(Number(clock.schemaVersion)===262||isSchema263OrLater(Number(clock.schemaVersion))?{irregular262:true as const}:{})};
}
export function geographicLongitudeOffsetCore256(longitude:number):number {const n=Math.fround(longitude/15),low=Math.floor(n),fraction=n-low,rounded=fraction<.5?low:fraction>.5?low+1:low%2===0?low:low+1;return rounded*2500;}

/** Geographic annual phase uses the true stored amplitude and Core float32
 * operations. Historical seasonTemperature remains byte-for-byte unchanged. */
export function geographicSeasonTemperature256(definition:ClimateDefinition,absoluteCoreTick:number):number {
 const f=Math.fround,tick=absoluteCoreTick===0?1:absoluteCoreTick,year=f(f(f(f(tick)/60000)%60)/60),angle=f(f(f(Math.PI)*2)*f(year-f(10/12))),amplitude=definition.amplitude*(definition.latitude<0?-1:1);
 return f(definition.meanTemperature+f(f(Math.cos(angle))*f(-amplitude)));
}

/** Shared actual-tile exterior for newly marked262 map and caravan readers.
 * Seasonal-only consumers keep geographicSeasonTemperature256 unchanged. */
export function geographicOutdoorTemperature262(definition:ClimateDefinition,tileId:number,absoluteCore:number):number {
 const at=absoluteCore===0?1:absoluteCore,civil=(at+geographicLongitudeOffsetCore256(definition.longitude))/10;
 return geographicSeasonTemperature256(definition,at)+7*Math.cos(2*Math.PI*(civil%TICKS_PER_DAY/TICKS_PER_DAY+.32))+irregularTemperatureOffset262(tileId,at);
}
