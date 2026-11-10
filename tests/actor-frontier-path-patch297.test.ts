import {describe,expect,it,test} from 'vitest';
import assert from 'node:assert/strict';
import {prepared} from './frontier-runtime-harness';
import {CorePhasePublisher297} from '../src/bridge/core-phase-publisher-297';
import {CorePhaseFrameOwner297} from '../src/bridge/core-phase-owner-297';
import {MotionRecorder} from '../src/bridge/motion-tracks';
import {advanceWorldCore297} from '../src/sim/engine';
import {applyCommand} from '../src/sim/index';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {deserializeCampaign} from '../src/sim/serialization';
import {physicalVisibleCoreMap297,coreMapId297,captureCoreActor297} from '../src/bridge/core-phase-data-297';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import type {World} from '../src/sim/types';
import type {CoreActorProjection297,CorePhaseEnvelope297} from '../src/bridge/core-phase-projection-297';

// Frontier path patches: an actor that advances along its route sends how many
// cells of the path the renderer already holds remain, instead of every cell.
// Real publisher, real engine, real strict reader and frame owner.
function walking(){
 const root=deserializeCampaign(prepared().raw);assert.ok('tiles' in root);
 const local=()=>physicalVisibleCoreMap297(root)!,publisher=new CorePhasePublisher297(),motion=new MotionRecorder(),owner=new CorePhaseFrameOwner297(),encoder=new TerrainJournalSnapshotEncoder();
 const pawn=local().pawns[0]!;
 assert.equal(applyCommand(root,{type:'draft-move',pawnIds:[pawn.id],target:{x:pawn.x+14,z:pawn.z},queue:false}).ok,true);
 motion.capture(local());encoder.encode(local(),0,6,true);
 const seeded=publisher.prepareFull(local(),1,1,motion.snapshot(),coreMapId297(local()),'frontier');publisher.commitFull(seeded,1000);
 owner.adoptFull(structuredClone(local()),1,1,structuredClone(motion.snapshot()),seeded.metadata,6);
 const step=()=>{const result=advanceWorldCore297(root),w=local(),row=result.maps.find(x=>x.mapId===coreMapId297(w))!;assert.ok(row);assert.equal(row.requiresHardFull297,false,'This calm walk needs no hard Full');motion.capture(w);
  publisher.observe({core:result.core,actorsChanged:row.actorsChanged,projectileEvents:row.projectileEvents,requiresFull:false},result.localTickCompleted,1000+result.core);
  if(result.localTickCompleted)publisher.observeMacroActors297(w);};
 /** One actor packet through the wire (structured clone), the strict reader and the frame owner. */
 const publish=()=>{const tx=publisher.preparePhase(local(),motion.snapshot(),6),projection=owner.commit(owner.prepare(structuredClone(tx.packet)));publisher.commitPhase(tx,2000+effectiveCore297(root));return{packet:tx.packet,projection};};
 const touch=()=>publisher.observe({core:effectiveCore297(root),actorsChanged:[pawn.id],projectileEvents:{upserted:[],removed:[]},requiresFull:false},false,3000+effectiveCore297(root));
 return{root,local,pawn,publisher,owner,step,publish,touch};
}
const rowOf=(packet:CorePhaseEnvelope297,id:number)=>packet.actors.find(row=>row.id===id);
const keepOf=(packet:CorePhaseEnvelope297,id:number)=>packet.paths297?.find(row=>row.id===id)?.keep;

test('a walking actor sends its remaining route as a count, and the renderer holds the exact live path',()=>{
 const h=walking(),id=h.pawn.id;let patched=0,complete=0,shortened=0,previous=h.local().pawns[0]!.path.length;
 assert.ok(previous>=10,'The move order planned a real route');
 for(let core=0;core<90;core++){
  h.step();if(!h.publisher.canPublishActors297||!h.publisher.hasPending)continue;
  const live=h.local().pawns[0]!,{packet,projection}=h.publish(),row=rowOf(packet,id);
  // Every actor of the scene has the live path, whatever the wire carried.
  for(const[index,actor]of h.local().pawns.entries())assert.deepEqual(projection.actorScene.humans[index]!.path,actor.path);
  if(!row){assert.equal(keepOf(packet,id),undefined);continue;}
  const keep=keepOf(packet,id);
  if(keep===undefined){complete++;assert.deepEqual(row.fields.path,live.path,'A complete row carries every cell');}
  else{patched++;assert.equal(row.fields.path.length,0,'A patched row carries no cell');assert.equal(keep,live.path.length);if(live.path.length<previous)shortened++;}
  // The renderer sees complete rows only.
  assert.deepEqual(projection.actors.find(r=>r.id===id)!.fields.path,live.path);
  assert.ok(Object.isFrozen(projection.actorScene.humans[0]!.path));
  previous=live.path.length;
 }
 assert.equal(complete,1,'Only the first row after the Full carries the whole route');
 assert.ok(patched>=5&&shortened>=2,`The walk was published as path patches (${patched} patched, ${shortened} shorter)`);
});

test('a replaced route, or a cell edited in place, is sent in full again',()=>{
 const h=walking(),id=h.pawn.id;
 for(let core=0;core<12;core++)h.step();
 assert.equal(keepOf(h.publish().packet,id),undefined,'First row after the Full: complete');
 for(let core=0;core<6;core++)h.step();
 const patched=h.publish();assert.equal(keepOf(patched.packet,id),h.local().pawns[0]!.path.length,'Same route, further along: a count');
 // The same values in new objects, nothing else changed: no row at all.
 const live=h.local().pawns[0]!;live.path=live.path.map(cell=>({...cell}));h.touch();
 assert.equal(rowOf(h.publish().packet,id),undefined,'The renderer already holds these values');
 // A shorter route in new objects is a tail by value only: not the held cells, so the row is complete.
 live.path=live.path.slice(1).map(cell=>({...cell}));h.touch();
 const replaced=h.publish();assert.equal(keepOf(replaced.packet,id),undefined);assert.deepEqual(rowOf(replaced.packet,id)!.fields.path,live.path);
 assert.deepEqual(replaced.projection.actorScene.humans[0]!.path,live.path);
 // A held cell whose coordinates changed is not the copied cell any more.
 live.path.at(-1)!.x+=1;h.touch();
 const edited=h.publish();assert.equal(keepOf(edited.packet,id),undefined);assert.deepEqual(rowOf(edited.packet,id)!.fields.path,live.path);
 assert.deepEqual(edited.projection.actorScene.humans[0]!.path,live.path);
 // A longer route is not a tail either.
 live.path.unshift({x:live.x,z:live.z});h.touch();
 const longer=h.publish();assert.equal(keepOf(longer.packet,id),undefined);assert.deepEqual(longer.projection.actorScene.humans[0]!.path,live.path);
});

// Numeric representation only: no valid Raw/SIM/campaign/Native claim.
function numericWorld(core=200,nextId=100):World{return {schemaVersion:297,tick:Math.floor(core/10),phaseCore297:core%10,width:16,height:16,nextId,tiles:[],pawns:[{id:7,x:2,z:2,state:'idle',moveCooldown:0,planCooldown:0,path:[],jobId:null},{id:8,x:3,z:2,state:'idle',moveCooldown:0,planCooldown:0,path:[],jobId:null}],wildlife:{animals:[{id:20,species:'hare',x:4,z:4,state:'idle',path:[],nextDecision:30}]},mechanoids:[],projectiles:[]} as unknown as World;}
function anchored(){const owner=new CorePhaseFrameOwner297(),world=numericWorld();owner.adoptFull(world,1,1,[],{mapId:0,core:200,projectilesRetained:[],actorMode297:'frontier'},1);return{owner,world};}
const human=(world:World,path:{x:number;z:number}[],x=5)=>captureCoreActor297('human',0,{...world.pawns[0]!,x,path});
function packet(seq:number,fromCore:number,toCore:number,actors:readonly CoreActorProjection297[],extra:Record<string,unknown>={},type:CorePhaseEnvelope297['type']='actor-frontier-297'){return {type,audioCues:[],epoch:1,mapId:0,baseRevision:1,phaseSeq:seq,nextId:100,fromCore,toCore,speed:1 as const,actors,tracks:[],projectiles:{upserted:[],removed:[]},...extra};}

describe('strict reading of frontier path patches',()=>{
 it('rebuilds the tail of the held path and keeps the rebuilt row complete',()=>{
  const {owner,world}=anchored(),route=[{x:6,z:2},{x:7,z:2},{x:8,z:2}];
  owner.commit(owner.prepare(packet(1,200,210,[human(world,route)])));
  const next=owner.commit(owner.prepare(packet(2,210,220,[human(world,[],6)],{paths297:[{id:7,keep:2}]})));
  expect(next.actorScene.humans[0]!.path).toEqual([{x:7,z:2},{x:8,z:2}]);expect(next.actorScene.humans[0]!.x).toBe(6);
  expect(next.actors[0]!.fields.path).toEqual([{x:7,z:2},{x:8,z:2}]);expect(Object.isFrozen(next.actors[0]!.fields.path)).toBe(true);
  const kept=owner.commit(owner.prepare(packet(3,220,230,[human(world,[],6)],{paths297:[{id:7,keep:2}]})));
  expect(kept.actorScene.humans[0]!.path).toEqual([{x:7,z:2},{x:8,z:2}]);
  const empty=owner.commit(owner.prepare(packet(4,230,240,[human(world,[],8)],{paths297:[{id:7,keep:0}]})));
  expect(empty.actorScene.humans[0]!.path).toEqual([]);
 });
 it('refuses a count longer than the held path, leaving the predecessor intact',()=>{
  const {owner,world}=anchored();owner.commit(owner.prepare(packet(1,200,210,[human(world,[{x:6,z:2}])])));
  expect(()=>owner.prepare(packet(2,210,220,[human(world,[],6)],{paths297:[{id:7,keep:2}]}))).toThrow('Core path predecessor mismatch');
  expect(owner.currentCore).toBe(210);
  expect(owner.commit(owner.prepare(packet(2,210,220,[human(world,[],6)],{paths297:[{id:7,keep:1}]}))).actorScene.humans[0]!.path).toEqual([{x:6,z:2}]);
 });
 it.each([
  ['a row that still carries cells',(w:World)=>packet(1,200,210,[human(w,[{x:6,z:2}])],{paths297:[{id:7,keep:1}]})],
  ['an actor without a row in the packet',(w:World)=>packet(1,200,210,[human(w,[])],{paths297:[{id:8,keep:0}]})],
  ['an empty list',(w:World)=>packet(1,200,210,[human(w,[])],{paths297:[]})],
  ['a repeated actor',(w:World)=>packet(1,200,210,[human(w,[])],{paths297:[{id:7,keep:0},{id:7,keep:0}]})],
  ['a negative count',(w:World)=>packet(1,200,210,[human(w,[])],{paths297:[{id:7,keep:-1}]})],
  ['a fractional count',(w:World)=>packet(1,200,210,[human(w,[])],{paths297:[{id:7,keep:.5}]})],
  ['an extra key',(w:World)=>packet(1,200,210,[human(w,[])],{paths297:[{id:7,keep:0,path:[]}]})],
  ['the same-civil phase type',(w:World)=>packet(1,200,205,[human(w,[])],{paths297:[{id:7,keep:0}]},'actor-phase-297')],
 ] as const)('refuses %s',(_name,make)=>{
  const {owner,world}=anchored();expect(()=>owner.prepare(make(world))).toThrow();expect(owner.currentCore).toBe(200);
 });
});
