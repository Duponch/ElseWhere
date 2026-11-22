/** World movement difficulty as RimWorld 1.6 computes it
 * (`WorldPathGrid.CalculatedMovementDifficultyAt` with its winter offset,
 * `SeasonUtility.GetSeason`, `LatitudeSectionUtility.GetLatitudeSection`,
 * `GenTemperature.GetTemperatureFromSeasonAtTile`, `GenDate.YearPercent`,
 * `PlanetLayer.LongLatOf`), rewritten from the decompiled algorithms with
 * the game's runtime precision (see `verse-rand.ts`). The same facts as
 * `world-surface-movement.ts`, which keeps its single-precision arithmetic
 * for the older steps; the two differ in the last bit now and then, which is
 * enough to change a world path's ties.
 *
 * Pure: reads tile centre, biome, relief and mean temperature. */
import {roundToInt,simpleCurveEvaluate} from './verse-rand.ts';
import {worldBiomeMovement} from './world-biome-properties.ts';
import {WORLD_SURFACE_RADIUS} from './world-surface-mesh.ts';
import type {ClimateSetting} from './world-climate-settings.ts';
import type {WorldSurfaceTile} from './world-surface-geography.ts';
const f=Math.fround;
const DEGREES=f(57.29578);
const clamp01=(x:number)=>x<0?0:x>1?1:x;
/** `Mathf.InverseLerp(a, b, value)`: the quotient is one expression. */
const inverseLerp=(a:number,b:number,value:number)=>a!==b?clamp01(f((value-a)/(b-a))):0;
/** Equatorial and seasonal maximum latitudes per overall temperature
 * (`LatitudeSectionUtility.GetMaxLatitude`); the polar one is 999 for all. */
const MAX_LATITUDES:readonly (readonly [number,number])[]=[[-999,-999],[-999,15],[-999,40],[15,75],[35,999],[65,999],[999,999]];
const SEASONAL_AREA_SEASONS=[[-.042500004,0],[.042500004,1],[.2075,1],[.29250002,2],[.45749998,2],[.5425,3],[.7075,3],[.7925,4],[.9575,4],[1.0425,5]] as const;
const SEASONAL_TEMPERATURE_VARIATION=[[0,3],[.1,4],[1,28]] as const;
const RELIEF_OFFSET={flat:0,'small-hills':.5,'large-hills':1.5,mountainous:3,impassable:1000} as const;
/** `PlanetLayer.LongLatOf`: longitude, latitude in degrees. */
export function coreLongLat(center:readonly [number,number,number]):{longitude:number;latitude:number} {
 return {longitude:f(f(Math.atan2(center[0],f(-center[2])))*DEGREES),latitude:f(f(Math.asin(f(center[1]/WORLD_SURFACE_RADIUS)))*DEGREES)};
}
/** `LatitudeSectionUtility.GetLatitudeSection`. */
export function coreLatitudeSection(latitude:number,temperature:ClimateSetting):{equatorial:number;seasonal:number;polar:number} {
 const at=Math.abs(latitude),[equator,seasonalLimit]=MAX_LATITUDES[temperature]!;
 if(at<=equator)return {equatorial:1,seasonal:0,polar:0};
 if(at>seasonalLimit)return at<=999?{equatorial:0,seasonal:0,polar:1}:{equatorial:0,seasonal:0,polar:0};
 let equatorial=inverseLerp(f(equator+5),equator,at),polar=inverseLerp(f(seasonalLimit-5),seasonalLimit,at);
 let seasonal=Math.min(f(1-equatorial),f(1-polar));
 const sum=f(equatorial+seasonal+polar);
 if(sum===0)return {equatorial:1,seasonal:0,polar:0};
 equatorial=f(equatorial/sum);seasonal=f(seasonal/sum);polar=f(polar/sum);
 return {equatorial,seasonal,polar};
}
/** The winter share of `GetSeasonalAreaSeason`. */
function seasonalAreaWinter(yearPct:number,northernHemisphere:boolean):number {
 yearPct=clamp01(yearPct);
 const x=northernHemisphere?yearPct:f((yearPct+.5)%1),phase=simpleCurveEvaluate(SEASONAL_AREA_SEASONS,x);
 return phase<=1?f(1-phase):phase<=3?0:phase<=4?f(phase-3):f(1-(phase-4));
}
/** `SeasonUtility.GetSeason`: winter and permanent winter. */
export function coreWinter(yearPct:number,latitude:number,temperature:ClimateSetting):{winter:number;permanentWinter:number} {
 yearPct=clamp01(yearPct);
 const section=coreLatitudeSection(latitude,temperature),north=seasonalAreaWinter(yearPct,true),south=seasonalAreaWinter(yearPct,false);
 const share=inverseLerp(-2.5,2.5,latitude),blended=f(share*north+(1-share)*south);
 return {winter:f(blended*section.seasonal),permanentWinter:section.polar};
}
/** `GenDate.YearPercent(absTicks, longitude)`. */
export function coreYearPercent(absTicks:number,longitude:number):number {
 const offset=roundToInt(f(longitude/15))*2500,year=3600000;
 return f((((absTicks+offset)%year+year)%year)/year);
}
/** `GenTemperature.GetTemperatureFromSeasonAtTile(absTick, tile)`. */
export function coreSeasonalTemperature(tile:Pick<WorldSurfaceTile,'center'|'meanTemperature'>,absTick:number):number {
 if(absTick===0)absTick=1;
 const yearPct=f(f(absTick)/60000%60/60),winterMiddle=f(10/12);
 const amplitudeAbs=simpleCurveEvaluate(SEASONAL_TEMPERATURE_VARIATION,Math.abs(f(tile.center[1]/WORLD_SURFACE_RADIUS)));
 const amplitude=coreLongLat(tile.center).latitude>=0?amplitudeAbs:f(0-amplitudeAbs);
 const offset=f(f(Math.cos(f(f(Math.PI)*2*(yearPct-winterMiddle))))*(0-amplitude));
 return f(tile.meanTemperature+offset);
}
/** `WorldPathGrid.CalculatedMovementDifficultyAt(tile, true, ticksAbs)`. */
export function coreMovementDifficulty(tile:Pick<WorldSurfaceTile,'center'|'biome'|'hilliness'|'meanTemperature'>,temperature:ClimateSetting,ticksAbs:number):number {
 if(tile.biome==='ocean'||tile.biome==='lake'||tile.hilliness==='impassable')return 1000;
 const base=f(worldBiomeMovement(tile.biome)+RELIEF_OFFSET[tile.hilliness]);
 const coordinates=coreLongLat(tile.center),season=coreWinter(coreYearPercent(ticksAbs,coordinates.longitude),coordinates.latitude,temperature);
 const severity=f(f(season.winter+season.permanentWinter)*inverseLerp(5,0,coreSeasonalTemperature(tile,ticksAbs)));
 return f(base+(severity>f(.01)?f(2*severity):0));
}
/** `WorldPathGrid.RecalculateLayerPerceivedPathCosts(layer, ticksAbs)`. */
export function captureCoreMovementDifficulties(tiles:readonly Pick<WorldSurfaceTile,'center'|'biome'|'hilliness'|'meanTemperature'>[],temperature:ClimateSetting,ticksAbs:number):Float32Array {
 if(!Number.isSafeInteger(ticksAbs)||ticksAbs<0)throw Error('Invalid world movement clock');
 return Float32Array.from(tiles,tile=>coreMovementDifficulty(tile,temperature,ticksAbs));
}
