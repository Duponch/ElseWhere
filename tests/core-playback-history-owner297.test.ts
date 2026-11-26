import {expect,test} from 'vitest';
import {CorePhaseFrameOwner297,hasOwnedCorePlaybackHistory297} from '../src/bridge/core-phase-owner-297';
import {captureNativeMessageForDeferred297} from '../src/bridge/native-message-capture';
import {MotionTimeline} from '../src/render/MotionTimeline';
import type {World} from '../src/sim/types';
import type {PresentationSegment} from '../src/sim/travel-timing';

const edge=(start:number):PresentationSegment=>({from:{x:10,z:10},to:{x:11,z:10},start,end:start+1});
const owner=(segments:PresentationSegment[]=[])=>{
 const core=new CorePhaseFrameOwner297(),world={schemaVersion:379,tick:20,phaseCore297:0,width:32,height:32,nextId:100,tiles:[],pawns:[{id:7,x:10,z:10,state:'moving',moveCooldown:0,planCooldown:0,path:[]}],projectiles:[]} as unknown as World;
 const full=core.adoptFull(world,1,1,[{id:7,segments}],{mapId:0,core:200,projectilesRetained:[],actorMode297:'frontier'},1);
 return {core,full};
};
const phase=(seq:number,keep:number,append:PresentationSegment[],drop=0)=>({type:'actor-frontier-297',audioCues:[],epoch:1,mapId:0,baseRevision:1,phaseSeq:seq,nextId:100,fromCore:199+seq,toCore:200+seq,speed:1,actors:[],tracks:[{id:7,drop,keep,append}],projectiles:{upserted:[],removed:[]}});

test('captured new histories inherit exact proof only over their validated retained elements',()=>{
 const {core,full}=owner();
 expect(hasOwnedCorePlaybackHistory297(full.tracks[0]!.segments)).toBe(false);
 const first=core.commit(core.prepare(captureNativeMessageForDeferred297(phase(1,0,[edge(20)]))));
 const history=first.tracks[0]!.segments;
 expect(hasOwnedCorePlaybackHistory297(history)).toBe(true);
 const second=core.commit(core.prepare(captureNativeMessageForDeferred297(phase(2,1,[edge(21)]))));
 expect(hasOwnedCorePlaybackHistory297(second.tracks[0]!.segments)).toBe(true);
 expect(second.tracks[0]!.segments[0]).toBe(history[0]);
 const trimmed=core.commit(core.prepare(captureNativeMessageForDeferred297(phase(3,1,[],1))));
 expect(hasOwnedCorePlaybackHistory297(trimmed.tracks[0]!.segments)).toBe(true);
 expect(trimmed.tracks[0]!.segments[0]).toBe(second.tracks[0]!.segments[1]);
 expect(history).toEqual([edge(20)]);
 const timeline=new MotionTimeline();timeline.adopt(20.3,1,trimmed.tracks,0,true,true,true);
 timeline.tick=21;expect(timeline.playbackSegment435(7)).toBe(trimmed.tracks[0]!.segments[0]);
 expect(timeline.playbackOwned435).toBe(true);
});

test('a public Full or uncaptured phase never acquires a proof from frozen wrappers',()=>{
 const first=owner([edge(20)]),a=first.core.commit(first.core.prepare(captureNativeMessageForDeferred297(phase(1,1,[edge(21)]))));
 expect(hasOwnedCorePlaybackHistory297(a.tracks[0]!.segments)).toBe(false);
 const second=owner(),b=second.core.commit(second.core.prepare(phase(1,0,[edge(20)])));
 expect(Object.isFrozen(b.tracks[0]!.segments)).toBe(true);
 expect(hasOwnedCorePlaybackHistory297(b.tracks[0]!.segments)).toBe(false);
 const timeline=new MotionTimeline();timeline.adopt(20.1,1,b.tracks,0,true,true,true);
 expect(timeline.playbackOwned435).toBe(true); // original exhaustive fallback
});
