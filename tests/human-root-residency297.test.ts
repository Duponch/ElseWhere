import {SCHEMA_VERSION} from '../src/sim/types.ts';
import {expect,test} from 'vitest';
import type {BufferAttribute,InterleavedBufferAttribute} from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import type {World} from '../src/sim/types';
import {PawnLayer} from '../src/render/PawnLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {ownActorPlaybackWorld435} from '../src/render/ActorPlayback435';

/** Declared presentation inputs. Both real PawnLayers execute the same native
 * endpoint/pose code; the reference bypasses only the new terminal gate. No
 * simulation tick, render submission or whole-save qualification is inferred. */
function fixture(){
 const seed=createWorld(379,20,20);seed.schemaVersion=SCHEMA_VERSION;seed.tick=100;seed.resources=[];seed.jobs=[];seed.structures=[];seed.piles=[];delete seed.wildlife;
 seed.pawns=seed.pawns.slice(0,2);seed.pawns.forEach((pawn,index)=>{Object.assign(pawn,{x:8+index,z:8,state:'idle',path:[],motion:null,jobId:undefined,need:null});delete pawn.body;delete pawn.melee;});
 function one(reference:boolean){
  const world:World=structuredClone(seed),layer=new PawnLayer(),timeline=new MotionTimeline();ownActorPlaybackWorld435(world,true);
  timeline.adopt(world.tick,1,[],0,true,true);layer.update(world,1,true);
  if(reference){const native:unknown=Reflect.get(layer,'springPose297');if(typeof native!=='function')throw Error('Native spring path missing');Reflect.set(layer,'springPose297',(...args:unknown[])=>{args[8]=false;return Reflect.apply(native,layer,args);});}
  return{world,layer,timeline};
 }
 const reference=one(true),candidate=one(false),both=[reference,candidate];
 const capture=(layer:PawnLayer)=>{
  const geometry=layer.feedbackSource!;
  return['aFrom','aTo','aTravel','aMotion'].map(name=>{const attribute=geometry.getAttribute(name) as BufferAttribute|InterleavedBufferAttribute,array=attribute.array;return{name,bytes:Array.from(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)),version:'version'in attribute?attribute.version:attribute.data.version};});
 };
 function frame(tick:number,dt=1/240,speed=1){
  for(const h of both){h.timeline.tick=tick;h.layer.blend.value=1;h.layer.time.value=tick/6%(2*Math.PI);h.layer.updateTravel(h.world,h.timeline,dt,speed);h.layer.presentAnimations();}
  expect(capture(candidate.layer)).toEqual(capture(reference.layer));
  expect(candidate.layer.time.value).toBe(reference.layer.time.value);expect(candidate.layer.travelTime.value).toBe(reference.layer.travelTime.value);
 }
 function phase(mutate:(world:World)=>void,indices:number[]){for(const h of both){mutate(h.world);h.layer.adoptPhase297(h.world,indices);}}
 function full(mutate:(world:World)=>void,reset=false){for(const h of both){mutate(h.world);h.layer.update(h.world,1,reset);}}
 return{reference,candidate,both,frame,phase,full,x:()=>candidate.layer.feedbackSource!.getAttribute('aFrom').getX(0),dispose(){for(const h of both)h.layer.dispose();}};
}

test('stationary human roots retain exact terminal outputs while live cosmetic clocks and frames continue',()=>{
 const f=fixture();try{
  const before=JSON.stringify(f.candidate.world);
  for(let frame=0;frame<160;frame++)f.frame(100+frame/400);
  const metrics=f.candidate.layer.actorPlaybackMetrics435().rootUpdates,reference=f.reference.layer.actorPlaybackMetrics435().rootUpdates;
  expect(metrics.retained).toBeGreaterThan(250);expect(metrics.evaluations).toBeLessThan(10);expect(reference.evaluations).toBe(320);
  expect(f.candidate.layer.time.value).toBeGreaterThan(100/6%(2*Math.PI));expect(JSON.stringify(f.candidate.world)).toBe(before);
 }finally{f.dispose();}
});

test('confirmed edge capture, exact residual convergence, pause and a larger coefficient wake the same recurrence',()=>{
 const f=fixture();try{
  for(let n=0;n<10;n++)f.frame(100+n*.01);
  f.phase(world=>{const pawn=world.pawns[0]!;pawn.x=10; pawn.state='moving';pawn.motion={from:{x:8,z:8},to:{x:10,z:8},start:101,end:103};},[0]);
  for(const h of f.both)h.timeline.tracks.set(h.world.pawns[0]!.id,[h.world.pawns[0]!.motion!]);
  for(let n=0;n<500;n++)f.frame(100.5+n*.01);
  f.phase(world=>{world.pawns[0]!.state='idle';world.pawns[0]!.motion=null;},[0]);
  for(const h of f.both)h.timeline.tracks.clear();
  f.frame(106); // Establish the real stop/approach interval before holding it.
  for(let n=0;n<1200;n++)f.frame(110,1/240,1);
  const still=f.x(),retained=f.candidate.layer.actorPlaybackMetrics435().rootUpdates.retained;expect(retained).toBeGreaterThan(500);
  for(let n=0;n<10;n++)f.frame(110,1/240,0);expect(f.x()).toBe(still);
  // The previous Float32 recurrence can be stalled slightly short of 10 at
  // alpha .0225. Raising alpha to .81 must move it again, without snapping.
  f.frame(110,.05,3);expect(f.x()).not.toBe(still);
  for(let n=0;n<20;n++)f.frame(110,1/240,1);
  f.frame(110,1/240,6);expect(f.x()).toBe(10);
  f.frame(1024.1,1/240,1);f.frame(1024.2,1/240,1);
 }finally{f.dispose();}
});

test('a newly confirmed future hit wakes a stationary victim and remains pending until its real playhead',()=>{
 const f=fixture();try{
  for(let n=0;n<10;n++)f.frame(100);
  const rest=f.x();
  f.phase(world=>{const attacker=world.pawns[1]!,victim=world.pawns[0]!;attacker.melee={order:null,strike:{targetId:victim.id,atCore:1020,untilCore:1065,tool:'left-fist',outcome:'hit'}};},[1]);
  f.frame(100.1);f.frame(101);f.frame(101.9);expect(f.x()).toBe(rest);
  f.frame(102);expect(Math.abs(f.x()-rest)).toBeGreaterThan(.1);expect(f.candidate.layer.actorPlaybackMetrics435().rootUpdates.hitWakes).toBe(1);
  for(let n=0;n<80;n++)f.frame(102+n*.05);
  expect(f.x()).toBe(rest);expect(f.candidate.layer.actorPlaybackMetrics435().rootUpdates.retained).toBeGreaterThan(20);
 }finally{f.dispose();}
});

test('hidden-to-visible Full retargeting and actor slot replacement revoke the exact terminal root',()=>{
 const f=fixture();try{
  for(let n=0;n<12;n++)f.frame(100);
  f.full(world=>{const pawn=world.pawns[0]!;pawn.state='dead';pawn.body={observedAt:world.tick,lostAt:world.tick};});
  f.frame(100.2);f.frame(100.3);expect(f.candidate.layer.feedbackSource!.getAttribute('aFrom').getY(0)).toBeLessThan(-100);
  f.full(world=>{const pawn=world.pawns[0]!;delete pawn.body;pawn.state='idle';pawn.x=12;pawn.z=11;});
  for(let n=0;n<400;n++)f.frame(101+n*.002,1/240,n<50?1:6);
  expect(f.x()).toBe(12);expect(f.candidate.layer.feedbackSource!.getAttribute('aFrom').getY(0)).toBeGreaterThan(-100);
  f.full(world=>{const pawn=world.pawns[0]!;pawn.id=world.nextId++;pawn.x=4;pawn.z=6;},true);
  f.frame(102,0,0);expect(f.x()).toBe(4);f.frame(102.1);f.frame(102.2);
 }finally{f.dispose();}
});
