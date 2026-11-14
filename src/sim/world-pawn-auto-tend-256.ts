import {medicalModel,modelHasPart} from './body-model.ts';
import {injuryPartRules,HP_UNIT} from './injury-rules.ts';
import {freshMissing,injuryBleed,tendInjury,tendMissingPart} from './injury-state.ts';
import {infectionTargets,tendInfection,captureInfectionTendRoom} from './infection-state.ts';
import {fluTendable,tendFlu} from './flu-state.ts';
import {immuneDiseaseTargets,tendImmuneDisease} from './immune-diseases-state.ts';
import {isParasiteKind306,parasiteTargets306,tendParasite306} from './parasites-306.ts';
import {isMechaniteKind307,mechaniteTargets307,tendMechanite307} from './mechanites-307.ts';
import type {RankedTreatment} from './care-rules.ts';
import type {MedicalRecord} from './injury-types.ts';
/** Core DoTend(null,actual,null), not the local random-quality work Toil. */
export const WORLD_AUTO_TEND_QUALITY_256=Math.round(Math.fround(Math.fround(.75)*Math.fround(.3))*1000);
export function worldPawnTendTargets256(h:MedicalRecord):RankedTreatment[]{
 if(h.death)return [];const model=medicalModel(h),rules=injuryPartRules(model),list:RankedTreatment[]=[];
 for(const i of h.injuries)if(i.tended===undefined&&i.scar?.pain===undefined&&modelHasPart(model,i.part))list.push({injuryId:i.id,priority:injuryBleed(h,i)*1.5,severity:i.severity});
 for(const m of h.missing)if(modelHasPart(model,m.part)&&freshMissing(h,m))list.push({part:m.part,priority:model.byId[m.part].hp*.12*rules[m.part].bleed*1.5,severity:HP_UNIT});
 list.push(...infectionTargets(h).map(({part:_part,...target})=>target));if(fluTendable(h))list.push({flu:true,priority:h.flu!.severity>=833000000?1:.025,severity:h.flu!.severity/1000000000*1000});list.push(...immuneDiseaseTargets(h),...parasiteTargets306(h),...mechaniteTargets307(h));
 return list.sort((a,b)=>b.priority-a.priority||b.severity-a.severity);
}
/** Core HediffComp_TendDuration.CompTended (schema 324): the 0.225 base
 * plus Rand.Range(-0.25, 0.25), clamped to the no-medicine maximum 0.7. */
export const worldAutoTendQuality324=(draw:()=>number):number=>Math.round(Math.max(0,Math.min(.7,.225+draw()*.5-.25))*1000);
export function autoTendWorldPawn256(h:MedicalRecord,version:number,draw?:()=>number):number {
 const targets=worldPawnTendTargets256(h),first=targets[0];if(!first)return 0;if(targets.slice(1).some(t=>t.priority===first.priority&&t.severity===first.severity))throw Error('Native equal-priority tend order is not represented');const q=version>=324&&draw?worldAutoTendQuality324(draw):WORLD_AUTO_TEND_QUALITY_256;
 if(first.injuryId!==undefined){if(!tendInjury(h,first.injuryId,q))throw Error('Stale WorldPawn wound');if(h.injuries.some(i=>i.id===first.injuryId&&i.infection))captureInfectionTendRoom(h,first.injuryId,1000);return 1;}
 // WoundInfection inherits tendAllAtOnce=false. No medicine means one case.
 if(first.infectionId!==undefined)return Number(tendInfection(h,first.infectionId,q));
 if(first.flu)return Number(tendFlu(h,q,version));if(first.disease)return Number(isParasiteKind306(first.disease)?tendParasite306(h,first.disease,q):isMechaniteKind307(first.disease)?tendMechanite307(h,first.disease,q):tendImmuneDisease(h,first.disease,q));return Number(tendMissingPart(h,first.part!));
}
