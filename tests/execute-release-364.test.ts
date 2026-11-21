import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {violentWorkRefusal} from '../src/sim/colonist-backgrounds.ts';
import {capturePrisonTopology} from '../src/sim/prison-space.ts';
import {readAnimalTraining282} from '../src/sim/animal-training-282.ts';
import {bondedAnimalThoughts343} from '../src/sim/first-days-343.ts';
import {animalCarrier} from '../src/sim/animal-rest-state.ts';
import {canAnimalHaul282} from '../src/sim/animal-training-282.ts';
import {executionWanted364,isExecuteRelease364,releaseWildWanted364,RELEASE_WILD_WAIT_TICKS_364} from '../src/sim/execute-release-364.ts';
import {recruitmentUiFixture} from './scenarios/prison-camp.ts';
import {animalHaulingCamp459} from './scenarios/animal-hauling-v459.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';
import type {TraitId} from '../src/sim/traits.ts';

const valid=(w:World)=>expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);
const reload=(w:World)=>deserializeWorld(serializeWorld(w));
function until(w:World,done:()=>boolean,limit:number,what:string){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`${what} by tick ${w.tick}`).toBe(true);}
const blood=(w:World)=>(w.filth?.items??[]).filter(f=>f.kind==='blood').reduce((n,f)=>n+f.thickness,0);

/** Prepared prison: the recruitment checkpoint (a healthy captive in a closed
 * cell), the warden moved out of the cell, every other work disabled. */
function prison(){
  const f=recruitmentUiFixture(),w=f.world,[warden,other,prisoner]=w.pawns as [Pawn,Pawn,Pawn];
  for(const p of [warden,other])for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
  delete warden.background;delete other.background;delete warden.traits;delete other.traits;
  Object.assign(warden,{x:18,z:10});warden.priorities.warden=1;
  valid(w);return {w,warden,other,prisoner};
}

test('execution walks the warden to the prisoner, cuts the neck and kills; the corpse stays, blood and the colonists\' thoughts follow',()=>{
  const {w,warden,other,prisoner}=prison();
  expect(isExecuteRelease364(w.schemaVersion)).toBe(true);expect(violentWorkRefusal(warden)).toBeUndefined();
  expect(executionWanted364(w,warden)).toBe(false);
  expect(applyCommand(w,{type:'prisoner-mode',patientId:prisoner.id,mode:'execute'})).toEqual({ok:true});
  expect(prisoner.prisoner!.mode).toBe('execute');expect(executionWanted364(w,warden)).toBe(true);
  const start={x:warden.x,z:warden.z},before=blood(w);let walked=0,seen=false;
  until(w,()=>{if(warden.ward?.kind==='execute'){seen=true;if(warden.state==='moving')walked++;}return prisoner.state==='dead';},2000,'the execution');
  expect(seen).toBe(true);expect(walked).toBeGreaterThan(3);expect({x:warden.x,z:warden.z}).not.toEqual(start);
  // ExecutionUtility: the neck cut, then death by execution at this tick.
  const record=prisoner.health!;
  expect(record.death).toMatchObject({cause:'execution'});
  expect(record.injuries.filter(i=>i.kind==='execution-cut')).toEqual([expect.objectContaining({part:'neck',severity:1000,bornAt:record.tick})]);
  expect(blood(w)).toBeGreaterThan(before);
  expect(Math.max(Math.abs(warden.x-prisoner.x),Math.abs(warden.z-prisoner.z))).toBeLessThanOrEqual(1);
  expect(w.events.some(e=>e.message===`${warden.name} a exécuté ${prisoner.name}.`)).toBe(true);
  // The body stays where it fell; the warden is free again.
  expect(w.pawns.includes(prisoner)).toBe(true);expect(warden.ward).toBeUndefined();
  // KnowGuestExecuted to the other colonist, not to the executioner; no witness thought.
  expect(other.deathThoughts).toEqual([expect.objectContaining({kind:'guest-executed',otherId:prisoner.id,at:record.death!.tick})]);
  expect(warden.deathThoughts?.some(m=>m.kind==='guest-executed')??false).toBe(false);
  expect(other.deathThoughts!.some(m=>m.kind.startsWith('witnessed'))).toBe(false);
  expect(moodThoughts(w,other).find(t=>t.id==='death-guest-executed')).toMatchObject({offset:-5,label:'Prisonnier exécuté'});
  valid(w);expect(reload(w)).toEqual(w);
  stepWorld(w,30);valid(w);
});

test('Psychopath, Bloodlust and Cannibal nullify the thought; a Bloodlust executioner enjoys the kill',()=>{
  for(const trait of ['psychopath','bloodlust','cannibal'] as TraitId[]){
    const {w,warden,other,prisoner}=prison();other.traits=[trait];valid(w);
    applyCommand(w,{type:'prisoner-mode',patientId:prisoner.id,mode:'execute'});
    until(w,()=>prisoner.state==='dead',2000,`the execution (${trait})`);
    expect(other.deathThoughts?.some(m=>m.kind==='guest-executed')??false,trait).toBe(false);
    expect(warden.deathThoughts).toBeUndefined();valid(w);
  }
  const {w,warden,other,prisoner}=prison();warden.traits=['bloodlust'];valid(w);
  applyCommand(w,{type:'prisoner-mode',patientId:prisoner.id,mode:'execute'});
  until(w,()=>prisoner.state==='dead',2000,'the bloodlust execution');
  expect(warden.deathThoughts).toEqual([expect.objectContaining({kind:'killed-humanlike-bloodlust',otherId:prisoner.id})]);
  expect(moodThoughts(w,warden).find(t=>t.id==='death-killed-humanlike-bloodlust')).toMatchObject({offset:12});
  expect(other.deathThoughts).toEqual([expect.objectContaining({kind:'guest-executed'})]);valid(w);
});

test('a warden incapable of violence never executes and the mode warns; a mode change interrupts the walk',()=>{
  const {w,warden,prisoner}=prison();warden.background={childhood:'quiet-child'};
  expect(violentWorkRefusal(warden)).toBeDefined();
  expect(applyCommand(w,{type:'prisoner-mode',patientId:prisoner.id,mode:'execute'})).toEqual({ok:true});
  expect(w.events.at(-1)?.message).toContain('Aucun geôlier capable de violence');
  stepWorld(w,300);expect(prisoner.state).not.toBe('dead');expect(warden.ward?.kind==='execute').toBe(false);valid(w);
  const second=prison();
  applyCommand(second.w,{type:'prisoner-mode',patientId:second.prisoner.id,mode:'execute'});
  until(second.w,()=>second.warden.ward?.kind==='execute'&&second.warden.path.length>0,200,'the walk');
  expect(applyCommand(second.w,{type:'prisoner-mode',patientId:second.prisoner.id,mode:'maintain'})).toEqual({ok:true});
  expect(second.warden.ward).toBeUndefined();stepWorld(second.w,300);
  expect(second.prisoner.state).not.toBe('dead');valid(second.w);
  // A colonist held in detention keeps the maintain/release choice only.
  const third=prison();third.prisoner.faction='colony';
  expect(applyCommand(third.w,{type:'prisoner-mode',patientId:third.prisoner.id,mode:'execute'}).ok).toBe(false);
});

test('a save in the middle of the execution walk reloads strictly and continues identically',()=>{
  const {w,warden,prisoner}=prison();
  applyCommand(w,{type:'prisoner-mode',patientId:prisoner.id,mode:'execute'});
  until(w,()=>warden.ward?.kind==='execute'&&warden.path.length>2,200,'the walk');
  valid(w);const text=serializeWorld(w),copy=deserializeWorld(text);expect(serializeWorld(copy)).toBe(text);
  // Strict shapes: a future field or a broken task is refused.
  const bad=JSON.parse(text);bad.pawns[0].ward.progress=1;expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow();
  const wrong=JSON.parse(text);wrong.pawns[2].prisoner.mode='maintain';expect(()=>deserializeWorld(JSON.stringify(wrong))).toThrow();
  until(w,()=>prisoner.state==='dead',2000,'the original execution');
  const twin=copy.pawns.find(p=>p.id===prisoner.id)!;until(copy,()=>twin.state==='dead',2000,'the reloaded execution');
  stepWorld(w,5);stepWorld(copy,5);expect(serializeWorld(copy)).toBe(serializeWorld(w));
});

/** Prepared release: the Labrador camp, the starter bond and Obedience, a
 * learned Haul, and the handler as master. */
function kennel(){
  const f=animalHaulingCamp459(),w=f.world,h=f.handler,a=f.animal;
  a.startingPet={revision:1,name:'Pistache',bondedPawnId:h.id,masterId:h.id,obedience:{steps:3,wanted:true}};
  expect(applyCommand(w,{type:'animal-training',animalId:a.id,skill:'haul',wanted:true}).ok).toBe(true);
  a.training!.haul={steps:7,learned:true,wanted:true};
  valid(w);return {w,h,a};
}

test('a tame, trained, bonded animal is released outside after the handler waits with it; the bond hurts; Core keeps the inert data',()=>{
  const {w,h,a}=kennel();
  expect(readAnimalTraining282(a,'obedience').learned).toBe(true);expect(bondedAnimalThoughts343(w,h)).toHaveLength(1);
  const topology=capturePrisonTopology(w).at(a.x,a.z);expect(topology).toMatchObject({kind:'space',touchesMapEdge:true});
  expect(releaseWildWanted364(w,h)).toBe(false);
  expect(applyCommand(w,{type:'release-wild',animalId:a.id,enabled:true})).toEqual({ok:true});
  expect(w.events.at(-1)?.message).toBe(`Pistache est lié à ${h.name} : le relâcher lui causera de la peine.`);
  expect(a.domestic!.release364).toBe(true);expect(releaseWildWanted364(w,h)).toBe(true);valid(w);
  let longest=0,carried=false;
  until(w,()=>{const t=h.animalHandling;if(t?.kind==='release'){longest=Math.max(longest,t.progress);if(t.phase==='carry')carried=true;}return !a.domestic;},3000,'the release');
  expect(carried).toBe(false);expect(longest).toBe(RELEASE_WILD_WAIT_TICKS_364-1);
  expect(h.animalHandling).toBeUndefined();
  expect(Math.max(Math.abs(h.x-a.x),Math.abs(h.z-a.z))).toBeLessThanOrEqual(1);
  // Wild again: no faction, bed, area or designation; no hauling.
  expect(a.domestic).toBeUndefined();expect(a.taming).toBeUndefined();expect(a.animalMapAreas287).toBeUndefined();expect(a.mapBed).toBeUndefined();
  expect(canAnimalHaul282(w,a)).toBe(false);expect(bondedAnimalThoughts343(w,h)).toEqual([]);
  // SetFaction(null) keeps the training tracker, master and bond as data.
  expect(a.training?.haul).toMatchObject({learned:true});expect(a.training?.masterId).toBe(h.id);expect(a.startingPet?.bondedPawnId).toBe(h.id);
  // BondedAnimalReleased: -5 for fifteen days, one per animal.
  expect(h.roomMemories?.filter(m=>m.kind==='bonded-animal-released')).toEqual([expect.objectContaining({otherId:a.id})]);
  expect(moodThoughts(w,h).find(t=>t.id==='mood350-bonded-animal-released')).toMatchObject({offset:-5,label:'Compagnon lié relâché'});
  expect(w.events.some(e=>e.message===`${h.name} a relâché Pistache dans la nature.`)).toBe(true);
  valid(w);expect(reload(w)).toEqual(w);
  stepWorld(w,200);valid(w);expect(h.animalHandling).toBeUndefined();expect(a.domestic).toBeUndefined();
  // A psychopath master is not affected.
  const second=kennel();second.h.traits=['psychopath'];valid(second.w);
  applyCommand(second.w,{type:'release-wild',animalId:second.a.id,enabled:true});
  until(second.w,()=>!second.a.domestic,3000,'the psychopath release');
  expect(second.h.roomMemories?.some(m=>m.kind==='bonded-animal-released')??false).toBe(false);valid(second.w);
});

test('an animal shut in a room is carried to the nearest outside cell, set down, then released; a save mid-carry continues identically',()=>{
  const {w,h,a}=kennel();
  // A closed room around the animal, door on its north side.
  for(let x=10;x<=14;x++)for(let z=10;z<=14;z++){
    if(x>10&&x<14&&z>10&&z<14)continue;
    if(x===12&&z===10)w.structures.push({id:w.nextId++,kind:'door',x,z,orientation:0,footprint:'standard',material:'wood',door:newDoorState(w.tick)});
    else w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard',material:'wood'});
  }
  Object.assign(a,{x:12,z:12,path:[]});delete a.motion;delete a.domestic!.bedId;delete a.mapBed;Object.assign(h,{x:6,z:6});
  refreshStock(w);valid(w);
  expect(capturePrisonTopology(w).at(12,12)).toMatchObject({kind:'space',touchesMapEdge:false});
  applyCommand(w,{type:'release-wild',animalId:a.id,enabled:true});
  until(w,()=>h.animalHandling?.kind==='release'&&h.animalHandling.phase==='carry',3000,'the pickup');
  expect(animalCarrier(w,a.id)).toBe(h);expect(h.animalHandling!.drop364).toEqual({x:12,z:9});
  valid(w);const text=serializeWorld(w),copy=deserializeWorld(text);expect(serializeWorld(copy)).toBe(text);
  until(w,()=>!a.domestic,3000,'the carried release');
  expect({x:a.x,z:a.z}).toEqual({x:12,z:9});expect(capturePrisonTopology(w).at(a.x,a.z)).toMatchObject({touchesMapEdge:true});
  const twin=copy.wildlife!.animals.find(x=>x.id===a.id)!;until(copy,()=>!twin.domestic,3000,'the reloaded release');
  stepWorld(w,3);stepWorld(copy,3);expect(serializeWorld(copy)).toBe(serializeWorld(w));valid(w);
});

test('an interrupted carry sets the animal down where it is, still a colony animal',()=>{
  const {w,h,a}=kennel();
  for(let x=10;x<=14;x++)for(let z=10;z<=14;z++){
    if(x>10&&x<14&&z>10&&z<14)continue;
    if(x===12&&z===10)w.structures.push({id:w.nextId++,kind:'door',x,z,orientation:0,footprint:'standard',material:'wood',door:newDoorState(w.tick)});
    else w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard',material:'wood'});
  }
  Object.assign(a,{x:12,z:12,path:[]});delete a.motion;delete a.domestic!.bedId;delete a.mapBed;Object.assign(h,{x:6,z:6});refreshStock(w);
  applyCommand(w,{type:'release-wild',animalId:a.id,enabled:true});
  until(w,()=>h.animalHandling?.phase==='carry'&&h.animalHandling.drop364!==undefined&&(h.x!==12||h.z!==12),3000,'the carry');
  expect(applyCommand(w,{type:'release-wild',animalId:a.id,enabled:false})).toEqual({ok:true});
  expect(h.animalHandling).toBeUndefined();expect(animalCarrier(w,a.id)).toBeUndefined();
  expect(a.domestic).toBeDefined();expect(a.domestic!.release364).toBeUndefined();expect({x:a.x,z:a.z}).toEqual({x:h.x,z:h.z});
  stepWorld(w,50);valid(w);expect(a.domestic).toBeDefined();
});

test('release and slaughter designations replace each other, like the Core designators',()=>{
  const {w,a}=kennel();
  expect(applyCommand(w,{type:'slaughter',animalId:a.id,enabled:true})).toEqual({ok:true});
  expect(applyCommand(w,{type:'release-wild',animalId:a.id,enabled:true})).toEqual({ok:true});
  expect(a.domestic!.slaughter).toBeUndefined();expect(a.domestic!.release364).toBe(true);valid(w);
  expect(applyCommand(w,{type:'slaughter',animalId:a.id,enabled:true})).toEqual({ok:true});
  expect(a.domestic!.release364).toBeUndefined();expect(a.domestic!.slaughter).toBe(true);valid(w);
  // Both at once is refused in a save.
  const both=JSON.parse(serializeWorld(w));const animal=both.wildlife.animals.find((x:{id:number})=>x.id===a.id);animal.domestic.release364=true;
  expect(()=>deserializeWorld(JSON.stringify(both))).toThrow();
  // A wild animal cannot be designated.
  const wild=kennel();delete wild.a.domestic;delete wild.a.startingPet;delete wild.a.training;
  expect(applyCommand(wild.w,{type:'release-wild',animalId:wild.a.id,enabled:true}).ok).toBe(false);
});

test('at 363 and below the mode, the designation and their tasks do not exist; a 363 or 362 save migrates by number only',()=>{
  // In a 363 world the commands are refused and no job is planned.
  const {w,warden,prisoner}=prison();w.schemaVersion=363 as typeof SCHEMA_VERSION;
  expect(applyCommand(w,{type:'prisoner-mode',patientId:prisoner.id,mode:'execute'}).ok).toBe(false);
  prisoner.prisoner!.mode='execute';expect(executionWanted364(w,warden)).toBe(false);prisoner.prisoner!.mode='maintain';
  const k=kennel();k.w.schemaVersion=363 as typeof SCHEMA_VERSION;
  expect(applyCommand(k.w,{type:'release-wild',animalId:k.a.id,enabled:true}).ok).toBe(false);
  k.a.domestic!.release364=true;expect(releaseWildWanted364(k.w,k.h)).toBe(false);delete k.a.domestic!.release364;
  // A clean current save relabelled 363 or 362 migrates by number only.
  for(const fixture of [prison().w,kennel().w]){
    const plain=serializeWorld(fixture);
    for(const version of [363,362])expect(serializeWorld(deserializeWorld(asOldSchema(plain,version)))).toBe(asNumberOnly(plain,version));
    const migrated=deserializeWorld(asOldSchema(plain,363));stepWorld(migrated,20);valid(migrated);
  }
  // Each 364 state is refused in a 363 save.
  const ex=prison();applyCommand(ex.w,{type:'prisoner-mode',patientId:ex.prisoner.id,mode:'execute'});
  until(ex.w,()=>ex.warden.ward?.kind==='execute',200,'the execution task');
  const walking=JSON.parse(asOldSchema(serializeWorld(ex.w),363));expect(()=>deserializeWorld(JSON.stringify(walking))).toThrow();
  const modeOnly=JSON.parse(asOldSchema(serializeWorld(prison().w),363));modeOnly.pawns[2].prisoner.mode='execute';
  expect(()=>deserializeWorld(JSON.stringify(modeOnly))).toThrow();
  until(ex.w,()=>ex.prisoner.state==='dead',2000,'the execution');valid(ex.w);
  const dead=JSON.parse(asOldSchema(serializeWorld(ex.w),363));expect(()=>deserializeWorld(JSON.stringify(dead))).toThrow();
  const rel=kennel();applyCommand(rel.w,{type:'release-wild',animalId:rel.a.id,enabled:true});
  const designated=JSON.parse(asOldSchema(serializeWorld(rel.w),363));expect(()=>deserializeWorld(JSON.stringify(designated))).toThrow();
  until(rel.w,()=>!rel.a.domestic,3000,'the release');
  const memory=JSON.parse(asOldSchema(serializeWorld(rel.w),363));expect(()=>deserializeWorld(JSON.stringify(memory))).toThrow();
});
