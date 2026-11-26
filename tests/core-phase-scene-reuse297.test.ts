import {expect,test} from 'vitest';
import type {World} from '../src/sim/types';
import {CorePhaseFrameOwner297} from '../src/bridge/core-phase-owner-297';
import {captureCoreActor297} from '../src/bridge/core-phase-data-297';
import {captureNativeMessageForDeferred297} from '../src/bridge/native-message-capture';

// Representation fixtures only; no simulation or Native authority is claimed.
function anchored(){
 const world={schemaVersion:297,tick:20,phaseCore297:0,width:32,height:32,nextId:100,tiles:[],
  pawns:[7,9].map(id=>({id,x:10,z:10,state:'moving',moveCooldown:0,planCooldown:0,path:[{x:11,z:10},{x:12,z:10}]})),
  wildlife:{animals:[{id:11,x:5,z:5,state:'idle',path:[],nextDecision:0}]},
  mechanoids:[{id:13,x:6,z:6,state:'idle',path:[],heading:0,moveCooldown:0,planCooldown:0}],projectiles:[]} as unknown as World;
 const owner=new CorePhaseFrameOwner297(),full=owner.adoptFull(world,1,1,[],{mapId:0,core:200,projectilesRetained:[],actorMode297:'frontier'},1);
 return {world,owner,full};
}
const packet=()=>({type:'actor-frontier-297',audioCues:[],epoch:1,mapId:0,baseRevision:1,phaseSeq:1,nextId:100,fromCore:200,toCore:201,speed:1,actors:[],tracks:[],projectiles:{upserted:[],removed:[]}});

test('phase scenes retain untouched actors and immutable index entries across all populations',()=>{
 const {owner,world,full}=anchored(),next=structuredClone(world),before=full.actorScene;
 next.pawns[0]!.x=11;next.pawns[0]!.path=[];
 next.mechanoids![0]!.heading=1;
 const prepared=owner.prepare({...packet(),actors:[captureCoreActor297('human',0,next.pawns[0]!),captureCoreActor297('mechanical',0,next.mechanoids![0]!)],paths297:[{id:7,keep:1}]}),scene=prepared.projection.actorScene;
 expect(scene.humans[0]!.path).toEqual([{x:12,z:10}]);expect(scene.mechanical[0]!.heading).toBe(1);
 expect(scene.humans[1]).toBe(before.humans[1]);expect(scene.animals).toBe(before.animals);
 expect(scene.byId[9]).toBe(before.byId[9]);expect(scene.byId[11]).toBe(before.byId[11]);
 for(const [id,entry] of Object.entries(scene.byId)){
  const actor=entry.kind==='human'?scene.humans[entry.index]:entry.kind==='animal'?scene.animals[entry.index]:scene.mechanical[entry.index];
  expect(entry.actor).toBe(actor);expect(actor!.id).toBe(Number(id));expect(Object.isFrozen(entry)).toBe(true);
  expect(Object.getOwnPropertyDescriptor(scene.byId,id)).toMatchObject({writable:false,enumerable:true,configurable:false});
 }
 expect(before.humans[0]!.x).toBe(10);expect(before.humans[0]!.path).toHaveLength(2);expect(owner.currentCore).toBe(200);
 owner.commit(prepared);expect(owner.currentCore).toBe(201);expect(()=>owner.commit(prepared)).toThrow();
});

test('a complete pose supersedes the physical row while preserving its committed predecessor',()=>{
 const {owner,world,full}=anchored(),next=structuredClone(world),pawn=next.pawns[0]!;
 pawn.x=11;const row=captureCoreActor297('human',0,pawn);pawn.x=14;
 const pose={id:pawn.id,index:0,actor:pawn,job:null,workPose:0,reach:{x:0,z:0},yaw:null};
 const prepared=owner.prepare({...packet(),actors:[row],poses297:[pose]}),scene=prepared.projection.actorScene;
 expect(scene.humans[0]!.x).toBe(14);expect(scene.byId[pawn.id]!.actor).toBe(scene.humans[0]);
 expect(scene.humans[1]).toBe(full.actorScene.humans[1]);expect(scene.byId[9]).toBe(full.actorScene.byId[9]);
 pawn.x=20;expect(scene.humans[0]!.x).toBe(14);expect(full.actorScene.humans[0]!.x).toBe(10);
 expect(()=>owner.prepare({...packet(),actors:[row],poses297:[{...pose,index:1}]})).toThrow('Invalid Core pose patches');
 expect(owner.currentCore).toBe(200);owner.commit(prepared);expect(owner.currentCore).toBe(201);
});

test('an unowned frozen actor list still receives complete descriptor validation',()=>{
 const {owner,world}=anchored(),next=structuredClone(world),motion={};let reads=0;
 Object.defineProperty(motion,'x',{enumerable:true,get(){reads++;return 1;}});Object.freeze(motion);
 next.pawns=Object.freeze(next.pawns.map((pawn,index)=>Object.freeze(index===0?{...pawn,motion}:pawn))) as unknown as World['pawns'];
 expect(()=>owner.prepareFull(next,1,2,[],{mapId:0,core:200,projectilesRetained:[],actorMode297:'frontier'},1)).toThrow('Core phase requires plain own data');
 expect(reads).toBe(0);expect(owner.currentCore).toBe(200);expect(owner.currentSequence).toBe(0);
});

test('path patches resolve unique actors in either row order and survive a rejected packet',()=>{
 const {owner,world}=anchored(),[human,other]=world.pawns;
 const rows=[captureCoreActor297('human',1,{...other!,path:[]}),captureCoreActor297('human',0,{...human!,path:[]})];
 const payload={...packet(),actors:rows,paths297:[{id:7,keep:2},{id:9,keep:1}]};
 const capture=(raw:unknown)=>captureNativeMessageForDeferred297(raw);
 expect(()=>owner.prepare(capture({...payload,actors:[...rows,rows[0]]}))).toThrow('Invalid physical actor phase');
 expect(()=>owner.prepare(capture({...payload,actors:[rows[0]]}))).toThrow('Invalid Core path patches');
 const reversed=owner.prepare(capture(payload)).projection;
 const ordered=owner.prepare(capture({...payload,actors:[...rows].reverse()})).projection;
 expect(reversed.actorScene).toEqual(ordered.actorScene);
 expect(reversed.actors.map(r=>[r.id,r.fields.path])).toEqual([[9,other!.path.slice(-1)],[7,human!.path]]);
 expect(world.pawns[1]!.path).toHaveLength(2);
 expect(owner.currentCore).toBe(200);
});
