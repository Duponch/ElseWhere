import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {validateWorld} from '../src/sim/serialization.ts';
import {newBuildingFuel} from '../src/sim/fuel.ts';
import {medicalCamp} from './scenarios/health.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';
import type {OrderedCommand378} from '../src/sim/order-types.ts';
import type {Structure,World} from '../src/sim/types.ts';

/** Declared finite arena: one actual tree-cutting head keeps its handler
 * busy while a second pawn asks the real automatic planner for work. */
function arena(){
  const world=medicalCamp(2),pawn=world.pawns[0]!,other=world.pawns[1]!;
  for(const p of world.pawns){delete p.background;delete p.traits;p.hunger=100;p.rest=100;}
  Object.assign(pawn,{x:4,z:5});Object.assign(other,{x:5,z:5});
  pawn.priorities.gather=1;
  world.resources.push({id:world.nextId++,kind:'tree',x:25,z:25,amount:12});
  expect(applyCommand(world,{type:'designate',kind:'chop',x:25,z:25})).toEqual({ok:true});
  const head=world.jobs[0]!;
  expect(applyCommand(world,{type:'order-job',pawnId:pawn.id,jobId:head.id,queue:false})).toEqual({ok:true});
  return {world,pawn,other,head};
}
function enqueue(world:World,order:OrderedCommand378){
  expect(applyCommand(world,{type:'queue-order-378',order})).toEqual({ok:true});
  expect(validateWorld(world)).toEqual([]);
}
function observe(world:World,check:()=>void){
  for(let i=0;i<20;i++){stepWorld(world);check();}
  expect(validateWorld(world)).toEqual([]);
}

test('queued construction delivery excludes new automatic delivery and building admissions',()=>{
  const {world,pawn,other,head}=arena();pawn.priorities.build=1;other.priorities.build=1;other.priorities.haul=1;
  addMaterial(world,'wood',10,{type:'ground',x:12,z:10},'wood');
  expect(applyCommand(world,{type:'designate',kind:'wall',x:10,z:10})).toEqual({ok:true});
  const target=world.jobs.find(j=>j.kind==='wall')!;
  enqueue(world,{type:'order-haul',pawnId:pawn.id,target:{type:'job',jobId:target.id},queue:false});
  observe(world,()=>{
    expect(pawn.jobId).toBe(head.id);expect(other.jobId).not.toBe(target.id);
    expect(other.haul?.destination).not.toMatchObject({type:'job',jobId:target.id});
    expect(world.piles.some(p=>p.owner.type==='job'&&p.owner.jobId===target.id)).toBe(false);
  });
});

test('queued bill station excludes an automatic cook before the first order is finished',()=>{
  const {world,pawn,other,head}=arena();pawn.priorities.cook=1;other.priorities.cook=1;
  pawn.skills.cooking={level:8,xp:0,dailyXp:0,passion:0};other.skills.cooking={level:8,xp:0,dailyXp:0,passion:0};
  const station=fixtureBuilding(world,'campfire',12,10);
  addMaterial(world,'food',10,{type:'ground',x:11,z:10},'rice');
  expect(applyCommand(world,{type:'bill-add',structureId:station.id})).toEqual({ok:true});
  enqueue(world,{type:'order-cook',pawnId:pawn.id,structureId:station.id,queue:false});
  observe(world,()=>{expect(pawn.jobId).toBe(head.id);expect(other.cooking?.stationId).not.toBe(station.id);});
  expect(world.piles.some(p=>p.item==='simple-meal')).toBe(false);
});

test('queued refuelling excludes automatic new fuel hauling without changing the physical fuel',()=>{
  const {world,pawn,other,head}=arena();pawn.priorities.haul=1;other.priorities.haul=1;
  const station=fixtureBuilding(world,'campfire',12,10) as Structure;
  station.fuel={...newBuildingFuel('campfire'),ticks:0,autoRefuel:true};
  addMaterial(world,'wood',5,{type:'ground',x:11,z:10},'wood');
  enqueue(world,{type:'order-haul',pawnId:pawn.id,target:{type:'fuel',structureId:station.id},queue:false});
  observe(world,()=>{
    expect(pawn.jobId).toBe(head.id);expect(other.haul?.destination).not.toMatchObject({type:'fuel',structureId:station.id});
    expect(station.fuel!.ticks).toBe(0);
  });
  expect(world.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(5);
});

test('queued packed furniture preserves its single identity against automatic storage hauling',()=>{
  const {world,pawn,other,head}=arena();pawn.priorities.haul=1;other.priorities.haul=1;
  const building:Structure={id:world.nextId++,kind:'stool',x:0,z:0,orientation:0,footprint:'standard',material:'wood',quality:'normal'};
  const pack={building,owner:{type:'ground' as const,x:11,z:10}};world.packed.push(pack);
  expect(applyCommand(world,{type:'stockpile',x:15,z:10,enabled:true,filters:{wood:false,food:false,furniture:true}})).toEqual({ok:true});
  refreshStock(world);
  enqueue(world,{type:'order-haul',pawnId:pawn.id,target:{type:'furniture',structureId:building.id},queue:false});
  observe(world,()=>{
    expect(pawn.jobId).toBe(head.id);expect(other.haul?.sourcePileId).not.toBe(building.id);
    expect(pack.owner).toEqual({type:'ground',x:11,z:10});
  });
  expect(world.packed.filter(p=>p.building.id===building.id)).toHaveLength(1);
});
