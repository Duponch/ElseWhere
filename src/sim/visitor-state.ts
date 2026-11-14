import { TICKS_PER_DAY,type Cell,type MaterialPile,type Pawn } from './types.ts';

export type VisitorPhase='arriving'|'staying'|'leaving';
export type VisitorKind='traveler'|'visitor';
export type VisitorAgendaKind=VisitorKind|'exotic'|'caravan';
export interface VisitorState {group:number;role:'traveler'|'visitor'|'trader';merchantKind?:'exotic';phase:VisitorPhase;goal:Cell|null;personalFoodIds:number[];medicalGuestAt?:number}
export interface VisitorGroup {id:number;kind:VisitorKind;members:number[];entry:Cell;spot:Cell;phase:VisitorPhase;startedAt:number;arrivedAt:number|null;durationCore:number;hostile:boolean;reason?:'timeout'|'danger'|'hostile'|'blocked';
  /** Schema 332: a Core trader caravan (kind visitor), never added to an older group. */
  caravan332?:import('./trader-caravans-332.ts').TraderCaravan332}
/** Frozen departure evidence, not a simulated world population. */
export interface VisitorDeparture {group:number;tick:number;pawn:Pawn;items:MaterialPile[];packed?:import('./furniture-rules.ts').PackedFurniture[]}
export interface VisitorAgenda {rng:number;cycle:number;last:number;pending:number[]}
interface VisitorOwner {adoptedAt:number;rng:number;serial:number;groups:VisitorGroup[];departed:VisitorDeparture[]}
export interface HomeVisitorCalendar extends VisitorOwner {profile:'cassandra-visitors-v1';introAt:number|null;traveler:VisitorAgenda;visitor:VisitorAgenda;exotic?:VisitorAgenda;
  /** Schema 332: Cassandra TraderCaravanArrival opportunities (5 a year from day 5, 6 days apart). */
  caravan332?:VisitorAgenda}
/** Created only by an actual TempMap arrival. The RNG is a receipt of that
 * admission, never a second incident stream. No home opportunity is installed. */
export interface TempTravelerCalendar261 extends VisitorOwner {profile:'temp-travelers261-v1';introAt?:never;traveler?:never;visitor?:never;exotic?:never;caravan332?:never}
export type VisitorCalendar=HomeVisitorCalendar|TempTravelerCalendar261;
export const VISITOR_YEAR=60*TICKS_PER_DAY;
export const VISITOR_INTERVAL=100;
export const INTRO_VISITOR_TICK=2.5*TICKS_PER_DAY;
export const VISITOR_FLOWS=Object.freeze({traveler:{minimum:TICKS_PER_DAY,count:6,spacing:TICKS_PER_DAY},visitor:{minimum:3*TICKS_PER_DAY,count:4,spacing:5*TICKS_PER_DAY},exotic:{minimum:6*TICKS_PER_DAY,count:2,spacing:15*TICKS_PER_DAY},
  // Core StorytellerCompProperties_FactionInteraction TraderCaravanArrival (Cassandra).
  caravan:{minimum:5*TICKS_PER_DAY,count:5,spacing:6*TICKS_PER_DAY}});
export function visitorRandom(s:{rng:number}):number {let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}

/** Same yearly opportunity counts, 1,000-Core-tick buckets and forward spacing
 * as the reference. The private PRNG deliberately is not RimWorld's RNG. */
export function prepareVisitorCycle(a:VisitorAgenda,kind:VisitorAgendaKind):void {
  const rule=VISITOR_FLOWS[kind],start=rule.minimum+a.cycle*VISITOR_YEAR;
  for(let attempt=0;attempt<101;attempt++) {
    const times=Array.from({length:rule.count},()=>start+Math.floor(visitorRandom(a)*VISITOR_YEAR/VISITOR_INTERVAL)*VISITOR_INTERVAL).sort((x,y)=>x-y);
    for(let i=0;i<times.length;i++)times[i]=Math.max(times[i]!,i?times[i-1]!+rule.spacing:a.last+rule.spacing);
    if(times.at(-1)!>start+VISITOR_YEAR)continue;
    a.pending=times;a.last=times.at(-1)!;return;
  }
  throw new Error('Cannot schedule neutral visitor opportunities.');
}
export function newVisitorAgenda(seed:number,kind:VisitorAgendaKind,tick:number,prospective=false):VisitorAgenda {
  const a:VisitorAgenda={rng:((seed^(kind==='traveler'?0x88a1641:kind==='exotic'?0x123e70c:kind==='caravan'?0xca7a332:0x88b4371))>>>0)||1,cycle:0,last:-VISITOR_YEAR,pending:[]};
  if(prospective){
    // Jump directly to the first unstarted annual window. No historical RNG
    // catch-up loop, arrival, old last-date or population is reconstructed.
    a.cycle=Math.max(0,Math.floor((tick-VISITOR_FLOWS[kind].minimum)/VISITOR_YEAR)+1);
    prepareVisitorCycle(a,kind);return a;
  }
  // Explicit adoption discards past opportunities, never a catch-up arrival.
  do {prepareVisitorCycle(a,kind);a.pending=a.pending.filter(t=>t>tick);if(!a.pending.length)a.cycle++;}while(!a.pending.length);
  return a;
}
export function consumeVisitorOpportunity(a:VisitorAgenda,kind:VisitorAgendaKind,tick:number):boolean {
  const due=a.pending[0]===tick;
  while(a.pending[0]!<=tick){a.pending.shift();if(!a.pending.length){a.cycle++;prepareVisitorCycle(a,kind);}}
  return due;
}

const VISIT_POINTS=[[45,0],[50,1],[100,1],[200,.25],[300,.1],[500,0]] as const;
const TRAVEL_POINTS=[[40,0],[50,1],[100,1],[200,.5],[300,.1],[500,0]] as const;
/** Inverse area sampling of the definition's piecewise linear density. */
export function visitorPoints(rng:{rng:number},kind:VisitorKind):number {
  const curve=kind==='visitor'?VISIT_POINTS:TRAVEL_POINTS;
  let area=0;for(let i=1;i<curve.length;i++)area+=(curve[i]![0]-curve[i-1]![0])*(curve[i]![1]+curve[i-1]![1])/2;
  let target=visitorRandom(rng)*area;
  for(let i=1;i<curve.length;i++){
    const [x0,y0]=curve[i-1]!,[x1,y1]=curve[i]!,dx=x1-x0,area=dx*(y0+y1)/2;
    if(target>area){target-=area;continue;}
    const slope=(y1-y0)/dx;
    return x0+(Math.abs(slope)<1e-12?target/y0:2*target/(y0+Math.sqrt(Math.max(0,y0*y0+2*slope*target))));
  }
  return 500;
}
