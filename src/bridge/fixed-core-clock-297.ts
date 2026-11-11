/** Wall-time credit owner only. It never advances a saved World or certifies a
 * played Core phase. The runtime debits exactly one credit before one complete
 * authoritative Core transaction; macros/publication have their own barriers. */
export class FixedCoreClock297 {
  private previous=0;
  private remainder=0;
  private reserved=0;
  private gapMs=0;
  /** Wall time between the last two reservations. Past 250 ms the clock
   * credits only 250 ms: the Worker could not keep the requested speed. */
  get lastReserveGapMs():number {return this.gapMs;}
  reset(now:number):void {
    if(!Number.isFinite(now))throw Error('Invalid Core clock reset.');
    this.previous=now;this.remainder=0;this.reserved=0;
  }
  reserve(now:number,speed:number):number {
    if(this.reserved!==0)throw Error('A Core clock reservation is already active.');
    if(!Number.isFinite(now)||!Number.isFinite(speed)||speed<0)throw Error('Invalid Core clock reservation.');
    this.gapMs=Math.max(0,now-this.previous);
    const elapsed=Math.min(250,this.gapMs);
    const next=speed?this.remainder+elapsed*speed*60:this.remainder;
    if(!Number.isFinite(next))throw Error('Core clock reservation overflow.');
    this.previous=Math.max(this.previous,now);
    if(!speed)return 0;
    this.remainder=next;
    this.reserved=Math.min(150,Math.floor(this.remainder/1000));
    return this.reserved;
  }
  consume():boolean {
    if(this.reserved===0)return false;
    this.remainder-=1000;this.reserved--;return true;
  }
  /** A speed command acquires no old-speed elapsed interval. Preserve only the
   * sampled fractional unplayed Core credit. Played phase lives in the World. */
  cancelUnplayed(now:number):void {
    if(!Number.isFinite(now)||!Number.isFinite(this.remainder))throw Error('Invalid Core clock cancellation.');
    this.previous=Math.max(this.previous,now);this.remainder%=1000;this.reserved=0;
  }
}
