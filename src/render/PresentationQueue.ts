import type { World } from '../sim/types';
import { PresentationChanges } from '../bridge/presentation-changes';
import type { ClosedMainMapIntentReader } from './closed-main-map-intents';

/** Decoded snapshots are immutable and share terrain/resource arrays. Scene
 * changes wait for the actors' confirmed clock. No simulation mutation. */
export class PresentationQueue {
  private pending:{world:World;at:number;notBeforeFrame?:number}[]=[];
  private phases:PresentationChanges;
  private inspected:World|undefined;
  private changed=false;
  private intentSignature:string|undefined;
  private lastApplied=-Infinity;
  constructor(private readonly intentReader?:ClosedMainMapIntentReader,private readonly createPhases:()=>PresentationChanges=()=>new PresentationChanges()) {this.phases=this.createPhases();}
  clear():void {this.pending=[];this.phases=this.createPhases();this.inspected=undefined;this.intentSignature=undefined;this.lastApplied=-Infinity;this.intentReader?.clear();}
  /** A completed surface transaction supersedes only this confirmed prefix.
   * Later Fulls may already be admitted while their physical time is still
   * ahead of the playhead. Keep their original frame gates and observer state. */
  discardThrough(at:number):void {
    if(!Number.isFinite(at))throw Error('Invalid presentation discard frontier');
    this.pending=this.pending.filter(entry=>entry.at>at);
  }
  get size():number {return this.pending.length;}
  push(world:World,at=world.tick,notBeforeFrame?:number):void {
    if(notBeforeFrame!==undefined&&(!Number.isSafeInteger(notBeforeFrame)||notBeforeFrame<0))throw Error('Invalid presentation frame gate');
    const last=this.pending.at(-1);
    if(last?.at===at){
      // Replacing an existing same-Core slot cannot postpone its first eligibility.
      const gate=last.notBeforeFrame===undefined||notBeforeFrame===undefined?undefined:Math.min(last.notBeforeFrame,notBeforeFrame);
      this.pending[this.pending.length-1]={world,at,...gate===undefined?{}:{notBeforeFrame:gate}};
    }else this.pending.push({world,at,...notBeforeFrame===undefined?{}:{notBeforeFrame}});
  }
  releaseFrameGates():void {for(const entry of this.pending)delete entry.notBeforeFrame;}
  take(tick:number,now?:number,frame?:number):World|undefined {
    if(frame!==undefined&&(!Number.isSafeInteger(frame)||frame<0))throw Error('Invalid presentation frame marker');
    let index=-1;
    while(this.pending[index+1]&&this.pending[index+1]!.at<=tick){const next=this.pending[index+1]!;if(next.notBeforeFrame!==undefined&&(frame===undefined||frame<next.notBeforeFrame))break;index++;}
    if(index<0)return;
    const world=this.pending[index]!.world;
    if(now!==undefined) {
      if(world!==this.inspected){
        this.inspected=world;
        // These confirmed map intentions were absent from the phase observer.
        // Compare values so ordinary cloned snapshots retain the 5 Hz cadence.
        // No movement clock, speculative preview or simulation state changes.
        const intent=this.intentReader?this.intentReader.read(world):JSON.stringify([
          world.jobs.map(j=>[j.id,j.kind,j.x,j.z,j.orientation,j.footprint,j.construction]),
          world.growingZones.map(zone=>[zone.id,zone.cells,zone.plant]),
          world.stockpiles.map(cell=>[cell.id,cell.zoneId,cell.x,cell.z]),world.home,world.roofing?.build,world.roofing?.remove,
          world.piles.filter(p=>p.kind==='chunk'&&p.haulRequested).map(p=>[p.id,p.owner]),
        ]);
        this.changed=this.phases.capture(world)||intent!==this.intentSignature;
        this.intentSignature=intent;
      }
      // Movement consumes every confirmed track independently. Continuous
      // scene values need only 5 Hz; discrete phases remain tick-exact. Keep
      // the last world queued, so even the final paused edit is eventually drawn.
      if(!this.changed&&now-this.lastApplied<200)return;
      this.lastApplied=now;
    }
    this.pending.splice(0,index+1);
    return world;
  }
}
