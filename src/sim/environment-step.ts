import {advanceGeothermalGenerators264} from './geothermal-runtime-264.ts';
import {advanceActualWildFlora256} from './wild-plant-actual-runtime-256.ts';
import { adoptSiteClimate,siteClimateDefinition } from './site-climate.ts';
import { adoptWeather,advanceWeather,weatherRainRate } from './weather.ts';
import { adoptWind,advanceWind } from './wind.ts';
import { advanceTemperature,outdoorTemperature,reconcileTemperature } from './temperature.ts';
import { updatePlantTemperatures } from './thermal-plants.ts';
import { reconcilePlantLighting } from './plant-lighting.ts';
import { sharedLightEnvironmentCache,type LightReader } from './light-environment.ts';
import { advancePlantLife } from './plant-life.ts';
import { advanceFires,fireDanger,igniteLightning } from './fire.ts';
import { ensureFireState } from './fire-rules.ts';
import { advanceFlashstorm } from './flashstorm.ts';
import type { ThermalLayout } from './thermal-topology.ts';
import type { Cell,World } from './types.ts';
import {stepSnowSurface} from './snow-surface.ts';
import {advanceLocalGeysers256} from './local-geyser-runtime-256.ts';
import { advanceWildFlora } from './wild-flora.ts';

/** One explicit adoption, without replaying weather or exposure in old saves. */
export function adoptEnvironment(world:World):boolean {
  if(!adoptSiteClimate(world))return false;
  adoptWeather(world);adoptWind(world);ensureFireState(world);
  return true;
}

/** Weather events mutate the physical world before actors make decisions.
 * Keep the layout current after a fire removes an enclosing structure. */
export function advanceSurfaceWeather(world:World,chop:(cell:Cell)=>void):void {
  if(world.weather)advanceWeather(world,{outsideTemperature:outdoorTemperature(world),rainfall:siteClimateDefinition(world).rainfall,
    fireDanger:()=>fireDanger(world),lightning:(cell,coreTick)=>{igniteLightning(world,cell,coreTick);}});
  advanceFlashstorm(world,(cell,coreTick)=>{
    world.weather!.lightningCount++;world.weather!.lastLightning={...cell,coreTick};
    igniteLightning(world,cell,coreTick);
  });
  if(world.wind)advanceWind(world,chop);
}
export function advanceSurfaceTemperature(world:World,layout:ThermalLayout,providedLight?:LightReader):ThermalLayout {
  const light=providedLight??(()=>sharedLightEnvironmentCache(world).read(world));
  advanceTemperature(world,layout);
  advanceLocalGeysers256(world,layout);
  advanceGeothermalGenerators264(world,layout);
  const before=world.structures;
  if(world.fires)advanceFires(world,{rainRate:weatherRainRate(world)},layout);
  if(before!==world.structures)layout=reconcileTemperature(world);
  reconcilePlantLighting(world,light);
  updatePlantTemperatures(world,layout);
  if(world.climate)advancePlantLife(world,layout,light);
  stepSnowSurface(world,layout);
  if(world.site?.revision===3)advanceActualWildFlora256(world);else advanceWildFlora(world);
  return layout;
}
