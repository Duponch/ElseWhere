/** Idle, seated, social, lying and downed gestures of people and animals
 * (retours du 22 novembre, points 4 et 6). Presentation only: every value is
 * a function of the already published actor streams (pose, activity code,
 * phase, cargo) and the two presentation clocks, so it stops on pause, runs
 * faster at x3/x6 like every other gesture, and never reads or changes the
 * World. Each formula is written ONCE, over a tiny expression interface: the
 * resident GPU graph instantiates it with TSL nodes (near and dynamic middle
 * actors), the retained CPU sampler (far and static middle actors) with plain
 * numbers. Both paths therefore draw the same pose for the same inputs.
 *
 * Clocks. `t` is the presentation clock, wrapped at 2π seconds: every
 * frequency applied to it is an integer so the wrap never jumps. `u` is the
 * slow clock built on travelTime, whose origin is rebased every 1024 local
 * ticks: its period (102.4 local ticks, 17.07 s at x1) divides 1024, so the
 * rebase never jumps either. Core's downed wiggle uses its own offset (see
 * downedWigglePhase). */
import type {Pawn} from '../sim/types';

/** Arithmetic shared by TSL nodes and the CPU mirror below. Booleans are only
 * combined with and/or/not and consumed by select. */
export interface GestureExpr {
  add(x:GestureExpr|number):GestureExpr; sub(x:GestureExpr|number):GestureExpr;
  mul(x:GestureExpr|number):GestureExpr; mod(x:GestureExpr|number):GestureExpr;
  clamp(low:GestureExpr|number,high:GestureExpr|number):GestureExpr;
  max(x:GestureExpr|number):GestureExpr; min(x:GestureExpr|number):GestureExpr;
  greaterThan(x:GestureExpr|number):GestureExpr; lessThan(x:GestureExpr|number):GestureExpr;
  equal(x:GestureExpr|number):GestureExpr;
  and(x:GestureExpr):GestureExpr; or(x:GestureExpr):GestureExpr; not():GestureExpr;
  select(a:GestureExpr,b:GestureExpr):GestureExpr;
}
export interface GestureOps {lit(value:number):GestureExpr;sin(x:GestureExpr):GestureExpr;}

/** CPU mirror of the TSL operations used by the formulas. */
export class GestureNumber implements GestureExpr {
  constructor(readonly value:number){}
  private static of(x:GestureExpr|number):number {return typeof x==='number'?x:(x as GestureNumber).value;}
  add(x:GestureExpr|number){return new GestureNumber(this.value+GestureNumber.of(x));}
  sub(x:GestureExpr|number){return new GestureNumber(this.value-GestureNumber.of(x));}
  mul(x:GestureExpr|number){return new GestureNumber(this.value*GestureNumber.of(x));}
  /** GLSL/WGSL mod: x - y*floor(x/y), the sign of y. */
  mod(x:GestureExpr|number){const y=GestureNumber.of(x);return new GestureNumber(this.value-y*Math.floor(this.value/y));}
  clamp(low:GestureExpr|number,high:GestureExpr|number){return new GestureNumber(Math.min(GestureNumber.of(high),Math.max(GestureNumber.of(low),this.value)));}
  max(x:GestureExpr|number){return new GestureNumber(Math.max(this.value,GestureNumber.of(x)));}
  min(x:GestureExpr|number){return new GestureNumber(Math.min(this.value,GestureNumber.of(x)));}
  greaterThan(x:GestureExpr|number){return new GestureNumber(this.value>GestureNumber.of(x)?1:0);}
  lessThan(x:GestureExpr|number){return new GestureNumber(this.value<GestureNumber.of(x)?1:0);}
  equal(x:GestureExpr|number){return new GestureNumber(this.value===GestureNumber.of(x)?1:0);}
  and(x:GestureExpr){return new GestureNumber(this.value!==0&&GestureNumber.of(x)!==0?1:0);}
  or(x:GestureExpr){return new GestureNumber(this.value!==0||GestureNumber.of(x)!==0?1:0);}
  not(){return new GestureNumber(this.value!==0?0:1);}
  select(a:GestureExpr,b:GestureExpr){return this.value!==0?a:b;}
}
export const CPU_GESTURE_OPS:GestureOps={lit:value=>new GestureNumber(value),sin:x=>new GestureNumber(Math.sin((x as GestureNumber).value))};
export const gestureValue=(x:GestureExpr):number=>(x as GestureNumber).value;

/** The same formulas traced into a flat tape: every node is one slot of a
 * Float64Array, computed once per evaluation in creation order (operands are
 * always created before their users) by one monomorphic loop, with no closure
 * call and no allocation. Inputs given as constants are folded while tracing
 * (a node whose operands are all known is computed then; a select on a known
 * condition is its branch) and only the nodes an output reads are kept, so a
 * trace specialised on the discrete state of an actor computes only the
 * clock-driven nodes it draws. Every value comes from `compute`, the
 * operations of GestureNumber in the same order, hence the same numbers. */
const enum TapeOp {Add,Sub,Mul,Mod,Clamp,Max,Min,Gt,Lt,Eq,And,Or,Not,Select,Sin}
function compute(op:number,x:number,y:number,z:number):number {
  switch(op){
    case TapeOp.Add:return x+y; case TapeOp.Sub:return x-y; case TapeOp.Mul:return x*y;
    case TapeOp.Mod:return x-y*Math.floor(x/y); case TapeOp.Clamp:return Math.min(z,Math.max(y,x));
    case TapeOp.Max:return Math.max(x,y); case TapeOp.Min:return Math.min(x,y);
    case TapeOp.Gt:return x>y?1:0; case TapeOp.Lt:return x<y?1:0; case TapeOp.Eq:return x===y?1:0;
    case TapeOp.And:return x!==0&&y!==0?1:0; case TapeOp.Or:return x!==0||y!==0?1:0; case TapeOp.Not:return x!==0?0:1;
    case TapeOp.Select:return x!==0?y:z; default:return Math.sin(x);
  }
}
class Tape {
  readonly values:number[]=[];readonly known:boolean[]=[];readonly op:number[]=[];readonly a:number[]=[];readonly b:number[]=[];readonly c:number[]=[];readonly out:number[]=[];
  slot(value:number,known=true):number {this.values.push(value);this.known.push(known);return this.values.length-1;}
  emit(op:TapeOp,a:number,b=-1,c=-1):number {
    const k=this.known,v=this.values;
    if(op===TapeOp.Select&&k[a])return v[a]!==0?b:c;
    if(op===TapeOp.And&&(k[a]&&v[a]===0||k[b]&&v[b]===0))return this.slot(0);
    if(op===TapeOp.Or&&(k[a]&&v[a]!==0||k[b]&&v[b]!==0))return this.slot(1);
    if(k[a]&&(b<0||k[b])&&(c<0||k[c]))return this.slot(compute(op,v[a]!,b<0?0:v[b]!,c<0?0:v[c]!));
    const out=this.slot(0,false);this.op.push(op);this.a.push(a);this.b.push(Math.max(b,0));this.c.push(Math.max(c,0));this.out.push(out);return out;
  }
}
let tape:Tape|undefined;
class TapeNode implements GestureExpr {
  constructor(readonly index:number){}
  private static of(x:GestureExpr|number):number {return typeof x==='number'?tape!.slot(x):(x as TapeNode).index;}
  private emit(op:TapeOp,x?:GestureExpr|number,y?:GestureExpr|number):TapeNode {
    return new TapeNode(tape!.emit(op,this.index,x===undefined?-1:TapeNode.of(x),y===undefined?-1:TapeNode.of(y)));
  }
  add(x:GestureExpr|number){return this.emit(TapeOp.Add,x);}
  sub(x:GestureExpr|number){return this.emit(TapeOp.Sub,x);}
  mul(x:GestureExpr|number){return this.emit(TapeOp.Mul,x);}
  mod(x:GestureExpr|number){return this.emit(TapeOp.Mod,x);}
  clamp(low:GestureExpr|number,high:GestureExpr|number){return this.emit(TapeOp.Clamp,low,high);}
  max(x:GestureExpr|number){return this.emit(TapeOp.Max,x);}
  min(x:GestureExpr|number){return this.emit(TapeOp.Min,x);}
  greaterThan(x:GestureExpr|number){return this.emit(TapeOp.Gt,x);}
  lessThan(x:GestureExpr|number){return this.emit(TapeOp.Lt,x);}
  equal(x:GestureExpr|number){return this.emit(TapeOp.Eq,x);}
  and(x:GestureExpr){return this.emit(TapeOp.And,x);}
  or(x:GestureExpr){return this.emit(TapeOp.Or,x);}
  not(){return this.emit(TapeOp.Not);}
  select(x:GestureExpr,y:GestureExpr){return this.emit(TapeOp.Select,x,y);}
}
const TAPE_OPS:GestureOps={lit:value=>new TapeNode(tape!.slot(value)),sin:x=>new TapeNode(tape!.emit(TapeOp.Sin,(x as TapeNode).index))};
/** Traces `formula` over named numeric inputs once; `fixed[k]`, when given,
 * is the constant value of input k. The caller writes the variable inputs
 * into `env` in the order of `inputs`; `evaluate` fills one reused record. */
interface GestureTrace<O extends string> {env:Float64Array;evaluate():Readonly<Record<O,number>>}
function traceGesture<I extends string,O extends string>(inputs:readonly I[],formula:(o:GestureOps,i:Record<I,GestureExpr>)=>Record<O,GestureExpr>,fixed:readonly (number|undefined)[]=[]):GestureTrace<O> {
  const built=tape=new Tape(),symbols={} as Record<I,GestureExpr>;
  inputs.forEach((name,k)=>{const value=fixed[k];symbols[name]=new TapeNode(built.slot(value??0,value!==undefined));});
  let traced:Record<O,GestureExpr>;try{traced=formula(TAPE_OPS,symbols);}finally{tape=undefined;}
  const keys=Object.keys(traced) as O[],outputs=Int32Array.from(keys.map(key=>(traced[key] as TapeNode).index)),result={} as Record<O,number>;
  // Only the nodes an output reads stay on the tape (the branches a folded
  // select dropped are traced but never computed).
  const live=new Uint8Array(built.values.length),kept:number[]=[];
  for(const index of outputs)live[index]=1;
  for(let i=built.op.length-1;i>=0;i--){
    if(!live[built.out[i]!])continue;kept.push(i);const unary=built.op[i]===TapeOp.Not||built.op[i]===TapeOp.Sin,ternary=built.op[i]===TapeOp.Clamp||built.op[i]===TapeOp.Select;
    live[built.a[i]!]=1;if(!unary)live[built.b[i]!]=1;if(ternary)live[built.c[i]!]=1;
  }
  kept.reverse();
  const v=Float64Array.from(built.values),env=v.subarray(0,inputs.length),n=kept.length;
  const pick=(column:number[])=>Int32Array.from(kept,i=>column[i]!);
  const op=Uint8Array.from(kept,i=>built.op[i]!),A=pick(built.a),B=pick(built.b),C=pick(built.c),out=pick(built.out);
  // A fixed input keeps its constant even if the caller writes env.
  const fixedSlots=Int32Array.from(fixed.flatMap((value,k)=>value===undefined?[]:[k])),fixedValues=Float64Array.from(fixedSlots,k=>fixed[k]!);
  return {env,evaluate:()=>{
    for(let k=0;k<fixedSlots.length;k++)v[fixedSlots[k]!]=fixedValues[k]!;
    for(let i=0;i<n;i++)v[out[i]!]=compute(op[i]!,v[A[i]!]!,v[B[i]!]!,v[C[i]!]!);
    for(let k=0;k<keys.length;k++)result[keys[k]!]=v[outputs[k]!]!;return result;
  }};
}
/** Traces specialised on the discrete state of an actor, bounded. */
const SPECIALISED_TRACES=512;

const smooth=(o:GestureOps,e0:number,e1:number,x:GestureExpr):GestureExpr=>{const s=x.sub(e0).mul(1/(e1-e0)).clamp(0,1);return s.mul(s).mul(s.mul(-2).add(3));};
const mix=(a:GestureExpr,b:GestureExpr,s:GestureExpr):GestureExpr=>a.add(b.sub(a).mul(s));
const sel=(o:GestureOps,c:GestureExpr,a:GestureExpr|number,b:GestureExpr|number):GestureExpr=>c.select(typeof a==='number'?o.lit(a):a,typeof b==='number'?o.lit(b):b);

/** Slow clock factor: one period per 102.4 local ticks (17.07 s at x1). */
export const GESTURE_SLOW_RATE=2*Math.PI*6/102.4;

/** Activity codes (aMotion.y) of the presentation gestures. Negative values
 * never show a work tool (tools are -30..-32) and never trigger the generic
 * positive-activity arm gesture. Reading keeps its published code 14, which
 * also opens the held novel. */
export const HUMAN_GESTURE=Object.freeze({tableGame:-41,television:-42,chat:-43,viewArt:-44,downed:-45,eat:-46,reading:14});
export type HumanGestureCode=typeof HUMAN_GESTURE[keyof typeof HUMAN_GESTURE];

/** Gesture code of a person from the fields the actor dependency capture
 * already holds (state, recreation activity/phase, need). 0: none. */
export function humanGestureCode(pawn:Pawn):number {
  if(pawn.state==='downed'){
    // Core: no wiggle in bed (PawnDownedWiggler, !pawn.InBed()).
    const inBed=pawn.need?.kind==='sleep'&&pawn.need.bedId!==null;
    return inBed?0:HUMAN_GESTURE.downed;
  }
  if(pawn.state==='eating')return HUMAN_GESTURE.eat;
  if(pawn.state!=='recreating')return 0;
  const task=pawn.recreation.task;if(!task||task.phase!=='active')return 0;
  switch(task.activity){
    case 'chess':case 'poker':case 'game-of-ur':return HUMAN_GESTURE.tableGame;
    case 'watch-television':return HUMAN_GESTURE.television;
    case 'social-relax':case 'visit-sick':case 'party':return HUMAN_GESTURE.chat;
    case 'view-art':return HUMAN_GESTURE.viewArt;
    default:return 0;
  }
}

/** Core PawnDownedWiggler: period 600 Core ticks, +0.35°/tick during the
 * first 90 ticks of each half (+31.5° then back), phase offset per pawn.
 * Core offsets by |thingID hash| % 600; Elsewhere by a fixed hash of the id. */
export const DOWNED_WIGGLE=Object.freeze({period:600,length:90,half:300,degreesPerTick:.35});
export const downedWiggleOffset=(id:number):number=>((Math.imul(id|0,2654435761)>>>0)%600);
/** Phase (seconds) carried by aMotion.w for a downed pawn: with the travel
 * clock local origin (local ticks), (travelTime+phase)*60 is the Core tick
 * plus the pawn's offset, modulo 600, across every origin rebase. */
export function downedWigglePhase(id:number,origin:number):number {
  return (((origin*10+downedWiggleOffset(id))%600)+600)%600/60;
}
/** Core angle (radians) at a Core tick of the wiggle period. */
export function downedWiggleAngle(o:GestureOps,coreTick:GestureExpr):GestureExpr {
  const w=coreTick.mod(DOWNED_WIGGLE.period);
  return w.min(DOWNED_WIGGLE.length).sub(w.sub(DOWNED_WIGGLE.half).clamp(0,DOWNED_WIGGLE.length)).mul(DOWNED_WIGGLE.degreesPerTick*Math.PI/180);
}

export interface HumanGestureInput {
  code:GestureExpr;pose:GestureExpr;walking:GestureExpr;cargo:GestureExpr;
  /** presentation clock (s, wrapped at 2π), per-actor phase (aMotion.w),
   * travelTime (s from the local origin). */
  t:GestureExpr;phase:GestureExpr;travelTime:GestureExpr;
}
/** upper: torso and head angles replaced; arms: both arm angles replaced.
 * lean (forward +) turns the whole upper body about the hip; yaw turns the
 * head about the neck; chest lifts the lying chest; wiggle turns the whole
 * body about its root (downed). */
export interface HumanGesture {
  upper:GestureExpr;arms:GestureExpr;torso:GestureExpr;head:GestureExpr;arm2:GestureExpr;arm3:GestureExpr;
  lean:GestureExpr;yaw:GestureExpr;chest:GestureExpr;wiggle:GestureExpr;
}

/** Pose codes used here: 0 standing, 1 lying awake, 2 eating standing,
 * 3 seated, 5 skygazing, 18 asleep. */
export function humanGesture(o:GestureOps,i:HumanGestureInput):HumanGesture {
  const {code,pose,t,phase:p}=i,still=i.walking.lessThan(.5),s=(k:number,shift=0)=>o.sin(t.mul(k).add(p).add(shift));
  const b=s(1),u=i.travelTime.mul(GESTURE_SLOW_RATE);
  const seated=pose.equal(3).and(still),standing=pose.equal(0).or(pose.equal(2)).and(still);
  const loaded=i.cargo.greaterThan(.5);
  const is=(value:number)=>code.equal(value);
  const reading=is(HUMAN_GESTURE.reading),eat=is(HUMAN_GESTURE.eat),game=is(HUMAN_GESTURE.tableGame),tv=is(HUMAN_GESTURE.television),chat=is(HUMAN_GESTURE.chat),art=is(HUMAN_GESTURE.viewArt),downed=is(HUMAN_GESTURE.downed);
  const bench=code.greaterThan(.5).and(code.lessThan(3.5));
  // The existing cargo hold (PawnLayer cargo rule): reading keeps the book still.
  const cargoArm=sel(o,pose.greaterThan(1.5),sel(o,reading,-1.3,o.sin(t.mul(4).add(p)).mul(.22).add(-1.3)),-.9);
  // Idle standing: breathing (as before), a look around held left/right, a
  // small weight shift and, every ~17 s, a hand raised to the head.
  const scratch=smooth(o,.965,.995,o.sin(u.add(p)));
  const idle={torso:b.mul(.018),head:b.mul(.026).add(s(2).mul(.04)).add(scratch.mul(.12)),
    arm2:b.mul(.025).add(.035),arm3:mix(b.mul(-.025).add(.035),o.sin(t.mul(9)).mul(.10).add(-2.45),scratch),
    lean:s(1,1).mul(.012),yaw:o.sin(t.add(p.mul(1.3))).mul(1.7).clamp(-1,1).mul(.42).mul(scratch.mul(-1).add(1))};
  // Seated without a particular activity: hands on the lap, looking around.
  const rest={torso:o.lit(0),head:b.mul(.02).add(.05),arm2:b.mul(.012).add(-.55),arm3:b.mul(-.012).add(-.55),lean:b.mul(.01).add(.05),yaw:o.sin(t.add(p)).mul(1.5).clamp(-1,1).mul(.25)};
  // Chess, poker, game of Ur: forearms on the table, eyes on the board, a
  // glance at the opponent, a piece moved now and then.
  const look=smooth(o,.55,.95,o.sin(t.add(p.mul(1.1)))),move=smooth(o,.72,.98,s(1,2.2));
  const tableGame={torso:o.lit(0),head:look.mul(-.28).add(.32).add(b.mul(.015)),arm2:b.mul(.02).add(-1.02),
    arm3:move.mul(-.42).add(-1.10).add(o.sin(t.mul(6)).mul(.03).mul(move)),lean:sel(o,seated,.15,.22).add(b.mul(.015)).add(move.mul(.05)),yaw:s(2).mul(.18).mul(look)};
  // Television: leaning back, hands on the lap, a laugh now and then.
  const laugh=smooth(o,.9,1,o.sin(t.add(p.mul(.6)).add(1)));
  const tvArm=sel(o,seated,b.mul(.01).add(-.55),b.mul(.02).add(.03));
  const television={torso:o.lit(0),head:b.mul(.015).add(-.04).add(o.sin(t.mul(9)).mul(.06).mul(laugh)),arm2:tvArm,arm3:tvArm.sub(laugh.mul(.12)),
    lean:sel(o,seated,-.09,-.02).add(b.mul(.01)).add(laugh.mul(.04)),yaw:o.sin(t.add(p)).mul(.06)};
  // Conversation: speaking (hands move) and listening (nods), head turned.
  const talk=b.mul(.5).add(.5),chatBase=sel(o,seated,-.55,.03),listen=talk.mul(-1).add(1);
  const conversation={torso:o.lit(0),head:s(5).mul(.05).mul(listen).add(.03).add(b.mul(.02)),
    arm2:chatBase.add(s(3).mul(.22).add(-.45).mul(talk)),arm3:chatBase.add(s(4,1.3).mul(.30).add(-.35).mul(talk)),
    lean:sel(o,seated,.05,.02).add(s(2).mul(.04).mul(talk)),yaw:o.sin(t.add(p.mul(.9)).add(1.7)).mul(1.4).clamp(-1,1).mul(.30)};
  // Admiring art: hands behind the back, looking up at the work.
  const viewArt={torso:b.mul(.02),head:s(1).mul(.05).add(-.10),arm2:b.mul(.01).add(.38),arm3:b.mul(-.01).add(.38),lean:o.lit(.03),yaw:o.sin(t.add(p.mul(1.4))).mul(.16)};
  // Eating: a bite every cycle, the head meets the hand.
  const bite=s(4).max(0);
  const meal={torso:o.lit(0),head:bite.mul(.10).add(.14),arm2:sel(o,loaded,cargoArm,-1.0),arm3:sel(o,loaded,cargoArm,bite.mul(-.5).add(-1.25)),lean:sel(o,seated,.10,.05),yaw:o.lit(0)};
  // Reading: the book held still, eyes down, a page turned now and then.
  const page=smooth(o,.86,1,s(1,.4));
  const read={torso:o.lit(0),head:b.mul(.01).add(.34),arm2:sel(o,loaded,cargoArm,b.mul(.015).add(-1.18)),
    arm3:sel(o,loaded,cargoArm,o.lit(-1.18)).sub(page.mul(.28)),lean:sel(o,seated,.08,.04),yaw:o.sin(t.add(p)).mul(.05)};
  // Seated at a bench: the craft cadence of the activity, leaning in.
  const cadence=sel(o,code.equal(2),8,sel(o,code.equal(3),5,11)),breadth=sel(o,code.equal(2),.62,sel(o,code.equal(3),.33,.54)),offset=sel(o,code.equal(3),.99,.87);
  const benchWork={torso:o.lit(0),head:s(7).mul(.02).add(.22),arm2:o.sin(t.mul(cadence).add(p)).mul(breadth).sub(offset),
    arm3:o.sin(t.mul(cadence).add(p).add(1.25)).mul(breadth).sub(offset),lean:o.lit(.12),yaw:o.lit(0)};
  // Choose the branch.
  const useIdle=standing.and(code.equal(0)),useRest=seated.and(code.equal(0));
  const useGame=game.and(seated.or(standing)),useTv=tv.and(seated.or(standing)),useChat=chat.and(seated.or(standing)),useArt=art.and(standing);
  const useEat=eat.and(seated.or(standing)),useRead=reading.and(seated.or(standing)),useBench=bench.and(seated);
  const pick=(key:'torso'|'head'|'arm2'|'arm3'|'lean'|'yaw',none:GestureExpr):GestureExpr=>
    sel(o,useIdle,idle[key],sel(o,useRest,rest[key],sel(o,useGame,tableGame[key],sel(o,useTv,television[key],sel(o,useChat,conversation[key],
      sel(o,useArt,viewArt[key],sel(o,useEat,meal[key],sel(o,useRead,read[key],sel(o,useBench,benchWork[key],none)))))))));
  const upper=useIdle.or(useRest).or(useGame).or(useTv).or(useChat).or(useArt).or(useEat).or(useRead).or(useBench);
  // Carried loads keep their hold, except while eating or reading them.
  const armsUpright=upper.and(loaded.not().or(useEat).or(useRead));
  // Lying: breathing, the head turned on the pillow; downed: Core's wiggle,
  // laboured breathing and a hand reaching out.
  const lyingAwake=pose.equal(1).or(pose.equal(5)),asleep=pose.equal(18),down=downed.and(pose.equal(1));
  const reach=smooth(o,.85,1,b);
  const chest=sel(o,down,s(3).mul(.016),sel(o,lyingAwake,s(2).mul(.010),sel(o,asleep,b.mul(.012),0)));
  const lyingYaw=sel(o,down,s(2).mul(.2),sel(o,pose.equal(5),b.mul(.15),sel(o,pose.equal(1),o.sin(t.add(p).add(.5)).mul(1.5).clamp(-1,1).mul(.35),0)));
  const wiggle=sel(o,down,downedWiggleAngle(o,i.travelTime.add(p).mul(60)),0);
  return {upper,arms:armsUpright.or(down),torso:pick('torso',o.lit(0)),head:pick('head',o.lit(0)),
    arm2:sel(o,down,0,pick('arm2',o.lit(0))),arm3:sel(o,down,reach.mul(-.5),pick('arm3',o.lit(0))),
    lean:pick('lean',o.lit(0)),yaw:sel(o,upper,pick('yaw',o.lit(0)),lyingYaw),chest,wiggle};
}

const HUMAN_INPUTS=['code','pose','walking','cargo','t','phase','travelTime'] as const;
const humanFormula=(o:GestureOps,i:Record<typeof HUMAN_INPUTS[number],GestureExpr>)=>humanGesture(o,i) as unknown as Record<keyof HumanGesture,GestureExpr>;
let humanTrace:GestureTrace<keyof HumanGesture>|undefined;
const humanTraces=new Map<number,GestureTrace<keyof HumanGesture>>();
/** humanGesture for the retained CPU sampler, without allocation once the
 * actor's state has been seen. The record returned is reused by the next
 * call. humanGesture reads walking only through walking<.5 and cargo only
 * through cargo>.5, so a trace specialised on (code, pose, the two tests)
 * with 0/1 standing for them gives the same values. */
export function evaluateHumanGesture(code:number,pose:number,walking:number,cargo:number,t:number,phase:number,travelTime:number):Readonly<Record<keyof HumanGesture,number>> {
  const w=walking<.5?0:1,c=cargo>.5?1:0;let trace:GestureTrace<keyof HumanGesture>|undefined;
  if(Number.isInteger(code)&&Number.isInteger(pose)&&code>=-128&&code<128&&pose>=0&&pose<64){
    const key=((code+128)*64+pose)*4+w*2+c;trace=humanTraces.get(key);
    if(!trace&&humanTraces.size<SPECIALISED_TRACES){trace=traceGesture(HUMAN_INPUTS,humanFormula,[code,pose,w,c]);humanTraces.set(key,trace);}
  }
  trace??=humanTrace??=traceGesture(HUMAN_INPUTS,humanFormula);
  const e=trace.env;e[0]=code;e[1]=pose;e[2]=w;e[3]=c;e[4]=t;e[5]=phase;e[6]=travelTime;return trace.evaluate();
}

/** Scalar shortcut of humanGesture for the retained sampler's frequent case,
 * a middle-distance sleeper or body (static middle rigs are resampled at
 * middleHz): asleep, only the chest moves; dead, nothing. Equal to
 * humanGesture for poses 18 and 19 (checked by the tests). */
export function restingHumanChest(pose:number,t:number,phase:number):number {return pose===18?Math.sin(t+phase)*.012:0;}

/** Body families of the animal gestures, from the native body and diet. */
export type AnimalFamily='quadruped'|'canine'|'feline'|'bird'|'insect'|'snake'|'turtle'|'lizard'|'primate';
export interface AnimalIdleProfile {
  readonly family:AnimalFamily;
  /** Lowers its head to graze (rough-plant eaters) or pecks (birds). */
  readonly graze:number;readonly peck:number;
  /** Tail swing (radians, rad/s integer) while idle. */
  readonly tailAmplitude:number;readonly tailRate:number;
  /** Mammals give a short whole-body shake now and then; birds ruffle. */
  readonly shake:number;readonly ruffle:number;
  /** Head turns while looking around (radians). */
  readonly look:number;
}
const CANINES=new Set(['labrador-retriever','husky','yorkshire-terrier','red-fox','arctic-fox','fennec-fox','timber-wolf','arctic-wolf','warg']);
const FELINES=new Set(['cat','cougar','panther','lynx']);
export function animalIdleProfile(species:string,body?:string,food?:string):AnimalIdleProfile {
  const family:AnimalFamily=body==='Bird'?'bird':body?.startsWith('BeetleLike')?'insect':body==='Snake'?'snake':body==='TurtleLike'?'turtle'
    :body==='QuadrupedAnimalWithClawsTailAndJowl'?'lizard':body==='Monkey'?'primate':CANINES.has(species)?'canine':FELINES.has(species)?'feline':'quadruped';
  const grazer=family==='quadruped'&&(food===undefined?['hare','snow-hare','deer','muffalo','gazelle','dromedary'].includes(species):/VegetarianRough/.test(food));
  const mammal=family==='quadruped'||family==='canine'||family==='feline'||family==='primate';
  return {family,graze:grazer?1:0,peck:family==='bird'?1:0,
    tailAmplitude:family==='canine'?.38:family==='feline'?.30:family==='quadruped'||family==='lizard'?.22:family==='primate'?.20:0,
    tailRate:family==='canine'?7:family==='feline'?2:3,shake:mammal?1:0,ruffle:family==='bird'?1:0,
    look:family==='insect'?.18:family==='snake'?.30:family==='turtle'?.22:.40};
}

/** aAnimal.z of a downed animal that is awake and not in bed (Core wiggles it). */
export const ANIMAL_POSTURE_DOWNED=1.25;
/** animalPart.w tags of authored appendages (eye marks are -1, 0 and 1). */
export const ANIMAL_APPENDAGE=Object.freeze({tail:-2,leftWing:-3,rightWing:-4});

export interface AnimalGestureInput {
  moving:GestureExpr;eating:GestureExpr;posture:GestureExpr;seed:GestureExpr;carried:GestureExpr;
  t:GestureExpr;travelTime:GestureExpr;
  graze:GestureExpr;peck:GestureExpr;tailAmplitude:GestureExpr;tailRate:GestureExpr;shake:GestureExpr;ruffle:GestureExpr;look:GestureExpr;
}
/** headPitch is added to the head bones (down +), headYaw turns them about
 * the head pivot; tail turns the tail about its root; wing lifts the wings;
 * roll turns the whole standing body about its long axis (shake); breath
 * swells a lying body; wiggle is Core's downed turn. */
export interface AnimalGesture {headPitch:GestureExpr;headYaw:GestureExpr;tail:GestureExpr;wing:GestureExpr;roll:GestureExpr;breath:GestureExpr;wiggle:GestureExpr}
export function animalGesture(o:GestureOps,i:AnimalGestureInput):AnimalGesture {
  const {t,seed}=i,s=(k:number,shift=0)=>o.sin(t.mul(k).add(seed).add(shift)),u=i.travelTime.mul(GESTURE_SLOW_RATE);
  const free=i.carried.lessThan(.5),idle=i.moving.lessThan(.5).and(i.eating.lessThan(.5)).and(i.posture.lessThan(.5)).and(free);
  const lying=i.posture.greaterThan(.5).and(i.posture.lessThan(1.5)).and(free),downed=i.posture.equal(ANIMAL_POSTURE_DOWNED).and(free);
  // Grazing: the head goes down to the grass for a moment and nibbles.
  const graze=smooth(o,.55,.95,o.sin(t.add(seed.mul(1.7)))).mul(i.graze);
  const peck=smooth(o,.8,.98,s(2)).mul(i.peck);
  const nibble=o.sin(t.mul(9)).mul(.06).mul(graze);
  const headPitch=sel(o,idle,graze.mul(.75).add(nibble).add(peck),0);
  const headYaw=sel(o,idle,o.sin(t.add(seed.mul(1.3))).mul(1.6).clamp(-1,1).mul(i.look).mul(graze.mul(-1).add(1)),sel(o,lying,s(1,.5).mul(.10),0));
  const tail=sel(o,idle,o.sin(t.mul(i.tailRate).add(seed)).mul(i.tailAmplitude),sel(o,i.moving.greaterThan(.5).and(free),s(5).mul(i.tailAmplitude.mul(.35)),sel(o,lying,s(1).mul(i.tailAmplitude.mul(.25)),0)));
  const shake=smooth(o,.985,1,o.sin(u.add(seed)));
  const roll=sel(o,idle,o.sin(t.mul(25)).mul(.16).mul(shake).mul(i.shake),0);
  const ruffle=smooth(o,.92,1,s(1,2));
  const wing=sel(o,idle,o.sin(t.mul(16)).max(0).mul(.35).mul(ruffle).mul(i.ruffle),0);
  const breath=sel(o,downed,s(3).mul(.05),sel(o,lying,s(1).mul(.035),0));
  const wiggle=sel(o,downed,downedWiggleAngle(o,i.travelTime.add(seed).mul(60)),0);
  return {headPitch,headYaw,tail,wing,roll,breath,wiggle};
}
export interface ScalarAnimalGesture {headPitch:number;headYaw:number;tail:number;wing:number;roll:number;breath:number;wiggle:number}
type AnimalInput=keyof AnimalGestureInput;
const ANIMAL_INPUTS:readonly AnimalInput[]=['moving','eating','posture','seed','carried','t','travelTime','graze','peck','tailAmplitude','tailRate','shake','ruffle','look'];
const animalFormula=(o:GestureOps,i:Record<AnimalInput,GestureExpr>)=>animalGesture(o,i) as unknown as Record<keyof AnimalGesture,GestureExpr>;
let animalTrace:GestureTrace<keyof AnimalGesture>|undefined;
const animalTraces=new Map<number,GestureTrace<keyof AnimalGesture>>();
/** animalGesture for the retained CPU sampler, without allocation once the
 * state has been seen. The record returned is reused by the next call.
 * animalGesture reads moving only against .5 (below, above), eating and
 * carried only through x<.5 and posture through exact comparisons, so a trace
 * specialised on those classes, with 0/.5/1 standing for them, gives the same
 * values. The species profile stays an input. */
export function evaluateAnimalGesture(moving:number,eating:number,posture:number,seed:number,carried:number,t:number,travelTime:number,profile:AnimalIdleProfile):Readonly<ScalarAnimalGesture> {
  const m=moving<.5?0:moving>.5?1:.5,f=eating<.5?0:1,c=carried<.5?0:1,p4=posture*4;let trace:GestureTrace<keyof AnimalGesture>|undefined;
  if(Number.isInteger(p4)&&p4>=0&&p4<64){
    const key=((p4*3+m*2)*2+f)*2+c;trace=animalTraces.get(key);
    if(!trace&&animalTraces.size<SPECIALISED_TRACES){trace=traceGesture(ANIMAL_INPUTS,animalFormula,[m,f,posture,undefined,c]);animalTraces.set(key,trace);}
  }
  trace??=animalTrace??=traceGesture(ANIMAL_INPUTS,animalFormula);
  const e=trace.env;e[0]=m;e[1]=f;e[2]=posture;e[3]=seed;e[4]=c;e[5]=t;e[6]=travelTime;
  e[7]=profile.graze;e[8]=profile.peck;e[9]=profile.tailAmplitude;e[10]=profile.tailRate;e[11]=profile.shake;e[12]=profile.ruffle;e[13]=profile.look;return trace.evaluate();
}
/** Scalar shortcut of animalGesture for the retained sampler's frequent case,
 * a still animal asleep or dead (posture 1 or 2, not moving), or undefined
 * when the general formula applies. Equal to animalGesture there. */
const restingAnimal:ScalarAnimalGesture={headPitch:0,headYaw:0,tail:0,wing:0,roll:0,breath:0,wiggle:0};
/** The record returned is reused by the next call. */
export function restingAnimalGesture(moving:number,posture:number,seed:number,carried:number,t:number,tailAmplitude:number):Readonly<ScalarAnimalGesture>|undefined {
  if(moving>=.5||(posture!==1&&posture!==2))return;
  const lying=posture===1&&carried<.5,wave=lying?Math.sin(t+seed):0;
  restingAnimal.headYaw=lying?Math.sin(t+seed+.5)*.10:0;restingAnimal.tail=wave*tailAmplitude*.25;restingAnimal.breath=wave*.035;
  return restingAnimal;
}
