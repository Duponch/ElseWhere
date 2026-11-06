import {plantCompletelyIgnoresFertility256,plantSubstrateAllowed256} from './plant-substrate-256.ts';
import {naturalPlantSubstrate256,terrainGroundFertility256} from './natural-terrain-runtime-256.ts';
import {isCavePlant256} from './cave-flora-256.ts';
import { TICKS_PER_DAY, type Pawn, type Resource, type World } from './types.ts';
import { plantHarvestYield } from './plant-skills.ts';
import { isRoofed, roofIndex } from './roof-rules.ts';
import { annualGrowingLightIntegral } from './environment.ts';
import { climateTick,type ClimateWorld } from './site-climate.ts';
import { soilFertility } from './soil.ts';
import { isCropKind, type CropKind } from './crops.ts';
import { FLORA_DEFINITIONS } from './biome-flora.ts';
import { hydroponicFertility } from './hydroponics.ts';

export const PLANT_DEFINITIONS = Object.freeze({
  hops:{label:'Houblon',growDays:5,minFertility:.7,sensitivity:.7,afterHarvest:0,yield:8},
  haygrass: { label: 'Herbe à foin', growDays: 7, minFertility: .7, sensitivity: .6, afterHarvest: 0, yield: 18 },
  healroot: { label: 'Racine médicinale', growDays: 7, minFertility: .7, sensitivity: 1, afterHarvest: 0, yield: 1 },
  cotton: { label: 'Coton', growDays: 8, minFertility: .7, sensitivity: 1, afterHarvest: 0, yield: 10 },
  berries: { label: 'Buisson de baies', growDays: 6, minFertility: .5, sensitivity: .5, afterHarvest: .3, yield: 10 },
  rice: { label: 'Riz', growDays: 3, minFertility: .7, sensitivity: 1, afterHarvest: 0, yield: 6 },
  potato: { label: 'Pommes de terre', growDays: 5.8, minFertility: .7, sensitivity: .4, afterHarvest: 0, yield: 11 },
  corn: { label: 'Maïs', growDays: 11.3, minFertility: .7, sensitivity: 1, afterHarvest: 0, yield: 22 },
});
export const isPlant = (plant: Resource): boolean => plant.species!==undefined || plant.kind === 'berries' || isCropKind(plant.kind);
export const isCrop = (plant: Pick<Resource,'kind'>): plant is Pick<Resource,'kind'>&{kind:CropKind} => isCropKind(plant.kind);
export const harvestProductLabel = (plant:Resource):string => plant.species?FLORA_DEFINITIONS[plant.species].product==='wood'?'bois':FLORA_DEFINITIONS[plant.species].product==='agave-fruit'?'agave':FLORA_DEFINITIONS[plant.species].product==='berries'?'baies':FLORA_DEFINITIONS[plant.species].product==='herbal-medicine'?'dose de médicament à base de plantes':FLORA_DEFINITIONS[plant.species].label:
  plant.kind==='tree'?'bois':plant.kind==='hops'?'houblon':plant.kind==='haygrass'?'foin':plant.kind==='healroot'?'dose de médicament à base de plantes':plant.kind==='cotton'?'tissu':plant.kind==='rice'?'riz':plant.kind==='potato'?'pommes de terre':plant.kind==='corn'?'maïs':'baies';

export const BERRY_GROW_DAYS = 6;
export const HARVEST_MIN_GROWTH = .65;
export const AFTER_HARVEST_GROWTH = .3;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));

export const plantTemperatureFactor = (temperature:number):number => temperature < 6 ? clamp(temperature / 6) : temperature > 42 ? clamp((58 - temperature) / 16) : 1;
export const plantTemperatureFactorFor = (plant:Pick<Resource,'species'>,temperature:number):number => {
  const max=plant.species?FLORA_DEFINITIONS[plant.species].maxGrowthTemperature:58;
  return temperature<6?clamp(temperature/6):temperature>42?clamp((max-temperature)/(max-42)):1;
};
export const sowingTemperatureAllowed = (temperature:number):boolean => temperature > 0 && temperature < 58;

/** Historical berry calculation; current species use their own sensitivity below. */
export function plantGrowthRate(light: number, temperature: number, fertility: number, resting = false): number {
  if (resting || fertility < .5) return 0;
  const heat = plantTemperatureFactor(temperature);
  return clamp((light - .51) / .49) * heat * (.5 + fertility * .5);
}
export const plantFertility = (world: World, plant: Resource): number => {
  if(isCrop(plant)) {const fertility=hydroponicFertility(world,plant);if(fertility!==undefined)return fertility;}
  const tile = world.tiles[plant.z * world.width + plant.x]!;
  return world.schemaVersion>=256?terrainGroundFertility256(tile):tile.floor?0:soilFertility(tile.terrain);
};
export const plantResting = (tick: number): boolean => {
  const day = tick % TICKS_PER_DAY / TICKS_PER_DAY;
  return day < .25 || day > .8;
};

// Fixed temperate, unroofed preset: full daylight during the growing window,
// 21°C. Exact integral avoids scanning/mutating every plant each tick. Future
// environmental changes must checkpoint growth before changing its rate.
function favorableTicks(tick: number): number {
  const day = Math.floor(tick / TICKS_PER_DAY), remainder = tick % TICKS_PER_DAY;
  const start = TICKS_PER_DAY * .25, end = TICKS_PER_DAY * .8;
  return day * (end - start + 1) + Math.max(0, Math.min(remainder, end) - start + 1);
}
export function legacyPlantGrowth(world: World, plant: Resource): number {
  if (plant.kind !== 'berries') return 1;
  const base = plant.growth ?? 1;
  if (base >= 1) return 1;
  const elapsed = favorableTicks(world.tick) - favorableTicks(plant.growthTick ?? world.tick);
  return clamp(base + elapsed * plantGrowthRate(1, 21, plantFertility(world, plant)) / (BERRY_GROW_DAYS * TICKS_PER_DAY));
}
/** Full light during the existing inclusive civil growing window. Differences
 * integrate (anchor,tick], just like the natural-light prefix. No accumulated
 * per-plant integral or elapsed-day loop is needed. */
export function fullGrowingLightIntegral(world:ClimateWorld,tick=world.tick):number {
  const civil=climateTick(world,tick),day=Math.floor(civil/TICKS_PER_DAY),remainder=civil-day*TICKS_PER_DAY;
  const start=TICKS_PER_DAY*.25,end=TICKS_PER_DAY*.8,count=end-start+1;
  return day*count+Math.max(0,Math.min(count,remainder-start+1));
}
type GrowthPassInputs={
  fertility(plant:Resource):number;
  allowed(plant:Resource):boolean|undefined;
  lightTime(plant:Resource,full:boolean):number;
};
/** The public reader and a synchronous evaluation pass use this one formula.
 * The pass only shares identical input calculations; arithmetic order stays
 * literal, including the inclusive light integral and strict harvest limit. */
function readPlantGrowth(world:World,plant:Resource,inputs?:GrowthPassInputs):number {
  // Exact shortcut: with a stored growth of exactly 1 every branch below
  // returns either base (1) or 1, so skip the roof/substrate/light reads.
  if ((plant.growth ?? 1) === 1) return 1;
  if (!isPlant(plant)) return 1;
  const base = plant.growth ?? 1;
  if(plant.blight)return base;
  const cave=isCavePlant256(plant.species,world.schemaVersion);
  if(!cave&&(plant.growthLight==='dark'||plant.growthLight!=='artificial-full'&&isRoofed(world,roofIndex(world,plant))))return base;
  if (base >= 1) return 1;
  const def = plant.species?FLORA_DEFINITIONS[plant.species]:PLANT_DEFINITIONS[plant.kind as keyof typeof PLANT_DEFINITIONS], fertility = inputs?inputs.fertility(plant):plantFertility(world, plant);
  const ignoreFertility=plantCompletelyIgnoresFertility256(plant.species,world.schemaVersion);
  if(!ignoreFertility&&fertility<def.minFertility||world.schemaVersion>=256&&(inputs?inputs.allowed(plant):plantSubstrateAllowed256(plant.species,world.schemaVersion,naturalPlantSubstrate256(world.tiles[plant.z*world.width+plant.x]!)))===false)return base;
  const integral=cave||plant.growthLight==='artificial-full'?fullGrowingLightIntegral:annualGrowingLightIntegral;
  const lightTime = inputs?inputs.lightTime(plant,cave||plant.growthLight==='artificial-full'):integral(world) - integral(world, plant.growthTick ?? world.tick);
  const factor = (plant.growthThermalFactor ?? 1) * (ignoreFertility?1:1 - def.sensitivity + fertility * def.sensitivity);
  return clamp(base + lightTime * factor / (def.growDays * TICKS_PER_DAY));
}
export function plantGrowth(world:World,plant:Resource):number {return readPlantGrowth(world,plant);}

/** Shared environmental inputs for one synchronous evaluation. No resource
 * result, tile or World is cached globally; public plantGrowth keeps its
 * unrestricted RAW reads. The owning reader defines its environmental lifetime.
 * Terrain/species combinations and light anchors are shared by the population,
 * instead of re-deriving the same substrate DTO and integral for every plant. */
function createPlantGrowthInputs(world:World):GrowthPassInputs {
  type Substrate=ReturnType<typeof naturalPlantSubstrate256>;
  type Ground={fertility:number;substrate?:Substrate;allowed:Map<Resource['species'],boolean|undefined>};
  const grounds=new Map<string,Map<string|undefined,[Ground?,Ground?]>>();
  let recent:Ground|undefined,recentTerrain:string|undefined,recentStone:string|undefined,recentLayer=-1;
  const ground=(plant:Resource):Ground=>{
    const tile=world.tiles[plant.z*world.width+plant.x]!,terrain=tile.terrain,stone=tile.stone;
    const layer=tile.bridge||tile.floor?1:0;
    // Re-read the actual key on every call. fertility -> allowed commonly
    // repeats this exact private entry, without needing two more Map lookups.
    if(recent&&terrain===recentTerrain&&stone===recentStone&&layer===recentLayer)return recent;
    let stones=grounds.get(terrain);if(!stones){stones=new Map();grounds.set(terrain,stones);}
    let layers=stones.get(stone);if(!layers){layers=[];stones.set(stone,layers);}
    const value=layers[layer]??(layers[layer]={fertility:terrainGroundFertility256(tile),allowed:new Map()});
    recentTerrain=terrain;recentStone=stone;recentLayer=layer;return recent=value;
  };
  const annual=new Map<number,number>(),full=new Map<number,number>();
  const integral=(tick:number,artificial:boolean):number=>{
    const values=artificial?full:annual,old=values.get(tick);if(old!==undefined)return old;
    const value=(artificial?fullGrowingLightIntegral:annualGrowingLightIntegral)(world,tick);values.set(tick,value);return value;
  };
  const inputs:GrowthPassInputs={
    fertility(plant){
      if(world.schemaVersion<256)return plantFertility(world,plant);
      if(isCrop(plant)){const value=hydroponicFertility(world,plant);if(value!==undefined)return value;}
      return ground(plant).fertility;
    },
    allowed(plant){
      const entry=ground(plant),species=plant.species;
      const cached=entry.allowed.get(species);
      if(cached!==undefined||entry.allowed.has(species))return cached;
      const substrate=entry.substrate??(entry.substrate=naturalPlantSubstrate256(world.tiles[plant.z*world.width+plant.x]!));
      const value=plantSubstrateAllowed256(species,world.schemaVersion,substrate);entry.allowed.set(species,value);return value;
    },
    lightTime(plant,artificial){return integral(world.tick,artificial)-integral(plant.growthTick??world.tick,artificial);},
  };
  return inputs;
}

/** One synchronous evaluation with stable environmental inputs: same World,
 * tick, schema, climate/light intervals, roofs, ground and hydroponic layout.
 * Discard before changing any of those inputs or leaving the current call.
 * A caller may settle a plant's growth, growthTick and growthThermalFactor
 * immediately after reading it: these values are read afresh on every call,
 * and each light-integral entry is keyed by the actual requested anchor.
 * No plant growth result is retained. The public RAW reader stays uncached. */
export function createPlantGrowthReader(world:World):(plant:Resource)=>number {
  const inputs=createPlantGrowthInputs(world);
  return plant=>readPlantGrowth(world,plant,inputs);
}

/** One synchronous forecast pass over unchanged publication inputs. The local
 * shadow changes only tick; integral entries are keyed by that explicit tick,
 * including anchor lookups. Ground, roofs, climate and eclipse interval stay
 * unchanged. Discard this reader before another publication or any mutation.
 * No shadow, callback or cache is stored in a forecast or authoritative World. */
export function createPlantGrowthForecastReader(world:World):(plant:Resource,tick:number)=>number {
  const probe={...world},inputs=createPlantGrowthInputs(probe);
  return (plant,tick)=>{probe.tick=tick;return readPlantGrowth(probe,plant,inputs);};
}
export const choppable=(world:World,plant:Resource):boolean=>plant.kind==='tree'&&(!plant.species||plantGrowth(world,plant)>=FLORA_DEFINITIONS[plant.species].harvestMinGrowth);
export const harvestable = (world: World, plant: Resource,readGrowth?:()=>number): boolean => !plant.blight&&isPlant(plant)&&plant.kind!=='tree'&&
  (!plant.species||FLORA_DEFINITIONS[plant.species].product!==null)&&(readGrowth?readGrowth():plantGrowth(world,plant)) > (plant.species?FLORA_DEFINITIONS[plant.species].harvestMinGrowth:HARVEST_MIN_GROWTH);
export function berryYield(world: World, plant: Resource): number {
  if(plant.blight)return 0;
  const growth = plantGrowth(world, plant);
  const minimum=plant.species?FLORA_DEFINITIONS[plant.species].harvestMinGrowth:HARVEST_MIN_GROWTH;
  if(growth<=minimum)return 0;
  const medicinal=plant.kind==='healroot'||plant.species==='healroot-wild';
  const healthSensitive=medicinal||plant.kind==='haygrass';
  const remaining=healthSensitive?Math.max(0,Math.min(1,1-(plant.damage??0)/(medicinal?FLORA_DEFINITIONS['healroot-wild'].hitPoints:85))):1;
  const health=healthSensitive?.5+.5*remaining:1;
  return plant.amount * (.5 + .5 * (growth - minimum) / (1 - minimum)) * health;
}

/** Current yield eligibility at resolution; this is a reader, not a draw.
 * Uses the existing clone's growth/HP basis. It does not add Core difficulty,
 * drug-yield or duration rules, nor change historical CHOP/HARVEST contracts. */
export function plantCanYieldNow(world:World,plant:Resource):boolean {
  const hasProduct=plant.species?FLORA_DEFINITIONS[plant.species].product!==null:
    plant.kind==='tree'||plant.kind==='berries'||isCrop(plant);
  return hasProduct&&!plant.blight&&plant.amount>0&&berryYield(world,plant)>0;
}
/** Preview stochastic rounding without consuming RNG until placement succeeds. */
export function harvestRoll(world: World, plant: Resource, worker?:Pawn): { quantity: number; rng: number } {
  if(plant.blight)return {quantity:0,rng:world.rng};
  // Real human work uses Core's failure -> base RoundRandom -> surplus
  // RoundRandom order. Preview in a private stream: refused placement must
  // neither destroy a plant nor advance the authoritative RNG.
  if(worker){
    let rng=world.rng;
    const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;return rng/0x100000000;};
    const round=(value:number)=>Math.floor(value)+(random()<value%1?1:0);
    const efficiency=plantHarvestYield(worker);
    if(plant.kind!=='tree'&&random()>efficiency)return {quantity:0,rng};
    let quantity=round(berryYield(world,plant));
    if(efficiency>1)quantity=round(quantity*efficiency);
    return {quantity,rng};
  }
  const raw = berryYield(world, plant), whole = Math.floor(raw);
  if (raw === whole) return { quantity: whole, rng: world.rng };
  let rng = world.rng; rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; rng >>>= 0;
  return { quantity: whole + (rng / 0x100000000 < raw - whole ? 1 : 0), rng };
}
