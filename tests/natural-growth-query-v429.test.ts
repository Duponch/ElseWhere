import {afterEach,expect,test,vi} from 'vitest';
import * as environment from '../src/sim/environment';
import * as terrain from '../src/sim/natural-terrain-runtime-256';
import * as substrate from '../src/sim/plant-substrate-256';
import {createWorld} from '../src/sim/engine';
import {createPlantGrowthReader,createPlantGrowthForecastReader,plantGrowth,harvestable} from '../src/sim/plants';
import {floraSize} from '../src/render/flora-presentation';
import {CLIMATE_DEFINITIONS,TICKS_PER_YEAR} from '../src/sim/site-climate';
import type {World,Resource,Tile} from '../src/sim/types';

afterEach(()=>vi.restoreAllMocks());

// Numerical query fixtures. No clock jump below claims a played continuation
// or a strict saved colony. Public literal plantGrowth remains the oracle.
function fixture(revision:0|1|2|4=4):World {
  const world=createWorld(429,16,16);world.tick=1500;world.tiles=world.tiles.map(()=>({terrain:'soil-natural'}));world.resources=[];
  const rows:ReadonlyArray<readonly [Resource['kind'],Resource['species']]>=[
    ['tree','oak'],['berries','berry-bush'],['wild-plant','grass'],['tree','cypress'],
    ['wild-plant','agave'],['wild-plant','glowstool'],['wild-plant','agarilux'],['wild-plant','bryolux'],
    ['healroot',undefined],['rice',undefined],['berries',undefined],['rock',undefined],
  ];
  for(const [i,[kind,species]]of rows.entries())world.resources.push({id:world.nextId++,kind,...(species?{species}:{}),x:1+i,z:2,amount:10,growth:i===3?1:.17+i%4*.13,...(i%5?{growthTick:i%2?0:1200}:{}),growthThermalFactor:i%4?1:0});
  world.resources[2]!.growthLight='dark';world.resources[4]!.growthLight='artificial-full';world.resources[5]!.growthLight='dark';world.resources[6]!.growthLight='artificial-full';
  world.resources[8]!.blight={since:0,severity:.1,lastHarmTick:0,nextCheck:1600,rng:123};
  world.roofing={constructed:[34],build:[],remove:[],cursor:0,natural:{thin:[38],thick:[39]}};
  const common={adoptedAt:0,calendarOrigin:1500};
  if(revision===0)delete world.climate;
  else world.climate=revision===1?{...common,revision,profile:'temperate-reference'}:revision===2?{...common,revision,definition:{...CLIMATE_DEFINITIONS['temperate-reference']}}:
    {...common,revision,tileId:0,irregular262:true,definition:{...CLIMATE_DEFINITIONS['temperate-reference'],amplitude:18.0703125}};
  return world;
}
function exact(world:World,ticks:readonly number[]):void {
  const before=structuredClone(world),query=createPlantGrowthForecastReader(world),current=createPlantGrowthReader(world),shadows=new Map<number,World>();
  for(const tick of ticks){
    let shadow=shadows.get(tick);if(!shadow){shadow={...world,tick};shadows.set(tick,shadow);}
    // Alternate population order while moving the numerical probe forwards
    // and backwards: neither an old plant nor an old tick may own the result.
    for(const resource of tick%2?world.resources:[...world.resources].reverse()){
      const expected=plantGrowth(shadow,resource),actual=query(resource,tick);
      expect(Object.is(actual,expected),`growth ID${resource.id} at${tick}`).toBe(true);
      expect(Object.is(floraSize(world,resource,()=>actual),floraSize(shadow,resource))).toBe(true);
      expect(harvestable(world,resource,()=>actual)).toBe(harvestable(shadow,resource));
    }
  }
  for(const resource of world.resources)expect(Object.is(current(resource),plantGrowth(world,resource))).toBe(true);
  expect(world).toStrictEqual(before);
}

test.each([0,1,2,4] as const)('forecast query equals literal public growth and observations on climate%s at exact varied ticks',revision=>{
  const world=fixture(revision);
  exact(world,[1500,1563,1501,1531,1500,1499,4799,4800,4801,5999,6000,6001,TICKS_PER_YEAR-1,TICKS_PER_YEAR,TICKS_PER_YEAR+1]);
});

test('fresh contexts preserve substrate, cave, old schema, missing anchor and thermal-factor rules',()=>{
  const world=fixture(),grounds:Tile[]=[{terrain:'soil-natural'},{terrain:'rich-soil'},{terrain:'gravel'},{terrain:'mud'},{terrain:'marsh'},
    {terrain:'ice'},{terrain:'packed-dirt'},{terrain:'rough-stone',stone:'granite'},{terrain:'rough-stone',stone:'marble'},
    {terrain:'soil-natural',floor:'wood-planks'},{terrain:'soil-natural',bridge:true}];
  for(const schema of [83,91,167,255,263])for(const tile of grounds){
    world.tiles=world.tiles.map(()=>({...tile}));
    // World types only the current SAVE schema263. This isolated historical
    // numerical query is never admitted or serialized as an authoritative SAVE.
    const historical={...world,schemaVersion:schema} as World;
    exact(historical,[1500,1501,1563,1500]);
  }
  Object.assign(world,{schemaVersion:264});
  for(const factor of [0,.125,.75,1]){for(const resource of world.resources)resource.growthThermalFactor=factor;exact(world,[1500,1563,1501]);}
});

test('one forecast context preserves the literal eclipse integral at start, transition, end and later times',()=>{
  const world=fixture();world.miscIncidents={profile:'cassandra-misc-v1',adoptedAt:0,rng:123,nextCheck:1600,introDone:true,checks:1,opportunities:1,heatwaves:0,
    weather:{adoptedAt:0,coldSnaps:0,eclipses:1,lastEclipseStart:1500,eclipse:{start:1500,end:4500}}};
  exact(world,[1500,1501,1520,1563,4499,4500,4501,1501]);
  delete world.miscIncidents.weather!.eclipse;exact(world,[1500,1501,1563]);
});

test('forecast inputs share actual tick integrals and substrate without caching a plant result',()=>{
  const world=fixture();world.resources=world.resources.slice(0,2);
  for(const resource of world.resources){resource.growth=.2;resource.growthTick=1200;resource.growthThermalFactor=1;}
  world.roofing=undefined;
  const ticks=[1500,1563,1501,1563,1500],expected=ticks.map(tick=>world.resources.map(resource=>plantGrowth({...world,tick},resource)));
  const integral=vi.spyOn(environment,'annualGrowingLightIntegral'),substrate=vi.spyOn(terrain,'naturalPlantSubstrate256');
  const query=createPlantGrowthForecastReader(world);
  for(const [i,tick]of ticks.entries())for(const [j,resource]of world.resources.entries())expect(Object.is(query(resource,tick),expected[i]![j])).toBe(true);
  expect(integral.mock.calls).toHaveLength(4); // anchor1200 + queried1500/1501/1563
  expect(new Set(integral.mock.calls.map(([owner])=>owner)).size).toBe(1);
  expect(integral.mock.calls[0]![0]).not.toBe(world);expect(substrate).toHaveBeenCalledTimes(1);
});

test('one current pass alternates actual terrain, stone and surface keys without reusing another ground',()=>{
  const world=fixture();delete world.roofing;
  const grounds:Tile[]=[{terrain:'soil-natural'},{terrain:'rich-soil'},{terrain:'gravel'},
    {terrain:'rough-stone',stone:'granite'},{terrain:'rough-stone',stone:'marble'},
    {terrain:'soil-natural',floor:'wood-planks'},{terrain:'soil-natural',bridge:true}];
  for(const [i,plant]of world.resources.entries()){
    world.tiles[plant.z*world.width+plant.x]={...grounds[i%grounds.length]!};
    plant.growth=.2;plant.growthTick=1200;plant.growthThermalFactor=.875;delete plant.blight;delete plant.growthLight;
  }
  const before=structuredClone(world),query=createPlantGrowthReader(world),rng=world.rng;
  for(const index of [0,1,0,2,1,3,0,4,0,5,0,6,0,7,8,9,10,11,0,1,0]){
    const plant=world.resources[index]!;expect(Object.is(query(plant),plantGrowth(world,plant))).toBe(true);
  }
  expect(world).toStrictEqual(before);expect(world.rng).toBe(rng);
});

test('an allowed result of undefined stays memoized as a real result, rather than a miss',()=>{
  const world=fixture();delete world.roofing;
  const plant:Resource={id:world.nextId++,kind:'berries',x:2,z:3,amount:10,growth:.2,growthTick:1200};
  world.tiles[plant.z*world.width+plant.x]={terrain:'soil-natural'};
  const expected=plantGrowth(world,plant),allowed=vi.spyOn(substrate,'plantSubstrateAllowed256'),query=createPlantGrowthReader(world);
  for(let n=0;n<4;n++)expect(Object.is(query(plant),expected)).toBe(true);
  expect(allowed).toHaveBeenCalledTimes(1);expect(allowed.mock.results[0]!.value).toBeUndefined();
});

test.each(['terrain','stone','bridge','floor'] as const)('a recent ground still reads live %s and preserves its error and retry',key=>{
  const world=fixture();delete world.roofing;const plant=world.resources[0]!;
  plant.growth=.2;plant.growthTick=1200;delete plant.blight;delete plant.growthLight;
  const tile=world.tiles[plant.z*world.width+plant.x]!,query=createPlantGrowthReader(world),rng=world.rng;
  const expected=plantGrowth(world,plant);expect(Object.is(query(plant),expected)).toBe(true);expect(Object.is(query(plant),expected)).toBe(true);
  const prior=Object.getOwnPropertyDescriptor(tile,key),message='actual ground '+key;
  Object.defineProperty(tile,key,{enumerable:true,configurable:true,get(){throw Error(message);}});
  try{expect(()=>query(plant)).toThrow(message);}
  finally{if(prior)Object.defineProperty(tile,key,prior);else Reflect.deleteProperty(tile,key);}
  expect(Object.is(query(plant),expected)).toBe(true);expect(world.rng).toBe(rng);
});

test('a missing current tile still throws after a recent hit and the restored input retries',()=>{
  const world=fixture();delete world.roofing;const plant=world.resources[0]!;
  plant.growth=.2;plant.growthTick=1200;delete plant.blight;delete plant.growthLight;
  const index=plant.z*world.width+plant.x,tile=world.tiles[index]!,query=createPlantGrowthReader(world),expected=plantGrowth(world,plant);
  expect(Object.is(query(plant),expected)).toBe(true);Reflect.deleteProperty(world.tiles,String(index));
  try{expect(()=>query(plant)).toThrow(TypeError);}finally{world.tiles[index]=tile;}
  expect(Object.is(query(plant),expected)).toBe(true);
});

// A mature plant is capped at 1 whatever its light: readPlantGrowth returns
// before any roof read (exact shortcut), while a growing plant still reads.
test('a mature current plant returns 1 without a roof read; a growing plant still reads roofs',()=>{
  const world=fixture(),plant=world.resources[0]!;plant.growth=1;delete plant.blight;delete plant.growthLight;
  const query=createPlantGrowthReader(world);
  Object.defineProperty(world,'roofing',{enumerable:true,configurable:true,get(){throw Error('actual roof read');}});
  expect(query(plant)).toBe(1);expect(plantGrowth(world,plant)).toBe(1);
  plant.growth=.5;expect(()=>query(plant)).toThrow('actual roof read');expect(()=>plantGrowth(world,plant)).toThrow('actual roof read');
});
