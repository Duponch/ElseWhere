import {expect,test,vi} from 'vitest';
import {ResidentMotionFrameOwner,hasOwnedResidentMotionCoreLimits297} from '../src/bridge/resident-motion';
import {CorePhaseFrameOwner297,hasOwnedCorePlaybackHistory297,readOwnedCoreTrackEdits297} from '../src/bridge/core-phase-owner-297';
import {captureNativeMessageForDeferred297} from '../src/bridge/native-message-capture';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {frozenDataInPlace297} from '../src/bridge/core-frozen-copy-297';
import {residentOwnerArray379,residentOwnerRecord379,isOrdinaryResidentOwnerArray379} from '../src/bridge/resident-owner-records-379';
import type {SnapshotMessage} from '../src/bridge/snapshots';
import type {World} from '../src/sim/types';
import type {PawnTrack} from '../src/bridge/motion-tracks';

// Numerical representation fixtures only; ordinary construction is not a
// fabricated Native receipt, played World, or phase/admission authority.
function ordinary(v:any):any {
 if(v===null||typeof v!=='object')return v;
 if(Array.isArray(v)){if(isOrdinaryResidentOwnerArray379(v))return v;const out=residentOwnerArray379();for(const value of v)out.push(ordinary(value));return out;}
 const out=residentOwnerRecord379({},{});for(const key of Object.keys(v))Object.defineProperty(out,key,{value:ordinary(v[key]),enumerable:true,writable:true,configurable:true});return out;
}
const edge=(at=20)=>({from:{x:10,z:10},to:{x:11,z:10},start:at,end:at+1});
const packet=(revision=1)=>({type:'snapshot',kind:revision===1?'checkpoint':'delta',epoch:1,revision,...revision===1?{}:{baseRevision:revision-1},stepMs:0,speed:1,world:{schemaVersion:379,tick:20,nextId:100},motion:0}) as unknown as SnapshotMessage<true>;
function section(rows:any[],revision=1,native=true){
 const data={epoch:1,revision,tick:20,checkpoint:revision===1,...revision===1?{}:{baseRevision:revision-1},section:{mode:'tracks',reset:revision===1,count:1,removed:[],rows}};
 return native?ordinary(data):data;
}
function prepare(segment:any,native=true){
 const owner=new ResidentMotionFrameOwner(),input=packet(),raw=section([{id:7,drop:0,keep:0,append:[segment]}],1,native),draft=owner.prepare(input,raw);if(!draft)throw Error('Motion representation refused');
 return {owner,input,raw,draft,motion:draft.publication.motion!};
}
function world():World{return {schemaVersion:379,tick:20,phaseCore297:0,width:32,height:32,nextId:100,tiles:[],pawns:[{id:7,x:10,z:10,state:'moving',moveCooldown:0,planCooldown:0,path:[{x:11,z:10}]}],projectiles:[]} as unknown as World;}
const metadata={mapId:0,core:200,projectilesRetained:[]};
function nodes(value:unknown):number {if(!value||typeof value!=='object')return 1;let total=1;for(const child of Array.isArray(value)?value:Object.values(value))total+=nodes(child);return total;}

test('only decoder-owned native track lists skip the redundant Full data walk; wrappers and public lists remain strict',()=>{
 const h=prepare(edge()),targets=new Set<object>();const collect=(v:unknown)=>{if(v&&typeof v==='object'){targets.add(v);for(const child of Array.isArray(v)?v:Object.values(v))collect(child);}};collect(h.motion);
 expect(hasOwnedResidentMotionCoreLimits297(h.motion)).toBe(true);expect(Object.isFrozen(h.motion)).toBe(true);expect(Object.isFrozen(h.motion[0]!.segments[0]!.from)).toBe(true);
 const read=Object.getOwnPropertyDescriptor;let reads=0;const spy=vi.spyOn(Object,'getOwnPropertyDescriptor').mockImplementation((v,key)=>{if(targets.has(v))reads++;return read(v,key);});
 try{const core=new CorePhaseFrameOwner297(),full=core.prepareFull(world(),1,1,h.motion,metadata,1);expect(full.projection.tracks).toBe(h.motion);expect(reads).toBe(0);}finally{spy.mockRestore();}
 const publicCopy=structuredClone(h.motion);expect(hasOwnedResidentMotionCoreLimits297(publicCopy)).toBe(false);expect(hasOwnedResidentMotionCoreLimits297(Object.freeze([...h.motion]))).toBe(false);
 expect(hasOwnedResidentMotionCoreLimits297(prepare(edge(),false).motion)).toBe(false);
 const wrapped=new Proxy(h.motion,{getPrototypeOf(){throw Error('strict Proxy read');}});expect(hasOwnedResidentMotionCoreLimits297(wrapped)).toBe(false);expect(()=>new CorePhaseFrameOwner297().prepareFull(world(),1,1,wrapped,metadata,1)).toThrow('strict Proxy read');
});

test('retained suffixes compose immutable occurrence extents and keep exact segment references and older lists',()=>{
 const owner=new ResidentMotionFrameOwner(),input=packet(),raw=section([{id:7,drop:0,keep:0,append:[edge(20),edge(21),edge(22)]}]),first=owner.prepare(input,raw)!;expect(first).toBeDefined();owner.commit(input,first.publication,first);
 const before=structuredClone(first.publication.motion),old=first.publication.motion!,next=owner.prepare(packet(2),section([{id:7,drop:1,keep:2,append:[edge(23)]}],2))!;expect(next).toBeDefined();
 expect(hasOwnedResidentMotionCoreLimits297(next.publication.motion)).toBe(true);expect(next.publication.motion![0]!.segments[0]).toBe(old[0]!.segments[1]);expect(next.publication.motion![0]!.segments[1]).toBe(old[0]!.segments[2]);expect(old).toStrictEqual(before);
 expect(frozenDataInPlace297(next.publication.motion)).toBe(next.publication.motion);expect(new CorePhaseFrameOwner297().prepareFull(world(),1,1,next.publication.motion,metadata,1).projection.tracks).toStrictEqual(next.publication.motion);
});

test('a native Full seeds track row slots and subsequent exact edits retain source order, histories and timeline revisions',()=>{
 const decoder=new ResidentMotionFrameOwner(),raw=section([{id:7,drop:0,keep:0,append:[edge(20)]},{id:9,drop:0,keep:0,append:[edge(20)]}]);raw.section.count=2;
 const motion=decoder.prepare(packet(),raw)!.publication.motion!;
 expect(hasOwnedResidentMotionCoreLimits297(motion)).toBe(true);
 const base=world();base.pawns.push({...base.pawns[0]!,id:9},{...base.pawns[0]!,id:11});
 const a=new CorePhaseFrameOwner297(),b=new CorePhaseFrameOwner297(),full=a.adoptFull(base,1,1,motion,metadata,1),literal=b.adoptFull(structuredClone(base),1,1,structuredClone(motion),metadata,1);
 const closed=new MotionTimeline(),publicTimeline=new MotionTimeline();closed.adopt(20,1,full.tracks,0,true,true,true);publicTimeline.adopt(20,1,literal.tracks,0,true,false,true);
 expect(hasOwnedCorePlaybackHistory297(full.tracks[1]!.segments)).toBe(true);
 const phase=(seq:number,tracks:unknown[])=>({type:'actor-phase-297',audioCues:[],epoch:1,mapId:0,baseRevision:1,phaseSeq:seq,nextId:100,fromCore:199+seq,toCore:200+seq,speed:1,actors:[],tracks,projectiles:{upserted:[],removed:[]}});
 const first=captureNativeMessageForDeferred297(phase(1,[{id:9,drop:0,keep:1,append:[edge(21)]},{id:7,drop:0,keep:1,append:[edge(21)]},{id:11,drop:0,keep:0,append:[edge(20)]}]));
 const x=a.commit(a.prepare(first)),y=b.commit(b.prepare(first));expect(x.tracks).toEqual(y.tracks);expect(x.tracks.map(t=>t.id)).toEqual([7,9,11]);
 expect(readOwnedCoreTrackEdits297(full.tracks,x.tracks)?.map(t=>t.id)).toEqual([7,9,11]);expect(readOwnedCoreTrackEdits297(literal.tracks,x.tracks)).toBeUndefined();expect(readOwnedCoreTrackEdits297(undefined,x.tracks)).toBeUndefined();
 expect(x.tracks[1]!.segments[0]).toBe(full.tracks[1]!.segments[0]);expect(full.tracks.map(t=>t.segments.length)).toEqual([1,1]);
 closed.adopt(20.1,1,x.tracks,10,false,true,true);publicTimeline.adopt(20.1,1,y.tracks,10,false,false,true);
 const next=captureNativeMessageForDeferred297(phase(2,[{id:9,drop:1,keep:1,append:[]}]));const m=a.commit(a.prepare(next)),n=b.commit(b.prepare(next));
 expect(m.tracks).toEqual(n.tracks);expect(m.tracks[0]).toBe(x.tracks[0]);expect(readOwnedCoreTrackEdits297(x.tracks,m.tracks)?.map(t=>t.id)).toEqual([9]);
 closed.adopt(20.2,1,m.tracks,20,false,true,true);publicTimeline.adopt(20.2,1,n.tracks,20,false,false,true);
 const no=captureNativeMessageForDeferred297(phase(3,[])),r=a.commit(a.prepare(no)),s=b.commit(b.prepare(no));expect(r.tracks).toBe(m.tracks);expect(r.tracks).toEqual(s.tracks);expect(readOwnedCoreTrackEdits297(m.tracks,r.tracks)).toEqual([]);
 closed.adopt(20.3,1,r.tracks,30,false,true,true);publicTimeline.adopt(20.3,1,s.tracks,30,false,false,true);
 expect(closed.playbackDiagnostics435()).toMatchObject({trackRowVisits:6,sparseTrackAdoptions:3});
 expect(publicTimeline.playbackDiagnostics435()).toMatchObject({trackRowVisits:11,sparseTrackAdoptions:0});
 for(const tick of [20,20.1,21,25]){closed.tick=publicTimeline.tick=tick;for(const id of [7,9,11])expect(closed.playbackSegment435(id)).toEqual(publicTimeline.segment(id));}
});

test('finite limits preserve the exact Full refusal for native and literal/non-native motion values',()=>{
 for(const native of [true,false]){
  const h=prepare({...edge(),stagger:[{start:20,end:Infinity}]},native);expect(hasOwnedResidentMotionCoreLimits297(h.motion)).toBe(false);
  expect(()=>new CorePhaseFrameOwner297().prepareFull(world(),1,1,h.motion,metadata,1)).toThrow('Nonfinite Core phase number');
 }
});

test('segment copy depth and outer wrapper offsets retain the original boundaries',()=>{
 const nested=(count:number)=>{let value:any=0;for(let i=0;i<count;i++)value={next:value};return value;};
 for(const native of [true,false]){
  const allowed=prepare({...edge(),stagger:nested(11)},native);expect(hasOwnedResidentMotionCoreLimits297(allowed.motion)).toBe(native);expect(()=>frozenDataInPlace297(allowed.motion)).not.toThrow();
  const owner=new ResidentMotionFrameOwner();expect(owner.prepare(packet(),section([{id:7,drop:0,keep:0,append:[{...edge(),stagger:nested(12)}]}],1,native))).toBeUndefined();
 }
});

test('unknown nested Proxy arrays and accessor inputs keep fallback/refusal without a cached data proof',()=>{
 const raw=section([{id:7,drop:0,keep:0,append:[{...edge(),stagger:[]}]}]),values=raw.section.rows[0].append[0];values.stagger=new Proxy([],{});
 const owner=new ResidentMotionFrameOwner(),draft=owner.prepare(packet(),raw);expect(draft).toBeDefined();expect(hasOwnedResidentMotionCoreLimits297(draft!.publication.motion)).toBe(false);
 let reads=0;const invalid=section([{id:7,drop:0,keep:0,append:[edge()]}]);Object.defineProperty(invalid.section.rows[0].append[0].from,'x',{enumerable:true,get(){reads++;return 10;}});
 expect(owner.prepare(packet(),invalid)).toBeUndefined();expect(reads).toBe(0);
});

test('the exact total occurrence boundary includes the list, track, ID and segment-array wrappers',()=>{
 const empty=prepare({...edge(),stagger:[]}).motion,base=nodes(empty),limit=1048576;
 for(const extra of [0,1]){
  const wide=residentOwnerArray379<number>();wide.length=limit-base+extra;wide.fill(0);
  const h=prepare({...edge(),stagger:wide});expect(hasOwnedResidentMotionCoreLimits297(h.motion)).toBe(extra===0);
  if(extra===0)expect(()=>frozenDataInPlace297(h.motion)).not.toThrow();else expect(()=>frozenDataInPlace297(h.motion)).toThrow('Core phase payload budget exceeded');
 }
},60000);
