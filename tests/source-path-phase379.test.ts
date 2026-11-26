import {afterEach,expect,test} from 'vitest';
import {SourceMotionPhasePublisher297} from '../src/bridge/source-motion-phase-publisher-297';
import {CorePhasePublisher297} from '../src/bridge/core-phase-publisher-297';
import {captureCoreActor297,coreMapId297} from '../src/bridge/core-phase-data-297';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {captureOwnedCoreSourceData297,sliceOwnedCoreSourceData297,captureCoreActorSharedSource297,verifyOwnedCoreSourceData297} from '../src/bridge/core-frozen-copy-297';
import {actorPathSourcePosition297,markActorPathCreated297,shiftActorPath297,invalidateActorPathSources297} from '../src/sim/actor-path-source-297';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {routeToCell,type DistanceField} from '../src/sim/pathfinding';
import {fixture} from './resident-presentation-fixtures-v427';
import type {Pawn,Cell} from '../src/sim/types';

class ExposedPublisher extends SourceMotionPhasePublisher297 {
 capture(pawn:Pawn){return this.captureActor297('human',0,pawn,false);}
 reference(path:unknown){return this.captureActorPathReference297(path);}
 retain(reference:unknown,from:number){return this.retainActorPathReference297(reference,from);}
 tail(path:readonly Cell[],reference:unknown,live:unknown){return this.heldActorPathTail297(path,reference,live);}
}
afterEach(()=>{setResourceJournalVerification(false);invalidateActorPathSources297();});
const points=(count=10)=>Array.from({length:count},(_,i)=>({x:i+1,z:4}));

test('the real route reconstruction stamps its own points, and actual shifts advance only its consumed prefix',()=>{
 const world=fixture(),owner={},start=4*world.width+1,parents=new Int32Array(world.tiles.length).fill(-1),costs=new Float64Array(world.tiles.length).fill(Infinity);
 costs[start]=0;for(let x=2;x<=11;x++){const id=4*world.width+x;parents[id]=id-1;costs[id]=(x-1)*1000;}
 const field:DistanceField={start,parents,costs,visited:11,unreachedGroups:0};
 const path=withJournalTerrainReadScope(owner,()=>routeToCell(world,{x:11,z:4},field))!;
 expect(path).toEqual(points().map(p=>({...p,x:p.x+1})));const first=actorPathSourcePosition297(path,owner)!;
 expect(first.length).toBe(10);expect(first.dropped).toBe(0);
 const removed=withJournalTerrainReadScope(owner,()=>shiftActorPath297(path));expect(removed).toEqual({x:2,z:4});
 expect(actorPathSourcePosition297(path,owner)).toEqual({...first,dropped:1,length:9});
 expect(actorPathSourcePosition297(path,{})).toBeUndefined();
 const publicPath=routeToCell(world,{x:11,z:4},field)!;expect(actorPathSourcePosition297(publicPath,owner)).toBeUndefined();
});

test('128 held-tail proofs read zero source cells; consumed paths keep owned point copies after a new Full',()=>{
 const world=fixture(),pawn=world.pawns[0]!,owner={},publisher=new ExposedPublisher(owner);let indexed=0,slices=0;
 const source=new Proxy(points(14),{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))indexed++;if(key==='slice')slices++;return Reflect.get(target,key,receiver);}});
 pawn.path=withJournalTerrainReadScope(owner,()=>markActorPathCreated297(source));
 const first=publisher.capture(pawn),reference=publisher.reference(source);indexed=slices=0;
 for(let i=0;i<128;i++)expect(publisher.tail(first.fields.path,reference,source)).toBe(14);
 expect({indexed,slices}).toEqual({indexed:0,slices:0});
 withJournalTerrainReadScope(owner,()=>{shiftActorPath297(source);shiftActorPath297(source);});indexed=slices=0;
 expect(publisher.tail(first.fields.path,reference,source)).toBe(12);
 const tail=publisher.retain(reference,2),owned=first.fields.path.slice(2);
 expect(publisher.tail(owned,tail,source)).toBe(12);expect({indexed,slices}).toEqual({indexed:0,slices:0});
 const after=publisher.capture(pawn);expect({indexed,slices}).toEqual({indexed:0,slices:0});
 expect(after.fields.path[0]).toBe(first.fields.path[2]);expect(after).toStrictEqual(captureCoreActor297('human',0,pawn));
});

test('unknown and public mutations discover actual tails; checking mode catches an unmarked source point write',()=>{
 const world=fixture(),pawn=world.pawns[0]!,owner={},publisher=new ExposedPublisher(owner);
 pawn.path=withJournalTerrainReadScope(owner,()=>markActorPathCreated297(points()));
 const row=publisher.capture(pawn),reference=publisher.reference(pawn.path);setResourceJournalVerification(true);pawn.path[3]!.x++;
 expect(()=>publisher.tail(row.fields.path,reference,pawn.path)).toThrow('Unmarked actor path source write');
 invalidateActorPathSources297();expect(publisher.tail(row.fields.path,reference,pawn.path)).toBe(-1);
 expect(publisher.capture(pawn)).toStrictEqual(captureCoreActor297('human',0,pawn));
 pawn.path=points();const unknown=publisher.capture(pawn),cells=publisher.reference(pawn.path);shiftActorPath297(pawn.path);
 expect(publisher.tail(unknown.fields.path,cells,pawn.path)).toBe(9);
 const custom=withJournalTerrainReadScope(owner,()=>markActorPathCreated297(points()));let calls=0;
 custom.shift=()=>{calls++;return {x:99,z:99};};expect(withJournalTerrainReadScope(owner,()=>shiftActorPath297(custom))).toEqual({x:99,z:99});
 expect(calls).toBe(1);expect(actorPathSourcePosition297(custom,owner)).toBeUndefined();
});

test('canonical phase messages stay exact across consumed paths, Full resets and an unknown mutation',()=>{
 const world=fixture(),pawn=world.pawns[0]!,owner={},full=new CorePhasePublisher297(),closed=new SourceMotionPhasePublisher297(owner),encoder=new TerrainJournalSnapshotEncoder();
 pawn.path=withJournalTerrainReadScope(owner,()=>markActorPathCreated297(points()));encoder.encode(world,0,6,true);
 const anchor=(revision:number)=>{for(const publisher of [full,closed])publisher.commitFull(publisher.prepareFull(world,1,revision,[],coreMapId297(world),'frontier'),1000+revision);};anchor(1);
 for(let core=1;core<=9;core++){
  world.phaseCore297=core;pawn.planCooldown++;
  if(core===3||core===4)withJournalTerrainReadScope(owner,()=>shiftActorPath297(pawn.path));
  if(core===5){anchor(2);continue;}
  if(core===7){invalidateActorPathSources297();pawn.path.at(-1)!.x++;}
  const packets=[];
  for(const publisher of [full,closed]){
   publisher.observe({core,actorsChanged:[pawn.id],projectileEvents:{upserted:[],removed:[]},requiresFull:false},false,2000+core);
   const prepared=publisher.preparePhase(world,[],6);packets.push(structuredClone(prepared.packet));publisher.commitPhase(prepared,3000+core);
  }
  expect(packets[1]).toStrictEqual(packets[0]);
 }
});

test('uniform finite path suffix extents and heterogeneous fallbacks retain the complete Core copy contract',()=>{
 const world=fixture(),pawn=world.pawns[0]!;
 for(const source of [points(128),[{x:1,z:2,extra:{nested:1}},...points(127)]]){
  let token=captureOwnedCoreSourceData297(source),live=source;
  for(const consumed of [3,18,50,57]){
   live=live.slice(consumed);token=sliceOwnedCoreSourceData297(token,live,consumed);verifyOwnedCoreSourceData297(token);
   const actor={...pawn,path:live} as Pawn;
   expect(captureCoreActorSharedSource297('human',0,actor,false,undefined,token)).toStrictEqual(captureCoreActor297('human',0,actor));
  }
  expect(live).toEqual([]);
 }
});
