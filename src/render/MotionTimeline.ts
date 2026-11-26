import {ConfirmedTrackCursor435} from './ActorPlayback435';
import {hasOwnedCorePlaybackHistory297,readOwnedCoreTrackEdits297} from '../bridge/core-phase-owner-297';
import type { PawnTrack } from '../bridge/motion-tracks';
import { LOCAL_TICKS_PER_SECOND,CORE_TICKS_PER_SECOND } from '../bridge/clock-rate';
import type { PresentationSegment as TravelSegment } from '../sim/travel-timing';

// Two ticks cover the tested 20 ms worker cadence + 0/20 ms delivery jitter,
// without retaining 2/3 second of input latency at 1x. Longer stalls can still
// starve playback. A tick-based reserve preserves immediate speed changes.
export const MOTION_BUFFER_TICKS = 2;

// A bounded36ms presentation reserve for ordinary confirmed fine receipts.
// It does not guarantee immunity to transport jitter or delayed RAF delivery.
const FINE_BUFFER_MS297=36;
const FINE_LATE_RECEIPT_MS297=100;
const FINE_RATE_WINDOW_MIN_MS297=40,FINE_RATE_WINDOW_MAX_MS297=200;
const FINE_RATE_FILTER_MS297=80,FINE_RATE_CORRECTION_SECONDS297=.1;
const FINE_BUFFER_BUDGET_SECONDS297=.08,FINE_OVERFULL_SECONDS297=.1;
const FINE_CORE_QUANTUM297=LOCAL_TICKS_PER_SECOND/CORE_TICKS_PER_SECOND;
// A running speed change plays at the mean of the old and new rates until the
// confirmed history meets the new reserve; about 70 ms for a regular producer.
const FINE_TRANSITION_MAX_MS297=250;
/** Confirmed-time playout. Ordinary fine297 receipts add history without a seek.
 * Startup and a genuinely late receipt may join the bounded confirmed reserve;
 * pause joins the confirmed frontier exactly. Neither mode extrapolates. */
/** Fine297 running speed change: from its change on, playback moves at `rate`
 * until the confirmed history reaches the new reserve (`up`) or drains to it,
 * or until `until` (wall ms). No freeze, no seek, no jump. */
type Transition297={rate:number;up:boolean;until:number};
const immutablePlaybackHistories435=new WeakSet<readonly TravelSegment[]>();
const noPlaybackChanges435:readonly number[]=Object.freeze([]);
/** Closed MAIN history is own data, detached and frozen by its decoder. A
 * literal mutable history never receives a boundary lifetime. Accessors also
 * stay on the ordinary read path even when their containing objects froze. */
function immutablePlaybackHistory435(segments:readonly TravelSegment[]):boolean{
 if(hasOwnedCorePlaybackHistory297(segments))return true;
 if(immutablePlaybackHistories435.has(segments))return true;
 if(!Array.isArray(segments)||!Object.isFrozen(segments))return false;
 const data=(value:object,key:string)=>Object.getOwnPropertyDescriptor(value,key);
 for(let i=0;i<segments.length;i++){
  const descriptor=data(segments,String(i)),edge=descriptor&&'value'in descriptor?descriptor.value as TravelSegment:undefined;
  if(!edge||!Object.isFrozen(edge))return false;
  for(const key of ['start','end','from','to']){const field=data(edge,key);if(!field||!('value'in field))return false;}
  for(const key of ['edgeStart','fromFraction','toFraction']){const field=data(edge,key);if(field&&!('value'in field))return false;}
  for(const point of [edge.from,edge.to]){if(!point||!Object.isFrozen(point))return false;for(const key of ['x','z']){const field=data(point,key);if(!field||!('value'in field))return false;}}
 }
 immutablePlaybackHistories435.add(segments);return true;
}
export class MotionTimeline {
  private readonly playbackCursor435=new ConfirmedTrackCursor435();
  get playbackEnabled435():boolean{return this.playbackCursor435.enabled;}
  get playbackGeneration435():number{return this.playbackCursor435.generation;}
  playbackSegment435(id:number):TravelSegment|undefined{return this.playbackCursor435.segment(this.trackStore435,id,this.tick);}
  private readonly trackStore435=new Map<number,TravelSegment[]>();
  private trackStoreEscaped435=false;
  private lastOwnedTracks435:readonly PawnTrack[]|undefined;
  private trackRowVisits435=0;
  private sparseTrackAdoptions435=0;
  private readonly mutableHistories435=new Set<number>();
  private trackRevision435=0;
  private readonly trackChanges435:{revision:number;ids:readonly number[]}[]=[];
  get playbackOwned435():boolean{return this.playbackEnabled435&&!this.trackStoreEscaped435&&this.mutableHistories435.size===0;}
  get playbackRevision435():number{return this.trackRevision435;}
  playbackBoundary435(id:number):{edge:TravelSegment|undefined;next:number}{return this.playbackCursor435.boundary(this.trackStore435,id,this.tick);}
  playbackChanged435(after:number):readonly number[]|undefined{
   if(after===this.trackRevision435)return noPlaybackChanges435;
   if(after<0||!this.trackChanges435.length||after<this.trackChanges435[0]!.revision-1||after>this.trackRevision435)return;
   const changed=new Set<number>();for(const frame of this.trackChanges435)if(frame.revision>after)for(const id of frame.ids)changed.add(id);return[...changed];
  }
  playbackDiagnostics435(){return{enabled:this.playbackCursor435.enabled,generation:this.playbackCursor435.generation,...this.playbackCursor435.stats,trackRowVisits:this.trackRowVisits435,sparseTrackAdoptions:this.sparseTrackAdoptions435};}
  /** Preserve the mutable public Map. Once exposed it can be retained and
   * edited through any Map method, so this timeline permanently gives up the
   * private schedule and its immutable cursor. No mutation observer is used. */
  get tracks():Map<number,TravelSegment[]>{this.trackStoreEscaped435=true;this.playbackCursor435.configure(false,false);return this.trackStore435;}
  private adoptTracks435(tracks:readonly PawnTrack[]):void{
   const changed:number[]=[];
   const closed=this.playbackCursor435.enabled&&!this.trackStoreEscaped435;
   const edits=closed?readOwnedCoreTrackEdits297(this.lastOwnedTracks435,tracks):undefined;
   this.trackRowVisits435+=(edits??tracks).length;if(edits)this.sparseTrackAdoptions435++;
   for(const track of edits??tracks){if(this.trackStore435.get(track.id)===track.segments)continue;this.trackStore435.set(track.id,track.segments);changed.push(track.id);if(immutablePlaybackHistory435(track.segments))this.mutableHistories435.delete(track.id);else this.mutableHistories435.add(track.id);}
   this.lastOwnedTracks435=closed?tracks:undefined;
   if(changed.length){this.trackRevision435++;this.trackChanges435.push({revision:this.trackRevision435,ids:changed});if(this.trackChanges435.length>128)this.trackChanges435.shift();}
  }
  tick=0;
  private latest=0;
  private rate=0;
  private frameRate=0;
  private readonly rateChanges:{at:number;rate:number;transition?:Transition297}[]=[];
  private speed=0;
  private previous=0;
  private ready=Infinity;
  private buffering=true;
  private reserve=MOTION_BUFFER_TICKS;
  // Advancing-front age: duplicate packets must not hide a true supply outage.
  private lastFineReceipt297:number|undefined;
  private fineCore297=false;
  private fineWindowAt297=0;
  private fineWindowTick297=0;
  private fineEstimateAt297=0;
  private fineEstimatedRate297=0;
  private fineFrameRate297=0;
  private fineNominalCompatible297=true;
  private fineOverfull297=false;
  private fineStartupProgressPending297=false;
  /** The transition playing now; a pending one rides on its rate change. */
  private transition297:Transition297|undefined;
  private get inTransition297():boolean{return !!this.transition297||this.rateChanges.some(change=>!!change.transition);}
  /** Ends the playing and pending transitions. */
  private endTransition297(now:number):void {
    if(!this.inTransition297)return;
    this.transition297=undefined;for(const change of this.rateChanges)delete change.transition;
    // The transition itself is not a supply sample: estimate from here.
    this.resetFineRate297(this.latest,now,this.rate);this.fineStartupProgressPending297=false;
  }
  private resetFineRate297(tick:number,now:number,rate:number):void {
    this.fineWindowAt297=this.fineEstimateAt297=now;this.fineWindowTick297=tick;
    this.fineEstimatedRate297=rate;this.fineNominalCompatible297=true;this.fineOverfull297=false;
  }
  private observeFineRate297(tick:number,now:number):void {
    const span=now-this.fineWindowAt297;if(span<FINE_RATE_WINDOW_MIN_MS297)return;
    const elapsed=now-this.fineEstimateAt297;if(elapsed<=0)return;
    const progress=Math.max(0,tick-this.fineWindowTick297),rate=this.rate;
    // One integer Core of quantization is not evidence of a slower producer.
    const compatible=progress+FINE_CORE_QUANTUM297+1e-10>=rate*span/1000;
    const sample=compatible?rate:Math.max(0,Math.min(rate,progress*1000/span));
    const alpha=elapsed/(FINE_RATE_FILTER_MS297+elapsed);
    this.fineEstimatedRate297+=(sample-this.fineEstimatedRate297)*alpha;
    this.fineEstimateAt297=now;if(!compatible||span>=FINE_RATE_WINDOW_MAX_MS297)this.fineNominalCompatible297=compatible;
    if(span>=FINE_RATE_WINDOW_MAX_MS297){this.fineWindowAt297=now;this.fineWindowTick297=tick;}
  }
  private chooseFineRate297():void {
    const nominal=this.rate;
    if(nominal<=0){this.fineFrameRate297=0;this.fineOverfull297=false;return;}
    // A genuinely regular nonstarved flow keeps its exact historical RAF rate.
    if(this.fineNominalCompatible297){this.fineFrameRate297=nominal;this.fineOverfull297=false;return;}
    const estimate=Math.max(0,Math.min(nominal,this.fineEstimatedRate297)),history=Math.max(0,this.latest-this.tick);
    const target=Math.min(this.reserve,estimate*FINE_BUFFER_BUDGET_SECONDS297);
    const age=estimate>0?history/estimate:history>0?Infinity:0;
    if(age>FINE_OVERFULL_SECONDS297)this.fineOverfull297=true;
    else if(history<=target+1e-10)this.fineOverfull297=false;
    const corrected=estimate+(history-target)/FINE_RATE_CORRECTION_SECONDS297;
    this.fineFrameRate297=this.fineOverfull297?nominal:Math.max(0,Math.min(nominal,corrected));
  }
  adopt(tick:number,speed:number,tracks:PawnTrack[],now:number,reset=false,closed435=false,fineCore297=false):void {
    const wasFine297=this.fineCore297;
    const advancingFine297=fineCore297&&tick>this.latest;
    const resetFine297=fineCore297&&(reset||!wasFine297||speed!==this.speed);
    const lateFine297=fineCore297&&!resetFine297&&this.lastFineReceipt297!==undefined&&now-this.lastFineReceipt297>FINE_LATE_RECEIPT_MS297&&tick>this.latest;
    // A speed change carried by a genuinely late receipt keeps the reserve join.
    const lateChange297=fineCore297&&wasFine297&&!reset&&speed!==this.speed&&this.lastFineReceipt297!==undefined&&now-this.lastFineReceipt297>FINE_LATE_RECEIPT_MS297&&tick>this.latest;
    if(!fineCore297)this.lastFineReceipt297=undefined;
    else if(resetFine297||tick>this.latest)this.lastFineReceipt297=now;
    this.fineCore297=fineCore297;
    if(resetFine297){this.resetFineRate297(tick,now,speed*LOCAL_TICKS_PER_SECOND);this.fineStartupProgressPending297=true;}
    if(fineCore297&&!wasFine297)this.fineFrameRate297=this.frameRate;
    this.reserve=fineCore297 ? speed*LOCAL_TICKS_PER_SECOND*FINE_BUFFER_MS297/1000 : MOTION_BUFFER_TICKS;
    this.playbackCursor435.configure(closed435&&!this.trackStoreEscaped435,reset);
    if(reset){this.tick=tick;this.latest=tick;this.previous=now;this.ready=Infinity;this.buffering=true;this.trackStore435.clear();this.lastOwnedTracks435=undefined;this.mutableHistories435.clear();this.trackRevision435++;this.trackChanges435.length=0;this.speed=speed;this.rate=speed*LOCAL_TICKS_PER_SECOND;this.frameRate=this.fineFrameRate297=this.rate;this.rateChanges.length=0;this.transition297=undefined;}
    // An adopted pause is authoritative presentation state, not a request or
    // predicted Core tick. Show its latest confirmed frontier immediately.
    // Running deliveries keep the ordinary smooth, buffered RAF policy below.
    if(speed===0){
      this.latest=Math.max(this.latest,tick);this.tick=this.latest;
      this.speed=0;this.rate=this.frameRate=this.fineFrameRate297=0;this.rateChanges.length=0;this.transition297=undefined;
      this.previous=Math.max(this.previous,now);this.ready=Infinity;this.buffering=true;
      this.adoptTracks435(tracks);
      return;
    }
    // Rate changes never consume wall time at delivery. Historical playout is
    // RAF-only; the fine297 confirmed-frontier correction below is separate.
    if(speed!==this.speed) {
      if(speed>0){
        const rate=speed*LOCAL_TICKS_PER_SECOND;
        let transition:Transition297|undefined;
        if(fineCore297&&this.rate>0&&!this.buffering&&!lateChange297){
          // Running to running: keep playing. Freezing until the new reserve
          // filled (speeding up) or seeking to it (slowing down) made the
          // actors stop, then jump, at every speed change.
          const before=this.rateChanges.findLast(change=>!!change.transition)?.transition?.rate??this.transition297?.rate??this.rate;
          transition={rate:(before+rate)/2,up:rate>before,until:now+FINE_TRANSITION_MAX_MS297};
        }else{
          if(this.rate===0||fineCore297){this.buffering=true;this.ready=Infinity;}
          this.endTransition297(now);
        }
        this.rate=rate;
        this.rateChanges.push({at:now,rate:this.rate,...transition?{transition}:{}});
      }
      this.speed=speed;
    }
    this.latest=Math.max(this.latest,tick);
    if(fineCore297&&!resetFine297){
      if(this.buffering&&this.fineStartupProgressPending297){
        // Startup delay before the first real Core is not a supply sample.
        if(advancingFine297){this.resetFineRate297(this.latest,now,this.rate);this.fineStartupProgressPending297=false;}
      }else if(!this.inTransition297)this.observeFineRate297(this.latest,now);
    }
    // Only a true >100ms advancing-front gap seeks toward confirmed history.
    // Keep the normal reserve directly, so the next receipt needs no refill.
    if(lateFine297){
      this.endTransition297(now);
      this.tick=Math.max(this.tick,this.latest-this.reserve);
      this.buffering=false;this.ready=now;
      this.chooseFineRate297();
    }
    // Fine297 starts/resumes with bounded wall-time history at its current rate.
    // Historical mode retains two local ticks and its original rate-change policy.
    if(this.buffering&&(this.latest-this.tick>=this.reserve-1e-10||speed===0&&this.latest>this.tick)) {
      if(fineCore297){
        this.tick=Math.max(this.tick,this.latest-this.reserve);
        // Keep slower supply observed BETWEEN real progress receipts here.
        // Regular startup still begins its normal window at readiness.
        if(this.fineNominalCompatible297)this.resetFineRate297(this.latest,now,this.rate);
        this.fineStartupProgressPending297=false;
      }
      this.buffering=false;this.ready=now;
    }
    // A delivery burst (stalled main thread, or a producer catching up) can leave
    // more confirmed history than nominal playback ever consumes: the display
    // would stay that far behind the simulation until the next pause or speed
    // change, then jump all at once. Beyond 100 ms of excess, join the normal
    // reserve now, exactly as after a late receipt.
    if(fineCore297&&!this.buffering&&!this.inTransition297&&this.rate>0&&this.latest-this.tick>this.reserve+this.rate*FINE_OVERFULL_SECONDS297){
      this.tick=this.latest-this.reserve;
      this.chooseFineRate297();
    }
    this.adoptTracks435(tracks);
  }
  advance(now:number):number {
    // A lone confirmed Core must not wait forever for a fuller startup reserve.
    // After100ms without a receipt, release only that existing history.
    if(this.buffering&&this.rate>0&&this.lastFineReceipt297!==undefined&&this.latest>this.tick&&now-this.lastFineReceipt297>FINE_LATE_RECEIPT_MS297){
      this.buffering=false;this.ready=this.lastFineReceipt297+FINE_LATE_RECEIPT_MS297;
    }
    let start=Math.max(this.previous,this.ready),delta=0,consumed=0,fineRate=this.fineFrameRate297;
    // Acknowledgement can arrive between frames or after the timestamp of the
    // pending RAF. Never apply a new speed retroactively to the whole interval:
    // repeated asymmetric changes would consume the confirmed buffer.
    // From its own change on, a running speed change plays at its own rate.
    const playRate=()=>this.transition297?this.transition297.rate:this.fineCore297?Math.min(this.frameRate,fineRate):this.frameRate;
    for(const change of this.rateChanges){
      if(change.at>now)break;
      delta+=Math.max(0,change.at-start)*playRate()/1000;
      start=Math.max(start,change.at);this.frameRate=change.rate;fineRate=change.rate;this.transition297=change.transition;consumed++;
    }
    if(consumed)this.rateChanges.splice(0,consumed);
    delta+=Math.max(0,now-start)*playRate()/1000;
    this.previous=Math.max(this.previous,now);
    this.tick=Math.min(this.latest,this.tick+delta);
    const transition=this.transition297;
    if(transition){
      const history=this.latest-this.tick;
      if(now>=transition.until||(transition.up?history>=this.reserve-1e-10:history<=this.reserve+1e-10))this.endTransition297(now);
    }
    if(this.fineCore297){
      // Rare genuine no-progress outage: finish only acquired history, never
      // wait forever for another packet or advance a World/ACK/physical Core.
      if(this.speed>0&&this.lastFineReceipt297!==undefined&&now-this.lastFineReceipt297>FINE_LATE_RECEIPT_MS297)this.tick=this.latest;
      // Apply observations to the NEXT RAF interval, not backwards at receipt.
      this.fineFrameRate297=fineRate;
      // A stale RAF can precede an already received semantic-speed event. Its
      // new nominal/estimator belongs after that event, never before it.
      if(!this.rateChanges.length)this.chooseFineRate297();
    }
    // An adopted pause has already stopped at its latest confirmed frontier.
    if(this.speed===0&&this.tick>=this.latest)this.rate=this.frameRate=0;
    return this.tick;
  }
  segment(id:number):TravelSegment|undefined {
    const segments=this.trackStore435.get(id);if(!segments?.length)return undefined;
    let current:TravelSegment|undefined;
    for(const segment of segments){if(segment.start>this.tick)break;current=segment;}
    return current;
  }
}
