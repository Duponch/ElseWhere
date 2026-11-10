import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {effectiveLocal297} from '../sim/core-phase-297.ts';
import { travelPieces,type PresentationSegment } from '../sim/travel-timing.ts';
import type { World } from '../sim/types.ts';
export interface PawnTrack { id:number; segments:PresentationSegment[] }
export const MOTION_HISTORY_TICKS = 64;
/** Presentation history, never a simulation input or save field. Covers skipped snapshots. */
export class MotionRecorder {
  private readonly tracks=new Map<number,PresentationSegment[]>();
  reset():void {this.tracks.clear();}
  capture(world:World):void {
    const actors=[...world.pawns,...world.wildlife?.animals??[],...world.mechanoids??[]];if(!actors.length)return;
    // Nothing below writes the World: its schema and local time are read once.
    const physical=isCorePhysicalSchema297(Number(world.schemaVersion)),now=physical?effectiveLocal297(world):world.tick;
    for(const pawn of actors) {
      let track=this.tracks.get(pawn.id);if(!track){track=[];this.tracks.set(pawn.id,track);}
      const motion=pawn.motion;
      if(physical&&track.length){
        const prior=track.at(-1)!;
        const source=motion?.from??pawn;
        const replaced=!!motion&&(prior.edgeStart??prior.start)===motion.start&&(prior.from.x!==source.x||prior.from.z!==source.z||prior.to.x!==motion.to.x||prior.to.z!==motion.to.z);
        const stopped=!motion&&(prior.end>now||prior.to.x!==pawn.x||prior.to.z!==pawn.z);
        if(replaced||stopped){
          track=track.filter(segment=>segment.start<now).map(segment=>{
            if(segment.end<=now)return segment;
            const from=segment.fromFraction??0,to=segment.toFraction??1;
            return {...segment,toFraction:from+(to-from)*Math.max(0,Math.min(1,(now-segment.start)/(segment.end-segment.start))),end:now};
          });
          const c=motion?.from??pawn;
          track.push({from:{x:c.x,z:c.z},to:{x:c.x,z:c.z},start:now,end:now,fromFraction:0,toFraction:0,stop297:true});
          this.tracks.set(pawn.id,track);
        }
      }
      const last=track.at(-1),edgeStart=last?.edgeStart??last?.start;
      if(motion&&(edgeStart!==motion.start||last?.end!==motion.end||physical&&(last?.from.x!==motion.from.x||last?.from.z!==motion.from.z||last?.to.x!==motion.to.x||last?.to.z!==motion.to.z))) {
        if(edgeStart===motion.start){track=track.filter(s=>(s.edgeStart??s.start)!==motion.start);this.tracks.set(pawn.id,track);}
        if(motion.stagger||motion.stuns)for(const s of travelPieces(motion))track.push({...s,from:{...s.from},to:{...s.to}});
        else track.push({...motion,from:{...motion.from},to:{...motion.to}});
      }
      while(track.length>1&&track[1]!.end<world.tick-MOTION_HISTORY_TICKS)track.shift();
    }
  }
  snapshot():PawnTrack[] {return [...this.tracks].map(([id,segments])=>({id,segments}));}
}
