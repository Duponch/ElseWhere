import {ConfirmedTrackCursor435} from './ActorPlayback435';
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
/** Confirmed-time playout. Ordinary fine297 receipts add history without a seek.
 * Startup and a genuinely late receipt may join the bounded confirmed reserve;
 * pause joins the confirmed frontier exactly. Neither mode extrapolates. */
export class MotionTimeline {
  private readonly playbackCursor435=new ConfirmedTrackCursor435();
  get playbackEnabled435():boolean{return this.playbackCursor435.enabled;}
  get playbackGeneration435():number{return this.playbackCursor435.generation;}
  playbackSegment435(id:number):TravelSegment|undefined{return this.playbackCursor435.segment(this.tracks,id,this.tick);}
  playbackDiagnostics435(){return{enabled:this.playbackCursor435.enabled,generation:this.playbackCursor435.generation,...this.playbackCursor435.stats};}
  readonly tracks=new Map<number,TravelSegment[]>();
  tick=0;
  private latest=0;
  private rate=0;
  private frameRate=0;
  private readonly rateChanges:{at:number;rate:number}[]=[];
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
    if(!fineCore297)this.lastFineReceipt297=undefined;
    else if(resetFine297||tick>this.latest)this.lastFineReceipt297=now;
    this.fineCore297=fineCore297;
    if(resetFine297){this.resetFineRate297(tick,now,speed*LOCAL_TICKS_PER_SECOND);this.fineStartupProgressPending297=true;}
    if(fineCore297&&!wasFine297)this.fineFrameRate297=this.frameRate;
    this.reserve=fineCore297 ? speed*LOCAL_TICKS_PER_SECOND*FINE_BUFFER_MS297/1000 : MOTION_BUFFER_TICKS;
    this.playbackCursor435.configure(closed435,reset);
    if(reset){this.tick=tick;this.latest=tick;this.previous=now;this.ready=Infinity;this.buffering=true;this.tracks.clear();this.speed=speed;this.rate=speed*LOCAL_TICKS_PER_SECOND;this.frameRate=this.fineFrameRate297=this.rate;this.rateChanges.length=0;}
    // An adopted pause is authoritative presentation state, not a request or
    // predicted Core tick. Show its latest confirmed frontier immediately.
    // Running deliveries keep the ordinary smooth, buffered RAF policy below.
    if(speed===0){
      this.latest=Math.max(this.latest,tick);this.tick=this.latest;
      this.speed=0;this.rate=this.frameRate=this.fineFrameRate297=0;this.rateChanges.length=0;
      this.previous=Math.max(this.previous,now);this.ready=Infinity;this.buffering=true;
      for(const track of tracks)this.tracks.set(track.id,track.segments);
      return;
    }
    // Rate changes never consume wall time at delivery. Historical playout is
    // RAF-only; the fine297 confirmed-frontier correction below is separate.
    if(speed!==this.speed) {
      if(speed>0){
        if(this.rate===0||fineCore297){this.buffering=true;this.ready=Infinity;}
        this.rate=speed*LOCAL_TICKS_PER_SECOND;
        this.rateChanges.push({at:now,rate:this.rate});
      }
      this.speed=speed;
    }
    this.latest=Math.max(this.latest,tick);
    if(fineCore297&&!resetFine297){
      if(this.buffering&&this.fineStartupProgressPending297){
        // Startup delay before the first real Core is not a supply sample.
        if(advancingFine297){this.resetFineRate297(this.latest,now,this.rate);this.fineStartupProgressPending297=false;}
      }else this.observeFineRate297(this.latest,now);
    }
    // Only a true >100ms advancing-front gap seeks toward confirmed history.
    // Keep the normal reserve directly, so the next receipt needs no refill.
    if(lateFine297){
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
    if(fineCore297&&!this.buffering&&this.rate>0&&this.latest-this.tick>this.reserve+this.rate*FINE_OVERFULL_SECONDS297){
      this.tick=this.latest-this.reserve;
      this.chooseFineRate297();
    }
    for(const track of tracks)this.tracks.set(track.id,track.segments);
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
    for(const change of this.rateChanges){
      if(change.at>now)break;
      const rate=this.fineCore297?Math.min(this.frameRate,fineRate):this.frameRate;
      delta+=Math.max(0,change.at-start)*rate/1000;
      start=Math.max(start,change.at);this.frameRate=change.rate;fineRate=change.rate;consumed++;
    }
    if(consumed)this.rateChanges.splice(0,consumed);
    delta+=Math.max(0,now-start)*(this.fineCore297?Math.min(this.frameRate,fineRate):this.frameRate)/1000;
    this.previous=Math.max(this.previous,now);
    this.tick=Math.min(this.latest,this.tick+delta);
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
    const segments=this.tracks.get(id);if(!segments?.length)return undefined;
    let current:TravelSegment|undefined;
    for(const segment of segments){if(segment.start>this.tick)break;current=segment;}
    return current;
  }
}
