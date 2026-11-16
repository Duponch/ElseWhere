import { expect, test } from 'vitest';
import { SnapshotDecoder, SnapshotEncoder } from '../src/bridge/snapshots.ts';
import { PresentationChanges } from '../src/bridge/presentation-changes.ts';
import { applyCommand, stepWorld } from '../src/sim/engine.ts';
import { addGroundMaterial } from '../src/sim/materials.ts';
import { startBerserk, startFoodBinge, startMurderousRage, startSadWander, startTantrum } from '../src/sim/mental-break.ts';
import { finishMentalBreak,isAggressiveMentalCrisis } from '../src/sim/mental-state.ts';
import { deserializeWorld, serializeWorld, validateWorld } from '../src/sim/serialization.ts';
import { SCHEMA_VERSION, type Pawn, type World } from '../src/sim/types.ts';
import { visitorGroupDanger } from '../src/sim/visitors.ts';
import { AGGRESSIVE_CRISIS_KINDS, crisisBuildings, makeCrisisPacifist, mentalCrisesCamp, type AggressiveCrisisKind } from './helpers/mental-crises-v211.ts';
import { visitorTradeFixture } from './scenarios/visitors.ts';

const starters:Record<AggressiveCrisisKind,(world:World,pawn:Pawn)=>boolean>={tantrum:startTantrum,berserk:startBerserk,'murderous-rage':startMurderousRage};
function camp():World {const world=mentalCrisesCamp();crisisBuildings(world);return world;}
function until(world:World,done:()=>boolean,limit=700):void {
  for(let i=0;i<limit&&!done();i++)stepWorld(world);
  expect(done(),`Missing crisis save boundary at tick ${world.tick}`).toBe(true);expect(validateWorld(world)).toEqual([]);
}
function previous191(source:World):World {
  const old=structuredClone(source);(old as {schemaVersion:number}).schemaVersion=191;
  return old;
}
function neutralMigration(source:World):void {
  const old=previous191(source),saved=JSON.stringify(old),expected=structuredClone(old);
  (expected as {schemaVersion:number}).schemaVersion=SCHEMA_VERSION;
  expect(deserializeWorld(saved)).toEqual(expected);expect(JSON.stringify(old)).toBe(saved);
}

test('strict191 migration changes only the number, preserving old episodes, biography data, off-map owners and frozen archives',()=>{
  const ordinary=camp();makeCrisisPacifist(ordinary.pawns[0]!);neutralMigration(ordinary);
  for(const start of [startSadWander,startFoodBinge]){
    const world=camp();expect(start(world,world.pawns[0]!)).toBe(true);stepWorld(world,2);neutralMigration(world);
    const old=previous191(world),loaded=deserializeWorld(JSON.stringify(old));
    for(let i=0;i<24;i++){stepWorld(world);stepWorld(loaded);}expect(loaded).toEqual(world);
  }
  const scout=camp(),pawn=scout.pawns[0]!;makeCrisisPacifist(pawn);
  addGroundMaterial(scout,'food',2,{x:pawn.x,z:pawn.z+1},'survival-meal');const food=scout.piles.find(p=>p.item==='survival-meal')!;
  expect(applyCommand(scout,{type:'scout-start',pawnId:pawn.id,pileId:food.id,quantity:2}).ok).toBe(true);
  until(scout,()=>!!scout.scout&&'pawn' in scout.scout);neutralMigration(scout);
  const {world:visitors,traderId}=visitorTradeFixture();visitorGroupDanger(visitors,visitors.pawns.find(p=>p.id===traderId)!,'hostile');
  until(visitors,()=>!visitors.pawns.some(p=>p.id===traderId),3500);
  const old=previous191(visitors),archive=JSON.stringify(old.visitors!.departed),loaded=deserializeWorld(JSON.stringify(old));
  expect(JSON.stringify(loaded.visitors!.departed)).toBe(archive);neutralMigration(visitors);stepWorld(loaded,3);expect(JSON.stringify(loaded.visitors!.departed)).toBe(archive);
  const invalid=previous191(ordinary);invalid.rng=0;expect(()=>deserializeWorld(JSON.stringify(invalid))).toThrow(/version 191/);
});

test('actual aggressive approach and attack recovery preserve target clocks, physical travel and RNG on exact continuation',()=>{
  for(const kind of AGGRESSIVE_CRISIS_KINDS){
    const world=camp(),pawn=world.pawns[0]!;expect(starters[kind](world,pawn)).toBe(true);
    until(world,()=>!!pawn.motion&&pawn.motion.end>world.tick||!!pawn.melee?.strike);
    expect(pawn.mental?.crisis?.kind).toBe(kind);const saved=serializeWorld(world),loaded=deserializeWorld(saved);
    expect(loaded).toEqual(world);expect(loaded.pawns[0]!.mental?.crisis).toEqual(pawn.mental?.crisis);expect(loaded.pawns[0]!.motion).toEqual(pawn.motion);
    for(let i=0;i<80;i++){stepWorld(world);stepWorld(loaded);if(i%10===0){expect(loaded).toEqual(world);expect(validateWorld(world)).toEqual([]);}}
    expect(loaded).toEqual(world);
    if(pawn.mental?.crisis){
      const observer=new PresentationChanges();observer.capture(world);const decoder=new SnapshotDecoder(),encoder=new SnapshotEncoder();
      expect(decoder.adopt(structuredClone(encoder.encode(world,0,1))).status).toBe('applied');
      finishMentalBreak(world,pawn);expect(observer.capture(world)).toBe(true);
      const recovered=deserializeWorld(serializeWorld(world));expect(recovered).toEqual(world);expect(validateWorld(recovered)).toEqual([]);
    }
  }
});

test('future kinds and ownership fields are refused under191; malformed current crises fail without throwing from guards',()=>{
  for(const kind of AGGRESSIVE_CRISIS_KINDS){
    const source=camp(),pawn=source.pawns[0]!;expect(starters[kind](source,pawn)).toBe(true);
    const future=previous191(source);expect(()=>deserializeWorld(JSON.stringify(future))).toThrow(/version 191/);
    const cases:Array<(world:World)=>void>=[
      w=>{w.pawns[0]!.mental!.crisis!.age=-30;},
      w=>{Object.assign(w.pawns[0]!.mental!.crisis!,{kind:'future-crisis'});},
      w=>{Object.assign(w.pawns[0]!.mental!.crisis!,{future:true});},
      w=>{Object.assign(w.pawns[0]!.mental!.crisis!,{targetId:'unknown'});},
      w=>{w.pawns[0]!.mental!.crisis!.target={x:-1,z:0};},
      w=>{Object.assign(w.pawns[0]!.mental!.crisis!,{waitUntil:Number.NaN});},
      w=>{Object.assign(w.pawns[0]!.mental!,{crisis:null});},
      w=>{Object.assign(w.pawns[0]!,{mental:null});},
      w=>{w.pawns[0]!.draft={lastActiveTick:w.tick,target:null,queue:[]};},
      w=>{w.pawns[0]!.melee={order:{targetId:w.pawns[1]!.id,startedDowned:false},strike:null};},
    ];
    if(kind==='tantrum')cases.push(w=>{Object.assign(w.pawns[0]!.mental!.crisis!,{nextTargetCore:-1,attempted:'yes'});});
    else if(kind==='berserk')cases.push(w=>{Object.assign(w.pawns[0]!.mental!.crisis!,{jobUntilCore:-1});});
    else cases.push(w=>{Object.assign(w.pawns[0]!.mental!.crisis!,{targetId:null,nextCheckCore:-1});});
    for(const mutate of cases){
      const bad=structuredClone(source);mutate(bad);const before=JSON.stringify(bad);
      expect(()=>validateWorld(bad)).not.toThrow();expect(validateWorld(bad).length).toBeGreaterThan(0);
      expect(()=>deserializeWorld(before)).toThrow();expect(JSON.stringify(bad)).toBe(before);
    }
  }
  const old=previous191(camp());old.pawns[0]!.meleeThreat={attackerId:old.pawns[1]!.id,atCore:old.tick*10};
  expect(()=>deserializeWorld(JSON.stringify(old))).toThrow(/version 191/);
});

test('active material, resource and job identities cannot be forged into an aggressive target',()=>{
  for(const kind of AGGRESSIVE_CRISIS_KINDS){
    const source=camp(),pawn=source.pawns[0]!;
    addGroundMaterial(source,'wood',3,{x:22,z:14});const pileId=source.piles.at(-1)!.id;
    const tree={id:source.nextId++,kind:'tree' as const,x:24,z:14,amount:12};source.resources.push(tree);
    expect(applyCommand(source,{type:'designate',kind:'chop',x:tree.x,z:tree.z}).ok).toBe(true);
    const jobId=source.jobs.at(-1)!.id;expect(starters[kind](source,pawn)).toBe(true);expect(validateWorld(source)).toEqual([]);
    for(const id of [pileId,tree.id,jobId]){
      const bad=structuredClone(source),crisis=bad.pawns[0]!.mental!.crisis!;
      if(!isAggressiveMentalCrisis(crisis))throw new Error('Missing aggressive crisis.');
      crisis.targetId=id;
      // Keep the coupled clocks valid so identity, rather than shape, rejects it.
      if(crisis.kind==='berserk')crisis.jobUntilCore=bad.tick*10+600;
      const before=JSON.stringify(bad);expect(()=>validateWorld(bad)).not.toThrow();
      expect(validateWorld(bad)).toContain(kind==='tantrum'?'Invalid destruction crisis target.':'Invalid violent crisis target.');
      expect(()=>deserializeWorld(before)).toThrow();expect(JSON.stringify(bad)).toBe(before);
    }
  }
});

test('checkpoint and same-tick delta adoption reject crisis corruption atomically and accept the corrected packet',()=>{
  const world=camp(),pawn=world.pawns[0]!;
  const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),checkpoint=structuredClone(encoder.encode(world,0,1,true));
  const badCheckpoint=structuredClone(checkpoint);Object.assign(badCheckpoint.world.pawns[0]!,{mental:{below:[0,0,0],cooldown:0,catharsis:[],crisis:{kind:'future-crisis',age:0,target:null,waitUntil:world.tick}}});
  expect(new SnapshotDecoder().adopt(badCheckpoint).status).toBe('resync');
  const first=decoder.adopt(checkpoint);if(first.status!=='applied')throw new Error('Valid crisis checkpoint was rejected.');
  const frozen=structuredClone(first.world);expect(startTantrum(world,pawn)).toBe(true);
  const delta=structuredClone(encoder.encode(world,0,1));expect(delta.kind).toBe('delta');
  const bad=structuredClone(delta);Object.assign(bad.world.pawns[0]!.mental!.crisis!,{attempted:'corrupt'});
  expect(decoder.adopt(bad).status).toBe('resync');expect(first.world).toEqual(frozen);
  const repaired=decoder.adopt(delta);expect(repaired.status).toBe('applied');if(repaired.status==='applied')expect(repaired.world).toEqual(world);
  expect(first.world).toEqual(frozen);
  const owner=structuredClone(encoder.encode(world,0,1,true));owner.world.pawns[1]!.meleeThreat={attackerId:world.pawns[1]!.id,atCore:world.tick*10};
  expect(new SnapshotDecoder().adopt(owner).status).toBe('resync');
});
