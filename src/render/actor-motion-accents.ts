/** Presentation-only accents added to the drawn root of humans and animals.
 * Nothing here reads a clock or changes the World; every value follows the
 * confirmed presentation tick and the drawn (tweened) root.
 *
 * Melee jolt, after RimWorld Core 1.6 (Pawn_DrawTracker.Notify_MeleeAttackOn,
 * JitterHandler): each melee attack, hit or not, pushes the attacker's drawn
 * position toward its target by 0.5 cell capped at JitterMax 0.35 (0.25 when
 * the target shares the cell); a hit whose damage has a forceful impact (every
 * melee damage of the base game) pushes the victim 0.17 cell along the blow.
 * The offset then returns linearly at 0.018 cell per game tick (one Core
 * tick here: 0.32 s for a lunge at x1). The offsets of an actor add up and are
 * capped at 0.35, as in JitterHandler.AddOffset. `core` below is the
 * presentation playhead in Core ticks (MotionTimeline.tick x 10). */
export const MELEE_LUNGE=.35;
export const MELEE_HIT_RECOIL=.17;
export const JITTER_DROP_PER_TICK=.018;
export const JITTER_MAX=.35;

/** Remaining length of a jolt `elapsedTicks` after it was applied. */
export function joltRemaining(distance:number,elapsedTicks:number):number {
  if(!(elapsedTicks>=0))return 0;
  const left=distance-elapsedTicks*JITTER_DROP_PER_TICK;
  return left>0?left:0;
}

type Recoil={atCore:number;dx:number;dz:number};
type Strike={atCore:number;targetId:number|null;outcome:'hit'|'miss'|'dodge';structure?:unknown}|null|undefined;

/** Victims of confirmed melee hits. An attacker's strike is registered once
 * (by its confirmed Core time); the push direction is the attacker-to-victim
 * cell vector, as in RimWorld (DamageInfo angle of a melee blow). */
export class MeleeRecoilTracker {
  private readonly seen=new Map<number,number>();
  private readonly byVictim=new Map<number,Recoil>();
  private readonly lifeCore=Math.ceil(MELEE_HIT_RECOIL/JITTER_DROP_PER_TICK)+1;
  clear():void {this.seen.clear();this.byVictim.clear();}
  get size():number {return this.byVictim.size;}
  /** A Full may contain a confirmed hit ahead of the buffered playhead. */
  hasPending(victimId:number,core:number):boolean {const recoil=this.byVictim.get(victimId);return!!recoil&&core<recoil.atCore;}
  /** `victim` is resolved by the caller only for a strike not seen yet. */
  observe(attackerId:number,strike:Strike,ax:number,az:number,victim:(id:number)=>{x:number;z:number}|undefined):number|undefined {
    if(!strike||strike.outcome!=='hit'||strike.targetId===null||strike.structure!==undefined)return;
    if(this.seen.get(attackerId)===strike.atCore)return;
    this.seen.set(attackerId,strike.atCore);
    if(this.seen.size>256){let oldest=Infinity;for(const v of this.seen.values())oldest=Math.min(oldest,v);for(const [k,v] of this.seen)if(v===oldest)this.seen.delete(k);}
    const target=victim(strike.targetId);if(!target)return;
    const dx=target.x-ax,dz=target.z-az,length=Math.hypot(dx,dz);
    if(!(length>1e-6))return;
    this.byVictim.set(strike.targetId,{atCore:strike.atCore,dx:dx/length,dz:dz/length});
    if(this.byVictim.size>64){let newest=-Infinity;for(const r of this.byVictim.values())newest=Math.max(newest,r.atCore);
      for(const [id,r] of this.byVictim)if(newest-r.atCore>this.lifeCore)this.byVictim.delete(id);}
    return strike.targetId;
  }
  /** Adds the victim's remaining push to `out`; true while it is non-zero. */
  add(victimId:number,core:number,out:{x:number;z:number}):boolean {
    const recoil=this.byVictim.get(victimId);if(!recoil)return false;
    const left=joltRemaining(MELEE_HIT_RECOIL,core-recoil.atCore);
    if(left<=0)return false;
    out.x+=recoil.dx*left;out.z+=recoil.dz*left;return true;
  }
}

/** Adds the attacker's own lunge toward `yaw` to `out`. */
export function addMeleeLunge(strike:Strike,core:number,yaw:number,out:{x:number;z:number}):boolean {
  if(!strike)return false;
  const left=joltRemaining(MELEE_LUNGE,core-strike.atCore);
  if(left<=0)return false;
  out.x+=Math.sin(yaw)*left;out.z+=Math.cos(yaw)*left;return true;
}

/** JitterHandler.AddOffset caps the summed offset at JitterMax. */
export function capJolt(out:{x:number;z:number}):void {
  const length=Math.hypot(out.x,out.z);
  if(length>JITTER_MAX){out.x*=JITTER_MAX/length;out.z*=JITTER_MAX/length;}
}

/** Arrival tail. The drawn root follows the confirmed root with RimWorld's
 * PawnTweener spring, so it reaches a destination a little after the
 * confirmed edge has ended. The legs keep stepping over that remaining
 * distance and land on a neutral phase (a multiple of pi: feet together)
 * exactly when the body stops, instead of freezing while the body slides. */
export const ARRIVAL_TAIL_END=.02;

/** Phase reached when the remaining `residual` has been covered, chosen as
 * the multiple of pi nearest to the natural end and never behind `phase`.
 * A short remainder that would need a hurried shuffle keeps its natural end. */
export function arrivalTailTarget(phase:number,residual:number,radiansPerUnit:number):number {
  const natural=phase+residual*radiansPerUnit;
  let target=Math.round(natural/Math.PI)*Math.PI;
  if(target<phase)target+=Math.PI;
  return Math.abs(target-natural)>.5*residual*radiansPerUnit+.3?natural:target;
}
/** A confirmed root that moves less than this keeps the current plan. */
export const ARRIVAL_TAIL_REPLAN=.05;

/** Phase while `residual` remains of a tail planned from (phase0, residual0). */
export function arrivalTailPhase(phase0:number,residual0:number,target:number,residual:number):number {
  if(!(residual0>0))return target;
  const covered=Math.min(1,Math.max(0,1-residual/residual0));
  const phase=phase0+(target-phase0)*covered;
  const turn=Math.PI*2;
  return ((phase%turn)+turn)%turn;
}
