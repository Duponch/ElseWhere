import {afterEach,expect,test,vi} from 'vitest';
import {SourceMotionPhasePublisher297,type ActorPhaseSourceWork297} from '../src/bridge/source-motion-phase-publisher-297';
import {CorePhasePublisher297} from '../src/bridge/core-phase-publisher-297';
import {captureCoreActor297,coreMapId297} from '../src/bridge/core-phase-data-297';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {createCoreMovement297} from '../src/sim/core-movement-297';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {markActorRecordSource297,actorRecordSourceShape297,invalidateActorRecordSources297,revokeActorRecordSource297} from '../src/sim/actor-record-source-297';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {fixture} from './resident-presentation-fixtures-v427';
import type {Pawn} from '../src/sim/types';

class ExposedPublisher extends SourceMotionPhasePublisher297 {capture(pawn:Pawn){return this.captureActor297('human',0,pawn,false);}}
afterEach(()=>{vi.restoreAllMocks();setResourceJournalVerification(false);invalidateActorRecordSources297();});
function setup(){
 const world=fixture(),owner={},pawn=world.pawns[0]!;
 for(const p of world.pawns){p.state='idle';p.path=[];p.moveCooldown=0;delete p.motion;delete p.draft;}
 const movement=createCoreMovement297(world);
 return {world,owner,pawn,movement,publisher:new ExposedPublisher(owner)};
}

test('a genuine closed movement pass retains actor own-data shape with zero descriptor discoveries per row',()=>{
 const h=setup();withJournalTerrainReadScope(h.owner,()=>h.movement.advance());expect(actorRecordSourceShape297('human',h.pawn,h.owner)).toBeDefined();
 const expected=captureCoreActor297('human',0,h.pawn),original=Object.getOwnPropertyDescriptor;let discoveries=0;
 const spy=vi.spyOn(Object,'getOwnPropertyDescriptor').mockImplementation((value:unknown,key:PropertyKey)=>{if(value===h.pawn)discoveries++;return original(value,key);});
 const row=h.publisher.capture(h.pawn);spy.mockRestore();expect(row).toStrictEqual(expected);expect(discoveries).toBe(0);
 h.pawn.motion=undefined;expect(h.publisher.capture(h.pawn)).toStrictEqual(captureCoreActor297('human',0,h.pawn));delete h.pawn.motion;
 expect(h.publisher.capture(h.pawn)).toStrictEqual(captureCoreActor297('human',0,h.pawn));
});

test('a public pass, unknown transaction or replacement cannot borrow a source shape',()=>{
 const h=setup();withJournalTerrainReadScope(h.owner,()=>h.movement.advance());
 expect(actorRecordSourceShape297('human',h.pawn,{})).toBeUndefined();h.movement.advance();expect(actorRecordSourceShape297('human',h.pawn,h.owner)).toBeUndefined();
 withJournalTerrainReadScope(h.owner,()=>h.movement.advance());invalidateActorRecordSources297();expect(actorRecordSourceShape297('human',h.pawn,h.owner)).toBeUndefined();
 const replacement={...h.pawn};expect(actorRecordSourceShape297('human',replacement,h.owner)).toBeUndefined();
 expect(h.publisher.capture(replacement)).toStrictEqual(captureCoreActor297('human',0,replacement));
});

test('descriptor transactions revoke the witness; checking mode declines an unmarked descriptor before invoking getters',()=>{
 const h=setup();withJournalTerrainReadScope(h.owner,()=>h.movement.advance());let reads=0;
 revokeActorRecordSource297(h.pawn);Object.defineProperty(h.pawn,'state',{enumerable:true,configurable:true,get(){reads++;throw Error('getter ran');}});
 expect(()=>h.publisher.capture(h.pawn)).toThrow('Physical actor field is not own data');expect(reads).toBe(0);
 withJournalTerrainReadScope(h.owner,()=>markActorRecordSource297('human',h.pawn));expect(actorRecordSourceShape297('human',h.pawn,h.owner)).toBeUndefined();
 Object.defineProperty(h.pawn,'state',{value:'idle',enumerable:true,writable:true,configurable:true});withJournalTerrainReadScope(h.owner,()=>markActorRecordSource297('human',h.pawn));
 Object.defineProperty(h.pawn,'moveCooldown',{enumerable:true,configurable:true,get(){reads++;throw Error('getter ran');}});setResourceJournalVerification(true);
 expect(()=>h.publisher.capture(h.pawn)).toThrow('Physical actor field is not own data');expect(reads).toBe(0);expect(actorRecordSourceShape297('human',h.pawn,h.owner)).toBeUndefined();
});

test('actual prepared phases report retained/discovered actor counts while canonical messages remain exact',()=>{
 const h=setup(),reports:ActorPhaseSourceWork297[]=[],closed=new SourceMotionPhasePublisher297(h.owner,report=>reports.push(report)),full=new CorePhasePublisher297(),encoder=new TerrainJournalSnapshotEncoder();
 withJournalTerrainReadScope(h.owner,()=>h.movement.advance());encoder.encode(h.world,0,6,true);
 for(const publisher of [full,closed])publisher.commitFull(publisher.prepareFull(h.world,1,1,[],coreMapId297(h.world),'frontier'),1000);
 for(let core=1;core<=3;core++){
  h.world.phaseCore297=core;h.pawn.planCooldown++;if(core===3)invalidateActorRecordSources297();const packets=[];
  for(const publisher of [full,closed]){
   publisher.observe({core,actorsChanged:[h.pawn.id],projectileEvents:{upserted:[],removed:[]},requiresFull:false},false,1000+core);
   const prepared=publisher.preparePhase(h.world,[],6);packets.push(structuredClone(prepared.packet));publisher.commitPhase(prepared,2000+core);
  }
  expect(packets[1]).toStrictEqual(packets[0]);
 }
 expect(reports.map(({core,rows,retainedActors,discoveredActors})=>({core,rows,retainedActors,discoveredActors}))).toEqual([
  {core:1,rows:1,retainedActors:1,discoveredActors:0},{core:2,rows:1,retainedActors:1,discoveredActors:0},{core:3,rows:1,retainedActors:0,discoveredActors:1},
 ]);
 expect(reports.every(Object.isFrozen)).toBe(true);
});
