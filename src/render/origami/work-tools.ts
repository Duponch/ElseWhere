import type {Job,Pawn} from '../../sim/types';
/** Cosmetic props attached to confirmed jobs, not inventory or a tool mechanic.
 * Cancelled jobs, combat, incapacity and portage immediately hide the prop. */
export function origamiWorkTool(pawn:Pawn,job:Job|undefined):number{
 if(!job||pawn.jobId!==job.id||job.status!=='active'||job.reservedBy!==pawn.id||pawn.draft||pawn.stun||pawn.state!=='moving'&&pawn.state!=='working'||pawn.haul||pawn.rescue||pawn.animalRescue||pawn.need||pawn.melee||pawn.shooting?.stance)return 0;
 if(job.kind==='mine')return -31;
 if(job.kind==='chop')return -30;
 if(job.kind==='cut'||job.kind==='harvest')return -32;
 return 0;
}
