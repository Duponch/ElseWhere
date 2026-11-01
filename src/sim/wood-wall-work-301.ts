import {constructionSpeed,learnSkill} from './skills.ts';
import {pawnBody} from './health-rules.ts';
import {constructionSuccessChance301} from './construction-success-301.ts';
import {isColonist} from './affiliation.ts';
import {healthRandom} from './health.ts';
import {jobDuration} from './farming.ts';
import {workProgress,setWorkUnits} from './work-progress.ts';
import {frameWorkProjectionUnits301} from './frame-work-projection-301.ts';
import {failWoodWallFrame301,isWoodWallFrame301} from './wall-frame-failure-301.ts';
import type {Job,Pawn,World} from './types.ts';
export interface WoodWallWork301 {required:number;done:number}
type Frame301=Job&{frameWork301?:WoodWallWork301};
const F=Math.fround,REQUIRED=F(F(135)*F(.7));

/** Called at actual work contact, never during load/designation. The native
 * Frame owns cumulative paid work; a new builder visit does not reset it.
 * Imported work keeps its old paid FRACTION, not invented Core history. */
export function contactWoodWallWork301(w:World,p:Pawn,j:Job):WoodWallWork301{
 if(!isWoodWallFrame301(j)||!w.jobs.includes(j)||j.reservedBy!==p.id||p.jobId!==j.id)throw Error('Admitted actual Wall Frame required');
 const frame=j as Frame301;
 if(!frame.frameWork301){const fraction=workProgress(j)/jobDuration(w,j);
  if(!Number.isFinite(fraction)||fraction<0)throw Error('Invalid historical paid frame fraction');
  frame.frameWork301={required:REQUIRED,done:F(REQUIRED*fraction)};
 }
 return frame.frameWork301;
}
export type WoodWallInterval301=
 |{kind:'working';increment:number;delta:number}
 |{kind:'complete';increment:number;delta:number}
 |{kind:'failed';receipt:ReturnType<typeof failWoodWallFrame301>;delta:number};
/** Exactly one admitted interval. Learning is real and precedes the stat;
 * failure draws precede workDone. The caller owns real completion/next-toil,
 * so this cannot recursively admit/advance a second Job in the same interval. */
export function workWoodWallInterval301(w:World,p:Pawn,j:Job,delta:number,light:number):WoodWallInterval301{
 if(!Number.isInteger(delta)||delta<1||delta>15||!Number.isFinite(light)||light<0)throw RangeError('Actual1..15 Core interval and real light required');
 const paid=contactWoodWallWork301(w,p,j);
 // The project's learned-skill representation is integer millipoints; this
 // preserves its existing passion/learning hooks, not Unity float XP identity.
 learnSkill(p.skills.construction,250*delta,p);
 const body=pawnBody(p),caps=body.capacities;
 const physical=F(F(caps.manipulation)*F(F(.8)+F(F(.2)*F(Math.min(1,caps.sight)))));
 const speed=F(F(F(constructionSpeed(p))*physical)*F(light));
 const increment=F(F(speed*F(1.7))*F(delta));
 if(isColonist(p)){
  const success=F(constructionSuccessChance301(p,body));
  const risk=F(F(1)-F(Math.pow(success,F(increment/paid.required))));
  const draw=healthRandom(w); // also consumed at success==1
  if(draw<risk)return {kind:'failed',receipt:failWoodWallFrame301(w,p,j),delta};
 }
 paid.done=F(paid.done+increment);
 // Existing UI/compatibility consumers continue to see the same fraction.
 setWorkUnits(j,frameWorkProjectionUnits301(paid.done,paid.required,jobDuration(w,j)));
 return {kind:paid.done>=paid.required?'complete':'working',increment,delta};
}
