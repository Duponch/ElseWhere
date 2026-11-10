interface HarvestPhase {
  action:string; starvedFrames?:number; controls:{delay:number|null}[];
  jumpCount:number; solidOccupancyCount:number; errors:string[];
  remainingJobs:number; initialJobs:number; removals:{play:number;tick:number}[];
}

interface PresentedFrame { at:number; play:number; speed:number }

export interface TravelFrameWitness {
  /** Position read from the shared pawn pose attributes at this RAF. */
  position:{x:number;z:number};
  /** The same frame's GPU aFrom/aTo and aTravel x/y, in local seconds. */
  from:{x:number;z:number};to:{x:number;z:number};start:number;end:number;time:number;
  /** Confirmed presentation time and its authoritative grid edge, in ticks. */
  play:number;
  segment:{from:{x:number;z:number};to:{x:number;z:number};start:number;end:number};
}

/** Prove a raw >13 cells/s alarm follows one unchanged confirmed edge or
 * exactly one contiguous confirmed boundary, with bounded contact poses.
 * Injected into the browser via toString(): every check stays local. */
export function confirmedTravelExcess(previous:TravelFrameWitness,current:TravelFrameWitness,dt:number):boolean {
  const finite=(value:number)=>Number.isFinite(value);
  const cell=(value:{x:number;z:number}|null|undefined)=>!!value&&finite(value.x)&&finite(value.z);
  const witness=(value:TravelFrameWitness|null|undefined)=>!!value&&cell(value.position)&&cell(value.from)&&cell(value.to)
    &&finite(value.start)&&finite(value.end)&&finite(value.time)&&finite(value.play)
    &&value.segment&&cell(value.segment.from)&&cell(value.segment.to)
    &&finite(value.segment.start)&&finite(value.segment.end);
  if(!witness(previous)||!witness(current)||!finite(dt)||dt<=0||dt>=100)return false;
  const distance=Math.hypot(current.position.x-previous.position.x,current.position.z-previous.position.z);
  if(!(distance>dt*.013+.02))return false; // Preserve the original raw alarm.
  const a=previous.segment,b=current.segment;
  // Live actor roots. The renderer now writes an actor's current position as
  // both ends of a zero-length leg, so no GPU leg exists to compare. The same
  // proof is then made on the displayed position itself: in both frames it
  // sits on its confirmed one-cell edge at the confirmed time, the two edges
  // are one edge or exactly contiguous, and time advanced no faster than the
  // x6 budget. Same tolerances as the leg proof; nothing bridges a gap.
  const live=(w:TravelFrameWitness)=>w.start===0&&w.end===0&&w.from.x===w.to.x&&w.from.z===w.to.z&&w.from.x===w.position.x&&w.from.z===w.position.z;
  if(live(previous)&&live(current)){
    const sameEdge=a.start===b.start&&a.end===b.end&&a.from.x===b.from.x&&a.from.z===b.from.z&&a.to.x===b.to.x&&a.to.z===b.to.z;
    const nextEdge=a.to.x===b.from.x&&a.to.z===b.from.z&&a.end===b.start;
    if(!sameEdge&&!nextEdge)return false;
    const LIVE_EPS_POSITION=.0002,LIVE_EPS_TICKS=.0006;
    for(const frame of [previous,current]){
      const s=frame.segment;
      if(!Number.isInteger(s.from.x)||!Number.isInteger(s.from.z)||!Number.isInteger(s.to.x)||!Number.isInteger(s.to.z)
        ||Math.max(Math.abs(s.to.x-s.from.x),Math.abs(s.to.z-s.from.z))!==1||s.end<=s.start)return false;
      if(frame.play<s.start||frame.play>s.end)return false;
      const alpha=(frame.play-s.start)/(s.end-s.start);
      if(Math.hypot(frame.position.x-(s.from.x+(s.to.x-s.from.x)*alpha),frame.position.z-(s.from.z+(s.to.z-s.from.z)*alpha))>LIVE_EPS_POSITION)return false;
    }
    const ticks=current.play-previous.play;
    if(ticks<=0||ticks>dt*.036+LIVE_EPS_TICKS)return false;
    const length=(s:TravelFrameWitness['segment'])=>Math.hypot(s.to.x-s.from.x,s.to.z-s.from.z);
    const arc=sameEdge?ticks/(a.end-a.start)*length(a)
      :(a.end-previous.play)/(a.end-a.start)*length(a)+(current.play-b.start)/(b.end-b.start)*length(b);
    return distance<=arc+2*LIVE_EPS_POSITION;
  }
  const unchanged=a.start===b.start&&a.end===b.end&&a.from.x===b.from.x&&a.from.z===b.from.z&&a.to.x===b.to.x&&a.to.z===b.to.z
    &&previous.from.x===current.from.x&&previous.from.z===current.from.z
    &&previous.to.x===current.to.x&&previous.to.z===current.to.z
    &&previous.start===current.start&&previous.end===current.end;
  // Both authorities must meet at precisely the same cell and timestamp.
  // No tolerance bridges a gap, overlap, changed junction offset or missing leg.
  const contiguous=a.to.x===b.from.x&&a.to.z===b.from.z&&a.end===b.start
    &&previous.to.x===current.from.x&&previous.to.z===current.from.z&&previous.end===current.start;
  if(!unchanged&&!contiguous)return false;
  const EPS_POSITION=.0002,EPS_ALPHA=.0002,EPS_SECONDS=.0001,EPS_TICKS=.0006;
  for(const frame of [previous,current]){
    const s=frame.segment;
    if(!Number.isInteger(s.from.x)||!Number.isInteger(s.from.z)||!Number.isInteger(s.to.x)||!Number.isInteger(s.to.z)
      ||Math.max(Math.abs(s.to.x-s.from.x),Math.abs(s.to.z-s.from.z))!==1||s.end<=s.start||frame.end<=frame.start)return false;
    // Each observed GPU leg independently remains within the existing0.30-cell
    // contact envelope of its own authoritative grid endpoints.
    if(Math.hypot(frame.from.x-s.from.x,frame.from.z-s.from.z)>.30
      ||Math.hypot(frame.to.x-s.to.x,frame.to.z-s.to.z)>.30)return false;
    if(Math.abs((frame.end-frame.start)-(s.end-s.start)/6)>EPS_SECONDS)return false;
    if(frame.play<s.start||frame.play>s.end||frame.time<frame.start||frame.time>frame.end)return false;
    const alphaTime=(frame.time-frame.start)/(frame.end-frame.start);
    const alphaPlay=(frame.play-s.start)/(s.end-s.start);
    if(Math.abs(alphaTime-alphaPlay)>EPS_ALPHA
      ||Math.hypot(frame.position.x-(frame.from.x+(frame.to.x-frame.from.x)*alphaTime),
        frame.position.z-(frame.from.z+(frame.to.z-frame.from.z)*alphaTime))>EPS_POSITION)return false;
  }
  const ticks=current.play-previous.play,seconds=current.time-previous.time;
  if(ticks<=0||seconds<=0||Math.abs(seconds-ticks/6)>EPS_SECONDS
    ||ticks>dt*.036+EPS_TICKS||seconds>dt*.006+EPS_SECONDS)return false;
  if(contiguous){
    // The two witnessed portions, and only those, bound the travelled arc.
    // A chord/warp beyond their timestamp-derived length cannot be continuous.
    const before=(a.end-previous.play)/(a.end-a.start),after=(current.play-b.start)/(b.end-b.start);
    const arc=before*Math.hypot(previous.to.x-previous.from.x,previous.to.z-previous.from.z)
      +after*Math.hypot(current.to.x-current.from.x,current.to.z-current.from.z);
    if(distance>arc+2*EPS_POSITION)return false;
  }
  return true;
}

/** Detect a sustained absence of presented-tick progress, not merely two
 * successive 240 Hz images with the same tick after one second of play. */
export function presentationStarvations<T extends PresentedFrame>(frames:readonly T[]):{previous:T;current:T}[] {
  const stalls:{previous:T;current:T}[]=[];
  let anchor=frames[0],prior=frames[0],reported=false;
  for(let i=1;i<frames.length;i++) {
    const frame=frames[i]!;
    if(!anchor||!prior||frame.speed<=0||prior.speed<=0||frame.speed!==prior.speed||frame.play!==prior.play) {
      anchor=frame;reported=false;
    } else if(!reported&&frame.at-anchor.at>1000) {
      stalls.push({previous:anchor,current:frame});reported=true;
    }
    prior=frame;
  }
  return stalls;
}

/** A frame straddling confirmation already visibly changes speed. Requiring a
 * whole interval at the final rate measures settling one frame later instead.
 * A freeze, overshoot, unchanged rate or non-finite sample is never a response. */
export function visibleSpeedResponse(delta:number,dt:number,previousSpeed:number,speed:number):boolean {
  if(!Number.isFinite(delta)||!Number.isFinite(dt)||dt<=0||previousSpeed===speed)return false;
  // Independent reference rate: 6000 local ticks per 1000-second Core day.
  const rate=delta/dt*1000/6,low=Math.min(previousSpeed,speed),high=Math.max(previousSpeed,speed);
  return rate>=low-1e-6&&rate<=high+1e-6&&(rate-previousSpeed)*Math.sign(speed-previousSpeed)>1e-6;
}

/** User-visible acceptance, shared by the native runner and recorded controls.
 * Missing observations are not a pass. Timing budget is explicit, not inferred
 * from the renderer's buffer constants or the final simulation state. */
export function assertHarvestPhase(phase:HarvestPhase,verifySpeed=true,verifyActions=true,switches=true):void {
  if(verifySpeed&&(phase.starvedFrames!==0||switches&&phase.controls.length<3
    ||phase.controls.some(c=>c.delay===null||!Number.isFinite(c.delay)||c.delay<0||c.delay>100)))throw Error('Delayed speed controls: '+phase.action);
  if(verifyActions&&(phase.jumpCount||phase.solidOccupancyCount||phase.errors.length
    ||phase.remainingJobs>=phase.initialJobs||!phase.removals.length||phase.removals.some(r=>r.play<r.tick)))throw Error('Harvest presentation regression: '+phase.action);
}
