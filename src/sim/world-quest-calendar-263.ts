import type {WorldQuestCalendar263} from './world-sites-state-263.ts';

const DAY=60000,CHECK=1000,CYCLE=10*DAY,SPACING=3*DAY;
const RECENT=[.01,.3,.5,.7,.9] as const;
const populationCurve=[[0,8],[1,2],[4,1],[7,.35],[11,0],[20,-1]] as const;
const increasingCurve=[[0,.05],[1,.3],[3,.45]] as const;
function curve(points:readonly (readonly [number,number])[],x:number):number {
 if(x<=points[0]![0])return points[0]![1];
 for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!;if(x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
 return points[points.length-1]![1];
}
function random(s:WorldQuestCalendar263):number {let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
export const questAcceptance263=(core:number)=>Math.max(0,Math.min(1,(core/DAY-8)/7));
export function populationIncreasingChance263(population:number,adaptationDays:number):number {
 let intent=curve(populationCurve,population);if(intent>0)intent*=Math.min(1,adaptationDays/8);
 return curve(increasingCurve,intent);
}
/** This adopter is called only by a true263 SIM continuation. The entire
 * current cycle is skipped, including its unknown pre-adoption opportunity.
 * Native comp dimensions are retained; future dates use our saved private
 * stream, as for the existing small-incident profile, not Core seed parity. */
export function newQuestCalendar263(core:number,seed:number,colonistIds:readonly number[]):WorldQuestCalendar263 {
 if(!Number.isSafeInteger(core)||core<0||!Number.isInteger(seed)||!colonistIds.every(Number.isSafeInteger)||new Set(colonistIds).size!==colonistIds.length)throw Error('Invalid prospective quest frontier');
 return {revision:1,adoptedAtCore:core,nextCheckCore:(Math.floor(core/CHECK)+1)*CHECK,cycle:Math.floor(core/CYCLE),pendingCore:null,previousHitInterval:-1000000,rng:((seed^0x26351a5)>>>0)||1,opportunities:0,siteOffers:0,recent:[],populationAdaptationDays:0,populationAtCore:core,knownColonistIds:[...colonistIds]};
}
/** Actual free-colonist ownership, including caravans, is supplied once by
 * the campaign SIM authority. Leaving a map is not a gain or a loss. The
 * watcher sees only the current10-Core span; clock jumps do not replay it. */
export function advanceQuestPopulation263(s:WorldQuestCalendar263,core:number,colonistIds:readonly number[]):void {
 if(core<=s.populationAtCore)return;
 const consecutive=core-s.populationAtCore===10;
 if(colonistIds.some(id=>!s.knownColonistIds.includes(id)))s.populationAdaptationDays=0;
 if(consecutive&&Math.floor((s.populationAtCore-171)/30000)!==Math.floor((core-171)/30000))s.populationAdaptationDays+=.5;
 s.knownColonistIds=[...colonistIds];s.populationAtCore=core;
}
interface QuestSelection263 {points:number;progress:number;adjustedPopulation:number;hasFreeColonist:boolean;hasHomeMap:boolean;tradeRequests284?:boolean;peaceTalks293?:boolean;
 /** Schema 329: Core compares the cycle's random value with the day curve at
  * the hit; the curve depends only on time, so it is read at the hit date. */
 acceptAtHit329?:boolean}
/** Unsupported Core roots keep their tickets. Selecting one is a no-op,
 * never a fabricated quest or a redistribution towards ItemStash. Their
 * unimplemented CanRun/refire clauses are a declared catalogue limitation. */
export function selectWorldQuest263(s:WorldQuestCalendar263,input:QuestSelection263):'item-stash'|'trade-request'|'peace-talks'|null {
 if(!input.hasFreeColonist||!input.hasHomeMap)return null;
 if(random(s)<populationIncreasingChance263(input.adjustedPopulation,s.populationAdaptationDays))return null;
 const choices=[{key:'item-stash',weight:1},
  ...(input.points>=350?[{key:'bandit-camp',weight:1}]:[]),
  ...(input.progress>=8?[{key:'trade-request',weight:1.1}]:[]),
  ...(input.progress>=10?[{key:'peace-talks',weight:1}]:[])];
 for(const c of choices){for(let i=0;i<s.recent.length&&i<RECENT.length;i++)if(s.recent[i]===c.key)c.weight*=RECENT[i]!;}
 const total=choices.reduce((sum,c)=>sum+c.weight,0);let draw=random(s)*total;
 for(const c of choices){draw-=c.weight;if(draw<0)return c.key==='item-stash'?'item-stash':c.key==='trade-request'&&input.tradeRequests284?'trade-request':c.key==='peace-talks'&&input.peaceTalks293?'peace-talks':null;}
 return null;
}
/** Called at the true campaign tick, after other caravan owners. No RAF,
 * repeated poll, catch-up opportunity or advance on a second call. Returns
 * only the selected supported root; actual birth and history publication
 * remain the Site producer's transaction. */
export function advanceWorldQuestCalendar263(s:WorldQuestCalendar263,core:number,input:QuestSelection263):'item-stash'|'trade-request'|'peace-talks'|null {
 if(core<s.nextCheckCore)return null;
 s.nextCheckCore=(Math.floor(core/CHECK)+1)*CHECK;
 const cycle=Math.floor(core/CYCLE);
 if(cycle!==s.cycle){s.cycle=cycle;s.pendingCore=null;
  if(core===cycle*CYCLE){
   const proposed=Math.max(cycle*CYCLE+Math.floor(random(s)*(CYCLE/CHECK))*CHECK,(s.previousHitInterval*CHECK)+SPACING);
   if(proposed<(cycle+1)*CYCLE&&random(s)<questAcceptance263(input.acceptAtHit329?proposed:core))s.pendingCore=proposed;
  }
 }
 if(s.pendingCore===null||s.pendingCore>core)return null;
 const due=s.pendingCore===core;s.pendingCore=null;if(!due)return null;
 s.previousHitInterval=core/CHECK;s.opportunities++;
 return selectWorldQuest263(s,input);
}
/** Called once, only after the real holder and its Things are committed. */
export function notifyItemStashBorn263(s:WorldQuestCalendar263):void {s.siteOffers++;s.recent.unshift('item-stash');if(s.recent.length>5)s.recent.length=5;}
/** Historical counter name retained; it counts supported actual offers. */
export function notifyTradeRequestBorn284(s:WorldQuestCalendar263):void {s.siteOffers++;s.recent.unshift('trade-request');if(s.recent.length>5)s.recent.length=5;}
/** Same existing ticket, recorded only after its actual site birth commits. */
export function notifyPeaceTalksBorn293(s:WorldQuestCalendar263):void {s.siteOffers++;s.recent.unshift('peace-talks');if(s.recent.length>5)s.recent.length=5;}
