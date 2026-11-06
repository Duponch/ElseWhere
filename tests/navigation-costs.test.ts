import { expect,test } from 'vitest';
import { createWorld } from '../src/sim/engine';
import { footprintCells } from '../src/sim/definitions';
import { canStandAt,navigationCosts } from '../src/sim/furniture-travel';
import { candidateAccess } from '../src/sim/candidate-access';
import { blockedCells,canStep,routeToCell } from '../src/sim/pathfinding';
import { doorCorners,doorOpenness,newDoorState } from '../src/sim/door-rules';
import { scaleNavigationCosts } from '../src/sim/navigation-costs';
import { WeightedSearch } from '../src/sim/weighted-search';
import { animalNavigation } from '../src/sim/wildlife-navigation';
import { addMaterial } from '../src/sim/materials';
import { resolveSite } from '../src/sim/site';
import type { DistanceField } from '../src/sim/navigation-types';
import type { StructureKind,World } from '../src/sim/types';

/** Materialized pre-optimization oracle: no compact-lookup helpers or current
 * furniture cost constants. Footprints themselves are an unchanged contract. */
function materialized(world:World) {
  const costs=new Map<number,number>(),floors=new Map<number,number>(),repeaters=new Set<number>(),stops=new Set<number>();
  const delays:Partial<Record<StructureKind,number>>={'research-bench':1667,'tailor-bench':1667,'wood-generator':1667,'standing-lamp':467,'passive-cooler':1000,stonecutter:1667,table:1400,bed:1400,campfire:1400,stool:1000,horseshoes:467};
  const repeats=new Set(['research-bench','tailor-bench','wood-generator','passive-cooler','stonecutter','table','bed','campfire','stool']);
  const stand=new Set(['butcher-spot','crafting-spot','door','stool','horseshoes']);
  for(const job of world.jobs)if(job.construction==='frame')for(const c of footprintCells(job))costs.set(c.z*world.width+c.x,467);
  if(world.schemaVersion>=22) {
    for(const s of world.structures)for(const c of footprintCells(s)) {
      const index=c.z*world.width+c.x,delay=delays[s.kind];if(delay)costs.set(index,delay);
      if(repeats.has(s.kind))repeaters.add(index);if(!stand.has(s.kind))stops.add(index);
    }
    for(const job of world.jobs)if(job.construction==='frame')for(const c of footprintCells(job))stops.add(c.z*world.width+c.x);
  }
  if(world.schemaVersion>=28) {
    for(const p of world.piles)if(p.kind==='chunk'&&p.owner.type==='ground') {
      const i=p.owner.z*world.width+p.owner.x;costs.set(i,Math.max(costs.get(i)??0,1400));repeaters.add(i);stops.add(i);
    }
    world.tiles.forEach((tile,i)=>{
      if(['rough-stone','rich-soil','gravel'].includes(tile.terrain)||world.site&&tile.terrain==='grass'){floors.set(i,67);costs.set(i,Math.max(costs.get(i)??0,67));}
    });
  }
  if(world.schemaVersion>=29)for(const p of world.piles)if((p.kind==='steel'||world.schemaVersion>=32&&p.kind==='blocks'||world.schemaVersion>=41&&p.kind==='component')&&p.owner.type==='ground') {
    const i=p.owner.z*world.width+p.owner.x;floors.set(i,Math.max(floors.get(i)??0,467));costs.set(i,Math.max(costs.get(i)??0,467));
  }
  for(const s of world.structures)if(s.kind==='door') {
    const i=s.z*world.width+s.x,d=s.door!,duration=Math.round(45/(s.material==='wood'?1.2:s.material==='steel'?1:.45))/10;
    const openness=Math.max(0,Math.min(1,d.from+(d.open?1:-1)*(world.tick-d.changedAt)/duration));
    const wait=d.open?Math.max(0,(1-openness)*duration):duration;
    repeaters.delete(i);costs.set(i,(costs.get(i)??0)+Math.round(wait/3*1000));
  }
  return {costs,floors,repeaters,stops};
}

function fixture(site:boolean) {
  const world=createWorld(42,16,16);world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.structures=[];world.jobs=[];world.piles=[];world.pawns=[];world.resources=[];world.tick=30;
  if(site)world.site=resolveSite(42);
  for(const [i,terrain] of [[18,'soil'],[19,'rich-soil'],[20,'gravel'],[21,'rough-stone'],[22,'water'],[23,'rock']] as const)world.tiles[i]={terrain};
  for(const [kind,x,z] of [['table',5,5],['stool',5,7],['horseshoes',6,7],['standing-lamp',8,8],['stonecutter',10,10]] as const)
    world.structures.push({id:world.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood'});
  for(const [x,open] of [[7,false],[9,false],[11,true]] as const)world.structures.push({id:world.nextId++,kind:'door',x,z:6,orientation:0,footprint:'standard',material:'wood',door:{...newDoorState(0),open}});
  world.jobs.push({id:world.nextId++,kind:'wall',x:7,z:10,orientation:0,footprint:'standard',construction:'frame',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
  for(const [x,z,kind,item] of [[4,6,'chunk','granite-chunk'],[4,7,'chunk','granite-chunk'],[5,7,'steel','steel'],[6,6,'component','component'],[7,6,'blocks','granite-blocks']] as const)
    addMaterial(world,kind,1,{type:'ground',x,z},item);
  return world;
}

/** Independent O(N²) directed Dijkstra. Equal costs take the last inserted
 * pending cell, matching the existing route tie rule without using Dial queues. */
function routeOracle(world:World,start:number,blocked:Uint8Array,n:ReturnType<typeof materialized>,scale:number):DistanceField {
  const size=world.tiles.length,costs=new Float64Array(size).fill(Infinity),parents=new Int32Array(size).fill(-2),settled=new Set<number>(),order=new Int32Array(size);
  const corners=new Set(world.structures.filter(s=>s.kind==='door').map(s=>s.z*world.width+s.x));let serial=0;costs[start]=0;parents[start]=-1;
  for(;;) {
    let a=-1;for(let i=0;i<size;i++)if(!settled.has(i)&&Number.isFinite(costs[i])&&(a<0||costs[i]!<costs[a]!||costs[i]===costs[a]&&order[i]!>order[a]!))a=i;
    if(a<0)break;settled.add(a);
    for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]]) {
      const x=a%world.width+dx!,z=Math.floor(a/world.width)+dz!,b=z*world.width+x;
      if(x<0||z<0||x>=world.width||z>=world.height||blocked[b]||settled.has(b))continue;
      if(dx&&dz&&(blocked[a+dx]||blocked[a+dz*world.width]||corners.has(a+dx)||corners.has(a+dz*world.width)))continue;
      const extra=(n.repeaters.has(a)&&n.repeaters.has(b)?n.floors:n.costs).get(b)??0,cost=costs[a]!+(dx&&dz?1414:1000)+extra*scale;
      if(cost<costs[b]!){costs[b]=cost;parents[b]=a;order[b]=++serial;}
    }
  }
  return {costs,parents,start,visited:settled.size,unreachedGroups:0};
}

test('compact captures retain exact sparse/dense costs, floor maxima, doors, historical gates and immutable decision state',()=>{
  for(const site of [false,true])for(const version of [21,22,28,29,32,41,83]) {
    const world=fixture(site);(world as {schemaVersion:number}).schemaVersion=version;const old=materialized(world),n=navigationCosts(world);
    expect(n.repeaters).toEqual(old.repeaters);expect(n.stops).toEqual(old.stops);
    for(const key of ['costs','floors'] as const) {
      expect(n[key]?.maximum??0).toBe(Math.max(0,...old[key].values()));
      for(let i=-1;i<=world.tiles.length;i++){expect(n[key]?.get(i)).toBe(old[key].get(i));expect(n[key]?.has(i)??false).toBe(old[key].has(i));}
    }
    const scaled=scaleNavigationCosts(n.floors,3)!;expect(scaled.maximum).toBe(n.floors.maximum*3);
    for(const [i,value] of old.floors){expect(scaled.get(i)).toBe(value*3);expect(scaled.has(i)).toBe(true);}
    // A new decision sees mutations; an existing capture keeps terrain, objects
    // and time-dependent door waits as they were at capture.
    world.tiles=world.tiles.map(()=>({terrain:'soil'}));world.piles=[];world.structures=[];world.jobs=[];world.tick+=100;
    for(let i=0;i<world.tiles.length;i++){expect(n.costs?.get(i)).toBe(old.costs.get(i));expect(n.floors.get(i)).toBe(old.floors.get(i));}
    expect(navigationCosts(world).costs).toBeUndefined();
  }
  const world=fixture(false),openDoor=6*16+11;
  expect(navigationCosts(world).costs!.has(openDoor)).toBe(true);expect(navigationCosts(world).costs!.get(openDoor)).toBe(0);
  const siteCosts=navigationCosts(fixture(true));
  expect(siteCosts.costs!.get(6*16+9)).toBe(67+1267);expect(siteCosts.costs!.get(6*16+7)).toBe(467+1267);expect(siteCosts.costs!.get(openDoor)).toBe(67);
  expect(siteCosts.floors.get(4+6*16)).toBe(67);expect(siteCosts.floors.get(5+7*16)).toBe(467);
  expect(scaleNavigationCosts(siteCosts.floors,3)!.get(0)).toBe(201);
  const clean=createWorld(0,16,16);clean.tiles=clean.tiles.map(()=>({terrain:'grass'}));clean.structures=[];clean.jobs=[];clean.piles=[];
  expect(navigationCosts(clean).costs).toBeUndefined();expect(scaleNavigationCosts(undefined,3)).toBeUndefined();
});

test('full and resumed routes preserve directed costs, tie parents, corners and animal integer scaling against independent search',()=>{
  for(const site of [false,true]) {
    const world=fixture(site),start=2*16+2,n=navigationCosts(world),old=materialized(world),blocked=blockedCells(world),corners=doorCorners(world);
    for(const scale of [1,3]) {
      const expected=routeOracle(world,start,blocked,old,scale);
      const actual=new WeightedSearch(16,16,start,blocked,scaleNavigationCosts(n.costs,scale),n.repeaters,scaleNavigationCosts(n.floors,scale),corners).finish();
      expect(actual.parents).toEqual(expected.parents);expect(actual.costs).toEqual(expected.costs);expect(actual.visited).toBe(expected.visited);
      for(const target of [{x:14,z:14},{x:4,z:7},{x:5,z:7},{x:7,z:6}])expect(routeToCell(world,target,actual)).toEqual(routeToCell(world,target,expected));
    }
    const expected=routeOracle(world,start,blocked,old,1),access=candidateAccess(world,{x:2,z:2},blocked,new Set());
    for(const goal of [3*16+4,8*16+8,14*16+14]) {
      expect(access.has(goal)).toBe(true);const partial=access.resolve(new Set([goal]));
      for(let i=0;i<world.tiles.length;i++)if(partial.settled![i]){expect(partial.costs[i]).toBe(expected.costs[i]);expect(partial.parents[i]).toBe(expected.parents[i]);}
      expect(routeToCell(world,{x:goal%16,z:Math.floor(goal/16)},access)).toEqual(routeToCell(world,{x:goal%16,z:Math.floor(goal/16)},expected));
    }
    const animals=animalNavigation(world),animalBlocked=blocked.slice();animalBlocked[6*16+7]=1;animalBlocked[6*16+9]=1;
    const animalExpected=routeOracle(world,start,animalBlocked,old,3);
    for(const target of [{x:14,z:14},{x:11,z:6},{x:3,z:9}])expect(animals.route({x:2,z:2},[target])).toEqual(routeToCell(world,target,animalExpected));
  }
});

test('local animal checks match the dense physical oracle before routes and after a fresh capture',()=>{
  const offsets=[[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]] as const;
  for(const version of [15,21,22,28,87]) {
    const world=fixture(false);(world as {schemaVersion:number}).schemaVersion=version;
    const check=()=>{
      const nav=animalNavigation(world),blocked=blockedCells(world,true);
      for(const s of world.structures)if(s.kind==='door'&&(!s.door?.open||doorOpenness(s,world.tick)<1-1e-9))blocked[s.z*world.width+s.x]=1;
      const empty=new Set<number>();
      for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++) {
        const a={x,z};expect(nav.free(a)).toBe(canStandAt(world,a)&&!blocked[z*world.width+x]);
        for(const [dx,dz] of offsets){const b={x:x+dx,z:z+dz};expect(nav.step(a,b)).toBe(canStep(world,a,b,blocked,empty));}
      }
      // Route materialization after local checks keeps the same door corners.
      expect(nav.step({x:10,z:6},{x:11,z:7})).toBe(false);
    };
    check();
    // Same tick, different decision: a terrain edit (which replaces the Tile,
    // Tile contract) and a closing door must be visible, as must a
    // frame/ground-item removal.
    world.tiles[3*world.width+3]={...world.tiles[3*world.width+3]!,terrain:'rock'};world.piles=[];world.jobs=[];
    const door=world.structures.find(s=>s.kind==='door'&&s.x===11)!;door.door!.open=false;door.door!.from=1;door.door!.changedAt=world.tick;
    check();
  }
});
