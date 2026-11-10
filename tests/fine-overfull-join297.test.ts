import {expect,test} from 'vitest';
import {MotionTimeline} from '../src/render/MotionTimeline';
import type {PawnTrack} from '../src/bridge/motion-tracks';

// Confirmed-time playout after a delivery burst. A stalled main thread (or a
// producer catching up) delivers several confirmed frontiers at once; nominal
// playback never consumes that excess, so the display stayed that far behind
// the simulation until the next pause or speed change. Beyond 100 ms of excess
// history the timeline now joins its normal reserve, as after a late receipt.
// Numeric received-frontier tests only: no Worker, World or simulation claim.
const eps=1e-9,RATE=36,RESERVE=RATE*36/1000,EXCESS=RATE*.1;
function fine(t:MotionTimeline,tick:number,speed:number,now:number,reset=false,tracks:PawnTrack[]=[]){t.adopt(tick,speed,tracks,now,reset,true,true);}
const history=(t:MotionTimeline)=>(t as unknown as {latest:number}).latest-t.tick;
/** Regular speed-6 flow: a receipt of 0.72 tick every 20 ms, a frame every 5 ms. */
function regular(t:MotionTimeline,from:number,start:number,milliseconds:number,onFrame?:(moved:number)=>void):{latest:number;now:number}{
 let latest=from,now=start;
 for(let i=1;i*5<=milliseconds;i++){
  now=start+i*5;if(i%4===0){latest+=.72;fine(t,latest,6,now);}
  const before=t.tick;t.advance(now);onFrame?.(t.tick-before);
 }
 return{latest,now};
}

test('a regular confirmed flow is played at its nominal rate and never joined',()=>{
 const t=new MotionTimeline();fine(t,100,6,0,true);
 const started=regular(t,100,0,200);
 expect(history(t)).toBeGreaterThan(0);
 let largest=0;const end=regular(t,started.latest,started.now,2000,moved=>{largest=Math.max(largest,moved);});
 // No frame moves more than its own 5 ms of nominal time: no seek happened.
 expect(largest).toBeLessThanOrEqual(RATE*5/1000+eps);
 expect(history(t)).toBeLessThanOrEqual(RESERVE+.72+eps);expect(t.tick).toBeLessThanOrEqual(end.latest+eps);
});

test('a burst delivered after a stall no longer leaves the display hundreds of milliseconds behind',()=>{
 const t=new MotionTimeline();fine(t,100,6,0,true);
 const flow=regular(t,100,0,600);
 // 250 ms without a frame or a receipt, then twelve queued receipts at once.
 const now=flow.now+250;let latest=flow.latest;
 for(let i=0;i<12;i++){latest+=.7;fine(t,latest,6,now);expect(t.tick).toBeLessThanOrEqual(latest+eps);}
 // At most the reserve plus 100 ms of excess remains (it was 9 ticks, a quarter of a second, before).
 expect(history(t)).toBeLessThanOrEqual(RESERVE+EXCESS+eps);
 expect(history(t)).toBeGreaterThanOrEqual(RESERVE-eps);
 // Playback then continues from there without another seek, never past the
 // frontier, and stays within the same bound while the regular flow resumes.
 let largest=0;const after=regular(t,latest,now,600,moved=>{largest=Math.max(largest,moved);});
 expect(largest).toBeLessThanOrEqual(RATE*5/1000+eps);expect(t.tick).toBeLessThanOrEqual(after.latest+eps);
 expect(history(t)).toBeLessThanOrEqual(RESERVE+EXCESS+eps);
});

test('the join lands exactly on the normal reserve',()=>{
 const t=new MotionTimeline();fine(t,100,6,0,true);
 const flow=regular(t,100,0,600),now=flow.now+5;
 // One receipt far ahead: more than the reserve plus 100 ms of history.
 const latest=t.tick+RESERVE+EXCESS+2;fine(t,latest,6,now);
 expect(history(t)).toBeCloseTo(RESERVE,9);
});

test('an excess below 100 ms is left to ordinary playback',()=>{
 const t=new MotionTimeline();fine(t,100,6,0,true);
 const flow=regular(t,100,0,600),now=flow.now+5,before=t.tick;
 fine(t,before+RESERVE+EXCESS-.2,6,now);
 expect(t.tick).toBe(before);
});

test('a slow producer is never joined: its history stays below the reserve',()=>{
 // A saturated large colony at speed 6: one tick about every 118 ms.
 const t=new MotionTimeline();fine(t,100,6,0,true);
 let latest=100,now=0,seeks=0;
 for(let i=1;i<=30;i++){
  for(let f=0;f<23;f++){now+=5;t.advance(now);}
  now+=3;latest+=1;const before=t.tick;fine(t,latest,6,now);if(i>3&&t.tick>before+eps)seeks++;
  expect(history(t)).toBeLessThanOrEqual(RESERVE+EXCESS+eps);
 }
 expect(seeks).toBe(0);expect(t.tick).toBeLessThanOrEqual(latest+eps);
});

test('a pause, a startup reserve and the historical mode are unchanged',()=>{
 const t=new MotionTimeline();fine(t,100,6,0,true);
 // Startup: still waiting for its reserve, whatever arrives.
 fine(t,100.5,6,10);expect(t.tick).toBe(100);
 // A pause shows the confirmed frontier exactly.
 fine(t,130,0,20);expect(t.tick).toBe(130);
 // Historical (non-fine) playout keeps its two-tick policy: no join at any history.
 const old=new MotionTimeline();old.adopt(10,6,[],0,true);old.adopt(12,6,[],10);old.advance(15);const before=old.tick;
 old.adopt(40,6,[],20);expect(old.tick).toBe(before);
});
