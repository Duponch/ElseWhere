import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {canStandAt,captureStandability,furnitureDelay,navigationCosts} from '../src/sim/furniture-travel.ts';
import {captureStructureNavigation,structureNavigationReader,type StructureNavigationGeometry} from '../src/sim/structure-navigation.ts';
import {blockedCells,canStep,reachableCells} from '../src/sim/pathfinding.ts';
import {candidateAccess} from '../src/sim/candidate-access.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {startTravel} from '../src/sim/movement.ts';
import {animalNavigation,moveAnimal} from '../src/sim/wildlife-navigation.ts';
import {LightEnvironmentCache} from '../src/sim/light-environment.ts';
import type {Cell,Structure,World} from '../src/sim/types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

function scene(){
  const w=createWorld(433,16,16);w.tiles=w.tiles.map(()=>({terrain:'grass'}));
  w.resources=[];w.structures=[];w.jobs=[];w.piles=[];w.packed=[];w.growingZones=[];w.stockpiles=[];
  return w;
}
function building(w:World,kind:Structure['kind'],x:number,z:number,orientation:Structure['orientation']=0):Structure {
  const s:Structure={id:w.nextId++,kind,x,z,orientation,footprint:'standard',material:'wood'};
  if(kind==='door'||kind==='autodoor'||kind==='fence-gate')s.door=newDoorState(w.tick);
  if(kind==='spike-trap')s.spikeTrap={autoRebuild:false,touching:[]};
  w.structures.push(s);return s;
}
function sameCosts(w:World,geometry:StructureNavigationGeometry,origin:Cell=w.pawns[0]!){
  const cold=navigationCosts(w,origin),captured=navigationCosts(w,origin,undefined,geometry);
  expect(captured.stops).toEqual(cold.stops);expect(captured.repeaters).toEqual(cold.repeaters);
  for(const key of ['costs','floors'] as const){
    expect(captured[key]?.maximum??0).toBe(cold[key]?.maximum??0);
    for(let i=-1;i<=w.tiles.length;i++){
      expect(captured[key]?.get(i)).toBe(cold[key]?.get(i));
      expect(captured[key]?.has(i)??false).toBe(cold[key]?.has(i)??false);
    }
  }
}

test('geometry preserves rotated footprints, source precedence and conduit coexistence',()=>{
  const w=scene(),from={x:2,z:2},to={x:6,z:5};
  for(const orientation of [0,1,2,3] as const)for(const reverse of [false,true]){
    w.structures=[];const table=building(w,'table',6,5,orientation),seat=building(w,'stool',6,5),wire=building(w,'power-conduit',6,5);
    building(w,'stonecutter',10,10,orientation);building(w,'bed',10,5,orientation);
    if(reverse)w.structures.reverse();
    const geometry=captureStructureNavigation(w),stand=captureStandability(w,geometry);
    expect(geometry.at(to)).toEqual(reverse?[wire,seat,table]:[table,seat,wire]);
    expect(furnitureDelay(w,from,to,undefined,geometry)).toBe(reverse?4.2:3);
    for(let z=-1;z<=16;z++)for(let x=-1;x<=16;x++){
      const c={x,z};expect(canStandAt(w,c,geometry)).toBe(canStandAt(w,c));expect(stand(c)).toBe(canStandAt(w,c));
      if(x>=1&&x<15&&z>=1&&z<15)expect(furnitureDelay(w,c,{x:x+1,z},undefined,geometry)).toBe(furnitureDelay(w,c,{x:x+1,z}));
    }
    expect(canStandAt(w,{x:6.5,z:5},geometry)).toBe(false);sameCosts(w,geometry);
  }
});

test('geometry shares no mutable costs: same-tick doors, frames, chunks, floors, snow and trap knowledge remain current',()=>{
  const w=scene(),pawn=w.pawns[0]!,door=building(w,'door',7,5),trap=building(w,'spike-trap',9,5);
  Object.assign(pawn,{x:5,z:5});building(w,'table',5,7);
  w.jobs.push({id:w.nextId++,kind:'wall',x:5,z:9,orientation:0,footprint:'standard',construction:'blueprint',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
  w.piles.push({id:w.nextId++,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:6,z:5}});
  w.piles.push({id:w.nextId++,kind:'steel',item:'steel',quantity:1,owner:{type:'ground',x:7,z:5}});
  w.snow={revision:1,adoptedAt:w.tick,lastTick:w.tick,cursor:0,seed:433};
  const geometry=captureStructureNavigation(w);
  for(let phase=0;phase<3;phase++){
    if(phase===1){door.door!.open=true;door.door!.from=1;w.jobs[0]!.construction='frame';w.piles[0]!.owner={type:'pawn',pawnId:pawn.id};w.tiles[7+5*w.width]={terrain:'gravel',floor:'wood-planks',snowDepth:.9};pawn.faction='outlaws';}
    if(phase===2){door.door!.open=false;delete trap.spikeTrap;w.jobs=[];w.piles[0]!.owner={type:'ground',x:8,z:5};w.tiles[7+5*w.width]={terrain:'rich-soil'};pawn.faction='colony';}
    sameCosts(w,geometry,pawn);
    for(const c of [{x:6,z:5},{x:7,z:5},{x:8,z:5},{x:9,z:5},{x:5,z:9}]){
      expect(canStandAt(w,c,geometry)).toBe(canStandAt(w,c));
      expect(furnitureDelay(w,pawn,c,undefined,geometry)).toBe(furnitureDelay(w,pawn,c));
    }
    expect(blockedCells(w,false,geometry)).toEqual(blockedCells(w));expect(blockedCells(w,true,geometry)).toEqual(blockedCells(w,true));
  }
});

test('captured and cold navigation retain complete directed costs, route parents and diagonal door corners',()=>{
  const w=scene(),origin={x:2,z:2};building(w,'door',5,4);building(w,'fence-gate',8,8);building(w,'table',6,6,1);building(w,'standing-lamp',9,7);
  for(const i of [52,68,84,100,116])w.tiles[i]={terrain:'rock'};
  w.tiles[87]={terrain:'rough-stone'};w.tiles[88]={terrain:'soil',floor:'wood-planks'};
  const geometry=captureStructureNavigation(w),blocked=blockedCells(w),capturedBlocked=blockedCells(w,false,geometry);
  expect(capturedBlocked).toEqual(blocked);
  const cold=reachableCells(w,origin,blocked,new Set()),captured=reachableCells(w,origin,capturedBlocked,new Set(),undefined,undefined,undefined,undefined,geometry);
  expect(captured.parents).toEqual(cold.parents);expect(captured.costs).toEqual(cold.costs);expect(captured.visited).toBe(cold.visited);
  const candidates=candidateAccess(w,origin,blocked,new Set(),true,origin,geometry),plain=candidateAccess(w,origin,blocked,new Set(),true);
  for(const goal of [38,86,136,221]){
    expect(candidates.has(goal)).toBe(plain.has(goal));
    const targets=new Set([goal]);expect(candidates.resolve(targets)).toEqual(plain.resolve(targets));
  }
  for(const [a,b]of [[{x:4,z:4},{x:5,z:5}],[{x:8,z:7},{x:9,z:8}],[{x:2,z:2},{x:3,z:3}]] as const)
    expect(canStep(w,a,b,blocked,new Set(),geometry)).toBe(canStep(w,a,b,blocked,new Set()));
});

test('engine-owned readers reset on append, replacement and explicit footprint commits; public scalar callers remain cold',()=>{
  const w=scene(),reader=structureNavigationReader(w),first=reader.read();expect(reader.read()).toBe(first);
  const table=building(w,'table',6,6);const appended=reader.read();expect(appended).not.toBe(first);expect(canStandAt(w,{x:6,z:6},appended)).toBe(false);
  w.structures=[{...table,x:9}];const replaced=reader.read();expect(replaced).not.toBe(appended);expect(canStandAt(w,{x:6,z:6},replaced)).toBe(true);
  // Position is immutable in place (shared index contract): a footprint edit replaces the array.
  w.structures=[{...w.structures[0]!,x:11}];expect(canStandAt(w,{x:11,z:6})).toBe(false);expect(canStandAt(w,{x:9,z:6})).toBe(true);
  reader.invalidate();const moved=reader.read();expect(moved).not.toBe(replaced);expect(canStandAt(w,{x:11,z:6},moved)).toBe(false);expect(canStandAt(w,{x:9,z:6},moved)).toBe(true);
});

test('human and animal movement preserve full physical continuation when reusing captured geometry',()=>{
  const w=scene();building(w,'stool',6,5);building(w,'standing-lamp',8,5);building(w,'table',10,5);
  const pawn=w.pawns[0]!;Object.assign(pawn,{x:5,z:5,moveCooldown:0,motion:null,path:[{x:6,z:5}]});
  const animal:WildAnimal={id:w.nextId++,species:'hare',sex:'female',ageTicks:60000,x:7,z:5,food:1,rest:1,state:'idle',path:[{x:8,z:5}],nextDecision:w.tick};
  w.wildlife={profile:'temperate-hares-v1',rng:433,animals:[animal],eatenPlants:0,eatenNutrition:0,eatenItems:0};
  const copy=structuredClone(w),geometry=captureStructureNavigation(copy),light=new LightEnvironmentCache().read(w),copyLight=new LightEnvironmentCache().read(copy);
  expect(startTravel(w,pawn,{x:6,z:5},()=>light)).toBe(startTravel(copy,copy.pawns[0]!,{x:6,z:5},()=>copyLight,geometry));
  const nav=animalNavigation(w),copyNav=animalNavigation(copy,false,false,undefined,false,geometry);
  expect(moveAnimal(w,animal,nav.step,1)).toBe(moveAnimal(copy,copy.wildlife!.animals[0]!,copyNav.step,1,copyNav.geometry));
  expect(copy).toEqual(w);
});
