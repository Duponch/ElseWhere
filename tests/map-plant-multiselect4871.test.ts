import {describe,expect,it} from 'vitest';
import {createWorld} from '../src/sim/index';
import {FLORA_DEFINITIONS,type PlantSpecies} from '../src/sim/biome-flora';
import type {Resource,World} from '../src/sim/types';
import {mapObjectsAt,mapObjectExists,mapResourceSelectable,nextMapObject,type MapObjectSelection} from '../src/ui/map-object-selection';
import {matchingMapObjects,mapObjectGroupTarget,MAX_MAP_OBJECT_SELECTION} from '../src/ui/map-object-group-selection';
import {resourceNeverMultiSelect4871} from '../src/ui/map-plant-multiselect-facts';

// UI-only source fragments; no Engine, command, step, save or admitted Whole.
function fixture(){const world=createWorld(6111202,32,32);world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.structures=[];world.piles=[];world.packed=[];world.jobs=[];world.growingZones=[];world.stockpiles=[];return world;}
function plant(world:World,species:PlantSpecies,x:number,z:number):Resource{const def=FLORA_DEFINITIONS[species];return{id:world.nextId++,kind:def.kind,species,x,z,amount:def.yield,growth:1,growthTick:0};}
const target=(resource:Resource):MapObjectSelection=>({kind:'resource',id:resource.id});

describe('confirmed plant neverMultiSelect flags do not alter ordinary clicks',()=>{
  it('keeps the nineteen concrete species and seven cultivated kinds individually selectable but never double-click matched',()=>{
    const world=fixture();
    for(const species of ['bush','oak','poplar','pine','birch','saguaro','drago','bamboo','cecropia','cypress','maple','palm','teak','willow','alocasia','clivia','rafflesia','pincushion-cactus','bryolux'] as const){
      const a=plant(world,species,4,4),b=plant(world,species,5,4);world.resources=[a,b];const before=JSON.stringify(world);
      expect(mapResourceSelectable(a)).toBe(true);expect(mapObjectsAt(world,a)).toContainEqual(target(a));expect(mapObjectExists(world,target(a))).toBe(true);
      expect(nextMapObject(world,a,undefined)).toEqual(target(a));expect(resourceNeverMultiSelect4871(a)).toBe(true);
      expect(matchingMapObjects(world,target(a),()=>true)).toEqual([]);expect(mapObjectGroupTarget(world,mapObjectsAt(world,a))).toBeUndefined();
      expect(JSON.stringify(world)).toBe(before);
    }
    for(const kind of ['rice','potato','corn','cotton','healroot','haygrass','hops'] as const){
      const a:Resource={id:world.nextId++,kind,x:4,z:4,amount:10},b={...a,id:world.nextId++,x:5};world.resources=[a,b];const before=JSON.stringify(world);
      expect(mapResourceSelectable(a)).toBe(true);expect(mapObjectsAt(world,a)).toContainEqual(target(a));expect(resourceNeverMultiSelect4871(a)).toBe(true);
      expect(matchingMapObjects(world,target(a),()=>true)).toEqual([]);expect(JSON.stringify(world)).toBe(before);
    }
  });

  it('retains five concrete forage/fungus exceptions and the existing eight singleselect exclusions without changing grouping by definition',()=>{
    for(const species of ['berry-bush','agave','healroot-wild','glowstool','agarilux'] as const){
      const world=fixture(),a=plant(world,species,4,4),b=plant(world,species,5,4),other=plant(world,species==='agave'?'berry-bush':'agave',6,4);world.resources=[a,b,other];const before=JSON.stringify(world);
      expect(resourceNeverMultiSelect4871(a)).toBe(false);expect(mapObjectGroupTarget(world,mapObjectsAt(world,a))).toEqual(target(a));
      expect(matchingMapObjects(world,target(a),()=>true)).toEqual([target(a),target(b)]);expect(JSON.stringify(world)).toBe(before);
    }
    for(const species of ['grass','tall-grass','brambles','moss','astragalus','chokevine','dandelion','low-shrub'] as const){
      const world=fixture(),a=plant(world,species,4,4);world.resources=[a];expect(mapResourceSelectable(a)).toBe(false);expect(mapObjectsAt(world,a)).toEqual([]);expect(matchingMapObjects(world,target(a),()=>true)).toEqual([]);
    }
  });

  it('chooses an eligible stack under a never-multi plant while ordinary overlapping-object cycling remains exact',()=>{
    const world=fixture(),bush=plant(world,'bush',4,4);world.resources=[bush];
    world.piles=[{id:world.nextId++,kind:'steel',item:'steel',quantity:48,owner:{type:'ground',x:4,z:4}},{id:world.nextId++,kind:'steel',item:'steel',quantity:3,owner:{type:'ground',x:5,z:4}}];
    const before=JSON.stringify(world),pile={kind:'pile' as const,id:world.piles[0]!.id},hits=mapObjectsAt(world,bush);
    expect(hits).toEqual([pile,target(bush)]);expect(nextMapObject(world,bush,pile)).toEqual(target(bush));expect(nextMapObject(world,bush,target(bush))).toEqual(pile);
    expect(mapObjectGroupTarget(world,hits)).toEqual(pile);
    // Ordered-under-mouse contract: a non-multi first Thing cannot suppress
    // the next eligible stack. This list is a pure adapter input, not a claim
    // that the actual cell adapter reverses its physical pile-first order.
    expect(mapObjectGroupTarget(world,[target(bush),pile])).toEqual(pile);
    expect(matchingMapObjects(world,pile,()=>true)).toEqual([pile,{kind:'pile',id:world.piles[1]!.id}]);expect(JSON.stringify(world)).toBe(before);
  });

  it('keeps the200 cap and viewport test on eligible Berry, preserves rocks and derives the historical tree policy without inventing a species',()=>{
    const world=fixture();world.resources=Array.from({length:220},(_,i)=>plant(world,'berry-bush',i%32,Math.floor(i/32)));
    const before=JSON.stringify(world),clicked=world.resources.at(-1)!,all=matchingMapObjects(world,target(clicked),()=>true);
    expect(all).toHaveLength(MAX_MAP_OBJECT_SELECTION);expect(all[0]).toEqual(target(clicked));expect(new Set(all.map(value=>value.id)).size).toBe(MAX_MAP_OBJECT_SELECTION);
    const visible=matchingMapObjects(world,target(world.resources[0]!),cell=>cell.x<8);expect(visible.every(value=>world.resources.find(resource=>resource.id===value.id)!.x<8)).toBe(true);
    expect(visible).toContainEqual(target(world.resources[32*5]!));expect(JSON.stringify(world)).toBe(before);
    const rock:Resource={id:world.nextId++,kind:'rock',x:20,z:20,amount:1,stone:'granite'};world.resources=[rock,{...rock,id:world.nextId++,x:21}];
    expect(resourceNeverMultiSelect4871(rock)).toBe(false);expect(matchingMapObjects(world,target(rock),()=>true)).toHaveLength(2);
    const historical:Resource={id:world.nextId++,kind:'tree',x:8,z:8,amount:10};world.resources=[historical];const historicalBefore=JSON.stringify(world);
    expect(resourceNeverMultiSelect4871(historical)).toBe(true);expect(mapResourceSelectable(historical)).toBe(true);expect(mapObjectsAt(world,historical)).toContainEqual(target(historical));
    expect(matchingMapObjects(world,target(historical),()=>true)).toEqual([]);expect(JSON.stringify(world)).toBe(historicalBefore);expect(historical.species).toBeUndefined();
    expect(resourceNeverMultiSelect4871({kind:'wild-plant'})).toBe(false);
    expect(resourceNeverMultiSelect4871({kind:'berries'})).toBe(false);
    expect(resourceNeverMultiSelect4871({kind:'healroot'})).toBe(true);expect(resourceNeverMultiSelect4871({kind:'wild-plant',species:'healroot-wild'})).toBe(false);
  });
});
