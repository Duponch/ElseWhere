import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/index';
import type {World} from '../src/sim/types';
import type {PresentationSegment} from '../src/sim/travel-timing';
import {PawnLayer} from '../src/render/PawnLayer';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {MechanoidLayer} from '../src/render/MechanoidLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {ownActorPlaybackWorld435} from '../src/render/ActorPlayback435';
import {WorldCoordinateGroup} from '../src/render/WorldCoordinateGroup';
import {CARGO_HANDOFF_TICKS} from '../src/render/cargo-handoff';
import {itemCargoKind} from '../src/render/item-presentation';
import {TICKS_PER_SECOND} from '../src/sim/types';

const edge=(start=100,end=104):PresentationSegment=>({from:{x:10,z:10},to:{x:11,z:10},start,end});
function fixture():World{
 const world=createWorld(83,20,20),pawn=world.pawns[0]!;world.pawns=[pawn];world.resources=[];world.jobs=[];world.structures=[];world.piles=[];world.tick=104;
 Object.assign(pawn,{x:11,z:10,state:'moving',path:[],motion:edge()});return world;
}
function setup(world:World,closed=true){
 const layer=new PawnLayer(),timeline=new MotionTimeline();ownActorPlaybackWorld435(world,closed);
 timeline.adopt(world.tick,1,world.pawns.flatMap(p=>p.motion?[{id:p.id,segments:[p.motion]}]:[]),0,true,closed);layer.update(world,1,true);
 return{layer,timeline,geometry:layer.feedbackSource!,step(tick:number){timeline.tick=tick;layer.updateTravel(world,timeline);}};
}
function xyz(g:THREE.BufferGeometry,name:string,index=0){const a=g.getAttribute(name);return[a.getX(index),a.getY(index),a.getZ(index)];}
function row(g:THREE.BufferGeometry,name:string,index=0){const a=g.getAttribute(name);return Array.from({length:a.itemSize},(_,c)=>a.getComponent(index,c));}
function expectEdge(g:THREE.BufferGeometry,x0:number,x1:number,start:number,end:number,fa=0,fb=1,index=0){
 expect(xyz(g,'aFrom',index)).toEqual([x0,0,10]);expect(xyz(g,'aTo',index)).toEqual([x1,0,10]);
 expect(row(g,'aTravel',index)).toEqual([Math.fround(start/TICKS_PER_SECOND),Math.fround(end/TICKS_PER_SECOND),fa,fb]);
}
function namedMesh(root:THREE.Object3D,name:string):THREE.Mesh{
 let result:THREE.Mesh|undefined;root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name===name)result=o;});if(!result)throw Error(`Missing resident body ${name}`);return result;
}

test('reapplying the same closed World restores the confirmed edge instead of applying its interpolation twice',()=>{
 const world=fixture(),before=JSON.stringify(world),p=setup(world);try{
  p.step(101);expectEdge(p.geometry,10,11,100,104);p.step(101.25);
  p.layer.update(world,.6,false);p.step(101.25);expectEdge(p.geometry,10,11,100,104);p.step(101.5);expectEdge(p.geometry,10,11,100,104);
  expect(JSON.stringify(world)).toBe(before);expect(p.layer.actorPlaybackMetrics435().skips).toBeGreaterThan(0);
 }finally{p.layer.dispose();}
});

test('confirmed fractions, stopped pieces, same-tick corrections and trimmed tracks retain their actual endpoints',()=>{
 const world=fixture();world.pawns[0]!.x=14;const p=setup(world),id=world.pawns[0]!.id;
 const span={from:{x:10,z:10},to:{x:14,z:10},edgeStart:100},pieces:PresentationSegment[]=[{...span,start:100,end:102,fromFraction:0,toFraction:.25},{...span,start:102,end:104,fromFraction:.25,toFraction:.25},{...span,start:104,end:108,fromFraction:.25,toFraction:1}];
 try{
  p.timeline.tracks.set(id,pieces);p.step(101);expectEdge(p.geometry,10,11,100,102,0,.25);
  p.step(103);expectEdge(p.geometry,11,11,102,104,.25,.25);expect(p.geometry.getAttribute('aMotion').getX(0)).toBe(0);
  p.step(104.5);expectEdge(p.geometry,11,14,104,108,.25,1);
  const corrected=pieces.map(piece=>({...piece}));corrected[2]!.toFraction=.75;p.timeline.tracks.set(id,corrected);p.step(104.5);expectEdge(p.geometry,11,13,104,108,.25,.75);
  p.timeline.tracks.set(id,corrected.slice(2));p.step(105);expectEdge(p.geometry,11,13,104,108,.25,.75);
 }finally{p.layer.dispose();}
});

test('crossing origin1024 preserves world endpoints and encodes both sides of the confirmed interval locally',()=>{
 const world=fixture();world.tick=1026;world.pawns[0]!.motion=edge(1022,1026);const before=JSON.stringify(world),p=setup(world);try{
  p.step(1023.5);expectEdge(p.geometry,10,11,1022,1026);p.step(1024);expectEdge(p.geometry,10,11,-2,2);p.step(1024.5);expectEdge(p.geometry,10,11,-2,2);
  expect(p.layer.travelTime.value).toBe(.5/TICKS_PER_SECOND);expect(JSON.stringify(world)).toBe(before);
 }finally{p.layer.dispose();}
});

test('public mutable inputs retain in-place track corrections and null motion without becoming a closed actor owner',()=>{
 const world=fixture(),p=setup(world,false),id=world.pawns[0]!.id;try{
  p.step(101);expectEdge(p.geometry,10,11,100,104);p.timeline.tracks.get(id)![0]!.end=106;p.step(101.5);expectEdge(p.geometry,10,11,100,106);
  world.pawns[0]!.motion=null;world.pawns[0]!.state='idle';world.pawns[0]!.x=12;p.timeline.tracks.clear();p.layer.update(world,1,true);p.step(110);
  expect(xyz(p.geometry,'aFrom')).toEqual([12,0,10]);expect(xyz(p.geometry,'aTo')).toEqual([12,0,10]);expect(p.geometry.getAttribute('aMotion').getX(0)).toBe(0);
  expect(p.layer.actorPlaybackMetrics435().enabled).toBe(false);
 }finally{p.layer.dispose();}
});

test('a carried human keeps the living carrier endpoints and carried posture across confirmed edge changes',()=>{
 const world=fixture(),carrier=world.pawns[0]!,patient=structuredClone(carrier);patient.id=world.nextId++;patient.state='downed';patient.motion=null;world.pawns.push(patient);carrier.rescue={patientId:patient.id,bedId:90001,phase:'carry'};
 const before=JSON.stringify(world),p=setup(world);try{
  for(const tick of [100,101,103.5]){p.step(tick);expectEdge(p.geometry,10,11,100,104,0,1,1);expect(row(p.geometry,'aMotion',1).slice(0,3)).toEqual([0,0,6]);}
  p.timeline.tracks.set(carrier.id,[{from:{x:11,z:10},to:{x:12,z:10},start:104,end:108}]);p.step(104.5);expectEdge(p.geometry,11,12,104,108,0,1,1);
  for(const name of ['aFrom','aTo','aTravel'])expect(row(p.geometry,name,1)).toEqual(row(p.geometry,name,0));expect(JSON.stringify(world)).toBe(before);
 }finally{p.layer.dispose();}
});

test('a living carried animal follows changed carrier streams on the same closed World',()=>{
 const world=fixture(),carrier=world.pawns[0]!,animal={id:world.nextId++,species:'hare' as const,sex:'female' as const,ageTicks:100000,x:11,z:10,food:.2,rest:1,state:'downed' as const,path:[],nextDecision:200};
 world.wildlife={profile:'temperate-hares-v1',rng:43,animals:[animal],eatenPlants:0,eatenNutrition:0,eatenItems:0};carrier.animalRescue={animalId:animal.id,spotId:90002,phase:'carry'};
 const before=JSON.stringify(world),p=setup(world),wildlife=new WildlifeLayer();try{
  p.step(101);wildlife.update(world,p.timeline,true,p.layer);const g=namedMesh(wildlife.mesh,'Wild hare — GPU rig').geometry;
  expect(g.getAttribute('aCarrier').getX(0)).toBe(1);expect(g.getAttribute('aAnimal').getZ(0)).toBe(1);expectEdge(g,10,11,100,104);
  p.timeline.tracks.set(carrier.id,[{from:{x:11,z:10},to:{x:12,z:10},start:104,end:108}]);p.step(104.5);wildlife.update(world,p.timeline,false,p.layer);expectEdge(g,11,12,104,108);
  for(const name of ['aFrom','aTo','aTravel'])expect(row(g,name)).toEqual(row(p.geometry,name));expect(JSON.stringify(world)).toBe(before);
 }finally{wildlife.dispose();p.layer.dispose();}
});

test('cargo release completes on the confirmed clock while its living carrier retains the same World',()=>{
 const previous=fixture(),id=previous.pawns[0]!.id;previous.tick=100;previous.piles=[{id:99001,kind:'wood',item:'wood',quantity:12,owner:{type:'pawn',pawnId:id}}];const p=setup(previous);try{
  p.step(100);const current=structuredClone(previous);current.tick=101;current.piles[0]!.owner={type:'ground',x:10,z:11};ownActorPlaybackWorld435(current,true);p.layer.adoptCargo(previous,current,101,true);p.layer.update(current,1,false);
  const before=JSON.stringify(current),cargo=p.geometry.getAttribute('aCargo');p.timeline.tick=101.5;p.layer.updateTravel(current,p.timeline);expect(p.layer.presentCargo(101.5,current)).toBe(false);
  expect(cargo.getX(0)).toBe(itemCargoKind('wood'));expect(cargo.getW(0)).toBeLessThan(0);expect(p.layer.hiddenPileQuantity(99001)).toBe(12);
  const end=101+CARGO_HANDOFF_TICKS;p.timeline.tick=end;p.layer.updateTravel(current,p.timeline);expect(p.layer.presentCargo(end,current)).toBe(true);expect(row(p.geometry,'aCargo')).toEqual([0,0,0,0]);expect(p.layer.hiddenPileQuantity(99001)).toBe(0);
  p.timeline.tick=1024;p.layer.updateTravel(current,p.timeline);p.layer.presentCargo(1024,current);expectEdge(p.geometry,10,11,-924,-920);expect(row(p.geometry,'aCargo')).toEqual([0,0,0,0]);expect(JSON.stringify(current)).toBe(before);
 }finally{p.layer.dispose();}
});

test('mechanical playback retains confirmed positions and fractions across the local clock boundary',()=>{
 const world=fixture();world.tick=1026;const mech={id:world.nextId++,mechKind:'scyther' as const,state:'moving' as const,x:11,z:10,path:[],motion:edge(1022,1026),heading:0,moveCooldown:0,planCooldown:0};world.mechanoids=[mech];ownActorPlaybackWorld435(world,true);
 const timeline=new MotionTimeline(),machines=new MechanoidLayer(),before=JSON.stringify(world);timeline.adopt(1026,1,[{id:mech.id,segments:[mech.motion]}],0,true,true);try{
  timeline.tick=1023;machines.update(world,timeline,true);const g=namedMesh(machines.group,'scyther bodies and carcasses — original GPU rig').geometry;expectEdge(g,10,11,1022,1026);
  timeline.tick=1024.5;machines.update(world,timeline);expectEdge(g,10,11,-2,2);expect(JSON.stringify(world)).toBe(before);
 }finally{machines.dispose();}
});

test('closed immutable histories schedule only real endpoint/dependency changes and preserve all physical actor stream bytes',()=>{
 const seed=fixture();seed.schemaVersion=379;seed.tick=108;const human=seed.pawns[0]!,stationary=structuredClone(human);stationary.id=seed.nextId++;Object.assign(stationary,{x:8,z:8,state:'idle',motion:null});seed.pawns.push(stationary);
 const hare={id:seed.nextId++,species:'hare' as const,sex:'female' as const,ageTicks:100000,x:11,z:10,food:.2,rest:1,state:'moving' as const,path:[],nextDecision:200,motion:edge()};
 const still={...hare,id:seed.nextId++,state:'idle' as const,motion:undefined,x:8,z:8};
 seed.wildlife={profile:'temperate-hares-v1',rng:43,animals:[hare,still],eatenPlants:0,eatenNutrition:0,eatenItems:0};
 const mech={id:seed.nextId++,mechKind:'scyther' as const,state:'moving' as const,x:11,z:10,path:[],motion:edge(),heading:0,moveCooldown:0,planCooldown:0};seed.mechanoids=[mech,{...mech,id:seed.nextId++,state:'idle',motion:undefined,x:8,z:8}];
 const moving=[human.id,hare.id,mech.id],history=(pieces:PresentationSegment[])=>{for(const piece of pieces){Object.freeze(piece.from);Object.freeze(piece.to);Object.freeze(piece);}Object.freeze(pieces);return pieces;};
 const first=history([edge(100,104),{from:{x:11,z:10},to:{x:12,z:10},start:104,end:108}]);
 const one=(reference:boolean)=>{const world=structuredClone(seed),timeline=new MotionTimeline(),pawns=new PawnLayer(undefined,undefined,!reference),wildlife=new WildlifeLayer(undefined,undefined,undefined,!reference),machines=new MechanoidLayer(undefined,undefined,!reference),scene=new THREE.Scene(),parent=new THREE.Group();ownActorPlaybackWorld435(world,true);timeline.adopt(108,1,moving.map(id=>({id,segments:first})),0,true,true);expect(timeline.playbackOwned435).toBe(true);
  scene.matrixAutoUpdate=false;parent.matrixAutoUpdate=false;scene.add(parent);parent.add(pawns.group,wildlife.mesh,wildlife.flames,machines.group);
  if(reference)Reflect.set(timeline,'playbackChanged435',undefined);pawns.update(world,1,true);return{world,timeline,pawns,wildlife,machines,scene,parent};};
 const candidate=one(false),reference=one(true),both=[reference,candidate];
 const streams=(h:typeof candidate)=>[h.pawns.feedbackSource!,namedMesh(h.wildlife.mesh,'Wild hare — GPU rig').geometry,namedMesh(h.machines.group,'scyther bodies and carcasses — original GPU rig').geometry].map(g=>['aFrom','aTo','aTravel','aMotion','aAnimal'].flatMap(name=>{const a=g.getAttribute(name);if(!a)return[];const array=a.array;return[...new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4)];}));
 const frame=(tick:number,dt=1/240,speed=1,reset=false)=>{for(const h of both){h.timeline.tick=tick;h.pawns.blend.value=1;h.pawns.time.value=tick/6%(2*Math.PI);h.pawns.updateTravel(h.world,h.timeline,dt,speed);h.pawns.presentAnimations();h.wildlife.update(h.world,h.timeline,reset,h.pawns,undefined,dt,speed);h.machines.update(h.world,h.timeline,reset);h.scene.updateMatrixWorld();}expect(streams(candidate)).toEqual(streams(reference));};
 const matrices=(h:typeof candidate)=>{const result:number[][]=[];h.parent.traverse(object=>result.push(object.matrixWorld.elements.slice()));return result;};
 try{
  frame(99,1/240,1,true);expect(matrices(candidate)).toEqual(matrices(reference));for(let i=0;i<160;i++)frame(99+i*.06);
  expect(matrices(candidate)).toEqual(matrices(reference));
  // A genuinely changed ancestor still propagates as native, despite all
  // inactive and active GPU-local actor rigs retaining their clean matrices.
  for(const h of both){h.parent.position.set(2,3,4);h.parent.rotation.y=.25;h.parent.updateMatrix();}
  frame(108.7);expect(matrices(candidate)).toEqual(matrices(reference));
  const corrected=history([{from:{x:12,z:10},to:{x:14,z:10},start:108,end:113}]);for(const h of both)h.timeline.adopt(113,1,moving.map(id=>({id,segments:corrected})),100,false,true);
  for(let i=0;i<150;i++)frame(109+i*.05);
  for(let i=0;i<30;i++)frame(117,1/240,0);frame(117,.05,3);frame(117,1/240,6);frame(1024.1);frame(1024.2);frame(109.5);frame(110);
  expect(candidate.pawns.actorPlaybackMetrics435().scheduledFrames).toBeGreaterThan(300);expect(candidate.pawns.actorPlaybackMetrics435().scheduledActors).toBeLessThan(100);
  expect(candidate.wildlife.actorPlaybackMetrics435()[0]!.scheduledFrames).toBeGreaterThan(300);expect(candidate.machines.actorPlaybackMetrics435()[0]!.scheduledFrames).toBeGreaterThan(300);
  expect(reference.pawns.actorPlaybackMetrics435().scheduledFrames).toBe(0);
  expect(matrices(candidate)).toEqual(matrices(reference));
  for(const group of [candidate.pawns.group,candidate.wildlife.mesh,candidate.wildlife.flames,candidate.machines.group]){expect(group).toBeInstanceOf(WorldCoordinateGroup);expect((group as WorldCoordinateGroup).matrixMetrics().reusedTraversals).toBeGreaterThan(300);expect((group as WorldCoordinateGroup).matrixMetrics().nativeTraversals).toBeLessThan(10);}
  for(const group of [reference.pawns.group,reference.wildlife.mesh,reference.wildlife.flames,reference.machines.group])expect(group.constructor).toBe(THREE.Group);
 }finally{for(const h of both){h.pawns.dispose();h.wildlife.dispose();h.machines.dispose();}}
});
