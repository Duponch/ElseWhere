import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {uniform} from 'three/tsl';
import {createWorld} from '../src/sim/engine';
import type {Job,World} from '../src/sim/types';
import type {CoreHumanPose297} from '../src/bridge/core-phase-projection-297';
import {humanWorkContact297} from '../src/bridge/actor-phase-dependencies-297';
import * as contacts from '../src/bridge/actor-phase-dependencies-297';
import {DoorLayer} from '../src/render/DoorLayer';
import {PawnLayer} from '../src/render/PawnLayer';
import {ActionFeedbackLayer} from '../src/render/ActionFeedbackLayer';
import {ActionParticleLayer} from '../src/render/ActionParticleLayer';
import {harness} from './resident-presentation-fixtures-v427';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {ownActorPlaybackWorld435} from '../src/render/ActorPlayback435';
import {newDoorState,doorOrientations} from '../src/sim/door-rules';
import {penBoundaryAxes} from '../src/render/pen-parts';
import * as furniture from '../src/render/furniture-motion';
import * as apparel from '../src/render/character-apparel';
import * as equipment from '../src/render/character-equipment';

// Narrow renderer ownership fixtures. These compare real consumer buffers to
// their exhaustive historical consumers, not Native admission or physical FPS.
function fixture(){const w=createWorld(37958,32,32);w.tiles=w.tiles.map(()=>({terrain:'soil'}));w.resources=[];w.piles=[];w.packed=[];w.structures=[];w.jobs=[];w.tick=20;w.phaseCore297=0;if(w.wildlife)w.wildlife.animals=[];
 for(const [i,p]of w.pawns.entries()){p.state='idle';p.jobId=null;p.path=[];p.motion=null;p.x=8+i;p.z=8;}return w;}
function bytes(layer:PawnLayer){const g=layer.feedbackSource!;return Object.fromEntries(['aFrom','aTo','aTravel','aMotion','aCargo','aTint','aEquipment','aShape','aSkin','aHair','aBodyBlood'].map(name=>{const a=g.getAttribute(name);return[name,Array.from(a instanceof THREE.InterleavedBufferAttribute?a.data.array:a.array)];}));}
function doorBytes(layer:DoorLayer){return{matrix:Array.from(layer.mesh.instanceMatrix.array),colors:Array.from(layer.mesh.colorBuffer.array),...Object.fromEntries(['doorCurrent','doorPrevious','doorShift'].map(name=>[name,Array.from(layer.mesh.geometry.getAttribute(name).array)]))};}

test('phase door reversals rewrite only their two segments and match exhaustive leaves through reset and deferred upload',()=>{
 const w=fixture(),native=new DoorLayer(),literal=new DoorLayer();w.structures=[8,14].map(x=>({id:w.nextId++,kind:'door',material:'wood',orientation:0,footprint:'standard',x,z:8,door:newDoorState(w.tick)}));ownActorPlaybackWorld435(w,true);
 const axes=doorOrientations(w),gates=penBoundaryAxes(w),all=new Map<number,NonNullable<World['structures'][number]['door']>>();
 try{
  native.updateNative(w,false,true,w.structures,axes,gates);literal.updateNative(w,false,true,w.structures,axes,gates);const matrices=native.mesh.instanceMatrix.version;
  const id=w.structures[1]!.id;
  for(const [at,open,from]of [[20.1,true,0],[20.4,false,.3],[20.7,true,.2]] as const){
   const state={...w.structures[1]!.door!,open,from,changedAt:at};all.set(id,state);expect(native.adoptPhase297(w,new Map([[id,state]]))).toBe(true);
   literal.updateNative(w,false,false,w.structures.map(s=>all.has(s.id)?{...s,door:all.get(s.id)!}:s),axes,gates);expect(doorBytes(native)).toEqual(doorBytes(literal));expect(native.mesh.instanceMatrix.version).toBe(matrices);
  }
  // Initial full writes are still outstanding; a phase cannot narrow them.
  expect((native.mesh.geometry.getAttribute('doorCurrent') as THREE.BufferAttribute).updateRanges).toEqual([{start:0,count:16}]);
  for(const name of ['doorCurrent','doorPrevious'])(native.mesh.geometry.getAttribute(name) as THREE.BufferAttribute).clearUpdateRanges();
  const state={...all.get(id)!,open:false,changedAt:21};all.set(id,state);native.adoptPhase297(w,new Map([[id,state]]));literal.updateNative(w,false,false,w.structures.map(s=>all.has(s.id)?{...s,door:all.get(s.id)!}:s),axes,gates);expect((native.mesh.geometry.getAttribute('doorCurrent') as THREE.BufferAttribute).updateRanges).toEqual([{start:8,count:8}]);
  const replacement={...w};ownActorPlaybackWorld435(replacement,true);native.updateNative(replacement,false,false,w.structures,axes,gates);literal.updateNative(replacement,false,false,w.structures,axes,gates);expect(doorBytes(native)).toEqual(doorBytes(literal));expect(native.adoptPhase297(w,new Map([[id,state]]))).toBe(false);
 }finally{native.dispose();literal.dispose();ownActorPlaybackWorld435(w,false);}
});

test('frontier pose/cargo retains Full preparation and every historical root, motion, appearance and handoff byte at pause and x6',()=>{
 const base=fixture(),native=new PawnLayer(),literal=new PawnLayer(),timeline=new MotionTimeline(),otherTimeline=new MotionTimeline(),pawn=base.pawns[0]!,pile={id:base.nextId++,kind:'wood' as const,item:'wood' as const,quantity:7,owner:{type:'ground' as const,x:pawn.x,z:pawn.z}};
 base.piles=[pile];const job:Job={id:base.nextId++,kind:'chop',x:10,z:8,orientation:0,footprint:'standard',status:'active',reservedBy:pawn.id,progress:2,escrow:{wood:0,food:0}};base.jobs=[job];ownActorPlaybackWorld435(base,true);
 const before=structuredClone(base),poses=new Map<number,CoreHumanPose297>();let previous=base;
 native.update(base,1,true);literal.update(base,1,true);timeline.adopt(20,1,[],0,true,true,true);otherTimeline.adopt(20,1,[],0,true,true,true);
 const surfaces=vi.spyOn(furniture,'furnitureSurfaces'),clothes=vi.spyOn(apparel,'apparelProjection'),gear=vi.spyOn(equipment,'equipmentProjection');
 try{
  for(let n=1;n<=4;n++){
   const working=n<3,actor={...pawn,state:working?'working' as const:'idle' as const,jobId:working?job.id:null},nextJob={...job,progress:2+n},nextPile:World['piles'][number]=n<3?{...pile,owner:{type:'pawn',pawnId:pawn.id}}:{...pile};
   const view:World={...base,tick:20,phaseCore297:n,pawns:base.pawns.map((p,i)=>i===0?actor:p),jobs:[nextJob],piles:[nextPile]},lookup=new Map(view.pawns.map(p=>[p.id,p])),contact=humanWorkContact297(view,actor,lookup,new Map([[job.id,nextJob]]),0),pose:CoreHumanPose297={id:pawn.id,index:0,actor,job:working?nextJob:null,workPose:contact.workPose,reach:contact.reach,yaw:contact.yaw};poses.set(pawn.id,pose);ownActorPlaybackWorld435(view,true);
   const changed=new Map([[pawn.id,pose]]),piles=new Map([[pile.id,nextPile]]);timeline.tick=otherTimeline.tick=20+n/10;
   native.adoptCargo(previous,view,timeline.tick,true);literal.adoptCargo(previous,view,otherTimeline.tick,true);surfaces.mockClear();clothes.mockClear();gear.mockClear();
   native.updatePhase297(base,view,poses,new Set([0]),changed,piles,id=>id===pile.id?0:undefined);expect(surfaces).not.toHaveBeenCalled();expect(clothes).not.toHaveBeenCalled();expect(gear).not.toHaveBeenCalled();literal.update(view,literal.blend.value,false,poses);expect(bytes(native)).toEqual(bytes(literal));
   for(const [dt,speed]of [[1/60,1],[.1,0],[1/60,6]] as const){native.updateTravel(view,timeline,dt,speed);literal.updateTravel(view,otherTimeline,dt,speed);native.presentCargo(timeline.tick,view);literal.presentCargo(otherTimeline.tick,view);expect(bytes(native)).toEqual(bytes(literal));expect(native.hiddenPileQuantities()).toEqual(literal.hiddenPileQuantities());}
   previous=view;
  }
  expect(base).toStrictEqual(before);
 }finally{surfaces.mockRestore();clothes.mockRestore();gear.mockRestore();native.dispose();literal.dispose();ownActorPlaybackWorld435(base,false);}
});

test('phase counters retain exact sowing totals and building anchors without rebuilding Full section maps',()=>{
 const base=fixture(),p=base.pawns[0]!,researcher=base.pawns[1]!,zone={id:base.nextId++,plant:'haygrass' as const,cells:[8*base.width+8],allowSow:true,allowCut:true};base.growingZones=[zone];
 const job:Job={id:base.nextId++,kind:'sow',x:8,z:8,growingZoneId:zone.id,orientation:0,footprint:'standard',status:'active',reservedBy:p.id,progress:1,escrow:{wood:0,food:0}};base.jobs=[job];p.state='working';p.jobId=job.id;
 const station={id:base.nextId++,kind:'research-bench' as const,x:12,z:8,orientation:0 as const,footprint:'standard' as const,material:'wood' as const};base.structures=[station];researcher.state='working';researcher.research={stationId:station.id,spot:{x:11,z:8},worked:2};base.research={points:0,project:'complex-furniture',complexFurniture:{points:25}};
 const source=new THREE.InstancedBufferGeometry();for(const key of ['aFrom','aTo','aTravel'])source.setAttribute(key,new THREE.InstancedBufferAttribute(new Float32Array(base.pawns.length*4),4));
 const native=new ActionFeedbackLayer({blend:uniform(1),travelTime:uniform(0)}),literal=new ActionFeedbackLayer({blend:uniform(1),travelTime:uniform(0)});ownActorPlaybackWorld435(base,true);native.update(base,new Set(),source,true);literal.update(base,new Set(),source,true);
 const map=vi.spyOn(base.structures,'map'),flatMap=vi.spyOn(base.growingZones,'flatMap');
 try{
  for(const progress of [3,8,17]){const view:World={...base,tick:21,jobs:[{...job,progress}]};map.mockClear();flatMap.mockClear();native.updatePhase297(base,view,new Set(),source,true,new Set([0]),new Map());expect(map).not.toHaveBeenCalled();expect(flatMap).not.toHaveBeenCalled();literal.update(view,new Set(),source,true);
   for(const key of ['aAction','aActionAnchor'])expect(Array.from(native.bars.geometry.getAttribute(key).array)).toEqual(Array.from(literal.bars.geometry.getAttribute(key).array));expect(native.stats.activeBars).toBe(literal.stats.activeBars);
  }
 }finally{map.mockRestore();flatMap.mockRestore();native.dispose();literal.dispose();source.dispose();ownActorPlaybackWorld435(base,false);}
});

test('native frozen phase subjects skip unchanged rows while job clocks, piles, human anchors and event order remain literal',()=>{
 const world=createWorld(379710,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));world.resources=[];world.piles=[];world.packed=[];world.structures=[];world.jobs=[];if(world.wildlife)world.wildlife.animals=[];
 for(const [i,p]of world.pawns.entries()){p.state='idle';p.jobId=null;p.path=[];p.motion=null;p.x=8+i;p.z=8;}
 const p=world.pawns[0]!,q=world.pawns[1]!,job:Job={id:world.nextId++,kind:'sow',x:8,z:8,growingZoneId:world.nextId++,orientation:0,footprint:'standard',status:'active',reservedBy:p.id,progress:2,escrow:{wood:0,food:0}};
 world.growingZones=[{id:job.growingZoneId!,plant:'haygrass',cells:[8*world.width+8],allowSow:true,allowCut:true}];world.jobs=[job];p.state='working';p.jobId=job.id;
 const base=harness(world).send();ownActorPlaybackWorld435(base,true);
 const frozen=(pawns:World['pawns'])=>Object.freeze(pawns.map(p=>Object.isFrozen(p)?p:Object.freeze(p))) as World['pawns'];
 const source=new THREE.InstancedBufferGeometry();for(const key of ['aFrom','aTo','aTravel'])source.setAttribute(key,new THREE.InstancedBufferAttribute(new Float32Array(base.pawns.length*4),4));
 const clock=()=>({blend:uniform(1),travelTime:uniform(0)}),feedback=new ActionFeedbackLayer(clock()),rawFeedback=new ActionFeedbackLayer(clock()),particles=new ActionParticleLayer(clock()),rawParticles=new ActionParticleLayer(clock());
 let actors=frozen(base.pawns.map(p=>({...p}))),jobs=base.jobs;
 const pile:World['piles'][number]={id:world.nextId++,kind:'food',item:'simple-meal',quantity:1,owner:{type:'ground',x:7,z:7}};
 let piles:World['piles']=[];
 const compare=(tick:number,changes:ReadonlySet<number>,pileChanges:ReadonlyMap<number,World['piles'][number]|null>=new Map())=>{
   const view={...base,tick,pawns:actors,jobs,piles};ownActorPlaybackWorld435(view,true);
   const map=new Map(jobs.map(j=>[j.id,j])),byId=new Map(actors.map(p=>[p.id,p]));for(const [i,p]of actors.entries())source.getAttribute('aTo').setXYZW(i,p.x,0,p.z,0);
   (source.getAttribute('aTo') as THREE.InstancedBufferAttribute).needsUpdate=true;
   feedback.updatePhase297(base,view,new Set(),source,true,changes,pileChanges,map);rawFeedback.update(view,new Set(),source,true);
   particles.update(view,source,undefined,{base,humans:changes,piles:pileChanges,jobs:map,pawnSource:id=>byId.get(id)});rawParticles.update(view,source);particles.present(tick);rawParticles.present(tick);
   for(const key of ['aAction','aActionAnchor'])expect(Array.from(feedback.bars.geometry.getAttribute(key).array)).toEqual(Array.from(rawFeedback.bars.geometry.getAttribute(key).array));
   expect(feedback.stats.activeBars).toBe(rawFeedback.stats.activeBars);expect(particles.mesh.geometry.instanceCount).toBe(rawParticles.mesh.geometry.instanceCount);
   expect(Array.from((particles.mesh.geometry.getAttribute('eA') as THREE.InterleavedBufferAttribute).data.array)).toEqual(Array.from((rawParticles.mesh.geometry.getAttribute('eA') as THREE.InterleavedBufferAttribute).data.array));
 };
 try{
   feedback.update(base,new Set(),source,true);rawFeedback.update(base,new Set(),source,true);particles.update(base,source);rawParticles.update(base,source);
   compare(base.tick,new Set([0]));compare(base.tick+1,new Set());
   jobs=[{...jobs[0]!,progress:8}];compare(base.tick+2,new Set());
   actors=frozen(actors.map((p,i)=>i===1?{...p,state:'working',tend:{patientId:actors[2]!.id,spot:p,phase:'tend',progress:4,duration:10}}:p));compare(base.tick+3,new Set([1]));
   // An actor-only frontier was not sent to these sinks; the next pose view's
   // different frozen reference must still move the patient's target anchor.
   actors=frozen(actors.map((p,i)=>i===2?{...p,x:p.x+1}:p));compare(base.tick+4,new Set());
   actors=frozen(actors.map((p,i)=>i===1?{...p,tend:undefined,state:'idle',haul:{sourcePileId:pile.id,quantity:1,phase:'pickup',destination:{type:'aside',x:8,z:9},carryPileId:null}}:p));piles=[pile];compare(base.tick+5,new Set([1]),new Map([[pile.id,pile]]));
   const held={...pile,owner:{type:'pawn' as const,pawnId:q.id}};actors=frozen(actors.map((p,i)=>i===1?{...p,haul:{...p.haul!,phase:'deliver',carryPileId:pile.id}}:p));piles=[held];compare(base.tick+6,new Set([1]),new Map([[pile.id,held]]));
   compare(base.tick+7,new Set());actors=frozen(actors.map((p,i)=>i===1?{...p,haul:null}:p));piles=[];compare(base.tick+8,new Set([1]),new Map([[pile.id,null]]));
   expect(feedback.stats.phaseSkipped).toBeGreaterThan(0);expect(particles.phaseMetrics297.skipped).toBeGreaterThan(0);
 }finally{feedback.dispose();rawFeedback.dispose();particles.dispose();rawParticles.dispose();source.dispose();ownActorPlaybackWorld435(base,false);}
});

test('native pose reload retains appearance/contact keys but every displayed endpoint and spring remains exhaustive',()=>{
 const world=createWorld(379711,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));world.resources=[];world.piles=[];world.packed=[];world.structures=[];world.jobs=[];if(world.wildlife)world.wildlife.animals=[];
 for(const [i,p]of world.pawns.entries()){p.state='idle';p.jobId=null;p.path=[];p.motion=null;p.x=8+i;p.z=8;}
 const base=harness(world).send();ownActorPlaybackWorld435(base,true);const native=new PawnLayer(),literal=new PawnLayer(),timeline=new MotionTimeline(),other=new MotionTimeline();
 const poseReads=vi.spyOn(contacts,'humanWorkContact297');
 try{
  native.update(base,1,true);literal.update(base,1,true);timeline.adopt(base.tick,1,[],0,true,true,true);other.adopt(base.tick,1,[],0,true,true,true);
  for(let n=1;n<=4;n++){
   const pawn=Object.freeze({...base.pawns[0]!,state:n<3?'working' as const:'idle' as const,jobId:n<3?base.nextId:null});
   const job:Job={id:base.nextId,kind:'chop',x:9,z:8,orientation:0,footprint:'standard',status:'active',reservedBy:pawn.id,progress:n,escrow:{food:0,wood:0}};
   const actors=Object.freeze(base.pawns.map((p,i)=>i===0?pawn:Object.freeze({...p}))) as World['pawns'],view:World={...base,tick:base.tick,phaseCore297:n,pawns:actors,jobs:[job]},jobs=new Map([[job.id,job]]);
   ownActorPlaybackWorld435(view,true);const contact=humanWorkContact297(view,pawn,new Map(actors.map(p=>[p.id,p])),jobs,0),pose:CoreHumanPose297={id:pawn.id,index:0,actor:pawn,job:n<3?job:null,workPose:contact.workPose,reach:contact.reach,yaw:contact.yaw};
   const poses=new Map([[pawn.id,pose]]);poseReads.mockClear();native.updatePhase297(base,view,poses,new Set([0]),poses,new Map(),undefined,jobs);expect(poseReads).not.toHaveBeenCalled();literal.update(view,literal.blend.value,false,poses);expect(bytes(native)).toEqual(bytes(literal));
   timeline.tick=other.tick=base.tick+n/10;native.updateTravel(view,timeline,1/60,1);literal.updateTravel(view,other,1/60,1);expect(bytes(native)).toEqual(bytes(literal));
  }
 }finally{poseReads.mockRestore();native.dispose();literal.dispose();ownActorPlaybackWorld435(base,false);}
});
