import {WORK_FRACTIONS} from './work-progress.ts';
/** Legacy UI units are a projection, never the authority for paid Single work.
 * Keep an unfinished Frame representable below100% even when nearest rounding
 * would cross its last half-unit. No physical work is discarded or invented. */
export function frameWorkProjectionUnits301(done:number,required:number,duration:number):number{
 const limit=duration*WORK_FRACTIONS;
 if(!Number.isFinite(done)||done<0||!Number.isFinite(required)||required<=0||!Number.isSafeInteger(limit)||limit<1)throw RangeError('Invalid frame projection');
 const units=Math.round(done/required*limit);
 return done<required?Math.min(units,limit-1):units;
}
