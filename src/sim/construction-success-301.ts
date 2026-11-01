import {effectiveSkillLevel} from './work-types.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {Pawn} from './types.ts';

const F=Math.fround;
/** Primary SkillNeed_Direct Construction0..20; upper entries must survive
 * until AFTER capacities, rather than being clamped to1 at lookup. */
const SUCCESS_BY_LEVEL301:readonly number[]=Object.freeze([
 .75,.80,.85,.875,.90,.925,.95,.975,1,1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.10,1.12,1.13,
].map(F));
export type ConstructionSuccessPawn301=Pick<Pawn,'skills'|'background'>;
function capacity(value:number,maximum:number):number {
 if(!Number.isFinite(value)||value<0)throw new RangeError('Invalid actual construction capacity');
 return F(Math.min(value,maximum));
}
/** StatWorker uses Lerp(current,current*factor,weight), NOT a reassociated
 * current*(1-weight+factor*weight). Each Single operation is rounded in order. */
function applyCapacity(current:number,factor:number,weight:number):number {
 const endpoint=F(current*factor),difference=F(endpoint-current);
 return F(current+F(difference*weight));
}
/** Pure current represented stat: real effective skill and already assessed
 * body. Caller passes its real BodyAssessment after learning/stat refresh.
 * No World, RNG, clock, light/WorkSpeedGlobal, default healthy body, generic
 * modifier callback or persisted stat is introduced. Direct Core modifiers
 * absent from the local data model are NOT claimed neutral or implemented. */
export function constructionSuccessChance301(pawn:ConstructionSuccessPawn301,body:BodyAssessment):number {
 const level=effectiveSkillLevel(pawn,'construction',pawn.skills.construction.level);
 if(!Number.isInteger(level)||level<0||level>20)throw new RangeError('Invalid actual Construction skill');
 let value=F(F(1)*SUCCESS_BY_LEVEL301[level]!);
 value=applyCapacity(value,capacity(body.capacities.manipulation,9999),F(.3));
 value=applyCapacity(value,capacity(body.capacities.sight,1),F(.2));
 return F(Math.min(1,Math.max(0,value)));
}

