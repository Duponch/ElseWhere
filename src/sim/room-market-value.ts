import {CARPET_FLOORS_355,type CarpetFloor355} from './carpet-355.ts';
import {SHELL_FACTS_357} from './ied-traps-357.ts';
import {SHIP_COMPUTER_CONTENT_298,SHIP_SENSORS_CONTENT_298} from './ship-computer-sensors-content-298.ts';
import {AI_CORE_CONTENT_298} from './ai-core-content-298.ts';
import {SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {hasSmoothedStoneSubstrate281,SMOOTHED_STONE_FACTS_281} from './smooth-floor-terrain-281.ts';
import {SHIP_BEAM_CONTENT_276,SHIP_ENGINE_CONTENT_276} from './ship-part-content-276.ts';
import {BEDROLL_TEXTILE_MARKET_VALUES_256} from './bedroll-textiles-256.ts';
import { FURNITURE_MATERIALS,isSculptureKind,isSculptureMaterial,sculptureWorkToMakeCore } from './furniture-stats.ts';
import { structureMaxHp } from './thing-damage-rules.ts';
import { roundTradeSilver, tradeHealthFactor } from './trade-prices.ts';
import type { ConstructionMaterial } from './building-materials.ts';
import type { FloorKind } from './flooring.ts';
import type { Resource, ResourceKind, Structure, StructureKind, Tile } from './types.ts';

/** Core 1.6.4871, StatWorker_MarketValue. These are market values, never
 * negotiated prices or the resale multiplier of a building. */
const VALUE_PER_WORK = .0036;
const UNKNOWN_STUFF_VALUE = 2;
const MATERIAL_VALUE: Readonly<Record<ConstructionMaterial, number>> = Object.freeze({
  ...BEDROLL_TEXTILE_MARKET_VALUES_256,
  wood: 1.2, steel: 1.9, jade:5,
  'granite-blocks': .9, 'limestone-blocks': .9, 'marble-blocks': .9,
  'sandstone-blocks': .9, 'slate-blocks': .9,
  cloth: 1.5, 'light-leather': 1.9,
});

type Passability = 'standable' | 'pass-through' | 'impassable';
interface BuildingValueDef {
  /** Core costStuffCount, separate from fixed costList. */
  readonly stuff: number;
  /** Explicit Core MarketValue overrides costs/work; zero remains explicit. */
  readonly baseMarketValue?: number;
  readonly wood: number;
  readonly steel: number;
  readonly uranium:number;
  readonly plasteel: number;
  readonly gold: number;
  readonly component: number;
  readonly advancedComponent: number;
  readonly aiCore?:number;
  /** Cloth of a fixed costList (schema 354 billiards and poker tables). */
  readonly cloth?:number;
  /** Mortar shells of a fixed costList (schema 357 IED traps). */
  readonly shells?:number;
  /** Neutral Core WorkToBuild, or WorkToMake for a sculpture, before stuff. */
  readonly work: number;
  readonly quality: boolean;
  readonly passability: Passability;
}
const def = (stuff: number, work: number, passability: Passability,
  fixed: Readonly<{uranium?:number; wood?: number; steel?: number; plasteel?: number; gold?: number; component?: number; 'advanced-component'?: number;'ai-core'?:number;cloth?:number;shells?:number}> = {},
  quality = false): BuildingValueDef => Object.freeze({
    stuff, work, passability, quality,
    wood: fixed.wood ?? 0, steel: fixed.steel ?? 0, plasteel: fixed.plasteel ?? 0, gold: fixed.gold ?? 0,
    uranium:fixed.uranium??0,component: fixed.component ?? 0, advancedComponent: fixed['advanced-component'] ?? 0,...fixed['ai-core']?{aiCore:fixed['ai-core']}:{},...fixed.cloth?{cloth:fixed.cloth}:{},...fixed.shells?{shells:fixed.shells}:{},
  });

/** Resolved Core building Defs. An explicit zero prevents a new kind from
 * inheriting a fictitious value. Historical untyped furniture keeps Core's
 * abstract-stuff estimate rather than receiving a fabricated material. */
const BUILDINGS: Readonly<Record<StructureKind, BuildingValueDef>> = Object.freeze({
 'firefoam-popper':def(0,1500,'pass-through',{steel:75,component:1}),
 'tool-cabinet':def(0,1800,'pass-through',{steel:200}),
 'ied-high-explosive':def(0,1400,'standable',{shells:2}),'ied-incendiary':def(0,1400,'standable',{shells:2}),
 'ship-cryptosleep-casket':def(0,SHIP_CASKET_CONTENT_277.coreWork,'pass-through',Object.fromEntries(SHIP_CASKET_CONTENT_277.ingredients.map(c=>[c.item,c.quantity]))),
 'ship-computer':def(0,SHIP_COMPUTER_CONTENT_298.coreWork,'impassable',Object.fromEntries(SHIP_COMPUTER_CONTENT_298.ingredients.map(c=>[c.item,c.quantity]))),
 'ship-sensors':def(0,SHIP_SENSORS_CONTENT_298.coreWork,'impassable',Object.fromEntries(SHIP_SENSORS_CONTENT_298.ingredients.map(c=>[c.item,c.quantity]))),
 'ship-beam':def(0,SHIP_BEAM_CONTENT_276.coreWork,'impassable',Object.fromEntries(SHIP_BEAM_CONTENT_276.ingredients.map(c=>[c.item,c.quantity]))),
 'ship-engine':def(0,SHIP_ENGINE_CONTENT_276.coreWork,'impassable',Object.fromEntries(SHIP_ENGINE_CONTENT_276.ingredients.map(c=>[c.item,c.quantity]))),
 'ship-reactor':def(0,65000,'impassable',{steel:350,plasteel:280,uranium:70,'advanced-component':8}),
 'cryptosleep-casket':def(0,3200,'pass-through',{steel:180,uranium:5,component:4,'advanced-component':1}),
 'fueled-smithy':def(0,3000,'pass-through',{steel:100}),'electric-smithy':def(0,3000,'pass-through',{steel:100,component:3}),
 brewery:def(0,2000,'pass-through',{wood:120,steel:30}),'fermenting-barrel':def(0,600,'pass-through',{wood:30,steel:10}),
 // Hive has no cost/recipe/work contribution; GlowPod supplies MarketValue50.
 'insect-hive':def(0,1,'pass-through'),
 'glow-pod':Object.freeze({...def(0,1,'pass-through'),baseMarketValue:50}),
 'ancient-cryptosleep-casket':def(0,1,'pass-through',{steel:180,uranium:5}),
 column:def(20,750,'pass-through'),urn:def(20,500,'pass-through'),'stele-large':def(125,8000,'pass-through'),'stele-grand':def(250,16000,'pass-through'),sarcophagus:def(60,2400,'pass-through',{},true),
  'ancient-road-barrier':def(0,600,'pass-through',{steel:15}),
  'ancient-road-lamp':def(0,400,'pass-through',{steel:15}),
  'ship-chunk':def(0,12000,'pass-through',{component:11,steel:40}),
  vent:def(0,400,'impassable',{steel:30}),
  shelf:def(20,500,'pass-through'),'small-shelf':def(10,250,'pass-through'),
  'spike-trap':def(45,3200,'standable'),
  'electric-crematorium':def(150,4500,'impassable',{steel:20,component:2}),
  bedroll:def(40,600,'standable',{},true),
  'double-bed':def(85,1500,'pass-through',{},true),
  'sleeping-spot':def(0,0,'standable'),
  'animal-sleeping-spot':def(0,0,'standable'),
  'electric-smelter':def(0,3500,'pass-through',{steel:170,component:2}),
  'biofuel-refinery':def(0,2000,'pass-through',{steel:150,component:3}),
  'geothermal-generator':def(0,12000,'impassable',{steel:340,component:8}),
  'chemfuel-generator':def(0,2500,'pass-through',{steel:100,component:3}),
  'nutrient-paste-dispenser':def(0,2200,'impassable',{steel:125,component:3}),
  hopper:def(0,300,'pass-through',{steel:15}),
  'orbital-beacon': def(0,800,'pass-through',{steel:40,component:1}),
  'comms-console': def(0,2200,'pass-through',{steel:120,component:4}),
  'deep-drill': def(0, 10000, 'pass-through', {steel:100,component:2}),
  'ground-scanner': def(0, 12000, 'pass-through', {steel:150,component:4,'advanced-component':1}),
  'vitals-monitor': def(0, 6000, 'pass-through', {steel:50,component:3}),
  'hydroponics-basin': def(0, 2800, 'pass-through', {steel:100,component:1}),
  'mini-turret': def(0, 1800, 'pass-through', {steel:100,component:3}),
  'tube-television': def(0, 10000, 'pass-through', {steel:80,component:4}),
  sandbags: def(5, 180, 'pass-through'),
  'drug-lab': def(50, 3500, 'pass-through', {steel:75,component:6}),
  'art-bench': def(75, 2500, 'pass-through', {steel:50}),
  'small-sculpture': def(50, 18000, 'pass-through', {}, true),
  'large-sculpture': def(100, 30000, 'pass-through', {}, true),
  'machining-table': def(0, 3000, 'pass-through', {steel:150,component:5}),
  'fabrication-bench': def(0, 5000, 'pass-through', {steel:200,component:12,'advanced-component':2}),
  'hi-tech-research-bench': def(0, 5000, 'pass-through', {steel:250,component:10}),
  'multi-analyzer': def(0, 10000, 'pass-through', {steel:40,plasteel:50,gold:20,component:8}),
  grave: def(0, 800, 'standable'),
  heater: def(0, 1000, 'pass-through', {steel:50,component:1}),
  'wind-turbine': def(0, 3300, 'pass-through', {steel:100,component:2}),
  'power-conduit': def(0, 35, 'standable', {steel:1}),
  'power-switch': def(0, 200, 'standable', {steel:15,component:1}),
  battery: def(0, 800, 'pass-through', {steel:70,component:2}),
  'solar-generator': def(0, 2500, 'pass-through', {steel:100,component:3}),
  'fueled-stove': def(0, 2000, 'pass-through', {steel:80}),
  'electric-stove': def(0, 2000, 'pass-through', {steel:80,component:2}),
  'butcher-table': def(75, 2000, 'pass-through', {wood:20}),
  'butcher-spot': def(0, 0, 'standable'),
  cooler: def(0, 1600, 'impassable', {steel:90,component:3}),
  'research-bench': def(75, 2800, 'pass-through', {steel:25}),
  'tailor-bench': def(75, 2000, 'pass-through'),
  'electric-tailor-bench': def(75, 2500, 'pass-through', {steel:50,component:2}),
  'crafting-spot': def(0, 0, 'standable'),
  'wood-generator': def(0, 2500, 'pass-through', {steel:100,component:2}),
  'torch-lamp': def(0, 100, 'pass-through', {wood:20}),
  'standing-lamp': def(0, 300, 'pass-through', {steel:20}),
  'sun-lamp': def(0, 330, 'pass-through', {steel:40}),
  'passive-cooler': def(0, 200, 'pass-through', {wood:50}),
  door: def(25, 850, 'standable'),
  autodoor: def(25, 1100, 'standable', {steel:40,component:2}),
  fence: def(1,70,'standable'),
  'fence-gate': def(25,500,'standable'),
  'pen-marker': def(30,600,'standable'),
  wall: def(5, 135, 'impassable'),
  bed: def(45, 800, 'pass-through', {}, true),
  'hospital-bed': def(40, 2800, 'pass-through', {steel:80,component:5}, true),
  table: def(28, 750, 'pass-through', {}, true),
  'table-square': def(50, 1500, 'pass-through', {}, true),
  'table-long': def(95, 3000, 'pass-through', {}, true),
  stool: def(25, 450, 'standable', {}, true),
  'dining-chair': def(45, 8000, 'standable', {}, true),
  armchair: def(110, 14000, 'standable', {}, true),
  'end-table': def(30, 1000, 'pass-through', {}, true),
  dresser: def(50, 2000, 'pass-through', {}, true),
  'flower-pot': def(20, 250, 'pass-through', {}, true),
  campfire: def(0, 200, 'pass-through', {wood:20}),
  horseshoes: def(10, 100, 'standable'),
  'chess-table': def(70, 8000, 'pass-through', {}, true),
  // Schema 354 joy buildings, Buildings_Joy.xml.
  'hoopstone-ring': def(20, 100, 'standable'),
  'billiards-table': def(80, 12000, 'pass-through', {wood:30,cloth:80}, true),
  'game-of-ur-board': def(35, 6000, 'pass-through', {}, true),
  'poker-table': def(50, 10000, 'pass-through', {wood:25,cloth:50}, true),
  stonecutter: def(75, 2000, 'pass-through', {steel:30}),
});

const QUALITY_FACTOR = Object.freeze({
  awful: .5, poor: .75, normal: 1, good: 1.25,
  excellent: 1.5, masterwork: 2.5, legendary: 5,
} as const);
const QUALITY_MAX_GAIN = Object.freeze({
  awful: Infinity, poor: Infinity, normal: Infinity, good: 500,
  excellent: 1000, masterwork: 2000, legendary: 3000,
} as const);

function coreDef(kind: StructureKind): BuildingValueDef {
  const result = BUILDINGS[kind];
  if (!result) throw new RangeError(`Unmapped room building value: ${kind}`);
  return result;
}

export function structureRoomStandable(kind: StructureKind): boolean {
  return coreDef(kind).passability === 'standable';
}

export function structureRoomMarketValue(structure: Structure): number {
  const d = coreDef(structure.kind);
  const material = d.stuff && structure.material ? structure.material : undefined;
  const factors = material ? FURNITURE_MATERIALS[material] : undefined;
  if (material && !factors) throw new RangeError(`Unmapped building material: ${material}`);
  const stuffValue = d.stuff * (material ? MATERIAL_VALUE[material] : UNKNOWN_STUFF_VALUE);
  let fixedValue = d.wood * MATERIAL_VALUE.wood + d.steel * MATERIAL_VALUE.steel + d.plasteel * 9 + d.uranium * 6 + d.gold * 10 + d.component * 32 + d.advancedComponent * 200;
  if(d.aiCore)fixedValue+=d.aiCore*AI_CORE_CONTENT_298.baseMarketValue;
  if(d.cloth)fixedValue+=d.cloth*MATERIAL_VALUE.cloth;
  if(d.shells)fixedValue+=d.shells*SHELL_FACTS_357.marketValue;
  const work = isSculptureKind(structure.kind)&&isSculptureMaterial(material)
    ? sculptureWorkToMakeCore(structure.kind,material)
    : d.work * (factors?.workFactor ?? 1) + (factors?.workOffset ?? 0);
  let value = d.baseMarketValue ?? (stuffValue + fixedValue + (work > 2 ? work * VALUE_PER_WORK : 0));

  if (d.quality) {
    const quality = structure.quality ?? 'normal';
    if (!(quality in QUALITY_FACTOR)) throw new RangeError(`Unmapped building quality: ${quality}`);
    const q = quality as keyof typeof QUALITY_FACTOR;
    value += Math.min(value * (QUALITY_FACTOR[q] - 1), QUALITY_MAX_GAIN[q]);
  }

  const maxHp = structureMaxHp(structure);
  if (maxHp > 0) value *= tradeHealthFactor((maxHp - (structure.damage ?? 0)) / maxHp);
  // Core StatWorker.FinalizeValue rounds each object's MarketValue above 200.
  return value > 200 ? roundTradeSilver(value / 5) * 5 : value;
}

/** Terrain values are per cell, including the work of laying a floor. The
 * transformed stone has its explicit fixed value; other natural terrain and
 * fire-burned planks have no Core construction cost or market value. */
const FLOOR_VALUE: Readonly<Record<FloorKind, number>> = Object.freeze({
  'ancient-tile':0,'ancient-concrete':0,
  'broken-asphalt':0,
  'granite-flagstone':4*MATERIAL_VALUE['granite-blocks']+500*VALUE_PER_WORK,
  'limestone-flagstone':4*MATERIAL_VALUE['limestone-blocks']+500*VALUE_PER_WORK,
  'marble-flagstone':4*MATERIAL_VALUE['marble-blocks']+500*VALUE_PER_WORK,
  'sandstone-flagstone':4*MATERIAL_VALUE['sandstone-blocks']+500*VALUE_PER_WORK,
  'slate-flagstone':4*MATERIAL_VALUE['slate-blocks']+500*VALUE_PER_WORK,
  'wood-planks': 3 * MATERIAL_VALUE.wood + 85 * VALUE_PER_WORK,
  'granite-tile': 4 * MATERIAL_VALUE['granite-blocks'] + 1100 * VALUE_PER_WORK,
  'limestone-tile': 4 * MATERIAL_VALUE['limestone-blocks'] + 1100 * VALUE_PER_WORK,
  'marble-tile': 4 * MATERIAL_VALUE['marble-blocks'] + 1100 * VALUE_PER_WORK,
  'sandstone-tile': 4 * MATERIAL_VALUE['sandstone-blocks'] + 1100 * VALUE_PER_WORK,
  'slate-tile': 4 * MATERIAL_VALUE['slate-blocks'] + 1100 * VALUE_PER_WORK,
  'steel-tile': 7 * MATERIAL_VALUE.steel + 800 * VALUE_PER_WORK,
  'sterile-tile': 3 * MATERIAL_VALUE.steel + 12 + 1600 * VALUE_PER_WORK,
  'burned-wood': 0,
  // Schema 355 carpets: 7 cloth + WorkToBuild 800; the burned carpet has no value.
  ...Object.fromEntries(CARPET_FLOORS_355.map(id=>[id,7*MATERIAL_VALUE.cloth+800*VALUE_PER_WORK])) as Record<CarpetFloor355,number>,
  'burned-carpet': 0,
});
export function floorRoomMarketValue(tile: Tile): number {
  if(tile.bridge)return 12*MATERIAL_VALUE.wood+1500*VALUE_PER_WORK;
  if (tile.floor === undefined) return hasSmoothedStoneSubstrate281(tile)?SMOOTHED_STONE_FACTS_281.marketValue:0;
  const value = FLOOR_VALUE[tile.floor];
  if (value === undefined) throw new RangeError(`Unmapped room floor value: ${tile.floor}`);
  return value;
}

/** All currently shipped plants lack a Core market value; rock is not in the
 * Building/Plant categories counted by RoomStatWorker_Wealth. Daylily in a
 * flower pot likewise adds beauty but zero value beyond the pot. */
const RESOURCE_VALUE: Readonly<Record<ResourceKind, 0>> = Object.freeze({
  'wild-plant': 0, potato: 0, corn: 0, tree: 0, berries: 0,
  rock: 0, rice: 0, cotton: 0, healroot: 0, haygrass: 0, hops:0, devilstrand:0,
});
export function resourceRoomMarketValue(resource: Resource): number {
  const value = RESOURCE_VALUE[resource.kind];
  if (value === undefined) throw new RangeError(`Unmapped room resource value: ${resource.kind}`);
  return value;
}
