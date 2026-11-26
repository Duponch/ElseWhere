import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297} from '../sim/core-phase-297.ts';
import { travelPieces,type PresentationSegment } from '../sim/travel-timing.ts';
import type { World } from '../sim/types.ts';
import {takePhysicalMotionSelection379} from '../sim/core-motion-publication-receipt-379';
import {verifyTerrainWriteCaches} from '../sim/terrain-mutation-journal';
import {verifyResourceJournal} from '../sim/resource-mutation-journal';
import {verifyPileIndex} from '../sim/pile-index';
export interface PawnTrack { id:number; segments:PresentationSegment[] }
export const MOTION_HISTORY_TICKS = 64;
const sealedHistories=new WeakSet<readonly PresentationSegment[]>();
const detachedPieces=new WeakSet<PresentationSegment>();
const closedPieces=new WeakSet<PresentationSegment>();
interface HistoryFrame {previous?:WeakRef<readonly PawnTrack[]>;work:readonly number[];live:readonly number[]}
const historyFrames=new WeakMap<readonly PawnTrack[],HistoryFrame>();
/** Indices keep the recorder's original insertion order. A caller that missed a
 * snapshot or crossed a reset takes the ordinary exhaustive comparison. */
export function changedMotionSlots(previous:readonly PawnTrack[]|undefined,current:readonly PawnTrack[]):readonly number[]|undefined {
  if(!previous)return;
  const frame=historyFrames.get(current);
  if(!frame)return;
  if(previous===current)return frame.live;
  if(frame.previous?.deref()===previous)return frame.work;
}
/** Only a track constructed by the recorder, with detached coordinates and
 * no nested mutable fields, can be shared between two producer reads. */
export function isSealedMotionHistory(segments:readonly PresentationSegment[]):boolean {return sealedHistories.has(segments);}
/** A private recorder-owned, fully detached finite own-data segment. Its
 * exact values survive both the phase and Full producer; unowned/literal
 * records and the historical nested stagger/stun aliases get copied. */
export function ownedMotionPiece297(piece:PresentationSegment):PresentationSegment|undefined {return detachedPieces.has(piece)?piece:undefined;}
function ownedMotionPoint297(point:PresentationSegment['from']):boolean {
 return Reflect.ownKeys(point).length===2&&Object.hasOwn(point,'x')&&Object.hasOwn(point,'z')&&Number.isFinite(point.x)&&Number.isFinite(point.z);
}
function sealRecorderPiece297(piece:PresentationSegment):boolean {
 if(closedPieces.has(piece))return detachedPieces.has(piece);
 let safe=ownedMotionPoint297(piece.from)&&ownedMotionPoint297(piece.to);
 for(const key of Reflect.ownKeys(piece))if(key!=='from'&&key!=='to'){
  const value=Reflect.get(piece,key);if(typeof key!=='string'||!(value===null||value===undefined||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value)))safe=false;
 }
 Object.freeze(piece.from);Object.freeze(piece.to);Object.freeze(piece);closedPieces.add(piece);
 if(safe)detachedPieces.add(piece);return safe;
}
type MovingActor=Pick<World['pawns'][number],'id'|'x'|'z'|'motion'>;
/** Presentation history, never a simulation input or save field. Covers skipped snapshots. */
export class MotionRecorder {
  private readonly tracks=new Map<number,PresentationSegment[]>();
  private readonly capturedActors=new Map<number,MovingActor>();
  private readonly slots=new Map<number,number>();
  private readonly dirtyTracks=new Set<number>();
  private readonly liveSlots=new Set<number>();
  /** Number of aliased/non-finite pieces per live history. Every producer
   * append/replacement/prefix removal updates this, not each later snapshot. */
  private readonly unsafeCounts=new Map<number,number>();
  private roster?:{pawns:World['pawns'];animals:World['wildlife'];mechs:World['mechanoids'];animalList:NonNullable<World['wildlife']>['animals']|undefined;tick:number;count:number};
  private snapshotRows?:PawnTrack[];
  private changed=true;
  constructor(private readonly closedHistory=false){}
  reset():void {this.tracks.clear();this.slots.clear();this.dirtyTracks.clear();this.liveSlots.clear();this.unsafeCounts.clear();this.capturedActors.clear();this.roster=undefined;this.snapshotRows=undefined;this.changed=true;}
  capture(world:World):void {
    const physical=isCorePhysicalSchema297(Number(world.schemaVersion)),now=physical?effectiveLocal297(world):world.tick;
    if(!this.closedHistory){
      const actors=[...world.pawns,...world.wildlife?.animals??[],...world.mechanoids??[]];
      for(const actor of actors)this.captureActor(actor,physical,now,world.tick);
      return;
    }
    this.capturedActors.clear();
    const read=(rows:readonly MovingActor[])=>{for(const actor of rows){this.capturedActors.set(actor.id,actor);this.captureActor(actor,physical,now,world.tick);}};
    read(world.pawns);if(world.wildlife)read(world.wildlife.animals);if(world.mechanoids)read(world.mechanoids);
    this.roster={pawns:world.pawns,animals:world.wildlife,animalList:world.wildlife?.animals,mechs:world.mechanoids,tick:world.tick,count:world.pawns.length+(world.wildlife?.animals.length??0)+(world.mechanoids?.length??0)};
  }
  /** The fixed clock uses this only between two consecutive physical steps
   * of the same macro. The engine identifies every move, passenger change,
   * interruption and actor timer. A completed macro (including expiry of
   * old history), membership barrier or command always takes capture(). */
  capturePhysical(world:World,changedActors:readonly number[]):void {
    this.capturePhysicalSelected(world,changedActors);
  }
  /** Fixed actual Engine result only. A private one-use receipt narrows the
   * Recorder's work, not the phase actor rows. Public/mutable callers of
   * capturePhysical retain every old candidate and fallback. */
  capturePhysicalFromCore379(world:World,result:{readonly world:World;readonly core:number;readonly actorsChanged:readonly number[]},owner:object):void {
    const selected=result.world===world&&result.core===effectiveCore297(world)?takePhysicalMotionSelection379(result,world,owner,result.actorsChanged):undefined;
    this.capturePhysicalSelected(world,result.actorsChanged,selected);
  }
  private capturePhysicalSelected(world:World,changedActors:readonly number[],selected?:readonly number[]):void {
    const roster=this.roster;
    if(!this.closedHistory||!roster||roster.tick!==world.tick||roster.pawns!==world.pawns||roster.animals!==world.wildlife||roster.animalList!==world.wildlife?.animals||roster.mechs!==world.mechanoids||roster.count!==world.pawns.length+(world.wildlife?.animals.length??0)+(world.mechanoids?.length??0)){this.capture(world);return;}
    const now=effectiveLocal297(world);
    for(const id of selected??changedActors){const actor=this.capturedActors.get(id);if(!actor){this.capture(world);return;}this.captureActor(actor,true,now,world.tick);}
    // Independent historical work for omitted actors, only in checking mode.
    // There must be an existing track and captureActor may not change the
    // track object, its bounds or its length (its only edits are replacement,
    // append and prefix removal). In ordinary stepping the real positive
    // cooldown writer cannot create a piece/STOP or advance integer expiry.
    if(selected&&(verifyTerrainWriteCaches||verifyResourceJournal||verifyPileIndex)){
      const seen=new Set(selected);
      for(const id of changedActors)if(!seen.has(id)){
        const actor=this.capturedActors.get(id),before=this.tracks.get(id);if(!actor||!before)throw Error('Missing physical motion roster witness');
        const length=before.length,first=before[0],last=before[length-1],dirty=this.dirtyTracks.has(id),changed=this.changed;
        this.captureActor(actor,true,now,world.tick);
        if(this.tracks.get(id)!==before||before.length!==length||before[0]!==first||before[length-1]!==last||this.dirtyTracks.has(id)!==dirty||this.changed!==changed)throw Error('Unmarked physical motion history write');
      }
    }
  }
  private replaceTrack(id:number,track:PresentationSegment[]):void {
    this.tracks.set(id,track);
    if(this.closedHistory){let unsafe=0;for(const piece of track)if(!sealRecorderPiece297(piece))unsafe++;this.unsafeCounts.set(id,unsafe);}
  }
  private appendPiece(id:number,track:PresentationSegment[],piece:PresentationSegment):void {
    if(this.closedHistory&&!sealRecorderPiece297(piece))this.unsafeCounts.set(id,(this.unsafeCounts.get(id)??0)+1);
    track.push(piece);
  }
  private captureActor(pawn:MovingActor,physical:boolean,now:number,tick:number):void {
      let track=this.tracks.get(pawn.id);
      if(!track){track=[];if(this.closedHistory){this.slots.set(pawn.id,this.tracks.size);this.dirtyTracks.add(pawn.id);}this.replaceTrack(pawn.id,track);this.changed=true;}
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
          this.replaceTrack(pawn.id,track);
          this.appendPiece(pawn.id,track,{from:{x:c.x,z:c.z},to:{x:c.x,z:c.z},start:now,end:now,fromFraction:0,toFraction:0,stop297:true});
          this.changed=true;if(this.closedHistory)this.dirtyTracks.add(pawn.id);
        }
      }
      const last=track.at(-1),edgeStart=last?.edgeStart??last?.start;
      if(motion&&(edgeStart!==motion.start||last?.end!==motion.end||physical&&(last?.from.x!==motion.from.x||last?.from.z!==motion.from.z||last?.to.x!==motion.to.x||last?.to.z!==motion.to.z))) {
        this.changed=true;if(this.closedHistory)this.dirtyTracks.add(pawn.id);
        if(edgeStart===motion.start){track=track.filter(s=>(s.edgeStart??s.start)!==motion.start);this.replaceTrack(pawn.id,track);}
        else if(this.closedHistory&&Object.isFrozen(track)){track=track.slice();this.tracks.set(pawn.id,track);}
        if(motion.stagger||motion.stuns)for(const s of travelPieces(motion))this.appendPiece(pawn.id,track,{...s,from:{...s.from},to:{...s.to}});
        else this.appendPiece(pawn.id,track,{...motion,from:{...motion.from},to:{...motion.to}});
      }
      if(track.length>1&&track[1]!.end<tick-MOTION_HISTORY_TICKS){
        this.changed=true;if(this.closedHistory)this.dirtyTracks.add(pawn.id);
        if(this.closedHistory&&Object.isFrozen(track)){track=track.slice();this.tracks.set(pawn.id,track);}
        do{const removed=track.shift()!;if(this.closedHistory&&!detachedPieces.has(removed))this.unsafeCounts.set(pawn.id,this.unsafeCounts.get(pawn.id)!-1);}while(track.length>1&&track[1]!.end<tick-MOTION_HISTORY_TICKS);
      }
  }
  snapshot():PawnTrack[] {
    if(!this.closedHistory)return [...this.tracks].map(([id,segments])=>({id,segments}));
    if(this.snapshotRows&&!this.changed)return this.snapshotRows;
    const previous=this.snapshotRows,result=previous?.slice()??new Array<PawnTrack>(this.tracks.size);
    const touched=new Set<number>();
    for(const id of this.dirtyTracks){
      const slot=this.slots.get(id)!,segments=this.tracks.get(id)!;touched.add(slot);
      if(!Object.isFrozen(segments)){
        Object.freeze(segments);if(this.unsafeCounts.get(id)===0)sealedHistories.add(segments);
      }
      if(sealedHistories.has(segments))this.liveSlots.delete(slot);else this.liveSlots.add(slot);
      result[slot]=Object.freeze({id,segments});
    }
    for(const slot of this.liveSlots)touched.add(slot);
    const ordered=(indices:Set<number>)=>Object.freeze([...indices].sort((a,b)=>a-b));
    historyFrames.set(result,{previous:previous?new WeakRef(previous):undefined,work:ordered(touched),live:ordered(this.liveSlots)});
    this.dirtyTracks.clear();Object.freeze(result);this.changed=false;return this.snapshotRows=result;
  }
}
