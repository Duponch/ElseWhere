import { expect, test, vi } from 'vitest';
import { createWorld } from '../src/sim/engine';
import type { Job, Structure, World } from '../src/sim/types';
import { MAX_MAP_OBJECT_SELECTION, mapObjectGroupCells, matchingMapObjects } from '../src/ui/map-object-group-selection';

function emptyWorld():World {
  const world=createWorld(303,16,16);
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));
  world.resources=[];world.structures=[];world.piles=[];world.packed=[];world.jobs=[];world.growingZones=[];world.stockpiles=[];
  return world;
}
const structure=(id:number,kind:Structure['kind'],x:number,z:number):Structure=>({id,kind,x,z,orientation:0,footprint:'standard'});
const job=(id:number,kind:Job['kind'],x:number,z:number):Job=>({id,kind,x,z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
const onScreen=()=>true;

test('installed and ground minified inner definitions match despite stuff, quality and rotation',()=>{
  const world=emptyWorld(),target=structure(1,'dining-chair',8,8);
  target.material='wood';target.quality='poor';
  world.structures=[target,{...structure(2,'dining-chair',1,1),material:'steel',quality:'excellent',orientation:2,damage:9},structure(3,'stool',2,2)];
  world.packed=[{building:{...structure(4,'dining-chair',0,0),quality:'masterwork'},owner:{type:'ground',x:3,z:3}},
    {building:structure(5,'dining-chair',0,0),owner:{type:'pawn',pawnId:99}},
    {building:structure(6,'dining-chair',0,0),owner:{type:'inventory',pawnId:99}}];
  const before=JSON.stringify(world);
  expect(matchingMapObjects(world,{kind:'structure',id:1},onScreen)).toEqual([{kind:'structure',id:1},{kind:'structure',id:2},{kind:'packed',id:4}]);
  expect(matchingMapObjects(world,{kind:'packed',id:4},onScreen)).toEqual([{kind:'packed',id:4},{kind:'structure',id:2},{kind:'structure',id:1}]);
  expect(JSON.stringify(world)).toBe(before);
});

test('textile apparel shares its ThingDef across materials and ignores condition',()=>{
  const world=emptyWorld();
  world.piles=[
    {id:1,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'ground',x:8,z:8},apparel:{quality:'poor',hitPoints:10}},
    {id:2,kind:'apparel',item:'bluefur-shirt',quantity:1,owner:{type:'ground',x:1,z:1},apparel:{quality:'excellent',hitPoints:100,material:'bluefur'}},
    {id:3,kind:'apparel',item:'cloth-pants',quantity:1,owner:{type:'ground',x:2,z:2}},
    {id:4,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'apparel',pawnId:99}},
    {id:5,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'orbital-cargo',deliveryId:99}},
  ];
  expect(matchingMapObjects(world,{kind:'pile',id:1},onScreen)).toEqual([{kind:'pile',id:1},{kind:'pile',id:2}]);
  expect(matchingMapObjects(world,{kind:'pile',id:4},onScreen)).toEqual([]);
});

test('raw items and food variants stay distinct; contents owned outside the ground are excluded',()=>{
  const world=emptyWorld();
  world.piles=[
    {id:1,kind:'food',item:'simple-meal',quantity:1,owner:{type:'ground',x:1,z:1}},
    {id:2,kind:'food',item:'simple-meal',quantity:10,owner:{type:'ground',x:3,z:1}},
    {id:3,kind:'food',item:'fine-meal',quantity:1,owner:{type:'ground',x:2,z:1}},
    {id:4,kind:'food',item:'simple-meal',quantity:1,owner:{type:'job',jobId:99}},
    {id:5,kind:'food',item:'simple-meal',quantity:1,owner:{type:'orbital-ship',shipId:99}},
    {id:6,kind:'food',item:'simple-meal',quantity:1,owner:{type:'inventory',pawnId:99}},
  ];
  expect(matchingMapObjects(world,{kind:'pile',id:1},onScreen)).toEqual([{kind:'pile',id:1},{kind:'pile',id:2}]);
  world.piles=[{id:7,kind:'blocks',item:'granite-blocks',quantity:4,owner:{type:'ground',x:1,z:1}},
    {id:8,kind:'blocks',item:'marble-blocks',quantity:4,owner:{type:'ground',x:2,z:1}}];
  expect(matchingMapObjects(world,{kind:'pile',id:7},onScreen)).toEqual([{kind:'pile',id:7}]);
});

test('concrete plants and historical TreeBase policy respect neverMultiSelect without invented species',()=>{
  const world=emptyWorld();
  world.resources=[
    {id:1,kind:'tree',species:'oak',x:1,z:1,amount:20,growth:.5},
    {id:2,kind:'tree',species:'oak',x:3,z:3,amount:30,growth:1,damage:50},
    {id:3,kind:'tree',species:'pine',x:2,z:2,amount:20},
    {id:4,kind:'tree',x:4,z:4,amount:20},
    {id:5,kind:'rice',x:5,z:5,amount:20,growth:.2},
    {id:6,kind:'rice',x:6,z:6,amount:20,growth:.9},
  ];
  expect(matchingMapObjects(world,{kind:'resource',id:1},onScreen)).toEqual([]);
  expect(matchingMapObjects(world,{kind:'resource',id:5},onScreen)).toEqual([]);
  expect(matchingMapObjects(world,{kind:'resource',id:4},onScreen)).toEqual([]);
});

test('mineable ore definitions override surrounding geology while bare stones and loose resources stay distinct',()=>{
  const world=emptyWorld();
  world.tiles[17]={terrain:'rock',ore:'steel',stone:'granite'};
  world.tiles[18]={terrain:'rock',ore:'steel',stone:'marble',miningDamage:80};
  world.tiles[19]={terrain:'rock',ore:'gold',stone:'granite'};
  world.tiles[20]={terrain:'rock',stone:'granite'};
  world.tiles[21]={terrain:'rock',stone:'marble'};
  world.tiles[22]={terrain:'rock',stone:'granite'};
  world.tiles[23]={terrain:'rough-stone',stone:'granite'};
  world.resources=[{id:1,kind:'rock',stone:'granite',x:8,z:8,amount:1}];
  expect(matchingMapObjects(world,{kind:'rock',id:17},onScreen)).toEqual([{kind:'rock',id:17},{kind:'rock',id:18}]);
  expect(matchingMapObjects(world,{kind:'rock',id:20},onScreen)).toEqual([{kind:'rock',id:20},{kind:'rock',id:22}]);
});

test('construction blueprints, frames, installations and floor definitions form separate groups',()=>{
  const world=emptyWorld();
  world.jobs=[
    {...job(1,'wall',1,1),construction:'blueprint',material:'wood'},
    {...job(2,'wall',2,1),construction:'blueprint',material:'steel'},
    {...job(3,'wall',3,1),construction:'frame',material:'wood'},
    {...job(4,'install',4,1),furniture:{kind:'bed',structureId:99}},
    {...job(5,'install',5,1),furniture:{kind:'bed',structureId:100}},
    {...job(6,'install',6,1),furniture:{kind:'stool',structureId:101}},
    {...job(7,'lay-floor',7,1),construction:'blueprint',floor:'wood-planks'},
    {...job(8,'lay-floor',8,1),construction:'blueprint',floor:'sterile-tile'},
  ];
  world.structures=[structure(9,'wall',9,1)];
  expect(matchingMapObjects(world,{kind:'job',id:1},onScreen)).toEqual([{kind:'job',id:1},{kind:'job',id:2}]);
  expect(matchingMapObjects(world,{kind:'job',id:3},onScreen)).toEqual([{kind:'job',id:3}]);
  expect(matchingMapObjects(world,{kind:'job',id:4},onScreen)).toEqual([{kind:'job',id:4},{kind:'job',id:5}]);
  expect(matchingMapObjects(world,{kind:'job',id:7},onScreen)).toEqual([{kind:'job',id:7}]);
});

test('screen visibility rather than distance bounds selection, with clicked target retained at the 200 cap',()=>{
  const world=emptyWorld();
  world.resources=Array.from({length:220},(_,i)=>({id:1000+i,kind:'berries' as const,species:'berry-bush' as const,x:i%16,z:Math.floor(i/16),amount:10}));
  const all=matchingMapObjects(world,{kind:'resource',id:1219},onScreen);
  expect(all).toHaveLength(MAX_MAP_OBJECT_SELECTION);
  expect(all[0]).toEqual({kind:'resource',id:1219});
  expect(all[1]).toEqual({kind:'resource',id:1000});
  expect(new Set(all.map(object=>object.id)).size).toBe(MAX_MAP_OBJECT_SELECTION);
  const visible=matchingMapObjects(world,{kind:'resource',id:1000},cell=>cell.x<8);
  expect(visible.some(object=>object.id===1208)).toBe(true); // Far across the map, but visible.
  expect(visible.some(object=>object.id===1008)).toBe(false);
});

test('visible occupied cells admit partial multicell objects once; stale targets and zones do not expand',()=>{
  const world=emptyWorld();
  world.structures=[structure(1,'ground-scanner',4,4),structure(2,'ground-scanner',10,10)];
  expect(matchingMapObjects(world,{kind:'structure',id:1},cell=>cell.x===5&&cell.z===5)).toEqual([{kind:'structure',id:1}]);
  expect(matchingMapObjects(world,{kind:'structure',id:1},()=>false)).toEqual([]);
  expect(matchingMapObjects(world,{kind:'resource',id:999},onScreen)).toEqual([]);
  expect(matchingMapObjects(world,{kind:'growing',id:1},onScreen)).toEqual([]);
  expect(matchingMapObjects(world,{kind:'stockpile',id:1},onScreen)).toEqual([]);
});

test('group cell lookup scans each family once, preserves selection slots and returns independent cells',()=>{
  const world=emptyWorld();
  world.structures=[structure(1,'ground-scanner',4,4)];
  world.resources=[{id:2,kind:'rice',x:2,z:2,amount:20}];
  world.piles=[{id:3,kind:'wood',item:'wood',quantity:1,owner:{type:'ground',x:3,z:3}},
    {id:4,kind:'wood',item:'wood',quantity:1,owner:{type:'pawn',pawnId:99}}];
  world.packed=[{building:structure(5,'bed',0,0),owner:{type:'ground',x:5,z:5}}];
  world.jobs=[job(6,'wall',6,6)];world.tiles[17]={terrain:'rock',stone:'granite'};
  const find=vi.spyOn(world.resources,'find');
  const cells=mapObjectGroupCells(world,[{kind:'resource',id:2},{kind:'structure',id:1},{kind:'pile',id:3},{kind:'packed',id:5},{kind:'job',id:6},{kind:'rock',id:17},{kind:'pile',id:4},{kind:'resource',id:999},{kind:'resource',id:2}]);
  expect(find).not.toHaveBeenCalled();find.mockRestore();
  expect(cells.map(group=>group.length)).toEqual([1,9,1,1,1,1,0,0,1]);
  expect(cells[5]).toEqual([{x:1,z:1}]);
  cells[0]![0]!.x=15;
  expect(world.resources[0]!.x).toBe(2);
  expect(cells[8]![0]!.x).toBe(2);
});
