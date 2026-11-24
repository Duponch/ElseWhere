import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {GrowingZone,StockpileCell,World} from '../src/sim/types';
import {mapObjectGroupTarget,matchingMapObjects,mergeMapObjectGroups,MAX_MAP_OBJECT_SELECTION} from '../src/ui/map-object-group-selection';
import {mapObjectCells,mapObjectsAt,type MapObjectSelection} from '../src/ui/map-object-selection';

/** Prepared UI-reader fixture; no simulation transition or save is modified. */
function bare():World {
  const w=createWorld(241118,16,16);
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));
  w.resources=[];w.structures=[];w.piles=[];w.packed=[];w.jobs=[];w.growingZones=[];w.stockpiles=[];
  delete w.geysers;delete w.plans369;
  return w;
}
const growing=(id:number,cells:number[],extra:Partial<GrowingZone>={}):GrowingZone=>({id,cells,plant:'rice',allowSow:true,allowCut:true,...extra});
const storage=(id:number,zoneId:number,x:number,z:number):StockpileCell=>({id,zoneId,x,z,filters:{wood:true,food:false},priority:3,capacity:75});
const zone=(id:number):MapObjectSelection=>({kind:'growing',id});
const all=()=>true;

test('double-click matches Zone_Growing class despite crops, sow/cut settings and distance',()=>{
  const w=bare(),target=zone(91);
  w.growingZones=[growing(20,[3,4],{plant:'cotton',allowSow:false,allowCut:false}),growing(91,[238,239]),growing(30,[34],{plant:'corn'})];
  w.stockpiles=[storage(71,70,6,6)];
  const before=structuredClone(w),under=mapObjectsAt(w,{x:14,z:14});
  expect(mapObjectGroupTarget(w,under)).toEqual(target);
  expect(matchingMapObjects(w,target,all)).toEqual([target,zone(20),zone(30)]);
  expect(matchingMapObjects(w,target,all)[0]).toBe(target);
  expect(w).toEqual(before);
});

test('one occupied known cell in the camera admits a zone once, and off-screen zones stay out',()=>{
  const w=bare();w.growingZones=[growing(1,[17,18]),growing(2,[20,21,22]),growing(3,[31]),growing(4,[33])];
  expect(matchingMapObjects(w,zone(1),cell=>cell.z===1&&cell.x<=5)).toEqual([zone(1),zone(2)]);
  expect(matchingMapObjects(w,zone(1),()=>false)).toEqual([]);
});

test('fog and screen tests must pass on the same cell, without exposing unknown zones',()=>{
  const w=bare();
  w.site={revision:3,tileId:0,mapSeed:w.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};
  w.exploration={revision:1};w.tiles=w.tiles.map(()=>({terrain:'soil-natural',fogged:true}));
  delete w.tiles[17]!.fogged;delete w.tiles[18]!.fogged;delete w.tiles[34]!.fogged;
  w.growingZones=[growing(1,[17]),growing(2,[18,19]),growing(3,[20]),growing(4,[21,34])];
  expect(matchingMapObjects(w,zone(1),cell=>cell.z===1)).toEqual([zone(1),zone(2)]);
  expect(mapObjectGroupTarget(w,[zone(3)])).toBeUndefined();
  expect(matchingMapObjects(w,zone(3),all)).toEqual([]);
});

test('eligible Things precede zones even if the input starts with a zone; neverMultiSelect Things allow zone fallback',()=>{
  const w=bare();w.growingZones=[growing(1,[17])];
  w.piles=[{id:2,kind:'wood',item:'wood',quantity:3,owner:{type:'ground',x:1,z:1}}];
  expect(mapObjectGroupTarget(w,[zone(1),{kind:'pile',id:2}])).toEqual({kind:'pile',id:2});
  w.tiles[17]={terrain:'rock',stone:'granite'};
  w.structures=[{id:3,kind:'wall',x:1,z:1,orientation:0,footprint:'standard'}];
  w.resources=[{id:4,kind:'tree',species:'oak',x:1,z:1,amount:10}];
  expect(mapObjectGroupTarget(w,[{kind:'rock',id:17},{kind:'structure',id:3},{kind:'resource',id:4},zone(1)])).toEqual(zone(1));
});

test('Core stockpiles inherit Zone.IsMultiselectable false; plans have no double-click branch',()=>{
  const w=bare();w.stockpiles=[storage(71,70,1,1),storage(72,70,2,1),storage(81,80,4,1)];
  w.plans369={nextId:91,plans:[{id:90,n:1,color:'gray',cells:[33]}]};
  for(const target of [{kind:'stockpile',id:71},{kind:'stockpile',id:72},{kind:'plan',id:90}] as MapObjectSelection[]) {
    expect(mapObjectCells(w,target).length).toBeGreaterThan(0);
    expect(mapObjectGroupTarget(w,[target])).toBeUndefined();
    expect(matchingMapObjects(w,target,all)).toEqual([]);
  }
});

test('hydroponic sowing policies represent buildings, not extra Zone_Growing candidates',()=>{
  const w=bare();w.growingZones=[growing(1,[17]),growing(2,[19],{basinId:8})];
  expect(matchingMapObjects(w,zone(1),all)).toEqual([zone(1)]);
  expect(mapObjectGroupTarget(w,[zone(2)])).toBeUndefined();
  expect(matchingMapObjects(w,zone(2),all)).toEqual([]);
});

test('stale IDs, empty zones and out-of-bounds cells cannot form a group',()=>{
  const w=bare();w.growingZones=[growing(1,[]),growing(2,[-1,9999]),growing(3,[17])];
  for(const id of [1,2,999]) {
    expect(mapObjectGroupTarget(w,[zone(id)])).toBeUndefined();
    expect(matchingMapObjects(w,zone(id),all)).toEqual([]);
  }
});

test('the clicked zone survives the 200 cap; remaining zones follow first visible z/x cell order',()=>{
  const w=bare();w.growingZones=Array.from({length:220},(_,i)=>growing(1000+i,[i]));
  const selected=matchingMapObjects(w,zone(1219),all);
  expect(selected).toHaveLength(MAX_MAP_OBJECT_SELECTION);
  expect(selected[0]).toEqual(zone(1219));expect(selected[1]).toEqual(zone(1000));
  expect(selected.at(-1)).toEqual(zone(1198));expect(new Set(selected.map(s=>s.id)).size).toBe(200);
});

test('Shift adds zones without toggling existing selections; replacement discards previous zones',()=>{
  const w=bare(),current=[zone(5)],incoming=[zone(5),zone(7)],before=structuredClone({current,incoming});
  expect(mergeMapObjectGroups(w,current,incoming,true)).toEqual([zone(5),zone(7)]);
  expect(mergeMapObjectGroups(w,current,[zone(7)],false)).toEqual([zone(7)]);
  expect({current,incoming}).toEqual(before);
  expect(mergeMapObjectGroups(w,current,incoming,true)[0]).toBe(current[0]);
});

test('Shift entering zone, Thing or plan selection clears the previous family before applying the cap',()=>{
  const w=bare(),thing:MapObjectSelection={kind:'pile',id:8},plan:MapObjectSelection={kind:'plan',id:9};
  expect(mergeMapObjectGroups(w,[thing],[zone(5)],true)).toEqual([zone(5)]);
  expect(mergeMapObjectGroups(w,[zone(5)],[thing],true)).toEqual([thing]);
  expect(mergeMapObjectGroups(w,[zone(5)],[plan],true)).toEqual([plan]);
  expect(mergeMapObjectGroups(w,[plan],[zone(5)],true)).toEqual([zone(5)]);
  const full=Array.from({length:200},(_,i)=>zone(1000+i));
  expect(mergeMapObjectGroups(w,full,[zone(3000)],true)).toEqual(full);
  expect(mergeMapObjectGroups(w,full,[thing],true)).toEqual([thing]);
});

test('this zone change preserves the earlier Thing/Plan merging in both directions and multiple plans',()=>{
  const w=bare(),thing:MapObjectSelection={kind:'pile',id:8},plan:MapObjectSelection={kind:'plan',id:9},otherPlan:MapObjectSelection={kind:'plan',id:10};
  expect(mergeMapObjectGroups(w,[thing],[plan],true)).toEqual([thing,plan]);
  expect(mergeMapObjectGroups(w,[plan],[thing],true)).toEqual([plan,thing]);
  expect(mergeMapObjectGroups(w,[plan],[otherPlan],true)).toEqual([plan,otherPlan]);
});

test('storage logical identity never replaces the exact physical selection ID; legacy owners stay separate',()=>{
  const w=bare();w.stockpiles=[storage(71,70,1,1),storage(72,70,2,1),storage(81,80,4,1),{...storage(91,90,5,1),zoneId:undefined}];
  const exact:MapObjectSelection={kind:'stockpile',id:72};
  const before=structuredClone(w);
  expect(mergeMapObjectGroups(w,[exact],[{kind:'stockpile',id:71},{kind:'stockpile',id:81},zone(7),{kind:'stockpile',id:91}],true)).toEqual([exact,{kind:'stockpile',id:81},zone(7),{kind:'stockpile',id:91}]);
  expect(mergeMapObjectGroups(w,[exact],[{kind:'stockpile',id:71}],true)[0]).toBe(exact);
  expect(w).toEqual(before);
});
