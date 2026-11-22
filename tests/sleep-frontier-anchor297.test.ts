import {expect,test} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {advanceWorldCore297} from '../src/sim/engine';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {bedSlotBodyCenter} from '../src/sim/bed-slots';
import {CorePhasePublisher297} from '../src/bridge/core-phase-publisher-297';
import {CorePhaseFrameOwner297} from '../src/bridge/core-phase-owner-297';
import {coreMapId297} from '../src/bridge/core-phase-data-297';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {SnapshotDecoder} from '../src/bridge/snapshots';
import {MotionRecorder} from '../src/bridge/motion-tracks';
import type {CorePhaseTypedProjection297} from '../src/bridge/core-phase-projection-297';
import {PawnLayer,bedLyingOffset} from '../src/render/PawnLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {ownActorPlaybackWorld435} from '../src/render/ActorPlayback435';
import {POSE_SLEEP} from '../src/bridge/actor-phase-dependencies-297';
import {WORLD_SCALE} from '../src/world/scale';
import {TICKS_PER_SECOND} from '../src/sim/types';

// Public already-played Whole, never the human campaign or the QA mission.
// No actor, bed, need, clock, schema, allocator or RNG is authored or repaired.
// This is a real CPU renderer/publisher contract, not Native/GPU/FPS evidence.
test('a real calm macro frontier preserves an already sleeping original bed anchor at x3 and x6',async()=>{
 const raw=readFileSync(new URL('../public/test-saves/v386/les-aulnes-integrees.json',import.meta.url));
 assert.equal(createHash('sha256').update(raw).digest('hex'),'dfd9302647b4d1cabaa8760a150209c6804a788f48a0b0596660318b4d1707ee');
 const world=deserializeWorld(raw.toString('utf8'));
 assert.equal(world.schemaVersion,297);assert.deepEqual(validateWorld(world),[]);
 const sleeperId=19871,bedId=19938,original=world.pawns.find(p=>p.id===sleeperId)!;
 assert.ok(original);assert.equal(original.name,'Noé');assert.equal(original.state,'sleeping');
 assert.equal(original.need?.kind,'sleep');assert.equal(original.need?.kind==='sleep'&&original.need.bedId,bedId);
 const bed=world.structures.find(s=>s.id===bedId)!;assert.ok(bed);assert.equal(bed.kind,'bed');
 const body=bedSlotBodyCenter(bed,0)!;assert.ok(body);
 // The head rests at the bed's head end (22 November 2026): the root sits toward the foot.
 const shift=bedLyingOffset(bed,new PawnLayer().lieHeadExtent),center={x:body.x+shift.x,z:body.z+shift.z};
 const startCore=effectiveCore297(world),publisher=new CorePhasePublisher297(),owner=new CorePhaseFrameOwner297();
 const encoder=new TerrainJournalSnapshotEncoder(),decoder=new SnapshotDecoder(),recorder=new MotionRecorder();
 const layer=new PawnLayer(),timeline=new MotionTimeline(),owned=new Set<CorePhaseTypedProjection297['world']>();
 let first=true,current:CorePhaseTypedProjection297|undefined,lastRenderAt=performance.now();
 const draw=(projection:CorePhaseTypedProjection297,speed:3|6)=>{
  const now=performance.now(),dt=Math.max(0,(now-lastRenderAt)/1000);lastRenderAt=now;
  layer.time.value=(timeline.tick/TICKS_PER_SECOND)%(Math.PI*2);
  layer.updateTravel(projection.world,timeline,dt,speed,projection.actorScene);
 };
 const full=(speed:3|6)=>{
  recorder.capture(world);const tracks=recorder.snapshot(),packet=encoder.encode(world,0,speed,true);
  const adopted=decoder.adopt(structuredClone(packet));assert.equal(adopted.status,'applied');
  if(adopted.status!=='applied')throw Error('Actual public Whole codec refused its own current publication');
  const prepared=publisher.prepareFull(world,packet.epoch,packet.revision,tracks,coreMapId297(world),'frontier');
  publisher.commitFull(prepared,performance.now());
  current=owner.adoptFull(adopted.world,packet.epoch,packet.revision,tracks,prepared.metadata,speed,first);
  ownActorPlaybackWorld435(current.world,true);owned.add(current.world);
  layer.update(current.world,1,first);
  timeline.adopt(current.core/10,speed,current.tracks,performance.now(),first,true,true);first=false;
  return current;
 };
 const fields=(projection:CorePhaseTypedProjection297)=>{
  const index=projection.actorScene.humans.findIndex(p=>p.id===sleeperId);assert.ok(index>=0);
  const g=layer.feedbackSource!;assert.ok(g);
  return{index,from:g.getAttribute('aFrom'),to:g.getAttribute('aTo'),motion:g.getAttribute('aMotion')};
 };
 const expectBed=(projection:CorePhaseTypedProjection297,label:string,soft=false)=>{
  const f=fields(projection),check=soft?expect.soft:expect;
  for(const [kind,a]of [['from',f.from],['to',f.to]]as const){
   check(a.getX(f.index),`${label}: ${kind}.x`).toBeCloseTo(center.x,5);
   check(a.getY(f.index),`${label}: ${kind}.y`).toBeCloseTo(WORLD_SCALE.bedSurfaceHeight,5);
   check(a.getZ(f.index),`${label}: ${kind}.z`).toBeCloseTo(center.z,5);
   check(Math.sin(a.getW(f.index)),`${label}: ${kind}.yaw sin`).toBeCloseTo(Math.sin(bed.orientation*Math.PI/2),5);
   check(Math.cos(a.getW(f.index)),`${label}: ${kind}.yaw cos`).toBeCloseTo(Math.cos(bed.orientation*Math.PI/2),5);
  }
  check(f.motion.getZ(f.index),`${label}: sleeping rig`).toBe(POSE_SLEEP);
  check(f.motion.getX(f.index),`${label}: no fabricated walk while sleeping`).toBe(0);
 };
 try{
  draw(full(3),3);expectBed(current!,'initial actual Full');
  for(const speed of [3,6]as const){
   // Re-anchor the same monotonically played World; no rollback or fixture reset.
   draw(full(speed),speed);
   let phase:CorePhaseTypedProjection297|undefined;
   for(let n=0;n<100&&!phase;n++){
    const step=advanceWorldCore297(world),row=step.maps.find(r=>r.mapId===coreMapId297(world));assert.ok(row);
    recorder.capture(world);
    publisher.observe({core:step.core,actorsChanged:row.actorsChanged,projectileEvents:row.projectileEvents,requiresFull:row.requiresHardFull297},step.localTickCompleted,performance.now());
    if(step.localTickCompleted)publisher.observeMacroActors297(world);
    if(publisher.allocatorNeedsFull(world)||publisher.terrainNeedsFull297(world))publisher.requestFull();
    if(step.localTickCompleted&&publisher.canPublishActors297){
     const prepared=publisher.preparePhase(world,recorder.snapshot(),speed);
     assert.equal(prepared.packet.type,'actor-frontier-297');assert.equal(prepared.packet.toCore%10,0);
     const sleeperRow=prepared.packet.actors.find(a=>a.kind==='human'&&a.id===sleeperId);assert.ok(sleeperRow,'Real calm macro must capture this original sleeper without manual dirty input');
     const staged=owner.prepare(prepared.packet);publisher.commitPhase(prepared,performance.now());phase=owner.commit(staged);
    }else if(!publisher.canPublishActors297){draw(full(speed),speed);}
   }
   assert.ok(phase,'No genuine calm macro within the bounded same-World run; do not fake its input');
   const pawn=phase.actorScene.humans.find(p=>p.id===sleeperId)!;
   assert.equal(pawn.state,'sleeping');assert.equal(pawn.need?.kind==='sleep'&&pawn.need.bedId,bedId);
   const sourceBefore=serializeWorld(world),fullBefore=JSON.stringify(phase.world);
   const changed=phase.actors.filter(a=>a.kind==='human').map(a=>a.index);
   layer.adoptPhase297(phase.world,changed,phase.actorScene,new Set(phase.actors.map(a=>a.id)));
   timeline.adopt(phase.core/10,speed,phase.tracks,performance.now(),false,true,true);
   // A real wall wait consumes only received history; never assign timeline.tick.
   const deadline=performance.now()+2000;
   while(timeline.tick<phase.core/10-1e-9&&performance.now()<deadline){await new Promise(resolve=>setTimeout(resolve,2));timeline.advance(performance.now());}
   assert.ok(Math.abs(timeline.tick-phase.core/10)<1e-9,'Presentation reached its actual received frontier');
   draw(phase,speed);expectBed(phase,`x${speed} real calm macro phase`,true);
   assert.equal(serializeWorld(world),sourceBefore,'Renderer did not modify the played World');
   assert.equal(JSON.stringify(phase.world),fullBefore,'Actor-only rendering did not modify its authentic Full anchor');
   // The next real Full must retain the same independently resolved bed target.
   const restored=full(speed),f=fields(restored);
   expect(f.to.getX(f.index),'Full bed x').toBeCloseTo(center.x,5);
   expect(f.to.getY(f.index),'Full bed y').toBeCloseTo(WORLD_SCALE.bedSurfaceHeight,5);
   expect(f.to.getZ(f.index),'Full bed z').toBeCloseTo(center.z,5);
   expect(f.motion.getX(f.index),'Full keeps sleeping motion off').toBe(0);
  }
  assert.ok(effectiveCore297(world)>startCore,'Actual Engine progression was retained');
  assert.deepEqual(validateWorld(world),[]);
 }finally{for(const w of owned)ownActorPlaybackWorld435(w,false);layer.dispose();}
},120000);
