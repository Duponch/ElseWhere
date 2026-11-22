import {expect,test} from 'vitest';
import {createWorld,stepWorld} from '../src/sim/engine.ts';
import {attachGeneratedAnimalGrowth256} from '../src/sim/animal-growth-runtime-256.ts';
import {initializeAnimalEggLayer256} from '../src/sim/animal-egg-local-v256.ts';
import {adultAgeTicks,animalNutritionMax} from '../src/sim/animal-life.ts';
import {TAMENESS_DECAY} from '../src/sim/animal-handling.ts';
import {penRegion,invalidateAnimalPens} from '../src/sim/animal-pens.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {advanceRopes377,hashOffset377,roperSpeedFactor377,roperHeld377,ROPE_STRETCH_WAIT377} from '../src/sim/animal-leading-377.ts';
import {coreMoveDuration297} from '../src/sim/human-move-core-297.ts';
import {animalJogEdgeCore377,createAnimalNavigationReader} from '../src/sim/wildlife-navigation.ts';
import {animalBody} from '../src/sim/wildlife-health.ts';
import {ropeBends} from '../src/render/RopeLayer.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {assignImportedPens} from '../src/import/rimworld/convert.ts';
import {SCHEMA_VERSION,type Cell,type Structure,type World} from '../src/sim/types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';
import type {AnimalHandlingTask} from '../src/sim/domestic-state.ts';

/** Prepared yard: one handler, walled pens with a door each and muffalo
 * outside. Nothing is earned; the leading itself is played by the engine. */
function yard(animals:Cell[],options:{pens?:{x0:number;x1:number;z0:number;z1:number;door:Cell}[];assign?:number;walls?:Cell[]}={}){
  const world=createWorld(377,26,26),handler=world.pawns[0]!;
  world.pawns=[handler];
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.jobs=[];world.structures=[];world.piles=[];world.stockpiles=[];world.growingZones=[];
  refreshStock(world);Object.assign(handler,{x:3,z:3,path:[],hunger:100,rest:100});
  for(const work of Object.keys(handler.priorities) as (keyof typeof handler.priorities)[])handler.priorities[work]=0;
  handler.priorities.handle=1;handler.skills.animals={level:10,xp:0,dailyXp:0,passion:0};
  const add=(kind:Structure['kind'],x:number,z:number):Structure=>{
    const s:Structure={id:world.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood'};
    if(kind==='door'||kind==='fence-gate')s.door=newDoorState(world.tick);
    if(kind==='pen-marker')s.pen={accepted:['muffalo','deer','duck']};
    world.structures.push(s);return s;
  };
  const markers:Structure[]=[];
  for(const pen of options.pens??[{x0:14,x1:20,z0:8,z1:16,door:{x:14,z:12}}]){
    for(let z=pen.z0;z<=pen.z1;z++)for(let x=pen.x0;x<=pen.x1;x++)if(x===pen.x0||x===pen.x1||z===pen.z0||z===pen.z1)add(x===pen.door.x&&z===pen.door.z?'door':'wall',x,z);
    markers.push(add('pen-marker',Math.floor((pen.x0+pen.x1)/2),Math.floor((pen.z0+pen.z1)/2)));
  }
  for(const c of options.walls??[])add('wall',c.x,c.z);
  const marker=markers[options.assign??0]!;
  const list=animals.map(c=>{
    const a:WildAnimal={id:world.nextId++,species:'muffalo',sex:'female',x:c.x,z:c.z,ageTicks:adultAgeTicks('muffalo')+6000,food:0,rest:1,state:'idle',path:[],nextDecision:world.tick+1};
    attachGeneratedAnimalGrowth256(a,world.tick*10,world.schemaVersion);a.food=Math.fround(animalNutritionMax(a)*.8);
    a.domestic={since:world.tick,care:'herbal',tameness:5,nextDecay:world.tick+TAMENESS_DECAY,penMarkerId:marker.id,productFullness:0};
    return a;
  });
  world.wildlife={profile:'temperate-hares-v1',rng:377,animals:list,eatenPlants:0,eatenItems:0,eatenNutrition:0};
  invalidateAnimalPens(world);
  return {world,handler,animals:list,marker,markers};
}
const walls=(world:World)=>new Set(world.structures.filter(s=>s.kind==='wall').map(s=>s.z*world.width+s.x));
/** Every cell a straight piece of cord passes over (fine sampling). */
function crossesWall(world:World,blocked:ReadonlySet<number>,a:Cell,b:Cell):boolean {
  for(let i=1;i<100;i++){const t=i/100,x=Math.round(a.x+(b.x-a.x)*t),z=Math.round(a.z+(b.z-a.z)*t);if(blocked.has(z*world.width+x))return true;}
  return false;
}
const inPen=(world:World,markerId:number,a:Cell)=>!!penRegion(world,markerId)?.cells.has(a.z*world.width+a.x);

interface Run {done:number;roped:number[];maxGap:number;drawnCrossings:number;straightCrossings:number;checkpoint?:World}
function lead(world:World,markerId:number,animals:WildAnimal[],limit=600,checkpointWhen?:(task:AnimalHandlingTask)=>boolean):Run {
  const handler=world.pawns[0]!,blocked=walls(world),run:Run={done:-1,roped:[],maxGap:0,drawnCrossings:0,straightCrossings:0};
  let lastCount=0;
  for(let i=0;i<limit;i++){
    stepWorld(world);
    const task=handler.animalHandling;
    if(task?.kind==='lead'){
      const count=task.ropees?.length??0;if(count>lastCount)run.roped.push(world.tick);lastCount=count;
      if(!run.checkpoint&&checkpointWhen?.(task)){expect(validateWorld(world)).toEqual([]);run.checkpoint=deserializeWorld(serializeWorld(world));}
      for(const id of task.ropees??[]){
        const a=world.wildlife!.animals.find(x=>x.id===id)!;
        if(inPen(world,markerId,a))continue;
        run.maxGap=Math.max(run.maxGap,Math.hypot(a.x-handler.x,a.z-handler.z));
        if(crossesWall(world,blocked,handler,a))run.straightCrossings++;
        const points=[{x:handler.x,z:handler.z},...ropeBends(task.trail377,a),{x:a.x,z:a.z}];
        if(points.some((p,k)=>k>0&&crossesWall(world,blocked,points[k-1]!,p)))run.drawnCrossings++;
      }
    }
    if(animals.every(a=>inPen(world,markerId,a))&&!handler.animalHandling){run.done=world.tick;break;}
  }
  return run;
}

test('a handler ropes three muffalo one after another and walks them through the door like RimWorld',()=>{
  const {world,marker,animals}=yard([{x:6,z:4},{x:8,z:6},{x:5,z:9}]);
  expect(validateWorld(world)).toEqual([]);
  const run=lead(world,marker.id,animals);
  expect(run.done,'all three penned and the job released').toBeGreaterThan(0);
  // Three ropings, each one 30 Core ticks of work before the next search.
  expect(run.roped).toHaveLength(3);
  for(let i=1;i<run.roped.length;i++)expect(run.roped[i]!-run.roped[i-1]!).toBeGreaterThanOrEqual(3);
  // The followers stay close (the handler waits beyond the 8-cell rope) and
  // the cord, drawn through the handler's trail, never crosses a wall.
  expect(run.maxGap).toBeLessThanOrEqual(9);
  expect(run.drawnCrossings).toBe(0);
  expect(run.done).toBeLessThan(160);
  for(const a of animals){expect(inPen(world,marker.id,a)).toBe(true);expect(a.domestic?.penMarkerId).toBe(marker.id);}
  expect(validateWorld(world)).toEqual([]);
});

test('animals behind a long wall follow the handler round it, never on the other side',()=>{
  const wall:Cell[]=[];for(let z=2;z<=14;z++)wall.push({x:10,z});
  const {world,marker,animals}=yard([{x:5,z:12},{x:7,z:13}],{walls:wall});
  world.pawns[0]!.x=4;world.pawns[0]!.z=10;
  const run=lead(world,marker.id,animals,800);
  expect(run.done).toBeGreaterThan(0);
  expect(run.drawnCrossings).toBe(0);
  expect(run.maxGap).toBeLessThanOrEqual(9);
});

test('animals assigned to another pen are led out through one door and in through the other',()=>{
  const pens=[{x0:2,x1:8,z0:12,z1:20,door:{x:8,z:16}},{x0:16,x1:22,z0:12,z1:20,door:{x:16,z:16}}];
  const {world,markers,animals}=yard([{x:4,z:15},{x:5,z:17}],{pens,assign:1});
  world.pawns[0]!.x=11;world.pawns[0]!.z=4;
  expect(animals.every(a=>inPen(world,markers[0]!.id,a))).toBe(true);
  const run=lead(world,markers[1]!.id,animals,900);
  expect(run.done).toBeGreaterThan(0);
  expect(run.drawnCrossings).toBe(0);
  for(const a of animals)expect(inPen(world,markers[1]!.id,a)).toBe(true);
});

test('saving and loading in the middle of a lead resumes the same ticks',()=>{
  const {world,marker,animals}=yard([{x:6,z:4},{x:8,z:6}]);
  const run=lead(world,marker.id,animals,600,task=>task.phase==='lead'&&task.ropeUntil377===undefined&&(task.trail377?.length??0)>=3&&(task.ropees?.length??0)===2);
  expect(run.checkpoint).toBeDefined();
  expect(run.done).toBeGreaterThan(0);
  const copy=run.checkpoint!;
  while(copy.tick<world.tick)stepWorld(copy);
  expect(serializeWorld(copy)).toBe(serializeWorld(world));
});

test('the handler waits 60 Core ticks while a rope is stretched beyond 8 cells',()=>{
  const {world,handler,animals,marker}=yard([{x:4,z:4}]);
  handler.animalHandling={animalId:animals[0]!.id,kind:'lead',markerId:marker.id,phase:'lead',ropees:[animals[0]!.id],sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0};
  expect(roperHeld377(world,handler,100)).toBe(false);
  handler.x=13;handler.z=4; // 9 cells: stretched
  expect(roperHeld377(world,handler,100)).toBe(true);
  expect(handler.animalHandling.ropeWait377).toBe(100+ROPE_STRETCH_WAIT377);
  handler.x=11; // close again, but the wait is a whole 60 ticks
  expect(roperHeld377(world,handler,159)).toBe(true);
  expect(roperHeld377(world,handler,160)).toBe(false);
  expect(handler.animalHandling.ropeWait377).toBeUndefined();
});

test('on the way to the pen the handler is no faster than its slowest animal, and keeps its trail',()=>{
  const {world,handler,animals,marker}=yard([{x:4,z:4}]);
  const a=animals[0]!;
  handler.animalHandling={animalId:a.id,kind:'lead',markerId:marker.id,phase:'lead',ropees:[a.id],sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0};
  handler.x=5;handler.z=5;
  const next={x:6,z:5},animalCore=animalJogEdgeCore377(world,a,next,animalBody(a).capacities.moving);
  // A fast handler (speed factor 2) is slowed to the muffalo's Jog cost.
  const factor=roperSpeedFactor377(world,handler,next,2,0,false);
  expect(coreMoveDuration297(handler,next,factor,0,false)*10).toBeCloseTo(animalCore,6);
  expect(handler.animalHandling.trail377).toEqual([{x:5,z:5}]);
  // While roping, or before any animal is held, the pace is the handler's own.
  handler.animalHandling.ropeUntil377=10;
  expect(roperSpeedFactor377(world,handler,next,2,0,false)).toBe(2);
});

test('followers march 2 to 5 cells behind on the handler trail, shifted aside by HashOffset',()=>{
  // Verse.Gen.HashOffset values (C# 32-bit arithmetic).
  expect([1,7,42,1234,99999].map(hashOffset377)).toEqual([-1471036369,-1471035992,-1471033774,-1470956176,-1464710198]);
  const {world,handler,animals,marker}=yard([{x:3,z:5},{x:3,z:4},{x:4,z:6}]);
  const trail=[{x:2,z:5},{x:3,z:5},{x:4,z:5},{x:5,z:5},{x:6,z:5}];
  handler.x=7;handler.z=5;handler.path=[{x:8,z:5},{x:9,z:5}];handler.state='moving';
  handler.animalHandling={animalId:animals[0]!.id,kind:'lead',markerId:marker.id,phase:'lead',ropees:animals.map(a=>a.id),trail377:trail,sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0};
  for(const a of animals)a.domestic!.penMarkerId=marker.id;
  advanceRopes377(world);
  animals.forEach((a,index)=>{
    const back=2+index%4,cell=trail[trail.length-back]!,side=Math.abs(hashOffset377(a.id))%3;
    const expected=side===0?cell:side===1?{x:cell.x,z:cell.z-1}:{x:cell.x,z:cell.z+1};
    const end=a.path.at(-1)??{x:a.x,z:a.z};
    expect(end,`animal ${index}`).toEqual(expected);
  });
});

test('version 376 keeps its lead tasks and loads them by number only; 377 fields are refused there',()=>{
  const {world,marker,animals}=yard([{x:6,z:4},{x:8,z:6}]);
  const run=lead(world,marker.id,animals,600,task=>task.phase==='lead'&&(task.trail377?.length??0)>=2);
  expect(run.checkpoint).toBeDefined();
  const current=serializeWorld(run.checkpoint!);
  const raw=JSON.parse(current) as {pawns:{animalHandling?:Record<string,unknown>}[]};
  expect(raw.pawns[0]!.animalHandling?.trail377).toBeDefined();
  const relabelled=JSON.parse(current) as Record<string,unknown>;relabelled.schemaVersion=376;
  expect(()=>deserializeWorld(JSON.stringify(relabelled))).toThrow(/Invalid version376 save/);
  const old=deserializeWorld(asOldSchema(current,376));
  expect(old.schemaVersion).toBe(SCHEMA_VERSION);
  expect(old.pawns[0]!.animalHandling?.trail377).toBeUndefined();
  for(let i=0;i<500&&old.pawns[0]!.animalHandling;i++)stepWorld(old);
  expect(old.pawns[0]!.animalHandling).toBeUndefined();
  for(const a of old.wildlife!.animals)expect(inPen(old,marker.id,a)).toBe(true);
});

test('from 377 a duck is held by fences like every penned roamer, also in flight; 376 kept its open fences',()=>{
  const {world}=yard([{x:4,z:4}]);
  const fence:Structure={id:world.nextId++,kind:'fence',x:6,z:6,orientation:0,footprint:'standard',material:'wood'};
  world.structures.push(fence);
  const duck=world.wildlife!.animals[0]!;duck.species='duck';duck.x=5;duck.z=6;
  const step=()=>createAnimalNavigationReader(world)(duck).step({x:5,z:6},{x:6,z:6});
  expect(step()).toBe(false);
  duck.flight={revision:1,phase:'flying',flyingCore:0,cooldownCore:0,lerpCore:0,atCore:0};
  expect(step()).toBe(false);
  delete duck.flight;
  (world as {schemaVersion:number}).schemaVersion=376;
  expect(step()).toBe(true);
});

/** A fenced pen with a gate, its marker and penned muffalo and ducks. */
function fencedPen(){
  const {world,handler}=yard([],{pens:[]});
  handler.priorities.handle=0;handler.x=1;handler.z=1;
  const add=(kind:Structure['kind'],x:number,z:number):Structure=>{
    const s:Structure={id:world.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood'};
    if(kind==='fence-gate')s.door=newDoorState(world.tick);
    if(kind==='pen-marker')s.pen={accepted:['muffalo','duck']};
    world.structures.push(s);return s;
  };
  for(let z=6;z<=16;z++)for(let x=6;x<=16;x++)if(x===6||x===16||z===6||z===16)add(x===11&&z===16?'fence-gate':'fence',x,z);
  const marker=add('pen-marker',11,11),gate=world.structures.find(s=>s.kind==='fence-gate')!;
  const animals=([[8,8,'muffalo'],[13,9,'duck'],[9,14,'duck'],[14,13,'muffalo'],[11,15,'duck']] as const).map(([x,z,species])=>{
    const a:WildAnimal={id:world.nextId++,species,sex:'female',x,z,ageTicks:adultAgeTicks(species)+6000,food:0,rest:1,state:'idle',path:[],nextDecision:world.tick+1};
    attachGeneratedAnimalGrowth256(a,world.tick*10,world.schemaVersion);initializeAnimalEggLayer256(a);a.food=Math.fround(animalNutritionMax(a)*.8);
    a.domestic={since:world.tick,care:'herbal',tameness:5,nextDecay:world.tick+TAMENESS_DECAY,...species==='muffalo'?{productFullness:0}:{}};
    return a;
  });
  world.wildlife={profile:'temperate-hares-v1',rng:377,animals,eatenPlants:0,eatenItems:0,eatenNutrition:0};
  invalidateAnimalPens(world);
  return {world,marker,gate,animals};
}

test('the importer gives every penned roamer its current pen (GetCurrentPenOf), never a pet or an outsider',()=>{
  const {world,marker,animals}=fencedPen();
  const outside=structuredClone(animals[0]!);outside.id=world.nextId++;outside.x=2;outside.z=3;
  const pet=structuredClone(animals[1]!);pet.id=world.nextId++;pet.species='husky';pet.x=10;pet.z=10;
  const inside=[...animals];world.wildlife!.animals.push(outside,pet);
  assignImportedPens(world);
  for(const a of inside)expect(a.domestic?.penMarkerId).toBe(marker.id);
  expect(outside.domestic?.penMarkerId).toBeUndefined();
  expect(pet.domestic?.penMarkerId).toBeUndefined();
});

test('penned muffalo and ducks stay inside their fences while the gate keeps opening',()=>{
  const {world,marker,gate,animals}=fencedPen();
  assignImportedPens(world);
  expect(validateWorld(world)).toEqual([]);
  const escaped=new Set<number>();
  for(let i=0;i<900;i++){
    // The gate opens as when a colonist walks through, without being held open.
    if(i%40===0){gate.door!.open=true;gate.door!.from=1;gate.door!.changedAt=world.tick;gate.door!.closeAt=world.tick+30;}
    stepWorld(world);
    for(const a of animals)if(!inPen(world,marker.id,a)&&!(a.x===gate.x&&a.z===gate.z))escaped.add(a.id);
  }
  expect([...escaped].map(id=>{const a=animals.find(x=>x.id===id)!;return `${a.species}@${a.x},${a.z} pen=${a.domestic?.penMarkerId} flight=${JSON.stringify(a.flight)}`;})).toEqual([]);
});
