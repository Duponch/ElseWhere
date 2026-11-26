import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/index';
import type {PresentationSegment} from '../src/sim/travel-timing';
import {ActorPlayback435,ConfirmedTrackCursor435,ownActorPlaybackWorld435,isActorPlaybackWorld435} from '../src/render/ActorPlayback435';
import {MotionTimeline} from '../src/render/MotionTimeline';

const edge=(start:number,end:number,x=0):PresentationSegment=>({from:{x,z:0},to:{x:x+1,z:0},start,end});
const linear=(segments:readonly PresentationSegment[],tick:number)=>{let found:PresentationSegment|undefined;for(const item of segments){if(item.start>tick)break;found=item;}return found;};

test('group readers share each ordered journal range while public snapshots and retained rows stay independent',()=>{
 const timeline=new MotionTimeline();
 const deliver=(...ids:number[])=>timeline.adopt(0,0,ids.map(id=>({id,segments:[]})),0,false,true);
 timeline.adopt(0,0,[],0,true,true);const before=timeline.playbackRevision435;
 deliver(2,1,2,-0);const one=timeline.playbackChanged435(before,true)!;
 expect(one).toEqual([2,1,0]);expect(Object.isFrozen(one)).toBe(true);
 expect(timeline.playbackChanged435(before,true)).toBe(one);
 const publicCopy=timeline.playbackChanged435(before) as number[];publicCopy[0]=55;
 expect(timeline.playbackChanged435(before)).toEqual([2,1,0]);
 deliver(1,3,2,4);const union=timeline.playbackChanged435(before,true)!;
 expect(union).toEqual([2,1,0,3,4]);expect(timeline.playbackChanged435(before,true)).toBe(union);
 expect(timeline.playbackChanged435(before+.5)).toEqual(union);
 expect(timeline.playbackChanged435(NaN)).toEqual([]);
 for(let i=0;i<130;i++)deliver(10+i);
 expect(timeline.playbackChanged435(before,true)).toBeUndefined();expect(one).toEqual([2,1,0]);expect(union).toEqual([2,1,0,3,4]);
 timeline.adopt(0,0,[],0,true,true);expect(timeline.playbackChanged435(timeline.playbackRevision435-1,true)).toBeUndefined();
});

test('caller-owned boundary storage preserves the independent public result across corrections and missing tracks',()=>{
 const timeline=new MotionTimeline(),first=edge(1,2),second=edge(2,7);
 timeline.adopt(0,1,[{id:5,segments:[first,second]}],0,true,true);timeline.tick=1;
 const held=timeline.playbackBoundary435(5),out={edge:undefined as PresentationSegment|undefined,next:Infinity};
 expect(timeline.playbackBoundary435(5,out)).toBe(out);expect(out).toEqual({edge:first,next:2});
 timeline.tick=2;expect(timeline.playbackBoundary435(5,out)).toEqual({edge:second,next:Infinity});
 expect(held).toEqual({edge:first,next:2});
 expect(timeline.playbackBoundary435(99,out)).toEqual({edge:undefined,next:Infinity});
});

test('closed cursor is the independent linear selection at every confirmed boundary, without mutating tracks',()=>{
 const cursor=new ConfirmedTrackCursor435();cursor.configure(true,true);
 const pieces=[edge(10,12),edge(12,12.5),edge(12,14,2),edge(14,16,3)],tracks=new Map([[7,pieces]]),before=JSON.stringify(pieces);
 for(const tick of [0,9.99,10,10.5,11.9,12,12.1,13.9,14,16,100])expect(cursor.segment(tracks,7,tick)).toBe(linear(pieces,tick));
 expect(cursor.stats.steps).toBe(pieces.length);expect(cursor.stats.restarts).toBe(1);expect(JSON.stringify(pieces)).toBe(before);
});

test('replacement, trim, same-tick correction, rewind and reset revoke the closed cursor',()=>{
 const c=new ConfirmedTrackCursor435(),a=[edge(10,12),edge(12,14)],tracks=new Map([[1,a]]);c.configure(true,true);
 expect(c.segment(tracks,1,13)).toBe(a[1]);expect(c.segment(tracks,1,10)).toBe(a[0]);
 const corrected=[edge(10,13,9),edge(13,14,10)];tracks.set(1,corrected);expect(c.segment(tracks,1,10)).toBe(corrected[0]);
 tracks.set(1,corrected.slice(1));expect(c.segment(tracks,1,10)).toBeUndefined();expect(c.segment(tracks,1,13)).toBe(corrected[1]);
 const generation=c.generation;c.configure(true,true);expect(c.generation).toBe(generation+1);expect(c.segment(tracks,1,13)).toBe(corrected[1]);
 tracks.delete(1);expect(c.segment(tracks,1,14)).toBeUndefined();tracks.set(1,a);expect(c.segment(tracks,1,13)).toBe(a[1]);
});

test('public mutable timeline keeps historical linear semantics including in-place correction and append',()=>{
 const timeline=new MotionTimeline(),pieces=[edge(10,12),edge(12,14)];timeline.adopt(14,1,[{id:1,segments:pieces}],0,true);
 timeline.tick=13;expect(timeline.playbackEnabled435).toBe(false);expect(timeline.playbackSegment435(1)).toBe(timeline.segment(1));
 pieces[1]!.start=14;expect(timeline.playbackSegment435(1)).toBe(pieces[0]);pieces.push(edge(12.5,16,4));
 // The literal legacy traversal stops at the first future edge, even for a malformed public list.
 expect(timeline.playbackSegment435(1)).toBe(timeline.segment(1));
 pieces.splice(1,1);expect(timeline.playbackSegment435(1)).toBe(pieces[1]);
 const world=createWorld();Object.freeze(world);expect(isActorPlaybackWorld435(world)).toBe(false);
});

test('resident ownership publishes only adoption, edge, phase, origin and confirmed reset boundaries',()=>{
 const world=createWorld(),actor={id:1,motion:edge(100,104)},playback=new ActorPlayback435<typeof actor>(),timeline=new MotionTimeline();
 ownActorPlaybackWorld435(world,true);playback.prepare(world,[actor]);timeline.adopt(104,1,[{id:1,segments:[actor.motion]}],0,true,true);
 const visit=(tick:number,origin=0)=>{timeline.tick=tick;expect(playback.beginFrame(timeline)).toBe(true);const selected=playback.select(0,timeline,tick,origin);playback.commit();return selected;};
 expect(visit(99)).toBeDefined();expect(visit(99.5)).toBeUndefined();expect(visit(100)).toBeDefined();expect(visit(101)).toBeUndefined();expect(visit(104)).toBeDefined();expect(visit(104.5)).toBeUndefined();
 expect(visit(1024,1024)).toBeDefined();expect(visit(1024.5,1024)).toBeUndefined();timeline.adopt(104,0,[],1,true,true);expect(visit(104)).toBeDefined();
 expect(playback.snapshot().skips).toBeGreaterThan(0);expect(actor.motion).toEqual(edge(100,104));
});

test('adoption and explicit endpoint invalidation preserve slot identity while revoking publication',()=>{
 const world=createWorld(),a={id:1},b={id:2},p=new ActorPlayback435<typeof a>();ownActorPlaybackWorld435(world,true);p.prepare(world,[a,b]);
 expect(p.beginFrame(undefined)).toBe(true);expect(p.select(0,undefined,0,0)?.id).toBe(1);expect(p.select(1,undefined,0,0)?.id).toBe(2);p.commit();
 expect(p.select(0,undefined,0,0)).toBeUndefined();p.prepare(world,[b,a],true);expect(p.select(0,undefined,0,0)?.id).toBe(2);expect(p.select(1,undefined,0,0)?.id).toBe(1);p.commit();
 ownActorPlaybackWorld435(world,false);p.prepare(world,[a]);expect(p.beginFrame(undefined)).toBe(false);expect(p.snapshot().actors).toBe(0);p.clear();
});

test('nullable motion is absence and Pawn policy never introduces an actor-motion fallback',()=>{
 const world=createWorld(),actor:{id:number;motion:PresentationSegment|null}={id:1,motion:null},ordinary=new ActorPlayback435<typeof actor>(),pawn=new ActorPlayback435<typeof actor>(()=>false,false);ownActorPlaybackWorld435(world,true);
 ordinary.prepare(world,[actor]);ordinary.beginFrame(undefined);expect(ordinary.select(0,undefined,0,0)?.edge).toBeUndefined();ordinary.commit();
 actor.motion=edge(0,4);pawn.prepare(world,[actor]);pawn.beginFrame(undefined);expect(pawn.select(0,undefined,0,0)?.edge).toBeUndefined();pawn.commit();
});

test('dependent carriers visit every frame and failed batches revoke native key caches before retry',()=>{
 const world=createWorld(),actors=[{id:1,dependent:true},{id:2,dependent:false}],p=new ActorPlayback435<typeof actors[number]>(a=>a.dependent);ownActorPlaybackWorld435(world,true);p.prepare(world,actors);
 p.beginFrame(undefined);p.select(0,undefined,0,0);p.select(1,undefined,0,0);p.commit();
 p.beginFrame(undefined);expect(p.select(0,undefined,0,0)).toBeDefined();expect(p.select(1,undefined,0,0)).toBeUndefined();
 // No commit simulates an exception after some endpoint writes.
 p.beginFrame(undefined);expect(p.retrying).toBe(true);expect(p.select(0,undefined,0,0)).toBeDefined();p.commit();expect(p.snapshot().retries).toBe(1);expect(p.snapshot().dependentVisits).toBe(3);
});

test('clock buffering, starvation, pause, resume and speed changes remain identical to the public timeline',()=>{
 const native=new MotionTimeline(),closed=new MotionTimeline(),tracks=[{id:1,segments:[edge(100,130)]}];
 for(const [tick,speed,now,reset] of [[100,1,0,true],[103,1,10,false],[106,3,40,false],[108,0,70,false],[110,0,100,false],[113,1,130,false]] as const){
  native.adopt(tick,speed,tracks,now,reset);closed.adopt(tick,speed,tracks,now,reset,true);
  for(const at of [now,now+4,now+16]){expect(closed.advance(at)).toBe(native.advance(at));expect(closed.playbackSegment435(1)).toBe(closed.segment(1));}
 }
});

test('immutable owner reschedules corrected boundaries without retaining stale events',()=>{
 const world=createWorld(),actors=[{id:1,dependent:true},{id:2,dependent:false},{id:3,dependent:false}],p=new ActorPlayback435<typeof actors[number]>(actor=>actor.dependent),timeline=new MotionTimeline();ownActorPlaybackWorld435(world,true);p.prepare(world,actors);
 const frozen=(start:number,end:number)=>{const value=edge(start,end);Object.freeze(value.from);Object.freeze(value.to);Object.freeze(value);const segments=[value];Object.freeze(segments);return segments;};
 timeline.adopt(0,1,actors.map(actor=>({id:actor.id,segments:frozen(10,10000)})),0,true,true);
 const at=(tick:number)=>{timeline.tick=tick;expect(p.beginFrame(timeline)).toBe(true);const rows=p.frameIndices435(timeline,tick,0)!;for(const index of rows)p.select(index,timeline,tick,0);p.commit();return rows;};
 expect(at(0)).toEqual([0,1,2]);expect(p.snapshot().scheduledBoundaries).toBe(3);
 for(let i=0;i<100;i++)expect(at(1)).toEqual([0]);expect(p.snapshot().scheduledBoundaries).toBe(3);
 for(let n=0;n<250;n++){timeline.adopt(2,1,[{id:2,segments:frozen(100+n,10000+n)}],n,false,true);expect(at(2)).toEqual([0,1]);expect(p.snapshot().scheduledBoundaries).toBe(3);}
 expect(at(10)).toEqual([0,2]);expect(at(348)).toEqual([0]);expect(at(349)).toEqual([0,1]);expect(at(10250)).toEqual([0,1,2]);expect(p.snapshot().scheduledBoundaries).toBe(0);
 // A public reader may keep the Map and mutate a historical edge. It forfeits
 // the private schedule rather than losing that ordinary observable update.
 timeline.tracks;expect(p.beginFrame(timeline)).toBe(false);expect(p.frameIndices435(timeline,10250,0)).toBeUndefined();
});

test('frame work preserves sorted slot order and snapshots springs before endpoint writers run',()=>{
 const world=createWorld(),actors=Array.from({length:97},(_,i)=>({id:1000+i,dependent:i===31||i===63||i===96}));
 const timeline=new MotionTimeline(),playback=new ActorPlayback435<typeof actors[number]>(actor=>actor.dependent);
 ownActorPlaybackWorld435(world,true);playback.prepare(world,actors);
 timeline.adopt(0,1,[],0,true,true);
 playback.beginFrame(timeline);
 const retained=playback.frameIndices435(timeline,0,0)!;
 for(const i of retained)playback.select(i,timeline,0,0);
 playback.commit();
 const springs=new Set([80,31,32,0,64,180]);
 for(let frame=0;frame<2;frame++){
  playback.beginFrame(timeline);
  const snapshot=playback.frameSlots435(timeline,1,0)!;snapshot.includeSprings(springs);
  const expected=frame===0?[0,31,32,63,64,80,96]:[31,62,63,96];
  springs.clear();springs.add(62);
  const visited:number[]=[],endpoints:number[]=[];
  for(let i=snapshot.next(0);i>=0;i=snapshot.next(i+1)){
   visited.push(i);if(snapshot.isEndpoint(i)){endpoints.push(i);playback.select(i,timeline,1,0);}
  }
  expect(endpoints).toEqual([31,63,96]);expect(visited).toEqual(expected);expect(snapshot.endpointCount).toBe(3);
  playback.commit();
 }
 expect(retained).toEqual(actors.map((_,i)=>i));
 playback.prepare(world,actors.slice(0,32),true);playback.beginFrame(timeline);
 expect(playback.frameIndices435(timeline,1,0)).toEqual(actors.slice(0,32).map((_,i)=>i));
});
