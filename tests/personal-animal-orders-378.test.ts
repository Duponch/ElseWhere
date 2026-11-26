import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {applyTaming,TAME_COOLDOWN} from '../src/sim/animal-handling.ts';
import {animalClaimed} from '../src/sim/animal-rest-state.ts';
import {designateSlaughter} from '../src/sim/animal-slaughter.ts';
import {validateDomesticAnimals} from '../src/sim/domestic-save.ts';
import {designateHunt,huntingProposal} from '../src/sim/hunting.ts';
import {validHuntingTask} from '../src/sim/hunting-save.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {applyPersonalAnimalOrder378,isForcedPersonalAnimalOrder378,personalAnimalOrderReason378,queryPersonalAnimalOrderOptions378,type PersonalAnimalAction378,type PersonalAnimalOrderCommand378} from '../src/sim/personal-animal-orders-378.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {huntingCamp} from './scenarios/hunting.ts';
import type {World} from '../src/sim/types.ts';

function camp(action:PersonalAnimalAction378,near=true){
  const world=huntingCamp(),pawn=world.pawns[0]!,animal=world.wildlife!.animals[0]!;
  // This controlled arena is prepared at tick2000; its local deterioration
  // frontier belongs to that declared starting tick, rather than 2000 ticks
  // of unplayed exposure.
  world.deterioration!.lastTick=world.tick;
  world.pawns=[pawn];world.resources=[];world.events=[];
  delete pawn.background;delete pawn.traits;
  pawn.priorities.hunt=action==='hunt'?1:0;pawn.priorities.handle=action==='hunt'?0:1;
  pawn.skills.animals={level:8,xp:0,dailyXp:0,passion:0};pawn.planCooldown=0;pawn.needCooldown=0;
  Object.assign(animal,{x:near?pawn.x+1:25,z:pawn.z,path:[],state:'idle',nextDecision:world.tick+100});delete animal.motion;
  if(action==='hunt')expect(designateHunt(world,{type:'hunt',animalId:animal.id,enabled:true})).toEqual({ok:true});
  if(action==='tame'){
    addMaterial(world,'food',2,{type:'ground',x:pawn.x,z:pawn.z},'berries');
    expect(applyTaming(world,{type:'tame',animalId:animal.id,enabled:true})).toEqual({ok:true});
  }
  if(action==='slaughter'){
    animal.domestic={since:world.tick,care:'herbal',tameness:5,nextDecay:world.tick+45000,lastTraining:world.tick};
    expect(designateSlaughter(world,{type:'slaughter',animalId:animal.id,enabled:true})).toEqual({ok:true});
  }
  refreshStock(world);expect(validateWorld(world)).toEqual([]);
  const command:PersonalAnimalOrderCommand378={type:'order-animal-378',pawnId:pawn.id,animalId:animal.id,action,queue:false};
  return {world,pawn,animal,command};
}
function until(world:World,predicate:()=>boolean,max=2000){
  for(let i=0;i<max&&!predicate();i++)stepWorld(world);
  expect(predicate(),JSON.stringify({tick:world.tick,pawns:world.pawns.map(p=>({state:p.state,path:p.path.length,hunting:p.hunting,handling:p.animalHandling,haul:p.haul})),animals:world.wildlife?.animals.map(a=>({id:a.id,state:a.state,x:a.x,z:a.z}))})).toBe(true);
  expect(validateWorld(world)).toEqual([]);
}

test.each(['hunt','tame','slaughter'] as const)('%s menu and rejection are read-only and target the actual designated animal',action=>{
  const {world,pawn,animal,command}=camp(action),before=structuredClone(world);
  const options=queryPersonalAnimalOrderOptions378(world,pawn.id,animal);
  expect(options).toHaveLength(1);expect(options[0]).toMatchObject({animalId:animal.id,animalAction:action,enabled:true});
  expect(personalAnimalOrderReason378(world,command)).toBeUndefined();expect(world).toEqual(before);
  pawn.priorities[action==='hunt'?'hunt':'handle']=0;
  const refused=structuredClone(world);expect(applyPersonalAnimalOrder378(world,command).ok).toBe(false);expect(world).toEqual(refused);
});

test('a personal hunt selects the clicked prey over the nearest designation, fires real projectiles and deposits its real corpse after save/reload',()=>{
  const {world,pawn,animal,command}=camp('hunt',false),id=animal.id;
  const nearer={...structuredClone(animal),id:world.nextId++,x:pawn.x+1};world.wildlife!.animals.push(nearer);
  expect(designateHunt(world,{type:'hunt',animalId:nearer.id,enabled:true})).toEqual({ok:true});
  expect(applyPersonalAnimalOrder378(world,command)).toEqual({ok:true});
  expect(pawn.hunting).toMatchObject({animalId:id,forced378:true,progress:0});expect(isForcedPersonalAnimalOrder378(pawn)).toBe(true);
  expect(animal.health?.death).toBeUndefined();expect(nearer.health?.death).toBeUndefined();
  expect(applyCommand(world,{type:'priority',pawnId:pawn.id,work:'hunt',value:0})).toEqual({ok:true});
  until(world,()=>!!world.projectiles?.length);
  const copy=deserializeWorld(serializeWorld(world));stepWorld(world,25);stepWorld(copy,25);expect(copy).toEqual(world);
  until(world,()=>world.piles.some(p=>p.id===id&&p.owner.type==='ground'&&p.owner.x===8&&p.owner.z===8)&&!pawn.hunting&&!pawn.haul);
  expect(world.piles.find(p=>p.id===id)?.corpse?.health.death).toBeDefined();
  expect(world.hunting?.completed).toBeGreaterThanOrEqual(1);
});

test('personal taming carries and consumes real food, preserves the forced owner across priority changes and resumes exactly through its attempt',()=>{
  const {world,pawn,animal,command}=camp('tame',false);
  pawn.inspiration360={kind:'taming',start:world.tick,until:world.tick+48000};
  const source=world.piles.find(p=>p.item==='berries')!;
  expect(applyPersonalAnimalOrder378(world,command)).toEqual({ok:true});
  expect(source.owner.type).toBe('ground');expect(animal.domestic).toBeUndefined();
  expect(applyCommand(world,{type:'priority',pawnId:pawn.id,work:'handle',value:0})).toEqual({ok:true});
  until(world,()=>pawn.animalHandling?.step===3);
  expect(pawn.animalHandling).toMatchObject({animalId:animal.id,kind:'tame',forced378:true,quantity:1});
  expect(world.piles.find(p=>p.id===pawn.animalHandling!.carryPileId)?.owner).toEqual({type:'pawn',pawnId:pawn.id});
  expect(animal.taming?.lastAttempt).toBeUndefined();
  const copy=deserializeWorld(serializeWorld(world));
  stepWorld(world,120);stepWorld(copy,120);expect(copy).toEqual(world);
  until(world,()=>!pawn.animalHandling);
  expect(animal.domestic).toBeDefined();expect(animal.taming).toBeUndefined();expect(pawn.inspiration360).toBeUndefined();
  expect(world.piles.filter(p=>p.item==='berries').reduce((n,p)=>n+p.quantity,0)).toBe(0);
  expect(world.events.some(e=>e.message.includes('apprivoisé'))).toBe(true);
});

test('personal slaughter walks to contact before irreversible work, survives save and honors priority changes after admission',()=>{
  const {world,pawn,animal,command}=camp('slaughter',false),id=animal.id;
  expect(applyCommand(world,command)).toEqual({ok:true});
  expect(pawn.animalHandling).toMatchObject({animalId:id,forced378:true,progress:0});expect(pawn.path.length).toBeGreaterThan(0);
  stepWorld(world,5);expect(animal.health?.death).toBeUndefined();expect(pawn.animalHandling?.progress).toBe(0);
  expect(applyCommand(world,{type:'priority',pawnId:pawn.id,work:'handle',value:0})).toEqual({ok:true});
  until(world,()=>pawn.animalHandling?.phase==='interact'&&pawn.animalHandling.progress>=1);
  const copy=deserializeWorld(serializeWorld(world));stepWorld(world,20);stepWorld(copy,20);expect(copy).toEqual(world);
  expect(world.piles.find(p=>p.id===id)?.corpse?.health.death?.cause??animal.health?.death?.cause).toBe('execution');
  expect(pawn.animalHandling).toBeUndefined();expect(isForcedPersonalAnimalOrder378(pawn)).toBe(false);
});

test('taming skill, cooldown, forbidden food, inaccessible target and foreign service claims refuse atomically',()=>{
  const changes=[
    (f:ReturnType<typeof camp>)=>{f.pawn.skills.animals!.level=0;f.animal.species='muffalo';},
    (f:ReturnType<typeof camp>)=>{f.animal.taming!.lastAttempt=f.world.tick-TAME_COOLDOWN+1;},
    (f:ReturnType<typeof camp>)=>{f.world.piles.find(p=>p.item==='berries')!.forbidden=true;},
    (f:ReturnType<typeof camp>)=>{for(let z=0;z<f.world.height;z++)f.world.tiles[z*f.world.width+12]={terrain:'rock'};},
    (f:ReturnType<typeof camp>)=>{const other=structuredClone(f.pawn);other.id=f.world.nextId++;other.hunting={animalId:f.animal.id,startedAt:f.world.tick,phase:'stalk',progress:0};f.world.pawns.push(other);}
  ];
  for(const change of changes){
    const f=camp('tame',false);change(f);const before=structuredClone(f.world);
    expect(personalAnimalOrderReason378(f.world,f.command)).toBeDefined();
    expect(applyPersonalAnimalOrder378(f.world,f.command).ok).toBe(false);expect(f.world).toEqual(before);
  }
});

test('hunters and handlers share animal reservations from378; no automatic hunter can take a personally reserved tamee',()=>{
  const {world,pawn,animal,command}=camp('tame'),other=structuredClone(pawn);other.id=world.nextId++;other.x=3;other.priorities.hunt=1;
  world.pawns.push(other);addMaterial(world,'weapon',1,{type:'equipment',pawnId:other.id},'revolver');
  expect(designateHunt(world,{type:'hunt',animalId:animal.id,enabled:true})).toEqual({ok:true});
  expect(applyPersonalAnimalOrder378(world,command)).toEqual({ok:true});
  expect(animalClaimed(world,animal.id,other.id)).toBe(true);
  expect(huntingProposal(world,other,reachableCells(world,other,blockedCells(world),new Set()))).toBeUndefined();
  expect(applyPersonalAnimalOrder378(world,{...command,pawnId:other.id,action:'hunt'}).ok).toBe(false);
});

test.each(['hunt','tame','slaughter'] as const)('%s cancellation removes only the actual task, and old schemas reject the prospective marker',action=>{
  const {world,pawn,animal,command}=camp(action);
  expect(applyPersonalAnimalOrder378(world,command)).toEqual({ok:true});
  expect(validateWorld(world)).toEqual([]);
  const ownTask=pawn.hunting??pawn.animalHandling!;
  if(action==='hunt'){
    expect(validHuntingTask(ownTask,377,world.tick)).toBe(false);
    expect(validHuntingTask({...ownTask,forced378:false},378,world.tick)).toBe(false);
  }else expect(validateDomesticAnimals(world,377).length).toBeGreaterThan(0);
  const beforeRng=world.rng;
  expect(applyCommand(world,{type:'clear-orders',pawnId:pawn.id})).toEqual({ok:true});
  expect(isForcedPersonalAnimalOrder378(pawn)).toBe(false);expect(pawn.hunting).toBeUndefined();expect(pawn.animalHandling).toBeUndefined();
  expect(animal.health?.death).toBeUndefined();expect(world.rng).toBe(beforeRng);expect(validateWorld(world)).toEqual([]);
});

test('cancelling a forced tamer after the first meal drops the real remaining food and retains only the original designation',()=>{
  const {world,pawn,animal,command}=camp('tame');
  expect(applyPersonalAnimalOrder378(world,command)).toEqual({ok:true});
  until(world,()=>pawn.animalHandling?.step===3);
  const carried=world.piles.find(p=>p.id===pawn.animalHandling!.carryPileId)!;
  expect(carried.quantity).toBe(1);expect(carried.owner).toEqual({type:'pawn',pawnId:pawn.id});
  const beforeRng=world.rng;
  expect(applyCommand(world,{type:'clear-orders',pawnId:pawn.id})).toEqual({ok:true});
  expect(carried.owner.type).toBe('ground');expect(carried.quantity).toBe(1);
  expect(pawn.animalHandling).toBeUndefined();expect(animal.taming?.designated).toBe(true);expect(animal.domestic).toBeUndefined();
  expect(world.rng).toBe(beforeRng);expect(validateWorld(world)).toEqual([]);
});
