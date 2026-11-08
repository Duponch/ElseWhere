import { createPlantGrowthReader, isPlant, plantTemperatureFactorFor } from './plants.ts';
import { FLORA_DEFINITIONS } from './biome-flora.ts';
import { isCropKindInVersion } from './crops.ts';
import { outdoorTemperature } from './temperature.ts';
import type { ThermalLayout } from './thermal-topology.ts';
import type { Resource, World } from './types.ts';
import { schemaAtLeast } from './schema-range.ts';

interface Group { plants:Resource[]; region:number; factor?:number }
interface Binding { source:Resource[]; layout:ThermalLayout; groups:Group[] }
const bindings=new WeakMap<World,Binding>();

/** RimWorld 1.6 Plant.TickLong cadence: a plant runs every 2000 Core ticks,
 * on the Core tick where TicksGame % 2000 == thingIDNumber % 2000, and reads its
 * cell temperature at that instant. Here that is one local tick out of 200. */
const PLANT_TICK_LONG_CORE=2000,CORE_PER_LOCAL=10,PLANT_TICK_LONG_LOCAL=PLANT_TICK_LONG_CORE/CORE_PER_LOCAL;
/** The current schema family samples temperature at each plant's TickLong;
 * historical schemas keep their immediate regional update. */
const sampledAtTickLong=schemaAtLeast(301);
interface Schedule { source:Resource[]; buckets:Resource[][] }
const schedules=new WeakMap<World,Schedule>(),sampledTicks=new WeakMap<World,number>();
const plantTickLongSlot=(plant:Resource):number=>Math.floor(plant.id%PLANT_TICK_LONG_CORE/CORE_PER_LOCAL);

/** Each plant samples its temperature factor at its own TickLong only. A changed
 * factor settles the elapsed growth at the factor sampled before (the light
 * integral stays continuous, see docs) and governs growth until the next sample.
 * Elapsed local ticks since the previous call are all sampled, in order; a
 * repeated call within one tick samples nothing more. Without a previous call
 * (new World object), only the current tick's plants are sampled. */
function updatePlantTemperaturesAtTickLong(world:World,layout:ThermalLayout):void {
  let schedule=schedules.get(world);
  if(!schedule||schedule.source!==world.resources){
    const buckets:Resource[][]=Array.from({length:PLANT_TICK_LONG_LOCAL},()=>[]);
    for(const plant of world.resources)if(isPlant(plant))buckets[plantTickLongSlot(plant)]!.push(plant);
    schedule={source:world.resources,buckets};schedules.set(world,schedule);
  }
  const now=world.tick,last=sampledTicks.get(world);
  if(last!==undefined&&now<=last)return;
  sampledTicks.set(world,now);
  const count=last===undefined?1:Math.min(PLANT_TICK_LONG_LOCAL,now-last);
  let outdoor:number|undefined,readGrowth:ReturnType<typeof createPlantGrowthReader>|undefined;
  for(let step=count-1;step>=0;step--){
    for(const plant of schedule.buckets[(now-step)%PLANT_TICK_LONG_LOCAL]!){
      const region=Math.max(-1,layout.indices[plant.z*world.width+plant.x]!);
      const temperature=region<0?(outdoor??=outdoorTemperature(world)):world.thermal!.regions[region]!.temperature;
      const factor=plantTemperatureFactorFor(plant,temperature);
      if((plant.growthThermalFactor??1)===factor)continue;
      readGrowth??=createPlantGrowthReader(world);
      plant.growth=readGrowth(plant);plant.growthTick=world.tick;
      if(factor===1)delete plant.growthThermalFactor;else plant.growthThermalFactor=factor;
    }
  }
}

/** Rates are shared by thermal region. Only a changed factor visits its plants;
 * the ordinary temperate forest keeps the O(1) light integral and no tick writes.
 * Resource producers replace arrays; checkpoints may mutate the same plants. */
export function updatePlantTemperatures(world:World,layout:ThermalLayout):void {
  if(sampledAtTickLong(Number(world.schemaVersion))){updatePlantTemperaturesAtTickLong(world,layout);return;}
  let binding=bindings.get(world);
  if(!binding||binding.source!==world.resources||binding.layout!==layout) {
    // Same (region, maximum) grouping and first-occurrence order as before,
    // without building a string key for every plant of the map.
    const groups:Group[]=[],byRegion=new Map<number,Map<number,Group>>();
    for(const plant of world.resources)if(isPlant(plant)) {
      const region=Math.max(-1,layout.indices[plant.z*world.width+plant.x]!);
      const maximum=plant.species?FLORA_DEFINITIONS[plant.species].maxGrowthTemperature:58;
      let byMaximum=byRegion.get(region);if(!byMaximum){byMaximum=new Map();byRegion.set(region,byMaximum);}
      let group=byMaximum.get(maximum);if(!group){group={plants:[],region};byMaximum.set(maximum,group);groups.push(group);}group.plants.push(plant);
    }
    binding={source:world.resources,layout,groups};bindings.set(world,binding);
  }
  // Only immutable environmental inputs are shared within this call. Growth
  // and its anchor remain live per plant as each old interval is settled.
  let readGrowth:ReturnType<typeof createPlantGrowthReader>|undefined;
  for(const group of binding.groups) {
    const temperature=group.region<0?outdoorTemperature(world):world.thermal!.regions[group.region]!.temperature;
    const commonFactor=plantTemperatureFactorFor(group.plants[0]!,temperature);
    if(commonFactor===group.factor)continue;
    for(const plant of group.plants) {
      if((plant.growthThermalFactor??1)===commonFactor)continue;
      // Settle past light at its saved factor before adopting the next interval.
      readGrowth??=createPlantGrowthReader(world);
      plant.growth=readGrowth(plant);plant.growthTick=world.tick;
      if(commonFactor===1)delete plant.growthThermalFactor;else plant.growthThermalFactor=commonFactor;
    }
    group.factor=commonFactor;
  }
}

export function validPlantThermalFactor(resource:{kind?:unknown;species?:unknown;growth?:unknown;growthTick?:unknown;growthThermalFactor?:unknown},version:number):boolean {
  const factor=resource.growthThermalFactor;
  return factor===undefined || version>=39&&(resource.kind==='berries'||version>=91&&resource.species!==undefined||isCropKindInVersion(resource.kind,version))
    &&typeof factor==='number'&&Number.isFinite(factor)&&factor>=0&&factor<=1
    &&typeof resource.growth==='number'&&Number.isFinite(resource.growth)&&resource.growth>=0&&resource.growth<=1
    &&typeof resource.growthTick==='number'&&Number.isSafeInteger(resource.growthTick)&&resource.growthTick>=0;
}
